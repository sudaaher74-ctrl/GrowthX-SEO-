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
    let known = await this.prisma.crawlFrontier.count({ where: { crawlJobId } });

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
      if (known >= limits.maxPages) {
        result.atCapacity++;
        continue;
      }
      seenInBatch.add(normalized);

      try {
        await this.prisma.crawlFrontier.create({
          data: {
            crawlJobId,
            normalizedUrl: normalized,
            url: addition.url,
            depth: addition.depth,
            discoverySource: addition.source,
            sourceUrl: addition.sourceUrl,
            state: 'PENDING',
          },
        });
        result.added++;
        known++;
      } catch (err) {
        // A unique-constraint conflict is the expected outcome for a URL
        // another worker already claimed, and is not an error.
        if ((err as { code?: string }).code === 'P2002') {
          result.duplicates++;
          continue;
        }
        this.logger.warn(`Could not add ${normalized} to the frontier: ${(err as Error).message}`);
      }
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
