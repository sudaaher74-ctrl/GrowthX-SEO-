"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Loader2,
  Radio,
  RefreshCw,
  ShieldAlert,
  Terminal,
} from "lucide-react";
import {
  ADMIN_SECTIONS,
  resolveAdminSection,
  type AdminSection,
} from "@/components/layout/admin-sidebar";
import { Pill, StatusNote, relativeTime } from "@/components/ui/console";
import { useProfile } from "@/hooks/use-growthx";
import { api, ApiError } from "@/lib/api-client";
import type {
  AdminAiAnalytics,
  AdminAiRouterConfig,
  AdminAuditLogItem,
  AdminCostWindow,
  AdminOpsSummary,
  AdminPipelinesResponse,
  AdminRecentCrawlsResponse,
  AdminSystemHealth,
  AdminSystemRuntime,
  AdminUserItem,
  AdminUserModelUsage,
  AdminUsersIntelligenceResponse,
  AdminWebhooksResponse,
  AdminWebsiteItem,
  ApiCostStat,
  QueueStat,
  TenantStat,
} from "@/lib/api-types";
import { NocButton } from "@/components/admin/admin-primitives";
import { OverviewSection } from "@/components/admin/overview-section";
import { CrawlerEngineSection } from "@/components/admin/crawler-engine-section";
import { QueuesSection } from "@/components/admin/queues-section";
import { AiFinopsSection } from "@/components/admin/ai-finops-section";
import { TenantsSection } from "@/components/admin/tenants-section";
import { UsersSection } from "@/components/admin/users-section";
import { GovernanceSection } from "@/components/admin/governance-section";

export default function AdminPage() {
  return (
    <Suspense fallback={null}>
      <AdminConsole />
    </Suspense>
  );
}

type AccessState = "checking" | "granted" | "denied";

function AdminConsole() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const profile = useProfile();

  const activeSection: AdminSection = resolveAdminSection(searchParams.get("tab"));
  const navigateTo = useCallback(
    (section: AdminSection) => router.replace(`/admin?tab=${section}`, { scroll: false }),
    [router],
  );
  const currentMeta = ADMIN_SECTIONS.find((s) => s.id === activeSection) ?? ADMIN_SECTIONS[0];

  const [accessState, setAccessState] = useState<AccessState>("checking");
  const [deniedMessage, setDeniedMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [livePolling, setLivePolling] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [failedCalls, setFailedCalls] = useState<string[]>([]);
  const [aiWindowDays, setAiWindowDays] = useState(14);
  const [costWindow, setCostWindow] = useState<AdminCostWindow>("30d");

  // Core Control Plane telemetry
  const [stats, setStats] = useState<{
    tenants: number;
    users: number;
    projects: number;
    loggedInUsers: number;
    activeSessions: number;
  } | null>(null);
  const [opsSummary, setOpsSummary] = useState<AdminOpsSummary | null>(null);
  const [systemHealth, setSystemHealth] = useState<AdminSystemHealth | null>(null);
  const [runtime, setRuntime] = useState<AdminSystemRuntime | null>(null);
  const [websites, setWebsites] = useState<AdminWebsiteItem[]>([]);
  const [recentCrawls, setRecentCrawls] = useState<AdminRecentCrawlsResponse | null>(null);
  const [queues, setQueues] = useState<QueueStat[]>([]);
  const [routerConfig, setRouterConfig] = useState<AdminAiRouterConfig | null>(null);
  const [apiCosts, setApiCosts] = useState<ApiCostStat[]>([]);
  const [aiAnalytics, setAiAnalytics] = useState<AdminAiAnalytics | null>(null);
  const [userModels, setUserModels] = useState<AdminUserModelUsage[]>([]);
  const [tenants, setTenants] = useState<TenantStat[]>([]);
  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [usersIntelligence, setUsersIntelligence] = useState<AdminUsersIntelligenceResponse | null>(null);
  const [pipelines, setPipelines] = useState<AdminPipelinesResponse | null>(null);
  const [auditLogs, setAuditLogs] = useState<AdminAuditLogItem[]>([]);
  const [webhooks, setWebhooks] = useState<AdminWebhooksResponse | null>(null);

  const loadSectionData = useCallback(
    async (section: AdminSection, days = aiWindowDays, cWindow = costWindow) => {
      const failures: string[] = [];
      const capture = <T,>(
        result: PromiseSettledResult<T>,
        label: string,
        apply: (val: T) => void,
      ) => {
        if (result.status === "fulfilled") {
          apply(result.value);
        } else {
          const status = result.reason instanceof ApiError ? result.reason.status : null;
          if (status === 401 || status === 403) {
            setAccessState("denied");
            setDeniedMessage(
              result.reason instanceof Error
                ? result.reason.message
                : "Platform administration is reserved for authorized operator accounts.",
            );
            return;
          }
          failures.push(`${label}${status ? `(${status})` : ""}`);
        }
      };

      if (section === "overview") {
        const [statsR, opsR, healthR, runtimeR, queuesR, costsR, intelR] = await Promise.allSettled([
          api.getAdminStats(),
          api.getAdminOpsSummary(),
          api.getAdminSystemHealth(),
          api.getAdminSystemRuntime(),
          api.getAdminQueues(),
          api.getAdminCosts(),
          api.getAdminUsersIntelligence("mtd"),
        ]);
        capture(statsR, "stats", setStats);
        capture(opsR, "ops-summary", setOpsSummary);
        capture(healthR, "health", setSystemHealth);
        capture(runtimeR, "runtime", setRuntime);
        capture(queuesR, "queues", setQueues);
        capture(costsR, "costs", setApiCosts);
        capture(intelR, "users-intelligence", setUsersIntelligence);
      } else if (section === "crawler") {
        const [sitesR, crawlsR, healthR] = await Promise.allSettled([
          api.getAdminWebsites(120),
          api.getAdminCrawls(50),
          api.getAdminSystemHealth(),
        ]);
        capture(sitesR, "websites", setWebsites);
        capture(crawlsR, "crawls", setRecentCrawls);
        capture(healthR, "health", setSystemHealth);
      } else if (section === "queues") {
        const [queuesR, crawlsR, healthR] = await Promise.allSettled([
          api.getAdminQueues(),
          api.getAdminCrawls(40),
          api.getAdminSystemHealth(),
        ]);
        capture(queuesR, "queues", setQueues);
        capture(crawlsR, "syncs", setRecentCrawls);
        capture(healthR, "health", setSystemHealth);
      } else if (section === "ai-models") {
        const [routerR, costsR, analyticsR, modelsR] = await Promise.allSettled([
          api.getAdminAiRouterConfig(),
          api.getAdminCosts(),
          api.getAdminAiAnalytics(days),
          api.getAdminUserModels(),
        ]);
        capture(routerR, "ai-router", setRouterConfig);
        capture(costsR, "costs", setApiCosts);
        capture(analyticsR, "ai-analytics", setAiAnalytics);
        capture(modelsR, "user-models", setUserModels);
      } else if (section === "tenants") {
        const [tenantsR, healthR] = await Promise.allSettled([
          api.getAdminTenants(),
          api.getAdminSystemHealth(),
        ]);
        capture(tenantsR, "tenants", setTenants);
        capture(healthR, "health", setSystemHealth);
      } else if (section === "users") {
        const [intelR, usersR, statsR] = await Promise.allSettled([
          api.getAdminUsersIntelligence(cWindow),
          api.getAdminUsers(),
          api.getAdminStats(),
        ]);
        capture(intelR, "users-intelligence", setUsersIntelligence);
        capture(usersR, "users", setUsers);
        capture(statsR, "stats", setStats);
      } else if (section === "governance") {
        const [pipesR, logsR, hooksR] = await Promise.allSettled([
          api.getAdminPipelines(25),
          api.getAdminAuditLogs(100),
          api.getAdminWebhooks(40),
        ]);
        capture(pipesR, "pipelines", setPipelines);
        capture(logsR, "audit-logs", setAuditLogs);
        capture(hooksR, "webhooks", setWebhooks);
      }

      setFailedCalls(failures);
      setLastUpdatedAt(new Date().toISOString());
    },
    [aiWindowDays, costWindow],
  );

  const verifyAccess = useCallback(async () => {
    setAccessState("checking");
    try {
      await api.checkAdminAccess();
      setAccessState("granted");
    } catch (err) {
      const status = err instanceof ApiError ? err.status : null;
      if (status === 401 || status === 403) {
        setAccessState("denied");
        setDeniedMessage(
          err instanceof Error
            ? err.message
            : "Platform administration is reserved for authorized operator accounts.",
        );
      } else {
        setAccessState("granted");
      }
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void verifyAccess(), 0);
    return () => clearTimeout(timer);
  }, [verifyAccess]);

  useEffect(() => {
    if (accessState !== "granted") return;
    let active = true;
    const run = async () => {
      setLoading(true);
      await loadSectionData(activeSection, aiWindowDays, costWindow);
      if (active) setLoading(false);
    };
    const timer = setTimeout(() => void run(), 0);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [accessState, activeSection, aiWindowDays, costWindow, loadSectionData]);

  useEffect(() => {
    if (accessState !== "granted" || !livePolling) return;
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        void loadSectionData(activeSection, aiWindowDays, costWindow);
      }
    }, 15_000);
    return () => clearInterval(interval);
  }, [accessState, livePolling, activeSection, aiWindowDays, costWindow, loadSectionData]);

  const handleManualRefresh = async () => {
    setRefreshing(true);
    await loadSectionData(activeSection, aiWindowDays, costWindow);
    setRefreshing(false);
  };

  if (accessState === "checking") {
    return (
      <div className="flex min-h-[65vh] items-center justify-center">
        <div className="flex items-center gap-2.5 rounded-lg border border-brand-200 bg-surface-1 px-4 py-3 text-[13px] font-medium text-brand-600">
          <Loader2 size={14} className="animate-spin text-primary-600" />
          <span>Verifying operator session…</span>
        </div>
      </div>
    );
  }

  if (accessState === "denied") {
    const signedInEmail = profile.data?.email;
    const signedInId = profile.data?.id;
    return (
      <div className="flex min-h-[70vh] items-center justify-center px-2">
        <div className="w-full max-w-md rounded-lg border border-brand-300 bg-surface-1 overflow-hidden shadow-2xl">
          <div className="flex items-center justify-between border-b border-brand-200 bg-surface-2 px-4 py-2.5 text-[12px]">
            <span className="flex items-center gap-2 font-semibold text-error-700">
              <ShieldAlert size={14} />
              Access Denied · HTTP 403
            </span>
            <span className="font-mono text-[10.5px] text-brand-400">Platform Admin</span>
          </div>
          <div className="p-6 space-y-4">
            <p className="text-[13px] leading-relaxed text-brand-500">
              {deniedMessage || "This control plane is restricted to verified platform operator accounts."}
            </p>

            {signedInEmail && (
              <div className="rounded-md border border-brand-200 bg-surface-2 px-3.5 py-2.5 space-y-1">
                <span className="block text-[10.5px] font-semibold uppercase tracking-wider text-brand-400">
                  Signed-in Account
                </span>
                <span className="block truncate text-[13px] font-semibold text-brand-950">{signedInEmail}</span>
                {signedInId && (
                  <span className="block truncate font-mono text-[11px] text-primary-600">UUID: {signedInId}</span>
                )}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-brand-200">
              <Link
                href="/dashboard"
                className="inline-flex h-8 items-center justify-center rounded-md border border-brand-200 bg-surface-2 px-3 text-[12px] font-medium text-brand-600 hover:text-brand-950"
              >
                Back to Workspace
              </Link>
              <NocButton
                variant="primary"
                icon={<RefreshCw size={12} />}
                onClick={() => void verifyAccess()}
              >
                Retry Access
              </NocButton>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-10">
      {/* Refined Executive Control Plane Header */}
      <header className="flex flex-col justify-between gap-3 rounded-lg border border-brand-200 bg-surface-1 px-4 py-3.5 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3 min-w-0">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-primary-200 bg-primary-50 text-primary-600">
            <currentMeta.icon size={16} />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[16px] font-semibold tracking-tight text-brand-950">
                {currentMeta.label}
              </h1>
              {systemHealth && (
                <Pill tone={systemHealth.status === "HEALTHY" ? "good" : "warn"} dot>
                  {systemHealth.status === "HEALTHY" ? "Healthy" : systemHealth.status}
                </Pill>
              )}
            </div>
            <p className="mt-0.5 flex flex-wrap items-center gap-2 text-[12px] text-brand-400">
              <span className="truncate">{currentMeta.description}</span>
              {lastUpdatedAt && (
                <>
                  <span>·</span>
                  <span className="font-mono text-[11px]">Synced {relativeTime(lastUpdatedAt)}</span>
                </>
              )}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setLivePolling((v) => !v)}
            aria-pressed={livePolling}
            className={`inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-[12px] font-medium transition cursor-pointer ${
              livePolling
                ? "border-success-200 bg-success-50 text-success-700"
                : "border-brand-200 bg-surface-2 text-brand-500 hover:border-brand-300 hover:text-brand-950"
            }`}
          >
            <Radio size={12} className={livePolling ? "animate-pulse" : ""} />
            <span>{livePolling ? "Auto-sync: 15s" : "Auto-sync: Off"}</span>
          </button>

          <NocButton
            variant="primary"
            disabled={refreshing}
            icon={<RefreshCw size={12} className={refreshing ? "animate-spin" : ""} />}
            onClick={() => void handleManualRefresh()}
          >
            Sync Now
          </NocButton>
        </div>
      </header>

      {failedCalls.length > 0 && (
        <StatusNote tone="warn">
          <div className="flex flex-wrap items-center justify-between gap-2 text-[12px]">
            <span className="flex items-center gap-1.5">
              <Terminal size={12} />
              Partial telemetry unavailable: <span className="font-mono">{failedCalls.join(", ")}</span>
              {failedCalls.some((c) => c.includes("(404)")) && (
                <span className="text-brand-400"> — redeploy the backend API container to enable new endpoints.</span>
              )}
            </span>
            <button
              type="button"
              onClick={() => void handleManualRefresh()}
              className="font-semibold underline cursor-pointer"
            >
              Retry
            </button>
          </div>
        </StatusNote>
      )}

      {activeSection === "overview" && (
        <OverviewSection
          loading={loading}
          stats={stats}
          opsSummary={opsSummary}
          systemHealth={systemHealth}
          runtime={runtime}
          queues={queues}
          apiCosts={apiCosts}
          usersIntelligence={usersIntelligence}
          onNavigate={navigateTo}
        />
      )}

      {activeSection === "crawler" && (
        <CrawlerEngineSection
          websites={websites}
          crawls={recentCrawls?.crawls ?? []}
          loading={loading}
          onRefresh={() => loadSectionData("crawler", aiWindowDays)}
        />
      )}

      {activeSection === "queues" && (
        <QueuesSection
          queues={queues}
          syncJobs={recentCrawls?.syncJobs ?? []}
          loading={loading}
          onRefresh={() => loadSectionData("queues", aiWindowDays)}
        />
      )}

      {activeSection === "ai-models" && (
        <AiFinopsSection
          routerConfig={routerConfig}
          apiCosts={apiCosts}
          analytics={aiAnalytics}
          userModels={userModels}
          windowDays={aiWindowDays}
          onChangeWindowDays={setAiWindowDays}
          onRouterConfigChanged={setRouterConfig}
          onRefresh={() => loadSectionData("ai-models", aiWindowDays)}
          loading={loading}
        />
      )}

      {activeSection === "tenants" && (
        <TenantsSection
          tenants={tenants}
          loading={loading}
          onRefresh={() => loadSectionData("tenants", aiWindowDays)}
        />
      )}

      {activeSection === "users" && (
        <UsersSection
          users={users}
          intelligence={usersIntelligence}
          window={costWindow}
          onChangeWindow={setCostWindow}
          onlineTotal={stats?.loggedInUsers ?? 0}
          loading={loading}
          onRefresh={() => loadSectionData("users", aiWindowDays, costWindow)}
        />
      )}

      {activeSection === "governance" && (
        <GovernanceSection
          pipelines={pipelines}
          auditLogs={auditLogs}
          webhooks={webhooks}
          loading={loading}
        />
      )}
    </div>
  );
}
