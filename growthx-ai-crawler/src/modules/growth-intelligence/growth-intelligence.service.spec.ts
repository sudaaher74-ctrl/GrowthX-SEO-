import { NotFoundException } from '@nestjs/common';
import { GrowthIntelligenceService } from './growth-intelligence.service';

/**
 * The service joins stored data from every source. These specs run it against
 * in-memory fakes for a dairy-delivery site and check the join, the honesty
 * about missing sources, and the tenant boundary.
 */
function build(over: { connected?: string[]; noGaps?: boolean; noAi?: boolean; noCrawl?: boolean } = {}) {
  const connected = over.connected ?? ['search_console', 'analytics', 'business_profile'];
  const prisma: any = {
    project: { findFirst: jest.fn(async ({ where }: any) => (where.organizationId === 'org_1' ? { id: where.id } : null)) },
    integration: { findMany: jest.fn().mockResolvedValue(connected.map((provider) => ({ provider }))) },
    crawlJob: { findFirst: jest.fn().mockResolvedValue(over.noCrawl ? null : { id: 'job1', finishedAt: new Date() }) },
    keywordGapSnapshot: {
      findMany: jest.fn().mockResolvedValue(
        over.noGaps
          ? []
          : [
              {
                competitorDomain: 'rival.com',
                rows: [{ keyword: 'buffalo milk delivery navi mumbai', competitorPosition: 3, competitorUrl: 'https://rival.com/buffalo', ownPosition: 15 }],
              },
            ],
      ),
    },
    promptCheck: {
      findMany: jest
        .fn()
        .mockResolvedValueOnce(over.noAi ? [] : Array.from({ length: 10 }, (_, i) => ({ cited: i === 0, citedUrl: null, competitorsCited: ['rival.com'] })))
        .mockResolvedValueOnce(Array.from({ length: 10 }, (_, i) => ({ cited: i < 5 }))),
    },
    gbpLocationProfile: { findFirst: jest.fn().mockResolvedValue({ websiteUri: 'https://milquufresh.in/' }) },
    gbpDailyMetric: {
      aggregate: jest
        .fn()
        .mockResolvedValueOnce({ _sum: { value: 80 }, _count: { _all: 20 } })
        .mockResolvedValueOnce({ _sum: { value: 100 }, _count: { _all: 20 } })
        .mockResolvedValueOnce({ _sum: { value: 10 }, _count: { _all: 20 } })
        .mockResolvedValueOnce({ _sum: { value: 30 }, _count: { _all: 20 } }),
    },
    page: {
      findMany: jest.fn().mockResolvedValue([
        { id: 'p1', url: 'https://milquufresh.in/buffalo-milk', title: 'Buffalo milk', metaDescription: null, h1: ['Buffalo milk'], wordCount: 180, pageType: 'PRODUCT', indexability: 'INDEXABLE' },
      ]),
    },
    link: { groupBy: jest.fn().mockResolvedValue([{ targetUrl: 'https://milquufresh.in/buffalo-milk', _count: { _all: 1 } }]) },
    schema: { findMany: jest.fn().mockResolvedValue([]) },
    issue: {
      findMany: jest
        .fn()
        .mockResolvedValueOnce([
          { id: 'i1', pageId: 'p1', issueType: 'MISSING_META_DESCRIPTION', severity: 'MEDIUM', description: 'Meta description is missing.', recommendation: 'Add one.', evidence: null, aiFixAvailable: true },
        ])
        .mockResolvedValueOnce([]),
    },
  };
  const search: any = {
    summary: jest.fn().mockResolvedValue({ clicks: { current: 500, previous: 900, change: -400, changePct: -44 } }),
    top: jest.fn().mockResolvedValue([{ key: 'https://milquufresh.in/buffalo-milk', clicks: 20, impressions: 4000, ctr: 0.005, position: 14 }]),
    queriesForPage: jest.fn().mockResolvedValue([{ query: 'buffalo milk delivery navi mumbai', clicks: 10, impressions: 2500, ctr: 0.004, position: 15 }]),
  };
  const analytics: any = {
    summary: jest.fn().mockResolvedValue({
      engagementRate: { current: 0.6 },
      conversionTrackingConfigured: true,
      conversions: { current: 40, previous: 44, change: -4, changePct: -9 },
    }),
    visitsByPage: jest.fn().mockResolvedValue(
      new Map([
        ['/buffalo-milk', { sessions: 120, engagementRate: 0.3, conversions: 0 }],
        ['/', { sessions: 300, engagementRate: 0.25, conversions: 0 }],
      ]),
    ),
  };
  return { service: new GrowthIntelligenceService(prisma, search, analytics), prisma, search, analytics };
}

describe('GrowthIntelligenceService.report', () => {
  it('answers with one combined diagnosis per page, across every source', async () => {
    const { service } = build();
    const r = await service.report('org_1', 'proj_1');

    expect(r.pages).toHaveLength(1);
    const page = r.pages[0];
    expect(page.path).toBe('/buffalo-milk');
    expect(page.corroboratingSources).toEqual(expect.arrayContaining(['GSC', 'GA4', 'CRAWL', 'COMPETITORS']));
    expect(page.findings.map((f) => f.type)).toEqual(
      expect.arrayContaining(['LOW_CTR', 'PAGE_TWO_RANKING', 'LOW_ENGAGEMENT', 'TRAFFIC_NO_CONVERSION', 'COMPETITOR_RANKS_HIGHER', 'MISSING_META_DESCRIPTION']),
    );
    expect(r.answer.summary).toMatch(/\/buffalo-milk/);
    expect(r.estimatedExtraClicks).toBeGreaterThan(0);
  });

  it('resolves every piece of evidence a finding cites', async () => {
    const { service } = build();
    const r = await service.report('org_1', 'proj_1');
    for (const f of [...r.problems, ...r.opportunities, ...r.risks]) {
      expect(f.evidenceIds.length).toBeGreaterThan(0);
      for (const id of f.evidenceIds) expect(r.evidence[id]).toBeDefined();
    }
  });

  it('raises risks from measured change, and links the Business Profile to its weak landing page', async () => {
    const { service } = build();
    const r = await service.report('org_1', 'proj_1');
    const types = [...r.risks, ...r.opportunities].map((f) => f.type);
    expect(types).toEqual(expect.arrayContaining(['ORGANIC_CLICKS_DECLINE', 'GBP_WEBSITE_CLICKS_DECLINE', 'GBP_CALLS_DECLINE', 'AI_VISIBILITY_DECLINE', 'GBP_LANDING_WEAK']));
    expect(r.problems.map((f) => f.type)).toContain('AI_VISIBILITY_LOW');
  });

  it('names what is not measured instead of guessing', async () => {
    const { service } = build({ connected: ['search_console'], noGaps: true, noAi: true, noCrawl: true });
    const r = await service.report('org_1', 'proj_1');
    const missing = r.notMeasured.map((m) => m.source);
    expect(missing).toEqual(expect.arrayContaining(['CRAWL', 'COMPETITORS', 'AI_VISIBILITY', 'GBP']));
    expect(r.pages[0].notMeasured.length).toBeGreaterThan(0);
  });

  it("refuses another organization's project without confirming it exists", async () => {
    const { service, search } = build();
    await expect(service.report('org_2', 'proj_1')).rejects.toBeInstanceOf(NotFoundException);
    expect(search.summary).not.toHaveBeenCalled();
  });

  it('never reads a token: the integration lookup selects the provider only', async () => {
    const { service, prisma } = build();
    await service.report('org_1', 'proj_1');
    expect(prisma.integration.findMany.mock.calls[0][0].select).toEqual({ provider: true });
  });
});

describe('GrowthIntelligenceService.page', () => {
  it('diagnoses a single page on demand and is tenant-scoped', async () => {
    const { service } = build();
    const d = await service.page('org_1', 'proj_1', 'https://milquufresh.in/buffalo-milk');
    expect(d.path).toBe('/buffalo-milk');
    await expect(service.page('org_2', 'proj_1', 'https://milquufresh.in/buffalo-milk')).rejects.toBeInstanceOf(NotFoundException);
  });
});
