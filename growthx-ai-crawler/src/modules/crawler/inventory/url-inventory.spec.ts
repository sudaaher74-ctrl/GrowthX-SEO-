import { summariseInventory, InventoryRow } from './url-inventory.service';
import { normalizeUrl } from '../url/url-normalizer';

const row = (over: Partial<InventoryRow> & { url: string }): InventoryRow => ({
  normalizedUrl: normalizeUrl(over.url),
  state: 'DONE',
  reason: null,
  sources: ['sitemap'],
  discoverySource: 'sitemap',
  httpStatus: 200,
  indexability: 'INDEXABLE',
  canonicalUrl: null,
  redirectTarget: null,
  rendered: false,
  queuedAt: new Date(),
  crawledAt: new Date(),
  ...over,
});

describe('URL inventory reconciliation', () => {
  // A. The headline case: more discovered than crawled.
  it('A. reports coverage against discovered URLs, not crawled ones', () => {
    const rows = [
      ...Array.from({ length: 32 }, (_, i) => row({ url: `https://s.in/c${i}` })),
      ...Array.from({ length: 26 }, (_, i) =>
        row({ url: `https://s.in/n${i}`, state: 'PENDING', reason: 'queued', httpStatus: null, indexability: null, crawledAt: null }),
      ),
    ];

    const m = summariseInventory(rows);
    expect(m.urlsDiscovered).toBe(58);
    expect(m.urlsCrawled).toBe(32);
    expect(m.notCrawled).toBe(26);
    expect(Math.round((m.urlsCrawled / m.urlsDiscovered) * 1000) / 10).toBe(55.2);
  });

  it('the books always balance', () => {
    const rows = [
      row({ url: 'https://s.in/a' }),
      row({ url: 'https://s.in/b', state: 'PENDING', reason: 'queued', crawledAt: null }),
      row({ url: 'https://s.in/c', state: 'SKIPPED', reason: 'robots_blocked', crawledAt: null }),
      row({ url: 'https://s.in/d', state: 'FAILED', reason: 'timeout', crawledAt: null }),
    ];
    const m = summariseInventory(rows);
    expect(m.urlsCrawled + m.notCrawled).toBe(m.urlsDiscovered);
    // Every uncrawled URL is accounted for by exactly one reason.
    const reasonTotal = Object.values(m.notCrawledReasons).reduce((a, b) => a + b, 0);
    expect(reasonTotal).toBe(m.notCrawled);
  });

  // B + C. One URL, however many times and ways it is found.
  it('B/C. keeps a URL found by several sources as one URL with several sources', () => {
    const rows = [
      row({ url: 'https://s.in/products', sources: ['sitemap', 'internal_link', 'javascript_dom'] }),
      row({ url: 'https://s.in/about', sources: ['sitemap'] }),
      row({ url: 'https://s.in/hidden', sources: ['javascript_dom'], discoverySource: 'javascript_dom' }),
    ];
    const m = summariseInventory(rows);

    expect(m.urlsDiscovered).toBe(3);
    expect(m.bySource).toEqual({ sitemap: 2, internal_link: 1, javascript_dom: 2 });
    // The per-source tallies overlap by design and must not be summed.
    expect(Object.values(m.bySource).reduce((a, b) => a + b, 0)).toBeGreaterThan(m.urlsDiscovered);
    expect(m.multiSourceUrls).toBe(1);
  });

  // D. A canonical never deletes the page that declared it.
  it('D. keeps a canonicalized URL in the inventory under its own spelling', () => {
    const rows = [
      row({ url: 'https://s.in/page-a', canonicalUrl: 'https://s.in/page-b' }),
      row({ url: 'https://s.in/page-b', canonicalUrl: 'https://s.in/page-b' }),
    ];
    const m = summariseInventory(rows);
    expect(m.urlsDiscovered).toBe(2);
    expect(m.urlsCrawled).toBe(2);
    expect(m.canonicalized).toBe(1);
  });

  // E. A redirect is a crawl result, not a disappearance.
  it('E. keeps both sides of a redirect', () => {
    const rows = [
      row({ url: 'https://s.in/old', httpStatus: 301, indexability: 'NOT_INDEXABLE', redirectTarget: 'https://s.in/new' }),
      row({ url: 'https://s.in/new', httpStatus: 200 }),
    ];
    const m = summariseInventory(rows);
    expect(m.urlsDiscovered).toBe(2);
    expect(m.redirects).toBe(1);
    expect(m.statusBuckets.redirect).toBe(1);
    expect(m.statusBuckets.ok).toBe(1);
  });

  // F. Robots exclusions stay visible.
  it('F. keeps a robots-blocked URL discovered, excluded and explained', () => {
    const rows = [
      row({ url: 'https://s.in/admin', state: 'SKIPPED', reason: 'robots_blocked', httpStatus: null, indexability: null, crawledAt: null }),
    ];
    const m = summariseInventory(rows);
    expect(m.urlsDiscovered).toBe(1);
    expect(m.urlsCrawled).toBe(0);
    expect(m.excluded).toBe(1);
    expect(m.notCrawledReasons.robots_blocked).toBe(1);
    expect(m.discoveredNotCrawled[0]).toEqual({
      url: 'https://s.in/admin',
      reason: 'robots_blocked',
      sources: ['sitemap'],
    });
  });

  it('never leaves an uncrawled URL without a reason', () => {
    const rows = [row({ url: 'https://s.in/x', state: 'PENDING', reason: null, crawledAt: null })];
    const m = summariseInventory(rows);
    expect(m.notCrawledReasons.queued).toBe(1);
    expect(m.discoveredNotCrawled[0].reason).toBe('queued');
  });

  it('counts a queue failure as a visible URL rather than a missing one', () => {
    const rows = [
      row({ url: 'https://s.in/a' }),
      row({ url: 'https://s.in/lost', state: 'FAILED', reason: 'queue_failed', queuedAt: null, crawledAt: null }),
    ];
    const m = summariseInventory(rows);
    expect(m.urlsDiscovered).toBe(2);
    expect(m.notCrawledReasons.queue_failed).toBe(1);
    expect(m.urlsQueued).toBe(1);
  });

  it('does not call a 200 indexable on its own', () => {
    const rows = [
      row({ url: 'https://s.in/a', httpStatus: 200, indexability: 'NOT_INDEXABLE' }),
      row({ url: 'https://s.in/b', httpStatus: 200, indexability: 'INDEXABLE' }),
      row({ url: 'https://s.in/c', httpStatus: 200, indexability: 'UNKNOWN' }),
    ];
    const m = summariseInventory(rows);
    expect(m.statusBuckets.ok).toBe(3);
    expect(m.indexable).toBe(1);
    expect(m.nonIndexable).toBe(1);
  });

  it('separates a fetch that got no response from one that got a 404', () => {
    const rows = [
      row({ url: 'https://s.in/a', httpStatus: 0 }),
      row({ url: 'https://s.in/b', httpStatus: 404 }),
      row({ url: 'https://s.in/c', httpStatus: 503 }),
    ];
    const m = summariseInventory(rows);
    expect(m.statusBuckets.noResponse).toBe(1);
    expect(m.statusBuckets.clientError).toBe(1);
    expect(m.statusBuckets.serverError).toBe(1);
  });

  it('counts rendered pages only where the render tier actually ran', () => {
    const rows = [
      row({ url: 'https://s.in/a', rendered: true }),
      row({ url: 'https://s.in/b', rendered: false }),
    ];
    expect(summariseInventory(rows).renderedPages).toBe(1);
  });
});

// H, I, J: normalization is the inventory's dedup key, so these are the rules
// that decide whether two spellings are one row.
describe('normalization as the inventory key', () => {
  it('H. resolves relative links against the page that carried them', () => {
    expect(normalizeUrl('../contact', { base: 'https://milquufresh.in/blog/post' })).toBe('https://milquufresh.in/contact');
    expect(normalizeUrl('/about', { base: 'https://milquufresh.in/x' })).toBe('https://milquufresh.in/about');
  });

  it('H. folds trailing slash, host casing and fragments into one key', () => {
    const a = normalizeUrl('https://milquufresh.in/about');
    expect(normalizeUrl('https://milquufresh.in/about/')).toBe(a);
    expect(normalizeUrl('https://MILQUUFRESH.IN/about#section')).toBe(a);
    expect(normalizeUrl('https://milquufresh.in:443/about')).toBe(a);
  });

  it('I. strips tracking parameters but keeps the ones that select the page', () => {
    expect(normalizeUrl('https://s.in/p?utm_source=x&gclid=y&fbclid=z')).toBe('https://s.in/p');
    expect(normalizeUrl('https://s.in/p?page=2')).toBe('https://s.in/p?page=2');
    // Order must not create a second URL.
    expect(normalizeUrl('https://s.in/p?b=2&a=1')).toBe(normalizeUrl('https://s.in/p?a=1&b=2'));
  });

  it('refuses non-page schemes outright', () => {
    for (const href of ['mailto:a@b.com', 'tel:+911234567890', 'javascript:void(0)', '#top']) {
      expect(normalizeUrl(href)).toBe('');
    }
  });
});
