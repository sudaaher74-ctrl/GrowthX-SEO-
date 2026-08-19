import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AiTask, MultiAiRouterService } from '../ai-search/multi-ai-router/multi-ai-router.service';

const STRATEGY_SCHEMA = {
  type: 'object',
  properties: {
    executiveSummary: { type: 'string' },
    contentPillars: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          pillar: { type: 'string', description: 'e.g. PRODUCT, EDUCATIONAL, LIFESTYLE, CREATOR, PROMOTIONAL' },
          percentage: { type: 'number', minimum: 0, maximum: 100 },
          rationale: { type: 'string' },
          topics: { type: 'array', items: { type: 'string' } },
        },
        required: ['pillar', 'percentage', 'rationale'],
      },
    },
    platformFrequency: {
      type: 'object',
      description: 'Platform → posts per week, e.g. {"INSTAGRAM": 5, "YOUTUBE": 1}',
    },
    whatToAvoid: { type: 'array', items: { type: 'string' } },
    whatToTest: { type: 'array', items: { type: 'string' } },
    whatToScale: { type: 'array', items: { type: 'string' } },
    campaignIdeas: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          objective: { type: 'string' },
          concept: { type: 'string' },
          contentTypes: { type: 'array', items: { type: 'string' } },
          differentiator: { type: 'string' },
        },
        required: ['name', 'objective', 'concept'],
      },
    },
    creatorStrategy: { type: 'string' },
    hooks: { type: 'array', items: { type: 'string' }, description: '5-10 proven hook formulas for this brand' },
    ctaStrategy: { type: 'string' },
  },
  required: ['executiveSummary', 'contentPillars', 'campaignIdeas'],
  additionalProperties: false,
} as const;

const SYSTEM = `You are GrowthX AI Content Strategist.
Your role is to create a differentiated content strategy that sets the brand apart from its competitors.
Do NOT recommend copying competitors. Recommend strategies that exploit gaps and opportunities.
Content pillar percentages must sum to exactly 100%.
All recommendations must be grounded in the data provided — never invent statistics.
Respond only with JSON matching the schema.`;

@Injectable()
export class ContentStrategyService {
  private readonly logger = new Logger(ContentStrategyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly router: MultiAiRouterService,
  ) {}

  /** Generate a content strategy from patterns, gaps, and project context. */
  async generateStrategy(projectId: string, organizationId: string) {
    const [patterns, gaps, config, project, topOwnedPosts, topCompetitorPosts] = await Promise.all([
      this.prisma.creativePattern.findMany({ where: { organizationId, projectId }, orderBy: { marketSaturation: 'desc' }, take: 20 }),
      this.prisma.contentGap.findMany({ where: { organizationId, projectId, status: 'OPEN' }, orderBy: { opportunityScore: 'desc' }, take: 15 }),
      this.prisma.contentIntelligenceConfig.findUnique({ where: { projectId } }),
      this.prisma.project.findUnique({ where: { id: projectId }, select: { name: true } }),
      // Fetch top 10 owned posts across all platforms
      this.prisma.socialPost.findMany({ where: { projectId, isCompetitor: false }, orderBy: { engagementRate: 'desc' }, take: 10 }),
      // Fetch top 10 competitor posts across all platforms
      this.prisma.socialPost.findMany({ where: { projectId, isCompetitor: true }, orderBy: { engagementRate: 'desc' }, take: 10 }),
    ]);

    const skill = config?.industrySkill ?? 'GENERIC';
    const industryContext = this.getSkillContext(skill);

    const prompt = `
Brand: ${project?.name ?? 'Unknown'}
Industry Skill: ${skill}
${industryContext}

COMPETITOR CREATIVE PATTERNS (sorted by saturation):
${patterns.map(p => `- "${p.name}": Saturation ${p.marketSaturation}/100, Opportunity ${p.opportunityScore}/100`).join('\n')}

IDENTIFIED CONTENT GAPS & OPPORTUNITIES:
${gaps.map(g => `- [${g.gapType}] ${g.title}: ${g.description} | Opportunity: ${g.opportunityScore}/100`).join('\n')}

TOP PERFORMING OWNED SOCIAL POSTS:
${topOwnedPosts.map(p => `- [${p.platform}] ${p.authorHandle}: "${p.content}" | Engagement: ${p.engagementRate?.toFixed(2)}% | Likes: ${p.likes}`).join('\n')}

TOP PERFORMING COMPETITOR SOCIAL POSTS:
${topCompetitorPosts.map(p => `- [${p.platform}] ${p.authorHandle}: "${p.content}" | Engagement: ${p.engagementRate?.toFixed(2)}% | Likes: ${p.likes}`).join('\n')}

Generate a differentiated content strategy that exploits the highest-opportunity gaps, leverages the formats proven by the top performing competitor posts, and leans into the strengths shown in the brand's own top posts.
The strategy must be specific to this brand's industry and goals.
`.trim();

    const result = await this.router.generate({
      prompt,
      systemInstruction: SYSTEM,
      task: AiTask.REASONING,
      organizationId,
      jsonSchema: STRATEGY_SCHEMA as unknown as Record<string, unknown>,
      maxTokens: 6000,
    });

    if (!result.text?.trim()) throw new BadRequestException('Strategy generation failed. Please retry.');

    const parsed = this.parseJson(result.text);

    // Validate pillars sum to ~100
    const sum = (parsed.contentPillars ?? []).reduce((a: number, p: any) => a + (p.percentage ?? 0), 0);
    if (Math.abs(sum - 100) > 5) {
      this.logger.warn(`Pillar percentages sum to ${sum} for project ${projectId}`);
    }

    const strategy = await this.prisma.contentStrategy.create({
      data: {
        organizationId,
        projectId,
        title: `Content Strategy — ${new Date().toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}`,
        content: parsed,
        contentPillars: parsed.contentPillars ?? [],
        platformFrequency: parsed.platformFrequency ?? {},
        campaignIdeas: parsed.campaignIdeas ?? [],
        creatorStrategy: parsed.creatorStrategy,
        generatedByModel: result.model,
        industrySkill: skill,
        status: 'DRAFT',
      },
    });

    this.logger.log(`Generated content strategy ${strategy.id} for project ${projectId}`);
    return strategy;
  }

  async listStrategies(organizationId: string, projectId: string) {
    return this.prisma.contentStrategy.findMany({
      where: { organizationId, projectId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, title: true, status: true, industrySkill: true,
        generatedByModel: true, createdAt: true, updatedAt: true,
        contentPillars: true, platformFrequency: true, campaignIdeas: true,
      },
    });
  }

  async getStrategy(organizationId: string, strategyId: string) {
    return this.prisma.contentStrategy.findFirst({
      where: { id: strategyId, organizationId },
    });
  }

  async approveStrategy(organizationId: string, strategyId: string) {
    return this.prisma.contentStrategy.updateMany({
      where: { id: strategyId, organizationId },
      data: { status: 'APPROVED' },
    });
  }

  private getSkillContext(skill: string): string {
    const contexts: Record<string, string> = {
      JEWELLERY: 'Industry context: Luxury positioning, product storytelling, craftsmanship, wedding content, lifestyle shoots, model campaigns, celebrity collaborations.',
      REAL_ESTATE: 'Industry context: Property showcasing, project videos, location content, buyer education, property walkthroughs, lead-gen CTAs.',
      RESTAURANT: 'Industry context: Food photography, menu content, offers, customer experiences, reservations, local discovery, chef stories.',
      FASHION: 'Industry context: Model campaigns, styling, collections, trends, seasonal content, creator collaborations, lookbooks.',
      ECOMMERCE: 'Industry context: Product features, reviews, comparison, offers, unboxing, customer testimonials.',
      SAAS: 'Industry context: Product demos, tutorials, case studies, ROI content, integration showcases, customer stories.',
      GENERIC: '',
    };
    return contexts[skill] ?? '';
  }

  private parseJson(text: string): Record<string, any> {
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    const candidate = fenced ? fenced[1] : text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
    try { return JSON.parse(candidate); } catch { return {}; }
  }
}
