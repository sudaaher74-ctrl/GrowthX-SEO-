"use client";

import React from "react";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Building2,
  CheckCircle2,
  Cpu,
  Database,
  Server,
  Users,
  Wallet,
  Zap,
} from "lucide-react";
import { Kpi, Panel, Pill, relativeTime } from "@/components/ui/console";
import type { AdminSection } from "@/components/layout/admin-sidebar";
import type {
  AdminOpsSummary,
  AdminSystemHealth,
  ApiCostStat,
  QueueStat,
} from "@/lib/api-types";
import { AdminSkeletonCard, formatCompactNumber, formatUsd } from "./admin-primitives";
import { cn } from "@/lib/utils";

interface OverviewSectionProps {
  loading: boolean;
  stats: {
    tenants: number;
    users: number;
    projects: number;
    loggedInUsers: number;
    activeSessions: number;
  } | null;
  opsSummary: AdminOpsSummary | null;
  systemHealth: AdminSystemHealth | null;
  queues: QueueStat[];
  apiCosts: ApiCostStat[];
  onNavigate: (section: AdminSection) => void;
}

const TIER_META: Array<{ id: string; label: string; colorClass: string }> = [
  { id: "agency", label: "Agency", colorClass: "bg-success-500" },
  { id: "growth", label: "Growth", colorClass: "bg-accent-500" },
  { id: "starter", label: "Starter", colorClass: "bg-warning-500" },
  { id: "founder_free", label: "Founder Free", colorClass: "bg-brand-400" },
];

export function OverviewSection({
  loading,
  stats,
  opsSummary,
  systemHealth,
  queues,
  apiCosts,
  onNavigate,
}: OverviewSectionProps) {
  const mtdSpend =
    opsSummary?.aiMtd.spendUsd !== undefined
      ? opsSummary.aiMtd.spendUsd
      : apiCosts.reduce((sum, c) => sum + c.cost, 0);

  const crawlsCompleted = opsSummary?.crawls24h.completed ?? 0;
  const crawlsFailed = opsSummary?.crawls24h.failed ?? 0;
  const crawlsRunning = opsSummary?.crawls24h.running ?? 0;
  const totalCrawls24h = crawlsCompleted + crawlsFailed + crawlsRunning;

  const totalFailedQueueJobs = queues.reduce((sum, q) => sum + q.failed, 0);
  const totalTierOrgs = Object.values(opsSummary?.tierBreakdown ?? {}).reduce((a, b) => a + b, 0);

  const alertTarget = (category: string): AdminSection => {
    if (category === "crawl" || category === "sync") return "queues";
    if (category === "ai") return "ai-models";
    if (category === "budget") return "tenants";
    return "governance";
  };

  if (loading && !stats && !systemHealth) {
    return (
      <div className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <AdminSkeletonCard />
          <AdminSkeletonCard />
          <AdminSkeletonCard />
          <AdminSkeletonCard />
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <AdminSkeletonCard className="xl:col-span-2 h-64" />
          <AdminSkeletonCard className="h-64" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* KPI strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Kpi
          label="Active Tenants"
          value={stats ? stats.tenants.toLocaleString() : "—"}
          sub={stats ? `${stats.projects.toLocaleString()} projects across organizations` : "Loading organizations"}
          aside={
            <span className="ml-auto flex h-8 w-8 items-center justify-center rounded-xl bg-surface-2 text-brand-600">
              <Building2 size={15} />
            </span>
          }
        />
        <Kpi
          label="Platform Users"
          value={stats ? stats.users.toLocaleString() : "—"}
          sub={
            stats
              ? `${stats.loggedInUsers} online · ${stats.activeSessions} active session${stats.activeSessions === 1 ? "" : "s"}`
              : "Loading user sessions"
          }
          aside={
            stats && stats.loggedInUsers > 0 ? (
              <Pill tone="good" dot>
                {stats.loggedInUsers} live
              </Pill>
            ) : (
              <span className="ml-auto flex h-8 w-8 items-center justify-center rounded-xl bg-surface-2 text-brand-600">
                <Users size={15} />
              </span>
            )
          }
        />
        <Kpi
          label="24h Crawl Runs"
          value={opsSummary ? totalCrawls24h.toLocaleString() : "—"}
          tone={crawlsFailed > 0 ? "danger" : "default"}
          sub={
            opsSummary
              ? `${crawlsCompleted} ok · ${crawlsRunning} running · ${crawlsFailed} failed`
              : "Loading crawl telemetry"
          }
          aside={
            <span className="ml-auto flex h-8 w-8 items-center justify-center rounded-xl bg-surface-2 text-brand-600">
              <Activity size={15} />
            </span>
          }
        />
        <Kpi
          label="AI Spend (MTD)"
          value={formatUsd(mtdSpend)}
          tone={(opsSummary?.aiMtd.errors24h ?? 0) > 0 ? "danger" : "good"}
          sub={
            opsSummary
              ? `${formatCompactNumber(opsSummary.aiMtd.tokens)} tokens · ${opsSummary.aiMtd.errors24h} err (24h)`
              : "Loading AI ledger"
          }
          aside={
            <span className="ml-auto flex h-8 w-8 items-center justify-center rounded-xl bg-surface-2 text-brand-600">
              <Wallet size={15} />
            </span>
          }
        />
      </div>

      {/* Infrastructure Health + Attention Feed */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Panel
          className="xl:col-span-2"
          title="Infrastructure Health"
          subtitle="Live telemetry from PostgreSQL, Redis BullMQ queues, crawler workers, and the Multi-AI Router."
          padded
          actions={
            systemHealth?.timestamp ? (
              <span className="font-mono text-[11px] text-brand-400">
                Checked {relativeTime(systemHealth.timestamp)}
              </span>
            ) : null
          }
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <InfraTile
              icon={<Database size={15} className="text-success-500" />}
              name="PostgreSQL"
              status={systemHealth?.database.status ?? "UNKNOWN"}
              tone={systemHealth?.database.status === "CONNECTED" ? "good" : "bad"}
              detail="Primary relational store & Prisma connection pool."
              metrics={[
                { label: "Ping", value: systemHealth ? `${systemHealth.database.latencyMs}ms` : "—" },
                { label: "Projects", value: stats ? String(stats.projects) : "—" },
              ]}
            />
            <InfraTile
              icon={<Server size={15} className="text-accent-500" />}
              name="Redis / BullMQ"
              status={systemHealth?.redis.status ?? "UNKNOWN"}
              tone={
                systemHealth?.redis.status === "CONNECTED"
                  ? "good"
                  : systemHealth?.redis.status === "PAUSED"
                    ? "warn"
                    : "bad"
              }
              detail="Job coordination across crawl-jobs, page-fetch, and page-render."
              metrics={[
                {
                  label: "Queues",
                  value: systemHealth
                    ? `${systemHealth.redis.connectedQueues ?? 0}/${systemHealth.redis.totalQueues ?? queues.length}`
                    : "—",
                },
                {
                  label: "Paused",
                  value: systemHealth ? String(systemHealth.redis.pausedQueues ?? 0) : "—",
                },
              ]}
            />
            <InfraTile
              icon={<Cpu size={15} className="text-signal-400" />}
              name="Crawler Workers"
              status={systemHealth?.crawlerCluster.status ?? "UNKNOWN"}
              tone={
                systemHealth?.crawlerCluster.status === "OPERATIONAL"
                  ? "good"
                  : systemHealth?.crawlerCluster.status === "PAUSED"
                    ? "warn"
                    : "bad"
              }
              detail="Live headless & static crawler throughput from queue + CrawlJob state."
              metrics={[
                { label: "Active Jobs", value: systemHealth ? String(systemHealth.crawlerCluster.activeWorkers) : "—" },
                { label: "Running Crawls", value: systemHealth ? String(systemHealth.crawlerCluster.runningCrawls ?? 0) : "—" },
                { label: "Failed", value: String(totalFailedQueueJobs) },
              ]}
            />
            <InfraTile
              icon={<Zap size={15} className="text-warning-500" />}
              name="Multi-AI Router"
              status={systemHealth?.aiRouter.status ?? "UNKNOWN"}
              tone={
                systemHealth?.aiRouter.status === "OPERATIONAL"
                  ? "good"
                  : systemHealth?.aiRouter.status === "DEGRADED"
                    ? "warn"
                    : "bad"
              }
              detail={
                systemHealth?.aiRouter.configuredProviders && systemHealth.aiRouter.configuredProviders.length > 0
                  ? `Active providers: ${systemHealth.aiRouter.configuredProviders.join(", ")}`
                  : "No configured AI provider keys detected in environment."
              }
              metrics={[
                { label: "24h Calls", value: systemHealth ? String(systemHealth.aiRouter.calls24h ?? 0) : "—" },
                {
                  label: "Error Rate",
                  value: systemHealth ? `${systemHealth.aiRouter.errorRatePct ?? 0}%` : "—",
                },
                {
                  label: "Avg Latency",
                  value: systemHealth?.aiRouter.avgLatencyMs ? `${systemHealth.aiRouter.avgLatencyMs}ms` : "—",
                },
              ]}
            />
          </div>
        </Panel>

        <Panel
          title="Needs Attention"
          subtitle="Real incidents from the last 24h and active budget alerts."
          padded
          actions={
            opsSummary ? (
              <Pill tone={opsSummary.alerts.length > 0 ? "warn" : "good"}>
                {opsSummary.alerts.length} open
              </Pill>
            ) : null
          }
        >
          {!opsSummary || opsSummary.alerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-success-50 text-success-600 mb-2.5">
                <CheckCircle2 size={18} />
              </span>
              <p className="text-[13px] font-semibold text-brand-950">All clear</p>
              <p className="mt-1 text-[11.5px] text-brand-500 max-w-[220px]">
                No failed crawls, AI spikes, webhook errors, or budget alerts in the last 24 hours.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[340px] overflow-y-auto pr-1">
              {opsSummary.alerts.map((alert) => (
                <button
                  key={alert.id}
                  type="button"
                  onClick={() => onNavigate(alertTarget(alert.category))}
                  className="group w-full rounded-xl border border-brand-200 bg-surface-2/70 p-3 text-left transition hover:border-brand-300 hover:bg-surface-2 cursor-pointer"
                >
                  <div className="flex items-start gap-2.5">
                    <span
                      className={cn(
                        "mt-0.5 shrink-0",
                        alert.severity === "critical" ? "text-error-500" : "text-warning-500",
                      )}
                    >
                      {alert.severity === "critical" ? <AlertCircle size={14} /> : <AlertTriangle size={14} />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-[12px] font-semibold text-brand-950">
                          {alert.title}
                        </span>
                        <ArrowRight
                          size={12}
                          className="shrink-0 text-brand-400 transition group-hover:translate-x-0.5 group-hover:text-brand-950"
                        />
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-[11px] text-brand-500">{alert.detail}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </Panel>
      </div>

      {/* Queue Throughput + Tenant Tier Mix */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Panel
          className="xl:col-span-2"
          title="Worker Queue Throughput"
          subtitle="Live BullMQ status across crawl-jobs, page-fetch, and page-render."
          padded
          actions={
            <button
              type="button"
              onClick={() => onNavigate("queues")}
              className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-brand-600 hover:text-brand-950 cursor-pointer"
            >
              Inspect queues <ArrowRight size={12} />
            </button>
          }
        >
          {queues.length === 0 ? (
            <p className="py-8 text-center text-[12px] text-brand-500">No queue telemetry returned yet.</p>
          ) : (
            <div className="space-y-4">
              {queues.map((q) => {
                const total = q.completed + q.failed + q.active + q.waiting;
                const completedPct = total > 0 ? (q.completed / total) * 100 : 0;
                const activePct = total > 0 ? ((q.active + q.waiting) / total) * 100 : 0;
                const failedPct = total > 0 ? (q.failed / total) * 100 : 0;

                return (
                  <div key={q.name} className="space-y-1.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[12.5px] font-semibold text-brand-950">{q.name}</span>
                        <Pill tone={q.paused ? "warn" : q.failed > 0 ? "bad" : q.status === "active" ? "good" : "default"}>
                          {q.paused ? "PAUSED" : q.status.toUpperCase()}
                        </Pill>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 font-mono text-[11.5px] tabular-nums">
                        <span className="text-brand-700">
                          <strong className="text-brand-950">{q.active}</strong> active
                        </span>
                        <span className="text-brand-500">
                          <strong>{q.waiting}</strong> waiting
                        </span>
                        <span className="text-success-600">
                          <strong>{q.completed.toLocaleString()}</strong> ok
                        </span>
                        <span className={q.failed > 0 ? "font-semibold text-error-600" : "text-brand-400"}>
                          <strong>{q.failed}</strong> failed
                        </span>
                      </div>
                    </div>
                    <div className="flex h-2 w-full overflow-hidden rounded-full bg-surface-3">
                      {completedPct > 0 && (
                        <div className="bg-success-500 transition-all" style={{ width: `${completedPct}%` }} />
                      )}
                      {activePct > 0 && (
                        <div className="bg-accent-500 transition-all" style={{ width: `${activePct}%` }} />
                      )}
                      {failedPct > 0 && (
                        <div className="bg-error-500 transition-all" style={{ width: `${failedPct}%` }} />
                      )}
                    </div>
                  </div>
                );
              })}
              <div className="flex flex-wrap items-center gap-4 pt-1 text-[11px] text-brand-500">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-success-500" />
                  Completed
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-accent-500" />
                  Active / Waiting
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-error-500" />
                  Failed
                </span>
              </div>
            </div>
          )}
        </Panel>

        <Panel
          title="Subscription Tier Mix"
          subtitle="Organizations by server-owned subscription tier."
          padded
          actions={
            <button
              type="button"
              onClick={() => onNavigate("tenants")}
              className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-brand-600 hover:text-brand-950 cursor-pointer"
            >
              Manage tenants <ArrowRight size={12} />
            </button>
          }
        >
          {totalTierOrgs === 0 ? (
            <p className="py-8 text-center text-[12px] text-brand-500">No organizations registered yet.</p>
          ) : (
            <div className="space-y-3.5">
              <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-surface-3">
                {TIER_META.map((t) => {
                  const count = opsSummary?.tierBreakdown[t.id] ?? 0;
                  if (count === 0) return null;
                  const pct = (count / totalTierOrgs) * 100;
                  return <div key={t.id} className={t.colorClass} style={{ width: `${pct}%` }} />;
                })}
              </div>

              <div className="space-y-2.5">
                {TIER_META.map((t) => {
                  const count = opsSummary?.tierBreakdown[t.id] ?? 0;
                  const pct = totalTierOrgs > 0 ? Math.round((count / totalTierOrgs) * 100) : 0;
                  return (
                    <div key={t.id} className="flex items-center justify-between text-[12.5px]">
                      <span className="flex items-center gap-2 text-brand-700">
                        <span className={cn("h-2 w-2 rounded-full", t.colorClass)} />
                        {t.label}
                      </span>
                      <span className="font-mono text-[12px] tabular-nums">
                        <strong className="text-brand-950">{count}</strong>{" "}
                        <span className="text-brand-400">({pct}%)</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}

function InfraTile({
  icon,
  name,
  status,
  tone,
  detail,
  metrics,
}: {
  icon: React.ReactNode;
  name: string;
  status: string;
  tone: "good" | "warn" | "bad";
  detail: string;
  metrics: Array<{ label: string; value: string }>;
}) {
  return (
    <div className="rounded-xl border border-brand-200 bg-surface-2/60 p-4 flex flex-col justify-between gap-3">
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2 text-[13px] font-semibold text-brand-950">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-brand-200 bg-surface-1">
              {icon}
            </span>
            {name}
          </span>
          <Pill tone={tone} dot>
            {status}
          </Pill>
        </div>
        <p className="text-[11.5px] leading-relaxed text-brand-500">{detail}</p>
      </div>
      <div className="flex flex-wrap items-center gap-4 border-t border-brand-200/70 pt-2.5">
        {metrics.map((m) => (
          <div key={m.label}>
            <span className="block text-[9.5px] font-semibold uppercase tracking-[0.06em] text-brand-400">
              {m.label}
            </span>
            <span className="font-mono text-[12px] font-semibold text-brand-950 tabular-nums">{m.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
