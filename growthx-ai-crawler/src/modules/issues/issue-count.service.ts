import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { fingerprintFor, fingerprintScope, issueGroupKey } from './fingerprint.util';
import { fixClassFor } from './fix-class';

/**
 * The one definition of how many things are wrong with a site.
 *
 * The same crawl of one site used to be reported three ways: 100 open issues on
 * the audit screen, 156 on the dashboard, 100 fixes in the Fix Engine — and the
 * dashboard printed `CRITICAL 0 · HIGH 0 · MEDIUM 0 · LOW 0` directly above
 * five rows each tagged HIGH. Each screen counted for itself, and no two
 * counted the same thing. Every screen now reads this, and none counts alone.
 */
export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export const SEVERITIES: readonly Severity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

/** Higher number is more urgent. Used to pick one severity per finding. */
const SEVERITY_RANK: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };

export interface IssueCounts {
  /** Distinct fingerprints with status OPEN. The headline number. */
  openFindings: number;
  /** Distinct groupKeys with at least one open fingerprint. Queue length. */
  openGroups: number;
  /** By severity, distinct fingerprints, open only. Sums to openFindings, always. */
  bySeverity: Record<Severity, number>;
  /** Open findings whose type routes to AUTO. Drives "Fix all safe (n)". */
  autoFixable: number;
  resolvedThisPeriod: number;
  regressedThisPeriod: number;
  pagesCrawled: number;
  /**
   * The stored score for a single site; a page-weighted average across several.
   * Null when no crawl has produced one — not zero, which would read as the
   * worst possible site rather than an unmeasured one.
   */
  healthScore: number | null;
  /** The crawls these figures came from, so a screen can say how fresh they are. */
  crawledAt: string | null;
}

/** One open finding in the latest crawl, reduced to what counting needs. */
export interface OpenFinding {
  fingerprint: string;
  groupKey: string;
  issueType: string;
  severity: Severity;
  confidence: string;
  category: string | null;
  affectedUrl: string;
  aiFixAvailable: boolean;
  firstDetectedAt: Date;
  regressionCount: number;
  websiteId: string;
}

@Injectable()
export class IssueCountService {
  private readonly logger = new Logger(IssueCountService.name);

  constructor(private readonly prisma: PrismaService) {}

  async countsForProject(projectId: string, periodDays = 28): Promise<IssueCounts> {
    const since = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);
    const latest = await this.latestCrawls(projectId);
    const open = await this.openFindings(projectId, latest);

    const bySeverity: Record<Severity, number> = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
    const groups = new Set<string>();
    let autoFixable = 0;
    let regressed = 0;

    // `openFindings` already holds one entry per fingerprint, so every count
    // below is of distinct findings, and each lands in exactly one severity.
    // That is what guarantees the buckets sum to the total.
    for (const f of open) {
      bySeverity[f.severity]++;
      groups.add(f.groupKey);
      if (fixClassFor(f.issueType) === 'AUTO') autoFixable++;
      if (f.regressionCount > 0 && crawledSince(latest, f.websiteId, since)) regressed++;
    }

    const counts: IssueCounts = {
      openFindings: open.length,
      openGroups: groups.size,
      bySeverity,
      autoFixable,
      resolvedThisPeriod: await this.resolvedSince(projectId, since),
      regressedThisPeriod: regressed,
      pagesCrawled: latest.reduce((sum, c) => sum + c.pagesCrawled, 0),
      healthScore: combinedHealthScore(latest),
      crawledAt: newest(latest),
    };

    assertSeveritiesSum(counts);
    return counts;
  }

  /**
   * Every open finding in the latest completed crawl of each of the project's
   * websites, one per fingerprint.
   *
   * Reached through Website -> CrawlJob, not through Issue.projectId, and the
   * fingerprint is derived here when the row does not carry one. Both are for
   * the same reason: rows written before the identity backfill has run have
   * neither. Filtering on them would count a fully crawled site as having
   * nothing wrong with it — a worse answer than the inconsistent one this
   * service replaces, and on the first screen a client sees.
   */
  async openFindings(
    projectId: string,
    latest?: LatestCrawl[],
  ): Promise<OpenFinding[]> {
    const crawls = latest ?? (await this.latestCrawls(projectId));
    if (crawls.length === 0) return [];

    const rows = await this.prisma.issue.findMany({
      where: { crawlJobId: { in: crawls.map((c) => c.id) }, status: 'OPEN' },
      select: {
        crawlJobId: true,
        fingerprint: true,
        groupKey: true,
        issueType: true,
        severity: true,
        confidence: true,
        category: true,
        affectedUrl: true,
        aiFixAvailable: true,
        firstDetectedAt: true,
        regressionCount: true,
      },
    });

    const websiteByCrawl = new Map(crawls.map((c) => [c.id, c.websiteId]));
    const byFingerprint = new Map<string, OpenFinding>();

    for (const row of rows) {
      const websiteId = websiteByCrawl.get(row.crawlJobId) as string;
      const scope = fingerprintScope(projectId, websiteId);
      const fingerprint = row.fingerprint ?? fingerprintFor(scope, row.issueType, row.affectedUrl);
      const severity = row.severity as Severity;

      const candidate: OpenFinding = {
        fingerprint,
        groupKey: row.groupKey ?? issueGroupKey(scope, row.issueType),
        issueType: row.issueType,
        severity,
        confidence: row.confidence,
        category: row.category,
        affectedUrl: row.affectedUrl,
        aiFixAvailable: row.aiFixAvailable,
        firstDetectedAt: row.firstDetectedAt,
        regressionCount: row.regressionCount,
        websiteId,
      };

      // Two rows can share a fingerprint within one crawl when the crawler
      // reached the same page by two spellings of its URL. They are one
      // finding. Keep the more severe reading, and the earlier first-seen date,
      // so the count is of problems and not of the routes the crawler took.
      const seen = byFingerprint.get(fingerprint);
      if (!seen) {
        byFingerprint.set(fingerprint, candidate);
        continue;
      }
      if ((SEVERITY_RANK[severity] ?? 0) > (SEVERITY_RANK[seen.severity] ?? 0)) {
        seen.severity = severity;
      }
      if (candidate.firstDetectedAt < seen.firstDetectedAt) {
        seen.firstDetectedAt = candidate.firstDetectedAt;
      }
      seen.regressionCount = Math.max(seen.regressionCount, candidate.regressionCount);
      seen.aiFixAvailable = seen.aiFixAvailable && candidate.aiFixAvailable;
    }

    return [...byFingerprint.values()];
  }

  /**
   * The latest completed crawl of each website in the project.
   *
   * Only these contribute open findings. A finding recorded by an older crawl
   * and not seen since has either been fixed or is a page the newer crawl did
   * not reach; counting it either way would inflate the total with history.
   */
  async latestCrawls(projectId: string): Promise<LatestCrawl[]> {
    const websites = await this.prisma.website.findMany({
      where: { projectId },
      select: { id: true },
    });
    if (websites.length === 0) return [];

    const crawls: LatestCrawl[] = [];
    for (const w of websites) {
      const job = await this.prisma.crawlJob.findFirst({
        where: { websiteId: w.id, status: 'COMPLETED' },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          websiteId: true,
          pagesCrawled: true,
          healthScore: true,
          finishedAt: true,
          createdAt: true,
        },
      });
      if (job) crawls.push(job);
    }
    return crawls;
  }

  /**
   * Distinct findings resolved in the period.
   *
   * Reconciliation records a resolution on the rows of the crawl that last
   * saw the finding, which is never the latest crawl — by definition the
   * latest one no longer contains it. So this reads across the project's
   * crawls rather than only the latest.
   */
  private async resolvedSince(projectId: string, since: Date): Promise<number> {
    const rows = await this.prisma.issue.findMany({
      where: {
        crawlJob: { website: { projectId } },
        status: 'RESOLVED',
        resolvedAt: { gte: since },
        fingerprint: { not: null },
      },
      select: { fingerprint: true },
    });
    return new Set(rows.map((r) => r.fingerprint)).size;
  }
}

export interface LatestCrawl {
  id: string;
  websiteId: string;
  pagesCrawled: number;
  healthScore: number | null;
  finishedAt: Date | null;
  createdAt: Date;
}

function crawledSince(latest: LatestCrawl[], websiteId: string, since: Date): boolean {
  const crawl = latest.find((c) => c.websiteId === websiteId);
  if (!crawl) return false;
  return (crawl.finishedAt ?? crawl.createdAt) >= since;
}

/**
 * One site: its stored score, exactly as every other screen shows it. Several:
 * weighted by pages crawled, so a 500-page site is not outvoted by a 5-page
 * landing site. Recomputing from findings instead would disagree with the
 * stored score, which accounts for site-wide failures the findings alone do
 * not show — and two numbers for one site is the problem being fixed here.
 */
export function combinedHealthScore(latest: LatestCrawl[]): number | null {
  const scored = latest.filter((c) => c.healthScore !== null);
  if (scored.length === 0) return null;
  if (scored.length === 1) return scored[0].healthScore;

  const pages = scored.reduce((sum, c) => sum + Math.max(c.pagesCrawled, 1), 0);
  const weighted = scored.reduce(
    (sum, c) => sum + (c.healthScore as number) * Math.max(c.pagesCrawled, 1),
    0,
  );
  return Math.round(weighted / pages);
}

function newest(latest: LatestCrawl[]): string | null {
  const times = latest
    .map((c) => (c.finishedAt ?? c.createdAt).getTime())
    .filter((t) => Number.isFinite(t));
  return times.length ? new Date(Math.max(...times)).toISOString() : null;
}

/**
 * The regression guard for the bug that started this: a severity breakdown of
 * 0/0/0/0 printed next to a total of 156.
 *
 * Holds by construction, since each distinct finding is placed in exactly one
 * bucket. Checked anyway, because the next change to this file is the one that
 * breaks the construction, and it should fail loudly in development rather
 * than reach a client's dashboard as two numbers that cannot both be true.
 */
export function assertSeveritiesSum(counts: IssueCounts): void {
  const sum = SEVERITIES.reduce((s, sev) => s + counts.bySeverity[sev], 0);
  if (sum === counts.openFindings) return;

  const message =
    `IssueCounts invariant broken: bySeverity sums to ${sum} ` +
    `but openFindings is ${counts.openFindings}.`;
  if (process.env.NODE_ENV === 'production') {
    // In production a wrong breakdown is still better than no dashboard.
    new Logger('IssueCountService').error(message);
    return;
  }
  throw new Error(message);
}
