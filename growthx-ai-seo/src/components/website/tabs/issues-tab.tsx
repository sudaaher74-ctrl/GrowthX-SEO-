"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Filter,
  MoreHorizontal,
  Search,
  Sparkles,
  X,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { CrawlIssue } from "@/lib/api-client";

interface IssuesTabProps {
  issues: CrawlIssue[];
  onFixIssue: (issue: CrawlIssue) => void;
}

export function IssuesTab({ issues, onFixIssue }: IssuesTabProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSeverity, setSelectedSeverity] = useState("ALL");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const issue of issues) {
      if (issue.category) set.add(issue.category.replace(/_/g, " "));
    }
    return Array.from(set);
  }, [issues]);

  const filtered = useMemo(() => {
    let list = [...issues];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (i) =>
          i.issueType.toLowerCase().includes(q) ||
          i.description.toLowerCase().includes(q) ||
          i.affectedUrl.toLowerCase().includes(q)
      );
    }
    if (selectedSeverity !== "ALL") {
      list = list.filter((i) => i.severity === selectedSeverity);
    }
    if (selectedCategory !== "ALL") {
      list = list.filter((i) => (i.category || "General").replace(/_/g, " ").toLowerCase() === selectedCategory.toLowerCase());
    }
    return list;
  }, [issues, searchQuery, selectedSeverity, selectedCategory]);

  const severityTone = (sev: string) => {
    switch (sev) {
      case "CRITICAL":
        return "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400";
      case "HIGH":
        return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400";
      case "MEDIUM":
        return "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400";
      default:
        return "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300";
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200/80 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
        {/* Table Header */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">All Detected Issues</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {issues.length} audit issues flagged by crawler inspection engines.
          </p>
        </div>

        {/* Toolbar */}
        <div className="p-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search issue or URL..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
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

            <select
              value={selectedSeverity}
              onChange={(e) => setSelectedSeverity(e.target.value)}
              className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
            >
              <option value="ALL">All Severities</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>

            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
            >
              <option value="ALL">All Categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => {
              setToastMessage(`Added ${filtered.length} audit issues to your 30-Day Fix Plan!`);
              setTimeout(() => setToastMessage(null), 8000);
            }}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition shadow-xs"
          >
            <Zap size={12} />
            <span>Add {filtered.length} Issues to Fix Plan</span>
          </button>
        </div>

        {/* Fix Plan Staging Toast */}
        {toastMessage && (
          <div className="m-3 p-3 rounded-xl bg-purple-950 text-white text-xs flex items-center justify-between gap-3 shadow-md animate-in fade-in duration-200">
            <div className="flex items-center gap-2">
              <Zap size={14} className="text-purple-400 shrink-0" />
              <span>{toastMessage} Consolidated for single-approval 30-day execution.</span>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/fix-engine"
                className="px-2.5 py-1 rounded-md bg-white text-purple-950 font-bold text-[11px] hover:bg-purple-50 transition"
              >
                View in Fix Engine →
              </Link>
              <button
                type="button"
                onClick={() => setToastMessage(null)}
                className="text-purple-300 hover:text-white p-0.5"
              >
                <X size={13} />
              </button>
            </div>
          </div>
        )}

        {/* Issue Rows */}
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">
            No issues match the selected filters.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {filtered.map((issue) => {
              const isExpanded = expandedId === issue.id;
              return (
                <div key={issue.id} className="p-4 hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span
                          className={cn(
                            "rounded-md px-2 py-0.5 text-[10px] font-bold border uppercase",
                            severityTone(issue.severity)
                          )}
                        >
                          {issue.severity}
                        </span>
                        <span className="rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:text-slate-300 uppercase">
                          {issue.category || "General"}
                        </span>
                        <span className="text-xs font-bold text-slate-900 dark:text-white">
                          {issue.issueType.replace(/_/g, " ")}
                        </span>
                      </div>

                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                        {issue.description}
                      </p>

                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-[11px] text-slate-400">Affected URL:</span>
                        <a
                          href={issue.affectedUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="font-mono text-[11px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                        >
                          <span className="truncate max-w-sm">{issue.affectedUrl}</span>
                          <ExternalLink size={10} />
                        </a>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          onFixIssue(issue);
                          setToastMessage(`Added "${issue.issueType.replace(/_/g, " ")}" to your 30-Day Fix Plan!`);
                          setTimeout(() => setToastMessage(null), 8000);
                        }}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 text-xs font-semibold shadow-xs transition-colors"
                      >
                        <Zap size={12} />
                        <span>Add to Fix Plan</span>
                      </button>

                      {issue.recommendation && (
                        <button
                          type="button"
                          onClick={() => setExpandedId(isExpanded ? null : issue.id)}
                          className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-1.5 text-slate-600 hover:bg-slate-50 transition"
                          title="Toggle Recommendation"
                        >
                          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Recommendation Box */}
                  {isExpanded && issue.recommendation && (
                    <div className="mt-3 rounded-lg bg-slate-50 dark:bg-slate-800/80 p-3 border border-slate-200/70 dark:border-slate-700 text-xs">
                      <p className="font-semibold text-blue-600 dark:text-blue-400 text-[11px] uppercase tracking-wider mb-1">
                        AI Recommended Solution:
                      </p>
                      <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                        {issue.recommendation}
                      </p>
                      {issue.evidence && (
                        <pre className="mt-2 p-2 rounded bg-slate-900 text-slate-100 font-mono text-[10px] overflow-x-auto">
                          {issue.evidence}
                        </pre>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
