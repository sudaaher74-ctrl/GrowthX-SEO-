import { AiVisibilityInsightsService } from './ai-visibility-insights.service';

describe('AiVisibilityInsightsService', () => {
  const businessContext = {
    businessName: 'MilQuu Fresh',
    domain: 'milquufresh.in',
    industry: 'Fresh Dairy & Morning Milk Delivery',
    businessModel: 'D2C Subscription',
    summary: 'Fresh A2 cow and buffalo milk delivered across Navi Mumbai.',
    targetAudience: 'Navi Mumbai households',
    businessGoal: 'Grow milk trial orders',
    offerings: ['A2 Cow Milk', 'Buffalo Milk', 'Fresh Paneer'],
    primaryCity: 'Navi Mumbai',
    state: 'Maharashtra',
    country: 'India',
    serviceAreas: ['Navi Mumbai'],
    coveredAreas: ['Kharghar', 'CBD Belapur'],
    missingAreas: ['Vashi', 'Nerul', 'Seawoods'],
    keyPages: [{ path: '/fresh-milk-delivery-kharghar', title: 'Fresh Milk Delivery in Kharghar', pageType: 'LOCATION' }],
    catalogHighlights: [{ name: 'A2 Cow Milk 1L', price: '₹120', stock: 'FOUND', url: 'https://milquufresh.in/a2' }],
    trustSignals: ['Glass bottles delivered before 7 AM'],
    localPresence: { rating: 4.8, reviewCount: 64, address: 'CBD Belapur, Navi Mumbai', businessName: 'MilQuu Fresh' },
    crossModuleSnapshot: { auditHealthScore: 93, pagesAudited: 41, openHighIssues: 14, aiCitationSharePct: 25, rivalCount: 3 },
  };

  function makeService(checked: number, routerImpl: jest.Mock) {
    const prisma: any = {
      project: { findUnique: jest.fn().mockResolvedValue({ organizationId: 'org_1' }) },
    };
    const visibility: any = {
      getReport: jest.fn().mockResolvedValue({
        periodStart: '2026-11-01',
        periodEnd: '2026-11-25',
        summary: { checked, cited: checked ? 2 : 0, citationSharePct: checked ? 25 : 0, averagePosition: 2.5, failedChecks: 0 },
        byAssistant: [{ assistant: 'GEMINI', model: 'gemini-3.1-flash-lite', checked, cited: checked ? 2 : 0, citationSharePct: checked ? 25 : 0 }],
        shareOfVoice: [
          { domain: 'countrydelight.in', label: 'Country Delight', mentions: 6, sharePct: 60 },
          { domain: null, label: 'MilQuu Fresh', mentions: 2, sharePct: 25 },
        ],
      }),
      getQuestionAnalysis: jest.fn().mockResolvedValue({
        questions: [
          {
            id: 'q1',
            text: 'Best pure A2 cow milk delivery in Vashi Navi Mumbai?',
            outcome: 'NOT_CITED',
            answer: { competitorsCited: ['Country Delight'] },
            ownPage: null,
            comparison: [],
          },
        ],
      }),
      getCitationsIntelligence: jest.fn().mockResolvedValue({
        totalCitations: 5,
        citationsByDomain: [{ domain: 'justdial.com', count: 3, ownCited: false }],
      }),
    };
    const router: any = { generate: routerImpl };
    const reportContext: any = { buildForProject: jest.fn().mockResolvedValue(businessContext) };
    return { service: new AiVisibilityInsightsService(prisma, visibility, router, reportContext), router };
  }

  it('returns NO_DATA without spending AI tokens when zero checks exist', async () => {
    const gen = jest.fn();
    const { service } = makeService(0, gen);
    const res = await service.getInsights('p1');
    expect(res.status).toBe('NO_DATA');
    expect(res.businessContext?.primaryCity).toBe('Navi Mumbai');
    expect(gen).not.toHaveBeenCalled();
  });

  it('returns READY insights with hyper-local playbook and caches identical reads', async () => {
    const gen = jest.fn().mockResolvedValue({
      model: 'gemini-3.1-flash-lite',
      refused: false,
      text: JSON.stringify({
        summary: 'MilQuu Fresh needs Vashi and Nerul answer blocks plus Google reviews to overtake Country Delight in Navi Mumbai AI answers.',
        findings: [{ title: 'Missing Vashi page', detail: 'No page covers Vashi.', evidence: '0/1 cited' }],
        recommendations: [{ title: 'Publish Vashi FAQ', category: 'CONTENT', priority: 'HIGH', effort: 'LOW', rationale: 'Direct answer', evidence: 'Missed Q1' }],
        playbook: {
          businessAngle: 'Own Navi Mumbai node-level purity proof.',
          possibilities: [
            { tier: 'conservative', timeframe: '30 days', headline: 'Add FAQ blocks', expectedOutcome: 'Lift citations on core prompts', assumptions: ['Publish FAQ'], unlocksBy: ['FAQPage schema'] },
          ],
          methods: [
            { category: 'AI_CITATIONS', title: 'Node FAQ hubs', objective: 'Win local AI answers', whyForThisBusiness: 'Navi Mumbai buyers search by node', howToApply: ['Publish /vashi'], owner: 'both', effort: 'low', expectedImpact: 'high', verifyWith: 'Citation share' },
          ],
          readyToUseAssets: [
            { kind: 'AI_QUOTABLE_SUMMARY', title: 'Vashi A2 Milk Answer', targetUrlOrChannel: '/fresh-milk-delivery-vashi', copyText: 'MilQuu Fresh delivers A2 cow milk in Vashi before 7 AM.', usageNote: 'Add to /vashi' },
          ],
          roadmap90Day: [
            { phase: 'Days 1–30', goal: 'Publish FAQ + GBP reviews', ownerTasks: ['Collect Vashi reviews'], developerTasks: ['Ship /llms.txt'], kpiTarget: '35%+ citation share' },
          ],
        },
      }),
    });
    const { service } = makeService(8, gen);

    const first = await service.getInsights('p1');
    const second = await service.getInsights('p1');

    expect(first.status).toBe('READY');
    expect(first.businessContext?.primaryCity).toBe('Navi Mumbai');
    expect(first.playbook?.readyToUseAssets[0].copyText).toContain('Vashi');
    expect(gen).toHaveBeenCalledTimes(1); // second call served from cache
    expect(second.summary).toBe(first.summary);
  });

  it('returns honest NO_DATA without fabricating canned advice or caching when Gemini errors', async () => {
    const gen = jest.fn().mockRejectedValue(new Error('rate limited'));
    const { service } = makeService(8, gen);

    const first = await service.getInsights('p1');
    const second = await service.getInsights('p1');

    expect(first.status).toBe('NO_DATA');
    expect(first.summary).toBeNull();
    expect(first.findings).toEqual([]);
    expect(first.businessContext?.primaryCity).toBe('Navi Mumbai');
    expect(gen).toHaveBeenCalledTimes(2); // failed calls are NOT cached
    expect(second.status).toBe('NO_DATA');
  });
});
