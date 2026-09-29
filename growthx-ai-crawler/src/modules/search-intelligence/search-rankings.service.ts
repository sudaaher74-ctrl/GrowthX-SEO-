import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AnalyticsInsightsService, pathKey } from '../integrations/google/analytics-insights.service';
import { SearchConsoleInsightsService } from '../integrations/google/search-console-insights.service';
import { analyticsConnected, searchConsoleConnected } from './search-console-facts';

export interface SearchRankingRow {
  query: string;
  /** Average position over the window, weighted by impressions. */
  position: number;
  previousPosition: number | null;
  /** Positions gained (positive) or lost (negative) against the window before; null when not measurable. */
  movement: number | null;
  clicks: number;
  impressions: number;
  ctr: number;
  /** The page Google showed most for this search. */
  page: string | null;
  /** GA4 visits to that page, all sources; null when GA4 is not connected or holds nothing for it. */
  visits: { sessions: number; conversions: number | null } | null;
}

export interface SearchRankingsReport {
  /** A Search Console property is chosen. */
  connected: boolean;
  analyticsConnected: boolean;
  /** Search Console rows are stored; false straight after connecting, before the first sync. */
  hasData: boolean;
  /** GA4 landing-page rows are stored. */
  analyticsHasData: boolean;
  days: number;
  range: { start: Date; end: Date } | null;
  comparisonRange: { start: Date; end: Date } | null;
  summary: {
    searches: number;
    top3: number;
    pageOne: number;
    pageTwo: number;
    beyond: number;
    movedUp: number;
    movedDown: number;
  } | null;
  rows: SearchRankingRow[];
}

/**
 * Where the site stands in Google, from Search Console.
 *
 * These are the positions Google itself recorded for the customer's own
 * searches: real, free, and available for every search the site has been shown
 * for, not only keywords someone thought to track. They are averages over a
 * window rather than a reading at one moment, and they say nothing about where
 * competitors stand — that needs a live look at the results, which is a
 * separate, paid source (see RankTrackingService).
 */
@Injectable()
export class SearchRankingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly searchConsole: SearchConsoleInsightsService,
    private readonly analytics: AnalyticsInsightsService,
  ) {}

  async report(projectId: string, options: { days?: number; limit?: number } = {}): Promise<SearchRankingsReport> {
    const days = options.days ?? 28;
    const [connected, analyticsOn] = await Promise.all([
      searchConsoleConnected(this.prisma, projectId),
      analyticsConnected(this.prisma, projectId),
    ]);
    const empty: SearchRankingsReport = {
      connected,
      analyticsConnected: analyticsOn,
      hasData: false,
      analyticsHasData: false,
      days,
      range: null,
      comparisonRange: null,
      summary: null,
      rows: [],
    };
    if (!connected) return empty;

    const table = await this.searchConsole.queriesWithMovement(projectId, { days, limit: options.limit });
    if (!table) return empty;

    const [topPages, visits] = await Promise.all([
      this.searchConsole.topPageForQueries(
        projectId,
        table.rows.map((row) => row.query),
        { days },
      ),
      analyticsOn ? this.analytics.visitsByPage(projectId, days) : Promise.resolve(null),
    ]);

    const rows = table.rows.map((row): SearchRankingRow => {
      const page = topPages.get(row.query) ?? null;
      const seen = page && visits ? (visits.get(pathKey(page)) ?? null) : null;
      return { ...row, page, visits: seen ? { sessions: seen.sessions, conversions: seen.conversions } : null };
    });

    return {
      connected,
      analyticsConnected: analyticsOn,
      hasData: true,
      analyticsHasData: visits !== null,
      days,
      range: table.range,
      comparisonRange: table.comparisonRange,
      summary: {
        searches: table.searches,
        top3: table.top3,
        pageOne: table.pageOne,
        pageTwo: table.pageTwo,
        beyond: table.beyond,
        movedUp: table.movedUp,
        movedDown: table.movedDown,
      },
      rows,
    };
  }
}
