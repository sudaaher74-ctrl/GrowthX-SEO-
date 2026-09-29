import { BadRequestException } from '@nestjs/common';
import { GoogleOverviewService, parseGoogleWindow } from './google-overview.service';

/**
 * Wiring of the Google section's read model: which project every query is
 * scoped to, how Search Console URLs meet Analytics paths, and what an
 * unmeasured source turns into.
 */
describe('GoogleOverviewService', () => {
  const NEWEST = new Date('2026-09-26T00:00:00Z');

  const organic = (over: any = {}) => ({
    totals: { sessions: 100, activeUsers: 80, newUsers: 70, engagedSessions: 60, engagementRate: 0.6, averageEngagementTimeSec: 30, views: 200, keyEvents: 4, revenue: null },
    previous: { sessions: 50, activeUsers: 40, newUsers: 35, engagedSessions: 25, engagementRate: 0.5, averageEngagementTimeSec: 20, views: 90, keyEvents: 2, revenue: null },
    previousStart: '2026-08-01',
    previousEnd: '2026-08-28',
    daily: [
      { date: '2026-09-27', sessions: 3, users: 2, keyEvents: 0, revenue: null },
      { date: '2026-09-28', sessions: 5, users: 4, keyEvents: 1, revenue: null },
    ],
    landingPages: [
      // Analytics reports a path; Search Console a full URL with a trailing slash.
      { page: '/milk', users: 30, sessions: 40, engagedSessions: 30, engagementRate: 0.75, averageEngagementTimeSec: 40, views: 60, keyEvents: 0, revenue: null },
      { page: '/only-in-ga', users: 5, sessions: 6, engagedSessions: 3, engagementRate: 0.5, averageEngagementTimeSec: 10, views: 6, keyEvents: 1, revenue: null },
    ],
    ...over,
  });

  const build = (opts: { gscData?: boolean; organic?: any; priorRows?: any[] } = {}) => {
    const queries: { sql: string; values: any[] }[] = [];
    const prisma: any = {
      integration: {
        findMany: jest.fn().mockResolvedValue([
          { provider: 'search_console', status: 'CONNECTED', statusMessage: null, selectedResourceId: 'sc-domain:x.com', selectedResourceName: 'x.com', googleAccountEmail: 'a@x.com', lastSyncedAt: new Date('2026-09-29T04:00:00Z') },
        ]),
      },
      urlIndexInspection: { findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn().mockResolvedValue(null) },
      page: { findMany: jest.fn().mockResolvedValue([]) },
      website: { findFirst: jest.fn().mockResolvedValue(null) },
      link: { count: jest.fn().mockResolvedValue(0) },
      $queryRaw: jest.fn().mockImplementation(async (strings: TemplateStringsArray, ...values: any[]) => {
        const sql = strings.join('?');
        queries.push({ sql, values });
        if (sql.includes('GROUP BY page, date')) {
          return [{ page: 'https://x.com/milk/', date: new Date('2026-09-26'), clicks: BigInt(7) }];
        }
        if (sql.includes('GROUP BY page')) {
          const start: Date = values[1];
          // The earlier window starts before the current one.
          return start < new Date('2026-08-15')
            ? (opts.priorRows ?? [{ page: 'https://x.com/milk/', clicks: BigInt(60), impressions: BigInt(1000), wpos: 8000 }])
            : [
                { page: 'https://x.com/milk/', clicks: BigInt(30), impressions: BigInt(2000), wpos: 20000 },
                { page: 'https://x.com/milk', clicks: BigInt(10), impressions: BigInt(500), wpos: 5000 },
              ];
        }
        return [];
      }),
    };
    const gsc: any = {
      coverage: jest.fn().mockResolvedValue(opts.gscData === false ? null : { newestDate: NEWEST, oldestDate: new Date('2026-06-01') }),
      summary: jest.fn().mockResolvedValue(
        opts.gscData === false
          ? null
          : {
              range: { start: new Date('2026-09-01'), end: NEWEST },
              comparisonRange: { start: new Date('2026-08-04'), end: new Date('2026-08-31') },
              clicks: { current: 40, previous: 60, change: -20, changePct: -33.3 },
              impressions: { current: 2500, previous: 1000, change: 1500, changePct: 150 },
              ctr: { current: 0.016, previous: 0.06, change: -0.044, changePct: -73 },
              position: { current: 10, previous: 8, change: 2, changePct: 25, lowerIsBetter: true },
              daysWithData: 26,
            },
      ),
      timeseries: jest.fn().mockResolvedValue([
        { date: new Date('2026-09-25'), clicks: 1, impressions: 90, ctr: 0.011, position: 9 },
        { date: new Date('2026-09-26'), clicks: 2, impressions: 100, ctr: 0.02, position: 10 },
      ]),
      ctrOpportunities: jest.fn().mockResolvedValue([{ estimatedMissedClicks: 30 }]),
      declining: jest.fn().mockResolvedValue([{}, {}]),
      queriesForPage: jest.fn().mockResolvedValue([]),
    };
    const reports: any = {
      read: jest.fn().mockResolvedValue({
        state: 'READY',
        message: null,
        range: '28d',
        propertyName: 'milquufresh',
        googleAccountEmail: 'a@x.com',
        lastSyncedAt: '2026-09-29T08:00:00.000Z',
        lastError: null,
        data: { startDate: '2026-09-01', endDate: '2026-09-28', empty: false, organic: opts.organic === null ? undefined : (opts.organic ?? organic()) },
      }),
    };
    return { service: new GoogleOverviewService(prisma, gsc, reports), prisma, gsc, reports, queries };
  };

  describe('parseGoogleWindow', () => {
    it('accepts only the windows the top bar offers', () => {
      expect(parseGoogleWindow(undefined)).toBe(28);
      expect(parseGoogleWindow('90')).toBe(90);
      expect(() => parseGoogleWindow('14')).toThrow(BadRequestException);
    });
  });

  describe('overview', () => {
    it('reads every source for the project it was asked about', async () => {
      const { service, prisma, gsc, reports } = build();
      await service.overview('p1', 28);
      expect(prisma.integration.findMany.mock.calls[0][0].where.projectId).toBe('p1');
      expect(gsc.summary).toHaveBeenCalledWith('p1', 28);
      expect(reports.read).toHaveBeenCalledWith('p1', '28d');
    });

    it('builds eight KPIs from real figures, with real sparklines and honest gaps', async () => {
      const { service } = build();
      const { kpis } = await service.overview('p1', 28);
      expect(kpis.map((k) => k.key)).toEqual(['clicks', 'impressions', 'ctr', 'position', 'organicUsers', 'organicSessions', 'engagementRate', 'keyEvents']);
      const byKey = Object.fromEntries(kpis.map((k) => [k.key, k]));
      expect(byKey.clicks.delta?.kind).toBe('pct');
      expect(byKey.clicks.delta?.value).toBeCloseTo(-33.33, 1);
      expect(byKey.ctr.delta?.kind).toBe('pts');
      expect(byKey.position).toMatchObject({ lowerIsBetter: true, delta: { kind: 'places', value: 2 } });
      expect(byKey.organicSessions.delta).toEqual({ kind: 'pct', value: 100 });
      expect(byKey.clicks.sparkline).toEqual([1, 2]);
      // Engagement rate is not stored per day, so no line is drawn for it.
      expect(byKey.engagementRate.sparkline).toBeNull();
    });

    it('shows Search Console as missing, not zero, when nothing has been fetched', async () => {
      const { service } = build({ gscData: false });
      const result = await service.overview('p1', 28);
      expect(result.sources.searchConsole).toMatchObject({ connected: true, state: 'NEVER_SYNCED', hasData: false });
      const clicks = result.kpis.find((k) => k.key === 'clicks')!;
      expect(clicks.value).toBeNull();
      expect(clicks.note).toMatch(/Search Console/);
      expect(result.funnel[0].value).toBeNull();
    });

    it('asks for a refresh when the stored report predates organic figures', async () => {
      const { service } = build({ organic: null });
      const result = await service.overview('p1', 28);
      expect(result.sources.analytics.needsRefresh).toBe(true);
      const sessions = result.kpis.find((k) => k.key === 'organicSessions')!;
      expect(sessions.value).toBeNull();
      expect(sessions.note).toMatch(/no organic data/i);
    });

    it('writes the plain-language headline from the numbers', async () => {
      const { service } = build();
      const { headlines } = await service.overview('p1', 28);
      expect(headlines[0].id).toBe('visibility-outpaces-clicks');
      expect(headlines[0].text).toContain('click-through rate fell from 6.0% to 1.6%');
    });
  });

  describe('pages', () => {
    it('joins Search Console URLs to Analytics paths however they are spelled', async () => {
      const { service } = build();
      const result = await service.pages('p1', 28);
      const milk = result.rows.find((r) => r.key === '/milk')!;
      // Both spellings of the URL fold into one page: 30 + 10 clicks.
      expect(milk.gsc).toMatchObject({ clicks: 40, impressions: 2500, previousClicks: 60 });
      expect(milk.gsc!.clicksChangePct).toBeCloseTo(-33.33, 1);
      expect(milk.ga).toMatchObject({ sessions: 40, keyEvents: 0 });
      expect(milk.url).toBe('https://x.com/milk/'); // the address with the most clicks
      expect(milk.trend).toHaveLength(28); // one real value per day of the window
    });

    it('keeps a page Analytics saw and Search Console did not, without inventing search figures', async () => {
      const { service } = build();
      const result = await service.pages('p1', 28);
      const only = result.rows.find((r) => r.key === '/only-in-ga')!;
      expect(only.gsc).toBeNull();
      expect(only.ga?.sessions).toBe(6);
    });

    it('puts a page in the segments its numbers earn, and reports the counts', async () => {
      const { service } = build();
      const result = await service.pages('p1', 28);
      const milk = result.rows.find((r) => r.key === '/milk')!;
      expect(milk.segments).toEqual(expect.arrayContaining(['top-traffic', 'declining', 'ranking-opportunity', 'high-traffic-low-conversion']));
      // 1.6% at position 10 is above 60% of the typical 2.5%, so it is not a click-through problem.
      expect(milk.segments).not.toContain('high-impressions-low-ctr');
      expect(result.segmentCounts.declining).toBe(1);
    });

    it('filters to one segment and rejects an unknown one', async () => {
      const { service } = build();
      const only = await service.pages('p1', 28, { segment: 'top-converting' });
      expect(only.rows.map((r) => r.key)).toEqual(['/only-in-ga']);
      await expect(service.pages('p1', 28, { segment: 'nonsense' })).rejects.toThrow(BadRequestException);
    });

    it('gives no comparison when the earlier window holds no data', async () => {
      const { service } = build({ priorRows: [] });
      const milk = (await service.pages('p1', 28)).rows.find((r) => r.key === '/milk')!;
      expect(milk.gsc!.previousClicks).toBeNull();
      expect(milk.gsc!.clicksChangePct).toBeNull();
      expect(milk.segments).not.toContain('declining');
    });

    it('scopes every database query to the project', async () => {
      const { service, queries } = build();
      await service.pages('p1', 28);
      expect(queries.length).toBeGreaterThan(0);
      for (const q of queries) expect(q.values[0]).toBe('p1');
    });

    it('still lists Analytics pages when Search Console has nothing', async () => {
      const { service } = build({ gscData: false });
      const result = await service.pages('p1', 28);
      expect(result.sources.searchConsole.hasData).toBe(false);
      expect(result.rows.every((r) => r.gsc === null)).toBe(true);
      expect(result.rows.length).toBe(2);
    });
  });

  describe('pageDetail', () => {
    it('requires a page', async () => {
      await expect(build().service.pageDetail('p1', 28, '')).rejects.toThrow(BadRequestException);
    });

    it('assembles search, visits, funnel and diagnosis for one page', async () => {
      const { service, gsc } = build();
      const d = await service.pageDetail('p1', 28, 'https://x.com/milk/');
      expect(d.found).toBe(true);
      expect(d.gsc).toMatchObject({ clicks: 40, previousClicks: 60 });
      expect(d.ga).toMatchObject({ sessions: 40, engagementRate: 0.75 });
      expect(gsc.queriesForPage).toHaveBeenCalledWith('p1', 'https://x.com/milk/', { days: 28, limit: 25 });
      expect(d.funnel.map((s) => s.key)).toEqual(['impressions', 'clicks', 'sessions', 'engaged', 'keyEvents', 'revenue']);
      expect(d.diagnosis.map((f) => f.id)).toEqual(expect.arrayContaining(['clicks-down', 'no-conversions']));
    });

    it('reports a page nothing knows about as not found', async () => {
      const { service } = build();
      const d = await service.pageDetail('p1', 28, '/never-seen');
      expect(d.found).toBe(false);
      expect(d.gsc).toBeNull();
      expect(d.ga).toBeNull();
    });
  });
});
