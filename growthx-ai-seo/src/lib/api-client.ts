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

  throw new Error(
    "NEXT_PUBLIC_API_URL is not set. Set it to this environment's API URL " +
      "(for example https://growthx-crawler-api.onrender.com for production). " +
      "It has no default outside local development so a staging build cannot " +
      "silently talk to production.",
  );
}

// No module-level API_BASE constant: it would run getApiBase() at import time,
// which during `next build` means throwing before a page can even render.
// Callers resolve the base lazily, at request time.

const TOKEN_KEY = "growthx.token";
const ORG_KEY = "growthx.org";
const PROJECT_KEY = "growthx.project";
const REFRESH_KEY = "growthx.refresh";

// ─────────────────────────────────────────────────────────── auth storage

export const auth = {
  getToken(): string | null {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(TOKEN_KEY);
  },
  setToken(token: string) {
    window.localStorage.setItem(TOKEN_KEY, token);
  },
  getRefreshToken(): string | null {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(REFRESH_KEY);
  },
  setRefreshToken(token: string) {
    window.localStorage.setItem(REFRESH_KEY, token);
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
    window.localStorage.removeItem(TOKEN_KEY);
    window.localStorage.removeItem(REFRESH_KEY);
    window.localStorage.removeItem(ORG_KEY);
    window.localStorage.removeItem(PROJECT_KEY);
  },
  isAuthenticated(): boolean {
    return Boolean(auth.getToken());
  },
};

// ─────────────────────────────────────────────────────────────── errors

/** The shape the billing layer returns on a 403. */
export interface UpgradePayload {
  error: "FEATURE_NOT_IN_PLAN" | "QUOTA_EXCEEDED" | "SITE_LIMIT_REACHED";
  message: string;
  feature?: string;
  metric?: string;
  currentPlan?: string;
  limit?: number | null;
  used?: number;
  upgradeTo?: { plan: string; name: string; price: string; limit?: number | null } | null;
}

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

  get upgrade(): UpgradePayload | null {
    return this.isUpgradeRequired ? (this.body as UpgradePayload) : null;
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
  
  try {
    response = await fetch(`${baseUrl}${path}`, { ...init, headers });
    if (response.status === 502 || response.status === 503 || response.status === 504) {
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
    if (!onAuthPage) window.location.href = "/login";
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
  logout: () => auth.clear(),


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
}

export interface CompetitorContent {
  id: string;
  platform: string;
  contentType: string | null;
  publishedAt: string | null;
  caption: string | null;
  title: string | null;
  hashtags: string[];
  thumbnailUrl: string | null;
  contentUrl: string | null;
  likesCount: number | null;
  commentsCount: number | null;
  viewsCount: number | null;
  classification?: ContentClassification | null;
  account?: { displayName: string | null; platform: string; handle: string };
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
}

export interface ContentClassification {
  contentCategory: string | null;
  visualFormat: string | null;
  detectedTopics: string[];
  detectedObjects: string[];
  storytellingStyle: string | null;
  hookType: string | null;
  ctaType: string | null;
  creativityScore: number | null;
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
  campaignIdeas?: { name: string; objective: string; concept: string; contentTypes?: string[]; differentiator?: string }[] | null;
  content?: {
    executiveSummary: string;
    whatToAvoid?: string[];
    whatToTest?: string[];
    whatToScale?: string[];
    hooks?: string[];
    ctaStrategy?: string;
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

