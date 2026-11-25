"use client";

import { useMemo, useState } from "react";
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BarChart3, CalendarDays, Sparkles } from "lucide-react";

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
  /** For weekly GA4: average daily active users across recorded days (never summed across days). */
  daysRecorded: number;
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

function buildWeeklySeries(
  rows: DailyMetricPoint[],
  modeB: "sum" | "peak",
): ChartDatum[] {
  const buckets: DailyMetricPoint[][] = [];
  for (let i = 0; i < rows.length; i += 7) {
    buckets.push(rows.slice(i, i + 7));
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
      fullLabel: `Week ${idx + 1} (${shortDate(start)} – ${shortDate(end)})`,
      a,
      b,
      daysRecorded: validA.length,
    };
  });
}

function buildDailySeries(rows: DailyMetricPoint[]): ChartDatum[] {
  return rows.map((r) => ({
    key: r.date,
    label: shortDate(r.date),
    fullLabel: fullDate(r.date),
    a: r.a,
    b: r.b,
    daysRecorded: r.a !== null ? 1 : 0,
  }));
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
    const lastRecorded = recorded[recorded.length - 1];
    const trailingMissing = ga4Daily.length - ga4Daily.findIndex((r) => r.date === lastRecorded.date) - 1;

    // Split recorded days into first half vs second half to compute an honest directional note
    const mid = Math.floor(recorded.length / 2);
    const firstAvg = mid > 0 ? recorded.slice(0, mid).reduce((s, r) => s + (r.a ?? 0), 0) / mid : null;
    const secondAvg =
      recorded.length - mid > 0
        ? recorded.slice(mid).reduce((s, r) => s + (r.a ?? 0), 0) / (recorded.length - mid)
        : null;

    let insight = `Averaged ${fmtDec(avgSessions)} sessions/day across ${recorded.length} recorded days. Peak hit ${fmtInt(peakDay.a ?? 0)} sessions on ${shortDate(peakDay.date)}.`;
    if (peakDay.a && avgSessions > 0 && peakDay.a >= avgSessions * 2.2) {
      const mult = (peakDay.a / avgSessions).toFixed(1);
      insight = `Peak traffic hit ${fmtInt(peakDay.a)} sessions on ${shortDate(peakDay.date)} (${mult}× your ${fmtDec(avgSessions)}/day average).`;
    } else if (firstAvg && secondAvg && firstAvg >= 3) {
      const pct = Math.round(((secondAvg - firstAvg) / firstAvg) * 100);
      if (Math.abs(pct) >= 15) {
        insight = `Daily sessions ${pct > 0 ? "rose" : "dipped"} ${pct > 0 ? "+" : ""}${pct}% in the second half of the month (${fmtDec(secondAvg)}/day vs ${fmtDec(firstAvg)}/day).`;
      }
    }

    return {
      recordedDays: recorded.length,
      totalSessions,
      avgSessions,
      peakDay,
      peakUsers,
      lastDate: lastRecorded.date,
      trailingMissing,
      insight,
    };
  }, [ga4Daily]);

  const gscStats = useMemo(() => {
    const recorded = gscDaily.filter((r) => r.a !== null || r.b !== null);
    if (recorded.length === 0) return null;
    const totalClicks = recorded.reduce((s, r) => s + (r.a ?? 0), 0);
    const totalImpressions = recorded.reduce((s, r) => s + (r.b ?? 0), 0);
    const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
    const peakImps = recorded.reduce((best, r) => ((r.b ?? 0) > (best.b ?? 0) ? r : best), recorded[0]);
    const lastRecorded = recorded[recorded.length - 1];
    const trailingMissing = gscDaily.length - gscDaily.findIndex((r) => r.date === lastRecorded.date) - 1;

    const mid = Math.floor(recorded.length / 2);
    const firstImps = mid > 0 ? recorded.slice(0, mid).reduce((s, r) => s + (r.b ?? 0), 0) / mid : 0;
    const secondImps =
      recorded.length - mid > 0
        ? recorded.slice(mid).reduce((s, r) => s + (r.b ?? 0), 0) / (recorded.length - mid)
        : 0;
    const impGrowthPct = firstImps >= 3 ? Math.round(((secondImps - firstImps) / firstImps) * 100) : null;

    let insight = `${fmtInt(totalClicks)} clicks from ${fmtInt(totalImpressions)} search impressions (${avgCtr.toFixed(1)}% CTR) across ${recorded.length} recorded days.`;
    if (impGrowthPct !== null && impGrowthPct >= 25 && avgCtr < 4) {
      insight = `Impressions grew +${impGrowthPct}% in the second half (peak ${fmtInt(peakImps.b ?? 0)} on ${shortDate(peakImps.date)}), while CTR stayed at ${avgCtr.toFixed(1)}% — a strong title & snippet optimization opportunity.`;
    } else if (impGrowthPct !== null && Math.abs(impGrowthPct) >= 20) {
      insight = `Daily impressions ${impGrowthPct > 0 ? "climbed" : "softened"} ${impGrowthPct > 0 ? "+" : ""}${impGrowthPct}% in the second half; highest visibility was ${fmtInt(peakImps.b ?? 0)} on ${shortDate(peakImps.date)}.`;
    }

    return {
      recordedDays: recorded.length,
      totalClicks,
      totalImpressions,
      avgCtr,
      peakImps,
      lastDate: lastRecorded.date,
      trailingMissing,
      insight,
    };
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
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-brand-950">Search and visitors</h2>
          <p className="text-xs text-brand-500">
            Measured audience visits (GA4) and Google search visibility (Search Console). Switch to Weekly to smooth low-volume days.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* LEFT CARD: Visitors and sessions (GA4) */}
        <div className="flex flex-col justify-between rounded-2xl border border-brand-200 bg-surface-1 p-5 shadow-2xs">
          <div>
            {/* Card header + Daily/Weekly switcher */}
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-brand-950">Visitors and sessions</h3>
                <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-brand-500">
                  <span>Google Analytics 4</span>
                  {ga4Stats && (
                    <>
                      <span>·</span>
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays size={11} />
                        Synced through {shortDate(ga4Stats.lastDate)}
                      </span>
                    </>
                  )}
                </p>
              </div>
              <div className="no-print inline-flex rounded-lg border border-brand-200 bg-brand-50 p-0.5 text-[11px] font-semibold">
                <button
                  type="button"
                  onClick={() => setGa4View("daily")}
                  className={`rounded-md px-2 py-0.5 transition cursor-pointer ${
                    ga4View === "daily" ? "bg-surface-1 text-brand-950 shadow-2xs" : "text-brand-500 hover:text-brand-800"
                  }`}
                >
                  Daily
                </button>
                <button
                  type="button"
                  onClick={() => setGa4View("weekly")}
                  className={`rounded-md px-2 py-0.5 transition cursor-pointer ${
                    ga4View === "weekly" ? "bg-surface-1 text-brand-950 shadow-2xs" : "text-brand-500 hover:text-brand-800"
                  }`}
                >
                  Weekly
                </button>
              </div>
            </div>

            {/* Inline KPI strip */}
            {ga4Stats && (
              <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl border border-brand-200/70 bg-brand-50/60 p-2.5">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-brand-400">Total sessions</p>
                  <p className="mt-0.5 font-mono text-[15px] font-bold text-brand-950">
                    {fmtInt(ga4Stats.totalSessions)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-brand-400">Daily average</p>
                  <p className="mt-0.5 font-mono text-[15px] font-bold text-brand-950">
                    {fmtDec(ga4Stats.avgSessions)}
                    <span className="ml-0.5 text-[10.5px] font-normal text-brand-500">/day</span>
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-brand-400">Peak day</p>
                  <p className="mt-0.5 font-mono text-[15px] font-bold text-success-700">
                    {fmtInt(ga4Stats.peakDay.a ?? 0)}
                    <span className="ml-1 font-sans text-[10.5px] font-medium text-brand-500">
                      {shortDate(ga4Stats.peakDay.date)}
                    </span>
                  </p>
                </div>
              </div>
            )}

            {/* Interactive series toggle pills */}
            <div className="mt-3 flex flex-wrap items-center gap-2 text-[11.5px]">
              <button
                type="button"
                onClick={() => setShowSessions((v) => (v && !showUsers ? v : !v))}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-medium transition cursor-pointer ${
                  showSessions
                    ? "border-success-200 bg-success-50 text-success-700"
                    : "border-brand-200 bg-brand-50 text-brand-400"
                }`}
              >
                <span
                  className="h-2 w-2 rounded-xs"
                  style={{ backgroundColor: "var(--color-series-3)" }}
                />
                Sessions (bars)
              </button>
              <button
                type="button"
                onClick={() => setShowUsers((v) => (v && !showSessions ? v : !v))}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-medium transition cursor-pointer ${
                  showUsers
                    ? "border-accent-200 bg-accent-50 text-accent-700"
                    : "border-brand-200 bg-brand-50 text-brand-400"
                }`}
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: "var(--color-series-1)" }}
                />
                {ga4View === "daily" ? "Active users (line)" : "Peak daily users (line)"}
              </button>
              {ga4View === "daily" && ga4Stats && (
                <span className="ml-auto text-[10.5px] text-brand-400">
                  Dashed: {fmtDec(ga4Stats.avgSessions)} avg
                </span>
              )}
            </div>

            {/* Chart canvas */}
            <div
              className="mt-3 h-60 w-full"
              role="img"
              aria-label="Visitors and sessions chart; unrecorded days remain empty"
            >
              {trafficLoading ? (
                <div className="flex h-full items-center justify-center text-xs text-brand-500">Loading…</div>
              ) : trafficError ? (
                <div className="flex h-full items-center justify-center text-xs text-error-700">
                  Source unavailable.
                </div>
              ) : !ga4Stats ? (
                <div className="flex h-full flex-col items-center justify-center gap-1 text-xs text-brand-500">
                  <BarChart3 size={24} className="text-brand-300" />
                  No saved measurements for this month.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={ga4ChartData} margin={{ top: 10, right: 10, left: -18, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 4" stroke="var(--color-brand-100)" vertical={false} />
                    <XAxis
                      dataKey="label"
                      minTickGap={ga4View === "daily" ? 24 : 8}
                      tick={{ fontSize: 11, fill: "var(--color-brand-500)" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      yAxisId="left"
                      allowDecimals={false}
                      tick={{ fontSize: 11, fill: "var(--color-brand-400)" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      cursor={{ fill: "var(--color-brand-100)", fillOpacity: 0.45 }}
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const datum = payload[0]?.payload as ChartDatum | undefined;
                        if (!datum) return null;
                        const sessVal = datum.a;
                        const userVal = datum.b;
                        const ratio =
                          ga4View === "daily" && sessVal != null && userVal != null && userVal > 0
                            ? (sessVal / userVal).toFixed(2)
                            : null;
                        return (
                          <div className="rounded-xl border border-brand-200 bg-surface-1 p-3 shadow-lg">
                            <p className="text-[11px] font-semibold text-brand-500">{datum.fullLabel}</p>
                            <div className="mt-1.5 space-y-1 text-xs">
                              {showSessions && (
                                <div className="flex items-center justify-between gap-4">
                                  <span className="flex items-center gap-1.5 font-medium text-brand-700">
                                    <span className="h-2 w-2 rounded-xs" style={{ backgroundColor: "var(--color-series-3)" }} />
                                    Sessions
                                  </span>
                                  <span className="font-mono font-bold text-brand-950">
                                    {sessVal !== null ? fmtInt(sessVal) : "Not recorded"}
                                  </span>
                                </div>
                              )}
                              {showUsers && (
                                <div className="flex items-center justify-between gap-4">
                                  <span className="flex items-center gap-1.5 font-medium text-brand-700">
                                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: "var(--color-series-1)" }} />
                                    {ga4View === "daily" ? "Active users" : "Peak daily users"}
                                  </span>
                                  <span className="font-mono font-bold text-brand-950">
                                    {userVal !== null ? fmtInt(userVal) : "Not recorded"}
                                  </span>
                                </div>
                              )}
                              {ratio && (
                                <div className="flex items-center justify-between gap-4 border-t border-brand-100 pt-1 text-[11px] text-brand-500">
                                  <span>Sessions / user</span>
                                  <span className="font-mono font-semibold text-brand-800">{ratio}×</span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      }}
                    />
                    {ga4View === "daily" && showSessions && (
                      <ReferenceLine
                        yAxisId="left"
                        y={ga4Stats.avgSessions}
                        stroke="var(--color-brand-300)"
                        strokeDasharray="4 4"
                      />
                    )}
                    {showSessions && (
                      <Bar
                        yAxisId="left"
                        dataKey="a"
                        name="Sessions"
                        fill="var(--color-series-3)"
                        fillOpacity={0.78}
                        radius={[4, 4, 0, 0]}
                        maxBarSize={ga4View === "daily" ? 14 : 36}
                      />
                    )}
                    {showUsers && (
                      <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="b"
                        name="Active users"
                        stroke="var(--color-series-1)"
                        strokeWidth={2.2}
                        dot={false}
                        activeDot={{ r: 4.5, strokeWidth: 2, stroke: "var(--color-surface-1)" }}
                        connectNulls={false}
                      />
                    )}
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Plain-English Takeaway Footer */}
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-brand-100 bg-brand-50/50 px-3 py-2 text-[11.5px] text-brand-600">
            <Sparkles size={13} className="mt-0.5 shrink-0 text-success-600" />
            <span>
              {ga4Stats ? ga4Stats.insight : "Connect Google Analytics 4 to track visitor trends."}
              {ga4Stats && ga4Stats.trailingMissing > 0
                ? ` (${ga4Stats.trailingMissing} trailing day${ga4Stats.trailingMissing === 1 ? "" : "s"} pending sync.)`
                : ""}
            </span>
          </div>
        </div>

        {/* RIGHT CARD: Google search activity (GSC) */}
        <div className="flex flex-col justify-between rounded-2xl border border-brand-200 bg-surface-1 p-5 shadow-2xs">
          <div>
            {/* Card header + Daily/Weekly switcher */}
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-brand-950">Google search activity</h3>
                <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-brand-500">
                  <span>Google Search Console</span>
                  {gscStats && (
                    <>
                      <span>·</span>
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays size={11} />
                        Synced through {shortDate(gscStats.lastDate)}
                      </span>
                    </>
                  )}
                </p>
              </div>
              <div className="no-print inline-flex rounded-lg border border-brand-200 bg-brand-50 p-0.5 text-[11px] font-semibold">
                <button
                  type="button"
                  onClick={() => setGscView("daily")}
                  className={`rounded-md px-2 py-0.5 transition cursor-pointer ${
                    gscView === "daily" ? "bg-surface-1 text-brand-950 shadow-2xs" : "text-brand-500 hover:text-brand-800"
                  }`}
                >
                  Daily
                </button>
                <button
                  type="button"
                  onClick={() => setGscView("weekly")}
                  className={`rounded-md px-2 py-0.5 transition cursor-pointer ${
                    gscView === "weekly" ? "bg-surface-1 text-brand-950 shadow-2xs" : "text-brand-500 hover:text-brand-800"
                  }`}
                >
                  Weekly
                </button>
              </div>
            </div>

            {/* Inline KPI strip */}
            {gscStats && (
              <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl border border-brand-200/70 bg-brand-50/60 p-2.5">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-brand-400">Total clicks</p>
                  <p className="mt-0.5 font-mono text-[15px] font-bold text-success-700">
                    {fmtInt(gscStats.totalClicks)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-brand-400">Impressions</p>
                  <p className="mt-0.5 font-mono text-[15px] font-bold text-brand-950">
                    {fmtInt(gscStats.totalImpressions)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-brand-400">Average CTR</p>
                  <p className="mt-0.5 font-mono text-[15px] font-bold text-brand-950">
                    {gscStats.avgCtr.toFixed(1)}%
                  </p>
                </div>
              </div>
            )}

            {/* Interactive series toggle pills */}
            <div className="mt-3 flex flex-wrap items-center gap-2 text-[11.5px]">
              <button
                type="button"
                onClick={() => setShowClicks((v) => (v && !showImpressions ? v : !v))}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-medium transition cursor-pointer ${
                  showClicks
                    ? "border-success-200 bg-success-50 text-success-700"
                    : "border-brand-200 bg-brand-50 text-brand-400"
                }`}
              >
                <span
                  className="h-2 w-2 rounded-xs"
                  style={{ backgroundColor: "var(--color-series-3)" }}
                />
                Clicks (bars · left)
              </button>
              <button
                type="button"
                onClick={() => setShowImpressions((v) => (v && !showClicks ? v : !v))}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-medium transition cursor-pointer ${
                  showImpressions
                    ? "border-accent-200 bg-accent-50 text-accent-700"
                    : "border-brand-200 bg-brand-50 text-brand-400"
                }`}
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: "var(--color-series-1)" }}
                />
                Impressions (area · right)
              </button>
            </div>

            {/* Chart canvas */}
            <div
              className="mt-3 h-60 w-full"
              role="img"
              aria-label="Google search clicks and impressions chart; unrecorded days remain empty"
            >
              {searchLoading ? (
                <div className="flex h-full items-center justify-center text-xs text-brand-500">Loading…</div>
              ) : searchError ? (
                <div className="flex h-full items-center justify-center text-xs text-error-700">
                  Source unavailable.
                </div>
              ) : !gscStats ? (
                <div className="flex h-full flex-col items-center justify-center gap-1 text-xs text-brand-500">
                  <BarChart3 size={24} className="text-brand-300" />
                  No saved measurements for this month.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={gscChartData} margin={{ top: 10, right: 6, left: -18, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gscImpAreaGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--color-series-1)" stopOpacity={0.22} />
                        <stop offset="95%" stopColor="var(--color-series-1)" stopOpacity={0.01} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 4" stroke="var(--color-brand-100)" vertical={false} />
                    <XAxis
                      dataKey="label"
                      minTickGap={gscView === "daily" ? 24 : 8}
                      tick={{ fontSize: 11, fill: "var(--color-brand-500)" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      yAxisId="left"
                      allowDecimals={false}
                      tick={{ fontSize: 11, fill: "var(--color-success-700)" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      allowDecimals={false}
                      tick={{ fontSize: 11, fill: "var(--color-accent-700)" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      cursor={{ fill: "var(--color-brand-100)", fillOpacity: 0.45 }}
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const datum = payload[0]?.payload as ChartDatum | undefined;
                        if (!datum) return null;
                        const clicksVal = datum.a;
                        const impsVal = datum.b;
                        const ctr =
                          clicksVal != null && impsVal != null && impsVal > 0
                            ? `${((clicksVal / impsVal) * 100).toFixed(1)}%`
                            : null;
                        return (
                          <div className="rounded-xl border border-brand-200 bg-surface-1 p-3 shadow-lg">
                            <p className="text-[11px] font-semibold text-brand-500">{datum.fullLabel}</p>
                            <div className="mt-1.5 space-y-1 text-xs">
                              {showClicks && (
                                <div className="flex items-center justify-between gap-4">
                                  <span className="flex items-center gap-1.5 font-medium text-brand-700">
                                    <span className="h-2 w-2 rounded-xs" style={{ backgroundColor: "var(--color-series-3)" }} />
                                    Clicks
                                  </span>
                                  <span className="font-mono font-bold text-brand-950">
                                    {clicksVal !== null ? fmtInt(clicksVal) : "Not recorded"}
                                  </span>
                                </div>
                              )}
                              {showImpressions && (
                                <div className="flex items-center justify-between gap-4">
                                  <span className="flex items-center gap-1.5 font-medium text-brand-700">
                                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: "var(--color-series-1)" }} />
                                    Impressions
                                  </span>
                                  <span className="font-mono font-bold text-brand-950">
                                    {impsVal !== null ? fmtInt(impsVal) : "Not recorded"}
                                  </span>
                                </div>
                              )}
                              {ctr && (
                                <div className="flex items-center justify-between gap-4 border-t border-brand-100 pt-1 text-[11px] text-brand-500">
                                  <span>Click-through rate (CTR)</span>
                                  <span className="font-mono font-semibold text-brand-800">{ctr}</span>
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
                        strokeWidth={2.2}
                        fill="url(#gscImpAreaGrad)"
                        dot={false}
                        activeDot={{ r: 4.5, strokeWidth: 2, stroke: "var(--color-surface-1)" }}
                        connectNulls={false}
                      />
                    )}
                    {showClicks && (
                      <Bar
                        yAxisId="left"
                        dataKey="a"
                        name="Clicks"
                        fill="var(--color-series-3)"
                        fillOpacity={0.85}
                        radius={[4, 4, 0, 0]}
                        maxBarSize={gscView === "daily" ? 12 : 36}
                      />
                    )}
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Plain-English Takeaway Footer */}
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-brand-100 bg-brand-50/50 px-3 py-2 text-[11.5px] text-brand-600">
            <Sparkles size={13} className="mt-0.5 shrink-0 text-accent-600" />
            <span>
              {gscStats ? gscStats.insight : "Connect Google Search Console to track clicks and impressions."}
              {gscStats && gscStats.trailingMissing > 0
                ? ` (GSC typically lags 2–3 days; ${gscStats.trailingMissing} day${gscStats.trailingMissing === 1 ? "" : "s"} pending.)`
                : ""}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
