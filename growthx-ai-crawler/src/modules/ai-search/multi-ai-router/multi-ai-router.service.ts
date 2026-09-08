import { Injectable, Logger, Optional, ServiceUnavailableException } from '@nestjs/common';
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
import { extractAndParseJson } from '../../ai-engine/utils/json-extractor.util';
import { AiUsageService } from './ai-usage.service';
import {
  MammouthCapability,
  MAMMOUTH_MODELS,
  resolveMammouthModelForCapability,
} from './mammouth-models.config';

export enum AiProvider {
  MAMMOUTH = 'MAMMOUTH',
  SARVAM = 'SARVAM',
  GEMINI = 'GEMINI',
  OPENAI = 'OPENAI',
  ANTHROPIC = 'ANTHROPIC',
  GROQ = 'GROQ',
  OPENROUTER = 'OPENROUTER',
}

/**
 * How a task is routed, independent of which vendor ends up serving it.
 *
 * Three profiles rather than one per task on purpose: the vendor preference
 * order genuinely only has three shapes, and a table with one row per task
 * drifts out of agreement with itself the first time a vendor is added.
 */
export enum RoutingProfile {
  /** Deep SEO reasoning, strategy, competitive analysis. */
  REASONING = 'REASONING',
  /** Generating code patches for the autonomous engineer. */
  CODE_GEN = 'CODE_GEN',
  /** Cheap, high-volume extraction and classification. */
  FAST = 'FAST',
}

/**
 * What the caller wants done. Named for the product surface that asks, not the
 * model that answers, so the spend ledger reads as "what did the fix engine
 * cost us" rather than "what did REASONING cost us".
 *
 * The first three values are the original routing profiles, kept as task names
 * so existing callers keep working unchanged.
 */
export enum AiTask {
  REASONING = 'REASONING',
  CODE_GEN = 'CODE_GEN',
  FAST = 'FAST',

  SEO_RESEARCH = 'SEO_RESEARCH',
  SEO_ANALYSIS = 'SEO_ANALYSIS',
  COMPETITOR_ANALYSIS = 'COMPETITOR_ANALYSIS',
  AI_VISIBILITY_ANALYSIS = 'AI_VISIBILITY_ANALYSIS',
  PAGE_COMPARISON = 'PAGE_COMPARISON',
  CONTENT_STRUCTURE_ANALYSIS = 'CONTENT_STRUCTURE_ANALYSIS',
  ENTITY_ANALYSIS = 'ENTITY_ANALYSIS',
  SEO_OPPORTUNITY_GENERATION = 'SEO_OPPORTUNITY_GENERATION',
  CODE_GENERATION = 'CODE_GENERATION',
  CODE_REVIEW = 'CODE_REVIEW',
  FIX_VALIDATION = 'FIX_VALIDATION',
  LOCAL_SEO_ANALYSIS = 'LOCAL_SEO_ANALYSIS',
  REVIEW_RESPONSE_DRAFT = 'REVIEW_RESPONSE_DRAFT',
  SUMMARY_GENERATION = 'SUMMARY_GENERATION',
}

/**
 * Which routing profile each task uses.
 *
 * The judgement encoded here: anything that reads a page and decides what is
 * wrong with it reasons; anything that writes or checks code needs the code
 * profile; anything run hundreds of times per client per week is priced first
 * and reasoned second, because at 300 prompts x 5 engines x weekly the cheap
 * model is the difference between a viable gross margin and a services
 * business.
 */
const TASK_PROFILE: Readonly<Record<AiTask, RoutingProfile>> = {
  [AiTask.REASONING]: RoutingProfile.REASONING,
  [AiTask.CODE_GEN]: RoutingProfile.CODE_GEN,
  [AiTask.FAST]: RoutingProfile.FAST,

  [AiTask.SEO_RESEARCH]: RoutingProfile.REASONING,
  [AiTask.SEO_ANALYSIS]: RoutingProfile.REASONING,
  [AiTask.COMPETITOR_ANALYSIS]: RoutingProfile.REASONING,
  [AiTask.AI_VISIBILITY_ANALYSIS]: RoutingProfile.REASONING,
  [AiTask.PAGE_COMPARISON]: RoutingProfile.REASONING,
  [AiTask.SEO_OPPORTUNITY_GENERATION]: RoutingProfile.REASONING,

  [AiTask.CODE_GENERATION]: RoutingProfile.CODE_GEN,
  [AiTask.CODE_REVIEW]: RoutingProfile.CODE_GEN,
  [AiTask.FIX_VALIDATION]: RoutingProfile.CODE_GEN,

  [AiTask.CONTENT_STRUCTURE_ANALYSIS]: RoutingProfile.FAST,
  [AiTask.ENTITY_ANALYSIS]: RoutingProfile.FAST,
  [AiTask.LOCAL_SEO_ANALYSIS]: RoutingProfile.FAST,
  [AiTask.REVIEW_RESPONSE_DRAFT]: RoutingProfile.FAST,
  [AiTask.SUMMARY_GENERATION]: RoutingProfile.FAST,
};

export interface AiRequest {
  prompt: string;
  systemInstruction?: string;
  task?: AiTask;
  /** Force a specific vendor. Denied with 403 if the plan does not include it. */
  provider?: AiProvider;
  /** When present, the organization's plan decides which vendors are reachable. */
  organizationId?: string;
  /** Attribution only — spend is reported per project as well as per org. */
  projectId?: string;
  /**
   * Set false when the caller's configuration forbids switching vendors. The
   * first provider is then the only one tried, and its failure is the answer:
   * a customer who pinned a vendor for a compliance reason must not be quietly
   * served by a different one.
   */
  allowFallback?: boolean;
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

/** Which vendor each routing profile prefers, best first. */
const TASK_PREFERENCE: Readonly<Record<RoutingProfile, readonly AiProvider[]>> = {
  [RoutingProfile.REASONING]: [AiProvider.MAMMOUTH, AiProvider.ANTHROPIC, AiProvider.GEMINI, AiProvider.OPENAI, AiProvider.SARVAM, AiProvider.GROQ, AiProvider.OPENROUTER],
  [RoutingProfile.CODE_GEN]: [AiProvider.MAMMOUTH, AiProvider.ANTHROPIC, AiProvider.OPENAI, AiProvider.GEMINI, AiProvider.SARVAM, AiProvider.GROQ, AiProvider.OPENROUTER],
  [RoutingProfile.FAST]: [AiProvider.MAMMOUTH, AiProvider.SARVAM, AiProvider.GROQ, AiProvider.GEMINI, AiProvider.OPENAI, AiProvider.ANTHROPIC, AiProvider.OPENROUTER],
};

/** The routing profile a task uses. Unknown values reason rather than guess cheap. */
export function profileFor(task: AiTask): RoutingProfile {
  return TASK_PROFILE[task] ?? RoutingProfile.REASONING;
}

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
  private readonly mammouthModel: string;
  private readonly mammouthBaseUrl: string;
  private readonly mammouthTemperature: number;
  private readonly mammouthMaxTokens: number;

  private anthropic?: Anthropic;
  private openai?: OpenAI;
  private gemini?: GoogleGenAI;
  private groq?: Groq;
  private openrouter?: OpenAI;
  private mammouth?: OpenAI;

  /**
   * Anthropic's server-side refusal fallback re-serves a declined request on
   * another model inside the same call. It is behind a beta flag, so a
   * rejection here degrades to a plain call rather than failing the request.
   */
  private serverSideFallbackEnabled: boolean;

  constructor(
    private readonly config: ConfigService,
    /**
     * Optional so the router can still be constructed standalone (and in
     * tests) without a database. When absent, calls run normally and simply
     * go unrecorded.
     */
    @Optional() private readonly usageLedger?: AiUsageService,
  ) {
    this.anthropicModel = this.config.get<string>('ANTHROPIC_MODEL') || 'claude-opus-5';
    this.geminiModel = this.config.get<string>('GEMINI_MODEL') || 'gemini-2.5-pro';
    this.openaiModel = this.config.get<string>('OPENAI_MODEL') || 'gpt-4o';
    this.groqModel = this.config.get<string>('GROQ_MODEL') || 'llama-3.1-8b-instant';
    this.groqTemperature = Number(this.config.get<string>('GROQ_TEMPERATURE') ?? '0.2');
    this.groqMaxTokens = Number(this.config.get<string>('GROQ_MAX_TOKENS') ?? '2000');
    this.openrouterModel = this.config.get<string>('OPENROUTER_MODEL') || 'openai/gpt-4o-mini';
    this.openrouterTemperature = Number(this.config.get<string>('OPENROUTER_TEMPERATURE') ?? '0.2');
    this.openrouterMaxTokens = Number(this.config.get<string>('OPENROUTER_MAX_TOKENS') ?? '2000');
    this.mammouthModel = this.config.get<string>('MAMMOUTH_DEFAULT_MODEL') || 'mammouth-recommended';
    this.mammouthBaseUrl = this.config.get<string>('MAMMOUTH_BASE_URL') || 'https://api.mammouth.ai/v1';
    this.mammouthTemperature = Number(this.config.get<string>('MAMMOUTH_TEMPERATURE') ?? '0.2');
    this.mammouthMaxTokens = Number(this.config.get<string>('MAMMOUTH_MAX_TOKENS') ?? '4000');
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

    const rawMammouthKey = this.config.get<string>('MAMMOUTH_API_KEY');
    const mammouthKey = rawMammouthKey ? rawMammouthKey.trim().replace(/\.+$/, '') : undefined;
    if (this.isRealKey(mammouthKey)) {
      this.mammouth = new OpenAI({
        apiKey: mammouthKey,
        baseURL: this.mammouthBaseUrl,
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
    if (this.mammouth) configured.push(AiProvider.MAMMOUTH);
    if (this.isRealKey(this.sarvamKey)) configured.push(AiProvider.SARVAM);
    if (this.gemini) configured.push(AiProvider.GEMINI);
    if (this.openai) configured.push(AiProvider.OPENAI);
    if (this.anthropic) configured.push(AiProvider.ANTHROPIC);
    if (this.groq) configured.push(AiProvider.GROQ);
    if (this.openrouter) configured.push(AiProvider.OPENROUTER);
    return configured;
  }

  /**
   * The providers a task will actually try, best first.
   *
   * Empty means the call cannot run at all — the single most useful thing to
   * know when a generated feature comes back blank, and previously only
   * visible by reading the service's own logs.
   */
  chainFor(task: AiTask): AiProvider[] {
    const allowed = this.configuredProviders();
    return TASK_PREFERENCE[profileFor(task)].filter((p) => allowed.includes(p));
  }

  /** The model each configured provider would use. Names only — never key material. */
  configuredModels(): Record<string, string> {
    const models: Record<string, string> = {
      [AiProvider.MAMMOUTH]: this.mammouthModel,
      [AiProvider.ANTHROPIC]: this.anthropicModel,
      [AiProvider.GEMINI]: this.geminiModel,
      [AiProvider.OPENAI]: this.openaiModel,
      [AiProvider.SARVAM]: this.sarvamModel,
      [AiProvider.GROQ]: this.groqModel,
      [AiProvider.OPENROUTER]: this.openrouterModel,
    };

    const configured = this.configuredProviders();
    return Object.fromEntries(configured.map((p) => [p, models[p]]));
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

    // Checked before the call, not after: a ceiling that only reports overspend
    // is a report, not a ceiling.
    await this.usageLedger?.assertWithinBudget(request.organizationId);

    const targetProvider = request.provider;

    if (targetProvider) {
      if (!allowed.includes(targetProvider)) {
         throw new ServiceUnavailableException(`${targetProvider} is not configured.`);
      }
      return this.invokeAndRecord(targetProvider, request, task);
    }

    const chain = this.chainFor(task);
    if (chain.length === 0) {
      throw new ServiceUnavailableException(
        // Was "check plan entitlements", which pointed at a billing system
        // that no longer exists and sent whoever read it looking for a
        // subscription setting. The only cause now is missing or placeholder
        // API keys.
        'No AI provider is configured. Set at least one provider API key (Anthropic, OpenAI, Gemini or Sarvam).',
      );
    }

    // A caller that forbids vendor switching gets the head of the chain only.
    const attempts = request.allowFallback === false ? chain.slice(0, 1) : chain;

    let lastError: unknown;
    for (const provider of attempts) {
      try {
        const completion = await this.invokeAndRecord(provider, request, task);
        if (completion.refused && attempts.length > 1) {
          this.logger.warn(`${provider} declined the request; trying the next provider.`);
          lastError = new Error(`${provider} declined the request.`);
          continue;
        }

        // Output that will not parse is a failed attempt, not an answer.
        // Only Anthropic, Gemini and OpenAI are *given* the schema to enforce;
        // Sarvam, Groq and OpenRouter are merely asked for JSON in the system
        // text, so any of them can answer in prose or stop mid-document. The
        // caller parses after this returns, so the first provider in the chain
        // doing that used to fail the whole request while the providers behind
        // it — which might have answered perfectly well — were never tried.
        if (request.jsonSchema && !this.parsesAsJson(completion.text)) {
          this.logger.warn(`${provider} returned output that is not valid JSON; trying the next provider.`);
          lastError = new Error(`${provider} returned unparseable JSON.`);
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

  /**
   * Whether the caller will be able to read this answer.
   *
   * Uses the same extractor the call sites use — including its repair of a
   * truncated document — so a completion accepted here cannot fail to parse
   * one layer up.
   */
  private parsesAsJson(text: string): boolean {
    if (!text?.trim()) return false;
    try {
      extractAndParseJson(text);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * `invoke` plus the ledger entry.
   *
   * Records failures as well as successes: a request that sent input tokens and
   * then errored still cost money, and a ledger holding only the calls that
   * worked understates the bill. Token counts are unknown on the error path, so
   * they are written as zero with no cost rather than estimated.
   */
  private async invokeAndRecord(
    provider: AiProvider,
    request: AiRequest,
    task: AiTask,
  ): Promise<AiCompletion> {
    const startedAt = Date.now();
    try {
      const completion = await this.invoke(provider, request, task);
      this.usageLedger?.record({
        organizationId: request.organizationId,
        projectId: request.projectId,
        taskType: task,
        provider: completion.provider,
        model: completion.model,
        inputTokens: completion.usage.inputTokens,
        outputTokens: completion.usage.outputTokens,
        estimatedCostUsd: completion.usage.estimatedCostUsd,
        latencyMs: Date.now() - startedAt,
        status: completion.refused ? 'REFUSED' : 'OK',
      });
      return completion;
    } catch (error) {
      this.usageLedger?.record({
        organizationId: request.organizationId,
        projectId: request.projectId,
        taskType: task,
        provider,
        model: this.configuredModels()[provider] ?? 'unknown',
        inputTokens: 0,
        outputTokens: 0,
        estimatedCostUsd: null,
        latencyMs: Date.now() - startedAt,
        status: 'ERROR',
        error: (error as Error)?.message ?? 'unknown',
      });
      throw error;
    }
  }

  /** Vendors the org's plan permits, intersected with what has credentials. */
  private invoke(provider: AiProvider, request: AiRequest, task: AiTask, modelOverride?: string): Promise<AiCompletion> {
    switch (provider) {
      case AiProvider.MAMMOUTH:
        return this.callMammouth(request, task, modelOverride);
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
              json_schema: { name: 'growthx_response', schema: request.jsonSchema, strict: false },
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
      // Sarvam publishes no rate we can hard-code, so cost is only known when
      // the operator supplies one. This matters more than it looks: an install
      // running entirely on Sarvam otherwise records every call at no cost, the
      // ledger reports zero spend, and the organization's monthly budget can
      // never fire. Set SARVAM_RATE_INPUT_PER_MTOK / SARVAM_RATE_OUTPUT_PER_MTOK
      // to make the ceiling real.
      usage: this.usage(message.promptTokens, message.completionTokens, this.envRate('SARVAM')),
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

  // ------------------------------------------------------------------ Mammouth
  /**
   * Calls Mammouth AI's OpenAI-compatible API (https://api.mammouth.ai/v1).
   * Automatically resolves the model based on task capability requirements
   * unless explicitly overridden. Enforces JSON output and tracks tokens/cost.
   */
  private async callMammouth(request: AiRequest, task: AiTask, modelOverride?: string): Promise<AiCompletion> {
    if (!this.mammouth) {
      throw new ServiceUnavailableException('MAMMOUTH_API_KEY is not configured.');
    }

    const capability = this.taskToCapability(task);
    const chosenModel = modelOverride || resolveMammouthModelForCapability(capability, {
      userSelectedModel: this.mammouthModel,
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
      const response = await this.mammouth.chat.completions.create({
        model: chosenModel,
        messages,
        temperature: this.mammouthTemperature,
        max_tokens: request.maxTokens ?? this.mammouthMaxTokens,
        ...(request.jsonSchema ? { response_format: { type: 'json_object' } } : {}),
      } as any);

      const content = response.choices?.[0]?.message?.content ?? '';

      return {
        provider: AiProvider.MAMMOUTH,
        model: response.model ?? chosenModel,
        text: content,
        usage: this.usage(
          response.usage?.prompt_tokens ?? 0,
          response.usage?.completion_tokens ?? 0,
          this.envRate('MAMMOUTH'),
        ),
        refused: false,
      };
    } catch (error: any) {
      const status = error?.status || error?.statusCode;
      const message = String(error?.message || error || 'Unknown Mammouth error');

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

  private taskToCapability(task: AiTask): MammouthCapability {
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

  // -------------------------------------------------------------------- Costs

  /** Operator-supplied rates for vendors whose pricing we don't hard-code. */
  private envRate(prefix: 'GEMINI' | 'OPENAI' | 'GROQ' | 'OPENROUTER' | 'SARVAM' | 'MAMMOUTH'): Rate | undefined {
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
