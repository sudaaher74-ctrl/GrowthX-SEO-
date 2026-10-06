import { Injectable, Logger, Optional, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenAI } from '@google/genai';
import { OpenAI } from 'openai';
import Groq from 'groq-sdk';
import {
  SarvamReasoningEffort,
  resolveSarvamModel,
  resolveSarvamReasoningEffort,
} from '../../ai-engine/utils/sarvam-request.util';
import { isProviderAllowed, readProviderAllowlist } from '../../ai-engine/utils/ai-provider-allowlist.util';
import { extractAndParseJson } from '../../ai-engine/utils/json-extractor.util';
import { configuredValue, isConfiguredValue } from '../../../config/optional-env';
import { AiUsageService } from './ai-usage.service';
import { TokensService } from '../../tokens/tokens.service';
import { MammouthCapability } from './mammouth-models.config';
import {
  AiProvider,
  RoutingProfile,
  AiTask,
  TASK_PROFILE,
  AiRequest,
  AiUsage,
  AiCompletion,
  Rate,
  ANTHROPIC_RATES,
  TASK_PREFERENCE,
  profileFor,
} from './multi-ai-router.types';
import { executeMammouthCall, redactMammouthKey, taskToCapability } from './mammouth-invoker.util';
import { executeSarvamCall, postToSarvam } from './sarvam-invoker.util';
import { executeAnthropicCall, anthropicWithFallback } from './anthropic-invoker.util';
import { redactSecretsForAi } from '../../security/ai-sanitizer.util';

// Re-export all types, enums and utilities so callers and declaration files remain 100% compatible
export {
  AiProvider,
  RoutingProfile,
  AiTask,
  TASK_PROFILE,
  AiRequest,
  AiUsage,
  AiCompletion,
  Rate,
  ANTHROPIC_RATES,
  TASK_PREFERENCE,
  profileFor,
};

@Injectable()
export class MultiAiRouterService {
  private readonly logger = new Logger(MultiAiRouterService.name);

  private readonly anthropicModel: string;
  private readonly geminiModel: string;
  private readonly openaiModel: string;
  private readonly perplexityModel: string;
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
  private mammouthKey?: string;
  private readonly mammouthTemperature: number;
  private readonly mammouthMaxTokens: number;

  private anthropic?: Anthropic;
  private openai?: OpenAI;
  private gemini?: GoogleGenAI;
  private groq?: Groq;
  private perplexity?: OpenAI;
  private openrouter?: OpenAI;
  private mammouth?: OpenAI;

  /**
   * Anthropic's server-side refusal fallback re-serves a declined request on
   * another model inside the same call. It is behind a beta flag, so a
   * rejection here degrades to a plain call rather than failing the request.
   */
  private serverSideFallbackEnabled: boolean;

  /** `AI_PROVIDERS`: vendors outside it are never called, key or no key. */
  private readonly providerAllowlist: ReadonlySet<string> | null;

  constructor(
    private readonly config: ConfigService,
    /**
     * Optional so the router can still be constructed standalone (and in
     * tests) without a database. When absent, calls run normally and simply
     * go unrecorded.
     */
    @Optional() private readonly usageLedger?: AiUsageService,
    /**
     * Optional for the same reason. When absent, calls are not charged to a
     * wallet — so AiSearchModule must import TokensModule (tested in
     * ai-search.module.spec.ts), or enforcement would silently not exist.
     */
    @Optional() private readonly tokens?: TokensService,
  ) {
    this.anthropicModel = this.config.get<string>('ANTHROPIC_MODEL') || 'claude-opus-5';
    this.geminiModel = this.config.get<string>('GEMINI_MODEL') || 'gemini-2.5-pro';
    this.openaiModel = this.config.get<string>('OPENAI_MODEL') || 'gpt-4o';
    this.perplexityModel = this.config.get<string>('PERPLEXITY_MODEL') || 'sonar';
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
    this.providerAllowlist = readProviderAllowlist(this.config);

    const anthropicKey = this.config.get<string>('ANTHROPIC_API_KEY');
    if (this.isRealKey(anthropicKey)) this.anthropic = new Anthropic({ apiKey: anthropicKey });

    const openaiKey = configuredValue(this.config.get<string>('OPENAI_API_KEY'));
    if (openaiKey) this.openai = new OpenAI({ apiKey: openaiKey });

    const geminiKey = this.config.get<string>('GEMINI_API_KEY');
    if (this.isRealKey(geminiKey)) this.gemini = new GoogleGenAI({ apiKey: geminiKey });

    // Perplexity's API is OpenAI-compatible.
    const perplexityKey = configuredValue(this.config.get<string>('PERPLEXITY_API_KEY'));
    if (perplexityKey) this.perplexity = new OpenAI({ apiKey: perplexityKey, baseURL: 'https://api.perplexity.ai' });

    const groqKey = this.config.get<string>('GROQ_API_KEY');
    if (this.isRealKey(groqKey)) this.groq = new Groq({ apiKey: groqKey });

    const openrouterKey = configuredValue(this.config.get<string>('OPENROUTER_API_KEY'));
    if (openrouterKey) {
      this.openrouter = new OpenAI({
        apiKey: openrouterKey,
        baseURL: 'https://openrouter.ai/api/v1',
        defaultHeaders: {
          'HTTP-Referer': this.config.get<string>('OPENROUTER_SITE_URL') || 'https://growthx.ai',
          'X-Title': this.config.get<string>('OPENROUTER_SITE_NAME') || 'Reigel AI SEO',
        },
      });
    }

    const rawMammouthKey = this.config.get<string>('MAMMOUTH_API_KEY');
    const mammouthKey = rawMammouthKey ? rawMammouthKey.trim().replace(/\.+$/, '') : undefined;
    if (this.isRealKey(mammouthKey)) {
      this.mammouthKey = mammouthKey;
      this.mammouth = new OpenAI({
        apiKey: mammouthKey,
        baseURL: this.mammouthBaseUrl,
      });
    }

    this.logger.log(`AI providers configured: ${this.configuredProviders().join(', ') || 'none'}`);
  }

  /** Placeholder values from .env.example must not count as configured. */
  private isRealKey(value?: string): value is string {
    return isConfiguredValue(value);
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
    if (this.perplexity) configured.push(AiProvider.PERPLEXITY);
    return configured.filter((p) => isProviderAllowed(this.providerAllowlist, p));
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
      [AiProvider.PERPLEXITY]: this.perplexityModel,
    };

    const configured = this.configuredProviders();
    return Object.fromEntries(configured.map((p) => [p, models[p]]));
  }

  /**
   * Runs a prompt against the best vendor the caller's plan allows, for an
   * organization that still has the tokens to pay for it.
   *
   * Three steps, in this order:
   *  1. Refuse before spending anything: over the spend budget or the daily
   *     ceiling, or out of tokens. A ceiling that only reports overspend is a
   *     report, not a ceiling.
   *  2. Route the call (see `route`).
   *  3. Charge the organization for the answer it is getting — and only that
   *     one. A vendor that errored, declined, or answered with unparseable
   *     JSON before another vendor succeeded is the platform's cost, not the
   *     customer's.
   */
  async generate(request: AiRequest): Promise<AiCompletion> {
    const task = request.task ?? AiTask.REASONING;
    const sanitizedPrompt = request.prompt ? redactSecretsForAi(request.prompt) : request.prompt;
    const sanitizedSystemInstruction = request.systemInstruction
      ? redactSecretsForAi(request.systemInstruction)
      : request.systemInstruction;
    const sanitizedRequest: AiRequest = {
      ...request,
      prompt: sanitizedPrompt,
      systemInstruction: sanitizedSystemInstruction,
    };
    const scoped = await this.attributed(sanitizedRequest);

    await this.usageLedger?.assertWithinBudget(scoped.organizationId);
    await this.tokens?.assertCanStart(scoped.organizationId);

    const completion = await this.route(scoped, task);

    if (this.tokens && !completion.refused) {
      // Settling never throws by contract, and is caught anyway: the answer
      // exists and the vendor has billed us for it, so a bookkeeping failure
      // here must not stop it reaching the customer.
      await this.tokens
        .settleAiUsage({
          organizationId: scoped.organizationId,
          projectId: scoped.projectId,
          taskType: task,
          provider: completion.provider,
          model: completion.model,
          inputTokens: completion.usage.inputTokens,
          outputTokens: completion.usage.outputTokens,
          promptChars: scoped.prompt.length + (scoped.systemInstruction?.length ?? 0),
          responseChars: completion.text.length,
        })
        .catch((error: unknown) => {
          this.logger.error(`Could not charge tokens for a completed AI call: ${(error as Error)?.message}`);
        });
    }
    return completion;
  }

  /**
   * Fills in the organization for a caller that knows only the project.
   *
   * Several callers pass `projectId` alone, so their calls had no organization:
   * no budget applied to them, and they sat in the spend ledger unattributed.
   * Resolved once here so everything downstream — budget, tokens, the ledger —
   * sees the same organization.
   */
  private async attributed(request: AiRequest): Promise<AiRequest> {
    if (request.organizationId || !request.projectId || !this.tokens) return request;
    try {
      const organizationId = await this.tokens.resolveOrganization({ projectId: request.projectId });
      return organizationId ? { ...request, organizationId } : request;
    } catch (error) {
      this.logger.warn(`Could not find the organization for project ${request.projectId}: ${(error as Error)?.message}`);
      return request;
    }
  }

  /**
   * Selection order: an explicitly requested provider (403 if not in plan) →
   * the task's preference list, filtered to what the plan allows and what has
   * credentials. If the chosen vendor errors or its safety classifiers decline,
   * the next allowed vendor is tried.
   */
  private async route(request: AiRequest, task: AiTask): Promise<AiCompletion> {
    const allowed = this.configuredProviders();

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
      case AiProvider.PERPLEXITY:
        return this.callPerplexity(request);
    }
  }

  // ---------------------------------------------------------------- Anthropic

  private async callAnthropic(request: AiRequest, task: AiTask): Promise<AiCompletion> {
    return executeAnthropicCall({
      anthropic: this.anthropic,
      anthropicModel: this.anthropicModel,
      serverSideFallbackEnabled: this.serverSideFallbackEnabled,
      request,
      task,
      logger: this.logger,
      onDisableServerSideFallback: () => {
        this.serverSideFallbackEnabled = false;
      },
      usageFn: (input, output, rate) => this.usage(input, output, rate),
    });
  }

  private async anthropicWithFallback(body: Record<string, any>) {
    return anthropicWithFallback(
      this.anthropic!,
      body,
      this.logger,
      () => {
        this.serverSideFallbackEnabled = false;
      },
    );
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

  // ------------------------------------------------------------------ Perplexity

  /**
   * Perplexity answers from a live web search and returns the pages it used as
   * `citations`. Those URLs are appended to the answer as a "Sources" list,
   * because being one of the sources is exactly what a citation check for a
   * search-grounded assistant has to see.
   */
  private async callPerplexity(request: AiRequest): Promise<AiCompletion> {
    if (!this.perplexity) throw new ServiceUnavailableException('PERPLEXITY_API_KEY is not configured.');

    const messages: { role: 'system' | 'user'; content: string }[] = [];
    if (request.systemInstruction) messages.push({ role: 'system', content: request.systemInstruction });
    messages.push({ role: 'user', content: request.prompt });

    const response = await this.perplexity.chat.completions.create({
      model: this.perplexityModel,
      messages,
      ...(request.maxTokens ? { max_tokens: request.maxTokens } : {}),
    });

    const citations = (response as unknown as { citations?: unknown }).citations;
    const sources = Array.isArray(citations) ? citations.filter((c): c is string => typeof c === 'string') : [];
    const answer = response.choices[0]?.message?.content ?? '';

    return {
      provider: AiProvider.PERPLEXITY,
      model: response.model ?? this.perplexityModel,
      text: sources.length > 0 ? `${answer}\n\nSources:\n${sources.map((u) => `- ${u}`).join('\n')}` : answer,
      usage: this.usage(response.usage?.prompt_tokens ?? 0, response.usage?.completion_tokens ?? 0, this.envRate('PERPLEXITY')),
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
    return executeSarvamCall({
      sarvamKey: this.sarvamKey,
      sarvamModel: this.sarvamModel,
      sarvamReasoningEffort: this.sarvamReasoningEffort,
      config: this.config,
      request,
      rate: this.envRate('SARVAM'),
      logger: this.logger,
      usageFn: (input, output, rate) => this.usage(input, output, rate),
    });
  }

  private postToSarvam(body: Record<string, unknown>): Promise<Response> {
    return postToSarvam(this.sarvamKey!, body);
  }

  // ------------------------------------------------------------------ Mammouth

  private async callMammouth(request: AiRequest, task: AiTask, modelOverride?: string): Promise<AiCompletion> {
    return executeMammouthCall({
      mammouth: this.mammouth,
      mammouthKey: this.mammouthKey,
      defaultModel: this.mammouthModel,
      temperature: this.mammouthTemperature,
      maxTokens: this.mammouthMaxTokens,
      request,
      task,
      modelOverride,
      rate: this.envRate('MAMMOUTH'),
      usageFn: (input, output, rate) => this.usage(input, output, rate),
    });
  }

  private redactMammouthKey(message: string): string {
    return redactMammouthKey(message, this.mammouthKey);
  }

  private taskToCapability(task: AiTask): MammouthCapability {
    return taskToCapability(task);
  }

  // -------------------------------------------------------------------- Costs

  /** Operator-supplied rates for vendors whose pricing we don't hard-code. */
  private envRate(prefix: 'GEMINI' | 'OPENAI' | 'GROQ' | 'OPENROUTER' | 'SARVAM' | 'MAMMOUTH' | 'PERPLEXITY'): Rate | undefined {
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
