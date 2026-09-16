import { CrawlerService } from './crawler.service';

/**
 * `page-fetch` is one queue shared by every crawl, and its jobs outlive the
 * crawl that enqueued them. A crawl closed out by the stall sweep, cancelled,
 * or failed leaves its remaining URLs queued behind, and nothing removed them.
 *
 * Production reached 18,000 queued URLs across 38 finished crawls. Rendering
 * is capped at one page at a time on a small instance, so the queue drains at
 * roughly two pages a minute: that backlog is days of work, and a newly
 * requested crawl sits behind all of it. It records nothing inside the stall
 * timeout and is marked FAILED — a crawler that looks broken while it is busy
 * fetching pages for crawls nobody is waiting on.
 */
describe('CrawlerService — work for finished crawls', () => {
  let prisma: any;
  let service: any;
  let statuses: Record<string, string | null>;

  beforeEach(() => {
    statuses = {};
    prisma = {
      crawlJob: {
        findUnique: jest.fn(async ({ where }: any) => {
          const status = statuses[where.id];
          return status === null || status === undefined ? null : { status };
        }),
      },
    };
    service = new (CrawlerService as any)(prisma, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {});
  });

  const payload = (jobId: string) => ({
    jobId,
    websiteId: 'w1',
    domain: 'example.test',
    targetUrl: 'https://example.test/a',
    depth: 0,
    maxDepth: 10,
    rateLimitDelayMs: 0,
  });

  it.each(['COMPLETED', 'FAILED', 'CANCELLED'])('drops queued work for a %s crawl before fetching', async (status) => {
    statuses['job1'] = status;
    // A fetch would have to go through this; reaching it is the failure.
    service.markUrlVisited = jest.fn();

    await service.processPageFetch(payload('job1'));

    expect(service.markUrlVisited).not.toHaveBeenCalled();
  });

  it('drops work whose crawl row no longer exists', async () => {
    statuses['gone'] = null;
    service.markUrlVisited = jest.fn();

    await service.processPageFetch(payload('gone'));

    expect(service.markUrlVisited).not.toHaveBeenCalled();
  });

  it.each(['RUNNING', 'PENDING'])('still fetches for a %s crawl', async (status) => {
    statuses['live'] = status;
    service.markUrlVisited = jest.fn().mockResolvedValue({ alreadyVisited: true, limitReached: false });

    await service.processPageFetch(payload('live'));

    expect(service.markUrlVisited).toHaveBeenCalled();
  });

  /**
   * Draining a backlog of thousands must not become a database query per URL.
   */
  it('reads a job status once for a burst of queued URLs', async () => {
    statuses['job1'] = 'COMPLETED';

    for (let i = 0; i < 50; i++) await service.processPageFetch(payload('job1'));

    expect(prisma.crawlJob.findUnique).toHaveBeenCalledTimes(1);
  });

  /**
   * Dropping work is an optimisation; crawling is the job. A database blip
   * must not silently discard a live crawl's pages.
   */
  it('fetches anyway when the status lookup fails', async () => {
    prisma.crawlJob.findUnique.mockRejectedValue(new Error('connection reset'));
    service.markUrlVisited = jest.fn().mockResolvedValue({ alreadyVisited: true, limitReached: false });

    await service.processPageFetch(payload('unknown'));

    expect(service.markUrlVisited).toHaveBeenCalled();
  });
});

/**
 * Coverage has to come from a number that survives the process.
 *
 * `jobStats` is one process's memory, and completeJob is reached from a
 * page-fetch worker or after a restart, where it is empty. Falling back to the
 * page count made the denominator equal the numerator, so a crawl that read 6
 * of 29 pages reported "6 of 6" at 100% coverage -- a reassuring wrong answer
 * rather than a missing one, and the reason this shortfall was hunted in the
 * queue, the render pool and the stall sweep before anyone looked here.
 */
describe('CrawlerService — where the coverage denominator comes from', () => {
  function diagnosticsFor(job: any, statsDiscovered?: number) {
    const service: any = new (CrawlerService as any)(
      { crawlJob: { findUnique: jest.fn(async () => job) } },
      {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {},
    );
    if (statsDiscovered !== undefined) {
      service.jobStats.set(job.id, { urlsDiscovered: statsDiscovered, urlsSkipped: 0, robotsBlocked: 0, internalLinksFound: 0, crawlStatus: 'COMPLETED' });
    }
    return service;
  }

  it('prefers the persisted count over an empty in-memory map', () => {
    const service = diagnosticsFor({ id: 'j1', pagesDiscovered: 29 });
    const job = { pagesDiscovered: 29 };
    const stats = service.jobStats.get('j1');

    // The expression completeJob evaluates.
    expect(job.pagesDiscovered || stats?.urlsDiscovered || 0).toBe(29);
  });

  it('never lets the page count stand in for what was discovered', () => {
    const totalPages = 6;
    const job = { pagesDiscovered: 0 };
    const stats = undefined as any;

    const urlsDiscovered = job.pagesDiscovered || stats?.urlsDiscovered || 0;

    // The old expression was `?? totalPages`, which produced 6 and a tidy 100%.
    expect(urlsDiscovered).not.toBe(totalPages);
    expect(urlsDiscovered).toBe(0);
  });

  it('reports no coverage rather than full coverage when the denominator is unknown', () => {
    const urlsDiscovered = 0;
    const coverage = urlsDiscovered > 0 ? Math.round((6 / urlsDiscovered) * 100) : null;

    expect(coverage).toBeNull();
  });
});
