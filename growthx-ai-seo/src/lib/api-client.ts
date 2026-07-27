/**
 * GrowthX AI SEO — Centralized API Client Layer
 * 
 * Provides type-safe methods for interacting with the backend services (NestJS / Next.js API routes).
 * Supports automatic fallback to realistic mock data when running in standalone demo mode.
 */

import {
  mockMetrics, mockTrafficData, mockTopKeywords, mockTopPages,
  mockTechnicalIssues, mockCompetitors, mockGeoVisibility,
  mockRecentActivity, mockAutomations, mockRankTracking,
  mockContentItems, mockLocalPages, mockBacklinks
} from "./mock-data";

export interface ApiOptions {
  useMock?: boolean;
  baseUrl?: string;
}

const DEFAULT_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "/api";
const IS_DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE !== "false"; // true by default

async function fetcher<T>(endpoint: string, options?: RequestInit & { mockData?: T }): Promise<T> {
  const url = `${DEFAULT_BASE_URL}${endpoint}`;

  if (IS_DEMO_MODE && options?.mockData !== undefined) {
    // Simulate network latency in demo mode (150ms - 400ms)
    await new Promise(resolve => setTimeout(resolve, 150 + Math.random() * 250));
    return options.mockData;
  }

  try {
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
  } catch (error) {
    if (options?.mockData !== undefined) {
      console.warn(`[API Fallback] Failed to fetch ${url}, serving mock data.`, error);
      return options.mockData;
    }
    throw error;
  }
}

export const api = {
  // ── Executive Overview & Metrics ──
  getOverviewMetrics: () => fetcher("/overview/metrics", { mockData: mockMetrics }),
  getTrafficData: () => fetcher("/overview/traffic", { mockData: mockTrafficData }),
  getRecentActivity: () => fetcher("/overview/activity", { mockData: mockRecentActivity }),

  // ── Google Search Console & GA4 ──
  getTopKeywords: () => fetcher("/gsc/keywords", { mockData: mockTopKeywords }),
  getTopPages: () => fetcher("/gsc/pages", { mockData: mockTopPages }),

  // ── Technical SEO Audit ──
  getTechnicalIssues: () => fetcher("/seo/technical-issues", { mockData: mockTechnicalIssues }),
  runTechnicalAudit: async (domain: string) => {
    return fetcher("/crawls/start", {
      method: "POST",
      body: JSON.stringify({ websiteId: "mock-website-id", domain }), // Would use real ID in prod
      mockData: { success: true, jobId: "mock-job-123", message: "Crawl started" }
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
  getRankings: () => fetcher("/rankings", { mockData: mockRankTracking }),
  addKeyword: async (keyword: string, url: string) => {
    return fetcher("/rankings/add", {
      method: "POST",
      body: JSON.stringify({ keyword, url }),
      mockData: { status: "success", keyword, position: Math.floor(Math.random() * 15) + 1 }
    });
  },

  // ── AI Content Engine ──
  getContentList: () => fetcher("/ai/content", { mockData: mockContentItems }),
  generateContent: async (prompt: { title: string; type: string; keywords: string[]; wordCount: number }) => {
    return fetcher("/ai/content/generate", {
      method: "POST",
      body: JSON.stringify(prompt),
      mockData: {
        id: Date.now(),
        title: prompt.title,
        type: prompt.type,
        status: "draft",
        seoScore: Math.floor(80 + Math.random() * 15),
        words: prompt.wordCount,
        date: new Date().toISOString().slice(0, 10),
        content: `# ${prompt.title}\n\nGenerated using GrowthX AI SEO engine tuned for ${prompt.keywords.join(", ")}.\n\n## Introduction\nIn today's fast-paced landscape, optimizing your strategy around high-value search terms is essential...`
      }
    });
  },

  // ── Local SEO Generator ──
  getLocalPages: () => fetcher("/local-seo/pages", { mockData: mockLocalPages }),
  generateLocalBulk: async (city: string, services: string[]) => {
    return fetcher("/local-seo/bulk", {
      method: "POST",
      body: JSON.stringify({ city, services }),
      mockData: {
        generatedCount: services.length,
        status: "pending_approval",
        city,
        pages: services.map(s => ({ area: city, slug: `${s.toLowerCase().replace(/\s+/g, "-")}-${city.toLowerCase()}`, status: "draft" }))
      }
    });
  },

  // ── Competitors & GEO Tracking ──
  getCompetitors: () => fetcher("/competitors", { mockData: mockCompetitors }),
  getGeoVisibility: () => fetcher("/geo-visibility", { mockData: mockGeoVisibility }),

  // ── Automations & Backlinks ──
  getAutomations: () => fetcher("/automations", { mockData: mockAutomations }),
  getBacklinks: () => fetcher("/backlinks", { mockData: mockBacklinks }),
  toggleAutomation: async (id: number, status: "active" | "paused") => {
    return fetcher(`/automations/${id}/toggle`, {
      method: "POST",
      body: JSON.stringify({ status }),
      mockData: { id, status }
    });
  },

  // ── AI Assistant Chat ──
  sendChatMessage: async (message: string, context?: Record<string, any>) => {
    return fetcher("/ai/chat", {
      method: "POST",
      body: JSON.stringify({ message, context }),
      mockData: {
        role: "assistant" as const,
        content: `I analyzed your query regarding "${message}". Based on your current 78/100 SEO health score and GSC metrics, your biggest opportunity is optimizing target pages in the top 4-10 position range (like /milk-delivery-panvel) which currently receive 2,840 clicks at 9.2% CTR.`
      }
    });
  }
};
