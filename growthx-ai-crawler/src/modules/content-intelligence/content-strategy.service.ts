import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AiTask, MultiAiRouterService } from '../ai-search/multi-ai-router/multi-ai-router.service';
import { parseModelJson } from '../ai-engine/utils/json-extractor.util';

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
    // Declared as an array of pairs rather than a free-form object. A schema
    // object with no `properties` is unconstrained, and the strict structured
    // output modes (Gemini's responseSchema, Anthropic's json_schema format)
    // reject it outright — which failed this call on every provider in the
    // chain and left the page with nothing to show. It is folded back into a
    // `{platform: postsPerWeek}` map before it is stored.
    platformFrequency: {
      type: 'array',
      description: 'Posting cadence per platform.',
      items: {
        type: 'object',
        properties: {
          platform: { type: 'string', description: 'e.g. INSTAGRAM, YOUTUBE, FACEBOOK, LINKEDIN' },
          postsPerWeek: { type: 'number', minimum: 0, maximum: 100 },
        },
        required: ['platform', 'postsPerWeek'],
      },
    },
    platformStrategy: {
      type: 'object',
      properties: {
        instagramReels: { type: 'string', description: 'Strategy for short-form Reels' },
        youtubeLongForm: { type: 'string', description: 'Strategy for long-form authority videos' },
        youtubeShorts: { type: 'string', description: 'Strategy for 60s Shorts' },
        seoArticles: { type: 'string', description: 'Strategy for SEO written pillar guides' },
        carousels: { type: 'string', description: 'Strategy for Instagram educational carousels' },
      },
      required: ['instagramReels', 'youtubeLongForm', 'youtubeShorts', 'seoArticles'],
    },
    roadmap30Day: {
      type: 'object',
      properties: {
        week1_Foundation: { type: 'array', items: { type: 'string' } },
        week2_ProofAndProjects: { type: 'array', items: { type: 'string' } },
        week3_PricingAndComparison: { type: 'array', items: { type: 'string' } },
        week4_Conversion: { type: 'array', items: { type: 'string' } },
      },
      required: ['week1_Foundation', 'week2_ProofAndProjects', 'week3_PricingAndComparison', 'week4_Conversion'],
    },
    roadmap60Day: { type: 'string', description: 'Month 2 Authority & Keyword Cluster Expansion Plan' },
    roadmap90Day: { type: 'string', description: 'Month 3 Conversion Scale & Retargeting Plan' },
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
  required: ['executiveSummary', 'contentPillars', 'platformStrategy', 'roadmap30Day', 'campaignIdeas'],
  additionalProperties: false,
} as const;

const SYSTEM = `You are GrowthX AI Content Strategist.
Your role is to create a differentiated content strategy that sets the brand apart from its competitors.
Do NOT recommend copying competitors. Recommend strategies that exploit gaps and opportunities.
Content pillar percentages must sum to exactly 100%.
Adapt the strategy by platform (Reels, YouTube long-form, YouTube Shorts, SEO articles, Carousels).
Generate a week-by-week 30-day plan, 60-day expansion, and 90-day growth roadmap.
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
    const [patterns, gaps, config, project, topOwnedPosts, topCompetitorPosts, crawledPages] = await Promise.all([
      this.prisma.creativePattern.findMany({ where: { organizationId, projectId }, orderBy: { marketSaturation: 'desc' }, take: 20 }),
      this.prisma.contentGap.findMany({ where: { organizationId, projectId, status: 'OPEN' }, orderBy: { opportunityScore: 'desc' }, take: 15 }),
      this.prisma.contentIntelligenceConfig.findUnique({ where: { projectId } }),
      this.prisma.project.findUnique({
        where: { id: projectId },
        select: { name: true, websites: { select: { domain: true }, take: 3 } },
      }),
      // Fetch top 10 owned posts across all platforms
      this.prisma.socialPost.findMany({ where: { projectId, isCompetitor: false }, orderBy: { engagementRate: 'desc' }, take: 10 }),
      // Fetch top 10 competitor posts across all platforms
      this.prisma.socialPost.findMany({ where: { projectId, isCompetitor: true }, orderBy: { engagementRate: 'desc' }, take: 10 }),
      // What the brand actually says it does, taken from its own crawled pages.
      // Without this the model has a name and a domain to work from and infers
      // the rest: a probe against a fresh-milk brand produced a strategy for a
      // food delivery app, which is confidently wrong rather than merely thin.
      this.prisma.page.findMany({
        where: { crawlJob: { website: { projectId } }, statusCode: 200, title: { not: null } },
        select: { url: true, title: true, metaDescription: true, h1: true },
        orderBy: { crawledAt: 'desc' },
        take: 60,
      }),
    ]);

    if (!project) throw new BadRequestException('That project no longer exists.');

    const skill = config?.industrySkill ?? 'GENERIC';
    const industryContext = this.getSkillContext(skill);
    const domains = project.websites.map((w) => w.domain);

    // What the strategy is actually built on. Recorded alongside the document
    // so the UI can say which inputs were available rather than presenting a
    // cold-start strategy as if it were competitive analysis.
    // Many pages on a site repeat one title — a shared homepage tag, a
    // paginated listing — so the raw list is mostly duplicates and would crowd
    // the genuinely distinct pages out of the prompt.
    const seenTitles = new Set<string>();
    const distinctPages = crawledPages
      .filter((page) => {
        const key = (page.title ?? '').trim().toLowerCase();
        if (!key || seenTitles.has(key)) return false;
        seenTitles.add(key);
        return true;
      })
      .slice(0, 15);

    const dataBasis = {
      patterns: patterns.length,
      gaps: gaps.length,
      ownedPosts: topOwnedPosts.length,
      competitorPosts: topCompetitorPosts.length,
      crawledPages: distinctPages.length,
    };
    // Crawled pages say what the brand is; they say nothing about its market.
    // Only competitive inputs decide whether a differentiation strategy can be
    // asked for, so a freshly crawled site with no competitor data still gets
    // the foundational treatment — grounded in its real business rather than in
    // a guess at it.
    const hasEvidence =
      patterns.length > 0 || gaps.length > 0 || topOwnedPosts.length > 0 || topCompetitorPosts.length > 0;

    const post = (p: (typeof topOwnedPosts)[number]) =>
      `- [${p.platform}] ${p.authorHandle}: "${p.content ?? ''}" | Engagement: ${p.engagementRate?.toFixed(2) ?? 'n/a'}% | Likes: ${p.likes}`;

    const prompt = [
      `Brand: ${project.name}`,
      domains.length ? `Website: ${domains.join(', ')}` : null,
      `Industry Skill: ${skill}`,
      industryContext || null,
      '',
      this.section(
        "WHAT THE BRAND SAYS IT DOES (from its own crawled pages)",
        distinctPages.map((page) => {
          const heading = page.h1?.[0]?.trim();
          return [
            `- ${page.title?.trim()}`,
            page.metaDescription?.trim() ? ` | ${page.metaDescription.trim()}` : '',
            heading && heading !== page.title?.trim() ? ` | H1: ${heading}` : '',
          ].join('');
        }),
      ),
      this.section(
        'COMPETITOR CREATIVE PATTERNS (sorted by saturation)',
        patterns.map((p) => `- "${p.name}": Saturation ${p.marketSaturation}/100, Opportunity ${p.opportunityScore}/100`),
      ),
      this.section(
        'IDENTIFIED CONTENT GAPS & OPPORTUNITIES',
        gaps.map((g) => `- [${g.gapType}] ${g.title}: ${g.description} | Opportunity: ${g.opportunityScore}/100`),
      ),
      this.section('TOP PERFORMING OWNED SOCIAL POSTS', topOwnedPosts.map(post)),
      this.section('TOP PERFORMING COMPETITOR SOCIAL POSTS', topCompetitorPosts.map(post)),
      '',
      hasEvidence
        ? 'Generate a differentiated content strategy that exploits the highest-opportunity gaps, leverages the formats proven by the top performing competitor posts, and leans into the strengths shown in the brand\'s own top posts.'
        : // Every section above is empty on a new project. Left unsaid, the model
          // either refuses (the system prompt forbids inventing data) or answers
          // in prose, and the JSON parse then fails — so the page stayed blank
          // instead of showing a first strategy. Ask for the cold-start version
          // explicitly, with the no-invented-numbers rule still in force.
          'No competitor patterns, gaps, or social posts have been collected for this brand yet. ' +
          'Build a foundational strategy from the brand and industry context above: pillars, cadence, ' +
          'campaign concepts, and hooks that suit this kind of business. State no statistics, market ' +
          'shares, or competitor claims of any kind — you have no data to ground them in. Frame the ' +
          'campaign ideas as starting positions to validate once competitive data is collected.',
      distinctPages.length
        ? 'Read the crawled pages above as the authority on what this business actually sells and to whom. ' +
          'Do not infer the sector from the brand name; the pages say what it is.'
        : null,
      'The strategy must be specific to this brand\'s industry and goals.',
    ]
      .filter((line) => line !== null)
      .join('\n')
      .trim();

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
    const contentPillars = this.normalizePillars(parsed.contentPillars, projectId);

    const sum = contentPillars.reduce((a, p) => a + p.percentage, 0);
    if (Math.abs(sum - 100) > 5) {
      this.logger.warn(`Pillar percentages sum to ${sum} for project ${projectId}`);
    }

    const strategy = await this.prisma.contentStrategy.create({
      data: {
        organizationId,
        projectId,
        title: `${hasEvidence ? 'Content Strategy' : 'Foundational Content Strategy'} — ${new Date().toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}`,
        content: { ...parsed, contentPillars, dataBasis },
        contentPillars,
        platformFrequency: this.toFrequencyMap(parsed.platformFrequency),
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

  /**
   * Forces the pillars into the shape the column and the UI rely on.
   *
   * Only Anthropic, Gemini and OpenAI have the schema enforced for them. The
   * providers actually configured here — Sarvam, Groq, OpenRouter — are asked
   * for it in prose, so a field can come back in the wrong shape while the
   * document still parses. Observed in production: a pillar arrived with its
   * rationale written into `percentage` and `rationale` left null, which reached
   * the chart as a paragraph where a number belonged and rendered as
   * "<entire paragraph>%".
   *
   * A percentage that is not a usable number is therefore not trusted. Text
   * found there is recovered as the rationale when the rationale is missing —
   * it is the sentence the model meant to write — and the unaccounted share is
   * split across the pillars left without a figure, so the set still sums to
   * roughly 100 and the donut stays readable.
   */
  private normalizePillars(
    raw: unknown,
    projectId: string,
  ): { pillar: string; percentage: number; rationale: string; topics?: string[] }[] {
    const rows = Array.isArray(raw) ? raw : [];

    const cleaned = rows
      .map((p: any) => {
        const value = Number(p?.percentage);
        const usable = Number.isFinite(value) && value >= 0 && value <= 100;
        const strayText =
          !usable && typeof p?.percentage === 'string' ? p.percentage.trim() : '';

        return {
          pillar: String(p?.pillar ?? '').trim(),
          percentage: usable ? Math.round(value) : null,
          rationale: String(p?.rationale ?? '').trim() || strayText,
          topics: Array.isArray(p?.topics) ? p.topics.map(String) : undefined,
        };
      })
      .filter((p) => p.pillar);

    const missing = cleaned.filter((p) => p.percentage === null);
    if (missing.length) {
      this.logger.warn(
        `${missing.length} of ${cleaned.length} content pillars came back without a usable ` +
          `percentage for project ${projectId} (${missing.map((p) => p.pillar).join(', ')}); ` +
          'sharing the remainder between them.',
      );
      const claimed = cleaned.reduce((a, p) => a + (p.percentage ?? 0), 0);
      const share = Math.max(0, Math.round((100 - claimed) / missing.length));
      missing.forEach((p) => {
        p.percentage = share;
      });
    }

    return cleaned as { pillar: string; percentage: number; rationale: string; topics?: string[] }[];
  }

  /** A prompt section, with the empty case said out loud rather than left blank. */
  private section(title: string, lines: string[]): string {
    return `${title}:\n${lines.length ? lines.join('\n') : 'None recorded yet.'}\n`;
  }

  /**
   * Folds the model's `[{platform, postsPerWeek}]` back into the
   * `{platform: postsPerWeek}` map the column and the UI already expect.
   * Tolerates a map coming straight back, in case a provider ignores the shape.
   */
  private toFrequencyMap(value: unknown): Record<string, number> {
    if (!value) return {};

    const entries = Array.isArray(value)
      ? value.map((row: any) => [row?.platform, row?.postsPerWeek])
      : Object.entries(value as Record<string, unknown>);

    const map: Record<string, number> = {};
    for (const [platform, perWeek] of entries) {
      if (typeof platform !== 'string' || !platform.trim()) continue;
      const count = Number(perWeek);
      if (Number.isFinite(count)) map[platform.trim().toUpperCase()] = count;
    }
    return map;
  }

  async listStrategies(organizationId: string, projectId: string) {
    return this.prisma.contentStrategy.findMany({
      where: { organizationId, projectId },
      orderBy: { createdAt: 'desc' },
      // `content` carries the executive summary, hooks and the avoid/test/scale
      // lists. Leaving it out of this projection meant the strategy detail view
      // — which renders straight from the list response — had nothing but the
      // pillars to show, so most of a generated strategy was invisible.
      select: {
        id: true, title: true, status: true, industrySkill: true,
        generatedByModel: true, createdAt: true, updatedAt: true,
        contentPillars: true, platformFrequency: true, campaignIdeas: true,
        content: true, creatorStrategy: true,
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

  /** Reads the model's JSON answer, repairing truncation or naming the failure. */
  private parseJson(text: string): Record<string, any> {
    return parseModelJson(text, 'Content strategy');
  }
}
