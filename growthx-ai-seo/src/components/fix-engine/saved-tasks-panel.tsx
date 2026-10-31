"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ActionButton, Panel, Pill, StatusNote } from "@/components/ui/console";
import { api } from "@/lib/api-client";
import { errorMessage } from "@/lib/error-message";

export function SavedTasksPanel({ projectId, onPrepare }: {
  projectId: string | null;
  onPrepare: (instruction: string) => void;
}) {
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

  return (
    <Panel padded title={`Saved improvement tasks (${tasks.length})`} subtitle="User-saved proposals from your workflow. These are separate from measured audit findings and require review.">
      <div className="space-y-4">
        {tasks.slice(0, limit).map(task => (
          <article key={task.id} className="space-y-2 border-b pb-4 last:border-b-0">
            <h3 className="text-sm font-semibold text-brand-950">{task.title}</h3>
            <Pill>{task.source.replaceAll("_", " ")}</Pill>
            {task.evidence && <p className="text-xs text-brand-500">Saved context: {task.evidence}</p>}
            <details>
              <summary className="cursor-pointer text-xs text-primary-700">Review proposed task</summary>
              <p className="mt-2 whitespace-pre-wrap text-sm text-brand-700">{task.deliverable}</p>
            </details>
            <ActionButton onClick={() => {
              const guard = "\n\nInspect the connected repository and verify all business claims before proposing edits. Preserve existing behaviour. Prepare a draft PR only when an actual connected change is justified; otherwise explain what evidence is missing.";
              const context = `User-saved proposal: ${task.title}\n\n${task.deliverable}`;
              onPrepare(context.slice(0, 2000 - guard.length) + guard);
            }}>Use in GitHub Engineer</ActionButton>
          </article>
        ))}
      </div>
      {tasks.length > limit && (
        <ActionButton onClick={() => setLimit(previous => previous + 20)}>Show more saved tasks</ActionButton>
      )}
    </Panel>
  );
}
