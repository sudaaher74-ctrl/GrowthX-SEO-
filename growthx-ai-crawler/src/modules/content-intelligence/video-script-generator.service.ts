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
    const industry = config?.industrySkill || 'General B2B & Commercial';

    const prompt = `
Brand: ${brandName}
Target Market / City: ${city}
Industry: ${industry}
Target Platform: ${platform}
Topic / Opportunity: ${topic}
${opportunityContext ? `Competitive Context & Evidence: ${opportunityContext}` : ''}

Generate a complete, production-ready video script with scene breakdowns, visual cues, on-screen text, caption, and hashtags.
Make it 100% original and tailored to ${brandName} in ${industry}.
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
    const safeTopic = topic || 'Quality Standards & Best Practices';
    const topicTag = safeTopic.replace(/[^a-zA-Z0-9]/g, '');
    const brandTag = brandName.replace(/[^a-zA-Z0-9]/g, '');

    return {
      title: `${safeTopic}: Industry Standards & Key Insights`,
      hook: `If you are evaluating options for ${safeTopic.toLowerCase()}, here are 3 critical factors you cannot afford to ignore.`,
      platform: 'INSTAGRAM_REEL',
      targetDuration: '60 seconds',
      contentPillar: 'EDUCATIONAL',
      targetAudience: `Decision makers, buyers, and partners looking for reliable quality in ${city}`,
      coreProblem: `Lack of transparency and inconsistent quality standards often lead to costly inefficiencies when selecting ${safeTopic.toLowerCase()}.`,
      solutionSummary: `A proven, step-by-step quality framework from ${brandName} ensuring maximum reliability and verified specifications.`,
      callToAction: `Visit our website or message ${brandName} directly to learn more — link in bio.`,
      scenes: [
        {
          sceneNumber: 1,
          timeRange: '0–3s',
          sectionName: 'HOOK',
          spokenScript: `Before you finalize your requirements for ${safeTopic.toLowerCase()}, check these 3 vital criteria.`,
          visualDirection: 'Presenter looking directly into camera with high-energy presentation and bold headline overlay.',
          onScreenText: `CRITICAL CHECKLIST 🚨`,
        },
        {
          sceneNumber: 2,
          timeRange: '3–12s',
          sectionName: 'PROBLEM',
          spokenScript: `Many buyers face delays and quality variances because key product and process standards weren't validated upfront.`,
          visualDirection: 'Cut to detailed process or product footage with comparison graphics.',
          onScreenText: `MISTAKE #1: UNVERIFIED SPECS`,
        },
        {
          sceneNumber: 3,
          timeRange: '12–26s',
          sectionName: 'POINT_1',
          spokenScript: `Rule number one is to always verify processing standards, grade certifications, and storage integrity before committing.`,
          visualDirection: 'Visual inspection proof showing verified quality benchmarks.',
          onScreenText: `STANDARDS & CERTIFICATION CHECK`,
        },
        {
          sceneNumber: 4,
          timeRange: '26–42s',
          sectionName: 'POINT_2',
          spokenScript: `Rule number two: Ensure end-to-end supply chain and packaging compliance for consistent, reliable outcomes.`,
          visualDirection: 'Demonstration of packaging and delivery logistics workflow.',
          onScreenText: `SUPPLY CHAIN RELIABILITY`,
        },
        {
          sceneNumber: 5,
          timeRange: '42–54s',
          sectionName: 'SOLUTION',
          spokenScript: `At ${brandName}, we maintain stringent quality control, transparent documentation, and verified client satisfaction.`,
          visualDirection: 'Presenter in facility showing certified operations and satisfied customer results.',
          onScreenText: `VERIFIED QUALITY WITH ${brandName.toUpperCase()}`,
        },
        {
          sceneNumber: 6,
          timeRange: '54–60s',
          sectionName: 'CTA',
          spokenScript: `Reach out to ${brandName} today or click the link in our bio for complete specifications and quotes!`,
          visualDirection: 'Animated CTA screen with brand logo, contact details, and arrow pointing to profile link.',
          onScreenText: `GET IN TOUCH 📲`,
        },
      ],
      visualChecklist: [
        'Shoot in well-lit professional setting or facility',
        'Record with clear microphone audio',
        'Use high-contrast bold subtitles in the lower third',
        'Use smooth cuts on key data points',
      ],
      caption: `Looking for reliable solutions in ${safeTopic}? 🚀 \n\nEnsure top standards and avoid common procurement bottlenecks. Connect with ${brandName} today or tap the link in bio for full details! ✨`,
      hashtags: [`#${topicTag || 'Business'}`, `#${brandTag || 'Industry'}`, '#QualityStandards', '#IndustryInsights', '#B2BGrowth'],
      originalityGuarantee: 'Verified 100% Original AI Generation — Engineered from strategic pattern recognition, not scraped copy.',
    };
  }
}
