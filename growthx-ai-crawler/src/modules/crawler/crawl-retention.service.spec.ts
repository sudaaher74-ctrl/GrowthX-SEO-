import { CrawlRetentionService, RetentionConfig, retentionConfig } from './crawl-retention.service';

/**
 * Retention deletes customer data, so these tests run it against an in-memory
 * database that applies the same filters the service's queries use, and check
 * exactly which crawls lost what.
 */
type Job = {
  id: string;
  websiteId: string;
  status: string;
  createdAt: Date;
  htmlPrunedAt: Date | null;
  detailsPrunedAt: Date | null;
};

const NOW = new Date('2026-09-27T02:30:00Z');
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000);

const CONFIG: RetentionConfig = { mode: 'delete', keepHtml: 2, keepDetailed: 3, minAgeDays: 45, maxCrawlsPerRun: 200 };

function matches(job: Job, where: any): boolean {
  if (!where) return true;
  if (where.websiteId && job.websiteId !== where.websiteId) return false;
  if (typeof where.status === 'string' && job.status !== where.status) return false;
  if (where.status?.in && !where.status.in.includes(job.status)) return false;
  if (where.createdAt?.lt && !(job.createdAt < where.createdAt.lt)) return false;
  if (where.OR && !where.OR.some((clause: any) => Object.entries(clause).every(([k, v]) => (job as any)[k] === v))) {
    return false;
  }
  return true;
}

function fakeDb(jobs: Job[], extra: { autopilot?: string[]; interventionPages?: Record<string, string>; designFiles?: string[] } = {}) {
  const writes: Array<{ op: string; crawlJobId: string; data?: any }> = [];
  const byCrawl = (op: string) => jest.fn(async ({ where, data }: any) => {
    writes.push({ op, crawlJobId: where.crawlJobId, data });
    return { count: 1 };
  });

  const prisma: any = {
    crawlJob: {
      findMany: jest.fn(async ({ where, orderBy, take, distinct }: any) => {
        let rows = jobs.filter((j) => matches(j, where));
        if (orderBy?.createdAt) {
          rows = [...rows].sort((a, b) =>
            orderBy.createdAt === 'desc' ? b.createdAt.getTime() - a.createdAt.getTime() : a.createdAt.getTime() - b.createdAt.getTime(),
          );
        }
        if (distinct) rows = rows.filter((j, i) => rows.findIndex((o) => o.websiteId === j.websiteId) === i);
        return take ? rows.slice(0, take) : rows;
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const job = jobs.find((j) => j.id === where.id)!;
        Object.assign(job, data);
        writes.push({ op: 'crawlJob.update', crawlJobId: where.id, data });
        return job;
      }),
    },
    page: {
      updateMany: byCrawl('page.updateMany'),
      deleteMany: byCrawl('page.deleteMany'),
      findMany: jest.fn(async ({ where }: any) =>
        (where.id.in as string[]).filter((id) => extra.interventionPages?.[id]).map((id) => ({ crawlJobId: extra.interventionPages![id] })),
      ),
    },
    issue: { deleteMany: byCrawl('issue.deleteMany') },
    internalGraph: { deleteMany: byCrawl('internalGraph.deleteMany') },
    siteSocialLink: { deleteMany: byCrawl('siteSocialLink.deleteMany') },
    crawlFrontier: { deleteMany: byCrawl('crawlFrontier.deleteMany') },
    autopilotRun: { findMany: jest.fn(async () => (extra.autopilot ?? []).map((id) => ({ ownCrawlJobId: id }))) },
    fixIntervention: {
      findMany: jest.fn(async () => Object.keys(extra.interventionPages ?? {}).map((id) => ({ beforePageId: id, afterPageId: null }))),
    },
    pageSnapshot: { findMany: jest.fn(async () => (extra.designFiles ?? []).map((url) => ({ htmlSnapshotUrl: url }))) },
    $transaction: jest.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
  };
  const storage = { deleteSnapshotsForJobs: jest.fn(async (ids: string[]) => ids.length * 10) };
  return { prisma, storage, writes };
}

/** One website's crawls, newest last: `completed` completed crawls, one per `spacingDays`. */
function history(websiteId: string, count: number, spacingDays: number, status = 'COMPLETED'): Job[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `${websiteId}-${i + 1}`,
    websiteId,
    status,
    createdAt: daysAgo((count - i) * spacingDays),
    htmlPrunedAt: null,
    detailsPrunedAt: null,
  }));
}

const touched = (writes: any[], op: string) => [...new Set(writes.filter((w) => w.op === op).map((w) => w.crawlJobId))].sort();

describe('CrawlRetentionService', () => {
  it('keeps HTML on the newest two completed crawls and clears it from the rest', async () => {
    // Weekly crawls, all younger than the 45-day floor: HTML tier only.
    const jobs = history('site', 5, 7);
    const { prisma, storage, writes } = fakeDb(jobs);

    const summary = await new CrawlRetentionService(prisma, storage as any).run(CONFIG, NOW);

    expect(touched(writes, 'page.updateMany')).toEqual(['site-1', 'site-2', 'site-3']);
    expect(writes.find((w) => w.op === 'page.updateMany')!.data).toEqual({ rawHtml: null, renderedHtml: null, htmlSnapshotUrl: null });
    expect(touched(writes, 'page.deleteMany')).toEqual([]);
    expect(summary).toMatchObject({ applied: true, htmlPruned: 3, detailsPruned: 0 });
  });

  it('deletes detail only beyond the newest three AND past the age floor', async () => {
    // Ten crawls, 10 days apart: site-1 is 100 days old, site-10 is 10 days old.
    const jobs = history('site', 10, 10);
    const { prisma, storage, writes } = fakeDb(jobs);

    await new CrawlRetentionService(prisma, storage as any).run(CONFIG, NOW);

    // Older than 45 days: site-1..site-6 (100..50 days). All are beyond the newest three.
    const old = ['site-1', 'site-2', 'site-3', 'site-4', 'site-5', 'site-6'];
    expect(touched(writes, 'page.deleteMany')).toEqual(old);
    expect(touched(writes, 'issue.deleteMany')).toEqual(old);
    // Younger than the floor (40 and 30 days) but not among the newest two: HTML only.
    expect(touched(writes, 'page.updateMany')).toEqual(['site-7', 'site-8']);
    // The newest two keep everything.
    expect(writes.map((w) => w.crawlJobId)).not.toEqual(expect.arrayContaining(['site-9']));
    expect(writes.map((w) => w.crawlJobId)).not.toEqual(expect.arrayContaining(['site-10']));
    // The crawl rows themselves are never deleted, so trend lines keep them.
    expect(prisma.crawlJob.update).toHaveBeenCalledWith({
      where: { id: 'site-1' },
      data: { detailsPrunedAt: NOW, htmlPrunedAt: NOW },
    });
  });

  it('never touches a crawl that is still running or pending', async () => {
    const jobs = [
      ...history('site', 4, 20),
      { id: 'running', websiteId: 'site', status: 'RUNNING', createdAt: daysAgo(200), htmlPrunedAt: null, detailsPrunedAt: null },
      { id: 'pending', websiteId: 'site', status: 'PENDING', createdAt: daysAgo(150), htmlPrunedAt: null, detailsPrunedAt: null },
    ];
    const { prisma, storage, writes } = fakeDb(jobs);

    await new CrawlRetentionService(prisma, storage as any).run(CONFIG, NOW);

    const all = writes.map((w) => w.crawlJobId);
    expect(all).not.toContain('running');
    expect(all).not.toContain('pending');
  });

  it('prunes old failed crawls too, once a site has enough completed ones', async () => {
    const jobs = [
      { id: 'failed-old', websiteId: 'site', status: 'FAILED', createdAt: daysAgo(90), htmlPrunedAt: null, detailsPrunedAt: null },
      ...history('site', 3, 5),
    ];
    const { prisma, storage, writes } = fakeDb(jobs);

    await new CrawlRetentionService(prisma, storage as any).run(CONFIG, NOW);

    expect(touched(writes, 'page.deleteMany')).toEqual(['failed-old']);
  });

  it('leaves a site with fewer completed crawls than it keeps alone', async () => {
    const jobs = [
      ...history('site', 1, 60),
      { id: 'failed', websiteId: 'site', status: 'FAILED', createdAt: daysAgo(100), htmlPrunedAt: null, detailsPrunedAt: null },
    ];
    const { prisma, storage, writes } = fakeDb(jobs);

    await new CrawlRetentionService(prisma, storage as any).run(CONFIG, NOW);

    expect(writes).toEqual([]);
  });

  it('leaves crawls that an Autopilot run or a fix intervention cites', async () => {
    const jobs = history('site', 8, 20);
    const { prisma, storage, writes } = fakeDb(jobs, {
      autopilot: ['site-1'],
      interventionPages: { 'page-before': 'site-2' },
    });

    const summary = await new CrawlRetentionService(prisma, storage as any).run(CONFIG, NOW);

    const all = writes.map((w) => w.crawlJobId);
    expect(all).not.toContain('site-1');
    expect(all).not.toContain('site-2');
    expect(touched(writes, 'page.deleteMany')).toContain('site-3');
    expect(summary.skippedProtected).toBe(2);
  });

  it('reports what it would do without writing anything in report mode', async () => {
    const jobs = history('site', 10, 10);
    const { prisma, storage, writes } = fakeDb(jobs);

    const summary = await new CrawlRetentionService(prisma, storage as any).run({ ...CONFIG, mode: 'report' }, NOW);

    expect(writes).toEqual([]);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(storage.deleteSnapshotsForJobs).not.toHaveBeenCalled();
    expect(summary).toMatchObject({ applied: false, htmlPruned: 2, detailsPruned: 6 });
  });

  it('does not reprocess a crawl already pruned', async () => {
    const jobs = history('site', 10, 10);
    const { prisma, storage } = fakeDb(jobs);
    const service = new CrawlRetentionService(prisma, storage as any);
    await service.run(CONFIG, NOW);

    const again = fakeDb(jobs);
    const summary = await new CrawlRetentionService(again.prisma, again.storage as any).run(CONFIG, NOW);

    expect(again.writes).toEqual([]);
    expect(summary).toMatchObject({ htmlPruned: 0, detailsPruned: 0 });
  });

  it('stops at the per-run ceiling, oldest first, and picks up the rest next time', async () => {
    const jobs = history('site', 10, 10);
    const { prisma, storage, writes } = fakeDb(jobs);

    await new CrawlRetentionService(prisma, storage as any).run({ ...CONFIG, maxCrawlsPerRun: 2 }, NOW);

    expect(touched(writes, 'page.deleteMany')).toEqual(['site-1', 'site-2']);
    expect(touched(writes, 'page.updateMany')).toEqual([]);
  });

  it('keeps the snapshot files Design Studio still reads', async () => {
    const jobs = history('site', 4, 7);
    const { prisma, storage } = fakeDb(jobs, { designFiles: ['file:///snapshots/site-1_page_1.html'] });

    await new CrawlRetentionService(prisma, storage as any).run(CONFIG, NOW);

    expect(storage.deleteSnapshotsForJobs).toHaveBeenCalledWith(
      ['site-1', 'site-2'],
      new Set(['file:///snapshots/site-1_page_1.html']),
    );
  });

  it('keeps going when one crawl cannot be pruned', async () => {
    const jobs = history('site', 10, 10);
    const { prisma, storage } = fakeDb(jobs);
    const realTransaction = prisma.$transaction;
    let calls = 0;
    prisma.$transaction = jest.fn(async (ops: Promise<unknown>[]) => {
      if (++calls === 1) {
        await Promise.allSettled(ops);
        throw new Error('deadlock detected');
      }
      return realTransaction(ops);
    });

    const summary = await new CrawlRetentionService(prisma, storage as any).run(CONFIG, NOW);

    expect(summary.htmlPruned + summary.detailsPruned).toBe(7);
  });
});

describe('retentionConfig', () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
  });

  it('deletes by default with the documented thresholds', () => {
    delete process.env.CRAWL_RETENTION_MODE;
    expect(retentionConfig()).toEqual({ mode: 'delete', keepHtml: 2, keepDetailed: 3, minAgeDays: 45, maxCrawlsPerRun: 200 });
  });

  it('treats an unrecognised mode as report, so a typo can never delete', () => {
    process.env.CRAWL_RETENTION_MODE = 'delet';
    expect(retentionConfig().mode).toBe('report');
    process.env.CRAWL_RETENTION_MODE = ' OFF ';
    expect(retentionConfig().mode).toBe('off');
  });

  it('never keeps full detail on fewer crawls than keep HTML', () => {
    process.env.CRAWL_RETENTION_KEEP_HTML = '5';
    process.env.CRAWL_RETENTION_KEEP_DETAILED = '2';
    expect(retentionConfig()).toMatchObject({ keepHtml: 5, keepDetailed: 5 });
  });

  it('ignores a nonsensical number rather than keeping nothing', () => {
    process.env.CRAWL_RETENTION_KEEP_HTML = '0';
    process.env.CRAWL_RETENTION_MIN_AGE_DAYS = 'soon';
    expect(retentionConfig()).toMatchObject({ keepHtml: 2, minAgeDays: 45 });
  });
});
