"use client";

import React from "react";
import { ExternalLink, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CrawlIssue } from "@/lib/api-client";
import { severityTone } from "./technical-seo-helpers";

export interface TechnicalIssuesTableProps {
  totalIssuesCount: number;
  totalPagesCount: number;
  filteredIssues: CrawlIssue[];
  searchQuery: string;
  onSearchChange: (q: string) => void;
  selectedSeverity: string;
  onSeverityChange: (s: string) => void;
  severityCounts: { CRITICAL: number; HIGH: number; MEDIUM: number; LOW: number };
  selectedCategory: string;
  onCategoryChange: (c: string) => void;
  categoryCounts: [string, number][];
  selectedPageUrl: string;
  onPageUrlChange: (u: string) => void;
  uniquePageUrls: string[];
  sortBy: "impact" | "severity" | "pages";
  onSortByChange: (s: "impact" | "severity" | "pages") => void;
  selectedIssueIds: Set<string>;
  onToggleSelectAll: () => void;
  onToggleSelectIssue: (id: string) => void;
}

export function TechnicalIssuesTable({
  totalIssuesCount,
  totalPagesCount,
  filteredIssues,
  searchQuery,
  onSearchChange,
  selectedSeverity,
  onSeverityChange,
  severityCounts,
  selectedCategory,
  onCategoryChange,
  categoryCounts,
  selectedPageUrl,
  onPageUrlChange,
  uniquePageUrls,
  sortBy,
  onSortByChange,
  selectedIssueIds,
  onToggleSelectAll,
  onToggleSelectIssue,
}: TechnicalIssuesTableProps) {
  return (
    <div
      id="technical-issues-table"
      className="rounded-2xl border bg-surface-1 shadow-card overflow-hidden scroll-mt-16"
      style={{ borderColor: "var(--border-color)" }}
    >
      {/* Table Header */}
      <div className="p-4 border-b flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2" style={{ borderColor: "var(--border-color)" }}>
        <div>
          <h3 className="text-base font-bold text-brand-950">Technical SEO Issues</h3>
          <p className="text-xs text-brand-400 mt-0.5">
            {totalIssuesCount} unique issues across {totalPagesCount} pages. Fix these to improve your technical health score.
          </p>
        </div>
        <span className="inline-flex items-center rounded-full bg-brand-100 border border-brand-200/50 px-2.5 py-0.5 text-[11px] font-mono font-bold text-brand-950 self-start sm:self-center">
          {filteredIssues.length} matching
        </span>
      </div>

      {/* Filter Toolbar */}
      <div
        className="p-3 border-b bg-surface-2 flex flex-wrap items-center justify-between gap-2.5"
        style={{ borderColor: "var(--border-color)" }}
      >
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
          {/* Search Input */}
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-brand-400" />
            <input
              type="text"
              placeholder="Search issues or URLs..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="h-8 w-48 sm:w-60 rounded-xl border bg-surface-1 pl-8 pr-3 text-xs text-brand-950 placeholder:text-brand-400 focus:outline-none focus:ring-1 focus:ring-signal-400"
              style={{ borderColor: "var(--border-color)" }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchChange("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-brand-400 hover:text-brand-950"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Severity Filter */}
          <select
            value={selectedSeverity}
            onChange={(e) => onSeverityChange(e.target.value)}
            className="h-8 rounded-xl border bg-surface-1 px-2.5 text-xs font-medium text-brand-950 focus:outline-none focus:ring-1 focus:ring-signal-400"
            style={{ borderColor: "var(--border-color)" }}
          >
            <option value="ALL">All Severities</option>
            <option value="CRITICAL">Critical ({severityCounts.CRITICAL})</option>
            <option value="HIGH">High ({severityCounts.HIGH})</option>
            <option value="MEDIUM">Medium ({severityCounts.MEDIUM})</option>
            <option value="LOW">Low ({severityCounts.LOW})</option>
          </select>

          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => onCategoryChange(e.target.value)}
            className="h-8 rounded-xl border bg-surface-1 px-2.5 text-xs font-medium text-brand-950 focus:outline-none focus:ring-1 focus:ring-signal-400"
            style={{ borderColor: "var(--border-color)" }}
          >
            <option value="ALL">All Categories</option>
            {categoryCounts.map(([cat, count]) => (
              <option key={cat} value={cat}>
                {cat} ({count})
              </option>
            ))}
          </select>

          {/* Page Filter */}
          {uniquePageUrls.length > 0 && (
            <select
              value={selectedPageUrl}
              onChange={(e) => onPageUrlChange(e.target.value)}
              className="h-8 max-w-[180px] truncate rounded-xl border bg-surface-1 px-2.5 text-xs font-medium text-brand-950 focus:outline-none focus:ring-1 focus:ring-signal-400"
              style={{ borderColor: "var(--border-color)" }}
            >
              <option value="ALL">All Pages</option>
              {uniquePageUrls.map((url) => (
                <option key={url} value={url}>
                  {url}
                </option>
              ))}
            </select>
          )}

          {/* Sort By Dropdown */}
          <select
            value={sortBy}
            onChange={(e) => onSortByChange(e.target.value as typeof sortBy)}
            className="h-8 rounded-xl border bg-surface-1 px-2.5 text-xs font-medium text-brand-950 focus:outline-none focus:ring-1 focus:ring-signal-400"
            style={{ borderColor: "var(--border-color)" }}
          >
            <option value="impact">Sort by: Impact</option>
            <option value="severity">Sort by: Severity</option>
          </select>
        </div>
      </div>

      {/* Table Content */}
      {filteredIssues.length === 0 ? (
        <div className="p-8 text-center text-xs text-brand-400">
          {searchQuery || selectedSeverity !== "ALL" || selectedCategory !== "ALL"
            ? "No issues match the selected filters."
            : "No technical issues found in this crawl."}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr
                className="border-b text-[10.5px] font-bold uppercase tracking-wider text-brand-400 bg-surface-2"
                style={{ borderColor: "var(--border-color)" }}
              >
                <th className="p-3 pl-4 w-8">
                  <input
                    type="checkbox"
                    checked={selectedIssueIds.size === filteredIssues.length && filteredIssues.length > 0}
                    onChange={onToggleSelectAll}
                    className="rounded border-line text-signal-400 focus:ring-signal-400"
                  />
                </th>
                <th className="p-3">SEVERITY</th>
                <th className="p-3">ISSUE</th>
                <th className="p-3">CATEGORY</th>
                <th className="p-3 text-center">PAGES</th>
                <th className="p-3">EXAMPLE URL</th>
                <th className="p-3 text-center">IMPACT</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: "var(--border-color)" }}>
              {filteredIssues.map((issue) => {
                const isSelected = selectedIssueIds.has(issue.id);
                return (
                  <tr
                    key={issue.id}
                    className={cn(
                      "hover:bg-brand-50/50 transition-colors",
                      isSelected && "bg-brand-100/50"
                    )}
                  >
                    <td className="p-3 pl-4">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => onToggleSelectIssue(issue.id)}
                        className="rounded border-line text-signal-400 focus:ring-signal-400"
                      />
                    </td>
                    <td className="p-3">
                      <span
                        className={cn(
                          "rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider font-mono",
                          severityTone(issue.severity)
                        )}
                      >
                        {issue.severity}
                      </span>
                    </td>
                    <td className="p-3 max-w-xs">
                      <div className="font-bold text-brand-950">
                        {issue.issueType.replace(/_/g, " ")}
                      </div>
                      <div className="text-[11px] text-brand-400 truncate mt-0.5">
                        {issue.description}
                      </div>
                    </td>
                    <td className="p-3">
                      <span className="rounded-md bg-surface-2 border border-brand-200/50 px-2 py-0.5 text-[11px] font-medium text-brand-950">
                        {issue.category ? issue.category.replace(/_/g, " ") : "General"}
                      </span>
                    </td>
                    <td className="p-3 text-center font-mono font-semibold text-brand-950">
                      {issue.page ? 1 : 1}
                    </td>
                    <td className="p-3 max-w-[200px]">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[11px] text-brand-950 truncate">
                          {issue.affectedUrl}
                        </span>
                        <a
                          href={issue.affectedUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-brand-400 hover:text-signal-400 shrink-0 transition"
                        >
                          <ExternalLink size={11} />
                        </a>
                      </div>
                    </td>
                    <td className="p-3 text-center">
                      <span
                        className={cn(
                          "rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                          severityTone(issue.severity)
                        )}
                      >
                        {issue.severity === "CRITICAL" || issue.severity === "HIGH"
                          ? "High"
                          : issue.severity === "MEDIUM"
                          ? "Medium"
                          : "Low"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
