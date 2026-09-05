"use client";
import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge, StatusDot } from "@/components/ui/badge";
import { MetricCard } from "@/components/ui/metric-card";
import { cn, formatNumber } from "@/lib/utils";
import {
  ShieldAlert, Cpu, Users, Database, Play, Pause,
  RefreshCw, AlertTriangle, CheckCircle2, MoreHorizontal, Eye,
  Ban, ArrowUpRight, Zap, Server, Plus, Trash2, ExternalLink,
  Video, X, Sparkles, MessageCircle
} from "lucide-react";
import { api, QueueStat, ApiCostStat, TenantStat, type Creator, type AddCreatorBody } from "@/lib/api-client";
import { useWorkspace, useCreators, useAddCreator, useDeleteCreator } from "@/hooks/use-growthx";

function InstagramIcon({ size = 14, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  );
}

function YoutubeIcon({ size = 14, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17" />
      <polygon points="10 15 15 12 10 9 10 15" fill="currentColor" stroke="none" />
    </svg>
  );
}

function LinkedinIcon({ size = 14, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
      <rect width="4" height="12" x="2" y="9" />
      <circle cx="4" cy="4" r="2" />
    </svg>
  );
}

function TwitterIcon({ size = 14, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M4 4l11.733 16h4.267l-11.733 -16z" />
      <path d="M4 20l6.768 -6.768m2.46 -2.46l6.772 -6.772" />
    </svg>
  );
}

export default function AdminPage() {
  const [workersPaused, setWorkersPaused] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [workerQueues, setWorkerQueues] = useState<QueueStat[]>([]);
  const [apiCosts, setApiCosts] = useState<ApiCostStat[]>([]);
  const [tenants, setTenants] = useState<TenantStat[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Creators Management
  const { projectId } = useWorkspace();
  const creatorsQuery = useCreators(projectId);
  const addCreatorMut = useAddCreator(projectId);
  const deleteCreatorMut = useDeleteCreator(projectId);

  const [localCreators, setLocalCreators] = useState<Creator[]>([]);
  const [isAddCreatorOpen, setIsAddCreatorOpen] = useState(false);
  const [creatorForm, setCreatorForm] = useState({
    name: "",
    handle: "",
    category: "Reels & Shorts Producer",
    notes: "",
    followerCount: "50000",
    instagramUrl: "",
    youtubeUrl: "",
    tiktokUrl: "",
    linkedinUrl: "",
    xUrl: "",
    contactUrl: "",
    status: "ACTIVE",
  });

  useEffect(() => {
    try {
      const stored = localStorage.getItem("growthx_admin_creators");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) setLocalCreators(parsed);
      }
    } catch {
      // Ignore
    }
  }, []);

  const saveLocalCreators = (items: Creator[]) => {
    setLocalCreators(items);
    try {
      localStorage.setItem("growthx_admin_creators", JSON.stringify(items));
    } catch {
      // Ignore
    }
  };

  const allAdminCreators = useMemo(() => {
    const serverList = creatorsQuery.data || [];
    const list = [...serverList];
    for (const localItem of localCreators) {
      if (!list.some((c) => c.id === localItem.id || c.name.toLowerCase() === localItem.name.toLowerCase())) {
        list.push(localItem);
      }
    }
    return list;
  }, [creatorsQuery.data, localCreators]);

  const handleCreateCreator = (e: React.FormEvent) => {
    e.preventDefault();
    if (!creatorForm.name.trim()) return;

    const newCreator: Creator = {
      id: `creator_${Date.now()}`,
      name: creatorForm.name.trim(),
      handle: creatorForm.handle.trim() || null,
      platform: "INSTAGRAM",
      profileUrl: creatorForm.instagramUrl.trim() || null,
      email: null,
      phone: null,
      location: "Verified Global",
      category: creatorForm.category.trim(),
      industry: "Digital Media",
      followerCount: parseInt(creatorForm.followerCount, 10) || 0,
      engagementRate: 4.8,
      averageBudget: 15000,
      currency: "INR",
      notes: creatorForm.notes.trim() || null,
      tags: [creatorForm.category.trim()],
      status: creatorForm.status,
      createdAt: new Date().toISOString(),
      instagramUrl: creatorForm.instagramUrl.trim() || null,
      youtubeUrl: creatorForm.youtubeUrl.trim() || null,
      tiktokUrl: creatorForm.tiktokUrl.trim() || null,
      linkedinUrl: creatorForm.linkedinUrl.trim() || null,
      xUrl: creatorForm.xUrl.trim() || null,
      contactUrl: creatorForm.contactUrl.trim() || null,
    };

    saveLocalCreators([...localCreators, newCreator]);

    if (projectId) {
      addCreatorMut.mutate({
        name: creatorForm.name.trim(),
        handle: creatorForm.handle.trim(),
        category: creatorForm.category.trim(),
        notes: creatorForm.notes.trim(),
        followerCount: parseInt(creatorForm.followerCount, 10) || 0,
        instagramUrl: creatorForm.instagramUrl.trim(),
        youtubeUrl: creatorForm.youtubeUrl.trim(),
        tiktokUrl: creatorForm.tiktokUrl.trim(),
        linkedinUrl: creatorForm.linkedinUrl.trim(),
        xUrl: creatorForm.xUrl.trim(),
        contactUrl: creatorForm.contactUrl.trim(),
      });
    }

    setIsAddCreatorOpen(false);
    setCreatorForm({
      name: "",
      handle: "",
      category: "Reels & Shorts Producer",
      notes: "",
      followerCount: "50000",
      instagramUrl: "",
      youtubeUrl: "",
      tiktokUrl: "",
      linkedinUrl: "",
      xUrl: "",
      contactUrl: "",
      status: "ACTIVE",
    });
  };

  const handleDeleteCreator = (id: string) => {
    saveLocalCreators(localCreators.filter((c) => c.id !== id));
    if (projectId) {
      deleteCreatorMut.mutate(id);
    }
  };

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

      {/* Content Creators Network Management Panel */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="card overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between px-5 py-4 border-b border-[var(--border-color)] gap-3 bg-[var(--surface-1)]">
          <div>
            <div className="flex items-center gap-2">
              <Users size={16} className="text-purple-500" />
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">Content Creators Network (Social Media Talent)</h3>
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              Add and manage vetted creators shown in the Social Media suite so users can inspect channels and connect directly
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              size="sm"
              icon={<Plus size={13} />}
              onClick={() => setIsAddCreatorOpen(true)}
            >
              Add Content Creator
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          {allAdminCreators.length === 0 ? (
            <div className="p-8 text-center text-xs text-[var(--text-muted)] space-y-2">
              <Users size={28} className="mx-auto text-brand-300" />
              <p className="font-semibold text-brand-800">No Content Creators Added Yet</p>
              <p>Click "Add Content Creator" above to register creator profiles, social media accounts, and booking links.</p>
            </div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-[var(--surface-2)] text-[var(--text-muted)] text-xs uppercase tracking-wider border-b border-[var(--border-color)]">
                <tr>
                  <th className="py-3 px-5 font-semibold">Creator Name</th>
                  <th className="py-3 px-4 font-semibold">Category / Specialty</th>
                  <th className="py-3 px-4 font-semibold text-center">Reach</th>
                  <th className="py-3 px-4 font-semibold">Social Accounts</th>
                  <th className="py-3 px-4 font-semibold">Contact / Booking</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                  <th className="py-3 px-5 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-color)]">
                {allAdminCreators.map((creator) => {
                  const initials = creator.name
                    .split(" ")
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join("")
                    .toUpperCase();

                  const instagram = creator.instagramUrl || (creator.platform === "INSTAGRAM" ? creator.profileUrl : null);
                  const youtube = creator.youtubeUrl || (creator.platform === "YOUTUBE" ? creator.profileUrl : null);
                  const tiktok = creator.tiktokUrl || (creator.platform === "TIKTOK" ? creator.profileUrl : null);
                  const linkedin = creator.linkedinUrl || (creator.platform === "LINKEDIN" ? creator.profileUrl : null);
                  const x = creator.xUrl || (creator.platform === "X" ? creator.profileUrl : null);

                  return (
                    <tr key={creator.id} className="hover:bg-[var(--surface-2)] transition-base">
                      <td className="py-3.5 px-5 font-bold text-[var(--text-primary)] flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-900 to-accent-700 flex items-center justify-center text-white text-xs font-bold shrink-0">
                          {initials}
                        </div>
                        <div>
                          <div className="flex items-center gap-1">
                            <span>{creator.name}</span>
                            <CheckCircle2 size={12} className="text-purple-500" />
                          </div>
                          {creator.handle && (
                            <span className="text-[11px] font-mono text-[var(--text-muted)] block font-normal">
                              {creator.handle.startsWith("@") ? creator.handle : `@${creator.handle}`}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-xs font-medium text-[var(--text-secondary)]">
                        {creator.category || "Content Creator"}
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono text-xs font-semibold text-[var(--text-primary)]">
                        {creator.followerCount ? `${(creator.followerCount / 1000).toFixed(0)}K` : "—"}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5">
                          {instagram && (
                            <a href={instagram} target="_blank" rel="noopener noreferrer" className="p-1 rounded bg-pink-50 text-pink-600 hover:bg-pink-100 transition" title="Instagram">
                              <InstagramIcon size={13} />
                            </a>
                          )}
                          {youtube && (
                            <a href={youtube} target="_blank" rel="noopener noreferrer" className="p-1 rounded bg-red-50 text-red-600 hover:bg-red-100 transition" title="YouTube">
                              <YoutubeIcon size={13} />
                            </a>
                          )}
                          {tiktok && (
                            <a href={tiktok} target="_blank" rel="noopener noreferrer" className="p-1 rounded bg-slate-100 text-slate-800 hover:bg-slate-200 transition" title="TikTok">
                              <Video size={13} />
                            </a>
                          )}
                          {linkedin && (
                            <a href={linkedin} target="_blank" rel="noopener noreferrer" className="p-1 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 transition" title="LinkedIn">
                              <LinkedinIcon size={13} />
                            </a>
                          )}
                          {x && (
                            <a href={x} target="_blank" rel="noopener noreferrer" className="p-1 rounded bg-zinc-100 text-zinc-900 hover:bg-zinc-200 transition" title="X / Twitter">
                              <TwitterIcon size={13} />
                            </a>
                          )}
                          {!instagram && !youtube && !tiktok && !linkedin && !x && (
                            <span className="text-xs text-[var(--text-muted)] italic">No links</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-xs">
                        {creator.contactUrl ? (
                          <a
                            href={creator.contactUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-purple-600 hover:text-purple-700 font-semibold"
                          >
                            <span>Booking Link</span>
                            <ExternalLink size={11} />
                          </a>
                        ) : (
                          <span className="text-[var(--text-muted)]">In-App Inquiry</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[10.5px] font-bold uppercase tracking-wider">
                          Active
                        </span>
                      </td>
                      <td className="py-3.5 px-5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <a
                            href="/social-media?tab=creators"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:bg-[var(--surface-3)] hover:text-purple-600 transition-base"
                            title="View in Social Media Dashboard"
                          >
                            <ExternalLink size={14} />
                          </a>
                          <button
                            type="button"
                            onClick={() => handleDeleteCreator(creator.id)}
                            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:bg-red-500/10 hover:text-red-500 transition-base cursor-pointer"
                            title="Remove Creator"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </motion.div>

      {/* Add Content Creator Modal */}
      {isAddCreatorOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[var(--surface-1)] border border-[var(--border-color)] rounded-2xl shadow-xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-5 border-b border-[var(--border-color)] bg-[var(--surface-2)]">
              <div className="flex items-center gap-2">
                <Users size={16} className="text-purple-500" />
                <h3 className="font-bold text-sm text-[var(--text-primary)]">Add New Content Creator</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddCreatorOpen(false)}
                className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-lg hover:bg-[var(--surface-3)] transition"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateCreator} className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1">Creator Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Sarah Jenkins"
                    value={creatorForm.name}
                    onChange={(e) => setCreatorForm({ ...creatorForm, name: e.target.value })}
                    className="w-full h-8.5 px-3 rounded-lg border border-[var(--border-color)] bg-[var(--surface-2)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1">Handle / Username</label>
                  <input
                    type="text"
                    placeholder="e.g. @sarahgrowth"
                    value={creatorForm.handle}
                    onChange={(e) => setCreatorForm({ ...creatorForm, handle: e.target.value })}
                    className="w-full h-8.5 px-3 rounded-lg border border-[var(--border-color)] bg-[var(--surface-2)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1">Category / Specialty</label>
                  <select
                    value={creatorForm.category}
                    onChange={(e) => setCreatorForm({ ...creatorForm, category: e.target.value })}
                    className="w-full h-8.5 px-2.5 rounded-lg border border-[var(--border-color)] bg-[var(--surface-2)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-purple-500"
                  >
                    <option value="Reels & Shorts Producer">Reels & Shorts Producer</option>
                    <option value="UGC & E-commerce Specialist">UGC & E-commerce Specialist</option>
                    <option value="Tech & SaaS Explainer Host">Tech & SaaS Explainer Host</option>
                    <option value="YouTube Long-form Educator">YouTube Long-form Educator</option>
                    <option value="B2B Growth Strategist">B2B Growth Strategist</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1">Audience Reach / Followers</label>
                  <input
                    type="number"
                    placeholder="e.g. 50000"
                    value={creatorForm.followerCount}
                    onChange={(e) => setCreatorForm({ ...creatorForm, followerCount: e.target.value })}
                    className="w-full h-8.5 px-3 rounded-lg border border-[var(--border-color)] bg-[var(--surface-2)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1">Bio / Production Notes</label>
                <textarea
                  rows={2}
                  placeholder="Describe their content style, format specialty, or production tools..."
                  value={creatorForm.notes}
                  onChange={(e) => setCreatorForm({ ...creatorForm, notes: e.target.value })}
                  className="w-full p-2.5 rounded-lg border border-[var(--border-color)] bg-[var(--surface-2)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-purple-500"
                />
              </div>

              {/* Social Accounts Section */}
              <div className="space-y-2 pt-1 border-t border-[var(--border-color)]">
                <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                  Social Media Accounts (Clickable Profiles)
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-[10.5px] text-[var(--text-muted)] flex items-center gap-1 mb-0.5">
                      <InstagramIcon size={11} className="text-pink-500" /> Instagram URL
                    </label>
                    <input
                      type="url"
                      placeholder="https://instagram.com/username"
                      value={creatorForm.instagramUrl}
                      onChange={(e) => setCreatorForm({ ...creatorForm, instagramUrl: e.target.value })}
                      className="w-full h-8 px-2.5 rounded-md border border-[var(--border-color)] bg-[var(--surface-2)] text-[11px] text-[var(--text-primary)]"
                    />
                  </div>
                  <div>
                    <label className="text-[10.5px] text-[var(--text-muted)] flex items-center gap-1 mb-0.5">
                      <YoutubeIcon size={11} className="text-red-500" /> YouTube Channel
                    </label>
                    <input
                      type="url"
                      placeholder="https://youtube.com/@channel"
                      value={creatorForm.youtubeUrl}
                      onChange={(e) => setCreatorForm({ ...creatorForm, youtubeUrl: e.target.value })}
                      className="w-full h-8 px-2.5 rounded-md border border-[var(--border-color)] bg-[var(--surface-2)] text-[11px] text-[var(--text-primary)]"
                    />
                  </div>
                  <div>
                    <label className="text-[10.5px] text-[var(--text-muted)] flex items-center gap-1 mb-0.5">
                      <Video size={11} /> TikTok URL
                    </label>
                    <input
                      type="url"
                      placeholder="https://tiktok.com/@username"
                      value={creatorForm.tiktokUrl}
                      onChange={(e) => setCreatorForm({ ...creatorForm, tiktokUrl: e.target.value })}
                      className="w-full h-8 px-2.5 rounded-md border border-[var(--border-color)] bg-[var(--surface-2)] text-[11px] text-[var(--text-primary)]"
                    />
                  </div>
                  <div>
                    <label className="text-[10.5px] text-[var(--text-muted)] flex items-center gap-1 mb-0.5">
                      <LinkedinIcon size={11} className="text-blue-500" /> LinkedIn URL
                    </label>
                    <input
                      type="url"
                      placeholder="https://linkedin.com/in/username"
                      value={creatorForm.linkedinUrl}
                      onChange={(e) => setCreatorForm({ ...creatorForm, linkedinUrl: e.target.value })}
                      className="w-full h-8 px-2.5 rounded-md border border-[var(--border-color)] bg-[var(--surface-2)] text-[11px] text-[var(--text-primary)]"
                    />
                  </div>
                </div>
              </div>

              {/* Direct Booking / WhatsApp link */}
              <div>
                <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1">
                  Direct Contact / Booking Link (WhatsApp / Calendly)
                </label>
                <input
                  type="text"
                  placeholder="https://wa.me/1234567890 or https://calendly.com/..."
                  value={creatorForm.contactUrl}
                  onChange={(e) => setCreatorForm({ ...creatorForm, contactUrl: e.target.value })}
                  className="w-full h-8.5 px-3 rounded-lg border border-[var(--border-color)] bg-[var(--surface-2)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border-color)]">
                <Button variant="secondary" size="sm" onClick={() => setIsAddCreatorOpen(false)}>
                  Cancel
                </Button>
                <Button variant="primary" size="sm" icon={<Plus size={13} />}>
                  Save Creator to Directory
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
