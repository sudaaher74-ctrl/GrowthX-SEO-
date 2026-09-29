import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { SearchConsoleInsightsService } from '../integrations/google/search-console-insights.service';
import { GoogleWindow } from './google-overview.service';
import {
  CANNIBAL_MIN_PAGE_SHARE,
  CANNIBAL_MIN_QUERY_IMPRESSIONS,
  MIN_IMPRESSIONS,
  QueryAgg,
  QueryPageAgg,
  RISING_MIN_EXTRA_CLICKS,
  RISING_MIN_PCT,
  RISING_MIN_PLACES,
  findCannibalization,
  keywordMovement,
} from './keyword-movement';

const shift = (date: Date, days: number) => {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
};
const day = (date: Date) => date.toISOString().slice(0, 10);
const LIMIT = 100;

/** The Keywords view's extras: new and rising queries, and pages competing for one query. Reads stored data only. */
@Injectable()
export class GoogleKeywordsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gsc: SearchConsoleInsightsService,
  ) {}

  async keywords(projectId: string, days: GoogleWindow) {
    const coverage = await this.gsc.coverage(projectId);
    if (!coverage) return null;

    const end = coverage.newestDate;
    const start = shift(end, -(days - 1));
    const priorEnd = shift(start, -1);
    const priorStart = shift(priorEnd, -(days - 1));
    const priorDays = await this.prisma.gscDailyMetric.count({
      where: { projectId, grain: 'TOTAL', date: { gte: priorStart, lte: priorEnd } },
    });

    const [current, prior, queryPages] = await Promise.all([
      this.queries(projectId, start, end),
      priorDays > 0 ? this.queries(projectId, priorStart, priorEnd) : Promise.resolve(null),
      this.queryPages(projectId, start, end),
    ]);
    const moved = keywordMovement(current, prior);

    return {
      days,
      range: { start: day(start), end: day(end) },
      comparisonRange: prior ? { start: day(priorStart), end: day(priorEnd) } : null,
      new: moved ? moved.new.slice(0, LIMIT) : null,
      rising: moved ? moved.rising.slice(0, LIMIT) : null,
      cannibalization: queryPages.length > 0 ? findCannibalization(queryPages).slice(0, LIMIT) : null,
      rules: {
        minImpressions: MIN_IMPRESSIONS,
        risingMinExtraClicks: RISING_MIN_EXTRA_CLICKS,
        risingMinPct: RISING_MIN_PCT,
        risingMinPlaces: RISING_MIN_PLACES,
        cannibalMinQueryImpressions: CANNIBAL_MIN_QUERY_IMPRESSIONS,
        cannibalMinPageShare: CANNIBAL_MIN_PAGE_SHARE,
      },
    };
  }

  private async queries(projectId: string, start: Date, end: Date): Promise<QueryAgg[]> {
    const rows = await this.prisma.$queryRaw<{ key: string; clicks: bigint; impressions: bigint; position: number }[]>`
      SELECT query AS key,
             SUM(clicks)::bigint AS clicks,
             SUM(impressions)::bigint AS impressions,
             CASE WHEN SUM(impressions) > 0 THEN SUM(position * impressions) / SUM(impressions) ELSE 0 END AS position
        FROM "GscDailyMetric"
       WHERE "projectId" = ${projectId} AND grain = 'QUERY' AND date >= ${start} AND date <= ${end} AND query <> ''
       GROUP BY query`;
    return rows.map((r) => ({ key: r.key, clicks: Number(r.clicks), impressions: Number(r.impressions), position: r.position }));
  }

  private async queryPages(projectId: string, start: Date, end: Date): Promise<QueryPageAgg[]> {
    const rows = await this.prisma.$queryRaw<{ query: string; page: string; clicks: bigint; impressions: bigint; position: number }[]>`
      SELECT query, page,
             SUM(clicks)::bigint AS clicks,
             SUM(impressions)::bigint AS impressions,
             CASE WHEN SUM(impressions) > 0 THEN SUM(position * impressions) / SUM(impressions) ELSE 0 END AS position
        FROM "GscDailyMetric"
       WHERE "projectId" = ${projectId} AND grain = 'QUERY_PAGE' AND date >= ${start} AND date <= ${end}
             AND query <> '' AND page <> ''
       GROUP BY query, page`;
    return rows.map((r) => ({ query: r.query, page: r.page, clicks: Number(r.clicks), impressions: Number(r.impressions), position: r.position }));
  }
}
