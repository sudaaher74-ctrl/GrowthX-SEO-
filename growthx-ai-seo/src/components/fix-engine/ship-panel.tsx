"use client";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, GitPullRequest } from "lucide-react";
import { ActionButton, Panel, Pill, StatusNote, relativeTime } from "@/components/ui/console";
import { useIssueGroups, useWorkspace } from "@/hooks/use-growthx";
import { api, type AutomationRun } from "@/lib/api-client";
import { errorMessage } from "@/lib/error-message";
import { count } from "@/lib/google-format";

const RUN_STATUS: Record<AutomationRun["status"], { label: string; tone: "good" | "bad" | "warn" }> = {
  RUNNING: { label: "Working", tone: "warn" },
  AWAITING_REVIEW: { label: "Pull request ready for you", tone: "good" },
  FAILED: { label: "Nothing was changed", tone: "bad" },
};

/** The runs, refreshed every few seconds while one is still going. */
export function useAutomationRuns(projectId: string | null) {
  return useQuery({
    queryKey: ["automation-runs", projectId],
    queryFn: () => api.listAutomationRuns(projectId!),
    enabled: Boolean(projectId),
    retry: false,
    refetchInterval: (q) => (q.state.data?.some((r) => r.status === "RUNNING") ? 4000 : false),
  });
}

/**
 * From plan to pull request.
 *
 * Fix Engine prepares low-risk website fixes (titles, descriptions, alt text,
 * structured data), builds the site to check it still works, and opens a pull
 * request on your repository. It never merges: your site changes only when you
 * review and merge it. Changes that can affect rankings (canonical tags,
 * headings, internal links) are left to a person and listed in the pull request.
 */
export function ShipPanel() {
  const { projectId } = useWorkspace();
  const queryClient = useQueryClient();
  const repo = useQuery({ queryKey: ["automation-repo", projectId], queryFn: () => api.getRepository(projectId!), enabled: Boolean(projectId), retry: false });
  const groups = useIssueGroups(projectId, { limit: 100 });

  const [confirming, setConfirming] = useState(false);
  const prepare = useMutation({
    mutationFn: () => api.runFixes(projectId!),
    onSettled: () => {
      setConfirming(false);
      queryClient.invalidateQueries({ queryKey: ["automation-runs", projectId] });
      queryClient.invalidateQueries({ queryKey: ["issue-groups", projectId] });
    },
  });

  const ready = (groups.data?.groups ?? []).filter((g) => g.aiFixAvailable);
  const readyPages = ready.reduce((n, g) => n + g.affectedCount, 0);
  const connected = repo.data ?? null;

  return (
    <Panel
      title="Prepare the fixes"
      subtitle="Opens a pull request on your website's repository. Nothing is published until you review and merge it."
    >
      <div className="space-y-4 p-4">
        {repo.isLoading ? (
          <p className="text-[12px] text-brand-500">Checking your repository connection…</p>
        ) : !connected ? (
          <ConnectForm projectId={projectId} onConnected={() => queryClient.invalidateQueries({ queryKey: ["automation-repo", projectId] })} />
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2 text-[12px]">
              <Pill tone="good">Repository connected</Pill>
              <span className="font-mono text-brand-950">{connected.owner}/{connected.name}</span>
              <span className="text-brand-400">branch {connected.defaultBranch} · {connected.framework}</span>
            </div>

            <div className="rounded-lg border bg-brand-50/40 p-3">
              <p className="text-[12.5px] text-brand-950">
                {ready.length === 0
                  ? "No website fix is ready yet. Run a website audit; fixes are prepared for the problems it finds."
                  : `${count(ready.length)} kinds of problem have a fix ready, affecting ${count(readyPages)} pages.`}
              </p>
              {ready.length > 0 && (
                <ul className="mt-1.5 space-y-0.5 text-[11.5px] text-brand-600">
                  {ready.slice(0, 6).map((g) => (
                    <li key={g.groupKey}>{g.title} <span className="text-brand-400">({count(g.affectedCount)} pages)</span></li>
                  ))}
                  {ready.length > 6 && <li className="text-brand-400">and {ready.length - 6} more</li>}
                </ul>
              )}
              <p className="mt-2 text-[11px] text-brand-500">
                Only low-risk changes are prepared. Canonical tags, page structure and internal links are left to a person, and listed in the pull request so nothing is hidden.
              </p>
            </div>

            {!confirming ? (
              <ActionButton disabled={ready.length === 0 || prepare.isPending} icon={<GitPullRequest size={12} />} onClick={() => setConfirming(true)}>
                Prepare pull request
              </ActionButton>
            ) : (
              <div className="rounded-lg border border-warning-200 bg-warning-50 p-3 text-[12px] text-warning-800">
                <p>
                  This will copy <strong>{connected.owner}/{connected.name}</strong>, apply the fixes on a new branch, build the site to check it still works, and open a pull request. Your live site does not change.
                </p>
                <div className="mt-2 flex gap-2">
                  <ActionButton disabled={prepare.isPending} onClick={() => prepare.mutate()}>
                    {prepare.isPending ? "Preparing… this can take a few minutes" : "Yes, open the pull request"}
                  </ActionButton>
                  {!prepare.isPending && <button type="button" onClick={() => setConfirming(false)} className="text-[12px] text-brand-600 hover:underline">Cancel</button>}
                </div>
              </div>
            )}
            {prepare.error && <StatusNote tone="bad">{errorMessage(prepare.error)}</StatusNote>}
          </>
        )}

      </div>
    </Panel>
  );
}

export function RunCard({ run }: { run: AutomationRun }) {
  const s = RUN_STATUS[run.status];
  return (
    <div className="rounded-lg border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Pill tone={s.tone}>{s.label}</Pill>
        <span className="text-[11.5px] text-brand-500">
          {run.steps[0]?.step === "instruction" ? `Engineer: “${run.steps[0].detail ?? ""}”` : run.kind === "FIXES" ? "Website fixes" : "Content"} · {relativeTime(run.startedAt)}
        </span>
        {run.pullRequestUrl && (
          <a href={run.pullRequestUrl} target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-1 text-[12px] font-semibold text-accent-700 hover:underline">
            Review the pull request <ExternalLink size={11} />
          </a>
        )}
      </div>
      {run.error && <p className="mt-1.5 text-[12px] text-error-700">{run.error}</p>}
      {run.filesChanged.length > 0 && (
        <p className="mt-1.5 text-[11.5px] text-brand-600">{run.filesChanged.length} file(s) changed: <span className="font-mono">{run.filesChanged.slice(0, 4).join(", ")}{run.filesChanged.length > 4 ? "…" : ""}</span></p>
      )}
      {run.steps.length > 0 && (
        <ul className="mt-1.5 space-y-0.5">
          {run.steps.map((st, i) => (
            <li key={i} className="text-[11px] text-brand-500">
              <span className={st.ok ? "text-success-600" : "text-error-600"}>{st.ok ? "✓" : "✗"}</span> {st.step}{st.detail ? `: ${st.detail}` : ""}
            </li>
          ))}
        </ul>
      )}
      {run.status === "AWAITING_REVIEW" && <p className="mt-1.5 text-[11px] text-brand-400">Not live yet: it goes live only when you merge the pull request.</p>}
    </div>
  );
}

function ConnectForm({ projectId, onConnected }: { projectId: string | null; onConnected: () => void }) {
  const [owner, setOwner] = useState("");
  const [name, setName] = useState("");
  const [branch, setBranch] = useState("main");
  const [framework, setFramework] = useState("unknown");
  const [token, setToken] = useState("");
  const connect = useMutation({
    mutationFn: () => api.connectRepository(projectId!, { owner: owner.trim(), name: name.trim(), accessToken: token.trim(), defaultBranch: branch.trim() || "main", framework }),
    onSuccess: () => {
      setToken("");
      onConnected();
    },
  });
  const field = "h-9 w-full rounded-lg border bg-white px-3 text-[12.5px] outline-none focus:border-primary-500";
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        connect.mutate();
      }}
    >
      <p className="text-[12.5px] text-brand-950">Connect the GitHub repository your website is built from, so fixes can be prepared as a pull request.</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-[11px] text-brand-500">GitHub owner<input className={field} value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="acme-inc" required /></label>
        <label className="text-[11px] text-brand-500">Repository<input className={field} value={name} onChange={(e) => setName(e.target.value)} placeholder="website" required /></label>
        <label className="text-[11px] text-brand-500">Main branch<input className={field} value={branch} onChange={(e) => setBranch(e.target.value)} /></label>
        <label className="text-[11px] text-brand-500">
          Built with
          <select className={field} value={framework} onChange={(e) => setFramework(e.target.value)}>
            <option value="unknown">Not sure</option>
            <option value="nextjs">Next.js</option>
            <option value="static-html">Plain HTML</option>
          </select>
        </label>
      </div>
      <label className="block text-[11px] text-brand-500">
        GitHub access token
        <input className={field} type="password" autoComplete="off" value={token} onChange={(e) => setToken(e.target.value)} placeholder="github_pat_…" required />
      </label>
      <p className="text-[11px] text-brand-400">
        Create a fine-grained token limited to this one repository, with Contents and Pull requests set to read and write. It is stored encrypted and never shown again. You can revoke it on GitHub at any time.
      </p>
      <ActionButton disabled={connect.isPending}>{connect.isPending ? "Connecting…" : "Connect repository"}</ActionButton>
      {connect.error && <StatusNote tone="bad">{errorMessage(connect.error)}</StatusNote>}
    </form>
  );
}
