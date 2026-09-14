/**
 * Runs a real crawl against a real site and prints what it found.
 *
 * Deliberately standalone: it exercises the actual pipeline - fetch tiers,
 * discovery, extraction, indexability, issue rules, summary - with no database
 * and no queue, so the crawler's own answers can be checked against a live URL
 * without standing up Postgres and Redis.
 *
 *   npx ts-node --compiler-options '{"module":"commonjs"}' scripts/audit-site.ts https://example.com/
 */
import { CrawlEngine, DEFAULT_CRAWL_LIMITS } from '../src/modules/crawler/crawl-engine';
import { FetchService } from '../src/modules/crawler/fetch/fetch.service';
import { BrowserPoolService } from '../src/modules/crawler/fetch/browser-pool.service';
import { DiscoveryService } from '../src/modules/crawler/discovery/discovery.service';

async function main() {
  const startUrl = process.argv[2];
  if (!startUrl) {
    console.error('Usage: audit-site.ts <url>');
    process.exit(1);
  }

  const pool = new BrowserPoolService();
  const engine = new CrawlEngine(new FetchService(pool), new DiscoveryService(), {
    ...DEFAULT_CRAWL_LIMITS,
    maxPages: Number(process.env.CRAWL_MAX_PAGES || 25),
    concurrency: Number(process.env.CRAWL_CONCURRENCY || 3),
  });

  const report = await engine.crawl(startUrl);

  console.log(`\n=== AUDIT: ${startUrl} ===\n`);
  console.log(`Pages crawled        ${report.summary.pagesCrawled}`);
  console.log(`  successful         ${report.summary.successful}`);
  console.log(`  errored            ${report.summary.errored}`);
  console.log(`  blocked (suspect)  ${report.summary.blocked}`);
  console.log(`  unreachable        ${report.summary.unreachable}`);
  console.log(`Indexable            ${report.summary.indexable} (${report.summary.indexablePercent}%)`);
  console.log(`  not indexable      ${report.summary.nonIndexable}`);
  console.log(`  unknown            ${report.summary.indexabilityUnknown}`);
  console.log(`JS required          ${report.summary.jsRequiredPages}`);
  console.log(`Core Web Vitals      ${report.summary.coreWebVitals.status}`);
  console.log(`Health score         ${report.summary.health.score}/100  (${report.summary.health.note})`);
  console.log(`Discovery sources    ${JSON.stringify(report.summary.bySource)}`);
  console.log(`Stopped because      ${report.stoppedBecause}`);

  console.log('\n--- PAGES ---');
  for (const page of report.pages) {
    console.log(
      [
        String(page.statusCode ?? 'ERR').padEnd(4),
        page.indexability.indexability.padEnd(14),
        (page.jsRequired ? 'JS' : '--').padEnd(3),
        page.discoverySource.padEnd(8),
        (String(page.extracted?.wordCount ?? 0) + '/' + String(page.extracted?.bodyWordCount ?? 0)).padStart(9) + 'w',
        new URL(page.url).pathname.padEnd(20),
        JSON.stringify((page.extracted?.title || '').slice(0, 60)),
      ].join('  '),
    );
  }

  console.log('\n--- FINDINGS ---');
  if (report.findings.length === 0) console.log('(none)');
  for (const finding of report.findings) {
    console.log(`\n[${finding.severity}/${finding.confidence}] ${finding.id} - ${finding.affectedUrl}`);
    console.log(`  ${finding.description}`);
    console.log(`  evidence (${finding.sourceField}): ${finding.evidence}`);
  }

  await pool.onModuleDestroy();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
