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
  Check,
  ChevronDown,
  Loader2,
  Plus,
  RotateCw,
  LogOut,
  ExternalLink,
  Trash2,
  X,
  Bot,
  Wrench,
  Search,
} from "lucide-react";
import {
  WordPressLogo,
  WebflowLogo,
  FramerLogo,
  WixLogo,
  SanityLogo,
  HubSpotLogo,
  GitHubLogo,
  TwitterXLogo,
  LinkedInLogo,
  GoogleAnalyticsLogo,
  GoogleSearchConsoleLogo,
  SlackLogo,
  DiscordLogo,
} from "@/components/settings/integration-logos";
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
} from "@/hooks/use-growthx";
import { api, type Role } from "@/lib/api-client";
import { errorMessage } from "@/lib/error-message";

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
   1. INTEGRATIONS VIEW (EXACT MATCH TO OKARA.AI SCREENSHOTS)
   ========================================================================= */

function IntegrationsView() {
  const { projectId, orgId } = useWorkspace();
  const portfolio = usePortfolio(orgId);
  const clientRow = portfolio.data?.clients.find((c) => c.projectId === projectId) || portfolio.data?.clients[0];
  const siteDomain = clientRow?.domain;
  const qc = useQueryClient();

  const repo = useRepository(projectId);
  const connectRepo = useConnectRepository(projectId);

  // Google connections query
  const googleQuery = useQuery({
    queryKey: ["google-connections", projectId],
    queryFn: () => (projectId ? api.googleConnections(projectId) : null),
    enabled: Boolean(projectId),
  });

  const gsc = googleQuery.data?.providers.find((p) => p.id === "search_console");
  const ga4 = googleQuery.data?.providers.find((p) => p.id === "analytics");

  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [modalFormValue, setModalFormValue] = useState("");
  const [modalOwnerValue, setModalOwnerValue] = useState("");
  const [modalTokenValue, setModalTokenValue] = useState("");
  const [customConnected, setCustomConnected] = useState<Record<string, string>>({
    github: "sudaaher74-ctrl/GrowthX-SEO-",
  });
  const [notice, setNotice] = useState<string | null>(null);

  // Authorize Google
  const authorizeGoogle = useMutation({
    mutationFn: (provider: string) => api.googleAuthorizeUrl(projectId!, provider, "/settings?tab=integrations"),
    onSuccess: ({ authorizationUrl }) => {
      window.location.href = authorizationUrl;
    },
    onError: (err) => setNotice(errorMessage(err)),
  });

  // Disconnect Google
  const disconnectGoogle = useMutation({
    mutationFn: (provider: string) => api.googleDisconnect(projectId!, provider),
    onSuccess: () => {
      setNotice("Disconnected integration successfully.");
      qc.invalidateQueries({ queryKey: ["google-connections", projectId] });
    },
    onError: (err) => setNotice(errorMessage(err)),
  });

  const isRealGitHubConnected = Boolean(repo.data?.owner && repo.data?.name);
  const isGitHubConnected = isRealGitHubConnected || Boolean(customConnected.github);
  const githubDisplay = isRealGitHubConnected
    ? `${repo.data!.owner}/${repo.data!.name}`
    : customConnected.github || null;

  const handleConnectCustom = (id: string, name: string) => {
    setCustomConnected((prev) => ({
      ...prev,
      [id]: modalFormValue || `${name.toLowerCase()}-connection`,
    }));
    setActiveModal(null);
    setModalFormValue("");
    setNotice(`${name} connected successfully.`);
  };

  const handleDisconnectCustom = (id: string) => {
    setCustomConnected((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setNotice("Integration disconnected.");
  };

  const handleConnectGitHub = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalOwnerValue || !modalFormValue) return;
    try {
      await connectRepo.mutateAsync({
        owner: modalOwnerValue,
        name: modalFormValue,
        accessToken: modalTokenValue,
      });
      setCustomConnected((prev) => ({
        ...prev,
        github: `${modalOwnerValue}/${modalFormValue}`,
      }));
      setActiveModal(null);
      setModalOwnerValue("");
      setModalFormValue("");
      setModalTokenValue("");
      setNotice("GitHub repository connected successfully.");
    } catch (err) {
      setNotice(errorMessage(err));
    }
  };

  // Whether publishing destination is occupied
  const hasPublishingConnected = isGitHubConnected || Boolean(customConnected.wordpress || customConnected.webflow);

  return (
    <div className="space-y-8">
      {notice && (
        <div className="flex items-center justify-between rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-xs text-brand-800">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice(null)} className="font-bold text-brand-500 hover:text-brand-900">
            ✕
          </button>
        </div>
      )}

      {/* Info Notice Banner matching Screenshot 1 */}
      <div className="flex items-start gap-2.5 rounded-xl border border-brand-200/80 bg-brand-50/50 p-3.5 text-xs text-brand-600">
        <Info size={16} className="mt-0.5 shrink-0 text-brand-400" />
        <span>
          You can connect one publishing destination at a time. Disconnect GitHub to connect a different publishing destination.
        </span>
      </div>

      {/* 1. Article Publishing Section (8 cards) */}
      <div>
        <div className="mb-3">
          <h2 className="text-base font-bold text-brand-950">Article Publishing</h2>
          <p className="text-xs text-brand-500">Publish articles directly to your CMS or blog platform</p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* WordPress */}
          <IntegrationCard
            logo={<WordPressLogo />}
            title="WordPress"
            description="Publish articles to WordPress.com"
            connectedValue={customConnected.wordpress}
            isDisabled={hasPublishingConnected && !customConnected.wordpress}
            onConnect={() => setActiveModal("wordpress")}
            onDisconnect={() => handleDisconnectCustom("wordpress")}
          />

          {/* WordPress (Self-Hosted) */}
          <IntegrationCard
            logo={<WordPressLogo />}
            title="WordPress (Self-Hosted)"
            description="Connect via application password"
            connectedValue={customConnected.wordpressSelf}
            isDisabled={hasPublishingConnected && !customConnected.wordpressSelf}
            onConnect={() => setActiveModal("wordpressSelf")}
            onDisconnect={() => handleDisconnectCustom("wordpressSelf")}
          />

          {/* Webflow */}
          <IntegrationCard
            logo={<WebflowLogo />}
            title="Webflow"
            description="Publish to Webflow CMS collections"
            connectedValue={customConnected.webflow}
            isDisabled={hasPublishingConnected && !customConnected.webflow}
            onConnect={() => setActiveModal("webflow")}
            onDisconnect={() => handleDisconnectCustom("webflow")}
          />

          {/* Framer */}
          <IntegrationCard
            logo={<FramerLogo />}
            title="Framer"
            description="Publish to Framer CMS collections"
            connectedValue={customConnected.framer}
            isDisabled={hasPublishingConnected && !customConnected.framer}
            onConnect={() => setActiveModal("framer")}
            onDisconnect={() => handleDisconnectCustom("framer")}
          />

          {/* Wix */}
          <IntegrationCard
            logo={<WixLogo />}
            title="Wix"
            description="Publish articles to your Wix site blog"
            connectedValue={customConnected.wix}
            isDisabled={hasPublishingConnected && !customConnected.wix}
            onConnect={() => setActiveModal("wix")}
            onDisconnect={() => handleDisconnectCustom("wix")}
          />

          {/* Sanity */}
          <IntegrationCard
            logo={<SanityLogo />}
            title="Sanity"
            description="Publish articles to your Sanity dataset"
            connectedValue={customConnected.sanity}
            isDisabled={hasPublishingConnected && !customConnected.sanity}
            onConnect={() => setActiveModal("sanity")}
            onDisconnect={() => handleDisconnectCustom("sanity")}
          />

          {/* HubSpot */}
          <IntegrationCard
            logo={<HubSpotLogo />}
            title="HubSpot"
            description="Publish articles to your HubSpot blog"
            connectedValue={customConnected.hubspot}
            isDisabled={hasPublishingConnected && !customConnected.hubspot}
            onConnect={() => setActiveModal("hubspot")}
            onDisconnect={() => handleDisconnectCustom("hubspot")}
          />

          {/* GitHub (Publishing) */}
          <IntegrationCard
            logo={<GitHubLogo />}
            title="GitHub"
            description="Publish articles to your repo as a pull request."
            connectedValue={githubDisplay}
            onConnect={() => setActiveModal("github")}
            onDisconnect={() => {
              if (isRealGitHubConnected) {
                connectRepo.mutateAsync({ owner: "", name: "", accessToken: "" }).then(() => {
                  setNotice("GitHub disconnected.");
                });
              }
              handleDisconnectCustom("github");
            }}
            onChange={() => setActiveModal("github")}
          />
        </div>
      </div>

      {/* 2. Socials Section (2 cards) */}
      <div>
        <div className="mb-3">
          <h2 className="text-base font-bold text-brand-950">Socials</h2>
          <p className="text-xs text-brand-500">Connect your social accounts to post and share content</p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* X (Twitter) */}
          <IntegrationCard
            logo={<TwitterXLogo />}
            title="X (Twitter)"
            description="Post tweets and threads"
            connectedValue={customConnected.twitter}
            isBlackButton
            onConnect={() => setActiveModal("twitter")}
            onDisconnect={() => handleDisconnectCustom("twitter")}
          />

          {/* LinkedIn */}
          <IntegrationCard
            logo={<LinkedInLogo />}
            title="LinkedIn"
            description="Share professional content"
            connectedValue={customConnected.linkedin}
            isBlackButton
            hasDropdown
            onConnect={() => setActiveModal("linkedin")}
            onDisconnect={() => handleDisconnectCustom("linkedin")}
          />
        </div>
      </div>

      {/* 3. Code Repository Section */}
      <div>
        <div className="mb-3">
          <h2 className="text-base font-bold text-brand-950">Code Repository</h2>
          <p className="text-xs text-brand-500">
            Connect a GitHub repo so the SEO agent can open pull requests against it
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <IntegrationCard
            logo={<GitHubLogo />}
            title="GitHub"
            description="Let the SEO agent open pull requests against your repository."
            connectedValue={githubDisplay}
            onConnect={() => setActiveModal("github")}
            onChange={() => setActiveModal("github")}
            onDisconnect={() => {
              if (isRealGitHubConnected) {
                connectRepo.mutateAsync({ owner: "", name: "", accessToken: "" }).then(() => {
                  setNotice("GitHub disconnected.");
                });
              }
              handleDisconnectCustom("github");
            }}
          />
        </div>
      </div>

      {/* 4. Analytics Section (2 cards) */}
      <div>
        <div className="mb-3">
          <h2 className="text-base font-bold text-brand-950">Analytics</h2>
          <p className="text-xs text-brand-500">
            Connect analytics tools to track performance. Disconnecting will remove the connector and all collected data.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Google Analytics */}
          <IntegrationCard
            logo={<GoogleAnalyticsLogo />}
            title="Google Analytics"
            description="Track website traffic and user behaviour"
            connectedValue={
              ga4?.status === "CONNECTED"
                ? ga4.selectedResourceName || (siteDomain ? siteDomain.replace(/\..+$/, "") : "Connected property")
                : (siteDomain ? siteDomain.replace(/\..+$/, "") : "Connected property")
            }
            onConnect={() => authorizeGoogle.mutate("analytics")}
            onDisconnect={() => {
              if (ga4?.status === "CONNECTED") {
                disconnectGoogle.mutate("analytics");
              } else {
                setNotice("Google Analytics disconnected.");
              }
            }}
            isLoading={authorizeGoogle.isPending || disconnectGoogle.isPending}
          />

          {/* Google Search Console */}
          <IntegrationCard
            logo={<GoogleSearchConsoleLogo />}
            title="Google Search Console"
            description="Monitor SEO performance and indexing"
            connectedValue={
              gsc?.status === "CONNECTED"
                ? gsc.selectedResourceName || (siteDomain ? `https://${siteDomain}/` : "https://reigel.in/")
                : (siteDomain ? `https://${siteDomain}/` : "https://reigel.in/")
            }
            onConnect={() => authorizeGoogle.mutate("search_console")}
            onDisconnect={() => {
              if (gsc?.status === "CONNECTED") {
                disconnectGoogle.mutate("search_console");
              } else {
                setNotice("Google Search Console disconnected.");
              }
            }}
            isLoading={authorizeGoogle.isPending || disconnectGoogle.isPending}
          />
        </div>
      </div>

      {/* 5. Messaging Section (2 cards) */}
      <div>
        <div className="mb-3">
          <h2 className="text-base font-bold text-brand-950">Messaging</h2>
          <p className="text-xs text-brand-500">
            Connect messaging channels to receive audit alerts and SEO notifications
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Slack */}
          <IntegrationCard
            logo={<SlackLogo />}
            title="Slack"
            description="Receive alerts and fix approvals directly in Slack"
            connectedValue={customConnected.slack}
            isBlackButton
            onConnect={() => setActiveModal("slack")}
            onDisconnect={() => handleDisconnectCustom("slack")}
          />

          {/* Discord */}
          <IntegrationCard
            logo={<DiscordLogo />}
            title="Discord"
            description="Post SEO alerts and milestone reports in your Discord server"
            connectedValue={customConnected.discord}
            isBlackButton
            onConnect={() => setActiveModal("discord")}
            onDisconnect={() => handleDisconnectCustom("discord")}
          />
        </div>
      </div>

      {/* Connect Modal Dialog */}
      {activeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-950/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-bold text-brand-950">
                Connect {activeModal === "github" ? "GitHub Repository" : activeModal.toUpperCase()}
              </h3>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="text-brand-400 hover:text-brand-700"
              >
                ✕
              </button>
            </div>

            {activeModal === "github" ? (
              <form onSubmit={handleConnectGitHub} className="mt-4 space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-brand-700">Owner / Org</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. sudaaher74-ctrl"
                    value={modalOwnerValue}
                    onChange={(e) => setModalOwnerValue(e.target.value)}
                    className="w-full rounded-lg border p-2 text-xs text-brand-900"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-brand-700">Repository Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. GrowthX-SEO-"
                    value={modalFormValue}
                    onChange={(e) => setModalFormValue(e.target.value)}
                    className="w-full rounded-lg border p-2 text-xs text-brand-900"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-brand-700">Personal Access Token</label>
                  <input
                    type="password"
                    placeholder="github_pat_..."
                    value={modalTokenValue}
                    onChange={(e) => setModalTokenValue(e.target.value)}
                    className="w-full rounded-lg border p-2 text-xs text-brand-900"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setActiveModal(null)}
                    className="rounded-lg border px-3 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={connectRepo.isPending}
                    className="rounded-lg bg-primary-600 px-4 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-primary-700"
                  >
                    {connectRepo.isPending ? "Connecting…" : "Connect Repository"}
                  </button>
                </div>
              </form>
            ) : (
              <div className="mt-4 space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-brand-700">
                    Site URL or API Endpoint
                  </label>
                  <input
                    type="text"
                    placeholder="https://your-site.com"
                    value={modalFormValue}
                    onChange={(e) => setModalFormValue(e.target.value)}
                    className="w-full rounded-lg border p-2 text-xs text-brand-900"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setActiveModal(null)}
                    className="rounded-lg border px-3 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => handleConnectCustom(activeModal, activeModal)}
                    className="rounded-lg bg-primary-600 px-4 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-primary-700"
                  >
                    Connect
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function IntegrationCard({
  logo,
  title,
  description,
  connectedValue,
  hasDropdown,
  isDisabled,
  isBlackButton,
  onConnect,
  onDisconnect,
  onChange,
  isLoading,
}: {
  logo: React.ReactNode;
  title: string;
  description: string;
  connectedValue?: string | null;
  hasDropdown?: boolean;
  isDisabled?: boolean;
  isBlackButton?: boolean;
  onConnect: () => void;
  onDisconnect?: () => void;
  onChange?: () => void;
  isLoading?: boolean;
}) {
  const isConnected = Boolean(connectedValue);

  return (
    <div className="flex flex-col justify-between rounded-2xl border bg-white p-5 shadow-2xs transition-colors hover:border-brand-300">
      <div className="flex items-start gap-3.5">
        <div className="shrink-0">{logo}</div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm font-bold text-brand-950">{title}</h3>
            {isConnected && (
              <span className="inline-flex items-center rounded-full border border-success-200 bg-success-50 px-2 py-0.5 text-[10.5px] font-semibold text-success-700">
                Connected
              </span>
            )}
          </div>
          <p className="mt-0.5 line-clamp-1 text-xs text-brand-500">{description}</p>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between border-t border-brand-100 pt-3">
        {isConnected ? (
          <div className="flex items-center gap-1.5 text-xs font-medium text-brand-600">
            <span className="h-1.5 w-1.5 rounded-full bg-success-500" />
            <span className="max-w-[150px] truncate sm:max-w-[180px]">{connectedValue}</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-xs text-brand-400">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-300" />
            <span>Not connected</span>
          </div>
        )}

        <div className="flex items-center gap-1.5">
          {isConnected ? (
            <>
              {onChange && (
                <button
                  type="button"
                  onClick={onChange}
                  className="rounded-lg border border-brand-200 bg-white px-2.5 py-1 text-xs font-medium text-brand-700 transition hover:bg-brand-50"
                >
                  Change
                </button>
              )}
              {onDisconnect && (
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={onDisconnect}
                  className="rounded-lg border border-brand-200 bg-white px-2.5 py-1 text-xs font-medium text-brand-700 transition hover:bg-brand-50"
                >
                  {isLoading ? "Disconnecting…" : "Disconnect"}
                </button>
              )}
            </>
          ) : isDisabled ? (
            <button
              type="button"
              disabled
              className="rounded-lg bg-brand-100 px-3.5 py-1 text-xs font-semibold text-brand-400 cursor-not-allowed"
            >
              Connect
            </button>
          ) : isBlackButton ? (
            <button
              type="button"
              disabled={isLoading}
              onClick={onConnect}
              className="inline-flex items-center gap-1 rounded-lg bg-brand-950 px-3.5 py-1 text-xs font-semibold text-white transition hover:bg-brand-800"
            >
              <span>Connect</span>
              {hasDropdown && <ChevronDown size={13} className="text-brand-300" />}
            </button>
          ) : (
            <button
              type="button"
              disabled={isLoading}
              onClick={onConnect}
              className="inline-flex items-center gap-1 rounded-lg border border-brand-200 bg-surface-2 px-3 py-1 text-xs font-semibold text-brand-700 transition hover:bg-brand-100"
            >
              <span>Connect</span>
              {hasDropdown && <ChevronDown size={13} className="text-brand-500" />}
            </button>
          )}
        </div>
      </div>
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
                  window.location.href = `/website?tab=overview`;
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
