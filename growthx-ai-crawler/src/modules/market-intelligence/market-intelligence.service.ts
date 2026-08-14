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
      // Seed initial mock data
      data = await this.prisma.marketIntelligence.create({
        data: {
          projectId,
          sentimentScore: 0.68,
          sentimentSummary:
            'Positive sentiment overall, driven by recent product updates and improved customer support.',
          trendingTopics: [
            'AI Automation',
            'SEO Strategies 2026',
            'Content Generation',
            'Local SEO updates',
          ],
        },
      });
    }

    return data;
  }
}
