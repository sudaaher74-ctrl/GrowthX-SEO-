import { Prisma } from '@prisma/client';
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { DiscoverySource } from '../discovery/discovery.service';
import { normalizeUrl, TrailingSlashPolicy } from '../url/url-normalizer';

export type FrontierState = 'PENDING' | 'IN_PROGRESS' | 'DONE' | 'SKIPPED' | 'FAILED';

export interface FrontierAddition {
  url: string;
  source: DiscoverySource;
  depth: number;
  sourceUrl?: string;
}

export interface FrontierLimits {
  maxPages: number;
  maxDepth: number;
}

export interface AddResult {
  added: number;
  duplicates: number;
  beyondDepth: number;
  atCapacity: number;
}

/** Defaults, all overridable per crawl. */
export const DEFAULT_LIMITS = {
  maxPages: Number(process.env.CRAWL_MAX_PAGES || 500),
  maxDepth: Number(process.env.CRAWL_MAX_DEPTH || 10),
  maxDurationMs: Number(process.env.CRAWL_MAX_DURATION_MS || 30 * 60 * 1000),
  maxRenderedPages: Number(process.env.CRAWL_MAX_RENDERED_PAGES || 100),
  concurrency: Number(process.env.CRAWL_CONCURRENCY || 5),
};

/**
 * The crawl's URL frontier, held in PostgreSQL.
 *
 * Previously this lived in a Redis set plus a Map on the worker, which meant a
 * restart mid-crawl lost every URL that had been discovered but not yet
 * fetched — the crawler has a whole sweeper whose job is to close out the
 * crawls that stranded — and pausing a crawl was not expressible at all.
 *
 * Claiming a URL is an insert against a unique constraint on
 * (crawlJobId, normalizedUrl): it either wins or conflicts, so two workers
 * racing on the same URL is settled by the database rather than by a read
 * followed by a write. The page ceiling is enforced on claimed rows for the
 * same reason — a cap checked at enqueue time cannot hold when links are
 * discovered while the crawl runs.
 */
@Injectable()
export class FrontierService {
  private readonly logger = new Logger(FrontierService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Adds URLs, skipping anything already known, past the depth limit, or past
   * the page ceiling.
   *
   * The ceiling is counted against rows that exist rather than rows fetched, so
   * a crawl cannot queue a hundred thousand URLs it will never visit.
   */
  async add(crawlJobId: string, additions: FrontierAddition[], limits: FrontierLimits, trailingSlash?: TrailingSlashPolicy): Promise<AddResult> {
    const result: AddResult = { added: 0, duplicates: 0, beyondDepth: 0, atCapacity: 0 };
    if (additions.length === 0) return result;

    const seenInBatch = new Set<string>();
    const candidates: { normalized: string; addition: FrontierAddition }[] = [];
    for (const addition of additions) {
      if (addition.depth > limits.maxDepth) {
        result.beyondDepth++;
        continue;
      }
      const normalized = normalizeUrl(addition.url, { trailingSlash });
      if (!normalized || seenInBatch.has(normalized)) {
        result.duplicates++;
        continue;
      }
      seenInBatch.add(normalized);
      candidates.push({ normalized, addition });
    }
    if (candidates.length === 0) return result;

    // Known URLs are filtered with one read, not discovered one failed insert
    // at a time. Every page of a site links to the same navigation, so nearly
    // every addition is a duplicate; a per-URL insert against the unique
    // constraint cost a round trip and a logged `prisma:error` each, which on
    // a small instance was enough to starve the health check.
    const existing = await this.prisma.crawlFrontier.findMany({
      where: { crawlJobId, normalizedUrl: { in: candidates.map((c) => c.normalized) } },
      select: { normalizedUrl: true },
    });
    const known = new Set(existing.map((row) => row.normalizedUrl));

    let rows = await this.prisma.crawlFrontier.count({ where: { crawlJobId } });
    const toInsert: Prisma.CrawlFrontierCreateManyInput[] = [];
    for (const { normalized, addition } of candidates) {
      if (known.has(normalized)) {
        result.duplicates++;
        continue;
      }
      if (rows >= limits.maxPages) {
        result.atCapacity++;
        continue;
      }
      rows++;
      toInsert.push({
        crawlJobId,
        normalizedUrl: normalized,
        url: addition.url,
        depth: addition.depth,
        discoverySource: addition.source,
        sourceUrl: addition.sourceUrl,
        state: 'PENDING',
      });
    }
    if (toInsert.length === 0) return result;

    try {
      // Claiming is still settled by the unique constraint: a URL another
      // worker inserted since the read above is skipped by the database, not
      // raised as an error.
      const { count } = await this.prisma.crawlFrontier.createMany({ data: toInsert, skipDuplicates: true });
      result.added = count;
      result.duplicates += toInsert.length - count;
    } catch (err) {
      this.logger.warn(`Could not add ${toInsert.length} URLs to the frontier: ${(err as Error).message}`);
    }

    return result;
  }

  /**
   * Takes the next PENDING URLs, marking them IN_PROGRESS so no other worker
   * takes them too.
   *
   * Shallowest first, which keeps the crawl breadth-first: on a site with an
   * infinite calendar, depth-first would spend the entire page budget inside
   * one trap and never reach the rest of the site.
   */
  async claimNext(crawlJobId: string, count: number): Promise<Array<{ id: string; url: string; normalizedUrl: string; depth: number; discoverySource: string; sourceUrl: string | null }>> {
    const candidates = await this.prisma.crawlFrontier.findMany({
      where: { crawlJobId, state: 'PENDING' },
      orderBy: [{ depth: 'asc' }, { createdAt: 'asc' }],
      take: count,
      select: { id: true, url: true, normalizedUrl: true, depth: true, discoverySource: true, sourceUrl: true },
    });

    const claimed: typeof candidates = [];
    for (const candidate of candidates) {
      // The state guard in the WHERE clause is the claim: an update that
      // matches nothing means another worker got there first.
      const { count: updated } = await this.prisma.crawlFrontier.updateMany({
        where: { id: candidate.id, state: 'PENDING' },
        data: { state: 'IN_PROGRESS', claimedAt: new Date(), attempts: { increment: 1 } },
      });
      if (updated === 1) claimed.push(candidate);
    }
    return claimed;
  }

  async complete(id: string, state: Extract<FrontierState, 'DONE' | 'SKIPPED' | 'FAILED'>, reason?: string): Promise<void> {
    await this.prisma.crawlFrontier.update({ where: { id }, data: { state, reason } }).catch(() => {});
  }

  /**
   * Returns URLs stranded IN_PROGRESS to PENDING so a resumed crawl picks them
   * up. This is what makes a worker restart survivable rather than terminal.
   */
  async requeueStranded(crawlJobId: string, olderThanMs = 5 * 60 * 1000): Promise<number> {
    const { count } = await this.prisma.crawlFrontier.updateMany({
      where: { crawlJobId, state: 'IN_PROGRESS', claimedAt: { lt: new Date(Date.now() - olderThanMs) } },
      data: { state: 'PENDING', claimedAt: null },
    });
    if (count > 0) this.logger.log(`[JOB ${crawlJobId}] Returned ${count} stranded URL(s) to the frontier.`);
    return count;
  }

  async counts(crawlJobId: string): Promise<Record<FrontierState, number> & { total: number }> {
    const rows = await this.prisma.crawlFrontier.groupBy({
      by: ['state'],
      where: { crawlJobId },
      _count: { _all: true },
    });
    const counts = { PENDING: 0, IN_PROGRESS: 0, DONE: 0, SKIPPED: 0, FAILED: 0, total: 0 };
    for (const row of rows) {
      counts[row.state as FrontierState] = row._count._all;
      counts.total += row._count._all;
    }
    return counts;
  }

  async hasPending(crawlJobId: string): Promise<boolean> {
    return (await this.prisma.crawlFrontier.count({ where: { crawlJobId, state: 'PENDING' } })) > 0;
  }
}
