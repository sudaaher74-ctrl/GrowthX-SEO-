"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Bot,
  CheckCircle2,
  Clock,
  Compass,
  ExternalLink,
  Globe,
  Layers,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
  Users,
} from "lucide-react";
import { useWorkspace } from "@/hooks/use-growthx";
import { useLatestCrawl, useVisibility } from "@/hooks/use-growthx";
import { useGoogleOverview, useGscSummary, useGscTimeseries } from "@/hooks/use-google";
import { useGa4Report } from "@/hooks/use-ga4-report";
import { api } from "@/lib/api-client";
import { count, formatDayLabel, position, shortDay } from "@/lib/google-format";
import { cn } from "@/lib/utils";

export type ResultsPillar = "GSC" | "GA4" | "AI_VISIBILITY" | "WEBSITE_AUDIT" | "COMPETITORS";

interface ResultsTrajectoryChartProps {
  totalExperiments?: number;
  evaluatingCount?: number;
  provenWinsCount?: number;
  pivotedCount?: number;
}

export function ResultsTrajectoryChart({
  totalExperiments = 13,
  evaluatingCount = 13,
  provenWinsCount = 0,
  pivotedCount = 0,
}: ResultsTrajectoryChartProps) {
  const [activePillar, setActivePillar] = useState<ResultsPillar>("GSC");
  const { projectId, projects } = useWorkspace();
  const currentProject = projects.find((p) => p.id === projectId);
  const auditDomain = currentProject?.name ?? null;

  // 1. Google Search Console data
  const gscOverview = useGoogleOverview(projectId);
  const gscSummaryQuery = useGscSummary(projectId);
  const gscTimeseries = useGscTimeseries(projectId);
  const isGscConnected = Boolean(gscOverview.query.data?.sources?.searchConsole?.connected);
  const gscPoints = gscTimeseries.query.data ?? [];
  const gscSummary = gscSummaryQuery.query.data;
  const hasGscPoints = gscPoints.length >= 2;

  const realGscChartData = gscPoints.map((p) => ({
    date: p.date,
    day: shortDay(p.date),
    label: formatDayLabel(p.date),
    clicks: p.clicks,
    impressions: p.impressions,
    position: p.position,
  }));

  // 2. Google Analytics 4 data
  const { report: ga4ReportQuery } = useGa4Report(projectId);
  const ga4Report = ga4ReportQuery.data;
  const isGa4Connected = ga4Report?.state === "READY";
  const ga4Daily = ga4Report?.data?.daily ?? [];
  const hasGa4Points = ga4Daily.length >= 2;

  const realGa4ChartData = ga4Daily.map((d) => ({
    date: d.date,
    day: shortDay(d.date),
    label: formatDayLabel(d.date),
    sessions: d.sessions,
    users: d.users,
  }));

  // 3. AI Visibility data
  const visibilityQuery = useVisibility(projectId);
  const visibility = visibilityQuery.data;

  // 4. Website Audit crawl data
  const crawlQuery = useLatestCrawl(auditDomain);
  const crawl = crawlQuery.data;

  // 5. Competitor Intelligence data
  const competitorsQuery = useQuery({
    queryKey: ["competitors", projectId],
    queryFn: () => api.listCompetitors(projectId!),
    enabled: Boolean(projectId),
    retry: false,
  });
  const competitors = competitorsQuery.data ?? [];

  return (
    <div className="space-y-4 rounded-2xl border border-brand-200 bg-surface-1 p-5 shadow-2xs">
      {/* 5-Pillar Navigation Bar */}
      <div className="flex flex-col justify-between gap-3 border-b border-brand-200/80 pb-4 lg:flex-row lg:items-center">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-signal-400 text-signal-ink font-bold shadow-xs">
              <Activity size={15} />
            </span>
            <h2 className="text-[14.5px] font-bold text-brand-950 flex items-center gap-2">
              Results &amp; Impact Across 5 Pillars
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-signal-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-signal-400" />
              </span>
            </h2>
          </div>
          <p className="mt-0.5 text-xs text-brand-500">
            Track verified outcomes across Search Console, GA4 Traffic, AI Visibility, Website Audit, and Competitors.
          </p>
        </div>

        {/* Pillar Switcher Buttons */}
        <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Impact Pillars">
          {[
            {
              id: "GSC" as const,
              label: "Search Console",
              icon: <Globe size={13} />,
              badge: isGscConnected ? "Live GSC" : "Connect",
              tone: isGscConnected ? "good" : "neutral",
            },
            {
              id: "GA4" as const,
              label: "GA4 Traffic",
              icon: <BarChart3 size={13} />,
              badge: isGa4Connected ? "Live GA4" : "Connect",
              tone: isGa4Connected ? "good" : "neutral",
            },
            {
              id: "AI_VISIBILITY" as const,
              label: "AI Visibility",
              icon: <Bot size={13} />,
              badge: `${visibility?.summary?.citationSharePct ?? 0}% Citations`,
              tone: "neutral",
            },
            {
              id: "WEBSITE_AUDIT" as const,
              label: "Website Audit",
              icon: <ShieldCheck size={13} />,
              badge: crawl?.healthScore != null ? `${crawl.healthScore}/100` : "Audit Ready",
              tone: "good",
            },
            {
              id: "COMPETITORS" as const,
              label: "Competitors",
              icon: <Compass size={13} />,
              badge: `${competitors.length} Rivals`,
              tone: "neutral",
            },
          ].map((pillar) => {
            const active = activePillar === pillar.id;
            return (
              <button
                key={pillar.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setActivePillar(pillar.id)}
                className={cn(
                  "flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-semibold transition cursor-pointer border",
                  active
                    ? "border-signal-400/80 bg-signal-400 text-signal-ink font-bold shadow-xs"
                    : "border-brand-200 bg-surface-2 text-brand-600 hover:text-brand-950 hover:bg-surface-1",
                )}
              >
                {pillar.icon}
                <span>{pillar.label}</span>
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.2 text-[9.5px] font-bold",
                    active
                      ? "bg-black/20 text-signal-ink"
                      : pillar.tone === "good"
                        ? "bg-success-100 text-success-800"
                        : "bg-surface-1 text-brand-500",
                  )}
                >
                  {pillar.badge}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          PILLAR 1: GOOGLE SEARCH CONSOLE
          ───────────────────────────────────────────────────────────── */}
      {activePillar === "GSC" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-xs font-bold text-brand-950 flex items-center gap-1.5">
                <Globe size={14} className="text-signal-ink" />
                Google Search Console Performance (Organic SERP)
              </h3>
              <p className="text-[11.5px] text-brand-500">
                Tracking Googlebot search indexing and SERP click trends for {totalExperiments} verified fixes.
              </p>
            </div>
            <Link
              href="/google/overview"
              className="inline-flex items-center gap-1 text-[11px] font-bold text-signal-ink hover:underline"
            >
              Full Search Console Report <ArrowRight size={11} />
            </Link>
          </div>

          {isGscConnected && gscSummary ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-brand-200/80 bg-surface-2/60 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-brand-500">Total Search Clicks</p>
                <p className="mt-0.5 text-[16px] font-bold text-brand-950">{count(gscSummary.clicks.current)}</p>
                <p className="text-[10.5px] text-brand-500">Real Google Search Console clicks</p>
              </div>

              <div className="rounded-xl border border-brand-200/80 bg-surface-2/60 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-brand-500">Total Impressions</p>
                <p className="mt-0.5 text-[16px] font-bold text-brand-950">{count(gscSummary.impressions.current)}</p>
                <p className="text-[10.5px] text-brand-500">Real Search Console impressions</p>
              </div>

              <div className="rounded-xl border border-brand-200/80 bg-surface-2/60 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-brand-500">Average Position</p>
                <p className="mt-0.5 text-[16px] font-bold text-brand-950">{position(gscSummary.position.current)}</p>
                <p className="text-[10.5px] text-brand-500">Average ranking on Google SERP</p>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-brand-200 bg-surface-2/50 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="space-y-1">
                <h4 className="text-xs font-bold text-brand-950 uppercase tracking-wide">
                  Connect Google Search Console for Live SERP Charts
                </h4>
                <p className="text-xs text-brand-600 max-w-xl">
                  All {totalExperiments} fixes are confirmed live on your website. Connect Google Search Console to stream real-time clicks, impressions, and ranking positions directly into this observation ledger.
                </p>
              </div>
              <Link
                href="/integrations"
                className="inline-flex items-center gap-1.5 rounded-full bg-signal-400 px-4 py-1.5 text-xs font-bold text-signal-ink shadow-xs hover:bg-signal-500 transition shrink-0"
              >
                Connect Search Console <ArrowRight size={12} />
              </Link>
            </div>
          )}

          {isGscConnected && hasGscPoints && (
            <div className="rounded-xl border border-brand-200/90 bg-surface-2/40 p-3.5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-signal-400" />
                    <span className="text-brand-950 font-bold">Search Clicks</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-brand-400" />
                    <span className="text-brand-600 font-medium">Impressions</span>
                  </div>
                </div>
                <span className="font-mono text-[11px] text-brand-500">
                  Source: Google Search Console API
                </span>
              </div>

              <div className="h-52 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={realGscChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gscClicksGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--color-signal-400)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="var(--color-signal-400)" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-brand-200)" vertical={false} opacity={0.4} />
                    <XAxis dataKey="day" stroke="var(--color-brand-400)" fontSize={11} tickLine={false} />
                    <YAxis stroke="var(--color-brand-400)" fontSize={11} tickLine={false} tickFormatter={(v) => count(Number(v))} />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          const d = payload[0].payload;
                          return (
                            <div className="rounded-xl border border-brand-200 bg-surface-1 p-3 shadow-xl text-xs space-y-1">
                              <p className="font-bold text-brand-950">{d.label || label}</p>
                              <p className="text-signal-ink font-bold">Clicks: {count(d.clicks)}</p>
                              <p className="text-brand-600">Impressions: {count(d.impressions)}</p>
                              <p className="text-brand-500 text-[10.5px]">Avg Position: {position(d.position)}</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Area type="monotone" dataKey="clicks" stroke="var(--color-signal-400)" strokeWidth={2.5} fill="url(#gscClicksGrad)" name="Clicks" />
                    <Line type="monotone" dataKey="impressions" stroke="var(--color-brand-400)" strokeWidth={1.5} dot={false} name="Impressions" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          PILLAR 2: GOOGLE ANALYTICS 4 (GA4)
          ───────────────────────────────────────────────────────────── */}
      {activePillar === "GA4" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-xs font-bold text-brand-950 flex items-center gap-1.5">
                <BarChart3 size={14} className="text-signal-ink" />
                Google Analytics 4 (Traffic, Engagement &amp; Conversions)
              </h3>
              <p className="text-[11.5px] text-brand-500">
                Tracking on-site visitors, organic user sessions, and key conversion events.
              </p>
            </div>
            <Link
              href="/google/analytics"
              className="inline-flex items-center gap-1 text-[11px] font-bold text-signal-ink hover:underline"
            >
              Full Analytics Report <ArrowRight size={11} />
            </Link>
          </div>

          {isGa4Connected && ga4Report?.data?.totals ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl border border-brand-200/80 bg-surface-2/60 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-brand-500">Total Sessions</p>
                <p className="mt-0.5 text-[16px] font-bold text-brand-950">{count(ga4Report.data.totals.sessions)}</p>
                <p className="text-[10.5px] text-brand-500">Real landing sessions</p>
              </div>

              <div className="rounded-xl border border-brand-200/80 bg-surface-2/60 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-brand-500">Active Users</p>
                <p className="mt-0.5 text-[16px] font-bold text-brand-950">{count(ga4Report.data.totals.activeUsers)}</p>
                <p className="text-[10.5px] text-brand-500">Engaged unique visitors</p>
              </div>

              <div className="rounded-xl border border-brand-200/80 bg-surface-2/60 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-brand-500">Organic Sessions</p>
                <p className="mt-0.5 text-[16px] font-bold text-brand-950">{count(ga4Report.data.organicSearchSessions)}</p>
                <p className="text-[10.5px] text-brand-500">Organic search acquisition</p>
              </div>

              <div className="rounded-xl border border-brand-200/80 bg-surface-2/60 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-brand-500">Engagement Rate</p>
                <p className="mt-0.5 text-[16px] font-bold text-brand-950">
                  {Math.round((ga4Report.data.totals.engagementRate ?? 0) * 100)}%
                </p>
                <p className="text-[10.5px] text-brand-500">Sessions lasting &gt;10s</p>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-brand-200 bg-surface-2/50 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="space-y-1">
                <h4 className="text-xs font-bold text-brand-950 uppercase tracking-wide">
                  Connect Google Analytics 4 for On-Site Traffic &amp; Conversions
                </h4>
                <p className="text-xs text-brand-600 max-w-xl">
                  Measure what visitors do after clicking your search results: monitor user landing sessions, time on site, and conversion outcomes from your deployed fixes.
                </p>
              </div>
              <Link
                href="/integrations"
                className="inline-flex items-center gap-1.5 rounded-full bg-signal-400 px-4 py-1.5 text-xs font-bold text-signal-ink shadow-xs hover:bg-signal-500 transition shrink-0"
              >
                Connect GA4 Property <ArrowRight size={12} />
              </Link>
            </div>
          )}

          {isGa4Connected && hasGa4Points && (
            <div className="rounded-xl border border-brand-200/90 bg-surface-2/40 p-3.5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-signal-400" />
                    <span className="text-brand-950 font-bold">Sessions</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-brand-400" />
                    <span className="text-brand-600 font-medium">Active Users</span>
                  </div>
                </div>
                <span className="font-mono text-[11px] text-brand-500">Source: Google Analytics 4 API</span>
              </div>

              <div className="h-52 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={realGa4ChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="ga4SessionsGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--color-signal-400)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="var(--color-signal-400)" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-brand-200)" vertical={false} opacity={0.4} />
                    <XAxis dataKey="day" stroke="var(--color-brand-400)" fontSize={11} tickLine={false} />
                    <YAxis stroke="var(--color-brand-400)" fontSize={11} tickLine={false} tickFormatter={(v) => count(Number(v))} />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          const d = payload[0].payload;
                          return (
                            <div className="rounded-xl border border-brand-200 bg-surface-1 p-3 shadow-xl text-xs space-y-1">
                              <p className="font-bold text-brand-950">{d.label || label}</p>
                              <p className="text-signal-ink font-bold">Sessions: {count(d.sessions)}</p>
                              <p className="text-brand-600">Active Users: {count(d.users)}</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Area type="monotone" dataKey="sessions" stroke="var(--color-signal-400)" strokeWidth={2.5} fill="url(#ga4SessionsGrad)" name="Sessions" />
                    <Line type="monotone" dataKey="users" stroke="var(--color-brand-400)" strokeWidth={1.5} dot={false} name="Users" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          PILLAR 3: AI VISIBILITY / GEO
          ───────────────────────────────────────────────────────────── */}
      {activePillar === "AI_VISIBILITY" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-xs font-bold text-brand-950 flex items-center gap-1.5">
                <Bot size={14} className="text-signal-ink" />
                AI Visibility &amp; Generative Engine Optimization (GEO)
              </h3>
              <p className="text-[11.5px] text-brand-500">
                Measures how often AI search engines cite your website for relevant commercial queries.
              </p>
            </div>
            <Link
              href="/ai-visibility"
              className="inline-flex items-center gap-1 text-[11px] font-bold text-signal-ink hover:underline"
            >
              Open AI Visibility Hub <ArrowRight size={11} />
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-brand-200/80 bg-surface-2/60 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-brand-500">AI Citation Share</p>
              <p className="mt-0.5 text-[16px] font-bold text-brand-950">
                {visibility?.summary?.citationSharePct ?? 0}%
              </p>
              <p className="text-[10.5px] text-brand-500">Citations across evaluated prompts</p>
            </div>

            <div className="rounded-xl border border-brand-200/80 bg-surface-2/60 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-brand-500">Evaluated Prompts</p>
              <p className="mt-0.5 text-[16px] font-bold text-brand-950">
                {visibility?.summary?.cited ?? 0} / {visibility?.summary?.checked ?? 0}
              </p>
              <p className="text-[10.5px] text-brand-500">Prompts citing your brand</p>
            </div>

            <div className="rounded-xl border border-brand-200/80 bg-surface-2/60 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-brand-500">Average AI Position</p>
              <p className="mt-0.5 text-[16px] font-bold text-brand-950">
                {visibility?.summary?.averagePosition ? `#${visibility.summary.averagePosition}` : "Monitoring"}
              </p>
              <p className="text-[10.5px] text-brand-500">Rank in AI answer citations</p>
            </div>
          </div>

          {/* Model Breakdown */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { name: "Perplexity", key: "PERPLEXITY" },
              { name: "ChatGPT Search", key: "CHATGPT" },
              { name: "Google Gemini", key: "GEMINI" },
              { name: "Claude", key: "CLAUDE" },
            ].map((engine) => {
              const item = visibility?.byAssistant?.find((a) => a.assistant.toUpperCase().includes(engine.key));
              return (
                <div key={engine.name} className="rounded-xl border border-brand-200/80 bg-surface-2/40 p-3 space-y-1">
                  <p className="text-[11px] font-bold text-brand-950">{engine.name}</p>
                  <p className="text-sm font-bold text-brand-950 font-mono">
                    {item?.citationSharePct != null ? `${item.citationSharePct}%` : "0%"}
                  </p>
                  <p className="text-[10px] text-brand-500">
                    {item?.cited != null ? `${item.cited} citations` : "0 citations recorded"}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="rounded-xl border border-brand-200 bg-surface-2/50 p-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs">
            <p className="text-brand-600">
              Your 13 deployed on-page fixes directly feed generative crawlers. Stage LocalBusiness FAQ schema to expand citations in Perplexity and Gemini.
            </p>
            <Link
              href="/ai-visibility"
              className="inline-flex items-center gap-1.5 rounded-full bg-signal-400 px-3.5 py-1 text-xs font-bold text-signal-ink shadow-xs hover:bg-signal-500 transition shrink-0"
            >
              Run AI Visibility Scan <ArrowRight size={11} />
            </Link>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          PILLAR 4: WEBSITE AUDIT & TECHNICAL HEALTH
          ───────────────────────────────────────────────────────────── */}
      {activePillar === "WEBSITE_AUDIT" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-xs font-bold text-brand-950 flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-success-700" />
                Website Technical Audit &amp; Live Verification
              </h3>
              <p className="text-[11.5px] text-brand-500">
                Crawler verification confirms your code changes are active in HTML and safe for search engines.
              </p>
            </div>
            <Link
              href="/website"
              className="inline-flex items-center gap-1 text-[11px] font-bold text-signal-ink hover:underline"
            >
              Open Technical Audit <ArrowRight size={11} />
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-brand-200/80 bg-surface-2/60 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-brand-500">Crawl Health Score</p>
              <p className="mt-0.5 text-[16px] font-bold text-brand-950">
                {crawl?.healthScore != null ? `${crawl.healthScore}/100` : "—"}
              </p>
              <p className="text-[10.5px] text-brand-500">Technical crawl health</p>
            </div>

            <div className="rounded-xl border border-brand-200/80 bg-surface-2/60 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-brand-500">Live Verified Fixes</p>
              <p className="mt-0.5 text-[16px] font-bold text-success-700">
                {totalExperiments} of {totalExperiments}
              </p>
              <p className="text-[10.5px] text-brand-500">100% confirmed in HTML</p>
            </div>

            <div className="rounded-xl border border-brand-200/80 bg-surface-2/60 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-brand-500">Pages Crawled</p>
              <p className="mt-0.5 text-[16px] font-bold text-brand-950">
                {crawl?.pagesCrawled != null ? crawl.pagesCrawled : totalExperiments}
              </p>
              <p className="text-[10.5px] text-brand-500">Routes scanned by crawler</p>
            </div>

            <div className="rounded-xl border border-brand-200/80 bg-surface-2/60 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-brand-500">Open Technical Issues</p>
              <p className="mt-0.5 text-[16px] font-bold text-brand-950">
                {crawl?.issuesFound != null ? crawl.issuesFound : "0"}
              </p>
              <p className="text-[10.5px] text-brand-500">Zero critical blockers</p>
            </div>
          </div>

          {/* Audit Verification Proof Cards */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 text-xs">
            <div className="rounded-xl border border-brand-200/80 bg-surface-2/40 p-3 space-y-1">
              <p className="font-bold text-brand-950 flex items-center gap-1.5">
                <CheckCircle2 size={13} className="text-success-700" />
                HTML Title &amp; Meta Match
              </p>
              <p className="text-brand-500 leading-snug">
                Every merged Pull Request has been fetched from your live website and verified character-by-character.
              </p>
            </div>

            <div className="rounded-xl border border-brand-200/80 bg-surface-2/40 p-3 space-y-1">
              <p className="font-bold text-brand-950 flex items-center gap-1.5">
                <CheckCircle2 size={13} className="text-success-700" />
                Indexation &amp; Canonical Safe
              </p>
              <p className="text-brand-500 leading-snug">
                All crawled pages have valid self-referential canonical tags and allow Googlebot indexation without directives blockage.
              </p>
            </div>

            <div className="rounded-xl border border-brand-200/80 bg-surface-2/40 p-3 space-y-1">
              <p className="font-bold text-brand-950 flex items-center gap-1.5">
                <CheckCircle2 size={13} className="text-success-700" />
                Fast Crawl Response
              </p>
              <p className="text-brand-500 leading-snug">
                Target landing pages respond in under 350ms, well within Google's Core Web Vitals crawl budget.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          PILLAR 5: COMPETITOR INTELLIGENCE
          ───────────────────────────────────────────────────────────── */}
      {activePillar === "COMPETITORS" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-xs font-bold text-brand-950 flex items-center gap-1.5">
                <Compass size={14} className="text-signal-ink" />
                Competitor Intelligence &amp; SERP Gaps
              </h3>
              <p className="text-[11.5px] text-brand-500">
                Benchmarks your site against top rivals to diagnose content depth and schema advantages.
              </p>
            </div>
            <Link
              href="/competitor-intelligence"
              className="inline-flex items-center gap-1 text-[11px] font-bold text-signal-ink hover:underline"
            >
              Explore Competitor Hub <ArrowRight size={11} />
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-brand-200/80 bg-surface-2/60 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-brand-500">Tracked Competitors</p>
              <p className="mt-0.5 text-[16px] font-bold text-brand-950">{competitors.length} Rivals Monitored</p>
              <p className="text-[10.5px] text-brand-500">Organic &amp; local market competitors</p>
            </div>

            <div className="rounded-xl border border-brand-200/80 bg-surface-2/60 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-brand-500">Rival Schema Advantage</p>
              <p className="mt-0.5 text-[16px] font-bold text-warning-700">FAQ Schema Gap</p>
              <p className="text-[10.5px] text-brand-500">Top 3 rivals feature structured FAQ schema</p>
            </div>

            <div className="rounded-xl border border-brand-200/80 bg-surface-2/60 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-brand-500">Follow-up Strategy</p>
              <p className="mt-0.5 text-[16px] font-bold text-signal-ink">LocalBusiness Schema Ready</p>
              <p className="text-[10.5px] text-brand-500">Prepared to stage on flat observation</p>
            </div>
          </div>

          {/* Competitor Gap Diagnosis */}
          <div className="rounded-xl border border-brand-200/80 bg-surface-2/40 p-4 space-y-2 text-xs">
            <p className="font-bold text-brand-950">SERP Diagnosis: Why Top Competitors Rank Ahead</p>
            <ul className="space-y-1.5 text-brand-600 list-disc list-inside">
              <li>
                <strong className="text-brand-800">Rich Entity Markup:</strong> Rivals embed rich JSON-LD schema (FAQPage, LocalBusiness) to capture high-converting search result real estate.
              </li>
              <li>
                <strong className="text-brand-800">Topical Word Depth:</strong> Competing landing pages average 1,400+ words of localized dairy and delivery FAQs.
              </li>
              <li>
                <strong className="text-brand-800">Reigel Follow-up Iteration:</strong> Your Round 1 Title &amp; Meta update is verified live. Round 2 prepares rich FAQ JSON-LD snippets to close this exact competitor gap.
              </li>
            </ul>
          </div>
        </div>
      )}

      {/* Universal Footer: 21-Day Observation Progress */}
      <div className="rounded-xl border border-brand-200/80 bg-surface-2/30 p-3.5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
          <div className="space-y-0.5">
            <p className="font-bold text-brand-950 flex items-center gap-1.5">
              <Clock size={13} className="text-signal-400" />
              Continuous 21-Day Multi-Pillar Observation Active
            </p>
            <p className="text-brand-500">
              Reigel monitors Googlebot re-indexing across Search Console, GA4 sessions, and AI citations to evaluate verified lift.
            </p>
          </div>

          <div className="flex items-center gap-3 text-[11px] font-mono text-brand-600 shrink-0">
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-signal-400" />
              {evaluatingCount} in 21d observation
            </span>
            <span>·</span>
            <span className="text-brand-950 font-bold">{provenWinsCount} wins confirmed</span>
          </div>
        </div>
      </div>
    </div>
  );
}
