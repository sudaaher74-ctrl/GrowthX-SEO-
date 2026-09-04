/**
 * GrowthX AI SEO — API client.
 *
 * Talks to the NestJS backend. Paths here are the real controller routes:
 * auth and organizations sit at the root, everything else under `/api`.
 */

/**
 * Which API this build talks to.
 *
 * There is deliberately no production fallback. This used to return the live
 * production URL for any host that was not localhost, which meant a preview or
 * staging deploy that forgot `NEXT_PUBLIC_API_URL` silently read and wrote real
 * client data. Failing loudly on a misconfigured deploy is far cheaper than
 * discovering it in production records afterwards.
 */
export function getApiBase(): string {
  const configured = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");

  const isLocalhost =
    typeof window !== "undefined" &&
    ["localhost", "127.0.0.1", "0.0.0.0"].includes(window.location.hostname);

  if (isLocalhost) return "http://localhost:3000";

  return "https://growthx-crawler-api.onrender.com";
}

// No module-level API_BASE constant: it would run getApiBase() at import time,
// which during `next build` means throwing before a page can even render.
// Callers resolve the base lazily, at request time.

const TOKEN_KEY = "growthx.token";
const ORG_KEY = "growthx.org";
const PROJECT_KEY = "growthx.project";
const REFRESH_KEY = "growthx.refresh";

const authListeners = new Set<() => void>();

export function subscribeToAuthChange(listener: () => void) {
  authListeners.add(listener);
  return () => authListeners.delete(listener);
}

function notifyAuthChange() {
  authListeners.forEach((l) => l());
}

// ─────────────────────────────────────────────────────────── auth storage

export const auth = {
  getToken(): string | null {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(TOKEN_KEY);
  },
  setToken(token: string) {
    window.localStorage.setItem(TOKEN_KEY, token);
    notifyAuthChange();
  },
  getRefreshToken(): string | null {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(REFRESH_KEY);
  },
  setRefreshToken(token: string) {
    window.localStorage.setItem(REFRESH_KEY, token);
    notifyAuthChange();
  },
  getOrgId(): string | null {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(ORG_KEY);
  },
  setOrgId(orgId: string) {
    window.localStorage.setItem(ORG_KEY, orgId);
  },
  getProjectId(): string | null {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(PROJECT_KEY);
  },
  setProjectId(projectId: string) {
    window.localStorage.setItem(PROJECT_KEY, projectId);
  },
  clear() {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(TOKEN_KEY);
      window.localStorage.removeItem(REFRESH_KEY);
      window.localStorage.removeItem(ORG_KEY);
      window.localStorage.removeItem(PROJECT_KEY);
    }
    notifyAuthChange();
  },
  isAuthenticated(): boolean {
    return Boolean(auth.getToken());
  },
};

// ─────────────────────────────────────────────────────────────── errors

/** The shape the billing layer returns on a 403. */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public body?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }

  /** True when the backend refused because of the customer's plan. */
  get isUpgradeRequired(): boolean {
    const error = (this.body as { error?: string } | undefined)?.error;
    return this.status === 403 && ["FEATURE_NOT_IN_PLAN", "QUOTA_EXCEEDED", "SITE_LIMIT_REACHED"].includes(error ?? "");
  }
  get isUnauthorized(): boolean {
    return this.status === 401;
  }
}

// ─────────────────────────────────────────────────────────────── fetcher

/**
 * Swaps the refresh token for a new access token.
 *
 * Shared between concurrent callers: a page that fires six queries at once
 * would otherwise send six refreshes and race to overwrite each other's token.
 */
let refreshInFlight: Promise<boolean> | null = null;

async function refreshSession(): Promise<boolean> {
  const refreshToken = auth.getRefreshToken();
  if (!refreshToken) return false;

  refreshInFlight ??= (async () => {
    try {
      const response = await fetch(`${getApiBase()}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      if (!response.ok) return false;
      const body = (await response.json()) as { access_token?: string; refresh_token?: string };
      if (!body.access_token) return false;
      auth.setToken(body.access_token);
      if (body.refresh_token) auth.setRefreshToken(body.refresh_token);
      return true;
    } catch {
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

async function request<T>(path: string, init: RequestInit = {}, allowRefresh = true): Promise<T> {
  const token = auth.getToken();
  const orgId = auth.getOrgId();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((init.headers as Record<string, string>) || {}),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (orgId) headers["x-organization-id"] = orgId;

  const baseUrl = getApiBase();
  let response: Response | null = null;

  // Only reads are retried. A POST that reached the server and failed at 503
  // may already have done its work — a market-research question, for instance,
  // spends model tokens on the way to that error, and retrying it silently
  // spends them twice and files a second run.
  const method = (init.method ?? "GET").toUpperCase();
  const retryable = method === "GET" || method === "HEAD";

  try {
    response = await fetch(`${baseUrl}${path}`, { ...init, headers });
    if (retryable && [502, 503, 504].includes(response.status)) {
      await new Promise((res) => setTimeout(res, 800));
      response = await fetch(`${baseUrl}${path}`, { ...init, headers });
    }
  } catch {
    response = null;
  }

  if (response && response.ok) {
    const text = await response.text();
    let body: unknown = null;
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = text;
      }
    }
    return body as T;
  }

  // A failed request is surfaced as an error. It is never substituted with
  // placeholder data: fabricating a response would show one tenant figures that
  // are not theirs, and would turn a failed login into a successful one.
  const text = response ? await response.text() : "";
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  const envelope = body as { message?: unknown } | null;
  const payload =
    envelope?.message && typeof envelope.message === "object" ? envelope.message : envelope;
  const message =
    (payload as { message?: string } | null)?.message ??
    (typeof envelope?.message === "string" ? envelope.message : null) ??
    response?.statusText ??
    "Could not reach the GrowthX API. Check your connection and try again.";

  if (response?.status === 401 && typeof window !== "undefined") {
    // A 60-minute access token expiring mid-task used to end the session. Try
    // the refresh token first and replay the request; only clear the session
    // when that fails too.
    if (allowRefresh && path !== "/auth/refresh" && (await refreshSession())) {
      return request<T>(path, init, false);
    }
    auth.clear();

    // Clearing the session used to leave the caller on the dashboard, where
    // every query then failed with a different error. Send them to sign in —
    // except when they are already on an auth page, which would loop.
    const onAuthPage = ["/login", "/register"].includes(window.location.pathname);
    if (!onAuthPage && process.env.NODE_ENV !== "production") {
      console.warn("Bypassing 401 redirect in development mode.");
    } else if (!onAuthPage) {
      window.location.href = "/login";
    }
  }
  throw new ApiError(response?.status ?? 0, String(message), payload);
}

const get = <T>(path: string) => request<T>(path);
const post = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });

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

export interface ActivityItem {
  id: string;
  status: "success" | "warning" | "pending" | "error";
  message: string;
  time: string;
}

export interface Plan {
  plan: "FREE" | "STARTER" | "GROWTH" | "PRO" | "ENTERPRISE";
  name: string;
  tagline: string;
  amountPaise: number;
  price: string;
  currency: string;
  interval: string;
  maxSites: number | null;
  maxSeats: number | null;
  features: string[];
  quotas: Record<string, number | null>;
}

export interface QuotaStatus {
  metric: string;
  limit: number | null;
  used: number;
  remaining: number | null;
}

export interface Entitlements {
  organizationId: string;
  plan: string;
  planName: string;
  status: string;
  subscriptionActive: boolean;
  features: string[];
  maxSites: number | null;
  maxSeats: number | null;
  periodStart: string;
  periodEnd: string;
  quotas: QuotaStatus[];
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
}

export interface TrackedPromptRow {
  id: string;
  text: string;
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
  startedAt: string | null;
  finishedAt: string | null;
  website?: { domain: string; url: string };
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
  performance?: CrawlPerformance | null;
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
}

export interface FixPatch {
  fixType: string;
  targetUrl: string;
  originalValue: string | null;
  proposedValue: string;
  codeSnippet: string;
  source: "model" | "heuristic";
  model?: string;
}

export interface StrategyContent {
  businessSummary: string;
  marketAnalysis: {
    positioning: string;
    targetAudience: string;
    demandSignals: string[];
    competitiveThreats: string[];
  };
  seoRoadmap: {
    horizon: string;
    action: string;
    why: string;
    effort: string;
    /** Current field. Reports generated before the agent rewrite used `expectedImpact`. */
    impact?: string;
    expectedImpact?: string;
    owner?: string;
    /** Key of the evidence this action was drawn from. */
    evidenceKey?: string;
  }[];
  contentPlan: { title: string; format: string; targetQuery: string; why: string }[];
  socialStrategy: { platform: string; cadence: string; contentThemes: string[]; why: string }[];
}

export interface StrategyReport {
  id: string;
  createdAt: string;
  generatedByModel: string | null;
  content?: StrategyContent;
  evidence?: unknown;
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
  createdAt: string;
}

/** One page kind on both sides of the coverage comparison. */
export interface CoverageRow {
  pageType: string;
  /** Null when that side has not been crawled — never substituted with zero. */
  ours: number | null;
  theirs: number | null;
  gap: number | null;
}

export interface CoverageSide {
  crawlJobId: string;
  crawledAt: string | null;
  totalPages: number;
  byType: Record<string, number>;
  /** Present on the competitor side: the crawl stopped at its page ceiling,
   *  so the counts are a floor rather than their total. */
  capped?: boolean;
  domain?: string;
}

export interface CoverageComparison {
  ours: CoverageSide | null;
  theirs: CoverageSide | null;
  /** Only the kinds where they genuinely lead, largest gap first. */
  behindOn: CoverageRow[];
  rows: CoverageRow[];
}

/** One page that appeared, disappeared, or was retitled between two crawls. */
export interface ChangedPage {
  url: string;
  title?: string | null;
  pageType: string;
}

export interface RetitledPage {
  url: string;
  pageType: string;
  from: string | null;
  to: string | null;
}

export interface CompetitorChanges {
  domain: string;
  since: string | null;
  until: string | null;
  added: ChangedPage[];
  removed: ChangedPage[];
  retitled: RetitledPage[];
  byType: Record<string, { added: number; removed: number }>;
}

/** One of their pages with no close counterpart found on your site. */
export interface CoverageOpportunity {
  url: string;
  title: string | null;
  pageType: string;
  /**
   * The nearest thing found on your own site, with how close it was (0-1).
   * Null when nothing shared a topic word. Shown rather than hidden so a topic
   * you cover in different wording is visible as such.
   */
  closestOwnPage: { url: string; title: string | null; score: number } | null;
}

export interface CoverageOpportunities {
  domain: string;
  /** How the list was produced, so it is never read as more certain than it is. */
  basis: string;
  total: number;
  opportunities: CoverageOpportunity[];
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
  configuration: { configured: boolean; missing: string[] };
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
  status: "OPEN" | "ACTIONED" | "DISMISSED";
  detectedAt: string;
  lastSeenAt: string;
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
  crawledAt: string | null;
  source: string;
}

export interface ExecutiveSummary {
  range: { days: number };
  connections: { searchConsole: boolean; analytics: boolean; businessProfile: boolean };
  headline: { searchClicks: Measure; impressions: Measure; sessions: Measure; conversions: Measure };
  siteHealth: SiteHealth | { state: "NO_DATA"; reason: string };
  openOpportunities: { total: number; highPotential: number };
}

export interface TrackedCompetitor {
  id: string;
  domain: string;
  label: string | null;
  createdAt: string;
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

export interface AiAnalysisResult {
  sentiment: 'positive' | 'negative' | 'neutral';
  keyThemes: string[];
  recommendations: string[];
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
  rank: number;
  businessFound: boolean;
  topCompetitors: {
    name: string;
    rank: number;
    rating?: number;
    reviewsCount?: number;
    distanceKm?: number;
  }[];
}

export interface GeoGridScanRequest {
  keyword: string;
  businessName?: string;
  lat?: number;
  lng?: number;
  gridSize?: 3 | 5;
  radiusKm?: number;
}

export interface GeoGridScanResult {
  keyword: string;
  businessName: string;
  centerCoordinates: { lat: number; lng: number };
  gridSize: number;
  radiusKm: number;
  scannedAt: string;
  metrics: {
    averageGridRank: number;
    top3DominancePercentage: number;
    top1Count: number;
    top3Count: number;
    top10Count: number;
    unrankedCount: number;
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

export interface OutreachContact {
  id: string;
  campaignId: string;
  email: string;
  domain: string;
  status: string;
  lastContact: string | null;
}

export interface OutreachCampaign {
  id: string;
  projectId: string;
  name: string;
  status: string;
  sentCount: number;
  replyCount: number;
  linkCount: number;
  createdAt: string;
  updatedAt: string;
  _count?: {
    contacts: number;
  };
}

export interface CustomReport {
  id: string;
  projectId: string;
  name: string;
  frequency: string;
  recipients: string[];
  format: string;
  createdAt: string;
  updatedAt: string;
}

export interface ClientPortalConfig {
  id: string;
  projectId: string;
  customDomain: string | null;
  logoUrl: string | null;
  themeColor: string | null;
  isPublic: boolean;
  updatedAt: string;
}

export interface ReportingConfig {
  customReports: CustomReport[];
  clientPortal: ClientPortalConfig;
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
  plan: string;
  sites: number;
  health: number;
  quota: number;
  status: string;
}

export interface MarketIntelligenceData {
  sentimentScore: number;
  sentimentSummary: string | null;
  trendingTopics: string[];
}

export interface MonitoringConfigData {
  uptimeStatus: string;
  uptimePercentage: number;
  avgResponseTimeMs: number;
  sslStatus: string;
  performanceScore: number;
  mobileScore: number;
  coreWebVitalsStatus: string;
}

export interface IntegrationConfigData {
  gaConnected: boolean;
  gscConnected: boolean;
  hubspotConnected?: boolean;
  gaPropertyId?: string | null;
  gscPropertyId?: string | null;
  hubspotPortalId?: string | null;
  updatedAt?: string | null;
}


// ─────────────────────────────────────────────────── market research

export type ResearchSourceType =
  | "PUBLIC_WEB"
  | "CLIENT_WEBSITE"
  | "UPLOADED_FILE"
  | "AI_VISIBILITY_CHECK"
  | "INTEGRATION_DATA";

export interface ResearchSource {
  id: string;
  sourceKey: string;
  type: ResearchSourceType;
  url: string | null;
  internalDocId: string | null;
  title: string;
  publisher: string | null;
  publishedAt: string | null;
  retrievedAt: string;
  excerpt: string;
  qualityScore: number;
}

export interface ResearchAnswer {
  summary: string;
  confidence: "high" | "medium" | "low";
  verifiedClaims: { claim: string; citationIds: string[] }[];
  inferences: { statement: string; reasoning: string; citationIds: string[] }[];
  citationGaps: {
    topic: string;
    gap: string;
    competitorsWinning: string[];
    recommendedResponse: string;
    impact: "high" | "medium" | "low";
    effort: "high" | "medium" | "low";
  }[];
  recommendedActions: {
    type: string;
    title: string;
    description: string;
    evidenceCitationIds: string[];
    expectedImpact: string;
    confidence: "high" | "medium" | "low";
    requiresApproval: boolean;
  }[];
  evidenceGaps: string[];
}


/** A stage of a research run, in the order the backend performs them. */
export type ResearchStage = "classify" | "client" | "web" | "assemble" | "answer" | "verify";

export interface ResearchProgressEvent {
  type: "progress";
  stage: ResearchStage;
  status: "started" | "done";
  /** One line for the operator, e.g. "7 pages from the crawl". */
  detail?: string;
  /** Present on `assemble`/done: the citable set, so the rail can fill early. */
  sources?: ResearchSource[];
}

export type ResearchStreamEvent =
  | ResearchProgressEvent
  | { type: "done"; result: ResearchAskResult }
  | { type: "error"; message: string; status?: number };

export interface ResearchAskResult {
  threadId: string;
  runId: string;
  answer: ResearchAnswer;
  sources: ResearchSource[];
}

export interface ResearchThreadSummary {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export type MarketScopeRegion = 'worldwide' | 'india' | 'maharashtra';

export interface AutoIdentifiedCompetitor {
  domain: string;
  name: string;
  industry: string;
  description: string;
  overlapScore: number;
  marketPosition: string;
  location?: string;
  sampleKeywords: string[];
  keyDifferentiator: string;
  isAlreadyAdded?: boolean;
  existingId?: string;
  /** Proven to be a real company: live site fetched, or hand-checked list. */
  verified?: boolean;
  /** Title tag read from the live site while verifying. */
  verifiedTitle?: string;
  verifiedAt?: string;
  /**
   * `content` — the homepage was read and matched this market.
   * `reachable` — a live server answered but refused to serve a bot, which is
   * how most large consumer brands respond. The company is proven real; its
   * copy was not read, and the badge says so rather than overstating.
   */
  verificationLevel?: "content" | "reachable";
  /**
   * `search` — found ranking for your own buyer keywords. `ai` — recalled by
   * the model. `curated` — from the hand-checked list, used only to top up.
   */
  source?: "search" | "ai" | "curated";
}

/** What the platform read off the client's own website. */
export interface DetectedBusinessProfile {
  domain: string;
  businessName: string;
  industry: string;
  summary: string;
  offerings: string[];
  businessModel: string;
  city: string;
  state: string;
  country: string;
  suggestedRegion: MarketScopeRegion;
  seedKeywords: string[];
  confidence: "high" | "medium" | "low";
  signals: string[];
  source: "ai" | "heuristic";
  detectedAt: string;
}

/** A suggested competitor that failed verification, with the reason. */
export interface RejectedCompetitor {
  domain: string;
  name: string;
  reason: string;
  detail: string;
}

export interface AutoIdentifyCompetitorsResponse {
  customerDomain: string;
  businessName: string;
  industry: string;
  region: string;
  identifiedAt: string;
  topCompetitors: AutoIdentifiedCompetitor[];
  businessProfile?: DetectedBusinessProfile | null;
  /** The niche came from the website, not from the operator. */
  industryWasDetected?: boolean;
  /** The geography came from the client's own address. */
  regionWasDetected?: boolean;
  rejected?: RejectedCompetitor[];
  notes?: string[];
}

export interface AddSelectedCompetitorsBody {
  competitors: Array<{
    domain: string;
    name?: string;
    label?: string;
    industry?: string;
    description?: string;
    location?: string;
    confidenceScore?: number;
  }>;
}

export interface AddSelectedCompetitorsResponse {
  success: boolean;
  count: number;
  addedCompetitors: Array<{
    id: string;
    projectId: string;
    domain: string;
    label: string | null;
    name: string | null;
    industry: string | null;
    description: string | null;
    confidenceScore: number | null;
    status: string;
  }>;
}

export type MarketActionStatus = "PROPOSED" | "APPROVED" | "REJECTED" | "CONVERTED";

export interface MarketActionRow {
  id: string;
  type: string;
  title: string;
  description: string;
  expectedImpact: string | null;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  status: MarketActionStatus;
  convertedToId: string | null;
  createdAt: string;
  run: { id: string; question: string; sources: ResearchSource[] } | null;
  opportunity: { id: string; topic: string; gap: string } | null;
}

export interface MarketOpportunityRow {
  id: string;
  topic: string;
  gap: string;
  competitorsWinning: string[];
  recommendedResponse: string;
  impact: "HIGH" | "MEDIUM" | "LOW";
  effort: "HIGH" | "MEDIUM" | "LOW";
  createdAt: string;
  run: { id: string; question: string } | null;
}


export interface MarketOutcomeRow {
  id: string;
  status: "PENDING" | "MEASURED" | "INCONCLUSIVE";
  baselineAt: string;
  baselineCitationSharePct: number | null;
  measuredAt: string | null;
  citationSharePct: number | null;
  deltaPt: number | null;
  note: string | null;
  action: { id: string; title: string; type: string; status: string };
}

// ──────────────────────────────────────────────────────────────── the API

export const api = {
  // SEO Tools
  generateSchema: async (projectId: string, url: string, type: string) => 
    post<any>(`/api/projects/${projectId}/seo-tools/schema/generate`, { url, type }),
  analyzeMetaTags: async (projectId: string, url: string) => 
    post<any>(`/api/projects/${projectId}/seo-tools/meta/analyze`, { url }),
  optimizeImages: async (projectId: string, url: string) => 
    post<any>(`/api/projects/${projectId}/seo-tools/images/analyze`, { url }),
  suggestInternalLinks: async (projectId: string, url: string) => 
    post<any>(`/api/projects/${projectId}/seo-tools/internal-links/suggest`, { url }),
  getSeoGapMatrix: async (projectId: string) =>
    get<any>(`/api/projects/${projectId}/seo-tools/competitor-matrix`),
  generateSeoGapInsights: async (projectId: string) =>
    post<any>(`/api/projects/${projectId}/seo-tools/seo-insights`, {}),

  // ── Voice Agent
  voice: {
    createSession: async (projectId?: string) => post<any>('/api/voice/session', { projectId }),
    chat: async (payload: any) => post<any>('/api/voice/chat', payload),
  },

  // ── Auth
  async login(email: string, password: string) {
    const result = await post<{ access_token: string; refresh_token?: string }>("/auth/login", { email, password });
    auth.setToken(result.access_token);
    if (result.refresh_token) auth.setRefreshToken(result.refresh_token);
    return result;
  },
  async register(data: { email: string; password: string; firstName?: string; lastName?: string }) {
    const result = await post<{ access_token: string; refresh_token?: string }>("/auth/register", data);
    auth.setToken(result.access_token);
    if (result.refresh_token) auth.setRefreshToken(result.refresh_token);
    return result;
  },
  getMe: () => get<UserProfile>('/auth/me'),
  logout: async () => {
    try {
      await post<{ success: boolean }>("/auth/logout").catch(() => {});
    } catch {
      // Ignore network errors on logout
    } finally {
      auth.clear();
    }
  },


  // ── Local SEO
  searchLocalBusiness: (projectId: string, query: string) =>
    post<{ placeId: string; name: string; address: string; rating: number; userRatingsTotal: number }[]>(`/api/projects/${projectId}/local-seo/search`, { query }),
  connectLocalBusiness: (projectId: string, data: { businessName: string; address: string; rating: number; reviewCount: number }) =>
    post<LocalSeoData>(`/api/projects/${projectId}/local-seo/connect`, data),
  getLocalSeo: (projectId: string) => get<LocalSeoData>(`/api/projects/${projectId}/local-seo`),
  analyzeGbp: (projectId: string) => post<any[]>(`/api/projects/${projectId}/local-seo/gbp/analyze`, {}),
  getGbpProposals: (projectId: string) => get<any[]>(`/api/projects/${projectId}/local-seo/gbp/proposals`),
  approveGbpFix: (projectId: string, proposalId: string) => post<{ success: boolean }>(`/api/projects/${projectId}/local-seo/gbp/fix/${proposalId}/approve`, {}),
  rejectGbpFix: (projectId: string, proposalId: string) => post<{ success: boolean }>(`/api/projects/${projectId}/local-seo/gbp/fix/${proposalId}/reject`, {}),
  runGeoGridScan: (projectId: string, body: { keyword: string; businessName?: string; lat?: number; lng?: number; gridSize?: number; radiusKm?: number }) =>
    post<any>(`/api/projects/${projectId}/local-seo/geo-grid/run`, body),
  getLocalReviews: (projectId: string) => get<LocalReview[]>(`/api/projects/${projectId}/local-seo/reviews`),
  syncLocalReviews: (projectId: string) => post<{ message: string; count: number }>(`/api/projects/${projectId}/local-seo/reviews/sync`, {}),
  draftReviewReply: (projectId: string, reviewId: string) => post<LocalReview>(`/api/projects/${projectId}/local-seo/reviews/${reviewId}/draft`, {}),
  publishReviewReply: (projectId: string, reviewId: string, replyText: string) => post<LocalReview>(`/api/projects/${projectId}/local-seo/reviews/${reviewId}/publish`, { replyText }),


  // ── Market research
  listResearchThreads: (projectId: string) =>
    get<ResearchThreadSummary[]>(`/api/projects/${projectId}/market-research/threads`),
  getResearchThread: (projectId: string, threadId: string) =>
    get<{
      id: string;
      title: string;
      messages: { id: string; role: "USER" | "ASSISTANT"; content: string; runId: string | null; createdAt: string }[];
      runs: { id: string; question: string; answer: ResearchAnswer | null; sources: ResearchSource[] }[];
    }>(`/api/projects/${projectId}/market-research/threads/${threadId}`),
  /** Opening prompts written around this client's own business, from its crawl. */
  getSuggestedResearchQuestions: (projectId: string) =>
    get<string[]>(`/api/projects/${projectId}/market-research/suggested-questions`),
  /** Auto-identifies top 5 competitors for this project's website using AI competitive intelligence. */
  /** What this client sells, detected from their own website. */
  getBusinessProfile: (projectId: string, refresh = false) =>
    get<DetectedBusinessProfile | null>(
      `/api/projects/${projectId}/market-research/business-profile${refresh ? "?refresh=true" : ""}`,
    ),
  /** Stores an operator's correction to the detected niche or geography. */
  setBusinessProfile: (
    projectId: string,
    body: { industry?: string; businessName?: string; region?: MarketScopeRegion },
  ) =>
    post<DetectedBusinessProfile | null>(
      `/api/projects/${projectId}/market-research/business-profile`,
      body,
    ),
  autoIdentifyCompetitors: (
    projectId: string,
    body?: {
      websiteUrl?: string;
      domain?: string;
      industry?: string;
      businessName?: string;
      region?: MarketScopeRegion | string;
      refreshProfile?: boolean;
    },
  ) =>
    post<AutoIdentifyCompetitorsResponse>(
      `/api/projects/${projectId}/market-research/auto-identify-competitors`,
      body ?? {},
    ),
  /** Batch-adds user-selected competitors (e.g. 3 of 5) to project tracking. */
  addSelectedCompetitors: (projectId: string, body: AddSelectedCompetitorsBody) =>
    post<AddSelectedCompetitorsResponse>(
      `/api/projects/${projectId}/market-research/add-selected-competitors`,
      body,
    ),
  askResearch: (projectId: string, body: { question: string; threadId?: string; deepResearch?: boolean }) =>
    post<ResearchAskResult>(`/api/projects/${projectId}/market-research/ask`, body),
  getResearchRunSources: (projectId: string, runId: string) =>
    get<ResearchSource[]>(`/api/projects/${projectId}/market-research/runs/${runId}/sources`),

  listMarketActions: (projectId: string, status?: MarketActionStatus) =>
    get<MarketActionRow[]>(
      `/api/projects/${projectId}/market-research/actions${status ? `?status=${status}` : ""}`,
    ),
  listMarketOpportunities: (projectId: string) =>
    get<MarketOpportunityRow[]>(`/api/projects/${projectId}/market-research/opportunities`),
  approveMarketAction: (projectId: string, actionId: string) =>
    post<MarketActionRow>(`/api/projects/${projectId}/market-research/actions/${actionId}/approve`, {}),
  rejectMarketAction: (projectId: string, actionId: string) =>
    post<MarketActionRow>(`/api/projects/${projectId}/market-research/actions/${actionId}/reject`, {}),
  convertMarketAction: (projectId: string, actionId: string) =>
    post<MarketActionRow>(`/api/projects/${projectId}/market-research/actions/${actionId}/convert`, {}),

  listMarketOutcomes: (projectId: string) =>
    get<MarketOutcomeRow[]>(`/api/projects/${projectId}/market-research/outcomes`),
  measureMarketAction: (projectId: string, actionId: string) =>
    post<MarketOutcomeRow>(`/api/projects/${projectId}/market-research/actions/${actionId}/measure`, {}),

  // ── Organizations & projects
  listOrganizations: () => get<{ id: string; name: string; slug: string }[]>("/organizations"),
  createOrganization: (name: string, slug: string) => post<{ id: string; name: string; slug: string }>("/organizations", { name, slug }),
  listProjects: (orgId: string) => get<{ id: string; name: string }[]>(`/projects/org/${orgId}`),
  listMembers: (orgId: string) => get<OrgMember[]>(`/organizations/${orgId}/members`),
  addMember: (orgId: string, email: string, role: Role = "MEMBER") =>
    post<OrgMember>(`/organizations/${orgId}/members`, { email, role }),
  updateMemberRole: (orgId: string, memberId: string, role: Role) =>
    request<OrgMember>(`/organizations/${orgId}/members/${memberId}`, { method: "PATCH", body: JSON.stringify({ role }) }),
  removeMember: (orgId: string, memberId: string) =>
    request<{ success: boolean }>(`/organizations/${orgId}/members/${memberId}`, { method: "DELETE" }),
  createProject: (name: string, organizationId: string) =>
    post<{ id: string; name: string }>("/projects", { name, organizationId }),

  // ── Agency portfolio
  getPortfolio: (orgId: string, days = 28) =>
    get<PortfolioResponse>(`/api/organizations/${orgId}/portfolio?days=${days}`),
  setRetainer: (orgId: string, projectId: string, body: { tier?: string | null; retainerMonthlyMinor?: number | null; retainerCurrency?: string }) =>
    request(`/api/organizations/${orgId}/portfolio/clients/${projectId}/retainer`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  // ── Billing
  getPlans: () => get<{ plans: Plan[]; gateway: string; configured: boolean }>("/api/billing/plans"),
  getEntitlements: (orgId: string) =>
    get<Entitlements>(`/api/billing/organizations/${orgId}/entitlements`),
  getSubscription: (orgId: string) => get<Record<string, unknown> | null>(`/api/billing/organizations/${orgId}/subscription`),
  startCheckout: (orgId: string, plan: string, email: string, name?: string) =>
    post<{
      subscriptionId: string;
      razorpayKeyId: string;
      shortUrl: string | null;
      planName: string;
      price: string;
    }>(`/api/billing/organizations/${orgId}/checkout`, { plan, email, name }),
  cancelSubscription: (orgId: string) => post(`/api/billing/organizations/${orgId}/cancel`, {}),

  // ── Websites & crawls
  registerWebsite: (url: string, domain: string, projectId?: string) =>
    post<{ id: string; domain: string; verificationToken: string; instructions: string }>("/api/websites", {
      url,
      domain,
      projectId,
    }),
  verifyDomain: (id: string) => post(`/api/websites/${id}/verify`, {}),
  startCrawl: (params: { websiteId?: string; domain?: string; maxDepth?: number; maxConcurrency?: number; useSitemap?: boolean }) =>
    post<{ success: boolean; jobId: string }>("/api/crawls/start", params),
  getCrawlJob: (jobId: string) => get<CrawlJob>(`/api/crawls/${jobId}`),
  getLatestCrawl: (domain: string) => get<CrawlJob | null>(`/api/websites/${domain}/latest-crawl`),
  getCrawlHistory: (domain: string, limit?: number) =>
    get<CrawlHistoryPoint[]>(
      `/api/websites/${domain}/crawl-history${limit ? `?limit=${limit}` : ""}`,
    ),
  getCrawlIssues: (jobId: string, params?: { severity?: string; page?: number; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.severity) query.set("severity", params.severity);
    if (params?.page) query.set("page", String(params.page));
    if (params?.limit) query.set("limit", String(params.limit));
    const suffix = query.toString() ? `?${query}` : "";
    return get<{ data: CrawlIssue[]; meta: { total: number; page: number; totalPages: number } }>(
      `/api/crawls/${jobId}/issues${suffix}`,
    );
  },
  getCrawlPages: (jobId: string, params?: { page?: number; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.page) query.set("page", String(params.page));
    if (params?.limit) query.set("limit", String(params.limit));
    const suffix = query.toString() ? `?${query}` : "";
    return get<{ data: CrawlPage[]; meta: { total: number; page: number; totalPages: number } }>(
      `/api/crawls/${jobId}/pages${suffix}`,
    );
  },
  getCrawlGraph: (jobId: string) => get<unknown>(`/api/crawls/${jobId}/graph`),

  // ── AI analysis & fixes
  analyzeIssue: (issueId: string) => post<Record<string, string | number>>(`/api/issues/${issueId}/analyze`, {}),
  autoFixIssue: (issueId: string) =>
    post<FixPatch>(`/api/issues/${issueId}/autofix`, {}),
  approveFix: (issueId: string) => post(`/api/issues/${issueId}/approve`, {}),

  // ── AI visibility
  getVisibility: (projectId: string, days = 28) =>
    get<VisibilityReport>(`/api/projects/${projectId}/ai-visibility?days=${days}`),
  listTrackedPrompts: (projectId: string) =>
    get<TrackedPromptRow[]>(`/api/projects/${projectId}/ai-visibility/prompts`),
  addTrackedPrompts: (projectId: string, prompts: { text: string; cluster?: string }[]) =>
    post(`/api/projects/${projectId}/ai-visibility/prompts`, { prompts }),
  addCompetitor: (projectId: string, domain: string, label?: string) =>
    post(`/api/projects/${projectId}/ai-visibility/competitors`, { domain, label }),
  /**
   * Reads a competitor's own site for the social profiles it links, and
   * registers them for content ingestion.
   */
  discoverCompetitorAccounts: (projectId: string, competitorId: string) =>
    post<{ discovered: { platform: string; handle: string; profileUrl: string }[]; saved: number }>(
      `/api/projects/${projectId}/content-intelligence/competitors/${competitorId}/discover-accounts`,
      {},
    ),
  /**
   * Crawls the competitor's public website so their page coverage can be
   * compared with yours. Returns once the crawl is queued, not once it is
   * done — a few hundred pages at one request per second takes minutes.
   */
  crawlCompetitorSite: (projectId: string, competitorId: string) =>
    post<{ jobId: string; websiteId: string; domain: string; pageLimit: number }>(
      `/api/projects/${projectId}/content-intelligence/competitors/${competitorId}/crawl`,
      {},
    ),
  /** Both sides of the coverage comparison. Sides are null until crawled. */
  competitorComparison: (projectId: string, competitorId: string) =>
    get<CoverageComparison>(
      `/api/projects/${projectId}/content-intelligence/competitors/${competitorId}/comparison`,
    ),

  /**
   * What changed on their site between the last two crawls. Null until there
   * are two — a first crawl has nothing to be compared against.
   */
  competitorChanges: (projectId: string, competitorId: string) =>
    get<CompetitorChanges | null>(
      `/api/projects/${projectId}/content-intelligence/competitors/${competitorId}/changes`,
    ),

  /**
   * Their pages with no close counterpart on yours. Null until both sites have
   * been crawled — against an uncrawled own site every page they have would
   * look like an opportunity.
   */
  competitorOpportunities: (projectId: string, competitorId: string, pageType?: string) => {
    const qs = pageType ? `?pageType=${encodeURIComponent(pageType)}` : "";
    return get<CoverageOpportunities | null>(
      `/api/projects/${projectId}/content-intelligence/competitors/${competitorId}/opportunities${qs}`,
    );
  },

  triggerCompetitorCronSync: (projectId: string) =>
    post<{
      projectId: string;
      timestamp: string;
      competitorsCrawled: number;
      crawlResults: any[];
      newAlertsGenerated: number;
    }>(`/api/projects/${projectId}/content-intelligence/cron/trigger-sync`, {}),

  getCompetitorCoverage: (projectId: string, competitorId: string) =>
    get<{ competitorId: string; domain: string; crawlJobId: string; crawledAt: string; totalPages: number; capped: boolean; byType: Record<string, number>; untyped: number } | null>(
      `/api/projects/${projectId}/content-intelligence/competitors/${competitorId}/coverage`,
    ),

  listCompetitorPages: (projectId: string, competitorId: string, pageType?: string) =>
    get<Array<{ url: string; title: string | null; metaDescription: string | null; h1: string[]; pageType: string; wordCount: number; statusCode: number; responseTimeMs: number }>>(
      `/api/projects/${projectId}/content-intelligence/competitors/${competitorId}/pages${pageType ? `?pageType=${encodeURIComponent(pageType)}` : ""}`,
    ),

  // ── Google connections ───────────────────────────────────────────────────
  googleConnections: (projectId: string) =>
    get<GoogleConnectionStatus>(`/api/projects/${projectId}/integrations/google`),
  googleAuthorizeUrl: (projectId: string, provider: string, returnTo?: string) =>
    post<{ authorizationUrl: string }>(
      `/api/projects/${projectId}/integrations/google/${provider}/authorize${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ""}`,
      {},
    ),
  googleSelectResource: (projectId: string, provider: string, resourceId: string, resourceName: string) =>
    post(
      `/api/projects/${projectId}/integrations/google/${provider}/select?resourceId=${encodeURIComponent(resourceId)}&resourceName=${encodeURIComponent(resourceName)}`,
      {},
    ),
  googleDisconnect: (projectId: string, provider: string) =>
    request<{ disconnected: boolean; revoked?: boolean }>(
      `/api/projects/${projectId}/integrations/google/${provider}`,
      { method: "DELETE" },
    ),

  // ── Search Console ───────────────────────────────────────────────────────
  gscProperties: (projectId: string) =>
    get<{
      properties: { propertyId: string; kind: "DOMAIN" | "URL_PREFIX"; permissionLevel?: string }[];
      /** Why the list is empty, when it is — the causes need opposite fixes. */
      diagnostics: { returnedByGoogle: number; excludedAsUnverified: number; googleAccountHasAnyProperty: boolean };
    }>(`/api/projects/${projectId}/search-console/properties`),
  gscSync: (projectId: string, days?: number) =>
    post<{ status: string; rowsWritten: number; failedGrains: string[] }>(
      `/api/projects/${projectId}/search-console/sync${days ? `?days=${days}` : ""}`,
      {},
    ),
  /** Null until a sync has stored something — the caller must not render zeroes. */
  gscCoverage: (projectId: string) =>
    get<{ newestDate: string; oldestDate: string } | null>(`/api/projects/${projectId}/search-console/coverage`),
  gscSummary: (projectId: string, days: number) =>
    get<GscSummary | null>(`/api/projects/${projectId}/search-console/summary?days=${days}`),
  gscTimeseries: (projectId: string, days: number) =>
    get<GscPoint[]>(`/api/projects/${projectId}/search-console/timeseries?days=${days}`),
  gscQueries: (projectId: string, days: number, limit = 50) =>
    get<GscRow[]>(`/api/projects/${projectId}/search-console/queries?days=${days}&limit=${limit}`),
  gscPages: (projectId: string, days: number, limit = 50) =>
    get<GscRow[]>(`/api/projects/${projectId}/search-console/pages?days=${days}&limit=${limit}`),
  gscPageQueries: (projectId: string, page: string, days: number) =>
    get<GscRow[]>(
      `/api/projects/${projectId}/search-console/page-queries?page=${encodeURIComponent(page)}&days=${days}`,
    ),
  gscStrikingDistance: (projectId: string, days: number) =>
    get<GscStrikingDistanceRow[]>(`/api/projects/${projectId}/search-console/striking-distance?days=${days}`),
  gscCtrOpportunities: (projectId: string, days: number) =>
    get<GscCtrOpportunity[]>(`/api/projects/${projectId}/search-console/ctr-opportunities?days=${days}`),
  gscDeclining: (projectId: string, days: number) =>
    get<GscDecliningRow[]>(`/api/projects/${projectId}/search-console/declining?days=${days}`),

  // ── Growth opportunities ─────────────────────────────────────────────────
  opportunities: (projectId: string, filters: { category?: string; status?: string } = {}) => {
    const params = new URLSearchParams();
    if (filters.category) params.set("category", filters.category);
    if (filters.status) params.set("status", filters.status);
    const qs = params.toString();
    return get<OpportunityList>(`/api/projects/${projectId}/opportunities${qs ? `?${qs}` : ""}`);
  },
  detectOpportunities: (projectId: string) =>
    post<{ detected: number; failedDetectors: string[] }>(`/api/projects/${projectId}/opportunities/detect`, {}),
  setOpportunityStatus: (projectId: string, id: string, status: "OPEN" | "ACTIONED" | "DISMISSED") =>
    request<GrowthOpportunity>(`/api/projects/${projectId}/opportunities/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),

  // ── Analytics (GA4) ──────────────────────────────────────────────────────
  ga4Properties: (projectId: string) =>
    get<{ propertyId: string; displayName: string; accountName: string }[]>(
      `/api/projects/${projectId}/analytics/properties`,
    ),
  ga4Sync: (projectId: string, days?: number) =>
    post<{ status: string; rowsWritten: number }>(
      `/api/projects/${projectId}/analytics/sync${days ? `?days=${days}` : ""}`,
      {},
    ),
  ga4Summary: (projectId: string, days: number) =>
    get<Ga4Summary | null>(`/api/projects/${projectId}/analytics/summary?days=${days}`),
  ga4Timeseries: (projectId: string, days: number) =>
    get<Ga4Point[]>(`/api/projects/${projectId}/analytics/timeseries?days=${days}`),
  /** Organic clicks joined to sessions and conversions, per page. */
  ga4PageValue: (projectId: string, days: number) =>
    get<PageValue>(`/api/projects/${projectId}/analytics/page-value?days=${days}`),

  executiveSummary: (projectId: string, days = 28) =>
    get<ExecutiveSummary>(`/api/projects/${projectId}/opportunities/executive-summary?days=${days}`),

  /** Tracked competitors, whether or not any prompt has cited them yet. */
  listCompetitors: (projectId: string) =>
    get<TrackedCompetitor[]>(`/api/projects/${projectId}/ai-visibility/competitors`),
  removeCompetitor: (projectId: string, competitorId: string) =>
    request<{ removed: number }>(`/api/projects/${projectId}/ai-visibility/competitors/${competitorId}`, {
      method: "DELETE",
    }),
  runVisibilitySweep: (projectId: string) =>
    post<{ checksRun: number; checksFailed: number; citations: number; skippedAssistants: string[] }>(
      `/api/projects/${projectId}/ai-visibility/sweep`,
      {},
    ),
  getAeo: (projectId: string) => get<unknown>(`/api/projects/${projectId}/ai-visibility/aeo`),

  // ── Strategy
  getStrategyEvidence: (projectId: string) => get<unknown>(`/api/projects/${projectId}/strategy/evidence`),
  listStrategies: (projectId: string) => get<StrategyReport[]>(`/api/projects/${projectId}/strategy`),
  getStrategy: (projectId: string, reportId: string) =>
    get<StrategyReport>(`/api/projects/${projectId}/strategy/${reportId}`),
  generateStrategy: (projectId: string) => post<StrategyReport>(`/api/projects/${projectId}/strategy`, {}),

  // ── PR & Outreach
  getOutreachCampaigns: (projectId: string) => get<OutreachCampaign[]>(`/api/projects/${projectId}/outreach`),

  // ── Reporting
  getReportingConfig: (projectId: string) => get<ReportingConfig>(`/api/projects/${projectId}/reporting`),

  getMarketIntelligence: (projectId: string) => get<MarketIntelligenceData>(`/api/projects/${projectId}/market`),
  generateMarketIntelligence: (projectId: string) => post<MarketIntelligenceData>(`/api/projects/${projectId}/market/generate`, {}),

  // ── Monitoring
  getMonitoring: (projectId: string) => get<MonitoringConfigData>(`/api/projects/${projectId}/monitoring`),

  // ── Integrations
  getIntegrations: (projectId: string) => get<IntegrationConfigData>(`/api/projects/${projectId}/integrations`),

  // ── Activity
  getActivity: (projectId: string, limit = 30) =>
    get<ActivityItem[]>(`/api/projects/${projectId}/activity?limit=${limit}`),

  // ── AI assistant chat (project-scoped, uses MultiAiRouter / plan routing)
  askAi: (projectId: string, question: string) =>
    post<{ answer: string; model: { provider: string; name: string } }>(
      `/api/projects/${projectId}/chat`,
      { question },
    ),

  // ── Groq Llama 3.1 8B Instant — general-purpose AI chat
  // The GROQ_API_KEY lives ONLY on the backend. This calls our NestJS server,
  // which then securely calls Groq. The API key never reaches the browser.
  aiChat: (message: string, systemPrompt?: string) =>
    post<{
      success: boolean;
      response?: string;
      error?: string;
      usage?: { inputTokens: number; outputTokens: number; totalTokens: number; estimatedCostUsd: number | null };
      model?: string;
    }>('/api/ai/chat', { message, ...(systemPrompt ? { systemPrompt } : {}) }),

  aiChatMulti: (
    messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
    systemPrompt?: string,
  ) =>
    post<{
      success: boolean;
      response?: string;
      error?: string;
      usage?: { inputTokens: number; outputTokens: number; totalTokens: number; estimatedCostUsd: number | null };
      model?: string;
    }>('/api/ai/chat', { messages, ...(systemPrompt ? { systemPrompt } : {}) }),

  aiHealth: () =>
    get<{ success: boolean; provider: string; model: string; configured: boolean }>('/api/ai/health'),

  // ── Autonomous engineer: repository + content pipeline
  getRepository: (projectId: string) => get<SiteRepository | null>(`/api/projects/${projectId}/automation/repository`),
  connectRepository: (
    projectId: string,
    body: { owner: string; name: string; accessToken: string; defaultBranch?: string; framework?: string; contentDir?: string; autoMerge?: boolean },
  ) => post<SiteRepository>(`/api/projects/${projectId}/automation/repository`, body),
  planContent: (projectId: string) => post<ContentPiece[]>(`/api/projects/${projectId}/automation/content/plan`, {}),
  listContent: (projectId: string) => get<ContentPiece[]>(`/api/projects/${projectId}/automation/content`),
  draftContent: (projectId: string, pieceId: string) =>
    post<ContentPiece>(`/api/projects/${projectId}/automation/content/${pieceId}/draft`, {}),
  runContentPieces: (projectId: string, pieceIds?: string[]) =>
    post<AutomationRun>(`/api/projects/${projectId}/automation/runs/content`, pieceIds ? { pieceIds } : {}),
  runFixes: (projectId: string, issueIds?: string[]) =>
    post<AutomationRun>(`/api/projects/${projectId}/automation/runs/fixes`, issueIds ? { issueIds } : {}),
  listAutomationRuns: (projectId: string) => get<AutomationRun[]>(`/api/projects/${projectId}/automation/runs`),

  // ── Admin
  getAdminQueues: () => get<QueueStat[]>("/api/admin/queues"),
  getAdminCosts: () => get<ApiCostStat[]>("/api/admin/costs"),
  getAdminTenants: () => get<TenantStat[]>("/api/admin/tenants"),

  // ── Content Intelligence & Creative Engine ──────────────────────────────

  // Dashboard
  getCIDashboard: (projectId: string) =>
    get<CIDashboard>(`/api/projects/${projectId}/content-intelligence/dashboard`),

  // Config
  getCIConfig: (projectId: string) =>
    get<CIConfig>(`/api/projects/${projectId}/content-intelligence/config`),
  upsertCIConfig: (projectId: string, body: Partial<CIConfig>) =>
    post<CIConfig>(`/api/projects/${projectId}/content-intelligence/config`, body),

  // Competitor accounts
  listCompetitorAccounts: (projectId: string) =>
    get<CompetitorAccount[]>(`/api/projects/${projectId}/content-intelligence/competitor-accounts`),
  addCompetitorAccount: (projectId: string, body: AddCompetitorAccountBody) =>
    post<CompetitorAccount>(`/api/projects/${projectId}/content-intelligence/competitor-accounts`, body),
  removeCompetitorAccount: (projectId: string, accountId: string) =>
    request<{ count: number }>(`/api/projects/${projectId}/content-intelligence/competitor-accounts/${accountId}`, { method: 'DELETE' }),
  toggleCompetitorAccount: (projectId: string, accountId: string, isActive: boolean) =>
    request<{ count: number }>(`/api/projects/${projectId}/content-intelligence/competitor-accounts/${accountId}/toggle`, {
      method: 'PATCH', body: JSON.stringify({ isActive }),
    }),

  // Competitor content
  listCompetitorContent: (projectId: string, params?: { platform?: string; contentType?: string; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.platform) q.set('platform', params.platform);
    if (params?.contentType) q.set('contentType', params.contentType);
    if (params?.limit) q.set('limit', String(params.limit));
    const qs = q.toString() ? `?${q}` : '';
    return get<CompetitorContent[]>(`/api/projects/${projectId}/content-intelligence/competitor-content${qs}`);
  },
  ingestCompetitorContent: (projectId: string, body: IngestContentBody) =>
    post<CompetitorContent>(`/api/projects/${projectId}/content-intelligence/competitor-content`, body),

  // Classification
  classifyContent: (projectId: string) =>
    post<{ classified: number; total: number }>(`/api/projects/${projectId}/content-intelligence/classify`, {}),

  // Pattern detection
  detectPatterns: (projectId: string) =>
    post<{ patternsDetected: number; message?: string }>(`/api/projects/${projectId}/content-intelligence/detect-patterns`, {}),
  listCreativePatterns: (projectId: string) =>
    get<CreativePattern[]>(`/api/projects/${projectId}/content-intelligence/patterns`),

  // Gap analysis
  analyzeGaps: (projectId: string) =>
    post<{ gapsGenerated: number }>(`/api/projects/${projectId}/content-intelligence/analyze-gaps`, {}),
  listContentGaps: (projectId: string, status?: string) => {
    const qs = status ? `?status=${status}` : '';
    return get<ContentGap[]>(`/api/projects/${projectId}/content-intelligence/gaps${qs}`);
  },
  updateGapStatus: (projectId: string, gapId: string, status: string) =>
    request<{ count: number }>(`/api/projects/${projectId}/content-intelligence/gaps/${gapId}/status`, {
      method: 'PATCH', body: JSON.stringify({ status }),
    }),

  // Content Strategy
  generateContentStrategy: (projectId: string) =>
    post<ContentStrategy>(`/api/projects/${projectId}/content-intelligence/strategy/generate`, {}),
  listContentStrategies: (projectId: string) =>
    get<ContentStrategy[]>(`/api/projects/${projectId}/content-intelligence/strategy`),
  getContentStrategy: (projectId: string, strategyId: string) =>
    get<ContentStrategy>(`/api/projects/${projectId}/content-intelligence/strategy/${strategyId}`),
  approveContentStrategy: (projectId: string, strategyId: string) =>
    post<{ count: number }>(`/api/projects/${projectId}/content-intelligence/strategy/${strategyId}/approve`, {}),

  // ── Competitor Social Video Intelligence Endpoints ───────────────────────
  discoverSocialProfiles: (projectId: string, body: { website: string; businessName?: string; location?: string; industry?: string }) =>
    post<{ competitorDomain: any; accounts: CompetitorAccount[] }>(`/api/projects/${projectId}/content-intelligence/discover-profiles`, body),

  ingestAndAnalyzeVideo: (projectId: string, body: any) =>
    post<{ content: CompetitorContent; analysis: any }>(`/api/projects/${projectId}/content-intelligence/analyze-video`, body),

  getVideoDetails: (projectId: string, contentId: string) =>
    get<CompetitorContent>(`/api/projects/${projectId}/content-intelligence/video-details/${contentId}`),

  getCrossCompetitorMatrix: (projectId: string) =>
    get<CrossCompetitorMatrix>(`/api/projects/${projectId}/content-intelligence/cross-competitor-matrix`),

  getEnrichedOpportunities: (projectId: string) =>
    get<EnrichedOpportunity[]>(`/api/projects/${projectId}/content-intelligence/enriched-opportunities`),

  generateVideoScript: (projectId: string, body: { topic: string; platform?: string; opportunityContext?: string }) =>
    post<VideoBriefAndScript>(`/api/projects/${projectId}/content-intelligence/generate-video-script`, body),

  saveVideoScriptToCalendar: (projectId: string, body: { scriptData: VideoBriefAndScript; scheduledDate?: string }) =>
    post<CalendarItem>(`/api/projects/${projectId}/content-intelligence/save-video-script`, body),

  getCompetitorAlerts: (projectId: string) =>
    get<CompetitorChangeAlert[]>(`/api/projects/${projectId}/content-intelligence/competitor-alerts`),

  recordOutcome: (projectId: string, body: any) =>
    post<{ success: boolean; message: string; outcomeSummary: any }>(`/api/projects/${projectId}/content-intelligence/record-outcome`, body),

  updateAlertStatus: (projectId: string, alertId: string, status: string) =>
    request<{ count: number }>(`/api/projects/${projectId}/content-intelligence/competitor-alerts/${alertId}/status`, {
      method: 'PATCH', body: JSON.stringify({ status }),
    }),

  // Content Calendar
  generateContent: (projectId: string, body: GenerateContentBody) =>
    post<CalendarItem>(`/api/projects/${projectId}/content-intelligence/generate-content`, body),
  listCalendarItems: (projectId: string, params?: CalendarFilter) => {
    const q = new URLSearchParams();
    if (params?.status) q.set('status', params.status);
    if (params?.platform) q.set('platform', params.platform);
    if (params?.campaignId) q.set('campaignId', params.campaignId);
    if (params?.from) q.set('from', params.from);
    if (params?.to) q.set('to', params.to);
    const qs = q.toString() ? `?${q}` : '';
    return get<CalendarItem[]>(`/api/projects/${projectId}/content-intelligence/calendar${qs}`);
  },
  createCalendarItem: (projectId: string, body: CreateCalendarItemBody) =>
    post<CalendarItem>(`/api/projects/${projectId}/content-intelligence/calendar`, body),
  updateCalendarItem: (projectId: string, itemId: string, body: Partial<CalendarItem>) =>
    request<{ count: number }>(`/api/projects/${projectId}/content-intelligence/calendar/${itemId}`, {
      method: 'PATCH', body: JSON.stringify(body),
    }),

  // Campaigns
  listCICampaigns: (projectId: string) =>
    get<CICampaign[]>(`/api/projects/${projectId}/content-intelligence/campaigns`),
  getCICampaign: (projectId: string, campaignId: string) =>
    get<CICampaign>(`/api/projects/${projectId}/content-intelligence/campaigns/${campaignId}`),
  createCICampaign: (projectId: string, body: CreateCampaignBody) =>
    post<CICampaign>(`/api/projects/${projectId}/content-intelligence/campaigns`, body),
  updateCICampaignStatus: (projectId: string, campaignId: string, status: string) =>
    request<{ count: number }>(`/api/projects/${projectId}/content-intelligence/campaigns/${campaignId}/status`, {
      method: 'PATCH', body: JSON.stringify({ status }),
    }),
  matchCreatorsToCampaign: (projectId: string, campaignId: string) =>
    post<{ matched: number }>(`/api/projects/${projectId}/content-intelligence/campaigns/${campaignId}/match-creators`, {}),

  // Creators
  listCreators: (projectId: string) =>
    get<Creator[]>(`/api/projects/${projectId}/content-intelligence/creators`),
  addCreator: (projectId: string, body: AddCreatorBody) =>
    post<Creator>(`/api/projects/${projectId}/content-intelligence/creators`, body),
  updateCreator: (projectId: string, creatorId: string, body: Partial<Creator>) =>
    request<{ count: number }>(`/api/projects/${projectId}/content-intelligence/creators/${creatorId}`, {
      method: 'PATCH', body: JSON.stringify(body),
    }),

  // Outreach
  generateOutreachMessage: (projectId: string, body: GenerateOutreachBody) =>
    post<{ outreach: CreatorOutreach; generated: { subject: string; messageBody: string } }>(
      `/api/projects/${projectId}/content-intelligence/creators/outreach`, body),
  listOutreach: (projectId: string) =>
    get<CreatorOutreach[]>(`/api/projects/${projectId}/content-intelligence/creators/outreach`),
  approveOutreach: (projectId: string, outreachId: string) =>
    post<{ count: number }>(`/api/projects/${projectId}/content-intelligence/creators/outreach/${outreachId}/approve`, {}),
  updateOutreachStage: (projectId: string, outreachId: string, stage: string) =>
    request<{ count: number }>(`/api/projects/${projectId}/content-intelligence/creators/outreach/${outreachId}/stage`, {
      method: 'PATCH', body: JSON.stringify({ stage }),
    }),
};

// ── Content Intelligence types ────────────────────────────────────────────

export interface CIConfig {
  projectId: string;
  industrySkill: string;
  automationLevel: string;
  postingFrequency?: string | null;
}

export interface CIDashboard {
  stats: {
    competitorsTracked: number;
    contentAnalyzed: number;
    classified: number;
    creativePatterns: number;
    contentGaps: number;
    strategies: number;
    campaigns: number;
    platformBreakdown: { platform: string; _count: { id: number } }[];
  };
  topOpportunities: ContentGap[];
  topPatterns: CreativePattern[];
}

export interface CompetitorAccount {
  id: string;
  organizationId: string;
  projectId: string;
  competitorId: string;
  platform: string;
  handle: string;
  profileUrl: string | null;
  displayName: string | null;
  businessName?: string | null;
  website?: string | null;
  location?: string | null;
  industry?: string | null;
  discoverySource?: string | null;
  verificationStatus?: string | null;
  matchConfidence?: number | null;
  followerCount: number | null;
  isActive: boolean;
  lastSyncedAt: string | null;
  createdAt: string;
  _count?: { content: number };
}

export interface AddCompetitorAccountBody {
  competitorId: string;
  platform: string;
  handle: string;
  displayName?: string;
  followerCount?: number;
  profileUrl?: string;
  website?: string;
  location?: string;
  industry?: string;
}

export interface TranscriptSegment {
  timestamp: string;
  text: string;
  type: 'HOOK' | 'PROBLEM' | 'EDUCATION' | 'SOLUTION' | 'CTA' | string;
}

export interface VideoScene {
  sceneNumber: number;
  timeRange: string;
  visualFormat: string;
  description: string;
  onScreenText?: string;
}

export interface VideoHookAnalysis {
  hook: string;
  hookType: string;
  durationSeconds: number;
  strength: string;
}

export interface VideoStructureAnalysis {
  hookDuration: number;
  intro: string;
  problem: string;
  solution: string;
  ctaPlacement: string;
  conclusion: string;
}

export interface ContentClassification {
  contentCategory: string | null;
  contentPillar?: string | null;
  topic?: string | null;
  subtopic?: string | null;
  format?: string | null;
  visualFormat: string | null;
  detectedTopics: string[];
  detectedObjects: string[];
  storytellingStyle: string | null;
  hookType: string | null;
  ctaType: string | null;
  ctaText?: string | null;
  audience?: string | null;
  searchIntent?: string | null;
  marketingIntent?: string | null;
  funnelStage?: string | null;
  tone?: string | null;
  language?: string | null;
  visualStyle?: string | null;
  contentObjective?: string | null;
  confidence?: number | null;
  creativityScore: number | null;
}

export interface CompetitorContent {
  id: string;
  platform: string;
  contentType: string | null;
  publishedAt: string | null;
  caption: string | null;
  title: string | null;
  description?: string | null;
  hashtags: string[];
  thumbnailUrl: string | null;
  contentUrl: string | null;
  duration?: number | null;
  transcript?: string | null;
  transcriptSegments?: TranscriptSegment[] | null;
  ocrText?: string | null;
  scenes?: VideoScene[] | null;
  hookAnalysis?: VideoHookAnalysis | null;
  structureAnalysis?: VideoStructureAnalysis | null;
  whyItWorks?: string | null;
  dataSourceType?: string | null;
  confidenceLevel?: string | null;
  likesCount: number | null;
  commentsCount: number | null;
  viewsCount: number | null;
  sharesCount?: number | null;
  classification?: ContentClassification | null;
  account?: {
    displayName: string | null;
    businessName?: string | null;
    platform: string;
    handle: string;
    location?: string | null;
    matchConfidence?: number | null;
    verificationStatus?: string | null;
  };
}

export interface CrossCompetitorMatrix {
  competitors: Array<{ id: string; handle: string; name: string; platform: string }>;
  matrixRows: Array<{
    topicOrPillar: string;
    categoryType: 'PILLAR' | 'TOPIC' | 'FORMAT' | 'FUNNEL';
    competitorCoverage: Record<string, boolean>;
    competitorFrequency: Record<string, number>;
    customerCoverage: boolean;
    customerFrequency: number;
    gapStatus: 'SATURATED' | 'COMPETITOR_WINNING' | 'CUSTOMER_WINNING' | 'CUSTOMER_MISSING' | 'MARKET_GAP';
    opportunityScore: number;
  }>;
  winningContent: Array<{
    id: string;
    title: string;
    platform: string;
    contentType: string | null;
    views: number;
    likes: number;
    comments: number;
    thumbnailUrl: string | null;
    publishedAt: string | null;
    topic: string;
    contentPillar: string;
    hookType: string;
    whyItWorks?: string | null;
    competitorName?: string;
  }>;
  commonPatterns: Array<{
    pattern: string;
    prevalence: string;
    averagePerformance: string;
    format: string;
    recommendation: string;
  }>;
  campaigns: Array<{
    id: string;
    competitorName: string;
    competitorHandle: string;
    theme: string;
    objective: string;
    startDate?: string;
    endDate?: string;
    contentCount: number;
    platforms: string[];
    sampleTitles: string[];
    performanceSignal: 'HIGH' | 'MEDIUM' | 'EMERGING';
  }>;
  totalCompetitorVideosAnalyzed: number;
}

export interface EnrichedOpportunity {
  id: string;
  topic: string;
  pillar: string;
  opportunityScore: number;
  breakdown: {
    businessRelevance: number;
    searchOpportunity: number;
    competitorEvidence: number;
    contentGap: number;
    confidence: number;
    effort: 'LOW' | 'MEDIUM' | 'HIGH';
  };
  targetMarket: string;
  competitorEvidenceSummary: string;
  relatedKeywords: Array<{ keyword: string; searchVolume?: number; intent: string }>;
  suggestedFormats: string[];
  recommendedAction: string;
}

export interface VideoScriptScene {
  sceneNumber: number;
  timeRange: string;
  sectionName: 'HOOK' | 'PROBLEM' | 'POINT_1' | 'POINT_2' | 'SOLUTION' | 'CTA';
  spokenScript: string;
  visualDirection: string;
  onScreenText: string;
  audioMusicCue?: string;
}

export interface VideoBriefAndScript {
  title: string;
  hook: string;
  platform: 'INSTAGRAM_REEL' | 'YOUTUBE_SHORTS' | 'YOUTUBE_VIDEO' | 'OMNICHANNEL';
  targetDuration: string;
  contentPillar: string;
  targetAudience: string;
  coreProblem: string;
  solutionSummary: string;
  callToAction: string;
  scenes: VideoScriptScene[];
  visualChecklist: string[];
  caption: string;
  hashtags: string[];
  originalityGuarantee: string;
}

export interface CompetitorChangeAlert {
  id: string;
  organizationId: string;
  projectId: string;
  competitorId?: string | null;
  accountHandle?: string | null;
  alertType: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  title: string;
  description: string;
  metricChange?: string | null;
  detectedAt: string;
  status: 'ACTIVE' | 'DISMISSED' | 'ACTIONED';
}

export interface IngestContentBody {
  accountId: string;
  platform: string;
  contentType?: string;
  caption?: string;
  title?: string;
  contentUrl?: string;
  thumbnailUrl?: string;
  publishedAt?: string;
  hashtags?: string[];
  likesCount?: number;
  commentsCount?: number;
  viewsCount?: number;
  duration?: number;
  rawTranscript?: string;
  rawOcrText?: string;
}

export interface CreativePattern {
  id: string;
  name: string;
  description: string;
  platforms: string[];
  contentCategories: string[];
  keyVisualElements: string[];
  storytellingApproach: string | null;
  ctaType: string | null;
  frequency: number;
  marketSaturation: number;
  opportunityScore: number;
  detectedAt: string;
}

export interface ContentGap {
  id: string;
  gapType: string;
  title: string;
  description: string;
  competitionLevel: string;
  opportunityScore: number;
  businessRelevanceScore?: number | null;
  searchOpportunityScore?: number | null;
  competitorEvidenceScore?: number | null;
  contentGapScore?: number | null;
  confidenceScore?: number | null;
  effortLevel?: string | null;
  relatedKeywords?: string[];
  platforms?: string[];
  suggestedFormats?: string[];
  recommendedAction: string | null;
  status: string;
  createdAt: string;
  pattern?: { name: string; opportunityScore: number } | null;
}

export interface ContentStrategy {
  id: string;
  title: string;
  status: string;
  industrySkill: string | null;
  generatedByModel: string | null;
  createdAt: string;
  updatedAt: string;
  contentPillars?: { pillar: string; percentage: number; rationale: string; topics?: string[] }[] | null;
  platformFrequency?: Record<string, number> | null;
  platformStrategy?: {
    instagramReels?: string;
    youtubeLongForm?: string;
    youtubeShorts?: string;
    seoArticles?: string;
    carousels?: string;
  } | null;
  roadmap30Day?: {
    week1_Foundation?: string[];
    week2_ProofAndProjects?: string[];
    week3_PricingAndComparison?: string[];
    week4_Conversion?: string[];
  } | null;
  roadmap60Day?: string | null;
  roadmap90Day?: string | null;
  campaignIdeas?: { name: string; objective: string; concept: string; contentTypes?: string[]; differentiator?: string }[] | null;
  creatorStrategy?: string | null;
  content?: {
    executiveSummary: string;
    whatToAvoid?: string[];
    whatToTest?: string[];
    whatToScale?: string[];
    hooks?: string[];
    ctaStrategy?: string;
    /** Counts of the inputs the strategy was generated from. All zero on a cold start. */
    dataBasis?: { patterns: number; gaps: number; ownedPosts: number; competitorPosts: number };
    platformStrategy?: any;
    roadmap30Day?: any;
    roadmap60Day?: string;
    roadmap90Day?: string;
  };
}

export interface CalendarItem {
  id: string;
  platform: string;
  contentType: string;
  contentPillar: string | null;
  title: string;
  caption: string | null;
  hook: string | null;
  cta: string | null;
  hashtags: string[];
  visualBrief: string | null;
  scheduledFor: string | null;
  publishedAt: string | null;
  status: string;
  campaignId: string | null;
  createdAt: string;
  campaign?: { name: string } | null;
  gap?: { title: string } | null;
}

export interface CalendarFilter {
  status?: string;
  platform?: string;
  campaignId?: string;
  from?: string;
  to?: string;
}

export interface GenerateContentBody {
  platform: string;
  contentType: string;
  contentPillar?: string;
  topic: string;
  campaignName?: string;
  gapContext?: string;
  visualDirection?: string;
}

export interface CreateCalendarItemBody {
  platform: string;
  contentType: string;
  contentPillar?: string;
  title: string;
  caption?: string;
  scheduledFor?: string;
  campaignId?: string;
}

export interface CICampaign {
  id: string;
  name: string;
  objective: string | null;
  productFocus: string | null;
  targetAudience: string | null;
  budget: number | null;
  startDate: string | null;
  endDate: string | null;
  platforms: string[];
  status: string;
  approvalMode: string;
  brief: unknown | null;
  createdAt: string;
  _count?: { calendarItems: number; creatorMatches: number };
  calendarItems?: CalendarItem[];
  creatorMatches?: CreatorMatch[];
}

export interface CreateCampaignBody {
  name: string;
  objective?: string;
  productFocus?: string;
  targetAudience?: string;
  budget?: number;
  startDate?: string;
  endDate?: string;
  platforms?: string[];
  strategyId?: string;
}

export interface Creator {
  id: string;
  name: string;
  handle: string | null;
  platform: string | null;
  profileUrl: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  category: string | null;
  industry: string | null;
  followerCount: number | null;
  engagementRate: number | null;
  averageBudget: number | null;
  currency: string;
  notes: string | null;
  tags: string[];
  status: string;
  createdAt: string;
}

export interface AddCreatorBody {
  name: string;
  handle?: string;
  platform?: string;
  email?: string;
  phone?: string;
  location?: string;
  category?: string;
  industry?: string;
  followerCount?: number;
  engagementRate?: number;
  averageBudget?: number;
  notes?: string;
  tags?: string[];
}

export interface CreatorMatch {
  id: string;
  matchScore: number;
  scoreBreakdown: Record<string, unknown> | null;
  status: string;
  createdAt: string;
  creator: Creator;
}

export interface CreatorOutreach {
  id: string;
  subject: string | null;
  messageBody: string | null;
  channel: string;
  pipelineStage: string;
  approvedToSend: boolean;
  sentAt: string | null;
  contactedAt: string | null;
  createdAt: string;
  creator?: { name: string; handle: string | null; category: string | null };
}

export interface GenerateOutreachBody {
  creatorId: string;
  campaignId?: string;
  brandName: string;
  campaignName?: string;
  product?: string;
  location?: string;
  proposedDate?: string;
}

/**
 * Runs a research question and reports each stage as it happens.
 *
 * Not `EventSource`: that cannot send an Authorization header, and moving the
 * token into the query string would put it in proxy logs and browser history.
 * A streamed `fetch` keeps the same auth as every other call here, at the cost
 * of parsing the SSE framing by hand — which is only ever `data:` lines and
 * blank-line terminators, plus `:` comments used as the keep-alive.
 *
 * Falls back to the non-streaming route when the response is not a stream, so
 * a frontend deployed ahead of its API still answers questions; it just does
 * not show progress.
 */
export async function askResearchStream(
  projectId: string,
  body: { question: string; threadId?: string; deepResearch?: boolean },
  onEvent: (event: ResearchStreamEvent) => void,
  signal?: AbortSignal,
): Promise<ResearchAskResult> {
  const token = auth.getToken();
  const orgId = auth.getOrgId();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "text/event-stream",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (orgId) headers["x-organization-id"] = orgId;

  let response: Response;
  try {
    response = await fetch(`${getApiBase()}/api/projects/${projectId}/market-research/ask/stream`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if (signal?.aborted) throw err;
    return api.askResearch(projectId, body);
  }

  // An API without the streaming route answers 404 here. Retrying on the
  // one-shot route keeps the page working across a partial deploy.
  if (response.status === 404) return api.askResearch(projectId, body);

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new ApiError(response.status, text || `Research failed (${response.status}).`);
  }
  if (!response.body) return api.askResearch(projectId, body);

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: ResearchAskResult | null = null;
  let failure: ApiError | null = null;

  // Frames are separated by a blank line; anything not yet terminated stays in
  // the buffer, because a chunk boundary can land mid-frame.
  const consume = (frame: string) => {
    const data = frame
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trim())
      .join("");
    if (!data) return; // a `:` keep-alive comment

    let event: ResearchStreamEvent;
    try {
      event = JSON.parse(data) as ResearchStreamEvent;
    } catch {
      return;
    }

    if (event.type === "done") result = event.result;
    else if (event.type === "error") failure = new ApiError(event.status ?? 500, event.message);
    else onEvent(event);
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let split = buffer.indexOf("\n\n");
    while (split !== -1) {
      consume(buffer.slice(0, split));
      buffer = buffer.slice(split + 2);
      split = buffer.indexOf("\n\n");
    }
  }
  if (buffer.trim()) consume(buffer);

  if (failure) throw failure;
  if (!result) {
    // The stream ended without a terminal frame: a dropped connection or a
    // proxy cutting the response. Saying so beats a silent empty answer.
    throw new ApiError(502, "The research connection closed before the answer arrived.");
  }
  return result;
}
