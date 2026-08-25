import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AiTask, MultiAiRouterService } from '../ai-search/multi-ai-router/multi-ai-router.service';
import { parseModelJson } from '../ai-engine/utils/json-extractor.util';

const MATCH_SCHEMA = {
  type: 'object',
  properties: {
    matches: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          creatorId: { type: 'string' },
          matchScore: { type: 'number', minimum: 0, maximum: 100 },
          scoreBreakdown: {
            type: 'object',
            properties: {
              brandFit: { type: 'number', minimum: 0, maximum: 25 },
              industryFit: { type: 'number', minimum: 0, maximum: 25 },
              audienceFit: { type: 'number', minimum: 0, maximum: 25 },
              contentStyle: { type: 'number', minimum: 0, maximum: 25 },
            },
          },
          rationale: { type: 'string', description: '1-2 sentence explanation of why this creator fits' },
        },
        required: ['creatorId', 'matchScore', 'rationale'],
      },
    },
  },
  required: ['matches'],
  additionalProperties: false,
} as const;

const OUTREACH_SCHEMA = {
  type: 'object',
  properties: {
    subject: { type: 'string' },
    messageBody: { type: 'string' },
  },
  required: ['subject', 'messageBody'],
  additionalProperties: false,
} as const;

const MATCH_SYSTEM = `You are a creator matching specialist.
Score creators based on brand fit, industry relevance, audience alignment, and content style.
Each dimension is 0-25 points (total = 100).
Base your assessment on the creator profiles provided. Never invent follower counts or engagement rates.
Respond only with JSON matching the schema.`;

const OUTREACH_SYSTEM = `You are a brand partnership specialist writing a professional collaboration request.
Write in a warm, professional tone. Be specific about the campaign and product.
Do not make guarantees about payment — the customer will discuss terms directly.
Keep it concise (under 200 words).
Respond only with JSON matching the schema.`;

@Injectable()
export class CreatorService {
  private readonly logger = new Logger(CreatorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly router: MultiAiRouterService,
  ) {}

  // ── CRUD ──────────────────────────────────────────────────────────────────

  async listCreators(organizationId: string) {
    return this.prisma.creator.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async addCreator(organizationId: string, data: {
    name: string; handle?: string; platform?: string; email?: string;
    phone?: string; location?: string; category?: string; industry?: string;
    followerCount?: number; engagementRate?: number; averageBudget?: number;
    notes?: string; tags?: string[];
  }) {
    return this.prisma.creator.create({
      data: { organizationId, ...data, tags: data.tags ?? [] },
    });
  }

  async updateCreator(organizationId: string, creatorId: string, data: Partial<{
    name: string; handle: string; platform: string; email: string;
    location: string; category: string; notes: string; status: string;
  }>) {
    return this.prisma.creator.updateMany({
      where: { id: creatorId, organizationId },
      data,
    });
  }

  // ── MATCHING ─────────────────────────────────────────────────────────────

  /** Score all available creators against a campaign and save matches. */
  async matchCreators(organizationId: string, projectId: string, campaignId: string) {
    const [campaign, creators] = await Promise.all([
      this.prisma.campaign.findFirst({ where: { id: campaignId, organizationId } }),
      this.prisma.creator.findMany({ where: { organizationId, status: 'ACTIVE' }, take: 50 }),
    ]);

    if (!campaign || creators.length === 0) return { matched: 0 };

    const creatorSummary = creators.map(c =>
      `ID: ${c.id} | Name: ${c.name} | Category: ${c.category ?? 'unknown'} | Industry: ${c.industry ?? 'unknown'} | Location: ${c.location ?? 'unknown'} | Followers: ${c.followerCount ?? 'unknown'}`
    ).join('\n');

    const prompt = `
Campaign: ${campaign.name}
Objective: ${campaign.objective ?? 'Brand awareness'}
Product: ${campaign.productFocus ?? 'Not specified'}
Target Audience: ${campaign.targetAudience ?? 'Not specified'}
Platforms: ${campaign.platforms.join(', ')}

Available Creators:
${creatorSummary}

Score each creator's fit for this campaign.
`.trim();

    const result = await this.router.generate({
      prompt,
      systemInstruction: MATCH_SYSTEM,
      task: AiTask.FAST,
      organizationId,
      jsonSchema: MATCH_SCHEMA as unknown as Record<string, unknown>,
      maxTokens: 3000,
    });

    if (!result.text?.trim()) return { matched: 0 };

    const parsed = this.parseJson(result.text);
    const matches: any[] = parsed.matches ?? [];

    let saved = 0;
    for (const m of matches) {
      const creator = creators.find(c => c.id === m.creatorId);
      if (!creator) continue;
      await this.prisma.creatorMatch.upsert({
        where: { campaignId_creatorId: { campaignId, creatorId: m.creatorId } },
        update: { matchScore: Math.round(m.matchScore), scoreBreakdown: m.scoreBreakdown ?? null },
        create: {
          organizationId,
          projectId,
          campaignId,
          creatorId: m.creatorId,
          matchScore: Math.round(m.matchScore),
          scoreBreakdown: m.scoreBreakdown ? { ...m.scoreBreakdown, rationale: m.rationale } : { rationale: m.rationale },
          status: 'SUGGESTED',
        },
      });
      saved++;
    }

    return { matched: saved };
  }

  async listMatches(organizationId: string, campaignId: string) {
    return this.prisma.creatorMatch.findMany({
      where: { organizationId, campaignId },
      include: { creator: true },
      orderBy: { matchScore: 'desc' },
    });
  }

  async updateMatchStatus(organizationId: string, matchId: string, status: string) {
    return this.prisma.creatorMatch.updateMany({
      where: { id: matchId, organizationId },
      data: { status },
    });
  }

  // ── OUTREACH ─────────────────────────────────────────────────────────────

  /** Generate a collaboration outreach message for a creator. */
  async generateOutreachMessage(organizationId: string, projectId: string, data: {
    creatorId: string;
    campaignId?: string;
    brandName: string;
    campaignName?: string;
    product?: string;
    location?: string;
    proposedDate?: string;
  }) {
    const creator = await this.prisma.creator.findFirst({ where: { id: data.creatorId, organizationId } });
    if (!creator) return null;

    const prompt = `
Creator Name: ${creator.name}
Creator Category: ${creator.category ?? 'Creator'}
Brand: ${data.brandName}
Campaign: ${data.campaignName ?? 'Upcoming Campaign'}
Product: ${data.product ?? 'Our latest collection'}
Location: ${data.location ?? 'To be confirmed'}
Proposed Date: ${data.proposedDate ?? 'To be confirmed'}

Generate a professional collaboration request message.
`.trim();

    const result = await this.router.generate({
      prompt,
      systemInstruction: OUTREACH_SYSTEM,
      task: AiTask.FAST,
      organizationId,
      jsonSchema: OUTREACH_SCHEMA as unknown as Record<string, unknown>,
      maxTokens: 800,
    });

    if (!result.text?.trim()) return null;
    const parsed = this.parseJson(result.text);

    // Save as outreach record (not yet sent — awaiting customer approval)
    const outreach = await this.prisma.creatorOutreach.create({
      data: {
        organizationId,
        projectId,
        creatorId: data.creatorId,
        campaignId: data.campaignId,
        subject: parsed.subject,
        messageBody: parsed.messageBody,
        pipelineStage: 'SHORTLISTED',
        approvedToSend: false,
      },
    });

    return { outreach, generated: parsed };
  }

  async approveAndSendOutreach(organizationId: string, outreachId: string) {
    // Mark as approved — actual sending via email/DM integration is Phase 2
    return this.prisma.creatorOutreach.updateMany({
      where: { id: outreachId, organizationId },
      data: {
        approvedToSend: true,
        sentAt: new Date(),
        pipelineStage: 'CONTACTED',
        contactedAt: new Date(),
      },
    });
  }

  async listOutreach(organizationId: string, projectId: string) {
    return this.prisma.creatorOutreach.findMany({
      where: { organizationId, projectId },
      include: { creator: { select: { name: true, handle: true, category: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateOutreachStage(organizationId: string, outreachId: string, stage: string) {
    return this.prisma.creatorOutreach.updateMany({
      where: { id: outreachId, organizationId },
      data: { pipelineStage: stage },
    });
  }

  /** Reads the model's JSON answer, repairing truncation or naming the failure. */
  private parseJson(text: string): Record<string, any> {
    return parseModelJson(text, 'Creator');
  }
}
