import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MultiAiRouterService, AiProvider, AiTask } from '../ai-search/multi-ai-router/multi-ai-router.service';
import {
  WebsiteAuditInput,
  WebsiteAuditResult,
  CompetitorIntelligenceInput,
  CompetitorIntelligenceResult,
  KeywordStrategyInput,
  KeywordStrategyResult,
  ContentOnPageInput,
  ContentOnPageResult,
  AevVisibilityInput,
  AevVisibilityResult,
  CacheEntry,
} from './mammouth-seo.types';
import {
  WEBSITE_AUDIT_SYSTEM_INSTRUCTION,
  buildWebsiteAuditPrompt,
  WEBSITE_AUDIT_SCHEMA,
  buildWebsiteAuditFallback,
  COMPETITOR_INTELLIGENCE_SYSTEM_INSTRUCTION,
  buildCompetitorIntelligencePrompt,
  COMPETITOR_INTELLIGENCE_SCHEMA,
  buildCompetitorIntelligenceFallback,
  KEYWORD_STRATEGY_SYSTEM_INSTRUCTION,
  buildKeywordStrategyPrompt,
  KEYWORD_STRATEGY_SCHEMA,
  buildKeywordStrategyFallback,
  CONTENT_ONPAGE_SYSTEM_INSTRUCTION,
  buildContentOnPagePrompt,
  CONTENT_ONPAGE_SCHEMA,
  buildContentOnPageFallback,
  AEV_VISIBILITY_SYSTEM_INSTRUCTION,
  buildAevVisibilityPrompt,
  AEV_VISIBILITY_SCHEMA,
  buildAevVisibilityFallback,
} from './mammouth-seo.schemas';
import { condenseCrawlSummary, parseResilientJson } from './mammouth-seo.helpers';

export * from './mammouth-seo.types';

@Injectable()
export class MammouthSeoService {
  private readonly logger = new Logger(MammouthSeoService.name);
  private readonly cache = new Map<string, CacheEntry<any>>();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes cache

  constructor(
    private readonly router: MultiAiRouterService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Fast connection test to verify Mammouth AI API key and reachability.
   */
  async testConnection(): Promise<{
    connected: boolean;
    provider: string;
    model: string;
    latencyMs: number;
    maskedKey: string;
    message: string;
  }> {
    const key = this.config.get<string>('MAMMOUTH_API_KEY') || '';
    // No slice of the key leaves the server: a prefix still narrows a brute
    // force, and the frontend only ever renders fixed bullets anyway.
    const maskedKey = '••••••••••••';

    if (!key || key.startsWith('your_') || key.startsWith('add-')) {
      return {
        connected: false,
        provider: 'Mammouth AI',
        model: 'unknown',
        latencyMs: 0,
        maskedKey,
        message: 'MAMMOUTH_API_KEY is not configured or is a placeholder.',
      };
    }

    const start = Date.now();
    try {
      const completion = await this.router.generate({
        prompt: 'Return a JSON ping response: {"status": "ok", "provider": "Mammouth AI"}',
        provider: AiProvider.MAMMOUTH,
        task: AiTask.FAST,
        maxTokens: 50,
        allowFallback: false,
        jsonSchema: {
          type: 'object',
          properties: { status: { type: 'string' }, provider: { type: 'string' } },
          required: ['status'],
        },
      });

      return {
        connected: true,
        provider: 'Mammouth AI',
        model: completion.model,
        latencyMs: Date.now() - start,
        maskedKey,
        message: 'Mammouth AI connected and operational.',
      };
    } catch (error: any) {
      this.logger.warn(`Mammouth AI connection test failed: ${error.message}`);
      return {
        connected: false,
        provider: 'Mammouth AI',
        model: 'unknown',
        latencyMs: Date.now() - start,
        maskedKey,
        message: error.message || 'Connection failed',
      };
    }
  }

  // ── 1. Website SEO Audit ───────────────────────────────────────────────────

  async analyzeWebsiteAudit(input: WebsiteAuditInput): Promise<WebsiteAuditResult> {
    const cacheKey = `audit:${input.domain}:${input.pagesCrawled}`;
    const cached = this.getCached<WebsiteAuditResult>(cacheKey);
    if (cached) return cached;

    // Cost Control: clean and condense crawl summary
    const condensedSummary = this.condenseCrawlSummary(input.crawlDataSummary);

    const completion = await this.router.generate({
      prompt: buildWebsiteAuditPrompt(input.domain, input.pagesCrawled, condensedSummary),
      systemInstruction: WEBSITE_AUDIT_SYSTEM_INSTRUCTION,
      task: AiTask.SEO_ANALYSIS,
      provider: AiProvider.MAMMOUTH,
      organizationId: input.organizationId,
      projectId: input.projectId,
      jsonSchema: WEBSITE_AUDIT_SCHEMA,
      maxTokens: 4000,
    });

    const parsed = this.parseResilientJson<WebsiteAuditResult>(
      completion.text,
      buildWebsiteAuditFallback(input.domain, completion.model),
    );

    parsed.modelUsed = completion.model;
    parsed.domain = input.domain;
    this.setCached(cacheKey, parsed);
    return parsed;
  }

  // ── 2. Competitor Intelligence ─────────────────────────────────────────────

  async analyzeCompetitorIntelligence(input: CompetitorIntelligenceInput): Promise<CompetitorIntelligenceResult> {
    const cacheKey = `comp:${input.domain}:${(input.competitors || []).map(c => c.domain).join(',')}`;
    const cached = this.getCached<CompetitorIntelligenceResult>(cacheKey);
    if (cached) return cached;

    const completion = await this.router.generate({
      prompt: buildCompetitorIntelligencePrompt(input),
      systemInstruction: COMPETITOR_INTELLIGENCE_SYSTEM_INSTRUCTION,
      task: AiTask.COMPETITOR_ANALYSIS,
      provider: AiProvider.MAMMOUTH,
      organizationId: input.organizationId,
      projectId: input.projectId,
      jsonSchema: COMPETITOR_INTELLIGENCE_SCHEMA,
      maxTokens: 4000,
    });

    const parsed = this.parseResilientJson<CompetitorIntelligenceResult>(
      completion.text,
      buildCompetitorIntelligenceFallback(completion.model),
    );

    parsed.modelUsed = completion.model;
    this.setCached(cacheKey, parsed);
    return parsed;
  }

  // ── 3. Keyword Strategy ────────────────────────────────────────────────────

  async generateKeywordStrategy(input: KeywordStrategyInput): Promise<KeywordStrategyResult> {
    const cacheKey = `keywords:${input.businessDomain}:${input.seedKeywords.slice(0, 5).join(',')}`;
    const cached = this.getCached<KeywordStrategyResult>(cacheKey);
    if (cached) return cached;

    const completion = await this.router.generate({
      prompt: buildKeywordStrategyPrompt(input),
      systemInstruction: KEYWORD_STRATEGY_SYSTEM_INSTRUCTION,
      task: AiTask.FAST,
      provider: AiProvider.MAMMOUTH,
      organizationId: input.organizationId,
      projectId: input.projectId,
      jsonSchema: KEYWORD_STRATEGY_SCHEMA,
      maxTokens: 4000,
    });

    const parsed = this.parseResilientJson<KeywordStrategyResult>(
      completion.text,
      buildKeywordStrategyFallback(completion.model),
    );

    parsed.modelUsed = completion.model;
    this.setCached(cacheKey, parsed);
    return parsed;
  }

  // ── 4. Content / On-page SEO ───────────────────────────────────────────────

  async analyzeContentOnPage(input: ContentOnPageInput): Promise<ContentOnPageResult> {
    const cacheKey = `content:${input.pageUrl}`;
    const cached = this.getCached<ContentOnPageResult>(cacheKey);
    if (cached) return cached;

    const completion = await this.router.generate({
      prompt: buildContentOnPagePrompt(input),
      systemInstruction: CONTENT_ONPAGE_SYSTEM_INSTRUCTION,
      task: AiTask.CONTENT_STRUCTURE_ANALYSIS,
      provider: AiProvider.MAMMOUTH,
      organizationId: input.organizationId,
      projectId: input.projectId,
      jsonSchema: CONTENT_ONPAGE_SCHEMA,
      maxTokens: 3000,
    });

    const parsed = this.parseResilientJson<ContentOnPageResult>(
      completion.text,
      buildContentOnPageFallback(input, completion.model),
    );

    parsed.modelUsed = completion.model;
    parsed.pageUrl = input.pageUrl;
    this.setCached(cacheKey, parsed);
    return parsed;
  }

  // ── 5. AEV / AI Search Visibility ──────────────────────────────────────────

  async analyzeAevVisibility(input: AevVisibilityInput): Promise<AevVisibilityResult> {
    const cacheKey = `aev:${input.websiteDomain}:${input.brandName}`;
    const cached = this.getCached<AevVisibilityResult>(cacheKey);
    if (cached) return cached;

    const completion = await this.router.generate({
      prompt: buildAevVisibilityPrompt(input),
      systemInstruction: AEV_VISIBILITY_SYSTEM_INSTRUCTION,
      task: AiTask.AI_VISIBILITY_ANALYSIS,
      provider: AiProvider.MAMMOUTH,
      organizationId: input.organizationId,
      projectId: input.projectId,
      jsonSchema: AEV_VISIBILITY_SCHEMA,
      maxTokens: 4000,
    });

    const parsed = this.parseResilientJson<AevVisibilityResult>(
      completion.text,
      buildAevVisibilityFallback(completion.model),
    );

    parsed.modelUsed = completion.model;
    this.setCached(cacheKey, parsed);
    return parsed;
  }

  // ── Cost Control & Helper Utilities ───────────────────────────────────────

  /**
   * Condenses repetitive crawl telemetry into dense, representative signals.
   * Strips query parameter duplicates and truncates bloated lists.
   */
  private condenseCrawlSummary(summary?: WebsiteAuditInput['crawlDataSummary']): Record<string, any> {
    return condenseCrawlSummary(summary);
  }

  /**
   * A fallback here used to invent a health score and a summary sentence, which
   * reached the dashboard indistinguishable from a real analysis. An unparseable
   * model response is an outage, not a 75/100 site: fail loudly so the caller can
   * surface a warning instead of a fabricated verdict.
   */
  private parseResilientJson<T>(rawText: string, fallback: T): T {
    return parseResilientJson<T>(rawText, fallback, this.logger);
  }

  private getCached<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return entry.data as T;
  }

  private setCached<T>(key: string, data: T): void {
    // Avoid unbound memory growth
    if (this.cache.size > 200) {
      const oldest = this.cache.keys().next().value;
      if (oldest) this.cache.delete(oldest);
    }
    this.cache.set(key, { data, expiresAt: Date.now() + this.CACHE_TTL_MS });
  }
}
