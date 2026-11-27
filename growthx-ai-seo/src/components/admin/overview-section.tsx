"use client";

import React from "react";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Cpu,
  Database,
  HardDrive,
  Server,
  Terminal,
  Zap,
} from "lucide-react";
import { Pill, relativeTime } from "@/components/ui/console";
import type { AdminSection } from "@/components/layout/admin-sidebar";
import type {
  AdminOpsSummary,
  AdminSystemHealth,
  AdminSystemRuntime,
  AdminUsersIntelligenceResponse,
  ApiCostStat,
  QueueStat,
} from "@/lib/api-types";
import {
  AdminSkeletonCard,
  NocButton,
  NocPanel,
  NocStat,
  formatCompactNumber,
  formatDurationSec,
  formatInr,
  formatUsd,
} from "./admin-primitives";
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
  runtime: AdminSystemRuntime | null;
  queues: QueueStat[];
  apiCosts: ApiCostStat[];
  usersIntelligence?: AdminUsersIntelligenceResponse | null;
  onNavigate: (section: AdminSection) => void;
}

export function OverviewSection({
  loading,
  stats,
  opsSummary,
  systemHealth,
  runtime,
  queues,
  apiCosts,
  usersIntelligence,
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

  const heapPct =
    runtime && runtime.process.heapTotalMb > 0
      ? Math.min(100, Math.round((runtime.process.heapUsedMb / runtime.process.heapTotalMb) * 100))
      : 0;

  const alertTarget = (category: string): AdminSection => {
    if (category === "crawl") return "crawler";
    if (category === "sync") return "queues";
    if (category === "ai") return "ai-models";
    if (category === "budget") return "tenants";
    return "governance";
  };

  if (loading && !stats && !systemHealth && !runtime) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
          <AdminSkeletonCard />
          <AdminSkeletonCard />
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

  const tableEntries = runtime
    ? [
        { name: "Organization", count: runtime.database.tableCounts.organizations },
        { name: "User", count: runtime.database.tableCounts.users },
        { name: "Project", count: runtime.database.tableCounts.projects },
        { name: "Website", count: runtime.database.tableCounts.websites },
        { name: "CrawlJob", count: runtime.database.tableCounts.crawlJobs },
        { name: "Page", count: runtime.database.tableCounts.pages },
        { name: "Issue", count: runtime.database.tableCounts.issues },
        { name: "AiUsageRecord", count: runtime.database.tableCounts.aiUsageRecords },
        { name: "TokenTransaction", count: runtime.database.tableCounts.tokenTransactions },
        { name: "AuditLog", count: runtime.database.tableCounts.auditLogs },
      ]
    : [];

  return (
    <div className="space-y-4">
      {/* High-density 6-tile Executive Telemetry Bar */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <NocStat
          label="Postgres Latency"
          value={systemHealth ? `${systemHealth.database.latencyMs}ms` : "—"}
          tone={systemHealth?.database.status === "CONNECTED" ? "good" : "bad"}
          sub={
            runtime?.database.sizePretty
              ? `${runtime.database.sizePretty} · ${runtime.database.activeConnections ?? 0} conns`
              : systemHealth?.database.status ?? "Checking"
          }
        />
        <NocStat
          label="Redis Memory"
          value={runtime?.redis.usedMemoryHuman ?? (systemHealth?.redis.status === "CONNECTED" ? "Connected" : "Offline")}
          tone={
            runtime?.redis.connected
              ? "cyan"
              : systemHealth?.redis.status === "CONNECTED"
                ? "good"
                : "warn"
          }
          sub={
            runtime?.redis.connected
              ? `${runtime.redis.opsPerSec ?? 0} ops/s · ${runtime.redis.connectedClients ?? 0} clients`
              : systemHealth?.redis.status === "CONNECTED"
                ? "Queues ready"
                : "Synchronous fallback"
          }
        />
        <NocStat
          label="Node Heap"
          value={runtime ? `${runtime.process.heapUsedMb}MB` : "—"}
          tone={heapPct > 85 ? "warn" : "default"}
          sub={
            runtime
              ? `RSS ${runtime.process.rssMb}MB · up ${formatDurationSec(runtime.process.uptimeSec)}`
              : "Awaiting runtime probe"
          }
        />
        <NocStat
          label="Crawls (24h)"
          value={opsSummary ? String(totalCrawls24h) : "—"}
          tone={crawlsFailed > 0 ? "bad" : "default"}
          sub={`${crawlsCompleted} ok · ${crawlsRunning} run · ${crawlsFailed} fail`}
        />
        <NocStat
          label="Active Users"
          value={stats ? String(stats.loggedInUsers) : "—"}
          tone={stats && stats.loggedInUsers > 0 ? "good" : "default"}
          sub={stats ? `${stats.users} total · ${stats.tenants} workspaces` : "IAM telemetry"}
        />
        <NocStat
          label="AI Spend (MTD)"
          value={formatUsd(mtdSpend)}
          tone={(opsSummary?.aiMtd.errors24h ?? 0) > 0 ? "warn" : "cyan"}
          sub={
            opsSummary
              ? `${formatCompactNumber(opsSummary.aiMtd.tokens)} tok · ${opsSummary.aiMtd.errors24h} err`
              : "AI ledger"
          }
        />
      </div>

      {/* Unit Economics & Automated COGS Snapshot (MTD) */}
      {usersIntelligence && (
        <div className="rounded-lg border border-primary-200 bg-surface-1 px-4 py-3.5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-primary-600">
                    Unit Economics · MTD
                  </span>
                  <span className="text-[11px] text-brand-400">
                    FX ₹{usersIntelligence.rates.usdToInr}/USD
                  </span>
                </div>
                <div className="mt-0.5 flex items-baseline gap-2 font-mono tabular-nums">
                  <span className="text-[19px] font-bold text-brand-950">
                    {formatUsd(usersIntelligence.summary.totalCostUsd)}
                  </span>
                  <span className="text-[12.5px] text-brand-400">
                    ({formatInr(usersIntelligence.summary.totalCostInr)})
                  </span>
                  <span className="text-[11px] text-brand-400">total COGS</span>
                </div>
              </div>

              <div className="h-8 w-px bg-brand-200 hidden sm:block" />

              <div className="flex flex-wrap items-center gap-4 text-[12px]">
                <div>
                  <span className="block text-[10.5px] text-brand-400">Est. MRR</span>
                  <span className="font-mono font-semibold text-brand-950 tabular-nums">
                    {formatUsd(usersIntelligence.summary.totalMrrUsd)}
                  </span>
                </div>
                <div>
                  <span className="block text-[10.5px] text-brand-400">Net Margin</span>
                  <span
                    className={cn(
                      "font-mono font-semibold tabular-nums",
                      usersIntelligence.summary.netMarginUsd >= 0 ? "text-success-700" : "text-error-700",
                    )}
                  >
                    {formatUsd(usersIntelligence.summary.netMarginUsd)}
                  </span>
                </div>
                <div>
                  <span className="block text-[10.5px] text-brand-400">Tokens Burned</span>
                  <span className="font-mono font-semibold text-brand-950 tabular-nums">
                    {formatCompactNumber(usersIntelligence.summary.totalTokensSpent)}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  {usersIntelligence.summary.freeHighBurnUsers > 0 && (
                    <Pill tone="warn" dot>
                      {usersIntelligence.summary.freeHighBurnUsers} Free High-Burn
                    </Pill>
                  )}
                  {usersIntelligence.summary.lossMakingUsers > 0 && (
                    <Pill tone="bad" dot>
                      {usersIntelligence.summary.lossMakingUsers} Loss-Making
                    </Pill>
                  )}
                </div>
              </div>
            </div>

            <NocButton
              variant="primary"
              icon={<ArrowRight size={12} />}
              onClick={() => onNavigate("users")}
            >
              Users 360° & Cost Ledger
            </NocButton>
          </div>
        </div>
      )}

      {/* Infrastructure Matrix + Incident Stream */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <NocPanel
          className="xl:col-span-2"
          code="SYS"
          title="Subsystem Health Matrix"
          subtitle="Live probes across PostgreSQL, Redis/BullMQ, worker threads, and Multi-AI Router."
          padded
          actions={
            systemHealth?.timestamp ? (
              <span className="font-mono text-[11px] text-brand-400">
                Synced {relativeTime(systemHealth.timestamp)}
              </span>
            ) : null
          }
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <SubsysTile
              icon={<Database size={13} className="text-success-500" />}
              name="PostgreSQL"
              status={systemHealth?.database.status ?? "UNKNOWN"}
              tone={systemHealth?.database.status === "CONNECTED" ? "good" : "bad"}
              kv={[
                ["Ping", systemHealth ? `${systemHealth.database.latencyMs}ms` : "—"],
                ["DB Size", runtime?.database.sizePretty ?? "—"],
                ["Connections", runtime?.database.activeConnections != null ? String(runtime.database.activeConnections) : "—"],
                ["Crawl Rows", runtime ? formatCompactNumber(runtime.database.tableCounts.crawlJobs) : "—"],
              ]}
            />
            <SubsysTile
              icon={<Server size={13} className="text-primary-600" />}
              name="Redis & BullMQ"
              status={systemHealth?.redis.status ?? "UNKNOWN"}
              tone={
                systemHealth?.redis.status === "CONNECTED"
                  ? "good"
                  : systemHealth?.redis.status === "PAUSED"
                    ? "warn"
                    : "bad"
              }
              kv={[
                ["Memory", runtime?.redis.usedMemoryHuman ?? "—"],
                ["Ops/sec", runtime?.redis.opsPerSec != null ? String(runtime.redis.opsPerSec) : "—"],
                ["Hit Rate", runtime?.redis.hitRatePct != null ? `${runtime.redis.hitRatePct}%` : "—"],
                ["Eviction", runtime?.redis.maxmemoryPolicy ?? "—"],
              ]}
            />
            <SubsysTile
              icon={<Cpu size={13} className="text-primary-600" />}
              name="Worker Threads"
              status={
                runtime?.workers.disabledByEnv
                  ? "DISABLED_BY_ENV"
                  : runtime?.workers.crawlJobs || runtime?.workers.pageFetch
                    ? "CONSUMING"
                    : systemHealth?.crawlerCluster.status ?? "IDLE"
              }
              tone={
                runtime?.workers.disabledByEnv
                  ? "warn"
                  : runtime?.workers.crawlJobs && runtime?.workers.pageFetch
                    ? "good"
                    : "warn"
              }
              kv={[
                ["Crawl Worker", runtime?.workers.crawlJobs ? "ONLINE" : "OFF"],
                ["Fetch Worker", runtime?.workers.pageFetch ? "ONLINE" : "OFF"],
                ["Render Worker", runtime?.workers.pageRender ? "ONLINE" : "SHARED"],
                ["Active Jobs", systemHealth ? String(systemHealth.crawlerCluster.activeWorkers) : "—"],
              ]}
            />
            <SubsysTile
              icon={<Zap size={13} className="text-warning-500" />}
              name="Multi-AI Router"
              status={systemHealth?.aiRouter.status ?? "UNKNOWN"}
              tone={
                systemHealth?.aiRouter.status === "OPERATIONAL"
                  ? "good"
                  : systemHealth?.aiRouter.status === "DEGRADED"
                    ? "warn"
                    : "bad"
              }
              kv={[
                [
                  "Providers",
                  systemHealth?.aiRouter.configuredProviders?.length
                    ? systemHealth.aiRouter.configuredProviders.join(", ").toUpperCase()
                    : "NONE",
                ],
                ["24h Calls", systemHealth ? String(systemHealth.aiRouter.calls24h ?? 0) : "—"],
                ["Error Rate", systemHealth ? `${systemHealth.aiRouter.errorRatePct ?? 0}%` : "—"],
                ["Avg Latency", systemHealth?.aiRouter.avgLatencyMs ? `${systemHealth.aiRouter.avgLatencyMs}ms` : "—"],
              ]}
            />
          </div>

          {/* Live Process Memory Bar */}
          {runtime && (
            <div className="mt-3 rounded-md border border-brand-200 bg-surface-2/60 px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-3 font-mono text-[11px]">
              <div className="flex flex-wrap items-center gap-4 text-brand-500">
                <span>
                  <strong className="text-brand-950">NODE</strong> {runtime.process.nodeVersion}
                </span>
                <span>
                  <strong className="text-brand-950">PID</strong> {runtime.process.pid}
                </span>
                <span>
                  <strong className="text-brand-950">HOST</strong> {runtime.process.platform}
                </span>
                <span>
                  <strong className="text-brand-950">CPU</strong> {runtime.process.cpuUserMs}ms usr /{" "}
                  {runtime.process.cpuSystemMs}ms sys
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-brand-400">
                  HEAP {runtime.process.heapUsedMb}/{runtime.process.heapTotalMb}MB ({heapPct}%)
                </span>
                <div className="h-1.5 w-24 overflow-hidden rounded-full bg-surface-3">
                  <div
                    className={cn("h-full", heapPct > 85 ? "bg-error-500" : "bg-primary-500")}
                    style={{ width: `${heapPct}%` }}
                  />
                </div>
              </div>
            </div>
          )}
        </NocPanel>

        {/* Live Incident Feed */}
        <NocPanel
          code="ALRT"
          title="Incident Stream (24h)"
          subtitle="Failed crawls, AI spikes, budget breaches, and sync/webhook errors."
          padded
          actions={
            opsSummary ? (
              <Pill tone={opsSummary.alerts.length > 0 ? "bad" : "good"}>
                {opsSummary.alerts.length} Open
              </Pill>
            ) : null
          }
        >
          {!opsSummary || opsSummary.alerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <CheckCircle2 size={20} className="text-success-500 mb-2" />
              <p className="text-[13px] font-semibold text-brand-950">All Systems Nominal</p>
              <p className="mt-1 text-[11.5px] text-brand-400">
                No crawl failures, AI spikes, webhook errors, or budget alerts in 24h.
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
              {opsSummary.alerts.map((alert) => (
                <button
                  key={alert.id}
                  type="button"
                  onClick={() => onNavigate(alertTarget(alert.category))}
                  className="group w-full rounded-md border border-brand-200 bg-surface-2/70 p-2.5 text-left transition hover:border-primary-300 hover:bg-surface-2 cursor-pointer"
                >
                  <div className="flex items-start gap-2">
                    <span
                      className={cn(
                        "mt-0.5 shrink-0",
                        alert.severity === "critical" ? "text-error-500" : "text-warning-500",
                      )}
                    >
                      {alert.severity === "critical" ? <AlertCircle size={13} /> : <AlertTriangle size={13} />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-[12px] font-semibold text-brand-950">
                          {alert.title}
                        </span>
                        <ArrowRight
                          size={11}
                          className="shrink-0 text-brand-400 transition group-hover:translate-x-0.5 group-hover:text-primary-600"
                        />
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-[11px] text-brand-400">{alert.detail}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </NocPanel>
      </div>

      {/* Bottom Technical Trio: Table Counts + Queue Bars + Safe Runtime Env */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <NocPanel
          code="DB"
          title="Postgres Table Volume"
          subtitle="Live exact row counts across core platform tables."
          padded
        >
          <div className="grid grid-cols-2 gap-2">
            {tableEntries.map((t) => (
              <div
                key={t.name}
                className="flex items-center justify-between rounded-md border border-brand-200 bg-surface-2/60 px-2.5 py-2 font-mono text-[11px]"
              >
                <span className="flex items-center gap-1.5 text-brand-500 truncate">
                  <HardDrive size={11} className="text-brand-400 shrink-0" />
                  {t.name}
                </span>
                <strong className="text-brand-950 tabular-nums">{t.count.toLocaleString()}</strong>
              </div>
            ))}
          </div>
        </NocPanel>

        <NocPanel
          code="MQ"
          title="Queue Throughput"
          subtitle="Live BullMQ lane utilization across crawler queues."
          padded
          actions={
            <NocButton onClick={() => onNavigate("queues")}>
              Open Queues
            </NocButton>
          }
        >
          {queues.length === 0 ? (
            <p className="py-8 text-center text-[12px] text-brand-400">No queue telemetry available</p>
          ) : (
            <div className="space-y-3.5">
              {queues.map((q) => {
                const total = q.completed + q.failed + q.active + q.waiting;
                const okPct = total > 0 ? (q.completed / total) * 100 : 0;
                const activePct = total > 0 ? ((q.active + q.waiting) / total) * 100 : 0;
                const failPct = total > 0 ? (q.failed / total) * 100 : 0;
                return (
                  <div key={q.name} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2 font-mono text-[11px]">
                      <span className="font-semibold text-brand-950">{q.name}</span>
                      <Pill tone={q.paused ? "warn" : q.failed > 0 ? "bad" : q.status === "active" ? "good" : "default"}>
                        {q.paused ? "PAUSED" : q.status.toUpperCase()}
                      </Pill>
                    </div>
                    <div className="flex h-2 w-full overflow-hidden rounded-full bg-surface-3">
                      {okPct > 0 && <div className="bg-success-500" style={{ width: `${okPct}%` }} />}
                      {activePct > 0 && <div className="bg-primary-500" style={{ width: `${activePct}%` }} />}
                      {failPct > 0 && <div className="bg-error-500" style={{ width: `${failPct}%` }} />}
                    </div>
                    <div className="flex items-center justify-between font-mono text-[10px] text-brand-400 tabular-nums">
                      <span>ACT:{q.active} WAIT:{q.waiting} DLY:{q.delayed ?? 0}</span>
                      <span>
                        OK:{q.completed} · <strong className={q.failed > 0 ? "text-error-700" : "text-brand-400"}>FAIL:{q.failed}</strong>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </NocPanel>

        <NocPanel
          code="ENV"
          title="Runtime Tuning Flags"
          subtitle="Non-secret active environment knobs governing crawler, AI, and tokens."
          padded
        >
          <div className="divide-y divide-brand-200/70 rounded-md border border-brand-200 bg-surface-2/40 max-h-[240px] overflow-y-auto">
            {(runtime?.envFlags ?? []).map((f) => (
              <div key={f.key} className="flex items-center justify-between gap-2 px-2.5 py-1.5 font-mono text-[10.5px]">
                <span className="flex items-center gap-1.5 text-brand-400 truncate">
                  <Terminal size={10} className="shrink-0 text-primary-600" />
                  {f.key}
                </span>
                <span className="truncate font-semibold text-brand-950 max-w-[160px]" title={f.value}>
                  {f.value}
                </span>
              </div>
            ))}
          </div>
        </NocPanel>
      </div>
    </div>
  );
}

function SubsysTile({
  icon,
  name,
  status,
  tone,
  kv,
}: {
  icon: React.ReactNode;
  name: string;
  status: string;
  tone: "good" | "warn" | "bad";
  kv: Array<[string, string]>;
}) {
  return (
    <div className="rounded-md border border-brand-200 bg-surface-2/60 p-3 space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-[12.5px] font-semibold text-brand-950">
          {icon}
          {name}
        </span>
        <Pill tone={tone} dot>
          {status}
        </Pill>
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 border-t border-brand-200/80 pt-2">
        {kv.map(([k, v]) => (
          <div key={k} className="min-w-0">
            <span className="block text-[10px] font-medium text-brand-400">{k}</span>
            <span className="block truncate font-mono text-[11.5px] font-semibold text-brand-950 tabular-nums" title={v}>
              {v}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
