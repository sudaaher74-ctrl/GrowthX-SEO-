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

  describe('queriesWithMovement — the rankings table', () => {
    /** Four days of totals, so two-day windows have a "before" and an "after". */
    const totals = Array.from({ length: 4 }, (_, i) => ({
      date: day(`2026-08-0${i + 1}`),
      clicks: 10,
      impressions: 1000,
      ctr: 0.01,
      position: 8,
    }));
    const q = (key: string, clicks: number, impressions: number, position: number) => ({ key, clicks: BigInt(clicks), impressions: BigInt(impressions), position });

    it('says nothing at all before any data is synced', async () => {
      const { service } = build([]);
      expect(await service.queriesWithMovement('p1')).toBeNull();
    });

    it('reports a move up as positive and a move down as negative, against the window before', async () => {
      const { prisma, service } = build(totals);
      prisma.$queryRawUnsafe
        .mockResolvedValueOnce([q('climbing', 40, 900, 4.2), q('slipping', 10, 800, 9.5)])
        .mockResolvedValueOnce([q('climbing', 30, 700, 7.7), q('slipping', 30, 800, 5)]);

      const table = await service.queriesWithMovement('p1', { days: 2 });

      const byQuery = Object.fromEntries(table!.rows.map((r) => [r.query, r]));
      expect(byQuery.climbing.movement).toBeCloseTo(3.5, 5);
      expect(byQuery.climbing.previousPosition).toBe(7.7);
      expect(byQuery.slipping.movement).toBeCloseTo(-4.5, 5);
      expect(table).toMatchObject({ movedUp: 1, movedDown: 1 });
    });

    it('calls no movement when either window shows the search too few times for an average to mean anything', async () => {
      // Position 40 on three impressions is not a ranking anyone lost.
      const { prisma, service } = build(totals);
      prisma.$queryRawUnsafe
        .mockResolvedValueOnce([q('rare now', 0, 3, 40), q('rare before', 5, 900, 6)])
        .mockResolvedValueOnce([q('rare now', 5, 900, 6), q('rare before', 0, 4, 30)]);

      const table = await service.queriesWithMovement('p1', { days: 2 });

      expect(table!.rows.every((r) => r.movement === null)).toBe(true);
      expect(table).toMatchObject({ movedUp: 0, movedDown: 0 });
    });

    it('gives no movement at all, and no comparison range, when there is no earlier period stored', async () => {
      // Comparing with nothing would report every search as having arrived from position 0.
      const recent = totals.slice(2);
      const { prisma, service } = build(recent);
      prisma.$queryRawUnsafe.mockResolvedValueOnce([q('new', 12, 400, 5)]);

      const table = await service.queriesWithMovement('p1', { days: 2 });

      expect(table!.comparisonRange).toBeNull();
      expect(table!.rows[0]).toMatchObject({ query: 'new', movement: null, previousPosition: null });
      // Only the one query for the window that exists was asked of the database.
      expect(prisma.$queryRawUnsafe).toHaveBeenCalledTimes(1);
    });

    it('does not call a wobble of less than a place a move', async () => {
      const { prisma, service } = build(totals);
      prisma.$queryRawUnsafe
        .mockResolvedValueOnce([q('steady', 20, 900, 6.4)])
        .mockResolvedValueOnce([q('steady', 20, 900, 6.9)]);

      const table = await service.queriesWithMovement('p1', { days: 2 });

      expect(table!.rows[0].movement).toBeCloseTo(0.5, 5);
      expect(table).toMatchObject({ movedUp: 0, movedDown: 0 });
    });

    it('counts every search by where it stands, while returning only the ones clicked most', async () => {
      const { prisma, service } = build(totals);
      prisma.$queryRawUnsafe
        .mockResolvedValueOnce([
          q('a', 90, 900, 12), // page two
          q('b', 40, 900, 15), // page two
          q('c', 30, 900, 3.5), // page one
          q('d', 20, 900, 10), // page one
          q('e', 10, 900, 20), // page two, at its edge
          q('f', 5, 900, 20.5), // beyond
          // The best-placed search is the least clicked, so it is not among the rows returned.
          q('g', 1, 900, 2), // top 3
        ])
        .mockResolvedValueOnce([]);

      const table = await service.queriesWithMovement('p1', { days: 2, limit: 2 });

      expect(table).toMatchObject({ searches: 7, top3: 1, pageOne: 2, pageTwo: 3, beyond: 1 });
      expect(table!.rows.map((r) => r.query)).toEqual(['a', 'b']);
    });

    it('leaves out a search that was never actually shown', async () => {
      const { prisma, service } = build(totals);
      prisma.$queryRawUnsafe.mockResolvedValueOnce([q('ghost', 0, 0, 0), q('real', 3, 120, 8)]).mockResolvedValueOnce([]);

      const table = await service.queriesWithMovement('p1', { days: 2 });

      expect(table!.searches).toBe(1);
      expect(table!.rows.map((r) => r.query)).toEqual(['real']);
    });

    it('orders by clicks, then by how often the search was shown', async () => {
      const { prisma, service } = build(totals);
      prisma.$queryRawUnsafe
        .mockResolvedValueOnce([q('few shown', 5, 100, 5), q('many shown', 5, 900, 5), q('most clicked', 50, 800, 5)])
        .mockResolvedValueOnce([]);

      const table = await service.queriesWithMovement('p1', { days: 2 });

      expect(table!.rows.map((r) => r.query)).toEqual(['most clicked', 'many shown', 'few shown']);
    });

    it('computes the click-through rate from the totals, not from a stored ratio', async () => {
      const { prisma, service } = build(totals);
      prisma.$queryRawUnsafe.mockResolvedValueOnce([q('x', 25, 1000, 5)]).mockResolvedValueOnce([]);
      expect((await service.queriesWithMovement('p1', { days: 2 }))!.rows[0].ctr).toBeCloseTo(0.025, 6);
    });
  });
});
