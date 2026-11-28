"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Code2,
  Copy,
  ExternalLink,
  HelpCircle,
  Layers,
  Lightbulb,
  MessageSquare,
  Search,
  UserCheck,
  Wrench,
  X,
} from "lucide-react";
import { useWorkspace } from "@/hooks/use-growthx";
import type { CrawlIssue, IssueSeverity } from "@/lib/api-client";
import {
  GUIDE_PLATFORMS,
  getIssueFixGuide,
  type GuidePlatform,
} from "@/lib/issue-fix-guides";
import { SEVERITY_PLAIN } from "@/lib/plain-language";
import { useSubscription } from "@/lib/subscription-engine";
import { cn } from "@/lib/utils";

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

interface IssuesTabProps {
  issues: CrawlIssue[];
  onInspectUrl?: (url: string) => void;
}

type BusinessTier = "MONEY" | "GROWTH" | "UTILITY";

function classifyBusinessTier(url: string): BusinessTier {
  const lower = (url || "").toLowerCase();
  if (/\/(cart|checkout|login|signin|signup|register|account|privacy|terms|cookie|refund|shipping-policy|app\/cart)/.test(lower)) {
    return "UTILITY";
  }
  if (/\/(blog|article|guide|news|faq|case-stud|resource|learn)/.test(lower)) {
    return "GROWTH";
  }
  return "MONEY";
}

export function IssuesTab({ issues, onInspectUrl }: IssuesTabProps) {
  const { orgId } = useWorkspace();
  const { canUseFixEngine } = useSubscription(orgId);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSeverity, setSelectedSeverity] = useState("ALL");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [onlyNoCode, setOnlyNoCode] = useState(false);
  const [hideUtilityNoise, setHideUtilityNoise] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [platform, setPlatform] = useState<GuidePlatform>(() => readSavedPlatform());
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleSelectPlatform = (next: GuidePlatform) => {
    setPlatform(next);
    try {
      localStorage.setItem(PLATFORM_STORAGE_KEY, next);
    } catch {
      // Ignore storage errors
    }
  };

  const copyText = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey((curr) => (curr === key ? null : curr)), 2000);
    } catch {
      // Clipboard unavailable
    }
  };

  const enriched = useMemo(
    () =>
      issues.map((issue) => ({
        issue,
        displayTitle: formatIssueTitle(issue.issueType),
        guide: getIssueFixGuide({
          title: formatIssueTitle(issue.issueType),
          issueType: issue.issueType,
          summary: issue.description,
          recommendedAction: issue.recommendation,
          affectedPages: issue.affectedUrl ? [issue.affectedUrl] : [],
        }),
      })),
    [issues],
  );

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const { issue } of enriched) {
      if (issue.category) set.add(issue.category.replace(/_/g, " "));
    }
    return Array.from(set);
  }, [enriched]);

  const criticalHighCount = useMemo(
    () => enriched.filter(({ issue }) => issue.severity === "CRITICAL" || issue.severity === "HIGH").length,
    [enriched],
  );

  const noCodeCount = useMemo(
    () => enriched.filter(({ guide }) => guide.difficulty === "no_code").length,
    [enriched],
  );

  const uniqueAffectedUrls = useMemo(() => {
    const set = new Set<string>();
    for (const { issue } of enriched) {
      if (issue.affectedUrl) set.add(issue.affectedUrl);
    }
    return set;
  }, [enriched]);

  const filtered = useMemo(() => {
    let list = enriched;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        ({ issue, displayTitle }) =>
          displayTitle.toLowerCase().includes(q) ||
          issue.issueType.toLowerCase().includes(q) ||
          issue.description.toLowerCase().includes(q) ||
          issue.affectedUrl.toLowerCase().includes(q),
      );
    }
    if (selectedSeverity !== "ALL") {
      list = list.filter(({ issue }) => issue.severity === selectedSeverity);
    }
    if (selectedCategory !== "ALL") {
      list = list.filter(
        ({ issue }) =>
          (issue.category || "General").replace(/_/g, " ").toLowerCase() ===
          selectedCategory.toLowerCase(),
      );
    }
    if (onlyNoCode) {
      list = list.filter(({ guide }) => guide.difficulty === "no_code");
    }
    if (hideUtilityNoise) {
      list = list.filter(({ issue }) => classifyBusinessTier(issue.affectedUrl) !== "UTILITY" || issue.severity === "CRITICAL");
    }
    return list;
  }, [enriched, searchQuery, selectedSeverity, selectedCategory, onlyNoCode, hideUtilityNoise]);

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

  const severityPlainLabel = (sev: string) =>
    SEVERITY_PLAIN[sev as IssueSeverity]?.label ?? sev;

  return (
    <div className="space-y-4">
      {/* Executive Issue Summary Strip */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-error-200/70 bg-surface-1 p-4 shadow-2xs">
          <div className="flex items-center justify-between text-brand-400">
            <span className="text-[10.5px] font-bold uppercase tracking-wider text-error-700">
              Urgent &amp; Important
            </span>
            <AlertTriangle size={14} className="text-error-600" />
          </div>
          <p className="mt-1.5 font-mono text-2xl font-bold text-error-700 leading-tight tabular-nums">
            {criticalHighCount}
          </p>
          <p className="mt-0.5 text-[11.5px] text-brand-500">
            High-priority issues holding back Google visibility
          </p>
        </div>

        <div className="rounded-2xl border border-brand-200/80 bg-surface-1 p-4 shadow-2xs">
          <div className="flex items-center justify-between text-brand-400">
            <span className="text-[10.5px] font-bold uppercase tracking-wider text-brand-500">
              No Coding Needed
            </span>
            <UserCheck size={14} className="text-success-500" />
          </div>
          <p className="mt-1.5 font-mono text-2xl font-bold text-brand-950 leading-tight tabular-nums">
            {noCodeCount}
          </p>
          <p className="mt-0.5 text-[11.5px] text-brand-500">
            Quick DIY fixes you can do inside your website editor
          </p>
        </div>

        <div className="rounded-2xl border border-brand-200/80 bg-surface-1 p-4 shadow-2xs">
          <div className="flex items-center justify-between text-brand-400">
            <span className="text-[10.5px] font-bold uppercase tracking-wider text-brand-500">
              Affected Pages
            </span>
            <Layers size={14} className="text-brand-400" />
          </div>
          <p className="mt-1.5 font-mono text-2xl font-bold text-brand-950 leading-tight tabular-nums">
            {uniqueAffectedUrls.size}
          </p>
          <p className="mt-0.5 text-[11.5px] text-brand-500">
            Across {issues.length} total detected findings
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-brand-200/80 bg-surface-1 shadow-2xs overflow-hidden">
        {/* Table Header */}
        <div className="flex flex-col gap-3 border-b border-brand-100 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-bold text-brand-950">All Detected Problems</h3>
            <p className="mt-0.5 text-xs text-brand-500">
              Click any problem to read a plain-English explanation and step-by-step fix guide for your website platform.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setHideUtilityNoise(!hideUtilityNoise)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition cursor-pointer",
                hideUtilityNoise
                  ? "bg-success-50 text-success-700 border-success-200/70 font-bold"
                  : "bg-surface-2 text-brand-700 border-brand-200 hover:bg-surface-1",
              )}
            >
              <span>{hideUtilityNoise ? "Money & Growth Focus ✓" : "Showing Utility Pages"}</span>
            </button>
            <button
              type="button"
              onClick={() => setOnlyNoCode(!onlyNoCode)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition cursor-pointer",
                onlyNoCode
                  ? "bg-signal-400 text-signal-ink border-signal-400 font-bold"
                  : "bg-surface-2 text-brand-700 border-brand-200 hover:bg-surface-1",
              )}
            >
              <UserCheck size={12} />
              <span>No coding ({noCodeCount})</span>
            </button>
            <Link
              href="/fix-engine"
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-signal-400 px-3.5 py-1.5 text-xs font-bold text-signal-ink shadow-2xs transition hover:bg-signal-500"
            >
              <span>{canUseFixEngine ? "Open Fix Engine" : "Open Action Plan"}</span>
              <ArrowRight size={12} />
            </Link>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-brand-100 bg-surface-2/60 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-brand-400" />
              <input
                type="text"
                placeholder="Search issue or page URL..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 w-48 sm:w-60 rounded-lg border border-brand-200 bg-surface-1 pl-8 pr-7 text-xs text-brand-950 placeholder:text-brand-400 focus:outline-none focus:ring-1 focus:ring-signal-400"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  aria-label="Clear issue search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-brand-400 hover:text-brand-950 cursor-pointer"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            <select
              value={selectedSeverity}
              onChange={(e) => setSelectedSeverity(e.target.value)}
              aria-label="Filter by priority"
              className="h-8 rounded-lg border border-brand-200 bg-surface-1 px-2.5 text-xs font-medium text-brand-700 focus:outline-none focus:ring-1 focus:ring-signal-400"
            >
              <option value="ALL">All Priorities</option>
              <option value="CRITICAL">Urgent</option>
              <option value="HIGH">Important</option>
              <option value="MEDIUM">Moderate</option>
              <option value="LOW">Minor</option>
            </select>

            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              aria-label="Filter by category"
              className="h-8 rounded-lg border border-brand-200 bg-surface-1 px-2.5 text-xs font-medium text-brand-700 focus:outline-none focus:ring-1 focus:ring-signal-400"
            >
              <option value="ALL">All Categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <span className="text-[11px] font-medium text-brand-500 tabular-nums">
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
            {filtered.map(({ issue, displayTitle, guide }) => {
              const isExpanded = expandedId === issue.id;
              return (
                <div key={issue.id} className="p-4 transition hover:bg-surface-2/40">
                  <button
                    type="button"
                    onClick={() => setExpandedId(isExpanded ? null : issue.id)}
                    aria-expanded={isExpanded}
                    className="flex w-full flex-col justify-between gap-3 text-left sm:flex-row sm:items-start cursor-pointer"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <span
                          className={cn(
                            "rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase",
                            severityTone(issue.severity),
                          )}
                        >
                          {severityPlainLabel(issue.severity)}
                        </span>
                        <span className="text-[13px] font-bold text-brand-950">
                          {displayTitle}
                        </span>
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-medium",
                            guide.difficulty === "no_code"
                              ? "bg-success-50 text-success-700"
                              : "bg-brand-100 text-brand-600",
                          )}
                        >
                          {guide.difficulty === "no_code" ? <UserCheck size={10} /> : <Wrench size={10} />}
                          <span>{guide.difficulty === "no_code" ? "No coding" : "Developer"}</span>
                        </span>
                        <span className="inline-flex items-center gap-1 font-mono text-[10.5px] text-brand-400">
                          <Clock size={10} />
                          ~{guide.estimatedTime}
                        </span>
                      </div>

                      <p className="text-xs leading-relaxed text-brand-600">{issue.description}</p>

                      {issue.affectedUrl && (
                        <p className="mt-1.5 truncate font-mono text-[11px] text-brand-400">
                          {issue.affectedUrl.replace(/^https?:\/\//, "")}
                        </p>
                      )}
                    </div>

                    <div className="flex shrink-0 items-center gap-1.5 text-xs font-semibold text-brand-700">
                      <span>{isExpanded ? "Hide Guide" : "How to Fix"}</span>
                      {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </div>
                  </button>

                  {/* Complete Plain-English Explanation & 5-Platform Fix Guide */}
                  {isExpanded && (
                    <div className="mt-4 space-y-3.5 rounded-2xl border border-brand-200/80 bg-surface-2/60 p-4">
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <div className="rounded-xl border border-brand-200/70 bg-surface-1 p-3.5 space-y-1">
                          <p className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-wider text-brand-500">
                            <HelpCircle size={12} className="text-accent-500" />
                            <span>What’s happening</span>
                          </p>
                          <p className="text-xs leading-relaxed text-brand-800">{guide.whatIsWrong}</p>
                        </div>
                        <div className="rounded-xl border border-brand-200/70 bg-surface-1 p-3.5 space-y-1">
                          <p className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-wider text-brand-500">
                            <Lightbulb size={12} className="text-warning-500" />
                            <span>Why this matters</span>
                          </p>
                          <p className="text-xs leading-relaxed text-brand-800">{guide.whyItMatters}</p>
                        </div>
                      </div>

                      {issue.affectedUrl && (
                        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-brand-200/70 bg-surface-1 px-3.5 py-2 text-xs">
                          <span className="text-[11px] font-semibold text-brand-500">Page to update:</span>
                          <a
                            href={issue.affectedUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 font-mono text-[11.5px] text-brand-900 hover:underline truncate max-w-full"
                          >
                            <span className="truncate">{issue.affectedUrl}</span>
                            <ExternalLink size={11} className="shrink-0" />
                          </a>
                        </div>
                      )}

                      {/* 5-Platform Step-by-Step Solution */}
                      <div className="rounded-xl border border-brand-200/70 bg-surface-1 p-4 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-xs font-bold text-brand-950">Step-by-step solution</p>
                          <div
                            role="tablist"
                            aria-label="Choose website platform"
                            className="inline-flex flex-wrap items-center gap-1 rounded-xl border border-brand-200/70 bg-surface-2 p-1 text-[11px]"
                          >
                            {GUIDE_PLATFORMS.map((p) => (
                              <button
                                key={p.id}
                                type="button"
                                role="tab"
                                aria-selected={platform === p.id}
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
                            <li key={idx} className="flex items-start gap-2.5 text-xs leading-relaxed text-brand-800">
                              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-signal-400/20 font-mono text-[10.5px] font-bold text-brand-950">
                                {idx + 1}
                              </span>
                              <span>{step}</span>
                            </li>
                          ))}
                        </ol>

                        {guide.exampleCode && platform === "developer" && (
                          <div className="rounded-lg border border-brand-200 bg-surface-2 p-3 space-y-1.5">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="inline-flex items-center gap-1 font-semibold text-brand-600">
                                <Code2 size={12} />
                                {guide.exampleLabel || "Example snippet"}
                              </span>
                              <button
                                type="button"
                                onClick={() => copyText(guide.exampleCode!, `snip-${issue.id}`)}
                                className="inline-flex items-center gap-1 rounded border border-brand-200 bg-surface-1 px-2 py-0.5 font-semibold text-brand-800 hover:bg-brand-100 cursor-pointer"
                              >
                                {copiedKey === `snip-${issue.id}` ? <Check size={10} /> : <Copy size={10} />}
                                <span>{copiedKey === `snip-${issue.id}` ? "Copied" : "Copy"}</span>
                              </button>
                            </div>
                            <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-[11px] text-brand-900">
                              {guide.exampleCode}
                            </pre>
                          </div>
                        )}

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

                      {/* Universal Actions: Copy for Developer / WhatsApp / Optional Agency Fix Engine */}
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => copyText(guide.developerHandoff, `dev-${issue.id}`)}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-signal-400 px-3 py-1.5 text-xs font-bold text-signal-ink shadow-2xs transition hover:bg-signal-500 cursor-pointer"
                        >
                          {copiedKey === `dev-${issue.id}` ? <Check size={12} /> : <Copy size={12} />}
                          <span>
                            {copiedKey === `dev-${issue.id}` ? "Copied for Developer!" : "Copy Fix Guide for Developer"}
                          </span>
                        </button>
                        <a
                          href={`https://wa.me/?text=${encodeURIComponent(guide.developerHandoff)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-lg border border-brand-200 bg-surface-1 px-3 py-1.5 text-xs font-semibold text-brand-800 hover:bg-brand-100 transition"
                        >
                          <MessageSquare size={12} />
                          <span>Send on WhatsApp</span>
                        </a>
                        {canUseFixEngine && (
                          <Link
                            href="/fix-engine"
                            className="inline-flex items-center gap-1 rounded-lg border border-brand-200 bg-surface-1 px-3 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-100 transition"
                          >
                            <span>Open in Fix Engine</span>
                            <ArrowRight size={11} />
                          </Link>
                        )}
                      </div>
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
