// Mock data for the new Enterprise SEO Dashboard

export const seoHealthStats = {
  score: 91,
  label: "Excellent",
  lastCrawl: "2 hours ago",
  pagesCrawled: 12482,
  estimatedOrganicImpact: "+14.2%",
  potentialTrafficGain: "45,000 / mo",
  estimatedRevenueImpact: "$124,500 / mo"
};

export const kpiMetrics = [
  { id: "health", label: "SEO Health", value: "91%", trend: "+2.4%", sparkline: [75, 80, 82, 85, 88, 91] },
  { id: "crawled", label: "Pages Crawled", value: "12,482", trend: "+412", sparkline: [11000, 11500, 11800, 12100, 12300, 12482] },
  { id: "critical", label: "Critical Issues", value: "2", trend: "-5", sparkline: [12, 9, 8, 5, 3, 2] },
  { id: "warnings", label: "Warnings", value: "48", trend: "-12", sparkline: [70, 65, 62, 58, 55, 48] },
  { id: "lcp", label: "Average LCP", value: "1.2s", trend: "-0.4s", sparkline: [2.1, 1.8, 1.6, 1.5, 1.3, 1.2] },
  { id: "cwv", label: "Core Web Vitals", value: "94%", trend: "+6%", sparkline: [82, 85, 87, 89, 91, 94] },
  { id: "indexed", label: "Indexed Pages", value: "11,940", trend: "+280", sparkline: [10500, 10800, 11200, 11500, 11700, 11940] },
  { id: "aifix", label: "AI Fix Success", value: "98.2%", trend: "+1.1%", sparkline: [92, 94, 95, 96, 97, 98.2] }
];

export const issuesByCategory = [
  { name: "Content", value: 35, color: "#3b82f6" },
  { name: "Technical", value: 25, color: "#8b5cf6" },
  { name: "Meta", value: 20, color: "#f59e0b" },
  { name: "Images", value: 15, color: "#10b981" },
  { name: "Performance", value: 5, color: "#ef4444" }
];

export const healthTrendData = Array.from({ length: 30 }, (_, i) => ({
  date: new Date(Date.now() - (29 - i) * 86400000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  score: 75 + Math.sin(i * 0.2) * 5 + i * 0.5,
}));

export const issueSeverityData = [
  { date: "Week 1", critical: 15, high: 45, medium: 120, low: 300 },
  { date: "Week 2", critical: 10, high: 38, medium: 100, low: 280 },
  { date: "Week 3", critical: 5, high: 25, medium: 85, low: 250 },
  { date: "Week 4", critical: 2, high: 18, medium: 65, low: 210 },
];

export const pageSpeedDistribution = [
  { range: "0-1s", pages: 4500 },
  { range: "1-2s", pages: 5200 },
  { range: "2-3s", pages: 1800 },
  { range: "3-4s", pages: 600 },
  { range: "4s+", pages: 382 },
];

export const newTechnicalIssues = [
  { 
    id: "iss-1", 
    severity: "critical", 
    type: "Missing Self-Referencing Canonical", 
    url: "/products?color=red", 
    impact: "High", 
    difficulty: "Easy", 
    fixTime: "5m", 
    aiConfidence: 98,
    category: "Technical"
  },
  { 
    id: "iss-2", 
    severity: "critical", 
    type: "HTTP 404 Not Found", 
    url: "/old-location-page", 
    impact: "High", 
    difficulty: "Medium", 
    fixTime: "15m", 
    aiConfidence: 92,
    category: "Technical"
  },
  { 
    id: "iss-3", 
    severity: "high", 
    type: "Missing H1 Heading", 
    url: "/checkout/guest", 
    impact: "Medium", 
    difficulty: "Easy", 
    fixTime: "2m", 
    aiConfidence: 99,
    category: "Content"
  },
  { 
    id: "iss-4", 
    severity: "high", 
    type: "LCP > 3.0s", 
    url: "/landing-campaign-q4", 
    impact: "High", 
    difficulty: "Hard", 
    fixTime: "2h", 
    aiConfidence: 75,
    category: "Performance"
  },
  { 
    id: "iss-5", 
    severity: "medium", 
    type: "Missing Alt Text on Hero Image", 
    url: "/products", 
    impact: "Low", 
    difficulty: "Easy", 
    fixTime: "1m", 
    aiConfidence: 100,
    category: "Images"
  }
];

export const aiSummary = {
  strengths: [
    "Core Web Vitals pass rate is exceptionally high (94%).",
    "Zero indexation blocks on core money pages.",
    "Internal link equity distribution is highly balanced."
  ],
  opportunities: [
    "Fixing missing canonicals will consolidate 15% of diluted link juice.",
    "Adding missing H1s on checkout pages will clarify intent.",
    "Compressing 18 large images will boost mobile LCP by ~400ms."
  ],
  nextActions: [
    { text: "Approve 42 AI-generated Alt Text snippets", type: "ai-fix" },
    { text: "Canonicalize parameterized product URLs", type: "technical" },
    { text: "Redirect 4 broken legacy campaign pages", type: "content" }
  ]
};
