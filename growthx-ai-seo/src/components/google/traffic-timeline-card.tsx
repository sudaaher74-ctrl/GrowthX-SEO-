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
import { CheckCircle2, Eye, MousePointerClick, Sparkles, Users, Wrench } from "lucide-react";
import {
  CHART_AXIS_TICK,
  CHART_CURSOR_LINE,
  CHART_GRID_PROPS,
  ChartTooltipCard,
} from "@/components/ui/chart-primitives";
import type { ChangeLedger } from "@/lib/search-intelligence";
import { count, shortDay } from "@/lib/google-format";
import { cn } from "@/lib/utils";

export interface TimelinePoint {
  date: string;
  visitors: number | null;
  newUsers: number | null;
  returningUsers: number | null;
  searchClicks: number | null;
  impressions: number | null;
}

interface TrafficTimelineCardProps {
  data: TimelinePoint[];
  changes: ChangeLedger["changes"];
  periodDays: number;
}

type TimelineMode = "combined" | "audience" | "visibility";

export function TrafficTimelineCard({ data, changes, periodDays }: TrafficTimelineCardProps) {
  const [mode, setMode] = useState<TimelineMode>("combined");
  const [selectedFixId, setSelectedFixId] = useState<string | null>(null);

  // Filter shipped fixes whose date falls inside the plotted window
  const windowFixes = useMemo(() => {
    if (data.length === 0 || changes.length === 0) return [];
    const firstDate = data[0].date;
    const lastDate = data[data.length - 1].date;
    const dateSet = new Set(data.map((d) => d.date));

    return changes
      .map((ch) => {
        const raw = (ch.liveSince ?? ch.recordedAt ?? "").slice(0, 10);
        return { ...ch, chartDate: raw };
      })
      .filter((ch) => ch.chartDate && ch.chartDate >= firstDate && ch.chartDate <= lastDate && dateSet.has(ch.chartDate))
      .slice(0, 6);
  }, [data, changes]);

  const hasNewReturning = useMemo(
    () => data.some((d) => (d.newUsers ?? 0) > 0 || (d.returningUsers ?? 0) > 0),
    [data],
  );

  const hasImpressions = useMemo(
    () => data.some((d) => (d.impressions ?? 0) > 0),
    [data],
  );

  const selectedFix = windowFixes.find((f) => f.id === selectedFixId) ?? null;

  return (
    <div className="rounded-2xl border border-brand-200 bg-surface-1 p-5 shadow-card">
      <div className="flex flex-col gap-3 border-b border-brand-100 pb-3.5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-bold text-brand-950">Traffic &amp; Proof-of-Impact Timeline</h2>
            {windowFixes.length > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-success-50 px-2 py-0.5 text-[10px] font-bold text-success-700">
                <Wrench className="h-2.5 w-2.5" />
                {windowFixes.length} shipped {windowFixes.length === 1 ? "fix" : "fixes"} annotated
              </span>
            )}
          </div>
          <p className="mt-0.5 text-[11px] text-brand-400">
            Last {periodDays} days · GA4 audience velocity overlaid with Search Console demand &amp; shipped optimizations
          </p>
        </div>

        {/* Mode Switcher */}
        <div
          role="tablist"
          aria-label="Timeline chart view"
          className="inline-flex w-fit rounded-xl border border-brand-200/80 bg-brand-100/50 p-0.5 text-[11px] font-semibold"
        >
          {(
            [
              { id: "combined", label: "Visitors & Clicks", icon: MousePointerClick, disabled: false },
              { id: "audience", label: "New vs Returning", icon: Users, disabled: !hasNewReturning },
              { id: "visibility", label: "Impressions", icon: Eye, disabled: !hasImpressions },
            ] as const
          ).map((tab) => {
            const Icon = tab.icon;
            const active = mode === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                disabled={tab.disabled}
                onClick={() => setMode(tab.id)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed",
                  active
                    ? "bg-signal-400 text-signal-ink font-bold shadow-xs"
                    : "text-brand-500 hover:text-brand-950",
                )}
              >
                <Icon className="h-3 w-3" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] font-medium">
        <div className="flex flex-wrap items-center gap-4">
          {mode === "combined" && (
            <>
              <span className="inline-flex items-center gap-1.5 text-brand-600">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: "var(--color-series-3)" }} />
                Visitors (GA4)
              </span>
              <span className="inline-flex items-center gap-1.5 text-brand-600">
                <span className="h-0.5 w-3 rounded-full" style={{ backgroundColor: "var(--color-series-1)" }} />
                Search clicks (GSC)
              </span>
            </>
          )}
          {mode === "audience" && (
            <>
              <span className="inline-flex items-center gap-1.5 text-brand-600">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: "var(--color-series-1)" }} />
                New visitors
              </span>
              <span className="inline-flex items-center gap-1.5 text-brand-600">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: "var(--color-series-6)" }} />
                Returning visitors
              </span>
            </>
          )}
          {mode === "visibility" && (
            <>
              <span className="inline-flex items-center gap-1.5 text-brand-600">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: "var(--color-series-2)" }} />
                Search impressions
              </span>
              <span className="inline-flex items-center gap-1.5 text-brand-600">
                <span className="h-0.5 w-3 rounded-full" style={{ backgroundColor: "var(--color-series-1)" }} />
                Search clicks
              </span>
            </>
          )}
          {windowFixes.length > 0 && (
            <span className="inline-flex items-center gap-1.5 text-brand-500">
              <span className="h-3 w-0.5 border-l border-dashed border-success-600" />
              Shipped SEO change
            </span>
          )}
        </div>
        <span className="text-[10.5px] text-brand-400">GSC typically lags ~2–3 days</span>
      </div>

      {/* Chart Area */}
      <div className="mt-3 h-64 w-full">
        {data.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-brand-500">
            No saved daily measurements are available for this period yet.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 10, right: 10, left: -14, bottom: 0 }}>
              <defs>
                <linearGradient id="tlVisitorsFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-series-3)" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="var(--color-series-3)" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="tlImpressionsFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-series-2)" stopOpacity={0.22} />
                  <stop offset="100%" stopColor="var(--color-series-2)" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid {...CHART_GRID_PROPS} />
              <XAxis
                dataKey="date"
                tickFormatter={shortDay}
                minTickGap={26}
                tick={CHART_AXIS_TICK}
                axisLine={false}
                tickLine={false}
                dy={6}
              />
              <YAxis
                yAxisId="left"
                allowDecimals={false}
                tickCount={4}
                tick={CHART_AXIS_TICK}
                axisLine={false}
                tickLine={false}
                width={42}
              />
              {mode === "visibility" && (
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  allowDecimals={false}
                  tickCount={4}
                  tick={CHART_AXIS_TICK}
                  axisLine={false}
                  tickLine={false}
                  width={36}
                />
              )}
              <Tooltip
                cursor={CHART_CURSOR_LINE}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0]?.payload as TimelinePoint | undefined;
                  if (!d) return null;
                  const dayFixes = windowFixes.filter((f) => f.chartDate === d.date);
                  const rows =
                    mode === "audience"
                      ? [
                          {
                            label: "New visitors",
                            value: d.newUsers !== null ? count(d.newUsers) : "—",
                            color: "var(--color-series-1)",
                          },
                          {
                            label: "Returning",
                            value: d.returningUsers !== null ? count(d.returningUsers) : "—",
                            color: "var(--color-series-6)",
                          },
                        ]
                      : mode === "visibility"
                        ? [
                            {
                              label: "Impressions",
                              value: d.impressions !== null ? count(d.impressions) : "—",
                              color: "var(--color-series-2)",
                            },
                            {
                              label: "Search clicks",
                              value: d.searchClicks !== null ? count(d.searchClicks) : "—",
                              color: "var(--color-series-1)",
                              shape: "dash" as const,
                            },
                          ]
                        : [
                            {
                              label: "Visitors",
                              value: d.visitors !== null ? count(d.visitors) : "—",
                              color: "var(--color-series-3)",
                            },
                            {
                              label: "Search clicks",
                              value: d.searchClicks !== null ? count(d.searchClicks) : "—",
                              color: "var(--color-series-1)",
                              shape: "dash" as const,
                            },
                          ];

                  return (
                    <ChartTooltipCard
                      title={shortDay(d.date)}
                      rows={rows}
                      footer={
                        dayFixes.length > 0
                          ? { label: "Shipped fix", value: dayFixes[0].what.slice(0, 34) }
                          : undefined
                      }
                    />
                  );
                }}
              />

              {/* Shipped SEO fix reference annotations */}
              {windowFixes.map((fix) => (
                <ReferenceLine
                  key={fix.id}
                  yAxisId="left"
                  x={fix.chartDate}
                  stroke={selectedFixId === fix.id ? "var(--color-primary-600)" : "var(--color-success-500)"}
                  strokeDasharray="3 3"
                  strokeWidth={selectedFixId === fix.id ? 2 : 1.3}
                />
              ))}

              {mode === "combined" && (
                <>
                  <Area
                    yAxisId="left"
                    type="monotone"
                    dataKey="visitors"
                    stroke="var(--color-series-3)"
                    strokeWidth={2}
                    fill="url(#tlVisitorsFill)"
                    dot={false}
                    activeDot={{ r: 4, fill: "var(--color-series-3)", strokeWidth: 2, stroke: "var(--color-surface-1)" }}
                    connectNulls={false}
                  />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="searchClicks"
                    stroke="var(--color-series-1)"
                    strokeWidth={1.9}
                    dot={false}
                    activeDot={{ r: 3.5, fill: "var(--color-series-1)", strokeWidth: 2, stroke: "var(--color-surface-1)" }}
                    connectNulls={false}
                  />
                </>
              )}

              {mode === "audience" && (
                <>
                  <Bar
                    yAxisId="left"
                    dataKey="newUsers"
                    stackId="aud"
                    fill="var(--color-series-1)"
                    radius={[0, 0, 2, 2]}
                    maxBarSize={18}
                  />
                  <Bar
                    yAxisId="left"
                    dataKey="returningUsers"
                    stackId="aud"
                    fill="var(--color-series-6)"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={18}
                  />
                </>
              )}

              {mode === "visibility" && (
                <>
                  <Area
                    yAxisId="left"
                    type="monotone"
                    dataKey="impressions"
                    stroke="var(--color-series-2)"
                    strokeWidth={2}
                    fill="url(#tlImpressionsFill)"
                    dot={false}
                    connectNulls={false}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="searchClicks"
                    stroke="var(--color-series-1)"
                    strokeWidth={1.9}
                    dot={false}
                    connectNulls={false}
                  />
                </>
              )}
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Interactive Shipped Fixes Strip */}
      {windowFixes.length > 0 && (
        <div className="mt-4 border-t border-brand-100 pt-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {windowFixes.map((fix) => {
              const active = selectedFixId === fix.id;
              return (
                <button
                  key={fix.id}
                  type="button"
                  onClick={() => setSelectedFixId(active ? null : fix.id)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition cursor-pointer",
                    active
                      ? "border-primary-500 bg-primary-50 text-primary-700"
                      : "border-brand-200/80 bg-brand-50/70 text-brand-700 hover:bg-brand-100",
                  )}
                >
                  <CheckCircle2 className="h-3 w-3 text-success-600" />
                  <span className="font-mono text-[10px] text-brand-400">{shortDay(fix.chartDate)}</span>
                  <span className="max-w-[180px] truncate">{fix.what}</span>
                </button>
              );
            })}
          </div>

          {selectedFix && (
            <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-brand-200/70 bg-brand-50/70 px-3.5 py-2 text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary-600" />
                <span className="font-semibold text-brand-950 truncate">{selectedFix.what}</span>
                <span className="font-mono text-[11px] text-brand-400 truncate max-w-[220px]">
                  {selectedFix.url}
                </span>
              </div>
              {selectedFix.impact.verdictText && (
                <span className="rounded-full bg-success-50 px-2.5 py-0.5 text-[10.5px] font-bold text-success-700">
                  {selectedFix.impact.verdictText}
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
