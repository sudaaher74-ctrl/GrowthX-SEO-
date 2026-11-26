"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Check,
  Coins,
  Globe,
  Loader2,
  SlidersHorizontal,
  Users,
} from "lucide-react";
import {
  ActionButton,
  MeterBar,
  Panel,
  Pill,
  StatusNote,
  Tabs,
  Td,
  Th,
  Tr,
  relativeTime,
} from "@/components/ui/console";
import { api } from "@/lib/api-client";
import type {
  AdminSubscriptionTier,
  AdminTenantDetail,
  AdminTenantTokensOverview,
  TenantStat,
} from "@/lib/api-types";
import { errorMessage } from "@/lib/error-message";
import { formatTokens, formatTokensExact } from "@/lib/tokens";
import {
  AdminSearchInput,
  AdminSkeletonRows,
  AdminTableWrap,
  AdminThead,
  ConfirmModal,
  FilterChipGroup,
  SlideOverDialog,
  TierBadge,
  formatCompactNumber,
  formatUsd,
} from "./admin-primitives";

const MAX_ADJUSTMENT = 1_000_000_000;

interface TenantsSectionProps {
  tenants: TenantStat[];
  loading: boolean;
  onRefresh: () => Promise<void> | void;
}

type TierFilter = "all" | AdminSubscriptionTier;

export function TenantsSection({ tenants, loading, onRefresh }: TenantsSectionProps) {
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState<TierFilter>("all");
  const [selectedTenant, setSelectedTenant] = useState<TenantStat | null>(null);

  const tierCounts = useMemo(() => {
    const counts: Record<string, number> = { agency: 0, growth: 0, starter: 0, founder_free: 0 };
    for (const t of tenants) {
      const key = t.subscriptionTier ?? "founder_free";
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts;
  }, [tenants]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tenants.filter((t) => {
      const tier = t.subscriptionTier ?? "founder_free";
      if (tierFilter !== "all" && tier !== tierFilter) return false;
      if (!q) return true;
      return (
        t.name.toLowerCase().includes(q) ||
        (t.owner && t.owner.toLowerCase().includes(q)) ||
        (t.slug && t.slug.toLowerCase().includes(q))
      );
    });
  }, [tenants, search, tierFilter]);

  return (
    <div className="space-y-4">
      <Panel
        title="Tenant Organizations"
        subtitle="Manage client workspaces, subscription tiers, monthly AI spend caps, and token wallets."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <FilterChipGroup<TierFilter>
              value={tierFilter}
              onChange={setTierFilter}
              options={[
                { id: "all", label: "All", count: tenants.length },
                { id: "agency", label: "Agency", count: tierCounts.agency },
                { id: "growth", label: "Growth", count: tierCounts.growth },
                { id: "starter", label: "Starter", count: tierCounts.starter },
                { id: "founder_free", label: "Founder Free", count: tierCounts.founder_free },
              ]}
            />
            <AdminSearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search org, slug, or owner…"
            />
          </div>
        }
      >
        {loading && tenants.length === 0 ? (
          <AdminSkeletonRows rows={6} cols={6} />
        ) : (
          <AdminTableWrap label="Tenant organizations" minWidth={880}>
            <AdminThead>
              <tr>
                <Th>Organization</Th>
                <Th>Plan Tier</Th>
                <Th>Owner</Th>
                <Th align="right">Sites / Members</Th>
                <Th>Token Wallet</Th>
                <Th align="right">MTD AI Spend</Th>
                <Th align="right">Manage</Th>
              </tr>
            </AdminThead>
            <tbody>
              {filtered.length > 0 ? (
                filtered.map((t) => {
                  const pctLeft =
                    t.tokens && t.tokens.monthly > 0
                      ? Math.min(100, Math.round((t.tokens.available / t.tokens.monthly) * 100))
                      : null;
                  const budgetPct =
                    t.aiMonthlyBudgetUsd && t.aiMonthlyBudgetUsd > 0 && t.mtdAiSpendUsd != null
                      ? Math.round((t.mtdAiSpendUsd / t.aiMonthlyBudgetUsd) * 100)
                      : null;

                  return (
                    <Tr key={t.id}>
                      <Td>
                        <div className="flex items-center gap-3">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-signal-400 font-mono text-[11px] font-bold text-signal-ink">
                            {t.name.slice(0, 2).toUpperCase()}
                          </span>
                          <div className="min-w-0">
                            <span className="block truncate text-[13px] font-semibold text-brand-950">
                              {t.name}
                            </span>
                            <span className="block truncate font-mono text-[10.5px] text-brand-400">
                              {t.slug ? t.slug : t.id.slice(0, 8)}
                              {t.whiteLabelEnabled ? " · White-label" : ""}
                            </span>
                          </div>
                        </div>
                      </Td>
                      <Td>
                        <TierBadge tier={t.subscriptionTier} />
                      </Td>
                      <Td>
                        <span className="text-[12.5px] text-brand-600">{t.owner || "—"}</span>
                      </Td>
                      <Td align="right">
                        <div className="font-mono text-[12px] text-brand-950 tabular-nums">
                          {t.sites} site{t.sites === 1 ? "" : "s"}
                        </div>
                        <div className="font-mono text-[10.5px] text-brand-400 tabular-nums">
                          {t.memberCount ?? 0} member{(t.memberCount ?? 0) === 1 ? "" : "s"}
                        </div>
                      </Td>
                      <Td>
                        {t.tokens ? (
                          <div className="space-y-1 min-w-[130px]">
                            <div
                              className="font-mono text-[12px] tabular-nums"
                              title={`${formatTokensExact(t.tokens.available)} available, ${formatTokensExact(t.tokens.monthly)}/mo`}
                            >
                              <strong className="text-brand-950">{formatTokens(t.tokens.available)}</strong>{" "}
                              <span className="text-[10.5px] text-brand-400">
                                / {formatTokens(t.tokens.monthly)}
                              </span>
                            </div>
                            {pctLeft !== null && (
                              <MeterBar value={pctLeft} tone={pctLeft > 25 ? "good" : "accent"} width={120} />
                            )}
                          </div>
                        ) : (
                          <span className="text-[11.5px] text-brand-400">Wallet inactive</span>
                        )}
                      </Td>
                      <Td align="right">
                        <div className="font-mono text-[12.5px] font-semibold text-brand-950 tabular-nums">
                          {formatUsd(t.mtdAiSpendUsd ?? 0)}
                        </div>
                        <div className="font-mono text-[10.5px] text-brand-400 tabular-nums">
                          {t.aiMonthlyBudgetUsd != null
                            ? `Cap ${formatUsd(t.aiMonthlyBudgetUsd)}${budgetPct !== null ? ` (${budgetPct}%)` : ""}`
                            : "No cap"}
                        </div>
                      </Td>
                      <Td align="right">
                        <ActionButton
                          variant="secondary"
                          icon={<SlidersHorizontal size={12} />}
                          onClick={() => setSelectedTenant(t)}
                          className="ml-auto"
                        >
                          Manage
                        </ActionButton>
                      </Td>
                    </Tr>
                  );
                })
              ) : (
                <Tr>
                  <Td colSpan={7} className="py-10 text-center text-[12.5px] text-brand-500">
                    No organizations match your current filters.
                  </Td>
                </Tr>
              )}
            </tbody>
          </AdminTableWrap>
        )}
      </Panel>

      {selectedTenant && (
        <TenantDetailDrawer
          key={selectedTenant.id}
          tenant={selectedTenant}
          onClose={() => setSelectedTenant(null)}
          onMutated={onRefresh}
        />
      )}
    </div>
  );
}

type DrawerTab = "billing" | "tokens" | "projects" | "members";

function TenantDetailDrawer({
  tenant,
  onClose,
  onMutated,
}: {
  tenant: TenantStat;
  onClose: () => void;
  onMutated: () => Promise<void> | void;
}) {
  const [tab, setTab] = useState<DrawerTab>("billing");
  const [detail, setDetail] = useState<AdminTenantDetail | null>(null);
  const [tokensData, setTokensData] = useState<AdminTenantTokensOverview | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Billing form
  const [tier, setTier] = useState<AdminSubscriptionTier>("founder_free");
  const [budgetStr, setBudgetStr] = useState("");
  const [whiteLabel, setWhiteLabel] = useState(false);
  const [savingBilling, setSavingBilling] = useState(false);
  const [billingFeedback, setBillingFeedback] = useState<{ tone: "good" | "bad"; text: string } | null>(null);

  // Token grant form
  const [grantAmount, setGrantAmount] = useState("");
  const [grantNote, setGrantNote] = useState("");
  const [grantBusy, setGrantBusy] = useState(false);
  const [grantConfirmOpen, setGrantConfirmOpen] = useState(false);
  const [tokenFeedback, setTokenFeedback] = useState<{ tone: "good" | "bad"; text: string } | null>(null);

  // Allowance form
  const [allowanceStr, setAllowanceStr] = useState("");
  const [allowanceBusy, setAllowanceBusy] = useState(false);

  const loadDrawerData = async (orgId: string) => {
    setLoading(true);
    setLoadError(null);
    const [dRes, tRes] = await Promise.allSettled([
      api.getAdminTenantDetail(orgId),
      api.getAdminOrgTokens(orgId, 40),
    ]);
    if (dRes.status === "fulfilled") {
      const d = dRes.value;
      setDetail(d);
      setTier(d.subscriptionTier);
      setBudgetStr(d.aiMonthlyBudgetUsd != null ? String(d.aiMonthlyBudgetUsd) : "");
      setWhiteLabel(d.whiteLabelEnabled);
    } else {
      setLoadError(errorMessage(dRes.reason));
    }
    if (tRes.status === "fulfilled") {
      setTokensData(tRes.value);
      setAllowanceStr(
        tRes.value.allowance.override != null ? String(tRes.value.allowance.override) : "",
      );
    } else {
      setTokensData(null);
    }
    setLoading(false);
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadDrawerData(tenant.id);
    }, 0);
    return () => clearTimeout(timer);
  }, [tenant.id]);

  const parsedGrant = Number(grantAmount.replace(/,/g, "").trim());
  const validGrant =
    grantAmount.trim() !== "" &&
    Number.isInteger(parsedGrant) &&
    parsedGrant !== 0 &&
    Math.abs(parsedGrant) <= MAX_ADJUSTMENT;

  async function saveBilling(e: React.FormEvent) {
    e.preventDefault();
    if (!tenant) return;
    setSavingBilling(true);
    setBillingFeedback(null);
    try {
      const trimmedBudget = budgetStr.trim();
      const parsedBudget = trimmedBudget === "" ? null : Number(trimmedBudget);
      if (parsedBudget !== null && (!Number.isFinite(parsedBudget) || parsedBudget < 0)) {
        setBillingFeedback({ tone: "bad", text: "Monthly AI budget must be a non-negative USD figure or blank." });
        setSavingBilling(false);
        return;
      }
      await api.updateAdminTenant(tenant.id, {
        subscriptionTier: tier,
        aiMonthlyBudgetUsd: parsedBudget,
        whiteLabelEnabled: whiteLabel,
      });
      setBillingFeedback({ tone: "good", text: "Organization entitlements saved and logged to audit trail." });
      await Promise.all([loadDrawerData(tenant.id), onMutated()]);
    } catch (err) {
      setBillingFeedback({ tone: "bad", text: errorMessage(err) });
    } finally {
      setSavingBilling(false);
    }
  }

  async function executeTokenAdjust() {
    if (!tenant || !validGrant) return;
    setGrantBusy(true);
    setTokenFeedback(null);
    try {
      await api.adjustTokens(tenant.id, parsedGrant, grantNote.trim() || undefined);
      setGrantAmount("");
      setGrantNote("");
      setGrantConfirmOpen(false);
      setTokenFeedback({
        tone: "good",
        text: `${parsedGrant > 0 ? "Added" : "Deducted"} ${formatTokensExact(Math.abs(parsedGrant))} bonus tokens.`,
      });
      await Promise.all([loadDrawerData(tenant.id), onMutated()]);
    } catch (err) {
      setTokenFeedback({ tone: "bad", text: errorMessage(err) });
    } finally {
      setGrantBusy(false);
    }
  }

  async function saveMonthlyAllowance(resetToDefault: boolean) {
    if (!tenant) return;
    setAllowanceBusy(true);
    setTokenFeedback(null);
    try {
      let nextVal: number | null = null;
      if (!resetToDefault) {
        const parsed = Number(allowanceStr.replace(/,/g, "").trim());
        if (!Number.isInteger(parsed) || parsed < 0 || parsed > MAX_ADJUSTMENT) {
          setTokenFeedback({ tone: "bad", text: "Enter a whole non-negative token allowance." });
          setAllowanceBusy(false);
          return;
        }
        nextVal = parsed;
      }
      await api.setAdminOrgTokenAllowance(tenant.id, nextVal);
      setTokenFeedback({
        tone: "good",
        text: resetToDefault
          ? "Monthly allowance reset to platform default."
          : `Monthly allowance override set to ${formatTokensExact(nextVal ?? 0)}.`,
      });
      await Promise.all([loadDrawerData(tenant.id), onMutated()]);
    } catch (err) {
      setTokenFeedback({ tone: "bad", text: errorMessage(err) });
    } finally {
      setAllowanceBusy(false);
    }
  }

  return (
    <>
      <SlideOverDialog
        open={Boolean(tenant)}
        title={tenant?.name ?? "Organization"}
        subtitle={
          detail
            ? `${detail.slug} · Created ${relativeTime(detail.createdAt)} · MTD AI ${formatUsd(detail.mtdAiSpendUsd)} (${detail.mtdAiCalls} calls)`
            : tenant?.owner ?? "Inspecting tenant workspace…"
        }
        headerAside={detail ? <TierBadge tier={detail.subscriptionTier} /> : null}
        onClose={onClose}
      >
        {loading && !detail ? (
          <div className="flex items-center justify-center gap-2.5 py-16 text-[13px] text-brand-500">
            <Loader2 size={16} className="animate-spin" />
            Loading tenant details…
          </div>
        ) : loadError ? (
          <StatusNote tone="bad">Could not load tenant details: {loadError}</StatusNote>
        ) : detail ? (
          <div className="space-y-5">
            <Tabs<DrawerTab>
              active={tab}
              onChange={setTab}
              tabs={[
                { id: "billing", label: "Plan & Limits", icon: SlidersHorizontal },
                { id: "tokens", label: "Tokens & Ledger", icon: Coins },
                { id: "projects", label: "Projects", tag: String(detail.projects.length), icon: Globe },
                { id: "members", label: "Members", tag: String(detail.members.length), icon: Users },
              ]}
            />

            {tab === "billing" && (
              <form onSubmit={saveBilling} className="space-y-4">
                {billingFeedback && (
                  <StatusNote tone={billingFeedback.tone}>{billingFeedback.text}</StatusNote>
                )}

                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-xl border border-brand-200 bg-surface-2 p-3">
                    <span className="block text-[10px] font-semibold uppercase tracking-wider text-brand-400">
                      MTD AI Spend
                    </span>
                    <span className="mt-1 block font-mono text-[16px] font-bold text-brand-950">
                      {formatUsd(detail.mtdAiSpendUsd)}
                    </span>
                  </div>
                  <div className="rounded-xl border border-brand-200 bg-surface-2 p-3">
                    <span className="block text-[10px] font-semibold uppercase tracking-wider text-brand-400">
                      MTD Tokens
                    </span>
                    <span className="mt-1 block font-mono text-[16px] font-bold text-brand-950">
                      {formatCompactNumber(detail.mtdAiTokens)}
                    </span>
                  </div>
                  <div className="rounded-xl border border-brand-200 bg-surface-2 p-3">
                    <span className="block text-[10px] font-semibold uppercase tracking-wider text-brand-400">
                      MTD AI Errors
                    </span>
                    <span
                      className={`mt-1 block font-mono text-[16px] font-bold ${detail.mtdAiErrors > 0 ? "text-error-600" : "text-brand-950"}`}
                    >
                      {detail.mtdAiErrors}
                    </span>
                  </div>
                </div>

                <div className="space-y-3 rounded-xl border border-brand-200 bg-surface-2/50 p-4">
                  <label className="block space-y-1.5">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-brand-500">
                      Subscription Tier (Server-Owned)
                    </span>
                    <select
                      value={tier}
                      onChange={(e) => setTier(e.target.value as AdminSubscriptionTier)}
                      className="h-9 w-full rounded-xl border border-brand-200 bg-surface-1 px-3 text-[13px] text-brand-950 focus:border-signal-400 focus:outline-none"
                    >
                      <option value="founder_free">Founder Free (1 site, 5k crawl pages)</option>
                      <option value="starter">Starter (1 site, 5k crawl pages)</option>
                      <option value="growth">Growth (5 sites, 25k crawl pages)</option>
                      <option value="agency">Agency (20 sites, 100k crawl pages)</option>
                    </select>
                  </label>

                  <label className="block space-y-1.5">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-brand-500">
                      Monthly AI Spend Ceiling (USD)
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={budgetStr}
                      onChange={(e) => setBudgetStr(e.target.value)}
                      placeholder="Leave blank for no cap"
                      className="h-9 w-full rounded-xl border border-brand-200 bg-surface-1 px-3 font-mono text-[13px] text-brand-950 placeholder:text-brand-400 focus:border-signal-400 focus:outline-none"
                    />
                    <span className="block text-[11px] text-brand-400">
                      Enforced server-side by AiUsageService against metered provider calls.
                    </span>
                  </label>

                  <label className="flex items-center justify-between gap-3 rounded-xl border border-brand-200 bg-surface-1 px-3.5 py-2.5 cursor-pointer">
                    <div>
                      <span className="block text-[12.5px] font-semibold text-brand-950">
                        White-Label Branding
                      </span>
                      <span className="block text-[11px] text-brand-500">
                        Allow custom agency branding on shared reports and portals.
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={whiteLabel}
                      onChange={(e) => setWhiteLabel(e.target.checked)}
                      className="h-4 w-4 rounded border-brand-300"
                    />
                  </label>

                  <div className="flex justify-end pt-1">
                    <ActionButton
                      type="submit"
                      variant="primary"
                      disabled={savingBilling}
                      icon={savingBilling ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                    >
                      {savingBilling ? "Saving…" : "Save Entitlements"}
                    </ActionButton>
                  </div>
                </div>

                {detail.recentAuditLogs.length > 0 && (
                  <div className="space-y-2">
                    <h2 className="text-[11px] font-semibold uppercase tracking-wider text-brand-400">
                      Recent Org Audit Events
                    </h2>
                    <div className="divide-y divide-brand-200/70 rounded-xl border border-brand-200 bg-surface-2/40">
                      {detail.recentAuditLogs.slice(0, 6).map((log) => (
                        <div key={log.id} className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-[12px]">
                          <div className="min-w-0">
                            <span className="font-mono text-[11px] font-semibold text-brand-950">
                              {log.action}
                            </span>
                            {log.actorEmail && (
                              <span className="ml-2 text-[11px] text-brand-400">by {log.actorEmail}</span>
                            )}
                          </div>
                          <span className="shrink-0 font-mono text-[11px] text-brand-400">
                            {relativeTime(log.createdAt)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </form>
            )}

            {tab === "tokens" && (
              <div className="space-y-4">
                {tokenFeedback && <StatusNote tone={tokenFeedback.tone}>{tokenFeedback.text}</StatusNote>}

                {tokensData && (
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-xl border border-brand-200 bg-surface-2 p-3">
                      <span className="block text-[10px] font-semibold uppercase tracking-wider text-brand-400">
                        Total Available
                      </span>
                      <span className="mt-1 block font-mono text-[16px] font-bold text-brand-950">
                        {formatTokens(tokensData.available)}
                      </span>
                    </div>
                    <div className="rounded-xl border border-brand-200 bg-surface-2 p-3">
                      <span className="block text-[10px] font-semibold uppercase tracking-wider text-brand-400">
                        Monthly Left
                      </span>
                      <span className="mt-1 block font-mono text-[16px] font-bold text-brand-950">
                        {formatTokens(tokensData.allowance.remaining)}
                      </span>
                      <span className="text-[10.5px] text-brand-400">
                        of {formatTokens(tokensData.allowance.monthly)}/mo
                      </span>
                    </div>
                    <div className="rounded-xl border border-brand-200 bg-surface-2 p-3">
                      <span className="block text-[10px] font-semibold uppercase tracking-wider text-brand-400">
                        Bonus Balance
                      </span>
                      <span className="mt-1 block font-mono text-[16px] font-bold text-success-600">
                        {formatTokens(tokensData.bonus)}
                      </span>
                      <span className="text-[10.5px] text-brand-400">Never expires</span>
                    </div>
                  </div>
                )}

                {/* Grant / deduct bonus tokens */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!validGrant || grantBusy) return;
                    if (parsedGrant < 0) setGrantConfirmOpen(true);
                    else void executeTokenAdjust();
                  }}
                  className="space-y-3 rounded-xl border border-brand-200 bg-surface-2/50 p-4"
                >
                  <div>
                    <h2 className="text-[13px] font-semibold text-brand-950">Adjust Bonus Tokens</h2>
                    <p className="text-[11.5px] text-brand-500">
                      Positive adds non-expiring bonus tokens; negative deducts from the wallet.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="block space-y-1">
                      <span className="text-[10.5px] font-semibold uppercase tracking-wider text-brand-400">
                        Token Delta
                      </span>
                      <input
                        inputMode="numeric"
                        value={grantAmount}
                        onChange={(e) => setGrantAmount(e.target.value)}
                        placeholder="e.g. 2000000 or -500000"
                        className="h-9 w-full rounded-xl border border-brand-200 bg-surface-1 px-3 font-mono text-[12.5px] text-brand-950 placeholder:text-brand-400 focus:border-signal-400 focus:outline-none"
                      />
                    </label>
                    <label className="block space-y-1">
                      <span className="text-[10.5px] font-semibold uppercase tracking-wider text-brand-400">
                        Operator Note (Internal)
                      </span>
                      <input
                        value={grantNote}
                        onChange={(e) => setGrantNote(e.target.value)}
                        maxLength={500}
                        placeholder="Reason for adjustment"
                        className="h-9 w-full rounded-xl border border-brand-200 bg-surface-1 px-3 text-[12.5px] text-brand-950 placeholder:text-brand-400 focus:border-signal-400 focus:outline-none"
                      />
                    </label>
                  </div>
                  <div className="flex justify-end">
                    <ActionButton type="submit" variant="primary" disabled={!validGrant || grantBusy}>
                      {grantBusy
                        ? "Applying…"
                        : validGrant
                          ? `${parsedGrant > 0 ? "Grant" : "Deduct"} ${formatTokensExact(Math.abs(parsedGrant))}`
                          : "Apply Adjustment"}
                    </ActionButton>
                  </div>
                </form>

                {/* Monthly allowance override */}
                <div className="space-y-3 rounded-xl border border-brand-200 bg-surface-2/50 p-4">
                  <div>
                    <h2 className="text-[13px] font-semibold text-brand-950">Monthly Allowance Override</h2>
                    <p className="text-[11.5px] text-brand-500">
                      {tokensData?.allowance.override != null
                        ? `Custom override active: ${formatTokensExact(tokensData.allowance.override)} / month.`
                        : "Currently inheriting platform default allowance."}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      inputMode="numeric"
                      value={allowanceStr}
                      onChange={(e) => setAllowanceStr(e.target.value)}
                      placeholder="Custom monthly tokens"
                      className="h-9 flex-1 min-w-[180px] rounded-xl border border-brand-200 bg-surface-1 px-3 font-mono text-[12.5px] text-brand-950 placeholder:text-brand-400 focus:border-signal-400 focus:outline-none"
                    />
                    <ActionButton
                      variant="secondary"
                      disabled={allowanceBusy || allowanceStr.trim() === ""}
                      onClick={() => void saveMonthlyAllowance(false)}
                    >
                      Set Override
                    </ActionButton>
                    {tokensData?.allowance.override != null && (
                      <ActionButton
                        variant="secondary"
                        disabled={allowanceBusy}
                        onClick={() => void saveMonthlyAllowance(true)}
                      >
                        Reset Default
                      </ActionButton>
                    )}
                  </div>
                </div>

                {/* Operator token ledger */}
                <div className="space-y-2">
                  <h2 className="text-[11px] font-semibold uppercase tracking-wider text-brand-400">
                    Token Ledger (Includes Operator Notes)
                  </h2>
                  {!tokensData || tokensData.items.length === 0 ? (
                    <p className="rounded-xl border border-brand-200 bg-surface-2/40 py-6 text-center text-[12px] text-brand-500">
                      No token transactions recorded yet.
                    </p>
                  ) : (
                    <div className="divide-y divide-brand-200/70 rounded-xl border border-brand-200 bg-surface-2/40 max-h-[260px] overflow-y-auto">
                      {tokensData.items.map((tx) => {
                        const note =
                          tx.detail && typeof tx.detail.note === "string" ? tx.detail.note : null;
                        return (
                          <div key={tx.id} className="flex items-start justify-between gap-3 px-3.5 py-2.5 text-[12px]">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <Pill tone={tx.delta >= 0 ? "good" : "default"}>{tx.kind}</Pill>
                                <span className="font-mono text-[11px] text-brand-700">{tx.action}</span>
                              </div>
                              {note && <p className="mt-1 text-[11px] text-brand-500">Note: {note}</p>}
                            </div>
                            <div className="shrink-0 text-right font-mono tabular-nums">
                              <span
                                className={`block text-[12px] font-semibold ${tx.delta >= 0 ? "text-success-600" : "text-brand-950"}`}
                              >
                                {tx.delta >= 0 ? "+" : ""}
                                {formatTokens(tx.delta)}
                              </span>
                              <span className="block text-[10px] text-brand-400">
                                {relativeTime(tx.createdAt)}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {tab === "projects" && (
              <div className="space-y-3">
                {detail.projects.length === 0 ? (
                  <p className="rounded-xl border border-brand-200 bg-surface-2/40 py-8 text-center text-[12.5px] text-brand-500">
                    This organization has not created any projects yet.
                  </p>
                ) : (
                  detail.projects.map((p) => (
                    <div key={p.id} className="rounded-xl border border-brand-200 bg-surface-2/50 p-4 space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[13px] font-semibold text-brand-950">{p.name}</span>
                        <span className="font-mono text-[11px] text-brand-400">
                          {p.websites.length} site{p.websites.length === 1 ? "" : "s"}
                        </span>
                      </div>
                      {p.websites.length === 0 ? (
                        <p className="text-[11.5px] text-brand-400">No websites attached.</p>
                      ) : (
                        <div className="divide-y divide-brand-200/70 rounded-lg border border-brand-200 bg-surface-1">
                          {p.websites.map((w) => (
                            <div key={w.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-[12px]">
                              <div className="flex items-center gap-2 min-w-0">
                                <Globe size={13} className="shrink-0 text-brand-400" />
                                <span className="truncate font-mono font-medium text-brand-950">{w.domain}</span>
                                <Pill tone={w.isVerified ? "good" : "default"}>
                                  {w.isVerified ? "Verified" : "Unverified"}
                                </Pill>
                              </div>
                              <div className="flex items-center gap-2 font-mono text-[11px] text-brand-500">
                                {w.latestCrawl ? (
                                  <>
                                    <Pill
                                      tone={
                                        w.latestCrawl.status === "COMPLETED"
                                          ? "good"
                                          : w.latestCrawl.status === "FAILED"
                                            ? "bad"
                                            : "info"
                                      }
                                    >
                                      {w.latestCrawl.status}
                                    </Pill>
                                    <span>{w.latestCrawl.pagesCrawled}p</span>
                                    {w.latestCrawl.healthScore != null && (
                                      <strong className="text-brand-950">{w.latestCrawl.healthScore}/100</strong>
                                    )}
                                  </>
                                ) : (
                                  <span>No crawl yet</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {tab === "members" && (
              <div className="divide-y divide-brand-200/70 rounded-xl border border-brand-200 bg-surface-2/40">
                {detail.members.length === 0 ? (
                  <p className="py-8 text-center text-[12.5px] text-brand-500">No members in this workspace.</p>
                ) : (
                  detail.members.map((m) => (
                    <div key={m.id} className="flex items-center justify-between gap-3 px-4 py-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-[13px] font-semibold text-brand-950">{m.name}</span>
                          <Pill tone={m.role === "OWNER" ? "good" : "default"}>{m.role}</Pill>
                          {m.isPlatformAdmin && <Pill tone="info">Operator</Pill>}
                        </div>
                        <span className="block truncate font-mono text-[11px] text-brand-400">{m.email}</span>
                      </div>
                      <div className="shrink-0 text-right">
                        <Pill tone={m.isLoggedIn ? "good" : "default"} dot={m.isLoggedIn}>
                          {m.isLoggedIn ? `Online (${m.activeSessionsCount})` : "Offline"}
                        </Pill>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        ) : null}
      </SlideOverDialog>

      <ConfirmModal
        open={grantConfirmOpen}
        title="Deduct Bonus Tokens?"
        description={`You are about to remove ${formatTokensExact(Math.abs(parsedGrant || 0))} tokens from ${tenant?.name ?? "this organization"}. This action is recorded in the append-only billing ledger.`}
        confirmLabel="Deduct Tokens"
        tone="warn"
        busy={grantBusy}
        onConfirm={executeTokenAdjust}
        onClose={() => setGrantConfirmOpen(false)}
      />
    </>
  );
}
