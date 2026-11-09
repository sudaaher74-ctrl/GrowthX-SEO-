"use client";

import React, { useState } from "react";
import { CheckCircle2, ExternalLink, Search, X, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CrawlIssue } from "@/lib/api-client";
import { severityTone } from "./technical-seo-helpers";
import { useWorkspace } from "@/hooks/use-growthx";
import { stagingEngine } from "@/lib/staging-engine";

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
  const { projectId } = useWorkspace();
  const [stagedIssueIds, setStagedIssueIds] = useState<Set<string>>(() => {
    if (!projectId) return new Set();
    const existing = stagingEngine.getStaged(projectId);
    const set = new Set<string>();
    existing.forEach((item) => {
      if (item.evidence && item.evidence.includes("issue_id:")) {
        const match = item.evidence.match(/issue_id:([^\s]+)/);
        if (match?.[1]) set.add(match[1]);
      }
    });
    return set;
  });

  const handleStageSingleIssue = (issue: CrawlIssue) => {
    if (!projectId) return;
    const title = `Resolve Technical Issue: ${issue.issueType.replace(/_/g, " ")}`;
    stagingEngine.stage(projectId, {
      title,
      category: issue.category?.replace(/_/g, " ") || "Technical SEO",
      source: "TECHNICAL_AUDIT",
      priority: issue.severity,
      impact: `Fixes ${issue.description} on ${issue.affectedUrl}`,
      effortHours: issue.severity === "CRITICAL" ? 3 : issue.severity === "HIGH" ? 2 : 1,
      deliverable: `1. Inspect ${issue.affectedUrl} for ${issue.issueType}.\n2. Apply recommended technical fix.\n3. Verify HTTP response and meta tags via live crawler.\n4. Confirm zero regressions on indexability.`,
      evidence: `issue_id:${issue.id} affected_url:${issue.affectedUrl}`,
      affectedUrl: issue.affectedUrl,
    });
    setStagedIssueIds((prev) => new Set(prev).add(issue.id));
  };

  const handleStageSelectedIssues = () => {
    if (!projectId || selectedIssueIds.size === 0) return;
    const selected = filteredIssues.filter((i) => selectedIssueIds.has(i.id));
    for (const issue of selected) {
      handleStageSingleIssue(issue);
    }
  };

  return (
    <div
      id="technical-issues-table"
      className="rounded-2xl border border-brand-200/80 bg-surface-1 shadow-2xs overflow-hidden scroll-mt-16"
    >
      {/* Table Header */}
      <div className="p-4 border-b border-brand-200/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h3 className="text-base font-bold text-brand-950">Technical SEO Issues</h3>
          <p className="text-xs text-brand-400 mt-0.5">
            {totalIssuesCount} findings across {totalPagesCount} audited URLs. One problem type can affect many URLs.
          </p>
        </div>
        <span className="inline-flex items-center rounded-full bg-brand-100 border border-brand-200/50 px-2.5 py-0.5 text-[11px] font-mono font-bold text-brand-950 self-start sm:self-center">
          {filteredIssues.length} matching
        </span>
      </div>

      {/* Filter Toolbar */}
      <div className="p-3 border-b border-brand-200/80 bg-surface-2 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
          {/* Search Input */}
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-brand-400" />
            <input
              type="text"
              placeholder="Search issues or URLs..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="h-8 w-48 sm:w-60 rounded-xl border border-brand-200/80 bg-surface-1 pl-8 pr-3 text-xs text-brand-950 placeholder:text-brand-400 focus:outline-none focus:ring-1 focus:ring-signal-400"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchChange("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-brand-400 hover:text-brand-950 cursor-pointer"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Severity Filter */}
          <select
            value={selectedSeverity}
            onChange={(e) => onSeverityChange(e.target.value)}
            className="h-8 rounded-xl border border-brand-200/80 bg-surface-1 px-2.5 text-xs font-medium text-brand-950 focus:outline-none focus:ring-1 focus:ring-signal-400 cursor-pointer"
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
            className="h-8 rounded-xl border border-brand-200/80 bg-surface-1 px-2.5 text-xs font-medium text-brand-950 focus:outline-none focus:ring-1 focus:ring-signal-400 cursor-pointer"
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
              className="h-8 max-w-[180px] truncate rounded-xl border border-brand-200/80 bg-surface-1 px-2.5 text-xs font-medium text-brand-950 focus:outline-none focus:ring-1 focus:ring-signal-400 cursor-pointer"
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
            className="h-8 rounded-xl border border-brand-200/80 bg-surface-1 px-2.5 text-xs font-medium text-brand-950 focus:outline-none focus:ring-1 focus:ring-signal-400 cursor-pointer"
          >
            <option value="impact">Sort by: Impact</option>
            <option value="severity">Sort by: Severity</option>
          </select>
        </div>
      </div>

      {/* Bulk Staging Action Bar */}
      {selectedIssueIds.size > 0 && (
        <div className="flex items-center justify-between bg-brand-50 border-b border-brand-200/80 px-4 py-2.5 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-brand-950 font-mono">
              {selectedIssueIds.size} issue{selectedIssueIds.size === 1 ? "" : "s"} selected
            </span>
            <span className="text-brand-500">· Ready for autonomous dispatch</span>
          </div>
          <button
            type="button"
            onClick={handleStageSelectedIssues}
            className="inline-flex items-center gap-1.5 rounded-lg bg-signal-400 px-3 py-1 text-xs font-bold text-signal-ink shadow-2xs hover:bg-signal-500 transition cursor-pointer"
          >
            <Zap size={12} className="text-signal-ink" />
            <span>Stage Selected into Fix Engine ({selectedIssueIds.size})</span>
          </button>
        </div>
      )}

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
              <tr className="border-b border-brand-200/80 text-[10.5px] font-bold uppercase tracking-wider text-brand-400 bg-surface-2">
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
                <th className="p-3 text-right pr-4">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-200/60">
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
                    <td className="p-3 pr-4 text-right">
                      {stagedIssueIds.has(issue.id) ? (
                        <span className="inline-flex items-center gap-1 rounded-md border border-success-200 bg-success-50 px-2 py-0.5 text-[10.5px] font-bold text-success-700 font-mono">
                          <CheckCircle2 size={10} className="text-success-600" />
                          <span>Staged</span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleStageSingleIssue(issue)}
                          className="inline-flex items-center gap-1 rounded-md border border-brand-200 bg-surface-2 px-2.5 py-1 text-[10.5px] font-bold text-brand-800 hover:bg-surface-3 hover:text-brand-950 transition cursor-pointer shadow-2xs"
                        >
                          <Zap size={10} className="text-signal-400" />
                          <span>Stage Fix</span>
                        </button>
                      )}
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
