import { Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
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
  /** Not asserted by the server: nothing checks a script for originality. */
  originalityGuarantee?: string;
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
        include: { locations: true },
      }),
      this.prisma.contentIntelligenceConfig.findUnique({
        where: { projectId },
      }),
    ]);

    if (!project) {
      throw new NotFoundException('Project not found.');
    }
    const brandName = project.name;
    const city = project.locations?.[0]?.address?.split(',')[0]?.trim() || null;
    const industry = config?.industrySkill || null;

    const prompt = [
      `Brand: ${brandName}`,
      city ? `Target Market / City: ${city}` : null,
      industry ? `Industry: ${industry}` : null,
      `Target Platform: ${platform}`,
      `Topic / Opportunity: ${topic}`,
      opportunityContext ? `Competitive Context & Evidence: ${opportunityContext}` : null,
      '',
      'Generate a complete, production-ready video script with scene breakdowns, visual cues, on-screen text, caption, and hashtags.',
      `Make it 100% original and tailored to ${brandName}${industry ? ` in ${industry}` : ''}.`,
    ]
      .filter((line) => line !== null)
      .join('\n')
      .trim();

    const result = await this.router.generate({
      prompt,
      systemInstruction: SYSTEM_PROMPT,
      task: AiTask.REASONING,
      organizationId,
      jsonSchema: SCRIPT_SCHEMA as unknown as Record<string, unknown>,
      maxTokens: 4000,
    });

    // No template script stands in for a failed generation: a stock script
    // with the brand's name dropped in reads as one written for it.
    if (!result.text?.trim()) {
      throw new ServiceUnavailableException('The AI provider returned no script. Try generating it again.');
    }

    let parsed: any;
    try {
      parsed = parseModelJson(result.text, 'VideoScript');
    } catch (err: any) {
      this.logger.warn(`Failed to parse script JSON: ${err.message}`);
      throw new ServiceUnavailableException('The AI provider returned an unreadable script. Try generating it again.');
    }
    if (!Array.isArray(parsed.scenes) || parsed.scenes.length === 0) {
      throw new ServiceUnavailableException('The AI provider returned a script with no scenes. Try generating it again.');
    }

    // The model is asked for no originality claim, and one it volunteers is
    // dropped: nothing here verifies it.
    const { originalityGuarantee: _unverified, ...script } = parsed;
    return {
      ...script,
      platform: parsed.platform || platform,
      targetDuration: parsed.targetDuration || '',
      contentPillar: parsed.contentPillar || '',
      visualChecklist: Array.isArray(parsed.visualChecklist) ? parsed.visualChecklist : [],
      hashtags: Array.isArray(parsed.hashtags) ? parsed.hashtags : [],
    };
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
}
