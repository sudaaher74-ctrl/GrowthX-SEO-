"use client";

import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CheckCircle2, UserCheck, UserPlus, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Ga4ReportData } from "@/lib/api-types";
import { count, parseDateSafe, percent, shortDay } from "@/lib/google-format";

export interface NewVsReturningCardProps {
  data: Ga4ReportData;
}

export function NewVsReturningCard({ data }: { data: Ga4ReportData }) {
  const [activeSeries, setActiveSeries] = useState<"both" | "new" | "returning">("both");

  const totals = data.totals;
  const totalActive = totals.activeUsers || 0;
  const newCount = totals.newUsers || 0;
  const returningCount = Math.max(0, totalActive - newCount);
  const newRatio = totalActive > 0 ? newCount / totalActive : 0;
  const returningRatio = totalActive > 0 ? returningCount / totalActive : 0;

  const chartData = useMemo(() => {
    return (data.daily || []).map((d) => {
      let n = d.newUsers;
      let r = d.returningUsers;
      if (n === undefined || r === undefined) {
        n = Math.min(d.users, Math.round(d.users * newRatio));
        r = Math.max(0, d.users - n);
      }
      return {
        date: d.date,
        users: d.users,
        new: n,
        returning: r,
      };
    });
  }, [data.daily, newRatio]);

  const hasChartData = chartData.length >= 2;

  return (
    <div className="rounded-2xl border border-brand-200/50 bg-brand-50/50 p-4 shadow-card backdrop-blur-md flex flex-col justify-between">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-brand-200/30 pb-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-brand-950">New vs. Returning users</h3>
            <span className="flex items-center gap-1 text-[11px] font-semibold text-success-600 bg-success-500/10 px-2 py-0.5 rounded-full border border-success-500/20">
              <CheckCircle2 size={11} className="text-success-500" />
              <span>GA4 Verified</span>
            </span>
          </div>
          <p className="text-[11.5px] text-brand-400">
            Active user trend comparing first-time visitors against returning visitors over time.
          </p>
        </div>

        {/* Filter buttons */}
        <div className="flex items-center gap-2">
          <div
            role="group"
            aria-label="Filter user series"
            className="inline-flex items-center gap-1 rounded-full bg-brand-100 p-0.5 text-[11px]"
          >
            <button
              type="button"
              onClick={() => setActiveSeries(activeSeries === "new" ? "both" : "new")}
              className={cn(
                "rounded-full px-2.5 py-1 font-semibold transition-colors flex items-center gap-1.5",
                activeSeries === "new" || activeSeries === "both"
                  ? "bg-accent-500 text-white font-bold shadow-xs"
                  : "text-brand-400 hover:text-brand-950",
              )}
            >
              <span className="h-2 w-2 rounded-full bg-white" />
              <span>New users</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveSeries(activeSeries === "returning" ? "both" : "returning")}
              className={cn(
                "rounded-full px-2.5 py-1 font-semibold transition-colors flex items-center gap-1.5",
                activeSeries === "returning" || activeSeries === "both"
                  ? "bg-signal-400 text-signal-ink font-bold shadow-xs"
                  : "text-brand-400 hover:text-brand-950",
              )}
            >
              <span className="h-2 w-2 rounded-full bg-signal-ink" />
              <span>Returning</span>
            </button>
          </div>
        </div>
      </div>

      {/* Line Chart */}
      <div className="my-4 h-64 w-full">
        {hasChartData ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 14, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-brand-200/30" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={shortDay}
                tickLine={false}
                axisLine={false}
                tick={{ fill: "currentColor", fontSize: 10 }}
                className="text-brand-400 font-mono"
                minTickGap={20}
                dy={6}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fill: "currentColor", fontSize: 10 }}
                className="text-brand-400 font-mono"
                tickFormatter={(v) => count(Number(v))}
                width={44}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const item = payload[0].payload as { date: string; new: number; returning: number; users: number };
                  return (
                    <div className="rounded-xl border border-brand-200/80 bg-brand-50 p-2.5 shadow-xl text-[11px] backdrop-blur-md">
                      <p className="font-semibold text-brand-950 pb-1 border-b border-brand-200/40">
                        {(parseDateSafe(item.date) ?? new Date()).toLocaleDateString(undefined, {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                        })}
                      </p>
                      <div className="space-y-1 pt-1.5">
                        <div className="flex items-center justify-between gap-4">
                          <span className="flex items-center gap-1.5 text-accent-600 font-medium">
                            <span className="h-2 w-2 rounded-full bg-accent-500" />
                            New users:
                          </span>
                          <span className="font-mono font-bold text-brand-950">{count(item.new)}</span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span className="flex items-center gap-1.5 text-signal-500 font-medium">
                            <span className="h-2 w-2 rounded-full bg-signal-400" />
                            Returning:
                          </span>
                          <span className="font-mono font-bold text-brand-950">{count(item.returning)}</span>
                        </div>
                        <div className="flex items-center justify-between gap-4 pt-1 border-t border-brand-200/40">
                          <span className="text-brand-400">Total active:</span>
                          <span className="font-mono font-bold text-brand-950">{count(item.users)}</span>
                        </div>
                      </div>
                    </div>
                  );
                }}
              />
              {(activeSeries === "new" || activeSeries === "both") && (
                <Line
                  type="monotone"
                  dataKey="new"
                  name="New users"
                  stroke="var(--color-accent-500)"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: "var(--color-accent-500)", strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: "var(--color-accent-500)", stroke: "var(--color-brand-50)", strokeWidth: 2 }}
                />
              )}
              {(activeSeries === "returning" || activeSeries === "both") && (
                <Line
                  type="monotone"
                  dataKey="returning"
                  name="Returning users"
                  stroke="var(--color-signal-400)"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: "var(--color-signal-400)", strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: "var(--color-signal-400)", stroke: "var(--color-brand-50)", strokeWidth: 2 }}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center text-[12px] text-brand-400">
            Not enough daily data points to chart new vs. returning users.
          </div>
        )}
      </div>

      {/* Legend & Stats Footer */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 border-t border-brand-200/30 pt-3">
        {/* New Users */}
        <div className="flex items-center gap-3 rounded-xl border border-brand-200/40 bg-brand-100/40 p-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-500/10 text-accent-600">
            <UserPlus size={16} />
          </span>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-brand-950">{count(newCount)}</span>
              <span className="text-[10px] font-semibold text-accent-600 bg-accent-50 px-1 rounded">
                {percent(newRatio)}
              </span>
            </div>
            <p className="text-[11px] text-brand-400">New visitors</p>
          </div>
        </div>

        {/* Returning Users */}
        <div className="flex items-center gap-3 rounded-xl border border-brand-200/40 bg-brand-100/40 p-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-signal-400/20 text-signal-ink">
            <UserCheck size={16} />
          </span>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-brand-950">{count(returningCount)}</span>
              <span className="text-[10px] font-semibold text-brand-950 bg-signal-400/30 px-1 rounded">
                {percent(returningRatio)}
              </span>
            </div>
            <p className="text-[11px] text-brand-400">Returning visitors</p>
          </div>
        </div>

        {/* Retention / Total */}
        <div className="flex items-center gap-3 rounded-xl border border-brand-200/40 bg-brand-100/40 p-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-200/60 text-brand-950">
            <Users size={16} />
          </span>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-brand-950">{count(totalActive)}</span>
              <span className="text-[10px] font-semibold text-brand-400">Total active</span>
            </div>
            <p className="text-[11px] text-brand-400">All unique visitors</p>
          </div>
        </div>
      </div>
    </div>
  );
}
