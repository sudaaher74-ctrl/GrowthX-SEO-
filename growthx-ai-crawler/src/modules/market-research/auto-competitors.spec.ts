import { BadRequestException, NotFoundException } from '@nestjs/common';
import { MarketResearchService } from './market-research.service';

describe('MarketResearchService — auto-identify & add selected competitors', () => {
  let prisma: any;
  let models: any;
  let evidence: any;
  let socialDiscovery: any;
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

    service = new MarketResearchService(prisma, models, evidence, socialDiscovery);
  });

  describe('autoIdentifyCompetitors', () => {
    it('identifies top 5 competitors for a website using category heuristics when AI is not configured', async () => {
      const result = await service.autoIdentifyCompetitors('org1', 'p1');

      expect(result).toBeDefined();
      expect(result.customerDomain).toBe('growthx.ai');
      expect(result.topCompetitors).toHaveLength(5);
      expect(result.topCompetitors[0]).toHaveProperty('domain');
      expect(result.topCompetitors[0]).toHaveProperty('name');
      expect(result.topCompetitors[0]).toHaveProperty('overlapScore');
      expect(result.topCompetitors[0]).toHaveProperty('marketPosition');
      expect(result.topCompetitors[0]).toHaveProperty('sampleKeywords');
      expect(result.topCompetitors[0].isAlreadyAdded).toBe(false);
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
