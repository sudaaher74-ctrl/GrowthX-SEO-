import { GrowthContextService } from './growth-context.service';

/**
 * This text is the entire input to the model. Two things must hold: nothing
 * private leaves the process, and every gap in the data is written down —
 * because a model cannot distinguish a missing line from a zero, and will
 * reason about an unmentioned metric as though it were flat.
 */
describe('GrowthContextService', () => {
  const build = (options: any = {}) => {
    const prisma = {
      project: { findFirst: jest.fn().mockResolvedValue({ name: 'Aiva' }) },
      integration: {
        findMany: jest.fn().mockResolvedValue((options.connected ?? []).map((p: string) => ({ provider: p }))),
      },
      crawlJob: { findFirst: jest.fn().mockResolvedValue(options.crawl ?? null) },
      issue: { count: jest.fn().mockResolvedValue(4) },
      competitorDomain: { findMany: jest.fn().mockResolvedValue(options.competitors ?? []) },
      growthOpportunity: { findMany: jest.fn().mockResolvedValue(options.opportunities ?? []) },
    };
    const search = {
      summary: jest.fn().mockResolvedValue(options.search ?? null),
      declining: jest.fn().mockResolvedValue(options.declining ?? []),
    };
    const analytics = { summary: jest.fn().mockResolvedValue(options.analytics ?? null) };
    return { prisma, service: new GrowthContextService(prisma as any, search as any, analytics as any) };
  };

  it('never selects a token off the integration table', async () => {
    // Tokens live on this row. Selecting the whole row would put a customer's
    // Google refresh token one string interpolation away from a prompt.
    const { prisma, service } = build();

    await service.brief('o1', 'p1');

    const select = prisma.integration.findMany.mock.calls[0][0].select;
    expect(select).toEqual({ provider: true });
    expect(select).not.toHaveProperty('accessToken');
    expect(select).not.toHaveProperty('refreshToken');
  });

  it('writes absence in, rather than leaving it out', async () => {
    // An unmentioned metric reads to a model as an unremarkable one.
    const { service } = build();

    const brief = await service.brief('o1', 'p1');

    expect(brief).toMatch(/NOT CONNECTED/);
    expect(brief).toMatch(/Do not draw conclusions about search performance/);
    expect(brief).toMatch(/has not been crawled/);
    expect(brief).toMatch(/No competitor has been crawled/);
  });

  it('distinguishes untracked conversions from zero conversions, in words', async () => {
    const { service } = build({
      connected: ['analytics'],
      analytics: {
        users: { current: 100, changePct: 5 },
        sessions: { current: 120, changePct: 3 },
        engagementRate: { current: 0.6, changePct: null },
        conversionTrackingConfigured: false,
        conversions: null,
      },
    });

    const brief = await service.brief('o1', 'p1');

    expect(brief).toMatch(/NOT MEASURED/);
    expect(brief).toMatch(/not zero conversions/i);
  });

  it('states that competitor activity cannot be dated', async () => {
    // The specific guard against the model blaming a competitor for a drop:
    // nothing records when a competitor published anything.
    const { service } = build({
      competitors: [{ domain: 'ifp.com', websiteId: 'w1' }],
      crawl: { id: 'j', pagesCrawled: 16, finishedAt: new Date('2026-08-20') },
    });

    const brief = await service.brief('o1', 'p1');

    expect(brief).toMatch(/cannot be dated/);
  });

  it('tells the model not to assert a cause', async () => {
    const { service } = build();

    const brief = await service.brief('o1', 'p1');

    expect(brief).toMatch(/Correlation is not cause/);
    expect(brief).toMatch(/Do not estimate, extrapolate/);
  });

  it('says when there is no earlier period rather than implying a flat trend', async () => {
    const { service } = build({
      connected: ['search_console'],
      search: {
        clicks: { current: 100, changePct: null },
        impressions: { current: 900, changePct: null },
        ctr: { current: 0.11, changePct: null },
        position: { current: 8.2, changePct: null },
        comparisonRange: null,
      },
    });

    const brief = await service.brief('o1', 'p1');

    expect(brief).toMatch(/No earlier period exists to compare against/);
  });

  it('stays compact', async () => {
    // Every extra thousand tokens is another thousand a model can pattern-match
    // a story out of.
    const { service } = build({
      connected: ['search_console', 'analytics'],
      search: {
        clicks: { current: 100, changePct: 5 },
        impressions: { current: 900, changePct: 2 },
        ctr: { current: 0.11, changePct: 1 },
        position: { current: 8.2, changePct: -3 },
        comparisonRange: { start: new Date(), end: new Date() },
      },
      analytics: {
        users: { current: 80, changePct: 1 },
        sessions: { current: 95, changePct: 2 },
        engagementRate: { current: 0.6, changePct: null },
        conversionTrackingConfigured: true,
        conversions: { current: 4, changePct: 10 },
      },
      competitors: [{ domain: 'ifp.com', websiteId: 'w1' }],
      crawl: { id: 'j', pagesCrawled: 44, finishedAt: new Date() },
    });

    const brief = await service.brief('o1', 'p1');

    expect(brief.length).toBeLessThan(4000);
  });
});
