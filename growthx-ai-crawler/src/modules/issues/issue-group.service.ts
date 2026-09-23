import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { normaliseUrl } from './fingerprint.util';
import { FixClass, fixClassFor } from './fix-class';
import { impactScore } from './impact-score.util';
import { IssueCountService, OpenFinding, Severity } from './issue-count.service';
import { renderCopy } from './issue-copy';

/**
 * One problem on one site, however many pages it touches.
 *
 * The unit the queue is displayed in. Before this, the dashboard's priority
 * queue showed five rows that were all the same schema defect on five product
 * URLs, and the user never learned there were 150 findings of other kinds.
 */
export interface IssueGroup {
  groupKey: string;
  issueType: string;
  category: string | null;
  /** The most severe member. A group is as urgent as its worst page. */
  severity: Severity;
  /** The least certain member. A group is as trustworthy as its weakest evidence. */
  confidence: 'CONFIRMED' | 'LIKELY' | 'ADVISORY';
  affectedCount: number;
  /** The first five, for the collapsed row. */
  sampleUrls: string[];
  /** True only when every member can be auto-fixed. One exception makes it false. */
  aiFixAvailable: boolean;
  fixClass: FixClass;
  /** 0-100. §6 of docs/workflow/00-ARCHITECTURE.md. */
  impact: number;
  /** False when impact used the neutral stand-in because Search Console is not connected. */
  reachAvailable: boolean;
  firstDetectedAt: string;
  /** The highest across the group. */
  regressionCount: number;
  /**
   * Readable but still technical. The plain-language copy layer replaces these
   * three; until then they carry the engine's own description and
   * recommendation rather than anything written to sound better than it is.
   */
  title: string;
  summary: string;
  action: string;
}

export interface IssueGroupList {
  groups: IssueGroup[];
  /**
   * Whether the ordering is traffic-weighted. When false, the UI says
   * "connect Search Console for traffic-weighted priority" rather than
   * presenting a confidently wrong order as if it were measured.
   */
  reachAvailable: boolean;
}

export interface IssueGroupPages {
  items: Array<{ url: string; severity: Severity; firstDetectedAt: string; regressionCount: number }>;
  nextCursor: string | null;
  total: number;
}

export interface GroupFilters {
  status?: string;
  source?: string;
  severity?: string;
  limit?: number;
}

/** Lower is less certain. The group takes its least certain member's rating. */
const CONFIDENCE_RANK: Record<string, number> = { ADVISORY: 1, LIKELY: 2, CONFIRMED: 3 };
const SEVERITY_RANK: Record<string, number> = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };

const SAMPLE_SIZE = 5;
const DEFAULT_GROUP_LIMIT = 50;
const DEFAULT_PAGE_LIMIT = 100;
const MAX_PAGE_LIMIT = 500;

@Injectable()
export class IssueGroupService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly counts: IssueCountService,
  ) {}

  async groupsForProject(
    projectId: string,
    filters: GroupFilters = {},
    periodDays = 28,
  ): Promise<IssueGroupList> {
    // Findings in this module are all the website audit's. Asking for another
    // detector's findings gets an honest empty list, not the audit's findings
    // relabelled.
    if (filters.source && filters.source.toUpperCase() !== 'WEBSITE') {
      return { groups: [], reachAvailable: false };
    }
    // Only open findings exist in the latest crawl's queue. Anything else is a
    // history question this endpoint does not answer.
    if (filters.status && filters.status.toUpperCase() !== 'OPEN') {
      return { groups: [], reachAvailable: false };
    }

    const open = await this.counts.openFindings(projectId);
    const members = groupBy(open, (f) => f.groupKey);
    const reach = await this.reachByGroup(projectId, members, periodDays);
    const text = await this.representativeText(projectId, members);

    const groups: IssueGroup[] = [];
    for (const [groupKey, findings] of members) {
      const group = summarise(groupKey, findings, reach.get(groupKey) ?? null, text.get(groupKey));
      if (filters.severity && group.severity !== filters.severity.toUpperCase()) continue;
      groups.push(group);
    }

    // Highest impact first. On a tie, the older finding: something open for
    // three weeks should not sit below a newcomer with the same score.
    groups.sort(
      (a, b) =>
        b.impact - a.impact ||
        a.firstDetectedAt.localeCompare(b.firstDetectedAt) ||
        a.groupKey.localeCompare(b.groupKey),
    );

    const limit = clampLimit(filters.limit, DEFAULT_GROUP_LIMIT, MAX_PAGE_LIMIT);
    return {
      groups: groups.slice(0, limit),
      reachAvailable: groups.length > 0 ? groups.every((g) => g.reachAvailable) : reach.size > 0,
    };
  }

  /**
   * Every affected page of one group, paginated.
   *
   * The collapsed row shows five. A group can have thousands, and the list
   * behind "29 pages" has to be reachable in full.
   */
  async pagesForGroup(
    projectId: string,
    groupKey: string,
    limit?: number,
    cursor?: string,
  ): Promise<IssueGroupPages> {
    const open = await this.counts.openFindings(projectId);
    const members = open
      .filter((f) => f.groupKey === groupKey)
      .sort((a, b) => a.affectedUrl.localeCompare(b.affectedUrl));

    const size = clampLimit(limit, DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT);
    const start = decodeCursor(cursor);
    const slice = members.slice(start, start + size);
    const next = start + size;

    return {
      items: slice.map((f) => ({
        url: f.affectedUrl,
        severity: f.severity,
        firstDetectedAt: f.firstDetectedAt.toISOString(),
        regressionCount: f.regressionCount,
      })),
      nextCursor: next < members.length ? encodeCursor(next) : null,
      total: members.length,
    };
  }

  /**
   * Share of the project's search impressions that lands on each group's
   * pages, 0-100. Absent entirely when Search Console has no page data for the
   * project — which the caller turns into the neutral stand-in, labelled as one.
   *
   * URLs are compared normalised. Search Console reports
   * `https://www.example.com/a` while the crawler may have recorded
   * `https://example.com/a/`; compared raw, a connected project would look as
   * though none of its problem pages ever received a single impression.
   */
  private async reachByGroup(
    projectId: string,
    members: Map<string, OpenFinding[]>,
    periodDays: number,
  ): Promise<Map<string, number>> {
    const since = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);
    const rows = await this.prisma.gscDailyMetric.groupBy({
      by: ['page'],
      where: { projectId, grain: 'PAGE', date: { gte: since }, page: { not: null } },
      _sum: { impressions: true },
    });

    const byPage = new Map<string, number>();
    let total = 0;
    for (const row of rows) {
      const impressions = row._sum.impressions ?? 0;
      if (!row.page || impressions <= 0) continue;
      const key = normaliseUrl(row.page);
      byPage.set(key, (byPage.get(key) ?? 0) + impressions);
      total += impressions;
    }

    const reach = new Map<string, number>();
    if (total === 0) return reach;

    for (const [groupKey, findings] of members) {
      const pages = new Set(findings.map((f) => normaliseUrl(f.affectedUrl)));
      let impressions = 0;
      for (const page of pages) impressions += byPage.get(page) ?? 0;
      reach.set(groupKey, (impressions / total) * 100);
    }
    return reach;
  }

  /**
   * One description and recommendation per group, taken from a real row.
   *
   * These are the engine's own words. The plain-language layer will replace
   * them; until it does, a group says exactly what its findings said rather
   * than a paraphrase nobody wrote down.
   */
  private async representativeText(
    projectId: string,
    members: Map<string, OpenFinding[]>,
  ): Promise<Map<string, { summary: string; action: string }>> {
    const crawls = await this.counts.latestCrawls(projectId);
    if (crawls.length === 0 || members.size === 0) return new Map();

    const types = [...new Set([...members.values()].map((fs) => fs[0].issueType))];
    const rows = await this.prisma.issue.findMany({
      where: {
        crawlJobId: { in: crawls.map((c) => c.id) },
        status: 'OPEN',
        issueType: { in: types },
      },
      select: { issueType: true, description: true, recommendation: true },
      distinct: ['issueType'],
    });

    const byType = new Map(rows.map((r) => [r.issueType, r]));
    const text = new Map<string, { summary: string; action: string }>();
    for (const [groupKey, findings] of members) {
      const row = byType.get(findings[0].issueType);
      if (row) text.set(groupKey, { summary: row.description, action: row.recommendation });
    }
    return text;
  }
}

function summarise(
  groupKey: string,
  findings: OpenFinding[],
  reach: number | null,
  text: { summary: string; action: string } | undefined,
): IssueGroup {
  const first = findings[0];
  let severity = first.severity;
  let confidence = first.confidence;
  let firstDetectedAt = first.firstDetectedAt;
  let regressionCount = 0;
  let allAutoFixable = true;

  for (const f of findings) {
    if ((SEVERITY_RANK[f.severity] ?? 0) > (SEVERITY_RANK[severity] ?? 0)) severity = f.severity;
    if ((CONFIDENCE_RANK[f.confidence] ?? 0) < (CONFIDENCE_RANK[confidence] ?? 0)) confidence = f.confidence;
    if (f.firstDetectedAt < firstDetectedAt) firstDetectedAt = f.firstDetectedAt;
    regressionCount = Math.max(regressionCount, f.regressionCount);
    allAutoFixable = allAutoFixable && f.aiFixAvailable;
  }

  const fixClass = fixClassFor(first.issueType);
  const { impact, reachAvailable } = impactScore({ severity, confidence, fixClass, reach });
  const urls = [...new Set(findings.map((f) => f.affectedUrl))].sort();

  const copy = renderCopy(first.issueType, { n: findings.length, traffic: reach });

  return {
    groupKey,
    issueType: first.issueType,
    category: first.category,
    severity,
    confidence: normaliseConfidence(confidence),
    affectedCount: findings.length,
    sampleUrls: urls.slice(0, SAMPLE_SIZE),
    aiFixAvailable: allAutoFixable,
    fixClass,
    impact,
    reachAvailable,
    firstDetectedAt: firstDetectedAt.toISOString(),
    regressionCount,
    title: copy.title || readableType(first.issueType),
    summary: copy.cost || text?.summary || '',
    action: copy.action || text?.action || '',
  };
}

/** MISSING_META_DESCRIPTION -> "Missing meta description". */
export function readableType(issueType: string): string {
  const words = issueType.toLowerCase().split('_').filter(Boolean).join(' ');
  return words ? words[0].toUpperCase() + words.slice(1) : issueType;
}

function normaliseConfidence(c: string): IssueGroup['confidence'] {
  return c === 'CONFIRMED' || c === 'ADVISORY' ? c : 'LIKELY';
}

function groupBy<T>(items: T[], key: (t: T) => string): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    const list = out.get(k);
    if (list) list.push(item);
    else out.set(k, [item]);
  }
  return out;
}

function clampLimit(limit: number | undefined, fallback: number, max: number): number {
  if (limit === undefined || !Number.isFinite(limit) || limit <= 0) return fallback;
  return Math.min(Math.floor(limit), max);
}

/**
 * Cursors are opaque offsets. Opaque so a client cannot build one by hand and
 * come to depend on the encoding; an offset because the list is one crawl's
 * findings, held in memory, and stable between two requests for it.
 */
function encodeCursor(offset: number): string {
  return Buffer.from(String(offset), 'utf8').toString('base64url');
}

function decodeCursor(cursor: string | undefined): number {
  if (!cursor) return 0;
  const n = parseInt(Buffer.from(cursor, 'base64url').toString('utf8'), 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}
