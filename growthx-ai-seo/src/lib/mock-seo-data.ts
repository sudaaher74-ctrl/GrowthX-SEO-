// Empty schema defaults for the Enterprise SEO Dashboard

export const seoHealthStats = {
  score: 0,
  label: "No Data",
  lastCrawl: "Never",
  pagesCrawled: 0,
  estimatedOrganicImpact: "0%",
  potentialTrafficGain: "0",
  estimatedRevenueImpact: "$0"
};

export const kpiMetrics = [
  { id: "health", label: "SEO Health", value: "0%", trend: "0%", sparkline: [0, 0, 0, 0, 0, 0] },
  { id: "crawled", label: "Pages Crawled", value: "0", trend: "0", sparkline: [0, 0, 0, 0, 0, 0] },
  { id: "critical", label: "Critical Issues", value: "0", trend: "0", sparkline: [0, 0, 0, 0, 0, 0] },
  { id: "warnings", label: "Warnings", value: "0", trend: "0", sparkline: [0, 0, 0, 0, 0, 0] },
  { id: "lcp", label: "Average LCP", value: "0s", trend: "0s", sparkline: [0, 0, 0, 0, 0, 0] },
  { id: "cwv", label: "Core Web Vitals", value: "0%", trend: "0%", sparkline: [0, 0, 0, 0, 0, 0] },
  { id: "indexed", label: "Indexed Pages", value: "0", trend: "0", sparkline: [0, 0, 0, 0, 0, 0] },
  { id: "aifix", label: "AI Fix Success", value: "0%", trend: "0%", sparkline: [0, 0, 0, 0, 0, 0] }
];

export const issuesByCategory = [] as any[];

export const healthTrendData = [] as any[];

export const issueSeverityData = [] as any[];

export const pageSpeedDistribution = [] as any[];

export const newTechnicalIssues = [] as any[];

export const aiSummary = {
  strengths: [] as any[],
  opportunities: [] as any[],
  nextActions: [] as any[]
};
