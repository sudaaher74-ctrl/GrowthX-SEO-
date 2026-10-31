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
} from "@/components/settings/integration-logos";
import { GitHubAgentConnectWorkflow } from "@/components/settings/github-agent-connect-workflow";
import {
  useConnectRepository,
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
  const rawTab = (searchParams?.get("tab") as SettingsTab) || "integrations";

  const [activeTab, setActiveTab] = useState<SettingsTab>(rawTab);

  useEffect(() => {
    const tab = searchParams?.get("tab") as SettingsTab;
    if (tab) setActiveTab(tab);
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
              <SidebarItem
                label="Skills & MCP"
                icon={<Compass size={15} />}
                active={activeTab === "skills"}
                onClick={() => setTab("skills")}
              />
              <SidebarItem
                label="Team"
                icon={<Users size={15} />}
                hasDot
                active={activeTab === "team"}
                onClick={() => setTab("team")}
              />
            </nav>
          </div>

          {/* CHAT Category */}
          <div>
            <p className="mb-1.5 px-3 text-[11px] font-bold uppercase tracking-wider text-brand-400">
              Chat
            </p>
            <nav className="space-y-0.5">
              <SidebarItem
                label="Personalization"
                icon={<UserCircle size={15} />}
                active={activeTab === "personalization"}
                onClick={() => setTab("personalization")}
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
                label="Devices"
                icon={<Smartphone size={15} />}
                active={activeTab === "devices"}
                onClick={() => setTab("devices")}
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
  const { projectId } = useWorkspace();
  const qc = useQueryClient();
  const searchParams = useSearchParams();
  const profile = useProfile();
  const user = profile.data;

  const repo = useRepository(projectId);
  const connectRepo = useConnectRepository(projectId);
  const localSeo = useLocalSeo(projectId);

  // Google connections query
  const googleQuery = useQuery({
    queryKey: ["google-connections", projectId],
    queryFn: () => (projectId ? api.googleConnections(projectId) : null),
    enabled: Boolean(projectId),
  });

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
      await connectRepo.mutateAsync({
        owner: "",
        name: "",
        accessToken: "",
      });
      setActionNotice({ type: "success", text: "GitHub repository disconnected." });
    } catch (err) {
      setActionNotice({ type: "error", text: errorMessage(err) });
    }
  };

  const isGscConnected = gsc?.status === "CONNECTED";
  const isGscNeedsSelection = gsc?.status === "NEEDS_SELECTION";
  const isGa4Connected = ga4?.status === "CONNECTED";
  const isGa4NeedsSelection = ga4?.status === "NEEDS_SELECTION";

  return (
    <div className="space-y-8">
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

      {/* Info Notice Banner */}
      <div className="flex items-start gap-2.5 rounded-xl border border-brand-200/80 bg-brand-50/50 p-3.5 text-xs text-brand-600">
        <Info size={16} className="mt-0.5 shrink-0 text-brand-400" />
        <span>
          Connect your Google services and GitHub repository to enable live ranking analytics, visitor traffic syncing, and automated technical pull requests.
        </span>
      </div>

      {/* 1. Search, Analytics & Local SEO */}
      <div>
        <div className="mb-3">
          <h2 className="text-base font-bold text-brand-950">Search, Analytics & Local SEO</h2>
          <p className="text-xs text-brand-500">
            Authoritative Google Search Console metrics, GA4 visitor telemetry, and Google Places synchronization
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Google Search Console */}
          <div className="flex flex-col justify-between rounded-2xl border bg-surface-1 p-5 shadow-2xs transition-colors hover:border-brand-300">
            <div>
              <div className="flex items-start gap-3.5">
                <GoogleSearchConsoleLogo />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate text-sm font-bold text-brand-950">Google Search Console</h3>
                    {isGscConnected && (
                      <span className="inline-flex items-center rounded-full border border-success-200 bg-success-50 px-2 py-0.5 text-[10.5px] font-semibold text-success-700">
                        Connected
                      </span>
                    )}
                    {isGscNeedsSelection && (
                      <span className="inline-flex items-center rounded-full border border-warning-200 bg-warning-50 px-2 py-0.5 text-[10.5px] font-semibold text-warning-700">
                        Select Property
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-brand-500">
                    Provides authoritative organic impressions, verified clicks, CTR, and keyword rankings.
                  </p>
                </div>
              </div>

              {isGscConnected && (
                <div className="mt-4 rounded-xl bg-surface-2 p-3 text-[11px] text-brand-600 space-y-1">
                  <p>
                    <span className="font-semibold text-brand-700">Account:</span> {accountLabel(gsc)}
                  </p>
                  <p>
                    <span className="font-semibold text-brand-700">Property:</span> {gsc?.selectedResourceName || "None selected"}
                  </p>
                  <p>
                    <span className="font-semibold text-brand-700">Last Synced:</span>{" "}
                    {gsc?.lastSyncedAt ? relativeTime(gsc.lastSyncedAt) : "Pending"}
                  </p>
                </div>
              )}

              {projectId && (isGscNeedsSelection || showGscPicker) && (
                <div className="mt-3 border-t border-brand-100 pt-3">
                  <PropertyPicker provider="search_console" projectId={projectId} />
                </div>
              )}
            </div>

            <div className="mt-5 flex items-center justify-between border-t border-brand-100 pt-3">
              {isGscConnected ? (
                <div className="flex items-center gap-1.5 text-xs font-medium text-brand-600 truncate max-w-[180px]">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-success-500" />
                  <span className="truncate">{gsc?.selectedResourceName || "Connected"}</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-xs text-brand-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-brand-300" />
                  <span>Not connected</span>
                </div>
              )}

              <div className="flex items-center gap-1.5">
                {isGscConnected ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setShowGscPicker(!showGscPicker)}
                      className="rounded-lg border border-brand-200 bg-surface-2 px-2.5 py-1 text-xs font-medium text-brand-700 hover:bg-brand-50"
                    >
                      {showGscPicker ? "Hide Picker" : "Change Property"}
                    </button>
                    <button
                      type="button"
                      disabled={syncGoogle.isPending}
                      onClick={() => syncGoogle.mutate("search_console")}
                      className="rounded-lg border border-brand-200 bg-surface-2 p-1 text-brand-700 hover:bg-brand-50"
                      title="Sync Now"
                    >
                      <RefreshCw size={13} className={syncGoogle.isPending ? "animate-spin" : ""} />
                    </button>
                    <button
                      type="button"
                      disabled={disconnectGoogle.isPending}
                      onClick={() => disconnectGoogle.mutate("search_console")}
                      className="rounded-lg border border-brand-200 bg-surface-2 px-2.5 py-1 text-xs font-medium text-brand-700 hover:bg-brand-50"
                    >
                      {disconnectGoogle.isPending ? "Disconnecting…" : "Disconnect"}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    disabled={authorizeGoogle.isPending || !projectId}
                    onClick={() => authorizeGoogle.mutate("search_console")}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-primary-600 px-4 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-primary-700 disabled:opacity-50"
                  >
                    <span>Connect Google</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Google Analytics 4 */}
          <div className="flex flex-col justify-between rounded-2xl border bg-surface-1 p-5 shadow-2xs transition-colors hover:border-brand-300">
            <div>
              <div className="flex items-start gap-3.5">
                <GoogleAnalyticsLogo />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate text-sm font-bold text-brand-950">Google Analytics 4</h3>
                    {isGa4Connected && (
                      <span className="inline-flex items-center rounded-full border border-success-200 bg-success-50 px-2 py-0.5 text-[10.5px] font-semibold text-success-700">
                        Connected
                      </span>
                    )}
                    {isGa4NeedsSelection && (
                      <span className="inline-flex items-center rounded-full border border-warning-200 bg-warning-50 px-2 py-0.5 text-[10.5px] font-semibold text-warning-700">
                        Select Property
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-brand-500">
                    Synchronizes visitor sessions, engaged landing pages, conversion rates, and channels.
                  </p>
                </div>
              </div>

              {isGa4Connected && (
                <div className="mt-4 rounded-xl bg-surface-2 p-3 text-[11px] text-brand-600 space-y-1">
                  <p>
                    <span className="font-semibold text-brand-700">Account:</span> {accountLabel(ga4)}
                  </p>
                  <p>
                    <span className="font-semibold text-brand-700">Property:</span> {ga4?.selectedResourceName || "None selected"}
                  </p>
                  <p>
                    <span className="font-semibold text-brand-700">Last Synced:</span>{" "}
                    {ga4?.lastSyncedAt ? relativeTime(ga4.lastSyncedAt) : "Pending"}
                  </p>
                </div>
              )}

              {projectId && (isGa4NeedsSelection || showGa4Picker) && (
                <div className="mt-3 border-t border-brand-100 pt-3">
                  <PropertyPicker provider="analytics" projectId={projectId} />
                </div>
              )}
            </div>

            <div className="mt-5 flex items-center justify-between border-t border-brand-100 pt-3">
              {isGa4Connected ? (
                <div className="flex items-center gap-1.5 text-xs font-medium text-brand-600 truncate max-w-[180px]">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-success-500" />
                  <span className="truncate">{ga4?.selectedResourceName || "Connected"}</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-xs text-brand-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-brand-300" />
                  <span>Not connected</span>
                </div>
              )}

              <div className="flex items-center gap-1.5">
                {isGa4Connected ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setShowGa4Picker(!showGa4Picker)}
                      className="rounded-lg border border-brand-200 bg-surface-2 px-2.5 py-1 text-xs font-medium text-brand-700 hover:bg-brand-50"
                    >
                      {showGa4Picker ? "Hide Picker" : "Change Property"}
                    </button>
                    <button
                      type="button"
                      disabled={syncGoogle.isPending}
                      onClick={() => syncGoogle.mutate("analytics")}
                      className="rounded-lg border border-brand-200 bg-surface-2 p-1 text-brand-700 hover:bg-brand-50"
                      title="Sync Now"
                    >
                      <RefreshCw size={13} className={syncGoogle.isPending ? "animate-spin" : ""} />
                    </button>
                    <button
                      type="button"
                      disabled={disconnectGoogle.isPending}
                      onClick={() => disconnectGoogle.mutate("analytics")}
                      className="rounded-lg border border-brand-200 bg-surface-2 px-2.5 py-1 text-xs font-medium text-brand-700 hover:bg-brand-50"
                    >
                      {disconnectGoogle.isPending ? "Disconnecting…" : "Disconnect"}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    disabled={authorizeGoogle.isPending || !projectId}
                    onClick={() => authorizeGoogle.mutate("analytics")}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-primary-600 px-4 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-primary-700 disabled:opacity-50"
                  >
                    <span>Connect GA4</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Google Places & Business Profile */}
          <div className="flex flex-col justify-between rounded-2xl border bg-surface-1 p-5 shadow-2xs transition-colors hover:border-brand-300">
            <div>
              <div className="flex items-start gap-3.5">
                <GooglePlacesLogo />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate text-sm font-bold text-brand-950">Google Places & Local SEO</h3>
                    {localSeo.data?.businessName && (
                      <span className="inline-flex items-center rounded-full border border-success-200 bg-success-50 px-2 py-0.5 text-[10.5px] font-semibold text-success-700">
                        Active
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-brand-500">
                    Synchronizes verified Google Reviews, star ratings, local rankings, and Maps presence.
                  </p>
                </div>
              </div>

              {localSeo.data?.businessName && (
                <div className="mt-4 rounded-xl bg-surface-2 p-3 text-[11px] text-brand-600 space-y-1">
                  <p>
                    <span className="font-semibold text-brand-700">Business:</span> {localSeo.data.businessName}
                  </p>
                  <p>
                    <span className="font-semibold text-brand-700">Rating:</span>{" "}
                    {localSeo.data.reviewCount ? `${localSeo.data.rating.toFixed(1)} ★ (${localSeo.data.reviewCount} reviews)` : "No ratings"}
                  </p>
                  <p>
                    <span className="font-semibold text-brand-700">Last Synced:</span>{" "}
                    {localSeo.data.updatedAt ? relativeTime(localSeo.data.updatedAt) : "Pending"}
                  </p>
                </div>
              )}
            </div>

            <div className="mt-5 flex items-center justify-between border-t border-brand-100 pt-3">
              {localSeo.data?.businessName ? (
                <div className="flex items-center gap-1.5 text-xs font-medium text-brand-600 truncate max-w-[180px]">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-success-500" />
                  <span className="truncate">{localSeo.data.businessName}</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-xs text-brand-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-brand-300" />
                  <span>Not configured</span>
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  window.location.href = "/clients?tab=local";
                }}
                className="inline-flex items-center gap-1 rounded-lg border border-brand-200 bg-surface-2 px-3 py-1 text-xs font-semibold text-brand-700 transition hover:bg-brand-50"
              >
                <span>View Local SEO</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Code Repository & Remediation */}
      <div>
        <div className="mb-3">
          <h2 className="text-base font-bold text-brand-950">Code Repository</h2>
          <p className="text-xs text-brand-500">
            Connect a GitHub repo so the SEO agent can open pull requests against it
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* GitHub Repository Card */}
          <div className="flex flex-col justify-between rounded-2xl border bg-surface-1 p-5 shadow-2xs transition-colors hover:border-brand-300">
            <div>
              <div className="flex items-start gap-3.5">
                <GitHubLogo />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate text-sm font-bold text-brand-950">GitHub</h3>
                    {isGitHubConnected && (
                      <span className="inline-flex items-center rounded-full border border-success-200 bg-success-50 px-2 py-0.5 text-[10.5px] font-semibold text-success-700">
                        Connected
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-brand-500">
                    Let the SEO agent open pull requests against your repository.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between pt-2">
              {isGitHubConnected ? (
                <div className="flex items-center gap-1.5 text-xs font-medium text-success-600 truncate max-w-[200px]">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-success-500" />
                  <span className="truncate font-mono">{repo.data?.owner}/{repo.data?.name}</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-xs font-medium text-warning-500">
                  <span className="h-2 w-2 rounded-full bg-warning-500" />
                  <span>Disconnected</span>
                </div>
              )}

              <div className="flex items-center gap-1.5">
                {isGitHubConnected ? (
                  <>
                    <button
                      type="button"
                      onClick={openGitHubModal}
                      className="rounded-lg border border-brand-200 bg-surface-2 px-3 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-50"
                    >
                      Change
                    </button>
                    <button
                      type="button"
                      disabled={connectRepo.isPending}
                      onClick={handleDisconnectGitHub}
                      className="rounded-lg border border-brand-200 bg-surface-2 px-3 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-50"
                    >
                      {connectRepo.isPending ? "Disconnecting…" : "Disconnect"}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={openGitHubModal}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-brand-950 px-4 py-1.5 text-xs font-semibold text-white shadow-2xs transition hover:bg-brand-800 disabled:opacity-50"
                  >
                    <span>Connect</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

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
