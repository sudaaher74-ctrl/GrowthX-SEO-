/**
 * Shared request-shaping for Sarvam's chat completions API.
 *
 * Sarvam's flagship model reasons before it answers, and it says so in its own
 * docs: `reasoning_effort` defaults to on, and reasoning tokens are billed as
 * completion tokens against `max_tokens`. A budget sized for the answer alone
 * therefore gets spent entirely on thinking — the request succeeds, the tokens
 * are charged, and `message.content` comes back empty or as a half-written
 * object. Every Sarvam call in this codebase wants a finished artifact rather
 * than a chain of thought, so reasoning is disabled by default here and the
 * whole budget goes to the answer.
 *
 * Every Sarvam call site shares this file so the three transports (the
 * ai-engine provider, the multi-AI router, and the market-research model
 * router) cannot drift apart on the parameters that decide whether output
 * arrives at all.
 */

export const SARVAM_CHAT_COMPLETIONS_URL = 'https://api.sarvam.ai/v1/chat/completions';

/**
 * `POST /v1/chat/completions` serves these two ids and nothing else. Sarvam-M
 * and the small `sarvam-2b` generation are gone from the API, so an inherited
 * value naming one of them is a misconfiguration to correct, not to forward.
 */
export const SARVAM_CHAT_MODELS = ['sarvam-105b', 'sarvam-105b-conversations'] as const;

export const SARVAM_DEFAULT_MODEL = 'sarvam-105b';

/**
 * Sarvam caps `max_tokens` by plan: Starter 4096, Pro 16384, Business 128000.
 * The lowest cap is the safe default — a request above the account's ceiling is
 * rejected outright. Operators on a larger plan raise it with
 * SARVAM_MAX_OUTPUT_TOKENS.
 */
export const SARVAM_DEFAULT_MAX_OUTPUT_TOKENS = 4096;

/**
 * A JSON answer that gets cut off mid-object is worth nothing, so structured
 * calls are never given less than this even when the caller asks for less.
 */
export const SARVAM_MIN_JSON_OUTPUT_TOKENS = 1500;

export type SarvamReasoningEffort = 'low' | 'medium' | 'high' | null;

/** Minimal reader over either NestJS ConfigService or process.env. */
export interface SarvamConfigReader {
  get<T = string>(key: string): T | undefined;
}

function read(config: SarvamConfigReader | undefined, key: string): string | undefined {
  const value = config?.get<string>(key) ?? process.env[key];
  const trimmed = typeof value === 'string' ? value.trim() : undefined;
  return trimmed ? trimmed : undefined;
}

/**
 * Resolves the chat model, refusing to pass through an id the endpoint does not
 * serve. `.env` files predating the Sarvam-M retirement still carry
 * `SARVAM_MODEL=sarvam-2b`, which would fail every request.
 */
export function resolveSarvamModel(
  config?: SarvamConfigReader,
  override?: string,
): { model: string; warning?: string } {
  const requested = override?.trim() || read(config, 'SARVAM_MODEL');
  if (!requested) return { model: SARVAM_DEFAULT_MODEL };

  if ((SARVAM_CHAT_MODELS as readonly string[]).includes(requested)) {
    return { model: requested };
  }

  return {
    model: SARVAM_DEFAULT_MODEL,
    warning:
      `SARVAM_MODEL='${requested}' is not served by ${SARVAM_CHAT_COMPLETIONS_URL} ` +
      `(supported: ${SARVAM_CHAT_MODELS.join(', ')}). Falling back to ${SARVAM_DEFAULT_MODEL}.`,
  };
}

/**
 * Reasoning is off unless an operator asks for it. `null` is not "unset" here:
 * Sarvam disables thinking only when the field is explicitly null, so the key
 * is always sent.
 */
export function resolveSarvamReasoningEffort(config?: SarvamConfigReader): SarvamReasoningEffort {
  const configured = read(config, 'SARVAM_REASONING_EFFORT')?.toLowerCase();
  if (configured === 'low' || configured === 'medium' || configured === 'high') return configured;
  return null;
}

/** The account's `max_tokens` ceiling, which a request may not exceed. */
export function resolveSarvamMaxOutputTokens(config?: SarvamConfigReader): number {
  const configured = Number(read(config, 'SARVAM_MAX_OUTPUT_TOKENS'));
  return Number.isFinite(configured) && configured > 0
    ? Math.floor(configured)
    : SARVAM_DEFAULT_MAX_OUTPUT_TOKENS;
}

/**
 * Clamps a caller's budget into what the account actually allows.
 *
 * Callers ask for anything from 512 to 16000 tokens. Above the plan ceiling the
 * request is rejected; below the JSON floor the answer arrives truncated. Both
 * ends are corrected here rather than at each call site.
 */
export function clampSarvamMaxTokens(
  requested: number | undefined,
  options: { config?: SarvamConfigReader; structured?: boolean } = {},
): number {
  const ceiling = resolveSarvamMaxOutputTokens(options.config);
  const floor = options.structured ? Math.min(SARVAM_MIN_JSON_OUTPUT_TOKENS, ceiling) : 1;
  const asked = Number.isFinite(requested) && (requested as number) > 0 ? Math.floor(requested as number) : ceiling;
  return Math.min(Math.max(asked, floor), ceiling);
}

export interface SarvamBodyOptions {
  model: string;
  messages: Array<{ role: string; content: string }>;
  maxTokens: number;
  temperature?: number;
  reasoningEffort: SarvamReasoningEffort;
  /** Requests `json_object` mode, which guarantees parseable JSON. */
  jsonMode?: boolean;
}

export function buildSarvamBody(options: SarvamBodyOptions): Record<string, unknown> {
  return {
    model: options.model,
    messages: options.messages,
    // Sarvam's own default is 0.5 with reasoning on and 0.2 with it off.
    temperature: options.temperature ?? 0.2,
    max_tokens: options.maxTokens,
    // Explicit null is the documented way to turn thinking off. Omitting the
    // key re-enables it, which is the bug this file exists to prevent.
    reasoning_effort: options.reasoningEffort,
    ...(options.jsonMode ? { response_format: { type: 'json_object' } } : {}),
  };
}

/**
 * Drops a request field Sarvam rejected, so a 400 naming an unsupported
 * parameter can be retried as a plain call instead of failing the user.
 * Returns null when the error names nothing we know how to give up.
 */
export function relaxSarvamBody(
  body: Record<string, unknown>,
  errorText: string,
): { body: Record<string, unknown>; dropped: string } | null {
  const lowered = errorText.toLowerCase();

  if ('response_format' in body && lowered.includes('response_format')) {
    const { response_format: _dropped, ...rest } = body;
    return { body: rest, dropped: 'response_format' };
  }

  if ('reasoning_effort' in body && lowered.includes('reasoning_effort')) {
    const { reasoning_effort: _dropped, ...rest } = body;
    return { body: rest, dropped: 'reasoning_effort' };
  }

  return null;
}

export interface SarvamMessageRead {
  /** `message.content` with any stray thinking block removed. */
  text: string;
  finishReason?: string;
  /** True when the model spent tokens reasoning on this call. */
  hadReasoning: boolean;
  promptTokens: number;
  completionTokens: number;
}

/**
 * Reads a completion, keeping the thinking and the answer apart.
 *
 * Sarvam returns the chain of thought in `message.reasoning_content`, but a
 * truncated or older response can leave a `<think>` block inside `content`.
 * Neither belongs in an artifact shown to a user, and neither parses as JSON.
 */
export function readSarvamMessage(json: any): SarvamMessageRead {
  const choice = json?.choices?.[0];
  const raw = typeof choice?.message?.content === 'string' ? choice.message.content : '';
  const reasoning = choice?.message?.reasoning_content;

  const text = raw
    // A closed thinking block, and an unclosed one left by truncation.
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<think>[\s\S]*$/i, '')
    .trim();

  return {
    text,
    finishReason: choice?.finish_reason,
    hadReasoning: typeof reasoning === 'string' && reasoning.trim().length > 0,
    promptTokens: json?.usage?.prompt_tokens ?? 0,
    completionTokens: json?.usage?.completion_tokens ?? 0,
  };
}

/**
 * Explains an empty answer in terms the operator can act on.
 *
 * "The model returned nothing" is not actionable; "it spent all 512 tokens
 * thinking" names both the cause and the setting that fixes it.
 */
export function describeEmptySarvamResponse(read: SarvamMessageRead, maxTokens: number): string {
  if (read.finishReason === 'length') {
    return (
      `Sarvam hit the ${maxTokens}-token output limit before writing an answer ` +
      `(${read.completionTokens} completion tokens were spent${read.hadReasoning ? ', on reasoning' : ''}). ` +
      'Raise SARVAM_MAX_OUTPUT_TOKENS, or keep SARVAM_REASONING_EFFORT unset so thinking stays disabled.'
    );
  }

  if (read.hadReasoning) {
    return (
      'Sarvam returned reasoning but no answer. Raise SARVAM_MAX_OUTPUT_TOKENS or leave ' +
      'SARVAM_REASONING_EFFORT unset so the whole budget goes to the answer.'
    );
  }

  if (read.finishReason === 'content_filter') {
    return 'Sarvam declined this request through its content filter.';
  }

  return `Sarvam returned an empty answer (finish_reason: ${read.finishReason ?? 'unknown'}).`;
}
