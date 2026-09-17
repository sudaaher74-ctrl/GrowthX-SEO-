import { CrawlerService } from './crawler.service';
import { DiscoveryService } from './discovery/discovery.service';

/**
 * Why "JavaScript DOM: 0" was not a measurement.
 *
 * milquufresh.in serves a 2KB Vite shell — `<div id="root"></div>`, two script
 * tags and no anchors at all. Every internal link on the site exists only after
 * its JavaScript runs. The crawler does render, and did find those links, but
 * attributed every one of them to `link` regardless of which body they came
 * from, so the dashboard's JavaScript DOM row could only ever report 0. That
 * reads as "we rendered and found nothing", which is the opposite of the truth.
 */
describe('JavaScript DOM discovery attribution', () => {
  const discovery = new DiscoveryService();
  const service = new (CrawlerService as any)(
    {}, {}, {}, {}, {}, {}, {}, discovery, {}, {}, {}, {}, {}, {}, {}, {}, {}, {},
    { record: async () => ({ added: 0, merged: 0, invalid: 0 }), markQueued: async () => undefined,
      markCrawled: async () => undefined, markExcluded: async () => undefined, metrics: async () => null },
  );

  const pageUrl = 'https://milquufresh.in/';

  // The actual shape of the site's served HTML.
  const shell = '<!doctype html><html><head><title>Milquu</title></head><body><div id="root"></div><script type="module" src="/assets/index.js"></script></body></html>';

  const rendered = `<!doctype html><html><body><div id="root">
      <nav><a href="/products">Products</a><a href="/about-us">About</a></nav>
      <footer><a href="/contact">Contact</a></footer>
    </div></body></html>`;

  it('credits links that exist only after rendering to the DOM, not to static links', () => {
    const jsOnly = service.linksOnlyInRenderedDom({ tier: 'rendered', rawHtml: shell, renderedHtml: rendered }, pageUrl);

    expect(jsOnly.size).toBe(3);
    expect([...jsOnly].sort()).toEqual([
      'https://milquufresh.in/about-us',
      'https://milquufresh.in/contact',
      'https://milquufresh.in/products',
    ]);
  });

  it('does not credit a link that was already in the served HTML', () => {
    const raw = '<html><body><a href="/products">Products</a></body></html>';
    const withExtra = '<html><body><a href="/products">Products</a><a href="/blog">Blog</a></body></html>';

    const jsOnly = service.linksOnlyInRenderedDom({ tier: 'rendered', rawHtml: raw, renderedHtml: withExtra }, pageUrl);

    expect([...jsOnly]).toEqual(['https://milquufresh.in/blog']);
  });

  it('claims nothing when the render tier never ran', () => {
    // No render means no evidence either way. An empty set here is what lets
    // the UI say "Not scanned" instead of printing a zero it cannot support.
    expect(service.linksOnlyInRenderedDom({ tier: 'static', rawHtml: shell }, pageUrl).size).toBe(0);
    expect(service.linksOnlyInRenderedDom({ tier: 'rendered', rawHtml: shell }, pageUrl).size).toBe(0);
  });

  it('extracts nothing from the served shell, which is the site the crawler sees', () => {
    // The premise of the whole fix: static extraction on this site yields zero.
    expect(discovery.extractLinks(shell, pageUrl)).toHaveLength(0);
    expect(discovery.extractLinks(rendered, pageUrl).length).toBe(3);
  });
});
