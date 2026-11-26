"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  FileBarChart2,
  Globe,
  Layers,
  LayoutDashboard,
  MousePointerClick,
  PlugZap,
  RefreshCw,
  Sparkles,
  Users,
} from "lucide-react";
import { StatusNote, relativeTime } from "@/components/ui/console";
import {
  useWorkspace,
  usePortfolio,
  useExecutiveSummary,
  useIssueCounts,
  useIssueGroups,
  useLatestCrawl,
  useLocalSeo,
  useVisibility,
  useStartCrawl,
  useStartWorkspacePipeline,
  useWorkspacePipeline,
} from "@/hooks/use-growthx";
import { api, type IssueGroup, type IssueSeverity } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { SEVERITY_ORDER, SEVERITY_PLAIN } from "@/lib/plain-language";
import { useGa4Report } from "@/hooks/use-ga4-report";
import {
  CardSkeletonShimmer,
  ChartSkeletonShimmer,
  EmptyPrompt,
  LoadingLine,
} from "@/components/dashboard/dashboard-cards";
import { HealthSummary, gradeScore } from "@/components/dashboard/health-summary";
import { ProblemDetailDrawer, TodoRow } from "@/components/dashboard/priority-todos";
import { ClosedLoopResultsCard } from "@/components/dashboard/closed-loop-results-card";
import { WorkspacePipelineBar } from "@/components/dashboard/workspace-pipeline-bar";
import {
  DashboardIntelligenceBento,
  KpiSparkline,
  MiniHealthRing,
} from "@/components/dashboard/dashboard-intelligence-bento";
import {
  DEFAULT_WINDOW_DAYS,
  DailyCandles,
  normalizeTrend,
} from "@/components/dashboard/traffic-charts";

type MetricKey = "searchClicks" | "impressions" | "sessions" | "conversions";

interface SetupStep {
  label: string;
  why: string;
  done: boolean;
  href: string;
  cta: string;
}

const SEVERITY = SEVERITY_PLAIN;

/**
 * Executive Dashboard — balanced visual density with inline sparklines,
 * radial site health, smart search/traffic velocity, 3-column live telemetry
 * bento, and a Linear-style priority fix queue with slide-over drawer.
 */
export default function UnifiedDashboardPage() {
  const router = useRouter();
  const { orgId, projectId, projects, isLoading: workspaceLoading } = useWorkspace();
  const [selectedMetricKey, setSelectedMetricKey] = useState<MetricKey | null>(null);
  const [severityTab, setSeverityTab] = useState<"ALL" | IssueSeverity>("ALL");
  const [inspectedState, setInspectedState] = useState<{
    projectId: string | null;
    group: IssueGroup;
  } | null>(null);
  const [auditErrorState, setAuditErrorState] = useState<{
    projectId: string | null;
    message: string;
  } | null>(null);

  const inspectedGroup =
    inspectedState && inspectedState.projectId === projectId ? inspectedState.group : null;
  const auditActionError =
    auditErrorState && auditErrorState.projectId === projectId ? auditErrorState.message : null;

  const portfolio = usePortfolio(orgId);
  const activeProject = projects.find((p) => p.id === projectId);
  const client = portfolio.data?.clients.find((c) => c.projectId === projectId) ?? null;
  const currentDomain = activeProject?.name ?? client?.domain ?? null;

  useEffect(() => {
    let pendingDomain = "";
    try {
      pendingDomain = (localStorage.getItem("growthx_pending_domain") || "").trim();
    } catch {}
    if (pendingDomain) {
      router.replace(`/analyze?url=${encodeURIComponent(pendingDomain)}`);
      return;
    }
    if (
      !workspaceLoading &&
      !portfolio.isLoading &&
      orgId &&
      projects.length === 0 &&
      (portfolio.data?.clients.length ?? 0) === 0
    ) {
      router.replace("/analyze");
    }
  }, [workspaceLoading, portfolio.isLoading, portfolio.data?.clients.length, orgId, projects.length, router]);

  const crawl = useLatestCrawl(currentDomain);
  const startCrawlMutation = useStartCrawl();
  const pipelineQuery = useWorkspacePipeline(projectId);
  const startPipelineMutation = useStartWorkspacePipeline(projectId);
  const pipelineActive = Boolean(
    pipelineQuery.data && ["DISCOVERING", "AWAITING_CONFIRMATION", "RUNNING"].includes(pipelineQuery.data.status),
  );
  const executive = useExecutiveSummary(projectId);
  const localSeo = useLocalSeo(projectId);
  const visibility = useVisibility(projectId);
  const issueCounts = useIssueCounts(projectId);
  const issueGroups = useIssueGroups(projectId, { limit: 6 });
  const ga4 = useGa4Report(projectId);

  const trackedCompetitors = useQuery({
    queryKey: ["tracked-competitors", projectId],
    queryFn: () => api.listCompetitors(projectId!),
    enabled: !!projectId,
  });

  const aiReferralsQuery = useQuery({
    queryKey: ["ai-referrals", projectId, "28d"],
    queryFn: () => api.aiReferrals(projectId!, "28d"),
    enabled: !!projectId,
    staleTime: 60_000,
    retry: false,
  });

  const fixChangesQuery = useQuery({
    queryKey: ["fix-changes", projectId],
    queryFn: () => api.listFixChanges(projectId!),
    enabled: !!projectId,
    retry: false,
  });

  const hasGsc = Boolean(executive.data?.connections?.searchConsole);
  const hasGa = Boolean(executive.data?.connections?.analytics || ga4.report.data?.state === "READY");

  const gscSeries = useQuery({
    queryKey: ["gsc-dash-series", projectId],
    queryFn: () => api.gscTimeseries(projectId!, 28),
    enabled: !!projectId && hasGsc,
    retry: false,
  });

  const gaSeries = useQuery({
    queryKey: ["ga4-dash-series", projectId],
    queryFn: () => api.ga4Timeseries(projectId!, 28),
    enabled: !!projectId && hasGa,
    retry: false,
  });

  const shownCrawl = crawl.data?.status === "COMPLETED" ? crawl.data : (crawl.data?.lastCompleted ?? null);
  const crawlCompleted = Boolean(shownCrawl);
  const crawlRunning = crawl.data?.status === "RUNNING" || crawl.data?.status === "PENDING";
  const healthScore = shownCrawl ? (shownCrawl.healthScore ?? client?.health ?? null) : null;
  const counts = issueCounts.data ?? null;

  const priorityGroups = issueGroups.data?.groups ?? [];
  const reachAvailable = issueGroups.data?.reachAvailable ?? false;

  const hasWebsite = Boolean(client?.domain);
  const hasCompetitors = Boolean((trackedCompetitors.data?.length ?? 0) > 0);

  const setupSteps: SetupStep[] = [
    { label: "Add website", why: "Add your domain", done: hasWebsite, href: "/analyze", cta: "Add website" },
    { label: "Website audit", why: "Scan pages for technical issues", done: crawlCompleted, href: "/website", cta: "Run audit" },
    { label: "Search Console", why: "Track Google search clicks & queries", done: hasGsc, href: "/integrations", cta: "Connect GSC" },
    { label: "Google Analytics", why: "Track visitors & geography", done: hasGa, href: "/integrations", cta: "Connect GA4" },
    { label: "Competitors", why: "Compare against search rivals", done: hasCompetitors, href: "/competitor-intelligence", cta: "Add rivals" },
  ];
  const doneCount = setupSteps.filter((s) => s.done).length;
  const nextStep = setupSteps.find((s) => !s.done);

  const auditBusy = startCrawlMutation.isPending || crawlRunning;
  const pipelineBusy = startPipelineMutation.isPending || pipelineActive;

  const runAudit = async () => {
    if (!currentDomain || auditBusy) return;
    setAuditErrorState(null);
    try {
      await startCrawlMutation.mutateAsync({
        domain: currentDomain,
        maxDepth: 10,
        maxConcurrency: 3,
        useSitemap: true,
      });
    } catch (error) {
      setAuditErrorState({
        projectId,
        message:
          error instanceof Error ? error.message : "The website check could not start. Please try again.",
      });
    }
  };

  const runFullPipeline = async () => {
    if (!currentDomain || pipelineBusy) return;
    setAuditErrorState(null);
    try {
      await startPipelineMutation.mutateAsync({ domain: currentDomain, forceRefresh: true });
    } catch (error) {
      setAuditErrorState({
        projectId,
        message:
          error instanceof Error ? error.message : "Could not start the full workspace pipeline.",
      });
    }
  };

  const headline = executive.data?.headline;
  const ga4Data = ga4.report.data?.data ?? null;
  const ga4Totals = ga4Data?.totals ?? null;
  const ga4Countries = ga4Data?.countries ?? [];
  const ga4Cities = ga4Data?.cities ?? [];

  const clicksMeasure = headline?.searchClicks;
  const sessionsMeasure = headline?.sessions;
  const visitsDisplay =
    sessionsMeasure?.state === "MEASURED"
      ? sessionsMeasure.value
      : ga4Totals?.sessions ?? null;

  const engagementPct = useMemo(() => {
    const raw = ga4Totals?.engagementRate;
    if (raw == null || !Number.isFinite(raw)) return null;
    return raw <= 1 ? Math.round(raw * 1000) / 10 : Math.round(raw * 10) / 10;
  }, [ga4Totals?.engagementRate]);

  // Smart default metric: if GSC has no clicks yet but GA4 has visits, display Visits automatically!
  const gscClicksCount = clicksMeasure?.state === "MEASURED" ? clicksMeasure.value : 0;
  const defaultMetricKey: MetricKey =
    hasGsc && gscClicksCount > 0 ? "searchClicks" : hasGa ? "sessions" : "searchClicks";
  const metricKey: MetricKey = selectedMetricKey ?? defaultMetricKey;

  const metrics: { key: MetricKey; short: string; label: string }[] = [
    { key: "searchClicks", short: "Clicks", label: "Google search clicks" },
    { key: "impressions", short: "Impressions", label: "Search impressions" },
    { key: "sessions", short: "Visits", label: "Website visits" },
    { key: "conversions", short: "Goals", label: "Key events" },
  ];
  const metric = metrics.find((m) => m.key === metricKey) ?? metrics[0];
  const rangeDays = executive.data?.range?.days ? executive.data.range.days : DEFAULT_WINDOW_DAYS;

  const gaDailyPoints = useMemo(() => {
    if (gaSeries.data && gaSeries.data.length > 0) {
      return gaSeries.data.map((p) => ({ date: p.date, sessions: p.sessions, conversions: p.conversions ?? 0 }));
    }
    const daily = ga4Data?.daily;
    if (daily && daily.length > 0) {
      return daily.map((p) => ({ date: p.date, sessions: p.sessions, conversions: 0 }));
    }
    return [];
  }, [gaSeries.data, ga4Data]);

  const clicksSparkValues = useMemo(
    () => (gscSeries.data ?? []).map((p) => p.clicks),
    [gscSeries.data],
  );
  const visitsSparkValues = useMemo(
    () => gaDailyPoints.map((p) => p.sessions),
    [gaDailyPoints],
  );

  const activeSeriesPoints = useMemo(() => {
    if (metricKey === "searchClicks" && gscSeries.data && gscSeries.data.length > 0) {
      return normalizeTrend(gscSeries.data.map((p) => ({ date: p.date, value: p.clicks })), rangeDays);
    }
    if (metricKey === "impressions" && gscSeries.data && gscSeries.data.length > 0) {
      return normalizeTrend(gscSeries.data.map((p) => ({ date: p.date, value: p.impressions })), rangeDays);
    }
    if (metricKey === "sessions" && gaDailyPoints.length > 0) {
      return normalizeTrend(gaDailyPoints.map((p) => ({ date: p.date, value: p.sessions })), rangeDays);
    }
    if (metricKey === "conversions" && gaDailyPoints.length > 0) {
      return normalizeTrend(gaDailyPoints.map((p) => ({ date: p.date, value: p.conversions })), rangeDays);
    }
    return null;
  }, [metricKey, gscSeries.data, gaDailyPoints, rangeDays]);

  const activeMeasure = headline?.[metric.key];
  const activeHeadlineValue =
    activeMeasure?.state === "MEASURED"
      ? activeMeasure.value
      : metricKey === "sessions"
        ? visitsDisplay
        : null;

  const trendStats = useMemo(() => {
    if (!activeSeriesPoints || activeSeriesPoints.length === 0) return null;
    const vals = activeSeriesPoints.map((p) => p.value ?? 0);
    const total = vals.reduce((s, v) => s + v, 0);
    const peak = Math.max(...vals, 0);
    const avg = Math.round((total / vals.length) * 10) / 10;
    return { total, peak, avg };
  }, [activeSeriesPoints]);

  const aiCited = visibility.data?.summary?.cited ?? 0;
  const aiChecked = visibility.data?.summary?.checked ?? 0;
  const aiSharePct = visibility.data?.summary?.citationSharePct ?? null;
  const aiSessions = aiReferralsQuery.data?.connected ? aiReferralsQuery.data.totalAiSessions : null;
  const hasShippedFixes = (fixChangesQuery.data?.length ?? 0) > 0;
  const localRating = localSeo.data?.rating ?? null;

  const shownGroups = severityTab === "ALL" ? priorityGroups : priorityGroups.filter((g) => g.severity === severityTab);
  const groupCount = (sev: IssueSeverity) => priorityGroups.filter((g) => g.severity === sev).length;
  const scoreGrade = healthScore != null && crawlCompleted ? gradeScore(healthScore) : null;

  return (
    <div className="space-y-5 pb-14">
      {/* ── ZONE 1: BRANDED COMMAND HEADER ── */}
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-signal-400 text-signal-ink shadow-2xs">
            <LayoutDashboard size={18} />
          </span>
          <div>
            <h1 className="text-[22px] font-bold leading-tight tracking-tight text-brand-950">
              Dashboard
            </h1>
            <p className="mt-0.5 flex flex-wrap items-center gap-2 text-[12px] text-brand-400">
              {currentDomain ? (
                <>
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-success-500" aria-hidden="true" />
                  <span className="font-medium text-brand-700">{currentDomain}</span>
                  <span>·</span>
                  <span>
                    {crawlCompleted
                      ? `Checked ${relativeTime(shownCrawl?.finishedAt ?? crawl.data?.startedAt)}`
                      : "Not audited yet"}
                  </span>
                </>
              ) : (
                "Add your website to start tracking search health and traffic."
              )}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/monthly-report"
            className="inline-flex items-center gap-1.5 rounded-xl border border-brand-200 bg-surface-1 px-3 py-2 text-[12px] font-semibold text-brand-600 transition hover:bg-brand-50 hover:text-brand-950"
          >
            <FileBarChart2 size={13} />
            <span className="hidden sm:inline">Report</span>
          </Link>
          <button
            type="button"
            onClick={runFullPipeline}
            disabled={pipelineBusy || !currentDomain}
            className="inline-flex items-center gap-1.5 rounded-xl border border-brand-200 bg-surface-1 px-3.5 py-2 text-[12px] font-semibold text-brand-700 transition hover:bg-brand-50 hover:text-brand-950 disabled:opacity-50 cursor-pointer"
          >
            <Layers size={13} className={pipelineBusy ? "animate-pulse text-primary-600" : "text-brand-500"} />
            <span>{pipelineBusy ? "Running…" : "Run pipeline"}</span>
          </button>
          <button
            type="button"
            onClick={runAudit}
            disabled={auditBusy || !currentDomain}
            className="inline-flex items-center gap-1.5 rounded-xl bg-signal-400 px-4 py-2 text-[12px] font-bold text-signal-ink shadow-xs transition hover:bg-signal-500 disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw size={13} className={auditBusy ? "animate-spin" : undefined} />
            <span>{auditBusy ? "Auditing…" : "Run audit"}</span>
          </button>
        </div>
      </header>

      {auditActionError && (
        <div role="alert">
          <StatusNote tone="bad">Could not start the website check: {auditActionError}</StatusNote>
        </div>
      )}

      {crawlRunning && (
        <StatusNote>
          Checking your website now — metrics update automatically once complete.
        </StatusNote>
      )}

      {/* Live pipeline progress (only visible when active) */}
      <WorkspacePipelineBar
        projectId={projectId}
        pipeline={pipelineQuery.data}
        onRetry={runFullPipeline}
        retrying={pipelineBusy}
      />

      {/* Quiet 1-line setup nudge only when incomplete */}
      {nextStep && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-200/70 bg-surface-1 px-4 py-2.5 text-[12px]">
          <div className="flex items-center gap-3 min-w-0">
            <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold text-brand-500">
              <Check size={12} className="text-success-600" />
              {doneCount}/{setupSteps.length} setup
            </span>
            <span className="h-3.5 w-px bg-brand-200" aria-hidden="true" />
            <span className="truncate text-brand-600">
              Next: <strong className="font-semibold text-brand-950">{nextStep.label}</strong> — {nextStep.why}
            </span>
          </div>
          <Link
            href={nextStep.href}
            className="inline-flex shrink-0 items-center gap-1 font-semibold text-brand-950 hover:text-primary-700 transition"
          >
            <span>{nextStep.cta}</span>
            <ArrowRight size={12} />
          </Link>
        </div>
      )}

      {/* ── ZONE 2: 4 VISUAL EXECUTIVE KPI CARDS (WITH RING & MICRO-SPARKLINES) ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* 1. Site Health */}
        <Link
          href="/website"
          className="group flex flex-col justify-between rounded-2xl border border-brand-200/80 bg-surface-1 p-5 shadow-2xs transition hover:border-brand-300"
        >
          <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-brand-400">
            <span>Site Health</span>
            <ArrowUpRight size={13} className="text-brand-400 transition group-hover:text-brand-950" />
          </div>
          <div className="mt-3 flex items-center justify-between gap-3">
            <div>
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-[28px] font-bold leading-none tracking-tight text-brand-950 tabular-nums">
                  {healthScore != null && crawlCompleted ? healthScore : "—"}
                </span>
                {scoreGrade && (
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10.5px] font-semibold",
                      scoreGrade.tone === "good"
                        ? "bg-success-50 text-success-700"
                        : scoreGrade.tone === "warn"
                          ? "bg-warning-50 text-warning-700"
                          : "bg-error-50 text-error-700",
                    )}
                  >
                    {scoreGrade.label}
                  </span>
                )}
              </div>
              <p className="mt-2 text-[11.5px] text-brand-400">
                {counts ? `${counts.openGroups} issues · ${shownCrawl?.pagesCrawled ?? 0} pages` : "Run an audit to score"}
              </p>
            </div>
            <MiniHealthRing score={crawlCompleted ? healthScore : null} />
          </div>
        </Link>

        {/* 2. Google Clicks */}
        <Link
          href="/organic-search"
          className="group flex flex-col justify-between rounded-2xl border border-brand-200/80 bg-surface-1 p-5 shadow-2xs transition hover:border-brand-300"
        >
          <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-brand-400">
            <span className="inline-flex items-center gap-1.5">
              <MousePointerClick size={12} className="text-success-500" />
              Google Clicks
            </span>
            <ArrowUpRight size={13} className="text-brand-400 transition group-hover:text-brand-950" />
          </div>
          <div className="mt-3 flex items-end justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-[28px] font-bold leading-none tracking-tight text-brand-950 tabular-nums">
                  {clicksMeasure?.state === "MEASURED" ? clicksMeasure.value.toLocaleString() : "—"}
                </span>
                {clicksMeasure?.state === "MEASURED" &&
                  clicksMeasure.changePct != null &&
                  Number.isFinite(clicksMeasure.changePct) && (
                    <span
                      className={cn(
                        "font-mono text-[11px] font-semibold",
                        clicksMeasure.changePct >= 0 ? "text-success-700" : "text-error-700",
                      )}
                    >
                      {clicksMeasure.changePct >= 0 ? "+" : ""}
                      {Math.round(clicksMeasure.changePct * 10) / 10}%
                    </span>
                  )}
              </div>
              <p className="mt-2 truncate text-[11.5px] text-brand-400">
                {hasGsc ? `Last ${rangeDays}d · Search Console` : "Connect Search Console"}
              </p>
            </div>
            <KpiSparkline values={clicksSparkValues} tone="success" />
          </div>
        </Link>

        {/* 3. Website Visits */}
        <Link
          href="/traffic"
          className="group flex flex-col justify-between rounded-2xl border border-brand-200/80 bg-surface-1 p-5 shadow-2xs transition hover:border-brand-300"
        >
          <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-brand-400">
            <span className="inline-flex items-center gap-1.5">
              <Users size={12} className="text-accent-500" />
              Website Visits
            </span>
            <ArrowUpRight size={13} className="text-brand-400 transition group-hover:text-brand-950" />
          </div>
          <div className="mt-3 flex items-end justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-[28px] font-bold leading-none tracking-tight text-brand-950 tabular-nums">
                  {visitsDisplay != null ? visitsDisplay.toLocaleString() : "—"}
                </span>
                {engagementPct != null && (
                  <span className="rounded-md bg-brand-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-brand-600 tabular-nums">
                    {engagementPct}% eng
                  </span>
                )}
              </div>
              <p className="mt-2 truncate text-[11.5px] text-brand-400">
                {ga4Countries.length > 0
                  ? `${ga4Countries.length} ${ga4Countries.length === 1 ? "country" : "countries"} · ${ga4Cities.length} cities`
                  : hasGa
                    ? "Open 3D Global Map"
                    : "Connect Google Analytics"}
              </p>
            </div>
            <KpiSparkline values={visitsSparkValues} tone="accent" />
          </div>
        </Link>

        {/* 4. AI Visibility & Referrals */}
        <Link
          href="/ai-visibility"
          className="group flex flex-col justify-between rounded-2xl border border-brand-200/80 bg-surface-1 p-5 shadow-2xs transition hover:border-brand-300"
        >
          <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-brand-400">
            <span className="inline-flex items-center gap-1.5">
              <Sparkles size={12} className="text-warning-500" />
              AI Visibility
            </span>
            <ArrowUpRight size={13} className="text-brand-400 transition group-hover:text-brand-950" />
          </div>
          <div className="mt-3 space-y-2">
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-[28px] font-bold leading-none tracking-tight text-brand-950 tabular-nums">
                {aiSharePct != null ? `${Math.round(aiSharePct)}%` : aiSessions != null ? aiSessions.toLocaleString() : "—"}
              </span>
              {aiChecked > 0 ? (
                <span className="font-mono text-[11px] text-brand-400">
                  {aiCited}/{aiChecked} prompts
                </span>
              ) : aiSessions != null ? (
                <span className="rounded-md bg-success-50 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-success-700">
                  AI visits
                </span>
              ) : null}
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-brand-100">
              <div
                className="h-full rounded-full bg-signal-400 transition-all"
                style={{ width: `${aiSharePct != null ? Math.max(4, Math.min(100, aiSharePct)) : aiSessions && aiSessions > 0 ? 18 : 0}%` }}
              />
            </div>
            <p className="truncate text-[11.5px] text-brand-400">
              {localRating != null && localRating > 0
                ? `Maps ${localRating.toFixed(1)}★ · 5 AI assistants`
                : aiSessions != null
                  ? `${aiSessions} AI visits · Last 28d`
                  : "Across 5 AI assistants"}
            </p>
          </div>
        </Link>
      </div>

      {/* ── ZONE 3: TWO-COLUMN HERO (SEARCH & TRAFFIC VELOCITY + WEBSITE HEALTH) ── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 items-stretch">
        {/* Left (7 cols): Search & Traffic Velocity */}
        <section
          id="visitors"
          className="lg:col-span-7 flex flex-col justify-between rounded-2xl border border-brand-200/80 bg-surface-1 p-6 shadow-2xs"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-[15px] font-bold tracking-tight text-brand-950">
                Search &amp; Traffic Velocity
              </h2>
              <p className="mt-0.5 text-[12px] text-brand-400">
                {metric.label} · last {rangeDays} days
              </p>
            </div>

            <div
              className="inline-flex items-center gap-1 rounded-xl border border-brand-200/70 bg-brand-100/60 p-1 text-[11.5px]"
              role="tablist"
              aria-label="Choose trend metric"
            >
              {metrics.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  role="tab"
                  aria-selected={m.key === metricKey}
                  onClick={() => setSelectedMetricKey(m.key)}
                  className={cn(
                    "rounded-lg px-2.5 py-1 font-semibold transition cursor-pointer",
                    m.key === metricKey
                      ? "bg-signal-400 text-signal-ink font-bold shadow-2xs"
                      : "text-brand-500 hover:text-brand-950",
                  )}
                >
                  {m.short}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5 flex-1">
            {executive.isLoading && !ga4Data ? (
              <ChartSkeletonShimmer />
            ) : !hasGsc && !hasGa ? (
              <EmptyPrompt
                icon={PlugZap}
                title="Connect Google to see your traffic trend"
                body="Link Search Console or Google Analytics to track clicks, impressions, and visits."
                action={{ label: "Connect Google", href: "/integrations" }}
              />
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                    <span className="font-mono text-[28px] font-bold leading-none tracking-tight text-brand-950 tabular-nums">
                      {activeHeadlineValue != null ? activeHeadlineValue.toLocaleString() : "—"}
                    </span>
                    {activeMeasure?.state === "MEASURED" &&
                      activeMeasure.changePct != null &&
                      Number.isFinite(activeMeasure.changePct) && (
                        <span
                          className={cn(
                            "font-mono text-[11.5px] font-semibold",
                            activeMeasure.changePct >= 0 ? "text-success-700" : "text-error-700",
                          )}
                        >
                          {activeMeasure.changePct >= 0 ? "+" : ""}
                          {Math.round(activeMeasure.changePct * 10) / 10}% vs prior
                        </span>
                      )}
                    {trendStats && trendStats.total > 0 && (
                      <span className="font-mono text-[11px] text-brand-400 tabular-nums">
                        Avg {trendStats.avg.toLocaleString()}/day
                      </span>
                    )}
                  </div>
                  <Link
                    href="/traffic"
                    className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-brand-500 hover:text-brand-950 transition"
                  >
                    <span>3D Global Map</span>
                    <ArrowUpRight size={12} />
                  </Link>
                </div>

                {activeSeriesPoints && activeSeriesPoints.length >= 2 ? (
                  <DailyCandles
                    points={activeSeriesPoints}
                    unit={metric.short.toLowerCase()}
                    days={rangeDays}
                  />
                ) : (
                  <p className="py-12 text-center text-[12px] text-brand-400">
                    Daily measurements for {metric.short.toLowerCase()} will appear once synced.
                  </p>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Right (5 cols): Website Health Breakdown */}
        <section
          id="health"
          className="lg:col-span-5 flex flex-col justify-between rounded-2xl border border-brand-200/80 bg-surface-1 p-6 shadow-2xs"
        >
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 className="text-[15px] font-bold tracking-tight text-brand-950">
              How healthy is your website?
            </h2>
            <Link
              href="/website"
              className="text-[11.5px] font-semibold text-brand-500 hover:text-brand-950 transition"
            >
              Full Audit →
            </Link>
          </div>

          {(portfolio.isLoading || crawl.isLoading) && !crawl.data ? (
            <CardSkeletonShimmer />
          ) : !crawlCompleted ? (
            <EmptyPrompt
              icon={Globe}
              title={crawlRunning ? "Checking your website…" : "No website audit yet"}
              body={
                crawlRunning
                  ? "Your health score and priority fixes will appear here once finished."
                  : "Run a quick crawl to measure site health and generate your priority fix list."
              }
              action={
                crawlRunning || !currentDomain
                  ? undefined
                  : { label: "Check my website", onClick: runAudit, disabled: auditBusy }
              }
            />
          ) : (
            <HealthSummary score={healthScore} counts={counts} pagesChecked={shownCrawl?.pagesCrawled ?? null} />
          )}
        </section>
      </div>

      {/* ── ZONE 4: 3-COLUMN LIVE TELEMETRY BENTO (AUDIENCE · PAGES · AI & LOCAL) ── */}
      <DashboardIntelligenceBento
        ga4Data={ga4Data}
        hasGa={hasGa}
        visibility={visibility.data ?? null}
        aiReferrals={aiReferralsQuery.data ?? null}
        localSeo={localSeo.data ?? null}
        competitorCount={trackedCompetitors.data?.length ?? 0}
      />

      {/* ── ZONE 5: LINEAR-STYLE PRIORITY FIX LIST + SLIDE-OVER INSPECTOR ── */}
      <section
        id="todo"
        className="overflow-hidden rounded-2xl border border-brand-200/80 bg-surface-1 shadow-2xs"
      >
        <div className="flex flex-col justify-between gap-3 border-b border-brand-100 px-6 py-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-[15px] font-bold tracking-tight text-brand-950">
              Your to-do list
            </h2>
            <p className="mt-0.5 text-[12px] text-brand-400">
              {reachAvailable
                ? "Highest-impact fixes first, weighted by Google visitor reach."
                : "Highest-impact fixes first. Connect Search Console to sort by how many visitors each one affects."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div role="tablist" aria-label="Filter by severity" className="inline-flex items-center gap-1 text-[11.5px]">
              {(["ALL", ...SEVERITY_ORDER] as const).map((sev) => {
                const n = sev === "ALL" ? priorityGroups.length : groupCount(sev);
                if (sev !== "ALL" && n === 0) return null;
                const on = severityTab === sev;
                return (
                  <button
                    key={sev}
                    type="button"
                    role="tab"
                    aria-selected={on}
                    onClick={() => setSeverityTab(sev)}
                    className={cn(
                      "rounded-lg px-2.5 py-1 font-medium transition cursor-pointer",
                      on ? "bg-signal-400 text-signal-ink font-bold shadow-2xs" : "text-brand-500 hover:bg-brand-100 hover:text-brand-950",
                    )}
                  >
                    {sev === "ALL" ? "All" : SEVERITY[sev].label}
                    <span className="ml-1 font-mono text-[10.5px] opacity-75">{n}</span>
                  </button>
                );
              })}
            </div>

            {counts && counts.openGroups > 0 && (
              <Link
                href="/website?tab=issues"
                className="text-[12px] font-semibold text-brand-600 hover:text-brand-950 transition"
              >
                See all {counts.openGroups} →
              </Link>
            )}
          </div>
        </div>

        {issueGroups.isLoading ? (
          <div className="p-6">
            <LoadingLine text="Loading priority fixes…" />
          </div>
        ) : shownGroups.length === 0 ? (
          <div className="px-6 py-10 text-center text-[12.5px] text-brand-400">
            {crawlCompleted
              ? "Nothing to fix in this category — your site looks clean."
              : "Priority fixes will appear here after your first audit."}
          </div>
        ) : (
          <ol className="divide-y divide-brand-100">
            {shownGroups.map((group) => (
              <TodoRow
                key={group.groupKey}
                group={group}
                selected={inspectedGroup?.groupKey === group.groupKey}
                onPick={() => setInspectedState({ projectId, group })}
              />
            ))}
          </ol>
        )}
      </section>

      {/* Closed-Loop Results Proof (only when fixes exist) */}
      {hasShippedFixes && <ClosedLoopResultsCard />}

      {/* Slide-Over Native <dialog> Issue Inspector */}
      <ProblemDetailDrawer
        group={inspectedGroup}
        onClose={() => setInspectedState(null)}
      />
    </div>
  );
}
