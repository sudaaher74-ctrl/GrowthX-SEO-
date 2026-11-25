import { UnifiedReportContextService, extractLocationsFromPages } from './unified-report-context.service';
import {
  formatBusinessContextForPrompt,
  normalisePlaybook,
} from './report-playbook.types';

describe('UnifiedReportContextService & 7-layer report playbook helpers', () => {
  it('dynamically detects covered areas from own pages and missing areas from competitor pages without hardcoded city lists', async () => {
    const pageFindMany = jest
      .fn()
      .mockResolvedValueOnce([
        { url: 'https://milquufresh.in/', title: 'Fresh Milk Delivery in Navi Mumbai | MilQuu Fresh', h1: ['MilQuu Fresh'], pageType: 'HOME' },
        { url: 'https://milquufresh.in/fresh-milk-delivery-in-kharghar', title: 'Fresh Milk Delivery in Kharghar', h1: ['Kharghar'], pageType: 'LOCATION' },
        { url: 'https://milquufresh.in/fresh-milk-delivery-in-cbd-belapur', title: 'Fresh Milk Delivery in CBD Belapur', h1: ['CBD Belapur'], pageType: 'LOCATION' },
        { url: 'https://milquufresh.in/cart', title: 'Cart', h1: ['Cart'], pageType: 'OTHER' },
      ])
      .mockResolvedValueOnce([
        { url: 'https://rivaldairy.in/milk-delivery-in-vashi', title: 'Milk Delivery in Vashi', h1: ['Vashi'], pageType: 'LOCATION' },
        { url: 'https://rivaldairy.in/milk-delivery-in-nerul', title: 'Milk Delivery in Nerul', h1: ['Nerul'], pageType: 'LOCATION' },
        { url: 'https://rivaldairy.in/milk-delivery-in-kharghar', title: 'Milk Delivery in Kharghar', h1: ['Kharghar'], pageType: 'LOCATION' },
        { url: 'https://rivaldairy.in/locations/seawoods', title: 'Fresh Dairy Seawoods', h1: ['Seawoods'], pageType: 'LOCATION' },
      ]);

    const prisma: any = {
      project: {
        findUnique: jest.fn().mockResolvedValue({
          name: 'MilQuu Fresh',
          businessProfile: {
            businessName: 'MilQuu Fresh',
            domain: 'milquufresh.in',
            industry: 'Fresh Dairy & Morning Milk Delivery',
            businessModel: 'D2C Subscription',
            summary: 'Farm-fresh A2 Gir cow milk and buffalo milk delivered in glass bottles across Navi Mumbai.',
            offerings: ['A2 Cow Milk', 'Fresh Buffalo Milk', 'Desi Ghee', 'Fresh Paneer'],
            city: 'Navi Mumbai',
            state: 'Maharashtra',
            country: 'India',
            targetAudience: 'Families in Navi Mumbai housing societies',
            businessGoal: 'Grow daily milk subscription trials',
          },
          websites: [{ id: 'w1', domain: 'milquufresh.in' }],
        }),
      },
      crawlJob: {
        findFirst: jest.fn().mockResolvedValue({ id: 'job1', healthScore: 93, pagesCrawled: 41 }),
      },
      page: { findMany: pageFindMany },
      catalogProduct: {
        findMany: jest.fn().mockResolvedValue([
          { name: 'A2 Gir Cow Milk (1L)', priceMinorUnits: 12000, currency: 'INR', stockStatus: 'FOUND', url: 'https://milquufresh.in/a2-cow-milk' },
        ]),
      },
      marketingSignal: {
        findMany: jest.fn().mockResolvedValue([
          { kind: 'DELIVERY', text: 'Delivered fresh before 7 AM in glass bottles' },
        ]),
      },
      localLocation: {
        findMany: jest.fn().mockResolvedValue([
          {
            businessName: 'MilQuu Fresh Dairy',
            address: 'Sector 11, CBD Belapur, Navi Mumbai',
            rating: 4.8,
            reviewCount: 64,
          },
        ]),
      },
      competitorDomain: {
        findMany: jest.fn().mockResolvedValue([
          { website: { crawlJobs: [{ id: 'rival_job_1' }] } },
        ]),
        count: jest.fn().mockResolvedValue(4),
      },
      aiVisibilityMetrics: { findFirst: jest.fn().mockResolvedValue({ visibilityScore: 32 }) },
      aiVisibilitySettings: { findUnique: jest.fn().mockResolvedValue({ targetCity: 'Navi Mumbai', targetCountry: 'IN' }) },
      issue: { count: jest.fn().mockResolvedValue(14) },
    };

    const svc = new UnifiedReportContextService(prisma);
    const ctx = await svc.buildForProject('p1');

    expect(ctx).not.toBeNull();
    expect(ctx!.primaryCity).toBe('Navi Mumbai');
    expect(ctx!.coveredAreas).toEqual(expect.arrayContaining(['Kharghar', 'CBD Belapur']));
    expect(ctx!.missingAreas).toEqual(expect.arrayContaining(['Vashi', 'Nerul', 'Seawoods']));
    expect(ctx!.missingAreas).not.toContain('Kharghar');
    expect(ctx!.keyPages.map((p) => p.path)).not.toContain('/cart');
    expect(ctx!.catalogHighlights[0]).toMatchObject({ name: 'A2 Gir Cow Milk (1L)', price: '₹120' });
    expect(ctx!.trustSignals).toContain('Delivered fresh before 7 AM in glass bottles');
    expect(ctx!.localPresence).toMatchObject({ rating: 4.8, reviewCount: 64 });
    expect(ctx!.crossModuleSnapshot).toMatchObject({
      auditHealthScore: 93,
      pagesAudited: 41,
      openHighIssues: 14,
      aiCitationSharePct: 32,
      rivalCount: 4,
    });

    const promptBlock = formatBusinessContextForPrompt(ctx);
    expect(promptBlock).toContain('Navi Mumbai');
    expect(promptBlock).toContain('Kharghar, CBD Belapur');
    expect(promptBlock).toContain('Vashi');
    expect(promptBlock).toContain('₹120');
  });

  it('extractLocationsFromPages works for any global city and ignores non-location noise', () => {
    const extracted = extractLocationsFromPages(
      [
        { path: '/plumbing-in-round-rock', title: '24/7 Plumbing in Round Rock | Acme' },
        { path: '/areas/cedar-park', title: 'Cedar Park Service Area' },
        { path: '/blog/guide-in-minutes', title: 'Fix a leak in minutes' },
        { path: '/milk-in-glass-bottles', title: 'Delivered in glass bottles' },
      ],
      ['Austin'],
    );
    expect(extracted).toEqual(['Round Rock', 'Cedar Park']);
  });

  it('normalises partial or messy AI playbook JSON safely without throwing', () => {
    const normalized = normalisePlaybook({
      businessAngle: 'Win local neighborhoods first.',
      possibilities: [
        { tier: 'conservative', headline: 'Quick wins', expectedOutcome: 'Higher CTR', assumptions: ['Fix titles'], unlocksBy: ['Snippets'] },
      ],
      methods: [
        {
          category: 'local maps',
          title: 'Area pages',
          objective: 'Rank in missing areas',
          whyForThisBusiness: 'High local demand',
          howToApply: ['Publish area page', 'Add FAQ'],
          owner: 'web developer',
          effort: 'low',
          expectedImpact: 'critical',
          verifyWith: 'GSC clicks',
        },
      ],
      readyToUseAssets: [
        { kind: 'faq', title: 'Local FAQ', targetUrlOrChannel: '/area-slug', copyText: 'Q: Same-day? A: Yes.', usageNote: 'Paste on page' },
      ],
      roadmap90Day: [
        { phase: 'Days 1-30', goal: 'Fix core', ownerTasks: ['Ask for reviews'], developerTasks: ['Fix speed'], kpiTarget: 'Speed < 1s' },
      ],
    });

    expect(normalized).toBeDefined();
    expect(normalized!.methods[0].category).toBe('HYPER_LOCAL');
    expect(normalized!.methods[0].owner).toBe('developer');
    expect(normalized!.methods[0].expectedImpact).toBe('high');
    expect(normalized!.readyToUseAssets[0].kind).toBe('FAQ_BLOCK');
    expect(normalized!.roadmap90Day[0].ownerTasks).toEqual(['Ask for reviews']);
  });
});
