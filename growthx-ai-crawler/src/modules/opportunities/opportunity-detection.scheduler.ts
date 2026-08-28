import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../database/prisma.service';
import { OpportunityDetectionService } from './opportunity-detection.service';

/**
 * Re-runs detection daily so the list reflects the newest data.
 *
 * An hour after the Google sync rather than triggered by it. A direct trigger
 * would mean IntegrationsModule depending on this module while this one
 * already depends on it, and an event bus is more machinery than the problem
 * needs. Running on its own timer is also more robust: detection still runs
 * when a sync fails, using the competitor and crawl data that is already
 * there, and the competitor half of every finding needs no Google connection
 * at all.
 */
@Injectable()
export class OpportunityDetectionScheduler {
  private readonly logger = new Logger(OpportunityDetectionScheduler.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly detection: OpportunityDetectionService,
  ) {}

  @Cron('0 5 * * *')
  async detectForActiveProjects() {
    if (this.running) {
      this.logger.warn('Opportunity detection skipped: the previous run has not finished.');
      return;
    }
    this.running = true;

    try {
      // Only projects with something to compare. Detection over a project with
      // no crawl and no competitor produces nothing and costs a round trip per
      // project, which on a growing account is the bulk of the run.
      const projects = await this.prisma.project.findMany({
        where: {
          OR: [
            { competitors: { some: { websiteId: { not: null } } } },
            { integrations: { some: { provider: 'search_console', status: 'CONNECTED' } } },
          ],
        },
        select: { id: true, organizationId: true },
      });

      if (projects.length === 0) return;
      this.logger.log(`Detecting opportunities for ${projects.length} project(s).`);

      for (const project of projects) {
        try {
          const result = await this.detection.detect(project.organizationId, project.id);
          if (result.failedDetectors.length > 0) {
            this.logger.warn(`[${project.id}] detectors failed: ${result.failedDetectors.join(', ')}`);
          }
        } catch (error: any) {
          // One project's failure must not stop the rest.
          this.logger.error(`[${project.id}] opportunity detection failed: ${error.message}`);
        }
      }
    } finally {
      this.running = false;
    }
  }
}
