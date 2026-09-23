import { BadRequestException, HttpException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AiTask, MultiAiRouterService } from '../ai-search/multi-ai-router/multi-ai-router.service';
import { buildFormatEvidence, describeFormats, FormatPost } from './format-evidence';

const STRATEGY_SCHEMA = {
  type: 'object',
  required: ['executiveSummary', 'contentPillars', 'platformFrequency', 'campaignIdeas', 'hooks', 'formatPlaybooks'],
  properties: {
    executiveSummary: { type: 'string' },
    contentPillars: {
      type: 'array',
      items: {
        type: 'object',
        required: ['pillar', 'percentage', 'rationale'],
        properties: {
          pillar: { type: 'string' },
          percentage: { type: 'number' },
          rationale: { type: 'string' },
          topics: { type: 'array', items: { type: 'string' } },
        },
      },
    },
    platformFrequency: {
      type: 'array',
      items: {
        type: 'object',
        required: ['platform', 'postsPerWeek'],
        properties: {
          platform: { type: 'string' },
          postsPerWeek: { type: 'number' },
        },
      },
    },
    campaignIdeas: {
      type: 'array',
      items: {
        type: 'object',
        required: ['title', 'concept', 'goal'],
        properties: {
          title: { type: 'string' },
          concept: { type: 'string' },
          goal: { type: 'string' },
          suggestedPillars: { type: 'array', items: { type: 'string' } },
          targetPlatforms: { type: 'array', items: { type: 'string' } },
          estimatedReach: { type: 'string' },
        },
      },
    },
    hooks: {
      type: 'array',
      items: {
        type: 'object',
        required: ['hookText', 'hookType', 'suggestedPillar'],
        properties: {
          hookText: { type: 'string' },
          hookType: { type: 'string' },
          suggestedPillar: { type: 'string' },
          whyItWorks: { type: 'string' },
        },
      },
    },
    creatorStrategy: {
      type: 'object',
      properties: {
        targetNiches: { type: 'array', items: { type: 'string' } },
        suggestedTiers: { type: 'array', items: { type: 'string' } },
        collabFormats: { type: 'array', items: { type: 'string' } },
        guidelines: { type: 'string' },
      },
    },
    avoidList: { type: 'array', items: { type: 'string' } },
    testList: { type: 'array', items: { type: 'string' } },
    scaleList: { type: 'array', items: { type: 'string' } },
    platformStrategy: {
      type: 'object',
      properties: {
        instagram: { type: 'string' },
        youtube: { type: 'string' },
        linkedin: { type: 'string' },
      },
    },
    // One plan per format the brand should actually publish. The free-text
    // platformStrategy above says what to do on Instagram; this says what a
    // reel is, how often, opening how, about what — which is the difference
    // between a strategy someone can read and one someone can execute.
    formatPlaybooks: {
      type: 'array',
      items: {
        type: 'object',
        required: ['format', 'postsPerWeek', 'why'],
        properties: {
          /// INSTAGRAM_REEL | INSTAGRAM_POST | INSTAGRAM_CAROUSEL | YOUTUBE_LONG |
          /// YOUTUBE_SHORT | BLOG_ARTICLE
          format: { type: 'string' },
          postsPerWeek: { type: 'number' },
          /// What in the collected evidence supports publishing this at all.
          why: { type: 'string' },
          /// How a piece in this format is built, start to finish.
          structure: { type: 'array', items: { type: 'string' } },
          /// Opening lines that suit this format, in this brand's voice.
          hookPatterns: { type: 'array', items: { type: 'string' } },
          /// Specific subjects to cover, drawn from the gaps and pillars.
          topicIdeas: { type: 'array', items: { type: 'string' } },
          /// What a good result looks like, only where the data supports saying.
          successSignal: { type: 'string' },
        },
      },
    },
    roadmap30Day: { type: 'array', items: { type: 'string' } },
    roadmap60Day: { type: 'array', items: { type: 'string' } },
    roadmap90Day: { type: 'array', items: { type: 'string' } },
  },
};

const SYSTEM = `You are a world-class B2B and Digital Content Strategist.
Generate a comprehensive, differentiated content & SEO strategy for the brand.
Exploit competitor gaps and weaknesses while amplifying the brand's unique capabilities.
Respond only with valid JSON matching the schema.`;

@Injectable()
export class ContentStrategyService {
  private readonly logger = new Logger(ContentStrategyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly router: MultiAiRouterService,
  ) {}

  /** Generate a content strategy from patterns, gaps, competitor crawls, and project context. */
  async generateStrategy(projectId: string, organizationId: string) {
    let orgId = organizationId;
    if (!orgId) {
      const proj = await this.prisma.project.findUnique({
        where: { id: projectId },
        select: { organizationId: true },
      });
      orgId = proj?.organizationId || '';
    }

    const [patterns, gaps, config, project, topOwnedPosts, topCompetitorPosts, crawledPages, competitorDomains, competitorContents] = await Promise.all([
      this.prisma.creativePattern.findMany({ where: { projectId, ...(orgId ? { organizationId: orgId } : {}) }, orderBy: { marketSaturation: 'desc' }, take: 20 }),
      this.prisma.contentGap.findMany({ where: { projectId, ...(orgId ? { organizationId: orgId } : {}), status: 'OPEN' }, orderBy: { opportunityScore: 'desc' }, take: 15 }),
      this.prisma.contentIntelligenceConfig.findUnique({ where: { projectId } }),
      this.prisma.project.findUnique({
        where: { id: projectId },
        include: { websites: { select: { domain: true }, take: 3 } },
      }),
      this.prisma.socialPost.findMany({
        where: { projectId, isCompetitor: false, engagementRate: { not: null } },
        orderBy: { engagementRate: 'desc' },
        take: 10,
      }),
      // Read from CompetitorContent, which is where the nightly sweep actually
      // puts competitor posts. This asked `socialPost` for them, and the only
      // writer of that half of the table had no callers — so "top performing
      // competitor posts" was blank in every strategy this service has ever
      // produced, while the same posts sat one table over.
      this.prisma.competitorContent.findMany({
        where: { projectId, ...(orgId ? { organizationId: orgId } : {}), engagementAvailable: true },
        select: {
          platform: true,
          title: true,
          caption: true,
          contentType: true,
          publishedAt: true,
          viewsCount: true,
          likesCount: true,
          commentsCount: true,
          account: { select: { handle: true, displayName: true } },
        },
        orderBy: { likesCount: 'desc' },
        take: 10,
      }),
      this.prisma.page.findMany({
        where: { crawlJob: { website: { projectId } }, statusCode: 200, title: { not: null } },
        select: { url: true, title: true, metaDescription: true, h1: true },
        orderBy: { crawledAt: 'desc' },
        take: 60,
      }),
      (this.prisma as any).competitorDomain?.findMany
        ? (this.prisma as any).competitorDomain.findMany({ where: { projectId }, select: { id: true, domain: true, label: true } })
        : Promise.resolve([]),
      (this.prisma as any).competitorContent?.findMany
        ? (this.prisma as any).competitorContent.findMany({
            where: { projectId },
            include: { classification: true, account: true },
            orderBy: { publishedAt: 'desc' },
            take: 20,
          })
        : Promise.resolve([]),
    ]);

    if (!project) throw new BadRequestException('That project no longer exists.');

    const skill = config?.industrySkill ?? 'GENERIC';
    const industryContext = this.getSkillContext(skill);
    const domains: string[] = project.websites?.map((w: any) => w.domain) || [];

    const seenTitles = new Set<string>();
    const distinctPages = crawledPages
      .filter((page) => {
        const key = (page.title ?? '').trim().toLowerCase();
        if (!key || seenTitles.has(key)) return false;
        seenTitles.add(key);
        return true;
      })
      .slice(0, 15);

    // What each format is actually doing in this market, on both sides. The
    // per-format plan below is written from this rather than from what tends to
    // work in general, which is the difference between a playbook for this
    // brand and one that would suit any brand.
    const formatEvidence = buildFormatEvidence(
      topCompetitorPosts.map(
        (c): FormatPost => ({
          platform: c.platform,
          // Nullable in the model, because a manually added post need not say
          // what kind it is. Grouped as UNSPECIFIED rather than guessed at.
          contentType: c.contentType ?? 'UNSPECIFIED',
          views: c.viewsCount,
          likes: c.likesCount,
          comments: c.commentsCount,
          publishedAt: c.publishedAt,
          headline: c.title ?? c.caption,
        }),
      ),
      topOwnedPosts.map(
        (p): FormatPost => ({
          platform: p.platform,
          // SocialPost records no format, so its posts are grouped as POST.
          // Naming that plainly beats inferring a format from a URL shape.
          contentType: 'POST',
          views: p.views,
          likes: p.likes,
          comments: p.comments,
          publishedAt: p.publishedAt,
          headline: p.content,
        }),
      ),
    );

    const dataBasis = {
      patterns: patterns.length,
      gaps: gaps.length,
      ownedPosts: topOwnedPosts.length,
      competitorPosts: topCompetitorPosts.length,
      crawledPages: distinctPages.length,
    };

    const hasEvidence =
      patterns.length > 0 || gaps.length > 0 || topOwnedPosts.length > 0 || topCompetitorPosts.length > 0;

    const post = (p: (typeof topOwnedPosts)[number]) =>
      `- [${p.platform}] ${p.authorHandle}: "${p.content ?? ''}" | Engagement: ${p.engagementRate?.toFixed(2) ?? 'n/a'}% | Likes: ${p.likes}`;

    // Views and likes are nullable throughout, because several platforms
    // report neither. "n/a" is written where a figure is missing rather than a
    // zero, so the model is never told a post nobody could measure flopped.
    const rivalPost = (c: (typeof topCompetitorPosts)[number]) =>
      `- [${c.platform} ${c.contentType}] ${c.account?.displayName || c.account?.handle || 'unknown'}: ` +
      `"${(c.title ?? c.caption ?? '').slice(0, 140)}" | Views: ${c.viewsCount ?? 'n/a'} | ` +
      `Likes: ${c.likesCount ?? 'n/a'} | Comments: ${c.commentsCount ?? 'n/a'}`;

    let parsed: any;
    let usedModel = 'ai-router';

    try {
      const prompt = [
        `Brand: ${project.name}`,
        domains.length ? `Website: ${domains.join(', ')}` : null,
        `Industry Skill: ${skill}`,
        industryContext || null,
        '',
        distinctPages.length
          ? this.section(
              "WHAT THE BRAND SAYS IT DOES (from its own crawled pages)",
              distinctPages.map((page) => {
                const heading = page.h1?.[0]?.trim();
                return [
                  `- ${page.title?.trim()}`,
                  page.metaDescription?.trim() ? ` | ${page.metaDescription.trim()}` : '',
                  heading && heading !== page.title?.trim() ? ` | H1: ${heading}` : '',
                ].join('');
              }),
            )
          : null,
        this.section(
          'COMPETITOR CREATIVE PATTERNS (sorted by saturation)',
          patterns.map((p) => `- "${p.name}": Saturation ${p.marketSaturation}/100, Opportunity ${p.opportunityScore}/100`),
        ),
        this.section(
          'IDENTIFIED CONTENT GAPS & OPPORTUNITIES',
          gaps.map((g) => `- [${g.gapType}] ${g.title}: ${g.description} | Opportunity: ${g.opportunityScore}/100`),
        ),
        this.section('TOP PERFORMING OWNED SOCIAL POSTS', topOwnedPosts.map(post)),
        this.section('TOP PERFORMING COMPETITOR SOCIAL POSTS', topCompetitorPosts.map(rivalPost)),
        formatEvidence.competitors.length
          ? this.section(
              'HOW EACH FORMAT PERFORMS FOR COMPETITORS (medians, so one viral post does not set the target)',
              describeFormats(formatEvidence.competitors),
            )
          : null,
        formatEvidence.own.length
          ? this.section('HOW YOUR OWN POSTS PERFORM, BY FORMAT', describeFormats(formatEvidence.own))
          : null,
        formatEvidence.formatsTheyUseYouDoNot.length
          ? this.section(
              'FORMATS COMPETITORS PUBLISH AND YOU DO NOT',
              formatEvidence.formatsTheyUseYouDoNot.map((format) => `- ${format}`),
            )
          : null,
        ...(competitorDomains.length
          ? [this.section('TRACKED COMPETITORS', competitorDomains.map((c: any) => `- ${c.label || c.domain} (${c.domain})`))]
          : []),
        ...(competitorContents.length
          ? [this.section('COMPETITOR VIDEO INTELLIGENCE & HOOK FORMULAS', competitorContents.map((c: any) => `- [${c.platform}] ${c.account?.displayName || c.account?.handle}: "${c.title}" | Hook: ${c.classification?.hookType || 'QUESTION'} | Why it works: ${c.whyItWorks || 'Direct product proof'}`))]
          : []),
        '',
        hasEvidence
          ? 'Generate a differentiated content strategy that exploits the highest-opportunity gaps, leverages the formats proven by the top performing competitor posts, and leans into the strengths shown in the brand\'s own top posts.'
          : 'No competitor patterns, gaps, or social posts have been collected for this brand yet. ' +
            'Build a foundational strategy from the brand and industry context above: pillars, cadence, ' +
            'campaign concepts, and hooks that suit this kind of business. State no statistics, market ' +
            'shares, or competitor claims of any kind — you have no data to ground them in. Frame the ' +
            'campaign ideas as starting positions to validate once competitive data is collected.',
        distinctPages.length
          ? 'Read the crawled pages above as the authority on what this business actually sells and to whom. ' +
            'Do not infer the sector from the brand name; the pages say what it is.'
          : null,
        'The strategy must be specific to this brand\'s industry and goals.',
        'Write formatPlaybooks as one entry per format this brand should publish — reels, feed posts, ' +
          'carousels, long video, shorts, articles — covering only the formats that suit this business. ' +
          'Each entry says how often, how a piece is built, how it opens, and what to make it about.',
        formatEvidence.competitors.length
          ? 'Ground each playbook in the format figures above: recommend a cadence in the region of what ' +
            'competitors sustain, and say in `why` which figure supports it. Where a median is absent the ' +
            'platform did not report it — do not supply a number in its place.'
          : 'No format figures have been collected, so leave `successSignal` empty and write `why` from the ' +
            "business context rather than citing performance you have not seen.",
        ...(formatEvidence.notes.length ? [formatEvidence.notes.map((note) => `NOTE: ${note}`).join('\n')] : []),
      ]
        .filter((line) => line !== null)
        .join('\n')
        .trim();

      const result = await this.router.generate({
        prompt,
        systemInstruction: SYSTEM,
        task: AiTask.REASONING,
        organizationId: orgId,
        jsonSchema: STRATEGY_SCHEMA as unknown as Record<string, unknown>,
        maxTokens: 6000,
      });

      if (result.text?.trim()) {
        parsed = this.parseJson(result.text);
        usedModel = result.model || 'ai-router';
      }
    } catch (err: any) {
      this.logger.warn(`AI strategy generation failed for project ${projectId}: ${err.message}`);
      // A plan limit or budget ceiling already says what went wrong.
      if (err instanceof HttpException) throw err;
      throw new ServiceUnavailableException(
        'The content strategy could not be generated because no AI provider answered. Check the AI configuration in Settings and try again.',
      );
    }

    // No stock strategy is substituted when the model returns nothing usable:
    // a canned plan saved under this brand's name reads exactly like one
    // written for it, and this one used to hand every food business the same
    // fruit-pulp export playbook.
    if (!parsed || !Array.isArray(parsed.contentPillars) || parsed.contentPillars.length === 0) {
      throw new ServiceUnavailableException(
        'The AI provider returned an incomplete strategy. Nothing was saved — try generating it again.',
      );
    }

    const contentPillars = this.normalizePillars(parsed.contentPillars, projectId);

    const strategy = await this.prisma.contentStrategy.create({
      data: {
        organizationId: orgId,
        projectId,
        title: `${hasEvidence ? 'Content Strategy' : 'Foundational Content Strategy'} — ${new Date().toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}`,
        content: { ...parsed, contentPillars, dataBasis, formatEvidence },
        contentPillars,
        platformFrequency: this.toFrequencyMap(parsed.platformFrequency),
        campaignIdeas: parsed.campaignIdeas ?? [],
        creatorStrategy: parsed.creatorStrategy,
        generatedByModel: usedModel,
        industrySkill: skill,
        status: 'DRAFT',
      },
    });

    this.logger.log(`Generated content strategy ${strategy.id} for project ${projectId}`);
    return strategy;
  }

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
      const claimed = cleaned.reduce((a, p) => a + (p.percentage ?? 0), 0);
      const share = Math.max(0, Math.round((100 - claimed) / missing.length));
      missing.forEach((p) => {
        p.percentage = share;
      });
    }

    return cleaned as any;
  }

  private toFrequencyMap(raw: unknown): Record<string, number> {
    if (!raw) return {};
    const map: Record<string, number> = {};
    if (Array.isArray(raw)) {
      for (const item of raw) {
        if (item?.platform && item?.postsPerWeek != null) {
          map[String(item.platform).toUpperCase()] = Number(item.postsPerWeek);
        }
      }
      return map;
    }
    if (typeof raw === 'object') {
      for (const [k, v] of Object.entries(raw as Record<string, any>)) {
        if (v != null) {
          const num = Number(typeof v === 'object' && v?.postsPerWeek != null ? v.postsPerWeek : v);
          map[k.toUpperCase()] = isNaN(num) ? v : num;
        }
      }
    }
    return map;
  }

  async listStrategies(organizationId: string, projectId: string) {
    return this.prisma.contentStrategy.findMany({
      where: {
        projectId,
        ...(organizationId ? { organizationId } : {}),
      },
      orderBy: { createdAt: 'desc' },
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
      where: {
        id: strategyId,
        ...(organizationId ? { organizationId } : {}),
      },
    });
  }

  async approveStrategy(organizationId: string, strategyId: string) {
    return this.prisma.contentStrategy.updateMany({
      where: {
        id: strategyId,
        ...(organizationId ? { organizationId } : {}),
      },
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
    try {
      const clean = text.replace(/```json/gi, '').replace(/```/g, '').trim();
      return JSON.parse(clean);
    } catch {
      return {};
    }
  }

  private section(title: string, lines: string[]): string {
    const valid = lines.filter((l) => l && l.trim().length > 0);
    return `${title}:\n${valid.length ? valid.join('\n') : 'None recorded yet.'}\n`;
  }
}
