import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { google } from 'googleapis';
import { PrismaService } from '../../../database/prisma.service';
import { GoogleOAuthService } from './google-oauth.service';

/**
 * Reads Google Analytics 4 into the GrowthX data layer.
 *
 * GA4 is what turns a search finding into a business one: Search Console says
 * a page gets 8,000 clicks, GA4 says whether any of them did anything. Both
 * key on the landing page, which is what lets the two be joined.
 *
 * The dominating fact about this API is that properties are configured wildly
 * differently. Most have users and sessions; many have no key events marked as
 * conversions; most have no revenue at all. Every method below therefore has
 * to distinguish "measured as zero" from "not measured", and store null for
 * the second — reporting a working business as having zero conversions is
 * worse than saying nothing, because it looks like a finding.
 */
@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  /** GA4 caps a report at 100,000 rows; this is a per-page size well under it. */
  private static readonly PAGE_SIZE = 10000;
  /**
   * GA4 processes most data within hours but can take up to 48. Two days back
   * is a compromise: fresher than Search Console, still clear of the window
   * where figures are actively being revised.
   */
  private static readonly PROCESSING_LAG_DAYS = 2;

  constructor(
    private readonly prisma: PrismaService,
    private readonly oauth: GoogleOAuthService,
  ) {}

  /**
   * GA4 properties this account can read.
   *
   * Account summaries rather than the property list: they arrive already
   * grouped by account with display names, which is what a customer with
   * several properties needs to tell "Website" from "Website (staging)".
   */
  async listProperties(projectId: string) {
    const auth = await this.oauth.clientFor(projectId, 'analytics');
    const admin = google.analyticsadmin({ version: 'v1beta', auth });

    try {
      const { data } = await admin.accountSummaries.list({ pageSize: 200 });
      return (data.accountSummaries ?? []).flatMap((account) =>
        (account.propertySummaries ?? []).map((property) => ({
          // "properties/123456789" — the form the Data API expects, kept whole
          // so nothing has to reassemble it later.
          propertyId: property.property!,
          displayName: property.displayName ?? property.property!,
          accountName: account.displayName ?? '',
        })),
      );
    } catch (error) {
      await this.handleApiError(projectId, error);
      throw error;
    }
  }

  /**
   * Fetches and stores GA4 data for a window.
   *
   * Incremental, like the Search Console sync, and for the same reason: a full
   * re-pull of a year on every run is quota spent on data that has not moved.
   */
  async sync(projectId: string, options: { days?: number; full?: boolean } = {}) {
    const integration = await this.prisma.integration.findUnique({
      where: { projectId_provider: { projectId, provider: 'analytics' } },
      select: { selectedResourceId: true },
    });
    if (!integration?.selectedResourceId) {
      throw new NotFoundException('No Google Analytics property has been selected for this project.');
    }
    const propertyId = integration.selectedResourceId;

    const job = await this.prisma.dataSyncJob.create({
      data: { projectId, provider: 'analytics', status: 'RUNNING' },
    });

    try {
      const { start, end } = await this.windowFor(projectId, propertyId, options);
      await this.prisma.dataSyncJob.update({ where: { id: job.id }, data: { rangeStart: start, rangeEnd: end } });

      const auth = await this.oauth.clientFor(projectId, 'analytics');
      const api = google.analyticsdata({ version: 'v1beta', auth });

      // Which of the optional metrics this property actually reports. Asking
      // for a metric a property does not have makes GA4 reject the whole
      // request, so this is established once and the grains built around it.
      const available = await this.availableMetrics(api, propertyId);

      const grains: { grain: string; dimensions: string[] }[] = [
        { grain: 'TOTAL', dimensions: ['date'] },
        // The join to Search Console. GA4's landing page is a path, GSC's is a
        // full URL; the reconciliation happens at read time.
        { grain: 'LANDING_PAGE', dimensions: ['date', 'landingPagePlusQueryString'] },
        { grain: 'CHANNEL', dimensions: ['date', 'sessionDefaultChannelGroup'] },
      ];

      let rowsWritten = 0;
      const failures: string[] = [];

      for (const { grain, dimensions } of grains) {
        try {
          rowsWritten += await this.fetchGrain(api, {
            projectId,
            propertyId,
            grain,
            dimensions,
            start,
            end,
            available,
          });
        } catch (error: any) {
          this.logger.warn(`[GA4 ${projectId}] ${grain} failed: ${error.message}`);
          failures.push(grain);
          await this.handleApiError(projectId, error);
        }
      }

      const status = failures.length === 0 ? 'SUCCEEDED' : failures.length === grains.length ? 'FAILED' : 'PARTIAL';
      await this.prisma.dataSyncJob.update({
        where: { id: job.id },
        data: {
          status,
          rowsWritten,
          finishedAt: new Date(),
          errorMessage: failures.length ? `Could not fetch: ${failures.join(', ')}.` : null,
        },
      });

      if (status !== 'FAILED') {
        await this.prisma.integration.update({
          where: { projectId_provider: { projectId, provider: 'analytics' } },
          data: { lastSyncedAt: new Date() },
        });
      }

      return { status, rowsWritten, start, end, failedGrains: failures, metricsAvailable: available };
    } catch (error: any) {
      await this.prisma.dataSyncJob.update({
        where: { id: job.id },
        data: { status: 'FAILED', finishedAt: new Date(), errorMessage: error.message?.slice(0, 500) },
      });
      throw error;
    }
  }

  /**
   * Which optional metrics this property reports.
   *
   * Probed with a one-day request rather than assumed. GA4 rejects an entire
   * report if it names a metric the property does not have, so asking for
   * conversions on a property with no key events would lose users and sessions
   * along with it. Probing separately means a property with nothing configured
   * still gets the metrics it does have.
   */
  private async availableMetrics(api: any, propertyId: string): Promise<{ conversions: boolean; revenue: boolean }> {
    const probe = async (metric: string) => {
      try {
        await api.properties.runReport({
          property: propertyId,
          requestBody: {
            dateRanges: [{ startDate: '7daysAgo', endDate: 'yesterday' }],
            metrics: [{ name: metric }],
            limit: 1,
          },
        });
        return true;
      } catch {
        return false;
      }
    };

    const [conversions, revenue] = await Promise.all([probe('keyEvents'), probe('totalRevenue')]);
    if (!conversions) {
      this.logger.log(`[GA4] property ${propertyId} reports no key events; conversions will be stored as unknown.`);
    }
    return { conversions, revenue };
  }

  private async windowFor(
    projectId: string,
    propertyId: string,
    options: { days?: number; full?: boolean },
  ): Promise<{ start: Date; end: Date }> {
    const end = new Date();
    end.setUTCDate(end.getUTCDate() - AnalyticsService.PROCESSING_LAG_DAYS);
    end.setUTCHours(0, 0, 0, 0);

    if (!options.full) {
      const newest = await this.prisma.ga4DailyMetric.findFirst({
        where: { projectId, propertyId, grain: 'TOTAL' },
        orderBy: { date: 'desc' },
        select: { date: true },
      });
      if (newest) {
        const start = new Date(newest.date);
        // GA4 revises recent days as processing completes, same as GSC.
        start.setUTCDate(start.getUTCDate() - AnalyticsService.PROCESSING_LAG_DAYS);
        if (start < end) return { start, end };
      }
    }

    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - (options.days ?? 90));
    return { start, end };
  }

  private async fetchGrain(
    api: any,
    input: {
      projectId: string;
      propertyId: string;
      grain: string;
      dimensions: string[];
      start: Date;
      end: Date;
      available: { conversions: boolean; revenue: boolean };
    },
  ): Promise<number> {
    const { projectId, propertyId, grain, dimensions, start, end, available } = input;

    const metrics = [
      { name: 'activeUsers' },
      { name: 'sessions' },
      { name: 'engagementRate' },
      ...(available.conversions ? [{ name: 'keyEvents' }] : []),
      ...(available.revenue ? [{ name: 'totalRevenue' }] : []),
    ];

    // Cleared before rewriting, so revised days replace rather than collide.
    await this.prisma.ga4DailyMetric.deleteMany({
      where: { projectId, propertyId, grain, date: { gte: start, lte: end } },
    });

    let offset = 0;
    let written = 0;

    for (;;) {
      const { data } = await api.properties.runReport({
        property: propertyId,
        requestBody: {
          dateRanges: [{ startDate: iso(start), endDate: iso(end) }],
          dimensions: dimensions.map((name) => ({ name })),
          metrics,
          limit: AnalyticsService.PAGE_SIZE,
          offset,
        },
      });

      const rows = data.rows ?? [];
      if (rows.length === 0) break;

      // Header order is authoritative; positional assumptions break the moment
      // an optional metric is absent.
      const metricIndex = new Map<string, number>(
        (data.metricHeaders ?? []).map((header: any, index: number) => [header.name, index]),
      );
      const dimensionIndex = new Map<string, number>(
        (data.dimensionHeaders ?? []).map((header: any, index: number) => [header.name, index]),
      );

      await this.storeRows(projectId, propertyId, grain, rows, metricIndex, dimensionIndex, available);
      written += rows.length;

      if (rows.length < AnalyticsService.PAGE_SIZE) break;
      offset += rows.length;
    }

    return written;
  }

  private async storeRows(
    projectId: string,
    propertyId: string,
    grain: string,
    rows: any[],
    metricIndex: Map<string, number>,
    dimensionIndex: Map<string, number>,
    available: { conversions: boolean; revenue: boolean },
  ) {
    const dimension = (row: any, name: string) => {
      const index = dimensionIndex.get(name);
      return index === undefined ? '' : (row.dimensionValues?.[index]?.value ?? '');
    };
    const metric = (row: any, name: string) => {
      const index = metricIndex.get(name);
      return index === undefined ? null : Number(row.metricValues?.[index]?.value ?? 0);
    };

    const records = rows.map((row) => {
      const raw = dimension(row, 'date'); // GA4 returns YYYYMMDD
      return {
        projectId,
        propertyId,
        date: new Date(`${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}T00:00:00.000Z`),
        grain,
        // Empty string rather than null, for the same reason as the Search
        // Console table: Postgres treats NULLs as distinct in a unique index,
        // so nulls here would let every re-sync insert duplicates.
        landingPage: dimension(row, 'landingPagePlusQueryString'),
        channel: dimension(row, 'sessionDefaultChannelGroup'),
        country: dimension(row, 'country'),
        device: dimension(row, 'deviceCategory'),
        users: metric(row, 'activeUsers') ?? 0,
        sessions: metric(row, 'sessions') ?? 0,
        engagementRate: metric(row, 'engagementRate') ?? 0,
        // Null, not zero, when the property does not report it at all. This is
        // the difference between "nobody converted" and "conversions are not
        // set up", and only one of those is a fact about the business.
        conversions: available.conversions ? (metric(row, 'keyEvents') ?? 0) : null,
        revenue: available.revenue ? (metric(row, 'totalRevenue') ?? 0) : null,
      };
    });

    const CHUNK = 1000;
    for (let i = 0; i < records.length; i += CHUNK) {
      await this.prisma.ga4DailyMetric.createMany({ data: records.slice(i, i + CHUNK), skipDuplicates: true });
    }
  }

  private async handleApiError(projectId: string, error: any) {
    const status = error?.response?.status ?? error?.code;
    if (status === 401 || status === 403) {
      await this.oauth.markNeedsReauth(projectId, 'analytics', `Google returned ${status} for Analytics.`);
    }
  }
}

function iso(date: Date): string {
  return date.toISOString().slice(0, 10);
}
