import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class MonitoringService {
  constructor(private readonly prisma: PrismaService) {}

  async getMonitoringConfig(projectId: string) {
    let data = await this.prisma.monitoringConfig.findUnique({
      where: { projectId },
    });

    if (!data) {
      // Seed initial mock data
      data = await this.prisma.monitoringConfig.create({
        data: {
          projectId,
          uptimeStatus: 'UP',
          uptimePercentage: 99.98,
          avgResponseTimeMs: 342,
          lastDowntimeAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), // 14 days ago
          sslStatus: 'VALID',
          sslExpiresAt: new Date(Date.now() + 65 * 24 * 60 * 60 * 1000), // 65 days from now
          performanceScore: 92,
          mobileScore: 88,
          coreWebVitalsStatus: 'PASSING',
        },
      });
    }

    return data;
  }
}
