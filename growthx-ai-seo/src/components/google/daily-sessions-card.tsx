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
import { Activity, CheckCircle2, TrendingUp, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Ga4ReportData } from "@/lib/api-types";
import { count, parseDateSafe, percent, shortDay } from "@/lib/google-format";

export interface DailySessionsCardProps {
  data: Ga4ReportData;
}

export function DailySessionsCard({ data }: { data: Ga4ReportData }) {
  const [activeSeries, setActiveSeries] = useState<"both" | "sessions" | "users">("both");

  const totals = data.totals;
  const totalSessions = totals.sessions || 0;
  const engagedSessions = totals.engagedSessions || 0;
  const engagementRate = totals.engagementRate || 0;

  const daily = useMemo(() => data.daily || [], [data.daily]);
  const hasChartData = daily.length >= 2;

  const peakSessions = useMemo(() => {
    if (daily.length === 0) return 0;
    return Math.max(...daily.map((d) => d.sessions || 0));
  }, [daily]);

  const avgDailySessions = useMemo(() => {
    if (daily.length === 0) return "0";
    return (totalSessions / daily.length).toFixed(1);
  }, [daily, totalSessions]);

  return (
    <div className="rounded-2xl border border-brand-200/50 bg-brand-50/50 p-4 shadow-card backdrop-blur-md flex flex-col justify-between">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-brand-200/30 pb-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-brand-950">Daily Sessions</h3>
            <span className="flex items-center gap-1 text-[11px] font-semibold text-signal-ink bg-signal-400/20 px-2 py-0.5 rounded-full border border-signal-400/30">
              <CheckCircle2 size={11} className="text-signal-ink" />
              <span>GA4 Verified</span>
            </span>
          </div>
          <p className="text-[11.5px] text-brand-400">
            All channels, by day. Analytics figures end yesterday (today's intraday traffic finalizes at midnight).
          </p>
        </div>

        {/* Filter buttons */}
        <div className="flex items-center gap-2">
          <div
            role="group"
            aria-label="Filter session series"
            className="inline-flex items-center gap-1 rounded-full bg-brand-100 p-0.5 text-[11px]"
          >
            <button
              type="button"
              onClick={() => setActiveSeries(activeSeries === "sessions" ? "both" : "sessions")}
              className={cn(
                "rounded-full px-2.5 py-1 font-semibold transition-colors flex items-center gap-1.5",
                activeSeries === "sessions" || activeSeries === "both"
                  ? "bg-signal-400 text-signal-ink font-bold shadow-xs"
                  : "text-brand-400 hover:text-brand-950",
              )}
            >
              <span className="h-2 w-2 rounded-full bg-signal-ink" />
              <span>Sessions</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveSeries(activeSeries === "users" ? "both" : "users")}
              className={cn(
                "rounded-full px-2.5 py-1 font-semibold transition-colors flex items-center gap-1.5",
                activeSeries === "users" || activeSeries === "both"
                  ? "bg-accent-500 text-white font-bold shadow-xs"
                  : "text-brand-400 hover:text-brand-950",
              )}
            >
              <span className="h-2 w-2 rounded-full bg-white" />
              <span>Users</span>
            </button>
          </div>
        </div>
      </div>

      {/* Line Chart */}
      <div className="my-4 h-64 w-full">
        {hasChartData ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={daily} margin={{ top: 10, right: 14, left: -16, bottom: 0 }}>
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
                  const item = payload[0].payload as { date: string; sessions: number; users: number };
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
                          <span className="flex items-center gap-1.5 text-signal-ink font-medium">
                            <span className="h-2 w-2 rounded-full bg-signal-400" />
                            Sessions:
                          </span>
                          <span className="font-mono font-bold text-brand-950">{count(item.sessions)}</span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span className="flex items-center gap-1.5 text-accent-600 font-medium">
                            <span className="h-2 w-2 rounded-full bg-accent-500" />
                            Active users:
                          </span>
                          <span className="font-mono font-bold text-brand-950">{count(item.users)}</span>
                        </div>
                      </div>
                    </div>
                  );
                }}
              />
              {(activeSeries === "sessions" || activeSeries === "both") && (
                <Line
                  type="monotone"
                  dataKey="sessions"
                  name="Sessions"
                  stroke="var(--color-signal-400)"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: "var(--color-signal-400)", strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: "var(--color-signal-400)", stroke: "var(--color-brand-50)", strokeWidth: 2 }}
                />
              )}
              {(activeSeries === "users" || activeSeries === "both") && (
                <Line
                  type="monotone"
                  dataKey="users"
                  name="Users"
                  stroke="var(--color-accent-500)"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: "var(--color-accent-500)", strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: "var(--color-accent-500)", stroke: "var(--color-brand-50)", strokeWidth: 2 }}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center text-[12px] text-brand-400">
            Not enough daily data points to chart sessions.
          </div>
        )}
      </div>

      {/* Legend & Stats Footer */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 border-t border-brand-200/30 pt-3">
        {/* Total Sessions */}
        <div className="flex items-center gap-3 rounded-xl border border-brand-200/40 bg-brand-100/40 p-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-signal-400/20 text-signal-ink">
            <Activity size={16} />
          </span>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-brand-950">{count(totalSessions)}</span>
              <span className="text-[10px] font-semibold text-brand-950 bg-signal-400/30 px-1 rounded">
                ~{avgDailySessions}/day
              </span>
            </div>
            <p className="text-[11px] text-brand-400">Total sessions</p>
          </div>
        </div>

        {/* Engaged Sessions */}
        <div className="flex items-center gap-3 rounded-xl border border-brand-200/40 bg-brand-100/40 p-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-success-500/10 text-success-600">
            <Zap size={16} />
          </span>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-brand-950">{count(engagedSessions)}</span>
              <span className="text-[10px] font-semibold text-success-600 bg-success-50 px-1 rounded">
                {percent(engagementRate)}
              </span>
            </div>
            <p className="text-[11px] text-brand-400">Engaged visits</p>
          </div>
        </div>

        {/* Peak Volume */}
        <div className="flex items-center gap-3 rounded-xl border border-brand-200/40 bg-brand-100/40 p-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-500/10 text-accent-600">
            <TrendingUp size={16} />
          </span>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-brand-950">{count(peakSessions)}</span>
              <span className="text-[10px] font-semibold text-brand-400">Peak</span>
            </div>
            <p className="text-[11px] text-brand-400">Single-day high</p>
          </div>
        </div>
      </div>
    </div>
  );
}
