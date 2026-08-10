"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge, StatusDot } from "@/components/ui/badge";
import { MetricCard } from "@/components/ui/metric-card";
import { cn, formatNumber } from "@/lib/utils";
import {
  ShieldAlert, Cpu, DollarSign, Users, Database, Play, Pause,
  RefreshCw, AlertTriangle, CheckCircle2, MoreHorizontal, Eye,
  Ban, ArrowUpRight, Zap, Server
} from "lucide-react";

const workerQueues = [
  { name: "weekly-tech-audit", active: 14, waiting: 82, completed: 1420, failed: 1, avgTime: "12.4s", status: "active" },
  { name: "serp-rank-tracker", active: 8, waiting: 410, completed: 8940, failed: 0, avgTime: "2.1s", status: "active" },
  { name: "ai-content-generator", active: 3, waiting: 5, completed: 342, failed: 2, avgTime: "45.0s", status: "active" },
  { name: "gsc-data-syncer", active: 22, waiting: 1240, completed: 42100, failed: 0, avgTime: "1.8s", status: "active" },
  { name: "schema-validator", active: 0, waiting: 0, completed: 890, failed: 0, avgTime: "0.4s", status: "idle" },
];

const apiCosts = [
  { service: "OpenAI GPT-4o (Content & Meta)", tokens: "2.8M", cost: 142.50, limit: 300, color: "bg-purple-500" },
  { service: "Google Gemini 1.5 Pro (Audit & GEO)", tokens: "1.4M", cost: 38.20, limit: 150, color: "bg-violet-500" },
  { service: "DataForSEO SERP API (Rankings)", tokens: "84,200 req", cost: 84.10, limit: 200, color: "bg-emerald-500" },
  { service: "Google Search Console / GA4 OAuth", tokens: "1.2M req", cost: 0.00, limit: 0, color: "bg-amber-500" },
];

const tenants = [
  { id: "ws-1", name: "GrowthX Agency HQ", owner: "sudarshan@growthx.in", plan: "Agency", sites: 18, health: 84, quota: 68, status: "active" },
  { id: "ws-2", name: "MilQuu Fresh Dairy", owner: "priya@milquu.com", plan: "Growth", sites: 1, health: 78, quota: 42, status: "active" },
  { id: "ws-3", name: "Apex SEO Partners", owner: "rahul@apexseo.com", plan: "Agency", sites: 24, health: 91, quota: 89, status: "active" },
  { id: "ws-4", name: "ScaleUp Digital Media", owner: "vikram@scaleup.in", plan: "Growth", sites: 4, health: 65, quota: 31, status: "active" },
  { id: "ws-5", name: "Client Demo Account", owner: "demo@client.com", plan: "Starter", sites: 1, health: 0, quota: 5, status: "trial" },
];

export default function AdminPage() {
  const [workersPaused, setWorkersPaused] = useState(false);
  const [retrying, setRetrying] = useState(false);

  const handleRetry = () => {
    setRetrying(true);
    setTimeout(() => setRetrying(false), 1500);
  };

  return (
    <div className="space-y-8">
      {/* Not-live warning — every number and control below is design-mockup data, not a real BullMQ/billing feed. */}
      <div className="flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-600 dark:text-amber-400">
        <AlertTriangle size={16} className="mt-0.5 shrink-0" />
        <div>
          <p className="font-semibold">Design mockup — not connected to any live system</p>
          <p className="mt-0.5 text-xs opacity-90">
            Every metric, queue, cost figure and tenant below is hardcoded sample data. The controls do not affect real
            infrastructure. A real version needs a BullMQ stats endpoint and a tenant-admin API on the backend.
          </p>
        </div>
      </div>

      {/* Page Header */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-full bg-red-500/10 text-red-500 dark:bg-red-500/20 text-xs font-bold uppercase tracking-wider flex items-center gap-1">
              <ShieldAlert size={12} /> Super Admin
            </span>
            <h1 className="text-h1 text-[var(--text-primary)]">System Control Panel (mockup)</h1>
          </div>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Sample layout for BullMQ queues, AI token billing, infrastructure health, and tenant management
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={workersPaused ? "primary" : "secondary"}
            size="sm"
            onClick={() => setWorkersPaused(!workersPaused)}
            icon={workersPaused ? <Play size={13} /> : <Pause size={13} />}
            title="Mockup only — does not pause any real queue"
          >
            {workersPaused ? "Resume Workers (mock)" : "Pause Queues (mock)"}
          </Button>
          <Button variant="outline" size="sm" onClick={handleRetry} loading={retrying} icon={<RefreshCw size={13} />} title="Mockup only — does not retry any real job">
            Retry Failed (mock)
          </Button>
        </div>
      </motion.div>

      {/* 4 Executive Metric Cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="Monthly Recurring Revenue" value="24,800" prefix="$" delta={18.4} deltaLabel="vs last month" icon={<DollarSign size={16} />} delay={0.05} />
        <MetricCard title="Active SaaS Tenants" value={456} delta={7.5} deltaLabel="+32 new this month" icon={<Users size={16} />} delay={0.1} />
        <MetricCard title="BullMQ Jobs Processed" value="142,840" delta={14.2} deltaLabel="today · 99.99% success" icon={<Cpu size={16} />} delay={0.15} />
        <MetricCard title="AI API Cost MTD" value="264.80" prefix="$" delta={-4.2} deltaLabel="52% of $500 cap" icon={<Zap size={16} />} delay={0.2} />
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
              <Badge variant="info">July 2026</Badge>
            </div>
            <div className="text-3xl font-bold gradient-text-brand mb-1">$264.80</div>
            <p className="text-xs text-[var(--text-muted)] mb-6">Total spend across 4 external LLM & SERP APIs</p>

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
              <div className="text-[11px] text-[var(--text-muted)]">Alerts trigger at 80% ($400.00)</div>
            </div>
            <Button variant="outline" size="sm">Adjust Cap</Button>
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
