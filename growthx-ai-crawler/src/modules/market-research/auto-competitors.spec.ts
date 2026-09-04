import { BadRequestException, NotFoundException } from '@nestjs/common';
import { MarketResearchService } from './market-research.service';

describe('MarketResearchService — auto-identify & add selected competitors', () => {
  let prisma: any;
  let models: any;
  let evidence: any;
  let socialDiscovery: any;
  let businessProfiles: any;
  let verification: any;
  let service: MarketResearchService;

  beforeEach(() => {
    prisma = {
      project: {
        findFirst: jest.fn().mockResolvedValue({ id: 'p1', organizationId: 'org1' }),
        findUnique: jest.fn().mockResolvedValue({
          id: 'p1',
          name: 'GrowthX AI',
          organizationId: 'org1',
          websites: [{ id: 'w1', domain: 'growthx.ai', url: 'https://growthx.ai' }],
        }),
      },
      page: { findMany: jest.fn().mockResolvedValue([]) },
      competitorDomain: {
        findMany: jest.fn().mockResolvedValue([]),
        upsert: jest.fn().mockImplementation(({ create }) => Promise.resolve({ id: 'c1', ...create })),
      },
    };

    models = {
      isConfigured: jest.fn().mockReturnValue(false),
      generate: jest.fn(),
    };

    evidence = {};
    socialDiscovery = {
      saveDiscoveredCompetitor: jest.fn().mockResolvedValue({}),
    };

    // Detection is exercised in business-profile.service.spec. Here it returns
    // a bare profile so these tests stay about the competitor list — and so
    // nothing falls through to the live metadata fetch, which hits the network.
    businessProfiles = {
      getProfile: jest.fn().mockImplementation((_projectId: string, domain: string) =>
        Promise.resolve({
          domain,
          businessName: 'GrowthX AI',
          industry: 'Cloud Software, SaaS & Developer Platforms',
          summary: '',
          offerings: [],
          businessModel: '',
          city: '',
          state: '',
          country: '',
          suggestedRegion: 'worldwide',
          seedKeywords: [],
          confidence: 'low',
          signals: [],
          source: 'heuristic',
          detectedAt: new Date().toISOString(),
        }),
      ),
      overrideProfile: jest.fn(),
    };

    // Verification reaches the network in production. The default stub passes
    // everything through; tests that care about rejection override it.
    verification = {
      verify: jest.fn().mockImplementation((candidates: any[]) =>
        Promise.resolve({
          verified: candidates.map((c) => ({
            ...c,
            verified: true,
            verifiedTitle: c.name,
            verifiedAt: new Date().toISOString(),
            matchedTerms: [],
          })),
          rejected: [],
        }),
      ),
    };

    service = new MarketResearchService(
      prisma,
      models,
      evidence,
      socialDiscovery,
      businessProfiles,
      verification,
    );
  });

  describe('autoIdentifyCompetitors', () => {
    it('identifies top 5 competitors from the curated list when AI is not configured', async () => {
      const result = await service.autoIdentifyCompetitors('org1', 'p1', {
        industry: 'SEO, Performance Marketing & Digital Growth Agency',
      });

      expect(result).toBeDefined();
      expect(result.customerDomain).toBe('growthx.ai');
      expect(result.region).toBe('worldwide');
      expect(result.topCompetitors).toHaveLength(5);
      expect(result.topCompetitors[0]).toHaveProperty('domain');
      expect(result.topCompetitors[0]).toHaveProperty('name');
      expect(result.topCompetitors[0]).toHaveProperty('overlapScore');
      expect(result.topCompetitors[0]).toHaveProperty('marketPosition');
      expect(result.topCompetitors[0]).toHaveProperty('sampleKeywords');
      expect(result.topCompetitors[0].isAlreadyAdded).toBe(false);
      expect(result.topCompetitors.every((c) => c.verified)).toBe(true);
    });

    it('returns an empty list rather than padding an unrecognised niche with unrelated giants', async () => {
      const result = await service.autoIdentifyCompetitors('org1', 'p1', {
        domain: 'someuniquebusiness.com',
        industry: 'Bespoke Falconry Equipment Restoration',
      });

      // The old behaviour filled this case with TCS, Accenture and IBM, which
      // is what made the panel read as a demo.
      expect(result.topCompetitors).toHaveLength(0);
      expect(result.notes?.join(' ')).toContain('No competitor could be verified');
    });

    it('detects the niche and geography from the client website when the caller sends neither', async () => {
      businessProfiles.getProfile.mockResolvedValue({
        domain: 'aivaenterprises.com',
        businessName: 'AIVA Enterprises',
        industry: 'Fruit Pulp, Purees, Concentrates & IQF Agro Processing',
        summary: 'Exporter of aseptic mango pulp and IQF fruit from Nashik.',
        offerings: ['Aseptic mango pulp'],
        businessModel: 'B2B',
        city: 'Nashik',
        state: 'Maharashtra',
        country: 'India',
        suggestedRegion: 'maharashtra',
        seedKeywords: ['mango pulp exporter'],
        confidence: 'high',
        signals: [],
        source: 'ai',
        detectedAt: new Date().toISOString(),
      });

      const result = await service.autoIdentifyCompetitors('org1', 'p1', {
        domain: 'aivaenterprises.com',
      });

      expect(result.industry).toBe('Fruit Pulp, Purees, Concentrates & IQF Agro Processing');
      expect(result.region).toBe('maharashtra');
      expect(result.industryWasDetected).toBe(true);
      expect(result.regionWasDetected).toBe(true);
      expect(result.businessProfile?.businessName).toBe('AIVA Enterprises');
      expect(result.topCompetitors.length).toBeGreaterThan(0);
    });

    it('lets an explicit industry and region override what was detected', async () => {
      businessProfiles.getProfile.mockResolvedValue({
        domain: 'growthx.ai',
        businessName: 'GrowthX',
        industry: 'Cloud Software, SaaS & Developer Platforms',
        summary: '',
        offerings: [],
        businessModel: '',
        city: '',
        state: '',
        country: '',
        suggestedRegion: 'worldwide',
        seedKeywords: [],
        confidence: 'low',
        signals: [],
        source: 'heuristic',
        detectedAt: new Date().toISOString(),
      });

      const result = await service.autoIdentifyCompetitors('org1', 'p1', {
        industry: 'Logistics, Freight & Fleet Transportation Services',
        region: 'india',
      });

      expect(result.industry).toBe('Logistics, Freight & Fleet Transportation Services');
      expect(result.region).toBe('india');
      expect(result.industryWasDetected).toBe(false);
      expect(result.regionWasDetected).toBe(false);
    });

    it('identifies real competitors in Maharashtra when region=maharashtra is selected', async () => {
      const result = await service.autoIdentifyCompetitors('org1', 'p1', {
        domain: 'palfrozenfoods.in',
        industry: 'Fruit Pulp & Food Exports',
        region: 'maharashtra',
      });

      expect(result.region).toBe('maharashtra');
      expect(result.topCompetitors).toHaveLength(5);
      expect(result.topCompetitors.some((c) => c.domain.includes('sahyadrifarms.com') || c.domain.includes('jainfarmfresh.com'))).toBe(true);
      expect(result.topCompetitors[0].location).toContain('Maharashtra');
    });

    it('identifies real national competitors across India when region=india is selected', async () => {
      const result = await service.autoIdentifyCompetitors('org1', 'p1', {
        domain: 'palfrozenfoods.in',
        industry: 'Fruit Pulp Exporter',
        region: 'india',
      });

      expect(result.region).toBe('india');
      expect(result.topCompetitors).toHaveLength(5);
      expect(result.topCompetitors.some((c) => c.domain.includes('capricornfood.com') || c.domain.includes('shimlahills.com'))).toBe(true);
      expect(result.topCompetitors[0].location).toContain('India');
    });

    it('uses AI output when models are configured', async () => {
      models.isConfigured.mockReturnValue(true);
      models.generate.mockResolvedValue({
        text: JSON.stringify({
          competitors: [
            {
              domain: 'semrush.com',
              name: 'Semrush',
              industry: 'SEO Analytics',
              description: 'All-in-one marketing suite',
              overlapScore: 98,
              marketPosition: 'Market Leader',
              sampleKeywords: ['seo tool', 'backlink checker'],
              keyDifferentiator: 'Broad database',
            },
            {
              domain: 'ahrefs.com',
              name: 'Ahrefs',
              industry: 'SEO Intelligence',
              description: 'Backlink authority leader',
              overlapScore: 95,
              marketPosition: 'Main Challenger',
              sampleKeywords: ['keyword explorer', 'site audit'],
              keyDifferentiator: 'Deep web index',
            },
            {
              domain: 'surferseo.com',
              name: 'Surfer',
              industry: 'Content SEO',
              description: 'On-page content optimization',
              overlapScore: 90,
              marketPosition: 'Content Rival',
              sampleKeywords: ['content editor', 'nlp keywords'],
              keyDifferentiator: 'NLP analysis',
            },
            {
              domain: 'moz.com',
              name: 'Moz Pro',
              industry: 'SEO Suite',
              description: 'Domain authority analytics',
              overlapScore: 85,
              marketPosition: 'Established Brand',
              sampleKeywords: ['domain authority', 'rank tracker'],
              keyDifferentiator: 'DA metric',
            },
            {
              domain: 'spyfu.com',
              name: 'SpyFu',
              industry: 'Competitor Research',
              description: 'PPC & SEO competitor analysis',
              overlapScore: 82,
              marketPosition: 'Niche Rival',
              sampleKeywords: ['competitor keywords', 'ad history'],
              keyDifferentiator: 'PPC history',
            },
          ],
        }),
      });

      const result = await service.autoIdentifyCompetitors('org1', 'p1');

      expect(result.topCompetitors).toHaveLength(5);
      expect(result.topCompetitors[0].domain).toBe('semrush.com');
      expect(result.topCompetitors[1].domain).toBe('ahrefs.com');
    });

    it('drops AI suggestions that fail verification and says so in the notes', async () => {
      models.isConfigured.mockReturnValue(true);
      models.generate.mockResolvedValue({
        text: JSON.stringify({
          competitors: [
            {
              domain: 'sahyadrifarms.com',
              name: 'Sahyadri Farms',
              industry: 'Fruit Processing',
              description: 'Farmer collective and fruit processor',
              overlapScore: 96,
              marketPosition: 'Market Leader',
              location: 'Nashik, Maharashtra',
              sampleKeywords: ['mango pulp'],
              keyDifferentiator: 'Farmer supply chain',
            },
            {
              domain: 'marketpulse.in',
              name: 'MarketPulse',
              industry: 'Fruit Processing',
              description: 'Invented company',
              overlapScore: 91,
              marketPosition: 'Challenger',
              location: 'Pune, Maharashtra',
              sampleKeywords: ['fruit pulp'],
              keyDifferentiator: 'None — this domain does not exist',
            },
          ],
        }),
      });

      verification.verify.mockResolvedValue({
        verified: [
          {
            domain: 'sahyadrifarms.com',
            name: 'Sahyadri Farms',
            industry: 'Fruit Processing',
            description: 'Farmer collective and fruit processor',
            overlapScore: 96,
            marketPosition: 'Market Leader',
            location: 'Nashik, Maharashtra',
            sampleKeywords: ['mango pulp'],
            keyDifferentiator: 'Farmer supply chain',
            verified: true,
            verifiedTitle: 'Sahyadri Farms',
            verifiedAt: new Date().toISOString(),
            matchedTerms: ['pulp'],
          },
        ],
        rejected: [
          { domain: 'marketpulse.in', name: 'MarketPulse', reason: 'offline', detail: 'Did not resolve.' },
        ],
      });

      const result = await service.autoIdentifyCompetitors('org1', 'p1', {
        domain: 'aivaenterprises.com',
        industry: 'Fruit Pulp, Concentrates & Agro Exports',
        region: 'maharashtra',
      });

      expect(result.topCompetitors.some((c) => c.domain === 'marketpulse.in')).toBe(false);
      expect(result.topCompetitors[0].domain).toBe('sahyadrifarms.com');
      expect(result.rejected).toHaveLength(1);
      expect(result.rejected?.[0].reason).toBe('offline');
      expect(result.notes?.join(' ')).toContain('could not be verified');
    });

    it('never returns the same competitor twice after a top-up from the curated list', async () => {
      models.isConfigured.mockReturnValue(true);
      models.generate.mockResolvedValue({
        text: JSON.stringify({
          competitors: [
            {
              domain: 'sahyadrifarms.com',
              name: 'Sahyadri Farms',
              industry: 'Fruit Processing',
              description: 'Farmer collective',
              overlapScore: 96,
              marketPosition: 'Market Leader',
              location: 'Nashik, Maharashtra',
              sampleKeywords: ['mango pulp'],
              keyDifferentiator: 'Farmer supply chain',
            },
          ],
        }),
      });

      const result = await service.autoIdentifyCompetitors('org1', 'p1', {
        domain: 'aivaenterprises.com',
        industry: 'Fruit Pulp, Concentrates & Agro Exports',
        region: 'maharashtra',
      });

      const domains = result.topCompetitors.map((c) => c.domain);
      expect(new Set(domains).size).toBe(domains.length);
      expect(domains).toContain('sahyadrifarms.com');
    });

    it('fills a doorstep milk client with real dairy rivals when the AI list comes back thin', async () => {
      // The reported failure: a dairy client saw a single competitor. Four of
      // five AI suggestions failed verification and the curated list had no
      // dairy coverage to top up from, so the panel showed one card.
      models.isConfigured.mockReturnValue(true);
      models.generate.mockResolvedValue({
        text: JSON.stringify({
          competitors: [
            {
              domain: 'bigbasket.com',
              name: 'BigBasket',
              industry: 'Online Grocery',
              description: 'Online grocery platform with dairy',
              overlapScore: 50,
              marketPosition: 'Market leader in online grocery',
              location: 'Bengaluru, Karnataka, India',
              sampleKeywords: ['fresh milk online'],
              keyDifferentiator: 'Vast product assortment',
            },
          ],
        }),
      });

      const result = await service.autoIdentifyCompetitors('org1', 'p1', {
        domain: 'milquufresh.in',
        industry: 'Dairy, Fresh Milk Delivery & Milk Subscriptions',
        region: 'india',
      });

      expect(result.topCompetitors).toHaveLength(5);
      const domains = result.topCompetitors.map((c) => c.domain);
      expect(new Set(domains).size).toBe(domains.length);
      expect(domains).toContain('countrydelight.in');
      expect(domains).toContain('amul.com');
      expect(domains).toContain('motherdairy.com');
    });

    it('answers a Maharashtra dairy client with Maharashtra dairies, not fruit exporters', async () => {
      const result = await service.autoIdentifyCompetitors('org1', 'p1', {
        domain: 'milquufresh.in',
        industry: 'Doorstep milk and dairy products delivery',
        region: 'maharashtra',
      });

      expect(result.topCompetitors).toHaveLength(5);
      expect(result.topCompetitors.every((c) => c.location?.includes('Maharashtra'))).toBe(true);
      expect(result.topCompetitors.some((c) => c.domain === 'gokulmilk.coop')).toBe(true);
      // The food & agro list must not answer a dairy query.
      expect(result.topCompetitors.some((c) => c.domain === 'sahyadrifarms.com')).toBe(false);
    });

    it('does not list the same company twice when AI and the curated list both name it', async () => {
      models.isConfigured.mockReturnValue(true);
      models.generate.mockResolvedValue({
        text: JSON.stringify({
          competitors: [
            {
              domain: 'amul.co.in',
              name: 'Amul (GCMMF)',
              industry: 'Dairy',
              description: 'India largest dairy brand',
              overlapScore: 99,
              marketPosition: 'Category leader',
              location: 'Anand, Gujarat, India',
              sampleKeywords: ['amul milk'],
              keyDifferentiator: 'Farmer network',
            },
          ],
        }),
      });

      const result = await service.autoIdentifyCompetitors('org1', 'p1', {
        domain: 'milquufresh.in',
        industry: 'Dairy & Milk Subscriptions',
        region: 'india',
      });

      const names = result.topCompetitors.map((c) => c.name.toLowerCase());
      expect(new Set(names).size).toBe(names.length);
      expect(names.filter((n) => n.includes('amul'))).toHaveLength(1);
    });

    it('marks competitors as already added if they exist in the project', async () => {
      prisma.competitorDomain.findMany.mockResolvedValue([
        { id: 'comp_1', domain: 'semrush.com' },
      ]);

      const result = await service.autoIdentifyCompetitors('org1', 'p1');
      const semrush = result.topCompetitors.find((c) => c.domain === 'semrush.com');

      if (semrush) {
        expect(semrush.isAlreadyAdded).toBe(true);
        expect(semrush.existingId).toBe('comp_1');
      }
    });

    it('throws NotFoundException if the project does not belong to the organization', async () => {
      prisma.project.findFirst.mockResolvedValue(null);

      await expect(service.autoIdentifyCompetitors('org_wrong', 'p1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws BadRequestException if no website exists and none is provided in options', async () => {
      prisma.project.findUnique.mockResolvedValue({
        id: 'p1',
        name: 'Empty Project',
        websites: [],
      });

      await expect(service.autoIdentifyCompetitors('org1', 'p1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('addSelectedCompetitors', () => {
    it('saves selected competitors (e.g. 3 of 5) and triggers social discovery', async () => {
      const selected = [
        { domain: 'semrush.com', name: 'Semrush', industry: 'SEO Suite', confidenceScore: 96 },
        { domain: 'ahrefs.com', name: 'Ahrefs', industry: 'SEO Suite', confidenceScore: 93 },
        { domain: 'surferseo.com', name: 'Surfer SEO', industry: 'Content SEO', confidenceScore: 89 },
      ];

      const result = await service.addSelectedCompetitors('org1', 'p1', selected);

      expect(result.success).toBe(true);
      expect(result.count).toBe(3);
      expect(prisma.competitorDomain.upsert).toHaveBeenCalledTimes(3);
      expect(socialDiscovery.saveDiscoveredCompetitor).toHaveBeenCalledTimes(3);
    });

    it('rejects empty competitor list', async () => {
      await expect(service.addSelectedCompetitors('org1', 'p1', [])).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects more than 5 competitors', async () => {
      const tooMany = [
        { domain: 'c1.com' },
        { domain: 'c2.com' },
        { domain: 'c3.com' },
        { domain: 'c4.com' },
        { domain: 'c5.com' },
        { domain: 'c6.com' },
      ];

      await expect(service.addSelectedCompetitors('org1', 'p1', tooMany)).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
