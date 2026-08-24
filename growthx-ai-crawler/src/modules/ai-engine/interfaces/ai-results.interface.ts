/**
 * 1. Market Research Result
 */
export interface MarketResearchResult {
  industryOverview: string;
  customerPainPoints: string[];
  customerPersonas: Array<{
    personaName: string;
    description: string;
    demographics: string;
    painPoints: string[];
    motivations: string[];
  }>;
  marketTrends: string[];
  swotAnalysis: {
    strengths: string[];
    weaknesses: string[];
    opportunities: string[];
    threats: string[];
  };
  businessOpportunities: string[];
  pricingSuggestions: Array<{
    strategy: string;
    details: string;
    targetSegment: string;
  }>;
  growthIdeas: string[];
}

/**
 * 2. Competitor Analysis Result
 */
export interface CompetitorAnalysisResult {
  competitorSummary: string;
  strengths: string[];
  weaknesses: string[];
  contentStrategyAnalysis: string;
  marketingStrategy: string;
  socialMediaStrategy: string;
  positioningAnalysis: string;
  actionableDifferentiators: string[];
}

/**
 * 3. SEO Analysis Result
 */
export interface SEOAnalysisResult {
  keywordSuggestions: Array<{
    keyword: string;
    intent: 'informational' | 'navigational' | 'commercial' | 'transactional' | string;
    volumeEstimate: string;
    difficulty: 'low' | 'medium' | 'high' | string;
  }>;
  keywordClustering: Array<{
    clusterName: string;
    keywords: string[];
    targetPageType: string;
  }>;
  blogTopicIdeas: Array<{
    title: string;
    targetKeyword: string;
    outline: string[];
    searchIntent: string;
  }>;
  metaTitleGeneration: Array<{
    pageType: string;
    title: string;
    charCount: number;
  }>;
  metaDescriptionGeneration: Array<{
    pageType: string;
    description: string;
    charCount: number;
  }>;
  faqGeneration: Array<{
    question: string;
    answer: string;
    schemaType: string;
  }>;
  internalLinkingSuggestions: Array<{
    sourceTopic: string;
    targetTopic: string;
    anchorText: string;
    rationale: string;
  }>;
  localSeoSuggestions: Array<{
    tactic: string;
    description: string;
    priority: 'high' | 'medium' | 'low' | string;
  }>;
  contentGapAnalysis: Array<{
    missingTopic: string;
    competitorFocus: string;
    recommendedAction: string;
  }>;
}

/**
 * 4. Content Strategy Result
 */
export interface ContentStrategyResult {
  monthlyContentCalendar: Array<{
    week: number;
    day: string;
    topic: string;
    format: string;
    channel: string;
    goal: string;
  }>;
  instagramStrategy: {
    contentPillars: string[];
    formatMix: string[];
    postingFrequency: string;
  };
  facebookStrategy: {
    contentPillars: string[];
    communityTactics: string[];
  };
  linkedinStrategy: {
    thoughtLeadershipThemes: string[];
    b2bTactics: string[];
  };
  youtubeStrategy: {
    videoSeriesIdeas: string[];
    searchOptimizedThemes: string[];
  };
  reelsIdeas: Array<{
    hook: string;
    visualConcept: string;
    cta: string;
  }>;
  shortsIdeas: Array<{
    hook: string;
    scriptOutline: string;
    cta: string;
  }>;
  carouselIdeas: Array<{
    title: string;
    slides: string[];
    ctaSlide: string;
  }>;
  captionGeneration: Array<{
    topic: string;
    captionText: string;
    tone: string;
  }>;
  ctaGeneration: Array<{
    funnelStage: string;
    ctaText: string;
    targetAction: string;
  }>;
  hookGeneration: Array<{
    angle: string;
    hookLine: string;
  }>;
  hashtagSuggestions: Array<{
    category: string;
    hashtags: string[];
  }>;
}

/**
 * 5. Keyword Research Result
 */
export interface KeywordResearchResult {
  primaryKeywords: Array<{
    keyword: string;
    searchIntent: string;
    estimatedVolume: string;
    estimatedDifficulty: string;
  }>;
  longTailKeywords: string[];
  keywordClusters: Array<{
    clusterName: string;
    keywords: string[];
    contentAngle: string;
  }>;
  localizedKeywords: Array<{
    regionOrCity: string;
    keywords: string[];
  }>;
  searchIntentBreakdown: {
    informational: string[];
    commercial: string[];
    transactional: string[];
    navigational: string[];
  };
}

/**
 * 6. Business Insights Result
 */
export interface BusinessInsightsResult {
  marketingRecommendations: string[];
  brandPositioning: {
    currentPerception: string;
    desiredPositioning: string;
    valueDifferentiators: string[];
  };
  audienceSegmentation: Array<{
    segmentName: string;
    profile: string;
    messagingStrategy: string;
    primaryChannel: string;
  }>;
  growthStrategy: Array<{
    horizon: string;
    initiatives: string[];
    expectedKpiImpact: string;
  }>;
  salesSuggestions: Array<{
    tactic: string;
    rationale: string;
    targetStage: string;
  }>;
}

/**
 * 7. Social Strategy Result
 */
export interface SocialStrategyResult {
  executiveSummary: string;
  platformStrategies: Array<{
    platform: string;
    objective: string;
    contentFormats: string[];
    weeklyFrequency: string;
    bestTimesToPost: string;
  }>;
  reelsAndShorts: Array<{
    concept: string;
    hook: string;
    audioVibe: string;
    cta: string;
  }>;
  carousels: Array<{
    topic: string;
    slideOutlines: string[];
    engagementTrigger: string;
  }>;
  highConvertingHooks: string[];
  hashtagVault: Array<{
    niche: string;
    tags: string[];
  }>;
  callToActionBank: Array<{
    goal: string;
    phrases: string[];
  }>;
}

/**
 * 8. Marketing Strategy Result
 */
export interface MarketingStrategyResult {
  executiveSummary: string;
  brandPositioningStatement: string;
  targetPersonas: string[];
  acquisitionChannels: Array<{
    channel: string;
    strategy: string;
    priority: string;
    budgetShareEstimate: string;
  }>;
  conversionTactics: Array<{
    funnelStage: string;
    tactics: string[];
    keyMetrics: string;
  }>;
  growthRoadmap: Array<{
    phase: string;
    duration: string;
    milestones: string[];
  }>;
  budgetSuggestions: Array<{
    category: string;
    percentage: number;
    rationale: string;
  }>;
}
