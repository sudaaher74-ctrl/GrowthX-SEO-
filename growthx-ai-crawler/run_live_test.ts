import { PrismaClient } from '@prisma/client';
import { CrawlerService } from './src/modules/crawler/crawler.service';
import { RobotsService } from './src/modules/robots/robots.service';
import { SitemapService } from './src/modules/sitemap/sitemap.service';
import { QueueService } from './src/modules/queue/queue.service';
import { FetcherService } from './src/modules/crawler/fetcher.service';
import { HtmlExtractorService } from './src/modules/extractor/html-extractor.service';
import { ImageAnalyzerService } from './src/modules/analyzer/image-analyzer.service';
import { LinkAnalyzerService } from './src/modules/analyzer/link-analyzer.service';
import { SchemaValidatorService } from './src/modules/validator/schema-validator.service';
import { ContentAnalyzerService } from './src/modules/analyzer/content-analyzer.service';
import { IssueEngineService } from './src/modules/issues/issue-engine.service';
import { StorageService } from './src/storage/storage.service';
import { MetricsService } from './src/modules/observability/metrics.service';
import { CrawlerGateway } from './src/modules/socket/crawler.gateway';
import { PerformanceService } from './src/modules/performance/performance.service';
import { AeoAnalysisService } from './src/modules/ai-visibility/aeo-analysis/aeo-analysis.service';

async function main() {
  const prisma = new PrismaClient();
  let org = await prisma.organization.findFirst();
  if (!org) {
    org = await prisma.organization.create({
      data: { name: 'GrowthX Agency', slug: 'growthx-agency' },
    });
  }

  let project = await prisma.project.findFirst({ where: { organizationId: org.id } });
  if (!project) {
    project = await prisma.project.create({
      data: { name: 'sudarshan', organizationId: org.id },
    });
  }

  let website = await prisma.website.findUnique({ where: { domain: 'milquufresh.in' } });
  if (!website) {
    website = await prisma.website.create({
      data: {
        domain: 'milquufresh.in',
        url: 'https://milquufresh.in',
        isVerified: true,
        projectId: project.id,
      },
    });
  }

  console.log(`Registered Website ID: ${website.id} for domain milquufresh.in`);

  // Build dependency instances for execution
  const robots = new RobotsService();
  const sitemap = new SitemapService();
  const queue = new QueueService();
  const fetcher = new FetcherService();
  const storage = new StorageService();
  const htmlExtractor = new HtmlExtractorService();
  const imageAnalyzer = new ImageAnalyzerService();
  const linkAnalyzer = new LinkAnalyzerService();
  const schemaValidator = new SchemaValidatorService();
  const contentAnalyzer = new ContentAnalyzerService();
  const issueEngine = new IssueEngineService(prisma as any);
  const metrics = new MetricsService();
  const crawlerGateway = new CrawlerGateway();
  const performanceService = new PerformanceService(prisma as any);
  const aeoService = new AeoAnalysisService(prisma as any);

  const crawler = new CrawlerService(
    prisma as any,
    robots,
    sitemap,
    queue,
    fetcher,
    storage,
    htmlExtractor,
    imageAnalyzer,
    linkAnalyzer,
    schemaValidator,
    contentAnalyzer,
    issueEngine,
    metrics,
    crawlerGateway,
    performanceService,
    aeoService,
  );

  console.log(`Starting crawl for milquufresh.in...`);
  const jobId = await crawler.startCrawlJob(website.id, { maxDepth: 10, maxConcurrency: 5, useSitemap: true });
  console.log(`Job ID ${jobId} created. Running crawl...`);

  await crawler.processCrawlJob({
    jobId,
    websiteId: website.id,
    domain: 'milquufresh.in',
    startUrl: 'https://milquufresh.in',
    maxConcurrency: 5,
    maxDepth: 10,
    rateLimitDelayMs: 200,
    useSitemap: true,
  });

  const finalJob = await prisma.crawlJob.findUnique({ where: { id: jobId } });
  console.log(`Crawl completed! Status: ${finalJob?.status}, Pages: ${finalJob?.pagesCrawled}, Issues: ${finalJob?.issuesFound}`);

  await prisma.$disconnect();
}

main().catch(console.error);
