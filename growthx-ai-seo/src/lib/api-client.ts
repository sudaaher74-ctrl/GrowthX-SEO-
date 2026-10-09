/**
 * Reigel AI SEO — API client.
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

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Session state lives in HttpOnly cookies the API sets, which page scripts
 * cannot read. The only thing kept here is a non-secret "signed in" flag so the
 * UI can decide what to render before the first API call, plus organization and
 * project selection. Tokens are never stored in web storage.
 */
const SESSION_FLAG_KEY = "growthx.session";

/** Browsers that stored tokens before the cookie migration: remove them. */
function purgeLegacyTokens() {
  if (typeof window === "undefined") return;
  const hadLegacy = Boolean(window.localStorage.getItem(TOKEN_KEY) || window.localStorage.getItem(REFRESH_KEY));
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(REFRESH_KEY);
  if (hadLegacy) window.localStorage.setItem(SESSION_FLAG_KEY, "1");
}
purgeLegacyTokens();

let csrfCache: { token: string; expiresAt: number } | null = null;
let csrfFetchInFlight: Promise<string | null> | null = null;

/**
 * The CSRF token is readable from the cookie only when the dashboard and API
 * share a parent domain. Otherwise ask the API for it: CORS lets only our own
 * origin read the answer. Cache it for less than the API cookie lifetime.
 */
async function ensureCsrfToken(forceRefresh = false): Promise<string | null> {
  const fromCookie = getCookie("csrf_token");
  if (fromCookie) return fromCookie;
  if (!forceRefresh && csrfCache && csrfCache.expiresAt > Date.now()) return csrfCache.token;
  if (!forceRefresh && csrfFetchInFlight) return csrfFetchInFlight;

  const fetchToken = async (): Promise<string | null> => {
    try {
      const response = await fetch(`${getApiBase()}/auth/csrf`, { credentials: "include" });
      if (!response.ok) return null;
      const body = (await response.json()) as { csrf_token?: string | null };
      const token = body.csrf_token ?? null;
      csrfCache = token ? { token, expiresAt: Date.now() + 10 * 60 * 1000 } : null;
      return token;
    } catch {
      csrfCache = null;
      return null;
    }
  };

  const pending = fetchToken();
  csrfFetchInFlight = pending;
  try {
    return await pending;
  } finally {
    if (csrfFetchInFlight === pending) csrfFetchInFlight = null;
  }
}

export const auth = {
  /** Called after the API has set the session cookies. */
  markSignedIn() {
    window.localStorage.setItem(SESSION_FLAG_KEY, "1");
    csrfCache = null;
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
    csrfCache = null;
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(TOKEN_KEY);
      window.localStorage.removeItem(REFRESH_KEY);
      window.localStorage.removeItem(SESSION_FLAG_KEY);
      window.localStorage.removeItem(ORG_KEY);
      window.localStorage.removeItem(PROJECT_KEY);
      if (typeof document !== "undefined") {
        document.cookie = "logged_in=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
        document.cookie = "csrf_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
      }
    }
    notifyAuthChange();
  },
  isAuthenticated(): boolean {
    if (typeof window === "undefined") return false;
    return Boolean(getCookie("logged_in") || window.localStorage.getItem(SESSION_FLAG_KEY));
  },
};

import type { Role, OrgMember, UserProfile, TokensOverview, TokenTransactionPage, VisibilityReport, VisibilityInsights, QuestionAnalysisReport, QuestionSuggestion, TrackedPromptRow, PortfolioResponse, CrawlJob, CrawlHistoryPoint, CrawlPage, CrawlIssue, ContentPiece, GscSummary, GscPoint, GscRow, GscStrikingDistanceRow, GscCtrOpportunity, GscDecliningRow, GoogleConnectionStatus, GrowthOpportunity, FindingListResponse, OpportunityList, Ga4Summary, Ga4Point, Ga4RangeKey, Ga4Report, PageValue, GoogleOverview, GooglePages, GoogleKeywordMovement, GoogleBreakdown, GoogleReport, GoogleAlertsReport, GooglePageDetail, IssueCounts, IssueGroupList, IssueGroupFilters, ExecutiveSummary, SiteRepository, AutomationRun, QueueStat, LocalSeoData, GeoGridRunSummary, GeoGridScanRequest, GeoGridScanResult, LocalReview, GbpLocationList, GbpSyncResult, GbpOverview, GbpMetrics, GbpReviews, GbpPhotos, GbpPosts, GbpServices, PlacesCompetitorSearch, GbpCategories, ApiCostStat, TenantStat, AdminSystemHealth, AdminUserItem, TrackedCompetitor, WebsiteAuditReport, CompetitorIntelReport, CompetitorWebsite, TrackedCompetitorList, GeoSimulationResult, SimulateGeoBody, ProgrammaticMatrixResponse, RivalMovesResponse, GbpFixSuggestion, GbpFixProposal, AutopilotRun, VoiceAgentResult, VoiceChatRequest, CrawlQualityDiagnostics, MammouthConfig, MammouthAnalysisInput, MammouthTestResult } from "./api-types";

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
  if (!auth.isAuthenticated()) return false;

  refreshInFlight ??= (async () => {
    try {
      const csrfToken = await ensureCsrfToken();
      const headers: Record<string, string> = { "Content-Type": "application/json", "x-auth-mode": "cookie" };
      if (csrfToken) headers["x-csrf-token"] = csrfToken;

      // The refresh token travels only in its HttpOnly cookie.
      const response = await fetch(`${getApiBase()}/auth/refresh`, {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({}),
      });
      if (!response.ok) return false;
      csrfCache = null;
      notifyAuthChange();
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
  const orgId = auth.getOrgId();
  const requestMethod = (init.method ?? "GET").toUpperCase();
  const isSafeMethod = requestMethod === "GET" || requestMethod === "HEAD";
  const csrfToken = isSafeMethod ? getCookie("csrf_token") : await ensureCsrfToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((init.headers as Record<string, string>) || {}),
  };
  headers["x-auth-mode"] = "cookie";
  if (orgId) headers["x-organization-id"] = orgId;
  if (csrfToken) headers["x-csrf-token"] = csrfToken;

  const baseUrl = getApiBase();
  let response: Response | null = null;

  // Only reads are retried. A POST that reached the server and failed at 503
  // may already have done its work — a market-research question, for instance,
  // spends model tokens on the way to that error, and retrying it silently
  // spends them twice and files a second run.
  const method = (init.method ?? "GET").toUpperCase();
  const retryable = method === "GET" || method === "HEAD";

  const fetchInit: RequestInit = {
    ...init,
    headers,
    credentials: "include",
  };

  try {
    response = await fetch(`${baseUrl}${path}`, fetchInit);
    if (retryable && [502, 503, 504].includes(response.status)) {
      await new Promise((res) => setTimeout(res, 800));
      response = await fetch(`${baseUrl}${path}`, fetchInit);
    }

    // The CSRF guard rejects a request before its controller runs, so retrying
    // only this exact failure cannot duplicate a completed mutation.
    if (!isSafeMethod && response.status === 403) {
      let csrfRejected = false;
      try {
        const errorBody = (await response.clone().json()) as { message?: unknown };
        const message = typeof errorBody?.message === "string" ? errorBody.message : "";
        csrfRejected = /invalid or missing csrf token/i.test(message);
      } catch {
        csrfRejected = false;
      }
      if (csrfRejected) {
        const freshToken = await ensureCsrfToken(true);
        if (freshToken) {
          headers["x-csrf-token"] = freshToken;
          response = await fetch(`${baseUrl}${path}`, fetchInit);
        }
      }
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
    "Could not reach the Reigel API. Check your connection and try again.";

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
    const onAuthPage = ["/login", "/register", "/auth/callback"].includes(window.location.pathname);
    if (!onAuthPage && process.env.NODE_ENV !== "production") {
      console.warn("Bypassing 401 redirect in development mode.");
    } else if (!onAuthPage) {
      // A full navigation discards in-memory query data from the expired session.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = "/login";
    }
  }
  throw new ApiError(response?.status ?? 0, String(message), payload);
}

const get = <T>(path: string) => request<T>(path);
const post = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });
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
    const result = await post<{ success: boolean; expires_in?: number }>("/auth/login", { email, password });
    auth.markSignedIn();
    return result;
  },
  async register(data: { email: string; password: string; firstName?: string; lastName?: string }) {
    const result = await post<{ success: boolean; expires_in?: number }>("/auth/register", data);
    auth.markSignedIn();
    return result;
  },
  /** Trades the one-time code from the Google sign-in redirect for the session tokens. */
  async exchangeLoginCode(code: string) {
    const result = await post<{ success: boolean; expires_in?: number }>("/auth/exchange", { code });
    auth.markSignedIn();
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
  deleteAccount: async () => {
    try {
      return await del<{ success: boolean }>("/auth/account");
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
        draftReviewReply: (projectId: string, reviewId: string, tone?: string) => post<LocalReview>(`/api/projects/${projectId}/local-seo/reviews/${reviewId}/draft`, { tone }),
  publishReviewReply: (projectId: string, reviewId: string, replyText: string) => post<LocalReview>(`/api/projects/${projectId}/local-seo/reviews/${reviewId}/publish`, { replyText }),

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


  /** Who Google Maps shows for a search, around this project's listing. Public Places data. */
  getPlacesCompetitors: (projectId: string, keyword: string, radiusKm?: number) =>
    post<PlacesCompetitorSearch>(`/api/projects/${projectId}/local-seo/places/competitors`, {
      keyword,
      radiusKm,
    }),


                  
          
    
  // ── Competitor SEO detail
  /** Spends Sarvam tokens, so only on request. The facts come back even if the analysis fails. */
  /** The measured half of the competitor report: what each rival has that you do not. No model call. */
  getRivalAdvantages: (projectId: string) =>
    get<CompetitorIntelReport["facts"]>(`/api/projects/${projectId}/action-engine/rival-advantages`),

  generateCompetitorIntelReport: (projectId: string) =>
    post<CompetitorIntelReport>(`/api/projects/${projectId}/action-engine/competitor-report`, {}),
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
  deleteProject: (projectId: string) => del<{ success: boolean }>(`/projects/${projectId}`),

  // ── Agency portfolio
  getPortfolio: (orgId: string, days = 28) =>
    get<PortfolioResponse>(`/api/organizations/${orgId}/portfolio?days=${days}`),
  
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
    startCrawl: (params: { websiteId?: string; domain?: string; maxDepth?: number; maxConcurrency?: number; useSitemap?: boolean }) =>
    post<{ success: boolean; jobId: string }>("/api/crawls/start", params),
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
   * Crawls or re-crawls the competitor's public website so their page coverage can be
   * compared with yours. Returns once the crawl is queued, not once it is
   * done — a few hundred pages at one request per second takes minutes.
   */
  crawlCompetitorSite: async (projectId: string, competitorId: string, options?: { force?: boolean }) => {
    // Starting a crawl is idempotent by default. Cancellation is reserved for
    // an explicit user-requested re-crawl.
    const payload = options ?? { force: false };
    try {
      return await post<{ jobId: string; websiteId: string; domain: string; pageLimit: number; alreadyRunning?: boolean }>(
        `/api/projects/${projectId}/content-intelligence/competitors/${competitorId}/crawl`,
        payload,
      );
    } catch (error) {
      // Fall back only when this deployment does not expose the primary route.
      // A timeout or server error may mean the first POST already queued work;
      // retrying a forced request could cancel that crawl and start another.
      if (!(error instanceof ApiError) || ![404, 405].includes(error.status)) throw error;
      return await post<{ jobId: string; websiteId: string; domain: string; pageLimit: number; alreadyRunning?: boolean }>(
        `/api/projects/${projectId}/ai-visibility/competitors/${competitorId}/crawl`,
        payload,
      );
    }
  },
  
  
  
  
  
  listCompetitorPages: (projectId: string, competitorId: string, pageType?: string) =>
    get<Array<{ url: string; title: string | null; metaDescription: string | null; h1: string[]; h2?: string[]; pageType: string; wordCount: number; statusCode: number; responseTimeMs: number }>>(
      `/api/projects/${projectId}/content-intelligence/competitors/${competitorId}/pages${pageType ? `?pageType=${encodeURIComponent(pageType)}` : ""}`,
    ),

  // ── Reigel Intelligence ──────────────────────────────────────────────────
  growthIntelligence: (projectId: string, days: number) =>
    get<GrowthIntelligenceReport>(`/api/projects/${projectId}/intelligence?days=${days}`),

        
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

  
  
  
  
  
  
  actionEngineCompetitors: (projectId: string) =>
    get<TrackedCompetitorList>(`/api/projects/${projectId}/action-engine/competitors`),

  
  
  
  
  
  
  
  
  
  
  simulateGeo: (projectId: string, body: SimulateGeoBody) =>
    post<GeoSimulationResult>(`/api/projects/${projectId}/ai-visibility/simulate`, body),

  
  
  getProgrammaticMatrix: (projectId: string, competitorId?: string) =>
    get<ProgrammaticMatrixResponse>(
      `/api/projects/${projectId}/action-engine/programmatic-matrix${competitorId ? `?competitorId=${encodeURIComponent(competitorId)}` : ""}`,
    ),

  getRivalMoves: (projectId: string) =>
    get<RivalMovesResponse>(`/api/projects/${projectId}/action-engine/rival-moves`),

  

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
    gscSummary: (projectId: string, days: number) =>
    get<GscSummary | null>(`/api/projects/${projectId}/search-console/summary?days=${days}`),
  gscTimeseries: (projectId: string, days: number) =>
    get<GscPoint[]>(`/api/projects/${projectId}/search-console/timeseries?days=${days}`),
  gscQueries: (projectId: string, days: number, limit = 50) =>
    get<GscRow[]>(`/api/projects/${projectId}/search-console/queries?days=${days}&limit=${limit}`),
  gscPages: (projectId: string, days: number, limit = 50) =>
    get<GscRow[]>(`/api/projects/${projectId}/search-console/pages?days=${days}&limit=${limit}`),
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

  
  transitionFinding: (
    projectId: string,
    id: string,
    body: { to: string; reason?: string; snoozeUntil?: string },
  ) =>
    post<GrowthOpportunity>(
      `/api/projects/${projectId}/findings/${id}/transition`,
      body,
    ),

  
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
  
        
    
  
  
  
  
  
  // ── Autonomous engineer: repository + content pipeline
  getRepository: (projectId: string) => get<SiteRepository | null>(`/api/projects/${projectId}/automation/repository`),
  connectRepository: (
    projectId: string,
    body: { owner: string; name: string; accessToken: string; defaultBranch?: string; framework?: string; contentDir?: string; autoMerge?: boolean },
  ) => post<SiteRepository>(`/api/projects/${projectId}/automation/repository`, body),
    createContentPiece: (
    projectId: string,
    body: { title: string; targetQuery?: string; format?: string; rationale?: string },
  ) => post<ContentPiece>(`/api/projects/${projectId}/automation/content/custom`, body),
    draftContent: (projectId: string, pieceId: string) =>
    post<ContentPiece>(`/api/projects/${projectId}/automation/content/${pieceId}/draft`, {}),
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

  
    
        
    
  
    
      
        
  
  
  
  
  
  
  
  
  
  
        
        };

// ── Content Intelligence types ────────────────────────────────────────────

// ── Reigel Intelligence ───────────────────────────────────────────────────

type IntelligenceSource = "CRAWL" | "GSC" | "GA4" | "GBP" | "COMPETITORS" | "AI_VISIBILITY";

interface IntelligenceEvidence {
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

interface IntelligencePage {
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

interface GrowthIntelligenceReport {
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
