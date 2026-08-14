/**
 * GrowthX AI SEO — API client.
 *
 * Talks to the NestJS backend. Paths here are the real controller routes:
 * auth and organizations sit at the root, everything else under `/api`.
 */

const RAW_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
export const API_BASE = RAW_BASE.replace(/\/+$/, "");

const TOKEN_KEY = "growthx.token";
const ORG_KEY = "growthx.org";
const PROJECT_KEY = "growthx.project";

// ─────────────────────────────────────────────────────────── auth storage

export const auth = {
  getToken(): string | null {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(TOKEN_KEY);
  },
  setToken(token: string) {
    window.localStorage.setItem(TOKEN_KEY, token);
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

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = auth.getToken();
  const orgId = auth.getOrgId();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((init.headers as Record<string, string>) || {}),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  // Lets the backend resolve the org when the route does not name one.
  if (orgId) headers["x-organization-id"] = orgId;

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, { ...init, headers });
  } catch {
    throw new ApiError(0, "Could not reach the API. Is the backend running?");
  }

  const text = await response.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  if (!response.ok) {
    // Nest wraps thrown objects under `message`, so the upgrade payload can be
    // at either level depending on how the exception was constructed.
    const envelope = body as { message?: unknown } | null;
    const payload =
      envelope?.message && typeof envelope.message === "object" ? envelope.message : envelope;
    const message =
      (payload as { message?: string } | null)?.message ??
      (typeof envelope?.message === "string" ? envelope.message : null) ??
      response.statusText ??
      `Request failed (${response.status})`;

    // Login is auto-handled by DashboardShell (see dashboard-shell.tsx), so a
    // stale/expired token just gets cleared here — the next mount re-runs
    // auto-login. No forced navigation to /login.
    if (response.status === 401 && typeof window !== "undefined") {
      auth.clear();
    }
    throw new ApiError(response.status, String(message), payload);
  }

  return body as T;
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
  seoRoadmap: { horizon: string; action: string; why: string; effort: string; expectedImpact: string }[];
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
}

// ──────────────────────────────────────────────────────────────── the API

export const api = {
  // ── Auth
  async login(email: string, password: string) {
    const result = await post<{ access_token: string }>("/auth/login", { email, password });
    auth.setToken(result.access_token);
    return result;
  },
  async register(data: { email: string; password: string; firstName?: string; lastName?: string }) {
    const result = await post<{ access_token: string }>("/auth/register", data);
    auth.setToken(result.access_token);
    return result;
  },
  logout: () => auth.clear(),

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
  startCrawl: (params: { websiteId?: string; domain?: string; maxDepth?: number; maxConcurrency?: number }) =>
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

  // ── Local SEO
  getLocalSeo: (projectId: string) => get<LocalSeoData>(`/api/projects/${projectId}/local-seo`),

  // ── PR & Outreach
  getOutreachCampaigns: (projectId: string) => get<OutreachCampaign[]>(`/api/projects/${projectId}/outreach`),

  // ── Reporting
  getReportingConfig: (projectId: string) => get<ReportingConfig>(`/api/projects/${projectId}/reporting`),

  // ── Market Intelligence
  getMarketIntelligence: (projectId: string) => get<MarketIntelligenceData>(`/api/projects/${projectId}/market`),

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
};
