"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var CrawlerService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CrawlerService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../database/prisma.service");
const storage_service_1 = require("../../storage/storage.service");
const queue_service_1 = require("../queue/queue.service");
const robots_service_1 = require("../robots/robots.service");
const sitemap_service_1 = require("../sitemap/sitemap.service");
const fetcher_service_1 = require("./fetcher.service");
const metrics_service_1 = require("../observability/metrics.service");
const html_extractor_service_1 = require("../extractor/html-extractor.service");
const image_analyzer_service_1 = require("../analyzer/image-analyzer.service");
const link_analyzer_service_1 = require("../analyzer/link-analyzer.service");
const schema_validator_service_1 = require("../analyzer/schema-validator.service");
const content_analyzer_service_1 = require("../analyzer/content-analyzer.service");
const performance_service_1 = require("../performance/performance.service");
const issue_engine_service_1 = require("../issues/issue-engine.service");
const graph_service_1 = require("../graph/graph.service");
const crawler_gateway_1 = require("../socket/crawler.gateway");
const url = require("url");
let CrawlerService = CrawlerService_1 = class CrawlerService {
    constructor(prisma, storage, queue, robots, sitemap, fetcher, metrics, htmlExtractor, imageAnalyzer, linkAnalyzer, schemaValidator, contentAnalyzer, performanceService, issueEngine, graphService, crawlerGateway) {
        this.prisma = prisma;
        this.storage = storage;
        this.queue = queue;
        this.robots = robots;
        this.sitemap = sitemap;
        this.fetcher = fetcher;
        this.metrics = metrics;
        this.htmlExtractor = htmlExtractor;
        this.imageAnalyzer = imageAnalyzer;
        this.linkAnalyzer = linkAnalyzer;
        this.schemaValidator = schemaValidator;
        this.contentAnalyzer = contentAnalyzer;
        this.performanceService = performanceService;
        this.issueEngine = issueEngine;
        this.graphService = graphService;
        this.crawlerGateway = crawlerGateway;
        this.logger = new common_1.Logger(CrawlerService_1.name);
        this.localVisited = new Map();
        this.jobSitemapUrls = new Map();
        // Local fallback queue mechanism
        this.localJobQueues = new Map();
        this.localJobActiveWorkers = new Map();
    }
    /**
     * Initiates a new crawl job for a verified website
     */
    async startCrawlJob(websiteId, options = {}) {
        const website = await this.prisma.website.findUnique({ where: { id: websiteId } });
        if (!website) {
            throw new common_1.NotFoundException(`Website with ID ${websiteId} not found`);
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
        const payload = {
            jobId: job.id,
            websiteId: website.id,
            domain: website.domain,
            startUrl: website.url,
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
    /**
     * Main job processor: discovers seed URLs (Homepage + Sitemaps) and enqueues page fetch tasks
     */
    async processCrawlJob(payload) {
        this.logger.log(`[JOB ${payload.jobId}] Starting crawl for domain: ${payload.domain}`);
        await this.prisma.crawlJob.update({ where: { id: payload.jobId }, data: { status: 'RUNNING' } });
        this.metrics.activeCrawlJobs.inc();
        const seedUrls = new Set();
        const sitemapSet = new Set();
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
            }
            catch (err) {
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
            const queue = [];
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
                    const active = this.localJobActiveWorkers.get(payload.jobId) || 0;
                    const currentQueue = this.localJobQueues.get(payload.jobId) || [];
                    if (currentQueue.length === 0) {
                        if (active === 0)
                            break; // All done
                        await new Promise(r => setTimeout(r, 500)); // Wait for other workers to potentially push links
                        continue;
                    }
                    const task = currentQueue.shift();
                    if (!task)
                        continue;
                    this.localJobActiveWorkers.set(payload.jobId, active + 1);
                    await this.processPageFetch(task);
                    this.localJobActiveWorkers.set(payload.jobId, (this.localJobActiveWorkers.get(payload.jobId) || 1) - 1);
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
    async processPageFetch(payload) {
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
        let snapshotUrl;
        if (fetchRes.html) {
            snapshotUrl = await this.storage.saveSnapshot(payload.jobId, Buffer.from(normUrl).toString('base64').substring(0, 16), fetchRes.html);
        }
        try {
            // 1. Run Analysis Pipeline if HTML 200 OK
            let htmlData = this.htmlExtractor.extract('', normUrl);
            let images = [];
            let links = { internalLinks: [], externalLinks: [], brokenAnchors: [], nofollowLinks: [], internalCount: 0, externalCount: 0, totalCount: 0 };
            let schemas = [];
            let content = { wordCount: 0, readingTimeMin: 0, contentHash: '', simHash: '', headingStructureErrors: [], imageCount: 0, internalLinkDensity: 0, externalLinkDensity: 0 };
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
                }).catch(() => { });
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
                }).catch(() => { });
            }
            // 4. Run Issue Engine
            const sitemapSet = this.jobSitemapUrls.get(payload.jobId) || new Set();
            const inSitemap = sitemapSet.has(normUrl);
            await this.issueEngine.evaluateAndPersistIssues(payload.jobId, page.id, normUrl, fetchRes.statusCode, fetchRes.redirectChain || [normUrl], fetchRes.html || '', htmlData, images, links, content, schemas, inSitemap, true);
            // 5. Asynchronously trigger Core Web Vitals for Homepage or depth 0 pages
            if (payload.depth === 0 && fetchRes.statusCode === 200) {
                this.performanceService.fetchPageSpeedMetrics(page.id, normUrl).catch(() => { });
            }
            // 6. Enqueue internal links for BFS crawling
            if (fetchRes.statusCode === 200 && fetchRes.html) {
                await this.discoverInternalLinksAndEnqueue(payload, links.internalLinks, page.id);
            }
        }
        catch (dbErr) {
            this.logger.error(`[JOB ${payload.jobId}] Error saving page or issues for ${normUrl}`, dbErr);
        }
    }
    /**
     * Enqueues discovered internal links for BFS crawling
     */
    async discoverInternalLinksAndEnqueue(payload, internalLinks, sourcePageId) {
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
            }).catch(() => { });
            if (payload.depth + 1 <= payload.maxDepth) {
                const newPayload = {
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
                    this.queue.addPageFetchTask(newPayload, 0);
                }
                else {
                    const localQueue = this.localJobQueues.get(payload.jobId);
                    if (localQueue) {
                        localQueue.push(newPayload);
                    }
                }
            }
        }
    }
    async markUrlVisited(jobId, targetUrl) {
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
            visitedSet = new Set();
            this.localVisited.set(jobId, visitedSet);
        }
        if (visitedSet.has(targetUrl))
            return true;
        visitedSet.add(targetUrl);
        return false;
    }
    async completeJob(jobId) {
        this.logger.log(`[JOB ${jobId}] Crawl job finished. Running final Graph Link Equity & Orphan analysis...`);
        try {
            await this.graphService.generateGraphReport(jobId);
        }
        catch (graphErr) {
            this.logger.error(`[JOB ${jobId}] Graph analysis error`, graphErr);
        }
        await this.prisma.crawlJob.update({
            where: { id: jobId },
            data: { status: 'COMPLETED', finishedAt: new Date() },
        });
        this.metrics.activeCrawlJobs.dec();
        this.localVisited.delete(jobId);
        this.jobSitemapUrls.delete(jobId);
    }
    normalizeUrl(rawUrl) {
        try {
            const parsed = url.parse(rawUrl);
            parsed.hash = null;
            let pathname = parsed.pathname || '/';
            if (pathname !== '/' && pathname.endsWith('/')) {
                pathname = pathname.slice(0, -1);
            }
            parsed.pathname = pathname;
            return url.format(parsed);
        }
        catch (e) {
            return rawUrl;
        }
    }
};
exports.CrawlerService = CrawlerService;
exports.CrawlerService = CrawlerService = CrawlerService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        storage_service_1.StorageService,
        queue_service_1.QueueService,
        robots_service_1.RobotsService,
        sitemap_service_1.SitemapService,
        fetcher_service_1.FetcherService,
        metrics_service_1.MetricsService,
        html_extractor_service_1.HtmlExtractorService,
        image_analyzer_service_1.ImageAnalyzerService,
        link_analyzer_service_1.LinkAnalyzerService,
        schema_validator_service_1.SchemaValidatorService,
        content_analyzer_service_1.ContentAnalyzerService,
        performance_service_1.PerformanceService,
        issue_engine_service_1.IssueEngineService,
        graph_service_1.GraphService,
        crawler_gateway_1.CrawlerGateway])
], CrawlerService);
//# sourceMappingURL=crawler.service.js.map