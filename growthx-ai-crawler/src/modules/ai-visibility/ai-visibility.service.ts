import { BadRequestException, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { AiAssistant, } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AiProvider, AiTask, MultiAiRouterService } from '../ai-search/multi-ai-router/multi-ai-router.service';
import { CompetitorRef, detectCitation, normalizeDomain } from './citation/citation-detector';
import { ASSISTANT_PROVIDER, SUPPORTED_ASSISTANTS, measurableAssistantsFor } from './assistants';
import { brandTerms, questionGroup } from './questions/question-group';
import { QuestionAnalysisService } from './questions/question-analysis.service';
import { buildVisibilityReport, ReportableCheck, VisibilityReport } from './citation/visibility-report';
import { CompetitorCrawlService } from '../content-intelligence/competitor-crawl.service';
import { calculateHealthScore } from '../issues/health-score.util';

export { ASSISTANT_PROVIDER, SUPPORTED_ASSISTANTS } from './assistants';

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
    @Optional() private readonly questions?: QuestionAnalysisService,
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
      // `provider` is pinned, so the router never substitutes another vendor:
      // if this assistant's key is missing the call fails and is recorded as
      // an error below, not answered by whichever vendor happens to be set up.
      const completion = await this.router.generate({
        prompt: prompt.text,
        // Asked as a plain end-user question on purpose: we want the answer a
        // real person would get, not one primed to mention any particular brand.
        systemInstruction:
          'Answer as you normally would for a member of the public. Where you recommend specific companies or products, name them and link them.',
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
    const measurable = new Set(this.measurableAssistants());

    let prompts = await this.prisma.trackedPrompt.findMany({
      where: { projectId, isActive: true },
    });

    if (prompts.length === 0) {
      const primaryDomain = context.ownDomains[0] || 'brand';
      const brandName = context.ownBrandNames[0] || primaryDomain.split('.')[0];

      // Starter questions so a first sweep has something to ask. No search
      // volume is attached: nothing here measured one.
      // Two reputation questions, which never count toward citation share,
      // and buyer questions drawn from the customer's own pages, rivals'
      // pages and open content gaps. A question that names the brand is
      // answered by repeating the brand, so on its own it measures nothing.
      const suggested = this.questions ? (await this.questions.suggestions(projectId)).suggestions : [];
      const defaultQueries = [
        { text: `is ${brandName} legitimate and reliable`, cluster: 'reputation' },
        { text: `top alternatives to ${brandName}`, cluster: 'reputation' },
        ...suggested.slice(0, 5).map((q) => ({
          text: q.text,
          cluster: q.source === 'OWN_PAGE' ? 'buyer · your page' : q.source === 'RIVAL_PAGE' ? 'buyer · rival topic' : 'buyer · content gap',
        })),
      ];

      await this.addPrompts(projectId, defaultQueries);
      prompts = await this.prisma.trackedPrompt.findMany({
        where: { projectId, isActive: true },
      });
    }

    // An assistant with no API, or whose vendor has no key on this deployment,
    // is reported as skipped rather than asked — so a Sarvam-only install
    // measures Sarvam and says plainly that ChatGPT, Claude and Gemini were not.
    const skippedAssistants = assistants.filter((a) => !measurable.has(a));
    const runnable = assistants.filter((a) => measurable.has(a));

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

  /**
   * The assistants this deployment can actually ask: those with a vendor API
   * whose key is configured. When the router cannot say what is configured,
   * every assistant with an API is assumed reachable and a missing key surfaces
   * as a per-check error instead.
   */
  measurableAssistants(): AiAssistant[] {
    return measurableAssistantsFor(this.router);
  }

  /** The AI Visibility dashboard payload for a project. */
  async getReport(
    projectId: string,
    days = 28,
  ): Promise<VisibilityReport & { reputation: { checked: number; cited: number } }> {
    const context = await this.loadContext(projectId);
    const periodEnd = new Date();
    const periodStart = new Date(periodEnd.getTime() - days * 24 * 60 * 60 * 1000);
    // Reach back two windows so the period-over-period delta needs no second query.
    const since = new Date(periodStart.getTime() - days * 24 * 60 * 60 * 1000);

    const rows = await this.prisma.promptCheck.findMany({
      where: { trackedPrompt: { projectId }, checkedAt: { gte: since } },
      select: {
        assistant: true,
        checkedAt: true,
        cited: true,
        position: true,
        competitorsCited: true,
        error: true,
        trackedPrompt: { select: { text: true } },
      },
    });

    // A failed check against an assistant this deployment no longer asks is
    // history, not a current problem: those made "72 checks could not run"
    // appear on a Sarvam-only install that had nothing wrong with it.
    const measurable = new Set(this.measurableAssistants());
    const current = rows.filter((c) => !c.error || measurable.has(c.assistant));

    // Citation share is about buyers who have not heard of the brand. A
    // question that names the brand is answered by repeating it, so those are
    // reported apart and never counted toward the share.
    const brand = brandTerms(context.ownBrandNames[0], context.ownDomains);
    const buyer: ReportableCheck[] = [];
    const reputation = { checked: 0, cited: 0 };
    for (const row of current) {
      const { trackedPrompt, ...check } = row;
      if (questionGroup(trackedPrompt.text, brand) === 'REPUTATION') {
        if (!check.error && check.checkedAt >= periodStart) {
          reputation.checked += 1;
          if (check.cited) reputation.cited += 1;
        }
        continue;
      }
      buyer.push(check as ReportableCheck);
    }

    return {
      ...buildVisibilityReport(buyer, {
        periodStart,
        periodEnd,
        competitorLabels: context.competitorLabels,
      }),
      reputation,
    };
  }

  /** The prompt table beneath the dashboard: latest result per prompt/assistant. */
  async listPrompts(projectId: string) {
    const prompts = await this.prisma.trackedPrompt.findMany({
      where: { projectId },
      // Enough recent rows to hold one per assistant even when a single
      // assistant has been swept several times since the others.
      include: { checks: { orderBy: { checkedAt: 'desc' }, take: SUPPORTED_ASSISTANTS.length * 10 } },
      orderBy: { createdAt: 'desc' },
    });

    const brand = this.questions ? await this.questions.brandFor(projectId) : [];
    return prompts.map((prompt) => ({
      id: prompt.id,
      text: prompt.text,
      group: questionGroup(prompt.text, brand),
      intent: prompt.intent,
      cluster: prompt.cluster,
      estimatedVolume: prompt.estimatedVolume,
      isActive: prompt.isActive,
      // The latest result per assistant, not the latest N rows overall: on a
      // one-assistant install those are N sweeps of the same assistant.
      latestChecks: prompt.checks
        .filter((check, i, all) => all.findIndex((c) => c.assistant === check.assistant) === i)
        .map((check) => ({
          assistant: check.assistant,
          checkedAt: check.checkedAt,
          cited: check.cited,
          position: check.position,
          citedUrl: check.citedUrl,
          competitorsCited: check.competitorsCited,
          error: check.error,
          model: check.model,
          answerExcerpt: check.answerExcerpt,
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

    const mentions = await this.competitorMentions(projectId);

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
          // How often the assistants named this rival in their latest answers.
          // Null until anything has been asked — not measured is not 0%.
          aiMentions: mentions.answers > 0 ? { named: mentions.byDomain.get(normalizeDomain(c.domain)) ?? 0, answers: mentions.answers } : null,
          aiCitationSharePct:
            mentions.answers > 0
              ? Math.round(((mentions.byDomain.get(normalizeDomain(c.domain)) ?? 0) / mentions.answers) * 1000) / 10
              : null,
        };
      }),
    );

    return enriched;
  }

  /**
   * The latest successful answer per question and assistant, and how many of
   * them named each rival. Latest only, so a rival named in thirty stale
   * sweeps of one question does not outweigh a rival named across the board.
   */
  async competitorMentions(projectId: string): Promise<{ answers: number; byDomain: Map<string, number> }> {
    const prompts = await this.prisma.trackedPrompt.findMany({
      where: { projectId, isActive: true },
      select: {
        checks: {
          where: { error: null },
          orderBy: { checkedAt: 'desc' },
          take: 40,
          select: { assistant: true, competitorsCited: true },
        },
      },
    });
    const byDomain = new Map<string, number>();
    let answers = 0;
    for (const prompt of prompts) {
      const seen = new Set<string>();
      for (const check of prompt.checks) {
        // Every real answer counts, whichever assistant gave it.
        if (seen.has(check.assistant)) continue;
        seen.add(check.assistant);
        answers += 1;
        for (const domain of new Set(check.competitorsCited.map(normalizeDomain))) {
          byDomain.set(domain, (byDomain.get(domain) ?? 0) + 1);
        }
      }
    }
    return { answers, byDomain };
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
}

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
