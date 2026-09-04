import { ContentIntelligenceScheduler } from './content-intelligence.scheduler';
import { COMPETITOR_STATUS, TRACKED_COMPETITOR_STATUSES } from './competitor-status';

describe('ContentIntelligenceScheduler — competitor sweeps', () => {
  let prisma: any;
  let competitorCrawlService: any;
  let competitorMonitorService: any;
  let contentStrategyService: any;
  let socialScraper: any;
  let competitorLocal: any;
  let scheduler: ContentIntelligenceScheduler;

  const originalEnv = { ...process.env };

  afterAll(() => {
    process.env = originalEnv;
  });

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.COMPETITOR_CRON_ENABLED;
    delete process.env.YOUTUBE_API_KEY;
    prisma = {
      competitorDomain: { findMany: jest.fn().mockResolvedValue([]) },
      competitorAccount: { findMany: jest.fn().mockResolvedValue([]) },
      project: { findMany: jest.fn().mockResolvedValue([]) },
    };
    competitorCrawlService = { startCrawl: jest.fn().mockResolvedValue({}) };
    competitorMonitorService = { runCompetitorChangeDetection: jest.fn().mockResolvedValue([]) };
    contentStrategyService = { generateStrategy: jest.fn().mockResolvedValue({}) };
    socialScraper = {
      syncAccountContent: jest.fn().mockResolvedValue({ imported: 3, fetched: 3 }),
    };
    competitorLocal = { refreshProject: jest.fn().mockResolvedValue({ checked: 0, matched: 0 }) };
    scheduler = new ContentIntelligenceScheduler(
      prisma,
      competitorCrawlService,
      competitorMonitorService,
      contentStrategyService,
      socialScraper,
      competitorLocal,
    );
  });

  it('sweeps the status the panel actually writes', async () => {
    // `addSelectedCompetitors` stores ANALYZED. The sweep asked for
    // ['ACTIVE','ANALYZING','PENDING'], so every competitor a customer picked
    // was skipped for good and their content was never collected.
    expect(TRACKED_COMPETITOR_STATUSES).toContain(COMPETITOR_STATUS.ANALYZED);

    await scheduler.handleDailyCompetitorCrawl();

    const where = prisma.competitorDomain.findMany.mock.calls[0][0].where;
    expect(where.status.in).toContain('ANALYZED');
  });

  it('never filters on a status this model does not use', async () => {
    // 'ACTIVE' is not in the schema's vocabulary and nothing writes it, so the
    // alert sweep matched no project at all.
    await scheduler.handleDailyCompetitorCrawl();
    await scheduler.handleDailyCompetitorChangeAlerts();

    const crawlWhere = prisma.competitorDomain.findMany.mock.calls[0][0].where;
    const alertWhere = prisma.project.findMany.mock.calls[0][0].where;

    expect(crawlWhere.status.in).not.toContain('ACTIVE');
    expect(JSON.stringify(alertWhere)).not.toContain('"ACTIVE"');
  });

  it('actually collects competitor uploads on a schedule', async () => {
    // Nothing did. syncYoutubeAccountContent was reachable only from a manual
    // per-account POST and fetchYoutubeCompetitorData had no callers at all,
    // so CompetitorContent was never populated automatically — even with a
    // working YouTube key configured.
    process.env.YOUTUBE_API_KEY = 'a-real-looking-youtube-key-1234567890';
    prisma.competitorAccount.findMany.mockResolvedValue([
      { id: 'acc1', handle: '@countrydelight', projectId: 'p1', organizationId: 'org1' },
      { id: 'acc2', handle: '@amul', projectId: 'p1', organizationId: 'org1' },
    ]);

    await scheduler.handleDailyCompetitorContentSync();

    expect(socialScraper.syncAccountContent).toHaveBeenCalledTimes(2);
    expect(socialScraper.syncAccountContent).toHaveBeenCalledWith('org1', 'p1', 'acc1');
  });

  it('keeps going when one channel fails', async () => {
    process.env.YOUTUBE_API_KEY = 'a-real-looking-youtube-key-1234567890';
    prisma.competitorAccount.findMany.mockResolvedValue([
      { id: 'acc1', handle: '@deleted', projectId: 'p1', organizationId: 'org1' },
      { id: 'acc2', handle: '@amul', projectId: 'p1', organizationId: 'org1' },
    ]);
    socialScraper.syncAccountContent
      .mockRejectedValueOnce(new Error('channel not found'))
      .mockResolvedValueOnce({ imported: 5, fetched: 5 });

    await scheduler.handleDailyCompetitorContentSync();

    expect(socialScraper.syncAccountContent).toHaveBeenCalledTimes(2);
  });

  it('does not attempt a sync it cannot perform', async () => {
    delete process.env.YOUTUBE_API_KEY;
    delete process.env.INSTAGRAM_ACCESS_TOKEN;
    delete process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;

    await scheduler.handleDailyCompetitorContentSync();

    expect(socialScraper.syncAccountContent).not.toHaveBeenCalled();
  });

  it('honours the kill switch for the content sweep too', async () => {
    process.env.YOUTUBE_API_KEY = 'a-real-looking-youtube-key-1234567890';
    process.env.COMPETITOR_CRON_ENABLED = 'false';

    await scheduler.handleDailyCompetitorContentSync();

    expect(socialScraper.syncAccountContent).not.toHaveBeenCalled();
  });

  it('syncs whichever platforms are configured, not all or nothing', async () => {
    // Each platform has its own credentials, so one missing set must not stop
    // the other from being collected.
    process.env.INSTAGRAM_ACCESS_TOKEN = 'a-long-lived-instagram-token-1234567890';
    process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID = '17841400000000000';
    delete process.env.YOUTUBE_API_KEY;
    prisma.competitorAccount.findMany.mockResolvedValue([
      { id: 'acc1', handle: '@countrydelight', projectId: 'p1', organizationId: 'org1' },
    ]);

    await scheduler.handleDailyCompetitorContentSync();

    const where = prisma.competitorAccount.findMany.mock.calls[0][0].where;
    expect(where.platform.in).toEqual(['INSTAGRAM']);
    expect(socialScraper.syncAccountContent).toHaveBeenCalledTimes(1);
  });

  it('refreshes competitor Google listings alongside their crawls', async () => {
    // The two describe where a competitor stands today and feed the same
    // comparison; letting one go stale while the other is current would make
    // them disagree.
    prisma.competitorDomain.findMany.mockResolvedValue([
      { id: 'c1', domain: 'a.com', projectId: 'p1', project: { organizationId: 'org1' } },
      { id: 'c2', domain: 'b.com', projectId: 'p1', project: { organizationId: 'org1' } },
    ]);

    await scheduler.handleDailyCompetitorCrawl();

    // One call per project, not per competitor.
    expect(competitorLocal.refreshProject).toHaveBeenCalledTimes(1);
    expect(competitorLocal.refreshProject).toHaveBeenCalledWith('p1');
  });

  it('stops the local refresh early when the whole capability is unavailable', async () => {
    // A missing key is not a per-project problem, so it is reported once
    // rather than logged for every project in the database.
    prisma.competitorDomain.findMany.mockResolvedValue([
      { id: 'c1', domain: 'a.com', projectId: 'p1', project: { organizationId: 'org1' } },
      { id: 'c2', domain: 'b.com', projectId: 'p2', project: { organizationId: 'org1' } },
    ]);
    competitorLocal.refreshProject.mockResolvedValue({
      checked: 0,
      matched: 0,
      skippedReason: 'GOOGLE_PLACES_API_KEY is not set',
    });

    await scheduler.handleDailyCompetitorCrawl();

    expect(competitorLocal.refreshProject).toHaveBeenCalledTimes(1);
  });

  it('leaves failed competitors out of the recurring sweep', () => {
    expect(TRACKED_COMPETITOR_STATUSES).not.toContain(COMPETITOR_STATUS.FAILED);
  });

  it('actually crawls a competitor the panel added', async () => {
    prisma.competitorDomain.findMany.mockResolvedValue([
      {
        id: 'comp1',
        domain: 'countrydelight.in',
        projectId: 'p1',
        project: { organizationId: 'org1' },
      },
    ]);

    await scheduler.handleDailyCompetitorCrawl();

    expect(competitorCrawlService.startCrawl).toHaveBeenCalledWith('org1', 'p1', 'comp1');
  });

  it('runs change detection for a project whose competitors are ANALYZED', async () => {
    prisma.project.findMany.mockResolvedValue([{ id: 'p1', organizationId: 'org1', name: 'MilQuu' }]);

    await scheduler.handleDailyCompetitorChangeAlerts();

    expect(competitorMonitorService.runCompetitorChangeDetection).toHaveBeenCalledWith('org1', 'p1');
  });
});
