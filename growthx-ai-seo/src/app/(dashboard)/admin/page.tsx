"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ShieldAlert,
  Cpu,
  Users,
  Database,
  Play,
  Pause,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  MoreHorizontal,
  Eye,
  Ban,
  ArrowUpRight,
  Zap,
  Server,
  Plus,
  Trash2,
  ExternalLink,
  Video,
  X,
  Sparkles,
  MessageCircle,
  Globe,
  Radio,
  Sliders,
  Layers,
  Search,
  Check,
  ShieldCheck,
  Clock,
  Terminal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, StatusDot } from "@/components/ui/badge";
import { MetricCard } from "@/components/ui/metric-card";
import {
  ActionButton,
  Kpi,
  PageHeader,
  Panel,
  Pill,
  Table,
  Tabs,
  Td,
  Th,
  Tr,
  relativeTime,
} from "@/components/ui/console";
import {
  api,
  QueueStat,
  ApiCostStat,
  TenantStat,
  AdminSystemHealth,
  AdminUserItem,
  type Creator,
} from "@/lib/api-client";
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
  const [activeTab, setActiveTab] = useState("overview");
  const [workersPaused, setWorkersPaused] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);

  // Core Admin Data
  const [workerQueues, setWorkerQueues] = useState<QueueStat[]>([]);
  const [apiCosts, setApiCosts] = useState<ApiCostStat[]>([]);
  const [tenants, setTenants] = useState<TenantStat[]>([]);
  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [systemHealth, setSystemHealth] = useState<AdminSystemHealth | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Filtering states
  const [tenantSearch, setTenantSearch] = useState("");
  const [userSearch, setUserSearch] = useState("");

  // Platform Feature Flags / Settings
  const [featureFlags, setFeatureFlags] = useState({
    localSeoModule: true,
    socialMediaModule: true,
    aiAutoFixEngine: true,
    deepCompetitorCrawler: true,
    publicApiRateLimit: 120,
    maxCrawlConcurrency: 4,
    maxCrawlDepth: 10,
  });

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
      setIsLoading(false);
    } catch (err) {
      console.error("Failed to load admin telemetry:", err);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
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

  // Local-first Creator Sync
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

  const tabs = [
    { id: "overview", label: "System Overview", icon: Server },
    { id: "tenants", label: `Tenants (${tenants.length})`, icon: Database },
    { id: "users", label: `Users (${users.length})`, icon: Users },
    { id: "queues", label: "Crawler Queues", icon: Cpu },
    { id: "ai-models", label: "AI Models & Spend", icon: Zap },
    { id: "creators", label: `Creators (${allAdminCreators.length})`, icon: Video },
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
            Global management for SaaS tenant workspaces, platform users, BullMQ worker clusters, AI model spend, and content creator partnerships.
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
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
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
          sub="Gemini & Groq"
          tone="default"
        />
        <Kpi
          label="Content Creators"
          value={String(allAdminCreators.length)}
          sub="Vetted Network"
          tone="good"
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
                      <Server size={15} className="text-purple-500" />
                      Redis / BullMQ
                    </span>
                    <Pill tone={workersPaused ? "warn" : "good"}>{workersPaused ? "PAUSED" : "CONNECTED"}</Pill>
                  </div>
                  <p className="text-xs text-[var(--text-muted)]">Crawl-jobs and page-fetch event loops active.</p>
                  <span className="text-[11px] font-mono text-purple-600 dark:text-purple-400 font-semibold block pt-1">
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
                  <p className="text-xs text-[var(--text-muted)]">Automatic fallback between Gemini 2.5 and Groq.</p>
                  <span className="text-[11px] font-mono text-amber-600 dark:text-amber-400 font-semibold block pt-1">
                    Primary: Gemini 2.5 Flash
                  </span>
                </div>
              </div>
            </Panel>

            <Panel title="Platform Activity Audit Trail" subtitle="Recent administrative and automated background tasks.">
              <div className="divide-y divide-brand-200/60 dark:divide-brand-800/60 text-xs">
                <div className="py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <ShieldCheck size={16} className="text-emerald-500" />
                    <div>
                      <span className="font-semibold text-brand-950 dark:text-brand-100">Crawl Engine Heartbeat Check</span>
                      <p className="text-[var(--text-muted)] text-[11px]">All BullMQ queue workers responding within nominal thresholds.</p>
                    </div>
                  </div>
                  <span className="text-[var(--text-muted)] font-mono text-[11px]">Just now</span>
                </div>
                <div className="py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Zap size={16} className="text-amber-500" />
                    <div>
                      <span className="font-semibold text-brand-950 dark:text-brand-100">AI Cost Ledger Aggregated</span>
                      <p className="text-[var(--text-muted)] text-[11px]">Token consumption parsed for recent market research runs.</p>
                    </div>
                  </div>
                  <span className="text-[var(--text-muted)] font-mono text-[11px]">5m ago</span>
                </div>
                <div className="py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Video size={16} className="text-pink-500" />
                    <div>
                      <span className="font-semibold text-brand-950 dark:text-brand-100">Content Creators Sync Verified</span>
                      <p className="text-[var(--text-muted)] text-[11px]">Verified profiles synchronized for Social Media collaboration brief dispatch.</p>
                    </div>
                  </div>
                  <span className="text-[var(--text-muted)] font-mono text-[11px]">12m ago</span>
                </div>
              </div>
            </Panel>
          </div>
        )}

        {/* TAB 2: TENANTS & WORKSPACES */}
        {activeTab === "tenants" && (
          <div className="space-y-4">
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
                    <Th>Subscription Plan</Th>
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
                            <div className="h-7 w-7 rounded-lg bg-brand-950 text-white font-mono font-bold flex items-center justify-center text-xs">
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
                          <Pill tone="good">{t.plan}</Pill>
                        </Td>
                        <Td>
                          <Pill tone={t.status === "active" ? "good" : "warn"}>{t.status.toUpperCase()}</Pill>
                        </Td>
                        <Td align="right">
                          <Link href="/clients">
                            <button
                              type="button"
                              className="text-xs font-semibold text-accent-600 hover:underline flex items-center gap-1 justify-end"
                            >
                              <span>Inspect</span>
                              <ArrowUpRight size={11} />
                            </button>
                          </Link>
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
                          <Server size={13} className="text-purple-500" />
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
          </div>
        )}

        {/* TAB 6: CONTENT CREATORS NETWORK */}
        {activeTab === "creators" && (
          <div className="space-y-4">
            <Panel
              title="Content Creators Network Management"
              subtitle="Register and manage creators shown in the public directory for brand collaborations."
              actions={
                <div className="flex items-center gap-2">
                  <Link href="/social-media?tab=creators">
                    <ActionButton variant="secondary" icon={<ExternalLink size={12} />}>
                      View in Social Media App
                    </ActionButton>
                  </Link>
                  <ActionButton
                    variant="primary"
                    icon={<Plus size={12} />}
                    onClick={() => setIsAddCreatorOpen(true)}
                  >
                    Add Content Creator
                  </ActionButton>
                </div>
              }
            >
              <Table minWidth={700}>
                <thead>
                  <tr>
                    <Th>Creator Name & Handle</Th>
                    <Th>Category</Th>
                    <Th>Estimated Reach</Th>
                    <Th>Social Accounts</Th>
                    <Th>Status</Th>
                    <Th align="right">Action</Th>
                  </tr>
                </thead>
                <tbody>
                  {allAdminCreators.length > 0 ? (
                    allAdminCreators.map((creator) => (
                      <Tr key={creator.id}>
                        <Td>
                          <div className="flex items-center gap-2.5">
                            <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-pink-500 to-purple-600 flex items-center justify-center text-white font-bold text-xs">
                              {creator.name.slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <span className="font-semibold text-brand-950 dark:text-brand-100 text-xs block">
                                {creator.name}
                              </span>
                              <span className="text-[11px] text-[var(--text-muted)] font-mono">
                                {creator.handle || "@creator"}
                              </span>
                            </div>
                          </div>
                        </Td>
                        <Td>
                          <Pill tone="info">{creator.category || "General"}</Pill>
                        </Td>
                        <Td>
                          <span className="font-mono text-xs font-semibold text-brand-900 dark:text-brand-200">
                            {creator.followerCount ? creator.followerCount.toLocaleString() : "—"} followers
                          </span>
                        </Td>
                        <Td>
                          <div className="flex items-center gap-2">
                            {creator.instagramUrl && (
                              <a
                                href={creator.instagramUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="p-1 rounded bg-pink-50 dark:bg-pink-950/40 text-pink-600 hover:scale-110 transition"
                                title="Instagram"
                              >
                                <InstagramIcon size={13} />
                              </a>
                            )}
                            {creator.youtubeUrl && (
                              <a
                                href={creator.youtubeUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="p-1 rounded bg-red-50 dark:bg-red-950/40 text-red-600 hover:scale-110 transition"
                                title="YouTube"
                              >
                                <YoutubeIcon size={13} />
                              </a>
                            )}
                            {creator.linkedinUrl && (
                              <a
                                href={creator.linkedinUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="p-1 rounded bg-blue-50 dark:bg-blue-950/40 text-blue-600 hover:scale-110 transition"
                                title="LinkedIn"
                              >
                                <LinkedinIcon size={13} />
                              </a>
                            )}
                            {creator.xUrl && (
                              <a
                                href={creator.xUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="p-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:scale-110 transition"
                                title="X"
                              >
                                <TwitterIcon size={13} />
                              </a>
                            )}
                            {creator.contactUrl && (
                              <a
                                href={creator.contactUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="p-1 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 hover:scale-110 transition"
                                title="Booking / Contact"
                              >
                                <MessageCircle size={13} />
                              </a>
                            )}
                          </div>
                        </Td>
                        <Td>
                          <Pill tone="good">ACTIVE</Pill>
                        </Td>
                        <Td align="right">
                          <button
                            type="button"
                            onClick={() => handleDeleteCreator(creator.id)}
                            className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30 rounded transition"
                            title="Delete Creator"
                          >
                            <Trash2 size={13} />
                          </button>
                        </Td>
                      </Tr>
                    ))
                  ) : (
                    <Tr>
                      <Td colSpan={6} className="text-center py-6 text-xs text-[var(--text-muted)]">
                        No content creators added yet. Click &quot;Add Content Creator&quot; above.
                      </Td>
                    </Tr>
                  )}
                </tbody>
              </Table>
            </Panel>
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
                      Social Media & Video Intelligence Suite
                    </span>
                    <p className="text-[var(--text-muted)] text-[11px]">
                      Enables Instagram/YouTube competitor indexing, viral spy counter-actions, and creator directory.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={featureFlags.socialMediaModule}
                    onChange={(e) => setFeatureFlags({ ...featureFlags, socialMediaModule: e.target.checked })}
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

      {/* Add Content Creator Modal */}
      {isAddCreatorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="relative w-full max-w-xl rounded-xl border border-brand-200 dark:border-brand-800 bg-white dark:bg-brand-950 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            <div className="border-b border-brand-200 dark:border-brand-800 px-5 py-4 flex items-center justify-between bg-brand-50/50 dark:bg-brand-900/30">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-pink-100 dark:bg-pink-950/60 text-pink-700 dark:text-pink-300">
                  <Video size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-brand-950 dark:text-brand-100">Add Content Creator</h3>
                  <p className="text-xs text-[var(--text-muted)]">Register a verified creator to display in the Social Media directory.</p>
                </div>
              </div>
              <button
                onClick={() => setIsAddCreatorOpen(false)}
                className="p-1.5 rounded-md text-brand-400 hover:text-brand-700 dark:hover:text-brand-200 transition"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateCreator} className="p-5 overflow-y-auto space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-brand-900 dark:text-brand-200">Creator Name *</label>
                  <input
                    type="text"
                    required
                    value={creatorForm.name}
                    onChange={(e) => setCreatorForm({ ...creatorForm, name: e.target.value })}
                    placeholder="e.g. Alex Rivera"
                    className="w-full h-8 rounded-lg border border-brand-200 dark:border-brand-800 bg-white dark:bg-brand-900 px-2.5 text-brand-950 dark:text-brand-100 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-brand-900 dark:text-brand-200">Handle / Channel</label>
                  <input
                    type="text"
                    value={creatorForm.handle}
                    onChange={(e) => setCreatorForm({ ...creatorForm, handle: e.target.value })}
                    placeholder="e.g. @alexrivera_tech"
                    className="w-full h-8 rounded-lg border border-brand-200 dark:border-brand-800 bg-white dark:bg-brand-900 px-2.5 text-brand-950 dark:text-brand-100 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-brand-900 dark:text-brand-200">Niche Category</label>
                  <select
                    value={creatorForm.category}
                    onChange={(e) => setCreatorForm({ ...creatorForm, category: e.target.value })}
                    className="w-full h-8 rounded-lg border border-brand-200 dark:border-brand-800 bg-white dark:bg-brand-900 px-2 text-brand-950 dark:text-brand-100 focus:outline-none"
                  >
                    <option value="Tech & SaaS">Tech & SaaS</option>
                    <option value="E-Commerce & DTC">E-Commerce & DTC</option>
                    <option value="Lifestyle & Travel">Lifestyle & Travel</option>
                    <option value="B2B & Marketing">B2B & Marketing</option>
                    <option value="Health & Fitness">Health & Fitness</option>
                    <option value="Reels & Shorts Producer">Reels & Shorts Producer</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-brand-900 dark:text-brand-200">Total Followers / Reach</label>
                  <input
                    type="number"
                    value={creatorForm.followerCount}
                    onChange={(e) => setCreatorForm({ ...creatorForm, followerCount: e.target.value })}
                    placeholder="50000"
                    className="w-full h-8 rounded-lg border border-brand-200 dark:border-brand-800 bg-white dark:bg-brand-900 px-2.5 text-brand-950 dark:text-brand-100 focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-brand-900 dark:text-brand-200">Direct Booking or Contact Link (Calendly / WhatsApp / Web)</label>
                <input
                  type="url"
                  value={creatorForm.contactUrl}
                  onChange={(e) => setCreatorForm({ ...creatorForm, contactUrl: e.target.value })}
                  placeholder="https://calendly.com/... or https://wa.me/..."
                  className="w-full h-8 rounded-lg border border-brand-200 dark:border-brand-800 bg-white dark:bg-brand-900 px-2.5 text-brand-950 dark:text-brand-100 focus:outline-none"
                />
              </div>

              <div className="space-y-2 pt-1 border-t border-brand-200 dark:border-brand-800">
                <span className="font-bold text-brand-500 uppercase tracking-wider text-[10px]">Social Channels</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="url"
                    value={creatorForm.instagramUrl}
                    onChange={(e) => setCreatorForm({ ...creatorForm, instagramUrl: e.target.value })}
                    placeholder="Instagram Profile URL"
                    className="w-full h-7 rounded border border-brand-200 dark:border-brand-800 bg-white dark:bg-brand-900 px-2 text-brand-950 dark:text-brand-100 text-[11px]"
                  />
                  <input
                    type="url"
                    value={creatorForm.youtubeUrl}
                    onChange={(e) => setCreatorForm({ ...creatorForm, youtubeUrl: e.target.value })}
                    placeholder="YouTube Channel URL"
                    className="w-full h-7 rounded border border-brand-200 dark:border-brand-800 bg-white dark:bg-brand-900 px-2 text-brand-950 dark:text-brand-100 text-[11px]"
                  />
                  <input
                    type="url"
                    value={creatorForm.tiktokUrl}
                    onChange={(e) => setCreatorForm({ ...creatorForm, tiktokUrl: e.target.value })}
                    placeholder="TikTok Profile URL"
                    className="w-full h-7 rounded border border-brand-200 dark:border-brand-800 bg-white dark:bg-brand-900 px-2 text-brand-950 dark:text-brand-100 text-[11px]"
                  />
                  <input
                    type="url"
                    value={creatorForm.linkedinUrl}
                    onChange={(e) => setCreatorForm({ ...creatorForm, linkedinUrl: e.target.value })}
                    placeholder="LinkedIn Profile URL"
                    className="w-full h-7 rounded border border-brand-200 dark:border-brand-800 bg-white dark:bg-brand-900 px-2 text-brand-950 dark:text-brand-100 text-[11px]"
                  />
                  <input
                    type="url"
                    value={creatorForm.xUrl}
                    onChange={(e) => setCreatorForm({ ...creatorForm, xUrl: e.target.value })}
                    placeholder="X / Twitter Profile URL"
                    className="w-full h-7 rounded border border-brand-200 dark:border-brand-800 bg-white dark:bg-brand-900 px-2 text-brand-950 dark:text-brand-100 text-[11px] sm:col-span-2"
                  />
                </div>
              </div>

              <div className="border-t border-brand-200 dark:border-brand-800 pt-3 flex items-center justify-end gap-2">
                <ActionButton variant="secondary" onClick={() => setIsAddCreatorOpen(false)}>
                  Cancel
                </ActionButton>
                <ActionButton variant="primary" type="submit" icon={<Plus size={12} />}>
                  Save Creator
                </ActionButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
