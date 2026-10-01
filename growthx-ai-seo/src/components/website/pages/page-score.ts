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
