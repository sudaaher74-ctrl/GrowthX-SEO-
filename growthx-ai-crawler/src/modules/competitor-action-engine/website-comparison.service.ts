import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { SiteProfile, ProfilePage, buildSiteProfile, countOf, EMPTY_PROFILE } from './site-profile';

/** One thing worth comparing, and how each site does on it. */
export interface ComparisonRow {
  key: string;
  label: string;
  /** What this measures, in words a business owner reads without a glossary. */
  whatItMeans: string;
  /** True when a bigger number is better; false for counts of problems. */
  higherIsBetter: boolean;
  you: number | null;
  competitors: Array<{ id: string; name: string; value: number | null }>;
  /** Competitors measurably ahead of the customer on this row. */
  aheadOfYou: string[];
  /** The gap to the best competitor, positive when they lead. */
  gapToBest: number | null;
  /** Why this row matters here, naming who is ahead. Empty when nobody is. */
  verdict: string;
}

export interface SiteSummary {
  id: string | null;
  name: string;
  domain: string;
  crawledAt: string | null;
  /** Null when the site has never been crawled — not the same as zero pages. */
  totalPages: number | null;
}

export interface WebsiteComparison {
  you: SiteSummary;
  competitors: SiteSummary[];
  rows: ComparisonRow[];
  /** Competitors with no crawl yet, named so their blank column is explained. */
  awaitingCrawl: string[];
  /** Where to start, worst gap first. */
  priorities: Array<{ area: string; verdict: string; gap: number }>;
}

/**
 * The side-by-side a customer needs to believe any of this.
 *
 * The Website Competitors tab used to print a competitor's name and the words
 * "Available upon sweep" against a field that was never populated — a promise
 * of data rather than data. Nobody trusts a comparison tool that cannot show
 * the comparison.
 *
 * Every number here is counted from pages the crawler actually fetched and
 * stored. A site that has not been crawled reports null rather than zero,
 * because "we have not looked" and "they have none" lead a reader to opposite
 * conclusions and only one of them is ever true.
 */
@Injectable()
export class WebsiteComparisonService {
  constructor(private readonly prisma: PrismaService) {}

  async compare(projectId: string): Promise<WebsiteComparison> {
    const website = await this.prisma.website.findFirst({
      where: { projectId },
      select: { id: true, domain: true },
    });

    const customerProfile = website ? await this.profileFor(website.id, website.domain) : null;

    const tracked = await this.prisma.competitorDomain.findMany({
      where: { projectId },
      select: { id: true, domain: true, name: true, label: true, websiteId: true },
      take: 5,
    });

    const competitors: Array<{ id: string; name: string; profile: SiteProfile | null }> = [];
    for (const competitor of tracked) {
      competitors.push({
        id: competitor.id,
        name: competitor.name || competitor.label || competitor.domain,
        profile: competitor.websiteId ? await this.profileFor(competitor.websiteId, competitor.domain) : null,
      });
    }

    const rows = buildComparisonRows(customerProfile, competitors);

    return {
      you: summarize(null, website?.domain ?? '—', 'Your site', customerProfile),
      competitors: competitors.map((entry) =>
        summarize(entry.id, entry.profile?.domain ?? '', entry.name, entry.profile),
      ),
      rows,
      awaitingCrawl: competitors
        .filter((entry) => !entry.profile || entry.profile.totalPages === 0)
        .map((entry) => entry.name),
      priorities: rows
        .filter((row) => row.gapToBest != null && row.gapToBest > 0 && row.aheadOfYou.length > 0)
        .sort((a, b) => (b.gapToBest ?? 0) - (a.gapToBest ?? 0))
        .slice(0, 3)
        .map((row) => ({ area: row.label, verdict: row.verdict, gap: row.gapToBest ?? 0 })),
    };
  }

  private async profileFor(websiteId: string, domain: string): Promise<SiteProfile | null> {
    const job = await this.prisma.crawlJob.findFirst({
      where: { websiteId, status: 'COMPLETED' },
      orderBy: { finishedAt: 'desc' },
      select: { id: true },
    });
    if (!job) return null;

    const pages = await this.prisma.page.findMany({
      where: { crawlJobId: job.id },
      select: {
        url: true,
        statusCode: true,
        title: true,
        metaDescription: true,
        robotsMeta: true,
        h1: true,
        pageType: true,
        crawledAt: true,
        _count: { select: { schemas: true } },
      },
      take: 500,
    });

    const shaped: ProfilePage[] = pages.map((page) => ({
      url: page.url,
      statusCode: page.statusCode,
      title: page.title,
      metaDescription: page.metaDescription,
      robotsMeta: page.robotsMeta,
      h1: page.h1,
      pageType: page.pageType,
      crawledAt: page.crawledAt,
      schemaCount: page._count.schemas,
    }));

    return buildSiteProfile(domain, shaped);
  }
}

function summarize(
  id: string | null,
  domain: string,
  name: string,
  profile: SiteProfile | null,
): SiteSummary {
  return {
    id,
    name,
    domain: profile?.domain ?? domain,
    crawledAt: profile?.crawledAt?.toISOString() ?? null,
    totalPages: profile ? profile.totalPages : null,
  };
}

/** The rows a business owner can act on, in the order they usually matter. */
const ROWS: Array<{
  key: string;
  label: string;
  whatItMeans: string;
  higherIsBetter: boolean;
  /**
   * What one of these is called, in a sentence.
   *
   * The label is already plural, so counting from it produced "1 more service
   * pages". Deriving a singular by chopping an "s" would get "articles and
   * guides" wrong; naming both forms per row is a line of data and is right
   * every time.
   */
  noun: { one: string; many: string };
  read: (profile: SiteProfile) => number;
}> = [
  {
    key: 'location_pages',
    label: 'Location pages',
    whatItMeans:
      'Pages written for one city or service area. These are what can rank for "service + city" searches; without one there is nothing for that search to find.',
    higherIsBetter: true,
    noun: { one: 'location page', many: 'location pages' },
    read: (p) => countOf(p, 'LOCATION'),
  },
  {
    key: 'service_pages',
    label: 'Service pages',
    whatItMeans:
      'A page per thing you sell. One page listing everything competes for nothing in particular.',
    higherIsBetter: true,
    noun: { one: 'service page', many: 'service pages' },
    read: (p) => countOf(p, 'SERVICE'),
  },
  {
    key: 'blog_pages',
    label: 'Articles and guides',
    whatItMeans:
      'Content answering what buyers ask before they buy. This is what earns traffic before someone knows your name.',
    higherIsBetter: true,
    noun: { one: 'article or guide', many: 'articles and guides' },
    read: (p) => countOf(p, 'BLOG'),
  },
  {
    key: 'faq_pages',
    label: 'FAQ pages',
    whatItMeans:
      'Direct answers to common questions — the format search engines and AI assistants quote most readily.',
    higherIsBetter: true,
    noun: { one: 'FAQ page', many: 'FAQ pages' },
    read: (p) => countOf(p, 'FAQ'),
  },
  {
    key: 'pages_with_schema',
    label: 'Pages with structured data',
    whatItMeans:
      'Markup that states plainly what a page is. Without it, search and AI answers have to guess, and often skip the page.',
    higherIsBetter: true,
    noun: { one: 'page with structured data', many: 'pages with structured data' },
    read: (p) => p.pagesWithSchema,
  },
  {
    key: 'total_pages',
    label: 'Indexable pages crawled',
    whatItMeans: 'How much of each site a crawler could actually reach and read.',
    higherIsBetter: true,
    noun: { one: 'indexable page', many: 'indexable pages' },
    read: (p) => p.totalPages,
  },
  {
    key: 'missing_meta',
    label: 'Pages missing a description',
    whatItMeans:
      'Google writes its own snippet when none is given, and usually writes a worse one than you would.',
    higherIsBetter: false,
    noun: { one: 'page missing a description', many: 'pages missing a description' },
    read: (p) => p.pagesMissingMetaDescription,
  },
  {
    key: 'broken_urls',
    label: 'Broken URLs',
    whatItMeans: 'Pages returning an error. They waste crawl budget and lose any links pointing at them.',
    higherIsBetter: false,
    noun: { one: 'broken URL', many: 'broken URLs' },
    read: (p) => p.brokenLinks,
  },
];

/**
 * Builds the comparison and says who is ahead on each row.
 *
 * Exported and pure: this is the text a customer reads to decide what to do
 * with their week, so it is worth testing directly rather than through a
 * database.
 */
export function buildComparisonRows(
  customer: SiteProfile | null,
  competitors: Array<{ id: string; name: string; profile: SiteProfile | null }>,
): ComparisonRow[] {
  return ROWS.map((row) => {
    const you = customer ? row.read(customer) : null;

    const values = competitors.map((entry) => ({
      id: entry.id,
      name: entry.name,
      value: entry.profile && entry.profile.totalPages > 0 ? row.read(entry.profile) : null,
    }));

    const measured = values.filter((entry) => entry.value != null) as Array<{
      id: string;
      name: string;
      value: number;
    }>;

    // "Ahead" means better on this row's own terms — more service pages is
    // better, more broken URLs is not.
    const ahead =
      you == null
        ? []
        : measured.filter((entry) =>
            row.higherIsBetter ? entry.value > you : entry.value < you,
          );

    const best = measured.length
      ? row.higherIsBetter
        ? Math.max(...measured.map((entry) => entry.value))
        : Math.min(...measured.map((entry) => entry.value))
      : null;

    const gapToBest =
      you == null || best == null ? null : row.higherIsBetter ? best - you : you - best;

    return {
      key: row.key,
      label: row.label,
      whatItMeans: row.whatItMeans,
      higherIsBetter: row.higherIsBetter,
      you,
      competitors: values,
      aheadOfYou: ahead.map((entry) => entry.name),
      gapToBest,
      verdict: verdictFor(row.noun, row.higherIsBetter, you, ahead, gapToBest),
    };
  });
}

/** The sentence under each row: who is ahead, by how much, and what it means. */
function verdictFor(
  noun: { one: string; many: string },
  higherIsBetter: boolean,
  you: number | null,
  ahead: Array<{ name: string; value: number }>,
  gapToBest: number | null,
): string {
  if (you == null) return 'Your site has not been crawled yet, so there is nothing to compare against.';
  if (ahead.length === 0) {
    return higherIsBetter
      ? `No tracked competitor has more than your ${you}. This is not a gap.`
      : `No tracked competitor has fewer than your ${you}. This is not a gap.`;
  }

  const names = ahead.map((entry) => `${entry.name} (${entry.value})`).join(', ');
  const gap = gapToBest ?? 0;
  const thing = gap === 1 ? noun.one : noun.many;

  return higherIsBetter
    ? `${names} ${ahead.length === 1 ? 'is' : 'are'} ahead of your ${you}. Closing the gap to the leader means ${gap} more ${thing}.`
    : `${names} ${ahead.length === 1 ? 'has' : 'have'} fewer than your ${you}. Getting to the leader's level means fixing ${gap} ${thing}.`;
}
