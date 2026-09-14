import { DiscoveryService } from './discovery.service';
import { parseRobotsTxt, isAllowedByRobots } from './robots-txt';
import { startFixtureServer, FixtureServer, gzip } from '../testing/fixture-server';

function urlset(locs: string[]): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${locs.map((loc) => `  <url><loc>${loc}</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>`).join('\n')}
</urlset>`;
}

function sitemapIndex(children: string[]): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${children.map((loc) => `  <sitemap><loc>${loc}</loc></sitemap>`).join('\n')}
</sitemapindex>`;
}

describe('DiscoveryService', () => {
  let discovery: DiscoveryService;
  let server: FixtureServer | undefined;

  beforeEach(() => {
    discovery = new DiscoveryService();
  });

  afterEach(async () => {
    await server?.close();
    server = undefined;
  });

  describe('a sitemap pointing at a foreign, non-resolving domain', () => {
    // dronaarchery.com exactly: robots.txt declares a sitemap on
    // deonaarcheryacademy.com, and every URL in it is on that domain.
    beforeEach(async () => {
      server = await startFixtureServer({
        '/robots.txt': {
          headers: { 'content-type': 'text/plain' },
          body: 'User-agent: *\nAllow: /\n\nSitemap: https://deonaarcheryacademy.invalid/sitemap.xml\n',
        },
        '/sitemap.xml': {
          headers: { 'content-type': 'application/xml' },
          body: urlset([
            'https://deonaarcheryacademy.invalid/',
            'https://deonaarcheryacademy.invalid/about',
            'https://deonaarcheryacademy.invalid/archery-programs',
            'https://deonaarcheryacademy.invalid/gallery',
            'https://deonaarcheryacademy.invalid/contact',
          ]),
        },
      });
    });

    it('flags the declared sitemap as foreign without waiting for the fetch to fail', async () => {
      const result = await discovery.discoverSeeds(server!.url('/'));

      const declared = result.findings.find(
        (f) => f.kind === 'WRONG_DOMAIN' && f.sitemapUrl === 'https://deonaarcheryacademy.invalid/sitemap.xml',
      );
      expect(declared).toBeDefined();
      expect(declared!.evidence).toContain('robots.txt');
      expect(declared!.foreignDomain).toBe('deonaarcheryacademy.invalid');
    });

    it('raises a wrong-domain finding naming the domain and the URLs', async () => {
      const result = await discovery.discoverSeeds(server!.url('/'));

      const finding = result.findings.find((f) => f.kind === 'WRONG_DOMAIN' && f.sampleUrls!.length === 5);
      expect(finding).toBeDefined();
      expect(finding!.foreignDomain).toBe('deonaarcheryacademy.invalid');
      expect(finding!.sampleUrls).toHaveLength(5);
      expect(finding!.evidence).toContain('5 of 5 URLs');
    });

    it('keeps the foreign URLs out of the frontier rather than enqueueing five dead seeds', async () => {
      const result = await discovery.discoverSeeds(server!.url('/'));

      expect(result.urls.filter((u) => u.source === 'sitemap')).toHaveLength(0);
      expect(result.foreignSitemapUrls).toHaveLength(5);
      // The crawl does not end here: the start URL is always a seed.
      expect(result.urls.map((u) => u.source)).toContain('seed');
    });
  });

  it('follows a nested sitemap index down to a gzipped child', async () => {
    const pending: Record<string, any> = {};
    server = await startFixtureServer(pending);
    const origin = server.origin;

    Object.assign(pending, {
      '/robots.txt': { headers: { 'content-type': 'text/plain' }, body: `Sitemap: ${origin}/sitemap.xml\n` },
      '/sitemap.xml': { headers: { 'content-type': 'application/xml' }, body: sitemapIndex([`${origin}/nested-index.xml`]) },
      '/nested-index.xml': { headers: { 'content-type': 'application/xml' }, body: sitemapIndex([`${origin}/pages.xml.gz`]) },
      '/pages.xml.gz': {
        headers: { 'content-type': 'application/octet-stream' },
        body: gzip(urlset([`${origin}/deep-a`, `${origin}/deep-b`])),
      },
    });

    const result = await discovery.discoverSeeds(server.url('/'));

    const fromSitemap = result.urls.filter((u) => u.source === 'sitemap').map((u) => u.normalizedUrl);
    expect(fromSitemap).toEqual(expect.arrayContaining([`${origin}/deep-a`, `${origin}/deep-b`]));
    expect(result.sitemapsFetched).toContain(`${origin}/pages.xml.gz`);
  });

  it('stops descending past the configured index depth', async () => {
    const pending: Record<string, any> = {};
    server = await startFixtureServer(pending);
    const origin = server.origin;
    Object.assign(pending, {
      '/sitemap.xml': { headers: { 'content-type': 'application/xml' }, body: sitemapIndex([`${origin}/l1.xml`]) },
      '/l1.xml': { headers: { 'content-type': 'application/xml' }, body: sitemapIndex([`${origin}/l2.xml`]) },
      '/l2.xml': { headers: { 'content-type': 'application/xml' }, body: urlset([`${origin}/too-deep`]) },
    });

    const result = await discovery.discoverSeeds(server.url('/'), { maxIndexDepth: 1 });

    expect(result.urls.map((u) => u.normalizedUrl)).not.toContain(`${origin}/too-deep`);
  });

  it('picks up hreflang alternates declared in a sitemap', async () => {
    const pending: Record<string, any> = {};
    server = await startFixtureServer(pending);
    const origin = server.origin;
    Object.assign(pending, {
      '/sitemap.xml': {
        headers: { 'content-type': 'application/xml' },
        body: `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
  <url>
    <loc>${origin}/en/page</loc>
    <xhtml:link rel="alternate" hreflang="fr" href="${origin}/fr/page"/>
    <xhtml:link rel="alternate" hreflang="de" href="${origin}/de/page"/>
  </url>
</urlset>`,
      },
    });

    const result = await discovery.discoverSeeds(server.url('/'));

    const urls = result.urls.map((u) => u.normalizedUrl);
    expect(urls).toEqual(expect.arrayContaining([`${origin}/en/page`, `${origin}/fr/page`, `${origin}/de/page`]));
    expect(result.sitemapEntries[0].alternates).toHaveLength(2);
  });

  it('falls back to conventional sitemap paths when robots.txt declares none', async () => {
    const pending: Record<string, any> = {};
    server = await startFixtureServer(pending);
    const origin = server.origin;
    Object.assign(pending, {
      '/robots.txt': { headers: { 'content-type': 'text/plain' }, body: 'User-agent: *\nAllow: /\n' },
      '/sitemap.xml': { status: 404, body: 'nope' },
      '/wp-sitemap.xml': { headers: { 'content-type': 'application/xml' }, body: urlset([`${origin}/wp-page`]) },
    });

    const result = await discovery.discoverSeeds(server.url('/'));

    expect(result.urls.map((u) => u.normalizedUrl)).toContain(`${origin}/wp-page`);
  });

  it('reports a sitemap that answers 200 with something that is not XML', async () => {
    // A host that serves its homepage for every path, which is common and
    // otherwise reads as "a sitemap with no URLs in it".
    server = await startFixtureServer({
      '*': { body: '<!doctype html><html><body>Homepage for every path</body></html>' },
    });

    const result = await discovery.discoverSeeds(server.url('/'));

    expect(result.findings.some((f) => f.kind === 'NOT_A_SITEMAP')).toBe(true);
    expect(result.urls.filter((u) => u.source === 'sitemap')).toHaveLength(0);
  });

  it('extracts rendered links, ignoring mailto, tel and off-site hrefs', () => {
    const html = `<html><body>
      <a href="/about">About</a>
      <a href="/contact/">Contact</a>
      <a href="mailto:hi@example.com">Mail</a>
      <a href="tel:+919699414848">Call</a>
      <a href="https://instagram.com/x">Instagram</a>
      <link rel="next" href="/page/2">
    </body></html>`;

    const links = new DiscoveryService().extractLinks(html, 'https://www.example.com/');

    expect(links.map((l) => l.normalizedUrl).sort()).toEqual([
      'https://www.example.com/about',
      'https://www.example.com/contact',
      'https://www.example.com/page/2',
    ]);
  });
});

describe('robots.txt precedence', () => {
  it('applies our own token group over the wildcard group', () => {
    const robots = parseRobotsTxt(['User-agent: *', 'Disallow: /', '', 'User-agent: GrowthXBot', 'Allow: /'].join('\n'));

    expect(isAllowedByRobots(robots, 'GrowthXBot', 'https://e.com/anything').allowed).toBe(true);
    expect(isAllowedByRobots(robots, 'SomeoneElse', 'https://e.com/anything').allowed).toBe(false);
  });

  it('applies the reverse too: allowed for everyone, disallowed for us', () => {
    const robots = parseRobotsTxt(['User-agent: *', 'Allow: /', '', 'User-agent: GrowthXBot', 'Disallow: /'].join('\n'));

    expect(isAllowedByRobots(robots, 'GrowthXBot', 'https://e.com/anything').allowed).toBe(false);
    expect(isAllowedByRobots(robots, 'Other', 'https://e.com/anything').allowed).toBe(true);
  });

  it('lets the longest matching rule win regardless of file order', () => {
    const robots = parseRobotsTxt(['User-agent: *', 'Disallow: /admin', 'Allow: /admin/public'].join('\n'));

    expect(isAllowedByRobots(robots, 'GrowthXBot', 'https://e.com/admin/secret').allowed).toBe(false);
    expect(isAllowedByRobots(robots, 'GrowthXBot', 'https://e.com/admin/public/page').allowed).toBe(true);
  });

  it('does not let one bot token match another by substring', () => {
    // "Bot" must not select the group written for "GrowthXBot", nor the reverse.
    const robots = parseRobotsTxt(['User-agent: Bot', 'Disallow: /', '', 'User-agent: *', 'Allow: /'].join('\n'));

    expect(isAllowedByRobots(robots, 'GrowthXBot', 'https://e.com/x').allowed).toBe(true);
  });

  it('shares one group across consecutive user-agent lines', () => {
    const robots = parseRobotsTxt(['User-agent: AdsBot', 'User-agent: GrowthXBot', 'Disallow: /private'].join('\n'));

    expect(isAllowedByRobots(robots, 'GrowthXBot', 'https://e.com/private/x').allowed).toBe(false);
  });

  it('treats a bare Disallow as an explicit allow-all', () => {
    const robots = parseRobotsTxt(['User-agent: *', 'Disallow:'].join('\n'));

    expect(isAllowedByRobots(robots, 'GrowthXBot', 'https://e.com/x').allowed).toBe(true);
  });

  it('honours a terminating $ and a wildcard', () => {
    const robots = parseRobotsTxt(['User-agent: *', 'Disallow: /*.pdf$'].join('\n'));

    expect(isAllowedByRobots(robots, 'GrowthXBot', 'https://e.com/a/b.pdf').allowed).toBe(false);
    expect(isAllowedByRobots(robots, 'GrowthXBot', 'https://e.com/a/b.pdf?x=1').allowed).toBe(true);
  });

  it('collects every Sitemap directive, not just the first', () => {
    const robots = parseRobotsTxt(['Sitemap: https://e.com/a.xml', 'User-agent: *', 'Allow: /', 'Sitemap: https://e.com/b.xml'].join('\n'));

    expect(robots.sitemaps).toEqual(['https://e.com/a.xml', 'https://e.com/b.xml']);
  });
});
