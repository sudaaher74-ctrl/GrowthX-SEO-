import { CrawlerService } from './crawler.service';
import { QueueService } from '../queue/queue.service';

/**
 * Why a 29-URL site was audited as six pages.
 *
 * The crawl of milquufresh.in discovered all 29 URLs from the sitemap, fetched
 * six of them and reported COMPLETED. Nothing had gone wrong with the sitemap,
 * the fetches or the page ceiling: the crawl's pending-task counter reached
 * zero early, because the page-fetch queue runs a task again after a retry or
 * a lapsed lock and each of those re-runs decremented the counter a second
 * time. Once the crawl is marked COMPLETED, every task still queued for it is
 * dropped by the guard that refuses to fetch for a finished crawl — so the
 * shortfall is silent and the audit describes a fifth of the site as the whole
 * of it.
 */
describe('CrawlerService — a crawl must not finish while URLs are still queued', () => {
  function crawler(overrides: { onComplete?: jest.Mock } = {}) {
    const queue: any = new QueueService();
    queue.pageFetchQueue = { add: jest.fn(), addBulk: jest.fn() };

    const prisma: any = {
      crawlJob: { findUnique: jest.fn(async () => ({ id: 'job1', status: 'RUNNING' })) },
    };

    const service: any = new (CrawlerService as any)(prisma, {}, queue, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, { record: async () => ({ added: 0, merged: 0, invalid: 0 }), markQueued: async () => undefined, markCrawled: async () => undefined, markExcluded: async () => undefined, metrics: async () => null });
    service.completeJob = overrides.onComplete || jest.fn();
    // The URL itself is beside the point here; every path below settles a task.
    service.markUrlVisited = jest.fn(async () => ({ alreadyVisited: true, limitReached: false }));
    return { service, queue, prisma };
  }

  const task = (taskId: string, url = 'https://example.test/a') => ({
    jobId: 'job1',
    websiteId: 'w1',
    domain: 'example.test',
    targetUrl: url,
    depth: 0,
    maxDepth: 10,
    rateLimitDelayMs: 0,
    taskId,
  });

  it('does not complete while a re-run of one task is all that reached zero', async () => {
    const onComplete = jest.fn();
    const { service, queue } = crawler({ onComplete });
    await queue.incrementPendingTasks('job1', 3);

    // Task A stalls and is run twice; B is a normal single run.
    await service.processPageFetch(task('task-a'));
    await service.processPageFetch(task('task-a'));
    await service.processPageFetch(task('task-b', 'https://example.test/b'));

    expect(await queue.getPendingTasks('job1')).toBe(1);
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('completes once every task has genuinely settled', async () => {
    const onComplete = jest.fn();
    const { service, queue } = crawler({ onComplete });
    await queue.incrementPendingTasks('job1', 2);

    await service.processPageFetch(task('task-a'));
    await service.processPageFetch(task('task-a'));
    expect(onComplete).not.toHaveBeenCalled();

    await service.processPageFetch(task('task-b', 'https://example.test/b'));

    expect(onComplete).toHaveBeenCalledWith('job1');
  });
});

/**
 * A URL is claimed before it is fetched so two workers cannot crawl it at
 * once. The claim outlives the attempt that made it, so an attempt that dies
 * before recording anything takes its page down with it: the retry finds the
 * URL claimed and returns without fetching. The page is then missing from a
 * crawl that reports itself complete.
 */
describe('CrawlerService — a failed attempt hands its URL back', () => {
  function crawler(fetchImpl: jest.Mock) {
    const queue: any = { pageFetchQueue: undefined, getRedisClient: () => undefined };
    const prisma: any = {
      crawlJob: { findUnique: jest.fn(async () => ({ id: 'job1', status: 'RUNNING' })) },
    };
    const robots: any = { isUrlAllowed: jest.fn(async () => true) };
    const fetchSvc: any = { fetch: fetchImpl };

    return new (CrawlerService as any)(prisma, {}, queue, robots, {}, {}, fetchSvc, {}, {}, {}, {}, {}, {});
  }

  const payload = {
    jobId: 'job1',
    websiteId: 'w1',
    domain: 'example.test',
    targetUrl: 'https://example.test/a',
    depth: 0,
    maxDepth: 10,
    rateLimitDelayMs: 0,
    taskId: 'task-a',
  };

  it('lets a second attempt fetch a URL whose first attempt threw', async () => {
    const fetch = jest
      .fn()
      .mockRejectedValueOnce(new Error('the worker died mid-render'))
      .mockRejectedValueOnce(new Error('and again, which is enough to show the retry got through'));
    const service: any = crawler(fetch);

    await expect(service.processPageFetch(payload)).rejects.toThrow('the worker died');
    await expect(service.processPageFetch(payload)).rejects.toThrow('and again');

    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('leaves no claim behind for the retry to trip over', async () => {
    const fetch = jest.fn(async () => {
      throw new Error('first attempt fails');
    });
    const service: any = crawler(fetch);

    await expect(service.processPageFetch(payload)).rejects.toThrow();

    expect(service.localVisited.get('job1')?.size ?? 0).toBe(0);
  });
});

/**
 * Crawl-wide state has to be reachable from whichever process fetches a page.
 *
 * The worker deployment runs page fetches in a second container, and a
 * container that restarts mid-crawl comes back with its fields empty while the
 * queue hands it the same crawl's URLs. Held in memory, the sitemap's URL set
 * was invisible to it: every page it fetched was recorded as `seed` rather than
 * `sitemap`, counted as absent from the sitemap by the issue engine, and had
 * its indexability decided with no robots.txt to read. The audit of
 * milquufresh.in shows the signature — its homepage labelled `sitemap` and
 * every page after it labelled `seed`.
 */
describe('CrawlerService — crawl state outlives the process that discovered it', () => {
  /** Enough of Redis for the state helpers. */
  function fakeRedis() {
    const strings = new Map<string, string>();
    return {
      strings,
      get: jest.fn(async (key: string) => strings.get(key) ?? null),
      set: jest.fn(async (key: string, value: string) => {
        strings.set(key, value);
        return 'OK';
      }),
      del: jest.fn(async (...keys: string[]) => {
        for (const key of keys) strings.delete(key);
        return keys.length;
      }),
    };
  }

  function worker(redis: any) {
    const queue: any = { getRedisClient: () => redis, forgetJobTasks: jest.fn() };
    return new (CrawlerService as any)({}, {}, queue, {}, {}, {}, {}, {}, {}, {}, {}, {}, {});
  }

  it('reads back the sitemap and robots.txt in a process that never saw them', async () => {
    const redis = fakeRedis();
    const discoverer: any = worker(redis);
    const robots = { groups: [{ agents: ['*'], rules: [{ allow: false, path: '/admin/' }] }], sitemaps: [], raw: 'User-agent: *' };

    await discoverer.saveCrawlState('job1', {
      sitemapUrls: new Set(['https://example.test/', 'https://example.test/pricing']),
      robots,
      sitemapFindings: [{ kind: 'EMPTY', sitemapUrl: 'https://example.test/sitemap.xml', evidence: 'no urls' }],
    });

    const fetcher: any = worker(redis);
    const state = await fetcher.loadCrawlState('job1');

    expect([...state.sitemapUrls]).toEqual(['https://example.test/', 'https://example.test/pricing']);
    expect(state.robots).toEqual(robots);
    expect(state.sitemapFindings).toHaveLength(1);
  });

  it('reports an empty crawl state rather than failing when Redis has nothing', async () => {
    const fetcher: any = worker(fakeRedis());

    const state = await fetcher.loadCrawlState('never-seen');

    expect(state.sitemapUrls.size).toBe(0);
    expect(state.robots).toBeUndefined();
  });

  it('serves later pages of the same worker from memory', async () => {
    const redis = fakeRedis();
    const fetcher: any = worker(redis);
    redis.strings.set('job1:seeded', 'x');
    await fetcher.saveCrawlState('job1', { sitemapUrls: new Set(['https://example.test/']), robots: undefined, sitemapFindings: [] });

    await fetcher.loadCrawlState('job1');
    await fetcher.loadCrawlState('job1');

    expect(redis.get).not.toHaveBeenCalled();
  });
});
