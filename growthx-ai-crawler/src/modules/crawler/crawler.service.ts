import { Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { StorageService } from '../../storage/storage.service';
import { QueueService, CrawlJobPayload, PageFetchPayload } from '../queue/queue.service';
import { RobotsService } from '../robots/robots.service';
import { SitemapService } from '../sitemap/sitemap.service';
import { FetcherService } from './fetcher.service';
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
import * as url from 'url';

@Injectable()
export class CrawlerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CrawlerService.name);
  private readonly localVisited = new Map<string, Set<string>>();
  private readonly jobSitemapUrls = new Map<string, Set<string>>();

  /**
   * How long a job may go without recording a page before it is treated as
   * abandoned. Comfortably longer than a slow page fetch plus its retries, so a
   * crawl that is merely slow is never cut short.
   */
  private static readonly STALL_TIMEOUT_MS = 5 * 60 * 1000;
  private static readonly STALL_SWEEP_INTERVAL_MS = 2 * 60 * 1000;
  private stallSweep?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly queue: QueueService,
    private readonly robots: RobotsService,
    private readonly sitemap: SitemapService,
    private readonly fetcher: FetcherService,
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
            await this.prisma.crawlJob.update({
              where: { id: job.id },
              data: { status: 'FAILED', finishedAt: new Date() },
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

  async startCrawlJob(websiteId: string, options: { maxConcurrency?: number; maxDepth?: number; useSitemap?: boolean } = {}): Promise<string> {
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
      rateLimitDelayMs: website.rateLimitDelayMs || 500,
      useSitemap: options.useSitemap !== false,
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

    const seedUrls = new Set<string>();
    const sitemapSet = new Set<string>();
    seedUrls.add(this.normalizeUrl(payload.startUrl));

    const robotsRules = await this.robots.fetchRobotsRules(payload.domain);
    const delayMs = robotsRules.crawlDelayMs || payload.rateLimitDelayMs || 500;

    if (payload.useSitemap) {
      try {
        const sitemapResult = await this.sitemap.discoverAndParseSitemaps(payload.domain, robotsRules.sitemapLocations);
        for (const entry of sitemapResult.urls) {
          if (entry.loc) {
            const normLoc = this.normalizeUrl(entry.loc);
            seedUrls.add(normLoc);
            sitemapSet.add(normLoc);
          }
        }
      } catch (err) {
        this.logger.warn(`[JOB ${payload.jobId}] Sitemap discovery failed or incomplete`, err);
      }
    }

    this.jobSitemapUrls.set(payload.jobId, sitemapSet);

    // If Redis is active, dispatch to BullMQ
    if (this.queue.pageFetchQueue) {
      this.logger.log(`[JOB ${payload.jobId}] Enqueuing ${seedUrls.size} seed URLs to Redis...`);
      for (const targetUrl of seedUrls) {
        await this.queue.addPageFetchTask({
          jobId: payload.jobId,
          websiteId: payload.websiteId,
          domain: payload.domain,
          targetUrl,
          depth: 0,
          maxDepth: payload.maxDepth,
          rateLimitDelayMs: delayMs,
        }, 0);
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
        });
      }

      const maxConcurrency = payload.maxConcurrency || 10;
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
  async processPageFetch(payload: PageFetchPayload): Promise<void> {
    try {
      const normUrl = this.normalizeUrl(payload.targetUrl);

      const isVisited = await this.markUrlVisited(payload.jobId, normUrl);
      if (isVisited) {
        return;
      }

      if (payload.depth > payload.maxDepth) {
        return;
      }

      const allowed = await this.robots.isUrlAllowed(normUrl);
      if (!allowed) {
        return;
      }

      this.logger.log(`[JOB ${payload.jobId}] [Depth ${payload.depth}] Fetching & Analyzing: ${normUrl}`);
      const fetchRes = await this.fetcher.fetchPage(normUrl);

      let snapshotUrl: string | undefined;
      if (fetchRes.html) {
        snapshotUrl = await this.storage.saveSnapshot(payload.jobId, Buffer.from(normUrl).toString('base64').substring(0, 16), fetchRes.html);
      }

      try {
        // 1. Run Analysis Pipeline if HTML 200 OK
        let htmlData = this.htmlExtractor.extract('', normUrl);
        let images = [] as any[];
        let links: any = { internalLinks: [], externalLinks: [], brokenAnchors: [], nofollowLinks: [], internalCount: 0, externalCount: 0, totalCount: 0 };
        let schemas = [] as any[];
        let content: any = { wordCount: 0, readingTimeMin: 0, contentHash: '', simHash: '', headingStructureErrors: [], imageCount: 0, internalLinkDensity: 0, externalLinkDensity: 0 };

        if (fetchRes.statusCode === 200 && fetchRes.html && (fetchRes.contentType?.includes('html') || !fetchRes.contentType)) {
          htmlData = this.htmlExtractor.extract(fetchRes.html, normUrl);
          images = this.imageAnalyzer.analyzeImages(fetchRes.html, normUrl);
          links = this.linkAnalyzer.analyzeLinks(fetchRes.html, normUrl);
          schemas = this.schemaValidator.validateSchemas(htmlData.jsonLd);
          content = this.contentAnalyzer.analyzeContent(fetchRes.html, htmlData.h1, htmlData.h2, htmlData.h3, images.length, links.internalCount, links.externalCount);
        }

        // 2. Upsert Page with full metrics
        const page = await this.prisma.page.upsert({
          where: { crawlJobId_url: { crawlJobId: payload.jobId, url: normUrl } },
          update: {
            finalUrl: fetchRes.finalUrl,
            statusCode: fetchRes.statusCode,
            responseTimeMs: fetchRes.responseTimeMs,
            contentType: fetchRes.contentType,
            htmlSnapshotUrl: snapshotUrl,
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
            finalUrl: fetchRes.finalUrl,
            statusCode: fetchRes.statusCode,
            responseTimeMs: fetchRes.responseTimeMs,
            contentType: fetchRes.contentType,
            htmlSnapshotUrl: snapshotUrl,
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

        // 4. Run Issue Engine
        const sitemapSet = this.jobSitemapUrls.get(payload.jobId) || new Set<string>();
        const inSitemap = sitemapSet.has(normUrl);

        await this.issueEngine.evaluateAndPersistIssues(
          payload.jobId,
          page.id,
          normUrl,
          fetchRes.statusCode,
          fetchRes.redirectChain || [normUrl],
          fetchRes.html || '',
          htmlData,
          images,
          links,
          content,
          schemas,
          inSitemap,
          true
        );

        // 5. Asynchronously trigger Core Web Vitals for Homepage or depth 0 pages
        if (payload.depth === 0 && fetchRes.statusCode === 200) {
          this.performanceService.fetchPageSpeedMetrics(page.id, normUrl).catch(() => {});
        }

        // 6. Enqueue internal links for BFS crawling
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
   * Enqueues discovered internal links for BFS crawling
   */
  private async discoverInternalLinksAndEnqueue(payload: PageFetchPayload, internalLinks: any[], sourcePageId: string): Promise<void> {
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

      if (payload.depth + 1 <= payload.maxDepth) {
        const newPayload: PageFetchPayload = {
          jobId: payload.jobId,
          websiteId: payload.websiteId,
          domain: payload.domain,
          targetUrl: targetClean,
          sourceUrl: payload.targetUrl,
          depth: payload.depth + 1,
          maxDepth: payload.maxDepth,
          rateLimitDelayMs: payload.rateLimitDelayMs,
        };
        
        if (this.queue.pageFetchQueue) {
          await this.queue.addPageFetchTask(newPayload, 0);
        } else {
          const localQueue = this.localJobQueues.get(payload.jobId);
          if (localQueue) {
            localQueue.push(newPayload);
          }
        }
      }
    }
  }

  private async markUrlVisited(jobId: string, targetUrl: string): Promise<boolean> {
    const redisClient = this.queue.getRedisClient();
    const key = `job:${jobId}:visited`;

    if (redisClient) {
      const added = await redisClient.sadd(key, targetUrl);
      if (added === 1) {
        await redisClient.expire(key, 86400);
        return false;
      }
      return true;
    }

    let visitedSet = this.localVisited.get(jobId);
    if (!visitedSet) {
      visitedSet = new Set<string>();
      this.localVisited.set(jobId, visitedSet);
    }
    if (visitedSet.has(targetUrl)) return true;
    visitedSet.add(targetUrl);
    return false;
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

    const finished = await this.prisma.crawlJob.update({
      where: { id: jobId },
      data: { status: 'COMPLETED', finishedAt: new Date() },
      include: { website: { select: { project: { select: { organizationId: true } } } } },
    });

    // Bill crawled pages against the plan allowance only now that the job has
    // actually finished, so an aborted or failed crawl costs the customer nothing.
    const organizationId = finished.website.project?.organizationId;
    if (organizationId && finished.pagesCrawled > 0) {
      try {
      } catch (usageErr) {
        this.logger.error(`[JOB ${jobId}] Failed to record crawl usage`, usageErr);
      }
    }

    this.metrics.activeCrawlJobs.dec();
    this.localVisited.delete(jobId);
    this.jobSitemapUrls.delete(jobId);
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
