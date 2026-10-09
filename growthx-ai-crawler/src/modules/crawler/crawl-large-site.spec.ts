import { CrawlEngine } from './crawl-engine';
import { crawlLimits } from './crawler.service';
import { HostRateLimiter } from './frontier/rate-limiter';

describe('large competitor sitemap coverage', () => {
  it.each([252, 1000])('drains all %i unique sitemap pages inside the ordinary audit limit', async (count) => {
    const origin = 'https://example.com';
    const urls = Array.from({ length: count }, (_, i) => `${origin}/page-${i}`);
    const discovery = {
      isAllowed: jest.fn().mockReturnValue({ allowed: true }),
      discoverSeeds: jest.fn().mockResolvedValue({
        urls: urls.map(url => ({ url, normalizedUrl: url, source: 'sitemap' })),
        robotsFetched: false, sitemapsFetched: [], sitemapEntries: [], foreignSitemapUrls: [], findings: [],
      }),
    };
    const fetcher = {
      fetch: jest.fn(async (url: string) => {
        const html = `<html><head><title>${url}</title></head><body><h1>${url}</h1><p>Readable content</p></body></html>`;
        return { url, finalUrl: url, statusCode: 200, statusChain: [], headers: {}, contentType: 'text/html',
          rawHtml: html, html, jsRequired: false, escalationReasons: [], blockedSuspected: false, totalMs: 1, tier: 'static' };
      }),
    };
    // No network is used here. Pacing is independently tested by rate-limiter tests.
    const pace = jest.spyOn(HostRateLimiter.prototype, 'acquire').mockResolvedValue(undefined);
    try {
      const limits = crawlLimits();
      const engine = new CrawlEngine(fetcher as any, discovery as any, {
        maxPages: limits.defaultPageLimit, maxDepth: 10, maxDurationMs: 60_000,
        maxRenderedPages: 100, concurrency: 2,
      });
      const report = await engine.crawl(origin);
      expect(report.stoppedBecause).toBe('FRONTIER_EMPTY');
      expect(report.pages).toHaveLength(count);
      expect(new Set(report.pages.map(page => page.url))).toEqual(new Set(urls));
      expect(fetcher.fetch).toHaveBeenCalledTimes(count);
    } finally {
      pace.mockRestore();
    }
  });
});
