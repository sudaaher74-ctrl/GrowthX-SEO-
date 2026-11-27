"use client";

import React, { useMemo, useState } from "react";
import {
  CheckCircle2,
  Download,
  Eye,
  LogOut,
  MailCheck,
  ShieldCheck,
  SlidersHorizontal,
  Zap,
} from "lucide-react";
import { Pill, StatusNote, Td, Th, Tr, relativeTime } from "@/components/ui/console";
import { api } from "@/lib/api-client";
import type {
  AdminCostRates,
  AdminCostWindow,
  AdminUserIntelligenceRow,
  AdminUserItem,
  AdminUsersIntelligenceResponse,
} from "@/lib/api-types";
import { errorMessage } from "@/lib/error-message";
import {
  AdminSearchInput,
  AdminSkeletonRows,
  AdminTableWrap,
  AdminThead,
  ConfirmModal,
  FilterChipGroup,
  NocButton,
  NocPanel,
  NocStat,
  TierBadge,
  formatCompactNumber,
  formatInr,
  formatUsd,
} from "./admin-primitives";
import { ProfitabilityBadge, User360Drawer } from "./user-360-drawer";
import { cn } from "@/lib/utils";

type UserFilter =
  | "all"
  | "high_burn"
  | "free_burn"
  | "loss"
  | "online"
  | "unverified"
  | "admins";

type SortBy = "cost" | "tokens" | "crawls" | "ai" | "newest";

const WINDOWS: Array<{ id: AdminCostWindow; label: string }> = [
  { id: "24h", label: "24h" },
  { id: "7d", label: "7d" },
  { id: "mtd", label: "MTD" },
  { id: "30d", label: "30d" },
  { id: "all", label: "All Time" },
];

interface UsersSectionProps {
  users: AdminUserItem[];
  intelligence: AdminUsersIntelligenceResponse | null;
  window: AdminCostWindow;
  onChangeWindow: (w: AdminCostWindow) => void;
  onlineTotal: number;
  loading: boolean;
  onRefresh: () => Promise<void> | void;
}

export function UsersSection({
  users,
  intelligence,
  window,
  onChangeWindow,
  onlineTotal,
  loading,
  onRefresh,
}: UsersSectionProps) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<UserFilter>("all");
  const [sortBy, setSortBy] = useState<SortBy>("cost");
  const [inspectUserId, setInspectUserId] = useState<string | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<{ id: string; email: string; name: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ tone: "good" | "bad"; text: string } | null>(null);

  // Editable Unit-Cost Rate Card state
  const [showRates, setShowRates] = useState(false);
  const [rateDraft, setRateDraft] = useState<Record<string, string>>({});
  const [savingRates, setSavingRates] = useState(false);

  const openRateEditor = (rates: AdminCostRates) => {
    setRateDraft({
      usdToInr: String(rates.usdToInr),
      staticPageCostUsd: String(rates.staticPageCostUsd),
      renderedPageCostUsd: String(rates.renderedPageCostUsd),
      geoGridPointCostUsd: String(rates.geoGridPointCostUsd),
      serpFallbackCostUsd: String(rates.serpFallbackCostUsd),
      keywordGapFallbackCostUsd: String(rates.keywordGapFallbackCostUsd),
      backlinkRunCostUsd: String(rates.backlinkRunCostUsd),
      freeHighBurnThresholdUsd: String(rates.freeHighBurnThresholdUsd),
      starterMrrUsd: String(rates.tierMrrUsd.starter),
      growthMrrUsd: String(rates.tierMrrUsd.growth),
      agencyMrrUsd: String(rates.tierMrrUsd.agency),
    });
    setShowRates(true);
  };

  async function saveRates() {
    setSavingRates(true);
    setFeedback(null);
    try {
      const payload: Record<string, number> = {};
      for (const [k, v] of Object.entries(rateDraft)) {
        const n = Number(v);
        if (Number.isFinite(n) && n >= 0) payload[k] = n;
      }
      await api.updateAdminCostRates(payload);
      setFeedback({ tone: "good", text: "Updated unit-cost rate card & FX rate. All user costs recalculated." });
      setShowRates(false);
      await onRefresh();
    } catch (err) {
      setFeedback({ tone: "bad", text: errorMessage(err) });
    } finally {
      setSavingRates(false);
    }
  }

  // Merge rich intelligence rows (or gracefully fall back to legacy `users` if backend isn't deployed yet)
  const rows: AdminUserIntelligenceRow[] = useMemo(() => {
    if (intelligence?.users) return intelligence.users;
    return users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      emailVerified: Boolean(u.emailVerified),
      authProvider: u.authProvider || "password",
      isPlatformAdmin: Boolean(u.isPlatformAdmin),
      platformAdminRevoked: Boolean(u.platformAdminRevoked),
      isOnline: Boolean(u.isLoggedIn),
      activeSessionsCount: u.activeSessionsCount ?? 0,
      lastActiveAt: u.lastLoginAt ?? u.createdAt,
      createdAt: u.createdAt,
      primaryOrgId: u.organizationId,
      primaryOrgName: u.organizationName,
      primaryRole: u.role,
      subscriptionTier: "founder_free",
      aiMonthlyBudgetUsd: null,
      workspacesCount: u.membershipsCount ?? 1,
      isSharedWorkspace: false,
      projectsCount: 0,
      websitesCount: 0,
      tokens: { spent: 0, directUserSpent: 0, available: 0, monthlyAllowance: 0, bonus: 0, shortfall: 0, utilizationPct: 0 },
      crawls: { total: 0, failed: 0, pagesCrawled: 0, pagesRendered: 0, pagesStatic: 0 },
      ai: {
        calls: u.aiCallsCount ?? 0,
        errors: 0,
        tokens: 0,
        unpricedCalls: 0,
        topModels: (u.modelsUsed || []).map((m) => ({ model: m, calls: 1 })),
      },
      apis: { geoGridPoints: 0, externalApiCalls: 0 },
      cost: { aiRouterUsd: 0, aiVisibilityUsd: 0, crawlerComputeUsd: 0, geoGridUsd: 0, externalApisUsd: 0, totalUsd: 0, totalInr: 0 },
      projectedMonthlyUsd: 0,
      projectedMonthlyInr: 0,
      mrrUsd: 0,
      netMarginUsd: 0,
      marginPct: null,
      profitabilityStatus: "IDLE",
    }));
  }, [intelligence, users]);

  const counts = useMemo(() => {
    let highBurn = 0;
    let freeBurn = 0;
    let loss = 0;
    let online = 0;
    let unverified = 0;
    let admins = 0;
    for (const r of rows) {
      if (r.cost.totalUsd >= 1) highBurn++;
      if (r.profitabilityStatus === "FREE_HIGH_BURN") freeBurn++;
      if (r.profitabilityStatus === "LOSS_MAKING") loss++;
      if (r.isOnline) online++;
      if (!r.emailVerified) unverified++;
      if (r.isPlatformAdmin) admins++;
    }
    return {
      all: rows.length,
      highBurn,
      freeBurn,
      loss,
      online: Math.max(online, onlineTotal),
      unverified,
      admins,
    };
  }, [rows, onlineTotal]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = rows.filter((u) => {
      if (filter === "high_burn" && u.cost.totalUsd < 1) return false;
      if (filter === "free_burn" && u.profitabilityStatus !== "FREE_HIGH_BURN") return false;
      if (filter === "loss" && u.profitabilityStatus !== "LOSS_MAKING") return false;
      if (filter === "online" && !u.isOnline) return false;
      if (filter === "unverified" && u.emailVerified) return false;
      if (filter === "admins" && !u.isPlatformAdmin) return false;
      if (!q) return true;
      const models = u.ai.topModels.map((m) => m.model).join(" ").toLowerCase();
      return (
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.id.toLowerCase().includes(q) ||
        u.primaryOrgName.toLowerCase().includes(q) ||
        models.includes(q)
      );
    });

    return [...list].sort((a, b) => {
      if (sortBy === "tokens") return b.tokens.spent - a.tokens.spent;
      if (sortBy === "crawls") return b.crawls.pagesCrawled - a.crawls.pagesCrawled;
      if (sortBy === "ai") return b.ai.calls - a.ai.calls;
      if (sortBy === "newest") return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      return b.cost.totalUsd - a.cost.totalUsd || b.tokens.spent - a.tokens.spent;
    });
  }, [rows, search, filter, sortBy]);

  function exportCsv() {
    const header = [
      "User Name",
      "Email",
      "Workspace",
      "Tier",
      "Profitability",
      "Total Cost (USD)",
      "Total Cost (INR)",
      "Projected 30d (USD)",
      "Plan MRR (USD)",
      "Net Margin (USD)",
      "AI Router (USD)",
      "AI Visibility (USD)",
      "Crawler Compute (USD)",
      "Geo-Grid (USD)",
      "External APIs (USD)",
      "Tokens Burned",
      "Tokens Available",
      "Crawls",
      "Pages Crawled",
      "JS Rendered Pages",
      "AI Calls",
      "Verified",
      "Online",
    ];
    const esc = (val: unknown) => `"${String(val ?? "").replace(/"/g, '""')}"`;
    const lines = [
      header.map(esc).join(","),
      ...filtered.map((u) =>
        [
          u.name,
          u.email,
          u.primaryOrgName,
          u.subscriptionTier,
          u.profitabilityStatus,
          u.cost.totalUsd.toFixed(4),
          u.cost.totalInr.toFixed(2),
          u.projectedMonthlyUsd.toFixed(2),
          u.mrrUsd.toFixed(2),
          u.netMarginUsd.toFixed(2),
          u.cost.aiRouterUsd.toFixed(4),
          u.cost.aiVisibilityUsd.toFixed(4),
          u.cost.crawlerComputeUsd.toFixed(4),
          u.cost.geoGridUsd.toFixed(4),
          u.cost.externalApisUsd.toFixed(4),
          u.tokens.spent,
          u.tokens.available,
          u.crawls.total,
          u.crawls.pagesCrawled,
          u.crawls.pagesRendered,
          u.ai.calls,
          u.emailVerified ? "Yes" : "No",
          u.isOnline ? "Online" : "Offline",
        ]
          .map(esc)
          .join(","),
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reigel-user-costs-${window}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function verifyEmail(u: AdminUserIntelligenceRow) {
    setBusyId(`verify-${u.id}`);
    setFeedback(null);
    try {
      await api.verifyAdminUserEmail(u.id);
      setFeedback({ tone: "good", text: `Verified email address for ${u.email}.` });
      await onRefresh();
    } catch (err) {
      setFeedback({ tone: "bad", text: errorMessage(err) });
    } finally {
      setBusyId(null);
    }
  }

  async function confirmRevoke() {
    if (!revokeTarget) return;
    setBusyId(`revoke-${revokeTarget.id}`);
    setFeedback(null);
    try {
      const res = await api.revokeAdminUserSessions(revokeTarget.id);
      setFeedback({
        tone: "good",
        text: `Signed out ${revokeTarget.email} (${res.revokedSessions} active session revoked).`,
      });
      setRevokeTarget(null);
      await onRefresh();
    } catch (err) {
      setFeedback({ tone: "bad", text: errorMessage(err) });
    } finally {
      setBusyId(null);
    }
  }

  const summary = intelligence?.summary;
  const buckets = summary?.buckets;
  const totalBucketUsd = buckets?.totalUsd ?? 0;

  return (
    <div className="space-y-4">
      {feedback && <StatusNote tone={feedback.tone}>{feedback.text}</StatusNote>}

      {/* Window Switcher + Rate Card + Export Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center rounded-md border border-brand-200 bg-surface-1 p-0.5">
          {WINDOWS.map((w) => (
            <button
              key={w.id}
              type="button"
              onClick={() => onChangeWindow(w.id)}
              className={cn(
                "rounded-sm px-3 py-1 text-[11.5px] font-medium transition cursor-pointer",
                window === w.id
                  ? "bg-signal-400 text-white shadow-2xs"
                  : "text-brand-400 hover:text-brand-950",
              )}
            >
              {w.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {intelligence?.rates && (
            <NocButton
              icon={<SlidersHorizontal size={12} />}
              onClick={() =>
                showRates ? setShowRates(false) : openRateEditor(intelligence.rates)
              }
            >
              {showRates ? "Hide Rate Card" : `Rate Card (₹${intelligence.rates.usdToInr}/$1)`}
            </NocButton>
          )}
          <NocButton icon={<Download size={12} />} onClick={exportCsv} disabled={filtered.length === 0}>
            Export CSV
          </NocButton>
        </div>
      </div>

      {/* Live Editable Unit-Cost Rate Card Panel */}
      {showRates && intelligence?.rates && (
        <NocPanel
          code="FINOPS"
          title="Unit Cost Rate Card & Currency Settings"
          subtitle="Adjust real infrastructure and external API unit costs. Changes recalculate every user's COGS & margin immediately."
          padded
          actions={
            <div className="flex items-center gap-2">
              <NocButton onClick={() => setShowRates(false)}>Cancel</NocButton>
              <NocButton variant="primary" disabled={savingRates} onClick={() => void saveRates()}>
                {savingRates ? "Saving…" : "Save Rate Card"}
              </NocButton>
            </div>
          }
        >
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { key: "usdToInr", label: "USD → INR FX (₹)" },
              { key: "staticPageCostUsd", label: "Static Page ($)" },
              { key: "renderedPageCostUsd", label: "Chromium JS Render ($)" },
              { key: "geoGridPointCostUsd", label: "Geo-Grid Point ($)" },
              { key: "serpFallbackCostUsd", label: "SERP Check ($)" },
              { key: "backlinkRunCostUsd", label: "Backlink Run ($)" },
              { key: "keywordGapFallbackCostUsd", label: "Keyword Gap ($)" },
              { key: "freeHighBurnThresholdUsd", label: "Free Burn Alert ($)" },
              { key: "starterMrrUsd", label: "Starter MRR ($)" },
              { key: "growthMrrUsd", label: "Growth MRR ($)" },
              { key: "agencyMrrUsd", label: "Agency MRR ($)" },
            ].map((field) => (
              <div key={field.key}>
                <label className="block text-[10.5px] text-brand-400 mb-1">{field.label}</label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={rateDraft[field.key] ?? ""}
                  onChange={(e) => setRateDraft((d) => ({ ...d, [field.key]: e.target.value }))}
                  className="h-8 w-full rounded-md border border-brand-200 bg-surface-2 px-2.5 font-mono text-[12px] text-brand-950 focus:border-signal-400 focus:outline-none"
                />
              </div>
            ))}
          </div>
        </NocPanel>
      )}

      {/* 6 Executive Unit-Economics KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <NocStat
          label={`Platform COGS (${window.toUpperCase()})`}
          value={summary ? formatUsd(summary.totalCostUsd) : "—"}
          tone="cyan"
          sub={summary ? `${formatInr(summary.totalCostInr)} · avg ${formatUsd(summary.avgCostPerUserUsd)}/user` : "Awaiting backend"}
        />
        <NocStat
          label="MRR vs Net Margin"
          value={summary ? formatUsd(summary.netMarginUsd) : "—"}
          tone={summary && summary.netMarginUsd < 0 ? "bad" : "good"}
          sub={summary ? `MRR ${formatUsd(summary.totalMrrUsd)}` : "Unit economics"}
        />
        <NocStat
          label="High-Burn Risk"
          value={summary ? String(summary.freeHighBurnUsers + summary.lossMakingUsers) : "—"}
          tone={summary && summary.freeHighBurnUsers + summary.lossMakingUsers > 0 ? "warn" : "good"}
          sub={
            summary
              ? `${summary.freeHighBurnUsers} free burn · ${summary.lossMakingUsers} loss-making`
              : "Margin watch"
          }
        />
        <NocStat
          label="Tokens Burned"
          value={summary ? formatCompactNumber(summary.totalTokensSpent) : "—"}
          sub={summary ? `${formatCompactNumber(summary.totalAiTokens)} LLM raw tokens` : "Token ledger"}
        />
        <NocStat
          label="Crawl Volume"
          value={summary ? `${formatCompactNumber(summary.totalPagesCrawled)} pgs` : "—"}
          sub={
            summary
              ? `${summary.totalCrawls} runs · ${formatCompactNumber(summary.totalRenderedPages)} JS renders`
              : "Crawler engine"
          }
        />
        <NocStat
          label="Active Users"
          value={`${counts.online} / ${rows.length}`}
          tone={counts.online > 0 ? "good" : "default"}
          sub={`${counts.unverified} unverified · ${counts.admins} admins`}
        />
      </div>

      {/* Platform 5-Bucket Cost Share Strip */}
      {buckets && (
        <div className="rounded-lg border border-brand-200 bg-surface-1 px-4 py-3 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11.5px]">
            <span className="font-semibold text-brand-900">Automated Cost Distribution ({window.toUpperCase()})</span>
            <div className="flex flex-wrap items-center gap-3 font-mono text-[11px]">
              {[
                { label: "AI Router", usd: buckets.aiRouterUsd, dotClass: "bg-primary-500" },
                { label: "AI Visibility", usd: buckets.aiVisibilityUsd, dotClass: "bg-series-6" },
                { label: "Crawls & Chromium", usd: buckets.crawlerComputeUsd, dotClass: "bg-series-3" },
                { label: "Geo-Grid Places", usd: buckets.geoGridUsd, dotClass: "bg-series-4" },
                { label: "SERP & Backlinks", usd: buckets.externalApisUsd, dotClass: "bg-series-2" },
              ].map((b) => (
                <span key={b.label} className="inline-flex items-center gap-1.5 text-brand-500">
                  <span className={cn("h-2 w-2 rounded-full", b.dotClass)} />
                  <span>{b.label}:</span>
                  <strong className="text-brand-950">{formatUsd(b.usd)}</strong>
                </span>
              ))}
            </div>
          </div>
          <div className="flex h-2 w-full overflow-hidden rounded-full bg-surface-3">
            {totalBucketUsd > 0 &&
              [
                { usd: buckets.aiRouterUsd, barClass: "bg-primary-500" },
                { usd: buckets.aiVisibilityUsd, barClass: "bg-series-6" },
                { usd: buckets.crawlerComputeUsd, barClass: "bg-series-3" },
                { usd: buckets.geoGridUsd, barClass: "bg-series-4" },
                { usd: buckets.externalApisUsd, barClass: "bg-series-2" },
              ].map((b, i) => {
                const pct = (b.usd / totalBucketUsd) * 100;
                return pct > 0 ? (
                  <div key={i} className={b.barClass} style={{ width: `${pct}%` }} />
                ) : null;
              })}
          </div>
        </div>
      )}

      {/* Master User 360° Cost & Status Table */}
      <NocPanel
        code="USER 360°"
        title="User Status, Consumption & Automated Cost Ledger"
        subtitle="Click any user to open their 360° command sheet: 5-bucket cost trend, token grants, crawl overrides, AI model breakdown & IAM."
        actions={
          <>
            <FilterChipGroup<UserFilter>
              value={filter}
              onChange={setFilter}
              options={[
                { id: "all", label: "All", count: counts.all },
                { id: "free_burn", label: "Free Burn", count: counts.freeBurn, dot: counts.freeBurn > 0 ? "bad" : undefined },
                { id: "loss", label: "Loss Making", count: counts.loss },
                { id: "high_burn", label: ">$1 Cost", count: counts.highBurn },
                { id: "online", label: "Online", count: counts.online, dot: "good" },
                { id: "unverified", label: "Unverified", count: counts.unverified },
                { id: "admins", label: "Admins", count: counts.admins },
              ]}
            />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortBy)}
              aria-label="Sort users by"
              className="h-8 rounded-md border border-brand-200 bg-surface-2 px-2.5 text-[11.5px] font-medium text-brand-700 focus:border-signal-400 focus:outline-none"
            >
              <option value="cost">Sort: Highest Cost</option>
              <option value="tokens">Sort: Most Tokens</option>
              <option value="crawls">Sort: Most Pages Crawled</option>
              <option value="ai">Sort: Most AI Calls</option>
              <option value="newest">Sort: Newest Signups</option>
            </select>
            <AdminSearchInput value={search} onChange={setSearch} placeholder="Search email, name, workspace…" />
          </>
        }
      >
        {loading && rows.length === 0 ? (
          <AdminSkeletonRows rows={6} cols={7} />
        ) : (
          <AdminTableWrap label="User cost and status ledger" minWidth={1120}>
            <AdminThead>
              <tr>
                <Th>User &amp; Status</Th>
                <Th>Workspace &amp; Plan</Th>
                <Th>Token Wallet</Th>
                <Th align="right">Crawls &amp; JS</Th>
                <Th align="right">AI &amp; APIs</Th>
                <Th align="right">Auto Cost (USD / INR)</Th>
                <Th align="right">Controls</Th>
              </tr>
            </AdminThead>
            <tbody>
              {filtered.length > 0 ? (
                filtered.map((u) => (
                  <Tr
                    key={u.id}
                    className="cursor-pointer hover:bg-surface-2/70 transition-colors"
                    onClick={() => setInspectUserId(u.id)}
                  >
                    <Td>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={cn(
                              "h-2 w-2 rounded-full shrink-0",
                              u.isOnline ? "bg-success-500" : "bg-brand-300",
                            )}
                            title={u.isOnline ? "Active session" : "Offline"}
                          />
                          <span className="truncate text-[12.5px] font-semibold text-brand-950">
                            {u.email}
                          </span>
                          {u.isPlatformAdmin && (
                            <Pill tone="info">
                              <ShieldCheck size={9} /> Admin
                            </Pill>
                          )}
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10.5px] text-brand-400">
                          <span>{u.name}</span>
                          <span>·</span>
                          {u.emailVerified ? (
                            <span className="text-success-700 inline-flex items-center gap-0.5">
                              <CheckCircle2 size={10} /> Verified
                            </span>
                          ) : (
                            <span className="text-warning-700">Unverified</span>
                          )}
                          <span>·</span>
                          <span>active {relativeTime(u.lastActiveAt)}</span>
                        </div>
                      </div>
                    </Td>

                    <Td>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[12px] font-medium text-brand-900">{u.primaryOrgName}</span>
                        <TierBadge tier={u.subscriptionTier} />
                      </div>
                      <div className="mt-1 flex items-center gap-1.5">
                        <ProfitabilityBadge status={u.profitabilityStatus} />
                        {u.isSharedWorkspace && (
                          <span className="text-[10px] text-brand-400">shared org</span>
                        )}
                      </div>
                    </Td>

                    <Td>
                      <div className="w-36 space-y-1">
                        <div className="flex items-center justify-between font-mono text-[11px]">
                          <span className="font-semibold text-brand-950">
                            {formatCompactNumber(u.tokens.spent)} used
                          </span>
                          <span className="text-brand-400">{u.tokens.utilizationPct}%</span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
                          <div
                            className={cn(
                              "h-full rounded-full",
                              u.tokens.utilizationPct >= 90
                                ? "bg-error-500"
                                : u.tokens.utilizationPct >= 70
                                  ? "bg-warning-500"
                                  : "bg-signal-400",
                            )}
                            style={{ width: `${Math.min(100, u.tokens.utilizationPct)}%` }}
                          />
                        </div>
                        <span className="block font-mono text-[10px] text-brand-400">
                          {formatCompactNumber(u.tokens.available)} left
                          {u.tokens.shortfall > 0 && (
                            <span className="text-error-700"> · {formatCompactNumber(u.tokens.shortfall)} over</span>
                          )}
                        </span>
                      </div>
                    </Td>

                    <Td align="right">
                      <span className="block font-mono text-[12px] font-semibold text-brand-950 tabular-nums">
                        {formatCompactNumber(u.crawls.pagesCrawled)} pgs
                      </span>
                      <span className="block font-mono text-[10.5px] text-brand-400 tabular-nums">
                        {u.crawls.total} runs · {u.crawls.pagesRendered} JS
                      </span>
                    </Td>

                    <Td align="right">
                      <span className="block font-mono text-[12px] font-semibold text-brand-950 tabular-nums">
                        {u.ai.calls} AI · {u.apis.geoGridPoints + u.apis.externalApiCalls} API
                      </span>
                      {u.ai.topModels[0] ? (
                        <span className="inline-flex items-center gap-1 font-mono text-[10px] text-brand-400">
                          <Zap size={9} className="text-primary-600" />
                          {u.ai.topModels[0].model}
                        </span>
                      ) : (
                        <span className="font-mono text-[10px] text-brand-400">No AI calls</span>
                      )}
                    </Td>

                    <Td align="right">
                      <span className="block font-mono text-[13px] font-semibold text-brand-950 tabular-nums">
                        {formatUsd(u.cost.totalUsd)}
                      </span>
                      <span className="block font-mono text-[10.5px] text-primary-600 tabular-nums">
                        {formatInr(u.cost.totalInr)}
                      </span>
                      <span className="block font-mono text-[9.5px] text-brand-400 tabular-nums">
                        ~{formatUsd(u.projectedMonthlyUsd)}/mo
                      </span>
                    </Td>

                    <Td align="right">
                      <div
                        className="flex items-center justify-end gap-1.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <NocButton
                          variant="primary"
                          icon={<Eye size={11} />}
                          onClick={() => setInspectUserId(u.id)}
                        >
                          360°
                        </NocButton>
                        {!u.emailVerified && (
                          <NocButton
                            variant="secondary"
                            disabled={busyId !== null}
                            icon={<MailCheck size={11} />}
                            onClick={() => void verifyEmail(u)}
                            title="Verify email"
                          >
                            Verify
                          </NocButton>
                        )}
                        {u.isOnline && (
                          <NocButton
                            variant="danger"
                            disabled={busyId !== null}
                            icon={<LogOut size={11} />}
                            onClick={() => setRevokeTarget({ id: u.id, email: u.email, name: u.name })}
                            title="Force sign-out"
                          >
                            Sign Out
                          </NocButton>
                        )}
                      </div>
                    </Td>
                  </Tr>
                ))
              ) : (
                <Tr>
                  <Td colSpan={7} className="py-10 text-center text-[12px] text-brand-400">
                    No users match the current filter.
                  </Td>
                </Tr>
              )}
            </tbody>
          </AdminTableWrap>
        )}
      </NocPanel>

      <User360Drawer
        userId={inspectUserId}
        window={window}
        onClose={() => setInspectUserId(null)}
        onMutated={onRefresh}
      />

      <ConfirmModal
        open={Boolean(revokeTarget)}
        title="Force sign-out user?"
        description={
          revokeTarget
            ? `Revoke all active refresh sessions and invalidate JWTs for ${revokeTarget.name} (${revokeTarget.email})? They will need to log in again immediately.`
            : ""
        }
        confirmLabel="Revoke Sessions"
        tone="danger"
        busy={busyId === `revoke-${revokeTarget?.id}`}
        onConfirm={() => void confirmRevoke()}
        onClose={() => setRevokeTarget(null)}
      />
    </div>
  );
}
