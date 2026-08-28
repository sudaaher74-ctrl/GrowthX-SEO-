import { ExecutiveSummaryService } from './executive-summary.service';

/**
 * The page this feeds displayed "Growth Score 78", "Organic Traffic +18%" and
 * "Estimated Opportunity ₹2.4L/mo" as string literals — identical for every
 * customer, presented as their own results. These tests are about the property
 * that prevents a repeat: nothing carries a number without a source, and every
 * absence carries a reason.
 */
describe('ExecutiveSummaryService', () => {
  const build = (options: { connected?: string[]; search?: any; analytics?: any; crawl?: any } = {}) => {
    const prisma = {
      integration: {
        findMany: jest.fn().mockResolvedValue((options.connected ?? []).map((provider) => ({ provider }))),
      },
      crawlJob: { findFirst: jest.fn().mockResolvedValue(options.crawl ?? null) },
      issue: { count: jest.fn().mockResolvedValue(3) },
      growthOpportunity: { count: jest.fn().mockResolvedValue(7) },
    };
    const search = { summary: jest.fn().mockResolvedValue(options.search ?? null) };
    const analytics = { summary: jest.fn().mockResolvedValue(options.analytics ?? null) };
    return { prisma, service: new ExecutiveSummaryService(prisma as any, search as any, analytics as any) };
  };

  it('never returns a number without saying where it came from', async () => {
    const { service } = build({
      connected: ['search_console'],
      search: { clicks: { current: 12482, changePct: 18 }, impressions: { current: 384291, changePct: 12 } },
    });

    const summary = await service.summary('o1', 'p1');

    expect(summary.headline.searchClicks).toEqual({
      state: 'MEASURED',
      value: 12482,
      changePct: 18,
      source: 'Google Search Console',
    });
  });

  it('says what to connect instead of showing a zero', async () => {
    // A zero here is a claim about the business. "Not connected" is a fact
    // about us.
    const { service } = build();

    const summary = await service.summary('o1', 'p1');

    expect(summary.headline.searchClicks.state).toBe('NOT_CONNECTED');
    expect(summary.headline.sessions.state).toBe('NOT_CONNECTED');
    expect(JSON.stringify(summary.headline)).not.toMatch(/"value":0/);
  });

  it('separates not-connected from connected-but-never-synced', async () => {
    // Different problems with different fixes; one message for both sends the
    // customer to reconnect something that is already connected.
    const { service } = build({ connected: ['search_console'] });

    const summary = await service.summary('o1', 'p1');

    expect(summary.headline.searchClicks.state).toBe('NO_DATA');
    expect((summary.headline.searchClicks as any).reason).toMatch(/synced/i);
  });

  it('distinguishes untracked conversions from no conversions', async () => {
    // The single most damaging confusion available: reporting a working
    // business as converting nobody because GA4 has no key events set up.
    const { service } = build({
      connected: ['analytics'],
      analytics: {
        sessions: { current: 5000, changePct: 4 },
        conversions: null,
        conversionTrackingConfigured: false,
      },
    });

    const summary = await service.summary('o1', 'p1');

    expect(summary.headline.conversions.state).toBe('NO_DATA');
    expect((summary.headline.conversions as any).reason).toMatch(/key events/i);
  });

  it('reports a genuine zero as measured', async () => {
    const { service } = build({
      connected: ['analytics'],
      analytics: {
        sessions: { current: 5000, changePct: 4 },
        conversions: { current: 0, changePct: null },
        conversionTrackingConfigured: true,
      },
    });

    const summary = await service.summary('o1', 'p1');

    expect(summary.headline.conversions).toMatchObject({ state: 'MEASURED', value: 0 });
  });

  it('carries no blended score and no currency figure', async () => {
    // Both were on the page this replaces. A composite over unrelated
    // measurements is a judgement dressed as an observation, and a rupee
    // amount needs revenue attached to a page, which nothing here has.
    const { service } = build({
      connected: ['search_console', 'analytics'],
      search: { clicks: { current: 100, changePct: 5 }, impressions: { current: 900, changePct: 2 } },
      analytics: {
        sessions: { current: 80, changePct: 1 },
        conversions: { current: 4, changePct: 0 },
        conversionTrackingConfigured: true,
      },
    });

    const summary = await service.summary('o1', 'p1');

    const text = JSON.stringify(summary);
    expect(text).not.toMatch(/₹|growthScore|growth_score/i);
    expect(summary).not.toHaveProperty('growthScore');
  });

  it('counts real issues from the last crawl rather than scoring them', async () => {
    const { service } = build({ crawl: { id: 'j1', pagesCrawled: 386, finishedAt: new Date() } });

    const summary = await service.summary('o1', 'p1');

    expect(summary.siteHealth).toMatchObject({ state: 'MEASURED', pagesCrawled: 386, criticalIssues: 3 });
  });

  it('says the site has not been crawled rather than reporting zero pages', async () => {
    const { service } = build();

    const summary = await service.summary('o1', 'p1');

    expect(summary.siteHealth.state).toBe('NO_DATA');
    expect((summary.siteHealth as any).reason).toMatch(/not been crawled/i);
  });

  it('survives one source failing', async () => {
    // A broken Search Console must not blank the whole dashboard.
    const { service } = build({ connected: ['search_console', 'analytics'] });
    (service as any).search.summary = jest.fn().mockRejectedValue(new Error('down'));

    const summary = await service.summary('o1', 'p1');

    expect(summary.headline.searchClicks.state).toBe('NO_DATA');
    expect(summary.openOpportunities.total).toBe(7);
  });
});
