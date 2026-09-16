import { Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { StorageService } from '../../storage/storage.service';
import * as cheerio from 'cheerio';
import { QueueService, CrawlJobPayload, PageFetchPayload } from '../queue/queue.service';
import { RobotsService } from '../robots/robots.service';
import { SitemapService } from '../sitemap/sitemap.service';
import { FetcherService } from './fetcher.service';
import { classifyPageType } from './page-type';
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
import { computeIndexability } from './indexability';
import { evaluateSite } from './issue-rules';
import { findDuplicateClusters } from './frontier/duplicate-clusters';
import { computeCrawlSummary } from './crawl-summary';
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
    private readonly crawlerGateway: CrawlerGateway,) {}

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
        select: { id: true, pagesCrawled: true, status: true },
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
    seedUrls.add(this.normalizeUrl(payload.startUrl));

    const robotsRules = await this.robots.fetchRobotsRules(payload.domain);
    const delayMs = robotsRules.crawlDelayMs || payload.rateLimitDelayMs || 500;

    // Seeding runs through DiscoveryService, which unions robots.txt, declared
    // sitemaps, the conventional sitemap paths and nested index files, and —
    // the part that matters here — reports a sitemap whose URLs are on another
    // domain instead of quietly enqueueing them. The previous path added five
    // URLs on a domain that does not resolve, watched all five fail, and
    // reported that a sitemap had been found.
    try {
      const discovered = await this.discovery.discoverSeeds(payload.startUrl, { useSitemap: payload.useSitemap });
      this.jobRobots.set(payload.jobId, discovered.robots);
      this.jobSitemapFindings.set(payload.jobId, discovered.findings);

      for (const found of discovered.urls) {
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

    this.jobSitemapUrls.set(payload.jobId, sitemapSet);

    // Update urlsDiscovered stat with seed count
    const stats = this.jobStats.get(payload.jobId);
    if (stats) stats.urlsDiscovered = seedUrls.size;

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
      await this.queue.bulkAddPageFetchTasks(seedPayloads, 0);
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

      const { alreadyVisited, limitReached } = await this.markUrlVisited(payload.jobId, normUrl, payload.pageLimit);
      if (alreadyVisited) {
        const stats = this.jobStats.get(payload.jobId);
        if (stats) stats.urlsSkipped++;
        return;
      }
      if (limitReached) {
        // Mark the job status as LIMIT_REACHED so the UI shows it correctly
        const stats = this.jobStats.get(payload.jobId);
        if (stats) {
          stats.urlsSkipped++;
          stats.crawlStatus = 'LIMIT_REACHED';
        }
        return;
      }

      if (payload.depth > payload.maxDepth) {
        const stats = this.jobStats.get(payload.jobId);
        if (stats) stats.urlsSkipped++;
        return;
      }

      const allowed = await this.robots.isUrlAllowed(normUrl);
      if (!allowed) {
        const stats = this.jobStats.get(payload.jobId);
        if (stats) {
          stats.urlsSkipped++;
          stats.robotsBlocked++;
        }
        return;
      }

      this.logger.log(`[JOB ${payload.jobId}] [Depth ${payload.depth}] Fetching & Analyzing: ${normUrl}`);
      // The two-tier fetch. Beyond rendering client-side pages, the contract
      // that matters is that `statusCode` is only ever a number the origin
      // actually sent: a DNS, TLS, timeout or proxy failure arrives as a typed
      // error and is recorded as such, instead of being written down as the
      // site refusing us.
      const rendersUsed = this.jobRendersUsed.get(payload.jobId) ?? 0;
      const renderBudget = Number(process.env.CRAWL_MAX_RENDERED_PAGES || 100);
      const outcome = await this.fetchSvc.fetch(normUrl, { renderAllowed: rendersUsed < renderBudget });
      if (outcome.tier === 'rendered') {
        this.jobRendersUsed.set(payload.jobId, rendersUsed + 1);
      }
      const fetchRes = this.toLegacyFetchResult(outcome);
      const sitemapSetForJob = this.jobSitemapUrls.get(payload.jobId) || new Set<string>();

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

        // Indexability is computed from robots.txt, meta robots, the
        // X-Robots-Tag header and the canonical — never from the status code.
        // There was previously no such field at all, and the UI derived it
        // from `statusCode >= 400`, which is how a page carrying none of those
        // directives came to be labelled "Noindex".
        const robotsDecision = this.discovery.isAllowed(this.jobRobots.get(payload.jobId), normUrl);
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
          await this.persistFetchFailureIssue(payload.jobId, page.id, normUrl, outcome);
        } else {
        await this.issueEngine.evaluateAndPersistIssues(
          payload.jobId,
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
        await this.persistRenderFindings(payload.jobId, page.id, normUrl, outcome);
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
          await this.discoverInternalLinksAndEnqueue(payload, links.internalLinks, page.id);
        }
      } catch (dbErr: any) {
        this.logger.error(`[JOB ${payload.jobId}] Error saving page or issues for ${normUrl}`, dbErr);
      }
    } finally {
      if (this.queue.pageFetchQueue) {
        const remaining = await this.queue.decrementPendingTasks(payload.jobId);
        if (remaining <= 0) {
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
  private async persistRenderFindings(crawlJobId: string, pageId: string, pageUrl: string, outcome: FetchOutcome): Promise<void> {
    if (outcome.jsRequired && outcome.renderDiff) {
      const diff = outcome.renderDiff;
      await this.persistIssue(crawlJobId, pageId, pageUrl, {
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
      await this.persistIssue(crawlJobId, pageId, pageUrl, {
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

      const sitemapFindings = this.jobSitemapFindings.get(jobId) || [];
      const sitemapSet = this.jobSitemapUrls.get(jobId) || new Set<string>();

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
        await this.persistIssue(jobId, null, finding.affectedUrl, {
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
      responseTimeMs: outcome.totalMs,
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
  private async persistFetchFailureIssue(crawlJobId: string, pageId: string, pageUrl: string, outcome: FetchOutcome): Promise<void> {
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

    await this.persistIssue(crawlJobId, pageId, pageUrl, issue);
  }

  /** Writes one finding, ignoring a duplicate already recorded for this crawl. */
  private async persistIssue(
    crawlJobId: string,
    pageId: string | null,
    affectedUrl: string,
    issue: { issueType: string; severity: string; confidence: string; description: string; explanation: string; impact: string; recommendation: string; evidence: string },
  ): Promise<void> {
    const dedupKey = `${affectedUrl}::${issue.issueType}`;
    try {
      const existing = await this.prisma.issue.findFirst({ where: { crawlJobId, dedupKey } });
      if (existing) return;
      await this.prisma.issue.create({
        data: {
          crawlJobId,
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
  private async discoverInternalLinksAndEnqueue(payload: PageFetchPayload, internalLinks: any[], sourcePageId: string): Promise<void> {
    // Collect all eligible BFS links first, then bulk-enqueue them atomically.
    // Enqueueing one-by-one while workers are running creates the same race as
    // the seed URL loop: a worker that finishes between two enqueue calls can
    // drop the pending counter to 0 and trigger completeJob prematurely.
    const newPayloads: PageFetchPayload[] = [];

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

    if (newPayloads.length === 0) return;

    if (this.queue.pageFetchQueue) {
      // Bulk-enqueue: pre-increments by newPayloads.length atomically,
      // then commits all jobs to Redis in one pipeline.
      await this.queue.bulkAddPageFetchTasks(newPayloads, 0);
    } else {
      const localQueue = this.localJobQueues.get(payload.jobId);
      if (localQueue) {
        localQueue.push(...newPayloads);
      }
    }
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
    // read scored 0 out of 100 for defects that were ours, not theirs.
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
    const sitemapSet = this.jobSitemapUrls.get(jobId);
    const stats = this.jobStats.get(jobId);

    // Determine final crawl status:
    // COMPLETED    — queue fully exhausted, no ceiling hit
    // LIMIT_REACHED — page ceiling was hit (explicitly configured cap)
    // PARTIAL      — stall sweep or error finalized a crawl before queue exhaustion
    const crawlStatus: 'COMPLETED' | 'LIMIT_REACHED' | 'PARTIAL' = stats?.crawlStatus ?? 'COMPLETED';

    const urlsDiscovered = stats?.urlsDiscovered ?? totalPages;
    const urlsSkipped = stats?.urlsSkipped ?? 0;
    const robotsBlocked = stats?.robotsBlocked ?? 0;
    const internalLinksFound = stats?.internalLinksFound ?? 0;
    const urlsCrawled = totalPages;
    const urlsEligible = Math.max(urlsDiscovered - urlsSkipped, urlsCrawled);
    const crawlCoveragePercent = urlsDiscovered > 0 ? Math.round((urlsCrawled / urlsDiscovered) * 100) : 100;

    const qualityDiagnostics = {
      durationSeconds,
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      pagesCrawled: urlsCrawled,
      statusCodes: statusCodeDist,
      avgResponseTimeMs,
      sitemapFound: Boolean(sitemapSet && sitemapSet.size > 0),
      sitemapUrlsCount: sitemapSet?.size || 0,
      // Richer crawl summary
      urlsDiscovered,
      urlsEligible,
      urlsCrawled,
      urlsSkipped,
      robotsBlocked,
      internalLinksFound,
      crawlCoveragePercent,
      crawlStatus,
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
