import { GoogleReportFacts, buildPrompt, normaliseAnalysis } from './google-report';

const facts = (over: Partial<GoogleReportFacts> = {}): GoogleReportFacts => ({
  days: 28,
  site: 'milquufresh.in',
  searchConsole: { connected: true, hasData: true, lastSyncedAt: '2026-09-30T00:00:00Z', propertyName: 'https://www.milquufresh.in/' },
  analytics: { connected: true, hasData: true, lastSyncedAt: '2026-09-30T00:00:00Z', propertyName: 'milquufresh' },
  kpis: [
    { label: 'Organic clicks', source: 'GSC', format: 'count', value: 2, previous: null, change: null, note: null },
    { label: 'Average CTR', source: 'GSC', format: 'percent', value: 0.133, previous: null, change: null, note: null },
    { label: 'Key events', source: 'GA4', format: 'count', value: null, previous: null, change: null, note: 'No key events are set up.' },
  ],
  topQueries: [{ key: 'a2 milk delivery', clicks: 2, impressions: 15, ctr: 0.133, position: 1.5 }],
  topPages: [],
  strikingDistance: [],
  ctrOpportunities: [],
  decliningQueries: [],
  newQueries: [],
  cannibalization: [],
  index: null,
  alerts: [],
  traffic: null,
  notMeasured: ['No earlier Search Console period is stored, so losses and gains cannot be compared yet.'],
  ...over,
});

describe('normaliseAnalysis', () => {
  it('returns an empty report for garbage rather than throwing', () => {
    const a = normaliseAnalysis('nonsense');
    expect(a.priorities).toEqual([]);
    expect(a.plan).toEqual([]);
    expect(a.executiveSummary).toBe('');
  });

  it('orders priorities by priority, then impact, then lower effort, and numbers them itself', () => {
    const a = normaliseAnalysis({
      priorities: [
        { title: 'low one', priority: 'low', impact: 'low', effort: 'low', rank: 1 },
        { title: 'big but hard', priority: 'high', impact: 'high', effort: 'high', rank: 2 },
        { title: 'big and easy', priority: 'high', impact: 'high', effort: 'low', rank: 3 },
      ],
    });
    expect(a.priorities.map((p) => [p.rank, p.title])).toEqual([
      [1, 'big and easy'],
      [2, 'big but hard'],
      [3, 'low one'],
    ]);
  });

  it('reads platform names loosely and unknown ones as both', () => {
    const p = (platform: string) => normaliseAnalysis({ priorities: [{ title: 't', platform }] }).priorities[0].platform;
    expect(p('Search Console')).toBe('GSC');
    expect(p('gsc')).toBe('GSC');
    expect(p('Google Analytics')).toBe('GA4');
    expect(p('GA4')).toBe('GA4');
    expect(p('everything')).toBe('BOTH');
  });

  it('reads critical as high and an unknown level as medium', () => {
    const [x] = normaliseAnalysis({ priorities: [{ title: 't', priority: 'critical', impact: '???' }] }).priorities;
    expect(x.priority).toBe('high');
    expect(x.impact).toBe('medium');
  });

  it('names weeks that have no name and drops empty actions', () => {
    const a = normaliseAnalysis({ plan: [{ actions: ['x', '', '  '] }, { week: 'Week 2', actions: ['y'] }] });
    expect(a.plan).toEqual([
      { week: 'Week 1', actions: ['x'] },
      { week: 'Week 2', actions: ['y'] },
    ]);
  });
});

describe('buildPrompt', () => {
  it('states measured figures and says plainly when something was not measured', () => {
    const p = buildPrompt(facts());
    expect(p).toContain('milquufresh.in');
    expect(p).toContain('[GSC] Organic clicks: 2');
    expect(p).toContain('[GSC] Average CTR: 13.3%');
    expect(p).toContain('[GA4] Key events: not measured (No key events are set up.)');
    expect(p).toContain('a2 milk delivery: 2 clicks, 15 impressions');
    expect(p).toContain('No earlier Search Console period is stored');
    expect(p).toContain('no Analytics data');
  });

  it('marks a source that is not connected', () => {
    const p = buildPrompt(facts({ analytics: { connected: false, hasData: false, lastSyncedAt: null, propertyName: null } }));
    expect(p).toContain('Google Analytics 4: NOT CONNECTED');
  });

  it('includes Analytics channels and landing pages when there are some', () => {
    const p = buildPrompt(
      facts({
        traffic: {
          sessions: 6,
          users: 5,
          engagementRate: 1,
          keyEvents: null,
          channels: [{ channel: 'Organic Search', sessions: 6, share: 1, engagementRate: 1, keyEvents: null }],
          landingPages: [{ page: '/', sessions: 6, engagementRate: 1, keyEvents: null }],
          countries: [{ country: 'India', sessions: 6 }],
        },
      }),
    );
    expect(p).toContain('sessions 6, users 5, engagement rate 100.0%, key events none set up');
    expect(p).toContain('Organic Search: 6 sessions (100.0%)');
    expect(p).toContain('India 6');
  });
});
