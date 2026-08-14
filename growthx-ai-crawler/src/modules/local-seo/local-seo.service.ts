import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class LocalSeoService {
  private readonly logger = new Logger(LocalSeoService.name);

  constructor(private prisma: PrismaService) {}

  async getLocalSeo(projectId: string) {
    let localSeo = await this.prisma.localLocation.findUnique({
      where: { projectId },
      include: { rankings: true },
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
          rankings: {
            create: [
              { keyword: 'growth marketing agency', position: 3, previousPos: 5, searchVolume: 1200 },
              { keyword: 'seo services sf', position: 1, previousPos: 1, searchVolume: 800 },
              { keyword: 'b2b marketing firm', position: 8, previousPos: 12, searchVolume: 450 },
            ],
          },
        },
        include: { rankings: true },
      });
    }

    return localSeo;
  }
}
