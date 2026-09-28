/**
 * What happened when the crawler asked a website for one page.
 *
 * A crawl stores a row for every HTML response, whatever its status, so the
 * number of rows — and `CrawlJob.pagesCrawled`, which counts them — is a count
 * of attempts, not of pages read. Showing that number as "Pages read" put 300
 * on a competitor's card when 16 of its pages had opened and the rest had been
 * turned away, while the kinds of pages printed beneath it added up to 16.
 *
 * Everything the customer is shown as a page read is counted with `OPENED_PAGE`
 * (or `pageOutcome`, which agrees with it), so a headline figure and the
 * breakdown under it are always the same pages.
 */
export type PageOutcome =
  /** A working page: 2xx, or a redirect the crawler followed. */
  | 'opened'
  /** The site turned the crawler away: a firewall, a rate limit, a login. */
  | 'refused'
  /** The site answered with an error: not found, gone, server error. */
  | 'errored'
  /** Nothing answered at all: DNS, timeout, connection reset. */
  | 'noAnswer';

export function pageOutcome(statusCode: number | null | undefined, blockedSuspected: boolean | null | undefined): PageOutcome {
  if (blockedSuspected) return 'refused';
  if (typeof statusCode !== 'number' || statusCode < 200) return 'noAnswer';
  return statusCode < 400 ? 'opened' : 'errored';
}

/** Prisma `where` for the pages `pageOutcome` calls opened. */
export const OPENED_PAGE = { statusCode: { gte: 200, lt: 400 }, blockedSuspected: false } as const;
