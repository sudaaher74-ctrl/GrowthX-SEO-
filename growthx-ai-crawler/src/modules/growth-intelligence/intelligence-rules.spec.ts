import { diagnosePage, gbpLandingFinding, siteRisks, THRESHOLDS } from './intelligence-rules';
import { PageFacts, SiteFacts, SiteTrends } from './intelligence.types';

const connected = { connected: true, note: null };
const site = (over: Partial<SiteFacts> = {}): SiteFacts => ({
  engagementRate: 0.6,
  conversionTracking: true,
  sources: { CRAWL: connected, GSC: connected, GA4: connected, GBP: connected, COMPETITORS: connected, AI_VISIBILITY: connected },
  ...over,
});

const page = (over: Partial<PageFacts> = {}): PageFacts => ({
  url: 'https://shop.example/buffalo-milk',
  path: '/buffalo-milk',
  search: {
    clicks: 20,
    impressions: 4000,
    ctr: 0.005,
    position: 14,
    queries: [{ query: 'buffalo milk delivery navi mumbai', clicks: 10, impressions: 2500, ctr: 0.004, position: 15 }],
  },
  analytics: { sessions: 120, engagementRate: 0.3, conversions: 0 },
  crawl: {
    title: 'Buffalo milk',
    metaDescription: null,
    h1Count: 1,
    wordCount: 180,
    pageType: 'PRODUCT',
    indexability: 'INDEXABLE',
    inboundLinks: 1,
    schemaTypes: [],
    issues: [
      { id: 'i1', type: 'MISSING_META_DESCRIPTION', severity: 'MEDIUM', description: 'Meta description is missing.', recommendation: 'Add one.', evidence: null, aiFixAvailable: true },
      { id: 'i2', type: 'IMG_ALT', severity: 'LOW', description: 'Alt text missing.', recommendation: 'Add alt.', evidence: null, aiFixAvailable: false },
    ],
  },
  competitors: [
    { keyword: 'buffalo milk delivery navi mumbai', competitor: 'rival.com', competitorPosition: 3, competitorUrl: 'https://rival.com/buffalo', ownPosition: 15 },
  ],
  ai: { checks: 10, citedChecks: 1, citedThisPage: 0, competitorsCited: ['rival.com'] },
  ...over,
});

describe('diagnosePage — a page underperforming across every source', () => {
  const d = diagnosePage(page(), site());
  const types = d.findings.map((f) => f.type);

  it('combines findings from search, analytics, crawl and competitors into one diagnosis', () => {
    expect(types).toEqual(
      expect.arrayContaining(['LOW_CTR', 'PAGE_TWO_RANKING', 'LOW_ENGAGEMENT', 'TRAFFIC_NO_CONVERSION', 'WEAK_INTERNAL_LINKING', 'COMPETITOR_RANKS_HIGHER', 'MISSING_META_DESCRIPTION']),
    );
    expect(d.corroboratingSources).toEqual(expect.arrayContaining(['GSC', 'GA4', 'CRAWL', 'COMPETITORS']));
    expect(d.confidence).toBe('HIGH');
  });

  it('gives every finding evidence, and every evidence id resolves', () => {
    const ids = new Set(d.evidence.map((e) => e.id));
    for (const f of d.findings) {
      expect(f.evidenceIds.length).toBeGreaterThan(0);
      for (const id of f.evidenceIds) expect(ids.has(id)).toBe(true);
    }
  });

  it('follows what → why → action → measurement on every finding', () => {
    for (const f of d.findings) {
      expect(f.what).toBeTruthy();
      expect(f.why).toBeTruthy();
      expect(f.action).toBeTruthy();
      expect(f.measurement.length).toBeGreaterThan(0);
    }
  });

  it('estimates clicks from the stated curve and labels it an estimate', () => {
    const ctr = d.findings.find((f) => f.type === 'LOW_CTR')!;
    expect(ctr.potentialClicks).toBeGreaterThan(0);
    expect(ctr.expectedImpact).toMatch(/estimate/i);
  });

  it('explains how the page was prioritised', () => {
    expect(d.priority.potentialClicks).toBeGreaterThan(0);
    expect(d.priority.reason).toMatch(/estimated extra clicks/);
  });

  it('drops low-severity crawl issues rather than padding the diagnosis', () => {
    expect(types).not.toContain('IMG_ALT');
  });

  it('attaches the AI-visibility gap to what is already wrong instead of raising it alone', () => {
    const ai = d.evidence.find((e) => e.source === 'AI_VISIBILITY')!;
    expect(d.findings.some((f) => f.evidenceIds.includes(ai.id))).toBe(true);
    expect(types).not.toContain('AI_NOT_CITED');
  });

  it('points a finding at the AI fix when the audit has one', () => {
    expect(d.findings.find((f) => f.type === 'MISSING_META_DESCRIPTION')!.fixIssueId).toBe('i1');
  });
});

describe('diagnosePage — missing data is stated, never read as zero', () => {
  it('reports unconnected sources as not measured and raises nothing from them', () => {
    const d = diagnosePage(
      page({ analytics: null, competitors: null, ai: null, crawl: null }),
      site({
        sources: {
          CRAWL: connected,
          GSC: connected,
          GA4: { connected: false, note: 'Analytics is not connected.' },
          GBP: connected,
          COMPETITORS: { connected: false, note: 'No competitors tracked.' },
          AI_VISIBILITY: { connected: false, note: 'AI visibility has not been measured.' },
        },
      }),
    );
    const missing = d.notMeasured.map((m) => m.source);
    expect(missing).toEqual(expect.arrayContaining(['GA4', 'COMPETITORS', 'AI_VISIBILITY', 'CRAWL']));
    expect(d.findings.map((f) => f.type)).not.toContain('TRAFFIC_NO_CONVERSION');
    expect(d.notMeasured.find((m) => m.source === 'GA4')!.reason).toBe('Analytics is not connected.');
  });

  it('does not call unconfigured key events "no conversions"', () => {
    const d = diagnosePage(page({ analytics: { sessions: 200, engagementRate: 0.6, conversions: null } }), site());
    expect(d.findings.map((f) => f.type)).not.toContain('TRAFFIC_NO_CONVERSION');
  });

  it('ignores pages below the impression and session floors', () => {
    const d = diagnosePage(
      page({
        search: { clicks: 1, impressions: THRESHOLDS.minImpressions - 1, ctr: 0.01, position: 15, queries: [] },
        analytics: { sessions: THRESHOLDS.minSessions - 1, engagementRate: 0.1, conversions: 0 },
        crawl: null,
        competitors: null,
        ai: null,
      }),
      site(),
    );
    expect(d.findings).toEqual([]);
    expect(d.conclusion).toBeNull();
  });

  it('does not flag a page whose CTR is normal for its position', () => {
    const d = diagnosePage(
      page({ search: { clicks: 400, impressions: 4000, ctr: 0.1, position: 3, queries: [] }, analytics: null, crawl: null, competitors: null, ai: null }),
      site(),
    );
    expect(d.findings).toEqual([]);
  });

  it('raises a critical risk for a non-indexable page that still gets traffic', () => {
    const base = page();
    const d = diagnosePage(page({ crawl: { ...base.crawl!, indexability: 'NOT_INDEXABLE', issues: [] } }), site());
    const risk = d.findings.find((f) => f.type === 'NON_INDEXABLE_WITH_TRAFFIC')!;
    expect(risk.category).toBe('RISK');
    expect(risk.severity).toBe('CRITICAL');
  });

  it('only calls a competitor ahead for searches this page actually appears for', () => {
    const d = diagnosePage(
      page({ competitors: [{ keyword: 'unrelated', competitor: 'rival.com', competitorPosition: 1, competitorUrl: null, ownPosition: null }] }),
      site(),
    );
    expect(d.findings.map((f) => f.type)).not.toContain('COMPETITOR_RANKS_HIGHER');
  });
});

describe('siteRisks', () => {
  const trends = (over: Partial<SiteTrends> = {}): SiteTrends => ({
    searchClicks: null,
    conversions: null,
    gbpWebsiteClicks: null,
    gbpCalls: null,
    aiCitationRatePct: null,
    gbpLanding: null,
    ...over,
  });

  it('flags a real fall between two stored periods, with its evidence', () => {
    const r = siteRisks(trends({ searchClicks: { current: 600, previous: 1000, changePct: -40 } }));
    expect(r.findings[0]).toMatchObject({ type: 'ORGANIC_CLICKS_DECLINE', category: 'RISK', severity: 'CRITICAL' });
    expect(r.evidence[0].source).toBe('GSC');
    expect(r.findings[0].evidenceIds).toEqual([r.evidence[0].id]);
  });

  it('raises nothing with no earlier period, or a fall from a tiny base', () => {
    expect(siteRisks(trends({ searchClicks: { current: 0, previous: null, changePct: null } })).findings).toEqual([]);
    expect(siteRisks(trends({ searchClicks: { current: 1, previous: 3, changePct: -67 } })).findings).toEqual([]);
  });

  it('covers local-profile and AI-visibility declines', () => {
    const r = siteRisks(
      trends({
        gbpWebsiteClicks: { current: 20, previous: 60, changePct: -67 },
        gbpCalls: { current: 5, previous: 30, changePct: -83 },
        aiCitationRatePct: { current: 10, previous: 40, changePct: null },
      }),
    );
    expect(r.findings.map((f) => f.type)).toEqual(['GBP_WEBSITE_CLICKS_DECLINE', 'GBP_CALLS_DECLINE', 'AI_VISIBILITY_DECLINE']);
  });
});

describe('gbpLandingFinding — the GBP → website → GA4 chain', () => {
  const base: SiteTrends = {
    searchClicks: null,
    conversions: null,
    gbpWebsiteClicks: null,
    gbpCalls: null,
    aiCitationRatePct: null,
    gbpLanding: { websiteClicks: 80, path: '/', engagementRate: 0.2, conversions: 0 },
  };

  it('links profile clicks to the landing page’s weak engagement, with both sides as evidence', () => {
    const r = gbpLandingFinding(base, site());
    expect(r.findings).toHaveLength(1);
    expect(r.evidence.map((e) => e.source)).toEqual(['GBP', 'GA4']);
  });

  it('stays quiet with too few clicks or a healthy page', () => {
    expect(gbpLandingFinding({ ...base, gbpLanding: { ...base.gbpLanding!, websiteClicks: 5 } }, site()).findings).toEqual([]);
    expect(gbpLandingFinding({ ...base, gbpLanding: { websiteClicks: 80, path: '/', engagementRate: 0.7, conversions: 4 } }, site()).findings).toEqual([]);
  });
});
