import { OpportunityDetectionScheduler } from './opportunity-detection.scheduler';

describe('OpportunityDetectionScheduler', () => {
  const build = (projects: any[] = [], detectImpl?: jest.Mock) => {
    const prisma = { project: { findMany: jest.fn().mockResolvedValue(projects) } };
    const detection = {
      detect: detectImpl ?? jest.fn().mockResolvedValue({ detected: 3, failedDetectors: [] }),
    };
    return { prisma, detection, scheduler: new OpportunityDetectionScheduler(prisma as any, detection as any) };
  };

  it('only considers projects with something to compare', async () => {
    // Detection over a project with no crawl and no competitor produces
    // nothing and costs a round trip; on a growing account that is the run.
    const { prisma, scheduler } = build();

    await scheduler.detectForActiveProjects();

    const where = prisma.project.findMany.mock.calls[0][0].where;
    expect(where.OR).toHaveLength(2);
    expect(where.OR[0]).toEqual({ competitors: { some: { websiteId: { not: null } } } });
  });

  it('carries on when one project fails', async () => {
    const detect = jest
      .fn()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValue({ detected: 1, failedDetectors: [] });
    const { scheduler } = build([{ id: 'a', organizationId: 'o' }, { id: 'b', organizationId: 'o' }], detect);

    await scheduler.detectForActiveProjects();

    expect(detect).toHaveBeenCalledTimes(2);
  });

  it('does not start a second run while one is in flight', async () => {
    let release: () => void;
    const detect = jest.fn(() => new Promise((r) => { release = () => r({ detected: 0, failedDetectors: [] }); }));
    const { scheduler } = build([{ id: 'a', organizationId: 'o' }], detect as any);

    const first = scheduler.detectForActiveProjects();
    await scheduler.detectForActiveProjects();
    expect(detect).toHaveBeenCalledTimes(1);

    release!();
    await first;
  });

  it('frees the lock when the run throws', async () => {
    // Otherwise one bad night stops detection until the process restarts.
    const { prisma, scheduler } = build();
    prisma.project.findMany.mockRejectedValueOnce(new Error('database down'));

    await expect(scheduler.detectForActiveProjects()).rejects.toThrow('database down');

    prisma.project.findMany.mockResolvedValue([]);
    await expect(scheduler.detectForActiveProjects()).resolves.toBeUndefined();
  });
});
