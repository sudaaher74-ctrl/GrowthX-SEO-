import { OpportunityDetectionService } from './opportunity-detection.service';

/**
 * Validates that opportunity detection finds genuine opportunities across
 * all categories (SEO, Content, Local, Technical, Business) and carries verified evidence.
 */
describe('OpportunityDetectionService', () => {
  const ourPages = [
    { url: 'https://aiva.com/', title: 'AIVA Enterprises', pageType: 'HOME', metaDescription: 'Welcome to AIVA Enterprises, leaders in food processing.', h1: ['AIVA Enterprises'], wordCount: 500 },
    { url: 'https://aiva.com/about', title: 'About | AIVA Enterprises', pageType: 'ABOUT', metaDescription: 'Learn about AIVA Enterprises and our rich history.', h1: ['About Us'], wordCount: 400 },
    { url: 'https://aiva.com/products/mango-pulp', title: 'Mango Pulp | AIVA Enterprises', pageType: 'PRODUCT', metaDescription: 'High quality processed mango pulp exporter.', h1: ['Mango Pulp Products'], wordCount: 650 },
    { url: 'https://aiva.com/products/banana-pulp', title: 'Banana Pulp | AIVA Enterprises', pageType: 'PRODUCT', metaDescription: 'Premium natural banana pulp supplier.', h1: ['Banana Pulp Products'], wordCount: 600 },
    { url: 'https://aiva.com/contact', title: 'Contact | AIVA Enterprises', pageType: 'CONTACT', metaDescription: 'Get in touch with AIVA Enterprises for bulk orders.', h1: ['Contact Us'], wordCount: 300 },
  ];
  const theirPages = [
    { url: 'https://ifp.com/', title: 'Indian Fruits Pulp', pageType: 'HOME', metaDescription: 'Home', h1: ['Home'], wordCount: 500 },
    { url: 'https://ifp.com/mango-pulp/', title: 'Mango Pulp | Indian Fruits Pulp', pageType: 'PRODUCT', metaDescription: 'Mango', h1: ['Mango'], wordCount: 500 },
    { url: 'https://ifp.com/guava-pulp/', title: 'Guava Pulp | Indian Fruits Pulp', pageType: 'PRODUCT', metaDescription: 'Guava', h1: ['Guava'], wordCount: 500 },
    { url: 'https://ifp.com/about-us/', title: 'About Us | Indian Fruits Pulp', pageType: 'ABOUT', metaDescription: 'About', h1: ['About'], wordCount: 500 },
    { url: 'https://ifp.com/contact-us/', title: 'Contact Us | Indian Fruits Pulp', pageType: 'CONTACT', metaDescription: 'Contact', h1: ['Contact'], wordCount: 500 },
  ];

  const build = (options: {
    demand?: any[];
    competitors?: any[];
    customOurPages?: any[];
    customTheirPages?: any[];
    issues?: any[];
    localProposals?: any[];
    localReviews?: any[];
  } = {}) => {
    const written: any[] = [];
    const prisma = {
      competitorDomain: {
        findMany: jest
          .fn()
          .mockResolvedValue(options.competitors ?? [{ id: 'c1', domain: 'ifp.com', websiteId: 'w-them' }]),
      },
      crawlJob: {
        findFirst: jest.fn(async ({ where }: any) => (where.website?.projectId ? { id: 'job-ours' } : { id: 'job-theirs' })),
      },
      page: {
        findMany: jest.fn(async ({ where }: any) => (where.crawlJobId === 'job-ours' ? (options.customOurPages ?? ourPages) : (options.customTheirPages ?? theirPages))),
      },
      issue: {
        findMany: jest.fn().mockResolvedValue(options.issues ?? []),
      },
      gbpFixProposal: {
        findMany: jest.fn().mockResolvedValue(options.localProposals ?? []),
      },
      localReview: {
        findMany: jest.fn().mockResolvedValue(options.localReviews ?? []),
      },
      project: {
        findFirst: jest.fn().mockResolvedValue({ name: 'AIVA Enterprises', domain: 'aiva.com' }),
      },
      growthOpportunity: {
        upsert: jest.fn(async (args: any) => {
          written.push(args);
          return {};
        }),
      },
    };
    const search = {
      top: jest.fn().mockResolvedValue(options.demand ?? []),
      strikingDistance: jest.fn().mockResolvedValue([]),
      ctrOpportunities: jest.fn().mockResolvedValue([]),
      declining: jest.fn().mockResolvedValue([]),
    };
    const analytics = {
      pageValue: jest.fn().mockResolvedValue({ rows: [], hasSearchData: false, hasAnalyticsData: false }),
    };
    return {
      prisma,
      search,
      analytics,
      written,
      service: new OpportunityDetectionService(prisma as any, search as any, analytics as any),
    };
  };

  const created = (written: any[]) => written.map((w) => w.create);

  describe('competitor gap joined with search demand', () => {
    it('finds a topic they cover and we do not', async () => {
      const { service, written } = build();

      await service.detect('o1', 'p1');

      const titles = created(written).map((o) => o.title);
      expect(titles.some((t: string) => /guava/i.test(t))).toBe(true);
    });

    it('does not report a topic we already cover under different wording', async () => {
      const { service, written } = build();

      await service.detect('o1', 'p1');

      expect(created(written).map((o) => o.title).some((t: string) => /mango/i.test(t))).toBe(false);
    });

    it('leaves out the pages every site has', async () => {
      const { service, written } = build();

      await service.detect('o1', 'p1');

      const titles = created(written).map((o) => o.title).join(' ');
      expect(titles).not.toMatch(/about us/i);
      expect(titles).not.toMatch(/contact us/i);
    });

    it('raises confidence when the customer has real impressions for it', async () => {
      const withoutDemand = build();
      await withoutDemand.service.detect('o1', 'p1');
      const bare = created(withoutDemand.written).find((o: any) => /guava/i.test(o.title));

      const withDemand = build({
        demand: [{ key: 'guava pulp supplier', clicks: 5, impressions: 4000, ctr: 0.001, position: 14 }],
      });
      await withDemand.service.detect('o1', 'p1');
      const evidenced = created(withDemand.written).find((o: any) => /guava/i.test(o.title));

      expect(evidenced.confidence).toBeGreaterThan(bare.confidence);
      expect(evidenced.potential).toBe('HIGH');
    });

    it('says demand is unknown rather than implying there is none', async () => {
      const { service, written } = build();

      await service.detect('o1', 'p1');

      const guava = created(written).find((o: any) => /guava/i.test(o.title));
      const demandRow = guava.evidence.find((e: any) => e.label === 'Your existing search demand');
      expect(demandRow.value).toMatch(/not known/i);
    });

    it('still produces findings when Search Console is not connected', async () => {
      const { service, search, written } = build();
      search.top.mockRejectedValue(new Error('not connected'));

      await service.detect('o1', 'p1');

      expect(created(written).length).toBeGreaterThan(0);
    });

    it('carries evidence on every row', async () => {
      const { service, written } = build();

      await service.detect('o1', 'p1');

      for (const opportunity of created(written)) {
        expect(Array.isArray(opportunity.evidence)).toBe(true);
        expect(opportunity.evidence.length).toBeGreaterThan(0);
        for (const item of opportunity.evidence) {
          expect(item.source).toBeTruthy();
        }
      }
    });

    it('never puts a currency figure on the potential', async () => {
      const { service, written } = build({
        demand: [{ key: 'guava pulp supplier', clicks: 5, impressions: 9000, ctr: 0.001, position: 14 }],
      });

      await service.detect('o1', 'p1');

      const text = JSON.stringify(created(written));
      expect(text).not.toMatch(/₹|\$\d|USD|INR/);
      expect(created(written).every((o: any) => ['HIGH', 'MEDIUM', 'LOW'].includes(o.potential))).toBe(true);
    });
  });

  describe('technical and on-page detectors', () => {
    it('detects broken links and critical crawl errors', async () => {
      const { service, written } = build({
        issues: [
          { id: 'i1', issueType: 'BROKEN_LINK_404', severity: 'CRITICAL', affectedUrl: 'https://aiva.com/broken-page' },
        ],
      });

      await service.detect('o1', 'p1');

      const broken = created(written).find((o: any) => /crawl error/i.test(o.title));
      expect(broken).toBeTruthy();
      expect(broken.category).toBe('TECHNICAL');
      expect(broken.source).toBe('WEBSITE');
    });

    it('detects missing meta descriptions on crawled pages', async () => {
      const customPages = [
        { url: 'https://aiva.com/service-x', title: 'Service X', pageType: 'SERVICE', metaDescription: '', h1: ['Service X'], wordCount: 400 },
      ];
      const { service, written } = build({ customOurPages: customPages });

      await service.detect('o1', 'p1');

      const metaOpp = created(written).find((o: any) => /meta description/i.test(o.title));
      expect(metaOpp).toBeTruthy();
      expect(metaOpp.category).toBe('SEO');
    });

    it('detects local SEO and business opportunities', async () => {
      const { service, written } = build();

      await service.detect('o1', 'p1');

      const localOpp = created(written).find((o: any) => o.category === 'LOCAL');
      expect(localOpp).toBeTruthy();

      const bizOpp = created(written).find((o: any) => o.category === 'BUSINESS');
      expect(bizOpp).toBeTruthy();
    });
  });

  describe('reconciliation across runs', () => {
    it('keys each finding stably so a dismissal is not undone', async () => {
      const first = build();
      await first.service.detect('o1', 'p1');
      const second = build();
      await second.service.detect('o1', 'p1');

      const before = first.written.map((w) => w.where.projectId_fingerprint.fingerprint).sort();
      const after = second.written.map((w) => w.where.projectId_fingerprint.fingerprint).sort();
      expect(after).toEqual(before);
    });

    it('never overwrites status on an existing row', async () => {
      const { service, written } = build();

      await service.detect('o1', 'p1');

      for (const call of written) {
        expect(call.update).not.toHaveProperty('status');
        expect(call.update).not.toHaveProperty('dismissedAt');
        expect(call.update).toHaveProperty('evidence');
        expect(call.update).toHaveProperty('lastSeenAt');
      }
    });
  });

  describe('detector isolation', () => {
    it('keeps the other detectors when one throws', async () => {
      const { service, search, written } = build();
      search.strikingDistance.mockRejectedValue(new Error('gsc down'));

      const result = await service.detect('o1', 'p1');

      expect(result.failedDetectors).toContain('striking-distance');
      expect(written.length).toBeGreaterThan(0);
    });
  });

  describe('priority', () => {
    it('puts a cheap high-potential fix above an expensive one', async () => {
      const { service, written } = build();
      const search = (service as any).search;
      search.ctrOpportunities.mockResolvedValue([
        {
          key: 'https://aiva.com/x',
          clicks: 10,
          impressions: 20000,
          ctr: 0.005,
          position: 3,
          expectedCtr: 0.11,
          shortfall: 0.105,
          estimatedMissedClicks: 2100,
        },
      ]);

      await service.detect('o1', 'p1');

      const ctr = created(written).find((o: any) => /Rewrite the title/i.test(o.title));
      const gap = created(written).find((o: any) => /guava/i.test(o.title));
      expect(ctr.priority).toBeGreaterThan(gap.priority);
    });
  });

  describe('declining queries', () => {
    it('reports the movement and no cause', async () => {
      const { service, written } = build();
      (service as any).search.declining.mockResolvedValue([
        {
          query: 'mango pulp export',
          previousPosition: 6.2,
          currentPosition: 11.4,
          positionChange: -5.2,
          previousClicks: 120,
          currentClicks: 30,
          impressions: 8000,
        },
      ]);

      await service.detect('o1', 'p1');

      const decline = created(written).find((o: any) => /fell from position/i.test(o.title));
      expect(decline.summary).not.toMatch(/because|caused|due to/i);
      expect(decline.recommendedAction).toMatch(/check/i);
    });
  });

  describe('analytics-backed findings', () => {
    const page = (over: any = {}) => ({
      page: 'https://aiva.com/services/kitchens',
      clicks: 400,
      impressions: 9000,
      position: 7.2,
      sessions: 380,
      conversions: 21,
      revenue: null,
      conversionRate: 21 / 380,
      ...over,
    });

    it('finds a page that already converts and still has ranking headroom', async () => {
      const { service, analytics, written } = build();
      analytics.pageValue.mockResolvedValue({ rows: [page()], hasSearchData: true, hasAnalyticsData: true });

      await service.detect('o1', 'p1');

      const found = created(written).find((o: any) => /already converts/i.test(o.title));
      expect(found).toBeTruthy();
      expect(found.confidence).toBeGreaterThan(90);
      expect(found.source).toBe('ANALYTICS');
    });

    it('leaves a page alone when it already ranks at the top', async () => {
      const { service, analytics, written } = build();
      analytics.pageValue.mockResolvedValue({ rows: [page({ position: 1.4 })], hasSearchData: true, hasAnalyticsData: true });

      await service.detect('o1', 'p1');

      expect(created(written).some((o: any) => /already converts/i.test(o.title))).toBe(false);
    });

    it('will not call a page high-value on unmeasured conversions', async () => {
      const { service, analytics, written } = build();
      analytics.pageValue.mockResolvedValue({
        rows: [page({ conversions: null, conversionRate: null })],
        hasSearchData: true,
        hasAnalyticsData: true,
      });

      await service.detect('o1', 'p1');

      expect(created(written).some((o: any) => /already converts/i.test(o.title))).toBe(false);
    });

    it('flags a page with real traffic and a measured zero conversions', async () => {
      const { service, analytics, written } = build();
      analytics.pageValue.mockResolvedValue({
        rows: [page({ conversions: 0, sessions: 1500, conversionRate: 0 })],
        hasSearchData: true,
        hasAnalyticsData: true,
      });

      await service.detect('o1', 'p1');

      const found = created(written).find((o: any) => /converts none of them/i.test(o.title));
      expect(found).toBeTruthy();
      expect(found.potential).toBe('HIGH');
    });

    it('does not flag zero conversions when conversions are not tracked at all', async () => {
      const { service, analytics, written } = build();
      analytics.pageValue.mockResolvedValue({
        rows: [page({ conversions: null, sessions: 1500, conversionRate: null })],
        hasSearchData: true,
        hasAnalyticsData: true,
      });

      await service.detect('o1', 'p1');

      expect(created(written).some((o: any) => /converts none of them/i.test(o.title))).toBe(false);
    });

    it('produces no analytics findings when GA4 has never synced', async () => {
      const { service, written } = build();

      await service.detect('o1', 'p1');

      expect(created(written).every((o: any) => o.source !== 'ANALYTICS')).toBe(true);
    });
  });
});
