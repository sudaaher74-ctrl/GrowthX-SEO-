import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { AutopilotRun } from '@prisma/client';
import { crawlToShow } from '../crawler/crawl-selection';
import { OWN_SCOPE, competitorScope, websiteKey } from '../crawler/website-scope';
import { PrismaService } from '../../database/prisma.service';
import { OrgContextService } from '../organizations/org-context.service';
import { CrawlerService } from '../crawler/crawler.service';
import { FetchService } from '../crawler/fetch/fetch.service';
import { AiProvider, AiRequest, AiTask, MultiAiRouterService } from '../ai-search/multi-ai-router/multi-ai-router.service';
import { extractAndParseJson } from '../ai-engine/utils/json-extractor.util';
import { CompetitorCrawlService } from '../content-intelligence/competitor-crawl.service';
import { CompetitorIntelReportService } from '../competitor-action-engine/competitor-intel-report.service';
import { MAX_COMPETITORS } from '../competitor-action-engine/competitor-setup.service';
import { AuditReportService } from '../audit-report/audit-report.service';
import { VisibilityWorkflowService } from '../ai-visibility/visibility-workflow.service';
import { BacklinkDiscovery } from '../backlinks/backlink-discovery.service';
import { FindingSyncService } from '../opportunities/finding-sync.service';
import { OpportunityDetectionService } from '../opportunities/opportunity-detection.service';
import {
  CompetitorSuggestion,
  FINDER_SCHEMA,
  buildFinderPrompt,
  filterCandidates,
  normaliseCandidate,
  summariseHomepage,
} from './competitor-finder';

/** Matches the Website Audit page's Re-crawl button. */
const OWN_SITE_CRAWL = { maxDepth: 20, maxConcurrency: 10, useSitemap: true };
/** A crawl this recent is used as it is rather than run again. */
const FRESH_OWN_CRAWL_MS = 24 * 60 * 60 * 1000;
const FRESH_RIVAL_CRAWL_MS = 7 * 24 * 60 * 60 * 1000;
const FORCE_REFRESH_DEBOUNCE_MS = 10 * 60 * 1000;
const FRESH_AI_VISIBILITY_MS = 24 * 60 * 60 * 1000;
const FRESH_BACKLINKS_MS = 6 * 60 * 60 * 1000;
/** Past this, the report is written from whatever has finished. */
const CRAWL_WAIT_MS = 60 * 60 * 1000;
const SUGGESTIONS_KEPT = 5;
/**
 * How many of the suggestions the customer picks. Five are offered and two or
 * three are kept: enough to compare against, few enough that every one gets
 * crawled and read properly. More can be added later from Competitor
 * Intelligence.
 */
export const PICK_LIMIT = 3;
const ACTIVE = ['DISCOVERING', 'AWAITING_CONFIRMATION', 'RUNNING'];

export interface ConfirmedCompetitor {
  domain: string;
  name: string;
  competitorId: string;
}

export interface AutopilotSite {
  domain: string;
  name: string;
  role: 'you' | 'competitor';
  /** PENDING | RUNNING | COMPLETED | FAILED | CANCELLED, or NONE before a crawl exists. */
  crawl: string;
  pagesCrawled: number;
}

export interface PipelineStage {
  id: 'WEBSITE' | 'COMPETITORS' | 'AI_VISIBILITY' | 'BACKLINKS' | 'FIX_ENGINE';
  label: string;
  status: 'PENDING' | 'RUNNING' | 'WAITING' | 'DONE' | 'FAILED';
  detail: string;
  href: string;
}

export interface AutopilotView {
  id: string;
  projectId: string;
  domain: string;
  status: string;
  step: string;
  suggestions: Array<CompetitorSuggestion & { tracked?: boolean }>;
  competitors: ConfirmedCompetitor[];
  sites: AutopilotSite[];
  stages?: PipelineStage[];
  log: Array<{ at: string; message: string }>;
  error: string | null;
  reportReady: boolean;
  startedAt: string;
  finishedAt: string | null;
}

/** The form a website's domain is stored and looked up under (same as registration). */
function websiteDomain(input: string): string {
  return (input ?? '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/[/?#].*$/, '');
}

/**
 * The voice autopilot: from "my website is brandkettle.co.in, find my
 * competitors" to a finished competitor report, with one confirmation from
 * the customer in between.
 *
 *   SETUP            project and website created or found, own crawl started
 *   FIND_COMPETITORS homepage read, competitors named and each site checked
 *   CONFIRM          waits for the customer to say which are real
 *   CRAWL_SITES      competitors added and crawled; waits for every crawl
 *   REPORT           the full competitor report written and stored
 *
 * Every step is written to the database, and the scheduler moves runs on, so
 * it carries on with nobody watching and picks up again after a restart.
 */
@Injectable()
export class AutopilotService {
  private readonly logger = new Logger(AutopilotService.name);
  private readonly busy = new Set<string>();
  /** Discovery in progress, so a second call waits for it instead of starting another. */
  private readonly discovering = new Map<string, Promise<void>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly orgContext: OrgContextService,
    private readonly crawler: CrawlerService,
    private readonly fetcher: FetchService,
    private readonly router: MultiAiRouterService,
    private readonly competitorCrawl: CompetitorCrawlService,
    private readonly report: CompetitorIntelReportService,
    private readonly auditReport: AuditReportService,
    @Optional() private readonly moduleRef?: ModuleRef,
    @Optional() private readonly visibilityWorkflow?: VisibilityWorkflowService,
    @Optional() private readonly backlinkDiscovery?: BacklinkDiscovery,
    @Optional() private readonly findingSync?: FindingSyncService,
    @Optional() private readonly opportunityDetection?: OpportunityDetectionService,
  ) {}

  private resolveOptional<T>(direct: T | undefined, token: new (...args: any[]) => T): T | undefined {
    if (direct) return direct;
    try {
      return this.moduleRef?.get(token, { strict: false });
    } catch {
      return undefined;
    }
  }

  // ─── Start ──────────────────────────────────────────────────────────────────

  async start(input: {
    userId: string;
    organizationId: string;
    domain: string;
    projectId?: string | null;
    forceRefresh?: boolean;
  }): Promise<AutopilotView> {
    const domain = websiteDomain(input.domain);
    if (!normaliseCandidate(domain)) throw new BadRequestException(`"${input.domain}" doesn't look like a website address.`);
    await this.orgContext.assertCanWrite(input.userId, input.organizationId);

    const { projectId, websiteId } = await this.resolveProject(input.organizationId, input.userId, domain, input.projectId);

    const active = await this.prisma.autopilotRun.findFirst({
      where: { projectId, status: { in: ACTIVE } },
      orderBy: { startedAt: 'desc' },
    });
    if (active) return this.view(active);

    const ownCrawlJobId = await this.ensureOwnCrawl(websiteId, Boolean(input.forceRefresh));

    // Zero-touch full refresh: when explicitly requested on a project that already has
    // tracked competitors, skip re-confirming rivals and launch the full parallel pipeline.
    if (input.forceRefresh) {
      const tracked = await this.prisma.competitorDomain.findMany({
        where: { projectId },
        select: { id: true, domain: true, name: true, label: true },
        take: PICK_LIMIT,
      });

      if (tracked.length > 0) {
        const competitors: ConfirmedCompetitor[] = [];
        const logMessages: string[] = [
          `Started full workspace pipeline for ${domain}.`,
          ownCrawlJobId ? `Started reading ${domain}.` : `Using the recent read of ${domain}.`,
        ];

        for (const rival of tracked) {
          const name = rival.name || rival.label || rival.domain;
          competitors.push({ domain: rival.domain, name, competitorId: rival.id });
          if (await this.rivalCrawlIsFresh(projectId, rival.domain, true)) {
            logMessages.push(`${name} was read minutes ago; reusing that crawl.`);
            continue;
          }
          try {
            await this.competitorCrawl.startCrawl(input.organizationId, projectId, rival.id);
            logMessages.push(`Started reading ${name}'s website.`);
          } catch (err) {
            logMessages.push(`Couldn't start reading ${name}: ${(err as Error).message}`);
          }
        }

        const parallelLogs = await this.launchParallelIntelligence(projectId, true);
        logMessages.push(...parallelLogs);

        const run = await this.prisma.autopilotRun.create({
          data: {
            projectId,
            organizationId: input.organizationId,
            userId: input.userId,
            domain,
            status: 'RUNNING',
            step: 'CRAWL_SITES',
            ownCrawlJobId,
            competitors: competitors as any,
            log: logMessages.map(entry) as any,
          },
        });
        return this.view(run);
      }
    }

    const run = await this.prisma.autopilotRun.create({
      data: {
        projectId,
        organizationId: input.organizationId,
        userId: input.userId,
        domain,
        status: 'DISCOVERING',
        step: 'FIND_COMPETITORS',
        ownCrawlJobId,
        log: [
          entry(`Set up ${domain}.`),
          entry(ownCrawlJobId ? `Started reading ${domain}.` : `Using the recent read of ${domain}.`),
          entry('Looking for your competitors.'),
        ],
      },
    });

    void this.discover(run.id);
    return this.view(run);
  }

  /**
   * The project this website belongs to: the caller's current one when it
   * already holds this site or has none yet, another of their projects that
   * holds it, or a new one. A domain another organization already owns is
   * refused, as the website registration route refuses it.
   */
  private async resolveProject(organizationId: string, userId: string, domain: string, projectId?: string | null) {
    // Somebody's own website only. A competitor record of the same domain is
    // another project's, with its crawls, and is never taken over.
    const existing = await this.prisma.website.findUnique({
      where: websiteKey(domain, OWN_SCOPE),
      select: { id: true, projectId: true, project: { select: { organizationId: true } } },
    });
    if (existing?.project && existing.project.organizationId !== organizationId) {
      throw new ForbiddenException(`${domain} is already registered to another account.`);
    }
    if (existing?.projectId) return { projectId: existing.projectId, websiteId: existing.id };

    let target: string | null = null;
    if (projectId) {
      const project = await this.prisma.project.findUnique({
        where: { id: projectId },
        select: { organizationId: true, websites: { select: { id: true }, take: 1 } },
      });
      if (!project) throw new NotFoundException('Project not found');
      await this.orgContext.assertMembership(userId, project.organizationId);
      if (project.organizationId === organizationId && project.websites.length === 0) target = projectId;
    }
    if (!target) {
      const empty = await this.prisma.project.findFirst({
        where: { organizationId, websites: { none: {} } },
        select: { id: true },
        orderBy: { createdAt: 'asc' },
      });
      target = empty?.id ?? (await this.prisma.project.create({ data: { name: domain, organization: { connect: { id: organizationId } } } })).id;
    }

    const website = await this.prisma.website.upsert({
      where: websiteKey(domain, OWN_SCOPE),
      update: { projectId: target },
      create: { domain, scope: OWN_SCOPE, url: `https://${domain}`, isVerified: false, projectId: target },
    });
    return { projectId: target, websiteId: website.id };
  }

  private async ensureOwnCrawl(websiteId: string, forceRefresh = false): Promise<string | null> {
    const latest = await this.prisma.crawlJob.findFirst({
      where: { websiteId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, status: true, finishedAt: true, createdAt: true },
    });
    if (latest && (latest.status === 'RUNNING' || latest.status === 'PENDING')) return latest.id;
    const freshnessWindow = forceRefresh ? FORCE_REFRESH_DEBOUNCE_MS : FRESH_OWN_CRAWL_MS;
    if (latest?.status === 'COMPLETED' && latest.finishedAt && Date.now() - latest.finishedAt.getTime() < freshnessWindow) {
      return null;
    }
    return this.crawler.startCrawlJob(websiteId, OWN_SITE_CRAWL);
  }

  /**
   * Launches AI Visibility and Backlink Discovery in parallel alongside rival crawls,
   * reusing fresh or in-progress runs so we never waste tokens or duplicate manual work.
   */
  private async launchParallelIntelligence(projectId: string, forceRefresh = false): Promise<string[]> {
    const logs: string[] = [];

    const visibility = this.resolveOptional(this.visibilityWorkflow, VisibilityWorkflowService);
    if (visibility && this.prisma.aiVisibilityJourney?.findFirst) {
      try {
        const latestJourney = await this.prisma.aiVisibilityJourney.findFirst({
          where: { projectId },
          orderBy: { createdAt: 'desc' },
          select: { id: true, status: true, updatedAt: true },
        });
        const isActive = latestJourney && ['QUEUED', 'PREPARING', 'CHECKING', 'PLANNING'].includes(latestJourney.status);
        const freshness = forceRefresh ? FORCE_REFRESH_DEBOUNCE_MS : FRESH_AI_VISIBILITY_MS;
        const isFresh =
          latestJourney?.status === 'COMPLETED' &&
          latestJourney.updatedAt &&
          Date.now() - latestJourney.updatedAt.getTime() < freshness;

        if (isActive) {
          logs.push('AI Visibility check is already running.');
        } else if (isFresh) {
          logs.push('Using recent AI Visibility results.');
        } else {
          await visibility.prepare(projectId);
          logs.push('Started AI Visibility journey in parallel.');
        }
      } catch (err) {
        logs.push(`AI Visibility skipped: ${(err as Error).message}`);
      }
    }

    const backlinks = this.resolveOptional(this.backlinkDiscovery, BacklinkDiscovery);
    if (backlinks && this.prisma.backlinkDiscoveryRun?.findFirst) {
      try {
        const latestRun = await this.prisma.backlinkDiscoveryRun.findFirst({
          where: { projectId },
          orderBy: { startedAt: 'desc' },
          select: { id: true, status: true, finishedAt: true },
        });
        const isActive = latestRun && ['PENDING', 'RUNNING'].includes(latestRun.status);
        const isFresh =
          latestRun?.finishedAt &&
          ['COMPLETED', 'PARTIAL'].includes(latestRun.status) &&
          Date.now() - latestRun.finishedAt.getTime() < FRESH_BACKLINKS_MS;

        if (isActive) {
          logs.push('Backlink discovery is already running.');
        } else if (isFresh) {
          logs.push('Using recent backlink discovery results.');
        } else {
          await backlinks.start(projectId);
          logs.push('Started backlink discovery in parallel.');
        }
      } catch (err) {
        logs.push(`Backlink discovery skipped: ${(err as Error).message}`);
      }
    }

    return logs;
  }

  // ─── Find competitors ─────────────────────────────────────────────────────────

  discover(runId: string): Promise<void> {
    const inFlight = this.discovering.get(runId);
    if (inFlight) return inFlight;
    const job = this.runDiscovery(runId)
      .catch((err) => this.logger.warn(`[autopilot ${runId}] discovery failed: ${(err as Error).message}`))
      .finally(() => this.discovering.delete(runId));
    this.discovering.set(runId, job);
    return job;
  }

  private async runDiscovery(runId: string): Promise<void> {
    {
      const run = await this.prisma.autopilotRun.findUnique({ where: { id: runId } });
      if (!run || run.status !== 'DISCOVERING') return;

      const tracked = await this.prisma.competitorDomain.findMany({
        where: { projectId: run.projectId },
        select: { domain: true, name: true, label: true },
      });
      let found: CompetitorSuggestion[] = [];
      try {
        found = await this.findCompetitors(run.domain, run.projectId, run.organizationId);
      } catch (err) {
        this.logger.warn(`[${run.domain}] competitor search failed: ${(err as Error).message}`);
      }

      const trackedDomains = new Set(tracked.map((t) => t.domain));
      const suggestions = [
        ...tracked.map((t) => ({ domain: t.domain, name: t.name || t.label || t.domain, reason: 'Already on your competitor list.', tracked: true })),
        ...found.filter((f) => !trackedDomains.has(f.domain)),
      ].slice(0, Math.max(SUGGESTIONS_KEPT, tracked.length));

      await this.prisma.autopilotRun.update({
        where: { id: runId },
        data: {
          status: 'AWAITING_CONFIRMATION',
          step: 'CONFIRM',
          suggestions: suggestions as any,
          log: append(
            run.log,
            suggestions.length
              ? `Found ${suggestions.length} likely competitor${suggestions.length === 1 ? '' : 's'}${foundByNote(found)}: ${suggestions.map((s) => s.name).join(', ')}. Pick up to ${PICK_LIMIT} to track.`
              : "Couldn't find competitors on my own. Tell me their websites and I'll carry on.",
          ),
        },
      });
    }
  }

  /** Reads the homepage, asks the model, then keeps only websites that answer. */
  async findCompetitors(domain: string, projectId: string, organizationId: string): Promise<CompetitorSuggestion[]> {
    let site = null;
    try {
      const res = typeof (this.fetcher as any).fetch === 'function'
        ? await this.fetcher.fetch(`https://${domain}`)
        : await (this.fetcher as any).fetchPage(`https://${domain}`, false);
      if (res.statusCode && res.statusCode >= 200 && res.statusCode < 400 && res.html) site = summariseHomepage(res.html);
    } catch {
      // Carry on with whatever the crawl knows.
    }
    const pages = await this.prisma.page.findMany({
      where: { crawlJob: { website: { domain, projectId, scope: OWN_SCOPE } }, title: { not: null } },
      select: { title: true },
      take: 40,
    });
    const titles = [...new Set(pages.map((p) => (p.title ?? '').trim()).filter(Boolean))];

    const { raw, model } = await this.askForCompetitors({
      prompt: buildFinderPrompt(domain, site, titles),
      systemInstruction: 'You identify real business competitors. Reply with valid JSON only.',
      task: AiTask.COMPETITOR_ANALYSIS,
      organizationId,
      projectId,
      maxTokens: 4000,
      jsonSchema: FINDER_SCHEMA,
    });
    const candidates = filterCandidates(raw, domain);

    const live: CompetitorSuggestion[] = [];
    for (const c of candidates) {
      if (live.length >= SUGGESTIONS_KEPT) break;
      if (await this.answers(c.domain)) live.push({ ...c, foundBy: model });
    }
    return live;
  }

  /**
   * Sarvam 105B first, then whatever else the router has.
   *
   * Sarvam is asked by name because it knows Indian businesses, and their
   * websites, better than the general-purpose chain's first choice. When it is
   * not configured, declines, or answers with something that is not JSON, the
   * normal chain is asked instead, so a Sarvam outage costs the customer a
   * slower answer rather than no answer.
   */
  private async askForCompetitors(request: AiRequest): Promise<{ raw: unknown; model: string | null }> {
    try {
      const completion = await this.router.generate({ ...request, provider: AiProvider.SARVAM });
      if (completion.refused) throw new Error('Sarvam declined');
      return { raw: extractAndParseJson<any>(completion.text), model: completion.model ?? null };
    } catch (err) {
      this.logger.warn(`Sarvam could not suggest competitors (${(err as Error).message}); asking the next available model.`);
    }
    const completion = await this.router.generate(request);
    return { raw: extractAndParseJson<any>(completion.text), model: completion.model ?? null };
  }

  /**
   * Competitors found after a project's first website audit, offered to the
   * customer rather than tracked unasked.
   *
   * The audit's discovery step used to add the top five on its own. Five
   * competitors picked by a model is a lot to crawl and a lot to read, and
   * only the customer knows which of them they actually lose sales to. So the
   * five become a question — the same one the autopilot asks — and confirming
   * two or three of them adds those, crawls them and writes the report.
   *
   * Returns null, and offers nothing, when the project already has a run in
   * progress (the customer started one themselves, and it owns the question)
   * or the organization has no member to attribute the run to.
   */
  async offerSuggestions(input: {
    projectId: string;
    organizationId: string;
    domain: string;
    suggestions: CompetitorSuggestion[];
  }): Promise<AutopilotRun | null> {
    const suggestions = input.suggestions.slice(0, SUGGESTIONS_KEPT);
    if (!suggestions.length) return null;

    const active = await this.prisma.autopilotRun.findFirst({
      where: { projectId: input.projectId, status: { in: ACTIVE } },
      select: { id: true },
    });
    if (active) return null;

    // The run is the customer's; the earliest owner stands in for "the
    // customer" when no one is signed in to start it.
    const member =
      (await this.prisma.organizationMember.findFirst({
        where: { organizationId: input.organizationId, role: 'OWNER' },
        orderBy: { createdAt: 'asc' },
        select: { userId: true },
      })) ??
      (await this.prisma.organizationMember.findFirst({
        where: { organizationId: input.organizationId },
        orderBy: { createdAt: 'asc' },
        select: { userId: true },
      }));
    if (!member) return null;

    return this.prisma.autopilotRun.create({
      data: {
        projectId: input.projectId,
        organizationId: input.organizationId,
        userId: member.userId,
        domain: input.domain,
        status: 'AWAITING_CONFIRMATION',
        step: 'CONFIRM',
        suggestions: suggestions as any,
        log: [
          entry(`Your website audit of ${input.domain} finished.`),
          entry(
            `Found ${suggestions.length} likely competitor${suggestions.length === 1 ? '' : 's'}${foundByNote(suggestions)}: ` +
              `${suggestions.map((s) => s.name).join(', ')}. Pick up to ${PICK_LIMIT} to track.`,
          ),
        ],
      },
    });
  }

  /** Whether a website exists and serves a page, so no invented site is ever offered. */
  protected async answers(domain: string): Promise<boolean> {
    try {
      const res = typeof (this.fetcher as any).fetch === 'function'
        ? await this.fetcher.fetch(`https://${domain}`)
        : await (this.fetcher as any).fetchPage(`https://${domain}`, false);
      return (res.statusCode ?? 0) >= 200 && (res.statusCode ?? 0) < 400;
    } catch {
      return false;
    }
  }

  // ─── Confirm ────────────────────────────────────────────────────────────────

  /**
   * The customer's answer: which competitors are real. Adds them, starts
   * reading their sites, and hands the run to the scheduler.
   */
  async confirm(runId: string, userId: string, domains: string[]): Promise<AutopilotView> {
    const run = await this.owned(runId, userId);
    await this.orgContext.assertCanWrite(userId, run.organizationId);
    if (run.status !== 'AWAITING_CONFIRMATION') {
      throw new BadRequestException(run.status === 'DISCOVERING' ? 'Still looking for competitors. One moment.' : 'This run has moved on already.');
    }
    const suggestions = (run.suggestions as any[]) ?? [];
    const chosen = [...new Set(domains.map(normaliseCandidate).filter((d): d is string => !!d))].filter(
      (d) => d !== normaliseCandidate(run.domain),
    );
    if (!chosen.length) throw new BadRequestException('Tell me at least one competitor website.');
    // A spoken "yes" confirms every suggestion; the first few — the strongest,
    // since suggestions are ranked — are the ones kept.
    const overPick = chosen.splice(PICK_LIMIT);

    const existing = await this.prisma.competitorDomain.findMany({ where: { projectId: run.projectId }, select: { id: true, domain: true } });
    const room = MAX_COMPETITORS - existing.filter((e) => !chosen.includes(e.domain)).length;
    const accepted = chosen.slice(0, Math.max(0, room));
    const dropped = chosen.slice(accepted.length);

    const competitors: ConfirmedCompetitor[] = [];
    const log: string[] = [];
    for (const domain of accepted) {
      const name = suggestions.find((s) => s.domain === domain)?.name ?? domain;
      const row = await this.prisma.competitorDomain.upsert({
        where: { projectId_domain: { projectId: run.projectId, domain } },
        update: {},
        create: { projectId: run.projectId, domain, name, label: name },
      });
      competitors.push({ domain, name, competitorId: row.id });
      if (await this.rivalCrawlIsFresh(run.projectId, domain)) {
        log.push(`${name} was read recently; using that.`);
        continue;
      }
      try {
        await this.competitorCrawl.startCrawl(run.organizationId, run.projectId, row.id);
        log.push(`Started reading ${name}'s website.`);
      } catch (err) {
        log.push(`Couldn't start reading ${name}: ${(err as Error).message}`);
      }
    }
    if (overPick.length) log.push(`Kept your first ${PICK_LIMIT}. Skipped ${overPick.join(', ')}; you can add more later from Competitor Intelligence.`);
    if (dropped.length) log.push(`Skipped ${dropped.join(', ')}: you can track up to ${MAX_COMPETITORS} competitors.`);

    const parallelLogs = await this.launchParallelIntelligence(run.projectId, false);
    log.push(...parallelLogs);

    const updated = await this.prisma.autopilotRun.update({
      where: { id: runId },
      data: {
        status: 'RUNNING',
        step: 'CRAWL_SITES',
        competitors: competitors as any,
        log: append(run.log, `You confirmed ${competitors.map((c) => c.name).join(', ')}.`, ...log),
      },
    });
    return this.view(updated);
  }

  /** Only a crawl this project ran itself counts: another customer's read of the same site is theirs. */
  private async rivalCrawlIsFresh(projectId: string, domain: string, forceRefresh = false): Promise<boolean> {
    const job = await this.prisma.crawlJob.findFirst({
      where: { website: { domain, scope: competitorScope(projectId) }, status: 'COMPLETED' },
      orderBy: { finishedAt: 'desc' },
      select: { finishedAt: true },
    });
    const windowMs = forceRefresh ? FORCE_REFRESH_DEBOUNCE_MS : FRESH_RIVAL_CRAWL_MS;
    return !!job?.finishedAt && Date.now() - job.finishedAt.getTime() < windowMs;
  }

  async cancel(runId: string, userId: string): Promise<AutopilotView> {
    const run = await this.owned(runId, userId);
    await this.orgContext.assertCanWrite(userId, run.organizationId);
    if (!ACTIVE.includes(run.status)) return this.view(run);
    const updated = await this.prisma.autopilotRun.update({
      where: { id: runId },
      data: { status: 'CANCELLED', finishedAt: new Date(), log: append(run.log, 'Stopped.') },
    });
    return this.view(updated);
  }

  // ─── Advance (called by the scheduler) ──────────────────────────────────────

  /** Moves every active run on by one step where it can. */
  async tick(now = new Date()): Promise<void> {
    const runs = await this.prisma.autopilotRun.findMany({ where: { status: { in: ['DISCOVERING', 'RUNNING'] } } });
    for (const run of runs) {
      try {
        if (run.status === 'DISCOVERING' && now.getTime() - run.updatedAt.getTime() > 3 * 60 * 1000) {
          // Discovery started in a process that has since restarted.
          await this.discover(run.id);
        } else if (run.status === 'RUNNING') {
          await this.advance(run, now);
        }
      } catch (err) {
        this.logger.warn(`[autopilot ${run.id}] ${(err as Error).message}`);
      }
    }
  }

  async advance(run: AutopilotRun, now = new Date()): Promise<void> {
    if (this.busy.has(run.id)) return;
    this.busy.add(run.id);
    try {
      const sites = await this.sites(run);
      const waiting = sites.filter((s) => s.crawl === 'PENDING' || s.crawl === 'RUNNING');
      const timedOut = now.getTime() - run.updatedAt.getTime() > CRAWL_WAIT_MS;
      if (waiting.length && !timedOut) return;

      await this.prisma.autopilotRun.update({
        where: { id: run.id },
        data: {
          step: 'REPORT',
          log: append(
            run.log,
            ...(waiting.length ? [`Still waiting on ${waiting.map((s) => s.name).join(', ')} after an hour; writing the report with what's ready.`] : []),
            ...sites.filter((s) => s.crawl === 'FAILED').map((s) => `Couldn't read ${s.name}'s website; it's left out where data is missing.`),
            'All websites read. Writing your report.',
          ),
        },
      });

      const report = await this.report.generate(run.projectId, run.organizationId);
      // The website's own audit, in the same plain words, so a new customer
      // ends with both reports. A failure here never holds the run back.
      let auditNote = 'Your website audit report is ready.';
      try {
        const audit = await this.auditReport.generate(run.projectId, run.organizationId);
        if (!audit.analysis) auditNote = `Your website audit report is ready with the measured facts: ${audit.analysisError ?? ''}`.trim();
      } catch (err) {
        auditNote = `The website audit report couldn't be written: ${(err as Error).message}`;
      }
      // Refresh cross-tab detectors and sync Fix Engine (excluding Traffic) so the
      // unified Improvement Plan reflects every finished pipeline stage immediately.
      let fixEngineNote = '';
      const detector = this.resolveOptional(this.opportunityDetection, OpportunityDetectionService);
      if (detector) {
        await detector.detect(run.organizationId, run.projectId, { excludeTraffic: true }).catch(() => null);
      }
      const syncService = this.resolveOptional(this.findingSync, FindingSyncService);
      if (syncService) {
        const synced = await syncService
          .syncProject(run.projectId, { sources: ['WEBSITE', 'COMPETITOR', 'MARKET', 'BACKLINKS'] })
          .catch(() => null);
        if (synced) {
          fixEngineNote = `Fix Engine plan synced (+${synced.created} new, ${synced.updated} updated, ${synced.resolved} resolved).`;
        }
      }

      const latest = await this.prisma.autopilotRun.findUnique({ where: { id: run.id } });
      await this.prisma.autopilotRun.update({
        where: { id: run.id },
        data: {
          status: 'DONE',
          step: 'DONE',
          reportId: report.snapshotId ?? null,
          finishedAt: new Date(),
          log: append(
            latest?.log ?? run.log,
            report.analysis
              ? 'Your competitor report is ready.'
              : `Your report is ready with the measured facts. The written analysis couldn't be made: ${report.analysisError ?? 'unknown reason'}`,
            auditNote,
            ...(fixEngineNote ? [fixEngineNote] : []),
          ),
        },
      });
    } finally {
      this.busy.delete(run.id);
    }
  }

  // ─── Read ──────────────────────────────────────────────────────────────────

  async latest(projectId: string, userId: string): Promise<AutopilotView | null> {
    const project = await this.prisma.project.findUnique({ where: { id: projectId }, select: { organizationId: true } });
    if (!project) throw new NotFoundException('Project not found');
    await this.orgContext.assertMembership(userId, project.organizationId);
    const run = await this.prisma.autopilotRun.findFirst({ where: { projectId }, orderBy: { startedAt: 'desc' } });
    return run ? this.view(run) : null;
  }

  async get(runId: string, userId: string): Promise<AutopilotView> {
    return this.view(await this.owned(runId, userId));
  }

  /** The active run for a project, for the voice agent to answer a "yes". */
  activeFor(projectId: string) {
    return this.prisma.autopilotRun.findFirst({
      where: { projectId, status: { in: ACTIVE } },
      orderBy: { startedAt: 'desc' },
    });
  }

  private async owned(runId: string, userId: string): Promise<AutopilotRun> {
    const run = await this.prisma.autopilotRun.findUnique({ where: { id: runId } });
    if (!run) throw new NotFoundException('Autopilot run not found');
    await this.orgContext.assertMembership(userId, run.organizationId);
    return run;
  }

  private async sites(run: AutopilotRun): Promise<AutopilotSite[]> {
    // The newest crawl, unless it failed after an earlier one succeeded; a
    // failed recrawl must not read as "failed, 0 pages" for a site already read.
    // Always this project's own records: the same domain can be on file for
    // other customers too, with crawls this one never ran.
    const jobFor = async (website: { domain: string; projectId?: string; scope: string }) =>
      crawlToShow(
        await this.prisma.crawlJob.findMany({
          where: { website },
          orderBy: { createdAt: 'desc' },
          take: 6,
          select: { status: true, pagesCrawled: true },
        }),
      ).shown;
    const own = await jobFor({ domain: run.domain, projectId: run.projectId, scope: OWN_SCOPE });
    const out: AutopilotSite[] = [
      { domain: run.domain, name: 'Your website', role: 'you', crawl: own?.status ?? 'NONE', pagesCrawled: own?.pagesCrawled ?? 0 },
    ];
    for (const c of (run.competitors as unknown as ConfirmedCompetitor[]) ?? []) {
      const job = await jobFor({ domain: c.domain, scope: competitorScope(run.projectId) });
      out.push({ domain: c.domain, name: c.name, role: 'competitor', crawl: job?.status ?? 'NONE', pagesCrawled: job?.pagesCrawled ?? 0 });
    }
    return out;
  }

  private async buildStages(run: AutopilotRun, sites: AutopilotSite[]): Promise<PipelineStage[]> {
    const own = sites.find((s) => s.role === 'you');
    const rivals = sites.filter((s) => s.role === 'competitor');

    const ownStatus: PipelineStage['status'] =
      own?.crawl === 'COMPLETED'
        ? 'DONE'
        : own?.crawl === 'RUNNING' || own?.crawl === 'PENDING'
          ? 'RUNNING'
          : own?.crawl === 'FAILED'
            ? 'FAILED'
            : 'PENDING';

    let compStatus: PipelineStage['status'] = 'PENDING';
    let compDetail = 'Waiting for website audit';
    if (run.status === 'DISCOVERING') {
      compStatus = 'RUNNING';
      compDetail = 'Discovering likely rivals';
    } else if (run.status === 'AWAITING_CONFIRMATION') {
      compStatus = 'WAITING';
      compDetail = `${((run.suggestions as any[]) ?? []).length} rivals ready to confirm`;
    } else if (rivals.length > 0) {
      const doneCount = rivals.filter((r) => r.crawl === 'COMPLETED').length;
      const activeCount = rivals.filter((r) => r.crawl === 'RUNNING' || r.crawl === 'PENDING').length;
      if (run.status === 'DONE' || (activeCount === 0 && doneCount > 0)) {
        compStatus = 'DONE';
        compDetail = `${doneCount}/${rivals.length} rivals analyzed`;
      } else if (activeCount > 0 || run.step === 'REPORT') {
        compStatus = 'RUNNING';
        compDetail =
          run.step === 'REPORT'
            ? 'Writing competitor intelligence report'
            : `Crawling rivals (${doneCount}/${rivals.length} done)`;
      } else {
        compStatus = 'FAILED';
        compDetail = 'Rival crawls could not finish';
      }
    }

    let aiStatus: PipelineStage['status'] = 'PENDING';
    let aiDetail = 'Queued after rival confirmation';
    if (this.prisma.aiVisibilityJourney?.findFirst) {
      const journey = await this.prisma.aiVisibilityJourney
        .findFirst({
          where: { projectId: run.projectId },
          orderBy: { createdAt: 'desc' },
          select: { status: true, progress: true },
        })
        .catch(() => null);
      if (journey) {
        if (journey.status === 'COMPLETED' || journey.status === 'PARTIAL') {
          aiStatus = 'DONE';
          aiDetail = 'AI recommendations measured';
        } else if (['QUEUED', 'PREPARING', 'CHECKING', 'PLANNING'].includes(journey.status)) {
          aiStatus = 'RUNNING';
          aiDetail = `Checking AI engines (${journey.progress ?? 0}%)`;
        } else if (journey.status === 'READY' || journey.status === 'AWAITING_CONFIRMATION') {
          aiStatus = 'WAITING';
          aiDetail = 'Questions ready to run';
        } else if (journey.status === 'FAILED') {
          aiStatus = 'FAILED';
          aiDetail = 'Check AI provider settings';
        }
      }
    }

    let blStatus: PipelineStage['status'] = 'PENDING';
    let blDetail = 'Queued in parallel';
    if (this.prisma.backlinkDiscoveryRun?.findFirst) {
      const bl = await this.prisma.backlinkDiscoveryRun
        .findFirst({
          where: { projectId: run.projectId },
          orderBy: { startedAt: 'desc' },
          select: { status: true, candidates: true },
        })
        .catch(() => null);
      if (bl) {
        if (bl.status === 'COMPLETED' || bl.status === 'PARTIAL') {
          blStatus = 'DONE';
          blDetail = `${bl.candidates ?? 0} link candidates scanned`;
        } else if (bl.status === 'PENDING' || bl.status === 'RUNNING') {
          blStatus = 'RUNNING';
          blDetail = 'Discovering & verifying links';
        } else if (bl.status === 'FAILED') {
          blStatus = 'FAILED';
          blDetail = 'Discovery needs retry';
        }
      }
    }

    let openOpportunities = 0;
    if (this.prisma.growthOpportunity?.count) {
      openOpportunities = await this.prisma.growthOpportunity
        .count({ where: { projectId: run.projectId, status: 'OPEN' } })
        .catch(() => 0);
    }
    const fixStatus: PipelineStage['status'] =
      run.status === 'DONE'
        ? 'DONE'
        : run.step === 'REPORT'
          ? 'RUNNING'
          : 'PENDING';

    return [
      {
        id: 'WEBSITE',
        label: 'Website Audit',
        status: ownStatus,
        detail: own?.pagesCrawled ? `${own.pagesCrawled} pages read` : ownStatus === 'RUNNING' ? 'Crawling pages…' : 'Pending',
        href: '/website',
      },
      {
        id: 'COMPETITORS',
        label: 'Competitor Intelligence',
        status: compStatus,
        detail: compDetail,
        href: '/competitor-intelligence',
      },
      {
        id: 'AI_VISIBILITY',
        label: 'AI Visibility',
        status: aiStatus,
        detail: aiDetail,
        href: '/ai-visibility',
      },
      {
        id: 'BACKLINKS',
        label: 'Backlinks',
        status: blStatus,
        detail: blDetail,
        href: '/backlinks',
      },
      {
        id: 'FIX_ENGINE',
        label: 'Fix Engine Plan',
        status: fixStatus,
        detail:
          fixStatus === 'DONE'
            ? `${openOpportunities} prioritized fix${openOpportunities === 1 ? '' : 'es'} ready`
            : fixStatus === 'RUNNING'
              ? 'Ranking fixes by site ROI…'
              : 'Syncs automatically on finish',
        href: '/fix-engine',
      },
    ];
  }

  private async view(run: AutopilotRun): Promise<AutopilotView> {
    const sites = await this.sites(run);
    const stages = await this.buildStages(run, sites);
    return {
      id: run.id,
      projectId: run.projectId,
      domain: run.domain,
      status: run.status,
      step: run.step,
      suggestions: (run.suggestions as any[]) ?? [],
      competitors: (run.competitors as unknown as ConfirmedCompetitor[]) ?? [],
      sites,
      stages,
      log: (run.log as any[]) ?? [],
      error: run.error,
      reportReady: run.status === 'DONE',
      startedAt: run.startedAt.toISOString(),
      finishedAt: run.finishedAt?.toISOString() ?? null,
    };
  }
}

/** " with sarvam-105b", when every suggestion came from the same model. */
function foundByNote(suggestions: Array<{ foundBy?: string | null }>): string {
  const models = [...new Set(suggestions.map((s) => s.foundBy).filter(Boolean))];
  return models.length === 1 ? ` with ${models[0]}` : '';
}

function entry(message: string) {
  return { at: new Date().toISOString(), message };
}

function append(log: unknown, ...messages: string[]) {
  return [...(Array.isArray(log) ? log : []), ...messages.map(entry)] as any;
}
