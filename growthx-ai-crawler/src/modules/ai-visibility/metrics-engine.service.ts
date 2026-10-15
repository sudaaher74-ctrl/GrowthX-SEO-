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

    // Fetch project context for customer brand label and competitor domain mapping
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        businessProfile: true,
        websites: { where: { scope: 'own' } },
        competitors: true,
      },
    });

    const customerBrandLabel =
      project?.businessProfile?.businessName ||
      project?.websites?.[0]?.domain ||
      project?.name ||
      'Your Brand';

    const ownDomains = new Set(
      (project?.websites || []).map((w) => w.domain.toLowerCase()),
    );

    const competitorMap = new Map<string, string>();
    for (const comp of project?.competitors || []) {
      competitorMap.set(comp.domain.toLowerCase(), comp.label || comp.name || comp.domain);
    }

    let total = 0;
    let mentioned = 0;
    let shortlisted = 0;
    let recommended = 0;
    let finalChoice = 0;
    let positionsSum = 0;
    let positionsCount = 0;
    
    // For SOV
    let ownMentions = 0;
    const competitorCounts: Record<string, number> = {};

    for (const res of responses) {
      if (!res.analysis) continue;
      // Exclude responses that failed execution
      if (res.errorMessage || !res.rawResponse) continue;

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
        const brandKey = mention.brandName.toLowerCase();
        if (mention.isCustomer || ownDomains.has(brandKey)) {
          ownMentions++;
        } else {
          competitorCounts[brandKey] = (competitorCounts[brandKey] || 0) + 1;
        }
      }
    }

    const mentionRate = total > 0 ? mentioned / total : 0;
    const shortlistRate = total > 0 ? shortlisted / total : 0;
    const recommendationRate = total > 0 ? recommended / total : 0;
    const finalChoiceRate = total > 0 ? finalChoice / total : 0;
    const averagePosition = positionsCount > 0 ? positionsSum / positionsCount : null;

    // Visibility score: 10% mentioned + 30% shortlisted + 40% recommended + 20% final choice (0-100)
    const visibilityScore = Math.round(
      (mentionRate * 10 + shortlistRate * 30 + recommendationRate * 40 + finalChoiceRate * 20) * 100,
    ) / 100;

    // Calculate Share of Voice (percentage of total brand mentions)
    const competitorTotal = Object.values(competitorCounts).reduce((sum, count) => sum + count, 0);
    const totalMentions = ownMentions + competitorTotal;

    const shareOfVoice: Array<{
      domain: string | null;
      label: string;
      mentions: number;
      sharePct: number;
    }> = [];

    // The customer brand ALWAYS has domain: null per the frontend contract
    if (ownMentions > 0 || totalMentions > 0) {
      shareOfVoice.push({
        domain: null,
        label: customerBrandLabel,
        mentions: ownMentions,
        sharePct: totalMentions > 0 ? Math.round((ownMentions / totalMentions) * 100) : 0,
      });
    }

    for (const [compKey, count] of Object.entries(competitorCounts)) {
      const label = competitorMap.get(compKey) || compKey;
      shareOfVoice.push({
        domain: compKey,
        label,
        mentions: count,
        sharePct: totalMentions > 0 ? Math.round((count / totalMentions) * 100) : 0,
      });
    }

    shareOfVoice.sort((a, b) => b.sharePct - a.sharePct);

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
