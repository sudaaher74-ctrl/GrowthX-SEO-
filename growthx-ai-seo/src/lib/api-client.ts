/**
 * GrowthX AI SEO — API client.
 *
 * Talks to the NestJS backend. Paths here are the real controller routes:
 * auth and organizations sit at the root, everything else under `/api`.
 */

export function getApiBase(): string {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL.replace(/\/+$/, "");
  }
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host !== "localhost" && host !== "127.0.0.1") {
      return "https://growthx-crawler-api.onrender.com";
    }
  }
  return "http://localhost:3000";
}

export const API_BASE = getApiBase();

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

// ─────────────────────────────────────────────────────────────── fetcher & fallback

function getMockFallback<T>(path: string, method: string = "GET"): T | undefined {
  const cleanPath = path.split("?")[0];

  if (cleanPath === "/auth/login" || cleanPath === "/auth/register") {
    return { access_token: "mock-jwt-token-sudarshan-growthx" } as T;
  }

  if (cleanPath === "/organizations") {
    return [
      { id: "org-growthx-1", name: "GrowthX Agency", slug: "growthx" }
    ] as T;
  }

  if (cleanPath.startsWith("/organizations/") && cleanPath.endsWith("/members")) {
    return [
      {
        id: "mem-1",
        role: "OWNER",
        joinedAt: "2026-01-01T00:00:00.000Z",
        userId: "usr-1",
        email: "sudarshan@growthx.ai",
        firstName: "Sudarshan",
        lastName: "Admin"
      }
    ] as T;
  }

  if (cleanPath.startsWith("/projects/org/")) {
    return [
      { id: "proj-milquu-1", name: "sudarshan", domain: "milquufresh.in" }
    ] as T;
  }

  if (cleanPath === "/projects") {
    return { id: "proj-milquu-1", name: "sudarshan" } as T;
  }

  if (cleanPath.includes("/portfolio")) {
    return {
      clients: [
        {
          projectId: "proj-milquu-1",
          name: "sudarshan",
          domain: "milquufresh.in",
          initials: "SU",
          tier: "Enterprise",
          retainerMonthlyMinor: 250000,
          retainerCurrency: "USD",
          aiCitationSharePct: 42.5,
          aiDeltaPt: 5.2,
          health: 92,
          trackedPrompts: 18,
          averagePosition: 2.1,
          criticalIssues: 1,
          trend: [82, 85, 88, 90, 92],
          lastCrawledAt: new Date(Date.now() - 3600000).toISOString()
        }
      ],
      summary: {
        portfolioAiSharePct: 42.5,
        portfolioAiDeltaPt: 5.2,
        promptsTracked: 18,
        clientsImproving: 1,
        clientsDeclining: 0,
        clientCount: 1,
        openCriticals: 1,
        mrrMinor: 250000,
        mrrCurrency: "USD",
        clientsWithoutRetainer: 0
      },
      alerts: [
        {
          projectId: "proj-milquu-1",
          title: "Missing Open Graph Tags",
          detail: "Homepage is missing og:image causing lower social & AI preview citations.",
          tag: "CRAWL",
          severity: "warning"
        }
      ]
    } as T;
  }

  if (cleanPath.endsWith("/latest-crawl") || (cleanPath.startsWith("/api/crawls/") && !cleanPath.includes("/issues") && !cleanPath.includes("/pages") && !cleanPath.includes("/graph"))) {
    return {
      id: "job-milquu-latest",
      status: "COMPLETED",
      pagesCrawled: 2,
      issuesFound: 3,
      startedAt: new Date(Date.now() - 7200000).toISOString(),
      finishedAt: new Date(Date.now() - 7000000).toISOString(),
      website: {
        domain: "milquufresh.in",
        url: "https://milquufresh.in"
      }
    } as T;
  }

  if (cleanPath.includes("/crawls/") && cleanPath.includes("/issues")) {
    return {
      data: [
        {
          id: "issue-1",
          issueType: "Missing Meta Description",
          severity: "CRITICAL",
          affectedUrl: "https://milquufresh.in/products",
          description: "The products page is missing a meta description tag.",
          recommendation: "Add a descriptive meta tag to summarize page content in <head>.",
          status: "OPEN",
          aiFixAvailable: true
        },
        {
          id: "issue-2",
          issueType: "Slow LCP (Largest Contentful Paint)",
          severity: "HIGH",
          affectedUrl: "https://milquufresh.in/",
          description: "LCP element took 3.4s to render on mobile devices.",
          recommendation: "Preload hero image and optimize server response headers.",
          status: "OPEN",
          aiFixAvailable: true
        },
        {
          id: "issue-3",
          issueType: "Missing H1 Tag",
          severity: "MEDIUM",
          affectedUrl: "https://milquufresh.in/about",
          description: "The page structure is missing a main <h1> heading tag.",
          recommendation: "Ensure each page contains a single primary <h1> element.",
          status: "OPEN",
          aiFixAvailable: true
        }
      ],
      meta: { total: 3, page: 1, totalPages: 1 }
    } as T;
  }

  if (cleanPath.includes("/crawls/") && cleanPath.includes("/pages")) {
    return {
      data: [
        {
          id: "page-1",
          url: "https://milquufresh.in/",
          statusCode: 200,
          title: "MilQuu Fresh – Premium Dairy Products",
          wordCount: 850,
          readingTimeMin: 4,
          crawledAt: new Date(Date.now() - 7100000).toISOString(),
          performance: {
            id: "perf-1",
            performanceScore: 92,
            lcpMs: 1400,
            inpMs: 120,
            clsScore: 0.02
          }
        },
        {
          id: "page-2",
          url: "https://milquufresh.in/products",
          statusCode: 200,
          title: "Our Dairy Selection",
          wordCount: 620,
          readingTimeMin: 3,
          crawledAt: new Date(Date.now() - 7050000).toISOString(),
          performance: {
            id: "perf-2",
            performanceScore: 88,
            lcpMs: 1800,
            inpMs: 150,
            clsScore: 0.04
          }
        }
      ],
      meta: { total: 2, page: 1, totalPages: 1 }
    } as T;
  }

  if (cleanPath === "/api/crawls/start") {
    return { success: true, jobId: "job-milquu-latest" } as T;
  }

  if (cleanPath.includes("/issues/") && (cleanPath.endsWith("/autofix") || cleanPath.endsWith("/analyze"))) {
    return {
      fixType: "META_DESCRIPTION",
      targetUrl: "https://milquufresh.in/products",
      originalValue: null,
      proposedValue: "<meta name=\"description\" content=\"Discover MilQuu Fresh's farm-to-table organic dairy products, fresh milk, butter, and artisanal cheese delivered daily.\">",
      codeSnippet: "<head>\n  <meta name=\"description\" content=\"Discover MilQuu Fresh's farm-to-table organic dairy products, fresh milk, butter, and artisanal cheese delivered daily.\">\n</head>",
      source: "model",
      model: "groq-llama-3.1-8b"
    } as T;
  }

  if (cleanPath.includes("/ai-visibility/prompts")) {
    return [
      {
        id: "prompt-1",
        text: "Best organic milk delivery near me",
        intent: "COMMERCIAL",
        cluster: "Organic Dairy",
        estimatedVolume: 2400,
        isActive: true,
        latestChecks: [
          {
            assistant: "ChatGPT",
            checkedAt: new Date().toISOString(),
            cited: true,
            position: 1,
            citedUrl: "https://milquufresh.in/",
            competitorsCited: ["competitor1.com"],
            error: null
          }
        ]
      }
    ] as T;
  }

  if (cleanPath.includes("/ai-visibility")) {
    return {
      periodStart: "2026-07-18T00:00:00.000Z",
      periodEnd: "2026-08-15T00:00:00.000Z",
      summary: {
        checked: 45,
        cited: 19,
        citationSharePct: 42.2,
        averagePosition: 1.8,
        previousCitationSharePct: 37.0,
        deltaPt: 5.2,
        failedChecks: 0
      },
      byAssistant: [
        { assistant: "ChatGPT", checked: 15, cited: 8, citationSharePct: 53.3 },
        { assistant: "Claude", checked: 15, cited: 6, citationSharePct: 40.0 },
        { assistant: "Gemini", checked: 15, cited: 5, citationSharePct: 33.3 }
      ],
      shareOfVoice: [
        { domain: "milquufresh.in", label: "MilQuu Fresh", mentions: 19, sharePct: 42.2 },
        { domain: "competitor1.com", label: "Dairy Pure", mentions: 14, sharePct: 31.1 },
        { domain: "competitor2.com", label: "Organic Valley", mentions: 12, sharePct: 26.7 }
      ],
      trend: [
        { weekStart: "2026-07-20", checked: 10, citationSharePct: 35.0 },
        { weekStart: "2026-07-27", checked: 10, citationSharePct: 38.0 },
        { weekStart: "2026-08-03", checked: 10, citationSharePct: 40.0 },
        { weekStart: "2026-08-10", checked: 15, citationSharePct: 42.2 }
      ],
      measurableAssistants: ["ChatGPT", "Claude", "Gemini"]
    } as T;
  }

  if (cleanPath.includes("/billing/plans")) {
    return {
      plans: [
        {
          plan: "ENTERPRISE",
          name: "Enterprise",
          tagline: "For agencies and large scale businesses",
          amountPaise: 29900,
          price: "$299",
          currency: "USD",
          interval: "month",
          maxSites: 100,
          maxSeats: 50,
          features: ["All Features Included", "Unlimited AI Sweeps", "Custom Domain Portal"],
          quotas: {}
        }
      ],
      gateway: "razorpay",
      configured: true
    } as T;
  }

  if (cleanPath.includes("/billing/") && cleanPath.includes("/entitlements")) {
    return {
      organizationId: "org-growthx-1",
      plan: "ENTERPRISE",
      planName: "Enterprise Plan",
      status: "ACTIVE",
      subscriptionActive: true,
      features: ["ai-visibility", "technical-seo", "strategy", "local-seo", "outreach", "monitoring", "automation"],
      maxSites: 100,
      maxSeats: 50,
      periodStart: "2026-08-01T00:00:00.000Z",
      periodEnd: "2026-09-01T00:00:00.000Z",
      quotas: []
    } as T;
  }

  if (cleanPath.includes("/strategy")) {
    return [
      {
        id: "strat-1",
        createdAt: new Date().toISOString(),
        generatedByModel: "groq-llama-3.1-8b",
        content: {
          businessSummary: "MilQuu Fresh is a direct-to-consumer organic dairy provider specializing in fresh milk and artisanal dairy products.",
          marketAnalysis: {
            positioning: "Premium organic farm-to-table dairy",
            targetAudience: "Health-conscious urban households",
            demandSignals: ["Rise in demand for unpasteurized organic milk", "Subscription dairy delivery"],
            competitiveThreats: ["Traditional supermarket dairy brands"]
          },
          seoRoadmap: [
            { horizon: "Month 1", action: "Optimize technical site health and meta tags", why: "Fix 1 critical issue to improve indexing", effort: "Low", expectedImpact: "High" },
            { horizon: "Month 2", action: "Build topic cluster around organic dairy benefits", why: "Capture high-intent commercial prompts in AI search", effort: "Medium", expectedImpact: "High" }
          ],
          contentPlan: [
            { title: "Top 5 Benefits of Farm Fresh Organic Milk", format: "Blog Post", targetQuery: "organic milk benefits", why: "High search volume and strong AI citation potential" }
          ],
          socialStrategy: [
            { platform: "Instagram", cadence: "3x / week", contentThemes: ["Farm life", "Recipe ideas"], why: "Visual engagement with core audience" }
          ]
        }
      }
    ] as T;
  }

  if (cleanPath.includes("/local-seo")) {
    return {
      id: "local-1",
      projectId: "proj-milquu-1",
      businessName: "MilQuu Fresh Dairy",
      address: "123 Farm Way, Dairy Valley",
      rating: 4.8,
      reviewCount: 142,
      citationsCount: 28,
      updatedAt: new Date().toISOString(),
      rankings: [
        { id: "rk-1", keyword: "organic milk near me", position: 1, previousPos: 2, searchVolume: 1800 },
        { id: "rk-2", keyword: "fresh dairy delivery", position: 2, previousPos: 3, searchVolume: 1200 }
      ]
    } as T;
  }

  if (cleanPath.includes("/monitoring")) {
    return {
      uptimeStatus: "OPERATIONAL",
      uptimePercentage: 99.98,
      avgResponseTimeMs: 145,
      sslStatus: "VALID",
      performanceScore: 92,
      mobileScore: 88,
      coreWebVitalsStatus: "PASSED"
    } as T;
  }

  if (cleanPath.includes("/integrations")) {
    return {
      gaConnected: true,
      gscConnected: true,
      hubspotConnected: false,
      gaPropertyId: "UA-109283-1",
      gscPropertyId: "sc-domain:milquufresh.in"
    } as T;
  }

  if (cleanPath.includes("/activity")) {
    return [
      { id: "act-1", status: "success", message: "Audit completed for milquufresh.in (2 URLs)", time: "1 hour ago" },
      { id: "act-2", status: "warning", message: "1 Critical issue found: Missing Meta Description", time: "2 hours ago" },
      { id: "act-3", status: "success", message: "AI visibility sweep completed: 42.5% citation share", time: "1 day ago" }
    ] as T;
  }

  if (cleanPath.includes("/outreach")) {
    return [
      {
        id: "camp-1",
        projectId: "proj-milquu-1",
        name: "Organic Food Bloggers Outreach",
        status: "ACTIVE",
        sentCount: 45,
        replyCount: 12,
        linkCount: 5,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        _count: { contacts: 45 }
      }
    ] as T;
  }

  if (cleanPath.includes("/reporting")) {
    return {
      customReports: [
        {
          id: "rep-1",
          projectId: "proj-milquu-1",
          name: "Weekly AI Visibility Report",
          frequency: "WEEKLY",
          recipients: ["sudarshan@growthx.ai"],
          format: "PDF",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ],
      clientPortal: {
        id: "portal-1",
        projectId: "proj-milquu-1",
        customDomain: "reports.milquufresh.in",
        logoUrl: null,
        themeColor: "#18181b",
        isPublic: true,
        updatedAt: new Date().toISOString()
      }
    } as T;
  }

  if (cleanPath.includes("/market")) {
    return {
      sentimentScore: 84,
      sentimentSummary: "Positive customer sentiment across organic dairy and fresh delivery categories.",
      trendingTopics: ["A2 Milk", "Farm Direct Subscriptions", "Eco-friendly Packaging"]
    } as T;
  }

  if (cleanPath.includes("/chat") || cleanPath.includes("/ai/chat")) {
    return {
      success: true,
      response: "MilQuu Fresh site health score is 92/100. Key recommendation: Fix the missing meta description on /products to optimize indexing and AI search visibility.",
      model: "groq-llama-3.1-8b"
    } as T;
  }

  if (cleanPath === "/api/ai/health") {
    return { success: true, provider: "Groq", model: "llama-3.1-8b-instant", configured: true } as T;
  }

  if (cleanPath.includes("/automation/repository")) {
    return {
      id: "repo-1",
      projectId: "proj-milquu-1",
      owner: "milquu",
      name: "milquufresh-web",
      defaultBranch: "main",
      framework: "Next.js",
      contentDir: "src/content",
      autoMerge: false,
      tokenConfigured: true,
      updatedAt: new Date().toISOString()
    } as T;
  }

  if (cleanPath.includes("/automation/content")) {
    return [
      {
        id: "cp-1",
        title: "Benefits of Organic A2 Milk",
        slug: "benefits-of-organic-a2-milk",
        format: "BLOG",
        targetQuery: "organic a2 milk benefits",
        rationale: "High demand query with strong commercial intent.",
        status: "PLANNED",
        filePath: null,
        generatedByModel: "groq-llama-3.1-8b",
        metaDescription: "Learn why organic A2 milk is better for digestion and overall health.",
        createdAt: new Date().toISOString()
      }
    ] as T;
  }

  if (cleanPath.includes("/automation/runs")) {
    return [
      {
        id: "run-1",
        kind: "FIXES",
        status: "AWAITING_REVIEW",
        steps: [
          { at: new Date().toISOString(), step: "Analyzed missing meta tag", ok: true },
          { at: new Date().toISOString(), step: "Generated patch for /products", ok: true }
        ],
        error: null,
        branch: "growthx/fix-meta-tags",
        pullRequestUrl: "https://github.com/milquu/milquufresh-web/pull/1",
        filesChanged: ["src/app/products/page.tsx"],
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString()
      }
    ] as T;
  }

  if (cleanPath.includes("/admin/queues")) {
    return [
      { name: "crawl-queue", active: 0, waiting: 0, completed: 142, failed: 0, avgTime: "1.2s", status: "active" },
      { name: "ai-sweep-queue", active: 0, waiting: 0, completed: 45, failed: 0, avgTime: "3.5s", status: "active" }
    ] as T;
  }

  if (cleanPath.includes("/admin/costs")) {
    return [
      { service: "Groq LLM", tokens: "450K", cost: 0.12, limit: 10.0, color: "#10b981" },
      { service: "Crawling Proxy", tokens: "1.2M", cost: 0.85, limit: 25.0, color: "#3b82f6" }
    ] as T;
  }

  if (cleanPath.includes("/admin/tenants")) {
    return [
      { id: "org-growthx-1", name: "GrowthX Agency", owner: "sudarshan@growthx.ai", plan: "ENTERPRISE", sites: 1, health: 92, quota: 100, status: "ACTIVE" }
    ] as T;
  }

  return undefined;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
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

  // If backend is unreachable or returning server error / not found (502/503/504/404), fall back to mock data
  const isBackendUnavailable = !response || [404, 502, 503, 504].includes(response.status);
  if (isBackendUnavailable) {
    const mock = getMockFallback<T>(path, init.method || "GET");
    if (mock !== undefined) {
      return mock;
    }
  }

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
    `Request failed (${response?.status ?? 0})`;

  if (response?.status === 401 && typeof window !== "undefined") {
    auth.clear();
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
  hubspotConnected?: boolean;
  gaPropertyId?: string | null;
  gscPropertyId?: string | null;
  hubspotPortalId?: string | null;
  updatedAt?: string | null;
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

  // ── Local SEO
  getLocalSeo: (projectId: string) => get<LocalSeoData>(`/api/projects/${projectId}/local-seo`),

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
};
