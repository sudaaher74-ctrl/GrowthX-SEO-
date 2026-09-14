import { CrawlEngine, DEFAULT_CRAWL_LIMITS } from './crawl-engine';
import { FetchService } from './fetch/fetch.service';
import { BrowserPoolService } from './fetch/browser-pool.service';
import { DiscoveryService } from './discovery/discovery.service';
import { startFixtureServer, FixtureServer, SPA_SHELL_HTML } from './testing/fixture-server';
import { SPA_CLIENT_BUNDLE, staticPage } from './testing/spa-bundle';

describe('CrawlEngine', () => {
  let pool: BrowserPoolService;
  let engine: CrawlEngine;
  let server: FixtureServer | undefined;

  const build = (limits = {}) => {
    pool = new BrowserPoolService();
    return new CrawlEngine(new FetchService(pool), new DiscoveryService(), { ...DEFAULT_CRAWL_LIMITS, ...limits });
  };

  afterEach(async () => {
    await server?.close();
    server = undefined;
    await pool?.onModuleDestroy();
  });

  /**
   * The regression case, end to end: the dronaarchery.com shell served with a
   * robots.txt and sitemap that point at a domain that is not this site.
   */
  describe('the dronaarchery.com case', () => {
    let routes: Record<string, any>;

    beforeEach(async () => {
      engine = build();
      routes = {};
      server = await startFixtureServer(routes);
      const origin = server.origin;

      const spaFor = (title: string) => ({ body: SPA_SHELL_HTML.replace('AURA | Premium Archery Academy', title) });
      Object.assign(routes, {
        '/robots.txt': {
          headers: { 'content-type': 'text/plain' },
          body: 'User-agent: *\nAllow: /\n\nSitemap: https://deonaarcheryacademy.invalid/sitemap.xml\n',
        },
        '/sitemap.xml': {
          headers: { 'content-type': 'application/xml' },
          body: `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${['/', '/about', '/archery-programs', '/gallery', '/contact']
  .map((p) => `<url><loc>https://deonaarcheryacademy.invalid${p}</loc></url>`)
  .join('\n')}
</urlset>`,
        },
        '/': spaFor('AURA | Premium Archery Academy'),
        '/about': spaFor('AURA | Premium Archery Academy'),
        '/archery-programs': spaFor('AURA | Premium Archery Academy'),
        '/gallery': spaFor('AURA | Premium Archery Academy'),
        '/contact': spaFor('AURA | Premium Archery Academy'),
        '/assets/index-DrDh8OKf.js': { headers: { 'content-type': 'application/javascript' }, body: SPA_CLIENT_BUNDLE },
        '/assets/index-CUehCp4Q.css': { headers: { 'content-type': 'text/css' }, body: 'body{margin:0}' },
      });
      void origin;
    });

    it('crawls all five pages instead of stopping at one', async () => {
      const report = await engine.crawl(server!.url('/'));

      // The old crawler found exactly one: the shell has no <a> tags, so BFS
      // had nothing to expand, and every sitemap URL was on another domain.
      expect(report.pages).toHaveLength(5);
      expect(report.pages.map((p) => new URL(p.url).pathname).sort()).toEqual([
        '/',
        '/about',
        '/archery-programs',
        '/contact',
        '/gallery',
      ]);
    });

    it('records status 200 and indexable, with the real title and word count', async () => {
      const report = await engine.crawl(server!.url('/'));
      const home = report.pages.find((p) => new URL(p.url).pathname === '/')!;

      expect(home.statusCode).toBe(200);
      expect(home.blockedSuspected).toBe(false);
      expect(home.indexability.indexability).toBe('INDEXABLE');
      expect(home.indexability.reasons).toEqual([]);
      expect(home.extracted!.title).toBe(
        'Best Archery Academy New Panvel | Archery Coaching Navi Mumbai | Drona Archery Academy',
      );
      expect(home.extracted!.titleLength).toBe(86);
      // 157, not the 156 the brief states: measured from the live production
      // bundle at /assets/index-DrDh8OKf.js, which the fixture copies verbatim.
      expect(home.extracted!.metaDescriptionLength).toBe(157);
      expect(home.extracted!.wordCount).toBeGreaterThan(400);
      expect(home.extracted!.h1).toHaveLength(2);
      expect(home.extracted!.h2).toHaveLength(7);
      expect(home.extracted!.images).toHaveLength(6);
      expect(home.extracted!.images.filter((i) => !i.alt)).toHaveLength(0);
      expect(home.jsRequired).toBe(true);
    });

    it('finds the JSON-LD that only exists after rendering', async () => {
      const report = await engine.crawl(server!.url('/'));
      const home = report.pages.find((p) => new URL(p.url).pathname === '/')!;

      const types = home.extracted!.jsonLd.map((b: any) => b['@type']);
      expect(types).toEqual(expect.arrayContaining(['LocalBusiness', 'SportsActivityLocation', 'SportsOrganization']));
    });

    it('raises exactly the two genuine issues, and no phantom ones', async () => {
      const report = await engine.crawl(server!.url('/'));
      const ids = new Set(report.findings.map((f) => f.id));

      expect(ids).toContain('JS_RENDER_REQUIRED');
      expect(ids).toContain('SITEMAP_WRONG_DOMAIN');

      // The five findings the old engine produced from a phantom 403.
      expect(ids).not.toContain('MISSING_TITLE');
      expect(ids).not.toContain('MISSING_META_DESCRIPTION');
      expect(ids).not.toContain('MISSING_H1');
      expect(ids).not.toContain('BROKEN_PAGE_4XX');
      expect(ids).not.toContain('FETCH_FAILED');
      expect(ids).not.toContain('MISSING_ALT_TEXT');
    });

    it('reports one consistent summary rather than two disagreeing counts', async () => {
      const report = await engine.crawl(server!.url('/'));

      expect(report.summary.pagesCrawled).toBe(5);
      expect(report.summary.successful).toBe(5);
      expect(report.summary.blocked).toBe(0);
      expect(report.summary.errored).toBe(0);
      expect(report.summary.unreachable).toBe(0);
      expect(report.summary.indexable).toBe(5);
      expect(report.summary.indexablePercent).toBe(100);
      expect(report.summary.crawlablePercent).toBe(100);
      expect(report.summary.jsRequiredPages).toBe(5);
      expect(report.summary.coreWebVitals.status).toBe('No data');
    });
  });

  it('walks a site whose pages the origin serves complete', async () => {
    engine = build();
    const routes: Record<string, any> = {};
    server = await startFixtureServer(routes);
    Object.assign(routes, {
      '/': { body: staticPage({ title: 'Home page of an ordinary site', links: ['/a', '/b'] }) },
      '/a': { body: staticPage({ title: 'Page A of an ordinary site', links: ['/'] }) },
      '/b': { body: staticPage({ title: 'Page B of an ordinary site', links: ['/a'] }) },
    });

    const report = await engine.crawl(server.url('/'));

    expect(report.pages).toHaveLength(3);
    expect(report.renderedPages).toBe(0);
    expect(report.findings.map((f) => f.id)).not.toContain('JS_RENDER_REQUIRED');
  });

  it('detects two URLs serving identical content as one duplicate cluster', async () => {
    engine = build();
    const routes: Record<string, any> = {};
    server = await startFixtureServer(routes);
    const page = staticPage({ title: 'The very same page, twice over', links: ['/copy'] });
    Object.assign(routes, { '/': page && { body: page }, '/copy': { body: page } });

    const report = await engine.crawl(server.url('/'));

    expect(report.duplicateClusters).toHaveLength(1);
    expect(report.duplicateClusters[0].urls).toHaveLength(2);
    const duplicateFindings = report.findings.filter((f) => f.id === 'DUPLICATE_CONTENT');
    expect(duplicateFindings).toHaveLength(1);
    // Not reported twice as thin content.
    expect(report.findings.filter((f) => f.id === 'THIN_CONTENT')).toHaveLength(0);
  });

  it('stops an infinite calendar trap at the page ceiling', async () => {
    engine = build({ maxPages: 12, maxDepth: 50, concurrency: 3 });
    server = await startFixtureServer({
      '*': {
        handler: (req, res) => {
          // Every page links to the next month, forever.
          const n = Number((req.url || '/1').replace(/\D/g, '')) || 1;
          res.writeHead(200, { 'content-type': 'text/html' });
          res.end(staticPage({ title: `Calendar month ${n} of an endless series`, links: [`/month/${n + 1}`] }));
        },
      },
    });

    const report = await engine.crawl(server.url('/month/1'));

    expect(report.pages.length).toBeLessThanOrEqual(12);
    expect(report.stoppedBecause).toBe('MAX_PAGES');
  });

  it('stops an infinite trap at the depth limit even with pages to spare', async () => {
    engine = build({ maxPages: 500, maxDepth: 4, concurrency: 1 });
    server = await startFixtureServer({
      '*': {
        handler: (req, res) => {
          const n = Number((req.url || '/1').replace(/\D/g, '')) || 1;
          res.writeHead(200, { 'content-type': 'text/html' });
          res.end(staticPage({ title: `Calendar month ${n} of an endless series`, links: [`/month/${n + 1}`] }));
        },
      },
    });

    const report = await engine.crawl(server.url('/month/1'));

    expect(report.pages.length).toBeLessThanOrEqual(5);
    expect(report.stoppedBecause).toBe('FRONTIER_EMPTY');
  });

  it('honours robots.txt for our token, and says which rule applied', async () => {
    engine = build();
    const routes: Record<string, any> = {};
    server = await startFixtureServer(routes);
    Object.assign(routes, {
      '/robots.txt': {
        headers: { 'content-type': 'text/plain' },
        body: 'User-agent: *\nAllow: /\n\nUser-agent: GrowthXBot\nDisallow: /private\n',
      },
      '/': { body: staticPage({ title: 'Home page of an ordinary site', links: ['/private'] }) },
      '/private': { body: staticPage({ title: 'A private page not for crawlers' }) },
    });

    const report = await engine.crawl(server.url('/'));
    const priv = report.pages.find((p) => p.url.endsWith('/private'));

    expect(priv!.indexability.indexability).toBe('NOT_INDEXABLE');
    expect(priv!.indexability.reasons[0].code).toBe('ROBOTS_TXT_DISALLOW');
    expect(priv!.indexability.reasons[0].evidence).toContain('Disallow: /private');
  });

  it('marks a page noindex from an X-Robots-Tag header alone', async () => {
    engine = build();
    const routes: Record<string, any> = {};
    server = await startFixtureServer(routes);
    Object.assign(routes, {
      '/': { headers: { 'x-robots-tag': 'noindex' }, body: staticPage({ title: 'A page hidden by a response header', links: [] }) },
    });

    const report = await engine.crawl(server.url('/'));

    expect(report.pages[0].indexability.indexability).toBe('NOT_INDEXABLE');
    expect(report.pages[0].indexability.reasons[0].code).toBe('X_ROBOTS_TAG_NOINDEX');
    expect(report.summary.nonIndexable).toBe(1);
  });

  it('marks a page with a cross-domain canonical not indexable', async () => {
    engine = build();
    const routes: Record<string, any> = {};
    server = await startFixtureServer(routes);
    Object.assign(routes, {
      '/': { body: staticPage({ title: 'A page crediting another domain', canonical: 'https://somewhere-else.example/page', links: [] }) },
    });

    const report = await engine.crawl(server.url('/'));

    expect(report.pages[0].indexability.indexability).toBe('NOT_INDEXABLE');
    const finding = report.findings.find((f) => f.id === 'CANONICAL_POINTS_ELSEWHERE')!;
    expect(finding.severity).toBe('CRITICAL');
  });

  it('reports sitemap URLs that 404 as dead sitemap entries', async () => {
    engine = build();
    const routes: Record<string, any> = {};
    server = await startFixtureServer(routes);
    const origin = server.origin;
    Object.assign(routes, {
      '/robots.txt': { headers: { 'content-type': 'text/plain' }, body: `Sitemap: ${origin}/sitemap.xml\n` },
      '/sitemap.xml': {
        headers: { 'content-type': 'application/xml' },
        body: `<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<url><loc>${origin}/</loc></url><url><loc>${origin}/gone</loc></url></urlset>`,
      },
      '/': { body: staticPage({ title: 'Home page of an ordinary site', links: [] }) },
      '/gone': { status: 404, body: 'Not found' },
    });

    const report = await engine.crawl(server.url('/'));

    const finding = report.findings.find((f) => f.id === 'SITEMAP_DEAD_URLS')!;
    expect(finding).toBeDefined();
    expect(finding.evidence).toContain('/gone - HTTP 404');
  });

  it('records a redirect chain as one page with zero errors', async () => {
    engine = build();
    const routes: Record<string, any> = {};
    server = await startFixtureServer(routes);
    Object.assign(routes, {
      '/start': { status: 301, headers: { location: '/middle' } },
      '/middle': { status: 301, headers: { location: '/end' } },
      '/end': { body: staticPage({ title: 'The page at the end of the chain', links: [] }) },
    });

    const report = await engine.crawl(server.url('/start'));

    expect(report.summary.errored).toBe(0);
    expect(report.pages[0].statusCode).toBe(200);
    expect(report.pages[0].statusChain.map((h) => h.status)).toEqual([301, 301, 200]);
  });
});
