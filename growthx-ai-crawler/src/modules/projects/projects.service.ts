import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Prisma, Project } from '@prisma/client';
import { decryptToken } from '../integrations/google/token-crypto';
import { google } from '../integrations/google/google-apis';

@Injectable()
export class ProjectsService {
  private readonly logger = new Logger(ProjectsService.name);

  constructor(private prisma: PrismaService) {}

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
   * Deletes a project and everything hung off it.
   *
   * 1. Revokes connected Google OAuth grants so Google settings do not show
   *    a phantom connection to a deleted project.
   * 2. Cancels active/pending crawl jobs.
   * 3. Deletes competitor websites tied to this project scope.
   * 4. Cascades remaining project rows via Prisma transaction.
   */
  async deleteProject(id: string): Promise<void> {
    // 1. Best-effort Google grant revocation before deletion
    try {
      const integrations = await this.prisma.integration.findMany({
        where: { projectId: id },
      });
      for (const integration of integrations) {
        if (integration.refreshToken) {
          try {
            const raw = decryptToken(integration.refreshToken);
            const client = new google.auth.OAuth2(
              process.env.GOOGLE_CLIENT_ID,
              process.env.GOOGLE_CLIENT_SECRET,
            );
            await client.revokeToken(raw);
          } catch (err: any) {
            this.logger.warn(`Could not revoke Google grant on project deletion: ${err.message}`);
          }
        }
      }
    } catch (err: any) {
      this.logger.warn(`Failed reading integrations for project deletion: ${err.message}`);
    }

    // 2. Mark any active/pending crawl jobs as CANCELLED (own site & competitor sites)
    try {
      await this.prisma.crawlJob.updateMany({
        where: {
          OR: [
            { website: { projectId: id } },
            { website: { scope: `competitor:${id}` } },
          ],
          status: { in: ['PENDING', 'RUNNING'] },
        },
        data: { status: 'CANCELLED' },
      });
    } catch {
      // Best-effort job cancellation
    }

    // 3. Clean up uncascaded auxiliary project records
    try {
      await Promise.allSettled([
        this.prisma.autopilotRun.deleteMany({ where: { projectId: id } }),
        this.prisma.auditReportSnapshot.deleteMany({ where: { projectId: id } }),
        this.prisma.competitorReportSnapshot.deleteMany({ where: { projectId: id } }),
        this.prisma.googleReportSnapshot.deleteMany({ where: { projectId: id } }),
        this.prisma.businessStrategySnapshot.deleteMany({ where: { projectId: id } }),
        this.prisma.savedPlan.deleteMany({ where: { projectId: id } }),
        this.prisma.actionStepDone.deleteMany({ where: { projectId: id } }),
        this.prisma.fixIntervention.deleteMany({ where: { projectId: id } }),
      ]);
    } catch (err: any) {
      this.logger.warn(`Auxiliary project record cleanup warning: ${err.message}`);
    }

    // 4. Clean up Recommendation and Evidence explicitly to avoid ON DELETE RESTRICT foreign key violations
    try {
      await this.prisma.recommendation.deleteMany({ where: { projectId: id } });
      await this.prisma.evidence.deleteMany({ where: { projectId: id } });
    } catch (err: any) {
      this.logger.warn(`Recommendation/Evidence cleanup warning: ${err.message}`);
    }

    // 5. Atomically remove competitor websites, client websites and project
    await this.prisma.$transaction([
      this.prisma.website.deleteMany({ where: { scope: `competitor:${id}` } }),
      this.prisma.website.deleteMany({ where: { projectId: id } }),
      this.prisma.project.delete({ where: { id } }),
    ]);
  }
}
