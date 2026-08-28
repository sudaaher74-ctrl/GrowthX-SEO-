import { isCrawlablePage, isHtmlResponse } from './crawlable';

/**
 * Found on the first competitor crawled: 76 of 92 stored "pages" were images
 * and PDFs. Three faults at once — 74 media files pulled off a third party's
 * server, every count six times too large, and topic matching silently broken
 * because the site's own name fell below the frequency threshold that marks a
 * word as boilerplate. The visible symptom was a recommendation to write a
 * page about "mangopulp", which is a JPEG filename.
 */
describe('isCrawlablePage', () => {
  it('refuses the files that filled that crawl', () => {
    // Every one of these is a real URL the crawler fetched and stored.
    expect(isCrawlablePage('https://indianfruitspulp.com/wp-content/uploads/2026/03/mangopulp-1.jpg')).toBe(false);
    expect(isCrawlablePage('https://indianfruitspulp.com/wp-content/uploads/2025/03/FSSAI-New-License-2025.pdf')).toBe(false);
    expect(isCrawlablePage('https://indianfruitspulp.com/wp-content/uploads/2024/01/13.jpg')).toBe(false);
  });

  it('accepts the pages that actually matter', () => {
    expect(isCrawlablePage('https://indianfruitspulp.com/mango-pulp')).toBe(true);
    expect(isCrawlablePage('https://indianfruitspulp.com/our-products/')).toBe(true);
    expect(isCrawlablePage('https://example.com/')).toBe(true);
  });

  it('accepts a page with an HTML-ish extension', () => {
    expect(isCrawlablePage('https://example.com/about.html')).toBe(true);
    expect(isCrawlablePage('https://example.com/index.php')).toBe(true);
    expect(isCrawlablePage('https://example.com/page.aspx')).toBe(true);
  });

  it('is an exclusion list, not an allowlist', () => {
    // Most real pages have no extension at all, so an allowlist of page
    // extensions would drop the majority of a normal site.
    expect(isCrawlablePage('https://example.com/services/kitchens')).toBe(true);
    expect(isCrawlablePage('https://example.com/2026/08/some-post')).toBe(true);
  });

  it('ignores a query string when reading the extension', () => {
    expect(isCrawlablePage('https://example.com/photo.jpg?v=2')).toBe(false);
    expect(isCrawlablePage('https://example.com/search?q=file.pdf')).toBe(true);
  });

  it('does not choke on a malformed URL', () => {
    expect(isCrawlablePage('not a url')).toBe(true);
    expect(isCrawlablePage('/relative/path.png')).toBe(false);
  });
});

describe('isHtmlResponse', () => {
  it('accepts HTML', () => {
    expect(isHtmlResponse('text/html')).toBe(true);
    expect(isHtmlResponse('text/html; charset=utf-8')).toBe(true);
    expect(isHtmlResponse('application/xhtml+xml')).toBe(true);
  });

  it('refuses what is not a page', () => {
    expect(isHtmlResponse('image/jpeg')).toBe(false);
    expect(isHtmlResponse('application/pdf')).toBe(false);
    expect(isHtmlResponse('application/json')).toBe(false);
  });

  it('treats a missing content type as HTML', () => {
    // Some servers omit it. Discarding a real page because a header was
    // absent is the worse of the two errors.
    expect(isHtmlResponse(null)).toBe(true);
    expect(isHtmlResponse(undefined)).toBe(true);
  });
});
