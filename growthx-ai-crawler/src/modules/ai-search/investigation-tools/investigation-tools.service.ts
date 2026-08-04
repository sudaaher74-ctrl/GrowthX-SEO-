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
   * Tool: Google Search Console traffic. Not connected yet.
   *
   * Returns an explicit "unavailable" marker rather than throwing: this is one
   * of several evidence sources fed to the model, and a missing integration
   * must not take down the whole answer. The marker also tells the model not to
   * speculate about traffic it cannot see.
   */
  async getTrafficMetrics(projectId: string): Promise<string> {
    this.logger.debug(`getTrafficMetrics for ${projectId}: integration not connected.`);
    return JSON.stringify({
      available: false,
      reason: 'Google Search Console is not connected for this project.',
    });
  }

  /** Tool: competitor intelligence. Same contract as above. */
  async getCompetitorData(projectId: string): Promise<string> {
    const competitors = await this.prisma.competitorDomain.findMany({
      where: { projectId },
      select: { domain: true, label: true },
    });

    if (competitors.length === 0) {
      return JSON.stringify({
        available: false,
        reason: 'No competitors are being tracked for this project yet.',
      });
    }

    return JSON.stringify({ available: true, competitors });
  }
}

