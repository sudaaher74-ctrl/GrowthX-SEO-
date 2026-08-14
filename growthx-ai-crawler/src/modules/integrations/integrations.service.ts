import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class IntegrationsService {
  constructor(private readonly prisma: PrismaService) {}

  async getIntegrationConfig(projectId: string) {
    let data = await this.prisma.integrationConfig.findUnique({
      where: { projectId },
    });

    if (!data) {
      // Seed initial mock data
      data = await this.prisma.integrationConfig.create({
        data: {
          projectId,
          gaConnected: true,
          gscConnected: true,
          gaPropertyId: 'ga-4-live-prop-12345',
          gscPropertyId: 'sc-domain:example.com',
        },
      });
    }

    return data;
  }
}
