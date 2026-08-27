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
    service = new (CrawlerService as any)(prisma, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {});
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
