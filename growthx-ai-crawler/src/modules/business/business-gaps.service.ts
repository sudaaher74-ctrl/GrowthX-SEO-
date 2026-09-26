import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { buildCategoryGapItems, CategoryGapItem, CompetitorCatalog } from './business-gaps';

@Injectable()
export class BusinessGapsService {
  constructor(private readonly prisma: PrismaService) {}

  async getGaps(projectId: string): Promise<CategoryGapItem[]> {
    const [mine, competitors] = await Promise.all([
      this.prisma.catalogProduct.findMany({ where: { projectId, competitorId: null } }),
      this.prisma.competitorDomain.findMany({
        where: { projectId },
        select: { id: true, domain: true, label: true, name: true },
      }),
    ]);

    const catalogs: CompetitorCatalog[] = await Promise.all(
      competitors.map(async (competitor) => ({
        id: competitor.id,
        domain: competitor.domain,
        label: competitor.label ?? competitor.name ?? competitor.domain,
        products: await this.prisma.catalogProduct.findMany({ where: { projectId, competitorId: competitor.id } }),
      })),
    );

    return buildCategoryGapItems(mine, catalogs);
  }
}
