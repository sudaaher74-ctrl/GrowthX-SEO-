"use client";

import React, { useMemo, useState } from "react";
import {
  ArrowRight,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Filter,
  Globe,
  Layers,
  MoreHorizontal,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { cn, formatRelativeTime } from "@/lib/utils";
import type { CrawlIssue, CrawlJob, CrawlPage } from "@/lib/api-client";
import { DonutChart } from "../donut-chart";

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

  const successfulCount = pages.filter((p) => p.statusCode >= 200 && p.statusCode < 300).length;
  const redirectedCount = pages.filter((p) => p.statusCode >= 300 && p.statusCode < 400).length;
  const blockedCount = pages.filter((p) => p.statusCode >= 400).length;

  // 2. Indexable Pages card metrics
  const nonIndexablePages = useMemo(() => {
    return pages.filter(
      (p) =>
        p.statusCode >= 400 ||
        issues.some(
          (i) => i.affectedUrl === p.url && (i.issueType || "").toUpperCase().includes("NOINDEX")
        )
    );
  }, [pages, issues]);

  const indexableCount = Math.max(0, pages.length - nonIndexablePages.length);
  const indexablePct = pages.length > 0 ? Math.round((indexableCount / pages.length) * 100) : 0;

  // 3. Page Type Distribution Donut
  const pageTypeCounts = useMemo(() => {
    const map: Record<string, number> = {
      Product: 0,
      Category: 0,
      Blog: 0,
      Homepage: 0,
      Static: 0,
      Other: 0,
    };

    for (const page of pages) {
      const type = page.pageType || "";
      if (type.toLowerCase().includes("product") || page.url.includes("/product")) {
        map.Product = (map.Product || 0) + 1;
      } else if (type.toLowerCase().includes("cat") || page.url.includes("/category") || page.url.includes("/collection")) {
        map.Category = (map.Category || 0) + 1;
      } else if (type.toLowerCase().includes("blog") || page.url.includes("/blog") || page.url.includes("/news")) {
        map.Blog = (map.Blog || 0) + 1;
      } else if (page.url.endsWith("/") && !page.url.replace(/^https?:\/\/[^/]+/, "").replace(/^\/+/, "")) {
        map.Homepage = (map.Homepage || 0) + 1;
      } else if (type.toLowerCase().includes("static") || page.url.includes("/about") || page.url.includes("/contact")) {
        map.Static = (map.Static || 0) + 1;
      } else {
        map.Other = (map.Other || 0) + 1;
      }
    }

    const res = [];
    if (map.Product > 0) res.push({ label: "Product", value: map.Product, color: "#3b82f6" });
    if (map.Category > 0) res.push({ label: "Category", value: map.Category, color: "#10b981" });
    if (map.Blog > 0) res.push({ label: "Blog", value: map.Blog, color: "#8b5cf6" });
    if (map.Homepage > 0) res.push({ label: "Homepage", value: map.Homepage, color: "#06b6d4" });
    if (map.Static > 0) res.push({ label: "Static", value: map.Static, color: "#64748b" });
    if (map.Other > 0) res.push({ label: "Other", value: map.Other, color: "#f59e0b" });

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
      result = result.filter((p) => {
        const t = (p.pageType || "").toLowerCase();
        if (selectedType === "Product") return t.includes("product") || p.url.includes("/product");
        if (selectedType === "Category") return t.includes("cat") || p.url.includes("/category");
        if (selectedType === "Blog") return t.includes("blog") || p.url.includes("/blog");
        if (selectedType === "Static") return t.includes("static") || p.url.includes("/about") || p.url.includes("/contact");
        if (selectedType === "Homepage") return p.url.endsWith("/") && !p.url.replace(/^https?:\/\/[^/]+/, "").replace(/^\/+/, "");
        return true;
      });
    }

    if (selectedStatus !== "ALL") {
      if (selectedStatus === "200") result = result.filter((p) => p.statusCode >= 200 && p.statusCode < 300);
      else if (selectedStatus === "3xx") result = result.filter((p) => p.statusCode >= 300 && p.statusCode < 400);
      else if (selectedStatus === "4xx") result = result.filter((p) => p.statusCode >= 400 && p.statusCode < 500);
      else if (selectedStatus === "5xx") result = result.filter((p) => p.statusCode >= 500);
    }

    if (selectedIndexability !== "ALL") {
      if (selectedIndexability === "INDEXABLE") {
        result = result.filter((p) => !nonIndexablePages.some((nip) => nip.id === p.id));
      } else {
        result = result.filter((p) => nonIndexablePages.some((nip) => nip.id === p.id));
      }
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
  }, [pages, searchQuery, selectedType, selectedStatus, selectedIndexability, sortBy, nonIndexablePages, issuesPerUrl]);

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
  const formatPageType = (page: CrawlPage) => {
    const url = page.url.toLowerCase();
    if (url.endsWith("/") && !url.replace(/^https?:\/\/[^/]+/, "").replace(/^\/+/, "")) return "Homepage";
    if (url.includes("/product")) return "Product";
    if (url.includes("/category") || url.includes("/collection")) return "Category";
    if (url.includes("/blog") || url.includes("/news")) return "Blog";
    if (url.includes("/about") || url.includes("/contact") || url.includes("/privacy") || url.includes("/terms")) return "Static";
    return page.pageType || "Page";
  };

  return (
    <div className="space-y-5">
      {/* ======================================================== */}
      {/* TOP ROW: 4 CARDS                                         */}
      {/* ======================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* 1. Total Pages Crawled */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
              <Globe size={14} className="text-blue-600" />
              <span>Total Pages Crawled</span>
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                {pages.length.toLocaleString()}
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
              All pages discovered on your website.
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-3 text-[11px] text-slate-600 dark:text-slate-400">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <b className="text-slate-900 dark:text-white">{successfulCount}</b> Successful
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-rose-500" />
              <b className="text-slate-900 dark:text-white">{blockedCount}</b> Blocked
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              <b className="text-slate-900 dark:text-white">{redirectedCount}</b> Redirected
            </span>
          </div>
        </div>

        {/* 2. Indexable Pages */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
              <Layers size={14} className="text-blue-600" />
              <span>Indexable Pages</span>
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                {indexableCount}
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
                className="h-full bg-emerald-500 transition-all duration-500"
                style={{ width: `${indexablePct}%` }}
              />
              <div
                className="h-full bg-slate-300 dark:bg-slate-700 transition-all duration-500"
                style={{ width: `${100 - indexablePct}%` }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                <span>{indexableCount} Indexable</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                <span>{nonIndexablePages.length} Non-indexable</span>
              </span>
            </div>
          </div>
        </div>

        {/* 3. Page Type Distribution */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-2">
              Page Type Distribution
            </h3>
            <div className="flex items-center justify-center py-1">
              <DonutChart
                data={pageTypeCounts}
                centerValue={pages.length}
                centerLabel="Pages"
                size={130}
                thickness={18}
              />
            </div>
          </div>
        </div>

        {/* 4. Status Code Distribution */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-2">
              Status Code Distribution
            </h3>
            <div className="flex items-center justify-center py-1">
              <DonutChart
                data={statusCodeCounts}
                centerValue={pages.length}
                centerLabel="Pages"
                size={130}
                thickness={18}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* BOTTOM SECTION: PAGES TABLE                              */}
      {/* ======================================================== */}
      <div className="rounded-xl border border-slate-200/80 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
        {/* Filter Toolbar */}
        <div className="p-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-2">
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

            {/* Page Type Filter */}
            <select
              value={selectedType}
              onChange={(e) => {
                setSelectedType(e.target.value);
                setCurrentPage(1);
              }}
              className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
            >
              <option value="ALL">All Page Types</option>
              <option value="Product">Product</option>
              <option value="Category">Category</option>
              <option value="Blog">Blog</option>
              <option value="Homepage">Homepage</option>
              <option value="Static">Static</option>
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
              <option value="NON_INDEXABLE">Non-indexable</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
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
                <div className="absolute right-0 top-9 w-44 rounded-lg border border-slate-200 bg-white p-2 shadow-lg dark:border-slate-700 dark:bg-slate-800 z-20 space-y-1 text-xs">
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
              onChange={(e) => setSortBy(e.target.value as any)}
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
                  const isIndexable = !nonIndexablePages.some((nip) => nip.id === page.id);
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
                          {page.title || "Untitled Document"}
                        </div>
                        <a
                          href={page.url}
                          target="_blank"
                          rel="noreferrer"
                          className="font-mono text-[11px] text-blue-600 dark:text-blue-400 hover:underline truncate block mt-0.5"
                        >
                          {page.url}
                        </a>
                      </td>

                      {/* Type */}
                      {visibleColumns.type && (
                        <td className="p-3">
                          <span className="rounded-md bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 px-2 py-0.5 text-[11px] font-medium">
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
                              page.statusCode === 200
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400"
                                : page.statusCode >= 300 && page.statusCode < 400
                                ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400"
                                : "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400"
                            )}
                          >
                            {page.statusCode} {page.statusCode === 200 ? "OK" : page.statusCode === 301 ? "Redirect" : ""}
                          </span>
                        </td>
                      )}

                      {/* Indexability */}
                      {visibleColumns.indexability && (
                        <td className="p-3">
                          <span
                            className={cn(
                              "rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                              isIndexable
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400"
                                : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400"
                            )}
                          >
                            {isIndexable ? "Indexable" : "Noindex"}
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
