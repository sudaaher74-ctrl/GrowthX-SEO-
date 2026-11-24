import { Injectable, Logger, Optional } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Prisma, Project } from '@prisma/client';
import { decryptToken } from '../integrations/google/token-crypto';
import { google } from '../integrations/google/google-apis';
import { StorageService } from '../../storage/storage.service';

const GOOGLE_REVOKE_TIMEOUT_MS = 3_000;
const CRAWL_DELETE_JOB_BATCH_SIZE = 25;

@Injectable()
export class ProjectsService {
  private readonly logger = new Logger(ProjectsService.name);

  constructor(
    private prisma: PrismaService,
    @Optional() private readonly storage?: StorageService,
  ) {}

  async createProject(data: Prisma.ProjectCreateInput): Promise<Project> {
    return this.prisma.project.create({ data });
  }

  async getProjectsByOrganization(organizationId: string): Promise<Project[]> {
    return this.prisma.project.findMany({
      where: { organizationId },
    });
  }

  async getProjectById(id: string): Promise<Project | null> {
    return this.prisma.project.findUnique({
      where: { id },
    });
  }

  /**
   * Deletes a project and everything hung off it quickly and safely.
   *
   * 1. Revokes connected Google OAuth grants (bounded by a 3s timeout so slow
   *    external networks cannot stall project deletion).
   * 2. Cancels active/pending crawl jobs and snapshots all associated job IDs.
   * 3. Removes CatalogProduct/MarketingSignal & auxiliary records first so
   *    deleting Pages does not fire unindexed SET NULL cascades.
   * 4. Purges giant crawl child tables (`AIRecommendation`, `Issue`, `Link`,
   *    `Image`, `Schema`, `Performance`, `AeoMetrics`, `InternalGraph`,
   *    `SiteSocialLink`, `CrawlFrontier`, `Page`, `CrawlJob`) bottom-up in
   *    set-based batches rather than one slow row-by-row PostgreSQL cascade.
   * 5. Atomically deletes competitor websites, own websites, and the project.
   * 6. Deletes local HTML snapshot files belonging to the removed crawl jobs.
   */
  async deleteProject(id: string): Promise<void> {
    // 1. Best-effort Google grant revocation with hard timeout
    try {
      const integrations = await this.prisma.integration.findMany({
        where: { projectId: id },
      });
      await Promise.allSettled(
        integrations.map(async (integration) => {
          if (!integration.refreshToken) return;
          try {
            const raw = decryptToken(integration.refreshToken);
            const client = new google.auth.OAuth2(
              process.env.GOOGLE_CLIENT_ID,
              process.env.GOOGLE_CLIENT_SECRET,
            );
            await Promise.race([
              client.revokeToken(raw),
              new Promise<void>((resolve) => {
                const timer = setTimeout(resolve, GOOGLE_REVOKE_TIMEOUT_MS);
                timer.unref?.();
              }),
            ]);
          } catch (err: any) {
            this.logger.warn(`Could not revoke Google grant on project deletion: ${err.message}`);
          }
        }),
      );
    } catch (err: any) {
      this.logger.warn(`Failed reading integrations for project deletion: ${err.message}`);
    }

    // 2. Collect all associated websites & crawl jobs and cancel active runs immediately
    const websiteWhere = {
      OR: [{ projectId: id }, { scope: `competitor:${id}` }],
    };

    let crawlJobIds: string[] = [];
    try {
      await this.prisma.crawlJob.updateMany({
        where: {
          website: websiteWhere,
          status: { in: ['PENDING', 'RUNNING'] },
        },
        data: { status: 'CANCELLED' },
      });
      if (this.prisma.crawlJob?.findMany) {
        const jobs = await this.prisma.crawlJob.findMany({
          where: { website: websiteWhere },
          select: { id: true },
        });
        crawlJobIds = jobs.map((j) => j.id);
      }
    } catch {
      // Best-effort job cancellation & discovery
    }

    // 3. Clean up uncascaded auxiliary project records and Page-referencing leaf tables first
    try {
      await Promise.allSettled([
        this.prisma.autopilotRun?.deleteMany({ where: { projectId: id } }),
        this.prisma.auditReportSnapshot?.deleteMany({ where: { projectId: id } }),
        this.prisma.competitorReportSnapshot?.deleteMany({ where: { projectId: id } }),
        this.prisma.googleReportSnapshot?.deleteMany({ where: { projectId: id } }),
        this.prisma.businessStrategySnapshot?.deleteMany({ where: { projectId: id } }),
        this.prisma.savedPlan?.deleteMany({ where: { projectId: id } }),
        this.prisma.actionStepDone?.deleteMany({ where: { projectId: id } }),
        this.prisma.fixIntervention?.deleteMany({ where: { projectId: id } }),
        this.prisma.catalogProduct?.deleteMany({ where: { projectId: id } }),
        this.prisma.marketingSignal?.deleteMany({ where: { projectId: id } }),
      ]);
    } catch (err: any) {
      this.logger.warn(`Auxiliary project record cleanup warning: ${err.message}`);
    }

    // 4. Clean up Recommendation and Evidence explicitly to avoid ON DELETE RESTRICT violations
    try {
      await this.prisma.recommendation?.deleteMany({ where: { projectId: id } });
      await this.prisma.evidence?.deleteMany({ where: { projectId: id } });
    } catch (err: any) {
      this.logger.warn(`Recommendation/Evidence cleanup warning: ${err.message}`);
    }

    // 5. Fast bottom-up bulk purge of crawl child tables before deleting Website/Project
    if (crawlJobIds.length > 0) {
      await this.purgeCrawlJobsBottomUp(crawlJobIds, id);
    }

    // 6. Atomically remove competitor websites, client websites, and project
    await this.prisma.$transaction([
      this.prisma.website.deleteMany({ where: { scope: `competitor:${id}` } }),
      this.prisma.website.deleteMany({ where: { projectId: id } }),
      this.prisma.project.delete({ where: { id } }),
    ]);

    // 7. Reclaim local HTML snapshot files for deleted crawl jobs (best-effort)
    if (crawlJobIds.length > 0 && this.storage) {
      try {
        const removed = await this.storage.deleteSnapshotsForJobs(crawlJobIds);
        if (removed > 0) {
          this.logger.log(`Removed ${removed} HTML snapshot file(s) for deleted project ${id}.`);
        }
      } catch (err: any) {
        this.logger.warn(`Snapshot cleanup warning for deleted project ${id}: ${err.message}`);
      }
    }
  }

  /**
   * Deletes high-volume crawl leaf tables bottom-up in batches of crawlJobIds
   * using set-based SQL joins so PostgreSQL does not execute millions of
   * row-by-row ON DELETE CASCADE / SET NULL triggers in a single giant query.
   */
  private async purgeCrawlJobsBottomUp(crawlJobIds: string[], projectId: string): Promise<void> {
    const canExecuteRaw = typeof (this.prisma as any).$executeRaw === 'function';
    for (let i = 0; i < crawlJobIds.length; i += CRAWL_DELETE_JOB_BATCH_SIZE) {
      const batch = crawlJobIds.slice(i, i + CRAWL_DELETE_JOB_BATCH_SIZE);
      if (canExecuteRaw) {
        const jobList = Prisma.join(batch);
        await this.prisma.$executeRaw`
          DELETE FROM "AIRecommendation"
          USING "Issue"
          WHERE "AIRecommendation"."issueId" = "Issue"."id"
            AND "Issue"."crawlJobId" IN (${jobList})
        `;
        await this.prisma.$executeRaw`DELETE FROM "Issue" WHERE "crawlJobId" IN (${jobList})`;
        await this.prisma.$executeRaw`
          DELETE FROM "Link"
          USING "Page"
          WHERE "Link"."sourcePageId" = "Page"."id"
            AND "Page"."crawlJobId" IN (${jobList})
        `;
        await this.prisma.$executeRaw`
          DELETE FROM "Image"
          USING "Page"
          WHERE "Image"."pageId" = "Page"."id"
            AND "Page"."crawlJobId" IN (${jobList})
        `;
        await this.prisma.$executeRaw`
          DELETE FROM "Schema"
          USING "Page"
          WHERE "Schema"."pageId" = "Page"."id"
            AND "Page"."crawlJobId" IN (${jobList})
        `;
        await this.prisma.$executeRaw`
          DELETE FROM "Performance"
          USING "Page"
          WHERE "Performance"."pageId" = "Page"."id"
            AND "Page"."crawlJobId" IN (${jobList})
        `;
        await this.prisma.$executeRaw`
          DELETE FROM "AeoMetrics"
          USING "Page"
          WHERE "AeoMetrics"."pageId" = "Page"."id"
            AND "Page"."crawlJobId" IN (${jobList})
        `;
        await this.prisma.$executeRaw`DELETE FROM "InternalGraph" WHERE "crawlJobId" IN (${jobList})`;
        await this.prisma.$executeRaw`DELETE FROM "SiteSocialLink" WHERE "crawlJobId" IN (${jobList})`;
        await this.prisma.$executeRaw`DELETE FROM "CrawlFrontier" WHERE "crawlJobId" IN (${jobList})`;
        await this.prisma.$executeRaw`DELETE FROM "Page" WHERE "crawlJobId" IN (${jobList})`;
        await this.prisma.$executeRaw`DELETE FROM "CrawlJob" WHERE "id" IN (${jobList})`;
      } else {
        await this.prisma.issue?.deleteMany({ where: { crawlJobId: { in: batch } } });
        await this.prisma.internalGraph?.deleteMany({ where: { crawlJobId: { in: batch } } });
        await this.prisma.siteSocialLink?.deleteMany({ where: { crawlJobId: { in: batch } } });
        await this.prisma.crawlFrontier?.deleteMany({ where: { crawlJobId: { in: batch } } });
        await this.prisma.page?.deleteMany({ where: { crawlJobId: { in: batch } } });
        await this.prisma.crawlJob?.deleteMany({ where: { id: { in: batch } } });
      }
    }

    // Clear any project-scoped issues not attached to one of the discovered crawl jobs
    if (canExecuteRaw) {
      await this.prisma.$executeRaw`
        DELETE FROM "AIRecommendation"
        USING "Issue"
        WHERE "AIRecommendation"."issueId" = "Issue"."id"
          AND "Issue"."projectId" = ${projectId}
      `;
      await this.prisma.$executeRaw`DELETE FROM "Issue" WHERE "projectId" = ${projectId}`;
    } else {
      await this.prisma.issue?.deleteMany({ where: { projectId } });
    }
  }
}
