import { Logger, ServiceUnavailableException } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { AiCompletion, AiProvider, AiRequest, AiTask, Rate, AiUsage, ANTHROPIC_RATES } from './multi-ai-router.types';

export interface ExecuteAnthropicParams {
  anthropic?: Anthropic;
  anthropicModel: string;
  serverSideFallbackEnabled: boolean;
  request: AiRequest;
  task: AiTask;
  logger: Logger;
  onDisableServerSideFallback: () => void;
  usageFn: (inputTokens: number, outputTokens: number, rate?: Rate) => AiUsage;
}

/**
 * Asks Anthropic to re-serve a declined request on its recommended fallback
 * model. The beta may not be enabled on every account, so a rejection here
 * disables the flag and retries plainly rather than failing the caller.
 */
export async function anthropicWithFallback(
  anthropic: Anthropic,
  body: Record<string, any>,
  logger: Logger,
  onDisableServerSideFallback: () => void,
) {
  try {
    return await (anthropic as any).beta.messages.create({
      ...body,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
    });
  } catch (error: any) {
    const message = String(error?.message ?? '');
    if (!/beta|fallback/i.test(message)) throw error;

    logger.warn(`Server-side fallback unavailable (${message}); continuing without it.`);
    onDisableServerSideFallback();
    return anthropic.messages.create(body as any);
  }
}

export async function executeAnthropicCall({
  anthropic,
  anthropicModel,
  serverSideFallbackEnabled,
  request,
  task,
  logger,
  onDisableServerSideFallback,
  usageFn,
}: ExecuteAnthropicParams): Promise<AiCompletion> {
  if (!anthropic) throw new ServiceUnavailableException('ANTHROPIC_API_KEY is not configured.');

  // Thinking is on by default on Opus 5 and counts against max_tokens, so the
  // budget has to cover reasoning as well as the answer or replies truncate.
  const maxTokens = request.maxTokens ?? 8000;

  const body: Record<string, any> = {
    model: anthropicModel,
    max_tokens: maxTokens,
    messages: [{ role: 'user', content: request.prompt }],
    output_config: {
      effort: task === AiTask.FAST ? 'low' : 'high',
      ...(request.jsonSchema ? { format: { type: 'json_schema', schema: request.jsonSchema } } : {}),
    },
  };
  if (request.systemInstruction) body.system = request.systemInstruction;
  // No temperature / top_p / top_k — those are rejected on this model family.

  const message = serverSideFallbackEnabled
    ? await anthropicWithFallback(anthropic, body, logger, onDisableServerSideFallback)
    : await anthropic.messages.create(body as any);

  // Safety classifiers decline with HTTP 200, so this must be checked before
  // reading content — otherwise an empty content array throws.
  const refused = message.stop_reason === 'refusal';
  const text = refused
    ? ''
    : message.content
        .filter((block: any) => block.type === 'text')
        .map((block: any) => block.text)
        .join('');

  if (refused) {
    logger.warn(`Anthropic declined the request (${(message as any).stop_details?.category ?? 'unspecified'}).`);
  }

  return {
    provider: AiProvider.ANTHROPIC,
    model: message.model,
    text,
    usage: usageFn(
      message.usage?.input_tokens ?? 0,
      message.usage?.output_tokens ?? 0,
      ANTHROPIC_RATES[message.model] ?? ANTHROPIC_RATES[anthropicModel],
    ),
    refused,
  };
}
