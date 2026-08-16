import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class MonitoringService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns this project's monitoring record, or null when nothing is monitored.
   *
   * This used to create a record on first read claiming 99.98% uptime, a 342ms
   * average response, a valid SSL certificate and a performance score of 92 —
   * for a site that had never been checked. Every client saw the same invented
   * health figures, and because the row was persisted the fiction outlived the
   * request. The client renders an empty state instead.
   */
  async getMonitoringConfig(projectId: string) {
    return this.prisma.monitoringConfig.findUnique({
      where: { projectId },
    });
  }
}
