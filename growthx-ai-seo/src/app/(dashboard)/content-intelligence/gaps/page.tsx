"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Target, RefreshCw, Check, X, ChevronRight } from "lucide-react";
import { api } from "@/lib/api-client";
import { useWorkspace } from "@/hooks/use-growthx";

const GAP_TYPES: Record<string, { label: string; color: string; bg: string; description: string }> = {
  MARKET_GAP: { label: "Market Gap", color: "var(--color-success-500)", bg: "#10b98118", description: "No competitor is doing this — wide open opportunity" },
  COMPETITOR_WINNING: { label: "Competitor Winning", color: "var(--color-error-500)", bg: "#ef444418", description: "Competitors outperform you here" },
  CUSTOMER_MISSING: { label: "You're Missing", color: "var(--color-warning-500)", bg: "#f59e0b18", description: "Competitors do this — you don't" },
  DIFFERENTIATION: { label: "Differentiation Opp.", color: "var(--color-accent-600)", bg: "color-mix(in srgb, var(--color-accent-600) 10%, transparent)", description: "Make this uniquely yours" },
  EMERGING: { label: "Emerging Trend", color: "var(--color-series-2)", bg: "#0ea5e918", description: "Early-mover advantage available" },
  SATURATED: { label: "Saturated", color: "var(--color-brand-500)", bg: "#71717a18", description: "Everyone is doing this — risky to join" },
};

const COMPETITION_COLORS: Record<string, string> = { LOW: "var(--color-success-500)", MEDIUM: "var(--color-warning-500)", HIGH: "var(--color-error-500)" };

export default function GapsPage() {
  const { projectId } = useWorkspace();
  const qc = useQueryClient();

  const gaps = useQuery({
    queryKey: ["ci-gaps", projectId],
    queryFn: () => api.listContentGaps(projectId!),
    enabled: !!projectId,
  });

  const analyzeMut = useMutation({
    mutationFn: () => api.analyzeGaps(projectId!),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ci-gaps"] }),
  });

  const statusMut = useMutation({
    mutationFn: ({ gapId, status }: { gapId: string; status: string }) => api.updateGapStatus(projectId!, gapId, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ci-gaps"] }),
  });

  if (!projectId) return <div className="flex h-40 items-center justify-center text-sm text-brand-500">Select a project.</div>;

  const open = gaps.data?.filter((g) => g.status === "OPEN") ?? [];
  const actioned = gaps.data?.filter((g) => g.status !== "OPEN") ?? [];

  return (
    <div className="min-h-screen bg-brand-50">
      <div className="border-b bg-white px-6 py-5" style={{ borderColor: "var(--color-brand-100)" }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#f59e0b18]">
              <Target size={17} className="text-warning-500" />
            </div>
            <div>
              <h1 className="text-[15px] font-semibold text-brand-950">Content Gap Analysis</h1>
              <p className="text-[12px] text-brand-500">What competitors are doing, what you're missing, and where to differentiate.</p>
            </div>
          </div>
          <button
            onClick={() => analyzeMut.mutate()}
            disabled={analyzeMut.isPending}
            className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] font-medium text-brand-600 hover:bg-brand-100 disabled:opacity-60"
            style={{ borderColor: "var(--color-brand-200)" }}
          >
            {analyzeMut.isPending ? <RefreshCw size={13} className="animate-spin" /> : <RefreshCw size={13} />}
            {analyzeMut.isPending ? "Analyzing…" : "Re-analyze Gaps"}
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-6 py-6 space-y-6">
        {/* Gap type legend */}
        <div className="flex flex-wrap gap-2">
          {Object.entries(GAP_TYPES).map(([key, val]) => (
            <span key={key} className="rounded-full px-2.5 py-1 text-[10px] font-semibold" style={{ color: val.color, background: val.bg }}>
              {val.label}
            </span>
          ))}
        </div>

        {gaps.isLoading ? (
          <div className="py-12 text-center text-[12px] text-brand-500">Loading…</div>
        ) : !gaps.data?.length ? (
          <div className="rounded-xl border border-dashed bg-white py-16 text-center" style={{ borderColor: "var(--color-brand-200)" }}>
            <Target size={28} className="mx-auto mb-3 text-brand-300" />
            <p className="text-[13px] font-medium text-brand-950">No gaps analyzed yet</p>
            <p className="mt-1 text-[12px] text-brand-500">Detect patterns first, then click "Re-analyze Gaps".</p>
            <button onClick={() => analyzeMut.mutate()} disabled={analyzeMut.isPending}
              className="mt-4 mx-auto flex items-center gap-1.5 rounded-lg bg-warning-500 px-4 py-2 text-[12px] font-medium text-white disabled:opacity-60">
              {analyzeMut.isPending ? "Analyzing…" : "Analyze Now"}
            </button>
          </div>
        ) : (
          <>
            {open.length > 0 && (
              <div>
                <h2 className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-brand-500">Open Opportunities ({open.length})</h2>
                <div className="space-y-3">
                  {open.map((gap, i) => {
                    const meta = GAP_TYPES[gap.gapType] ?? { label: gap.gapType, color: "var(--color-brand-500)", bg: "var(--color-brand-100)", description: "" };
                    const compColor = COMPETITION_COLORS[gap.competitionLevel] ?? "var(--color-brand-500)";
                    return (
                      <motion.div
                        key={gap.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.04 }}
                        className="rounded-xl border bg-white p-5"
                        style={{ borderColor: "var(--color-brand-100)", borderLeft: `3px solid ${meta.color}` }}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-full px-2 py-0.5 text-[9.5px] font-semibold" style={{ color: meta.color, background: meta.bg }}>
                                {meta.label}
                              </span>
                              <span className="rounded-full px-2 py-0.5 text-[9.5px] font-semibold" style={{ color: compColor, background: `${compColor}18` }}>
                                {gap.competitionLevel} competition
                              </span>
                              {gap.pattern && (
                                <span className="text-[10px] text-brand-400">Pattern: {gap.pattern.name}</span>
                              )}
                            </div>
                            <h3 className="mt-1.5 text-[13px] font-semibold text-brand-950">{gap.title}</h3>
                            <p className="mt-1 text-[12px] text-brand-500">{gap.description}</p>
                            {gap.recommendedAction && (
                              <div className="mt-2.5 flex items-start gap-1.5 rounded-lg bg-success-50 px-3 py-2">
                                <ChevronRight size={12} className="mt-0.5 shrink-0 text-success-500" />
                                <p className="text-[11.5px] text-success-700">{gap.recommendedAction}</p>
                              </div>
                            )}
                          </div>
                          <div className="shrink-0 flex flex-col items-end gap-2">
                            <div className="text-center">
                              <div className="text-[9px] text-brand-400">Opportunity</div>
                              <div className="text-[18px] font-bold" style={{ color: meta.color }}>{gap.opportunityScore}</div>
                            </div>
                            <div className="flex gap-1">
                              <button
                                onClick={() => statusMut.mutate({ gapId: gap.id, status: "ACTIONED" })}
                                className="flex items-center gap-1 rounded-md bg-success-500 px-2 py-1 text-[10px] font-medium text-white hover:opacity-80"
                              >
                                <Check size={11} /> Act
                              </button>
                              <button
                                onClick={() => statusMut.mutate({ gapId: gap.id, status: "DISMISSED" })}
                                className="flex items-center gap-1 rounded-md bg-brand-100 px-2 py-1 text-[10px] font-medium text-brand-500 hover:bg-brand-200"
                              >
                                <X size={11} /> Skip
                              </button>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            )}

            {actioned.length > 0 && (
              <div>
                <h2 className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-brand-400">Actioned / Dismissed ({actioned.length})</h2>
                <div className="space-y-2">
                  {actioned.map((gap) => (
                    <div key={gap.id} className="flex items-center gap-3 rounded-lg border bg-white px-4 py-3 opacity-60" style={{ borderColor: "var(--color-brand-100)" }}>
                      <span className="text-[11.5px] text-brand-500">{gap.title}</span>
                      <span className="ml-auto rounded-full px-2 py-0.5 text-[9px] font-medium bg-brand-100 text-brand-500">{gap.status}</span>
                      <button onClick={() => statusMut.mutate({ gapId: gap.id, status: "OPEN" })} className="text-[10px] text-accent-600 hover:underline">Reopen</button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
