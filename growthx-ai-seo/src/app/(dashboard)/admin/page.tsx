"use client";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge, StatusDot } from "@/components/ui/badge";
import { MetricCard } from "@/components/ui/metric-card";
import { cn, formatNumber } from "@/lib/utils";
import {
  ShieldAlert, Cpu, Users, Database, Play, Pause,
  RefreshCw, AlertTriangle, CheckCircle2, MoreHorizontal, Eye,
  Ban, ArrowUpRight, Zap, Server
} from "lucide-react";
import { api, QueueStat, ApiCostStat, TenantStat } from "@/lib/api-client";

export default function AdminPage() {
  const [workersPaused, setWorkersPaused] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [workerQueues, setWorkerQueues] = useState<QueueStat[]>([]);
  const [apiCosts, setApiCosts] = useState<ApiCostStat[]>([]);
  const [tenants, setTenants] = useState<TenantStat[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function loadData() {
      try {
        const [queues, costs, tenantsData] = await Promise.all([
          api.getAdminQueues(),
          api.getAdminCosts(),
          api.getAdminTenants()
        ]);
        if (mounted) {
          setWorkerQueues(queues);
          setApiCosts(costs);
          setTenants(tenantsData);
          setIsLoading(false);
        }
      } catch (err) {
        console.error("Failed to load admin data:", err);
      }
    }
    loadData();
    return () => { mounted = false; };
  }, []);

  const handleRetry = () => {
    setRetrying(true);
    setTimeout(() => setRetrying(false), 1500);
  };

  return (
    <div className="space-y-8">


      {/* Page Header */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-full bg-red-500/10 text-red-500 dark:bg-red-500/20 text-xs font-bold uppercase tracking-wider flex items-center gap-1">
              <ShieldAlert size={12} /> Super Admin
            </span>
            <h1 className="text-h1 text-[var(--text-primary)]">System Control Panel</h1>
          </div>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Real-time layout for BullMQ queues, AI token billing, infrastructure health, and tenant management
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={workersPaused ? "primary" : "secondary"}
            size="sm"
            onClick={() => setWorkersPaused(!workersPaused)}
            icon={workersPaused ? <Play size={13} /> : <Pause size={13} />}
          >
            {workersPaused ? "Resume Workers" : "Pause Queues"}
          </Button>
          <Button variant="outline" size="sm" onClick={handleRetry} loading={retrying} icon={<RefreshCw size={13} />}>
            Retry Failed
          </Button>
        </div>
      </motion.div>

      {/* Three cards, all counted from what the API returns.
          A fourth showed "Monthly Recurring Revenue $24,800, +18.4% vs last
          month" — nothing in this product tracks revenue, and billing was
          removed from the schema entirely, so the figure was invented and
          could not have been anything else. The deltas on the others were
          invented too, including a "99.99% success" rate nothing measured. A
          count with no trend is honest; a count with a made-up trend is not. */}
      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard title="Active SaaS Tenants" value={tenants.length} icon={<Users size={16} />} delay={0.05} />
        <MetricCard
          title="BullMQ Jobs Completed"
          value={workerQueues.reduce((acc, q) => acc + q.completed, 0)}
          deltaLabel="last 24 hours"
          icon={<Cpu size={16} />}
          delay={0.1}
        />
        <MetricCard
          title="AI API Cost MTD"
          value={apiCosts.reduce((acc, c) => acc + c.cost, 0).toFixed(2)}
          prefix="$"
          icon={<Zap size={16} />}
          delay={0.15}
        />
      </div>

      {/* Middle Grid: Queues & AI Costs */}
      <div className="grid xl:grid-cols-3 gap-6">
        {/* BullMQ Worker Queues */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="card xl:col-span-2 overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-color)]">
            <div className="flex items-center gap-2">
              <Server size={16} className="text-purple-500" />
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">BullMQ Background Worker Queues</h3>
            </div>
            <StatusDot status={workersPaused ? "warning" : "success"} label={workersPaused ? "Workers Paused" : "Redis Connected"} pulse={!workersPaused} />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[var(--surface-2)] text-[var(--text-muted)] text-xs uppercase tracking-wider border-b border-[var(--border-color)]">
                <tr>
                  <th className="py-3 px-5 font-semibold">Queue Name</th>
                  <th className="py-3 px-4 font-semibold text-right">Active</th>
                  <th className="py-3 px-4 font-semibold text-right">Waiting</th>
                  <th className="py-3 px-4 font-semibold text-right">Completed (24h)</th>
                  <th className="py-3 px-4 font-semibold text-right">Failed</th>
                  <th className="py-3 px-5 font-semibold text-right">Avg Duration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-color)]">
                {workerQueues.map(q => (
                  <tr key={q.name} className="hover:bg-[var(--surface-2)] transition-base">
                    <td className="py-3.5 px-5 font-mono text-xs font-semibold text-[var(--text-primary)] flex items-center gap-2">
                      <span className={cn("w-2 h-2 rounded-full shrink-0", q.status === "active" && !workersPaused ? "bg-emerald-500 animate-pulse" : "bg-slate-400")} />
                      {q.name}
                    </td>
                    <td className="py-3.5 px-4 text-right font-medium text-purple-500">{workersPaused ? 0 : q.active}</td>
                    <td className="py-3.5 px-4 text-right text-[var(--text-secondary)]">{q.waiting.toLocaleString()}</td>
                    <td className="py-3.5 px-4 text-right text-[var(--text-secondary)]">{q.completed.toLocaleString()}</td>
                    <td className="py-3.5 px-4 text-right font-semibold text-red-500">{q.failed > 0 ? q.failed : "0"}</td>
                    <td className="py-3.5 px-5 text-right text-xs text-[var(--text-muted)] font-mono">{q.avgTime}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-4 bg-[var(--surface-2)] border-t border-[var(--border-color)] mt-auto flex items-center justify-between text-xs text-[var(--text-muted)]">
            <span>Workers run on Node.js / BullMQ cluster connected to Redis (Port 6379)</span>
            <span className="text-purple-400 cursor-pointer hover:underline">View Redis Monitoring →</span>
          </div>
        </motion.div>

        {/* AI API Cost Breakdown */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="card p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">AI & API Cost Breakdown</h3>
              <Badge variant="info">
                {new Date().toLocaleDateString(undefined, { month: "long", year: "numeric" })}
              </Badge>
            </div>
            {/* Summed from the same rows listed below, so the headline and the
                breakdown cannot disagree. It was a literal $264.80. */}
            <div className="text-3xl font-bold gradient-text-brand mb-1">
              ${apiCosts.reduce((acc, c) => acc + c.cost, 0).toFixed(2)}
            </div>
            <p className="text-xs text-[var(--text-muted)] mb-6">
              Total spend across {apiCosts.length} external {apiCosts.length === 1 ? "API" : "APIs"}
            </p>

            <div className="space-y-4">
              {apiCosts.map(item => (
                <div key={item.service} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-[var(--text-primary)]">{item.service}</span>
                    <span className="font-bold text-[var(--text-primary)]">${item.cost.toFixed(2)} <span className="font-normal text-[var(--text-muted)]">({item.tokens})</span></span>
                  </div>
                  {item.limit > 0 && (
                    <div className="h-1.5 bg-[var(--surface-3)] rounded-full overflow-hidden">
                      <div className={cn("h-full rounded-full transition-all duration-500", item.color)} style={{ width: `${Math.min(100, (item.cost / item.limit) * 100)}%` }} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-[var(--border-color)] flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-[var(--text-primary)]">Monthly Budget Cap</div>
              {/* Stated as unset rather than showing $400.00, which was a
                  literal — no cap is configured anywhere and no alert fires. */}
              <div className="text-[11px] text-[var(--text-muted)]">Not configured — no spend alerts are active.</div>
            </div>
            <Button variant="outline" size="sm">Set Cap</Button>
          </div>
        </motion.div>
      </div>

      {/* Tenant Workspaces Directory Table */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="card overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between px-5 py-4 border-b border-[var(--border-color)] gap-3">
          <div>
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Tenant Workspaces Directory</h3>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">Manage subscribed agencies, quotas, and impersonate accounts for support</p>
          </div>
          <div className="flex items-center gap-2">
            <input type="text" placeholder="Search tenants..." className="bg-[var(--surface-2)] border border-[var(--border-color)] rounded-lg px-3 py-1.5 text-xs text-[var(--text-primary)] focus:outline-none focus:border-purple-500" />
            <Button variant="primary" size="sm">Provision Tenant</Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[var(--surface-2)] text-[var(--text-muted)] text-xs uppercase tracking-wider border-b border-[var(--border-color)]">
              <tr>
                <th className="py-3 px-5 font-semibold">Workspace Name</th>
                <th className="py-3 px-4 font-semibold">Owner Email</th>
                <th className="py-3 px-4 font-semibold">Subscription Plan</th>
                <th className="py-3 px-4 font-semibold text-center">Sites</th>
                <th className="py-3 px-4 font-semibold text-center">Avg SEO Health</th>
                <th className="py-3 px-5 font-semibold">Quota Used</th>
                <th className="py-3 px-5 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-color)]">
              {tenants.map(t => (
                <tr key={t.id} className="hover:bg-[var(--surface-2)] transition-base">
                  <td className="py-3.5 px-5 font-bold text-[var(--text-primary)] flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg gradient-bg-brand flex items-center justify-center text-white text-xs font-bold shrink-0">
                      {t.name.charAt(0)}
                    </div>
                    <span>{t.name}</span>
                  </td>
                  <td className="py-3.5 px-4 text-xs text-[var(--text-secondary)]">{t.owner}</td>
                  <td className="py-3.5 px-4">
                    <Badge variant={t.plan === "Agency" ? "pending" : t.plan === "Growth" ? "info" : "default"}>
                      {t.plan}
                    </Badge>
                  </td>
                  <td className="py-3.5 px-4 text-center font-semibold text-[var(--text-primary)]">{t.sites}</td>
                  <td className="py-3.5 px-4 text-center">
                    {t.health > 0 ? (
                      <span className={cn("font-bold", t.health >= 80 ? "text-emerald-500" : t.health >= 60 ? "text-amber-500" : "text-red-500")}>
                        {t.health}/100
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">Not Synced</span>
                    )}
                  </td>
                  <td className="py-3.5 px-5">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-[var(--surface-3)] rounded-full overflow-hidden w-20">
                        <div
                          className={cn("h-full rounded-full", t.quota > 80 ? "bg-red-500" : t.quota > 60 ? "bg-amber-500" : "bg-emerald-500")}
                          style={{ width: `${t.quota}%` }}
                        />
                      </div>
                      <span className="text-xs font-semibold text-[var(--text-muted)] w-8 text-right">{t.quota}%</span>
                    </div>
                  </td>
                  <td className="py-3.5 px-5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" icon={<Eye size={13} />}>
                        Impersonate
                      </Button>
                      <button className="p-1.5 rounded-lg text-[var(--text-muted)] hover:bg-[var(--surface-3)] hover:text-red-500 transition-base" title="Suspend Tenant">
                        <Ban size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}
