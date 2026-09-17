import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { normalizeUrl, TrailingSlashPolicy } from '../url/url-normalizer';

/**
 * Why a discovered URL was not fetched.
 *
 * Every URL that leaves the inventory without a crawl result carries one of
 * these. A URL with no reason is a URL that vanished, which is the failure this
 * whole module exists to prevent.
 */
export type ExclusionReason =
  | 'queued'
  | 'crawl_budget_exceeded'
  | 'robots_blocked'
  | 'duplicate'
  | 'canonicalized'
  | 'invalid_url'
  | 'unsupported_content_type'
  | 'out_of_scope'
  | 'crawl_error'
  | 'timeout'
  | 'fetch_failed'
  | 'queue_failed'
  | 'skipped_by_configuration';

export interface InventoryAddition {
  url: string;
  source: string;
  sourceUrl?: string;
  depth?: number;
}

export interface CrawlOutcome {
  httpStatus?: number | null;
  contentType?: string | null;
  indexability?: string | null;
  canonicalUrl?: string | null;
  robotsAllowed?: boolean | null;
  rendered?: boolean;
  redirectTarget?: string | null;
}

export interface InventoryMetrics {
  /** Unique normalized URLs known to this crawl. */
  urlsDiscovered: number;
  urlsQueued: number;
  urlsCrawled: number;
  notCrawled: number;
  failed: number;
  excluded: number;
  duplicates: number;
  canonicalized: number;
  redirects: number;
  indexable: number;
  nonIndexable: number;
  renderedPages: number;
  statusBuckets: { ok: number; redirect: number; clientError: number; serverError: number; noResponse: number };
  /** Unique URLs per source. These overlap, so they do not sum to the total. */
  bySource: Record<string, number>;
  /** URLs credited to more than one source: the overlap in `bySource`. */
  multiSourceUrls: number;
  notCrawledReasons: Record<string, number>;
  /**
   * The uncrawled URLs themselves, with the sources that found them and the
   * reason each was not fetched — enough for a reader to check any total on
   * the dashboard against the rows behind it.
   */
  discoveredNotCrawled: Array<{ url: string; reason: string; sources: string[]; depth?: number }>;
}

/**
 * The crawl's canonical URL inventory.
 *
 * One row per unique normalized URL per crawl, holding every source that found
 * it and whatever became of it. It is deliberately not the queue: a URL enters
 * the inventory the moment it is discovered and stays there whatever happens
 * next, so "discovered" is a count of rows rather than an integer written once
 * at seed time and never revisited.
 *
 * That distinction is the bug this replaces. `CrawlJob.pagesDiscovered` was set
 * to the seed count before the first fetch and never touched again, so URLs
 * found in links while the crawl ran never reached the denominator. Coverage
 * was `crawled / seeds`, which on milquufresh.in meant 32 pages over a 29-URL
 * sitemap, clamped to 32/32, published as 100%.
 */
@Injectable()
export class UrlInventoryService {
  private readonly logger = new Logger(UrlInventoryService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Records discovered URLs, merging sources for ones already known.
   *
   * Returns the number of rows created, so a caller can tell a genuinely new
   * URL from one it has seen before without a second query. A URL that is
   * already present is never rewritten to a new source; the source is appended,
   * because a URL in both the sitemap and a nav menu was found by both.
   */
  async record(
    crawlJobId: string,
    additions: InventoryAddition[],
    options: { trailingSlash?: TrailingSlashPolicy } = {},
  ): Promise<{ added: number; merged: number; invalid: number }> {
    const result = { added: 0, merged: 0, invalid: 0 };

    for (const addition of additions) {
      const normalized = normalizeUrl(addition.url, { trailingSlash: options.trailingSlash });
      if (!normalized) {
        // Not silently dropped: an unparseable href is recorded against the
        // page that carried it so the audit can show why it was never fetched.
        result.invalid++;
        continue;
      }

      try {
        await this.prisma.crawlFrontier.create({
          data: {
            crawlJobId,
            normalizedUrl: normalized,
            url: addition.url,
            depth: addition.depth ?? 0,
            discoverySource: addition.source,
            sources: [addition.source],
            sourceUrl: addition.sourceUrl,
            state: 'PENDING',
            reason: 'queued',
          },
        });
        result.added++;
      } catch (err) {
        if ((err as { code?: string }).code !== 'P2002') {
          this.logger.warn(`Could not record ${normalized}: ${(err as Error).message}`);
          continue;
        }
        // Already known. Append the source unless it is already credited —
        // `array_append` guarded by `NOT ... = ANY` keeps this idempotent under
        // concurrent workers without a read-then-write race.
        await this.prisma
          .$executeRaw`UPDATE "CrawlFrontier"
             SET "sources" = array_append("sources", ${addition.source}),
                 "updatedAt" = NOW()
             WHERE "crawlJobId" = ${crawlJobId}
               AND "normalizedUrl" = ${normalized}
               AND NOT (${addition.source} = ANY("sources"))`
          .catch(() => 0);
        result.merged++;
      }
    }

    return result;
  }

  /** Marks URLs as handed to the queue, so a URL stuck before the queue is visible. */
  async markQueued(crawlJobId: string, normalizedUrls: string[]): Promise<void> {
    if (normalizedUrls.length === 0) return;
    await this.prisma.crawlFrontier
      .updateMany({
        where: { crawlJobId, normalizedUrl: { in: normalizedUrls } },
        data: { queuedAt: new Date(), reason: 'queued' },
      })
      .catch(() => undefined);
  }

  /**
   * Records what a fetch produced.
   *
   * A redirect and a 404 are both crawl results, not absences: the URL stays in
   * the inventory under its own spelling with its status attached, and a
   * canonical pointing elsewhere never removes the URL that declared it.
   */
  async markCrawled(crawlJobId: string, normalizedUrl: string, outcome: CrawlOutcome): Promise<void> {
    await this.prisma.crawlFrontier
      .updateMany({
        where: { crawlJobId, normalizedUrl },
        data: {
          state: 'DONE',
          crawledAt: new Date(),
          httpStatus: outcome.httpStatus ?? null,
          contentType: outcome.contentType ?? null,
          indexability: outcome.indexability ?? null,
          canonicalUrl: outcome.canonicalUrl ?? null,
          robotsAllowed: outcome.robotsAllowed ?? null,
          rendered: outcome.rendered ?? false,
          redirectTarget: outcome.redirectTarget ?? null,
          reason: null,
        },
      })
      .catch(() => undefined);
  }

  /**
   * Marks a URL excluded, always with a reason.
   *
   * Never downgrades a URL that has already been fetched. The queue delivers a
   * task more than once — a retry, a lapsed lock, or the same URL discovered
   * again through a second source — and the crawler answers the repeat with
   * `duplicate`. Applied blindly that rewrote the row of a page that had been
   * crawled, status code and all, into "discovered, not crawled: duplicate".
   * A crawl of milquufresh.in ended with 31 pages on disk and only 25 URLs the
   * inventory would admit to having crawled, which is the same species of
   * silent miscount this module exists to prevent.
   *
   * `crawledAt: null` is the guard rather than the state, because it is the
   * fact that settles it: a URL with a crawl result is crawled, whatever a
   * later duplicate task says about it.
   */
  async markExcluded(crawlJobId: string, normalizedUrl: string, reason: ExclusionReason, detail?: Partial<CrawlOutcome>): Promise<void> {
    await this.prisma.crawlFrontier
      .updateMany({
        where: { crawlJobId, normalizedUrl, crawledAt: null },
        data: {
          state: reason === 'crawl_error' || reason === 'timeout' || reason === 'fetch_failed' ? 'FAILED' : 'SKIPPED',
          reason,
          robotsAllowed: detail?.robotsAllowed ?? undefined,
          httpStatus: detail?.httpStatus ?? undefined,
          canonicalUrl: detail?.canonicalUrl ?? undefined,
        },
      })
      .catch(() => undefined);
  }

  /**
   * The crawl's reconciliation figures, read off the inventory rows themselves.
   *
   * Nothing here is derived from a counter kept elsewhere, which is the point:
   * the numbers on the dashboard and the rows in the URL table are the same
   * data, so they cannot disagree.
   */
  async metrics(crawlJobId: string): Promise<InventoryMetrics> {
    const rows = await this.prisma.crawlFrontier.findMany({
      where: { crawlJobId },
      select: {
        normalizedUrl: true,
        url: true,
        state: true,
        reason: true,
        sources: true,
        discoverySource: true,
        httpStatus: true,
        indexability: true,
        canonicalUrl: true,
        redirectTarget: true,
        rendered: true,
        queuedAt: true,
        crawledAt: true,
      },
    });

    return summariseInventory(rows);
  }
}

export interface InventoryRow {
  normalizedUrl: string;
  url: string;
  state: string;
  reason: string | null;
  sources: string[];
  discoverySource: string;
  httpStatus: number | null;
  indexability: string | null;
  canonicalUrl: string | null;
  redirectTarget: string | null;
  rendered: boolean;
  queuedAt: Date | null;
  crawledAt: Date | null;
}

/**
 * Turns inventory rows into the figures the dashboard shows.
 *
 * Pure, so the reconciliation it produces can be tested without a database and
 * asserted to balance: crawled + notCrawled == discovered, always.
 */
export function summariseInventory(rows: InventoryRow[]): InventoryMetrics {
  const bySource: Record<string, number> = {};
  const notCrawledReasons: Record<string, number> = {};
  const discoveredNotCrawled: Array<{ url: string; reason: string; sources: string[] }> = [];

  let urlsQueued = 0;
  let urlsCrawled = 0;
  let failed = 0;
  let excluded = 0;
  let duplicates = 0;
  let canonicalized = 0;
  let redirects = 0;
  let indexable = 0;
  let nonIndexable = 0;
  let renderedPages = 0;
  let multiSourceUrls = 0;

  const statusBuckets = { ok: 0, redirect: 0, clientError: 0, serverError: 0, noResponse: 0 };

  for (const row of rows) {
    // A row written before `sources` existed still has its original source.
    const sources = row.sources.length > 0 ? row.sources : [row.discoverySource];
    const unique = [...new Set(sources)];
    for (const source of unique) bySource[source] = (bySource[source] || 0) + 1;
    if (unique.length > 1) multiSourceUrls++;

    if (row.queuedAt) urlsQueued++;
    if (row.rendered) renderedPages++;

    const wasCrawled = row.state === 'DONE' || row.crawledAt !== null;
    if (wasCrawled) {
      urlsCrawled++;
      const status = row.httpStatus;
      if (status === null || status === undefined || status === 0) statusBuckets.noResponse++;
      else if (status >= 500) statusBuckets.serverError++;
      else if (status >= 400) statusBuckets.clientError++;
      else if (status >= 300) {
        statusBuckets.redirect++;
        redirects++;
      } else statusBuckets.ok++;

      if (row.indexability === 'INDEXABLE') indexable++;
      else if (row.indexability === 'NOT_INDEXABLE') nonIndexable++;

      // A canonical that points somewhere else is recorded against the URL
      // that declared it. The URL itself is never removed.
      if (row.canonicalUrl && row.canonicalUrl !== row.normalizedUrl) canonicalized++;
      continue;
    }

    // Everything below is discovered-and-not-crawled, and every one of them
    // carries a reason. `queued` is the honest answer for a URL the crawl
    // simply never got to.
    const reason = row.reason || 'queued';
    notCrawledReasons[reason] = (notCrawledReasons[reason] || 0) + 1;
    if (discoveredNotCrawled.length < 500) discoveredNotCrawled.push({ url: row.url, reason, sources: unique });

    if (row.state === 'FAILED') failed++;
    else if (row.state === 'SKIPPED') excluded++;
    if (reason === 'duplicate') duplicates++;
    if (reason === 'canonicalized') canonicalized++;
  }

  const urlsDiscovered = rows.length;

  return {
    urlsDiscovered,
    urlsQueued,
    urlsCrawled,
    notCrawled: urlsDiscovered - urlsCrawled,
    failed,
    excluded,
    duplicates,
    canonicalized,
    redirects,
    indexable,
    nonIndexable,
    renderedPages,
    statusBuckets,
    bySource,
    multiSourceUrls,
    notCrawledReasons,
    discoveredNotCrawled,
  };
}
