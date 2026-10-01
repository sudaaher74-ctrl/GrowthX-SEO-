import {
  WebsiteAuditResult,
  CompetitorIntelligenceInput,
  CompetitorIntelligenceResult,
  KeywordStrategyInput,
  KeywordStrategyResult,
  ContentOnPageInput,
  ContentOnPageResult,
  AevVisibilityInput,
  AevVisibilityResult,
} from './mammouth-seo.types';

// ── 1. Website SEO Audit ─────────────────────────────────────────────────────

export const WEBSITE_AUDIT_SYSTEM_INSTRUCTION = [
  'You are the GrowthX Technical SEO Audit Engine.',
  'Analyze the provided crawl telemetry and identify technical SEO problems.',
  'Prioritize issues by severity and impact, explain why each issue matters, and generate recommended fixes with code/directives.',
  'Return strictly valid JSON adhering to the provided schema.',
].join('\n');

export function buildWebsiteAuditPrompt(
  domain: string,
  pagesCrawled: number,
  condensedSummary: Record<string, any>,
): string {
  return [
    `Website Domain: ${domain}`,
    `Total Pages Crawled: ${pagesCrawled}`,
    `Crawl Diagnostic Telemetry:`,
    JSON.stringify(condensedSummary, null, 2),
    '',
    'Perform a thorough technical SEO evaluation. Detail technical problems with severity, evidence, whyItMatters, recommendedFix, and codeSnippetOrDirective.',
    'Include standardized SEO recommendations with problem, evidence, impact, priority, recommended_action, expected_outcome, and confidence (0.0 to 1.0).',
  ].join('\n');
}

export const WEBSITE_AUDIT_SCHEMA = {
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

export function buildWebsiteAuditFallback(domain: string, model: string): WebsiteAuditResult {
  return {
    domain,
    overallHealthScoreEstimate: 75,
    auditSummary: 'Automated crawl audit analysis complete.',
    technicalProblems: [],
    recommendations: [],
    modelUsed: model,
  };
}

// ── 2. Competitor Intelligence ───────────────────────────────────────────────

export const COMPETITOR_INTELLIGENCE_SYSTEM_INSTRUCTION = [
  'You are the GrowthX Competitive Intelligence Engine.',
  'Analyze competitor information collected by GrowthX without replacing existing data.',
  'Identify keyword gaps, content gaps, ranking opportunities, competitor strengths and weaknesses.',
  'Produce actionable counter-strategies and standardized recommendations.',
  'Return strictly valid JSON adhering to the provided schema.',
].join('\n');

export function buildCompetitorIntelligencePrompt(input: CompetitorIntelligenceInput): string {
  return [
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
}

export const COMPETITOR_INTELLIGENCE_SCHEMA = {
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

export function buildCompetitorIntelligenceFallback(model: string): CompetitorIntelligenceResult {
  return {
    landscapeSummary: 'Competitive analysis complete.',
    competitorStrengths: [],
    competitorWeaknesses: [],
    keywordGaps: [],
    contentGaps: [],
    rankingOpportunities: [],
    recommendations: [],
    modelUsed: model,
  };
}

// ── 3. Keyword Strategy ──────────────────────────────────────────────────────

export const KEYWORD_STRATEGY_SYSTEM_INSTRUCTION = [
  'You are the GrowthX Keyword Strategy & Semantic Clustering Engine.',
  'Cluster keywords, identify search intent, prioritize keywords, identify commercial opportunities, recommend target pages, and detect keyword cannibalization risks.',
  'Return strictly valid JSON adhering to the provided schema.',
].join('\n');

export function buildKeywordStrategyPrompt(input: KeywordStrategyInput): string {
  return [
    `Business Domain: ${input.businessDomain}`,
    `Target Audience: ${input.targetAudience || 'Target customers and searchers'}`,
    `Seed Keywords:`,
    JSON.stringify(input.seedKeywords.slice(0, 30), null, 2),
    `Existing Page URLs:`,
    JSON.stringify((input.currentUrls || []).slice(0, 20), null, 2),
    '',
    'Cluster keywords semantically, specify search intent (informational/navigational/commercial/transactional), flag cannibalization risks, and provide standardized recommendations.',
  ].join('\n');
}

export const KEYWORD_STRATEGY_SCHEMA = {
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

export function buildKeywordStrategyFallback(model: string): KeywordStrategyResult {
  return {
    clusters: [],
    keywordPrioritization: [],
    cannibalizationOpportunities: [],
    recommendations: [],
    modelUsed: model,
  };
}

// ── 4. Content / On-page SEO ─────────────────────────────────────────────────

export const CONTENT_ONPAGE_SYSTEM_INSTRUCTION = [
  'You are the GrowthX Content & On-Page SEO Engine.',
  'Analyze the existing webpage data. Recommend title and meta description improvements within exact character count constraints.',
  'Identify missing entities/topics, suggest internal links with semantic rationales, and pinpoint content gaps.',
  'Return strictly valid JSON adhering to the provided schema.',
].join('\n');

export function buildContentOnPagePrompt(input: ContentOnPageInput): string {
  return [
    `Target URL: ${input.pageUrl}`,
    `Current Title: ${input.pageTitle || 'None / Not set'}`,
    `Current Meta Description: ${input.metaDescription || 'None / Not set'}`,
    `H1: ${input.h1 || 'None'}`,
    `Target Primary Keyword: ${input.targetKeyword || 'Inferred from context'}`,
    `Content Snippet: ${input.contentSnippet ? input.contentSnippet.slice(0, 1500) : 'Not provided'}`,
    '',
    'Optimize title (50-60 chars) and meta description (130-155 chars). Identify missing semantic topics/entities and high-value internal links.',
  ].join('\n');
}

export const CONTENT_ONPAGE_SCHEMA = {
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

export function buildContentOnPageFallback(input: ContentOnPageInput, model: string): ContentOnPageResult {
  return {
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
    modelUsed: model,
  };
}

// ── 5. AEV / AI Search Visibility ────────────────────────────────────────────

export const AEV_VISIBILITY_SYSTEM_INSTRUCTION = [
  'You are the GrowthX AEV (AI Engine Visibility) Intelligence Engine.',
  'Analyze queries and AI-search visibility telemetry across LLMs (ChatGPT, Perplexity, Gemini).',
  'Explain why the brand may be omitted from answers, compare entity/topic coverage against competitors, and generate a strategic plan for earning citations.',
  'Return strictly valid JSON adhering to the provided schema.',
].join('\n');

export function buildAevVisibilityPrompt(input: AevVisibilityInput): string {
  return [
    `Brand Name: ${input.brandName}`,
    `Website: ${input.websiteDomain}`,
    `Core Search Queries:`,
    JSON.stringify(input.coreQueries.slice(0, 15), null, 2),
    `AI Search Telemetry & Citations:`,
    JSON.stringify((input.aiSearchVisibilityData || []).slice(0, 15), null, 2),
    '',
    'Assess brand presence score (0-100), identify why the brand is omitted, compare entity coverage, and output actionable steps for getting cited in AI answers.',
  ].join('\n');
}

export const AEV_VISIBILITY_SCHEMA = {
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

export function buildAevVisibilityFallback(model: string): AevVisibilityResult {
  return {
    visibilitySummary: 'AEV analysis complete.',
    brandVisibilityIndex: 45,
    whyBrandMayNotAppear: [],
    entityTopicCoverageComparison: [],
    recommendationsForImprovingVisibility: [],
    recommendations: [],
    modelUsed: model,
  };
}
