"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, GitBranch, GitPullRequest, Layers, ShieldCheck, Trash2, Zap } from "lucide-react";
import { ActionButton, Panel, Pill } from "@/components/ui/console";
import { api } from "@/lib/api-client";
import { stagingEngine } from "@/lib/staging-engine";
import { cn } from "@/lib/utils";

const sourceTone = (src: string) => {
  if (src.includes("AI_VISIBILITY")) return "info" as const;
  if (src.includes("COMPETITOR")) return "warn" as const;
  if (src.includes("AUTHORITY")) return "good" as const;
  if (src.includes("TECHNICAL")) return "bad" as const;
  return "default" as const;
};

type SourceFilter = "ALL" | "TECHNICAL" | "COMPETITOR" | "AI" | "AUTHORITY";

export function SavedTasksPanel({ projectId, onPrepare }: {
  projectId: string | null;
  onPrepare: (instruction: string) => void;
}) {
  const queryClient = useQueryClient();
  const [limit, setLimit] = useState(20);
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("ALL");
  const plans = useQuery({
    queryKey: ["saved-plans", projectId],
    queryFn: () => api.savedPlans.list(projectId!),
    enabled: Boolean(projectId),
    retry: false,
    staleTime: 60000,
  });

  const allTasks = useMemo(() => {
    return (plans.data ?? []).filter(task => task.status === "STAGED" || task.status === "APPROVED");
  }, [plans.data]);

  const techCount = useMemo(() => allTasks.filter(t => t.source === "TECHNICAL_AUDIT").length, [allTasks]);
  const compCount = useMemo(() => allTasks.filter(t => t.source.includes("COMPETITOR")).length, [allTasks]);
  const aiCount = useMemo(() => allTasks.filter(t => t.source === "AI_VISIBILITY").length, [allTasks]);
  const authorityCount = useMemo(() => allTasks.filter(t => t.source === "AUTHORITY_GAP" || t.source === "INTERNAL_LINK").length, [allTasks]);

  const tasks = useMemo(() => {
    if (sourceFilter === "TECHNICAL") return allTasks.filter(t => t.source === "TECHNICAL_AUDIT");
    if (sourceFilter === "COMPETITOR") return allTasks.filter(t => t.source.includes("COMPETITOR"));
    if (sourceFilter === "AI") return allTasks.filter(t => t.source === "AI_VISIBILITY");
    if (sourceFilter === "AUTHORITY") return allTasks.filter(t => t.source === "AUTHORITY_GAP" || t.source === "INTERNAL_LINK");
    return allTasks;
  }, [allTasks, sourceFilter]);

  if (!projectId || !plans.isSuccess) return null;
  if (allTasks.length === 0) return null;

  const handleRemove = (taskId: string) => {
    stagingEngine.remove(projectId, taskId);
    void queryClient.invalidateQueries({ queryKey: ["saved-plans", projectId] });
  };

  const handleApprove = (taskId: string) => {
    stagingEngine.setStatus(projectId, taskId, "APPROVED");
    void queryClient.invalidateQueries({ queryKey: ["saved-plans", projectId] });
  };

  const handleApproveAll = () => {
    for (const task of tasks) {
      if (task.status === "STAGED") {
        stagingEngine.setStatus(projectId, task.id, "APPROVED");
      }
    }
    void queryClient.invalidateQueries({ queryKey: ["saved-plans", projectId] });
  };

  const handleClearAll = () => {
    if (confirm(`Remove ${tasks.length} task${tasks.length === 1 ? "" : "s"} from the staged pipeline?`)) {
      for (const task of tasks) {
        stagingEngine.remove(projectId, task.id);
      }
      void queryClient.invalidateQueries({ queryKey: ["saved-plans", projectId] });
    }
  };

  const handleBatchPrepareAll = () => {
    const guard = "\n\nInspect the connected repository and verify all business claims before proposing edits. Preserve existing behaviour. Prepare a draft PR only when an actual connected change is justified; otherwise explain what evidence is missing.";
    const summary = tasks.map((t, i) => `${i + 1}. [${t.priority || "HIGH"}] ${t.title}\nCategory: ${t.category}\nDeliverable:\n${t.deliverable}`).join("\n\n---\n\n");
    const instruction = `Autonomous Batch SEO Remediation Plan (${tasks.length} tasks):\n\n${summary}`;
    onPrepare(instruction.slice(0, 2500 - guard.length) + guard);
  };

  const stagedCount = tasks.filter(t => t.status === "STAGED").length;

  return (
    <Panel
      padded
      title={`Staged Improvement Pipeline (${allTasks.length})`}
      subtitle="Actionable items queued from Website Audit, Competitor Intelligence, Organic Search, Backlinks, and AI Visibility."
    >
      <div className="space-y-4">
        {/* ── BATCH ORCHESTRATION & FILTER BAR ── */}
        <div className="flex flex-col gap-3 rounded-2xl border border-brand-200/80 bg-surface-2 p-3.5 shadow-2xs">
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              {[
                { id: "ALL", label: `All Staged (${allTasks.length})` },
                { id: "TECHNICAL", label: `Technical Audit (${techCount})` },
                { id: "COMPETITOR", label: `Competitor Gaps (${compCount})` },
                { id: "AI", label: `AI Visibility (${aiCount})` },
                { id: "AUTHORITY", label: `Authority & Links (${authorityCount})` },
              ].map((pill) => {
                const isActive = sourceFilter === pill.id;
                return (
                  <button
                    key={pill.id}
                    type="button"
                    onClick={() => setSourceFilter(pill.id as SourceFilter)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-medium transition cursor-pointer",
                      isActive
                        ? "bg-signal-400 text-signal-ink font-bold shadow-xs"
                        : "border border-brand-200 bg-surface-1 text-brand-700 hover:text-brand-950 hover:bg-surface-3"
                    )}
                  >
                    <span>{pill.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {stagedCount > 0 && (
                <button
                  type="button"
                  onClick={handleApproveAll}
                  className="inline-flex items-center gap-1 rounded-lg border border-brand-200 bg-surface-1 px-2.5 py-1 text-xs font-semibold text-brand-800 hover:bg-brand-50 hover:text-brand-950 transition-colors shadow-2xs cursor-pointer"
                >
                  <CheckCircle2 size={12} className="text-success-600" />
                  <span>Approve All ({stagedCount})</span>
                </button>
              )}
              <button
                type="button"
                onClick={handleBatchPrepareAll}
                className="inline-flex items-center gap-1.5 rounded-lg bg-signal-400 px-3.5 py-1.5 text-xs font-bold text-signal-ink shadow-xs transition hover:bg-signal-500 active:scale-[0.98] cursor-pointer"
              >
                <GitPullRequest size={12} className="text-signal-ink" />
                <span>Batch Dispatch All to PR ({tasks.length})</span>
              </button>
              <button
                type="button"
                onClick={handleClearAll}
                className="p-1.5 rounded-lg border border-brand-200 bg-surface-1 text-brand-400 hover:text-error-600 hover:bg-error-50 transition cursor-pointer"
                title="Clear all tasks from pipeline"
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>

          {/* Autonomous Execution Guardrails Strip */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-brand-200/60 pt-2 text-[10.5px] font-mono text-brand-600">
            <div className="flex items-center gap-2">
              <ShieldCheck size={12} className="text-success-600" />
              <span>Guardrails: Non-breaking DOM changes · Clean rollback capability</span>
            </div>
            <div className="flex items-center gap-2">
              <GitBranch size={12} className="text-brand-400" />
              <span>Target: feature/growthx-seo-fixes</span>
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {tasks.slice(0, limit).map(task => (
            <article
              key={task.id}
              className="flex flex-col justify-between rounded-xl border border-brand-200/80 bg-surface-1 p-4 shadow-2xs transition-all hover:border-brand-300 hover:shadow-card space-y-3"
            >
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-1.5">
                  <Pill tone={sourceTone(task.source)}>
                    {task.source.replaceAll("_", " ")}
                  </Pill>
                  {task.priority && (
                    <span className="font-mono text-[10.5px] font-bold text-brand-500 uppercase">
                      {task.priority} Priority
                    </span>
                  )}
                </div>
                <h3 className="text-sm font-bold text-brand-950 leading-snug">{task.title}</h3>
                {task.evidence && <p className="text-xs text-brand-500 leading-normal">Context: {task.evidence}</p>}
                <details className="pt-1">
                  <summary className="cursor-pointer text-xs font-semibold text-primary-700">
                    Review deliverable
                  </summary>
                  <p className="mt-2 whitespace-pre-wrap rounded-lg bg-surface-2 p-2.5 font-mono text-[11.5px] text-brand-800 leading-relaxed">
                    {task.deliverable}
                  </p>
                </details>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-brand-100 pt-3">
                <div className="flex items-center gap-2">
                  <ActionButton
                    variant="primary"
                    icon={<GitPullRequest size={12} />}
                    onClick={() => {
                      const guard = "\n\nInspect the connected repository and verify all business claims before proposing edits. Preserve existing behaviour. Prepare a draft PR only when an actual connected change is justified; otherwise explain what evidence is missing.";
                      const context = `User-saved proposal: ${task.title}\n\n${task.deliverable}`;
                      onPrepare(context.slice(0, 2000 - guard.length) + guard);
                    }}
                  >
                    GitHub PR
                  </ActionButton>
                  {task.status === "STAGED" && (
                    <button
                      type="button"
                      onClick={() => handleApprove(task.id)}
                      className="inline-flex items-center gap-1 rounded-lg border border-brand-200/80 bg-surface-1 px-2.5 py-1 text-xs font-semibold text-brand-800 hover:bg-brand-50 hover:text-brand-950 transition-colors shadow-2xs cursor-pointer"
                      title="Mark approved for deployment"
                    >
                      <CheckCircle2 size={12} className="text-success-600" />
                      <span>Approve</span>
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleRemove(task.id)}
                  className="p-1 text-brand-400 hover:text-error-600 transition-colors cursor-pointer"
                  title="Remove task from pipeline"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </article>
          ))}
        </div>

        {tasks.length > limit && (
          <div className="mt-4">
            <ActionButton onClick={() => setLimit(previous => previous + 20)}>Show more staged tasks</ActionButton>
          </div>
        )}
      </div>
    </Panel>
  );
}
