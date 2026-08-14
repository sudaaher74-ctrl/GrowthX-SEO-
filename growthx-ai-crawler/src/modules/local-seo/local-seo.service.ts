import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class LocalSeoService {
  private readonly logger = new Logger(LocalSeoService.name);

  constructor(private prisma: PrismaService) {}

  async getLocalSeo(projectId: string) {
    let localSeo = await this.prisma.localLocation.findUnique({
      where: { projectId },
    });

    if (!localSeo) {
      this.logger.log(`No Local SEO data found for project ${projectId}. Seeding dummy data...`);
      localSeo = await this.prisma.localLocation.create({
        data: {
          projectId,
          businessName: 'GrowthX Corp.',
          address: '123 Market St, San Francisco, CA 94103',
          rating: 4.8,
          reviewCount: 156,
          citationsCount: 42,
        },
      });
    }

    return localSeo;
  }
}
