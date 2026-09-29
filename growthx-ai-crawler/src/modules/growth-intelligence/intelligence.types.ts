/**
 * The shapes the intelligence layer reads and writes.
 *
 * Every claim GrowthX makes carries the evidence it rests on. `Evidence` is
 * therefore the unit everything else points at: a finding lists the ids of the
 * evidence behind it, and a recommendation inherits them. Nothing in a
 * conclusion may be stated that is not traceable to one of these.
 */

export type EvidenceSource = 'CRAWL' | 'GSC' | 'GA4' | 'GBP' | 'COMPETITORS' | 'AI_VISIBILITY';

export interface Evidence {
  id: string;
  source: EvidenceSource;
  /** One plain sentence stating the observation, with its figures. */
  text: string;
  /** The raw figures behind the sentence, for display and for audit. */
  data?: Record<string, string | number | boolean | null>;
}

export type FindingCategory = 'PROBLEM' | 'OPPORTUNITY' | 'RISK';
export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type Confidence = 'HIGH' | 'MEDIUM' | 'LOW';

export interface Finding {
  id: string;
  type: string;
  category: FindingCategory;
  severity: Severity;
  /** The page it concerns, or null for a site-wide finding. */
  url: string | null;
  /** WHAT: the observation. */
  what: string;
  /** WHY IT MATTERS. */
  why: string;
  evidenceIds: string[];
  /** ACTION: what to do. */
  action: string;
  /** EXPECTED IMPACT, with how it was estimated. Null when it cannot be quantified honestly. */
  expectedImpact: string | null;
  /** MEASUREMENT: what to compare before and after. */
  measurement: string[];
  /**
   * Estimated extra clicks over the analysed window if the finding is fixed.
   * Null when the finding has no click estimate — never a placeholder zero.
   */
  potentialClicks: number | null;
  /** Set when a crawl issue already has an AI fix behind it. */
  fixIssueId?: string | null;
}

export interface PageDiagnosis {
  url: string;
  path: string;
  headline: string;
  evidence: Evidence[];
  findings: Finding[];
  /** One conclusion, built only from the findings above. Null when nothing is wrong that the data can show. */
  conclusion: string | null;
  confidence: Confidence;
  /** How many independent sources back the findings. */
  corroboratingSources: EvidenceSource[];
  priority: { potentialClicks: number; reason: string };
  /** Sources with nothing to say about this page, and why. */
  notMeasured: { source: EvidenceSource; reason: string }[];
}

export interface SearchQueryFact {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface CompetitorRankFact {
  keyword: string;
  competitor: string;
  competitorPosition: number;
  competitorUrl: string | null;
  ownPosition: number | null;
}

export interface CrawlIssueFact {
  id: string;
  type: string;
  severity: Severity;
  description: string;
  recommendation: string;
  evidence: string | null;
  aiFixAvailable: boolean;
}

export interface PageFacts {
  url: string;
  path: string;
  search: { clicks: number; impressions: number; ctr: number; position: number; queries: SearchQueryFact[] } | null;
  analytics: { sessions: number; engagementRate: number | null; conversions: number | null } | null;
  crawl: {
    title: string | null;
    metaDescription: string | null;
    h1Count: number;
    wordCount: number;
    pageType: string;
    indexability: string;
    inboundLinks: number;
    schemaTypes: string[];
    issues: CrawlIssueFact[];
  } | null;
  /** Null when no competitor keyword data exists at all. */
  competitors: CompetitorRankFact[] | null;
  /** Null when AI visibility has never been measured. */
  ai: { checks: number; citedChecks: number; citedThisPage: number; competitorsCited: string[] } | null;
}

export interface SiteFacts {
  /** Site-wide GA4 engagement rate, 0-1; null when GA4 is not connected. */
  engagementRate: number | null;
  conversionTracking: boolean;
  sources: Record<EvidenceSource, { connected: boolean; note: string | null }>;
}

/** Period-over-period movement, from two real stored windows. */
export interface Movement {
  current: number;
  previous: number | null;
  changePct: number | null;
}

export interface SiteTrends {
  searchClicks: Movement | null;
  conversions: Movement | null;
  gbpWebsiteClicks: Movement | null;
  gbpCalls: Movement | null;
  aiCitationRatePct: Movement | null;
  /** Local-profile website clicks and the landing page GA4 saw them arrive on. */
  gbpLanding: { websiteClicks: number; path: string; engagementRate: number | null; conversions: number | null } | null;
}
