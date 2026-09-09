import { GoogleSyncScheduler } from './google-sync.scheduler';

/**
 * A sync paginates through months of rows. Everything that matters here is
 * about not making one customer's problem into everyone's: an overlapping run,
 * a broken connection retried forever, one failure aborting the rest.
 */
describe('GoogleSyncScheduler', () => {
  const build = (connections: any[] = [], syncImpl?: jest.Mock) => {
    const prisma = {
      integration: {
        findMany: jest.fn().mockResolvedValue(connections),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    const searchConsole = {
      sync: syncImpl ?? jest.fn().mockResolvedValue({ status: 'SUCCEEDED', rowsWritten: 10 }),
    };
    const analytics = { sync: jest.fn().mockResolvedValue({ status: 'SUCCEEDED', rowsWritten: 7 }) };
    // Business Profile counts records per source rather than rows in one
    // table — it has five sources that succeed and fail independently.
    const businessProfile = {
      sync: jest.fn().mockResolvedValue({
        status: 'PARTIAL',
        counts: { reviews: 3, photos: 0, posts: 0, services: 2, metricDays: 90 },
        failedSources: ['media', 'posts'],
      }),
    };
    return {
      prisma,
      searchConsole,
      analytics,
      businessProfile,
      scheduler: new GoogleSyncScheduler(
        prisma as any,
        searchConsole as any,
        analytics as any,
        businessProfile as any,
      ),
    };
  };

  it('only syncs connections that can actually be read', async () => {
    // NEEDS_REAUTH and NEEDS_SELECTION need a person, not a retry. Polling
    // them on a timer burns quota and buries real failures in the log.
    const { prisma, scheduler } = build();

    await scheduler.syncConnectedSources();

    expect(prisma.integration.findMany.mock.calls[0][0].where).toMatchObject({
      status: 'CONNECTED',
      selectedResourceId: { not: null },
    });
  });

  it('carries on when one project fails', async () => {
    // One customer's revoked token must not stop every other customer's sync.
    const sync = jest
      .fn()
      .mockRejectedValueOnce(new Error('revoked'))
      .mockResolvedValue({ status: 'SUCCEEDED', rowsWritten: 5 });
    const { scheduler } = build([
      { projectId: 'a', provider: 'search_console' },
      { projectId: 'b', provider: 'search_console' },
      { projectId: 'c', provider: 'search_console' },
    ], sync);

    await scheduler.syncConnectedSources();

    expect(sync).toHaveBeenCalledTimes(3);
  });

  it('does not start a second run while one is in flight', async () => {
    // A slow sync outliving its interval would otherwise stack up, with two
    // runs writing the same window.
    let release: () => void;
    const sync = jest.fn(() => new Promise((resolve) => { release = () => resolve({ status: 'SUCCEEDED', rowsWritten: 0 }); }));
    const { scheduler } = build([{ projectId: 'a', provider: 'search_console' }], sync as any);

    const first = scheduler.syncConnectedSources();
    await scheduler.syncConnectedSources();
    expect(sync).toHaveBeenCalledTimes(1);

    release!();
    await first;
  });

  it('frees the lock even when the whole run throws', async () => {
    // Otherwise one bad night stops syncing until the process restarts.
    const { prisma, scheduler } = build();
    prisma.integration.findMany.mockRejectedValueOnce(new Error('database down'));

    await expect(scheduler.syncConnectedSources()).rejects.toThrow('database down');

    prisma.integration.findMany.mockResolvedValue([]);
    await expect(scheduler.syncConnectedSources()).resolves.toBeUndefined();
  });

  it('records when the next refresh is due', async () => {
    const { prisma, scheduler } = build([{ projectId: 'a', provider: 'search_console' }]);

    await scheduler.syncConnectedSources();

    const next = prisma.integration.update.mock.calls[0][0].data.nextSyncAt;
    expect(next.getTime()).toBeGreaterThan(Date.now());
  });

  it('routes each connection to the connector that owns it', async () => {
    // One loop over both providers, so a customer with Analytics but no
    // Search Console is still synced.
    const { searchConsole, analytics, businessProfile, scheduler } = build([
      { projectId: 'a', provider: 'search_console' },
      { projectId: 'b', provider: 'analytics' },
      { projectId: 'c', provider: 'business_profile' },
    ]);

    await scheduler.syncConnectedSources();

    expect(searchConsole.sync).toHaveBeenCalledWith('a');
    expect(analytics.sync).toHaveBeenCalledWith('b');
    expect(businessProfile.sync).toHaveBeenCalledWith('c');
  });

  it('does not treat a partly refused Business Profile sync as a failure', async () => {
    // v4 refusing reviews, photos and posts is the ordinary case on a Cloud
    // project without legacy access. Letting that throw would abort the run
    // and leave nextSyncAt unset, so the page could never say when data
    // refreshes next.
    const { prisma, scheduler } = build([{ projectId: 'a', provider: 'business_profile' }]);

    await scheduler.syncConnectedSources();

    expect(prisma.integration.update).toHaveBeenCalledTimes(1);
  });
});
