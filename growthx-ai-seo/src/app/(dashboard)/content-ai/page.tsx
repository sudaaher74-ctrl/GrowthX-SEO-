"use client";
import Link from "next/link";
import { useState } from "react";
import { ExternalLink, GitBranch, Loader2, PenLine, Sparkles } from "lucide-react";
import { ActionButton, PageHeader, Panel, Pill, Table, Td, Th, Tr } from "@/components/ui/console";
import { QueryState, UpgradePrompt } from "@/components/ui/upgrade-prompt";
import { ApiError } from "@/lib/api-client";
import {
  useAutomationRuns,
  useConnectRepository,
  useContentPieces,
  useDraftContent,
  usePlanContent,
  useRepository,
  useRunContent,
  useStrategies,
  useWorkspace,
} from "@/hooks/use-growthx";

const STATUS_TONE = { PLANNED: "default", DRAFTED: "info", COMMITTED: "good", PUBLISHED: "good", REJECTED: "bad" } as const;

export default function ContentAiPage() {
  const { projectId } = useWorkspace();
  const strategies = useStrategies(projectId);
  const pieces = useContentPieces(projectId);
  const repo = useRepository(projectId);
  const runs = useAutomationRuns(projectId);

  const planContent = usePlanContent(projectId);
  const draftContent = useDraftContent(projectId);
  const runContent = useRunContent(projectId);
  const connectRepo = useConnectRepository(projectId);

  const [selected, setSelected] = useState<string[]>([]);
  const [showConnect, setShowConnect] = useState(false);
  const [form, setForm] = useState({ owner: "", name: "", accessToken: "", defaultBranch: "main" });

  const latestStrategy = strategies.data?.[0];
  const drafted = (pieces.data ?? []).filter((p) => p.status === "DRAFTED");
  const upgrade = runContent.error instanceof ApiError ? runContent.error.upgrade : null;

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function handleConnect() {
    if (!form.owner || !form.name || !form.accessToken) return;
    await connectRepo.mutateAsync(form);
    setShowConnect(false);
    setForm({ owner: "", name: "", accessToken: "", defaultBranch: "main" });
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Content AI"
        subtitle="Plan, draft, and ship pages targeted at the prompts competitors are winning"
        actions={
          <ActionButton
            variant="primary"
            icon={planContent.isPending ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
            onClick={() => planContent.mutate()}
            disabled={planContent.isPending || !projectId || !latestStrategy}
          >
            {planContent.isPending ? "Planning…" : "Plan from strategy"}
          </ActionButton>
        }
      />

      {!latestStrategy && !strategies.isLoading && (
        <div className="rounded-xl border bg-[#fafafa] px-4 py-2.5 text-[12px] text-[#71717a]" style={{ borderColor: "#e5e7eb" }}>
          No strategy generated yet — the content plan is built from it.{" "}
          <Link href="/strategy" className="font-medium text-[#2563eb] hover:underline">
            Generate a strategy →
          </Link>
        </div>
      )}

      {planContent.error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-[12px] text-red-700">
          {(planContent.error as Error).message}
        </div>
      )}

      <QueryState
        isLoading={pieces.isLoading}
        error={pieces.error}
        isEmpty={!pieces.data?.length}
        emptyTitle="No content pieces yet"
        emptyBody="Plan from the latest strategy to queue pieces, then draft and ship them."
      >
        <Panel
          title="Content pieces"
          subtitle={`${pieces.data?.length ?? 0} total · ${drafted.length} ready to ship`}
          actions={
            drafted.length > 0 && (
              <ActionButton
                variant="primary"
                icon={runContent.isPending ? <Loader2 size={12} className="animate-spin" /> : <GitBranch size={12} />}
                onClick={() => runContent.mutate(selected.length ? selected : undefined)}
                disabled={runContent.isPending || !repo.data}
              >
                {runContent.isPending ? "Opening PR…" : `Ship ${selected.length || drafted.length} page(s)`}
              </ActionButton>
            )
          }
        >
          <Table minWidth={760}>
            <thead>
              <tr>
                <Th>Piece</Th>
                <Th>Format</Th>
                <Th>Target query</Th>
                <Th>Status</Th>
                <Th align="right">Action</Th>
              </tr>
            </thead>
            <tbody>
              {pieces.data?.map((piece) => (
                <Tr key={piece.id}>
                  <Td>
                    <div className="flex items-center gap-2">
                      {piece.status === "DRAFTED" && (
                        <input
                          type="checkbox"
                          checked={selected.includes(piece.id)}
                          onChange={() => toggle(piece.id)}
                          className="h-3.5 w-3.5"
                        />
                      )}
                      <span className="text-[12.5px] font-medium text-[#09090b]">{piece.title}</span>
                    </div>
                  </Td>
                  <Td><span className="text-[12px] text-[#71717a]">{piece.format ?? "—"}</span></Td>
                  <Td><span className="font-mono text-[11.5px] text-[#71717a]">{piece.targetQuery ?? "—"}</span></Td>
                  <Td><Pill tone={STATUS_TONE[piece.status]}>{piece.status}</Pill></Td>
                  <Td align="right">
                    {piece.status === "PLANNED" && (
                      <ActionButton
                        icon={draftContent.isPending ? <Loader2 size={11} className="animate-spin" /> : <PenLine size={11} />}
                        onClick={() => draftContent.mutate(piece.id)}
                        disabled={draftContent.isPending}
                      >
                        Draft
                      </ActionButton>
                    )}
                    {piece.status === "COMMITTED" && piece.filePath && (
                      <span className="font-mono text-[11px] text-[#a1a1aa]">{piece.filePath}</span>
                    )}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </Panel>
      </QueryState>

      {upgrade && <UpgradePrompt upgrade={upgrade} />}

      {runContent.data && (
        <div className="rounded-xl border bg-[#ecfdf5] px-4 py-3 text-[12.5px] text-[#047857]" style={{ borderColor: "#a7f3d0" }}>
          {runContent.data.status === "AWAITING_REVIEW" ? (
            <>
              Pull request opened with {runContent.data.filesChanged.length} page(s).{" "}
              {runContent.data.pullRequestUrl && (
                <a href={runContent.data.pullRequestUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium hover:underline">
                  View PR <ExternalLink size={11} />
                </a>
              )}
            </>
          ) : (
            runContent.data.error ?? "Run failed."
          )}
        </div>
      )}

      <Panel title="Repository" subtitle={repo.data ? `${repo.data.owner}/${repo.data.name} · ${repo.data.defaultBranch}` : "Not connected"}>
        <div className="p-4">
          {repo.data ? (
            <p className="text-[12.5px] text-[#3f3f46]">
              Drafted pages are committed to a new branch and opened as a pull request against{" "}
              <span className="font-mono text-[11.5px]">{repo.data.defaultBranch}</span>. Nothing publishes without a review.
            </p>
          ) : !showConnect ? (
            <div className="text-center">
              <p className="text-[12.5px] text-[#71717a]">Connect this client&apos;s website repository to ship drafted pages as a PR.</p>
              <ActionButton className="mt-3" icon={<GitBranch size={12} />} onClick={() => setShowConnect(true)}>
                Connect repository
              </ActionButton>
            </div>
          ) : (
            <div className="max-w-md space-y-2.5">
              <div className="grid grid-cols-2 gap-2.5">
                <Field label="Owner" value={form.owner} onChange={(v) => setForm((f) => ({ ...f, owner: v }))} placeholder="acme-inc" />
                <Field label="Repo name" value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} placeholder="website" />
              </div>
              <Field label="Default branch" value={form.defaultBranch} onChange={(v) => setForm((f) => ({ ...f, defaultBranch: v }))} />
              <Field
                label="GitHub access token"
                value={form.accessToken}
                onChange={(v) => setForm((f) => ({ ...f, accessToken: v }))}
                placeholder="ghp_… (Contents: Read and write)"
                type="password"
              />
              {connectRepo.error && <p className="text-[11.5px] text-red-600">{(connectRepo.error as Error).message}</p>}
              <div className="flex gap-2 pt-1">
                <ActionButton
                  variant="primary"
                  onClick={handleConnect}
                  disabled={connectRepo.isPending || !form.owner || !form.name || !form.accessToken}
                >
                  {connectRepo.isPending ? "Connecting…" : "Connect"}
                </ActionButton>
                <ActionButton onClick={() => setShowConnect(false)}>Cancel</ActionButton>
              </div>
            </div>
          )}
        </div>
      </Panel>

      {(runs.data?.length ?? 0) > 0 && (
        <Panel title="Run history" subtitle={`${runs.data?.length} run(s)`}>
          <Table minWidth={640}>
            <thead>
              <tr>
                <Th>Kind</Th>
                <Th>Status</Th>
                <Th>Files</Th>
                <Th align="right">PR</Th>
              </tr>
            </thead>
            <tbody>
              {runs.data?.map((run) => (
                <Tr key={run.id}>
                  <Td><span className="text-[12px] text-[#3f3f46]">{run.kind}</span></Td>
                  <Td><Pill tone={run.status === "AWAITING_REVIEW" ? "good" : run.status === "FAILED" ? "bad" : "info"}>{run.status}</Pill></Td>
                  <Td><span className="text-[11.5px] text-[#71717a]">{run.filesChanged.length}</span></Td>
                  <Td align="right">
                    {run.pullRequestUrl && (
                      <a href={run.pullRequestUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11.5px] font-medium text-[#2563eb] hover:underline">
                        View <ExternalLink size={10} />
                      </a>
                    )}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </Panel>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[#a1a1aa]">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full rounded-lg border px-2.5 py-1.5 text-[12.5px] text-[#09090b]"
        style={{ borderColor: "#e5e7eb" }}
      />
    </label>
  );
}
