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
  /** Most recent blog/article page, for content freshness. */
  newestContentAt: Date | null;
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
  newestContentAt: null,
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
export function buildSiteProfile(domain: string, pages: ProfilePage[]): SiteProfile {
  const reachable = pages.filter((page) => page.statusCode >= 200 && page.statusCode < 300);

  const byType: Record<string, number> = {};
  const exampleUrlByType: Record<string, string> = {};
  let pagesMissingMetaDescription = 0;
  let pagesMissingH1 = 0;
  let pagesNoindex = 0;
  let pagesWithSchema = 0;
  let newestContentAt: Date | null = null;
  let crawledAt: Date | null = null;

  for (const page of reachable) {
    byType[page.pageType] = (byType[page.pageType] ?? 0) + 1;
    if (!exampleUrlByType[page.pageType]) exampleUrlByType[page.pageType] = page.url;

    if (!page.metaDescription?.trim()) pagesMissingMetaDescription++;
    if (!page.h1?.length) pagesMissingH1++;
    if (/noindex/i.test(page.robotsMeta ?? '')) pagesNoindex++;
    if (page.schemaCount > 0) pagesWithSchema++;

    if (page.pageType === 'BLOG' && (!newestContentAt || page.crawledAt > newestContentAt)) {
      newestContentAt = page.crawledAt;
    }
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
    newestContentAt,
    exampleUrlByType,
  };
}

/** How many pages of a kind a site has, treating absent as zero. */
export function countOf(profile: SiteProfile, pageType: string): number {
  return profile.byType[pageType] ?? 0;
}
