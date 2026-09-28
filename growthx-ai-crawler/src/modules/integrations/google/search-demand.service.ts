import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { SearchConsoleInsightsService } from './search-console-insights.service';
import { DEMAND_DAYS, MeasuredSearch, SearchDataStatus, SearchDemand } from './search-demand';

/** Just off the first page: the bottom of page one and page two. */
const ALMOST_FROM = 8;
const ALMOST_TO = 20;
/**
 * Few enough that a small local business qualifies — ten people a month
 * seeing you for a search is ten customers — and enough that one stray
 * impression is not presented as an opportunity.
 */
const ALMOST_MIN_IMPRESSIONS = 10;
const TOP_KEPT = 20;
const ALMOST_KEPT = 10;

/**
 * Search demand for one project, from the Search Console data already synced.
 * See search-demand.ts. Never calls Google; never throws — a failure reads as
 * "no data" so a report is never lost to it.
 */
@Injectable()
export class SearchDemandService {
  private readonly logger = new Logger(SearchDemandService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly insights: SearchConsoleInsightsService,
  ) {}

  async forProject(projectId: string): Promise<SearchDemand> {
    const empty = (status: SearchDataStatus): SearchDemand => ({ status, days: DEMAND_DAYS, range: null, topSearches: [], almostWinning: [] });
    try {
      const [integration, coverage] = await Promise.all([
        this.prisma.integration.findUnique({
          where: { projectId_provider: { projectId, provider: 'search_console' } },
          select: { status: true },
        }),
        this.insights.coverage(projectId),
      ]);

      if (!coverage) {
        if (!integration || integration.status === 'DISCONNECTED') return empty('NOT_CONNECTED');
        if (integration.status === 'CONNECTED') return empty('NO_DATA_YET');
        return empty('NEEDS_ATTENTION');
      }

      const all = await this.insights.top(projectId, 'QUERY', { days: DEMAND_DAYS, limit: 300 });
      const top = all.slice(0, TOP_KEPT);
      const almost = all
        .filter((q) => q.position >= ALMOST_FROM && q.position <= ALMOST_TO && q.impressions >= ALMOST_MIN_IMPRESSIONS)
        .sort((a, b) => b.impressions - a.impressions)
        .slice(0, ALMOST_KEPT);

      const pages = await this.insights.topPageForQueries(projectId, [...new Set([...top, ...almost].map((q) => q.key))], {
        days: DEMAND_DAYS,
      });
      const toSearch = (q: (typeof all)[number]): MeasuredSearch => ({
        query: q.key,
        impressions: q.impressions,
        clicks: q.clicks,
        position: q.position,
        page: pages.get(q.key) ?? null,
      });

      const end = coverage.newestDate;
      const start = new Date(end);
      start.setUTCDate(start.getUTCDate() - (DEMAND_DAYS - 1));
      return {
        status: 'OK',
        days: DEMAND_DAYS,
        range: { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) },
        topSearches: top.map(toSearch),
        almostWinning: almost.map(toSearch),
      };
    } catch (err) {
      this.logger.warn(`[${projectId}] search demand unavailable: ${(err as Error).message}`);
      return empty('NO_DATA_YET');
    }
  }
}
