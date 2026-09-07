import { ConfigService } from '@nestjs/config';
import { ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import {
  AiProvider,
  AiTask,
  MultiAiRouterService,
  RoutingProfile,
  profileFor,
} from './multi-ai-router.service';
import { AiUsageService } from './ai-usage.service';


function build(env: Record<string, string> = {}, entitlementOverrides: any = {}) {
  const values: Record<string, string> = {
    GEMINI_API_KEY: 'gem-real',
    OPENAI_API_KEY: 'oai-real',
    ANTHROPIC_API_KEY: 'ant-real',
    ANTHROPIC_SERVER_SIDE_FALLBACK: 'false', // exercised separately
    ...env,
  };

  const entitlements = {
    getEntitlements: jest.fn().mockResolvedValue({ plan: 'PRO', features: [] }),
    assertFeature: jest.fn().mockResolvedValue(undefined),
    ...entitlementOverrides,
  } 

  const config = { get: (key: string) => values[key] } as unknown as ConfigService;
  const service = new MultiAiRouterService(config);
  return { service, entitlements };
}

/** Replaces the vendor SDK clients with stubs so no network call is made. */
function stubClients(
  service: MultiAiRouterService,
  stubs: { anthropic?: any; openai?: any; gemini?: any },
) {
  const s = service as any;
  if ('anthropic' in stubs) s.anthropic = stubs.anthropic;
  if ('openai' in stubs) s.openai = stubs.openai;
  if ('gemini' in stubs) s.gemini = stubs.gemini;
}

function anthropicStub(overrides: Record<string, any> = {}) {
  const create = jest.fn().mockResolvedValue({
    model: 'claude-opus-5',
    stop_reason: 'end_turn',
    content: [{ type: 'text', text: 'claude answer' }],
    usage: { input_tokens: 1000, output_tokens: 500 },
    ...overrides,
  });
  return { messages: { create }, beta: { messages: { create } }, create };
}

function geminiStub(text = 'gemini answer') {
  const generateContent = jest.fn().mockResolvedValue({
    text,
    usageMetadata: { promptTokenCount: 200, candidatesTokenCount: 100 },
  });
  return { models: { generateContent }, generateContent };
}

function openAiStub(text = 'gpt answer') {
  const create = jest.fn().mockResolvedValue({
    model: 'gpt-4o',
    choices: [{ message: { content: text } }],
    usage: { prompt_tokens: 300, completion_tokens: 150 },
  });
  return { chat: { completions: { create } } , create };
}

describe('MultiAiRouterService', () => {
  describe('provider configuration', () => {
    it('treats .env.example placeholders as unconfigured', () => {
      const { service } = build({
        GEMINI_API_KEY: 'your_gemini_api_key_here',
        OPENAI_API_KEY: 'your_openai_api_key_here',
        ANTHROPIC_API_KEY: 'ant-real',
      });
      expect(service.configuredProviders()).toEqual([AiProvider.ANTHROPIC]);
    });

    it('lists every vendor that has a real key', () => {
      const { service } = build();
      expect(service.configuredProviders()).toEqual([AiProvider.GEMINI, AiProvider.OPENAI, AiProvider.ANTHROPIC]);
    });
  });

  /**
   * Was "plan-aware model selection". The three tests here that asserted plan
   * gating went with the billing system — Subscription and UsageRecord are
   * dropped and no EntitlementsService exists. What is left is the routing
   * that still happens: which vendor a task goes to, and in what order.
   */
  describe('task-based model selection', () => {
    it('sends reasoning work to Claude first', async () => {
      const { service } = build();
      const anthropic = anthropicStub();
      stubClients(service, { anthropic, openai: openAiStub(), gemini: geminiStub() });

      const result = await service.generate({ prompt: 'why is my traffic down', organizationId: 'org_pro' });

      expect(result.provider).toBe(AiProvider.ANTHROPIC);
      expect(result.text).toBe('claude answer');
    });

    it('prefers Gemini for cheap high-volume work', async () => {
      // Classification and extraction run across every page of a crawl. Paying
      // reasoning rates for that is the difference between a viable unit cost
      // and not.
      const { service } = build();
      const gemini = geminiStub();
      stubClients(service, { anthropic: anthropicStub(), openai: openAiStub(), gemini });

      const result = await service.generate({ prompt: 'classify', task: AiTask.FAST, organizationId: 'org_pro' });
      expect(result.provider).toBe(AiProvider.GEMINI);
    });

    it('uses every configured vendor for an internal job with no organization', async () => {
      const { service } = build();
      stubClients(service, { anthropic: anthropicStub(), openai: openAiStub(), gemini: geminiStub() });

      const result = await service.generate({ prompt: 'internal job' });

      expect(result.provider).toBe(AiProvider.ANTHROPIC);
    });

    it('fails clearly when nothing is configured', async () => {
      // A placeholder value left in an env file is not a configured vendor,
      // and the difference has to reach the caller as an error rather than a
      // silent empty answer.
      const { service } = build({
        ANTHROPIC_API_KEY: '',
        OPENAI_API_KEY: '',
        GEMINI_API_KEY: 'your_gemini_api_key_here',
        SARVAM_API_KEY: '',
      });
      stubClients(service, {});

      await expect(service.generate({ prompt: 'x' })).rejects.toThrow(ServiceUnavailableException);
    });
  });

  describe('resilience', () => {
    it('falls through to the next vendor when one errors', async () => {
      const { service } = build();
      const anthropic = anthropicStub();
      anthropic.create.mockRejectedValue(new Error('529 overloaded'));
      const gemini = geminiStub();
      stubClients(service, { anthropic, openai: openAiStub(), gemini });

      const result = await service.generate({ prompt: 'x', organizationId: 'org_pro' });

      expect(result.provider).toBe(AiProvider.GEMINI);
      expect(result.text).toBe('gemini answer');
    });

    it('treats a safety refusal as a reason to try the next vendor', async () => {
      const { service } = build();
      const anthropic = anthropicStub({ stop_reason: 'refusal', content: [], stop_details: { category: 'cyber' } });
      stubClients(service, { anthropic, openai: openAiStub(), gemini: geminiStub() });

      const result = await service.generate({ prompt: 'x', organizationId: 'org_pro' });

      expect(result.provider).toBe(AiProvider.GEMINI);
    });

    it('reports the refusal rather than crashing when only one vendor exists', async () => {
      const { service } = build({
        GEMINI_API_KEY: 'your_gemini_api_key_here',
        OPENAI_API_KEY: 'your_openai_api_key_here',
      });
      stubClients(service, { anthropic: anthropicStub({ stop_reason: 'refusal', content: [] }) });

      const result = await service.generate({ prompt: 'x' });

      // Reading content[0].text on a refusal is what breaks naive callers.
      expect(result.refused).toBe(true);
      expect(result.text).toBe('');
    });

    it('raises when every vendor fails', async () => {
      const { service } = build();
      const anthropic = anthropicStub();
      anthropic.create.mockRejectedValue(new Error('boom'));
      const openai = openAiStub();
      openai.create.mockRejectedValue(new Error('boom'));
      const gemini = geminiStub();
      gemini.generateContent.mockRejectedValue(new Error('boom'));
      stubClients(service, { anthropic, openai, gemini });

      await expect(service.generate({ prompt: 'x' })).rejects.toThrow(ServiceUnavailableException);
    });
  });

  describe('Anthropic request shape', () => {
    it('omits sampling parameters and leaves headroom for thinking', async () => {
      const { service } = build();
      const anthropic = anthropicStub();
      stubClients(service, { anthropic });

      await service.generate({ prompt: 'analyse', provider: AiProvider.ANTHROPIC });

      const body = anthropic.create.mock.calls[0][0];
      // These are rejected with a 400 on this model family.
      expect(body).not.toHaveProperty('temperature');
      expect(body).not.toHaveProperty('top_p');
      expect(body).not.toHaveProperty('top_k');
      // Thinking is on by default and counts against max_tokens.
      expect(body.max_tokens).toBeGreaterThanOrEqual(8000);
      expect(body.output_config.effort).toBe('high');
    });

    it('drops to low effort for cheap tasks', async () => {
      const { service } = build();
      const anthropic = anthropicStub();
      stubClients(service, { anthropic });

      await service.generate({ prompt: 'classify', provider: AiProvider.ANTHROPIC, task: AiTask.FAST });

      expect(anthropic.create.mock.calls[0][0].output_config.effort).toBe('low');
    });

    it('passes a JSON schema through as a structured-output constraint', async () => {
      const { service } = build();
      const anthropic = anthropicStub();
      stubClients(service, { anthropic });
      const schema = { type: 'object', properties: { priority: { type: 'number' } } };

      await service.generate({ prompt: 'x', provider: AiProvider.ANTHROPIC, jsonSchema: schema });

      expect(anthropic.create.mock.calls[0][0].output_config.format).toEqual({ type: 'json_schema', schema });
    });

    it('retries without the beta when server-side fallback is unavailable', async () => {
      const { service } = build({ ANTHROPIC_SERVER_SIDE_FALLBACK: 'true' });
      const plain = jest.fn().mockResolvedValue({
        model: 'claude-opus-5',
        stop_reason: 'end_turn',
        content: [{ type: 'text', text: 'ok' }],
        usage: { input_tokens: 10, output_tokens: 5 },
      });
      const beta = jest.fn().mockRejectedValue(new Error('unsupported beta: server-side-fallback-2026-07-01'));
      stubClients(service, { anthropic: { messages: { create: plain }, beta: { messages: { create: beta } } } });

      const result = await service.generate({ prompt: 'x', provider: AiProvider.ANTHROPIC });

      expect(beta).toHaveBeenCalled();
      expect(plain).toHaveBeenCalled();
      expect(result.text).toBe('ok');
    });
  });

  describe('cost attribution', () => {
    it('prices Anthropic usage from the published rate', async () => {
      const { service } = build();
      stubClients(service, { anthropic: anthropicStub() });

      const result = await service.generate({ prompt: 'x', provider: AiProvider.ANTHROPIC });

      // 1000 in @ $5/Mtok + 500 out @ $25/Mtok
      expect(result.usage).toEqual({ inputTokens: 1000, outputTokens: 500, estimatedCostUsd: 0.0175 });
    });

    it('reports tokens but no cost for a vendor with no configured rate', async () => {
      const { service } = build({ GEMINI_API_KEY: 'gem-real', ANTHROPIC_API_KEY: 'your_anthropic_api_key_here', OPENAI_API_KEY: 'your_openai_api_key_here' });
      stubClients(service, { gemini: geminiStub() });

      const result = await service.generate({ prompt: 'x' });

      expect(result.usage.inputTokens).toBe(200);
      expect(result.usage.estimatedCostUsd).toBeNull();
    });

    it('uses operator-supplied rates when provided', async () => {
      const { service } = build({
        GEMINI_API_KEY: 'gem-real',
        ANTHROPIC_API_KEY: 'your_anthropic_api_key_here',
        OPENAI_API_KEY: 'your_openai_api_key_here',
        GEMINI_RATE_INPUT_PER_MTOK: '1.25',
        GEMINI_RATE_OUTPUT_PER_MTOK: '10',
      });
      stubClients(service, { gemini: geminiStub() });

      const result = await service.generate({ prompt: 'x' });

      // 200 in @ $1.25/Mtok + 100 out @ $10/Mtok
      expect(result.usage.estimatedCostUsd).toBeCloseTo(0.00125, 6);
    });
  });
  /**
   * The task vocabulary is named for the product surface that asks, so the
   * spend ledger reads as "what did the fix engine cost" rather than "what did
   * REASONING cost". Routing still collapses to three profiles.
   */
  describe('task vocabulary', () => {
    it('routes every declared task to a profile', () => {
      for (const task of Object.values(AiTask)) {
        expect(Object.values(RoutingProfile)).toContain(profileFor(task));
      }
    });

    it('keeps the three original task names routing exactly as before', () => {
      expect(profileFor(AiTask.REASONING)).toBe(RoutingProfile.REASONING);
      expect(profileFor(AiTask.CODE_GEN)).toBe(RoutingProfile.CODE_GEN);
      expect(profileFor(AiTask.FAST)).toBe(RoutingProfile.FAST);
    });

    it('sends code work to the code profile and analysis to reasoning', () => {
      expect(profileFor(AiTask.CODE_GENERATION)).toBe(RoutingProfile.CODE_GEN);
      expect(profileFor(AiTask.CODE_REVIEW)).toBe(RoutingProfile.CODE_GEN);
      expect(profileFor(AiTask.FIX_VALIDATION)).toBe(RoutingProfile.CODE_GEN);
      expect(profileFor(AiTask.COMPETITOR_ANALYSIS)).toBe(RoutingProfile.REASONING);
      expect(profileFor(AiTask.PAGE_COMPARISON)).toBe(RoutingProfile.REASONING);
    });

    it('prices the per-prompt tasks cheaply', () => {
      // These run 300 prompts x 5 engines x weekly per client. Routing them to
      // a reasoning model is the difference between a viable gross margin and a
      // services business.
      expect(profileFor(AiTask.ENTITY_ANALYSIS)).toBe(RoutingProfile.FAST);
      expect(profileFor(AiTask.REVIEW_RESPONSE_DRAFT)).toBe(RoutingProfile.FAST);
      expect(profileFor(AiTask.SUMMARY_GENERATION)).toBe(RoutingProfile.FAST);
    });

    it('routes a named task to the same chain as its profile', () => {
      const { service } = build();
      expect(service.chainFor(AiTask.CODE_GENERATION)).toEqual(service.chainFor(AiTask.CODE_GEN));
      expect(service.chainFor(AiTask.SEO_ANALYSIS)).toEqual(service.chainFor(AiTask.REASONING));
    });
  });

  describe('spend ledger', () => {
    function withLedger(env: Record<string, string> = {}) {
      const record = jest.fn();
      const assertWithinBudget = jest.fn().mockResolvedValue(undefined);
      const ledger = { record, assertWithinBudget } as unknown as AiUsageService;
      const values: Record<string, string> = {
        GEMINI_API_KEY: 'gem-real',
        OPENAI_API_KEY: 'oai-real',
        ANTHROPIC_API_KEY: 'ant-real',
        ANTHROPIC_SERVER_SIDE_FALLBACK: 'false',
        ...env,
      };
      const config = { get: (key: string) => values[key] } as any;
      return { service: new MultiAiRouterService(config, ledger), record, assertWithinBudget };
    }

    it('records a successful call against the org, project and task', async () => {
      const { service, record } = withLedger();
      stubClients(service, { anthropic: anthropicStub() });

      await service.generate({
        prompt: 'fix my canonical tags',
        task: AiTask.CODE_GENERATION,
        organizationId: 'org-1',
        projectId: 'proj-1',
      });

      expect(record).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: 'org-1',
          projectId: 'proj-1',
          taskType: AiTask.CODE_GENERATION,
          provider: AiProvider.ANTHROPIC,
          inputTokens: 1000,
          outputTokens: 500,
          status: 'OK',
        }),
      );
    });

    it('records a failed call, because the tokens it sent were still billed', async () => {
      const { service, record } = withLedger();
      const anthropic = anthropicStub();
      anthropic.create.mockRejectedValue(new Error('upstream 500'));
      stubClients(service, { anthropic, openai: openAiStub(), gemini: geminiStub() });

      await service.generate({ prompt: 'x', organizationId: 'org-1' });

      const failure = record.mock.calls.map((c) => c[0]).find((e) => e.status === 'ERROR');
      expect(failure).toMatchObject({
        provider: AiProvider.ANTHROPIC,
        status: 'ERROR',
        error: 'upstream 500',
        estimatedCostUsd: null,
      });
    });

    it('records one entry per provider attempted, not one per request', async () => {
      const { service, record } = withLedger();
      const anthropic = anthropicStub();
      anthropic.create.mockRejectedValue(new Error('down'));
      stubClients(service, { anthropic, openai: openAiStub(), gemini: geminiStub() });

      await service.generate({ prompt: 'x', organizationId: 'org-1' });

      expect(record.mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    it('checks the budget before spending, not after', async () => {
      const { service, assertWithinBudget } = withLedger();
      const anthropic = anthropicStub();
      stubClients(service, { anthropic });

      await service.generate({ prompt: 'x', organizationId: 'org-1' });

      expect(assertWithinBudget).toHaveBeenCalledWith('org-1');
      expect(assertWithinBudget.mock.invocationCallOrder[0]).toBeLessThan(
        anthropic.create.mock.invocationCallOrder[0],
      );
    });

    it('does not call a provider at all when the budget refuses', async () => {
      const { service, assertWithinBudget } = withLedger();
      assertWithinBudget.mockRejectedValue(new Error('budget reached'));
      const anthropic = anthropicStub();
      stubClients(service, { anthropic });

      await expect(service.generate({ prompt: 'x', organizationId: 'org-1' })).rejects.toThrow(
        'budget reached',
      );
      expect(anthropic.create).not.toHaveBeenCalled();
    });

    it('runs normally when no ledger is wired in', async () => {
      const { service } = build();
      stubClients(service, { anthropic: anthropicStub() });

      await expect(service.generate({ prompt: 'x' })).resolves.toMatchObject({
        provider: AiProvider.ANTHROPIC,
      });
    });
  });

  describe('vendor pinning', () => {
    it('does not silently switch vendors when the caller forbids fallback', async () => {
      // A customer who pinned a vendor for a compliance reason must get an
      // error, not a quiet answer from somebody else.
      const { service } = build();
      const anthropic = anthropicStub();
      anthropic.create.mockRejectedValue(new Error('anthropic down'));
      const openai = openAiStub();
      stubClients(service, { anthropic, openai, gemini: geminiStub() });

      await expect(
        service.generate({ prompt: 'x', allowFallback: false }),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
      expect(openai.create).not.toHaveBeenCalled();
    });

    it('still falls through by default', async () => {
      const { service } = build();
      const anthropic = anthropicStub();
      anthropic.create.mockRejectedValue(new Error('anthropic down'));
      stubClients(service, { anthropic, openai: openAiStub(), gemini: geminiStub() });

      const result = await service.generate({ prompt: 'x' });
      expect(result.provider).not.toBe(AiProvider.ANTHROPIC);
    });
  });
  /**
   * Running on one vendor is a supported configuration, not a degraded one.
   * These tests hold the two halves of it: generation works, and measurement
   * refuses rather than substituting a different model's opinion.
   */
  describe('a single-vendor install (Sarvam only)', () => {
    function sarvamOnly() {
      return build({
        SARVAM_API_KEY: 'sv-real',
        GEMINI_API_KEY: 'your_gemini_api_key_here',
        OPENAI_API_KEY: 'your_openai_api_key_here',
        ANTHROPIC_API_KEY: 'your_anthropic_api_key_here',
      });
    }

    it('serves every routing profile from the one configured vendor', () => {
      const { service } = sarvamOnly();
      expect(service.configuredProviders()).toEqual([AiProvider.SARVAM]);

      for (const task of Object.values(AiTask)) {
        expect(service.chainFor(task)).toEqual([AiProvider.SARVAM]);
      }
    });

    it('refuses a request pinned to a vendor that is not configured', async () => {
      // This is the path AI visibility takes: a check for what ChatGPT says is
      // pinned to OpenAI. Answering it from Sarvam instead would record one
      // model's opinion as another's measurement.
      const { service } = sarvamOnly();

      await expect(
        service.generate({ prompt: 'best dentist in Bandra', provider: AiProvider.OPENAI }),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
    });

    it('reports no cost when no Sarvam rate is configured, rather than zero', async () => {
      const { service } = sarvamOnly();
      (service as any).sarvamKey = 'sv-real';
      jest.spyOn(service as any, 'callSarvam').mockImplementation(async () => ({
        provider: AiProvider.SARVAM,
        model: 'sarvam-m',
        text: 'answer',
        usage: { inputTokens: 1000, outputTokens: 500, estimatedCostUsd: null },
        refused: false,
      }));

      const result = await service.generate({ prompt: 'x' });
      // Null, not 0: an unpriced call is unknown spend, and recording it as
      // zero would let a monthly budget sit permanently unreached.
      expect(result.usage.estimatedCostUsd).toBeNull();
    });
  });
});
