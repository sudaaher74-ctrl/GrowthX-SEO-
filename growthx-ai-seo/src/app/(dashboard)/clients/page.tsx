"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Eye,
  Globe,
  Layers,
  Palette,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Users,
  Wrench,
  Zap,
} from "lucide-react";
import {
  ActionButton,
  Kpi,
  PageHeader,
  Panel,
  Pill,
  StatusNote,
  Table,
  Td,
  Th,
  Tr,
} from "@/components/ui/console";
import { QueryState } from "@/components/ui/query-state";
import { usePortfolio, useWorkspace } from "@/hooks/use-growthx";
import { useSubscription } from "@/lib/subscription-engine";
import { cn } from "@/lib/utils";
import type { PortfolioClient } from "@/lib/api-types";

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

export default function ClientsPage() {
  const router = useRouter();
  const { orgId, projectId, setProjectId } = useWorkspace();
  const portfolio = usePortfolio(orgId);
  const { subscription, plan } = useSubscription(orgId);
  const websiteCap = subscription?.limits.websites ?? 1;
  const isAgencyPlan = subscription?.tierId === "agency";

  const [searchQuery, setSearchQuery] = useState("");
  const [tierFilter, setTierFilter] = useState<string>("ALL");
  const [copiedLink, setCopiedLink] = useState(false);

  // White-label customization state (persisted locally)
  const [agencyName, setAgencyName] = useState(() => {
    if (typeof window === "undefined") return "GrowthX Strategic SEO";
    return localStorage.getItem("growthx_whitelabel_agency_name") || "GrowthX Strategic SEO";
  });
  const [agencyLogoUrl, setAgencyLogoUrl] = useState(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("growthx_whitelabel_logo_url") || "";
  });
  const [brandColor, setBrandColor] = useState(() => {
    if (typeof window === "undefined") return "indigo";
    return localStorage.getItem("growthx_whitelabel_brand_color") || "indigo";
  });
  const [savedSettingsNote, setSavedSettingsNote] = useState("");

  const handleSaveWhiteLabel = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem("growthx_whitelabel_agency_name", agencyName);
    localStorage.setItem("growthx_whitelabel_logo_url", agencyLogoUrl);
    localStorage.setItem("growthx_whitelabel_brand_color", brandColor);
    setSavedSettingsNote("White-label settings saved. Client executive links and PDFs updated.");
    setTimeout(() => setSavedSettingsNote(""), 3500);
  };

  const handleSwitchClient = (targetProjectId: string) => {
    setProjectId(targetProjectId);
    router.push("/dashboard");
  };

  const handleCopyClientPortalLink = (domain?: string | null) => {
    const host = typeof window !== "undefined" ? window.location.origin : "https://app.growthx.ai";
    const shareUrl = `${host}/reports?client=${encodeURIComponent(domain || "client")}&whitelabel=true`;
    void navigator.clipboard.writeText(shareUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const data = portfolio.data;
  const clients = data?.clients ?? [];
  const summary = data?.summary;
  const alerts = data?.alerts ?? [];

  const filteredClients = useMemo(() => {
    return clients.filter((c) => {
      const matchesSearch =
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.domain || "").toLowerCase().includes(searchQuery.toLowerCase());
      const matchesTier =
        tierFilter === "ALL" || (c.tier || "Standard").toUpperCase() === tierFilter.toUpperCase();
      return matchesSearch && matchesTier;
    });
  }, [clients, searchQuery, tierFilter]);

  const avgHealth = useMemo(() => {
    const scored = clients.filter((c) => c.health != null);
    if (!scored.length) return null;
    return Math.round(scored.reduce((acc, c) => acc + (c.health || 0), 0) / scored.length);
  }, [clients]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Agency Client Directory"
        subtitle="Multi-client portfolio oversight, cross-account SEO health beacons, and white-label branding controls."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => handleCopyClientPortalLink(null)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-brand-200/80 bg-surface-1 px-3 py-1.5 text-xs font-semibold text-brand-800 hover:bg-brand-50 hover:text-brand-950 transition-colors shadow-2xs"
            >
              {copiedLink ? (
                <>
                  <Check size={12} className="text-success-600" />
                  <span className="text-success-700">Copied Portal Link</span>
                </>
              ) : (
                <>
                  <Copy size={12} className="text-brand-500" />
                  <span>Copy Client Portal Link</span>
                </>
              )}
            </button>
            {clients.length >= websiteCap ? (
              <Link
                href="/settings?tab=subscription"
                className="inline-flex items-center gap-1.5 rounded-lg border border-warning-300 bg-warning-50 px-3.5 py-1.5 text-xs font-bold text-warning-800 shadow-xs transition-all hover:bg-warning-100"
              >
                <span>{clients.length}/{websiteCap} Sites (Upgrade Limit)</span>
                <ArrowRight size={13} />
              </Link>
            ) : (
              <Link
                href="/settings?tab=websites"
                className="inline-flex items-center gap-1.5 rounded-lg bg-signal-400 px-3.5 py-1.5 text-xs font-bold text-signal-ink shadow-xs transition-all hover:bg-signal-500 active:scale-[0.98]"
              >
                <Globe size={13} />
                <span>Add Client Website ({clients.length}/{websiteCap})</span>
              </Link>
            )}
          </div>
        }
      />

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
                </div>
                <p className="mt-0.5 text-[11.5px] text-brand-500">
                  Real-time health rollups across all monitored client properties and monthly deliverable status.
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

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5 border-t border-brand-200/60 pt-3">
            <Kpi
              label="Managed Clients"
              value={number(summary?.clientCount ?? clients.length)}
              sub="Active agency properties"
            />
            <Kpi
              label="Average Portfolio Health"
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
              label="Open Critical Issues"
              value={number(summary?.openCriticals ?? 0)}
              sub="Requires developer fix"
              tone={(summary?.openCriticals ?? 0) > 0 ? "danger" : "good"}
            />
            <Kpi
              label="Retainer Run-Rate (MRR)"
              value={currency(summary?.mrrMinor, summary?.mrrCurrency)}
              sub="Monthly recurring retainer"
            />
          </div>
        </div>
      </div>

      {/* ── CROSS-CLIENT ALERTS TICKER (If Any) ── */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.slice(0, 3).map((alert, idx) => (
            <div
              key={`${alert.projectId}-${idx}`}
              className={cn(
                "flex items-center justify-between rounded-xl border p-3 text-xs shadow-2xs",
                alert.severity === "critical"
                  ? "border-error-200 bg-error-50/70 text-error-800"
                  : "border-warning-200 bg-warning-50/70 text-warning-800"
              )}
            >
              <div className="flex items-center gap-2.5">
                <ShieldAlert
                  size={15}
                  className={alert.severity === "critical" ? "text-error-600" : "text-warning-600"}
                />
                <div>
                  <strong className="font-semibold">{alert.title}:</strong> {alert.detail}
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleSwitchClient(alert.projectId)}
                className="inline-flex items-center gap-1 rounded-md bg-surface-1 border border-brand-200 px-2 py-1 text-[11px] font-bold text-brand-950 hover:bg-brand-50 transition shadow-2xs cursor-pointer"
              >
                <span>Inspect Client</span>
                <ArrowRight size={11} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── CLIENT DIRECTORY & SEARCH TABLE ── */}
      <Panel
        title="Client Accounts Directory"
        subtitle="Manage agency workspaces, inspect individual technical health, and switch contexts in 1 click."
      >
        {/* Search & Filter Toolbar */}
        <div className="p-3 border-b border-brand-200 bg-surface-2/60 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-[240px]">
            <div className="relative flex-1 max-w-sm">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-brand-400" />
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
          <Table minWidth={900}>
            <thead>
              <tr>
                <Th>Client &amp; Domain</Th>
                <Th>Service Tier</Th>
                <Th>Health Score</Th>
                <Th align="right">AI Citation Share</Th>
                <Th align="right">Critical Issues</Th>
                <Th align="right">Retainer</Th>
                <Th align="right">Last Crawled</Th>
                <Th align="right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {filteredClients.map((client) => {
                const isActive = client.projectId === projectId;
                const health = client.health;
                return (
                  <Tr key={client.projectId}>
                    {/* Client & Domain */}
                    <Td>
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-100 font-mono text-xs font-bold text-brand-800">
                          {client.initials || client.name.slice(0, 2).toUpperCase()}
                        </span>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-brand-950 text-xs">{client.name}</span>
                            {isActive && (
                              <span className="rounded bg-signal-400/20 text-brand-950 border border-signal-400/40 px-1.5 py-0.2 text-[9.5px] font-mono font-bold uppercase">
                                Active
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
                            <span className="text-[11px] text-brand-400">No domain configured</span>
                          )}
                        </div>
                      </div>
                    </Td>

                    {/* Service Tier */}
                    <Td>
                      <span className="inline-flex items-center rounded-md border border-brand-200 bg-surface-2 px-2 py-0.5 text-[11px] font-semibold text-brand-800">
                        {client.tier || "Standard Retainer"}
                      </span>
                    </Td>

                    {/* Health Score */}
                    <Td>
                      {health != null ? (
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-mono font-bold",
                            health >= 75
                              ? "bg-success-50 text-success-700 border-success-200"
                              : health >= 50
                              ? "bg-warning-50 text-warning-700 border-warning-200"
                              : "bg-error-50 text-error-700 border-error-200"
                          )}
                        >
                          <Shield size={11} />
                          <span>{health}/100</span>
                        </span>
                      ) : (
                        <span className="text-brand-400 font-mono text-xs">—</span>
                      )}
                    </Td>

                    {/* AI Citation Share */}
                    <Td align="right">
                      {client.aiCitationSharePct != null ? (
                        <div className="font-mono text-xs font-bold text-brand-950">
                          {client.aiCitationSharePct.toFixed(1)}%
                          {client.aiDeltaPt != null && client.aiDeltaPt !== 0 && (
                            <span
                              className={cn(
                                "ml-1 text-[10px]",
                                client.aiDeltaPt > 0 ? "text-success-700" : "text-error-600"
                              )}
                            >
                              {client.aiDeltaPt > 0 ? "↑" : "↓"} {Math.abs(client.aiDeltaPt).toFixed(1)}pt
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-brand-400 font-mono text-xs">—</span>
                      )}
                    </Td>

                    {/* Critical Issues */}
                    <Td align="right">
                      {client.criticalIssues > 0 ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-error-50 text-error-700 border border-error-200 px-2 py-0.5 font-mono text-xs font-bold">
                          {client.criticalIssues} critical
                        </span>
                      ) : (
                        <span className="text-success-700 font-mono text-xs font-semibold">0 issues</span>
                      )}
                    </Td>

                    {/* Retainer */}
                    <Td align="right">
                      <span className="font-mono text-xs font-semibold text-brand-950">
                        {currency(client.retainerMonthlyMinor, client.retainerCurrency)}
                      </span>
                    </Td>

                    {/* Last Crawled */}
                    <Td align="right">
                      <span className="text-xs text-brand-500 font-mono">
                        {time(client.lastCrawledAt)}
                      </span>
                    </Td>

                    {/* Actions */}
                    <Td align="right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleSwitchClient(client.projectId)}
                          className={cn(
                            "inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-bold transition-all shadow-2xs cursor-pointer",
                            isActive
                              ? "bg-brand-100 text-brand-950 border border-brand-300"
                              : "bg-signal-400 text-signal-ink hover:bg-signal-500 active:scale-[0.98]"
                          )}
                        >
                          <span>{isActive ? "Active Workspace" : "Open Workspace"}</span>
                          <ArrowRight size={11} />
                        </button>
                      </div>
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        </QueryState>
      </Panel>

      {/* ── AGENCY WHITE-LABEL BRANDING CONTROLS ── */}
      <Panel
        title="White-Label Agency Customization"
        subtitle="Brand client portal links, PDF executive monthly deliverables, and custom domain access."
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
                    Agency Tier Feature — Custom Client Portals & PDF Watermarks
                  </h4>
                  <p className="mt-0.5 text-xs text-brand-600">
                    Your current plan ({plan?.name ?? "Starter"}) does not include White-Label client customization. Upgrade to the Agency Tier to unlock custom portal subdomains, your agency logo on all executive reports, and tailored brand themes.
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

        <form onSubmit={handleSaveWhiteLabel} className="space-y-4 max-w-3xl">
          {savedSettingsNote && (
            <div role="status">
              <StatusNote tone="good">{savedSettingsNote}</StatusNote>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-bold text-brand-950 mb-1">
                Agency Brand Name
              </label>
              <input
                type="text"
                value={agencyName}
                disabled={!isAgencyPlan}
                onChange={(e) => setAgencyName(e.target.value)}
                placeholder="e.g. Apex Strategic Growth"
                className="w-full rounded-lg border border-brand-200 bg-surface-2 p-2 text-xs text-brand-950 focus:outline-primary-600 disabled:opacity-60 disabled:cursor-not-allowed"
              />
              <p className="mt-1 text-[11px] text-brand-500">
                Shown on PDF cover sheets, navigation headers, and automated alerts.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-brand-950 mb-1">
                Agency Logo Image URL
              </label>
              <input
                type="url"
                value={agencyLogoUrl}
                disabled={!isAgencyPlan}
                onChange={(e) => setAgencyLogoUrl(e.target.value)}
                placeholder="https://youragency.com/logo.svg"
                className="w-full rounded-lg border border-brand-200 bg-surface-2 p-2 text-xs text-brand-950 focus:outline-primary-600 disabled:opacity-60 disabled:cursor-not-allowed"
              />
              <p className="mt-1 text-[11px] text-brand-500">
                SVG or high-res PNG for header watermarks and executive PDF exports.
              </p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-brand-950 mb-1.5">
              Client Portal Accent Palette
            </label>
            <div className="flex flex-wrap items-center gap-3">
              {[
                { id: "indigo", label: "Indigo Brand", color: "bg-primary-600" },
                { id: "signal", label: "Signal Lime", color: "bg-signal-400" },
                { id: "emerald", label: "Emerald Growth", color: "bg-success-600" },
                { id: "neutral", label: "Obsidian Black", color: "bg-brand-950" },
              ].map((c) => (
                <button
                  key={c.id}
                  type="button"
                  disabled={!isAgencyPlan}
                  onClick={() => setBrandColor(c.id)}
                  className={cn(
                    "flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-semibold transition cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed",
                    brandColor === c.id
                      ? "border-brand-950 bg-brand-50 text-brand-950 shadow-2xs"
                      : "border-brand-200 bg-surface-1 text-brand-600 hover:bg-surface-2"
                  )}
                >
                  <span className={cn("h-3 w-3 rounded-full", c.color)} />
                  <span>{c.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Subdomain Preview */}
          <div className="rounded-xl border border-brand-200/80 bg-surface-2 p-3 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="font-semibold text-brand-950">White-Label Client Link Preview:</div>
              <code className="text-[11px] font-mono text-brand-600 mt-0.5 block">
                https://portal.{agencyName.toLowerCase().replace(/[^a-z0-9]/g, "") || "agency"}.com/reports?whitelabel=true
              </code>
            </div>
            {isAgencyPlan ? (
              <ActionButton type="submit" variant="primary">
                Save White-Label Branding
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
