import { Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { fingerprintFor, fingerprintScope, issueGroupKey } from '../issues/fingerprint.util';
import { StorageService } from '../../storage/storage.service';
import * as cheerio from 'cheerio';
import { QueueService, CrawlJobPayload, PageFetchPayload } from '../queue/queue.service';
import { RobotsService } from '../robots/robots.service';
import { SitemapService } from '../sitemap/sitemap.service';
import { FetcherService } from './fetcher.service';
import { classifyPageType } from './page-type';
import { completenessScore, detectProductSignals, matchConfidence, ProductSignal } from './product-detector';
import { canonicalUrl } from './canonical-url';
import { isCrawlablePage, isHtmlResponse } from './crawlable';
import { extractSocialProfiles } from './social-links';
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
import { DiscoveryService, SitemapFinding } from './discovery/discovery.service';
import { ParsedRobots } from './discovery/robots-txt';
import { computeIndexability } from './indexability';
import { evaluateSite } from './issue-rules';
import { findDuplicateClusters } from './frontier/duplicate-clusters';
import { computeCrawlSummary } from './crawl-summary';
import { UrlInventoryService } from './inventory/url-inventory.service';
import { extractUrlsFromJsonLd } from './page-extract';
import { isInternalTargetUrl } from './url/url-normalizer';
import * as url from 'url';

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
  private readonly localVisited = new Map<string, Set<string>>();
  private readonly jobSitemapUrls = new Map<string, Set<string>>();
  /** Sitemap defects found while seeding, raised as site-level issues at the end. */
  private readonly jobSitemapFindings = new Map<string, SitemapFinding[]>();
  /** Parsed robots.txt per job, so indexability can cite the rule that applied. */
  private readonly jobRobots = new Map<string, Awaited<ReturnType<DiscoveryService['fetchRobots']>>>();
  /**
   * Pages rendered so far, per job.
   *
   * A browser page is by far the most expensive thing a crawl does, and the
   * smallest deployment target has room for one at a time. Without a ceiling a
   * 500-page crawl of a client-rendered site would launch 500 renders on a
   * 512MB container. Pages past the budget are still fetched and still
   * assessed; they are marked RENDER_UNAVAILABLE so the report says its
   * coverage is partial rather than quietly reporting a shell as the page.
   */
  private readonly jobRendersUsed = new Map<string, number>();
  private readonly completionHandlers: CrawlCompletionHandler[] = [];

  /** Per-job crawl statistics for richer qualityDiagnostics. */
  private readonly jobStats = new Map<string, {
    urlsDiscovered: number;
    urlsSkipped: number;
    robotsBlocked: number;
    internalLinksFound: number;
    crawlStatus: 'COMPLETED' | 'LIMIT_REACHED' | 'PARTIAL';
  }>();

  /**
   * How long a job may go without recording a page before it is treated as
   * abandoned. Comfortably longer than a slow page fetch plus its retries, so a
   * crawl that is merely slow is never cut short.
   */
  private static readonly STALL_TIMEOUT_MS = 5 * 60 * 1000;
  private static readonly STALL_SWEEP_INTERVAL_MS = 2 * 60 * 1000;
  private stallSweep?: NodeJS.Timeout;

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
    private readonly inventory: UrlInventoryService,) {}

  /**
   * Initiates a new crawl job for a verified website
   */
  onModuleInit(): void {
    // Swept immediately as well as on a timer: a restart is the single most
    // likely reason for an abandoned job, and the jobs it abandoned should not
    // wait out a full interval before being cleared.
    void this.finalizeStalledJobs();
    this.stallSweep = setInterval(() => {
      void this.finalizeStalledJobs();
    }, CrawlerService.STALL_SWEEP_INTERVAL_MS);
    // Do not hold the process open on this timer alone.
    this.stallSweep.unref?.();
  }

  onModuleDestroy(): void {
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
   * crawl is never finalised out from under it.
   */
  private async finalizeStalledJobs(): Promise<void> {
    const idleSince = new Date(Date.now() - CrawlerService.STALL_TIMEOUT_MS);

    try {
      const stalled = await this.prisma.crawlJob.findMany({
        where: { status: { in: ['RUNNING', 'PENDING'] }, updatedAt: { lt: idleSince } },
        select: { id: true, pagesCrawled: true, pagesDiscovered: true, status: true },
      });
      if (stalled.length === 0) return;

      this.logger.warn(
        `Found ${stalled.length} crawl job(s) with no progress since ${idleSince.toISOString()}; finalising them.`,
      );

      for (const job of stalled) {
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
    } = {}
  ): Promise<string> {
    const website = await this.prisma.website.findUnique({ where: { id: websiteId } });
    if (!website) {
      throw new NotFoundException(`Website with ID ${websiteId} not found`);
    }

    const job = await this.prisma.crawlJob.create({
      data: {
        websiteId: website.id,
        status: 'PENDING',
        concurrency: options.maxConcurrency || website.maxConcurrency || 5,
        depthLimit: options.maxDepth || website.maxDepth || 10,
        pageLimit: options.pageLimit ?? null,
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
    await this.prisma.crawlJob.update({ where: { id: payload.jobId }, data: { status: 'RUNNING' } });
    this.metrics.activeCrawlJobs.inc();

    // Initialize per-job stats tracking
    this.jobStats.set(payload.jobId, {
      urlsDiscovered: 0,
      urlsSkipped: 0,
      robotsBlocked: 0,
      internalLinksFound: 0,
      crawlStatus: 'COMPLETED',
    });

    const seedUrls = new Set<string>();
    const sitemapSet = new Set<string>();
    const discoveredUrls: Array<{ url: string; normalizedUrl: string; source: string; foundIn?: string }> = [];
    seedUrls.add(this.normalizeUrl(payload.startUrl));
    discoveredUrls.push({
      url: payload.startUrl,
      normalizedUrl: this.normalizeUrl(payload.startUrl),
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
        this.logger.warn(`[JOB ${payload.jobId}] Sitemap ${finding.kind}: ${finding.evidence}`);
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
    await this.saveCrawlState(payload.jobId, { sitemapUrls: sitemapSet, robots: discoveredRobots, sitemapFindings });

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
    const stats = this.jobStats.get(payload.jobId);
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

      const normUrl = this.normalizeUrl(payload.targetUrl);

      // Every early return below leaves the URL in the inventory carrying the
      // reason it was not fetched. Returning without one is what made a
      // "discovered" URL disappear from the accounts entirely, so that the only
      // self-consistent coverage the dashboard could print was 100%.
      const { alreadyVisited, limitReached } = await this.markUrlVisited(payload.jobId, normUrl, payload.pageLimit);
      if (alreadyVisited) {
        await this.bumpJobStat(payload.jobId, 'urlsSkipped');
        await this.inventory.markExcluded(payload.jobId, normUrl, 'duplicate');
        return;
      }
      if (limitReached) {
        // Mark the job status as LIMIT_REACHED so the UI shows it correctly
        await this.bumpJobStat(payload.jobId, 'urlsSkipped');
        await this.setJobCrawlStatus(payload.jobId, 'LIMIT_REACHED');
        await this.inventory.markExcluded(payload.jobId, normUrl, 'crawl_budget_exceeded');
        return;
      }

      if (payload.depth > payload.maxDepth) {
        await this.bumpJobStat(payload.jobId, 'urlsSkipped');
        await this.inventory.markExcluded(payload.jobId, normUrl, 'skipped_by_configuration');
        return;
      }

      const allowed = await this.robots.isUrlAllowed(normUrl);
      if (!allowed) {
        await this.bumpJobStat(payload.jobId, 'urlsSkipped');
        await this.bumpJobStat(payload.jobId, 'robotsBlocked');
        // Excluded, never removed: a URL robots.txt forbids is still a URL the
        // site published, and hiding it makes the sitemap and the crawl
        // disagree with no way to see why.
        await this.inventory.markExcluded(payload.jobId, normUrl, 'robots_blocked', { robotsAllowed: false });
        return;
      }

      // Read once per page from wherever the crawl's state actually lives, so
      // a page fetched by another worker — or by this one after a restart —
      // knows the same sitemap and the same robots.txt as the first page did.
      const crawlState = await this.loadCrawlState(payload.jobId);

      this.logger.log(`[JOB ${payload.jobId}] [Depth ${payload.depth}] Fetching & Analyzing: ${normUrl}`);
      // The two-tier fetch. Beyond rendering client-side pages, the contract
      // that matters is that `statusCode` is only ever a number the origin
      // actually sent: a DNS, TLS, timeout or proxy failure arrives as a typed
      // error and is recorded as such, instead of being written down as the
      // site refusing us.
      const rendersUsed = await this.rendersUsed(payload.jobId);
      const renderBudget = Number(process.env.CRAWL_MAX_RENDERED_PAGES || 100);
      const outcome = await this.fetchSvc.fetch(normUrl, { renderAllowed: rendersUsed < renderBudget });
      if (outcome.tier === 'rendered') {
        await this.noteRenderUsed(payload.jobId);
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
          await this.recordCatalogProduct(payload.websiteId, page.id, normUrl, productSignal);
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
              sourceUrl: this.normalizeUrl(payload.sourceUrl),
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
          await this.persistFetchFailureIssue(payload.jobId, payload.websiteId, page.id, normUrl, outcome);
        } else {
        await this.issueEngine.evaluateAndPersistIssues(
          payload.jobId,
          await this.resolveProjectId(payload.websiteId),
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
        await this.persistRenderFindings(payload.jobId, payload.websiteId, page.id, normUrl, outcome);
        }

        // 5. Asynchronously trigger Core Web Vitals for Homepage or depth 0 pages
        if (payload.depth === 0 && fetchRes.statusCode === 200) {
          this.performanceService.fetchPageSpeedMetrics(page.id, normUrl).catch(() => {});
        }

        // 6. Record the social profiles this page links out to
        if (fetchRes.statusCode === 200) {
          await this.recordSocialLinks(payload.jobId, links.externalLinks);
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
      await this.releaseUrlClaim(payload.jobId, this.normalizeUrl(payload.targetUrl));
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
   * Raises JS_RENDER_REQUIRED, or RENDER_UNAVAILABLE when the page needed
   * rendering and we could not do it.
   *
   * The evidence is the raw-versus-rendered difference, so the claim is
   * checkable rather than asserted: this many words and links before
   * JavaScript ran, this many after.
   */
  private async persistRenderFindings(crawlJobId: string, websiteId: string, pageId: string, pageUrl: string, outcome: FetchOutcome): Promise<void> {
    if (outcome.jsRequired && outcome.renderDiff) {
      const diff = outcome.renderDiff;
      await this.persistIssue(crawlJobId, websiteId, pageId, pageUrl, {
        issueType: 'JS_RENDER_REQUIRED',
        severity: 'HIGH',
        confidence: 'CONFIRMED',
        description: 'Content is only available after JavaScript execution.',
        explanation:
          'The HTML the server sends is an empty shell. Everything that describes this page — its title, its copy and its links — is ' +
          'written by JavaScript in the browser afterwards.',
        impact:
          'Googlebot renders JavaScript, so Google will eventually see this page, though on a slower second pass. Bingbot, GPTBot, ' +
          'PerplexityBot, ClaudeBot and most social-preview scrapers largely do not, so to those engines this page is effectively blank. ' +
          'That is the difference between being ranked late and not being quotable in an AI answer at all.',
        recommendation:
          'Server-render or pre-render this route so the title, meta description, copy and navigation are present in the initial HTML response.',
        evidence:
          `Raw HTML: ${diff.rawWordCount} words, ${diff.rawLinkCount} links, title "${diff.rawTitle ?? '(none)'}". ` +
          `After rendering: ${diff.renderedWordCount} words, ${diff.renderedLinkCount} links, title "${diff.renderedTitle ?? '(none)'}". ` +
          (diff.fingerprints.length ? `Build fingerprints: ${diff.fingerprints.join(', ')}.` : ''),
      });
      return;
    }

    if (outcome.renderUnavailable && outcome.escalationReasons.length > 0) {
      await this.persistIssue(crawlJobId, websiteId, pageId, pageUrl, {
        issueType: 'RENDER_UNAVAILABLE',
        severity: 'MEDIUM',
        confidence: 'CONFIRMED',
        description: 'This page needs JavaScript to be read, and we could not render it on this crawl.',
        explanation: 'The static response is an empty shell and the render tier was unavailable or out of budget.',
        impact: 'Content findings for this page are incomplete and should not be trusted until it has been rendered.',
        recommendation: 'Re-run the audit with the render budget raised for this site.',
        evidence: `Escalation reasons: ${outcome.escalationReasons.join(', ')}`,
      });
    }
  }

  /**
   * Raises the findings that are about the crawl rather than about one page:
   * a sitemap on the wrong domain, sitemap URLs that do not resolve, and
   * clusters of URLs serving identical content.
   *
   * Duplicate clusters are reported once for the cluster. Reporting them as
   * one thin-content finding per copy both inflates the issue count and names
   * the wrong fix — the answer is a canonical, not more words.
   */
  private async persistSiteFindings(jobId: string, websiteId: string): Promise<void> {
    try {
      const website = await this.prisma.website.findUnique({ where: { id: websiteId }, select: { url: true, domain: true } });
      const siteUrl = website?.url?.startsWith('http') ? website.url : `https://${website?.domain ?? ''}`;
      if (!siteUrl || siteUrl === 'https://') return;

      const { sitemapUrls: sitemapSet, sitemapFindings } = await this.loadCrawlState(jobId);

      const pages = await this.prisma.page.findMany({
        where: { crawlJobId: jobId },
        select: { url: true, statusCode: true, contentHash: true, fetchErrorKind: true },
      });

      const deadSitemapUrls = pages
        .filter((p) => sitemapSet.has(p.url) && (p.statusCode === 0 || p.statusCode >= 400))
        .map((p) => ({
          url: p.url,
          status: p.statusCode,
          reason: p.statusCode === 0 ? `${p.fetchErrorKind ?? 'unknown'}: could not be fetched` : `HTTP ${p.statusCode}`,
        }));

      const duplicateClusters = findDuplicateClusters(pages.map((p) => ({ url: p.url, contentHash: p.contentHash })));

      const findings = evaluateSite({ siteUrl, sitemapFindings, duplicateClusters, deadSitemapUrls });
      for (const finding of findings) {
        await this.persistIssue(jobId, websiteId, null, finding.affectedUrl, {
          issueType: finding.id,
          severity: finding.severity,
          confidence: finding.confidence,
          description: finding.description,
          explanation: finding.explanation,
          impact: finding.impact,
          recommendation: finding.recommendation,
          evidence: finding.evidence,
        });
      }

      if (findings.length > 0) {
        this.logger.log(`[JOB ${jobId}] Raised ${findings.length} site-level finding(s): ${findings.map((f) => f.id).join(', ')}`);
      }
    } catch (err) {
      // Site-level findings are additional to a crawl that has already
      // succeeded; failing to write one must not un-finish the job.
      this.logger.error(`[JOB ${jobId}] Could not persist site-level findings`, err);
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
   * The one finding raised for a page we could not read.
   *
   * Everything the content rules would have said about such a page is a
   * statement about a body that never arrived, so this replaces them rather
   * than joining them.
   */
  private async persistFetchFailureIssue(crawlJobId: string, websiteId: string, pageId: string, pageUrl: string, outcome: FetchOutcome): Promise<void> {
    const blocked = !outcome.error && outcome.blockedSuspected;
    const issue = blocked
      ? {
          issueType: 'FETCH_BLOCKED_SUSPECTED',
          severity: 'HIGH',
          confidence: 'LIKELY',
          description: `The origin answered HTTP ${outcome.statusCode} even with a full browser request.`,
          explanation:
            'A bot-protection layer appears to be refusing automated clients. We retried with a complete browser header set and then ' +
            'through a real browser, and the refusal persisted, so this page could not be assessed.',
          impact:
            'Whatever refuses us may also refuse Bingbot, GPTBot, PerplexityBot and ClaudeBot. No content finding about this page can be ' +
            'trusted until it can be fetched.',
          recommendation: 'Allow our crawler in your WAF or CDN bot rules, then re-run the audit.',
          evidence: outcome.blockedEvidence || `HTTP ${outcome.statusCode}`,
        }
      : {
          issueType: 'FETCH_FAILED',
          severity: this.isRootUrl(pageUrl) ? 'CRITICAL' : 'HIGH',
          confidence: 'CONFIRMED',
          description: `Could not fetch page: ${outcome.error?.label ?? 'no response'}.`,
          explanation:
            'No response was obtained from the origin, so nothing about this page could be assessed. This is a report of what happened ' +
            'on our side, not a statement about the page itself.',
          impact: 'A page we cannot reach may be a page search engines cannot reach. No other finding about it would be trustworthy.',
          recommendation: `Check that ${pageUrl} resolves and responds from outside your own network.`,
          evidence: `${outcome.error?.kind ?? 'unknown'}: ${outcome.error?.message ?? 'no response'}`,
        };

    await this.persistIssue(crawlJobId, websiteId, pageId, pageUrl, issue);
  }

  /**
   * The project a website belongs to, cached for the life of the process.
   *
   * Resolved once per website rather than once per finding: a 10,000-page
   * crawl raises findings in the thousands, and every one of them would
   * otherwise repeat the same lookup. A website moving between projects
   * mid-crawl would be read stale, which costs that one crawl's findings their
   * project and is corrected by the next crawl — a trade worth making against
   * thousands of redundant queries.
   */
  private readonly projectIdByWebsite = new Map<string, string | null>();

  /**
   * (project, competitor) pairs a crawled website's product pages should be
   * written to for the Business module's catalogs.
   *
   * One entry with `competitorId: null` for the project's own site. One entry
   * per `CompetitorDomain` row for a competitor's site — there can be several,
   * because a competitor's `Website` is shared across every project tracking
   * that domain (deduped by domain), and each of those projects needs its own
   * catalog comparison.
   */
  private readonly catalogTargetsByWebsite = new Map<
    string,
    { projectId: string; competitorId: string | null; organizationId: string }[]
  >();

  private async resolveProjectId(websiteId: string): Promise<string | null> {
    const cached = this.projectIdByWebsite.get(websiteId);
    if (cached !== undefined) return cached;

    // Null is a real answer here, not a failure: competitor sites are stored
    // with no project on purpose. A lookup that fails outright gets the same
    // answer — a finding with no project is worth strictly more than a crawl
    // that died resolving one.
    try {
      const website = await this.prisma.website.findUnique({
        where: { id: websiteId },
        select: { projectId: true },
      });
      const projectId = website?.projectId ?? null;
      this.projectIdByWebsite.set(websiteId, projectId);
      return projectId;
    } catch {
      // Deliberately not cached. A transient failure that poisoned the cache
      // would strip the project from every remaining finding in the crawl,
      // long after the database recovered.
      this.logger.warn(`Could not resolve the project for website ${websiteId}; findings will carry none.`);
      return null;
    }
  }

  private async resolveCatalogTargets(
    websiteId: string,
  ): Promise<{ projectId: string; competitorId: string | null; organizationId: string }[]> {
    const cached = this.catalogTargetsByWebsite.get(websiteId);
    if (cached) return cached;

    try {
      const website = await this.prisma.website.findUnique({
        where: { id: websiteId },
        select: {
          projectId: true,
          project: { select: { organizationId: true } },
          competitors: { select: { id: true, projectId: true, project: { select: { organizationId: true } } } },
        },
      });
      if (!website) return [];

      const targets: { projectId: string; competitorId: string | null; organizationId: string }[] = [];
      if (website.projectId && website.project) {
        targets.push({ projectId: website.projectId, competitorId: null, organizationId: website.project.organizationId });
      }
      for (const competitor of website.competitors) {
        targets.push({ projectId: competitor.projectId, competitorId: competitor.id, organizationId: competitor.project.organizationId });
      }

      this.catalogTargetsByWebsite.set(websiteId, targets);
      return targets;
    } catch {
      // Not cached, same reasoning as resolveProjectId: a transient failure
      // must not poison every later page of this crawl.
      this.logger.warn(`Could not resolve catalog targets for website ${websiteId}; product pages on it will not be cataloged this crawl.`);
      return [];
    }
  }

  /**
   * Writes one CatalogProduct row per (project, competitor) target for a page
   * the product detector flagged. Never called for a page that isn't one —
   * a page that stops looking like a product on a later crawl keeps its old
   * row rather than being silently deleted, which the Business module's Gaps
   * tab treats as "check this one" instead of a phantom drop in the catalog.
   */
  private async recordCatalogProduct(websiteId: string, pageId: string, pageUrl: string, signal: ProductSignal): Promise<void> {
    const targets = await this.resolveCatalogTargets(websiteId);
    if (targets.length === 0) return;

    const shared = {
      pageId,
      name: signal.name,
      priceStatus: signal.priceStatus,
      priceMinorUnits: signal.priceMinorUnits,
      currency: signal.currency,
      stockStatus: signal.stockStatus,
      stockValue: signal.stockValue,
      category: signal.category,
      ctaType: signal.ctaType,
      completenessScore: completenessScore(signal),
    };
    // Only meaningful for a competitor: matching your own crawl to your own
    // catalog isn't a guess, so this stays null on those rows.
    const confidence = matchConfidence(signal);

    for (const target of targets) {
      try {
        if (target.competitorId) {
          // A real, non-null competitorId makes (projectId, competitorId, url)
          // a genuine tuple, so the compound unique key upsert works as-is.
          await this.prisma.catalogProduct.upsert({
            where: {
              projectId_competitorId_url: { projectId: target.projectId, competitorId: target.competitorId, url: pageUrl },
            },
            create: {
              projectId: target.projectId,
              competitorId: target.competitorId,
              url: pageUrl,
              organizationId: target.organizationId,
              matchConfidence: confidence,
              ...shared,
            },
            update: { organizationId: target.organizationId, matchConfidence: confidence, ...shared },
          });
        } else {
          // competitorId is NULL for every own-site row, and Postgres never
          // treats two NULLs as a duplicate, so the compound unique key
          // cannot back an upsert here — the partial index that protects this
          // case is enforced by the database, not by the Prisma query engine.
          // findFirst+create/update reaches the same result explicitly.
          const existing = await this.prisma.catalogProduct.findFirst({
            where: { projectId: target.projectId, competitorId: null, url: pageUrl },
            select: { id: true },
          });
          if (existing) {
            await this.prisma.catalogProduct.update({ where: { id: existing.id }, data: { organizationId: target.organizationId, ...shared } });
          } else {
            await this.prisma.catalogProduct.create({
              data: { projectId: target.projectId, competitorId: null, url: pageUrl, organizationId: target.organizationId, ...shared },
            });
          }
        }
      } catch (err) {
        this.logger.warn(`Could not record catalog product ${pageUrl} for project ${target.projectId}: ${(err as Error).message}`);
      }
    }
  }

  /**
   * Writes one finding, ignoring a duplicate already recorded for this crawl.
   *
   * Carries the same identity columns the issue engine writes. A finding that
   * reached the database without a fingerprint is invisible to reconciliation,
   * so it could never resolve and never regress — and the site-level findings
   * that come through here are among the longest-lived a site has.
   */
  private async persistIssue(
    crawlJobId: string,
    websiteId: string,
    pageId: string | null,
    affectedUrl: string,
    issue: { issueType: string; severity: string; confidence: string; description: string; explanation: string; impact: string; recommendation: string; evidence: string },
  ): Promise<void> {
    const dedupKey = `${affectedUrl}::${issue.issueType}`;
    const projectId = await this.resolveProjectId(websiteId);
    const scope = fingerprintScope(projectId, websiteId);
    const fingerprint = fingerprintFor(scope, issue.issueType, affectedUrl);
    const groupKey = issueGroupKey(scope, issue.issueType);
    try {
      const existing = await this.prisma.issue.findFirst({ where: { crawlJobId, dedupKey } });
      if (existing) return;
      await this.prisma.issue.create({
        data: {
          crawlJobId,
          projectId,
          fingerprint,
          groupKey,
          pageId: pageId ?? undefined,
          issueType: issue.issueType,
          severity: issue.severity as never,
          confidence: issue.confidence as never,
          category: 'TECHNICAL' as never,
          affectedUrl,
          description: issue.description,
          explanation: issue.explanation,
          impact: issue.impact,
          recommendation: issue.recommendation,
          evidence: issue.evidence,
          dedupKey,
          status: 'OPEN',
          aiFixAvailable: false,
        },
      });
      await this.prisma.crawlJob.update({ where: { id: crawlJobId }, data: { issuesFound: { increment: 1 } } });
    } catch (err) {
      this.logger.error(`[JOB ${crawlJobId}] Could not persist ${issue.issueType} for ${affectedUrl}`, err);
    }
  }

  private isRootUrl(rawUrl: string): boolean {
    try {
      const parsed = new URL(rawUrl);
      return parsed.pathname === '/' || parsed.pathname === '';
    } catch {
      return false;
    }
  }

  /**
   * Stores the social profiles a page links to, against the site being crawled.
   *
   * Written per page rather than once at the end because the page fetches are
   * distributed across workers and no single process sees the whole crawl. The
   * per-profile page count is the point: a business's own accounts sit in the
   * footer and so arrive once per page, while a link to a partner's profile
   * arrives once, and that difference is the only honest way to pick a site's
   * own account when it publishes more than one. Counted against the job, so
   * the figure stays comparable to that crawl's own page total.
   *
   * External links are otherwise not persisted at all, and deliberately still
   * are not — a site's outbound links run to hundreds per page and none of the
   * rest is read by anything.
   */
  private async recordSocialLinks(crawlJobId: string, externalLinks: { targetUrl: string }[]): Promise<void> {
    if (!crawlJobId || !externalLinks?.length) return;

    const profiles = extractSocialProfiles(externalLinks.map((link) => link.targetUrl));
    if (profiles.length === 0) return;

    for (const profile of profiles) {
      try {
        await this.prisma.siteSocialLink.upsert({
          where: {
            crawlJobId_platform_handle: {
              crawlJobId,
              platform: profile.platform,
              handle: profile.handle,
            },
          },
          update: { pageCount: { increment: 1 }, profileUrl: profile.profileUrl },
          create: {
            crawlJobId,
            platform: profile.platform,
            handle: profile.handle,
            profileUrl: profile.profileUrl,
            pageCount: 1,
          },
        });
      } catch (err) {
        // A profile that fails to store costs this site one discovery lead. It
        // must not fail the page, which carries the crawl's actual findings.
        this.logger.debug(`Could not record ${profile.platform} ${profile.handle}: ${err}`);
      }
    }
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
      const targetClean = this.normalizeUrl(link.targetUrl);

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

      const key = this.visitKey(targetClean);
      if (batchKeys.has(key)) continue;
      batchKeys.add(key);
      if (await this.isUrlClaimed(payload.jobId, targetClean)) {
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
        });
      }
    }

    if (internalLinks.length > 0) {
      // `internalLinksFound` counts link *events* — every anchor on every page.
      // It is not a URL count and must never be presented as one: a nav menu
      // repeated across 32 pages is 32 events over a handful of URLs. The
      // inventory below is where the unique URLs go.
      await this.bumpJobStat(payload.jobId, 'internalLinksFound', internalLinks.length);
      await this.inventory
        .record(
          payload.jobId,
          internalLinks.map((link) => {
            const normalized = this.normalizeUrl(link.targetUrl);
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

  /**
   * Crawl-wide facts that every page fetch needs and no single process owns.
   *
   * The sitemap's URL set, the parsed robots.txt and the sitemap's defects are
   * established once, by whichever process runs `processCrawlJob`, and then
   * read by every page fetch. Holding them in a field made them invisible to
   * anyone else: the worker deployment runs page fetches in a second container
   * (see docker-compose.yml), and a container that restarts mid-crawl — the
   * ordinary outcome of Chromium meeting a 512MB instance — comes back with
   * the maps empty and keeps fetching the same crawl's queued URLs.
   *
   * What that costs is not theoretical. Every page then fetched is recorded as
   * `seed` rather than `sitemap`, so the audit misreports how its own URLs were
   * found; `inSitemap` is false for all of them, so the issue engine raises
   * "not in the sitemap" against pages the sitemap does list; and indexability
   * is decided without the robots.txt rules. A crawl of milquufresh.in showed
   * exactly that — its homepage labelled `sitemap` and every later page
   * labelled `seed`, which is the signature of the state having been lost
   * between the two fetches.
   *
   * Stored in Redis where there is one, since that is already the crawl's
   * shared memory, and kept in the fields as a per-process cache and as the
   * whole story when Redis is absent and one process does everything.
   */
  private async saveCrawlState(
    jobId: string,
    state: { sitemapUrls: Set<string>; robots: ParsedRobots | undefined; sitemapFindings: SitemapFinding[] },
  ): Promise<void> {
    this.jobSitemapUrls.set(jobId, state.sitemapUrls);
    this.jobRobots.set(jobId, state.robots);
    this.jobSitemapFindings.set(jobId, state.sitemapFindings);

    const redisClient = this.queue.getRedisClient?.();
    if (!redisClient) return;
    try {
      await redisClient.set(
        `job:${jobId}:crawl_state`,
        JSON.stringify({
          sitemapUrls: [...state.sitemapUrls],
          robots: state.robots,
          sitemapFindings: state.sitemapFindings,
        }),
        'EX',
        86400,
      );
    } catch (error) {
      this.logger.warn(`[JOB ${jobId}] Crawl state could not be shared with the other workers: ${(error as Error).message}`);
    }
  }

  private async loadCrawlState(
    jobId: string,
  ): Promise<{ sitemapUrls: Set<string>; robots: ParsedRobots | undefined; sitemapFindings: SitemapFinding[] }> {
    const cached = this.jobSitemapUrls.get(jobId);
    if (cached) {
      return { sitemapUrls: cached, robots: this.jobRobots.get(jobId), sitemapFindings: this.jobSitemapFindings.get(jobId) || [] };
    }

    const empty = { sitemapUrls: new Set<string>(), robots: undefined, sitemapFindings: [] as SitemapFinding[] };
    const redisClient = this.queue.getRedisClient?.();
    if (!redisClient) return empty;

    try {
      const raw = await redisClient.get(`job:${jobId}:crawl_state`);
      if (!raw) return empty;
      const parsed = JSON.parse(raw) as {
        sitemapUrls?: string[];
        robots?: ParsedRobots;
        sitemapFindings?: SitemapFinding[];
      };
      const state = {
        sitemapUrls: new Set<string>(parsed.sitemapUrls || []),
        robots: parsed.robots,
        sitemapFindings: parsed.sitemapFindings || [],
      };
      // Cached in this process, so the rest of this worker's pages cost nothing.
      this.jobSitemapUrls.set(jobId, state.sitemapUrls);
      this.jobRobots.set(jobId, state.robots);
      this.jobSitemapFindings.set(jobId, state.sitemapFindings);
      return state;
    } catch (error) {
      this.logger.warn(`[JOB ${jobId}] Crawl state could not be read back: ${(error as Error).message}`);
      return empty;
    }
  }

  /** Drops a finished crawl's shared state, which nothing will read again. */
  private async forgetCrawlState(jobId: string): Promise<void> {
    await this.queue.forgetJobTasks?.(jobId);
    const redisClient = this.queue.getRedisClient?.();
    if (!redisClient) return;
    try {
      await redisClient.del(`job:${jobId}:crawl_state`, `job:${jobId}:stats`, `job:${jobId}:renders_used`);
    } catch {
      /* every one of these keys expires on its own within the day */
    }
  }

  /**
   * The crawl's render budget, counted where the whole crawl can see it.
   *
   * A budget held per process is no budget at all once there are two of them:
   * each worker starts its own count from zero and the instance gets the sum.
   */
  private async rendersUsed(jobId: string): Promise<number> {
    const redisClient = this.queue.getRedisClient?.();
    if (redisClient) {
      try {
        const value = await redisClient.get(`job:${jobId}:renders_used`);
        return value ? parseInt(value, 10) || 0 : 0;
      } catch {
        // Fall through to this process's own count rather than refusing to render.
      }
    }
    return this.jobRendersUsed.get(jobId) ?? 0;
  }

  private async noteRenderUsed(jobId: string): Promise<void> {
    this.jobRendersUsed.set(jobId, (this.jobRendersUsed.get(jobId) ?? 0) + 1);
    const redisClient = this.queue.getRedisClient?.();
    if (!redisClient) return;
    try {
      const key = `job:${jobId}:renders_used`;
      await redisClient.incr(key);
      await redisClient.expire(key, 86400);
    } catch {
      /* the in-process count above still bounds this worker */
    }
  }

  /**
   * A crawl's running totals, likewise kept where every worker can add to them.
   *
   * These are what the audit shows as coverage: how many URLs were skipped and
   * how many robots.txt refused. Counted in one process's memory they came back
   * as zero whenever the crawl was finished by another, which reads as "nothing
   * was skipped" — the reassuring answer rather than the true one.
   */
  private async bumpJobStat(jobId: string, field: 'urlsSkipped' | 'robotsBlocked' | 'internalLinksFound', by = 1): Promise<void> {
    const stats = this.jobStats.get(jobId);
    if (stats) stats[field] += by;

    const redisClient = this.queue.getRedisClient?.();
    if (!redisClient) return;
    try {
      const key = `job:${jobId}:stats`;
      await redisClient.hincrby(key, field, by);
      await redisClient.expire(key, 86400);
    } catch {
      /* a lost counter must never cost a page */
    }
  }

  private async setJobCrawlStatus(jobId: string, status: 'COMPLETED' | 'LIMIT_REACHED' | 'PARTIAL'): Promise<void> {
    const stats = this.jobStats.get(jobId);
    if (stats) stats.crawlStatus = status;

    const redisClient = this.queue.getRedisClient?.();
    if (!redisClient) return;
    try {
      const key = `job:${jobId}:stats`;
      await redisClient.hset(key, 'crawlStatus', status);
      await redisClient.expire(key, 86400);
    } catch {
      /* as above */
    }
  }

  private async readJobStats(jobId: string): Promise<{
    urlsSkipped: number;
    robotsBlocked: number;
    internalLinksFound: number;
    crawlStatus: 'COMPLETED' | 'LIMIT_REACHED' | 'PARTIAL';
  }> {
    const local = this.jobStats.get(jobId);
    const redisClient = this.queue.getRedisClient?.();
    if (redisClient) {
      try {
        const stored = (await redisClient.hgetall(`job:${jobId}:stats`)) as Record<string, string>;
        if (stored && Object.keys(stored).length > 0) {
          return {
            urlsSkipped: Number(stored.urlsSkipped || 0),
            robotsBlocked: Number(stored.robotsBlocked || 0),
            internalLinksFound: Number(stored.internalLinksFound || 0),
            crawlStatus: (stored.crawlStatus as 'COMPLETED' | 'LIMIT_REACHED' | 'PARTIAL') || 'COMPLETED',
          };
        }
      } catch {
        /* fall back to whatever this process saw */
      }
    }
    return {
      urlsSkipped: local?.urlsSkipped ?? 0,
      robotsBlocked: local?.robotsBlocked ?? 0,
      internalLinksFound: local?.internalLinksFound ?? 0,
      crawlStatus: local?.crawlStatus ?? 'COMPLETED',
    };
  }

  /**
   * Claims a URL for this job, returning a result object describing why (if) it
   * must not be fetched.
   *
   * `alreadyVisited` — the URL was seen before; skip silently (normal dedup).
   * `limitReached`   — the page ceiling was hit; the crawl is capped, not done.
   *
   * Every fetch passes through here in both the Redis and in-memory paths,
   * which is why the page ceiling is enforced here rather than at each of the
   * places that enqueue work. A cap checked at enqueue time would not hold:
   * links are discovered while the crawl runs, so the only number that can be
   * trusted is the count of URLs already claimed.
   *
   * Under concurrency the count can be read by several workers before any of
   * them adds, so a job may overshoot its ceiling by up to the worker count.
   * That is deliberate — the alternative is a Lua script or a lock on the hot
   * path of every fetch, and a handful of extra pages on a cap of a few
   * hundred is not worth either.
   */
  private async markUrlVisited(jobId: string, targetUrl: string, pageLimit?: number): Promise<{ alreadyVisited: boolean; limitReached: boolean }> {
    const redisClient = this.queue.getRedisClient();
    const key = `job:${jobId}:visited`;
    const member = this.visitKey(targetUrl);

    if (redisClient) {
      if (pageLimit && (await redisClient.scard(key)) >= pageLimit) {
        return { alreadyVisited: false, limitReached: true };
      }
      const added = await redisClient.sadd(key, member);
      if (added === 1) {
        await redisClient.expire(key, 86400);
        return { alreadyVisited: false, limitReached: false };
      }
      return { alreadyVisited: true, limitReached: false };
    }

    let visitedSet = this.localVisited.get(jobId);
    if (!visitedSet) {
      visitedSet = new Set<string>();
      this.localVisited.set(jobId, visitedSet);
    }
    if (pageLimit && visitedSet.size >= pageLimit) {
      return { alreadyVisited: false, limitReached: true };
    }
    if (visitedSet.has(member)) {
      return { alreadyVisited: true, limitReached: false };
    }
    visitedSet.add(member);
    return { alreadyVisited: false, limitReached: false };
  }

  /**
   * Whether this crawl has already claimed the page a URL names, in any
   * spelling. Read-only: the claim itself is still taken by markUrlVisited at
   * fetch time. A failed lookup answers "no", so the link is enqueued and the
   * fetch-time check decides, exactly as before this existed.
   */
  private async isUrlClaimed(jobId: string, targetUrl: string): Promise<boolean> {
    const member = this.visitKey(targetUrl);
    const redisClient = this.queue.getRedisClient?.();
    if (redisClient) {
      if (typeof redisClient.sismember !== 'function') return false;
      try {
        return (await redisClient.sismember(`job:${jobId}:visited`, member)) === 1;
      } catch {
        return false;
      }
    }
    return this.localVisited.get(jobId)?.has(member) ?? false;
  }

  /**
   * Hands a claimed URL back, so another attempt may fetch it.
   *
   * Only for an attempt that recorded nothing. A URL whose page was stored
   * keeps its claim, because re-fetching it would be duplicate work.
   */
  private async releaseUrlClaim(jobId: string, targetUrl: string): Promise<void> {
    const member = this.visitKey(targetUrl);
    // Optional, because this one runs while an error is already on its way out:
    // a second failure here would replace the error the caller needs to see.
    const redisClient = this.queue.getRedisClient?.();
    if (redisClient) {
      await redisClient.srem(`job:${jobId}:visited`, member).catch(() => undefined);
      return;
    }
    this.localVisited.get(jobId)?.delete(member);
  }

  async completeJob(jobId: string): Promise<void> {
    const job = await this.prisma.crawlJob.findUnique({ where: { id: jobId } });
    if (!job || job.status === 'COMPLETED') return;

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
    await this.persistSiteFindings(jobId, job.websiteId);

    // Continuity across crawls. Runs after site findings so everything this
    // crawl has to say is on the table before it is compared with last time's;
    // reconciling first would read a site-level finding raised moments later
    // as absent, and resolve something that is still true.
    try {
      const projectId = await this.resolveProjectId(job.websiteId);
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
    const { sitemapUrls: sitemapSet } = await this.loadCrawlState(jobId);
    const stats = this.jobStats.get(jobId);
    const sharedStats = await this.readJobStats(jobId);
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
        renderingEnabled: (await this.rendersUsed(jobId)) > 0 || (inventoryMetrics?.renderedPages ?? 0) > 0,
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
    // LIMIT_REACHED — page ceiling was hit (explicitly configured cap)
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

    // Bill crawled pages against the plan allowance only now that the job has
    // actually finished, so an aborted or failed crawl costs the customer nothing.
    const organizationId = (finished as any).website?.project?.organizationId;
    if (organizationId && finished.pagesCrawled > 0) {
      try {
      } catch (usageErr) {
        this.logger.error(`[JOB ${jobId}] Failed to record crawl usage`, usageErr);
      }
    }

    this.metrics.activeCrawlJobs.dec();
    this.localVisited.delete(jobId);
    this.jobSitemapUrls.delete(jobId);
    this.jobSitemapFindings.delete(jobId);
    this.jobRobots.delete(jobId);
    this.jobRendersUsed.delete(jobId);
    this.jobStats.delete(jobId);
    await this.forgetCrawlState(jobId);

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

  /**
   * The key a URL is deduplicated under within a crawl.
   *
   * Distinct from the URL we fetch. A site links itself both ways — the footer
   * uses https://example.com/about, the nav uses https://www.example.com/about
   * — and normalizeUrl treats those as two pages, so both were fetched and both
   * were stored. On the site crawled here that turned 35 pages into 44 rows,
   * and page-kind counts inflated with them: coverage read 12 product pages
   * where there were 9. Because how often a site links itself each way varies
   * per site, the inflation differs per site too, so a competitor comparison
   * was comparing two differently-wrong numbers.
   *
   * Only the key is canonicalised, never the URL we request. Plenty of sites
   * serve one host spelling and redirect the other, so rewriting the request
   * would turn a working fetch into a redirect chase or a 404; the fetcher
   * follows whatever redirect the site issues and records the result in
   * finalUrl.
   */
  private visitKey(normalizedUrl: string): string {
    return canonicalUrl(normalizedUrl);
  }

  private normalizeUrl(rawUrl: string): string {
    try {
      let formatted = rawUrl.trim();
      if (!formatted.startsWith('http://') && !formatted.startsWith('https://')) {
        formatted = `https://${formatted}`;
      }
      const parsed = url.parse(formatted);
      parsed.hash = null;
      let pathname = parsed.pathname || '/';
      if (pathname !== '/' && pathname.endsWith('/')) {
        pathname = pathname.slice(0, -1);
      }
      parsed.pathname = pathname;
      return url.format(parsed);
    } catch {
      return rawUrl;
    }
  }
}
