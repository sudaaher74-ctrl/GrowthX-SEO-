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
   * Whether this process is consuming the queues.
   *
   * Queue depth alone cannot distinguish "nothing was dispatched" from "the
   * consumer never started", and the second is the failure that leaves a crawl
   * at PENDING until the stall sweep closes it. Reported alongside the counts
   * so the pair is readable in one request.
   */
  get workerStatus(): Record<string, unknown> {
    return {
      crawlJobs: Boolean(this.crawlJobWorker?.isRunning()),
      pageFetch: Boolean(this.pageFetchWorker?.isRunning()),
      disabledByEnv: process.env.WORKER_MODE === 'false' || process.env.DISABLE_WORKERS === 'true',
    };
  }

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
    if (process.env.WORKER_MODE === 'false' || process.env.DISABLE_WORKERS === 'true') {
      this.logger.log('Workers explicitly disabled in this process.');
      return;
    }

    const redisConnection = this.queue.getRedisClient();
    if (!redisConnection) {
      this.logger.warn('Redis connection unavailable. BullMQ workers will not start; operating in synchronous fallback mode.');
      return;
    }

    // Sized against the render capacity, not against the CPU.
    //
    // Every page of a client-rendered site needs the browser, and a small
    // instance has room for one render at a time. Ten workers against one
    // permit do not crawl faster: nine of them queue, each holding a BullMQ
    // lock while doing nothing, and each eventually gives up on rendering and
    // records the SPA's empty shell as the page. That is both halves of what
    // milquufresh.in's audit showed — a lock lapsing into a duplicate run,
    // and a homepage recorded with five words.
    //
    // Twice the render capacity keeps the permit busy while leaving the wait
    // for it short. An explicit setting still wins, for a deployment whose
    // sites are mostly static or whose browser capacity is larger.
    const renderSlots = Math.max(1, Number(process.env.MAX_RENDER_CONCURRENCY || process.env.MAX_PLAYWRIGHT_CONCURRENCY || 3));
    const maxPageFetchConcurrency = process.env.CRAWLER_WORKER_CONCURRENCY
      ? parseInt(process.env.CRAWLER_WORKER_CONCURRENCY, 10)
      : Math.max(2, renderSlots * 2);
    const maxCrawlJobConcurrency = process.env.CRAWLER_JOB_CONCURRENCY ? parseInt(process.env.CRAWLER_JOB_CONCURRENCY, 10) : 5;

    // Worker for orchestrating crawl jobs
    this.crawlJobWorker = new Worker<CrawlJobPayload>(
      'crawl-jobs',
      async (job: Job<CrawlJobPayload>) => {
        this.logger.log(`Processing BullMQ crawl-jobs item: Job ${job.data.jobId}`);
        await this.crawlerService.processCrawlJob(job.data);
      },
      { connection: redisConnection, concurrency: maxCrawlJobConcurrency }
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
      {
        connection: redisConnection,
        concurrency: maxPageFetchConcurrency,
        // BullMQ's default lock is 30 seconds, and a page of a client-rendered
        // site takes longer than that: navigation, network idle, the settle,
        // and possibly a wait for the one render slot a small instance allows.
        // The lock is renewed on a timer, so a busy event loop -- parsing HTML,
        // scoring issues -- can miss a renewal even while the job is healthy.
        // Either way BullMQ declares the job stalled and runs it a second time,
        // and since the crawl's pending-task counter is decremented in a
        // `finally`, the second run decrements it again. The counter reaches
        // zero with most of the site still queued, the crawl is marked
        // complete, and a 29-page site reports as 5 pages.
        //
        // Sized above the render ceiling plus the wait for a slot, so only a
        // genuinely dead worker trips it.
        lockDuration: Number(process.env.PAGE_FETCH_LOCK_MS ?? 180_000),
      }
    );

    this.pageFetchWorker.on('failed', (job, err) => {
      this.logger.error(`Page fetch worker failed for url ${job?.data?.targetUrl}`, err);
    });

    this.logger.log(`BullMQ crawler workers started: Job concurrency [${maxCrawlJobConcurrency}], Page Fetch concurrency [${maxPageFetchConcurrency}].`);
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
