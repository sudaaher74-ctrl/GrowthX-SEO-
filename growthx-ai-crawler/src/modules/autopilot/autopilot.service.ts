import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AutopilotRun } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { OrgContextService } from '../organizations/org-context.service';
import { CrawlerService } from '../crawler/crawler.service';
import { FetcherService } from '../crawler/fetcher.service';
import { AiTask, MultiAiRouterService } from '../ai-search/multi-ai-router/multi-ai-router.service';
import { extractAndParseJson } from '../ai-engine/utils/json-extractor.util';
import { CompetitorCrawlService } from '../content-intelligence/competitor-crawl.service';
import { CompetitorIntelReportService } from '../competitor-action-engine/competitor-intel-report.service';
import { MAX_COMPETITORS } from '../competitor-action-engine/competitor-setup.service';
import { AuditReportService } from '../audit-report/audit-report.service';
import {
  CompetitorSuggestion,
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
/** Past this, the report is written from whatever has finished. */
const CRAWL_WAIT_MS = 60 * 60 * 1000;
const SUGGESTIONS_KEPT = 5;
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

export interface AutopilotView {
  id: string;
  projectId: string;
  domain: string;
  status: string;
  step: string;
  suggestions: Array<CompetitorSuggestion & { tracked?: boolean }>;
  competitors: ConfirmedCompetitor[];
  sites: AutopilotSite[];
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
    private readonly fetcher: FetcherService,
    private readonly router: MultiAiRouterService,
    private readonly competitorCrawl: CompetitorCrawlService,
    private readonly report: CompetitorIntelReportService,
    private readonly auditReport: AuditReportService,
  ) {}

  // ─── Start ──────────────────────────────────────────────────────────────────

  async start(input: { userId: string; organizationId: string; domain: string; projectId?: string | null }): Promise<AutopilotView> {
    const domain = websiteDomain(input.domain);
    if (!normaliseCandidate(domain)) throw new BadRequestException(`"${input.domain}" doesn't look like a website address.`);
    await this.orgContext.assertMembership(input.userId, input.organizationId);

    const { projectId, websiteId } = await this.resolveProject(input.organizationId, input.userId, domain, input.projectId);

    const active = await this.prisma.autopilotRun.findFirst({
      where: { projectId, status: { in: ACTIVE } },
      orderBy: { startedAt: 'desc' },
    });
    if (active) return this.view(active);

    const ownCrawlJobId = await this.ensureOwnCrawl(websiteId);
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
    const existing = await this.prisma.website.findUnique({
      where: { domain },
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
      where: { domain },
      update: { projectId: target },
      create: { domain, url: `https://${domain}`, isVerified: false, projectId: target },
    });
    return { projectId: target, websiteId: website.id };
  }

  private async ensureOwnCrawl(websiteId: string): Promise<string | null> {
    const latest = await this.prisma.crawlJob.findFirst({
      where: { websiteId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, status: true, finishedAt: true, createdAt: true },
    });
    if (latest && (latest.status === 'RUNNING' || latest.status === 'PENDING')) return latest.id;
    if (latest?.status === 'COMPLETED' && latest.finishedAt && Date.now() - latest.finishedAt.getTime() < FRESH_OWN_CRAWL_MS) {
      return null;
    }
    return this.crawler.startCrawlJob(websiteId, OWN_SITE_CRAWL);
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
              ? `Found ${suggestions.length} likely competitor${suggestions.length === 1 ? '' : 's'}: ${suggestions.map((s) => s.name).join(', ')}. Waiting for you to confirm.`
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
      const res = await this.fetcher.fetchPage(`https://${domain}`, false);
      if (res.statusCode >= 200 && res.statusCode < 400 && res.html) site = summariseHomepage(res.html);
    } catch {
      // Carry on with whatever the crawl knows.
    }
    const pages = await this.prisma.page.findMany({
      where: { crawlJob: { website: { domain } }, title: { not: null } },
      select: { title: true },
      take: 40,
    });
    const titles = [...new Set(pages.map((p) => (p.title ?? '').trim()).filter(Boolean))];

    const completion = await this.router.generate({
      prompt: buildFinderPrompt(domain, site, titles),
      systemInstruction: 'You identify real business competitors. Reply with valid JSON only.',
      task: AiTask.COMPETITOR_ANALYSIS,
      organizationId,
      projectId,
      maxTokens: 1500,
    });
    const candidates = filterCandidates(extractAndParseJson<any>(completion.text), domain);

    const live: CompetitorSuggestion[] = [];
    for (const c of candidates) {
      if (live.length >= SUGGESTIONS_KEPT) break;
      if (await this.answers(c.domain)) live.push(c);
    }
    return live;
  }

  /** Whether a website exists and serves a page, so no invented site is ever offered. */
  protected async answers(domain: string): Promise<boolean> {
    try {
      const res = await this.fetcher.fetchPage(`https://${domain}`, false);
      return res.statusCode >= 200 && res.statusCode < 400;
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
    if (run.status !== 'AWAITING_CONFIRMATION') {
      throw new BadRequestException(run.status === 'DISCOVERING' ? 'Still looking for competitors. One moment.' : 'This run has moved on already.');
    }
    const suggestions = (run.suggestions as any[]) ?? [];
    const chosen = [...new Set(domains.map(normaliseCandidate).filter((d): d is string => !!d))].filter(
      (d) => d !== normaliseCandidate(run.domain),
    );
    if (!chosen.length) throw new BadRequestException('Tell me at least one competitor website.');

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
      if (await this.rivalCrawlIsFresh(domain)) {
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
    if (dropped.length) log.push(`Skipped ${dropped.join(', ')}: you can track up to ${MAX_COMPETITORS} competitors.`);

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

  private async rivalCrawlIsFresh(domain: string): Promise<boolean> {
    const job = await this.prisma.crawlJob.findFirst({
      where: { website: { domain }, status: 'COMPLETED' },
      orderBy: { finishedAt: 'desc' },
      select: { finishedAt: true },
    });
    return !!job?.finishedAt && Date.now() - job.finishedAt.getTime() < FRESH_RIVAL_CRAWL_MS;
  }

  async cancel(runId: string, userId: string): Promise<AutopilotView> {
    const run = await this.owned(runId, userId);
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
    const jobFor = async (domain: string) =>
      this.prisma.crawlJob.findFirst({
        where: { website: { domain } },
        orderBy: { createdAt: 'desc' },
        select: { status: true, pagesCrawled: true },
      });
    const own = await jobFor(run.domain);
    const out: AutopilotSite[] = [
      { domain: run.domain, name: 'Your website', role: 'you', crawl: own?.status ?? 'NONE', pagesCrawled: own?.pagesCrawled ?? 0 },
    ];
    for (const c of (run.competitors as unknown as ConfirmedCompetitor[]) ?? []) {
      const job = await jobFor(c.domain);
      out.push({ domain: c.domain, name: c.name, role: 'competitor', crawl: job?.status ?? 'NONE', pagesCrawled: job?.pagesCrawled ?? 0 });
    }
    return out;
  }

  private async view(run: AutopilotRun): Promise<AutopilotView> {
    return {
      id: run.id,
      projectId: run.projectId,
      domain: run.domain,
      status: run.status,
      step: run.step,
      suggestions: (run.suggestions as any[]) ?? [],
      competitors: (run.competitors as unknown as ConfirmedCompetitor[]) ?? [],
      sites: await this.sites(run),
      log: (run.log as any[]) ?? [],
      error: run.error,
      reportReady: run.status === 'DONE',
      startedAt: run.startedAt.toISOString(),
      finishedAt: run.finishedAt?.toISOString() ?? null,
    };
  }
}

function entry(message: string) {
  return { at: new Date().toISOString(), message };
}

function append(log: unknown, ...messages: string[]) {
  return [...(Array.isArray(log) ? log : []), ...messages.map(entry)] as any;
}
