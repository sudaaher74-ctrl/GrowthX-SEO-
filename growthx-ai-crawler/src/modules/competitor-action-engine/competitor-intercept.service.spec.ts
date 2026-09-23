import { CompetitorInterceptService } from './competitor-intercept.service';

/**
 * Every figure on the intercept screen has to trace back to a crawl or to the
 * customer's own Search Console. This service used to fill the gaps: a rank of
 * #28 for any topic the customer covered, visits projected at an assumed 32%
 * click-through, defects asserted for pages nobody had crawled, and blueprint
 * copy claiming "sub-second TTFB" on the customer's behalf.
 */
describe('CompetitorInterceptService', () => {
  const weakPage = {
    id: 'pg1',
    url: 'https://rival.com/cold-storage-solutions',
    title: 'Cold Storage Solutions',
    metaDescription: null,
    h1: ['Cold Storage Solutions'],
    h2: [],
    wordCount: 240,
    responseTimeMs: 1900,
    pageType: 'SERVICE',
    schemas: [],
    issues: [],
  };

  function build(overrides: { ourPages?: any[]; gscRows?: any[]; pageFindFirst?: any } = {}) {
    const prisma: any = {
      website: { findFirst: jest.fn().mockResolvedValue({ id: 'w1', domain: 'client.com' }) },
      competitorDomain: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'c1', domain: 'rival.com', name: 'Rival', label: null, websiteId: 'w2' },
        ]),
      },
      page: {
        findMany: jest
          .fn()
          // our pages, then the competitor's
          .mockResolvedValueOnce(overrides.ourPages ?? [])
          .mockResolvedValueOnce([weakPage]),
        findFirst: jest.fn().mockResolvedValue(overrides.pageFindFirst ?? null),
      },
      gscDailyMetric: { groupBy: jest.fn().mockResolvedValue(overrides.gscRows ?? []) },
    };
    return { service: new CompetitorInterceptService(prisma), prisma };
  }

  it('reports a covered topic without inventing a rank for it', async () => {
    const { service } = build({ ourPages: [{ title: 'Cold Storage Solutions | Client', h1: [], url: 'x' }] });

    const { opportunities } = await service.getInterceptOpportunities('p1');

    expect(opportunities).toHaveLength(1);
    expect(opportunities[0].coveredByUs).toBe(true);
    expect(opportunities[0].customerRank).toBeNull();
    expect(opportunities[0].searchVolume).toBeNull();
  });

  it('sums measured impressions instead of projecting visits', async () => {
    const { service } = build({
      gscRows: [{ query: 'cold storage solutions', _sum: { impressions: 1000 }, _avg: { position: 7.4 } }],
    });

    const { scoreboard, opportunities } = await service.getInterceptOpportunities('p1');

    expect(opportunities[0].searchVolume).toBe(1000);
    expect(opportunities[0].customerRank).toBe(7);
    expect(scoreboard.searchImpressionsAtStake).toBe(1000);
  });

  it('names no top defect when there are no competitor pages to judge', async () => {
    const { service, prisma } = build();
    prisma.competitorDomain.findMany.mockResolvedValue([]);

    const { scoreboard } = await service.getInterceptOpportunities('p1');

    expect(scoreboard.topDefectArea).toBeNull();
  });

  it('claims no defects in an on-demand blueprint for a page nobody crawled', async () => {
    const { service } = build();

    const blueprint = await service.generateBlueprint('p1', {
      keyword: 'cold storage',
      competitorDomain: 'rival.com',
      competitorUrl: 'https://rival.com/never-crawled',
    });

    expect(blueprint.attackThesis).toContain('no weakness is claimed');
    expect(blueprint).not.toHaveProperty('estimatedTimeToDisplaceDays');
  });

  it('cites the defects measured on a crawled page in an on-demand blueprint', async () => {
    const { service } = build({ pageFindFirst: weakPage });

    const blueprint = await service.generateBlueprint('p1', {
      keyword: 'cold storage',
      competitorDomain: 'rival.com',
      competitorUrl: weakPage.url,
    });

    expect(blueprint.attackThesis).toContain('thin content depth (240 words)');
    expect(blueprint.attackThesis).toContain('slow server response (1900ms)');
  });

  it('leaves the publishable answers for the customer to write', async () => {
    const { service } = build({ pageFindFirst: weakPage });

    const blueprint = await service.generateBlueprint('p1', { keyword: 'cold storage', competitorDomain: 'rival.com' });
    const schema = JSON.parse(blueprint.jsonLdSchema);

    expect(schema.mainEntity.every((q: any) => q.acceptedAnswer.text === '[Your answer]')).toBe(true);
    expect(blueprint.deliverableCode).not.toMatch(/sub-second|within 14 to 28 days/i);
    expect(blueprint.targetH1).toContain(String(new Date().getFullYear()));
  });
});
