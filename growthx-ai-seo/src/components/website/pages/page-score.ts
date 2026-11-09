import type { CrawlPage } from "@/lib/api-client";
import type { CrawlSummary } from "@/lib/crawl-summary";

/**
 * The parts of a crawl's `qualityDiagnostics` this tab reads.
 *
 * `inventory` is the crawler's per-URL reconciliation — one row per unique
 * discovered URL — and is preferred over anything derived from the page list,
 * because a page row only exists for a URL that was successfully fetched.
 */
export interface CrawlInventoryMetrics {
  urlsDiscovered: number;
  urlsQueued: number;
  urlsCrawled: number;
  notCrawled: number;
  failed: number;
  duplicates: number;
  canonicalized: number;
  renderedPages: number;
  bySource: Record<string, number>;
  multiSourceUrls: number;
  notCrawledReasons: Record<string, number>;
  discoveredNotCrawled: Array<{ url: string; reason: string; sources?: string[] }>;
  /** Links to PDFs, images and other files: recorded, never counted as pages. */
  filesLinked?: number;
}

export interface CrawlQualityDiagnostics {
  urlsDiscovered?: number;
  urlsEligible?: number;
  pagesCrawled?: number;
  urlsSkipped?: number;
  robotsBlocked?: number;
  crawlStatus?: string;
  inventory?: CrawlInventoryMetrics | null;
  summary?: Partial<CrawlSummary> & { discoveryEvents?: Record<string, number> };
}

// Derive Deterministic SEO Score per Page (0-100)
export function getPageSeoScore(page: CrawlPage, issuesPerUrl?: Map<string, number>): number {
  let score = 100;
  if (page.statusCode >= 400) score -= 40;
  else if (page.statusCode >= 300) score -= 15;

  if (!page.title) score -= 20;
  else if (page.title.length < 15 || page.title.length > 70) score -= 8;

  if (!page.metaDescription) score -= 15;
  else if (page.metaDescription.length < 50) score -= 8;

  if (!page.h1 || page.h1.length === 0) score -= 12;
  else if (page.h1.length > 1) score -= 6;

  if (page.wordCount < 300) score -= 12;
  else if (page.wordCount < 500) score -= 6;

  const issueCount = issuesPerUrl?.get(page.url) || 0;
  score -= Math.min(issueCount * 4, 25);

  return Math.max(15, Math.min(100, score));
}

export interface ScorecardMetric {
  name: string;
  score: number;
  maxScore: number;
  deduction: number;
  status: "pass" | "warn" | "fail";
  detail: string;
  recommendation?: string;
}

export interface PageScorecardBreakdown {
  totalScore: number;
  metrics: ScorecardMetric[];
}

export function getPageScorecardBreakdown(
  page: CrawlPage,
  issuesPerUrl?: Map<string, number>
): PageScorecardBreakdown {
  const metrics: ScorecardMetric[] = [];
  let totalScore = 100;

  // 1. HTTP Status (Max 40 pt impact)
  if (page.statusCode >= 400) {
    totalScore -= 40;
    metrics.push({
      name: "HTTP Server Response",
      score: 0,
      maxScore: 40,
      deduction: 40,
      status: "fail",
      detail: `HTTP ${page.statusCode} Error`,
      recommendation: "Fix broken link destination or configure 301 redirect to target canonical resource.",
    });
  } else if (page.statusCode >= 300) {
    totalScore -= 15;
    metrics.push({
      name: "HTTP Server Response",
      score: 25,
      maxScore: 40,
      deduction: 15,
      status: "warn",
      detail: `HTTP ${page.statusCode} Redirect Chain`,
      recommendation: "Eliminate redirect hops by updating internal links directly to final destination.",
    });
  } else {
    metrics.push({
      name: "HTTP Server Response",
      score: 40,
      maxScore: 40,
      deduction: 0,
      status: "pass",
      detail: page.statusCode ? `HTTP ${page.statusCode} OK` : "HTTP OK",
    });
  }

  // 2. Title Tag (Max 20 pt impact)
  if (!page.title) {
    totalScore -= 20;
    metrics.push({
      name: "Title Tag",
      score: 0,
      maxScore: 20,
      deduction: 20,
      status: "fail",
      detail: "Missing <title> tag",
      recommendation: "Provide unique descriptive title tag between 30–60 characters containing primary keyword.",
    });
  } else if (page.title.length < 15 || page.title.length > 70) {
    totalScore -= 8;
    metrics.push({
      name: "Title Tag",
      score: 12,
      maxScore: 20,
      deduction: 8,
      status: "warn",
      detail: `${page.title.length} characters (Suboptimal length)`,
      recommendation: "Adjust title tag length between 30–60 characters to prevent SERP truncation.",
    });
  } else {
    metrics.push({
      name: "Title Tag",
      score: 20,
      maxScore: 20,
      deduction: 0,
      status: "pass",
      detail: `${page.title.length} chars: "${page.title.slice(0, 40)}${page.title.length > 40 ? "..." : ""}"`,
    });
  }

  // 3. Meta Description (Max 15 pt impact)
  if (!page.metaDescription) {
    totalScore -= 15;
    metrics.push({
      name: "Meta Description",
      score: 0,
      maxScore: 15,
      deduction: 15,
      status: "fail",
      detail: "Missing meta description",
      recommendation: "Add compelling meta description (120–160 chars) with search intent call-to-action.",
    });
  } else if (page.metaDescription.length < 50) {
    totalScore -= 8;
    metrics.push({
      name: "Meta Description",
      score: 7,
      maxScore: 15,
      deduction: 8,
      status: "warn",
      detail: `${page.metaDescription.length} characters (Too short)`,
      recommendation: "Expand meta description to at least 120 characters for higher SERP CTR.",
    });
  } else {
    metrics.push({
      name: "Meta Description",
      score: 15,
      maxScore: 15,
      deduction: 0,
      status: "pass",
      detail: `${page.metaDescription.length} characters formatted`,
    });
  }

  // 4. Heading Hierarchy (H1) (Max 12 pt impact)
  const h1Count = Array.isArray(page.h1) ? page.h1.length : page.h1 ? 1 : 0;
  if (h1Count === 0) {
    totalScore -= 12;
    metrics.push({
      name: "H1 Heading Hierarchy",
      score: 0,
      maxScore: 12,
      deduction: 12,
      status: "fail",
      detail: "Missing <h1> tag",
      recommendation: "Define exactly one primary <h1> heading summarizing the page topic.",
    });
  } else if (h1Count > 1) {
    totalScore -= 6;
    metrics.push({
      name: "H1 Heading Hierarchy",
      score: 6,
      maxScore: 12,
      deduction: 6,
      status: "warn",
      detail: `Multiple (${h1Count}) <h1> tags detected`,
      recommendation: "Consolidate into a single <h1> heading and use <h2>/<h3> for sub-sections.",
    });
  } else {
    metrics.push({
      name: "H1 Heading Hierarchy",
      score: 12,
      maxScore: 12,
      deduction: 0,
      status: "pass",
      detail: "Single primary <h1> tag verified",
    });
  }

  // 5. Content Depth & Word Count (Max 12 pt impact)
  const words = page.wordCount || 0;
  if (words < 300) {
    totalScore -= 12;
    metrics.push({
      name: "Content Depth & Word Count",
      score: 0,
      maxScore: 12,
      deduction: 12,
      status: "fail",
      detail: `${words} words (Thin content threshold < 300)`,
      recommendation: "Expand substantive editorial content to at least 500+ words to answer query intent.",
    });
  } else if (words < 500) {
    totalScore -= 6;
    metrics.push({
      name: "Content Depth & Word Count",
      score: 6,
      maxScore: 12,
      deduction: 6,
      status: "warn",
      detail: `${words} words (Moderate length)`,
      recommendation: "Enrich with supplementary FAQs, diagrams, or contextual examples.",
    });
  } else {
    metrics.push({
      name: "Content Depth & Word Count",
      score: 12,
      maxScore: 12,
      deduction: 0,
      status: "pass",
      detail: `${words.toLocaleString()} words (Comprehensive)`,
    });
  }

  // 6. Crawl Diagnostics & Issues (Max 25 pt impact)
  const issueCount = issuesPerUrl?.get(page.url) || 0;
  if (issueCount > 0) {
    const deduction = Math.min(issueCount * 4, 25);
    totalScore -= deduction;
    metrics.push({
      name: "Technical Audit Issues",
      score: 25 - deduction,
      maxScore: 25,
      deduction,
      status: issueCount >= 3 ? "fail" : "warn",
      detail: `${issueCount} technical issues on URL`,
      recommendation: "Review and resolve technical warnings in Website Audit Issues tab.",
    });
  } else {
    metrics.push({
      name: "Technical Audit Issues",
      score: 25,
      maxScore: 25,
      deduction: 0,
      status: "pass",
      detail: "0 technical issues detected on URL",
    });
  }

  return {
    totalScore: Math.max(15, Math.min(100, totalScore)),
    metrics,
  };
}
