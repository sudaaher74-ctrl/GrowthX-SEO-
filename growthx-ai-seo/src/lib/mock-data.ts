/* eslint-disable @typescript-eslint/no-explicit-any */
// Placeholder fixtures for the pages not yet wired to the API.
// Delete this file once every page reads real data.
// Empty default schemas for UI components

export const mockMetrics = {
  healthScore: 0,
  healthDelta: 0,
  traffic: 0,
  trafficDelta: 0,
  revenue: 0,
  revenueDelta: 0,
  keywords: 0,
  keywordsDelta: 0,
  seoHealthScore: 0,
  aiSeoScore: 0,
  websiteScore: 0,
  indexedPages: 0,
  backlinks: 0,
  clicks: 0,
  clicksDelta: 0,
  impressions: 0,
  impressionsDelta: 0,
  ctr: 0,
  ctrDelta: 0,
  avgPosition: 0,
  avgPositionDelta: 0,
  organicTraffic: 0,
  organicTrafficDelta: 0,
  conversions: 0,
  conversionsDelta: 0
};
export const mockTrafficData = [] as any[];
export const mockSparklines: Record<string, number[]> = {
  traffic: [],
  revenue: [],
  keywords: [],
  health: [],
  clicks: [],
  impressions: [],
  ctr: [],
  avgPosition: [],
  organicTraffic: [],
  conversions: []
};
export const mockCoreWebVitals = {
  lcp: { value: 0, unit: "s", threshold: { good: 2.5, poor: 4.0 } },
  fid: { value: 0, unit: "ms", threshold: { good: 100, poor: 300 } },
  cls: { value: 0, unit: "", threshold: { good: 0.1, poor: 0.25 } }
};
export const mockTopKeywords = [] as any[];
export const mockTopPages = [] as any[];
export const mockTechnicalIssues = {
  critical: 0,
  high: 0,
  medium: 0,
  low: 0,
  total: 0,
  items: [] as any[],
  byCategory: [] as any[]
};
export const mockCompetitors = [] as any[];
export const mockGeoVisibility = {
  countries: [] as any[],
  regions: [] as any[],
  platforms: [] as any[],
  totalMentions: 0,
  mentionsTrend: 0,
  averageScore: 0
};
export const mockRecentActivity = [] as any[];
export const mockAutomations = [] as any[];
export const mockKeywords = [] as any[];
export const mockRankTracking = [] as any[];
export const mockContentItems = [] as any[];
export const mockLocalPages = [] as any[];
export const mockBacklinks = [] as any[];
export const mockChatMessages = [] as any[];
export const mockSuggestedPrompts = [] as any[];
export const mockIndexStatus = {
  indexed: 0,
  notIndexed: 0,
  errors: 0
};
export const mockTrafficSources = [] as any[];
export const mockRankingHistory = [] as any[];
