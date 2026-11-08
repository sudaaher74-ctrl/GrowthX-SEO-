"use client";

import React, { useState, useMemo } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, ExternalLink, MoreHorizontal, Search, SlidersHorizontal, X } from "lucide-react";
import { cn, formatRelativeTime } from "@/lib/utils";
import type { CrawlPage } from "@/lib/api-client";
import { classifyPageType, toDisplayPageType, DISPLAY_PAGE_TYPES, DisplayPageType } from "@/lib/page-type";
import { getPageSeoScore } from "./page-score";

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
                ? "bg-emerald-500 text-white shadow-xs"
                : "border border-brand-200 bg-surface-1 text-brand-700 hover:bg-surface-3 hover:text-brand-950"
            )}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
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
                ? "bg-amber-500 text-white shadow-xs"
                : "border border-brand-200 bg-surface-1 text-brand-700 hover:bg-surface-3 hover:text-brand-950"
            )}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
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
                ? "bg-rose-500 text-white shadow-xs"
                : "border border-brand-200 bg-surface-1 text-brand-700 hover:bg-surface-3 hover:text-brand-950"
            )}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
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
                      <td className="p-3 text-center">
                        <span
                          className={cn(
                            "rounded-full border px-2.5 py-0.5 text-[11px] font-bold font-mono",
                            seoScore >= 75
                              ? "bg-success-50 text-success-700 border-success-200"
                              : seoScore >= 50
                              ? "bg-warning-50 text-warning-700 border-warning-200"
                              : "bg-error-50 text-error-700 border-error-200"
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
    </div>
  );
}
