/**
 * A real crawl through the production path, checked for whether its books balance.
 *
 * `crawl-reconciliation.ts` next to this one runs discovery and extraction with
 * no database, which is enough to check the parsing but not the accounting: the
 * URL inventory, the queue hand-off and the completion metrics only exist when
 * Postgres and Redis do. This boots the real Nest app and calls the same
 * `processCrawlJob` that runs in production, then asserts that the numbers it
 * publishes agree with the rows underneath them.
 *
 * That agreement is the whole point. The defect this guards against was a
 * dashboard reporting "32 of 32, 100%" for a crawl that had found more URLs
 * than it fetched — figures that looked plausible and could not be checked
 * against anything.
 *
 * Needs a database and a Redis, and leaves its fixtures behind under the
 * organization slug below so a failed run can be inspected:
 *
 *   DATABASE_URL=... DIRECT_URL=... REDIS_URL=... ENCRYPTION_KEY=$(openssl rand -hex 32) \
 *     npx ts-node --transpile-only scripts/crawl-e2e-reconciliation.ts https://example.com
 *
 * Set PLAYWRIGHT_EXECUTABLE_PATH when Chromium is not where Playwright expects
 * it; without a browser the run still works, and the JavaScript-DOM source
 * correctly reports nothing rather than zero.
 *
 * Two things to know before running it. Booting the full application starts the
 * rest of the app with it, which can set its own crawls going against third
 * party sites — so point it at a disposable database and do not leave it
 * running. And a transient failure fetching the sitemap reduces the crawl to
 * the start URL alone; the assertions below catch that and fail rather than
 * reporting a green run that tested nothing.
 */
import { NestFactory } from '@nestjs/core';
import { PrismaClient } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { CrawlerService } from '../src/modules/crawler/crawler.service';
import { UrlInventoryService } from '../src/modules/crawler/inventory/url-inventory.service';

const prisma = new PrismaClient();
const START = process.argv[2] || 'https://milquufresh.in';
const PAGE_LIMIT = Number(process.env.E2E_PAGE_LIMIT || 40);
const SETTLE_TIMEOUT_MS = Number(process.env.E2E_SETTLE_TIMEOUT_MS || 10 * 60 * 1000);

/** A fixture id per host, so repeat runs against one site reuse their project. */
const host = new URL(START).hostname;
const slug = `e2e-${host.replace(/[^a-z0-9]+/gi, '-')}`;

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const crawler = app.get(CrawlerService);
  const inventory = app.get(UrlInventoryService);

  await prisma.organization.upsert({ where: { id: slug }, create: { id: slug, name: slug, slug }, update: {} });
  await prisma.project.upsert({ where: { id: slug }, create: { id: slug, name: slug, organizationId: slug }, update: {} });
  await prisma.website.upsert({
    where: { id: slug },
    create: { id: slug, domain: host, url: START, projectId: slug },
    update: {},
  });

  const job = await prisma.crawlJob.create({ data: { websiteId: slug, status: 'PENDING' } });
  console.log(`crawling ${START} as job ${job.id}\n`);

  await crawler.processCrawlJob({
    jobId: job.id,
    websiteId: slug,
    domain: host,
    startUrl: START,
    maxDepth: Number(process.env.E2E_MAX_DEPTH || 3),
    useSitemap: true,
    pageLimit: PAGE_LIMIT,
    maxConcurrency: Number(process.env.DEFAULT_CRAWL_CONCURRENCY || 3),
  } as never);

  // processCrawlJob hands work to the queue and returns; the crawl settles
  // afterwards. Measuring here rather than polling would read a crawl in
  // progress and call it a result.
  let finished = await prisma.crawlJob.findUnique({ where: { id: job.id } });
  const deadline = Date.now() + SETTLE_TIMEOUT_MS;
  while (finished && finished.status !== 'COMPLETED' && finished.status !== 'FAILED' && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 3000));
    finished = await prisma.crawlJob.findUnique({ where: { id: job.id } });
  }

  const metrics = await inventory.metrics(job.id);
  const pageRows = await prisma.page.count({ where: { crawlJobId: job.id } });
  const diagnostics = (finished?.qualityDiagnostics ?? {}) as Record<string, never> & {
    urlsDiscovered?: number;
    crawlCoveragePercent?: number | null;
    summary?: { bySource?: Record<string, number>; coveragePercent?: number | null; notCrawled?: number; javascriptDomScanned?: boolean };
  };

  console.log(`===== ${START} — END TO END =====`);
  console.log(`settled as            ${finished?.status}`);
  console.log(`Page rows             ${pageRows}`);
  console.log(`job.pagesCrawled      ${finished?.pagesCrawled}`);
  console.log(`job.pagesDiscovered   ${finished?.pagesDiscovered}`);
  console.log(`\n---- inventory rows ----`);
  console.log(`discovered            ${metrics.urlsDiscovered}`);
  console.log(`queued                ${metrics.urlsQueued}`);
  console.log(`crawled               ${metrics.urlsCrawled}`);
  console.log(`not crawled           ${metrics.notCrawled}`);
  console.log(`by source (unique)    ${JSON.stringify(metrics.bySource)}`);
  console.log(`multi-source URLs     ${metrics.multiSourceUrls}`);
  console.log(`not-crawled reasons   ${JSON.stringify(metrics.notCrawledReasons)}`);
  console.log(`rendered              ${metrics.renderedPages}`);
  console.log(`indexable / non       ${metrics.indexable} / ${metrics.nonIndexable}`);
  console.log(`status buckets        ${JSON.stringify(metrics.statusBuckets)}`);
  console.log(`\n---- what the dashboard reads ----`);
  console.log(`urlsDiscovered        ${diagnostics.urlsDiscovered}`);
  console.log(`crawlCoveragePercent  ${diagnostics.crawlCoveragePercent}`);
  console.log(`summary.bySource      ${JSON.stringify(diagnostics.summary?.bySource)}`);
  console.log(`summary.coveragePct   ${diagnostics.summary?.coveragePercent}`);
  console.log(`summary.notCrawled    ${diagnostics.summary?.notCrawled}`);
  console.log(`summary.jsDomScanned  ${diagnostics.summary?.javascriptDomScanned}`);

  const reasonTotal = Object.values(metrics.notCrawledReasons).reduce((a, b) => a + b, 0);
  const published = diagnostics.summary?.bySource || {};

  // A crawl that reached one page satisfies every balance check below without
  // testing any of them: 1 === 1 + 0, one source, nothing excluded. Silence is
  // not success, so a degenerate run fails here rather than reporting green.
  //
  // The usual cause is the sitemap being unreachable — one ECONNRESET on the
  // sitemap fetch drops this site from 29 seed URLs to the homepage alone, and
  // the crawler is right to carry on from it. The run still proves nothing.
  const sitemapUrls = Number((diagnostics as { sitemapUrlsCount?: number }).sitemapUrlsCount ?? 0);
  const degenerate = metrics.urlsDiscovered <= 1;

  const checks: Array<[string, boolean]> = [
    ['crawl was not degenerate (more than the start URL was discovered)', !degenerate],
    ['sitemap contributed seeds, so discovery was actually exercised', sitemapUrls > 0 || metrics.bySource.sitemap > 0],
    ['crawl settled rather than timing out', finished?.status === 'COMPLETED' || finished?.status === 'FAILED'],
    ['inventory balances: crawled + notCrawled === discovered', metrics.urlsCrawled + metrics.notCrawled === metrics.urlsDiscovered],
    ['every uncrawled URL carries a reason', reasonTotal === metrics.notCrawled],
    ['no source claims more URLs than exist', Object.values(metrics.bySource).every((v) => v <= metrics.urlsDiscovered)],
    // The double-count that published a 29-URL sitemap as 58.
    ['published source counts are not inflated', Object.values(published).every((v) => v <= metrics.urlsDiscovered)],
    ['published sitemap count matches the inventory', (published.sitemap ?? metrics.bySource.sitemap ?? 0) === (metrics.bySource.sitemap ?? 0)],
    // The denominator that could only ever equal the numerator.
    ['discovered is not clamped down to the crawled count', (diagnostics.urlsDiscovered ?? 0) >= metrics.urlsCrawled],
    ['coverage is a real fraction or null, never a default', diagnostics.summary?.coveragePercent === null || (typeof diagnostics.summary?.coveragePercent === 'number' && diagnostics.summary.coveragePercent <= 100)],
  ];

  console.log(`\n===== ASSERTIONS =====`);
  let ok = true;
  for (const [label, passed] of checks) {
    console.log(`${passed ? 'PASS' : 'FAIL'}  ${label}`);
    if (!passed) ok = false;
  }

  if (degenerate) {
    console.log(
      `\nThis run reached ${metrics.urlsDiscovered} URL(s) and proves nothing about the accounting. ` +
        `Check the log for a sitemap that could not be fetched, and run it again.`,
    );
  }

  await app.close();
  await prisma.$disconnect();
  process.exit(ok ? 0 : 1);
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
