"use client";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot } from "lucide-react";
import { ActionButton, Panel, StatusNote } from "@/components/ui/console";
import { RunCard, useAutomationRuns } from "@/components/fix-engine/ship-panel";
import { useWorkspace } from "@/hooks/use-growthx";
import { api } from "@/lib/api-client";
import { errorMessage } from "@/lib/error-message";

const EXAMPLES = [
  "Change the homepage title to “Fresh A2 milk delivered in Pune” and update its description to match.",
  "Add alt text to the images on the homepage that are missing it.",
  "Add a short FAQ section with three questions to the pricing page.",
];

/**
 * Tell the engineer what to change, in plain words.
 *
 * It reads your repository, makes the change, checks the site still builds and
 * opens a pull request, the way a developer would. It cannot run commands or
 * touch secrets, dependencies or CI, and it never merges: you review the
 * changes and merge, or close the pull request.
 */
export function EngineerPanel() {
  const { projectId } = useWorkspace();
  const queryClient = useQueryClient();
  const repo = useQuery({ queryKey: ["automation-repo", projectId], queryFn: () => api.getRepository(projectId!), enabled: Boolean(projectId), retry: false });
  const runs = useAutomationRuns(projectId);
  const [text, setText] = useState("");
  const [confirming, setConfirming] = useState(false);

  const busy = runs.data?.some((r) => r.status === "RUNNING") ?? false;
  const start = useMutation({
    mutationFn: () => api.runEngineer(projectId!, text.trim()),
    onSuccess: () => {
      setText("");
      setConfirming(false);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["automation-runs", projectId] }),
  });

  if (!repo.data) return null;
  const tooShort = text.trim().length < 8;

  return (
    <Panel title="Ask the engineer" subtitle="Describe a change to your website. It edits the code and opens a pull request for you to review.">
      <div className="space-y-3 p-4">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          maxLength={2000}
          aria-label="What should the engineer change?"
          placeholder="For example: change the homepage title to “Fresh A2 milk delivered in Pune”."
          className="w-full rounded-lg border bg-white p-3 text-[12.5px] outline-none focus:border-primary-500"
        />
        <div className="flex flex-wrap gap-1.5">
          {EXAMPLES.map((e) => (
            <button key={e} type="button" onClick={() => setText(e)} className="rounded-lg border bg-white px-2 py-1 text-left text-[11px] text-brand-600 hover:bg-brand-50">
              {e}
            </button>
          ))}
        </div>

        {!confirming ? (
          <ActionButton disabled={tooShort || busy || start.isPending} icon={<Bot size={12} />} onClick={() => setConfirming(true)}>
            {busy ? "The engineer is working…" : "Ask the engineer"}
          </ActionButton>
        ) : (
          <div className="rounded-lg border border-warning-200 bg-warning-50 p-3 text-[12px] text-warning-800">
            <p>
              The engineer will read <strong>{repo.data.owner}/{repo.data.name}</strong>, make this change on a new branch, check it builds, and open a pull request. It can take a few minutes. Your live site does not change until you merge it.
            </p>
            <div className="mt-2 flex gap-2">
              <ActionButton disabled={start.isPending} onClick={() => start.mutate()}>{start.isPending ? "Starting…" : "Yes, start"}</ActionButton>
              {!start.isPending && <button type="button" onClick={() => setConfirming(false)} className="text-[12px] text-brand-600 hover:underline">Cancel</button>}
            </div>
          </div>
        )}
        {start.error && <StatusNote tone="bad">{errorMessage(start.error)}</StatusNote>}
        <p className="text-[11px] text-brand-400">
          It cannot run commands, and cannot change package.json, lockfiles, CI settings or secrets. It uses your tokens for each step, and makes at most 15 file changes per request.
        </p>
      </div>
    </Panel>
  );
}

/** What the engineer and the fix preparer have done, newest first. */
export function RunsPanel() {
  const { projectId } = useWorkspace();
  const runs = useAutomationRuns(projectId);
  const list = runs.data ?? [];
  if (list.length === 0) return null;
  return (
    <Panel title="Runs" subtitle="Each run and what it did, step by step.">
      <div className="space-y-2 p-4">
        <RunCard run={list[0]} />
        {list.length > 1 && (
          <details className="text-[12px]">
            <summary className="cursor-pointer text-brand-500">Earlier runs ({list.length - 1})</summary>
            <div className="mt-2 space-y-2">{list.slice(1, 8).map((r) => <RunCard key={r.id} run={r} />)}</div>
          </details>
        )}
      </div>
    </Panel>
  );
}
