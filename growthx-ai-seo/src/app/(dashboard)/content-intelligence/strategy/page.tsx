"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Sparkles, RefreshCw, Check, ChevronRight, Clock, Cpu } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { api, type ContentStrategy } from "@/lib/api-client";
import { useWorkspace } from "@/hooks/use-growthx";

const PILLAR_COLORS = ["#6366f1", "#0ea5e9", "#8b5cf6", "#f59e0b", "#10b981", "#ef4444", "#f97316", "#14b8a6"];

function PillarDonut({ pillars }: { pillars: { pillar: string; percentage: number }[] }) {
  const data = pillars.map((p) => ({ name: p.pillar, value: p.percentage }));
  return (
    <ResponsiveContainer width="100%" height={180}>
      <PieChart>
        <Pie data={data} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={2} dataKey="value">
          {data.map((_, i) => <Cell key={i} fill={PILLAR_COLORS[i % PILLAR_COLORS.length]} />)}
        </Pie>
        <Tooltip formatter={(v: any) => `${v}%`} contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #f4f4f5" }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

function StrategyCard({ strategy, onView }: { strategy: ContentStrategy; onView: (s: ContentStrategy) => void }) {
  const pillars = strategy.contentPillars ?? [];
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border bg-white overflow-hidden cursor-pointer hover:shadow-md transition"
      style={{ borderColor: "#f4f4f5" }}
      onClick={() => onView(strategy)}
    >
      <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: "#f4f4f5" }}>
        <div>
          <h3 className="text-[13px] font-semibold text-[#09090b]">{strategy.title}</h3>
          <div className="mt-0.5 flex items-center gap-2 text-[11px] text-[#71717a]">
            <Clock size={11} />
            {new Date(strategy.createdAt).toLocaleDateString()}
            {strategy.industrySkill && <span>· {strategy.industrySkill}</span>}
            {strategy.generatedByModel && <span className="flex items-center gap-1"><Cpu size={10} />{strategy.generatedByModel.split("/").pop()}</span>}
          </div>
        </div>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${strategy.status === "APPROVED" ? "bg-[#10b98118] text-[#10b981]" : "bg-[#f4f4f5] text-[#71717a]"}`}>
          {strategy.status}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-0 divide-x" style={{ borderColor: "#f4f4f5" }}>
        <div className="px-5 py-4">
          {pillars.length ? <PillarDonut pillars={pillars} /> : <div className="py-8 text-center text-[11px] text-[#a1a1aa]">No pillars</div>}
        </div>
        <div className="px-5 py-4">
          <div className="text-[11px] font-semibold text-[#52525b] mb-2">Content Pillars</div>
          <div className="space-y-1.5">
            {pillars.slice(0, 5).map((p, i) => (
              <div key={p.pillar} className="flex items-center gap-2">
                <div className="h-2 w-2 shrink-0 rounded-full" style={{ background: PILLAR_COLORS[i % PILLAR_COLORS.length] }} />
                <span className="flex-1 truncate text-[11px] text-[#52525b]">{p.pillar}</span>
                <span className="text-[10px] font-semibold text-[#71717a]">{p.percentage}%</span>
              </div>
            ))}
          </div>
          {strategy.campaignIdeas && strategy.campaignIdeas.length > 0 && (
            <div className="mt-4 text-[11px] font-semibold text-[#52525b]">{strategy.campaignIdeas.length} campaign ideas</div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function StrategyDetail({ strategy, onClose, onApprove }: { strategy: ContentStrategy; onClose: () => void; onApprove: () => void }) {
  const content = strategy.content as any;
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/30" onClick={onClose}>
      <div className="mx-auto max-w-2xl my-8 rounded-2xl border bg-white shadow-2xl" style={{ borderColor: "#f4f4f5" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b px-6 py-5" style={{ borderColor: "#f4f4f5" }}>
          <div>
            <h2 className="text-[14px] font-semibold text-[#09090b]">{strategy.title}</h2>
            <p className="text-[11px] text-[#71717a]">{strategy.industrySkill} · {new Date(strategy.createdAt).toLocaleDateString()}</p>
          </div>
          <div className="flex gap-2">
            {strategy.status !== "APPROVED" && (
              <button onClick={onApprove} className="flex items-center gap-1.5 rounded-lg bg-[#10b981] px-3 py-1.5 text-[12px] font-medium text-white">
                <Check size={13} /> Approve Strategy
              </button>
            )}
            <button onClick={onClose} className="rounded-lg border px-3 py-1.5 text-[12px] font-medium text-[#52525b]" style={{ borderColor: "#e4e4e7" }}>Close</button>
          </div>
        </div>
        <div className="px-6 py-5 space-y-5">
          {content?.executiveSummary && (
            <div>
              <h3 className="text-[12px] font-semibold text-[#09090b] mb-1.5">Executive Summary</h3>
              <p className="text-[12px] text-[#52525b] leading-relaxed">{content.executiveSummary}</p>
            </div>
          )}

          {(strategy.contentPillars ?? []).length > 0 && (
            <div>
              <h3 className="text-[12px] font-semibold text-[#09090b] mb-2">Content Pillars</h3>
              <div className="space-y-2">
                {strategy.contentPillars!.map((p, i) => (
                  <div key={p.pillar} className="rounded-lg p-3" style={{ background: `${PILLAR_COLORS[i % PILLAR_COLORS.length]}0d` }}>
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] font-semibold" style={{ color: PILLAR_COLORS[i % PILLAR_COLORS.length] }}>{p.pillar}</span>
                      <span className="text-[12px] font-bold text-[#09090b]">{p.percentage}%</span>
                    </div>
                    <p className="mt-1 text-[11px] text-[#71717a]">{p.rationale}</p>
                    {p.topics && <div className="mt-1.5 flex flex-wrap gap-1">{p.topics.map(t => <span key={t} className="rounded-full bg-white/80 border px-1.5 py-0.5 text-[9px] text-[#52525b]" style={{ borderColor: "#e4e4e7" }}>{t}</span>)}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {(strategy.campaignIdeas ?? []).length > 0 && (
            <div>
              <h3 className="text-[12px] font-semibold text-[#09090b] mb-2">Campaign Ideas</h3>
              <div className="space-y-2">
                {strategy.campaignIdeas!.map((idea) => (
                  <div key={idea.name} className="rounded-lg border p-3" style={{ borderColor: "#e4e4e7" }}>
                    <div className="text-[12px] font-semibold text-[#09090b]">{idea.name}</div>
                    <div className="text-[11px] text-[#6366f1]">{idea.objective}</div>
                    <p className="mt-1 text-[11px] text-[#71717a]">{idea.concept}</p>
                    {idea.differentiator && <p className="mt-1 text-[11px] font-medium text-[#10b981]">↑ {idea.differentiator}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {content?.whatToAvoid?.length > 0 && (
            <div>
              <h3 className="text-[12px] font-semibold text-[#09090b] mb-2">What to Avoid</h3>
              <ul className="space-y-1">{content.whatToAvoid.map((item: string) => <li key={item} className="flex items-start gap-2 text-[11px] text-[#71717a]"><span className="text-[#ef4444]">✕</span>{item}</li>)}</ul>
            </div>
          )}

          {content?.hooks?.length > 0 && (
            <div>
              <h3 className="text-[12px] font-semibold text-[#09090b] mb-2">Proven Hooks</h3>
              <div className="space-y-1">{content.hooks.map((h: string) => <div key={h} className="rounded-lg bg-[#f4f4f5] px-3 py-2 text-[11px] text-[#52525b] font-mono">"{h}"</div>)}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function StrategyPage() {
  const { projectId } = useWorkspace();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<ContentStrategy | null>(null);

  const strategies = useQuery({
    queryKey: ["ci-strategies", projectId],
    queryFn: () => api.listContentStrategies(projectId!),
    enabled: !!projectId,
  });

  const generateMut = useMutation({
    mutationFn: () => api.generateContentStrategy(projectId!),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ci-strategies"] }),
  });
  const approveMut = useMutation({
    mutationFn: (strategyId: string) => api.approveContentStrategy(projectId!, strategyId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ci-strategies"] }); if (selected) setSelected({ ...selected, status: "APPROVED" }); },
  });

  if (!projectId) return <div className="flex h-40 items-center justify-center text-sm text-[#71717a]">Select a project.</div>;

  return (
    <div className="min-h-screen bg-[#fafafa]">
      <div className="border-b bg-white px-6 py-5" style={{ borderColor: "#f4f4f5" }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#6366f118]">
              <Sparkles size={17} className="text-[#6366f1]" />
            </div>
            <div>
              <h1 className="text-[15px] font-semibold text-[#09090b]">AI Content Strategy</h1>
              <p className="text-[12px] text-[#71717a]">Differentiated strategy built from competitive intelligence and gap analysis.</p>
            </div>
          </div>
          <button
            onClick={() => generateMut.mutate()}
            disabled={generateMut.isPending}
            className="flex items-center gap-1.5 rounded-lg bg-[#6366f1] px-3 py-1.5 text-[12px] font-medium text-white disabled:opacity-60"
          >
            {generateMut.isPending ? <RefreshCw size={13} className="animate-spin" /> : <Sparkles size={13} />}
            {generateMut.isPending ? "Generating…" : "Generate New Strategy"}
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-6 py-6 space-y-4">
        {generateMut.isPending && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl border bg-white px-6 py-8 text-center" style={{ borderColor: "#f4f4f5" }}>
            <RefreshCw size={24} className="mx-auto mb-3 animate-spin text-[#6366f1]" />
            <p className="text-[13px] font-medium text-[#09090b]">Analyzing competitive intelligence…</p>
            <p className="mt-1 text-[12px] text-[#71717a]">Reading patterns, gaps, and industry context to build your differentiated strategy.</p>
          </motion.div>
        )}

        {strategies.isLoading ? (
          <div className="py-12 text-center text-[12px] text-[#71717a]">Loading…</div>
        ) : !strategies.data?.length ? (
          <div className="rounded-xl border border-dashed bg-white py-16 text-center" style={{ borderColor: "#e4e4e7" }}>
            <Sparkles size={28} className="mx-auto mb-3 text-[#d4d4d8]" />
            <p className="text-[13px] font-medium text-[#09090b]">No strategy generated yet</p>
            <p className="mt-1 text-[12px] text-[#71717a]">Complete gap analysis first, then generate your strategy.</p>
          </div>
        ) : (
          strategies.data.map((strategy) => (
            <StrategyCard key={strategy.id} strategy={strategy} onView={setSelected} />
          ))
        )}
      </div>

      {selected && (
        <StrategyDetail
          strategy={selected}
          onClose={() => setSelected(null)}
          onApprove={() => approveMut.mutate(selected.id)}
        />
      )}
    </div>
  );
}
