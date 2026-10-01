import React from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { type Ga4ReportData, type Measure } from "@/lib/api-client";
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
        <p className="mt-1 flex flex-wrap items-baseline gap-x-2 text-[24px] sm:text-[28px] font-bold leading-none tracking-tight text-brand-950">
          {measured.value.toLocaleString()}
          {change != null && (
            <span className={cn("text-[11px] font-bold tracking-normal", change >= 0 ? "text-success-700" : "text-error-700")}>
              {change >= 0 ? "▲" : "▼"} {Math.abs(change)}%
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
 * Daily activity candlesticks: well-proportioned, substantial bars displaying
 * daily performance across the selected window, with baseline marks for zero days
 * and prominent signal candles for active days.
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
  const max = Math.max(...points.map((p) => p.value ?? 0), 1);
  const total = points.reduce((sum, p) => sum + (p.value ?? 0), 0);
  const hasActivity = total > 0;

  return (
    <div
      className="flex w-full min-w-0 flex-col gap-1.5 overflow-hidden"
      role="img"
      aria-label={`${unit} each day, last ${days} days`}
    >
      <div className="flex items-center justify-between text-[10.5px] font-semibold text-brand-400">
        <span className="uppercase tracking-wider">Daily activity</span>
        {hasActivity && (
          <span className="rounded-full bg-brand-200/60 px-2 py-0.5 text-[9.5px] font-bold text-brand-700 truncate max-w-[150px]">
            Peak: {max.toLocaleString()} {unit}
          </span>
        )}
      </div>

      <div className="flex h-[76px] sm:h-[84px] w-full min-w-0 items-end justify-between gap-[2px] sm:gap-[3px] pt-1">
        {points.map((p) => {
          const val = p.value ?? 0;
          const isZero = val === 0;
          const heightPct = isZero ? 0 : Math.max(14, (val / max) * 100);
          const dateLabel = formatCandleDate(p.date);

          return (
            <div
              key={p.date}
              className="group relative flex h-full flex-1 min-w-0 max-w-[14px] flex-col items-center justify-end"
            >
              <div className="pointer-events-none absolute -top-8 z-20 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-brand-950 px-2 py-0.5 text-[10px] font-medium text-brand-50 shadow-md group-hover:block">
                {dateLabel}: {val.toLocaleString()} {unit}
              </div>

              {isZero ? (
                <div
                  className="h-[3px] sm:h-[4px] w-full rounded-full bg-brand-200/80 transition-colors group-hover:bg-brand-300"
                  title={`${dateLabel}: 0 ${unit}`}
                />
              ) : (
                <div
                  className="w-full rounded-t-[2px] sm:rounded-t-[3px] bg-signal-400 opacity-90 shadow-xs transition-all duration-150 origin-bottom group-hover:opacity-100 group-hover:scale-y-[1.03]"
                  style={{ height: `${heightPct}%` }}
                  title={`${dateLabel}: ${val.toLocaleString()} ${unit}`}
                />
              )}
            </div>
          );
        })}
      </div>

      <div className="flex w-full items-center justify-between border-t border-brand-200/50 pt-1 text-[10px] font-medium text-brand-400">
        <span>{days}d ago</span>
        <span>Today</span>
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
            href="/google/analytics"
            aria-label="Open Analytics"
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
                  className={cn("block h-full rounded-full", i === 0 ? "bg-signal-400" : "bg-brand-400")}
                  style={{ width: `${Math.max(pct, pct > 0 ? 1.5 : 0)}%` }}
                />
              </span>
              <span className="w-10 shrink-0 text-right text-[12px] font-semibold text-brand-950">{Math.round(pct)}%</span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
