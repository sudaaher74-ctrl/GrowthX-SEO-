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

export type ResearchProvider = 'openai' | 'openrouter' | 'groq';

/**
 * Model ids per provider.
 *
 * Both reach the same OpenAI models; OpenRouter namespaces them under the
 * vendor. Verified against OpenRouter's live model list — the ids exist there
 * only with the `openai/` prefix, and a bare id 404s.
 */
const MODELS: Record<ResearchProvider, Record<ModelRole, string>> = {
  openai: {
    [ModelRole.ANALYST]: 'gpt-5.6-terra',
    [ModelRole.WORKER]: 'gpt-5.6-luna',
    [ModelRole.DEEP]: 'gpt-5.6-sol',
    [ModelRole.EMBEDDING]: 'text-embedding-3-small',
  },
  openrouter: {
    [ModelRole.ANALYST]: 'openai/gpt-5.6-terra',
    [ModelRole.WORKER]: 'openai/gpt-5.6-luna',
    [ModelRole.DEEP]: 'openai/gpt-5.6-sol',
    // OpenRouter serves no embedding models at all. Kept for completeness; the
    // capability check below is what actually decides whether it is used.
    [ModelRole.EMBEDDING]: 'text-embedding-3-small',
  },
  // Groq speaks the same Responses API, including json_schema — verified live.
  // Its free tier makes this the provider that works without prepaid credit.
  groq: {
    [ModelRole.ANALYST]: 'openai/gpt-oss-120b',
    [ModelRole.WORKER]: 'openai/gpt-oss-20b',
    [ModelRole.DEEP]: 'openai/gpt-oss-120b',
    [ModelRole.EMBEDDING]: 'text-embedding-3-small',
  },
};

const BASE_URLS: Partial<Record<ResearchProvider, string>> = {
  openrouter: 'https://openrouter.ai/api/v1',
  groq: 'https://api.groq.com/openai/v1',
};

const KEY_ENV: Record<ResearchProvider, string> = {
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
 * Both providers speak the Responses API — verified live against OpenRouter,
 * which accepts `/responses` including `text.format.json_schema` — so the call
 * shape is shared and only the base URL, model namespace and web-search
 * mechanism differ.
 */
@Injectable()
export class ModelRouterService {
  private readonly logger = new Logger(ModelRouterService.name);
  private client: OpenAI | null = null;
  /** Separate from `client`: embeddings can run on OpenAI while chat runs on Groq. */
  private embeddings: OpenAI | null = null;

  constructor(private readonly config: ConfigService) {}

  /**
   * Which provider serves this deployment.
   *
   * Explicit config wins. Otherwise whichever key is present is used, and
   * OpenRouter is preferred when both are set because it is the one that can
   * reach the specified models on a single key.
   */
  provider(): ResearchProvider {
    const configured = this.config.get<string>('MARKET_RESEARCH_PROVIDER')?.toLowerCase();
    if (configured === 'openai' || configured === 'openrouter' || configured === 'groq') {
      return configured;
    }

    // Groq first: its free tier actually serves requests, where OpenRouter
    // returns 402 until credit is purchased. Explicit config always wins.
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
   * OpenRouter exposes no embedding models, so a deployment on OpenRouter alone
   * has no vector search. Retrieval falls back to lexical matching rather than
   * silently returning nothing.
   */
  supportsEmbeddings(): boolean {
    if (this.provider() === 'openai') return this.isConfigured();
    // Neither Groq nor OpenRouter serves embeddings; an OpenAI key alongside
    // them still can.
    return this.realKey(this.config.get<string>('OPENAI_API_KEY'));
  }

  /**
   * Whether this provider can search the live web.
   *
   * Only OpenAI (hosted tool) and OpenRouter (paid plugin) can. Groq cannot, so
   * a Groq deployment answers from client-owned evidence and says as much.
   */
  supportsWebSearch(): boolean {
    return this.provider() !== 'groq';
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
      this.client = new OpenAI({
        apiKey,
        ...(BASE_URLS[provider] ? { baseURL: BASE_URLS[provider] } : {}),
        ...(provider === 'openrouter'
          ? {
              defaultHeaders: {
                'HTTP-Referer': this.config.get<string>('OPENROUTER_SITE_URL') || 'https://growthx.ai',
                'X-Title': this.config.get<string>('OPENROUTER_SITE_NAME') || 'GrowthX AI SEO',
              },
            }
          : {}),
      });
    }
    return this.client;
  }

  /**
   * Embeddings client, which may be OpenAI even when chat runs elsewhere.
   *
   * Neither Groq nor OpenRouter serves an embedding model, so every provider
   * except OpenAI needs a separate OpenAI client here. Falling through to the
   * chat client instead sent `text-embedding-3-small` to Groq's base URL, where
   * it 404s — and because `supportsEmbeddings()` only checks that an OpenAI key
   * exists, adding that key to a Groq deployment turned every research run into
   * a 500 rather than switching retrieval on.
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

    const request: Record<string, unknown> = {
      model,
      instructions: options.instructions,
      input: options.input,
      max_output_tokens: options.maxOutputTokens ?? 4000,
    };

    if (options.webSearch && !this.supportsWebSearch()) {
      return {
        text: '',
        webSources: [],
        webSearchUnavailable:
          `${provider} cannot search the live web, so no public web sources were retrieved. ` +
          'The answer is based on this client\'s own data only.',
        usage: { step: options.step, role: options.role, model, inputTokens: 0, outputTokens: 0, costUsd: null },
      };
    }

    if (options.webSearch) {
      if (provider === 'openrouter') {
        // OpenRouter exposes hosted search as a plugin rather than a tool.
        request.plugins = [{ id: 'web', max_results: 6 }];
      } else {
        request.tools = [{ type: 'web_search' }];
      }
    }

    if (options.jsonSchema) {
      request.text = {
        format: {
          type: 'json_schema',
          name: options.jsonSchema.name,
          schema: options.jsonSchema.schema,
          strict: false,
        },
      };
    }

    let response: any;
    try {
      response = await (this.openai() as any).responses.create(request);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      // Web search is a paid add-on on OpenRouter. Losing it should degrade the
      // run to client-owned evidence, not fail the whole request — the pipeline
      // then reports the missing public evidence honestly.
      if (options.webSearch && /insufficient credits|402/i.test(message)) {
        this.logger.warn(`Web search unavailable (${options.step}): ${message}`);
        return {
          text: '',
          webSources: [],
          webSearchUnavailable:
            'Live web search is unavailable on this account, so no public web sources were retrieved.',
          usage: { step: options.step, role: options.role, model, inputTokens: 0, outputTokens: 0, costUsd: null },
        };
      }

      this.logger.error(`Model call failed (${options.step}, ${model}): ${message}`);
      throw new ServiceUnavailableException(
        `The research model could not be reached (${options.step}). ${message}`,
      );
    }

    // A reasoning-heavy model can spend its whole budget before emitting a
    // message. That is a truncated answer, not a valid empty one.
    if (response?.status === 'incomplete' && !this.extractText(response)) {
      throw new ServiceUnavailableException(
        `The model ran out of output budget before answering (${options.step}). Raise max_output_tokens or use a stronger model.`,
      );
    }

    return {
      text: this.extractText(response),
      webSources: this.extractWebSources(response),
      usage: {
        step: options.step,
        role: options.role,
        model,
        inputTokens: response?.usage?.input_tokens ?? 0,
        outputTokens: response?.usage?.output_tokens ?? 0,
        costUsd: typeof response?.usage?.cost === 'number' ? response.usage.cost : null,
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

  /**
   * Reads the assistant text out of a Responses payload.
   *
   * `output_text` is the convenience field, but it is absent when the response
   * also carries reasoning or tool items — confirmed against live OpenRouter
   * responses — so the output array is walked as the fallback.
   */
  private extractText(response: any): string {
    if (typeof response?.output_text === 'string' && response.output_text.trim()) {
      return response.output_text;
    }

    const chunks: string[] = [];
    for (const item of response?.output ?? []) {
      if (item?.type !== 'message') continue;
      for (const part of item?.content ?? []) {
        if (typeof part?.text === 'string') chunks.push(part.text);
      }
    }
    return chunks.join('\n').trim();
  }

  /**
   * Pulls the URLs the hosted search actually returned.
   *
   * These annotations are the only web sources a run may cite. Taking them from
   * the response rather than from the model's prose is the difference between a
   * citation we can verify and a URL written out from memory. Both providers
   * report `url_citation`, but OpenRouter nests the fields one level deeper.
   */
  private extractWebSources(response: any): RetrievedWebSource[] {
    const byUrl = new Map<string, RetrievedWebSource>();

    const consider = (annotation: any) => {
      if (annotation?.type !== 'url_citation') return;
      const nested = annotation.url_citation ?? annotation;
      const url = nested?.url;
      if (!url || byUrl.has(url)) return;
      byUrl.set(url, {
        url,
        title: nested.title || url,
        excerpt: typeof nested.content === 'string' ? nested.content.slice(0, 1000) : undefined,
      });
    };

    for (const item of response?.output ?? []) {
      if (item?.type !== 'message') continue;
      for (const part of item?.content ?? []) {
        for (const annotation of part?.annotations ?? []) consider(annotation);
      }
      for (const annotation of item?.annotations ?? []) consider(annotation);
    }

    return [...byUrl.values()];
  }
}
