import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Worker, Job } from 'bullmq';
import { QueueService, CrawlJobPayload, PageFetchPayload } from '../queue/queue.service';
import { CrawlerService } from './crawler.service';

@Injectable()
export class CrawlerProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CrawlerProcessor.name);
  private crawlJobWorker?: Worker<CrawlJobPayload>;
  private pageFetchWorker?: Worker<PageFetchPayload>;

  constructor(
    private readonly queue: QueueService,
    private readonly crawlerService: CrawlerService
  ) {}

  onModuleInit() {
    const redisConnection = this.queue.getRedisClient();
    if (!redisConnection) {
      this.logger.warn('Redis connection unavailable. BullMQ workers will not start; operating in synchronous fallback mode.');
      return;
    }

    const maxConcurrency = process.env.MAX_CRAWL_CONCURRENCY ? parseInt(process.env.MAX_CRAWL_CONCURRENCY, 10) : 10;

    // Worker for orchestrating crawl jobs
    this.crawlJobWorker = new Worker<CrawlJobPayload>(
      'crawl-jobs',
      async (job: Job<CrawlJobPayload>) => {
        this.logger.log(`Processing BullMQ crawl-jobs item: Job ${job.data.jobId}`);
        await this.crawlerService.processCrawlJob(job.data);
      },
      { connection: redisConnection, concurrency: 5 }
    );

    this.crawlJobWorker.on('failed', (job, err) => {
      this.logger.error(`Crawl job worker failed for job ${job?.id}`, err);
    });

    // Worker for fetching individual pages horizontally
    this.pageFetchWorker = new Worker<PageFetchPayload>(
      'page-fetch',
      async (job: Job<PageFetchPayload>) => {
        await this.crawlerService.processPageFetch(job.data);
      },
      { connection: redisConnection, concurrency: maxConcurrency }
    );

    this.pageFetchWorker.on('failed', (job, err) => {
      this.logger.error(`Page fetch worker failed for url ${job?.data?.targetUrl}`, err);
    });

    this.logger.log(`BullMQ crawler workers started with concurrency limit ${maxConcurrency}.`);
  }

  async onModuleDestroy() {
    if (this.crawlJobWorker) await this.crawlJobWorker.close();
    if (this.pageFetchWorker) await this.pageFetchWorker.close();
  }
}
