import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class ReportingService {
  private readonly logger = new Logger(ReportingService.name);

  constructor(private prisma: PrismaService) {}

  async getReportingConfig(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        CustomReport: true,
        ClientPortalConfig: true,
      },
    });

    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }

    let clientPortal = project.ClientPortalConfig;
    if (!clientPortal) {
      clientPortal = await this.prisma.clientPortalConfig.create({
        data: {
          projectId,
          customDomain: `portal.growthx.ai/client/${projectId.substring(0, 8)}`,
          isPublic: false,
          themeColor: '#2563eb',
        },
      });
    }

    // No placeholder report is seeded here. Doing so wrote a hardcoded
    // recipient list — including another customer's address — into every
    // project that had not configured reporting yet.
    return {
      customReports: project.CustomReport ?? [],
      clientPortal,
    };
  }
}
