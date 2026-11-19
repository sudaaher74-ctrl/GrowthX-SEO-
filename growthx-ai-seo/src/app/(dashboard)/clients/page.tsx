"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  Check,
  Copy,
  ExternalLink,
  Globe,
  Link2,
  Lock,
  Play,
  Search,
  Share2,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import {
  ActionButton,
  Kpi,
  PageHeader,
  Panel,
  StatusNote,
  Table,
  Td,
  Th,
  Tr,
} from "@/components/ui/console";
import { QueryState } from "@/components/ui/query-state";
import {
  usePortfolio,
  useUpdateWhiteLabel,
  useWhiteLabel,
  useWorkspace,
} from "@/hooks/use-growthx";
import { api } from "@/lib/api-client";
import type { BulkDeliverReportsResponse, PortfolioClient } from "@/lib/api-types";
import { errorMessage } from "@/lib/error-message";
import { useSubscription, DEFAULT_SUBSCRIPTION_LIMITS } from "@/lib/subscription-engine";
import { cn } from "@/lib/utils";

const number = (value: number | null | undefined) =>
  value == null ? "—" : new Intl.NumberFormat().format(value);

const currency = (minor: number | null | undefined, curr = "USD") => {
  if (minor == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: curr,
    maximumFractionDigits: 0,
  }).format(minor / 100);
};

const time = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString() : "Unscheduled";

const currentMonthKey = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
};

export default function ClientsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { orgId, projectId, setProjectId } = useWorkspace();
  const portfolio = usePortfolio(orgId);
  const whiteLabelQuery = useWhiteLabel(orgId);
  const updateWhiteLabel = useUpdateWhiteLabel(orgId);
  const { subscription, plan } = useSubscription(orgId);
  const websiteCap = subscription
    ? subscription.limits.websites
    : DEFAULT_SUBSCRIPTION_LIMITS.websites;
  const isAgencyPlan = subscription?.tierId === "agency";

  const [searchQuery, setSearchQuery] = useState("");
  const [tierFilter, setTierFilter] = useState<string>("ALL");
  const [copiedClientId, setCopiedClientId] = useState<string | null>(null);
  const [sharingClientId, setSharingClientId] = useState<string | null>(null);
  const [runningClientId, setRunningClientId] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<{
    tone: "good" | "bad";
    text: string;
  } | null>(null);
  const [bulkResult, setBulkResult] = useState<BulkDeliverReportsResponse | null>(null);
  const [savedSettingsNote, setSavedSettingsNote] = useState("");

  // Real persisted White-Label state (backed by backend API, never localStorage)
  const serverWl = whiteLabelQuery.data;
  const [wlDraft, setWlDraft] = useState<{
    orgId: string;
    whiteLabelEnabled: boolean;
    agencyName: string;
    logoUrl: string;
    contactLine: string;
    footerText: string;
  } | null>(null);

  const wlForm =
    wlDraft && wlDraft.orgId === (orgId ?? "")
      ? wlDraft
      : {
          orgId: orgId ?? "",
          whiteLabelEnabled: serverWl?.whiteLabelEnabled ?? false,
          agencyName: serverWl?.agencyName ?? "",
          logoUrl: serverWl?.logoUrl ?? "",
          contactLine: serverWl?.contactLine ?? "",
          footerText: serverWl?.footerText ?? "",
        };

  const patchWl = (patch: Partial<Omit<typeof wlForm, "orgId">>) =>
    setWlDraft({ ...wlForm, ...patch, orgId: orgId ?? "" });

  const handleSaveWhiteLabel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgId) return;
    setSavedSettingsNote("");
    try {
      await updateWhiteLabel.mutateAsync({
        whiteLabelEnabled: wlForm.whiteLabelEnabled,
        agencyName: wlForm.agencyName.trim() || null,
        logoUrl: wlForm.logoUrl.trim() || null,
        contactLine: wlForm.contactLine.trim() || null,
        footerText: wlForm.footerText.trim() || null,
      });
      setWlDraft(null);
      setSavedSettingsNote(
        "White-label branding persisted to server. All PDFs, /reports, and zero-login client links updated.",
      );
      setTimeout(() => setSavedSettingsNote(""), 4000);
    } catch (err) {
      setActionNotice({ tone: "bad", text: errorMessage(err) });
    }
  };

  const bulkDeliverMutation = useMutation({
    mutationFn: () =>
      api.bulkDeliverPortfolioReports(orgId!, {
        month: currentMonthKey(),
        expiresInDays: 30,
      }),
    onSuccess: (res) => {
      setBulkResult(res);
      void queryClient.invalidateQueries({ queryKey: ["portfolio", orgId] });
      setActionNotice({
        tone: "good",
        text: `Locked & minted zero-login portal links for ${res.deliveredCount}/${res.totalClients} clients (${res.month}).`,
      });
    },
    onError: (err) => setActionNotice({ tone: "bad", text: errorMessage(err) }),
  });

  const handleSwitchClient = (targetProjectId: string) => {
    setProjectId(targetProjectId);
    router.push("/dashboard");
  };

  const handleCopyRealPortalLink = async (client: PortfolioClient) => {
    if (typeof window === "undefined") return;
    setSharingClientId(client.projectId);
    setActionNotice(null);
    try {
      let token = client.monthlyReport?.shareToken ?? null;
      if (!token) {
        const res = await api.monthlyReports.share(
          client.projectId,
          client.monthlyReport?.month || currentMonthKey(),
          { expiresInDays: 30 },
        );
        token = res.shareToken;
        void queryClient.invalidateQueries({ queryKey: ["portfolio", orgId] });
      }
      const shareUrl = `${window.location.origin}/share/report/${token}`;
      await navigator.clipboard.writeText(shareUrl);
      setCopiedClientId(client.projectId);
      setActionNotice({
        tone: "good",
        text: `Copied zero-login client portal link for ${client.name}.`,
      });
      setTimeout(() => setCopiedClientId(null), 2500);
    } catch (err) {
      setActionNotice({ tone: "bad", text: errorMessage(err) });
    } finally {
      setSharingClientId(null);
    }
  };

  const handleRunClientPipeline = async (client: PortfolioClient) => {
    if (!client.domain) {
      setActionNotice({
        tone: "bad",
        text: `${client.name} has no website domain configured yet.`,
      });
      return;
    }
    setRunningClientId(client.projectId);
    setActionNotice(null);
    try {
      await api.autopilot.start(client.domain, client.projectId, {
        forceRefresh: true,
      });
      void queryClient.invalidateQueries({ queryKey: ["portfolio", orgId] });
      setActionNotice({
        tone: "good",
        text: `Started full 5-stage pipeline for ${client.name} (${client.domain}).`,
      });
    } catch (err) {
      setActionNotice({ tone: "bad", text: errorMessage(err) });
    } finally {
      setRunningClientId(null);
    }
  };

  const data = portfolio.data;
  const clients = useMemo(() => data?.clients ?? [], [data?.clients]);
  const summary = data?.summary;
  const alerts = data?.alerts ?? [];

  const filteredClients = useMemo(() => {
    return clients.filter((c) => {
      const matchesSearch =
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.domain || "").toLowerCase().includes(searchQuery.toLowerCase());
      const matchesTier =
        tierFilter === "ALL" ||
        (c.tier || "Standard").toUpperCase() === tierFilter.toUpperCase();
      return matchesSearch && matchesTier;
    });
  }, [clients, searchQuery, tierFilter]);

  const avgHealth = useMemo(() => {
    const scored = clients.filter((c) => c.health != null);
    if (!scored.length) return null;
    return Math.round(
      scored.reduce((acc, c) => acc + (c.health || 0), 0) / scored.length,
    );
  }, [clients]);

  const totalRegressions = summary?.openRegressions ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clients"
        subtitle="Manage client websites, zero-login white-labeled portals, pipelines, and cross-client health."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {orgId && clients.length > 0 && (
              <button
                type="button"
                disabled={bulkDeliverMutation.isPending}
                onClick={() => bulkDeliverMutation.mutate()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-brand-200/80 bg-surface-1 px-3 py-1.5 text-xs font-semibold text-brand-900 hover:bg-brand-50 transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
              >
                <Lock size={12} className="text-success-600" />
                <span>
                  {bulkDeliverMutation.isPending
                    ? "Locking & Sharing All…"
                    : "Lock & Share All Clients"}
                </span>
              </button>
            )}
            {clients.length >= websiteCap ? (
              <Link
                href="/settings?tab=subscription"
                className="inline-flex items-center gap-1.5 rounded-lg border border-warning-300 bg-warning-50 px-3.5 py-1.5 text-xs font-bold text-warning-800 shadow-xs transition-all hover:bg-warning-100"
              >
                <span>
                  {clients.length}/{websiteCap} Sites (Upgrade Limit)
                </span>
                <ArrowRight size={13} />
              </Link>
            ) : (
              <Link
                href="/settings?tab=websites"
                className="inline-flex items-center gap-1.5 rounded-lg bg-signal-400 px-3.5 py-1.5 text-xs font-bold text-signal-ink shadow-xs transition-all hover:bg-signal-500 active:scale-[0.98]"
              >
                <Globe size={13} />
                <span>
                  Add Client Website ({clients.length}/{websiteCap})
                </span>
              </Link>
            )}
          </div>
        }
      />

      {actionNotice && (
        <div role="status">
          <StatusNote tone={actionNotice.tone}>{actionNotice.text}</StatusNote>
        </div>
      )}

      {/* ── BULK DELIVERABLE LINKS DRAWER ── */}
      {bulkResult && (
        <div className="rounded-2xl border border-success-200 bg-success-50/50 p-4 space-y-3 shadow-2xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-xs font-bold text-brand-950 flex items-center gap-1.5">
                <Link2 size={14} className="text-success-700" />
                <span>
                  Month-End Zero-Login Client Portals Ready ({bulkResult.month}) —{" "}
                  {bulkResult.deliveredCount}/{bulkResult.totalClients} Locked &amp; Shared
                </span>
              </h3>
              <p className="text-[11px] text-brand-600">
                Every link below opens a frozen, white-labeled deliverable with no login required.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setBulkResult(null)}
              className="text-xs font-semibold text-brand-500 hover:text-brand-900 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
          <div className="divide-y divide-brand-200/70 rounded-xl border border-brand-200 bg-surface-1">
            {bulkResult.clients.map((item) => {
              const url =
                item.shareToken && typeof window !== "undefined"
                  ? `${window.location.origin}/share/report/${item.shareToken}`
                  : null;
              return (
                <div
                  key={item.projectId}
                  className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs"
                >
                  <div className="min-w-0">
                    <span className="font-bold text-brand-950">{item.name}</span>
                    {item.domain && (
                      <span className="ml-2 font-mono text-[11px] text-brand-500">
                        {item.domain}
                      </span>
                    )}
                  </div>
                  {url ? (
                    <div className="flex items-center gap-2">
                      <a
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 font-mono text-[11px] text-accent-700 hover:underline"
                      >
                        <span>Open Portal</span>
                        <ExternalLink size={11} />
                      </a>
                      <button
                        type="button"
                        onClick={() => {
                          void navigator.clipboard.writeText(url);
                          setCopiedClientId(item.projectId);
                          setTimeout(() => setCopiedClientId(null), 2000);
                        }}
                        className="inline-flex items-center gap-1 rounded-md border border-brand-200 bg-surface-2 px-2 py-1 text-[11px] font-semibold text-brand-900 hover:bg-surface-3 cursor-pointer"
                      >
                        {copiedClientId === item.projectId ? (
                          <>
                            <Check size={11} className="text-success-600" />
                            <span>Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy size={11} />
                            <span>Copy URL</span>
                          </>
                        )}
                      </button>
                    </div>
                  ) : (
                    <span className="text-[11px] text-error-700">
                      {item.error || "Unavailable"}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── CLIENT WEBSITES CAPACITY LIMIT BANNER ── */}
      {clients.length >= websiteCap && (
        <div className="rounded-2xl border border-brand-200/80 bg-surface-1 p-4 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-signal-400 text-signal-ink font-bold">
              <Globe size={16} />
            </div>
            <div>
              <p className="text-xs font-bold text-brand-950">
                Client website limit reached ({clients.length} of {websiteCap} sites active on{" "}
                {plan?.name || "Active Tier"})
              </p>
              <p className="text-[11px] text-brand-500">
                {websiteCap <= 1
                  ? "Upgrade to Growth for 3 client websites or Agency for 10 websites with white-label portals."
                  : "Upgrade to Agency to manage up to 10 client websites with dedicated executive reporting."}
              </p>
            </div>
          </div>
          <Link
            href="/settings?tab=subscription"
            className="inline-flex items-center gap-1.5 rounded-xl bg-signal-400 px-3.5 py-1.5 text-xs font-bold text-signal-ink hover:bg-signal-500 transition shadow-2xs shrink-0"
          >
            <span>Upgrade Website Limit</span>
            <ArrowRight size={12} />
          </Link>
        </div>
      )}

      {/* ── PORTFOLIO TELEMETRY RIBBON ── */}
      <div className="rounded-2xl border border-brand-200/80 bg-surface-1 p-4 shadow-card">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-signal-400 text-signal-ink font-bold shadow-2xs">
                <Users size={18} />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-[14.5px] font-bold text-brand-950">
                    Agency Portfolio Operations
                  </h2>
                  <span className="inline-flex items-center gap-1 rounded-full border border-success-200/60 bg-success-50 px-2.5 py-0.5 text-[10.5px] font-mono font-bold text-success-700">
                    <ShieldCheck size={12} className="text-success-600" />
                    {summary?.clientCount ?? clients.length} Active Accounts
                  </span>
                  {totalRegressions > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-error-200 bg-error-50 px-2.5 py-0.5 text-[10.5px] font-mono font-bold text-error-700">
                      <ShieldAlert size={12} />
                      {totalRegressions} Regression{totalRegressions === 1 ? "" : "s"}
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-[11.5px] text-brand-500">
                  Real-time health rollups, Regression Guard telemetry, and frozen monthly deliverables across every client.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href="/monthly-report"
                className="inline-flex items-center gap-1.5 rounded-lg border border-brand-200/80 bg-surface-1 px-3 py-1.5 text-xs font-semibold text-brand-800 hover:bg-brand-50 hover:text-brand-950 transition-colors shadow-2xs"
              >
                <span>Monthly Reports</span>
                <ArrowRight size={12} />
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-6 border-t border-brand-200/60 pt-3">
            <Kpi
              label="Managed Clients"
              value={number(summary?.clientCount ?? clients.length)}
              sub="Active agency properties"
            />
            <Kpi
              label="Avg Portfolio Health"
              value={avgHealth != null ? `${avgHealth}/100` : "—"}
              sub="Crawl audit composite"
              tone={avgHealth != null && avgHealth >= 75 ? "good" : "default"}
            />
            <Kpi
              label="AI Visibility Share"
              value={
                summary?.portfolioAiSharePct != null
                  ? `${summary.portfolioAiSharePct.toFixed(1)}%`
                  : "—"
              }
              sub={`${summary?.promptsTracked ?? 0} tracked prompts`}
            />
            <Kpi
              label="Open Criticals"
              value={number(summary?.openCriticals ?? 0)}
              sub="Across latest crawls"
              tone={(summary?.openCriticals ?? 0) > 0 ? "danger" : "good"}
            />
            <Kpi
              label="Regressions (30d)"
              value={number(totalRegressions)}
              sub="Caught by Regression Guard"
              tone={totalRegressions > 0 ? "danger" : "good"}
            />
            <Kpi
              label="Retainer MRR"
              value={currency(summary?.mrrMinor, summary?.mrrCurrency)}
              sub={`${summary?.lockedReportsCount ?? 0}/${clients.length} reports locked`}
            />
          </div>
        </div>
      </div>

      {/* ── CROSS-CLIENT ALERTS TICKER ── */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.slice(0, 4).map((alert, idx) => (
            <div
              key={`${alert.projectId}-${alert.tag}-${idx}`}
              className={cn(
                "flex items-center justify-between rounded-xl border p-3 text-xs shadow-2xs",
                alert.severity === "critical"
                  ? "border-error-200 bg-error-50/70 text-error-800"
                  : "border-warning-200 bg-warning-50/70 text-warning-800",
              )}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <ShieldAlert
                  size={15}
                  className={cn(
                    "shrink-0",
                    alert.severity === "critical" ? "text-error-600" : "text-warning-600",
                  )}
                />
                <div className="truncate">
                  <span className="mr-1.5 rounded bg-surface-1/90 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase">
                    {alert.tag}
                  </span>
                  <strong className="font-semibold">{alert.title}:</strong> {alert.detail}
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleSwitchClient(alert.projectId)}
                className="inline-flex items-center gap-1 rounded-md bg-surface-1 border border-brand-200 px-2 py-1 text-[11px] font-bold text-brand-950 hover:bg-brand-50 transition shadow-2xs cursor-pointer shrink-0 ml-2"
              >
                <span>Inspect</span>
                <ArrowRight size={11} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── CLIENT DIRECTORY & SEARCH TABLE ── */}
      <Panel
        title="Client Accounts Directory"
        subtitle="Switch workspaces, trigger full 5-stage pipelines, and copy real zero-login white-labeled client portal links."
      >
        <div className="p-3 border-b border-brand-200 bg-surface-2/60 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-[240px]">
            <div className="relative flex-1 max-w-sm">
              <Search
                size={14}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-brand-400"
              />
              <input
                type="text"
                placeholder="Search clients by brand name or domain…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-brand-200 bg-surface-1 pl-8 pr-3 py-1.5 text-xs text-brand-950 placeholder:text-brand-400 focus:outline-primary-600"
              />
            </div>

            <select
              value={tierFilter}
              onChange={(e) => setTierFilter(e.target.value)}
              className="rounded-lg border border-brand-200 bg-surface-1 px-2.5 py-1.5 text-xs font-semibold text-brand-800 focus:outline-primary-600"
            >
              <option value="ALL">All Tiers</option>
              <option value="ENTERPRISE">Enterprise</option>
              <option value="GROWTH">Growth</option>
              <option value="STANDARD">Standard</option>
            </select>
          </div>

          <div className="text-xs font-mono text-brand-500">
            Showing {filteredClients.length} of {clients.length} accounts
          </div>
        </div>

        <QueryState
          isLoading={portfolio.isLoading}
          error={portfolio.error}
          isEmpty={!filteredClients.length}
          emptyTitle="No clients found"
          emptyBody="Add your first client website under Settings > Websites to track accounts in your portfolio."
        >
          {/* Mobile Cards */}
          <div className="block md:hidden divide-y divide-brand-200/60 bg-surface-1">
            {filteredClients.map((client) => {
              const isActive = client.projectId === projectId;
              const health = client.health;
              return (
                <div key={client.projectId} className="p-3.5 space-y-3 bg-surface-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-brand-950 text-xs truncate">
                          {client.name}
                        </span>
                        {isActive && (
                          <span className="rounded bg-signal-400/20 text-brand-950 border border-signal-400/40 px-1.5 py-0.5 text-[9px] font-mono font-bold uppercase">
                            Active
                          </span>
                        )}
                      </div>
                      <span className="font-mono text-[11px] text-brand-500 block truncate">
                        {client.domain || "No domain configured"}
                      </span>
                    </div>
                    <span className="shrink-0 rounded-md border border-brand-200 bg-surface-2 px-2 py-0.5 text-[10px] font-semibold text-brand-700">
                      {health != null ? `${health}/100` : "—"}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      disabled={runningClientId === client.projectId || !client.domain}
                      onClick={() => void handleRunClientPipeline(client)}
                      className="inline-flex items-center gap-1 rounded-lg border border-brand-200 bg-surface-2 px-2.5 py-1 text-[11px] font-semibold text-brand-800 cursor-pointer disabled:opacity-50"
                    >
                      <Play size={11} />
                      <span>Run Pipeline</span>
                    </button>
                    <button
                      type="button"
                      disabled={sharingClientId === client.projectId}
                      onClick={() => void handleCopyRealPortalLink(client)}
                      className="inline-flex items-center gap-1 rounded-lg border border-brand-200 bg-surface-2 px-2.5 py-1 text-[11px] font-semibold text-brand-800 cursor-pointer disabled:opacity-50"
                    >
                      <Share2 size={11} />
                      <span>
                        {copiedClientId === client.projectId ? "Copied!" : "Share Portal"}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSwitchClient(client.projectId)}
                      className="inline-flex items-center gap-1 rounded-lg bg-signal-400 px-2.5 py-1 text-[11px] font-bold text-signal-ink cursor-pointer"
                    >
                      <span>{isActive ? "Active" : "Open"}</span>
                      <ArrowRight size={11} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block">
            <Table minWidth={1020}>
              <thead>
                <tr>
                  <Th>Client &amp; Domain</Th>
                  <Th>Health &amp; Guard</Th>
                  <Th align="right">AI Share</Th>
                  <Th align="right">Criticals</Th>
                  <Th align="right">Monthly Report</Th>
                  <Th align="right">Last Crawled</Th>
                  <Th align="right">Actions</Th>
                </tr>
              </thead>
              <tbody>
                {filteredClients.map((client) => {
                  const isActive = client.projectId === projectId;
                  const health = client.health;
                  const isPipeActive =
                    client.activePipelineStatus === "RUNNING" ||
                    client.activePipelineStatus === "WAITING_CONFIRMATION" ||
                    runningClientId === client.projectId;
                  const regressions = client.openRegressions ?? 0;

                  return (
                    <Tr key={client.projectId}>
                      <Td>
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-100 font-mono text-xs font-bold text-brand-800">
                            {client.initials || client.name.slice(0, 2).toUpperCase()}
                          </span>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-brand-950 text-xs">
                                {client.name}
                              </span>
                              {isActive && (
                                <span className="rounded bg-signal-400/20 text-brand-950 border border-signal-400/40 px-1.5 py-0.5 text-[9.5px] font-mono font-bold uppercase">
                                  Active
                                </span>
                              )}
                              {isPipeActive && (
                                <span className="rounded bg-primary-50 text-primary-700 border border-primary-200 px-1.5 py-0.5 text-[9.5px] font-mono font-bold">
                                  Pipeline Running
                                </span>
                              )}
                            </div>
                            {client.domain ? (
                              <a
                                href={`https://${client.domain}`}
                                target="_blank"
                                rel="noreferrer"
                                className="font-mono text-[11px] text-accent-700 hover:underline flex items-center gap-1 mt-0.5"
                              >
                                <span>{client.domain}</span>
                                <ExternalLink size={10} />
                              </a>
                            ) : (
                              <span className="text-[11px] text-brand-400">
                                No domain configured
                              </span>
                            )}
                          </div>
                        </div>
                      </Td>

                      <Td>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {health != null ? (
                            <span
                              className={cn(
                                "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-mono font-bold",
                                health >= 75
                                  ? "bg-success-50 text-success-700 border-success-200"
                                  : health >= 50
                                    ? "bg-warning-50 text-warning-700 border-warning-200"
                                    : "bg-error-50 text-error-700 border-error-200",
                              )}
                            >
                              <Shield size={11} />
                              <span>{health}/100</span>
                            </span>
                          ) : (
                            <span className="text-brand-400 font-mono text-xs">—</span>
                          )}
                          {regressions > 0 && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-error-50 border border-error-200 px-2 py-0.5 font-mono text-[10px] font-bold text-error-700">
                              <ShieldAlert size={10} />
                              {regressions} reg
                            </span>
                          )}
                        </div>
                      </Td>

                      <Td align="right">
                        {client.aiCitationSharePct != null ? (
                          <div className="font-mono text-xs font-bold text-brand-950">
                            {client.aiCitationSharePct.toFixed(1)}%
                            {client.aiDeltaPt != null && client.aiDeltaPt !== 0 && (
                              <span
                                className={cn(
                                  "ml-1 text-[10px]",
                                  client.aiDeltaPt > 0
                                    ? "text-success-700"
                                    : "text-error-600",
                                )}
                              >
                                {client.aiDeltaPt > 0 ? "↑" : "↓"}{" "}
                                {Math.abs(client.aiDeltaPt).toFixed(1)}pt
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-brand-400 font-mono text-xs">—</span>
                        )}
                      </Td>

                      <Td align="right">
                        {client.criticalIssues > 0 ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-error-50 text-error-700 border border-error-200 px-2 py-0.5 font-mono text-xs font-bold">
                            {client.criticalIssues} crit
                          </span>
                        ) : (
                          <span className="text-success-700 font-mono text-xs font-semibold">
                            0
                          </span>
                        )}
                      </Td>

                      <Td align="right">
                        {client.monthlyReport?.isLocked ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-success-200 bg-success-50 px-2 py-0.5 font-mono text-[10.5px] font-bold text-success-700">
                            <Lock size={10} />
                            Locked
                          </span>
                        ) : (
                          <span className="font-mono text-[11px] text-brand-400">
                            Live ({client.monthlyReport?.month || currentMonthKey()})
                          </span>
                        )}
                      </Td>

                      <Td align="right">
                        <span className="text-xs text-brand-500 font-mono">
                          {time(client.lastCrawledAt)}
                        </span>
                      </Td>

                      <Td align="right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            disabled={isPipeActive || !client.domain}
                            onClick={() => void handleRunClientPipeline(client)}
                            title="Run 5-stage workspace pipeline for this client"
                            className="inline-flex items-center gap-1 rounded-md border border-brand-200 bg-surface-1 px-2 py-1 text-[11px] font-semibold text-brand-800 hover:bg-surface-2 transition cursor-pointer disabled:opacity-50"
                          >
                            <Play size={11} className="text-signal-500" />
                            <span>Pipeline</span>
                          </button>

                          <button
                            type="button"
                            disabled={sharingClientId === client.projectId}
                            onClick={() => void handleCopyRealPortalLink(client)}
                            title="Generate & copy zero-login white-labeled client portal link"
                            className="inline-flex items-center gap-1 rounded-md border border-brand-200 bg-surface-1 px-2 py-1 text-[11px] font-semibold text-brand-800 hover:bg-surface-2 transition cursor-pointer disabled:opacity-50"
                          >
                            {copiedClientId === client.projectId ? (
                              <>
                                <Check size={11} className="text-success-600" />
                                <span className="text-success-700">Copied</span>
                              </>
                            ) : (
                              <>
                                <Share2 size={11} className="text-primary-600" />
                                <span>Portal Link</span>
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleSwitchClient(client.projectId)}
                            className={cn(
                              "inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-bold transition-all shadow-2xs cursor-pointer",
                              isActive
                                ? "bg-brand-100 text-brand-950 border border-brand-300"
                                : "bg-signal-400 text-signal-ink hover:bg-signal-500 active:scale-[0.98]",
                            )}
                          >
                            <span>{isActive ? "Active" : "Open"}</span>
                            <ArrowRight size={11} />
                          </button>
                        </div>
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
          </div>
        </QueryState>
      </Panel>

      {/* ── AGENCY WHITE-LABEL BRANDING CONTROLS (REAL BACKEND API) ── */}
      <Panel
        title="White-Label Agency Customization"
        subtitle="Persisted to server — brands all PDF exports, /reports pages, and zero-login /share/report/[token] client portals."
        padded
      >
        {!isAgencyPlan && (
          <div className="mb-6 rounded-xl border border-primary-200 bg-primary-50/60 p-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-600 text-surface-1">
                  <Sparkles size={18} />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-brand-950">
                    Agency Tier Feature — White-Label Portals &amp; Branded PDFs
                  </h4>
                  <p className="mt-0.5 text-xs text-brand-600">
                    Your current plan ({plan?.name ?? "Starter"}) does not include White-Label client customization. Upgrade to the Agency Tier to stamp your agency logo, contact line, and footer across every client deliverable.
                  </p>
                </div>
              </div>
              <Link
                href="/settings?tab=subscription"
                className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3.5 py-1.5 text-xs font-bold text-surface-1 hover:bg-primary-700 transition"
              >
                <span>Upgrade to Agency</span>
                <ArrowRight size={13} />
              </Link>
            </div>
          </div>
        )}

        <form onSubmit={(e) => void handleSaveWhiteLabel(e)} className="space-y-4 max-w-3xl">
          {savedSettingsNote && (
            <div role="status">
              <StatusNote tone="good">{savedSettingsNote}</StatusNote>
            </div>
          )}

          <label className="flex items-center gap-2.5 text-xs font-semibold text-brand-950 cursor-pointer">
            <input
              type="checkbox"
              disabled={!isAgencyPlan}
              checked={wlForm.whiteLabelEnabled}
              onChange={(e) => patchWl({ whiteLabelEnabled: e.target.checked })}
              className="h-4 w-4 rounded border-brand-300 cursor-pointer disabled:opacity-60"
            />
            <span>Enable Agency White-Label Branding on all Reports, PDFs, and Client Links</span>
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-bold text-brand-950 mb-1">
                Agency Brand Name
              </label>
              <input
                type="text"
                value={wlForm.agencyName}
                disabled={!isAgencyPlan}
                onChange={(e) => patchWl({ agencyName: e.target.value })}
                placeholder="e.g. Apex Strategic Growth"
                className="w-full rounded-lg border border-brand-200 bg-surface-2 p-2 text-xs text-brand-950 focus:outline-primary-600 disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-brand-950 mb-1">
                Agency Logo Image URL
              </label>
              <input
                type="url"
                value={wlForm.logoUrl}
                disabled={!isAgencyPlan}
                onChange={(e) => patchWl({ logoUrl: e.target.value })}
                placeholder="https://youragency.com/logo.svg"
                className="w-full rounded-lg border border-brand-200 bg-surface-2 p-2 text-xs text-brand-950 focus:outline-primary-600 disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-brand-950 mb-1">
                Agency Contact Line
              </label>
              <input
                type="text"
                value={wlForm.contactLine}
                disabled={!isAgencyPlan}
                onChange={(e) => patchWl({ contactLine: e.target.value })}
                placeholder="e.g. seo@youragency.com · youragency.com"
                className="w-full rounded-lg border border-brand-200 bg-surface-2 p-2 text-xs text-brand-950 focus:outline-primary-600 disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-brand-950 mb-1">
                Deliverable Footer Certification
              </label>
              <input
                type="text"
                value={wlForm.footerText}
                disabled={!isAgencyPlan}
                onChange={(e) => patchWl({ footerText: e.target.value })}
                placeholder="e.g. Prepared exclusively by Apex Strategic Growth."
                className="w-full rounded-lg border border-brand-200 bg-surface-2 p-2 text-xs text-brand-950 focus:outline-primary-600 disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-brand-200/70">
            <span className="text-[11px] text-brand-500">
              Synced with Settings → White-Label and applied automatically to every client portal link.
            </span>
            {isAgencyPlan ? (
              <ActionButton
                type="submit"
                variant="primary"
                disabled={updateWhiteLabel.isPending}
              >
                {updateWhiteLabel.isPending ? "Saving…" : "Save White-Label Branding"}
              </ActionButton>
            ) : (
              <Link
                href="/settings?tab=subscription"
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-bold text-surface-1 hover:bg-primary-700"
              >
                <span>Unlock with Agency Tier</span>
                <ArrowRight size={12} />
              </Link>
            )}
          </div>
        </form>
      </Panel>
    </div>
  );
}
