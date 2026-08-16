import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class IntegrationsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns the project's integration state, or null when nothing is connected.
   *
   * This used to seed a row claiming Google Analytics and Search Console were
   * already connected, with invented property ids. That is worse than a missing
   * row: the UI showed "Connected" for accounts the customer had never linked,
   * so nobody would think to connect them, and any feature reading those ids
   * would query a property that does not exist.
   */
  async getIntegrationConfig(projectId: string) {
    return this.prisma.integrationConfig.findUnique({
      where: { projectId },
    });
  }
}
