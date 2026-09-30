/**
 * GrowthX AI SEO — API client.
 *
 * Talks to the NestJS backend. Paths here are the real controller routes:
 * auth and organizations sit at the root, everything else under `/api`.
 */

import type { StagedFixItem } from "@/lib/staging-engine";
import type {
  ChangeImpact,
  ChangeKind,
  ChangeLedger,
  ChangeRiskReport,
  DiagnosisSummary,
  IndexStatusReport,
  InspectOutcome,
  KeywordDiagnosis,
  KeywordGapsReport,
  RankingsReport,
  SearchIntelligenceStatus,
  SearchMarket,
  SearchRankingsReport,
} from "./search-intelligence";

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

  // Server render and `next build` prerender reach this too (the login page
  // builds its Google link from it), so throwing there would fail the build.
  // The browser is where a wrong base does damage, so that is where it throws.
  if (typeof window === "undefined") return "http://localhost:3000";

  const isLocalhost = ["localhost", "127.0.0.1", "0.0.0.0"].includes(window.location.hostname);
  if (isLocalhost) return "http://localhost:3000";

  throw new Error(
    "NEXT_PUBLIC_API_URL is not set for this build. Set it to the API's public URL and rebuild.",
  );
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

import type {
  Role,
  OrgMember,
  UserProfile,
  TokensOverview,
  TokenTransactionPage,
  VisibilityReport,
  VisibilityInsights,
  QuestionAnalysisReport,
  QuestionSuggestion,
  TrackedPromptRow,
  PortfolioResponse,
  CrawlJob,
  CrawlHistoryPoint,
  CrawlPage,
  CrawlIssue,
  FixPreviewResult,
  FixPatch,
  StrategyReport,
  ContentPiece,
  CoverageComparison,
  CompetitorChanges,
  CoverageOpportunities,
  GscSummary,
  GscPoint,
  GscRow,
  GscStrikingDistanceRow,
  GscCtrOpportunity,
  GscDecliningRow,
  GoogleConnectionStatus,
  GrowthOpportunity,
  FindingListResponse,
  OpportunityList,
  Ga4Summary,
  Ga4Point,
  Ga4RangeKey,
  Ga4Report,
  PageValue,
  GoogleOverview,
  GooglePages,
  GoogleKeywordMovement,
  GoogleBreakdown,
  GoogleReport,
  GoogleAlertsReport,
  GooglePageDetail,
  IssueCounts,
  IssueGroup,
  IssueGroupList,
  IssueGroupPages,
  IssueGroupFilters,
  ExecutiveSummary,
  SiteRepository,
  AutomationRun,
  QueueStat,
  LocalSeoData,
  GeoGridRunSummary,
  GeoGridScanRequest,
  GeoGridScanResult,
  LocalReview,
  GoogleIntegrationStatus,
  GbpLocationList,
  GbpSyncResult,
  GbpOverview,
  GbpMetrics,
  GbpReviews,
  GbpPhotos,
  GbpPosts,
  GbpServices,
  PlacesCompetitorSearch,
  GbpCategories,
  ApiCostStat,
  TenantStat,
  AdminSystemHealth,
  AdminUserItem,
  MarketIntelligenceData,
  IntegrationConfigData,
  ResearchSource,
  ResearchAnswer,
  ResearchStreamEvent,
  ResearchAskResult,
  ResearchThreadSummary,
  MarketScopeRegion,
  WebsiteComparison,
  CompetitorSetupInput,
  TrackedCompetitor,
  SearchDemand,
  WebsiteAuditReport,
  CompetitorIntelReport,
  CompetitorWebsite,
  TrackedCompetitorList,
  StrategyRunStatus,
  AutonomousPlanStatus,
  SprintExecutionResult,
  VerificationCertificate,
  GeoSimulationResult,
  SimulateGeoBody,
  InterceptBlueprint,
  InterceptAnalysisResponse,
  GenerateBlueprintBody,
  ProgrammaticMatrixResponse,
  RivalMovesResponse,
  DispatchFindingBody,
  InternalLinkingMeshResponse,
  GenerateLinkPatchBody,
  LinkSculptingPatch,
  TopicClusterAnalysis,
  CannibalizationReport,
  ContentVelocityCalendar,
  ActionStatusValue,
  CompetitorFindingRow,
  StrategyPlan,
  ActionEngineOverview,
  DetectedBusinessProfile,
  AutoIdentifyCompetitorsResponse,
  AddSelectedCompetitorsBody,
  AddSelectedCompetitorsResponse,
  MarketActionStatus,
  MarketActionRow,
  MarketOpportunityRow,
  MarketOutcomeRow,
  CompetitorSeoReport,
  GeneratedSchemaResult,
  MetaOptimizationResult,
  ImageSeoResult,
  InternalLinkSuggestions,
  SeoGapMatrix,
  SeoGapInsights,
  GbpFixSuggestion,
  GbpFixProposal,
  AutopilotRun,
  VoiceAgentResult,
  VoiceChatRequest,
  CrawlQualityDiagnostics,
  PlatformStrategy,
  Roadmap30Day,
  IngestVideoPayload,
  MammouthConfig,
  MammouthAnalysisInput,
  MammouthTestResult,
} from "./api-types";

export * from "./api-types";

/** Exactly the fields the saved-plans API accepts; anything else a caller attached stays in the browser. */
function planBody(plan: StagedFixItem) {
  return {
    id: plan.id,
    title: plan.title,
    category: plan.category,
    source: plan.source,
    priority: plan.priority,
    impact: plan.impact ?? "",
    effortHours: plan.effortHours ?? 0,
    deliverable: plan.deliverable ?? "",
    ...(plan.evidence ? { evidence: plan.evidence } : {}),
    ...(plan.affectedUrl ? { affectedUrl: plan.affectedUrl } : {}),
    status: plan.status,
    stagedAt: plan.stagedAt,
  };
}

// ─────────────────────────────────────────────────────────────── errors

/** A failed request: the HTTP status, the server's own message, and its full body. */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public body?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }

  /**
   * True when the backend refused because the workspace has no tokens left.
   * `message` is then already written for the customer (it says when tokens
   * refill), so it can be shown as it is.
   */
  get isOutOfTokens(): boolean {
    const error = (this.body as { error?: string } | undefined)?.error;
    return this.status === 402 && error === "INSUFFICIENT_TOKENS";
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
  // Validation failures arrive as a list ({ message: ["Enter a valid email
  // address."] }). Read as an object, a list has no `.message`, and every
  // rejected form showed only "Bad Request".
  const listed = Array.isArray(envelope?.message)
    ? (envelope.message as unknown[]).filter((m): m is string => typeof m === "string").join(" ")
    : null;
  const payload =
    envelope?.message && typeof envelope.message === "object" && !Array.isArray(envelope.message) ? envelope.message : envelope;
  const message =
    (listed || null) ??
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
const patch = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: "PATCH", body: body === undefined ? undefined : JSON.stringify(body) });
const put = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: "PUT", body: body === undefined ? undefined : JSON.stringify(body) });
const del = <T>(path: string) => request<T>(path, { method: "DELETE" });

export const api = {
  // Mammouth AI Orchestration
  mammouth: {
    getConfig: () => get<MammouthConfig>('/api/ai/mammouth/config'),
    updateConfig: (data: Partial<MammouthConfig>) => post<{ success: boolean; config: MammouthConfig }>('/api/ai/mammouth/config', data),
    testConnection: () => post<MammouthTestResult>('/api/ai/mammouth/test-connection', {}),
    // No caller has modelled these payloads yet. `unknown` keeps that honest:
    // the first consumer has to narrow the response deliberately instead of
    // inheriting `any` and losing type checking across whatever it touches.
    websiteAudit: (data: MammouthAnalysisInput) => post<unknown>('/api/ai/mammouth/website-audit', data),
    competitorIntelligence: (data: MammouthAnalysisInput) => post<unknown>('/api/ai/mammouth/competitor-intelligence', data),
    keywordStrategy: (data: MammouthAnalysisInput) => post<unknown>('/api/ai/mammouth/keyword-strategy', data),
    contentAnalysis: (data: MammouthAnalysisInput) => post<unknown>('/api/ai/mammouth/content-analysis', data),
    aevAnalysis: (data: MammouthAnalysisInput) => post<unknown>('/api/ai/mammouth/aev-analysis', data),
  },

  // SEO Tools
  generateSchema: async (projectId: string, url: string, type: string) => 
    post<GeneratedSchemaResult>(`/api/projects/${projectId}/seo-tools/schema/generate`, { url, type }),
  analyzeMetaTags: async (projectId: string, url: string) => 
    post<MetaOptimizationResult>(`/api/projects/${projectId}/seo-tools/meta/analyze`, { url }),
  optimizeImages: async (projectId: string, url: string) => 
    post<ImageSeoResult>(`/api/projects/${projectId}/seo-tools/images/analyze`, { url }),
  suggestInternalLinks: async (projectId: string, url: string) => 
    post<InternalLinkSuggestions>(`/api/projects/${projectId}/seo-tools/internal-links/suggest`, { url }),
  getInternalLinkingMesh: async (projectId: string) =>
    get<InternalLinkingMeshResponse>(`/api/projects/${projectId}/seo-tools/internal-links/mesh`),
  generateLinkSculptingPatch: async (projectId: string, body: GenerateLinkPatchBody) =>
    post<LinkSculptingPatch>(`/api/projects/${projectId}/seo-tools/internal-links/sculpt`, body),
  getTopicClusters: async (projectId: string) =>
    get<TopicClusterAnalysis>(`/api/projects/${projectId}/seo-tools/content-velocity/clusters`),
  detectCannibalization: async (projectId: string) =>
    get<CannibalizationReport>(`/api/projects/${projectId}/seo-tools/content-velocity/cannibalization`),
  getContentVelocityCalendar: async (projectId: string) =>
    get<ContentVelocityCalendar>(`/api/projects/${projectId}/seo-tools/content-velocity/calendar`),
  getSeoGapMatrix: async (projectId: string) =>
    get<SeoGapMatrix>(`/api/projects/${projectId}/seo-tools/competitor-matrix`),
  generateSeoGapInsights: async (projectId: string) =>
    post<SeoGapInsights>(`/api/projects/${projectId}/seo-tools/seo-insights`, {}),

  // ── Voice Agent
  autopilot: {
    start: (domain: string, projectId?: string | null) =>
      post<AutopilotRun>("/api/autopilot", { domain, projectId: projectId || undefined }),
    latest: (projectId: string) => get<AutopilotRun | null>(`/api/autopilot/latest?projectId=${encodeURIComponent(projectId)}`),
    confirm: (runId: string, domains: string[]) => post<AutopilotRun>(`/api/autopilot/${runId}/confirm`, { domains }),
    cancel: (runId: string) => post<AutopilotRun>(`/api/autopilot/${runId}/cancel`, {}),
  },

  generateAuditReport: (projectId: string) => post<WebsiteAuditReport>(`/api/projects/${projectId}/audit-report`, {}),
  getLatestAuditReport: (projectId: string) => get<WebsiteAuditReport | null>(`/api/projects/${projectId}/audit-report/latest`),

  /** The most recently generated competitor report, so it survives a reload. */
  getLatestCompetitorReport: (projectId: string) =>
    get<CompetitorIntelReport | null>(`/api/projects/${projectId}/action-engine/competitor-report/latest`),

  voice: {
    createSession: async (projectId?: string) =>
      post<{ sessionId: string; createdAt: string }>('/api/voice/session', { projectId }),
    chat: async (payload: VoiceChatRequest) => post<VoiceAgentResult>('/api/voice/chat', payload),
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
  /** Trades the one-time code from the Google sign-in redirect for the session tokens. */
  async exchangeLoginCode(code: string) {
    const result = await post<{ access_token: string; refresh_token?: string }>("/auth/exchange", { code });
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
    post<{ placeId: string; name: string; address: string; rating: number; userRatingsTotal: number; latitude?: number; longitude?: number }[]>(`/api/projects/${projectId}/local-seo/search`, { query }),
  connectLocalBusiness: (projectId: string, data: { businessName: string; address: string; rating: number; reviewCount: number; placeId?: string; latitude?: number; longitude?: number }) =>
    post<LocalSeoData>(`/api/projects/${projectId}/local-seo/connect`, data),
  getLocalSeo: (projectId: string) => get<LocalSeoData>(`/api/projects/${projectId}/local-seo`),
  analyzeGbp: (projectId: string) => post<GbpFixSuggestion[]>(`/api/projects/${projectId}/local-seo/gbp/analyze`, {}),
  getGbpProposals: (projectId: string) => get<GbpFixProposal[]>(`/api/projects/${projectId}/local-seo/gbp/proposals`),
  approveGbpFix: (projectId: string, proposalId: string) => post<{ success: boolean }>(`/api/projects/${projectId}/local-seo/gbp/fix/${proposalId}/approve`, {}),
  rejectGbpFix: (projectId: string, proposalId: string) => post<{ success: boolean }>(`/api/projects/${projectId}/local-seo/gbp/fix/${proposalId}/reject`, {}),
  runGeoGridScan: (projectId: string, body: GeoGridScanRequest) =>
    post<GeoGridScanResult>(`/api/projects/${projectId}/local-seo/geo-grid/run`, body),
  getGeoGridHistory: (projectId: string, keyword?: string) =>
    get<GeoGridRunSummary[]>(
      `/api/projects/${projectId}/local-seo/geo-grid/history${keyword ? `?keyword=${encodeURIComponent(keyword)}` : ''}`,
    ),
  getGeoGridRun: (projectId: string, runId: string) =>
    get<GeoGridScanResult>(`/api/projects/${projectId}/local-seo/geo-grid/run/${runId}`),
  getLocalReviews: (projectId: string) => get<LocalReview[]>(`/api/projects/${projectId}/local-seo/reviews`),
  syncLocalReviews: (projectId: string) => post<{ message: string; count: number }>(`/api/projects/${projectId}/local-seo/reviews/sync`, {}),
  draftReviewReply: (projectId: string, reviewId: string, tone?: string) => post<LocalReview>(`/api/projects/${projectId}/local-seo/reviews/${reviewId}/draft`, { tone }),
  publishReviewReply: (projectId: string, reviewId: string, replyText: string) => post<LocalReview>(`/api/projects/${projectId}/local-seo/reviews/${reviewId}/publish`, { replyText }),

  // ── Google Business Profile: OAuth lifecycle
  // Generic across every Google connector; the Business Profile one is `business_profile`.
  getGoogleIntegrations: (projectId: string) =>
    get<GoogleIntegrationStatus>(`/api/projects/${projectId}/integrations/google`),
  /**
   * Returns the URL to send the browser to. Not a redirect, because the caller
   * is an authenticated fetch rather than a navigation.
   */
  authorizeGoogleProvider: (projectId: string, provider: string, returnTo?: string) =>
    post<{ authorizationUrl: string }>(
      `/api/projects/${projectId}/integrations/google/${provider}/authorize${
        returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ""
      }`,
      {},
    ),
  /** Commits the location the customer picked. `resourceId` is Google's resource name. */
  selectGoogleResource: (projectId: string, provider: string, resourceId: string, resourceName: string) =>
    post<{ id: string; status: string; selectedResourceId: string | null; selectedResourceName: string | null }>(
      `/api/projects/${projectId}/integrations/google/${provider}/select?resourceId=${encodeURIComponent(
        resourceId,
      )}&resourceName=${encodeURIComponent(resourceName)}`,
      {},
    ),
  disconnectGoogleProvider: (projectId: string, provider: string) =>
    del<{ disconnected: boolean; revoked: boolean }>(
      `/api/projects/${projectId}/integrations/google/${provider}`,
    ),

  // ── Google Business Profile: synced data
  getGbpLocations: (projectId: string) =>
    get<GbpLocationList>(`/api/projects/${projectId}/business-profile/locations`),
  syncBusinessProfile: (projectId: string, days?: number) =>
    post<GbpSyncResult>(
      `/api/projects/${projectId}/business-profile/sync${days ? `?days=${days}` : ""}`,
      {},
    ),
  getGbpOverview: (projectId: string) =>
    get<GbpOverview>(`/api/projects/${projectId}/business-profile/overview`),
  getGbpMetrics: (projectId: string, days = 28) =>
    get<GbpMetrics>(`/api/projects/${projectId}/business-profile/metrics?days=${days}`),
  getGbpReviews: (projectId: string) =>
    get<GbpReviews>(`/api/projects/${projectId}/business-profile/reviews`),
  getGbpPhotos: (projectId: string) =>
    get<GbpPhotos>(`/api/projects/${projectId}/business-profile/photos`),
  getGbpPosts: (projectId: string) =>
    get<GbpPosts>(`/api/projects/${projectId}/business-profile/posts`),
  getGbpServices: (projectId: string) =>
    get<GbpServices>(`/api/projects/${projectId}/business-profile/services`),
  getGbpCategories: (projectId: string) =>
    get<GbpCategories>(`/api/projects/${projectId}/business-profile/categories`),
  /** Who Google Maps shows for a search, around this project's listing. Public Places data. */
  getPlacesCompetitors: (projectId: string, keyword: string, radiusKm?: number) =>
    post<PlacesCompetitorSearch>(`/api/projects/${projectId}/local-seo/places/competitors`, {
      keyword,
      radiusKm,
    }),


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

  // ── Competitor SEO detail
  /** Spends Sarvam tokens, so only on request. The facts come back even if the analysis fails. */
  /** The measured half of the competitor report: what each rival has that you do not. No model call. */
  getRivalAdvantages: (projectId: string) =>
    get<CompetitorIntelReport["facts"]>(`/api/projects/${projectId}/action-engine/rival-advantages`),

  generateCompetitorIntelReport: (projectId: string) =>
    post<CompetitorIntelReport>(`/api/projects/${projectId}/action-engine/competitor-report`, {}),
  getCompetitorSeoReport: (projectId: string, competitorId: string) =>
    get<CompetitorSeoReport>(
      `/api/projects/${projectId}/action-engine/competitors/${competitorId}/seo-report`,
    ),
  // ── Organizations & projects
  listOrganizations: async () => {
    try {
      const orgs = await get<{ id: string; name: string; slug: string }[]>("/organizations");
      return orgs || [];
    } catch {
      return [];
    }
  },
  createOrganization: (name: string, slug: string) => post<{ id: string; name: string; slug: string }>("/organizations", { name, slug }),
  listProjects: async (orgId: string) => {
    try {
      const projects = await get<{ id: string; name: string }[]>(`/projects/org/${orgId}`);
      return projects || [];
    } catch {
      return [];
    }
  },
  listMembers: (orgId: string) => get<OrgMember[]>(`/organizations/${orgId}/members`),
  addMember: (orgId: string, email: string, role: Role = "MEMBER") =>
    post<OrgMember>(`/organizations/${orgId}/members`, { email, role }),
  updateMemberRole: (orgId: string, memberId: string, role: Role) =>
    request<OrgMember>(`/organizations/${orgId}/members/${memberId}`, { method: "PATCH", body: JSON.stringify({ role }) }),
  removeMember: (orgId: string, memberId: string) =>
    request<{ success: boolean }>(`/organizations/${orgId}/members/${memberId}`, { method: "DELETE" }),
  createProject: (name: string, organizationId: string) =>
    post<{ id: string; name: string }>("/projects", { name, organizationId }),
  deleteProject: (projectId: string) => del<{ success: boolean }>(`/projects/${projectId}`),

  // ── Agency portfolio
  getPortfolio: (orgId: string, days = 28) =>
    get<PortfolioResponse>(`/api/organizations/${orgId}/portfolio?days=${days}`),
  setRetainer: (orgId: string, projectId: string, body: { tier?: string | null; retainerMonthlyMinor?: number | null; retainerCurrency?: string }) =>
    request(`/api/organizations/${orgId}/portfolio/clients/${projectId}/retainer`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  // ── Tokens
  /** Operators only: gives (positive) or takes back (negative) bonus tokens. */
  adjustTokens: (orgId: string, amount: number, note?: string) =>
    post<unknown>(`/api/admin/organizations/${orgId}/tokens/adjust`, { amount, note }),
  getTokens: (orgId: string) => get<TokensOverview>(`/api/organizations/${orgId}/tokens`),
  getTokenTransactions: (orgId: string, options: { cursor?: string; limit?: number } = {}) => {
    const query = new URLSearchParams();
    if (options.limit) query.set("limit", String(options.limit));
    if (options.cursor) query.set("cursor", options.cursor);
    const suffix = query.toString();
    return get<TokenTransactionPage>(`/api/organizations/${orgId}/tokens/transactions${suffix ? `?${suffix}` : ""}`);
  },

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
  getCrawlIssues: (
    jobId: string,
    params?: {
      severity?: string;
      category?: string;
      confidence?: string;
      search?: string;
      page?: number;
      limit?: number;
    },
  ) => {
    const query = new URLSearchParams();
    if (params?.severity) query.set("severity", params.severity);
    if (params?.category) query.set("category", params.category);
    if (params?.confidence) query.set("confidence", params.confidence);
    if (params?.search) query.set("search", params.search);
    if (params?.page) query.set("page", String(params.page));
    if (params?.limit) query.set("limit", String(params.limit));
    const suffix = query.toString() ? `?${query}` : "";
    return get<{
      data: CrawlIssue[];
      meta: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
        totalFindings: number;
        uniqueOpenIssues: number;
        resolvedIssues: number;
        healthScore?: number | null;
        countsBySeverity: Record<string, number>;
        countsByCategory: Record<string, number>;
        countsByConfidence: Record<string, number>;
        qualityDiagnostics?: CrawlQualityDiagnostics | null;
      };
    }>(`/api/crawls/${jobId}/issues${suffix}`);
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
  fixPreview: (issueId: string) =>
    post<FixPreviewResult>(`/api/issues/${issueId}/fix-preview`, {}),
  approveFix: (issueId: string) => post(`/api/issues/${issueId}/approve`, {}),

  // ── AI visibility
  getVisibility: (projectId: string, days = 28) =>
    get<VisibilityReport>(`/api/projects/${projectId}/ai-visibility?days=${days}`),
  listTrackedPrompts: (projectId: string) =>
    get<TrackedPromptRow[]>(`/api/projects/${projectId}/ai-visibility/prompts`),
  addTrackedPrompts: (projectId: string, prompts: { text: string; cluster?: string }[]) =>
    post(`/api/projects/${projectId}/ai-visibility/prompts`, { prompts }),
  getQuestionAnalysis: (projectId: string) =>
    get<QuestionAnalysisReport>(`/api/projects/${projectId}/ai-visibility/questions`),
  getQuestionSuggestions: (projectId: string) =>
    get<{
      suggestions: QuestionSuggestion[];
      basedOn: { ownPages: number; rivalPages: number; contentGaps: number };
    }>(`/api/projects/${projectId}/ai-visibility/questions/suggestions`),
  getAiVisibilityRoadmapTasks: (projectId: string) =>
    get<{ groups: IssueGroup[] }>(`/api/projects/${projectId}/ai-visibility/roadmap-tasks`),
  getVisibilityInsights: (projectId: string, question?: string) =>
    question
      ? post<VisibilityInsights>(`/api/projects/${projectId}/ai-visibility/insights`, { question })
      : get<VisibilityInsights>(`/api/projects/${projectId}/ai-visibility/insights`),
  /**
   * Returns the stored CompetitorDomain row, not the enriched shape
   * `listCompetitors` builds — the scores and crawl state on that one are
   * derived later, so only the record's own columns are typed here.
   */
  addCompetitor: (projectId: string, domain: string, label?: string) =>
    post<Pick<TrackedCompetitor, "id" | "domain" | "label" | "name">>(
      `/api/projects/${projectId}/ai-visibility/competitors`,
      { domain, label },
    ),
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
      /**
       * One entry per competitor. The scheduler pushes a success row spread
       * from `startCrawl`, or a failure row carrying the domain and the error.
       */
      crawlResults: Array<
        | {
            competitorId: string;
            status: "SUCCESS";
            jobId: string;
            websiteId: string;
            domain: string;
            pageLimit: number;
          }
        | { competitorId: string; domain: string; status: "FAILED"; error: string }
      >;
      newAlertsGenerated: number;
    }>(`/api/projects/${projectId}/content-intelligence/cron/trigger-sync`, {}),

  getCompetitorCoverage: (projectId: string, competitorId: string) =>
    get<{ competitorId: string; domain: string; crawlJobId: string; crawledAt: string; totalPages: number; capped: boolean; byType: Record<string, number>; untyped: number } | null>(
      `/api/projects/${projectId}/content-intelligence/competitors/${competitorId}/coverage`,
    ),

  listCompetitorPages: (projectId: string, competitorId: string, pageType?: string) =>
    get<Array<{ url: string; title: string | null; metaDescription: string | null; h1: string[]; h2?: string[]; pageType: string; wordCount: number; statusCode: number; responseTimeMs: number }>>(
      `/api/projects/${projectId}/content-intelligence/competitors/${competitorId}/pages${pageType ? `?pageType=${encodeURIComponent(pageType)}` : ""}`,
    ),

  // ── GrowthX Intelligence ─────────────────────────────────────────────────
  growthIntelligence: (projectId: string, days: number) =>
    get<GrowthIntelligenceReport>(`/api/projects/${projectId}/intelligence?days=${days}`),

  seoImpactList: (projectId: string) => get<SeoImpactListItem[]>(`/api/projects/${projectId}/seo-impact`),
  seoImpactPlan: (projectId: string, body: { url?: string | null; findingType: string; action: string; note?: string; windowDays?: number }) =>
    post<{ id: string }>(`/api/projects/${projectId}/seo-impact`, body),
  seoImpactImplemented: (projectId: string, id: string, implementedAt?: string) =>
    post<{ id: string }>(`/api/projects/${projectId}/seo-impact/${id}/implemented`, implementedAt ? { implementedAt } : {}),
  seoImpactMeasure: (projectId: string, id: string) => get<SeoImpactResult>(`/api/projects/${projectId}/seo-impact/${id}`),

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
  // ── Competitor-to-Action Engine ────────────────────────────────────────────
  //
  // Every response here is either real stored evidence or an explicit
  // needs-data state. Nothing is estimated client-side.

  actionEngineOverview: (projectId: string) =>
    get<ActionEngineOverview>(`/api/projects/${projectId}/action-engine/overview`),

  actionEngineFindings: (projectId: string, category?: string) =>
    get<CompetitorFindingRow[]>(
      `/api/projects/${projectId}/action-engine/findings${category ? `?category=${encodeURIComponent(category)}` : ""}`,
    ),

  actionEngineStrategy: (projectId: string) =>
    get<StrategyPlan>(`/api/projects/${projectId}/action-engine/strategy`),

  actionEngineGenerate: (projectId: string) =>
    post<{ runId: string; actions: number }>(`/api/projects/${projectId}/action-engine/strategy/generate`, {}),

  actionEngineSetStatus: (projectId: string, actionId: string, status: ActionStatusValue) =>
    patch<{ id: string; status: ActionStatusValue }>(
      `/api/projects/${projectId}/action-engine/actions/${actionId}`,
      { status },
    ),

  actionEngineWebsiteComparison: (projectId: string) =>
    get<WebsiteComparison>(`/api/projects/${projectId}/action-engine/website-comparison`),

  actionEngineCompetitors: (projectId: string) =>
    get<TrackedCompetitorList>(`/api/projects/${projectId}/action-engine/competitors`),

  actionEngineAddCompetitor: (projectId: string, body: CompetitorSetupInput) =>
    post<TrackedCompetitor>(`/api/projects/${projectId}/action-engine/competitors`, body),

  actionEngineUpdateCompetitor: (
    projectId: string,
    competitorId: string,
    body: Partial<CompetitorSetupInput>,
  ) =>
    patch<TrackedCompetitor>(
      `/api/projects/${projectId}/action-engine/competitors/${competitorId}`,
      body,
    ),

  actionEngineRemoveCompetitor: (projectId: string, competitorId: string) =>
    del<{ removed: string }>(`/api/projects/${projectId}/action-engine/competitors/${competitorId}`),

  actionEngineRunStatus: (projectId: string) =>
    get<StrategyRunStatus>(`/api/projects/${projectId}/action-engine/strategy/status`),

  actionEngineSetGoal: (projectId: string, businessGoal: string, targetAudience?: string) =>
    patch<{ businessGoal: string | null }>(`/api/projects/${projectId}/action-engine/business-goal`, {
      businessGoal,
      targetAudience,
    }),

  actionEngineAutonomousPlanStatus: (projectId: string) =>
    get<AutonomousPlanStatus>(`/api/projects/${projectId}/action-engine/autonomous-plan`),

  actionEngineApproveAutonomousPlan: (projectId: string) =>
    post<AutonomousPlanStatus>(`/api/projects/${projectId}/action-engine/autonomous-plan/approve`, {}),

  actionEngineExecuteSprint: (
    projectId: string,
    body: { sprintWeek?: number; actionIds?: string[] } = {},
  ) =>
    post<SprintExecutionResult>(
      `/api/projects/${projectId}/action-engine/autonomous-plan/execute-sprint`,
      body,
    ),

  runVerification: (
    projectId: string,
    body: { issueIds?: string[]; urls?: string[]; sprintWeek?: number } = {},
  ) =>
    post<VerificationCertificate>(`/api/projects/${projectId}/verification/run`, body),

  getLatestVerification: (projectId: string) =>
    get<VerificationCertificate | null>(`/api/projects/${projectId}/verification/latest`),

  simulateGeo: (projectId: string, body: SimulateGeoBody) =>
    post<GeoSimulationResult>(`/api/projects/${projectId}/ai-visibility/simulate`, body),

  getCompetitorIntercepts: (projectId: string, competitorId?: string) =>
    get<InterceptAnalysisResponse>(
      `/api/projects/${projectId}/action-engine/intercepts${competitorId ? `?competitorId=${encodeURIComponent(competitorId)}` : ""}`,
    ),

  generateCounterAttackBlueprint: (projectId: string, body: GenerateBlueprintBody) =>
    post<InterceptBlueprint>(`/api/projects/${projectId}/action-engine/intercepts/generate-blueprint`, body),

  getProgrammaticMatrix: (projectId: string, competitorId?: string) =>
    get<ProgrammaticMatrixResponse>(
      `/api/projects/${projectId}/action-engine/programmatic-matrix${competitorId ? `?competitorId=${encodeURIComponent(competitorId)}` : ""}`,
    ),

  getRivalMoves: (projectId: string) =>
    get<RivalMovesResponse>(`/api/projects/${projectId}/action-engine/rival-moves`),

  dispatchFindingToQueue: (projectId: string, body: DispatchFindingBody) =>
    post<{ success: boolean; message: string; opportunityId: string; fingerprint: string }>(
      `/api/projects/${projectId}/action-engine/dispatch-to-queue`,
      body,
    ),


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
  searchDemand: (projectId: string) => get<SearchDemand>(`/api/projects/${projectId}/search-console/demand`),
  /** Plans saved from every "Save as a plan" button, kept on the server. See staging-engine.ts. */
  savedPlans: {
    list: (projectId: string) => get<StagedFixItem[]>(`/api/projects/${projectId}/saved-plans`),
    save: (projectId: string, plan: StagedFixItem) => post<StagedFixItem>(`/api/projects/${projectId}/saved-plans`, planBody(plan)),
    remove: (projectId: string, id: string) =>
      del<{ removed: boolean }>(`/api/projects/${projectId}/saved-plans/${encodeURIComponent(id)}`),
  },
  /**
   * What Google itself shows and records: index status, live results and
   * rankings, competitor keywords, and search results around a change.
   */
  searchIntelligence: {
    status: (projectId: string) => get<SearchIntelligenceStatus>(`/api/projects/${projectId}/search-intelligence/status`),
    setMarket: (projectId: string, body: { country?: string | null; language?: string }) =>
      put<SearchMarket>(`/api/projects/${projectId}/search-intelligence/market`, body),
    indexStatus: (projectId: string) => get<IndexStatusReport>(`/api/projects/${projectId}/search-intelligence/index-status`),
    inspect: (projectId: string, body: { urls?: string[]; limit?: number } = {}) =>
      post<InspectOutcome>(`/api/projects/${projectId}/search-intelligence/index-status/inspect`, body),
    diagnose: (projectId: string, body: { keyword: string; pageUrl?: string }) =>
      post<KeywordDiagnosis>(`/api/projects/${projectId}/search-intelligence/diagnose`, body),
    diagnoses: (projectId: string) => get<DiagnosisSummary[]>(`/api/projects/${projectId}/search-intelligence/diagnoses`),
    diagnosis: (projectId: string, id: string) =>
      get<KeywordDiagnosis>(`/api/projects/${projectId}/search-intelligence/diagnoses/${encodeURIComponent(id)}`),
    searchRankings: (projectId: string, days: number) =>
      get<SearchRankingsReport>(`/api/projects/${projectId}/search-intelligence/search-rankings?days=${days}`),
    rankings: (projectId: string) => get<RankingsReport>(`/api/projects/${projectId}/search-intelligence/rankings`),
    track: (projectId: string, keywords: string[], source: "USER" | "COMPETITOR_GAP" = "USER") =>
      post<{ added: number; skipped: number }>(`/api/projects/${projectId}/search-intelligence/rankings/keywords`, { keywords, source }),
    untrack: (projectId: string, id: string) =>
      del<{ removed: boolean }>(`/api/projects/${projectId}/search-intelligence/rankings/keywords/${encodeURIComponent(id)}`),
    checkRankings: (projectId: string) =>
      post<{ checked: number; failed: string[] }>(`/api/projects/${projectId}/search-intelligence/rankings/check`, {}),
    keywordGaps: (projectId: string) => get<KeywordGapsReport>(`/api/projects/${projectId}/search-intelligence/keyword-gaps`),
    refreshKeywordGaps: (projectId: string, body: { competitorDomain?: string; force?: boolean } = {}) =>
      post<KeywordGapsReport>(`/api/projects/${projectId}/search-intelligence/keyword-gaps/refresh`, body),
    changes: (projectId: string) => get<ChangeLedger>(`/api/projects/${projectId}/search-intelligence/changes`),
    changeImpact: (projectId: string, url: string, changedAt: string, days?: number) => {
      const qs = new URLSearchParams({ url, changedAt, ...(days ? { days: String(days) } : {}) });
      return get<ChangeImpact>(`/api/projects/${projectId}/search-intelligence/change-impact?${qs.toString()}`);
    },
    changeRisk: (projectId: string, body: { url: string; change: ChangeKind; target?: string }) =>
      post<ChangeRiskReport>(`/api/projects/${projectId}/search-intelligence/change-risk`, body),
  },
  /** "I've done this" on the action plan, kept on the server. */
  actionPlanDone: {
    get: (projectId: string) => get<Record<string, string>>(`/api/projects/${projectId}/action-plan/done`),
    mark: (projectId: string, body: { stepKey: string; done: boolean; doneAt?: string }) =>
      post<Record<string, string>>(`/api/projects/${projectId}/action-plan/done`, body),
  },
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
  /** Cached exact GA4 report for one workspace and window. */
  ga4Report: (projectId: string, range: Ga4RangeKey) =>
    get<Ga4Report>(`/api/projects/${projectId}/analytics/report?range=${range}`),
  ga4Summary: (projectId: string, days: number) =>
    get<Ga4Summary | null>(`/api/projects/${projectId}/analytics/summary?days=${days}`),
  ga4Timeseries: (projectId: string, days: number) =>
    get<Ga4Point[]>(`/api/projects/${projectId}/analytics/timeseries?days=${days}`),
  /** Organic clicks joined to sessions and conversions, per page. */
  // ── Google section ───────────────────────────────────────────────────────
  googleOverview: (projectId: string, days: number) =>
    get<GoogleOverview>(`/api/projects/${projectId}/google/overview?days=${days}`),
  googlePages: (projectId: string, days: number, segment?: string) =>
    get<GooglePages>(
      `/api/projects/${projectId}/google/pages?days=${days}${segment ? `&segment=${encodeURIComponent(segment)}` : ""}`,
    ),
  googleKeywords: (projectId: string, days: number) =>
    get<GoogleKeywordMovement | null>(`/api/projects/${projectId}/google/keywords?days=${days}`),
  googleBreakdown: (projectId: string, days: number, dimension: "country" | "device") =>
    get<GoogleBreakdown>(`/api/projects/${projectId}/google/breakdown?days=${days}&dimension=${dimension}`),
  googleAlerts: (projectId: string, days: number) =>
    get<GoogleAlertsReport>(`/api/projects/${projectId}/google/alerts?days=${days}`),
  generateGoogleReport: (projectId: string, days: number) =>
    post<GoogleReport>(`/api/projects/${projectId}/google/report?days=${days}`, {}),
  getLatestGoogleReport: (projectId: string) => get<GoogleReport | null>(`/api/projects/${projectId}/google/report/latest`),
  googlePage: (projectId: string, days: number, url: string) =>
    get<GooglePageDetail>(`/api/projects/${projectId}/google/page?days=${days}&url=${encodeURIComponent(url)}`),
  ga4PageValue: (projectId: string, days: number) =>
    get<PageValue>(`/api/projects/${projectId}/analytics/page-value?days=${days}`),

  executiveSummary: (projectId: string, days = 28) =>
    get<ExecutiveSummary>(`/api/projects/${projectId}/opportunities/executive-summary?days=${days}`),

  issueCounts: (projectId: string, days = 28) =>
    get<IssueCounts>(`/api/projects/${projectId}/issues/counts?days=${days}`),

  issueGroups: (projectId: string, filters: IssueGroupFilters = {}, days = 28) => {
    const qs = new URLSearchParams({ status: "OPEN", days: String(days) });
    if (filters.severity) qs.set("severity", filters.severity);
    if (filters.limit) qs.set("limit", String(filters.limit));
    return get<IssueGroupList>(`/api/projects/${projectId}/issues/groups?${qs}`);
  },

  findings: (
    projectId: string,
    filters: {
      status?: string;
      lifecycle?: string;
      source?: string;
      fixClass?: string;
      category?: string;
      limit?: number;
      cursor?: string;
    } = {},
  ) => {
    const qs = new URLSearchParams();
    if (filters.status) qs.set("status", filters.status);
    if (filters.lifecycle) qs.set("lifecycle", filters.lifecycle);
    if (filters.source) qs.set("source", filters.source);
    if (filters.fixClass) qs.set("fixClass", filters.fixClass);
    if (filters.category) qs.set("category", filters.category);
    if (filters.limit) qs.set("limit", String(filters.limit));
    if (filters.cursor) qs.set("cursor", filters.cursor);
    return get<FindingListResponse>(`/api/projects/${projectId}/findings?${qs}`);
  },

  syncFindings: (projectId: string) =>
    post<{ created: number; updated: number; resolved: number }>(
      `/api/projects/${projectId}/findings/sync`,
      {},
    ),

  getFinding: (projectId: string, id: string) =>
    get<GrowthOpportunity>(`/api/projects/${projectId}/findings/${id}`),

  transitionFinding: (
    projectId: string,
    id: string,
    body: { to: string; reason?: string; snoozeUntil?: string },
  ) =>
    post<GrowthOpportunity>(
      `/api/projects/${projectId}/findings/${id}/transition`,
      body,
    ),

  issueGroupPages: (projectId: string, groupKey: string, limit = 100, cursor?: string) => {
    const qs = new URLSearchParams({ limit: String(limit) });
    if (cursor) qs.set("cursor", cursor);
    // groupKey carries "::" separators, so it is encoded as a path segment.
    return get<IssueGroupPages>(
      `/api/projects/${projectId}/issues/groups/${encodeURIComponent(groupKey)}/pages?${qs}`,
    );
  },

  /** Tracked competitors, whether or not any prompt has cited them yet. */
  listCompetitors: (projectId: string) =>
    get<TrackedCompetitor[]>(`/api/projects/${projectId}/ai-visibility/competitors`),
  /** Your website and each competitor's: read status, pages, kinds of pages, health and rating. */
  competitorWebsites: (projectId: string) =>
    get<{ sites: CompetitorWebsite[] }>(`/api/projects/${projectId}/ai-visibility/competitors/websites`),
  removeCompetitor: async (projectId: string, competitorId: string) => {
    try {
      return await request<{ removed: number }>(`/api/projects/${projectId}/ai-visibility/competitors/${competitorId}`, {
        method: "DELETE",
      });
    } catch {
      return await request<{ removed: string }>(`/api/projects/${projectId}/action-engine/competitors/${competitorId}`, {
        method: "DELETE",
      });
    }
  },
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

  getMarketIntelligence: (projectId: string) => get<MarketIntelligenceData>(`/api/projects/${projectId}/market`),
  generateMarketIntelligence: (projectId: string) => post<MarketIntelligenceData>(`/api/projects/${projectId}/market/generate`, {}),

  // ── Integrations
  getIntegrations: (projectId: string) => get<IntegrationConfigData>(`/api/projects/${projectId}/integrations`),

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
  createContentPiece: (
    projectId: string,
    body: { title: string; targetQuery?: string; format?: string; rationale?: string },
  ) => post<ContentPiece>(`/api/projects/${projectId}/automation/content/custom`, body),
  listContent: (projectId: string) => get<ContentPiece[]>(`/api/projects/${projectId}/automation/content`),
  draftContent: (projectId: string, pieceId: string) =>
    post<ContentPiece>(`/api/projects/${projectId}/automation/content/${pieceId}/draft`, {}),
  runContentPieces: (projectId: string, pieceIds?: string[]) =>
    post<AutomationRun>(`/api/projects/${projectId}/automation/runs/content`, pieceIds ? { pieceIds } : {}),
  runFixes: (projectId: string, issueIds?: string[]) =>
    post<AutomationRun>(`/api/projects/${projectId}/automation/runs/fixes`, issueIds ? { issueIds } : {}),
  /** Starts the engineer on a plain-words instruction. Returns at once with the run (RUNNING); poll the runs. */
  runEngineer: (projectId: string, instruction: string) =>
    post<AutomationRun>(`/api/projects/${projectId}/automation/runs/engineer`, { instruction }),
  listAutomationRuns: (projectId: string) => get<AutomationRun[]>(`/api/projects/${projectId}/automation/runs`),

  // ── Admin
  getAdminQueues: () => get<QueueStat[]>("/api/admin/queues"),
  getAdminCosts: () => get<ApiCostStat[]>("/api/admin/costs"),
  getAdminTenants: () => get<TenantStat[]>("/api/admin/tenants"),
  getAdminSystemHealth: () => get<AdminSystemHealth>("/api/admin/system-health"),
  getAdminUsers: () => get<AdminUserItem[]>("/api/admin/users"),
  pauseAdminQueues: () => post<{ success: boolean; status: string }>("/api/admin/queues/pause", {}),
  resumeAdminQueues: () => post<{ success: boolean; status: string }>("/api/admin/queues/resume", {}),
  retryAdminFailedJobs: () => post<{ success: boolean; retriedCount: number }>("/api/admin/queues/retry", {}),

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
    post<{ competitorDomain: TrackedCompetitor; accounts: CompetitorAccount[] }>(`/api/projects/${projectId}/content-intelligence/discover-profiles`, body),

  ingestAndAnalyzeVideo: (projectId: string, body: IngestVideoPayload) =>
    post<{ content: CompetitorContent; analysis: unknown }>(`/api/projects/${projectId}/content-intelligence/analyze-video`, body),

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

  recordOutcome: (projectId: string, body: Record<string, unknown>) =>
    post<{ success: boolean; message: string; outcomeSummary: unknown }>(`/api/projects/${projectId}/content-intelligence/record-outcome`, body),

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
  /** One entry per company, with every platform it was found on. */
  competitors: Array<{ id: string; handle: string; name: string; platforms: string[] }>;
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
  /** True when no competitor content has been collected, so nothing was scored. */
  needsData?: boolean;
  /** Why the matrix is empty, in words the customer can act on. */
  needsDataReason?: string;
}

export interface EnrichedOpportunity {
  id: string;
  topic: string;
  pillar: string;
  opportunityScore: number;
  /** Each figure is null when nothing measured it. */
  breakdown: {
    businessRelevance: number | null;
    searchOpportunity: number | null;
    competitorEvidence: number | null;
    contentGap: number | null;
    confidence: number | null;
    effort: 'LOW' | 'MEDIUM' | 'HIGH' | null;
  };
  targetMarket: string | null;
  competitorEvidenceSummary: string;
  relatedKeywords: Array<{ keyword: string }>;
  suggestedFormats: string[];
  recommendedAction: string | null;
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
    platformStrategy?: PlatformStrategy | null;
    roadmap30Day?: Roadmap30Day | null;
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
  instagramUrl?: string | null;
  youtubeUrl?: string | null;
  tiktokUrl?: string | null;
  linkedinUrl?: string | null;
  xUrl?: string | null;
  contactUrl?: string | null;
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
  instagramUrl?: string;
  youtubeUrl?: string;
  tiktokUrl?: string;
  linkedinUrl?: string;
  xUrl?: string;
  contactUrl?: string;
  profileUrl?: string;
}

export interface CreatorMatch {
  id: string;
  matchScore: number;
  scoreBreakdown: Record<string, unknown> | null;
  status: string;
  createdAt: string;
  creator: Creator;
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

// ── GrowthX Intelligence ───────────────────────────────────────────────────

export type IntelligenceSource = "CRAWL" | "GSC" | "GA4" | "GBP" | "COMPETITORS" | "AI_VISIBILITY";

export interface IntelligenceEvidence {
  id: string;
  source: IntelligenceSource;
  text: string;
  data?: Record<string, string | number | boolean | null>;
}

export interface IntelligenceFinding {
  id: string;
  type: string;
  category: "PROBLEM" | "OPPORTUNITY" | "RISK";
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  url: string | null;
  what: string;
  why: string;
  evidenceIds: string[];
  action: string;
  expectedImpact: string | null;
  measurement: string[];
  potentialClicks: number | null;
  fixIssueId?: string | null;
}

export interface IntelligencePage {
  url: string;
  path: string;
  headline: string;
  evidence: IntelligenceEvidence[];
  findings: IntelligenceFinding[];
  conclusion: string | null;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  corroboratingSources: IntelligenceSource[];
  priority: { potentialClicks: number; reason: string };
  notMeasured: { source: IntelligenceSource; reason: string }[];
}

export interface GrowthIntelligenceReport {
  question: string;
  windowDays: number;
  generatedAt: string;
  sources: Record<IntelligenceSource, { connected: boolean; note: string | null }>;
  answer: { summary: string; confidenceNote: string };
  counts: { problems: number; opportunities: number; risks: number };
  estimatedExtraClicks: number;
  risks: IntelligenceFinding[];
  problems: IntelligenceFinding[];
  opportunities: IntelligenceFinding[];
  pages: IntelligencePage[];
  evidence: Record<string, IntelligenceEvidence>;
  notMeasured: { source: IntelligenceSource; reason: string | null }[];
  methodology: { thresholds: Record<string, unknown>; notes: string[] };
}

export interface SeoImpactReadiness {
  state: "NOT_IMPLEMENTED" | "TOO_EARLY" | "READY";
  message: string;
  measurableFrom: string | null;
}

export interface SeoImpactListItem {
  id: string;
  url: string | null;
  findingType: string;
  action: string;
  note: string | null;
  status: "PLANNED" | "IMPLEMENTED";
  windowDays: number;
  createdAt: string;
  implementedAt: string | null;
  readiness: SeoImpactReadiness;
}

export interface SeoImpactChange {
  key: string;
  label: string;
  scope: "page" | "site";
  source: "GSC" | "GA4" | "GBP" | "AI_VISIBILITY";
  unit: "count_per_day" | "ratio" | "position" | "points";
  before: number | null;
  after: number | null;
  change: number | null;
  verdict: "IMPROVED" | "WORSE" | "NO_CLEAR_CHANGE" | "NOT_COMPARABLE";
  reason: string;
}

export interface SeoImpactResult {
  id: string;
  url: string | null;
  findingType: string;
  action: string;
  status: string;
  implementedAt: string | null;
  createdAt: string;
  readiness: SeoImpactReadiness;
  before: { capturedAt: string; range: { start: string; end: string; days: number } };
  after: { range: { start: string; end: string; days: number } } | null;
  changes: SeoImpactChange[];
  explanation: {
    whatChanged: string[];
    improved: string[];
    notImproved: string[];
    notComparable: string[];
    contributors: string[];
    note: string;
  } | null;
}
