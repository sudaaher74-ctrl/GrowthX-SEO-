import { AiProvider } from '../ai-search/multi-ai-router/multi-ai-router.types';
import { visibilityProviders } from './visibility-providers';

describe('AI Visibility provider selection', () => {
  it('preserves the existing deployment default when no override is set', () => {
    expect(visibilityProviders()).toEqual([AiProvider.GEMINI, AiProvider.SARVAM]);
  });
  it('allows Gemini and OpenRouter without adding Sarvam', () => {
    expect(visibilityProviders(' gemini, OPENROUTER,gemini ')).toEqual([
      AiProvider.GEMINI, AiProvider.OPENROUTER,
    ]);
  });
  it('rejects unknown vendor names instead of reporting unmeasured assistants', () => {
    expect(() => visibilityProviders('GEMINI,unknown')).toThrow('Unsupported');
  });
});
