import { AiVisibilityService } from './ai-visibility.service';
import { AiVisibilityController } from './ai-visibility.controller';

describe('AI visibility dashboard contract', () => {
  const create = (responses: any[] = []) => {
    const prisma: any = {
      project: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'project',
          organizationId: 'org',
          websites: [{ domain: 'example.com' }],
          competitors: [],
        }),
      },
      aiVisibilityPrompt: { findMany: jest.fn().mockResolvedValue([{ id: 'prompt', text: 'Buyer question' }]) },
      aiVisibilitySettings: { findUnique: jest.fn().mockResolvedValue({ enabledModels: ['GEMINI', 'OPENAI'] }) },
      aiVisibilityScan: { create: jest.fn().mockResolvedValue({ id: 'scan' }), update: jest.fn().mockResolvedValue({}) },
      aiVisibilityScanRun: { create: jest.fn().mockResolvedValue({ id: 'run' }), update: jest.fn().mockResolvedValue({}) },
      aiVisibilityResponse: { create: jest.fn().mockResolvedValue({}), findMany: jest.fn().mockResolvedValue(responses) },
      aiVisibilityMetrics: { findFirst: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]) },
    };
    const providers: any = { configuredProviders: () => ['GEMINI'], runPrompt: jest.fn().mockResolvedValue({ model: 'tested-model', text: 'Answer', latencyMs: 1, inputTokens: 2, outputTokens: 3, costUsd: null }) };
    const analyzer: any = { analyzePendingResponses: jest.fn().mockResolvedValue(undefined) };
    const metrics: any = { calculateScanMetrics: jest.fn().mockResolvedValue(undefined) };
    const promptEngine: any = { generatePromptsForProject: jest.fn().mockResolvedValue([]) };
    return { service: new AiVisibilityService(prisma, providers, analyzer, metrics, promptEngine), prisma, providers, analyzer };
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
      { scanRunId: 'gemini', errorMessage: null, rawResponse: 'response', analysis: { brandMentioned: true }, prompt: null },
      { scanRunId: 'gemini', errorMessage: null, rawResponse: 'response', analysis: { brandMentioned: false }, prompt: null },
      { scanRunId: 'openai', errorMessage: 'Failed', rawResponse: null, analysis: null, prompt: null },
    ]);
    const mockMetric = {
      scanId: 'scan',
      visibilityScore: 10,
      mentionRate: 50,
      createdAt: new Date('2026-10-14T00:00:00Z'),
      shareOfVoice: [],
      funnelMetrics: { totalAnalyzed: 2 },
      scan: { runs: [{ id: 'gemini', provider: 'GEMINI', model: 'gemini-model' }, { id: 'openai', provider: 'OPENAI', model: 'openai-model' }] },
    };
    prisma.aiVisibilityMetrics.findFirst.mockResolvedValue(mockMetric);
    prisma.aiVisibilityMetrics.findMany.mockResolvedValue([mockMetric]);
    const report = await service.getReport('project', 28);
    expect(report.summary).toMatchObject({ checked: 2, cited: 1, citationSharePct: 50, failedChecks: 1 });
    expect(report.byAssistant).toEqual([
      { assistant: 'GEMINI', model: 'gemini-model', checked: 2, cited: 1, citationSharePct: 50 },
      { assistant: 'OPENAI', model: 'openai-model', checked: 0, cited: 0, citationSharePct: 0 },
    ]);
    expect(report.trend[0]).toMatchObject({ checked: 2, citationSharePct: 50 });
  });

  it('waits for the scan and forwards its result through the controller', async () => {
    const result = { checksRun: 5, checksFailed: 0, citations: 0, skippedAssistants: [] };
    const service: any = { runScanForProject: jest.fn().mockResolvedValue(result) };
    const controller = new AiVisibilityController(service, {} as any, {} as any, {} as any);
    await expect(controller.runSweep('project')).resolves.toEqual(result);
  });

  it('classifies citations by the actual customer domain rather than a brand mention', async () => {
    const { service, prisma } = create();
    prisma.aiVisibilityScan.findFirst = jest.fn().mockResolvedValue({ id: 'scan' });
    prisma.aiVisibilityCitation = { findMany: jest.fn().mockResolvedValue([
      { domain: 'publisher.test', brandMentioned: true },
      { domain: 'www.example.com', brandMentioned: false },
    ]) };
    await expect(service.getCitationsIntelligence('project')).resolves.toEqual({
      totalCitations: 2,
      citationsByDomain: [
        { domain: 'publisher.test', count: 1, ownCited: false },
        { domain: 'www.example.com', count: 1, ownCited: true },
      ],
    });
  });

  it('applies the selected date window to measured reports and history', async () => {
    const { service, prisma } = create();
    await service.getReport('project', 7);
    expect(prisma.aiVisibilityMetrics.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { projectId: 'project', createdAt: { gte: expect.any(Date) } },
    }));
  });
  it('allows the five-model plan after legacy single-model scans and marks the new planned cycle', async () => {
    const { service, prisma, providers } = create();
    providers.lowCostEnabled = () => true;
    providers.configuredProviders = () => ['GEMINI','OPENAI','ANTHROPIC','PERPLEXITY','GROK'];
    prisma.aiVisibilityPrompt.findMany.mockResolvedValue(Array.from({length:20},(_,i)=>({id:'q'+i,text:'Buyer question '+i})));
    const legacyScans = ['2026-10-15T15:38:48.288Z','2026-10-15T13:35:48.392Z','journey-old'];
    prisma.aiVisibilityScan.count = jest.fn(async ({where}: any) => legacyScans.filter(c => c.startsWith(where.cycleId.startsWith)).length);
    prisma.project.findUniqueOrThrow = prisma.project.findUnique;
    prisma.$executeRaw = jest.fn().mockResolvedValue(1);
    prisma.$transaction = (fn: any) => fn(prisma);
    await service.runScanForProject('project');
    expect(providers.runPrompt).toHaveBeenCalledTimes(100);
    expect(new Set(providers.runPrompt.mock.calls.map((call: any[])=>call[1]))).toEqual(new Set(['GEMINI','OPENAI','ANTHROPIC','PERPLEXITY','GROK']));
    expect(prisma.aiVisibilityScan.create).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({cycleId:expect.stringMatching(/^low-cost-v1:/)})}));
  });

  it('still rejects a fourth planned monthly cycle before sending any model request', async () => {
    const { service, prisma, providers } = create();
    providers.lowCostEnabled = () => true;
    prisma.aiVisibilityPrompt.findMany.mockResolvedValue(Array.from({length:20},(_,i)=>({id:'q'+i,text:'Buyer question '+i})));
    prisma.aiVisibilityScan.count = jest.fn().mockResolvedValue(3);
    prisma.project.findUniqueOrThrow = prisma.project.findUnique;
    prisma.$executeRaw = jest.fn().mockResolvedValue(1);
    prisma.$transaction = (fn: any) => fn(prisma);
    await expect(service.runScanForProject('project')).rejects.toThrow('three monthly visibility cycles');
    expect(providers.runPrompt).not.toHaveBeenCalled();
    expect(prisma.aiVisibilityScan.create).not.toHaveBeenCalled();
  });

});
