import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AiTask, MultiAiRouterService } from '../ai-search/multi-ai-router/multi-ai-router.service';
import { parseModelJson } from '../ai-engine/utils/json-extractor.util';

const CLASSIFICATION_SCHEMA = {
  type: 'object',
  properties: {
    contentCategory: {
      type: 'string',
      enum: ['EDUCATIONAL', 'PROMOTIONAL', 'PRODUCT', 'LIFESTYLE', 'BEHIND_SCENES', 'TESTIMONIAL',
        'FOUNDER', 'INFLUENCER', 'CELEBRITY', 'ANNOUNCEMENT', 'OFFER', 'STORYTELLING',
        'TUTORIAL', 'COMPARISON', 'UGC', 'ENTERTAINMENT', 'OTHER'],
    },
    visualFormat: {
      type: 'string',
      enum: ['STATIC', 'CAROUSEL', 'REEL', 'SHORT_VIDEO', 'LONG_VIDEO', 'STORY', 'LIVE', 'OTHER'],
    },
    detectedTopics: { type: 'array', items: { type: 'string' }, maxItems: 8 },
    detectedObjects: {
      type: 'array',
      items: { type: 'string' },
      description: 'Visual subjects: PRODUCT, MODEL, CELEBRITY, FLOWERS, WEDDING, LUXURY, OUTDOOR, STUDIO, RESTAURANT, PROPERTY, OFFICE, etc.',
      maxItems: 8,
    },
    storytellingStyle: { type: 'string', description: 'e.g. NARRATIVE, EDUCATIONAL, ASPIRATIONAL, HUMOUR, DEMONSTRATION' },
    hookType: { type: 'string', description: 'e.g. QUESTION, STATEMENT, STORY_OPEN, CONTROVERSY, LIST' },
    ctaType: { type: 'string', description: 'e.g. SHOP_NOW, LINK_IN_BIO, DM_US, CALL_NOW, COMMENT, SAVE, NONE' },
    creativityScore: { type: 'number', minimum: 0, maximum: 10 },
  },
  required: ['contentCategory', 'visualFormat', 'detectedTopics', 'detectedObjects'],
  additionalProperties: false,
} as const;

const SYSTEM = `You are a social media content analyst. 
Classify each content item accurately based on the caption, title, description, hashtags, and visible context.
Never invent data. If you cannot determine a field from the available text, omit it.
Respond only with JSON matching the schema.`;

@Injectable()
export class ClassificationService {
  private readonly logger = new Logger(ClassificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly router: MultiAiRouterService,
  ) {}

  /**
   * Classify all unclassified content items for a project.
   * Uses a cheap high-volume model (DeepSeek Flash / Gemini Flash).
   * Batches to avoid blowing the rate limit.
   */
  async classifyPending(projectId: string, organizationId?: string, limit = 50) {
    const items = await this.prisma.competitorContent.findMany({
      // Scoped by organization like every other read in the product. Without
      // it a project id from another tenant would classify their content.
      where: { projectId, ...(organizationId ? { organizationId } : {}), classification: null },
      take: limit,
      orderBy: { publishedAt: 'desc' },
    });

    if (items.length === 0) {
      const total = await this.prisma.competitorContent.count({
        where: { projectId, ...(organizationId ? { organizationId } : {}) },
      });
      return {
        classified: 0,
        message:
          total === 0
            ? 'No competitor content to classify yet. Add a competitor account, then add their ' +
              'posts — either by syncing a YouTube channel or with "Add content manually".'
            : `All ${total} competitor content item(s) are already classified. Next: detect patterns.`,
      };
    }

    let classified = 0;
    for (const item of items) {
      try {
        await this.classifyOne(item, organizationId);
        classified++;
      } catch (err) {
        this.logger.warn(`Failed to classify content ${item.id}: ${(err as Error).message}`);
      }
    }

    this.logger.log(`Classified ${classified}/${items.length} content items for project ${projectId}`);
    return { classified, total: items.length };
  }

  async classifyOne(
    item: { id: string; caption?: string | null; title?: string | null; description?: string | null; hashtags: string[]; contentType?: string | null; platform: string },
    organizationId?: string,
  ) {
    const prompt = [
      `Platform: ${item.platform}`,
      `Content type: ${item.contentType ?? 'unknown'}`,
      item.title ? `Title: ${item.title}` : '',
      item.caption ? `Caption: ${item.caption.slice(0, 800)}` : '',
      item.hashtags.length ? `Hashtags: ${item.hashtags.slice(0, 20).join(' ')}` : '',
      item.description ? `Description: ${item.description.slice(0, 400)}` : '',
    ].filter(Boolean).join('\n');

    const result = await this.router.generate({
      prompt,
      systemInstruction: SYSTEM,
      task: AiTask.FAST,
      organizationId,
      jsonSchema: CLASSIFICATION_SCHEMA as unknown as Record<string, unknown>,
      maxTokens: 512,
    });

    if (!result.text?.trim()) return null;

    const parsed = this.parseJson(result.text);

    return this.prisma.contentClassification.upsert({
      where: { contentId: item.id },
      update: {
        contentCategory: parsed.contentCategory,
        visualFormat: parsed.visualFormat,
        detectedTopics: parsed.detectedTopics ?? [],
        detectedObjects: parsed.detectedObjects ?? [],
        storytellingStyle: parsed.storytellingStyle,
        hookType: parsed.hookType,
        ctaType: parsed.ctaType,
        creativityScore: parsed.creativityScore,
        classifiedByModel: result.model,
        classifiedAt: new Date(),
      },
      create: {
        contentId: item.id,
        contentCategory: parsed.contentCategory,
        visualFormat: parsed.visualFormat,
        detectedTopics: parsed.detectedTopics ?? [],
        detectedObjects: parsed.detectedObjects ?? [],
        storytellingStyle: parsed.storytellingStyle,
        hookType: parsed.hookType,
        ctaType: parsed.ctaType,
        creativityScore: parsed.creativityScore,
        classifiedByModel: result.model,
      },
    });
  }

  /** Reads the model's JSON answer, repairing truncation or naming the failure. */
  private parseJson(text: string): Record<string, any> {
    return parseModelJson(text, 'Classification');
  }
}
