"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Pencil, X, Check, AlertTriangle } from "lucide-react";
import { Panel, ActionButton, Pill } from "@/components/ui/console";
import { LoadingState } from "@/components/ui/truthful-state";
import { api, CompetitorSetupInput, TrackedCompetitor } from "@/lib/api-client";
import { errorMessage } from "@/lib/error-message";

const EMPTY: CompetitorSetupInput = {
  businessName: "",
  websiteUrl: "",
  mapsName: "",
  youtubeUrl: "",
  instagramHandle: "",
  industry: "",
  city: "",
};

/**
 * Adding, editing and removing the competitors a project tracks.
 *
 * Only the website is required. Every other field improves one surface of the
 * comparison and the form says which, so an operator can see what a blank
 * costs them rather than filling seven boxes on faith.
 */
export function CompetitorSetup({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<CompetitorSetupInput>(EMPTY);
  const [error, setError] = useState<string | null>(null);

  const list = useQuery({
    queryKey: ["action-engine-competitors", projectId],
    queryFn: () => api.actionEngineCompetitors(projectId),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["action-engine-competitors", projectId] });
    qc.invalidateQueries({ queryKey: ["action-engine-overview", projectId] });
  };

  const add = useMutation({
    mutationFn: (body: CompetitorSetupInput) => api.actionEngineAddCompetitor(projectId, body),
    onSuccess: () => {
      setAdding(false);
      setDraft(EMPTY);
      setError(null);
      invalidate();
    },
    onError: (err) => setError(errorMessage(err)),
  });

  const update = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<CompetitorSetupInput> }) =>
      api.actionEngineUpdateCompetitor(projectId, id, body),
    onSuccess: () => {
      setEditingId(null);
      setDraft(EMPTY);
      setError(null);
      invalidate();
    },
    onError: (err) => setError(errorMessage(err)),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.actionEngineRemoveCompetitor(projectId, id),
    onSuccess: invalidate,
    onError: (err) => setError(errorMessage(err)),
  });

  if (list.isLoading) return <LoadingState title="Loading competitors" />;

  const data = list.data;
  const full = (data?.slotsUsed ?? 0) >= (data?.slotsTotal ?? 5);

  function startEdit(competitor: TrackedCompetitor) {
    setEditingId(competitor.id);
    setAdding(false);
    setError(null);
    setDraft({
      businessName: competitor.name ?? "",
      websiteUrl: competitor.domain,
      mapsName: competitor.mapsName ?? "",
      youtubeUrl: competitor.youtubeUrl ?? "",
      instagramHandle: competitor.instagramHandle ?? "",
      industry: competitor.industry ?? "",
      city: competitor.city ?? "",
    });
  }

  return (
    <Panel
      title="Competitors you track"
      subtitle={`${data?.slotsUsed ?? 0} of ${data?.slotsTotal ?? 5} slots used. Only the website is required.`}
    >
      {error && (
        <div className="mb-3 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2.5">
          <AlertTriangle size={14} className="mt-0.5 shrink-0 text-red-500" />
          <p className="text-[12px] leading-relaxed text-red-800">{error}</p>
        </div>
      )}

      <div className="space-y-2 py-1">
        {(data?.competitors ?? []).map((competitor) =>
          editingId === competitor.id ? (
            <CompetitorForm
              key={competitor.id}
              draft={draft}
              setDraft={setDraft}
              lockWebsite
              busy={update.isPending}
              onCancel={() => {
                setEditingId(null);
                setError(null);
              }}
              onSubmit={() => update.mutate({ id: competitor.id, body: draft })}
            />
          ) : (
            <div
              key={competitor.id}
              className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-[var(--border-color)] px-3 py-2.5"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[13px] font-semibold text-[var(--text-primary)]">
                    {competitor.name || competitor.domain}
                  </span>
                  <span className="font-mono text-[11px] text-[var(--text-muted)]">{competitor.domain}</span>
                  {competitor.city && <Pill>{competitor.city}</Pill>}
                </div>
                <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-[var(--text-muted)]">
                  <ChannelState label="Maps" value={competitor.mapsName} />
                  <ChannelState label="YouTube" value={competitor.youtubeUrl} />
                  <ChannelState label="Instagram" value={competitor.instagramHandle} />
                  <span>
                    {competitor.lastAnalyzedAt
                      ? `crawled ${new Date(competitor.lastAnalyzedAt).toISOString().slice(0, 10)}`
                      : "not crawled yet"}
                  </span>
                </div>
              </div>
              <div className="flex shrink-0 gap-1">
                <button
                  onClick={() => startEdit(competitor)}
                  title="Edit"
                  className="rounded-md bg-[var(--surface-2)] p-1.5 text-[var(--text-muted)] hover:bg-[var(--surface-3)]"
                >
                  <Pencil size={12} />
                </button>
                <button
                  onClick={() => {
                    if (confirm(`Stop tracking ${competitor.name || competitor.domain}?`)) {
                      remove.mutate(competitor.id);
                    }
                  }}
                  title="Remove"
                  disabled={remove.isPending}
                  className="rounded-md bg-[var(--surface-2)] p-1.5 text-red-500 hover:bg-red-50"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ),
        )}

        {adding && (
          <CompetitorForm
            draft={draft}
            setDraft={setDraft}
            busy={add.isPending}
            onCancel={() => {
              setAdding(false);
              setError(null);
            }}
            onSubmit={() => add.mutate(draft)}
          />
        )}

        {!adding && !editingId && (
          <ActionButton
            variant="secondary"
            icon={<Plus size={13} />}
            disabled={full}
            onClick={() => {
              setDraft(EMPTY);
              setAdding(true);
              setError(null);
            }}
          >
            {full ? "All 5 slots used" : "Add competitor"}
          </ActionButton>
        )}
      </div>
    </Panel>
  );
}

/** Says what a blank field costs, rather than just that it is blank. */
function ChannelState({ label, value }: { label: string; value: string | null }) {
  if (value) return <span className="text-emerald-600 dark:text-emerald-400">{label} ✓</span>;
  return (
    <span title={`Without this, ${label} is left out of the comparison for this competitor`}>
      {label} —
    </span>
  );
}

function CompetitorForm({
  draft,
  setDraft,
  onSubmit,
  onCancel,
  busy,
  lockWebsite,
}: {
  draft: CompetitorSetupInput;
  setDraft: (value: CompetitorSetupInput) => void;
  onSubmit: () => void;
  onCancel: () => void;
  busy: boolean;
  lockWebsite?: boolean;
}) {
  const field = (
    key: keyof CompetitorSetupInput,
    label: string,
    placeholder: string,
    hint?: string,
    disabled?: boolean,
  ) => (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-semibold text-[var(--text-secondary)]">{label}</span>
      <input
        value={draft[key] ?? ""}
        disabled={disabled}
        onChange={(event) => setDraft({ ...draft, [key]: event.target.value })}
        placeholder={placeholder}
        className="rounded-lg border border-[var(--border-color)] bg-[var(--surface-1)] px-3 py-2 text-[13px] text-[var(--text-primary)] disabled:opacity-60"
      />
      {hint && <span className="text-[10.5px] text-[var(--text-muted)]">{hint}</span>}
    </label>
  );

  return (
    <div className="rounded-lg border border-blue-300 bg-blue-50/30 px-3 py-3 dark:bg-blue-950/10">
      <div className="grid gap-3 sm:grid-cols-2">
        {field(
          "websiteUrl",
          "Website *",
          "countrydelight.in",
          lockWebsite
            ? "The website identifies the competitor and cannot be changed. Remove and re-add to track a different company."
            : "Required. Everything else is optional.",
          lockWebsite,
        )}
        {field("businessName", "Business name", "Country Delight")}
        {field("mapsName", "Google Maps name", "Country Delight Mumbai", "Needed for the local comparison.")}
        {field("city", "City or service area", "Mumbai", "Makes the local comparison meaningful.")}
        {field("youtubeUrl", "YouTube channel", "@countrydelight", "Needed for video cadence findings.")}
        {field(
          "instagramHandle",
          "Instagram handle",
          "@countrydelight",
          "Business or Creator accounts only — personal accounts cannot be read by any approved API.",
        )}
        {field("industry", "Industry", "Dairy delivery")}
      </div>

      <div className="mt-3 flex gap-2">
        <ActionButton
          variant="primary"
          icon={<Check size={13} />}
          disabled={busy || !draft.websiteUrl?.trim()}
          onClick={onSubmit}
        >
          {busy ? "Saving…" : "Save"}
        </ActionButton>
        <ActionButton variant="secondary" icon={<X size={13} />} onClick={onCancel}>
          Cancel
        </ActionButton>
      </div>
    </div>
  );
}
