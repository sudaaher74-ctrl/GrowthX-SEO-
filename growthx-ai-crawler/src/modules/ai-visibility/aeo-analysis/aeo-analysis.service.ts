import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

export interface AeoReport {
  overallCitationScore: number;
  missingStructuredDataUrls: string[];
  crawlerActivity: {
    openai: number;
    anthropic: number;
    perplexity: number;
  };
}

@Injectable()
export class AeoAnalysisService {
  private readonly logger = new Logger(AeoAnalysisService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Analyzes a website for AI Engine Optimization (AEO).
   * It queries the AeoMetrics table to evaluate optimization for AI citations.
   */
  async analyzeWebsiteAeo(projectId: string): Promise<AeoReport | null> {
    this.logger.log(`Analyzing AEO for Project: ${projectId}`);
    
    // Find all pages belonging to the project and check their AeoMetrics
    const metrics = await this.prisma.aeoMetrics.findMany({
      where: {
        page: {
          crawlJob: { website: { projectId } }
        }
      }
    });

    if (metrics.length === 0) {
      return null;
    }

    // Aggregate real data
    const totalPages = metrics.length;
    const missingStructuredDataUrls = await this.prisma.page.findMany({
      where: {
        crawlJob: { website: { projectId } },
        aeoMetrics: { hasStructuredJsonLd: false }
      },
      select: { url: true },
      take: 10
    });

    const avgCitationScore = metrics.reduce((acc, m) => acc + m.citationProbability, 0) / totalPages;
    const totalLlmHits = metrics.reduce((acc, m) => acc + m.llmCrawlerHits, 0);

    return {
      overallCitationScore: avgCitationScore,
      missingStructuredDataUrls: missingStructuredDataUrls.map(p => p.url),
      crawlerActivity: {
        openai: totalLlmHits, 
        anthropic: 0,
        perplexity: 0
      }
    };
  }
}

