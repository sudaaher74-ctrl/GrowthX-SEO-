import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

/**
 * What the stored GA4 data means, and what it means joined to Search Console.
 *
 * The join is the reason GA4 is here. Search Console can say a page gets 8,000
 * clicks; only Analytics can say whether any of them did anything, and that is
 * what turns a list of traffic opportunities into a list ordered by business
 * value.
 *
 * Both sides key on the landing page, but they spell it differently: Search
 * Console reports a full URL, GA4 reports a path. Reconciling those is most of
 * the work below, and getting it wrong produces a join that silently matches
 * nothing and reports every page as having no conversions.
 */
@Injectable()
export class AnalyticsInsightsService {
  constructor(private readonly prisma: PrismaService) {}

  async coverage(projectId: string) {
    const [newest, oldest] = await Promise.all([
      this.prisma.ga4DailyMetric.findFirst({
        where: { projectId, grain: 'TOTAL' },
        orderBy: { date: 'desc' },
        select: { date: true },
      }),
      this.prisma.ga4DailyMetric.findFirst({
        where: { projectId, grain: 'TOTAL' },
        orderBy: { date: 'asc' },
        select: { date: true },
      }),
    ]);
    if (!newest || !oldest) return null;
    return { newestDate: newest.date, oldestDate: oldest.date };
  }

  /**
   * Headline metrics with real period-over-period change.
   *
   * Conversions and revenue come back null rather than zero when the property
   * does not report them, and the client renders a prompt to configure them
   * instead of a zero that reads as failure.
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

    const hasPrior = prior.days > 0;
    return {
      range: { start, end },
      comparisonRange: hasPrior ? { start: priorStart, end: priorEnd } : null,
      users: metric(current.users, hasPrior ? prior.users : null),
      sessions: metric(current.sessions, hasPrior ? prior.sessions : null),
      engagementRate: metric(current.engagementRate, hasPrior ? prior.engagementRate : null),
      // Null all the way through when unconfigured, so no screen above can
      // turn "not set up" into "zero conversions".
      conversions: current.conversions === null ? null : metric(current.conversions, hasPrior ? prior.conversions : null),
      revenue: current.revenue === null ? null : metric(current.revenue, hasPrior ? prior.revenue : null),
      conversionTrackingConfigured: current.conversions !== null,
      revenueTrackingConfigured: current.revenue !== null,
      daysWithData: current.days,
    };
  }

  private async totalsBetween(projectId: string, start: Date, end: Date) {
    const rows = await this.prisma.ga4DailyMetric.findMany({
      where: { projectId, grain: 'TOTAL', date: { gte: start, lte: end } },
      select: { users: true, sessions: true, engagementRate: true, conversions: true, revenue: true },
    });

    const users = rows.reduce((sum, r) => sum + r.users, 0);
    const sessions = rows.reduce((sum, r) => sum + r.sessions, 0);
    // Weighted by sessions: a day with 3 sessions must not count as much as a
    // day with 3,000 when averaging a rate.
    const weightedEngagement = rows.reduce((sum, r) => sum + r.engagementRate * r.sessions, 0);

    // Only null when no day reported it. One day of nulls inside a configured
    // property should not erase the rest.
    const measured = rows.filter((r) => r.conversions !== null);
    const revenueMeasured = rows.filter((r) => r.revenue !== null);

    return {
      days: rows.length,
      users,
      sessions,
      engagementRate: sessions > 0 ? weightedEngagement / sessions : 0,
      conversions: measured.length > 0 ? measured.reduce((sum, r) => sum + (r.conversions ?? 0), 0) : null,
      revenue: revenueMeasured.length > 0 ? revenueMeasured.reduce((sum, r) => sum + (r.revenue ?? 0), 0) : null,
    };
  }

  async timeseries(projectId: string, days: number) {
    const coverage = await this.coverage(projectId);
    if (!coverage) return [];
    const start = shift(coverage.newestDate, -(days - 1));

    return this.prisma.ga4DailyMetric.findMany({
      where: { projectId, grain: 'TOTAL', date: { gte: start, lte: coverage.newestDate } },
      orderBy: { date: 'asc' },
      select: { date: true, users: true, sessions: true, engagementRate: true, conversions: true, revenue: true },
    });
  }

  /**
   * Search performance and business outcome for the same pages.
   *
   * This is §36 — the chain from an organic query through a landing page to a
   * conversion. It is what lets an opportunity be ranked by what a page is
   * worth rather than by how much traffic it gets.
   *
   * The two sides are matched on a normalised path. Search Console reports
   * https://example.com/services/kitchens; GA4 reports /services/kitchens.
   * Both are reduced to the same key, with query strings dropped — GA4's
   * landingPagePlusQueryString splits one page across every tracking parameter
   * that ever pointed at it, and leaving those separate would report a real
   * page as a dozen pages with a handful of sessions each.
   */
  async pageValue(projectId: string, days: number, limit = 50) {
    const [gscCoverage, ga4Coverage] = await Promise.all([
      this.prisma.gscDailyMetric.findFirst({
        where: { projectId, grain: 'PAGE' },
        orderBy: { date: 'desc' },
        select: { date: true },
      }),
      this.coverage(projectId),
    ]);
    // Both sides are required. Reporting search data with an empty conversions
    // column would read as "these pages convert nobody".
    if (!gscCoverage || !ga4Coverage) {
      return { rows: [], hasSearchData: !!gscCoverage, hasAnalyticsData: !!ga4Coverage };
    }

    const gscStart = shift(gscCoverage.date, -(days - 1));
    const ga4Start = shift(ga4Coverage.newestDate, -(days - 1));

    const [searchRows, analyticsRows] = await Promise.all([
      this.prisma.$queryRaw<{ page: string; clicks: bigint; impressions: bigint; position: number }[]>`
        SELECT page,
               SUM(clicks)::bigint      AS clicks,
               SUM(impressions)::bigint AS impressions,
               CASE WHEN SUM(impressions) > 0
                    THEN SUM(position * impressions) / SUM(impressions)
                    ELSE 0 END          AS position
          FROM "GscDailyMetric"
         WHERE "projectId" = ${projectId} AND grain = 'PAGE'
           AND date >= ${gscStart} AND date <= ${gscCoverage.date} AND page <> ''
         GROUP BY page`,
      this.prisma.$queryRaw<
        { landingPage: string; sessions: bigint; conversions: bigint | null; revenue: number | null }[]
      >`
        SELECT "landingPage",
               SUM(sessions)::bigint AS sessions,
               CASE WHEN bool_or(conversions IS NOT NULL)
                    THEN SUM(COALESCE(conversions, 0))::bigint
                    ELSE NULL END    AS conversions,
               CASE WHEN bool_or(revenue IS NOT NULL)
                    THEN SUM(COALESCE(revenue, 0))
                    ELSE NULL END    AS revenue
          FROM "Ga4DailyMetric"
         WHERE "projectId" = ${projectId} AND grain = 'LANDING_PAGE'
           AND date >= ${ga4Start} AND date <= ${ga4Coverage.newestDate} AND "landingPage" <> ''
         GROUP BY "landingPage"`,
    ]);

    // GA4 rows are folded onto the normalised path before matching, since
    // several tracked variants of one page collapse to a single key.
    const analytics = new Map<string, { sessions: number; conversions: number | null; revenue: number | null }>();
    for (const row of analyticsRows) {
      const key = pathKey(row.landingPage);
      const existing = analytics.get(key);
      const conversions = row.conversions === null ? null : Number(row.conversions);
      const revenue = row.revenue === null ? null : Number(row.revenue);
      analytics.set(key, {
        sessions: (existing?.sessions ?? 0) + Number(row.sessions),
        conversions: sumNullable(existing?.conversions, conversions),
        revenue: sumNullable(existing?.revenue, revenue),
      });
    }

    const rows = searchRows
      .map((row) => {
        const matched = analytics.get(pathKey(row.page));
        const clicks = Number(row.clicks);
        return {
          page: row.page,
          clicks,
          impressions: Number(row.impressions),
          position: row.position,
          // Null when this page has no GA4 row at all — a page can rank and
          // receive impressions without ever being a landing page.
          sessions: matched?.sessions ?? null,
          conversions: matched?.conversions ?? null,
          revenue: matched?.revenue ?? null,
          conversionRate:
            matched?.conversions != null && matched.sessions > 0 ? matched.conversions / matched.sessions : null,
        };
      })
      .sort((a, b) => {
        // Ordered by what a page is worth where that is known, and by traffic
        // where it is not — never by treating unknown as zero, which would
        // push every unmeasured page to the bottom regardless of its value.
        if (a.conversions != null && b.conversions != null) return b.conversions - a.conversions;
        if (a.conversions != null) return -1;
        if (b.conversions != null) return 1;
        return b.clicks - a.clicks;
      })
      .slice(0, limit);

    return { rows, hasSearchData: true, hasAnalyticsData: true };
  }
}

function sumNullable(a: number | null | undefined, b: number | null): number | null {
  if (a == null && b == null) return null;
  return (a ?? 0) + (b ?? 0);
}

/**
 * One page, however the two systems spell it.
 *
 * Host and scheme dropped because GA4 does not report them; query string
 * dropped because GA4's landingPagePlusQueryString splits a page across every
 * tracking parameter that ever pointed at it; trailing slash normalised.
 */
function pathKey(value: string): string {
  let path = value;
  try {
    path = new URL(value).pathname;
  } catch {
    path = value.split('?')[0];
  }
  path = path.split('?')[0].split('#')[0].replace(/\/+$/, '');
  return (path || '/').toLowerCase();
}

function metric(current: number, previous: number | null) {
  if (previous === null || previous === 0) return { current, previous, change: null, changePct: null };
  return {
    current,
    previous,
    change: current - previous,
    changePct: ((current - previous) / previous) * 100,
  };
}

function shift(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}
