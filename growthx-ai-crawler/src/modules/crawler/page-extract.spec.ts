import { extractPage, extractUrlsFromJsonLd } from './page-extract';

describe('page-extract', () => {
  it('extracts links with location classification', () => {
    const html = `
      <html>
        <head><title>Test Page</title></head>
        <body>
          <header><a href="/header-link">Header Link</a></header>
          <nav><a href="/nav-link">Nav Link</a></nav>
          <main>
            <p>Main content</p>
            <a href="/main-link">Main Link</a>
            <a href="https://external.com/ext">External Link</a>
          </main>
          <footer><a href="/footer-link">Footer Link</a></footer>
        </body>
      </html>
    `;
    const extracted = extractPage(html, 'https://example.com/');
    expect(extracted.internalLinks).toHaveLength(4);
    expect(extracted.externalLinks).toHaveLength(1);

    const header = extracted.internalLinks.find((l) => l.href === '/header-link');
    expect(header?.location).toBe('header');

    const nav = extracted.internalLinks.find((l) => l.href === '/nav-link');
    expect(nav?.location).toBe('navigation');

    const main = extracted.internalLinks.find((l) => l.href === '/main-link');
    expect(main?.location).toBe('main');

    const footer = extracted.internalLinks.find((l) => l.href === '/footer-link');
    expect(footer?.location).toBe('footer');
  });

  it('extracts pagination links', () => {
    const html = `
      <html>
        <head>
          <link rel="next" href="/blog?page=2" />
          <link rel="prev" href="/blog?page=0" />
        </head>
        <body>
          <a rel="next" href="/blog?page=2">Next</a>
        </body>
      </html>
    `;
    const extracted = extractPage(html, 'https://example.com/blog?page=1');
    expect(extracted.paginationUrls).toEqual([
      'https://example.com/blog?page=2',
      'https://example.com/blog?page=0',
    ]);
  });

  it('extracts structured data URLs from JSON-LD ItemList, Product, and Breadcrumbs', () => {
    const jsonLd = [
      {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        itemListElement: [
          {
            '@type': 'Product',
            name: 'AIVA Enterprise Pro',
            url: '/products/aiva-enterprise-pro',
          },
          {
            '@type': 'Product',
            name: 'AIVA Enterprise Starter',
            url: 'https://example.com/products/aiva-enterprise-starter',
          },
          {
            '@type': 'Product',
            name: 'External Vendor',
            url: 'https://otherdomain.com/vendor/item',
          },
        ],
      },
    ];
    const urls = extractUrlsFromJsonLd(jsonLd, 'https://example.com/products');
    expect(urls).toContain('https://example.com/products/aiva-enterprise-pro');
    expect(urls).toContain('https://example.com/products/aiva-enterprise-starter');
    expect(urls).not.toContain('https://otherdomain.com/vendor/item');
  });
});
