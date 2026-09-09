"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Activity,
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
import { api, type CrawlIssue, type CrawlPage } from "@/lib/api-client";
import {
  useCrawlHistory,
  useCrawlIssues,
  useCrawlPages,
  useLatestCrawl,
  usePortfolio,
  useRepository,
  useWorkspace,
} from "@/hooks/use-growthx";
import { QueryState } from "@/components/ui/query-state";
import { AutoFixModal } from "@/components/website/auto-fix-modal";

import { TechnicalSeoTab } from "@/components/website/tabs/technical-seo-tab";
import { PerformanceTab } from "@/components/website/tabs/performance-tab";
import { PagesTab } from "@/components/website/tabs/pages-tab";
import { ContentTab } from "@/components/website/tabs/content-tab";
import { GeoTab } from "@/components/website/tabs/geo-tab";
import { IssuesTab } from "@/components/website/tabs/issues-tab";
import { OverviewTab } from "@/components/website/tabs/overview-tab";

type TabId =
  | "overview"
  | "technical-seo"
  | "performance"
  | "pages"
  | "content"
  | "geo"
  | "issues";

function WebsiteAuditClient() {
  const searchParams = useSearchParams();
  const queryDomain = searchParams.get("domain");
  const tabParam = searchParams.get("tab") as TabId | null;

  const { orgId, projectId } = useWorkspace();
  const repo = useRepository(projectId);
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

  const [activeTab, setActiveTab] = useState<TabId>(tabParam || "technical-seo");
  const [crawling, setCrawling] = useState(false);
  const [selectedFixIssue, setSelectedFixIssue] = useState<CrawlIssue | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
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
    window.print();
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
      label: "Technical SEO",
      badge: allIssues.length > 0 ? allIssues.length : undefined,
      badgeTone: "danger",
    },
    { id: "performance", label: "Performance" },
    {
      id: "pages",
      label: "Pages",
      badge: allPages.length > 0 ? allPages.length : undefined,
      badgeTone: "info",
    },
    { id: "content", label: "Content & On-Page" },
    {
      id: "geo",
      label: "GEO & AI Overviews",
      badge: allPages.length > 0 ? `${allPages.filter(p => p.wordCount >= 350).length}/${allPages.length}` : undefined,
      badgeTone: "default",
    },
    { id: "issues", label: "Issues" },
  ];

  // Dynamic Header Titles and Subtitles based on Active Tab
  const headerContent = {
    overview: {
      title: "Website Audit Overview",
      subtitle: "High-level summary of your website's technical health, performance, indexability and opportunities.",
    },
    "technical-seo": {
      title: "Technical SEO",
      subtitle: "Find and fix technical issues to improve your website's performance, indexability and search visibility.",
    },
    performance: {
      title: "Performance",
      subtitle: "Analyze your website's speed, Core Web Vitals, real user experience and get AI-powered optimization recommendations.",
    },
    pages: {
      title: "Pages",
      subtitle: "Explore all crawled pages, their status, indexability and SEO opportunities. Find which pages drive traffic and which need improvement.",
    },
    content: {
      title: "Content & On-Page",
      subtitle: "Audit title tags, meta descriptions, content depth, heading structures and on-page optimization.",
    },
    geo: {
      title: "GEO & AI Overviews",
      subtitle: "Optimize your pages for citation in Google AI Overviews, Perplexity, ChatGPT and generative search engines.",
    },
    issues: {
      title: "All Audit Issues",
      subtitle: "Complete repository of identified technical, performance, and structural crawl issues with automated AI fixes.",
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
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pt-1">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              {headerContent.title}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-2xl leading-relaxed">
              {headerContent.subtitle}
            </p>
          </div>

          {/* Right side: Crawl metadata & action buttons */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            {crawl.data?.finishedAt && (
              <div className="text-right text-[11px] text-slate-500 dark:text-slate-400 hidden lg:block">
                <span>Last crawl: {formatRelativeTime(crawl.data.finishedAt)}</span>
                <span className="mx-1.5">·</span>
                <span>{allPages.length} pages</span>
                <span className="mx-1.5">·</span>
                <span>{allIssues.length} issues</span>
                {crawlDuration && (
                  <>
                    <span className="mx-1.5">·</span>
                    <span>Completed in {crawlDuration}</span>
                  </>
                )}
              </div>
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExportPdf}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 transition-colors"
              >
                <FileDown size={13} />
                <span>Export PDF</span>
              </button>

              <button
                type="button"
                onClick={() => setShowShareModal(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 transition-colors"
              >
                <Share2 size={13} />
                <span>Share Report</span>
              </button>

              <button
                type="button"
                onClick={handleReCrawl}
                disabled={crawling || !client?.domain}
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-slate-800 disabled:opacity-50 transition-colors dark:bg-blue-600 dark:hover:bg-blue-700"
              >
                <RefreshCw size={13} className={cn(crawling && "animate-spin")} />
                <span>{crawling ? "Crawling…" : activeTab === "performance" ? "Re-run Audit" : "Re-crawl Website"}</span>
              </button>
            </div>
          </div>
        </div>
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
            onSwitchTab={setActiveTab as any}
            onFixIssue={(issue) => setSelectedFixIssue(issue)}
          />
        )}

        {activeTab === "technical-seo" && (
          <TechnicalSeoTab
            crawl={crawl.data ?? null}
            issues={allIssues}
            pages={allPages}
            qualityDiagnostics={qualityDiagnostics}
            historyRuns={historyRuns}
            onSwitchTab={setActiveTab as any}
            onFixIssue={(issue) => setSelectedFixIssue(issue)}
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
            onOptimizePage={(page) => {
              const perfIssue: CrawlIssue = {
                id: `perf-fix-${page.id}`,
                issueType: "PERFORMANCE_LCP_OPTIMIZATION",
                severity: "HIGH",
                affectedUrl: page.url,
                description: `Page response latency is ${page.responseTimeMs}ms with Core Web Vitals needing optimization.`,
                recommendation: "Optimize hero images, enable WebP compression, defer non-critical CSS/JS, and implement edge caching.",
                status: "OPEN",
                aiFixAvailable: true,
                confidence: "CONFIRMED",
                category: "PERFORMANCE",
              };
              setSelectedFixIssue(perfIssue);
            }}
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
            onOptimizePage={(page) => {
              const contentIssue: CrawlIssue = {
                id: `content-fix-${page.id}`,
                issueType: "ON_PAGE_CONTENT_OPTIMIZATION",
                severity: page.wordCount < 350 ? "HIGH" : "MEDIUM",
                affectedUrl: page.url,
                description: `On-page SEO optimization for ${page.title || "Page"}. Word count: ${page.wordCount}.`,
                recommendation: "Optimize title tag length (50-60 chars), meta description (150-160 chars), and ensure single H1 hierarchy.",
                status: "OPEN",
                aiFixAvailable: true,
                confidence: "CONFIRMED",
                category: "CONTENT",
              };
              setSelectedFixIssue(contentIssue);
            }}
          />
        )}

        {activeTab === "geo" && (
          <GeoTab
            pages={allPages}
            issues={allIssues}
            onAutoFix={(issue) => setSelectedFixIssue(issue)}
          />
        )}

        {activeTab === "issues" && (
          <IssuesTab
            issues={allIssues}
            onFixIssue={(issue) => setSelectedFixIssue(issue)}
          />
        )}
      </QueryState>

      {/* Auto Fix Modal */}
      {selectedFixIssue && (
        <AutoFixModal
          issue={selectedFixIssue}
          projectId={projectId}
          repoConnected={Boolean(repo.data)}
          onClose={() => setSelectedFixIssue(null)}
        />
      )}

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
