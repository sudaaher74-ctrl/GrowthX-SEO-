import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { FindingAdapter, NormalisedFinding } from '../opportunities/finding-adapter.interface';
import * as crypto from 'crypto';

@Injectable()
export class AiVisibilityAdapter implements FindingAdapter {
  private readonly logger = new Logger(AiVisibilityAdapter.name);
  source = 'MARKET' as const;

  constructor(private readonly prisma: PrismaService) {}

  async collect(projectId: string): Promise<NormalisedFinding[]> {
    const latestScan = await this.prisma.aiVisibilityScan.findFirst({
      where: { projectId, status: 'COMPLETED' },
      orderBy: { createdAt: 'desc' },
      include: { project: true }
    });

    if (!latestScan || !latestScan.project) return [];
    
    const organizationId = latestScan.project.organizationId;
    
    const responses = await this.prisma.aiVisibilityResponse.findMany({
      where: { scanRun: { scanId: latestScan.id } },
      include: {
        prompt: true,
        mentions: true
      }
    });

    const findings: NormalisedFinding[] = [];
    
    // Group missed opportunities by competitor to avoid spamming the Fix Engine
    // Key: Competitor name, Value: List of prompts where they won
    const lossesByCompetitor = new Map<string, { promptText: string; provider: string; model: string }[]>();

    for (const r of responses) {
      const customerMentions = r.mentions.filter(m => m.isCustomer);
      const competitorMentions = r.mentions.filter(m => !m.isCustomer);
      
      const customerRecommended = customerMentions.some(m => m.recommended || m.shortlisted);
      const competitorsRecommended = competitorMentions.filter(m => m.recommended || m.shortlisted);
      
      if (!customerRecommended && competitorsRecommended.length > 0) {
        for (const comp of competitorsRecommended) {
          const compName = comp.brandName;
          if (!lossesByCompetitor.has(compName)) {
            lossesByCompetitor.set(compName, []);
          }
          lossesByCompetitor.get(compName)!.push({
            promptText: r.prompt?.text || r.promptText,
            provider: r.provider,
            model: r.model
          });
        }
      }
    }

    for (const [competitorName, lostPrompts] of lossesByCompetitor.entries()) {
      const fingerprint = crypto.createHash('sha1').update(`ai-loss|${projectId}|${competitorName.toLowerCase()}`).digest('hex').slice(0, 24);
      
      findings.push({
        projectId,
        organizationId,
        fingerprint,
        source: 'MARKET',
        category: 'COMPETITOR',
        title: `AI models recommend ${competitorName} instead of you`,
        summary: `Across ${lostPrompts.length} different queries, AI assistants like ${lostPrompts[0].model} suggested a competitor but did not mention your brand.`,
        recommendedAction: `Update your Google Business Profile, increase high-quality backlinks, and publish comprehensive content matching these queries to build entity authority over ${competitorName}.`,
        evidence: [
          { label: 'Competitor', value: competitorName, source: 'AI Visibility Scan' },
          { label: 'Lost Queries', value: lostPrompts.length.toString(), source: 'AI Mentions' },
          { label: 'Example Query', value: lostPrompts[0].promptText, source: 'AI Prompts' },
          { label: 'Model', value: lostPrompts[0].model, source: lostPrompts[0].provider }
        ],
        potential: 'HIGH',
        effort: 'MEDIUM',
        confidence: 90,
        impact: 8,
        fixClass: 'MANUAL',
        affectedPages: [],
        affectedCount: lostPrompts.length,
        detailType: 'AI_VISIBILITY_LOSS',
        detailRef: competitorName
      });
    }

    return findings;
  }
}
