import { CrawlerService } from './crawler.service';

/**
 * Covers the parts of the crawler that decide *what gets fetched*: URL
 * normalisation, visit deduplication and depth limits.
 *
 * These are where crawl bugs actually cost money — a normalisation slip makes
 * the crawler fetch the same page many times and burn the customer's page
 * quota, and a dedup slip can loop indefinitely on a site with circular links.
 * The full analysis pipeline needs the whole Nest graph, so it is exercised
 * through its own services' specs rather than here.
 */
function makeService(overrides: Partial<Record<string, any>> = {}): CrawlerService {
  const deps = {
    prisma: {},
    storage: {},
    queue: { getRedisClient: () => null, pageFetchQueue: null },
    robots: {},
    sitemap: {},
    fetcher: {},
    metrics: {},
    htmlExtractor: {},
    imageAnalyzer: {},
    linkAnalyzer: {},
    schemaValidator: {},
    contentAnalyzer: {},
    performanceService: {},
    issueEngine: {},
    graphService: {},
    crawlerGateway: {},
    entitlements: {},
    ...overrides,
  };

  return new CrawlerService(
    deps.prisma as any,
    deps.storage as any,
    deps.queue as any,
    deps.robots as any,
    deps.sitemap as any,
    deps.fetcher as any,
    deps.metrics as any,
    deps.htmlExtractor as any,
    deps.imageAnalyzer as any,
    deps.linkAnalyzer as any,
    deps.schemaValidator as any,
    deps.contentAnalyzer as any,
    deps.performanceService as any,
    deps.issueEngine as any,
    deps.graphService as any,
    deps.crawlerGateway as any,
  );
}

describe('CrawlerService', () => {
  describe('URL normalisation', () => {
    let normalize: (url: string) => string;

    beforeEach(() => {
      const service = makeService();
      normalize = (url: string) => (service as any).normalizeUrl(url);
    });

    it('adds a scheme to a bare domain', () => {
      expect(normalize('example.com')).toBe('https://example.com/');
    });

    it('keeps an explicit http scheme rather than forcing https', () => {
      expect(normalize('http://example.com/page')).toBe('http://example.com/page');
    });

    // A fragment is the same document. Treating #pricing as a separate URL
    // would refetch the page once per anchor on the site.
    it('strips the fragment', () => {
      expect(normalize('https://example.com/page#pricing')).toBe('https://example.com/page');
    });

    it('drops a trailing slash so /page and /page/ are one URL', () => {
      expect(normalize('https://example.com/page/')).toBe('https://example.com/page');
    });

    it('keeps the root slash', () => {
      expect(normalize('https://example.com/')).toBe('https://example.com/');
    });

    // Query strings usually do identify a different page (?page=2), so they
    // must survive normalisation.
    it('preserves the query string', () => {
      expect(normalize('https://example.com/list?page=2')).toBe('https://example.com/list?page=2');
    });

    it('trims surrounding whitespace', () => {
      expect(normalize('  https://example.com/page  ')).toBe('https://example.com/page');
    });

    it('normalises the variants of one page to the same string', () => {
      const variants = [
        'https://example.com/page',
        'https://example.com/page/',
        'https://example.com/page#top',
        '  https://example.com/page/  ',
      ];

      expect(new Set(variants.map(normalize)).size).toBe(1);
    });
  });

  describe('visit deduplication', () => {
    it('reports a URL as unvisited the first time and visited after', async () => {
      const service = makeService();
      const mark = (url: string) => (service as any).markUrlVisited('job1', url);

      expect(await mark('https://example.com/a')).toBe(false);
      expect(await mark('https://example.com/a')).toBe(true);
      expect(await mark('https://example.com/a')).toBe(true);
    });

    it('tracks each URL separately', async () => {
      const service = makeService();
      const mark = (url: string) => (service as any).markUrlVisited('job1', url);

      expect(await mark('https://example.com/a')).toBe(false);
      expect(await mark('https://example.com/b')).toBe(false);
      expect(await mark('https://example.com/a')).toBe(true);
    });

    // Two customers crawling the same site must not shorten each other's crawl.
    it('keeps separate visited sets per job', async () => {
      const service = makeService();
      const mark = (job: string, url: string) => (service as any).markUrlVisited(job, url);

      expect(await mark('job1', 'https://example.com/a')).toBe(false);
      expect(await mark('job2', 'https://example.com/a')).toBe(false);
      expect(await mark('job1', 'https://example.com/a')).toBe(true);
    });

    describe('with Redis', () => {
      it('uses the shared set so parallel workers do not refetch', async () => {
        const sadd = jest.fn().mockResolvedValue(1);
        const expire = jest.fn().mockResolvedValue(1);
        const service = makeService({
          queue: { getRedisClient: () => ({ sadd, expire }), pageFetchQueue: null },
        });

        const visited = await (service as any).markUrlVisited('job1', 'https://example.com/a');

        expect(visited).toBe(false);
        expect(sadd).toHaveBeenCalledWith('job:job1:visited', 'https://example.com/a');
        // Without the TTL the set would outlive the crawl and suppress the
        // next one for the same job id.
        expect(expire).toHaveBeenCalledWith('job:job1:visited', 86400);
      });

      it('treats a URL another worker already claimed as visited', async () => {
        // sadd returns 0 when the member was already in the set.
        const sadd = jest.fn().mockResolvedValue(0);
        const expire = jest.fn();
        const service = makeService({
          queue: { getRedisClient: () => ({ sadd, expire }), pageFetchQueue: null },
        });

        const visited = await (service as any).markUrlVisited('job1', 'https://example.com/a');

        expect(visited).toBe(true);
        expect(expire).not.toHaveBeenCalled();
      });
    });
  });

  describe('depth and robots limits', () => {
    function serviceForPageFetch(overrides: Partial<Record<string, any>> = {}) {
      const fetchPage = jest.fn();
      const service = makeService({
        robots: { isUrlAllowed: jest.fn().mockResolvedValue(true) },
        fetcher: { fetchPage },
        ...overrides,
      });
      return { service, fetchPage };
    }

    it('does not fetch beyond the requested depth', async () => {
      const { service, fetchPage } = serviceForPageFetch();

      await service.processPageFetch({
        jobId: 'job1',
        websiteId: 'w1',
        targetUrl: 'https://example.com/deep',
        depth: 4,
        maxDepth: 3,
      } as any);

      expect(fetchPage).not.toHaveBeenCalled();
    });

    it('fetches a page at the depth limit', async () => {
      const { service, fetchPage } = serviceForPageFetch();
      fetchPage.mockResolvedValue({ html: '', statusCode: 200, redirectChain: [], engine: 'cheerio' });

      await service.processPageFetch({
        jobId: 'job1',
        websiteId: 'w1',
        targetUrl: 'https://example.com/edge',
        depth: 3,
        maxDepth: 3,
      } as any);

      expect(fetchPage).toHaveBeenCalled();
    });

    // Ignoring robots.txt would get the customer's crawler blocked, and is the
    // kind of thing an agency gets held responsible for.
    it('does not fetch a URL robots.txt disallows', async () => {
      const { service, fetchPage } = serviceForPageFetch({
        robots: { isUrlAllowed: jest.fn().mockResolvedValue(false) },
      });

      await service.processPageFetch({
        jobId: 'job1',
        websiteId: 'w1',
        targetUrl: 'https://example.com/private',
        depth: 0,
        maxDepth: 3,
      } as any);

      expect(fetchPage).not.toHaveBeenCalled();
    });

    it('does not fetch a URL already visited in this job', async () => {
      const { service, fetchPage } = serviceForPageFetch();
      await (service as any).markUrlVisited('job1', 'https://example.com/seen');

      await service.processPageFetch({
        jobId: 'job1',
        websiteId: 'w1',
        targetUrl: 'https://example.com/seen',
        depth: 0,
        maxDepth: 3,
      } as any);

      expect(fetchPage).not.toHaveBeenCalled();
    });

    it('checks robots before spending a fetch', async () => {
      const isUrlAllowed = jest.fn().mockResolvedValue(false);
      const { service, fetchPage } = serviceForPageFetch({ robots: { isUrlAllowed } });

      await service.processPageFetch({
        jobId: 'job1',
        websiteId: 'w1',
        targetUrl: 'https://example.com/x',
        depth: 0,
        maxDepth: 3,
      } as any);

      expect(isUrlAllowed).toHaveBeenCalled();
      expect(fetchPage).not.toHaveBeenCalled();
    });
  });
});
