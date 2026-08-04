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
      this.logger.log(`Connected to Redis at ${host}:${port} for BullMQ queues.`);

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
    await this.pageFetchQueue.add('fetch-url', payload, {
      delay: delayMs,
      removeOnComplete: true,
      removeOnFail: true,
      attempts: 2,
      backoff: { type: 'fixed', delay: 1000 },
    });
  }

  getRedisClient(): IORedis | undefined {
    return this.redisConnection;
  }
}
