import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../database/prisma.service';
import { DataForSeoService } from './dataforseo.service';
import { IndexStatusService } from './index-status.service';
import { RankTrackingService } from './rank-tracking.service';

/** Pages re-asked about per project each week, well inside Google's 2,000 a day. */
const WEEKLY_INSPECTIONS = 200;

/**
 * The weekly Google checks. Rank history and index status are only useful as
 * a series, and a series only exists if someone takes the readings on a
 * schedule rather than when a screen is opened.
 */
@Injectable()
export class SearchIntelligenceScheduler {
  private readonly logger = new Logger(SearchIntelligenceScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly dataforseo: DataForSeoService,
    private readonly ranks: RankTrackingService,
    private readonly indexStatus: IndexStatusService,
  ) {}

  private enabled(): boolean {
    return process.env.SEARCH_INTELLIGENCE_SCHEDULE_ENABLED !== 'false';
  }

  /** Mondays 05:10 UTC. */
  @Cron('10 5 * * 1')
  async weeklyRankCheck(): Promise<void> {
    if (!this.enabled() || !this.dataforseo.isConfigured()) return;
    const projects = await this.prisma.project.findMany({
      where: { trackedKeywords: { some: { isActive: true } } },
      select: { id: true, name: true },
    });
    this.logger.log(`Weekly rank check: ${projects.length} project(s).`);
    for (const project of projects) {
      try {
        const { checked, failed } = await this.ranks.checkAll(project.id);
        this.logger.log(`${project.name}: ${checked} keyword(s) checked, ${failed.length} failed.`);
        if (failed.some((f) => /login and password|run out of credit/i.test(f))) break;
      } catch (error: any) {
        this.logger.error(`Rank check failed for project ${project.id}: ${error?.message}`);
      }
    }
  }

  /** Sundays 04:20 UTC. */
  @Cron('20 4 * * 0')
  async weeklyIndexCheck(): Promise<void> {
    if (!this.enabled()) return;
    const connected = await this.prisma.integration.findMany({
      where: { provider: 'search_console', status: 'CONNECTED', selectedResourceId: { not: null } },
      select: { projectId: true },
    });
    this.logger.log(`Weekly index check: ${connected.length} project(s) with Search Console.`);
    for (const { projectId } of connected) {
      try {
        const outcome = await this.indexStatus.inspect(projectId, { limit: WEEKLY_INSPECTIONS });
        this.logger.log(`[${projectId}] Index check: ${outcome.inspected} checked, ${outcome.failed} failed.`);
      } catch (error: any) {
        this.logger.error(`Index check failed for project ${projectId}: ${error?.message}`);
      }
    }
  }
}
