import { SeoCompetitorsService } from './seo-competitors.service';

describe('SeoCompetitorsService — keyword gap matrix', () => {
  let prisma: any;
  let aiRouter: any;
  let webSearch: any;
  let service: SeoCompetitorsService;

  beforeEach(() => {
    prisma = {
      competitorDomain: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'c1', domain: 'countrydelight.in', name: 'Country Delight', label: null },
          { id: 'c2', domain: 'amul.com', name: 'Amul', label: null },
        ]),
      },
      project: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'p1',
          websites: [{ domain: 'milquufresh.in' }],
        }),
      },
      gscDailyMetric: { groupBy: jest.fn().mockResolvedValue([]) },
      page: { findMany: jest.fn().mockResolvedValue([]) },
    };
    aiRouter = { route: jest.fn() };
    webSearch = {
      isConfigured: jest.fn().mockReturnValue(true),
      search: jest.fn().mockResolvedValue({ sources: [], queriesRun: [] }),
    };
    service = new SeoCompetitorsService(prisma, aiRouter, webSearch);
  });

  it('builds rows from the client\'s real Search Console queries', async () => {
    prisma.gscDailyMetric.groupBy.mockResolvedValue([
      { query: 'milk delivery pune', _sum: { impressions: 4200 }, _avg: { position: 8.4 } },
      { query: 'cow milk subscription', _sum: { impressions: 900 }, _avg: { position: 34.2 } },
    ]);
    webSearch.search.mockResolvedValue({
      sources: [{ url: 'https://countrydelight.in/' }, { url: 'https://www.amul.com/' }],
      queriesRun: ['milk delivery pune'],
    });

    const matrix = await service.getSeoGapMatrix('p1');

    expect(matrix.keywordSource).toBe('search_console');
    expect(matrix.keywordMatrix.map((r) => r.keyword).sort()).toEqual([
      'cow milk subscription',
      'milk delivery pune',
    ]);

    const ranked = matrix.keywordMatrix.find((r) => r.keyword === 'milk delivery pune')!;
    // Real impressions, not an invented search volume.
    expect(ranked.impressions).toBe(4200);
    // Position 8.4 is ranking; 34.2 is not.
    expect(ranked.customerCoverage).toBe(true);
    expect(matrix.keywordMatrix.find((r) => r.keyword === 'cow milk subscription')!.customerCoverage).toBe(false);
  });

  it('reads competitor coverage off the live SERP, including subdomains', async () => {
    prisma.gscDailyMetric.groupBy.mockResolvedValue([
      { query: 'milk delivery pune', _sum: { impressions: 4200 }, _avg: { position: 40 } },
    ]);
    webSearch.search.mockResolvedValue({
      sources: [{ url: 'https://shop.countrydelight.in/pune' }],
      queriesRun: ['milk delivery pune'],
    });

    const matrix = await service.getSeoGapMatrix('p1');
    const row = matrix.keywordMatrix[0];

    expect(row.competitorCoverage['c1']).toBe(true);
    expect(row.competitorCoverage['c2']).toBe(false);
    expect(row.gapStatus).toBe('CUSTOMER_MISSING');
  });

  it('never guesses coverage when no search provider is configured', async () => {
    // The old service filled these with Math.random(), so a milk business was
    // told Amul ranks for "local seo software" — and differently on a reload.
    webSearch.isConfigured.mockReturnValue(false);
    prisma.gscDailyMetric.groupBy.mockResolvedValue([
      { query: 'milk delivery pune', _sum: { impressions: 4200 }, _avg: { position: 8 } },
    ]);

    const matrix = await service.getSeoGapMatrix('p1');
    const row = matrix.keywordMatrix[0];

    expect(matrix.competitorCoverageMeasured).toBe(false);
    expect(row.competitorCoverage['c1']).toBeNull();
    expect(row.competitorCoverage['c2']).toBeNull();
    expect(row.gapStatus).toBe('UNKNOWN');
    expect(matrix.notes.join(' ')).toContain('no live search provider');
    expect(webSearch.search).not.toHaveBeenCalled();
  });

  it('is the same table twice in a row', async () => {
    prisma.gscDailyMetric.groupBy.mockResolvedValue([
      { query: 'milk delivery pune', _sum: { impressions: 4200 }, _avg: { position: 8 } },
    ]);
    webSearch.search.mockResolvedValue({
      sources: [{ url: 'https://countrydelight.in/' }],
      queriesRun: ['milk delivery pune'],
    });

    const first = await service.getSeoGapMatrix('p1');
    const second = await service.getSeoGapMatrix('p1');

    expect(second.keywordMatrix).toEqual(first.keywordMatrix);
  });

  it('falls back to the site\'s own page topics when Search Console is not connected', async () => {
    prisma.gscDailyMetric.groupBy.mockResolvedValue([]);
    prisma.page.findMany.mockResolvedValue([
      { title: 'Fresh Cow Milk Delivery | MilQuu Fresh' },
      { title: 'Daily Paneer Subscription - MilQuu Fresh' },
    ]);

    const matrix = await service.getSeoGapMatrix('p1');

    expect(matrix.keywordSource).toBe('site_topics');
    expect(matrix.keywordMatrix.map((r) => r.keyword)).toContain('fresh cow milk delivery');
    // No Search Console means no impressions — and none are invented.
    expect(matrix.keywordMatrix.every((r) => r.impressions === null)).toBe(true);
  });

  it('returns an empty table that explains itself when nothing is known', async () => {
    const matrix = await service.getSeoGapMatrix('p1');

    expect(matrix.keywordMatrix).toHaveLength(0);
    expect(matrix.keywordSource).toBe('none');
    expect(matrix.notes[0]).toContain('Search Console');
  });

  it('ranks a contested high-impression gap above a quiet one', async () => {
    prisma.gscDailyMetric.groupBy.mockResolvedValue([
      { query: 'busy term', _sum: { impressions: 50000 }, _avg: { position: 60 } },
      { query: 'quiet term', _sum: { impressions: 5 }, _avg: { position: 60 } },
    ]);
    webSearch.search.mockImplementation((queries: string[]) =>
      Promise.resolve({
        sources: queries[0] === 'busy term' ? [{ url: 'https://countrydelight.in/' }] : [],
        queriesRun: queries,
      }),
    );

    const matrix = await service.getSeoGapMatrix('p1');

    expect(matrix.keywordMatrix[0].keyword).toBe('busy term');
  });
});
