"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Layers, RefreshCw, TrendingDown, TrendingUp } from "lucide-react";
import { api } from "@/lib/api-client";
import { useWorkspace } from "@/hooks/use-growthx";

function SaturationBar({ value }: { value: number }) {
  const color = value >= 70 ? "#ef4444" : value >= 40 ? "#f59e0b" : "#10b981";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#f4f4f5]">
        <div className="h-full rounded-full transition-all" style={{ width: `${value}%`, background: color }} />
      </div>
      <span className="w-8 text-right text-[10px] font-semibold" style={{ color }}>{value}%</span>
    </div>
  );
}

function OpportunityBadge({ value }: { value: number }) {
  const color = value >= 70 ? "#10b981" : value >= 40 ? "#f59e0b" : "#71717a";
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

  if (!projectId) return <div className="flex h-40 items-center justify-center text-sm text-[#71717a]">Select a project.</div>;

  return (
    <div className="min-h-screen bg-[#fafafa]">
      <div className="border-b bg-white px-6 py-5" style={{ borderColor: "#f4f4f5" }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#8b5cf618]">
              <Layers size={17} className="text-[#8b5cf6]" />
            </div>
            <div>
              <h1 className="text-[15px] font-semibold text-[#09090b]">Creative Pattern Library</h1>
              <p className="text-[12px] text-[#71717a]">AI-detected recurring patterns across all competitor content.</p>
            </div>
          </div>
          <button
            onClick={() => detectMut.mutate()}
            disabled={detectMut.isPending}
            className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] font-medium text-[#52525b] hover:bg-[#f4f4f5] disabled:opacity-60"
            style={{ borderColor: "#e4e4e7" }}
          >
            {detectMut.isPending ? <RefreshCw size={13} className="animate-spin" /> : <RefreshCw size={13} />}
            {detectMut.isPending ? "Detecting…" : "Re-detect Patterns"}
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-6 py-6">
        {patterns.isLoading ? (
          <div className="py-12 text-center text-[12px] text-[#71717a]">Loading patterns…</div>
        ) : !patterns.data?.length ? (
          <div className="rounded-xl border border-dashed bg-white py-16 text-center" style={{ borderColor: "#e4e4e7" }}>
            <Layers size={28} className="mx-auto mb-3 text-[#d4d4d8]" />
            <p className="text-[13px] font-medium text-[#09090b]">No patterns detected yet</p>
            <p className="mt-1 text-[12px] text-[#71717a]">Add competitor content and run classification first, then click "Re-detect Patterns".</p>
            <button onClick={() => detectMut.mutate()} disabled={detectMut.isPending} className="mt-4 rounded-lg bg-[#8b5cf6] px-4 py-2 text-[12px] font-medium text-white mx-auto flex items-center gap-1.5 disabled:opacity-60">
              {detectMut.isPending ? <RefreshCw size={12} className="animate-spin" /> : null}
              {detectMut.isPending ? "Detecting…" : "Detect Patterns Now"}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Legend */}
            <div className="flex items-center gap-4 text-[11px] text-[#71717a] mb-2">
              <div className="flex items-center gap-1"><div className="h-2 w-2 rounded-full bg-[#ef4444]" /> High saturation (everyone does this)</div>
              <div className="flex items-center gap-1"><div className="h-2 w-2 rounded-full bg-[#f59e0b]" /> Medium saturation</div>
              <div className="flex items-center gap-1"><div className="h-2 w-2 rounded-full bg-[#10b981]" /> Low saturation (opportunity)</div>
            </div>

            {patterns.data.map((pattern, i) => (
              <motion.div
                key={pattern.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="rounded-xl border bg-white p-5"
                style={{ borderColor: "#f4f4f5" }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-[13px] font-semibold text-[#09090b]">{pattern.name}</h3>
                      {pattern.platforms.map((p) => (
                        <span key={p} className="rounded-full bg-[#f4f4f5] px-1.5 py-0.5 text-[9px] font-medium text-[#52525b]">{p}</span>
                      ))}
                    </div>
                    <p className="mt-1 text-[12px] text-[#71717a]">{pattern.description}</p>

                    <div className="mt-3 flex flex-wrap gap-1">
                      {pattern.keyVisualElements.map((el) => (
                        <span key={el} className="rounded-full border px-2 py-0.5 text-[10px] font-medium text-[#52525b]" style={{ borderColor: "#e4e4e7" }}>
                          {el}
                        </span>
                      ))}
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-x-8 gap-y-2 text-[11px]">
                      {pattern.storytellingApproach && (
                        <div className="flex items-center gap-1 text-[#71717a]">
                          <span className="font-medium text-[#52525b]">Style:</span> {pattern.storytellingApproach}
                        </div>
                      )}
                      {pattern.ctaType && (
                        <div className="flex items-center gap-1 text-[#71717a]">
                          <span className="font-medium text-[#52525b]">CTA:</span> {pattern.ctaType}
                        </div>
                      )}
                      <div className="flex items-center gap-1 text-[#71717a]">
                        <span className="font-medium text-[#52525b]">Frequency:</span> {pattern.frequency} content items
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0 flex flex-col items-end gap-3 min-w-[140px]">
                    <div className="w-full">
                      <div className="mb-1 flex items-center justify-between text-[10px]">
                        <span className="text-[#71717a]">Market Saturation</span>
                        {pattern.marketSaturation >= 70 ? <TrendingDown size={11} className="text-[#ef4444]" /> : <TrendingUp size={11} className="text-[#10b981]" />}
                      </div>
                      <SaturationBar value={pattern.marketSaturation} />
                    </div>
                    <div className="w-full">
                      <div className="mb-1 text-[10px] text-[#71717a]">Opportunity Score</div>
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
