import { assessRisk, RiskInput, titleOverlap } from './change-risk';

function input(over: Partial<RiskInput> = {}): RiskInput {
  return {
    change: 'DELETE',
    url: 'https://milquu.in/a2-milk',
    title: 'A2 Cow Milk Delivery in Pune',
    searchConsole: {
      connected: true,
      clicks: 180,
      impressions: 5400,
      queries: [{ query: 'a2 milk pune', clicks: 120, impressions: 2100, position: 3.2 }],
    },
    analytics: { sessions: 420, conversions: 9 },
    inlinks: ['https://milquu.in/', 'https://milquu.in/blog/why-a2'],
    inSitemap: true,
    canonicalFrom: [],
    rankings: [{ keyword: 'a2 milk pune', position: 3 }],
    indexed: true,
    target: null,
    ...over,
  };
}

const codes = (a: ReturnType<typeof assessRisk>) => a.risks.map((r) => r.code);

describe('assessRisk', () => {
  it('rates deleting a page that earns search traffic as high risk, and says what would be lost', () => {
    const a = assessRisk(input());
    expect(a.level).toBe('HIGH');
    expect(codes(a)).toEqual(expect.arrayContaining(['SEARCH_TRAFFIC', 'RANKINGS', 'VISITS', 'INTERNAL_LINKS', 'SITEMAP']));
    expect(a.risks.find((r) => r.code === 'SEARCH_TRAFFIC')!.title).toMatch(/lose about 60 clicks a month/);
    expect(a.beforeYouDoIt.join(' ')).toMatch(/Redirect the address to the closest related page/);
  });

  it('checks the destination of a redirect: broken, hidden, or pointing back', () => {
    const target = { url: 'https://milquu.in/milk', onSite: true, statusCode: 404, indexability: 'NOT_INDEXABLE', canonicalUrl: 'https://milquu.in/a2-milk', noindex: true, title: 'Milk' };
    const a = assessRisk(input({ change: 'REDIRECT', target }));
    expect(codes(a)).toEqual(expect.arrayContaining(['TARGET_NOT_OK', 'TARGET_NOT_INDEXABLE', 'CANONICAL_LOOP']));
    expect(a.beforeYouDoIt.join(' ')).toMatch(/permanent \(301\)/);
  });

  it('warns that a redirect to an unrelated page is treated like a deletion', () => {
    const target = { url: 'https://milquu.in/paneer', onSite: true, statusCode: 200, indexability: 'INDEXABLE', canonicalUrl: null, noindex: false, title: 'Fresh Paneer Online' };
    expect(codes(assessRisk(input({ change: 'REDIRECT', target })))).toContain('TOPIC_MISMATCH');
  });

  it('flags pages whose canonical tags name this page', () => {
    const a = assessRisk(input({ change: 'NOINDEX', canonicalFrom: ['https://milquu.in/a2-milk?ref=ad'] }));
    expect(a.risks.find((r) => r.code === 'CANONICAL_REFERENCES')).toMatchObject({ severity: 'HIGH' });
  });

  it('rates a page nothing depends on as low risk', () => {
    const a = assessRisk(
      input({ searchConsole: { connected: true, clicks: 0, impressions: 0, queries: [] }, analytics: null, inlinks: [], inSitemap: false, rankings: [], indexed: false }),
    );
    expect(a.level).toBe('LOW');
  });

  it('says what it could not measure', () => {
    const a = assessRisk(input({ searchConsole: { connected: false, clicks: 0, impressions: 0, queries: [] }, analytics: null }));
    expect(a.notMeasured.join(' ')).toMatch(/Search Console is not connected/);
    expect(a.notMeasured.join(' ')).toMatch(/Links from other websites/);
  });

  it('refuses to guess a destination that was not given', () => {
    expect(codes(assessRisk(input({ change: 'CANONICAL', target: null })))).toContain('NO_TARGET');
  });
});

describe('titleOverlap', () => {
  it('scores shared topic words between two titles', () => {
    expect(titleOverlap('A2 Cow Milk Delivery Pune', 'A2 Cow Milk 1L')).toBeGreaterThan(0.4);
    expect(titleOverlap('A2 Cow Milk', 'Fresh Paneer')).toBe(0);
    expect(titleOverlap(null, 'x')).toBeNull();
  });
});
