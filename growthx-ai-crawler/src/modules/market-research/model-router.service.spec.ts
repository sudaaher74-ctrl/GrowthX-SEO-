import { ConfigService } from '@nestjs/config';
import { ModelRouterService } from './model-router.service';

const router = (env: Record<string, string>) =>
  new ModelRouterService({ get: (key: string) => env[key] } as unknown as ConfigService);

describe('ModelRouterService provider selection under AI_PROVIDERS', () => {
  it('stays on Sarvam and offers no OpenAI embeddings when only Sarvam is allowed', () => {
    const service = router({
      AI_PROVIDERS: 'SARVAM',
      SARVAM_API_KEY: 'sk_sarvam_0123456789abcdef',
      GROQ_API_KEY: 'gsk_groq_0123456789abcdef',
      OPENAI_API_KEY: 'sk-openai-0123456789abcdef',
    });
    expect(service.provider()).toBe('sarvam');
    expect(service.supportsEmbeddings()).toBe(false);
  });

  it('still uses an OpenAI key for embeddings when no allowlist is set', () => {
    const service = router({ SARVAM_API_KEY: 'sk_sarvam_0123456789abcdef', OPENAI_API_KEY: 'sk-openai-0123456789abcdef' });
    expect(service.provider()).toBe('sarvam');
    expect(service.supportsEmbeddings()).toBe(true);
  });
});
