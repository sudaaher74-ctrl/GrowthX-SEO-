import { KeywordBusinessBridgeService } from './keyword-business-bridge.service';
import { VideoIntelligenceService } from './video-intelligence.service';
import { VideoScriptGeneratorService } from './video-script-generator.service';

/**
 * Each of these services used to answer a failure with plausible content: a
 * stock video transcript saved against a competitor's reel, a template script
 * with the brand's name dropped in, three fruit-pulp export opportunities with
 * invented search volumes. A customer cannot tell that kind of answer from a
 * real one, so a failure has to surface as a failure.
 */
describe('content intelligence never substitutes canned content', () => {
  describe('KeywordBusinessBridgeService', () => {
    function bridge(gaps: any[], project: any = { name: 'Aiva Fruits', locations: [] }) {
      const prisma: any = {
        contentGap: { findMany: jest.fn().mockResolvedValue(gaps) },
        project: { findUnique: jest.fn().mockResolvedValue(project) },
      };
      return new KeywordBusinessBridgeService(prisma);
    }

    it('returns no opportunities when gap analysis has found none', async () => {
      await expect(bridge([]).getEnrichedOpportunities('org', 'proj')).resolves.toEqual([]);
    });

    it('reports unmeasured scores and volumes as missing, not as typical values', async () => {
      const [opp] = await bridge([
        {
          id: 'g1',
          title: 'Cold chain explainer',
          description: 'Rivals publish it; you do not.',
          gapType: 'CUSTOMER_MISSING',
          opportunityScore: 71,
          businessRelevanceScore: null,
          searchOpportunityScore: null,
          competitorEvidenceScore: null,
          contentGapScore: null,
          confidenceScore: null,
          effortLevel: null,
          relatedKeywords: ['cold chain'],
          suggestedFormats: [],
          recommendedAction: null,
        },
      ]).getEnrichedOpportunities('org', 'proj');

      expect(opp.opportunityScore).toBe(71);
      expect(opp.breakdown).toEqual({
        businessRelevance: null,
        searchOpportunity: null,
        competitorEvidence: null,
        contentGap: null,
        confidence: null,
        effort: null,
      });
      expect(opp.relatedKeywords).toEqual([{ keyword: 'cold chain' }]);
      expect(opp.targetMarket).toBeNull();
      expect(opp.recommendedAction).toBeNull();
    });
  });

  describe('VideoIntelligenceService', () => {
    const content = { id: 'c1', platform: 'INSTAGRAM', contentType: 'REEL', title: 'Our line' };

    function service(text: string) {
      const prisma: any = {
        competitorContent: { update: jest.fn() },
        contentClassification: { upsert: jest.fn() },
      };
      const router: any = { generate: jest.fn().mockResolvedValue({ text, model: 'm' }) };
      return { svc: new VideoIntelligenceService(prisma, router), prisma };
    }

    it.each([
      ['no answer', ''],
      ['an unreadable answer', 'not json at all'],
    ])('writes nothing on %s', async (_label, text) => {
      const { svc, prisma } = service(text);

      await expect(svc.analyzeVideoContent(content)).rejects.toThrow(/Nothing was saved/);
      expect(prisma.competitorContent.update).not.toHaveBeenCalled();
      expect(prisma.contentClassification.upsert).not.toHaveBeenCalled();
    });

    it('stores only what the model reported, with no invented confidence', async () => {
      const { svc, prisma } = service(JSON.stringify({ classification: { topic: 'Sorting line' } }));
      prisma.contentClassification.upsert.mockResolvedValue({});

      await svc.analyzeVideoContent(content);

      const { create } = prisma.contentClassification.upsert.mock.calls[0][0];
      expect(create.topic).toBe('Sorting line');
      expect(create.confidence).toBeNull();
      expect(create.hookType).toBeNull();
      expect(create.ctaType).toBeNull();
      expect(create).not.toHaveProperty('creativityScore');
      expect(prisma.competitorContent.update.mock.calls[0][0].data.whyItWorks).toBeNull();
    });
  });

  describe('VideoScriptGeneratorService', () => {
    function service(text: string) {
      const prisma: any = {
        project: { findUnique: jest.fn().mockResolvedValue({ name: 'Brand', locations: [] }) },
        contentIntelligenceConfig: { findUnique: jest.fn().mockResolvedValue(null) },
      };
      const router: any = { generate: jest.fn().mockResolvedValue({ text, model: 'm' }) };
      return new VideoScriptGeneratorService(prisma, router);
    }

    it.each([
      ['no answer', ''],
      ['an unreadable answer', '{{'],
      ['a script with no scenes', JSON.stringify({ title: 'T', scenes: [] })],
    ])('fails instead of returning a template on %s', async (_label, text) => {
      await expect(service(text).generateVideoScript('org', 'proj', 'Topic')).rejects.toThrow(/Try generating it again/);
    });

    it('never asserts the script was verified as original', async () => {
      const script = await service(
        JSON.stringify({
          title: 'T',
          hook: 'H',
          scenes: [{ sceneNumber: 1 }],
          originalityGuarantee: 'Verified 100% original',
        }),
      ).generateVideoScript('org', 'proj', 'Topic');

      expect(script).not.toHaveProperty('originalityGuarantee');
      expect(script.platform).toBe('INSTAGRAM_REEL');
    });
  });
});
