import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import { UsageMetric } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AiProvider, MultiAiRouterService } from '../ai-search/multi-ai-router/multi-ai-router.service';
import { AiVisibilityService } from '../ai-visibility/ai-visibility.service';
import { EntitlementsService } from '../billing/entitlements.service';
import { Feature } from '../billing/plans.catalog';
import { StrategyService } from './strategy.service';
import { buildStrategyPrompt, StrategyEvidence } from './strategy-evidence';

const VALID_STRATEGY = {
  businessSummary: 'Sells outdoor gear to winter hikers.',
  marketAnalysis: {
    positioning: 'Mid-market',
    targetAudience: 'Weekend hikers',
    demandSignals: ['High volume on jacket queries'],
    competitiveThreats: ['Trailhead Co dominates comparison prompts'],
  },
  seoRoadmap: [{ horizon: '30-day', action: 'Fix 12 missing titles', why: 'Crawl found 12', effort: 'Low', expectedImpact: 'CTR' }],
  contentPlan: [{ title: 'Jacket guide', format: 'Guide', targetQuery: 'best jacket', why: 'Lost to Trailhead' }],
  socialStrategy: [{ platform: 'Instagram', cadence: '3x/week', contentThemes: ['Trail photos'], why: 'Visual product' }],
};

describe('StrategyService', () => {
  let service: StrategyService;
  let prisma: any;
  let router: { generate: jest.Mock };
  let visibility: any;
  let entitlements: any;

  beforeEach(async () => {
    prisma = {
      project: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'proj_1',
          name: 'Northwind Outdoors',
          organizationId: 'org_1',
          websites: [{ id: 'w1', domain: 'northwindoutdoors.com' }],
          competitors: [{ domain: 'trailheadco.com', label: 'Trailhead Co' }],
        }),
      },
      crawlJob: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'crawl_1',
          pagesCrawled: 184,
          finishedAt: new Date('2026-08-01T00:00:00Z'),
        }),
      },
      issue: {
        count: jest.fn().mockResolvedValue(7),
        groupBy: jest.fn().mockResolvedValue([{ issueType: 'MISSING_TITLE', _count: { issueType: 12 } }]),
      },
      page: {
        findMany: jest.fn().mockResolvedValue([
          { url: 'https://northwindoutdoors.com/guides/jackets', title: 'Jacket guide', wordCount: 2100 },
        ]),
      },
      trackedPrompt: { count: jest.fn().mockResolvedValue(3) },
      promptCheck: {
        findMany: jest.fn().mockResolvedValue([
          { competitorsCited: ['trailheadco.com'], trackedPrompt: { text: 'best insulated jacket' } },
          { competitorsCited: ['trailheadco.com'], trackedPrompt: { text: 'best insulated jacket' } },
        ]),
      },
      strategyReport: {
        create: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'rep_1', ...data })),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
      },
    };

    router = {
      generate: jest.fn().mockResolvedValue({
        provider: AiProvider.ANTHROPIC,
        model: 'claude-opus-5',
        text: JSON.stringify(VALID_STRATEGY),
        usage: { inputTokens: 3000, outputTokens: 2000, estimatedCostUsd: 0.065 },
        refused: false,
      }),
    };

    visibility = {
      getReport: jest.fn().mockResolvedValue({
        summary: { citationSharePct: 41.2, averagePosition: 2.1 },
        byAssistant: [{ assistant: 'CLAUDE', citationSharePct: 60 }],
      }),
    };

    entitlements = {
      assertFeature: jest.fn().mockResolvedValue(undefined),
      assertQuota: jest.fn().mockResolvedValue(undefined),
      recordUsage: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StrategyService,
        { provide: PrismaService, useValue: prisma },
        { provide: MultiAiRouterService, useValue: router },
        { provide: AiVisibilityService, useValue: visibility },
        { provide: EntitlementsService, useValue: entitlements },
      ],
    }).compile();

    service = module.get(StrategyService);
  });

  describe('evidence gathering', () => {
    it('collects crawl, visibility, and competitor data', async () => {
      const evidence = await service.gatherEvidence('proj_1');

      expect(evidence.business.projectName).toBe('Northwind Outdoors');
      expect(evidence.site.pagesCrawled).toBe(184);
      expect(evidence.site.topIssueTypes).toEqual([{ issueType: 'MISSING_TITLE', count: 12 }]);
      expect(evidence.aiVisibility.citationSharePct).toBe(41.2);
      expect(evidence.competitors).toEqual([{ domain: 'trailheadco.com', label: 'Trailhead Co' }]);
    });

    it('deduplicates lost prompts so one prompt is not listed repeatedly', async () => {
      const evidence = await service.gatherEvidence('proj_1');
      expect(evidence.aiVisibility.lostPrompts).toEqual([
        { prompt: 'best insulated jacket', competitors: ['trailheadco.com'] },
      ]);
    });

    it('does not query visibility when no prompts are tracked', async () => {
      prisma.trackedPrompt.count.mockResolvedValue(0);
      const evidence = await service.gatherEvidence('proj_1');

      expect(visibility.getReport).not.toHaveBeenCalled();
      expect(evidence.aiVisibility.citationSharePct).toBeNull();
      expect(evidence.aiVisibility.trackedPromptCount).toBe(0);
    });

    it('survives a project that has never been crawled', async () => {
      prisma.crawlJob.findFirst.mockResolvedValue(null);
      const evidence = await service.gatherEvidence('proj_1');

      expect(evidence.site.pagesCrawled).toBe(0);
      expect(evidence.site.lastCrawledAt).toBeNull();
      expect(evidence.site.topIssueTypes).toEqual([]);
    });
  });

  describe('generate', () => {
    it('stores the plan alongside the evidence it was built from', async () => {
      const report = await service.generate('proj_1', 'org_1');

      expect(report.generatedByModel).toBe('claude-opus-5');
      expect(report.content).toEqual(VALID_STRATEGY);
      // Keeping the evidence is what lets a customer challenge a recommendation.
      expect((report.evidence as any).site.pagesCrawled).toBe(184);
    });

    it('is Pro-only and metered', async () => {
      await service.generate('proj_1', 'org_1');

      expect(entitlements.assertFeature).toHaveBeenCalledWith('org_1', Feature.MARKET_STRATEGY);
      expect(entitlements.assertQuota).toHaveBeenCalledWith('org_1', UsageMetric.STRATEGY_REPORTS);
      expect(entitlements.recordUsage).toHaveBeenCalledWith('org_1', UsageMetric.STRATEGY_REPORTS);
    });

    it('checks entitlement before doing any work', async () => {
      entitlements.assertFeature.mockRejectedValue(new ForbiddenException());
      await expect(service.generate('proj_1', 'org_1')).rejects.toThrow(ForbiddenException);
      expect(router.generate).not.toHaveBeenCalled();
    });

    it('refuses to invent a strategy for a site that was never crawled', async () => {
      prisma.crawlJob.findFirst.mockResolvedValue(null);

      await expect(service.generate('proj_1', 'org_1')).rejects.toThrow(BadRequestException);
      expect(router.generate).not.toHaveBeenCalled();
      expect(entitlements.recordUsage).not.toHaveBeenCalled();
    });

    it('does not bill the customer when the model refuses', async () => {
      router.generate.mockResolvedValue({
        provider: AiProvider.ANTHROPIC,
        model: 'claude-opus-5',
        text: '',
        usage: { inputTokens: 0, outputTokens: 0, estimatedCostUsd: null },
        refused: true,
      });

      await expect(service.generate('proj_1', 'org_1')).rejects.toThrow(ServiceUnavailableException);
      expect(entitlements.recordUsage).not.toHaveBeenCalled();
      expect(prisma.strategyReport.create).not.toHaveBeenCalled();
    });

    it('rejects a malformed plan rather than storing it', async () => {
      router.generate.mockResolvedValue({
        provider: AiProvider.ANTHROPIC,
        model: 'claude-opus-5',
        text: 'Here is some prose with no JSON at all.',
        usage: { inputTokens: 1, outputTokens: 1, estimatedCostUsd: null },
        refused: false,
      });

      await expect(service.generate('proj_1', 'org_1')).rejects.toThrow(ServiceUnavailableException);
      expect(prisma.strategyReport.create).not.toHaveBeenCalled();
    });

    it('accepts a plan wrapped in a markdown code fence', async () => {
      router.generate.mockResolvedValue({
        provider: AiProvider.ANTHROPIC,
        model: 'claude-opus-5',
        text: '```json\n' + JSON.stringify(VALID_STRATEGY) + '\n```',
        usage: { inputTokens: 1, outputTokens: 1, estimatedCostUsd: null },
        refused: false,
      });

      const report = await service.generate('proj_1', 'org_1');
      expect(report.content).toEqual(VALID_STRATEGY);
    });

    it('gives the model room for a long plan', async () => {
      await service.generate('proj_1', 'org_1');
      expect(router.generate).toHaveBeenCalledWith(
        expect.objectContaining({ maxTokens: 16000, organizationId: 'org_1' }),
      );
    });
  });
});

describe('buildStrategyPrompt', () => {
  const evidence: StrategyEvidence = {
    business: { projectName: 'Northwind Outdoors', domains: ['northwindoutdoors.com'] },
    site: {
      pagesCrawled: 184,
      lastCrawledAt: '2026-08-01T00:00:00.000Z',
      criticalIssues: 3,
      highIssues: 9,
      topIssueTypes: [{ issueType: 'MISSING_TITLE', count: 12 }],
      samplePages: [{ url: 'https://northwindoutdoors.com/guides/jackets', title: 'Jacket guide', wordCount: 2100 }],
    },
    aiVisibility: {
      citationSharePct: 41.2,
      averagePosition: 2.1,
      byAssistant: [{ assistant: 'CLAUDE', citationSharePct: 60 }],
      lostPrompts: [{ prompt: 'best insulated jacket', competitors: ['trailheadco.com'] }],
      trackedPromptCount: 3,
    },
    competitors: [{ domain: 'trailheadco.com', label: 'Trailhead Co' }],
  };

  it("puts the customer's own numbers in the prompt", () => {
    const prompt = buildStrategyPrompt(evidence);

    // The guard against this silently degrading into generic advice.
    expect(prompt).toContain('Northwind Outdoors');
    expect(prompt).toContain('184');
    expect(prompt).toContain('MISSING_TITLE (12 pages)');
    expect(prompt).toContain('41.2%');
    expect(prompt).toContain('best insulated jacket');
    expect(prompt).toContain('Trailhead Co');
    expect(prompt).toContain('https://northwindoutdoors.com/guides/jackets');
  });

  it('states that visibility is unmeasured rather than implying it is bad', () => {
    const prompt = buildStrategyPrompt({
      ...evidence,
      aiVisibility: { ...evidence.aiVisibility, trackedPromptCount: 0 },
    });

    expect(prompt).toContain('unmeasured');
    expect(prompt).not.toContain('41.2%');
  });

  it('renders empty sections without breaking the prompt', () => {
    const prompt = buildStrategyPrompt({
      ...evidence,
      competitors: [],
      site: { ...evidence.site, topIssueTypes: [], samplePages: [] },
    });

    expect(prompt).toContain('(none recorded)');
  });
});
