"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Globe,
  Layers,
  PlugZap,
  RefreshCw,
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
 * Minimal Executive Dashboard — 4 calm surfaces with zero duplicate metrics,
 * zero card-inside-card clutter, and quiet zero-state discipline.
 */
export default function UnifiedDashboardPage() {
  const router = useRouter();
  const { orgId, projectId, projects, isLoading: workspaceLoading } = useWorkspace();
  const [metricKey, setMetricKey] = useState<MetricKey>("searchClicks");
  const [severityTab, setSeverityTab] = useState<"ALL" | IssueSeverity>("ALL");
  const [inspectedGroup, setInspectedGroup] = useState<IssueGroup | null>(null);
  const [auditActionError, setAuditActionError] = useState<string | null>(null);

  const portfolio = usePortfolio(orgId);
  const activeProject = projects.find((p) => p.id === projectId);
  const client = portfolio.data?.clients.find((c) => c.projectId === projectId) ?? null;
  const currentDomain = activeProject?.name ?? client?.domain ?? null;

  useEffect(() => {
    setInspectedGroup(null);
    setAuditActionError(null);
  }, [projectId]);

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
  const hasGa = Boolean(executive.data?.connections?.analytics);

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
    setAuditActionError(null);
    try {
      await startCrawlMutation.mutateAsync({
        domain: currentDomain,
        maxDepth: 10,
        maxConcurrency: 3,
        useSitemap: true,
      });
    } catch (error) {
      setAuditActionError(
        error instanceof Error ? error.message : "The website check could not start. Please try again.",
      );
    }
  };

  const runFullPipeline = async () => {
    if (!currentDomain || pipelineBusy) return;
    setAuditActionError(null);
    try {
      await startPipelineMutation.mutateAsync({ domain: currentDomain, forceRefresh: true });
    } catch (error) {
      setAuditActionError(
        error instanceof Error ? error.message : "Could not start the full workspace pipeline.",
      );
    }
  };

  const headline = executive.data?.headline;
  const ga4Totals = ga4.report.data?.data?.totals ?? null;
  const ga4Countries = ga4.report.data?.data?.countries ?? [];
  const ga4Cities = ga4.report.data?.data?.cities ?? [];

  const metrics: { key: MetricKey; short: string; label: string }[] = [
    { key: "searchClicks", short: "Clicks", label: "Google search clicks" },
    { key: "impressions", short: "Impressions", label: "Search impressions" },
    { key: "sessions", short: "Visits", label: "Website sessions" },
    { key: "conversions", short: "Goals", label: "Key events" },
  ];
  const metric = metrics.find((m) => m.key === metricKey) ?? metrics[0];
  const rangeDays = executive.data?.range?.days ? executive.data.range.days : DEFAULT_WINDOW_DAYS;

  const activeSeriesPoints = useMemo(() => {
    if (metricKey === "searchClicks" && gscSeries.data && gscSeries.data.length > 0) {
      return normalizeTrend(gscSeries.data.map((p) => ({ date: p.date, value: p.clicks })), rangeDays);
    }
    if (metricKey === "impressions" && gscSeries.data && gscSeries.data.length > 0) {
      return normalizeTrend(gscSeries.data.map((p) => ({ date: p.date, value: p.impressions })), rangeDays);
    }
    if (metricKey === "sessions" && gaSeries.data && gaSeries.data.length > 0) {
      return normalizeTrend(gaSeries.data.map((p) => ({ date: p.date, value: p.sessions })), rangeDays);
    }
    if (metricKey === "conversions" && gaSeries.data && gaSeries.data.length > 0) {
      return normalizeTrend(gaSeries.data.map((p) => ({ date: p.date, value: p.conversions ?? 0 })), rangeDays);
    }
    return null;
  }, [metricKey, gscSeries.data, gaSeries.data, rangeDays]);

  const activeMeasure = headline?.[metric.key];
  const clicksMeasure = headline?.searchClicks;
  const sessionsMeasure = headline?.sessions;
  const visitsDisplay =
    sessionsMeasure?.state === "MEASURED"
      ? sessionsMeasure.value
      : ga4Totals?.sessions ?? null;

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
    <div className="space-y-6 pb-14">
      {/* ── SURFACE 1: WHISPER-QUIET HEADER ── */}
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-[26px] font-bold leading-none tracking-tight text-brand-950">
            Dashboard
          </h1>
          <p className="mt-2 flex items-center gap-2 text-[12.5px] text-brand-400">
            {currentDomain ? (
              <>
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-success-500" aria-hidden="true" />
                <span className="font-medium text-brand-600">{currentDomain}</span>
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

        <div className="flex items-center gap-2">
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
            className="inline-flex items-center gap-1.5 rounded-xl bg-signal-400 px-4 py-2 text-[12px] font-bold text-signal-ink transition hover:bg-signal-500 disabled:opacity-50 cursor-pointer"
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

      {/* ── SURFACE 2: ONE UNIFIED 4-COLUMN HAIRLINE KPI STRIP (ZERO NESTED CARDS) ── */}
      <div className="grid grid-cols-1 divide-y divide-brand-100 overflow-hidden rounded-2xl border border-brand-200/80 bg-surface-1 shadow-2xs sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 lg:divide-x">
        {/* 1. Website Health */}
        <Link
          href="/website"
          className="group flex flex-col justify-between p-5 transition hover:bg-brand-50/60"
        >
          <div className="flex items-center justify-between text-[11px] font-medium text-brand-400">
            <span>Site Health</span>
            <ArrowUpRight size={13} className="text-brand-300 transition group-hover:text-brand-700" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="font-mono text-[30px] font-bold leading-none tracking-tight text-brand-950 tabular-nums">
              {healthScore != null && crawlCompleted ? healthScore : "—"}
            </span>
            {scoreGrade && (
              <span
                className={cn(
                  "text-[11.5px] font-semibold",
                  scoreGrade.tone === "good"
                    ? "text-success-700"
                    : scoreGrade.tone === "warn"
                      ? "text-warning-700"
                      : "text-error-700",
                )}
              >
                {scoreGrade.label}
              </span>
            )}
          </div>
          <p className="mt-2 text-[11.5px] text-brand-400">
            {counts ? `${counts.openGroups} open issues · ${shownCrawl?.pagesCrawled ?? 0} pages` : "Run an audit to score"}
          </p>
        </Link>

        {/* 2. Search Clicks */}
        <Link
          href="/traffic"
          className="group flex flex-col justify-between border-t border-brand-100 p-5 transition hover:bg-brand-50/60 sm:border-t-0 sm:border-l lg:border-l-0"
        >
          <div className="flex items-center justify-between text-[11px] font-medium text-brand-400">
            <span>Google Clicks</span>
            <ArrowUpRight size={13} className="text-brand-300 transition group-hover:text-brand-700" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="font-mono text-[30px] font-bold leading-none tracking-tight text-brand-950 tabular-nums">
              {clicksMeasure?.state === "MEASURED" ? clicksMeasure.value.toLocaleString() : "—"}
            </span>
            {clicksMeasure?.state === "MEASURED" && clicksMeasure.changePct != null && Number.isFinite(clicksMeasure.changePct) && (
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
          <p className="mt-2 text-[11.5px] text-brand-400">
            {hasGsc ? `Last ${rangeDays} days · Search Console` : "Connect Search Console"}
          </p>
        </Link>

        {/* 3. Website Visits */}
        <Link
          href="/traffic"
          className="group flex flex-col justify-between border-t border-brand-100 p-5 transition hover:bg-brand-50/60 lg:border-t-0"
        >
          <div className="flex items-center justify-between text-[11px] font-medium text-brand-400">
            <span>Website Visits</span>
            <ArrowUpRight size={13} className="text-brand-300 transition group-hover:text-brand-700" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="font-mono text-[30px] font-bold leading-none tracking-tight text-brand-950 tabular-nums">
              {visitsDisplay != null ? visitsDisplay.toLocaleString() : "—"}
            </span>
            {ga4Countries.length > 0 && (
              <span className="font-mono text-[11px] text-brand-400">
                {ga4Countries.length} {ga4Countries.length === 1 ? "country" : "countries"}
              </span>
            )}
          </div>
          <p className="mt-2 text-[11.5px] text-brand-400">
            {hasGa ? "Open 3D Global Traffic Map" : "Connect Google Analytics"}
          </p>
        </Link>

        {/* 4. AI Visibility & Local */}
        <Link
          href="/ai-visibility"
          className="group flex flex-col justify-between border-t border-brand-100 p-5 transition hover:bg-brand-50/60 sm:border-l lg:border-t-0 lg:border-l-0"
        >
          <div className="flex items-center justify-between text-[11px] font-medium text-brand-400">
            <span>AI Citations</span>
            <ArrowUpRight size={13} className="text-brand-300 transition group-hover:text-brand-700" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="font-mono text-[30px] font-bold leading-none tracking-tight text-brand-950 tabular-nums">
              {aiSharePct != null ? `${Math.round(aiSharePct)}%` : "—"}
            </span>
            {aiChecked > 0 && (
              <span className="font-mono text-[11px] text-brand-400">
                {aiCited}/{aiChecked} prompts
              </span>
            )}
          </div>
          <p className="mt-2 text-[11.5px] text-brand-400">
            {localRating != null && localRating > 0
              ? `Maps ${localRating.toFixed(1)}★ · AI engines`
              : aiSessions != null
                ? `${aiSessions} AI visits · Last 28d`
                : "Across 5 AI assistants"}
          </p>
        </Link>
      </div>

      {/* ── SURFACE 3: SPACIOUS TWO-COLUMN HERO (TREND CANVAS + HEALTH SUMMARY) ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-stretch">
        {/* Left (7 cols): Calm, Uncluttered Search & Traffic Trend */}
        <section
          id="visitors"
          className="lg:col-span-7 flex flex-col justify-between rounded-2xl border border-brand-200/80 bg-surface-1 p-6 shadow-2xs"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-[15px] font-bold tracking-tight text-brand-950">
                Search &amp; Traffic Trend
              </h2>
              <p className="mt-0.5 text-[12px] text-brand-400">
                {metric.label} · last {rangeDays} days
              </p>
            </div>

            <div
              className="inline-flex items-center gap-0.5 rounded-xl bg-brand-100/70 p-1 text-[11.5px]"
              role="tablist"
              aria-label="Choose trend metric"
            >
              {metrics.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  role="tab"
                  aria-selected={m.key === metricKey}
                  onClick={() => setMetricKey(m.key)}
                  className={cn(
                    "rounded-lg px-2.5 py-1 font-semibold transition cursor-pointer",
                    m.key === metricKey
                      ? "bg-surface-1 text-brand-950 shadow-2xs"
                      : "text-brand-500 hover:text-brand-950",
                  )}
                >
                  {m.short}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5 flex-1">
            {executive.isLoading ? (
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
                <div className="flex items-baseline justify-between gap-3">
                  <div className="flex items-baseline gap-2.5">
                    <span className="font-mono text-[28px] font-bold leading-none tracking-tight text-brand-950 tabular-nums">
                      {activeMeasure?.state === "MEASURED" ? activeMeasure.value.toLocaleString() : "—"}
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
                  <p className="py-10 text-center text-[12px] text-brand-400">
                    Daily measurements for {metric.short.toLowerCase()} will appear once synced.
                  </p>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Right (5 cols): Minimal Technical Health Breakdown */}
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
              Audit →
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

      {/* ── SURFACE 4: LINEAR-STYLE PRIORITY FIX LIST (CLICK ROW -> SLIDE-OVER INSPECTOR) ── */}
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
                onPick={() => setInspectedGroup(group)}
              />
            ))}
          </ol>
        )}
      </section>

      {/* Only render full Closed-Loop Proof Ledger when real fixes exist; otherwise keep a whisper-quiet status bar */}
      {hasShippedFixes ? (
        <ClosedLoopResultsCard />
      ) : (
        <footer className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-brand-200/70 bg-surface-1 px-6 py-3.5 text-[12px]">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-brand-500">
            <Link href="/traffic" className="inline-flex items-center gap-1.5 hover:text-brand-950 transition">
              <span className="font-medium text-brand-400">Global Map</span>
              <span className="font-semibold text-brand-950">
                {ga4Countries.length > 0
                  ? `${ga4Countries.length} countries · ${ga4Cities.length} cities`
                  : "Explore 3D Earth"}
              </span>
            </Link>
            <span className="hidden sm:inline h-3.5 w-px bg-brand-200" aria-hidden="true" />
            <Link href="/traffic" className="inline-flex items-center gap-1.5 hover:text-brand-950 transition">
              <span className="font-medium text-brand-400">AI Referrals</span>
              <span className="font-semibold text-brand-950">
                {aiSessions != null ? `${aiSessions} visits (28d)` : "GA4 ready"}
              </span>
            </Link>
            <span className="hidden sm:inline h-3.5 w-px bg-brand-200" aria-hidden="true" />
            <Link href="/fix-engine" className="inline-flex items-center gap-1.5 hover:text-brand-950 transition">
              <span className="font-medium text-brand-400">Results Ledger</span>
              <span className="font-semibold text-brand-950">No shipped fixes yet</span>
            </Link>
          </div>
          <Link
            href="/monthly-report"
            className="inline-flex items-center gap-1 font-semibold text-brand-700 hover:text-brand-950 transition"
          >
            <span>Monthly Report</span>
            <ArrowUpRight size={13} />
          </Link>
        </footer>
      )}

      {/* Slide-Over Native <dialog> Issue Inspector */}
      <ProblemDetailDrawer
        group={inspectedGroup}
        onClose={() => setInspectedGroup(null)}
      />
    </div>
  );
}
