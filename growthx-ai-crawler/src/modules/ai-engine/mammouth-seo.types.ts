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
export interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}
