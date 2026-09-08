import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MultiAiRouterService, AiProvider, AiTask } from '../ai-search/multi-ai-router/multi-ai-router.service';
import { extractAndParseJson } from './utils/json-extractor.util';

export interface SeoRecommendation {
  issue: string;
  category: 'technical_seo' | 'keyword_strategy' | 'competitor_intelligence' | 'content_seo' | 'aev_visibility';
  severity: 'critical' | 'high' | 'medium' | 'low';
  evidence: string;
  recommendation: string;
  expected_impact: string;
  confidence: number;
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  recommended_action: string;
  expected_outcome: string;
}

export interface WebsiteAuditInput {
  domain: string;
  pagesCrawled: number;
  crawlDataSummary?: {
    totalUrls?: number;
    sampleUrls?: string[];
    statusCodeCounts?: Record<string, number>;
    detectedIssues?: Array<{ issueType: string; count: number; sampleUrl?: string; details?: string }>;
    slowPages?: Array<{ url: string; loadTimeMs: number }>;
    schemaTypesFound?: string[];
  };
  organizationId?: string;
  projectId?: string;
}

export interface WebsiteAuditResult {
  domain: string;
  overallHealthScoreEstimate: number;
  auditSummary: string;
  technicalProblems: Array<{
    problem: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    evidence: string;
    whyItMatters: string;
    recommendedFix: string;
    codeSnippetOrDirective?: string;
    priority: 'P0' | 'P1' | 'P2' | 'P3';
  }>;
  recommendations: SeoRecommendation[];
  modelUsed: string;
}

export interface CompetitorIntelligenceInput {
  domain: string;
  competitors: Array<{ domain: string; name?: string; sharedKeywordsCount?: number }>;
  marketCategory?: string;
  trackedKeywords?: Array<{ keyword: string; ourRank?: number; competitorRanks?: Record<string, number> }>;
  knownStrengths?: string[];
  organizationId?: string;
  projectId?: string;
}

export interface CompetitorIntelligenceResult {
  landscapeSummary: string;
  competitorStrengths: string[];
  competitorWeaknesses: string[];
  keywordGaps: Array<{
    keyword: string;
    searchVolumeEstimate: string;
    competitorAdvantage: string;
    rankingOpportunity: string;
    targetAction: string;
  }>;
  contentGaps: Array<{
    topic: string;
    competitorCoverage: string;
    whyItRanks: string;
    recommendedContentFormat: string;
  }>;
  rankingOpportunities: Array<{
    opportunity: string;
    trafficPotential: 'high' | 'medium' | 'low';
    effort: 'high' | 'medium' | 'low';
    strategicAdvantage: string;
  }>;
  recommendations: SeoRecommendation[];
  modelUsed: string;
}

export interface KeywordStrategyInput {
  seedKeywords: string[];
  businessDomain: string;
  targetAudience?: string;
  currentUrls?: string[];
  organizationId?: string;
  projectId?: string;
}

export interface KeywordStrategyResult {
  clusters: Array<{
    clusterName: string;
    searchIntent: 'informational' | 'navigational' | 'commercial' | 'transactional';
    primaryKeyword: string;
    secondaryKeywords: string[];
    commercialOpportunity: string;
    recommendedTargetPage: string;
  }>;
  keywordPrioritization: Array<{
    keyword: string;
    priority: 'P0' | 'P1' | 'P2' | 'P3';
    intent: string;
    difficultyTier: 'easy' | 'moderate' | 'hard';
    strategicValue: string;
  }>;
  cannibalizationOpportunities: Array<{
    potentialCannibalizationQuery: string;
    competingIntentsOrUrls: string[];
    consolidationRecommendation: string;
  }>;
  recommendations: SeoRecommendation[];
  modelUsed: string;
}

export interface ContentOnPageInput {
  pageUrl: string;
  pageTitle?: string;
  metaDescription?: string;
  h1?: string;
  contentSnippet?: string;
  targetKeyword?: string;
  organizationId?: string;
  projectId?: string;
}

export interface ContentOnPageResult {
  pageUrl: string;
  titleImprovements: {
    currentTitle: string;
    recommendedTitle: string;
    charCount: number;
    reasoning: string;
  };
  metaDescriptionImprovements: {
    currentDescription: string;
    recommendedDescription: string;
    charCount: number;
    reasoning: string;
  };
  missingTopicsAndEntities: string[];
  internalLinkRecommendations: Array<{
    targetPageConcept: string;
    suggestedAnchorText: string;
    placementContext: string;
    semanticRationale: string;
  }>;
  contentGaps: string[];
  recommendations: SeoRecommendation[];
  modelUsed: string;
}

export interface AevVisibilityInput {
  brandName: string;
  websiteDomain: string;
  coreQueries: string[];
  aiSearchVisibilityData?: Array<{
    query: string;
    enginesChecked: string[];
    brandCited: boolean;
    competitorsCited: string[];
    snippetCited?: string;
  }>;
  organizationId?: string;
  projectId?: string;
}

export interface AevVisibilityResult {
  visibilitySummary: string;
  brandVisibilityIndex: number;
  whyBrandMayNotAppear: Array<{
    queryCategory: string;
    omissionCause: string;
    authoritativeSourcesFavoredByAi: string[];
  }>;
  entityTopicCoverageComparison: Array<{
    topic: string;
    brandCoverage: 'strong' | 'weak' | 'absent';
    competitorCoverage: string;
    gapDescription: string;
  }>;
  recommendationsForImprovingVisibility: Array<{
    tactic: string;
    targetAiEngine: string;
    actionableStep: string;
    expectedImpact: string;
  }>;
  recommendations: SeoRecommendation[];
  modelUsed: string;
}

/**
 * Cache entry for cost-control & idempotent AI analysis
 */
interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

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
    const maskedKey = key.length > 8
      ? `${key.slice(0, 7)}••••••••••••`
      : '••••••••••••';

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

    const systemInstruction = [
      'You are the GrowthX Technical SEO Audit Engine.',
      'Analyze the provided crawl telemetry and identify technical SEO problems.',
      'Prioritize issues by severity and impact, explain why each issue matters, and generate recommended fixes with code/directives.',
      'Return strictly valid JSON adhering to the provided schema.',
    ].join('\n');

    const prompt = [
      `Website Domain: ${input.domain}`,
      `Total Pages Crawled: ${input.pagesCrawled}`,
      `Crawl Diagnostic Telemetry:`,
      JSON.stringify(condensedSummary, null, 2),
      '',
      'Perform a thorough technical SEO evaluation. Detail technical problems with severity, evidence, whyItMatters, recommendedFix, and codeSnippetOrDirective.',
      'Include standardized SEO recommendations with problem, evidence, impact, priority, recommended_action, expected_outcome, and confidence (0.0 to 1.0).',
    ].join('\n');

    const schema = {
      type: 'object',
      properties: {
        domain: { type: 'string' },
        overallHealthScoreEstimate: { type: 'number' },
        auditSummary: { type: 'string' },
        technicalProblems: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              problem: { type: 'string' },
              severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
              evidence: { type: 'string' },
              whyItMatters: { type: 'string' },
              recommendedFix: { type: 'string' },
              codeSnippetOrDirective: { type: 'string' },
              priority: { type: 'string', enum: ['P0', 'P1', 'P2', 'P3'] },
            },
            required: ['problem', 'severity', 'evidence', 'whyItMatters', 'recommendedFix', 'priority'],
          },
        },
        recommendations: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              issue: { type: 'string' },
              category: { type: 'string', enum: ['technical_seo'] },
              severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
              evidence: { type: 'string' },
              recommendation: { type: 'string' },
              expected_impact: { type: 'string' },
              confidence: { type: 'number' },
              priority: { type: 'string', enum: ['P0', 'P1', 'P2', 'P3'] },
              recommended_action: { type: 'string' },
              expected_outcome: { type: 'string' },
            },
            required: ['issue', 'category', 'severity', 'evidence', 'recommendation', 'expected_impact', 'confidence', 'priority', 'recommended_action', 'expected_outcome'],
          },
        },
      },
      required: ['overallHealthScoreEstimate', 'auditSummary', 'technicalProblems', 'recommendations'],
    };

    const completion = await this.router.generate({
      prompt,
      systemInstruction,
      task: AiTask.SEO_ANALYSIS,
      provider: AiProvider.MAMMOUTH,
      organizationId: input.organizationId,
      projectId: input.projectId,
      jsonSchema: schema,
      maxTokens: 4000,
    });

    const parsed = this.parseResilientJson<WebsiteAuditResult>(completion.text, {
      domain: input.domain,
      overallHealthScoreEstimate: 75,
      auditSummary: 'Automated crawl audit analysis complete.',
      technicalProblems: [],
      recommendations: [],
      modelUsed: completion.model,
    });

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

    const systemInstruction = [
      'You are the GrowthX Competitive Intelligence Engine.',
      'Analyze competitor information collected by GrowthX without replacing existing data.',
      'Identify keyword gaps, content gaps, ranking opportunities, competitor strengths and weaknesses.',
      'Produce actionable counter-strategies and standardized recommendations.',
      'Return strictly valid JSON adhering to the provided schema.',
    ].join('\n');

    const prompt = [
      `Target Domain: ${input.domain}`,
      `Market Category: ${input.marketCategory || 'General / Technology'}`,
      `Tracked Competitors:`,
      JSON.stringify(input.competitors.slice(0, 8), null, 2),
      `Tracked Keywords & Rankings:`,
      JSON.stringify((input.trackedKeywords || []).slice(0, 20), null, 2),
      '',
      'Perform competitive teardown identifying keyword gaps, content gaps, and ranking opportunities.',
      'Generate actionable recommendations with problem, evidence, impact, priority, recommended_action, expected_outcome, and confidence.',
    ].join('\n');

    const schema = {
      type: 'object',
      properties: {
        landscapeSummary: { type: 'string' },
        competitorStrengths: { type: 'array', items: { type: 'string' } },
        competitorWeaknesses: { type: 'array', items: { type: 'string' } },
        keywordGaps: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              keyword: { type: 'string' },
              searchVolumeEstimate: { type: 'string' },
              competitorAdvantage: { type: 'string' },
              rankingOpportunity: { type: 'string' },
              targetAction: { type: 'string' },
            },
            required: ['keyword', 'searchVolumeEstimate', 'competitorAdvantage', 'rankingOpportunity', 'targetAction'],
          },
        },
        contentGaps: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              topic: { type: 'string' },
              competitorCoverage: { type: 'string' },
              whyItRanks: { type: 'string' },
              recommendedContentFormat: { type: 'string' },
            },
            required: ['topic', 'competitorCoverage', 'whyItRanks', 'recommendedContentFormat'],
          },
        },
        rankingOpportunities: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              opportunity: { type: 'string' },
              trafficPotential: { type: 'string', enum: ['high', 'medium', 'low'] },
              effort: { type: 'string', enum: ['high', 'medium', 'low'] },
              strategicAdvantage: { type: 'string' },
            },
            required: ['opportunity', 'trafficPotential', 'effort', 'strategicAdvantage'],
          },
        },
        recommendations: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              issue: { type: 'string' },
              category: { type: 'string', enum: ['competitor_intelligence', 'keyword_strategy'] },
              severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
              evidence: { type: 'string' },
              recommendation: { type: 'string' },
              expected_impact: { type: 'string' },
              confidence: { type: 'number' },
              priority: { type: 'string', enum: ['P0', 'P1', 'P2', 'P3'] },
              recommended_action: { type: 'string' },
              expected_outcome: { type: 'string' },
            },
            required: ['issue', 'category', 'severity', 'evidence', 'recommendation', 'expected_impact', 'confidence', 'priority', 'recommended_action', 'expected_outcome'],
          },
        },
      },
      required: ['landscapeSummary', 'competitorStrengths', 'competitorWeaknesses', 'keywordGaps', 'contentGaps', 'rankingOpportunities', 'recommendations'],
    };

    const completion = await this.router.generate({
      prompt,
      systemInstruction,
      task: AiTask.COMPETITOR_ANALYSIS,
      provider: AiProvider.MAMMOUTH,
      organizationId: input.organizationId,
      projectId: input.projectId,
      jsonSchema: schema,
      maxTokens: 4000,
    });

    const parsed = this.parseResilientJson<CompetitorIntelligenceResult>(completion.text, {
      landscapeSummary: 'Competitive analysis complete.',
      competitorStrengths: [],
      competitorWeaknesses: [],
      keywordGaps: [],
      contentGaps: [],
      rankingOpportunities: [],
      recommendations: [],
      modelUsed: completion.model,
    });

    parsed.modelUsed = completion.model;
    this.setCached(cacheKey, parsed);
    return parsed;
  }

  // ── 3. Keyword Strategy ────────────────────────────────────────────────────

  async generateKeywordStrategy(input: KeywordStrategyInput): Promise<KeywordStrategyResult> {
    const cacheKey = `keywords:${input.businessDomain}:${input.seedKeywords.slice(0, 5).join(',')}`;
    const cached = this.getCached<KeywordStrategyResult>(cacheKey);
    if (cached) return cached;

    const systemInstruction = [
      'You are the GrowthX Keyword Strategy & Semantic Clustering Engine.',
      'Cluster keywords, identify search intent, prioritize keywords, identify commercial opportunities, recommend target pages, and detect keyword cannibalization risks.',
      'Return strictly valid JSON adhering to the provided schema.',
    ].join('\n');

    const prompt = [
      `Business Domain: ${input.businessDomain}`,
      `Target Audience: ${input.targetAudience || 'Target customers and searchers'}`,
      `Seed Keywords:`,
      JSON.stringify(input.seedKeywords.slice(0, 30), null, 2),
      `Existing Page URLs:`,
      JSON.stringify((input.currentUrls || []).slice(0, 20), null, 2),
      '',
      'Cluster keywords semantically, specify search intent (informational/navigational/commercial/transactional), flag cannibalization risks, and provide standardized recommendations.',
    ].join('\n');

    const schema = {
      type: 'object',
      properties: {
        clusters: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              clusterName: { type: 'string' },
              searchIntent: { type: 'string', enum: ['informational', 'navigational', 'commercial', 'transactional'] },
              primaryKeyword: { type: 'string' },
              secondaryKeywords: { type: 'array', items: { type: 'string' } },
              commercialOpportunity: { type: 'string' },
              recommendedTargetPage: { type: 'string' },
            },
            required: ['clusterName', 'searchIntent', 'primaryKeyword', 'secondaryKeywords', 'commercialOpportunity', 'recommendedTargetPage'],
          },
        },
        keywordPrioritization: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              keyword: { type: 'string' },
              priority: { type: 'string', enum: ['P0', 'P1', 'P2', 'P3'] },
              intent: { type: 'string' },
              difficultyTier: { type: 'string', enum: ['easy', 'moderate', 'hard'] },
              strategicValue: { type: 'string' },
            },
            required: ['keyword', 'priority', 'intent', 'difficultyTier', 'strategicValue'],
          },
        },
        cannibalizationOpportunities: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              potentialCannibalizationQuery: { type: 'string' },
              competingIntentsOrUrls: { type: 'array', items: { type: 'string' } },
              consolidationRecommendation: { type: 'string' },
            },
            required: ['potentialCannibalizationQuery', 'competingIntentsOrUrls', 'consolidationRecommendation'],
          },
        },
        recommendations: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              issue: { type: 'string' },
              category: { type: 'string', enum: ['keyword_strategy'] },
              severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
              evidence: { type: 'string' },
              recommendation: { type: 'string' },
              expected_impact: { type: 'string' },
              confidence: { type: 'number' },
              priority: { type: 'string', enum: ['P0', 'P1', 'P2', 'P3'] },
              recommended_action: { type: 'string' },
              expected_outcome: { type: 'string' },
            },
            required: ['issue', 'category', 'severity', 'evidence', 'recommendation', 'expected_impact', 'confidence', 'priority', 'recommended_action', 'expected_outcome'],
          },
        },
      },
      required: ['clusters', 'keywordPrioritization', 'cannibalizationOpportunities', 'recommendations'],
    };

    const completion = await this.router.generate({
      prompt,
      systemInstruction,
      task: AiTask.FAST,
      provider: AiProvider.MAMMOUTH,
      organizationId: input.organizationId,
      projectId: input.projectId,
      jsonSchema: schema,
      maxTokens: 4000,
    });

    const parsed = this.parseResilientJson<KeywordStrategyResult>(completion.text, {
      clusters: [],
      keywordPrioritization: [],
      cannibalizationOpportunities: [],
      recommendations: [],
      modelUsed: completion.model,
    });

    parsed.modelUsed = completion.model;
    this.setCached(cacheKey, parsed);
    return parsed;
  }

  // ── 4. Content / On-page SEO ───────────────────────────────────────────────

  async analyzeContentOnPage(input: ContentOnPageInput): Promise<ContentOnPageResult> {
    const cacheKey = `content:${input.pageUrl}`;
    const cached = this.getCached<ContentOnPageResult>(cacheKey);
    if (cached) return cached;

    const systemInstruction = [
      'You are the GrowthX Content & On-Page SEO Engine.',
      'Analyze the existing webpage data. Recommend title and meta description improvements within exact character count constraints.',
      'Identify missing entities/topics, suggest internal links with semantic rationales, and pinpoint content gaps.',
      'Return strictly valid JSON adhering to the provided schema.',
    ].join('\n');

    const prompt = [
      `Target URL: ${input.pageUrl}`,
      `Current Title: ${input.pageTitle || 'None / Not set'}`,
      `Current Meta Description: ${input.metaDescription || 'None / Not set'}`,
      `H1: ${input.h1 || 'None'}`,
      `Target Primary Keyword: ${input.targetKeyword || 'Inferred from context'}`,
      `Content Snippet: ${input.contentSnippet ? input.contentSnippet.slice(0, 1500) : 'Not provided'}`,
      '',
      'Optimize title (50-60 chars) and meta description (130-155 chars). Identify missing semantic topics/entities and high-value internal links.',
    ].join('\n');

    const schema = {
      type: 'object',
      properties: {
        pageUrl: { type: 'string' },
        titleImprovements: {
          type: 'object',
          properties: {
            currentTitle: { type: 'string' },
            recommendedTitle: { type: 'string' },
            charCount: { type: 'number' },
            reasoning: { type: 'string' },
          },
          required: ['currentTitle', 'recommendedTitle', 'charCount', 'reasoning'],
        },
        metaDescriptionImprovements: {
          type: 'object',
          properties: {
            currentDescription: { type: 'string' },
            recommendedDescription: { type: 'string' },
            charCount: { type: 'number' },
            reasoning: { type: 'string' },
          },
          required: ['currentDescription', 'recommendedDescription', 'charCount', 'reasoning'],
        },
        missingTopicsAndEntities: { type: 'array', items: { type: 'string' } },
        internalLinkRecommendations: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              targetPageConcept: { type: 'string' },
              suggestedAnchorText: { type: 'string' },
              placementContext: { type: 'string' },
              semanticRationale: { type: 'string' },
            },
            required: ['targetPageConcept', 'suggestedAnchorText', 'placementContext', 'semanticRationale'],
          },
        },
        contentGaps: { type: 'array', items: { type: 'string' } },
        recommendations: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              issue: { type: 'string' },
              category: { type: 'string', enum: ['content_seo'] },
              severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
              evidence: { type: 'string' },
              recommendation: { type: 'string' },
              expected_impact: { type: 'string' },
              confidence: { type: 'number' },
              priority: { type: 'string', enum: ['P0', 'P1', 'P2', 'P3'] },
              recommended_action: { type: 'string' },
              expected_outcome: { type: 'string' },
            },
            required: ['issue', 'category', 'severity', 'evidence', 'recommendation', 'expected_impact', 'confidence', 'priority', 'recommended_action', 'expected_outcome'],
          },
        },
      },
      required: ['titleImprovements', 'metaDescriptionImprovements', 'missingTopicsAndEntities', 'internalLinkRecommendations', 'contentGaps', 'recommendations'],
    };

    const completion = await this.router.generate({
      prompt,
      systemInstruction,
      task: AiTask.CONTENT_STRUCTURE_ANALYSIS,
      provider: AiProvider.MAMMOUTH,
      organizationId: input.organizationId,
      projectId: input.projectId,
      jsonSchema: schema,
      maxTokens: 3000,
    });

    const parsed = this.parseResilientJson<ContentOnPageResult>(completion.text, {
      pageUrl: input.pageUrl,
      titleImprovements: {
        currentTitle: input.pageTitle || '',
        recommendedTitle: input.pageTitle || 'Optimized Title',
        charCount: 55,
        reasoning: 'Improved keyword positioning.',
      },
      metaDescriptionImprovements: {
        currentDescription: input.metaDescription || '',
        recommendedDescription: 'Compelling meta description optimized for CTR.',
        charCount: 145,
        reasoning: 'Clear call to action and primary keyword inclusion.',
      },
      missingTopicsAndEntities: [],
      internalLinkRecommendations: [],
      contentGaps: [],
      recommendations: [],
      modelUsed: completion.model,
    });

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

    const systemInstruction = [
      'You are the GrowthX AEV (AI Engine Visibility) Intelligence Engine.',
      'Analyze queries and AI-search visibility telemetry across LLMs (ChatGPT, Perplexity, Gemini).',
      'Explain why the brand may be omitted from answers, compare entity/topic coverage against competitors, and generate a strategic plan for earning citations.',
      'Return strictly valid JSON adhering to the provided schema.',
    ].join('\n');

    const prompt = [
      `Brand Name: ${input.brandName}`,
      `Website: ${input.websiteDomain}`,
      `Core Search Queries:`,
      JSON.stringify(input.coreQueries.slice(0, 15), null, 2),
      `AI Search Telemetry & Citations:`,
      JSON.stringify((input.aiSearchVisibilityData || []).slice(0, 15), null, 2),
      '',
      'Assess brand presence score (0-100), identify why the brand is omitted, compare entity coverage, and output actionable steps for getting cited in AI answers.',
    ].join('\n');

    const schema = {
      type: 'object',
      properties: {
        visibilitySummary: { type: 'string' },
        brandVisibilityIndex: { type: 'number' },
        whyBrandMayNotAppear: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              queryCategory: { type: 'string' },
              omissionCause: { type: 'string' },
              authoritativeSourcesFavoredByAi: { type: 'array', items: { type: 'string' } },
            },
            required: ['queryCategory', 'omissionCause', 'authoritativeSourcesFavoredByAi'],
          },
        },
        entityTopicCoverageComparison: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              topic: { type: 'string' },
              brandCoverage: { type: 'string', enum: ['strong', 'weak', 'absent'] },
              competitorCoverage: { type: 'string' },
              gapDescription: { type: 'string' },
            },
            required: ['topic', 'brandCoverage', 'competitorCoverage', 'gapDescription'],
          },
        },
        recommendationsForImprovingVisibility: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              tactic: { type: 'string' },
              targetAiEngine: { type: 'string' },
              actionableStep: { type: 'string' },
              expectedImpact: { type: 'string' },
            },
            required: ['tactic', 'targetAiEngine', 'actionableStep', 'expectedImpact'],
          },
        },
        recommendations: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              issue: { type: 'string' },
              category: { type: 'string', enum: ['aev_visibility'] },
              severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
              evidence: { type: 'string' },
              recommendation: { type: 'string' },
              expected_impact: { type: 'string' },
              confidence: { type: 'number' },
              priority: { type: 'string', enum: ['P0', 'P1', 'P2', 'P3'] },
              recommended_action: { type: 'string' },
              expected_outcome: { type: 'string' },
            },
            required: ['issue', 'category', 'severity', 'evidence', 'recommendation', 'expected_impact', 'confidence', 'priority', 'recommended_action', 'expected_outcome'],
          },
        },
      },
      required: ['visibilitySummary', 'brandVisibilityIndex', 'whyBrandMayNotAppear', 'entityTopicCoverageComparison', 'recommendationsForImprovingVisibility', 'recommendations'],
    };

    const completion = await this.router.generate({
      prompt,
      systemInstruction,
      task: AiTask.AI_VISIBILITY_ANALYSIS,
      provider: AiProvider.MAMMOUTH,
      organizationId: input.organizationId,
      projectId: input.projectId,
      jsonSchema: schema,
      maxTokens: 4000,
    });

    const parsed = this.parseResilientJson<AevVisibilityResult>(completion.text, {
      visibilitySummary: 'AEV analysis complete.',
      brandVisibilityIndex: 45,
      whyBrandMayNotAppear: [],
      entityTopicCoverageComparison: [],
      recommendationsForImprovingVisibility: [],
      recommendations: [],
      modelUsed: completion.model,
    });

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
    if (!summary) return { note: 'Standard crawl baseline' };

    const deduplicatedUrls = Array.from(new Set(
      (summary.sampleUrls || []).map(url => {
        try {
          const u = new URL(url);
          return `${u.origin}${u.pathname}`;
        } catch {
          return url;
        }
      })
    )).slice(0, 15);

    return {
      totalUrls: summary.totalUrls,
      sampleUrls: deduplicatedUrls,
      statusCodeCounts: summary.statusCodeCounts,
      detectedIssues: (summary.detectedIssues || []).slice(0, 12).map(i => ({
        issueType: i.issueType,
        count: i.count,
        sampleUrl: i.sampleUrl,
      })),
      slowestPages: (summary.slowPages || []).slice(0, 5),
      schemaTypesFound: (summary.schemaTypesFound || []).slice(0, 8),
    };
  }

  private parseResilientJson<T>(rawText: string, fallback: T): T {
    if (!rawText?.trim()) return fallback;
    try {
      return extractAndParseJson(rawText) as T;
    } catch (err: any) {
      this.logger.warn(`Failed to parse AI JSON response: ${err.message}. Using resilient fallback structure.`);
      return fallback;
    }
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
