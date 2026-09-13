"use client";
import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, PlayCircle, Wifi, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api-client";
import type {
  DesignFitScore,
  DesignSuggestion,
  PublishedChange,
  PublishMethod,
} from "@/lib/api-client";
import { errorMessage } from "@/lib/error-message";
import {
  useDesignPublishedChanges,
  useDesignStudioHistory,
  useDesignStudioOverview,
  useDesignSuggestions,
  useSnapshotHtml,
  useWorkspace,
} from "@/hooks/use-growthx";
import { Kpi, PageHeader, Tabs } from "@/components/ui/console";
import { NotConfiguredState } from "@/components/ui/truthful-state";
import { SuggestionsPanel } from "@/components/design-studio/suggestions-panel";
import { WebsitePreview } from "@/components/design-studio/website-preview";
import { ChangeInspector } from "@/components/design-studio/change-inspector";
import { ContentEditorModal } from "@/components/design-studio/content-editor-modal";
import { ApprovalModal } from "@/components/design-studio/approval-modal";
import { PublishedChangesTab } from "@/components/design-studio/published-changes-tab";
import { ChangeHistoryTab } from "@/components/design-studio/change-history-tab";

/**
 * Design Studio — review an AI content change against the customer's real page
 * before it ships.
 *
 * Three columns on desktop, stacked on narrow screens in the order a reviewer
 * works: pick a suggestion, look at it on the page, decide. Selection lives
 * here because all three columns render the same suggestion, and the in-flight
 * edit lives here too so the preview shows what the approval modal will send.
 */

type TabId = "suggestions" | "preview" | "published" | "history";

const TABS: Array<{ id: TabId; label: string }> = [
  { id: "suggestions", label: "Suggestions" },
  { id: "preview", label: "Page Preview" },
  { id: "published", label: "Published Changes" },
  { id: "history", label: "Change History" },
];

export default function DesignStudioPage() {
  const { projectId, projects } = useWorkspace();
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<TabId>("suggestions");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [score, setScore] = useState<DesignFitScore | null>(null);
  const [draft, setDraft] = useState<{ heading: string; body: string } | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [approvalOpen, setApprovalOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyChangeId, setBusyChangeId] = useState<string | null>(null);

  const overview = useDesignStudioOverview(projectId);
  const suggestions = useDesignSuggestions(projectId);
  const published = useDesignPublishedChanges(projectId);
  const history = useDesignStudioHistory(projectId);

  const selected = useMemo(
    () => suggestions.data?.find((s) => s.id === selectedId) ?? null,
    [suggestions.data, selectedId],
  );

  const snapshot = useSnapshotHtml(projectId, selected?.pageSnapshotId ?? null);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["design-studio"] });

  // ── Mutations ───────────────────────────────────────────────────────────

  const analyzeMut = useMutation({
    mutationFn: () => api.designStudio.analyze(projectId!),
    onSuccess: invalidate,
    onError: (e) => setActionError(errorMessage(e)),
  });

  const previewMut = useMutation({
    mutationFn: (input: { suggestionId: string; heading?: string; body?: string }) =>
      api.designStudio.preview(projectId!, input),
    onSuccess: (result) => {
      setScore(result.score);
      invalidate();
    },
    onError: (e) => setActionError(errorMessage(e)),
  });

  const approveMut = useMutation({
    mutationFn: async (method: PublishMethod) => {
      await api.designStudio.approve(projectId!, {
        suggestionId: selected!.id,
        publishMethod: method,
      });
      // Approval and publishing are separate records on the backend; the modal
      // presents them as one decision, so the publish follows immediately.
      return api.designStudio.publish(projectId!, selected!.id);
    },
    onSuccess: (change) => {
      invalidate();
      setApprovalOpen(false);
      // A publish that failed is reported, not swallowed behind a closed modal.
      if (change.status === "FAILED" && change.error) {
        setActionError(change.error);
        setTab("published");
      }
    },
    onError: (e) => setActionError(errorMessage(e)),
  });

  const verifyMut = useMutation({
    mutationFn: (change: PublishedChange) => api.designStudio.verify(projectId!, change.id),
    onSuccess: invalidate,
    onError: (e) => setActionError(errorMessage(e)),
    onSettled: () => setBusyChangeId(null),
  });

  const rollbackMut = useMutation({
    mutationFn: (change: PublishedChange) => api.designStudio.rollback(projectId!, change.id),
    onSuccess: invalidate,
    onError: (e) => setActionError(errorMessage(e)),
    onSettled: () => setBusyChangeId(null),
  });

  // ── Handlers ────────────────────────────────────────────────────────────

  function selectSuggestion(suggestion: DesignSuggestion) {
    setSelectedId(suggestion.id);
    // A score belongs to one suggestion; carrying it across would label the
    // next change with the previous one's fit.
    setScore(null);
    setDraft(null);
    setActionError(null);
    previewMut.mutate({ suggestionId: suggestion.id });
  }

  function saveEdit(next: { heading: string; body: string }) {
    setDraft(next);
    setEditorOpen(false);
    if (selected) {
      previewMut.mutate({ suggestionId: selected.id, heading: next.heading, body: next.body });
    }
  }

  // ── Empty states before anything can render ─────────────────────────────

  if (!projectId) {
    return (
      <div className="p-6">
        <NotConfiguredState
          title={projects.length === 0 ? "No project yet" : "No project selected"}
          missing={
            projects.length === 0
              ? "Design Studio reviews changes against a specific website, and this workspace has none."
              : "Choose a project in the sidebar to review its content changes."
          }
          whyItMatters="Every suggestion, preview and published change belongs to one project's website."
          actionRequired={projects.length === 0 ? "Add a project to get started." : "Pick a project."}
          action={{ label: "Go to Projects", href: "/clients" }}
        />
      </div>
    );
  }

  const counts = overview.data?.counts;
  const connection = overview.data?.connection;
  const lastSnapshot = overview.data?.lastSnapshot;

  return (
    <div className="min-h-screen bg-brand-50">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="border-b bg-white px-4 py-4 sm:px-6">
        <nav aria-label="Breadcrumb" className="mb-2 text-[11px] text-brand-400">
          AI SEO <span className="mx-1">/</span>
          <span className="text-brand-600">Design Studio</span>
        </nav>

        <PageHeader
          title="Design Studio"
          subtitle="Review and refine AI-generated content changes before publishing to your website."
          actions={
            <>
              <ConnectionBadge
                connected={Boolean(connection?.connected)}
                target={connection?.target ?? null}
                loading={overview.isLoading}
              />
              <button
                type="button"
                onClick={() => analyzeMut.mutate()}
                disabled={analyzeMut.isPending}
                className="inline-flex items-center gap-1.5 rounded-lg border bg-white px-3 py-1.5 text-[12px] font-medium text-brand-600 transition hover:bg-brand-50 disabled:opacity-60"
              >
                {analyzeMut.isPending ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <PlayCircle size={13} />
                )}
                {analyzeMut.isPending ? "Analysing…" : "Analyse page"}
              </button>
              <a
                href="/help"
                className="inline-flex items-center gap-1.5 rounded-lg border bg-white px-3 py-1.5 text-[12px] font-medium text-brand-600 transition hover:bg-brand-50"
              >
                <PlayCircle size={13} />
                How Design Studio works
              </a>
            </>
          }
        />

        <p className="mt-2 font-mono text-[10.5px] text-brand-400">
          {lastSnapshot
            ? `Last snapshot ${new Date(lastSnapshot.capturedAt).toLocaleString()} · ${lastSnapshot.pageUrl}`
            : "No page snapshot captured yet"}
        </p>
      </div>

      <div className="space-y-4 p-4 sm:p-6">
        {/* ── Summary cards ─────────────────────────────────────────────── */}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi
            label="Suggestions"
            value={countText(counts?.suggestions, overview.isLoading)}
            sub="AI-generated improvements"
          />
          <Kpi
            label="Safe to Publish"
            value={countText(counts?.safeToPublish, overview.isLoading)}
            sub="Low risk, good design fit"
            tone="good"
          />
          <Kpi
            label="Need Review"
            value={countText(counts?.needReview, overview.isLoading)}
            sub="Check accuracy or brand fit"
          />
          <Kpi
            label="Published"
            value={countText(counts?.published, overview.isLoading)}
            sub="Live on your website"
          />
        </div>

        {/* ── Tabs ──────────────────────────────────────────────────────── */}
        <Tabs tabs={TABS} active={tab} onChange={setTab} />

        {actionError && (
          <p
            role="alert"
            className="rounded-xl border border-error-200 bg-error-50 px-3 py-2 text-[11.5px] text-error-700"
          >
            {actionError}
          </p>
        )}

        {/* ── Panels ────────────────────────────────────────────────────── */}
        {(tab === "suggestions" || tab === "preview") && (
          // Stacks on narrow screens in working order: list, preview,
          // inspector. The inspector's own action bar is sticky, so the
          // primary action stays reachable once stacked.
          <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)_340px]">
            <div className={cn("min-h-[420px] lg:h-[calc(100vh-320px)]", tab === "preview" && "hidden lg:block")}>
              <SuggestionsPanel
                suggestions={suggestions.data ?? []}
                isLoading={suggestions.isLoading}
                error={suggestions.error}
                selectedId={selectedId}
                onSelect={selectSuggestion}
              />
            </div>

            <div className="min-h-[520px] lg:h-[calc(100vh-320px)]">
              <WebsitePreview
                suggestion={selected}
                html={snapshot.data?.html ?? null}
                pageUrl={snapshot.data?.pageUrl ?? selected?.pageSnapshot?.pageUrl ?? null}
                isLoading={Boolean(selected) && snapshot.isLoading}
                error={snapshot.error}
                onRefresh={() => snapshot.refetch()}
                draftHeading={draft?.heading}
                draftBody={draft?.body}
              />
            </div>

            <div className="min-h-[480px] lg:h-[calc(100vh-320px)]">
              <ChangeInspector
                suggestion={selected}
                score={score}
                isScoring={previewMut.isPending}
                draftHeading={draft?.heading}
                draftBody={draft?.body}
                onEdit={() => setEditorOpen(true)}
                onRegenerate={() =>
                  setActionError(
                    "Generating another version needs a content slot chosen on the page. Analyse the page first, then generate from a slot.",
                  )
                }
                onCompare={() => setTab("preview")}
                onApprove={() => {
                  setActionError(null);
                  setApprovalOpen(true);
                }}
              />
            </div>
          </div>
        )}

        {tab === "published" && (
          <PublishedChangesTab
            changes={published.data ?? []}
            isLoading={published.isLoading}
            error={published.error}
            busyId={busyChangeId}
            onView={(change) => {
              const match = suggestions.data?.find((s) => s.id === change.suggestionId);
              if (match) {
                selectSuggestion(match);
                setTab("suggestions");
              }
            }}
            onVerify={(change) => {
              setBusyChangeId(change.id);
              verifyMut.mutate(change);
            }}
            onRollback={(change) => {
              setBusyChangeId(change.id);
              rollbackMut.mutate(change);
            }}
          />
        )}

        {tab === "history" && (
          <ChangeHistoryTab
            events={history.data ?? []}
            isLoading={history.isLoading}
            error={history.error}
          />
        )}
      </div>

      {/* ── Modals ──────────────────────────────────────────────────────── */}
      {editorOpen && selected && (
        <ContentEditorModal
          suggestion={selected}
          initialHeading={draft?.heading ?? selected.heading ?? ""}
          initialBody={draft?.body ?? selected.body}
          isSaving={previewMut.isPending}
          onClose={() => setEditorOpen(false)}
          onSave={saveEdit}
        />
      )}

      {approvalOpen && selected && (
        <ApprovalModal
          suggestion={selected}
          score={score}
          pageUrl={snapshot.data?.pageUrl ?? selected.pageSnapshot?.pageUrl ?? null}
          hasRepository={Boolean(connection?.connected)}
          isSubmitting={approveMut.isPending}
          error={actionError}
          draftHeading={draft?.heading}
          draftBody={draft?.body}
          onClose={() => setApprovalOpen(false)}
          onConfirm={(method) => approveMut.mutate(method)}
        />
      )}
    </div>
  );
}

function ConnectionBadge({
  connected,
  target,
  loading,
}: {
  connected: boolean;
  target: string | null;
  loading: boolean;
}) {
  if (loading) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-lg border bg-white px-2.5 py-1.5 text-[11.5px] text-brand-400">
        <Loader2 size={12} className="animate-spin" />
        Checking connection
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11.5px] font-medium",
        connected ? "bg-success-50 text-success-700" : "bg-brand-50 text-brand-500",
      )}
      title={target ?? undefined}
    >
      {connected ? <Wifi size={12} /> : <WifiOff size={12} />}
      {connected ? "Connected to live site" : "No publishing target"}
    </span>
  );
}

/**
 * A count, or an em dash while it is loading.
 *
 * Never a zero in place of "not loaded yet": on a screen whose whole job is
 * honesty about what is and is not known, "0 suggestions" and "we have not
 * fetched them" must not look the same.
 */
function countText(value: number | undefined, loading: boolean): string {
  if (loading || value === undefined) return "\u2014";
  return String(value);
}
