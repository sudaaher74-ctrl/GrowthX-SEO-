import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

export interface EnrichedOpportunity {
  id: string;
  topic: string;
  pillar: string;
  opportunityScore: number;
  /** Each figure is null when nothing measured it. */
  breakdown: {
    businessRelevance: number | null;
    searchOpportunity: number | null;
    competitorEvidence: number | null;
    contentGap: number | null;
    confidence: number | null;
    effort: 'LOW' | 'MEDIUM' | 'HIGH' | null;
  };
  /** The project's own first location, or null when it has none. */
  targetMarket: string | null;
  competitorEvidenceSummary: string;
  /** Keywords the gap analysis recorded. No volume is attached: none was measured. */
  relatedKeywords: Array<{ keyword: string }>;
  suggestedFormats: string[];
  recommendedAction: string | null;
}

@Injectable()
export class KeywordBusinessBridgeService {
  private readonly logger = new Logger(KeywordBusinessBridgeService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Enriches detected content gaps with Keyword Intelligence (ENGINE 08) and Business/Location context (ENGINE 05/06).
   */
  async getEnrichedOpportunities(organizationId: string, projectId: string): Promise<EnrichedOpportunity[]> {
    const [gaps, project] = await Promise.all([
      this.prisma.contentGap.findMany({
        where: {
          projectId,
          ...(organizationId ? { organizationId } : {}),
          status: 'OPEN',
        },
        orderBy: { opportunityScore: 'desc' },
      }),
      this.prisma.project.findUnique({
        where: { id: projectId },
        include: { locations: true },
      }),
    ]);

    const targetCity = project?.locations?.[0]?.address?.split(',')[0]?.trim() || null;

    // Only gaps that gap analysis actually found. With none, the answer is an
    // empty list: this used to invent three fruit-pulp export opportunities
    // with made-up search volumes for any project whose name contained
    // "fruit" or "food", and a generic set for everyone else.
    return gaps.map((g) => {
      const breakdown = {
        businessRelevance: g.businessRelevanceScore,
        searchOpportunity: g.searchOpportunityScore,
        competitorEvidence: g.competitorEvidenceScore,
        contentGap: g.contentGapScore,
        confidence: g.confidenceScore,
        effort: (g.effortLevel as 'LOW' | 'MEDIUM' | 'HIGH' | null) ?? null,
      };
      const parts = [
        breakdown.businessRelevance,
        breakdown.searchOpportunity,
        breakdown.competitorEvidence,
        breakdown.contentGap,
        breakdown.confidence,
      ];
      // The weighted blend is only meaningful when every part was measured;
      // otherwise the score gap analysis stored is the one to show.
      const opportunityScore = parts.every((v): v is number => v != null)
        ? Math.round(parts[0] * 0.25 + parts[1] * 0.2 + parts[2] * 0.2 + parts[3] * 0.2 + parts[4] * 0.15)
        : g.opportunityScore;

      return {
        id: g.id,
        topic: g.title,
        pillar: g.gapType === 'SATURATED' ? 'AVOID' : 'EDUCATIONAL',
        opportunityScore,
        breakdown,
        targetMarket: targetCity,
        competitorEvidenceSummary: g.description,
        relatedKeywords: (g.relatedKeywords ?? []).map((keyword) => ({ keyword })),
        suggestedFormats: g.suggestedFormats ?? [],
        recommendedAction: g.recommendedAction ?? null,
      };
    });
  }
}
