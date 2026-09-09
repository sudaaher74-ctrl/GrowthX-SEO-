"use client";

import React, { useMemo, useState } from "react";
import {
  Activity,
  ArrowRight,
  ArrowRightLeft,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Compass,
  ExternalLink,
  FileCode,
  Globe,
  Layers,
  Lightbulb,
  Lock,
  MoreHorizontal,
  Search,
  Shield,
  Smartphone,
  Sparkles,
  X,
  Zap,
} from "lucide-react";
import { cn, formatRelativeTime } from "@/lib/utils";
import type { CrawlIssue, CrawlJob, CrawlPage, CrawlQualityDiagnostics } from "@/lib/api-client";
import { DonutChart } from "../donut-chart";
import { GaugeScore } from "../gauge-score";

interface TechnicalSeoTabProps {
  crawl: CrawlJob | null;
  issues: CrawlIssue[];
  pages: CrawlPage[];
  qualityDiagnostics?: CrawlQualityDiagnostics | null;
  historyRuns?: { pagesCrawled: number; issuesFound: number }[];
  onSwitchTab: (tab: string) => void;
  onFixIssue: (issue: CrawlIssue) => void;
  onOpenLogs?: () => void;
  onOpenRecommendations?: () => void;
}

export function TechnicalSeoTab({
  crawl,
  issues,
  pages,
  qualityDiagnostics,
  historyRuns = [],
  onSwitchTab,
  onFixIssue,
  onOpenLogs,
  onOpenRecommendations,
}: TechnicalSeoTabProps) {
  // Filter and search states
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSeverity, setSelectedSeverity] = useState("ALL");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [selectedPageUrl, setSelectedPageUrl] = useState("ALL");
  const [sortBy, setSortBy] = useState<"impact" | "severity" | "pages">("impact");
  const [selectedIssueIds, setSelectedIssueIds] = useState<Set<string>>(new Set());

  // 1. Health Score
  const healthScore = crawl?.healthScore != null ? Math.round(crawl.healthScore) : null;

  // 2. Crawlability %
  const totalDiscovered = qualityDiagnostics?.urlsDiscovered || pages.length || 1;
  const blockedCount =
    qualityDiagnostics?.robotsBlocked ??
    issues.filter((i) => (i.issueType || "").toUpperCase().includes("ROBOT")).length;
  const errorPagesCount = pages.filter((p) => p.statusCode >= 400).length;
  const crawlabilityPercent =
    qualityDiagnostics?.crawlCoveragePercent ??
    (pages.length > 0
      ? Math.max(0, Math.min(100, Math.round(((pages.length - errorPagesCount) / pages.length) * 100)))
      : 0);

  // Delta vs last crawl
  const lastRun = historyRuns.length >= 2 ? historyRuns[historyRuns.length - 2] : null;
  const currentRun = historyRuns.length >= 1 ? historyRuns[historyRuns.length - 1] : null;
  const crawlabilityDelta =
    lastRun && currentRun && lastRun.pagesCrawled > 0
      ? Math.round(((currentRun.pagesCrawled - lastRun.pagesCrawled) / lastRun.pagesCrawled) * 100)
      : null;

  // 3. Indexability %
  const noindexIssues = issues.filter(
    (i) =>
      (i.issueType || "").toUpperCase().includes("NOINDEX") ||
      (i.description || "").toUpperCase().includes("NOINDEX")
  );
  const canonicalIssues = issues.filter(
    (i) =>
      (i.issueType || "").toUpperCase().includes("CANONICAL") ||
      (i.category || "").toUpperCase().includes("CANONICAL")
  );
  const nonIndexableCount = Math.min(
    pages.length,
    noindexIssues.length + errorPagesCount
  );
  const indexableCount = Math.max(0, pages.length - nonIndexableCount);
  const indexabilityPercent =
    pages.length > 0 ? Math.round((indexableCount / pages.length) * 100) : 0;

  // 4. Core Web Vitals Summary
  const pagesWithPerf = pages.filter((p) => p.performance?.lcpMs || p.performance?.performanceScore);
  const avgLcpMs =
    pagesWithPerf.length > 0
      ? pagesWithPerf.reduce((sum, p) => sum + (p.performance?.lcpMs || 0), 0) / pagesWithPerf.length
      : null;
  const avgInpMs =
    pagesWithPerf.length > 0
      ? pagesWithPerf.reduce((sum, p) => sum + (p.performance?.inpMs || 0), 0) / pagesWithPerf.length
      : null;
  const avgCls =
    pagesWithPerf.length > 0
      ? pagesWithPerf.reduce((sum, p) => sum + (p.performance?.clsScore || 0), 0) / pagesWithPerf.length
      : null;

  const lcpDisplay = avgLcpMs != null ? `${(avgLcpMs / 1000).toFixed(1)}s` : "—";
  const inpDisplay = avgInpMs != null ? `${Math.round(avgInpMs)}ms` : "—";
  const clsDisplay = avgCls != null ? avgCls.toFixed(2) : "—";

  const cwvOverallStatus: "Good" | "Poor" | "Needs Work" =
    avgLcpMs == null
      ? "Good"
      : avgLcpMs > 4000 || (avgInpMs != null && avgInpMs > 500) || (avgCls != null && avgCls > 0.25)
      ? "Poor"
      : avgLcpMs > 2500 || (avgInpMs != null && avgInpMs > 200) || (avgCls != null && avgCls > 0.1)
      ? "Needs Work"
      : "Good";

  // 5. HTTPS & Security
  const isHttps = pages.length > 0 ? pages.some((p) => p.url.startsWith("https://")) : true;
  const hasSslIssue = issues.some(
    (i) => (i.issueType || "").toUpperCase().includes("SSL") || (i.issueType || "").toUpperCase().includes("CERT")
  );
  const hasMixedContent = issues.some((i) => (i.issueType || "").toUpperCase().includes("MIXED"));
  const hasMalware = issues.some((i) => i.severity === "CRITICAL" && i.category === "SECURITY");
  const securityGood = isHttps && !hasSslIssue && !hasMixedContent && !hasMalware;

  // 6. Issue Distribution Donut Data
  const severityCounts = useMemo(() => {
    return {
      CRITICAL: issues.filter((i) => i.severity === "CRITICAL").length,
      HIGH: issues.filter((i) => i.severity === "HIGH").length,
      MEDIUM: issues.filter((i) => i.severity === "MEDIUM").length,
      LOW: issues.filter((i) => i.severity === "LOW").length,
    };
  }, [issues]);

  const donutData = useMemo(() => {
    return [
      { label: "Critical", value: severityCounts.CRITICAL, color: "#ef4444" },
      { label: "High", value: severityCounts.HIGH, color: "#f97316" },
      { label: "Medium", value: severityCounts.MEDIUM, color: "#3b82f6" },
      { label: "Low", value: severityCounts.LOW, color: "#94a3b8" },
    ];
  }, [severityCounts]);

  // 7. Categories Breakdown
  const categoryCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const issue of issues) {
      const cat = issue.category ? issue.category.replace(/_/g, " ") : "Other";
      map[cat] = (map[cat] || 0) + 1;
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [issues]);

  const getCategoryIcon = (name: string) => {
    const lower = name.toLowerCase();
    if (lower.includes("crawl") || lower.includes("index")) return <Globe size={13} className="text-blue-500" />;
    if (lower.includes("speed") || lower.includes("perf")) return <Zap size={13} className="text-amber-500" />;
    if (lower.includes("mobile")) return <Smartphone size={13} className="text-purple-500" />;
    if (lower.includes("structure") || lower.includes("schema")) return <FileCode size={13} className="text-emerald-500" />;
    if (lower.includes("security")) return <Shield size={13} className="text-rose-500" />;
    if (lower.includes("redirect")) return <ArrowRightLeft size={13} className="text-cyan-500" />;
    return <Layers size={13} className="text-slate-400" />;
  };

  // 8. Crawl Status duration & latency
  const durationText = useMemo(() => {
    if (qualityDiagnostics?.durationSeconds != null) {
      const s = qualityDiagnostics.durationSeconds;
      return s >= 60 ? `${Math.round(s / 60)} minutes` : `${s} seconds`;
    }
    if (crawl?.startedAt && crawl?.finishedAt) {
      const ms = new Date(crawl.finishedAt).getTime() - new Date(crawl.startedAt).getTime();
      const mins = Math.round(ms / 60000);
      return mins >= 1 ? `${mins} minutes` : `${Math.max(1, Math.round(ms / 1000))} seconds`;
    }
    return "—";
  }, [crawl, qualityDiagnostics]);

  const avgLatency =
    qualityDiagnostics?.avgResponseTimeMs != null
      ? `${qualityDiagnostics.avgResponseTimeMs.toLocaleString()} ms`
      : pages.length > 0
      ? `${Math.round(
          pages.reduce((acc, p) => acc + (p.responseTimeMs || 0), 0) / pages.length
        ).toLocaleString()} ms`
      : "—";

  // 9. Top Opportunities (Dynamically prioritized from actual crawl data)
  const topOpportunities = useMemo(() => {
    const opps: { id: string; title: string; count?: number }[] = [];
    const highIndexing = issues.filter(
      (i) => (i.severity === "HIGH" || i.severity === "CRITICAL") && (i.category || "").includes("INDEX")
    ).length;
    if (highIndexing > 0) {
      opps.push({
        id: "idx",
        title: `Fix ${highIndexing} high-priority indexing issues`,
        count: highIndexing,
      });
    }

    if (avgLcpMs != null && avgLcpMs > 2500) {
      opps.push({
        id: "cwv",
        title: `Improve Core Web Vitals (LCP is ${(avgLcpMs / 1000).toFixed(1)}s, target < 2.5s)`,
      });
    }

    const schemaCount = issues.filter((i) => (i.issueType || "").toUpperCase().includes("SCHEMA")).length;
    if (schemaCount > 0) {
      opps.push({
        id: "schema",
        title: `Add missing structured data (${schemaCount} occurrences)`,
        count: schemaCount,
      });
    }

    const brokenLinksCount = pages.filter((p) => p.statusCode >= 400).length;
    if (brokenLinksCount > 0) {
      opps.push({
        id: "links",
        title: `Fix broken internal links (${brokenLinksCount} pages returning errors)`,
        count: brokenLinksCount,
      });
    }

    const duplicateMeta = issues.filter((i) => (i.issueType || "").toUpperCase().includes("META")).length;
    if (duplicateMeta > 0) {
      opps.push({
        id: "meta",
        title: `Resolve duplicate and missing meta descriptions (${duplicateMeta} pages)`,
        count: duplicateMeta,
      });
    }

    const thinCount = pages.filter((p) => p.wordCount < 300).length;
    if (thinCount > 0) {
      opps.push({
        id: "thin",
        title: `Expand thin content pages (${thinCount} pages under 300 words)`,
        count: thinCount,
      });
    }

    return opps.slice(0, 5);
  }, [issues, avgLcpMs, pages]);

  // 10. Filtered Issues Table Data
  const filteredIssues = useMemo(() => {
    let result = [...issues];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (i) =>
          i.issueType.toLowerCase().includes(q) ||
          i.description.toLowerCase().includes(q) ||
          i.affectedUrl.toLowerCase().includes(q)
      );
    }

    if (selectedSeverity !== "ALL") {
      result = result.filter((i) => i.severity === selectedSeverity);
    }

    if (selectedCategory !== "ALL") {
      result = result.filter(
        (i) => (i.category || "Other").replace(/_/g, " ").toLowerCase() === selectedCategory.toLowerCase()
      );
    }

    if (selectedPageUrl !== "ALL") {
      result = result.filter((i) => i.affectedUrl === selectedPageUrl);
    }

    // Sort
    result.sort((a, b) => {
      if (sortBy === "severity") {
        const order: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
        return (order[b.severity] || 0) - (order[a.severity] || 0);
      }
      if (sortBy === "impact") {
        const order: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
        return (order[b.severity] || 0) - (order[a.severity] || 0);
      }
      return 0;
    });

    return result;
  }, [issues, searchQuery, selectedSeverity, selectedCategory, selectedPageUrl, sortBy]);

  // Unique URLs for the filter
  const uniquePageUrls = useMemo(() => {
    const urls = new Set<string>();
    for (const issue of issues) {
      if (issue.affectedUrl) urls.add(issue.affectedUrl);
    }
    return Array.from(urls);
  }, [issues]);

  const toggleSelectAll = () => {
    if (selectedIssueIds.size === filteredIssues.length) {
      setSelectedIssueIds(new Set());
    } else {
      setSelectedIssueIds(new Set(filteredIssues.map((i) => i.id)));
    }
  };

  const toggleSelectIssue = (id: string) => {
    const next = new Set(selectedIssueIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIssueIds(next);
  };

  const severityTone = (sev: string) => {
    switch (sev) {
      case "CRITICAL":
        return "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800/50";
      case "HIGH":
        return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/50";
      case "MEDIUM":
        return "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800/50";
      default:
        return "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700";
    }
  };

  return (
    <div className="space-y-5">
      {/* ======================================================== */}
      {/* TOP ROW: 5 KPI CARDS                                     */}
      {/* ======================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* 1. Technical Health Score */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between sm:col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              <Shield size={14} className="text-blue-600" />
              <span>Technical Health</span>
            </div>
            <span
              className={cn(
                "rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                healthScore == null
                  ? "bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-800"
                  : healthScore >= 80
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/50"
                  : healthScore >= 50
                  ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/50"
                  : "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800/50"
              )}
            >
              {healthScore == null
                ? "Not Crawled"
                : healthScore >= 80
                ? "Good Health"
                : healthScore >= 50
                ? "Needs Work"
                : "Critical Issues"}
            </span>
          </div>
          <GaugeScore
            score={healthScore}
            maxScore={100}
            statusText={
              healthScore == null
                ? "Not Crawled"
                : healthScore >= 80
                ? "Good Health"
                : healthScore >= 50
                ? "Needs Work"
                : "Critical Issues"
            }
            statusTone={
              healthScore == null
                ? "info"
                : healthScore >= 80
                ? "good"
                : healthScore >= 50
                ? "warn"
                : "bad"
            }
            showBadge={false}
            description={
              healthScore == null
                ? "Scan to analyze health"
                : severityCounts.CRITICAL > 0
                ? `${severityCounts.CRITICAL} critical issues found`
                : "Baseline parameters normal"
            }
            buttonText="View Recommendations"
            onButtonClick={() => {
              const el = document.getElementById("technical-issues-table");
              if (el) el.scrollIntoView({ behavior: "smooth" });
            }}
          />
        </div>

        {/* 2. Crawlability */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
              <div className="flex items-center gap-1.5">
                <Compass size={14} className="text-blue-600" />
                <span>Crawlability</span>
              </div>
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                {crawl ? `${crawlabilityPercent}%` : "—"}
              </span>
              {crawlabilityDelta !== null && (
                <span
                  className={cn(
                    "text-xs font-semibold flex items-center",
                    crawlabilityDelta >= 0 ? "text-emerald-600" : "text-rose-600"
                  )}
                >
                  {crawlabilityDelta >= 0 ? "↑" : "↓"} {Math.abs(crawlabilityDelta)}%
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {blockedCount} blocked / {errorPagesCount} errors
            </p>
          </div>
          <div className="mt-4">
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                style={{ width: `${crawlabilityPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* 3. Indexability */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
              <div className="flex items-center gap-1.5">
                <Layers size={14} className="text-blue-600" />
                <span>Indexability</span>
              </div>
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                {crawl ? `${indexabilityPercent}%` : "—"}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {noindexIssues.length} noindex / {canonicalIssues.length} canonical issues
            </p>
          </div>
          <div className="mt-4">
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className="h-full rounded-full bg-amber-500 transition-all duration-500"
                style={{ width: `${indexabilityPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* 4. Core Web Vitals */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <Activity size={14} className="text-blue-600" />
                <span>Core Web Vitals</span>
              </div>
              <span
                className={cn(
                  "rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                  cwvOverallStatus === "Good"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : cwvOverallStatus === "Needs Work"
                    ? "bg-amber-50 text-amber-700 border-amber-200"
                    : "bg-rose-50 text-rose-700 border-rose-200"
                )}
              >
                {cwvOverallStatus}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-1.5 mt-2">
              <div className="rounded-lg bg-slate-50 dark:bg-slate-800/60 p-2 text-center">
                <span className="text-[10px] font-medium text-slate-400 uppercase">LCP</span>
                <p
                  className={cn(
                    "font-mono text-xs font-bold mt-0.5",
                    avgLcpMs == null ? "text-slate-500" : avgLcpMs <= 2500 ? "text-emerald-600" : "text-rose-600"
                  )}
                >
                  {lcpDisplay}
                </p>
              </div>
              <div className="rounded-lg bg-slate-50 dark:bg-slate-800/60 p-2 text-center">
                <span className="text-[10px] font-medium text-slate-400 uppercase">INP</span>
                <p
                  className={cn(
                    "font-mono text-xs font-bold mt-0.5",
                    avgInpMs == null ? "text-slate-500" : avgInpMs <= 200 ? "text-emerald-600" : "text-amber-600"
                  )}
                >
                  {inpDisplay}
                </p>
              </div>
              <div className="rounded-lg bg-slate-50 dark:bg-slate-800/60 p-2 text-center">
                <span className="text-[10px] font-medium text-slate-400 uppercase">CLS</span>
                <p
                  className={cn(
                    "font-mono text-xs font-bold mt-0.5",
                    avgCls == null ? "text-slate-500" : avgCls <= 0.1 ? "text-emerald-600" : "text-amber-600"
                  )}
                >
                  {clsDisplay}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 text-right">
            <button
              type="button"
              onClick={() => onSwitchTab("performance")}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 inline-flex items-center gap-1"
            >
              <span>View Details</span>
              <ArrowRight size={12} />
            </button>
          </div>
        </div>

        {/* 5. HTTPS & Security */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <Lock size={14} className="text-blue-600" />
                <span>HTTPS & Security</span>
              </div>
              <span
                className={cn(
                  "rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                  securityGood
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : "bg-rose-50 text-rose-700 border-rose-200"
                )}
              >
                {securityGood ? "Good" : "Needs Review"}
              </span>
            </div>

            <div className="space-y-1.5 text-xs mt-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={13} className={isHttps ? "text-emerald-500" : "text-slate-300"} />
                <span className={isHttps ? "text-slate-700 dark:text-slate-300" : "text-slate-400"}>
                  HTTPS enabled
                </span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 size={13} className={!hasSslIssue ? "text-emerald-500" : "text-rose-500"} />
                <span className={!hasSslIssue ? "text-slate-700 dark:text-slate-300" : "text-rose-600 font-medium"}>
                  Valid SSL certificate
                </span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 size={13} className={!hasMixedContent ? "text-emerald-500" : "text-amber-500"} />
                <span className={!hasMixedContent ? "text-slate-700 dark:text-slate-300" : "text-amber-600"}>
                  No mixed content
                </span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 size={13} className={!hasMalware ? "text-emerald-500" : "text-rose-500"} />
                <span className={!hasMalware ? "text-slate-700 dark:text-slate-300" : "text-rose-600"}>
                  Safe browsing (no issues)
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* MIDDLE ROW: 4 CARDS                                      */}
      {/* ======================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* 1. Issue Distribution */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">Issue Distribution</h3>
            <div className="flex items-center justify-center py-1">
              <DonutChart
                data={donutData}
                centerValue={issues.length}
                centerLabel="Issues"
                size={130}
                thickness={18}
              />
            </div>
          </div>
        </div>

        {/* 2. Issue by Category */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">Issue by Category</h3>
            {categoryCounts.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">No issues categorized.</p>
            ) : (
              <div className="space-y-1.5 max-h-[190px] overflow-y-auto pr-1">
                {categoryCounts.map(([cat, count]) => (
                  <div
                    key={cat}
                    onClick={() => setSelectedCategory(cat === selectedCategory ? "ALL" : cat)}
                    className={cn(
                      "flex items-center justify-between text-xs py-1 px-2 rounded-lg cursor-pointer transition-colors",
                      selectedCategory.toLowerCase() === cat.toLowerCase()
                        ? "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-semibold"
                        : "hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300"
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {getCategoryIcon(cat)}
                      <span className="truncate">{cat}</span>
                    </div>
                    <span className="rounded-full bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 px-2 py-0.5 text-[11px] font-bold">
                      {count}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 3. Crawl Status */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Crawl Status</h3>
              <span
                className={cn(
                  "rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                  crawl?.status === "COMPLETED"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : "bg-amber-50 text-amber-700 border-amber-200"
                )}
              >
                {crawl?.status || "Ready"}
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                <span>Started</span>
                <span className="font-mono text-slate-900 dark:text-white">
                  {crawl?.startedAt ? formatRelativeTime(crawl.startedAt) : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                <span>Completed</span>
                <span className="font-mono text-slate-900 dark:text-white">
                  {crawl?.finishedAt ? formatRelativeTime(crawl.finishedAt) : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                <span>Duration</span>
                <span className="font-mono text-slate-900 dark:text-white">{durationText}</span>
              </div>
              <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                <span>Pages crawled</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">
                  {pages.length.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                <span>Average latency</span>
                <span className="font-mono text-slate-900 dark:text-white">{avgLatency}</span>
              </div>
            </div>
          </div>

          <div className="mt-3 pt-2">
            <button
              type="button"
              onClick={onOpenLogs}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors inline-flex items-center justify-center gap-1"
            >
              <span>View Crawl Logs</span>
              <ArrowRight size={12} />
            </button>
          </div>
        </div>

        {/* 4. Top Opportunities */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-1.5 mb-3">
              <Lightbulb size={16} className="text-amber-500" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Top Opportunities</h3>
            </div>

            {topOpportunities.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">No critical opportunities detected.</p>
            ) : (
              <div className="space-y-2">
                {topOpportunities.map((opp, i) => (
                  <div key={opp.id} className="flex items-start gap-2 text-xs">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-50 text-[10px] font-bold text-blue-600 dark:bg-blue-950/60 dark:text-blue-400 mt-0.5">
                      {i + 1}
                    </span>
                    <span className="text-slate-700 dark:text-slate-300 leading-snug line-clamp-2">
                      {opp.title}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-3 pt-2">
            <button
              type="button"
              onClick={onOpenRecommendations}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors inline-flex items-center justify-center gap-1"
            >
              <span>View AI Recommendations</span>
              <ArrowRight size={12} />
            </button>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* BOTTOM SECTION: TECHNICAL SEO ISSUES TABLE               */}
      {/* ======================================================== */}
      <div
        id="technical-issues-table"
        className="rounded-xl border border-slate-200/80 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900 overflow-hidden"
      >
        {/* Table Header & Subtitle */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Technical SEO Issues</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {issues.length} unique issues across {pages.length} pages. Fix these to improve your technical health.
          </p>
        </div>

        {/* Filter Toolbar */}
        <div className="p-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-2">
            {/* Search Input */}
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search issues or URLs..."
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

            {/* Severity Filter */}
            <select
              value={selectedSeverity}
              onChange={(e) => setSelectedSeverity(e.target.value)}
              className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
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
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
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
                onChange={(e) => setSelectedPageUrl(e.target.value)}
                className="h-8 max-w-[180px] truncate rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
              >
                <option value="ALL">All Pages</option>
                {uniquePageUrls.map((url) => (
                  <option key={url} value={url}>
                    {url}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Sort By */}
          <div className="flex items-center gap-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
            >
              <option value="impact">Sort by: Impact</option>
              <option value="severity">Sort by: Severity</option>
            </select>
          </div>
        </div>

        {/* Table Content */}
        {filteredIssues.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">
            {searchQuery || selectedSeverity !== "ALL" || selectedCategory !== "ALL"
              ? "No issues match the selected filters."
              : "No technical issues found in this crawl."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-[11px] font-semibold uppercase tracking-wider text-slate-400 bg-slate-50/50 dark:bg-slate-900/50">
                  <th className="p-3 pl-4 w-8">
                    <input
                      type="checkbox"
                      checked={selectedIssueIds.size === filteredIssues.length && filteredIssues.length > 0}
                      onChange={toggleSelectAll}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                  </th>
                  <th className="p-3">SEVERITY</th>
                  <th className="p-3">ISSUE</th>
                  <th className="p-3">CATEGORY</th>
                  <th className="p-3 text-center">AFFECTED PAGES</th>
                  <th className="p-3">EXAMPLE URL</th>
                  <th className="p-3 text-center">IMPACT</th>
                  <th className="p-3 pr-4 text-right">ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredIssues.map((issue) => {
                  const isSelected = selectedIssueIds.has(issue.id);
                  return (
                    <tr
                      key={issue.id}
                      className={cn(
                        "hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors",
                        isSelected && "bg-blue-50/40 dark:bg-blue-950/20"
                      )}
                    >
                      <td className="p-3 pl-4">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectIssue(issue.id)}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                      </td>
                      <td className="p-3">
                        <span
                          className={cn(
                            "rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                            severityTone(issue.severity)
                          )}
                        >
                          {issue.severity}
                        </span>
                      </td>
                      <td className="p-3 max-w-xs">
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {issue.issueType.replace(/_/g, " ")}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                          {issue.description}
                        </div>
                      </td>
                      <td className="p-3">
                        <span className="rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:text-slate-300">
                          {issue.category ? issue.category.replace(/_/g, " ") : "General"}
                        </span>
                      </td>
                      <td className="p-3 text-center font-mono font-semibold text-slate-900 dark:text-white">
                        {/* If real affected count exists or 1 */}
                        {issue.page ? 1 : 1}
                      </td>
                      <td className="p-3 max-w-[200px]">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-[11px] text-blue-600 dark:text-blue-400 truncate">
                            {issue.affectedUrl}
                          </span>
                          <a
                            href={issue.affectedUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 shrink-0"
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
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => onFixIssue(issue)}
                            className="inline-flex items-center gap-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-2.5 py-1 text-xs font-semibold shadow-xs transition-colors"
                          >
                            <Sparkles size={11} />
                            <span>Fix with AI</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => onFixIssue(issue)}
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
      </div>
    </div>
  );
}
