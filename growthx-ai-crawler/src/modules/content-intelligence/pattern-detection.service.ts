import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AiTask, MultiAiRouterService } from '../ai-search/multi-ai-router/multi-ai-router.service';
import { parseModelJson } from '../ai-engine/utils/json-extractor.util';

const PATTERN_SCHEMA = {
  type: 'object',
  properties: {
    patterns: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Short pattern name e.g. "Jewellery + Model Luxury"' },
          description: { type: 'string', description: '1-2 sentence description of the creative pattern' },
          platforms: { type: 'array', items: { type: 'string' } },
          contentCategories: { type: 'array', items: { type: 'string' } },
          keyVisualElements: { type: 'array', items: { type: 'string' } },
          storytellingApproach: { type: 'string' },
          ctaType: { type: 'string' },
          marketSaturation: { type: 'number', minimum: 0, maximum: 100, description: '0=rare, 100=everyone does this' },
          opportunityScore: { type: 'number', minimum: 0, maximum: 100, description: '0=no opportunity, 100=huge gap' },
        },
        required: ['name', 'description', 'keyVisualElements', 'marketSaturation', 'opportunityScore'],
      },
    },
  },
  required: ['patterns'],
  additionalProperties: false,
} as const;

const SYSTEM = `You are a creative intelligence analyst specializing in social media content strategy.
Analyze the provided classification data from competitor content and identify recurring creative patterns.
A pattern is a repeating combination of visual elements, content categories, storytelling approaches, and execution style.
Market saturation = how commonly used the pattern is across all competitors (0=unique, 100=everyone does it).
Opportunity score = how much untapped potential this pattern represents for differentiation (inverse of saturation + novelty).
Do NOT copy competitor ideas. Identify structural patterns only.
Respond only with JSON matching the schema.`;

@Injectable()
export class PatternDetectionService {
  private readonly logger = new Logger(PatternDetectionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly router: MultiAiRouterService,
  ) {}

  /**
   * Run pattern detection for a project.
   * Aggregates classified content and asks AI to identify cross-competitor patterns.
   */
  async detectPatterns(projectId: string, organizationId: string) {
    // Gather all classified content
    const classified = await this.prisma.contentClassification.findMany({
      where: { content: { projectId, organizationId } },
      include: {
        content: {
          select: {
            platform: true,
            contentType: true,
            account: { select: { displayName: true, competitorId: true } },
          },
        },
      },
    });

    if (classified.length < 3) {
      return {
        patternsDetected: 0,
        message:
          `Pattern detection needs at least 3 classified content items; this project has ` +
          `${classified.length}. Add more competitor posts, then run classification.`,
      };
    }

    // Build aggregated summary for AI
    const summary = this.buildSummary(classified);

    const result = await this.router.generate({
      prompt: `Analyze these classified competitor content items and identify creative patterns:\n\n${summary}`,
      systemInstruction: SYSTEM,
      task: AiTask.REASONING,
      organizationId,
      jsonSchema: PATTERN_SCHEMA as unknown as Record<string, unknown>,
      maxTokens: 4000,
    });

    if (!result.text?.trim()) return { patternsDetected: 0, message: 'Model returned no patterns.' };

    const parsed = this.parseJson(result.text);
    const patterns: any[] = parsed.patterns ?? [];

    // Upsert patterns into DB
    let saved = 0;
    for (const p of patterns) {
      await this.prisma.creativePattern.create({
        data: {
          organizationId,
          projectId,
          name: p.name,
          description: p.description,
          platforms: p.platforms ?? [],
          contentCategories: p.contentCategories ?? [],
          keyVisualElements: p.keyVisualElements ?? [],
          storytellingApproach: p.storytellingApproach,
          ctaType: p.ctaType,
          frequency: classified.filter(c =>
            p.keyVisualElements?.some((el: string) => c.detectedObjects.includes(el))
          ).length,
          marketSaturation: Math.round(p.marketSaturation),
          opportunityScore: Math.round(p.opportunityScore),
        },
      });
      saved++;
    }

    this.logger.log(`Detected ${saved} patterns for project ${projectId}`);
    return { patternsDetected: saved };
  }

  async listPatterns(organizationId: string, projectId: string) {
    return this.prisma.creativePattern.findMany({
      where: { organizationId, projectId },
      orderBy: { opportunityScore: 'desc' },
    });
  }

  private buildSummary(classified: any[]): string {
    const lines = classified.map(c => [
      `Platform: ${c.content.platform}`,
      `Competitor: ${c.content.account?.displayName ?? 'Unknown'}`,
      `Category: ${c.contentCategory ?? 'unknown'}`,
      `Format: ${c.visualFormat ?? 'unknown'}`,
      `Objects: ${c.detectedObjects.join(', ')}`,
      `Topics: ${c.detectedTopics.join(', ')}`,
      `Hook: ${c.hookType ?? 'unknown'}`,
      `CTA: ${c.ctaType ?? 'unknown'}`,
      '---',
    ].join(' | '));
    return lines.slice(0, 150).join('\n'); // cap at 150 items to stay within token budget
  }

  /** Reads the model's JSON answer, repairing truncation or naming the failure. */
  private parseJson(text: string): Record<string, any> {
    return parseModelJson(text, 'Pattern detection');
  }
}
