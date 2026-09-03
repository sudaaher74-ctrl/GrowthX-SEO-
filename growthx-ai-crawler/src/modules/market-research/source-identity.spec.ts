import { sourceIdentity } from './market-research.service';

/**
 * These are the pairs that actually appeared in a customer's run: one four-page
 * site produced eight numbered sources, because the crawl holds more than one
 * URL for the same document and the identity used for de-duplication was the
 * raw URL string.
 */
describe('sourceIdentity', () => {
  const same = (a: string, b: string) =>
    sourceIdentity({ url: a, title: 't' }) === sourceIdentity({ url: b, title: 't' });

  it('treats a trailing slash as the same document', () => {
    expect(same('https://aivaenterprises.com/about', 'https://aivaenterprises.com/about/')).toBe(true);
  });

  it('treats www and the bare host as the same document', () => {
    expect(same('https://aivaenterprises.com/about', 'https://www.aivaenterprises.com/about')).toBe(true);
  });

  it('treats http and https as the same document', () => {
    expect(same('http://aivaenterprises.com/about', 'https://aivaenterprises.com/about')).toBe(true);
  });

  it('ignores case in the host', () => {
    expect(same('https://AivaEnterprises.com/About', 'https://aivaenterprises.com/About')).toBe(true);
  });

  it('ignores a fragment', () => {
    expect(same('https://aivaenterprises.com/products#pulp', 'https://aivaenterprises.com/products')).toBe(true);
  });

  it('ignores tracking parameters', () => {
    expect(
      same(
        'https://aivaenterprises.com/products?utm_source=google&utm_medium=cpc',
        'https://aivaenterprises.com/products',
      ),
    ).toBe(true);
    expect(same('https://aivaenterprises.com/p?gclid=abc', 'https://aivaenterprises.com/p')).toBe(true);
  });

  it('ignores the order of meaningful query parameters', () => {
    expect(same('https://x.com/p?b=2&a=1', 'https://x.com/p?a=1&b=2')).toBe(true);
  });

  // The opposite failure is worse: collapsing two real pages loses a citation.
  it('keeps genuinely different pages apart', () => {
    expect(same('https://aivaenterprises.com/about', 'https://aivaenterprises.com/contact')).toBe(false);
    expect(same('https://aivaenterprises.com/p?product=mango', 'https://aivaenterprises.com/p?product=guava')).toBe(false);
    expect(same('https://aivaenterprises.com/about', 'https://sahyadrifarms.com/about')).toBe(false);
  });

  it('falls back to the internal document id when there is no URL', () => {
    expect(sourceIdentity({ url: null, internalDocId: 'doc_42', title: 'x' })).toBe('doc_42');
    expect(
      sourceIdentity({ url: null, internalDocId: 'doc_42', title: 'x' }) ===
        sourceIdentity({ url: null, internalDocId: 'DOC_42', title: 'y' }),
    ).toBe(true);
  });

  it('falls back to the title when there is neither a URL nor a document id', () => {
    expect(sourceIdentity({ url: null, internalDocId: null, title: 'AI visibility summary' })).toBe(
      'title:ai visibility summary',
    );
  });

  it('does not throw on a malformed URL', () => {
    expect(() => sourceIdentity({ url: 'not a url at all', title: 't' })).not.toThrow();
    expect(sourceIdentity({ url: 'not a url at all', title: 't' })).toBe('not a url at all');
  });
});
