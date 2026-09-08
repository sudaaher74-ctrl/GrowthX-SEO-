import { ConfigService } from '@nestjs/config';
import { MultiAiRouterService, AiProvider, AiTask } from './multi-ai-router.service';
import {
  MammouthCapability,
  resolveMammouthModelForCapability,
  MAMMOUTH_MODELS,
} from './mammouth-models.config';

describe('Mammouth AI Integration', () => {
  function makeConfig(values: Record<string, string>): ConfigService {
    return {
      get: jest.fn((key: string) => values[key]),
    } as unknown as ConfigService;
  }

  describe('Model Capability Selector', () => {
    it('resolves the correct default models for specific capabilities', () => {
      expect(resolveMammouthModelForCapability(MammouthCapability.SEO_ANALYSIS)).toBe('mammouth-recommended');
      expect(resolveMammouthModelForCapability(MammouthCapability.KEYWORD_ANALYSIS)).toBe('gemini-2.5-flash');
      expect(resolveMammouthModelForCapability(MammouthCapability.COMPETITOR_ANALYSIS)).toBe('claude-sonnet-4-6');
      expect(resolveMammouthModelForCapability(MammouthCapability.TECHNICAL_SEO_REASONING)).toBe('gpt-5.4');
      expect(resolveMammouthModelForCapability(MammouthCapability.AEV_ANALYSIS)).toBe('sonar-pro');
    });

    it('respects environment variable overrides', () => {
      const model = resolveMammouthModelForCapability(MammouthCapability.SEO_ANALYSIS, {
        envOverrides: { MAMMOUTH_MODEL_SEO_ANALYSIS: 'gpt-4.1' },
      });
      expect(model).toBe('gpt-4.1');
    });

    it('accepts user selected model if it supports the capability', () => {
      const model = resolveMammouthModelForCapability(MammouthCapability.COMPETITOR_ANALYSIS, {
        userSelectedModel: 'claude-opus-4-8',
      });
      expect(model).toBe('claude-opus-4-8');
    });

    it('has metadata for all defined models', () => {
      expect(MAMMOUTH_MODELS['mammouth-recommended']).toBeDefined();
      expect(MAMMOUTH_MODELS['gpt-4.1']).toBeDefined();
      expect(MAMMOUTH_MODELS['claude-sonnet-4-6']).toBeDefined();
      expect(MAMMOUTH_MODELS['sonar-pro']).toBeDefined();
    });
  });

  describe('MultiAiRouterService with Mammouth', () => {
    it('registers Mammouth when MAMMOUTH_API_KEY is configured', () => {
      const config = makeConfig({
        MAMMOUTH_API_KEY: 'sk-mammouth-test-key',
      });
      const router = new MultiAiRouterService(config);

      expect(router.configuredProviders()).toContain(AiProvider.MAMMOUTH);
      expect(router.chainFor(AiTask.SEO_ANALYSIS)[0]).toBe(AiProvider.MAMMOUTH);
    });

    it('prioritizes Mammouth in task chains', () => {
      const config = makeConfig({
        MAMMOUTH_API_KEY: 'sk-mammouth-test-key',
        ANTHROPIC_API_KEY: 'sk-ant-test-key',
      });
      const router = new MultiAiRouterService(config);

      const chain = router.chainFor(AiTask.SEO_RESEARCH);
      expect(chain[0]).toBe(AiProvider.MAMMOUTH);
      expect(chain[1]).toBe(AiProvider.ANTHROPIC);
    });

    it('executes generate via Mammouth mock client', async () => {
      const config = makeConfig({
        MAMMOUTH_API_KEY: 'sk-mammouth-test-key',
      });
      const router = new MultiAiRouterService(config);

      // Mock the internal mammouth OpenAI client chat completions
      const mockCreate = jest.fn().mockResolvedValue({
        id: 'mammouth-cmpl-123',
        model: 'mammouth-recommended',
        choices: [
          {
            message: {
              role: 'assistant',
              content: JSON.stringify({ issue: 'Missing H1 tag', severity: 'high' }),
            },
          },
        ],
        usage: { prompt_tokens: 45, completion_tokens: 22 },
      });
      (router as any).mammouth = {
        chat: { completions: { create: mockCreate } },
      };

      const result = await router.generate({
        prompt: 'Analyze audit crawl',
        task: AiTask.SEO_ANALYSIS,
        provider: AiProvider.MAMMOUTH,
      });

      expect(result.provider).toBe(AiProvider.MAMMOUTH);
      expect(result.text).toContain('Missing H1 tag');
      expect(result.usage.inputTokens).toBe(45);
      expect(result.usage.outputTokens).toBe(22);
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });

    it('translates 401 errors into clean sanitized ServiceUnavailableException', async () => {
      const config = makeConfig({
        MAMMOUTH_API_KEY: 'sk-mammouth-test-key',
      });
      const router = new MultiAiRouterService(config);

      (router as any).mammouth = {
        chat: {
          completions: {
            create: jest.fn().mockRejectedValue({
              status: 401,
              message: 'Invalid API key provided: sk-mammouth-test-key',
            }),
          },
        },
      };

      await expect(
        router.generate({
          prompt: 'test prompt',
          provider: AiProvider.MAMMOUTH,
        }),
      ).rejects.toThrow('Mammouth AI authentication failed: invalid API key.');
    });

    it('translates 429 rate limit errors cleanly', async () => {
      const config = makeConfig({
        MAMMOUTH_API_KEY: 'sk-mammouth-test-key',
      });
      const router = new MultiAiRouterService(config);

      (router as any).mammouth = {
        chat: {
          completions: {
            create: jest.fn().mockRejectedValue({
              status: 429,
              message: 'Rate limit exceeded: quota depleted',
            }),
          },
        },
      };

      await expect(
        router.generate({
          prompt: 'test prompt',
          provider: AiProvider.MAMMOUTH,
        }),
      ).rejects.toThrow('Mammouth AI rate limit or quota exceeded. Please check credits.');
    });
  });
});
