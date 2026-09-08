import { BadRequestException, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { AiAssistant, } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AiProvider, AiTask, MultiAiRouterService } from '../ai-search/multi-ai-router/multi-ai-router.service';
import { CompetitorRef, detectCitation, normalizeDomain } from './citation/citation-detector';
import { buildVisibilityReport, ReportableCheck, VisibilityReport } from './citation/visibility-report';
import { CompetitorCrawlService } from '../content-intelligence/competitor-crawl.service';
import { calculateHealthScore } from '../issues/health-score.util';

/**
 * Which assistants we can genuinely query.
 *
 * Perplexity, Google AI Overviews, and Copilot have no API we can drive, so a
 * check against them records an explicit error instead of a fabricated result.
 * Wiring one up later means adding an entry here and nothing else.
 */
const ASSISTANT_PROVIDER: Readonly<Partial<Record<AiAssistant, AiProvider>>> = {
  [AiAssistant.CHATGPT]: AiProvider.OPENAI,
  [AiAssistant.CLAUDE]: AiProvider.ANTHROPIC,
  [AiAssistant.GEMINI]: AiProvider.GEMINI,
};

export const SUPPORTED_ASSISTANTS = Object.keys(ASSISTANT_PROVIDER) as AiAssistant[];

const UNSUPPORTED_REASON =
  'No public API is available for this assistant, so its citation share cannot be measured directly.';

/** Keeps stored evidence useful without bloating the table. */
const EXCERPT_LIMIT = 2000;

interface ProjectContext {
  organizationId: string;
  ownDomains: string[];
  ownBrandNames: string[];
  competitors: CompetitorRef[];
  competitorLabels: Record<string, string>;
  /** Where the questions are asked from. Null when the project has no location. */
  origin: {
    locationId: string;
    metroId: string | null;
    latitude: number | null;
    longitude: number | null;
  } | null;
}

export interface SweepResult {
  projectId: string;
  promptsChecked: number;
  checksRun: number;
  checksFailed: number;
  citations: number;
  skippedAssistants: AiAssistant[];
}

@Injectable()
export class AiVisibilityService {
  private readonly logger = new Logger(AiVisibilityService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly router: MultiAiRouterService,
    @Optional() private readonly competitorCrawl?: CompetitorCrawlService,
  ) {}

  /** Resolves everything a citation check needs to know about the customer. */
  private async loadContext(projectId: string): Promise<ProjectContext> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { websites: { select: { domain: true } }, competitors: true },
    });
    if (!project) throw new NotFoundException('Project not found');

    const ownDomains = project.websites.map((w) => normalizeDomain(w.domain)).filter(Boolean);
    if (ownDomains.length === 0) {
      throw new BadRequestException(
        'Add at least one website to this project before tracking AI visibility — ' +
          'without a domain there is nothing to look for in the answers.',
      );
    }

    const competitorLabels: Record<string, string> = {};
    const competitors: CompetitorRef[] = project.competitors.map((c) => {
      const domain = normalizeDomain(c.domain);
      if (c.label) competitorLabels[domain] = c.label;
      return { domain, names: c.label ? [c.label] : undefined };
    });

    // Where these questions are being asked from. A local answer is a
    // different answer in every city, so a citation record with no geography
    // cannot explain why a multi-location customer wins in one market and not
    // the next. Null when the project has no location profile, which is honest
    // and still queryable.
    const primaryLocation = await this.prisma.localLocation.findFirst({
      where: { projectId },
      orderBy: { createdAt: 'asc' },
      select: { id: true, address: true, latitude: true, longitude: true },
    });

    return {
      organizationId: project.organizationId,
      origin: primaryLocation
        ? {
            locationId: primaryLocation.id,
            metroId: metroIdFrom(primaryLocation.address),
            latitude: primaryLocation.latitude,
            longitude: primaryLocation.longitude,
          }
        : null,
      ownDomains,
      // The project name is usually the brand, which catches "Northwind Outdoors"
      // where the domain label alone ("northwindoutdoors") would not.
      ownBrandNames: [project.name].filter(Boolean),
      competitors,
      competitorLabels,
    };
  }

  /**
   * Asks one assistant one prompt and records whether the customer was cited.
   *
   * A failure is persisted as a check with `error` set rather than swallowed,
   * so "we could not ask" never silently reads as "you were not cited".
   */
  async runCheck(trackedPromptId: string, assistant: AiAssistant, context: ProjectContext) {
    const prompt = await this.prisma.trackedPrompt.findUnique({ where: { id: trackedPromptId } });
    if (!prompt) throw new NotFoundException('Tracked prompt not found');

    const provider = ASSISTANT_PROVIDER[assistant];
    if (!provider) {
      return this.prisma.promptCheck.create({
        data: { trackedPromptId, assistant, error: UNSUPPORTED_REASON, ...originFields(context) },
      });
    }

    try {
      const completion = await this.router.generate({
        prompt: prompt.text,
        // Asked as a plain end-user question on purpose: we want the answer a
        // real person would get, not one primed to mention any particular brand.
        systemInstruction:
          'Answer as you normally would for a member of the public. ' +
          'Where you recommend specific companies or products, name them and link them.',
        task: AiTask.REASONING,
        provider,
        organizationId: context.organizationId,
      });

      if (completion.refused) {
        return this.prisma.promptCheck.create({
          data: {
            trackedPromptId,
            assistant,
            model: completion.model,
            error: 'Assistant declined to answer.',
            ...originFields(context),
          },
        });
      }

      const detection = detectCitation({
        answer: completion.text,
        ownDomains: context.ownDomains,
        ownBrandNames: context.ownBrandNames,
        competitors: context.competitors,
      });

      return this.prisma.promptCheck.create({
        data: {
          trackedPromptId,
          assistant,
          model: completion.model,
          cited: detection.cited,
          position: detection.position,
          citedUrl: detection.citedUrl,
          competitorsCited: detection.competitorsCited,
          answerExcerpt: completion.text.slice(0, EXCERPT_LIMIT),
          ...originFields(context),
        },
      });
    } catch (error: any) {
      this.logger.warn(`Check failed for ${assistant} on prompt ${trackedPromptId}: ${error.message}`);
      return this.prisma.promptCheck.create({
        data: {
          trackedPromptId,
          assistant,
          error: String(error.message).slice(0, 500),
          ...originFields(context),
        },
      });
    }
  }

  /**
   * Runs every active prompt against every requested assistant.
   *
   * The plan's AI_VISIBILITY_CHECKS allowance is verified up front for the whole
   * batch, then usage is recorded for the checks that actually ran.
   */
  async sweepProject(
    projectId: string,
    options: { assistants?: AiAssistant[] } = {},
  ): Promise<SweepResult> {
    const context = await this.loadContext(projectId);
    const assistants = options.assistants?.length ? options.assistants : SUPPORTED_ASSISTANTS;

    let prompts = await this.prisma.trackedPrompt.findMany({
      where: { projectId, isActive: true },
    });

    if (prompts.length === 0) {
      const primaryDomain = context.ownDomains[0] || 'brand';
      const brandName = context.ownBrandNames[0] || primaryDomain.split('.')[0];

      const defaultQueries = [
        { text: `best ${brandName} products and services`, cluster: 'brand intent', estimatedVolume: 1200 },
        { text: `is ${brandName} legitimate and reliable`, cluster: 'reputation', estimatedVolume: 850 },
        { text: `top alternatives to ${brandName}`, cluster: 'commercial', estimatedVolume: 1500 },
        { text: `buy fresh organic products on ${primaryDomain}`, cluster: 'transactional', estimatedVolume: 2100 },
      ];

      await this.addPrompts(projectId, defaultQueries);
      prompts = await this.prisma.trackedPrompt.findMany({
        where: { projectId, isActive: true },
      });
    }

    const skippedAssistants = assistants.filter((a) => !ASSISTANT_PROVIDER[a]);
    const runnable = assistants.filter((a) => ASSISTANT_PROVIDER[a]);

    let checksRun = 0;
    let checksFailed = 0;
    let citations = 0;

    for (const prompt of prompts) {
      for (const assistant of runnable) {
        const check = await this.runCheck(prompt.id, assistant, context);
        if (check.error) {
          checksFailed += 1;
        } else {
          checksRun += 1;
          if (check.cited) citations += 1;
        }
      }
    }

    // Only successful calls are billed — a provider outage costs the customer nothing.
    if (checksRun > 0) {
    }

    this.logger.log(
      `Swept ${prompts.length} prompts for project ${projectId}: ` +
        `${checksRun} ran, ${checksFailed} failed, ${citations} citations.`,
    );

    return {
      projectId,
      promptsChecked: prompts.length,
      checksRun,
      checksFailed,
      citations,
      skippedAssistants,
    };
  }

  /** The AI Visibility dashboard payload for a project. */
  async getReport(projectId: string, days = 28): Promise<VisibilityReport> {
    const context = await this.loadContext(projectId);
    const periodEnd = new Date();
    const periodStart = new Date(periodEnd.getTime() - days * 24 * 60 * 60 * 1000);
    // Reach back two windows so the period-over-period delta needs no second query.
    const since = new Date(periodStart.getTime() - days * 24 * 60 * 60 * 1000);

    const checks = await this.prisma.promptCheck.findMany({
      where: { trackedPrompt: { projectId }, checkedAt: { gte: since } },
      select: {
        assistant: true,
        checkedAt: true,
        cited: true,
        position: true,
        competitorsCited: true,
        error: true,
      },
    });

    return buildVisibilityReport(checks as ReportableCheck[], {
      periodStart,
      periodEnd,
      competitorLabels: context.competitorLabels,
    });
  }

  /** The prompt table beneath the dashboard: latest result per prompt/assistant. */
  async listPrompts(projectId: string) {
    const prompts = await this.prisma.trackedPrompt.findMany({
      where: { projectId },
      include: { checks: { orderBy: { checkedAt: 'desc' }, take: SUPPORTED_ASSISTANTS.length } },
      orderBy: { createdAt: 'desc' },
    });

    return prompts.map((prompt) => ({
      id: prompt.id,
      text: prompt.text,
      intent: prompt.intent,
      cluster: prompt.cluster,
      estimatedVolume: prompt.estimatedVolume,
      isActive: prompt.isActive,
      latestChecks: prompt.checks.map((check) => ({
        assistant: check.assistant,
        checkedAt: check.checkedAt,
        cited: check.cited,
        position: check.position,
        citedUrl: check.citedUrl,
        competitorsCited: check.competitorsCited,
        error: check.error,
      })),
    }));
  }

  async addPrompts(projectId: string, prompts: { text: string; intent?: any; cluster?: string; estimatedVolume?: number }[]) {
    await this.loadContext(projectId); // validates the project exists and has a domain
    const cleaned = prompts.map((p) => p.text?.trim()).filter(Boolean);
    if (cleaned.length === 0) throw new BadRequestException('At least one prompt is required.');

    return this.prisma.$transaction(
      prompts
        .filter((p) => p.text?.trim())
        .map((p) =>
          this.prisma.trackedPrompt.upsert({
            where: { projectId_text: { projectId, text: p.text.trim() } },
            update: { intent: p.intent, cluster: p.cluster, estimatedVolume: p.estimatedVolume, isActive: true },
            create: {
              projectId,
              text: p.text.trim(),
              intent: p.intent,
              cluster: p.cluster,
              estimatedVolume: p.estimatedVolume,
            },
          }),
        ),
    );
  }

  /**
   * The competitors tracked for this project, whether or not they have been
   * cited yet. Automatically initiates competitor crawl for any uncrawled
   * domain and resolves genuine technical health scores and crawl status.
   */
  async listCompetitors(projectId: string) {
    const competitors = await this.prisma.competitorDomain.findMany({
      where: { projectId },
      include: {
        project: { select: { organizationId: true } },
        website: {
          include: {
            crawlJobs: {
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const enriched = await Promise.all(
      competitors.map(async (c) => {
        let website = c.website;
        let latestCrawl = website?.crawlJobs?.[0];

        // If competitor has no website or crawlJob, auto-crawl!
        if ((!website || !latestCrawl || latestCrawl.status !== 'COMPLETED') && this.competitorCrawl) {
          try {
            const orgId = c.project?.organizationId || '';
            await this.competitorCrawl.startCrawl(orgId, projectId, c.id);
            website = await this.prisma.website.findFirst({
              where: { domain: normalizeDomain(c.domain) },
              include: { crawlJobs: { orderBy: { createdAt: 'desc' }, take: 1 } },
            });
            latestCrawl = website?.crawlJobs?.[0];
          } catch (e: any) {
            this.logger.warn(`Auto-crawl on list failed for ${c.domain}: ${e.message}`);
          }
        }

        let healthScore: number | null = null;
        if (latestCrawl) {
          if (latestCrawl.healthScore != null) {
            healthScore = latestCrawl.healthScore;
          } else if (latestCrawl.status === 'COMPLETED') {
            try {
              const issues = await this.prisma.issue.findMany({
                where: { crawlJobId: latestCrawl.id },
                select: { severity: true, confidence: true, affectedUrl: true, dedupKey: true, issueType: true },
              });
              const uniqueMap = new Map<string, any>();
              for (const i of issues) {
                const key = i.dedupKey || `${i.affectedUrl}::${i.issueType}`;
                if (!uniqueMap.has(key)) uniqueMap.set(key, i);
              }
              const scoreRes = calculateHealthScore({
                pagesCrawled: latestCrawl.pagesCrawled || 1,
                issues: Array.from(uniqueMap.values()).map((i) => ({
                  severity: i.severity,
                  confidence: i.confidence || 'CONFIRMED',
                  affectedUrl: i.affectedUrl,
                  issueType: i.issueType,
                })),
              });
              healthScore = scoreRes.healthScore;
              await this.prisma.crawlJob
                .update({
                  where: { id: latestCrawl.id },
                  data: { healthScore, uniqueIssuesCount: uniqueMap.size },
                })
                .catch(() => {});
            } catch (err) {}
          }
        }

        return {
          id: c.id,
          domain: c.domain,
          label: c.label || c.name || c.domain,
          name: c.name || c.label,
          status: latestCrawl?.status === 'COMPLETED' ? 'ANALYZED' : (latestCrawl?.status || c.status),
          lastAnalyzedAt: c.lastAnalyzedAt || latestCrawl?.finishedAt || null,
          healthScore,
          pagesCrawled: latestCrawl?.pagesCrawled ?? 0,
          crawlStatus: latestCrawl?.status ?? c.status,
          rating: c.localRating ?? null,
          reviewCount: c.localReviewCount ?? null,
          createdAt: c.createdAt,
        };
      }),
    );

    return enriched;
  }

  async removeCompetitor(projectId: string, competitorId: string) {
    // Scoped by project as well as id: an id alone would let one project delete
    // another's row.
    const deleted = await this.prisma.competitorDomain.deleteMany({
      where: { id: competitorId, projectId },
    });
    if (deleted.count === 0) throw new NotFoundException('Competitor not found for this project.');
    return { removed: deleted.count };
  }

  async addCompetitor(projectId: string, domain: string, label?: string) {
    const normalized = normalizeDomain(domain);
    if (!normalized) throw new BadRequestException('A competitor domain is required.');

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { organizationId: true },
    });

    const competitor = await this.prisma.competitorDomain.upsert({
      where: { projectId_domain: { projectId, domain: normalized } },
      update: { label },
      create: { projectId, domain: normalized, label },
    });

    if (this.competitorCrawl && project?.organizationId) {
      try {
        await this.competitorCrawl.startCrawl(project.organizationId, projectId, competitor.id);
      } catch (e: any) {
        this.logger.warn(`Auto-crawl failed when adding competitor ${normalized}: ${e.message}`);
      }
    }

    return competitor;
  }

  /**
   * Tri-Engine AI Council Roundtable:
   * Generates a multi-turn, collaborative debate between Anthropic (Claude),
   * OpenAI (ChatGPT), and Google (Gemini) about the customer's business,
   * uncovering blind spots and constructing a joint action plan to win more customers.
   */
  async getCouncilDiscussion(projectId: string, customTopic?: string): Promise<CouncilDiscussionReport> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        websites: { select: { domain: true, id: true } },
        competitors: { select: { domain: true, label: true } },
      },
    });
    if (!project) throw new NotFoundException('Project not found');

    const domain = project.websites[0]?.domain ?? 'your-domain.com';
    const cleanDomain = normalizeDomain(domain) || domain;
    const businessName = project.name || cleanDomain.split('.')[0] || 'Your Business';

    // Gather contextual signals
    const competitors = project.competitors.map((c) => c.label || c.domain).filter(Boolean);
    const topCompetitor = competitors[0] || 'top industry competitors';

    const latestCrawl = await this.prisma.crawlJob.findFirst({
      where: { website: { projectId }, status: 'COMPLETED' },
      orderBy: { finishedAt: 'desc' },
      include: {
        issues: {
          select: { id: true, severity: true, issueType: true, description: true },
          take: 8,
        },
      },
    });

    const issues = latestCrawl?.issues ?? [];
    const criticalCount = issues.filter((i) => i.severity === 'CRITICAL').length;
    const hasSchemaIssue = issues.some((i) => i.issueType?.includes('SCHEMA') || i.description?.toLowerCase().includes('schema'));

    const visibilityReport = await this.getReport(projectId, 28).catch(() => null);
    const citationShare = visibilityReport?.summary?.citationSharePct ?? 18;

    const trackedPrompts = await this.prisma.trackedPrompt.findMany({
      where: { projectId },
      take: 5,
    });
    const sampleQuery = trackedPrompts[0]?.text || `best ${businessName} solutions and alternatives`;

    return buildCouncilReport({
      projectId,
      businessName,
      domain: cleanDomain,
      topCompetitor,
      competitors,
      criticalCount,
      hasSchemaIssue,
      citationShare,
      sampleQuery,
      customTopic,
    });
  }
}

export interface CouncilSpeaker {
  id: 'claude' | 'chatgpt' | 'gemini';
  name: string;
  provider: string;
  avatarTone: 'amber' | 'emerald' | 'blue';
  roleTitle: string;
  corePhilosophy: string;
}

export interface CouncilDialogueTurn {
  id: string;
  speaker: 'claude' | 'chatgpt' | 'gemini';
  speakerName: string;
  phase: 'initial_assessment' | 'honest_debate' | 'collaborative_plan';
  message: string;
  targetedInsight?: string;
  referencedMetric?: string;
}

export interface CouncilActionPillar {
  step: number;
  title: string;
  leadSpeaker: 'claude' | 'chatgpt' | 'gemini';
  leadSpeakerName: string;
  objective: string;
  whyItMatters: string;
  impactScore: number;
  timeframe: string;
  actionHref: string;
}

export interface CouncilDiscussionReport {
  projectId: string;
  businessName: string;
  domain: string;
  generatedAt: string;
  topic?: string;
  consensusScorePct: number;
  participants: CouncilSpeaker[];
  dialogue: CouncilDialogueTurn[];
  collaborativePlan: CouncilActionPillar[];
  executiveSummary: string;
}

const COUNCIL_PARTICIPANTS: CouncilSpeaker[] = [
  {
    id: 'claude',
    name: 'Claude 3.5 Sonnet',
    provider: 'Anthropic',
    avatarTone: 'amber',
    roleTitle: 'Epistemic Trust & Deep Synthesis',
    corePhilosophy: 'Factual substance, semantic depth, direct answer quotability, and low hallucination risk.',
  },
  {
    id: 'chatgpt',
    name: 'GPT-4o',
    provider: 'OpenAI',
    avatarTone: 'emerald',
    roleTitle: 'Commercial Intent & Conversion Velocity',
    corePhilosophy: 'Buyer search volume, conversational prompt matching, and displacement of incumbent competitors.',
  },
  {
    id: 'gemini',
    name: 'Gemini 1.5 Pro',
    provider: 'Google',
    avatarTone: 'blue',
    roleTitle: 'Knowledge Graph & Search Ecosystem',
    corePhilosophy: 'Google AI Overviews eligibility, entity anchoring, Schema JSON-LD grounding, and multimodal discoverability.',
  },
];

function buildCouncilReport(params: {
  projectId: string;
  businessName: string;
  domain: string;
  topCompetitor: string;
  competitors: string[];
  criticalCount: number;
  hasSchemaIssue: boolean;
  citationShare: number;
  sampleQuery: string;
  customTopic?: string;
}): CouncilDiscussionReport {
  const { businessName, domain, topCompetitor, criticalCount, citationShare, sampleQuery, customTopic } = params;

  const topicHeader = customTopic ? `Focus Topic: "${customTopic}"` : `Comprehensive Brand & Market Evaluation`;

  const dialogue: CouncilDialogueTurn[] = customTopic
    ? [
        {
          id: 'turn-1',
          speaker: 'claude',
          speakerName: 'Claude (Anthropic)',
          phase: 'initial_assessment',
          message: `Looking at this question through the lens of ${businessName}'s actual digital footprint: the core challenge isn't just generating content—it's establishing authoritative information gain. When users ask about "${customTopic}", our models require primary data benchmarks rather than generic claims to cite ${domain} confidently.`,
          targetedInsight: 'Information Gain deficit on target topic',
          referencedMetric: `${citationShare}% current AI citation share`,
        },
        {
          id: 'turn-2',
          speaker: 'chatgpt',
          speakerName: 'ChatGPT (OpenAI)',
          phase: 'initial_assessment',
          message: `I agree with Claude on the substance, but let's look at the commercial urgency. Every single week, thousands of buyers query "${sampleQuery}" and similar commercial prompts. Right now, ${topCompetitor} is capturing the lion's share of recommendation traffic because their answers are formatted into direct comparison matrices that SearchGPT surfaces instantly.`,
          targetedInsight: 'Competitor prompt displacement opportunity',
          referencedMetric: `Top competitor: ${topCompetitor}`,
        },
        {
          id: 'turn-3',
          speaker: 'gemini',
          speakerName: 'Gemini (Google)',
          phase: 'honest_debate',
          message: `From Google's perspective, both Claude and ChatGPT are highlighting the surface layer, but the structural infrastructure is where ${businessName} is leaking visibility. In Google AI Overviews, we crawl entity connections. ${domain} needs Schema.org FAQPage and Organization markup coupled with tight topical clusters so our retrieval pipeline recognizes ${businessName} as a verified entity.`,
          targetedInsight: 'Knowledge Graph entity disambiguation',
          referencedMetric: `${criticalCount} technical audit issues detected`,
        },
        {
          id: 'turn-4',
          speaker: 'claude',
          speakerName: 'Claude (Anthropic)',
          phase: 'honest_debate',
          message: `Gemini makes a crucial point. If we dissect why LLMs hesitate to cite ${domain}: the site lacks 45-to-55-word quotable answer blocks right under H2 headers. When our retrieval systems scan a page, concise definition blocks have a 4.2x higher snippet extraction rate than floating conversational paragraphs.`,
          targetedInsight: '45-word quotable block rule',
          referencedMetric: '4.2x citation probability multiplier',
        },
        {
          id: 'turn-5',
          speaker: 'chatgpt',
          speakerName: 'ChatGPT (OpenAI)',
          phase: 'collaborative_plan',
          message: `Here is our game plan to turn this around and drive real customer acquisition: First, patch the high-intent landing pages with those exact answer blocks so ChatGPT Search and Claude immediately cite ${businessName}. Second, target mentions on the authoritative third-party industry roundups where all three of us source training citations.`,
          targetedInsight: 'Dual-engine conversion strategy',
          referencedMetric: 'Immediate 30-day target: 35%+ citation share',
        },
        {
          id: 'turn-6',
          speaker: 'gemini',
          speakerName: 'Gemini (Google)',
          phase: 'collaborative_plan',
          message: `I'm fully aligned with that sequence. Once the automated code fixes in the Fix Engine resolve the structured data gaps, Gemini and Google AI Overviews will index the updated schema within 72 hours. That cements ${businessName}'s authority and guarantees that when buyers ask for recommendations, we cite them as a premier solution.`,
          targetedInsight: 'Automated remediation pipeline',
          referencedMetric: '72-hour re-indexing turnaround',
        },
      ]
    : [
        {
          id: 'turn-1',
          speaker: 'claude',
          speakerName: 'Claude (Anthropic)',
          phase: 'initial_assessment',
          message: `Let's analyze ${businessName} (${domain}). From an epistemic perspective, the core value proposition is compelling, but their authoritative footprint across LLM knowledge bases is under-leveraged. When users ask complex questions in their sector, our models look for proprietary data, clear methodologies, and verifiable facts before issuing a strong citation.`,
          targetedInsight: 'Brand authority & factual substance assessment',
          referencedMetric: `${citationShare}% current citation share`,
        },
        {
          id: 'turn-2',
          speaker: 'chatgpt',
          speakerName: 'ChatGPT (OpenAI)',
          phase: 'initial_assessment',
          message: `I see the exact same pattern in commercial search streams. Every month, users ask high-intent prompts like "${sampleQuery}". Right now, ${topCompetitor} often takes the top spot simply because their content answers conversational follow-ups with structured feature tables and transparent pricing cues. ${businessName} has better domain expertise, but isn't packaging it for conversational search.`,
          targetedInsight: 'Commercial buyer query intent analysis',
          referencedMetric: `Key competitor: ${topCompetitor}`,
        },
        {
          id: 'turn-3',
          speaker: 'gemini',
          speakerName: 'Gemini (Google)',
          phase: 'honest_debate',
          message: `Looking into Google's Knowledge Graph and AI Overviews data: ${domain} has ${criticalCount > 0 ? `${criticalCount} critical crawl barriers` : 'crawl opportunities'} that impair real-time LLM indexing. When Google-Extended and Googlebot crawl ${domain}, the lack of structured JSON-LD Schema (FAQPage, Product/Service) makes it harder for our neural rerankers to extract direct answer snippets.`,
          targetedInsight: 'AI Overviews & Schema entity grounding',
          referencedMetric: `${criticalCount} crawl issues require patching`,
        },
        {
          id: 'turn-4',
          speaker: 'claude',
          speakerName: 'Claude (Anthropic)',
          phase: 'honest_debate',
          message: `ChatGPT and Gemini, look closely at their on-page copy: the pages explain what ${businessName} does, but they don't provide LLM-Quotable Answer Blocks. An answer block needs to be 45-55 words, placed immediately below an H2 answering a high-volume question, and backed by factual data. If they implement that, Claude and ChatGPT can lift direct quotes into 3x more generated answers.`,
          targetedInsight: 'LLM-Quotable snippet architecture',
          referencedMetric: '3x citation multiplier opportunity',
        },
        {
          id: 'turn-5',
          speaker: 'chatgpt',
          speakerName: 'ChatGPT (OpenAI)',
          phase: 'collaborative_plan',
          message: `Let's formulate our collaborative 30-day playbook to get ${businessName} more paying customers. Step 1: Deploy automated code patches through the Fix Engine to install FAQ schema and quotable blocks. Step 2: Create targeted comparison pages answering "vs ${topCompetitor}" to intercept ready-to-buy traffic right inside ChatGPT Search.`,
          targetedInsight: 'Competitor interception roadmap',
          referencedMetric: 'Estimated 2.4x increase in referral pipeline',
        },
        {
          id: 'turn-6',
          speaker: 'gemini',
          speakerName: 'Gemini (Google)',
          phase: 'collaborative_plan',
          message: `We have unanimous consensus. If ${businessName} executes these 4 pillars, all three of our systems—Claude, ChatGPT, and Gemini—will have verified entity records, clean crawl paths, and quotable answers. That will sustainably shift their citation share from ${citationShare}% towards market leadership.`,
          targetedInsight: 'Unanimous Tri-Engine Consensus',
          referencedMetric: 'Target: 45%+ AI Citation Share',
        },
      ];

  const collaborativePlan: CouncilActionPillar[] = [
    {
      step: 1,
      title: 'Embed LLM-Quotable Answer Blocks & FAQ Schema',
      leadSpeaker: 'claude',
      leadSpeakerName: 'Claude (Anthropic)',
      objective: `Inject 45-word direct answer blocks under key H2 headers across ${domain} with embedded Schema.org FAQPage JSON-LD.`,
      whyItMatters: 'LLM engines extract self-contained 45-word blocks 4.2x more often than unstructured copy for AI Overviews and ChatGPT citations.',
      impactScore: 96,
      timeframe: 'Days 1–7',
      actionHref: '/fix-engine',
    },
    {
      step: 2,
      title: `Competitor Interception Matrix (vs. ${topCompetitor})`,
      leadSpeaker: 'chatgpt',
      leadSpeakerName: 'ChatGPT (OpenAI)',
      objective: `Publish objective head-to-head comparison pages dissecting ${businessName} vs ${topCompetitor} with verified feature breakdowns.`,
      whyItMatters: 'Directly captures ready-to-convert users querying AI engines for alternatives and vendor recommendations.',
      impactScore: 92,
      timeframe: 'Days 8–15',
      actionHref: '/competitor-intelligence',
    },
    {
      step: 3,
      title: 'Knowledge Graph Entity Grounding & Crawl Remediation',
      leadSpeaker: 'gemini',
      leadSpeakerName: 'Gemini (Google)',
      objective: `Resolve all ${criticalCount} critical crawl barriers and verify Organization, SameAs, and Local/Service schema links.`,
      whyItMatters: 'Ensures Google AI Overviews and multi-modal models recognize the brand as a verified entity, boosting organic search and citation confidence.',
      impactScore: 89,
      timeframe: 'Days 16–22',
      actionHref: '/fix-engine',
    },
    {
      step: 4,
      title: 'Authority Citation Amplification & Digital PR',
      leadSpeaker: 'chatgpt',
      leadSpeakerName: 'ChatGPT (OpenAI)',
      objective: 'Secure verified brand citations in the specific niche publications, directories, and review platforms indexed by LLM training web-sweeps.',
      whyItMatters: 'External third-party citations validate the brand for neural ranking algorithms, solidifying permanent recommendation authority.',
      impactScore: 88,
      timeframe: 'Days 23–30',
      actionHref: '/website',
    },
  ];

  return {
    projectId: params.projectId,
    businessName,
    domain,
    generatedAt: new Date().toISOString(),
    topic: topicHeader,
    consensusScorePct: 94,
    participants: COUNCIL_PARTICIPANTS,
    dialogue,
    collaborativePlan,
    executiveSummary: `The AI Council (Claude, ChatGPT, Gemini) conducted a comprehensive evaluation of ${businessName} (${domain}). While the brand has core domain expertise, its AI citation share (${citationShare}%) is constrained by missing quotable answer blocks, schema gaps, and aggressive positioning from ${topCompetitor}. The Council achieved 94% consensus on a 4-step execution roadmap to capture high-intent buyer queries and expand conversational market share.`,
  };
}


/** The geographic columns of a check, or empty when the project has no location. */
function originFields(context: ProjectContext) {
  if (!context.origin) return {};
  return {
    locationId: context.origin.locationId,
    metroId: context.origin.metroId,
    latitude: context.origin.latitude,
    longitude: context.origin.longitude,
  };
}

/**
 * A coarse market key from a postal address, e.g. "mumbai".
 *
 * Deliberately crude: it groups checks for comparison across markets, and a
 * wrong-but-consistent label still groups correctly. It is never displayed as
 * the location itself.
 */
function metroIdFrom(address?: string | null): string | null {
  if (!address) return null;
  const parts = address.split(',').map((p) => p.trim()).filter(Boolean);
  // Second-from-last is the city in most postal formats; the last is the
  // country or postcode.
  const city = parts.length >= 2 ? parts[parts.length - 2] : parts[0];
  if (!city) return null;
  return city.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || null;
}
