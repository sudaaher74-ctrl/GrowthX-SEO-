import { Test, TestingModule } from '@nestjs/testing';
import { AiProvider, MultiAiRouterService } from '../multi-ai-router/multi-ai-router.service';
import { InvestigationToolsService } from '../investigation-tools/investigation-tools.service';
import { AiSearchService } from './ai-search.service';

describe('AiSearchService', () => {
  let service: AiSearchService;
  let router: { generate: jest.Mock };
  let tools: any;

  beforeEach(async () => {
    router = {
      generate: jest.fn().mockResolvedValue({
        provider: AiProvider.ANTHROPIC,
        model: 'claude-opus-5',
        text: '### Executive Summary\nYour titles are missing.',
        usage: { inputTokens: 100, outputTokens: 50, estimatedCostUsd: 0.002 },
        refused: false,
      }),
    };
    tools = {
      queryKnowledgeGraph: jest.fn().mockResolvedValue('{"status":"healthy"}'),
      getTrafficMetrics: jest.fn().mockResolvedValue('{"available":false}'),
      getCompetitorData: jest.fn().mockResolvedValue('{"available":false}'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiSearchService,
        { provide: MultiAiRouterService, useValue: router },
        { provide: InvestigationToolsService, useValue: tools },
      ],
    }).compile();
    service = module.get(AiSearchService);
  });

  it('gathers all three evidence sources before answering', async () => {
    await service.askQuestion('proj_1', 'why is traffic down?');
    expect(tools.queryKnowledgeGraph).toHaveBeenCalledWith('proj_1');
    expect(tools.getTrafficMetrics).toHaveBeenCalledWith('proj_1');
    expect(tools.getCompetitorData).toHaveBeenCalledWith('proj_1');
  });

  it('returns the answer and which model produced it', async () => {
    const result = await service.askQuestion('proj_1', 'why?', 'org_1');

    expect(result.answer).toContain('Executive Summary');
    expect(result.model).toMatchObject({ provider: AiProvider.ANTHROPIC, name: 'claude-opus-5' });
  });

  it('passes the organization through so the plan picks the model', async () => {
    await service.askQuestion('proj_1', 'why?', 'org_1');
    expect(router.generate).toHaveBeenCalledWith(expect.objectContaining({ organizationId: 'org_1' }));
  });

  it('extracts a structured AUTO_FIX action when the model proposes one', async () => {
    const action = {
      type: 'AUTO_FIX',
      payload: { issueId: 'i1', targetFile: 'app/layout.tsx', property: 'title', value: 'New' },
    };
    router.generate.mockResolvedValue({
      provider: AiProvider.ANTHROPIC,
      model: 'claude-opus-5',
      text: 'Here is the fix:\n```json\n' + JSON.stringify(action) + '\n```',
      usage: { inputTokens: 1, outputTokens: 1, estimatedCostUsd: null },
      refused: false,
    });

    const result = await service.askQuestion('proj_1', 'fix it');
    expect(result.suggestedAction).toEqual(action);
  });

  it('ignores a malformed action block rather than failing the answer', async () => {
    router.generate.mockResolvedValue({
      provider: AiProvider.ANTHROPIC,
      model: 'claude-opus-5',
      text: 'Text\n```json\n{not valid json\n```',
      usage: { inputTokens: 1, outputTokens: 1, estimatedCostUsd: null },
      refused: false,
    });

    const result = await service.askQuestion('proj_1', 'fix it');
    expect(result.suggestedAction).toBeUndefined();
    expect(result.answer).toContain('Text');
  });
});
