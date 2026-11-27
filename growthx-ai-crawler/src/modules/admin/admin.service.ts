import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { QueueService } from '../queue/queue.service';
import { PrismaService } from '../../database/prisma.service';
import { TokensService } from '../tokens/tokens.service';
import { CrawlerService } from '../crawler/crawler.service';
import { CrawlerProcessor } from '../crawler/crawler.processor';
import { MultiAiRouterService } from '../ai-search/multi-ai-router/multi-ai-router.service';
import { AiTask } from '../ai-search/multi-ai-router/multi-ai-router.types';
import {
  AiRouterProbeDto,
  TriggerWebsiteCrawlDto,
  UpdateAdminTenantDto,
  UpdateAdminWebsiteDto,
  UpdateAiRouterConfigDto,
} from './admin.dto';

function isConfiguredEnvKey(raw: string | undefined): boolean {
  if (!raw) return false;
  const trimmed = raw.trim();
  if (!trimmed) return false;
  return !/^your[-_]|^changeme|^placeholder|^sk-placeholder/i.test(trimmed);
}

function startOfUtcMonth(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
}

function parseRedisInfo(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of raw.split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf(':');
    if (idx > 0) out[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  return out;
}

@Injectable()
export class AdminService {
  constructor(
    private readonly queueService: QueueService,
    private readonly prisma: PrismaService,
    private readonly tokens: TokensService,
    @Optional() private readonly crawlerService?: CrawlerService,
    @Optional() private readonly crawlerProcessor?: CrawlerProcessor,
    @Optional() private readonly aiRouter?: MultiAiRouterService,
  ) {}

  private managedQueues() {
    return [
      { name: 'crawl-jobs', queue: this.queueService?.crawlJobsQueue },
      { name: 'page-fetch', queue: this.queueService?.pageFetchQueue },
      { name: 'page-render', queue: this.queueService?.pageRenderQueue },
    ];
  }

  private selectQueues(queueName?: string) {
    const all = this.managedQueues();
    if (!queueName) return all;
    const filtered = all.filter((q) => q.name === queueName);
    if (filtered.length === 0) {
      throw new NotFoundException(`Unknown queue "${queueName}"`);
    }
    return filtered;
  }

  // ───────────────────────────────────────────── QUEUES & BULLMQ RUNTIME

  async getQueueStats() {
    const queues = this.managedQueues();
    const stats = [];

    for (const q of queues) {
      if (q.queue) {
        const [active, waiting, delayed, completed, failed, paused] = await Promise.all([
          q.queue.getActiveCount(),
          q.queue.getWaitingCount(),
          typeof q.queue.getDelayedCount === 'function' ? q.queue.getDelayedCount() : Promise.resolve(0),
          q.queue.getCompletedCount(),
          q.queue.getFailedCount(),
          typeof q.queue.isPaused === 'function' ? q.queue.isPaused().catch(() => false) : Promise.resolve(false),
        ]);
        stats.push({
          name: q.name,
          active,
          waiting,
          delayed,
          completed,
          failed,
          paused,
          avgTime: 'N/A',
          status: paused ? 'paused' : 'active',
        });
      } else {
        stats.push({
          name: q.name,
          active: 0,
          waiting: 0,
          delayed: 0,
          completed: 0,
          failed: 0,
          paused: false,
          avgTime: '0.0s',
          status: 'idle',
        });
      }
    }
    return stats;
  }

  async getFailedJobs(limit = 40) {
    const perQueue = Math.max(5, Math.min(30, Math.ceil(limit / 2)));
    const results: Array<{
      id: string;
      queue: string;
      name: string;
      domain: string | null;
      targetUrl: string | null;
      crawlJobId: string | null;
      failedReason: string;
      attemptsMade: number;
      timestamp: string | null;
    }> = [];

    for (const q of this.managedQueues()) {
      if (!q.queue || typeof q.queue.getFailed !== 'function') continue;
      try {
        const failed = await q.queue.getFailed(0, perQueue - 1);
        for (const job of failed) {
          const data = (job.data ?? {}) as Record<string, any>;
          const ts = job.finishedOn || job.processedOn || job.timestamp;
          results.push({
            id: String(job.id ?? ''),
            queue: q.name,
            name: job.name || q.name,
            domain: typeof data.domain === 'string' ? data.domain : null,
            targetUrl:
              typeof data.targetUrl === 'string'
                ? data.targetUrl
                : typeof data.startUrl === 'string'
                  ? data.startUrl
                  : null,
            crawlJobId: typeof data.jobId === 'string' ? data.jobId : null,
            failedReason: String(job.failedReason || 'Unknown failure').slice(0, 500),
            attemptsMade: job.attemptsMade ?? 0,
            timestamp: ts ? new Date(ts).toISOString() : null,
          });
        }
      } catch {
        // Ignore Redis inspection errors for a single queue
      }
    }

    return results
      .sort((a, b) => (b.timestamp ?? '').localeCompare(a.timestamp ?? ''))
      .slice(0, limit);
  }

  async getQueueJobs(queueName: string, state: string, limit = 30) {
    const [target] = this.selectQueues(queueName);
    if (!target.queue) return [];

    const allowedStates = ['failed', 'active', 'waiting', 'delayed', 'completed'] as const;
    const normalized = allowedStates.includes(state as any) ? (state as (typeof allowedStates)[number]) : 'failed';
    const cap = Math.max(1, Math.min(60, limit));

    try {
      const jobs = await target.queue.getJobs([normalized], 0, cap - 1, true);
      return jobs.map((job) => {
        const data = (job.data ?? {}) as Record<string, any>;
        return {
          id: String(job.id ?? ''),
          queue: target.name,
          state: normalized,
          name: job.name || target.name,
          domain: typeof data.domain === 'string' ? data.domain : null,
          targetUrl:
            typeof data.targetUrl === 'string'
              ? data.targetUrl
              : typeof data.startUrl === 'string'
                ? data.startUrl
                : null,
          crawlJobId: typeof data.jobId === 'string' ? data.jobId : null,
          attemptsMade: job.attemptsMade ?? 0,
          failedReason: job.failedReason ? String(job.failedReason).slice(0, 800) : null,
          stacktrace: Array.isArray(job.stacktrace) ? job.stacktrace.slice(0, 3) : [],
          timestamp: job.timestamp ? new Date(job.timestamp).toISOString() : null,
          processedOn: job.processedOn ? new Date(job.processedOn).toISOString() : null,
          finishedOn: job.finishedOn ? new Date(job.finishedOn).toISOString() : null,
          data,
        };
      });
    } catch {
      return [];
    }
  }

  async removeQueueJob(queueName: string, jobId: string) {
    const [target] = this.selectQueues(queueName);
    if (!target.queue) throw new ServiceUnavailableException(`Queue "${queueName}" is not connected.`);
    const job = await target.queue.getJob(jobId);
    if (!job) throw new NotFoundException(`Job "${jobId}" not found in queue "${queueName}"`);
    await job.remove();
    return { success: true, queue: queueName, jobId };
  }

  async drainQueue(queueName: string, delayed = false) {
    const [target] = this.selectQueues(queueName);
    if (!target.queue) throw new ServiceUnavailableException(`Queue "${queueName}" is not connected.`);
    await target.queue.drain(Boolean(delayed));
    return { success: true, queue: queueName, drainedDelayed: Boolean(delayed) };
  }

  async pauseQueues(queueName?: string) {
    const targets = this.selectQueues(queueName);
    const affected: string[] = [];
    for (const q of targets) {
      if (q.queue) {
        await q.queue.pause();
        affected.push(q.name);
      }
    }
    return { success: true, status: 'PAUSED', queues: affected };
  }

  async resumeQueues(queueName?: string) {
    const targets = this.selectQueues(queueName);
    const affected: string[] = [];
    for (const q of targets) {
      if (q.queue) {
        await q.queue.resume();
        affected.push(q.name);
      }
    }
    return { success: true, status: 'ACTIVE', queues: affected };
  }

  async retryFailedJobs(queueName?: string, jobId?: string) {
    let retriedCount = 0;
    const targets = this.selectQueues(queueName);

    for (const q of targets) {
      if (!q.queue) continue;
      try {
        if (jobId) {
          const job = await q.queue.getJob(jobId);
          if (job) {
            await job.retry();
            retriedCount++;
          }
        } else {
          const failed = await q.queue.getFailed();
          for (const job of failed) {
            await job.retry();
            retriedCount++;
          }
        }
      } catch {
        // ignore queue inspection errors
      }
    }
    return { success: true, retriedCount };
  }

  async cleanFailedJobs(queueName?: string) {
    let cleanedCount = 0;
    const targets = this.selectQueues(queueName);

    for (const q of targets) {
      if (!q.queue || typeof q.queue.clean !== 'function') continue;
      try {
        const removed = await q.queue.clean(0, 500, 'failed');
        cleanedCount += Array.isArray(removed) ? removed.length : 0;
      } catch {
        // ignore clean errors
      }
    }
    return { success: true, cleanedCount };
  }

  // ───────────────────────────────────────────── RUNTIME & INFRASTRUCTURE

  async getSystemRuntime() {
    const mem = process.memoryUsage();
    const cpu = process.cpuUsage();

    let dbSizePretty: string | null = null;
    let activeConnections: number | null = null;
    try {
      const sizeRows = (await this.prisma.$queryRaw<
        Array<{ size_pretty: string; active_conns: number }>
      >`SELECT pg_size_pretty(pg_database_size(current_database())) AS size_pretty, (SELECT count(*)::int FROM pg_stat_activity WHERE datname = current_database()) AS active_conns`) as any[];
      if (sizeRows?.[0]) {
        dbSizePretty = sizeRows[0].size_pretty ?? null;
        activeConnections = Number(sizeRows[0].active_conns ?? 0);
      }
    } catch {
      // Ignore if DB role restricts pg_stat_activity
    }

    const safeCount = (delegate: any) =>
      delegate && typeof delegate.count === 'function' ? delegate.count().catch(() => 0) : Promise.resolve(0);

    const [
      organizations,
      users,
      projects,
      websites,
      crawlJobs,
      pages,
      issues,
      aiUsageRecords,
      tokenTransactions,
      auditLogs,
    ] = await Promise.all([
      safeCount(this.prisma.organization),
      safeCount(this.prisma.user),
      safeCount(this.prisma.project),
      safeCount(this.prisma.website),
      safeCount(this.prisma.crawlJob),
      safeCount(this.prisma.page),
      safeCount(this.prisma.issue),
      safeCount(this.prisma.aiUsageRecord),
      safeCount(this.prisma.tokenTransaction),
      safeCount(this.prisma.auditLog),
    ]);

    let redisInfo: {
      connected: boolean;
      status: string;
      usedMemoryHuman: string | null;
      connectedClients: number | null;
      uptimeSec: number | null;
      opsPerSec: number | null;
      hitRatePct: number | null;
      maxmemoryPolicy: string | null;
    } = {
      connected: false,
      status: 'disconnected',
      usedMemoryHuman: null,
      connectedClients: null,
      uptimeSec: null,
      opsPerSec: null,
      hitRatePct: null,
      maxmemoryPolicy: null,
    };

    const redisClient =
      this.queueService && typeof (this.queueService as any).getRedisClient === 'function'
        ? (this.queueService as any).getRedisClient()
        : null;

    if (redisClient) {
      redisInfo.connected = redisClient.status === 'ready';
      redisInfo.status = String(redisClient.status || 'unknown');
      try {
        const raw = await redisClient.info();
        const parsed = parseRedisInfo(String(raw));
        const hits = Number(parsed.keyspace_hits || 0);
        const misses = Number(parsed.keyspace_misses || 0);
        redisInfo = {
          connected: redisClient.status === 'ready',
          status: String(redisClient.status || 'ready'),
          usedMemoryHuman: parsed.used_memory_human ?? null,
          connectedClients: parsed.connected_clients ? Number(parsed.connected_clients) : null,
          uptimeSec: parsed.uptime_in_seconds ? Number(parsed.uptime_in_seconds) : null,
          opsPerSec: parsed.instantaneous_ops_per_sec ? Number(parsed.instantaneous_ops_per_sec) : null,
          hitRatePct: hits + misses > 0 ? Number(((hits / (hits + misses)) * 100).toFixed(1)) : null,
          maxmemoryPolicy: parsed.maxmemory_policy ?? null,
        };
      } catch {
        // Keep basic status if INFO command is restricted
      }
    }

    // Strictly non-secret runtime flags and tuning parameters only
    const envFlags: Array<{ key: string; value: string }> = [
      { key: 'NODE_ENV', value: process.env.NODE_ENV || 'development' },
      { key: 'AI_PROVIDERS', value: process.env.AI_PROVIDERS || '(all configured)' },
      { key: 'AI_TIERED_ROUTING', value: process.env.AI_TIERED_ROUTING || 'true' },
      { key: 'AI_FAST_TIERS', value: process.env.AI_FAST_TIERS || 'founder_free,starter' },
      { key: 'CRAWL_SPLIT_RENDER_QUEUE', value: process.env.CRAWL_SPLIT_RENDER_QUEUE || 'false' },
      {
        key: 'MAX_RENDER_CONCURRENCY',
        value: process.env.MAX_RENDER_CONCURRENCY || process.env.MAX_PLAYWRIGHT_CONCURRENCY || '3',
      },
      { key: 'CRAWLER_JOB_CONCURRENCY', value: process.env.CRAWLER_JOB_CONCURRENCY || '5' },
      { key: 'CRAWLER_WORKER_CONCURRENCY', value: process.env.CRAWLER_WORKER_CONCURRENCY || '(auto)' },
      { key: 'PAGE_FETCH_LOCK_MS', value: process.env.PAGE_FETCH_LOCK_MS || '180000' },
      { key: 'TOKENS_MODE', value: process.env.TOKENS_MODE || 'shadow' },
      { key: 'TOKENS_MONTHLY_ALLOWANCE', value: process.env.TOKENS_MONTHLY_ALLOWANCE || '(default)' },
      { key: 'WORKER_MODE', value: process.env.WORKER_MODE || 'enabled' },
    ];

    return {
      process: {
        nodeVersion: process.version,
        platform: `${process.platform}/${process.arch}`,
        pid: process.pid,
        uptimeSec: Math.round(process.uptime()),
        rssMb: Math.round(mem.rss / 1024 / 1024),
        heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
        heapTotalMb: Math.round(mem.heapTotal / 1024 / 1024),
        externalMb: Math.round(mem.external / 1024 / 1024),
        cpuUserMs: Math.round(cpu.user / 1000),
        cpuSystemMs: Math.round(cpu.system / 1000),
      },
      database: {
        sizePretty: dbSizePretty,
        activeConnections,
        tableCounts: {
          organizations,
          users,
          projects,
          websites,
          crawlJobs,
          pages,
          issues,
          aiUsageRecords,
          tokenTransactions,
          auditLogs,
        },
      },
      redis: redisInfo,
      workers: this.crawlerProcessor?.workerStatus ?? {
        crawlJobs: false,
        pageFetch: false,
        pageRender: false,
        splitRenderQueue: process.env.CRAWL_SPLIT_RENDER_QUEUE === 'true',
        disabledByEnv: process.env.WORKER_MODE === 'false' || process.env.DISABLE_WORKERS === 'true',
      },
      envFlags,
      timestamp: new Date().toISOString(),
    };
  }

  // ───────────────────────────────────────────── WEBSITE AUDIT & CRAWLER ENGINE

  async getWebsites(limit = 100) {
    if (!this.prisma.website) return [];
    const websites = await this.prisma.website.findMany({
      orderBy: { updatedAt: 'desc' },
      take: Math.max(10, Math.min(250, limit)),
      include: {
        project: {
          select: {
            id: true,
            name: true,
            organization: { select: { id: true, name: true, subscriptionTier: true } },
          },
        },
        crawlJobs: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            status: true,
            pagesCrawled: true,
            pagesDiscovered: true,
            issuesFound: true,
            healthScore: true,
            errorMessage: true,
            startedAt: true,
            finishedAt: true,
            createdAt: true,
          },
        },
        _count: { select: { crawlJobs: true } },
      },
    });

    return websites.map((w: any) => {
      const latest = w.crawlJobs?.[0] ?? null;
      return {
        id: w.id,
        domain: w.domain,
        url: w.url,
        scope: w.scope,
        isVerified: Boolean(w.isVerified),
        verifiedAt: w.verifiedAt ? w.verifiedAt.toISOString() : null,
        crawlFrequency: w.crawlFrequency,
        maxConcurrency: w.maxConcurrency,
        maxDepth: w.maxDepth,
        rateLimitDelayMs: w.rateLimitDelayMs,
        projectId: w.project?.id ?? null,
        projectName: w.project?.name ?? null,
        organizationId: w.project?.organization?.id ?? null,
        organizationName: w.project?.organization?.name ?? null,
        subscriptionTier: w.project?.organization?.subscriptionTier ?? null,
        totalCrawls: w._count?.crawlJobs ?? 0,
        latestCrawl: latest
          ? {
              id: latest.id,
              status: latest.status,
              pagesCrawled: latest.pagesCrawled,
              pagesDiscovered: latest.pagesDiscovered,
              issuesFound: latest.issuesFound,
              healthScore: latest.healthScore,
              errorMessage: latest.errorMessage,
              startedAt: latest.startedAt ? latest.startedAt.toISOString() : null,
              finishedAt: latest.finishedAt ? latest.finishedAt.toISOString() : null,
              createdAt: latest.createdAt.toISOString(),
            }
          : null,
        updatedAt: w.updatedAt.toISOString(),
      };
    });
  }

  async updateWebsite(websiteId: string, dto: UpdateAdminWebsiteDto, actorUserId?: string) {
    const existing = await this.prisma.website.findUnique({
      where: { id: websiteId },
      include: { project: { select: { organizationId: true } } },
    });
    if (!existing) throw new NotFoundException(`Website "${websiteId}" not found`);

    const data: Prisma.WebsiteUpdateInput = {};
    if (dto.isVerified !== undefined) {
      data.isVerified = dto.isVerified;
      data.verifiedAt = dto.isVerified ? existing.verifiedAt ?? new Date() : null;
    }
    if (dto.crawlFrequency !== undefined) data.crawlFrequency = dto.crawlFrequency as any;
    if (dto.maxConcurrency !== undefined) data.maxConcurrency = dto.maxConcurrency;
    if (dto.maxDepth !== undefined) data.maxDepth = dto.maxDepth;
    if (dto.rateLimitDelayMs !== undefined) data.rateLimitDelayMs = dto.rateLimitDelayMs;

    const updated = await this.prisma.website.update({
      where: { id: websiteId },
      data,
    });

    const orgId = existing.project?.organizationId;
    if (orgId && this.prisma.auditLog?.create) {
      await this.prisma.auditLog
        .create({
          data: {
            organizationId: orgId,
            userId: actorUserId ?? null,
            action: 'ADMIN_WEBSITE_CONFIG_UPDATED',
            resource: `website:${websiteId}`,
            details: {
              domain: existing.domain,
              changes: dto as any,
            },
          },
        })
        .catch(() => {});
    }

    return updated;
  }

  async triggerWebsiteCrawl(websiteId: string, dto: TriggerWebsiteCrawlDto, actorUserId?: string) {
    if (!this.crawlerService) {
      throw new ServiceUnavailableException('CrawlerService is unavailable in this process.');
    }
    const website = await this.prisma.website.findUnique({
      where: { id: websiteId },
      include: { project: { select: { organizationId: true } } },
    });
    if (!website) throw new NotFoundException(`Website "${websiteId}" not found`);

    if (dto.forceVerify && !website.isVerified) {
      await this.prisma.website.update({
        where: { id: websiteId },
        data: { isVerified: true, verifiedAt: new Date() },
      });
    }

    const jobId = await this.crawlerService.startCrawlJob(websiteId, {
      maxConcurrency: dto.maxConcurrency,
      maxDepth: dto.maxDepth,
      pageLimit: dto.pageLimit,
      rateLimitDelayMs: dto.rateLimitDelayMs,
      renderBudget: dto.renderBudget,
      useSitemap: dto.useSitemap,
    });

    const orgId = website.project?.organizationId;
    if (orgId && this.prisma.auditLog?.create) {
      await this.prisma.auditLog
        .create({
          data: {
            organizationId: orgId,
            userId: actorUserId ?? null,
            action: 'ADMIN_CRAWL_TRIGGERED',
            resource: `crawl:${jobId}`,
            details: { websiteId, domain: website.domain, overrides: dto as any },
          },
        })
        .catch(() => {});
    }

    return { success: true, jobId, websiteId, domain: website.domain };
  }

  async getCrawlDetail(jobId: string) {
    const job = await this.prisma.crawlJob.findUnique({
      where: { id: jobId },
      include: {
        website: {
          select: {
            id: true,
            domain: true,
            url: true,
            scope: true,
            project: { select: { id: true, name: true, organization: { select: { id: true, name: true } } } },
          },
        },
      },
    });
    if (!job) throw new NotFoundException(`Crawl job "${jobId}" not found`);

    const [frontierStats, issueSeverities, pageStatusCodes, sampleIssues, problemPages, redisPending] =
      await Promise.all([
        this.prisma.crawlFrontier
          ? this.prisma.crawlFrontier
              .groupBy({
                by: ['state'],
                where: { crawlJobId: jobId },
                _count: { _all: true },
              })
              .catch(() => [])
          : Promise.resolve([]),
        this.prisma.issue
          ? this.prisma.issue
              .groupBy({
                by: ['severity'],
                where: { crawlJobId: jobId },
                _count: { _all: true },
              })
              .catch(() => [])
          : Promise.resolve([]),
        this.prisma.page
          ? this.prisma.page
              .groupBy({
                by: ['statusCode'],
                where: { crawlJobId: jobId },
                _count: { _all: true },
              })
              .catch(() => [])
          : Promise.resolve([]),
        this.prisma.issue
          ? this.prisma.issue
              .findMany({
                where: { crawlJobId: jobId },
                orderBy: { createdAt: 'desc' },
                take: 25,
                select: {
                  id: true,
                  severity: true,
                  category: true,
                  issueType: true,
                  description: true,
                  affectedUrl: true,
                },
              })
              .catch(() => [])
          : Promise.resolve([]),
        this.prisma.page
          ? this.prisma.page
              .findMany({
                where: { crawlJobId: jobId, OR: [{ statusCode: { gte: 400 } }, { statusCode: 0 }] },
                take: 20,
                select: { id: true, url: true, statusCode: true, responseTimeMs: true, wordCount: true },
              })
              .catch(() => [])
          : Promise.resolve([]),
        this.queueService && typeof this.queueService.getPendingTasks === 'function'
          ? this.queueService.getPendingTasks(jobId).catch(() => 0)
          : Promise.resolve(0),
      ]);

    return {
      id: job.id,
      websiteId: job.websiteId,
      domain: job.website.domain,
      url: job.website.url,
      scope: job.website.scope,
      projectName: job.website.project?.name ?? null,
      organizationName: job.website.project?.organization?.name ?? null,
      status: job.status,
      pagesCrawled: job.pagesCrawled,
      pagesDiscovered: job.pagesDiscovered,
      issuesFound: job.issuesFound,
      uniqueIssuesCount: job.uniqueIssuesCount,
      healthScore: job.healthScore,
      concurrency: job.concurrency,
      depthLimit: job.depthLimit,
      pageLimit: job.pageLimit,
      errorMessage: job.errorMessage,
      qualityDiagnostics: job.qualityDiagnostics ?? null,
      redisPendingTasks: redisPending,
      startedAt: job.startedAt ? job.startedAt.toISOString() : null,
      finishedAt: job.finishedAt ? job.finishedAt.toISOString() : null,
      createdAt: job.createdAt.toISOString(),
      frontierByStatus: Object.fromEntries(
        (frontierStats as any[]).map((r) => [r.state, r._count?._all ?? 0]),
      ),
      issuesBySeverity: Object.fromEntries(
        (issueSeverities as any[]).map((r) => [r.severity, r._count?._all ?? 0]),
      ),
      pagesByStatusCode: (pageStatusCodes as any[])
        .map((r) => ({ statusCode: r.statusCode, count: r._count?._all ?? 0 }))
        .sort((a, b) => b.count - a.count),
      sampleIssues: (sampleIssues as any[]).map((i) => ({
        id: i.id,
        severity: i.severity,
        category: i.category ?? 'GENERAL',
        issueType: i.issueType,
        title: i.description,
        url: i.affectedUrl,
      })),
      problemPages: (problemPages as any[]).map((p) => ({
        id: p.id,
        url: p.url,
        statusCode: p.statusCode,
        loadTimeMs: p.responseTimeMs,
        wordCount: p.wordCount,
      })),
    };
  }

  async cancelCrawl(jobId: string, actorUserId?: string) {
    const existing = await this.prisma.crawlJob.findUnique({
      where: { id: jobId },
      include: { website: { include: { project: { select: { organizationId: true } } } } },
    });
    if (!existing) throw new NotFoundException(`Crawl job "${jobId}" not found`);

    let cancelled = false;
    if (this.crawlerService) {
      cancelled = await this.crawlerService.cancelCrawlJob(jobId);
    } else {
      const res = await this.prisma.crawlJob.updateMany({
        where: { id: jobId, status: { in: ['PENDING', 'RUNNING'] } },
        data: { status: 'CANCELLED', finishedAt: new Date(), errorMessage: 'Cancelled by platform operator.' },
      });
      cancelled = res.count > 0;
    }

    if (this.queueService && typeof this.queueService.forgetJobTasks === 'function') {
      await this.queueService.forgetJobTasks(jobId).catch(() => {});
    }

    const orgId = existing.website?.project?.organizationId;
    if (orgId && this.prisma.auditLog?.create) {
      await this.prisma.auditLog
        .create({
          data: {
            organizationId: orgId,
            userId: actorUserId ?? null,
            action: 'ADMIN_CRAWL_CANCELLED',
            resource: `crawl:${jobId}`,
            details: { domain: existing.website?.domain, cancelled },
          },
        })
        .catch(() => {});
    }

    return { success: true, jobId, cancelled };
  }

  async forceFailCrawl(jobId: string, reason?: string, actorUserId?: string) {
    const existing = await this.prisma.crawlJob.findUnique({
      where: { id: jobId },
      include: { website: { include: { project: { select: { organizationId: true } } } } },
    });
    if (!existing) throw new NotFoundException(`Crawl job "${jobId}" not found`);

    const msg = reason?.trim() || 'Force-closed by platform operator.';
    const updated = await this.prisma.crawlJob.update({
      where: { id: jobId },
      data: {
        status: 'FAILED',
        finishedAt: existing.finishedAt ?? new Date(),
        errorMessage: msg,
      },
      select: { id: true, status: true, errorMessage: true, finishedAt: true },
    });

    if (this.queueService && typeof this.queueService.forgetJobTasks === 'function') {
      await this.queueService.forgetJobTasks(jobId).catch(() => {});
    }

    const orgId = existing.website?.project?.organizationId;
    if (orgId && this.prisma.auditLog?.create) {
      await this.prisma.auditLog
        .create({
          data: {
            organizationId: orgId,
            userId: actorUserId ?? null,
            action: 'ADMIN_CRAWL_FORCE_FAILED',
            resource: `crawl:${jobId}`,
            details: { domain: existing.website?.domain, reason: msg },
          },
        })
        .catch(() => {});
    }

    return { success: true, crawl: updated };
  }

  // ───────────────────────────────────────────── AI ROUTER LIVE CONTROL & PROBE

  getAiRouterConfig() {
    if (!this.aiRouter) {
      return {
        available: false,
        providers: [],
        taskMatrix: [],
        allowlist: null,
        fastRouteTiers: [],
        serverSideFallbackEnabled: false,
        caches: {
          responseCacheEntries: 0,
          responseCacheMaxEntries: 0,
          responseCacheTtlMs: 0,
          orgTierCacheEntries: 0,
        },
      };
    }
    return {
      available: true,
      ...this.aiRouter.getAdminDiagnostics(),
    };
  }

  updateAiRouterConfig(dto: UpdateAiRouterConfigDto) {
    if (!this.aiRouter) {
      throw new ServiceUnavailableException('MultiAiRouterService is unavailable in this process.');
    }
    if (dto.provider) {
      if (dto.enabled !== undefined) {
        this.aiRouter.setProviderRuntimeEnabled(dto.provider, dto.enabled);
      }
      if (dto.modelOverride !== undefined) {
        this.aiRouter.setProviderModelOverride(dto.provider, dto.modelOverride);
      }
    }
    if (dto.serverSideFallbackEnabled !== undefined) {
      this.aiRouter.setServerSideFallbackEnabled(dto.serverSideFallbackEnabled);
    }
    return this.getAiRouterConfig();
  }

  clearAiRouterCaches() {
    if (!this.aiRouter) {
      throw new ServiceUnavailableException('MultiAiRouterService is unavailable in this process.');
    }
    const counts = this.aiRouter.clearRuntimeCaches();
    return { success: true, ...counts };
  }

  async probeAiRouter(dto: AiRouterProbeDto) {
    if (!this.aiRouter) {
      throw new ServiceUnavailableException('MultiAiRouterService is unavailable in this process.');
    }
    const prompt = dto.prompt?.trim();
    if (!prompt) throw new BadRequestException('Prompt is required');

    const startedAt = Date.now();
    try {
      const completion = await this.aiRouter.generate({
        prompt,
        systemInstruction: dto.systemInstruction?.trim() || undefined,
        task: dto.task ?? AiTask.FAST,
        provider: dto.provider,
        model: dto.model?.trim() || undefined,
        maxTokens: dto.maxTokens ?? 400,
        allowFallback: dto.allowFallback !== false,
        cacheable: false,
      });
      return {
        ok: true,
        provider: completion.provider,
        model: completion.model,
        latencyMs: Date.now() - startedAt,
        refused: completion.refused,
        text: completion.text,
        usage: completion.usage,
        error: null,
      };
    } catch (err: any) {
      return {
        ok: false,
        provider: dto.provider ?? null,
        model: dto.model ?? null,
        latencyMs: Date.now() - startedAt,
        refused: false,
        text: '',
        usage: null,
        error: String(err?.message || 'AI probe failed'),
      };
    }
  }

  // ───────────────────────────────────────────── PIPELINES MONITOR

  async getPipelines(limit = 25) {
    const cap = Math.max(5, Math.min(60, limit));
    const [autopilotRuns, visibilityScans, backlinkRuns, automationRuns, researchRuns] = await Promise.all([
      this.prisma.autopilotRun
        ? this.prisma.autopilotRun
            .findMany({
              orderBy: { startedAt: 'desc' },
              take: cap,
              select: {
                id: true,
                domain: true,
                status: true,
                step: true,
                error: true,
                startedAt: true,
                finishedAt: true,
              },
            })
            .catch(() => [])
        : Promise.resolve([]),
      this.prisma.aiVisibilityScan
        ? this.prisma.aiVisibilityScan
            .findMany({
              orderBy: { createdAt: 'desc' },
              take: cap,
              select: {
                id: true,
                cycleId: true,
                status: true,
                errorMessage: true,
                startedAt: true,
                completedAt: true,
                createdAt: true,
                project: { select: { name: true, organization: { select: { name: true } } } },
                _count: { select: { runs: true } },
              },
            })
            .catch(() => [])
        : Promise.resolve([]),
      this.prisma.backlinkDiscoveryRun
        ? this.prisma.backlinkDiscoveryRun
            .findMany({
              orderBy: { startedAt: 'desc' },
              take: cap,
              select: {
                id: true,
                status: true,
                stage: true,
                candidates: true,
                added: true,
                verified: true,
                error: true,
                startedAt: true,
                finishedAt: true,
                project: { select: { name: true, organization: { select: { name: true } } } },
              },
            })
            .catch(() => [])
        : Promise.resolve([]),
      this.prisma.automationRun
        ? this.prisma.automationRun
            .findMany({
              orderBy: { startedAt: 'desc' },
              take: cap,
              select: {
                id: true,
                kind: true,
                status: true,
                branch: true,
                pullRequestUrl: true,
                filesChanged: true,
                error: true,
                startedAt: true,
                finishedAt: true,
                repository: { select: { owner: true, name: true } },
              },
            })
            .catch(() => [])
        : Promise.resolve([]),
      this.prisma.marketResearchRun
        ? this.prisma.marketResearchRun
            .findMany({
              orderBy: { startedAt: 'desc' },
              take: cap,
              select: {
                id: true,
                status: true,
                inputTokens: true,
                outputTokens: true,
                startedAt: true,
                finishedAt: true,
                error: true,
              },
            })
            .catch(() => [])
        : Promise.resolve([]),
    ]);

    return {
      autopilotRuns: (autopilotRuns as any[]).map((r) => ({
        id: r.id,
        domain: r.domain,
        status: r.status,
        step: r.step,
        error: r.error ?? null,
        startedAt: r.startedAt.toISOString(),
        finishedAt: r.finishedAt ? r.finishedAt.toISOString() : null,
      })),
      visibilityScans: (visibilityScans as any[]).map((s) => ({
        id: s.id,
        cycleId: s.cycleId,
        projectName: s.project?.name ?? null,
        organizationName: s.project?.organization?.name ?? null,
        status: s.status,
        providerRuns: s._count?.runs ?? 0,
        error: s.errorMessage ?? null,
        startedAt: (s.startedAt ?? s.createdAt).toISOString(),
        finishedAt: s.completedAt ? s.completedAt.toISOString() : null,
      })),
      backlinkRuns: (backlinkRuns as any[]).map((b) => ({
        id: b.id,
        projectName: b.project?.name ?? null,
        organizationName: b.project?.organization?.name ?? null,
        status: b.status,
        stage: b.stage,
        candidates: b.candidates,
        added: b.added,
        verified: b.verified,
        error: b.error ?? null,
        startedAt: b.startedAt.toISOString(),
        finishedAt: b.finishedAt ? b.finishedAt.toISOString() : null,
      })),
      automationRuns: (automationRuns as any[]).map((a) => ({
        id: a.id,
        kind: a.kind,
        status: a.status,
        repository: a.repository ? `${a.repository.owner}/${a.repository.name}` : null,
        branch: a.branch ?? null,
        pullRequestUrl: a.pullRequestUrl ?? null,
        filesCount: Array.isArray(a.filesChanged) ? a.filesChanged.length : 0,
        error: a.error ?? null,
        startedAt: a.startedAt.toISOString(),
        finishedAt: a.finishedAt ? a.finishedAt.toISOString() : null,
      })),
      researchRuns: (researchRuns as any[]).map((m) => ({
        id: m.id,
        status: m.status,
        tokens: (m.inputTokens ?? 0) + (m.outputTokens ?? 0),
        error: m.error ?? null,
        startedAt: m.startedAt.toISOString(),
        finishedAt: m.finishedAt ? m.finishedAt.toISOString() : null,
      })),
    };
  }

  // ───────────────────────────────────────────── EXISTING ANALYTICS, TENANTS, USERS

  async getApiCosts() {
    const runs = this.prisma.marketResearchRun
      ? await this.prisma.marketResearchRun
          .findMany({
            where: { modelUsage: { not: Prisma.DbNull } },
            select: { modelUsage: true, inputTokens: true, outputTokens: true },
            orderBy: { startedAt: 'desc' },
            take: 1000,
          })
          .catch(() => [])
      : [];

    const byModel = new Map<
      string,
      { tokens: number; cost: number; calls: number; errors: number; latencySum: number; latencyCount: number }
    >();

    for (const run of runs) {
      const steps = Array.isArray(run.modelUsage) ? (run.modelUsage as any[]) : [];
      for (const step of steps) {
        if (!step?.model) continue;
        const entry = byModel.get(step.model) ?? {
          tokens: 0,
          cost: 0,
          calls: 0,
          errors: 0,
          latencySum: 0,
          latencyCount: 0,
        };
        entry.tokens += (step.inputTokens ?? 0) + (step.outputTokens ?? 0);
        entry.cost += typeof step.costUsd === 'number' ? step.costUsd : 0;
        entry.calls += 1;
        byModel.set(step.model, entry);
      }
    }

    const routed = this.prisma.aiUsageRecord
      ? await this.prisma.aiUsageRecord
          .groupBy({
            by: ['provider', 'model', 'status'],
            _sum: { inputTokens: true, outputTokens: true, estimatedCostUsd: true, latencyMs: true },
            _count: { _all: true },
          })
          .catch(() => [])
      : [];

    for (const row of routed) {
      const service = `${row.provider} / ${row.model}`;
      const entry = byModel.get(service) ?? {
        tokens: 0,
        cost: 0,
        calls: 0,
        errors: 0,
        latencySum: 0,
        latencyCount: 0,
      };
      const count = row._count?._all ?? 0;
      entry.tokens += (row._sum?.inputTokens ?? 0) + (row._sum?.outputTokens ?? 0);
      entry.cost += row._sum?.estimatedCostUsd ?? 0;
      entry.calls += count;
      if (row.status !== 'OK') entry.errors += count;
      if (typeof row._sum?.latencyMs === 'number') {
        entry.latencySum += row._sum.latencyMs;
        entry.latencyCount += count;
      }
      byModel.set(service, entry);
    }

    return [...byModel.entries()]
      .sort((a, b) => b[1].tokens - a[1].tokens)
      .map(([service, totals]) => ({
        service,
        tokens: totals.tokens.toLocaleString(),
        totalTokens: totals.tokens,
        cost: Number(totals.cost.toFixed(4)),
        calls: totals.calls,
        errors: totals.errors,
        avgLatencyMs: totals.latencyCount > 0 ? Math.round(totals.latencySum / totals.latencyCount) : null,
      }));
  }

  async getTenants() {
    const monthStart = startOfUtcMonth();
    const orgs = await this.prisma.organization.findMany({
      include: {
        projects: {
          include: {
            websites: true,
          },
        },
        members: {
          include: {
            user: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const orgIds = orgs.map((org) => org.id);
    const [balances, mtdSpendRows] = await Promise.all([
      this.tokens.peek(orgIds),
      this.prisma.aiUsageRecord && orgIds.length > 0
        ? this.prisma.aiUsageRecord
            .groupBy({
              by: ['organizationId'],
              where: {
                organizationId: { in: orgIds },
                createdAt: { gte: monthStart },
              },
              _sum: { estimatedCostUsd: true, inputTokens: true, outputTokens: true },
              _count: { _all: true },
            })
            .catch(() => [])
        : Promise.resolve([]),
    ]);

    const spendByOrg = new Map<string, { spendUsd: number; calls: number; tokens: number }>();
    for (const row of mtdSpendRows as any[]) {
      if (!row.organizationId) continue;
      spendByOrg.set(row.organizationId, {
        spendUsd: Number((row._sum?.estimatedCostUsd ?? 0).toFixed(4)),
        calls: row._count?._all ?? 0,
        tokens: (row._sum?.inputTokens ?? 0) + (row._sum?.outputTokens ?? 0),
      });
    }

    return orgs.map((org: any) => {
      let totalSites = 0;
      for (const p of org.projects || []) {
        totalSites += (p.websites || []).length;
      }

      const ownerMember =
        (org.members || []).find((m: any) => m.role === 'OWNER') ?? (org.members || [])[0];
      const ownerEmail = ownerMember?.user?.email ?? null;
      const mtd = spendByOrg.get(org.id);

      return {
        id: org.id,
        name: org.name,
        slug: org.slug ?? null,
        owner: ownerEmail,
        tokens: balances.get(org.id) ?? null,
        sites: totalSites,
        projectCount: (org.projects || []).length,
        memberCount: (org.members || []).length,
        subscriptionTier: org.subscriptionTier ?? 'founder_free',
        aiMonthlyBudgetUsd: org.aiMonthlyBudgetUsd ?? null,
        whiteLabelEnabled: Boolean(org.whiteLabelEnabled),
        mtdAiSpendUsd: mtd?.spendUsd ?? 0,
        mtdAiCalls: mtd?.calls ?? 0,
        createdAt: org.createdAt ? new Date(org.createdAt).toISOString() : null,
        status: 'active',
      };
    });
  }

  async getTenantDetail(orgId: string) {
    const now = new Date();
    const monthStart = startOfUtcMonth(now);

    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                emailVerifiedAt: true,
                isPlatformAdmin: true,
                createdAt: true,
                sessions: {
                  where: { revokedAt: null, expiresAt: { gt: now } },
                  select: { id: true },
                },
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        projects: {
          include: {
            websites: {
              include: {
                crawlJobs: {
                  orderBy: { createdAt: 'desc' },
                  take: 1,
                  select: {
                    id: true,
                    status: true,
                    pagesCrawled: true,
                    issuesFound: true,
                    healthScore: true,
                    finishedAt: true,
                    createdAt: true,
                  },
                },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        auditLogs: {
          orderBy: { createdAt: 'desc' },
          take: 15,
          include: {
            user: { select: { email: true, firstName: true, lastName: true } },
          },
        },
      },
    });

    if (!org) {
      throw new NotFoundException(`Organization "${orgId}" not found`);
    }

    const [aiAgg, recentAiErrors] = await Promise.all([
      this.prisma.aiUsageRecord
        ? this.prisma.aiUsageRecord
            .aggregate({
              where: { organizationId: orgId, createdAt: { gte: monthStart } },
              _sum: { estimatedCostUsd: true, inputTokens: true, outputTokens: true },
              _count: { _all: true },
            })
            .catch(() => null)
        : Promise.resolve(null),
      this.prisma.aiUsageRecord
        ? this.prisma.aiUsageRecord
            .count({
              where: { organizationId: orgId, createdAt: { gte: monthStart }, status: { not: 'OK' } },
            })
            .catch(() => 0)
        : Promise.resolve(0),
    ]);

    return {
      id: org.id,
      name: org.name,
      slug: org.slug,
      subscriptionTier: org.subscriptionTier,
      aiMonthlyBudgetUsd: org.aiMonthlyBudgetUsd,
      whiteLabelEnabled: org.whiteLabelEnabled,
      createdAt: org.createdAt.toISOString(),
      mtdAiSpendUsd: Number((aiAgg?._sum?.estimatedCostUsd ?? 0).toFixed(4)),
      mtdAiTokens: (aiAgg?._sum?.inputTokens ?? 0) + (aiAgg?._sum?.outputTokens ?? 0),
      mtdAiCalls: aiAgg?._count?._all ?? 0,
      mtdAiErrors: recentAiErrors,
      members: org.members.map((m) => ({
        id: m.user.id,
        email: m.user.email,
        name: [m.user.firstName, m.user.lastName].filter(Boolean).join(' ') || m.user.email.split('@')[0],
        role: m.role,
        emailVerified: Boolean(m.user.emailVerifiedAt),
        isPlatformAdmin: Boolean(m.user.isPlatformAdmin),
        isLoggedIn: m.user.sessions.length > 0,
        activeSessionsCount: m.user.sessions.length,
        joinedAt: m.createdAt.toISOString(),
      })),
      projects: org.projects.map((p) => ({
        id: p.id,
        name: p.name,
        createdAt: p.createdAt.toISOString(),
        websites: p.websites.map((w) => {
          const latest = w.crawlJobs[0] ?? null;
          return {
            id: w.id,
            domain: w.domain,
            isVerified: w.isVerified,
            crawlFrequency: w.crawlFrequency,
            latestCrawl: latest
              ? {
                  id: latest.id,
                  status: latest.status,
                  pagesCrawled: latest.pagesCrawled,
                  issuesFound: latest.issuesFound,
                  healthScore: latest.healthScore,
                  finishedAt: latest.finishedAt ? latest.finishedAt.toISOString() : null,
                  createdAt: latest.createdAt.toISOString(),
                }
              : null,
          };
        }),
      })),
      recentAuditLogs: org.auditLogs.map((log) => ({
        id: log.id,
        action: log.action,
        resource: log.resource,
        details: log.details,
        actorEmail: log.user?.email ?? null,
        createdAt: log.createdAt.toISOString(),
      })),
    };
  }

  async updateTenant(orgId: string, dto: UpdateAdminTenantDto, actorUserId?: string) {
    const existing = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: {
        id: true,
        name: true,
        subscriptionTier: true,
        aiMonthlyBudgetUsd: true,
        whiteLabelEnabled: true,
      },
    });
    if (!existing) {
      throw new NotFoundException(`Organization "${orgId}" not found`);
    }

    const data: Prisma.OrganizationUpdateInput = {};
    if (dto.subscriptionTier !== undefined) data.subscriptionTier = dto.subscriptionTier;
    if (dto.aiMonthlyBudgetUsd !== undefined) data.aiMonthlyBudgetUsd = dto.aiMonthlyBudgetUsd;
    if (dto.whiteLabelEnabled !== undefined) data.whiteLabelEnabled = dto.whiteLabelEnabled;

    const updated = await this.prisma.organization.update({
      where: { id: orgId },
      data,
      select: {
        id: true,
        name: true,
        subscriptionTier: true,
        aiMonthlyBudgetUsd: true,
        whiteLabelEnabled: true,
        updatedAt: true,
      },
    });

    if (this.prisma.auditLog?.create) {
      await this.prisma.auditLog
        .create({
          data: {
            organizationId: orgId,
            userId: actorUserId ?? null,
            action: 'ADMIN_TENANT_UPDATED',
            resource: `organization:${orgId}`,
            details: {
              before: {
                subscriptionTier: existing.subscriptionTier,
                aiMonthlyBudgetUsd: existing.aiMonthlyBudgetUsd,
                whiteLabelEnabled: existing.whiteLabelEnabled,
              },
              after: {
                subscriptionTier: updated.subscriptionTier,
                aiMonthlyBudgetUsd: updated.aiMonthlyBudgetUsd,
                whiteLabelEnabled: updated.whiteLabelEnabled,
              },
            },
          },
        })
        .catch(() => {});
    }

    return updated;
  }

  private configuredAiProviders(): string[] {
    if (this.aiRouter) {
      return this.aiRouter.configuredProviders().map((p) => p.toLowerCase());
    }
    const allowlistRaw = process.env.AI_PROVIDERS;
    const allowlist = allowlistRaw
      ? new Set(
          allowlistRaw
            .split(',')
            .map((s) => s.trim().toLowerCase())
            .filter(Boolean),
        )
      : null;

    const candidates: Array<{ name: string; env: string | undefined }> = [
      { name: 'mammouth', env: process.env.MAMMOUTH_API_KEY },
      { name: 'sarvam', env: process.env.SARVAM_API_KEY },
      { name: 'gemini', env: process.env.GEMINI_API_KEY },
      { name: 'openai', env: process.env.OPENAI_API_KEY },
      { name: 'anthropic', env: process.env.ANTHROPIC_API_KEY },
      { name: 'groq', env: process.env.GROQ_API_KEY },
      { name: 'openrouter', env: process.env.OPENROUTER_API_KEY },
      { name: 'perplexity', env: process.env.PERPLEXITY_API_KEY },
    ];

    return candidates
      .filter((c) => isConfiguredEnvKey(c.env) && (!allowlist || allowlist.has(c.name)))
      .map((c) => c.name);
  }

  async getSystemHealth() {
    const startTime = Date.now();
    let dbStatus = 'CONNECTED';
    let dbLatencyMs = 0;

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      dbLatencyMs = Date.now() - startTime;
    } catch {
      dbStatus = 'DISCONNECTED';
    }

    const queueStats = await this.getQueueStats();
    const connectedQueues = queueStats.filter((q) => q.status !== 'idle');
    const pausedQueues = queueStats.filter((q) => q.paused);
    const redisConnected = connectedQueues.length > 0;
    const totalActiveQueueJobs = queueStats.reduce((sum, q) => sum + q.active, 0);
    const totalWaitingQueueJobs = queueStats.reduce((sum, q) => sum + q.waiting, 0);
    const totalFailedQueueJobs = queueStats.reduce((sum, q) => sum + q.failed, 0);

    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [runningCrawls, ai24hAll, ai24hErrors] = await Promise.all([
      this.prisma.crawlJob
        ? this.prisma.crawlJob.count({ where: { status: 'RUNNING' } }).catch(() => 0)
        : Promise.resolve(0),
      this.prisma.aiUsageRecord
        ? this.prisma.aiUsageRecord
            .aggregate({
              where: { createdAt: { gte: since24h } },
              _count: { _all: true },
              _avg: { latencyMs: true },
            })
            .catch(() => null)
        : Promise.resolve(null),
      this.prisma.aiUsageRecord
        ? this.prisma.aiUsageRecord
            .count({ where: { createdAt: { gte: since24h }, status: { not: 'OK' } } })
            .catch(() => 0)
        : Promise.resolve(0),
    ]);

    const configuredProviders = this.configuredAiProviders();
    const aiCalls24h = ai24hAll?._count?._all ?? 0;
    const aiErrorRatePct = aiCalls24h > 0 ? Number(((ai24hErrors / aiCalls24h) * 100).toFixed(1)) : 0;
    const aiAvgLatencyMs = ai24hAll?._avg?.latencyMs ? Math.round(ai24hAll._avg.latencyMs) : null;

    const allQueuesPaused = connectedQueues.length > 0 && pausedQueues.length === connectedQueues.length;
    const overallHealthy =
      dbStatus === 'CONNECTED' &&
      redisConnected &&
      !allQueuesPaused &&
      configuredProviders.length > 0;

    return {
      status: overallHealthy ? 'HEALTHY' : 'DEGRADED',
      database: {
        status: dbStatus,
        latencyMs: dbLatencyMs,
      },
      redis: {
        status: !redisConnected ? 'DISCONNECTED' : allQueuesPaused ? 'PAUSED' : 'CONNECTED',
        queuesActive: redisConnected,
        connectedQueues: connectedQueues.length,
        pausedQueues: pausedQueues.length,
        totalQueues: queueStats.length,
      },
      crawlerCluster: {
        status: !redisConnected ? 'OFFLINE' : allQueuesPaused ? 'PAUSED' : 'OPERATIONAL',
        activeWorkers: totalActiveQueueJobs,
        runningCrawls,
        waitingJobs: totalWaitingQueueJobs,
        failedJobs: totalFailedQueueJobs,
        headlessEngine: 'Chromium / BullMQ',
      },
      aiRouter: {
        status: configuredProviders.length === 0 ? 'UNCONFIGURED' : aiErrorRatePct >= 25 ? 'DEGRADED' : 'OPERATIONAL',
        configuredProviders,
        primaryModel: configuredProviders[0] ?? 'None configured',
        fallbackProvider: configuredProviders.slice(1).join(', ') || 'None',
        calls24h: aiCalls24h,
        errors24h: ai24hErrors,
        errorRatePct: aiErrorRatePct,
        avgLatencyMs: aiAvgLatencyMs,
      },
      timestamp: new Date().toISOString(),
    };
  }

  async getStats() {
    const now = new Date();
    const [tenants, users, projects, activeSessions] = await Promise.all([
      this.prisma.organization.count(),
      this.prisma.user.count(),
      this.prisma.project.count(),
      this.prisma.refreshSession
        ? this.prisma.refreshSession
            .findMany({
              where: {
                revokedAt: null,
                expiresAt: { gt: now },
              },
              select: { userId: true },
            })
            .catch(() => [])
        : Promise.resolve([]),
    ]);
    const loggedInUserIds = new Set((activeSessions || []).map((s: { userId: string }) => s.userId));
    return {
      tenants,
      users,
      projects,
      loggedInUsers: loggedInUserIds.size,
      activeSessions: activeSessions ? activeSessions.length : 0,
    };
  }

  async getOpsSummary() {
    const now = new Date();
    const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const monthStart = startOfUtcMonth(now);

    const [
      crawls24h,
      aiMtd,
      aiErrors24h,
      tierGroups,
      webhookFailures24h,
      syncFailures24h,
      recentFailedCrawls,
      orgsWithBudget,
    ] = await Promise.all([
      this.prisma.crawlJob
        ? this.prisma.crawlJob
            .groupBy({
              by: ['status'],
              where: { createdAt: { gte: since24h } },
              _count: { _all: true },
            })
            .catch(() => [])
        : Promise.resolve([]),
      this.prisma.aiUsageRecord
        ? this.prisma.aiUsageRecord
            .aggregate({
              where: { createdAt: { gte: monthStart } },
              _sum: { estimatedCostUsd: true, inputTokens: true, outputTokens: true },
              _avg: { latencyMs: true },
              _count: { _all: true },
            })
            .catch(() => null)
        : Promise.resolve(null),
      this.prisma.aiUsageRecord
        ? this.prisma.aiUsageRecord
            .count({ where: { createdAt: { gte: since24h }, status: { not: 'OK' } } })
            .catch(() => 0)
        : Promise.resolve(0),
      this.prisma.organization
        .groupBy({
          by: ['subscriptionTier'],
          _count: { _all: true },
        })
        .catch(() => []),
      this.prisma.webhookDeliveryLog
        ? this.prisma.webhookDeliveryLog
            .count({ where: { createdAt: { gte: since24h }, status: 'FAILED' } })
            .catch(() => 0)
        : Promise.resolve(0),
      this.prisma.dataSyncJob
        ? this.prisma.dataSyncJob
            .count({ where: { startedAt: { gte: since24h }, status: 'FAILED' } })
            .catch(() => 0)
        : Promise.resolve(0),
      this.prisma.crawlJob
        ? this.prisma.crawlJob
            .findMany({
              where: { status: 'FAILED', createdAt: { gte: since24h } },
              orderBy: { createdAt: 'desc' },
              take: 6,
              select: {
                id: true,
                errorMessage: true,
                createdAt: true,
                website: { select: { domain: true, project: { select: { organization: { select: { name: true } } } } } },
              },
            })
            .catch(() => [])
        : Promise.resolve([]),
      this.prisma.organization
        .findMany({
          where: { aiMonthlyBudgetUsd: { not: null } },
          select: { id: true, name: true, aiMonthlyBudgetUsd: true },
        })
        .catch(() => []),
    ]);

    const crawlCounts = { completed: 0, failed: 0, running: 0, pending: 0 };
    for (const row of crawls24h as any[]) {
      const c = row._count?._all ?? 0;
      if (row.status === 'COMPLETED') crawlCounts.completed += c;
      else if (row.status === 'FAILED') crawlCounts.failed += c;
      else if (row.status === 'RUNNING') crawlCounts.running += c;
      else crawlCounts.pending += c;
    }

    const tierBreakdown: Record<string, number> = {};
    for (const row of tierGroups as any[]) {
      tierBreakdown[row.subscriptionTier || 'founder_free'] = row._count?._all ?? 0;
    }

    const alerts: Array<{
      id: string;
      severity: 'critical' | 'warn' | 'info';
      category: 'crawl' | 'ai' | 'budget' | 'webhook' | 'sync';
      title: string;
      detail: string;
      timestamp: string | null;
    }> = [];

    for (const fc of recentFailedCrawls as any[]) {
      alerts.push({
        id: `crawl-${fc.id}`,
        severity: 'critical',
        category: 'crawl',
        title: `Crawl failed for ${fc.website?.domain ?? 'unknown site'}`,
        detail: `${fc.website?.project?.organization?.name ?? 'Tenant'} · ${(fc.errorMessage || 'No error recorded').slice(0, 140)}`,
        timestamp: fc.createdAt ? new Date(fc.createdAt).toISOString() : null,
      });
    }

    if (aiErrors24h > 0) {
      alerts.push({
        id: 'ai-errors-24h',
        severity: aiErrors24h >= 10 ? 'critical' : 'warn',
        category: 'ai',
        title: `${aiErrors24h} AI provider call${aiErrors24h === 1 ? '' : 's'} failed in the last 24h`,
        detail: 'Inspect AI_ROUTER for provider error messages, latency, and circuit breakers.',
        timestamp: now.toISOString(),
      });
    }

    if (webhookFailures24h > 0) {
      alerts.push({
        id: 'webhook-failures-24h',
        severity: 'warn',
        category: 'webhook',
        title: `${webhookFailures24h} outgoing webhook delivery failure${webhookFailures24h === 1 ? '' : 's'} (24h)`,
        detail: 'Inspect PIPELINES_AUDIT -> Webhooks for target hosts and HTTP status codes.',
        timestamp: now.toISOString(),
      });
    }

    if (syncFailures24h > 0) {
      alerts.push({
        id: 'sync-failures-24h',
        severity: 'warn',
        category: 'sync',
        title: `${syncFailures24h} Google data sync job${syncFailures24h === 1 ? '' : 's'} failed (24h)`,
        detail: 'Inspect QUEUE_RUNTIME -> Google Data Syncs for affected projects.',
        timestamp: now.toISOString(),
      });
    }

    if (orgsWithBudget.length > 0 && this.prisma.aiUsageRecord) {
      const budgetOrgIds = orgsWithBudget.map((o) => o.id);
      const spends = await this.prisma.aiUsageRecord
        .groupBy({
          by: ['organizationId'],
          where: { organizationId: { in: budgetOrgIds }, createdAt: { gte: monthStart } },
          _sum: { estimatedCostUsd: true },
        })
        .catch(() => []);
      const spendMap = new Map<string, number>();
      for (const s of spends as any[]) {
        if (s.organizationId) spendMap.set(s.organizationId, s._sum?.estimatedCostUsd ?? 0);
      }
      for (const org of orgsWithBudget) {
        const cap = org.aiMonthlyBudgetUsd ?? 0;
        const spent = spendMap.get(org.id) ?? 0;
        if (cap > 0 && spent >= cap * 0.8) {
          const pct = Math.round((spent / cap) * 100);
          alerts.push({
            id: `budget-${org.id}`,
            severity: pct >= 100 ? 'critical' : 'warn',
            category: 'budget',
            title: `${org.name} at ${pct}% of monthly AI budget`,
            detail: `$${spent.toFixed(2)} spent of $${cap.toFixed(2)} monthly cap.`,
            timestamp: now.toISOString(),
          });
        }
      }
    }

    return {
      crawls24h: crawlCounts,
      aiMtd: {
        spendUsd: Number((aiMtd?._sum?.estimatedCostUsd ?? 0).toFixed(4)),
        calls: aiMtd?._count?._all ?? 0,
        tokens: (aiMtd?._sum?.inputTokens ?? 0) + (aiMtd?._sum?.outputTokens ?? 0),
        avgLatencyMs: aiMtd?._avg?.latencyMs ? Math.round(aiMtd._avg.latencyMs) : null,
        errors24h: aiErrors24h,
      },
      tierBreakdown,
      webhookFailures24h,
      syncFailures24h,
      alerts: alerts.slice(0, 12),
    };
  }

  async getUsers() {
    const now = new Date();
    const users = await this.prisma.user.findMany({
      include: {
        memberships: {
          include: {
            organization: true,
          },
        },
        sessions: {
          select: {
            id: true,
            expiresAt: true,
            revokedAt: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 250,
    });

    const userIds = users.map((u) => u.id);
    const orgIds = [
      ...new Set(users.flatMap((u) => u.memberships.map((m) => m.organizationId)).filter(Boolean)),
    ];

    const tokenAiUsage = this.prisma.tokenTransaction
      ? await this.prisma.tokenTransaction
          .findMany({
            where: {
              action: 'AI_USAGE',
              OR: [{ userId: { in: userIds } }, { organizationId: { in: orgIds } }],
            },
            select: {
              userId: true,
              organizationId: true,
              detail: true,
              createdAt: true,
            },
            orderBy: { createdAt: 'desc' },
            take: 1000,
          })
          .catch(() => [])
      : [];

    const orgAiRecords = this.prisma.aiUsageRecord
      ? await this.prisma.aiUsageRecord
          .findMany({
            where: {
              organizationId: { in: orgIds },
            },
            select: {
              organizationId: true,
              provider: true,
              model: true,
              inputTokens: true,
              outputTokens: true,
              createdAt: true,
            },
            orderBy: { createdAt: 'desc' },
            take: 1000,
          })
          .catch(() => [])
      : [];

    const userAiMap = new Map<string, { models: Set<string>; totalCalls: number; lastUsedAt: string | null }>();

    for (const tx of tokenAiUsage) {
      const targetUserId = tx.userId;
      if (!targetUserId) continue;
      const detail = (tx.detail as Record<string, any>) || {};
      const model = detail.model || detail.provider;
      if (!userAiMap.has(targetUserId)) {
        userAiMap.set(targetUserId, { models: new Set(), totalCalls: 0, lastUsedAt: null });
      }
      const entry = userAiMap.get(targetUserId)!;
      entry.totalCalls++;
      if (model) entry.models.add(model);
      if (!entry.lastUsedAt || new Date(tx.createdAt) > new Date(entry.lastUsedAt)) {
        entry.lastUsedAt = tx.createdAt.toISOString();
      }
    }

    const orgToUsers = new Map<string, string[]>();
    for (const u of users) {
      for (const m of u.memberships) {
        if (!orgToUsers.has(m.organizationId)) {
          orgToUsers.set(m.organizationId, []);
        }
        orgToUsers.get(m.organizationId)!.push(u.id);
      }
    }

    for (const rec of orgAiRecords) {
      if (!rec.organizationId) continue;
      const memberUserIds = orgToUsers.get(rec.organizationId) || [];
      const modelName = `${rec.provider} / ${rec.model}`;
      for (const uid of memberUserIds) {
        if (!userAiMap.has(uid)) {
          userAiMap.set(uid, { models: new Set(), totalCalls: 0, lastUsedAt: null });
        }
        const entry = userAiMap.get(uid)!;
        entry.totalCalls++;
        entry.models.add(modelName);
        if (!entry.lastUsedAt || new Date(rec.createdAt) > new Date(entry.lastUsedAt)) {
          entry.lastUsedAt = rec.createdAt.toISOString();
        }
      }
    }

    return users.map((u: any) => {
      const primaryMembership = u.memberships[0];
      const fullName = [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email.split('@')[0];
      const sessions = u.sessions || [];
      const activeSessions = sessions.filter((s: any) => !s.revokedAt && s.expiresAt > now);
      const isLoggedIn = activeSessions.length > 0;
      const lastLoginAt = sessions[0]?.createdAt ? sessions[0].createdAt.toISOString() : null;

      const aiData = userAiMap.get(u.id);
      const modelsUsed = aiData ? Array.from(aiData.models) : [];
      const hasGoogle = Boolean(u.googleSub);
      const hasPassword = u.passwordAuthEnabled !== false;
      const authProvider = hasGoogle && hasPassword ? 'both' : hasGoogle ? 'google' : 'password';

      return {
        id: u.id,
        email: u.email,
        name: fullName,
        role: primaryMembership?.role || 'MEMBER',
        organizationName: primaryMembership?.organization?.name || 'Unassigned',
        organizationId: primaryMembership?.organizationId || null,
        membershipsCount: u.memberships.length,
        createdAt: u.createdAt.toISOString(),
        emailVerified: Boolean(u.emailVerifiedAt),
        isPlatformAdmin: Boolean(u.isPlatformAdmin && !u.platformAdminRevokedAt),
        platformAdminRevoked: Boolean(u.platformAdminRevokedAt),
        authProvider,
        isLoggedIn,
        activeSessionsCount: activeSessions.length,
        lastLoginAt,
        status: isLoggedIn ? 'ONLINE' : 'OFFLINE',
        modelsUsed,
        aiCallsCount: aiData?.totalCalls ?? 0,
        lastAiUsedAt: aiData?.lastUsedAt ?? null,
      };
    });
  }

  async verifyUserEmail(userId: string, actorUserId?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        emailVerifiedAt: true,
        memberships: { select: { organizationId: true }, take: 1 },
      },
    });
    if (!user) throw new NotFoundException(`User "${userId}" not found`);

    const now = user.emailVerifiedAt ?? new Date();
    await this.prisma.user.update({
      where: { id: userId },
      data: { emailVerifiedAt: now },
    });

    const primaryOrgId = user.memberships[0]?.organizationId;
    if (primaryOrgId && this.prisma.auditLog?.create) {
      await this.prisma.auditLog
        .create({
          data: {
            organizationId: primaryOrgId,
            userId: actorUserId ?? null,
            action: 'ADMIN_USER_EMAIL_VERIFIED',
            resource: `user:${userId}`,
            details: { targetEmail: user.email, verifiedAt: now.toISOString() },
          },
        })
        .catch(() => {});
    }

    return { success: true, userId, emailVerifiedAt: now.toISOString() };
  }

  async revokeUserSessions(userId: string, actorUserId?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        memberships: { select: { organizationId: true }, take: 1 },
      },
    });
    if (!user) {
      throw new NotFoundException(`User "${userId}" not found`);
    }

    const now = new Date();
    const [, revoked] = await Promise.all([
      this.prisma.user.update({
        where: { id: userId },
        data: { sessionsInvalidatedAt: now },
      }),
      this.prisma.refreshSession.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: now },
      }),
    ]);

    const primaryOrgId = user.memberships[0]?.organizationId;
    if (primaryOrgId && this.prisma.auditLog?.create) {
      await this.prisma.auditLog
        .create({
          data: {
            organizationId: primaryOrgId,
            userId: actorUserId ?? null,
            action: 'ADMIN_USER_SESSIONS_REVOKED',
            resource: `user:${userId}`,
            details: {
              targetUserId: userId,
              targetEmail: user.email,
              revokedSessions: revoked.count,
            },
          },
        })
        .catch(() => {});
    }

    return {
      success: true,
      userId,
      revokedSessions: revoked.count,
      invalidatedAt: now.toISOString(),
    };
  }

  async getUserModelBreakdown() {
    const [aiRecords, users, tokenUsage] = await Promise.all([
      this.prisma.aiUsageRecord
        ? this.prisma.aiUsageRecord
            .findMany({
              orderBy: { createdAt: 'desc' },
              take: 2000,
            })
            .catch(() => [])
        : [],
      this.prisma.user.findMany({
        include: {
          memberships: {
            include: { organization: true },
          },
        },
      }),
      this.prisma.tokenTransaction
        ? this.prisma.tokenTransaction
            .findMany({
              where: { action: 'AI_USAGE' },
              orderBy: { createdAt: 'desc' },
              take: 2000,
            })
            .catch(() => [])
        : [],
    ]);

    const orgUsersMap = new Map<
      string,
      Array<{ id: string; name: string; email: string; orgName: string; role?: string }>
    >();
    const userById = new Map<string, { id: string; name: string; email: string; orgName: string }>();

    for (const u of users) {
      const fullName = [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email.split('@')[0];
      const primaryOrg = u.memberships[0]?.organization?.name || 'Unassigned';
      userById.set(u.id, {
        id: u.id,
        name: fullName,
        email: u.email,
        orgName: primaryOrg,
      });
      for (const m of u.memberships) {
        if (!orgUsersMap.has(m.organizationId)) {
          orgUsersMap.set(m.organizationId, []);
        }
        orgUsersMap.get(m.organizationId)!.push({
          id: u.id,
          name: fullName,
          email: u.email,
          orgName: m.organization.name,
          role: m.role,
        });
      }
    }

    const breakdown = new Map<
      string,
      {
        userId: string;
        userName: string;
        userEmail: string;
        organizationName: string;
        provider: string;
        model: string;
        calls: number;
        inputTokens: number;
        outputTokens: number;
        totalTokens: number;
        cost: number;
        lastUsedAt: string;
      }
    >();

    for (const tx of tokenUsage) {
      if (!tx.userId && !tx.organizationId) continue;
      const detail = (tx.detail as Record<string, any>) || {};
      const provider = detail.provider || 'AI Router';
      const model = detail.model || detail.task || 'General AI';
      const inTokens = detail.inputTokens ?? 0;
      const outTokens = detail.outputTokens ?? 0;

      const user = tx.userId ? userById.get(tx.userId) : null;
      const usersInOrg = tx.organizationId ? orgUsersMap.get(tx.organizationId) || [] : [];
      const target =
        user ??
        (usersInOrg.length === 1
          ? usersInOrg[0]
          : usersInOrg.length > 1
            ? {
                id: `org:${tx.organizationId}`,
                name: `${usersInOrg[0].orgName} (Workspace)`,
                email: `${usersInOrg.length} members`,
                orgName: usersInOrg[0].orgName,
              }
            : null);
      if (!target) continue;

      const key = `${target.id}:${provider}:${model}`;
      if (!breakdown.has(key)) {
        breakdown.set(key, {
          userId: target.id,
          userName: target.name,
          userEmail: target.email,
          organizationName: target.orgName,
          provider,
          model,
          calls: 0,
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          cost: 0,
          lastUsedAt: tx.createdAt.toISOString(),
        });
      }
      const item = breakdown.get(key)!;
      item.calls++;
      item.inputTokens += inTokens;
      item.outputTokens += outTokens;
      item.totalTokens += inTokens + outTokens;
      if (new Date(tx.createdAt) > new Date(item.lastUsedAt)) {
        item.lastUsedAt = tx.createdAt.toISOString();
      }
    }

    for (const record of aiRecords) {
      const usersInOrg = record.organizationId ? orgUsersMap.get(record.organizationId) || [] : [];
      const target =
        usersInOrg.length === 1
          ? usersInOrg[0]
          : usersInOrg.length > 1
            ? {
                id: `org:${record.organizationId}`,
                name: `${usersInOrg[0].orgName} (Workspace)`,
                email: `${usersInOrg.length} members`,
                orgName: usersInOrg[0].orgName,
              }
            : { id: 'system', name: 'System Background', email: 'Platform Worker', orgName: 'Platform Worker' };

      const key = `${target.id}:${record.provider}:${record.model}`;
      if (!breakdown.has(key)) {
        breakdown.set(key, {
          userId: target.id,
          userName: target.name,
          userEmail: target.email,
          organizationName: target.orgName,
          provider: record.provider,
          model: record.model,
          calls: 0,
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          cost: 0,
          lastUsedAt: record.createdAt.toISOString(),
        });
      }
      const item = breakdown.get(key)!;
      item.calls++;
      item.inputTokens += record.inputTokens;
      item.outputTokens += record.outputTokens;
      item.totalTokens += record.inputTokens + record.outputTokens;
      item.cost += record.estimatedCostUsd ?? 0;
      if (new Date(record.createdAt) > new Date(item.lastUsedAt)) {
        item.lastUsedAt = record.createdAt.toISOString();
      }
    }

    return Array.from(breakdown.values()).sort((a, b) => b.totalTokens - a.totalTokens);
  }

  async getAiAnalytics(days = 14) {
    const windowDays = Math.max(7, Math.min(90, days));
    const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

    const [records, orgs] = await Promise.all([
      this.prisma.aiUsageRecord
        ? this.prisma.aiUsageRecord
            .findMany({
              where: { createdAt: { gte: since } },
              orderBy: { createdAt: 'desc' },
              take: 5000,
              select: {
                id: true,
                organizationId: true,
                taskType: true,
                provider: true,
                model: true,
                inputTokens: true,
                outputTokens: true,
                estimatedCostUsd: true,
                latencyMs: true,
                status: true,
                error: true,
                createdAt: true,
              },
            })
            .catch(() => [])
        : Promise.resolve([]),
      this.prisma.organization
        .findMany({
          select: { id: true, name: true, aiMonthlyBudgetUsd: true },
        })
        .catch(() => []),
    ]);

    const orgById = new Map<string, { name: string; budgetUsd: number | null }>();
    for (const o of orgs) {
      orgById.set(o.id, { name: o.name, budgetUsd: o.aiMonthlyBudgetUsd ?? null });
    }

    const dailyMap = new Map<
      string,
      { date: string; calls: number; errors: number; tokens: number; costUsd: number }
    >();
    for (let i = windowDays - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const iso = d.toISOString().slice(0, 10);
      dailyMap.set(iso, { date: iso, calls: 0, errors: 0, tokens: 0, costUsd: 0 });
    }

    const byTaskMap = new Map<
      string,
      { taskType: string; calls: number; errors: number; latencySum: number; tokens: number; costUsd: number }
    >();
    const byOrgMap = new Map<
      string,
      {
        organizationId: string;
        organizationName: string;
        calls: number;
        errors: number;
        tokens: number;
        costUsd: number;
        budgetUsd: number | null;
        lastUsedAt: string;
      }
    >();

    const recentErrors: Array<{
      id: string;
      createdAt: string;
      provider: string;
      model: string;
      taskType: string;
      status: string;
      latencyMs: number;
      error: string | null;
      organizationName: string;
    }> = [];

    for (const rec of records) {
      const dateKey = rec.createdAt.toISOString().slice(0, 10);
      const tokens = (rec.inputTokens ?? 0) + (rec.outputTokens ?? 0);
      const cost = rec.estimatedCostUsd ?? 0;
      const isErr = rec.status !== 'OK';

      const day = dailyMap.get(dateKey);
      if (day) {
        day.calls += 1;
        if (isErr) day.errors += 1;
        day.tokens += tokens;
        day.costUsd += cost;
      }

      const task = byTaskMap.get(rec.taskType) ?? {
        taskType: rec.taskType,
        calls: 0,
        errors: 0,
        latencySum: 0,
        tokens: 0,
        costUsd: 0,
      };
      task.calls += 1;
      if (isErr) task.errors += 1;
      task.latencySum += rec.latencyMs ?? 0;
      task.tokens += tokens;
      task.costUsd += cost;
      byTaskMap.set(rec.taskType, task);

      const orgId = rec.organizationId ?? 'system';
      const orgMeta = rec.organizationId ? orgById.get(rec.organizationId) : undefined;
      const orgEntry = byOrgMap.get(orgId) ?? {
        organizationId: orgId,
        organizationName: orgMeta?.name ?? (rec.organizationId ? 'Deleted Organization' : 'System Worker'),
        calls: 0,
        errors: 0,
        tokens: 0,
        costUsd: 0,
        budgetUsd: orgMeta?.budgetUsd ?? null,
        lastUsedAt: rec.createdAt.toISOString(),
      };
      orgEntry.calls += 1;
      if (isErr) orgEntry.errors += 1;
      orgEntry.tokens += tokens;
      orgEntry.costUsd += cost;
      if (rec.createdAt.toISOString() > orgEntry.lastUsedAt) {
        orgEntry.lastUsedAt = rec.createdAt.toISOString();
      }
      byOrgMap.set(orgId, orgEntry);

      if (isErr && recentErrors.length < 25) {
        recentErrors.push({
          id: rec.id,
          createdAt: rec.createdAt.toISOString(),
          provider: rec.provider,
          model: rec.model,
          taskType: rec.taskType,
          status: rec.status,
          latencyMs: rec.latencyMs,
          error: rec.error ?? null,
          organizationName: orgEntry.organizationName,
        });
      }
    }

    return {
      windowDays,
      dailyTrend: [...dailyMap.values()].map((d) => ({
        ...d,
        costUsd: Number(d.costUsd.toFixed(4)),
      })),
      byTask: [...byTaskMap.values()]
        .map((t) => ({
          taskType: t.taskType,
          calls: t.calls,
          errors: t.errors,
          errorRatePct: t.calls > 0 ? Number(((t.errors / t.calls) * 100).toFixed(1)) : 0,
          avgLatencyMs: t.calls > 0 ? Math.round(t.latencySum / t.calls) : 0,
          tokens: t.tokens,
          costUsd: Number(t.costUsd.toFixed(4)),
        }))
        .sort((a, b) => b.costUsd - a.costUsd || b.tokens - a.tokens),
      byOrganization: [...byOrgMap.values()]
        .map((o) => ({
          ...o,
          costUsd: Number(o.costUsd.toFixed(4)),
        }))
        .sort((a, b) => b.costUsd - a.costUsd || b.tokens - a.tokens),
      recentErrors,
    };
  }

  async getRecentCrawls(limit = 40) {
    const [crawls, syncJobs] = await Promise.all([
      this.prisma.crawlJob
        ? this.prisma.crawlJob
            .findMany({
              orderBy: { createdAt: 'desc' },
              take: limit,
              select: {
                id: true,
                websiteId: true,
                status: true,
                pagesCrawled: true,
                pagesDiscovered: true,
                issuesFound: true,
                healthScore: true,
                errorMessage: true,
                startedAt: true,
                finishedAt: true,
                createdAt: true,
                website: {
                  select: {
                    domain: true,
                    scope: true,
                    project: {
                      select: {
                        name: true,
                        organization: { select: { id: true, name: true } },
                      },
                    },
                  },
                },
              },
            })
            .catch(() => [])
        : Promise.resolve([]),
      this.prisma.dataSyncJob
        ? this.prisma.dataSyncJob
            .findMany({
              orderBy: { startedAt: 'desc' },
              take: Math.min(limit, 30),
            })
            .catch(() => [])
        : Promise.resolve([]),
    ]);

    const syncProjectIds = [...new Set(syncJobs.map((s) => s.projectId).filter(Boolean))];
    const syncProjects =
      syncProjectIds.length > 0
        ? await this.prisma.project
            .findMany({
              where: { id: { in: syncProjectIds } },
              select: { id: true, name: true, organization: { select: { name: true } } },
            })
            .catch(() => [])
        : [];
    const projectMap = new Map(syncProjects.map((p) => [p.id, p]));

    return {
      crawls: crawls.map((c: any) => ({
        id: c.id,
        websiteId: c.websiteId,
        domain: c.website?.domain ?? 'unknown',
        scope: c.website?.scope ?? 'own',
        projectName: c.website?.project?.name ?? null,
        organizationName: c.website?.project?.organization?.name ?? null,
        status: c.status,
        pagesCrawled: c.pagesCrawled,
        pagesDiscovered: c.pagesDiscovered,
        issuesFound: c.issuesFound,
        healthScore: c.healthScore,
        errorMessage: c.errorMessage,
        startedAt: c.startedAt ? c.startedAt.toISOString() : null,
        finishedAt: c.finishedAt ? c.finishedAt.toISOString() : null,
        createdAt: c.createdAt.toISOString(),
        durationSec:
          c.startedAt && c.finishedAt
            ? Math.max(0, Math.round((c.finishedAt.getTime() - c.startedAt.getTime()) / 1000))
            : null,
      })),
      syncJobs: syncJobs.map((s) => {
        const proj = projectMap.get(s.projectId);
        return {
          id: s.id,
          projectId: s.projectId,
          projectName: proj?.name ?? null,
          organizationName: proj?.organization?.name ?? null,
          provider: s.provider,
          status: s.status,
          rowsWritten: s.rowsWritten,
          errorMessage: s.errorMessage,
          startedAt: s.startedAt.toISOString(),
          finishedAt: s.finishedAt ? s.finishedAt.toISOString() : null,
        };
      }),
    };
  }

  async getAuditLogs(limit = 100) {
    if (!this.prisma.auditLog) return [];
    const logs = await this.prisma.auditLog
      .findMany({
        orderBy: { createdAt: 'desc' },
        take: Math.max(10, Math.min(200, limit)),
        include: {
          organization: { select: { id: true, name: true } },
          user: { select: { id: true, email: true, firstName: true, lastName: true } },
        },
      })
      .catch(() => []);

    return logs.map((log: any) => ({
      id: log.id,
      action: log.action,
      resource: log.resource ?? null,
      details: log.details ?? null,
      organizationId: log.organizationId,
      organizationName: log.organization?.name ?? 'Unknown',
      actorId: log.userId ?? null,
      actorEmail: log.user?.email ?? null,
      actorName: log.user
        ? [log.user.firstName, log.user.lastName].filter(Boolean).join(' ') || log.user.email
        : null,
      createdAt: log.createdAt.toISOString(),
    }));
  }

  async getWebhooks(limit = 40) {
    const [incoming, deliveries] = await Promise.all([
      this.prisma.webhookEvent
        ? this.prisma.webhookEvent
            .findMany({
              orderBy: { createdAt: 'desc' },
              take: limit,
              select: {
                id: true,
                provider: true,
                eventId: true,
                eventType: true,
                processedAt: true,
                error: true,
                createdAt: true,
              },
            })
            .catch(() => [])
        : Promise.resolve([]),
      this.prisma.webhookDeliveryLog
        ? this.prisma.webhookDeliveryLog
            .findMany({
              orderBy: { createdAt: 'desc' },
              take: limit,
              include: {
                project: { select: { name: true, organization: { select: { name: true } } } },
              },
            })
            .catch(() => [])
        : Promise.resolve([]),
    ]);

    return {
      incoming: incoming.map((e: any) => ({
        id: e.id,
        provider: e.provider,
        eventId: e.eventId,
        eventType: e.eventType,
        processedAt: e.processedAt ? e.processedAt.toISOString() : null,
        error: e.error ?? null,
        createdAt: e.createdAt.toISOString(),
      })),
      deliveries: deliveries.map((d: any) => ({
        id: d.id,
        channel: d.channel,
        event: d.event,
        targetHost: d.targetHost,
        status: d.status,
        statusCode: d.statusCode ?? null,
        latencyMs: d.latencyMs,
        summary: d.summary,
        error: d.error ?? null,
        projectName: d.project?.name ?? null,
        organizationName: d.project?.organization?.name ?? null,
        createdAt: d.createdAt.toISOString(),
      })),
    };
  }
}
