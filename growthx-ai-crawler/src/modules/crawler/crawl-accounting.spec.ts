import { computeCrawlSummary } from './crawl-summary';

/**
 * The milquufresh.in dashboard reported "Sitemap 58" for a site whose sitemap
 * lists 29 URLs, and "Crawl Coverage 100% (32/32)" for a crawl that had found
 * more URLs than it fetched. Both numbers came out of this function.
 */
describe('crawl accounting (milquufresh.in regression)', () => {
  const pages = [
    ...Array.from({ length: 29 }, (_, i) => ({
      url: `https://milquufresh.in/p${i}`,
      statusCode: 200,
      indexability: 'INDEXABLE',
      discoverySource: 'sitemap',
    })),
    ...Array.from({ length: 3 }, (_, i) => ({
      url: `https://milquufresh.in/l${i}`,
      statusCode: 200,
      indexability: 'INDEXABLE',
      discoverySource: 'internal_links',
    })),
  ];

  it('does not double-count sources when re-summarising a stored summary', () => {
    // Pass 1: the worker, which has no precomputed bySource.
    const server = computeCrawlSummary({ pages, issues: [] });
    expect(server.bySource).toEqual({ sitemap: 29, internal_links: 3 });

    // Pass 2: the dashboard, which feeds pass 1's stored output back in.
    // This is where 29 became 58 and 3 became 6 on the live screenshot.
    const client = computeCrawlSummary({
      pages,
      issues: [],
      discoveryMetrics: { bySource: server.bySource },
    });

    expect(client.bySource).toEqual({ sitemap: 29, internal_links: 3 });
  });

  it('never reports a source count larger than the URLs that exist', () => {
    const summary = computeCrawlSummary({
      pages,
      issues: [],
      discoveryMetrics: { bySource: { sitemap: 29, internal_links: 3 }, urlsDiscovered: 32 },
    });
    const total = Object.values(summary.bySource).reduce((a, b) => a + b, 0);
    expect(total).toBeLessThanOrEqual(summary.urlsDiscovered);
  });

  it('counts URLs discovered but never fetched against coverage', () => {
    // 40 discovered, 32 fetched. Coverage is 80%, not 100%.
    const summary = computeCrawlSummary({
      pages,
      issues: [],
      discoveryMetrics: { urlsDiscovered: 40, urlsCrawled: 32 },
    });

    expect(summary.urlsDiscovered).toBe(40);
    expect(summary.urlsCrawled).toBe(32);
    expect(summary.notCrawled).toBe(8);
    expect(summary.coveragePercent).toBe(80);
  });

  it('reports coverage as unknown rather than 100% when nothing was discovered', () => {
    const summary = computeCrawlSummary({ pages: [], issues: [] });
    expect(summary.coveragePercent).toBeNull();
  });

  it('does not invent a coverage of 100% from the crawled count alone', () => {
    // The old fallback was `urlsDiscovered ?? max(pages.length, urlsCrawled)`,
    // which makes discovered equal crawled and coverage always 100%.
    const summary = computeCrawlSummary({
      pages,
      issues: [],
      discoveryMetrics: { urlsCrawled: 32, urlsDiscovered: 45 },
    });
    expect(summary.coveragePercent).toBe(71);
  });

  it('separates unique URLs per source from raw discovery events', () => {
    const summary = computeCrawlSummary({
      pages,
      issues: [],
      discoveryMetrics: {
        urlsDiscovered: 32,
        bySource: { sitemap: 29, internal_links: 14 },
        discoveryEvents: { sitemap: 29, internal_links: 96 },
        multiSourceUrls: 11,
      },
    });

    // 29 + 14 counts the 11 overlapping URLs twice, so it must not be the total.
    expect(summary.bySource.sitemap).toBe(29);
    expect(summary.bySource.internal_links).toBe(14);
    expect(summary.discoveryEvents?.internal_links).toBe(96);
    expect(summary.multiSourceUrls).toBe(11);
    expect(summary.urlsDiscovered).toBe(32);
  });

  it('says a source was not scanned rather than reporting zero', () => {
    const summary = computeCrawlSummary({
      pages,
      issues: [],
      discoveryMetrics: { urlsDiscovered: 32, renderedPages: 0, renderingEnabled: false },
    });
    expect(summary.javascriptDomScanned).toBe(false);
  });
});
