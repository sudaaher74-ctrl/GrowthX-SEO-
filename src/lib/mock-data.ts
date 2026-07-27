// Mock data for the entire GrowthX AI SEO dashboard

export const mockMetrics = {
  seoHealthScore: 78,
  aiSeoScore: 84,
  websiteScore: 71,
  clicks: 24_830,
  clicksDelta: 12.4,
  impressions: 387_500,
  impressionsDelta: 8.7,
  ctr: 6.41,
  ctrDelta: 0.8,
  avgPosition: 14.2,
  avgPositionDelta: -2.1, // lower is better
  organicTraffic: 18_420,
  organicTrafficDelta: 15.3,
  conversions: 342,
  conversionsDelta: 22.1,
  revenue: 48_600,
  revenueDelta: 18.5,
  keywordGrowth: 127,
  backlinks: 2_840,
  backlinksDelta: 5.2,
  indexedPages: 1_247,
};

export const mockTrafficData = Array.from({ length: 90 }, (_, i) => {
  const date = new Date();
  date.setDate(date.getDate() - (89 - i));
  const base = 400 + Math.sin(i * 0.1) * 80 + i * 1.5;
  return {
    date: date.toISOString().slice(0, 10),
    organic: Math.round(base + Math.random() * 60),
    direct: Math.round(base * 0.3 + Math.random() * 30),
    referral: Math.round(base * 0.15 + Math.random() * 20),
    paid: Math.round(base * 0.2 + Math.random() * 25),
  };
});

export const mockSparklines: Record<string, number[]> = {
  clicks: Array.from({ length: 14 }, () => Math.round(700 + Math.random() * 400)),
  impressions: Array.from({ length: 14 }, () => Math.round(10000 + Math.random() * 4000)),
  ctr: Array.from({ length: 14 }, () => parseFloat((5.5 + Math.random() * 2).toFixed(2))),
  avgPosition: Array.from({ length: 14 }, () => parseFloat((12 + Math.random() * 6).toFixed(1))),
  organicTraffic: Array.from({ length: 14 }, () => Math.round(500 + Math.random() * 300)),
  conversions: Array.from({ length: 14 }, () => Math.round(8 + Math.random() * 8)),
};

export const mockCoreWebVitals = {
  lcp: { value: 2.1, unit: "s", status: "good", threshold: { good: 2.5, poor: 4.0 } },
  inp: { value: 87, unit: "ms", status: "good", threshold: { good: 200, poor: 500 } },
  cls: { value: 0.08, unit: "", status: "good", threshold: { good: 0.1, poor: 0.25 } },
  fid: { value: 42, unit: "ms", status: "good", threshold: { good: 100, poor: 300 } },
  ttfb: { value: 0.38, unit: "s", status: "good", threshold: { good: 0.8, poor: 1.8 } },
};

export const mockTopKeywords = [
  { keyword: "milk delivery near me", position: 3, prevPosition: 5, volume: 8400, clicks: 1240, ctr: 14.8, change: 2 },
  { keyword: "fresh milk subscription panvel", position: 7, prevPosition: 12, volume: 3200, clicks: 420, ctr: 13.1, change: 5 },
  { keyword: "A2 milk delivery navi mumbai", position: 11, prevPosition: 9, volume: 2100, clicks: 180, ctr: 8.6, change: -2 },
  { keyword: "organic milk home delivery", position: 14, prevPosition: 18, volume: 5600, clicks: 310, ctr: 5.5, change: 4 },
  { keyword: "cow milk delivery kharghar", position: 5, prevPosition: 5, volume: 1800, clicks: 260, ctr: 14.4, change: 0 },
  { keyword: "buffalo milk delivery nerul", position: 8, prevPosition: 14, volume: 1400, clicks: 195, ctr: 13.9, change: 6 },
  { keyword: "milk delivery subscription mumbai", position: 19, prevPosition: 24, volume: 4200, clicks: 145, ctr: 3.5, change: 5 },
  { keyword: "fresh dairy products belapur", position: 12, prevPosition: 11, volume: 1100, clicks: 98, ctr: 8.9, change: -1 },
  { keyword: "milk home delivery panvel", position: 2, prevPosition: 4, volume: 2800, clicks: 680, ctr: 24.3, change: 2 },
  { keyword: "best milk brand navi mumbai", position: 22, prevPosition: 28, volume: 3500, clicks: 112, ctr: 3.2, change: 6 },
];

export const mockTopPages = [
  { url: "/", title: "Home — MilQuu Fresh Dairy", clicks: 4280, impressions: 52000, ctr: 8.2, position: 5.4 },
  { url: "/milk-delivery-panvel", title: "Milk Delivery Panvel | MilQuu", clicks: 2840, impressions: 31000, ctr: 9.2, position: 3.1 },
  { url: "/milk-delivery-kharghar", title: "Milk Delivery Kharghar | MilQuu", clicks: 1980, impressions: 22000, ctr: 9.0, position: 4.2 },
  { url: "/products/a2-cow-milk", title: "A2 Cow Milk — Pure & Fresh", clicks: 1540, impressions: 18500, ctr: 8.3, position: 6.8 },
  { url: "/milk-delivery-nerul", title: "Milk Delivery Nerul | MilQuu", clicks: 1320, impressions: 16000, ctr: 8.3, position: 5.1 },
  { url: "/blog/benefits-a2-milk", title: "7 Benefits of A2 Milk You Must Know", clicks: 1180, impressions: 28000, ctr: 4.2, position: 11.2 },
  { url: "/products/buffalo-milk", title: "Buffalo Milk — Creamy & Nutritious", clicks: 980, impressions: 14200, ctr: 6.9, position: 8.4 },
  { url: "/milk-delivery-belapur", title: "Milk Delivery Belapur | MilQuu", clicks: 870, impressions: 11800, ctr: 7.4, position: 6.2 },
];

export const mockTechnicalIssues = {
  total: 47,
  critical: 4,
  high: 12,
  medium: 19,
  low: 12,
  byCategory: [
    { name: "Broken Links", count: 8, severity: "high" },
    { name: "Missing Meta Desc", count: 14, severity: "medium" },
    { name: "Duplicate Titles", count: 3, severity: "high" },
    { name: "Missing H1", count: 5, severity: "high" },
    { name: "Large Images", count: 18, severity: "medium" },
    { name: "Missing Alt Text", count: 22, severity: "medium" },
    { name: "Slow Pages", count: 6, severity: "high" },
    { name: "Canonical Issues", count: 2, severity: "critical" },
    { name: "404 Errors", count: 4, severity: "critical" },
    { name: "Redirect Chains", count: 3, severity: "medium" },
  ],
};

export const mockCompetitors = [
  { domain: "dairybestmumbai.com", traffic: 32400, keywords: 1240, backlinks: 3200, da: 38, change: -3.2 },
  { domain: "freshmilkdelivery.in", traffic: 18700, keywords: 890, backlinks: 1840, da: 31, change: 5.1 },
  { domain: "puremilkhome.com", traffic: 11200, keywords: 540, backlinks: 980, da: 26, change: -1.4 },
  { domain: "milkwala.in", traffic: 28600, keywords: 1640, backlinks: 4100, da: 42, change: 8.7 },
];

export const mockGeoVisibility = {
  platforms: [
    { name: "Google AI Overviews", score: 42, mentions: 8, trend: 12.4, color: "#8b5cf6" },
    { name: "ChatGPT", score: 28, mentions: 5, trend: -3.2, color: "#10a37f" },
    { name: "Perplexity", score: 35, mentions: 6, trend: 18.7, color: "#7c3aed" },
    { name: "Gemini", score: 31, mentions: 4, trend: 7.1, color: "#a855f7" },
    { name: "Claude", score: 18, mentions: 3, trend: 2.5, color: "#cc9b7a" },
  ],
  totalMentions: 26,
  mentionsTrend: 8.4,
  averageScore: 30.8,
};

export const mockRecentActivity = [
  { id: 1, type: "ai_fix", message: "AI generated meta descriptions for 14 pages", time: new Date(Date.now() - 15 * 60000), status: "pending" },
  { id: 2, type: "rank_change", message: "milk delivery panvel jumped to position 2", time: new Date(Date.now() - 45 * 60000), status: "success" },
  { id: 3, type: "technical", message: "Weekly technical audit completed — 47 issues found", time: new Date(Date.now() - 2 * 3600000), status: "warning" },
  { id: 4, type: "content", message: "Blog post generated: '7 Benefits of A2 Milk' — awaiting approval", time: new Date(Date.now() - 3 * 3600000), status: "pending" },
  { id: 5, type: "backlink", message: "3 new backlinks discovered from dairyindia.com", time: new Date(Date.now() - 6 * 3600000), status: "success" },
  { id: 6, type: "schema", message: "LocalBusiness schema updated for 8 location pages", time: new Date(Date.now() - 8 * 3600000), status: "success" },
  { id: 7, type: "rank_change", message: "buffalo milk delivery nerul dropped to position 8", time: new Date(Date.now() - 12 * 3600000), status: "error" },
];

export const mockAutomations = [
  { id: 1, name: "Weekly Technical Audit", trigger: "Every Monday 9AM", status: "active", lastRun: "2026-07-21", nextRun: "2026-07-28" },
  { id: 2, name: "New Product SEO", trigger: "On new product added", status: "active", lastRun: "2026-07-24", nextRun: "On trigger" },
  { id: 3, name: "Rank Drop Alert", trigger: "Position drops > 5", status: "active", lastRun: "2026-07-26", nextRun: "Continuous" },
  { id: 4, name: "Monthly Client Report", trigger: "1st of every month", status: "active", lastRun: "2026-07-01", nextRun: "2026-08-01" },
  { id: 5, name: "Content Refresh AI", trigger: "Page traffic drops 20%", status: "paused", lastRun: "2026-07-15", nextRun: "Paused" },
];

export const mockKeywords = [
  { keyword: "milk delivery panvel", volume: 2800, difficulty: 32, cpc: 1.24, intent: "Commercial", trend: "up", opportunity: 88 },
  { keyword: "fresh milk subscription", volume: 5400, difficulty: 45, cpc: 1.85, intent: "Transactional", trend: "up", opportunity: 72 },
  { keyword: "A2 cow milk benefits", volume: 12000, difficulty: 38, cpc: 0.45, intent: "Informational", trend: "up", opportunity: 81 },
  { keyword: "organic milk delivery mumbai", volume: 3200, difficulty: 28, cpc: 1.56, intent: "Commercial", trend: "stable", opportunity: 90 },
  { keyword: "best milk for toddlers india", volume: 8800, difficulty: 52, cpc: 0.72, intent: "Informational", trend: "up", opportunity: 65 },
  { keyword: "buffalo milk vs cow milk", volume: 6400, difficulty: 35, cpc: 0.38, intent: "Informational", trend: "up", opportunity: 78 },
  { keyword: "milk home delivery near me", volume: 18000, difficulty: 58, cpc: 2.10, intent: "Commercial", trend: "up", opportunity: 55 },
  { keyword: "dairy subscription navi mumbai", volume: 1400, difficulty: 22, cpc: 1.78, intent: "Transactional", trend: "up", opportunity: 95 },
  { keyword: "buy A2 milk online", volume: 9200, difficulty: 48, cpc: 1.95, intent: "Transactional", trend: "up", opportunity: 68 },
  { keyword: "milk delivery kharghar", volume: 1800, difficulty: 18, cpc: 0.95, intent: "Commercial", trend: "stable", opportunity: 96 },
];

export const mockRankTracking = [
  { keyword: "milk delivery panvel", position: 2, prev: 4, url: "/milk-delivery-panvel", device: "mobile", change: 2, volume: 2800 },
  { keyword: "fresh milk subscription panvel", position: 7, prev: 12, url: "/", device: "desktop", change: 5, volume: 3200 },
  { keyword: "A2 milk delivery navi mumbai", position: 11, prev: 9, url: "/products/a2-cow-milk", device: "desktop", change: -2, volume: 2100 },
  { keyword: "organic milk home delivery", position: 14, prev: 18, url: "/", device: "mobile", change: 4, volume: 5600 },
  { keyword: "cow milk delivery kharghar", position: 5, prev: 5, url: "/milk-delivery-kharghar", device: "desktop", change: 0, volume: 1800 },
  { keyword: "milk delivery near me", position: 3, prev: 5, url: "/", device: "mobile", change: 2, volume: 8400 },
  { keyword: "buffalo milk delivery nerul", position: 8, prev: 14, url: "/milk-delivery-nerul", device: "desktop", change: 6, volume: 1400 },
  { keyword: "dairy subscription mumbai", position: 19, prev: 24, url: "/", device: "desktop", change: 5, volume: 4200 },
];

export const mockContentItems = [
  { id: 1, title: "7 Benefits of A2 Milk You Must Know", type: "Blog", status: "published", seoScore: 84, words: 1840, date: "2026-07-15" },
  { id: 2, title: "Milk Delivery Panvel — Fast & Fresh", type: "Location", status: "published", seoScore: 92, words: 620, date: "2026-07-10" },
  { id: 3, title: "Why Buffalo Milk is Superior for Indian Cuisine", type: "Blog", status: "pending_approval", seoScore: 76, words: 2100, date: "2026-07-26" },
  { id: 4, title: "Milk Delivery Belapur — Same Day Service", type: "Location", status: "pending_approval", seoScore: 88, words: 580, date: "2026-07-26" },
  { id: 5, title: "A2 Cow Milk vs Regular Milk: Complete Comparison", type: "Blog", status: "draft", seoScore: 62, words: 1650, date: "2026-07-25" },
  { id: 6, title: "Fresh Dairy Subscription Plans — Navi Mumbai", type: "Landing", status: "draft", seoScore: 71, words: 980, date: "2026-07-24" },
];

export const mockLocalPages = [
  { area: "Panvel", slug: "milk-delivery-panvel", status: "published", traffic: 2840, position: 2, schema: true, faq: true },
  { area: "Kharghar", slug: "milk-delivery-kharghar", status: "published", traffic: 1980, position: 5, schema: true, faq: true },
  { area: "Nerul", slug: "milk-delivery-nerul", status: "published", traffic: 1320, position: 8, schema: true, faq: false },
  { area: "Belapur", slug: "milk-delivery-belapur", status: "pending_approval", traffic: 0, position: null, schema: true, faq: true },
  { area: "Ulwe", slug: "milk-delivery-ulwe", status: "draft", traffic: 0, position: null, schema: false, faq: false },
  { area: "Vashi", slug: "milk-delivery-vashi", status: "draft", traffic: 0, position: null, schema: false, faq: false },
  { area: "Airoli", slug: "milk-delivery-airoli", status: "draft", traffic: 0, position: null, schema: false, faq: false },
  { area: "Ghansoli", slug: "milk-delivery-ghansoli", status: "draft", traffic: 0, position: null, schema: false, faq: false },
];

export const mockBacklinks = [
  { domain: "dairyindia.com", url: "https://dairyindia.com/best-milk-brands", type: "new", da: 48, anchor: "MilQuu fresh dairy", date: "2026-07-25", spam: 2 },
  { domain: "healthnewstoday.in", url: "https://healthnewstoday.in/a2-milk-review", type: "new", da: 42, anchor: "A2 milk delivery", date: "2026-07-24", spam: 5 },
  { domain: "parenting101.co.in", url: "https://parenting101.co.in/toddler-nutrition", type: "new", da: 35, anchor: "fresh cow milk", date: "2026-07-22", spam: 3 },
  { domain: "mumbaifoodie.com", url: "https://mumbaifoodie.com/dairy-review", type: "lost", da: 51, anchor: "MilQuu", date: "2026-07-20", spam: 1 },
  { domain: "navimumbaiguide.com", url: "https://navimumbaiguide.com/essentials", type: "existing", da: 38, anchor: "milk delivery panvel", date: "2026-06-15", spam: 4 },
];

export const mockChatMessages = [
  { role: "assistant" as const, content: "Hi! I'm your AI SEO Assistant. I have full access to your GrowthX dashboard data. Ask me anything about your site's SEO performance, content opportunities, technical issues, or rankings. What would you like to explore?" },
];

export const mockSuggestedPrompts = [
  "Why did my traffic drop last week?",
  "Which pages need urgent optimization?",
  "Generate meta descriptions for my top 10 pages",
  "What are my biggest keyword opportunities?",
  "Fix the technical SEO issues on my homepage",
  "Generate a local SEO page for Vashi",
  "Explain why my CTR is low",
  "Which competitor is gaining the most ground?",
];

export const mockIndexStatus = {
  indexed: 1247,
  crawled: 1389,
  excluded: 142,
  errors: 18,
  warnings: 34,
};

export const mockTrafficSources = [
  { source: "Organic Search", sessions: 18420, percentage: 58.4, color: "#7c3aed" },
  { source: "Direct", sessions: 5840, percentage: 18.5, color: "#8b5cf6" },
  { source: "Referral", sessions: 3920, percentage: 12.4, color: "#a855f7" },
  { source: "Social Media", sessions: 2180, percentage: 6.9, color: "#d946ef" },
  { source: "Paid Search", sessions: 1200, percentage: 3.8, color: "#10b981" },
];

export const mockRankingHistory = Array.from({ length: 30 }, (_, i) => {
  const date = new Date();
  date.setDate(date.getDate() - (29 - i));
  return {
    date: date.toISOString().slice(0, 10),
    "milk delivery panvel": Math.max(1, Math.round(4 - i * 0.07 + Math.sin(i * 0.3) * 1.5)),
    "fresh milk subscription": Math.max(1, Math.round(14 - i * 0.24 + Math.sin(i * 0.4) * 2)),
    "organic milk home delivery": Math.max(1, Math.round(20 - i * 0.2 + Math.sin(i * 0.5) * 2.5)),
  };
});
