"use client";
import Link from "next/link";
import { useState } from "react";
import { BookOpen, CheckCircle2, ExternalLink, FileText, GitBranch, Loader2, PenLine, Plus, Sparkles, Zap } from "lucide-react";
import { ActionButton, PageHeader, Panel, Pill, Table, Td, Th, Tr } from "@/components/ui/console";
import { type ContentPiece } from "@/lib/api-client";
import { QueryState } from "@/components/ui/query-state";
import { CreateArticleModal } from "@/components/content/create-article-modal";
import { ArticlePreviewModal } from "@/components/content/article-preview-modal";
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
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [previewPiece, setPreviewPiece] = useState<ContentPiece | null>(null);
  const [form, setForm] = useState({ owner: "", name: "", accessToken: "", defaultBranch: "main" });

  const latestStrategy = strategies.data?.[0];
  const allPieces = pieces.data ?? [];
  const drafted = allPieces.filter((p) => p.status === "DRAFTED");
  const uniqueQueries = new Set(allPieces.map((p) => p.targetQuery).filter(Boolean)).size;
  
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
        title="AI Content Studio & Auto-Publisher"
        subtitle="Generate rank-ready, GEO-optimized articles with 45-word definition blocks, comparison tables, and FAQ schema."
        actions={
          <div className="flex items-center gap-2">
            <ActionButton
              variant="primary"
              icon={<Plus size={13} />}
              onClick={() => setCreateModalOpen(true)}
              disabled={!projectId}
            >
              Create Custom Article
            </ActionButton>
            <ActionButton
              variant="secondary"
              icon={planContent.isPending ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
              onClick={() => planContent.mutate()}
              disabled={planContent.isPending || !projectId || !latestStrategy}
            >
              {planContent.isPending ? "Planning…" : "Plan from Strategy"}
            </ActionButton>
          </div>
        }
      />

      {/* 4 Studio Executive KPI Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Panel className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-brand-600 dark:text-brand-400">Total Content Pipeline</span>
            <FileText size={15} className="text-brand-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-bold text-brand-950 dark:text-brand-100">
              {allPieces.length}
            </span>
            <span className="text-xs text-brand-400">articles tracked</span>
          </div>
          <p className="mt-2 text-[11px] text-[var(--text-muted)]">
            Planned, drafted, and published content assets
          </p>
        </Panel>

        <Panel className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-brand-600 dark:text-brand-400">Ready to Publish</span>
            <CheckCircle2 size={15} className="text-emerald-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-bold text-brand-950 dark:text-brand-100">
              {drafted.length}
            </span>
            <span className="text-xs text-brand-400">/ {allPieces.length} completed</span>
            <Pill tone={drafted.length > 0 ? "good" : "default"}>
              {drafted.length > 0 ? "Ready to Ship" : "Needs Drafting"}
            </Pill>
          </div>
          <p className="mt-2 text-[11px] text-[var(--text-muted)]">
            Drafted with GEO answer blocks and Schema JSON-LD
          </p>
        </Panel>

        <Panel className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-brand-600 dark:text-brand-400">Target Queries Covered</span>
            <Zap size={15} className="text-amber-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-bold text-brand-950 dark:text-brand-100">
              {uniqueQueries}
            </span>
            <span className="text-xs text-brand-400">search intents</span>
            <Pill tone="info">High Intent</Pill>
          </div>
          <p className="mt-2 text-[11px] text-[var(--text-muted)]">
            Keywords targeted against competitor organic footprint
          </p>
        </Panel>

        <Panel className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-brand-600 dark:text-brand-400">Repository & PR Auto-Sync</span>
            <GitBranch size={15} className="text-blue-500" />
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span className="font-mono text-xs font-bold text-brand-950 dark:text-brand-100 truncate max-w-[160px]">
              {repo.data ? `${repo.data.owner}/${repo.data.name}` : "Not connected"}
            </span>
            <Pill tone={repo.data ? "good" : "warn"}>
              {repo.data ? "Connected" : "Setup Needed"}
            </Pill>
          </div>
          <p className="mt-2 text-[11px] text-[var(--text-muted)]">
            {repo.data ? `Auto-ships to ${repo.data.defaultBranch} via PR` : "Connect GitHub repo below to auto-publish"}
          </p>
        </Panel>
      </div>

      {!latestStrategy && !strategies.isLoading && (
        <div className="rounded-xl border bg-brand-50 px-4 py-2.5 text-[12px] text-brand-500" style={{ borderColor: "var(--color-line)" }}>
          No strategy generated yet — the content plan is built from it.{" "}
          <Link href="/strategy" className="font-medium text-accent-600 hover:underline">
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
                      <span className="text-[12.5px] font-medium text-brand-950">{piece.title}</span>
                    </div>
                  </Td>
                  <Td><span className="text-[12px] text-brand-500">{piece.format ?? "—"}</span></Td>
                  <Td><span className="font-mono text-[11.5px] text-brand-500">{piece.targetQuery ?? "—"}</span></Td>
                  <Td><Pill tone={STATUS_TONE[piece.status]}>{piece.status}</Pill></Td>
                  <Td align="right">
                    <div className="flex items-center justify-end gap-1.5">
                      {piece.status === "DRAFTED" && (
                        <>
                          <ActionButton
                            variant="secondary"
                            icon={<BookOpen size={11} className="text-accent-600" />}
                            onClick={() => setPreviewPiece(piece)}
                          >
                            Preview & Read
                          </ActionButton>
                          <ActionButton
                            icon={draftContent.isPending ? <Loader2 size={11} className="animate-spin" /> : <PenLine size={11} />}
                            onClick={() => draftContent.mutate(piece.id)}
                            disabled={draftContent.isPending}
                          >
                            Re-draft
                          </ActionButton>
                        </>
                      )}
                      {piece.status === "PLANNED" && (
                        <ActionButton
                          variant="primary"
                          icon={draftContent.isPending ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
                          onClick={() => draftContent.mutate(piece.id)}
                          disabled={draftContent.isPending}
                        >
                          Draft Article
                        </ActionButton>
                      )}
                      {(piece.status === "COMMITTED" || piece.status === "PUBLISHED") && (
                        <ActionButton
                          variant="secondary"
                          icon={<BookOpen size={11} />}
                          onClick={() => setPreviewPiece(piece)}
                        >
                          View Article
                        </ActionButton>
                      )}
                    </div>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </Panel>
      </QueryState>

      
      {runContent.data && (
        <div className="rounded-xl border bg-success-50 px-4 py-3 text-[12.5px] text-success-700" style={{ borderColor: "var(--color-success-50)" }}>
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
            <p className="text-[12.5px] text-brand-700">
              Drafted pages are committed to a new branch and opened as a pull request against{" "}
              <span className="font-mono text-[11.5px]">{repo.data.defaultBranch}</span>. Nothing publishes without a review.
            </p>
          ) : !showConnect ? (
            <div className="text-center">
              <p className="text-[12.5px] text-brand-500">Connect this client&apos;s website repository to ship drafted pages as a PR.</p>
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
                  <Td><span className="text-[12px] text-brand-700">{run.kind}</span></Td>
                  <Td><Pill tone={run.status === "AWAITING_REVIEW" ? "good" : run.status === "FAILED" ? "bad" : "info"}>{run.status}</Pill></Td>
                  <Td><span className="text-[11.5px] text-brand-500">{run.filesChanged.length}</span></Td>
                  <Td align="right">
                    {run.pullRequestUrl && (
                      <a href={run.pullRequestUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11.5px] font-medium text-accent-600 hover:underline">
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

      {/* Modals */}
      {createModalOpen && projectId && (
        <CreateArticleModal
          projectId={projectId}
          onClose={() => setCreateModalOpen(false)}
        />
      )}

      {previewPiece && (
        <ArticlePreviewModal
          piece={previewPiece}
          repoConnected={Boolean(repo.data)}
          onClose={() => setPreviewPiece(null)}
          onShip={(pieceId) => {
            runContent.mutate([pieceId]);
            setPreviewPiece(null);
          }}
        />
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
      <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-brand-400">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full rounded-lg border px-2.5 py-1.5 text-[12.5px] text-brand-950"
        style={{ borderColor: "var(--color-line)" }}
      />
    </label>
  );
}
