import { buildComparisonRows } from './website-comparison.service';
import { buildSiteProfile, ProfilePage } from './site-profile';

function page(overrides: Partial<ProfilePage> = {}): ProfilePage {
  return {
    url: 'https://x.com/a',
    statusCode: 200,
    title: 'A',
    metaDescription: 'd',
    robotsMeta: null,
    h1: ['h'],
    pageType: 'SERVICE',
    crawledAt: new Date('2026-09-01'),
    schemaCount: 1,
    ...overrides,
  };
}

function site(domain: string, pages: ProfilePage[]) {
  return buildSiteProfile(domain, pages);
}

const mine = site('mine.com', [
  page({ pageType: 'SERVICE' }),
  page({ pageType: 'HOME' }),
  page({ pageType: 'BLOG', metaDescription: null }),
]);

describe('buildComparisonRows', () => {
  it('names who is ahead and by how much', () => {
    const rows = buildComparisonRows(mine, [
      { id: 'a', name: 'Competitor A', profile: site('a.com', Array.from({ length: 4 }, () => page({ pageType: 'LOCATION' }))) },
      { id: 'b', name: 'Competitor B', profile: site('b.com', Array.from({ length: 2 }, () => page({ pageType: 'LOCATION' }))) },
    ]);

    const location = rows.find((row) => row.key === 'location_pages')!;
    expect(location.you).toBe(0);
    expect(location.aheadOfYou).toEqual(['Competitor A', 'Competitor B']);
    expect(location.gapToBest).toBe(4);
    expect(location.verdict).toContain('Competitor A (4)');
    expect(location.verdict).toContain('4 more location pages');
  });

  // A gap of one used to read "1 more location pages", because the sentence
  // was built from the row's own plural label.
  it('counts a gap of one in the singular', () => {
    const rows = buildComparisonRows(mine, [
      { id: 'a', name: 'Competitor A', profile: site('a.com', [page({ pageType: 'LOCATION' })]) },
    ]);

    const location = rows.find((row) => row.key === 'location_pages')!;
    expect(location.gapToBest).toBe(1);
    expect(location.verdict).toContain('1 more location page.');
    expect(location.verdict).not.toContain('1 more location pages');
  });

  it('says plainly when a row is not a gap', () => {
    const rows = buildComparisonRows(mine, [
      { id: 'a', name: 'Competitor A', profile: site('a.com', [page({ pageType: 'HOME' })]) },
    ]);

    const service = rows.find((row) => row.key === 'service_pages')!;
    expect(service.aheadOfYou).toEqual([]);
    expect(service.verdict).toContain('not a gap');
  });

  it('reads a problem count the right way round', () => {
    // Fewer broken URLs is better, so a competitor with fewer is ahead.
    const withBreakage = site('mine.com', [page(), page({ statusCode: 404 }), page({ statusCode: 500 })]);
    const rows = buildComparisonRows(withBreakage, [
      { id: 'a', name: 'Competitor A', profile: site('a.com', [page()]) },
    ]);

    const broken = rows.find((row) => row.key === 'broken_urls')!;
    expect(broken.higherIsBetter).toBe(false);
    expect(broken.you).toBe(2);
    expect(broken.aheadOfYou).toEqual(['Competitor A']);
    expect(broken.verdict).toContain('fixing 2');
  });

  it('reports an uncrawled competitor as unknown, never as zero', () => {
    // Zero would read as "they have none", which is a different claim.
    const rows = buildComparisonRows(mine, [{ id: 'a', name: 'Competitor A', profile: null }]);

    const location = rows.find((row) => row.key === 'location_pages')!;
    expect(location.competitors[0].value).toBeNull();
    expect(location.aheadOfYou).toEqual([]);
    expect(location.gapToBest).toBeNull();
  });

  it('says so when the customer has not been crawled either', () => {
    const rows = buildComparisonRows(null, [
      { id: 'a', name: 'Competitor A', profile: site('a.com', [page()]) },
    ]);

    expect(rows[0].you).toBeNull();
    expect(rows[0].verdict).toContain('not been crawled');
  });

  it('explains every row without a glossary', () => {
    const rows = buildComparisonRows(mine, []);

    expect(rows.every((row) => row.whatItMeans.length > 40)).toBe(true);
    expect(rows.find((row) => row.key === 'location_pages')!.whatItMeans).toContain('service + city');
  });
});
