import { Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AiTask, MultiAiRouterService } from '../ai-search/multi-ai-router/multi-ai-router.service';
import { parseModelJson } from '../ai-engine/utils/json-extractor.util';

export interface IngestVideoPayload {
  accountId: string;
  platform: 'YOUTUBE' | 'INSTAGRAM';
  contentType: 'REEL' | 'VIDEO' | 'SHORT';
  title?: string;
  caption?: string;
  description?: string;
  contentUrl?: string;
  thumbnailUrl?: string;
  duration?: number;
  viewsCount?: number;
  likesCount?: number;
  commentsCount?: number;
  sharesCount?: number;
  publishedAt?: string | Date;
  rawTranscript?: string;
  rawOcrText?: string;
}

const VIDEO_INTELLIGENCE_SCHEMA = {
  type: 'object',
  properties: {
    classification: {
      type: 'object',
      properties: {
        topic: { type: 'string', description: 'Primary subject e.g. Modular Kitchen Cost' },
        subtopic: { type: 'string', description: 'Specific angle e.g. Acrylic vs Laminate Finish' },
        contentPillar: {
          type: 'string',
          enum: [
            'EDUCATIONAL', 'PROMOTIONAL', 'PRODUCT', 'SERVICE', 'PROJECT_SHOWCASE',
            'BEFORE_AFTER', 'TESTIMONIAL', 'CASE_STUDY', 'FAQ', 'TIPS',
            'TUTORIAL', 'BEHIND_SCENES', 'INDUSTRY_NEWS', 'ENTERTAINMENT', 'OTHER',
          ],
        },
        format: {
          type: 'string',
          enum: ['TALKING_HEAD', 'TALKING_HEAD_AND_BROLL', 'BROLL_VOICEOVER', 'PROJECT_TOUR', 'BEFORE_AFTER', 'TUTORIAL_DEMO', 'SCREEN_RECORDING', 'CAROUSEL_VIDEO', 'INTERVIEW', 'OTHER'],
        },
        hookType: {
          type: 'string',
          enum: ['QUESTION', 'PROBLEM', 'CURIOSITY', 'STATISTIC', 'MISTAKE', 'WARNING', 'BEFORE_AFTER', 'STRONG_CLAIM', 'STORY', 'LIST', 'COMPARISON', 'DIRECT_STATEMENT'],
        },
        hookText: { type: 'string', description: 'The exact opening hook phrase or question' },
        hookDurationSeconds: { type: 'number', description: 'Estimated length of the hook in seconds' },
        ctaType: {
          type: 'string',
          enum: ['BOOK_CONSULTATION', 'VISIT_WEBSITE', 'CALL', 'DM', 'COMMENT', 'SUBSCRIBE', 'FOLLOW', 'BUY', 'LEARN_MORE', 'DOWNLOAD', 'NONE'],
        },
        ctaText: { type: 'string', description: 'The exact call to action used' },
        audience: { type: 'string', description: 'Target persona e.g. New Homeowners, Renovation Buyers' },
        searchIntent: { type: 'string', description: 'e.g. Commercial Investigation, Informational, Transactional' },
        marketingIntent: { type: 'string', description: 'e.g. Lead Generation, Brand Authority, Objection Handling' },
        funnelStage: {
          type: 'string',
          enum: ['AWARENESS', 'CONSIDERATION', 'CONVERSION', 'RETENTION'],
        },
        tone: { type: 'string', description: 'e.g. Authoritative, Relatable, Urgent, Practical' },
        visualStyle: { type: 'string', description: 'e.g. Cinematic B-Roll, Fast-paced Text Overlays, Minimalist' },
        contentObjective: { type: 'string', description: 'Primary goal achieved by this video' },
        confidence: { type: 'number', minimum: 0, maximum: 100 },
      },
      required: ['topic', 'contentPillar', 'format', 'hookType', 'hookText', 'ctaType', 'funnelStage'],
    },
    transcriptAnalysis: {
      type: 'object',
      properties: {
        hook: { type: 'string' },
        intro: { type: 'string' },
        problem: { type: 'string' },
        explanation: { type: 'string' },
        solution: { type: 'string' },
        cta: { type: 'string' },
        conclusion: { type: 'string' },
        segments: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              timestamp: { type: 'string', description: 'e.g. 00:00, 00:05, 00:21' },
              text: { type: 'string' },
              type: { type: 'string', description: 'HOOK | PROBLEM | EDUCATION | SOLUTION | CTA' },
            },
            required: ['timestamp', 'text', 'type'],
          },
        },
      },
      required: ['hook', 'problem', 'solution', 'cta', 'segments'],
    },
    visualAndScenes: {
      type: 'object',
      properties: {
        ocrText: { type: 'string', description: 'Extracted key text overlays on screen' },
        detectedObjects: { type: 'array', items: { type: 'string' } },
        scenes: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              sceneNumber: { type: 'number' },
              timeRange: { type: 'string', description: 'e.g. 0-4s, 4-12s' },
              visualFormat: { type: 'string' },
              description: { type: 'string' },
              onScreenText: { type: 'string' },
            },
            required: ['sceneNumber', 'timeRange', 'visualFormat', 'description'],
          },
        },
      },
      required: ['ocrText', 'detectedObjects', 'scenes'],
    },
    whyThisContentWorks: {
      type: 'string',
      description: 'Strategic teardown explaining why this content performs, the psychological hook, visual pacing, and strategic formula used.',
    },
  },
  required: ['classification', 'transcriptAnalysis', 'visualAndScenes', 'whyThisContentWorks'],
  additionalProperties: false,
} as const;

const SYSTEM_PROMPT = `You are GrowthX Social Video Intelligence Analyst.
Analyze the video content metadata, transcript, title, description, and visual cues.
Deconstruct the video strategy:
1. Identify the exact hook type and opening text.
2. Structure the transcript into timestamped segments (00:00 Hook, 00:05 Problem, 00:21 Solution, 00:55 CTA).
3. Extract key representative visual scenes and on-screen OCR text.
4. Classify topic, content pillar, CTA, funnel stage (Awareness, Consideration, Conversion, Retention).
5. Explain clearly "Why This Content Works" — reverse-engineering the strategic formula so the customer understands the underlying mechanism without copying the content.
Never fabricate private analytics like retention curves or internal CTR.
Respond strictly in valid JSON matching the schema.`;

@Injectable()
export class VideoIntelligenceService {
  private readonly logger = new Logger(VideoIntelligenceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly router: MultiAiRouterService,
  ) {}

  /**
   * Ingests and processes a competitor video/Reel through the complete multi-modal video intelligence pipeline.
   */
  async ingestAndAnalyzeVideo(
    organizationId: string,
    projectId: string,
    payload: IngestVideoPayload,
  ) {
    const account = await this.prisma.competitorAccount.findFirst({
      where: { id: payload.accountId, organizationId, projectId },
    });

    if (!account) {
      throw new NotFoundException('Competitor account not found.');
    }

    // 1. Create or update the normalized ContentItem (CompetitorContent)
    const content = await this.prisma.competitorContent.create({
      data: {
        organizationId,
        projectId,
        accountId: account.id,
        platform: payload.platform,
        contentType: payload.contentType,
        title: payload.title || payload.caption?.slice(0, 100) || 'Untitled Video',
        description: payload.description || payload.caption,
        caption: payload.caption,
        contentUrl: payload.contentUrl,
        // Only what the platform gave us: a stock photo or a typical length in
        // place of a missing one reads as this video's own.
        thumbnailUrl: payload.thumbnailUrl ?? null,
        duration: payload.duration ?? null,
        viewsCount: payload.viewsCount ?? null,
        likesCount: payload.likesCount ?? null,
        commentsCount: payload.commentsCount ?? null,
        sharesCount: payload.sharesCount ?? null,
        engagementAvailable: payload.viewsCount != null || payload.likesCount != null,
        publishedAt: payload.publishedAt ? new Date(payload.publishedAt) : new Date(),
        dataSourceType: 'PUBLIC_DATA',
      },
    });

    // 2. Run the 2-stage multi-modal AI Video Analysis. The item is real either
    // way; a failed analysis leaves it unanalysed rather than losing it.
    try {
      const analysis = await this.analyzeVideoContent(content, payload.rawTranscript, payload.rawOcrText, organizationId);
      return { content, analysis, analysisError: null };
    } catch (err: any) {
      this.logger.warn(`Video analysis failed for content ${content.id}: ${err.message}`);
      return { content, analysis: null, analysisError: err.message as string };
    }
  }

  /**
   * Deep multi-modal analysis of a video content item using AI.
   */
  async analyzeVideoContent(
    content: any,
    rawTranscript?: string,
    rawOcrText?: string,
    organizationId?: string,
  ) {
    const prompt = `
Platform: ${content.platform}
Format: ${content.contentType}
Title: ${content.title || 'N/A'}
Caption: ${content.caption || 'N/A'}
Description: ${content.description || 'N/A'}
Duration: ${content.duration ? `${content.duration} seconds` : 'Unknown'}
Public Metrics: Views=${content.viewsCount ?? 'N/A'}, Likes=${content.likesCount ?? 'N/A'}, Comments=${content.commentsCount ?? 'N/A'}
${rawTranscript ? `Provided Transcript:\n${rawTranscript}` : ''}
${rawOcrText ? `Provided OCR On-Screen Text:\n${rawOcrText}` : ''}

Deconstruct this video's hook, speech transcript, representative scene breakdown, OCR text, content classification, and reverse-engineer why this content succeeds.
`.trim();

    const result = await this.router.generate({
      prompt,
      systemInstruction: SYSTEM_PROMPT,
      task: AiTask.REASONING,
      organizationId,
      jsonSchema: VIDEO_INTELLIGENCE_SCHEMA as unknown as Record<string, unknown>,
      maxTokens: 3500,
    });

    // No stock analysis stands in for a failed one: a generic transcript saved
    // against a competitor's video is indistinguishable from what they said.
    if (!result.text?.trim()) {
      throw new ServiceUnavailableException('The AI provider returned no analysis for this video. Nothing was saved.');
    }
    let parsed: any;
    try {
      parsed = parseModelJson(result.text, 'VideoIntelligence');
    } catch (err: any) {
      this.logger.warn(`Failed to parse video analysis JSON: ${err.message}`);
      throw new ServiceUnavailableException('The AI provider returned an unreadable analysis for this video. Nothing was saved.');
    }

    const cls = parsed.classification || {};
    const trn = parsed.transcriptAnalysis || {};
    const vis = parsed.visualAndScenes || {};
    const whyItWorks: string | null = parsed.whyThisContentWorks || null;
    const hookText = cls.hookText || trn.hook || null;

    // 3. Persist Video Intelligence data onto CompetitorContent
    await this.prisma.competitorContent.update({
      where: { id: content.id },
      data: {
        transcript: trn.explanation ? `${trn.hook}\n\n${trn.problem}\n\n${trn.explanation}\n\n${trn.solution}\n\n${trn.cta}` : rawTranscript || null,
        transcriptSegments: trn.segments || [],
        ocrText: vis.ocrText || rawOcrText || null,
        scenes: vis.scenes || [],
        hookAnalysis: hookText
          ? {
              hook: hookText,
              hookType: cls.hookType ?? null,
              durationSeconds: cls.hookDurationSeconds ?? null,
            }
          : undefined,
        structureAnalysis: {
          hookDuration: cls.hookDurationSeconds ?? null,
          intro: trn.intro || trn.hook || null,
          problem: trn.problem || null,
          solution: trn.solution || null,
          ctaPlacement: cls.ctaType || null,
          conclusion: trn.conclusion || trn.cta || null,
        },
        whyItWorks,
      },
    });

    // 4. Persist structured classification onto ContentClassification. Every
    // field is the model's answer or null — never a plausible default.
    const fields = {
      contentCategory: cls.contentPillar ?? null,
      contentPillar: cls.contentPillar ?? null,
      topic: cls.topic ?? null,
      subtopic: cls.subtopic ?? null,
      format: cls.format ?? null,
      visualFormat: cls.format ?? null,
      detectedTopics: [cls.topic, cls.subtopic].filter(Boolean),
      detectedObjects: Array.isArray(vis.detectedObjects) ? vis.detectedObjects : [],
      storytellingStyle: cls.tone ?? null,
      hookType: cls.hookType ?? null,
      ctaType: cls.ctaType ?? null,
      ctaText: cls.ctaText ?? null,
      audience: cls.audience ?? null,
      searchIntent: cls.searchIntent ?? null,
      marketingIntent: cls.marketingIntent ?? null,
      funnelStage: cls.funnelStage ?? null,
      tone: cls.tone ?? null,
      visualStyle: cls.visualStyle ?? null,
      contentObjective: cls.contentObjective ?? null,
      confidence: typeof cls.confidence === 'number' ? Math.round(cls.confidence) : null,
      classifiedByModel: result.model,
    };
    const classification = await this.prisma.contentClassification.upsert({
      where: { contentId: content.id },
      update: { ...fields, classifiedAt: new Date() },
      create: { contentId: content.id, ...fields },
    });

    return {
      classification,
      transcriptAnalysis: trn,
      visualAndScenes: vis,
      whyThisContentWorks: whyItWorks,
    };
  }

  /**
   * Retrieves full video intelligence detail for a single content item.
   */
  async getVideoDetails(organizationId: string, contentId: string) {
    const item = await this.prisma.competitorContent.findFirst({
      where: {
        id: contentId,
        ...(organizationId ? { organizationId } : {}),
      },
      include: {
        account: {
          select: {
            handle: true,
            displayName: true,
            platform: true,
            businessName: true,
            location: true,
            matchConfidence: true,
            verificationStatus: true,
          },
        },
        classification: true,
      },
    });

    if (!item) {
      throw new NotFoundException('Video content item not found.');
    }

    return item;
  }
}
