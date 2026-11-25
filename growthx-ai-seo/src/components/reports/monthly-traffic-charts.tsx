"use client";

import { useMemo, useState } from "react";
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BarChart3 } from "lucide-react";

export interface DailyMetricPoint {
  date: string;
  a: number | null;
  b: number | null;
}

type Granularity = "daily" | "weekly";

interface ChartDatum {
  key: string;
  label: string;
  fullLabel: string;
  a: number | null;
  b: number | null;
}

const fmtInt = (n: number) => Math.round(n).toLocaleString();
const fmtDec = (n: number) => (Number.isInteger(n) ? n.toLocaleString() : n.toFixed(1));

function shortDate(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso.slice(8);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function fullDate(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

/**
 * Trims unrecorded trailing days beyond the last synced measurement so charts
 * fill their horizontal canvas evenly, while preserving any internal gaps.
 */
function trimTrailingUnrecorded(rows: DailyMetricPoint[]): DailyMetricPoint[] {
  let lastIdx = -1;
  for (let i = rows.length - 1; i >= 0; i--) {
    if (rows[i].a !== null || rows[i].b !== null) {
      lastIdx = i;
      break;
    }
  }
  return lastIdx >= 0 ? rows.slice(0, lastIdx + 1) : rows;
}

function buildDailySeries(rows: DailyMetricPoint[]): ChartDatum[] {
  return trimTrailingUnrecorded(rows).map((r) => ({
    key: r.date,
    label: shortDate(r.date),
    fullLabel: fullDate(r.date),
    a: r.a,
    b: r.b,
  }));
}

function buildWeeklySeries(rows: DailyMetricPoint[], modeB: "sum" | "peak"): ChartDatum[] {
  const trimmed = trimTrailingUnrecorded(rows);
  const buckets: DailyMetricPoint[][] = [];
  for (let i = 0; i < trimmed.length; i += 7) {
    buckets.push(trimmed.slice(i, i + 7));
  }
  return buckets.map((chunk, idx) => {
    const start = chunk[0]?.date ?? "";
    const end = chunk[chunk.length - 1]?.date ?? start;
    const validA = chunk.filter((r) => r.a !== null).map((r) => r.a as number);
    const validB = chunk.filter((r) => r.b !== null).map((r) => r.b as number);
    const a = validA.length > 0 ? validA.reduce((s, v) => s + v, 0) : null;
    const b =
      validB.length === 0
        ? null
        : modeB === "sum"
          ? validB.reduce((s, v) => s + v, 0)
          : Math.max(...validB);
    return {
      key: `w${idx + 1}`,
      label: `${shortDate(start)}–${end.slice(8).replace(/^0/, "")}`,
      fullLabel: `Week ${idx + 1} · ${shortDate(start)} – ${shortDate(end)}`,
      a,
      b,
    };
  });
}

export function MonthlyTrafficCharts({
  ga4Daily,
  gscDaily,
  trafficLoading,
  trafficError,
  searchLoading,
  searchError,
}: {
  ga4Daily: DailyMetricPoint[];
  gscDaily: DailyMetricPoint[];
  trafficLoading: boolean;
  trafficError: boolean;
  searchLoading: boolean;
  searchError: boolean;
}) {
  const [ga4View, setGa4View] = useState<Granularity>("daily");
  const [gscView, setGscView] = useState<Granularity>("daily");
  const [showSessions, setShowSessions] = useState(true);
  const [showUsers, setShowUsers] = useState(true);
  const [showClicks, setShowClicks] = useState(true);
  const [showImpressions, setShowImpressions] = useState(true);

  const ga4Stats = useMemo(() => {
    const recorded = ga4Daily.filter((r) => r.a !== null);
    if (recorded.length === 0) return null;
    const totalSessions = recorded.reduce((s, r) => s + (r.a ?? 0), 0);
    const avgSessions = totalSessions / recorded.length;
    const peakDay = recorded.reduce((best, r) => ((r.a ?? 0) > (best.a ?? 0) ? r : best), recorded[0]);
    const peakUsers = Math.max(...recorded.map((r) => r.b ?? 0));
    const firstDate = recorded[0].date;
    const lastDate = recorded[recorded.length - 1].date;

    const mid = Math.floor(recorded.length / 2);
    const firstAvg = mid > 0 ? recorded.slice(0, mid).reduce((s, r) => s + (r.a ?? 0), 0) / mid : null;
    const secondAvg =
      recorded.length - mid > 0
        ? recorded.slice(mid).reduce((s, r) => s + (r.a ?? 0), 0) / (recorded.length - mid)
        : null;

    let note = `${recorded.length} recorded days · averaging ${fmtDec(avgSessions)} sessions per day.`;
    if (peakDay.a && avgSessions > 0 && peakDay.a >= avgSessions * 2.2) {
      note = `Peak traffic reached ${fmtInt(peakDay.a)} sessions on ${shortDate(peakDay.date)} (${(peakDay.a / avgSessions).toFixed(1)}× the daily average).`;
    } else if (firstAvg && secondAvg && firstAvg >= 3) {
      const pct = Math.round(((secondAvg - firstAvg) / firstAvg) * 100);
      if (Math.abs(pct) >= 15) {
        note = `Daily sessions ${pct > 0 ? "increased" : "declined"} ${pct > 0 ? "+" : ""}${pct}% in the second half of the month.`;
      }
    }

    return { totalSessions, avgSessions, peakDay, peakUsers, firstDate, lastDate, note };
  }, [ga4Daily]);

  const gscStats = useMemo(() => {
    const recorded = gscDaily.filter((r) => r.a !== null || r.b !== null);
    if (recorded.length === 0) return null;
    const totalClicks = recorded.reduce((s, r) => s + (r.a ?? 0), 0);
    const totalImpressions = recorded.reduce((s, r) => s + (r.b ?? 0), 0);
    const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
    const peakImps = recorded.reduce((best, r) => ((r.b ?? 0) > (best.b ?? 0) ? r : best), recorded[0]);
    const firstDate = recorded[0].date;
    const lastDate = recorded[recorded.length - 1].date;

    const mid = Math.floor(recorded.length / 2);
    const firstImps = mid > 0 ? recorded.slice(0, mid).reduce((s, r) => s + (r.b ?? 0), 0) / mid : 0;
    const secondImps =
      recorded.length - mid > 0
        ? recorded.slice(mid).reduce((s, r) => s + (r.b ?? 0), 0) / (recorded.length - mid)
        : 0;
    const impGrowthPct = firstImps >= 3 ? Math.round(((secondImps - firstImps) / firstImps) * 100) : null;

    let note = `${fmtInt(totalClicks)} clicks from ${fmtInt(totalImpressions)} search impressions (${avgCtr.toFixed(1)}% CTR).`;
    if (impGrowthPct !== null && impGrowthPct >= 25 && avgCtr < 4) {
      note = `Impressions rose +${impGrowthPct}% in the second half (peak ${fmtInt(peakImps.b ?? 0)} on ${shortDate(peakImps.date)}), while CTR held at ${avgCtr.toFixed(1)}% — refining page titles can capture more clicks.`;
    } else if (impGrowthPct !== null && Math.abs(impGrowthPct) >= 20) {
      note = `Search impressions ${impGrowthPct > 0 ? "grew" : "eased"} ${impGrowthPct > 0 ? "+" : ""}${impGrowthPct}% in the second half; highest visibility was ${fmtInt(peakImps.b ?? 0)} on ${shortDate(peakImps.date)}.`;
    }

    return { totalClicks, totalImpressions, avgCtr, firstDate, lastDate, note };
  }, [gscDaily]);

  const ga4ChartData = useMemo(
    () => (ga4View === "daily" ? buildDailySeries(ga4Daily) : buildWeeklySeries(ga4Daily, "peak")),
    [ga4Daily, ga4View],
  );

  const gscChartData = useMemo(
    () => (gscView === "daily" ? buildDailySeries(gscDaily) : buildWeeklySeries(gscDaily, "sum")),
    [gscDaily, gscView],
  );

  return (
    <section className="report-section space-y-4" aria-label="Search and visitor trends">
      <div>
        <h2 className="text-lg font-bold text-brand-950">Search and visitors</h2>
        <p className="text-xs text-brand-500">
          Measured website sessions and Google search visibility. Click any metric below to isolate its trend.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* LEFT CARD: Visitors & sessions (GA4) */}
        <div className="flex flex-col justify-between rounded-2xl border border-brand-200 bg-surface-1 p-5 shadow-2xs">
          <div>
            {/* Clean single header row */}
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-brand-950">Visitors and sessions</h3>
                <p className="mt-0.5 text-[11px] text-brand-400">
                  Google Analytics 4
                  {ga4Stats ? ` · ${shortDate(ga4Stats.firstDate)} – ${shortDate(ga4Stats.lastDate)}` : ""}
                </p>
              </div>
              <div className="no-print inline-flex rounded-lg bg-brand-100/80 p-0.5 text-[11px] font-medium">
                <button
                  type="button"
                  onClick={() => setGa4View("daily")}
                  className={`rounded-md px-2.5 py-0.5 transition cursor-pointer ${
                    ga4View === "daily" ? "bg-surface-1 text-brand-950 shadow-2xs" : "text-brand-500 hover:text-brand-800"
                  }`}
                >
                  Daily
                </button>
                <button
                  type="button"
                  onClick={() => setGa4View("weekly")}
                  className={`rounded-md px-2.5 py-0.5 transition cursor-pointer ${
                    ga4View === "weekly" ? "bg-surface-1 text-brand-950 shadow-2xs" : "text-brand-500 hover:text-brand-800"
                  }`}
                >
                  Weekly
                </button>
              </div>
            </div>

            {/* Clean inline metric strip (acts as interactive legend — zero nested boxes) */}
            {ga4Stats && (
              <div className="mt-4 flex flex-wrap items-end gap-x-7 gap-y-2 border-b border-brand-100 pb-3.5">
                <button
                  type="button"
                  onClick={() => setShowSessions((v) => (v && !showUsers ? v : !v))}
                  className={`group text-left transition cursor-pointer ${showSessions ? "opacity-100" : "opacity-40"}`}
                >
                  <span className="flex items-center gap-1.5 text-[11px] font-medium text-brand-500 group-hover:text-brand-800">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: "var(--color-series-3)" }} />
                    Sessions
                  </span>
                  <span className="mt-0.5 block font-mono text-xl font-semibold tracking-tight text-brand-950">
                    {fmtInt(ga4Stats.totalSessions)}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowUsers((v) => (v && !showSessions ? v : !v))}
                  className={`group text-left transition cursor-pointer ${showUsers ? "opacity-100" : "opacity-40"}`}
                >
                  <span className="flex items-center gap-1.5 text-[11px] font-medium text-brand-500 group-hover:text-brand-800">
                    <span className="h-0.5 w-3 rounded-full" style={{ backgroundColor: "var(--color-series-1)" }} />
                    Peak active users
                  </span>
                  <span className="mt-0.5 block font-mono text-xl font-semibold tracking-tight text-brand-950">
                    {fmtInt(ga4Stats.peakUsers)}
                  </span>
                </button>

                <div className="ml-auto text-right">
                  <span className="block text-[11px] font-medium text-brand-400">Daily average</span>
                  <span className="mt-0.5 block font-mono text-sm font-semibold text-brand-700">
                    {fmtDec(ga4Stats.avgSessions)}
                    <span className="ml-0.5 font-sans text-[11px] font-normal text-brand-400">/day</span>
                  </span>
                </div>
              </div>
            )}

            {/* Smooth area + subtle dashed line */}
            <div
              className="mt-4 h-56 w-full"
              role="img"
              aria-label="Visitors and sessions trend chart"
            >
              {trafficLoading ? (
                <div className="flex h-full items-center justify-center text-xs text-brand-400">Loading…</div>
              ) : trafficError ? (
                <div className="flex h-full items-center justify-center text-xs text-error-700">
                  Source unavailable.
                </div>
              ) : !ga4Stats ? (
                <div className="flex h-full flex-col items-center justify-center gap-1 text-xs text-brand-400">
                  <BarChart3 size={22} className="text-brand-300" />
                  No saved measurements for this month.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={ga4ChartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="mrSessionsFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--color-series-3)" stopOpacity={0.18} />
                        <stop offset="100%" stopColor="var(--color-series-3)" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="var(--color-brand-100)" strokeDasharray="2 4" vertical={false} />
                    <XAxis
                      dataKey="label"
                      minTickGap={ga4View === "daily" ? 28 : 10}
                      tick={{ fontSize: 11, fill: "var(--color-brand-400)" }}
                      axisLine={false}
                      tickLine={false}
                      dy={6}
                    />
                    <YAxis
                      yAxisId="left"
                      allowDecimals={false}
                      tickCount={4}
                      tick={{ fontSize: 11, fill: "var(--color-brand-400)" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      cursor={{ stroke: "var(--color-brand-300)", strokeWidth: 1, strokeDasharray: "3 3" }}
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const datum = payload[0]?.payload as ChartDatum | undefined;
                        if (!datum) return null;
                        const ratio =
                          ga4View === "daily" && datum.a != null && datum.b != null && datum.b > 0
                            ? (datum.a / datum.b).toFixed(2)
                            : null;
                        return (
                          <div className="rounded-xl border border-brand-200/90 bg-surface-1 px-3 py-2.5 shadow-md">
                            <p className="text-[11px] font-medium text-brand-500">{datum.fullLabel}</p>
                            <div className="mt-1.5 space-y-1 text-xs">
                              {showSessions && (
                                <div className="flex items-center justify-between gap-5">
                                  <span className="flex items-center gap-1.5 text-brand-600">
                                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: "var(--color-series-3)" }} />
                                    Sessions
                                  </span>
                                  <span className="font-mono font-semibold text-brand-950">
                                    {datum.a !== null ? fmtInt(datum.a) : "—"}
                                  </span>
                                </div>
                              )}
                              {showUsers && (
                                <div className="flex items-center justify-between gap-5">
                                  <span className="flex items-center gap-1.5 text-brand-600">
                                    <span className="h-0.5 w-2.5 rounded-full" style={{ backgroundColor: "var(--color-series-1)" }} />
                                    {ga4View === "daily" ? "Active users" : "Peak daily users"}
                                  </span>
                                  <span className="font-mono font-semibold text-brand-950">
                                    {datum.b !== null ? fmtInt(datum.b) : "—"}
                                  </span>
                                </div>
                              )}
                              {ratio && (
                                <div className="flex items-center justify-between gap-5 border-t border-brand-100 pt-1 text-[11px] text-brand-400">
                                  <span>Sessions / user</span>
                                  <span className="font-mono text-brand-700">{ratio}×</span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      }}
                    />
                    {showSessions &&
                      (ga4View === "weekly" ? (
                        <Bar
                          yAxisId="left"
                          dataKey="a"
                          name="Sessions"
                          fill="var(--color-series-3)"
                          fillOpacity={0.85}
                          radius={[5, 5, 0, 0]}
                          barSize={28}
                        />
                      ) : (
                        <Area
                          yAxisId="left"
                          type="monotone"
                          dataKey="a"
                          name="Sessions"
                          stroke="var(--color-series-3)"
                          strokeWidth={2}
                          fill="url(#mrSessionsFill)"
                          dot={false}
                          activeDot={{ r: 4, fill: "var(--color-series-3)", strokeWidth: 2, stroke: "var(--color-surface-1)" }}
                          connectNulls={false}
                        />
                      ))}
                    {showUsers && (
                      <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="b"
                        name="Active users"
                        stroke="var(--color-series-1)"
                        strokeWidth={1.6}
                        strokeDasharray="4 4"
                        dot={false}
                        activeDot={{ r: 3.5, fill: "var(--color-series-1)", strokeWidth: 2, stroke: "var(--color-surface-1)" }}
                        connectNulls={false}
                      />
                    )}
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <p className="mt-4 border-t border-brand-100 pt-3 text-[11.5px] leading-relaxed text-brand-500">
            {ga4Stats ? ga4Stats.note : "Connect Google Analytics 4 to view audience trends."}
          </p>
        </div>

        {/* RIGHT CARD: Google search activity (GSC) */}
        <div className="flex flex-col justify-between rounded-2xl border border-brand-200 bg-surface-1 p-5 shadow-2xs">
          <div>
            {/* Clean single header row */}
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-brand-950">Google search activity</h3>
                <p className="mt-0.5 text-[11px] text-brand-400">
                  Google Search Console
                  {gscStats ? ` · ${shortDate(gscStats.firstDate)} – ${shortDate(gscStats.lastDate)}` : ""}
                </p>
              </div>
              <div className="no-print inline-flex rounded-lg bg-brand-100/80 p-0.5 text-[11px] font-medium">
                <button
                  type="button"
                  onClick={() => setGscView("daily")}
                  className={`rounded-md px-2.5 py-0.5 transition cursor-pointer ${
                    gscView === "daily" ? "bg-surface-1 text-brand-950 shadow-2xs" : "text-brand-500 hover:text-brand-800"
                  }`}
                >
                  Daily
                </button>
                <button
                  type="button"
                  onClick={() => setGscView("weekly")}
                  className={`rounded-md px-2.5 py-0.5 transition cursor-pointer ${
                    gscView === "weekly" ? "bg-surface-1 text-brand-950 shadow-2xs" : "text-brand-500 hover:text-brand-800"
                  }`}
                >
                  Weekly
                </button>
              </div>
            </div>

            {/* Clean inline metric strip (acts as interactive legend) */}
            {gscStats && (
              <div className="mt-4 flex flex-wrap items-end gap-x-7 gap-y-2 border-b border-brand-100 pb-3.5">
                <button
                  type="button"
                  onClick={() => setShowClicks((v) => (v && !showImpressions ? v : !v))}
                  className={`group text-left transition cursor-pointer ${showClicks ? "opacity-100" : "opacity-40"}`}
                >
                  <span className="flex items-center gap-1.5 text-[11px] font-medium text-brand-500 group-hover:text-brand-800">
                    <span className="h-2 w-2 rounded-xs" style={{ backgroundColor: "var(--color-series-3)" }} />
                    Clicks
                  </span>
                  <span className="mt-0.5 block font-mono text-xl font-semibold tracking-tight text-brand-950">
                    {fmtInt(gscStats.totalClicks)}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowImpressions((v) => (v && !showClicks ? v : !v))}
                  className={`group text-left transition cursor-pointer ${showImpressions ? "opacity-100" : "opacity-40"}`}
                >
                  <span className="flex items-center gap-1.5 text-[11px] font-medium text-brand-500 group-hover:text-brand-800">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: "var(--color-series-1)" }} />
                    Impressions
                  </span>
                  <span className="mt-0.5 block font-mono text-xl font-semibold tracking-tight text-brand-950">
                    {fmtInt(gscStats.totalImpressions)}
                  </span>
                </button>

                <div className="ml-auto text-right">
                  <span className="block text-[11px] font-medium text-brand-400">Average CTR</span>
                  <span className="mt-0.5 block font-mono text-sm font-semibold text-brand-700">
                    {gscStats.avgCtr.toFixed(1)}%
                  </span>
                </div>
              </div>
            )}

            {/* Soft Impressions area + slim Clicks stems */}
            <div
              className="mt-4 h-56 w-full"
              role="img"
              aria-label="Google search clicks and impressions trend chart"
            >
              {searchLoading ? (
                <div className="flex h-full items-center justify-center text-xs text-brand-400">Loading…</div>
              ) : searchError ? (
                <div className="flex h-full items-center justify-center text-xs text-error-700">
                  Source unavailable.
                </div>
              ) : !gscStats ? (
                <div className="flex h-full flex-col items-center justify-center gap-1 text-xs text-brand-400">
                  <BarChart3 size={22} className="text-brand-300" />
                  No saved measurements for this month.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={gscChartData} margin={{ top: 8, right: 2, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="mrImpressionsFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--color-series-1)" stopOpacity={0.14} />
                        <stop offset="100%" stopColor="var(--color-series-1)" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="var(--color-brand-100)" strokeDasharray="2 4" vertical={false} />
                    <XAxis
                      dataKey="label"
                      minTickGap={gscView === "daily" ? 28 : 10}
                      tick={{ fontSize: 11, fill: "var(--color-brand-400)" }}
                      axisLine={false}
                      tickLine={false}
                      dy={6}
                    />
                    <YAxis
                      yAxisId="left"
                      allowDecimals={false}
                      tickCount={4}
                      domain={[0, (max: number) => Math.max(4, Math.ceil(max * 1.4))]}
                      tick={{ fontSize: 11, fill: "var(--color-brand-400)" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      allowDecimals={false}
                      tickCount={4}
                      tick={{ fontSize: 11, fill: "var(--color-brand-400)" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      cursor={{ stroke: "var(--color-brand-300)", strokeWidth: 1, strokeDasharray: "3 3" }}
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const datum = payload[0]?.payload as ChartDatum | undefined;
                        if (!datum) return null;
                        const ctr =
                          datum.a != null && datum.b != null && datum.b > 0
                            ? `${((datum.a / datum.b) * 100).toFixed(1)}%`
                            : null;
                        return (
                          <div className="rounded-xl border border-brand-200/90 bg-surface-1 px-3 py-2.5 shadow-md">
                            <p className="text-[11px] font-medium text-brand-500">{datum.fullLabel}</p>
                            <div className="mt-1.5 space-y-1 text-xs">
                              {showClicks && (
                                <div className="flex items-center justify-between gap-5">
                                  <span className="flex items-center gap-1.5 text-brand-600">
                                    <span className="h-2 w-2 rounded-xs" style={{ backgroundColor: "var(--color-series-3)" }} />
                                    Clicks
                                  </span>
                                  <span className="font-mono font-semibold text-brand-950">
                                    {datum.a !== null ? fmtInt(datum.a) : "—"}
                                  </span>
                                </div>
                              )}
                              {showImpressions && (
                                <div className="flex items-center justify-between gap-5">
                                  <span className="flex items-center gap-1.5 text-brand-600">
                                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: "var(--color-series-1)" }} />
                                    Impressions
                                  </span>
                                  <span className="font-mono font-semibold text-brand-950">
                                    {datum.b !== null ? fmtInt(datum.b) : "—"}
                                  </span>
                                </div>
                              )}
                              {ctr && (
                                <div className="flex items-center justify-between gap-5 border-t border-brand-100 pt-1 text-[11px] text-brand-400">
                                  <span>CTR</span>
                                  <span className="font-mono text-brand-700">{ctr}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      }}
                    />
                    {showImpressions && (
                      <Area
                        yAxisId="right"
                        type="monotone"
                        dataKey="b"
                        name="Impressions"
                        stroke="var(--color-series-1)"
                        strokeWidth={2}
                        fill="url(#mrImpressionsFill)"
                        dot={false}
                        activeDot={{ r: 4, fill: "var(--color-series-1)", strokeWidth: 2, stroke: "var(--color-surface-1)" }}
                        connectNulls={false}
                      />
                    )}
                    {showClicks && (
                      <Bar
                        yAxisId="left"
                        dataKey="a"
                        name="Clicks"
                        fill="var(--color-series-3)"
                        fillOpacity={0.72}
                        radius={[3, 3, 0, 0]}
                        barSize={gscView === "daily" ? 6 : 24}
                      />
                    )}
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <p className="mt-4 border-t border-brand-100 pt-3 text-[11.5px] leading-relaxed text-brand-500">
            {gscStats ? gscStats.note : "Connect Google Search Console to view search trends."}
          </p>
        </div>
      </div>
    </section>
  );
}
