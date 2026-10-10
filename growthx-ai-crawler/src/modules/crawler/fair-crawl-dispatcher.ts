import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { QueueService, CrawlJobPayload, PageFetchPayload } from '../queue/queue.service';
import { FrontierService } from './frontier/frontier.service';
import { CrawlerService } from './crawler.service';

import { prioritizeSites } from './crawl-priority';

/** Reuses the existing Postgres frontier; BullMQ holds only a bounded window.
 * Organization turns include all its own and competitor sites together. */
@Injectable()
export class FairCrawlDispatcher implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(FairCrawlDispatcher.name);
  private timer?: NodeJS.Timeout;
  private busy = false;
  constructor(private readonly prisma: PrismaService, private readonly queue: QueueService,
    private readonly frontier: FrontierService, private readonly crawler: CrawlerService) {}

  onModuleInit(): void {
    if (process.env.CRAWL_FAIR_SCHEDULING !== 'true' || process.env.WORKER_MODE === 'false') return;
    void this.queue.ready.then(() => {
      this.timer = setInterval(() => { void this.pump(); }, 500);
      this.timer.unref?.();
      void this.pump();
    });
  }
  onModuleDestroy(): void { if (this.timer) clearInterval(this.timer); }

  async pump(): Promise<void> {
    const redis = this.queue.getRedisClient();
    const pageQueue = this.queue.pageFetchQueue;
    if (this.busy || !redis || !pageQueue) return;
    this.busy = true;
    const token = `${process.pid}-${Date.now()}-${Math.random()}`;
    const lock = 'crawl:fair:dispatch-lock';
    let acquired = false;
    try {
      acquired = await redis.set(lock, token, 'PX', 30000, 'NX') === 'OK';
      if (!acquired) return;
      const counts = await pageQueue.getJobCounts('waiting', 'active', 'delayed', 'prioritized');
      const window = Math.max(1, Math.min(100, Number(process.env.CRAWL_DISPATCH_WINDOW || 12)));
      let free = Math.max(0, window - Object.values(counts).reduce((n, c) => n + c, 0));
      const jobs = await this.prisma.crawlJob.findMany({
        where: { status: 'RUNNING' }, orderBy: { createdAt: 'asc' },
        include: { website: { include: { project: { select: { organizationId: true } } } } },
      });
      const groups = new Map<string, typeof jobs>();
      for (const job of jobs) {
        const diagnostics = job.qualityDiagnostics as any;
        if (!diagnostics?.dispatchReady || !diagnostics.crawlConfig) continue;
        let owner = job.website.project?.organizationId;
        if (!owner && job.website.scope.startsWith('competitor:')) {
          const project = await this.prisma.project.findUnique({ where: { id: job.website.scope.slice(11) }, select: { organizationId: true } });
          owner = project?.organizationId;
        }
        const key = owner ?? job.websiteId;
        const group = groups.get(key) ?? []; group.push(job); groups.set(key, group);
        // Recover a reservation made before Queue.add, without duplicating a
        // job still waiting or running in BullMQ.
        const stale = await this.prisma.crawlFrontier.findMany({
          where: { crawlJobId: job.id, state: 'IN_PROGRESS', claimedAt: { lt: new Date(Date.now() - 60000) } }, take: window,
        });
        for (const row of stale) {
          const queued = await pageQueue.getJob(`frontier-${row.id}`);
          const state = queued ? await queued.getState() : 'missing';
          if (state === 'missing' || state === 'completed') {
            await this.prisma.crawlFrontier.updateMany({ where: { id: row.id, state: 'IN_PROGRESS' }, data: { state: 'PENDING', claimedAt: null } });
            if (queued) await queued.remove();
          } else if (state === 'failed') {
            await this.crawler.failPageFetchTask(queued!.data, queued!.failedReason || 'Queue task failed');
          }
        }
      }
      const entries = [...groups.entries()];
      const turn = Number(await redis.incr('crawl:fair:turn'));
      await redis.expire('crawl:fair:turn', 86400);
      const perTenant = Math.max(1, Math.min(window, Number(process.env.CRAWL_TENANT_PAGE_SLOTS || 4)));
      for (let offset = 0; offset < entries.length; offset++) {
        const [, tenantJobs] = entries[(turn + offset) % entries.length];
        const active = await this.prisma.crawlFrontier.count({ where: { crawlJobId: { in: tenantJobs.map(j => j.id) }, state: 'IN_PROGRESS' } });
        const perSite = new Map<string, number>();
        for (const job of tenantJobs) perSite.set(job.id, await this.prisma.crawlFrontier.count({ where: { crawlJobId: job.id, state: 'IN_PROGRESS' } }));
        let slots = Math.min(free, Math.max(0, perTenant - active));
        const rounds = tenantJobs.length;
        const orderedJobs = prioritizeSites(tenantJobs, turn);
        const hasCompetitors = tenantJobs.some(job => job.website.scope !== 'own');
        let ownActive = tenantJobs.filter(job => job.website.scope === 'own').reduce((total, job) => total + (perSite.get(job.id) ?? 0), 0);
        for (let pass = 0; pass < perTenant && slots > 0; pass++) {
          for (let j = 0; j < rounds && slots > 0; j++) {
            const job = orderedJobs[j];
            if (hasCompetitors && perTenant > 1 && job.website.scope === 'own' && ownActive >= perTenant - 1) continue;
            if ((perSite.get(job.id) ?? 0) >= job.concurrency) continue;
            const config = (job.qualityDiagnostics as any).crawlConfig as CrawlJobPayload;
            const rows = await this.frontier.claimNext(job.id, 1);
            for (const row of rows) {
              const task: PageFetchPayload = {
                jobId: job.id, websiteId: job.websiteId, domain: config.domain, targetUrl: row.url,
                sourceUrl: row.sourceUrl ?? undefined, depth: row.depth, maxDepth: config.maxDepth,
                rateLimitDelayMs: config.rateLimitDelayMs, pageLimit: config.pageLimit,
                renderBudget: config.renderBudget, taskId: `frontier-${row.id}`,
                deadlineAt: config.timeBudgetMs && job.startedAt ? job.startedAt.getTime() + config.timeBudgetMs : undefined,
              };
              await pageQueue.add('fetch-url', task, { jobId: task.taskId, attempts: 5,
                backoff: { type: 'exponential', delay: 15000 },
                removeOnComplete: { age: 604800, count: 10000 }, removeOnFail: { age: 604800, count: 10000 } });
              slots--; free--;
              perSite.set(job.id, (perSite.get(job.id) ?? 0) + 1);
              if (job.website.scope === 'own') ownActive++;
            }
          }
        }
        for (const job of tenantJobs) {
          if (await this.queue.getPendingTasks(job.id) === 0) await this.crawler.completeJob(job.id);
        }
      }
    } catch (error) {
      this.logger.error(`Fair dispatch failed; database frontier retained for retry: ${(error as Error).message}`);
    } finally {
      if (acquired) await redis.eval("if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) end return 0", 1, lock, token).catch(() => undefined);
      this.busy = false;
    }
  }
}
