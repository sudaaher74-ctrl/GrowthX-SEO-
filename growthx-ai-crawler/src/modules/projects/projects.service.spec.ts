import { ProjectsService } from './projects.service';

describe('ProjectsService — fast bottom-up project deletion & snapshot cleanup', () => {
  it('cancels active jobs, purges crawl leaf tables bottom-up before Website/Project delete, and deletes local snapshots', async () => {
    const order: string[] = [];
    const prisma: any = {
      integration: { findMany: jest.fn().mockResolvedValue([]) },
      crawlJob: {
        updateMany: jest.fn(async () => {
          order.push('cancel-jobs');
          return { count: 1 };
        }),
        findMany: jest.fn().mockResolvedValue([{ id: 'job_1' }, { id: 'job_2' }]),
      },
      autopilotRun: { deleteMany: jest.fn().mockResolvedValue({}) },
      auditReportSnapshot: { deleteMany: jest.fn().mockResolvedValue({}) },
      competitorReportSnapshot: { deleteMany: jest.fn().mockResolvedValue({}) },
      googleReportSnapshot: { deleteMany: jest.fn().mockResolvedValue({}) },
      businessStrategySnapshot: { deleteMany: jest.fn().mockResolvedValue({}) },
      savedPlan: { deleteMany: jest.fn().mockResolvedValue({}) },
      actionStepDone: { deleteMany: jest.fn().mockResolvedValue({}) },
      fixIntervention: { deleteMany: jest.fn().mockResolvedValue({}) },
      catalogProduct: {
        deleteMany: jest.fn(async () => {
          order.push('delete-catalog-product');
          return { count: 2 };
        }),
      },
      marketingSignal: {
        deleteMany: jest.fn(async () => {
          order.push('delete-marketing-signal');
          return { count: 1 };
        }),
      },
      recommendation: { deleteMany: jest.fn().mockResolvedValue({}) },
      evidence: { deleteMany: jest.fn().mockResolvedValue({}) },
      $executeRaw: jest.fn(async (strings: TemplateStringsArray) => {
        const sql = strings.join(' ').replace(/\s+/g, ' ').trim();
        const tableMatch = sql.match(/DELETE FROM "(\w+)"/);
        if (tableMatch) order.push(`raw:${tableMatch[1]}`);
        return 1;
      }),
      website: {
        deleteMany: jest.fn((args: any) => args),
      },
      project: {
        delete: jest.fn((args: any) => args),
      },
      $transaction: jest.fn(async () => {
        order.push('tx-delete-websites-and-project');
        return [];
      }),
    };

    const storage: any = {
      deleteSnapshotsForJobs: jest.fn(async (ids: string[]) => {
        order.push(`snapshots:${ids.join(',')}`);
        return 14;
      }),
    };

    const service = new ProjectsService(prisma, storage);
    await service.deleteProject('proj_icici');

    expect(order[0]).toBe('cancel-jobs');
    expect(order).toContain('delete-catalog-product');
    expect(order).toContain('delete-marketing-signal');

    // Bottom-up leaf order before Page, CrawlJob, Website/Project, and snapshot cleanup
    const idxLink = order.indexOf('raw:Link');
    const idxImage = order.indexOf('raw:Image');
    const idxIssue = order.indexOf('raw:Issue');
    const idxPage = order.indexOf('raw:Page');
    const idxJob = order.indexOf('raw:CrawlJob');
    const idxTx = order.indexOf('tx-delete-websites-and-project');
    const idxSnap = order.indexOf('snapshots:job_1,job_2');

    expect(idxIssue).toBeGreaterThan(-1);
    expect(idxLink).toBeGreaterThan(-1);
    expect(idxImage).toBeGreaterThan(-1);
    expect(idxPage).toBeGreaterThan(idxLink);
    expect(idxPage).toBeGreaterThan(idxImage);
    expect(idxJob).toBeGreaterThan(idxPage);
    expect(idxTx).toBeGreaterThan(idxJob);
    expect(idxSnap).toBeGreaterThan(idxTx);
    expect(storage.deleteSnapshotsForJobs).toHaveBeenCalledWith(['job_1', 'job_2']);
  });
});
