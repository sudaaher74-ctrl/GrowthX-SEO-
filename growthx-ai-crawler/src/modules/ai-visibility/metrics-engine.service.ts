import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class MetricsEngineService {
  private readonly logger = new Logger(MetricsEngineService.name);

  constructor(private readonly prisma: PrismaService) {}

  async calculateScanMetrics(scanId: string, projectId: string) {
    this.logger.log(`Calculating metrics for scan ${scanId}`);

    const responses = await this.prisma.aiVisibilityResponse.findMany({
      where: { scanRun: { scanId } },
      include: {
        analysis: true,
        mentions: true,
      },
    });

    if (responses.length === 0) return;

    let total = 0;
    let mentioned = 0;
    let shortlisted = 0;
    let recommended = 0;
    let finalChoice = 0;
    let positionsSum = 0;
    let positionsCount = 0;
    
    // For SOV
    const domainCounts: Record<string, number> = {};

    for (const res of responses) {
      if (!res.analysis) continue;
      total++;
      
      if (res.analysis.brandMentioned) mentioned++;
      if (res.analysis.shortlisted) shortlisted++;
      if (res.analysis.recommended) recommended++;
      if (res.analysis.finalChoice) finalChoice++;
      if (res.analysis.brandPosition) {
        positionsSum += res.analysis.brandPosition;
        positionsCount++;
      }

      // Calculate mentions for SOV
      for (const mention of res.mentions) {
        domainCounts[mention.brandName] = (domainCounts[mention.brandName] || 0) + 1;
      }
    }

    const mentionRate = total > 0 ? mentioned / total : 0;
    const shortlistRate = total > 0 ? shortlisted / total : 0;
    const recommendationRate = total > 0 ? recommended / total : 0;
    const finalChoiceRate = total > 0 ? finalChoice / total : 0;
    const averagePosition = positionsCount > 0 ? positionsSum / positionsCount : null;

    // A simplified visibility score: 10% mentioned + 30% shortlisted + 40% recommended + 20% final choice
    const visibilityScore = (mentionRate * 10) + (shortlistRate * 30) + (recommendationRate * 40) + (finalChoiceRate * 20);

    // Calculate Share of Voice (percentage of total brand mentions)
    const totalMentions = Object.values(domainCounts).reduce((sum, count) => sum + count, 0);
    const shareOfVoice = Object.entries(domainCounts)
      .map(([domain, count]) => ({
        domain,
        mentions: count,
        sharePct: totalMentions > 0 ? (count / totalMentions) * 100 : 0,
      }))
      .sort((a, b) => b.sharePct - a.sharePct);

    const funnelMetrics = {
      totalAnalyzed: total,
      mentioned,
      shortlisted,
      recommended,
      finalChoice,
    };

    await this.prisma.aiVisibilityMetrics.create({
      data: {
        projectId,
        scanId,
        visibilityScore,
        mentionRate: mentionRate * 100,
        shortlistRate: shortlistRate * 100,
        recommendationRate: recommendationRate * 100,
        finalChoiceRate: finalChoiceRate * 100,
        averagePosition,
        shareOfVoice,
        funnelMetrics,
      },
    });

    this.logger.log(`Metrics calculated for scan ${scanId}: Visibility ${visibilityScore.toFixed(2)}`);
  }
}
