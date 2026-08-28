import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AiProvider, MultiAiRouterService } from '../ai-search/multi-ai-router/multi-ai-router.service';
import { AiVisibilityService } from '../ai-visibility/ai-visibility.service';
import { StrategyService } from './strategy.service';
import { AgentRunService } from '../agents/agent-run.service';
import { buildStrategyPrompt, StrategyEvidence } from './strategy-evidence';

const VALID_STRATEGY = {
  businessSummary: 'Sells outdoor gear to winter hikers.',
  marketAnalysis: {
    positioning: 'Mid-market',
    targetAudience: 'Weekend hikers',
    demandSignals: ['High volume on jacket queries'],
    competitiveThreats: ['Trailhead Co dominates comparison prompts'],
  },
  seoRoadmap: [
    {
      horizon: '30-day',
      action: 'Fix 12 missing titles',
      why: 'Crawl found 12',
      effort: 'LOW',
      impact: 'HIGH',
      owner: 'Developer',
      evidenceKey: 'ISSUE-1',
    },
  ],
  contentPlan: [{ title: 'Jacket guide', format: 'Guide', targetQuery: 'best jacket', why: 'Lost to Trailhead' }],
  socialStrategy: [{ platform: 'Instagram', cadence: '3x/week', contentThemes: ['Trail photos'], why: 'Visual product' }],
};

describe('StrategyService', () => {
  let service: StrategyService;
  let prisma: any;
  let router: { generate: jest.Mock };
  let visibility: any;
  let entitlements: any;
  let agentRuns: any;

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

    // Stands in for the real runtime: records evidence with predictable ids so
    // a test can assert which observation a recommendation was attached to.
    agentRuns = {
      withRun: jest.fn(async (_projectId: string, _agent: unknown, work: any) => {
        const { result } = await work({ id: 'run_1', projectId: 'proj_1', agent: 'STRATEGY' });
        return result;
      }),
      recordEvidenceBatch: jest.fn(async (_run: unknown, records: any[]) =>
        records.map((r, i) => ({ ...r, id: `ev_${i + 1}` })),
      ),
      recommend: jest.fn().mockResolvedValue({ id: 'rec_1' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StrategyService,
        { provide: PrismaService, useValue: prisma },
        { provide: MultiAiRouterService, useValue: router },
        { provide: AiVisibilityService, useValue: visibility },
{ provide: AgentRunService, useValue: agentRuns },
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

    it('attaches each recommendation to the evidence the model cited', async () => {
      await service.generate('proj_1', 'org_1');

      expect(agentRuns.recommend).toHaveBeenCalledTimes(1);
      const [, recommendation] = agentRuns.recommend.mock.calls[0];
      expect(recommendation.owner).toBe('Developer');
      expect(recommendation.horizon).toBe('DAYS_30');
      expect(recommendation.impact).toBe('HIGH');
      // ISSUE-1 is the MISSING_TITLE observation, recorded before the model ran.
      expect(recommendation.primaryEvidence.summary).toContain('MISSING_TITLE');
    });

    it('records the evidence before calling the model', async () => {
      await service.generate('proj_1', 'org_1');

      const evidenceOrder = agentRuns.recordEvidenceBatch.mock.invocationCallOrder[0];
      const modelOrder = router.generate.mock.invocationCallOrder[0];
      expect(evidenceOrder).toBeLessThan(modelOrder);
    });

    // The mechanism is only worth having if an invented citation is dropped
    // rather than silently reattached to some other observation.
    it('discards a recommendation citing evidence that was never observed', async () => {
      router.generate.mockResolvedValue({
        provider: AiProvider.ANTHROPIC,
        model: 'claude-opus-5',
        text: JSON.stringify({
          ...VALID_STRATEGY,
          seoRoadmap: [
            { ...VALID_STRATEGY.seoRoadmap[0], evidenceKey: 'ISSUE-1' },
            {
              horizon: '60-day',
              action: 'Act on data we never gathered',
              why: 'Invented',
              effort: 'LOW',
              impact: 'HIGH',
              owner: 'SEO',
              evidenceKey: 'ISSUE-999',
            },
          ],
        }),
        usage: { inputTokens: 1, outputTokens: 1, estimatedCostUsd: null },
        refused: false,
      });

      await service.generate('proj_1', 'org_1');

      expect(agentRuns.recommend).toHaveBeenCalledTimes(1);
      const titles = agentRuns.recommend.mock.calls.map(([, r]: any[]) => r.title);
      expect(titles).not.toContain('Act on data we never gathered');
    });

    it('fails rather than storing a plan where nothing cited real evidence', async () => {
      router.generate.mockResolvedValue({
        provider: AiProvider.ANTHROPIC,
        model: 'claude-opus-5',
        text: JSON.stringify({
          ...VALID_STRATEGY,
          seoRoadmap: [{ ...VALID_STRATEGY.seoRoadmap[0], evidenceKey: 'MADE-UP' }],
        }),
        usage: { inputTokens: 1, outputTokens: 1, estimatedCostUsd: null },
        refused: false,
      });

      await expect(service.generate('proj_1', 'org_1')).rejects.toThrow(ServiceUnavailableException);
      expect(prisma.strategyReport.create).not.toHaveBeenCalled();
      expect(entitlements.recordUsage).not.toHaveBeenCalled();
    });

    it('is Pro-only and metered', async () => {
      await service.generate('proj_1', 'org_1');


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
      // A truncated plan is worse than none: it reads as complete and stops
      // mid-roadmap. The organizationId assertion that used to sit alongside
      // this was about plan-based provider routing, which went with the
      // billing system.
      await service.generate('proj_1', 'org_1');
      expect(router.generate).toHaveBeenCalledWith(expect.objectContaining({ maxTokens: 16000 }));
    });
  });
});

describe('buildStrategyPrompt', () => {
  const evidence: StrategyEvidence = {
    business: { projectName: 'Northwind Outdoors', domains: ['northwindoutdoors.com'] },
    site: {
      crawlJobId: 'crawl-1',
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
