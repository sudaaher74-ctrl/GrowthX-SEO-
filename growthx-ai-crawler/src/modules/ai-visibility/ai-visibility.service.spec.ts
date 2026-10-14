import { AiVisibilityService } from './ai-visibility.service';
import { AiVisibilityController } from './ai-visibility.controller';

describe('AI visibility dashboard contract', () => {
  const create = (responses: any[] = []) => {
    const prisma: any = {
      aiVisibilityPrompt: { findMany: jest.fn().mockResolvedValue([{ id: 'prompt', text: 'Buyer question' }]) },
      aiVisibilitySettings: { findUnique: jest.fn().mockResolvedValue({ enabledModels: ['GEMINI', 'OPENAI'] }) },
      aiVisibilityScan: { create: jest.fn().mockResolvedValue({ id: 'scan' }), update: jest.fn().mockResolvedValue({}) },
      aiVisibilityScanRun: { create: jest.fn().mockResolvedValue({ id: 'run' }), update: jest.fn().mockResolvedValue({}) },
      aiVisibilityResponse: { create: jest.fn().mockResolvedValue({}), findMany: jest.fn().mockResolvedValue(responses) },
      aiVisibilityMetrics: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const providers: any = { configuredProviders: () => ['GEMINI'], runPrompt: jest.fn().mockResolvedValue({ model: 'tested-model', text: 'Answer', latencyMs: 1, inputTokens: 2, outputTokens: 3, costUsd: null }) };
    const analyzer: any = { analyzePendingResponses: jest.fn().mockResolvedValue(undefined) };
    const metrics: any = { calculateScanMetrics: jest.fn().mockResolvedValue(undefined) };
    return { service: new AiVisibilityService(prisma, providers, analyzer, metrics), prisma, providers, analyzer };
  };

  it('returns the measured scan result expected by the Run button', async () => {
    const { service, providers } = create([{ errorMessage: null, analysis: { brandMentioned: true } }]);
    await expect(service.runScanForProject('project')).resolves.toEqual({ checksRun: 1, checksFailed: 0, citations: 1, skippedAssistants: ['OPENAI'] });
    expect(providers.runPrompt).toHaveBeenCalledTimes(1);
  });

  it('does not count failed or unanalyzed responses as measured answers', async () => {
    const { service } = create([{ errorMessage: 'Provider failed', analysis: null }, { errorMessage: null, analysis: null }]);
    await expect(service.runScanForProject('project')).resolves.toMatchObject({ checksRun: 0, checksFailed: 2, citations: 0 });
  });

  it('returns an actionable error before creating an empty scan', async () => {
    const { service, prisma } = create();
    prisma.aiVisibilityPrompt.findMany.mockResolvedValue([]);
    await expect(service.runScanForProject('project')).rejects.toThrow('Add at least one buyer question');
    expect(prisma.aiVisibilityScan.create).not.toHaveBeenCalled();
  });

  it('reports enabled assistants before the first scan', async () => {
    const { service } = create();
    await expect(service.getReport('project', 28)).resolves.toMatchObject({ measurableAssistants: ['GEMINI'], summary: { checked: 0 } });
  });

  it('computes provider totals and trend from stored responses', async () => {
    const { service, prisma } = create([
      { scanRunId: 'gemini', errorMessage: null, analysis: { brandMentioned: true }, prompt: null },
      { scanRunId: 'gemini', errorMessage: null, analysis: { brandMentioned: false }, prompt: null },
      { scanRunId: 'openai', errorMessage: 'Failed', analysis: null, prompt: null },
    ]);
    prisma.aiVisibilityMetrics.findFirst.mockResolvedValue({ scanId: 'scan', createdAt: new Date('2026-10-14T00:00:00Z'), shareOfVoice: [], scan: { runs: [{ id: 'gemini', provider: 'GEMINI' }, { id: 'openai', provider: 'OPENAI' }] } });
    const report = await service.getReport('project', 28);
    expect(report.summary).toMatchObject({ checked: 2, cited: 1, citationSharePct: 50, failedChecks: 1 });
    expect(report.byAssistant).toEqual([{ assistant: 'GEMINI', checked: 2, cited: 1, citationSharePct: 50 }, { assistant: 'OPENAI', checked: 0, cited: 0, citationSharePct: 0 }]);
    expect(report.trend[0]).toMatchObject({ checked: 2, citationSharePct: 50 });
  });

  it('waits for the scan and forwards its result through the controller', async () => {
    const result = { checksRun: 5, checksFailed: 0, citations: 0, skippedAssistants: [] };
    const service: any = { runScanForProject: jest.fn().mockResolvedValue(result) };
    const controller = new AiVisibilityController(service, {} as any, {} as any, {} as any);
    await expect(controller.runSweep('project')).resolves.toEqual(result);
  });
});
