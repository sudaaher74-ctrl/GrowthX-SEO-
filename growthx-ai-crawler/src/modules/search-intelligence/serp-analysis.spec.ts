import { classifyPage, containsKeyword, dominantFormat, intentFromResults, keywordTerms, median, sameFamily } from './serp-analysis';

describe('classifyPage', () => {
  it.each([
    ['https://www.amazon.in/dp/B0C123', 'Amul Gold Milk 1L', 'MARKETPLACE'],
    ['https://www.justdial.com/Pune/Milk-Dealers', 'Top Milk Dealers in Pune', 'DIRECTORY'],
    ['https://www.youtube.com/watch?v=abc', 'How A2 milk is made', 'VIDEO'],
    ['https://www.reddit.com/r/india/comments/x', 'Which milk delivery app?', 'FORUM'],
    ['https://example.com/blog/a2-vs-a1-milk', 'A2 vs A1 milk: what is the difference', 'COMPARISON'],
    ['https://example.com/best-milk-brands', '10 Best Milk Brands in India (2026)', 'LISTICLE'],
    ['https://example.com/products/a2-cow-milk', 'A2 Cow Milk 1L', 'PRODUCT'],
    ['https://example.com/collections/dairy', 'Dairy', 'CATEGORY'],
    ['https://example.com/blog/benefits-of-a2-milk', 'Benefits of A2 milk', 'ARTICLE'],
    ['https://example.com/', 'Fresh milk delivered daily', 'HOMEPAGE'],
  ])('reads %s as %s', (url, title, format) => {
    expect(classifyPage(url, title)).toBe(format);
  });

  it("trusts our crawl's page type for the customer's own pages", () => {
    expect(classifyPage('https://milquu.in/cow-milk', 'Cow milk', 'PRODUCT')).toBe('PRODUCT');
    expect(classifyPage('https://milquu.in/', 'Milquu', 'HOME')).toBe('HOMEPAGE');
  });

  it('treats a product page and a category page as serving the same need', () => {
    expect(sameFamily('PRODUCT', 'CATEGORY')).toBe(true);
    expect(sameFamily('PRODUCT', 'ARTICLE')).toBe(false);
  });
});

describe('intentFromResults', () => {
  const top = (formats: string[]) => formats.map((format, i) => ({ format: format as any, domain: `site${i}.com` }));

  it('reads a map pack as someone looking for a business nearby', () => {
    const reading = intentFromResults(['local_pack', 'people_also_ask'], top(['DIRECTORY', 'DIRECTORY', 'HOMEPAGE', 'SERVICE']));
    expect(reading.primary).toBe('LOCAL');
    expect(reading.evidence[0]).toMatch(/map with local businesses/);
  });

  it('reads shopping results and shop pages as wanting to buy', () => {
    const reading = intentFromResults(['popular_products'], top(['MARKETPLACE', 'PRODUCT', 'PRODUCT', 'CATEGORY', 'ARTICLE']));
    expect(reading.primary).toBe('TRANSACTIONAL');
    expect(reading.evidence.join(' ')).toMatch(/4 of the top 5 results are shops/);
  });

  it('reads an answer box and articles as wanting to learn', () => {
    expect(intentFromResults(['featured_snippet', 'people_also_ask'], top(['ARTICLE', 'ARTICLE', 'VIDEO', 'FORUM'])).primary).toBe('INFORMATIONAL');
  });

  it('reads lists and comparisons as weighing options', () => {
    expect(intentFromResults([], top(['LISTICLE', 'LISTICLE', 'COMPARISON', 'ARTICLE'])).primary).toBe('COMMERCIAL');
  });

  it('reads one brand holding the top results as a search for that brand', () => {
    const results = [
      { format: 'HOMEPAGE' as const, domain: 'countrydelight.in' },
      { format: 'OTHER' as const, domain: 'countrydelight.in' },
      { format: 'OTHER' as const, domain: 'countrydelight.in' },
      { format: 'ARTICLE' as const, domain: 'news.com' },
    ];
    expect(intentFromResults([], results).primary).toBe('NAVIGATIONAL');
  });

  it('names a close second when the results are mixed', () => {
    const reading = intentFromResults(['shopping'], top(['ARTICLE', 'ARTICLE', 'PRODUCT', 'ARTICLE']));
    expect(reading.secondary).not.toBeNull();
  });
});

describe('dominantFormat', () => {
  it('names the kind of page that fills most of the results, with the count', () => {
    const d = dominantFormat([{ format: 'ARTICLE' }, { format: 'ARTICLE' }, { format: 'PRODUCT' }] as any);
    expect(d).toMatchObject({ format: 'ARTICLE', count: 2, of: 3, label: 'articles and guides' });
  });

  it('says nothing about an empty page of results', () => {
    expect(dominantFormat([])).toBeNull();
  });
});

describe('containsKeyword', () => {
  it('matches every meaningful word, whatever the order and plurals', () => {
    expect(containsKeyword('Fresh A2 Cow Milk Delivery in Pune', 'a2 milk delivery pune')).toBe(true);
    expect(containsKeyword('Organic vegetables delivered', 'organic vegetable delivery')).toBe(false);
    expect(containsKeyword('Best dentists near me', 'dentist near me')).toBe(true);
  });

  it('ignores filler words in the keyword', () => {
    expect(keywordTerms('the best milk for a baby')).toEqual(['best', 'milk', 'baby']);
  });

  it('matches nothing against empty text', () => {
    expect(containsKeyword(null, 'milk')).toBe(false);
  });
});

describe('median', () => {
  it('takes the middle value, or the rounded mean of the middle two', () => {
    expect(median([300, 1200, 800])).toBe(800);
    expect(median([300, 800, 1200, 2000])).toBe(1000);
    expect(median([])).toBeNull();
  });
});
