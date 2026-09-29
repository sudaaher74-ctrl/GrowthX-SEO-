import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { google } from './google-apis';
import { PrismaService } from '../../../database/prisma.service';
import { GoogleOAuthService } from './google-oauth.service';
import { googleApiClientError } from './google-api-error';

/** The windows the top bar offers. Anything else is rejected, never guessed at. */
export const GA4_RANGES = { '7d': 7, '28d': 28, '90d': 90 } as const;
export type Ga4Range = keyof typeof GA4_RANGES;

export function parseGa4Range(value: string | undefined): Ga4Range {
  const range = value ?? '28d';
  if (!(range in GA4_RANGES)) throw new BadRequestException('range must be one of 7d, 28d or 90d.');
  return range as Ga4Range;
}

const ORGANIC_SEARCH = 'Organic Search';
const TOP_PAGES = 25;
const TOP_COUNTRIES = 10;
const TOP_CITIES = 15;
const ORGANIC_PAGES = 100;

export interface Ga4Totals {
  sessions: number;
  activeUsers: number;
  newUsers: number;
  engagedSessions: number;
  /** 0-1. */
  engagementRate: number;
  /** Seconds per active user, as the GA4 interface reports it. */
  averageEngagementTimeSec: number;
  /** screenPageViews. */
  views: number;
  /** Null when the property has no key events reporting — never zero. */
  keyEvents: number | null;
}

/** Organic Search visits only, as GA4 attributes them. */
export interface Ga4OrganicTotals extends Ga4Totals {
  /** Null when the property records no revenue — never zero. */
  revenue: number | null;
}

export interface Ga4OrganicData {
  totals: Ga4OrganicTotals;
  /** The equal window before this one; null when GA4 recorded nothing then. */
  previous: Ga4OrganicTotals | null;
  previousStart: string;
  previousEnd: string;
  daily: { date: string; sessions: number; users: number; keyEvents: number | null; revenue: number | null }[];
  landingPages: {
    page: string;
    users: number;
    sessions: number;
    engagedSessions: number;
    engagementRate: number;
    averageEngagementTimeSec: number;
    views: number;
    keyEvents: number | null;
    revenue: number | null;
  }[];
}

export interface Ga4ReportData {
  /** Dates as GA4 was asked for them: the N days ending yesterday. */
  startDate: string;
  endDate: string;
  /** True when the property recorded nothing at all in the window. */
  empty: boolean;
  totals: Ga4Totals;
  daily: { date: string; sessions: number; users: number }[];
  landingPages: { page: string; sessions: number; engagementRate: number; keyEvents: number | null }[];
  /** Engagement and key events are absent from snapshots stored before they were fetched per channel; the next refresh adds them. */
  channels: { channel: string; sessions: number; users: number; organic: boolean; engagementRate?: number; keyEvents?: number | null }[];
  organicSearchSessions: number;
  countries: { country: string; sessions: number; users: number }[];
  /** Absent from snapshots stored before cities were fetched; the next refresh adds it. */
  cities?: { city: string; country: string; sessions: number; users: number }[];
  /** Absent from snapshots stored before the Google section; the next refresh adds it. */
  organic?: Ga4OrganicData;
}

export type Ga4ReportState =
  | 'NOT_CONNECTED'
  | 'NEEDS_SELECTION'
  | 'NEEDS_REAUTH'
  | 'ERROR'
  | 'NEVER_SYNCED'
  | 'EMPTY'
  | 'READY';

export interface Ga4ReportResponse {
  state: Ga4ReportState;
  /** Why, in words a customer can act on. Null only when READY with nothing wrong. */
  message: string | null;
  range: Ga4Range;
  propertyName: string | null;
  googleAccountEmail: string | null;
  lastSyncedAt: string | null;
  /** The most recent failed refresh, when newer than the data shown. */
  lastError: string | null;
  data: Ga4ReportData | null;
}

/**
 * The GA4 numbers the Dashboard and Google Search pages show.
 *
 * Every read and write here is keyed by a `projectId` that the controller's
 * JwtAuthGuard has already checked the caller belongs to, and the property is
 * always the one stored on that project's own Integration row — never one the
 * request names — so one workspace cannot ask for another's data.
 *
 * Each window (7d / 28d / 90d) is fetched from Google as a whole rather than
 * added up from the daily table: unique users are not additive, so a sum of
 * daily users overstates them.
 */
@Injectable()
export class AnalyticsReportService {
  private readonly logger = new Logger(AnalyticsReportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly oauth: GoogleOAuthService,
  ) {}

  // ── reading ────────────────────────────────────────────────────────────

  async read(projectId: string, range: Ga4Range): Promise<Ga4ReportResponse> {
    const integration = await this.prisma.integration.findUnique({
      where: { projectId_provider: { projectId, provider: 'analytics' } },
      select: {
        status: true,
        statusMessage: true,
        selectedResourceId: true,
        selectedResourceName: true,
        googleAccountEmail: true,
        lastSyncedAt: true,
      },
    });

    const base = {
      range,
      propertyName: integration?.selectedResourceName ?? null,
      googleAccountEmail: integration?.googleAccountEmail ?? null,
      lastSyncedAt: null as string | null,
      lastError: null as string | null,
      data: null as Ga4ReportData | null,
    };

    if (!integration || integration.status === 'DISCONNECTED') {
      return { ...base, state: 'NOT_CONNECTED', message: 'Google Analytics 4 is not connected for this workspace.' };
    }
    if (integration.status === 'NEEDS_REAUTH') {
      return {
        ...base,
        state: 'NEEDS_REAUTH',
        message:
          integration.statusMessage ?? 'Google Analytics access expired or was revoked. Reconnect Google to continue.',
      };
    }
    if (!integration.selectedResourceId) {
      return {
        ...base,
        state: 'NEEDS_SELECTION',
        message: 'Google is connected, but no GA4 property has been chosen yet. Pick one on the Integrations page.',
      };
    }

    const propertyId = integration.selectedResourceId;
    const [snapshot, lastJob] = await Promise.all([
      this.prisma.ga4ReportSnapshot.findUnique({
        where: { projectId_propertyId_range: { projectId, propertyId, range } },
      }),
      this.prisma.dataSyncJob.findFirst({
        where: { projectId, provider: 'analytics', status: { in: ['FAILED', 'PARTIAL'] }, errorMessage: { not: null } },
        orderBy: { startedAt: 'desc' },
        select: { errorMessage: true, startedAt: true },
      }),
    ]);

    // A failure only matters while it is newer than the data on screen.
    const lastError =
      lastJob && (!snapshot || lastJob.startedAt > snapshot.syncedAt) ? (lastJob.errorMessage ?? null) : null;

    if (!snapshot) {
      if (lastError) return { ...base, state: 'ERROR', message: lastError, lastError };
      return {
        ...base,
        state: 'NEVER_SYNCED',
        message: 'No Google Analytics data has been fetched for this workspace yet.',
      };
    }

    const data = snapshot.data as unknown as Ga4ReportData;
    const common = { ...base, lastSyncedAt: snapshot.syncedAt.toISOString(), lastError, data };
    if (data.empty) {
      return {
        ...common,
        state: 'EMPTY',
        message: `Google Analytics returned no sessions, users or views for "${base.propertyName ?? 'this property'}" in the last ${GA4_RANGES[range]} days. Check that the right property is selected and that its data stream is receiving traffic.`,
      };
    }
    return { ...common, state: 'READY', message: null };
  }

  // ── refreshing ─────────────────────────────────────────────────────────

  /**
   * Fetches all three windows and replaces the cached snapshots.
   *
   * All-or-nothing: the snapshots are written together after every request has
   * succeeded, so a failure part-way never leaves the 7d card from today beside
   * a 90d card from last week. On failure the previous snapshots stay in place
   * and the error is thrown in words the customer can act on.
   */
  async refresh(projectId: string): Promise<{ syncedAt: string; property: string }> {
    const integration = await this.prisma.integration.findUnique({
      where: { projectId_provider: { projectId, provider: 'analytics' } },
      select: { selectedResourceId: true, selectedResourceName: true },
    });
    if (!integration) throw new NotFoundException('Google Analytics 4 is not connected for this workspace.');
    if (!integration.selectedResourceId) {
      throw new NotFoundException('No Google Analytics property has been selected for this workspace.');
    }
    const propertyId = integration.selectedResourceId;

    // Throws a plain-language 404/503 for a disconnected or needs-reauth
    // connection, and refreshes the access token (persisting it encrypted).
    const auth = await this.oauth.clientFor(projectId, 'analytics');
    const api = google.analyticsdata({ version: 'v1beta', auth });

    let reports: { range: Ga4Range; data: Ga4ReportData }[];
    try {
      reports = await this.fetchAll(api, propertyId);
    } catch (error: any) {
      await this.handleApiError(projectId, error);
      this.logger.warn(`[GA4 ${projectId}] report refresh failed: ${error?.response?.status ?? error?.code ?? 'error'}`);
      throw googleApiClientError('Google Analytics Data API', error);
    }

    const syncedAt = new Date();
    await this.prisma.$transaction([
      ...reports.map(({ range, data }) =>
        this.prisma.ga4ReportSnapshot.upsert({
          where: { projectId_propertyId_range: { projectId, propertyId, range } },
          create: { projectId, propertyId, range, data: data as unknown as Prisma.InputJsonValue, syncedAt },
          update: { data: data as unknown as Prisma.InputJsonValue, syncedAt },
        }),
      ),
      // Snapshots of a property that is no longer the selected one are dropped
      // rather than kept where they could be mistaken for current data.
      this.prisma.ga4ReportSnapshot.deleteMany({ where: { projectId, propertyId: { not: propertyId } } }),
      this.prisma.integration.update({
        where: { projectId_provider: { projectId, provider: 'analytics' } },
        data: { lastSyncedAt: syncedAt },
      }),
    ]);

    return { syncedAt: syncedAt.toISOString(), property: integration.selectedResourceName ?? propertyId };
  }

  /** Called when a workspace disconnects GA4 or picks a different property. */
  async discard(projectId: string, keepPropertyId?: string) {
    await this.prisma.ga4ReportSnapshot.deleteMany({
      where: { projectId, ...(keepPropertyId ? { propertyId: { not: keepPropertyId } } : {}) },
    });
  }

  // ── Google Analytics Data API ──────────────────────────────────────────

  private async fetchAll(api: any, propertyId: string): Promise<{ range: Ga4Range; data: Ga4ReportData }[]> {
    // One daily series for the longest window; the shorter ones are its tail.
    // Asked first because the response also names the property's time zone,
    // which decides what "yesterday" is.
    const daily = await this.run(api, propertyId, {
      dimensions: ['date'],
      metrics: ['sessions', 'activeUsers'],
      dateRange: rangeDates(90),
      orderBys: [{ dimension: { dimensionName: 'date' } }],
      limit: 200,
    });
    const dailyRows = daily.rows;
    const yesterday = yesterdayIn(daily.timeZone);
    const keyEvents = await this.supportsMetric(api, propertyId, 'keyEvents');
    const revenue = await this.supportsMetric(api, propertyId, 'totalRevenue');
    const dailyBy = new Map<string, { sessions: number; users: number }>();
    for (const row of dailyRows) {
      dailyBy.set(isoDay(row.dimensions[0]), { sessions: row.metrics[0], users: row.metrics[1] });
    }

    // Organic Search only, day by day, for the 90 days; the shorter windows are its tail.
    const organicDaily = await this.run(api, propertyId, {
      dimensions: ['date'],
      metrics: ['sessions', 'activeUsers', ...(keyEvents ? ['keyEvents'] : []), ...(revenue ? ['totalRevenue'] : [])],
      dateRange: rangeDates(90),
      dimensionFilter: ORGANIC_FILTER,
      orderBys: [{ dimension: { dimensionName: 'date' } }],
      limit: 200,
    });
    const organicDailyBy = new Map<string, { sessions: number; users: number; keyEvents: number | null; revenue: number | null }>();
    for (const row of organicDaily.rows) {
      organicDailyBy.set(isoDay(row.dimensions[0]), {
        sessions: row.metrics[0],
        users: row.metrics[1],
        keyEvents: keyEvents ? (row.metrics[2] ?? 0) : null,
        revenue: revenue ? (row.metrics[keyEvents ? 3 : 2] ?? 0) : null,
      });
    }

    const out: { range: Ga4Range; data: Ga4ReportData }[] = [];
    for (const range of Object.keys(GA4_RANGES) as Ga4Range[]) {
      const days = GA4_RANGES[range];
      const dateRange = rangeDates(days);
      const concrete = { startDate: shiftDay(yesterday, -(days - 1)), endDate: yesterday };

      const previous = {
        startDate: shiftDay(concrete.startDate, -days),
        endDate: shiftDay(concrete.startDate, -1),
      };
      const organicMetrics = organicMetricNames(keyEvents, revenue);

      const [totalsResult, pageResult, channelResult, countryResult, cityResult, organicNow, organicBefore, organicPages] =
        await Promise.all([
        this.run(api, propertyId, {
          dimensions: [],
          metrics: [
            'sessions',
            'activeUsers',
            'newUsers',
            'engagedSessions',
            'engagementRate',
            'userEngagementDuration',
            'screenPageViews',
            ...(keyEvents ? ['keyEvents'] : []),
          ],
          dateRange,
          limit: 1,
        }),
        this.run(api, propertyId, {
          dimensions: ['landingPage'],
          metrics: ['sessions', 'engagementRate', ...(keyEvents ? ['keyEvents'] : [])],
          dateRange,
          orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
          limit: TOP_PAGES,
        }),
        this.run(api, propertyId, {
          dimensions: ['sessionDefaultChannelGroup'],
          metrics: ['sessions', 'activeUsers', 'engagementRate', ...(keyEvents ? ['keyEvents'] : [])],
          dateRange,
          orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
          limit: 20,
        }),
        this.run(api, propertyId, {
          dimensions: ['country'],
          metrics: ['sessions', 'activeUsers'],
          dateRange,
          orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
          limit: TOP_COUNTRIES,
        }),
        // Where inside those countries visitors are. The country is fetched
        // with the city because many city names repeat across countries.
        this.run(api, propertyId, {
          dimensions: ['city', 'country'],
          metrics: ['sessions', 'activeUsers'],
          dateRange,
          orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
          limit: TOP_CITIES,
        }),
        // Organic Search only: this window, the equal window before it, and the
        // pages those visits landed on.
        this.run(api, propertyId, {
          dimensions: [],
          metrics: organicMetrics,
          dateRange: concrete,
          dimensionFilter: ORGANIC_FILTER,
          limit: 1,
        }),
        this.run(api, propertyId, {
          dimensions: [],
          metrics: organicMetrics,
          dateRange: previous,
          dimensionFilter: ORGANIC_FILTER,
          limit: 1,
        }),
        this.run(api, propertyId, {
          dimensions: ['landingPage'],
          metrics: organicMetrics,
          dateRange: concrete,
          dimensionFilter: ORGANIC_FILTER,
          orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
          limit: ORGANIC_PAGES,
        }),
      ]);

      const totalsRows = totalsResult.rows;
      const pageRows = pageResult.rows;
      const channelRows = channelResult.rows;
      const countryRows = countryResult.rows;

      // No dimension → GA4 answers with no row at all for a property that
      // recorded nothing, which is a real answer and reads as zeros.
      const t = totalsRows[0]?.metrics ?? [];
      const activeUsers = t[1] ?? 0;
      const totals: Ga4Totals = {
        sessions: t[0] ?? 0,
        activeUsers,
        newUsers: t[2] ?? 0,
        engagedSessions: t[3] ?? 0,
        engagementRate: t[4] ?? 0,
        averageEngagementTimeSec: activeUsers > 0 ? (t[5] ?? 0) / activeUsers : 0,
        views: t[6] ?? 0,
        keyEvents: keyEvents ? (t[7] ?? 0) : null,
      };

      const channels = channelRows.map((row) => ({
        channel: row.dimensions[0] || '(not set)',
        sessions: row.metrics[0],
        users: row.metrics[1],
        organic: row.dimensions[0] === ORGANIC_SEARCH,
        engagementRate: row.metrics[2] ?? 0,
        keyEvents: keyEvents ? (row.metrics[3] ?? 0) : null,
      }));

      out.push({
        range,
        data: {
          startDate: concrete.startDate,
          endDate: concrete.endDate,
          empty: totals.sessions === 0 && totals.activeUsers === 0 && totals.views === 0,
          totals,
          // Days GA4 returned no row for had no traffic; filling them keeps the
          // chart's time axis honest instead of joining across the gap.
          daily: eachDay(concrete.startDate, concrete.endDate).map((date) => ({
            date,
            sessions: dailyBy.get(date)?.sessions ?? 0,
            users: dailyBy.get(date)?.users ?? 0,
          })),
          landingPages: pageRows.map((row) => ({
            page: row.dimensions[0] || '(not set)',
            sessions: row.metrics[0],
            engagementRate: row.metrics[1],
            keyEvents: keyEvents ? (row.metrics[2] ?? 0) : null,
          })),
          channels,
          organicSearchSessions: channels.filter((c) => c.organic).reduce((sum, c) => sum + c.sessions, 0),
          countries: countryRows.map((row) => ({
            country: row.dimensions[0] || '(not set)',
            sessions: row.metrics[0],
            users: row.metrics[1],
          })),
          cities: cityResult.rows.map((row) => ({
            city: row.dimensions[0] || '(not set)',
            country: row.dimensions[1] || '(not set)',
            sessions: row.metrics[0],
            users: row.metrics[1],
          })),
          organic: {
            totals: organicTotals(organicNow.rows[0]?.metrics, keyEvents, revenue),
            // Null when nothing was recorded before this window: there is then
            // no baseline, and a comparison against zero would invent growth.
            previous: hasTraffic(organicBefore.rows[0]?.metrics)
              ? organicTotals(organicBefore.rows[0]?.metrics, keyEvents, revenue)
              : null,
            previousStart: previous.startDate,
            previousEnd: previous.endDate,
            daily: eachDay(concrete.startDate, concrete.endDate).map((date) => ({
              date,
              sessions: organicDailyBy.get(date)?.sessions ?? 0,
              users: organicDailyBy.get(date)?.users ?? 0,
              keyEvents: keyEvents ? (organicDailyBy.get(date)?.keyEvents ?? 0) : null,
              revenue: revenue ? (organicDailyBy.get(date)?.revenue ?? 0) : null,
            })),
            landingPages: organicPages.rows.map((row) => {
              const t = organicTotals(row.metrics, keyEvents, revenue);
              return {
                page: row.dimensions[0] || '(not set)',
                users: t.activeUsers,
                sessions: t.sessions,
                engagedSessions: t.engagedSessions,
                engagementRate: t.engagementRate,
                averageEngagementTimeSec: t.averageEngagementTimeSec,
                views: t.views,
                keyEvents: t.keyEvents,
                revenue: t.revenue,
              };
            }),
          },
        },
      });
    }
    return out;
  }

  /**
   * Whether this property reports an optional metric (key events, revenue).
   *
   * GA4 rejects a whole report that names a metric the property lacks, so this
   * is asked on its own. Only a 400 means "not available"; an auth or quota
   * error is rethrown so it is reported as itself and not as missing data.
   */
  private async supportsMetric(api: any, propertyId: string, metric: string): Promise<boolean> {
    try {
      await this.run(api, propertyId, { dimensions: [], metrics: [metric], dateRange: rangeDates(7), limit: 1 });
      return true;
    } catch (error: any) {
      if ((error?.response?.status ?? error?.code) === 400) return false;
      throw error;
    }
  }

  private async run(
    api: any,
    propertyId: string,
    query: {
      dimensions: string[];
      metrics: string[];
      dateRange: { startDate: string; endDate: string };
      dimensionFilter?: object;
      orderBys?: object[];
      limit: number;
    },
  ): Promise<{ rows: { dimensions: string[]; metrics: number[] }[]; timeZone: string }> {
    const { data } = await api.properties.runReport({
      property: propertyId,
      requestBody: {
        dateRanges: [query.dateRange],
        dimensions: query.dimensions.map((name) => ({ name })),
        metrics: query.metrics.map((name) => ({ name })),
        dimensionFilter: query.dimensionFilter,
        orderBys: query.orderBys,
        limit: query.limit,
      },
    });
    return {
      timeZone: data.metadata?.timeZone ?? 'UTC',
      rows: (data.rows ?? []).map((row: any) => ({
        dimensions: (row.dimensionValues ?? []).map((v: any) => String(v.value ?? '')),
        metrics: (row.metricValues ?? []).map((v: any) => Number(v.value ?? 0)),
      })),
    };
  }

  /** Same split as the daily sync: a missing API is configuration, a rejected grant is reauth. */
  private async handleApiError(projectId: string, error: any) {
    const status = error?.response?.status ?? error?.code;
    if (status !== 401 && status !== 403) return;
    const message: string = error?.response?.data?.error?.message ?? error?.message ?? '';
    if (/has not been used in project|is disabled|SERVICE_DISABLED|accessNotConfigured/i.test(message)) return;
    await this.oauth.markNeedsReauth(projectId, 'analytics', `Google returned ${status} for Analytics.`);
  }
}

/** Restricts a report to visits GA4 attributes to Google's organic results. */
const ORGANIC_FILTER = {
  filter: {
    fieldName: 'sessionDefaultChannelGroup',
    stringFilter: { matchType: 'EXACT', value: ORGANIC_SEARCH },
  },
};

/** The metrics of one organic report, in the fixed order `organicTotals` reads them back. */
function organicMetricNames(keyEvents: boolean, revenue: boolean): string[] {
  return [
    'sessions',
    'activeUsers',
    'newUsers',
    'engagedSessions',
    'engagementRate',
    'userEngagementDuration',
    'screenPageViews',
    ...(keyEvents ? ['keyEvents'] : []),
    ...(revenue ? ['totalRevenue'] : []),
  ];
}

/**
 * Organic totals from one report row. A report with no rows means the property
 * recorded nothing, which reads as zeros. Revenue is null — not zero — when the
 * property reports none, so a business without ecommerce is not shown earning
 * nothing.
 */
function organicTotals(metrics: number[] | undefined, keyEvents: boolean, revenue: boolean): Ga4OrganicTotals {
  const m = metrics ?? [];
  const activeUsers = m[1] ?? 0;
  const revenueValue = revenue ? (m[keyEvents ? 8 : 7] ?? 0) : 0;
  return {
    sessions: m[0] ?? 0,
    activeUsers,
    newUsers: m[2] ?? 0,
    engagedSessions: m[3] ?? 0,
    engagementRate: m[4] ?? 0,
    averageEngagementTimeSec: activeUsers > 0 ? (m[5] ?? 0) / activeUsers : 0,
    views: m[6] ?? 0,
    keyEvents: keyEvents ? (m[7] ?? 0) : null,
    revenue: revenueValue > 0 ? revenueValue : null,
  };
}

/** Whether a totals row recorded any visits at all. */
function hasTraffic(metrics: number[] | undefined): boolean {
  return Boolean(metrics && (metrics[0] > 0 || metrics[1] > 0 || metrics[6] > 0));
}

/** GA4 dates arrive as YYYYMMDD. */
function isoDay(raw: string): string {
  return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
}

/** The N days ending yesterday — what the GA4 interface calls "Last N days". */
function rangeDates(days: number): { startDate: string; endDate: string } {
  return { startDate: `${days}daysAgo`, endDate: 'yesterday' };
}

/** Yesterday in the property's own time zone, as YYYY-MM-DD. */
function yesterdayIn(timeZone: string): string {
  let today: string;
  try {
    today = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(
      new Date(),
    );
  } catch {
    today = new Date().toISOString().slice(0, 10);
  }
  return shiftDay(today, -1);
}

function shiftDay(day: string, delta: number): string {
  const d = new Date(`${day}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

function eachDay(startDate: string, endDate: string): string[] {
  const days: string[] = [];
  for (let d = startDate; d <= endDate; d = shiftDay(d, 1)) days.push(d);
  return days;
}
