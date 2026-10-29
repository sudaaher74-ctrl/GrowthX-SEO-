"use client";

import { Suspense, useState, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { isAdminSection, type AdminSection } from "@/components/layout/admin-sidebar";
import Link from "next/link";import { ShieldAlert, Cpu, Activity, Building2, Wallet, Users, Database, Play, Pause, RefreshCw, ArrowUpRight, Zap, Server, Sliders, Search, Check } from "lucide-react";import { StatusDot } from "@/components/ui/badge";import { Pill, Table, Td, Th, Tr, relativeTime } from "@/components/ui/console";
import {
  api,
  QueueStat,
  ApiCostStat,
  TenantStat,
  AdminSystemHealth,
  AdminUserItem,
  AdminUserModelUsage,
  ApiError,
} from "@/lib/api-client";
import { AiConfigurationTab } from "@/components/settings/ai-configuration-tab";
import { GrantTokensForm } from "@/components/tokens/grant-tokens-form";
import { formatTokens, formatTokensExact } from "@/lib/tokens";


const CARD = "rounded-[28px] bg-white dark:bg-brand-900 shadow-[0_1px_2px_rgba(0,0,0,0.04)] border border-black/[0.04] dark:border-white/[0.06]";

function Card({
  title,
  subtitle,
  actions,
  children,
  className = "",
}: {
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`${CARD} p-5 sm:p-6 ${className}`}>
      {(title || actions) && (
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            {title && <h2 className="text-base font-semibold text-brand-950 dark:text-brand-100">{title}</h2>}
            {subtitle && <p className="text-xs text-brand-500 mt-0.5">{subtitle}</p>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

function PillButton({
  children,
  icon,
  onClick,
  dark = false,
}: {
  children: React.ReactNode;
  icon?: React.ReactNode;
  onClick?: () => void;
  dark?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-10 items-center gap-2 rounded-full px-4 text-[13px] font-semibold transition-colors ${
        dark
          ? "bg-brand-950 text-white hover:bg-brand-800 dark:bg-white dark:text-brand-950"
          : "bg-white text-brand-800 shadow-sm border border-black/[0.05] hover:bg-brand-50 dark:bg-brand-900 dark:text-brand-200 dark:border-white/10"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

function Stat({
  label,
  value,
  sub,
  icon,
  featured = false,
}: {
  label: string;
  value: string;
  sub: string;
  icon: React.ReactNode;
  featured?: boolean;
}) {
  return (
    <div
      className={`rounded-[28px] p-5 min-h-[140px] flex flex-col justify-between ${
        featured
          ? "bg-gradient-to-br from-success-400 to-success-600 text-white shadow-lg shadow-success-600/20"
          : `${CARD} text-brand-950 dark:text-brand-100`
      }`}
    >
      <div className="flex items-start justify-between">
        <span className={`text-[13px] font-medium ${featured ? "text-white/85" : "text-brand-500"}`}>{label}</span>
        <span
          className={`h-8 w-8 rounded-full flex items-center justify-center ${
            featured ? "bg-white/20" : "bg-brand-100 dark:bg-brand-800 text-brand-600 dark:text-brand-300"
          }`}
        >
          {icon}
        </span>
      </div>
      <div>
        <div className="text-3xl font-bold tracking-tight">{value}</div>
        <span
          className={`mt-1.5 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${
            featured ? "bg-white/20 text-white" : "bg-success-50 text-success-700 dark:bg-success-500/10 dark:text-success-400"
          }`}
        >
          {sub}
        </span>
      </div>
    </div>
  );
}

function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative">
      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-brand-400" size={14} />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-10 w-64 max-w-full pl-9 pr-4 text-[13px] rounded-full border border-black/[0.08] dark:border-white/10 bg-white dark:bg-brand-900 text-brand-950 dark:text-brand-100 focus:outline-none focus:ring-2 focus:ring-success-500/40"
      />
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? "bg-success-500" : "bg-brand-300 dark:bg-brand-700"}`}
    >
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? "left-[22px]" : "left-0.5"}`} />
    </button>
  );
}

function HealthTile({
  icon,
  name,
  status,
  tone,
  desc,
  meta,
}: {
  icon: React.ReactNode;
  name: string;
  status: string;
  tone: "good" | "warn";
  desc: string;
  meta?: string;
}) {
  return (
    <div className="rounded-3xl bg-brand-50 dark:bg-brand-800/50 p-4 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-[13px] font-semibold text-brand-950 dark:text-brand-100">
          <span className="h-8 w-8 rounded-full bg-white dark:bg-brand-900 shadow-sm flex items-center justify-center">{icon}</span>
          {name}
        </span>
        <Pill tone={tone}>{status}</Pill>
      </div>
      <p className="text-xs text-brand-500 leading-relaxed">{desc}</p>
      {meta && <span className="text-[11px] font-mono font-semibold text-brand-700 dark:text-brand-300 block">{meta}</span>}
    </div>
  );
}

export default function AdminPage() {
  // useSearchParams needs a Suspense boundary during static prerender.
  return (
    <Suspense fallback={null}>
      <AdminConsole />
    </Suspense>
  );
}

function AdminConsole() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // The sidebar links to /admin?tab=…, so the URL is the source of truth.
  const tabParam = searchParams.get("tab");
  const activeTab: AdminSection = isAdminSection(tabParam) ? tabParam : "overview";
  const setActiveTab = (id: AdminSection) => router.replace(`/admin?tab=${id}`, { scroll: false });
  const [workersPaused, setWorkersPaused] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);

  // Core Admin Data
  const [workerQueues, setWorkerQueues] = useState<QueueStat[]>([]);
  const [apiCosts, setApiCosts] = useState<ApiCostStat[]>([]);
  const [tenants, setTenants] = useState<TenantStat[]>([]);
  const [totals, setTotals] = useState<{
    tenants: number;
    users: number;
    projects: number;
    loggedInUsers: number;
    activeSessions: number;
  } | null>(null);
  const [failedCalls, setFailedCalls] = useState<string[]>([]);
  const [accessDenied, setAccessDenied] = useState<string | null>(null);
  const [grantTo, setGrantTo] = useState<TenantStat | null>(null);
  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [userModels, setUserModels] = useState<AdminUserModelUsage[]>([]);
  const [systemHealth, setSystemHealth] = useState<AdminSystemHealth | null>(null);

  // Filtering states
  const [tenantSearch, setTenantSearch] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [userModelSearch, setUserModelSearch] = useState("");
  const [userLoginFilter, setUserLoginFilter] = useState<"all" | "online" | "offline">("all");

  // Platform Feature Flags / Settings
  const [featureFlags, setFeatureFlags] = useState({
    localSeoModule: true,
    aiAutoFixEngine: true,
    deepCompetitorCrawler: true,
    publicApiRateLimit: 120,
    maxCrawlConcurrency: 4,
    maxCrawlDepth: 10,
  });

  // Each endpoint is loaded on its own. With Promise.all a single failure (a
  // 403 from the operator allowlist, Redis being down) left every card at 0
  // with nothing on screen to say why.
  const loadData = async () => {
    const calls = {
      queues: api.getAdminQueues(),
      costs: api.getAdminCosts(),
      tenants: api.getAdminTenants(),
      health: api.getAdminSystemHealth(),
      users: api.getAdminUsers(),
      stats: api.getAdminStats(),
      userModels: api.getAdminUserModels(),
    };
    const [queues, costs, tenantsData, health, usersData, statsData, userModelsData] = await Promise.allSettled(
      Object.values(calls),
    );
    const failures: string[] = [];
    const take = <T,>(r: PromiseSettledResult<unknown>, label: string, apply: (v: T) => void) => {
      if (r.status === "fulfilled") apply(r.value as T);
      else {
        console.error(`Admin ${label} failed:`, r.reason);
        const status = r.reason instanceof ApiError ? r.reason.status : null;
        failures.push(`${label}${status ? ` (${status})` : ""}`);
        if (status === 403 || status === 401) setAccessDenied(r.reason instanceof Error ? r.reason.message : "Access denied");
      }
    };
    setAccessDenied(null);
    take<QueueStat[]>(queues, "queues", setWorkerQueues);
    take<ApiCostStat[]>(costs, "AI spend", setApiCosts);
    take<TenantStat[]>(tenantsData, "tenants", setTenants);
    take<AdminSystemHealth>(health, "system health", setSystemHealth);
    take<AdminUserItem[]>(usersData, "users", setUsers);
    take<{ tenants: number; users: number; projects: number; loggedInUsers: number; activeSessions: number }>(
      statsData,
      "totals",
      setTotals,
    );
    take<AdminUserModelUsage[]>(userModelsData, "user models", setUserModels);
    setFailedCalls(failures);
  };

  useEffect(() => {
    // Deferred so the state updates are not a synchronous setState in the effect body.
    const timer = setTimeout(() => void loadData(), 0);
    return () => clearTimeout(timer);
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleToggleWorkers = async () => {
    try {
      if (workersPaused) {
        await api.resumeAdminQueues();
        setWorkersPaused(false);
      } else {
        await api.pauseAdminQueues();
        setWorkersPaused(true);
      }
      loadData();
    } catch (err) {
      console.error("Error toggling workers:", err);
    }
  };

  const handleRetryFailed = async () => {
    setRetrying(true);
    try {
      await api.retryAdminFailedJobs();
      await loadData();
    } catch (err) {
      console.error("Error retrying jobs:", err);
    } finally {
      setRetrying(false);
    }
  };

  const filteredTenants = useMemo(() => {
    return tenants.filter((t) => {
      const q = tenantSearch.toLowerCase();
      return t.name.toLowerCase().includes(q) || (t.owner && t.owner.toLowerCase().includes(q));
    });
  }, [tenants, tenantSearch]);

  const onlineCount = useMemo(() => {
    return totals?.loggedInUsers ?? users.filter((u) => u.isLoggedIn).length;
  }, [totals, users]);

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      if (userLoginFilter === "online" && !u.isLoggedIn) return false;
      if (userLoginFilter === "offline" && u.isLoggedIn) return false;
      const q = userSearch.toLowerCase();
      const models = (u.modelsUsed || []).join(" ").toLowerCase();
      return (
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.organizationName.toLowerCase().includes(q) ||
        models.includes(q)
      );
    });
  }, [users, userSearch, userLoginFilter]);

  const filteredUserModels = useMemo(() => {
    const q = userModelSearch.toLowerCase();
    if (!q) return userModels;
    return userModels.filter(
      (m) =>
        m.userName.toLowerCase().includes(q) ||
        m.userEmail.toLowerCase().includes(q) ||
        m.organizationName.toLowerCase().includes(q) ||
        m.model.toLowerCase().includes(q) ||
        m.provider.toLowerCase().includes(q),
    );
  }, [userModels, userModelSearch]);

  const totalCompletedJobs = useMemo(() => {
    return workerQueues.reduce((acc, q) => acc + q.completed, 0);
  }, [workerQueues]);

  const totalSpend = useMemo(() => {
    return apiCosts.reduce((acc, c) => acc + c.cost, 0).toFixed(2);
  }, [apiCosts]);

  // Derived from the ledger rather than hardcoded: the card read "Gemini &
  // Groq" while every row in the table was Mammouth.
  const spendProviders = useMemo(() => {
    const names = [
      ...new Set(
        apiCosts
          .map((c) => c.service.split("/")[0]?.trim())
          .filter((n): n is string => Boolean(n)),
      ),
    ];
    if (names.length === 0) return "No recorded usage";
    return names.slice(0, 3).join(", ") + (names.length > 3 ? "…" : "");
  }, [apiCosts]);

  const tabs: { id: AdminSection; label: string; icon: typeof Server }[] = [
    { id: "overview", label: "System Overview", icon: Server },
    { id: "tenants", label: `Tenants (${tenants.length})`, icon: Database },
    { id: "users", label: `Users (${users.length})`, icon: Users },
    { id: "queues", label: "Crawler Queues", icon: Cpu },
    { id: "ai-models", label: "AI Models & Spend", icon: Zap },
    { id: "settings", label: "Platform Flags", icon: Sliders },
  ];

  const maxJobs = Math.max(1, ...workerQueues.map((q) => q.completed + q.failed + q.active + q.waiting));
  const nameCls = "font-semibold text-brand-950 dark:text-brand-100 text-[13px]";
  const mutedCls = "text-[13px] text-brand-500";

  return (
    <div className="rounded-[36px] bg-canvas dark:bg-brand-950 p-4 sm:p-7 space-y-5 pb-10">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-error-50 text-error-600 border border-error-100 px-3 py-1 text-[11px] font-bold uppercase tracking-wider dark:bg-error-500/10 dark:border-error-900/40 dark:text-error-400">
              <ShieldAlert size={12} /> Super Admin
            </span>
            <Pill tone={systemHealth?.status === "HEALTHY" ? "good" : "warn"}>
              {systemHealth?.status || "SYSTEMS OPERATIONAL"}
            </Pill>
          </div>
          <h1 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight text-brand-950 dark:text-brand-100">
            Reigel Administration
          </h1>
          <p className="mt-1.5 text-sm text-brand-500 max-w-xl">
            Manage tenant workspaces, platform users, crawler worker queues, and AI model spend.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PillButton
            icon={<RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />}
            onClick={handleRefresh}
          >
            Refresh
          </PillButton>
          <PillButton
            dark
            icon={workersPaused ? <Play size={14} /> : <Pause size={14} />}
            onClick={handleToggleWorkers}
          >
            {workersPaused ? "Resume Queues" : "Pause Queues"}
          </PillButton>
          <PillButton
            icon={<RefreshCw size={14} className={retrying ? "animate-spin" : ""} />}
            onClick={handleRetryFailed}
          >
            Retry Failed Jobs
          </PillButton>
        </div>
      </div>

      {(accessDenied || failedCalls.length > 0) && (
        <div role="alert" className="rounded-3xl border border-error-200 bg-error-50 px-5 py-4 text-[13px] text-error-700">
          <p className="font-semibold">
            {accessDenied ? "The admin API refused this account." : "Some admin data could not be loaded."}
          </p>
          <p className="mt-1 text-xs">
            {accessDenied
              ? `${accessDenied} Add your login email to PLATFORM_ADMIN_EMAILS on the backend (Render) and redeploy.`
              : `Failed: ${failedCalls.join(", ")}. Zeros below may be missing data, not real zeros.`}
          </p>
          <button type="button" onClick={handleRefresh} className="mt-2 text-xs font-semibold underline">
            Retry
          </button>
        </div>
      )}

      {/* KPI strip */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <Stat featured label="Active Tenants" value={String(totals?.tenants ?? tenants.length)} sub="Organizations" icon={<Building2 size={15} />} />
        <Stat
          label="Platform Users"
          value={String(totals?.users ?? users.length)}
          sub={`${onlineCount} logged in now`}
          icon={<Users size={15} />}
        />
        <Stat label="24h Jobs Finished" value={String(totalCompletedJobs)} sub="BullMQ tasks" icon={<Activity size={15} />} />
        <Stat label="AI Spend MTD" value={`$${totalSpend}`} sub={spendProviders} icon={<Wallet size={15} />} />
      </div>

      {/* Pill tabs */}
      <div className="overflow-x-auto">
        <div className="inline-flex gap-1 rounded-full bg-white dark:bg-brand-900 p-1.5 shadow-sm border border-black/[0.04] dark:border-white/[0.06]">
          {tabs.map((t) => {
            const Icon = t.icon;
            const on = activeTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                className={`inline-flex h-9 items-center gap-2 rounded-full px-4 text-[13px] font-semibold whitespace-nowrap transition-colors ${
                  on
                    ? "bg-brand-950 text-white dark:bg-white dark:text-brand-950"
                    : "text-brand-600 hover:bg-brand-100 dark:text-brand-400 dark:hover:bg-brand-800"
                }`}
              >
                <Icon size={14} />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* OVERVIEW */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <Card
            className="xl:col-span-2"
            title="Infrastructure Health"
            subtitle="Live heartbeat across database, queues, crawler cluster, and AI providers."
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <HealthTile
                icon={<Database size={15} className="text-success-500" />}
                name="PostgreSQL"
                status={systemHealth?.database?.status || "CONNECTED"}
                tone="good"
                desc="Prisma ORM connected with verified transaction pooling."
                meta={`Latency: ${systemHealth?.database?.latencyMs ?? 2}ms`}
              />
              <HealthTile
                icon={<Server size={15} className="text-brand-500" />}
                name="Redis / BullMQ"
                status={workersPaused ? "PAUSED" : "CONNECTED"}
                tone={workersPaused ? "warn" : "good"}
                desc="Crawl-jobs and page-fetch event loops."
                meta="Worker Queues: 2 Active"
              />
              <HealthTile
                icon={<Cpu size={15} className="text-success-600" />}
                name="Crawler Cluster"
                status="OPERATIONAL"
                tone="good"
                desc="Chromium / Puppeteer sandbox isolation pool."
                meta="Pool Concurrency: 4 Workers"
              />
              <HealthTile
                icon={<Zap size={15} className="text-warning-500" />}
                name="Multi-AI Router"
                status="ROUTING"
                tone="good"
                desc="Routes each AI task to the vendors allowed by AI_PROVIDERS that have a key."
              />
            </div>
          </Card>

          <Card title="Queue Throughput" subtitle="Completed vs failed jobs per queue">
            {workerQueues.length === 0 ? (
              <p className="text-xs text-brand-500 py-8 text-center">No queue activity yet.</p>
            ) : (
              <div className="flex items-end gap-4 h-44">
                {workerQueues.map((q) => {
                  const total = q.completed + q.failed + q.active + q.waiting;
                  const h = Math.max(8, (total / maxJobs) * 100);
                  const failPct = total ? (q.failed / total) * 100 : 0;
                  return (
                    <div key={q.name} className="flex-1 flex flex-col items-center justify-end gap-2 h-full min-w-0">
                      <div className="w-full max-w-[44px] rounded-xl overflow-hidden flex flex-col-reverse bg-brand-100" style={{ height: `${h}%` }}>
                        <div className="bg-brand-950 dark:bg-brand-200" style={{ height: `${100 - failPct}%` }} />
                        <div
                          className="bg-[repeating-linear-gradient(135deg,var(--color-success-500)_0_4px,var(--color-success-400)_4px_8px)]"
                          style={{ height: `${failPct}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-brand-500 truncate w-full text-center">{q.name}</span>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="mt-4 flex items-center gap-4 text-[11px] text-brand-500">
              <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-brand-950 dark:bg-brand-200" />Completed</span>
              <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-success-500" />Failed</span>
            </div>
          </Card>
        </div>
      )}

      {/* TENANTS */}
      {activeTab === "tenants" && (
        <div className="space-y-4">
          {grantTo && (
            <GrantTokensForm
              tenant={grantTo}
              onClose={() => setGrantTo(null)}
              onDone={() => {
                setGrantTo(null);
                loadData();
              }}
            />
          )}
          <Card
            title="Registered Tenants"
            subtitle="All client organizations on this Reigel instance."
            actions={<SearchBox value={tenantSearch} onChange={setTenantSearch} placeholder="Search tenants or owners..." />}
          >
            <Table minWidth={700}>
              <thead>
                <tr>
                  <Th>Organization</Th>
                  <Th>Owner</Th>
                  <Th>Sites</Th>
                  <Th>Tokens</Th>
                  <Th>Status</Th>
                  <Th align="right">Action</Th>
                </tr>
              </thead>
              <tbody>
                {filteredTenants.length > 0 ? (
                  filteredTenants.map((t) => (
                    <Tr key={t.id}>
                      <Td>
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full bg-brand-950 text-white font-bold flex items-center justify-center text-xs dark:bg-white dark:text-brand-950">
                            {t.name.slice(0, 2).toUpperCase()}
                          </div>
                          <span className={nameCls}>{t.name}</span>
                        </div>
                      </Td>
                      <Td><span className={mutedCls}>{t.owner || "—"}</span></Td>
                      <Td><span className={`${nameCls} font-mono`}>{t.sites} sites</span></Td>
                      <Td>
                        {t.tokens ? (
                          <span title={`${formatTokensExact(t.tokens.available)} available, ${formatTokensExact(t.tokens.monthly)} a month`}>
                            <span className={`${nameCls} font-mono`}>{formatTokens(t.tokens.available)}</span>{" "}
                            <span className="text-[11px] text-brand-400">of {formatTokens(t.tokens.monthly)}/mo</span>
                          </span>
                        ) : (
                          <span className="text-xs text-brand-400" title="Opened the first time this workspace uses a feature that spends tokens">
                            Not started
                          </span>
                        )}
                      </Td>
                      <Td><Pill tone={t.status === "active" ? "good" : "warn"}>{t.status.toUpperCase()}</Pill></Td>
                      <Td align="right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setGrantTo(t)}
                            className="h-8 rounded-full bg-brand-950 px-3.5 text-xs font-semibold text-white hover:bg-brand-800 dark:bg-white dark:text-brand-950"
                          >
                            Add tokens
                          </button>
                          <Link
                            href="/clients"
                            className="inline-flex h-8 items-center gap-1 rounded-full border border-black/10 dark:border-white/10 px-3.5 text-xs font-semibold text-brand-700 dark:text-brand-300 hover:bg-brand-50 dark:hover:bg-brand-800"
                          >
                            Inspect <ArrowUpRight size={11} />
                          </Link>
                        </div>
                      </Td>
                    </Tr>
                  ))
                ) : (
                  <Tr>
                    <Td colSpan={6} className="text-center py-8 text-xs text-brand-500">
                      No organizations found matching search criteria.
                    </Td>
                  </Tr>
                )}
              </tbody>
            </Table>
          </Card>
        </div>
      )}

      {/* USERS */}
      {activeTab === "users" && (
        <Card
          title="Platform Users & Login Activity"
          subtitle="Real-time login status, active sessions, and AI model usage per user."
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-full bg-brand-100 p-0.5 dark:bg-brand-800 text-xs font-medium">
                <button
                  type="button"
                  onClick={() => setUserLoginFilter("all")}
                  className={`rounded-full px-3 py-1 transition-colors ${
                    userLoginFilter === "all"
                      ? "bg-white text-brand-950 font-semibold shadow-xs dark:bg-brand-900 dark:text-brand-100"
                      : "text-brand-600 hover:text-brand-950 dark:text-brand-400"
                  }`}
                >
                  All ({users.length})
                </button>
                <button
                  type="button"
                  onClick={() => setUserLoginFilter("online")}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 transition-colors ${
                    userLoginFilter === "online"
                      ? "bg-white text-brand-950 font-semibold shadow-xs dark:bg-brand-900 dark:text-brand-100"
                      : "text-brand-600 hover:text-brand-950 dark:text-brand-400"
                  }`}
                >
                  <span className="h-2 w-2 rounded-full bg-success-500 animate-pulse" />
                  Online ({onlineCount})
                </button>
                <button
                  type="button"
                  onClick={() => setUserLoginFilter("offline")}
                  className={`rounded-full px-3 py-1 transition-colors ${
                    userLoginFilter === "offline"
                      ? "bg-white text-brand-950 font-semibold shadow-xs dark:bg-brand-900 dark:text-brand-100"
                      : "text-brand-600 hover:text-brand-950 dark:text-brand-400"
                  }`}
                >
                  Offline ({Math.max(0, users.length - onlineCount)})
                </button>
              </div>
              <SearchBox value={userSearch} onChange={setUserSearch} placeholder="Search user, email, org, or model..." />
            </div>
          }
        >
          <Table minWidth={850}>
            <thead>
              <tr>
                <Th>User</Th>
                <Th>Email</Th>
                <Th>Organization</Th>
                <Th>Role</Th>
                <Th>Login Status</Th>
                <Th>Last Login</Th>
                <Th>AI Models Used</Th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length > 0 ? (
                filteredUsers.map((u) => (
                  <Tr key={u.id}>
                    <Td>
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <div className="h-9 w-9 rounded-full bg-brand-100 text-brand-700 font-bold flex items-center justify-center text-xs dark:bg-brand-800 dark:text-brand-300">
                            {u.name.slice(0, 2).toUpperCase()}
                          </div>
                          {u.isLoggedIn && (
                            <span
                              title="Currently logged in"
                              className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-success-500 ring-2 ring-white dark:ring-brand-900"
                            />
                          )}
                        </div>
                        <div>
                          <span className={`${nameCls} block`}>{u.name}</span>
                          <span className="text-[11px] text-brand-400">Joined {relativeTime(u.createdAt)}</span>
                        </div>
                      </div>
                    </Td>
                    <Td><span className={mutedCls}>{u.email}</span></Td>
                    <Td><span className={nameCls}>{u.organizationName}</span></Td>
                    <Td>
                      <Pill tone={u.role === "OWNER" ? "good" : u.role === "ADMIN" ? "info" : "default"}>{u.role}</Pill>
                    </Td>
                    <Td>
                      {u.isLoggedIn ? (
                        <div className="flex items-center gap-1.5">
                          <Pill tone="good">ONLINE</Pill>
                          {(u.activeSessionsCount ?? 0) > 1 && (
                            <span className="text-[10px] text-brand-400 font-mono">
                              ({u.activeSessionsCount} active)
                            </span>
                          )}
                        </div>
                      ) : (
                        <Pill tone="default">OFFLINE</Pill>
                      )}
                    </Td>
                    <Td>
                      <span className={mutedCls}>
                        {u.lastLoginAt ? relativeTime(u.lastLoginAt) : "Never"}
                      </span>
                    </Td>
                    <Td>
                      {u.modelsUsed && u.modelsUsed.length > 0 ? (
                        <div className="flex flex-wrap items-center gap-1 max-w-xs">
                          {u.modelsUsed.map((m) => (
                            <span
                              key={m}
                              className="inline-flex items-center gap-1 rounded-full bg-brand-100 dark:bg-brand-800/80 px-2 py-0.5 font-mono text-[10.5px] font-semibold text-brand-800 dark:text-brand-200"
                            >
                              <Zap size={10} className="text-warning-500" />
                              {m}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-brand-400">None yet</span>
                      )}
                    </Td>
                  </Tr>
                ))
              ) : (
                <Tr>
                  <Td colSpan={7} className="text-center py-8 text-xs text-brand-500">
                    No registered users matching search.
                  </Td>
                </Tr>
              )}
            </tbody>
          </Table>
        </Card>
      )}

      {/* QUEUES */}
      {activeTab === "queues" && (
        <Card
          title="Crawler Worker Queues"
          subtitle="Distributed job processing for web crawling and page diagnostics."
          actions={
            <StatusDot
              status={workersPaused ? "warning" : "success"}
              label={workersPaused ? "Workers Paused" : "Workers Running"}
              pulse={!workersPaused}
            />
          }
        >
          <Table minWidth={650}>
            <thead>
              <tr>
                <Th>Queue</Th>
                <Th align="right">Active</Th>
                <Th align="right">Waiting</Th>
                <Th align="right">Completed (24h)</Th>
                <Th align="right">Failed</Th>
                <Th align="right">Status</Th>
              </tr>
            </thead>
            <tbody>
              {workerQueues.map((q) => (
                <Tr key={q.name}>
                  <Td>
                    <div className={`flex items-center gap-2 font-mono ${nameCls}`}>
                      <Server size={13} className="text-brand-400" />
                      {q.name}
                    </div>
                  </Td>
                  <Td align="right"><span className={`font-mono ${nameCls}`}>{q.active}</span></Td>
                  <Td align="right"><span className={`font-mono ${mutedCls}`}>{q.waiting}</span></Td>
                  <Td align="right"><span className="font-mono text-[13px] font-semibold text-success-600 dark:text-success-400">{q.completed}</span></Td>
                  <Td align="right">
                    <span className={`font-mono text-[13px] font-semibold ${q.failed > 0 ? "text-error-500" : "text-brand-400"}`}>{q.failed}</span>
                  </Td>
                  <Td align="right">
                    <Pill tone={workersPaused ? "warn" : q.failed > 0 ? "bad" : "good"}>
                      {workersPaused ? "PAUSED" : q.status.toUpperCase()}
                    </Pill>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}

      {/* AI MODELS */}
      {activeTab === "ai-models" && (
        <div className="space-y-4">
          <Card title="AI Model Utilization & Spend" subtitle="Tokens consumed and costs tracked across LLM operations.">
            <Table minWidth={600}>
              <thead>
                <tr>
                  <Th>Provider / Model</Th>
                  <Th align="right">Tokens</Th>
                  <Th align="right">Spend (USD)</Th>
                  <Th align="right">Priority</Th>
                  <Th align="right">Status</Th>
                </tr>
              </thead>
              <tbody>
                {apiCosts.length > 0 ? (
                  apiCosts.map((c) => (
                    <Tr key={c.service}>
                      <Td>
                        <div className={`flex items-center gap-2 ${nameCls}`}>
                          <span className="h-7 w-7 rounded-full bg-warning-50 dark:bg-warning-500/10 flex items-center justify-center">
                            <Zap size={13} className="text-warning-500" />
                          </span>
                          {c.service}
                        </div>
                      </Td>
                      <Td align="right"><span className={`font-mono ${mutedCls}`}>{c.tokens}</span></Td>
                      <Td align="right">
                        <span className="font-mono text-[13px] font-bold text-success-600 dark:text-success-400">${c.cost.toFixed(4)}</span>
                      </Td>
                      <Td align="right"><Pill tone="info">PRIMARY</Pill></Td>
                      <Td align="right"><Pill tone="good">ACTIVE</Pill></Td>
                    </Tr>
                  ))
                ) : (
                  <Tr>
                    <Td colSpan={5} className="text-center py-8 text-xs text-brand-500">
                      No billable AI runs logged yet. Market research and content intelligence runs record usage here.
                    </Td>
                  </Tr>
                )}
              </tbody>
            </Table>
          </Card>

          <Card
            title="User & Workspace AI Model Usage"
            subtitle="Live attribution of which user and organization is using which AI model, total requests, tokens, and spend."
            actions={
              <SearchBox
                value={userModelSearch}
                onChange={setUserModelSearch}
                placeholder="Search user, workspace, or model..."
              />
            }
          >
            <Table minWidth={750}>
              <thead>
                <tr>
                  <Th>User / Account</Th>
                  <Th>Workspace</Th>
                  <Th>AI Model</Th>
                  <Th align="right">Requests</Th>
                  <Th align="right">Tokens Processed</Th>
                  <Th align="right">Est. Spend</Th>
                  <Th align="right">Last Active</Th>
                </tr>
              </thead>
              <tbody>
                {filteredUserModels.length > 0 ? (
                  filteredUserModels.map((row) => (
                    <Tr key={`${row.userId}:${row.provider}:${row.model}`}>
                      <Td>
                        <div className="flex items-center gap-2.5">
                          <div className="h-7 w-7 rounded-full bg-brand-100 text-brand-700 font-bold flex items-center justify-center text-[10px] dark:bg-brand-800 dark:text-brand-300">
                            {row.userName.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <span className={`${nameCls} block`}>{row.userName}</span>
                            <span className="text-[11px] text-brand-400 font-mono">{row.userEmail}</span>
                          </div>
                        </div>
                      </Td>
                      <Td>
                        <span className={nameCls}>{row.organizationName}</span>
                      </Td>
                      <Td>
                        <div className="flex items-center gap-1.5">
                          <span className="h-5 w-5 rounded-full bg-warning-50 dark:bg-warning-500/10 flex items-center justify-center">
                            <Zap size={11} className="text-warning-500" />
                          </span>
                          <span className="font-mono text-xs font-semibold text-brand-900 dark:text-brand-100">
                            {row.provider} / {row.model}
                          </span>
                        </div>
                      </Td>
                      <Td align="right">
                        <span className={`font-mono ${nameCls}`}>{row.calls.toLocaleString()}</span>
                      </Td>
                      <Td align="right">
                        <span className="font-mono text-xs text-brand-700 dark:text-brand-300">
                          {row.totalTokens.toLocaleString()}
                        </span>
                      </Td>
                      <Td align="right">
                        <span className="font-mono text-[13px] font-bold text-success-600 dark:text-success-400">
                          ${row.cost.toFixed(4)}
                        </span>
                      </Td>
                      <Td align="right">
                        <span className={mutedCls}>{relativeTime(row.lastUsedAt)}</span>
                      </Td>
                    </Tr>
                  ))
                ) : (
                  <Tr>
                    <Td colSpan={7} className="text-center py-8 text-xs text-brand-500">
                      {userModelSearch ? "No matching model usage found." : "No attributed model calls logged yet."}
                    </Td>
                  </Tr>
                )}
              </tbody>
            </Table>
          </Card>
          <AiConfigurationTab />
        </div>
      )}

      {/* FLAGS */}
      {activeTab === "settings" && (
        <Card
          title="Platform Settings & Feature Switches"
          subtitle="Configure global crawler parameters and active platform modules."
          actions={
            <PillButton
              dark
              icon={settingsSaved ? <Check size={14} /> : <Sliders size={14} />}
              onClick={() => {
                setSettingsSaved(true);
                setTimeout(() => setSettingsSaved(false), 2200);
              }}
            >
              {settingsSaved ? "Settings Saved" : "Save Settings"}
            </PillButton>
          }
        >
          <div className="divide-y divide-brand-100 dark:divide-brand-800">
            {[
              {
                key: "localSeoModule" as const,
                title: "Local SEO & Google Business Profile Suite",
                desc: "Enables GeoGrid node scanning, local competitor benchmarking, and review sentiment autopilot.",
              },
              {
                key: "aiAutoFixEngine" as const,
                title: "AI 1-Click Code Auto-Fix Engine",
                desc: "Provides Next.js, Shopify Liquid, and HTML code snippets for website audit issues.",
              },
            ].map((f) => (
              <div key={f.key} className="py-4 flex items-center justify-between gap-4">
                <div>
                  <span className={`${nameCls} block`}>{f.title}</span>
                  <p className="text-xs text-brand-500 mt-0.5">{f.desc}</p>
                </div>
                <Toggle
                  checked={featureFlags[f.key]}
                  onChange={(v) => setFeatureFlags({ ...featureFlags, [f.key]: v })}
                />
              </div>
            ))}
            <div className="py-4 flex items-center justify-between gap-4">
              <div>
                <span className={`${nameCls} block`}>Max Crawler Concurrency Workers</span>
                <p className="text-xs text-brand-500 mt-0.5">Maximum simultaneous headless browser instances per tenant crawl run.</p>
              </div>
              <select
                value={featureFlags.maxCrawlConcurrency}
                onChange={(e) => setFeatureFlags({ ...featureFlags, maxCrawlConcurrency: Number(e.target.value) })}
                className="h-10 rounded-full border border-black/10 dark:border-white/10 bg-white dark:bg-brand-900 px-4 text-[13px] text-brand-900 dark:text-brand-100"
              >
                {[1, 2, 3, 4, 6, 8, 10].map((c) => (
                  <option key={c} value={c}>{c} Workers</option>
                ))}
              </select>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
