/**
 * A crawl reconciliation against a live site, without a database.
 *
 * Runs the real DiscoveryService, the real normalizer and the real link
 * extractor over a site, fetches what it finds, and prints the books: how many
 * URLs each source named, how many unique URLs that is, how many were fetched,
 * and — for every URL that was not — the reason. The totals are asserted to
 * balance rather than merely printed, because the defect this exists to catch
 * is precisely a set of figures that look plausible and do not add up.
 *
 *   npx ts-node scripts/crawl-reconciliation.ts https://milquufresh.in
 */
import axios from 'axios';
import { DiscoveryService } from '../src/modules/crawler/discovery/discovery.service';
import { normalizeUrl } from '../src/modules/crawler/url/url-normalizer';
import { sameRegistrableDomain } from '../src/modules/crawler/url/registrable-domain';
import { summariseInventory, InventoryRow } from '../src/modules/crawler/inventory/url-inventory.service';
import { isAllowedByRobots, ParsedRobots } from '../src/modules/crawler/discovery/robots-txt';

const startUrl = process.argv[2] || 'https://milquufresh.in';
const MAX_FETCHES = Number(process.env.RECON_MAX_FETCHES || 200);
const UA = 'GrowthXBot/1.0 (+reconciliation)';

/** The inventory, in memory: one entry per unique normalized URL. */
const inventory = new Map<string, InventoryRow>();
/** Raw discovery events per source, which are not URL counts. */
const events: Record<string, number> = {};

function record(url: string, source: string, sourceUrl?: string): string | null {
  events[source] = (events[source] || 0) + 1;
  const normalized = normalizeUrl(url);
  if (!normalized) return null;

  const existing = inventory.get(normalized);
  if (existing) {
    // One URL, however many sources found it.
    if (!existing.sources.includes(source)) existing.sources.push(source);
    return normalized;
  }
  inventory.set(normalized, {
    normalizedUrl: normalized,
    url: normalized,
    state: 'PENDING',
    reason: 'queued',
    sources: [source],
    discoverySource: source,
    httpStatus: null,
    indexability: null,
    canonicalUrl: null,
    redirectTarget: null,
    rendered: false,
    queuedAt: null,
    crawledAt: null,
  });
  return normalized;
}

async function main() {
  const discovery = new DiscoveryService();
  console.log(`Reconciling ${startUrl}\n${'='.repeat(70)}`);

  const seeds = await discovery.discoverSeeds(startUrl);
  const robots = seeds.robots as ParsedRobots | undefined;

  console.log(`robots.txt:            ${seeds.robotsFetched ? 'read' : 'NOT READ'}`);
  console.log(`Sitemaps declared:     ${(robots?.sitemaps || []).length}`);
  console.log(`Sitemaps fetched:      ${seeds.sitemapsFetched.length}`);
  console.log(`Sitemap <loc> entries: ${seeds.sitemapEntries.length}`);
  console.log(`Sitemap findings:      ${seeds.findings.length}`);
  for (const finding of seeds.findings) console.log(`  - ${finding.kind}: ${finding.evidence.slice(0, 140)}`);

  for (const found of seeds.urls) record(found.url, found.source === 'seed' ? 'seed' : found.source, found.foundIn);

  const sitemapUnique = [...inventory.values()].filter((r) => r.sources.includes('sitemap')).length;
  console.log(`\nSitemap URLs (raw):    ${events.sitemap || 0}`);
  console.log(`Sitemap URLs (unique): ${sitemapUnique}`);
  console.log(`Unique after seeding:  ${inventory.size}`);

  // Robots exclusions are decided before any fetch and stay in the inventory.
  for (const row of inventory.values()) {
    if (!robots) continue;
    const verdict = isAllowedByRobots(robots, 'GrowthXBot', row.normalizedUrl);
    if (!verdict.allowed) {
      row.state = 'SKIPPED';
      row.reason = 'robots_blocked';
    }
  }

  // Breadth-first over whatever is still eligible.
  const queue = [...inventory.keys()].filter((k) => inventory.get(k)!.state === 'PENDING');
  let fetched = 0;

  while (queue.length > 0) {
    const normalized = queue.shift()!;
    const row = inventory.get(normalized)!;
    if (row.state !== 'PENDING') continue;

    if (fetched >= MAX_FETCHES) {
      row.reason = 'crawl_budget_exceeded';
      row.state = 'SKIPPED';
      continue;
    }

    row.queuedAt = new Date();
    fetched++;

    try {
      const response = await axios.get(normalized, {
        headers: { 'User-Agent': UA, Accept: 'text/html,*/*;q=0.8' },
        timeout: 20000,
        validateStatus: () => true,
        maxRedirects: 0,
        responseType: 'text',
        transitional: { silentJSONParsing: false, forcedJSONParsing: false, clarifyTimeoutError: true },
      });

      row.state = 'DONE';
      row.crawledAt = new Date();
      row.httpStatus = response.status;
      row.reason = null;
      const contentType = String(response.headers['content-type'] || '');

      if (response.status >= 300 && response.status < 400) {
        // A redirect is a result. Both URLs stay in the inventory.
        const location = response.headers.location;
        if (location) {
          const target = normalizeUrl(location, { base: normalized });
          row.redirectTarget = target || null;
          if (target && sameRegistrableDomain(target, startUrl)) {
            const added = record(target, 'redirect', normalized);
            if (added && inventory.get(added)!.state === 'PENDING') queue.push(added);
          }
        }
        row.indexability = 'NOT_INDEXABLE';
        continue;
      }

      if (!/html/i.test(contentType)) {
        row.state = 'SKIPPED';
        row.reason = 'unsupported_content_type';
        continue;
      }

      const html = String(response.data || '');

      // Indexability is decided per URL, never from the status code alone.
      const metaRobots = /<meta[^>]+name=["']robots["'][^>]+content=["']([^"']+)["']/i.exec(html)?.[1] || '';
      const xRobots = String(response.headers['x-robots-tag'] || '');
      const canonical = /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i.exec(html)?.[1];
      if (canonical) row.canonicalUrl = normalizeUrl(canonical, { base: normalized }) || null;
      row.indexability =
        response.status === 200 && !/noindex/i.test(`${metaRobots} ${xRobots}`) ? 'INDEXABLE' : 'NOT_INDEXABLE';

      // A canonical pointing elsewhere is recorded; it never removes this URL.
      if (row.canonicalUrl && row.canonicalUrl !== normalized && sameRegistrableDomain(row.canonicalUrl, startUrl)) {
        const added = record(row.canonicalUrl, 'canonical', normalized);
        if (added && inventory.get(added)!.state === 'PENDING') queue.push(added);
      }

      for (const link of discovery.extractLinks(html, normalized, 'internal_links')) {
        if (!sameRegistrableDomain(link.normalizedUrl, startUrl)) continue;
        const added = record(link.url, 'internal_link', normalized);
        if (!added) continue;
        const target = inventory.get(added)!;
        if (robots && !isAllowedByRobots(robots, 'GrowthXBot', added).allowed) {
          target.state = 'SKIPPED';
          target.reason = 'robots_blocked';
          continue;
        }
        if (target.state === 'PENDING' && !queue.includes(added)) queue.push(added);
      }
    } catch (err) {
      const message = (err as Error).message || '';
      row.state = 'FAILED';
      row.reason = /timeout/i.test(message) ? 'timeout' : 'fetch_failed';
      row.httpStatus = 0;
    }
  }

  const m = summariseInventory([...inventory.values()]);

  console.log(`\n${'='.repeat(70)}\nRECONCILIATION\n${'='.repeat(70)}`);
  console.log(`Sitemap URLs:              ${events.sitemap || 0}`);
  console.log(`Unique sitemap URLs:       ${m.bySource.sitemap || 0}`);
  console.log(`Internal-link URLs:        ${m.bySource.internal_link || 0}   (from ${events.internal_link || 0} link events)`);
  console.log(`JS DOM URLs:               ${m.bySource.javascript_dom ?? 'not scanned'}`);
  console.log(`Canonical-discovered URLs: ${m.bySource.canonical || 0}`);
  console.log(`Redirect-discovered URLs:  ${m.bySource.redirect || 0}`);
  console.log(`Multi-source URLs:         ${m.multiSourceUrls}`);
  console.log(`-`.repeat(70));
  console.log(`Unique discovered URLs:    ${m.urlsDiscovered}`);
  console.log(`Queued:                    ${m.urlsQueued}`);
  console.log(`Crawled:                   ${m.urlsCrawled}`);
  console.log(`Not crawled:               ${m.notCrawled}`);
  console.log(`Failed:                    ${m.failed}`);
  console.log(`Excluded:                  ${m.excluded}`);
  console.log(`Indexable:                 ${m.indexable}`);
  console.log(`Non-indexable:             ${m.nonIndexable}`);
  console.log(`Redirects:                 ${m.redirects}`);
  console.log(`2xx:                       ${m.statusBuckets.ok}`);
  console.log(`4xx:                       ${m.statusBuckets.clientError}`);
  console.log(`5xx:                       ${m.statusBuckets.serverError}`);
  console.log(`No response:               ${m.statusBuckets.noResponse}`);
  console.log(`Canonicalized:             ${m.canonicalized}`);
  console.log(`Rendered (Playwright):     ${m.renderedPages === 0 ? '0 — render tier not run in this harness' : m.renderedPages}`);

  const coverage = m.urlsDiscovered > 0 ? (m.urlsCrawled / m.urlsDiscovered) * 100 : null;
  console.log(`Crawl coverage:            ${coverage === null ? 'unknown' : `${coverage.toFixed(1)}%`}`);

  if (m.notCrawled > 0) {
    console.log(`\n${m.notCrawled} URLs not crawled:`);
    for (const [reason, count] of Object.entries(m.notCrawledReasons).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${String(count).padStart(4)}  ${reason}`);
    }
  }

  // The assertions. A report that does not balance is the bug, not a nuance.
  const reasonTotal = Object.values(m.notCrawledReasons).reduce((a, b) => a + b, 0);
  const checks: Array<[string, boolean]> = [
    ['crawled + notCrawled === discovered', m.urlsCrawled + m.notCrawled === m.urlsDiscovered],
    ['every not-crawled URL has a reason', reasonTotal === m.notCrawled],
    ['no source claims more URLs than exist', Object.values(m.bySource).every((v) => v <= m.urlsDiscovered)],
    ['status buckets sum to crawled', Object.values(m.statusBuckets).reduce((a, b) => a + b, 0) === m.urlsCrawled],
  ];

  console.log(`\n${'='.repeat(70)}`);
  let ok = true;
  for (const [label, passed] of checks) {
    console.log(`${passed ? 'PASS' : 'FAIL'}  ${label}`);
    if (!passed) ok = false;
  }
  process.exit(ok ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
