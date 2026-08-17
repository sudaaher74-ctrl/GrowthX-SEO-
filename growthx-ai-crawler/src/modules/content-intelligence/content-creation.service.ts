import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AiTask, MultiAiRouterService } from '../ai-search/multi-ai-router/multi-ai-router.service';

const CONTENT_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string', description: 'Content title / headline' },
    hook: { type: 'string', description: 'Opening hook — first 1-2 sentences to stop the scroll' },
    caption: { type: 'string', description: 'Full caption for the post' },
    cta: { type: 'string', description: 'Call to action' },
    hashtags: { type: 'array', items: { type: 'string' }, maxItems: 20 },
    visualBrief: { type: 'string', description: 'Brief description of the visual/creative direction for this piece' },
  },
  required: ['title', 'hook', 'caption', 'cta'],
  additionalProperties: false,
} as const;

const SYSTEM = `You are GrowthX AI Content Creator.
Generate original, creative content for this brand.
NEVER copy competitor content. The content must be differentiated and brand-specific.
Follow the brand voice, tone, and messaging rules provided.
Do not invent statistics, prices, awards, client names, or testimonials.
If you need a specific number you do not have, write around it.
Respond only with JSON matching the schema.`;

@Injectable()
export class ContentCreationService {
  private readonly logger = new Logger(ContentCreationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly router: MultiAiRouterService,
  ) {}

  /** Generate original content for a calendar item brief. */
  async generateContent(
    projectId: string,
    organizationId: string,
    brief: {
      platform: string;
      contentType: string;
      contentPillar?: string;
      topic: string;
      campaignName?: string;
      gapContext?: string;
      visualDirection?: string;
    },
  ) {
    const [project, config] = await Promise.all([
      this.prisma.project.findUnique({ where: { id: projectId }, select: { name: true } }),
      this.prisma.contentIntelligenceConfig.findUnique({ where: { projectId } }),
    ]);

    const prompt = `
Brand: ${project?.name ?? 'Unknown Brand'}
Industry: ${config?.industrySkill ?? 'GENERIC'}
Platform: ${brief.platform}
Content Type: ${brief.contentType}
Content Pillar: ${brief.contentPillar ?? 'GENERAL'}
Topic: ${brief.topic}
${brief.campaignName ? `Campaign: ${brief.campaignName}` : ''}
${brief.gapContext ? `Content Opportunity Context: ${brief.gapContext}` : ''}
${brief.visualDirection ? `Visual Direction: ${brief.visualDirection}` : ''}

Generate original, on-brand content for this piece.
`.trim();

    const result = await this.router.generate({
      prompt,
      systemInstruction: SYSTEM,
      task: AiTask.REASONING,
      organizationId,
      jsonSchema: CONTENT_SCHEMA as unknown as Record<string, unknown>,
      maxTokens: 2000,
    });

    if (!result.text?.trim()) return null;
    const parsed = this.parseJson(result.text);

    // Save as a calendar item in DRAFT status
    const item = await this.prisma.contentCalendarItem.create({
      data: {
        organizationId,
        projectId,
        platform: brief.platform,
        contentType: brief.contentType,
        contentPillar: brief.contentPillar,
        title: parsed.title ?? brief.topic,
        caption: parsed.caption,
        hook: parsed.hook,
        cta: parsed.cta,
        hashtags: parsed.hashtags ?? [],
        visualBrief: parsed.visualBrief ?? brief.visualDirection,
        generatedByModel: result.model,
        status: 'DRAFT',
      },
    });

    return { ...item, generated: parsed };
  }

  /** List content calendar items. */
  async listCalendarItems(
    organizationId: string,
    projectId: string,
    filters?: {
      status?: string;
      platform?: string;
      campaignId?: string;
      from?: Date;
      to?: Date;
    },
  ) {
    return this.prisma.contentCalendarItem.findMany({
      where: {
        organizationId,
        projectId,
        ...(filters?.status && { status: filters.status }),
        ...(filters?.platform && { platform: filters.platform }),
        ...(filters?.campaignId && { campaignId: filters.campaignId }),
        ...(filters?.from || filters?.to
          ? {
              scheduledFor: {
                ...(filters.from && { gte: filters.from }),
                ...(filters.to && { lte: filters.to }),
              },
            }
          : {}),
      },
      include: {
        campaign: { select: { name: true } },
        gap: { select: { title: true } },
      },
      orderBy: { scheduledFor: 'asc' },
    });
  }

  /** Update a calendar item (approve, schedule, reject). */
  async updateCalendarItem(
    organizationId: string,
    itemId: string,
    data: {
      status?: string;
      scheduledFor?: Date;
      caption?: string;
      hook?: string;
      cta?: string;
      hashtags?: string[];
    },
  ) {
    return this.prisma.contentCalendarItem.updateMany({
      where: { id: itemId, organizationId },
      data,
    });
  }

  /** Create a calendar item manually. */
  async createCalendarItem(
    organizationId: string,
    projectId: string,
    data: {
      platform: string;
      contentType: string;
      contentPillar?: string;
      title: string;
      caption?: string;
      scheduledFor?: Date;
      campaignId?: string;
    },
  ) {
    return this.prisma.contentCalendarItem.create({
      data: {
        organizationId,
        projectId,
        platform: data.platform,
        contentType: data.contentType,
        contentPillar: data.contentPillar,
        title: data.title,
        caption: data.caption,
        scheduledFor: data.scheduledFor,
        campaignId: data.campaignId,
        status: 'DRAFT',
      },
    });
  }

  private parseJson(text: string): Record<string, any> {
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    const candidate = fenced ? fenced[1] : text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
    try { return JSON.parse(candidate); } catch { return {}; }
  }
}
