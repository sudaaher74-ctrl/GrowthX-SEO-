import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AiTask, MultiAiRouterService } from '../ai-search/multi-ai-router/multi-ai-router.service';

const GAP_SCHEMA = {
  type: 'object',
  properties: {
    gaps: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          gapType: {
            type: 'string',
            enum: ['SATURATED', 'COMPETITOR_WINNING', 'CUSTOMER_MISSING', 'MARKET_GAP', 'EMERGING', 'DIFFERENTIATION'],
          },
          title: { type: 'string' },
          description: { type: 'string', description: '2-3 sentences explaining the gap and why it matters' },
          competitionLevel: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH'] },
          opportunityScore: { type: 'number', minimum: 0, maximum: 100 },
          recommendedAction: { type: 'string', description: 'Specific actionable recommendation for the brand' },
          patternName: { type: 'string', description: 'Name of the creative pattern this gap relates to, if any' },
        },
        required: ['gapType', 'title', 'description', 'competitionLevel', 'opportunityScore', 'recommendedAction'],
      },
    },
  },
  required: ['gaps'],
  additionalProperties: false,
} as const;

const SYSTEM = `You are a content strategy expert.
Analyze the competitive landscape data and identify content gaps.
A gap is either something competitors do that the brand is missing, something no-one is doing that represents an opportunity, or a saturated space to avoid.
Focus on strategic differentiation. The brand should stand out, not copy competitors.
Never invent statistics. Base all gaps on the data provided.
Respond only with JSON matching the schema.`;

@Injectable()
export class GapAnalysisService {
  private readonly logger = new Logger(GapAnalysisService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly router: MultiAiRouterService,
  ) {}

  /** Generate content gaps by comparing patterns against project context. */
  async analyzeGaps(projectId: string, organizationId: string) {
    const [patterns, existingGaps] = await Promise.all([
      this.prisma.creativePattern.findMany({
        where: { organizationId, projectId },
        orderBy: { opportunityScore: 'desc' },
      }),
      this.prisma.contentGap.count({ where: { organizationId, projectId } }),
    ]);

    if (patterns.length === 0) {
      return {
        gapsGenerated: 0,
        message:
          'No creative patterns have been detected yet, so there is nothing to find gaps against. ' +
          'Add competitor content, run classification, then run pattern detection.',
      };
    }

    const patternSummary = patterns.map(p =>
      `Pattern: "${p.name}" | Saturation: ${p.marketSaturation}/100 | Opportunity: ${p.opportunityScore}/100 | Elements: ${p.keyVisualElements.join(', ')}`
    ).join('\n');

    const prompt = `Competitor Creative Patterns Detected:\n${patternSummary}\n\nIdentify content gaps and opportunities for this brand to differentiate.`;

    const result = await this.router.generate({
      prompt,
      systemInstruction: SYSTEM,
      task: AiTask.REASONING,
      organizationId,
      jsonSchema: GAP_SCHEMA as unknown as Record<string, unknown>,
      maxTokens: 3000,
    });

    if (!result.text?.trim()) return { gapsGenerated: 0 };

    const parsed = this.parseJson(result.text);
    const gaps: any[] = parsed.gaps ?? [];

    let saved = 0;
    for (const g of gaps) {
      const matchedPattern = patterns.find(p => p.name === g.patternName);
      await this.prisma.contentGap.create({
        data: {
          organizationId,
          projectId,
          patternId: matchedPattern?.id ?? null,
          gapType: g.gapType,
          title: g.title,
          description: g.description,
          competitionLevel: g.competitionLevel,
          opportunityScore: Math.round(g.opportunityScore),
          recommendedAction: g.recommendedAction,
          status: 'OPEN',
        },
      });
      saved++;
    }

    this.logger.log(`Generated ${saved} content gaps for project ${projectId}`);
    return { gapsGenerated: saved };
  }

  async listGaps(organizationId: string, projectId: string, status?: string) {
    return this.prisma.contentGap.findMany({
      where: {
        organizationId,
        projectId,
        ...(status && { status }),
      },
      include: { pattern: { select: { name: true, opportunityScore: true } } },
      orderBy: { opportunityScore: 'desc' },
    });
  }

  async updateGapStatus(organizationId: string, gapId: string, status: string) {
    return this.prisma.contentGap.updateMany({
      where: { id: gapId, organizationId },
      data: { status },
    });
  }

  private parseJson(text: string): Record<string, any> {
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    const candidate = fenced ? fenced[1] : text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
    try { return JSON.parse(candidate); } catch { return {}; }
  }
}
