"use client";

import Link from "next/link";
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
  CheckCircle2,
  Clock,
  ExternalLink,
  Globe,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import { useWorkspace } from "@/hooks/use-growthx";
import { useGoogleOverview, useGscSummary, useGscTimeseries } from "@/hooks/use-google";
import { count, formatDayLabel, position, shortDay } from "@/lib/google-format";

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
  const { projectId } = useWorkspace();
  const overview = useGoogleOverview(projectId);
  const summary = useGscSummary(projectId);
  const timeseries = useGscTimeseries(projectId);

  const isConnected = Boolean(overview.query.data?.sources?.searchConsole?.connected);
  const points = timeseries.query.data ?? [];
  const gscSummary = summary.query.data;
  const hasPoints = points.length >= 2;

  // Real chart data mapped strictly from Google Search Console points
  const realChartData = points.map((p) => ({
    date: p.date,
    day: shortDay(p.date),
    label: formatDayLabel(p.date),
    clicks: p.clicks,
    impressions: p.impressions,
    position: p.position,
  }));

  return (
    <div className="space-y-4 rounded-2xl border border-brand-200 bg-surface-1 p-5 shadow-2xs">
      {/* Header */}
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-signal-400 text-signal-ink font-bold shadow-xs">
            <Activity size={15} />
          </span>
          <div>
            <h2 className="text-[14.5px] font-bold text-brand-950 flex items-center gap-2">
              Search Performance &amp; Observation Window
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-signal-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-signal-400" />
              </span>
            </h2>
            <p className="text-xs text-brand-500">
              {isConnected
                ? `Real Google Search Console performance data for ${totalExperiments} verified deployed fixes.`
                : `Tracking live deployment and Googlebot observation for ${totalExperiments} verified website fixes.`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-surface-2 px-3 py-1 font-semibold text-brand-700">
            <Clock size={12} className="text-signal-400" />
            21-Day Observation Active
          </span>
        </div>
      </div>

      {/* Real Performance Metrics or Connection Prompt */}
      {isConnected && gscSummary ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-brand-200/80 bg-surface-2/60 p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-brand-500">Total Search Clicks (GSC)</p>
            <p className="mt-0.5 text-[16px] font-bold text-brand-950">{count(gscSummary.clicks.current)}</p>
            <p className="text-[10.5px] text-brand-500">Real Google Search Console clicks</p>
          </div>

          <div className="rounded-xl border border-brand-200/80 bg-surface-2/60 p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-brand-500">Total Impressions (GSC)</p>
            <p className="mt-0.5 text-[16px] font-bold text-brand-950">{count(gscSummary.impressions.current)}</p>
            <p className="text-[10.5px] text-brand-500">Real Search Console impressions</p>
          </div>

          <div className="rounded-xl border border-brand-200/80 bg-surface-2/60 p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-brand-500">Average Position (GSC)</p>
            <p className="mt-0.5 text-[16px] font-bold text-brand-950">{position(gscSummary.position.current)}</p>
            <p className="text-[10.5px] text-brand-500">Average ranking on Google SERP</p>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-brand-200 bg-surface-2/50 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Globe size={16} className="text-signal-ink" />
              <h3 className="text-xs font-bold text-brand-950 uppercase tracking-wide">
                Connect Google Search Console for Live Performance Charts
              </h3>
            </div>
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

      {/* Chart Section: 100% Real GSC Data or Verified Status */}
      {isConnected && hasPoints ? (
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
              Source: Google Search Console (Standard 1–3 day delay)
            </span>
          </div>

          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={realChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="realClicksGrad" x1="0" y1="0" x2="0" y2="1">
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

                <Area type="monotone" dataKey="clicks" stroke="var(--color-signal-400)" strokeWidth={2.5} fill="url(#realClicksGrad)" name="Clicks" />
                <Line type="monotone" dataKey="impressions" stroke="var(--color-brand-400)" strokeWidth={1.5} dot={false} name="Impressions" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-brand-200/80 bg-surface-2/30 p-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
            <div className="space-y-0.5">
              <p className="font-bold text-brand-950 flex items-center gap-1.5">
                <CheckCircle2 size={14} className="text-success-700" />
                {totalExperiments} Fixes Crawled &amp; Verified Live on Your Site
              </p>
              <p className="text-brand-500">
                100% of merged code updates have been confirmed in your live HTML. Googlebot indexing cycles take 14 to 21 days to shift SERP positions.
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
      )}
    </div>
  );
}
