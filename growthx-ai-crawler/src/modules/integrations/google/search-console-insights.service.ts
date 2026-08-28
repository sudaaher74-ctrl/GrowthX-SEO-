import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

/**
 * What the stored Search Console data means.
 *
 * Split from the connector on purpose: that one talks to Google, this one only
 * reads the local tables. Every engine that wants search data reads through
 * here, which is what stops fifteen engines each calling the Google API.
 *
 * Two rules run through all of it. Trends are computed from two real stored
 * periods, never estimated — a percentage nobody can trace back to two numbers
 * is worse than no percentage. And where a period has no data, the answer is
 * that there is no data, not zero: a site connected last week has no
 * comparison for the week before, and rendering that as "-100%" invents a
 * collapse that did not happen.
 */
@Injectable()
export class SearchConsoleInsightsService {
  constructor(private readonly prisma: PrismaService) {}

  /** The freshest and oldest day held, so the UI can say what it actually has. */
  async coverage(projectId: string) {
    const [newest, oldest] = await Promise.all([
      this.prisma.gscDailyMetric.findFirst({
        where: { projectId, grain: 'TOTAL' },
        orderBy: { date: 'desc' },
        select: { date: true },
      }),
      this.prisma.gscDailyMetric.findFirst({
        where: { projectId, grain: 'TOTAL' },
        orderBy: { date: 'asc' },
        select: { date: true },
      }),
    ]);
    if (!newest || !oldest) return null;
    return { newestDate: newest.date, oldestDate: oldest.date };
  }

  /**
   * Headline metrics for a window, against the window immediately before it.
   *
   * Clicks and impressions add up. CTR and position do not: averaging daily
   * CTR treats a day with nine impressions the same as one with ninety
   * thousand, and averaging position does the same. Both are therefore
   * recomputed over the totals — CTR from summed clicks and impressions,
   * position weighted by impressions — which is how Search Console itself
   * reports them.
   */
  async summary(projectId: string, days: number) {
    const coverage = await this.coverage(projectId);
    if (!coverage) return null;

    const end = coverage.newestDate;
    const start = shift(end, -(days - 1));
    const priorEnd = shift(start, -1);
    const priorStart = shift(priorEnd, -(days - 1));

    const [current, prior] = await Promise.all([
      this.totalsBetween(projectId, start, end),
      this.totalsBetween(projectId, priorStart, priorEnd),
    ]);

    return {
      range: { start, end },
      // Null rather than a made-up baseline when the prior window predates the
      // data. The UI shows the number with no arrow instead of a false trend.
      comparisonRange: prior.days > 0 ? { start: priorStart, end: priorEnd } : null,
      clicks: metric(current.clicks, prior.days > 0 ? prior.clicks : null),
      impressions: metric(current.impressions, prior.days > 0 ? prior.impressions : null),
      ctr: metric(current.ctr, prior.days > 0 ? prior.ctr : null),
      // Lower is better, and the client should not have to know that.
      position: { ...metric(current.position, prior.days > 0 ? prior.position : null), lowerIsBetter: true },
      daysWithData: current.days,
    };
  }

  private async totalsBetween(projectId: string, start: Date, end: Date) {
    const rows = await this.prisma.gscDailyMetric.findMany({
      where: { projectId, grain: 'TOTAL', date: { gte: start, lte: end } },
      select: { clicks: true, impressions: true, position: true },
    });

    const clicks = rows.reduce((sum, r) => sum + r.clicks, 0);
    const impressions = rows.reduce((sum, r) => sum + r.impressions, 0);
    const weightedPosition = rows.reduce((sum, r) => sum + r.position * r.impressions, 0);

    return {
      days: rows.length,
      clicks,
      impressions,
      ctr: impressions > 0 ? clicks / impressions : 0,
      position: impressions > 0 ? weightedPosition / impressions : 0,
    };
  }

  /** The daily series behind the chart. */
  async timeseries(projectId: string, days: number) {
    const coverage = await this.coverage(projectId);
    if (!coverage) return [];
    const start = shift(coverage.newestDate, -(days - 1));

    const rows = await this.prisma.gscDailyMetric.findMany({
      where: { projectId, grain: 'TOTAL', date: { gte: start, lte: coverage.newestDate } },
      orderBy: { date: 'asc' },
      select: { date: true, clicks: true, impressions: true, ctr: true, position: true },
    });
    return rows;
  }

  /**
   * Top queries or pages over a window, re-aggregated across days.
   *
   * Stored per day, so a query's window total is the sum of its days — and its
   * position is the impression-weighted average of them, for the same reason
   * as above.
   */
  async top(
    projectId: string,
    grain: 'QUERY' | 'PAGE',
    options: { days: number; limit?: number } = { days: 28 },
  ) {
    const coverage = await this.coverage(projectId);
    if (!coverage) return [];
    const start = shift(coverage.newestDate, -(options.days - 1));
    const field = grain === 'QUERY' ? 'query' : 'page';

    const rows = await this.prisma.$queryRawUnsafe<
      { key: string; clicks: bigint; impressions: bigint; position: number }[]
    >(
      `SELECT "${field}" AS key,
              SUM(clicks)::bigint       AS clicks,
              SUM(impressions)::bigint  AS impressions,
              CASE WHEN SUM(impressions) > 0
                   THEN SUM(position * impressions) / SUM(impressions)
                   ELSE 0 END           AS position
         FROM "GscDailyMetric"
        WHERE "projectId" = $1 AND grain = $2 AND date >= $3 AND date <= $4 AND "${field}" <> ''
        GROUP BY "${field}"
        ORDER BY clicks DESC, impressions DESC
        LIMIT $5`,
      projectId,
      grain,
      start,
      coverage.newestDate,
      Math.min(options.limit ?? 50, 500),
    );

    return rows.map((row) => ({
      key: row.key,
      clicks: Number(row.clicks),
      impressions: Number(row.impressions),
      ctr: Number(row.impressions) > 0 ? Number(row.clicks) / Number(row.impressions) : 0,
      position: row.position,
    }));
  }

  /**
   * Queries ranking just outside where clicks happen.
   *
   * The position band is a parameter, not a constant. The spec is explicit
   * that no fixed universal threshold should be baked in, and it genuinely
   * differs: on a query where the first three results are ads and a map pack,
   * position 8 is far below the fold; on a bare informational query it is
   * near it.
   *
   * A minimum impression count matters as much as the band. A query at
   * position 9 with four impressions is noise, and a list of those buries the
   * one at position 9 with twelve thousand.
   */
  async strikingDistance(
    projectId: string,
    options: { days?: number; minPosition?: number; maxPosition?: number; minImpressions?: number; limit?: number } = {},
  ) {
    const { days = 28, minPosition = 4, maxPosition = 20, minImpressions = 100, limit = 25 } = options;
    const candidates = await this.top(projectId, 'QUERY', { days, limit: 500 });

    return candidates
      .filter((row) => row.position >= minPosition && row.position <= maxPosition && row.impressions >= minImpressions)
      // Most impressions first: that is the size of the audience already
      // seeing this result and not clicking, which is the whole opportunity.
      .sort((a, b) => b.impressions - a.impressions)
      .slice(0, limit)
      .map((row) => ({
        ...row,
        criteria: { minPosition, maxPosition, minImpressions, days },
      }));
  }

  /**
   * Pages seen often and clicked rarely for where they rank.
   *
   * "Low CTR" only means anything against a position: 2% at position 3 is bad
   * and 2% at position 18 is normal. The expectation curve below is a coarse
   * approximation of how click-through falls with rank, used only to decide
   * whether a page is worth showing — it is deliberately not presented to the
   * customer as a benchmark, because it is not measured from their industry.
   */
  async ctrOpportunities(
    projectId: string,
    options: { days?: number; minImpressions?: number; limit?: number } = {},
  ) {
    const { days = 28, minImpressions = 200, limit = 25 } = options;
    const pages = await this.top(projectId, 'PAGE', { days, limit: 500 });

    return pages
      .filter((page) => page.impressions >= minImpressions)
      .map((page) => {
        const expected = expectedCtr(page.position);
        return { ...page, expectedCtr: expected, shortfall: expected - page.ctr };
      })
      .filter((page) => page.shortfall > 0.01)
      // Ranked by the clicks the gap represents, not by the size of the gap:
      // a page missing one point of CTR on ninety thousand impressions is
      // worth more than one missing five points on two hundred.
      .sort((a, b) => b.shortfall * b.impressions - a.shortfall * a.impressions)
      .slice(0, limit)
      .map((page) => ({
        ...page,
        estimatedMissedClicks: Math.round(page.shortfall * page.impressions),
      }));
  }

  /**
   * Queries whose position got materially worse between two equal windows.
   *
   * Reports the movement and nothing else. Why a ranking fell is not knowable
   * from Search Console alone, and attaching a cause here would be a guess
   * dressed as a finding.
   */
  async declining(
    projectId: string,
    options: { days?: number; minImpressions?: number; minDrop?: number; limit?: number } = {},
  ) {
    const { days = 28, minImpressions = 100, minDrop = 2, limit = 25 } = options;
    const coverage = await this.coverage(projectId);
    if (!coverage) return [];

    const end = coverage.newestDate;
    const start = shift(end, -(days - 1));
    const priorEnd = shift(start, -1);
    const priorStart = shift(priorEnd, -(days - 1));

    // No prior window means no comparison. Treating absent history as
    // position zero would report every query as having collapsed.
    const priorDays = await this.prisma.gscDailyMetric.count({
      where: { projectId, grain: 'TOTAL', date: { gte: priorStart, lte: priorEnd } },
    });
    if (priorDays === 0) return [];

    const [current, prior] = await Promise.all([
      this.aggregateQueries(projectId, start, end),
      this.aggregateQueries(projectId, priorStart, priorEnd),
    ]);
    const priorByQuery = new Map(prior.map((row) => [row.key, row]));

    return current
      .filter((row) => row.impressions >= minImpressions)
      .map((row) => {
        const before = priorByQuery.get(row.key);
        if (!before) return null;
        // Position counts down, so a rise in the number is a fall in rank.
        const drop = row.position - before.position;
        return drop >= minDrop
          ? {
              query: row.key,
              previousPosition: before.position,
              currentPosition: row.position,
              positionChange: -drop,
              previousClicks: before.clicks,
              currentClicks: row.clicks,
              impressions: row.impressions,
            }
          : null;
      })
      .filter((row): row is NonNullable<typeof row> => row !== null)
      .sort((a, b) => a.positionChange - b.positionChange)
      .slice(0, limit);
  }

  private async aggregateQueries(projectId: string, start: Date, end: Date) {
    return this.prisma.$queryRawUnsafe<{ key: string; clicks: bigint; impressions: bigint; position: number }[]>(
      `SELECT query AS key,
              SUM(clicks)::bigint      AS clicks,
              SUM(impressions)::bigint AS impressions,
              CASE WHEN SUM(impressions) > 0
                   THEN SUM(position * impressions) / SUM(impressions)
                   ELSE 0 END          AS position
         FROM "GscDailyMetric"
        WHERE "projectId" = $1 AND grain = 'QUERY' AND date >= $2 AND date <= $3 AND query <> ''
        GROUP BY query`,
      projectId,
      start,
      end,
    ).then((rows) =>
      rows.map((row) => ({
        key: row.key,
        clicks: Number(row.clicks),
        impressions: Number(row.impressions),
        position: row.position,
      })),
    );
  }

  /**
   * Which page answers a query, and how well.
   *
   * The QUERY_PAGE grain, which is what makes "this search term lands on this
   * page" answerable — and what a GA4 conversion later attaches to.
   */
  async queriesForPage(projectId: string, page: string, options: { days?: number; limit?: number } = {}) {
    const { days = 28, limit = 25 } = options;
    const coverage = await this.coverage(projectId);
    if (!coverage) return [];
    const start = shift(coverage.newestDate, -(days - 1));

    const rows = await this.prisma.$queryRawUnsafe<
      { key: string; clicks: bigint; impressions: bigint; position: number }[]
    >(
      `SELECT query AS key,
              SUM(clicks)::bigint      AS clicks,
              SUM(impressions)::bigint AS impressions,
              CASE WHEN SUM(impressions) > 0
                   THEN SUM(position * impressions) / SUM(impressions)
                   ELSE 0 END          AS position
         FROM "GscDailyMetric"
        WHERE "projectId" = $1 AND grain = 'QUERY_PAGE' AND page = $2
          AND date >= $3 AND date <= $4
        GROUP BY query
        ORDER BY clicks DESC
        LIMIT $5`,
      projectId,
      page,
      start,
      coverage.newestDate,
      Math.min(limit, 200),
    );

    return rows.map((row) => ({
      query: row.key,
      clicks: Number(row.clicks),
      impressions: Number(row.impressions),
      ctr: Number(row.impressions) > 0 ? Number(row.clicks) / Number(row.impressions) : 0,
      position: row.position,
    }));
  }
}

/** A value with its change, or with no change when there is nothing to compare. */
function metric(current: number, previous: number | null) {
  if (previous === null || previous === 0) {
    return { current, previous, change: null, changePct: null };
  }
  return {
    current,
    previous,
    change: current - previous,
    changePct: ((current - previous) / previous) * 100,
  };
}

/**
 * Roughly what click-through looks like at a given rank.
 *
 * Used only to decide which pages are worth surfacing, never shown as a
 * target. Real curves vary enormously by query intent, device and how much of
 * the page Google fills before the first organic result, so treating these as
 * benchmarks would be false precision.
 */
function expectedCtr(position: number): number {
  if (position <= 1) return 0.28;
  if (position <= 2) return 0.15;
  if (position <= 3) return 0.11;
  if (position <= 5) return 0.07;
  if (position <= 8) return 0.035;
  if (position <= 10) return 0.025;
  if (position <= 20) return 0.01;
  return 0.005;
}

function shift(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}
