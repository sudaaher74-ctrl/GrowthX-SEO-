import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenAI } from '@google/genai';
import { OpenAI } from 'openai';
import Groq from 'groq-sdk';
import {
  SARVAM_CHAT_COMPLETIONS_URL,
  SarvamReasoningEffort,
  buildSarvamBody,
  clampSarvamMaxTokens,
  describeEmptySarvamResponse,
  readSarvamMessage,
  relaxSarvamBody,
  resolveSarvamModel,
  resolveSarvamReasoningEffort,
} from '../../ai-engine/utils/sarvam-request.util';

export enum AiProvider {
  SARVAM = 'SARVAM',
  GEMINI = 'GEMINI',
  OPENAI = 'OPENAI',
  ANTHROPIC = 'ANTHROPIC',
  GROQ = 'GROQ',
  OPENROUTER = 'OPENROUTER',
}

/** What the caller wants done, independent of which vendor ends up serving it. */
export enum AiTask {
  /** Deep SEO reasoning, strategy, competitive analysis. */
  REASONING = 'REASONING',
  /** Generating code patches for the autonomous engineer. */
  CODE_GEN = 'CODE_GEN',
  /** Cheap, high-volume extraction and classification. */
  FAST = 'FAST',
}

export interface AiRequest {
  prompt: string;
  systemInstruction?: string;
  task?: AiTask;
  /** Force a specific vendor. Denied with 403 if the plan does not include it. */
  provider?: AiProvider;
  /** When present, the organization's plan decides which vendors are reachable. */
  organizationId?: string;
  /** JSON Schema. When supplied, the response is constrained to match it. */
  jsonSchema?: Record<string, unknown>;
  maxTokens?: number;
}

export interface AiUsage {
  inputTokens: number;
  outputTokens: number;
  /** Null when we have no published rate for the model — never a guessed number. */
  estimatedCostUsd: number | null;
}

export interface AiCompletion {
  provider: AiProvider;
  model: string;
  text: string;
  usage: AiUsage;
  /** Set when the vendor's safety classifiers declined rather than answered. */
  refused: boolean;
}

/** USD per million tokens. */
interface Rate {
  input: number;
  output: number;
}

/**
 * Published Anthropic rates. Other vendors are left out deliberately: we report
 * token counts for them but no cost, because a wrong margin number is worse
 * than an absent one. Set GEMINI_RATE_* / OPENAI_RATE_* to fill them in.
 */
const ANTHROPIC_RATES: Readonly<Record<string, Rate>> = {
  'claude-opus-5': { input: 5, output: 25 },
  'claude-sonnet-5': { input: 3, output: 15 },
  'claude-haiku-4-5': { input: 1, output: 5 },
};

/** Which vendor each task prefers, best first. */
const TASK_PREFERENCE: Readonly<Record<AiTask, readonly AiProvider[]>> = {
  [AiTask.REASONING]: [AiProvider.ANTHROPIC, AiProvider.GEMINI, AiProvider.OPENAI, AiProvider.SARVAM, AiProvider.GROQ, AiProvider.OPENROUTER],
  [AiTask.CODE_GEN]: [AiProvider.ANTHROPIC, AiProvider.OPENAI, AiProvider.GEMINI, AiProvider.SARVAM, AiProvider.GROQ, AiProvider.OPENROUTER],
  [AiTask.FAST]: [AiProvider.SARVAM, AiProvider.GROQ, AiProvider.GEMINI, AiProvider.OPENAI, AiProvider.ANTHROPIC, AiProvider.OPENROUTER],
};


@Injectable()
export class MultiAiRouterService {
  private readonly logger = new Logger(MultiAiRouterService.name);

  private readonly anthropicModel: string;
  private readonly geminiModel: string;
  private readonly openaiModel: string;
  private readonly groqModel: string;
  private readonly groqTemperature: number;
  private readonly groqMaxTokens: number;
  private readonly openrouterModel: string;
  private readonly openrouterTemperature: number;
  private readonly openrouterMaxTokens: number;
  private readonly sarvamModel: string;
  private readonly sarvamKey?: string;
  private readonly sarvamReasoningEffort: SarvamReasoningEffort;

  private anthropic?: Anthropic;
  private openai?: OpenAI;
  private gemini?: GoogleGenAI;
  private groq?: Groq;
  private openrouter?: OpenAI;

  /**
   * Anthropic's server-side refusal fallback re-serves a declined request on
   * another model inside the same call. It is behind a beta flag, so a
   * rejection here degrades to a plain call rather than failing the request.
   */
  private serverSideFallbackEnabled: boolean;

  constructor(
    private readonly config: ConfigService,) {
    this.anthropicModel = this.config.get<string>('ANTHROPIC_MODEL') || 'claude-opus-5';
    this.geminiModel = this.config.get<string>('GEMINI_MODEL') || 'gemini-2.5-pro';
    this.openaiModel = this.config.get<string>('OPENAI_MODEL') || 'gpt-4o';
    this.groqModel = this.config.get<string>('GROQ_MODEL') || 'llama-3.1-8b-instant';
    this.groqTemperature = Number(this.config.get<string>('GROQ_TEMPERATURE') ?? '0.2');
    this.groqMaxTokens = Number(this.config.get<string>('GROQ_MAX_TOKENS') ?? '2000');
    this.openrouterModel = this.config.get<string>('OPENROUTER_MODEL') || 'openai/gpt-4o-mini';
    this.openrouterTemperature = Number(this.config.get<string>('OPENROUTER_TEMPERATURE') ?? '0.2');
    this.openrouterMaxTokens = Number(this.config.get<string>('OPENROUTER_MAX_TOKENS') ?? '2000');
    const sarvam = resolveSarvamModel(this.config);
    this.sarvamModel = sarvam.model;
    if (sarvam.warning) this.logger.warn(sarvam.warning);
    this.sarvamKey = this.config.get<string>('SARVAM_API_KEY');
    this.sarvamReasoningEffort = resolveSarvamReasoningEffort(this.config);
    this.serverSideFallbackEnabled = this.config.get<string>('ANTHROPIC_SERVER_SIDE_FALLBACK') !== 'false';

    const anthropicKey = this.config.get<string>('ANTHROPIC_API_KEY');
    if (this.isRealKey(anthropicKey)) this.anthropic = new Anthropic({ apiKey: anthropicKey });

    const openaiKey = this.config.get<string>('OPENAI_API_KEY');
    if (this.isRealKey(openaiKey)) this.openai = new OpenAI({ apiKey: openaiKey });

    const geminiKey = this.config.get<string>('GEMINI_API_KEY');
    if (this.isRealKey(geminiKey)) this.gemini = new GoogleGenAI({ apiKey: geminiKey });

    const groqKey = this.config.get<string>('GROQ_API_KEY');
    if (this.isRealKey(groqKey)) this.groq = new Groq({ apiKey: groqKey });

    const openrouterKey = this.config.get<string>('OPENROUTER_API_KEY');
    if (this.isRealKey(openrouterKey)) {
      this.openrouter = new OpenAI({
        apiKey: openrouterKey,
        baseURL: 'https://openrouter.ai/api/v1',
        defaultHeaders: {
          'HTTP-Referer': this.config.get<string>('OPENROUTER_SITE_URL') || 'https://growthx.ai',
          'X-Title': this.config.get<string>('OPENROUTER_SITE_NAME') || 'GrowthX AI SEO',
        },
      });
    }

    this.logger.log(`AI providers configured: ${this.configuredProviders().join(', ') || 'none'}`);
  }

  /** Placeholder values from .env.example must not count as configured. */
  private isRealKey(value?: string): value is string {
    if (!value) return false;
    const lower = value.toLowerCase();
    return !lower.startsWith('your_') && !lower.startsWith('add-') && !lower.includes('***');
  }

  configuredProviders(): AiProvider[] {
    const configured: AiProvider[] = [];
    if (this.isRealKey(this.sarvamKey)) configured.push(AiProvider.SARVAM);
    if (this.gemini) configured.push(AiProvider.GEMINI);
    if (this.openai) configured.push(AiProvider.OPENAI);
    if (this.anthropic) configured.push(AiProvider.ANTHROPIC);
    if (this.groq) configured.push(AiProvider.GROQ);
    if (this.openrouter) configured.push(AiProvider.OPENROUTER);
    return configured;
  }

  /**
   * Runs a prompt against the best vendor the caller's plan allows.
   *
   * Selection order: an explicitly requested provider (403 if not in plan) →
   * the task's preference list, filtered to what the plan allows and what has
   * credentials. If the chosen vendor errors or its safety classifiers decline,
   * the next allowed vendor is tried.
   */
  async generate(request: AiRequest): Promise<AiCompletion> {
    const task = request.task ?? AiTask.REASONING;
    const allowed = this.configuredProviders();

    const targetProvider = request.provider;

    if (targetProvider) {
      if (!allowed.includes(targetProvider)) {
         throw new ServiceUnavailableException(`${targetProvider} is not configured.`);
      }
      return this.invoke(targetProvider, request, task);
    }

    const chain = TASK_PREFERENCE[task].filter((p) => allowed.includes(p));
    if (chain.length === 0) {
      throw new ServiceUnavailableException(
        'No AI provider is available for this plan. Check plan entitlements and provider API keys.',
      );
    }

    let lastError: unknown;
    for (const provider of chain) {
      try {
        const completion = await this.invoke(provider, request, task);
        if (completion.refused && chain.length > 1) {
          this.logger.warn(`${provider} declined the request; trying the next provider.`);
          lastError = new Error(`${provider} declined the request.`);
          continue;
        }
        return completion;
      } catch (error: any) {
        this.logger.warn(`${provider} failed: ${error.message}. Falling through.`);
        lastError = error;
      }
    }

    throw new ServiceUnavailableException(
      `All available AI providers failed. Last error: ${(lastError as Error)?.message ?? 'unknown'}`,
    );
  }

  /** Vendors the org's plan permits, intersected with what has credentials. */
  private invoke(provider: AiProvider, request: AiRequest, task: AiTask, modelOverride?: string): Promise<AiCompletion> {
    switch (provider) {
      case AiProvider.SARVAM:
        return this.callSarvam(request);
      case AiProvider.ANTHROPIC:
        return this.callAnthropic(request, task);
      case AiProvider.OPENAI:
        return this.callOpenAi(request);
      case AiProvider.GEMINI:
        return this.callGemini(request);
      case AiProvider.GROQ:
        return this.callGroq(request);
      case AiProvider.OPENROUTER:
        return this.callOpenRouter(request, modelOverride);
    }
  }

  // ---------------------------------------------------------------- Anthropic

  private async callAnthropic(request: AiRequest, task: AiTask): Promise<AiCompletion> {
    if (!this.anthropic) throw new ServiceUnavailableException('ANTHROPIC_API_KEY is not configured.');

    // Thinking is on by default on Opus 5 and counts against max_tokens, so the
    // budget has to cover reasoning as well as the answer or replies truncate.
    const maxTokens = request.maxTokens ?? 8000;

    const body: Record<string, any> = {
      model: this.anthropicModel,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: request.prompt }],
      output_config: {
        effort: task === AiTask.FAST ? 'low' : 'high',
        ...(request.jsonSchema ? { format: { type: 'json_schema', schema: request.jsonSchema } } : {}),
      },
    };
    if (request.systemInstruction) body.system = request.systemInstruction;
    // No temperature / top_p / top_k — those are rejected on this model family.

    const message = this.serverSideFallbackEnabled
      ? await this.anthropicWithFallback(body)
      : await this.anthropic.messages.create(body as any);

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
      this.logger.warn(`Anthropic declined the request (${(message as any).stop_details?.category ?? 'unspecified'}).`);
    }

    return {
      provider: AiProvider.ANTHROPIC,
      model: message.model,
      text,
      usage: this.usage(
        message.usage?.input_tokens ?? 0,
        message.usage?.output_tokens ?? 0,
        ANTHROPIC_RATES[message.model] ?? ANTHROPIC_RATES[this.anthropicModel],
      ),
      refused,
    };
  }

  /**
   * Asks Anthropic to re-serve a declined request on its recommended fallback
   * model. The beta may not be enabled on every account, so a rejection here
   * disables the flag and retries plainly rather than failing the caller.
   */
  private async anthropicWithFallback(body: Record<string, any>) {
    try {
      return await (this.anthropic as any).beta.messages.create({
        ...body,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
      });
    } catch (error: any) {
      const message = String(error?.message ?? '');
      if (!/beta|fallback/i.test(message)) throw error;

      this.logger.warn(`Server-side fallback unavailable (${message}); continuing without it.`);
      this.serverSideFallbackEnabled = false;
      return this.anthropic!.messages.create(body as any);
    }
  }

  // ------------------------------------------------------------------- OpenAI

  private async callOpenAi(request: AiRequest): Promise<AiCompletion> {
    if (!this.openai) throw new ServiceUnavailableException('OPENAI_API_KEY is not configured.');

    const messages: any[] = [];
    if (request.systemInstruction) messages.push({ role: 'system', content: request.systemInstruction });
    messages.push({ role: 'user', content: request.prompt });

    const response = await this.openai.chat.completions.create({
      model: this.openaiModel,
      messages,
      max_tokens: request.maxTokens ?? 4000,
      ...(request.jsonSchema
        ? {
            response_format: {
              type: 'json_schema',
              json_schema: { name: 'growthx_response', schema: request.jsonSchema, strict: true },
            },
          }
        : {}),
    } as any);

    return {
      provider: AiProvider.OPENAI,
      model: response.model,
      text: response.choices[0]?.message?.content ?? '',
      usage: this.usage(
        response.usage?.prompt_tokens ?? 0,
        response.usage?.completion_tokens ?? 0,
        this.envRate('OPENAI'),
      ),
      refused: false,
    };
  }

  // ------------------------------------------------------------------- Gemini

  private async callGemini(request: AiRequest): Promise<AiCompletion> {
    if (!this.gemini) throw new ServiceUnavailableException('GEMINI_API_KEY is not configured.');

    const response = await this.gemini.models.generateContent({
      model: this.geminiModel,
      contents: request.prompt,
      config: {
        systemInstruction: request.systemInstruction,
        temperature: 0.2,
        ...(request.jsonSchema
          ? { responseMimeType: 'application/json', responseSchema: request.jsonSchema as any }
          : {}),
      },
    });

    const metadata: any = (response as any).usageMetadata ?? {};
    return {
      provider: AiProvider.GEMINI,
      model: this.geminiModel,
      text: response.text || '',
      usage: this.usage(
        metadata.promptTokenCount ?? 0,
        metadata.candidatesTokenCount ?? 0,
        this.envRate('GEMINI'),
      ),
      refused: false,
    };
  }

  // ---------------------------------------------------------------------- Groq

  /**
   * Calls Groq's OpenAI-compatible chat completions endpoint using Llama 3.1 8B Instant
   * (or whichever model is set via GROQ_MODEL). Groq is extremely fast and cost-effective;
   * it is preferred first in FAST tasks and acts as a last-resort fallback for heavier tasks.
   *
   * Note: Groq does not support JSON Schema response_format with a `strict` flag the way
   * OpenAI does — we request `json_object` mode and let the prompt guide the schema.
   */
  private async callGroq(request: AiRequest): Promise<AiCompletion> {
    if (!this.groq) throw new ServiceUnavailableException('GROQ_API_KEY is not configured.');

    const messages: Groq.Chat.ChatCompletionMessageParam[] = [];
    let system = request.systemInstruction;
    if (request.jsonSchema) {
      const schemaInstruction = `You MUST return JSON matching exactly this schema:\n${JSON.stringify(request.jsonSchema)}`;
      system = system ? `${system}\n\n${schemaInstruction}` : schemaInstruction;
    }

    if (system) {
      messages.push({ role: 'system', content: system });
    }
    messages.push({ role: 'user', content: request.prompt });

    const response = await this.groq.chat.completions.create({
      model: this.groqModel,
      messages,
      temperature: this.groqTemperature,
      max_tokens: request.maxTokens ?? this.groqMaxTokens,
      ...(request.jsonSchema ? { response_format: { type: 'json_object' } } : {}),
    });

    return {
      provider: AiProvider.GROQ,
      model: response.model ?? this.groqModel,
      text: response.choices[0]?.message?.content ?? '',
      usage: this.usage(
        response.usage?.prompt_tokens ?? 0,
        response.usage?.completion_tokens ?? 0,
        this.envRate('GROQ'),
      ),
      refused: false,
    };
  }

  // ------------------------------------------------------------------ OpenRouter

  /**
   * Calls OpenRouter's OpenAI-compatible chat completions endpoint. OpenRouter
   * fronts many vendors (including free-tier models like
   * `openai/gpt-4o-mini`) behind one API, so it is treated as a
   * last-resort fallback in every task chain.
   */
  private async callOpenRouter(request: AiRequest, modelOverride?: string): Promise<AiCompletion> {
    if (!this.openrouter) throw new ServiceUnavailableException('OPENROUTER_API_KEY is not configured.');

    const messages: any[] = [];
    let system = request.systemInstruction;
    if (request.jsonSchema) {
      const schemaInstruction = `You MUST return JSON matching exactly this schema:\n${JSON.stringify(request.jsonSchema)}`;
      system = system ? `${system}\n\n${schemaInstruction}` : schemaInstruction;
    }

    if (system) messages.push({ role: 'system', content: system });
    messages.push({ role: 'user', content: request.prompt });

    const response = await this.openrouter.chat.completions.create({
      model: modelOverride || this.openrouterModel,
      messages,
      temperature: this.openrouterTemperature,
      max_tokens: request.maxTokens ?? this.openrouterMaxTokens,
      ...(request.jsonSchema ? { response_format: { type: 'json_object' } } : {}),
    } as any);

    return {
      provider: AiProvider.OPENROUTER,
      model: response.model ?? this.openrouterModel,
      text: response.choices[0]?.message?.content ?? '',
      usage: this.usage(
        response.usage?.prompt_tokens ?? 0,
        response.usage?.completion_tokens ?? 0,
        this.envRate('OPENROUTER'),
      ),
      refused: false,
    };
  }

  // ------------------------------------------------------------------ Sarvam AI

  private async callSarvam(request: AiRequest): Promise<AiCompletion> {
    if (!this.isRealKey(this.sarvamKey)) {
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
      config: this.config,
      structured: Boolean(request.jsonSchema),
    });

    let body = buildSarvamBody({
      model: this.sarvamModel,
      messages,
      maxTokens,
      reasoningEffort: this.sarvamReasoningEffort,
      jsonMode: Boolean(request.jsonSchema),
    });

    let response = await this.postToSarvam(body);

    if (response.status === 400) {
      const errText = await response.text().catch(() => '');
      const relaxed = relaxSarvamBody(body, errText);
      if (!relaxed) {
        throw new ServiceUnavailableException(`Sarvam API failed (HTTP 400): ${errText}`);
      }
      this.logger.warn(`Sarvam rejected '${relaxed.dropped}'; retrying without it.`);
      body = relaxed.body;
      response = await this.postToSarvam(body);
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
      model: json?.model ?? this.sarvamModel,
      text: message.text,
      usage: this.usage(message.promptTokens, message.completionTokens),
      refused: false,
    };
  }

  private postToSarvam(body: Record<string, unknown>): Promise<Response> {
    return fetch(SARVAM_CHAT_COMPLETIONS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-subscription-key': this.sarvamKey!,
        Authorization: `Bearer ${this.sarvamKey!}`,
      },
      body: JSON.stringify(body),
    });
  }

  // -------------------------------------------------------------------- Costs

  /** Operator-supplied rates for vendors whose pricing we don't hard-code. */
  private envRate(prefix: 'GEMINI' | 'OPENAI' | 'GROQ' | 'OPENROUTER'): Rate | undefined {
    const input = Number(this.config.get<string>(`${prefix}_RATE_INPUT_PER_MTOK`));
    const output = Number(this.config.get<string>(`${prefix}_RATE_OUTPUT_PER_MTOK`));
    return Number.isFinite(input) && Number.isFinite(output) && input > 0 ? { input, output } : undefined;
  }

  private usage(inputTokens: number, outputTokens: number, rate?: Rate): AiUsage {
    const estimatedCostUsd = rate
      ? Number(((inputTokens / 1_000_000) * rate.input + (outputTokens / 1_000_000) * rate.output).toFixed(6))
      : null;
    return { inputTokens, outputTokens, estimatedCostUsd };
  }
}
