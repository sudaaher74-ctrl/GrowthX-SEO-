"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Send, Check, ChevronRight, Clock } from "lucide-react";
import { api } from "@/lib/api-client";
import { useWorkspace } from "@/hooks/use-growthx";

const STAGE_ORDER = ["SHORTLISTED", "CONTACTED", "NEGOTIATING", "AGREED", "DELIVERED", "DONE", "DECLINED"];
const STAGE_COLORS: Record<string, string> = {
  SHORTLISTED: "var(--color-brand-400)",
  CONTACTED: "var(--color-series-2)",
  NEGOTIATING: "var(--color-warning-500)",
  AGREED: "var(--color-success-500)",
  DELIVERED: "var(--color-accent-600)",
  DONE: "var(--color-success-500)",
  DECLINED: "var(--color-error-500)",
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

  if (!projectId) return <div className="flex h-40 items-center justify-center text-sm text-brand-500">Select a project.</div>;

  const grouped = (outreach.data ?? []).reduce<Record<string, typeof outreach.data>>((acc, o) => {
    const stage = o.pipelineStage;
    if (!acc[stage]) acc[stage] = [];
    acc[stage]!.push(o);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-brand-50">
      <div className="border-b bg-white px-6 py-5" style={{ borderColor: "var(--color-brand-100)" }}>
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0ea5e918]">
            <Send size={17} className="text-series-2" />
          </div>
          <div>
            <h1 className="text-[15px] font-semibold text-brand-950">Collaboration Outreach</h1>
            <p className="text-[12px] text-brand-500">Pipeline-view of all creator collaboration requests. Approve to send.</p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-6 py-6">
        {outreach.isLoading ? (
          <div className="py-12 text-center text-[12px] text-brand-500">Loading…</div>
        ) : !outreach.data?.length ? (
          <div className="rounded-xl border border-dashed bg-white py-16 text-center" style={{ borderColor: "var(--color-brand-200)" }}>
            <Send size={28} className="mx-auto mb-3 text-brand-300" />
            <p className="text-[13px] font-medium text-brand-950">No outreach messages yet</p>
            <p className="mt-1 text-[12px] text-brand-500">Go to Creator CRM, select a creator, and click &quot;Outreach&quot; to generate a collaboration request.</p>
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
                      style={{ borderColor: "var(--color-brand-100)" }}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[13px] font-semibold text-brand-950">{item.creator?.name ?? "Unknown"}</span>
                            {item.creator?.handle && <span className="font-mono text-[10px] text-brand-400">@{item.creator.handle}</span>}
                            {item.creator?.category && <span className="text-[10px] text-brand-500">{item.creator.category}</span>}
                            {!item.approvedToSend && (
                              <span className="rounded-full bg-warning-50 px-1.5 py-0.5 text-[9px] font-semibold text-warning-700">Awaiting Approval</span>
                            )}
                            {item.sentAt && (
                              <span className="rounded-full bg-success-50 px-1.5 py-0.5 text-[9px] font-semibold text-success-700">Sent</span>
                            )}
                          </div>

                          {item.subject && (
                            <p className="mt-2 text-[12px] font-semibold text-brand-950">{item.subject}</p>
                          )}
                          {item.messageBody && (
                            <p className="mt-1 text-[11.5px] text-brand-600 leading-relaxed line-clamp-3">{item.messageBody}</p>
                          )}

                          {item.sentAt && (
                            <p className="mt-2 flex items-center gap-1 text-[10.5px] text-brand-400">
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
                            className="flex shrink-0 items-center gap-1.5 rounded-lg bg-success-500 px-3 py-2 text-[11.5px] font-medium text-white transition hover:opacity-90"
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
