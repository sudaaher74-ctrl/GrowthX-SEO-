import { AnalyticsInsightsService } from './analytics-insights.service';

/**
 * Two things break GA4 integrations quietly. A property with no conversion
 * tracking gets reported as having zero conversions, which reads as a failing
 * business rather than an unconfigured tool. And the join to Search Console
 * matches nothing, because one side spells a page as a URL and the other as a
 * path — producing exactly the same "zero conversions everywhere".
 */
describe('AnalyticsInsightsService', () => {
  const day = (d: string) => new Date(`${d}T00:00:00.000Z`);

  const build = (totals: any[] = [], raw: any[][] = []) => {
    let rawCall = 0;
    const prisma = {
      ga4DailyMetric: {
        findFirst: jest.fn(async ({ orderBy }: any) => {
          if (totals.length === 0) return null;
          const sorted = [...totals].sort((a, b) => a.date.getTime() - b.date.getTime());
          return orderBy?.date === 'desc' ? sorted[sorted.length - 1] : sorted[0];
        }),
        findMany: jest.fn(async ({ where }: any) =>
          totals.filter((r) => r.date >= where.date.gte && r.date <= where.date.lte),
        ),
      },
      gscDailyMetric: { findFirst: jest.fn().mockResolvedValue({ date: day('2026-08-20') }) },
      $queryRaw: jest.fn(async () => raw[rawCall++] ?? []),
    };
    return { prisma, service: new AnalyticsInsightsService(prisma as any) };
  };

  const row = (over: any = {}) => ({
    date: day('2026-08-01'),
    users: 100,
    sessions: 120,
    engagementRate: 0.6,
    conversions: 5,
    revenue: 1000,
    ...over,
  });

  describe('summary', () => {
    it('says nothing rather than zero before anything is synced', async () => {
      const { service } = build([]);
      expect(await service.summary('p1', 28)).toBeNull();
    });

    it('reports conversions as unknown when the property does not track them', async () => {
      // The failure this exists to prevent: a working business shown as having
      // zero conversions because GA4 has no key events configured.
      const { service } = build([row({ conversions: null, revenue: null })]);

      const summary = await service.summary('p1', 1);

      expect(summary!.conversions).toBeNull();
      expect(summary!.revenue).toBeNull();
      expect(summary!.conversionTrackingConfigured).toBe(false);
      expect(summary!.revenueTrackingConfigured).toBe(false);
    });

    it('reports a real zero as a zero', async () => {
      // The other side of the same coin: a property that does track
      // conversions and genuinely had none must not read as unconfigured.
      const { service } = build([row({ conversions: 0 })]);

      const summary = await service.summary('p1', 1);

      expect(summary!.conversionTrackingConfigured).toBe(true);
      expect(summary!.conversions!.current).toBe(0);
    });

    it('weights engagement rate by sessions', async () => {
      // A day with 3 sessions must not count as much as one with 3,000.
      const { service } = build([
        row({ date: day('2026-08-01'), sessions: 3, engagementRate: 1.0 }),
        row({ date: day('2026-08-02'), sessions: 3000, engagementRate: 0.5 }),
      ]);

      const summary = await service.summary('p1', 2);

      expect(summary!.engagementRate.current).toBeCloseTo((1.0 * 3 + 0.5 * 3000) / 3003, 5);
      expect(summary!.engagementRate.current).toBeLessThan(0.51);
    });

    it('shows no trend when there is no earlier period', async () => {
      const { service } = build([row()]);

      const summary = await service.summary('p1', 1);

      expect(summary!.comparisonRange).toBeNull();
      expect(summary!.users.changePct).toBeNull();
    });
  });

  describe('pageValue — the search-to-outcome join', () => {
    const search = [{ page: 'https://example.com/services/kitchens', clicks: BigInt(400), impressions: BigInt(9000), position: 6.2 }];

    it('matches a Search Console URL to a GA4 path', async () => {
      // The two systems spell the same page differently. If this join fails
      // the whole feature reports every page as converting nobody.
      const { service } = build(
        [row()],
        [search, [{ landingPage: '/services/kitchens', sessions: BigInt(380), conversions: BigInt(21), revenue: 5000 }]],
      );

      const result = await service.pageValue('p1', 28);

      expect(result.rows[0]).toMatchObject({ clicks: 400, sessions: 380, conversions: 21 });
      expect(result.rows[0].conversionRate).toBeCloseTo(21 / 380, 6);
    });

    it('folds tracking-parameter variants into one page', async () => {
      // landingPagePlusQueryString splits a page across every utm that ever
      // pointed at it; left alone, one real page reads as several tiny ones.
      const { service } = build(
        [row()],
        [
          search,
          [
            { landingPage: '/services/kitchens', sessions: BigInt(200), conversions: BigInt(10), revenue: 100 },
            { landingPage: '/services/kitchens?utm_source=fb', sessions: BigInt(180), conversions: BigInt(11), revenue: 200 },
          ],
        ],
      );

      const result = await service.pageValue('p1', 28);

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].sessions).toBe(380);
      expect(result.rows[0].conversions).toBe(21);
    });

    it('treats a trailing slash and a case difference as the same page', async () => {
      const { service } = build(
        [row()],
        [search, [{ landingPage: '/Services/Kitchens/', sessions: BigInt(380), conversions: BigInt(21), revenue: 0 }]],
      );

      expect((await service.pageValue('p1', 28)).rows[0].sessions).toBe(380);
    });

    it('leaves a page with no analytics row as unknown, not zero', async () => {
      // A page can rank and take impressions without ever being a landing
      // page. Zero sessions there would be a claim, not a measurement.
      const { service } = build([row()], [search, []]);

      const result = await service.pageValue('p1', 28);

      expect(result.rows[0].sessions).toBeNull();
      expect(result.rows[0].conversions).toBeNull();
      expect(result.rows[0].conversionRate).toBeNull();
    });

    it('keeps conversions null when the property does not track them', async () => {
      const { service } = build(
        [row()],
        [search, [{ landingPage: '/services/kitchens', sessions: BigInt(380), conversions: null, revenue: null }]],
      );

      const result = await service.pageValue('p1', 28);

      expect(result.rows[0].sessions).toBe(380);
      expect(result.rows[0].conversions).toBeNull();
      expect(result.rows[0].conversionRate).toBeNull();
    });

    it('does not pretend to join when one side has never synced', async () => {
      // Search data with an empty conversions column reads as "these pages
      // convert nobody", which is the opposite of "we have no analytics".
      const { prisma, service } = build([], [search, []]);
      prisma.gscDailyMetric.findFirst.mockResolvedValue({ date: day('2026-08-20') });

      const result = await service.pageValue('p1', 28);

      expect(result).toEqual({ rows: [], hasSearchData: true, hasAnalyticsData: false });
    });

    it('ranks measured pages above unmeasured ones rather than sorting unknown as zero', async () => {
      const { service } = build(
        [row()],
        [
          [
            { page: 'https://example.com/big-traffic', clicks: BigInt(5000), impressions: BigInt(90000), position: 3 },
            { page: 'https://example.com/converts', clicks: BigInt(100), impressions: BigInt(2000), position: 8 },
          ],
          [{ landingPage: '/converts', sessions: BigInt(90), conversions: BigInt(30), revenue: 0 }],
        ],
      );

      const result = await service.pageValue('p1', 28);

      expect(result.rows[0].page).toContain('/converts');
    });
  });
});
