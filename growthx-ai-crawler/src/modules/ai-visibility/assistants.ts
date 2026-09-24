import { AiAssistant } from '@prisma/client';
import { AiProvider, MultiAiRouterService } from '../ai-search/multi-ai-router/multi-ai-router.service';

/**
 * Which assistants we can genuinely query.
 *
 * Perplexity, Google AI Overviews, and Copilot have no API we can drive, so a
 * check against them records an explicit error instead of a fabricated result.
 * Wiring one up later means adding an entry here and nothing else.
 *
 * Each assistant is only ever answered by its own vendor. A Sarvam answer
 * stored as CHATGPT would report a ChatGPT citation share that ChatGPT was
 * never asked for, so Sarvam is measured as itself.
 */
export const ASSISTANT_PROVIDER: Readonly<Partial<Record<AiAssistant, AiProvider>>> = {
  [AiAssistant.CHATGPT]: AiProvider.OPENAI,
  [AiAssistant.CLAUDE]: AiProvider.ANTHROPIC,
  [AiAssistant.GEMINI]: AiProvider.GEMINI,
  [AiAssistant.SARVAM]: AiProvider.SARVAM,
};

export const SUPPORTED_ASSISTANTS = Object.keys(ASSISTANT_PROVIDER) as AiAssistant[];

/**
 * The assistants this deployment can actually ask: those with a vendor API
 * whose key is configured. When the router cannot say what is configured,
 * every assistant with an API is assumed reachable and a missing key surfaces
 * as a per-check error instead.
 */
export function measurableAssistantsFor(router: Pick<MultiAiRouterService, 'configuredProviders'> | undefined): AiAssistant[] {
  const configured = router?.configuredProviders?.();
  if (!configured) return SUPPORTED_ASSISTANTS;
  return SUPPORTED_ASSISTANTS.filter((a) => configured.includes(ASSISTANT_PROVIDER[a]!));
}
