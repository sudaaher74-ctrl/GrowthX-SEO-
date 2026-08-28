import { SearchConsoleInsightsService } from './search-console-insights.service';

/**
 * Every number on the Search Console dashboard comes from here. The failures
 * that matter are the quiet ones: a CTR averaged the wrong way disagrees with
 * what the customer sees in Search Console itself, and a trend computed
 * against a period we have no data for invents a collapse.
 */
describe('SearchConsoleInsightsService', () => {
  const day = (d: string) => new Date(`${d}T00:00:00.000Z`);

  const build = (totals: any[] = [], raw: any[] = []) => {
    const prisma = {
      gscDailyMetric: {
        findFirst: jest.fn(async ({ orderBy }: any) => {
          if (totals.length === 0) return null;
          const sorted = [...totals].sort((a, b) => a.date.getTime() - b.date.getTime());
          return orderBy?.date === 'desc' ? sorted[sorted.length - 1] : sorted[0];
        }),
        findMany: jest.fn(async ({ where }: any) =>
          totals.filter((r) => r.date >= where.date.gte && r.date <= where.date.lte),
        ),
        count: jest.fn(async ({ where }: any) =>
          totals.filter((r) => r.date >= where.date.gte && r.date <= where.date.lte).length,
        ),
      },
      $queryRawUnsafe: jest.fn().mockResolvedValue(raw),
    };
    return { prisma, service: new SearchConsoleInsightsService(prisma as any) };
  };

  describe('summary', () => {
    it('says nothing at all when no data has been synced', async () => {
      // Not zeroes. A dashboard of zeroes reads as "your traffic is nothing",
      // which is a claim; "we have not synced yet" is the truth.
      const { service } = build([]);
      expect(await service.summary('p1', 28)).toBeNull();
    });

    it('recomputes CTR over the totals rather than averaging daily CTR', async () => {
      // A day with 10 impressions and a day with 10,000 are not equal terms in
      // an average. Averaging them gives 25.5%; the real figure is 1.05%.
      const { service } = build([
        { date: day('2026-08-01'), clicks: 5, impressions: 10, ctr: 0.5, position: 3 },
        { date: day('2026-08-02'), clicks: 100, impressions: 10000, ctr: 0.01, position: 3 },
      ]);

      const summary = await service.summary('p1', 2);

      expect(summary!.clicks.current).toBe(105);
      expect(summary!.impressions.current).toBe(10010);
      expect(summary!.ctr.current).toBeCloseTo(105 / 10010, 6);
      expect(summary!.ctr.current).not.toBeCloseTo(0.255, 3);
    });

    it('weights average position by impressions', async () => {
      // Position 40 on 10 impressions must not drag a property ranking 2nd on
      // 10,000 down to an apparent 21st.
      const { service } = build([
        { date: day('2026-08-01'), clicks: 0, impressions: 10, ctr: 0, position: 40 },
        { date: day('2026-08-02'), clicks: 100, impressions: 10000, ctr: 0.01, position: 2 },
      ]);

      const summary = await service.summary('p1', 2);

      expect(summary!.position.current).toBeCloseTo((40 * 10 + 2 * 10000) / 10010, 4);
      expect(summary!.position.current).toBeLessThan(3);
    });

    it('marks position as a metric where lower is better', async () => {
      const { service } = build([{ date: day('2026-08-01'), clicks: 1, impressions: 10, ctr: 0.1, position: 5 }]);
      expect((await service.summary('p1', 1))!.position.lowerIsBetter).toBe(true);
    });

    it('computes the trend against the period immediately before', async () => {
      const { service } = build([
        { date: day('2026-08-01'), clicks: 100, impressions: 1000, ctr: 0.1, position: 5 },
        { date: day('2026-08-02'), clicks: 150, impressions: 1000, ctr: 0.15, position: 5 },
      ]);

      const summary = await service.summary('p1', 1);

      expect(summary!.clicks.current).toBe(150);
      expect(summary!.clicks.previous).toBe(100);
      expect(summary!.clicks.changePct).toBeCloseTo(50, 4);
    });

    it('shows no trend rather than a false one when there is no prior period', async () => {
      // A site connected this week has nothing to compare against. Treating
      // the absent period as zero renders "+∞%" or "-100%", both invented.
      const { service } = build([{ date: day('2026-08-01'), clicks: 100, impressions: 1000, ctr: 0.1, position: 5 }]);

      const summary = await service.summary('p1', 1);

      expect(summary!.comparisonRange).toBeNull();
      expect(summary!.clicks.changePct).toBeNull();
      expect(summary!.clicks.previous).toBeNull();
    });

    it('ends the window at the freshest day held, not today', async () => {
      // Search Console lags two to three days. Anchoring to today puts empty
      // days on the end of every chart and reads as a traffic cliff.
      const { service } = build([
        { date: day('2026-08-10'), clicks: 10, impressions: 100, ctr: 0.1, position: 5 },
        { date: day('2026-08-11'), clicks: 20, impressions: 100, ctr: 0.2, position: 5 },
      ]);

      const summary = await service.summary('p1', 2);

      expect(summary!.range.end).toEqual(day('2026-08-11'));
    });
  });

  describe('strikingDistance', () => {
    const rows = [
      { key: 'strong', clicks: 500, impressions: 10000, position: 2.1 },
      { key: 'nearly there', clicks: 40, impressions: 12000, position: 8.4 },
      { key: 'rare', clicks: 0, impressions: 3, position: 9.0 },
      { key: 'far off', clicks: 0, impressions: 5000, position: 61.0 },
    ].map((r) => ({ ...r, clicks: BigInt(r.clicks), impressions: BigInt(r.impressions) }));

    it('finds queries ranking just outside the clicks', async () => {
      const { service } = build([{ date: day('2026-08-01'), clicks: 1, impressions: 1, ctr: 1, position: 1 }], rows);

      const result = await service.strikingDistance('p1');

      expect(result.map((r) => r.key)).toEqual(['nearly there']);
    });

    it('ignores queries with too few impressions to mean anything', async () => {
      // Position 9 on three impressions is noise, and a list full of it hides
      // the one at position 9 on twelve thousand.
      const { service } = build([{ date: day('2026-08-01'), clicks: 1, impressions: 1, ctr: 1, position: 1 }], rows);

      const result = await service.strikingDistance('p1');

      expect(result.map((r) => r.key)).not.toContain('rare');
    });

    it('lets the position band be configured rather than fixing one', async () => {
      // The spec is explicit that no universal threshold should be baked in:
      // position 8 is below the fold on one query and near it on another.
      const { service } = build([{ date: day('2026-08-01'), clicks: 1, impressions: 1, ctr: 1, position: 1 }], rows);

      const wide = await service.strikingDistance('p1', { minPosition: 1, maxPosition: 70, minImpressions: 1000 });

      expect(wide.map((r) => r.key).sort()).toEqual(['far off', 'nearly there', 'strong']);
    });

    it('reports the criteria it used', async () => {
      // A number on a dashboard whose definition is invisible cannot be argued
      // with, and this one is a judgement call.
      const { service } = build([{ date: day('2026-08-01'), clicks: 1, impressions: 1, ctr: 1, position: 1 }], rows);

      const result = await service.strikingDistance('p1', { minPosition: 5, maxPosition: 15 });

      expect(result[0].criteria).toMatchObject({ minPosition: 5, maxPosition: 15 });
    });
  });

  describe('ctrOpportunities', () => {
    it('judges CTR against the position, not against a flat number', async () => {
      // 2% at position 2 is a problem; 2% at position 18 is normal. A flat
      // threshold flags the second and misses the point of the first.
      const rows = [
        { key: '/high-rank-low-ctr', clicks: BigInt(200), impressions: BigInt(10000), position: 2.0 },
        { key: '/low-rank-normal-ctr', clicks: BigInt(200), impressions: BigInt(10000), position: 18.0 },
      ];
      const { service } = build([{ date: day('2026-08-01'), clicks: 1, impressions: 1, ctr: 1, position: 1 }], rows);

      const result = await service.ctrOpportunities('p1');

      expect(result.map((r) => r.key)).toEqual(['/high-rank-low-ctr']);
    });

    it('ranks by the clicks the gap represents, not the size of the gap', async () => {
      // Five points missing on 200 impressions is ten clicks. One point
      // missing on 90,000 is nine hundred.
      const rows = [
        { key: '/small-big-gap', clicks: BigInt(2), impressions: BigInt(200), position: 2.0 },
        { key: '/large-small-gap', clicks: BigInt(11700), impressions: BigInt(90000), position: 2.0 },
      ];
      const { service } = build([{ date: day('2026-08-01'), clicks: 1, impressions: 1, ctr: 1, position: 1 }], rows);

      const result = await service.ctrOpportunities('p1', { minImpressions: 100 });

      expect(result[0].key).toBe('/large-small-gap');
      expect(result[0].estimatedMissedClicks).toBeGreaterThan(result[1].estimatedMissedClicks);
    });
  });

  describe('declining', () => {
    it('returns nothing when there is no earlier period to compare with', async () => {
      // Absent history is not "position zero". Treating it that way reports
      // every query on a newly connected site as having collapsed.
      const { service } = build(
        [{ date: day('2026-08-28'), clicks: 10, impressions: 1000, ctr: 0.01, position: 11 }],
        [{ key: 'q', clicks: BigInt(10), impressions: BigInt(1000), position: 11 }],
      );

      expect(await service.declining('p1', { days: 28 })).toEqual([]);
    });

    it('reports a real drop with both positions, and no cause', async () => {
      // Search Console cannot say why a ranking fell. Attaching a reason here
      // would be a guess presented as a finding.
      const totals = Array.from({ length: 4 }, (_, i) => ({
        date: day(`2026-08-0${i + 1}`),
        clicks: 10,
        impressions: 1000,
        ctr: 0.01,
        position: 8,
      }));
      const { prisma, service } = build(totals);
      prisma.$queryRawUnsafe
        .mockResolvedValueOnce([{ key: 'slipping', clicks: BigInt(5), impressions: BigInt(1000), position: 11.4 }])
        .mockResolvedValueOnce([{ key: 'slipping', clicks: BigInt(40), impressions: BigInt(1000), position: 6.2 }]);

      const result = await service.declining('p1', { days: 2, minDrop: 2 });

      expect(result[0]).toMatchObject({
        query: 'slipping',
        previousPosition: 6.2,
        currentPosition: 11.4,
      });
      expect(result[0].positionChange).toBeCloseTo(-5.2, 5);
      expect(Object.keys(result[0])).not.toContain('cause');
    });

    it('does not report a query that only just appeared', async () => {
      // No previous position is not a decline from infinity.
      const totals = Array.from({ length: 4 }, (_, i) => ({
        date: day(`2026-08-0${i + 1}`),
        clicks: 10,
        impressions: 1000,
        ctr: 0.01,
        position: 8,
      }));
      const { prisma, service } = build(totals);
      prisma.$queryRawUnsafe
        .mockResolvedValueOnce([{ key: 'brand new', clicks: BigInt(5), impressions: BigInt(9000), position: 30 }])
        .mockResolvedValueOnce([]);

      expect(await service.declining('p1', { days: 2 })).toEqual([]);
    });
  });
});
