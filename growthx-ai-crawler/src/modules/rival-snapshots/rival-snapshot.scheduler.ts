import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../database/prisma.service';
import { RivalSnapshotService } from './rival-snapshot.service';

@Injectable()
export class RivalSnapshotScheduler {
  private readonly logger = new Logger(RivalSnapshotScheduler.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly snapshots: RivalSnapshotService,
  ) {}

  /** 03:00 UTC, an hour before the Google sync, while traffic is lowest. */
  @Cron('0 3 * * *')
  async snapshotAllRivals() {
    if (process.env.COMPETITOR_CRON_ENABLED === 'false') return;
    if (this.running) {
      this.logger.warn('Rival snapshots skipped: the previous run has not finished.');
      return;
    }
    this.running = true;
    try {
      const rows = await this.prisma.competitorDomain.findMany({ select: { domain: true }, distinct: ['domain'] });
      // Sequential: one rival site at a time, never several at once.
      for (const { domain } of rows) {
        try {
          const result = await this.snapshots.snapshotDomain(domain);
          this.logger.log(
            `[${domain}] fetched ${result.fetched}, changed ${result.written}, robots-blocked ${result.skippedByRobots}`,
          );
        } catch (err) {
          this.logger.warn(`[${domain}] snapshot failed: ${(err as Error).message}`);
        }
      }
    } finally {
      this.running = false;
    }
  }
}
