"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Layers, RefreshCw, TrendingDown, TrendingUp, Target, CheckCircle2, Filter } from "lucide-react";
import { api, type ContentGap } from "@/lib/api-client";
import { useWorkspace } from "@/hooks/use-growthx";

const GAP_TYPES: Record<string, { label: string; color: string; bg: string; description: string }> = {
  MARKET_GAP: { label: "Market Gap", color: "var(--color-success-500)", bg: "#10b98118", description: "No competitor is doing this — wide open opportunity" },
  COMPETITOR_WINNING: { label: "Competitor Winning", color: "var(--color-error-500)", bg: "#ef444418", description: "Competitors outperform you here" },
  CUSTOMER_MISSING: { label: "You're Missing", color: "var(--color-warning-500)", bg: "#f59e0b18", description: "Competitors do this — you don't" },
  DIFFERENTIATION: { label: "Differentiation Opp.", color: "var(--color-accent-600)", bg: "color-mix(in srgb, var(--color-accent-600) 10%, transparent)", description: "Make this uniquely yours" },
  EMERGING: { label: "Emerging Trend", color: "var(--color-accent-500)", bg: "#3b82f618", description: "Early-mover advantage available" },
  SATURATED: { label: "Saturated", color: "var(--color-brand-500)", bg: "#71717a18", description: "Everyone is doing this — risky to join" },
};

const COMPETITION_COLORS: Record<string, string> = {
  LOW: "var(--color-success-500)",
  MEDIUM: "var(--color-warning-500)",
  HIGH: "var(--color-error-500)",
};

function SaturationBar({ value }: { value: number }) {
  const color = value >= 70 ? "var(--color-error-500)" : value >= 40 ? "var(--color-warning-500)" : "var(--color-success-500)";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-brand-100">
        <div className="h-full rounded-full transition-all" style={{ width: `${value}%`, background: color }} />
      </div>
      <span className="w-8 text-right text-[10px] font-semibold" style={{ color }}>{value}%</span>
    </div>
  );
}

function OpportunityBadge({ value }: { value: number }) {
  const color = value >= 70 ? "var(--color-success-500)" : value >= 40 ? "var(--color-warning-500)" : "var(--color-brand-500)";
  return (
    <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ color, background: `${color}18` }}>
      {value}
    </span>
  );
}

export default function PatternsPage() {
  const { projectId } = useWorkspace();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<"PATTERNS" | "GAPS">("PATTERNS");
  const [gapStatusFilter, setGapStatusFilter] = useState<string>("ALL");

  const patterns = useQuery({
    queryKey: ["ci-patterns", projectId],
    queryFn: () => api.listCreativePatterns(projectId!),
    enabled: !!projectId,
  });

  const gaps = useQuery({
    queryKey: ["ci-gaps", projectId, gapStatusFilter],
    queryFn: () => api.listContentGaps(projectId!, gapStatusFilter === "ALL" ? undefined : gapStatusFilter),
    enabled: !!projectId,
  });

  const detectMut = useMutation({
    mutationFn: () => api.detectPatterns(projectId!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ci-patterns"] });
      qc.invalidateQueries({ queryKey: ["ci-gaps"] });
    },
  });

  const analyzeGapsMut = useMutation({
    mutationFn: () => api.analyzeGaps(projectId!),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ci-gaps"] }),
  });

  const updateGapMut = useMutation({
    mutationFn: ({ gapId, status }: { gapId: string; status: string }) =>
      api.updateGapStatus(projectId!, gapId, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ci-gaps"] }),
  });

  if (!projectId) return <div className="flex h-40 items-center justify-center text-sm text-brand-500">Select a project.</div>;

  return (
    <div className="min-h-screen bg-brand-50">
      <div className="border-b bg-white px-6 py-5" style={{ borderColor: "var(--color-brand-100)" }}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-600/10">
              <Layers size={17} className="text-accent-600" />
            </div>
            <div>
              <h1 className="text-[15px] font-semibold text-brand-950">Creative Patterns & Content Gap Grid</h1>
              <p className="text-[12px] text-brand-500">AI-detected creative playbooks and untapped content gap opportunities.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {activeTab === "PATTERNS" ? (
              <button
                onClick={() => detectMut.mutate()}
                disabled={detectMut.isPending}
                className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] font-medium text-brand-700 bg-white hover:bg-brand-50 disabled:opacity-60 transition shadow-2xs"
                style={{ borderColor: "var(--color-brand-200)" }}
              >
                <RefreshCw size={13} className={detectMut.isPending ? "animate-spin text-accent-600" : "text-accent-600"} />
                <span>{detectMut.isPending ? "Detecting…" : "Re-detect Patterns"}</span>
              </button>
            ) : (
              <button
                onClick={() => analyzeGapsMut.mutate()}
                disabled={analyzeGapsMut.isPending}
                className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] font-medium text-brand-700 bg-white hover:bg-brand-50 disabled:opacity-60 transition shadow-2xs"
                style={{ borderColor: "var(--color-brand-200)" }}
              >
                <RefreshCw size={13} className={analyzeGapsMut.isPending ? "animate-spin text-accent-600" : "text-accent-600"} />
                <span>{analyzeGapsMut.isPending ? "Analyzing…" : "Re-analyze Gaps"}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-6 py-6">
        {/* View Switcher Tabs */}
        <div className="flex items-center gap-2 border-b pb-3 mb-6" style={{ borderColor: "var(--color-brand-200)" }}>
          <button
            onClick={() => setActiveTab("PATTERNS")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium transition ${
              activeTab === "PATTERNS"
                ? "bg-brand-950 text-white font-semibold shadow-2xs"
                : "text-brand-600 hover:bg-brand-100"
            }`}
          >
            <Layers size={13} />
            <span>Creative Patterns Leaderboard ({patterns.data?.length ?? 0})</span>
          </button>
          <button
            onClick={() => setActiveTab("GAPS")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium transition ${
              activeTab === "GAPS"
                ? "bg-brand-950 text-white font-semibold shadow-2xs"
                : "text-brand-600 hover:bg-brand-100"
            }`}
          >
            <Target size={13} />
            <span>Content Gap Grid ({gaps.data?.length ?? 0})</span>
          </button>
        </div>

        {/* Tab 1: Patterns Leaderboard */}
        {activeTab === "PATTERNS" && (
          <div>
            {patterns.isLoading ? (
              <div className="py-12 text-center text-[12px] text-brand-500">Loading patterns…</div>
            ) : !patterns.data?.length ? (
              <div className="rounded-xl border border-dashed bg-white py-16 text-center shadow-2xs" style={{ borderColor: "var(--color-brand-200)" }}>
                <Layers size={28} className="mx-auto mb-3 text-brand-300" />
                <p className="text-[13px] font-medium text-brand-950">No patterns detected yet</p>
                <p className="mt-1 text-[12px] text-brand-500">Add competitor content and run classification first, then click &quot;Re-detect Patterns&quot;.</p>
                <button
                  onClick={() => detectMut.mutate()}
                  disabled={detectMut.isPending}
                  className="mt-4 rounded-lg bg-brand-950 px-4 py-2 text-[12px] font-semibold text-white mx-auto flex items-center gap-1.5 disabled:opacity-60 shadow-2xs"
                >
                  {detectMut.isPending ? <RefreshCw size={12} className="animate-spin" /> : null}
                  <span>{detectMut.isPending ? "Detecting…" : "Detect Patterns Now"}</span>
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Legend */}
                <div className="flex items-center gap-4 text-[11px] text-brand-500 mb-2">
                  <div className="flex items-center gap-1"><div className="h-2 w-2 rounded-full bg-error-500" /> High saturation (everyone does this)</div>
                  <div className="flex items-center gap-1"><div className="h-2 w-2 rounded-full bg-warning-500" /> Medium saturation</div>
                  <div className="flex items-center gap-1"><div className="h-2 w-2 rounded-full bg-success-500" /> Low saturation (opportunity)</div>
                </div>

                {patterns.data.map((pattern, i) => (
                  <motion.div
                    key={pattern.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="rounded-xl border bg-white p-5 shadow-2xs"
                    style={{ borderColor: "var(--color-brand-200)" }}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-[13px] font-semibold text-brand-950">{pattern.name}</h3>
                          {pattern.platforms.map((p) => (
                            <span key={p} className="rounded-full bg-brand-100 px-1.5 py-0.5 text-[9px] font-medium text-brand-600">{p}</span>
                          ))}
                        </div>
                        <p className="mt-1 text-[12px] text-brand-600 leading-relaxed">{pattern.description}</p>

                        <div className="mt-3 flex flex-wrap gap-1">
                          {pattern.keyVisualElements.map((el) => (
                            <span key={el} className="rounded-full border px-2 py-0.5 text-[10px] font-medium text-brand-600" style={{ borderColor: "var(--color-brand-200)" }}>
                              {el}
                            </span>
                          ))}
                        </div>

                        <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
                          {pattern.storytellingApproach && (
                            <div className="flex items-center gap-1 text-brand-500">
                              <span className="font-semibold text-brand-700">Style:</span> {pattern.storytellingApproach}
                            </div>
                          )}
                          {pattern.ctaType && (
                            <div className="flex items-center gap-1 text-brand-500">
                              <span className="font-semibold text-brand-700">CTA:</span> {pattern.ctaType}
                            </div>
                          )}
                          <div className="flex items-center gap-1 text-brand-500">
                            <span className="font-semibold text-brand-700">Frequency:</span> {pattern.frequency} items
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0 flex flex-col items-end gap-3 min-w-[140px]">
                        <div className="w-full">
                          <div className="mb-1 flex items-center justify-between text-[10px]">
                            <span className="text-brand-500">Market Saturation</span>
                            {pattern.marketSaturation >= 70 ? <TrendingDown size={11} className="text-error-500" /> : <TrendingUp size={11} className="text-success-500" />}
                          </div>
                          <SaturationBar value={pattern.marketSaturation} />
                        </div>
                        <div className="w-full">
                          <div className="mb-1 text-[10px] text-brand-500">Opportunity Score</div>
                          <div className="flex justify-end">
                            <OpportunityBadge value={pattern.opportunityScore} />
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Content Gap Grid */}
        {activeTab === "GAPS" && (
          <div className="space-y-4">
            {/* Status filters */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-medium text-brand-400 mr-1 flex items-center gap-1">
                  <Filter size={11} /> Status:
                </span>
                {["ALL", "OPEN", "IN_PROGRESS", "RESOLVED"].map((status) => (
                  <button
                    key={status}
                    onClick={() => setGapStatusFilter(status)}
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition ${
                      gapStatusFilter === status
                        ? "bg-brand-950 text-white font-semibold shadow-2xs"
                        : "bg-white border text-brand-600 hover:bg-brand-50"
                    }`}
                    style={{ borderColor: gapStatusFilter === status ? undefined : "var(--color-brand-200)" }}
                  >
                    {status === "ALL" ? "All" : status === "IN_PROGRESS" ? "In Progress" : status === "OPEN" ? "Open" : "Resolved"}
                  </button>
                ))}
              </div>

              {/* Gap Type Pills */}
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(GAP_TYPES).slice(0, 4).map(([key, meta]) => (
                  <span key={key} className="rounded-full px-2 py-0.5 text-[9.5px] font-semibold" style={{ color: meta.color, background: meta.bg }}>
                    {meta.label}
                  </span>
                ))}
              </div>
            </div>

            {gaps.isLoading ? (
              <div className="py-12 text-center text-[12px] text-brand-500">Loading content gaps…</div>
            ) : !gaps.data?.length ? (
              <div className="rounded-xl border border-dashed bg-white py-16 text-center shadow-2xs" style={{ borderColor: "var(--color-brand-200)" }}>
                <Target size={28} className="mx-auto mb-3 text-brand-300" />
                <p className="text-[13px] font-medium text-brand-950">No content gaps found for this filter</p>
                <p className="mt-1 text-[12px] text-brand-500">Click &quot;Re-analyze Gaps&quot; to generate opportunities from detected competitor patterns.</p>
                <button
                  onClick={() => analyzeGapsMut.mutate()}
                  disabled={analyzeGapsMut.isPending}
                  className="mt-4 rounded-lg bg-brand-950 px-4 py-2 text-[12px] font-semibold text-white mx-auto flex items-center gap-1.5 disabled:opacity-60 shadow-2xs"
                >
                  {analyzeGapsMut.isPending ? <RefreshCw size={12} className="animate-spin" /> : <Target size={12} />}
                  <span>{analyzeGapsMut.isPending ? "Analyzing…" : "Run Gap Analysis"}</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {gaps.data.map((gap: ContentGap) => {
                  const meta = GAP_TYPES[gap.gapType] ?? {
                    label: gap.gapType,
                    color: "var(--color-brand-600)",
                    bg: "var(--color-brand-100)",
                    description: "",
                  };
                  const compColor = COMPETITION_COLORS[gap.competitionLevel] ?? "var(--color-brand-500)";

                  return (
                    <motion.div
                      key={gap.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="rounded-xl border bg-white p-4 shadow-2xs flex flex-col justify-between space-y-3"
                      style={{ borderColor: "var(--color-brand-200)" }}
                    >
                      <div>
                        {/* Header: Gap Type & Status */}
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span
                            className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                            style={{ color: meta.color, background: meta.bg }}
                          >
                            {meta.label}
                          </span>
                          <span
                            className={`rounded px-1.5 py-0.5 text-[9.5px] font-semibold ${
                              gap.status === "OPEN"
                                ? "bg-blue-50 text-blue-700 border border-blue-200"
                                : gap.status === "IN_PROGRESS"
                                ? "bg-amber-50 text-amber-700 border border-amber-200"
                                : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            }`}
                          >
                            {gap.status === "IN_PROGRESS" ? "In Progress" : gap.status}
                          </span>
                        </div>

                        {/* Title & Description */}
                        <h4 className="text-[13px] font-semibold text-brand-950">{gap.title}</h4>
                        <p className="mt-1 text-[11.5px] text-brand-600 leading-relaxed">{gap.description}</p>

                        {/* Recommended action */}
                        {gap.recommendedAction && (
                          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50/60 p-2.5 text-[11px] text-amber-900 leading-relaxed">
                            <strong className="font-semibold block mb-0.5">Recommended Playbook:</strong>
                            {gap.recommendedAction}
                          </div>
                        )}

                        {/* Formats & Keywords */}
                        <div className="mt-3 flex flex-wrap items-center gap-1">
                          {gap.suggestedFormats?.map((fmt) => (
                            <span
                              key={fmt}
                              className="rounded bg-brand-100 px-1.5 py-0.5 text-[9.5px] font-medium text-brand-600"
                            >
                              {fmt}
                            </span>
                          ))}
                          {gap.platforms?.map((plt) => (
                            <span
                              key={plt}
                              className="rounded border border-brand-200 px-1.5 py-0.5 text-[9.5px] font-medium text-brand-500"
                            >
                              {plt}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Bottom strip: Opportunity Score, Competition Level, Actions */}
                      <div className="pt-3 border-t border-brand-100 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-3 text-[11px]">
                          <div>
                            <span className="text-[10px] text-brand-400 block">Opportunity</span>
                            <OpportunityBadge value={gap.opportunityScore} />
                          </div>
                          <div>
                            <span className="text-[10px] text-brand-400 block">Competition</span>
                            <span className="text-[10px] font-bold" style={{ color: compColor }}>
                              {gap.competitionLevel}
                            </span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1">
                          {gap.status !== "IN_PROGRESS" && gap.status !== "RESOLVED" && (
                            <button
                              onClick={() => updateGapMut.mutate({ gapId: gap.id, status: "IN_PROGRESS" })}
                              className="rounded-lg border border-brand-200 bg-white px-2.5 py-1 text-[10.5px] font-semibold text-brand-700 hover:bg-brand-100 transition shadow-2xs"
                            >
                              Start
                            </button>
                          )}
                          {gap.status !== "RESOLVED" && (
                            <button
                              onClick={() => updateGapMut.mutate({ gapId: gap.id, status: "RESOLVED" })}
                              className="rounded-lg bg-brand-950 px-2.5 py-1 text-[10.5px] font-semibold text-white hover:bg-brand-900 transition shadow-2xs"
                            >
                              Resolve
                            </button>
                          )}
                          {gap.status === "RESOLVED" && (
                            <span className="flex items-center gap-1 text-[10.5px] font-medium text-emerald-600">
                              <CheckCircle2 size={12} /> Resolved
                            </span>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

