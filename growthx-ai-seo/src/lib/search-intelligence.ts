/**
 * Types for the Google Search screens: index status, keyword diagnosis, rank
 * tracking, competitor keyword gaps, and search results before and after a
 * change. They mirror `growthx-ai-crawler/src/modules/search-intelligence`.
 */

export interface SearchMarket {
  country: string;
  language: string;
  source: "SET" | "SEARCH_CONSOLE" | "DEFAULT";
}

export interface SearchIntelligenceStatus {
  /** The customer's own Search Console, which most of this page runs on. */
  searchConsoleConnected: boolean;
  /** Their Google Analytics 4, which adds visits and conversions. Absent from an API that predates it. */
  analyticsConnected?: boolean;
  /**
   * Live Google results and competitor keywords: a paid source the platform
   * provides, not something a customer connects. Everything else works without it.
   */
  googleResultsConnected: boolean;
  market: SearchMarket;
}

interface Evidence {
  label: string;
  value: string;
  source: string;
}

export interface Reason {
  code: string;
  severity: "HIGH" | "MEDIUM" | "LOW";
  title: string;
  detail: string;
  evidence: Evidence[];
}

// ── Index status ──────────────────────────────────────────────────────────

export interface IndexStatusReport {
  connected: boolean;
  propertyId: string | null;
  quota: { usedToday: number; perDay: number } | null;
  lastInspectedAt: string | null;
  totals: { asked: number; indexed: number; notIndexed: number; couldNotCheck: number; notYetAsked: number };
  groups: Array<{ coverageState: string; verdict: string | null; count: number; meaning: string; action: string | null; urls: string[] }>;
  indexableButNotIndexed: Array<{ url: string; coverageState: string | null; meaning: string; action: string | null }>;
  canonicalOverridden: Array<{ url: string; declared: string | null; googleChose: string | null }>;
  urlSets: {
    discovered: number;
    inSitemap: number;
    crawled: number;
    indexableByOurCheck: number;
    indexedByGoogle: number;
    seenInGoogleSearchLast28Days: number;
  };
  pages: Array<{
    url: string;
    inspectedAt: string;
    verdict: string | null;
    coverageState: string | null;
    meaning: string;
    action: string | null;
    googleCanonical: string | null;
    userCanonical: string | null;
    lastCrawlTime: string | null;
    inSitemapPerGoogle: boolean;
    inspectionLink: string | null;
    error: string | null;
    ourCrawl: { statusCode: number; indexability: string } | null;
  }>;
}

export interface InspectOutcome {
  inspected: number;
  failed: number;
  quotaLeft: number;
  note?: string;
  skippedOutsideProperty?: string[];
}

// ── Keyword diagnosis ─────────────────────────────────────────────────────

export interface ComparedPage {
  url: string;
  domain: string;
  position: number | null;
  read: boolean;
  error: string | null;
  title: string | null;
  heading: string | null;
  wordCount: number | null;
  subheadings: number | null;
  structuredData: string[];
  format: string;
  formatLabel: string;
  keywordInTitle: boolean;
  keywordInHeading: boolean;
  keywordInAddress: boolean;
  keywordInOpening: boolean;
}

/** What GA4 recorded for visits that started on a page. Every source counts, not only Google. */
export interface PageVisits {
  days: number;
  sessions: number;
  /** Share of sessions GA4 counted as engaged, 0-1. */
  engagementRate: number | null;
  /** Null when the property has no key events configured, which is not zero. */
  conversions: number | null;
}

export interface KeywordDiagnosis {
  id: string;
  createdAt: string;
  keyword: string;
  pageUrl: string;
  /**
   * LIVE_RESULTS read Google's results page and the pages that rank; SEARCH_CONSOLE
   * used only the customer's own Search Console. Absent on a diagnosis saved before
   * there were two kinds, which were all live.
   */
  mode?: "LIVE_RESULTS" | "SEARCH_CONSOLE";
  /** The market results were checked in; null for a Search Console check, which is not market-specific. */
  market: SearchMarket | null;
  checkedAt: string;
  verdict: "TOP_3" | "PAGE_ONE" | "PAGE_TWO" | "NOT_IN_TOP_20";
  verdictText: string;
  reasons: Reason[];
  confidence: { level: "HIGH" | "MEDIUM" | "LOW"; basis: string[]; missing: string[] };
  results: {
    /** A place in Google's results (live), or the average position over 28 days (Search Console). */
    position: number | null;
    otherPageOfYours: { url: string; position: number | null } | null;
    intent: { primary: string; primaryLabel: string; secondary: string | null; evidence: string[] } | null;
    dominantFormat: { format: string; label: string; count: number; of: number; counts: Array<{ format: string; label: string; count: number }> } | null;
    features: Array<{ type: string; label: string }>;
    questions: string[];
    top: Array<{ position: number; url: string; domain: string; title: string | null; format: string; formatLabel: string; yours: boolean }>;
  };
  comparison: {
    yours: ComparedPage;
    competitors: ComparedPage[];
    typical: { wordCount: number | null; keywordInTitle: string; keywordInHeading: string } | null;
  };
  searchConsole: {
    clicks: number;
    impressions: number;
    ctr: number;
    position: number | null;
    pages: Array<{ url: string; clicks: number; impressions: number; position: number | null }>;
    /** The same search over the 28 days before; null when Search Console holds none. */
    previous?: { clicks: number; impressions: number; position: number | null } | null;
  } | null;
  /** GA4 visits to the page; null when GA4 is not connected or recorded none for it. */
  visits?: PageVisits | null;
  indexStatus: { verdict: string | null; coverageState: string | null; inspectedAt: string } | null;
}

export interface DiagnosisSummary {
  id: string;
  keyword: string;
  pageUrl: string;
  createdAt: string;
  verdictText: string | null;
  reasons: number;
}

// ── Rankings from Search Console ──────────────────────────────────────────

export interface SearchRankingRow {
  query: string;
  /** Average position over the window, weighted by impressions. */
  position: number;
  previousPosition: number | null;
  /** Places gained (positive) or lost (negative) against the window before; null when not measurable. */
  movement: number | null;
  clicks: number;
  impressions: number;
  /** Clicks over impressions, 0-1. */
  ctr: number;
  /** The page Google showed most for this search. */
  page: string | null;
  /** GA4 visits to that page, all sources; null when GA4 is not connected or holds nothing for it. */
  visits: { sessions: number; conversions: number | null } | null;
}

export interface SearchRankingsReport {
  connected: boolean;
  analyticsConnected: boolean;
  /** Search Console rows are stored. False straight after connecting, before the first fetch. */
  hasData: boolean;
  analyticsHasData: boolean;
  days: number;
  range: { start: string; end: string } | null;
  comparisonRange: { start: string; end: string } | null;
  summary: {
    searches: number;
    top3: number;
    pageOne: number;
    pageTwo: number;
    beyond: number;
    movedUp: number;
    movedDown: number;
  } | null;
  rows: SearchRankingRow[];
}

// ── Rank tracking ─────────────────────────────────────────────────────────

export interface Overtake {
  keyword: string;
  competitor: string;
  before: { own: number | null; competitor: number | null; checkedAt: string };
  now: { own: number | null; competitor: number | null; checkedAt: string };
  competitorUrl: string | null;
}

export interface RankingsReport {
  connected: boolean;
  market: SearchMarket;
  limit: number;
  keywords: Array<{
    id: string;
    keyword: string;
    source: string;
    lastCheckedAt: string | null;
    position: number | null;
    url: string | null;
    previousPosition: number | null;
    previousCheckedAt: string | null;
    competitors: Record<string, { position: number; url: string }>;
    features: string[];
    checkedInMarket: string | null;
  }>;
  overtakenBy: Overtake[];
  youOvertook: Overtake[];
}

// ── Competitor keyword gaps ───────────────────────────────────────────────

export interface GapRow {
  keyword: string;
  searchVolume: number | null;
  competitorPosition: number;
  competitorUrl: string | null;
  ownPosition: number | null;
  ownSource: "GOOGLE_RANKINGS" | "SEARCH_CONSOLE" | null;
  status: "MISSING" | "BEHIND";
  intent: string | null;
}

export interface KeywordGapsReport {
  connected: boolean;
  market: SearchMarket;
  competitors: Array<{
    domain: string;
    label: string | null;
    fetchedAt: string | null;
    country: string | null;
    error: string | null;
    competitorKeywordsRead: number;
    ownKeywordsRead: number;
    missing: number;
    behind: number;
    rows: GapRow[];
  }>;
  shared: Array<{ keyword: string; searchVolume: number | null; competitors: Array<{ domain: string; position: number; url: string | null }> }>;
  fetched?: number;
  fromCache?: number;
}

// ── Changes ───────────────────────────────────────────────────────────────

export type ImpactVerdict = "IMPROVED" | "DECLINED" | "NO_CLEAR_CHANGE" | "TOO_EARLY" | "TOO_LITTLE_DATA";

export interface ImpactWindow {
  from: string;
  to: string;
  days: number;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number | null;
}

export interface ChangeImpact {
  url: string;
  changedAt: string;
  status: "MEASURED" | "NOT_CONNECTED" | "NO_DATA" | "TOO_EARLY";
  message?: string;
  windowDays?: number;
  page?: { before: ImpactWindow; after: ImpactWindow };
  site?: { before: ImpactWindow; after: ImpactWindow };
  verdict?: ImpactVerdict;
  verdictText?: string;
  perDay?: {
    clicks: { before: number; after: number; changePct: number | null };
    impressions: { before: number; after: number; changePct: number | null };
  };
  ctr?: { before: number; after: number };
  positionGain?: number | null;
  siteChange?: { clicksChangePct: number | null; impressionsChangePct: number | null };
  readout?: string[];
  searches?: Array<{
    query: string;
    clicksPerDayBefore: number;
    clicksPerDayAfter: number;
    impressionsBefore: number;
    impressionsAfter: number;
    positionBefore: number | null;
    positionAfter: number | null;
  }>;
  visits?: { before: { sessions: number; conversions: number; days: number }; after: { sessions: number; conversions: number; days: number } } | null;
}

export interface ChangeLedger {
  changes: Array<{
    id: string;
    kind: "FIX" | "CONTENT";
    url: string;
    what: string;
    liveSince: string | null;
    recordedAt: string;
    pullRequestUrl: string | null;
    impact: {
      status: string;
      verdict?: ImpactVerdict;
      verdictText?: string;
      message?: string;
      perDay?: ChangeImpact["perDay"];
      positionGain?: number | null;
    };
  }>;
}

export type ChangeKind = "DELETE" | "REDIRECT" | "CANONICAL" | "URL_CHANGE" | "NOINDEX";

export interface ChangeRiskReport {
  url: string;
  change: ChangeKind;
  changeLabel: string;
  target: string | null;
  checkedAt: string;
  crawlUsed: { id: string; at: string } | null;
  level: "HIGH" | "MEDIUM" | "LOW";
  summary: string;
  risks: Reason[];
  beforeYouDoIt: string[];
  notMeasured: string[];
  affected: {
    searchClicks90d: number | null;
    searchImpressions90d: number | null;
    searches: Array<{ query: string; clicks: number; impressions: number; position: number | null }>;
    internalLinks: number;
    inSitemap: boolean;
    canonicalReferences: number;
    trackedRankings: Array<{ keyword: string; position: number }>;
    visits90d: number | null;
  };
}

