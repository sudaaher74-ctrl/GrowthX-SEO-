import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Queue, Worker, Job } from 'bullmq';
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
    const host = process.env.REDIS_HOST || 'localhost';
    const port = process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT, 10) : 6379;

    try {
      this.redisConnection = new IORedis({
        host,
        port,
        maxRetriesPerRequest: null,
        lazyConnect: true,
      });

      await this.redisConnection.connect();
      this.logger.log(`Connected to Redis cluster at ${host}:${port} for BullMQ queues.`);

      this.crawlJobsQueue = new Queue<CrawlJobPayload>('crawl-jobs', { connection: this.redisConnection });
      this.pageFetchQueue = new Queue<PageFetchPayload>('page-fetch', { connection: this.redisConnection });
    } catch (err) {
      this.logger.warn(`Could not connect to Redis at ${host}:${port}. Queues will operate in local fallback/mock mode for dev/testing.`, err);
    }
  }

  async onModuleDestroy() {
    if (this.crawlJobsQueue) await this.crawlJobsQueue.close();
    if (this.pageFetchQueue) await this.pageFetchQueue.close();
    if (this.redisConnection) await this.redisConnection.quit();
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
