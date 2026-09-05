import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { SiteProfile, countOf, issuesOf } from './site-profile';
import { SiteProfileLoader } from './site-profile.loader';

/** One kind of problem the crawl found, and where to see it. */
export interface IssueGroup {
  issueType: string;
  severity: string;
  /** Distinct pages affected, counted the way the health score counts them. */
  pages: number;
  /** What the crawler said about it, taken from the first occurrence. */
  description: string;
  recommendation: string;
  exampleUrls: string[];
}

/** A number for one site set beside the customer's own. */
export interface SideBySide {
  label: string;
  whatItMeans: string;
  higherIsBetter: boolean;
  them: number | null;
  you: number | null;
  /** Who leads: `them`, `you`, `level`, or `unknown` when either is unmeasured. */
  leader: 'them' | 'you' | 'level' | 'unknown';
}

export interface CompetitorSeoReport {
  competitor: {
    id: string;
    name: string;
    domain: string;
    status: string;
    lastAnalyzedAt: string | null;
  };
  crawl: {
    /** Null when this competitor has never been crawled. */
    crawledAt: string | null;
    pagesCrawled: number | null;
    healthScore: number | null;
    /** Plain-language reading of the score, or why there is none. */
    verdict: string;
  };
  /** Pages by kind, so "they have nine service pages" is answerable. */
  coverage: Array<{ pageType: string; label: string; count: number; exampleUrl: string | null }>;
  /** What is wrong with their site, worst first. */
  issues: IssueGroup[];
  issuesBySeverity: Record<string, number>;
  /** Their numbers against yours, on the things that decide rankings. */
  comparison: SideBySide[];
  /** Anything the report could not measure, said plainly. */
  notes: string[];
}

const PAGE_TYPE_LABELS: Record<string, string> = {
  HOME: 'Homepage',
  SERVICE: 'Service pages',
  PRODUCT: 'Product pages',
  LOCATION: 'Location pages',
  BLOG: 'Articles and guides',
  CASE_STUDY: 'Case studies',
  FAQ: 'FAQ pages',
  ABOUT: 'About pages',
  CONTACT: 'Contact pages',
  LEGAL: 'Legal pages',
  OTHER: 'Other pages',
};

const SEVERITY_ORDER = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

/** How many example URLs to keep per problem. Enough to check, not a dump. */
const EXAMPLES_PER_ISSUE = 3;

/**
 * Everything the crawler learned about one competitor's site, set beside the
 * customer's own.
 *
 * The crawler already produced all of it. A competitor crawl runs through the
 * same pipeline as the customer's: it scores the site, it runs the issue
 * engine over every page, it types each page. What was missing was anywhere
 * to read it — the competitor tabs showed page counts and a coverage
 * comparison, and the health score and the issue list sat in the database
 * unread. "How good is their SEO?" is answered by exactly those two.
 *
 * Nothing here is inferred. A competitor with no crawl reports nulls and says
 * why, because a report that quietly renders zeros for an un-crawled site
 * tells the customer their rival has a perfect record.
 */
@Injectable()
export class CompetitorSeoReportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly profiles: SiteProfileLoader,
  ) {}

  async report(projectId: string, competitorId: string): Promise<CompetitorSeoReport> {
    const competitor = await this.prisma.competitorDomain.findFirst({
      where: { id: competitorId, projectId },
      select: {
        id: true,
        domain: true,
        name: true,
        label: true,
        status: true,
        lastAnalyzedAt: true,
        websiteId: true,
      },
    });
    if (!competitor) throw new NotFoundException('Competitor not found for this project.');

    const notes: string[] = [];

    const theirs = competitor.websiteId
      ? await this.profiles.forWebsite(competitor.websiteId, competitor.domain)
      : null;
    const yours = await this.profiles.forProject(projectId);

    if (!theirs) {
      notes.push(
        `${competitor.domain} has not been crawled yet, so there is nothing to report on it. ` +
          'Its first crawl starts within ten minutes of it being added.',
      );
    }
    if (!yours) {
      notes.push(
        'Your own site has not been crawled yet, so nothing can be set beside theirs. Run a site crawl first.',
      );
    }

    const issues = competitor.websiteId ? await this.issuesFor(competitor.websiteId) : [];
    if (theirs && theirs.healthScore == null) {
      notes.push(
        'This crawl finished before a health score was recorded, so there is no overall score for it. ' +
          'The next crawl records one.',
      );
    }

    return {
      competitor: {
        id: competitor.id,
        name: competitor.name || competitor.label || competitor.domain,
        domain: competitor.domain,
        status: competitor.status,
        lastAnalyzedAt: competitor.lastAnalyzedAt?.toISOString() ?? null,
      },
      crawl: {
        crawledAt: theirs?.crawledAt?.toISOString() ?? null,
        pagesCrawled: theirs ? theirs.totalPages : null,
        healthScore: theirs?.healthScore ?? null,
        verdict: verdictFor(theirs, yours),
      },
      coverage: theirs ? coverageOf(theirs) : [],
      issues,
      issuesBySeverity: theirs?.issuesBySeverity ?? {},
      comparison: compare(theirs, yours),
      notes,
    };
  }

  /**
   * The problems the crawl found, grouped by kind.
   *
   * Grouped rather than listed: a site with a missing meta description on 180
   * pages has one problem to fix, not 180 to read. The page count is what says
   * how big it is, and a few example URLs are what let someone check it.
   */
  private async issuesFor(websiteId: string): Promise<IssueGroup[]> {
    const job = await this.prisma.crawlJob.findFirst({
      where: { websiteId, status: 'COMPLETED' },
      orderBy: { finishedAt: 'desc' },
      select: { id: true },
    });
    if (!job) return [];

    const rows = await this.prisma.issue.findMany({
      where: { crawlJobId: job.id, status: 'OPEN' },
      select: {
        issueType: true,
        severity: true,
        affectedUrl: true,
        description: true,
        recommendation: true,
        dedupKey: true,
      },
    });

    const groups = new Map<string, IssueGroup & { seen: Set<string> }>();
    for (const row of rows) {
      const key = `${row.severity}::${row.issueType}`;
      let group = groups.get(key);
      if (!group) {
        group = {
          issueType: row.issueType,
          severity: row.severity,
          pages: 0,
          description: row.description,
          recommendation: row.recommendation,
          exampleUrls: [],
          seen: new Set<string>(),
        };
        groups.set(key, group);
      }

      const dedup = row.dedupKey || `${row.affectedUrl}::${row.issueType}`;
      if (group.seen.has(dedup)) continue;
      group.seen.add(dedup);
      group.pages++;
      if (group.exampleUrls.length < EXAMPLES_PER_ISSUE) group.exampleUrls.push(row.affectedUrl);
    }

    return [...groups.values()]
      .map(({ seen: _seen, ...group }) => group)
      .sort(
        (a, b) =>
          SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity) || b.pages - a.pages,
      );
  }
}

function coverageOf(profile: SiteProfile) {
  return Object.entries(profile.byType)
    .map(([pageType, count]) => ({
      pageType,
      label: PAGE_TYPE_LABELS[pageType] ?? pageType,
      count,
      exampleUrl: profile.exampleUrlByType[pageType] ?? null,
    }))
    .sort((a, b) => b.count - a.count);
}

/** The rows that decide whether their site out-ranks the customer's. */
const COMPARISON_ROWS: Array<{
  label: string;
  whatItMeans: string;
  higherIsBetter: boolean;
  read: (profile: SiteProfile) => number | null;
}> = [
  {
    label: 'SEO health score',
    whatItMeans: "The crawler's overall verdict out of 100, from the problems it found weighted by cost.",
    higherIsBetter: true,
    read: (p) => p.healthScore,
  },
  {
    label: 'Critical problems',
    whatItMeans: 'Faults serious enough to keep a page out of search results.',
    higherIsBetter: false,
    read: (p) => issuesOf(p, 'CRITICAL'),
  },
  {
    label: 'High-priority problems',
    whatItMeans: 'Faults costing rankings on pages that are indexed.',
    higherIsBetter: false,
    read: (p) => issuesOf(p, 'HIGH'),
  },
  {
    label: 'Indexable pages',
    whatItMeans: 'How much of the site a crawler could reach and read.',
    higherIsBetter: true,
    read: (p) => p.totalPages,
  },
  {
    label: 'Service pages',
    whatItMeans: 'A page per thing sold. One page listing everything competes for nothing in particular.',
    higherIsBetter: true,
    read: (p) => countOf(p, 'SERVICE'),
  },
  {
    label: 'Location pages',
    whatItMeans: 'Pages written for one city or area — what can rank for "service + city" searches.',
    higherIsBetter: true,
    read: (p) => countOf(p, 'LOCATION'),
  },
  {
    label: 'Articles and guides',
    whatItMeans: 'Content answering what buyers ask before they buy.',
    higherIsBetter: true,
    read: (p) => countOf(p, 'BLOG'),
  },
  {
    label: 'Pages with structured data',
    whatItMeans: 'Markup stating what a page is, so search and AI answers do not have to guess.',
    higherIsBetter: true,
    read: (p) => p.pagesWithSchema,
  },
  {
    label: 'Pages missing a description',
    whatItMeans: 'Google writes its own snippet when none is given, usually a worse one.',
    higherIsBetter: false,
    read: (p) => p.pagesMissingMetaDescription,
  },
];

export function compare(theirs: SiteProfile | null, yours: SiteProfile | null): SideBySide[] {
  return COMPARISON_ROWS.map((row) => {
    const them = theirs ? row.read(theirs) : null;
    const you = yours ? row.read(yours) : null;

    // Unknown, not level. A missing figure on either side means the question
    // was not answered, and calling that a draw would tell the customer they
    // are keeping pace with something nobody measured.
    let leader: SideBySide['leader'] = 'unknown';
    if (them != null && you != null) {
      if (them === you) leader = 'level';
      else if (row.higherIsBetter) leader = them > you ? 'them' : 'you';
      else leader = them < you ? 'them' : 'you';
    }

    return {
      label: row.label,
      whatItMeans: row.whatItMeans,
      higherIsBetter: row.higherIsBetter,
      them,
      you,
      leader,
    };
  });
}

/** One sentence on where this competitor's site stands against the customer's. */
export function verdictFor(theirs: SiteProfile | null, yours: SiteProfile | null): string {
  if (!theirs) return 'This competitor has not been crawled yet, so their site has not been assessed.';
  if (theirs.healthScore == null) {
    return `${theirs.totalPages} pages were crawled, but this crawl recorded no health score.`;
  }
  if (!yours || yours.healthScore == null) {
    return `${theirs.domain} scores ${theirs.healthScore} out of 100. Crawl your own site to see how that compares.`;
  }

  const gap = theirs.healthScore - yours.healthScore;
  if (gap === 0) {
    return `${theirs.domain} and your site both score ${theirs.healthScore} out of 100.`;
  }
  return gap > 0
    ? `${theirs.domain} scores ${theirs.healthScore} against your ${yours.healthScore} — ${gap} points ahead. The problems below are what that gap is made of.`
    : `${theirs.domain} scores ${theirs.healthScore} against your ${yours.healthScore} — you are ${-gap} points ahead. Their coverage gaps are the better place to press.`;
}
