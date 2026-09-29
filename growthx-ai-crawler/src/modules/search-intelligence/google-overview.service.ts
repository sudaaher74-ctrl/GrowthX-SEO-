import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { canonicalUrl } from '../crawler/canonical-url';
import { AnalyticsReportService, Ga4OrganicData, Ga4Range } from '../integrations/google/analytics-report.service';
import { pathKey } from '../integrations/google/analytics-insights.service';
import { SearchConsoleInsightsService } from '../integrations/google/search-console-insights.service';
import { explainCoverage } from './index-status.service';
import {
  Headline,
  OrganicLike,
  PageRowFacts,
  SEGMENTS,
  SEGMENT_CRITERIA,
  Segment,
  buildFunnel,
  buildHeadlines,
  diagnosePage,
  median,
  segmentsFor,
} from './google-logic';
import { ownSite } from './own-site';

export const GOOGLE_WINDOWS = [7, 28, 90] as const;
export type GoogleWindow = (typeof GOOGLE_WINDOWS)[number];

export function parseGoogleWindow(value: string | undefined): GoogleWindow {
  const days = value ? parseInt(value, 10) : 28;
  if (!(GOOGLE_WINDOWS as readonly number[]).includes(days)) {
    throw new BadRequestException('days must be one of 7, 28 or 90.');
  }
  return days as GoogleWindow;
}

export interface SourceStatus {
  connected: boolean;
  /** NOT_CONNECTED | NEEDS_SELECTION | NEEDS_REAUTH | ERROR | NEVER_SYNCED | EMPTY | READY */
  state: string;
  message: string | null;
  lastSyncedAt: string | null;
  hasData: boolean;
  propertyName: string | null;
  accountEmail: string | null;
}

type Delta = { kind: 'pct' | 'pts' | 'places'; value: number } | null;

export interface Kpi {
  key: string;
  label: string;
  source: 'GSC' | 'GA4';
  format: 'count' | 'percent' | 'position' | 'currency';
  /** Null when not measured; `note` says why. */
  value: number | null;
  previous: number | null;
  delta: Delta;
  lowerIsBetter: boolean;
  /** Real daily values for the window, or null where none are stored. */
  sparkline: number[] | null;
  note: string | null;
}

const day = (date: Date) => date.toISOString().slice(0, 10);
const shift = (date: Date, days: number) => {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
};
const pctDelta = (current: number, previous: number | null): Delta =>
  previous !== null && previous > 0 ? { kind: 'pct', value: ((current - previous) / previous) * 100 } : null;

/**
 * The Google section's read model: Search Console, Google Analytics and the
 * site crawl in one place.
 *
 * Everything is read from what is already stored for the project the caller
 * belongs to (the controller's guard has checked that); nothing here calls
 * Google. A figure that a source did not measure is null, with the reason.
 */
@Injectable()
export class GoogleOverviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gsc: SearchConsoleInsightsService,
    private readonly reports: AnalyticsReportService,
  ) {}

  // ── Overview ───────────────────────────────────────────────────────────

  async overview(projectId: string, days: GoogleWindow) {
    const range = `${days}d` as Ga4Range;
    const [integrations, coverage, summary, series, report, ctrRows, declining, site] = await Promise.all([
      this.prisma.integration.findMany({
        where: { projectId, provider: { in: ['search_console', 'analytics'] } },
        select: {
          provider: true,
          status: true,
          statusMessage: true,
          selectedResourceId: true,
          selectedResourceName: true,
          googleAccountEmail: true,
          lastSyncedAt: true,
        },
      }),
      this.gsc.coverage(projectId),
      this.gsc.summary(projectId, days),
      this.gsc.timeseries(projectId, days),
      this.reports.read(projectId, range),
      this.gsc.ctrOpportunities(projectId, { days, limit: 100 }),
      this.gsc.declining(projectId, { days }),
      ownSite(this.prisma, projectId),
    ]);

    const scRow = integrations.find((i) => i.provider === 'search_console');
    const searchConsole: SourceStatus = {
      connected: Boolean(scRow && scRow.status === 'CONNECTED' && scRow.selectedResourceId),
      state: !scRow
        ? 'NOT_CONNECTED'
        : scRow.status === 'NEEDS_REAUTH'
          ? 'NEEDS_REAUTH'
          : !scRow.selectedResourceId
            ? 'NEEDS_SELECTION'
            : coverage
              ? 'READY'
              : 'NEVER_SYNCED',
      message: !scRow
        ? 'Search Console is not connected for this workspace.'
        : scRow.status === 'NEEDS_REAUTH'
          ? (scRow.statusMessage ?? 'Search Console access expired. Reconnect Google to continue.')
          : !scRow.selectedResourceId
            ? 'Choose a Search Console property on the Integrations page.'
            : coverage
              ? null
              : 'Nothing has been read from Search Console yet. Fetch it once to see search data.',
      lastSyncedAt: scRow?.lastSyncedAt?.toISOString() ?? null,
      hasData: Boolean(coverage),
      propertyName: scRow?.selectedResourceName ?? null,
      accountEmail: scRow?.googleAccountEmail ?? null,
    };

    const organic = report.data?.organic ?? null;
    const analytics: SourceStatus & { needsRefresh: boolean } = {
      connected: report.state !== 'NOT_CONNECTED' && report.state !== 'NEEDS_SELECTION' && report.state !== 'NEEDS_REAUTH',
      state: report.state,
      message: report.message,
      lastSyncedAt: report.lastSyncedAt,
      hasData: Boolean(report.data && !report.data.empty),
      propertyName: report.propertyName,
      accountEmail: report.googleAccountEmail,
      // A report stored before the Google section existed has no organic block.
      needsRefresh: Boolean(report.data) && !organic,
    };

    const searchNow = summary ? { clicks: summary.clicks.current, impressions: summary.impressions.current } : null;
    const organicNow: OrganicLike | null = organic ? organic.totals : null;

    const headlines: Headline[] = buildHeadlines({
      days,
      search: summary,
      organic: organicNow,
      organicPrevious: organic?.previous ?? null,
      ctrGap: summary ? { pages: ctrRows.length, missedClicks: ctrRows.reduce((s, r) => s + r.estimatedMissedClicks, 0) } : null,
      decliningQueries: summary ? declining.length : null,
    });

    const searchSeries = series.map((p) => ({
      date: day(p.date),
      clicks: p.clicks,
      impressions: p.impressions,
      ctr: p.ctr,
      position: p.position,
    }));

    return {
      days,
      sources: {
        searchConsole,
        analytics,
        crawler: { lastCrawledAt: site?.crawl?.finishedAt?.toISOString() ?? site?.crawl?.createdAt.toISOString() ?? null },
      },
      windows: {
        search: summary
          ? {
              start: day(summary.range.start),
              end: day(summary.range.end),
              comparison: summary.comparisonRange
                ? { start: day(summary.comparisonRange.start), end: day(summary.comparisonRange.end) }
                : null,
            }
          : null,
        analytics: report.data
          ? {
              start: report.data.startDate,
              end: report.data.endDate,
              comparison: organic ? { start: organic.previousStart, end: organic.previousEnd } : null,
            }
          : null,
      },
      kpis: this.kpis(summary, searchSeries, organic),
      series: { search: searchSeries, organic: organic?.daily ?? [] },
      funnel: buildFunnel(searchNow, organicNow),
      headlines,
    };
  }

  private kpis(
    summary: Awaited<ReturnType<SearchConsoleInsightsService['summary']>>,
    series: { clicks: number; impressions: number; ctr: number; position: number }[],
    organic: Ga4OrganicData | null,
  ): Kpi[] {
    const noSearch = 'Search Console has no data for this period.';
    const noGa = 'Google Analytics has no organic data for this period.';
    const s = (field: 'clicks' | 'impressions' | 'ctr' | 'position') => (series.length >= 2 ? series.map((p) => p[field]) : null);
    const o = (field: 'users' | 'sessions') => (organic && organic.daily.length >= 2 ? organic.daily.map((p) => p[field]) : null);
    const t = organic?.totals ?? null;
    const p = organic?.previous ?? null;

    const search = (
      key: string,
      label: string,
      metric: { current: number; previous: number | null } | undefined,
      format: Kpi['format'],
      field: 'clicks' | 'impressions' | 'ctr' | 'position',
    ): Kpi => {
      const delta: Delta =
        !metric || metric.previous === null
          ? null
          : format === 'percent'
            ? { kind: 'pts', value: (metric.current - metric.previous) * 100 }
            : format === 'position'
              ? { kind: 'places', value: metric.current - metric.previous }
              : pctDelta(metric.current, metric.previous);
      return {
        key,
        label,
        source: 'GSC',
        format,
        value: metric ? metric.current : null,
        previous: metric ? metric.previous : null,
        delta,
        lowerIsBetter: format === 'position',
        sparkline: s(field),
        note: metric ? null : noSearch,
      };
    };

    return [
      search('clicks', 'Organic clicks', summary?.clicks, 'count', 'clicks'),
      search('impressions', 'Impressions', summary?.impressions, 'count', 'impressions'),
      search('ctr', 'Average CTR', summary?.ctr, 'percent', 'ctr'),
      search('position', 'Average position', summary?.position, 'position', 'position'),
      {
        key: 'organicUsers',
        label: 'Organic users',
        source: 'GA4',
        format: 'count',
        value: t ? t.activeUsers : null,
        previous: p ? p.activeUsers : null,
        delta: t ? pctDelta(t.activeUsers, p ? p.activeUsers : null) : null,
        lowerIsBetter: false,
        sparkline: o('users'),
        note: t ? null : noGa,
      },
      {
        key: 'organicSessions',
        label: 'Organic sessions',
        source: 'GA4',
        format: 'count',
        value: t ? t.sessions : null,
        previous: p ? p.sessions : null,
        delta: t ? pctDelta(t.sessions, p ? p.sessions : null) : null,
        lowerIsBetter: false,
        sparkline: o('sessions'),
        note: t ? null : noGa,
      },
      {
        key: 'engagementRate',
        label: 'Engagement rate',
        source: 'GA4',
        format: 'percent',
        value: t ? t.engagementRate : null,
        previous: p ? p.engagementRate : null,
        delta: t && p ? { kind: 'pts', value: (t.engagementRate - p.engagementRate) * 100 } : null,
        lowerIsBetter: false,
        // Engagement rate is not stored per day, so there is nothing real to draw.
        sparkline: null,
        note: t ? null : noGa,
      },
      {
        key: 'keyEvents',
        label: 'Key events',
        source: 'GA4',
        format: 'count',
        value: t ? t.keyEvents : null,
        previous: p ? p.keyEvents : null,
        delta: t && t.keyEvents !== null ? pctDelta(t.keyEvents, p ? p.keyEvents : null) : null,
        lowerIsBetter: false,
        sparkline: organic && organic.daily.length >= 2 && t?.keyEvents !== null ? organic.daily.map((d) => d.keyEvents ?? 0) : null,
        note: t ? (t.keyEvents === null ? 'No key events are set up in this Google Analytics property.' : null) : noGa,
      },
    ];
  }

  // ── Pages ──────────────────────────────────────────────────────────────

  async pages(projectId: string, days: GoogleWindow, options: { segment?: string; limit?: number } = {}) {
    if (options.segment && !(SEGMENTS as readonly string[]).includes(options.segment)) {
      throw new BadRequestException(`segment must be one of ${SEGMENTS.join(', ')}.`);
    }
    const limit = Math.min(Math.max(options.limit ?? 100, 1), 500);

    const coverage = await this.gsc.coverage(projectId);
    const range = `${days}d` as Ga4Range;
    const [report, site] = await Promise.all([this.reports.read(projectId, range), ownSite(this.prisma, projectId)]);
    const organic = report.data?.organic ?? null;

    let windows: { start: Date; end: Date; priorStart: Date; priorEnd: Date } | null = null;
    let current = new Map<string, GscPage>();
    let prior = new Map<string, GscPage>();
    if (coverage) {
      const end = coverage.newestDate;
      const start = shift(end, -(days - 1));
      const priorEnd = shift(start, -1);
      const priorStart = shift(priorEnd, -(days - 1));
      windows = { start, end, priorStart, priorEnd };
      [current, prior] = await Promise.all([
        this.gscPages(projectId, start, end),
        this.gscPages(projectId, priorStart, priorEnd),
      ]);
    }
    // Only meaningful when the earlier window actually holds data.
    const hasPrior = prior.size > 0;

    // Analytics landing pages, folded onto the same key as Search Console's URLs.
    const ga = new Map<string, GaPage>();
    for (const row of organic?.landingPages ?? []) {
      const key = pathKey(row.page);
      const existing = ga.get(key);
      const sessions = (existing?.sessions ?? 0) + row.sessions;
      ga.set(key, {
        users: (existing?.users ?? 0) + row.users,
        sessions,
        engagedSessions: (existing?.engagedSessions ?? 0) + row.engagedSessions,
        engagementRate: sessions > 0 ? ((existing?.engagedSessions ?? 0) + row.engagedSessions) / sessions : 0,
        averageEngagementTimeSec: row.averageEngagementTimeSec,
        views: (existing?.views ?? 0) + row.views,
        keyEvents: sumNullable(existing?.keyEvents, row.keyEvents),
        revenue: sumNullable(existing?.revenue, row.revenue),
      });
    }

    const keys = new Set<string>([...current.keys(), ...ga.keys()]);
    const risk = await this.technicalRisk(projectId, site, [...current.values()].map((p) => p.url));

    const measuredConv = organic?.totals.keyEvents !== null && organic?.totals.keyEvents !== undefined;
    const gaList = [...ga.values()];
    const totalSessions = gaList.reduce((s, r) => s + r.sessions, 0);
    const totalKeyEvents = gaList.reduce((s, r) => s + (r.keyEvents ?? 0), 0);
    const ctx = {
      medianSessions: median(gaList.map((r) => r.sessions)),
      siteConversionRate: measuredConv && totalSessions > 0 ? totalKeyEvents / totalSessions : null,
    };

    const rows = [...keys].map((key) => {
      const g = current.get(key) ?? null;
      const before = prior.get(key) ?? null;
      const a = ga.get(key) ?? null;
      const url = g?.url ?? key;
      const technicalRisk = g ? (risk.get(canonicalUrl(g.url)) ?? null) : null;
      const gscFacts = g
        ? {
            clicks: g.clicks,
            impressions: g.impressions,
            ctr: g.impressions > 0 ? g.clicks / g.impressions : 0,
            position: g.position,
            // Null without an earlier window: no comparison instead of a false one.
            previousClicks: hasPrior ? (before?.clicks ?? 0) : null,
          }
        : null;
      const facts: PageRowFacts = {
        gsc: gscFacts,
        ga: a ? { sessions: a.sessions, keyEvents: a.keyEvents } : null,
        technicalRisk,
      };
      return {
        key,
        url,
        gsc: gscFacts && {
          ...gscFacts,
          previousImpressions: hasPrior ? (before?.impressions ?? 0) : null,
          clicksChangePct:
            hasPrior && before && before.clicks > 0 ? ((g!.clicks - before.clicks) / before.clicks) * 100 : null,
        },
        ga: a && {
          users: a.users,
          sessions: a.sessions,
          engagementRate: a.engagementRate,
          averageEngagementTimeSec: a.averageEngagementTimeSec,
          keyEvents: a.keyEvents,
          revenue: a.revenue,
        },
        technicalRisk,
        segments: segmentsFor(facts, ctx),
        trend: [] as number[],
      };
    });

    const segmentCounts = Object.fromEntries(SEGMENTS.map((s) => [s, rows.filter((r) => r.segments.includes(s)).length]));
    const compare = SEGMENT_SORT[(options.segment as Segment) ?? 'top-traffic'];
    const shown = rows
      .filter((r) => !options.segment || r.segments.includes(options.segment as Segment))
      .sort(compare)
      .slice(0, limit);

    // Real daily clicks for the pages on screen, for the trend column.
    if (windows && shown.length > 0) {
      const daily = await this.gscDailyClicks(projectId, windows.start, windows.end, shown.flatMap((r) => (current.get(r.key)?.variants ?? [])));
      const dates = eachDay(windows.start, windows.end);
      for (const row of shown) {
        const variants = new Set(current.get(row.key)?.variants ?? []);
        if (variants.size === 0) continue;
        row.trend = dates.map((d) => [...variants].reduce((s, v) => s + (daily.get(`${v}|${d}`) ?? 0), 0));
      }
    }

    return {
      days,
      windows: windows && {
        search: {
          start: day(windows.start),
          end: day(windows.end),
          comparison: hasPrior ? { start: day(windows.priorStart), end: day(windows.priorEnd) } : null,
        },
        analytics: report.data ? { start: report.data.startDate, end: report.data.endDate } : null,
      },
      sources: {
        searchConsole: { hasData: Boolean(coverage) },
        analytics: {
          state: report.state,
          message: report.message,
          hasOrganic: Boolean(organic),
          needsRefresh: Boolean(report.data) && !organic,
          conversionsMeasured: measuredConv,
        },
      },
      criteria: SEGMENT_CRITERIA,
      segmentCounts,
      total: rows.length,
      rows: shown,
    };
  }

  // ── Page detail ────────────────────────────────────────────────────────

  async pageDetail(projectId: string, days: GoogleWindow, page: string) {
    if (!page) throw new BadRequestException('page is required.');
    const key = pathKey(page);
    const coverage = await this.gsc.coverage(projectId);
    const range = `${days}d` as Ga4Range;
    const [report, site] = await Promise.all([this.reports.read(projectId, range), ownSite(this.prisma, projectId)]);
    const organic = report.data?.organic ?? null;

    let gscNow: GscPage | null = null;
    let gscBefore: GscPage | null = null;
    let queries: Awaited<ReturnType<SearchConsoleInsightsService['queriesForPage']>> = [];
    let history: { date: string; clicks: number; impressions: number; ctr: number; position: number }[] = [];
    if (coverage) {
      const end = coverage.newestDate;
      const start = shift(end, -(days - 1));
      const priorEnd = shift(start, -1);
      const priorStart = shift(priorEnd, -(days - 1));
      const [now, before] = await Promise.all([this.gscPages(projectId, start, end), this.gscPages(projectId, priorStart, priorEnd)]);
      gscNow = now.get(key) ?? null;
      gscBefore = before.size > 0 ? (before.get(key) ?? { url: gscNow?.url ?? page, variants: [], clicks: 0, impressions: 0, position: 0 }) : null;
      if (gscNow) {
        queries = await this.gsc.queriesForPage(projectId, gscNow.url, { days, limit: 25 });
        history = await this.gscPageHistory(projectId, start, end, gscNow.variants);
      }
    }

    const gaRows = (organic?.landingPages ?? []).filter((r) => pathKey(r.page) === key);
    const ga = gaRows.length
      ? gaRows.reduce(
          (acc, r) => ({
            users: acc.users + r.users,
            sessions: acc.sessions + r.sessions,
            engagedSessions: acc.engagedSessions + r.engagedSessions,
            views: acc.views + r.views,
            keyEvents: sumNullable(acc.keyEvents, r.keyEvents),
            revenue: sumNullable(acc.revenue, r.revenue),
            averageEngagementTimeSec: r.averageEngagementTimeSec,
          }),
          { users: 0, sessions: 0, engagedSessions: 0, views: 0, keyEvents: null as number | null, revenue: null as number | null, averageEngagementTimeSec: 0 },
        )
      : null;
    const gaOut = ga && { ...ga, engagementRate: ga.sessions > 0 ? ga.engagedSessions / ga.sessions : 0 };

    // Google's own answer for this page, and our crawl of it.
    const urls = [gscNow?.url, ...(gscNow?.variants ?? [])].filter((u): u is string => Boolean(u));
    const inspection = urls.length
      ? await this.prisma.urlIndexInspection.findFirst({
          where: { projectId, url: { in: urls } },
          orderBy: { inspectedAt: 'desc' },
        })
      : null;
    const explained = inspection && !inspection.error ? explainCoverage(inspection.coverageState) : null;
    const crawl = await this.crawlProfile(projectId, site, key);

    const gscFacts = gscNow && {
      clicks: gscNow.clicks,
      impressions: gscNow.impressions,
      ctr: gscNow.impressions > 0 ? gscNow.clicks / gscNow.impressions : 0,
      position: gscNow.position,
      previousClicks: gscBefore ? gscBefore.clicks : null,
    };

    const diagnosis = diagnosePage({
      gsc: gscFacts,
      ga: gaOut ? { sessions: gaOut.sessions, engagementRate: gaOut.engagementRate, keyEvents: gaOut.keyEvents } : null,
      index:
        inspection && !inspection.error
          ? {
              verdict: inspection.verdict,
              coverageState: inspection.coverageState,
              meaning: explained?.meaning ?? null,
              action: explained?.action ?? null,
            }
          : null,
      crawl: crawl && {
        statusCode: crawl.statusCode,
        indexability: crawl.indexability,
        title: crawl.title,
        metaDescription: crawl.metaDescription,
        h1Count: crawl.h1Count,
        wordCount: crawl.wordCount,
        canonicalUrl: crawl.canonicalUrl,
        pageUrl: crawl.url,
        schemaTypes: crawl.schemas.length,
      },
    });

    return {
      days,
      key,
      url: gscNow?.url ?? crawl?.url ?? page,
      found: Boolean(gscNow || gaOut || crawl),
      gsc: gscFacts && {
        ...gscFacts,
        previousImpressions: gscBefore ? gscBefore.impressions : null,
        clicksChangePct: gscBefore && gscBefore.clicks > 0 ? ((gscNow!.clicks - gscBefore.clicks) / gscBefore.clicks) * 100 : null,
      },
      ga: gaOut,
      queries,
      history,
      funnel: buildFunnel(
        gscFacts ? { clicks: gscFacts.clicks, impressions: gscFacts.impressions } : null,
        gaOut
          ? {
              sessions: gaOut.sessions,
              activeUsers: gaOut.users,
              engagedSessions: gaOut.engagedSessions,
              engagementRate: gaOut.engagementRate,
              keyEvents: gaOut.keyEvents ?? (organic?.totals.keyEvents === null ? null : 0),
              revenue: gaOut.revenue,
            }
          : null,
      ),
      index: inspection && {
        verdict: inspection.verdict,
        coverageState: inspection.coverageState,
        lastCrawlTime: inspection.lastCrawlTime?.toISOString() ?? null,
        googleCanonical: inspection.googleCanonical,
        inspectedAt: inspection.inspectedAt.toISOString(),
        error: inspection.error,
        meaning: explained?.meaning ?? null,
        action: explained?.action ?? null,
      },
      crawl,
      diagnosis,
      windows: { analytics: report.data ? { start: report.data.startDate, end: report.data.endDate } : null },
    };
  }

  // ── Queries ────────────────────────────────────────────────────────────

  /** Search Console page totals for a window, folded onto one key per page. */
  private async gscPages(projectId: string, start: Date, end: Date): Promise<Map<string, GscPage>> {
    const rows = await this.prisma.$queryRaw<
      { page: string; clicks: bigint; impressions: bigint; wpos: number }[]
    >`
      SELECT page,
             SUM(clicks)::bigint            AS clicks,
             SUM(impressions)::bigint       AS impressions,
             SUM(position * impressions)    AS wpos
        FROM "GscDailyMetric"
       WHERE "projectId" = ${projectId} AND grain = 'PAGE'
         AND date >= ${start} AND date <= ${end} AND page <> ''
       GROUP BY page`;

    const folded = new Map<string, GscPage & { wpos: number }>();
    for (const row of rows) {
      const key = pathKey(row.page);
      const clicks = Number(row.clicks);
      const impressions = Number(row.impressions);
      const existing = folded.get(key);
      const wpos = (existing?.wpos ?? 0) + Number(row.wpos ?? 0);
      const totalImpressions = (existing?.impressions ?? 0) + impressions;
      folded.set(key, {
        // The address with the most clicks is the one shown for the page.
        url: existing && existing.clicks >= clicks ? existing.url : row.page,
        variants: [...(existing?.variants ?? []), row.page],
        clicks: (existing?.clicks ?? 0) + clicks,
        impressions: totalImpressions,
        wpos,
        position: totalImpressions > 0 ? wpos / totalImpressions : 0,
      });
    }
    return folded;
  }

  private async gscDailyClicks(projectId: string, start: Date, end: Date, pages: string[]): Promise<Map<string, number>> {
    const out = new Map<string, number>();
    if (pages.length === 0) return out;
    const rows = await this.prisma.$queryRaw<{ page: string; date: Date; clicks: bigint }[]>`
      SELECT page, date, SUM(clicks)::bigint AS clicks
        FROM "GscDailyMetric"
       WHERE "projectId" = ${projectId} AND grain = 'PAGE'
         AND date >= ${start} AND date <= ${end}
         AND page IN (${Prisma.join(pages)})
       GROUP BY page, date`;
    for (const row of rows) out.set(`${row.page}|${day(row.date)}`, Number(row.clicks));
    return out;
  }

  private async gscPageHistory(projectId: string, start: Date, end: Date, variants: string[]) {
    if (variants.length === 0) return [];
    const rows = await this.prisma.$queryRaw<
      { date: Date; clicks: bigint; impressions: bigint; wpos: number }[]
    >`
      SELECT date,
             SUM(clicks)::bigint         AS clicks,
             SUM(impressions)::bigint    AS impressions,
             SUM(position * impressions) AS wpos
        FROM "GscDailyMetric"
       WHERE "projectId" = ${projectId} AND grain = 'PAGE'
         AND date >= ${start} AND date <= ${end}
         AND page IN (${Prisma.join(variants)})
       GROUP BY date
       ORDER BY date`;
    return rows.map((r) => {
      const impressions = Number(r.impressions);
      const clicks = Number(r.clicks);
      return {
        date: day(r.date),
        clicks,
        impressions,
        ctr: impressions > 0 ? clicks / impressions : 0,
        position: impressions > 0 ? Number(r.wpos) / impressions : 0,
      };
    });
  }

  /** Why a page might be a technical risk, by canonical URL: Google's index check and our crawl. */
  private async technicalRisk(
    projectId: string,
    site: Awaited<ReturnType<typeof ownSite>>,
    urls: string[],
  ): Promise<Map<string, string>> {
    const risk = new Map<string, string>();
    if (urls.length === 0) return risk;

    const inspections = await this.prisma.urlIndexInspection.findMany({
      where: { projectId, url: { in: urls } },
      orderBy: { inspectedAt: 'desc' },
      select: { url: true, verdict: true, coverageState: true, error: true },
    });
    const seen = new Set<string>();
    for (const i of inspections) {
      const key = canonicalUrl(i.url);
      if (seen.has(key)) continue;
      seen.add(key);
      if (!i.error && i.verdict && i.verdict !== 'PASS') risk.set(key, `Google: ${i.coverageState ?? i.verdict}`);
    }

    if (site?.crawl) {
      const bad = await this.prisma.page.findMany({
        where: {
          crawlJobId: site.crawl.id,
          OR: [{ statusCode: { gte: 400 } }, { indexability: 'NOT_INDEXABLE' }],
        },
        select: { url: true, statusCode: true, indexability: true },
        take: 2000,
      });
      for (const p of bad) {
        const key = canonicalUrl(p.url);
        if (!risk.has(key)) risk.set(key, p.statusCode >= 400 ? `Crawl: HTTP ${p.statusCode}` : 'Crawl: not indexable');
      }
    }
    return risk;
  }

  /** What our own crawl recorded for one page. Null when it has not been crawled. */
  private async crawlProfile(projectId: string, site: Awaited<ReturnType<typeof ownSite>>, key: string) {
    if (!site?.crawl) return null;
    const path = key === '/' ? '/' : key;
    const candidates = await this.prisma.page.findMany({
      where: { crawlJobId: site.crawl.id, OR: [{ url: { contains: path } }, { finalUrl: { contains: path } }] },
      select: {
        id: true,
        url: true,
        finalUrl: true,
        statusCode: true,
        responseTimeMs: true,
        title: true,
        metaDescription: true,
        canonicalUrl: true,
        h1: true,
        wordCount: true,
        indexability: true,
        jsRequired: true,
        crawledAt: true,
        schemas: { select: { schemaType: true, isValid: true } },
        performance: { select: { performanceScore: true, lcpMs: true, clsScore: true, inpMs: true } },
        issues: { where: { status: 'OPEN' }, select: { severity: true, issueType: true, description: true }, take: 20 },
      },
      take: 50,
    });
    const page = candidates.find((c) => pathKey(c.url) === key || pathKey(c.finalUrl) === key);
    if (!page) return null;

    const [inlinks, outlinks] = await Promise.all([
      this.prisma.link.count({
        where: { targetUrl: { in: [page.url, page.finalUrl] }, linkType: 'INTERNAL', sourcePage: { crawlJobId: site.crawl.id } },
      }),
      this.prisma.link.count({ where: { sourcePageId: page.id, linkType: 'INTERNAL' } }),
    ]);

    return {
      url: page.url,
      crawledAt: page.crawledAt.toISOString(),
      statusCode: page.statusCode,
      responseTimeMs: page.responseTimeMs,
      title: page.title,
      metaDescription: page.metaDescription,
      canonicalUrl: page.canonicalUrl,
      h1Count: page.h1.length,
      wordCount: page.wordCount,
      indexability: page.indexability,
      jsRequired: page.jsRequired,
      schemas: page.schemas.map((s) => ({ type: s.schemaType, valid: s.isValid })),
      performance: page.performance,
      internalLinksIn: inlinks,
      internalLinksOut: outlinks,
      openIssues: page.issues,
    };
  }
}

interface GscPage {
  url: string;
  variants: string[];
  clicks: number;
  impressions: number;
  position: number;
}

interface GaPage {
  users: number;
  sessions: number;
  engagedSessions: number;
  engagementRate: number;
  averageEngagementTimeSec: number;
  views: number;
  keyEvents: number | null;
  revenue: number | null;
}

type PageRow = { gsc: { clicks: number; impressions: number; clicksChangePct: number | null; previousClicks: number | null } | null; ga: { sessions: number; keyEvents: number | null } | null };

const clicksOf = (r: PageRow) => r.gsc?.clicks ?? -1;
const SEGMENT_SORT: Record<Segment, (a: PageRow, b: PageRow) => number> = {
  'top-traffic': (a, b) => clicksOf(b) - clicksOf(a) || (b.ga?.sessions ?? 0) - (a.ga?.sessions ?? 0),
  'top-impressions': (a, b) => (b.gsc?.impressions ?? 0) - (a.gsc?.impressions ?? 0),
  'top-converting': (a, b) => (b.ga?.keyEvents ?? 0) - (a.ga?.keyEvents ?? 0),
  // Biggest loss / gain first, in clicks rather than in percent.
  declining: (a, b) => lostClicks(b) - lostClicks(a),
  growing: (a, b) => lostClicks(a) - lostClicks(b),
  'high-impressions-low-ctr': (a, b) => (b.gsc?.impressions ?? 0) - (a.gsc?.impressions ?? 0),
  'high-traffic-low-conversion': (a, b) => (b.ga?.sessions ?? 0) - (a.ga?.sessions ?? 0),
  'low-traffic-high-conversion': (a, b) => (b.ga?.keyEvents ?? 0) - (a.ga?.keyEvents ?? 0),
  'ranking-opportunity': (a, b) => (b.gsc?.impressions ?? 0) - (a.gsc?.impressions ?? 0),
  'technical-risk': (a, b) => clicksOf(b) - clicksOf(a),
};
function lostClicks(r: PageRow): number {
  return r.gsc && r.gsc.previousClicks !== null ? r.gsc.previousClicks - r.gsc.clicks : 0;
}

function sumNullable(a: number | null | undefined, b: number | null): number | null {
  if (a == null && b == null) return null;
  return (a ?? 0) + (b ?? 0);
}

function eachDay(start: Date, end: Date): string[] {
  const days: string[] = [];
  for (let d = new Date(start); d <= end; d = shift(d, 1)) days.push(day(d));
  return days;
}
