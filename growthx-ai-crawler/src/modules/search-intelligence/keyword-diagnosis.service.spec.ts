import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { pathKey } from '../integrations/google/analytics-insights.service';
import { KeywordDiagnosisService, SEARCH_CONSOLE_REQUIRED_MESSAGE } from './keyword-diagnosis.service';

const DAY = 24 * 60 * 60 * 1000;
const PAGE = 'https://milquu.in/products/a2-milk';
const OTHER = 'https://milquu.in/blog/why-a2';

/**
 * The service decides which question can honestly be answered. With a paid
 * source of live Google results it reads the results page; without one it
 * answers from the customer's own Search Console and says so. The failure to
 * keep out is the old one: a customer told to "add credentials on Render" for a
 * page that could have been read from data they already own.
 */
describe('KeywordDiagnosisService', () => {
  interface Setup {
    live?: boolean;
    searchConsole?: boolean;
    analytics?: boolean;
    /** Search Console rows, aged in days from now, for the search "a2 milk delivery". */
    rows?: Array<{ grain: 'QUERY' | 'QUERY_PAGE'; ageDays: number; page?: string; clicks: number; impressions: number; position: number }>;
    html?: string;
    domain?: string;
    visits?: Map<string, { sessions: number; engagementRate: number | null; conversions: number | null }> | null;
  }

  const PAGE_HTML =
    '<html><head><title>A2 Cow Milk 1L | Milquu</title></head><body><h1>A2 Cow Milk</h1><p>Fresh milk from indigenous cows.</p></body></html>';

  const RANKS_CURRENT = (over: Partial<Setup> = {}) => [
    { grain: 'QUERY' as const, ageDays: 10, clicks: 12, impressions: 300, position: 8.4 },
    { grain: 'QUERY_PAGE' as const, ageDays: 10, page: PAGE, clicks: 12, impressions: 300, position: 8.4 },
    ...(over.rows ?? []),
  ];
  const RANKS_BEFORE = [
    { grain: 'QUERY' as const, ageDays: 40, clicks: 30, impressions: 320, position: 5 },
    { grain: 'QUERY_PAGE' as const, ageDays: 40, page: PAGE, clicks: 30, impressions: 320, position: 5 },
  ];

  function build(setup: Setup = {}) {
    const connections: Record<string, boolean> = { search_console: setup.searchConsole ?? true, analytics: setup.analytics ?? true };
    const rows = setup.rows ?? [...RANKS_CURRENT(), ...RANKS_BEFORE];
    const prisma = {
      integration: {
        findUnique: jest.fn(async ({ where }: any) => (connections[where.projectId_provider.provider] ? { selectedResourceId: 'chosen' } : null)),
      },
      website: { findFirst: jest.fn(async () => ({ id: 'w1', domain: setup.domain ?? 'milquu.in', url: 'https://milquu.in' })) },
      crawlJob: { findFirst: jest.fn(async () => null) },
      gscDailyMetric: {
        findMany: jest.fn(async ({ where }: any) =>
          rows
            .filter((r) => r.grain === where.grain)
            .filter((r) => {
              const at = Date.now() - r.ageDays * DAY;
              return at >= where.date.gte.getTime() && (where.date.lt === undefined || at < where.date.lt.getTime());
            })
            .map((r) => ({ page: r.page ?? null, clicks: r.clicks, impressions: r.impressions, position: r.position })),
        ),
      },
      urlIndexInspection: { findFirst: jest.fn(async () => null) },
      keywordDiagnosis: { create: jest.fn(async () => ({ id: 'saved-1', createdAt: new Date('2026-09-29T05:00:00Z') })) },
    };
    const dataforseo = { isConfigured: jest.fn(() => setup.live ?? false) };
    const ranks = {
      checkKeyword: jest.fn(async () => ({
        snapshot: { id: 'snap-1', ownUrl: PAGE, ownPosition: 4, checkedAt: new Date('2026-09-29T05:00:00Z') },
        results: { organic: [], features: [], questions: [], keyword: 'a2 milk delivery' },
        market: { country: 'India', language: 'en', source: 'DEFAULT' },
      })),
    };
    const fetcher = { fetchPage: jest.fn(async () => ({ statusCode: 200, html: setup.html ?? PAGE_HTML })) };
    const analytics = {
      visitsByPage: jest.fn(async () =>
        setup.visits === undefined ? new Map([[pathKey(PAGE), { sessions: 2031, engagementRate: 0.71, conversions: 90 }]]) : setup.visits,
      ),
    };
    const service = new KeywordDiagnosisService(prisma as any, dataforseo as any, ranks as any, fetcher as any, analytics as any);
    return { service, prisma, dataforseo, ranks, fetcher, analytics };
  }

  it('asks for Search Console, in the customer’s words, when it has neither that nor live results', async () => {
    const { service, prisma, fetcher } = build({ searchConsole: false });

    const failure = await service.run('p1', { keyword: 'a2 milk delivery' }).catch((e) => e);

    expect(failure).toBeInstanceOf(ServiceUnavailableException);
    expect(failure.message).toBe(SEARCH_CONSOLE_REQUIRED_MESSAGE);
    expect(failure.message).not.toMatch(/dataforseo|render|credentials/i);
    expect(prisma.website.findFirst).not.toHaveBeenCalled();
    expect(fetcher.fetchPage).not.toHaveBeenCalled();
  });

  it('refuses a search too short to mean anything, before doing any work', async () => {
    const { service, prisma } = build();
    await expect(service.run('p1', { keyword: ' a ' })).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.integration.findUnique).not.toHaveBeenCalled();
  });

  describe('from Search Console', () => {
    it('never looks at Google’s results, and stores the diagnosis without a results snapshot', async () => {
      const { service, ranks, prisma } = build();

      const result: any = await service.run('p1', { keyword: 'a2 milk delivery' });

      expect(ranks.checkKeyword).not.toHaveBeenCalled();
      expect(result).toMatchObject({ id: 'saved-1', mode: 'SEARCH_CONSOLE', market: null, pageUrl: PAGE });
      expect(prisma.keywordDiagnosis.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ projectId: 'p1', keyword: 'a2 milk delivery', pageUrl: PAGE, serpSnapshotId: null }),
      });
      // Nothing that would need to have seen the results page.
      expect(result.results).toMatchObject({ intent: null, dominantFormat: null, features: [], questions: [], top: [] });
      expect(result.comparison).toMatchObject({ competitors: [], typical: null });
    });

    it('takes the verdict from the page’s average position, and finds the slip against the 28 days before', async () => {
      const { service } = build();

      const result: any = await service.run('p1', { keyword: 'a2 milk delivery' });

      expect(result.verdict).toBe('PAGE_ONE');
      expect(result.verdictText).toBe('Averaging position 8.4, on page one but below the top three where most clicks go.');
      expect(result.results.position).toBe(8.4);
      expect(result.reasons.map((r: any) => r.code)).toContain('POSITION_SLIPPING');
      expect(result.searchConsole).toMatchObject({ clicks: 12, impressions: 300, position: 8.4, previous: { impressions: 320, position: 5 } });
    });

    it('reads the page it is diagnosing, and says which words of the search its title lacks', async () => {
      const { service, fetcher } = build();

      const result: any = await service.run('p1', { keyword: 'a2 milk delivery' });

      expect(fetcher.fetchPage).toHaveBeenCalledTimes(1);
      expect(fetcher.fetchPage).toHaveBeenCalledWith(PAGE);
      const title = result.reasons.find((r: any) => r.code === 'KEYWORD_NOT_IN_TITLE');
      expect(title.evidence).toContainEqual(expect.objectContaining({ label: 'Words of the search missing from it', value: 'delivery' }));
    });

    it('is honest about what it did not see', async () => {
      const { service } = build();
      const result: any = await service.run('p1', { keyword: 'a2 milk delivery' });
      expect(result.confidence.level).toBe('MEDIUM');
      expect(result.confidence.missing.join(' ')).toMatch(/live results are not part of this check/);
    });

    it('adds what Analytics saw on the page when it is connected', async () => {
      const { service, analytics } = build();
      const result: any = await service.run('p1', { keyword: 'a2 milk delivery' });
      expect(analytics.visitsByPage).toHaveBeenCalledWith('p1', 28);
      expect(result.visits).toEqual({ days: 28, sessions: 2031, engagementRate: 0.71, conversions: 90 });
    });

    it('leaves visits empty, without asking Analytics, when it is not connected', async () => {
      const { service, analytics } = build({ analytics: false });
      const result: any = await service.run('p1', { keyword: 'a2 milk delivery' });
      expect(analytics.visitsByPage).not.toHaveBeenCalled();
      expect(result.visits).toBeNull();
    });

    it('leaves visits empty when Analytics recorded none for this page', async () => {
      const { service } = build({ visits: new Map([['/somewhere-else', { sessions: 5, engagementRate: 0.5, conversions: 0 }]]) });
      expect(((await service.run('p1', { keyword: 'a2 milk delivery' })) as any).visits).toBeNull();
    });

    it('diagnoses the page it is given, and says when Google shows another of the customer’s pages instead', async () => {
      const rows = [
        ...RANKS_CURRENT(),
        { grain: 'QUERY_PAGE' as const, ageDays: 10, page: OTHER, clicks: 40, impressions: 900, position: 6.1 },
        { grain: 'QUERY' as const, ageDays: 10, clicks: 40, impressions: 900, position: 6.1 },
      ];
      const { service, fetcher } = build({ rows });

      const result: any = await service.run('p1', { keyword: 'a2 milk delivery', pageUrl: PAGE });

      expect(fetcher.fetchPage).toHaveBeenCalledWith(PAGE);
      expect(result.pageUrl).toBe(PAGE);
      expect(result.results.otherPageOfYours).toMatchObject({ url: OTHER });
      expect(result.reasons.map((r: any) => r.code)).toContain('OTHER_PAGE_PREFERRED');
    });

    it('picks the page Google shows most when none is named', async () => {
      const rows = [
        { grain: 'QUERY' as const, ageDays: 10, clicks: 40, impressions: 900, position: 6.1 },
        { grain: 'QUERY_PAGE' as const, ageDays: 10, page: OTHER, clicks: 40, impressions: 900, position: 6.1 },
        { grain: 'QUERY_PAGE' as const, ageDays: 10, page: PAGE, clicks: 1, impressions: 30, position: 20 },
      ];
      const { service } = build({ rows });
      expect(((await service.run('p1', { keyword: 'a2 milk delivery' })) as any).pageUrl).toBe(OTHER);
    });

    it('asks which page to diagnose when Google has not shown any for the search, rather than guessing', async () => {
      const { service, fetcher } = build({ rows: [] });

      const failure = await service.run('p1', { keyword: 'a2 milk delivery' }).catch((e) => e);

      expect(failure).toBeInstanceOf(BadRequestException);
      expect(failure.message).toMatch(/has not shown any of your pages for "a2 milk delivery" in the last 28 days/);
      expect(failure.message).toMatch(/Choose the page that should rank for it/);
      expect(fetcher.fetchPage).not.toHaveBeenCalled();
    });

    it('still diagnoses a named page that Google has not shown for the search', async () => {
      const { service } = build({ rows: [] });

      const result: any = await service.run('p1', { keyword: 'a2 milk delivery', pageUrl: PAGE });

      expect(result.verdict).toBe('NOT_IN_TOP_20');
      expect(result.verdictText).toBe('Google has not shown this page for this search in the last 28 days.');
      expect(result.reasons.map((r: any) => r.code)).toContain('NO_IMPRESSIONS');
    });

    it('refuses a page that is not on the customer’s site', async () => {
      const { service, fetcher } = build();
      await expect(service.run('p1', { keyword: 'a2 milk delivery', pageUrl: 'https://rival.example/page' })).rejects.toThrow(
        /is not on milquu\.in\. Choose one of your own pages/,
      );
      expect(fetcher.fetchPage).not.toHaveBeenCalled();
    });

    it('says a page that could not be read could not be read, and is less sure', async () => {
      const { service, fetcher } = build();
      fetcher.fetchPage.mockResolvedValue({ statusCode: 0, html: '', errorMessage: 'timed out' } as any);

      const result: any = await service.run('p1', { keyword: 'a2 milk delivery' });

      expect(result.confidence.missing.join(' ')).toMatch(/your page could not be read \(timed out\)/);
      expect(result.comparison.yours.read).toBe(false);
    });
  });

  describe('with live results', () => {
    it('still reads Google’s results when the platform has them, and keeps the answer live', async () => {
      const { service, ranks } = build({ live: true, searchConsole: false });

      const result: any = await service.run('p1', { keyword: 'a2 milk delivery' });

      expect(ranks.checkKeyword).toHaveBeenCalledWith('p1', 'a2 milk delivery');
      expect(result).toMatchObject({ mode: 'LIVE_RESULTS', market: { country: 'India' } });
    });

    it('adds the page’s visits to a live diagnosis too', async () => {
      const { service } = build({ live: true });
      expect(((await service.run('p1', { keyword: 'a2 milk delivery' })) as any).visits).toMatchObject({ sessions: 2031 });
    });
  });
});
