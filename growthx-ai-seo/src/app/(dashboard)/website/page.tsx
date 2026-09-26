"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  Check,
  ChevronRight,
  Copy,
  Download,
  ExternalLink,
  FileDown,
  Globe,
  Home,
  Layers,
  Layout,
  LayoutGrid,
  Loader2,
  RefreshCw,
  Share2,
  Sparkles,
  X,
  Zap,
} from "lucide-react";

import { cn, formatRelativeTime } from "@/lib/utils";
import { DesignStudioLink } from "@/components/design-studio/design-studio-link";
import { api, type CrawlPage } from "@/lib/api-client";
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
import { GeoTab } from "@/components/website/tabs/geo-tab";
import { IssuesTab } from "@/components/website/tabs/issues-tab";
import { OverviewTab } from "@/components/website/tabs/overview-tab";

import type { WebsiteTabId as TabId } from "@/components/website/tabs/tab-id";

function WebsiteAuditClient() {
  const searchParams = useSearchParams();
  const queryDomain = searchParams.get("domain");
  const tabParam = searchParams.get("tab") as TabId | null;

  const { orgId, projectId } = useWorkspace();
  const portfolio = usePortfolio(orgId);

  const clients = portfolio.data?.clients ?? [];
  const client =
    (queryDomain ? clients.find((c) => c.domain === queryDomain) : null) ??
    clients.find((c) => c.projectId === projectId) ??
    clients[0] ??
    null;

  const crawl = useLatestCrawl(client?.domain ?? null);
  const issues = useCrawlIssues(crawl.data?.id ?? null, undefined, crawl.data?.status);
  const pages = useCrawlPages(crawl.data?.id ?? null, crawl.data?.status);
  const history = useCrawlHistory(client?.domain ?? null, 12);
  // Counts come from the one endpoint every screen shares. The lists below are
  // fetched a page at a time — 100 rows — so their length is a page size, not a
  // count. Reading it as one is how this screen said 100 issues while the
  // dashboard, reading the real total, said 156.
  const issueCounts = useIssueCounts(projectId);
  const counts = issueCounts.data ?? null;
  // True affected-page counts per problem, for the printed report.
  const issueGroups = useIssueGroups(projectId);

  const [activeTab, setActiveTab] = useState<TabId>(tabParam || "technical-seo");
  const [crawling, setCrawling] = useState(false);
  const [crawlError, setCrawlError] = useState<string | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [showLogsModal, setShowLogsModal] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

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
  useEffect(() => {
    if (crawl.data?.status === "COMPLETED") {
      history.refetch();
      issues.refetch();
      pages.refetch();
      portfolio.refetch();
    }
  }, [crawl.data?.status]);

  async function handleReCrawl() {
    if (!client?.domain) return;
    setCrawling(true);
    setCrawlError(null);
    try {
      await api.startCrawl({
        domain: client.domain,
        maxDepth: 20,
        maxConcurrency: 10,
        useSitemap: true,
      });
      // Wait for the new job's own status before letting go of "Checking…" —
      // resetting it right after the request resolves left the button back
      // to normal, with the old crawl still on screen, before there was
      // anything for the user to see had happened.
      await Promise.all([crawl.refetch(), issues.refetch(), pages.refetch()]);
    } catch (err) {
      setCrawlError(err instanceof Error ? err.message : "Could not start the audit. Please try again.");
    } finally {
      setCrawling(false);
    }
  }

  function handleExportPdf() {
    setShowPdfModal(true);
  }

  function handleCopyShareLink() {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
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
    {
      id: "geo",
      label: "Ready for AI answers",
      badge: allPages.length > 0 ? `${allPages.filter(p => p.wordCount >= 350).length}/${allPages.length}` : undefined,
      badgeTone: "default",
    },
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
    geo: {
      title: "Ready for AI answers",
      subtitle: "Whether your pages are written so ChatGPT, Google's AI answers and other assistants can quote them.",
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
        <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
          <Home size={13} className="text-slate-400" />
          <span className="font-medium text-slate-700 dark:text-slate-200">{clientName}</span>
          <ChevronRight size={12} className="text-slate-400" />
          <span>Website Audit</span>
          <ChevronRight size={12} className="text-slate-400" />
          <span className="font-semibold text-slate-900 dark:text-white capitalize">
            {activeTab.replace(/-/g, " ")}
          </span>
        </div>

        {/* Main Title & Action Buttons Row */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pt-1">
          <div className="space-y-1.5 min-w-0">
            <h1 className="text-2xl font-bold tracking-tight text-brand-950 dark:text-white">
              {headerContent.title}
            </h1>
            <p className="text-xs text-brand-500 dark:text-brand-400 max-w-2xl leading-relaxed">
              {headerContent.subtitle}
            </p>
            {crawl.data?.finishedAt && (
              <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-brand-500 pt-0.5">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-success-500" />
                <span className="font-medium text-brand-700 dark:text-brand-300">
                  Last checked: {formatRelativeTime(crawl.data.finishedAt)}
                </span>
                <span className="text-brand-300 dark:text-brand-700">·</span>
                <span>{counts?.pagesCrawled ?? allPages.length} pages</span>
                <span className="text-brand-300 dark:text-brand-700">·</span>
                <span>
                  {counts
                    ? `${counts.openGroups} problem${counts.openGroups === 1 ? "" : "s"} found`
                    : "counting…"}
                </span>
                {crawlDuration && (
                  <>
                    <span className="text-brand-300 dark:text-brand-700">·</span>
                    <span>Completed in {crawlDuration}</span>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Action buttons toolbar */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <DesignStudioLink label="Visual Preview" />

            <button
              type="button"
              onClick={handleExportPdf}
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border bg-white px-3 py-1.5 text-xs font-semibold text-brand-700 shadow-xs hover:bg-brand-50 hover:text-brand-950 active:scale-95 transition-all dark:bg-brand-900 dark:text-brand-200 dark:hover:bg-brand-800"
            >
              <FileDown size={13.5} className="text-brand-500" />
              <span>Export PDF</span>
            </button>

            <button
              type="button"
              onClick={() => setShowShareModal(true)}
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border bg-white px-3 py-1.5 text-xs font-semibold text-brand-700 shadow-xs hover:bg-brand-50 hover:text-brand-950 active:scale-95 transition-all dark:bg-brand-900 dark:text-brand-200 dark:hover:bg-brand-800"
            >
              <Share2 size={13.5} className="text-brand-500" />
              <span>Share Report</span>
            </button>

            <button
              type="button"
              onClick={handleReCrawl}
              disabled={crawling || !client?.domain}
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-brand-950 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-brand-900 active:scale-95 disabled:opacity-50 transition-all dark:bg-white dark:text-brand-950 dark:hover:bg-brand-100"
            >
              <RefreshCw size={13} className={cn(crawling && "animate-spin")} />
              <span>{crawling ? "Checking…" : "Check my website again"}</span>
            </button>

            <Link
              href="/action-queue"
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border bg-white px-3.5 py-1.5 text-xs font-semibold text-brand-700 shadow-xs hover:border-brand-300 hover:bg-brand-50 hover:text-brand-950 active:scale-95 transition-all dark:bg-brand-900 dark:text-brand-200 dark:hover:bg-brand-800"
            >
              <Zap size={13} className="text-warning-500 fill-warning-500" />
              <span>View SEO Roadmap</span>
              <ArrowRight size={12} className="text-brand-400" />
            </Link>
          </div>
        </div>

        {crawlError && (
          <div className="flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-400">
            <X size={13} className="shrink-0" />
            <span>{crawlError}</span>
          </div>
        )}
      </div>

      {/* Navigation Sub-tabs Bar */}
      <div className="border-b border-slate-200/80 dark:border-slate-800 flex overflow-x-auto no-scrollbar gap-2 pt-2">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold whitespace-nowrap transition-colors border-b-2 -mb-px",
                isActive
                  ? "border-blue-600 text-blue-600 dark:border-blue-500 dark:text-blue-400"
                  : "border-transparent text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
              )}
            >
              <span>{tab.label}</span>
              {tab.badge !== undefined && (
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.2 text-[10px] font-bold leading-tight",
                    tab.badgeTone === "danger"
                      ? "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400"
                      : tab.badgeTone === "info"
                      ? "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400"
                      : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                  )}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Main Tab View Router with Real Query State */}
      <QueryState
        isLoading={Boolean(client?.domain) && (portfolio.isLoading || crawl.isLoading)}
        error={client?.domain ? portfolio.error || crawl.error : null}
        isEmpty={!client?.domain}
        emptyTitle="No website registered"
        emptyBody="This workspace has no client with a website attached yet. Add one from Projects, then run a crawl to populate audit data."
        emptyAction={
          <Link
            href="/projects"
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 transition-colors"
          >
            Go to Projects to Add Website
          </Link>
        }
      >
        {/* Render Tab Content based on activeTab */}
        {activeTab === "overview" && (
          <OverviewTab
            crawl={crawl.data ?? null}
            issues={allIssues}
            pages={allPages}
            onSwitchTab={setActiveTab}
          />
        )}

        {activeTab === "technical-seo" && (
          <TechnicalSeoTab
            crawl={crawl.data ?? null}
            issues={allIssues}
            pages={allPages}
            qualityDiagnostics={qualityDiagnostics}
            historyRuns={historyRuns}
            onSwitchTab={setActiveTab}
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

        {activeTab === "geo" && (
          <GeoTab
            pages={allPages}
            issues={allIssues}
          />
        )}

        {activeTab === "report" && <AuditReportTab projectId={projectId || ""} />}

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

      {/* Share Report Modal */}
      {showShareModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-800 dark:bg-slate-900 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Share Website Audit Report</h3>
              <button
                type="button"
                onClick={() => setShowShareModal(false)}
                className="text-slate-400 hover:text-slate-600 rounded p-1"
              >
                <X size={15} />
              </button>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Anyone with this link can view the current technical SEO audit, performance benchmarks, and crawl findings.
            </p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={typeof window !== "undefined" ? window.location.href : ""}
                className="h-8 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 font-mono text-xs text-slate-600 select-all dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
              />
              <button
                type="button"
                onClick={handleCopyShareLink}
                className="h-8 rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-3 text-xs font-semibold transition inline-flex items-center gap-1"
              >
                {copiedLink ? <Check size={12} /> : <Copy size={12} />}
                <span>{copiedLink ? "Copied!" : "Copy"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

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
                className="rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-4 py-1.5 text-xs font-semibold"
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
