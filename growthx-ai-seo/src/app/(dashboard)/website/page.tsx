"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowRight, ChevronRight, FileDown, Home, Loader2, RefreshCw, X, Zap } from "lucide-react";

import { cn, formatRelativeTime } from "@/lib/utils";
import { api } from "@/lib/api-client";
import {
  useCrawlHistory,
  useCrawlIssues,
  useCrawlPages,
  useIssueCounts,
  useIssueGroups,
  useLatestCrawl,
  usePortfolio,
  useWorkspace,
} from "@/hooks/use-growthx";
import { QueryState } from "@/components/ui/query-state";
import { SeoAuditReportModal } from "@/components/website/audit-report-pdf/seo-audit-report-modal";
import { AuditReportTab } from "@/components/website/tabs/audit-report-tab";

import { TechnicalSeoTab } from "@/components/website/tabs/technical-seo-tab";
import { PerformanceTab } from "@/components/website/tabs/performance-tab";
import { PagesTab } from "@/components/website/tabs/pages-tab";
import { ContentTab } from "@/components/website/tabs/content-tab";
import { IssuesTab } from "@/components/website/tabs/issues-tab";
import { OverviewTab } from "@/components/website/tabs/overview-tab";

import type { WebsiteTabId as TabId } from "@/components/website/tabs/tab-id";

function WebsiteAuditClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryDomain = searchParams.get("domain");
  const tabParam = searchParams.get("tab") as TabId | null;

  const { orgId, projectId } = useWorkspace();
  const portfolio = usePortfolio(orgId);

  const clients = portfolio.data?.clients ?? [];
  const client = queryDomain
    ? (clients.find((c) => c.domain === queryDomain) ?? null)
    : (clients.find((c) => c.projectId === projectId) ?? clients[0] ?? null);
  const auditProjectId = client?.projectId ?? null;

  const crawl = useLatestCrawl(client?.domain ?? null);
  const issues = useCrawlIssues(crawl.data?.id ?? null, undefined, crawl.data?.status);
  const pages = useCrawlPages(crawl.data?.id ?? null, crawl.data?.status);
  const history = useCrawlHistory(client?.domain ?? null, 12);
  // Counts come from the one endpoint every screen shares. The lists below are
  // fetched a page at a time — 100 rows — so their length is a page size, not a
  // count. Reading it as one is how this screen said 100 issues while the
  // dashboard, reading the real total, said 156.
  const issueCounts = useIssueCounts(auditProjectId);
  const counts = issueCounts.data ?? null;
  // True affected-page counts per problem, for the printed report.
  const issueGroups = useIssueGroups(auditProjectId);

  const VALID_TABS: TabId[] = [
    "overview",
    "technical-seo",
    "performance",
    "pages",
    "content",
    "issues",
    "report",
  ];

  const activeTab: TabId = tabParam && (VALID_TABS as string[]).includes(tabParam)
    ? tabParam
    : "technical-seo";
  const [crawling, setCrawling] = useState(false);
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [showLogsModal, setShowLogsModal] = useState(false);

  function selectTab(tab: TabId) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  const allIssues = issues.data?.data ?? [];
  const allPages = pages.data?.data ?? [];
  const qualityDiagnostics = crawl.data?.qualityDiagnostics ?? issues.data?.meta?.qualityDiagnostics ?? null;
  const historyRuns = history.data ?? [];

  // Duration computation
  const crawlDuration = useMemo(() => {
    if (qualityDiagnostics?.durationSeconds != null) {
      const s = qualityDiagnostics.durationSeconds;
      return s >= 60 ? `${Math.round(s / 60)} minutes` : `${s} seconds`;
    }
    if (crawl.data?.startedAt && crawl.data?.finishedAt) {
      const ms = new Date(crawl.data.finishedAt).getTime() - new Date(crawl.data.startedAt).getTime();
      const mins = Math.round(ms / 60000);
      return mins >= 1 ? `${mins} minutes` : `${Math.max(1, Math.round(ms / 1000))} seconds`;
    }
    return null;
  }, [crawl.data, qualityDiagnostics]);

  // Sync refetch when completed
  const { refetch: refetchHistory } = history;
  const { refetch: refetchIssues } = issues;
  const { refetch: refetchPages } = pages;
  const { refetch: refetchPortfolio } = portfolio;

  useEffect(() => {
    if (crawl.data?.status === "COMPLETED") {
      refetchHistory();
      refetchIssues();
      refetchPages();
      refetchPortfolio();
    }
  }, [crawl.data?.status, refetchHistory, refetchIssues, refetchPages, refetchPortfolio]);

  async function handleReCrawl() {
    if (!client?.domain) return;
    setCrawling(true);
    try {
      await api.startCrawl({
        domain: client.domain,
        maxDepth: 20,
        maxConcurrency: 10,
        useSitemap: true,
      });
      setTimeout(() => {
        crawl.refetch();
        issues.refetch();
        pages.refetch();
      }, 1500);
    } finally {
      setCrawling(false);
    }
  }

  function handleExportPdf() {
    setShowPdfModal(true);
  }

  // Client display name (e.g. Aiva Enterprises)
  const clientName = client?.name || client?.domain || "Website";

  // Tab configurations matching designs
  const tabs: {
    id: TabId;
    label: string;
    badge?: string | number;
    badgeTone?: "danger" | "info" | "default";
  }[] = [
    { id: "overview", label: "Overview" },
    {
      id: "technical-seo",
      label: "Technical health",
      // The number of distinct problems, labelled as such. A bare "100" beside
      // a heading reads as a score out of 100, which it never was.
      badge: counts && counts.openGroups > 0
        ? `${counts.openGroups} problem${counts.openGroups === 1 ? "" : "s"}`
        : undefined,
      badgeTone: "danger",
    },
    { id: "performance", label: "Speed" },
    {
      id: "pages",
      label: "Pages",
      badge: counts && counts.pagesCrawled > 0 ? counts.pagesCrawled : undefined,
      badgeTone: "info",
    },
    { id: "content", label: "Content" },
    { id: "issues", label: "Problems to fix" },
    { id: "report", label: "Full Report" },
  ];

  // Dynamic Header Titles and Subtitles based on Active Tab
  const headerContent = {
    overview: {
      title: "Your website at a glance",
      subtitle: "How healthy your website is, what's wrong and what to do first.",
    },
    "technical-seo": {
      title: "Technical health",
      subtitle: "Problems that stop Google from finding, reading or showing your pages, and how to fix each one.",
    },
    performance: {
      title: "Speed",
      subtitle: "How fast your pages load for visitors, and what slows them down.",
    },
    pages: {
      title: "Pages",
      subtitle: "Every page we read on your website, whether Google can show it, and which ones need work.",
    },
    content: {
      title: "Content",
      subtitle: "Your page titles, the descriptions Google shows, headlines, and how much useful text each page has.",
    },
    issues: {
      title: "Problems to fix",
      subtitle: "Every problem the audit found, with what to do about each one and who can do it.",
    },
    report: {
      title: "Full report",
      subtitle: "Everything the audit found in one plain-language report you can download, print or share.",
    },
  }[activeTab];

  return (
    <div className="space-y-5 pb-10">
      {/* Top Header & Breadcrumb */}
      <div className="space-y-2">
        {/* Breadcrumb row */}
        <div className="flex items-center gap-1.5 text-xs text-brand-400">
          <Home size={13} className="text-brand-400" />
          <span className="font-medium text-brand-300">{clientName}</span>
          <ChevronRight size={12} className="text-brand-400" />
          <span>Website Audit</span>
          <ChevronRight size={12} className="text-brand-400" />
          <span className="font-semibold text-brand-950 capitalize">
            {activeTab.replace(/-/g, " ")}
          </span>
        </div>

        {/* Main Title & Action Buttons Row */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pt-1">
          <div className="space-y-1.5 min-w-0">
            <h1 className="text-2xl font-bold tracking-tight text-brand-950">
              {headerContent.title}
            </h1>
            <p className="text-xs text-brand-400 max-w-2xl leading-relaxed">
              {headerContent.subtitle}
            </p>
            {crawl.data?.finishedAt && (
              <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-brand-400 pt-0.5">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-success-500" />
                <span className="font-medium text-brand-300">
                  Last checked: {formatRelativeTime(crawl.data.finishedAt)}
                </span>
                <span className="text-brand-400">·</span>
                <span>{counts?.pagesCrawled ?? allPages.length} pages</span>
                <span className="text-brand-400">·</span>
                <span>
                  {counts
                    ? `${counts.openGroups} problem${counts.openGroups === 1 ? "" : "s"} found`
                    : "counting…"}
                </span>
                {crawlDuration && (
                  <>
                    <span className="text-brand-400">·</span>
                    <span>Completed in {crawlDuration}</span>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Action buttons toolbar */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleExportPdf}
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-brand-200/50 bg-brand-50 px-3.5 py-1.5 text-xs font-semibold text-brand-950 shadow-xs hover:bg-brand-100 active:scale-95 transition-all"
            >
              <FileDown size={13.5} className="text-brand-400" />
              <span>Save PDF to share</span>
            </button>

            <button
              type="button"
              onClick={handleReCrawl}
              disabled={crawling || !client?.domain}
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-signal-400 px-3.5 py-1.5 text-xs font-bold text-signal-ink shadow-sm hover:bg-signal-500 active:scale-95 disabled:opacity-50 transition-all"
            >
              <RefreshCw size={13} className={cn(crawling && "animate-spin")} />
              <span>{crawling ? "Checking…" : "Check my website again"}</span>
            </button>

            <Link
              href="/fix-engine"
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-brand-200/50 bg-brand-50 px-3.5 py-1.5 text-xs font-semibold text-brand-950 shadow-xs hover:border-brand-300 hover:bg-brand-100 active:scale-95 transition-all"
            >
              <Zap size={13} className="text-warning-500 fill-warning-500" />
              <span>Open Fix Engine</span>
              <ArrowRight size={12} className="text-brand-400" />
            </Link>
          </div>
        </div>
      </div>

      {/* Navigation Sub-tabs Bar */}
      <div
        role="tablist"
        aria-label="Website audit tabs"
        className="inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-full bg-brand-50 border border-brand-200/60 p-1 text-[11.5px] font-semibold [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => selectTab(tab.id)}
              className={cn(
                "inline-flex items-center gap-1.5 shrink-0 rounded-full px-3 py-1.5 text-[11.5px] font-semibold transition-colors",
                isActive
                  ? "bg-signal-400 text-signal-ink font-bold shadow-xs"
                  : "text-brand-400 hover:text-brand-950",
              )}
            >
              <span>{tab.label}</span>
              {tab.badge !== undefined && (
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.2 text-[10px] font-bold leading-tight",
                    isActive
                      ? "bg-signal-ink text-signal-400"
                      : "bg-brand-200 text-brand-400",
                  )}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* A re-audit that failed: the API returns the last good audit and says so. */}
      {crawl.data?.latestAttempt && (
        <div
          role="status"
          className="mb-4 rounded-lg border border-warning-200 bg-warning-50 px-4 py-3 text-[13px] text-warning-700"
        >
          The latest audit
          {crawl.data.latestAttempt.startedAt ? ` (started ${formatRelativeTime(crawl.data.latestAttempt.startedAt)})` : ""} did
          not finish
          {crawl.data.latestAttempt.errorMessage ? `: ${crawl.data.latestAttempt.errorMessage}` : "."} Showing the previous
          audit
          {crawl.data.finishedAt ? ` from ${formatRelativeTime(crawl.data.finishedAt)}` : ""}.
        </div>
      )}

      {/* Main Tab View Router with Real Query State */}
      <QueryState
        isLoading={
          portfolio.isLoading ||
          (Boolean(client?.domain) &&
            (crawl.isLoading || pages.isLoading || issues.isLoading || issueCounts.isLoading))
        }
        error={portfolio.error || crawl.error}
        isEmpty={!client?.domain}
        emptyTitle={queryDomain ? "Website not found in this workspace" : "No website registered"}
        emptyBody={queryDomain ? "Choose a website from your workspace to view its audit." : "This workspace has no website attached yet. Add one from the dashboard and we will read it and build your audit."}
        emptyAction={
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-primary-700 transition-colors"
          >
            Go to Dashboard to Add Website
          </Link>
        }
      >
        {/* Render Tab Content based on activeTab */}
        {activeTab === "overview" && (
          <OverviewTab
            crawl={crawl.data ?? null}
            issues={allIssues}
            pages={allPages}
            onSwitchTab={selectTab}
          />
        )}

        {activeTab === "technical-seo" && (
          <TechnicalSeoTab
            crawl={crawl.data ?? null}
            issues={allIssues}
            pages={allPages}
            qualityDiagnostics={qualityDiagnostics}
            historyRuns={historyRuns}
            onSwitchTab={selectTab}
            onOpenLogs={() => setShowLogsModal(true)}
            onOpenRecommendations={() => {
              const el = document.getElementById("technical-issues-table");
              if (el) el.scrollIntoView({ behavior: "smooth" });
            }}
          />
        )}

        {activeTab === "performance" && (
          <PerformanceTab
            crawl={crawl.data ?? null}
            pages={allPages}
            historyRuns={historyRuns}
          />
        )}

        {activeTab === "pages" && (
          <PagesTab
            crawl={crawl.data ?? null}
            pages={allPages}
            issues={allIssues}
            historyRuns={historyRuns}
            onOpenPageDetails={(page) => {
              window.open(page.url, "_blank");
            }}
          />
        )}

        {activeTab === "content" && (
          <ContentTab
            pages={allPages}
            issues={allIssues}
          />
        )}

        {activeTab === "report" && <AuditReportTab projectId={auditProjectId || ""} />}

        {activeTab === "issues" && (
          <IssuesTab
            issues={allIssues}
            onExportPdf={() => setShowPdfModal(true)}
          />
        )}
      </QueryState>

      {/* 9-Page SEO Audit Report PDF Modal */}
      <SeoAuditReportModal
        isOpen={showPdfModal}
        onClose={() => setShowPdfModal(false)}
        clientName={client?.name}
        domain={client?.domain}
        crawledAt={crawl.data?.finishedAt || crawl.data?.startedAt}
        crawlDuration={crawlDuration}
        healthScore={crawl.data?.healthScore}
        counts={counts}
        groups={issueGroups.data?.groups ?? null}
        issues={allIssues}
        pages={allPages}
        qualityDiagnostics={qualityDiagnostics}
      />

      {/* Crawl Logs Modal */}
      {showLogsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-xl rounded-xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Crawl Telemetry & Diagnostics</h3>
                <p className="text-xs text-slate-500">Authoritative audit metrics from the crawler engine</p>
              </div>
              <button
                type="button"
                onClick={() => setShowLogsModal(false)}
                className="text-slate-400 hover:text-slate-600 rounded p-1"
              >
                <X size={16} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-lg bg-slate-50 dark:bg-slate-800 p-3">
                <span className="text-slate-400 uppercase text-[10px] font-bold">Crawl Status</span>
                <p className="font-mono font-bold text-slate-900 dark:text-white mt-0.5">
                  {crawl.data?.status || "—"}
                </p>
              </div>
              <div className="rounded-lg bg-slate-50 dark:bg-slate-800 p-3">
                <span className="text-slate-400 uppercase text-[10px] font-bold">Duration</span>
                <p className="font-mono font-bold text-slate-900 dark:text-white mt-0.5">
                  {crawlDuration || "—"}
                </p>
              </div>
              <div className="rounded-lg bg-slate-50 dark:bg-slate-800 p-3">
                <span className="text-slate-400 uppercase text-[10px] font-bold">Discovered URLs</span>
                <p className="font-mono font-bold text-slate-900 dark:text-white mt-0.5">
                  {qualityDiagnostics?.urlsDiscovered ?? allPages.length}
                </p>
              </div>
              <div className="rounded-lg bg-slate-50 dark:bg-slate-800 p-3">
                <span className="text-slate-400 uppercase text-[10px] font-bold">Coverage</span>
                <p className="font-mono font-bold text-slate-900 dark:text-white mt-0.5">
                  {qualityDiagnostics?.crawlCoveragePercent != null
                    ? `${qualityDiagnostics.crawlCoveragePercent}%`
                    : "—"}
                </p>
              </div>
            </div>

            <div className="pt-2 text-right">
              <button
                type="button"
                onClick={() => setShowLogsModal(false)}
                className="rounded-lg bg-primary-600 dark:bg-white text-white dark:text-slate-900 px-4 py-1.5 text-xs font-semibold"
              >
                Close Logs
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function WebsitePage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-48 items-center justify-center text-xs text-slate-400">
          <Loader2 className="mr-2 h-4 w-4 animate-spin text-blue-600" />
          <span>Loading Website Audit…</span>
        </div>
      }
    >
      <WebsiteAuditClient />
    </Suspense>
  );
}
