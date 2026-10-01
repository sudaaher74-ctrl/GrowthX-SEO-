"use client";

import React, { useMemo } from "react";
import type { CrawlIssue, CrawlJob, CrawlPage } from "@/lib/api-client";
import { computeCrawlSummary } from "@/lib/crawl-summary";
import { classifyPageType, toDisplayPageType, DISPLAY_PAGE_TYPES } from "@/lib/page-type";
import { PagesKpis } from "../pages/pages-kpis";
import { PagesDistributions } from "../pages/pages-distributions";
import { DiscoveredNotCrawledPanel } from "../pages/discovered-not-crawled-panel";
import { PagesTable } from "../pages/pages-table";
import type { CrawlQualityDiagnostics } from "../pages/page-score";

interface PagesTabProps {
  crawl: CrawlJob | null;
  pages: CrawlPage[];
  issues: CrawlIssue[];
  historyRuns?: { pagesCrawled: number; issuesFound: number }[];
  onOpenPageDetails?: (page: CrawlPage) => void;
}

export function PagesTab({
  crawl,
  pages,
  issues,
  historyRuns = [],
  onOpenPageDetails,
}: PagesTabProps) {
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
  const getPageType = (page: CrawlPage) => {
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

  return (
    <div className="space-y-5">
      {/* TOP ROW: 4 KPI CARDS */}
      <PagesKpis
        successfulCount={successfulCount}
        pagesDelta={pagesDelta}
        erroredCount={erroredCount}
        redirectedCount={redirectedCount}
        blockedCount={blockedCount}
        unreachableCount={unreachableCount}
        urlsDiscoveredCount={urlsDiscoveredCount}
        inventory={inventory}
        urlsCrawledCount={urlsCrawledCount}
        notCrawledCount={notCrawledCount}
        indexableCount={indexableCount}
        indexablePct={indexablePct}
        nonIndexableCount={nonIndexableCount}
        unknownIndexabilityCount={unknownIndexabilityCount}
        pagesCount={pages.length}
        crawlCoveragePct={crawlCoveragePct}
        crawlIsPartial={crawlIsPartial}
        duplicatesCount={summary.duplicates || 0}
        canonicalizedCount={summary.canonicalized || 0}
      />

      {/* MIDDLE ROW: 3 ANALYTICS CARDS */}
      <PagesDistributions
        pageTypeCounts={pageTypeCounts}
        statusCodeCounts={statusCodeCounts}
        discoverySourceList={discoverySourceList}
        multiSourceUrls={summary.multiSourceUrls}
        pagesCount={pages.length}
      />

      {/* SECTION: URLs DISCOVERED BUT NOT CRAWLED */}
      <DiscoveredNotCrawledPanel
        notCrawledCount={notCrawledCount}
        discoveredNotCrawledItems={discoveredNotCrawledItems}
        notCrawledReasonCounts={notCrawledReasonCounts}
      />

      {/* BOTTOM SECTION: PAGES TABLE */}
      <PagesTable
        pages={pages}
        issuesPerUrl={issuesPerUrl}
        onOpenPageDetails={onOpenPageDetails}
      />
    </div>
  );
}
