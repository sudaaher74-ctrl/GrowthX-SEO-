import { crawlFailed as failed, crawlUsable } from '../crawler/crawl-selection';

/**
 * What a competitor's crawl history says about it: which crawl its figures
 * come from, what state the latest attempt is in, and whether to try again.
 *
 * The competitor list used to read the latest crawl alone. A crawl that
 * failed (the site timed out, the instance restarted mid-crawl, the stall
 * sweep closed it) then became the competitor's only crawl. It showed zero
 * pages and "Still reading their website" for ever, because a new crawl was
 * started only for a competitor never crawled at all, and the next one came
 * from the nightly sweep at the earliest.
 */

export interface CrawlSummary {
  id: string;
  status: string;
  pagesCrawled: number;
  healthScore: number | null;
  errorMessage: string | null;
  createdAt: Date;
  finishedAt: Date | null;
  updatedAt: Date;
}

export interface CompetitorCrawlState {
  /** The newest crawl that read at least one page. Figures come from this one. */
  good: CrawlSummary | null;
  /** The newest crawl of any status, for showing what is happening now. */
  latest: CrawlSummary | null;
  /** Why the latest attempt produced nothing, when it did not. */
  failureReason: string | null;
  /** Start another crawl now. */
  retry: boolean;
}

/** How long after a failed attempt before another is started. */
export const RETRY_AFTER_MS = 30 * 60 * 1000;
/** Failed attempts in a day after which retrying waits for the nightly sweep. */
export const MAX_FAILURES_PER_DAY = 3;

const ACTIVE = new Set(['PENDING', 'RUNNING']);

/**
 * @param crawls this competitor's site crawls, newest first. A handful is
 *   enough: only the newest good one and the last day's failures matter.
 */
export function competitorCrawlState(crawls: CrawlSummary[], now: Date = new Date()): CompetitorCrawlState {
  const latest = crawls[0] ?? null;
  const good = crawls.find(crawlUsable) ?? null;

  if (!latest) return { good: null, latest: null, failureReason: null, retry: true };

  const latestFailed = failed(latest);
  const failureReason = latestFailed
    ? latest.errorMessage?.trim() ||
      (latest.status === 'COMPLETED'
        ? 'The crawl finished without being able to read any page of the site.'
        : 'The crawl stopped before it read any page of the site.')
    : null;

  // A crawl in progress will report for itself, and a site already read once
  // is re-read by the nightly sweep; neither needs a retry from here.
  if (ACTIVE.has(latest.status) || good || !latestFailed) {
    return { good, latest, failureReason, retry: false };
  }

  const endedAt = (latest.finishedAt ?? latest.updatedAt).getTime();
  const dayAgo = now.getTime() - 24 * 60 * 60 * 1000;
  const failuresToday = crawls.filter((c) => failed(c) && c.createdAt.getTime() >= dayAgo).length;
  const retry = now.getTime() - endedAt >= RETRY_AFTER_MS && failuresToday < MAX_FAILURES_PER_DAY;

  return { good, latest, failureReason, retry };
}
