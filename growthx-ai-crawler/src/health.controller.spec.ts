import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { MultiAiRouterService } from './modules/ai-search/multi-ai-router/multi-ai-router.service';

/**
 * HealthController injects MultiAiRouterService, which AppModule reaches only
 * through AiSearchModule's exports. Getting that wrong crashes the process at
 * boot rather than failing one request, so the wiring is worth a test.
 */
describe('HealthController', () => {
  async function build(env: Record<string, string | undefined>) {
    const previous = { ...process.env };
    Object.assign(process.env, env);

    const module: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true })],
      controllers: [HealthController],
      providers: [MultiAiRouterService],
    }).compile();

    return {
      controller: module.get(HealthController),
      restore: () => {
        process.env = previous;
      },
    };
  }

  it('resolves its dependencies the way AppModule wires them', async () => {
    const { controller, restore } = await build({});
    expect(controller).toBeInstanceOf(HealthController);
    restore();
  });

  it('reports the build that is serving, so a deploy is verifiable', async () => {
    const { controller, restore } = await build({ RENDER_GIT_COMMIT: 'abc1234', RENDER_GIT_BRANCH: 'main' });

    const body = controller.check();
    expect(body.status).toBe('ok');
    expect(body.commit).toBe('abc1234');
    expect(body.branch).toBe('main');
    expect(body.startedAt).toEqual(expect.any(String));
    restore();
  });

  it('says plainly when no provider can serve a generated feature', async () => {
    const { controller, restore } = await build({
      ANTHROPIC_API_KEY: undefined,
      GEMINI_API_KEY: undefined,
      OPENAI_API_KEY: undefined,
      SARVAM_API_KEY: undefined,
      GROQ_API_KEY: undefined,
      OPENROUTER_API_KEY: undefined,
    });

    const { ai } = controller.capabilities() as any;
    expect(ai.canGenerate).toBe(false);
    expect(ai.reasoningChain).toEqual([]);
    restore();
  });

  it('names the providers and models a strategy call would actually try', async () => {
    const { controller, restore } = await build({
      GROQ_API_KEY: 'gsk_a_real_looking_key_value_1234567890',
      GROQ_MODEL: 'llama-3.1-8b-instant',
      ANTHROPIC_API_KEY: undefined,
      GEMINI_API_KEY: undefined,
      OPENAI_API_KEY: undefined,
      SARVAM_API_KEY: undefined,
      OPENROUTER_API_KEY: undefined,
    });

    const { ai } = controller.capabilities() as any;
    expect(ai.canGenerate).toBe(true);
    expect(ai.reasoningChain).toEqual(['GROQ']);
    expect(ai.models).toEqual({ GROQ: 'llama-3.1-8b-instant' });
    // A leaked key here would be served to anyone who curls the endpoint.
    expect(JSON.stringify(ai)).not.toContain('gsk_a_real_looking_key');
    restore();
  });
});
