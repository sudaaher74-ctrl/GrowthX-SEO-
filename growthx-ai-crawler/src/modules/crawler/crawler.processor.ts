import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Worker, Job } from 'bullmq';
import { QueueService, CrawlJobPayload, PageFetchPayload } from '../queue/queue.service';
import { CrawlerService } from './crawler.service';

@Injectable()
export class CrawlerProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CrawlerProcessor.name);
  private crawlJobWorker?: Worker<CrawlJobPayload>;
  private pageFetchWorker?: Worker<PageFetchPayload>;
  /** Resolves once the workers have been started, or decided against. */
  private startup?: Promise<void>;

  constructor(
    private readonly queue: QueueService,
    private readonly crawlerService: CrawlerService
  ) {}

  /**
   * Starts the workers once the queue has settled, without blocking the boot.
   *
   * Reading the Redis client synchronously here was the original bug: the queue
   * connects asynchronously and nothing orders these two hooks, since
   * QueueModule is `@Global()` and carries no import edge, so the processor
   * could find no client, start no workers, and leave crawls enqueued with
   * nothing consuming them.
   *
   * Awaiting `queue.ready` inside this hook fixed that and introduced something
   * worse. Nest initialises modules in sequence: if CrawlerModule goes first,
   * this hook waits on a promise that only QueueService's own hook can resolve,
   * and that hook cannot run until this one returns. The boot deadlocks, no
   * port is ever bound, and the platform reports the container as having exited
   * early with nothing in the log to explain it.
   *
   * Registering a continuation instead settles it: this hook returns
   * immediately whatever the module order, and the workers start when the queue
   * is genuinely ready. The promise is retained so shutdown can wait for it
   * rather than closing workers that have not been created yet.
   */
  onModuleInit(): void {
    this.startup = this.queue.ready.then(() => this.startWorkers());
  }

  private startWorkers(): void {
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
    // Startup is no longer finished by the time this hook can run, so a
    // shutdown arriving mid-boot would otherwise close nothing and leave the
    // workers running against a closing connection.
    await this.startup?.catch(() => undefined);
    if (this.crawlJobWorker) await this.crawlJobWorker.close();
    if (this.pageFetchWorker) await this.pageFetchWorker.close();
  }
}
