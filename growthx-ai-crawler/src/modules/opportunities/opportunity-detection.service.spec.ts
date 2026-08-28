import { OpportunityDetectionService } from './opportunity-detection.service';

/**
 * The failure mode of a recommendation list is that one wrong confident row
 * teaches the customer to ignore every real one next to it. So the tests here
 * are mostly about what it refuses to claim.
 */
describe('OpportunityDetectionService', () => {
  const ourPages = [
    { url: 'https://aiva.com/', title: 'AIVA Enterprises', pageType: 'HOME' },
    { url: 'https://aiva.com/about', title: 'About | AIVA Enterprises', pageType: 'ABOUT' },
    { url: 'https://aiva.com/products/mango-pulp', title: 'Mango Pulp | AIVA Enterprises', pageType: 'PRODUCT' },
    { url: 'https://aiva.com/products/banana-pulp', title: 'Banana Pulp | AIVA Enterprises', pageType: 'PRODUCT' },
    { url: 'https://aiva.com/contact', title: 'Contact | AIVA Enterprises', pageType: 'CONTACT' },
  ];
  const theirPages = [
    { url: 'https://ifp.com/', title: 'Indian Fruits Pulp', pageType: 'HOME' },
    { url: 'https://ifp.com/mango-pulp/', title: 'Mango Pulp | Indian Fruits Pulp', pageType: 'PRODUCT' },
    { url: 'https://ifp.com/guava-pulp/', title: 'Guava Pulp | Indian Fruits Pulp', pageType: 'PRODUCT' },
    { url: 'https://ifp.com/about-us/', title: 'About Us | Indian Fruits Pulp', pageType: 'ABOUT' },
    { url: 'https://ifp.com/contact-us/', title: 'Contact Us | Indian Fruits Pulp', pageType: 'CONTACT' },
  ];

  const build = (options: { demand?: any[]; competitors?: any[] } = {}) => {
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
        findMany: jest.fn(async ({ where }: any) => (where.crawlJobId === 'job-ours' ? ourPages : theirPages)),
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
    return { prisma, search, written, service: new OpportunityDetectionService(prisma as any, search as any) };
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
      // Their /mango-pulp/ and our /products/mango-pulp are the same topic.
      // Reporting it sends someone to write a page they have.
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
      // Their own Search Console is the strongest signal available: it is
      // their audience, not an estimate of a market.
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
      // With Search Console unconnected, "no impressions" and "we cannot see
      // impressions" are different facts, and only one is about the market.
      const { service, written } = build();

      await service.detect('o1', 'p1');

      const guava = created(written).find((o: any) => /guava/i.test(o.title));
      const demandRow = guava.evidence.find((e: any) => e.label === 'Your existing search demand');
      expect(demandRow.value).toMatch(/not known/i);
    });

    it('still produces findings when Search Console is not connected', async () => {
      // A competitor gap is worth surfacing before Google is connected; it
      // just carries lower confidence.
      const { service, search, written } = build();
      search.top.mockRejectedValue(new Error('not connected'));

      await service.detect('o1', 'p1');

      expect(created(written).length).toBeGreaterThan(0);
    });

    it('carries evidence on every row', async () => {
      // A recommendation nobody can check is a guess with better formatting.
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
      // Without revenue data attached to a page, a rupee amount is invented
      // precision, and one invented number discredits the real ones near it.
      const { service, written } = build({
        demand: [{ key: 'guava pulp supplier', clicks: 5, impressions: 9000, ctr: 0.001, position: 14 }],
      });

      await service.detect('o1', 'p1');

      const text = JSON.stringify(created(written));
      expect(text).not.toMatch(/₹|\$\d|USD|INR/);
      expect(created(written).every((o: any) => ['HIGH', 'MEDIUM', 'LOW'].includes(o.potential))).toBe(true);
    });

    it('produces nothing when no competitor has been crawled', async () => {
      const { service, written } = build({ competitors: [] });

      await service.detect('o1', 'p1');

      expect(written).toEqual([]);
    });
  });

  describe('reconciliation across runs', () => {
    it('keys each finding stably so a dismissal is not undone', async () => {
      // A dismissed opportunity returning tomorrow is the fastest way to make
      // the list worthless.
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
        // The numbers behind a finding do move, so evidence is refreshed.
        expect(call.update).toHaveProperty('evidence');
        expect(call.update).toHaveProperty('lastSeenAt');
      }
    });
  });

  describe('detector isolation', () => {
    it('keeps the other detectors when one throws', async () => {
      // A project with no Search Console should still get competitor findings.
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
      // Both high potential; the metadata rewrite is two fields and no new
      // content, so it should rank above writing a page.
      expect(ctr.priority).toBeGreaterThan(gap.priority);
    });
  });

  describe('declining queries', () => {
    it('reports the movement and no cause', async () => {
      // Search Console cannot say why a ranking fell.
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
});
