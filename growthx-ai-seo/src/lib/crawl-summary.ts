/**
 * Shared with the crawler.
 *
 * This file is a copy of `growthx-ai-crawler/src/modules/crawler/crawl-summary.ts`
 * rather than an import: the two projects are separate builds with no shared
 * package, and the alternative - each surface computing its own totals - is the
 * defect this module exists to remove. The Technical SEO tab and the Pages tab
 * used to derive the same numbers by different formulas and disagree on screen,
 * showing "Crawlability 100%, 0 blocked" beside "1 Blocked" for one crawl. Keep
 * the two copies identical; the crawler's version is the original.
 */
type Indexability = 'INDEXABLE' | 'NOT_INDEXABLE' | 'UNKNOWN';

export interface SummaryPage {
  url: string;
  statusCode?: number | null;
  indexability?: string | null;
  blockedSuspected?: boolean | null;
  jsRequired?: boolean | null;
  discoverySource?: string | null;
  fetchFailed?: boolean;
}

export interface SummaryIssue {
  issueType: string;
  severity: string;
  confidence?: string | null;
  affectedUrl?: string | null;
}

export interface CoreWebVitals {
  lcpMs: number | null;
  inpMs: number | null;
  cls: number | null;
  /** "No data" is a real state. A missing metric is never a pass. */
  status: 'Good' | 'Needs Work' | 'Poor' | 'No data';
  pagesMeasured: number;
}

export interface HealthScoreBreakdown {
  score: number;
  pagesScored: number;
  pagesExcluded: number;
  penalties: Array<{ severity: string; count: number; penalty: number }>;
  totalPenalty: number;
  note: string;
}

export interface DiscoveredNotCrawledUrl {
  url: string;
  reason: string;
  /** Every source that found this URL, so the row explains itself. */
  sources?: string[];
}

export interface CrawlDiscoveryMetrics {
  urlsDiscovered?: number;
  urlsQueued?: number;
  urlsCrawled?: number;
  failed?: number;
  duplicates?: number;
  canonicalized?: number;
  /**
   * Unique URLs attributed to each discovery source. A URL found in both the
   * sitemap and an internal link counts once under each, so these do not sum
   * to `urlsDiscovered` — see `multiSourceUrls` for the overlap.
   */
  bySource?: Record<string, number>;
  /**
   * Raw discovery events per source: every anchor on every page, not the
   * unique URLs behind them. Kept apart from `bySource` because presenting
   * "1,400 internal links" as "1,400 URLs" is how a source breakdown starts
   * claiming more URLs than the site has.
   */
  discoveryEvents?: Record<string, number>;
  /** URLs attributed to more than one source, i.e. the double-counted overlap. */
  multiSourceUrls?: number;
  /** Pages the render tier actually executed. */
  renderedPages?: number;
  /** Whether JavaScript rendering ran at all for this crawl. */
  renderingEnabled?: boolean;
  discoveredNotCrawled?: DiscoveredNotCrawledUrl[];
}

export interface CrawlSummary {
  pagesCrawled: number;
  /** Fetched with a 2xx. */
  successful: number;
  redirected: number;
  errored: number;
  /** Suspected bot-blocked. Counted apart from errors on purpose. */
  blocked: number;
  /** No origin response at all. */
  unreachable: number;
  indexable: number;
  nonIndexable: number;
  indexabilityUnknown: number;
  indexablePercent: number;
  crawlablePercent: number;
  jsRequiredPages: number;
  bySource: Record<string, number>;
  coreWebVitals: CoreWebVitals;
  health: HealthScoreBreakdown;
  urlsDiscovered: number;
  urlsQueued: number;
  urlsCrawled: number;
  /** Discovered and never fetched. Never negative. */
  notCrawled: number;
  /**
   * crawled / discovered, or null when nothing was discovered.
   *
   * Null rather than 100: a coverage we cannot compute is not a crawl that
   * covered everything, and defaulting it to complete is what let a truncated
   * crawl present itself as whole.
   */
  coveragePercent: number | null;
  failed: number;
  duplicates: number;
  canonicalized: number;
  /** Raw per-source discovery events, when the crawler recorded them. */
  discoveryEvents?: Record<string, number>;
  /** URLs credited to more than one source. */
  multiSourceUrls: number;
  renderedPages: number;
  /**
   * False when the render tier never ran. The UI shows "Not scanned" for this,
   * which is a different claim from "found 0 URLs".
   */
  javascriptDomScanned: boolean;
  discoveredNotCrawled: DiscoveredNotCrawledUrl[];
}

const SEVERITY_WEIGHTS: Record<string, number> = { CRITICAL: 20, HIGH: 8, MEDIUM: 3, LOW: 1 };
const CONFIDENCE_MULTIPLIERS: Record<string, number> = { CONFIRMED: 1, LIKELY: 0.8, ADVISORY: 0.5 };
const MAX_PENALTY_PER_URL = 20;

/**
 * The one computed view of a crawl that every surface reads.
 *
 * The Technical SEO tab and the Pages tab each derived their own numbers from
 * the same raw rows and disagreed in public: Technical SEO read
 * `qualityDiagnostics.robotsBlocked` and showed "Crawlability 100%, 0 blocked"
 * while the Pages tab counted `statusCode >= 400` and showed "1 Blocked", on
 * the same crawl, on the same screen. Two formulas for one number is not a
 * rendering detail; it is two different claims about the customer's site.
 */
export function computeCrawlSummary(params: {
  pages: SummaryPage[];
  issues: SummaryIssue[];
  performance?: Array<{ lcpMs?: number | null; inpMs?: number | null; clsScore?: number | null }>;
  discoveryMetrics?: CrawlDiscoveryMetrics;
}): CrawlSummary {
  const { pages, issues } = params;

  // 0 is what the crawler stores when no origin answered. It is not a real
  // HTTP status, which is the point: nothing that asks `>= 400` can mistake a
  // network failure on our side for a defect on the customer's site.
  const noResponse = (p: SummaryPage) => p.statusCode === null || p.statusCode === undefined || p.statusCode === 0;

  const successful = pages.filter((p) => typeof p.statusCode === 'number' && p.statusCode >= 200 && p.statusCode < 300).length;
  const redirected = pages.filter((p) => typeof p.statusCode === 'number' && p.statusCode >= 300 && p.statusCode < 400).length;
  const blocked = pages.filter((p) => p.blockedSuspected === true).length;
  const unreachable = pages.filter(noResponse).length;
  const errored = pages.filter(
    (p) => typeof p.statusCode === 'number' && p.statusCode >= 400 && !p.blockedSuspected,
  ).length;

  const indexable = pages.filter((p) => p.indexability === 'INDEXABLE').length;
  const nonIndexable = pages.filter((p) => p.indexability === 'NOT_INDEXABLE').length;
  const indexabilityUnknown = pages.filter((p) => !p.indexability || (p.indexability as Indexability) === 'UNKNOWN').length;

  // The crawler's own per-source tally wins outright when it has one.
  //
  // This used to spread the crawler's tally and then add the pages on top,
  // which is correct exactly once. The dashboard calls this function a second
  // time with the stored result of the first call, so every source was counted
  // twice: milquufresh.in's 29-URL sitemap was published as "Sitemap 58" and
  // its 3 link-discovered pages as "Internal Links 6". Deriving the tally from
  // the pages is the fallback for a caller that has no discovery data, not an
  // increment on top of one that does.
  const bySource: Record<string, number> = {};
  if (params.discoveryMetrics?.bySource) {
    Object.assign(bySource, params.discoveryMetrics.bySource);
  } else {
    for (const page of pages) {
      const source = page.discoverySource || 'unknown';
      bySource[source] = (bySource[source] || 0) + 1;
    }
  }

  // Pages we could not fetch are excluded from the score rather than scored as
  // zero: a network failure on our side is not the customer's SEO defect.
  const scorablePages = pages.filter((p) => !p.fetchFailed && !noResponse(p) && !p.blockedSuspected);
  const excludedUrls = new Set(pages.filter((p) => !scorablePages.includes(p)).map((p) => p.url));
  const scorableIssues = issues.filter((i) => !i.affectedUrl || !excludedUrls.has(i.affectedUrl));

  const urlsCrawled = params.discoveryMetrics?.urlsCrawled ?? pages.length;

  // A URL we fetched is one we discovered, so the floor is the crawled count —
  // but only the floor. The old expression was `?? max(pages.length, crawled)`,
  // which applied even when the crawler *had* reported a discovered total, so
  // discovered could never exceed crawled and coverage was always 100%. The
  // clamp now applies to the fallback alone.
  const reportedDiscovered = params.discoveryMetrics?.urlsDiscovered;
  const urlsDiscovered =
    reportedDiscovered === undefined || reportedDiscovered === null
      ? Math.max(pages.length, urlsCrawled)
      : Math.max(reportedDiscovered, urlsCrawled);

  const urlsQueued = params.discoveryMetrics?.urlsQueued ?? urlsDiscovered;
  const failed = params.discoveryMetrics?.failed ?? (errored + unreachable);
  const duplicates = params.discoveryMetrics?.duplicates ?? 0;
  const canonicalized = params.discoveryMetrics?.canonicalized ?? 0;
  const discoveredNotCrawled = params.discoveryMetrics?.discoveredNotCrawled ?? [];

  const notCrawled = Math.max(0, urlsDiscovered - urlsCrawled);
  const coveragePercent = urlsDiscovered > 0 ? Math.round((urlsCrawled / urlsDiscovered) * 100) : null;

  // "0 URLs from the DOM" and "the DOM was never read" are different claims.
  // Only the second is honest when Playwright did not run, so the flag is the
  // render tier's own answer and falls back to whether any page was rendered.
  const renderedPages = params.discoveryMetrics?.renderedPages ?? pages.filter((p) => p.jsRequired === true).length;
  const javascriptDomScanned = params.discoveryMetrics?.renderingEnabled ?? renderedPages > 0;

  return {
    pagesCrawled: pages.length,
    successful,
    redirected,
    errored,
    blocked,
    unreachable,
    indexable,
    nonIndexable,
    indexabilityUnknown,
    indexablePercent: pages.length ? Math.round((indexable / pages.length) * 100) : 0,
    crawlablePercent: pages.length ? Math.round(((pages.length - errored - blocked - unreachable) / pages.length) * 100) : 0,
    jsRequiredPages: pages.filter((p) => p.jsRequired === true).length,
    bySource,
    coreWebVitals: summariseCoreWebVitals(params.performance || []),
    health: computeHealth(scorableIssues, scorablePages.length, pages.length - scorablePages.length),
    urlsDiscovered,
    urlsQueued,
    urlsCrawled,
    notCrawled,
    coveragePercent,
    failed,
    duplicates,
    canonicalized,
    discoveryEvents: params.discoveryMetrics?.discoveryEvents,
    multiSourceUrls: params.discoveryMetrics?.multiSourceUrls ?? 0,
    renderedPages,
    javascriptDomScanned,
    discoveredNotCrawled,
  };
}

/**
 * Core Web Vitals, with "No data" as a first-class answer.
 *
 * The previous rule was `avgLcpMs == null ? "Good" : ...`, so a site with no
 * measurements at all was awarded a green badge over three empty dashes. A
 * metric we never collected is not a metric the site passed.
 */
export function summariseCoreWebVitals(rows: Array<{ lcpMs?: number | null; inpMs?: number | null; clsScore?: number | null }>): CoreWebVitals {
  const measured = rows.filter((r) => r.lcpMs != null || r.inpMs != null || r.clsScore != null);
  const average = (pick: (r: (typeof rows)[number]) => number | null | undefined): number | null => {
    const values = measured.map(pick).filter((v): v is number => typeof v === 'number');
    return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
  };

  const lcpMs = average((r) => r.lcpMs);
  const inpMs = average((r) => r.inpMs);
  const cls = average((r) => r.clsScore);

  if (lcpMs === null && inpMs === null && cls === null) {
    return { lcpMs: null, inpMs: null, cls: null, status: 'No data', pagesMeasured: 0 };
  }

  const poor = (lcpMs != null && lcpMs > 4000) || (inpMs != null && inpMs > 500) || (cls != null && cls > 0.25);
  const needsWork = (lcpMs != null && lcpMs > 2500) || (inpMs != null && inpMs > 200) || (cls != null && cls > 0.1);

  return {
    lcpMs,
    inpMs,
    cls,
    status: poor ? 'Poor' : needsWork ? 'Needs Work' : 'Good',
    pagesMeasured: measured.length,
  };
}

/**
 * Health score, with the arithmetic shown.
 *
 * `penalties` is what the UI renders as "what subtracted what": a score of 0
 * with no explanation is not actionable, and on the audit that prompted this
 * rebuild it was not even true.
 */
export function computeHealth(issues: SummaryIssue[], pagesScored: number, pagesExcluded: number): HealthScoreBreakdown {
  const pages = Math.max(1, pagesScored);

  // Deduplicate, then cap per URL, so one badly broken page cannot sink a site.
  const seen = new Set<string>();
  const perUrl = new Map<string, number>();
  const bySeverity = new Map<string, { count: number; penalty: number }>();

  for (const issue of issues) {
    const key = `${issue.affectedUrl || ''}::${issue.issueType}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const weight = SEVERITY_WEIGHTS[issue.severity] ?? 1;
    const multiplier = CONFIDENCE_MULTIPLIERS[issue.confidence || 'CONFIRMED'] ?? 1;
    const penalty = weight * multiplier;

    const urlKey = issue.affectedUrl || '(site)';
    const spent = perUrl.get(urlKey) || 0;
    const allowed = Math.max(0, Math.min(penalty, MAX_PENALTY_PER_URL - spent));
    perUrl.set(urlKey, spent + allowed);

    const bucket = bySeverity.get(issue.severity) || { count: 0, penalty: 0 };
    bucket.count += 1;
    bucket.penalty += allowed;
    bySeverity.set(issue.severity, bucket);
  }

  const totalPenalty = [...perUrl.values()].reduce((a, b) => a + b, 0);
  const normalised = totalPenalty / pages;
  const score = Math.max(0, Math.min(100, Math.round(100 - normalised)));

  return {
    score,
    pagesScored,
    pagesExcluded,
    penalties: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']
      .map((severity) => ({ severity, ...(bySeverity.get(severity) || { count: 0, penalty: 0 }) }))
      .map((p) => ({ severity: p.severity, count: p.count, penalty: Math.round(p.penalty * 10) / 10 })),
    totalPenalty: Math.round(totalPenalty * 10) / 10,
    note:
      pagesExcluded > 0
        ? `${pagesExcluded} page(s) we could not fetch were excluded from the score, so a network failure is not counted as an SEO defect.`
        : 'Every crawled page was scored.',
  };
}
