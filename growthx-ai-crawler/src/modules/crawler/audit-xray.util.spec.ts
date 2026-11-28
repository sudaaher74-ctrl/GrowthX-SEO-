import {
  extractHtmlSnapshotSummary,
  generateLlmsTxt,
  parseAiBotsFromRobotsTxt,
} from './audit-xray.util';

describe('audit-xray.util', () => {
  it('extracts raw vs rendered HTML metrics accurately including duplicate title count', () => {
    const html = `<!doctype html><html><head>
      <title>Shell Title</title>
      <title>Product Page Title</title>
      <meta name="description" content="Fresh A2 cow milk delivered daily." />
      <link rel="canonical" href="https://example.com/products/milk" />
    </head><body>
      <h1>Pure A2 Milk</h1>
      <p>Farm fresh dairy delivered every morning across Pune.</p>
      <a href="/about">About</a>
      <a href="https://example.com/subscribe">Subscribe</a>
      <a href="https://external.org/ref">External</a>
    </body></html>`;

    const summary = extractHtmlSnapshotSummary(html, 'https://example.com/products/milk');
    expect(summary).not.toBeNull();
    expect(summary!.title).toBe('Product Page Title');
    expect(summary!.titleCount).toBe(2);
    expect(summary!.metaDescription).toBe('Fresh A2 cow milk delivered daily.');
    expect(summary!.h1).toEqual(['Pure A2 Milk']);
    expect(summary!.canonicalUrl).toBe('https://example.com/products/milk');
    expect(summary!.internalLinksCount).toBe(2);
    expect(summary!.wordCount).toBeGreaterThanOrEqual(10);
  });

  it('parses AI bot rules from robots.txt accurately', () => {
    const robots = `
      User-agent: GPTBot
      Disallow: /

      User-agent: PerplexityBot
      Allow: /

      User-agent: *
      Disallow: /admin
    `;

    const results = parseAiBotsFromRobotsTxt(robots);
    const gpt = results.find((r) => r.bot === 'GPTBot');
    const pplx = results.find((r) => r.bot === 'PerplexityBot');
    const claude = results.find((r) => r.bot === 'ClaudeBot');

    expect(gpt?.status).toBe('BLOCKED');
    expect(pplx?.status).toBe('ALLOWED');
    expect(claude?.status).toBe('ALLOWED');
  });

  it('generates standards-compliant llms.txt excluding non-indexable pages', () => {
    const txt = generateLlmsTxt('example.com', [
      { url: 'https://example.com/', title: 'Example Dairy | Fresh Milk', metaDescription: 'Farm fresh milk', pageType: 'HOME', indexability: 'INDEXABLE', statusCode: 200 },
      { url: 'https://example.com/products/milk', title: 'A2 Cow Milk', metaDescription: 'Pure A2 milk', pageType: 'PRODUCT', indexability: 'INDEXABLE', statusCode: 200 },
      { url: 'https://example.com/cart', title: 'Cart', metaDescription: null, pageType: 'OTHER', indexability: 'NOT_INDEXABLE', statusCode: 200 },
    ]);

    expect(txt).toContain('# Example Dairy');
    expect(txt).toContain('## Core Pages & Offerings');
    expect(txt).toContain('https://example.com/products/milk');
    expect(txt).not.toContain('/cart');
  });
});
