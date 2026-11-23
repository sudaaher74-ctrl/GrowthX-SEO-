import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Prisma, Project } from '@prisma/client';
import { decryptToken } from '../integrations/google/token-crypto';

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

  async deleteProject(id: string): Promise<void> {
    const where = { projectId: id };
    const [integrations] = await this.prisma.$transaction([
      this.prisma.integration.findMany({ where, select: { refreshToken: true } }),
      this.prisma.autopilotRun.deleteMany({ where }),
      this.prisma.auditReportSnapshot.deleteMany({ where }),
      this.prisma.competitorReportSnapshot.deleteMany({ where }),
      this.prisma.googleReportSnapshot.deleteMany({ where }),
      this.prisma.businessStrategySnapshot.deleteMany({ where }),
      this.prisma.savedPlan.deleteMany({ where }),
      this.prisma.actionStepDone.deleteMany({ where }),
      this.prisma.fixIntervention.deleteMany({ where }),
      // A recommendation's primary evidence has an ON DELETE RESTRICT foreign key.
      this.prisma.recommendation.deleteMany({ where }),
      this.prisma.evidence.deleteMany({ where }),
      // Website deletion cascades to crawl jobs. Workers discard work for missing jobs.
      this.prisma.website.deleteMany({ where: { scope: `competitor:${id}` } }),
      this.prisma.website.deleteMany({ where }),
      this.prisma.project.delete({ where: { id } }),
    ]);

    // Only revoke Google grants after the database commits. Bound the total wait
    // so an unavailable Google endpoint cannot stall project deletion.
    const signal = AbortSignal.timeout(5_000);
    await Promise.all(integrations.map(async ({ refreshToken }) => {
      if (!refreshToken) return;

      try {
        const response = await fetch('https://oauth2.googleapis.com/revoke', {
          method: 'POST',
          body: new URLSearchParams({ token: decryptToken(refreshToken) }),
          signal,
        });
        if (!response.ok) {
          this.logger.warn(`Google rejected grant revocation on project deletion (HTTP ${response.status})`);
        }
      } catch {
        this.logger.warn('Could not revoke Google grant on project deletion');
      }
    }));
  }
}
