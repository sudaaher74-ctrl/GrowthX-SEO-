import { Logger } from '@nestjs/common';
import { normalizeUrl } from './url/url-normalizer';
import { QueueService } from '../queue/queue.service';
import { canonicalUrl } from './canonical-url';
import { DiscoveryService, SitemapFinding } from './discovery/discovery.service';
import { ParsedRobots } from './discovery/robots-txt';
import { crawlStateRetentionSeconds } from './crawl-state-retention';

/**
 * Everything a crawl remembers between pages: which URLs it has claimed, the
 * sitemap and robots.txt it seeded from, its running totals and its render
 * budget.
 *
 * Page fetches are spread across workers, so each of these lives in Redis where
 * every worker can see it. Each method falls back to this process's own memory
 * when Redis is absent or fails, which is the whole story when one process does
 * everything.
 */
export class CrawlJobState {
  private readonly logger = new Logger(CrawlJobState.name);

  constructor(private readonly queue: QueueService) {}

  readonly localVisited = new Map<string, Set<string>>();
  private readonly localClaims = new Map<string, Map<string, string>>();

  readonly jobSitemapUrls = new Map<string, Set<string>>();

  /** Sitemap defects found while seeding, raised as site-level issues at the end. */
  readonly jobSitemapFindings = new Map<string, SitemapFinding[]>();

  /** Parsed robots.txt per job, so indexability can cite the rule that applied. */
  readonly jobRobots = new Map<string, Awaited<ReturnType<DiscoveryService['fetchRobots']>>>();

  /**
   * Pages rendered so far, per job.
   *
   * A browser page is by far the most expensive thing a crawl does, and the
   * smallest deployment target has room for one at a time. Without a ceiling a
   * 500-page crawl of a client-rendered site would launch 500 renders on a
   * 512MB container. Pages past the budget are still fetched and still
   * assessed; they are marked RENDER_UNAVAILABLE so the report says its
   * coverage is partial rather than quietly reporting a shell as the page.
   */
  readonly jobRendersUsed = new Map<string, number>();

  /** Per-job crawl statistics for richer qualityDiagnostics. */
  readonly jobStats = new Map<string, {
    urlsDiscovered: number;
    urlsSkipped: number;
    robotsBlocked: number;
    internalLinksFound: number;
    crawlStatus: 'COMPLETED' | 'LIMIT_REACHED' | 'PARTIAL';
  }>();

  /**
   * Crawl-wide facts that every page fetch needs and no single process owns.
   *
   * The sitemap's URL set, the parsed robots.txt and the sitemap's defects are
   * established once, by whichever process runs `processCrawlJob`, and then
   * read by every page fetch. Holding them in a field made them invisible to
   * anyone else: the worker deployment runs page fetches in a second container
   * (see docker-compose.yml), and a container that restarts mid-crawl — the
   * ordinary outcome of Chromium meeting a 512MB instance — comes back with
   * the maps empty and keeps fetching the same crawl's queued URLs.
   *
   * What that costs is not theoretical. Every page then fetched is recorded as
   * `seed` rather than `sitemap`, so the audit misreports how its own URLs were
   * found; `inSitemap` is false for all of them, so the issue engine raises
   * "not in the sitemap" against pages the sitemap does list; and indexability
   * is decided without the robots.txt rules. A crawl of milquufresh.in showed
   * exactly that — its homepage labelled `sitemap` and every later page
   * labelled `seed`, which is the signature of the state having been lost
   * between the two fetches.
   *
   * Stored in Redis where there is one, since that is already the crawl's
   * shared memory, and kept in the fields as a per-process cache and as the
   * whole story when Redis is absent and one process does everything.
   */
  async saveCrawlState(
    jobId: string,
    state: { sitemapUrls: Set<string>; robots: ParsedRobots | undefined; sitemapFindings: SitemapFinding[] },
  ): Promise<void> {
    this.jobSitemapUrls.set(jobId, state.sitemapUrls);
    this.jobRobots.set(jobId, state.robots);
    this.jobSitemapFindings.set(jobId, state.sitemapFindings);

    const redisClient = this.queue.getRedisClient?.();
    if (!redisClient) return;
    try {
      await redisClient.set(
        `job:${jobId}:crawl_state`,
        JSON.stringify({
          sitemapUrls: [...state.sitemapUrls],
          robots: state.robots,
          sitemapFindings: state.sitemapFindings,
        }),
        'EX',
        crawlStateRetentionSeconds(),
      );
    } catch (error) {
      this.logger.warn(`[JOB ${jobId}] Crawl state could not be shared with the other workers: ${(error as Error).message}`);
    }
  }

  async loadCrawlState(
    jobId: string,
  ): Promise<{ sitemapUrls: Set<string>; robots: ParsedRobots | undefined; sitemapFindings: SitemapFinding[] }> {
    const cached = this.jobSitemapUrls.get(jobId);
    if (cached) {
      return { sitemapUrls: cached, robots: this.jobRobots.get(jobId), sitemapFindings: this.jobSitemapFindings.get(jobId) || [] };
    }

    const empty = { sitemapUrls: new Set<string>(), robots: undefined, sitemapFindings: [] as SitemapFinding[] };
    const redisClient = this.queue.getRedisClient?.();
    if (!redisClient) return empty;

    try {
      const raw = await redisClient.get(`job:${jobId}:crawl_state`);
      if (!raw) return empty;
      const parsed = JSON.parse(raw) as {
        sitemapUrls?: string[];
        robots?: ParsedRobots;
        sitemapFindings?: SitemapFinding[];
      };
      const state = {
        sitemapUrls: new Set<string>(parsed.sitemapUrls || []),
        robots: parsed.robots,
        sitemapFindings: parsed.sitemapFindings || [],
      };
      // Cached in this process, so the rest of this worker's pages cost nothing.
      this.jobSitemapUrls.set(jobId, state.sitemapUrls);
      this.jobRobots.set(jobId, state.robots);
      this.jobSitemapFindings.set(jobId, state.sitemapFindings);
      return state;
    } catch (error) {
      this.logger.warn(`[JOB ${jobId}] Crawl state could not be read back: ${(error as Error).message}`);
      return empty;
    }
  }

  /** Drops a finished crawl's shared state, which nothing will read again. */
  async forgetCrawlState(jobId: string): Promise<void> {
    await this.queue.forgetJobTasks?.(jobId);
    const redisClient = this.queue.getRedisClient?.();
    if (!redisClient) return;
    try {
      await redisClient.del(`job:${jobId}:crawl_state`, `job:${jobId}:stats`, `job:${jobId}:renders_used`);
    } catch {
      /* every one of these keys expires on its own within the day */
    }
  }

  /**
   * The crawl's render budget, counted where the whole crawl can see it.
   *
   * A budget held per process is no budget at all once there are two of them:
   * each worker starts its own count from zero and the instance gets the sum.
   */
  async rendersUsed(jobId: string): Promise<number> {
    const redisClient = this.queue.getRedisClient?.();
    if (redisClient) {
      try {
        const value = await redisClient.get(`job:${jobId}:renders_used`);
        return value ? parseInt(value, 10) || 0 : 0;
      } catch {
        // Fall through to this process's own count rather than refusing to render.
      }
    }
    return this.jobRendersUsed.get(jobId) ?? 0;
  }

  async noteRenderUsed(jobId: string): Promise<void> {
    this.jobRendersUsed.set(jobId, (this.jobRendersUsed.get(jobId) ?? 0) + 1);
    const redisClient = this.queue.getRedisClient?.();
    if (!redisClient) return;
    try {
      const key = `job:${jobId}:renders_used`;
      await redisClient.incr(key);
      await redisClient.expire(key, crawlStateRetentionSeconds());
    } catch {
      /* the in-process count above still bounds this worker */
    }
  }

  /**
   * A crawl's running totals, likewise kept where every worker can add to them.
   *
   * These are what the audit shows as coverage: how many URLs were skipped and
   * how many robots.txt refused. Counted in one process's memory they came back
   * as zero whenever the crawl was finished by another, which reads as "nothing
   * was skipped" — the reassuring answer rather than the true one.
   */
  async bumpJobStat(jobId: string, field: 'urlsSkipped' | 'robotsBlocked' | 'internalLinksFound', by = 1): Promise<void> {
    const stats = this.jobStats.get(jobId);
    if (stats) stats[field] += by;

    const redisClient = this.queue.getRedisClient?.();
    if (!redisClient) return;
    try {
      const key = `job:${jobId}:stats`;
      await redisClient.hincrby(key, field, by);
      await redisClient.expire(key, crawlStateRetentionSeconds());
    } catch {
      /* a lost counter must never cost a page */
    }
  }

  async setJobCrawlStatus(jobId: string, status: 'COMPLETED' | 'LIMIT_REACHED' | 'PARTIAL'): Promise<void> {
    const stats = this.jobStats.get(jobId);
    if (stats) stats.crawlStatus = status;

    const redisClient = this.queue.getRedisClient?.();
    if (!redisClient) return;
    try {
      const key = `job:${jobId}:stats`;
      await redisClient.hset(key, 'crawlStatus', status);
      await redisClient.expire(key, crawlStateRetentionSeconds());
    } catch {
      /* as above */
    }
  }

  async readJobStats(jobId: string): Promise<{
    urlsSkipped: number;
    robotsBlocked: number;
    internalLinksFound: number;
    crawlStatus: 'COMPLETED' | 'LIMIT_REACHED' | 'PARTIAL';
  }> {
    const local = this.jobStats.get(jobId);
    const redisClient = this.queue.getRedisClient?.();
    if (redisClient) {
      try {
        const stored = (await redisClient.hgetall(`job:${jobId}:stats`)) as Record<string, string>;
        if (stored && Object.keys(stored).length > 0) {
          return {
            urlsSkipped: Number(stored.urlsSkipped || 0),
            robotsBlocked: Number(stored.robotsBlocked || 0),
            internalLinksFound: Number(stored.internalLinksFound || 0),
            crawlStatus: (stored.crawlStatus as 'COMPLETED' | 'LIMIT_REACHED' | 'PARTIAL') || 'COMPLETED',
          };
        }
      } catch {
        /* fall back to whatever this process saw */
      }
    }
    return {
      urlsSkipped: local?.urlsSkipped ?? 0,
      robotsBlocked: local?.robotsBlocked ?? 0,
      internalLinksFound: local?.internalLinksFound ?? 0,
      crawlStatus: local?.crawlStatus ?? 'COMPLETED',
    };
  }

  /**
   * Claims a URL for this job, returning a result object describing why (if) it
   * must not be fetched.
   *
   * `alreadyVisited` — the URL was seen before; skip silently (normal dedup).
   * `limitReached`   — the page ceiling was hit; the crawl is capped, not done.
   *
   * Every fetch passes through here in both the Redis and in-memory paths,
   * which is why the page ceiling is enforced here rather than at each of the
   * places that enqueue work. A cap checked at enqueue time would not hold:
   * links are discovered while the crawl runs, so the only number that can be
   * trusted is the count of URLs already claimed.
   *
   * Under concurrency the count can be read by several workers before any of
   * them adds, so a job may overshoot its ceiling by up to the worker count.
   * That is deliberate — the alternative is a Lua script or a lock on the hot
   * path of every fetch, and a handful of extra pages on a cap of a few
   * hundred is not worth either.
   */
  async markUrlVisited(jobId: string, targetUrl: string, pageLimit?: number, taskId?: string): Promise<{ alreadyVisited: boolean; limitReached: boolean }> {
    const redisClient = this.queue.getRedisClient();
    const key = `job:${jobId}:visited`;
    const member = this.visitKey(targetUrl);

    if (redisClient) {
      // This bounded claim script passed recovery-prototype-test.cjs against
      // an isolated Redis restart, including duplicate rejection and cleanup.
      if (taskId && typeof redisClient.eval === 'function') {
        const result = Number(await redisClient.eval(`
          if redis.call('SISMEMBER', KEYS[1], ARGV[1]) == 1 then return 0 end
          if tonumber(ARGV[3]) > 0 and redis.call('SCARD', KEYS[1]) >= tonumber(ARGV[3]) then return -1 end
          redis.call('SADD', KEYS[1], ARGV[1])
          redis.call('HSET', KEYS[2], ARGV[1], ARGV[2])
          redis.call('EXPIRE', KEYS[1], ARGV[4])
          redis.call('EXPIRE', KEYS[2], ARGV[4])
          return 1
        `, 2, key, `job:${jobId}:claims`, member, taskId, pageLimit ?? 0, crawlStateRetentionSeconds()));
        return { alreadyVisited: result === 0, limitReached: result === -1 };
      }
      if (pageLimit && (await redisClient.scard(key)) >= pageLimit) {
        return { alreadyVisited: false, limitReached: true };
      }
      const added = await redisClient.sadd(key, member);
      if (added === 1) {
        await redisClient.expire(key, crawlStateRetentionSeconds());
        return { alreadyVisited: false, limitReached: false };
      }
      return { alreadyVisited: true, limitReached: false };
    }

    let visitedSet = this.localVisited.get(jobId);
    if (!visitedSet) {
      visitedSet = new Set<string>();
      this.localVisited.set(jobId, visitedSet);
    }
    if (pageLimit && visitedSet.size >= pageLimit) {
      return { alreadyVisited: false, limitReached: true };
    }
    if (visitedSet.has(member)) {
      return { alreadyVisited: true, limitReached: false };
    }
    visitedSet.add(member);
    if (taskId) {
      const owners = this.localClaims.get(jobId) ?? new Map<string, string>();
      owners.set(member, taskId);
      this.localClaims.set(jobId, owners);
    }
    return { alreadyVisited: false, limitReached: false };
  }

  async claimedByTask(jobId: string, targetUrl: string, taskId?: string): Promise<boolean> {
    if (!taskId) return false;
    const member = this.visitKey(targetUrl);
    const redis = this.queue.getRedisClient?.();
    if (redis) return (await redis.hget(`job:${jobId}:claims`, member)) === taskId;
    return this.localClaims.get(jobId)?.get(member) === taskId;
  }

  /**
   * Whether this crawl has already claimed the page a URL names, in any
   * spelling. Read-only: the claim itself is still taken by markUrlVisited at
   * fetch time. A failed lookup answers "no", so the link is enqueued and the
   * fetch-time check decides, exactly as before this existed.
   */
  async isUrlClaimed(jobId: string, targetUrl: string): Promise<boolean> {
    const member = this.visitKey(targetUrl);
    const redisClient = this.queue.getRedisClient?.();
    if (redisClient) {
      if (typeof redisClient.sismember !== 'function') return false;
      try {
        return (await redisClient.sismember(`job:${jobId}:visited`, member)) === 1;
      } catch {
        return false;
      }
    }
    return this.localVisited.get(jobId)?.has(member) ?? false;
  }

  /**
   * Hands a claimed URL back, so another attempt may fetch it.
   *
   * Only for an attempt that recorded nothing. A URL whose page was stored
   * keeps its claim, because re-fetching it would be duplicate work.
   */
  async releaseUrlClaim(jobId: string, targetUrl: string): Promise<void> {
    const member = this.visitKey(targetUrl);
    // Optional, because this one runs while an error is already on its way out:
    // a second failure here would replace the error the caller needs to see.
    const redisClient = this.queue.getRedisClient?.();
    if (redisClient) {
      await redisClient.srem(`job:${jobId}:visited`, member).catch(() => undefined);
      if (redisClient.hdel) await redisClient.hdel(`job:${jobId}:claims`, member).catch(() => undefined);
      return;
    }
    this.localVisited.get(jobId)?.delete(member);
    this.localClaims.get(jobId)?.delete(member);
  }

  /**
   * The key a URL is deduplicated under within a crawl.
   *
   * Distinct from the URL we fetch. A site links itself both ways — the footer
   * uses https://example.com/about, the nav uses https://www.example.com/about
   * — and normalizeUrl treats those as two pages, so both were fetched and both
   * were stored. On the site crawled here that turned 35 pages into 44 rows,
   * and page-kind counts inflated with them: coverage read 12 product pages
   * where there were 9. Because how often a site links itself each way varies
   * per site, the inflation differs per site too, so a competitor comparison
   * was comparing two differently-wrong numbers.
   *
   * Only the key is canonicalised, never the URL we request. Plenty of sites
   * serve one host spelling and redirect the other, so rewriting the request
   * would turn a working fetch into a redirect chase or a 404; the fetcher
   * follows whatever redirect the site issues and records the result in
   * finalUrl.
   */
  visitKey(normalizedUrl: string): string {
    return canonicalUrl(normalizedUrl);
  }

  normalizeUrl(rawUrl: string): string {
    // Use the frontier's spelling so completing a fetch releases its exact
    // reservation, including query strings encoded with spaces or reordered keys.
    return normalizeUrl(rawUrl);
  }

  /** Forgets everything this process held for a finished crawl. */
  dropLocal(jobId: string): void {
    this.localVisited.delete(jobId);
    this.localClaims.delete(jobId);
    this.jobSitemapUrls.delete(jobId);
    this.jobSitemapFindings.delete(jobId);
    this.jobRobots.delete(jobId);
    this.jobRendersUsed.delete(jobId);
    this.jobStats.delete(jobId);
  }
}
