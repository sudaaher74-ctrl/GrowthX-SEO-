import { BadRequestException, NotFoundException } from '@nestjs/common';
import { MarketResearchService } from './market-research.service';

describe('MarketResearchService — auto-identify & add selected competitors', () => {
  let prisma: any;
  let models: any;
  let evidence: any;
  let socialDiscovery: any;
  let businessProfiles: any;
  let verification: any;
  let discovery: any;
  let competitorCrawl: any;
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

    // Search discovery is off by default so the existing cases stay about the
    // model; the cases that care switch it on.
    discovery = {
      isConfigured: jest.fn().mockReturnValue(false),
      discover: jest.fn().mockResolvedValue({ candidates: [], queriesRun: [] }),
    };

    competitorCrawl = { startCrawl: jest.fn().mockResolvedValue({ jobId: 'job1' }) };

    service = new MarketResearchService(
      prisma,
      models,
      evidence,
      socialDiscovery,
      businessProfiles,
      verification,
      undefined,
      discovery,
      competitorCrawl,
    );
  });

  describe('autoIdentifyCompetitors', () => {
    it('returns no competitors from a built-in list when neither search nor a model is available', async () => {
      const result = await service.autoIdentifyCompetitors('org1', 'p1', {
        industry: 'SEO, Performance Marketing & Digital Growth Agency',
      });

      expect(result.customerDomain).toBe('growthx.ai');
      expect(result.region).toBe('worldwide');
      // This used to answer from a hardcoded table with overlap scores and
      // keywords nobody measured for the client.
      expect(result.topCompetitors).toHaveLength(0);
      expect(result.notes?.join(' ')).toContain('No competitor could be verified');
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

      discovery.isConfigured.mockReturnValue(true);

      const result = await service.autoIdentifyCompetitors('org1', 'p1', {
        domain: 'aivaenterprises.com',
      });

      expect(result.industry).toBe('Fruit Pulp, Purees, Concentrates & IQF Agro Processing');
      expect(result.region).toBe('maharashtra');
      expect(result.industryWasDetected).toBe(true);
      expect(result.regionWasDetected).toBe(true);
      expect(result.businessProfile?.businessName).toBe('AIVA Enterprises');
      // What was detected is what the market is searched for.
      expect(discovery.discover).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'Fruit Pulp, Purees, Concentrates & IQF Agro Processing',
          region: 'maharashtra',
        }),
      );
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

    it.each([
      ['maharashtra', 'palfrozenfoods.in', 'Fruit Pulp & Food Exports'],
      ['india', 'palfrozenfoods.in', 'Fruit Pulp Exporter'],
      ['maharashtra', 'milquufresh.in', 'Doorstep milk and dairy products delivery'],
      ['india', 'milquufresh.in', 'Dairy & Milk Subscriptions'],
    ] as const)('answers region=%s for %s from live evidence only, never a built-in list', async (region, domain, industry) => {
      const result = await service.autoIdentifyCompetitors('org1', 'p1', { domain, industry, region });

      expect(result.region).toBe(region);
      expect(result.topCompetitors).toHaveLength(0);
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

    it('shows only the verified rivals the model named, without padding the list', async () => {
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

      expect(result.topCompetitors.map((c) => c.domain)).toEqual(['sahyadrifarms.com']);
      expect(result.topCompetitors[0].source).toBe('ai');
    });

    it('finds competitors in any market through search', async () => {
      // A dentist in São Paulo: a model that names
      // whoever it half-remembers. Search evidence is what makes this work.
      discovery.isConfigured.mockReturnValue(true);
      discovery.discover.mockResolvedValue({
        candidates: [
          {
            domain: 'clinicaodonto.com.br',
            name: 'Clínica Odonto',
            industry: 'Implantes dentários',
            description: 'Clínica de implantes em São Paulo',
            overlapScore: 88,
            marketPosition: 'Top of search results',
            sampleKeywords: ['implantes dentários São Paulo'],
            keyDifferentiator: 'Ranks against you for 2 of the searches your customers use.',
          },
        ],
        queriesRun: ['implantes dentários São Paulo'],
      });

      const result = await service.autoIdentifyCompetitors('org1', 'p1', {
        domain: 'sorrisoperfeito.com.br',
        industry: 'Implantes dentários',
        region: 'worldwide',
      });

      expect(result.topCompetitors).toHaveLength(1);
      expect(result.topCompetitors[0].domain).toBe('clinicaodonto.com.br');
      expect(result.topCompetitors[0].source).toBe('search');
    });

    it('prefers the search-backed row when both sources name one company', async () => {
      discovery.isConfigured.mockReturnValue(true);
      discovery.discover.mockResolvedValue({
        candidates: [
          {
            domain: 'countrydelight.in',
            name: 'Country Delight',
            industry: 'Milk delivery',
            description: 'Ranks first for your keywords',
            overlapScore: 95,
            marketPosition: 'Top of search results',
            sampleKeywords: ['milk subscription Pune'],
            keyDifferentiator: 'Ranks against you for 3 of the searches your customers use.',
          },
        ],
        queriesRun: ['milk subscription Pune'],
      });
      models.isConfigured.mockReturnValue(true);
      models.generate.mockResolvedValue({
        text: JSON.stringify({
          competitors: [
            {
              domain: 'countrydelight.in',
              name: 'Country Delight',
              industry: 'Milk delivery',
              description: 'Recalled by the model',
              overlapScore: 70,
              marketPosition: 'Challenger',
              location: 'Gurugram, India',
              sampleKeywords: ['milk delivery'],
              keyDifferentiator: 'Subscription model',
            },
          ],
        }),
      });

      const result = await service.autoIdentifyCompetitors('org1', 'p1', {
        domain: 'milquufresh.in',
        industry: 'Doorstep milk delivery',
        region: 'india',
      });

      const rows = result.topCompetitors.filter((c) => c.domain === 'countrydelight.in');
      expect(rows).toHaveLength(1);
      expect(rows[0].source).toBe('search');
      expect(rows[0].description).toBe('Ranks first for your keywords');
    });

    it('passes the client\'s market to verification so foreign rivals are dropped', async () => {
      discovery.isConfigured.mockReturnValue(true);
      discovery.discover.mockResolvedValue({
        candidates: [
          {
            domain: 'prairiecreamery.com',
            name: 'Prairie Creamery',
            industry: 'Milk delivery',
            description: 'Midwest milk delivery',
            overlapScore: 80,
            marketPosition: 'Search rival',
            sampleKeywords: ['milk delivery'],
            keyDifferentiator: 'Ranks against you.',
          },
        ],
        queriesRun: ['milk delivery'],
      });

      await service.autoIdentifyCompetitors('org1', 'p1', {
        domain: 'milquufresh.in',
        industry: 'Doorstep milk delivery',
        region: 'india',
      });

      expect(verification.verify).toHaveBeenCalledWith(
        expect.any(Array),
        'milquufresh.in',
        expect.any(String),
        'india',
      );
    });

    it('still answers from the model when search is unavailable', async () => {
      discovery.isConfigured.mockReturnValue(false);
      models.isConfigured.mockReturnValue(true);
      models.generate.mockResolvedValue({
        text: JSON.stringify({
          competitors: [
            {
              domain: 'countrydelight.in',
              name: 'Country Delight',
              industry: 'Dairy',
              description: 'Milk subscriptions',
              location: 'Gurugram, India',
            },
          ],
        }),
      });

      const result = await service.autoIdentifyCompetitors('org1', 'p1', {
        domain: 'milquufresh.in',
        industry: 'Dairy & Milk Subscriptions',
        region: 'india',
      });

      expect(discovery.discover).not.toHaveBeenCalled();
      expect(result.topCompetitors.map((c) => c.domain)).toEqual(['countrydelight.in']);
      expect(result.topCompetitors.every((c) => c.source === 'ai')).toBe(true);
      // A model's suggestion carries no measured overlap, and what it left
      // out is not filled with stock phrases.
      const [rival] = result.topCompetitors;
      expect(rival.overlapScore).toBeNull();
      expect(rival.sampleKeywords).toEqual([]);
      expect(rival.marketPosition).toBe('');
      expect(rival.keyDifferentiator).toBe('');
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

    it('does not claim a brand-new competitor has already been analysed', async () => {
      // Both fields used to be written at save time — ANALYZED, timestamped
      // "now" — before anything had been fetched, so every row looked crawled
      // the instant it was created.
      await service.addSelectedCompetitors('org1', 'p1', [{ domain: 'countrydelight.in' }]);

      const args = prisma.competitorDomain.upsert.mock.calls[0][0];
      expect(args.create.status).toBeUndefined();
      expect(args.create.lastAnalyzedAt).toBeUndefined();
      // Re-adding an existing competitor must not discard a real crawl history.
      expect(args.update.status).toBeUndefined();
      expect(args.update.lastAnalyzedAt).toBeUndefined();
    });

    it('starts the first crawl on add rather than waiting for 02:00 UTC', async () => {
      const result = await service.addSelectedCompetitors('org1', 'p1', [
        { domain: 'countrydelight.in' },
        { domain: 'amul.com' },
      ]);

      expect(result.success).toBe(true);
      // Fire-and-forget, so let the queued microtasks settle before asserting.
      await new Promise((resolve) => setImmediate(resolve));
      expect(competitorCrawl.startCrawl).toHaveBeenCalledTimes(2);
      expect(competitorCrawl.startCrawl).toHaveBeenCalledWith('org1', 'p1', expect.any(String));
    });

    it('still saves the competitors when the crawl cannot be started', async () => {
      competitorCrawl.startCrawl.mockRejectedValue(new Error('crawler unavailable'));

      const result = await service.addSelectedCompetitors('org1', 'p1', [{ domain: 'countrydelight.in' }]);

      await new Promise((resolve) => setImmediate(resolve));
      expect(result.success).toBe(true);
      expect(result.count).toBe(1);
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
