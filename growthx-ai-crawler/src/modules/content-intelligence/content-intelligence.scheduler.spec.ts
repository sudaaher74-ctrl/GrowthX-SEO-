import { ContentIntelligenceScheduler } from './content-intelligence.scheduler';
import { COMPETITOR_STATUS, TRACKED_COMPETITOR_STATUSES } from './competitor-status';

describe('ContentIntelligenceScheduler — competitor sweeps', () => {
  let prisma: any;
  let competitorCrawlService: any;
  let competitorMonitorService: any;
  let contentStrategyService: any;
  let scheduler: ContentIntelligenceScheduler;

  beforeEach(() => {
    delete process.env.COMPETITOR_CRON_ENABLED;
    prisma = {
      competitorDomain: { findMany: jest.fn().mockResolvedValue([]) },
      project: { findMany: jest.fn().mockResolvedValue([]) },
    };
    competitorCrawlService = { startCrawl: jest.fn().mockResolvedValue({}) };
    competitorMonitorService = { runCompetitorChangeDetection: jest.fn().mockResolvedValue([]) };
    contentStrategyService = { generateStrategy: jest.fn().mockResolvedValue({}) };
    scheduler = new ContentIntelligenceScheduler(
      prisma,
      competitorCrawlService,
      competitorMonitorService,
      contentStrategyService,
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
