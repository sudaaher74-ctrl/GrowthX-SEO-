import { Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { StorageService } from '../../storage/storage.service';
import * as cheerio from 'cheerio';
import { QueueService, CrawlJobPayload, PageFetchPayload } from '../queue/queue.service';
import { RobotsService } from '../robots/robots.service';
import { SitemapService } from '../sitemap/sitemap.service';
import { FetcherService } from './fetcher.service';
import { classifyPageType } from './page-type';
import { detectProductSignals } from './product-detector';
import { isCrawlablePage, isHtmlResponse } from './crawlable';
import { MetricsService } from '../observability/metrics.service';
import { HtmlExtractorService } from '../extractor/html-extractor.service';
import { ImageAnalyzerService } from '../analyzer/image-analyzer.service';
import { LinkAnalyzerService } from '../analyzer/link-analyzer.service';
import { SchemaValidatorService } from '../analyzer/schema-validator.service';
import { ContentAnalyzerService } from '../analyzer/content-analyzer.service';
import { PerformanceService } from '../performance/performance.service';
import { IssueEngineService } from '../issues/issue-engine.service';
import { GraphService } from '../graph/graph.service';
import { CrawlerGateway } from '../socket/crawler.gateway';
import { FetchService, FetchOutcome } from './fetch/fetch.service';
import { HostPacer } from './host-pacer';
import { DiscoveryService, SitemapFinding } from './discovery/discovery.service';
import { ParsedRobots } from './discovery/robots-txt';
import { computeIndexability } from './indexability';
import { computeCrawlSummary } from './crawl-summary';
import { UrlInventoryService } from './inventory/url-inventory.service';
import { extractUrlsFromJsonLd } from './page-extract';
import { isInternalTargetUrl } from './url/url-normalizer';
import { CrawlJobState } from './crawl-job-state';
import { CrawlFindingsRecorder } from './crawl-findings-recorder';

/**
 * Ceiling on the HTML kept per page, per column.
 *
 * rawHtml and renderedHtml exist so the two can be compared, and the
 * comparison only needs the head and the top of the body. Storing both in
 * full for a 500-page crawl runs to hundreds of megabytes against a database
 * whose whole allowance is a gigabyte, so both are capped.
 */
const MAX_STORED_HTML_BYTES = Number(process.env.MAX_STORED_HTML_BYTES || 128 * 1024);

function capHtml(html: string | undefined): string | undefined {
  if (!html) return undefined;
  return html.length <= MAX_STORED_HTML_BYTES ? html : `${html.slice(0, MAX_STORED_HTML_BYTES)}\n<!-- truncated by the crawler -->`;
}

/** Notified after a crawl job has finished and its results are stored. */
export type CrawlCompletionHandler = (jobId: string, websiteId: string) => Promise<void>;

@Injectable()
export class CrawlerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CrawlerService.name);
  private readonly completionHandlers: CrawlCompletionHandler[] = [];
  /** What the crawl remembers between pages; see CrawlJobState. */
  private readonly state: CrawlJobState;
  /** Writes the issues, catalog products and social profiles a crawl finds. */
  private readonly recorder: CrawlFindingsRecorder;

  /**
   * How long a job may go without recording a page before it is treated as
   * abandoned. Comfortably longer than a slow page fetch plus its retries, so a
   * crawl that is merely slow is never cut short.
   */
  private static readonly STALL_TIMEOUT_MS = 5 * 60 * 1000;
  private static readonly STALL_SWEEP_INTERVAL_MS = 2 * 60 * 1000;
  /**
   * How long a crawl BullMQ still holds work for may go without progress
   * before it is closed anyway. Its work is only waiting its turn, so this is
   * a backstop for work that is queued but never runs, not a performance limit.
   */
  private static readonly QUEUED_MAX_IDLE_MS = Number(process.env.CRAWL_QUEUED_MAX_IDLE_MS ?? 6 * 60 * 60 * 1000);
  private stallSweep?: NodeJS.Timeout;
  private startupSweep?: NodeJS.Timeout;

  /**
   * Crawl-job statuses, briefly cached, so abandoned work can be dropped
   * without a database round trip per queued URL.
   *
   * `page-fetch` is one queue shared by every crawl, and a job outlives the
   * crawl that enqueued it: a crawl that is cancelled, fails, or is closed out
   * by the stall sweep leaves its remaining URLs in the queue, and nothing
   * removed them. Production accumulated 18,000 such URLs across 38 finished
   * crawls. Because rendering is capped at one page at a time on a small
   * instance, the queue drains at roughly two pages a minute, so that backlog
   * represents days of work — and a newly requested crawl sits behind all of
   * it, records nothing within the stall timeout, and is marked FAILED. The
   * symptom is a crawler that appears broken while it is in fact busy doing
   * work nobody is waiting for.
   *
   * A short TTL is the point: long enough that draining a large backlog costs
   * a handful of queries rather than thousands, short enough that a crawl
   * cancelled mid-flight stops within seconds.
   */
  private readonly jobStatusCache = new Map<string, { status: string; readAt: number }>();
  /** Spaces requests to one website by its politeness delay. See HostPacer. */
  private readonly pacer = new HostPacer();
  private static readonly JOB_STATUS_TTL_MS = 10 * 1000;


  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly queue: QueueService,
    private readonly robots: RobotsService,
    private readonly sitemap: SitemapService,
    private readonly fetcher: FetcherService,
    private readonly fetchSvc: FetchService,
    private readonly discovery: DiscoveryService,
    private readonly metrics: MetricsService,
    private readonly htmlExtractor: HtmlExtractorService,
    private readonly imageAnalyzer: ImageAnalyzerService,
    private readonly linkAnalyzer: LinkAnalyzerService,
    private readonly schemaValidator: SchemaValidatorService,
    private readonly contentAnalyzer: ContentAnalyzerService,
    private readonly performanceService: PerformanceService,
    private readonly issueEngine: IssueEngineService,
    private readonly graphService: GraphService,
    private readonly crawlerGateway: CrawlerGateway,
    private readonly inventory: UrlInventoryService,
  ) {
    this.state = new CrawlJobState(queue);
    this.recorder = new CrawlFindingsRecorder(prisma, this.state);
  }

  /**
   * Initiates a new crawl job for a verified website
   */
  onModuleInit(): void {
    // The first sweep waits out a full stall window after boot.
    //
    // It used to run the moment the process started. But a job's `updatedAt`
    // stops moving whenever no process is running, so after a deploy, a crash,
    // or a free instance waking from sleep, every queued crawl looked idle for
    // however long the process had been down. Every one of them was marked
    // FAILED at boot ("Abandoned before any page was crawled"), and then the
    // workers, which were resuming exactly that work from Redis, dropped it
    // because the crawl was already finished.
    //
    // Only idleness while a process was alive to make progress counts. A crawl
    // that was really lost is still closed, one stall window later.
    const graceMs = Number(process.env.CRAWL_STARTUP_GRACE_MS ?? CrawlerService.STALL_TIMEOUT_MS);
    this.startupSweep = setTimeout(() => {
      void this.finalizeStalledJobs();
      this.stallSweep = setInterval(() => {
        void this.finalizeStalledJobs();
      }, CrawlerService.STALL_SWEEP_INTERVAL_MS);
      // Do not hold the process open on this timer alone.
      this.stallSweep.unref?.();
    }, graceMs);
    this.startupSweep.unref?.();
  }

  onModuleDestroy(): void {
    if (this.startupSweep) clearTimeout(this.startupSweep);
    if (this.stallSweep) clearInterval(this.stallSweep);
  }

  /**
   * Closes out crawls that stopped making progress and will never close
   * themselves.
   *
   * A job finishes when its pending-task counter reaches zero, decremented as
   * each page is processed. Nothing decrements it for work that is never
   * processed — a container restart mid-crawl, a page-fetch job dropped from
   * the queue — so the counter stays above zero, `completeJob` is never
   * reached, and the job sits at RUNNING permanently. The UI reads the most
   * recent COMPLETED crawl, so one lost page keeps a whole crawl invisible and
   * the site reads "crawl never" while its pages sit in the database.
   *
   * Anything that has recorded no page for STALL_TIMEOUT_MS is therefore
   * finalised on the evidence already stored: COMPLETED when it crawled
   * something, since those pages and issues are real and worth showing, and
   * FAILED when it never got started. The count on the job stays exactly what
   * was crawled, so a partial crawl is never reported as more than it was.
   *
   * Only jobs idle beyond the timeout are touched, so a second instance's live
   * crawl is never finalised out from under it. A job BullMQ still holds work
   * for is left alone too (up to QUEUED_MAX_IDLE_MS), since that work will run.
   */
  private async finalizeStalledJobs(): Promise<void> {
    const idleSince = new Date(Date.now() - CrawlerService.STALL_TIMEOUT_MS);

    try {
      const stalled = await this.prisma.crawlJob.findMany({
        where: { status: { in: ['RUNNING', 'PENDING'] }, updatedAt: { lt: idleSince } },
        select: { id: true, pagesCrawled: true, pagesDiscovered: true, status: true, updatedAt: true },
      });
      if (stalled.length === 0) return;

      const abandoned: typeof stalled = [];
      for (const job of stalled) {
        // Quiet is not the same as abandoned: a crawl whose work is still in
        // the queue is waiting its turn, and failing it would drop that work.
        // Past the backstop it is closed regardless, so a crawl can never be
        // left RUNNING forever by a queue that never reaches it.
        const idleMs = Date.now() - new Date(job.updatedAt ?? 0).getTime();
        if (idleMs < CrawlerService.QUEUED_MAX_IDLE_MS && (await this.queue.hasQueuedWork(job.id))) {
          this.logger.log(`[JOB ${job.id}] No progress recently, but its work is still queued; leaving it to run.`);
          continue;
        }
        abandoned.push(job);
      }
      if (abandoned.length === 0) return;

      this.logger.warn(
        `Found ${abandoned.length} crawl job(s) with no progress since ${idleSince.toISOString()} and no queued work; finalising them.`,
      );

      for (const job of abandoned) {
        try {
          if (job.pagesCrawled > 0) {
            // completeJob runs the graph analysis and flips the status, so the
            // crawl surfaces with exactly the pages it managed to record.
            await this.completeJob(job.id);

            // Those pages are real and worth showing, but the crawl did not
            // finish and must not read as though it had. A run that recorded
            // 7 of 29 discovered URLs was reported COMPLETED with 7 pages, and
            // every figure drawn from it -- health score, issue counts, page
            // totals -- described a quarter of the site while presenting
            // itself as the whole of it. The one status left is COMPLETED, so
            // the shortfall is carried in the reason instead of being lost.
            if (job.pagesDiscovered > job.pagesCrawled) {
              await this.prisma.crawlJob
                .update({
                  where: { id: job.id },
                  data: {
                    errorMessage:
                      `Stopped early: ${job.pagesCrawled} of ${job.pagesDiscovered} discovered pages were crawled ` +
                      `before the crawl stopped making progress for ` +
                      `${Math.round(CrawlerService.STALL_TIMEOUT_MS / 60000)} minutes. ` +
                      `The findings below cover only the pages that were read. Running the audit again is safe.`,
                  },
                })
                .catch(() => {});
            }
          } else {
            // A status with no reason is what makes this failure unreadable:
            // the UI shows "FAILED", the operator has no idea whether the site
            // was unreachable, the worker died or the job was never picked up,
            // and the only way to find out is the container log. Recording
            // what is actually known — that the job was accepted, recorded no
            // page, and then stopped reporting — at least names the shape of
            // the failure and the usual cause.
            await this.prisma.crawlJob.update({
              where: { id: job.id },
              data: {
                status: 'FAILED',
                finishedAt: new Date(),
                errorMessage:
                  `The crawl stopped responding before it recorded a single page, and was closed after ` +
                  `${Math.round(CrawlerService.STALL_TIMEOUT_MS / 60000)} minutes without progress. ` +
                  `This usually means the worker process was restarted or ran out of memory mid-crawl. ` +
                  `Running the audit again is safe.`,
              },
            });
            this.logger.warn(`[JOB ${job.id}] Abandoned before any page was crawled; marked FAILED.`);
          }
        } catch (error) {
          this.logger.error(`[JOB ${job.id}] Could not finalise stalled crawl job`, error);
        }
      }
    } catch (error) {
      // A sweep failure must never disturb crawling itself.
      this.logger.error('Stalled crawl job sweep failed', error);
    }
  }

  /** A PENDING or RUNNING crawl touched within this window counts as in flight. */
  static readonly IN_FLIGHT_WINDOW_MS = 3 * 60 * 60 * 1000;

  async startCrawlJob(
    websiteId: string,
    options: {
      maxConcurrency?: number;
      maxDepth?: number;
      useSitemap?: boolean;
      /** Ceiling on pages fetched. Omitted means no ceiling. */
      pageLimit?: number;
      /** Slowest of this and the site's own setting wins, so a caller can be
       *  politer than the site's configuration but never ruder. */
      rateLimitDelayMs?: number;
      /** How long the crawl may keep fetching. Omitted means no limit. */
      timeBudgetMs?: number;
      /** Ceiling on headless-browser renders, below the deployment's own. */
      renderBudget?: number;
    } = {}
  ): Promise<string> {
    const website = await this.prisma.website.findUnique({ where: { id: websiteId } });
    if (!website) {
      throw new NotFoundException(`Website with ID ${websiteId} not found`);
    }

    // One crawl of a site at a time. Pressing "Run audit" again while one is
    // running used to start a second, then a third, each fetching the same
    // pages and each taking worker slots every other customer shares. The
    // running one is returned instead; a crawl silent for hours is left to the
    // stall sweep rather than blocking new ones forever.
    const inFlight = await this.prisma.crawlJob.findFirst({
      where: {
        websiteId: website.id,
        status: { in: ['PENDING', 'RUNNING'] },
        updatedAt: { gte: new Date(Date.now() - CrawlerService.IN_FLIGHT_WINDOW_MS) },
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    if (inFlight) {
      this.logger.log(`Crawl ${inFlight.id} is already running for ${website.domain}; returning it instead of starting another.`);
      return inFlight.id;
    }

    const limits = crawlLimits();
    const job = await this.prisma.crawlJob.create({
      data: {
        websiteId: website.id,
        status: 'PENDING',
        concurrency: clamp(options.maxConcurrency || website.maxConcurrency || 5, 1, limits.maxConcurrency),
        depthLimit: clamp(options.maxDepth || website.maxDepth || 10, 1, limits.maxDepth),
        // Every crawl has a ceiling. Without one, a site of 100,000 product
        // pages held the shared workers for a day.
        pageLimit: clamp(options.pageLimit ?? limits.defaultPageLimit, 1, limits.maxPageLimit),
        startedAt: new Date(),
      },
    });

    let startUrl = website.url.trim();
    if (!startUrl.startsWith('http://') && !startUrl.startsWith('https://')) {
      startUrl = `https://${startUrl}`;
    }

    const payload: CrawlJobPayload = {
      jobId: job.id,
      websiteId: website.id,
      domain: website.domain,
      startUrl,
      maxConcurrency: job.concurrency,
      maxDepth: job.depthLimit,
      rateLimitDelayMs: Math.max(website.rateLimitDelayMs || 500, options.rateLimitDelayMs ?? 0),
      useSitemap: options.useSitemap !== false,
      pageLimit: job.pageLimit ?? undefined,
      timeBudgetMs: options.timeBudgetMs,
      renderBudget: options.renderBudget,
    };

    this.logger.log(`Created crawl job ${job.id} for ${website.domain}. Dispatching to queue...`);
    await this.queue.addCrawlJob(payload);

    if (!this.queue.crawlJobsQueue) {
      this.logger.log(`Redis queue inactive. Executing job ${job.id} locally in memory...`);
      setTimeout(() => this.processCrawlJob(payload), 100);
    }

    return job.id;
  }

  // Local fallback queue mechanism
  private readonly localJobQueues = new Map<string, PageFetchPayload[]>();
  private readonly localJobActiveWorkers = new Map<string, number>();

  /**
   * Main job processor: discovers seed URLs (Homepage + Sitemaps) and enqueues page fetch tasks
   */
  async processCrawlJob(payload: CrawlJobPayload): Promise<void> {
    this.logger.log(`[JOB ${payload.jobId}] Starting crawl for domain: ${payload.domain}`);
    // The clock starts when the crawl does, not when it was queued, so a crawl
    // that waited its turn behind another still gets its whole budget.
    const deadlineAt = payload.timeBudgetMs ? Date.now() + payload.timeBudgetMs : undefined;
    await this.prisma.crawlJob.update({ where: { id: payload.jobId }, data: { status: 'RUNNING' } });
    this.metrics.activeCrawlJobs.inc();

    // Initialize per-job stats tracking
    this.state.jobStats.set(payload.jobId, {
      urlsDiscovered: 0,
      urlsSkipped: 0,
      robotsBlocked: 0,
      internalLinksFound: 0,
      crawlStatus: 'COMPLETED',
    });

    const seedUrls = new Set<string>();
    const sitemapSet = new Set<string>();
    const discoveredUrls: Array<{ url: string; normalizedUrl: string; source: string; foundIn?: string }> = [];
    seedUrls.add(this.state.normalizeUrl(payload.startUrl));
    discoveredUrls.push({
      url: payload.startUrl,
      normalizedUrl: this.state.normalizeUrl(payload.startUrl),
      source: 'seed',
    });

    const robotsRules = await this.robots.fetchRobotsRules(payload.domain);
    const delayMs = robotsRules.crawlDelayMs || payload.rateLimitDelayMs || 500;

    // Seeding runs through DiscoveryService, which unions robots.txt, declared
    // sitemaps, the conventional sitemap paths and nested index files, and —
    // the part that matters here — reports a sitemap whose URLs are on another
    // domain instead of quietly enqueueing them. The previous path added five
    // URLs on a domain that does not resolve, watched all five fail, and
    // reported that a sitemap had been found.
    let discoveredRobots: ParsedRobots | undefined;
    let sitemapFindings: SitemapFinding[] = [];
    try {
      const discovered = await this.discovery.discoverSeeds(payload.startUrl, { useSitemap: payload.useSitemap });
      discoveredRobots = discovered.robots;
      sitemapFindings = discovered.findings;

      for (const found of discovered.urls) {
        // Recorded for every source, `seed` included: the start URL is a
        // discovered URL like any other, and leaving it out of the inventory is
        // how a denominator starts disagreeing with the rows beneath it.
        discoveredUrls.push(found);
        if (found.source === 'seed') continue;
        seedUrls.add(found.normalizedUrl);
        if (found.source === 'sitemap') sitemapSet.add(found.normalizedUrl);
      }

      this.logger.log(
        `[JOB ${payload.jobId}] Discovery: ${discovered.sitemapsFetched.length} sitemap(s), ` +
          `${sitemapSet.size} usable URL(s), ${discovered.foreignSitemapUrls.length} on a foreign domain, ` +
          `${discovered.findings.length} sitemap finding(s).`,
      );
      for (const finding of discovered.findings) {
        // An HTML page where a sitemap was expected describes the site (no
        // sitemap there, or a bot wall), not a fault in the crawler.
        const line = `[JOB ${payload.jobId}] Sitemap ${finding.kind}: ${finding.evidence}`;
        if (finding.servedHtml) this.logger.log(line);
        else this.logger.warn(line);
      }
    } catch (err) {
      // Discovery failing must not stop the crawl: the start URL is still a
      // seed, and a site with a broken sitemap is exactly the site worth
      // crawling from its homepage.
      this.logger.warn(`[JOB ${payload.jobId}] Seed discovery failed; continuing from the start URL alone.`, err);
    }

    // Shared rather than remembered: the pages of this crawl are fetched by
    // workers that do not share this process's memory, and by this process
    // again after a restart.
    await this.state.saveCrawlState(payload.jobId, { sitemapUrls: sitemapSet, robots: discoveredRobots, sitemapFindings });

    // The URL inventory, written before anything is fetched.
    //
    // `discoveredUrls` below is not the seed set: it is every URL any source
    // named, each with the sources that named it, so a URL in both the sitemap
    // and the homepage's navigation is one row with two sources. The count of
    // rows is what "discovered" means from here on, and it keeps growing as
    // links are found — which is the whole of the bug this replaces. The old
    // path wrote the seed count into `pagesDiscovered` once, here, and never
    // touched it again, so a URL found in a link was crawled without ever
    // having been discovered and coverage could not come out as anything but
    // 100%.
    await this.inventory
      .record(
        payload.jobId,
        discoveredUrls.map((d) => ({ url: d.url, source: d.source, sourceUrl: d.foundIn })),
      )
      .catch((err) => {
        this.logger.warn(`[JOB ${payload.jobId}] Could not write the seed inventory: ${(err as Error).message}`);
        return { added: 0, merged: 0, invalid: 0 };
      });

    // Update urlsDiscovered stat with seed count
    const stats = this.state.jobStats.get(payload.jobId);
    if (stats) stats.urlsDiscovered = seedUrls.size;

    // Recorded before any fetch, so the denominator survives whatever happens
    // to the crawl afterwards. "7 pages" and "7 of 29 pages" are different
    // reports, and only the second one lets a reader tell a small site from a
    // truncated crawl.
    await this.prisma.crawlJob
      .update({ where: { id: payload.jobId }, data: { pagesDiscovered: seedUrls.size } })
      .catch(() => {});

    this.logger.log(`[JOB ${payload.jobId}] Total seed URLs to crawl: ${seedUrls.size} (${sitemapSet.size} from sitemaps, 1 homepage)`);


    // If Redis is active, dispatch to BullMQ
    if (this.queue.pageFetchQueue) {
      this.logger.log(`[JOB ${payload.jobId}] Bulk-enqueueing ${seedUrls.size} seed URLs to Redis (atomic pre-increment)...`);

      // Build all payloads first, THEN pre-increment + bulk-enqueue atomically.
      // The old approach incremented +1 per URL inside the loop, so a worker
      // could finish URL #1 and decrement the counter to 0 while URLs #2..N
      // were still being added — triggering completeJob() prematurely and
      // leaving the remainder of the sitemap uncrawled.
      const seedPayloads: import('../queue/queue.service').PageFetchPayload[] = [];
      for (const targetUrl of seedUrls) {
        seedPayloads.push({
          jobId: payload.jobId,
          websiteId: payload.websiteId,
          domain: payload.domain,
          targetUrl,
          depth: 0,
          maxDepth: payload.maxDepth,
          rateLimitDelayMs: delayMs,
          pageLimit: payload.pageLimit,
          deadlineAt,
          renderBudget: payload.renderBudget,
        });
      }
      try {
        await this.queue.bulkAddPageFetchTasks(seedPayloads, 0);
        await this.inventory.markQueued(payload.jobId, [...seedUrls]);
      } catch (err) {
        // A URL that never reached the queue is not a URL that disappeared.
        // It stays in the inventory, marked with why, so the reconciliation
        // still balances and the gap is visible rather than inferred.
        this.logger.error(`[JOB ${payload.jobId}] Seed enqueue failed; marking ${seedUrls.size} URL(s) queue_failed.`, err);
        for (const seed of seedUrls) {
          await this.inventory.markExcluded(payload.jobId, seed, 'queue_failed');
        }
        throw err;
      }
    } 
    // Fallback: Concurrent In-Memory Queue
    else {
      this.logger.log(`[JOB ${payload.jobId}] Redis inactive. Launching Local Concurrent Engine for ${seedUrls.size} seed URLs...`);
      
      const queue: PageFetchPayload[] = [];
      this.localJobQueues.set(payload.jobId, queue);
      
      for (const targetUrl of seedUrls) {
        queue.push({
          jobId: payload.jobId,
          websiteId: payload.websiteId,
          domain: payload.domain,
          targetUrl,
          depth: 0,
          maxDepth: payload.maxDepth,
          rateLimitDelayMs: delayMs,
          pageLimit: payload.pageLimit,
          deadlineAt,
          renderBudget: payload.renderBudget,
        });
      }
      await this.inventory.markQueued(payload.jobId, [...seedUrls]);

      // Each in-flight worker holds a page's HTML — raw and rendered — plus its
      // extraction, so concurrency is a memory multiplier, not just a speed
      // dial. Ten of them on a 512MB instance already running Chromium is what
      // the OOM killer was reacting to. The ceiling is the deployment's, not a
      // constant.
      const maxConcurrency = Math.max(
        1,
        Math.min(
          payload.maxConcurrency || Number(process.env.DEFAULT_CRAWL_CONCURRENCY || 3),
          Number(process.env.MAX_CRAWL_CONCURRENCY || 3),
        ),
      );
      this.localJobActiveWorkers.set(payload.jobId, 0);

      const worker = async () => {
        while (true) {
          const currentQueue = this.localJobQueues.get(payload.jobId) || [];
          
          if (currentQueue.length === 0) {
            const active = this.localJobActiveWorkers.get(payload.jobId) || 0;
            if (active === 0) break; // All done
            await new Promise(r => setTimeout(r, 200)); // Wait for other workers to potentially push links
            continue;
          }

          const task = currentQueue.shift();
          if (!task) continue;

          this.localJobActiveWorkers.set(payload.jobId, (this.localJobActiveWorkers.get(payload.jobId) || 0) + 1);
          try {
            await this.processPageFetch(task);
          } catch (err) {
            this.logger.error(`[JOB ${payload.jobId}] Unhandled error processing ${task.targetUrl}`, err);
          } finally {
            this.localJobActiveWorkers.set(payload.jobId, Math.max(0, (this.localJobActiveWorkers.get(payload.jobId) || 1) - 1));
          }
        }
      };

      const workers = Array.from({ length: maxConcurrency }).map(() => worker());
      await Promise.all(workers);
      
      this.localJobQueues.delete(payload.jobId);
      this.localJobActiveWorkers.delete(payload.jobId);
      await this.completeJob(payload.jobId);
    }
  }

  /**
   * Processes an individual page fetch task, executing the full SEO extraction & issue engine pipeline
   */
  /**
   * Whether this crawl still wants its queued URLs fetched.
   *
   * Anything past PENDING/RUNNING is finished, and fetching a page for it
   * would write a row onto a crawl the dashboard already reports as closed.
   */
  private async crawlStillWants(jobId: string): Promise<boolean> {
    const cached = this.jobStatusCache.get(jobId);
    if (cached && Date.now() - cached.readAt < CrawlerService.JOB_STATUS_TTL_MS) {
      return cached.status === 'RUNNING' || cached.status === 'PENDING';
    }

    let status: string;
    try {
      const job = await this.prisma.crawlJob.findUnique({ where: { id: jobId }, select: { status: true } });
      // A job row that no longer exists is not one to keep fetching for.
      status = job?.status ?? 'GONE';
    } catch {
      // A failed lookup must not drop real work: assume the crawl is live and
      // let the fetch proceed. Draining is an optimisation; crawling is not.
      return true;
    }

    this.jobStatusCache.set(jobId, { status, readAt: Date.now() });
    if (this.jobStatusCache.size > 500) {
      for (const [key, value] of this.jobStatusCache) {
        if (Date.now() - value.readAt >= CrawlerService.JOB_STATUS_TTL_MS) this.jobStatusCache.delete(key);
      }
    }

    return status === 'RUNNING' || status === 'PENDING';
  }

  async processPageFetch(payload: PageFetchPayload): Promise<void> {
    try {
      // Before any fetch, render or write: this queue is shared by every
      // crawl, and work for a crawl that has already finished is work that
      // starves the one the customer is waiting on.
      if (!(await this.crawlStillWants(payload.jobId))) return;

      const normUrl = this.state.normalizeUrl(payload.targetUrl);

      // Every early return below leaves the URL in the inventory carrying the
      // reason it was not fetched. Returning without one is what made a
      // "discovered" URL disappear from the accounts entirely, so that the only
      // self-consistent coverage the dashboard could print was 100%.
      //
      // Out of time is the same as out of pages: the crawl is capped, not
      // done, and what is still queued drains without a fetch so the crawl
      // finishes with what it has read. Checked before the URL is claimed, so
      // a URL skipped here is not counted as a page read.
      if (payload.deadlineAt && Date.now() > payload.deadlineAt) {
        await this.state.bumpJobStat(payload.jobId, 'urlsSkipped');
        if (await this.state.isUrlClaimed(payload.jobId, normUrl)) {
          await this.inventory.markExcluded(payload.jobId, normUrl, 'duplicate');
          return;
        }
        await this.state.setJobCrawlStatus(payload.jobId, 'LIMIT_REACHED');
        await this.inventory.markExcluded(payload.jobId, normUrl, 'crawl_budget_exceeded');
        return;
      }
      const { alreadyVisited, limitReached } = await this.state.markUrlVisited(payload.jobId, normUrl, payload.pageLimit);
      if (alreadyVisited) {
        await this.state.bumpJobStat(payload.jobId, 'urlsSkipped');
        await this.inventory.markExcluded(payload.jobId, normUrl, 'duplicate');
        return;
      }
      if (limitReached) {
        // Mark the job status as LIMIT_REACHED so the UI shows it correctly
        await this.state.bumpJobStat(payload.jobId, 'urlsSkipped');
        await this.state.setJobCrawlStatus(payload.jobId, 'LIMIT_REACHED');
        await this.inventory.markExcluded(payload.jobId, normUrl, 'crawl_budget_exceeded');
        return;
      }

      if (payload.depth > payload.maxDepth) {
        await this.state.bumpJobStat(payload.jobId, 'urlsSkipped');
        await this.inventory.markExcluded(payload.jobId, normUrl, 'skipped_by_configuration');
        return;
      }

      const allowed = await this.robots.isUrlAllowed(normUrl);
      if (!allowed) {
        await this.state.bumpJobStat(payload.jobId, 'urlsSkipped');
        await this.state.bumpJobStat(payload.jobId, 'robotsBlocked');
        // Excluded, never removed: a URL robots.txt forbids is still a URL the
        // site published, and hiding it makes the sitemap and the crawl
        // disagree with no way to see why.
        await this.inventory.markExcluded(payload.jobId, normUrl, 'robots_blocked', { robotsAllowed: false });
        return;
      }

      // Read once per page from wherever the crawl's state actually lives, so
      // a page fetched by another worker — or by this one after a restart —
      // knows the same sitemap and the same robots.txt as the first page did.
      const crawlState = await this.state.loadCrawlState(payload.jobId);

      this.logger.log(`[JOB ${payload.jobId}] [Depth ${payload.depth}] Fetching & Analyzing: ${normUrl}`);
      // The two-tier fetch. Beyond rendering client-side pages, the contract
      // that matters is that `statusCode` is only ever a number the origin
      // actually sent: a DNS, TLS, timeout or proxy failure arrives as a typed
      // error and is recorded as such, instead of being written down as the
      // site refusing us.
      // The politeness delay the crawl was started with, which nothing used to
      // wait on. Keyed by the website's domain rather than the URL's host, so
      // the www and bare spellings of one site share one queue.
      await this.pacer.wait(payload.domain || new URL(normUrl).host, payload.rateLimitDelayMs);
      const rendersUsed = await this.state.rendersUsed(payload.jobId);
      // A crawl may ask for fewer renders than the deployment allows, never more.
      const deploymentRenderBudget = Number(process.env.CRAWL_MAX_RENDERED_PAGES || 100);
      const renderBudget =
        payload.renderBudget !== undefined ? Math.min(payload.renderBudget, deploymentRenderBudget) : deploymentRenderBudget;
      const outcome = await this.fetchSvc.fetch(normUrl, { renderAllowed: rendersUsed < renderBudget });
      if (outcome.tier === 'rendered') {
        await this.state.noteRenderUsed(payload.jobId);
      }
      const fetchRes = this.toLegacyFetchResult(outcome);
      const sitemapSetForJob = crawlState.sitemapUrls;

      // A file is not a page. The extension filter at enqueue time catches
      // most of these before the request is even made; this catches the ones
      // with no extension to judge by — a CMS serving a PDF from
      // /downloads/latest, say.
      //
      // Storing them was not a cosmetic problem. On the first competitor
      // crawled, 76 of 92 stored "pages" were images and PDFs, so every count
      // was six times too large and the site's own name fell below the
      // frequency threshold that marks a word as boilerplate — which silently
      // broke topic matching and produced a recommendation to write a page
      // about a JPEG filename.
      if (!isHtmlResponse(fetchRes.contentType)) {
        // A plain return is correct here: the pending-task accounting that
        // finishes the job lives in the finally block below, so returning
        // early still decrements and still completes the crawl.
        this.logger.debug(`[JOB ${payload.jobId}] Skipping ${normUrl}: ${fetchRes.contentType} is not a page.`);
        await this.inventory.markExcluded(payload.jobId, normUrl, 'unsupported_content_type', {
          httpStatus: fetchRes.statusCode,
        });
        return;

      }

      let snapshotUrl: string | undefined;
      if (fetchRes.html) {
        snapshotUrl = await this.storage.saveSnapshot(payload.jobId, Buffer.from(normUrl).toString('base64').substring(0, 16), fetchRes.html);
      }

      try {
        // 1. Run Analysis Pipeline if HTML 200 OK
        let $ = cheerio.load('');
        let htmlData = this.htmlExtractor.extract($, normUrl);
        let images = [] as any[];
        let links: any = { internalLinks: [], externalLinks: [], brokenAnchors: [], nofollowLinks: [], internalCount: 0, externalCount: 0, totalCount: 0 };
        let schemas = [] as any[];
        let content: any = { wordCount: 0, readingTimeMin: 0, contentHash: '', simHash: '', headingStructureErrors: [], imageCount: 0, internalLinkDensity: 0, externalLinkDensity: 0 };

        if (fetchRes.statusCode === 200 && fetchRes.html && (fetchRes.contentType?.includes('html') || !fetchRes.contentType)) {
          $ = cheerio.load(fetchRes.html);
          htmlData = this.htmlExtractor.extract($, normUrl);
          images = this.imageAnalyzer.analyzeImages($, normUrl);
          links = this.linkAnalyzer.analyzeLinks($, normUrl);
          schemas = this.schemaValidator.validateSchemas(htmlData.jsonLd);
          content = this.contentAnalyzer.analyzeContent(fetchRes.html, htmlData.h1, htmlData.h2, htmlData.h3, images.length, links.internalCount, links.externalCount);
        }

        // 2. Upsert Page with full metrics
        // Derived once and written on both paths: a re-crawl that changed a
        // page's URL shape or headings should re-type it, not keep the old
        // answer.
        const pageType = classifyPageType({ url: normUrl, title: htmlData.title, h1: htmlData.h1 });

        // Business module's product detector. Reuses the JSON-LD this same
        // pass already parsed above (htmlData.jsonLd) — never a second fetch,
        // never a second crawl. Only worth running once there is a body to
        // read; a non-200 or non-HTML response has none.
        const productSignal =
          fetchRes.statusCode === 200 && fetchRes.html
            ? detectProductSignals({
                url: normUrl,
                jsonLd: htmlData.jsonLd,
                bodyText: $('body').text(),
                pageTypeIsProduct: pageType === 'PRODUCT',
              })
            : null;

        // Indexability is computed from robots.txt, meta robots, the
        // X-Robots-Tag header and the canonical — never from the status code.
        // There was previously no such field at all, and the UI derived it
        // from `statusCode >= 400`, which is how a page carrying none of those
        // directives came to be labelled "Noindex".
        const robotsDecision = this.discovery.isAllowed(crawlState.robots, normUrl);
        const indexability = computeIndexability({
          statusCode: outcome.statusCode,
          robotsTxtAllows: robotsDecision?.allowed,
          robotsTxtEvidence: robotsDecision?.evidence,
          metaRobots: htmlData.robotsMeta,
          xRobotsTag: outcome.headers['x-robots-tag'],
          canonicalUrl: htmlData.canonicalUrl,
          pageUrl: outcome.finalUrl,
          fetchFailed: Boolean(outcome.error),
        });

        const v2Columns = {
          rawHtml: capHtml(outcome.rawHtml),
          // Only kept when it differs from the raw body: otherwise it is a
          // second copy of the same bytes on every page of every crawl.
          renderedHtml: outcome.jsRequired ? capHtml(outcome.renderedHtml) : null,
          jsRequired: outcome.jsRequired,
          discoverySource: sitemapSetForJob.has(normUrl) ? 'sitemap' : payload.sourceUrl ? 'link' : 'seed',
          statusChain: outcome.statusChain as unknown as object,
          blockedSuspected: outcome.blockedSuspected,
          indexability: indexability.indexability,
          indexabilityReason: indexability.reasons as unknown as object,
          fetchErrorKind: outcome.error?.kind ?? null,
        };

        const page = await this.prisma.page.upsert({
          where: { crawlJobId_url: { crawlJobId: payload.jobId, url: normUrl } },
          update: {
            pageType,
            finalUrl: fetchRes.finalUrl,
            statusCode: fetchRes.statusCode,
            responseTimeMs: fetchRes.responseTimeMs,
            contentType: fetchRes.contentType,
            htmlSnapshotUrl: snapshotUrl,
            ...v2Columns,
            title: htmlData.title,
            metaDescription: htmlData.metaDescription,
            canonicalUrl: htmlData.canonicalUrl,
            robotsMeta: htmlData.robotsMeta,
            h1: htmlData.h1,
            h2: htmlData.h2,
            h3: htmlData.h3,
            wordCount: content.wordCount,
            readingTimeMin: content.readingTimeMin,
            contentHash: content.contentHash,
            simHash: content.simHash || undefined,
          },
          create: {
            crawlJobId: payload.jobId,
            url: normUrl,
            pageType,
            finalUrl: fetchRes.finalUrl,
            statusCode: fetchRes.statusCode,
            responseTimeMs: fetchRes.responseTimeMs,
            contentType: fetchRes.contentType,
            htmlSnapshotUrl: snapshotUrl,
            ...v2Columns,
            title: htmlData.title,
            metaDescription: htmlData.metaDescription,
            canonicalUrl: htmlData.canonicalUrl,
            robotsMeta: htmlData.robotsMeta,
            h1: htmlData.h1,
            h2: htmlData.h2,
            h3: htmlData.h3,
            wordCount: content.wordCount,
            readingTimeMin: content.readingTimeMin,
            contentHash: content.contentHash,
            simHash: content.simHash || undefined,
          },
        });

        if (productSignal?.isProductPage) {
          await this.recorder.recordCatalogProduct(payload.websiteId, page.id, normUrl, productSignal);
        }

        // The inventory's copy of the outcome. A 301 and a 404 are both crawl
        // results recorded against the URL that produced them; neither removes
        // the URL, and a canonical pointing elsewhere does not replace it.
        await this.inventory.markCrawled(payload.jobId, normUrl, {
          httpStatus: fetchRes.statusCode,
          contentType: fetchRes.contentType,
          indexability: indexability.indexability,
          canonicalUrl: htmlData.canonicalUrl,
          robotsAllowed: robotsDecision?.allowed ?? true,
          rendered: outcome.tier === 'rendered',
          redirectTarget: fetchRes.finalUrl !== normUrl ? fetchRes.finalUrl : null,
        });

        const updatedJob = await this.prisma.crawlJob.update({
          where: { id: payload.jobId },
          data: { pagesCrawled: { increment: 1 } },
        });
        this.crawlerGateway.broadcastProgress(payload.jobId, { pagesCrawled: updatedJob.pagesCrawled, currentUrl: normUrl });
        this.metrics.pagesCrawledTotal.inc({ jobId: payload.jobId, status: String(fetchRes.statusCode) });

        if (payload.sourceUrl) {
          await this.prisma.internalGraph.create({
            data: {
              crawlJobId: payload.jobId,
              sourceUrl: this.state.normalizeUrl(payload.sourceUrl),
              targetUrl: normUrl,
              crawlDepth: payload.depth,
            },
          }).catch(() => {});
        }

        // 3. Save extracted Images
        for (const img of images) {
          await this.prisma.image.create({
            data: {
              pageId: page.id,
              imageUrl: img.imageUrl,
              altText: img.altText,
              isLazy: img.isLazy,
              isBroken: img.isBroken,
              isLarge: img.isLarge,
            },
          }).catch(() => {});
        }

        // 4. Run Issue Engine.
        //
        // Suppressed entirely when the fetch produced no response, or when the
        // origin answered with a challenge a browser would not get. One bad
        // outcome used to spawn six findings — a missing title, a missing meta
        // description, a missing canonical, a missing H1 — every one of them
        // measured against a body we never received. The single finding that
        // says so is raised by the site-level pass in completeJob.
        const inSitemap = sitemapSetForJob.has(normUrl);

        if (outcome.error || outcome.blockedSuspected) {
          await this.recorder.persistFetchFailureIssue(payload.jobId, payload.websiteId, page.id, normUrl, outcome);
        } else {
        await this.issueEngine.evaluateAndPersistIssues(
          payload.jobId,
          await this.recorder.resolveProjectId(payload.websiteId),
          payload.websiteId,
          page.id,
          normUrl,
          fetchRes.statusCode,
          fetchRes.redirectChain || [],
          fetchRes.html || '',
          $,
          htmlData,
          images,
          links,
          content,
          schemas,
          inSitemap,
          true
        );

        // The legacy engine knows nothing about rendering, so the highest-value
        // finding on a client-rendered site has to be raised here. Without
        // this, a site that is blank to every AI answer engine passes its audit
        // with nothing said about it.
        await this.recorder.persistRenderFindings(payload.jobId, payload.websiteId, page.id, normUrl, outcome);
        }

        // 5. Asynchronously trigger Core Web Vitals for Homepage or depth 0 pages
        if (payload.depth === 0 && fetchRes.statusCode === 200) {
          this.performanceService.fetchPageSpeedMetrics(page.id, normUrl).catch(() => {});
        }

        // 6. Record the social profiles this page links out to
        if (fetchRes.statusCode === 200) {
          await this.recorder.recordSocialLinks(payload.jobId, links.externalLinks);
        }

        // 7. Enqueue internal links for BFS crawling
        if (fetchRes.statusCode === 200 && fetchRes.html) {
          const allInternalTargets = [...links.internalLinks];
          const existingTargets = new Set(allInternalTargets.map((l: any) => l.targetUrl));

          // JSON-LD structured data URLs
          if (htmlData.jsonLd && htmlData.jsonLd.length > 0) {
            const jsonUrls = extractUrlsFromJsonLd(htmlData.jsonLd, normUrl);
            for (const jUrl of jsonUrls) {
              if (!existingTargets.has(jUrl)) {
                existingTargets.add(jUrl);
                allInternalTargets.push({ targetUrl: jUrl, anchorText: 'structured_data' });
              }
            }
          }

          // Canonical target
          if (htmlData.canonicalUrl && isInternalTargetUrl(htmlData.canonicalUrl, normUrl)) {
            if (!existingTargets.has(htmlData.canonicalUrl)) {
              existingTargets.add(htmlData.canonicalUrl);
              allInternalTargets.push({ targetUrl: htmlData.canonicalUrl, anchorText: 'canonical' });
            }
          }

          // Pagination links: link[rel="next"], link[rel="prev"]
          $('link[rel="next" i], link[rel="prev" i]').each((_, el) => {
            const href = $(el).attr('href');
            if (href) {
              try {
                const abs = new URL(href, normUrl).toString();
                if (isInternalTargetUrl(abs, normUrl) && !existingTargets.has(abs)) {
                  existingTargets.add(abs);
                  allInternalTargets.push({ targetUrl: abs, anchorText: 'pagination' });
                }
              } catch {}
            }
          });

          // Which of these links exist only after JavaScript ran.
          //
          // The render tier already fetches both bodies, but every link it
          // found was attributed to `link` regardless, so the "JavaScript DOM"
          // row on the dashboard could only ever be 0 — including on a site
          // like milquufresh.in, whose served HTML is a 2KB Vite shell with no
          // anchors at all and whose entire navigation is JS-only. Reporting 0
          // there is not a small inaccuracy: it says the crawler checked and
          // found nothing, when in fact everything it found came from exactly
          // that source.
          const jsOnlyTargets = this.linksOnlyInRenderedDom(outcome, normUrl);
          await this.discoverInternalLinksAndEnqueue(payload, allInternalTargets, page.id, jsOnlyTargets);
        }
      } catch (dbErr: any) {
        this.logger.error(`[JOB ${payload.jobId}] Error saving page or issues for ${normUrl}`, dbErr);
      }
    } catch (err) {
      // A URL is claimed before it is fetched, so that two workers cannot crawl
      // it at once. The claim outlives the attempt that made it, so an attempt
      // that dies before recording anything takes the page with it: BullMQ
      // retries the task, the retry finds the URL already claimed and returns
      // without fetching, and the page is simply absent from a crawl that
      // reports itself complete. Handing the claim back lets the retry do the
      // work it was scheduled for.
      await this.state.releaseUrlClaim(payload.jobId, this.state.normalizeUrl(payload.targetUrl));
      throw err;
    } finally {
      if (this.queue.pageFetchQueue) {
        // Settled by task identity, not by arrival: BullMQ runs a task again
        // after a retry or a lapsed lock, and counting those re-runs as
        // separate work is what drove the counter to zero with most of the
        // site still queued. `alreadySettled` means this run is a duplicate of
        // one already accounted for, so the crawl is not finished by it.
        const { remaining, alreadySettled } = await this.queue.settlePageFetchTask(payload.jobId, payload.taskId);
        if (!alreadySettled && remaining <= 0) {
          const job = await this.prisma.crawlJob.findUnique({ where: { id: payload.jobId } });
          if (job && job.status === 'RUNNING') {
            await this.completeJob(payload.jobId);
          }
        }
      }
    }
  }

  /**
   * Maps a v2 fetch outcome onto the shape the existing analysis pipeline
   * expects.
   *
   * An adapter rather than a rewrite of every analyser: the extractors, the
   * link and image analysers and the issue engine all read `{ html, statusCode,
   * contentType, ... }`, and they are correct — the defect was never in them,
   * it was in what they were being fed. `html` is the rendered DOM whenever the
   * render tier ran, which is the whole point.
   *
   * `statusCode` is 0 when no origin answered. That is not a real HTTP status,
   * so every existing reader asking `=== 200` or `>= 400` simply does not match
   * it, rather than counting our network failure as the customer's defect.
   */
  private toLegacyFetchResult(outcome: FetchOutcome) {
    return {
      url: outcome.url,
      finalUrl: outcome.finalUrl,
      statusCode: outcome.statusCode ?? 0,
      // How fast the origin answered, not how long we took.
      //
      // `totalMs` is our own wall clock for the whole fetch: the static
      // request, the render, and the time the render spent queued behind
      // another one on the single permit a small instance allows. Stored as
      // the page's response time, a contended crawl makes the customer's site
      // look slow — the 2026-09-16 milquufresh crawl recorded 224,897ms
      // "average latency", which was our queue, and the Performance tab then
      // multiplied it into an LCP of 359.8 seconds. TTFB is the figure that
      // means what the column says.
      responseTimeMs: outcome.ttfbMs ?? outcome.totalMs,
      contentType: outcome.contentType,
      html: outcome.html,
      redirectChain: outcome.statusChain.map((hop) => hop.url),
      engine: outcome.tier === 'rendered' ? ('playwright' as const) : ('cheerio' as const),
      errorMessage: outcome.error?.message,
    };
  }

  /**
   * Enqueues discovered internal links for BFS crawling
   */
  /**
   * The internal links that appear in the rendered DOM and not in the bytes the
   * origin served.
   *
   * Returned as a set of normalized URLs so the inventory can credit them to
   * `javascript_dom`. An empty set when the page was never rendered, which is
   * the honest answer: no render means no evidence either way, not zero.
   */
  private linksOnlyInRenderedDom(outcome: { rawHtml?: string; renderedHtml?: string; tier?: string }, pageUrl: string): Set<string> {
    const jsOnly = new Set<string>();
    if (outcome.tier !== 'rendered' || !outcome.renderedHtml) return jsOnly;

    try {
      const rawLinks = new Set(
        this.discovery.extractLinks(outcome.rawHtml || '', pageUrl).map((l) => l.normalizedUrl),
      );
      for (const link of this.discovery.extractLinks(outcome.renderedHtml, pageUrl)) {
        if (!rawLinks.has(link.normalizedUrl)) jsOnly.add(link.normalizedUrl);
      }
    } catch {
      // Extraction is best-effort; a parse failure must not lose the links
      // themselves, which are enqueued by the caller either way.
    }
    return jsOnly;
  }

  private async discoverInternalLinksAndEnqueue(
    payload: PageFetchPayload,
    internalLinks: any[],
    sourcePageId: string,
    jsOnlyTargets: Set<string> = new Set(),
  ): Promise<void> {
    // Collect all eligible BFS links first, then bulk-enqueue them atomically.
    // Enqueueing one-by-one while workers are running creates the same race as
    // the seed URL loop: a worker that finishes between two enqueue calls can
    // drop the pending counter to 0 and trigger completeJob prematurely.
    const newPayloads: PageFetchPayload[] = [];
    // Links to a page this crawl already has, under another spelling or the
    // same one. Not enqueued: the fetch would only discover the claim and drop
    // the task. On aivaenterprises.com, whose sitemap says www and whose links
    // do not, that was a second task for every page on the site.
    const alreadyClaimed: string[] = [];
    const batchKeys = new Set<string>();

    for (const link of internalLinks) {
      const targetClean = this.state.normalizeUrl(link.targetUrl);

      this.prisma.link.create({
        data: {
          sourcePageId,
          targetUrl: targetClean,
          linkType: 'INTERNAL',
          anchorText: link.anchorText || undefined,
          isNofollow: link.isNofollow || false,
        },
      }).catch(() => {});

      // The link is still recorded above — it exists on the page and the graph
      // should know about it — but a file is not fetched. This is the half of
      // the fix that saves a third party's bandwidth rather than just our
      // counts: a page ceiling bounds how many requests are made and says
      // nothing about their weight, and 74 images is a great deal heavier than
      // the HTML the limit was meant to protect.
      if (!isCrawlablePage(targetClean)) continue;

      const key = this.state.visitKey(targetClean);
      if (batchKeys.has(key)) continue;
      batchKeys.add(key);
      if (await this.state.isUrlClaimed(payload.jobId, targetClean)) {
        alreadyClaimed.push(targetClean);
        continue;
      }

      if (payload.depth + 1 <= payload.maxDepth) {
        newPayloads.push({
          jobId: payload.jobId,
          websiteId: payload.websiteId,
          domain: payload.domain,
          targetUrl: targetClean,
          sourceUrl: payload.targetUrl,
          depth: payload.depth + 1,
          maxDepth: payload.maxDepth,
          rateLimitDelayMs: payload.rateLimitDelayMs,
          pageLimit: payload.pageLimit,
          deadlineAt: payload.deadlineAt,
          renderBudget: payload.renderBudget,
        });
      }
    }

    if (internalLinks.length > 0) {
      // `internalLinksFound` counts link *events* — every anchor on every page.
      // It is not a URL count and must never be presented as one: a nav menu
      // repeated across 32 pages is 32 events over a handful of URLs. The
      // inventory below is where the unique URLs go.
      await this.state.bumpJobStat(payload.jobId, 'internalLinksFound', internalLinks.length);
      await this.inventory
        .record(
          payload.jobId,
          internalLinks.map((link) => {
            const normalized = this.state.normalizeUrl(link.targetUrl);
            return {
              url: normalized,
              source: jsOnlyTargets.has(normalized) ? 'javascript_dom' : 'internal_link',
              sourceUrl: payload.targetUrl,
              depth: payload.depth + 1,
            };
          }),
        )
        .catch(() => undefined);
    }

    // Recorded after the inventory rows exist, so each spelling reads as the
    // page it is rather than as a URL still waiting in the queue.
    for (const claimedUrl of alreadyClaimed) {
      await this.inventory.markExcluded(payload.jobId, claimedUrl, 'duplicate').catch(() => undefined);
    }

    if (newPayloads.length === 0) return;

    if (this.queue.pageFetchQueue) {
      // Bulk-enqueue: pre-increments by newPayloads.length atomically,
      // then commits all jobs to Redis in one pipeline.
      try {
        await this.queue.bulkAddPageFetchTasks(newPayloads, 0);
        await this.inventory.markQueued(payload.jobId, newPayloads.map((task) => task.targetUrl));
      } catch (err) {
        this.logger.error(`[JOB ${payload.jobId}] Link enqueue failed; marking ${newPayloads.length} URL(s) queue_failed.`, err);
        for (const task of newPayloads) {
          await this.inventory.markExcluded(payload.jobId, task.targetUrl, 'queue_failed');
        }
      }
    } else {
      const localQueue = this.localJobQueues.get(payload.jobId);
      if (localQueue) {
        localQueue.push(...newPayloads);
        await this.inventory.markQueued(payload.jobId, newPayloads.map((task) => task.targetUrl));
      }
    }
  }

  async completeJob(jobId: string): Promise<void> {
    const job = await this.prisma.crawlJob.findUnique({ where: { id: jobId } });
    // A cancelled crawl stays cancelled. The in-memory worker pool calls this
    // when its workers drain, and a crawl cancelled mid-flight (its competitor
    // removed) would otherwise be analysed and re-labelled COMPLETED.
    if (!job || job.status === 'COMPLETED' || job.status === 'CANCELLED') return;

    this.logger.log(`[JOB ${jobId}] Crawl job finished. Running final Graph Link Equity & Orphan analysis...`);
    try {
      await this.graphService.generateGraphReport(jobId);
    } catch (graphErr) {
      this.logger.error(`[JOB ${jobId}] Graph analysis error`, graphErr);
    }

    // 1. Retrieve crawled pages and issues to calculate authoritative health score and diagnostics
    const pages: any[] = [];
    let pagesCursor: string | null = null;
    let hasMorePages = true;
    while (hasMorePages) {
      const queryOptions: any = {
        where: { crawlJobId: jobId },
        select: {
          id: true,
          url: true,
          statusCode: true,
          responseTimeMs: true,
          indexability: true,
          blockedSuspected: true,
          jsRequired: true,
          discoverySource: true,
        },
        take: 10000,
        orderBy: { id: 'asc' },
      };
      if (pagesCursor) {
        queryOptions.skip = 1;
        queryOptions.cursor = { id: pagesCursor };
      }
      const batch = await this.prisma.page.findMany(queryOptions);
      pages.push(...batch);
      if (batch.length < 10000) hasMorePages = false;
      else pagesCursor = batch[batch.length - 1].id;
      await new Promise((resolve) => setImmediate(resolve));
    }

    const issues: any[] = [];
    let issuesCursor: string | null = null;
    let hasMoreIssues = true;
    while (hasMoreIssues) {
      const queryOptions: any = {
        where: { crawlJobId: jobId },
        select: {
          id: true,
          issueType: true,
          severity: true,
          confidence: true,
          affectedUrl: true,
          dedupKey: true,
          page: { select: { url: true } },
        },
        take: 10000,
        orderBy: { id: 'asc' },
      };
      if (issuesCursor) {
        queryOptions.skip = 1;
        queryOptions.cursor = { id: issuesCursor };
      }
      const batch = await this.prisma.issue.findMany(queryOptions);
      issues.push(...batch);
      if (batch.length < 10000) hasMoreIssues = false;
      else issuesCursor = batch[batch.length - 1].id;
      await new Promise((resolve) => setImmediate(resolve));
    }

    // Site-level findings: defects about the site as a whole rather than about
    // any one page. A sitemap pointing at another domain is the reason a crawl
    // like dronaarchery.com's ends at one page, and it belongs to the crawl,
    // not to whichever URL happened to be fetched first.
    await this.recorder.persistSiteFindings(jobId, job.websiteId);

    // Continuity across crawls. Runs after site findings so everything this
    // crawl has to say is on the table before it is compared with last time's;
    // reconciling first would read a site-level finding raised moments later
    // as absent, and resolve something that is still true.
    try {
      const projectId = await this.recorder.resolveProjectId(job.websiteId);
      await this.issueEngine.reconcileAgainstPreviousCrawl(projectId, jobId);
    } catch (reconcileErr) {
      // A crawl that cannot be reconciled is still a crawl worth finishing.
      // The next one reconciles against this one and recovers the history.
      this.logger.error(`[JOB ${jobId}] Issue reconciliation failed`, reconcileErr);
    }

    const totalPages = pages.length;
    const totalFindings = issues.length;

    // Deduplicate issues by dedupKey or (pageUrl + issueType)
    const uniqueIssueMap = new Map<string, typeof issues[0]>();
    for (const issue of issues) {
      const key = (issue as any).dedupKey || `${issue.page?.url || issue.affectedUrl}::${issue.issueType}`;
      if (!uniqueIssueMap.has(key)) {
        uniqueIssueMap.set(key, issue);
      }
    }
    const uniqueIssuesCount = uniqueIssueMap.size;

    // 2. Authoritative health score.
    //
    // Computed by the same function the dashboard calls, so the gauge and the
    // breakdown printed beside it cannot disagree. The previous scorer lived
    // only on this side and counted every page equally, including the ones we
    // never managed to fetch — which is how a site whose homepage we failed to
    const { sitemapUrls: sitemapSet } = await this.state.loadCrawlState(jobId);
    const stats = this.state.jobStats.get(jobId);
    const sharedStats = await this.state.readJobStats(jobId);
    // Read off the inventory rows, not off a counter.
    //
    // `job.pagesDiscovered` is written once, at seed time, so it cannot include
    // a URL found in a link while the crawl ran. Using it as the denominator
    // meant discovered could never exceed crawled, and the coverage card could
    // only ever print 100%. The inventory has one row per unique URL whatever
    // became of it, so the figure below is the number of URLs this crawl knows
    // about, and it reconciles with the table the UI renders beneath it.
    const inventoryMetrics = await this.inventory.metrics(jobId).catch((err) => {
      this.logger.warn(`[JOB ${jobId}] Inventory metrics unavailable: ${(err as Error).message}`);
      return null;
    });

    const urlsSkipped = sharedStats.urlsSkipped;
    const robotsBlocked = sharedStats.robotsBlocked;
    const internalLinksFound = sharedStats.internalLinksFound;

    // The fallback is the old seed count, which is a floor rather than a
    // pretence: without the inventory we genuinely do not know how many URLs
    // were found, and the crawled total is the least it can be.
    const urlsDiscovered = inventoryMetrics
      ? Math.max(inventoryMetrics.urlsDiscovered, totalPages)
      : Math.max(job.pagesDiscovered || stats?.urlsDiscovered || 0, totalPages);

    // `internalLinksFound` is an event count and stays one. The URL count per
    // source comes from the inventory, where one URL found five times is one.
    const discoveryEvents = { internal_link: internalLinksFound };

    const crawlSummary = computeCrawlSummary({
      pages: pages.map((p) => ({
        url: p.url,
        statusCode: p.statusCode,
        indexability: p.indexability,
        blockedSuspected: p.blockedSuspected,
        jsRequired: p.jsRequired,
        discoverySource: p.discoverySource,
      })),
      issues: Array.from(uniqueIssueMap.values()).map((i) => ({
        issueType: i.issueType,
        severity: i.severity,
        confidence: (i as any).confidence || 'CONFIRMED',
        affectedUrl: i.page?.url || i.affectedUrl,
      })),
      discoveryMetrics: {
        urlsDiscovered,
        urlsQueued: inventoryMetrics?.urlsQueued ?? urlsDiscovered,
        urlsCrawled: totalPages,
        failed: inventoryMetrics?.failed ?? pages.filter((p) => p.statusCode == null || p.statusCode >= 400).length,
        duplicates: inventoryMetrics?.duplicates ?? urlsSkipped,
        canonicalized: inventoryMetrics?.canonicalized,
        bySource: inventoryMetrics?.bySource,
        discoveryEvents,
        multiSourceUrls: inventoryMetrics?.multiSourceUrls,
        renderedPages: inventoryMetrics?.renderedPages,
        // Whether the render tier ran at all, which the UI needs in order to
        // say "Not scanned" instead of printing a zero it cannot stand behind.
        renderingEnabled: (await this.state.rendersUsed(jobId)) > 0 || (inventoryMetrics?.renderedPages ?? 0) > 0,
        discoveredNotCrawled: inventoryMetrics?.discoveredNotCrawled,
      },
    });
    const scoreResult = crawlSummary.health;
    const healthScore = scoreResult.score;

    // 3. Check previous completed crawl job to count resolved issues
    let resolvedIssuesCount = 0;
    try {
      const previousJob = await this.prisma.crawlJob.findFirst({
        where: {
          websiteId: job.websiteId,
          status: 'COMPLETED',
          id: { not: jobId },
        },
        orderBy: { finishedAt: 'desc' },
        select: { id: true },
      });

      if (previousJob) {
        const prevIssues: any[] = [];
        let prevCursor: string | null = null;
        let hasMorePrev = true;
        while (hasMorePrev) {
          const queryOptions: any = {
            where: { crawlJobId: previousJob.id },
            select: { id: true, dedupKey: true, issueType: true, affectedUrl: true, page: { select: { url: true } } },
            take: 10000,
            orderBy: { id: 'asc' },
          };
          if (prevCursor) {
            queryOptions.skip = 1;
            queryOptions.cursor = { id: prevCursor };
          }
          const batch = await this.prisma.issue.findMany(queryOptions);
          prevIssues.push(...batch);
          if (batch.length < 10000) hasMorePrev = false;
          else prevCursor = batch[batch.length - 1].id;
          await new Promise((resolve) => setImmediate(resolve));
        }

        const currentKeys = new Set(uniqueIssueMap.keys());
        const prevKeys = new Set(
          prevIssues.map((i) => (i as any).dedupKey || `${i.page?.url || i.affectedUrl}::${i.issueType}`),
        );

        for (const prevKey of prevKeys) {
          if (!currentKeys.has(prevKey)) {
            resolvedIssuesCount++;
          }
        }
      }
    } catch (diffErr) {
      this.logger.warn(`[JOB ${jobId}] Failed to calculate resolved issues against previous job`, diffErr);
    }

    // 4. Calculate quality diagnostics
    const statusCodeDist: Record<string, number> = {};
    let totalResponseTime = 0;
    let validResponseCount = 0;
    for (const p of pages) {
      const bucket = p.statusCode ? `${Math.floor(p.statusCode / 100)}xx` : 'other';
      statusCodeDist[bucket] = (statusCodeDist[bucket] || 0) + 1;
      if (p.responseTimeMs && p.responseTimeMs > 0) {
        totalResponseTime += p.responseTimeMs;
        validResponseCount++;
      }
    }
    const avgResponseTimeMs = validResponseCount > 0 ? Math.round(totalResponseTime / validResponseCount) : 0;

    const startedAt = job.startedAt || new Date();
    const finishedAt = new Date();
    const durationSeconds = Math.max(0, Math.round((finishedAt.getTime() - startedAt.getTime()) / 1000));

    // Determine final crawl status:
    // COMPLETED    — queue fully exhausted, no ceiling hit
    // LIMIT_REACHED — page ceiling or time budget was hit (explicitly configured cap)
    // PARTIAL      — stall sweep or error finalized a crawl before queue exhaustion
    const crawlStatus: 'COMPLETED' | 'LIMIT_REACHED' | 'PARTIAL' = sharedStats.crawlStatus;

    const urlsCrawled = totalPages;
    const urlsEligible = Math.max(urlsDiscovered - urlsSkipped, urlsCrawled);
    // Null, not 100, when there is nothing to divide by. Defaulting an
    // unmeasurable coverage to "complete" is how a truncated crawl reported
    // itself as whole.
    const crawlCoveragePercent =
      urlsDiscovered > 0 ? Math.round((urlsCrawled / urlsDiscovered) * 100) : null;

    const qualityDiagnostics = {
      durationSeconds,
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      pagesCrawled: urlsCrawled,
      statusCodes: statusCodeDist,
      avgResponseTimeMs,
      sitemapFound: sitemapSet.size > 0,
      sitemapUrlsCount: sitemapSet.size,
      // Richer crawl summary
      urlsDiscovered,
      urlsEligible,
      urlsCrawled,
      urlsSkipped,
      robotsBlocked,
      internalLinksFound,
      crawlCoveragePercent,
      crawlStatus,
      /**
       * The crawl's books, as rows rather than as counters. `urlsCrawled` plus
       * `notCrawled` equals `urlsDiscovered` by construction, and every URL in
       * `notCrawledReasons` carries the reason it was not fetched.
       */
      inventory: inventoryMetrics,
      internalLinkEvents: internalLinksFound,
      totalFindings,
      uniqueIssuesCount,
      resolvedIssuesCount,
      scoreBreakdown: scoreResult,
      /** The one computed view of this crawl. Every surface reads from here. */
      summary: crawlSummary,
    };

    const finished = await this.prisma.crawlJob.update({
      where: { id: jobId },
      data: {
        status: 'COMPLETED',
        finishedAt,
        healthScore,
        pagesCrawled: totalPages,
        // Corrected to what the crawl actually found. Left at the seed count it
        // was written with at startup, this understates discovery by every URL
        // reached through a link.
        pagesDiscovered: urlsDiscovered,
        issuesFound: totalFindings,
        uniqueIssuesCount,
        resolvedIssuesCount,
        qualityDiagnostics: qualityDiagnostics as any,
      },
      include: { website: { select: { project: { select: { organizationId: true } } } } },
    });

    this.logger.log(
      `[JOB ${jobId}] ${crawlStatus} — Health Score ${healthScore}/100, ${totalFindings} findings (${uniqueIssuesCount} unique, ${resolvedIssuesCount} resolved), ${urlsCrawled}/${urlsDiscovered} URLs in ${durationSeconds}s (coverage ${crawlCoveragePercent}%).`,
    );

    this.crawlerGateway.broadcastProgress(jobId, {
      status: crawlStatus,
      pagesCrawled: totalPages,
      healthScore,
      uniqueIssuesCount,
      resolvedIssuesCount,
      urlsDiscovered,
      crawlCoveragePercent,
    });

    this.metrics.activeCrawlJobs.dec();
    this.state.dropLocal(jobId);
    await this.state.forgetCrawlState(jobId);

    await this.announceCompletion(jobId, job.websiteId);
  }

  /**
   * Tells whoever is listening that a crawl finished, and what it crawled.
   *
   * A finished crawl is the start of the rest of the customer's onboarding —
   * the business behind the site is read from it, competitors are identified
   * from that, and their crawls follow — but none of that work can be reached
   * from here by an import. The chain runs
   * pipeline -> market research -> competitor crawl -> this service, so
   * injecting the pipeline would close the loop and Nest would refuse to
   * build the graph.
   *
   * Listeners register themselves instead, which keeps every dependency in
   * this module pointing one way: the crawler still knows nothing about who
   * consumes a crawl, and a deployment with no listener behaves exactly as
   * this service did before.
   */
  private async announceCompletion(jobId: string, websiteId: string): Promise<void> {
    for (const handler of this.completionHandlers) {
      try {
        await handler(jobId, websiteId);
      } catch (err) {
        // The crawl is finished and stored. Whatever a listener wanted to do
        // with it is follow-on work, and failing it must not un-finish a job.
        this.logger.error(`[JOB ${jobId}] Crawl completion handler failed`, err);
      }
    }
  }

  /**
   * Registers work to run once a crawl has completed and been stored.
   *
   * Called by the listener during its own module init, so ordering does not
   * matter: a crawl cannot complete before the application has started.
   */
  onCrawlCompleted(handler: CrawlCompletionHandler): void {
    this.completionHandlers.push(handler);
  }

}

/**
 * Deployment-wide crawl ceilings. A caller can ask for less, never more: the
 * workers are shared by every customer, and one crawl at concurrency 500 or
 * depth 1,000 degrades all of them.
 */
export function crawlLimits() {
  const num = (name: string, fallback: number) => {
    const value = Number(process.env[name]);
    return Number.isFinite(value) && value > 0 ? value : fallback;
  };
  return {
    maxConcurrency: num('CRAWL_MAX_CONCURRENCY', 10),
    maxDepth: num('CRAWL_MAX_DEPTH', 25),
    defaultPageLimit: num('CRAWL_DEFAULT_PAGE_LIMIT', 2000),
    maxPageLimit: num('CRAWL_MAX_PAGE_LIMIT', 5000),
  };
}

function clamp(value: number, min: number, max: number): number {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n)) return min;
  return Math.min(Math.max(n, min), max);
}
