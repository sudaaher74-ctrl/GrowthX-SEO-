import { AiProvider } from '../ai-search/multi-ai-router/multi-ai-router.types';

const SUPPORTED = [AiProvider.GEMINI, AiProvider.OPENROUTER, AiProvider.SARVAM];

/** Keep existing deployments compatible; a host can explicitly select its vendors. */
export function visibilityProviders(setting?: string): AiProvider[] {
  if (!setting?.trim()) return [AiProvider.GEMINI, AiProvider.SARVAM];
  const selected = [...new Set(setting.split(',').map(value => value.trim().toUpperCase()).filter(Boolean))];
  if (!selected.length || selected.some(value => !SUPPORTED.includes(value as AiProvider))) {
    throw new Error('Unsupported AI Visibility provider configuration.');
  }
  return selected as AiProvider[];
}
