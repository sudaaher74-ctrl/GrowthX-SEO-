"use client";

import React, { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertCircle,
  Building2,
  Cpu,
  Loader2,
  Play,
  Power,
  RotateCcw,
  Trash2,
  Zap,
} from "lucide-react";
import { MeterBar, Pill, StatusNote, Td, Th, Tr, relativeTime } from "@/components/ui/console";
import { AiConfigurationTab } from "@/components/settings/ai-configuration-tab";
import { api } from "@/lib/api-client";
import type {
  AdminAiAnalytics,
  AdminAiProbeResult,
  AdminAiRouterConfig,
  AdminUserModelUsage,
  ApiCostStat,
} from "@/lib/api-types";
import { errorMessage } from "@/lib/error-message";
import {
  AdminSearchInput,
  AdminSkeletonCard,
  AdminTableWrap,
  AdminThead,
  FilterChipGroup,
  NocButton,
  NocPanel,
  formatCompactNumber,
  formatUsd,
} from "./admin-primitives";

interface AiFinopsSectionProps {
  routerConfig: AdminAiRouterConfig | null;
  apiCosts: ApiCostStat[];
  analytics: AdminAiAnalytics | null;
  userModels: AdminUserModelUsage[];
  windowDays: number;
  onChangeWindowDays: (days: number) => void;
  onRouterConfigChanged: (next: AdminAiRouterConfig) => void;
  onRefresh: () => Promise<void> | void;
  loading: boolean;
}

type AiSubTab = "router" | "probe" | "finops" | "mammouth";
type ChartMetric = "costUsd" | "calls" | "tokens";

export function AiFinopsSection({
  routerConfig,
  apiCosts,
  analytics,
  userModels,
  windowDays,
  onChangeWindowDays,
  onRouterConfigChanged,
  onRefresh,
  loading,
}: AiFinopsSectionProps) {
  const [subTab, setSubTab] = useState<AiSubTab>("router");
  const [chartMetric, setChartMetric] = useState<ChartMetric>("costUsd");
  const [orgSearch, setOrgSearch] = useState("");
  const [modelSearch, setModelSearch] = useState("");
  const [modelDrafts, setModelDrafts] = useState<Record<string, string>>({});
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ tone: "good" | "bad" | "warn"; text: string } | null>(null);

  // Live probe state
  const [probeTask, setProbeTask] = useState("FAST");
  const [probeProvider, setProbeProvider] = useState("");
  const [probeModel, setProbeModel] = useState("");
  const [probeSystem, setProbeSystem] = useState("Reply concisely in one short technical sentence.");
  const [probePrompt, setProbePrompt] = useState("Ping check: report your model identity and confirm JSON readiness.");
  const [probeBusy, setProbeBusy] = useState(false);
  const [probeResult, setProbeResult] = useState<AdminAiProbeResult | null>(null);

  const filteredOrgs = useMemo(() => {
    const q = orgSearch.trim().toLowerCase();
    const list = analytics?.byOrganization ?? [];
    if (!q) return list;
    return list.filter((o) => o.organizationName.toLowerCase().includes(q));
  }, [analytics, orgSearch]);

  const filteredUserModels = useMemo(() => {
    const q = modelSearch.trim().toLowerCase();
    if (!q) return userModels;
    return userModels.filter(
      (m) =>
        m.userName.toLowerCase().includes(q) ||
        m.userEmail.toLowerCase().includes(q) ||
        m.organizationName.toLowerCase().includes(q) ||
        m.model.toLowerCase().includes(q) ||
        m.provider.toLowerCase().includes(q),
    );
  }, [userModels, modelSearch]);

  const trendData = analytics?.dailyTrend ?? [];
  const totalWindowSpend = trendData.reduce((s, d) => s + d.costUsd, 0);
  const totalWindowCalls = trendData.reduce((s, d) => s + d.calls, 0);
  const totalWindowErrors = trendData.reduce((s, d) => s + d.errors, 0);

  async function toggleProvider(provider: string, nextEnabled: boolean) {
    setBusyKey(`toggle-${provider}`);
    setFeedback(null);
    try {
      const updated = await api.updateAdminAiRouterConfig({ provider, enabled: nextEnabled });
      onRouterConfigChanged(updated);
      setFeedback({
        tone: nextEnabled ? "good" : "warn",
        text: nextEnabled
          ? `Provider ${provider} re-enabled in live router.`
          : `Circuit breaker tripped: ${provider} disabled at runtime.`,
      });
    } catch (err) {
      setFeedback({ tone: "bad", text: errorMessage(err) });
    } finally {
      setBusyKey(null);
    }
  }

  async function applyModelOverride(provider: string, modelOverride: string | null) {
    setBusyKey(`model-${provider}`);
    setFeedback(null);
    try {
      const updated = await api.updateAdminAiRouterConfig({ provider, modelOverride });
      onRouterConfigChanged(updated);
      setFeedback({
        tone: "good",
        text: modelOverride
          ? `Runtime model override for ${provider} -> ${modelOverride}.`
          : `Cleared runtime model override for ${provider} (reverted to env default).`,
      });
    } catch (err) {
      setFeedback({ tone: "bad", text: errorMessage(err) });
    } finally {
      setBusyKey(null);
    }
  }

  async function toggleFallback(next: boolean) {
    setBusyKey("fallback");
    setFeedback(null);
    try {
      const updated = await api.updateAdminAiRouterConfig({ serverSideFallbackEnabled: next });
      onRouterConfigChanged(updated);
      setFeedback({ tone: "good", text: `Anthropic server-side fallback set to ${next ? "ON" : "OFF"}.` });
    } catch (err) {
      setFeedback({ tone: "bad", text: errorMessage(err) });
    } finally {
      setBusyKey(null);
    }
  }

  async function flushCaches() {
    setBusyKey("cache");
    setFeedback(null);
    try {
      const res = await api.clearAdminAiRouterCaches();
      setFeedback({
        tone: "good",
        text: `Flushed ${res.clearedResponses} cached responses and ${res.clearedOrgTiers} org tier entries.`,
      });
      await onRefresh();
    } catch (err) {
      setFeedback({ tone: "bad", text: errorMessage(err) });
    } finally {
      setBusyKey(null);
    }
  }

  async function runProbe(e: React.FormEvent) {
    e.preventDefault();
    if (!probePrompt.trim() || probeBusy) return;
    setProbeBusy(true);
    setProbeResult(null);
    try {
      const res = await api.probeAdminAiRouter({
        prompt: probePrompt,
        systemInstruction: probeSystem || undefined,
        task: probeTask,
        provider: probeProvider || undefined,
        model: probeModel.trim() || undefined,
        maxTokens: 300,
        allowFallback: !probeProvider,
      });
      setProbeResult(res);
    } catch (err) {
      setProbeResult({
        ok: false,
        provider: probeProvider || null,
        model: probeModel || null,
        latencyMs: 0,
        refused: false,
        text: "",
        usage: null,
        error: errorMessage(err),
      });
    } finally {
      setProbeBusy(false);
    }
  }

  const activeProviders = (routerConfig?.providers ?? []).filter((p) => p.active);

  return (
    <div className="space-y-4">
      {feedback && <StatusNote tone={feedback.tone}>{feedback.text}</StatusNote>}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <FilterChipGroup<AiSubTab>
          value={subTab}
          onChange={setSubTab}
          options={[
            { id: "router", label: "ROUTER_CONTROL", count: activeProviders.length, dot: activeProviders.length > 0 ? "good" : "bad" },
            { id: "probe", label: "LIVE_MODEL_PROBE" },
            { id: "finops", label: "FINOPS_TELEMETRY" },
            { id: "mammouth", label: "MAMMOUTH_GATEWAY" },
          ]}
        />
        {routerConfig && (
          <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] text-brand-400">
            <span>
              CACHE: <strong className="text-brand-950">{routerConfig.caches.responseCacheEntries}</strong>/
              {routerConfig.caches.responseCacheMaxEntries}
            </span>
            <NocButton
              disabled={busyKey !== null}
              icon={<Trash2 size={11} />}
              onClick={() => void flushCaches()}
            >
              FLUSH_CACHES
            </NocButton>
          </div>
        )}
      </div>

      {/* 1. LIVE ROUTER CIRCUIT BREAKERS + MODEL OVERRIDES + TASK MATRIX */}
      {subTab === "router" && (
        <div className="space-y-4">
          <NocPanel
            code="AI_CTRL"
            title="PROVIDER_CIRCUIT_BREAKERS_AND_MODEL_OVERRIDES"
            subtitle="Zero-restart runtime overrides for MultiAiRouterService. Changes apply immediately to live requests until process restart."
            actions={
              routerConfig ? (
                <NocButton
                  disabled={busyKey !== null}
                  onClick={() => void toggleFallback(!routerConfig.serverSideFallbackEnabled)}
                >
                  ANTHROPIC_FALLBACK: {routerConfig.serverSideFallbackEnabled ? "ON" : "OFF"}
                </NocButton>
              ) : null
            }
          >
            {!routerConfig || !routerConfig.available ? (
              <p className="p-6 text-center font-mono text-[12px] text-brand-400">
                MULTI_AI_ROUTER_DIAGNOSTICS_UNAVAILABLE
              </p>
            ) : (
              <AdminTableWrap label="AI provider runtime controls" minWidth={920}>
                <AdminThead>
                  <tr>
                    <Th>Provider</Th>
                    <Th>Key / Allowlist</Th>
                    <Th>Live State</Th>
                    <Th>Default Model</Th>
                    <Th>Runtime Model Override</Th>
                    <Th align="right">Circuit Breaker</Th>
                  </tr>
                </AdminThead>
                <tbody>
                  {routerConfig.providers.map((p) => {
                    const draft = modelDrafts[p.provider] ?? p.overrideModel ?? "";
                    return (
                      <Tr key={p.provider}>
                        <Td>
                          <span className="flex items-center gap-2 font-mono text-[12px] font-bold text-brand-950">
                            <Zap size={12} className={p.active ? "text-signal-400" : "text-brand-400"} />
                            {p.provider}
                          </span>
                        </Td>
                        <Td>
                          <div className="flex items-center gap-1.5">
                            <Pill tone={p.keyConfigured ? "good" : "default"}>
                              {p.keyConfigured ? "KEY_OK" : "NO_KEY"}
                            </Pill>
                            {!p.allowlisted && <Pill tone="warn">BLOCKED_BY_ENV</Pill>}
                          </div>
                        </Td>
                        <Td>
                          <Pill
                            tone={p.active ? "good" : p.runtimeDisabled ? "bad" : "default"}
                            dot={p.active}
                          >
                            {p.active ? "ACTIVE" : p.runtimeDisabled ? "CIRCUIT_OPEN" : "INACTIVE"}
                          </Pill>
                        </Td>
                        <Td>
                          <span className="font-mono text-[11.5px] text-brand-500">{p.defaultModel}</span>
                        </Td>
                        <Td>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              value={draft}
                              onChange={(e) =>
                                setModelDrafts((prev) => ({ ...prev, [p.provider]: e.target.value }))
                              }
                              placeholder={p.defaultModel}
                              disabled={!p.keyConfigured}
                              className="h-7 w-48 rounded-xs border border-brand-200 bg-surface-2 px-2 font-mono text-[11px] text-brand-950 placeholder:text-brand-400 focus:border-signal-400 focus:outline-none disabled:opacity-40"
                            />
                            <NocButton
                              disabled={busyKey !== null || !p.keyConfigured || !draft.trim()}
                              onClick={() => void applyModelOverride(p.provider, draft.trim())}
                              className="h-7 px-2"
                            >
                              SET
                            </NocButton>
                            {p.overrideModel && (
                              <NocButton
                                disabled={busyKey !== null}
                                icon={<RotateCcw size={10} />}
                                onClick={() => {
                                  setModelDrafts((prev) => ({ ...prev, [p.provider]: "" }));
                                  void applyModelOverride(p.provider, null);
                                }}
                                className="h-7 px-2"
                              >
                                RST
                              </NocButton>
                            )}
                          </div>
                        </Td>
                        <Td align="right">
                          <NocButton
                            variant={p.runtimeDisabled ? "primary" : "danger"}
                            disabled={busyKey !== null || !p.keyConfigured}
                            icon={<Power size={11} />}
                            onClick={() => void toggleProvider(p.provider, p.runtimeDisabled)}
                            className="ml-auto"
                          >
                            {p.runtimeDisabled ? "RESTORE" : "DISABLE"}
                          </NocButton>
                        </Td>
                      </Tr>
                    );
                  })}
                </tbody>
              </AdminTableWrap>
            )}
          </NocPanel>

          {/* 17-Task Live Routing Chain Table */}
          {routerConfig && routerConfig.taskMatrix.length > 0 && (
            <NocPanel
              code="ROUTE"
              title="TASK_FALLBACK_ROUTING_MATRIX"
              subtitle={`Effective provider failover chain for every AiTask. Fast-routed tiers: ${routerConfig.fastRouteTiers.join(", ") || "none"}.`}
            >
              <AdminTableWrap label="AI task routing matrix" minWidth={720} maxHeightClass="max-h-[420px]">
                <AdminThead>
                  <tr>
                    <Th>AiTask</Th>
                    <Th>Profile</Th>
                    <Th>Live Ordered Provider Chain</Th>
                  </tr>
                </AdminThead>
                <tbody>
                  {routerConfig.taskMatrix.map((row) => (
                    <Tr key={row.task}>
                      <Td>
                        <span className="font-mono text-[11.5px] font-bold text-brand-950">{row.task}</span>
                      </Td>
                      <Td>
                        <Pill tone={row.profile === "REASONING" ? "info" : row.profile === "CODE_GEN" ? "warn" : "good"}>
                          {row.profile}
                        </Pill>
                      </Td>
                      <Td>
                        {row.chain.length > 0 ? (
                          <div className="flex flex-wrap items-center gap-1.5 font-mono text-[11px]">
                            {row.chain.map((prov, idx) => (
                              <React.Fragment key={prov}>
                                {idx > 0 && <span className="text-brand-400">→</span>}
                                <span
                                  className={
                                    idx === 0
                                      ? "rounded-xs border border-signal-400/50 bg-signal-400/15 px-1.5 py-0.5 font-bold text-signal-400"
                                      : "rounded-xs border border-brand-200 bg-surface-2 px-1.5 py-0.5 text-brand-600"
                                  }
                                >
                                  {prov}
                                </span>
                              </React.Fragment>
                            ))}
                          </div>
                        ) : (
                          <Pill tone="bad">NO_PROVIDER_REACHABLE</Pill>
                        )}
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </AdminTableWrap>
            </NocPanel>
          )}
        </div>
      )}

      {/* 2. LIVE MODEL PROBE / DIAGNOSTIC SANDBOX */}
      {subTab === "probe" && (
        <NocPanel
          code="PROBE"
          title="LIVE_AI_ROUTER_DIAGNOSTIC_PROBE"
          subtitle="Execute a live completion directly through MultiAiRouterService to verify provider routing, latency, tokens, and model overrides."
          padded
        >
          <form onSubmit={runProbe} className="space-y-3.5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <label className="block space-y-1">
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-brand-400">
                  AI_TASK
                </span>
                <select
                  value={probeTask}
                  onChange={(e) => setProbeTask(e.target.value)}
                  className="h-9 w-full rounded-sm border border-brand-200 bg-surface-2 px-2.5 font-mono text-[11.5px] text-brand-950 focus:border-signal-400 focus:outline-none"
                >
                  {(routerConfig?.taskMatrix ?? [{ task: "FAST" }, { task: "REASONING" }, { task: "CODE_GEN" }]).map((t) => (
                    <option key={t.task} value={t.task}>
                      {t.task}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-1">
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-brand-400">
                  PIN_PROVIDER (optional)
                </span>
                <select
                  value={probeProvider}
                  onChange={(e) => setProbeProvider(e.target.value)}
                  className="h-9 w-full rounded-sm border border-brand-200 bg-surface-2 px-2.5 font-mono text-[11.5px] text-brand-950 focus:border-signal-400 focus:outline-none"
                >
                  <option value="">AUTO_CHAIN (use router failover)</option>
                  {activeProviders.map((p) => (
                    <option key={p.provider} value={p.provider}>
                      {p.provider} ({p.effectiveModel})
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-1">
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-brand-400">
                  MODEL_OVERRIDE (optional)
                </span>
                <input
                  type="text"
                  value={probeModel}
                  onChange={(e) => setProbeModel(e.target.value)}
                  placeholder="Leave blank for active default"
                  className="h-9 w-full rounded-sm border border-brand-200 bg-surface-2 px-2.5 font-mono text-[11.5px] text-brand-950 placeholder:text-brand-400 focus:border-signal-400 focus:outline-none"
                />
              </label>
            </div>

            <label className="block space-y-1">
              <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-brand-400">
                SYSTEM_INSTRUCTION
              </span>
              <input
                type="text"
                value={probeSystem}
                onChange={(e) => setProbeSystem(e.target.value)}
                className="h-9 w-full rounded-sm border border-brand-200 bg-surface-2 px-2.5 font-mono text-[11.5px] text-brand-950 focus:border-signal-400 focus:outline-none"
              />
            </label>

            <label className="block space-y-1">
              <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-brand-400">
                PROMPT_PAYLOAD
              </span>
              <textarea
                rows={3}
                value={probePrompt}
                onChange={(e) => setProbePrompt(e.target.value)}
                className="w-full rounded-sm border border-brand-200 bg-surface-2 p-2.5 font-mono text-[12px] text-brand-950 focus:border-signal-400 focus:outline-none"
              />
            </label>

            <div className="flex justify-end">
              <NocButton
                type="submit"
                variant="primary"
                disabled={probeBusy || !probePrompt.trim()}
                icon={probeBusy ? <Loader2 size={11} className="animate-spin" /> : <Play size={11} />}
              >
                {probeBusy ? "EXECUTING_PROBE…" : "EXECUTE_LIVE_PROBE"}
              </NocButton>
            </div>
          </form>

          {probeResult && (
            <div className="mt-4 space-y-2.5 rounded-sm border border-brand-200 bg-surface-2/70 p-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-[11px]">
                <div className="flex items-center gap-2">
                  <Pill tone={probeResult.ok ? "good" : "bad"}>{probeResult.ok ? "OK" : "ERROR"}</Pill>
                  {probeResult.provider && <strong className="text-signal-400">{probeResult.provider}</strong>}
                  {probeResult.model && <span className="text-brand-600">/ {probeResult.model}</span>}
                </div>
                <div className="flex items-center gap-3 text-brand-400 tabular-nums">
                  <span>LAT: <strong className="text-brand-950">{probeResult.latencyMs}ms</strong></span>
                  {probeResult.usage && (
                    <>
                      <span>IN: <strong className="text-brand-950">{probeResult.usage.inputTokens}</strong></span>
                      <span>OUT: <strong className="text-brand-950">{probeResult.usage.outputTokens}</strong></span>
                      <span>COST: <strong className="text-success-700">{formatUsd(probeResult.usage.estimatedCostUsd, 5)}</strong></span>
                    </>
                  )}
                </div>
              </div>
              {probeResult.error ? (
                <pre className="overflow-x-auto rounded-xs border border-error-200 bg-error-50 p-3 font-mono text-[11.5px] text-error-700 whitespace-pre-wrap">
                  {probeResult.error}
                </pre>
              ) : (
                <pre className="overflow-x-auto rounded-xs border border-brand-200 bg-surface-1 p-3 font-mono text-[11.5px] text-brand-900 whitespace-pre-wrap">
                  {probeResult.text || "(empty response)"}
                </pre>
              )}
            </div>
          )}
        </NocPanel>
      )}

      {/* 3. FINOPS TELEMETRY & ERRORS */}
      {subTab === "finops" && (
        <div className="space-y-4">
          <NocPanel
            code="VEL"
            title="AI_SPEND_AND_REQUEST_VELOCITY"
            subtitle={`Window ${windowDays}d · ${formatUsd(totalWindowSpend)} spend · ${totalWindowCalls.toLocaleString()} calls · ${totalWindowErrors} errors`}
            padded
            actions={
              <>
                <FilterChipGroup<ChartMetric>
                  value={chartMetric}
                  onChange={setChartMetric}
                  options={[
                    { id: "costUsd", label: "USD" },
                    { id: "calls", label: "CALLS" },
                    { id: "tokens", label: "TOKENS" },
                  ]}
                />
                <FilterChipGroup<string>
                  value={String(windowDays)}
                  onChange={(v) => onChangeWindowDays(Number(v))}
                  options={[
                    { id: "7", label: "7D" },
                    { id: "14", label: "14D" },
                    { id: "30", label: "30D" },
                  ]}
                />
              </>
            }
          >
            {loading && !analytics ? (
              <AdminSkeletonCard className="h-56 border-0 bg-surface-2/40" />
            ) : trendData.length === 0 || totalWindowCalls === 0 ? (
              <div className="py-12 text-center font-mono text-[12px] text-brand-400">
                0_AI_CALLS_IN_LAST_{windowDays}D
              </div>
            ) : (
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="nocAiFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--color-signal-400)" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="var(--color-signal-400)" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line)" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(v: string) => v.slice(5)}
                      tick={{ fontSize: 11, fill: "var(--color-brand-400)" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tickFormatter={(v: number) =>
                        chartMetric === "costUsd" ? `$${v.toFixed(2)}` : formatCompactNumber(v)
                      }
                      tick={{ fontSize: 11, fill: "var(--color-brand-400)" }}
                      axisLine={false}
                      tickLine={false}
                      width={56}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "var(--color-surface-1)",
                        borderColor: "var(--color-line)",
                        borderRadius: "4px",
                        fontSize: "11.5px",
                        fontFamily: "var(--font-mono)",
                        color: "var(--color-brand-950)",
                      }}
                      formatter={(value: unknown) => {
                        const num = typeof value === "number" ? value : Number(value ?? 0);
                        if (chartMetric === "costUsd") return [formatUsd(num, 4), "EST_USD"];
                        if (chartMetric === "tokens") return [num.toLocaleString(), "TOKENS"];
                        return [num.toLocaleString(), "CALLS"];
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey={chartMetric}
                      stroke="var(--color-signal-400)"
                      strokeWidth={2}
                      fill="url(#nocAiFill)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </NocPanel>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <NocPanel code="MDL" title="PROVIDER_MODEL_LEDGER" subtitle="All-time calls, tokens, latency, and spend.">
              <AdminTableWrap label="Provider model ledger" minWidth={520} maxHeightClass="max-h-[360px]">
                <AdminThead>
                  <tr>
                    <Th>Provider / Model</Th>
                    <Th align="right">Calls</Th>
                    <Th align="right">Tokens</Th>
                    <Th align="right">Avg Lat</Th>
                    <Th align="right">Spend</Th>
                  </tr>
                </AdminThead>
                <tbody>
                  {apiCosts.length > 0 ? (
                    apiCosts.map((c) => (
                      <Tr key={c.service}>
                        <Td>
                          <span className="font-mono text-[11.5px] font-bold text-brand-950">{c.service}</span>
                        </Td>
                        <Td align="right">
                          <span className="font-mono text-[11.5px] text-brand-600 tabular-nums">
                            {(c.calls ?? 0).toLocaleString()}
                          </span>
                          {(c.errors ?? 0) > 0 && (
                            <span className="ml-1 font-mono text-[10px] text-error-700">({c.errors}e)</span>
                          )}
                        </Td>
                        <Td align="right">
                          <span className="font-mono text-[11.5px] text-brand-400 tabular-nums">{c.tokens}</span>
                        </Td>
                        <Td align="right">
                          <span className="font-mono text-[11.5px] text-brand-400 tabular-nums">
                            {c.avgLatencyMs != null ? `${c.avgLatencyMs}ms` : "—"}
                          </span>
                        </Td>
                        <Td align="right">
                          <span className="font-mono text-[12px] font-bold text-success-700 tabular-nums">
                            {formatUsd(c.cost, 4)}
                          </span>
                        </Td>
                      </Tr>
                    ))
                  ) : (
                    <Tr>
                      <Td colSpan={5} className="py-8 text-center font-mono text-[11.5px] text-brand-400">
                        NO_USAGE_LOGGED
                      </Td>
                    </Tr>
                  )}
                </tbody>
              </AdminTableWrap>
            </NocPanel>

            <NocPanel code="TSK" title="SEMANTIC_TASK_LATENCY" subtitle={`Last ${windowDays}d latency & error rate by task.`}>
              <AdminTableWrap label="AI task latency" minWidth={520} maxHeightClass="max-h-[360px]">
                <AdminThead>
                  <tr>
                    <Th>Task</Th>
                    <Th align="right">Calls</Th>
                    <Th align="right">Err %</Th>
                    <Th align="right">Avg Lat</Th>
                    <Th align="right">Spend</Th>
                  </tr>
                </AdminThead>
                <tbody>
                  {analytics && analytics.byTask.length > 0 ? (
                    analytics.byTask.map((t) => (
                      <Tr key={t.taskType}>
                        <Td>
                          <span className="flex items-center gap-1.5 font-mono text-[11px] font-bold text-brand-950">
                            <Cpu size={11} className="text-signal-400" />
                            {t.taskType}
                          </span>
                        </Td>
                        <Td align="right">
                          <span className="font-mono text-[11.5px] text-brand-600 tabular-nums">{t.calls}</span>
                        </Td>
                        <Td align="right">
                          <Pill tone={t.errorRatePct >= 15 ? "bad" : t.errorRatePct > 0 ? "warn" : "good"}>
                            {t.errorRatePct}%
                          </Pill>
                        </Td>
                        <Td align="right">
                          <span className="font-mono text-[11.5px] text-brand-400 tabular-nums">{t.avgLatencyMs}ms</span>
                        </Td>
                        <Td align="right">
                          <span className="font-mono text-[12px] font-bold text-brand-950 tabular-nums">
                            {formatUsd(t.costUsd, 4)}
                          </span>
                        </Td>
                      </Tr>
                    ))
                  ) : (
                    <Tr>
                      <Td colSpan={5} className="py-8 text-center font-mono text-[11.5px] text-brand-400">
                        NO_TASK_RECORDS
                      </Td>
                    </Tr>
                  )}
                </tbody>
              </AdminTableWrap>
            </NocPanel>
          </div>

          {/* Organization Attribution */}
          <NocPanel
            code="ORG"
            title="ORG_AI_BUDGET_ATTRIBUTION"
            subtitle={`True per-organization spend (${windowDays}d window) without multi-user double counting.`}
            actions={<AdminSearchInput value={orgSearch} onChange={setOrgSearch} placeholder="Filter org…" />}
          >
            <AdminTableWrap label="Organization AI spend" minWidth={720} maxHeightClass="max-h-[340px]">
              <AdminThead>
                <tr>
                  <Th>Organization</Th>
                  <Th align="right">Calls</Th>
                  <Th align="right">Errors</Th>
                  <Th align="right">Tokens</Th>
                  <Th align="right">Window Spend</Th>
                  <Th>Monthly Cap</Th>
                  <Th align="right">Last Active</Th>
                </tr>
              </AdminThead>
              <tbody>
                {filteredOrgs.length > 0 ? (
                  filteredOrgs.map((o) => {
                    const pct =
                      o.budgetUsd && o.budgetUsd > 0 ? Math.min(100, Math.round((o.costUsd / o.budgetUsd) * 100)) : null;
                    return (
                      <Tr key={o.organizationId}>
                        <Td>
                          <span className="flex items-center gap-1.5 font-mono text-[12px] font-bold text-brand-950">
                            <Building2 size={12} className="text-brand-400" />
                            {o.organizationName}
                          </span>
                        </Td>
                        <Td align="right">
                          <span className="font-mono text-[11.5px] text-brand-600 tabular-nums">{o.calls}</span>
                        </Td>
                        <Td align="right">
                          <span className={`font-mono text-[11.5px] tabular-nums ${o.errors > 0 ? "font-bold text-error-700" : "text-brand-400"}`}>
                            {o.errors}
                          </span>
                        </Td>
                        <Td align="right">
                          <span className="font-mono text-[11.5px] text-brand-500 tabular-nums">
                            {formatCompactNumber(o.tokens)}
                          </span>
                        </Td>
                        <Td align="right">
                          <span className="font-mono text-[12px] font-bold text-success-700 tabular-nums">
                            {formatUsd(o.costUsd, 4)}
                          </span>
                        </Td>
                        <Td>
                          {o.budgetUsd != null ? (
                            <div className="space-y-1 min-w-[110px]">
                              <span className="font-mono text-[10.5px] text-brand-500">
                                {formatUsd(o.budgetUsd)} ({pct ?? 0}%)
                              </span>
                              {pct !== null && <MeterBar value={pct} tone={pct < 80 ? "good" : "accent"} width={100} />}
                            </div>
                          ) : (
                            <span className="font-mono text-[11px] text-brand-400">UNCAPPED</span>
                          )}
                        </Td>
                        <Td align="right">
                          <span className="font-mono text-[11px] text-brand-400">{relativeTime(o.lastUsedAt)}</span>
                        </Td>
                      </Tr>
                    );
                  })
                ) : (
                  <Tr>
                    <Td colSpan={7} className="py-8 text-center font-mono text-[11.5px] text-brand-400">
                      NO_ORG_SPEND_RECORDED
                    </Td>
                  </Tr>
                )}
              </tbody>
            </AdminTableWrap>
          </NocPanel>

          {/* Recent AI Errors */}
          {analytics && analytics.recentErrors.length > 0 && (
            <NocPanel
              code="ERR"
              title="RECENT_AI_PROVIDER_ERRORS"
              actions={<Pill tone="bad">{analytics.recentErrors.length} ERRORS</Pill>}
            >
              <AdminTableWrap label="Recent AI errors" minWidth={820} maxHeightClass="max-h-[300px]">
                <AdminThead>
                  <tr>
                    <Th>When</Th>
                    <Th>Workspace</Th>
                    <Th>Provider / Model</Th>
                    <Th>Task</Th>
                    <Th>Status</Th>
                    <Th>Error Message</Th>
                  </tr>
                </AdminThead>
                <tbody>
                  {analytics.recentErrors.map((err) => (
                    <Tr key={err.id}>
                      <Td><span className="font-mono text-[11px] text-brand-400">{relativeTime(err.createdAt)}</span></Td>
                      <Td><span className="font-mono text-[11.5px] text-brand-900">{err.organizationName}</span></Td>
                      <Td><span className="font-mono text-[11px] text-brand-700">{err.provider}/{err.model}</span></Td>
                      <Td><span className="font-mono text-[10.5px] text-brand-400">{err.taskType}</span></Td>
                      <Td><Pill tone="bad"><AlertCircle size={10} /> {err.status}</Pill></Td>
                      <Td>
                        <span className="block max-w-[300px] truncate font-mono text-[11px] text-error-700" title={err.error ?? undefined}>
                          {err.error ?? "No message"}
                        </span>
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </AdminTableWrap>
            </NocPanel>
          )}

          {/* Model Attribution */}
          <NocPanel
            code="USR"
            title="MODEL_CALLER_LEDGER"
            actions={<AdminSearchInput value={modelSearch} onChange={setModelSearch} placeholder="Search caller/model…" />}
          >
            <AdminTableWrap label="Model caller ledger" minWidth={740} maxHeightClass="max-h-[340px]">
              <AdminThead>
                <tr>
                  <Th>Caller / Workspace</Th>
                  <Th>Org</Th>
                  <Th>Model</Th>
                  <Th align="right">Calls</Th>
                  <Th align="right">Tokens</Th>
                  <Th align="right">Spend</Th>
                  <Th align="right">Last Seen</Th>
                </tr>
              </AdminThead>
              <tbody>
                {filteredUserModels.length > 0 ? (
                  filteredUserModels.map((row) => (
                    <Tr key={`${row.userId}:${row.provider}:${row.model}`}>
                      <Td>
                        <span className="block font-mono text-[11.5px] font-bold text-brand-950">{row.userName}</span>
                        <span className="block font-mono text-[10px] text-brand-400">{row.userEmail}</span>
                      </Td>
                      <Td><span className="text-[12px] text-brand-600">{row.organizationName}</span></Td>
                      <Td><span className="font-mono text-[11px] text-signal-400">{row.provider}/{row.model}</span></Td>
                      <Td align="right"><span className="font-mono text-[11.5px] text-brand-950 tabular-nums">{row.calls}</span></Td>
                      <Td align="right"><span className="font-mono text-[11.5px] text-brand-500 tabular-nums">{row.totalTokens.toLocaleString()}</span></Td>
                      <Td align="right"><span className="font-mono text-[12px] font-bold text-success-700 tabular-nums">{formatUsd(row.cost, 4)}</span></Td>
                      <Td align="right"><span className="font-mono text-[11px] text-brand-400">{relativeTime(row.lastUsedAt)}</span></Td>
                    </Tr>
                  ))
                ) : (
                  <Tr>
                    <Td colSpan={7} className="py-8 text-center font-mono text-[11.5px] text-brand-400">
                      NO_MATCHING_RECORDS
                    </Td>
                  </Tr>
                )}
              </tbody>
            </AdminTableWrap>
          </NocPanel>
        </div>
      )}

      {/* 4. MAMMOUTH GATEWAY CONFIG */}
      {subTab === "mammouth" && <AiConfigurationTab />}
    </div>
  );
}
