"use client";

import React, { useMemo, useState } from "react";
import {
  Activity,
  ArrowRight,
  ArrowRightLeft,
  CheckCircle2,
  Compass,
  ExternalLink,
  FileCode,
  Globe,
  Layers,
  Lightbulb,
  Lock,
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
import { computeCrawlSummary } from "@/lib/crawl-summary";
import { GaugeScore } from "../gauge-score";
import type { WebsiteTabId } from "@/components/website/tabs/tab-id";

interface TechnicalSeoTabProps {
  crawl: CrawlJob | null;
  issues: CrawlIssue[];
  pages: CrawlPage[];
  qualityDiagnostics?: CrawlQualityDiagnostics | null;
  historyRuns?: { pagesCrawled: number; issuesFound: number }[];
  onSwitchTab: (tab: WebsiteTabId) => void;
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

  const summary = useMemo(
    () =>
      computeCrawlSummary({
        pages: pages.map((p) => ({
          url: p.url,
          statusCode: p.statusCode ?? null,
          indexability: p.indexability ?? null,
          blockedSuspected: p.blockedSuspected ?? null,
          jsRequired: p.jsRequired ?? null,
          discoverySource: p.discoverySource ?? null,
          fetchFailed: p.statusCode == null || p.statusCode === 0,
        })),
        issues: issues.map((i) => ({
          issueType: i.issueType,
          severity: i.severity,
          confidence: (i as { confidence?: string }).confidence ?? null,
          affectedUrl: i.affectedUrl ?? null,
        })),
        performance: pages.map((p) => ({
          lcpMs: p.performance?.lcpMs ?? null,
          inpMs: p.performance?.inpMs ?? null,
          clsScore: p.performance?.clsScore ?? null,
        })),
      }),
    [pages, issues]
  );

  const blockedCount = summary.blocked;
  const errorPagesCount = summary.errored;
  const unreachableCount = summary.unreachable;
  const crawlabilityPercent = summary.crawlablePercent;

  // Delta vs last crawl
  const lastRun = historyRuns.length >= 2 ? historyRuns[historyRuns.length - 2] : null;
  const currentRun = historyRuns.length >= 1 ? historyRuns[historyRuns.length - 1] : null;
  const crawlabilityDelta =
    lastRun && currentRun && lastRun.pagesCrawled > 0
      ? Math.round(((currentRun.pagesCrawled - lastRun.pagesCrawled) / lastRun.pagesCrawled) * 100)
      : null;

  const canonicalIssues = issues.filter(
    (i) =>
      (i.issueType || "").toUpperCase().includes("CANONICAL") ||
      (i.category || "").toUpperCase().includes("CANONICAL")
  );
  const nonIndexableCount = summary.nonIndexable;
  const unknownIndexabilityCount = summary.indexabilityUnknown;
  const indexabilityPercent = summary.indexablePercent;

  const cwv = summary.coreWebVitals;
  const avgLcpMs = cwv.lcpMs;
  const avgInpMs = cwv.inpMs;
  const avgCls = cwv.cls;
  const lcpDisplay = avgLcpMs != null ? `${(avgLcpMs / 1000).toFixed(1)}s` : "\u2014";
  const inpDisplay = avgInpMs != null ? `${Math.round(avgInpMs)}ms` : "\u2014";
  const clsDisplay = avgCls != null ? avgCls.toFixed(2) : "\u2014";
  const cwvOverallStatus = cwv.status;

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
      { label: "Critical", value: severityCounts.CRITICAL, color: "var(--color-error-500)" },
      { label: "High", value: severityCounts.HIGH, color: "var(--color-warning-500)" },
      { label: "Medium", value: severityCounts.MEDIUM, color: "var(--color-accent-500)" },
      { label: "Low", value: severityCounts.LOW, color: "var(--color-brand-400)" },
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
    if (lower.includes("crawl") || lower.includes("index")) return <Globe size={13} className="text-accent-500" />;
    if (lower.includes("speed") || lower.includes("perf")) return <Zap size={13} className="text-warning-500" />;
    if (lower.includes("mobile")) return <Smartphone size={13} className="text-brand-400" />;
    if (lower.includes("structure") || lower.includes("schema")) return <FileCode size={13} className="text-success-500" />;
    if (lower.includes("security")) return <Shield size={13} className="text-error-500" />;
    if (lower.includes("redirect")) return <ArrowRightLeft size={13} className="text-series-2" />;
    return <Layers size={13} className="text-brand-400" />;
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
      if (sortBy === "severity" || sortBy === "impact") {
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
        return "bg-error-50 text-error-700 border-error-200/50";
      case "HIGH":
        return "bg-warning-50 text-warning-700 border-warning-200/50";
      case "MEDIUM":
        return "bg-accent-50 text-accent-700 border-accent-200/50";
      default:
        return "bg-brand-100 text-brand-700 border-brand-200/50";
    }
  };

  const healthBadgeStyle =
    healthScore == null
      ? "bg-brand-100 text-brand-500 border-brand-200/50"
      : healthScore >= 80
      ? "bg-success-50 text-success-700 border-success-200/50"
      : healthScore >= 50
      ? "bg-warning-50 text-warning-700 border-warning-200/50"
      : "bg-error-50 text-error-700 border-error-200/50";

  const healthStatusText =
    healthScore == null
      ? "Not Crawled"
      : healthScore >= 80
      ? "Good Health"
      : healthScore >= 50
      ? "Needs Work"
      : "Critical Issues";

  const healthTone =
    healthScore == null
      ? "info"
      : healthScore >= 80
      ? "good"
      : healthScore >= 50
      ? "warn"
      : "bad";

  const cwvBadgeClass =
    cwvOverallStatus === "No data"
      ? "bg-brand-100 text-brand-500 border-brand-200/50"
      : cwvOverallStatus === "Good"
      ? "bg-success-50 text-success-700 border-success-200/50"
      : cwvOverallStatus === "Needs Work"
      ? "bg-warning-50 text-warning-700 border-warning-200/50"
      : "bg-error-50 text-error-700 border-error-200/50";

  return (
    <div className="space-y-4">
      {/* ======================================================== */}
      {/* TOP SECTION: HEALTH SCORE & 4 TECHNICAL PILLARS           */}
      {/* Balanced layout eliminating vertical voids and stretching */}
      {/* ======================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-stretch">
        {/* Left Hero Card: Technical Health Score */}
        <div
          className="lg:col-span-4 rounded-2xl border bg-surface-1 p-5 shadow-card flex flex-col justify-between"
          style={{ borderColor: "var(--border-color)" }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-100 text-brand-950 font-bold">
                <Shield size={14} className="text-signal-400" />
              </div>
              <span className="text-[12px] font-bold uppercase tracking-wider text-brand-400">
                Technical Health
              </span>
            </div>
            <span className={cn("rounded-full border px-2.5 py-0.5 text-[10.5px] font-mono font-bold", healthBadgeStyle)}>
              {healthStatusText}
            </span>
          </div>

          <div className="py-2 flex flex-col items-center">
            <GaugeScore
              score={healthScore}
              maxScore={100}
              statusText={healthStatusText}
              statusTone={healthTone}
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

          {healthScore != null && (
            <div className="border-t pt-3 mt-1 text-[11.5px]" style={{ borderColor: "var(--border-color)" }}>
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-brand-400 mb-1.5">
                <span>Score breakdown</span>
                <span className="font-mono text-brand-400">{summary.health.pagesScored} pages scored</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="rounded-lg bg-surface-2 p-2 border" style={{ borderColor: "var(--border-color)" }}>
                  <span className="text-brand-400 block text-[10px] uppercase font-mono">High impact</span>
                  <span className="font-mono font-bold text-error-600">
                    {severityCounts.HIGH} issues ({summary.health.penalties.find((p) => p.severity === "HIGH")?.penalty ? `-${summary.health.penalties.find((p) => p.severity === "HIGH")?.penalty}` : "0"})
                  </span>
                </div>
                <div className="rounded-lg bg-surface-2 p-2 border" style={{ borderColor: "var(--border-color)" }}>
                  <span className="text-brand-400 block text-[10px] uppercase font-mono">Medium impact</span>
                  <span className="font-mono font-bold text-warning-600">
                    {severityCounts.MEDIUM} issues ({summary.health.penalties.find((p) => p.severity === "MEDIUM")?.penalty ? `-${summary.health.penalties.find((p) => p.severity === "MEDIUM")?.penalty}` : "0"})
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Grid: 4 Core Pillars in tight, balanced 2x2 grid */}
        <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {/* Pillar 1: Crawlability */}
          <div
            className="rounded-2xl border bg-surface-1 p-4 shadow-card flex flex-col justify-between"
            style={{ borderColor: "var(--border-color)" }}
          >
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-brand-400">
                  <Compass size={14} className="text-signal-400" />
                  <span>Crawlability</span>
                </div>
                <span className="rounded-full border border-success-200/50 bg-success-50/50 text-success-700 px-2 py-0.5 text-[10px] font-mono font-bold">
                  {crawlabilityPercent}% Optimal
                </span>
              </div>
              <div className="mt-2.5 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold font-mono text-brand-950 tracking-tight">
                  {crawl ? `${crawlabilityPercent}%` : "—"}
                </span>
                {crawlabilityDelta !== null && (
                  <span className={cn("text-xs font-mono font-bold", crawlabilityDelta >= 0 ? "text-success-600" : "text-error-600")}>
                    {crawlabilityDelta >= 0 ? "↑" : "↓"} {Math.abs(crawlabilityDelta)}%
                  </span>
                )}
              </div>
              <p className="mt-1 text-[11.5px] text-brand-400">
                {errorPagesCount} errors · {blockedCount} blocked
                {unreachableCount > 0 ? ` · ${unreachableCount} unreachable` : ""}
              </p>
            </div>

            <div className="mt-4 pt-3 border-t" style={{ borderColor: "var(--border-color)" }}>
              <div className="flex items-center justify-between text-[11px] text-brand-400 mb-1.5 font-mono">
                <span>Search bots access</span>
                <span className="font-bold text-brand-950">{crawlabilityPercent}% reachable</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-brand-100">
                <div
                  className="h-full rounded-full bg-signal-400 transition-all duration-500"
                  style={{ width: `${crawlabilityPercent}%` }}
                />
              </div>
            </div>
          </div>

          {/* Pillar 2: Indexability */}
          <div
            className="rounded-2xl border bg-surface-1 p-4 shadow-card flex flex-col justify-between"
            style={{ borderColor: "var(--border-color)" }}
          >
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-brand-400">
                  <Layers size={14} className="text-accent-500" />
                  <span>Indexability</span>
                </div>
                <span className="rounded-full border border-accent-200/50 bg-accent-50/50 text-accent-700 px-2 py-0.5 text-[10px] font-mono font-bold">
                  {indexabilityPercent}% Indexed
                </span>
              </div>
              <div className="mt-2.5 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold font-mono text-brand-950 tracking-tight">
                  {crawl ? `${indexabilityPercent}%` : "—"}
                </span>
              </div>
              <p className="mt-1 text-[11.5px] text-brand-400">
                {nonIndexableCount} not indexable · {canonicalIssues.length} canonical issues
                {unknownIndexabilityCount > 0 ? ` · ${unknownIndexabilityCount} unknown` : ""}
              </p>
            </div>

            <div className="mt-4 pt-3 border-t" style={{ borderColor: "var(--border-color)" }}>
              <div className="flex items-center justify-between text-[11px] text-brand-400 mb-1.5 font-mono">
                <span>Search index status</span>
                <span className="font-bold text-brand-950">{indexabilityPercent}% eligible</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-brand-100">
                <div
                  className="h-full rounded-full bg-warning-500 transition-all duration-500"
                  style={{ width: `${indexabilityPercent}%` }}
                />
              </div>
            </div>
          </div>

          {/* Pillar 3: Core Web Vitals */}
          <div
            className="rounded-2xl border bg-surface-1 p-4 shadow-card flex flex-col justify-between"
            style={{ borderColor: "var(--border-color)" }}
          >
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-brand-400">
                  <Activity size={14} className="text-signal-400" />
                  <span>Core Web Vitals</span>
                </div>
                <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-mono font-bold", cwvBadgeClass)}>
                  {cwvOverallStatus}
                </span>
              </div>

              {/* 3 Metric Capsules */}
              <div className="grid grid-cols-3 gap-2 mt-3">
                <div className="rounded-xl border bg-surface-2 p-2 text-center" style={{ borderColor: "var(--border-color)" }}>
                  <span className="text-[10px] font-mono font-bold text-brand-400 uppercase">LCP</span>
                  <p className={cn("font-mono text-[13px] font-extrabold mt-0.5", avgLcpMs == null ? "text-brand-400" : avgLcpMs <= 2500 ? "text-success-600" : "text-error-600")}>
                    {lcpDisplay}
                  </p>
                  <span className="text-[9px] text-brand-400 font-mono">&lt;2.5s</span>
                </div>
                <div className="rounded-xl border bg-surface-2 p-2 text-center" style={{ borderColor: "var(--border-color)" }}>
                  <span className="text-[10px] font-mono font-bold text-brand-400 uppercase">INP</span>
                  <p className={cn("font-mono text-[13px] font-extrabold mt-0.5", avgInpMs == null ? "text-brand-400" : avgInpMs <= 200 ? "text-success-600" : "text-warning-600")}>
                    {inpDisplay}
                  </p>
                  <span className="text-[9px] text-brand-400 font-mono">&lt;200ms</span>
                </div>
                <div className="rounded-xl border bg-surface-2 p-2 text-center" style={{ borderColor: "var(--border-color)" }}>
                  <span className="text-[10px] font-mono font-bold text-brand-400 uppercase">CLS</span>
                  <p className={cn("font-mono text-[13px] font-extrabold mt-0.5", avgCls == null ? "text-brand-400" : avgCls <= 0.1 ? "text-success-600" : "text-warning-600")}>
                    {clsDisplay}
                  </p>
                  <span className="text-[9px] text-brand-400 font-mono">&lt;0.1</span>
                </div>
              </div>
            </div>

            <div className="mt-3 pt-2.5 border-t flex items-center justify-between text-right" style={{ borderColor: "var(--border-color)" }}>
              <span className="text-[10.5px] text-brand-400 font-mono">Real user speeds</span>
              <button
                type="button"
                onClick={() => onSwitchTab("performance")}
                className="text-[11.5px] font-bold text-signal-400 hover:text-signal-500 inline-flex items-center gap-1 transition"
              >
                <span>View Details</span>
                <ArrowRight size={12} />
              </button>
            </div>
          </div>

          {/* Pillar 4: HTTPS & Security */}
          <div
            className="rounded-2xl border bg-surface-1 p-4 shadow-card flex flex-col justify-between"
            style={{ borderColor: "var(--border-color)" }}
          >
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-brand-400">
                  <Lock size={14} className="text-success-500" />
                  <span>HTTPS &amp; Security</span>
                </div>
                <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-mono font-bold", securityGood ? "bg-success-50/50 text-success-700 border-success-200/50" : "bg-error-50/50 text-error-700 border-error-200/50")}>
                  {securityGood ? "Protected" : "Needs Review"}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 mt-3">
                <div className="flex items-center gap-1.5 text-[11.5px] text-brand-950 font-medium">
                  <CheckCircle2 size={13} className={isHttps ? "text-success-500 shrink-0" : "text-brand-400 shrink-0"} />
                  <span className="truncate">HTTPS enabled</span>
                </div>
                <div className="flex items-center gap-1.5 text-[11.5px] text-brand-950 font-medium">
                  <CheckCircle2 size={13} className={!hasSslIssue ? "text-success-500 shrink-0" : "text-error-600 shrink-0"} />
                  <span className="truncate">Valid SSL cert</span>
                </div>
                <div className="flex items-center gap-1.5 text-[11.5px] text-brand-950 font-medium">
                  <CheckCircle2 size={13} className={!hasMixedContent ? "text-success-500 shrink-0" : "text-warning-500 shrink-0"} />
                  <span className="truncate">No mixed content</span>
                </div>
                <div className="flex items-center gap-1.5 text-[11.5px] text-brand-950 font-medium">
                  <CheckCircle2 size={13} className={!hasMalware ? "text-success-500 shrink-0" : "text-error-600 shrink-0"} />
                  <span className="truncate">Safe browsing</span>
                </div>
              </div>
            </div>

            <div className="mt-3 pt-2.5 border-t flex items-center justify-between text-[10.5px] text-brand-400 font-mono" style={{ borderColor: "var(--border-color)" }}>
              <span>SSL &amp; Protocol Integrity</span>
              <span className="text-success-600 font-bold">100% Secure</span>
            </div>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* MIDDLE SECTION: AUDIT INSIGHTS (4 BALANCED CARDS)         */}
      {/* ======================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Card 1: Issue Distribution (Clean 2x2 grid, NO TRUNCATION!) */}
        <div
          className="rounded-2xl border bg-surface-1 p-4 shadow-card flex flex-col justify-between"
          style={{ borderColor: "var(--border-color)" }}
        >
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[13px] font-bold text-brand-950">Issue Distribution</h3>
              <span className="text-[11px] font-mono text-brand-400">{issues.length} total</span>
            </div>
            <div className="flex justify-center py-2">
              <DonutChart
                data={donutData}
                centerValue={issues.length}
                centerLabel="Issues"
                size={105}
                thickness={14}
                showLegend={false}
              />
            </div>
          </div>

          {/* Full labels without truncation */}
          <div className="grid grid-cols-2 gap-1.5 pt-2 border-t text-[11px]" style={{ borderColor: "var(--border-color)" }}>
            {donutData.map((d) => {
              const pct = issues.length > 0 ? Math.round((d.value / issues.length) * 100) : 0;
              return (
                <div
                  key={d.label}
                  className="flex items-center justify-between rounded-lg bg-surface-2 px-2 py-1 border"
                  style={{ borderColor: "var(--border-color)" }}
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                    <span className="text-brand-950 font-medium truncate">{d.label}</span>
                  </div>
                  <span className="font-mono text-[10.5px] font-bold text-brand-400 ml-1">
                    {d.value} <span className="text-[9.5px]">({pct}%)</span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Card 2: Issue by Category */}
        <div
          className="rounded-2xl border bg-surface-1 p-4 shadow-card flex flex-col justify-between"
          style={{ borderColor: "var(--border-color)" }}
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[13px] font-bold text-brand-950">Issue by Category</h3>
              <span className="text-[10px] font-mono uppercase tracking-wider text-brand-400">Click to filter</span>
            </div>
            {categoryCounts.length === 0 ? (
              <p className="text-xs text-brand-400 py-6 text-center">No issues categorized.</p>
            ) : (
              <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                {categoryCounts.map(([cat, count]) => {
                  const isSelected = selectedCategory.toLowerCase() === cat.toLowerCase();
                  const pct = issues.length > 0 ? Math.round((count / issues.length) * 100) : 0;
                  return (
                    <div
                      key={cat}
                      onClick={() => setSelectedCategory(cat === selectedCategory ? "ALL" : cat)}
                      className={cn(
                        "group flex flex-col gap-1 p-2 rounded-xl border transition-all cursor-pointer",
                        isSelected
                          ? "bg-brand-100 border-signal-400/50 shadow-xs"
                          : "bg-surface-2 hover:bg-brand-100/50 hover:border-brand-300/40"
                      )}
                      style={{ borderColor: isSelected ? undefined : "var(--border-color)" }}
                    >
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          {getCategoryIcon(cat)}
                          <span className="font-semibold text-brand-950 truncate">{cat}</span>
                        </div>
                        <div className="flex items-center gap-1.5 font-mono">
                          <span className="text-[10.5px] text-brand-400">{pct}%</span>
                          <span className="rounded-full bg-brand-200 px-2 py-0.2 text-[10px] font-bold text-brand-950">
                            {count}
                          </span>
                        </div>
                      </div>
                      <div className="h-1 w-full overflow-hidden rounded-full bg-brand-200/50">
                        <div className="h-full rounded-full bg-signal-400" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Card 3: Crawl Status */}
        <div
          className="rounded-2xl border bg-surface-1 p-4 shadow-card flex flex-col justify-between"
          style={{ borderColor: "var(--border-color)" }}
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[13px] font-bold text-brand-950">Crawl Status</h3>
              <span className="rounded-full border border-success-200/50 bg-success-50/50 px-2 py-0.5 text-[10px] font-mono font-bold text-success-700">
                {crawl?.status || "Ready"}
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between text-brand-400">
                <span>Started</span>
                <span className="font-mono text-brand-950">
                  {crawl?.startedAt ? formatRelativeTime(crawl.startedAt) : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between text-brand-400">
                <span>Completed</span>
                <span className="font-mono text-brand-950">
                  {crawl?.finishedAt ? formatRelativeTime(crawl.finishedAt) : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between text-brand-400">
                <span>Duration</span>
                <span className="font-mono text-brand-950">{durationText}</span>
              </div>
              <div className="flex items-center justify-between text-brand-400">
                <span>Pages crawled</span>
                <span className="font-mono font-bold text-brand-950">
                  {qualityDiagnostics?.urlsDiscovered
                    ? `${pages.length.toLocaleString()} of ${qualityDiagnostics.urlsDiscovered.toLocaleString()}`
                    : pages.length.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between text-brand-400">
                <span>Average latency</span>
                <span className="font-mono text-brand-950">{avgLatency}</span>
              </div>
            </div>
          </div>

          <div className="mt-3 pt-2.5 border-t" style={{ borderColor: "var(--border-color)" }}>
            <button
              type="button"
              onClick={onOpenLogs}
              className="w-full rounded-xl border bg-surface-2 hover:bg-brand-100 py-1.5 text-xs font-bold text-brand-950 transition-all inline-flex items-center justify-center gap-1.5 shadow-2xs"
              style={{ borderColor: "var(--border-color)" }}
            >
              <span>View Crawl Logs</span>
              <ArrowRight size={12} className="text-brand-400" />
            </button>
          </div>
        </div>

        {/* Card 4: Top Opportunities */}
        <div
          className="rounded-2xl border bg-surface-1 p-4 shadow-card flex flex-col justify-between"
          style={{ borderColor: "var(--border-color)" }}
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5">
                <Lightbulb size={15} className="text-signal-400" />
                <h3 className="text-[13px] font-bold text-brand-950">Top Opportunities</h3>
              </div>
              <span className="text-[10px] font-mono text-brand-400">{topOpportunities.length} action items</span>
            </div>

            {topOpportunities.length === 0 ? (
              <p className="text-xs text-brand-400 py-6 text-center">No critical opportunities detected.</p>
            ) : (
              <div className="space-y-2">
                {topOpportunities.map((opp, i) => (
                  <div
                    key={opp.id}
                    className="flex items-start gap-2 text-xs rounded-xl bg-surface-2 p-2.5 border"
                    style={{ borderColor: "var(--border-color)" }}
                  >
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-signal-400 text-signal-ink font-bold font-mono text-[10px] mt-0.5">
                      {i + 1}
                    </span>
                    <span className="text-brand-950 leading-snug line-clamp-2 font-medium">
                      {opp.title}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-3 pt-2.5 border-t" style={{ borderColor: "var(--border-color)" }}>
            <button
              type="button"
              onClick={onOpenRecommendations}
              className="w-full rounded-xl bg-signal-400 hover:bg-signal-500 py-1.5 text-xs font-bold text-signal-ink transition-all inline-flex items-center justify-center gap-1.5 shadow-xs"
            >
              <Sparkles size={12} className="text-signal-ink" />
              <span>View AI Recommendations</span>
            </button>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* BOTTOM SECTION: TECHNICAL SEO ISSUES TABLE               */}
      {/* ======================================================== */}
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
              {issues.length} unique issues across {pages.length} pages. Fix these to improve your technical health score.
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
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 w-48 sm:w-60 rounded-xl border bg-surface-1 pl-8 pr-3 text-xs text-brand-950 placeholder:text-brand-400 focus:outline-none focus:ring-1 focus:ring-signal-400"
                style={{ borderColor: "var(--border-color)" }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-brand-400 hover:text-brand-950"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Severity Filter */}
            <select
              value={selectedSeverity}
              onChange={(e) => setSelectedSeverity(e.target.value)}
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
              onChange={(e) => setSelectedCategory(e.target.value)}
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
                onChange={(e) => setSelectedPageUrl(e.target.value)}
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
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
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
                      onChange={toggleSelectAll}
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
                          onChange={() => toggleSelectIssue(issue.id)}
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
    </div>
  );
}
