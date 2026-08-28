import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { google } from 'googleapis';
import { PrismaService } from '../../../database/prisma.service';
import { GoogleOAuthService } from './google-oauth.service';

/**
 * Reads Google Search Console into the GrowthX data layer.
 *
 * A connector, not an engine. Nothing here decides what anything means — it
 * fetches what Google reports, normalises it, and stores it so Keyword
 * Intelligence, Business Intelligence, Monitoring and the Executive Dashboard
 * can read one local table instead of each calling Google separately.
 *
 * Three properties of the API shape everything below, and getting any of them
 * wrong produces numbers that quietly disagree with what the customer sees in
 * Search Console itself:
 *
 *  - Data lags by two to three days, and recent days are restated as they
 *    finalise. So recent days are deliberately re-fetched rather than assumed
 *    settled, and the freshest date we hold is reported rather than "today".
 *  - History is capped at 16 months. A request for more is not an error to
 *    swallow; the customer is told what was actually available.
 *  - Rare queries are withheld for privacy, so the query rows never sum to the
 *    property totals. Both grains are stored, and totals come from the totals
 *    row rather than by summing queries.
 */
@Injectable()
export class SearchConsoleService {
  private readonly logger = new Logger(SearchConsoleService.name);

  /** Google's hard cap per request. */
  private static readonly ROW_LIMIT = 25000;
  /** Google's history limit. Requests beyond it return nothing, not an error. */
  static readonly MAX_HISTORY_DAYS = 16 * 30;
  /**
   * Search Console finalises data over roughly three days. Re-fetching that
   * window on every sync is what keeps stored numbers matching the Search
   * Console UI as Google restates them.
   */
  static readonly RESTATEMENT_WINDOW_DAYS = 4;

  constructor(
    private readonly prisma: PrismaService,
    private readonly oauth: GoogleOAuthService,
  ) {}

  private async api(projectId: string) {
    const auth = await this.oauth.clientFor(projectId, 'search_console');
    return google.searchconsole({ version: 'v1', auth });
  }

  /**
   * The properties this Google account can read.
   *
   * Shown so the customer picks one explicitly. A site can be verified several
   * ways — https://example.com, https://www.example.com and
   * sc-domain:example.com are three different properties with different data —
   * and guessing which one they meant would silently report a fraction of
   * their traffic.
   */
  async listProperties(projectId: string) {
    const api = await this.api(projectId);
    try {
      const { data } = await api.sites.list();
      return (data.siteEntry ?? [])
        // Properties where permission was granted but never accepted return
        // nothing; offering them leads to an empty dashboard with no reason.
        .filter((site) => site.permissionLevel !== 'siteUnverifiedUser')
        .map((site) => ({
          propertyId: site.siteUrl!,
          // A domain property covers every subdomain and protocol, which is
          // usually what someone wants; worth marking so the choice is informed.
          kind: site.siteUrl?.startsWith('sc-domain:') ? 'DOMAIN' : 'URL_PREFIX',
          permissionLevel: site.permissionLevel,
        }));
    } catch (error) {
      await this.handleApiError(projectId, error);
      throw error;
    }
  }

  /**
   * Fetches and stores Search Console data for a window.
   *
   * Incremental by default: only days not already held, plus the restatement
   * window. A full re-fetch of 16 months on every run would burn quota for
   * data that has not changed.
   */
  async sync(projectId: string, options: { days?: number; full?: boolean } = {}) {
    const integration = await this.prisma.integration.findUnique({
      where: { projectId_provider: { projectId, provider: 'search_console' } },
      select: { selectedResourceId: true, status: true },
    });
    if (!integration?.selectedResourceId) {
      throw new NotFoundException('No Search Console property has been selected for this project.');
    }
    const propertyId = integration.selectedResourceId;

    const job = await this.prisma.dataSyncJob.create({
      data: { projectId, provider: 'search_console', status: 'RUNNING' },
    });

    try {
      const { start, end } = await this.windowFor(projectId, propertyId, options);
      await this.prisma.dataSyncJob.update({
        where: { id: job.id },
        data: { rangeStart: start, rangeEnd: end },
      });

      const api = await this.api(projectId);
      let rowsWritten = 0;
      const failures: string[] = [];

      // Each grain is a separate request because Google keys rows by the
      // dimension tuple asked for. They are fetched in sequence rather than in
      // parallel: the quota is per property, and three concurrent paginated
      // pulls is the fastest way to hit it.
      const grains: { grain: string; dimensions: string[] }[] = [
        { grain: 'TOTAL', dimensions: ['date'] },
        { grain: 'QUERY', dimensions: ['date', 'query'] },
        { grain: 'PAGE', dimensions: ['date', 'page'] },
        // The link between a search term and the page that answered it. This
        // is what Keyword Intelligence needs, and what a GA4 conversion later
        // joins to.
        { grain: 'QUERY_PAGE', dimensions: ['date', 'query', 'page'] },
      ];

      for (const { grain, dimensions } of grains) {
        try {
          rowsWritten += await this.fetchGrain(api, { projectId, propertyId, grain, dimensions, start, end });
        } catch (error: any) {
          // One grain failing is not a reason to discard the others. A sync
          // that got totals and pages but not queries is worth keeping, and
          // worth flagging as incomplete rather than recorded as success.
          this.logger.warn(`[GSC ${projectId}] ${grain} failed: ${error.message}`);
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
          where: { projectId_provider: { projectId, provider: 'search_console' } },
          data: { lastSyncedAt: new Date() },
        });
      }

      return { status, rowsWritten, start, end, failedGrains: failures };
    } catch (error: any) {
      await this.prisma.dataSyncJob.update({
        where: { id: job.id },
        data: { status: 'FAILED', finishedAt: new Date(), errorMessage: error.message?.slice(0, 500) },
      });
      throw error;
    }
  }

  /**
   * Which days to fetch.
   *
   * The end is not today: Search Console has no data for the last two to three
   * days, and asking for it returns empty rows that would then look like a
   * traffic collapse.
   */
  private async windowFor(
    projectId: string,
    propertyId: string,
    options: { days?: number; full?: boolean },
  ): Promise<{ start: Date; end: Date }> {
    const end = new Date();
    end.setUTCDate(end.getUTCDate() - 3);
    end.setUTCHours(0, 0, 0, 0);

    const requested = Math.min(options.days ?? 90, SearchConsoleService.MAX_HISTORY_DAYS);

    if (!options.full) {
      const newest = await this.prisma.gscDailyMetric.findFirst({
        where: { projectId, propertyId, grain: 'TOTAL' },
        orderBy: { date: 'desc' },
        select: { date: true },
      });
      if (newest) {
        // Back up over the restatement window so days Google has since
        // revised are corrected rather than left at their first value.
        const start = new Date(newest.date);
        start.setUTCDate(start.getUTCDate() - SearchConsoleService.RESTATEMENT_WINDOW_DAYS);
        if (start < end) return { start, end };
      }
    }

    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - requested);
    return { start, end };
  }

  private async fetchGrain(
    api: any,
    input: { projectId: string; propertyId: string; grain: string; dimensions: string[]; start: Date; end: Date },
  ): Promise<number> {
    const { projectId, propertyId, grain, dimensions, start, end } = input;

    // The window is cleared before it is rewritten. Google restates recent
    // days as data finalises, and this window is re-fetched precisely to pick
    // those corrections up — inserting over the top with skipDuplicates would
    // keep the first, wrong value and make the re-fetch pointless. Scoped to
    // one property, one grain and this date range, so history outside the
    // window is untouched.
    await this.prisma.gscDailyMetric.deleteMany({
      where: { projectId, propertyId, grain, date: { gte: start, lte: end } },
    });

    let startRow = 0;
    let written = 0;

    for (;;) {
      const { data } = await api.searchanalytics.query({
        siteUrl: propertyId,
        requestBody: {
          startDate: iso(start),
          endDate: iso(end),
          dimensions,
          rowLimit: SearchConsoleService.ROW_LIMIT,
          startRow,
          // 'all' includes days Google has not finalised. Those are the most
          // recent days and the ones a customer looks at first; excluding them
          // makes the chart end three days early for no reason. They are
          // re-fetched on the next sync anyway.
          dataState: 'all',
        },
      });

      const rows = data.rows ?? [];
      if (rows.length === 0) break;

      await this.storeRows(projectId, propertyId, grain, dimensions, rows);
      written += rows.length;

      if (rows.length < SearchConsoleService.ROW_LIMIT) break;
      startRow += rows.length;
    }

    return written;
  }

  private async storeRows(
    projectId: string,
    propertyId: string,
    grain: string,
    dimensions: string[],
    rows: any[],
  ) {
    const records = rows.map((row) => {
      const keys: Record<string, string> = {};
      dimensions.forEach((dimension, index) => {
        keys[dimension] = row.keys?.[index] ?? '';
      });
      return {
        projectId,
        propertyId,
        date: new Date(`${keys.date}T00:00:00.000Z`),
        grain,
        // Empty string rather than null for absent dimensions: the unique
        // constraint treats two NULLs as distinct in Postgres, so a null here
        // would let the same row insert repeatedly on every re-sync.
        query: keys.query ?? '',
        page: keys.page ?? '',
        country: keys.country ?? '',
        device: keys.device ?? '',
        clicks: Math.round(row.clicks ?? 0),
        impressions: Math.round(row.impressions ?? 0),
        ctr: row.ctr ?? 0,
        position: row.position ?? 0,
      };
    });

    // Chunked so a large property does not build one enormous statement.
    const CHUNK = 1000;
    for (let i = 0; i < records.length; i += CHUNK) {
      await this.prisma.gscDailyMetric.createMany({
        data: records.slice(i, i + CHUNK),
        // The window was cleared above, so this is a plain insert. The flag is
        // belt and braces against a second sync overlapping the first — two
        // concurrent runs should leave one copy, not fail the whole batch.
        skipDuplicates: true,
      });
    }
  }

  /**
   * Turns a Google error into a connection state the customer can act on.
   *
   * A 401 or 403 on a token means the grant is gone — that is a reconnect, not
   * a retry, and saying so is the difference between a customer fixing it and
   * watching an integration silently stop.
   */
  private async handleApiError(projectId: string, error: any) {
    const status = error?.response?.status ?? error?.code;
    if (status === 401 || status === 403) {
      await this.oauth.markNeedsReauth(
        projectId,
        'search_console',
        `Google returned ${status} for Search Console.`,
      );
    }
  }
}

function iso(date: Date): string {
  return date.toISOString().slice(0, 10);
}
