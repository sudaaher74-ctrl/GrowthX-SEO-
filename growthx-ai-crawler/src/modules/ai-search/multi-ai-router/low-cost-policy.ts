import { ForbiddenException } from '@nestjs/common';
import { AiProvider, AiRequest, AiTask } from './multi-ai-router.types';

export type CostBucket = 'VISIBILITY' | 'INTERNAL' | 'FIX_ENGINE';
export const MONITORING = { questions: 20, models: 5, cycles: 3, requests: 300 } as const;
// Price ceilings, USD per million text tokens; verified 2026-10-20. These are
// limits, never a substitute for the live OpenRouter price check.
export const APPROVED_MODELS = {
  'gemini-3.5-flash-lite': { input: 0.30, output: 2.50, search: 0 },
  'gemini-2.5-flash': { input: 0.30, output: 2.5, search: 0 },
  'openai/gpt-4.1-mini': { input: 0.40, output: 1.6, search: 0 },
  'anthropic/claude-haiku-4.5': { input: 1, output: 5, search: 0 },
  'perplexity/sonar': { input: 1, output: 1, search: 0.005 },
  // Retained as an approved identity, but unavailable catalog entries fail closed.
  'x-ai/grok-4-fast': { input: 0.2, output: 0.5, search: 0 },
} as const;
export type ApprovedModel = keyof typeof APPROVED_MODELS;
export const VISIBILITY_MODELS: Partial<Record<AiProvider, ApprovedModel>> = {
  [AiProvider.GEMINI]: 'gemini-2.5-flash',
  [AiProvider.OPENAI]: 'openai/gpt-4.1-mini',
  [AiProvider.ANTHROPIC]: 'anthropic/claude-haiku-4.5',
  [AiProvider.PERPLEXITY]: 'perplexity/sonar',
  [AiProvider.GROK]: 'x-ai/grok-4-fast',
};
export function costBucket(request: AiRequest): CostBucket {
  if (request.freshMeasurement || request.task === AiTask.VISIBILITY_MEASUREMENT) return 'VISIBILITY';
  if ([AiTask.CODE_GEN, AiTask.CODE_GENERATION, AiTask.CODE_REVIEW, AiTask.FIX_VALIDATION].includes(request.task!)) return 'FIX_ENGINE';
  return 'INTERNAL';
}
export function policyModel(request: AiRequest): ApprovedModel {
  // Owner requested existing OpenRouter search for competitor discovery on 20 October.
  if (request.task === AiTask.COMPETITOR_DISCOVERY) return 'perplexity/sonar';
  if (costBucket(request) === 'VISIBILITY') {
    const model = VISIBILITY_MODELS[request.provider ?? AiProvider.GEMINI];
    if (!model) throw new ForbiddenException('This assistant is not approved for visibility monitoring.');
    return model;
  }
  // Legacy product services pinned Sarvam/Mammouth. The operator's current
  // policy supersedes those defaults; internal work always uses direct Gemini.
  // Owner approved Flash for visibility preparation/classification on 2026-10-16:
  // the configured Flash-Lite identity returns 404. Keep the same INTERNAL budget.
  return costBucket(request) === 'FIX_ENGINE' || request.task === AiTask.AI_VISIBILITY_ANALYSIS || request.task === AiTask.COMPETITOR_ANALYSIS || request.task === AiTask.REASONING
    ? 'gemini-2.5-flash' : 'gemini-3.5-flash-lite';
}
export function policyTokens(request: AiRequest): number {
  const cap = costBucket(request) === 'VISIBILITY' ? 800 : costBucket(request) === 'FIX_ENGINE' ? 4000 : request.jsonSchema ? 6500 : 2000;
  if (request.maxTokens !== undefined && (!Number.isFinite(request.maxTokens) || request.maxTokens <= 0))
    throw new ForbiddenException('Invalid AI output-token limit.');
  return Math.max(1, Math.min(Math.floor(request.maxTokens ?? cap), cap));
}


