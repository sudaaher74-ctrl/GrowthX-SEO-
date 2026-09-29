import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { SearchConsoleInsightsService } from '../integrations/google/search-console-insights.service';
import { GoogleWindow } from './google-overview.service';

export const BREAKDOWN_DIMENSIONS = ['country', 'device'] as const;
export type BreakdownDimension = (typeof BREAKDOWN_DIMENSIONS)[number];

export function parseBreakdownDimension(value: string | undefined): BreakdownDimension {
  if (!(BREAKDOWN_DIMENSIONS as readonly string[]).includes(value ?? '')) {
    throw new BadRequestException('dimension must be country or device.');
  }
  return value as BreakdownDimension;
}

const shift = (date: Date, days: number) => {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
};
const day = (date: Date) => date.toISOString().slice(0, 10);

/** Search Console clicks by country or device, from stored data. */
@Injectable()
export class GoogleBreakdownService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gsc: SearchConsoleInsightsService,
  ) {}

  /**
   * `rows` is null when nothing is stored for the dimension: workspaces synced
   * before country and device were fetched need one refresh, and an empty table
   * would read as "no traffic from anywhere".
   */
  // `dimension` is one of two whitelisted column names (parseBreakdownDimension), never caller text.
  async breakdown(projectId: string, days: GoogleWindow, dimension: BreakdownDimension) {
    const coverage = await this.gsc.coverage(projectId);
    if (!coverage) return { days, dimension, range: null, rows: null };
    const end = coverage.newestDate;
    const start = shift(end, -(days - 1));
    const grain = dimension.toUpperCase();

    const rows = await this.prisma.$queryRaw<{ key: string; clicks: bigint; impressions: bigint; position: number }[]>`
      SELECT ${Prisma.raw(dimension)} AS key,
             SUM(clicks)::bigint AS clicks,
             SUM(impressions)::bigint AS impressions,
             CASE WHEN SUM(impressions) > 0 THEN SUM(position * impressions) / SUM(impressions) ELSE 0 END AS position
        FROM "GscDailyMetric"
       WHERE "projectId" = ${projectId} AND grain = ${grain} AND date >= ${start} AND date <= ${end}
       GROUP BY 1
       ORDER BY clicks DESC, impressions DESC
       LIMIT 250`;
    const shaped = rows
      .filter((r) => r.key)
      .map((r) => ({
        key: r.key,
        clicks: Number(r.clicks),
        impressions: Number(r.impressions),
        ctr: Number(r.impressions) > 0 ? Number(r.clicks) / Number(r.impressions) : 0,
        position: r.position,
      }));
    return { days, dimension, range: { start: day(start), end: day(end) }, rows: shaped.length > 0 ? shaped : null };
  }
}
