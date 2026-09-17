"use client";

import React, { useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Compass,
  ExternalLink,
  Filter,
  Globe,
  Layers,
  Link as LinkIcon,
  MoreHorizontal,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { cn, formatRelativeTime } from "@/lib/utils";
import type { CrawlIssue, CrawlJob, CrawlPage } from "@/lib/api-client";
import { DonutChart } from "../donut-chart";
import { computeCrawlSummary, type CrawlSummary } from "@/lib/crawl-summary";
import { classifyPageType, toDisplayPageType, DISPLAY_PAGE_TYPES, DisplayPageType } from "@/lib/page-type";

interface PagesTabProps {
  crawl: CrawlJob | null;
  pages: CrawlPage[];
  issues: CrawlIssue[];
  historyRuns?: { pagesCrawled: number; issuesFound: number }[];
  onOpenPageDetails?: (page: CrawlPage) => void;
}

/**
 * The parts of a crawl's `qualityDiagnostics` this tab reads.
 *
 * `inventory` is the crawler's per-URL reconciliation — one row per unique
 * discovered URL — and is preferred over anything derived from the page list,
 * because a page row only exists for a URL that was successfully fetched.
 */
interface CrawlInventoryMetrics {
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
  discoveredNotCrawled: Array<{ url: string; reason: string }>;
}

interface CrawlQualityDiagnostics {
  urlsDiscovered?: number;
  urlsEligible?: number;
  pagesCrawled?: number;
  urlsSkipped?: number;
  robotsBlocked?: number;
  crawlStatus?: string;
  inventory?: CrawlInventoryMetrics | null;
  summary?: Partial<CrawlSummary> & { discoveryEvents?: Record<string, number> };
}

export function PagesTab({
  crawl,
  pages,
  issues,
  historyRuns = [],
  onOpenPageDetails,
}: PagesTabProps) {
  // Table filters & pagination
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState("ALL");
  const [selectedStatus, setSelectedStatus] = useState("ALL");
  const [selectedIndexability, setSelectedIndexability] = useState("ALL");
  const [sortBy, setSortBy] = useState<"seoScore" | "wordCount" | "issues" | "status">("seoScore");
  const [selectedPageIds, setSelectedPageIds] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [showColumnsMenu, setShowColumnsMenu] = useState(false);
  const [showNotCrawled, setShowNotCrawled] = useState(false);
  const [notCrawledReasonFilter, setNotCrawledReasonFilter] = useState("ALL");

  // Column visibility toggles
  const [visibleColumns, setVisibleColumns] = useState({
    type: true,
    status: true,
    indexability: true,
    wordCount: true,
    seoScore: true,
    issues: true,
    lastCrawled: true,
  });

  // Map issues count per URL
  const issuesPerUrl = useMemo(() => {
    const map = new Map<string, number>();
    for (const issue of issues) {
      if (issue.affectedUrl) {
        map.set(issue.affectedUrl, (map.get(issue.affectedUrl) || 0) + 1);
      }
    }
    return map;
  }, [issues]);

  // Derive Deterministic SEO Score per Page (0-100)
  const getPageSeoScore = (page: CrawlPage) => {
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

    const issueCount = issuesPerUrl.get(page.url) || 0;
    score -= Math.min(issueCount * 4, 25);

    return Math.max(15, Math.min(100, score));
  };

  // 1. Total Pages Crawled card metrics
  const lastRun = historyRuns.length >= 2 ? historyRuns[historyRuns.length - 2] : null;
  const currentRun = historyRuns.length >= 1 ? historyRuns[historyRuns.length - 1] : null;
  const pagesDelta =
    lastRun && currentRun
      ? currentRun.pagesCrawled - lastRun.pagesCrawled
      : null;

  // Every count on this tab comes from the one shared summary, so the Pages
  // tab and the Technical SEO tab can no longer disagree about the same crawl.
  // The crawler's reconciliation rows, when the crawl recorded them.
  const diagnostics = crawl?.qualityDiagnostics as CrawlQualityDiagnostics | undefined;
  const inventory = diagnostics?.inventory;
  const storedSummary = diagnostics?.summary;

  const summary = useMemo(
    () =>
      computeCrawlSummary({
        pages: pages.map((p) => ({
          url: p.url,
          statusCode: p.statusCode ?? null,
          indexability: p.indexability ?? null,
          blockedSuspected: p.blockedSuspected ?? null,
          jsRequired: p.jsRequired ?? null,
          discoverySource: p.discoverySource ?? null,
          fetchFailed: p.statusCode == null || p.statusCode === 0,
        })),
        issues: issues.map((i) => ({
          issueType: i.issueType,
          severity: i.severity,
          confidence: (i as { confidence?: string }).confidence ?? null,
          affectedUrl: i.affectedUrl ?? null,
        })),
        performance: pages.map((p) => ({
          lcpMs: p.performance?.lcpMs ?? null,
          inpMs: p.performance?.inpMs ?? null,
          clsScore: p.performance?.clsScore ?? null,
        })),
        // The crawler's own reconciliation is preferred over anything derived
        // here. `inventory` is one row per unique discovered URL, so these are
        // counts of rows rather than of pages, and the coverage denominator is
        // the URLs the crawl found rather than the pages it managed to fetch.
        discoveryMetrics: {
          urlsDiscovered: inventory?.urlsDiscovered ?? crawl?.qualityDiagnostics?.urlsDiscovered ?? storedSummary?.urlsDiscovered,
          urlsQueued: inventory?.urlsQueued ?? crawl?.qualityDiagnostics?.urlsEligible ?? storedSummary?.urlsQueued,
          urlsCrawled: inventory?.urlsCrawled ?? crawl?.qualityDiagnostics?.pagesCrawled ?? storedSummary?.urlsCrawled,
          failed: inventory?.failed ?? storedSummary?.failed,
          duplicates: inventory?.duplicates ?? crawl?.qualityDiagnostics?.urlsSkipped ?? storedSummary?.duplicates,
          canonicalized: inventory?.canonicalized ?? storedSummary?.canonicalized,
          bySource: inventory?.bySource ?? storedSummary?.bySource,
          discoveryEvents: storedSummary?.discoveryEvents,
          multiSourceUrls: inventory?.multiSourceUrls ?? storedSummary?.multiSourceUrls,
          renderedPages: inventory?.renderedPages ?? storedSummary?.renderedPages,
          renderingEnabled: storedSummary?.javascriptDomScanned,
          discoveredNotCrawled: inventory?.discoveredNotCrawled ?? storedSummary?.discoveredNotCrawled,
        },
      }),
    [pages, issues, crawl, inventory, storedSummary]
  );

  const successfulCount = summary.successful;
  const redirectedCount = summary.redirected;
  const erroredCount = summary.errored;
  const blockedCount = summary.blocked;
  const unreachableCount = summary.unreachable;

  const indexableCount = summary.indexable;
  const nonIndexableCount = summary.nonIndexable;
  const unknownIndexabilityCount = summary.indexabilityUnknown;
  const indexablePct = summary.indexablePercent;

  // Straight from the summary, which already applies the one rule that matters:
  // a URL we fetched is a URL we discovered, so crawled is the floor for
  // discovered — but only the floor. Clamping discovered *up* to the page count
  // here is what forced the denominator to equal the numerator and published
  // "100% (32/32)" for a crawl that had found more URLs than it fetched.
  const urlsDiscoveredCount = summary.urlsDiscovered;
  const urlsCrawledCount = summary.urlsCrawled;
  const notCrawledCount = summary.notCrawled;
  const crawlCoveragePct = summary.coveragePercent;
  // A crawl that did not reach everything it found says so, rather than
  // rounding itself up to complete.
  const crawlIsPartial = crawlCoveragePct !== null && crawlCoveragePct < 100;

  // Page Type classification across all 10 types
  const getPageType = (page: CrawlPage): DisplayPageType => {
    if (page.pageType) {
      const display = toDisplayPageType(page.pageType);
      if (display !== "Other") return display;
    }
    const derived = classifyPageType({ url: page.url, title: page.title, h1: page.h1 });
    return toDisplayPageType(derived);
  };

  // 3. Page Type Distribution Donut
  const pageTypeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const type of DISPLAY_PAGE_TYPES) {
      counts[type] = 0;
    }
    for (const page of pages) {
      const type = getPageType(page);
      counts[type] = (counts[type] || 0) + 1;
    }

    const colorMap: Record<string, string> = {
      "Homepage": "#06b6d4",
      "Product page": "#3b82f6",
      "Category page": "#10b981",
      "Blog/article": "#8b5cf6",
      "Service page": "#f59e0b",
      "Landing page": "#ec4899",
      "Contact page": "#14b8a6",
      "About page": "#6366f1",
      "Static page": "#64748b",
      "Other": "#94a3b8",
    };

    const res = DISPLAY_PAGE_TYPES
      .filter((type) => (counts[type] || 0) > 0)
      .map((type) => ({
        label: type,
        value: counts[type],
        color: colorMap[type] || "#3b82f6",
      }));

    return res.length > 0 ? res : [{ label: "All Pages", value: pages.length, color: "#3b82f6" }];
  }, [pages]);

  // 4. Status Code Distribution Donut
  const statusCodeCounts = useMemo(() => {
    const s2xx = pages.filter((p) => p.statusCode >= 200 && p.statusCode < 300).length;
    const s3xx = pages.filter((p) => p.statusCode >= 300 && p.statusCode < 400).length;
    const s4xx = pages.filter((p) => p.statusCode >= 400 && p.statusCode < 500).length;
    const s5xx = pages.filter((p) => p.statusCode >= 500).length;

    return [
      { label: "200 OK", value: s2xx, color: "#10b981" },
      { label: "3XX Redirect", value: s3xx, color: "#f59e0b" },
      { label: "4XX Error", value: s4xx, color: "#ef4444" },
      { label: "5XX Error", value: s5xx, color: "#94a3b8" },
    ];
  }, [pages]);

  // Crawl Source Breakdown: unique URLs per source, as a share of the URLs that
  // exist.
  //
  // Sources overlap — a URL in the sitemap and in a nav menu is credited to
  // both — so their counts must not be summed. The old denominator was exactly
  // that sum, which made each bar a share of a total larger than the site and
  // let the figures drift from the URL count above them.
  const discoverySourceList = useMemo(() => {
    const raw = summary.bySource || {};
    const scanned = summary.javascriptDomScanned;
    const sources = [
      { key: "sitemap", label: "Sitemap", count: raw.sitemap || 0, color: "#3b82f6", scanned: true },
      { key: "homepage", label: "Homepage", count: raw.homepage || 0, color: "#06b6d4", scanned: true },
      {
        key: "internal_links",
        label: "Internal links",
        count: (raw.internal_links || 0) + (raw.internal_link || 0) + (raw.link || 0),
        color: "#10b981",
        scanned: true,
      },
      {
        key: "javascript_dom",
        label: "JavaScript DOM",
        count: raw.javascript_dom || 0,
        color: "#8b5cf6",
        // "0" claims we rendered and found nothing. When the render tier never
        // ran we have no such evidence, and the card says so instead.
        scanned,
      },
      { key: "canonical", label: "Canonical", count: raw.canonical || 0, color: "#f59e0b", scanned: true },
      { key: "redirect", label: "Redirects", count: raw.redirect || 0, color: "var(--color-series-7)", scanned: true },
      {
        key: "other",
        label: "Other",
        count: (raw.other || 0) + (raw.unknown || 0) + (raw.seed || 0) + (raw.robots || 0) + (raw.bundle || 0),
        color: "#64748b",
        scanned: true,
      },
    ];
    const denominator = summary.urlsDiscovered || 1;
    return sources.map((s) => ({
      ...s,
      percentage: Math.min(100, Math.round((s.count / denominator) * 100)),
    }));
  }, [summary.bySource, summary.urlsDiscovered, summary.javascriptDomScanned]);

  /**
   * The URLs this crawl discovered and did not fetch, each with the reason the
   * crawler recorded for it.
   *
   * Only real rows. The previous version, when it had no per-URL data, invented
   * summary lines out of whatever counters were to hand — "(5 duplicate URL
   * variations skipped)" as a URL, robots and crawl-limit lines assembled from
   * unrelated totals — so a reader could not tell a measured reason from a
   * plausible-looking one. An empty list is the honest answer when the crawl
   * did not record them.
   */
  const discoveredNotCrawledItems = useMemo(
    () => summary.discoveredNotCrawled ?? [],
    [summary.discoveredNotCrawled]
  );

  /** Reason -> count, straight from the crawler's inventory. */
  const notCrawledReasonCounts = useMemo(() => {
    if (inventory?.notCrawledReasons) return inventory.notCrawledReasons;
    const counts: Record<string, number> = {};
    for (const item of discoveredNotCrawledItems) {
      counts[item.reason] = (counts[item.reason] || 0) + 1;
    }
    return counts;
  }, [inventory, discoveredNotCrawledItems]);

  /** One pill per reason the crawl recorded, plus "ALL". */
  const notCrawledReasonPills = useMemo(() => {
    const entries = Object.entries(notCrawledReasonCounts).sort((a, b) => b[1] - a[1]);
    return [
      { reason: "ALL", count: notCrawledCount || null },
      ...entries.map(([reason, count]) => ({ reason, count })),
    ];
  }, [notCrawledReasonCounts, notCrawledCount]);

  const filteredNotCrawled = useMemo(() => {
    if (notCrawledReasonFilter === "ALL") return discoveredNotCrawledItems;
    return discoveredNotCrawledItems.filter(
      (item) => item.reason.toLowerCase() === notCrawledReasonFilter.toLowerCase()
    );
  }, [discoveredNotCrawledItems, notCrawledReasonFilter]);

  // 5. Filtered and Sorted Pages List
  const filteredPages = useMemo(() => {
    let result = [...pages];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (p) => p.url.toLowerCase().includes(q) || (p.title || "").toLowerCase().includes(q)
      );
    }

    if (selectedType !== "ALL") {
      result = result.filter((p) => getPageType(p) === selectedType);
    }

    if (selectedStatus !== "ALL") {
      if (selectedStatus === "200") result = result.filter((p) => p.statusCode >= 200 && p.statusCode < 300);
      else if (selectedStatus === "3xx") result = result.filter((p) => p.statusCode >= 300 && p.statusCode < 400);
      else if (selectedStatus === "4xx") result = result.filter((p) => p.statusCode >= 400 && p.statusCode < 500);
      else if (selectedStatus === "5xx") result = result.filter((p) => p.statusCode >= 500);
    }

    if (selectedIndexability !== "ALL") {
      result = result.filter((p) => (p.indexability ?? "UNKNOWN") === selectedIndexability);
    }

    // Sorting
    result.sort((a, b) => {
      if (sortBy === "seoScore") {
        return getPageSeoScore(b) - getPageSeoScore(a);
      }
      if (sortBy === "wordCount") {
        return (b.wordCount || 0) - (a.wordCount || 0);
      }
      if (sortBy === "issues") {
        return (issuesPerUrl.get(b.url) || 0) - (issuesPerUrl.get(a.url) || 0);
      }
      if (sortBy === "status") {
        return a.statusCode - b.statusCode;
      }
      return 0;
    });

    return result;
  }, [pages, searchQuery, selectedType, selectedStatus, selectedIndexability, sortBy, issuesPerUrl]);

  // Pagination calculation
  const totalPagesCount = Math.ceil(filteredPages.length / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedPages = filteredPages.slice(startIndex, startIndex + itemsPerPage);

  const toggleSelectAll = () => {
    if (selectedPageIds.size === paginatedPages.length) {
      setSelectedPageIds(new Set());
    } else {
      setSelectedPageIds(new Set(paginatedPages.map((p) => p.id)));
    }
  };

  const toggleSelectPage = (id: string) => {
    const next = new Set(selectedPageIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedPageIds(next);
  };

  // Helper to format page type badge
  const formatPageType = (page: CrawlPage) => getPageType(page);

  return (
    <div className="space-y-5">
      {/* ======================================================== */}
      {/* TOP ROW: 4 KPI CARDS                                     */}
      {/* ======================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* 1. Total Pages Crawled (Strictly HTTP 2xx) */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
              <Globe size={14} className="text-blue-600" />
              <span>Total Pages Crawled</span>
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                {successfulCount.toLocaleString()}
              </span>
              {pagesDelta !== null && pagesDelta !== 0 && (
                <span
                  className={cn(
                    "text-xs font-semibold flex items-center gap-0.5",
                    pagesDelta >= 0 ? "text-emerald-600" : "text-rose-600"
                  )}
                >
                  {pagesDelta >= 0 ? "↑ +" : "↓ "}
                  {pagesDelta} vs last crawl
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              HTTP 2xx pages successfully fetched.
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-600 dark:text-slate-400">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <b className="text-slate-900 dark:text-white">{successfulCount}</b> OK
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-error-500" />
              <b className="text-brand-950">{erroredCount}</b> Errored
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-warning-500" />
              <b className="text-brand-950">{redirectedCount}</b> Redirected
            </span>
            {blockedCount > 0 && (
              <span className="flex items-center gap-1" title="Origin challenge or suspicion.">
                <span className="h-2 w-2 rounded-full bg-warning-600" />
                <b className="text-brand-950">{blockedCount}</b> Blocked
              </span>
            )}
            {unreachableCount > 0 && (
              <span className="flex items-center gap-1" title="Unreachable origin.">
                <span className="h-2 w-2 rounded-full bg-brand-400" />
                <b className="text-brand-950">{unreachableCount}</b> Unreachable
              </span>
            )}
          </div>
        </div>

        {/* 2. Total URLs Discovered */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
              <Compass size={14} className="text-indigo-600" />
              <span>Total URLs Discovered</span>
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                {urlsDiscoveredCount.toLocaleString()}
              </span>
              <span className="rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400 px-2 py-0.5 text-xs font-bold">
                Multi-source
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Identified across sitemaps, DOM & links.
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-400">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <b className="text-slate-900 dark:text-white">{urlsCrawledCount}</b> Crawled
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              <b className="text-slate-900 dark:text-white">{notCrawledCount}</b> Not Crawled
            </span>
          </div>
        </div>

        {/* 3. Indexable Pages */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
              <Layers size={14} className="text-emerald-600" />
              <span>Indexable Pages</span>
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                {indexableCount.toLocaleString()}
              </span>
              <span className="rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 px-2 py-0.5 text-xs font-bold">
                {indexablePct}%
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Pages that can appear in search results.
            </p>
          </div>

          <div className="mt-4">
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800 flex">
              <div
                className="h-full bg-success-500 transition-all duration-500"
                style={{ width: `${indexablePct}%` }}
              />
              <div
                className="h-full bg-warning-400 transition-all duration-500"
                style={{ width: `${pages.length ? (nonIndexableCount / pages.length) * 100 : 0}%` }}
              />
              <div
                className="h-full bg-brand-300 transition-all duration-500"
                style={{ width: `${pages.length ? (unknownIndexabilityCount / pages.length) * 100 : 0}%` }}
              />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-brand-500">
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-success-500" />
                <span>{indexableCount} Indexable</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-warning-400" />
                <span>{nonIndexableCount} Non-indexable</span>
              </span>
              {unknownIndexabilityCount > 0 && (
                <span className="flex items-center gap-1" title="We could not determine indexability for these pages.">
                  <span className="h-1.5 w-1.5 rounded-full bg-brand-400" />
                  <span>{unknownIndexabilityCount} Unknown</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 4. Crawl Coverage */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
              <LinkIcon size={14} className="text-purple-600" />
              <span>Crawl Coverage</span>
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                {/* Never a number we cannot derive. "100%" was the old default
                    for a crawl with nothing to divide by, which is the one
                    reading the data can never support. */}
                {crawlCoveragePct === null ? "Unknown" : `${crawlCoveragePct}%`}
              </span>
              <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                crawlIsPartial
                  ? "bg-warning-50 text-warning-700"
                  : "bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400"
              }`}>
                {crawlCoveragePct === null ? "No data" : `${urlsCrawledCount}/${urlsDiscoveredCount}`}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {crawlCoveragePct === null
                ? "No URLs were discovered, so coverage cannot be measured."
                : crawlIsPartial
                  ? `Partial crawl — ${notCrawledCount.toLocaleString()} discovered ${notCrawledCount === 1 ? "URL was" : "URLs were"} not fetched.`
                  : "Every discovered URL was fetched."}
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-400">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-blue-500" />
              <b className="text-slate-900 dark:text-white">{summary.duplicates || 0}</b> Deduplicated
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-slate-400" />
              <b className="text-slate-900 dark:text-white">{summary.canonicalized || 0}</b> Canonicalized
            </span>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* MIDDLE ROW: 3 ANALYTICS CARDS                            */}
      {/* ======================================================== */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {/* 1. Page Type Distribution (10 Types) */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between overflow-hidden">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Page Type Distribution
              </h3>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                10 Types
              </span>
            </div>
            <div className="flex items-center justify-center py-2">
              <DonutChart
                data={pageTypeCounts}
                centerValue={pages.length}
                centerLabel="Pages"
                size={110}
                thickness={15}
              />
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
            {pageTypeCounts.slice(0, 5).map((item) => (
              <span key={item.label} className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-slate-600 dark:text-slate-400">{item.label}:</span>
                <b className="text-slate-900 dark:text-white">{item.value}</b>
              </span>
            ))}
            {pageTypeCounts.length > 5 && (
              <span className="text-slate-400">+{pageTypeCounts.length - 5} more</span>
            )}
          </div>
        </div>

        {/* 2. Status Code Distribution */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between overflow-hidden">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-2">
              Status Code Distribution
            </h3>
            <div className="flex items-center justify-center py-2">
              <DonutChart
                data={statusCodeCounts}
                centerValue={pages.length}
                centerLabel="Pages"
                size={110}
                thickness={15}
              />
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
            {statusCodeCounts.map((item) => (
              <span key={item.label} className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-slate-600 dark:text-slate-400">{item.label}:</span>
                <b className="text-slate-900 dark:text-white">{item.value}</b>
              </span>
            ))}
          </div>
        </div>

        {/* 3. Crawl-Source Breakdown */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between overflow-hidden">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Crawl-Source Breakdown
              </h3>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                {summary.multiSourceUrls > 0
                  ? `${summary.multiSourceUrls} multi-source`
                  : "Unique URLs"}
              </span>
            </div>
            <div className="space-y-2 py-1">
              {discoverySourceList.map((src) => (
                <div key={src.key} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-300">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: src.color }} />
                      {src.label}
                    </span>
                    {src.scanned ? (
                      <span className="text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                        <b className="text-slate-900 dark:text-white">{src.count}</b> ({src.percentage}%)
                      </span>
                    ) : (
                      <span className="text-[11px] italic text-brand-400">Not scanned</span>
                    )}
                  </div>
                  <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    {src.scanned && (
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${src.percentage}%`, backgroundColor: src.color }}
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* SECTION: URLs DISCOVERED BUT NOT CRAWLED                  */}
      {/* ======================================================== */}
      <div className="rounded-xl border border-slate-200/80 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
        <button
          type="button"
          onClick={() => setShowNotCrawled(!showNotCrawled)}
          className="w-full p-4 flex items-center justify-between hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors text-left"
        >
          <div className="flex items-center gap-2.5">
            <Compass size={16} className="text-amber-600" />
            <div>
              <span className="text-sm font-bold text-slate-900 dark:text-white">
                URLs Discovered But Not Crawled
              </span>
              <span className="ml-2 rounded-full bg-amber-50 text-amber-700 border border-amber-200/60 dark:bg-amber-950/40 dark:text-amber-400 px-2 py-0.5 text-xs font-semibold">
                {notCrawledCount.toLocaleString()} URLs
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
            <span>{showNotCrawled ? "Hide reasons" : "View reasons"}</span>
            {showNotCrawled ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </div>
        </button>

        {showNotCrawled && (
          <div className="p-4 pt-0 border-t border-slate-100 dark:border-slate-800 space-y-3">
            {/* Reason Filter Pills */}
            <div className="flex flex-wrap items-center gap-1.5 pt-3">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 mr-1">
                Filter Reason:
              </span>
              {/* Derived from the reasons the crawler actually recorded, with
                  their counts. The previous list was a fixed set of labels
                  ("external", "noindex", "blocked") that the crawler never
                  writes, so most pills filtered to nothing and the vocabulary
                  on screen bore no relation to the data behind it. */}
              {notCrawledReasonPills.map(({ reason, count }) => (
                <button
                  key={reason}
                  type="button"
                  onClick={() => setNotCrawledReasonFilter(reason)}
                  className={cn(
                    "px-2.5 py-1 rounded-full text-xs font-medium transition-colors",
                    notCrawledReasonFilter === reason
                      ? "bg-amber-600 text-white shadow-xs"
                      : "bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                  )}
                >
                  {reason === "ALL" ? "All" : reason.replace(/_/g, " ")}
                  {count !== null && <span className="ml-1 opacity-70">{count}</span>}
                </button>
              ))}
            </div>

            {/* List / Table of Not Crawled URLs */}
            {filteredNotCrawled.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400">
                {notCrawledCount === 0
                  ? "Every discovered URL was fetched."
                  : discoveredNotCrawledItems.length === 0
                    ? "This crawl did not record per-URL reasons."
                    : "No URLs match the selected filter."}
              </div>
            ) : (
              <div className="max-h-60 overflow-y-auto border border-slate-100 dark:border-slate-800 rounded-lg">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    <tr>
                      <th className="p-2.5 pl-3">DISCOVERED URL</th>
                      <th className="p-2.5">SOURCE</th>
                      <th className="p-2.5 pr-3 text-right">EXCLUSION REASON</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredNotCrawled.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
                        <td className="p-2.5 pl-3 font-mono text-[11px] text-slate-700 dark:text-slate-300 truncate max-w-[400px]">
                          {item.url}
                        </td>
                        <td className="p-2.5 text-[11px] text-brand-500">
                          {/* Every source that found it, so one URL in the
                              sitemap and a nav menu reads as one row with two
                              sources rather than as two URLs. */}
                          {item.sources && item.sources.length > 0
                            ? item.sources.map((source) => source.replace(/_/g, " ")).join(" + ")
                            : "—"}
                        </td>
                        <td className="p-2.5 pr-3 text-right">
                          <span className="inline-block rounded-full bg-amber-50 border border-amber-200 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                            {item.reason}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* BOTTOM SECTION: PAGES TABLE                              */}
      {/* ======================================================== */}
      <div className="rounded-xl border border-slate-200/80 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
        {/* Filter Toolbar */}
        <div className="p-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0 pr-14 sm:pr-16 lg:pr-0">
            {/* Search Input */}
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search pages or URLs..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="h-8 w-48 sm:w-60 rounded-lg border border-slate-200 bg-white pl-8 pr-3 text-xs placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Page Type Filter (10 Types) */}
            <select
              value={selectedType}
              onChange={(e) => {
                setSelectedType(e.target.value);
                setCurrentPage(1);
              }}
              className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
            >
              <option value="ALL">All Page Types</option>
              {DISPLAY_PAGE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>

            {/* Status Codes Filter */}
            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setCurrentPage(1);
              }}
              className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
            >
              <option value="ALL">All Status Codes</option>
              <option value="200">200 OK</option>
              <option value="3xx">3XX Redirect</option>
              <option value="4xx">4XX Error</option>
              <option value="5xx">5XX Error</option>
            </select>

            {/* Indexability Filter */}
            <select
              value={selectedIndexability}
              onChange={(e) => {
                setSelectedIndexability(e.target.value);
                setCurrentPage(1);
              }}
              className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
            >
              <option value="ALL">All Indexability</option>
              <option value="INDEXABLE">Indexable</option>
              <option value="NOT_INDEXABLE">Non-indexable</option>
              <option value="UNKNOWN">Unknown</option>
            </select>

            {/* Columns Dropdown Toggle */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowColumnsMenu(!showColumnsMenu)}
                className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 inline-flex items-center gap-1.5"
              >
                <SlidersHorizontal size={12} />
                <span>Columns</span>
                <ChevronDown size={12} />
              </button>

              {showColumnsMenu && (
                <div className="absolute left-0 sm:left-auto sm:right-0 top-9 w-44 rounded-lg border border-slate-200 bg-white p-2 shadow-lg dark:border-slate-700 dark:bg-slate-800 z-20 space-y-1 text-xs">
                  {Object.entries(visibleColumns).map(([col, isVisible]) => (
                    <label key={col} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isVisible}
                        onChange={() => setVisibleColumns((prev) => ({ ...prev, [col]: !isVisible }))}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="capitalize">{col.replace(/([A-Z])/g, " $1")}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Sort By Dropdown */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
            >
              <option value="seoScore">Sort by: SEO Score</option>
              <option value="wordCount">Sort by: Word Count</option>
              <option value="issues">Sort by: Issues</option>
              <option value="status">Sort by: Status</option>
            </select>
          </div>
        </div>

        {/* Table Content */}
        {filteredPages.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">
            No crawled pages match the selected criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-[11px] font-semibold uppercase tracking-wider text-slate-400 bg-slate-50/50 dark:bg-slate-900/50">
                  <th className="p-3 pl-4 w-8">
                    <input
                      type="checkbox"
                      checked={selectedPageIds.size === paginatedPages.length && paginatedPages.length > 0}
                      onChange={toggleSelectAll}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                  </th>
                  <th className="p-3">URL / PAGE TITLE</th>
                  {visibleColumns.type && <th className="p-3">TYPE</th>}
                  {visibleColumns.status && <th className="p-3">STATUS</th>}
                  {visibleColumns.indexability && <th className="p-3">INDEXABILITY</th>}
                  {visibleColumns.wordCount && <th className="p-3 text-right">WORD COUNT</th>}
                  {visibleColumns.seoScore && <th className="p-3 text-center">SEO SCORE</th>}
                  {visibleColumns.issues && <th className="p-3 text-center">ISSUES</th>}
                  {visibleColumns.lastCrawled && <th className="p-3">LAST CRAWLED</th>}
                  <th className="p-3 pr-4 text-right">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {paginatedPages.map((page) => {
                  const isSelected = selectedPageIds.has(page.id);
                  const seoScore = getPageSeoScore(page);
                  const issueCount = issuesPerUrl.get(page.url) || 0;
                  const indexability = page.indexability ?? "UNKNOWN";
                  const pageType = formatPageType(page);

                  return (
                    <tr
                      key={page.id}
                      className={cn(
                        "hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors",
                        isSelected && "bg-blue-50/40 dark:bg-blue-950/20"
                      )}
                    >
                      <td className="p-3 pl-4">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectPage(page.id)}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                      </td>

                      {/* URL / Title */}
                      <td className="p-3 max-w-[280px]">
                        <div className="font-semibold text-slate-900 dark:text-white truncate">
                          {/* "Untitled Document" is only honest when we read
                              the page and it had no title. When we never got a
                              response, say that instead. */}
                          {page.title || (page.statusCode == null || page.statusCode === 0 ? "Not retrieved" : "Untitled Document")}
                        </div>
                        <a
                          href={page.url}
                          target="_blank"
                          rel="noreferrer"
                          className="font-mono text-[11px] text-blue-600 dark:text-blue-400 hover:underline truncate block mt-0.5"
                        >
                          {page.url}
                        </a>
                        <div className="mt-1 flex flex-wrap items-center gap-1">
                          {page.jsRequired && (
                            <span
                              className="rounded border bg-accent-50 px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-accent-700"
                              title="This page's content only exists after JavaScript runs. Most AI answer engines do not execute it."
                            >
                              JS
                            </span>
                          )}
                          {page.discoverySource && (
                            <span
                              className="rounded border bg-brand-50 px-1.5 py-px text-[9px] font-medium uppercase tracking-wide text-brand-600"
                              title={`How this URL was discovered: ${page.discoverySource}`}
                            >
                              {page.discoverySource}
                            </span>
                          )}
                          {page.blockedSuspected && (
                            <span
                              className="rounded border bg-warning-50 px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-warning-700"
                              title="The origin answered with a challenge a browser would not get. We could not assess this page."
                            >
                              Blocked?
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Type */}
                      {visibleColumns.type && (
                        <td className="p-3">
                          <span className="rounded-md bg-slate-100 text-slate-800 dark:bg-slate-100 dark:text-slate-300 px-2 py-0.5 text-[11px] font-medium">
                            {pageType}
                          </span>
                        </td>
                      )}

                      {/* Status */}
                      {visibleColumns.status && (
                        <td className="p-3">
                          <span
                            className={cn(
                              "rounded-full border px-2 py-0.5 text-[10px] font-bold",
                              page.statusCode == null || page.statusCode === 0
                                ? "bg-brand-100 text-brand-600"
                                : page.statusCode >= 200 && page.statusCode < 300
                                ? "bg-success-50 text-success-700"
                                : page.statusCode >= 300 && page.statusCode < 400
                                ? "bg-warning-50 text-warning-700"
                                : "bg-error-50 text-error-700"
                            )}
                            title={
                              page.statusChain && page.statusChain.length > 1
                                ? page.statusChain.map((h) => `${h.status} ${h.url}`).join("\n")
                                : undefined
                            }
                          >
                            {/* No status means we never got a response, which
                                is our failure to report, not the site's. */}
                            {page.statusCode == null || page.statusCode === 0
                              ? "Unreachable"
                              : `${page.statusCode}${page.statusCode >= 200 && page.statusCode < 300 ? " OK" : page.statusCode >= 300 && page.statusCode < 400 ? " Redirect" : ""}`}
                          </span>
                        </td>
                      )}

                      {/* Indexability */}
                      {visibleColumns.indexability && (
                        <td className="p-3">
                          <span
                            className={cn(
                              "rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                              indexability === "INDEXABLE"
                                ? "bg-success-50 text-success-700"
                                : indexability === "NOT_INDEXABLE"
                                ? "bg-warning-50 text-warning-700"
                                : // Unknown renders neutral. It is not a finding.
                                  "bg-brand-100 text-brand-600"
                            )}
                            title={(page.indexabilityReason ?? []).map((r) => r.evidence).join("\n") || undefined}
                          >
                            {indexability === "INDEXABLE"
                              ? "Indexable"
                              : indexability === "NOT_INDEXABLE"
                              ? "Not indexable"
                              : "Unknown"}
                          </span>
                        </td>
                      )}

                      {/* Word Count */}
                      {visibleColumns.wordCount && (
                        <td className="p-3 text-right font-mono font-medium text-slate-700 dark:text-slate-300">
                          {page.wordCount.toLocaleString()}
                        </td>
                      )}

                      {/* SEO Score */}
                      {visibleColumns.seoScore && (
                        <td className="p-3 text-center">
                          <span
                            className={cn(
                              "rounded-full border px-2.5 py-0.5 text-[11px] font-bold font-mono",
                              seoScore >= 75
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400"
                                : seoScore >= 50
                                ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400"
                                : "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400"
                            )}
                          >
                            {seoScore}
                          </span>
                        </td>
                      )}

                      {/* Issues */}
                      {visibleColumns.issues && (
                        <td className="p-3 text-center">
                          {issueCount > 0 ? (
                            <span className="rounded-full bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 px-2 py-0.5 text-[11px] font-bold">
                              {issueCount}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                      )}

                      {/* Last Crawled */}
                      {visibleColumns.lastCrawled && (
                        <td className="p-3 text-slate-500 dark:text-slate-400">
                          {page.crawledAt ? formatRelativeTime(page.crawledAt) : "Recently"}
                        </td>
                      )}

                      {/* Actions */}
                      <td className="p-3 pr-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <a
                            href={page.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 px-2 py-1 text-xs font-semibold shadow-xs transition-colors"
                          >
                            <span>View</span>
                            <ExternalLink size={11} />
                          </a>
                          <button
                            type="button"
                            onClick={() => onOpenPageDetails?.(page)}
                            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded"
                          >
                            <MoreHorizontal size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        <div className="p-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
          <div>
            Showing{" "}
            <span className="font-semibold text-slate-900 dark:text-white">
              {filteredPages.length > 0 ? startIndex + 1 : 0}
            </span>{" "}
            to{" "}
            <span className="font-semibold text-slate-900 dark:text-white">
              {Math.min(startIndex + itemsPerPage, filteredPages.length)}
            </span>{" "}
            of{" "}
            <span className="font-semibold text-slate-900 dark:text-white">
              {filteredPages.length}
            </span>{" "}
            pages
          </div>

          <div className="flex items-center gap-3">
            {/* Page buttons */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="h-7 w-7 rounded border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800 flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50"
              >
                <ChevronLeft size={13} />
              </button>

              {Array.from({ length: Math.min(5, totalPagesCount) }, (_, i) => {
                const pageNum = i + 1;
                return (
                  <button
                    key={pageNum}
                    type="button"
                    onClick={() => setCurrentPage(pageNum)}
                    className={cn(
                      "h-7 w-7 rounded border text-xs font-semibold transition",
                      currentPage === pageNum
                        ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                        : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50"
                    )}
                  >
                    {pageNum}
                  </button>
                );
              })}

              <button
                type="button"
                disabled={currentPage >= totalPagesCount}
                onClick={() => setCurrentPage((p) => Math.min(totalPagesCount, p + 1))}
                className="h-7 w-7 rounded border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800 flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50"
              >
                <ChevronRight size={13} />
              </button>
            </div>

            {/* Items per page selector */}
            <select
              value={itemsPerPage}
              onChange={(e) => {
                setItemsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="h-7 rounded border border-slate-200 bg-white px-2 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
            >
              <option value={10}>10 / page</option>
              <option value={20}>20 / page</option>
              <option value={50}>50 / page</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
