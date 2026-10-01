import { Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  SARVAM_CHAT_COMPLETIONS_URL,
  SarvamReasoningEffort,
  buildSarvamBody,
  clampSarvamMaxTokens,
  describeEmptySarvamResponse,
  readSarvamMessage,
  relaxSarvamBody,
} from '../../ai-engine/utils/sarvam-request.util';
import { isConfiguredValue } from '../../../config/optional-env';
import { AiCompletion, AiProvider, AiRequest, Rate, AiUsage } from './multi-ai-router.types';

export function postToSarvam(sarvamKey: string, body: Record<string, unknown>): Promise<Response> {
  return fetch(SARVAM_CHAT_COMPLETIONS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-subscription-key': sarvamKey,
      Authorization: `Bearer ${sarvamKey}`,
    },
    body: JSON.stringify(body),
  });
}

export interface ExecuteSarvamParams {
  sarvamKey?: string;
  sarvamModel: string;
  sarvamReasoningEffort: SarvamReasoningEffort;
  config: ConfigService;
  request: AiRequest;
  rate?: Rate;
  logger: Logger;
  usageFn: (inputTokens: number, outputTokens: number, rate?: Rate) => AiUsage;
}

export async function executeSarvamCall({
  sarvamKey,
  sarvamModel,
  sarvamReasoningEffort,
  config,
  request,
  rate,
  logger,
  usageFn,
}: ExecuteSarvamParams): Promise<AiCompletion> {
  if (!isConfiguredValue(sarvamKey)) {
    throw new ServiceUnavailableException('SARVAM_API_KEY is not configured.');
  }

  const messages: Array<{ role: string; content: string }> = [];
  let system = request.systemInstruction;
  if (request.jsonSchema) {
    const schemaInstruction = `You MUST return strictly valid JSON matching this schema:\n${JSON.stringify(request.jsonSchema)}`;
    system = system ? `${system}\n\n${schemaInstruction}` : schemaInstruction;
  }

  if (system) messages.push({ role: 'system', content: system });
  messages.push({ role: 'user', content: request.prompt });

  // Callers ask for anything between 512 and 16000 tokens. Sarvam caps output
  // by plan and charges reasoning against the same budget, so the request is
  // clamped to what the account allows and floored high enough that a JSON
  // answer has room to finish.
  const maxTokens = clampSarvamMaxTokens(request.maxTokens, {
    config,
    structured: Boolean(request.jsonSchema),
  });

  let body = buildSarvamBody({
    model: sarvamModel,
    messages,
    maxTokens,
    reasoningEffort: sarvamReasoningEffort,
    jsonMode: Boolean(request.jsonSchema),
  });

  let response = await postToSarvam(sarvamKey, body);

  if (response.status === 400) {
    const errText = await response.text().catch(() => '');
    const relaxed = relaxSarvamBody(body, errText);
    if (!relaxed) {
      throw new ServiceUnavailableException(`Sarvam API failed (HTTP 400): ${errText}`);
    }
    logger.warn(`Sarvam rejected '${relaxed.dropped}'; retrying without it.`);
    body = relaxed.body;
    response = await postToSarvam(sarvamKey, body);
  }

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new ServiceUnavailableException(`Sarvam API failed (HTTP ${response.status}): ${errText}`);
  }

  const json: any = await response.json();
  const message = readSarvamMessage(json);

  // Returning '' here used to leave every caller parsing an empty string into
  // an empty object and writing a blank record. The cause is knowable —
  // usually the output budget spent on reasoning — so it is raised, not hidden.
  if (!message.text) {
    throw new ServiceUnavailableException(describeEmptySarvamResponse(message, maxTokens));
  }

  return {
    provider: AiProvider.SARVAM,
    model: json?.model ?? sarvamModel,
    text: message.text,
    // Sarvam publishes no rate we can hard-code, so cost is only known when
    // the operator supplies one. This matters more than it looks: an install
    // running entirely on Sarvam otherwise records every call at no cost, the
    // ledger reports zero spend, and the organization's monthly budget can
    // never fire. Set SARVAM_RATE_INPUT_PER_MTOK / SARVAM_RATE_OUTPUT_PER_MTOK
    // to make the ceiling real.
    usage: usageFn(message.promptTokens, message.completionTokens, rate),
    refused: false,
  };
}
