import { classifyHtmlResponse, isHtmlResponse } from './html-response';

describe('isHtmlResponse', () => {
  it('recognises an HTML page whatever it was labelled', () => {
    expect(isHtmlResponse('<!DOCTYPE html><html><body>Hi</body></html>', 'application/xml')).toBe(true);
    expect(isHtmlResponse('\uFEFF  <html lang="en"><head></head></html>')).toBe(true);
    expect(isHtmlResponse('<!-- theme v2 --><!doctype html><html></html>')).toBe(true);
    expect(isHtmlResponse('<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml"></html>')).toBe(true);
  });

  it('never mistakes a sitemap for HTML, even one served as text/html', () => {
    const urlset = '<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://e.com/</loc></url></urlset>';
    const index = '<sitemapindex><sitemap><loc>https://e.com/a.xml</loc></sitemap></sitemapindex>';

    expect(isHtmlResponse(urlset, 'text/html')).toBe(false);
    expect(isHtmlResponse(index, 'text/html; charset=utf-8')).toBe(false);
  });

  it('leaves plain text alone, so robots.txt and malformed XML are not called HTML', () => {
    expect(isHtmlResponse('User-agent: *\nDisallow: /admin', 'text/plain')).toBe(false);
    expect(isHtmlResponse('<rss><channel></channel></rss>', 'application/xml')).toBe(false);
    expect(isHtmlResponse('', 'text/html')).toBe(false);
  });

  it('uses the header only to settle a fragment with no document element', () => {
    expect(isHtmlResponse('<div>Page not found</div>', 'text/html')).toBe(true);
    expect(isHtmlResponse('<div>Page not found</div>', 'application/xml')).toBe(false);
  });
});

describe('classifyHtmlResponse', () => {
  it('names the common bot-protection pages as challenges', () => {
    expect(classifyHtmlResponse('<html><head><title>Just a moment...</title></head></html>')).toBe('bot-challenge');
    expect(classifyHtmlResponse('<html><head><title>Attention Required! | Cloudflare</title></head></html>')).toBe('bot-challenge');
    expect(classifyHtmlResponse('<html><body>Sucuri WebSite Firewall - Access Denied</body></html>')).toBe('bot-challenge');
  });

  it('calls anything else an ordinary page', () => {
    expect(classifyHtmlResponse('<html><head><title>Page not found</title></head></html>')).toBe('html-page');
  });
});
