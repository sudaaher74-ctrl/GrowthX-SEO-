import { ConfigService } from '@nestjs/config';
import { MammouthSeoService } from './mammouth-seo.service';
import { MultiAiRouterService, AiProvider, AiTask } from '../ai-search/multi-ai-router/multi-ai-router.service';

describe('MammouthSeoService', () => {
  let service: MammouthSeoService;
  let mockRouter: jest.Mocked<MultiAiRouterService>;
  let mockConfig: jest.Mocked<ConfigService>;

  beforeEach(() => {
    mockRouter = {
      generate: jest.fn(),
    } as unknown as jest.Mocked<MultiAiRouterService>;

    mockConfig = {
      get: jest.fn((key: string) => {
        if (key === 'MAMMOUTH_API_KEY') return 'sk-mammouth-test-key-12345';
        if (key === 'MAMMOUTH_DEFAULT_MODEL') return 'mammouth-recommended';
        return undefined;
      }),
    } as unknown as jest.Mocked<ConfigService>;

    service = new MammouthSeoService(mockRouter, mockConfig);
  });

  describe('testConnection', () => {
    it('returns connected: true with masked key when API ping succeeds', async () => {
      mockRouter.generate.mockResolvedValueOnce({
        provider: AiProvider.MAMMOUTH,
        model: 'mammouth-recommended',
        text: '{"status": "ok", "provider": "Mammouth AI"}',
        usage: { inputTokens: 10, outputTokens: 5, estimatedCostUsd: 0.0001 },
        refused: false,
      });

      const res = await service.testConnection();

      expect(res.connected).toBe(true);
      expect(res.provider).toBe('Mammouth AI');
      expect(res.maskedKey).toBe('sk-mamm••••••••••••');
      expect(res.model).toBe('mammouth-recommended');
    });

    it('handles connection failures cleanly without crashing', async () => {
      mockRouter.generate.mockRejectedValueOnce(new Error('Network timeout'));

      const res = await service.testConnection();

      expect(res.connected).toBe(false);
      expect(res.message).toContain('Network timeout');
    });
  });

  describe('Website SEO Audit', () => {
    it('analyzes crawl data and returns structured problems and recommendations', async () => {
      const mockAuditResponse = {
        domain: 'example.com',
        overallHealthScoreEstimate: 82,
        auditSummary: 'Technical crawl audit found 1 critical issue.',
        technicalProblems: [
          {
            problem: 'Missing H1 tags on 5 category pages',
            severity: 'high',
            evidence: 'Pages /category/shoes and /category/hats lack <h1>',
            whyItMatters: 'H1 tags signal primary topical relevance to search crawlers.',
            recommendedFix: 'Inject semantic <h1> element in page header template.',
            codeSnippetOrDirective: '<h1>{category.title}</h1>',
            priority: 'P1',
          },
        ],
        recommendations: [
          {
            issue: 'Missing H1 tags',
            category: 'technical_seo',
            severity: 'high',
            evidence: '/category/* pages lack H1',
            recommendation: 'Add dynamic H1 tag per category',
            expected_impact: '+12% topical relevance boost',
            confidence: 0.95,
            priority: 'P1',
            recommended_action: 'Update CategoryHeader component',
            expected_outcome: 'Eliminate H1 deficiency in next crawl',
          },
        ],
      };

      mockRouter.generate.mockResolvedValueOnce({
        provider: AiProvider.MAMMOUTH,
        model: 'mammouth-recommended',
        text: JSON.stringify(mockAuditResponse),
        usage: { inputTokens: 500, outputTokens: 250, estimatedCostUsd: 0.002 },
        refused: false,
      });

      const result = await service.analyzeWebsiteAudit({
        domain: 'example.com',
        pagesCrawled: 50,
        crawlDataSummary: {
          totalUrls: 50,
          sampleUrls: ['https://example.com/', 'https://example.com/category/shoes?sort=asc'],
          statusCodeCounts: { '200': 48, '404': 2 },
          detectedIssues: [{ issueType: 'MISSING_H1', count: 5 }],
        },
      });

      expect(result.domain).toBe('example.com');
      expect(result.overallHealthScoreEstimate).toBe(82);
      expect(result.technicalProblems).toHaveLength(1);
      expect(result.technicalProblems[0].problem).toContain('Missing H1');
      expect(result.recommendations).toHaveLength(1);
      expect(result.recommendations[0].category).toBe('technical_seo');
      expect(mockRouter.generate).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: AiProvider.MAMMOUTH,
          task: AiTask.SEO_ANALYSIS,
        }),
      );
    });
  });

  describe('Competitor Intelligence', () => {
    it('analyzes competitor data and returns keyword/content gaps with recommendations', async () => {
      const mockCompResponse = {
        landscapeSummary: 'Competitive space is highly concentrated around two major incumbents.',
        competitorStrengths: ['High domain authority', 'Broad category coverage'],
        competitorWeaknesses: ['Thin localized content', 'Slow page speed'],
        keywordGaps: [
          {
            keyword: 'best minimalist running shoes',
            searchVolumeEstimate: '14,000/mo',
            competitorAdvantage: 'Ranks #2 on runnerguide.com',
            rankingOpportunity: 'Target page with comprehensive buyer guide',
            targetAction: 'Publish in-depth comparison post',
          },
        ],
        contentGaps: [
          {
            topic: 'Zero-drop trail running comparison',
            competitorCoverage: 'Comprehensive guides with video review',
            whyItRanks: 'High engagement and schema markup',
            recommendedContentFormat: 'Interactive comparison table',
          },
        ],
        rankingOpportunities: [
          {
            opportunity: 'Target low-difficulty long-tail queries',
            trafficPotential: 'high',
            effort: 'medium',
            strategicAdvantage: 'Competitor content is outdated (2024)',
          },
        ],
        recommendations: [
          {
            issue: 'Zero-drop shoe content gap',
            category: 'competitor_intelligence',
            severity: 'high',
            evidence: 'Rivals rank top 3 for zero-drop queries',
            recommendation: 'Produce pillar page targeting zero-drop runners',
            expected_impact: '+2,500 monthly search clicks',
            confidence: 0.9,
            priority: 'P1',
            recommended_action: 'Draft zero-drop running shoes pillar page',
            expected_outcome: 'Page 1 rankings within 60 days',
          },
        ],
      };

      mockRouter.generate.mockResolvedValueOnce({
        provider: AiProvider.MAMMOUTH,
        model: 'claude-sonnet-4-6',
        text: JSON.stringify(mockCompResponse),
        usage: { inputTokens: 400, outputTokens: 200, estimatedCostUsd: 0.003 },
        refused: false,
      });

      const result = await service.analyzeCompetitorIntelligence({
        domain: 'example.com',
        competitors: [{ domain: 'runnerguide.com', name: 'Runner Guide' }],
        marketCategory: 'Running Gear',
      });

      expect(result.landscapeSummary).toContain('Competitive space');
      expect(result.keywordGaps).toHaveLength(1);
      expect(result.contentGaps).toHaveLength(1);
      expect(result.rankingOpportunities).toHaveLength(1);
      expect(result.recommendations).toHaveLength(1);
    });
  });

  describe('Cost Control & Resilience', () => {
    it('returns cached results on repeated identical queries', async () => {
      mockRouter.generate.mockResolvedValueOnce({
        provider: AiProvider.MAMMOUTH,
        model: 'mammouth-recommended',
        text: JSON.stringify({
          clusters: [],
          keywordPrioritization: [],
          cannibalizationOpportunities: [],
          recommendations: [],
        }),
        usage: { inputTokens: 100, outputTokens: 50, estimatedCostUsd: 0.0005 },
        refused: false,
      });

      const input = {
        seedKeywords: ['running shoes', 'trail shoes'],
        businessDomain: 'example.com',
      };

      const res1 = await service.generateKeywordStrategy(input);
      const res2 = await service.generateKeywordStrategy(input);

      expect(res1).toBeDefined();
      expect(res2).toEqual(res1);
      expect(mockRouter.generate).toHaveBeenCalledTimes(1); // Cached, called once!
    });
  });
});
