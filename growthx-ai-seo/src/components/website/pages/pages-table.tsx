"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  FileText,
  MoreHorizontal,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  X,
  Zap,
} from "lucide-react";
import { cn, formatRelativeTime } from "@/lib/utils";
import type { CrawlPage } from "@/lib/api-client";
import { classifyPageType, toDisplayPageType, DISPLAY_PAGE_TYPES, DisplayPageType } from "@/lib/page-type";
import { getPageSeoScore, getPageScorecardBreakdown } from "./page-score";
import { useWorkspace } from "@/hooks/use-growthx";
import { stagingEngine } from "@/lib/staging-engine";

interface PagesTableProps {
  pages: CrawlPage[];
  issuesPerUrl: Map<string, number>;
  onOpenPageDetails?: (page: CrawlPage) => void;
}

export function PagesTable({
  pages,
  issuesPerUrl,
  onOpenPageDetails,
}: PagesTableProps) {
  const { projectId } = useWorkspace();
  const [stagedPageUrls, setStagedPageUrls] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!projectId) return;
    const existing = stagingEngine.getStaged(projectId);
    const urls = new Set(
      existing
        .map((item) => item.affectedUrl)
        .filter((url): url is string => Boolean(url))
    );
    setStagedPageUrls(urls);
  }, [projectId]);

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
  const [scorecardPage, setScorecardPage] = useState<CrawlPage | null>(null);

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

  // Page Type classification across all 10 types
  const getPageType = (page: CrawlPage): DisplayPageType => {
    if (page.pageType) {
      const display = toDisplayPageType(page.pageType);
      if (display !== "Other") return display;
    }
    const derived = classifyPageType({ url: page.url, title: page.title, h1: page.h1 });
    return toDisplayPageType(derived);
  };

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
        return getPageSeoScore(b, issuesPerUrl) - getPageSeoScore(a, issuesPerUrl);
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

  const formatPageType = (page: CrawlPage) => getPageType(page);

  const handleQuickStagePage = (page: CrawlPage, issueCount: number) => {
    if (!projectId) return;
    const urlPath = (() => {
      try {
        return new URL(page.url).pathname;
      } catch {
        return page.url;
      }
    })();

    const isError = page.statusCode != null && page.statusCode >= 400;
    const isNoindex = page.indexability === "NOT_INDEXABLE";

    let title = `Fix on-page SEO issues on ${urlPath}`;
    let category = "Technical SEO";
    let priority: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" = "MEDIUM";
    let impact = `Resolves ${issueCount} detected crawl issues to protect rank and search crawl efficiency.`;

    if (isError) {
      title = `Resolve HTTP ${page.statusCode} error on ${urlPath}`;
      category = "Crawlability & Errors";
      priority = "CRITICAL";
      impact = `HTTP ${page.statusCode} error blocks search bots and users, wasting crawl budget.`;
    } else if (isNoindex) {
      title = `Fix indexability & non-indexable status on ${urlPath}`;
      category = "Indexability";
      priority = "HIGH";
      impact = "Page is currently non-indexable by search engines. Fix canonical/meta directives to restore indexation.";
    } else if (issueCount >= 3) {
      title = `Resolve ${issueCount} technical audit issues on ${urlPath}`;
      priority = "HIGH";
    }

    const deliverable = [
      `Target URL: ${page.url}`,
      `Page Title: ${page.title || "Untitled Document"}`,
      `HTTP Status: ${page.statusCode || "Unknown"}`,
      `Indexability: ${page.indexability || "Unknown"}`,
      `Reported Issues: ${issueCount}`,
      "",
      "Remediation Steps:",
      "1. Audit page response headers and meta robot tags.",
      "2. Check canonical URL consistency and internal linking structure.",
      "3. Correct heading hierarchy (H1, H2) and missing image alt tags.",
      "4. Verify Core Web Vitals performance and server response times.",
    ].join("\n");

    stagingEngine.stage(projectId, {
      title,
      category,
      source: "TECHNICAL_AUDIT",
      priority,
      impact,
      effortHours: isError ? 1 : 2,
      deliverable,
      evidence: `Technical Crawler · ${issueCount} issues · Status ${page.statusCode || "Unknown"}`,
      affectedUrl: page.url,
    });

    setStagedPageUrls((prev) => new Set(prev).add(page.url));
  };

  const criticalPages = useMemo(() => {
    return pages.filter((p) => {
      const issues = issuesPerUrl.get(p.url) || 0;
      return (issues > 0 || (p.statusCode != null && p.statusCode >= 400)) && !stagedPageUrls.has(p.url);
    });
  }, [pages, issuesPerUrl, stagedPageUrls]);

  const handleStageSelectedPages = () => {
    if (!projectId || selectedPageIds.size === 0) return;
    const selected = pages.filter((p) => selectedPageIds.has(p.id) && !stagedPageUrls.has(p.url));
    if (selected.length === 0) return;

    for (const page of selected) {
      const issues = issuesPerUrl.get(page.url) || 0;
      handleQuickStagePage(page, issues);
    }
  };

  const handleStageAllCritical = () => {
    if (!projectId || criticalPages.length === 0) return;
    for (const page of criticalPages) {
      const issues = issuesPerUrl.get(page.url) || 0;
      handleQuickStagePage(page, issues);
    }
  };

  const handleBulkStageRedirects = () => {
    if (!projectId || selectedPageIds.size === 0) return;
    const selected = pages.filter((p) => selectedPageIds.has(p.id));
    for (const page of selected) {
      const urlPath = (() => {
        try {
          return new URL(page.url).pathname;
        } catch {
          return page.url;
        }
      })();
      stagingEngine.stage(projectId, {
        title: `Consolidate 301 Redirect Target for ${urlPath}`,
        category: "Crawlability & Redirects",
        source: "TECHNICAL_AUDIT",
        priority: page.statusCode != null && page.statusCode >= 400 ? "CRITICAL" : "HIGH",
        impact: page.statusCode
          ? `Resolves HTTP ${page.statusCode} redirect chain to preserve PageRank and reduce crawl budget waste.`
          : "Resolves redirect chain to preserve PageRank and reduce crawl budget waste.",
        effortHours: 1,
        deliverable: `Configure clean 301 permanent redirect header from ${page.url} directly to primary canonical URL.`,
        evidence: `HTTP Status ${page.statusCode || "Redirect"} · Crawled URL ${page.url}`,
        affectedUrl: page.url,
      });
      setStagedPageUrls((prev) => new Set(prev).add(page.url));
    }
  };

  const handleBulkStageCanonicals = () => {
    if (!projectId || selectedPageIds.size === 0) return;
    const selected = pages.filter((p) => selectedPageIds.has(p.id));
    for (const page of selected) {
      const urlPath = (() => {
        try {
          return new URL(page.url).pathname;
        } catch {
          return page.url;
        }
      })();
      stagingEngine.stage(projectId, {
        title: `Normalize Canonical Tag on ${urlPath}`,
        category: "Canonical Normalization",
        source: "TECHNICAL_AUDIT",
        priority: "HIGH",
        impact: "Enforce exact self-referencing canonical link tag to prevent cross-variant index dilution.",
        effortHours: 1,
        deliverable: `Inject <link rel="canonical" href="${page.url}" /> into document <head>.`,
        evidence: `Indexability: ${page.indexability || "Unknown"} · Target URL: ${page.url}`,
        affectedUrl: page.url,
      });
      setStagedPageUrls((prev) => new Set(prev).add(page.url));
    }
  };

  const handleExportMatrixCsv = () => {
    const headers = ["URL", "Title", "Page Type", "HTTP Status", "Indexability", "Word Count", "SEO Score", "Audit Issues"];
    const rows = filteredPages.map((p) => [
      `"${p.url.replace(/"/g, '""')}"`,
      `"${(p.title || "").replace(/"/g, '""')}"`,
      `"${getPageType(p)}"`,
      p.statusCode || 0,
      `"${p.indexability || "UNKNOWN"}"`,
      p.wordCount || 0,
      getPageSeoScore(p, issuesPerUrl),
      issuesPerUrl.get(p.url) || 0,
    ]);
    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `crawl-pages-matrix-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportSelectedCsv = () => {
    const selected = pages.filter((p) => selectedPageIds.has(p.id));
    if (selected.length === 0) return;
    const headers = ["URL", "Title", "Page Type", "HTTP Status", "Indexability", "Word Count", "SEO Score", "Audit Issues"];
    const rows = selected.map((p) => [
      `"${p.url.replace(/"/g, '""')}"`,
      `"${(p.title || "").replace(/"/g, '""')}"`,
      `"${getPageType(p)}"`,
      p.statusCode || 0,
      `"${p.indexability || "UNKNOWN"}"`,
      p.wordCount || 0,
      getPageSeoScore(p, issuesPerUrl),
      issuesPerUrl.get(p.url) || 0,
    ]);
    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `selected-pages-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="rounded-xl border border-brand-200 bg-surface-1 shadow-xs overflow-hidden">
      {/* Quick Segment Filter Bar */}
      <div className="p-3 border-b border-brand-200 bg-surface-2/70 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              setSelectedStatus("ALL");
              setSelectedIndexability("ALL");
              setCurrentPage(1);
            }}
            className={cn(
              "rounded-lg px-2.5 py-1 text-xs font-bold transition active:scale-[0.98] cursor-pointer",
              selectedStatus === "ALL" && selectedIndexability === "ALL"
                ? "bg-signal-400 text-signal-ink shadow-xs"
                : "border border-brand-200 bg-surface-1 text-brand-700 hover:bg-surface-3 hover:text-brand-950"
            )}
          >
            All Pages ({pages.length})
          </button>
          <button
            type="button"
            onClick={() => {
              setSelectedStatus("200");
              setCurrentPage(1);
            }}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold transition active:scale-[0.98] cursor-pointer",
              selectedStatus === "200"
                ? "bg-success-600 text-white shadow-xs"
                : "border border-brand-200 bg-surface-1 text-brand-700 hover:bg-surface-3 hover:text-brand-950"
            )}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-success-500" />
            200 OK
          </button>
          <button
            type="button"
            onClick={() => {
              setSelectedStatus("3xx");
              setCurrentPage(1);
            }}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold transition active:scale-[0.98] cursor-pointer",
              selectedStatus === "3xx"
                ? "bg-warning-600 text-white shadow-xs"
                : "border border-brand-200 bg-surface-1 text-brand-700 hover:bg-surface-3 hover:text-brand-950"
            )}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-warning-500" />
            3xx Redirects
          </button>
          <button
            type="button"
            onClick={() => {
              setSelectedStatus("4xx");
              setCurrentPage(1);
            }}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold transition active:scale-[0.98] cursor-pointer",
              selectedStatus === "4xx"
                ? "bg-error-600 text-white shadow-xs"
                : "border border-brand-200 bg-surface-1 text-brand-700 hover:bg-surface-3 hover:text-brand-950"
            )}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-error-500" />
            4xx/5xx Errors
          </button>
          <button
            type="button"
            onClick={() => {
              setSelectedIndexability(selectedIndexability === "INDEXABLE" ? "ALL" : "INDEXABLE");
              setCurrentPage(1);
            }}
            className={cn(
              "rounded-lg px-2.5 py-1 text-xs font-bold transition active:scale-[0.98] cursor-pointer",
              selectedIndexability === "INDEXABLE"
                ? "bg-brand-950 text-white shadow-xs"
                : "border border-brand-200 bg-surface-1 text-brand-700 hover:bg-surface-3 hover:text-brand-950"
            )}
          >
            Indexable Only
          </button>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-brand-400" />
          <input
            type="text"
            placeholder="Search pages or URLs..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="h-8 w-48 sm:w-60 rounded-lg border border-brand-200 bg-surface-1 pl-8 pr-3 text-xs text-brand-950 placeholder:text-brand-400 focus:outline-none focus:border-brand-400"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-brand-400 hover:text-brand-600 cursor-pointer"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="p-3 border-b border-brand-200 bg-surface-1 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0 pr-14 sm:pr-16 lg:pr-0">
          {/* Page Type Filter (10 Types) */}
          <select
            value={selectedType}
            onChange={(e) => {
              setSelectedType(e.target.value);
              setCurrentPage(1);
            }}
            className="h-8 rounded-lg border border-brand-200 bg-surface-2 px-2.5 text-xs font-medium text-brand-800 focus:outline-none focus:border-brand-400"
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
            className="h-8 rounded-lg border border-brand-200 bg-surface-2 px-2.5 text-xs font-medium text-brand-800 focus:outline-none focus:border-brand-400"
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
            className="h-8 rounded-lg border border-brand-200 bg-surface-2 px-2.5 text-xs font-medium text-brand-800 focus:outline-none focus:border-brand-400"
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
              className="h-8 rounded-lg border border-brand-200 bg-surface-2 px-2.5 text-xs font-medium text-brand-800 hover:bg-surface-3 inline-flex items-center gap-1.5 cursor-pointer"
            >
              <SlidersHorizontal size={12} />
              <span>Columns</span>
              <ChevronDown size={12} />
            </button>

            {showColumnsMenu && (
              <div className="absolute left-0 sm:left-auto sm:right-0 top-9 w-44 rounded-lg border border-brand-200 bg-surface-1 p-2 shadow-lg z-20 space-y-1 text-xs">
                {Object.entries(visibleColumns).map(([col, isVisible]) => (
                  <label key={col} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-surface-2 cursor-pointer text-brand-800">
                    <input
                      type="checkbox"
                      checked={isVisible}
                      onChange={() => setVisibleColumns((prev) => ({ ...prev, [col]: !isVisible }))}
                      className="rounded border-brand-300 text-brand-900 focus:ring-brand-500"
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
            className="h-8 rounded-lg border border-brand-200 bg-surface-2 px-2.5 text-xs font-medium text-brand-800 focus:outline-none focus:border-brand-400"
          >
            <option value="seoScore">Sort by: SEO Score</option>
            <option value="wordCount">Sort by: Word Count</option>
            <option value="issues">Sort by: Issues</option>
            <option value="status">Sort by: Status</option>
          </select>
        </div>

        {/* Right Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportMatrixCsv}
            className="h-8 rounded-lg border border-brand-200 bg-surface-2 px-2.5 text-xs font-bold text-brand-800 hover:bg-surface-3 shadow-2xs inline-flex items-center gap-1.5 transition active:scale-[0.98] cursor-pointer"
            title="Export full filtered crawl matrix as CSV"
          >
            <Download size={12} className="text-brand-600" />
            <span>Export Matrix</span>
          </button>

          {selectedPageIds.size > 0 && (
            <button
              type="button"
              onClick={handleStageSelectedPages}
              className="h-8 rounded-lg border border-signal-400 bg-signal-400 px-3 text-xs font-bold text-signal-ink shadow-xs inline-flex items-center gap-1.5 transition hover:brightness-105 active:scale-[0.98] cursor-pointer"
            >
              <Zap size={12} className="fill-signal-ink" />
              <span>Stage Selected ({selectedPageIds.size})</span>
            </button>
          )}

          {criticalPages.length > 0 && (
            <button
              type="button"
              onClick={handleStageAllCritical}
              className="h-8 rounded-lg border border-brand-200 bg-surface-2 px-3 text-xs font-bold text-brand-800 hover:bg-surface-3 shadow-2xs inline-flex items-center gap-1.5 transition active:scale-[0.98] cursor-pointer"
              title="Stage all pages with HTTP errors or reported audit issues directly into Fix Engine"
            >
              <Zap size={12} className="text-warning-500 fill-warning-500" />
              <span>Stage Issues ({criticalPages.length})</span>
            </button>
          )}
        </div>
      </div>

      {/* Table Content */}
      {filteredPages.length === 0 ? (
        <div className="p-8 text-center text-xs text-brand-500">
          No crawled pages match the selected criteria.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-brand-200 text-[11px] font-semibold uppercase tracking-wider text-brand-500 bg-surface-2/60">
                <th className="p-3 pl-4 w-8">
                  <input
                    type="checkbox"
                    checked={selectedPageIds.size === paginatedPages.length && paginatedPages.length > 0}
                    onChange={toggleSelectAll}
                    className="rounded border-brand-300 text-brand-900 focus:ring-brand-500"
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
            <tbody className="divide-y border-brand-200 divide-brand-200">
              {paginatedPages.map((page) => {
                const isSelected = selectedPageIds.has(page.id);
                const seoScore = getPageSeoScore(page, issuesPerUrl);
                const issueCount = issuesPerUrl.get(page.url) || 0;
                const indexability = page.indexability ?? "UNKNOWN";
                const pageType = formatPageType(page);

                return (
                  <tr
                    key={page.id}
                    onClick={() => onOpenPageDetails?.(page)}
                    className={cn(
                      "hover:bg-surface-2/80 transition-colors cursor-pointer",
                      isSelected && "bg-brand-50/50"
                    )}
                  >
                    <td className="p-3 pl-4" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectPage(page.id)}
                        className="rounded border-brand-300 text-brand-900 focus:ring-brand-500"
                      />
                    </td>

                    {/* URL / Title */}
                    <td className="p-3 max-w-[280px]">
                      <div className="font-semibold text-brand-950 truncate">
                        {page.title || (page.statusCode == null || page.statusCode === 0 ? "Not retrieved" : "Untitled Document")}
                      </div>
                      <a
                        href={page.url}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="font-mono text-[11px] text-accent-700 hover:underline truncate block mt-0.5"
                      >
                        {page.url}
                      </a>
                      <div className="mt-1 flex flex-wrap items-center gap-1">
                        {page.jsRequired && (
                          <span
                            className="rounded border bg-accent-50 px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-accent-700"
                            title="The crawler found additional content after running JavaScript. Search and AI visibility were not measured by this check."
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
                        <span className="rounded-md bg-surface-2 text-brand-700 border border-brand-200/60 px-2 py-0.5 text-[11px] font-medium">
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
                              ? "bg-brand-100 text-brand-600 border-brand-200"
                              : page.statusCode >= 200 && page.statusCode < 300
                              ? "bg-success-50 text-success-700 border-success-200"
                              : page.statusCode >= 300 && page.statusCode < 400
                              ? "bg-warning-50 text-warning-700 border-warning-200"
                              : "bg-error-50 text-error-700 border-error-200"
                          )}
                          title={
                            page.statusChain && page.statusChain.length > 1
                              ? page.statusChain.map((h) => `${h.status} ${h.url}`).join("\n")
                              : undefined
                          }
                        >
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
                              ? "bg-success-50 text-success-700 border-success-200"
                              : indexability === "NOT_INDEXABLE"
                              ? "bg-warning-50 text-warning-700 border-warning-200"
                              : "bg-brand-100 text-brand-600 border-brand-200"
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
                      <td className="p-3 text-right font-mono font-medium text-brand-800">
                        {page.wordCount.toLocaleString()}
                      </td>
                    )}

                    {/* SEO Score */}
                    {visibleColumns.seoScore && (
                      <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => setScorecardPage(page)}
                          className={cn(
                            "rounded-full border px-2.5 py-0.5 text-[11px] font-bold font-mono transition hover:scale-105 cursor-pointer shadow-2xs",
                            seoScore >= 75
                              ? "bg-success-50 text-success-700 border-success-200 hover:bg-success-100"
                              : seoScore >= 50
                              ? "bg-warning-50 text-warning-700 border-warning-200 hover:bg-warning-100"
                              : "bg-error-50 text-error-700 border-error-200 hover:bg-error-100"
                          )}
                          title="Click to view granular 100-point on-page SEO scorecard breakdown"
                        >
                          {seoScore}
                        </button>
                      </td>
                    )}

                    {/* Issues */}
                    {visibleColumns.issues && (
                      <td className="p-3 text-center">
                        {issueCount > 0 ? (
                          <span className="rounded-full bg-error-50 text-error-700 border border-error-200 px-2 py-0.5 text-[11px] font-bold">
                            {issueCount}
                          </span>
                        ) : (
                          <span className="text-brand-400">—</span>
                        )}
                      </td>
                    )}

                    {/* Last Crawled */}
                    {visibleColumns.lastCrawled && (
                      <td className="p-3 text-brand-500">
                        {page.crawledAt ? formatRelativeTime(page.crawledAt) : "Recently"}
                      </td>
                    )}

                    {/* Actions */}
                    <td className="p-3 pr-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        {stagedPageUrls.has(page.url) ? (
                          <span className="inline-flex items-center gap-1 rounded-lg border border-success-200 bg-success-50 px-2 py-1 text-[11px] font-bold text-success-700">
                            <CheckCircle2 size={11} className="text-success-600" />
                            <span>Staged</span>
                          </span>
                        ) : (issueCount > 0 || (page.statusCode != null && page.statusCode >= 400) || indexability === "NOT_INDEXABLE") ? (
                          <button
                            type="button"
                            onClick={() => handleQuickStagePage(page, issueCount)}
                            className="inline-flex items-center gap-1 rounded-lg border border-signal-300 bg-signal-100 hover:bg-signal-200 px-2 py-1 text-[11px] font-bold text-signal-ink transition cursor-pointer shadow-2xs active:scale-[0.98]"
                            title="Stage this page for remediation in Fix Engine"
                          >
                            <Zap size={11} className="fill-signal-400 text-signal-ink" />
                            <span>Stage Fix</span>
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => setScorecardPage(page)}
                          className="inline-flex items-center gap-1 rounded-lg border border-brand-200 bg-surface-1 px-2 py-1 text-xs font-semibold text-brand-800 hover:bg-surface-3 transition cursor-pointer shadow-2xs"
                          title="View granular 100-point on-page SEO scorecard breakdown"
                        >
                          <FileText size={11} className="text-brand-600" />
                          <span>Scorecard</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onOpenPageDetails?.(page)}
                          className="inline-flex items-center gap-1 rounded-lg border border-brand-200 bg-surface-2 px-2 py-1 text-xs font-semibold text-brand-800 hover:bg-surface-3 transition cursor-pointer"
                        >
                          Inspect
                        </button>
                        <a
                          href={page.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-lg border border-brand-200 bg-surface-1 px-2 py-1 text-xs font-semibold text-brand-600 hover:text-brand-950 transition-colors shadow-xs"
                        >
                          <span>View</span>
                          <ExternalLink size={11} />
                        </a>
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
      <div className="p-3 border-t border-brand-200 bg-surface-2/60 flex flex-wrap items-center justify-between gap-3 text-xs text-brand-500">
        <div>
          Showing{" "}
          <span className="font-semibold text-brand-950">
            {filteredPages.length > 0 ? startIndex + 1 : 0}
          </span>{" "}
          to{" "}
          <span className="font-semibold text-brand-950">
            {Math.min(startIndex + itemsPerPage, filteredPages.length)}
          </span>{" "}
          of{" "}
          <span className="font-semibold text-brand-950">
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
              className="h-7 w-7 rounded border border-brand-200 bg-surface-1 text-brand-700 flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:bg-surface-2 cursor-pointer"
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
                      ? "bg-signal-400 text-signal-ink border-signal-400 font-bold shadow-xs"
                      : "border-brand-200 bg-surface-1 text-brand-700 hover:bg-surface-2"
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
              className="h-7 w-7 rounded border border-brand-200 bg-surface-1 text-brand-700 flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:bg-surface-2 cursor-pointer"
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
            className="h-7 rounded border border-brand-200 bg-surface-1 px-2 text-xs font-medium text-brand-800"
          >
            <option value={10}>10 / page</option>
            <option value={20}>20 / page</option>
            <option value={50}>50 / page</option>
          </select>
        </div>
      </div>

      {/* Floating Multi-Select Bulk Remediation Bar */}
      {selectedPageIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex flex-wrap items-center gap-2.5 rounded-2xl border border-brand-800 bg-brand-950 px-4 py-2.5 text-xs text-brand-50 shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-3 duration-150">
          <div className="flex items-center gap-2 pr-2 border-r border-brand-800">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-signal-400 text-signal-ink font-bold text-[10.5px]">
              {selectedPageIds.size}
            </span>
            <span className="font-semibold text-brand-200">Selected</span>
          </div>
          <button
            type="button"
            onClick={handleBulkStageRedirects}
            className="inline-flex items-center gap-1.5 rounded-lg bg-surface-1/10 hover:bg-surface-1/20 px-2.5 py-1 font-semibold text-brand-100 transition active:scale-[0.98]"
            title="Stage 301 redirect consolidation for all selected URLs"
          >
            <Zap size={12} className="text-signal-400" />
            <span>Stage 301s</span>
          </button>
          <button
            type="button"
            onClick={handleBulkStageCanonicals}
            className="inline-flex items-center gap-1.5 rounded-lg bg-surface-1/10 hover:bg-surface-1/20 px-2.5 py-1 font-semibold text-brand-100 transition active:scale-[0.98]"
            title="Stage self-referencing canonical normalization for selected URLs"
          >
            <Zap size={12} className="text-signal-400" />
            <span>Stage Canonicals</span>
          </button>
          <button
            type="button"
            onClick={handleStageSelectedPages}
            className="inline-flex items-center gap-1.5 rounded-lg bg-signal-400 hover:bg-signal-500 px-3 py-1 font-bold text-signal-ink transition shadow-xs active:scale-[0.98]"
            title="Stage all on-page SEO recommendations for selected URLs"
          >
            <Zap size={12} className="fill-signal-ink" />
            <span>Stage All Fixes</span>
          </button>
          <button
            type="button"
            onClick={handleExportSelectedCsv}
            className="inline-flex items-center gap-1 rounded-lg bg-surface-1/10 hover:bg-surface-1/20 px-2.5 py-1 font-semibold text-brand-100 transition"
            title="Download CSV of selected pages"
          >
            <Download size={12} />
            <span>CSV</span>
          </button>
          <button
            type="button"
            onClick={() => setSelectedPageIds(new Set())}
            className="ml-1 text-brand-400 hover:text-brand-100 transition p-1"
            title="Deselect all"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Granular On-Page SEO Scorecard Slide-Over Modal / Drawer */}
      {scorecardPage && (() => {
        const breakdown = getPageScorecardBreakdown(scorecardPage, issuesPerUrl);
        const issues = issuesPerUrl.get(scorecardPage.url) || 0;
        const isStaged = stagedPageUrls.has(scorecardPage.url);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-end bg-brand-950/40 backdrop-blur-xs p-0">
            <div className="w-full max-w-lg h-full bg-surface-1 border-l border-brand-200 shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">
              {/* Drawer Header */}
              <div className="flex items-center justify-between p-4 border-b border-brand-200 bg-surface-2/80">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-950 text-brand-50 font-mono text-xs font-bold">
                    100
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-brand-950">On-Page SEO Scorecard</h3>
                    <p className="text-[11px] text-brand-500 font-mono">Deterministic Factor Scoring</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setScorecardPage(null)}
                  className="rounded-lg p-1.5 text-brand-400 hover:text-brand-950 hover:bg-surface-3 transition"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Drawer Body */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Target URL Header Card */}
                <div className="rounded-xl border border-brand-200 bg-surface-2 p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-brand-500 font-mono">
                      Audited Page Target
                    </span>
                    <span
                      className={cn(
                        "rounded-full border px-2.5 py-0.5 text-xs font-bold font-mono",
                        breakdown.totalScore >= 75
                          ? "bg-success-50 text-success-700 border-success-200"
                          : breakdown.totalScore >= 50
                          ? "bg-warning-50 text-warning-700 border-warning-200"
                          : "bg-error-50 text-error-700 border-error-200"
                      )}
                    >
                      Score: {breakdown.totalScore}/100
                    </span>
                  </div>
                  <div className="font-semibold text-brand-950 text-xs">
                    {scorecardPage.title || "Untitled Document"}
                  </div>
                  <a
                    href={scorecardPage.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-mono text-accent-700 hover:underline break-all block flex items-center gap-1"
                  >
                    <span>{scorecardPage.url}</span>
                    <ExternalLink size={11} className="shrink-0" />
                  </a>
                </div>

                {/* Granular Factor Progress Bars */}
                <div className="space-y-3">
                  <div className="text-xs font-bold uppercase tracking-wider text-brand-700">
                    Audit Factors &amp; Deductions
                  </div>
                  {breakdown.metrics.map((metric) => (
                    <div
                      key={metric.name}
                      className="rounded-xl border border-brand-200/80 bg-surface-1 p-3.5 shadow-2xs space-y-2"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-brand-950 flex items-center gap-1.5">
                          {metric.status === "pass" ? (
                            <CheckCircle2 size={13} className="text-success-600" />
                          ) : metric.status === "warn" ? (
                            <ShieldAlert size={13} className="text-warning-600" />
                          ) : (
                            <ShieldAlert size={13} className="text-error-600" />
                          )}
                          {metric.name}
                        </span>
                        <span className="font-mono text-[11px] font-bold">
                          {metric.deduction > 0 ? (
                            <span className="text-error-600">-{metric.deduction} pts</span>
                          ) : (
                            <span className="text-success-700">+{metric.maxScore} pts</span>
                          )}
                        </span>
                      </div>

                      {/* Score bar */}
                      <div className="h-1.5 w-full rounded-full bg-brand-100 overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all",
                            metric.status === "pass"
                              ? "bg-success-500"
                              : metric.status === "warn"
                              ? "bg-warning-500"
                              : "bg-error-500"
                          )}
                          style={{ width: `${(metric.score / metric.maxScore) * 100}%` }}
                        />
                      </div>

                      <div className="text-[11.5px] text-brand-600">
                        {metric.detail}
                      </div>

                      {metric.recommendation && (
                        <div className="text-[11px] text-brand-500 bg-surface-2 p-2 rounded-lg border border-brand-200/60 flex items-start gap-1.5">
                          <Sparkles size={12} className="text-signal-500 shrink-0 mt-0.5" />
                          <span>{metric.recommendation}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Drawer Footer Actions */}
              <div className="p-4 border-t border-brand-200 bg-surface-2/80 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard.writeText(scorecardPage.url);
                  }}
                  className="text-xs font-semibold text-brand-600 hover:text-brand-950 transition"
                >
                  Copy URL
                </button>
                <div className="flex items-center gap-2">
                  {isStaged ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-success-700">
                      <CheckCircle2 size={13} className="text-success-600" />
                      <span>Staged in Fix Engine</span>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleQuickStagePage(scorecardPage, issues)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-signal-400 hover:bg-signal-500 px-3 py-1.5 text-xs font-bold text-signal-ink transition shadow-xs"
                    >
                      <Zap size={12} className="fill-signal-ink" />
                      <span>Stage Fix in Fix Engine</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
