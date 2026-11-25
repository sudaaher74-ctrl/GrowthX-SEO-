"use client";

import React, { useId, useMemo } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { type Ga4ReportData, type Measure } from "@/lib/api-client";
import {
  CHART_AXIS_TICK,
  CHART_CURSOR_LINE,
  CHART_GRID_PROPS,
  ChartTooltipCard,
} from "@/components/ui/chart-primitives";
import { cn } from "@/lib/utils";
import { Card, CardHead } from "./dashboard-cards";

export const DEFAULT_WINDOW_DAYS = 28;

export function BigMeasure({ label, hint, measure }: { label: string; hint: string; measure: Measure | undefined }) {
  const measured = measure?.state === "MEASURED" ? measure : null;
  const change = measured?.changePct ?? null;

  return (
    <div className="min-w-0">
      <p className="text-[10.5px] font-medium uppercase tracking-wider text-brand-400">{label}</p>
      {measured ? (
        <p className="mt-1 flex flex-wrap items-baseline gap-x-2 font-mono text-[24px] sm:text-[28px] font-bold leading-none tracking-tight text-brand-950 tabular-nums">
          {measured.value.toLocaleString()}
          {change != null && Number.isFinite(change) && (
            <span className={cn("font-sans text-[11px] font-bold tracking-normal", change >= 0 ? "text-success-700" : "text-error-700")}>
              {change >= 0 ? "▲" : "▼"} {Math.round(Math.abs(change) * 10) / 10}%
            </span>
          )}
        </p>
      ) : (
        <p className="mt-1.5 text-[16px] font-semibold text-brand-400">
          {measure?.state === "NOT_CONNECTED" ? "Not connected" : "No data yet"}
        </p>
      )}
      <p className="mt-1 max-w-[240px] text-[11px] leading-snug text-brand-400">{hint}</p>
    </div>
  );
}

function formatCandleDate(isoOrDateStr: string): string {
  try {
    if (/^\d{4}-\d{2}-\d{2}/.test(isoOrDateStr)) {
      const [y, m, d] = isoOrDateStr.slice(0, 10).split("-").map(Number);
      const date = new Date(y, m - 1, d);
      return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    }
    return new Date(isoOrDateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return isoOrDateStr;
  }
}

export function normalizeTrend(rawPoints: { date: string; value: number | null }[], windowDays = DEFAULT_WINDOW_DAYS) {
  if (!rawPoints || rawPoints.length === 0) return [];

  if (rawPoints.length >= windowDays) {
    return rawPoints.slice(-windowDays);
  }

  const lastPoint = rawPoints[rawPoints.length - 1];
  let anchor = new Date();
  if (lastPoint?.date) {
    if (/^\d{4}-\d{2}-\d{2}/.test(lastPoint.date)) {
      const [y, m, d] = lastPoint.date.slice(0, 10).split("-").map(Number);
      anchor = new Date(y, m - 1, d);
    } else {
      const parsed = new Date(lastPoint.date);
      if (!isNaN(parsed.getTime())) anchor = parsed;
    }
  }

  const lookup = new Map<string, number | null>();
  for (const pt of rawPoints) {
    const key = pt.date.slice(0, 10);
    lookup.set(key, pt.value);
  }

  const result: { date: string; value: number | null }[] = [];
  for (let i = windowDays - 1; i >= 0; i--) {
    const d = new Date(anchor);
    d.setDate(d.getDate() - i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const key = `${y}-${m}-${day}`;
    result.push({
      date: key,
      value: lookup.has(key) ? lookup.get(key)! : 0,
    });
  }

  return result;
}

/**
 * Calm minimal area trend matching the executive Monthly Report & Traffic visual system:
 * smooth gradient fill, hairline dashed grid, tabular peak readout, and crisp hover card.
 */
export function DailyCandles({
  points,
  unit = "clicks",
  days = DEFAULT_WINDOW_DAYS,
}: {
  points: { date: string; value: number | null }[];
  unit?: string;
  days?: number;
}) {
  const gradId = useId().replace(/:/g, "");
  const isEmeraldMetric = unit === "clicks" || unit === "goals";
  const strokeColor = isEmeraldMetric ? "var(--color-success-500)" : "var(--color-accent-500)";

  const chartData = useMemo(
    () =>
      points.map((p) => ({
        date: p.date,
        label: formatCandleDate(p.date),
        value: p.value ?? 0,
      })),
    [points],
  );

  const max = Math.max(...chartData.map((p) => p.value), 0);
  const total = chartData.reduce((sum, p) => sum + p.value, 0);
  const hasActivity = total > 0;
  const displayUnit = unit.charAt(0).toUpperCase() + unit.slice(1);

  return (
    <div
      className="flex w-full min-w-0 flex-col gap-1.5"
      role="img"
      aria-label={`${unit} each day, last ${days} days`}
    >
      <div className="flex items-center justify-between text-[10.5px] font-semibold text-brand-400">
        <span className="uppercase tracking-wider">Daily trend · {days}d</span>
        {hasActivity && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-200/80 bg-brand-50 px-2 py-0.5 font-mono text-[10px] font-semibold text-brand-700 tabular-nums truncate max-w-[170px]">
            <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: strokeColor }} />
            Peak {max.toLocaleString()} {unit}
          </span>
        )}
      </div>

      <div className="h-[112px] w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 6, right: 6, left: -24, bottom: 0 }}>
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={strokeColor} stopOpacity={0.2} />
                <stop offset="100%" stopColor={strokeColor} stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid {...CHART_GRID_PROPS} />
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              tick={CHART_AXIS_TICK}
              interval="preserveStartEnd"
              minTickGap={42}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={CHART_AXIS_TICK}
              allowDecimals={false}
              width={44}
            />
            <Tooltip
              cursor={CHART_CURSOR_LINE}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const row = payload[0]?.payload as (typeof chartData)[number] | undefined;
                if (!row) return null;
                return (
                  <ChartTooltipCard
                    title={row.label}
                    rows={[
                      {
                        label: displayUnit,
                        value: row.value.toLocaleString(),
                        color: strokeColor,
                        shape: "dot",
                      },
                    ]}
                  />
                );
              }}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={strokeColor}
              strokeWidth={2}
              fill={`url(#${gradId})`}
              activeDot={{
                r: 4,
                fill: strokeColor,
                stroke: "var(--color-surface-1)",
                strokeWidth: 2,
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/**
 * The busiest channels as share-of-sessions bars: the compact version of the
 * "Where your traffic comes from" table on the Google Analytics page.
 */
export function ChannelShare({ data, days }: { data: Ga4ReportData; days: number }) {
  const total = data.channels.reduce((sum, c) => sum + c.sessions, 0) || data.totals.sessions;
  const top = [...data.channels].sort((a, b) => b.sessions - a.sessions).slice(0, 4);
  return (
    <Card className="flex flex-col gap-3">
      <CardHead
        title="Where your visitors come from"
        subtitle={`Last ${days} days · from Google Analytics`}
        aside={
          <Link
            href="/google"
            aria-label="Open Traffic & Analytics"
            className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-200/60 text-brand-600 transition hover:bg-brand-200 hover:text-brand-950"
          >
            <ArrowUpRight size={13} />
          </Link>
        }
      />
      <ul className="space-y-2.5">
        {top.map((c, i) => {
          const pct = total > 0 ? (c.sessions / total) * 100 : 0;
          return (
            <li key={c.channel} className="flex items-center gap-3">
              <span className="w-[120px] shrink-0 truncate text-[12px] font-semibold text-brand-700">{c.channel}</span>
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-brand-100">
                <span
                  className={cn("block h-full rounded-full transition-all", i === 0 ? "bg-success-500" : "bg-accent-500")}
                  style={{ width: `${Math.max(pct, pct > 0 ? 1.5 : 0)}%` }}
                />
              </span>
              <span className="w-12 shrink-0 text-right font-mono text-[12px] font-semibold text-brand-950 tabular-nums">
                {Math.round(pct)}%
              </span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
