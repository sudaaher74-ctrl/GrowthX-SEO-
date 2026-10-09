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
    inventory: {
      record: jest.fn(async () => ({ added: 0, merged: 0, invalid: 0 })),
      markQueued: jest.fn(async () => undefined),
      markCrawled: jest.fn(async () => undefined),
      markExcluded: jest.fn(async () => undefined),
      metrics: jest.fn(async () => null),
    },
    ...overrides,
  };

  const service = new CrawlerService(
    deps.prisma, deps.storage, deps.queue, deps.robots, deps.sitemap, deps.fetcher,
    deps.fetchSvc, deps.discovery, deps.metrics, deps.htmlExtractor, deps.imageAnalyzer,
    deps.linkAnalyzer, deps.schemaValidator, deps.contentAnalyzer, deps.performanceService,
    deps.issueEngine, deps.graphService, deps.crawlerGateway, deps.inventory,
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
  it('restores sitemap and robots metadata from the database after Redis state loss', async () => {
    const previous = process.env.CRAWL_FAIR_SCHEDULING;
    process.env.CRAWL_FAIR_SCHEDULING = 'true';
    try {
      const { service } = makeService({ fetchSvc: { fetch: jest.fn(async () => outcome()) } });
      const snapshot = { sitemapUrls: [payload.targetUrl], robots: { groups: [], sitemaps: [] }, sitemapFindings: [] };
      (service as any).prisma.crawlJob.findUnique = jest.fn(async ({ select }: any) => select?.status
        ? { status: 'RUNNING' } : { qualityDiagnostics: { crawlStateSnapshot: snapshot } });
      await service.processPageFetch(payload);
      expect((service as any).state.jobSitemapUrls.get(payload.jobId).has(payload.targetUrl)).toBe(true);
      expect((service as any).state.jobRobots.get(payload.jobId)).toEqual(snapshot.robots);
    } finally {
      if (previous === undefined) delete process.env.CRAWL_FAIR_SCHEDULING;
      else process.env.CRAWL_FAIR_SCHEDULING = previous;
    }
  });
  it('resumes an interrupted claim only for the same BullMQ task', async () => {
    const fetch = jest.fn(async () => outcome());
    const { service, upserts } = makeService({ fetchSvc: { fetch } });
    (service as any).prisma.crawlFrontier = { findFirst: jest.fn(async () => ({ state: 'PENDING' })) };
    await (service as any).state.markUrlVisited(payload.jobId, payload.targetUrl, undefined, 'interrupted');
    await service.processPageFetch({ ...payload, taskId: 'another-task', resumeAttempt: true });
    expect(fetch).not.toHaveBeenCalled();
    await service.processPageFetch({ ...payload, taskId: 'interrupted', resumeAttempt: true });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(upserts).toHaveLength(1);
  });
  it('allows required renders after 100 pages when full rendering is enabled', async () => {
    const previous = process.env.CRAWL_RENDER_ALL_PAGES;
    process.env.CRAWL_RENDER_ALL_PAGES = 'true';
    try {
      const fetch = jest.fn(async () => outcome({ tier: 'rendered', renderedHtml: '<h1>Complete</h1>' }));
      const { service } = makeService({ fetchSvc: { fetch } });
      (service as any).state.jobRendersUsed.set(payload.jobId, 600);
      await service.processPageFetch(payload);
      expect(fetch).toHaveBeenCalledWith(payload.targetUrl, { renderAllowed: true });
    } finally {
      if (previous === undefined) delete process.env.CRAWL_RENDER_ALL_PAGES;
      else process.env.CRAWL_RENDER_ALL_PAGES = previous;
    }
  });

  it('retries unavailable rendering without storing a shell or settling the page', async () => {
    const previous = process.env.CRAWL_RENDER_ALL_PAGES;
    process.env.CRAWL_RENDER_ALL_PAGES = 'true';
    try {
      const { service, upserts } = makeService({ fetchSvc: { fetch: jest.fn(async () => outcome({ renderUnavailable: true })) } });
      const settle = jest.spyOn(service as any, 'settlePageFetchTask');
      await expect(service.processPageFetch(payload)).rejects.toThrow('Required browser rendering');
      expect(upserts).toHaveLength(0);
      expect(settle).not.toHaveBeenCalled();
      expect(await (service as any).state.isUrlClaimed(payload.jobId, payload.targetUrl)).toBe(false);
    } finally {
      if (previous === undefined) delete process.env.CRAWL_RENDER_ALL_PAGES;
      else process.env.CRAWL_RENDER_ALL_PAGES = previous;
    }
  });
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

  it('lets a crawl ask for fewer renders than the deployment allows', async () => {
    const fetch = jest.fn(async (_url: string, _opts?: unknown) =>
      outcome({ tier: 'rendered', jsRequired: true, renderedHtml: '<html><body><h1>R</h1></body></html>' }),
    );
    const { service } = makeService({ fetchSvc: { fetch } });

    await service.processPageFetch({ ...payload, renderBudget: 1 });
    await service.processPageFetch({ ...payload, renderBudget: 1, targetUrl: 'https://example.com/second' });

    expect(fetch.mock.calls[0][1]).toEqual({ renderAllowed: true });
    expect(fetch.mock.calls[1][1]).toEqual({ renderAllowed: false });
  });

  it('never lets a crawl ask for more renders than the deployment allows', async () => {
    const previous = process.env.CRAWL_MAX_RENDERED_PAGES;
    process.env.CRAWL_MAX_RENDERED_PAGES = '1';
    try {
      const fetch = jest.fn(async (_url: string, _opts?: unknown) =>
        outcome({ tier: 'rendered', jsRequired: true, renderedHtml: '<html><body><h1>R</h1></body></html>' }),
      );
      const { service } = makeService({ fetchSvc: { fetch } });

      await service.processPageFetch({ ...payload, renderBudget: 10 });
      await service.processPageFetch({ ...payload, renderBudget: 10, targetUrl: 'https://example.com/second' });

      expect(fetch.mock.calls[1][1]).toEqual({ renderAllowed: false });
    } finally {
      if (previous === undefined) delete process.env.CRAWL_MAX_RENDERED_PAGES;
      else process.env.CRAWL_MAX_RENDERED_PAGES = previous;
    }
  });
});

describe('CrawlerService is polite to the site it reads', () => {
  it('waits the crawl\'s delay for that site before each fetch', async () => {
    const order: string[] = [];
    const fetch = jest.fn(async () => {
      order.push('fetch');
      return outcome();
    });
    const { service } = makeService({ fetchSvc: { fetch } });
    const wait = jest.fn(async () => {
      order.push('wait');
    });
    (service as any).pacer = { wait };

    await service.processPageFetch({ ...payload, domain: 'fortuneexicom.com', rateLimitDelayMs: 1000 });

    expect(wait).toHaveBeenCalledWith('fortuneexicom.com', 1000);
    expect(order).toEqual(['wait', 'fetch']);
  });
});

describe('CrawlerService honours a crawl time budget', () => {
  function withStats(service: CrawlerService) {
    (service as any).state.jobStats.set('job1', {
      urlsDiscovered: 0,
      urlsSkipped: 0,
      robotsBlocked: 0,
      internalLinksFound: 0,
      crawlStatus: 'COMPLETED',
    });
    return (service as any).state.jobStats.get('job1');
  }

  it('fetches as normal before the deadline', async () => {
    const fetch = jest.fn(async () => outcome());
    const { service, upserts } = makeService({ fetchSvc: { fetch } });
    const stats = withStats(service);

    await service.processPageFetch({ ...payload, deadlineAt: Date.now() + 60_000 });

    expect(fetch).toHaveBeenCalled();
    expect(upserts).toHaveLength(1);
    expect(stats.crawlStatus).toBe('COMPLETED');
  });

  it('skips the fetch once the deadline has passed, and says the crawl was capped', async () => {
    const fetch = jest.fn(async () => outcome());
    const markExcluded = jest.fn(async () => undefined);
    const { service, upserts } = makeService({
      fetchSvc: { fetch },
      inventory: {
        record: jest.fn(async () => ({ added: 0, merged: 0, invalid: 0 })),
        markQueued: jest.fn(async () => undefined),
        markCrawled: jest.fn(async () => undefined),
        markExcluded,
        metrics: jest.fn(async () => null),
      },
    });
    const stats = withStats(service);

    await service.processPageFetch({ ...payload, deadlineAt: Date.now() - 1 });

    expect(fetch).not.toHaveBeenCalled();
    expect(upserts).toHaveLength(0);
    expect(markExcluded).toHaveBeenCalledWith('job1', 'https://example.com/', 'crawl_budget_exceeded');
    expect(stats.crawlStatus).toBe('LIMIT_REACHED');
    expect(stats.urlsSkipped).toBe(1);
  });

  it('does not count a skipped URL as a page read, so it does not use up the page limit', async () => {
    const fetch = jest.fn(async () => outcome());
    const { service } = makeService({ fetchSvc: { fetch } });
    withStats(service);

    await service.processPageFetch({ ...payload, deadlineAt: Date.now() - 1 });

    expect((service as any).state.localVisited.get('job1')?.size ?? 0).toBe(0);
  });

  it('still records a duplicate as a duplicate after the deadline', async () => {
    const fetch = jest.fn(async () => outcome());
    const markExcluded = jest.fn(async () => undefined);
    const { service } = makeService({
      fetchSvc: { fetch },
      inventory: {
        record: jest.fn(async () => ({ added: 0, merged: 0, invalid: 0 })),
        markQueued: jest.fn(async () => undefined),
        markCrawled: jest.fn(async () => undefined),
        markExcluded,
        metrics: jest.fn(async () => null),
      },
    });
    const stats = withStats(service);

    await service.processPageFetch(payload);
    await service.processPageFetch({ ...payload, deadlineAt: Date.now() - 1 });

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(markExcluded).toHaveBeenLastCalledWith('job1', 'https://example.com/', 'duplicate');
    expect(stats.crawlStatus).toBe('COMPLETED');
  });

  it('hands the deadline and render budget on to the pages it finds', async () => {
    const bulkAddPageFetchTasks = jest.fn(async () => undefined);
    const { service } = makeService({
      queue: { getRedisClient: () => null, pageFetchQueue: {}, bulkAddPageFetchTasks },
    });
    const deadlineAt = Date.now() + 60_000;

    await (service as any).discoverInternalLinksAndEnqueue(
      { ...payload, domain: 'example.com', rateLimitDelayMs: 0, deadlineAt, renderBudget: 5 },
      [{ targetUrl: 'https://example.com/about' }],
      'page1',
    );

    expect(bulkAddPageFetchTasks).toHaveBeenCalledTimes(1);
    const [children] = bulkAddPageFetchTasks.mock.calls[0] as unknown as [any[]];
    expect(children).toHaveLength(1);
    expect(children[0].deadlineAt).toBe(deadlineAt);
    expect(children[0].renderBudget).toBe(5);
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
