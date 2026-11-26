"use client";

import React, { useEffect, useId, useRef, useState } from "react";
import {
  BookOpen,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  HelpCircle,
  Lightbulb,
  MessageSquare,
  Search,
  X,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { CrawlIssue } from "@/lib/api-client";
import { severityTone } from "./technical-seo-helpers";
import { useWorkspace } from "@/hooks/use-growthx";
import { stagingEngine } from "@/lib/staging-engine";
import { useSubscription } from "@/lib/subscription-engine";
import {
  GUIDE_PLATFORMS,
  getIssueFixGuide,
  type GuidePlatform,
} from "@/lib/issue-fix-guides";

const PLATFORM_STORAGE_KEY = "reigel.guide_platform";

function readSavedPlatform(): GuidePlatform {
  if (typeof window === "undefined") return "wordpress";
  try {
    const saved = localStorage.getItem(PLATFORM_STORAGE_KEY) as GuidePlatform | null;
    if (saved && GUIDE_PLATFORMS.some((p) => p.id === saved)) return saved;
  } catch {
    // Ignore storage errors
  }
  return "wordpress";
}

function formatIssueTitle(raw: string): string {
  return raw
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

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
  const { orgId, projectId } = useWorkspace();
  const { canUseFixEngine } = useSubscription(orgId);

  const [inspectedIssue, setInspectedIssue] = useState<CrawlIssue | null>(null);
  const [bulkCopied, setBulkCopied] = useState(false);

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

  const handleCopySelectedForDeveloper = async () => {
    const selected = filteredIssues.filter((i) => selectedIssueIds.has(i.id));
    if (selected.length === 0) return;
    const blocks = selected.slice(0, 15).map((issue, idx) => {
      const g = getIssueFixGuide({
        title: formatIssueTitle(issue.issueType),
        issueType: issue.issueType,
        summary: issue.description,
        recommendedAction: issue.recommendation,
        affectedPages: issue.affectedUrl ? [issue.affectedUrl] : [],
      });
      return `${idx + 1}. ${formatIssueTitle(issue.issueType)} (${issue.affectedUrl})\nWhat's wrong: ${g.whatIsWrong}\nSteps:\n${g.platformSteps.developer.map((s, i) => `   ${i + 1}) ${s}`).join("\n")}`;
    });
    try {
      await navigator.clipboard.writeText(
        `Hi! Please help fix these ${selected.length} website issues:\n\n${blocks.join("\n\n")}`,
      );
      setBulkCopied(true);
      window.setTimeout(() => setBulkCopied(false), 2000);
    } catch {
      // Clipboard unavailable
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
            {totalIssuesCount} findings across {totalPagesCount} audited URLs. Click <strong>Fix Guide</strong> on any row for plain-English steps.
          </p>
        </div>
        <span className="inline-flex items-center rounded-full bg-brand-100 border border-brand-200/50 px-2.5 py-0.5 text-[11px] font-mono font-bold text-brand-950 self-start sm:self-center">
          {filteredIssues.length} matching
        </span>
      </div>

      {/* Filter Toolbar */}
      <div className="p-3 border-b border-brand-200/80 bg-surface-2 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
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

          <select
            value={selectedSeverity}
            onChange={(e) => onSeverityChange(e.target.value)}
            className="h-8 rounded-xl border border-brand-200/80 bg-surface-1 px-2.5 text-xs font-medium text-brand-950 focus:outline-none focus:ring-1 focus:ring-signal-400 cursor-pointer"
          >
            <option value="ALL">All Priorities</option>
            <option value="CRITICAL">Urgent ({severityCounts.CRITICAL})</option>
            <option value="HIGH">Important ({severityCounts.HIGH})</option>
            <option value="MEDIUM">Moderate ({severityCounts.MEDIUM})</option>
            <option value="LOW">Minor ({severityCounts.LOW})</option>
          </select>

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

          <select
            value={sortBy}
            onChange={(e) => onSortByChange(e.target.value as typeof sortBy)}
            className="h-8 rounded-xl border border-brand-200/80 bg-surface-1 px-2.5 text-xs font-medium text-brand-950 focus:outline-none focus:ring-1 focus:ring-signal-400 cursor-pointer"
          >
            <option value="impact">Sort by: Impact</option>
            <option value="severity">Sort by: Priority</option>
          </select>
        </div>
      </div>

      {/* Bulk Action Bar — Tier-aware (Developer Copy on Starter/Growth, Stage into Fix Engine on Agency) */}
      {selectedIssueIds.size > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 bg-brand-50 border-b border-brand-200/80 px-4 py-2.5 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-brand-950 font-mono">
              {selectedIssueIds.size} {selectedIssueIds.size === 1 ? "issue" : "issues"} selected
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopySelectedForDeveloper}
              className="inline-flex items-center gap-1.5 rounded-lg border border-brand-200 bg-surface-1 px-3 py-1 text-xs font-semibold text-brand-800 hover:bg-brand-100 transition cursor-pointer"
            >
              {bulkCopied ? <Check size={12} className="text-success-600" /> : <Copy size={12} />}
              <span>{bulkCopied ? "Copied for Developer!" : `Copy Fix Brief (${selectedIssueIds.size})`}</span>
            </button>
            {canUseFixEngine && (
              <button
                type="button"
                onClick={handleStageSelectedIssues}
                className="inline-flex items-center gap-1.5 rounded-lg bg-signal-400 px-3 py-1 text-xs font-bold text-signal-ink shadow-2xs hover:bg-signal-500 transition cursor-pointer"
              >
                <Zap size={12} className="text-signal-ink" />
                <span>Stage in Fix Engine ({selectedIssueIds.size})</span>
              </button>
            )}
          </div>
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
                <th className="p-3">PRIORITY</th>
                <th className="p-3">ISSUE</th>
                <th className="p-3">CATEGORY</th>
                <th className="p-3">AFFECTED PAGE</th>
                <th className="p-3 text-right pr-4">SOLUTION</th>
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
                      isSelected && "bg-brand-100/50",
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
                          severityTone(issue.severity),
                        )}
                      >
                        {issue.severity}
                      </span>
                    </td>
                    <td className="p-3 max-w-xs">
                      <div className="font-bold text-brand-950">
                        {formatIssueTitle(issue.issueType)}
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
                    <td className="p-3 max-w-[220px]">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[11px] text-brand-700 truncate">
                          {issue.affectedUrl.replace(/^https?:\/\//, "")}
                        </span>
                        <a
                          href={issue.affectedUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-brand-400 hover:text-brand-950 shrink-0 transition"
                        >
                          <ExternalLink size={11} />
                        </a>
                      </div>
                    </td>
                    <td className="p-3 pr-4 text-right">
                      <div className="inline-flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setInspectedIssue(issue)}
                          className="inline-flex items-center gap-1 rounded-md bg-signal-400 px-2.5 py-1 text-[10.5px] font-bold text-signal-ink hover:bg-signal-500 transition cursor-pointer shadow-2xs"
                        >
                          <BookOpen size={10} />
                          <span>Fix Guide</span>
                        </button>
                        {canUseFixEngine &&
                          (stagedIssueIds.has(issue.id) ? (
                            <span className="inline-flex items-center gap-1 rounded-md border border-success-200 bg-success-50 px-2 py-1 text-[10.5px] font-bold text-success-700 font-mono">
                              <CheckCircle2 size={10} className="text-success-600" />
                              <span>Staged</span>
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleStageSingleIssue(issue)}
                              className="inline-flex items-center gap-1 rounded-md border border-brand-200 bg-surface-2 px-2 py-1 text-[10.5px] font-semibold text-brand-700 hover:bg-surface-3 hover:text-brand-950 transition cursor-pointer"
                            >
                              <Zap size={10} />
                              <span>Stage</span>
                            </button>
                          ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Slide-Over Plain-English Issue Solution Drawer */}
      <TechnicalIssueGuideDrawer
        issue={inspectedIssue}
        onClose={() => setInspectedIssue(null)}
      />
    </div>
  );
}

function TechnicalIssueGuideDrawer({
  issue,
  onClose,
}: {
  issue: CrawlIssue | null;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const titleId = useId();
  const [platform, setPlatform] = useState<GuidePlatform>(() => readSavedPlatform());
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (issue && !dialog.open) {
      dialog.showModal();
    } else if (!issue && dialog.open) {
      dialog.close();
    }
  }, [issue]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleClose = () => {
      dialog.returnValue = "";
      onClose();
    };
    dialog.addEventListener("close", handleClose);
    return () => dialog.removeEventListener("close", handleClose);
  }, [onClose]);

  const title = issue ? formatIssueTitle(issue.issueType) : "";
  const guide = issue
    ? getIssueFixGuide({
        title,
        issueType: issue.issueType,
        summary: issue.description,
        recommendedAction: issue.recommendation,
        affectedPages: issue.affectedUrl ? [issue.affectedUrl] : [],
      })
    : null;

  const handleSelectPlatform = (next: GuidePlatform) => {
    setPlatform(next);
    try {
      localStorage.setItem(PLATFORM_STORAGE_KEY, next);
    } catch {
      // Ignore storage errors
    }
  };

  const handleCopy = async () => {
    if (!guide) return;
    try {
      await navigator.clipboard.writeText(guide.developerHandoff);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable
    }
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      {...({ closedby: "any" } as Record<string, string>)}
      className="traffic-inspector-dialog border-l border-brand-200"
    >
      {issue && guide && (
        <>
          <div className="flex items-start justify-between gap-4 border-b border-brand-100 px-6 py-5">
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium text-brand-500">
                <span className="font-semibold text-brand-800">{guide.difficultyLabel}</span>
                <span>·</span>
                <span className="inline-flex items-center gap-1 font-mono">
                  <Clock size={11} />
                  ~{guide.estimatedTime}
                </span>
              </div>
              <h2 id={titleId} className="text-base font-bold text-brand-950">
                {title}
              </h2>
            </div>
            <form method="dialog">
              <button
                type="submit"
                autoFocus
                aria-label="Close guide"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-brand-400 hover:bg-brand-100 hover:text-brand-950 transition cursor-pointer"
              >
                <X size={16} />
              </button>
            </form>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            <div className="space-y-1.5">
              <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-brand-400">
                <HelpCircle size={12} className="text-accent-500" />
                <span>What’s happening</span>
              </p>
              <p className="text-[13px] leading-relaxed text-brand-800">{guide.whatIsWrong}</p>
            </div>

            <div className="rounded-xl border border-brand-200/70 bg-surface-2 p-4 space-y-1.5">
              <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-brand-500">
                <Lightbulb size={12} className="text-warning-500" />
                <span>Why this matters</span>
              </p>
              <p className="text-[12.5px] leading-relaxed text-brand-800">{guide.whyItMatters}</p>
            </div>

            {issue.affectedUrl && (
              <div className="space-y-1">
                <p className="text-[11px] font-bold uppercase tracking-wider text-brand-400">
                  Page to update
                </p>
                <a
                  href={issue.affectedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 font-mono text-xs text-brand-900 hover:underline break-all"
                >
                  <span>{issue.affectedUrl}</span>
                  <ExternalLink size={12} className="shrink-0" />
                </a>
              </div>
            )}

            <div className="space-y-3">
              <div className="space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-wider text-brand-400">
                  Step-by-step solution
                </p>
                <div className="inline-flex flex-wrap items-center gap-1 rounded-xl border border-brand-200/70 bg-surface-2 p-1 text-[11px]">
                  {GUIDE_PLATFORMS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleSelectPlatform(p.id)}
                      className={cn(
                        "rounded-lg px-2 py-1 font-semibold transition cursor-pointer",
                        platform === p.id
                          ? "bg-signal-400 text-signal-ink font-bold shadow-2xs"
                          : "text-brand-600 hover:text-brand-950",
                      )}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <ol className="space-y-2">
                {guide.platformSteps[platform].map((step, idx) => (
                  <li key={idx} className="flex items-start gap-2.5 text-[12.5px] leading-relaxed text-brand-800">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-signal-400/20 font-mono text-[10.5px] font-bold text-brand-950">
                      {idx + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>

              {guide.verifySteps.length > 0 && (
                <div className="space-y-1 border-t border-brand-100 pt-2.5">
                  {guide.verifySteps.map((v, idx) => (
                    <p key={idx} className="flex items-start gap-1.5 text-[11.5px] text-brand-500">
                      <CheckCircle2 size={12} className="mt-0.5 shrink-0 text-success-600" />
                      <span>{v}</span>
                    </p>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-brand-100 px-6 py-4">
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 rounded-xl bg-signal-400 px-4 py-2 text-xs font-bold text-signal-ink shadow-xs hover:bg-signal-500 transition cursor-pointer"
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
              <span>{copied ? "Copied for Developer!" : "Copy Fix Guide for Developer"}</span>
            </button>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(guide.developerHandoff)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl border border-brand-200 bg-surface-1 px-3 py-2 text-xs font-semibold text-brand-800 hover:bg-brand-100 transition"
            >
              <MessageSquare size={13} />
              <span>Send on WhatsApp</span>
            </a>
          </div>
        </>
      )}
    </dialog>
  );
}
