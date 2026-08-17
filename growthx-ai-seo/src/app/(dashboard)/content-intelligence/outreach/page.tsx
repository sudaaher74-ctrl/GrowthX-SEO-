"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Send, Check, ChevronRight, Clock } from "lucide-react";
import { api } from "@/lib/api-client";
import { useWorkspace } from "@/hooks/use-growthx";

const STAGE_ORDER = ["SHORTLISTED", "CONTACTED", "NEGOTIATING", "AGREED", "DELIVERED", "DONE", "DECLINED"];
const STAGE_COLORS: Record<string, string> = {
  SHORTLISTED: "#a1a1aa",
  CONTACTED: "#0ea5e9",
  NEGOTIATING: "#f59e0b",
  AGREED: "#10b981",
  DELIVERED: "#6366f1",
  DONE: "#10b981",
  DECLINED: "#ef4444",
};

export default function OutreachPage() {
  const { projectId } = useWorkspace();
  const qc = useQueryClient();

  const outreach = useQuery({
    queryKey: ["ci-outreach", projectId],
    queryFn: () => api.listOutreach(projectId!),
    enabled: !!projectId,
  });

  const approveMut = useMutation({
    mutationFn: (outreachId: string) => api.approveOutreach(projectId!, outreachId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ci-outreach"] }),
  });

  const stageMut = useMutation({
    mutationFn: ({ id, stage }: { id: string; stage: string }) => api.updateOutreachStage(projectId!, id, stage),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ci-outreach"] }),
  });

  if (!projectId) return <div className="flex h-40 items-center justify-center text-sm text-[#71717a]">Select a project.</div>;

  const grouped = (outreach.data ?? []).reduce<Record<string, typeof outreach.data>>((acc, o) => {
    const stage = o.pipelineStage;
    if (!acc[stage]) acc[stage] = [];
    acc[stage]!.push(o);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-[#fafafa]">
      <div className="border-b bg-white px-6 py-5" style={{ borderColor: "#f4f4f5" }}>
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0ea5e918]">
            <Send size={17} className="text-[#0ea5e9]" />
          </div>
          <div>
            <h1 className="text-[15px] font-semibold text-[#09090b]">Collaboration Outreach</h1>
            <p className="text-[12px] text-[#71717a]">Pipeline-view of all creator collaboration requests. Approve to send.</p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-6 py-6">
        {outreach.isLoading ? (
          <div className="py-12 text-center text-[12px] text-[#71717a]">Loading…</div>
        ) : !outreach.data?.length ? (
          <div className="rounded-xl border border-dashed bg-white py-16 text-center" style={{ borderColor: "#e4e4e7" }}>
            <Send size={28} className="mx-auto mb-3 text-[#d4d4d8]" />
            <p className="text-[13px] font-medium text-[#09090b]">No outreach messages yet</p>
            <p className="mt-1 text-[12px] text-[#71717a]">Go to Creator CRM, select a creator, and click "Outreach" to generate a collaboration request.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {STAGE_ORDER.filter(s => grouped[s]?.length).map((stage) => (
              <div key={stage}>
                <h2 className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide" style={{ color: STAGE_COLORS[stage] }}>
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: STAGE_COLORS[stage] }} />
                  {stage} · {grouped[stage]!.length}
                </h2>
                <div className="space-y-3">
                  {grouped[stage]!.map((item, i) => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className="rounded-xl border bg-white p-5"
                      style={{ borderColor: "#f4f4f5" }}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[13px] font-semibold text-[#09090b]">{item.creator?.name ?? "Unknown"}</span>
                            {item.creator?.handle && <span className="font-mono text-[10px] text-[#a1a1aa]">@{item.creator.handle}</span>}
                            {item.creator?.category && <span className="text-[10px] text-[#71717a]">{item.creator.category}</span>}
                            {!item.approvedToSend && (
                              <span className="rounded-full bg-[#fef3c7] px-1.5 py-0.5 text-[9px] font-semibold text-[#92400e]">Awaiting Approval</span>
                            )}
                            {item.sentAt && (
                              <span className="rounded-full bg-[#d1fae5] px-1.5 py-0.5 text-[9px] font-semibold text-[#065f46]">Sent</span>
                            )}
                          </div>

                          {item.subject && (
                            <p className="mt-2 text-[12px] font-semibold text-[#09090b]">{item.subject}</p>
                          )}
                          {item.messageBody && (
                            <p className="mt-1 text-[11.5px] text-[#52525b] leading-relaxed line-clamp-3">{item.messageBody}</p>
                          )}

                          {item.sentAt && (
                            <p className="mt-2 flex items-center gap-1 text-[10.5px] text-[#a1a1aa]">
                              <Clock size={11} /> Sent {new Date(item.sentAt).toLocaleDateString()}
                            </p>
                          )}

                          <div className="mt-3 flex gap-1 flex-wrap">
                            {STAGE_ORDER.filter(s => s !== stage && s !== "DONE").map(s => (
                              <button
                                key={s}
                                onClick={() => stageMut.mutate({ id: item.id, stage: s })}
                                className="rounded-md px-2 py-0.5 text-[9.5px] font-medium transition hover:opacity-90"
                                style={{ background: `${STAGE_COLORS[s]}18`, color: STAGE_COLORS[s] }}
                              >
                                → {s}
                              </button>
                            ))}
                          </div>
                        </div>

                        {!item.approvedToSend && (
                          <button
                            onClick={() => approveMut.mutate(item.id)}
                            className="flex shrink-0 items-center gap-1.5 rounded-lg bg-[#10b981] px-3 py-2 text-[11.5px] font-medium text-white transition hover:opacity-90"
                          >
                            <Check size={13} /> Approve & Send
                          </button>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
