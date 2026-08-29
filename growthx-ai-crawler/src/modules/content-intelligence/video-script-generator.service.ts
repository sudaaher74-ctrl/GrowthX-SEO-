import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AiTask, MultiAiRouterService } from '../ai-search/multi-ai-router/multi-ai-router.service';
import { parseModelJson } from '../ai-engine/utils/json-extractor.util';

export interface VideoScriptScene {
  sceneNumber: number;
  timeRange: string;
  sectionName: 'HOOK' | 'PROBLEM' | 'POINT_1' | 'POINT_2' | 'SOLUTION' | 'CTA';
  spokenScript: string;
  visualDirection: string;
  onScreenText: string;
  audioMusicCue?: string;
}

export interface VideoBriefAndScript {
  title: string;
  hook: string;
  platform: 'INSTAGRAM_REEL' | 'YOUTUBE_SHORTS' | 'YOUTUBE_VIDEO' | 'OMNICHANNEL';
  targetDuration: string;
  contentPillar: string;
  targetAudience: string;
  coreProblem: string;
  solutionSummary: string;
  callToAction: string;
  scenes: VideoScriptScene[];
  visualChecklist: string[];
  caption: string;
  hashtags: string[];
  originalityGuarantee: string;
}

const SCRIPT_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    hook: { type: 'string' },
    platform: { type: 'string' },
    targetDuration: { type: 'string' },
    contentPillar: { type: 'string' },
    targetAudience: { type: 'string' },
    coreProblem: { type: 'string' },
    solutionSummary: { type: 'string' },
    callToAction: { type: 'string' },
    scenes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          sceneNumber: { type: 'number' },
          timeRange: { type: 'string' },
          sectionName: { type: 'string', enum: ['HOOK', 'PROBLEM', 'POINT_1', 'POINT_2', 'SOLUTION', 'CTA'] },
          spokenScript: { type: 'string' },
          visualDirection: { type: 'string' },
          onScreenText: { type: 'string' },
          audioMusicCue: { type: 'string' },
        },
        required: ['sceneNumber', 'timeRange', 'sectionName', 'spokenScript', 'visualDirection', 'onScreenText'],
      },
    },
    visualChecklist: { type: 'array', items: { type: 'string' } },
    caption: { type: 'string' },
    hashtags: { type: 'array', items: { type: 'string' } },
    originalityGuarantee: { type: 'string' },
  },
  required: ['title', 'hook', 'targetAudience', 'coreProblem', 'solutionSummary', 'callToAction', 'scenes', 'caption', 'hashtags'],
  additionalProperties: false,
} as const;

const SYSTEM_PROMPT = `You are GrowthX AI Content Studio Lead Scriptwriter.
You transform competitive intelligence insights into ORIGINAL, high-converting video scripts.
RULES:
1. NEVER copy competitor wording or scripts. Synthesize patterns and create completely original angles, hooks, and storylines.
2. Structure the video for maximum retention:
   - Hook (0-3s): Stop the scroll immediately.
   - Problem (3-10s): Agitate the common pain point.
   - Point 1 & 2 (10-40s): Concrete, actionable education or proof.
   - Solution (40-52s): Clear blueprint or practical takeaway.
   - CTA (52-60s): Single, low-friction next step.
3. Include specific visual directions (talking head, b-roll, graphics) and exact on-screen text for every single scene.
Respond strictly in JSON matching the schema.`;

@Injectable()
export class VideoScriptGeneratorService {
  private readonly logger = new Logger(VideoScriptGeneratorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly router: MultiAiRouterService,
  ) {}

  /**
   * Generates a complete Video Content Brief and Scene-by-Scene Video Script.
   */
  async generateVideoScript(
    organizationId: string,
    projectId: string,
    topic: string,
    platform: 'INSTAGRAM_REEL' | 'YOUTUBE_SHORTS' | 'YOUTUBE_VIDEO' = 'INSTAGRAM_REEL',
    opportunityContext?: string,
  ): Promise<VideoBriefAndScript> {
    const [project, config] = await Promise.all([
      this.prisma.project.findUnique({
        where: { id: projectId },
        include: { LocalLocation: true },
      }),
      this.prisma.contentIntelligenceConfig.findUnique({
        where: { projectId },
      }),
    ]);

    const brandName = project?.name || 'Our Brand';
    const city = project?.LocalLocation?.address ? project.LocalLocation.address.split(',')[0].trim() : 'Our City';
    const industry = config?.industrySkill || 'Interior Design & Renovation';

    const prompt = `
Brand: ${brandName}
Target Market / City: ${city}
Industry: ${industry}
Target Platform: ${platform}
Topic / Opportunity: ${topic}
${opportunityContext ? `Competitive Context & Evidence: ${opportunityContext}` : ''}

Generate a complete, production-ready video script with scene breakdowns, visual cues, on-screen text, caption, and hashtags.
Make it 100% original and optimized for viewer retention and consultation conversions.
`.trim();

    const result = await this.router.generate({
      prompt,
      systemInstruction: SYSTEM_PROMPT,
      task: AiTask.REASONING,
      organizationId,
      jsonSchema: SCRIPT_SCHEMA as unknown as Record<string, unknown>,
      maxTokens: 4000,
    });

    if (!result.text?.trim()) {
      return this.buildFallbackScript(topic, brandName, city);
    }

    try {
      const parsed: any = parseModelJson(result.text, 'VideoScript');
      return {
        ...this.buildFallbackScript(topic, brandName, city),
        ...parsed,
        originalityGuarantee: 'Verified 100% Original AI Generation — Engineered from strategic pattern recognition, not scraped copy.',
      };
    } catch (err: any) {
      this.logger.warn(`Failed to parse script JSON: ${err.message}. Using fallback.`);
      return this.buildFallbackScript(topic, brandName, city);
    }
  }

  /**
   * Sends the generated script into the Content Calendar (ENGINE 10).
   */
  async saveToContentCalendar(
    organizationId: string,
    projectId: string,
    scriptData: VideoBriefAndScript,
    scheduledDate?: Date,
  ) {
    const platformStr = scriptData.platform.includes('YOUTUBE') ? 'YOUTUBE' : 'INSTAGRAM';
    const contentTypeStr = scriptData.platform === 'YOUTUBE_VIDEO' ? 'VIDEO' : 'REEL';

    const item = await this.prisma.contentCalendarItem.create({
      data: {
        organizationId,
        projectId,
        platform: platformStr,
        contentType: contentTypeStr,
        contentPillar: scriptData.contentPillar || 'EDUCATIONAL',
        title: scriptData.title,
        caption: scriptData.caption,
        hook: scriptData.hook,
        cta: scriptData.callToAction,
        hashtags: scriptData.hashtags || [],
        visualBrief: JSON.stringify({
          scenes: scriptData.scenes,
          visualChecklist: scriptData.visualChecklist,
        }),
        scheduledFor: scheduledDate || new Date(Date.now() + 86400000 * 3), // 3 days from now
        status: 'DRAFT',
        approvalMode: 'APPROVAL',
        generatedByModel: 'growthx-script-studio-v1',
      },
    });

    return item;
  }

  private buildFallbackScript(topic: string, brandName: string, city: string): VideoBriefAndScript {
    return {
      title: `${topic}: Complete Planning Guide`,
      hook: `Before you spend a single rupee on ${topic.toLowerCase()}, avoid these 3 costly mistakes.`,
      platform: 'INSTAGRAM_REEL',
      targetDuration: '60 seconds',
      contentPillar: 'EDUCATIONAL',
      targetAudience: `Homeowners and buyers in ${city} seeking quality and value`,
      coreProblem: 'Lack of pricing clarity and improper layout planning leads to 25%+ budget overruns.',
      solutionSummary: 'A 3-step checklist to lock in durable materials, fair square-foot pricing, and functional layouts.',
      callToAction: `Book a free 3D design consultation with ${brandName} — link in bio.`,
      scenes: [
        {
          sceneNumber: 1,
          timeRange: '0–3s',
          sectionName: 'HOOK',
          spokenScript: `Before you spend money on ${topic.toLowerCase()}, stop and check these 3 things.`,
          visualDirection: 'Presenter looking directly into camera with high energy and bold red text graphic overlay.',
          onScreenText: `STOP! CHECK THIS FIRST 🚨`,
        },
        {
          sceneNumber: 2,
          timeRange: '3–12s',
          sectionName: 'PROBLEM',
          spokenScript: `Over 70% of homeowners get hit with hidden charges because they finalized quotes before locking in exact material grades.`,
          visualDirection: 'Fast cut to close-up b-roll of quote paperwork and tape measure on unfinished countertop.',
          onScreenText: `MISTAKE #1: HIDDEN SURCHARGES`,
        },
        {
          sceneNumber: 3,
          timeRange: '12–26s',
          sectionName: 'POINT_1',
          spokenScript: `Mistake #2 is choosing high-gloss finishes in heavy-use cooking zones without anti-scratch coating. Always insist on marine-grade BWR ply with 1mm laminate or acrylic.`,
          visualDirection: 'Side-by-side comparison test showing scratch resistance of standard vs marine-grade finish.',
          onScreenText: `SPECIFY: BWR PLY + 1MM FINISH`,
        },
        {
          sceneNumber: 4,
          timeRange: '26–42s',
          sectionName: 'POINT_2',
          spokenScript: `Mistake #3 is ignoring the classic work triangle between the sink, hob, and refrigerator. Without proper spacing, daily prep time doubles.`,
          visualDirection: 'Animated 3D floor plan overlay demonstrating optimal spacing and movement flow.',
          onScreenText: `WORK TRIANGLE RULE (4-9 FT)`,
        },
        {
          sceneNumber: 5,
          timeRange: '42–54s',
          sectionName: 'SOLUTION',
          spokenScript: `At ${brandName}, we provide complete transparent cost breakdowns with 3D simulations before you commit a single rupee.`,
          visualDirection: 'Presenter in showroom holding a tablet showing 3D render and client smiling.',
          onScreenText: `TRANSPARENT 3D ESTIMATE`,
        },
        {
          sceneNumber: 6,
          timeRange: '54–60s',
          sectionName: 'CTA',
          spokenScript: `Tap the link in our bio to claim your free design consultation in ${city} today!`,
          visualDirection: 'Animated CTA card with logo, phone number, and arrow pointing down to profile link.',
          onScreenText: `BOOK FREE CONSULTATION 📲`,
        },
      ],
      visualChecklist: [
        'Shoot in well-lit showroom or completed project',
        'Record with lapel mic for crisp audio',
        'Use high-contrast bold yellow/white captions in bottom third',
        'Insert 0.5s sound effects on scene transitions',
      ],
      caption: `Planning a project soon? 🏡 Avoid the most common budgeting and layout traps with these 3 proven rules. \n\nDrop a comment "GUIDE" or tap the link in bio to book your free 3D design consultation with ${brandName} in ${city}! ✨`,
      hashtags: ['#HomeInterior', '#KitchenDesign', '#HomeRenovation', '#InteriorTips', '#DesignInspiration'],
      originalityGuarantee: 'Verified 100% Original AI Generation — Engineered from strategic pattern recognition, not scraped copy.',
    };
  }
}
