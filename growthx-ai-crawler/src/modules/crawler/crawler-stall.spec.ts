import { CrawlerService } from './crawler.service';

/**
 * A crawl finishes when its pending-task counter reaches zero, decremented as
 * each page is processed. Nothing decrements it for work that is never
 * processed — a restart mid-crawl, a dropped queue job — so the counter stays
 * above zero and the job sits at RUNNING forever. The UI reads the most recent
 * COMPLETED crawl, so a single lost page keeps a whole crawl invisible while
 * its pages sit in the database.
 */
describe('CrawlerService — stalled job sweep', () => {
  let prisma: any;
  let service: any;
  let completed: string[];

  beforeEach(() => {
    completed = [];
    prisma = {
      crawlJob: {
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue({}),
      },
    };

    // Only the collaborators the sweep touches; the rest are irrelevant here.
    service = new (CrawlerService as any)(prisma, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, { record: async () => ({ added: 0, merged: 0, invalid: 0 }), markQueued: async () => undefined, markCrawled: async () => undefined, markExcluded: async () => undefined, metrics: async () => null });
    service.completeJob = jest.fn(async (id: string) => {
      completed.push(id);
    });
  });

  afterEach(() => service.onModuleDestroy?.());

  it('surfaces a partial crawl rather than discarding the pages it recorded', async () => {
    prisma.crawlJob.findMany.mockResolvedValue([{ id: 'job-1', pagesCrawled: 43, status: 'RUNNING' }]);

    await service.finalizeStalledJobs();

    // Those 43 pages and their issues are real; completing the job is what
    // makes them visible instead of leaving the site reading "crawl never".
    expect(completed).toEqual(['job-1']);
    expect(prisma.crawlJob.update).not.toHaveBeenCalled();
  });

  it('fails a job that never crawled anything', async () => {
    prisma.crawlJob.findMany.mockResolvedValue([{ id: 'job-2', pagesCrawled: 0, status: 'PENDING' }]);

    await service.finalizeStalledJobs();

    expect(completed).toEqual([]);
    expect(prisma.crawlJob.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'job-2' }, data: expect.objectContaining({ status: 'FAILED' }) }),
    );
  });

  it('only considers jobs idle beyond the timeout, so a live crawl is left alone', async () => {
    await service.finalizeStalledJobs();

    const { where } = prisma.crawlJob.findMany.mock.calls[0][0];
    expect(where.status).toEqual({ in: ['RUNNING', 'PENDING'] });
    const cutoff = where.updatedAt.lt as Date;
    const idleMs = Date.now() - cutoff.getTime();
    expect(idleMs).toBeGreaterThanOrEqual(4 * 60 * 1000);
  });

  it('keeps sweeping after one job fails to finalise', async () => {
    prisma.crawlJob.findMany.mockResolvedValue([
      { id: 'bad', pagesCrawled: 5, status: 'RUNNING' },
      { id: 'good', pagesCrawled: 7, status: 'RUNNING' },
    ]);
    service.completeJob = jest.fn(async (id: string) => {
      if (id === 'bad') throw new Error('graph analysis blew up');
      completed.push(id);
    });

    await expect(service.finalizeStalledJobs()).resolves.toBeUndefined();
    expect(completed).toEqual(['good']);
  });

  it('never lets a sweep failure escape into the crawl', async () => {
    prisma.crawlJob.findMany.mockRejectedValue(new Error('database unreachable'));

    await expect(service.finalizeStalledJobs()).resolves.toBeUndefined();
  });
});

/**
 * The pages a truncated crawl did record are real and worth showing. The
 * claim that the crawl finished is not.
 *
 * A run that read 7 of 29 discovered URLs was closed by the sweep and
 * reported COMPLETED with 7 pages. Nothing on the crawl said otherwise, so
 * the health score, the issue counts and the page total all described a
 * quarter of the site while presenting themselves as the whole of it.
 */
describe('CrawlerService — a crawl cut short', () => {
  let prisma: any;
  let service: any;
  let updates: any[];

  beforeEach(() => {
    updates = [];
    prisma = {
      crawlJob: {
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn(async (args: any) => {
          updates.push(args);
          return {};
        }),
      },
    };
    service = new (CrawlerService as any)(prisma, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, { record: async () => ({ added: 0, merged: 0, invalid: 0 }), markQueued: async () => undefined, markCrawled: async () => undefined, markExcluded: async () => undefined, metrics: async () => null });
    service.completeJob = jest.fn(async () => {});
  });

  const stalled = (pagesCrawled: number, pagesDiscovered: number) => {
    prisma.crawlJob.findMany.mockResolvedValue([{ id: 'j1', pagesCrawled, pagesDiscovered, status: 'RUNNING' }]);
    return service.finalizeStalledJobs();
  };

  it('says how much of the site it actually read', async () => {
    await stalled(7, 29);

    const reason = updates.find((u) => u.data?.errorMessage)?.data.errorMessage ?? '';
    expect(reason).toContain('7 of 29');
  });

  it('still surfaces the pages it managed to record', async () => {
    await stalled(7, 29);

    expect(service.completeJob).toHaveBeenCalledWith('j1');
  });

  it('stays quiet when the crawl actually covered what it found', async () => {
    await stalled(29, 29);

    expect(updates.find((u) => u.data?.errorMessage)).toBeUndefined();
  });

  /** An older crawl predating the column reads 0 discovered, which is not a shortfall. */
  it('does not invent a shortfall for a crawl with no discovered count', async () => {
    await stalled(7, 0);

    expect(updates.find((u) => u.data?.errorMessage)).toBeUndefined();
  });
});
