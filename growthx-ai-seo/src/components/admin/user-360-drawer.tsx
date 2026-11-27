"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  Activity,
  CheckCircle2,
  Coins,
  Cpu,
  Globe,
  Loader2,
  LogOut,
  MailCheck,
  Play,
  Plus,
  RefreshCw,
  ShieldCheck,
  Square,
  Wallet,
} from "lucide-react";
import { Pill, StatusNote, Td, Th, Tr, relativeTime } from "@/components/ui/console";
import { api } from "@/lib/api-client";
import type {
  AdminCostWindow,
  AdminProfitabilityStatus,
  AdminSubscriptionTier,
  AdminUser360Response,
} from "@/lib/api-types";
import { errorMessage } from "@/lib/error-message";
import {
  AdminTableWrap,
  AdminThead,
  NocButton,
  SlideOverDialog,
  TierBadge,
  formatCompactNumber,
  formatInr,
  formatUsd,
} from "./admin-primitives";
import { cn } from "@/lib/utils";

type DrawerTab = "cost" | "wallet" | "crawls" | "models" | "ledger";

const TIERS: AdminSubscriptionTier[] = ["founder_free", "starter", "growth", "agency"];

export function ProfitabilityBadge({ status }: { status: AdminProfitabilityStatus }) {
  if (status === "PROFITABLE") return <Pill tone="good">Profitable</Pill>;
  if (status === "WATCH") return <Pill tone="warn">Watch Margin</Pill>;
  if (status === "LOSS_MAKING") return <Pill tone="bad">Loss Making</Pill>;
  if (status === "FREE_HIGH_BURN") return <Pill tone="bad">Free High Burn</Pill>;
  return <Pill tone="default">Low / Idle</Pill>;
}

const BUCKET_CLASS = {
  aiRouter: "bg-primary-500",
  aiVisibility: "bg-series-6",
  crawler: "bg-series-3",
  geoGrid: "bg-series-4",
  externalApis: "bg-series-2",
} as const;

export function User360Drawer({
  userId,
  window,
  onClose,
  onMutated,
}: {
  userId: string | null;
  window: AdminCostWindow;
  onClose: () => void;
  onMutated: () => Promise<void> | void;
}) {
  const [data, setData] = useState<AdminUser360Response | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<DrawerTab>("cost");
  const [busy, setBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ tone: "good" | "bad"; text: string } | null>(null);

  // Interactive quota/token operator controls
  const [selectedOrgId, setSelectedOrgId] = useState<string>("");
  const [tokenDelta, setTokenDelta] = useState("1000000");
  const [tokenNote, setTokenNote] = useState("Operator bonus grant");
  const [allowanceInput, setAllowanceInput] = useState("");
  const [tierInput, setTierInput] = useState<AdminSubscriptionTier>("founder_free");
  const [budgetInput, setBudgetInput] = useState("");

  const syncWorkspaceInputs = useCallback(
    (ws: AdminUser360Response["workspaces"][number]) => {
      setTierInput((ws.subscriptionTier as AdminSubscriptionTier) || "founder_free");
      setBudgetInput(ws.aiMonthlyBudgetUsd != null ? String(ws.aiMonthlyBudgetUsd) : "");
      setAllowanceInput(
        ws.wallet.customMonthlyAllowance != null ? String(ws.wallet.customMonthlyAllowance) : "",
      );
    },
    [],
  );

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.getAdminUser360(userId, window);
      setData(res);
      const firstOrg = res.workspaces[0];
      if (firstOrg) {
        const nextOrg = res.workspaces.find((w) => w.id === selectedOrgId) ?? firstOrg;
        setSelectedOrgId(nextOrg.id);
        syncWorkspaceInputs(nextOrg);
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [userId, window, selectedOrgId, syncWorkspaceInputs]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!userId) {
        setData(null);
        setFeedback(null);
        setError(null);
        return;
      }
      void load();
    }, 0);
    return () => clearTimeout(timer);
  }, [userId, window]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeWorkspace =
    data?.workspaces.find((w) => w.id === selectedOrgId) ?? data?.workspaces[0] ?? null;

  function selectWorkspace(ws: AdminUser360Response["workspaces"][number]) {
    setSelectedOrgId(ws.id);
    syncWorkspaceInputs(ws);
  }

  async function runAction(key: string, fn: () => Promise<string>) {
    setBusy(key);
    setFeedback(null);
    try {
      const msg = await fn();
      setFeedback({ tone: "good", text: msg });
      await load();
      await onMutated();
    } catch (err) {
      setFeedback({ tone: "bad", text: errorMessage(err) });
    } finally {
      setBusy(null);
    }
  }

  const totalCost = data?.cost.totalUsd ?? 0;
  const bucketItems = data
    ? [
        { label: "AI Router (LLMs)", usd: data.cost.aiRouterUsd, colorClass: BUCKET_CLASS.aiRouter },
        { label: "AI Visibility", usd: data.cost.aiVisibilityUsd, colorClass: BUCKET_CLASS.aiVisibility },
        { label: "Crawl & Chromium", usd: data.cost.crawlerComputeUsd, colorClass: BUCKET_CLASS.crawler },
        { label: "Geo-Grid Places", usd: data.cost.geoGridUsd, colorClass: BUCKET_CLASS.geoGrid },
        { label: "SERP & Backlinks", usd: data.cost.externalApisUsd, colorClass: BUCKET_CLASS.externalApis },
      ]
    : [];

  const maxDayUsd = data ? Math.max(0.0001, ...data.dailyTrend.map((d) => d.totalUsd)) : 1;

  return (
    <SlideOverDialog
      open={Boolean(userId)}
      onClose={onClose}
      widthClass="w-[min(860px,100vw)]"
      title={data ? data.user.name : "User 360° Inspector"}
      subtitle={data ? `${data.user.email} · UUID ${data.user.id.slice(0, 8)} · Window: ${window.toUpperCase()}` : "Loading full telemetry…"}
      headerAside={
        data ? (
          <div className="flex items-center gap-1.5">
            <ProfitabilityBadge status={data.cost.profitabilityStatus} />
            {data.user.isPlatformAdmin && (
              <Pill tone="info">
                <ShieldCheck size={10} /> Admin
              </Pill>
            )}
          </div>
        ) : null
      }
    >
      {loading && !data ? (
        <div className="flex items-center justify-center py-20 text-[13px] text-brand-400 gap-2">
          <Loader2 size={16} className="animate-spin text-primary-600" />
          <span>Computing live 5-bucket cost &amp; activity telemetry…</span>
        </div>
      ) : error ? (
        <StatusNote tone="bad">{error}</StatusNote>
      ) : data ? (
        <div className="space-y-5">
          {feedback && <StatusNote tone={feedback.tone}>{feedback.text}</StatusNote>}

          {/* Top Identity & Quick IAM Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-brand-200 bg-surface-2/60 px-3.5 py-2.5">
            <div className="flex flex-wrap items-center gap-2 text-[11.5px]">
              {data.user.emailVerified ? (
                <Pill tone="good">
                  <CheckCircle2 size={10} /> Verified
                </Pill>
              ) : (
                <Pill tone="warn">Unverified</Pill>
              )}
              <Pill tone="default">{data.user.authProvider}</Pill>
              <Pill tone={data.user.activeSessions.length > 0 ? "good" : "default"} dot={data.user.activeSessions.length > 0}>
                {data.user.activeSessions.length > 0
                  ? `${data.user.activeSessions.length} Active Session${data.user.activeSessions.length === 1 ? "" : "s"}`
                  : "Offline"}
              </Pill>
              <span className="text-brand-400">Joined {relativeTime(data.user.createdAt)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              {!data.user.emailVerified && (
                <NocButton
                  variant="primary"
                  disabled={busy !== null}
                  icon={<MailCheck size={12} />}
                  onClick={() =>
                    void runAction("verify", async () => {
                      await api.verifyAdminUserEmail(data.user.id);
                      return `Verified email for ${data.user.email}.`;
                    })
                  }
                >
                  Verify Email
                </NocButton>
              )}
              <NocButton
                variant="danger"
                disabled={busy !== null || data.user.activeSessions.length === 0}
                icon={<LogOut size={12} />}
                onClick={() =>
                  void runAction("revoke", async () => {
                    const res = await api.revokeAdminUserSessions(data.user.id);
                    return `Signed out ${data.user.email} (${res.revokedSessions} session revoked).`;
                  })
                }
              >
                Force Sign-Out
              </NocButton>
              <NocButton
                disabled={loading}
                icon={<RefreshCw size={12} className={loading ? "animate-spin" : ""} />}
                onClick={() => void load()}
              >
                Refresh
              </NocButton>
            </div>
          </div>

          {/* 4-Card Unit Economics Hero */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="rounded-lg border border-brand-200 bg-surface-2/40 p-3.5">
              <span className="text-[11px] text-brand-400 block">Actual Cost ({window.toUpperCase()})</span>
              <span className="mt-1 block font-mono text-[20px] font-semibold text-brand-950 tabular-nums">
                {formatUsd(data.cost.totalUsd)}
              </span>
              <span className="block font-mono text-[11px] text-primary-600 tabular-nums">
                {formatInr(data.cost.totalInr)}
              </span>
            </div>
            <div className="rounded-lg border border-brand-200 bg-surface-2/40 p-3.5">
              <span className="text-[11px] text-brand-400 block">Projected 30d Burn</span>
              <span className="mt-1 block font-mono text-[20px] font-semibold text-brand-950 tabular-nums">
                {formatUsd(data.cost.projectedMonthlyUsd)}
              </span>
              <span className="block font-mono text-[11px] text-brand-400 tabular-nums">
                {formatInr(data.cost.projectedMonthlyInr)} / mo
              </span>
            </div>
            <div className="rounded-lg border border-brand-200 bg-surface-2/40 p-3.5">
              <span className="text-[11px] text-brand-400 block">Plan MRR vs Net Margin</span>
              <span
                className={cn(
                  "mt-1 block font-mono text-[20px] font-semibold tabular-nums",
                  data.cost.netMarginUsd < 0 ? "text-error-700" : "text-success-700",
                )}
              >
                {data.cost.netMarginUsd >= 0 ? "+" : ""}
                {formatUsd(data.cost.netMarginUsd)}
              </span>
              <span className="block font-mono text-[11px] text-brand-400 tabular-nums">
                MRR {formatUsd(data.cost.mrrUsd)}
                {data.cost.marginPct != null ? ` · ${data.cost.marginPct}%` : " · Free tier"}
              </span>
            </div>
            <div className="rounded-lg border border-brand-200 bg-surface-2/40 p-3.5">
              <span className="text-[11px] text-brand-400 block">Crawl &amp; AI Activity</span>
              <span className="mt-1 block font-mono text-[20px] font-semibold text-brand-950 tabular-nums">
                {formatCompactNumber(data.usageSummary.pagesCrawled)} pgs
              </span>
              <span className="block font-mono text-[11px] text-brand-400 tabular-nums">
                {data.usageSummary.pagesRendered} JS renders · {data.models.reduce((s, m) => s + m.calls, 0)} AI calls
              </span>
            </div>
          </div>

          {/* 5-Bucket Stacked Cost Distribution Bar */}
          <div className="rounded-lg border border-brand-200 bg-surface-2/30 p-3.5 space-y-2.5">
            <div className="flex items-center justify-between text-[11.5px]">
              <span className="font-semibold text-brand-900">5-Bucket Cost Breakdown (FX: ₹{data.rates.usdToInr}/$1)</span>
              {data.cost.unpricedAiCalls > 0 && (
                <span className="text-[11px] text-warning-700">
                  {data.cost.unpricedAiCalls} unpriced model call(s)
                </span>
              )}
            </div>
            <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-surface-3">
              {totalCost > 0 ? (
                bucketItems.map((b) => {
                  const pct = (b.usd / totalCost) * 100;
                  if (pct <= 0) return null;
                  return (
                    <div
                      key={b.label}
                      className={b.colorClass}
                      title={`${b.label}: ${formatUsd(b.usd)} (${pct.toFixed(1)}%)`}
                      style={{ width: `${pct}%` }}
                    />
                  );
                })
              ) : (
                <div className="h-full w-full bg-surface-3" />
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {bucketItems.map((b) => (
                <div key={b.label} className="rounded-md border border-brand-200/70 bg-surface-1 px-2.5 py-2">
                  <div className="flex items-center gap-1.5 text-[10.5px] text-brand-400">
                    <span className={cn("h-2 w-2 rounded-full shrink-0", b.colorClass)} />
                    <span className="truncate">{b.label}</span>
                  </div>
                  <div className="mt-1 font-mono text-[12px] font-semibold text-brand-950 tabular-nums">
                    {formatUsd(b.usd)}
                  </div>
                  <div className="font-mono text-[10px] text-brand-400 tabular-nums">
                    {formatInr(b.usd * data.rates.usdToInr)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Inner Sub-Tab Navigation */}
          <div className="flex flex-wrap gap-1 border-b border-brand-200 pb-2">
            {(
              [
                { id: "cost", label: "Cost & Usage", icon: Coins },
                { id: "wallet", label: "Wallet & Quotas", icon: Wallet },
                { id: "crawls", label: `Websites & Crawls (${data.recentCrawls.length})`, icon: Globe },
                { id: "models", label: `AI Models (${data.models.length})`, icon: Cpu },
                { id: "ledger", label: "Ledger & Activity", icon: Activity },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-medium transition cursor-pointer",
                  tab === t.id
                    ? "bg-signal-400/15 text-primary-600 ring-1 ring-inset ring-signal-400/30"
                    : "text-brand-400 hover:bg-surface-2 hover:text-brand-950",
                )}
              >
                <t.icon size={12} />
                {t.label}
              </button>
            ))}
          </div>

          {/* TAB 1: COST TREND & MODULE USAGE */}
          {tab === "cost" && (
            <div className="space-y-4">
              <div className="rounded-lg border border-brand-200 bg-surface-2/30 p-3.5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[12px] font-semibold text-brand-900">Daily Cost Burn Trend</span>
                  <span className="font-mono text-[11px] text-brand-400">
                    Peak: {formatUsd(Math.max(0, ...data.dailyTrend.map((d) => d.totalUsd)))} / day
                  </span>
                </div>
                <div className="flex items-end gap-1.5 h-28 pt-2">
                  {data.dailyTrend.map((d) => {
                    const heightPct = d.totalUsd > 0 ? Math.max(8, Math.round((d.totalUsd / maxDayUsd) * 100)) : 3;
                    return (
                      <div
                        key={d.date}
                        className="group flex-1 flex flex-col items-center gap-1 h-full justify-end"
                        title={`${d.date}: ${formatUsd(d.totalUsd)} (${formatInr(d.totalInr)}) — AI ${formatUsd(d.aiUsd)}, Crawl ${formatUsd(d.crawlUsd)}, APIs ${formatUsd(d.apisUsd)}`}
                      >
                        <div
                          className={cn(
                            "w-full rounded-t-xs transition-all",
                            d.totalUsd > 0 ? "bg-signal-400/80 group-hover:bg-primary-600" : "bg-surface-3",
                          )}
                          style={{ height: `${heightPct}%` }}
                        />
                        <span className="font-mono text-[9px] text-brand-400">{d.date.slice(5)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {[
                  { label: "Website Crawls", val: data.usageSummary.crawlsCount },
                  { label: "JS Rendered Pages", val: data.usageSummary.pagesRendered },
                  { label: "AI Visibility Scans", val: data.usageSummary.aiVisibilityScans },
                  { label: "Geo-Grid Points", val: data.usageSummary.geoGridPoints },
                  { label: "SERP Checks", val: data.usageSummary.serpChecks },
                  { label: "Keyword Gaps", val: data.usageSummary.keywordGapChecks },
                  { label: "Backlink Runs", val: data.usageSummary.backlinkRuns },
                  { label: "Fix Engine Patches", val: data.usageSummary.fixInterventions },
                  { label: "Audit Reports", val: data.usageSummary.auditReports },
                  { label: "Voice Sessions", val: data.usageSummary.voiceSessions },
                  { label: "Workspaces", val: data.workspaces.length },
                  { label: "Own Websites", val: data.websites.length },
                ].map((m) => (
                  <div key={m.label} className="rounded-md border border-brand-200 bg-surface-1 px-3 py-2">
                    <span className="block text-[10.5px] text-brand-400">{m.label}</span>
                    <span className="font-mono text-[15px] font-semibold text-brand-950 tabular-nums">
                      {m.val.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 2: WALLET & INSTANT QUOTA CONTROLS */}
          {tab === "wallet" && (
            <div className="space-y-4">
              {data.workspaces.length > 1 && (
                <div className="flex flex-wrap gap-1.5">
                  {data.workspaces.map((ws) => (
                    <button
                      key={ws.id}
                      type="button"
                      onClick={() => selectWorkspace(ws)}
                      className={cn(
                        "rounded-md border px-2.5 py-1 text-[11.5px] font-medium cursor-pointer",
                        activeWorkspace?.id === ws.id
                          ? "border-signal-400 bg-signal-400/15 text-primary-600"
                          : "border-brand-200 bg-surface-2 text-brand-500",
                      )}
                    >
                      {ws.name} ({ws.role})
                    </button>
                  ))}
                </div>
              )}

              {activeWorkspace ? (
                <>
                  <div className="rounded-lg border border-brand-200 bg-surface-2/40 p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-semibold text-brand-950">{activeWorkspace.name}</span>
                          <TierBadge tier={activeWorkspace.subscriptionTier} />
                        </div>
                        <span className="text-[11px] text-brand-400">
                          {activeWorkspace.memberCount} member(s) · AI Cap:{" "}
                          {activeWorkspace.aiMonthlyBudgetUsd != null
                            ? formatUsd(activeWorkspace.aiMonthlyBudgetUsd)
                            : "Unlimited"}
                        </span>
                      </div>
                      <div className="text-right font-mono">
                        <span className="block text-[18px] font-semibold text-brand-950 tabular-nums">
                          {formatCompactNumber(activeWorkspace.wallet.available)} tokens
                        </span>
                        <span className="block text-[10.5px] text-brand-400">
                          {formatCompactNumber(activeWorkspace.wallet.allowanceRemaining)} allowance +{" "}
                          {formatCompactNumber(activeWorkspace.wallet.bonus)} bonus
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Grant / Deduct Bonus Tokens */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="rounded-lg border border-brand-200 bg-surface-1 p-3.5 space-y-2.5">
                      <span className="block text-[12px] font-semibold text-brand-950">Grant or Adjust Bonus Tokens</span>
                      <p className="text-[11px] text-brand-400">
                        Positive grants never expire; negative deducts from bonus balance. Logged to ledger.
                      </p>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          value={tokenDelta}
                          onChange={(e) => setTokenDelta(e.target.value)}
                          placeholder="e.g. 1000000"
                          className="h-8 flex-1 rounded-md border border-brand-200 bg-surface-2 px-2.5 font-mono text-[12px] text-brand-950 focus:border-signal-400 focus:outline-none"
                        />
                        <NocButton
                          variant="primary"
                          disabled={busy !== null}
                          icon={<Plus size={12} />}
                          onClick={() =>
                            void runAction("grant", async () => {
                              const amt = parseInt(tokenDelta, 10);
                              if (!Number.isInteger(amt) || amt === 0) throw new Error("Enter a non-zero whole number.");
                              await api.adjustTokens(activeWorkspace.id, amt, tokenNote.trim() || "Admin adjustment");
                              return `${amt > 0 ? "Granted" : "Deducted"} ${Math.abs(amt).toLocaleString()} tokens on ${activeWorkspace.name}.`;
                            })
                          }
                        >
                          Apply
                        </NocButton>
                      </div>
                      <input
                        type="text"
                        value={tokenNote}
                        onChange={(e) => setTokenNote(e.target.value)}
                        placeholder="Operator note (audit trail)"
                        className="h-8 w-full rounded-md border border-brand-200 bg-surface-2 px-2.5 text-[11.5px] text-brand-900 focus:border-signal-400 focus:outline-none"
                      />
                    </div>

                    {/* Plan Tier, AI USD Cap & Monthly Allowance */}
                    <div className="rounded-lg border border-brand-200 bg-surface-1 p-3.5 space-y-2.5">
                      <span className="block text-[12px] font-semibold text-brand-950">Plan Tier, AI Cap &amp; Monthly Allowance</span>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10.5px] text-brand-400 mb-1">Subscription Tier</label>
                          <select
                            value={tierInput}
                            onChange={(e) => setTierInput(e.target.value as AdminSubscriptionTier)}
                            className="h-8 w-full rounded-md border border-brand-200 bg-surface-2 px-2 text-[12px] text-brand-950 focus:border-signal-400 focus:outline-none"
                          >
                            {TIERS.map((t) => (
                              <option key={t} value={t}>
                                {t}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10.5px] text-brand-400 mb-1">AI Monthly Cap (USD)</label>
                          <input
                            type="number"
                            step="1"
                            min="0"
                            value={budgetInput}
                            onChange={(e) => setBudgetInput(e.target.value)}
                            placeholder="Unlimited"
                            className="h-8 w-full rounded-md border border-brand-200 bg-surface-2 px-2.5 font-mono text-[12px] text-brand-950 focus:border-signal-400 focus:outline-none"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2 items-end">
                        <div className="flex-1">
                          <label className="block text-[10.5px] text-brand-400 mb-1">Monthly Token Allowance Override</label>
                          <input
                            type="number"
                            value={allowanceInput}
                            onChange={(e) => setAllowanceInput(e.target.value)}
                            placeholder={`Default (${formatCompactNumber(activeWorkspace.wallet.monthlyAllowance)})`}
                            className="h-8 w-full rounded-md border border-brand-200 bg-surface-2 px-2.5 font-mono text-[12px] text-brand-950 focus:border-signal-400 focus:outline-none"
                          />
                        </div>
                        <NocButton
                          variant="primary"
                          disabled={busy !== null}
                          onClick={() =>
                            void runAction("quotas", async () => {
                              const parsedBudget =
                                budgetInput.trim() === "" ? null : Number(budgetInput.trim());
                              await api.updateAdminTenant(activeWorkspace.id, {
                                subscriptionTier: tierInput,
                                aiMonthlyBudgetUsd: parsedBudget,
                              });
                              const parsedAllow =
                                allowanceInput.trim() === "" ? null : parseInt(allowanceInput.trim(), 10);
                              await api.setAdminOrgTokenAllowance(activeWorkspace.id, parsedAllow);
                              return `Updated plan tier, AI USD cap, and monthly allowance for ${activeWorkspace.name}.`;
                            })
                          }
                        >
                          Save Quotas
                        </NocButton>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <StatusNote>This user does not belong to a workspace yet.</StatusNote>
              )}
            </div>
          )}

          {/* TAB 3: WEBSITES & CRAWLS */}
          {tab === "crawls" && (
            <div className="space-y-4">
              {data.websites.length > 0 && (
                <div className="space-y-2">
                  <span className="text-[11.5px] font-semibold text-brand-700">Owned Websites ({data.websites.length})</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {data.websites.map((w) => (
                      <div key={w.id} className="flex items-center justify-between gap-2 rounded-md border border-brand-200 bg-surface-2/40 px-3 py-2">
                        <div className="min-w-0">
                          <span className="block truncate font-mono text-[12px] font-semibold text-brand-950">{w.domain}</span>
                          <span className="block text-[10.5px] text-brand-400">
                            {w.isVerified ? "Verified" : "Unverified"} · {w.crawlFrequency} · depth {w.maxDepth}
                          </span>
                        </div>
                        <NocButton
                          variant="secondary"
                          disabled={busy !== null}
                          icon={<Play size={11} />}
                          onClick={() =>
                            void runAction(`crawl-${w.id}`, async () => {
                              await api.triggerAdminWebsiteCrawl(w.id, { forceVerify: true });
                              return `Triggered live crawl for ${w.domain}.`;
                            })
                          }
                        >
                          Crawl
                        </NocButton>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <AdminTableWrap label="User crawl runs" minWidth={640} maxHeightClass="max-h-[340px]">
                <AdminThead>
                  <tr>
                    <Th>Domain</Th>
                    <Th>Status</Th>
                    <Th align="right">Pages (JS)</Th>
                    <Th align="right">Issues</Th>
                    <Th align="right">Est. Compute</Th>
                    <Th align="right">Action</Th>
                  </tr>
                </AdminThead>
                <tbody>
                  {data.recentCrawls.length > 0 ? (
                    data.recentCrawls.map((c) => (
                      <Tr key={c.id}>
                        <Td>
                          <span className="font-mono text-[11.5px] font-medium text-brand-950">{c.domain}</span>
                          <span className="block text-[10px] text-brand-400">{relativeTime(c.createdAt)}</span>
                        </Td>
                        <Td>
                          <Pill tone={c.status === "COMPLETED" ? "good" : c.status === "FAILED" ? "bad" : "info"}>
                            {c.status}
                          </Pill>
                        </Td>
                        <Td align="right">
                          <span className="font-mono text-[11.5px] text-brand-900">
                            {c.pagesCrawled} <span className="text-brand-400">({c.pagesRendered} JS)</span>
                          </span>
                        </Td>
                        <Td align="right">
                          <span className="font-mono text-[11.5px] text-brand-600">{c.issuesFound}</span>
                        </Td>
                        <Td align="right">
                          <span className="font-mono text-[11.5px] text-brand-950">{formatUsd(c.costUsd)}</span>
                          <span className="block font-mono text-[10px] text-brand-400">{formatInr(c.costInr)}</span>
                        </Td>
                        <Td align="right">
                          {(c.status === "RUNNING" || c.status === "PENDING") ? (
                            <NocButton
                              variant="danger"
                              disabled={busy !== null}
                              icon={<Square size={10} />}
                              onClick={() =>
                                void runAction(`cancel-${c.id}`, async () => {
                                  await api.cancelAdminCrawl(c.id);
                                  return `Cancelled crawl ${c.id.slice(0, 8)} for ${c.domain}.`;
                                })
                              }
                            >
                              Stop
                            </NocButton>
                          ) : (
                            <span className="text-[10.5px] text-brand-400">—</span>
                          )}
                        </Td>
                      </Tr>
                    ))
                  ) : (
                    <Tr>
                      <Td colSpan={6} className="py-8 text-center text-[12px] text-brand-400">
                        No crawl runs in this window.
                      </Td>
                    </Tr>
                  )}
                </tbody>
              </AdminTableWrap>
            </div>
          )}

          {/* TAB 4: AI MODELS & TASKS */}
          {tab === "models" && (
            <div className="space-y-4">
              <AdminTableWrap label="AI models breakdown" minWidth={600} maxHeightClass="max-h-[260px]">
                <AdminThead>
                  <tr>
                    <Th>Model / Provider</Th>
                    <Th align="right">Calls (Err)</Th>
                    <Th align="right">Tokens (In / Out)</Th>
                    <Th align="right">Latency</Th>
                    <Th align="right">Cost (USD / INR)</Th>
                  </tr>
                </AdminThead>
                <tbody>
                  {data.models.length > 0 ? (
                    data.models.map((m) => (
                      <Tr key={`${m.provider}-${m.model}`}>
                        <Td>
                          <span className="font-mono text-[11.5px] font-semibold text-brand-950">{m.model}</span>
                          <span className="block text-[10px] text-brand-400">{m.provider}</span>
                        </Td>
                        <Td align="right">
                          <span className="font-mono text-[11.5px] text-brand-900">
                            {m.calls} {m.errors > 0 && <span className="text-error-700">({m.errors})</span>}
                          </span>
                        </Td>
                        <Td align="right">
                          <span className="font-mono text-[11px] text-brand-600">
                            {formatCompactNumber(m.inputTokens)} / {formatCompactNumber(m.outputTokens)}
                          </span>
                        </Td>
                        <Td align="right">
                          <span className="font-mono text-[11px] text-brand-400">
                            {m.avgLatencyMs > 0 ? `${m.avgLatencyMs}ms` : "—"}
                          </span>
                        </Td>
                        <Td align="right">
                          <span className="font-mono text-[11.5px] font-semibold text-brand-950">{formatUsd(m.costUsd)}</span>
                          <span className="block font-mono text-[10px] text-primary-600">{formatInr(m.costInr)}</span>
                        </Td>
                      </Tr>
                    ))
                  ) : (
                    <Tr>
                      <Td colSpan={5} className="py-8 text-center text-[12px] text-brand-400">
                        No AI calls recorded in this window.
                      </Td>
                    </Tr>
                  )}
                </tbody>
              </AdminTableWrap>

              {data.tasks.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[11.5px] font-semibold text-brand-700">Spend by Feature / Task</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {data.tasks.map((t) => (
                      <div key={t.taskType} className="flex items-center justify-between rounded-md border border-brand-200 bg-surface-2/30 px-3 py-2 text-[11.5px]">
                        <div>
                          <span className="font-mono font-medium text-brand-900">{t.taskType}</span>
                          <span className="block text-[10px] text-brand-400">
                            {t.calls} calls · {formatCompactNumber(t.tokens)} tokens
                          </span>
                        </div>
                        <div className="text-right font-mono">
                          <span className="block font-semibold text-brand-950">{formatUsd(t.costUsd)}</span>
                          <span className="block text-[10px] text-brand-400">{formatInr(t.costInr)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: TOKEN LEDGER & ACTIVITY */}
          {tab === "ledger" && (
            <div className="space-y-4">
              <AdminTableWrap label="Token ledger transactions" minWidth={580} maxHeightClass="max-h-[300px]">
                <AdminThead>
                  <tr>
                    <Th>Action / Kind</Th>
                    <Th align="right">Delta</Th>
                    <Th align="right">Balance After</Th>
                    <Th align="right">Time</Th>
                  </tr>
                </AdminThead>
                <tbody>
                  {data.recentTokenTransactions.length > 0 ? (
                    data.recentTokenTransactions.map((tx) => (
                      <Tr key={tx.id}>
                        <Td>
                          <div className="flex items-center gap-1.5">
                            <Pill tone={tx.tokens >= 0 ? "good" : "default"}>{tx.kind}</Pill>
                            <span className="font-mono text-[11px] text-brand-900">{tx.action}</span>
                          </div>
                        </Td>
                        <Td align="right">
                          <span
                            className={cn(
                              "font-mono text-[11.5px] font-semibold",
                              tx.tokens >= 0 ? "text-success-700" : "text-brand-900",
                            )}
                          >
                            {tx.tokens >= 0 ? "+" : ""}
                            {tx.tokens.toLocaleString()}
                          </span>
                        </Td>
                        <Td align="right">
                          <span className="font-mono text-[11px] text-brand-500">
                            {tx.balanceAfter.toLocaleString()}
                          </span>
                        </Td>
                        <Td align="right">
                          <span className="font-mono text-[10.5px] text-brand-400">
                            {relativeTime(tx.createdAt)}
                          </span>
                        </Td>
                      </Tr>
                    ))
                  ) : (
                    <Tr>
                      <Td colSpan={4} className="py-8 text-center text-[12px] text-brand-400">
                        No token ledger entries in this window.
                      </Td>
                    </Tr>
                  )}
                </tbody>
              </AdminTableWrap>
            </div>
          )}
        </div>
      ) : null}
    </SlideOverDialog>
  );
}
