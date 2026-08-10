/* eslint-disable @typescript-eslint/no-explicit-any */
// Demo fixtures for the pages not yet wired to the API.
// Everything below models one fictional client — Milquu (milquu.com), a
// milk & dairy delivery brand in Navi Mumbai — so every page tells the same
// consistent story when you click around.
// Delete this file once every page reads real data.

const DAY = 24 * 60 * 60 * 1000;
const daysAgoISO = (n: number, hours = 0) => new Date(Date.now() - n * DAY - hours * 60 * 60 * 1000).toISOString();
const dateStr = (n: number) => new Date(Date.now() - n * DAY).toISOString().slice(0, 10);

export const mockMetrics = {
  healthScore: 78,
  healthDelta: 6.2,
  traffic: 31600,
  trafficDelta: 18.4,
  revenue: 842000,
  revenueDelta: 12.9,
  keywords: 214,
  keywordsDelta: 9.5,
  seoHealthScore: 78,
  aiSeoScore: 71,
  websiteScore: 82,
  indexedPages: 186,
  backlinks: 2840,
  clicks: 24830,
  clicksDelta: 12.4,
  impressions: 387500,
  impressionsDelta: 8.7,
  ctr: 6.41,
  ctrDelta: 0.8,
  avgPosition: 14.2,
  avgPositionDelta: -2.1,
  organicTraffic: 18420,
  organicTrafficDelta: 15.3,
  conversions: 342,
  conversionsDelta: 22.1,
};

// 90 days of organic sessions, gently trending up with weekday seasonality.
export const mockTrafficData = Array.from({ length: 90 }, (_, i) => {
  const n = 89 - i;
  const trend = 620 + (89 - n) * 6.5;
  const weekday = new Date(Date.now() - n * DAY).getDay();
  const weekendDip = weekday === 0 || weekday === 6 ? 0.82 : 1;
  const wave = Math.sin(n / 5) * 60;
  return {
    date: dateStr(n),
    organic: Math.max(180, Math.round((trend + wave) * weekendDip)),
  };
});

export const mockSparklines: Record<string, number[]> = {
  traffic: [820, 890, 860, 940, 980, 1020, 1080, 1140, 1190, 1260, 1310, 1380],
  revenue: [58000, 61000, 59500, 64000, 67000, 69500, 71000, 73500, 76000, 79000, 81500, 84200],
  keywords: [178, 182, 185, 190, 194, 197, 201, 204, 207, 209, 211, 214],
  health: [66, 68, 69, 70, 72, 71, 73, 75, 76, 77, 78, 78],
  clicks: [640, 690, 710, 680, 730, 760, 800, 820, 850, 870, 900, 930],
  impressions: [9800, 10200, 10500, 10100, 10800, 11200, 11600, 11900, 12200, 12500, 12800, 13100],
  ctr: [5.8, 5.9, 6.0, 5.7, 6.1, 6.2, 6.0, 6.3, 6.2, 6.4, 6.3, 6.41],
  avgPosition: [17.8, 17.2, 16.9, 16.5, 16.1, 15.8, 15.4, 15.1, 14.8, 14.6, 14.3, 14.2],
  organicTraffic: [12800, 13400, 13900, 14200, 14800, 15300, 15900, 16400, 17000, 17600, 18000, 18420],
  conversions: [210, 224, 238, 251, 268, 279, 291, 305, 314, 322, 333, 342],
};

export const mockCoreWebVitals = {
  lcp: { value: 2.4, unit: "s", threshold: { good: 2.5, poor: 4.0 } },
  fid: { value: 86, unit: "ms", threshold: { good: 100, poor: 300 } },
  cls: { value: 0.14, unit: "", threshold: { good: 0.1, poor: 0.25 } },
};

export const mockTopKeywords = [
  { keyword: "milk delivery panvel", clicks: 3120, volume: 4400, ctr: 8.4, position: 2 },
  { keyword: "fresh milk subscription mumbai", clicks: 2480, volume: 3600, ctr: 7.1, position: 4 },
  { keyword: "a2 cow milk delivery", clicks: 1960, volume: 2900, ctr: 6.8, position: 5 },
  { keyword: "milk delivery kharghar", clicks: 1740, volume: 2600, ctr: 6.4, position: 3 },
  { keyword: "organic milk home delivery", clicks: 1420, volume: 3100, ctr: 4.9, position: 8 },
  { keyword: "dairy subscription navi mumbai", clicks: 1180, volume: 1400, ctr: 9.2, position: 6 },
  { keyword: "buffalo milk delivery near me", clicks: 980, volume: 1900, ctr: 5.5, position: 9 },
  { keyword: "milquu reviews", clicks: 860, volume: 720, ctr: 12.4, position: 1 },
];

export const mockTopPages = [
  { url: "/", traffic: 4280, conversions: 205, avgPosition: 6.2 },
  { url: "/milk-delivery-panvel", traffic: 2840, conversions: 233, avgPosition: 2.1 },
  { url: "/milk-delivery-kharghar", traffic: 1980, conversions: 154, avgPosition: 3.4 },
  { url: "/products/a2-cow-milk", traffic: 1540, conversions: 109, avgPosition: 4.8 },
  { url: "/blog/benefits-a2-milk", traffic: 1180, conversions: 14, avgPosition: 9.6 },
];

export const mockTechnicalIssues = {
  critical: 1,
  high: 1,
  medium: 1,
  low: 2,
  total: 5,
  items: [] as any[],
  byCategory: [
    { category: "Core Web Vitals", count: 1 },
    { category: "Meta Tags", count: 1 },
    { category: "Content Structure", count: 1 },
    { category: "Indexing", count: 1 },
    { category: "Images", count: 1 },
  ],
};

export const mockCompetitors = [
  { domain: "milkwala.in", change: -3.2, traffic: 24600, keywords: 340, backlinks: 4900, da: 42 },
  { domain: "freshdairyco.in", change: 5.1, traffic: 16200, keywords: 265, backlinks: 3100, da: 36 },
  { domain: "puredairymumbai.com", change: 1.8, traffic: 11800, keywords: 190, backlinks: 2200, da: 31 },
  { domain: "dailymilkbox.com", change: -0.6, traffic: 9400, keywords: 150, backlinks: 1600, da: 27 },
];

export const mockGeoVisibility = {
  countries: [
    { country: "India", mentions: 142, sharePct: 68 },
    { country: "United States", mentions: 18, sharePct: 9 },
    { country: "United Kingdom", mentions: 9, sharePct: 4 },
  ],
  regions: [
    { region: "Navi Mumbai", mentions: 96, sharePct: 46 },
    { region: "Mumbai", mentions: 54, sharePct: 26 },
    { region: "Pune", mentions: 20, sharePct: 10 },
  ],
  platforms: [
    { platform: "ChatGPT", mentions: 64, sharePct: 31 },
    { platform: "Google AI Overviews", mentions: 58, sharePct: 28 },
    { platform: "Perplexity", mentions: 41, sharePct: 20 },
    { platform: "Gemini", mentions: 25, sharePct: 12 },
  ],
  totalMentions: 208,
  mentionsTrend: 14.6,
  averageScore: 71,
};

export const mockRecentActivity = [
  { id: "act-1", status: "success", message: "AI fixed missing meta description on /about-us", time: daysAgoISO(0, 1) },
  { id: "act-2", status: "success", message: "Weekly Technical Audit completed — 5 issues found on milquu.com", time: daysAgoISO(0, 3) },
  { id: "act-3", status: "warning", message: "Rank Drop Alert: \"organic milk home delivery\" fell from #6 to #8", time: daysAgoISO(0, 7) },
  { id: "act-4", status: "success", message: "Published local page: Milk Delivery Ulwe", time: daysAgoISO(1, 2) },
  { id: "act-5", status: "pending", message: "AI fix for Core Web Vitals (CLS) on /products awaiting approval", time: daysAgoISO(1, 6) },
  { id: "act-6", status: "success", message: "New backlink detected from navimumbaifoodie.com (DA 38)", time: daysAgoISO(2, 1) },
  { id: "act-7", status: "success", message: "Monthly client report generated and emailed", time: daysAgoISO(3, 4) },
  { id: "act-8", status: "error", message: "GA4 sync failed — invalid refresh token, reconnect required", time: daysAgoISO(4, 2) },
  { id: "act-9", status: "success", message: "Content Refresh: updated /blog/benefits-a2-milk with new stats", time: daysAgoISO(5, 5) },
  { id: "act-10", status: "success", message: "Google Search Console re-indexed 12 updated pages", time: daysAgoISO(6, 1) },
];

export const mockAutomations = [
  { id: "auto-1", name: "Weekly Technical Audit", status: "active", trigger: "Every Monday, 9:00 AM", lastRun: "3 days ago", nextRun: "in 4 days" },
  { id: "auto-2", name: "New Product SEO", status: "active", trigger: "On new product publish", lastRun: "1 day ago", nextRun: "on next event" },
  { id: "auto-3", name: "Rank Drop Alert", status: "active", trigger: "Position drops > 5 spots", lastRun: "7 days ago", nextRun: "continuous" },
  { id: "auto-4", name: "Monthly Client Report", status: "active", trigger: "1st of every month", lastRun: "12 days ago", nextRun: "in 18 days" },
  { id: "auto-5", name: "Content Refresh", status: "paused", trigger: "Traffic drop > 20%", lastRun: "18 days ago", nextRun: "paused" },
];

export const mockKeywords = mockTopKeywords;

export const mockRankTracking = [
  { keyword: "milk delivery panvel", device: "mobile", position: 2, prev: 4, change: 2, volume: 4400, url: "/milk-delivery-panvel" },
  { keyword: "fresh milk subscription", device: "desktop", position: 4, prev: 6, change: 2, volume: 3600, url: "/" },
  { keyword: "organic milk home delivery", device: "mobile", position: 8, prev: 6, change: -2, volume: 3100, url: "/products/a2-cow-milk" },
  { keyword: "milk delivery kharghar", device: "mobile", position: 3, prev: 5, change: 2, volume: 2600, url: "/milk-delivery-kharghar" },
  { keyword: "a2 cow milk delivery", device: "desktop", position: 5, prev: 5, change: 0, volume: 2900, url: "/products/a2-cow-milk" },
  { keyword: "dairy subscription navi mumbai", device: "mobile", position: 6, prev: 11, change: 5, volume: 1400, url: "/" },
  { keyword: "buffalo milk delivery near me", device: "desktop", position: 9, prev: 8, change: -1, volume: 1900, url: "/products" },
  { keyword: "milquu reviews", device: "mobile", position: 1, prev: 1, change: 0, volume: 720, url: "/" },
];

export const mockContentItems = [
  { id: "content-1", title: "10 Benefits of A2 Cow Milk You Didn't Know", status: "published", targetQuery: "a2 cow milk health benefits", wordCount: 1450, publishedAt: daysAgoISO(9) },
  { id: "content-2", title: "Buffalo Milk vs Cow Milk: Which Is Right for You?", status: "published", targetQuery: "buffalo milk vs cow milk", wordCount: 1200, publishedAt: daysAgoISO(21) },
  { id: "content-3", title: "Why Choose Organic Dairy Delivery in Navi Mumbai", status: "draft", targetQuery: "organic dairy india", wordCount: 0, publishedAt: null },
  { id: "content-4", title: "Milk Delivery Subscription Plans Compared", status: "in_review", targetQuery: "milk delivery subscription plans", wordCount: 980, publishedAt: null },
];

export const mockLocalPages = [
  { slug: "milk-delivery-panvel", area: "Panvel", status: "published", traffic: 2840, position: 2, schema: true, faq: true },
  { slug: "milk-delivery-kharghar", area: "Kharghar", status: "published", traffic: 1980, position: 3, schema: true, faq: true },
  { slug: "milk-delivery-nerul", area: "Nerul", status: "published", traffic: 1240, position: 7, schema: true, faq: false },
  { slug: "milk-delivery-belapur", area: "Belapur", status: "published", traffic: 860, position: 11, schema: true, faq: true },
  { slug: "milk-delivery-kalamboli", area: "Kalamboli", status: "published", traffic: 540, position: 14, schema: false, faq: false },
  { slug: "milk-delivery-ulwe", area: "Ulwe", status: "pending_approval", traffic: 0, position: 0, schema: true, faq: true },
  { slug: "milk-delivery-vashi", area: "Vashi", status: "pending_approval", traffic: 0, position: 0, schema: true, faq: false },
  { slug: "milk-delivery-airoli", area: "Airoli", status: "draft", traffic: 0, position: 0, schema: false, faq: false },
];

export const mockBacklinks = [
  { domain: "navimumbaifoodie.com", type: "new", url: "https://navimumbaifoodie.com/best-milk-delivery-2026", anchor: "Milquu milk delivery", da: 38, spam: 2, date: "2 days ago" },
  { domain: "mumbaimirror.com", type: "existing", url: "https://mumbaimirror.com/lifestyle/dairy-startups", anchor: "milquu.com", da: 61, spam: 1, date: "3 weeks ago" },
  { domain: "healthyliving.in", type: "new", url: "https://healthyliving.in/a2-milk-benefits", anchor: "A2 cow milk delivery", da: 29, spam: 3, date: "5 days ago" },
  { domain: "spamdirectory.biz", type: "new", url: "https://spamdirectory.biz/link-123", anchor: "click here", da: 8, spam: 8, date: "1 day ago" },
  { domain: "localbusinesslist.in", type: "existing", url: "https://localbusinesslist.in/navi-mumbai/dairy", anchor: "Milquu", da: 22, spam: 2, date: "1 month ago" },
  { domain: "olddairyblog.com", type: "lost", url: "https://olddairyblog.com/reviews/milquu", anchor: "fresh milk delivery", da: 34, spam: 2, date: "6 days ago" },
  { domain: "parentingindia.com", type: "existing", url: "https://parentingindia.com/best-milk-for-kids", anchor: "Milquu dairy", da: 45, spam: 1, date: "2 months ago" },
];

export const mockChatMessages = [
  {
    role: "assistant" as const,
    content:
      "Hi! I'm your AI SEO assistant for milquu.com. I can see your dashboard, rankings, and technical issues in real time. Ask me anything — traffic drops, keyword opportunities, or what to fix next.",
  },
];

export const mockSuggestedPrompts = [
  "Why did traffic drop last week?",
  "What are my best keyword opportunities?",
  "Summarize my SEO health right now",
  "Show me my traffic trends",
];

export const mockIndexStatus = {
  indexed: 186,
  notIndexed: 14,
  errors: 3,
};

export const mockTrafficSources = [
  { source: "Organic Search", sessions: 18420, percentage: 58.3, color: "#7c3aed" },
  { source: "Direct", sessions: 6320, percentage: 20.0, color: "#a855f7" },
  { source: "Social", sessions: 3480, percentage: 11.0, color: "#f59e0b" },
  { source: "Referral", sessions: 2210, percentage: 7.0, color: "#10b981" },
  { source: "Paid", sessions: 1170, percentage: 3.7, color: "#ef4444" },
];

// 30 days of position history for three flagship keywords (lower = better).
export const mockRankingHistory = Array.from({ length: 30 }, (_, i) => {
  const n = 29 - i;
  const t = 29 - n; // 0..29, days elapsed
  return {
    date: dateStr(n),
    "milk delivery panvel": Math.max(1, Math.round(6 - t * 0.14 + Math.sin(t / 3) * 0.8)),
    "fresh milk subscription": Math.max(1, Math.round(9 - t * 0.16 + Math.sin(t / 4 + 1) * 1)),
    "organic milk home delivery": Math.max(1, Math.round(6 + t * 0.06 + Math.sin(t / 5 + 2) * 1.2)),
  };
});
