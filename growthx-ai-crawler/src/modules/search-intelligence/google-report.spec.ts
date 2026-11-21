import {
  GoogleReportFacts,
  buildPrompt,
  cleanHeadingText,
  computeTrafficDiagnostics,
  enrichAnalysisWithBusinessGaps,
  isUtilityOrGenericOffering,
  isUtilityPath,
  matchExactCity,
  normaliseAnalysis,
  queryMatchesLocation,
  stripLocationFromOffering,
} from './google-report';

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

describe('marketingStrategy', () => {
  it('reads each channel, and an unknown verdict as maintain', () => {
    const m = normaliseAnalysis({
      marketingStrategy: {
        summary: 's',
        whereTrafficComesFrom: ['Organic Search is 100%'],
        channels: [{ channel: 'Organic Search', verdict: 'GROW', share: '100%', actions: ['a', ''] }, { channel: 'Direct', verdict: 'whatever' }, { verdict: 'grow' }],
        audience: ['Pune'],
      },
    }).marketingStrategy!;
    expect(m.channels.map((c) => [c.channel, c.verdict])).toEqual([['Organic Search', 'grow'], ['Direct', 'maintain']]);
    expect(m.channels[0].actions).toEqual(['a']);
    expect(m.channels[1].share).toBe('not measured');
    expect(m.audience).toEqual(['Pune']);
  });

  it('is empty, not missing, when the model returned none', () => {
    expect(normaliseAnalysis({}).marketingStrategy).toEqual({ summary: '', whereTrafficComesFrom: [], channels: [], audience: [] });
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
          sources: [{ source: 'google', medium: 'organic', channel: 'Organic Search', sessions: 6, share: 1, engagementRate: 1, keyEvents: null }],
          countries: [{ country: 'India', sessions: 6 }],
          cities: [{ city: 'Pune', country: 'India', sessions: 4 }],
        },
      }),
    );
    expect(p).toContain('sessions 6, users 5, engagement rate 100.0%, key events none set up');
    expect(p).toContain('Organic Search: 6 sessions (100.0%)');
    expect(p).toContain('India 6');
    expect(p).toContain('google / organic (Organic Search): 6 sessions (100.0%)');
    expect(p).toContain('Pune, India 4');
  });

  it('says the named sources are not available yet when the data predates them', () => {
    const p = buildPrompt(
      facts({
        traffic: { sessions: 6, users: 5, engagementRate: 1, keyEvents: null, channels: [], landingPages: [], sources: [], countries: [], cities: [] },
      }),
    );
    expect(p).toContain('not available yet (the Analytics data needs a refresh to add sources)');
  });

  it('enriches analysis with high-priority action when a business city from Website Audit has 0 clicks', () => {
    const f = facts({
      business: {
        businessName: 'MilquuFresh',
        industry: 'Dairy & A2 Milk Delivery',
        summary: 'Fresh farm milk delivery in Nashik and Pune',
        businessModel: 'D2C',
        targetAudience: 'Families',
        businessGoal: 'Subscriptions',
        offerings: ['A2 Cow Milk', 'Gir Cow Ghee'],
        targetCities: ['Nashik'],
        primaryCity: 'Nashik',
        state: 'Maharashtra',
        country: 'India',
        seedKeywords: ['a2 milk nashik'],
        pagesAudited: 12,
        crawledAt: '2026-10-24T00:00:00Z',
        healthScore: 84,
        auditedPages: [{ path: '/products/a2-milk', title: 'A2 Cow Milk Delivery' }],
      },
      locationGaps: [
        {
          location: 'Nashik',
          source: 'website_audit',
          sessions: 0,
          searchClicks: 0,
          searchImpressions: 0,
          status: 'NO_CLICKS',
          finding: 'Website Audit shows MilquuFresh targets Nashik, but Traffic recorded 0 search clicks and 0 visitor sessions from Nashik.',
          plan: 'Launch local search capture for Nashik.',
          recommendedSteps: ['Optimize page title for Nashik', 'Add LocalBusiness schema for Nashik'],
          relevantOfferings: ['A2 Cow Milk'],
          matchingPages: ['/products/a2-milk'],
        },
      ],
    });
    const enriched = enrichAnalysisWithBusinessGaps(null, f);
    expect(enriched.priorities.length).toBeGreaterThan(0);
    expect(enriched.priorities.some((p) => p.title.includes('Nashik'))).toBe(true);
    expect(enriched.priorities.find((p) => p.title.includes('Nashik'))?.steps).toContain('Optimize page title for Nashik');
  });
});

describe('business & geo cleaning helpers', () => {
  it('cleans squashed multi-line headings and strips utility pages & offerings', () => {
    expect(cleanHeadingText('Good MilkBrighter Days')).toBe('Good Milk Brighter Days');
    expect(cleanHeadingText('Pure Milk.A Healthier You.')).toBe('Pure Milk. A Healthier You.');
    expect(isUtilityPath('/app/account')).toBe(true);
    expect(isUtilityPath('/about-us')).toBe(true);
    expect(isUtilityPath('/products/a2-milk')).toBe(false);
    expect(isUtilityOrGenericOffering('Your Account')).toBe(true);
    expect(isUtilityOrGenericOffering('Your Cart')).toBe(true);
    expect(isUtilityOrGenericOffering('About MilQuu Fresh')).toBe(true);
    expect(isUtilityOrGenericOffering('Pure Milk.A Healthier You.')).toBe(true);
    expect(isUtilityOrGenericOffering('Fresh Milk Delivery in Navi Mumbai')).toBe(false);
  });

  it('strips embedded city phrases to prevent double-city keyword gibberish', () => {
    expect(stripLocationFromOffering('Fresh Milk Delivery in Navi Mumbai', ['Navi Mumbai', 'Mumbai'])).toBe(
      'Fresh Milk Delivery',
    );
    expect(stripLocationFromOffering('A2 Cow Milk near Pune', ['Pune'])).toBe('A2 Cow Milk');
  });

  it('matches cities strictly without double-counting Mumbai and Navi Mumbai', () => {
    expect(matchExactCity('Mumbai', 'Navi Mumbai')).toBe(false);
    expect(matchExactCity('Navi Mumbai', 'Mumbai')).toBe(false);
    expect(matchExactCity('Mumbai', 'Mumbai')).toBe(true);
    expect(matchExactCity('Bangalore', 'Bengaluru')).toBe(true);

    const allLocs = ['Navi Mumbai', 'Mumbai'];
    expect(queryMatchesLocation('milk delivery in navi mumbai', 'Navi Mumbai', allLocs)).toBe(true);
    expect(queryMatchesLocation('milk delivery in navi mumbai', 'Mumbai', allLocs)).toBe(false);
    expect(queryMatchesLocation('milk delivery in mumbai', 'Mumbai', allLocs)).toBe(true);
  });
});

describe('computeTrafficDiagnostics & enriched fallback strategy', () => {
  it('detects datacenter bot cities, 0 key events, dark Direct traffic, distinct channel strategies, and preserves both Mumbai and Navi Mumbai', () => {
    const f = facts({
      site: 'milquufresh.in',
      topQueries: [{ key: 'milk subscription', clicks: 1, impressions: 120, ctr: 0.008, position: 8.7 }],
      strikingDistance: [{ key: 'milk subscription', clicks: 1, impressions: 120, ctr: 0.008, position: 8.7 }],
      traffic: {
        sessions: 251,
        users: 191,
        engagementRate: 0.667,
        keyEvents: 0,
        channels: [
          { channel: 'Direct', sessions: 183, share: 0.726, engagementRate: 0.62, keyEvents: 0 },
          { channel: 'Organic Search', sessions: 54, share: 0.214, engagementRate: 0.78, keyEvents: 0 },
          { channel: 'Referral', sessions: 13, share: 0.052, engagementRate: 0.7, keyEvents: 0 },
          { channel: 'Unassigned', sessions: 2, share: 0.008, engagementRate: 0.5, keyEvents: 0 },
        ],
        landingPages: [{ page: '/', sessions: 140, engagementRate: 0.68, keyEvents: 0 }],
        sources: [],
        countries: [{ country: 'India', sessions: 107 }],
        cities: [
          { city: 'Mumbai', country: 'India', sessions: 77 },
          { city: 'Council Bluffs', country: 'United States', sessions: 45 },
          { city: '(not set)', country: '(not set)', sessions: 22 },
          { city: 'Navi Mumbai', country: 'India', sessions: 14 },
          { city: 'Thane', country: 'India', sessions: 11 },
        ],
      },
      business: {
        businessName: 'MilQuuFresh',
        industry: 'Fresh Milk Delivery in Navi Mumbai',
        summary: 'Daily milk subscriptions delivered to your doorstep.',
        businessModel: 'D2C Subscription',
        targetAudience: 'Families',
        businessGoal: 'Subscriptions',
        offerings: ['Fresh Milk Delivery'],
        targetCities: ['Navi Mumbai', 'Mumbai'],
        primaryCity: 'Navi Mumbai',
        state: 'Maharashtra',
        country: 'India',
        seedKeywords: ['milk subscription'],
        pagesAudited: 41,
        crawledAt: '2026-11-20T00:00:00Z',
        healthScore: 88,
        auditedPages: [{ path: '/', title: 'Fresh Milk Delivery' }],
      },
      locationGaps: [
        {
          location: 'Navi Mumbai',
          source: 'business_profile',
          sessions: 14,
          searchClicks: 0,
          searchImpressions: 0,
          status: 'LOW_TRAFFIC',
          finding: '14 GA4 sessions and 0 search clicks in Navi Mumbai.',
          plan: 'Build dedicated local page for Navi Mumbai.',
          recommendedSteps: ['Optimize / for Fresh Milk Delivery in Navi Mumbai'],
          relevantOfferings: ['Fresh Milk Delivery'],
          matchingPages: ['/'],
        },
        {
          location: 'Mumbai',
          source: 'website_audit',
          sessions: 77,
          searchClicks: 0,
          searchImpressions: 19,
          status: 'LOW_TRAFFIC',
          finding: '77 GA4 sessions and 0 search clicks (19 impressions) in Mumbai.',
          plan: 'Upgrade title & meta for Mumbai.',
          recommendedSteps: ['Optimize /locations/mumbai for Fresh Milk Delivery in Mumbai'],
          relevantOfferings: ['Fresh Milk Delivery'],
          matchingPages: [],
        },
      ],
    });

    const diag = computeTrafficDiagnostics(f);
    expect(diag.botAndNoise.suspectedBotSessions).toBe(45);
    expect(diag.botAndNoise.suspectedBotCities[0].city).toBe('Council Bluffs');
    expect(diag.botAndNoise.notSetCitySessions).toBe(22);
    expect(diag.botAndNoise.estimatedHumanSessions).toBe(206);
    expect(diag.conversionTracking.status).toBe('ZERO_RECORDED');
    expect(diag.attributionHealth.status).toBe('DARK_TRAFFIC_HIGH');
    expect(diag.attributionHealth.utmTemplates.length).toBe(3);
    expect(diag.targetMarketFit.targetCitySessions).toBe(91); // 77 Mumbai + 14 Navi Mumbai
    expect(diag.targetMarketFit.topUntappedCities[0].city).toBe('Thane');

    const enriched = enrichAnalysisWithBusinessGaps(null, { ...f, diagnostics: diag });
    // Both Navi Mumbai AND Mumbai are preserved in priorities (Mumbai not silently dropped!)
    expect(enriched.priorities.some((p) => queryMatchesLocation(p.title, 'Navi Mumbai', ['Navi Mumbai', 'Mumbai']))).toBe(true);
    expect(enriched.priorities.some((p) => queryMatchesLocation(p.title, 'Mumbai', ['Navi Mumbai', 'Mumbai']))).toBe(true);
    // Key Events, Direct/Bot attribution, and Striking-Distance query all surfaced
    expect(enriched.priorities.some((p) => /key event/i.test(p.title))).toBe(true);
    expect(enriched.priorities.some((p) => /council bluffs|dark traffic/i.test(p.title))).toBe(true);
    expect(enriched.priorities.some((p) => p.title.includes('milk subscription'))).toBe(true);
    // Every channel gets a genuinely distinct strategy (never copy-pasted!)
    const strategies = enriched.marketingStrategy!.channels.map((c) => c.strategy);
    expect(new Set(strategies).size).toBe(strategies.length);
  });
});
