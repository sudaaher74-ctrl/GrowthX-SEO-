"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Activity,
  Loader2,
  Radio,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import {
  ADMIN_SECTIONS,
  resolveAdminSection,
  type AdminSection,
} from "@/components/layout/admin-sidebar";
import { ActionButton, Pill, StatusNote, relativeTime } from "@/components/ui/console";
import { useProfile } from "@/hooks/use-growthx";
import { api, ApiError } from "@/lib/api-client";
import type {
  AdminAiAnalytics,
  AdminAuditLogItem,
  AdminFailedJob,
  AdminOpsSummary,
  AdminRecentCrawlsResponse,
  AdminSystemHealth,
  AdminUserItem,
  AdminUserModelUsage,
  AdminWebhooksResponse,
  ApiCostStat,
  QueueStat,
  TenantStat,
} from "@/lib/api-types";
import { OverviewSection } from "@/components/admin/overview-section";
import { TenantsSection } from "@/components/admin/tenants-section";
import { UsersSection } from "@/components/admin/users-section";
import { QueuesSection } from "@/components/admin/queues-section";
import { AiFinopsSection } from "@/components/admin/ai-finops-section";
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
  const [deniedMessage, setDeniedMessage] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [livePolling, setLivePolling] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [failedCalls, setFailedCalls] = useState<string[]>([]);
  const [aiWindowDays, setAiWindowDays] = useState(14);

  // Operator datasets
  const [stats, setStats] = useState<{
    tenants: number;
    users: number;
    projects: number;
    loggedInUsers: number;
    activeSessions: number;
  } | null>(null);
  const [opsSummary, setOpsSummary] = useState<AdminOpsSummary | null>(null);
  const [systemHealth, setSystemHealth] = useState<AdminSystemHealth | null>(null);
  const [queues, setQueues] = useState<QueueStat[]>([]);
  const [failedJobs, setFailedJobs] = useState<AdminFailedJob[]>([]);
  const [recentCrawls, setRecentCrawls] = useState<AdminRecentCrawlsResponse | null>(null);
  const [tenants, setTenants] = useState<TenantStat[]>([]);
  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [apiCosts, setApiCosts] = useState<ApiCostStat[]>([]);
  const [aiAnalytics, setAiAnalytics] = useState<AdminAiAnalytics | null>(null);
  const [userModels, setUserModels] = useState<AdminUserModelUsage[]>([]);
  const [auditLogs, setAuditLogs] = useState<AdminAuditLogItem[]>([]);
  const [webhooks, setWebhooks] = useState<AdminWebhooksResponse | null>(null);

  const loadSectionData = useCallback(
    async (section: AdminSection, days = aiWindowDays) => {
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
          failures.push(`${label}${status ? ` (${status})` : ""}`);
        }
      };

      if (section === "overview") {
        const [statsR, opsR, healthR, queuesR, costsR] = await Promise.allSettled([
          api.getAdminStats(),
          api.getAdminOpsSummary(),
          api.getAdminSystemHealth(),
          api.getAdminQueues(),
          api.getAdminCosts(),
        ]);
        capture(statsR, "totals", setStats);
        capture(opsR, "ops summary", setOpsSummary);
        capture(healthR, "system health", setSystemHealth);
        capture(queuesR, "queues", setQueues);
        capture(costsR, "AI spend", setApiCosts);
      } else if (section === "tenants") {
        const [tenantsR, healthR] = await Promise.allSettled([
          api.getAdminTenants(),
          api.getAdminSystemHealth(),
        ]);
        capture(tenantsR, "tenants", setTenants);
        capture(healthR, "system health", setSystemHealth);
      } else if (section === "users") {
        const [usersR, statsR] = await Promise.allSettled([
          api.getAdminUsers(),
          api.getAdminStats(),
        ]);
        capture(usersR, "users", setUsers);
        capture(statsR, "totals", setStats);
      } else if (section === "queues") {
        const [queuesR, failedR, crawlsR, healthR] = await Promise.allSettled([
          api.getAdminQueues(),
          api.getAdminFailedJobs(40),
          api.getAdminCrawls(40),
          api.getAdminSystemHealth(),
        ]);
        capture(queuesR, "queues", setQueues);
        capture(failedR, "failed jobs", setFailedJobs);
        capture(crawlsR, "crawl runs", setRecentCrawls);
        capture(healthR, "system health", setSystemHealth);
      } else if (section === "ai-models") {
        const [costsR, analyticsR, modelsR] = await Promise.allSettled([
          api.getAdminCosts(),
          api.getAdminAiAnalytics(days),
          api.getAdminUserModels(),
        ]);
        capture(costsR, "AI spend", setApiCosts);
        capture(analyticsR, "AI analytics", setAiAnalytics);
        capture(modelsR, "model attribution", setUserModels);
      } else if (section === "governance") {
        const [logsR, hooksR] = await Promise.allSettled([
          api.getAdminAuditLogs(100),
          api.getAdminWebhooks(40),
        ]);
        capture(logsR, "audit logs", setAuditLogs);
        capture(hooksR, "webhooks", setWebhooks);
      }

      setFailedCalls(failures);
      setLastUpdatedAt(new Date().toISOString());
    },
    [aiWindowDays],
  );

  // Single lightweight access verification before fetching operator telemetry.
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
        // Fallback: if /access is transiently unavailable, let section loader report failures
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
      await loadSectionData(activeSection, aiWindowDays);
      if (active) setLoading(false);
    };
    const timer = setTimeout(() => void run(), 0);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [accessState, activeSection, aiWindowDays, loadSectionData]);

  useEffect(() => {
    if (accessState !== "granted" || !livePolling) return;
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        void loadSectionData(activeSection, aiWindowDays);
      }
    }, 15_000);
    return () => clearInterval(interval);
  }, [accessState, livePolling, activeSection, aiWindowDays, loadSectionData]);

  const handleManualRefresh = async () => {
    setRefreshing(true);
    await loadSectionData(activeSection, aiWindowDays);
    setRefreshing(false);
  };

  if (accessState === "checking") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex items-center gap-2.5 rounded-2xl border border-brand-200 bg-surface-1 px-5 py-3.5 text-[13px] text-brand-600 shadow-2xs">
          <Loader2 size={15} className="animate-spin text-signal-400" />
          <span>Verifying operator credentials…</span>
        </div>
      </div>
    );
  }

  if (accessState === "denied") {
    const signedInEmail = profile.data?.email;
    const signedInId = profile.data?.id;
    return (
      <div className="flex min-h-[68vh] items-center justify-center px-2">
        <div className="w-full max-w-md rounded-2xl border border-brand-200 bg-surface-1 p-7 sm:p-8 text-center shadow-sm space-y-5">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-brand-200 bg-surface-2 text-brand-700">
            <ShieldAlert size={22} />
          </div>

          <div className="space-y-1.5">
            <h1 className="text-[19px] font-bold tracking-tight text-brand-950">
              Operator Console Restricted
            </h1>
            <p className="text-[13px] leading-relaxed text-brand-500">
              {deniedMessage || "Platform administration is reserved for authorized operator accounts."}
            </p>
          </div>

          {signedInEmail && (
            <div className="rounded-xl border border-brand-200 bg-surface-2/70 px-4 py-3 text-left space-y-1">
              <span className="block text-[10px] font-semibold uppercase tracking-wider text-brand-400">
                Signed In Account
              </span>
              <span className="block truncate font-mono text-[12px] font-semibold text-brand-950">
                {signedInEmail}
              </span>
              {signedInId && (
                <span className="block truncate font-mono text-[10.5px] text-brand-400">
                  ID: {signedInId}
                </span>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
            <Link
              href="/dashboard"
              className="inline-flex h-9 items-center justify-center rounded-xl bg-signal-400 px-4 text-[12.5px] font-bold text-signal-ink transition hover:bg-signal-500"
            >
              Return to Workspace
            </Link>
            <ActionButton
              variant="secondary"
              icon={<RefreshCw size={12} />}
              onClick={() => void verifyAccess()}
              className="h-9 rounded-xl px-4"
            >
              Retry Access
            </ActionButton>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-12">
      {/* Command Header */}
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-signal-400 text-signal-ink shadow-2xs">
            <currentMeta.icon size={18} />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[22px] font-bold leading-tight tracking-tight text-brand-950">
                {currentMeta.label}
              </h1>
              {systemHealth && (
                <Pill tone={systemHealth.status === "HEALTHY" ? "good" : "warn"} dot>
                  {systemHealth.status}
                </Pill>
              )}
            </div>
            <p className="mt-0.5 flex flex-wrap items-center gap-2 text-[12px] text-brand-500">
              <span>{currentMeta.description}</span>
              {lastUpdatedAt && (
                <>
                  <span className="text-brand-300">·</span>
                  <span className="font-mono text-[11px] text-brand-400">
                    Updated {relativeTime(lastUpdatedAt)}
                  </span>
                </>
              )}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setLivePolling((v) => !v)}
            aria-pressed={livePolling}
            className={`inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 text-[12px] font-semibold transition cursor-pointer ${
              livePolling
                ? "border-success-200 bg-success-50 text-success-700"
                : "border-brand-200 bg-surface-1 text-brand-600 hover:bg-surface-2 hover:text-brand-950"
            }`}
          >
            <Radio size={13} className={livePolling ? "animate-pulse" : ""} />
            <span>{livePolling ? "Live (15s)" : "Auto-refresh"}</span>
          </button>

          <ActionButton
            variant="secondary"
            disabled={refreshing}
            icon={<RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />}
            onClick={() => void handleManualRefresh()}
            className="h-9 rounded-xl px-3.5"
          >
            Refresh
          </ActionButton>
        </div>
      </header>

      {failedCalls.length > 0 && (
        <StatusNote tone="warn">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-1.5">
              <Activity size={13} />
              Some telemetry endpoints did not respond ({failedCalls.join(", ")}).
            </span>
            <button
              type="button"
              onClick={() => void handleManualRefresh()}
              className="font-semibold underline cursor-pointer"
            >
              Retry now
            </button>
          </div>
        </StatusNote>
      )}

      {/* Active Section */}
      {activeSection === "overview" && (
        <OverviewSection
          loading={loading}
          stats={stats}
          opsSummary={opsSummary}
          systemHealth={systemHealth}
          queues={queues}
          apiCosts={apiCosts}
          onNavigate={navigateTo}
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
          onlineTotal={stats?.loggedInUsers ?? 0}
          loading={loading}
          onRefresh={() => loadSectionData("users", aiWindowDays)}
        />
      )}

      {activeSection === "queues" && (
        <QueuesSection
          queues={queues}
          failedJobs={failedJobs}
          recentCrawls={recentCrawls}
          loading={loading}
          onRefresh={() => loadSectionData("queues", aiWindowDays)}
        />
      )}

      {activeSection === "ai-models" && (
        <AiFinopsSection
          apiCosts={apiCosts}
          analytics={aiAnalytics}
          userModels={userModels}
          windowDays={aiWindowDays}
          onChangeWindowDays={setAiWindowDays}
          loading={loading}
        />
      )}

      {activeSection === "governance" && (
        <GovernanceSection
          auditLogs={auditLogs}
          webhooks={webhooks}
          loading={loading}
        />
      )}
    </div>
  );
}
