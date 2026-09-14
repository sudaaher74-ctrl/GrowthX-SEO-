import { computeIndexability } from './indexability';

const page = 'https://www.example.com/about';

describe('computeIndexability', () => {
  it('calls a 200 page with no directives indexable', () => {
    const result = computeIndexability({ pageUrl: page, statusCode: 200, robotsTxtAllows: true });

    expect(result.indexability).toBe('INDEXABLE');
    expect(result.reasons).toEqual([]);
  });

  // The defect this whole rule exists to remove: the previous UI derived
  // indexability from `statusCode >= 400`, so a phantom 403 on a page carrying
  // no meta robots, no X-Robots-Tag and no canonical rendered as "Noindex".
  it('never infers a robots directive from a status code', () => {
    const forbidden = computeIndexability({ pageUrl: page, statusCode: 403, robotsTxtAllows: true });

    expect(forbidden.indexability).toBe('NOT_INDEXABLE');
    expect(forbidden.reasons.map((r) => r.code)).toEqual(['STATUS_NOT_2XX']);
    expect(forbidden.reasons.map((r) => r.code)).not.toContain('META_ROBOTS_NOINDEX');
  });

  it('honours an X-Robots-Tag header even with no meta tag on the page', () => {
    const result = computeIndexability({
      pageUrl: page,
      statusCode: 200,
      robotsTxtAllows: true,
      xRobotsTag: 'noindex, nofollow',
    });

    expect(result.indexability).toBe('NOT_INDEXABLE');
    expect(result.reasons[0].code).toBe('X_ROBOTS_TAG_NOINDEX');
    expect(result.reasons[0].evidence).toBe('X-Robots-Tag: noindex, nofollow');
  });

  it('reads a googlebot-scoped X-Robots-Tag directive', () => {
    const result = computeIndexability({
      pageUrl: page,
      statusCode: 200,
      robotsTxtAllows: true,
      xRobotsTag: 'googlebot: noindex',
    });

    expect(result.indexability).toBe('NOT_INDEXABLE');
  });

  it('does not mistake "index" or "noimageindex" for "noindex"', () => {
    expect(computeIndexability({ pageUrl: page, statusCode: 200, robotsTxtAllows: true, metaRobots: 'index, follow' }).indexability).toBe('INDEXABLE');
    expect(computeIndexability({ pageUrl: page, statusCode: 200, robotsTxtAllows: true, metaRobots: 'noimageindex' }).indexability).toBe('INDEXABLE');
  });

  it('treats a cross-domain canonical as not indexable and says which domain', () => {
    const result = computeIndexability({
      pageUrl: page,
      statusCode: 200,
      robotsTxtAllows: true,
      canonicalUrl: 'https://www.somewhere-else.com/about',
    });

    expect(result.indexability).toBe('NOT_INDEXABLE');
    expect(result.reasons[0].code).toBe('CANONICAL_POINTS_ELSEWHERE');
    expect(result.reasons[0].evidence).toContain('a different domain');
  });

  it('accepts a self-referential canonical, including a differently-spelled one', () => {
    expect(
      computeIndexability({ pageUrl: page, statusCode: 200, robotsTxtAllows: true, canonicalUrl: page }).indexability,
    ).toBe('INDEXABLE');
    // Same page, trailing slash and a tracking parameter.
    expect(
      computeIndexability({
        pageUrl: page,
        statusCode: 200,
        robotsTxtAllows: true,
        canonicalUrl: 'https://www.example.com/about/?utm_source=nl',
      }).indexability,
    ).toBe('INDEXABLE');
  });

  it('respects a robots.txt disallow and quotes the rule', () => {
    const result = computeIndexability({
      pageUrl: page,
      statusCode: 200,
      robotsTxtAllows: false,
      robotsTxtEvidence: 'Disallow: /about under User-agent: GrowthXBot',
    });

    expect(result.indexability).toBe('NOT_INDEXABLE');
    expect(result.reasons[0].evidence).toContain('Disallow: /about');
  });

  // UNKNOWN is a real answer, not a soft no. A signal we could not read must
  // render grey, never as a red issue.
  it('answers UNKNOWN when the fetch failed', () => {
    const result = computeIndexability({ pageUrl: page, fetchFailed: true });

    expect(result.indexability).toBe('UNKNOWN');
    expect(result.reasons[0].code).toBe('FETCH_FAILED');
  });

  it('answers UNKNOWN when robots.txt could not be read', () => {
    const result = computeIndexability({ pageUrl: page, statusCode: 200, robotsTxtAllows: undefined });

    expect(result.indexability).toBe('UNKNOWN');
  });

  it('answers UNKNOWN for a URL that was never fetched', () => {
    expect(computeIndexability({ pageUrl: page }).indexability).toBe('UNKNOWN');
  });

  it('reports every reason it found, not just the first', () => {
    const result = computeIndexability({
      pageUrl: page,
      statusCode: 404,
      robotsTxtAllows: false,
      metaRobots: 'noindex',
      xRobotsTag: 'none',
      canonicalUrl: 'https://other.example/x',
    });

    expect(result.reasons.map((r) => r.code)).toEqual([
      'STATUS_NOT_2XX',
      'ROBOTS_TXT_DISALLOW',
      'META_ROBOTS_NOINDEX',
      'X_ROBOTS_TAG_NOINDEX',
      'CANONICAL_POINTS_ELSEWHERE',
    ]);
  });
});
