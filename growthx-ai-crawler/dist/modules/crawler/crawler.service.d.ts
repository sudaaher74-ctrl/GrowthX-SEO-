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
export declare class CrawlerService {
    private readonly prisma;
    private readonly storage;
    private readonly queue;
    private readonly robots;
    private readonly sitemap;
    private readonly fetcher;
    private readonly metrics;
    private readonly htmlExtractor;
    private readonly imageAnalyzer;
    private readonly linkAnalyzer;
    private readonly schemaValidator;
    private readonly contentAnalyzer;
    private readonly performanceService;
    private readonly issueEngine;
    private readonly graphService;
    private readonly crawlerGateway;
    private readonly logger;
    private readonly localVisited;
    private readonly jobSitemapUrls;
    constructor(prisma: PrismaService, storage: StorageService, queue: QueueService, robots: RobotsService, sitemap: SitemapService, fetcher: FetcherService, metrics: MetricsService, htmlExtractor: HtmlExtractorService, imageAnalyzer: ImageAnalyzerService, linkAnalyzer: LinkAnalyzerService, schemaValidator: SchemaValidatorService, contentAnalyzer: ContentAnalyzerService, performanceService: PerformanceService, issueEngine: IssueEngineService, graphService: GraphService, crawlerGateway: CrawlerGateway);
    /**
     * Initiates a new crawl job for a verified website
     */
    startCrawlJob(websiteId: string, options?: {
        maxConcurrency?: number;
        maxDepth?: number;
        useSitemap?: boolean;
    }): Promise<string>;
    private readonly localJobQueues;
    private readonly localJobActiveWorkers;
    /**
     * Main job processor: discovers seed URLs (Homepage + Sitemaps) and enqueues page fetch tasks
     */
    processCrawlJob(payload: CrawlJobPayload): Promise<void>;
    /**
     * Processes an individual page fetch task, executing the full SEO extraction & issue engine pipeline
     */
    processPageFetch(payload: PageFetchPayload): Promise<void>;
    /**
     * Enqueues discovered internal links for BFS crawling
     */
    private discoverInternalLinksAndEnqueue;
    private markUrlVisited;
    completeJob(jobId: string): Promise<void>;
    private normalizeUrl;
}
