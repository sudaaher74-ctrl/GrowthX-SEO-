"use client";

import { Suspense, useState, useMemo, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeft,
  Globe,
  Zap,
  SlidersHorizontal,
  Plug,
  Compass,
  Users,
  UserCircle,
  Shield,
  Smartphone,
  CreditCard,
  Info,
  RefreshCw,
  Trash2,
} from "lucide-react";
import {
  GoogleSearchConsoleLogo,
  GoogleAnalyticsLogo,
  GitHubLogo,
  GooglePlacesLogo,
  WordPressLogo,
  ShopifyLogo,
  WebflowLogo,
} from "@/components/settings/integration-logos";
import { GitHubAgentConnectWorkflow } from "@/components/settings/github-agent-connect-workflow";
import { WordPressConnectModal, type CmsConnectPlatform } from "@/components/settings/wordpress-connect-modal";
import {
  useConnectRepository,
  useDisconnectRepository,
  useRepository,
  useWorkspace,
  useProfile,
  useMembers,
  useAddMember,
  useRemoveMember,
  useUpdateMemberRole,
  usePortfolio,
  useLocalSeo,
} from "@/hooks/use-growthx";
import { api, type GoogleProviderStatus, type Role } from "@/lib/api-client";
import { errorMessage } from "@/lib/error-message";
import { PropertyPicker } from "@/components/ui/property-picker";
import { relativeTime } from "@/components/ui/console";

type SettingsTab =
  | "websites"
  | "credits"
  | "agents"
  | "integrations"
  | "skills"
  | "team"
  | "personalization"
  | "account"
  | "devices"
  | "subscription";

const HIDDEN_SETTINGS_TABS = new Set(["skills", "team", "devices", "personalization"]);
const VISIBLE_SETTINGS_TABS = new Set<SettingsTab>([
  "websites",
  "credits",
  "agents",
  "integrations",
  "account",
  "subscription",
]);

function normalizeSettingsTab(value: string | null): SettingsTab {
  if (!value || HIDDEN_SETTINGS_TABS.has(value) || !VISIBLE_SETTINGS_TABS.has(value as SettingsTab)) {
    return "integrations";
  }
  return value as SettingsTab;
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-brand-400">Loading Settings…</div>}>
      <SettingsClient />
    </Suspense>
  );
}

function SettingsClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawTab = normalizeSettingsTab(searchParams?.get("tab") ?? null);
  const [activeTab, setActiveTab] = useState<SettingsTab>(rawTab);

  useEffect(() => {
    const requestedTab = searchParams?.get("tab") ?? null;
    const tab = normalizeSettingsTab(requestedTab);
    setActiveTab(tab);
    if (requestedTab && requestedTab !== tab) {
      const params = new URLSearchParams(window.location.search);
      params.set("tab", tab);
      window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`);
    }
  }, [searchParams]);

  const setTab = (tab: SettingsTab) => {
    setActiveTab(tab);
    try {
      const params = new URLSearchParams(window.location.search);
      params.set("tab", tab);
      window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`);
    } catch {
      // ignore
    }
  };

  const handleBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/dashboard");
    }
  };

  return (
    <div className="mx-auto max-w-6xl pb-16 pt-2">
      {/* Top Header matching okara.ai screenshot */}
      <div className="mb-6 flex items-center gap-2">
        <button
          type="button"
          onClick={handleBack}
          className="inline-flex items-center gap-1.5 text-2xl font-bold tracking-tight text-brand-950 transition hover:text-brand-700"
        >
          <ChevronLeft size={26} className="-ml-1 text-brand-950" />
          <span>Settings</span>
        </button>
      </div>

      <div className="grid grid-cols-1 items-start gap-8 md:grid-cols-12">
        {/* Left Sidebar Navigation */}
        <aside className="space-y-6 md:col-span-3">
          {/* AI CMO Category */}
          <div>
            <p className="mb-1.5 px-3 text-[11px] font-bold uppercase tracking-wider text-brand-400">
              AI CMO
            </p>
            <nav className="space-y-0.5">
              <SidebarItem
                label="Websites"
                icon={<Globe size={15} />}
                active={activeTab === "websites"}
                onClick={() => setTab("websites")}
              />
              <SidebarItem
                label="Credits"
                icon={<Zap size={15} />}
                hasDot
                active={activeTab === "credits"}
                onClick={() => setTab("credits")}
              />
              <SidebarItem
                label="Agents"
                icon={<SlidersHorizontal size={15} />}
                active={activeTab === "agents"}
                onClick={() => setTab("agents")}
              />
              <SidebarItem
                label="Integrations"
                icon={<Plug size={15} />}
                hasDot
                active={activeTab === "integrations"}
                onClick={() => setTab("integrations")}
              />
            </nav>
          </div>

          {/* GENERAL Category */}
          <div>
            <p className="mb-1.5 px-3 text-[11px] font-bold uppercase tracking-wider text-brand-400">
              General
            </p>
            <nav className="space-y-0.5">
              <SidebarItem
                label="Account & Security"
                icon={<Shield size={15} />}
                active={activeTab === "account"}
                onClick={() => setTab("account")}
              />
              <SidebarItem
                label="Subscription"
                icon={<CreditCard size={15} />}
                active={activeTab === "subscription"}
                onClick={() => setTab("subscription")}
              />
            </nav>
          </div>
        </aside>

        {/* Right Content Area */}
        <main className="space-y-8 md:col-span-9">
          {activeTab === "integrations" && <IntegrationsView />}
          {activeTab === "websites" && <WebsitesView />}
          {activeTab === "credits" && <CreditsView />}
          {activeTab === "agents" && <AgentsView />}
          {activeTab === "skills" && <SkillsMcpView />}
          {activeTab === "team" && <TeamSettingsView />}
          {activeTab === "personalization" && <PersonalizationView />}
          {activeTab === "account" && <AccountSecurityView />}
          {activeTab === "devices" && <DevicesView />}
          {activeTab === "subscription" && <SubscriptionView />}
        </main>
      </div>
    </div>
  );
}

function SidebarItem({
  label,
  icon,
  active,
  hasDot,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  active: boolean;
  hasDot?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[12.5px] transition-colors ${
        active
          ? "bg-brand-100 font-semibold text-brand-950 shadow-2xs"
          : "font-medium text-brand-600 hover:bg-brand-50 hover:text-brand-950"
      }`}
    >
      <span className={active ? "text-brand-950" : "text-brand-400"}>{icon}</span>
      <span>{label}</span>
      {hasDot && <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-success-500" />}
    </button>
  );
}

/* =========================================================================
   1. INTEGRATIONS VIEW (PLATFORM-ACTIVE INTEGRATIONS ONLY)
   ========================================================================= */

function accountLabel(provider: GoogleProviderStatus | undefined): string {
  if (provider?.googleAccountEmail) return provider.googleAccountEmail;
  if (!provider || provider.status === "NOT_CONNECTED" || provider.status === "DISCONNECTED") return "Not connected";
  return "Connected (email not recorded — reconnect to show it)";
}

function IntegrationsView() {
  const { projectId, projects } = useWorkspace();
  const currentDomain = projects.find((p) => p.id === projectId)?.name;
  const qc = useQueryClient();
  const searchParams = useSearchParams();
  const profile = useProfile();
  const user = profile.data;

  const repo = useRepository(projectId);
  const connectRepo = useConnectRepository(projectId);
  const disconnectRepo = useDisconnectRepository(projectId);
  const localSeo = useLocalSeo(projectId);

  // Google connections query
  const googleQuery = useQuery({
    queryKey: ["google-connections", projectId],
    queryFn: () => (projectId ? api.googleConnections(projectId) : null),
    enabled: Boolean(projectId),
  });

  // WordPress connection query
  const wpQuery = useQuery({
    queryKey: ["wordpress-connection", projectId],
    queryFn: () => (projectId ? api.getWordPressConnection(projectId) : null),
    enabled: Boolean(projectId),
    retry: false,
  });

  // Shopify connection query
  const shopifyQuery = useQuery({
    queryKey: ["shopify-connection", projectId],
    queryFn: () => (projectId ? api.getShopifyConnection(projectId) : null),
    enabled: Boolean(projectId),
    retry: false,
  });

  // Webflow connection query
  const webflowQuery = useQuery({
    queryKey: ["webflow-connection", projectId],
    queryFn: () => (projectId ? api.getWebflowConnection(projectId) : null),
    enabled: Boolean(projectId),
    retry: false,
  });

  const disconnectWp = useMutation({
    mutationFn: () => api.disconnectWordPress(projectId!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wordpress-connection", projectId] });
      setActionNotice({ type: "success", text: "WordPress site disconnected." });
    },
    onError: (err) => setActionNotice({ type: "error", text: errorMessage(err) }),
  });

  const disconnectShopify = useMutation({
    mutationFn: () => api.disconnectShopify(projectId!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shopify-connection", projectId] });
      setActionNotice({ type: "success", text: "Shopify store disconnected." });
    },
    onError: (err) => setActionNotice({ type: "error", text: errorMessage(err) }),
  });

  const disconnectWebflow = useMutation({
    mutationFn: () => api.disconnectWebflow(projectId!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["webflow-connection", projectId] });
      setActionNotice({ type: "success", text: "Webflow site disconnected." });
    },
    onError: (err) => setActionNotice({ type: "error", text: errorMessage(err) }),
  });

  const [cmsModalPlatform, setCmsModalPlatform] = useState<CmsConnectPlatform | null>(null);

  const gsc = googleQuery.data?.providers.find((p) => p.id === "search_console");
  const ga4 = googleQuery.data?.providers.find((p) => p.id === "analytics");

  const githubOauthCode = searchParams?.get("github_code") || null;
  const githubOauthState = searchParams?.get("github_state") || null;
  const githubInstallationId = searchParams?.get("installation_id") || null;

  const [githubModalOpen, setGithubModalOpen] = useState(
    Boolean(githubOauthCode || githubInstallationId),
  );

  useEffect(() => {
    if (githubOauthCode || githubInstallationId) {
      setGithubModalOpen(true);
    }
  }, [githubOauthCode, githubInstallationId]);

  const [showGscPicker, setShowGscPicker] = useState(false);
  const [showGa4Picker, setShowGa4Picker] = useState(false);
  const [expandedConnector, setExpandedConnector] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<{ type: "success" | "warn" | "error"; text: string } | null>(null);

  // Handle OAuth callback parameters in URL
  const urlNotice = useMemo(() => {
    const googleStatus = searchParams?.get("google");
    const githubStatus = searchParams?.get("github");
    const provider = searchParams?.get("provider");
    if (githubStatus === "cancelled") {
      return {
        type: "warn" as const,
        text: "GitHub authorization was cancelled on github.com.",
      };
    }
    if (googleStatus === "select") {
      return {
        type: "warn" as const,
        text: `Google authorization succeeded! Please choose which ${provider === "search_console" ? "Search Console" : "Analytics"} property to read below.`,
      };
    }
    if (googleStatus === "scopes") {
      return {
        type: "warn" as const,
        text: "Google authorized your login, but some requested permissions were not checked on the consent screen.",
      };
    }
    if (googleStatus === "cancelled") {
      return {
        type: "warn" as const,
        text: "Google connection was cancelled on the consent screen.",
      };
    }
    if (googleStatus === "failed") {
      return {
        type: "error" as const,
        text: "Google authorization failed or the verification state expired.",
      };
    }
    return null;
  }, [searchParams]);

  const notice = actionNotice || urlNotice;

  // Authorize Google Provider
  const authorizeGoogle = useMutation({
    mutationFn: (provider: string) => api.googleAuthorizeUrl(projectId!, provider, "/settings?tab=integrations"),
    onSuccess: ({ authorizationUrl }) => {
      window.location.href = authorizationUrl;
    },
    onError: (err) => setActionNotice({ type: "error", text: errorMessage(err) }),
  });

  // Disconnect Google Provider
  const disconnectGoogle = useMutation({
    mutationFn: (provider: string) => api.googleDisconnect(projectId!, provider),
    onSuccess: () => {
      setActionNotice({ type: "success", text: "Disconnected integration successfully." });
      qc.removeQueries({ queryKey: ["ga4-realtime", projectId] });
      qc.invalidateQueries({ queryKey: ["google-connections", projectId] });
      qc.invalidateQueries({ queryKey: ["gsc-summary"] });
      qc.invalidateQueries({ queryKey: ["ga4-summary"] });
      qc.invalidateQueries({ queryKey: ["ga4-report"] });
    },
    onError: (err) => setActionNotice({ type: "error", text: errorMessage(err) }),
  });

  // Manual Sync Google Provider
  const syncGoogle = useMutation({
    mutationFn: async (provider: string) => {
      if (provider === "search_console") return api.gscSync(projectId!, 28);
      if (provider === "analytics") return api.ga4Sync(projectId!, 28);
    },
    onSuccess: () => {
      setActionNotice({ type: "success", text: "Manual sync triggered successfully." });
      qc.invalidateQueries({ queryKey: ["ga4-realtime", projectId] });
      qc.invalidateQueries({ queryKey: ["google-connections", projectId] });
      qc.invalidateQueries({ queryKey: ["gsc-summary"] });
      qc.invalidateQueries({ queryKey: ["ga4-summary"] });
      qc.invalidateQueries({ queryKey: ["ga4-report"] });
    },
    onError: (err) => setActionNotice({ type: "error", text: errorMessage(err) }),
  });

  const isGitHubConnected = Boolean(repo.data?.owner && repo.data?.name);

  const openGitHubModal = () => {
    setGithubModalOpen(true);
  };

  const handleDisconnectGitHub = async () => {
    try {
      await disconnectRepo.mutateAsync();
      setActionNotice({ type: "success", text: "GitHub repository disconnected from this workspace." });
    } catch (err) {
      setActionNotice({ type: "error", text: errorMessage(err) });
    }
  };

  const isGscConnected = gsc?.status === "CONNECTED";
  const isGscNeedsSelection = gsc?.status === "NEEDS_SELECTION";
  const isGa4Connected = ga4?.status === "CONNECTED";
  const isGa4NeedsSelection = ga4?.status === "NEEDS_SELECTION";

  return (
    <div className="space-y-6">
      {notice && (
        <div
          className={`flex items-start justify-between rounded-xl border p-4 text-xs ${
            notice.type === "success"
              ? "border-success-200 bg-success-50 text-success-800"
              : notice.type === "error"
                ? "border-error-200 bg-error-50 text-error-800"
                : "border-warning-200 bg-warning-50 text-warning-800"
          }`}
        >
          <span>{notice.text}</span>
          <button
            type="button"
            onClick={() => setActionNotice(null)}
            className="ml-2 font-bold hover:opacity-75"
          >
            ✕
          </button>
        </div>
      )}

      <div>
        <div className="mb-3">
          <h2 className="text-base font-bold text-brand-950">Connected services</h2>
          <p className="text-xs text-brand-500">Connect the tools you want Reigel to use.</p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Google Search Console */}
          <section className="rounded-2xl border border-brand-200 bg-surface-1 p-4 shadow-2xs transition hover:border-brand-300">
            <div className="flex items-center justify-between gap-3.5">
              <div className="flex min-w-0 flex-1 items-center gap-3.5">
                <GoogleSearchConsoleLogo />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold text-brand-950">Google Search Console</h3>
                    {isGscConnected && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-success-50 px-2 py-0.5 text-[10px] font-semibold text-success-700">
                        <span className="h-1.5 w-1.5 rounded-full bg-success-500" />
                        Connected
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-brand-500">
                    {isGscConnected && gsc?.selectedResourceName
                      ? gsc.selectedResourceName
                      : "Search queries, clicks, impressions & indexing"}
                  </p>
                </div>
              </div>
              {isGscConnected ? (
                <button
                  type="button"
                  onClick={() => setExpandedConnector(expandedConnector === "gsc" ? null : "gsc")}
                  className="shrink-0 rounded-lg border border-brand-200 px-3 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-50"
                >
                  {expandedConnector === "gsc" ? "Done" : "Manage"}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={(!isGscNeedsSelection && (authorizeGoogle.isPending || !projectId || googleQuery.isLoading || googleQuery.isError))}
                  onClick={() => isGscNeedsSelection ? setShowGscPicker(!showGscPicker) : authorizeGoogle.mutate("search_console")}
                  className="shrink-0 rounded-lg bg-primary-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
                >
                  {googleQuery.isLoading ? "Checking…" : googleQuery.isError ? "Unavailable" : isGscNeedsSelection ? "Select property" : "Connect"}
                </button>
              )}
            </div>
            {expandedConnector === "gsc" && isGscConnected && (
              <div className="mt-4 space-y-3 border-t border-brand-100 pt-3 text-xs text-brand-600">
                <div className="space-y-1">
                  <p><span className="font-semibold text-brand-800">Account</span> · {accountLabel(gsc)}</p>
                  <p><span className="font-semibold text-brand-800">Property</span> · {gsc?.selectedResourceName || "Not selected"}</p>
                  <p><span className="font-semibold text-brand-800">Last sync</span> · {gsc?.lastSyncedAt ? relativeTime(gsc.lastSyncedAt) : "Not synced yet"}</p>
                </div>
                {projectId && showGscPicker && <PropertyPicker provider="search_console" projectId={projectId} />}
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => setShowGscPicker(!showGscPicker)} className="rounded-lg border border-brand-200 px-2.5 py-1.5 font-medium text-brand-700 hover:bg-brand-50">{showGscPicker ? "Hide property picker" : "Change property"}</button>
                  <button type="button" disabled={syncGoogle.isPending} onClick={() => syncGoogle.mutate("search_console")} className="rounded-lg border border-brand-200 px-2.5 py-1.5 font-medium text-brand-700 hover:bg-brand-50">{syncGoogle.isPending ? "Syncing…" : "Sync now"}</button>
                  <button type="button" disabled={disconnectGoogle.isPending} onClick={() => disconnectGoogle.mutate("search_console")} className="rounded-lg border border-error-200 px-2.5 py-1.5 font-medium text-error-700 hover:bg-error-50">{disconnectGoogle.isPending ? "Disconnecting…" : "Disconnect"}</button>
                </div>
              </div>
            )}
            {!isGscConnected && isGscNeedsSelection && showGscPicker && projectId && (
              <div className="mt-3 border-t border-brand-100 pt-3"><PropertyPicker provider="search_console" projectId={projectId} /></div>
            )}
          </section>

          {/* Google Analytics */}
          <section className="rounded-2xl border border-brand-200 bg-surface-1 p-4 shadow-2xs transition hover:border-brand-300">
            <div className="flex items-center justify-between gap-3.5">
              <div className="flex min-w-0 flex-1 items-center gap-3.5">
                <GoogleAnalyticsLogo />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold text-brand-950">Google Analytics</h3>
                    {isGa4Connected && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-success-50 px-2 py-0.5 text-[10px] font-semibold text-success-700">
                        <span className="h-1.5 w-1.5 rounded-full bg-success-500" />
                        Connected
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-brand-500">
                    {isGa4Connected && ga4?.selectedResourceName
                      ? ga4.selectedResourceName
                      : "Organic traffic, sessions & engagement metrics"}
                  </p>
                </div>
              </div>
              {isGa4Connected ? (
                <button
                  type="button"
                  onClick={() => setExpandedConnector(expandedConnector === "ga4" ? null : "ga4")}
                  className="shrink-0 rounded-lg border border-brand-200 px-3 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-50"
                >
                  {expandedConnector === "ga4" ? "Done" : "Manage"}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={(!isGa4NeedsSelection && (authorizeGoogle.isPending || !projectId || googleQuery.isLoading || googleQuery.isError))}
                  onClick={() => isGa4NeedsSelection ? setShowGa4Picker(!showGa4Picker) : authorizeGoogle.mutate("analytics")}
                  className="shrink-0 rounded-lg bg-primary-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
                >
                  {googleQuery.isLoading ? "Checking…" : googleQuery.isError ? "Unavailable" : isGa4NeedsSelection ? "Select property" : "Connect"}
                </button>
              )}
            </div>
            {expandedConnector === "ga4" && isGa4Connected && (
              <div className="mt-4 space-y-3 border-t border-brand-100 pt-3 text-xs text-brand-600">
                <div className="space-y-1">
                  <p><span className="font-semibold text-brand-800">Account</span> · {accountLabel(ga4)}</p>
                  <p><span className="font-semibold text-brand-800">Property</span> · {ga4?.selectedResourceName || "Not selected"}</p>
                  <p><span className="font-semibold text-brand-800">Last sync</span> · {ga4?.lastSyncedAt ? relativeTime(ga4.lastSyncedAt) : "Not synced yet"}</p>
                </div>
                {projectId && showGa4Picker && <PropertyPicker provider="analytics" projectId={projectId} />}
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => setShowGa4Picker(!showGa4Picker)} className="rounded-lg border border-brand-200 px-2.5 py-1.5 font-medium text-brand-700 hover:bg-brand-50">{showGa4Picker ? "Hide property picker" : "Change property"}</button>
                  <button type="button" disabled={syncGoogle.isPending} onClick={() => syncGoogle.mutate("analytics")} className="rounded-lg border border-brand-200 px-2.5 py-1.5 font-medium text-brand-700 hover:bg-brand-50">{syncGoogle.isPending ? "Syncing…" : "Sync now"}</button>
                  <button type="button" disabled={disconnectGoogle.isPending} onClick={() => disconnectGoogle.mutate("analytics")} className="rounded-lg border border-error-200 px-2.5 py-1.5 font-medium text-error-700 hover:bg-error-50">{disconnectGoogle.isPending ? "Disconnecting…" : "Disconnect"}</button>
                </div>
              </div>
            )}
            {!isGa4Connected && isGa4NeedsSelection && showGa4Picker && projectId && (
              <div className="mt-3 border-t border-brand-100 pt-3"><PropertyPicker provider="analytics" projectId={projectId} /></div>
            )}
          </section>

          {/* Google Places */}
          <section className="rounded-2xl border border-brand-200 bg-surface-1 p-4 shadow-2xs transition hover:border-brand-300">
            <div className="flex items-center justify-between gap-3.5">
              <div className="flex min-w-0 flex-1 items-center gap-3.5">
                <GooglePlacesLogo />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold text-brand-950">Google Places</h3>
                    {Boolean(localSeo.data?.businessName) && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-success-50 px-2 py-0.5 text-[10px] font-semibold text-success-700">
                        <span className="h-1.5 w-1.5 rounded-full bg-success-500" />
                        Connected
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-brand-500">
                    {localSeo.data?.businessName
                      ? `${localSeo.data.businessName}${localSeo.data.reviewCount ? ` · ${localSeo.data.rating.toFixed(1)} ★ (${localSeo.data.reviewCount})` : ""}`
                      : "Google Business Profile, reviews & local pack"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={localSeo.isLoading || localSeo.isError}
                onClick={() => { window.location.href = "/clients?tab=local"; }}
                className="shrink-0 rounded-lg border border-brand-200 px-3 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-50"
              >
                {localSeo.isLoading ? "Checking…" : localSeo.isError ? "Unavailable" : localSeo.data?.businessName ? "Manage" : "Set up"}
              </button>
            </div>
          </section>

          {/* GitHub */}
          <section className="rounded-2xl border border-brand-200 bg-surface-1 p-4 shadow-2xs transition hover:border-brand-300">
            <div className="flex items-center justify-between gap-3.5">
              <div className="flex min-w-0 flex-1 items-center gap-3.5">
                <GitHubLogo />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold text-brand-950">GitHub</h3>
                    {isGitHubConnected && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-success-50 px-2 py-0.5 text-[10px] font-semibold text-success-700">
                        <span className="h-1.5 w-1.5 rounded-full bg-success-500" />
                        Connected
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-brand-500">
                    {isGitHubConnected
                      ? `${repo.data?.owner}/${repo.data?.name}`
                      : "Automated Pull Requests for code & template fixes"}
                  </p>
                </div>
              </div>
              {isGitHubConnected ? (
                <button
                  type="button"
                  onClick={() => setExpandedConnector(expandedConnector === "github" ? null : "github")}
                  className="shrink-0 rounded-lg border border-brand-200 px-3 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-50"
                >
                  {expandedConnector === "github" ? "Done" : "Manage"}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={repo.isLoading || repo.isError}
                  onClick={openGitHubModal}
                  className="shrink-0 rounded-lg bg-primary-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-primary-700"
                >
                  {repo.isLoading ? "Checking…" : repo.isError ? "Unavailable" : "Connect"}
                </button>
              )}
            </div>
            {expandedConnector === "github" && isGitHubConnected && (
              <div className="mt-4 space-y-3 border-t border-brand-100 pt-3 text-xs text-brand-600">
                <p className="font-mono text-brand-900">{repo.data?.owner}/{repo.data?.name}</p>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={openGitHubModal} className="rounded-lg border border-brand-200 px-2.5 py-1.5 font-medium text-brand-700 hover:bg-brand-50">Change repository</button>
                  <button type="button" disabled={disconnectRepo.isPending} onClick={handleDisconnectGitHub} className="rounded-lg border border-error-200 px-2.5 py-1.5 font-medium text-error-700 hover:bg-error-50 disabled:opacity-50">{disconnectRepo.isPending ? "Disconnecting…" : "Disconnect"}</button>
                </div>
              </div>
            )}
          </section>

          {/* WordPress CMS */}
          <section className="rounded-2xl border border-brand-200 bg-surface-1 p-4 shadow-2xs transition hover:border-brand-300">
            <div className="flex items-center justify-between gap-3.5">
              <div className="flex min-w-0 flex-1 items-center gap-3.5">
                <WordPressLogo />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold text-brand-950">WordPress CMS</h3>
                    {wpQuery.data?.connected && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-success-50 px-2 py-0.5 text-[10px] font-semibold text-success-700">
                        <span className="h-1.5 w-1.5 rounded-full bg-success-500" />
                        Connected
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-brand-500">
                    {wpQuery.data?.connected
                      ? `${wpQuery.data.siteUrl} · ${wpQuery.data.username} (${(wpQuery.data.seoPlugin || "core").toUpperCase()})`
                      : "Stage SEO revisions via Application Password"}
                  </p>
                </div>
              </div>
              {wpQuery.data?.connected ? (
                <div className="flex shrink-0 items-center gap-1.5">
                  <button type="button" onClick={() => setCmsModalPlatform("wordpress")} className="rounded-lg border border-brand-200 px-2.5 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-50">
                    Change
                  </button>
                  <button type="button" disabled={disconnectWp.isPending} onClick={() => disconnectWp.mutate()} className="rounded-lg border border-error-200 px-2.5 py-1.5 text-xs font-semibold text-error-700 hover:bg-error-50">
                    {disconnectWp.isPending ? "Disconnecting…" : "Disconnect"}
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => setCmsModalPlatform("wordpress")} className="shrink-0 rounded-lg bg-primary-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-primary-700">
                  Connect
                </button>
              )}
            </div>
          </section>

          {/* Shopify */}
          <section className="rounded-2xl border border-brand-200 bg-surface-1 p-4 shadow-2xs transition hover:border-brand-300">
            <div className="flex items-center justify-between gap-3.5">
              <div className="flex min-w-0 flex-1 items-center gap-3.5">
                <ShopifyLogo />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold text-brand-950">Shopify</h3>
                    {shopifyQuery.data?.connected && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-success-50 px-2 py-0.5 text-[10px] font-semibold text-success-700">
                        <span className="h-1.5 w-1.5 rounded-full bg-success-500" />
                        Connected
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-brand-500">
                    {shopifyQuery.data?.connected
                      ? `${shopifyQuery.data.storeDomain}${shopifyQuery.data.shopName ? ` · ${shopifyQuery.data.shopName}` : ""}`
                      : "Update page, product & article SEO via Admin API"}
                  </p>
                </div>
              </div>
              {shopifyQuery.data?.connected ? (
                <div className="flex shrink-0 items-center gap-1.5">
                  <button type="button" onClick={() => setCmsModalPlatform("shopify")} className="rounded-lg border border-brand-200 px-2.5 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-50">
                    Change
                  </button>
                  <button type="button" disabled={disconnectShopify.isPending} onClick={() => disconnectShopify.mutate()} className="rounded-lg border border-error-200 px-2.5 py-1.5 text-xs font-semibold text-error-700 hover:bg-error-50">
                    {disconnectShopify.isPending ? "Disconnecting…" : "Disconnect"}
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => setCmsModalPlatform("shopify")} className="shrink-0 rounded-lg bg-primary-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-primary-700">
                  Connect
                </button>
              )}
            </div>
          </section>

          {/* Webflow */}
          <section className="rounded-2xl border border-brand-200 bg-surface-1 p-4 shadow-2xs transition hover:border-brand-300">
            <div className="flex items-center justify-between gap-3.5">
              <div className="flex min-w-0 flex-1 items-center gap-3.5">
                <WebflowLogo />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold text-brand-950">Webflow</h3>
                    {webflowQuery.data?.connected && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-success-50 px-2 py-0.5 text-[10px] font-semibold text-success-700">
                        <span className="h-1.5 w-1.5 rounded-full bg-success-500" />
                        Connected
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-brand-500">
                    {webflowQuery.data?.connected
                      ? `${webflowQuery.data.siteName || webflowQuery.data.siteId}${webflowQuery.data.customDomain ? ` · ${webflowQuery.data.customDomain}` : ""}`
                      : "Update page SEO & Open Graph via Webflow v2 API"}
                  </p>
                </div>
              </div>
              {webflowQuery.data?.connected ? (
                <div className="flex shrink-0 items-center gap-1.5">
                  <button type="button" onClick={() => setCmsModalPlatform("webflow")} className="rounded-lg border border-brand-200 px-2.5 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-50">
                    Change
                  </button>
                  <button type="button" disabled={disconnectWebflow.isPending} onClick={() => disconnectWebflow.mutate()} className="rounded-lg border border-error-200 px-2.5 py-1.5 text-xs font-semibold text-error-700 hover:bg-error-50">
                    {disconnectWebflow.isPending ? "Disconnecting…" : "Disconnect"}
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => setCmsModalPlatform("webflow")} className="shrink-0 rounded-lg bg-primary-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-primary-700">
                  Connect
                </button>
              )}
            </div>
          </section>
        </div>
      </div>

      {cmsModalPlatform && projectId && (
        <WordPressConnectModal
          projectId={projectId}
          initialPlatform={cmsModalPlatform}
          existingSiteUrl={wpQuery.data?.siteUrl}
          existingUsername={wpQuery.data?.username}
          defaultSiteUrl={
            cmsModalPlatform === "shopify"
              ? shopifyQuery.data?.storeDomain
              : cmsModalPlatform === "webflow"
                ? webflowQuery.data?.customDomain
                : wpQuery.data?.siteUrl
          }
          onClose={() => setCmsModalPlatform(null)}
          onConnected={(info) => {
            setCmsModalPlatform(null);
            qc.invalidateQueries({ queryKey: ["wordpress-connection", projectId] });
            qc.invalidateQueries({ queryKey: ["shopify-connection", projectId] });
            qc.invalidateQueries({ queryKey: ["webflow-connection", projectId] });
            setActionNotice({
              type: "success",
              text: `${(info.platform || cmsModalPlatform).toUpperCase()} connected (${info.siteUrl}).`,
            });
          }}
        />
      )}

      {/* Unified Google -> GitHub -> Select Project -> Share with Coding Agent Modal */}
      {githubModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Connect GitHub Project to Reigel Coding Agent"
          onClick={(e) => {
            if (e.target === e.currentTarget) setGithubModalOpen(false);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto overscroll-contain bg-black/75 p-3 sm:p-4 backdrop-blur-xs"
        >
          <GitHubAgentConnectWorkflow
            projectId={projectId}
            projectDomain={currentDomain}
            userEmail={user?.email}
            existingRepo={repo.data ?? null}
            mode="modal"
            oauthCode={githubOauthCode}
            oauthState={githubOauthState}
            installationId={githubInstallationId}
            onCancel={() => setGithubModalOpen(false)}
            onConnected={(connected) => {
              setGithubModalOpen(false);
              qc.invalidateQueries({ queryKey: ["repository", projectId] });
              qc.invalidateQueries({ queryKey: ["automation-repo", projectId] });
              setActionNotice({
                type: "success",
                text: `GitHub repository ${connected.owner}/${connected.name} (${connected.defaultBranch}) authenticated via github.com and connected to Reigel Coding Agent.`,
              });
            }}
          />
        </div>
      )}
    </div>
  );
}

/* =========================================================================
   2. WEBSITES VIEW
   ========================================================================= */

function WebsitesView() {
  const { orgId, projectId } = useWorkspace();
  const portfolio = usePortfolio(orgId);
  const clients = portfolio.data?.clients ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-bold text-brand-950">Websites</h2>
        <p className="text-xs text-brand-500">Manage tracked websites, domains, and automated audit cadences</p>
      </div>

      <div className="space-y-3">
        {clients.map((c) => (
          <div
            key={c.projectId}
            className={`flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-white p-4 shadow-2xs ${
              c.projectId === projectId ? "ring-1 ring-primary-500" : ""
            }`}
          >
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-brand-950">{c.name || c.domain}</h3>
                {c.projectId === projectId && (
                  <span className="rounded-full bg-primary-50 px-2 py-0.5 text-[10.5px] font-bold text-primary-700">
                    Active
                  </span>
                )}
              </div>
              <p className="text-xs text-brand-500">{c.domain}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-brand-500">
                Audited: {c.lastCrawledAt ? new Date(c.lastCrawledAt).toLocaleDateString() : "Pending"}
              </span>
              <button
                type="button"
                onClick={() => {
                  window.location.href = `/website`;
                }}
                className="rounded-lg border px-3 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-50"
              >
                View Audit
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* =========================================================================
   3. CREDITS VIEW
   ========================================================================= */

function CreditsView() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-bold text-brand-950">Credits & Tokens</h2>
        <p className="text-xs text-brand-500">Monitor token consumption, active allocations, and plan allowances</p>
      </div>

      <div className="rounded-2xl border bg-white p-6 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-brand-400">Available Balance</p>
            <p className="mt-1 text-3xl font-extrabold text-brand-950">2.633M tokens</p>
            <p className="mt-1 text-xs text-brand-500">Refills on 1 November 2026</p>
          </div>
          <button
            type="button"
            className="rounded-xl bg-primary-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-primary-700"
          >
            Upgrade Plan
          </button>
        </div>

        <div className="mt-6 border-t pt-5">
          <p className="mb-2 text-xs font-semibold text-brand-700">Usage by Engine</p>
          <div className="space-y-2">
            <div>
              <div className="flex justify-between text-xs text-brand-600">
                <span>Fix Engine & Code Synthesis</span>
                <span className="font-mono">1.12M tokens</span>
              </div>
              <div className="mt-1 h-2 w-full rounded-full bg-brand-100">
                <div className="h-2 rounded-full bg-primary-600" style={{ width: "42%" }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs text-brand-600">
                <span>AI Visibility Sampling</span>
                <span className="font-mono">840K tokens</span>
              </div>
              <div className="mt-1 h-2 w-full rounded-full bg-brand-100">
                <div className="h-2 rounded-full bg-signal-400" style={{ width: "32%" }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs text-brand-600">
                <span>Backlink & Competitor Intelligence</span>
                <span className="font-mono">673K tokens</span>
              </div>
              <div className="mt-1 h-2 w-full rounded-full bg-brand-100">
                <div className="h-2 rounded-full bg-brand-500" style={{ width: "26%" }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   4. AGENTS VIEW
   ========================================================================= */

function AgentsView() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-bold text-brand-950">Autonomous Agents</h2>
        <p className="text-xs text-brand-500">Configure background crawling and auto-remediation behaviors</p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <div className="rounded-2xl border bg-white p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-brand-950">Fix Engine Remediation Agent</h3>
              <p className="text-xs text-brand-500">Automatically creates GitHub pull requests for identified issues</p>
            </div>
            <span className="rounded-full bg-success-50 px-2.5 py-0.5 text-xs font-semibold text-success-700">
              Active
            </span>
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-brand-950">Continuous Website Audit Agent</h3>
              <p className="text-xs text-brand-500">Runs weekly health audits and core web vitals inspections</p>
            </div>
            <span className="rounded-full bg-success-50 px-2.5 py-0.5 text-xs font-semibold text-success-700">
              Scheduled
            </span>
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-brand-950">AI Visibility & Brand Monitor</h3>
              <p className="text-xs text-brand-500">Samples ChatGPT, Claude, and Perplexity daily for brand share</p>
            </div>
            <span className="rounded-full bg-success-50 px-2.5 py-0.5 text-xs font-semibold text-success-700">
              Active
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   5. SKILLS & MCP VIEW
   ========================================================================= */

function SkillsMcpView() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-bold text-brand-950">Skills & MCP Connectors</h2>
        <p className="text-xs text-brand-500">Model Context Protocol tools and custom SEO intelligence skills</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border bg-white p-5 shadow-2xs">
          <h3 className="font-bold text-brand-950">Crawler Core MCP</h3>
          <p className="mt-0.5 text-xs text-brand-500">Robots-aware, headless renderer and DOM extractor</p>
          <div className="mt-4 flex items-center justify-between border-t pt-2 text-xs">
            <span className="text-success-700 font-medium">● Operational</span>
            <span className="text-brand-400">v3.2</span>
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-2xs">
          <h3 className="font-bold text-brand-950">Multi-AI Router MCP</h3>
          <p className="mt-0.5 text-xs text-brand-500">Queries Claude, OpenAI, and Sarvam with zero hallucination gates</p>
          <div className="mt-4 flex items-center justify-between border-t pt-2 text-xs">
            <span className="text-success-700 font-medium">● Operational</span>
            <span className="text-brand-400">v2.8</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   6. TEAM SETTINGS VIEW
   ========================================================================= */

const ROLE_OPTIONS: Role[] = ["OWNER", "ADMIN", "MEMBER", "VIEWER"];

function TeamSettingsView() {
  const { orgId } = useWorkspace();
  const members = useMembers(orgId);
  const addMember = useAddMember(orgId);
  const updateRole = useUpdateMemberRole(orgId);
  const removeMember = useRemoveMember(orgId);

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("MEMBER");
  const [error, setError] = useState("");

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setError("");
    try {
      await addMember.mutateAsync({ email: email.trim(), role });
      setEmail("");
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-bold text-brand-950">Team & Permissions</h2>
        <p className="text-xs text-brand-500">Invite colleagues and manage role-based workspace permissions</p>
      </div>

      <div className="overflow-hidden rounded-2xl border bg-white p-6 shadow-2xs">
        <form onSubmit={handleInvite} className="flex flex-wrap gap-2">
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="colleague@yourbusiness.in"
            className="flex-1 rounded-xl border p-2.5 text-xs text-brand-900"
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            className="rounded-xl border p-2.5 text-xs text-brand-900"
          >
            {ROLE_OPTIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={addMember.isPending || !email.trim()}
            className="rounded-xl bg-primary-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-primary-700 disabled:opacity-50"
          >
            {addMember.isPending ? "Inviting…" : "Invite Member"}
          </button>
        </form>
        {error && <p className="mt-2 text-xs text-error-600">{error}</p>}

        <div className="mt-6 divide-y border-t">
          {members.data?.map((m) => (
            <div key={m.id} className="flex items-center justify-between py-3">
              <div>
                <p className="text-xs font-bold text-brand-950">{m.email}</p>
                <p className="text-[11px] text-brand-400">Role: {m.role}</p>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={m.role}
                  onChange={(e) => updateRole.mutate({ memberId: m.id, role: e.target.value as Role })}
                  className="rounded-lg border p-1 text-xs text-brand-700"
                >
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => removeMember.mutate(m.id)}
                  className="rounded-lg p-1 text-brand-400 hover:text-error-600"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   7. PERSONALIZATION VIEW
   ========================================================================= */

function PersonalizationView() {
  const [tone, setTone] = useState("Professional & Authoritative");
  const [market, setMarket] = useState("India (National)");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-bold text-brand-950">Chat & Content Personalization</h2>
        <p className="text-xs text-brand-500">Fine-tune tone, editorial style, and audience positioning</p>
      </div>

      <div className="rounded-2xl border bg-white p-6 shadow-2xs space-y-4">
        <div>
          <label className="block text-xs font-semibold text-brand-700 mb-1">Tone of Voice</label>
          <select
            value={tone}
            onChange={(e) => setTone(e.target.value)}
            className="w-full rounded-xl border p-2.5 text-xs text-brand-900"
          >
            <option>Professional & Authoritative</option>
            <option>Conversational & Direct</option>
            <option>Technical & Data-driven</option>
            <option>Approachable & Friendly</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-brand-700 mb-1">Primary Market</label>
          <input
            type="text"
            value={market}
            onChange={(e) => setMarket(e.target.value)}
            className="w-full rounded-xl border p-2.5 text-xs text-brand-900"
          />
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   8. ACCOUNT & SECURITY VIEW
   ========================================================================= */

function AccountSecurityView() {
  const profile = useProfile();
  const user = profile.data;
  const router = useRouter();
  const qc = useQueryClient();

  const handleLogout = async () => {
    await api.logout();
    qc.clear();
    router.replace("/login");
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-bold text-brand-950">Account & Security</h2>
        <p className="text-xs text-brand-500">Manage credentials, authentication methods, and security settings</p>
      </div>

      <div className="rounded-2xl border bg-white p-6 shadow-2xs space-y-4">
        <div>
          <label className="block text-xs font-semibold text-brand-400 uppercase tracking-wider mb-1">Email</label>
          <input
            value={user?.email || "user@reigel.in"}
            disabled
            readOnly
            className="w-full rounded-xl border bg-brand-50/50 p-2.5 text-xs text-brand-900"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-brand-400 uppercase tracking-wider mb-1">Authentication</label>
          <p className="text-xs text-brand-700">
            {user?.googleId ? "Google OAuth 2.0 (Single Sign-On)" : "Standard Email & Password"}
          </p>
        </div>

        <div className="pt-4 border-t flex justify-between items-center">
          <div>
            <p className="text-xs font-semibold text-brand-950">Sign Out</p>
            <p className="text-[11px] text-brand-500">Log out of your current session on this browser</p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-xl border border-error-200 px-3.5 py-1.5 text-xs font-semibold text-error-600 hover:bg-error-50"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   9. DEVICES VIEW
   ========================================================================= */

function DevicesView() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-bold text-brand-950">Devices & Active Sessions</h2>
        <p className="text-xs text-brand-500">Browsers and devices currently authorized to access this workspace</p>
      </div>

      <div className="rounded-2xl border bg-white p-6 shadow-2xs space-y-3">
        <div className="flex items-center justify-between py-2 border-b">
          <div className="flex items-center gap-3">
            <Smartphone size={18} className="text-brand-500" />
            <div>
              <p className="text-xs font-bold text-brand-950">Chrome on macOS (Current device)</p>
              <p className="text-[11px] text-brand-400">IP: 49.36.182.20 · Mumbai, India</p>
            </div>
          </div>
          <span className="rounded-full bg-success-50 px-2 py-0.5 text-[10.5px] font-semibold text-success-700">
            Active Now
          </span>
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   10. SUBSCRIPTION VIEW
   ========================================================================= */

function SubscriptionView() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-bold text-brand-950">Subscription & Billing</h2>
        <p className="text-xs text-brand-500">Manage plan tier, monthly allowances, and invoices</p>
      </div>

      <div className="rounded-2xl border bg-white p-6 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="rounded-full bg-primary-50 px-2.5 py-0.5 text-xs font-bold text-primary-700">
              Agency Pro Plan
            </span>
            <p className="mt-2 text-2xl font-black text-brand-950">₹7,999 / month</p>
            <p className="text-xs text-brand-500">Next billing date: 1 November 2026</p>
          </div>
          <button
            type="button"
            className="rounded-xl border px-4 py-2 text-xs font-semibold text-brand-700 hover:bg-brand-50"
          >
            Manage Billing
          </button>
        </div>
      </div>
    </div>
  );
}
