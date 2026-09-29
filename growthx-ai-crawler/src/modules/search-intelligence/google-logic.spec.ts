import {
  SearchSummaryLike,
  buildFunnel,
  buildHeadlines,
  diagnosePage,
  median,
  segmentsFor,
} from './google-logic';

const change = (current: number, previous: number | null) => ({
  current,
  previous,
  change: previous === null ? null : current - previous,
  changePct: previous === null || previous === 0 ? null : ((current - previous) / previous) * 100,
});

const search = (o: Partial<Record<'clicks' | 'impressions' | 'ctr' | 'position', [number, number | null]>> = {}): SearchSummaryLike => ({
  clicks: change(...(o.clicks ?? [100, 100])),
  impressions: change(...(o.impressions ?? [1000, 1000])),
  ctr: change(...(o.ctr ?? [0.1, 0.1])),
  position: change(...(o.position ?? [8, 8])),
});

const organic = (o: Partial<{ sessions: number; engagedSessions: number; engagementRate: number; keyEvents: number | null; revenue: number | null }> = {}) => ({
  sessions: 100,
  activeUsers: 80,
  engagedSessions: 60,
  engagementRate: 0.6,
  keyEvents: 5,
  revenue: null,
  ...o,
});

describe('buildFunnel', () => {
  it('links the stages with the rates between them', () => {
    const f = buildFunnel({ clicks: 500, impressions: 10000 }, organic({ sessions: 400, engagedSessions: 300, keyEvents: 20, revenue: 900 }));
    expect(f.map((s) => s.value)).toEqual([10000, 500, 400, 300, 20, 900]);
    expect(f[1].rate).toBeCloseTo(0.05); // CTR
    expect(f[2].rate).toBeCloseTo(0.8); // sessions per click
    expect(f[3].rate).toBeCloseTo(0.75); // engaged / sessions
    expect(f[4].rate).toBeCloseTo(0.05); // key events per session
  });

  it('leaves an unmeasured stage empty, with the reason, and never turns it into zero', () => {
    const f = buildFunnel(null, organic({ keyEvents: null, revenue: null }));
    expect(f[0].value).toBeNull();
    expect(f[0].note).toMatch(/Search Console/);
    expect(f[1].rate).toBeNull();
    expect(f[2].rate).toBeNull(); // no clicks to compare sessions with
    expect(f.find((s) => s.key === 'keyEvents')).toMatchObject({ value: null, note: expect.stringMatching(/No key events/) });
    expect(f.find((s) => s.key === 'revenue')).toMatchObject({ value: null, note: expect.stringMatching(/No revenue/) });
  });

  it('shows Analytics as missing when there is no organic data at all', () => {
    const f = buildFunnel({ clicks: 5, impressions: 50 }, null);
    expect(f.filter((s) => s.source === 'GA4').every((s) => s.value === null && s.note)).toBe(true);
  });
});

describe('buildHeadlines', () => {
  const base = { days: 28, organic: null, organicPrevious: null, ctrGap: null, decliningQueries: null };

  it('names the cause when visibility rose but clicks did not, and only from real numbers', () => {
    const [h] = buildHeadlines({
      ...base,
      search: search({ impressions: [1200, 1000], clicks: [104, 100], ctr: [0.0867, 0.1] }),
      ctrGap: { pages: 7, missedClicks: 60 },
    });
    expect(h.id).toBe('visibility-outpaces-clicks');
    expect(h.text).toContain('visibility rose 20.0%');
    expect(h.text).toContain('clicks rose only 4.0%');
    expect(h.text).toContain('click-through rate fell from 10.0% to 8.7%');
    expect(h.text).toContain('7 pages are seen often');
    expect(h.links.map((l) => l.segment)).toContain('high-impressions-low-ctr');
  });

  it('says clicks fell, not that they moved "only", when visibility rose and clicks dropped', () => {
    const [h] = buildHeadlines({ ...base, search: search({ impressions: [2600, 1000], clicks: [67, 100], ctr: [0.0258, 0.1] }) });
    expect(h.text).toContain('visibility rose 160.0%, but clicks fell 33.0%');
    expect(h.text).not.toContain('only');
  });

  it('does not blame CTR when CTR did not fall', () => {
    const [h] = buildHeadlines({ ...base, search: search({ impressions: [1200, 1000], clicks: [104, 100], ctr: [0.1, 0.1] }) });
    expect(h.text).not.toContain('click-through rate fell');
    expect(h.confidence).toBe('MEDIUM');
  });

  it('reports a click fall with position loss and declining searches', () => {
    const [h] = buildHeadlines({
      ...base,
      search: search({ clicks: [80, 100], impressions: [900, 1000], position: [9.5, 8] }),
      decliningQueries: 12,
    });
    expect(h.id).toBe('clicks-down');
    expect(h.tone).toBe('bad');
    expect(h.text).toContain('fell 20.0%');
    expect(h.text).toContain('slipped from 8.0 to 9.5');
    expect(h.text).toContain('12 searches lost ground');
  });

  it('does not invent a trend when there is no earlier period', () => {
    const [h] = buildHeadlines({ ...base, search: search({ clicks: [40, null], impressions: [900, null] }) });
    expect(h.id).toBe('search-no-baseline');
    expect(h.text).toMatch(/no earlier period/);
  });

  it('calls small moves steady', () => {
    const [h] = buildHeadlines({ ...base, search: search({ clicks: [102, 100], impressions: [1030, 1000] }) });
    expect(h.id).toBe('search-steady');
  });

  it('says key events are not set up instead of reporting zero conversions', () => {
    const out = buildHeadlines({ ...base, search: null, organic: organic({ keyEvents: null }) });
    expect(out.map((h) => h.id)).toContain('no-key-events');
    expect(out.map((h) => h.id)).not.toContain('no-organic-conversions');
  });

  it('flags zero key events only with enough visits to mean something', () => {
    expect(buildHeadlines({ ...base, search: null, organic: organic({ sessions: 10, keyEvents: 0 }) }).map((h) => h.id)).not.toContain('no-organic-conversions');
    expect(buildHeadlines({ ...base, search: null, organic: organic({ sessions: 50, keyEvents: 0 }) }).map((h) => h.id)).toContain('no-organic-conversions');
  });

  it('flags low engagement only above the minimum sample', () => {
    expect(buildHeadlines({ ...base, search: null, organic: organic({ sessions: 20, engagementRate: 0.1 }) }).map((h) => h.id)).not.toContain('low-engagement');
    expect(buildHeadlines({ ...base, search: null, organic: organic({ sessions: 60, engagementRate: 0.1 }) }).map((h) => h.id)).toContain('low-engagement');
  });

  it('reports organic session change only against a real baseline', () => {
    const withBase = buildHeadlines({ ...base, search: null, organic: organic({ sessions: 150 }), organicPrevious: organic({ sessions: 100 }) });
    expect(withBase.find((h) => h.id === 'organic-sessions-change')?.text).toContain('grew 50.0%');
    const without = buildHeadlines({ ...base, search: null, organic: organic({ sessions: 150 }), organicPrevious: null });
    expect(without.map((h) => h.id)).not.toContain('organic-sessions-change');
  });

  it('says nothing when there is no data from either source', () => {
    expect(buildHeadlines({ ...base, search: null, organic: null })).toEqual([]);
  });
});

describe('segmentsFor', () => {
  const ctx = { medianSessions: 30, siteConversionRate: 0.02 };
  const facts = (o: any) => ({ gsc: null, ga: null, technicalRisk: null, ...o });

  it('finds a page seen often and clicked rarely for its position', () => {
    // Position 3 should get ~11% CTR; 2% on 500 impressions is far below.
    const s = segmentsFor(facts({ gsc: { clicks: 10, impressions: 500, ctr: 0.02, position: 3, previousClicks: 10 } }), ctx);
    expect(s).toContain('high-impressions-low-ctr');
  });

  it('does not flag a page with too few impressions', () => {
    expect(segmentsFor(facts({ gsc: { clicks: 0, impressions: 40, ctr: 0, position: 3, previousClicks: null } }), ctx)).not.toContain('high-impressions-low-ctr');
  });

  it('marks declining and growing only with a real earlier period', () => {
    expect(segmentsFor(facts({ gsc: { clicks: 50, impressions: 900, ctr: 0.05, position: 6, previousClicks: 100 } }), ctx)).toContain('declining');
    expect(segmentsFor(facts({ gsc: { clicks: 100, impressions: 900, ctr: 0.1, position: 6, previousClicks: 50 } }), ctx)).toContain('growing');
    const none = segmentsFor(facts({ gsc: { clicks: 50, impressions: 900, ctr: 0.05, position: 6, previousClicks: null } }), ctx);
    expect(none).not.toContain('declining');
    expect(none).not.toContain('growing');
  });

  it('finds ranking opportunities between position 4 and 20', () => {
    expect(segmentsFor(facts({ gsc: { clicks: 5, impressions: 200, ctr: 0.025, position: 12, previousClicks: 5 } }), ctx)).toContain('ranking-opportunity');
    expect(segmentsFor(facts({ gsc: { clicks: 50, impressions: 200, ctr: 0.25, position: 2, previousClicks: 5 } }), ctx)).not.toContain('ranking-opportunity');
  });

  it('never calls a page low-converting when key events are not measured', () => {
    const s = segmentsFor(facts({ ga: { sessions: 500, keyEvents: null } }), ctx);
    expect(s).not.toContain('high-traffic-low-conversion');
    expect(s).not.toContain('top-converting');
  });

  it('separates high traffic without conversions from low traffic with them', () => {
    expect(segmentsFor(facts({ ga: { sessions: 80, keyEvents: 0 } }), ctx)).toContain('high-traffic-low-conversion');
    // 3 key events on 10 sessions = 30%, well over twice the 2% site rate, on fewer than the median sessions.
    expect(segmentsFor(facts({ ga: { sessions: 10, keyEvents: 3 } }), ctx)).toContain('low-traffic-high-conversion');
  });

  it('carries a technical risk through', () => {
    expect(segmentsFor(facts({ technicalRisk: 'Crawl: HTTP 404' }), ctx)).toContain('technical-risk');
  });
});

describe('median', () => {
  it('handles odd, even and empty', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
    expect(median([])).toBe(0);
  });
});

describe('diagnosePage', () => {
  const empty = { gsc: null, ga: null, index: null, crawl: null };

  it('returns no findings when there is nothing wrong, rather than inventing one', () => {
    expect(
      diagnosePage({
        gsc: { clicks: 200, impressions: 1000, ctr: 0.2, position: 2, previousClicks: 190 },
        ga: { sessions: 150, engagementRate: 0.7, keyEvents: 6 },
        index: { verdict: 'PASS', coverageState: 'Submitted and indexed', meaning: null, action: null },
        crawl: { statusCode: 200, indexability: 'INDEXABLE', title: 'T', metaDescription: 'D', h1Count: 1, wordCount: 900, canonicalUrl: null, pageUrl: 'https://a.com/x', schemaTypes: 1 },
      }),
    ).toEqual([]);
  });

  it('explains high visibility with poor CTR with the evidence that triggered it', () => {
    // Typical CTR at position 8.7 is 2.5%; 1.0% is well under 60% of that.
    const f = diagnosePage({ ...empty, gsc: { clicks: 184, impressions: 18420, ctr: 0.01, position: 8.7, previousClicks: null } }).find((x) => x.id === 'low-ctr')!;
    expect(f).toBeDefined();
    expect(f.evidence.map((e) => e.label)).toEqual(['Impressions', 'CTR', 'Typical CTR at this position', 'Average position']);
    expect(f.evidence[0].value).toBe('18,420');
    expect(f.action).toMatch(/title and meta description/);
  });

  it('does not call a click-through rate close to typical a problem', () => {
    // 2.2% at position 8.7 is near the typical 2.5%, so nothing is wrong with the click rate.
    const ids = diagnosePage({ ...empty, gsc: { clicks: 400, impressions: 18420, ctr: 0.022, position: 8.7, previousClicks: null } }).map((x) => x.id);
    expect(ids).not.toContain('low-ctr');
  });

  it('reports Google not indexing the page, with what to do', () => {
    const f = diagnosePage({ ...empty, index: { verdict: 'NEUTRAL', coverageState: 'Crawled - currently not indexed', meaning: 'Google read this page and chose not to show it.', action: 'Make it more useful.' } });
    expect(f[0]).toMatchObject({ id: 'not-indexed', tone: 'bad', action: 'Make it more useful.' });
  });

  it('reads crawl problems: errors, noindex, foreign canonical, missing basics', () => {
    const ids = diagnosePage({
      ...empty,
      crawl: { statusCode: 404, indexability: 'NOT_INDEXABLE', title: null, metaDescription: null, h1Count: 0, wordCount: 500, canonicalUrl: 'https://a.com/other', pageUrl: 'https://a.com/x', schemaTypes: 0 },
    }).map((f) => f.id);
    expect(ids).toEqual(expect.arrayContaining(['crawl-error', 'not-indexable', 'canonical-elsewhere', 'missing-title', 'missing-description', 'missing-h1']));
  });

  it('does not treat a trailing slash as a different canonical', () => {
    const ids = diagnosePage({
      ...empty,
      crawl: { statusCode: 200, indexability: 'INDEXABLE', title: 'T', metaDescription: 'D', h1Count: 1, wordCount: 900, canonicalUrl: 'https://a.com/x/', pageUrl: 'https://a.com/x', schemaTypes: 0 },
    }).map((f) => f.id);
    expect(ids).not.toContain('canonical-elsewhere');
  });

  it('flags no conversions only when key events were measured as zero', () => {
    expect(diagnosePage({ ...empty, ga: { sessions: 50, engagementRate: 0.8, keyEvents: null } }).map((f) => f.id)).not.toContain('no-conversions');
    expect(diagnosePage({ ...empty, ga: { sessions: 50, engagementRate: 0.8, keyEvents: 0 } }).map((f) => f.id)).toContain('no-conversions');
  });

  it('needs a real earlier period to call clicks down', () => {
    expect(diagnosePage({ ...empty, gsc: { clicks: 10, impressions: 100, ctr: 0.1, position: 2, previousClicks: null } }).map((f) => f.id)).not.toContain('clicks-down');
    expect(diagnosePage({ ...empty, gsc: { clicks: 10, impressions: 100, ctr: 0.1, position: 2, previousClicks: 50 } }).map((f) => f.id)).toContain('clicks-down');
  });
});
