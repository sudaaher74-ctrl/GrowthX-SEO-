import { ServiceUnavailableException } from '@nestjs/common';
import { OpenAI } from 'openai';
import { AiCompletion, AiProvider, AiRequest, AiTask, Rate, AiUsage } from './multi-ai-router.types';
import { MammouthCapability, resolveMammouthModelForCapability } from './mammouth-models.config';

export function taskToCapability(task: AiTask): MammouthCapability {
  switch (task) {
    case AiTask.SEO_RESEARCH:
    case AiTask.SEO_ANALYSIS:
    case AiTask.SEO_OPPORTUNITY_GENERATION:
      return MammouthCapability.SEO_ANALYSIS;
    case AiTask.COMPETITOR_ANALYSIS:
      return MammouthCapability.COMPETITOR_ANALYSIS;
    case AiTask.AI_VISIBILITY_ANALYSIS:
      return MammouthCapability.AEV_ANALYSIS;
    case AiTask.CODE_GENERATION:
    case AiTask.CODE_REVIEW:
    case AiTask.FIX_VALIDATION:
      return MammouthCapability.TECHNICAL_SEO_REASONING;
    case AiTask.CONTENT_STRUCTURE_ANALYSIS:
    case AiTask.ENTITY_ANALYSIS:
      return MammouthCapability.CONTENT_ANALYSIS;
    case AiTask.FAST:
      return MammouthCapability.KEYWORD_ANALYSIS;
    case AiTask.REASONING:
    default:
      return MammouthCapability.LONG_FORM_REASONING;
  }
}

/**
 * Upstream errors quote the offending request back, and an OpenAI-compatible
 * gateway will happily include the bearer token in that quote. The message
 * ends up in an HTTP response body and in the logs, so scrub the key out of
 * it before it travels anywhere.
 */
export function redactMammouthKey(message: string, mammouthKey?: string): string {
  let out = message;
  if (mammouthKey && mammouthKey.length >= 8) {
    out = out.split(mammouthKey).join('[REDACTED]');
  }
  // Also catch any other bearer-style token the upstream echoed back.
  return out.replace(/\b(sk|pk|api)[-_][A-Za-z0-9_-]{8,}/gi, '[REDACTED]');
}

export interface ExecuteMammouthParams {
  mammouth?: OpenAI;
  mammouthKey?: string;
  defaultModel: string;
  temperature: number;
  maxTokens: number;
  request: AiRequest;
  task: AiTask;
  modelOverride?: string;
  rate?: Rate;
  usageFn: (inputTokens: number, outputTokens: number, rate?: Rate) => AiUsage;
}

export async function executeMammouthCall({
  mammouth,
  mammouthKey,
  defaultModel,
  temperature,
  maxTokens,
  request,
  task,
  modelOverride,
  rate,
  usageFn,
}: ExecuteMammouthParams): Promise<AiCompletion> {
  if (!mammouth) {
    throw new ServiceUnavailableException('MAMMOUTH_API_KEY is not configured.');
  }

  const capability = taskToCapability(task);
  const chosenModel = modelOverride || resolveMammouthModelForCapability(capability, {
    userSelectedModel: defaultModel,
  });

  const messages: any[] = [];
  let system = request.systemInstruction;
  if (request.jsonSchema) {
    const schemaInstruction = `You MUST return strictly valid JSON matching this schema:\n${JSON.stringify(request.jsonSchema)}`;
    system = system ? `${system}\n\n${schemaInstruction}` : schemaInstruction;
  }

  if (system) messages.push({ role: 'system', content: system });
  messages.push({ role: 'user', content: request.prompt });

  try {
    const response = await mammouth.chat.completions.create({
      model: chosenModel,
      messages,
      temperature,
      max_tokens: request.maxTokens ?? maxTokens,
      ...(request.jsonSchema ? { response_format: { type: 'json_object' } } : {}),
    } as any);

    const content = response.choices?.[0]?.message?.content ?? '';

    return {
      provider: AiProvider.MAMMOUTH,
      model: response.model ?? chosenModel,
      text: content,
      usage: usageFn(
        response.usage?.prompt_tokens ?? 0,
        response.usage?.completion_tokens ?? 0,
        rate,
      ),
      refused: false,
    };
  } catch (error: any) {
    const status = error?.status || error?.statusCode;
    const message = redactMammouthKey(
      String(error?.message || error || 'Unknown Mammouth error'),
      mammouthKey,
    );

    if (status === 401 || /unauthorized|api key|invalid proxy server token/i.test(message)) {
      throw new ServiceUnavailableException('Mammouth AI authentication failed: invalid API key.');
    }
    if (status === 429 || /rate limit|quota|credits|budget|exceededbudget/i.test(message)) {
      throw new ServiceUnavailableException('Mammouth AI rate limit or quota exceeded. Please check credits.');
    }
    if (/timeout|abort|econnrefused/i.test(message)) {
      throw new ServiceUnavailableException('Mammouth AI request timed out.');
    }

    throw new ServiceUnavailableException(`Mammouth AI error: ${message}`);
  }
}
