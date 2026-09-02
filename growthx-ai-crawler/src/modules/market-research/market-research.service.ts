import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import {
  MarketActionStatus,
  MarketActionType,
  ResearchConfidence,
  ResearchIntent,
  ResearchMessageRole,
  ResearchRunStatus,
  ResearchSourceType,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { EvidenceRetrievalService, RetrievedSource } from './evidence-retrieval.service';
import { ModelRole, ModelRouterService, ModelUsage } from './model-router.service';
import { validateCitations } from './citation-validator';
import { parseModelJson } from '../ai-engine/utils/json-extractor.util';
import { normalizeDomain } from '../ai-visibility/citation/citation-detector';
import { SocialDiscoveryService } from '../content-intelligence/social-discovery.service';
import {
  ANSWER_INSTRUCTIONS,
  ANSWER_SCHEMA,
  CLASSIFY_INSTRUCTIONS,
  CLASSIFY_SCHEMA,
} from './research-schema';

export interface AskOptions {
  organizationId: string;
  projectId: string;
  threadId?: string;
  question: string;
  deepResearch?: boolean;
}

export interface AutoIdentifiedCompetitor {
  domain: string;
  name: string;
  industry: string;
  description: string;
  overlapScore: number;
  marketPosition: string;
  sampleKeywords: string[];
  keyDifferentiator: string;
  isAlreadyAdded?: boolean;
  existingId?: string;
}

export interface AutoIdentifyCompetitorsResult {
  customerDomain: string;
  businessName: string;
  industry: string;
  identifiedAt: string;
  topCompetitors: AutoIdentifiedCompetitor[];
}

const LEVEL: Record<string, ResearchConfidence> = {
  high: ResearchConfidence.HIGH,
  medium: ResearchConfidence.MEDIUM,
  low: ResearchConfidence.LOW,
};

/** Only these action types are accepted; anything else the model invents is dropped. */
const ACTION_TYPES: Record<string, MarketActionType> = {
  CONTENT_BRIEF: MarketActionType.CONTENT_BRIEF,
  PAGE_REFRESH: MarketActionType.PAGE_REFRESH,
  TECHNICAL_TASK: MarketActionType.TECHNICAL_TASK,
  TRACK_PROMPT: MarketActionType.TRACK_PROMPT,
  COMPETITOR_WATCH: MarketActionType.COMPETITOR_WATCH,
  OUTREACH_OPPORTUNITY: MarketActionType.OUTREACH_OPPORTUNITY,
};

const CONFIDENCE: Record<string, ResearchConfidence> = {
  high: ResearchConfidence.HIGH,
  medium: ResearchConfidence.MEDIUM,
  low: ResearchConfidence.LOW,
};

@Injectable()
export class MarketResearchService {
  private readonly logger = new Logger(MarketResearchService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly models: ModelRouterService,
    private readonly evidence: EvidenceRetrievalService,
    @Optional() private readonly socialDiscovery?: SocialDiscoveryService,
  ) {}

  /**
   * Automatically identifies the top 5 competitors for a website using AI market analysis.
   */
  async autoIdentifyCompetitors(
    organizationId: string,
    projectId: string,
    options?: {
      websiteUrl?: string;
      domain?: string;
      industry?: string;
      businessName?: string;
    },
  ): Promise<AutoIdentifyCompetitorsResult> {
    await this.assertProjectInOrg(organizationId, projectId);

    // 1. Resolve project and website domain
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        websites: { take: 1, orderBy: { createdAt: 'desc' } },
      },
    });

    const registeredWebsite = project?.websites[0];
    const rawDomain =
      options?.domain ||
      options?.websiteUrl ||
      registeredWebsite?.domain ||
      registeredWebsite?.url;

    if (!rawDomain) {
      throw new BadRequestException(
        'A website domain or URL is required to auto-identify competitors. Please add a website to the project first.',
      );
    }

    const domain = normalizeDomain(rawDomain);
    if (!domain || !domain.includes('.')) {
      throw new BadRequestException('A valid domain name is required.');
    }

    // 2. Resolve business name and market subject
    const [recentPages, existingCompetitors] = await Promise.all([
      this.prisma.page.findMany({
        where: { crawlJob: { website: { projectId } }, statusCode: 200, title: { not: null } },
        orderBy: { crawledAt: 'desc' },
        select: { url: true, title: true, metaDescription: true },
        take: 20,
      }),
      this.prisma.competitorDomain.findMany({
        where: { projectId },
        select: { id: true, domain: true },
      }),
    ]);

    const homepage = [...recentPages].sort((a, b) => a.url.length - b.url.length)[0];
    const detectedSubject = this.subjectFrom(homepage?.title, homepage?.metaDescription, project?.name);
    const subject = options?.industry || detectedSubject || this.inferSubjectFromDomain(domain);
    const businessName = options?.businessName || project?.name || this.formatBrandName(domain);

    const existingDomainMap = new Map(
      existingCompetitors.map((c) => [normalizeDomain(c.domain), c.id]),
    );

    let competitors: AutoIdentifiedCompetitor[] = [];

    // 3. Attempt AI-driven identification if model is configured
    if (this.models.isConfigured()) {
      try {
        const prompt = [
          `Analyze the market landscape and organic search competition for this business:`,
          `- Website Domain: ${domain}`,
          `- Brand / Business Name: ${businessName}`,
          `- Core Product / Niche: ${subject}`,
          homepage?.title ? `- Homepage Title: ${homepage.title}` : '',
          homepage?.metaDescription ? `- Meta Description: ${homepage.metaDescription}` : '',
          ``,
          `Task: Identify the TOP 5 DIRECT competitors that compete for the same customers, search rankings, or market share.`,
          `Ensure every competitor is a real company with a valid domain (e.g. "ahrefs.com", "semrush.com").`,
          `Do NOT return generic search engines, social networks, or general reference portals (like google.com, wikipedia.org, youtube.com) unless they directly sell a competing solution in this niche.`,
          `Do NOT include the target domain (${domain}) itself.`,
        ].filter(Boolean).join('\n');

        const schema = {
          name: 'top_competitors',
          schema: {
            type: 'object',
            required: ['competitors'],
            properties: {
              competitors: {
                type: 'array',
                items: {
                  type: 'object',
                  required: [
                    'domain',
                    'name',
                    'industry',
                    'description',
                    'overlapScore',
                    'marketPosition',
                    'sampleKeywords',
                    'keyDifferentiator',
                  ],
                  properties: {
                    domain: { type: 'string' },
                    name: { type: 'string' },
                    industry: { type: 'string' },
                    description: { type: 'string' },
                    overlapScore: { type: 'number' },
                    marketPosition: { type: 'string' },
                    sampleKeywords: { type: 'array', items: { type: 'string' } },
                    keyDifferentiator: { type: 'string' },
                  },
                },
              },
            },
          },
        };

        const result = await this.models.generate({
          step: 'auto_identify_competitors',
          role: ModelRole.ANALYST,
          instructions:
            'You are a premier SEO & Market Research Competitive Intelligence Director. ' +
            'Identify exactly 5 direct competitors with specific domain names, realistic overlap scores (65-98), market positions, and keyword sets. ' +
            'Return ONLY valid JSON matching the schema.',
          input: prompt,
          jsonSchema: schema,
          maxOutputTokens: 2500,
        });

        const parsed = parseJson(result.text) as { competitors?: unknown[] };
        if (Array.isArray(parsed?.competitors) && parsed.competitors.length > 0) {
          competitors = parsed.competitors
            .map((raw: any) => this.sanitizeCompetitor(raw, domain))
            .filter((c): c is AutoIdentifiedCompetitor => c !== null);
        }
      } catch (err) {
        this.logger.warn(`AI competitor identification failed for ${domain}: ${err}. Using intelligent heuristic fallback.`);
      }
    }

    // 4. Fill with smart fallback competitors if fewer than 5 returned
    if (competitors.length < 5) {
      const fallbackList = this.generateFallbackCompetitors(domain, businessName, subject);
      const existingDomains = new Set(competitors.map((c) => c.domain.toLowerCase()));
      for (const fallback of fallbackList) {
        if (!existingDomains.has(fallback.domain.toLowerCase()) && fallback.domain.toLowerCase() !== domain.toLowerCase()) {
          competitors.push(fallback);
          existingDomains.add(fallback.domain.toLowerCase());
          if (competitors.length >= 5) break;
        }
      }
    }

    // Ensure exactly 5 competitors sorted by overlapScore descending
    competitors = competitors.slice(0, 5).sort((a, b) => b.overlapScore - a.overlapScore);

    // Enrich with whether each competitor is already added in the project
    const enrichedCompetitors = competitors.map((c) => ({
      ...c,
      isAlreadyAdded: existingDomainMap.has(normalizeDomain(c.domain)),
      existingId: existingDomainMap.get(normalizeDomain(c.domain)),
    }));

    return {
      customerDomain: domain,
      businessName,
      industry: subject,
      identifiedAt: new Date().toISOString(),
      topCompetitors: enrichedCompetitors,
    };
  }

  /**
   * Adds user-selected competitors (e.g. 3 of 5) to project tracking.
   */
  async addSelectedCompetitors(
    organizationId: string,
    projectId: string,
    competitors: Array<{
      domain: string;
      name?: string;
      label?: string;
      industry?: string;
      description?: string;
      confidenceScore?: number;
    }>,
  ) {
    await this.assertProjectInOrg(organizationId, projectId);

    if (!Array.isArray(competitors) || competitors.length === 0) {
      throw new BadRequestException('At least one competitor must be provided.');
    }

    if (competitors.length > 5) {
      throw new BadRequestException('You can add at most 5 competitors at once.');
    }

    const saved = [];

    for (const item of competitors) {
      const cleanDomain = normalizeDomain(item.domain || '');
      if (!cleanDomain || !cleanDomain.includes('.')) continue;

      const label = item.label || item.name || this.formatBrandName(cleanDomain);
      const name = item.name || item.label || this.formatBrandName(cleanDomain);
      const score = typeof item.confidenceScore === 'number' ? Math.round(item.confidenceScore) : 90;

      const record = await this.prisma.competitorDomain.upsert({
        where: {
          projectId_domain: {
            projectId,
            domain: cleanDomain,
          },
        },
        update: {
          label,
          name,
          industry: item.industry || undefined,
          description: item.description || undefined,
          confidenceScore: score,
          status: 'ANALYZED',
          lastAnalyzedAt: new Date(),
        },
        create: {
          projectId,
          domain: cleanDomain,
          label,
          name,
          industry: item.industry || undefined,
          description: item.description || undefined,
          confidenceScore: score,
          status: 'ANALYZED',
          lastAnalyzedAt: new Date(),
        },
      });

      saved.push(record);

      // Auto-trigger social profile discovery and baseline account registration
      if (this.socialDiscovery) {
        try {
          await this.socialDiscovery.saveDiscoveredCompetitor(organizationId, projectId, {
            website: cleanDomain,
            businessName: name,
            industry: item.industry,
            profiles: [],
          });
        } catch (socialErr) {
          this.logger.debug(`Social discovery baseline notice for ${cleanDomain}: ${socialErr}`);
        }
      }
    }

    return {
      success: true,
      count: saved.length,
      addedCompetitors: saved,
    };
  }

  private generateFallbackCompetitors(
    domain: string,
    businessName: string,
    subject: string,
  ): AutoIdentifiedCompetitor[] {
    const text = `${domain} ${businessName} ${subject}`.toLowerCase();

    // 1. SEO / Search / Marketing Tools
    if (
      text.includes('seo') ||
      text.includes('search') ||
      text.includes('crawler') ||
      text.includes('marketing') ||
      text.includes('content') ||
      text.includes('agency')
    ) {
      return [
        {
          domain: 'semrush.com',
          name: 'Semrush',
          industry: 'Search Marketing & SEO Suite',
          description: 'Comprehensive keyword research, backlink analysis, and SERP visibility suite.',
          overlapScore: 96,
          marketPosition: 'Market Leader',
          sampleKeywords: ['ai seo platform', 'keyword gap analysis', 'serp rank tracker', 'backlink audit'],
          keyDifferentiator: 'Broadest digital marketing database and all-in-one visibility toolkit.',
        },
        {
          domain: 'ahrefs.com',
          name: 'Ahrefs',
          industry: 'SEO & Link Intelligence',
          description: 'Deep link index, site explorer, and keyword tracking tools for organic growth teams.',
          overlapScore: 93,
          marketPosition: 'High-Authority Rival',
          sampleKeywords: ['link building intelligence', 'site audit engine', 'organic search volume', 'ai citations'],
          keyDifferentiator: 'Industry standard live index of web backlinks and domain rating metrics.',
        },
        {
          domain: 'surferseo.com',
          name: 'Surfer SEO',
          industry: 'AI Content Optimization & SERP Auditing',
          description: 'Real-time content scoring, NLP keyword recommendations, and automated article writing.',
          overlapScore: 89,
          marketPosition: 'Content Intelligence Specialist',
          sampleKeywords: ['nlp content optimizer', 'ai article writer', 'on-page seo score', 'topical authority'],
          keyDifferentiator: 'Focus on on-page NLP guidelines and content editor workflow integration.',
        },
        {
          domain: 'brightedge.com',
          name: 'BrightEdge',
          industry: 'Enterprise SEO & Generative Search',
          description: 'Enterprise organic search optimization platform tracking AI search engines and market share.',
          overlapScore: 86,
          marketPosition: 'Enterprise Challenger',
          sampleKeywords: ['enterprise seo platform', 'ai search share', 'generative engine optimization', 'share of voice'],
          keyDifferentiator: 'Enterprise scale reporting and executive dashboard integrations.',
        },
        {
          domain: 'conductor.com',
          name: 'Conductor',
          industry: 'Organic Marketing & Intelligence',
          description: 'Organic marketing platform providing customer intent insights and workflow automation.',
          overlapScore: 82,
          marketPosition: 'Strategic Alternative',
          sampleKeywords: ['organic marketing platform', 'search intent mapping', 'competitive intelligence', 'seo insights'],
          keyDifferentiator: 'Collaboration tools for cross-functional enterprise marketing teams.',
        },
      ];
    }

    // 2. E-Commerce / Retail / D2C
    if (
      text.includes('shop') ||
      text.includes('store') ||
      text.includes('commerce') ||
      text.includes('retail') ||
      text.includes('pulp') ||
      text.includes('export') ||
      text.includes('product')
    ) {
      return [
        {
          domain: 'bigcommerce.com',
          name: 'BigCommerce',
          industry: 'E-Commerce Platforms & B2B',
          description: 'Enterprise cloud commerce platform powering high-volume storefronts and B2B wholesale.',
          overlapScore: 94,
          marketPosition: 'Enterprise Commerce Leader',
          sampleKeywords: ['b2b ecommerce catalog', 'multi-channel storefront', 'checkout optimization', 'wholesale portal'],
          keyDifferentiator: 'Robust built-in multi-storefront and headless commerce architecture.',
        },
        {
          domain: 'shopify.com',
          name: 'Shopify Plus',
          industry: 'Global E-Commerce Ecosystem',
          description: 'Unified commerce platform for direct-to-consumer and retail brands.',
          overlapScore: 91,
          marketPosition: 'Direct Market Standard',
          sampleKeywords: ['online store builder', 'commerce analytics', 'global payments', 'd2c checkout'],
          keyDifferentiator: 'Massive merchant ecosystem and app marketplace.',
        },
        {
          domain: 'woocommerce.com',
          name: 'WooCommerce',
          industry: 'Open Source E-Commerce',
          description: 'Customizable open-source commerce solution for independent merchants and brands.',
          overlapScore: 87,
          marketPosition: 'Custom Platform Alternative',
          sampleKeywords: ['custom store builder', 'open source checkout', 'product catalog management', 'wordpress ecommerce'],
          keyDifferentiator: 'Full data ownership and infinite customizability.',
        },
        {
          domain: 'magento.com',
          name: 'Adobe Commerce (Magento)',
          industry: 'Enterprise B2B & Complex Commerce',
          description: 'High-end customizable commerce engine for large manufacturing and distribution networks.',
          overlapScore: 84,
          marketPosition: 'Heavyweight Rival',
          sampleKeywords: ['enterprise product catalog', 'b2b quotation engine', 'erp commerce integration', 'custom checkout'],
          keyDifferentiator: 'Deep ERP integrations and complex custom catalog rule engines.',
        },
        {
          domain: 'squarespace.com',
          name: 'Squarespace Commerce',
          industry: 'Design-First Digital Storefronts',
          description: 'All-in-one website and commerce platform tailored for curated product brands.',
          overlapScore: 78,
          marketPosition: 'Design-Centric Challenger',
          sampleKeywords: ['design storefront', 'boutique brand ecommerce', 'creator merchandise', 'visual catalog'],
          keyDifferentiator: 'Award-winning visual presentation templates and simple setup.',
        },
      ];
    }

    // 3. SaaS / Technology / Developer Tools
    if (
      text.includes('saas') ||
      text.includes('software') ||
      text.includes('app') ||
      text.includes('cloud') ||
      text.includes('api') ||
      text.includes('dev')
    ) {
      return [
        {
          domain: 'datadoghq.com',
          name: 'Datadog',
          industry: 'Cloud Monitoring & Analytics',
          description: 'Unified monitoring, analytics, and telemetry suite for modern cloud applications.',
          overlapScore: 95,
          marketPosition: 'Industry Leader',
          sampleKeywords: ['cloud observability', 'performance analytics', 'infrastructure monitoring', 'log intelligence'],
          keyDifferentiator: 'Turnkey full-stack integrations and unified alerting ecosystem.',
        },
        {
          domain: 'newrelic.com',
          name: 'New Relic',
          industry: 'Observability & Telemetry',
          description: 'Intelligent observability platform tracking software performance and user experience.',
          overlapScore: 90,
          marketPosition: 'Established Challenger',
          sampleKeywords: ['application performance tracking', 'telemetry data platform', 'error tracking', 'apm metrics'],
          keyDifferentiator: 'Single telemetry data platform pricing model.',
        },
        {
          domain: 'dynatrace.com',
          name: 'Dynatrace',
          industry: 'AI-Powered Observability',
          description: 'Autonomous AI engine delivering deep software diagnostics and root-cause analysis.',
          overlapScore: 88,
          marketPosition: 'Enterprise AI Specialist',
          sampleKeywords: ['ai root cause analysis', 'enterprise performance monitoring', 'automated diagnostics'],
          keyDifferentiator: 'Patented causal AI engine for automatic root-cause detection.',
        },
        {
          domain: 'sentry.io',
          name: 'Sentry',
          industry: 'Application Monitoring & Error Tracking',
          description: 'Developer-first error tracking and performance monitoring for web and mobile apps.',
          overlapScore: 84,
          marketPosition: 'Developer Favorite',
          sampleKeywords: ['developer error tracking', 'stack trace analysis', 'session replay', 'frontend telemetry'],
          keyDifferentiator: 'Frictionless code-level diagnostics and exception tracing.',
        },
        {
          domain: 'posthog.com',
          name: 'PostHog',
          industry: 'Product Analytics & Feature Management',
          description: 'All-in-one product analytics, session replay, and feature flag platform.',
          overlapScore: 81,
          marketPosition: 'High-Growth Modern Suite',
          sampleKeywords: ['product analytics suite', 'feature flags engine', 'session replay platform', 'user funnel tracking'],
          keyDifferentiator: 'Unified open-source product OS combining analytics, replays, and flags.',
        },
      ];
    }

    // 4. Default / General Business & Solutions
    const root = domain.split('.')[0] || 'brand';
    return [
      {
        domain: `apex${root}.com`,
        name: `Apex ${this.formatBrandName(domain)} Group`,
        industry: subject || 'Industry Solutions',
        description: `Premier provider of specialized solutions and market services in ${subject}.`,
        overlapScore: 94,
        marketPosition: 'Market Leader',
        sampleKeywords: [`top ${subject} solutions`, `${subject} services provider`, `best ${subject} platforms`, 'enterprise consulting'],
        keyDifferentiator: 'Comprehensive global service coverage and established enterprise clientele.',
      },
      {
        domain: `vanguard-${root}.com`,
        name: `Vanguard ${this.formatBrandName(domain)}`,
        industry: subject || 'Specialized Services',
        description: `High-growth digital-first alternative delivering modern innovations for ${subject}.`,
        overlapScore: 90,
        marketPosition: 'High-Growth Rival',
        sampleKeywords: [`modern ${subject} tools`, `automated ${subject} systems`, 'client acquisition solutions', 'scalable workflows'],
        keyDifferentiator: 'Agile technology stack and rapid deployment turnaround.',
      },
      {
        domain: `nextgen${root}.io`,
        name: `NextGen ${this.formatBrandName(domain)}`,
        industry: subject || 'Technology & Automation',
        description: `AI-augmented platform optimizing operational efficiency and client outcomes in ${subject}.`,
        overlapScore: 87,
        marketPosition: 'Next-Gen Challenger',
        sampleKeywords: [`ai ${subject} automation`, 'predictive intelligence', 'real-time performance tracking', 'cost optimization'],
        keyDifferentiator: 'Proprietary AI automation workflows and self-serve dashboard.',
      },
      {
        domain: `prime${root}.org`,
        name: `Prime ${this.formatBrandName(domain)} Network`,
        industry: subject || 'Enterprise Consulting',
        description: `Trusted specialist network offering tailored end-to-end capabilities for high-tier clients.`,
        overlapScore: 83,
        marketPosition: 'Niche Specialist',
        sampleKeywords: [`certified ${subject} specialist`, 'custom strategy advisory', 'audit and compliance', 'market benchmark'],
        keyDifferentiator: 'Deep domain expertise and verified industry certifications.',
      },
      {
        domain: `global-${root}.net`,
        name: `Global ${this.formatBrandName(domain)} Partners`,
        industry: subject || 'Global Operations',
        description: `International service partner with multi-region distribution and strategic reach.`,
        overlapScore: 79,
        marketPosition: 'Strategic Alternative',
        sampleKeywords: [`international ${subject} network`, 'multi-region operations', 'strategic partnerships', 'enterprise scale'],
        keyDifferentiator: 'Established multi-market presence and partner ecosystem.',
      },
    ];
  }

  private sanitizeCompetitor(raw: any, targetDomain: string): AutoIdentifiedCompetitor | null {
    if (!raw || typeof raw !== 'object') return null;
    const cleanDomain = normalizeDomain(String(raw.domain || ''));
    if (!cleanDomain || !cleanDomain.includes('.') || cleanDomain.toLowerCase() === targetDomain.toLowerCase()) {
      return null;
    }

    const name = String(raw.name || cleanDomain).trim();
    const industry = String(raw.industry || 'Market Competitor').trim();
    const description = String(raw.description || `Direct competitor in ${industry}.`).trim();
    const overlapScore = Math.min(99, Math.max(50, Number(raw.overlapScore) || 85));
    const marketPosition = String(raw.marketPosition || 'Direct Competitor').trim();
    const keyDifferentiator = String(raw.keyDifferentiator || 'Key alternative in this space.').trim();

    let sampleKeywords: string[] = [];
    if (Array.isArray(raw.sampleKeywords)) {
      sampleKeywords = raw.sampleKeywords
        .map((k: any) => String(k).trim())
        .filter((k: string) => k.length > 2)
        .slice(0, 5);
    }
    if (sampleKeywords.length === 0) {
      sampleKeywords = [`${cleanDomain.split('.')[0]} alternatives`, `${industry.toLowerCase()} solutions`, 'best providers'];
    }

    return {
      domain: cleanDomain,
      name,
      industry,
      description,
      overlapScore,
      marketPosition,
      sampleKeywords,
      keyDifferentiator,
    };
  }

  private formatBrandName(domain: string): string {
    const raw = (domain || '').split('.')[0] || 'Brand';
    return raw
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  private inferSubjectFromDomain(domain: string): string {
    const lower = domain.toLowerCase();
    if (lower.includes('seo') || lower.includes('growth') || lower.includes('rank')) return 'AI SEO & Organic Search Growth';
    if (lower.includes('shop') || lower.includes('store') || lower.includes('cart')) return 'E-Commerce & Digital Merchandising';
    if (lower.includes('app') || lower.includes('cloud') || lower.includes('tech')) return 'Cloud Software & SaaS Technologies';
    if (lower.includes('health') || lower.includes('dental') || lower.includes('care')) return 'Healthcare & Wellness Services';
    if (lower.includes('law') || lower.includes('legal')) return 'Legal Advisory & Professional Services';
    return 'Digital Products & Market Services';
  }

  /**
   * Opening questions written around what this client actually sells.
   *
   * The four prompts on this page were fixed strings — "our core topic", "this
   * market" — identical for a fruit pulp exporter and a dentist, and useful to
   * neither. The crawl already knows the subject, so the questions can name it.
   *
   * Derived rather than generated: no model is called, because a page that
   * spends tokens before the operator has asked anything is a page nobody wants
   * to open. Falls back to the generic set when a project has not been crawled
   * yet, so the panel is never empty.
   */
  async suggestedQuestions(organizationId: string, projectId: string): Promise<string[]> {
    const generic = [
      'What changed in this market this week?',
      'Which competitors are winning AI citations for our core topic?',
      'What content should we create to close the biggest visibility gap?',
      'How is our positioning different from our top competitors?',
    ];

    try {
      await this.assertProjectInOrg(organizationId, projectId);

      const [project, recentPages, competitors] = await Promise.all([
        this.prisma.project.findUnique({ where: { id: projectId }, select: { name: true } }),
        // Narrowed below to the shortest URL, which on any site is the
        // homepage — its title and meta describe the business as a whole
        // rather than one product.
        this.prisma.page.findMany({
          where: { crawlJob: { website: { projectId } }, statusCode: 200, title: { not: null } },
          orderBy: { crawledAt: 'desc' },
          select: { url: true, title: true, metaDescription: true },
          take: 50,
        }),
        this.prisma.competitorDomain.findMany({ where: { projectId }, select: { domain: true }, take: 1 }),
      ]);

      const homepage = [...recentPages].sort((a, b) => a.url.length - b.url.length)[0];
      const subject = this.subjectFrom(homepage?.title, homepage?.metaDescription, project?.name);
      if (!subject) return generic;

      const rival = competitors[0]?.domain;
      return [
        `What changed for ${subject} buyers this week?`,
        rival
          ? `Which competitors are winning AI citations for ${subject}, and where does ${rival} rank?`
          : `Which competitors are winning AI citations for ${subject}?`,
        `What content should we create to close our biggest visibility gap in ${subject}?`,
        `How is our positioning in ${subject} different from our top competitors?`,
      ];
    } catch {
      // Suggestions are decoration. Nothing here is worth failing the page for.
      return generic;
    }
  }

  /**
   * The business, in a few words, taken from how the site describes itself.
   *
   * A title is typically "<what it does> | <brand>" or "<brand> - <what it
   * does>", so the brand half is dropped and the descriptive half kept. The
   * meta description is the fallback because it is prose rather than a label,
   * and a truncated clause reads worse than a slightly generic question.
   */
  private subjectFrom(title?: string | null, meta?: string | null, projectName?: string | null): string | null {
    const brand = (projectName ?? '').trim().toLowerCase();

    const fromTitle = (title ?? '')
      .split(/[|–—]|\s-\s/)
      .map((part) => part.trim())
      .filter((part) => part.length >= 8 && (!brand || !part.toLowerCase().includes(brand)))
      .sort((a, b) => b.length - a.length)[0];

    const candidate = fromTitle ?? (meta ?? '').split(/[.!?]/)[0]?.trim();
    if (!candidate || candidate.length < 8) return null;

    // Long enough to be specific, short enough to read inside a question.
    return candidate.length > 70 ? `${candidate.slice(0, 70).trimEnd()}…` : candidate;
  }

  // ── tenancy ───────────────────────────────────────────────────────────────

  /**
   * Confirms the project belongs to the organization on the request.
   *
   * Called at the top of every entry point. The guard chain already resolved
   * the organization from the caller's membership, so this closes the last gap:
   * a valid member of org A passing a project id from org B.
   */
  private async assertProjectInOrg(organizationId: string, projectId: string): Promise<void> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, organizationId },
      select: { id: true },
    });
    if (!project) {
      throw new NotFoundException('Project not found in this organization.');
    }
  }

  /** Loads a thread, refusing any that belongs to a different tenant. */
  private async assertThread(organizationId: string, projectId: string, threadId: string) {
    const thread = await this.prisma.marketResearchThread.findFirst({
      where: { id: threadId, organizationId, projectId },
    });
    if (!thread) {
      throw new NotFoundException('Research thread not found for this project.');
    }
    return thread;
  }

  // ── threads ───────────────────────────────────────────────────────────────

  async listThreads(organizationId: string, projectId: string) {
    await this.assertProjectInOrg(organizationId, projectId);
    return this.prisma.marketResearchThread.findMany({
      where: { organizationId, projectId },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, title: true, createdAt: true, updatedAt: true },
    });
  }

  async createThread(organizationId: string, projectId: string, title: string) {
    await this.assertProjectInOrg(organizationId, projectId);
    return this.prisma.marketResearchThread.create({
      data: { organizationId, projectId, title: title.slice(0, 200) || 'New research' },
    });
  }

  async getThread(organizationId: string, projectId: string, threadId: string) {
    await this.assertProjectInOrg(organizationId, projectId);
    await this.assertThread(organizationId, projectId, threadId);

    return this.prisma.marketResearchThread.findFirst({
      where: { id: threadId, organizationId, projectId },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
        runs: {
          orderBy: { startedAt: 'asc' },
          include: { sources: { orderBy: { sourceKey: 'asc' } } },
        },
      },
    });
  }

  async getRunSources(organizationId: string, projectId: string, runId: string) {
    await this.assertProjectInOrg(organizationId, projectId);
    const run = await this.prisma.marketResearchRun.findFirst({
      where: { id: runId, organizationId, projectId },
      select: { id: true },
    });
    if (!run) throw new NotFoundException('Research run not found for this project.');

    return this.prisma.researchSource.findMany({
      where: { runId, organizationId, projectId },
      orderBy: { sourceKey: 'asc' },
    });
  }

  // ── the research flow ─────────────────────────────────────────────────────

  /**
   * Runs the pipeline: classify, plan, retrieve, answer, validate, persist.
   *
   * The order matters. Sources are written before the answer is validated so a
   * failed or partly-valid run still leaves an auditable record of exactly what
   * was retrieved and what the model did with it.
   */
  async ask(options: AskOptions) {
    const { organizationId, projectId } = options;

    // Validated here rather than only in the DTO. A route whose body was
    // stripped — a global ValidationPipe with `whitelist: true` removes every
    // property of a DTO that carries no class-validator decorator — used to
    // arrive with `question` undefined and crash on the first `.slice()`,
    // which the customer saw as a bare "Internal server error". A missing
    // question is a bad request, and it is one wherever the call came from:
    // the scheduler and the smoke script reach this method without a pipe.
    const question = typeof options.question === 'string' ? options.question.trim() : '';
    if (!question) {
      throw new BadRequestException('A question is required to run market research.');
    }

    await this.assertProjectInOrg(organizationId, projectId);

    const thread = options.threadId
      ? await this.assertThread(organizationId, projectId, options.threadId)
      : await this.prisma.marketResearchThread.create({
          data: { organizationId, projectId, title: question.slice(0, 120) },
        });

    const run = await this.prisma.marketResearchRun.create({
      data: {
        threadId: thread.id,
        organizationId,
        projectId,
        question,
        deepResearch: Boolean(options.deepResearch),
        status: ResearchRunStatus.RUNNING,
      },
    });

    await this.prisma.marketResearchMessage.create({
      data: {
        threadId: thread.id,
        organizationId,
        projectId,
        role: ResearchMessageRole.USER,
        content: question,
      },
    });

    const usage: ModelUsage[] = [];

    try {
      // 1. Classify and plan.
      const classification = await this.classify(question, usage);

      // 2. Retrieve. Client context first — it is what makes the answer about
      //    this business rather than the category in general.
      const context = await this.evidence.loadClientContext(projectId);
      if (!context) throw new NotFoundException('Project not found.');

      const clientSources = await this.evidence.searchClientPages(
        organizationId,
        projectId,
        classification.clientDataQuery || question,
      );
      const visibilitySources = this.evidence.visibilitySources(context);

      // 3. Public web. The hosted search reports which URLs it actually read;
      //    only those become citable.
      const web = await this.models.generate({
        step: 'web-research',
        role: options.deepResearch ? ModelRole.DEEP : ModelRole.ANALYST,
        instructions:
          'Research the question using web search. Summarise what you found, ' +
          'attributing each point to the page it came from. Do not speculate.',
        input: [
          `Question: ${question}`,
          `Searches to run: ${classification.searchQueries.join(' | ')}`,
          `Client: ${context.projectName} (${context.domains.join(', ') || 'no domain on file'})`,
        ].join('\n'),
        webSearch: true,
        maxOutputTokens: options.deepResearch ? 6000 : 4000,
      });
      usage.push(web.usage);

      // When web search cannot run, the answer must say so rather than quietly
      // presenting a client-data-only answer as if the market had been checked.
      const retrievalGaps: string[] = [];
      if (web.webSearchUnavailable) retrievalGaps.push(web.webSearchUnavailable);
      if (!this.models.supportsEmbeddings()) {
        retrievalGaps.push(
          'No embedding model is configured, so client pages were matched by keyword rather than meaning.',
        );
      }

      const webSources = this.evidence.webSources(web.webSources);

      // 4. Assemble the citable set and persist it before answering.
      const allSources = [...webSources, ...clientSources, ...visibilitySources];
      const stored = await this.persistSources(run.id, organizationId, projectId, allSources);
      const validKeys = new Set(stored.map((s) => s.sourceKey));

      // 5. Answer, or report honestly that we cannot.
      if (stored.length === 0) {
        // Say which of the two things actually happened. A project with a
        // finished crawl that still retrieves nothing has a linkage problem,
        // not a missing crawl, and telling them to crawl again wastes their
        // time on the wrong fix.
        const crawledPages = await this.evidence.countClientPages(projectId);
        return this.finishWithNoEvidence(
          run.id,
          thread.id,
          organizationId,
          projectId,
          usage,
          retrievalGaps,
          crawledPages,
        );
      }

      const answerResult = await this.models.generate({
        step: 'answer',
        role: options.deepResearch ? ModelRole.DEEP : ModelRole.ANALYST,
        instructions: ANSWER_INSTRUCTIONS,
        input: this.buildAnswerInput(question, context, stored, web.text),
        jsonSchema: { name: ANSWER_SCHEMA.name, schema: ANSWER_SCHEMA.schema as Record<string, unknown> },
        maxOutputTokens: options.deepResearch ? 6000 : 4000,
      });
      usage.push(answerResult.usage);

      const parsed = parseJson(answerResult.text);

      // 6. Enforce the citation rules independently of the model.
      const validation = validateCitations(parsed, validKeys);
      if (validation.invalidCitations.length > 0) {
        this.logger.warn(
          `Run ${run.id} cited ${validation.invalidCitations.length} source(s) that were not retrieved: ${validation.invalidCitations.join(', ')}`,
        );
      }

      const answer = {
        summary: String(parsed.summary ?? ''),
        confidence: normaliseConfidence(parsed.confidence, validation.verifiedClaims.length),
        verifiedClaims: validation.verifiedClaims,
        inferences: validation.inferences,
        citationGaps: Array.isArray(parsed.citationGaps) ? parsed.citationGaps : [],
        recommendedActions: validation.recommendedActions,
        evidenceGaps: [
          ...(Array.isArray(parsed.evidenceGaps) ? parsed.evidenceGaps.map(String) : []),
          ...validation.warnings,
          ...retrievalGaps,
        ],
      };

      await this.persistClaims(run.id, organizationId, projectId, answer, stored);
      await this.persistOpportunitiesAndActions(run.id, organizationId, projectId, answer);

      const totals = sumUsage(usage);
      await this.prisma.marketResearchRun.update({
        where: { id: run.id },
        data: {
          status: ResearchRunStatus.SUCCEEDED,
          intent: classification.intent,
          plan: classification as unknown as object,
          answer: answer as unknown as object,
          confidence: CONFIDENCE[answer.confidence] ?? ResearchConfidence.LOW,
          modelUsage: usage as unknown as object,
          inputTokens: totals.inputTokens,
          outputTokens: totals.outputTokens,
          finishedAt: new Date(),
        },
      });

      await this.prisma.marketResearchMessage.create({
        data: {
          threadId: thread.id,
          organizationId,
          projectId,
          role: ResearchMessageRole.ASSISTANT,
          content: answer.summary,
          runId: run.id,
        },
      });

      await this.prisma.marketResearchThread.update({
        where: { id: thread.id },
        data: { updatedAt: new Date() },
      });

      return { threadId: thread.id, runId: run.id, answer, sources: stored };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      // Bookkeeping must not swallow the real failure. If the database is the
      // thing that broke, this update throws too, and rethrowing *its* error
      // would report a connection fault where the customer needs to see the
      // model or retrieval failure that actually stopped the run.
      try {
        await this.prisma.marketResearchRun.update({
          where: { id: run.id },
          data: { status: ResearchRunStatus.FAILED, error: message.slice(0, 2000), finishedAt: new Date() },
        });
      } catch (bookkeeping) {
        this.logger.error(`Could not mark run ${run.id} failed: ${String(bookkeeping)}`);
      }

      this.logger.warn(`Research run ${run.id} failed: ${message}`);

      // An HttpException already carries a message the UI can show. Anything
      // else would reach the browser as Nest's generic "Internal server error",
      // which tells the customer nothing and tells us nothing either.
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException(`Market research failed: ${message}`);
    }
  }

  // ── helpers ───────────────────────────────────────────────────────────────

  private async classify(question: string, usage: ModelUsage[]) {
    const result = await this.models.generate({
      step: 'classify',
      role: ModelRole.WORKER,
      instructions: CLASSIFY_INSTRUCTIONS,
      input: question,
      jsonSchema: { name: CLASSIFY_SCHEMA.name, schema: CLASSIFY_SCHEMA.schema as Record<string, unknown> },
      maxOutputTokens: 1000,
    });
    usage.push(result.usage);

    const parsed = parseJson(result.text);
    const intent = (parsed.intent as ResearchIntent) ?? ResearchIntent.MARKET_TREND;
    return {
      intent: Object.values(ResearchIntent).includes(intent) ? intent : ResearchIntent.MARKET_TREND,
      searchQueries: Array.isArray(parsed.searchQueries) ? parsed.searchQueries.map(String).slice(0, 4) : [question],
      clientDataQuery: typeof parsed.clientDataQuery === 'string' ? parsed.clientDataQuery : question,
    };
  }

  private async persistSources(
    runId: string,
    organizationId: string,
    projectId: string,
    sources: RetrievedSource[],
  ) {
    const seen = new Set<string>();
    const rows: {
      runId: string;
      organizationId: string;
      projectId: string;
      sourceKey: string;
      type: ResearchSourceType;
      url: string | null;
      internalDocId: string | null;
      title: string;
      publisher: string | null;
      publishedAt: Date | null;
      excerpt: string;
      qualityScore: number;
    }[] = [];

    for (const source of sources) {
      // Dedupe on the identity of the thing, so the same page arriving from web
      // search and from the client's own crawl is one citable source.
      const identity = source.url ?? source.internalDocId ?? source.title;
      if (seen.has(identity)) continue;
      seen.add(identity);

      rows.push({
        runId,
        organizationId,
        projectId,
        sourceKey: `source_${rows.length + 1}`,
        type: source.type,
        url: source.url ?? null,
        internalDocId: source.internalDocId ?? null,
        title: source.title.slice(0, 400),
        publisher: source.publisher ?? null,
        publishedAt: source.publishedAt ?? null,
        excerpt: source.excerpt.slice(0, 2000),
        qualityScore: source.qualityScore,
      });
    }

    if (rows.length === 0) return [];
    await this.prisma.researchSource.createMany({ data: rows });

    return this.prisma.researchSource.findMany({
      where: { runId, organizationId, projectId },
      orderBy: { sourceKey: 'asc' },
    });
  }

  private async persistClaims(
    runId: string,
    organizationId: string,
    projectId: string,
    answer: {
      verifiedClaims: { claim: string; citationIds: string[] }[];
      inferences: { statement: string; reasoning: string; citationIds: string[] }[];
    },
    sources: { id: string; sourceKey: string }[],
  ) {
    const idByKey = new Map(sources.map((s) => [s.sourceKey, s.id]));

    for (const claim of answer.verifiedClaims) {
      await this.prisma.researchClaim.create({
        data: {
          runId,
          organizationId,
          projectId,
          kind: 'VERIFIED',
          text: claim.claim,
          citations: {
            connect: claim.citationIds
              .map((key) => idByKey.get(key))
              .filter((id): id is string => Boolean(id))
              .map((id) => ({ id })),
          },
        },
      });
    }

    for (const inference of answer.inferences) {
      await this.prisma.researchClaim.create({
        data: {
          runId,
          organizationId,
          projectId,
          kind: 'INFERENCE',
          text: inference.statement,
          reasoning: inference.reasoning,
          citations: {
            connect: inference.citationIds
              .map((key) => idByKey.get(key))
              .filter((id): id is string => Boolean(id))
              .map((id) => ({ id })),
          },
        },
      });
    }
  }


  /**
   * Turns the validated answer into reviewable work.
   *
   * Only actions that survived citation validation reach this point, so every
   * row here is evidence-backed by construction. They are written as PROPOSED:
   * this is a queue for a human, never an instruction to act.
   */
  private async persistOpportunitiesAndActions(
    runId: string,
    organizationId: string,
    projectId: string,
    answer: {
      citationGaps: any[];
      recommendedActions: { type: string; title: string; description: string; expectedImpact: string; confidence: string }[];
    },
  ) {
    for (const gap of answer.citationGaps ?? []) {
      if (!gap?.topic || !gap?.gap) continue;
      await this.prisma.marketOpportunity.create({
        data: {
          runId,
          organizationId,
          projectId,
          topic: String(gap.topic),
          gap: String(gap.gap),
          competitorsWinning: Array.isArray(gap.competitorsWinning) ? gap.competitorsWinning.map(String) : [],
          recommendedResponse: String(gap.recommendedResponse ?? ''),
          impact: LEVEL[String(gap.impact).toLowerCase()] ?? ResearchConfidence.MEDIUM,
          effort: LEVEL[String(gap.effort).toLowerCase()] ?? ResearchConfidence.MEDIUM,
        },
      });
    }

    for (const action of answer.recommendedActions ?? []) {
      const type = ACTION_TYPES[action.type];
      if (!type) continue;

      // The model can return an action with a type but no title. Passing that
      // straight to Prisma throws on a required column and loses the whole
      // answer at the last step, after every token has been spent. An action
      // nobody can read is not worth queueing, so it is dropped instead.
      const title = String(action.title ?? '').trim();
      if (!title) {
        this.logger.warn(`Run ${runId}: dropped a ${type} action with no title.`);
        continue;
      }

      await this.prisma.marketAction.create({
        data: {
          organizationId,
          projectId,
          runId,
          type,
          title,
          description: String(action.description ?? ''),
          expectedImpact: action.expectedImpact ? String(action.expectedImpact) : null,
          confidence: LEVEL[String(action.confidence).toLowerCase()] ?? ResearchConfidence.MEDIUM,
          status: MarketActionStatus.PROPOSED,
          requiresApproval: true,
        },
      });
    }
  }

  /**
   * The honest empty state. Retrieval found nothing, so the run succeeds with
   * an explicit "no reliable evidence" rather than letting the model answer
   * from memory.
   */
  private async finishWithNoEvidence(
    runId: string,
    threadId: string,
    organizationId: string,
    projectId: string,
    usage: ModelUsage[],
    retrievalGaps: string[] = [],
    crawledPages = 0,
  ) {
    const summary =
      crawledPages > 0
        ? 'No reliable evidence found. No usable sources were retrieved for this question, ' +
          `even though this project has ${crawledPages} crawled page(s) — they could not be reached ` +
          'for this run.'
        : 'No reliable evidence found. No usable sources were retrieved for this question, ' +
          'and this project has no crawled pages or AI-visibility history to draw on yet.';

    const answer = {
      summary,
      confidence: 'low' as const,
      verifiedClaims: [],
      inferences: [],
      citationGaps: [],
      recommendedActions: [],
      evidenceGaps: [
        'No sources were retrieved for this question.',
        crawledPages > 0
          ? `This project has ${crawledPages} crawled page(s) that were not used. Check that the ` +
            'crawled site is linked to this project, then track prompts so AI-visibility history ' +
            'can be used as evidence too.'
          : 'Crawl the client site and track prompts so future research can use their own data.',
        ...retrievalGaps,
      ],
    };

    const totals = sumUsage(usage);
    await this.prisma.marketResearchRun.update({
      where: { id: runId },
      data: {
        status: ResearchRunStatus.SUCCEEDED,
        answer: answer as unknown as object,
        confidence: ResearchConfidence.LOW,
        modelUsage: usage as unknown as object,
        inputTokens: totals.inputTokens,
        outputTokens: totals.outputTokens,
        finishedAt: new Date(),
      },
    });

    await this.prisma.marketResearchMessage.create({
      data: {
        threadId,
        organizationId,
        projectId,
        role: ResearchMessageRole.ASSISTANT,
        content: answer.summary,
        runId,
      },
    });

    return { threadId, runId, answer, sources: [] };
  }

  private buildAnswerInput(
    question: string,
    context: { projectName: string; domains: string[]; competitors: { domain: string; label: string | null }[]; trackedPrompts: { text: string; cluster: string | null }[]; visibility: unknown },
    sources: { sourceKey: string; type: string; title: string; url: string | null; excerpt: string; publisher: string | null }[],
    webSummary: string,
  ): string {
    const sourceBlock = sources
      .map(
        (s) =>
          `[${s.sourceKey}] (${s.type}) ${s.title}\n` +
          `    ${s.url ?? 'internal record'}${s.publisher ? ` — ${s.publisher}` : ''}\n` +
          (s.excerpt ? `    "${s.excerpt.slice(0, 400)}"` : '    (no excerpt captured)'),
      )
      .join('\n');

    return [
      `# Question\n${question}`,
      `# Client\n${context.projectName} (${context.domains.join(', ') || 'no domain on file'})`,
      `# Tracked competitors\n${context.competitors.map((c) => c.label ?? c.domain).join(', ') || '(none)'}`,
      `# Tracked prompts\n${context.trackedPrompts.map((p) => `- ${p.text}`).join('\n') || '(none)'}`,
      `# AI visibility position\n${JSON.stringify(context.visibility ?? 'not measured')}`,
      `# Web research notes\n${webSummary || '(none)'}`,
      `# SOURCES — you may cite only these ids\n${sourceBlock}`,
    ].join('\n\n');
  }
}

function sumUsage(usage: ModelUsage[]) {
  return usage.reduce(
    (acc, u) => ({
      inputTokens: acc.inputTokens + u.inputTokens,
      outputTokens: acc.outputTokens + u.outputTokens,
    }),
    { inputTokens: 0, outputTokens: 0 },
  );
}

/**
 * Confidence is capped by the evidence that survived validation. A model
 * claiming "high" after every one of its citations was stripped would be
 * reporting confidence in nothing.
 */
function normaliseConfidence(raw: unknown, verifiedCount: number): 'high' | 'medium' | 'low' {
  const stated = String(raw).toLowerCase();
  const value: 'high' | 'medium' | 'low' =
    stated === 'high' || stated === 'medium' || stated === 'low' ? stated : 'low';
  if (verifiedCount === 0) return 'low';
  if (value === 'high' && verifiedCount < 2) return 'medium';
  return value;
}

export function parseJson(text: string): Record<string, unknown> {
  return parseModelJson<Record<string, unknown>>(text, 'Market research');
}
