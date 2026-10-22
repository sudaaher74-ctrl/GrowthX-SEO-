export type EvidenceClass = 'CONFIRMED' | 'OBSERVED' | 'INFERRED' | 'UNKNOWN';

export type RecommendationStats = {
  totalOpportunities: number;
  competitorsMentioned: number;
  highFitOpportunities: number;
  earnedBacklinks: number;
  estimatedTraffic: string;
};

export type RecommendationGap = {
  factor: string;
  competitorsHave: string;
  customerStatus: string;
  gap: string;
  category: 'CONTENT' | 'GEOGRAPHY' | 'PRICING' | 'REPUTATION' | 'PRODUCT' | 'CERTIFICATION';
  evidenceClass: EvidenceClass;
  priority: 'High' | 'Medium' | 'Low';
  recommendedAction: string;
};

export type ReadinessFactor = {
  label: string;
  score: number;
  maxScore: number;
  reason: string;
};

export type RecommendationReadiness = {
  score: number;
  state: 'READY' | 'PARTIAL' | 'INCOMPLETE' | 'MISMATCH';
  factors: ReadinessFactor[];
  summary: string;
};

export type ActionPlanItem = {
  step: number;
  title: string;
  detail: string;
  category: 'WEBSITE' | 'DOCUMENTATION' | 'PITCH' | 'CONTACT' | 'MONITORING';
  priority: 'High' | 'Medium' | 'Low';
  dependencies?: string[];
};

export type ExpectedOutcome = {
  potentialBacklink: string;
  estimatedMonthlyTraffic: string;
  domainAuthorityBoost: string;
};

export type PublisherOutreachState = {
  status: 'DISCOVERED' | 'ANALYZED' | 'QUALIFIED' | 'READY_FOR_REVIEW' | 'CONTACTED' | 'RESPONSE_PENDING' | 'FEATURED' | 'REJECTED' | 'CLOSED';
  approvedByUser: boolean;
  pitchDraft: string;
  contactChannel: string | null;
  contactedAt: string | null;
  outcome: string | null;
};

export type ArticleAnalysis = {
  version: string;
  title: string;
  wordCount: number;
  publishedAt: string | null;
  listicle: boolean;
  featured: Array<{
    name: string;
    host: string | null;
    url: string | null;
    kind: 'OWN' | 'COMPETITOR';
    role: 'LISTED' | 'MENTIONED';
    linked: boolean;
    rel: string[];
    position: number | null;
    passage: string;
    evidenceClass: EvidenceClass;
  }>;
  ownMentioned: boolean;
  ownLinked: boolean;
  criteria: Array<{ label: string; evidenceClass: EvidenceClass; passage: string }>;
  sponsorship: { state: 'DISCLOSED' | 'NOT_OBSERVED'; passage: string | null };
  limits: string[];
};

export type EnrichedRecommendationReport = {
  article: ArticleAnalysis;
  gaps: RecommendationGap[];
  readiness: RecommendationReadiness;
  actionPlan: ActionPlanItem[];
  expectedOutcome: ExpectedOutcome;
  outreach: PublisherOutreachState;
};

export type RecommendationLeads = {
  total: number;
  offset: number;
  pageSize: number;
  definitions: { candidate: string; ownLink: string };
  items: Array<{
    id: string;
    sourceUrl: string;
    sourceStatus: string;
    lastAttemptAt: string | null;
    competitorHosts: string[];
    ownLinkState: 'VERIFIED' | 'NOT_VERIFIED' | 'NONE_OBSERVED';
    analysis: null | {
      analyzedAt: string;
      title: string;
      listicle: boolean;
      featuredCount: number;
      ownMentioned: boolean;
      ownLinked: boolean;
      readinessScore: number | null;
      readinessState: string | null;
    };
  }>;
};

export type RecommendationDetail = {
  sourceUrl: string;
  analysis: EnrichedRecommendationReport | null;
  analyzedAt: string | null;
};

export type AnalyzeResponse =
  | { state: 'ANALYZED' | 'CACHED'; analysis: EnrichedRecommendationReport; analyzedAt: string }
  | { state: 'UNAVAILABLE'; reason: string };
