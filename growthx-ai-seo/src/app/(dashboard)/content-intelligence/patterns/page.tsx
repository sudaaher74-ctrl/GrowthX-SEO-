"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Layers, RefreshCw, TrendingDown, TrendingUp } from "lucide-react";
import { api } from "@/lib/api-client";
import { useWorkspace } from "@/hooks/use-growthx";

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

  const patterns = useQuery({
    queryKey: ["ci-patterns", projectId],
    queryFn: () => api.listCreativePatterns(projectId!),
    enabled: !!projectId,
  });

  const detectMut = useMutation({
    mutationFn: () => api.detectPatterns(projectId!),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ci-patterns"] }),
  });

  if (!projectId) return <div className="flex h-40 items-center justify-center text-sm text-brand-500">Select a project.</div>;

  return (
    <div className="min-h-screen bg-brand-50">
      <div className="border-b bg-white px-6 py-5" style={{ borderColor: "var(--color-brand-100)" }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-series-6/10">
              <Layers size={17} className="text-series-6" />
            </div>
            <div>
              <h1 className="text-[15px] font-semibold text-brand-950">Creative Pattern Library</h1>
              <p className="text-[12px] text-brand-500">AI-detected recurring patterns across all competitor content.</p>
            </div>
          </div>
          <button
            onClick={() => detectMut.mutate()}
            disabled={detectMut.isPending}
            className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] font-medium text-brand-600 hover:bg-brand-100 disabled:opacity-60"
            style={{ borderColor: "var(--color-brand-200)" }}
          >
            {detectMut.isPending ? <RefreshCw size={13} className="animate-spin" /> : <RefreshCw size={13} />}
            {detectMut.isPending ? "Detecting…" : "Re-detect Patterns"}
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-6 py-6">
        {patterns.isLoading ? (
          <div className="py-12 text-center text-[12px] text-brand-500">Loading patterns…</div>
        ) : !patterns.data?.length ? (
          <div className="rounded-xl border border-dashed bg-white py-16 text-center" style={{ borderColor: "var(--color-brand-200)" }}>
            <Layers size={28} className="mx-auto mb-3 text-brand-300" />
            <p className="text-[13px] font-medium text-brand-950">No patterns detected yet</p>
            <p className="mt-1 text-[12px] text-brand-500">Add competitor content and run classification first, then click "Re-detect Patterns".</p>
            <button onClick={() => detectMut.mutate()} disabled={detectMut.isPending} className="mt-4 rounded-lg bg-series-6 px-4 py-2 text-[12px] font-medium text-white mx-auto flex items-center gap-1.5 disabled:opacity-60">
              {detectMut.isPending ? <RefreshCw size={12} className="animate-spin" /> : null}
              {detectMut.isPending ? "Detecting…" : "Detect Patterns Now"}
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
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="rounded-xl border bg-white p-5"
                style={{ borderColor: "var(--color-brand-100)" }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-[13px] font-semibold text-brand-950">{pattern.name}</h3>
                      {pattern.platforms.map((p) => (
                        <span key={p} className="rounded-full bg-brand-100 px-1.5 py-0.5 text-[9px] font-medium text-brand-600">{p}</span>
                      ))}
                    </div>
                    <p className="mt-1 text-[12px] text-brand-500">{pattern.description}</p>

                    <div className="mt-3 flex flex-wrap gap-1">
                      {pattern.keyVisualElements.map((el) => (
                        <span key={el} className="rounded-full border px-2 py-0.5 text-[10px] font-medium text-brand-600" style={{ borderColor: "var(--color-brand-200)" }}>
                          {el}
                        </span>
                      ))}
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-x-8 gap-y-2 text-[11px]">
                      {pattern.storytellingApproach && (
                        <div className="flex items-center gap-1 text-brand-500">
                          <span className="font-medium text-brand-600">Style:</span> {pattern.storytellingApproach}
                        </div>
                      )}
                      {pattern.ctaType && (
                        <div className="flex items-center gap-1 text-brand-500">
                          <span className="font-medium text-brand-600">CTA:</span> {pattern.ctaType}
                        </div>
                      )}
                      <div className="flex items-center gap-1 text-brand-500">
                        <span className="font-medium text-brand-600">Frequency:</span> {pattern.frequency} content items
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
    </div>
  );
}
