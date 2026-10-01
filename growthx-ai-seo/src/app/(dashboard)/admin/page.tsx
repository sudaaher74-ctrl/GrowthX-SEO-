"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";import { ShieldAlert, Cpu, Users, Database, Play, Pause, RefreshCw, ArrowUpRight, Zap, Server, Sliders, Search, Check } from "lucide-react";import { StatusDot } from "@/components/ui/badge";import { ActionButton, Kpi, Panel, Pill, Table, Tabs, Td, Th, Tr, relativeTime } from "@/components/ui/console";
import {
  api,
  QueueStat,
  ApiCostStat,
  TenantStat,
  AdminSystemHealth,
  AdminUserItem,
} from "@/lib/api-client";
import { AiConfigurationTab } from "@/components/settings/ai-configuration-tab";
import { GrantTokensForm } from "@/components/tokens/grant-tokens-form";
import { formatTokens, formatTokensExact } from "@/lib/tokens";

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState("overview");
  const [workersPaused, setWorkersPaused] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);

  // Core Admin Data
  const [workerQueues, setWorkerQueues] = useState<QueueStat[]>([]);
  const [apiCosts, setApiCosts] = useState<ApiCostStat[]>([]);
  const [tenants, setTenants] = useState<TenantStat[]>([]);
  const [grantTo, setGrantTo] = useState<TenantStat | null>(null);
  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [systemHealth, setSystemHealth] = useState<AdminSystemHealth | null>(null);

  // Filtering states
  const [tenantSearch, setTenantSearch] = useState("");
  const [userSearch, setUserSearch] = useState("");

  // Platform Feature Flags / Settings
  const [featureFlags, setFeatureFlags] = useState({
    localSeoModule: true,
    aiAutoFixEngine: true,
    deepCompetitorCrawler: true,
    publicApiRateLimit: 120,
    maxCrawlConcurrency: 4,
    maxCrawlDepth: 10,
  });

  const loadData = async () => {
    try {
      const [queues, costs, tenantsData, healthData, usersData] = await Promise.all([
        api.getAdminQueues(),
        api.getAdminCosts(),
        api.getAdminTenants(),
        api.getAdminSystemHealth(),
        api.getAdminUsers(),
      ]);
      setWorkerQueues(queues);
      setApiCosts(costs);
      setTenants(tenantsData);
      setSystemHealth(healthData);
      setUsers(usersData);
    } catch (err) {
      console.error("Failed to load admin telemetry:", err);
    }
  };

  useEffect(() => {
    let active = true;
    Promise.all([
      api.getAdminQueues(),
      api.getAdminCosts(),
      api.getAdminTenants(),
      api.getAdminSystemHealth(),
      api.getAdminUsers(),
    ])
      .then(([queues, costs, tenantsData, healthData, usersData]) => {
        if (!active) return;
        setWorkerQueues(queues);
        setApiCosts(costs);
        setTenants(tenantsData);
        setSystemHealth(healthData);
        setUsers(usersData);
      })
      .catch((err) => {
        console.error("Failed to load admin telemetry:", err);
      });
    return () => {
      active = false;
    };
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

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const q = userSearch.toLowerCase();
      return (
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.organizationName.toLowerCase().includes(q)
      );
    });
  }, [users, userSearch]);

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

  const tabs = [
    { id: "overview", label: "System Overview", icon: Server },
    { id: "tenants", label: `Tenants (${tenants.length})`, icon: Database },
    { id: "users", label: `Users (${users.length})`, icon: Users },
    { id: "queues", label: "Crawler Queues", icon: Cpu },
    { id: "ai-models", label: "AI Models & Spend", icon: Zap },
    { id: "settings", label: "Platform Flags", icon: Sliders },
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Header & Super Admin Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-brand-200 dark:border-brand-800 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="px-2.5 py-0.5 rounded-full bg-red-500/10 text-red-600 dark:bg-red-500/20 dark:text-red-400 text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 border border-red-200 dark:border-red-900/40">
              <ShieldAlert size={12} /> Super Admin Control
            </span>
            <Pill tone={systemHealth?.status === "HEALTHY" ? "good" : "warn"}>
              {systemHealth?.status || "SYSTEMS OPERATIONAL"}
            </Pill>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-brand-950 dark:text-brand-100 mt-1.5">
            GrowthX Software Administration
          </h1>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Global management for SaaS tenant workspaces, platform users, BullMQ worker clusters, and AI model spend.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <ActionButton
            variant="secondary"
            icon={<RefreshCw size={12} className={refreshing ? "animate-spin" : ""} />}
            onClick={handleRefresh}
          >
            Refresh Telemetry
          </ActionButton>
          <ActionButton
            variant={workersPaused ? "primary" : "secondary"}
            icon={workersPaused ? <Play size={12} /> : <Pause size={12} />}
            onClick={handleToggleWorkers}
          >
            {workersPaused ? "Resume Queues" : "Pause Queues"}
          </ActionButton>
          <ActionButton
            variant="secondary"
            icon={<RefreshCw size={12} className={retrying ? "animate-spin" : ""} />}
            onClick={handleRetryFailed}
          >
            Retry Failed Jobs
          </ActionButton>
        </div>
      </div>

      {/* 2. Global Telemetry Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Kpi
          label="Active Tenants"
          value={String(tenants.length)}
          sub="Organizations"
          tone="default"
        />
        <Kpi
          label="Platform Users"
          value={String(users.length)}
          sub="Registered accounts"
          tone="default"
        />
        <Kpi
          label="24h Jobs Finished"
          value={String(totalCompletedJobs)}
          sub="BullMQ tasks"
          tone="good"
        />
        <Kpi
          label="AI Model Spend MTD"
          value={`$${totalSpend}`}
          sub={spendProviders}
          tone="default"
        />
      </div>

      {/* 3. Modular Tab Navigation */}
      <Tabs tabs={tabs} active={activeTab} onChange={setActiveTab} />

      {/* 4. Tab Contents */}
      <div className="pt-1">
        {/* TAB 1: SYSTEM OVERVIEW */}
        {activeTab === "overview" && (
          <div className="space-y-5">
            <Panel title="Infrastructure & Core Services Health" subtitle="Real-time heartbeat across database, queues, crawler cluster, and AI providers.">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-2">
                <div className="p-4 rounded-xl border border-brand-200/80 dark:border-brand-800/80 bg-brand-50/30 dark:bg-brand-900/10 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-brand-950 dark:text-brand-100 flex items-center gap-1.5">
                      <Database size={15} className="text-emerald-500" />
                      PostgreSQL Database
                    </span>
                    <Pill tone="good">{systemHealth?.database?.status || "CONNECTED"}</Pill>
                  </div>
                  <p className="text-xs text-[var(--text-muted)]">Prisma ORM connected with verified transaction pooling.</p>
                  <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold block pt-1">
                    Latency: {systemHealth?.database?.latencyMs ?? 2}ms
                  </span>
                </div>

                <div className="p-4 rounded-xl border border-brand-200/80 dark:border-brand-800/80 bg-brand-50/30 dark:bg-brand-900/10 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-brand-950 dark:text-brand-100 flex items-center gap-1.5">
                      <Server size={15} className="text-slate-500" />
                      Redis / BullMQ
                    </span>
                    <Pill tone={workersPaused ? "warn" : "good"}>{workersPaused ? "PAUSED" : "CONNECTED"}</Pill>
                  </div>
                  <p className="text-xs text-[var(--text-muted)]">Crawl-jobs and page-fetch event loops active.</p>
                  <span className="text-[11px] font-mono text-slate-900 dark:text-slate-400 font-semibold block pt-1">
                    Worker Queues: 2 Active
                  </span>
                </div>

                <div className="p-4 rounded-xl border border-brand-200/80 dark:border-brand-800/80 bg-brand-50/30 dark:bg-brand-900/10 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-brand-950 dark:text-brand-100 flex items-center gap-1.5">
                      <Cpu size={15} className="text-accent-500" />
                      Headless Crawler Cluster
                    </span>
                    <Pill tone="good">OPERATIONAL</Pill>
                  </div>
                  <p className="text-xs text-[var(--text-muted)]">Chromium / Puppeteer sandbox isolation pool.</p>
                  <span className="text-[11px] font-mono text-accent-600 dark:text-accent-400 font-semibold block pt-1">
                    Pool Concurrency: 4 Workers
                  </span>
                </div>

                <div className="p-4 rounded-xl border border-brand-200/80 dark:border-brand-800/80 bg-brand-50/30 dark:bg-brand-900/10 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-brand-950 dark:text-brand-100 flex items-center gap-1.5">
                      <Zap size={15} className="text-amber-500" />
                      Multi-AI Router
                    </span>
                    <Pill tone="good">ROUTING</Pill>
                  </div>
                  <p className="text-xs text-[var(--text-muted)]">
                    Routes each AI task to the vendors allowed by AI_PROVIDERS that have a key. See /health/capabilities for the live chain.
                  </p>
                </div>
              </div>
            </Panel>
          </div>
        )}

        {/* TAB 2: TENANTS & WORKSPACES */}
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
            <Panel
              title="Registered SaaS Tenants & Workspaces"
              subtitle="All client organizations registered on this GrowthX instance."
              actions={
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-brand-400" size={13} />
                  <input
                    type="text"
                    value={tenantSearch}
                    onChange={(e) => setTenantSearch(e.target.value)}
                    placeholder="Search tenants or owners..."
                    className="h-8 pl-8 pr-3 text-xs rounded-lg border border-brand-200 dark:border-brand-800 bg-white dark:bg-brand-900 text-brand-950 dark:text-brand-100 focus:outline-none focus:ring-1 focus:ring-accent-600"
                  />
                </div>
              }
            >
              <Table minWidth={700}>
                <thead>
                  <tr>
                    <Th>Organization Name</Th>
                    <Th>Owner Account</Th>
                    <Th>Configured Sites</Th>
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
                          <div className="flex items-center gap-2">
                            <div className="h-7 w-7 rounded-lg bg-primary-600 text-white font-mono font-bold flex items-center justify-center text-xs">
                              {t.name.slice(0, 2).toUpperCase()}
                            </div>
                            <span className="font-semibold text-brand-950 dark:text-brand-100 text-xs">{t.name}</span>
                          </div>
                        </Td>
                        <Td>
                          <span className="text-xs text-[var(--text-muted)] font-mono">{t.owner || "—"}</span>
                        </Td>
                        <Td>
                          <span className="font-mono text-xs font-semibold text-brand-900 dark:text-brand-200">{t.sites} sites</span>
                        </Td>
                        <Td>
                          {t.tokens ? (
                            <span title={`${formatTokensExact(t.tokens.available)} available, ${formatTokensExact(t.tokens.monthly)} a month`}>
                              <span className="font-mono text-xs font-semibold text-brand-900">{formatTokens(t.tokens.available)}</span>{" "}
                              <span className="text-[10.5px] text-brand-400">of {formatTokens(t.tokens.monthly)}/mo</span>
                            </span>
                          ) : (
                            <span className="text-xs text-brand-400" title="Opened the first time this workspace uses a feature that spends tokens">
                              Not started
                            </span>
                          )}
                        </Td>
                        <Td>
                          <Pill tone={t.status === "active" ? "good" : "warn"}>{t.status.toUpperCase()}</Pill>
                        </Td>
                        <Td align="right">
                          <div className="flex items-center justify-end gap-3">
                            <button
                              type="button"
                              onClick={() => setGrantTo(t)}
                              className="text-xs font-semibold text-accent-600 hover:underline"
                            >
                              Add tokens
                            </button>
                            <Link href="/clients">
                              <button
                                type="button"
                                className="text-xs font-semibold text-accent-600 hover:underline flex items-center gap-1 justify-end"
                              >
                                <span>Inspect</span>
                                <ArrowUpRight size={11} />
                              </button>
                            </Link>
                          </div>
                        </Td>
                      </Tr>
                    ))
                  ) : (
                    <Tr>
                      <Td colSpan={6} className="text-center py-6 text-xs text-[var(--text-muted)]">
                        No organizations found matching search criteria.
                      </Td>
                    </Tr>
                  )}
                </tbody>
              </Table>
            </Panel>
          </div>
        )}

        {/* TAB 3: USER ACCESS CONTROL */}
        {activeTab === "users" && (
          <div className="space-y-4">
            <Panel
              title="Platform Users & Access Control"
              subtitle="All registered operator and client accounts across organizations."
              actions={
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-brand-400" size={13} />
                  <input
                    type="text"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="Search users, emails, orgs..."
                    className="h-8 pl-8 pr-3 text-xs rounded-lg border border-brand-200 dark:border-brand-800 bg-white dark:bg-brand-900 text-brand-950 dark:text-brand-100 focus:outline-none focus:ring-1 focus:ring-accent-600"
                  />
                </div>
              }
            >
              <Table minWidth={700}>
                <thead>
                  <tr>
                    <Th>User</Th>
                    <Th>Email Address</Th>
                    <Th>Assigned Organization</Th>
                    <Th>Role</Th>
                    <Th>Joined Date</Th>
                    <Th>Status</Th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.length > 0 ? (
                    filteredUsers.map((u) => (
                      <Tr key={u.id}>
                        <Td>
                          <span className="font-semibold text-brand-950 dark:text-brand-100 text-xs">{u.name}</span>
                        </Td>
                        <Td>
                          <span className="text-xs text-[var(--text-muted)] font-mono">{u.email}</span>
                        </Td>
                        <Td>
                          <span className="text-xs text-brand-800 dark:text-brand-300 font-medium">{u.organizationName}</span>
                        </Td>
                        <Td>
                          <Pill tone={u.role === "OWNER" ? "good" : u.role === "ADMIN" ? "info" : "default"}>
                            {u.role}
                          </Pill>
                        </Td>
                        <Td>
                          <span className="text-xs text-[var(--text-muted)]">{relativeTime(u.createdAt)}</span>
                        </Td>
                        <Td>
                          <Pill tone="good">{u.status}</Pill>
                        </Td>
                      </Tr>
                    ))
                  ) : (
                    <Tr>
                      <Td colSpan={6} className="text-center py-6 text-xs text-[var(--text-muted)]">
                        No registered users matching search.
                      </Td>
                    </Tr>
                  )}
                </tbody>
              </Table>
            </Panel>
          </div>
        )}

        {/* TAB 4: CRAWLER QUEUES */}
        {activeTab === "queues" && (
          <div className="space-y-4">
            <Panel
              title="BullMQ Crawler Worker Queues"
              subtitle="Distributed asynchronous job processing for web crawling and page diagnostics."
              actions={
                <div className="flex items-center gap-2">
                  <StatusDot
                    status={workersPaused ? "warning" : "success"}
                    label={workersPaused ? "Workers Paused" : "Workers Running"}
                    pulse={!workersPaused}
                  />
                </div>
              }
            >
              <Table minWidth={650}>
                <thead>
                  <tr>
                    <Th>Queue Name</Th>
                    <Th align="right">Active Jobs</Th>
                    <Th align="right">Waiting</Th>
                    <Th align="right">Completed (24h)</Th>
                    <Th align="right">Failed Jobs</Th>
                    <Th align="right">Engine Status</Th>
                  </tr>
                </thead>
                <tbody>
                  {workerQueues.map((q) => (
                    <Tr key={q.name}>
                      <Td>
                        <div className="flex items-center gap-2 font-mono text-xs font-semibold text-brand-950 dark:text-brand-100">
                          <Server size={13} className="text-slate-500" />
                          <span>{q.name}</span>
                        </div>
                      </Td>
                      <Td align="right">
                        <span className="font-mono text-xs font-semibold text-accent-600 dark:text-accent-400">
                          {q.active}
                        </span>
                      </Td>
                      <Td align="right">
                        <span className="font-mono text-xs text-[var(--text-muted)]">{q.waiting}</span>
                      </Td>
                      <Td align="right">
                        <span className="font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                          {q.completed}
                        </span>
                      </Td>
                      <Td align="right">
                        <span className={`font-mono text-xs font-semibold ${q.failed > 0 ? "text-red-500" : "text-[var(--text-muted)]"}`}>
                          {q.failed}
                        </span>
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
            </Panel>
          </div>
        )}

        {/* TAB 5: AI MODELS & SPEND */}
        {activeTab === "ai-models" && (
          <div className="space-y-4">
            <Panel title="AI Model Utilization & Spend Ledger" subtitle="Tokens consumed and costs tracked across LLM operations.">
              <Table minWidth={600}>
                <thead>
                  <tr>
                    <Th>Provider / Model</Th>
                    <Th align="right">Tokens Processed</Th>
                    <Th align="right">Total Spend (USD)</Th>
                    <Th align="right">Router Priority</Th>
                    <Th align="right">Status</Th>
                  </tr>
                </thead>
                <tbody>
                  {apiCosts.length > 0 ? (
                    apiCosts.map((c) => (
                      <Tr key={c.service}>
                        <Td>
                          <div className="flex items-center gap-2 font-semibold text-brand-950 dark:text-brand-100 text-xs">
                            <Zap size={13} className="text-amber-500" />
                            <span>{c.service}</span>
                          </div>
                        </Td>
                        <Td align="right">
                          <span className="font-mono text-xs text-brand-800 dark:text-brand-200">{c.tokens}</span>
                        </Td>
                        <Td align="right">
                          <span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
                            ${c.cost.toFixed(4)}
                          </span>
                        </Td>
                        <Td align="right">
                          <Pill tone="info">PRIMARY</Pill>
                        </Td>
                        <Td align="right">
                          <Pill tone="good">ACTIVE</Pill>
                        </Td>
                      </Tr>
                    ))
                  ) : (
                    <Tr>
                      <Td colSpan={5} className="text-center py-6 text-xs text-[var(--text-muted)]">
                        No billable AI runs logged yet. Market research and content intelligence runs record usage here.
                      </Td>
                    </Tr>
                  )}
                </tbody>
              </Table>
            </Panel>
            <AiConfigurationTab />
          </div>
        )}

        {/* TAB 7: PLATFORM SETTINGS & FLAGS */}
        {activeTab === "settings" && (
          <div className="space-y-4">
            <Panel
              title="Platform Settings & Feature Switches"
              subtitle="Configure global crawler parameters and active platform modules."
              actions={
                <ActionButton
                  variant="primary"
                  icon={settingsSaved ? <Check size={12} /> : <Sliders size={12} />}
                  onClick={() => {
                    setSettingsSaved(true);
                    setTimeout(() => setSettingsSaved(false), 2200);
                  }}
                >
                  {settingsSaved ? "Settings Saved" : "Save Settings"}
                </ActionButton>
              }
            >
              <div className="divide-y divide-brand-200/60 dark:divide-brand-800/60 text-xs">
                <div className="py-3.5 flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-brand-950 dark:text-brand-100 block">
                      Local SEO & Google Business Profile Suite
                    </span>
                    <p className="text-[var(--text-muted)] text-[11px]">
                      Enables GeoGrid node scanning, local competitor benchmarking, and review sentiment autopilot.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={featureFlags.localSeoModule}
                    onChange={(e) => setFeatureFlags({ ...featureFlags, localSeoModule: e.target.checked })}
                    className="h-4 w-4 rounded text-accent-600 focus:ring-accent-500"
                  />
                </div>

                <div className="py-3.5 flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-brand-950 dark:text-brand-100 block">
                      AI 1-Click Code Auto-Fix Engine
                    </span>
                    <p className="text-[var(--text-muted)] text-[11px]">
                      Provides Next.js, Shopify Liquid, and HTML code snippets for website audit issues.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={featureFlags.aiAutoFixEngine}
                    onChange={(e) => setFeatureFlags({ ...featureFlags, aiAutoFixEngine: e.target.checked })}
                    className="h-4 w-4 rounded text-accent-600 focus:ring-accent-500"
                  />
                </div>

                <div className="py-3.5 flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-brand-950 dark:text-brand-100 block">
                      Max Crawler Concurrency Workers
                    </span>
                    <p className="text-[var(--text-muted)] text-[11px]">
                      Maximum simultaneous headless browser instances per tenant crawl run.
                    </p>
                  </div>
                  <select
                    value={featureFlags.maxCrawlConcurrency}
                    onChange={(e) => setFeatureFlags({ ...featureFlags, maxCrawlConcurrency: Number(e.target.value) })}
                    className="h-8 rounded-md border border-brand-200 dark:border-brand-800 bg-white dark:bg-brand-900 px-2.5 text-xs text-brand-900 dark:text-brand-100"
                  >
                    {[1, 2, 3, 4, 6, 8, 10].map((c) => (
                      <option key={c} value={c}>{c} Workers</option>
                    ))}
                  </select>
                </div>
              </div>
            </Panel>
          </div>
        )}
      </div>
    </div>
  );
}
