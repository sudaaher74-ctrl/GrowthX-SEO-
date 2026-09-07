import { Test, TestingModule } from '@nestjs/testing';
import { ServiceUnavailableException } from '@nestjs/common';
import { UnifiedAiService } from './unified-ai.service';
import { AiBusinessContext } from './interfaces/ai-business-context.interface';
import { AiProvider, AiTask, MultiAiRouterService } from '../ai-search/multi-ai-router/multi-ai-router.service';

/**
 * These calls used to go through a second provider abstraction that had no task
 * routing, no budget enforcement and no spend ledger — so the most expensive
 * calls in the product were the ones nobody could account for. They now go
 * through the same router as everything else, and these tests hold that line.
 */
describe('UnifiedAiService', () => {
  let service: UnifiedAiService;
  let router: { generate: jest.Mock };

  const context: AiBusinessContext = {
    organizationId: 'org-1',
    businessName: 'GrowthX',
    industry: 'Marketing Technology / SEO SaaS',
    country: 'India',
    targetAudience: 'Multi-location businesses',
    competitors: ['Semrush', 'Ahrefs'],
  };

  function completion(payload: unknown) {
    return {
      provider: AiProvider.ANTHROPIC,
      model: 'claude-opus-5',
      text: JSON.stringify(payload),
      usage: { inputTokens: 10, outputTokens: 5, estimatedCostUsd: null },
      refused: false,
    };
  }

  beforeEach(async () => {
    router = { generate: jest.fn().mockResolvedValue(completion({ ok: true })) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [UnifiedAiService, { provide: MultiAiRouterService, useValue: router }],
    }).compile();

    service = module.get(UnifiedAiService);
  });

  it('routes every intelligence task through the AI router', async () => {
    await service.generateMarketResearch(context);
    expect(router.generate).toHaveBeenCalledTimes(1);
  });

  it('attributes the spend to the calling organization', async () => {
    await service.generateSEOAnalysis(context);
    expect(router.generate.mock.calls[0][0].organizationId).toBe('org-1');
  });

  it('files each task under its own name so the ledger reads by product surface', async () => {
    await service.generateCompetitorAnalysis(context);
    expect(router.generate.mock.calls[0][0].task).toBe(AiTask.COMPETITOR_ANALYSIS);

    router.generate.mockClear();
    await service.generateSEOAnalysis(context);
    expect(router.generate.mock.calls[0][0].task).toBe(AiTask.SEO_ANALYSIS);
  });

  it('constrains the answer with a schema rather than hoping for JSON', async () => {
    await service.generateKeywordResearch(context);
    expect(router.generate.mock.calls[0][0].jsonSchema).toBeDefined();
  });

  it('parses the model answer into the documented shape', async () => {
    router.generate.mockResolvedValue(completion({ marketOverview: 'Growing fast', swot: {} }));

    const result = await service.generateMarketResearch(context);
    expect(result).toMatchObject({ marketOverview: 'Growing fast' });
  });

  it('reports an empty answer instead of returning an empty object', async () => {
    router.generate.mockResolvedValue({ ...completion({}), text: '   ' });

    await expect(service.generateBusinessInsights(context)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('runs unattributed rather than failing when no organization is supplied', async () => {
    const { organizationId, ...anonymous } = context;
    void organizationId;

    await expect(service.generateContentStrategy(anonymous)).resolves.toBeDefined();
    expect(router.generate.mock.calls[0][0].organizationId).toBeUndefined();
  });

  it('no longer offers social or generic marketing generation', () => {
    // Out of scope for an SEO platform, per the product direction.
    expect((service as any).generateSocialStrategy).toBeUndefined();
    expect((service as any).generateMarketingStrategy).toBeUndefined();
  });
});
