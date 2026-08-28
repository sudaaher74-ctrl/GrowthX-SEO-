import { classifyPageType } from './page-type';

const type = (url: string, title?: string, h1?: string[]) => classifyPageType({ url, title, h1 });

/**
 * Gap comparison depends entirely on this. "They have 24 service pages you
 * don't" is unanswerable until a service page can be told from a blog post, so
 * a misclassification here becomes a wrong number on the competitor dashboard.
 */
describe('classifyPageType', () => {
  it('types the real URLs from the crawled site', () => {
    // Taken from the Page table, not invented.
    expect(type('https://aivaenterprises.com/')).toBe('HOME');
    expect(type('https://aivaenterprises.com/about')).toBe('ABOUT');
    expect(type('https://aivaenterprises.com/contact')).toBe('CONTACT');
    expect(type('https://aivaenterprises.com/products')).toBe('PRODUCT');
    expect(type('https://www.aivaenterprises.com/products/banana-pulp')).toBe('PRODUCT');
  });

  it('treats a trailing slash as the same page', () => {
    // The same page linked two ways must not change type between crawls, or
    // every snapshot diff reports a change that did not happen.
    expect(type('https://x.com/about/')).toBe(type('https://x.com/about'));
    expect(type('https://x.com/services/')).toBe('SERVICE');
  });

  it('keeps a service page that names a place as a service page', () => {
    // LOCATION is matched last precisely for this: the page is about the
    // service, and counting it as a location page inflates local coverage.
    expect(type('https://x.com/services/kitchens-in-mumbai')).toBe('SERVICE');
    expect(type('https://x.com/locations/mumbai')).toBe('LOCATION');
  });

  it('separates the page kinds a content gap is measured across', () => {
    expect(type('https://x.com/blog/mango-guide')).toBe('BLOG');
    expect(type('https://x.com/case-studies/acme')).toBe('CASE_STUDY');
    expect(type('https://x.com/faq')).toBe('FAQ');
    expect(type('https://x.com/privacy-policy')).toBe('LEGAL');
  });

  it('does not count legal boilerplate as content', () => {
    // Terms and privacy pages exist on every site and say nothing about
    // coverage; typing them keeps them out of the content gap count.
    expect(type('https://x.com/terms-and-conditions')).toBe('LEGAL');
    expect(type('https://x.com/cookie-policy')).toBe('LEGAL');
  });

  it('falls back to headings when the path is uninformative', () => {
    expect(type('https://x.com/p/12345', 'Contact Us | Acme')).toBe('CONTACT');
    expect(type('https://x.com/p/999', undefined, ['Our Story'])).toBe('ABOUT');
  });

  it('returns OTHER rather than guessing', () => {
    // A wrong type is worse than an honest unknown: it lands in a gap count.
    expect(type('https://x.com/random-landing')).toBe('OTHER');
    expect(type('https://x.com/xyz/abc')).toBe('OTHER');
  });

  it('survives a malformed URL', () => {
    expect(type('/about')).toBe('ABOUT');
    expect(type('not a url at all')).toBe('OTHER');
  });

  it('ignores query strings and fragments', () => {
    expect(type('https://x.com/blog/post?utm_source=x#top')).toBe('BLOG');
  });
});

/**
 * The rules originally anchored each keyword to a leading slash, so a segment
 * with any prefix missed entirely. Caught on the real competitor: they publish
 * /our-products/ and /our-team/ and both typed as OTHER, so their catalogue
 * read as zero product pages against a customer whose own URLs happen to be
 * /products/... — a 32-page lead the comparison announced and that does not
 * exist.
 */
describe('classifyPageType — keywords anywhere in a segment', () => {
  it('types the prefixed segments a real site actually uses', () => {
    // Every one of these is a live URL on indianfruitspulp.com.
    expect(type('https://indianfruitspulp.com/our-products/')).toBe('PRODUCT');
    expect(type('https://indianfruitspulp.com/our-team/')).toBe('ABOUT');
    expect(type('https://indianfruitspulp.com/about-us/')).toBe('ABOUT');
    expect(type('https://indianfruitspulp.com/contact-us/')).toBe('CONTACT');
    expect(type('https://indianfruitspulp.com/our-clients/')).toBe('ABOUT');
  });

  it('matches whole words only', () => {
    // The reason this is word-boundary matching rather than a substring
    // search: a wrong type lands silently in a gap count, so recovering
    // /our-products/ is not worth typing /restore-data/ as a product page.
    expect(type('https://x.com/restore-data')).toBe('OTHER');
    expect(type('https://x.com/newsletter')).toBe('OTHER');
    expect(type('https://x.com/teamster-union-history')).toBe('OTHER');
  });

  it('still prefers the more specific rule when two could match', () => {
    expect(type('https://x.com/services/kitchens-in-mumbai')).toBe('SERVICE');
    expect(type('https://x.com/our-services')).toBe('SERVICE');
  });

  it('leaves a flat product URL as OTHER rather than guessing', () => {
    // /mango-pulp/ is a product page, and nothing in the URL says so. OTHER is
    // the honest answer; the alternative is inventing a type from the topic.
    expect(type('https://indianfruitspulp.com/mango-pulp/')).toBe('OTHER');
    expect(type('https://indianfruitspulp.com/tomato-puree/')).toBe('OTHER');
  });
});
