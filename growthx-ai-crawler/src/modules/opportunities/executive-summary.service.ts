import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { SearchConsoleInsightsService } from '../integrations/google/search-console-insights.service';
import { AnalyticsInsightsService } from '../integrations/google/analytics-insights.service';

/**
 * One measurement, or an honest reason there isn't one.
 *
 * Every figure on the executive dashboard is one of these. There is no shape
 * here that can carry a number without also carrying where it came from, which
 * is deliberate: the page this replaces displayed "Growth Score 78", "Organic
 * Traffic +18%" and "Estimated Opportunity ₹2.4L/mo" as string literals, the
 * same for every customer, and nothing in its structure made that obviously
 * wrong.
 */
export type Measure =
  | { state: 'MEASURED'; value: number; changePct: number | null; source: string }
  | { state: 'NOT_CONNECTED'; connect: string; reason: string }
  | { state: 'NO_DATA'; reason: string };

const notConnected = (connect: string, reason: string): Measure => ({ state: 'NOT_CONNECTED', connect, reason });
const noData = (reason: string): Measure => ({ state: 'NO_DATA', reason });

/**
 * The numbers on the executive dashboard, and only the ones that are real.
 *
 * Assembled here rather than in the page so that "we do not know this" is a
 * value the API returns, not something a component has to remember to render.
 * A dashboard that cannot express uncertainty ends up inventing certainty.
 */
@Injectable()
export class ExecutiveSummaryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly search: SearchConsoleInsightsService,
    private readonly analytics: AnalyticsInsightsService,
  ) {}

  async summary(organizationId: string, projectId: string, days = 28) {
    const [connections, searchSummary, analyticsSummary, site, opportunities] = await Promise.all([
      this.connectionStatus(projectId),
      this.search.summary(projectId, days).catch(() => null),
      this.analytics.summary(projectId, days).catch(() => null),
      this.siteHealth(projectId),
      this.openOpportunities(organizationId, projectId),
    ]);

    const searchClicks: Measure = !connections.searchConsole
      ? notConnected('search_console', 'Connect Search Console to see how much traffic Google sends you.')
      : !searchSummary
        ? noData('Search Console is connected but nothing has been synced yet.')
        : {
            state: 'MEASURED',
            value: searchSummary.clicks.current,
            changePct: searchSummary.clicks.changePct,
            source: 'Google Search Console',
          };

    const impressions: Measure = !connections.searchConsole
      ? notConnected('search_console', 'Connect Search Console to see how often you appear in search.')
      : !searchSummary
        ? noData('Nothing synced yet.')
        : {
            state: 'MEASURED',
            value: searchSummary.impressions.current,
            changePct: searchSummary.impressions.changePct,
            source: 'Google Search Console',
          };

    const sessions: Measure = !connections.analytics
      ? notConnected('analytics', 'Connect Google Analytics to see what visitors do after they arrive.')
      : !analyticsSummary
        ? noData('Analytics is connected but nothing has been synced yet.')
        : {
            state: 'MEASURED',
            value: analyticsSummary.sessions.current,
            changePct: analyticsSummary.sessions.changePct,
            source: 'Google Analytics',
          };

    // Three separate reasons there might be no conversion figure, and they
    // need three different messages: no Analytics, no sync, or an Analytics
    // property with no key events configured. Collapsing them into a zero is
    // what turns a setup gap into an apparent business failure.
    const conversions: Measure = !connections.analytics
      ? notConnected('analytics', 'Connect Google Analytics to measure conversions.')
      : !analyticsSummary
        ? noData('Analytics is connected but nothing has been synced yet.')
        : !analyticsSummary.conversionTrackingConfigured
          ? noData('This Analytics property has no key events configured, so conversions are not being measured.')
          : {
              state: 'MEASURED',
              value: analyticsSummary.conversions!.current,
              changePct: analyticsSummary.conversions!.changePct,
              source: 'Google Analytics',
            };

    return {
      range: { days },
      connections,
      headline: { searchClicks, impressions, sessions, conversions },
      siteHealth: site,
      openOpportunities: opportunities,
      // Deliberately absent: any single blended "Growth Score", and any
      // currency figure. A composite of unrelated measurements is a judgement
      // presented as an observation, and a rupee amount needs revenue data
      // attached to a page — neither is available, and inventing one
      // discredits every real number beside it.
    };
  }

  private async connectionStatus(projectId: string) {
    const rows = await this.prisma.integration.findMany({
      where: { projectId, status: 'CONNECTED', selectedResourceId: { not: null } },
      select: { provider: true },
    });
    const connected = new Set(rows.map((row) => row.provider));
    return {
      searchConsole: connected.has('search_console'),
      analytics: connected.has('analytics'),
      businessProfile: connected.has('business_profile'),
    };
  }

  /**
   * Site health from the most recent completed crawl.
   *
   * Real counts of real issues, not a score. The crawler already grades
   * severity; turning that into a number out of 100 would add a scale nobody
   * defined on top of data that is already clear.
   */
  private async siteHealth(
    projectId: string,
  ): Promise<
    | Measure
    | {
        state: 'MEASURED';
        pagesCrawled: number;
        criticalIssues: number;
        totalIssues: number;
        uniqueIssuesCount?: number;
        resolvedIssuesCount?: number;
        healthScore?: number | null;
        crawledAt: Date | null;
        source: string;
      }
  > {
    const job = await this.prisma.crawlJob.findFirst({
      where: { status: 'COMPLETED', website: { projectId } },
      orderBy: { finishedAt: 'desc' },
      select: {
        id: true,
        pagesCrawled: true,
        finishedAt: true,
        healthScore: true,
        uniqueIssuesCount: true,
        resolvedIssuesCount: true,
      },
    });
    if (!job) return noData('This site has not been crawled yet.');

    const [critical, total] = await Promise.all([
      // Straight off crawlJobId, which Issue carries directly and has an index
      // on — going through the page relation would join for no reason and miss
      // site-level issues, which have no page.
      this.prisma.issue.count({ where: { crawlJobId: job.id, severity: 'CRITICAL' } }),
      this.prisma.issue.count({ where: { crawlJobId: job.id } }),
    ]);

    return {
      state: 'MEASURED',
      pagesCrawled: job.pagesCrawled,
      criticalIssues: critical,
      totalIssues: total,
      uniqueIssuesCount: job.uniqueIssuesCount ?? total,
      resolvedIssuesCount: job.resolvedIssuesCount ?? 0,
      healthScore: job.healthScore,
      crawledAt: job.finishedAt,
      source: 'GrowthX site crawl',
    };
  }

  private async openOpportunities(organizationId: string, projectId: string) {
    const [total, high] = await Promise.all([
      this.prisma.growthOpportunity.count({ where: { organizationId, projectId, status: 'OPEN' } }),
      this.prisma.growthOpportunity.count({
        where: { organizationId, projectId, status: 'OPEN', potential: 'HIGH' },
      }),
    ]);
    return { total, highPotential: high };
  }
}
