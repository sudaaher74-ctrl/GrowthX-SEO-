import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../database/prisma.service';
import { AiVisibilityService } from './ai-visibility.service';

/**
 * Daily citation sweep. The dashboard's trend line is only meaningful if the
 * checks run on a schedule rather than when someone happens to open the page.
 */
@Injectable()
export class AiVisibilityScheduler {
  private readonly logger = new Logger(AiVisibilityScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly visibility: AiVisibilityService,) {}

  /** 06:00 UTC, matching the rank-tracking cadence the dashboard advertises. */
  @Cron('0 6 * * *')
  async handleDailySweep(): Promise<void> {
    if (process.env.AI_VISIBILITY_SWEEP_ENABLED === 'false') {
      this.logger.log('Daily AI visibility sweep is disabled by configuration.');
      return;
    }

    const projects = await this.prisma.project.findMany({
      where: { prompts: { some: { isActive: true } } },
      select: { id: true, name: true, organizationId: true },
    });

    this.logger.log(`Daily AI visibility sweep: ${projects.length} project(s) with active prompts.`);

    for (const project of projects) {
      try {

        const result = await this.visibility.sweepProject(project.id);
        this.logger.log(
          `${project.name}: ${result.checksRun} checks, ${result.citations} citations, ` +
            `${result.checksFailed} failed.`,
        );
      } catch (error: any) {
        // One bad project must not abort the sweep for everyone else.
        this.logger.error(`Sweep failed for project ${project.id}: ${error.message}`);
      }
    }
  }

  /** Exposed for the admin "run now" path and for tests. */
  async sweepOne(projectId: string) {
    return this.visibility.sweepProject(projectId);
  }
}
