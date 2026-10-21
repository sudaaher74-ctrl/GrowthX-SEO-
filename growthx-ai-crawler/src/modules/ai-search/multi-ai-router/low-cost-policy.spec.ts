import { ConfigService } from '@nestjs/config';
import { AiProvider, AiTask, AiCompletion } from './multi-ai-router.types';
import { APPROVED_MODELS, costBucket, policyModel, policyTokens } from './low-cost-policy';
import { LowCostPolicyService } from './low-cost-policy.service';
import { MultiAiRouterService } from './multi-ai-router.service';
import { WebSearchService } from '../../market-research/web-search.service';
import { ModelRouterService, ModelRole } from '../../market-research/model-router.service';

const answer: AiCompletion = { provider: AiProvider.GEMINI, model: 'gemini-3.5-flash-lite', text: 'Saved analysis', refused: false, usage: { inputTokens: 100, outputTokens: 30, estimatedCostUsd: 0.00007, actualCostUsd: null } };
const request = { organizationId: 'org', projectId: 'project', prompt: 'Analyse this website.', task: AiTask.SUMMARY_GENERATION };
function harness(totals = { platform: 0, customer: 0, bucket: 0, measurements: 0 }, env: Record<string,string> = {}) {
  const execute = jest.fn().mockResolvedValue(1);
  const tx: any = { $executeRaw: execute, $queryRaw: jest.fn().mockResolvedValue([totals]), organization: { findUnique: jest.fn().mockResolvedValue({ aiMonthlyBudgetUsd: null }) } };
  const prisma: any = { $executeRaw: execute, $queryRaw: jest.fn().mockResolvedValue([]), $transaction: jest.fn(fn => fn(tx)) };
  const service = new LowCostPolicyService(prisma, { get: (key: string) => env[key] } as ConfigService);
  return { service, prisma, tx, execute };
}

describe('low-cost production policy', () => {
  it('uses the existing exact Sonar model for search-backed competitor discovery through the shared ledger', async () => {
    const env: Record<string,string>={AI_LOW_COST_POLICY:'true',OPENROUTER_API_KEY:'or-real'};
    const guard: any={run:jest.fn((_request,_model,invoke)=>invoke())};
    const router=new MultiAiRouterService({get:(key:string)=>env[key]} as ConfigService,undefined,undefined,guard);
    const create=jest.fn().mockResolvedValue({id:'search',model:'perplexity/sonar',choices:[{message:{content:'{"competitors":[]}'},finish_reason:'stop'}],usage:{prompt_tokens:100,completion_tokens:50,cost:0.005}});
    (router as any).openrouter={chat:{completions:{create}}};
    await router.generate({...request,task:AiTask.COMPETITOR_DISCOVERY,provider:AiProvider.PERPLEXITY,maxTokens:2000,allowFallback:false});
    expect(guard.run).toHaveBeenCalledWith(expect.objectContaining({organizationId:'org',task:AiTask.COMPETITOR_DISCOVERY}),'perplexity/sonar',expect.any(Function));
    expect(create.mock.calls[0][0]).toMatchObject({model:'perplexity/sonar',max_tokens:2000,provider:{allow_fallbacks:false}});
    expect(costBucket({...request,task:AiTask.COMPETITOR_DISCOVERY})).toBe('INTERNAL');
  });
  it('uses exact approved transports, token caps, and reported costs without premium fallback', async () => {
    const env: Record<string,string> = { AI_LOW_COST_POLICY: 'true', GEMINI_API_KEY: 'gem-real', OPENROUTER_API_KEY: 'or-real', GEMINI_MODEL: 'gemini-pro', OPENROUTER_MODEL: 'anthropic/claude-opus-5' };
    const guard: any = { run: jest.fn((_request, _model, invoke) => invoke()) };
    const router = new MultiAiRouterService({ get: (key: string) => env[key] } as ConfigService, undefined, undefined, guard);
    const create = jest.fn().mockResolvedValue({ id: 'generation', model: 'openai/gpt-4.1-mini', choices: [{ message: { content: 'fresh answer' }, finish_reason: 'stop' }], usage: { prompt_tokens: 100, completion_tokens: 100, cost: 0.0002 } });
    (router as any).openrouter = { chat: { completions: { create } } };
    const result = await router.generate({ ...request, task: AiTask.VISIBILITY_MEASUREMENT, provider: AiProvider.OPENAI, maxTokens: 8000 });
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][0]).toMatchObject({ model: 'openai/gpt-4.1-mini', max_tokens: 800, reasoning: { enabled: false }, provider: { allow_fallbacks: false, max_price: { prompt: 0.4, completion: 1.6 } } });
    expect(create.mock.calls[0][0]).not.toHaveProperty('tools');
    expect(create.mock.calls[0][0]).not.toHaveProperty('plugins');
    expect(result.provider).toBe(AiProvider.OPENAI);
    expect(result.usage.actualCostUsd).toBe(0.0002);
    const generateContent = jest.fn().mockResolvedValue({ text: 'internal summary', usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 10 } });
    (router as any).gemini = { models: { generateContent } };
    await router.generate({ ...request, provider: AiProvider.SARVAM });
    expect(generateContent.mock.calls[0][0]).toMatchObject({ model: 'gemini-3.5-flash-lite', config: { maxOutputTokens: 2000, thinkingConfig: { thinkingLevel: 'minimal' } } });
    expect(create).toHaveBeenCalledTimes(1);
  });
  it('routes Market Research through the shared ledger with customer attribution and local retrieval', async () => {
    const shared: any = { configuredProviders: () => [AiProvider.GEMINI], generate: jest.fn().mockResolvedValue(answer) };
    const research = new ModelRouterService({ get: (key: string) => key === 'AI_LOW_COST_POLICY' ? 'true' : undefined } as ConfigService, shared);
    expect(research.provider()).toBe('gemini');
    expect(research.supportsEmbeddings()).toBe(false);
    await research.generate({ organizationId: 'org', projectId: 'project', role: ModelRole.WORKER, step: 'summary', input: 'evidence', instructions: 'summarise' });
    expect(shared.generate).toHaveBeenCalledWith(expect.objectContaining({ organizationId: 'org', projectId: 'project', task: AiTask.SUMMARY_GENERATION, allowFallback: false }));
  });
  it('disables expensive research web-search calls even when a key exists', async () => {
    const values: Record<string, string> = { AI_LOW_COST_POLICY: 'true', TAVILY_API_KEY: 'tvly-configured-production-key' };
    const search = new WebSearchService({ get: (key: string) => values[key] } as ConfigService);
    expect(search.isConfigured()).toBe(false);
    expect((await search.search(['test query'])).sources).toEqual([]);
  });
  it('assigns routine work, competitor work, code, and monitoring to the approved identities', () => {
    expect(policyModel(request)).toBe('gemini-3.5-flash-lite');
    expect(policyModel({ ...request, task: AiTask.AI_VISIBILITY_ANALYSIS })).toBe('gemini-2.5-flash');
    expect(costBucket({ ...request, task: AiTask.AI_VISIBILITY_ANALYSIS })).toBe('INTERNAL');
    expect(policyModel({ ...request, task: AiTask.COMPETITOR_ANALYSIS })).toBe('gemini-2.5-flash');
    expect(policyModel({ ...request, task: AiTask.CODE_GENERATION })).toBe('gemini-2.5-flash');
    expect(policyModel({ ...request, task: AiTask.VISIBILITY_MEASUREMENT, provider: AiProvider.ANTHROPIC })).toBe('anthropic/claude-haiku-4.5');
    expect(() => policyModel({ ...request, freshMeasurement: true, provider: AiProvider.SARVAM })).toThrow('not approved');
    expect(costBucket({ ...request, task: AiTask.CODE_REVIEW })).toBe('FIX_ENGINE');
    expect(policyTokens({ ...request, freshMeasurement: true, maxTokens: 9000 })).toBe(800);
    expect(policyTokens({ ...request, task: AiTask.CODE_GENERATION, maxTokens: 9000 })).toBe(4000);
    expect(() => policyTokens({ ...request, maxTokens: -1 })).toThrow('Invalid');
  });

  it('enables the policy by default and never exposes direct premium/Sarvam transports', () => {
    const previous = process.env.AI_LOW_COST_POLICY;
    delete process.env.AI_LOW_COST_POLICY;
    try {
      const env: Record<string,string> = { GEMINI_API_KEY: 'gem-real', OPENROUTER_API_KEY: 'or-real', ANTHROPIC_API_KEY: 'ant-real', SARVAM_API_KEY: 'sarvam-real', ANTHROPIC_MODEL: 'claude-opus-5' };
      const router = new MultiAiRouterService({ get: (key: string) => env[key] } as ConfigService);
      expect(router.lowCostEnabled()).toBe(true);
      expect(router.configuredProviders()).toEqual([AiProvider.GEMINI, AiProvider.OPENAI, AiProvider.ANTHROPIC, AiProvider.PERPLEXITY, AiProvider.GROK]);
      expect(router.chainFor(AiTask.CODE_GENERATION)).toEqual([AiProvider.GEMINI]);
      expect(router.configuredModels().ANTHROPIC).toBe('anthropic/claude-haiku-4.5');
    } finally { process.env.AI_LOW_COST_POLICY = previous; }
  });

  it.each([
    { platform: 10, customer: 0, bucket: 0, measurements: 0 },
    { platform: 0, customer: 1, bucket: 0, measurements: 0 },
    { platform: 0, customer: 0, bucket: 0.2, measurements: 0 },
  ])('refuses exhausted platform, customer, or bucket budgets before invoking a provider', async totals => {
    const h = harness(totals);
    jest.spyOn(h.service, 'verifyPrice').mockResolvedValue();
    const invoke = jest.fn().mockResolvedValue(answer);
    await expect(h.service.run(request, 'gemini-3.5-flash-lite', invoke)).rejects.toThrow('limit is reached');
    expect(invoke).not.toHaveBeenCalled();
    expect(h.execute.mock.calls.some(([sql]) => sql.join('').includes('INSERT INTO'))).toBe(false);
  });

  it('includes the next request reservation, instead of allowing a call to overshoot the cap', async () => {
    const h = harness({ platform: 9.99999, customer: 0, bucket: 0, measurements: 0 });
    jest.spyOn(h.service, 'verifyPrice').mockResolvedValue();
    const invoke = jest.fn();
    await expect(h.service.run(request, 'gemini-3.5-flash-lite', invoke)).rejects.toThrow('limit');
    expect(invoke).not.toHaveBeenCalled();
  });

  it('refuses unattributed requests and the 301st monitoring request', async () => {
    const h = harness({ platform: 0, customer: 0, bucket: 0, measurements: 300 });
    jest.spyOn(h.service, 'verifyPrice').mockResolvedValue();
    const invoke = jest.fn();
    await expect(h.service.run({ ...request, organizationId: undefined }, 'gemini-3.5-flash-lite', invoke)).rejects.toThrow('attribution');
    await expect(h.service.run({ ...request, task: AiTask.VISIBILITY_MEASUREMENT }, 'openai/gpt-4.1-mini', invoke)).rejects.toThrow('300');
    expect(invoke).not.toHaveBeenCalled();
  });

  it('reuses unchanged internal analysis but always makes a fresh visibility measurement', async () => {
    const h = harness();
    h.prisma.$queryRaw.mockResolvedValue([{ completion: answer }]);
    jest.spyOn(h.service, 'verifyPrice').mockResolvedValue();
    const invoke = jest.fn().mockResolvedValue(answer);
    expect((await h.service.run(request, 'gemini-3.5-flash-lite', invoke)).usage.cached).toBe(true);
    expect(invoke).not.toHaveBeenCalled();
    await h.service.run({ ...request, task: AiTask.VISIBILITY_MEASUREMENT }, 'openai/gpt-4.1-mini', invoke);
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(h.prisma.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('keeps an unknown failed request reserved and does not retry it', async () => {
    const h = harness();
    jest.spyOn(h.service, 'verifyPrice').mockResolvedValue();
    const invoke = jest.fn().mockRejectedValue(new Error('timeout'));
    await expect(h.service.run(request, 'gemini-3.5-flash-lite', invoke)).rejects.toThrow('timeout');
    expect(invoke).toHaveBeenCalledTimes(1);
    const failure = h.execute.mock.calls.find(([sql]) => sql.join('').includes("'ERROR'"));
    expect(failure?.[0].join('')).not.toContain('"reservedCostUsd"=');
  });

  it('stores reported provider costs, search charges, and generation IDs separately', async () => {
    const h = harness();
    jest.spyOn(h.service, 'verifyPrice').mockResolvedValue();
    await h.service.run({ ...request, task: AiTask.VISIBILITY_MEASUREMENT }, 'perplexity/sonar', async () => ({ ...answer, usage: { ...answer.usage, actualCostUsd: 0.006, searchCostUsd: 0.005, generationId: 'generation' } }));
    const update = h.execute.mock.calls.find(([sql]) => sql.join('').includes('"actualCostUsd"='));
    expect(update?.slice(1)).toEqual(expect.arrayContaining([0.006, 0.005, 'generation']));
  });

  describe('price verification', () => {
    const original = global.fetch;
    afterEach(() => { global.fetch = original; });
    it('rejects premium model IDs, unavailable Grok, higher prices, and catalog outages', async () => {
      await expect(harness().service.verifyPrice('claude-opus-5' as any)).rejects.toThrow('allowlist');
      global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [] }) });
      await expect(harness().service.verifyPrice('x-ai/grok-4.3')).rejects.toThrow('unavailable');
      global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [{ id: 'openai/gpt-4.1-mini', pricing: { prompt: '0.000004', completion: '0.000016' } }] }) });
      await expect(harness().service.verifyPrice('openai/gpt-4.1-mini')).rejects.toThrow('price ceiling');
      global.fetch = jest.fn().mockRejectedValue(new Error('offline'));
      await expect(harness().service.verifyPrice('openai/gpt-4.1-mini')).rejects.toThrow('could not be verified');
    });
    it('accepts the owner-approved Grok tariff and rejects increases', async () => {
      expect(policyModel({ ...request, provider: AiProvider.GROK, freshMeasurement: true })).toBe('x-ai/grok-4.3');
      global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [{ id: 'x-ai/grok-4.3', pricing: { prompt: '0.00000125', completion: '0.0000025' } }] }) });
      await expect(harness().service.verifyPrice('x-ai/grok-4.3')).resolves.toBeUndefined();
      global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [{ id: 'x-ai/grok-4.3', pricing: { prompt: '0.000002', completion: '0.000003' } }] }) });
      await expect(harness().service.verifyPrice('x-ai/grok-4.3')).rejects.toThrow('price ceiling');
    });
    it('rejects an expired Google tariff review', async () => {
      await expect(harness(undefined, { AI_GOOGLE_PRICES_VERIFIED_AT: '2020-01-01' }).service.verifyPrice('gemini-3.5-flash-lite')).rejects.toThrow('review expired');
    });
    it('accepts the live approved tariff and caches the catalog, not measurements', async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [{ id: 'openai/gpt-4.1-mini', pricing: { prompt: '0.0000004', completion: '0.0000016' } }] }) });
      const h = harness();
      await h.service.verifyPrice('openai/gpt-4.1-mini');
      await h.service.verifyPrice('openai/gpt-4.1-mini');
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });
});


