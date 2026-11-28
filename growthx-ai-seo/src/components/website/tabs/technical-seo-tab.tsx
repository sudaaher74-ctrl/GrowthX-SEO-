"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { Activity, ArrowRight, CheckCircle2, Sparkles, Zap } from "lucide-react";
import type { CrawlIssue, CrawlJob, CrawlPage, CrawlQualityDiagnostics } from "@/lib/api-client";
import { computeCrawlSummary } from "@/lib/crawl-summary";
import type { WebsiteTabId } from "@/components/website/tabs/tab-id";
import { useWorkspace } from "@/hooks/use-growthx";
import { stagingEngine } from "@/lib/staging-engine";
import { cn } from "@/lib/utils";
import {
  TechnicalHealthPillars,
  TechnicalAuditInsights,
} from "../technical/index";

interface TechnicalSeoTabProps {
  crawl: CrawlJob | null;
  issues: CrawlIssue[];
  pages: CrawlPage[];
  totalPages?: number;
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
  totalPages = crawl?.pagesCrawled ?? pages.length,
  qualityDiagnostics,
  historyRuns = [],
  onSwitchTab,
  onOpenLogs,
  onOpenRecommendations,
}: TechnicalSeoTabProps) {
  // Filter states
  const { projectId } = useWorkspace();
  const [selectedCategory, setSelectedCategory] = useState("ALL");

  const [stagedTasks, setStagedTasks] = useState<Set<string>>(() => {
    if (!projectId) return new Set();
    const existing = stagingEngine.getStaged(projectId);
    return new Set(existing.map((item) => item.title));
  });

  // Status code breakdown
  const count2xx = useMemo(() => pages.filter((p) => p.statusCode && p.statusCode >= 200 && p.statusCode < 300).length, [pages]);
  const count3xx = useMemo(() => pages.filter((p) => p.statusCode && p.statusCode >= 300 && p.statusCode < 400).length, [pages]);
  const count4xx = useMemo(() => pages.filter((p) => p.statusCode && p.statusCode >= 400 && p.statusCode < 500).length, [pages]);
  const count5xx = useMemo(() => pages.filter((p) => p.statusCode && p.statusCode >= 500 && p.statusCode < 600).length, [pages]);
  const countErrors = count4xx + count5xx;
  const pct2xx = pages.length > 0 ? Math.round((count2xx / pages.length) * 100) : 100;
  const pct3xx = pages.length > 0 ? Math.round((count3xx / pages.length) * 100) : 0;

  const handleStageBroken4xx5xx = () => {
    if (!projectId) return;
    const errorPages = pages.filter((p) => p.statusCode && p.statusCode >= 400);
    const title = "Consolidate Broken 4xx/5xx URLs via Automated 301 Redirects";
    stagingEngine.stage(projectId, {
      title,
      category: "Crawl Diagnostics",
      source: "TECHNICAL_AUDIT",
      priority: "CRITICAL",
      impact: `${errorPages.length} pages returning 4xx/5xx errors found during crawl. Setting up 301 redirects restores link equity and prevents lost search traffic.`,
      effortHours: 2,
      deliverable: [
        "1. Map each 4xx/5xx URL to its closest active parent or equivalent semantic destination.",
        "2. Add 301 permanent redirects in next.config.ts / middleware.",
        "3. Update all internal links pointing to dead URLs.",
        "4. Validate HTTP response codes via live server check.",
      ].join("\n"),
      evidence: `${errorPages.length} broken URLs detected during crawl`,
      affectedUrl: errorPages[0]?.url,
    });
    setStagedTasks((prev) => new Set(prev).add(title));
  };

  const handleStageRedirectChains = () => {
    if (!projectId) return;
    const redirectPages = pages.filter((p) => p.statusCode && p.statusCode >= 300 && p.statusCode < 400);
    const title = "Resolve 3xx Redirect Chains & Trailing Slash Normalization";
    stagingEngine.stage(projectId, {
      title,
      category: "Crawl Diagnostics",
      source: "TECHNICAL_AUDIT",
      priority: "HIGH",
      impact: `${redirectPages.length} redirected pages waste crawl budget and add latency to page load times.`,
      effortHours: 1.5,
      deliverable: [
        "1. Update all internal anchors to point directly to final destination URLs.",
        "2. Normalize trailing slashes consistently across routing configuration.",
        "3. Collapse multi-hop 301/302 chains into a single direct permanent redirect.",
      ].join("\n"),
      evidence: `${redirectPages.length} redirect occurrences in crawl telemetry`,
      affectedUrl: redirectPages[0]?.url,
    });
    setStagedTasks((prev) => new Set(prev).add(title));
  };

  const handleStageCanonicalPlaybook = () => {
    if (!projectId) return;
    const title = "Standardize Canonical Tags & Enforce Primary Indexing URLs";
    stagingEngine.stage(projectId, {
      title,
      category: "Indexing & Canonicals",
      source: "TECHNICAL_AUDIT",
      priority: "HIGH",
      impact: "Ensure all pages declare self-referential or authoritative canonical tags to avoid index splitting and duplicate content penalties.",
      effortHours: 1.5,
      deliverable: [
        "1. Verify <link rel=\"canonical\"> tag matches the clean HTTPS production domain.",
        "2. Strip tracking query parameters (utm_*, ref, gclid) from canonical declarations.",
        "3. Verify XML sitemap only lists self-canonicalized URLs.",
      ].join("\n"),
      evidence: `${canonicalIssues.length} canonical discrepancies identified`,
    });
    setStagedTasks((prev) => new Set(prev).add(title));
  };

  // 1. Health Score
  const healthScore = crawl?.healthScore != null ? Math.round(crawl.healthScore) : null;

  const computedSummary = useMemo(
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
  const summary = {...computedSummary, health: qualityDiagnostics?.summary?.health ?? computedSummary.health};

  // Delta vs last crawl
  // Page-count growth is not a change in crawler accessibility.
  const crawlabilityDelta = null;

  const canonicalIssues = issues.filter(
    (i) =>
      (i.issueType || "").toUpperCase().includes("CANONICAL") ||
      (i.category || "").toUpperCase().includes("CANONICAL")
  );

  const avgLcpMs = summary.coreWebVitals.lcpMs;

  // HTTPS & Security (protocol & mixed-content checks only; TLS cert and security headers are not crawled)
  const hasHttpIssue =
    issues.some((i) => (i.issueType || "").toUpperCase() === "HTTPS_ISSUE") ||
    pages.some((p) => p.url.startsWith("http://"));
  const isHttps = pages.length > 0 && pages.every((p) => p.url.startsWith("https://")) && !hasHttpIssue;
  const hasSslIssue = issues.some(
    (i) => (i.issueType || "").toUpperCase().includes("SSL") || (i.issueType || "").toUpperCase().includes("CERT")
  );
  const hasMixedContent = issues.some((i) => (i.issueType || "").toUpperCase().includes("MIXED"));
  const hasMalware = issues.some((i) => i.severity === "CRITICAL" && i.category === "SECURITY");
  const securityGood = pages.length > 0 && isHttps && !hasSslIssue && !hasMixedContent && !hasMalware;

  // Issue Distribution Donut Data
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

  // Categories Breakdown
  const categoryCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const issue of issues) {
      const cat = issue.category ? issue.category.replace(/_/g, " ") : "Other";
      map[cat] = (map[cat] || 0) + 1;
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [issues]);

  // Crawl Status duration & latency
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

  // Top Opportunities
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
        title: `Review page content (${thinCount} pages flagged)`,
        count: thinCount,
      });
    }

    return opps.slice(0, 5);
  }, [issues, avgLcpMs, pages]);

  return (
    <div className="space-y-4">
      <TechnicalHealthPillars
        crawl={crawl}
        healthScore={healthScore}
        summary={summary}
        severityCounts={severityCounts}
        crawlabilityDelta={crawlabilityDelta}
        canonicalIssuesCount={canonicalIssues.length}
        isHttps={isHttps}
        hasSslIssue={hasSslIssue}
        hasMixedContent={hasMixedContent}
        hasMalware={hasMalware}
        securityGood={securityGood}
        onSwitchTab={onSwitchTab}
      />

      <TechnicalAuditInsights
        issues={issues}
        donutData={donutData}
        categoryCounts={categoryCounts}
        selectedCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
        crawl={crawl}
        pagesCount={totalPages}
        qualityDiagnostics={qualityDiagnostics}
        durationText={durationText}
        avgLatency={avgLatency}
        topOpportunities={topOpportunities}
        onOpenLogs={onOpenLogs}
        onOpenRecommendations={onOpenRecommendations}
      />

      {/* Crawl Diagnostics & HTTP Status Breakdown */}
      <div className="rounded-2xl border border-brand-200/80 bg-surface-1 p-4 shadow-2xs">
        <div className="flex flex-col gap-3.5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-bold text-brand-950">
                  HTTP Status Breakdown
                </h3>
                <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[10.5px] font-mono font-semibold text-brand-700">
                  {totalPages.toLocaleString()} URLs
                </span>
                <span className="rounded-full bg-surface-2 border border-brand-200 px-2 py-0.5 text-[10.5px] font-mono text-brand-600">
                  Avg latency: {avgLatency}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-brand-500">
                Response codes across crawled pages.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/fix-engine"
                className="inline-flex items-center gap-1.5 rounded-lg bg-signal-400 px-3 py-1.5 text-xs font-bold text-signal-ink shadow-xs transition hover:bg-signal-500"
              >
                <span>Open Fix Engine →</span>
              </Link>
              <button
                type="button"
                onClick={() => onSwitchTab("pages")}
                className="inline-flex items-center gap-1.5 rounded-lg border border-brand-200/80 bg-surface-1 px-3 py-1.5 text-xs font-semibold text-brand-800 hover:bg-brand-50 hover:text-brand-950 transition shadow-2xs cursor-pointer"
              >
                <span>View All Pages</span>
                <ArrowRight size={12} />
              </button>
            </div>
          </div>

          {/* Status Code Telemetry Capsule Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
            {/* 2xx OK */}
            <button
              type="button"
              onClick={() => onSwitchTab("pages")}
              className="flex items-center justify-between rounded-xl border border-success-200/60 bg-success-50/40 p-2.5 text-left transition hover:bg-success-50/80 cursor-pointer"
            >
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-success-700 font-mono block">2xx Success</span>
                <span className="text-base font-extrabold text-brand-950 font-mono">{count2xx}</span>
                <span className="text-[10px] text-success-700 block font-mono">{pct2xx}% of crawl</span>
              </div>
              <span className="h-2.5 w-2.5 rounded-full bg-success-500 shadow-2xs shrink-0" />
            </button>

            {/* 3xx Redirect */}
            <button
              type="button"
              onClick={() => onSwitchTab("issues")}
              className="flex items-center justify-between rounded-xl border border-warning-200/60 bg-warning-50/40 p-2.5 text-left transition hover:bg-warning-50/80 cursor-pointer"
            >
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-warning-800 font-mono block">3xx Redirects</span>
                <span className="text-base font-extrabold text-brand-950 font-mono">{count3xx}</span>
                <span className="text-[10px] text-warning-800 block font-mono">{pct3xx}% of crawl</span>
              </div>
              <span className="h-2.5 w-2.5 rounded-full bg-signal-400 shadow-2xs shrink-0" />
            </button>

            {/* 4xx Not Found */}
            <button
              type="button"
              onClick={() => onSwitchTab("issues")}
              className="flex items-center justify-between rounded-xl border border-error-200/60 bg-error-50/40 p-2.5 text-left transition hover:bg-error-50/80 cursor-pointer"
            >
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-error-700 font-mono block">4xx Client Errors</span>
                <span className="text-base font-extrabold text-brand-950 font-mono">{count4xx}</span>
                <span className="text-[10px] text-error-700 block font-mono">{count4xx > 0 ? "Needs 301 fix" : "Clean"}</span>
              </div>
              <span className="h-2.5 w-2.5 rounded-full bg-error-500 shadow-2xs shrink-0" />
            </button>

            {/* 5xx Server Error */}
            <button
              type="button"
              onClick={() => onSwitchTab("issues")}
              className="flex items-center justify-between rounded-xl border border-brand-200/80 bg-surface-2 p-2.5 text-left transition hover:bg-surface-3 cursor-pointer"
            >
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-brand-600 font-mono block">5xx Server Errors</span>
                <span className="text-base font-extrabold text-brand-950 font-mono">{count5xx}</span>
                <span className="text-[10px] text-brand-500 block font-mono">{count5xx > 0 ? "Critical review" : "None detected"}</span>
              </div>
              <span className={cn("h-2.5 w-2.5 rounded-full shadow-2xs shrink-0", count5xx > 0 ? "bg-error-600 animate-pulse" : "bg-brand-300")} />
            </button>
          </div>

          {/* Quick 1-Click Staging Action Tray */}
          {(countErrors > 0 || count3xx > 0 || canonicalIssues.length > 0) && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-200/60 bg-brand-50/40 p-2.5 text-xs">
              <div className="flex items-center gap-2">
                <Sparkles size={14} className="text-signal-400 shrink-0" />
                <span className="font-semibold text-brand-950 text-[11.5px]">
                  Autonomous Remediation Playbooks:
                </span>
                <span className="text-brand-500 text-[11px]">
                  Stage targeted fixes directly into the Fix Engine queue.
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {countErrors > 0 && (
                  stagedTasks.has("Consolidate Broken 4xx/5xx URLs via Automated 301 Redirects") ? (
                    <span className="inline-flex items-center gap-1 rounded-lg border border-success-200 bg-success-50 px-2.5 py-1 text-[11px] font-bold text-success-700 font-mono">
                      <CheckCircle2 size={11} className="text-success-600" />
                      <span>4xx/5xx Fix Staged</span>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleStageBroken4xx5xx}
                      className="inline-flex items-center gap-1 rounded-lg bg-error-600 hover:bg-error-700 text-white px-2.5 py-1 text-[11px] font-bold transition shadow-2xs cursor-pointer"
                    >
                      <Zap size={11} className="text-white fill-white" />
                      <span>Stage Broken 4xx/5xx Fix ({countErrors})</span>
                    </button>
                  )
                )}

                {count3xx > 0 && (
                  stagedTasks.has("Resolve 3xx Redirect Chains & Trailing Slash Normalization") ? (
                    <span className="inline-flex items-center gap-1 rounded-lg border border-success-200 bg-success-50 px-2.5 py-1 text-[11px] font-bold text-success-700 font-mono">
                      <CheckCircle2 size={11} className="text-success-600" />
                      <span>3xx Fix Staged</span>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleStageRedirectChains}
                      className="inline-flex items-center gap-1 rounded-lg border border-brand-200/80 bg-surface-1 hover:bg-surface-2 px-2.5 py-1 text-[11px] font-bold text-brand-950 transition shadow-2xs cursor-pointer"
                    >
                      <Zap size={11} className="text-signal-400" />
                      <span>Stage 3xx Consolidation ({count3xx})</span>
                    </button>
                  )
                )}

                {canonicalIssues.length > 0 && (
                  stagedTasks.has("Standardize Canonical Tags & Enforce Primary Indexing URLs") ? (
                    <span className="inline-flex items-center gap-1 rounded-lg border border-success-200 bg-success-50 px-2.5 py-1 text-[11px] font-bold text-success-700 font-mono">
                      <CheckCircle2 size={11} className="text-success-600" />
                      <span>Canonical Fix Staged</span>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleStageCanonicalPlaybook}
                      className="inline-flex items-center gap-1 rounded-lg border border-brand-200/80 bg-surface-1 hover:bg-surface-2 px-2.5 py-1 text-[11px] font-bold text-brand-950 transition shadow-2xs cursor-pointer"
                    >
                      <Zap size={11} className="text-signal-400" />
                      <span>Stage Canonical Tag Fix ({canonicalIssues.length})</span>
                    </button>
                  )
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Single-Source-of-Truth CTA to Problems to fix tab */}
      {issues.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand-200/80 bg-surface-1 px-4 py-3 shadow-2xs">
          <p className="text-xs text-brand-600">
            Found <strong className="font-mono text-brand-950">{issues.length.toLocaleString()}</strong> issues across{" "}
            <strong className="font-mono text-brand-950">{pages.length.toLocaleString()}</strong> crawled pages. Filter, simulate impact, and fix them in one place.
          </p>
          <button
            type="button"
            onClick={() => onSwitchTab("issues")}
            className="inline-flex items-center gap-1.5 rounded-xl bg-signal-400 px-3.5 py-1.5 text-xs font-bold text-signal-ink shadow-xs hover:bg-signal-500 transition cursor-pointer"
          >
            <span>Open Problems to fix</span>
            <ArrowRight size={13} />
          </button>
        </div>
      )}
    </div>
  );
}
