import { canonicalUrl } from './canonical-url';

/**
 * This is the answer to "is this the same page?" everywhere in the product:
 * deduplicating a crawl, counting coverage, and diffing one crawl against the
 * next. Both directions are dangerous. Missing a duplicate inflates a count;
 * merging two real pages deletes one from every count silently, and the diff
 * then reports it as removed.
 */
describe('canonicalUrl', () => {
  it('collapses the ways a site links to one of its own pages', () => {
    const same = [
      'https://example.com/about',
      'https://www.example.com/about',
      'http://example.com/about',
      'https://EXAMPLE.com/about',
      'https://www.example.com/about/',
    ];
    expect(new Set(same.map(canonicalUrl)).size).toBe(1);
    expect(canonicalUrl(same[0])).toBe('example.com/about');
  });

  it('keeps the home page distinct from the host', () => {
    expect(canonicalUrl('https://example.com/')).toBe('example.com');
    expect(canonicalUrl('https://example.com')).toBe('example.com');
  });

  it('does not merge pages that really differ', () => {
    // A subdomain is a different site; a query string is often the whole page.
    const distinct = [
      'https://example.com/a',
      'https://example.com/b',
      'https://shop.example.com/a',
      'https://example.com/a?page=2',
      'https://example.com/a/b',
    ];
    expect(new Set(distinct.map(canonicalUrl)).size).toBe(distinct.length);
  });

  it('leaves a malformed URL as its own identity', () => {
    // Collapsing several unparseable URLs into one would delete pages from
    // every count without a trace.
    expect(canonicalUrl('not a url')).toBe('not a url');
    expect(canonicalUrl('also not a url')).not.toBe(canonicalUrl('not a url'));
  });
});
