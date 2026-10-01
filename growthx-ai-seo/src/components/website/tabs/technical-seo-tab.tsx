"use client";

import React, { useMemo, useState } from "react";
import type { CrawlIssue, CrawlJob, CrawlPage, CrawlQualityDiagnostics } from "@/lib/api-client";
import { computeCrawlSummary } from "@/lib/crawl-summary";
import type { WebsiteTabId } from "@/components/website/tabs/tab-id";
import {
  TechnicalHealthPillars,
  TechnicalAuditInsights,
  TechnicalIssuesTable,
} from "../technical/index";

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

  const avgLcpMs = summary.coreWebVitals.lcpMs;

  // HTTPS & Security
  const isHttps = pages.length > 0 ? pages.some((p) => p.url.startsWith("https://")) : true;
  const hasSslIssue = issues.some(
    (i) => (i.issueType || "").toUpperCase().includes("SSL") || (i.issueType || "").toUpperCase().includes("CERT")
  );
  const hasMixedContent = issues.some((i) => (i.issueType || "").toUpperCase().includes("MIXED"));
  const hasMalware = issues.some((i) => i.severity === "CRITICAL" && i.category === "SECURITY");
  const securityGood = isHttps && !hasSslIssue && !hasMixedContent && !hasMalware;

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
        title: `Expand thin content pages (${thinCount} pages under 300 words)`,
        count: thinCount,
      });
    }

    return opps.slice(0, 5);
  }, [issues, avgLcpMs, pages]);

  // Filtered Issues Table Data
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
        pagesCount={pages.length}
        qualityDiagnostics={qualityDiagnostics}
        durationText={durationText}
        avgLatency={avgLatency}
        topOpportunities={topOpportunities}
        onOpenLogs={onOpenLogs}
        onOpenRecommendations={onOpenRecommendations}
      />

      <TechnicalIssuesTable
        totalIssuesCount={issues.length}
        totalPagesCount={pages.length}
        filteredIssues={filteredIssues}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedSeverity={selectedSeverity}
        onSeverityChange={setSelectedSeverity}
        severityCounts={severityCounts}
        selectedCategory={selectedCategory}
        onCategoryChange={setSelectedCategory}
        categoryCounts={categoryCounts}
        selectedPageUrl={selectedPageUrl}
        onPageUrlChange={setSelectedPageUrl}
        uniquePageUrls={uniquePageUrls}
        sortBy={sortBy}
        onSortByChange={setSortBy}
        selectedIssueIds={selectedIssueIds}
        onToggleSelectAll={toggleSelectAll}
        onToggleSelectIssue={toggleSelectIssue}
      />
    </div>
  );
}
