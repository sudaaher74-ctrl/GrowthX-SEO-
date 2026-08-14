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

    let reports = project.CustomReport;
    if (!reports || reports.length === 0) {
      const mockReport = await this.prisma.customReport.create({
        data: {
          projectId,
          name: 'Monthly Executive SEO Digest',
          frequency: 'MONTHLY',
          recipients: ['client@example.com', 'admin@milquufresh.in'],
          format: 'PDF',
        },
      });
      reports = [mockReport];
    }

    return {
      customReports: reports,
      clientPortal,
    };
  }
}
