import { isUsableKeyword, localTemplates, mergeIdeas, normalizeKeyword } from './keyword-ideas';
import { isSameSite, readPresence, sourceDomain } from './google-presence.service';

describe('keyword ideas', () => {
  it('normalizes case, spacing and quotes', () => {
    expect(normalizeKeyword('  "Fresh   Milk" Near Me ')).toBe('fresh milk near me');
  });

  it('rejects URLs, markup and over-long phrases', () => {
    expect(isUsableKeyword('https://example.com')).toBe(false);
    expect(isUsableKeyword('<b>milk</b>')).toBe(false);
    expect(isUsableKeyword('a b c d e f g h i j')).toBe(false);
    expect(isUsableKeyword('fresh milk near me')).toBe(true);
  });

  it('builds local phrases, and only near-me forms without a city', () => {
    const withCity = localTemplates(['fresh milk'], 'Panvel').map((t) => t.keyword);
    expect(withCity).toEqual(
      expect.arrayContaining(['fresh milk near me', 'fresh milk in panvel', 'fresh milk delivery in panvel']),
    );
    const noCity = localTemplates(['fresh milk'], null).map((t) => t.keyword);
    expect(noCity.some((k) => k.includes(' in '))).toBe(false);
    expect(noCity).toContain('fresh milk near me');
  });

  it('merges lists: first wins, tracked and Search Console marked, junk dropped', () => {
    const merged = mergeIdeas(
      [
        [{ keyword: 'Milk delivery in Panvel', kind: 'city', intent: 'transactional', reason: 'Home delivery', source: 'GEMINI' }],
        [
          { keyword: 'milk delivery in panvel', kind: 'city', intent: 'local', source: 'TEMPLATE' },
          { keyword: 'fresh milk near me', kind: 'near_me', intent: 'local', source: 'TEMPLATE' },
          { keyword: 'x', kind: 'product', intent: 'local', source: 'TEMPLATE' },
        ],
      ],
      {
        trackedKeywords: ['fresh milk near me'],
        searchConsole: [{ query: 'milk delivery in panvel', position: 7.2, clicks: 3, impressions: 90 }],
      },
    );
    expect(merged.map((m) => m.keyword)).toEqual(['milk delivery in panvel', 'fresh milk near me']);
    expect(merged[0]).toMatchObject({ source: 'GEMINI', reason: 'Home delivery', tracked: false });
    expect(merged[0].searchConsole).toEqual({ position: 7.2, clicks: 3, impressions: 90 });
    expect(merged[1].tracked).toBe(true);
  });
});

describe('google presence', () => {
  it('reads the domain from the title, falling back to a non-redirect URL', () => {
    expect(sourceDomain({ title: 'www.example.com', url: 'https://vertexaisearch.cloud.google.com/x' })).toBe('example.com');
    expect(sourceDomain({ title: 'Example Dairy', url: 'https://dairy.in/milk' })).toBe('dairy.in');
    expect(sourceDomain({ title: 'Example Dairy', url: 'https://vertexaisearch.cloud.google.com/x' })).toBeNull();
  });

  it('matches subdomains but not look-alike domains', () => {
    expect(isSameSite('shop.dairy.in', 'dairy.in')).toBe(true);
    expect(isSameSite('notdairy.in', 'dairy.in')).toBe(false);
  });

  it('reports presence and competitors without inventing a position', () => {
    const result = readPresence(
      'milk delivery in panvel',
      {
        sources: [
          { title: 'rival.com', url: null },
          { title: 'dairy.in', url: null },
          { title: 'rival.com', url: null },
        ],
        searchQueries: ['milk delivery panvel'],
      },
      'https://www.dairy.in',
      ['rival.com', 'other.com'],
    );
    expect(result.appears).toBe(true);
    expect(result.sites).toEqual(['rival.com', 'dairy.in']);
    expect(result.competitorsSeen).toEqual(['rival.com']);
    expect(result).not.toHaveProperty('position');
  });
});
