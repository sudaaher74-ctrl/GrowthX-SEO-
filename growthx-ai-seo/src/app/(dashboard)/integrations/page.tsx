"use client";

import { Suspense, useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Database,
  ExternalLink,
  GitBranch,
  Globe,
  HelpCircle,
  Loader2,
  MapPin,
  PlugZap,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  Zap,
} from "lucide-react";
import {
  ActionButton,
  PageHeader,
  Panel,
  Table,
  Th,
  Tr,
  Td,
  relativeTime,
} from "@/components/ui/console";
import {
  useConnectRepository,
  useRepository,
  useWorkspace,
  useLocalSeo,
} from "@/hooks/use-growthx";
import { api } from "@/lib/api-client";
import { errorMessage } from "@/lib/error-message";
import { PropertyPicker } from "@/components/ui/property-picker";
import {
  MetricBadge,
  TruthfulState,
  LoadingState,
} from "@/components/ui/truthful-state";

export default function IntegrationsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-brand-400">Loading Integrations...</div>}>
      <IntegrationsClient />
    </Suspense>
  );
}

function IntegrationsClient() {
  const { projectId } = useWorkspace();
  const searchParams = useSearchParams();
  const qc = useQueryClient();

  const repo = useRepository(projectId);
  const connectRepo = useConnectRepository(projectId);
  const localSeo = useLocalSeo(projectId);

  const [connectingGitHub, setConnectingGitHub] = useState(false);
  const [githubForm, setGithubForm] = useState({
    owner: "sudaaher74-ctrl",
    name: "GrowthX-SEO-",
    defaultBranch: "main",
    accessToken: "",
    framework: "nextjs",
    contentDir: "src/app",
  });

  const [notice, setNotice] = useState<{ type: "success" | "warn" | "error"; text: string } | null>(null);

  // Read URL params from OAuth callback redirects
  useEffect(() => {
    const googleStatus = searchParams?.get("google");
    const provider = searchParams?.get("provider");
    if (googleStatus === "select") {
      setNotice({
        type: "warn",
        text: `Google authorization succeeded! Please choose which ${provider === "search_console" ? "Search Console" : "Analytics"} property to read below.`,
      });
    } else if (googleStatus === "scopes") {
      setNotice({
        type: "warn",
        text: "Google authorized your login, but some requested permissions were not checked on the consent screen.",
      });
    } else if (googleStatus === "cancelled") {
      setNotice({
        type: "warn",
        text: "Google connection was cancelled on the consent screen.",
      });
    } else if (googleStatus === "failed") {
      setNotice({
        type: "error",
        text: "Google authorization failed or the verification state expired.",
      });
    }
  }, [searchParams]);

  // Google connections query
  const googleQuery = useQuery({
    queryKey: ["google-connections", projectId],
    queryFn: () => api.googleConnections(projectId!),
    enabled: !!projectId,
  });

  const gsc = googleQuery.data?.providers.find((p) => p.id === "search_console");
  const ga4 = googleQuery.data?.providers.find((p) => p.id === "analytics");
  const gbp = googleQuery.data?.providers.find((p) => p.id === "business_profile");

  // Authorize mutations
  const authorizeGoogle = useMutation({
    mutationFn: (provider: string) => api.googleAuthorizeUrl(projectId!, provider, "/integrations"),
    onSuccess: ({ authorizationUrl }) => {
      window.location.href = authorizationUrl;
    },
    onError: (err) => setNotice({ type: "error", text: errorMessage(err) }),
  });

  // Disconnect mutations
  const disconnectGoogle = useMutation({
    mutationFn: (provider: string) => api.googleDisconnect(projectId!, provider),
    onSuccess: () => {
      setNotice({ type: "success", text: "Disconnected integration successfully." });
      qc.invalidateQueries({ queryKey: ["google-connections", projectId] });
      qc.invalidateQueries({ queryKey: ["gsc-summary"] });
      qc.invalidateQueries({ queryKey: ["ga4-summary"] });
    },
    onError: (err) => setNotice({ type: "error", text: errorMessage(err) }),
  });

  // Sync mutations
  const syncGoogle = useMutation({
    mutationFn: async (provider: string) => {
      if (provider === "search_console") return api.gscSync(projectId!, 28);
      if (provider === "analytics") return api.ga4Sync(projectId!, 28);
    },
    onSuccess: () => {
      setNotice({ type: "success", text: "Manual sync triggered successfully." });
      qc.invalidateQueries({ queryKey: ["google-connections", projectId] });
      qc.invalidateQueries({ queryKey: ["gsc-summary"] });
      qc.invalidateQueries({ queryKey: ["ga4-summary"] });
    },
    onError: (err) => setNotice({ type: "error", text: errorMessage(err) }),
  });

  const handleConnectGitHub = async (e: React.FormEvent) => {
    e.preventDefault();
    await connectRepo.mutateAsync(githubForm);
    setConnectingGitHub(false);
    setNotice({ type: "success", text: "GitHub repository connected successfully." });
  };

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title="Integrations & Data Sources"
        subtitle="Manage external platform credentials, select properties, and verify sync health."
        actions={
          <ActionButton
            variant="secondary"
            icon={<RefreshCw size={12} className={googleQuery.isFetching ? "animate-spin" : ""} />}
            onClick={() => googleQuery.refetch()}
            disabled={googleQuery.isFetching}
          >
            Refresh Status
          </ActionButton>
        }
      />

      {notice && (
        <div
          className={`flex items-start justify-between rounded-xl border p-4 text-[12.5px] ${
            notice.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : notice.type === "error"
                ? "border-rose-200 bg-rose-50 text-rose-800"
                : "border-amber-200 bg-amber-50 text-amber-800"
          }`}
        >
          <span>{notice.text}</span>
          <button type="button" onClick={() => setNotice(null)} className="ml-2 font-bold hover:opacity-75">
            ✕
          </button>
        </div>
      )}

      {/* Integration Cards Grid */}
      <div className="grid grid-cols-1 gap-4">
        {/* 1. Google Search Console */}
        <div className="rounded-xl border bg-white p-5 shadow-2xs" style={{ borderColor: "var(--border-color)" }}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                <Search size={20} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-[14px] font-bold text-brand-950">Google Search Console</h3>
                  <MetricBadge state={gsc?.status === "CONNECTED" ? "MEASURED" : "NOT_CONNECTED"} />
                </div>
                <p className="text-[12px] text-brand-500 mt-0.5">
                  Provides authoritative organic search impressions, verified Google clicks, CTR, and keyword rankings.
                </p>
                <div className="flex flex-wrap gap-2 text-[11px] text-brand-500 font-mono mt-2">
                  <span>Account: <strong>{gsc?.googleAccountEmail || "Not connected"}</strong></span>
                  <span>·</span>
                  <span>Property: <strong>{gsc?.selectedResourceName || "None selected"}</strong></span>
                  <span>·</span>
                  <span>Last Sync: <strong>{gsc?.lastSyncedAt ? relativeTime(gsc.lastSyncedAt) : "Never"}</strong></span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {gsc?.status === "CONNECTED" ? (
                <>
                  <ActionButton
                    variant="secondary"
                    icon={syncGoogle.isPending ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                    onClick={() => syncGoogle.mutate("search_console")}
                    disabled={syncGoogle.isPending}
                  >
                    Sync Now
                  </ActionButton>
                  <ActionButton
                    variant="secondary"
                    icon={<Trash2 size={12} className="text-rose-500" />}
                    onClick={() => disconnectGoogle.mutate("search_console")}
                    disabled={disconnectGoogle.isPending}
                  >
                    Disconnect
                  </ActionButton>
                </>
              ) : (
                <ActionButton
                  variant="primary"
                  icon={authorizeGoogle.isPending ? <Loader2 size={12} className="animate-spin" /> : <PlugZap size={12} />}
                  onClick={() => authorizeGoogle.mutate("search_console")}
                  disabled={authorizeGoogle.isPending || !projectId}
                >
                  Connect Google
                </ActionButton>
              )}
            </div>
          </div>

          {projectId && (gsc?.status === "CONNECTED" || gsc?.status === "NEEDS_SELECTION") && (
            <div className="mt-4 pt-4 border-t" style={{ borderColor: "var(--color-brand-100)" }}>
              <PropertyPicker provider="search_console" projectId={projectId} />
            </div>
          )}
        </div>

        {/* 2. Google Analytics 4 */}
        <div className="rounded-xl border bg-white p-5 shadow-2xs" style={{ borderColor: "var(--border-color)" }}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
                <BarChart3 size={20} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-[14px] font-bold text-brand-950">Google Analytics 4 (GA4)</h3>
                  <MetricBadge state={ga4?.status === "CONNECTED" ? "MEASURED" : "NOT_CONNECTED"} />
                </div>
                <p className="text-[12px] text-brand-500 mt-0.5">
                  Synchronizes user sessions, engaged landing pages, conversion rates, and traffic channels.
                </p>
                <div className="flex flex-wrap gap-2 text-[11px] text-brand-500 font-mono mt-2">
                  <span>Account: <strong>{ga4?.googleAccountEmail || "Not connected"}</strong></span>
                  <span>·</span>
                  <span>Stream / Property: <strong>{ga4?.selectedResourceName || "None selected"}</strong></span>
                  <span>·</span>
                  <span>Last Sync: <strong>{ga4?.lastSyncedAt ? relativeTime(ga4.lastSyncedAt) : "Never"}</strong></span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {ga4?.status === "CONNECTED" ? (
                <>
                  <ActionButton
                    variant="secondary"
                    icon={syncGoogle.isPending ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                    onClick={() => syncGoogle.mutate("analytics")}
                    disabled={syncGoogle.isPending}
                  >
                    Sync Now
                  </ActionButton>
                  <ActionButton
                    variant="secondary"
                    icon={<Trash2 size={12} className="text-rose-500" />}
                    onClick={() => disconnectGoogle.mutate("analytics")}
                    disabled={disconnectGoogle.isPending}
                  >
                    Disconnect
                  </ActionButton>
                </>
              ) : (
                <ActionButton
                  variant="primary"
                  icon={authorizeGoogle.isPending ? <Loader2 size={12} className="animate-spin" /> : <PlugZap size={12} />}
                  onClick={() => authorizeGoogle.mutate("analytics")}
                  disabled={authorizeGoogle.isPending || !projectId}
                >
                  Connect GA4
                </ActionButton>
              )}
            </div>
          </div>

          {projectId && (ga4?.status === "CONNECTED" || ga4?.status === "NEEDS_SELECTION") && (
            <div className="mt-4 pt-4 border-t" style={{ borderColor: "var(--color-brand-100)" }}>
              <PropertyPicker provider="analytics" projectId={projectId} />
            </div>
          )}
        </div>

        {/* 3. Google Business Profile & Places */}
        <div className="rounded-xl border bg-white p-5 shadow-2xs" style={{ borderColor: "var(--border-color)" }}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                <MapPin size={20} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-[14px] font-bold text-brand-950">Google Business Profile & Places</h3>
                  <MetricBadge state={localSeo.data ? "MEASURED" : "NOT_CONNECTED"} />
                </div>
                <p className="text-[12px] text-brand-500 mt-0.5">
                  Synchronizes verified Google Reviews, star ratings, local rankings, and Google Maps presence.
                </p>
                <div className="flex flex-wrap gap-2 text-[11px] text-brand-500 font-mono mt-2">
                  <span>Profile: <strong>{localSeo.data?.businessName || "Not connected"}</strong></span>
                  <span>·</span>
                  <span>
                    Rating: <strong>{localSeo.data?.reviewCount ? `${localSeo.data.rating.toFixed(1)} ★ (${localSeo.data.reviewCount})` : "No rating"}</strong>
                  </span>
                  <span>·</span>
                  <span>Last Sync: <strong>{localSeo.data?.updatedAt ? relativeTime(localSeo.data.updatedAt) : "Never"}</strong></span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Link
                href="/local"
                className="inline-flex items-center gap-1.5 rounded-lg border bg-white px-3 py-1.5 text-[12px] font-semibold text-brand-700 hover:bg-brand-50 transition"
              >
                Manage in Local SEO
                <ExternalLink size={12} />
              </Link>
            </div>
          </div>
        </div>

        {/* 4. GitHub Code Repository */}
        <div className="rounded-xl border bg-white p-5 shadow-2xs" style={{ borderColor: "var(--border-color)" }}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-50 text-purple-700">
                <GitBranch size={20} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-[14px] font-bold text-brand-950">GitHub Repository</h3>
                  <MetricBadge state={repo.data ? "MEASURED" : "NOT_CONFIGURED"} />
                </div>
                <p className="text-[12px] text-brand-500 mt-0.5">
                  Allows autonomous AI engineers to open verified pull requests for schema and technical fixes.
                </p>
                <div className="flex flex-wrap gap-2 text-[11px] text-brand-500 font-mono mt-2">
                  <span>Repo: <strong>{repo.data ? `${repo.data.owner}/${repo.data.name}` : "Not configured"}</strong></span>
                  <span>·</span>
                  <span>Branch: <strong>{repo.data?.defaultBranch || "main"}</strong></span>
                  <span>·</span>
                  <span>Framework: <strong>{repo.data?.framework || "Next.js"}</strong></span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <ActionButton
                variant={repo.data ? "secondary" : "primary"}
                onClick={() => setConnectingGitHub(!connectingGitHub)}
              >
                {repo.data ? "Edit Configuration" : "Connect Repository"}
              </ActionButton>
            </div>
          </div>

          {connectingGitHub && (
            <form onSubmit={handleConnectGitHub} className="mt-4 pt-4 border-t space-y-3 max-w-lg" style={{ borderColor: "var(--color-brand-100)" }}>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-brand-700 mb-1">Owner / Org</label>
                  <input
                    type="text"
                    required
                    value={githubForm.owner}
                    onChange={(e) => setGithubForm({ ...githubForm, owner: e.target.value })}
                    className="w-full h-8 rounded-lg border px-2.5 text-xs"
                    placeholder="e.g. your-github-org"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-brand-700 mb-1">Repository</label>
                  <input
                    type="text"
                    required
                    value={githubForm.name}
                    onChange={(e) => setGithubForm({ ...githubForm, name: e.target.value })}
                    className="w-full h-8 rounded-lg border px-2.5 text-xs"
                    placeholder="e.g. company-website"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-brand-700 mb-1">GitHub Personal Access Token (PAT)</label>
                <input
                  type="password"
                  required
                  value={githubForm.accessToken}
                  onChange={(e) => setGithubForm({ ...githubForm, accessToken: e.target.value })}
                  className="w-full h-8 rounded-lg border px-2.5 text-xs"
                  placeholder="ghp_..."
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setConnectingGitHub(false)}
                  className="rounded-lg border px-3 py-1 text-xs text-brand-500 hover:bg-brand-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={connectRepo.isPending}
                  className="rounded-lg bg-brand-950 px-3.5 py-1 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
                >
                  {connectRepo.isPending ? "Connecting..." : "Save GitHub Connection"}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* 5. CRM & Marketing (HubSpot / Salesforce) */}
        <div className="rounded-xl border bg-white p-5 shadow-2xs" style={{ borderColor: "var(--border-color)" }}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
                <Database size={20} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-[14px] font-bold text-brand-950">CRM & Marketing (HubSpot / Salesforce)</h3>
                  <MetricBadge state="NOT_CONFIGURED" />
                </div>
                <p className="text-[12px] text-brand-500 mt-0.5">
                  Link organic search landing pages to downstream lead conversions and deal pipeline values.
                </p>
                <div className="text-[11px] text-brand-400 font-mono mt-1.5">
                  Status: Available via API webhook or HubSpot App connection.
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <ActionButton variant="secondary" disabled>
                Configure CRM
              </ActionButton>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
