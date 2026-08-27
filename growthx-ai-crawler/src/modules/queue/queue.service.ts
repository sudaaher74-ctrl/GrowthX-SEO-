import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';

export interface CrawlJobPayload {
  jobId: string;
  websiteId: string;
  domain: string;
  startUrl: string;
  maxConcurrency: number;
  maxDepth: number;
  rateLimitDelayMs: number;
  useSitemap: boolean;
}

export interface PageFetchPayload {
  jobId: string;
  websiteId: string;
  domain: string;
  targetUrl: string;
  sourceUrl?: string;
  depth: number;
  maxDepth: number;
  rateLimitDelayMs: number;
}

@Injectable()
export class QueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QueueService.name);
  private redisConnection?: IORedis;
  public crawlJobsQueue?: Queue<CrawlJobPayload>;
  public pageFetchQueue?: Queue<PageFetchPayload>;

  private markReady!: () => void;

  /**
   * Resolves once this service has finished deciding whether Redis is usable —
   * whether it connected or not.
   *
   * Connecting is asynchronous, but a consumer's `onModuleInit` can run before
   * this one finishes, and QueueModule being `@Global()` means nothing imports
   * it, so no dependency edge orders the two. CrawlerProcessor read
   * `getRedisClient()` in that window, found nothing, and returned without ever
   * starting its BullMQ workers — while the queue finished connecting a moment
   * later and happily accepted jobs. Crawls were then enqueued into Redis with
   * no consumer, and `startCrawlJob`'s synchronous fallback was skipped because
   * by then the queue existed. Jobs sat at PENDING forever, untouched and with
   * no error to show for it.
   *
   * Awaiting this makes the decision deterministic regardless of module order.
   */
  readonly ready: Promise<void> = new Promise<void>((resolve) => {
    this.markReady = resolve;
  });

  async onModuleInit() {
    const redisUrl = process.env.REDIS_URL;
    const host = process.env.REDIS_HOST || 'localhost';
    const port = process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT, 10) : 6379;

    try {
      if (redisUrl) {
        const isTls = redisUrl.startsWith('rediss://');
        this.redisConnection = new IORedis(redisUrl, {
          maxRetriesPerRequest: null, // Required by BullMQ
          lazyConnect: true,
          tls: isTls ? { rejectUnauthorized: false } : undefined,
        });
      } else {
        this.redisConnection = new IORedis({
          host,
          port,
          maxRetriesPerRequest: null,
          lazyConnect: true,
        });
      }

      // ioredis emits 'error' asynchronously. Without a listener, Node treats it
      // as an unhandled EventEmitter error and kills the process — so a brief
      // Redis blip would take the whole API down.
      this.redisConnection.on('error', (err) => {
        this.logger.warn(`Redis connection error: ${err.message}`);
      });

      await this.redisConnection.connect();
      this.logger.log(`Connected to ${redisUrl ? 'Production Redis' : `Redis at ${host}:${port}`} for BullMQ queues.`);

      this.crawlJobsQueue = new Queue<CrawlJobPayload>('crawl-jobs', { connection: this.redisConnection });
      this.pageFetchQueue = new Queue<PageFetchPayload>('page-fetch', { connection: this.redisConnection });
    } catch (err: any) {
      this.logger.warn(
        `Could not connect to Redis at ${host}:${port}. Crawls will run synchronously. (${err?.message})`,
      );
      // Drop the dead client. Leaving it set would hand a broken connection to
      // getRedisClient(), and CrawlerProcessor would start BullMQ workers on it.
      if (this.redisConnection) {
        this.redisConnection.removeAllListeners();
        this.redisConnection.disconnect();
        this.redisConnection = undefined;
      }
    } finally {
      // Released on both paths. A consumer awaiting this must proceed to its
      // synchronous fallback when Redis is unreachable, not hang the boot.
      this.markReady();
    }
  }

  async onModuleDestroy() {
    // Every step is guarded: shutdown must not throw, and quit() on an
    // already-closed connection rejects with "Connection is closed."
    try {
      if (this.crawlJobsQueue) await this.crawlJobsQueue.close();
      if (this.pageFetchQueue) await this.pageFetchQueue.close();
    } catch (err: any) {
      this.logger.warn(`Error closing queues: ${err?.message}`);
    }

    if (!this.redisConnection) return;
    try {
      if (this.redisConnection.status === 'ready') {
        await this.redisConnection.quit();
      } else {
        this.redisConnection.disconnect();
      }
    } catch (err: any) {
      this.logger.warn(`Error closing the Redis connection: ${err?.message}`);
    }
  }

  async addCrawlJob(payload: CrawlJobPayload): Promise<string> {
    if (!this.crawlJobsQueue) {
      this.logger.warn(`Redis queue inactive. Cannot dispatch job ${payload.jobId} asynchronously.`);
      return payload.jobId;
    }
    const job = await this.crawlJobsQueue.add('start-crawl', payload, {
      removeOnComplete: 1000,
      removeOnFail: 5000,
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
    });
    return job.id || payload.jobId;
  }

  async addPageFetchTask(payload: PageFetchPayload, delayMs: number = 0): Promise<void> {
    if (!this.pageFetchQueue) {
      return;
    }
    await this.incrementPendingTasks(payload.jobId, 1);
    await this.pageFetchQueue.add('fetch-url', payload, {
      delay: delayMs,
      removeOnComplete: true,
      removeOnFail: true,
      attempts: 2,
      backoff: { type: 'fixed', delay: 1000 },
    });
  }

  private readonly inMemoryTaskCounters = new Map<string, number>();

  async incrementPendingTasks(jobId: string, count: number = 1): Promise<number> {
    if (this.redisConnection) {
      const key = `job:${jobId}:pending_tasks`;
      const val = await this.redisConnection.incrby(key, count);
      await this.redisConnection.expire(key, 86400);
      return val;
    }
    const current = (this.inMemoryTaskCounters.get(jobId) || 0) + count;
    this.inMemoryTaskCounters.set(jobId, current);
    return current;
  }

  async decrementPendingTasks(jobId: string): Promise<number> {
    if (this.redisConnection) {
      const key = `job:${jobId}:pending_tasks`;
      const val = await this.redisConnection.decr(key);
      return Math.max(0, val);
    }
    const current = Math.max(0, (this.inMemoryTaskCounters.get(jobId) || 1) - 1);
    if (current === 0) {
      this.inMemoryTaskCounters.delete(jobId);
    } else {
      this.inMemoryTaskCounters.set(jobId, current);
    }
    return current;
  }

  async getPendingTasks(jobId: string): Promise<number> {
    if (this.redisConnection) {
      const key = `job:${jobId}:pending_tasks`;
      const val = await this.redisConnection.get(key);
      return val ? parseInt(val, 10) : 0;
    }
    return this.inMemoryTaskCounters.get(jobId) || 0;
  }

  getRedisClient(): IORedis | undefined {
    return this.redisConnection;
  }
}
