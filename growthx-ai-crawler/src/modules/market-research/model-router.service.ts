import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

/**
 * The role a call plays, rather than the model that serves it.
 *
 * Callers name the role; only this file knows which model id it maps to. That
 * is what lets a model be swapped, or a provider changed, without touching the
 * research pipeline.
 */
export enum ModelRole {
  /** Research planning, synthesis, cited answers, recommendations. */
  ANALYST = 'ANALYST',
  /** Classification, rewriting, ranking, extraction. High volume, cheap. */
  WORKER = 'WORKER',
  /** Long multi-market reports. Only on explicit Deep Research. */
  DEEP = 'DEEP',
  /** Semantic retrieval over client-owned text. */
  EMBEDDING = 'EMBEDDING',
}

export type ResearchProvider = 'sarvam' | 'openai' | 'openrouter' | 'groq';

/**
 * Model ids per provider.
 *
 * Sarvam speaks the OpenAI Chat Completions API at its own base URL.
 * Groq and OpenRouter also speak Chat Completions. OpenAI supports both
 * Chat Completions and Responses — we use Chat Completions uniformly so
 * every provider works with the same call shape.
 */
const MODELS: Record<ResearchProvider, Record<ModelRole, string>> = {
  sarvam: {
    [ModelRole.ANALYST]: 'sarvam-105b',
    [ModelRole.WORKER]: 'sarvam-105b',
    [ModelRole.DEEP]: 'sarvam-105b',
    // Sarvam serves no embedding models. Retrieval falls back to keyword
    // matching when no OpenAI key is present alongside.
    [ModelRole.EMBEDDING]: 'text-embedding-3-small',
  },
  openai: {
    [ModelRole.ANALYST]: 'gpt-4o',
    [ModelRole.WORKER]: 'gpt-4o-mini',
    [ModelRole.DEEP]: 'gpt-4o',
    [ModelRole.EMBEDDING]: 'text-embedding-3-small',
  },
  openrouter: {
    [ModelRole.ANALYST]: 'openai/gpt-4o',
    [ModelRole.WORKER]: 'openai/gpt-4o-mini',
    [ModelRole.DEEP]: 'openai/gpt-4o',
    // OpenRouter serves no embedding models at all. Kept for completeness; the
    // capability check below is what actually decides whether it is used.
    [ModelRole.EMBEDDING]: 'text-embedding-3-small',
  },
  groq: {
    [ModelRole.ANALYST]: 'llama-3.1-70b-versatile',
    [ModelRole.WORKER]: 'llama-3.1-8b-instant',
    [ModelRole.DEEP]: 'llama-3.1-70b-versatile',
    [ModelRole.EMBEDDING]: 'text-embedding-3-small',
  },
};

const BASE_URLS: Partial<Record<ResearchProvider, string>> = {
  sarvam: 'https://api.sarvam.ai/v1',
  openrouter: 'https://openrouter.ai/api/v1',
  groq: 'https://api.groq.com/openai/v1',
};

const KEY_ENV: Record<ResearchProvider, string> = {
  sarvam: 'SARVAM_API_KEY',
  openai: 'OPENAI_API_KEY',
  openrouter: 'OPENROUTER_API_KEY',
  groq: 'GROQ_API_KEY',
};

const ENV_KEYS: Record<ModelRole, string> = {
  [ModelRole.ANALYST]: 'MARKET_RESEARCH_MODEL_ANALYST',
  [ModelRole.WORKER]: 'MARKET_RESEARCH_MODEL_WORKER',
  [ModelRole.DEEP]: 'MARKET_RESEARCH_MODEL_DEEP',
  [ModelRole.EMBEDDING]: 'MARKET_RESEARCH_MODEL_EMBEDDING',
};

export interface ModelUsage {
  step: string;
  role: ModelRole;
  model: string;
  inputTokens: number;
  outputTokens: number;
  /** Reported by OpenRouter per generation; null when the provider omits it. */
  costUsd: number | null;
}

/** A web result the model actually retrieved, not one it recalled. */
export interface RetrievedWebSource {
  url: string;
  title: string;
  excerpt?: string;
}

export interface GenerateOptions {
  step: string;
  role: ModelRole;
  instructions: string;
  input: string;
  jsonSchema?: { name: string; schema: Record<string, unknown> };
  /** Ask the provider to search the live web for this call. */
  webSearch?: boolean;
  maxOutputTokens?: number;
}

export interface GenerateResult {
  text: string;
  usage: ModelUsage;
  /** Populated when web search ran: exactly what the model was allowed to cite. */
  webSources: RetrievedWebSource[];
  /** Set when web search was requested but the provider could not run it. */
  webSearchUnavailable?: string;
}

/**
 * Every model call in Market Research goes through here.
 *
 * All providers speak the Chat Completions API, so the call shape is shared
 * and only the base URL, model namespace and authentication differ.
 */
@Injectable()
export class ModelRouterService {
  private readonly logger = new Logger(ModelRouterService.name);
  private client: OpenAI | null = null;
  /** Separate from `client`: embeddings can run on OpenAI while chat runs on Sarvam. */
  private embeddings: OpenAI | null = null;

  constructor(private readonly config: ConfigService) {}

  /**
   * Which provider serves this deployment.
   *
   * Explicit config wins. Otherwise whichever key is present is used, and
   * Sarvam is preferred when multiple keys are set because it is the primary
   * provider for this platform.
   */
  provider(): ResearchProvider {
    const configured = this.config.get<string>('MARKET_RESEARCH_PROVIDER')?.toLowerCase();
    if (configured === 'sarvam' || configured === 'openai' || configured === 'openrouter' || configured === 'groq') {
      return configured;
    }

    // Sarvam first: it is the platform's primary AI provider.
    if (this.realKey(this.config.get<string>('SARVAM_API_KEY'))) return 'sarvam';
    if (this.realKey(this.config.get<string>('GROQ_API_KEY'))) return 'groq';
    if (this.realKey(this.config.get<string>('OPENROUTER_API_KEY'))) return 'openrouter';
    return 'openai';
  }

  /** The configured id for a role, so callers record what actually ran. */
  modelFor(role: ModelRole): string {
    return this.config.get<string>(ENV_KEYS[role]) || MODELS[this.provider()][role];
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey());
  }

  /**
   * Whether semantic retrieval is possible.
   *
   * Neither Sarvam, Groq nor OpenRouter serves an embedding model, so a
   * deployment on those alone has no vector search. Retrieval falls back
   * to lexical matching rather than silently returning nothing.
   */
  supportsEmbeddings(): boolean {
    if (this.provider() === 'openai') return this.isConfigured();
    // Sarvam, Groq and OpenRouter don't serve embeddings; an OpenAI key
    // alongside them still can.
    return this.realKey(this.config.get<string>('OPENAI_API_KEY'));
  }

  /**
   * Whether this provider can search the live web.
   *
   * None of the Chat Completions providers support built-in web search.
   * The pipeline reports this honestly and falls back to client-owned data.
   */
  supportsWebSearch(): boolean {
    return false;
  }

  private realKey(value?: string | null): boolean {
    if (!value) return false;
    const trimmed = value.trim();
    // Placeholder values in .env.example would otherwise look configured.
    return trimmed.length > 20 && !/^(your_|add-your-|changeme)/i.test(trimmed);
  }

  private apiKey(): string | undefined {
    const key = this.config.get<string>(KEY_ENV[this.provider()]);
    return this.realKey(key) ? key!.trim() : undefined;
  }

  private openai(): OpenAI {
    if (!this.client) {
      const provider = this.provider();
      const apiKey = this.apiKey();
      if (!apiKey) {
        throw new ServiceUnavailableException(
          `Market research is not configured: no usable ${KEY_ENV[provider]}.`,
        );
      }

      const headers: Record<string, string> = {};

      if (provider === 'openrouter') {
        headers['HTTP-Referer'] = this.config.get<string>('OPENROUTER_SITE_URL') || 'https://growthx.ai';
        headers['X-Title'] = this.config.get<string>('OPENROUTER_SITE_NAME') || 'GrowthX AI SEO';
      }

      // Sarvam accepts both Bearer and api-subscription-key headers. The
      // OpenAI SDK sends Bearer automatically; we add the Sarvam-specific
      // header as well so either auth path works.
      if (provider === 'sarvam') {
        headers['api-subscription-key'] = apiKey;
      }

      this.client = new OpenAI({
        apiKey,
        ...(BASE_URLS[provider] ? { baseURL: BASE_URLS[provider] } : {}),
        ...(Object.keys(headers).length > 0 ? { defaultHeaders: headers } : {}),
      });
    }
    return this.client;
  }

  /**
   * Embeddings client, which may be OpenAI even when chat runs elsewhere.
   *
   * Neither Sarvam, Groq nor OpenRouter serves an embedding model, so every
   * provider except OpenAI needs a separate OpenAI client here. Falling
   * through to the chat client instead would send `text-embedding-3-small` to
   * Sarvam's or Groq's base URL, where it would fail.
   */
  private embeddingClient(): OpenAI {
    if (this.provider() === 'openai') return this.openai();

    const openaiKey = this.config.get<string>('OPENAI_API_KEY');
    if (!this.realKey(openaiKey)) {
      throw new ServiceUnavailableException(
        `No embedding model available: ${this.provider()} serves none, and OPENAI_API_KEY is not set.`,
      );
    }
    this.embeddings ??= new OpenAI({ apiKey: openaiKey!.trim() });
    return this.embeddings;
  }

  async generate(options: GenerateOptions): Promise<GenerateResult> {
    const model = this.modelFor(options.role);
    const provider = this.provider();

    // Web search is not available via Chat Completions on any provider.
    if (options.webSearch && !this.supportsWebSearch()) {
      return {
        text: '',
        webSources: [],
        webSearchUnavailable:
          `${provider} cannot search the live web via Chat Completions, so no public web sources were retrieved. ` +
          'The answer is based on this client\'s own data only.',
        usage: { step: options.step, role: options.role, model, inputTokens: 0, outputTokens: 0, costUsd: null },
      };
    }

    // Build messages for the Chat Completions API.
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];

    // System message: instructions + optional JSON schema guidance.
    let systemContent = options.instructions;
    if (options.jsonSchema) {
      systemContent +=
        '\n\nYou MUST respond with ONLY valid JSON matching this schema. ' +
        'Do NOT include markdown backticks, commentary, or surrounding prose.\n' +
        `JSON Schema:\n${JSON.stringify(options.jsonSchema.schema, null, 2)}`;
    }
    messages.push({ role: 'system', content: systemContent });
    messages.push({ role: 'user', content: options.input });

    const request: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming = {
      model,
      messages,
      max_tokens: options.maxOutputTokens ?? 4000,
      temperature: 0.2,
    };

    // Use response_format for providers that support it. Sarvam uses prompt
    // engineering only — enforcing json_object on a model that does not
    // recognise it would cause a 400.
    if (options.jsonSchema && provider !== 'sarvam') {
      request.response_format = { type: 'json_object' };
    }

    let response: OpenAI.Chat.Completions.ChatCompletion;
    try {
      response = await this.openai().chat.completions.create(request);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Model call failed (${options.step}, ${model}): ${message}`);
      throw new ServiceUnavailableException(
        `The research model could not be reached (${options.step}). ${message}`,
      );
    }

    const text = response.choices?.[0]?.message?.content?.trim() ?? '';

    // A response with no content means the model could not produce an answer.
    if (!text && response.choices?.[0]?.finish_reason === 'length') {
      throw new ServiceUnavailableException(
        `The model ran out of output budget before answering (${options.step}). Raise max_output_tokens or use a stronger model.`,
      );
    }

    return {
      text,
      webSources: [],
      usage: {
        step: options.step,
        role: options.role,
        model,
        inputTokens: response.usage?.prompt_tokens ?? 0,
        outputTokens: response.usage?.completion_tokens ?? 0,
        costUsd: null,
      },
    };
  }

  async embed(texts: string[]): Promise<{ vectors: number[][]; model: string }> {
    const model = this.modelFor(ModelRole.EMBEDDING);
    if (texts.length === 0) return { vectors: [], model };

    try {
      const response = await this.embeddingClient().embeddings.create({ model, input: texts });
      return { vectors: response.data.map((d) => d.embedding as number[]), model };
    } catch (error) {
      // Raw SDK errors surface as a 500 with no explanation. Callers that can
      // degrade — retrieval falls back to keyword search — need to recognise
      // this, and callers that cannot need to say what went wrong.
      if (error instanceof ServiceUnavailableException) throw error;
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Embedding call failed (${model}): ${message}`);
      throw new ServiceUnavailableException(`The embedding model could not be reached. ${message}`);
    }
  }
}
