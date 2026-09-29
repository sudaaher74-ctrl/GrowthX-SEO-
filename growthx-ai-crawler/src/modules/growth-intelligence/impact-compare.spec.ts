import { compareSnapshots, explain, CAUSATION_NOTE, Snapshot } from './impact-compare';

const snap = (over: { page?: Snapshot['page']; site?: Partial<Snapshot['site']>; days?: number } = {}): Snapshot => ({
  capturedAt: '2026-09-01T00:00:00Z',
  range: { start: '2026-08-04', end: '2026-08-31', days: over.days ?? 28 },
  page: over.page === undefined ? { gsc: { clicks: 100, impressions: 4000, ctr: 0.025, position: 14 }, ga4: { sessions: 200, engagementRate: 0.4, conversions: 10 } } : over.page,
  site: { gsc: { clicks: 900, impressions: 30000, ctr: 0.03, position: 12 }, ga4: { sessions: 3000, engagementRate: 0.5, conversions: 90 }, gbp: null, ai: null, ...over.site },
});
const by = (rows: ReturnType<typeof compareSnapshots>, key: string) => rows.find((r) => r.key === key)!;

describe('compareSnapshots', () => {
  it('reports improvements and regressions only beyond normal variation', () => {
    const before = snap();
    const after = snap({ page: { gsc: { clicks: 160, impressions: 4100, ctr: 0.039, position: 9 }, ga4: { sessions: 205, engagementRate: 0.3, conversions: 10 } } });
    const rows = compareSnapshots(before, after, true);
    expect(by(rows, 'page.position').verdict).toBe('IMPROVED');
    expect(by(rows, 'page.clicks').verdict).toBe('IMPROVED');
    expect(by(rows, 'page.ctr').verdict).toBe('IMPROVED');
    expect(by(rows, 'page.engagement').verdict).toBe('WORSE');
    expect(by(rows, 'page.impressions').verdict).toBe('NO_CLEAR_CHANGE');
    expect(by(rows, 'page.sessions').verdict).toBe('NO_CLEAR_CHANGE');
  });

  it('compares per day so a shorter after-window is not read as a fall', () => {
    const before = snap();
    const after = snap({ days: 14, page: { gsc: { clicks: 50, impressions: 2000, ctr: 0.025, position: 14 }, ga4: null } });
    expect(by(compareSnapshots(before, after, true), 'page.clicks').verdict).toBe('NO_CLEAR_CHANGE');
  });

  it('never invents a direction from missing or unconfigured data', () => {
    const before = snap({ page: { gsc: { clicks: 100, impressions: 4000, ctr: 0.025, position: 14 }, ga4: { sessions: 200, engagementRate: 0.4, conversions: null } } });
    const rows = compareSnapshots(before, snap(), true);
    expect(by(rows, 'page.keyEvents')).toMatchObject({ verdict: 'NOT_COMPARABLE', before: null });
    expect(by(rows, 'site.gbpCalls').verdict).toBe('NOT_COMPARABLE');
    expect(by(rows, 'site.ai').verdict).toBe('NOT_COMPARABLE');
  });

  it('refuses to judge when the before side had too little data', () => {
    const before = snap({ page: { gsc: { clicks: 2, impressions: 30, ctr: 0.06, position: 14 }, ga4: null } });
    const after = snap({ page: { gsc: { clicks: 40, impressions: 900, ctr: 0.04, position: 6 }, ga4: null } });
    const rows = compareSnapshots(before, after, true);
    expect(by(rows, 'page.clicks').verdict).toBe('NOT_COMPARABLE');
    expect(by(rows, 'page.clicks').reason).toMatch(/too little data/i);
  });

  it('leaves page metrics out for a site-wide change', () => {
    const rows = compareSnapshots(snap(), snap(), false);
    expect(rows.every((r) => r.scope === 'site')).toBe(true);
  });

  it('judges Business Profile and AI visibility changes', () => {
    const before = snap({ site: { gbp: { websiteClicks: 60, calls: 30, directions: 20 }, ai: { checks: 10, citedChecks: 1, ratePct: 10 } } });
    const after = snap({ site: { gbp: { websiteClicks: 90, calls: 30, directions: 22 }, ai: { checks: 10, citedChecks: 4, ratePct: 40 } } });
    const rows = compareSnapshots(before, after, false);
    expect(by(rows, 'site.gbpWebsiteClicks').verdict).toBe('IMPROVED');
    expect(by(rows, 'site.gbpCalls').verdict).toBe('NO_CLEAR_CHANGE');
    expect(by(rows, 'site.ai').verdict).toBe('IMPROVED');
  });
});

describe('explain', () => {
  it('separates what changed, what did not improve, and always states the causation limit', () => {
    const rows = compareSnapshots(snap(), snap({ page: { gsc: { clicks: 160, impressions: 4100, ctr: 0.039, position: 9 }, ga4: { sessions: 200, engagementRate: 0.4, conversions: null } } }), true);
    const e = explain(rows, ['Rewrote the title (12 Sep)']);
    expect(e.improved).toContain('Average position');
    expect(e.notImproved).toContain('Impressions per day');
    expect(e.contributors).toEqual(['Rewrote the title (12 Sep)']);
    expect(e.note).toBe(CAUSATION_NOTE);
    expect(e.note).toMatch(/not that the action caused it/);
  });
});
