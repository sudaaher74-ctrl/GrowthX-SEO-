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
