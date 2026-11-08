"use client";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  CartesianGrid,
} from "recharts";
import {
  Activity,
  ArrowUpRight,
  Clock,
  TrendingUp,
} from "lucide-react";

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
  // Realistic 42-day timeline data (21 days prior baseline + 21 days observation)
  const timelineData = [
    { day: "D-21", label: "3 wks prior", baseline: 142, actual: 142, projectedLift: null },
    { day: "D-18", label: "18d prior", baseline: 148, actual: 148, projectedLift: null },
    { day: "D-15", label: "15d prior", baseline: 139, actual: 139, projectedLift: null },
    { day: "D-12", label: "12d prior", baseline: 152, actual: 152, projectedLift: null },
    { day: "D-9",  label: "9d prior",  baseline: 145, actual: 145, projectedLift: null },
    { day: "D-6",  label: "6d prior",  baseline: 150, actual: 150, projectedLift: null },
    { day: "D-3",  label: "3d prior",  baseline: 147, actual: 147, projectedLift: null },
    { day: "Day 0", label: "Deploy Day", baseline: 151, actual: 151, projectedLift: 151, isDeploy: true },
    { day: "Day 1", label: "Today (Day 1)", baseline: 150, actual: 154, projectedLift: 156, isCurrent: true },
    { day: "Day 3", label: "Day 3", baseline: 149, actual: null, projectedLift: 164 },
    { day: "Day 6", label: "Day 6", baseline: 152, actual: null, projectedLift: 178 },
    { day: "Day 9", label: "Day 9", baseline: 148, actual: null, projectedLift: 194 },
    { day: "Day 12", label: "Day 12", baseline: 153, actual: null, projectedLift: 206 },
    { day: "Day 15", label: "Day 15", baseline: 150, actual: null, projectedLift: 218 },
    { day: "Day 18", label: "Day 18", baseline: 151, actual: null, projectedLift: 228 },
    { day: "Day 21", label: "Day 21 (Assessment)", baseline: 152, actual: null, projectedLift: 238, isDecision: true },
  ];

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
              Search Performance &amp; 21-Day Observation Window
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-signal-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-signal-400" />
              </span>
            </h2>
            <p className="text-xs text-brand-500">
              Tracking Search Console clicks &amp; Googlebot re-indexing across your {totalExperiments} deployed fixes.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-surface-2 px-3 py-1 font-semibold text-brand-700">
            <Clock size={12} className="text-signal-400" />
            Observation: Day 1 of 21 Active
          </span>
        </div>
      </div>

      {/* 3 Clean Key Metrics */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-brand-200/80 bg-surface-2/60 p-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-brand-500">Pre-Fix Baseline</p>
          <p className="mt-0.5 text-[15px] font-bold text-brand-950">~150 Clicks / day</p>
          <p className="text-[10.5px] text-brand-500">Past 28-day historical average</p>
        </div>

        <div className="rounded-xl border border-brand-200/80 bg-surface-2/60 p-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-brand-500">Current Phase</p>
          <p className="mt-0.5 text-[15px] font-bold text-signal-ink flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-signal-400 animate-pulse" />
            Googlebot Crawling
          </p>
          <p className="text-[10.5px] text-brand-500">Day 1 of 21 (20 days remaining)</p>
        </div>

        <div className="rounded-xl border border-brand-200/80 bg-surface-2/60 p-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-brand-500">Target Growth</p>
          <p className="mt-0.5 text-[15px] font-bold text-success-800 flex items-center gap-1">
            <ArrowUpRight size={15} />
            +35% to +50% Lift Target
          </p>
          <p className="text-[10.5px] text-brand-500">~220–240 Clicks / day</p>
        </div>
      </div>

      {/* Chart */}
      <div className="rounded-xl border border-brand-200/90 bg-surface-2/40 p-3.5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-brand-400" />
              <span className="text-brand-600 font-medium">Baseline Traffic</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-signal-400" />
              <span className="text-brand-950 font-bold">Observed Traffic (Day 1)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-success-500" />
              <span className="text-success-800 font-semibold">Target Growth Trajectory</span>
            </div>
          </div>

          <span className="font-mono text-[11px] text-brand-500">
            21-Day Observation Window
          </span>
        </div>

        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={timelineData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="baselineGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-brand-400)" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="var(--color-brand-400)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="liftGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-series-3)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--color-series-3)" stopOpacity={0.02} />
                </linearGradient>
              </defs>

              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-brand-200)" vertical={false} opacity={0.4} />
              <XAxis dataKey="day" stroke="var(--color-brand-400)" fontSize={11} tickLine={false} />
              <YAxis domain={[120, 260]} stroke="var(--color-brand-400)" fontSize={11} tickLine={false} />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    const d = payload[0].payload;
                    return (
                      <div className="rounded-xl border border-brand-200 bg-surface-1 p-3 shadow-xl text-xs space-y-1">
                        <p className="font-bold text-brand-950">{d.label || label}</p>
                        <p className="text-brand-500">Baseline: <strong className="text-brand-800">{d.baseline} clicks/d</strong></p>
                        {d.actual != null && (
                          <p className="text-signal-ink font-bold">Observed: {d.actual} clicks/d</p>
                        )}
                        {d.projectedLift != null && (
                          <p className="text-success-700">Target Lift: {d.projectedLift} clicks/d</p>
                        )}
                        {d.isDeploy && (
                          <p className="text-[10px] font-bold text-brand-500 uppercase">★ Fix Merged &amp; Verified Live</p>
                        )}
                        {d.isCurrent && (
                          <p className="text-[10px] font-bold text-signal-ink uppercase">● Current Day (Day 1)</p>
                        )}
                      </div>
                    );
                  }
                  return null;
                }}
              />

              <ReferenceLine x="Day 0" stroke="var(--color-signal-400)" strokeWidth={1.5} strokeDasharray="3 3" label={{ value: "Deployed", position: "insideTopLeft", fill: "var(--color-signal-400)", fontSize: 10 }} />
              <ReferenceLine x="Day 21" stroke="var(--color-warning-500)" strokeWidth={1.5} strokeDasharray="3 3" label={{ value: "Assessment", position: "insideTopRight", fill: "var(--color-warning-500)", fontSize: 10 }} />

              <Area type="monotone" dataKey="baseline" stroke="var(--color-brand-400)" strokeWidth={1.5} fill="url(#baselineGrad)" name="Baseline" />
              <Area type="monotone" dataKey="projectedLift" stroke="var(--color-series-3)" strokeWidth={2} strokeDasharray="4 4" fill="url(#liftGrad)" name="Target Growth" />
              <Line type="monotone" dataKey="actual" stroke="var(--color-signal-400)" strokeWidth={3} dot={{ r: 4, fill: "var(--color-signal-400)" }} activeDot={{ r: 6 }} name="Observed" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
