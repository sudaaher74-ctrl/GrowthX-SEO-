import { ConfigService } from '@nestjs/config';
import { ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import { AiProvider, AiTask, MultiAiRouterService } from './multi-ai-router.service';


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

  describe('plan-aware model selection', () => {
    it('routes a Pro org to Claude for reasoning', async () => {
      const { service } = build();
      const anthropic = anthropicStub();
      stubClients(service, { anthropic, openai: openAiStub(), gemini: geminiStub() });

      const result = await service.generate({ prompt: 'why is my traffic down', organizationId: 'org_pro' });

      expect(result.provider).toBe(AiProvider.ANTHROPIC);
      expect(result.text).toBe('claude answer');
    });

    it('routes a Starter org to Gemini, never Claude or GPT', async () => {
      const { service } = build({}, {
        getEntitlements: jest.fn().mockResolvedValue({ plan: 'STARTER', features: [] }),
      } as any);
      const anthropic = anthropicStub();
      const openai = openAiStub();
      const gemini = geminiStub();
      stubClients(service, { anthropic, openai, gemini });

      const result = await service.generate({ prompt: 'what should I fix', organizationId: 'org_starter' });

      expect(result.provider).toBe(AiProvider.GEMINI);
      expect(anthropic.create).not.toHaveBeenCalled();
      expect(openai.create).not.toHaveBeenCalled();
    });

    it('denies an explicit Claude request on Starter with the upgrade error', async () => {
      const assertFeature = jest.fn().mockRejectedValue(new ForbiddenException({ error: 'FEATURE_NOT_IN_PLAN' }));
      const { service } = build({}, {
        getEntitlements: jest.fn().mockResolvedValue({ plan: 'STARTER', features: [] }),
        assertFeature,
      } as any);
      stubClients(service, { anthropic: anthropicStub(), openai: openAiStub(), gemini: geminiStub() });

      await expect(
        service.generate({ prompt: 'x', organizationId: 'org_starter', provider: AiProvider.ANTHROPIC }),
      ).rejects.toThrow(ForbiddenException);
      expect(assertFeature).toHaveBeenCalledWith('org_starter',);
    });

    it('prefers Gemini for cheap high-volume work even on Pro', async () => {
      const { service } = build();
      const gemini = geminiStub();
      stubClients(service, { anthropic: anthropicStub(), openai: openAiStub(), gemini });

      const result = await service.generate({ prompt: 'classify', task: AiTask.FAST, organizationId: 'org_pro' });
      expect(result.provider).toBe(AiProvider.GEMINI);
    });

    it('uses every configured vendor when no organization is given', async () => {
      const { service, entitlements } = build();
      stubClients(service, { anthropic: anthropicStub(), openai: openAiStub(), gemini: geminiStub() });

      const result = await service.generate({ prompt: 'internal job' });

      expect(result.provider).toBe(AiProvider.ANTHROPIC);
      expect(entitlements.getEntitlements).not.toHaveBeenCalled();
    });

    it('fails clearly when the plan allows nothing that is configured', async () => {
      const { service } = build({ GEMINI_API_KEY: 'your_gemini_api_key_here' }, {
        getEntitlements: jest.fn().mockResolvedValue({ plan: 'STARTER', features: [] }),
      } as any);
      stubClients(service, { anthropic: anthropicStub(), openai: openAiStub() });

      await expect(service.generate({ prompt: 'x', organizationId: 'org_starter' })).rejects.toThrow(
        ServiceUnavailableException,
      );
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
});
