import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class MarketIntelligenceService {
  constructor(private readonly prisma: PrismaService) {}

  async getMarketIntelligence(projectId: string) {
    let data = await this.prisma.marketIntelligence.findUnique({
      where: { projectId },
    });

    if (!data) {
      data = await this.generateMarketIntelligence(projectId);
    }

    return data;
  }

  async generateMarketIntelligence(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { websites: true },
    });

    const domain = project?.websites[0]?.domain || 'brand';
    const brandName = project?.name || domain.split('.')[0];

    const data = await this.prisma.marketIntelligence.upsert({
      where: { projectId },
      update: {
        sentimentScore: 0.82,
        sentimentSummary: `Strong positive market sentiment for ${brandName}. Consumers highlight product freshness, reliable morning delivery, and high organic quality standards.`,
        trendingTopics: [
          `Organic ${brandName} Products`,
          'A2 Cow Milk vs Regular Milk',
          'Farm Fresh Dairy Subscription',
          'Navi Mumbai Local Milk Delivery',
          'Desi Cow Ghee Health Benefits',
          'Pure Buffalo Milk Online Order',
        ],
        updatedAt: new Date(),
      },
      create: {
        projectId,
        sentimentScore: 0.82,
        sentimentSummary: `Strong positive market sentiment for ${brandName}. Consumers highlight product freshness, reliable morning delivery, and high organic quality standards.`,
        trendingTopics: [
          `Organic ${brandName} Products`,
          'A2 Cow Milk vs Regular Milk',
          'Farm Fresh Dairy Subscription',
          'Navi Mumbai Local Milk Delivery',
          'Desi Cow Ghee Health Benefits',
          'Pure Buffalo Milk Online Order',
        ],
      },
    });

    return data;
  }
}
