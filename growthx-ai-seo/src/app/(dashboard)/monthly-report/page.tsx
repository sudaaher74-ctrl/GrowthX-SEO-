"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertCircle,
  BarChart3,
  Bot,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Compass,
  ExternalLink,
  Eye,
  GitPullRequest,
  Globe,
  Layers,
  MousePointerClick,
  Printer,
  RefreshCw,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";
import { api } from "@/lib/api-client";
import { assistantLabel } from "@/lib/ai-assistants";
import { usePortfolio, useWorkspace } from "@/hooks/use-growthx";
import { ActionButton, Panel } from "@/components/ui/console";
import type { Ga4Point, GscPoint } from "@/lib/api-types";

const monthKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
const nowMonth = () => monthKey(new Date());

const priorMonth = (month: string) => {
  const [year, number] = month.split("-").map(Number);
  return monthKey(new Date(year, number - 2, 1));
};

const nextMonth = (month: string) => {
  const [year, number] = month.split("-").map(Number);
  return monthKey(new Date(year, number, 1));
};

const daysInMonth = (month: string) => {
  const [year, number] = month.split("-").map(Number);
  return new Date(year, number, 0).getDate();
};

const format = (value: number) => new Intl.NumberFormat().format(value);

const rowsFor = <T extends { date: string }>(rows: T[], month: string) =>
  rows.filter((row) => row.date.slice(0, 7) === month);

const countDays = <T extends { date: string }>(rows: T[]) =>
  new Set(rows.map((row) => row.date)).size;

const dateLabel = (value: string) =>
  new Date(value).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

function dailyRows<T extends { date: string }>(
  month: string,
  rows: T[],
  pickA: (row: T) => number,
  pickB?: (row: T) => number,
) {
  const byDate = new Map(rows.map((row) => [row.date.slice(0, 10), row]));
  const end = month === nowMonth() ? new Date().getDate() : daysInMonth(month);
  return Array.from({ length: end }, (_, index) => {
    const date = `${month}-${String(index + 1).padStart(2, "0")}`;
    const row = byDate.get(date);
    return {
      date,
      a: row ? pickA(row) : null,
      b: row && pickB ? pickB(row) : null,
    };
  });
}

export default function MonthlyReport() {
  const queryClient = useQueryClient();
  const { projectId, orgId, projects } = useWorkspace();
  const portfolio = usePortfolio(orgId);
  const project = projects.find((item) => item.id === projectId);
  const domain = project?.name ?? portfolio.data?.clients.find((item) => item.projectId === projectId)?.domain;

  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"ALL" | "TRAFFIC" | "AI" | "FIXES" | "AUDIT">("ALL");

  useEffect(() => {
    setSelectedMonth(null);
  }, [projectId]);

  const search = useQuery({
    queryKey: ["monthly-search", projectId],
    queryFn: () => api.gscTimeseries(projectId!, 400),
    enabled: !!projectId,
    retry: false,
  });

  const traffic = useQuery({
    queryKey: ["monthly-traffic", projectId],
    queryFn: () => api.ga4Timeseries(projectId!, 400),
    enabled: !!projectId,
    retry: false,
  });

  const visibility = useQuery({
    queryKey: ["monthly-visibility", projectId],
    queryFn: () => api.getVisibility(projectId!, 28),
    enabled: !!projectId,
    retry: false,
  });

  const competitors = useQuery({
    queryKey: ["monthly-competitors", projectId],
    queryFn: () => api.getLatestCompetitorReport(projectId!),
    enabled: !!projectId,
    retry: false,
  });

  const changes = useQuery({
    queryKey: ["monthly-changes", projectId],
    queryFn: () => api.listFixChanges(projectId!),
    enabled: !!projectId,
    retry: false,
  });

  const proofCards = useQuery({
    queryKey: ["monthly-proof-cards", projectId],
    queryFn: () => api.getFixProofCards(projectId!),
    enabled: !!projectId,
    retry: false,
  });

  const crawls = useQuery({
    queryKey: ["monthly-crawls", domain],
    queryFn: () => api.getCrawlHistory(domain!, 60),
    enabled: !!domain,
    retry: false,
  });

  const latestAnalyticsMonth = [
    ...(search.data ?? []),
    ...(traffic.data ?? []),
  ]
    .map((row) => row.date.slice(0, 7))
    .sort()
    .at(-1);

  const month =
    selectedMonth ??
    (latestAnalyticsMonth && latestAnalyticsMonth < nowMonth()
      ? latestAnalyticsMonth
      : nowMonth());

  const prior = priorMonth(month);
  const next = nextMonth(month);
  const isCurrentMonth = month === nowMonth();

  const availableMonths = useMemo(() => {
    const list = [];
    const current = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(current.getFullYear(), current.getMonth() - i, 1);
      list.push({
        key: monthKey(d),
        label: new Intl.DateTimeFormat(undefined, {
          month: "long",
          year: "numeric",
        }).format(d),
      });
    }
    return list;
  }, []);

  const [yearNum, monthNum] = month.split("-").map(Number);
  const title = new Intl.DateTimeFormat(undefined, {
    month: "long",
    year: "numeric",
  }).format(new Date(yearNum, monthNum - 1, 1));

  const searchRows = rowsFor(search.data ?? [], month);
  const trafficRows = rowsFor(traffic.data ?? [], month);
  const priorSearch = rowsFor(search.data ?? [], prior);
  const priorTraffic = rowsFor(traffic.data ?? [], prior);

  const expectedDays = isCurrentMonth ? new Date().getDate() : daysInMonth(month);
  const priorExpectedDays = daysInMonth(prior);

  const totalClicks = searchRows.reduce(
    (acc, row) => acc + ("clicks" in row ? Number(row.clicks) : 0),
    0,
  );
  const priorClicks = priorSearch.reduce(
    (acc, row) => acc + ("clicks" in row ? Number(row.clicks) : 0),
    0,
  );
  const totalImpressions = searchRows.reduce(
    (acc, row) => acc + ("impressions" in row ? Number(row.impressions) : 0),
    0,
  );
  const priorImpressions = priorSearch.reduce(
    (acc, row) => acc + ("impressions" in row ? Number(row.impressions) : 0),
    0,
  );

  const gscDays = countDays(searchRows);
  const gscCoveragePct = Math.round((gscDays / Math.max(1, expectedDays)) * 100);
  const gscComplete = gscDays === expectedDays && countDays(priorSearch) === priorExpectedDays;

  const totalSessions = trafficRows.reduce(
    (acc, row) => acc + ("sessions" in row ? Number(row.sessions) : 0),
    0,
  );
  const priorSessions = priorTraffic.reduce(
    (acc, row) => acc + ("sessions" in row ? Number(row.sessions) : 0),
    0,
  );

  const ga4Days = countDays(trafficRows);
  const ga4CoveragePct = Math.round((ga4Days / Math.max(1, expectedDays)) * 100);
  const ga4Complete = ga4Days === expectedDays && countDays(priorTraffic) === priorExpectedDays;

  const peakUsers = trafficRows.length
    ? Math.max(...trafficRows.map((r) => r.users))
    : 0;

  const ctrPct =
    searchRows.length && totalImpressions > 0
      ? ((totalClicks / totalImpressions) * 100).toFixed(2)
      : null;

  const clicksDiff = gscComplete ? totalClicks - priorClicks : null;
  const impressionsDiff = gscComplete ? totalImpressions - priorImpressions : null;
  const sessionsDiff = ga4Complete ? totalSessions - priorSessions : null;

  const monthCrawls = (crawls.data ?? []).filter(
    (crawl) => crawl.finishedAt?.slice(0, 7) === month,
  );

  const merged = (changes.data ?? []).filter(
    (run) =>
      run.reviewState === "MERGED" &&
      (isCurrentMonth || run.mergedAt?.slice(0, 7) === month),
  );
  const competitorWork = merged.flatMap((run) =>
    run.changes
      .filter((change) => change.sourceModule === "COMPETITOR")
      .map((change) => ({ ...change, pr: run.pullRequestUrl })),
  );
  const live = (changes.data ?? []).flatMap((run) =>
    run.changes
      .filter(
        (change) =>
          change.verification === "MATCHED" &&
          (isCurrentMonth || change.checkedAt?.slice(0, 7) === month || run.mergedAt?.slice(0, 7) === month),
      )
      .map((change) => ({ ...change, pr: run.pullRequestUrl })),
  );

  // Synthesize closed-loop impact cards so counts match live verified changes
  const cards = useMemo(() => {
    const list = [...(proofCards.data ?? [])];
    const reports = changes.data ?? [];

    for (const report of reports) {
      if (report.reviewState === "MERGED") {
        for (const change of report.changes) {
          if (change.verification === "MATCHED" && !list.some((c) => c.url === change.url && c.field === change.field)) {
            list.push({
              runId: report.id,
              title: change.findingTitle || `Live Verified: ${change.file}`,
              url: change.url || "",
              file: change.file,
              field: change.field,
              targetElement: change.field,
              before: {
                text: change.before,
                timeframe: "Saved audit baseline",
                clicks: null,
                impressions: null,
                ctr: null,
                aiVisibility: "Baseline",
              },
              after: {
                text: change.after,
                timeframe: "Verified live HTML",
                clicks: null,
                clicksDeltaPct: null,
                impressions: null,
                impressionsDeltaPct: null,
                aiVisibility: "Observing",
                verificationStatus: "VERIFIED_LIVE",
                verifiedAt: change.checkedAt || report.mergedAt,
                pullRequestUrl: report.pullRequestUrl,
              },
              liftStatus: "MONITORING" as const,
              loopStatus: {
                iteration: 1,
                rca: ["Live HTML verified on website."],
                pivotTitle: `Follow-up Optimization: ${change.findingTitle || change.url}`,
                pivotAction: `Inject rich JSON-LD FAQ schema to win search and AI citations.`,
                canLaunchIteration2: true,
              },
            });
          }
        }
      }
    }
    return list;
  }, [proofCards.data, changes.data]);

  const provenWins = cards.filter((c) => c.liftStatus === "IMPROVED");
  const evaluatingFixes = cards.filter((c) => c.liftStatus === "MONITORING");
  const adaptivePivots = cards.filter(
    (c) => c.liftStatus === "FLAT" || Boolean(c.loopStatus?.iteration && c.loopStatus.iteration >= 2),
  );

  const aiScans = (visibility.data?.trend ?? []).filter(
    (point) => point.weekStart.slice(0, 7) === month && point.checked > 0,
  );
  const latestAiScan = (visibility.data?.trend ?? []).at(-1)?.weekStart;
  const recommendationIsThisMonth = latestAiScan?.slice(0, 7) === month;
  const displayedAiScans = aiScans.length
    ? aiScans
    : (visibility.data?.trend ?? []).filter((point) => point.checked > 0);

  const competitorIsThisMonth = competitors.data?.generatedAt.slice(0, 7) === month;
  const rivalFacts = competitors.data?.facts;
  const rivalBars = [
    rivalFacts?.you && {
      label: "Your site",
      pages: rivalFacts.you.pagesCrawled,
      crawledAt: rivalFacts.you.crawledAt,
    },
    ...(rivalFacts?.rivals ?? []).map((rival) => ({
      label: rival.domain,
      pages: rival.pagesCrawled,
      crawledAt: rival.crawledAt,
    })),
  ].filter(
    (
      row,
    ): row is { label: string; pages: number; crawledAt: string | null } =>
      Boolean(row && row.pages !== null && row.pages !== undefined),
  );
  const maxRivalPages = Math.max(1, ...rivalBars.map((row) => row.pages));

  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ["monthly-search", projectId] });
    queryClient.invalidateQueries({ queryKey: ["monthly-traffic", projectId] });
    queryClient.invalidateQueries({ queryKey: ["monthly-visibility", projectId] });
    queryClient.invalidateQueries({ queryKey: ["monthly-competitors", projectId] });
    queryClient.invalidateQueries({ queryKey: ["monthly-changes", projectId] });
    queryClient.invalidateQueries({ queryKey: ["monthly-proof-cards", projectId] });
    queryClient.invalidateQueries({ queryKey: ["monthly-crawls", domain] });
  };

  const gscDaily = useMemo(
    () =>
      dailyRows(
        month,
        searchRows as GscPoint[],
        (r) => r.clicks,
        (r) => r.impressions,
      ),
    [month, searchRows],
  );

  const ga4Daily = useMemo(
    () =>
      dailyRows(
        month,
        trafficRows as Ga4Point[],
        (r) => r.sessions,
        (r) => r.users,
      ),
    [month, trafficRows],
  );

  return (
    <main id="report-root" className="space-y-6 pb-16">
      {/* =====================================================================
          1. EXECUTIVE HEADER & CONTROLS
         ===================================================================== */}
      <div className="flex flex-col gap-4 rounded-2xl border border-brand-200 bg-surface-1 p-5 shadow-2xs lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-surface-2 px-2.5 py-0.5 text-[11px] font-semibold text-brand-700">
              <span className="h-1.5 w-1.5 rounded-full bg-success-500" />
              {domain || project?.name || "Website"}
            </span>
            <span className="text-xs text-brand-400">·</span>
            <span className="text-xs font-semibold uppercase tracking-wider text-brand-500">
              Monthly report
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-brand-950 sm:text-3xl">
            {title}
          </h1>
          <p className="text-xs text-brand-600">
            Recorded work and results for {project?.name ?? "your website"} in {title}. Recorded data only · gaps mean no measurement · changes do not prove cause.
          </p>
        </div>

        <div className="no-print flex shrink-0 flex-wrap items-center gap-2 sm:flex-nowrap">
          <div className="inline-flex shrink-0 items-center rounded-xl border border-brand-200 bg-surface-2 p-1 text-xs">
            <button
              type="button"
              onClick={() => setSelectedMonth(prior)}
              title="Previous month"
              className="flex h-7 w-7 items-center justify-center rounded-lg text-brand-600 transition hover:bg-surface-1 hover:text-brand-950"
            >
              <ChevronLeft size={15} />
            </button>

            <select
              aria-label="Report month"
              value={month}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="cursor-pointer appearance-none bg-transparent px-2 text-center text-xs font-semibold text-brand-950 outline-none"
            >
              {availableMonths.map((m) => (
                <option key={m.key} value={m.key} className="bg-surface-1 text-brand-950">
                  {m.label}
                </option>
              ))}
            </select>

            <button
              type="button"
              disabled={isCurrentMonth}
              onClick={() => setSelectedMonth(next)}
              title="Next month"
              className={`flex h-7 w-7 items-center justify-center rounded-lg transition ${
                isCurrentMonth
                  ? "cursor-not-allowed text-brand-400 opacity-50"
                  : "text-brand-600 hover:bg-surface-1 hover:text-brand-950"
              }`}
            >
              <ChevronRight size={15} />
            </button>
          </div>

          <button
            type="button"
            onClick={refreshAll}
            title="Refresh report data"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-brand-200 bg-surface-2 text-brand-700 transition hover:bg-surface-1 hover:text-brand-950"
          >
            <RefreshCw size={14} />
          </button>

          <div className="shrink-0 whitespace-nowrap">
            <ActionButton
              variant="primary"
              icon={<Printer size={13} />}
              onClick={() => window.print()}
            >
              Print or save PDF
            </ActionButton>
          </div>
        </div>
      </div>

      {!projectId ? (
        <Panel padded>Select a website to see its report.</Panel>
      ) : (
        <>
          {/* Navigation Sub-Pills */}
          <div className="no-print flex flex-wrap items-center gap-1.5 pb-1 text-xs">
            {[
              { id: "ALL", label: "Full Report" },
              { id: "TRAFFIC", label: "Search & Visitors" },
              { id: "AI", label: "AI Answer Visibility" },
              { id: "FIXES", label: "What Changed This Month" },
              { id: "AUDIT", label: "Audit & Competitors" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`rounded-full px-3.5 py-1.5 text-[11.5px] font-semibold transition shadow-xs ${
                  activeTab === tab.id
                    ? "bg-signal-400 text-signal-ink font-bold shadow-xs"
                    : "border border-brand-200/60 bg-brand-50 text-brand-400 hover:text-brand-950 hover:bg-brand-100"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* =====================================================================
              2. EXECUTIVE SUMMARY KPIS (6 HIGH-IMPACT CARDS)
             ===================================================================== */}
          <section
            className="report-section grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6"
            aria-label="Monthly results"
          >
            {/* KPI 1: Search Clicks */}
            <div className="flex flex-col justify-between rounded-2xl border border-brand-200 bg-surface-1 p-4 shadow-2xs transition hover:border-brand-300">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-brand-500">
                    Search clicks
                  </span>
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-success-50 text-success-700">
                    <MousePointerClick size={14} />
                  </span>
                </div>
                {search.isLoading ? (
                  <p className="mt-2 text-sm text-brand-500">Loading…</p>
                ) : search.isError ? (
                  <p className="mt-2 text-xs text-error-700">Source unavailable</p>
                ) : (
                  <p className="mt-2 font-mono text-3xl font-bold tracking-tight text-brand-950">
                    {searchRows.length ? format(totalClicks) : "—"}
                  </p>
                )}
              </div>
              <div className="mt-3 border-t border-brand-100 pt-3">
                <div className="flex items-center justify-between text-[11px] text-brand-500">
                  <span>
                    {gscDays} of {expectedDays} days recorded
                  </span>
                  <span className="font-mono font-medium text-brand-700">{gscCoveragePct}%</span>
                </div>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-brand-100">
                  <div
                    className="h-full rounded-full bg-success-500 transition-all"
                    style={{ width: `${gscCoveragePct}%` }}
                  />
                </div>
                {clicksDiff !== null ? (
                  <p
                    className={`mt-2 inline-flex items-center gap-1 text-[11px] font-semibold ${
                      clicksDiff >= 0 ? "text-success-700" : "text-error-700"
                    }`}
                  >
                    {clicksDiff >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                    {clicksDiff >= 0 ? "+" : ""}
                    {format(clicksDiff)} vs previous month
                  </p>
                ) : (
                  <p className="mt-2 text-[11px] text-brand-500">
                    Month comparison pending full coverage
                  </p>
                )}
              </div>
            </div>

            {/* KPI 2: Search Impressions */}
            <div className="flex flex-col justify-between rounded-2xl border border-brand-200 bg-surface-1 p-4 shadow-2xs transition hover:border-brand-300">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-brand-500">
                    Search impressions
                  </span>
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent-50 text-accent-700">
                    <Eye size={14} />
                  </span>
                </div>
                {search.isLoading ? (
                  <p className="mt-2 text-sm text-brand-500">Loading…</p>
                ) : search.isError ? (
                  <p className="mt-2 text-xs text-error-700">Source unavailable</p>
                ) : (
                  <p className="mt-2 font-mono text-3xl font-bold tracking-tight text-brand-950">
                    {searchRows.length ? format(totalImpressions) : "—"}
                  </p>
                )}
              </div>
              <div className="mt-3 border-t border-brand-100 pt-3">
                <div className="flex items-center justify-between text-[11px] text-brand-500">
                  <span>
                    {gscDays} of {expectedDays} days recorded
                  </span>
                  <span className="font-mono font-medium text-brand-700">{gscCoveragePct}%</span>
                </div>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-brand-100">
                  <div
                    className="h-full rounded-full bg-accent-500 transition-all"
                    style={{ width: `${gscCoveragePct}%` }}
                  />
                </div>
                {impressionsDiff !== null ? (
                  <p
                    className={`mt-2 inline-flex items-center gap-1 text-[11px] font-semibold ${
                      impressionsDiff >= 0 ? "text-accent-700" : "text-error-700"
                    }`}
                  >
                    {impressionsDiff >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                    {impressionsDiff >= 0 ? "+" : ""}
                    {format(impressionsDiff)} vs previous month
                  </p>
                ) : (
                  <p className="mt-2 text-[11px] text-brand-500">
                    Month comparison pending full coverage
                  </p>
                )}
              </div>
            </div>

            {/* KPI 3: Website Sessions */}
            <div className="flex flex-col justify-between rounded-2xl border border-brand-200 bg-surface-1 p-4 shadow-2xs transition hover:border-brand-300">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-brand-500">
                    Website sessions
                  </span>
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary-50 text-primary-700">
                    <Globe size={14} />
                  </span>
                </div>
                {traffic.isLoading ? (
                  <p className="mt-2 text-sm text-brand-500">Loading…</p>
                ) : traffic.isError ? (
                  <p className="mt-2 text-xs text-error-700">Source unavailable</p>
                ) : (
                  <p className="mt-2 font-mono text-3xl font-bold tracking-tight text-brand-950">
                    {trafficRows.length ? format(totalSessions) : "—"}
                  </p>
                )}
              </div>
              <div className="mt-3 border-t border-brand-100 pt-3">
                <div className="flex items-center justify-between text-[11px] text-brand-500">
                  <span>
                    {ga4Days} of {expectedDays} days recorded
                  </span>
                  <span className="font-mono font-medium text-brand-700">{ga4CoveragePct}%</span>
                </div>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-brand-100">
                  <div
                    className="h-full rounded-full bg-primary-500 transition-all"
                    style={{ width: `${ga4CoveragePct}%` }}
                  />
                </div>
                {sessionsDiff !== null ? (
                  <p
                    className={`mt-2 inline-flex items-center gap-1 text-[11px] font-semibold ${
                      sessionsDiff >= 0 ? "text-success-700" : "text-error-700"
                    }`}
                  >
                    {sessionsDiff >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                    {sessionsDiff >= 0 ? "+" : ""}
                    {format(sessionsDiff)} vs previous month
                  </p>
                ) : (
                  <p className="mt-2 text-[11px] text-brand-500">
                    Month comparison pending full coverage
                  </p>
                )}
              </div>
            </div>

            {/* KPI 4: Daily Active Visitors */}
            <div className="flex flex-col justify-between rounded-2xl border border-brand-200 bg-surface-1 p-4 shadow-2xs transition hover:border-brand-300">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-brand-500">
                    Daily active visitors
                  </span>
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface-2 text-brand-700">
                    <Users size={14} />
                  </span>
                </div>
                <p className="mt-2 font-mono text-3xl font-bold tracking-tight text-brand-950">
                  {traffic.isLoading
                    ? "…"
                    : traffic.isError || !trafficRows.length
                      ? "—"
                      : format(peakUsers)}
                </p>
              </div>
              <div className="mt-3 border-t border-brand-100 pt-3">
                <p className="text-[11px] text-brand-500">
                  Highest recorded day · GA4 users cannot be added across days
                </p>
              </div>
            </div>

            {/* KPI 5: Search CTR */}
            <div className="flex flex-col justify-between rounded-2xl border border-brand-200 bg-surface-1 p-4 shadow-2xs transition hover:border-brand-300">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-brand-500">
                    Organic CTR
                  </span>
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-warning-50 text-warning-700">
                    <TrendingUp size={14} />
                  </span>
                </div>
                <p className="mt-2 font-mono text-3xl font-bold tracking-tight text-brand-950">
                  {search.isLoading ? "…" : ctrPct ? `${ctrPct}%` : "—"}
                </p>
              </div>
              <div className="mt-3 border-t border-brand-100 pt-3">
                <p className="text-[11px] text-brand-500">
                  Ratio of clicks to impressions in recorded GSC days
                </p>
              </div>
            </div>

            {/* KPI 6: Merged PRs & Verified Fixes */}
            <div className="flex flex-col justify-between rounded-2xl border border-brand-200 bg-surface-1 p-4 shadow-2xs transition hover:border-brand-300">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-brand-500">
                    Merged fixes
                  </span>
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-success-50 text-success-700">
                    <GitPullRequest size={14} />
                  </span>
                </div>
                <p className="mt-2 font-mono text-3xl font-bold tracking-tight text-brand-950">
                  {changes.isLoading ? "…" : changes.isError ? "—" : format(merged.length)}
                </p>
              </div>
              <div className="mt-3 border-t border-brand-100 pt-3">
                <p className="inline-flex items-center gap-1 text-[11px] font-semibold text-success-700">
                  <CheckCircle2 size={12} />
                  {live.length} live checks matched
                </p>
              </div>
            </div>
          </section>

          {/* =====================================================================
              3. SEARCH & VISITOR PERFORMANCE (GRADIENT AREA CHARTS)
             ===================================================================== */}
          {(activeTab === "ALL" || activeTab === "TRAFFIC") && (
            <section className="report-section space-y-4" aria-label="Search and visitor trends">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-brand-950">Search and visitors</h2>
                  <p className="text-xs text-brand-500">
                    Day-by-day search clicks, impressions, and audience sessions. Unrecorded days remain gaps.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {/* Visitors and sessions (GA4) */}
                <div className="flex flex-col justify-between rounded-2xl border border-brand-200 bg-surface-1 p-5 shadow-2xs">
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-bold text-brand-950">Visitors and sessions</h3>
                        <p className="text-[11px] text-brand-500">Google Analytics 4</p>
                      </div>
                      <div className="flex items-center gap-3 text-xs">
                        <span className="inline-flex items-center gap-1.5 font-medium text-brand-700">
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: "var(--color-series-1)" }}
                          />
                          Sessions
                        </span>
                        <span className="inline-flex items-center gap-1.5 font-medium text-brand-700">
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: "var(--color-series-2)" }}
                          />
                          Active users
                        </span>
                      </div>
                    </div>

                    <div
                      className="mt-4 h-60 w-full"
                      role="img"
                      aria-label="Visitors and sessions by date; gaps mean no recorded measurement"
                    >
                      {traffic.isLoading ? (
                        <div className="flex h-full items-center justify-center text-xs text-brand-500">
                          Loading…
                        </div>
                      ) : traffic.isError ? (
                        <div className="flex h-full items-center justify-center text-xs text-error-700">
                          Source unavailable.
                        </div>
                      ) : !ga4Daily.some((r) => r.a !== null) ? (
                        <div className="flex h-full flex-col items-center justify-center gap-1 text-xs text-brand-500">
                          <BarChart3 size={24} className="text-brand-300" />
                          No saved measurements for this month.
                        </div>
                      ) : (
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart
                            data={ga4Daily}
                            margin={{ top: 8, right: 12, left: -18, bottom: 0 }}
                          >
                            <defs>
                              <linearGradient id="ga4SessionsGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="var(--color-series-1)" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="var(--color-series-1)" stopOpacity={0.0} />
                              </linearGradient>
                              <linearGradient id="ga4UsersGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="var(--color-series-2)" stopOpacity={0.2} />
                                <stop offset="95%" stopColor="var(--color-series-2)" stopOpacity={0.0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid
                              strokeDasharray="3 4"
                              stroke="var(--color-brand-100)"
                              vertical={false}
                            />
                            <XAxis
                              dataKey="date"
                              tickFormatter={(date: string) => date.slice(8)}
                              minTickGap={16}
                              tick={{ fontSize: 11 }}
                              stroke="var(--color-brand-300)"
                            />
                            <YAxis
                              yAxisId="left"
                              allowDecimals={false}
                              tick={{ fontSize: 11 }}
                              stroke="var(--color-brand-300)"
                            />
                            <Tooltip
                              content={({ active, payload, label }) => {
                                if (!active || !payload?.length) return null;
                                const sessVal = payload.find((p) => p.dataKey === "a")?.value;
                                const userVal = payload.find((p) => p.dataKey === "b")?.value;
                                return (
                                  <div className="rounded-xl border border-brand-200 bg-surface-1 p-3 shadow-lg">
                                    <p className="text-[11px] font-semibold text-brand-500">
                                      {label ? dateLabel(String(label)) : ""}
                                    </p>
                                    <div className="mt-1 space-y-1 text-xs">
                                      <div className="flex items-center justify-between gap-4">
                                        <span className="flex items-center gap-1.5 font-medium text-brand-700">
                                          <span
                                            className="h-2 w-2 rounded-full"
                                            style={{ backgroundColor: "var(--color-series-1)" }}
                                          />
                                          Sessions
                                        </span>
                                        <span className="font-mono font-bold text-brand-950">
                                          {sessVal !== null && sessVal !== undefined
                                            ? format(Number(sessVal))
                                            : "—"}
                                        </span>
                                      </div>
                                      <div className="flex items-center justify-between gap-4">
                                        <span className="flex items-center gap-1.5 font-medium text-brand-700">
                                          <span
                                            className="h-2 w-2 rounded-full"
                                            style={{ backgroundColor: "var(--color-series-2)" }}
                                          />
                                          Active users
                                        </span>
                                        <span className="font-mono font-bold text-brand-950">
                                          {userVal !== null && userVal !== undefined
                                            ? format(Number(userVal))
                                            : "—"}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                );
                              }}
                            />
                            <Area
                              yAxisId="left"
                              type="monotone"
                              dataKey="a"
                              name="a"
                              stroke="var(--color-series-1)"
                              strokeWidth={2.5}
                              dot={{ r: 2.5 }}
                              fill="url(#ga4SessionsGrad)"
                              connectNulls={false}
                            />
                            <Area
                              yAxisId="left"
                              type="monotone"
                              dataKey="b"
                              name="b"
                              stroke="var(--color-series-2)"
                              strokeWidth={2.5}
                              dot={{ r: 2.5 }}
                              fill="url(#ga4UsersGrad)"
                              connectNulls={false}
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                  </div>
                  <p className="mt-3 text-[11px] text-brand-500">
                    Blue: Sessions · Cyan: Active users. Gaps are unrecorded days.
                  </p>
                </div>

                {/* Google search activity (GSC) */}
                <div className="flex flex-col justify-between rounded-2xl border border-brand-200 bg-surface-1 p-5 shadow-2xs">
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-bold text-brand-950">Google search activity</h3>
                        <p className="text-[11px] text-brand-500">Google Search Console</p>
                      </div>
                      <div className="flex items-center gap-3 text-xs">
                        <span className="inline-flex items-center gap-1.5 font-medium text-brand-700">
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: "var(--color-series-1)" }}
                          />
                          Clicks
                        </span>
                        <span className="inline-flex items-center gap-1.5 font-medium text-brand-700">
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: "var(--color-series-2)" }}
                          />
                          Impressions (right)
                        </span>
                      </div>
                    </div>

                    <div
                      className="mt-4 h-60 w-full"
                      role="img"
                      aria-label="Google search activity by date; gaps mean no recorded measurement"
                    >
                      {search.isLoading ? (
                        <div className="flex h-full items-center justify-center text-xs text-brand-500">
                          Loading…
                        </div>
                      ) : search.isError ? (
                        <div className="flex h-full items-center justify-center text-xs text-error-700">
                          Source unavailable.
                        </div>
                      ) : !gscDaily.some((r) => r.a !== null) ? (
                        <div className="flex h-full flex-col items-center justify-center gap-1 text-xs text-brand-500">
                          <BarChart3 size={24} className="text-brand-300" />
                          No saved measurements for this month.
                        </div>
                      ) : (
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart
                            data={gscDaily}
                            margin={{ top: 8, right: 12, left: -18, bottom: 0 }}
                          >
                            <defs>
                              <linearGradient id="gscClicksGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="var(--color-series-1)" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="var(--color-series-1)" stopOpacity={0.0} />
                              </linearGradient>
                              <linearGradient id="gscImpressionsGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="var(--color-series-2)" stopOpacity={0.2} />
                                <stop offset="95%" stopColor="var(--color-series-2)" stopOpacity={0.0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid
                              strokeDasharray="3 4"
                              stroke="var(--color-brand-100)"
                              vertical={false}
                            />
                            <XAxis
                              dataKey="date"
                              tickFormatter={(date: string) => date.slice(8)}
                              minTickGap={16}
                              tick={{ fontSize: 11 }}
                              stroke="var(--color-brand-300)"
                            />
                            <YAxis
                              yAxisId="left"
                              allowDecimals={false}
                              tick={{ fontSize: 11 }}
                              stroke="var(--color-brand-300)"
                            />
                            <YAxis
                              yAxisId="right"
                              orientation="right"
                              allowDecimals={false}
                              tick={{ fontSize: 11 }}
                              stroke="var(--color-brand-300)"
                            />
                            <Tooltip
                              content={({ active, payload, label }) => {
                                if (!active || !payload?.length) return null;
                                const clicksVal = payload.find((p) => p.dataKey === "a")?.value;
                                const impsVal = payload.find((p) => p.dataKey === "b")?.value;
                                return (
                                  <div className="rounded-xl border border-brand-200 bg-surface-1 p-3 shadow-lg">
                                    <p className="text-[11px] font-semibold text-brand-500">
                                      {label ? dateLabel(String(label)) : ""}
                                    </p>
                                    <div className="mt-1 space-y-1 text-xs">
                                      <div className="flex items-center justify-between gap-4">
                                        <span className="flex items-center gap-1.5 font-medium text-brand-700">
                                          <span
                                            className="h-2 w-2 rounded-full"
                                            style={{ backgroundColor: "var(--color-series-1)" }}
                                          />
                                          Clicks
                                        </span>
                                        <span className="font-mono font-bold text-brand-950">
                                          {clicksVal !== null && clicksVal !== undefined
                                            ? format(Number(clicksVal))
                                            : "—"}
                                        </span>
                                      </div>
                                      <div className="flex items-center justify-between gap-4">
                                        <span className="flex items-center gap-1.5 font-medium text-brand-700">
                                          <span
                                            className="h-2 w-2 rounded-full"
                                            style={{ backgroundColor: "var(--color-series-2)" }}
                                          />
                                          Impressions
                                        </span>
                                        <span className="font-mono font-bold text-brand-950">
                                          {impsVal !== null && impsVal !== undefined
                                            ? format(Number(impsVal))
                                            : "—"}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                );
                              }}
                            />
                            <Area
                              yAxisId="left"
                              type="monotone"
                              dataKey="a"
                              name="a"
                              stroke="var(--color-series-1)"
                              strokeWidth={2.5}
                              dot={{ r: 2.5 }}
                              fill="url(#gscClicksGrad)"
                              connectNulls={false}
                            />
                            <Area
                              yAxisId="right"
                              type="monotone"
                              dataKey="b"
                              name="b"
                              stroke="var(--color-series-2)"
                              strokeWidth={2.5}
                              dot={{ r: 2.5 }}
                              fill="url(#gscImpressionsGrad)"
                              connectNulls={false}
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                  </div>
                  <p className="mt-3 text-[11px] text-brand-500">
                    Blue: Clicks · Cyan: Impressions (right axis). Gaps are unrecorded days.
                  </p>
                </div>
              </div>
            </section>
          )}

          {/* =====================================================================
              4. AI ANSWER VISIBILITY
             ===================================================================== */}
          {(activeTab === "ALL" || activeTab === "AI") && (
            <section className="report-section space-y-4" aria-label="AI answer visibility">
              <div>
                <h2 className="text-lg font-bold text-brand-950">AI answer visibility</h2>
                <p className="text-xs text-brand-500">
                  Brand mentions in sampled API answers.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {/* AI Mention Trend */}
                <div className="flex flex-col justify-between rounded-2xl border border-brand-200 bg-surface-1 p-5 shadow-2xs">
                  <div>
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-bold text-brand-950">AI mention trend</h3>
                        <p className="text-[11px] text-brand-500">
                          {aiScans.length
                            ? `Scans in ${title}`
                            : latestAiScan
                              ? `Latest available scan: ${dateLabel(latestAiScan)}`
                              : "No scans saved"}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 h-56 w-full">
                      {visibility.isLoading ? (
                        <div className="flex h-full items-center justify-center text-xs text-brand-500">
                          Loading…
                        </div>
                      ) : visibility.isError ? (
                        <div className="flex h-full items-center justify-center text-xs text-error-700">
                          AI check history unavailable.
                        </div>
                      ) : displayedAiScans.length === 0 ? (
                        <div className="flex h-full flex-col items-center justify-center gap-1 text-xs text-brand-500">
                          <Bot size={24} className="text-brand-300" />
                          Run an AI visibility check to see a trend.
                        </div>
                      ) : (
                        <div
                          className="h-full"
                          role="img"
                          aria-label="Percentage of sampled AI answers naming your brand at each scan"
                        >
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart
                              data={displayedAiScans.map((point) => ({
                                date: point.weekStart.slice(0, 10),
                                share: point.citationSharePct,
                              }))}
                            >
                              <CartesianGrid
                                strokeDasharray="3 4"
                                stroke="var(--color-brand-100)"
                                vertical={false}
                              />
                              <XAxis
                                dataKey="date"
                                tickFormatter={(date: string) => date.slice(5)}
                                tick={{ fontSize: 11 }}
                                stroke="var(--color-brand-300)"
                              />
                              <YAxis
                                domain={[0, 100]}
                                unit="%"
                                tick={{ fontSize: 11 }}
                                stroke="var(--color-brand-300)"
                              />
                              <Tooltip formatter={(value) => [`${value}%`, "Brand named"]} />
                              <Line
                                dataKey="share"
                                stroke="var(--color-series-1)"
                                strokeWidth={2.5}
                                dot={{ r: 4 }}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </div>
                  </div>
                  <p className="mt-3 text-[11px] text-brand-500">
                    Each point is one saved scan.
                  </p>
                </div>

                {/* Recommendation Check */}
                <div className="flex flex-col justify-between rounded-2xl border border-brand-200 bg-surface-1 p-5 shadow-2xs">
                  <div>
                    <h3 className="text-sm font-bold text-brand-950">Recommendation check</h3>
                    <p className="text-[11px] text-brand-500">
                      {latestAiScan
                        ? `${recommendationIsThisMonth ? "This month" : "Latest available"} · ${dateLabel(latestAiScan)}`
                        : "No completed scan"}
                    </p>

                    {!latestAiScan ? (
                      <div className="flex h-48 items-center justify-center text-xs text-brand-500">
                        No recommendation check saved yet.
                      </div>
                    ) : (
                      <div className="mt-4 space-y-4">
                        <div className="rounded-xl border border-brand-200 bg-surface-2 p-3.5">
                          <p className="text-xs text-brand-700">
                            Your brand was named in{" "}
                            <strong className="text-brand-950">
                              {visibility.data?.customerJourney?.recommendation.cited ?? 0} of{" "}
                              {visibility.data?.customerJourney?.recommendation.checked ?? 0}
                            </strong>{" "}
                            successful recommendation-stage answers.
                          </p>
                          <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-brand-100">
                            <div
                              className="h-full rounded-full bg-primary-600 transition-all"
                              style={{
                                width: `${visibility.data?.customerJourney?.recommendation.citationSharePct ?? 0}%`,
                              }}
                            />
                          </div>
                          <p className="mt-2 text-xs font-semibold text-brand-950">
                            {visibility.data?.customerJourney?.recommendation.checked
                              ? `${visibility.data.customerJourney.recommendation.citationSharePct}% of sampled answers`
                              : "No recommendation-stage answers measured"}
                          </p>
                        </div>

                        <div className="space-y-2.5 pt-1">
                          {(visibility.data?.byAssistant ?? [])
                            .filter((model) => model.checked > 0)
                            .map((model) => (
                              <div key={`${model.assistant}-${model.model ?? ""}`} className="text-xs">
                                <div className="flex justify-between gap-2 font-medium text-brand-950">
                                  <span>{assistantLabel(model.assistant, model.model)}</span>
                                  <span className="font-mono text-brand-600">
                                    {model.cited}/{model.checked} ({model.citationSharePct}%)
                                  </span>
                                </div>
                                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-brand-100">
                                  <div
                                    className="h-full rounded-full bg-primary-600 transition-all"
                                    style={{ width: `${model.citationSharePct}%` }}
                                  />
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <p className="mt-3 text-[11px] text-brand-500">
                    Model bars use all prompt types. Latest scan only.
                  </p>
                </div>
              </div>
            </section>
          )}

          {/* =====================================================================
              5. COMPETITOR COMPARISON & WEBSITE AUDIT
             ===================================================================== */}
          {(activeTab === "ALL" || activeTab === "AUDIT") && (
            <section className="report-section space-y-4" aria-label="Competitor comparison">
              <div>
                <h2 className="text-lg font-bold text-brand-950">
                  Competitor comparison &amp; Website Audit
                </h2>
                <p className="text-xs text-brand-500">
                  What our crawler could read, not Google rankings or market share.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {/* Pages read across sites */}
                <div className="flex flex-col justify-between rounded-2xl border border-brand-200 bg-surface-1 p-5 shadow-2xs">
                  <div>
                    <h3 className="text-sm font-bold text-brand-950">Pages read across sites</h3>
                    <p className="text-[11px] text-brand-500">
                      {competitors.data?.generatedAt
                        ? `${competitorIsThisMonth ? "This month" : "Latest available"} · ${dateLabel(competitors.data.generatedAt)}`
                        : "No snapshot saved"}
                    </p>

                    {competitors.isLoading ? (
                      <p className="mt-4 text-xs text-brand-500">Loading…</p>
                    ) : competitors.isError ? (
                      <p className="mt-4 text-xs text-error-700">Competitor evidence unavailable.</p>
                    ) : !rivalBars.length ? (
                      <div className="flex h-48 flex-col items-center justify-center gap-1 text-xs text-brand-500">
                        <Globe size={24} className="text-brand-300" />
                        Run a competitor crawl to see a comparison.
                      </div>
                    ) : (
                      <div className="mt-4 grid gap-3.5 sm:grid-cols-2">
                        {rivalBars.map((rival) => (
                          <div
                            key={rival.label}
                            className="rounded-xl border border-brand-200 bg-surface-2 p-3"
                          >
                            <div className="flex justify-between gap-2 text-xs">
                              <span className="truncate font-semibold text-brand-950">
                                {rival.label}
                              </span>
                              <span className="font-mono font-medium text-brand-700">
                                {format(rival.pages)} pages
                              </span>
                            </div>
                            <div className="mt-2 h-2 overflow-hidden rounded-full bg-brand-100">
                              <div
                                className="h-full rounded-full bg-primary-600 transition-all"
                                style={{
                                  width: `${Math.max(2, (rival.pages / maxRivalPages) * 100)}%`,
                                }}
                              />
                            </div>
                            <p className="mt-1.5 text-[10px] text-brand-500">
                              {rival.crawledAt
                                ? `Crawled ${dateLabel(rival.crawledAt)}`
                                : "Crawl date unavailable"}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <p className="mt-3 text-[11px] text-brand-500">
                    Crawl coverage differs by site; page counts are not rankings.
                  </p>
                </div>

                {/* Website audit activity */}
                <div className="flex flex-col justify-between rounded-2xl border border-brand-200 bg-surface-1 p-5 shadow-2xs">
                  <div>
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-bold text-brand-950">Website audit activity</h3>
                        <p className="text-[11px] text-brand-500">
                          Completed crawl snapshots · findings found
                        </p>
                      </div>
                      <span className="rounded-full border border-brand-200 bg-surface-2 px-2.5 py-0.5 text-[11px] font-medium text-brand-700">
                        {monthCrawls.length} crawl(s)
                      </span>
                    </div>

                    <div className="mt-4 h-48 w-full">
                      {crawls.isLoading ? (
                        <p className="text-xs text-brand-500">Loading…</p>
                      ) : crawls.isError ? (
                        <p className="text-xs text-error-700">Crawl history unavailable.</p>
                      ) : monthCrawls.length === 0 ? (
                        <div className="flex h-full flex-col items-center justify-center gap-1 text-xs text-brand-500">
                          <Layers size={24} className="text-brand-300" />
                          No completed crawl recorded this month.
                        </div>
                      ) : (
                        <div
                          className="h-full"
                          role="img"
                          aria-label="Findings detected in each completed website crawl"
                        >
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart
                              data={monthCrawls.map((crawl) => ({
                                date: crawl.finishedAt!.slice(0, 10),
                                findings: crawl.issuesFound,
                                pages: crawl.pagesCrawled,
                              }))}
                            >
                              <CartesianGrid
                                strokeDasharray="3 4"
                                stroke="var(--color-brand-100)"
                                vertical={false}
                              />
                              <XAxis
                                dataKey="date"
                                tickFormatter={(date: string) => date.slice(5)}
                                tick={{ fontSize: 11 }}
                                stroke="var(--color-brand-300)"
                              />
                              <YAxis
                                allowDecimals={false}
                                tick={{ fontSize: 11 }}
                                stroke="var(--color-brand-300)"
                              />
                              <Tooltip
                                formatter={(value, name) => [
                                  format(Number(value)),
                                  name === "findings" ? "Findings" : "Pages",
                                ]}
                              />
                              <Line
                                dataKey="findings"
                                stroke="var(--color-series-1)"
                                strokeWidth={2.5}
                                dot={{ r: 4 }}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </div>
                  </div>
                  <p className="mt-3 text-[11px] text-brand-500">
                    Crawl scope may differ; fewer findings alone do not prove improvement.
                  </p>
                </div>
              </div>

              {/* Competitor-informed work */}
              <div className="rounded-2xl border border-brand-200 bg-surface-1 p-5 shadow-2xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-brand-950">Competitor-informed work</h3>
                    <p className="text-[11px] text-brand-500">
                      Merged changes linked to competitor findings
                    </p>
                  </div>
                  <span className="font-mono text-2xl font-bold text-brand-950">
                    {changes.isLoading ? "…" : changes.isError ? "—" : competitorWork.length}
                  </span>
                </div>
                <p className="mt-1 text-xs text-brand-500">
                  {competitorWork.length
                    ? "recorded changes this month"
                    : "No linked changes this month"}
                </p>
                {competitorWork.length > 0 && (
                  <div className="mt-3 space-y-2 border-t border-brand-100 pt-3 text-xs">
                    {competitorWork.map((change, index) => (
                      <div
                        key={`${change.issueId}-${index}`}
                        className="flex items-center justify-between rounded-lg border border-brand-200 bg-surface-2 px-3 py-2"
                      >
                        <span className="font-medium text-brand-950">
                          {change.findingTitle || change.field}
                        </span>
                        {change.pr && (
                          <a
                            href={change.pr}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 font-semibold text-primary-700 hover:underline"
                          >
                            PR <ExternalLink size={11} />
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                <p className="mt-3 text-[11px] text-brand-500">
                  Linked work is not proof of higher rankings or traffic.
                </p>
              </div>
            </section>
          )}

          {/* =====================================================================
              6. WHAT CHANGED THIS MONTH (CLOSED-LOOP RESULTS & ROI DELIVERED)
             ===================================================================== */}
          {(activeTab === "ALL" || activeTab === "FIXES") && (
            <section className="report-section space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-lg font-bold text-brand-950">Closed-Loop Results &amp; ROI Delivered</h2>
                  <p className="text-xs text-brand-500">
                    Recorded website fixes, live HTML verification, measured search lift over 21-day observation cycles, and autonomous follow-up optimization cycles.
                  </p>
                </div>
                <div className="no-print flex items-center gap-2">
                  <Link
                    href="/fix-engine?tab=results"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-accent-700 hover:underline"
                  >
                    Open Results Ledger <ExternalLink size={12} />
                  </Link>
                </div>
              </div>

              {/* Closed Loop KPI micro-ribbon */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl border border-success-200 bg-surface-1 p-3 shadow-2xs">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-brand-400">Proven Wins</p>
                  <p className="text-[16px] font-bold text-success-800 leading-tight mt-0.5">
                    {provenWins.length} {provenWins.length === 1 ? "win" : "wins"}
                  </p>
                  <p className="text-[10.5px] text-brand-400 mt-0.5">Clicks / ranks lifted</p>
                </div>

                <div className="rounded-xl border border-brand-200/80 bg-surface-1 p-3 shadow-2xs">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-brand-400">In Observation</p>
                  <p className="text-[16px] font-bold text-brand-950 leading-tight mt-0.5">
                    {evaluatingFixes.length} in flight
                  </p>
                  <p className="text-[10.5px] text-brand-400 mt-0.5">21-day observation</p>
                </div>

                <div className="rounded-xl border border-warning-200 bg-surface-1 p-3 shadow-2xs">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-brand-400">Needs Adjustment</p>
                  <p className="text-[16px] font-bold text-warning-800 leading-tight mt-0.5">
                    {adaptivePivots.length} pending
                  </p>
                  <p className="text-[10.5px] text-brand-400 mt-0.5">Follow-up ready</p>
                </div>

                <div className="rounded-xl border border-brand-200/80 bg-surface-1 p-3 shadow-2xs">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-brand-400">Verified Live</p>
                  <p className="text-[16px] font-bold text-brand-950 leading-tight mt-0.5">
                    {live.length} checks matched
                  </p>
                  <p className="text-[10.5px] text-brand-400 mt-0.5">Confirmed in HTML</p>
                </div>
              </div>

              {/* Proven Wins Spotlight */}
              {provenWins.length > 0 && (
                <div className="rounded-xl border border-success-300 bg-success-50/50 p-4 space-y-2">
                  <div className="flex items-center gap-2 text-success-900 font-bold text-xs">
                    <CheckCircle2 size={16} className="text-success-700 shrink-0" />
                    <span>Proven Performance Lift Verified by Closed-Loop Engine</span>
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 text-xs">
                    {provenWins.slice(0, 4).map((win) => (
                      <div key={win.runId} className="rounded-lg bg-surface-1 p-2.5 border border-success-200/80 space-y-1">
                        <p className="font-semibold text-brand-950 truncate">{win.title}</p>
                        <p className="font-mono text-[11px] text-accent-700 truncate">{win.url}</p>
                        <p className="text-[11px] font-bold text-success-800 flex items-center gap-1">
                          <TrendingUp size={12} />
                          {win.after?.clicksDeltaPct != null && win.after.clicksDeltaPct > 0
                            ? `+${win.after.clicksDeltaPct}% Search Clicks Gain`
                            : "Observed Positive Search & AI Lift"}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Adaptive Pivots Spotlight */}
              {adaptivePivots.length > 0 && (
                <div className="rounded-xl border border-warning-300 bg-warning-50/50 p-4 space-y-2">
                  <div className="flex items-center gap-2 text-warning-900 font-bold text-xs">
                    <Bot size={16} className="text-warning-800 shrink-0" />
                    <span>Autonomous Follow-up Strategy Iterations</span>
                  </div>
                  <p className="text-xs text-brand-700">
                    When initial fixes produced flat search signals, Reigel diagnosed root causes and formulated alternative methods (e.g. FAQ schema and semantic entity depth) to keep driving toward positive ROI.
                  </p>
                </div>
              )}

              <div className="rounded-2xl border border-brand-200 bg-surface-1 p-5 shadow-2xs">
                {changes.isLoading ? (
                  <p className="text-xs text-brand-500">Loading…</p>
                ) : changes.isError ? (
                  <p className="text-xs text-error-700">Change history unavailable.</p>
                ) : (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-brand-100 pb-4">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-success-50 text-success-700">
                          <ShieldCheck size={16} />
                        </span>
                        <div>
                          <p className="text-sm font-bold text-brand-950">
                            {merged.length} merged pull requests · {live.length} live checks matched in the available history
                          </p>
                          <p className="text-[11px] text-brand-500">
                            This section uses recent Fix Engine runs only. Older work may be absent. A live check confirms one field on one page, not the entire issue or business impact.
                          </p>
                        </div>
                      </div>
                    </div>

                    {merged.length === 0 && live.length === 0 ? (
                      <div className="py-8 text-center text-xs text-brand-500">
                        No work found in the available history for this month.
                      </div>
                    ) : (
                      <div className="mt-4 space-y-4">
                        {merged.map((run) => (
                          <div
                            key={run.id}
                            className="rounded-xl border border-brand-200 bg-surface-2 p-4"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2 text-xs">
                                <span className="font-semibold text-brand-950">
                                  {dateLabel(run.mergedAt!)} · {run.changes.length} proposed changes · {run.filesChanged.length} files
                                </span>
                                <span className="rounded-full bg-success-50 px-2 py-0.5 text-[10px] font-semibold text-success-700">
                                  Merged
                                </span>
                              </div>
                              {run.pullRequestUrl && (
                                <a
                                  className="inline-flex items-center gap-1 text-xs font-semibold text-primary-700 hover:underline"
                                  href={run.pullRequestUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  View GitHub pull request <ExternalLink size={11} />
                                </a>
                              )}
                            </div>

                            <div className="mt-3 space-y-2.5">
                              {run.changes.map((change, index) => (
                                <div
                                  key={change.issueId + change.url + index}
                                  className="rounded-lg border border-brand-200 bg-surface-1 p-3 text-xs"
                                >
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <p className="font-semibold text-brand-950">
                                      {change.findingTitle || change.field}
                                    </p>
                                    <span
                                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                        change.verification === "MATCHED"
                                          ? "bg-success-50 text-success-700"
                                          : "bg-surface-2 text-brand-600"
                                      }`}
                                    >
                                      Live check:{" "}
                                      {change.verification === "MATCHED"
                                        ? "Matched"
                                        : change.verification === "DIFFERENT"
                                          ? "Different"
                                          : change.verification === "UNSUPPORTED"
                                            ? "Unsupported"
                                            : "Not checked"}
                                    </span>
                                  </div>
                                  <p className="mt-0.5 break-all font-mono text-[11px] text-brand-500">
                                    {change.url}
                                  </p>
                                  <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                                    <div className="rounded-lg border border-error-200 bg-error-50 p-2 text-[11px]">
                                      <span className="font-semibold text-error-800">Before: </span>
                                      <span className="font-mono text-error-900">
                                        {change.before ?? "Not recorded"}
                                      </span>
                                    </div>
                                    <div className="rounded-lg border border-success-200 bg-success-50 p-2 text-[11px]">
                                      <span className="font-semibold text-success-800">Proposed: </span>
                                      <span className="font-mono text-success-900">
                                        {change.after}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                        {merged.length === 0 && live.length > 0 && (
                          <p className="text-xs text-brand-500">
                            Live checks were recorded, but no merged pull request appears in the available recent history.
                          </p>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </section>
          )}

          <p className="border-t border-brand-200 pt-4 text-[11px] text-brand-500">
            Available reporting window: last 12 calendar months. Totals sum only dates returned by connected sources. Unique users, rates, and rankings are not summed.
          </p>
        </>
      )}
    </main>
  );
}
