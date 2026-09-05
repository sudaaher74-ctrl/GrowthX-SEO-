import { compare, verdictFor } from './competitor-seo-report.service';
import { SiteProfile, EMPTY_PROFILE } from './site-profile';

const profile = (over: Partial<SiteProfile> = {}): SiteProfile => ({
  domain: 'rival.com',
  ...EMPTY_PROFILE,
  crawledAt: new Date('2026-09-01T00:00:00Z'),
  totalPages: 40,
  ...over,
});

describe('verdictFor', () => {
  it('says a competitor has not been assessed rather than scoring them zero', () => {
    expect(verdictFor(null, profile({ healthScore: 80 }))).toBe(
      'This competitor has not been crawled yet, so their site has not been assessed.',
    );
  });

  it('names the gap when the competitor leads, and what the gap is made of', () => {
    const verdict = verdictFor(
      profile({ healthScore: 88 }),
      profile({ domain: 'you.com', healthScore: 61 }),
    );

    expect(verdict).toContain('88 against your 61');
    expect(verdict).toContain('27 points ahead');
  });

  it('points the customer elsewhere when they are already ahead', () => {
    const verdict = verdictFor(
      profile({ healthScore: 55 }),
      profile({ domain: 'you.com', healthScore: 79 }),
    );

    expect(verdict).toContain('you are 24 points ahead');
    expect(verdict).toContain('coverage gaps');
  });

  it('reports a crawl that recorded no score without inventing one', () => {
    const verdict = verdictFor(profile({ healthScore: null }), profile({ healthScore: 70 }));
    expect(verdict).toContain('no health score');
    // Never "scores 0 out of 100", which would read as the worst site on record.
    expect(verdict).not.toMatch(/scores \d/);
  });

  it('asks for the customer\'s own crawl rather than comparing against nothing', () => {
    expect(verdictFor(profile({ healthScore: 88 }), null)).toContain('Crawl your own site');
  });
});

describe('compare', () => {
  it('names who leads on each row, per that row\'s own terms', () => {
    const rows = compare(
      profile({ healthScore: 90, issuesBySeverity: { CRITICAL: 1 }, byType: { SERVICE: 9 } }),
      profile({ domain: 'you.com', healthScore: 70, issuesBySeverity: { CRITICAL: 6 }, byType: { SERVICE: 12 } }),
    );

    const by = (label: string) => rows.find((row) => row.label === label)!;
    expect(by('SEO health score').leader).toBe('them');
    // Fewer critical problems is better, so the smaller number leads.
    expect(by('Critical problems').leader).toBe('them');
    expect(by('Service pages').leader).toBe('you');
  });

  // Calling an unmeasured row a draw would tell the customer they are keeping
  // pace with something nobody measured.
  it('reports unknown rather than level when either side is unmeasured', () => {
    const rows = compare(profile({ healthScore: null }), profile({ healthScore: null }));
    expect(rows.find((row) => row.label === 'SEO health score')!.leader).toBe('unknown');

    const noCrawl = compare(null, profile({ healthScore: 70 }));
    expect(noCrawl.every((row) => row.leader === 'unknown')).toBe(true);
    expect(noCrawl.every((row) => row.them === null)).toBe(true);
  });

  it('calls a genuine tie level', () => {
    const rows = compare(profile({ healthScore: 70 }), profile({ domain: 'you.com', healthScore: 70 }));
    expect(rows.find((row) => row.label === 'SEO health score')!.leader).toBe('level');
  });
});
