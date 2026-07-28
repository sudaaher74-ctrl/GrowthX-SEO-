/**
 * GrowthX AI SEO — Centralized API Client Layer
 * 
 * Provides type-safe methods for interacting with the backend services (NestJS API routes).
 */

export interface ApiOptions {
  baseUrl?: string;
  headers?: HeadersInit;
}

let DEFAULT_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "https://growthx-crawler-api.onrender.com";
if (DEFAULT_BASE_URL.startsWith("http") && !DEFAULT_BASE_URL.endsWith("/api")) {
  DEFAULT_BASE_URL = `${DEFAULT_BASE_URL.replace(/\/$/, "")}/api`;
}

async function fetcher<T = any>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${DEFAULT_BASE_URL}${endpoint}`;

  const res = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
    ...options,
  });

  if (!res.ok) {
    throw new Error(`API Error: ${res.status} ${res.statusText}`);
  }

  return await res.json();
}

export const api = {
  // ── Executive Overview & Metrics ──
  getOverviewMetrics: () => fetcher("/overview/metrics"),
  getTrafficData: () => fetcher("/overview/traffic"),
  getRecentActivity: () => fetcher("/overview/activity"),

  // ── Google Search Console & GA4 ──
  getTopKeywords: () => fetcher("/gsc/keywords"),
  getTopPages: () => fetcher("/gsc/pages"),

  // ── Websites & Onboarding ──
  registerWebsite: async (url: string, domain: string) => {
    return fetcher("/websites", {
      method: "POST",
      body: JSON.stringify({ url, domain }),
    });
  },
  verifyDomain: async (id: string) => {
    return fetcher(`/websites/${id}/verify`, {
      method: "POST",
    });
  },

  // ── Technical SEO Audit ──
  getTechnicalIssues: () => fetcher("/seo/technical-issues"),
  runTechnicalAudit: async (domain: string) => {
    return fetcher("/crawls/start", {
      method: "POST",
      body: JSON.stringify({ domain }), 
    });
  },

  // ── AI Auto Fix & Analysis ──
  analyzeIssue: async (issueId: string) => {
    return fetcher(`/issues/${issueId}/analyze`, { method: "POST" });
  },
  autoFixIssue: async (issueId: string) => {
    return fetcher(`/issues/${issueId}/autofix`, { method: "POST" });
  },

  // ── Rank Tracking ──
  getRankings: () => fetcher("/rankings"),
  addKeyword: async (keyword: string, url: string) => {
    return fetcher("/rankings/add", {
      method: "POST",
      body: JSON.stringify({ keyword, url }),
    });
  },

  // ── AI Content Engine ──
  getContentList: () => fetcher("/ai/content"),
  generateContent: async (prompt: { title: string; type: string; keywords: string[]; wordCount: number }) => {
    return fetcher("/ai/content/generate", {
      method: "POST",
      body: JSON.stringify(prompt),
    });
  },

  // ── Local SEO Generator ──
  getLocalPages: () => fetcher("/local-seo/pages"),
  generateLocalBulk: async (city: string, services: string[]) => {
    return fetcher("/local-seo/bulk", {
      method: "POST",
      body: JSON.stringify({ city, services }),
    });
  },

  // ── Competitors & GEO Tracking ──
  getCompetitors: () => fetcher("/competitors"),
  getGeoVisibility: () => fetcher("/geo-visibility"),

  // ── Automations & Backlinks ──
  getAutomations: () => fetcher("/automations"),
  getBacklinks: () => fetcher("/backlinks"),
  toggleAutomation: async (id: number, status: "active" | "paused") => {
    return fetcher(`/automations/${id}/toggle`, {
      method: "POST",
      body: JSON.stringify({ status }),
    });
  },

  // ── AI Assistant Chat ──
  sendChatMessage: async (message: string, context?: Record<string, any>) => {
    return fetcher("/ai/chat", {
      method: "POST",
      body: JSON.stringify({ message, context }),
    });
  }
};
