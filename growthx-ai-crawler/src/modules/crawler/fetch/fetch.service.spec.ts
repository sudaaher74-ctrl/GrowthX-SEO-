import { BrowserPoolService } from './browser-pool.service';
import { FetchService } from './fetch.service';
import { startFixtureServer, FixtureServer, SPA_SHELL_HTML } from '../testing/fixture-server';
import { SPA_CLIENT_BUNDLE, staticPage } from '../testing/spa-bundle';

describe('FetchService', () => {
  let pool: BrowserPoolService;
  let fetcher: FetchService;
  let server: FixtureServer | undefined;

  beforeAll(() => {
    pool = new BrowserPoolService();
    fetcher = new FetchService(pool);
  });

  afterAll(async () => {
    await pool.onModuleDestroy();
  });

  afterEach(async () => {
    await server?.close();
    server = undefined;
  });

  describe('SPA with an empty shell', () => {
    // Reproduces dronaarchery.com: an 803-byte body whose only content is
    // <div id="root">, with the title, meta description, JSON-LD, headings and
    // every link injected by JavaScript.
    beforeEach(async () => {
      server = await startFixtureServer({
        '/': { body: SPA_SHELL_HTML },
        '/assets/index-DrDh8OKf.js': { headers: { 'content-type': 'application/javascript' }, body: SPA_CLIENT_BUNDLE },
        '/assets/index-CUehCp4Q.css': { headers: { 'content-type': 'text/css' }, body: 'body{margin:0}' },
      });
    });

    it('escalates to the render tier and reads the rendered page', async () => {
      const out = await fetcher.fetch(server!.url('/'));

      expect(out.tier).toBe('rendered');
      expect(out.statusCode).toBe(200);
      expect(out.jsRequired).toBe(true);

      // The raw body is the shell; the rendered DOM is the page.
      expect(out.rawHtml.length).toBeLessThan(1000);
      expect(out.rawHtml).toContain('<div id="root">');
      expect(out.renderedHtml).toBeDefined();

      expect(out.renderDiff!.rawTitle).toBe('AURA | Premium Archery Academy');
      expect(out.renderDiff!.renderedTitle).toBe(
        'Best Archery Academy New Panvel | Archery Coaching Navi Mumbai | Drona Archery Academy',
      );
      expect(out.renderDiff!.renderedWordCount).toBeGreaterThan(400);
      expect(out.renderDiff!.rawLinkCount).toBe(0);
      expect(out.renderDiff!.renderedLinkCount).toBeGreaterThanOrEqual(10);
    });

    it('names why it escalated, with the SPA build fingerprints it saw', async () => {
      const out = await fetcher.fetch(server!.url('/'));

      expect(out.escalationReasons).toEqual(
        expect.arrayContaining(['EMPTY_BODY_TEXT', 'NO_ANCHORS', 'EMPTY_MOUNT_NODE', 'SPA_FINGERPRINT']),
      );
      expect(out.renderDiff!.fingerprints).toEqual(expect.arrayContaining(['vite-asset-bundle', 'vite-favicon']));
    });
  });

  it('does not render a page the origin already serves complete', async () => {
    server = await startFixtureServer({ '/': { body: staticPage({ title: 'Complete' }) } });

    const out = await fetcher.fetch(server!.url('/'));

    expect(out.tier).toBe('static');
    expect(out.jsRequired).toBe(false);
    expect(out.renderedHtml).toBeUndefined();
  });

  describe('a WAF that 403s a bare client', () => {
    // The origin answers 403 unless the request carries the header set a real
    // browser sends. The old fetcher sent a bare bot UA, took the 403 at face
    // value and recorded it against the page.
    beforeEach(async () => {
      server = await startFixtureServer({
        '/': {
          handler: (req, res) => {
            const ua = String(req.headers['user-agent'] || '');
            const looksLikeBrowser = /Chrome\//.test(ua) && Boolean(req.headers['sec-fetch-mode']) && Boolean(req.headers['accept-language']);
            if (!looksLikeBrowser) {
              res.writeHead(403, { 'content-type': 'text/html', server: 'test-waf' });
              res.end('<html><body>Forbidden</body></html>');
              return;
            }
            res.writeHead(200, { 'content-type': 'text/html' });
            res.end(staticPage({ title: 'Behind the WAF' }));
          },
        },
      });
    });

    it('sends browser headers and records no 403 at all', async () => {
      const out = await fetcher.fetch(server!.url('/'));

      expect(out.statusCode).toBe(200);
      expect(out.blockedSuspected).toBe(false);
      expect(out.html).toContain('Behind the WAF');
    });

    it('sends the headers a browser sends, not a bare User-Agent', async () => {
      await fetcher.fetch(server!.url('/'));

      const first = server!.requests[0];
      expect(first.userAgent).toMatch(/Chrome\//);
      expect(first.headers['accept-language']).toBeDefined();
      expect(first.headers['sec-fetch-mode']).toBe('navigate');
      expect(first.headers['upgrade-insecure-requests']).toBe('1');
    });
  });

  it('reports a persistent block as a suspicion carrying its evidence, not as a fact', async () => {
    server = await startFixtureServer({
      '/': { status: 403, headers: { server: 'cloudfront', 'cf-mitigated': 'challenge' }, body: 'blocked' },
    });

    const out = await fetcher.fetch(server!.url('/'));

    expect(out.blockedSuspected).toBe(true);
    expect(out.blockedEvidence).toContain('HTTP 403');
    expect(out.blockedEvidence).toContain('cloudfront');
    expect(out.blockedEvidence).toContain('cf-mitigated=challenge');
  });

  it('walks an apex to www to https chain hop by hop and calls it zero errors', async () => {
    // One origin standing in for three hops, since a loopback fixture cannot
    // own two hostnames; what is under test is that every hop is recorded and
    // that none of them is treated as a failure.
    server = await startFixtureServer({
      '/apex': { status: 301, headers: { location: '/www' } },
      '/www': { status: 301, headers: { location: '/www/secure' } },
      '/www/secure': { body: staticPage({ title: 'Landed' }) },
    });

    const out = await fetcher.fetch(server!.url('/apex'));

    expect(out.statusCode).toBe(200);
    expect(out.error).toBeUndefined();
    expect(out.statusChain.map((h) => h.status)).toEqual([301, 301, 200]);
    expect(out.statusChain[0].location).toBe('/www');
    expect(out.finalUrl).toBe(server!.url('/www/secure'));
  });

  it('refuses to invent a status when the transport fails', async () => {
    // A closed port on loopback: the connection is refused outright, so no
    // origin ever answers. The old fetcher wrote 500 here, and 403 for a
    // malformed URL, so a fault on our side became a fact about the site.
    const closed = await startFixtureServer({});
    const deadOrigin = closed.origin;
    await closed.close();

    const out = await fetcher.fetch(`${deadOrigin}/`);

    expect(out.statusCode).toBeUndefined();
    expect(out.tier).toBe('failed');
    expect(out.error).toBeDefined();
    expect(['dns', 'proxy', 'timeout', 'unknown']).toContain(out.error!.kind);
  });

  it('gives up on a request that never answers, as a timeout and not a status', async () => {
    server = await startFixtureServer({
      '/hang': { handler: () => { /* deliberately never responds */ } },
    });

    const out = await fetcher.fetch(server!.url('/hang'), { timeoutMs: 800 });

    expect(out.statusCode).toBeUndefined();
    expect(out.error!.kind).toBe('timeout');
  });

  it('attributes a proxy gateway error to our network, not to the site', async () => {
    // A bare 502 carrying none of the headers an origin gateway attaches, while
    // a forward proxy is configured for this process.
    const previous = process.env.HTTPS_PROXY;
    process.env.HTTPS_PROXY = 'http://127.0.0.1:1';
    try {
      server = await startFixtureServer({ '/': { status: 502, body: 'Bad Gateway' } });

      const out = await fetcher.fetch(server!.url('/'));

      expect(out.statusCode).toBeUndefined();
      expect(out.error!.kind).toBe('proxy');
    } finally {
      if (previous === undefined) delete process.env.HTTPS_PROXY;
      else process.env.HTTPS_PROXY = previous;
    }
  });

  it('still trusts a 502 that identifies itself as an origin gateway', async () => {
    const previous = process.env.HTTPS_PROXY;
    process.env.HTTPS_PROXY = 'http://127.0.0.1:1';
    try {
      server = await startFixtureServer({ '/': { status: 502, headers: { server: 'nginx/1.24.0' }, body: 'Bad Gateway' } });

      const out = await fetcher.fetch(server!.url('/'));

      expect(out.statusCode).toBe(502);
      expect(out.error).toBeUndefined();
    } finally {
      if (previous === undefined) delete process.env.HTTPS_PROXY;
      else process.env.HTTPS_PROXY = previous;
    }
  });

  it('classifies a malformed URL as our fault, never as a 403', async () => {
    const out = await fetcher.fetch('http://[not a url');

    expect(out.statusCode).toBeUndefined();
    expect(out.error!.kind).not.toBe('http');
  });

  it('stops a redirect loop instead of following it forever', async () => {
    server = await startFixtureServer({
      '/loop': { status: 302, headers: { location: '/loop' } },
    });

    const out = await fetcher.fetch(server!.url('/loop'));

    expect(out.tier).toBe('failed');
    expect(out.error!.message).toMatch(/loop/i);
  });

  it('honours a spent render budget rather than rendering anyway', async () => {
    server = await startFixtureServer({
      '/': { body: SPA_SHELL_HTML },
      '/assets/index-DrDh8OKf.js': { headers: { 'content-type': 'application/javascript' }, body: SPA_CLIENT_BUNDLE },
    });

    const out = await fetcher.fetch(server!.url('/'), { renderAllowed: false });

    expect(out.tier).toBe('static');
    expect(out.renderUnavailable).toBe(true);
    expect(out.escalationReasons.length).toBeGreaterThan(0);
  });
});
