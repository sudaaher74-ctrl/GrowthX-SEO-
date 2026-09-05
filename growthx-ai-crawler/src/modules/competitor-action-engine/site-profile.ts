/**
 * What one crawled site looks like, reduced to the handful of numbers a
 * competitor comparison actually turns on.
 *
 * Built from pages the crawler already stores, so nothing here needs a new
 * fetch. Kept as a plain shape with no Prisma types so the comparison logic
 * below can be tested without a database.
 */
export interface SiteProfile {
  domain: string;
  /** Null for a site that has never been crawled — not the same as a site with no pages. */
  crawledAt: Date | null;
  totalPages: number;
  /** Pages by `pageType`, which is what makes "they have six city pages" answerable. */
  byType: Record<string, number>;
  pagesMissingMetaDescription: number;
  pagesMissingH1: number;
  pagesNoindex: number;
  pagesWithSchema: number;
  brokenLinks: number;
  /**
   * The crawl's own health score, 0-100, or null when the crawl did not
   * record one.
   *
   * Every crawl computes this and stores it on the job — competitors' crawls
   * included, since they run through the same crawler. Nothing read it for a
   * competitor, so the one number that most directly answers "how good is
   * their SEO?" was being computed and thrown away on every competitor sweep.
   */
  healthScore: number | null;
  /**
   * Open issues the crawl found, counted by severity.
   *
   * Deduplicated the same way the health score deduplicates them, so the
   * counts and the score describe the same set of problems. An empty record
   * means the crawl found none; it is not the same as a crawl that never ran,
   * which is what `crawledAt: null` says.
   */
  issuesBySeverity: Record<string, number>;
  // Content freshness is deliberately absent. The obvious implementation —
  // the newest blog page's crawledAt — is the date we fetched it, not the date
  // it was published, and the crawler stores no publish date. A field that
  // looks like freshness and is really crawl recency is worse than no field:
  // it would rank a stale site highly for having been crawled this morning.
  /** A sample URL per page type, so a finding can link to what was seen. */
  exampleUrlByType: Record<string, string>;
}

export const EMPTY_PROFILE: Omit<SiteProfile, 'domain'> = {
  crawledAt: null,
  totalPages: 0,
  byType: {},
  pagesMissingMetaDescription: 0,
  pagesMissingH1: 0,
  pagesNoindex: 0,
  pagesWithSchema: 0,
  brokenLinks: 0,
  healthScore: null,
  issuesBySeverity: {},
  exampleUrlByType: {},
};

/** A crawled page, in the shape the profile builder needs. */
export interface ProfilePage {
  url: string;
  statusCode: number;
  title: string | null;
  metaDescription: string | null;
  robotsMeta: string | null;
  h1: string[];
  pageType: string;
  crawledAt: Date;
  schemaCount: number;
}

/**
 * Folds a site's crawled pages into the comparison shape.
 *
 * Only 2xx pages count towards coverage: a 404 that still carries a title is
 * not a service page anyone can reach, and counting it would invent coverage
 * the customer does not have.
 */
export function buildSiteProfile(
  domain: string,
  pages: ProfilePage[],
  crawl?: { healthScore: number | null; issuesBySeverity: Record<string, number> },
): SiteProfile {
  const reachable = pages.filter((page) => page.statusCode >= 200 && page.statusCode < 300);

  const byType: Record<string, number> = {};
  const exampleUrlByType: Record<string, string> = {};
  let pagesMissingMetaDescription = 0;
  let pagesMissingH1 = 0;
  let pagesNoindex = 0;
  let pagesWithSchema = 0;
  let crawledAt: Date | null = null;

  for (const page of reachable) {
    byType[page.pageType] = (byType[page.pageType] ?? 0) + 1;
    if (!exampleUrlByType[page.pageType]) exampleUrlByType[page.pageType] = page.url;

    if (!page.metaDescription?.trim()) pagesMissingMetaDescription++;
    if (!page.h1?.length) pagesMissingH1++;
    if (/noindex/i.test(page.robotsMeta ?? '')) pagesNoindex++;
    if (page.schemaCount > 0) pagesWithSchema++;

    if (!crawledAt || page.crawledAt > crawledAt) crawledAt = page.crawledAt;
  }

  return {
    domain,
    crawledAt,
    totalPages: reachable.length,
    byType,
    pagesMissingMetaDescription,
    pagesMissingH1,
    pagesNoindex,
    pagesWithSchema,
    brokenLinks: pages.filter((page) => page.statusCode >= 400).length,
    healthScore: crawl?.healthScore ?? null,
    issuesBySeverity: crawl?.issuesBySeverity ?? {},
    exampleUrlByType,
  };
}

/** How many issues of a severity a crawl found, treating absent as zero. */
export function issuesOf(profile: SiteProfile, severity: string): number {
  return profile.issuesBySeverity[severity] ?? 0;
}

/** How many pages of a kind a site has, treating absent as zero. */
export function countOf(profile: SiteProfile, pageType: string): number {
  return profile.byType[pageType] ?? 0;
}
