"use client";

import React, { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AlertCircle, Building2, Cpu, Zap } from "lucide-react";
import { MeterBar, Panel, Pill, Td, Th, Tr, relativeTime } from "@/components/ui/console";
import { AiConfigurationTab } from "@/components/settings/ai-configuration-tab";
import type {
  AdminAiAnalytics,
  AdminUserModelUsage,
  ApiCostStat,
} from "@/lib/api-types";
import {
  AdminSearchInput,
  AdminSkeletonCard,
  AdminTableWrap,
  AdminThead,
  FilterChipGroup,
  formatCompactNumber,
  formatUsd,
} from "./admin-primitives";

interface AiFinopsSectionProps {
  apiCosts: ApiCostStat[];
  analytics: AdminAiAnalytics | null;
  userModels: AdminUserModelUsage[];
  windowDays: number;
  onChangeWindowDays: (days: number) => void;
  loading: boolean;
}

type ChartMetric = "costUsd" | "calls" | "tokens";

export function AiFinopsSection({
  apiCosts,
  analytics,
  userModels,
  windowDays,
  onChangeWindowDays,
  loading,
}: AiFinopsSectionProps) {
  const [chartMetric, setChartMetric] = useState<ChartMetric>("costUsd");
  const [orgSearch, setOrgSearch] = useState("");
  const [modelSearch, setModelSearch] = useState("");

  const filteredOrgs = useMemo(() => {
    const q = orgSearch.trim().toLowerCase();
    const list = analytics?.byOrganization ?? [];
    if (!q) return list;
    return list.filter((o) => o.organizationName.toLowerCase().includes(q));
  }, [analytics, orgSearch]);

  const filteredUserModels = useMemo(() => {
    const q = modelSearch.trim().toLowerCase();
    if (!q) return userModels;
    return userModels.filter(
      (m) =>
        m.userName.toLowerCase().includes(q) ||
        m.userEmail.toLowerCase().includes(q) ||
        m.organizationName.toLowerCase().includes(q) ||
        m.model.toLowerCase().includes(q) ||
        m.provider.toLowerCase().includes(q),
    );
  }, [userModels, modelSearch]);

  const trendData = analytics?.dailyTrend ?? [];
  const totalWindowSpend = trendData.reduce((s, d) => s + d.costUsd, 0);
  const totalWindowCalls = trendData.reduce((s, d) => s + d.calls, 0);
  const totalWindowErrors = trendData.reduce((s, d) => s + d.errors, 0);

  return (
    <div className="space-y-5">
      {/* Daily AI Spend & Volume Trend */}
      <Panel
        title="AI Spend & Request Velocity"
        subtitle={`Last ${windowDays} days · ${formatUsd(totalWindowSpend)} spend · ${totalWindowCalls.toLocaleString()} calls · ${totalWindowErrors} errors`}
        padded
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <FilterChipGroup<ChartMetric>
              value={chartMetric}
              onChange={setChartMetric}
              options={[
                { id: "costUsd", label: "Spend ($)" },
                { id: "calls", label: "Requests" },
                { id: "tokens", label: "Tokens" },
              ]}
            />
            <FilterChipGroup<string>
              value={String(windowDays)}
              onChange={(v) => onChangeWindowDays(Number(v))}
              options={[
                { id: "7", label: "7d" },
                { id: "14", label: "14d" },
                { id: "30", label: "30d" },
              ]}
            />
          </div>
        }
      >
        {loading && !analytics ? (
          <AdminSkeletonCard className="h-56 border-0 bg-surface-2/40" />
        ) : trendData.length === 0 || totalWindowCalls === 0 ? (
          <div className="py-12 text-center text-[12.5px] text-brand-500">
            No routed AI usage recorded in the last {windowDays} days.
          </div>
        ) : (
          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="adminAiFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-signal-400)" stopOpacity={0.32} />
                    <stop offset="95%" stopColor="var(--color-signal-400)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line)" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={(v: string) => v.slice(5)}
                  tick={{ fontSize: 11, fill: "var(--color-brand-400)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={(v: number) =>
                    chartMetric === "costUsd"
                      ? `$${v.toFixed(2)}`
                      : formatCompactNumber(v)
                  }
                  tick={{ fontSize: 11, fill: "var(--color-brand-400)" }}
                  axisLine={false}
                  tickLine={false}
                  width={56}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--color-surface-1)",
                    borderColor: "var(--color-line)",
                    borderRadius: "12px",
                    fontSize: "12px",
                    color: "var(--color-brand-950)",
                  }}
                  formatter={(value: unknown) => {
                    const num = typeof value === "number" ? value : Number(value ?? 0);
                    if (chartMetric === "costUsd") return [formatUsd(num, 4), "Est. Spend"];
                    if (chartMetric === "tokens") return [num.toLocaleString(), "Tokens"];
                    return [num.toLocaleString(), "Requests"];
                  }}
                />
                <Area
                  type="monotone"
                  dataKey={chartMetric}
                  stroke="var(--color-signal-400)"
                  strokeWidth={2}
                  fill="url(#adminAiFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </Panel>

      {/* Provider/Model Spend + Task Latency Breakdown */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Panel
          title="Provider & Model Ledger"
          subtitle="All-time tokens, requests, error counts, and estimated spend per routed model."
        >
          <AdminTableWrap label="Provider and model spend" minWidth={520} maxHeightClass="max-h-[380px]">
            <AdminThead>
              <tr>
                <Th>Provider / Model</Th>
                <Th align="right">Calls</Th>
                <Th align="right">Tokens</Th>
                <Th align="right">Avg Latency</Th>
                <Th align="right">Spend</Th>
              </tr>
            </AdminThead>
            <tbody>
              {apiCosts.length > 0 ? (
                apiCosts.map((c) => (
                  <Tr key={c.service}>
                    <Td>
                      <div className="flex items-center gap-2">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-warning-50 text-warning-600">
                          <Zap size={12} />
                        </span>
                        <span className="font-mono text-[12px] font-semibold text-brand-950">
                          {c.service}
                        </span>
                      </div>
                    </Td>
                    <Td align="right">
                      <span className="font-mono text-[12px] text-brand-700 tabular-nums">
                        {(c.calls ?? 0).toLocaleString()}
                      </span>
                      {(c.errors ?? 0) > 0 && (
                        <span className="ml-1 font-mono text-[10.5px] text-error-600">
                          ({c.errors} err)
                        </span>
                      )}
                    </Td>
                    <Td align="right">
                      <span className="font-mono text-[12px] text-brand-500 tabular-nums">{c.tokens}</span>
                    </Td>
                    <Td align="right">
                      <span className="font-mono text-[12px] text-brand-500 tabular-nums">
                        {c.avgLatencyMs != null ? `${c.avgLatencyMs}ms` : "—"}
                      </span>
                    </Td>
                    <Td align="right">
                      <span className="font-mono text-[12.5px] font-bold text-success-600 tabular-nums">
                        {formatUsd(c.cost, 4)}
                      </span>
                    </Td>
                  </Tr>
                ))
              ) : (
                <Tr>
                  <Td colSpan={5} className="py-10 text-center text-[12px] text-brand-500">
                    No billable AI calls recorded yet.
                  </Td>
                </Tr>
              )}
            </tbody>
          </AdminTableWrap>
        </Panel>

        <Panel
          title="Breakdown by AI Task"
          subtitle={`Last ${windowDays} days performance, latency, and error rates by semantic router task.`}
        >
          <AdminTableWrap label="AI usage by task" minWidth={520} maxHeightClass="max-h-[380px]">
            <AdminThead>
              <tr>
                <Th>Task Type</Th>
                <Th align="right">Calls</Th>
                <Th align="right">Err Rate</Th>
                <Th align="right">Avg Latency</Th>
                <Th align="right">Spend</Th>
              </tr>
            </AdminThead>
            <tbody>
              {analytics && analytics.byTask.length > 0 ? (
                analytics.byTask.map((t) => (
                  <Tr key={t.taskType}>
                    <Td>
                      <div className="flex items-center gap-2">
                        <Cpu size={13} className="text-brand-400 shrink-0" />
                        <span className="font-mono text-[11.5px] font-semibold text-brand-950">
                          {t.taskType}
                        </span>
                      </div>
                    </Td>
                    <Td align="right">
                      <span className="font-mono text-[12px] text-brand-700 tabular-nums">
                        {t.calls.toLocaleString()}
                      </span>
                    </Td>
                    <Td align="right">
                      <Pill tone={t.errorRatePct >= 15 ? "bad" : t.errorRatePct > 0 ? "warn" : "good"}>
                        {t.errorRatePct}%
                      </Pill>
                    </Td>
                    <Td align="right">
                      <span className="font-mono text-[12px] text-brand-500 tabular-nums">
                        {t.avgLatencyMs}ms
                      </span>
                    </Td>
                    <Td align="right">
                      <span className="font-mono text-[12.5px] font-semibold text-brand-950 tabular-nums">
                        {formatUsd(t.costUsd, 4)}
                      </span>
                    </Td>
                  </Tr>
                ))
              ) : (
                <Tr>
                  <Td colSpan={5} className="py-10 text-center text-[12px] text-brand-500">
                    No task-level AI records in this window.
                  </Td>
                </Tr>
              )}
            </tbody>
          </AdminTableWrap>
        </Panel>
      </div>

      {/* Accurate Organization Spend Attribution */}
      <Panel
        title="Organization AI Spend & Budget Utilization"
        subtitle={`True per-organization spend over the last ${windowDays} days (no multi-member double counting).`}
        actions={
          <AdminSearchInput
            value={orgSearch}
            onChange={setOrgSearch}
            placeholder="Filter organizations…"
          />
        }
      >
        <AdminTableWrap label="Organization AI spend" minWidth={720} maxHeightClass="max-h-[380px]">
          <AdminThead>
            <tr>
              <Th>Organization</Th>
              <Th align="right">Calls</Th>
              <Th align="right">Errors</Th>
              <Th align="right">Tokens</Th>
              <Th align="right">Window Spend</Th>
              <Th>Monthly Cap</Th>
              <Th align="right">Last Active</Th>
            </tr>
          </AdminThead>
          <tbody>
            {filteredOrgs.length > 0 ? (
              filteredOrgs.map((o) => {
                const pct =
                  o.budgetUsd && o.budgetUsd > 0 ? Math.min(100, Math.round((o.costUsd / o.budgetUsd) * 100)) : null;
                return (
                  <Tr key={o.organizationId}>
                    <Td>
                      <div className="flex items-center gap-2">
                        <Building2 size={13} className="text-brand-400 shrink-0" />
                        <span className="text-[12.5px] font-semibold text-brand-950">
                          {o.organizationName}
                        </span>
                      </div>
                    </Td>
                    <Td align="right">
                      <span className="font-mono text-[12px] text-brand-700 tabular-nums">
                        {o.calls.toLocaleString()}
                      </span>
                    </Td>
                    <Td align="right">
                      <span
                        className={`font-mono text-[12px] tabular-nums ${o.errors > 0 ? "font-semibold text-error-600" : "text-brand-400"}`}
                      >
                        {o.errors}
                      </span>
                    </Td>
                    <Td align="right">
                      <span className="font-mono text-[12px] text-brand-600 tabular-nums">
                        {formatCompactNumber(o.tokens)}
                      </span>
                    </Td>
                    <Td align="right">
                      <span className="font-mono text-[12.5px] font-bold text-success-600 tabular-nums">
                        {formatUsd(o.costUsd, 4)}
                      </span>
                    </Td>
                    <Td>
                      {o.budgetUsd != null ? (
                        <div className="space-y-1 min-w-[110px]">
                          <span className="font-mono text-[11px] text-brand-600">
                            {formatUsd(o.budgetUsd)} ({pct ?? 0}%)
                          </span>
                          {pct !== null && <MeterBar value={pct} tone={pct < 80 ? "good" : "accent"} width={100} />}
                        </div>
                      ) : (
                        <span className="text-[11.5px] text-brand-400">Uncapped</span>
                      )}
                    </Td>
                    <Td align="right">
                      <span className="font-mono text-[11.5px] text-brand-500">
                        {relativeTime(o.lastUsedAt)}
                      </span>
                    </Td>
                  </Tr>
                );
              })
            ) : (
              <Tr>
                <Td colSpan={7} className="py-10 text-center text-[12.5px] text-brand-500">
                  No organization AI spend recorded in this window.
                </Td>
              </Tr>
            )}
          </tbody>
        </AdminTableWrap>
      </Panel>

      {/* Recent AI Errors Log */}
      {analytics && analytics.recentErrors.length > 0 && (
        <Panel
          title="Recent AI Provider Errors"
          subtitle="Refused or errored model calls from the last window for rapid debugging."
          actions={<Pill tone="bad">{analytics.recentErrors.length} recent</Pill>}
        >
          <AdminTableWrap label="Recent AI provider errors" minWidth={820} maxHeightClass="max-h-[340px]">
            <AdminThead>
              <tr>
                <Th>When</Th>
                <Th>Workspace</Th>
                <Th>Provider / Model</Th>
                <Th>Task</Th>
                <Th>Status</Th>
                <Th>Error</Th>
              </tr>
            </AdminThead>
            <tbody>
              {analytics.recentErrors.map((err) => (
                <Tr key={err.id}>
                  <Td>
                    <span className="font-mono text-[11.5px] text-brand-500">
                      {relativeTime(err.createdAt)}
                    </span>
                  </Td>
                  <Td>
                    <span className="text-[12.5px] font-medium text-brand-950">{err.organizationName}</span>
                  </Td>
                  <Td>
                    <span className="font-mono text-[11.5px] text-brand-800">
                      {err.provider} / {err.model}
                    </span>
                  </Td>
                  <Td>
                    <span className="font-mono text-[11px] text-brand-500">{err.taskType}</span>
                  </Td>
                  <Td>
                    <Pill tone="bad">
                      <AlertCircle size={10} /> {err.status}
                    </Pill>
                  </Td>
                  <Td>
                    <span className="block max-w-[300px] truncate font-mono text-[11px] text-error-600" title={err.error ?? undefined}>
                      {err.error ?? "No provider message"}
                    </span>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </AdminTableWrap>
        </Panel>
      )}

      {/* User / Workspace Model Attribution */}
      <Panel
        title="Model Attribution Ledger"
        subtitle="Attribution by calling user (where recorded) or workspace for background jobs."
        actions={
          <AdminSearchInput
            value={modelSearch}
            onChange={setModelSearch}
            placeholder="Search user, workspace, or model…"
          />
        }
      >
        <AdminTableWrap label="Model attribution ledger" minWidth={760} maxHeightClass="max-h-[380px]">
          <AdminThead>
            <tr>
              <Th>Caller / Workspace</Th>
              <Th>Organization</Th>
              <Th>AI Model</Th>
              <Th align="right">Requests</Th>
              <Th align="right">Tokens</Th>
              <Th align="right">Est. Spend</Th>
              <Th align="right">Last Active</Th>
            </tr>
          </AdminThead>
          <tbody>
            {filteredUserModels.length > 0 ? (
              filteredUserModels.map((row) => (
                <Tr key={`${row.userId}:${row.provider}:${row.model}`}>
                  <Td>
                    <span className="block text-[12.5px] font-semibold text-brand-950">{row.userName}</span>
                    <span className="block font-mono text-[10.5px] text-brand-400">{row.userEmail}</span>
                  </Td>
                  <Td>
                    <span className="text-[12.5px] text-brand-700">{row.organizationName}</span>
                  </Td>
                  <Td>
                    <span className="font-mono text-[11.5px] font-semibold text-brand-900">
                      {row.provider} / {row.model}
                    </span>
                  </Td>
                  <Td align="right">
                    <span className="font-mono text-[12px] text-brand-950 tabular-nums">
                      {row.calls.toLocaleString()}
                    </span>
                  </Td>
                  <Td align="right">
                    <span className="font-mono text-[12px] text-brand-600 tabular-nums">
                      {row.totalTokens.toLocaleString()}
                    </span>
                  </Td>
                  <Td align="right">
                    <span className="font-mono text-[12.5px] font-bold text-success-600 tabular-nums">
                      {formatUsd(row.cost, 4)}
                    </span>
                  </Td>
                  <Td align="right">
                    <span className="font-mono text-[11.5px] text-brand-500">
                      {relativeTime(row.lastUsedAt)}
                    </span>
                  </Td>
                </Tr>
              ))
            ) : (
              <Tr>
                <Td colSpan={7} className="py-10 text-center text-[12.5px] text-brand-500">
                  No attributed model calls matching search.
                </Td>
              </Tr>
            )}
          </tbody>
        </AdminTableWrap>
      </Panel>

      {/* Existing server-backed AI Provider Configuration */}
      <AiConfigurationTab />
    </div>
  );
}
