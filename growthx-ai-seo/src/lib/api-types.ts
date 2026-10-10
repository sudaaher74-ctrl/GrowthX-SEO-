/**
 * Response and request shapes for the Reigel API, split out of api-client.ts.
 * api-client re-exports everything here, so imports from it keep working.
 */

import type { CrawlSummary } from "./crawl-summary";

// ──────────────────────────────────────────────────────────────── types

export type Role = "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";

export interface OrgMember {
  id: string;
  role: Role;
  joinedAt: string;
  userId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
}

export interface UserProfile {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  googleId: string | null;
  businessDetails?: string | null;
}

/** Tokens spent on one feature since the current month began, net of refunds. */
export interface TokenUsageLine {
  action: string;
  tokens: number;
  /** Tokens the feature needed beyond what the workspace held. */
  shortfall: number;
  count: number;
}

export interface TokenRates {
  /** Tokens charged per piece of text the AI reads / writes. */
  ai: { inputWeight: number; outputWeight: number };
  actions: { action: string; tokensPerUnit: number; unit: string }[];
}

/**
 * A workspace's tokens. `enabled: false` means the deployment has tokens
 * switched off, so there is nothing to show and nothing is limited.
 */
export type TokensOverview =
  | { enabled: false; mode: "off" }
  | {
      enabled: true;
      /** `shadow` counts usage but never blocks anything. */
      mode: "enforce" | "shadow";
      organizationId: string;
      /** Everything spendable now: the monthly allowance left plus bonus tokens. */
      available: number;
      bonus: number;
      allowance: {
        remaining: number;
        /** What this month's allowance was when it was granted: the "of" in "remaining of granted". */
        granted: number;
        /** What the next month will grant; differs from `granted` if the figure was changed mid-month. */
        monthly: number;
        periodStart: string;
        periodEnd: string;
      };
      usage: { since: string; totalTokens: number; lines: TokenUsageLine[] };
      rates: TokenRates;
    };

export type TokenTransactionKind = "ALLOWANCE" | "EXPIRY" | "GRANT" | "ADJUSTMENT" | "SPEND" | "REFUND";

export interface TokenTransaction {
  id: string;
  kind: TokenTransactionKind;
  action: string;
  /** Net change to the balance: negative when tokens were used. */
  tokens: number;
  /** Tokens the work needed beyond what the workspace held. */
  shortfall: number;
  balanceAfter: number;
  projectId: string | null;
  createdAt: string;
  /** For spends and refunds: what was done (model, token counts, grid size...). */
  detail: Record<string, unknown> | null;
}

export interface TokenTransactionPage {
  items: TokenTransaction[];
  nextCursor: string | null;
}

export interface VisibilityReport {
  periodStart: string;
  periodEnd: string;
  summary: {
    checked: number;
    cited: number;
    citationSharePct: number;
    averagePosition: number | null;
    previousCitationSharePct: number | null;
    deltaPt: number | null;
    failedChecks: number;
  };
  byAssistant: { assistant: string; checked: number; cited: number; citationSharePct: number }[];
  shareOfVoice: { domain: string | null; label: string; mentions: number; sharePct: number }[];
  trend: { weekStart: string; checked: number; citationSharePct: number }[];
  measurableAssistants: string[];
  /** Questions that name the brand. Reported apart; never part of citation share. */
  reputation?: { checked: number; cited: number };
  brandPerception?: { positive: number; neutral: number; negative: number; total: number };
  customerJourney?: {
    discovery: { checked: number; cited: number; citationSharePct: number };
    recommendation: { checked: number; cited: number; citationSharePct: number };
  };
}

export type InsightLevel = "HIGH" | "MEDIUM" | "LOW";

/** AI-written analysis of measured citation data. Never generated before a sweep. */
export interface VisibilityInsights {
  projectId: string;
  status: "READY" | "NO_DATA";
  generatedAt: string;
  model: string | null;
  question: string | null;
  basedOn: {
    periodDays: number;
    checks: number;
    cited: number;
    failedChecks: number;
    prompts: number;
    competitors: number;
    crawlIssues: number;
  };
  summary: string | null;
  answer: string | null;
  findings: { title: string; detail: string; evidence: string }[];
  recommendations: {
    title: string;
    category: "CONTENT" | "TECHNICAL" | "AUTHORITY" | "ON_PAGE";
    priority: InsightLevel;
    effort: InsightLevel;
    rationale: string;
    evidence: string;
  }[];
}

export type QuestionGroup = "BUYER" | "REPUTATION";

export interface PageSignals {
  directAnswer: boolean;
  directAnswerText: string | null;
  faq: boolean;
  faqSource: "SCHEMA" | "HEADINGS" | null;
  schemaTypes: string[];
  termCoverage: number;
  missingTerms: string[];
  wordCount: number;
  htmlAvailable: boolean;
}

/** One tracked question joined to the Website Audit and Competitor Intelligence. */
export interface QuestionAnalysis {
  id: string;
  text: string;
  cluster: string | null;
  group: QuestionGroup;
  outcome: "NOT_MEASURED" | "FAILED" | "CITED" | "NOT_CITED";
  answer: {
    assistant: string;
    model: string | null;
    checkedAt: string;
    cited: boolean;
    position: number | null;
    competitorsCited: string[];
    answerExcerpt: string | null;
  } | null;
  failure: string | null;
  verdict: "CONTENT_GAP" | "PAGE_HAS_ISSUES" | "PAGE_FOUND" | "NOT_APPLICABLE";
  ownPage: {
    url: string;
    title: string | null;
    matchScore: number;
    signals: PageSignals;
    issues: { issueType: string; severity: string; description: string }[];
  } | null;
  rivals: {
    domain: string;
    label: string;
    crawled: boolean;
    page: { url: string; title: string | null; matchScore: number; signals: PageSignals } | null;
  }[];
  comparison: {
    signal: "DIRECT_ANSWER" | "FAQ" | "SCHEMA" | "TERM_COVERAGE";
    label: string;
    you: string;
    rival: string;
    rivalDomain: string;
    rivalAhead: boolean;
  }[];
}

export interface QuestionAnalysisReport {
  projectId: string;
  auditAvailable: boolean;
  auditedPages: number;
  competitorsTracked: number;
  competitorsCrawled: number;
  questions: QuestionAnalysis[];
}

export interface QuestionSuggestion {
  text: string;
  source: "OWN_PAGE" | "RIVAL_PAGE" | "CONTENT_GAP";
  evidenceUrl: string | null;
  evidence: string;
  competitorDomain: string | null;
}

export interface TrackedPromptRow {
  id: string;
  text: string;
  group?: QuestionGroup;
  intent: string | null;
  cluster: string | null;
  estimatedVolume: number | null;
  isActive: boolean;
  latestChecks: {
    assistant: string;
    checkedAt: string;
    cited: boolean;
    position: number | null;
    citedUrl: string | null;
    competitorsCited: string[];
    error: string | null;
    model: string | null;
    answerExcerpt: string | null;
  }[];
}

export interface PortfolioClient {
  projectId: string;
  name: string;
  domain: string | null;
  initials: string;
  tier: string | null;
  retainerMonthlyMinor: number | null;
  retainerCurrency: string;
  /** Null means unmeasured — never render it as 0%. */
  aiCitationSharePct: number | null;
  aiDeltaPt: number | null;
  health: number | null;
  trackedPrompts: number;
  averagePosition: number | null;
  criticalIssues: number;
  trend: number[];
  lastCrawledAt: string | null;
}

export interface PortfolioResponse {
  clients: PortfolioClient[];
  summary: {
    portfolioAiSharePct: number | null;
    portfolioAiDeltaPt: number | null;
    promptsTracked: number;
    clientsImproving: number;
    clientsDeclining: number;
    clientCount: number;
    openCriticals: number;
    mrrMinor: number;
    mrrCurrency: string;
    clientsWithoutRetainer: number;
  };
  alerts: {
    projectId: string;
    title: string;
    detail: string;
    tag: 'AI' | 'CRAWL' | 'SETUP';
    severity: 'critical' | 'warning' | 'info';
  }[];
}

export interface CrawlJob {
  id: string;
  status: string;
  pagesCrawled: number;
  issuesFound: number;
  healthScore?: number | null;
  uniqueIssuesCount?: number;
  resolvedIssuesCount?: number;
  qualityDiagnostics?: CrawlQualityDiagnostics | null;
  startedAt: string | null;
  finishedAt: string | null;
  website?: { domain: string; url: string };
  /**
   * Set when the newest attempt failed and this (older, successful) crawl is
   * returned instead, so the screen can say the re-audit did not finish.
   */
  latestAttempt?: {
    id: string;
    status: string;
    errorMessage: string | null;
    startedAt: string | null;
    finishedAt: string | null;
  } | null;
  /** While this crawl is PENDING/RUNNING: the last completed crawl's figures, to show meanwhile. */
  lastCompleted?: {
    id: string;
    pagesCrawled: number;
    issuesFound: number;
    healthScore: number | null;
    finishedAt: string | null;
  } | null;
}

/** One completed crawl, for trend lines. Only finished runs are returned. */
export interface CrawlHistoryPoint {
  id: string;
  pagesCrawled: number;
  issuesFound: number;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface CrawlPage {
  id: string;
  url: string;
  statusCode: number;
  title: string | null;
  wordCount: number;
  readingTimeMin: number;
  crawledAt: string;
  // The pages endpoint does a `findMany` with no `select`, so every Page
  // column comes back. These were missing here, which is what pushed the
  // split-crawl inspector onto `any`.
  h1: string[];
  h2: string[];
  pageType: string;
  metaDescription: string | null;
  canonicalUrl: string | null;
  responseTimeMs: number;
  performance?: CrawlPerformance | null;
  /// Computed by the crawler from robots.txt, meta robots, X-Robots-Tag and
  /// the canonical - never from the status code. UNKNOWN is a real answer and
  /// must render grey, not red.
  indexability?: "INDEXABLE" | "NOT_INDEXABLE" | "UNKNOWN" | null;
  indexabilityReason?: Array<{ code: string; evidence: string }> | null;
  /// True when this page's content exists only after JavaScript runs.
  jsRequired?: boolean | null;
  /// sitemap | link | bundle | seed | robots
  discoverySource?: string | null;
  /// The origin answered with a challenge a browser would not get. Distinct
  /// from an error: it is a suspicion carrying evidence, not a recorded status.
  blockedSuspected?: boolean | null;
  /// Every redirect hop, not just the endpoints.
  statusChain?: Array<{ url: string; status: number; location?: string }> | null;
}

export interface CrawlPerformance {
  id: string;
  performanceScore: number | null;
  lcpMs: number | null;
  inpMs: number | null;
  clsScore: number | null;
}

export interface CrawlIssue {
  id: string;
  issueType: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  affectedUrl: string;
  description: string;
  recommendation: string;
  status: string;
  aiFixAvailable: boolean;
  confidence?: "CONFIRMED" | "LIKELY" | "ADVISORY";
  impact?: string | null;
  explanation?: string | null;
  evidence?: string | null;
  dedupKey?: string | null;
  category?: string | null;
  page?: { url: string; pageType?: string; statusCode?: number } | null;
}

export interface ContentPiece {
  id: string;
  title: string;
  slug: string;
  format: string | null;
  targetQuery: string | null;
  rationale: string | null;
  status: "PLANNED" | "DRAFTED" | "COMMITTED" | "PUBLISHED" | "REJECTED";
  filePath: string | null;
  generatedByModel: string | null;
  metaDescription: string | null;
  body?: string | null;
  createdAt: string;
}

/** A metric with its change against the period before, or null when there is none. */
export interface GscMetric {
  current: number;
  previous: number | null;
  /** Null when the earlier period predates the synced data — never a made-up zero. */
  change: number | null;
  changePct: number | null;
  /** Set on average position, where a smaller number is an improvement. */
  lowerIsBetter?: boolean;
}

export interface GscSummary {
  range: { start: string; end: string };
  comparisonRange: { start: string; end: string } | null;
  clicks: GscMetric;
  impressions: GscMetric;
  ctr: GscMetric;
  position: GscMetric;
  daysWithData: number;
}

export interface GscPoint {
  date: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface GscRow {
  key: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface GscStrikingDistanceRow extends GscRow {
  /** The thresholds this row was selected by, so the judgement is visible. */
  criteria: { minPosition: number; maxPosition: number; minImpressions: number; days: number };
}

export interface GscCtrOpportunity extends GscRow {
  expectedCtr: number;
  shortfall: number;
  estimatedMissedClicks: number;
}

export interface GscDecliningRow {
  query: string;
  previousPosition: number;
  currentPosition: number;
  positionChange: number;
  previousClicks: number;
  currentClicks: number;
  impressions: number;
}

export interface GoogleProviderStatus {
  id: "search_console" | "analytics" | "business_profile";
  label: string;
  /** Google gates this API behind its own approval; a Connect button would 403. */
  requiresGoogleApproval: boolean;
  selectionLabel: string;
  status: "NOT_CONNECTED" | "NEEDS_SELECTION" | "CONNECTED" | "NEEDS_REAUTH" | "ERROR" | "DISCONNECTED";
  statusMessage: string | null;
  selectedResourceId: string | null;
  selectedResourceName: string | null;
  googleAccountEmail: string | null;
  lastSyncedAt: string | null;
  nextSyncAt: string | null;
}

export interface GoogleConnectionStatus {
  /** Whether this deployment has Google credentials at all. */
  configuration: { configured: boolean };
  providers: GoogleProviderStatus[];
}

/** One thing the evidence for an opportunity rests on. */
export interface OpportunityEvidence {
  label: string;
  value: string;
  /** Which system said so. Never blank — a claim with no source is a guess. */
  source: string;
}

export interface GrowthOpportunity {
  id: string;
  projectId?: string;
  fingerprint?: string;
  source: "SEARCH_CONSOLE" | "COMPETITOR" | "WEBSITE" | "ANALYTICS" | "LOCAL" | "MARKET";
  category: "SEO" | "CONTENT" | "LOCAL" | "TECHNICAL" | "MARKETING" | "BUSINESS" | "COMPETITOR";
  title: string;
  summary: string;
  evidence: OpportunityEvidence[];
  recommendedAction: string;
  /** A band, never a currency figure — see the detection service. */
  potential: "HIGH" | "MEDIUM" | "LOW";
  effort: "HIGH" | "MEDIUM" | "LOW";
  confidence: number;
  priority: number;
  affectedPages: string[];
  status: "OPEN" | "ACTIONED" | "DISMISSED" | "RESOLVED";
  lifecycle?:
    | "DETECTED"
    | "QUEUED"
    | "SNOOZED"
    | "DISMISSED"
    | "APPROVED"
    | "APPLYING"
    | "VERIFYING"
    | "VERIFIED"
    | "MEASURED"
    | "FAILED"
    | "RESOLVED";
  snoozeUntil?: string | null;
  dismissReason?: string | null;
  lastTransitionAt?: string;
  transitions?: Array<{ from: string; to: string; at: string; actor: { type: string; id?: string }; reason?: string | null }>;
  fixClass?: "AUTO" | "APPROVAL" | "MANUAL";
  impact?: number;
  detailType?: string | null;
  detailRef?: string | null;
  affectedCount?: number;
  detectedAt: string;
  lastSeenAt: string;
}

export interface FindingListResponse {
  items: GrowthOpportunity[];
  nextCursor: string | null;
  counts: {
    bySource: Record<string, number>;
    byFixClass: Record<string, number>;
    total: number;
  };
}

export interface OpportunityList {
  total: number;
  byCategory: Record<string, number>;
  opportunities: GrowthOpportunity[];
}

export interface Ga4Metric {
  current: number;
  previous: number | null;
  change: number | null;
  changePct: number | null;
}

export interface Ga4Summary {
  range: { start: string; end: string };
  comparisonRange: { start: string; end: string } | null;
  users: Ga4Metric;
  sessions: Ga4Metric;
  engagementRate: Ga4Metric;
  /** Null when the property has no key events configured — never a zero. */
  conversions: Ga4Metric | null;
  revenue: Ga4Metric | null;
  conversionTrackingConfigured: boolean;
  revenueTrackingConfigured: boolean;
  daysWithData: number;
}

export interface Ga4Point {
  date: string;
  users: number;
  sessions: number;
  engagementRate: number;
  conversions: number | null;
  revenue: number | null;
}

export type Ga4RangeKey = "7d" | "28d" | "90d";

export interface Ga4ReportTotals {
  sessions: number;
  activeUsers: number;
  newUsers: number;
  engagedSessions: number;
  /** 0-1. */
  engagementRate: number;
  /** Seconds per active user. */
  averageEngagementTimeSec: number;
  views: number;
  /** Null when the property has no key events reporting — never zero. */
  keyEvents: number | null;
}

export interface Ga4ReportData {
  startDate: string;
  endDate: string;
  empty: boolean;
  totals: Ga4ReportTotals;
  daily: { date: string; sessions: number; users: number; newUsers?: number; returningUsers?: number }[];
  landingPages: { page: string; sessions: number; engagementRate: number; keyEvents: number | null }[];
  /** Engagement and key events are absent from snapshots stored before they were fetched per channel; the next refresh adds them. */
  channels: { channel: string; sessions: number; users: number; organic: boolean; engagementRate?: number; keyEvents?: number | null }[];
  organicSearchSessions: number;
  countries: { country: string; sessions: number; users: number }[];
  /** Where visits came from, by source and medium. Absent until the first refresh after sources were added. */
  sources?: { source: string; medium: string; channel: string; sessions: number; users: number; engagementRate: number; keyEvents: number | null }[];
  /** Absent until the first refresh after cities were added. */
  cities?: { city: string; country: string; sessions: number; users: number }[];
}

/** One GA4 window for the workspace, or the reason there is none. */
export interface Ga4Report {
  state: "NOT_CONNECTED" | "NEEDS_SELECTION" | "NEEDS_REAUTH" | "ERROR" | "NEVER_SYNCED" | "EMPTY" | "READY";
  message: string | null;
  range: Ga4RangeKey;
  propertyName: string | null;
  googleAccountEmail: string | null;
  lastSyncedAt: string | null;
  /** A refresh that failed after the data shown was fetched. */
  lastError: string | null;
  data: Ga4ReportData | null;
}

/** A page with its search performance and its business outcome side by side. */
export interface PageValueRow {
  page: string;
  clicks: number;
  impressions: number;
  position: number;
  /** Null when the page has no GA4 landing-page row — it ranked but was never landed on. */
  sessions: number | null;
  conversions: number | null;
  revenue: number | null;
  conversionRate: number | null;
}

export interface PageValue {
  rows: PageValueRow[];
  hasSearchData: boolean;
  hasAnalyticsData: boolean;
}

// ── Google section ─────────────────────────────────────────────────────────

export type GoogleSource = "GSC" | "GA4" | "Reigel";

export interface GoogleSourceStatus {
  connected: boolean;
  /** NOT_CONNECTED | NEEDS_SELECTION | NEEDS_REAUTH | ERROR | NEVER_SYNCED | EMPTY | READY */
  state: string;
  message: string | null;
  lastSyncedAt: string | null;
  hasData: boolean;
  propertyName: string | null;
  accountEmail: string | null;
}

export interface GoogleKpi {
  key: string;
  label: string;
  source: "GSC" | "GA4";
  format: "count" | "percent" | "position" | "currency";
  /** Null when not measured; `note` says why. */
  value: number | null;
  previous: number | null;
  delta: { kind: "pct" | "pts" | "places"; value: number } | null;
  lowerIsBetter: boolean;
  /** Real daily values, or null where none are stored. */
  sparkline: number[] | null;
  note: string | null;
}

export interface GoogleFunnelStage {
  key: "impressions" | "clicks" | "sessions" | "engaged" | "keyEvents" | "revenue";
  label: string;
  source: GoogleSource;
  value: number | null;
  rate: number | null;
  rateLabel: string | null;
  note: string | null;
}

export interface GoogleEvidence {
  label: string;
  value: string;
  source: GoogleSource;
}

export interface GoogleHeadline {
  id: string;
  tone: "good" | "bad" | "warn" | "neutral";
  text: string;
  evidence: GoogleEvidence[];
  links: { label: string; view: string; segment?: string }[];
  confidence: "HIGH" | "MEDIUM" | "LOW";
  source: GoogleSource | "GSC+GA4";
}

export interface GoogleOverview {
  days: 7 | 28 | 90;
  sources: {
    searchConsole: GoogleSourceStatus;
    analytics: GoogleSourceStatus & { needsRefresh: boolean };
    crawler: { lastCrawledAt: string | null };
  };
  windows: {
    search: { start: string; end: string; comparison: { start: string; end: string } | null } | null;
    analytics: { start: string; end: string; comparison: { start: string; end: string } | null } | null;
  };
  kpis: GoogleKpi[];
  series: {
    search: { date: string; clicks: number; impressions: number; ctr: number; position: number }[];
    organic: { date: string; sessions: number; users: number; keyEvents: number | null; revenue: number | null }[];
  };
  funnel: GoogleFunnelStage[];
  headlines: GoogleHeadline[];
}

export type GooglePageSegment =
  | "top-traffic"
  | "top-impressions"
  | "top-converting"
  | "declining"
  | "growing"
  | "high-impressions-low-ctr"
  | "high-traffic-low-conversion"
  | "low-traffic-high-conversion"
  | "ranking-opportunity"
  | "technical-risk";

export interface GooglePageRow {
  key: string;
  url: string;
  gsc: {
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
    previousClicks: number | null;
    previousImpressions: number | null;
    clicksChangePct: number | null;
  } | null;
  ga: {
    users: number;
    sessions: number;
    engagementRate: number;
    averageEngagementTimeSec: number;
    keyEvents: number | null;
    revenue: number | null;
  } | null;
  technicalRisk: string | null;
  segments: GooglePageSegment[];
  trend: number[];
}

export interface GooglePages {
  days: 7 | 28 | 90;
  windows: {
    search: { start: string; end: string; comparison: { start: string; end: string } | null };
    analytics: { start: string; end: string } | null;
  } | null;
  sources: {
    searchConsole: { hasData: boolean };
    analytics: { state: string; message: string | null; hasOrganic: boolean; needsRefresh: boolean; conversionsMeasured: boolean };
  };
  criteria: Partial<Record<GooglePageSegment, string>>;
  segmentCounts: Record<GooglePageSegment, number>;
  total: number;
  rows: GooglePageRow[];
}

export interface GoogleKeywordMovement {
  days: 7 | 28 | 90;
  range: { start: string; end: string };
  comparisonRange: { start: string; end: string } | null;
  /** Null when no earlier period is stored, so nothing can be called new or rising. */
  new: { query: string; clicks: number; impressions: number; position: number }[] | null;
  rising:
    | {
        query: string;
        clicks: number;
        previousClicks: number;
        clicksChange: number;
        clicksChangePct: number | null;
        position: number;
        previousPosition: number;
        movement: number;
      }[]
    | null;
  /** Null when the query-by-page data has not been fetched. */
  cannibalization:
    | {
        query: string;
        impressions: number;
        clicks: number;
        pages: { page: string; clicks: number; impressions: number; position: number; share: number }[];
      }[]
    | null;
  rules: {
    minImpressions: number;
    risingMinExtraClicks: number;
    risingMinPct: number;
    risingMinPlaces: number;
    cannibalMinQueryImpressions: number;
    cannibalMinPageShare: number;
  };
}

export interface GoogleBreakdown {
  days: 7 | 28 | 90;
  dimension: "country" | "device";
  range: { start: string; end: string } | null;
  /** Null when nothing is stored yet; one refresh fetches it. */
  rows: GscRow[] | null;
}

/** Mirrors the backend's GoogleReport: the Sarvam improvement report on Search Console and Analytics 4. */
export type GoogleReportLevel = "high" | "medium" | "low";
export interface GoogleReportPriority {
  rank: number;
  title: string;
  platform: "GSC" | "GA4" | "BOTH";
  priority: GoogleReportLevel;
  effort: GoogleReportLevel;
  impact: GoogleReportLevel;
  evidence: string;
  whyItMatters: string;
  steps: string[];
  measureBy: string;
}
interface GoogleReportRow {
  key: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  extra?: string;
}
export interface GoogleReportFacts {
  days: number;
  site: string | null;
  searchConsole: { connected: boolean; hasData: boolean; lastSyncedAt: string | null; propertyName: string | null };
  analytics: { connected: boolean; hasData: boolean; lastSyncedAt: string | null; propertyName: string | null };
  kpis: { label: string; source: "GSC" | "GA4"; format: string; value: number | null; previous: number | null; change: string | null; note: string | null }[];
  topQueries: GoogleReportRow[];
  topPages: GoogleReportRow[];
  strikingDistance: GoogleReportRow[];
  ctrOpportunities: GoogleReportRow[];
  notMeasured: string[];
}
export interface GoogleReport {
  generatedAt: string;
  facts: GoogleReportFacts;
  analysis: {
    executiveSummary: string;
    whereWeAre: {
      searchConsole: { verdict: string; points: string[] };
      analytics: { verdict: string; points: string[] };
    };
    priorities: GoogleReportPriority[];
    quickWins: string[];
    /** Absent on reports written before the marketing strategy was added. */
    marketingStrategy?: {
      summary: string;
      whereTrafficComesFrom: string[];
      channels: { channel: string; verdict: "grow" | "fix" | "start" | "maintain"; share: string; whatWeSee: string; strategy: string; actions: string[] }[];
      audience: string[];
    };
    plan: { week: string; actions: string[] }[];
    dataGaps: string[];
  } | null;
  model: string | null;
  analysisError: string | null;
  snapshotId?: string | null;
}

export interface GoogleAlertsReport {
  days: 7 | 28 | 90;
  comparable: boolean;
  alerts: {
    id: string;
    direction: "BAD" | "GOOD";
    severity: "HIGH" | "MEDIUM";
    title: string;
    detail: string;
    source: GoogleSource;
    view: string;
    segment?: string;
  }[];
  rules: { alertPct: number; minPrevious: number; ctrPoints: number; positionPlaces: number; pageDropPct: number; pageDropMinClicks: number };
}

export interface GoogleDiagnosisFinding {
  id: string;
  tone: "good" | "bad" | "warn" | "neutral";
  text: string;
  evidence: GoogleEvidence[];
  action: string;
  source: GoogleSource | "GSC+GA4";
  confidence: "HIGH" | "MEDIUM" | "LOW";
}

export interface GooglePageDetail {
  days: 7 | 28 | 90;
  key: string;
  url: string;
  found: boolean;
  gsc: NonNullable<GooglePageRow["gsc"]> | null;
  ga: {
    users: number;
    sessions: number;
    engagedSessions: number;
    views: number;
    engagementRate: number;
    averageEngagementTimeSec: number;
    keyEvents: number | null;
    revenue: number | null;
  } | null;
  queries: { query: string; clicks: number; impressions: number; ctr: number; position: number }[];
  history: { date: string; clicks: number; impressions: number; ctr: number; position: number }[];
  funnel: GoogleFunnelStage[];
  index: {
    verdict: string | null;
    coverageState: string | null;
    lastCrawlTime: string | null;
    googleCanonical: string | null;
    inspectedAt: string;
    error: string | null;
    meaning: string | null;
    action: string | null;
  } | null;
  crawl: {
    url: string;
    crawledAt: string;
    statusCode: number;
    responseTimeMs: number;
    title: string | null;
    metaDescription: string | null;
    canonicalUrl: string | null;
    h1Count: number;
    wordCount: number;
    indexability: string;
    jsRequired: boolean;
    schemas: { type: string; valid: boolean }[];
    performance: { performanceScore: number | null; lcpMs: number | null; clsScore: number | null; inpMs: number | null } | null;
    internalLinksIn: number;
    internalLinksOut: number;
    openIssues: { severity: string; issueType: string; description: string }[];
  } | null;
  diagnosis: GoogleDiagnosisFinding[];
  windows: { analytics: { start: string; end: string } | null };
}

/**
 * One measurement, or an honest reason there is none.
 *
 * A union rather than `number | null` on purpose: "not connected", "connected
 * but never synced" and "connected, synced, and not being measured" need three
 * different things said to the customer, and a nullable number can only say
 * one.
 */
export type Measure =
  | { state: "MEASURED"; value: number; changePct: number | null; source: string }
  | { state: "NOT_CONNECTED"; connect: string; reason: string }
  | { state: "NO_DATA"; reason: string };

export interface SiteHealth {
  state: "MEASURED";
  pagesCrawled: number;
  criticalIssues: number;
  totalIssues: number;
  // These three are returned by executive-summary.service.ts but were missing
  // here, which is why the reports page reached for them through `as any`.
  uniqueIssuesCount?: number;
  resolvedIssuesCount?: number;
  healthScore?: number | null;
  crawledAt: string | null;
  source: string;
}

/**
 * The website audit's findings, counted once.
 *
 * Every screen showing how many things are wrong reads this. The dashboard,
 * the audit and the Fix Engine each used to count for themselves, which is how
 * one crawl came to read as 100, 156 and 100 at once.
 */
export type IssueSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
export type FixClass = "AUTO" | "APPROVAL" | "MANUAL";

export interface IssueCounts {
  /** Distinct findings still open. The headline number. */
  openFindings: number;
  /** Distinct problems with at least one open finding. The queue's length. */
  openGroups: number;
  /** Sums to openFindings, always. */
  bySeverity: Record<IssueSeverity, number>;
  /** Drives "Fix all safe (n)". */
  autoFixable: number;
  resolvedThisPeriod: number;
  regressedThisPeriod: number;
  pagesCrawled: number;
  /** Null when no crawl has produced one — not zero. */
  healthScore: number | null;
  crawledAt: string | null;
}

export interface IssueGroup {
  groupKey: string;
  issueType: string;
  category: string | null;
  severity: IssueSeverity;
  confidence: "CONFIRMED" | "LIKELY" | "ADVISORY";
  affectedCount: number;
  sampleUrls: string[];
  aiFixAvailable: boolean;
  fixClass: FixClass;
  impact: number;
  reachAvailable: boolean;
  firstDetectedAt: string;
  regressionCount: number;
  title: string;
  summary: string;
  action: string;
}

export interface IssueGroupList {
  groups: IssueGroup[];
  /** False means the order is not traffic-weighted, and the UI must say so. */
  reachAvailable: boolean;
}

export interface IssueGroupFilters {
  severity?: IssueSeverity;
  limit?: number;
}

export interface ExecutiveSummary {
  range: { days: number };
  connections: { searchConsole: boolean; analytics: boolean; businessProfile: boolean };
  headline: { searchClicks: Measure; impressions: Measure; sessions: Measure; conversions: Measure };
  siteHealth: SiteHealth | { state: "NO_DATA"; reason: string };
  openOpportunities: { total: number; highPotential: number };
}

export interface SiteRepository {
  id: string;
  projectId: string;
  owner: string;
  name: string;
  defaultBranch: string;
  framework: string;
  contentDir: string | null;
  autoMerge: boolean;
  tokenConfigured: true;
  updatedAt: string;
}

export interface FixChangeReport {
  id: string;
  status: string;
  reviewState: 'OPEN' | 'MERGED' | 'CLOSED' | 'UNKNOWN';
  mergedAt: string | null;
  evidenceError: string | null;
  startedAt: string;
  pullRequestUrl: string | null;
  filesChanged: string[];
  error: string | null;
  skipped: string[];
  changes: {
    issueId: string; url: string; field: string; before: string | null; after: string;
    why: string; file: string; measuredAt: string | null;
    source?: string; dynamic?: boolean; expression?: string | null; beforeSource?: string;
    liveValue: string | null; checkedAt: string | null;
    verification: 'MATCHED' | 'DIFFERENT' | 'NOT_CHECKED';
  }[];
}

export interface AutomationRun {
  id: string;
  kind: "FIXES" | "CONTENT";
  status: "RUNNING" | "AWAITING_REVIEW" | "FAILED";
  steps: { at: string; step: string; detail?: string; ok: boolean }[];
  error: string | null;
  branch: string | null;
  pullRequestUrl: string | null;
  filesChanged: string[];
  startedAt: string;
  finishedAt: string | null;
}

export interface QueueStat {
  name: string;
  active: number;
  waiting: number;
  completed: number;
  failed: number;
  avgTime: string;
  status: string;
}

export interface LocalRanking {
  id: string;
  keyword: string;
  position: number;
  previousPos: number | null;
  searchVolume: number;
}

export interface LocalSeoData {
  id: string;
  projectId: string;
  businessName: string;
  address: string;
  placeId?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  rating: number;
  reviewCount: number;
  citationsCount: number;
  updatedAt: string;
  rankings?: LocalRanking[];
}
export interface GridNode {
  id: string;
  row: number;
  col: number;
  lat: number;
  lng: number;
  distanceKm: number;
  direction: string;
  /** Null when the business did not appear in the results here at all. */
  rank: number | null;
  businessFound: boolean;
  /** How many results the source actually returned at this coordinate. */
  resultCount: number;
  topCompetitors: {
    name: string;
    rank: number;
    rating?: number;
    reviewsCount?: number;
    distanceKm?: number;
    isClient: boolean;
  }[];
}

export interface GeoGridRunSummary {
  id: string;
  keyword: string;
  gridSize: number;
  radiusKm: number;
  averageRank: number | null;
  foundCount: number;
  top3Count: number;
  top10Count: number;
  pointCount: number;
  source: string;
  ranAt: string;
}

export interface GeoGridScanRequest {
  keyword: string;
  businessName?: string;
  lat?: number;
  lng?: number;
  locationQuery?: string;
  address?: string;
  gridSize?: 3 | 5 | 7 | 9;
  radiusKm?: number;
}

export interface GeoGridScanResult {
  keyword: string;
  businessName: string;
  centerCoordinates: { lat: number; lng: number };
  gridSize: number;
  radiusKm: number;
  scannedAt: string;
  /** Identifier of the stored run, so it can be compared with earlier ones. */
  runId: string;
  /** Where the ranks came from, e.g. "GOOGLE_PLACES". */
  source: string;
  metrics: {
    /** Mean of the ranks actually observed. Null when found nowhere. */
    averageGridRank: number | null;
    top3DominancePercentage: number;
    top1Count: number;
    top3Count: number;
    top10Count: number;
    unrankedCount: number;
    foundCount: number;
  };
  nodes: GridNode[];
  aiGeoActionPlan: {
    diagnosis: string;
    keyVulnerabilities: string[];
    actionItems: {
      action: string;
      impact: 'HIGH' | 'MEDIUM' | 'LOW';
      targetZone: string;
      description: string;
    }[];
  };
  model?: string;
}

export interface LocalReview {
  id: string;
  projectId: string;
  authorName: string;
  authorPhotoUrl?: string | null;
  rating: number;
  text?: string | null;
  time: string;
  relativeTime: string;
  aiDraftedReply?: string | null;
  replyStatus: string;
  createdAt: string;
  updatedAt: string;
}

// ── Google Business Profile (the real, synced connector)
//
// Every read below carries two envelopes, and the tabs are built around them.
// They exist because four very different situations all produce zero rows —
// not connected, connected but never synced, synced and this merchant really
// has none, and synced but Google refuses this Cloud project that source — and
// a screen that cannot tell them apart will pick one and be wrong.

/** Where the whole connection stands, as every Business Profile read reports it. */
export type GbpConnectionState =
  | "NOT_CONNECTED"
  | "NEEDS_SELECTION"
  | "NEEDS_REAUTH"
  | "ERROR"
  | "NEVER_SYNCED"
  | "SYNCED";

/** What happened last time one particular source was read. */
export type GbpSourceState = "OK" | "UNAVAILABLE" | "NEVER_ATTEMPTED";

export interface GbpConnection {
  state: GbpConnectionState;
  status: string;
  /** Safe to show: never a token, never a raw Google payload. */
  statusMessage: string | null;
  selectedResourceId: string | null;
  selectedResourceName: string | null;
  lastSyncedAt: string | null;
  /** Business Profile sits behind a Google application review, granted per Cloud project. */
  requiresGoogleApproval: boolean;
  /** False when the deployment itself is missing Google credentials — an operator problem. */
  configured: boolean;
}

export interface GbpSource {
  /** profile | performance | reviews | media | posts */
  name: string;
  state: GbpSourceState;
  message: string | null;
  /** 403 means "not approved for this Cloud project" rather than "broken". */
  httpStatus: number | null;
  lastSuccessAt: string | null;
  /** Null when the source never succeeded — distinct from 0, which means it looked and found none. */
  lastCount: number | null;
}

/**
 * Where a tab's data came from. `places` is the public Google Maps listing
 * (Places API), served while Business Profile has not delivered this source —
 * usually because Google has not approved the Cloud project yet.
 */
export type GbpDataSource = "business_profile" | "places";

/** The public-listing state, reported when a tab could not be filled from it. */
export interface GbpPlacesMeta {
  /** NO_PLACE: no Maps listing is attached. NOT_CONFIGURED: no Places key on the deployment. */
  state: "READY" | "NO_PLACE" | "FAILED" | "NOT_CONFIGURED";
  placeId: string | null;
  fetchedAt: string | null;
  /** Why the last Places read failed, naming the fix. */
  error: string | null;
  /** The Business Profile location's name, to prefill a Maps search. */
  suggestedQuery: string | null;
  googleMapsUri: string | null;
}

/** The two envelopes every Business Profile read carries. */
export interface GbpEnvelope {
  connection: GbpConnection;
  source: GbpSource;
  /** Absent on endpoints that never fall back, which are Business Profile only. */
  dataSource?: GbpDataSource;
  places?: GbpPlacesMeta;
}

export interface GbpLocationOption {
  /** Google's resource name, e.g. "locations/123". Passed straight back as `resourceId`. */
  id: string;
  accountId: string;
  title: string | null;
  address: string | null;
  primaryCategory: string | null;
  /** Google's own hasVoiceOfMerchant. Null means Google did not say. */
  verified: boolean | null;
}

export interface GbpLocationList {
  locations: GbpLocationOption[];
  /** Why an empty picker is empty: no Business Profile at all, or one with no location in it. */
  diagnostics: { accountsReturnedByGoogle: number; googleAccountHasAnyLocation: boolean };
}

export interface GbpSyncResult {
  syncedAt: string;
  counts: {
    reviews: number;
    photos: number;
    posts: number;
    services: number;
    metricDays: number;
  };
  /** PLACES_ONLY: Business Profile refused, but the public Maps listing was refreshed. */
  status: "SUCCEEDED" | "PARTIAL" | "FAILED" | "PLACES_ONLY" | string;
  /** Sources Google would not give up, by name. */
  failedSources: string[];
  /** Why Business Profile itself could not be read, when status is PLACES_ONLY. */
  businessProfileError?: string | null;
  places?: { state: GbpPlacesMeta["state"]; fetchedAt: string | null; error: string | null };
}

export interface GbpProfile {
  locationName: string;
  businessName: string | null;
  address: string | null;
  phone: string | null;
  website: string | null;
  description: string | null;
  primaryCategory: string | null;
  additionalCategories: { categoryId?: string | null; displayName?: string | null }[];
  hours: unknown;
  serviceArea: unknown;
  openStatus: string | null;
  latitude: number | null;
  longitude: number | null;
  placeId: string | null;
  mapsUri: string | null;
  newReviewUri: string | null;
  /** Null means Google did not say — render that as unknown, not as unverified. */
  verified: boolean | null;
  hasPendingEdits: boolean | null;
  syncedAt: string | null;
  /** Public listing only: the Maps rating and total review count. */
  rating?: number | null;
  reviewCount?: number | null;
  /** Public listing only: opening hours as Google words them, one line per day. */
  hoursText?: string[] | null;
  /** Public listing only: Google's own summary of the place — not the merchant's description. */
  editorialSummary?: string | null;
}

/**
 * Not a score. Every entry is a field Google can return, marked present when
 * Google actually returned a value for it. There is no weighting and no target,
 * so it is rendered as "5 of 9 fields present" and never as a percentage.
 */
export interface GbpCompleteness {
  present: number;
  total: number;
  fields: { field: string; present: boolean }[];
}

export interface GbpOverview extends GbpEnvelope {
  profile: GbpProfile | null;
  completeness: GbpCompleteness | null;
}

/** A metric Google never reported is null, never 0. */
export interface GbpMetricTotals {
  desktopMapsImpressions: number | null;
  desktopSearchImpressions: number | null;
  mobileMapsImpressions: number | null;
  mobileSearchImpressions: number | null;
  conversations: number | null;
  directionRequests: number | null;
  callClicks: number | null;
  websiteClicks: number | null;
  bookings: number | null;
  /** The four impression series summed; null unless at least one was reported. */
  impressions: number | null;
}

export interface GbpMetrics extends GbpEnvelope {
  range: { from: string; to: string; days: number };
  /** Null — not zeroes — when no synced day falls in the window. */
  totals: GbpMetricTotals | null;
  daily: (GbpMetricTotals & { date: string })[];
  /** How many days in the window Google actually reported. */
  coveredDays: number;
}

export interface GbpReview {
  id: string;
  googleReviewId: string | null;
  authorName: string;
  authorPhotoUrl: string | null;
  /** Null when Google would not state a star rating for this review. */
  rating: number | null;
  text: string | null;
  createTime: string | null;
  updateTime: string | null;
  googleReply: string | null;
  googleReplyUpdatedAt: string | null;
  aiDraftedReply: string | null;
  /** UNKNOWN for public-listing reviews: Places does not return the owner's replies. */
  replyStatus: string;
  /** Public listing only. */
  relativePublishTime?: string | null;
  googleMapsUri?: string | null;
  authorUri?: string | null;
}

export interface GbpReviews extends GbpEnvelope {
  reviews: GbpReview[];
  /** Averaged only over the reviews Google gave a rating for; null when none were. */
  summary: {
    total: number;
    rated: number;
    averageRating: number | null;
    /** Public listing only: how many reviews Google returned — at most its five most relevant. */
    shown?: number;
  };
}

export interface GbpPhoto {
  id: string;
  mediaName: string | null;
  format: string | null;
  category: string | null;
  url: string | null;
  thumbnailUrl: string | null;
  description: string | null;
  width: number | null;
  height: number | null;
  viewCount: number | null;
  attribution: unknown;
  /** Public listing only: a link to the photographer, which Places asks to be shown. */
  attributionUri?: string | null;
  createTime: string | null;
}

export interface GbpPhotos extends GbpEnvelope {
  photos: GbpPhoto[];
}

export interface GbpPost {
  id: string;
  postName: string | null;
  summary: string | null;
  state: string | null;
  topicType: string | null;
  searchUrl: string | null;
  callToAction: { type: string | null; url: string | null } | null;
  event: { title: string | null; start: string | null; end: string | null } | null;
  mediaUrls: string[];
  createTime: string | null;
  updateTime: string | null;
}

export interface GbpPosts extends GbpEnvelope {
  posts: GbpPost[];
}

export interface GbpService {
  id: string;
  kind: string | null;
  displayName: string | null;
  description: string | null;
  serviceTypeId: string | null;
  categoryId: string | null;
  /** Null unless the merchant set one. Reported exactly as Google holds it. */
  price: { currency: string | null; units: string | null; nanos: number | null } | null;
}

export interface GbpServices extends GbpEnvelope {
  services: GbpService[];
}

export interface PlacesCompetitor {
  rank: number;
  placeId: string;
  name: string;
  address: string | null;
  rating: number | null;
  reviewCount: number | null;
  category: string | null;
  website: string | null;
  googleMapsUri: string | null;
  distanceKm: number | null;
  isYou: boolean;
}

export interface PlacesCompetitorSearch {
  keyword: string;
  radiusKm: number;
  center: { lat: number; lng: number };
  searchedAt: string;
  /** Null when your listing did not appear in the results at all. */
  yourRank: number | null;
  results: PlacesCompetitor[];
}

export interface GbpCategories extends GbpEnvelope {
  primary: { categoryId: string | null; displayName: string | null } | null;
  additional: { categoryId: string | null; displayName: string | null }[];
}

export interface ApiCostStat {
  service: string;
  tokens: string;
  cost: number;
  limit: number;
  color: string;
}

export interface TenantStat {
  id: string;
  name: string;
  owner: string;
  /** Null until the organization first uses a metered feature: its wallet is opened then. */
  tokens: { available: number; monthly: number } | null;
  sites: number;
  health: number;
  quota: number;
  status: string;
}

export interface AdminSystemHealth {
  status: 'HEALTHY' | 'DEGRADED';
  database: {
    status: string;
    latencyMs: number;
  };
  redis: {
    status: string;
    queuesActive: boolean;
  };
  crawlerCluster: {
    status: string;
    activeWorkers: number;
    headlessEngine: string;
  };
  aiRouter: {
    status: string;
    primaryModel: string;
    fallbackProvider: string;
  };
  timestamp: string;
}

export interface AdminUserItem {
  id: string;
  email: string;
  name: string;
  role: string;
  organizationName: string;
  organizationId: string | null;
  createdAt: string;
  status: string;
}

// ─────────────────────────────────────────────────── market research


/**
 * A competitor as `listCompetitors` returns it.
 *
 * This was declared twice in this file, so TypeScript merged the two silently
 * and the real shape was visible in neither: the first declaration listed four
 * fields, and a reader who found it first had no way to know the type actually
 * carried eighteen. Consolidated here, `createdAt` included — it comes back
 * with the rest of the CompetitorDomain row.
 */
export interface TrackedCompetitor {
  id: string;
  domain: string;
  name: string | null;
  createdAt: string;
  label: string | null;
  industry: string | null;
  city: string | null;
  mapsName: string | null;
  youtubeUrl: string | null;
  instagramHandle: string | null;
  status: string;
  lastAnalyzedAt: string | null;
  healthScore?: number | null;
  pagesCrawled?: number;
  /** The newest crawl attempt's status, which may be newer than the crawl the figures came from. */
  crawlStatus?: string;
  /** Why the newest attempt read nothing, when it did not. Null otherwise. */
  crawlError?: string | null;
  rating?: number | null;
  reviewCount?: number | null;
  aiCitationSharePct?: number | null;
  /** Named in this many of the latest AI answers. Null until anything has been asked. */
  aiMentions?: { named: number; answers: number } | null;
  socialAccounts?: Array<{ platform: string; handle: string; lastSyncedAt: string | null }>;
}

/** Mirrors ContentIdeas in growthx-ai-crawler content-ideas.service.ts. Suggestions, not measurements. */
/** Google's numbers for one search the site appeared in (Search Console). Mirrors search-demand.ts. */
export interface MeasuredSearch {
  query: string;
  impressions: number;
  clicks: number;
  position: number;
  page: string | null;
}

/** What a suggested phrase carries when it is one of the site's real searches. */
export interface MeasuredNumbers {
  impressions: number;
  clicks: number;
  position: number;
  days: number;
  page: string | null;
}

export type SearchDataStatus = "NOT_CONNECTED" | "NO_DATA_YET" | "NEEDS_ATTENTION" | "OK";

export interface ContentIdeas {
  /** `measured` is Google's numbers when the phrase is one of the site's real searches; absent or null means a suggestion only. */
  keywords: Array<{ phrase: string; why: string; usePage: string | null; measured?: MeasuredNumbers | null }>;
  blogIdeas: Array<{ title: string; covers: string; keyword: string }>;
  model: string | null;
  /** Absent on reports written before real search numbers were added. */
  search?: {
    status: SearchDataStatus;
    days: number;
    range: { start: string; end: string } | null;
    almostWinning: Array<MeasuredSearch & { pagePath: string | null }>;
  };
}

/** Mirrors WebsiteAuditReport in growthx-ai-crawler audit-report.service.ts. */
export interface WebsiteAuditReport {
  generatedAt: string;
  facts: {
    site: { name: string; domain: string; crawledAt: string | null; healthScore: number | null } | null;
    pages: {
      read: number;
      broken: number;
      slow: number;
      averageResponseMs: number | null;
      thin: number;
      medianWords: number | null;
      missingTitle: number;
      missingDescription: number;
      missingHeadline: number;
      hiddenFromGoogle: number;
      withGoogleDetails: number;
    } | null;
    problemsBySeverity: Record<string, number>;
    problems: Array<{ title: string; severity: string; pages: number; why: string; action: string; exampleUrls: string[]; issueType: string }>;
    moreProblems: number;
  };
  analysis: {
    summary: string;
    scoreExplained: string;
    fixes: Array<{
      title: string;
      priority: "high" | "medium" | "low";
      whatIsWrong: string;
      whyItMatters: string;
      steps: string[];
      whoCanFix: "you" | "developer";
      effort: "low" | "medium" | "high";
      pages: number;
    }>;
    quickWins: string[];
    whatIsGood: string[];
    plan: Array<{ week: string; actions: string[] }>;
    dataGaps: string[];
  } | null;
  model: string | null;
  analysisError: string | null;
  /** Absent on reports written before suggestions existed. */
  ideas?: ContentIdeas | null;
  ideasError?: string | null;
  snapshotId?: string | null;
}

/** Mirrors the backend's CompetitorIntelReport. */
export type IntelPriority = "high" | "medium" | "low";

/** What a rival's site has that yours does not, counted from both crawls. */
export interface IntelRivalAdvantages {
  missingTopics: Array<{ title: string; url: string; pageType: string; wordCount: number }>;
  missingTopicsTotal: number;
  yourUniqueTopicsTotal: number;
  pageTypes: Array<{ pageType: string; label: string; you: number; them: number }>;
  schema: Array<{ type: string; you: number; them: number; exampleUrl: string }>;
  depth: { yourMedianWords: number | null; theirMedianWords: number | null; yourLongPages: number; theirLongPages: number };
  questions: { theirs: string[]; theirCount: number; yourCount: number };
}

export interface IntelReportRival {
  name: string;
  domain: string;
  crawledAt: string | null;
  pagesCrawled: number | null;
  aiMentions: number | null;
  googleRating: number | null;
  googleReviews: number | null;
  comparison: Array<{ label: string; them: number | null; you: number | null; leader: "them" | "you" | "level" | "unknown" }>;
  advantages: IntelRivalAdvantages | null;
  notes: string[];
}

export interface IntelReportGap {
  title: string;
  priority: IntelPriority;
  rivals: string[];
  evidence: string;
  whyItHelpsThemRank: string;
  howToBeatIt: string[];
  effort: "low" | "medium" | "high";
}

export interface CompetitorIntelReport {
  generatedAt: string;
  facts: {
    you: { name: string; domain: string; crawledAt: string | null; pagesCrawled: number | null } | null;
    aiAnswers: { asked: number; namedYou: number };
    rivals: IntelReportRival[];
    notIncluded: string[];
  };
  analysis: {
    executiveSummary: string;
    whyTheyRank: Array<{ competitor: string; threat: IntelPriority; reasons: Array<{ factor: string; evidence: string }> }>;
    gaps: IntelReportGap[];
    whereYouLead: string[];
    plan: Array<{ week: string; actions: string[] }>;
    dataGaps: string[];
  } | null;
  model: string | null;
  analysisError: string | null;
  /** Absent on reports written before suggestions existed. */
  ideas?: ContentIdeas | null;
  ideasError?: string | null;
}

/** Mirrors WebsiteOverview in growthx-ai-crawler ai-visibility/website-overview.ts. */
export type SiteReadStatus = "READING" | "QUEUED" | "READ" | "FAILED" | "WAITING";

export interface CompetitorWebsite {
  role: "you" | "competitor";
  competitorId: string | null;
  domain: string;
  name: string;
  status: SiteReadStatus;
  /**
   * Pages that opened in the crawl the figures come from — exactly what
   * `pageTypes` adds up to. Null when that crawl's page details are no longer kept.
   */
  pagesRead: number | null;
  /** Pages that crawl asked for and did not get, and why. Null when not known. */
  notOpened: { refused: number; errored: number; noAnswer: number } | null;
  /** Pages the running crawl has opened so far; null when nothing is running. */
  pagesSoFar: number | null;
  /** Pages the running crawl has asked for and not got so far. */
  notOpenedSoFar: number | null;
  readingStartedAt: string | null;
  lastReadAt: string | null;
  /** Why the newest attempt read nothing, when it did not. */
  error: string | null;
  healthScore: number | null;
  /** Null when there is no Google listing to read it from — not a zero rating. */
  rating: number | null;
  reviewCount: number | null;
  /** Kinds of working pages, most first. */
  pageTypes: Array<{ type: string; label: string; count: number }>;
}

export interface TrackedCompetitorList {
  competitors: TrackedCompetitor[];
  slotsUsed: number;
  slotsTotal: number;
}

export type GeoEngine = "PERPLEXITY" | "CHATGPT" | "GEMINI" | "CLAUDE" | "SARVAM";

export interface GeoEngineResult {
  engine: GeoEngine;
  /** The model that actually answered; null when the engine was not asked. */
  model: string | null;
  /** Why there is no answer. When set, every measurement is empty. */
  error: string | null;
  cited: boolean;
  position: number | null;
  citedUrl: string | null;
  competitorsCited: string[];
  answerExcerpt: string | null;
  latencyMs: number;
}

export interface GeoDisplacementPatch {
  id: string;
  targetTitle: string;
  targetUrl: string;
  reasoning: string;
  displacementContent: string;
  faqSchema: string;
  category: string;
  priority: "CRITICAL" | "HIGH" | "MEDIUM";
  draftedBy: string;
}

export interface GeoSimulationResult {
  query: string;
  domain: string;
  brandName: string;
  enginesAnswered: number;
  overallCitationRate: number | null;
  overallShareOfVoice: number | null;
  engines: GeoEngineResult[];
  displacementPatch: GeoDisplacementPatch | null;
}

export interface SimulateGeoBody {
  query: string;
  engines?: GeoEngine[];
  location?: string;
}

/** Mirrors ProgrammaticCluster in growthx-ai-crawler programmatic-decompiler.service.ts. */
export interface ProgrammaticVariable {
  name: string;
  /** Real slugs taken from the competitor's own URLs. */
  exampleValues: string[];
  description: string;
}

export interface ProgrammaticCluster {
  id: string;
  patternName: string;
  category: "INTEGRATIONS" | "COMPARISONS" | "TEMPLATES" | "GLOSSARY" | "LOCATIONS" | "TOOLS" | "CATEGORY_HUBS";
  urlPattern: string;
  competitorDomain: string;
  pageCount: number;
  commercialIntent: "HIGH" | "MEDIUM" | "TRANSACTIONAL";
  variables: ProgrammaticVariable[];
  sampleUrls: string[];
  counterStrategy: {
    recommendedUrlPattern: string;
    targetH1Formula: string;
    recommendedSchemaType: string;
    contentDepthBenchmark: string;
    differentiatorAngle: string;
    /** A scaffold with [bracketed] gaps for the customer to fill. */
    sampleDeliverableTemplate: string;
  };
}

export interface ProgrammaticScoreboard {
  totalProgrammaticClusters: number;
  totalCompetitorPagesIndexed: number;
  topPatternCategory: string;
  readyToCounterCount: number;
}

export interface ProgrammaticMatrixResponse {
  scoreboard: ProgrammaticScoreboard;
  clusters: ProgrammaticCluster[];
}

/** Mirrors RivalMove in growthx-ai-crawler rival-moves.ts. */
export interface RivalMove {
  id: string;
  kind: "NEW_PAGE" | "EXPANDED" | "RETITLED" | "SCHEMA_ADDED" | "PAGE_GONE" | "AI_NAMED";
  rival: string;
  rivalDomain: string;
  url: string | null;
  title: string | null;
  at: string;
  source: "daily-check" | "crawl" | "ai-answers";
  from?: string | null;
  to?: string | null;
  added?: string[];
  words?: { from: number; to: number };
  count?: number;
  questions?: string[];
  comparedWith?: string | null;
}

export interface RivalMovesResponse {
  moves: RivalMove[];
  windowDays: number;
  watching: Array<{
    name: string;
    domain: string;
    lastCheckedAt: string | null;
    lastCrawlAt?: string | null;
    pagesRead?: number | null;
    lastChangeAt?: string | null;
  }>;
}

// ── Content Velocity Engine interfaces ──────────────────────────────────────

// ──────────────────────────────────────────────────────────────── the API



// ── SEO tools ─────────────────────────────────────────────────────────────
//
// Each of these mirrors the JSON schema its backend service pins the model to
// (META_JSON_SCHEMA, IMAGE_OPTIMIZER_SCHEMA and friends in
// `src/modules/seo-tools/`). Those schemas set `additionalProperties: false`
// and list every required key, so these shapes are the contract rather than a
// guess at it. `model` is attached by the service after parsing.

// ── Google Business Profile fixes ─────────────────────────────────────────
//
// Two different shapes on purpose: `analyzeGbp` hands back what the model
// proposed, before it is persisted; `getGbpProposals` reads the stored
// GbpFixProposal rows, which carry an id and a review status on top.

export interface GbpFixSuggestion {
  /** The profile field being changed, e.g. "description" or "services". */
  field: string;
  currentValue?: string;
  proposedValue: string;
  rationale: string;
}

export interface GbpFixProposal extends GbpFixSuggestion {
  id: string;
  projectId: string;
  currentValue: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "PUSHED";
  createdAt: string;
  updatedAt: string;
}

// ── Voice agent (Aiva) ──────────────────────────────────

/**
 * The structured panel data a voice tool can return alongside its spoken
 * summary. Each variant mirrors exactly what `voice-tools.service.ts` emits on
 * the backend; the panel switches on `type` to decide what to draw.
 */
export type AivaUiPayload =
  | {
      type: "crawl_status";
      domain: string;
      status: string;
      pagesCrawled: number;
      issuesFound: number;
      errorMessage?: string | null;
    }
  | { type: "competitor_list"; competitors: Array<{ domain: string; label?: string | null }> }
  | {
      type: "audit_summary";
      domain: string;
      pagesCrawled: number;
      totalIssues: number;
      criticalCount: number;
      highCount: number;
    }
  | {
      type: "gap_insights";
      // Shape fixed by the JSON schema seo-competitors.service.ts asks the
      // model for: a prose paragraph plus exactly three content ideas.
      insights: string;
      recommendedContent: Array<{ title: string; type: string; targetKeyword: string }>;
      missingKeywords: string[];
    }
  | {
      // `contentPillars` and `campaignIdeas` are Json columns, so only the
      // fields the panel reads are claimed here.
      type: "seo_strategy";
      pillars: Array<{ name: string; description: string }>;
      campaigns: Array<{ name: string; rationale: string }>;
    }
  | { type: "blog_ideas"; topic: string; items: string[] }
  | { type: "meta_tags"; targetUrl: string; title: string; description: string }
  | { type: "competitor_scrape_result"; url: string; target: string; extractedData: string }
  | { type: "social_draft"; trend: string; platform: string; postText: string }
  | { type: "autopilot"; runId: string; projectId: string };

/** Mirrors AutopilotView in growthx-ai-crawler autopilot.service.ts. */
export interface AutopilotRun {
  id: string;
  projectId: string;
  domain: string;
  status: "DISCOVERING" | "AWAITING_CONFIRMATION" | "RUNNING" | "DONE" | "FAILED" | "CANCELLED";
  step: "SETUP" | "FIND_COMPETITORS" | "CONFIRM" | "CRAWL_SITES" | "REPORT" | "DONE";
  /** `foundBy` is the model that suggested it, e.g. "sarvam-105b". */
  suggestions: Array<{ domain: string; name: string; reason: string; tracked?: boolean; foundBy?: string | null }>;
  competitors: Array<{ domain: string; name: string; competitorId: string }>;
  sites: Array<{ domain: string; name: string; role: "you" | "competitor"; crawl: string; pagesCrawled: number }>;
  log: Array<{ at: string; message: string }>;
  error: string | null;
  reportReady: boolean;
  startedAt: string;
  finishedAt: string | null;
}

export interface VoiceConfirmationRequired {
  message: string;
  /** True when the tool must not run until the user confirms. */
  blocking: boolean;
}

/** Mirrors the backend's VoiceAgentResult. */
export interface VoiceAgentResult {
  success: boolean;
  tool: string | null;
  data: unknown;
  /** Short sentence(s) for speech. Always present, even on failure. */
  spokenSummary: string;
  navigateTo?: string;
  confirmationRequired?: VoiceConfirmationRequired;
  /** Technical detail, deliberately not spoken. */
  error?: string;
  uiPayload?: AivaUiPayload;
}

/**
 * Mirrors the backend's VoiceChatRequest, with two fields widened to what this
 * client can actually supply: the session is null until `createSession`
 * resolves, and a project is only set once one is selected. The backend
 * declares both required and only validates `text`, so a command fired before
 * the session lands still reaches it — worth closing, but not by silently
 * changing what the voice agent does mid-command.
 */
export interface VoiceChatRequest {
  text: string;
  sessionId: string | null;
  projectId?: string;
  confirmed?: boolean;
  pendingTool?: string;
  pendingParams?: Record<string, unknown>;
  context?: { path?: string };
}

/**
 * Crawl quality telemetry, built in `crawler.service.ts` when a job finishes
 * and stored as a Json column. Every field is optional on purpose: jobs that
 * never completed carry none of it, and rows written before a key existed
 * still come back without it.
 */
export interface CrawlQualityDiagnostics {
  durationSeconds?: number;
  startedAt?: string;
  finishedAt?: string;
  pagesCrawled?: number;
  /** Status code bucket ("2xx", "4xx", …) to count. */
  statusCodes?: Record<string, number>;
  avgResponseTimeMs?: number;
  sitemapFound?: boolean;
  sitemapUrlsCount?: number;
  urlsDiscovered?: number;
  urlsEligible?: number;
  urlsSkipped?: number;
  robotsBlocked?: number;
  internalLinksFound?: number;
  crawlCoveragePercent?: number;
  crawlStatus?: "COMPLETED" | "LIMIT_REACHED" | "PARTIAL";
  totalFindings?: number;
  uniqueIssuesCount?: number;
  resolvedIssuesCount?: number;
  scoreBreakdown?: {
    baseScore: number;
    totalPenalty: number;
    penaltiesCount: number;
    normalizedPenaltyPerUrl: number;
    pagesCrawled: number;
  };
  /**
   * The crawl's one computed view, as `computeCrawlSummary` produced it.
   *
   * Typed rather than `any` because this is the object every metric on the
   * Pages and Technical SEO tabs is read from — the coverage denominator, the
   * per-source URL counts, the not-crawled reasons. `Partial` because a crawl
   * recorded before a field existed simply does not carry it, and a reader
   * must handle that rather than assume a zero.
   */
  summary?: Partial<CrawlSummary>;
}

export interface MammouthModelInfo {
  id: string;
  displayName: string;
  description: string;
  capabilities: string[];
  maxOutputTokens: number;
}

export interface MammouthConfig {
  provider: string;
  isConfigured: boolean;
  connected: boolean;
  maskedKey: string;
  defaultModel: string;
  availableModels: MammouthModelInfo[];
  features: {
    websiteAudit: boolean;
    competitorIntelligence: boolean;
    keywordStrategy: boolean;
    aevAnalysis: boolean;
    seoRecommendations: boolean;
  };
}

/** Request body for the Mammouth analysis endpoints, which take free-form JSON. */
export type MammouthAnalysisInput = Record<string, unknown>;

export interface MammouthTestResult {
  connected: boolean;
  provider: string;
  model: string;
  latencyMs: number;
  maskedKey: string;
  message: string;
}

// ─────────────────────────────────────────────────────────────── Business
//
// Products Intelligence: the catalog the crawler's product detector builds
// as part of the crawl job Website Audit already runs. Price and stock are
// three states, never two — a row with FOUND carries a real value, one with
// NOT_PUBLISHED is a known absence (common on B2B/wholesale sites), and
// NOT_YET_CRAWLED means this catalog has no completed crawl at all yet.
// Never render any of the three as a blank cell.

// ── Business → Marketing Strategy (mirrors business-strategy.ts) ──────────
