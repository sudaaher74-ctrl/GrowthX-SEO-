import { CrawlerService } from './crawler.service';

/**
 * The columns the dashboard reads must actually be written by the crawler that
 * runs in production.
 *
 * This is not a hypothetical. The v2 pipeline was built and tested as its own
 * engine while `CrawlerService` — the service BullMQ actually drives — still
 * wrote none of the new columns. Shipping that combination would have deployed
 * a UI reading `indexability` against rows where it is always the 'UNKNOWN'
 * default: every page in every audit would have read "Unknown", which is worse
 * than the wrong answer it replaced. These tests pin the wiring.
 */
function makeService(overrides: Record<string, any> = {}): { service: CrawlerService; upserts: any[]; issues: any[] } {
  const upserts: any[] = [];
  const issues: any[] = [];

  const prisma = {
    page: {
      upsert: jest.fn(async (args: any) => {
        upserts.push(args);
        return { id: 'page1' };
      }),
    },
    crawlJob: { update: jest.fn(async () => ({ pagesCrawled: 1 })) },
    issue: { findFirst: jest.fn(async () => null), create: jest.fn(async (args: any) => issues.push(args.data)) },
    image: { create: jest.fn(async () => ({})) },
    link: { create: jest.fn(async () => ({})) },
    internalGraph: { create: jest.fn(async () => ({})) },
    siteSocialLink: { upsert: jest.fn(async () => ({})) },
  };

  const empty = {
    title: undefined,
    metaDescription: undefined,
    canonicalUrl: undefined,
    robotsMeta: undefined,
    h1: [],
    h2: [],
    h3: [],
    openGraph: {},
    twitterCards: {},
    jsonLd: [],
    microdataTypes: [],
    rawStructuredDataCount: 0,
  };

  const deps: Record<string, any> = {
    prisma,
    storage: { saveSnapshot: jest.fn(async () => 'snapshot-url') },
    queue: { getRedisClient: () => null, pageFetchQueue: null },
    robots: { isUrlAllowed: jest.fn(async () => true) },
    sitemap: {},
    fetcher: {},
    fetchSvc: {},
    discovery: { isAllowed: jest.fn(() => ({ allowed: true, evidence: 'no rule matched' })) },
    metrics: { pagesCrawledTotal: { inc: jest.fn() } },
    htmlExtractor: { extract: jest.fn(() => ({ ...empty })) },
    imageAnalyzer: { analyzeImages: jest.fn(() => []) },
    linkAnalyzer: {
      analyzeLinks: jest.fn(() => ({ internalLinks: [], externalLinks: [], brokenAnchors: [], nofollowLinks: [], internalCount: 0, externalCount: 0, totalCount: 0 })),
    },
    schemaValidator: { validateSchemas: jest.fn(() => []) },
    contentAnalyzer: { analyzeContent: jest.fn(() => ({ wordCount: 0, readingTimeMin: 0, contentHash: 'h', simHash: '' })) },
    performanceService: { fetchPageSpeedMetrics: jest.fn(async () => undefined) },
    issueEngine: { evaluateAndPersistIssues: jest.fn(async () => []) },
    graphService: {},
    crawlerGateway: { broadcastProgress: jest.fn() },
    ...overrides,
  };

  const service = new CrawlerService(
    deps.prisma, deps.storage, deps.queue, deps.robots, deps.sitemap, deps.fetcher,
    deps.fetchSvc, deps.discovery, deps.metrics, deps.htmlExtractor, deps.imageAnalyzer,
    deps.linkAnalyzer, deps.schemaValidator, deps.contentAnalyzer, deps.performanceService,
    deps.issueEngine, deps.graphService, deps.crawlerGateway,
  );
  return { service, upserts, issues };
}

function outcome(over: Record<string, any> = {}) {
  return {
    url: 'https://example.com/',
    finalUrl: 'https://example.com/',
    statusCode: 200,
    statusChain: [{ url: 'https://example.com/', status: 200 }],
    headers: {},
    contentType: 'text/html',
    rawHtml: '<html><body><div id="root"></div></body></html>',
    html: '<html><body><h1>Real</h1></body></html>',
    jsRequired: false,
    escalationReasons: [],
    blockedSuspected: false,
    totalMs: 12,
    tier: 'static',
    ...over,
  };
}

const payload = { jobId: 'job1', websiteId: 'w1', targetUrl: 'https://example.com/', depth: 0, maxDepth: 3 } as any;

describe('CrawlerService writes the v2 columns', () => {
  it('records a computed indexability, not the UNKNOWN default', async () => {
    const { service, upserts } = makeService({ fetchSvc: { fetch: jest.fn(async () => outcome()) } });

    await service.processPageFetch(payload);

    expect(upserts).toHaveLength(1);
    expect(upserts[0].create.indexability).toBe('INDEXABLE');
    expect(upserts[0].create.indexabilityReason).toEqual([]);
    expect(upserts[0].update.indexability).toBe('INDEXABLE');
  });

  it('records jsRequired and keeps the rendered HTML only when it differs', async () => {
    const { service, upserts } = makeService({
      fetchSvc: { fetch: jest.fn(async () => outcome({ jsRequired: true, tier: 'rendered', renderedHtml: '<html><body><h1>Rendered</h1></body></html>' })) },
    });

    await service.processPageFetch(payload);

    expect(upserts[0].create.jsRequired).toBe(true);
    expect(upserts[0].create.renderedHtml).toContain('Rendered');
    expect(upserts[0].create.rawHtml).toContain('id="root"');
  });

  it('does not store a second copy of the same bytes when nothing was rendered', async () => {
    const { service, upserts } = makeService({ fetchSvc: { fetch: jest.fn(async () => outcome()) } });

    await service.processPageFetch(payload);

    expect(upserts[0].create.jsRequired).toBe(false);
    expect(upserts[0].create.renderedHtml).toBeNull();
  });

  it('records the full status chain and the blocked suspicion', async () => {
    const chain = [
      { url: 'http://example.com/', status: 301, location: 'https://example.com/' },
      { url: 'https://example.com/', status: 200 },
    ];
    const { service, upserts } = makeService({ fetchSvc: { fetch: jest.fn(async () => outcome({ statusChain: chain })) } });

    await service.processPageFetch(payload);

    expect(upserts[0].create.statusChain).toEqual(chain);
    expect(upserts[0].create.blockedSuspected).toBe(false);
  });

  it('reads indexability off the headers, never off the status code', async () => {
    const { service, upserts } = makeService({
      fetchSvc: { fetch: jest.fn(async () => outcome({ headers: { 'x-robots-tag': 'noindex' } })) },
    });

    await service.processPageFetch(payload);

    expect(upserts[0].create.indexability).toBe('NOT_INDEXABLE');
    expect(upserts[0].create.indexabilityReason[0].code).toBe('X_ROBOTS_TAG_NOINDEX');
  });

  it('stores 0 rather than inventing a status when nothing answered', async () => {
    const error = { kind: 'dns', message: 'ENOTFOUND', label: 'Hostname could not be resolved' };
    const { service, upserts } = makeService({
      fetchSvc: { fetch: jest.fn(async () => outcome({ statusCode: undefined, tier: 'failed', html: '', rawHtml: '', error })) },
    });

    await service.processPageFetch(payload);

    // 0 is not a real HTTP status, so no existing reader asking `>= 400`
    // counts our network failure as the customer's defect.
    expect(upserts[0].create.statusCode).toBe(0);
    expect(upserts[0].create.fetchErrorKind).toBe('dns');
    expect(upserts[0].create.indexability).toBe('UNKNOWN');
  });
});

describe('CrawlerService budgets rendering', () => {
  it('allows rendering while the budget holds', async () => {
    const fetch = jest.fn(async (_url: string, _opts?: unknown) => outcome());
    const { service } = makeService({ fetchSvc: { fetch } });

    await service.processPageFetch(payload);

    expect(fetch).toHaveBeenCalledWith('https://example.com/', { renderAllowed: true });
  });

  it('stops offering the render tier once the budget is spent', async () => {
    const previous = process.env.CRAWL_MAX_RENDERED_PAGES;
    process.env.CRAWL_MAX_RENDERED_PAGES = '1';
    try {
      const fetch = jest.fn(async (_url: string, _opts?: unknown) =>
        outcome({ tier: 'rendered', jsRequired: true, renderedHtml: '<html><body><h1>R</h1></body></html>' }),
      );
      const { service } = makeService({ fetchSvc: { fetch } });

      await service.processPageFetch(payload);
      await service.processPageFetch({ ...payload, targetUrl: 'https://example.com/second' });

      expect(fetch.mock.calls[0][1]).toEqual({ renderAllowed: true });
      // The budget was spent by the first page, so the second is fetched but
      // not rendered - still assessed, and honest about being partial.
      expect(fetch.mock.calls[1][1]).toEqual({ renderAllowed: false });
    } finally {
      if (previous === undefined) delete process.env.CRAWL_MAX_RENDERED_PAGES;
      else process.env.CRAWL_MAX_RENDERED_PAGES = previous;
    }
  });
});

describe('CrawlerService suppresses the issue cascade', () => {
  it('raises one finding for an unreachable page and runs no content rules', async () => {
    const evaluateAndPersistIssues = jest.fn(async () => []);
    const error = { kind: 'dns', message: 'ENOTFOUND', label: 'Hostname could not be resolved' };
    const { service, issues } = makeService({
      fetchSvc: { fetch: jest.fn(async () => outcome({ statusCode: undefined, tier: 'failed', html: '', rawHtml: '', error })) },
      issueEngine: { evaluateAndPersistIssues },
    });

    await service.processPageFetch(payload);

    expect(evaluateAndPersistIssues).not.toHaveBeenCalled();
    expect(issues).toHaveLength(1);
    expect(issues[0].issueType).toBe('FETCH_FAILED');
    expect(issues[0].evidence).toContain('dns');
    expect(issues[0].explanation).toContain('not a statement about the page itself');
  });

  it('raises one finding for a suspected block and runs no content rules', async () => {
    const evaluateAndPersistIssues = jest.fn(async () => []);
    const { service, issues } = makeService({
      fetchSvc: {
        fetch: jest.fn(async () => outcome({ statusCode: 403, blockedSuspected: true, blockedEvidence: 'HTTP 403, server=cloudfront' })),
      },
      issueEngine: { evaluateAndPersistIssues },
    });

    await service.processPageFetch(payload);

    expect(evaluateAndPersistIssues).not.toHaveBeenCalled();
    expect(issues).toHaveLength(1);
    expect(issues[0].issueType).toBe('FETCH_BLOCKED_SUSPECTED');
    expect(issues[0].evidence).toContain('cloudfront');
  });

  it('still runs the content rules for a page it could read', async () => {
    const evaluateAndPersistIssues = jest.fn(async () => []);
    const { service } = makeService({
      fetchSvc: { fetch: jest.fn(async () => outcome()) },
      issueEngine: { evaluateAndPersistIssues },
    });

    await service.processPageFetch(payload);

    expect(evaluateAndPersistIssues).toHaveBeenCalled();
  });
});
