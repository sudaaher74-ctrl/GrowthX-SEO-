"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, GitPullRequest, Trash2, Zap } from "lucide-react";
import { ActionButton, Panel, Pill } from "@/components/ui/console";
import { api } from "@/lib/api-client";
import { stagingEngine } from "@/lib/staging-engine";

const sourceTone = (src: string) => {
  if (src.includes("AI_VISIBILITY")) return "info" as const;
  if (src.includes("COMPETITOR")) return "warn" as const;
  if (src.includes("AUTHORITY")) return "good" as const;
  if (src.includes("TECHNICAL")) return "bad" as const;
  return "default" as const;
};

export function SavedTasksPanel({ projectId, onPrepare }: {
  projectId: string | null;
  onPrepare: (instruction: string) => void;
}) {
  const queryClient = useQueryClient();
  const [limit, setLimit] = useState(20);
  const plans = useQuery({
    queryKey: ["saved-plans", projectId],
    queryFn: () => api.savedPlans.list(projectId!),
    enabled: Boolean(projectId),
    retry: false,
    staleTime: 60000,
  });

  if (!projectId || !plans.isSuccess) return null;
  const tasks = (plans.data ?? []).filter(task => task.status === "STAGED" || task.status === "APPROVED");
  if (tasks.length === 0) return null;

  const handleRemove = (taskId: string) => {
    stagingEngine.remove(projectId, taskId);
    void queryClient.invalidateQueries({ queryKey: ["saved-plans", projectId] });
  };

  const handleApprove = (taskId: string) => {
    stagingEngine.setStatus(projectId, taskId, "APPROVED");
    void queryClient.invalidateQueries({ queryKey: ["saved-plans", projectId] });
  };

  return (
    <Panel padded title={`Staged Improvement Pipeline (${tasks.length})`} subtitle="Actionable items queued from Website Audit, Competitor Intelligence, Organic Search, Backlinks, and AI Visibility.">
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
                    className="inline-flex items-center gap-1 rounded-lg border border-brand-200/80 bg-surface-1 px-2.5 py-1 text-xs font-semibold text-brand-800 hover:bg-brand-50 hover:text-brand-950 transition-colors shadow-2xs"
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
                className="p-1 text-brand-400 hover:text-error-600 transition-colors"
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
    </Panel>
  );
}
