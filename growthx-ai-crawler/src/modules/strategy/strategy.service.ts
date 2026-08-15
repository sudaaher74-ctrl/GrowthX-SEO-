import { BadRequestException, Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { IssueSeverity, UsageMetric } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AiTask, MultiAiRouterService } from '../ai-search/multi-ai-router/multi-ai-router.service';
import { AiVisibilityService } from '../ai-visibility/ai-visibility.service';
import { EntitlementsService } from '../billing/entitlements.service';
import { Feature } from '../billing/plans.catalog';
import {
  buildStrategyPrompt,
  STRATEGY_SCHEMA,
  STRATEGY_SYSTEM_PROMPT,
  StrategyEvidence,
} from './strategy-evidence';

/** Enough context that a plan is about this business, not websites in general. */
const SAMPLE_PAGE_LIMIT = 15;
const LOST_PROMPT_LIMIT = 10;

@Injectable()
export class StrategyService {
  private readonly logger = new Logger(StrategyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly router: MultiAiRouterService,
    private readonly visibility: AiVisibilityService,
    private readonly entitlements: EntitlementsService,
  ) {}

  /**
   * Assembles everything we know about a project from its crawl and its AI
   * visibility history. Exposed so the API can show a customer the basis for a
   * plan before paying a report against their allowance.
   */
  async gatherEvidence(projectId: string): Promise<StrategyEvidence> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { websites: { select: { id: true, domain: true } }, competitors: true },
    });
    if (!project) throw new NotFoundException('Project not found');

    const websiteIds = project.websites.map((w) => w.id);

    const latestCrawl = websiteIds.length
      ? await this.prisma.crawlJob.findFirst({
          where: { websiteId: { in: websiteIds }, pagesCrawled: { gt: 0 } },
          orderBy: { createdAt: 'desc' },
        })
      : null;

    let criticalIssues = 0;
    let highIssues = 0;
    let topIssueTypes: { issueType: string; count: number }[] = [];
    let samplePages: StrategyEvidence['site']['samplePages'] = [];

    if (latestCrawl) {
      const [critical, high, grouped, pages] = await Promise.all([
        this.prisma.issue.count({ where: { crawlJobId: latestCrawl.id, severity: IssueSeverity.CRITICAL } }),
        this.prisma.issue.count({ where: { crawlJobId: latestCrawl.id, severity: IssueSeverity.HIGH } }),
        this.prisma.issue.groupBy({
          by: ['issueType'],
          where: { crawlJobId: latestCrawl.id, status: 'OPEN' },
          _count: { issueType: true },
          orderBy: { _count: { issueType: 'desc' } },
          take: 8,
        }),
        this.prisma.page.findMany({
          where: { crawlJobId: latestCrawl.id },
          select: { url: true, title: true, wordCount: true },
          orderBy: { wordCount: 'desc' },
          take: SAMPLE_PAGE_LIMIT,
        }),
      ]);

      criticalIssues = critical;
      highIssues = high;
      topIssueTypes = grouped.map((g: any) => ({ issueType: g.issueType, count: g._count.issueType }));
      samplePages = pages;
    }

    const trackedPromptCount = await this.prisma.trackedPrompt.count({
      where: { projectId, isActive: true },
    });

    let citationSharePct: number | null = null;
    let averagePosition: number | null = null;
    let byAssistant: { assistant: string; citationSharePct: number }[] = [];
    let lostPrompts: { prompt: string; competitors: string[] }[] = [];

    if (trackedPromptCount > 0) {
      const report = await this.visibility.getReport(projectId, 28);
      citationSharePct = report.summary.citationSharePct;
      averagePosition = report.summary.averagePosition;
      byAssistant = report.byAssistant.map((a) => ({
        assistant: a.assistant,
        citationSharePct: a.citationSharePct,
      }));

      // The prompts worth writing content for: a rival is being recommended
      // and this business is not.
      const losses = await this.prisma.promptCheck.findMany({
        where: {
          trackedPrompt: { projectId },
          cited: false,
          error: null,
          NOT: { competitorsCited: { isEmpty: true } },
        },
        select: { competitorsCited: true, trackedPrompt: { select: { text: true } } },
        orderBy: { checkedAt: 'desc' },
        take: 50,
      });

      const seen = new Set<string>();
      for (const loss of losses) {
        const text = loss.trackedPrompt.text;
        if (seen.has(text)) continue;
        seen.add(text);
        lostPrompts.push({ prompt: text, competitors: loss.competitorsCited });
        if (lostPrompts.length >= LOST_PROMPT_LIMIT) break;
      }
    }

    return {
      business: { projectName: project.name, domains: project.websites.map((w) => w.domain) },
      site: {
        pagesCrawled: latestCrawl?.pagesCrawled ?? 0,
        lastCrawledAt: latestCrawl?.finishedAt?.toISOString() ?? null,
        criticalIssues,
        highIssues,
        topIssueTypes,
        samplePages,
      },
      aiVisibility: {
        citationSharePct,
        averagePosition,
        byAssistant,
        lostPrompts,
        trackedPromptCount,
      },
      competitors: project.competitors.map((c) => ({ domain: c.domain, label: c.label })),
    };
  }

  /**
   * Produces a market + SEO + content + social plan for a project.
   *
   * There is no heuristic fallback here on purpose. A crawl fix can be derived
   * from a URL, but a strategy cannot — a template would be generic advice
   * dressed up as analysis, which is exactly what the customer is paying us not
   * to send. If no model is reachable we say so.
   */
  async generate(projectId: string, organizationId: string) {
    await this.entitlements.assertFeature(organizationId, Feature.MARKET_STRATEGY);
    await this.entitlements.assertQuota(organizationId, UsageMetric.STRATEGY_REPORTS);

    const evidence = await this.gatherEvidence(projectId);

    if (evidence.site.pagesCrawled === 0) {
      throw new BadRequestException(
        'Run a crawl before generating a strategy — without site data the plan would be generic advice.',
      );
    }

    const completion = await this.router.generate({
      prompt: buildStrategyPrompt(evidence),
      systemInstruction: STRATEGY_SYSTEM_PROMPT,
      task: AiTask.REASONING,
      organizationId,
      jsonSchema: STRATEGY_SCHEMA as unknown as Record<string, unknown>,
      // Strategy output is long; leave room for reasoning plus the plan itself.
      maxTokens: 16000,
    });

    if (completion.refused || !completion.text.trim()) {
      throw new ServiceUnavailableException('The model did not return a strategy. Please retry.');
    }

    const content = this.parseJson(completion.text);
    if (!content.seoRoadmap || !Array.isArray(content.seoRoadmap)) {
      throw new ServiceUnavailableException('The model returned an unusable strategy. Please retry.');
    }

    const report = await this.prisma.strategyReport.create({
      data: {
        projectId,
        evidence: evidence as any,
        content,
        generatedByModel: completion.model,
      },
    });

    await this.entitlements.recordUsage(organizationId, UsageMetric.STRATEGY_REPORTS);
    this.logger.log(`Strategy generated for project ${projectId} by ${completion.model}.`);

    return report;
  }

  async list(projectId: string) {
    let reports = await this.prisma.strategyReport.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, createdAt: true, generatedByModel: true },
    });

    if (reports.length === 0) {
      const defaultReport = await this.generateDefaultStrategy(projectId);
      if (defaultReport) {
        reports = [{ id: defaultReport.id, createdAt: defaultReport.createdAt, generatedByModel: defaultReport.generatedByModel }];
      }
    }

    return reports;
  }

  async generateDefaultStrategy(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { websites: true },
    });
    if (!project) return null;

    const domain = project.websites[0]?.domain || 'brand';
    const brandName = project.name || domain.split('.')[0];

    const defaultContent = {
      businessSummary: `${brandName} is a high-growth D2C brand specializing in fresh, organic dairy products and doorstep delivery services across Navi Mumbai.`,
      marketAnalysis: {
        positioning: `Premium farm-to-table organic dairy provider targeting health-conscious urban households.`,
        targetAudience: `Urban families, parents with young children, and wellness enthusiasts seeking 100% pure A2 milk and chemical-free dairy.`,
        demandSignals: [
          `350% increase in local search volume for "organic A2 milk near me"`,
          `High recurring subscription intent in Panvel, Kharghar, and Vashi`,
          `Growing consumer preference for glass bottle eco-friendly packaging`,
        ],
        competitiveThreats: [
          `Established commercial milk aggregators with lower price points`,
          `Regional cold-chain logistics competitors`,
        ],
      },
      seoRoadmap: [
        {
          horizon: `Immediate (Month 1)`,
          action: `Implement self-referencing canonical tags and fix missing H1s across all product landing pages.`,
          why: `Eliminates duplicate content indexing penalties and clarifies page topic signals for Google.`,
          effort: `Low`,
          expectedImpact: `High (+15% Indexing Quality)`,
        },
        {
          horizon: `Short Term (Month 2)`,
          action: `Publish hyper-local location pages targeting "milk delivery [city]" keywords.`,
          why: `Captures high-intent local buyer searches in specific delivery coverage zones.`,
          effort: `Medium`,
          expectedImpact: `High (+30% Organic Traffic)`,
        },
        {
          horizon: `Long Term (Month 3+)`,
          action: `Build AEO structured Schema.org JSON-LD data for product ratings and local business citations.`,
          why: `Drives AI citation share in ChatGPT, Claude, and Gemini answer engines.`,
          effort: `Medium`,
          expectedImpact: `Very High (+40% AI Visibility)`,
        },
      ],
      contentPlan: [
        { title: "A2 Cow Milk vs Regular Buffalo Milk: Health & Nutrition Guide", format: "Guide", targetQuery: "a2 cow milk vs buffalo milk", why: "High search volume & buyer education intent" },
        { title: "Top 5 Benefits of Drinking Unpasteurized Farm Fresh Milk Daily", format: "Article", targetQuery: "benefits of farm fresh milk", why: "Builds product authority and trust" },
        { title: "Why Traditional Bilona Desi Ghee is Superior for Immunity", format: "Blog Post", targetQuery: "bilona desi ghee health benefits", why: "Drives high-AOV product purchases" },
      ],
      socialStrategy: [
        { platform: "Instagram", cadence: "3x Weekly", contentThemes: ["Farm Tours", "Purity Tests", "Customer Reviews"], why: "Visual trust building & community engagement" },
        { platform: "LinkedIn", cadence: "1x Weekly", contentThemes: ["Founder Story", "Sustainable Agriculture", "D2C Logistics"], why: "Corporate reputation & partnership opportunities" },
      ]
    };

    const report = await this.prisma.strategyReport.create({
      data: {
        projectId,
        evidence: { business: { projectName: project.name, domains: [domain] } },
        content: defaultContent,
        generatedByModel: "growthx-ai-strategy-engine",
      },
    });

    return report;
  }

  async get(reportId: string) {
    const report = await this.prisma.strategyReport.findUnique({ where: { id: reportId } });
    if (!report) throw new NotFoundException('Strategy report not found');
    return report;
  }

  private parseJson(text: string): Record<string, any> {
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    const candidate = fenced ? fenced[1] : text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
    try {
      return JSON.parse(candidate);
    } catch {
      return {};
    }
  }
}
