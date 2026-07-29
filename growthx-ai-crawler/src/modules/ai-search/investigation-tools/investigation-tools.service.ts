import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class InvestigationToolsService {
  private readonly logger = new Logger(InvestigationToolsService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Tool: Queries the SEO Knowledge Graph (Prisma database issues)
   */
  async queryKnowledgeGraph(projectId: string): Promise<string> {
    this.logger.log(`Tool Executing: queryKnowledgeGraph for ${projectId}`);
    
    // In reality, this would be a deep join on the graph representation.
    // For now, we query the standard issues table for this project's website.
    const issues = await this.prisma.issue.findMany({
      where: {
        crawlJob: { website: { projectId } },
        status: { not: 'RESOLVED' },
      },
      take: 10,
    });

    if (issues.length === 0) {
      return JSON.stringify({ status: 'healthy', issues_found: 0 });
    }

    return JSON.stringify(
      issues.map(i => ({
        url: i.affectedUrl,
        type: i.issueType,
        severity: i.severity,
        recommendation: i.recommendation
      }))
    );
  }

  /**
   * Tool: Mocks Google Search Console data lookup
   */
  async getTrafficMetrics(projectId: string): Promise<string> {
    this.logger.log(`Tool Executing: getTrafficMetrics for ${projectId}`);
    // Mock GSC Data
    return JSON.stringify({
      clicks_last_7_days: 12450,
      clicks_previous_7_days: 14500,
      trend: 'down',
      percent_change: -14.1,
      top_declining_urls: [
        '/products/enterprise-crawler',
        '/blog/seo-tips-2026'
      ]
    });
  }

  /**
   * Tool: Mocks Competitor Intelligence lookup
   */
  async getCompetitorData(projectId: string): Promise<string> {
    this.logger.log(`Tool Executing: getCompetitorData for ${projectId}`);
    return JSON.stringify({
      competitors: ['screamingfrog.co.uk', 'semrush.com'],
      content_gaps: ['AI autonomous engineering', 'AST parsing for SEO'],
      backlink_gap: 450
    });
  }
}

