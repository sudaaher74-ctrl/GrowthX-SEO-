import { Prisma } from '@prisma/client';

/**
 * Which crawl a screen should read.
 *
 * "The latest crawl" was the answer almost everywhere, and it is the wrong
 * one whenever the latest attempt did not work. A recrawl that failed (the
 * site timed out, the free instance was put to sleep mid-crawl, the stall
 * sweep closed it) became the crawl every screen read, so a site that had
 * been audited perfectly well showed no pages, no issues and no health score
 * until another crawl happened to succeed. A crawl still running was read the
 * same way, so figures dropped to a partial count while it ran.
 */

/** A crawl that finished and read something. The minimum for showing its figures. */
export const USABLE_CRAWL: Prisma.CrawlJobWhereInput = { status: 'COMPLETED', pagesCrawled: { gt: 0 } };

/**
 * A usable crawl that also covered the site: not one the stall sweep closed
 * early (it records "Stopped early: 7 of 29 ..." on those). Crawl-to-crawl
 * comparisons need this, or pages the crawl simply never reached read as
 * pages the site removed.
 */
export const FULL_CRAWL: Prisma.CrawlJobWhereInput = {
  ...USABLE_CRAWL,
  OR: [{ errorMessage: null }, { NOT: { errorMessage: { startsWith: 'Stopped early' } } }],
};

interface CrawlLike {
  status: string;
  pagesCrawled: number;
}

/** Finished without producing anything usable. */
export function crawlFailed(crawl: CrawlLike): boolean {
  return crawl.status === 'FAILED' || crawl.status === 'CANCELLED' || (crawl.status === 'COMPLETED' && crawl.pagesCrawled === 0);
}

export function crawlUsable(crawl: CrawlLike): boolean {
  return crawl.status === 'COMPLETED' && crawl.pagesCrawled > 0;
}

/**
 * From a site's crawls, newest first: the one to show, and the newest attempt
 * when that is a different, failed one.
 *
 * A crawl in progress is still shown (screens poll it for progress); only a
 * finished attempt that produced nothing is passed over for the last usable
 * crawl before it.
 */
export function crawlToShow<T extends CrawlLike>(crawls: T[]): { shown: T | null; failedAttempt: T | null; lastUsable: T | null } {
  const latest = crawls[0] ?? null;
  const lastUsable = crawls.find(crawlUsable) ?? null;
  if (latest && crawlFailed(latest) && lastUsable) {
    return { shown: lastUsable, failedAttempt: latest, lastUsable };
  }
  return { shown: latest, failedAttempt: null, lastUsable };
}
