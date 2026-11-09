"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Layers,
  Search,
  Wrench,
  X,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { CrawlIssue } from "@/lib/api-client";

interface IssuesTabProps {
  issues: CrawlIssue[];
}

export function IssuesTab({ issues }: IssuesTabProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSeverity, setSelectedSeverity] = useState("ALL");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [onlyAutoFix, setOnlyAutoFix] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const isAutoFixable = (issue: CrawlIssue) => {
    const type = (issue.issueType || "").toUpperCase();
    const cat = (issue.category || "").toUpperCase();
    return (
      type.includes("TITLE") ||
      type.includes("META") ||
      type.includes("CANONICAL") ||
      type.includes("ROBOT") ||
      type.includes("SCHEMA") ||
      type.includes("VIEWPORT") ||
      cat.includes("META") ||
      cat.includes("CONTENT")
    );
  };

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const issue of issues) {
      if (issue.category) set.add(issue.category.replace(/_/g, " "));
    }
    return Array.from(set);
  }, [issues]);

  const criticalHighCount = useMemo(
    () => issues.filter((i) => i.severity === "CRITICAL" || i.severity === "HIGH").length,
    [issues]
  );

  const autoFixableCount = useMemo(
    () => issues.filter(isAutoFixable).length,
    [issues]
  );

  const uniqueAffectedUrls = useMemo(() => {
    const set = new Set<string>();
    for (const issue of issues) {
      if (issue.affectedUrl) set.add(issue.affectedUrl);
    }
    return set;
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
    if (onlyAutoFix) {
      list = list.filter(isAutoFixable);
    }
    return list;
  }, [issues, searchQuery, selectedSeverity, selectedCategory, onlyAutoFix]);

  const severityTone = (sev: string) => {
    switch (sev) {
      case "CRITICAL":
        return "bg-error-50 text-error-700 border-error-200";
      case "HIGH":
        return "bg-warning-50 text-warning-700 border-warning-200";
      case "MEDIUM":
        return "bg-accent-50 text-accent-700 border-accent-200";
      default:
        return "bg-brand-100 text-brand-700 border-brand-200";
    }
  };

  return (
    <div className="space-y-4">
      {/* Executive Issue Summary Ribbon */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-xl border border-error-200/80 bg-surface-1 p-3.5 shadow-2xs">
          <div className="flex items-center justify-between text-brand-400">
            <span className="text-[10px] font-bold uppercase tracking-wider text-error-700">Urgent Attention</span>
            <AlertTriangle size={14} className="text-error-600" />
          </div>
          <p className="mt-1 text-[20px] font-bold text-error-700 leading-tight">
            {criticalHighCount} {criticalHighCount === 1 ? "defect" : "defects"}
          </p>
          <p className="mt-0.5 text-[11px] text-brand-500">
            Critical or High severity holding back rankings
          </p>
        </div>

        <div className="rounded-xl border border-brand-200/80 bg-surface-1 p-3.5 shadow-2xs">
          <div className="flex items-center justify-between text-brand-400">
            <span className="text-[10px] font-bold uppercase tracking-wider text-brand-500">Auto-Fix Ready</span>
            <Zap size={14} className="text-warning-500 fill-warning-500" />
          </div>
          <p className="mt-1 text-[20px] font-bold text-brand-950 leading-tight">
            {autoFixableCount} {autoFixableCount === 1 ? "issue" : "issues"}
          </p>
          <p className="mt-0.5 text-[11px] text-brand-500">
            Deterministic metadata, tag &amp; schema fixes
          </p>
        </div>

        <div className="rounded-xl border border-brand-200/80 bg-surface-1 p-3.5 shadow-2xs">
          <div className="flex items-center justify-between text-brand-400">
            <span className="text-[10px] font-bold uppercase tracking-wider text-brand-500">Audit Scope</span>
            <Layers size={14} className="text-brand-400" />
          </div>
          <p className="mt-1 text-[20px] font-bold text-brand-950 leading-tight">
            {uniqueAffectedUrls.size} {uniqueAffectedUrls.size === 1 ? "page" : "pages"}
          </p>
          <p className="mt-0.5 text-[11px] text-brand-500">
            Affected across {issues.length} total findings
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-brand-200 bg-surface-1 shadow-2xs overflow-hidden">
        {/* Table Header */}
        <div className="p-4 border-b border-brand-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-brand-950">All Detected Issues</h3>
            <p className="text-xs text-brand-500 mt-0.5">
              {issues.length} audit issues flagged by crawler inspection engines.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setOnlyAutoFix(!onlyAutoFix)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition border",
                onlyAutoFix
                  ? "bg-signal-400 text-signal-ink border-signal-500 font-bold"
                  : "bg-surface-2 text-brand-700 border-brand-200 hover:bg-surface-1"
              )}
            >
              <Zap size={12} className={onlyAutoFix ? "text-signal-ink" : "text-warning-500 fill-warning-500"} />
              <span>Auto-Fix Only ({autoFixableCount})</span>
            </button>
            <Link
              href="/fix-engine"
              className="inline-flex items-center gap-1.5 whitespace-nowrap px-3.5 py-1.5 rounded-lg bg-signal-400 hover:bg-signal-500 text-signal-ink text-xs font-bold transition shadow-2xs"
            >
              <span>Stage in Fix Engine</span>
              <ArrowRight size={12} />
            </Link>
          </div>
        </div>

        {/* Toolbar */}
        <div className="p-3 border-b border-brand-100 bg-brand-50/40 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-brand-400" />
              <input
                type="text"
                placeholder="Search issue or URL..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 w-48 sm:w-60 rounded-lg border border-brand-200 bg-surface-1 pl-8 pr-3 text-xs text-brand-950 placeholder:text-brand-400 focus:outline-none focus:ring-1 focus:ring-primary-500"
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

            <select
              value={selectedSeverity}
              onChange={(e) => setSelectedSeverity(e.target.value)}
              className="h-8 rounded-lg border border-brand-200 bg-surface-1 px-2.5 text-xs font-medium text-brand-700 focus:outline-none focus:ring-1 focus:ring-primary-500"
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
              className="h-8 rounded-lg border border-brand-200 bg-surface-1 px-2.5 text-xs font-medium text-brand-700 focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              <option value="ALL">All Categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <span className="text-[11px] font-medium text-brand-500">
            Showing {filtered.length} of {issues.length}
          </span>
        </div>

        {/* Issue Rows */}
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-xs text-brand-400">
            No issues match the selected filters.
          </div>
        ) : (
          <div className="divide-y divide-brand-100">
            {filtered.map((issue) => {
              const isExpanded = expandedId === issue.id;
              const autoFix = isAutoFixable(issue);
              return (
                <div key={issue.id} className="p-4 hover:bg-brand-50/30 transition">
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
                        <span className="rounded-md bg-brand-100 px-2 py-0.5 text-[10px] font-semibold text-brand-700 uppercase">
                          {issue.category || "General"}
                        </span>
                        {autoFix && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-signal-400/15 text-signal-ink border border-signal-400/30 px-2 py-0.5 text-[9.5px] font-bold">
                            <Zap size={10} className="text-signal-400" />
                            1-Click AI Fix
                          </span>
                        )}
                        <span className="text-xs font-bold text-brand-950">
                          {issue.issueType.replace(/_/g, " ")}
                        </span>
                      </div>

                      <p className="text-xs text-brand-600 mt-1 leading-relaxed">
                        {issue.description}
                      </p>

                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-[11px] text-brand-400">Affected URL:</span>
                        <a
                          href={issue.affectedUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="font-mono text-[11px] text-primary-600 hover:underline flex items-center gap-1"
                        >
                          <span className="truncate max-w-sm sm:max-w-md">{issue.affectedUrl}</span>
                          <ExternalLink size={10} />
                        </a>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {autoFix && (
                        <Link
                          href="/fix-engine"
                          className="inline-flex items-center gap-1 rounded-lg border border-brand-200 bg-surface-1 px-2.5 py-1 text-[11px] font-semibold text-brand-800 hover:bg-brand-50 transition shadow-2xs"
                        >
                          <span>Stage Fix</span>
                          <ArrowRight size={10} />
                        </Link>
                      )}
                      {issue.recommendation && (
                        <button
                          type="button"
                          onClick={() => setExpandedId(isExpanded ? null : issue.id)}
                          className="rounded-lg border border-brand-200 bg-surface-1 p-1.5 text-brand-600 hover:bg-brand-50 transition cursor-pointer"
                          title="Toggle Recommendation"
                        >
                          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Recommendation Box */}
                  {isExpanded && issue.recommendation && (
                    <div className="mt-3 rounded-xl bg-brand-50/60 p-3.5 border border-brand-200/70 text-xs space-y-2">
                      <div className="flex items-center gap-1.5 text-brand-950">
                        <Wrench size={13} className="text-brand-500" />
                        <p className="font-bold text-[11px] uppercase tracking-wider">
                          Recommended Solution
                        </p>
                      </div>
                      <p className="text-brand-700 leading-relaxed">
                        {issue.recommendation}
                      </p>
                      {issue.evidence && (
                        <pre className="p-2.5 rounded-lg bg-surface-1 border border-brand-200 text-brand-800 font-mono text-[10.5px] overflow-x-auto">
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
