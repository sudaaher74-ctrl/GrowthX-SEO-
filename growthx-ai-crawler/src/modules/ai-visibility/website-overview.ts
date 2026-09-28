import { PAGE_TYPE_LABELS } from '../crawler/page-type';
import { pageOutcome } from '../crawler/page-outcome';
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

/** Pages a crawl asked for and did not get, by why. */
export interface NotOpened {
  /** The site turned us away: a firewall or a limit on how fast we may ask. */
  refused: number;
  /** The site answered with an error, such as "page not found". */
  errored: number;
  /** Nothing answered in time. */
  noAnswer: number;
}

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
  /**
   * Pages that opened in the crawl the figures come from, which is exactly
   * what `pageTypes` adds up to. Null when that crawl's page details are no
   * longer kept, so there is nothing left to count them from.
   */
  pagesRead: number | null;
  /** Pages that crawl asked for and did not get, and why. Null when not known. */
  notOpened: NotOpened | null;
  /** Pages the running crawl has opened so far; null when nothing is running. */
  pagesSoFar: number | null;
  /** Pages the running crawl has asked for and not got so far. */
  notOpenedSoFar: number | null;
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
export function readState(crawls: OverviewCrawl[]): Pick<WebsiteOverview, 'status' | 'readingStartedAt' | 'lastReadAt' | 'error'> & {
  readCrawlId: string | null;
  /** The running crawl, when there is one. */
  readingCrawlId: string | null;
} {
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
    readingCrawlId: status === 'READING' ? (latest?.id ?? null) : null,
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

/** Stored page rows for one crawl, grouped the way the overview asks for them. */
export interface PageRowGroup {
  pageType: string | null;
  statusCode: number | null;
  blockedSuspected: boolean | null;
  count: number;
}

/**
 * One crawl's pages, counted by what happened to each: the pages that opened
 * with their kinds, and the ones that did not with the reason. `opened` and
 * the kinds are the same pages, so they always add up.
 */
export function summarisePages(rows: PageRowGroup[]): {
  opened: number;
  notOpened: NotOpened;
  pageTypes: PageTypeCount[];
} {
  const notOpened: NotOpened = { refused: 0, errored: 0, noAnswer: 0 };
  const openedByType: Array<{ pageType: string | null; count: number }> = [];
  let opened = 0;
  for (const row of rows) {
    const outcome = pageOutcome(row.statusCode, row.blockedSuspected);
    if (outcome === 'opened') {
      opened += row.count;
      openedByType.push({ pageType: row.pageType, count: row.count });
    } else {
      notOpened[outcome] += row.count;
    }
  }
  return { opened, notOpened, pageTypes: toPageTypeCounts(openedByType) };
}

export function notOpenedTotal(n: NotOpened): number {
  return n.refused + n.errored + n.noAnswer;
}
