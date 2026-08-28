import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../../database/prisma.service';
import { SearchConsoleService } from './search-console.service';

/**
 * Keeps connected Google sources up to date, off the request path.
 *
 * A sync paginates through months of rows and can take minutes; doing it
 * inside a page request would time out and would re-fetch the same data for
 * every viewer. Everything here runs on a timer instead, and the dashboard
 * only ever reads local tables.
 *
 * Once a day, not hourly. Search Console publishes a day at a time with a two
 * to three day lag, so a more frequent schedule spends quota re-fetching data
 * that cannot have changed. The exception is the restatement window the
 * connector always re-reads, which is what picks up Google's corrections.
 */
@Injectable()
export class GoogleSyncScheduler {
  private readonly logger = new Logger(GoogleSyncScheduler.name);

  /**
   * Guards against a run starting while the previous one is still going.
   * A slow sync that outlives its interval would otherwise stack up, and two
   * runs writing the same window is wasted quota at best.
   */
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly searchConsole: SearchConsoleService,
  ) {}

  /**
   * Early morning UTC, after Google has published the previous day for most
   * time zones and while traffic on this deployment is lowest.
   */
  @Cron('0 4 * * *')
  async syncConnectedSources() {
    if (this.running) {
      this.logger.warn('Google sync skipped: the previous run has not finished.');
      return;
    }
    this.running = true;

    try {
      const connections = await this.prisma.integration.findMany({
        where: {
          provider: 'search_console',
          // Only connections that can actually be read. NEEDS_REAUTH and
          // NEEDS_SELECTION are states a person has to resolve; retrying them
          // on a timer burns quota and buries the real failures in the log.
          status: 'CONNECTED',
          selectedResourceId: { not: null },
        },
        select: { projectId: true },
      });

      if (connections.length === 0) return;
      this.logger.log(`Syncing Search Console for ${connections.length} project(s).`);

      // Sequential. Google's quota is per application as well as per property,
      // and running every customer's sync at once is the reliable way to
      // exhaust it and fail all of them instead of some.
      for (const { projectId } of connections) {
        try {
          const result = await this.searchConsole.sync(projectId);
          await this.prisma.integration.update({
            where: { projectId_provider: { projectId, provider: 'search_console' } },
            data: { nextSyncAt: nextRun() },
          });
          this.logger.log(`[GSC ${projectId}] ${result.status}, ${result.rowsWritten} rows.`);
        } catch (error: any) {
          // One customer's failure must not stop the rest. The connector has
          // already recorded why against that project, and marked the
          // connection as needing reauthorization if that is the reason.
          this.logger.error(`[GSC ${projectId}] sync failed: ${error.message}`);
        }
      }
    } finally {
      this.running = false;
    }
  }
}

/** Tomorrow at the scheduled hour, for showing the customer when data refreshes. */
function nextRun(): Date {
  const next = new Date();
  next.setUTCDate(next.getUTCDate() + 1);
  next.setUTCHours(4, 0, 0, 0);
  return next;
}
