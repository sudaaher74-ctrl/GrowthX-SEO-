import {
  BadRequestException,
  ForbiddenException,
  forwardRef,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CrawlFrequency } from '@prisma/client';
import { createHash, timingSafeEqual } from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { CrawlerService } from '../crawler/crawler.service';
import { OWN_SCOPE } from '../crawler/website-scope';
import { AutopilotService } from '../autopilot/autopilot.service';

export interface AgentAutonomyConfig {
  autonomousFixProposals?: boolean;
  autoStageLowRisk?: boolean;
  githubPrAutoReview?: boolean;
  cmsSafePublish?: boolean;
  regressionGuard?: boolean;
  [key: string]: unknown;
}

export interface UpdateAutomationSettingsInput {
  crawlFrequency?: CrawlFrequency;
  pipelineMode?: 'CRAWL_ONLY' | 'FULL_PIPELINE';
  maxDepth?: number;
  maxConcurrency?: number;
  useSitemap?: boolean;
  autoStageLowRisk?: boolean;
  agentAutonomy?: AgentAutonomyConfig;
}

export interface AutomationSettingsResponse {
  projectId: string;
  crawlFrequency: CrawlFrequency;
  pipelineMode: 'CRAWL_ONLY' | 'FULL_PIPELINE';
  maxDepth: number;
  maxConcurrency: number;
  useSitemap: boolean;
  autoStageLowRisk: boolean;
  agentAutonomy: AgentAutonomyConfig;
  nextScheduledRunAt: string | null;
  lastScheduledRunAt: string | null;
  lastScheduledStatus: string | null;
  updatedAt: string | null;
  recentRuns: Array<{
    id: string;
    kind: 'CRAWL' | 'PIPELINE';
    status: string;
    startedAt: string;
    finishedAt: string | null;
    summary: string;
  }>;
}

export interface StaggeredScheduleSlot {
  /** UTC hour of day (0..23) */
  hour: number;
  /** UTC day of week (0=Sun..6=Sat) for WEEKLY crawls */
  dayOfWeek: number;
  /** Two UTC days of month (1..14 and 15..28) for BIWEEKLY crawls */
  biweeklyDays: [number, number];
  /** UTC day of month (1..28) for MONTHLY crawls */
  dayOfMonth: number;
}

/**
 * Deterministic, uniformly distributed UTC schedule slot derived from a
 * website's ID and cadence. Spreads scheduled crawls across 24 daily hours,
 * 168 weekly slots, 336 biweekly slots, and 672 monthly slots so all users do
 * not fire simultaneously at midnight UTC.
 */
export function scheduledSlotForWebsite(
  websiteId: string,
  frequency: CrawlFrequency,
): StaggeredScheduleSlot {
  const digest = createHash('sha256').update(`${websiteId}:${frequency}`).digest();
  const hour = digest.readUInt16BE(0) % 24;
  const dayOfWeek = digest.readUInt16BE(2) % 7;
  const biweeklyOffset = digest.readUInt16BE(4) % 14;
  const dayOfMonth = (digest.readUInt16BE(6) % 28) + 1;
  return {
    hour,
    dayOfWeek,
    biweeklyDays: [biweeklyOffset + 1, biweeklyOffset + 15],
    dayOfMonth,
  };
}

/** Whether a website's deterministic staggered slot falls in `now`'s UTC hour. */
export function matchesStaggeredSlot(
  websiteId: string,
  frequency: CrawlFrequency,
  now: Date,
): boolean {
  if (frequency === CrawlFrequency.OFF) return false;
  const slot = scheduledSlotForWebsite(websiteId, frequency);
  if (now.getUTCHours() !== slot.hour) return false;
  if (frequency === CrawlFrequency.DAILY) return true;
  if (frequency === CrawlFrequency.WEEKLY) return now.getUTCDay() === slot.dayOfWeek;
  if (frequency === CrawlFrequency.BIWEEKLY) {
    const dom = now.getUTCDate();
    return dom === slot.biweeklyDays[0] || dom === slot.biweeklyDays[1];
  }
  return now.getUTCDate() === slot.dayOfMonth;
}

/**
 * Pure UTC calculator for the next cron firing timestamp matching the
 * `@Cron` expressions in SchedulerService:
 * - When `websiteId` is supplied (and `CRAWL_STAGGER_SCHEDULES !== 'false'`),
 *   returns that site's deterministic staggered UTC slot.
 * - Otherwise returns the legacy fixed UTC schedule:
 *   DAILY 00:00, WEEKLY Monday 01:00, BIWEEKLY 1st/15th 02:00, MONTHLY 1st 02:00.
 */
export function computeNextScheduledRun(
  frequency: CrawlFrequency,
  now: Date = new Date(),
  websiteId?: string,
): string | null {
  if (frequency === CrawlFrequency.OFF) return null;

  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const date = now.getUTCDate();

  if (websiteId && process.env.CRAWL_STAGGER_SCHEDULES !== 'false') {
    const slot = scheduledSlotForWebsite(websiteId, frequency);

    if (frequency === CrawlFrequency.DAILY) {
      const todaySlot = new Date(Date.UTC(year, month, date, slot.hour, 0, 0, 0));
      if (todaySlot.getTime() > now.getTime()) return todaySlot.toISOString();
      return new Date(Date.UTC(year, month, date + 1, slot.hour, 0, 0, 0)).toISOString();
    }

    if (frequency === CrawlFrequency.WEEKLY) {
      const day = now.getUTCDay();
      let daysAhead = (slot.dayOfWeek - day + 7) % 7;
      const candidate = new Date(Date.UTC(year, month, date + daysAhead, slot.hour, 0, 0, 0));
      if (candidate.getTime() <= now.getTime()) {
        daysAhead = daysAhead === 0 ? 7 : daysAhead + 7;
        return new Date(Date.UTC(year, month, date + daysAhead, slot.hour, 0, 0, 0)).toISOString();
      }
      return candidate.toISOString();
    }

    if (frequency === CrawlFrequency.BIWEEKLY) {
      const [day1, day2] = slot.biweeklyDays;
      const candidates = [
        new Date(Date.UTC(year, month, day1, slot.hour, 0, 0, 0)),
        new Date(Date.UTC(year, month, day2, slot.hour, 0, 0, 0)),
        new Date(Date.UTC(year, month + 1, day1, slot.hour, 0, 0, 0)),
      ];
      return (candidates.find((d) => d.getTime() > now.getTime()) ?? candidates[2]).toISOString();
    }

    const thisMonth = new Date(Date.UTC(year, month, slot.dayOfMonth, slot.hour, 0, 0, 0));
    if (thisMonth.getTime() > now.getTime()) return thisMonth.toISOString();
    return new Date(Date.UTC(year, month + 1, slot.dayOfMonth, slot.hour, 0, 0, 0)).toISOString();
  }

  if (frequency === CrawlFrequency.DAILY) {
    return new Date(Date.UTC(year, month, date + 1, 0, 0, 0, 0)).toISOString();
  }

  if (frequency === CrawlFrequency.WEEKLY) {
    // Monday = 1 in getUTCDay() (Sun=0..Sat=6)
    const day = now.getUTCDay();
    let daysAhead = (1 - day + 7) % 7;
    const candidate = new Date(Date.UTC(year, month, date + daysAhead, 1, 0, 0, 0));
    if (candidate.getTime() <= now.getTime()) {
      daysAhead = daysAhead === 0 ? 7 : daysAhead + 7;
      return new Date(Date.UTC(year, month, date + daysAhead, 1, 0, 0, 0)).toISOString();
    }
    return candidate.toISOString();
  }

  if (frequency === CrawlFrequency.BIWEEKLY) {
    const candidates = [
      new Date(Date.UTC(year, month, 1, 2, 0, 0, 0)),
      new Date(Date.UTC(year, month, 15, 2, 0, 0, 0)),
      new Date(Date.UTC(year, month + 1, 1, 2, 0, 0, 0)),
    ];
    const next = candidates.find((d) => d.getTime() > now.getTime()) ?? candidates[2];
    return next.toISOString();
  }

  // MONTHLY: 1st of month at 02:00 UTC
  const thisMonthFirst = new Date(Date.UTC(year, month, 1, 2, 0, 0, 0));
  if (thisMonthFirst.getTime() > now.getTime()) {
    return thisMonthFirst.toISOString();
  }
  return new Date(Date.UTC(year, month + 1, 1, 2, 0, 0, 0)).toISOString();
}

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crawlerService: CrawlerService,
    @Optional()
    @Inject(forwardRef(() => AutopilotService))
    private readonly autopilotService?: AutopilotService,
  ) {}

  /**
   * Staggered hourly Cron trigger (active when `CRAWL_STAGGER_SCHEDULES=true`).
   * Dispatches only websites whose deterministic SHA-256 UTC slot matches the
   * current UTC hour, flattening midnight/Monday/1st-of-month crawl spikes.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async handleStaggeredHourlyCrawls(now: Date = new Date()): Promise<void> {
    if (process.env.CRAWL_STAGGER_SCHEDULES !== 'true') return;
    try {
      const websites = await this.prisma.website.findMany({
        where: {
          isVerified: true,
          crawlFrequency: {
            in: [
              CrawlFrequency.DAILY,
              CrawlFrequency.WEEKLY,
              CrawlFrequency.BIWEEKLY,
              CrawlFrequency.MONTHLY,
            ],
          },
        },
        select: {
          id: true,
          domain: true,
          projectId: true,
          crawlFrequency: true,
          project: {
            select: {
              id: true,
              organizationId: true,
              automationSettings: {
                select: {
                  pipelineMode: true,
                  maxDepth: true,
                  maxConcurrency: true,
                  useSitemap: true,
                },
              },
            },
          },
        },
      });

      const due = websites.filter((site) =>
        matchesStaggeredSlot(site.id, site.crawlFrequency, now),
      );
      if (due.length === 0) {
        this.logger.debug(
          `No staggered crawls due for UTC hour ${now.getUTCHours()} (checked ${websites.length} scheduled site(s)).`,
        );
        return;
      }

      const maxPerHour = Math.max(1, Number(process.env.SCHEDULER_MAX_PER_HOUR || 50));
      const batch = due.slice(0, maxPerHour);
      if (due.length > maxPerHour) {
        this.logger.warn(
          `Staggered hourly batch capped at ${maxPerHour} of ${due.length} due websites for UTC hour ${now.getUTCHours()}.`,
        );
      }

      await this.dispatchScheduledWebsites(batch, `STAGGERED_H${now.getUTCHours()}`);
    } catch (err) {
      this.logger.error('Error during staggered hourly scheduled crawls trigger', err);
    }
  }

  /**
   * Daily Cron trigger at midnight UTC for scheduled websites
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleDailyScheduledCrawls(): Promise<void> {
    if (process.env.CRAWL_STAGGER_SCHEDULES === 'true') {
      this.logger.debug('Skipping bulk daily cron; CRAWL_STAGGER_SCHEDULES=true uses hourly staggered dispatch.');
      return;
    }
    this.logger.log('Running daily scheduled crawl check...');
    await this.triggerScheduledCrawls(CrawlFrequency.DAILY);
  }

  /**
   * Weekly Cron trigger every Monday at 1 AM UTC
   */
  @Cron('0 1 * * 1')
  async handleWeeklyScheduledCrawls(): Promise<void> {
    if (process.env.CRAWL_STAGGER_SCHEDULES === 'true') {
      this.logger.debug('Skipping bulk weekly cron; CRAWL_STAGGER_SCHEDULES=true uses hourly staggered dispatch.');
      return;
    }
    this.logger.log('Running weekly scheduled crawl check...');
    await this.triggerScheduledCrawls(CrawlFrequency.WEEKLY);
  }

  /**
   * Bi-weekly Cron trigger on the 1st and 15th of every month at 2 AM UTC
   */
  @Cron('0 2 1,15 * *')
  async handleBiweeklyScheduledCrawls(): Promise<void> {
    if (process.env.CRAWL_STAGGER_SCHEDULES === 'true') {
      this.logger.debug('Skipping bulk biweekly cron; CRAWL_STAGGER_SCHEDULES=true uses hourly staggered dispatch.');
      return;
    }
    this.logger.log('Running bi-weekly scheduled crawl check...');
    await this.triggerScheduledCrawls(CrawlFrequency.BIWEEKLY);
  }

  /**
   * Monthly Cron trigger on the 1st of every month at 2 AM UTC
   */
  @Cron('0 2 1 * *')
  async handleMonthlyScheduledCrawls(): Promise<void> {
    if (process.env.CRAWL_STAGGER_SCHEDULES === 'true') {
      this.logger.debug('Skipping bulk monthly cron; CRAWL_STAGGER_SCHEDULES=true uses hourly staggered dispatch.');
      return;
    }
    this.logger.log('Running monthly scheduled crawl check...');
    await this.triggerScheduledCrawls(CrawlFrequency.MONTHLY);
  }

  /**
   * Reads persisted project scheduler & automation settings, plus the real
   * computed next scheduled run and recent Crawl/Pipeline executions.
   */
  async getAutomationSettings(
    projectId: string,
    userId: string,
  ): Promise<AutomationSettingsResponse> {
    const project = await this.assertProjectMembership(projectId, userId);

    const [saved, primaryWebsite] = await Promise.all([
      this.prisma.projectAutomationSettings?.findUnique({ where: { projectId } }) ?? null,
      this.prisma.website.findFirst({
        where: { projectId, scope: OWN_SCOPE },
        orderBy: { createdAt: 'asc' },
        select: { id: true, crawlFrequency: true },
      }),
    ]);

    const crawlFrequency: CrawlFrequency =
      saved?.crawlFrequency ?? primaryWebsite?.crawlFrequency ?? CrawlFrequency.WEEKLY;
    const pipelineMode: 'CRAWL_ONLY' | 'FULL_PIPELINE' =
      saved?.pipelineMode === 'FULL_PIPELINE' ? 'FULL_PIPELINE' : 'CRAWL_ONLY';

    const websiteIds = project.websites.map((w) => w.id);
    const [recentCrawls, recentPipelines] = await Promise.all([
      websiteIds.length
        ? this.prisma.crawlJob.findMany({
            where: { websiteId: { in: websiteIds } },
            orderBy: { createdAt: 'desc' },
            take: 5,
            select: {
              id: true,
              status: true,
              createdAt: true,
              finishedAt: true,
              pagesCrawled: true,
              issuesFound: true,
            },
          })
        : Promise.resolve([]),
      this.prisma.autopilotRun?.findMany({
        where: { projectId },
        orderBy: { startedAt: 'desc' },
        take: 5,
        select: {
          id: true,
          status: true,
          startedAt: true,
          finishedAt: true,
          domain: true,
          error: true,
        },
      }) ?? Promise.resolve([]),
    ]);

    const recentRuns = [
      ...recentCrawls.map((c) => ({
        id: c.id,
        kind: 'CRAWL' as const,
        status: c.status,
        startedAt: c.createdAt.toISOString(),
        finishedAt: c.finishedAt?.toISOString() ?? null,
        summary: `${c.pagesCrawled} pages crawled · ${c.issuesFound} issues`,
      })),
      ...recentPipelines.map((p) => ({
        id: p.id,
        kind: 'PIPELINE' as const,
        status: p.status,
        startedAt: p.startedAt.toISOString(),
        finishedAt: p.finishedAt?.toISOString() ?? null,
        summary: p.error
          ? `Pipeline error: ${p.error}`
          : `Full 5-stage workspace pipeline (${p.domain})`,
      })),
    ]
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
      .slice(0, 6);

    return {
      projectId,
      crawlFrequency,
      pipelineMode,
      maxDepth: saved?.maxDepth ?? 500,
      maxConcurrency: saved?.maxConcurrency ?? 5,
      useSitemap: saved?.useSitemap ?? true,
      autoStageLowRisk: saved?.autoStageLowRisk ?? false,
      agentAutonomy:
        saved?.agentAutonomy && typeof saved.agentAutonomy === 'object'
          ? (saved.agentAutonomy as AgentAutonomyConfig)
          : {},
      nextScheduledRunAt: computeNextScheduledRun(crawlFrequency, new Date(), primaryWebsite?.id),
      lastScheduledRunAt: saved?.lastScheduledRunAt?.toISOString() ?? null,
      lastScheduledStatus: saved?.lastScheduledStatus ?? null,
      updatedAt: saved?.updatedAt?.toISOString() ?? null,
      recentRuns,
    };
  }

  /**
   * Persists scheduler & automation settings in Postgres and synchronizes
   * `Website.crawlFrequency` on all owned websites in the project so the
   * backend cron jobs immediately obey the saved cadence.
   */
  async updateAutomationSettings(
    projectId: string,
    userId: string,
    input: UpdateAutomationSettingsInput,
  ): Promise<AutomationSettingsResponse> {
    await this.assertProjectMembership(projectId, userId, true);

    const existing = await this.prisma.projectAutomationSettings.findUnique({
      where: { projectId },
    });

    const nextFrequency =
      input.crawlFrequency ?? existing?.crawlFrequency ?? CrawlFrequency.WEEKLY;
    const nextPipelineMode =
      input.pipelineMode === 'FULL_PIPELINE' || input.pipelineMode === 'CRAWL_ONLY'
        ? input.pipelineMode
        : existing?.pipelineMode === 'FULL_PIPELINE'
          ? 'FULL_PIPELINE'
          : 'CRAWL_ONLY';
    const nextMaxDepth =
      input.maxDepth !== undefined
        ? Math.min(25000, Math.max(10, Math.round(input.maxDepth)))
        : (existing?.maxDepth ?? 500);
    const nextMaxConcurrency =
      input.maxConcurrency !== undefined
        ? Math.min(20, Math.max(1, Math.round(input.maxConcurrency)))
        : (existing?.maxConcurrency ?? 5);
    const nextUseSitemap =
      input.useSitemap !== undefined ? Boolean(input.useSitemap) : (existing?.useSitemap ?? true);
    const nextAutoStage =
      input.autoStageLowRisk !== undefined
        ? Boolean(input.autoStageLowRisk)
        : (existing?.autoStageLowRisk ?? false);
    const mergedAutonomy: AgentAutonomyConfig = {
      ...(existing?.agentAutonomy && typeof existing.agentAutonomy === 'object'
        ? (existing.agentAutonomy as AgentAutonomyConfig)
        : {}),
      ...(input.agentAutonomy ?? {}),
    };

    await this.prisma.projectAutomationSettings.upsert({
      where: { projectId },
      create: {
        projectId,
        crawlFrequency: nextFrequency,
        pipelineMode: nextPipelineMode,
        maxDepth: nextMaxDepth,
        maxConcurrency: nextMaxConcurrency,
        useSitemap: nextUseSitemap,
        autoStageLowRisk: nextAutoStage,
        agentAutonomy: mergedAutonomy as any,
      },
      update: {
        crawlFrequency: nextFrequency,
        pipelineMode: nextPipelineMode,
        maxDepth: nextMaxDepth,
        maxConcurrency: nextMaxConcurrency,
        useSitemap: nextUseSitemap,
        autoStageLowRisk: nextAutoStage,
        agentAutonomy: mergedAutonomy as any,
      },
    });

    // Keep Website.crawlFrequency synchronized for the cron dispatcher.
    if (input.crawlFrequency !== undefined) {
      await this.prisma.website.updateMany({
        where: { projectId, scope: OWN_SCOPE },
        data: { crawlFrequency: nextFrequency },
      });
    }

    return this.getAutomationSettings(projectId, userId);
  }

  /**
   * Manually dispatches the configured scheduled workload right now (either a
   * parameterized crawl or the full 5-stage Autopilot pipeline).
   */
  async triggerScheduledWorkloadNow(
    projectId: string,
    userId: string,
  ): Promise<{ mode: 'CRAWL_ONLY' | 'FULL_PIPELINE'; runId: string; message: string }> {
    const project = await this.assertProjectMembership(projectId, userId, true);
    const saved = await this.prisma.projectAutomationSettings.findUnique({
      where: { projectId },
    });
    const mode: 'CRAWL_ONLY' | 'FULL_PIPELINE' =
      saved?.pipelineMode === 'FULL_PIPELINE' ? 'FULL_PIPELINE' : 'CRAWL_ONLY';

    const site = project.websites[0];
    if (!site) {
      throw new BadRequestException('No website is linked to this project yet.');
    }

    if (mode === 'FULL_PIPELINE' && this.autopilotService) {
      const run = await this.autopilotService.start({
        userId,
        organizationId: project.organizationId,
        domain: site.domain,
        projectId,
        forceRefresh: true,
      });
      await this.recordScheduleStatus(projectId, 'STARTED_PIPELINE');
      return {
        mode,
        runId: run.id,
        message: 'Dispatched full 5-stage workspace pipeline.',
      };
    }

    const jobId = await this.crawlerService.startCrawlJob(site.id, {
      pageLimit: saved?.maxDepth ?? 500,
      maxConcurrency: saved?.maxConcurrency ?? 5,
      useSitemap: saved?.useSitemap ?? true,
    });
    await this.recordScheduleStatus(projectId, 'STARTED_CRAWL');
    return {
      mode: 'CRAWL_ONLY',
      runId: jobId,
      message: `Dispatched scheduled crawl (${saved?.maxDepth ?? 500} page cap) for ${site.domain}.`,
    };
  }

  private async assertProjectMembership(
    projectId: string,
    userId: string,
    requireWrite = false,
  ) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        organizationId: true,
        websites: {
          where: { scope: OWN_SCOPE },
          select: { id: true, domain: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!project) throw new NotFoundException('Project not found.');
    const membership = await this.prisma.organizationMember.findUnique({
      where: {
        userId_organizationId: { userId, organizationId: project.organizationId },
      },
      select: { role: true },
    });
    if (!membership) {
      throw new ForbiddenException('You do not have access to this project.');
    }
    if (requireWrite && membership.role === 'VIEWER') {
      throw new ForbiddenException('Your role in this organization is view-only.');
    }
    return project;
  }

  private async recordScheduleStatus(projectId: string | undefined, status: string) {
    if (!projectId || !this.prisma.projectAutomationSettings?.updateMany) return;
    await this.prisma.projectAutomationSettings
      .updateMany({
        where: { projectId },
        data: { lastScheduledRunAt: new Date(), lastScheduledStatus: status.slice(0, 180) },
      })
      .catch(() => null);
  }

  /**
   * Starts a crawl (or full 5-stage pipeline when configured) for the sites
   * that asked for this cadence.
   *
   * Failures are per-site: one unreachable domain must not stop the rest of the
   * batch, which is why each start is awaited inside its own try.
   */
  private async triggerScheduledCrawls(frequency: CrawlFrequency): Promise<void> {
    try {
      const websites = await this.prisma.website.findMany({
        where: { isVerified: true, crawlFrequency: frequency },
        select: {
          id: true,
          domain: true,
          projectId: true,
          project: {
            select: {
              id: true,
              organizationId: true,
              automationSettings: {
                select: {
                  pipelineMode: true,
                  maxDepth: true,
                  maxConcurrency: true,
                  useSitemap: true,
                },
              },
            },
          },
        },
      });

      if (websites.length === 0) {
        this.logger.log(`No sites are on the ${frequency} crawl schedule.`);
        return;
      }

      await this.dispatchScheduledWebsites(websites, frequency);
    } catch (err) {
      this.logger.error(`Error during ${frequency} scheduled crawls trigger`, err);
    }
  }

  private async dispatchScheduledWebsites(
    websites: Array<{
      id: string;
      domain: string;
      projectId?: string | null;
      crawlFrequency?: CrawlFrequency;
      project?: {
        id?: string;
        organizationId?: string | null;
        automationSettings?: {
          pipelineMode?: string | null;
          maxDepth?: number;
          maxConcurrency?: number;
          useSitemap?: boolean;
        } | null;
      } | null;
    }>,
    scheduleLabel: string,
  ): Promise<void> {
    let started = 0;
    let skipped = 0;

    for (const site of websites) {
      const projectId = site.project?.id ?? site.projectId ?? undefined;
      const effectiveFreq = site.crawlFrequency ?? scheduleLabel;
      try {
        const organizationId = site.project?.organizationId;

        // An unparented site has no plan to check and no one to bill the
        // pages to, so it is not something to crawl unattended.
        if (!organizationId) {
          this.logger.warn(`Skipping ${site.domain}: not attached to an organization.`);
          skipped++;
          continue;
        }

        // A crawl that outlives its own interval would otherwise stack up,
        // and on a small instance a pile-up is what takes the API down.
        const inFlight = await this.prisma.crawlJob.findFirst({
          where: { websiteId: site.id, status: { in: ['PENDING', 'RUNNING'] } },
          select: { id: true },
        });
        if (inFlight) {
          this.logger.log(`Skipping ${site.domain}: crawl ${inFlight.id} is still running.`);
          skipped++;
          continue;
        }

        const settings = site.project?.automationSettings;
        if (
          settings?.pipelineMode === 'FULL_PIPELINE' &&
          projectId &&
          this.autopilotService
        ) {
          const actor = this.prisma.organizationMember?.findFirst
            ? await this.prisma.organizationMember.findFirst({
                where: { organizationId, role: { in: ['OWNER', 'ADMIN', 'MEMBER'] } },
                orderBy: { createdAt: 'asc' },
                select: { userId: true },
              })
            : null;
          if (actor?.userId) {
            this.logger.log(
              `Dispatching ${effectiveFreq} scheduled FULL_PIPELINE for domain: ${site.domain}`,
            );
            await this.autopilotService.start({
              userId: actor.userId,
              organizationId,
              domain: site.domain,
              projectId,
              forceRefresh: true,
            });
            await this.recordScheduleStatus(projectId, `STARTED_PIPELINE (${effectiveFreq})`);
            started++;
            continue;
          }
        }

        this.logger.log(`Dispatching ${effectiveFreq} scheduled crawl for domain: ${site.domain}`);
        if (settings) {
          await this.crawlerService.startCrawlJob(site.id, {
            pageLimit: settings.maxDepth,
            maxConcurrency: settings.maxConcurrency,
            useSitemap: settings.useSitemap,
          });
        } else {
          await this.crawlerService.startCrawlJob(site.id);
        }
        await this.recordScheduleStatus(projectId, `STARTED_CRAWL (${effectiveFreq})`);
        started++;
      } catch (err) {
        this.logger.error(`Failed to start scheduled crawl for ${site.domain}`, err);
        await this.recordScheduleStatus(
          projectId,
          `FAILED: ${(err as Error)?.message ?? 'Unknown error'}`,
        );
        skipped++;
      }
    }

    this.logger.log(
      `${scheduleLabel} scheduled crawls: ${started} started, ${skipped} skipped, ${websites.length} due.`,
    );
  }

  /**
   * Webhook handler for CI/CD deployment or sitemap update triggers.
   */
  async handleWebhookTrigger(
    domainOrId: string,
    secretToken?: string,
  ): Promise<{ success: boolean; jobId?: string; message: string }> {
    const website = await this.prisma.website.findFirst({
      where: {
        OR: [
          { id: domainOrId },
          { domain: domainOrId, scope: OWN_SCOPE },
          { url: domainOrId, scope: OWN_SCOPE },
        ],
      },
    });

    if (!website) {
      return { success: false, message: `No website registered for domain or ID: ${domainOrId}` };
    }

    if (!website.isVerified) {
      return {
        success: false,
        message: `Website ${website.domain} is not verified. Audit permission denied.`,
      };
    }

    if (!website.webhookSecret) {
      return {
        success: false,
        message: `No webhook secret is configured for ${website.domain}, so webhook triggers are disabled for it.`,
      };
    }

    if (!this.secretMatches(website.webhookSecret, secretToken)) {
      return { success: false, message: 'Invalid webhook authentication token.' };
    }

    const jobId = await this.crawlerService.startCrawlJob(website.id);
    return {
      success: true,
      jobId,
      message: `Successfully triggered automated audit for ${website.domain} via webhook.`,
    };
  }

  private secretMatches(expected: string, provided?: string): boolean {
    if (!provided) return false;

    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(provided, 'utf8');
    const length = Math.max(a.length, b.length);
    const padded = (buf: Buffer) => Buffer.concat([buf, Buffer.alloc(length - buf.length)]);

    return timingSafeEqual(padded(a), padded(b)) && a.length === b.length;
  }
}
