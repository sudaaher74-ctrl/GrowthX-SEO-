import { PAGE_TYPE_LABELS } from '../crawler/page-type';
import { competitorCrawlState, CrawlSummary } from './competitor-crawl-state';

/**
 * One website on the Competitor Intelligence page — the customer's own or a
 * competitor's — described the way the customer asks about it: are you
 * reading it, how much of it have you read, and what is on it.
 *
 * The competitor list already carried a crawl status and a page count, but
 * nothing drew them: a competitor still being read showed up only as "Not
 * measured · Still reading their website" in the threat panel, with no way to
 * tell a crawl that was running from one that had quietly failed, and no view
 * of what kinds of pages a rival has.
 */
export type SiteReadStatus =
  /** A crawl is running now; `pagesSoFar` counts up. */
  | 'READING'
  /** A crawl is queued and has not started. */
  | 'QUEUED'
  /** At least one crawl read pages; the figures come from the newest. */
  | 'READ'
  /** Every attempt so far read nothing; `error` says why. */
  | 'FAILED'
  /** Never crawled. */
  | 'WAITING';

export interface PageTypeCount {
  type: string;
  label: string;
  count: number;
}

export interface WebsiteOverview {
  role: 'you' | 'competitor';
  competitorId: string | null;
  domain: string;
  name: string;
  status: SiteReadStatus;
  /** Pages in the crawl the figures come from. */
  pagesRead: number;
  /** Pages the running crawl has read so far; null when nothing is running. */
  pagesSoFar: number | null;
  readingStartedAt: string | null;
  lastReadAt: string | null;
  /** Why the newest attempt read nothing, when it did not. */
  error: string | null;
  healthScore: number | null;
  rating: number | null;
  reviewCount: number | null;
  /** Kinds of working pages in the crawl the figures come from, most first. */
  pageTypes: PageTypeCount[];
}

/** A crawl row as the overview reads it: the summary plus when it started. */
export type OverviewCrawl = CrawlSummary & { startedAt: Date | null };

const RUNNING = new Set(['RUNNING']);
const QUEUED = new Set(['PENDING']);

/** Status, progress and dates for one site, from its crawls newest first. */
export function readState(crawls: OverviewCrawl[]): Pick<
  WebsiteOverview,
  'status' | 'pagesRead' | 'pagesSoFar' | 'readingStartedAt' | 'lastReadAt' | 'error'
> & { readCrawlId: string | null } {
  const state = competitorCrawlState(crawls);
  const latest = state.latest as OverviewCrawl | null;
  const good = state.good as OverviewCrawl | null;

  const status: SiteReadStatus = latest && RUNNING.has(latest.status)
    ? 'READING'
    : latest && QUEUED.has(latest.status)
      ? 'QUEUED'
      : good
        ? 'READ'
        : latest
          ? 'FAILED'
          : 'WAITING';

  return {
    status,
    readCrawlId: good?.id ?? null,
    pagesRead: good?.pagesCrawled ?? 0,
    pagesSoFar: status === 'READING' ? (latest?.pagesCrawled ?? 0) : null,
    readingStartedAt: status === 'READING' || status === 'QUEUED' ? (latest?.startedAt ?? latest?.createdAt ?? null)?.toISOString() ?? null : null,
    lastReadAt: good?.finishedAt?.toISOString() ?? null,
    error: state.failureReason,
  };
}

/** Grouped page rows to labelled counts, most first. Unknown types count as Other. */
export function toPageTypeCounts(rows: Array<{ pageType: string | null; count: number }>): PageTypeCount[] {
  const byType = new Map<string, number>();
  for (const row of rows) {
    const type = row.pageType && PAGE_TYPE_LABELS[row.pageType] ? row.pageType : 'OTHER';
    byType.set(type, (byType.get(type) ?? 0) + row.count);
  }
  return [...byType.entries()]
    .filter(([, count]) => count > 0)
    .map(([type, count]) => ({ type, label: PAGE_TYPE_LABELS[type], count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}
