import { DataFeedsService } from './data-feeds.service';

describe('DataFeedsService', () => {
  let prisma: any;
  let webSearch: any;
  let service: DataFeedsService;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.COMPETITOR_CRON_ENABLED;
    delete process.env.YOUTUBE_API_KEY;

    prisma = {
      gscDailyMetric: { count: jest.fn().mockResolvedValue(0), findFirst: jest.fn().mockResolvedValue(null) },
      competitorDomain: { count: jest.fn().mockResolvedValue(0), findFirst: jest.fn().mockResolvedValue(null) },
      competitorAccount: { count: jest.fn().mockResolvedValue(0) },
      competitorContent: { count: jest.fn().mockResolvedValue(0), findFirst: jest.fn().mockResolvedValue(null) },
    };
    webSearch = { isConfigured: jest.fn().mockReturnValue(true) };
    service = new DataFeedsService(prisma, webSearch);
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  const feed = (result: any, key: string) => result.feeds.find((f: any) => f.key === key);

  it('separates "switched off" from "nothing has arrived yet"', async () => {
    // The distinction the empty tabs cannot make on their own: a feed nobody
    // configured looks exactly like one that is simply quiet.
    webSearch.isConfigured.mockReturnValue(false);
    // Three competitors tracked, none of them crawled yet.
    prisma.competitorDomain.count.mockImplementation(({ where }: any) =>
      Promise.resolve(where.lastAnalyzedAt ? 0 : 3),
    );

    const result = await service.check('p1');

    expect(feed(result, 'web_search').state).toBe('off');
    expect(feed(result, 'web_search').fix).toContain('TAVILY_API_KEY');
    // Tracked but never crawled is 'empty', not 'off' — it may yet arrive.
    expect(feed(result, 'competitor_crawl').state).toBe('empty');
  });

  it('reports the crawl live once a competitor has actually been crawled', async () => {
    prisma.competitorDomain.count.mockImplementation(({ where }: any) =>
      Promise.resolve(where.lastAnalyzedAt ? 2 : 3),
    );
    prisma.competitorDomain.findFirst.mockResolvedValue({ lastAnalyzedAt: new Date('2026-09-04') });

    const result = await service.check('p1');
    const crawl = feed(result, 'competitor_crawl');

    expect(crawl.state).toBe('live');
    expect(crawl.detail).toContain('2 of 3');
  });

  it('reports Search Console as live with the row count behind it', async () => {
    prisma.gscDailyMetric.count.mockResolvedValue(1240);
    prisma.gscDailyMetric.findFirst.mockResolvedValue({ date: new Date('2026-09-03') });

    const result = await service.check('p1');
    const gsc = feed(result, 'search_console');

    expect(gsc.state).toBe('live');
    expect(gsc.detail).toContain('1,240');
    expect(gsc.lastDataAt).toContain('2026-09-03');
  });

  it('flags the cron kill switch above any count', async () => {
    // With the sweeps off, "2 of 3 crawled" is a fossil, not a status.
    process.env.COMPETITOR_CRON_ENABLED = 'false';
    prisma.competitorDomain.count.mockImplementation(({ where }: any) =>
      Promise.resolve(where.lastAnalyzedAt ? 2 : 3),
    );

    const result = await service.check('p1');
    const crawl = feed(result, 'competitor_crawl');

    expect(crawl.state).toBe('off');
    expect(crawl.fix).toContain('COMPETITOR_CRON_ENABLED');
  });

  it('says content must be added by hand when automated ingestion has no key', async () => {
    prisma.competitorAccount.count.mockResolvedValue(4);

    const result = await service.check('p1');
    const content = feed(result, 'competitor_content');

    expect(content.state).toBe('empty');
    expect(content.detail).toContain('4 social account(s) tracked');
    expect(content.fix).toContain('YOUTUBE_API_KEY');
  });

  it('never returns a key value, only whether one is present', async () => {
    process.env.YOUTUBE_API_KEY = 'super-secret-youtube-key-value-1234567890';
    webSearch.isConfigured.mockReturnValue(true);

    const result = await service.check('p1');

    expect(JSON.stringify(result)).not.toContain('super-secret');
  });

  it('reports every feed the tabs depend on', async () => {
    const result = await service.check('p1');

    expect(result.feeds.map((f: any) => f.key)).toEqual([
      'web_search',
      'search_console',
      'competitor_crawl',
      'competitor_content',
    ]);
    expect(result.feeds.every((f: any) => f.affects.length > 0)).toBe(true);
  });
});
