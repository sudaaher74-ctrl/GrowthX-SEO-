"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  Copy,
  ExternalLink,
  Mail,
  Plus,
  RefreshCw,
  Save,
  Sparkles,
  Trash2,
} from "lucide-react";
import { api } from "@/lib/api-client";
import type {
  BacklinkOutreachItem,
  BacklinkOutreachKind,
  BacklinkOutreachStatus,
} from "@/lib/api-types";
import { errorMessage } from "@/lib/error-message";

const STATUS_OPTIONS: Array<{ value: BacklinkOutreachStatus; label: string }> = [
  { value: "IDENTIFIED", label: "Identified" },
  { value: "DRAFTED", label: "Drafted" },
  { value: "CONTACTED", label: "Contacted" },
  { value: "RECOVERED", label: "Recovered / Won ✓" },
  { value: "DISMISSED", label: "Dismissed" },
];

export function BacklinkOutreachRecovery({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [manualUrl, setManualUrl] = useState("");
  const [manualTargetUrl, setManualTargetUrl] = useState("");
  const [manualKind, setManualKind] = useState<BacklinkOutreachKind>("LOST_LINK_RECOVERY");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "good" | "bad"; text: string } | null>(null);

  const [editDraft, setEditDraft] = useState<{
    id: string;
    contactEmail: string;
    subject: string;
    emailDraft: string;
    notes: string;
    status: BacklinkOutreachStatus;
  } | null>(null);

  const workspaceQuery = useQuery({
    queryKey: ["backlink-outreach", projectId],
    queryFn: () => api.backlinkOutreach.list(projectId),
    enabled: Boolean(projectId),
    retry: false,
  });

  const draftMutation = useMutation({
    mutationFn: (input: {
      kind: BacklinkOutreachKind;
      sourceUrl: string;
      targetUrl?: string | null;
    }) => api.backlinkOutreach.draft(projectId, input),
    onSuccess: (created) => {
      void queryClient.invalidateQueries({ queryKey: ["backlink-outreach", projectId] });
      setSelectedId(created.id);
      setEditDraft(null);
      setManualUrl("");
      setManualTargetUrl("");
      setNotice({
        tone: "good",
        text: `Generated grounded outreach draft for ${created.sourceDomain}.`,
      });
    },
    onError: (err) => setNotice({ tone: "bad", text: errorMessage(err) }),
  });

  const updateMutation = useMutation({
    mutationFn: (params: {
      id: string;
      status?: BacklinkOutreachStatus;
      contactEmail?: string | null;
      subject?: string | null;
      emailDraft?: string | null;
      notes?: string | null;
    }) =>
      api.backlinkOutreach.update(projectId, params.id, {
        status: params.status,
        contactEmail: params.contactEmail,
        subject: params.subject,
        emailDraft: params.emailDraft,
        notes: params.notes,
      }),
    onSuccess: (updated) => {
      void queryClient.invalidateQueries({ queryKey: ["backlink-outreach", projectId] });
      void queryClient.invalidateQueries({ queryKey: ["fix-impact-ledger", projectId] });
      setEditDraft(null);
      setNotice({
        tone: "good",
        text:
          updated.status === "RECOVERED"
            ? `Marked ${updated.sourceDomain} as RECOVERED & logged to your Impact Ledger and Monthly Report.`
            : `Updated outreach record for ${updated.sourceDomain}.`,
      });
    },
    onError: (err) => setNotice({ tone: "bad", text: errorMessage(err) }),
  });

  const deleteMutation = useMutation({
    mutationFn: (itemId: string) => api.backlinkOutreach.delete(projectId, itemId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["backlink-outreach", projectId] });
      setSelectedId(null);
      setEditDraft(null);
      setNotice({ tone: "good", text: "Removed outreach item." });
    },
    onError: (err) => setNotice({ tone: "bad", text: errorMessage(err) }),
  });

  const data = workspaceQuery.data;
  const items = data?.items ?? [];
  const candidates = data?.candidates ?? [];
  const activeItem: BacklinkOutreachItem | null =
    items.find((i) => i.id === selectedId) ?? items[0] ?? null;

  const editor =
    activeItem && editDraft && editDraft.id === activeItem.id
      ? editDraft
      : activeItem
        ? {
            id: activeItem.id,
            contactEmail: activeItem.contactEmail ?? "",
            subject: activeItem.subject ?? "",
            emailDraft: activeItem.emailDraft ?? "",
            notes: activeItem.notes ?? "",
            status: activeItem.status,
          }
        : null;

  const handleCopyEmail = async () => {
    if (!editor) return;
    const text = `Subject: ${editor.subject}\n\n${editor.emailDraft}`;
    await navigator.clipboard.writeText(text);
    setCopiedId(editor.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const mailtoHref = editor
    ? `mailto:${encodeURIComponent(editor.contactEmail || "")}?subject=${encodeURIComponent(
        editor.subject || "",
      )}&body=${encodeURIComponent(editor.emailDraft || "")}`
    : "#";

  return (
    <div className="space-y-5">
      {/* KPI Summary Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: "Lost-Link Candidates", value: data?.summary.lostCandidates ?? 0 },
          { label: "Competitor Gap Candidates", value: data?.summary.gapCandidates ?? 0 },
          { label: "Drafted", value: data?.summary.drafted ?? 0 },
          { label: "Contacted", value: data?.summary.contacted ?? 0 },
          { label: "Recovered / Won", value: data?.summary.recovered ?? 0 },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-xl border border-brand-200/80 bg-surface-1 p-3.5 shadow-2xs"
          >
            <p className="text-[10.5px] font-semibold uppercase tracking-wider text-brand-500">
              {card.label}
            </p>
            <p className="mt-1 font-mono text-xl font-bold text-brand-950">{card.value}</p>
          </div>
        ))}
      </div>

      {notice && (
        <div
          className={`rounded-xl border px-3.5 py-2.5 text-xs font-medium ${
            notice.tone === "good"
              ? "border-success-200 bg-success-50 text-success-800"
              : "border-error-200 bg-error-50 text-error-800"
          }`}
        >
          {notice.text}
        </div>
      )}

      {/* Auto-Discovered Candidates (Confirmed Lost Backlinks + Competitor Link Gaps) */}
      <div className="rounded-2xl border border-brand-200/80 bg-surface-1 p-5 shadow-2xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-brand-950">
              Lost-Link Recovery &amp; Competitor Gap Queue
            </h3>
            <p className="text-xs text-brand-500">
              Real lost backlinks and verified competitor referring pages detected for this project. Generate a grounded email draft in 1 click.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void workspaceQuery.refetch()}
            className="inline-flex items-center gap-1 rounded-lg border border-brand-200 bg-surface-2 px-2.5 py-1 text-xs font-semibold text-brand-800 hover:bg-surface-3 cursor-pointer"
          >
            <RefreshCw size={12} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Manual URL Add Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!manualUrl.trim()) return;
            draftMutation.mutate({
              kind: manualKind,
              sourceUrl: manualUrl.trim(),
              targetUrl: manualTargetUrl.trim() || null,
            });
          }}
          className="grid grid-cols-1 md:grid-cols-12 gap-2 rounded-xl border border-brand-200/70 bg-surface-2/60 p-3 text-xs"
        >
          <select
            value={manualKind}
            onChange={(e) => setManualKind(e.target.value as BacklinkOutreachKind)}
            className="md:col-span-3 rounded-lg border border-brand-200 bg-surface-1 px-2.5 py-1.5 font-semibold text-brand-900"
          >
            <option value="LOST_LINK_RECOVERY">Lost-Link Recovery</option>
            <option value="COMPETITOR_GAP">Competitor Gap Pitch</option>
          </select>
          <input
            type="url"
            required
            value={manualUrl}
            onChange={(e) => setManualUrl(e.target.value)}
            placeholder="Referring page URL (https://publisher.com/article)"
            className="md:col-span-4 rounded-lg border border-brand-200 bg-surface-1 px-2.5 py-1.5 font-mono text-[11px] text-brand-950"
          />
          <input
            type="url"
            value={manualTargetUrl}
            onChange={(e) => setManualTargetUrl(e.target.value)}
            placeholder="Your target URL (optional)"
            className="md:col-span-3 rounded-lg border border-brand-200 bg-surface-1 px-2.5 py-1.5 font-mono text-[11px] text-brand-950"
          />
          <button
            type="submit"
            disabled={draftMutation.isPending}
            className="md:col-span-2 inline-flex items-center justify-center gap-1 rounded-lg bg-signal-400 px-3 py-1.5 text-xs font-bold text-signal-ink hover:bg-signal-500 cursor-pointer disabled:opacity-50"
          >
            <Plus size={12} />
            <span>Draft Email</span>
          </button>
        </form>

        {candidates.length > 0 ? (
          <div className="divide-y divide-brand-200/60 rounded-xl border border-brand-200/70">
            {candidates.slice(0, 10).map((cand) => (
              <div
                key={cand.sourceUrl}
                className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 text-xs"
              >
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 font-mono text-[9.5px] font-bold border ${
                        cand.kind === "LOST_LINK_RECOVERY"
                          ? "bg-error-50 text-error-700 border-error-200"
                          : "bg-warning-50 text-warning-800 border-warning-200"
                      }`}
                    >
                      {cand.kind === "LOST_LINK_RECOVERY" ? "LOST LINK" : "COMPETITOR GAP"}
                    </span>
                    <span className="font-bold text-brand-950">{cand.sourceDomain}</span>
                    <span className="text-[11px] text-brand-500">{cand.reason}</span>
                  </div>
                  <a
                    href={cand.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-mono text-[11px] text-accent-700 hover:underline truncate max-w-full"
                  >
                    <span className="truncate">{cand.sourceUrl}</span>
                    <ExternalLink size={10} className="shrink-0" />
                  </a>
                </div>
                <button
                  type="button"
                  disabled={draftMutation.isPending}
                  onClick={() =>
                    draftMutation.mutate({
                      kind: cand.kind,
                      sourceUrl: cand.sourceUrl,
                      targetUrl: cand.targetUrl,
                    })
                  }
                  className="inline-flex items-center gap-1 rounded-lg bg-brand-950 px-3 py-1.5 text-[11px] font-bold text-brand-50 hover:bg-brand-800 cursor-pointer disabled:opacity-50 shrink-0"
                >
                  <Sparkles size={11} />
                  <span>
                    {cand.kind === "LOST_LINK_RECOVERY" ? "Draft Recovery Email" : "Draft Pitch"}
                  </span>
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-brand-500">
            No unworked lost backlinks or competitor gap URLs waiting in queue. Verify backlink sources or add any referring URL above to draft an outreach email.
          </p>
        )}
      </div>

      {/* Persisted Outreach Tracker + Email Editor */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left: Tracked Items */}
        <div className="lg:col-span-5 rounded-2xl border border-brand-200/80 bg-surface-1 overflow-hidden shadow-2xs">
          <div className="border-b border-brand-200 bg-surface-2 px-4 py-3">
            <h3 className="text-xs font-bold text-brand-950">
              Tracked Outreach Pipeline ({items.length})
            </h3>
          </div>
          {items.length === 0 ? (
            <p className="p-4 text-xs text-brand-500">
              No outreach items tracked yet. Click &ldquo;Draft Recovery Email&rdquo; on any lost link or add a referring URL above.
            </p>
          ) : (
            <div className="divide-y divide-brand-200/60 max-h-[520px] overflow-y-auto">
              {items.map((item) => {
                const selected = activeItem?.id === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setSelectedId(item.id);
                      setEditDraft(null);
                    }}
                    className={`w-full text-left px-4 py-3 transition cursor-pointer ${
                      selected ? "bg-brand-50" : "hover:bg-surface-2/60"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-xs text-brand-950 truncate">
                        {item.sourceDomain}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 font-mono text-[9.5px] font-bold border ${
                          item.status === "RECOVERED"
                            ? "bg-success-50 text-success-700 border-success-200"
                            : item.status === "CONTACTED"
                              ? "bg-primary-50 text-primary-700 border-primary-200"
                              : item.status === "DISMISSED"
                                ? "bg-surface-2 text-brand-500 border-brand-200"
                                : "bg-warning-50 text-warning-800 border-warning-200"
                        }`}
                      >
                        {item.status}
                      </span>
                    </div>
                    <p className="mt-0.5 font-mono text-[10.5px] text-brand-500 truncate">
                      {item.sourceUrl}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Active Item Editor & Mail Launcher */}
        <div className="lg:col-span-7 rounded-2xl border border-brand-200/80 bg-surface-1 p-5 shadow-2xs space-y-4">
          {!activeItem || !editor ? (
            <div className="flex h-60 items-center justify-center text-xs text-brand-400">
              Select a tracked outreach item to edit its recovery email and status.
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-brand-200/70 pb-3">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-brand-950">{activeItem.sourceDomain}</p>
                  <a
                    href={activeItem.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-mono text-[11px] text-accent-700 hover:underline"
                  >
                    <span className="truncate max-w-sm">{activeItem.sourceUrl}</span>
                    <ExternalLink size={10} />
                  </a>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={editor.status}
                    onChange={(e) =>
                      setEditDraft({
                        ...editor,
                        status: e.target.value as BacklinkOutreachStatus,
                      })
                    }
                    className="rounded-lg border border-brand-200 bg-surface-2 px-2.5 py-1 text-xs font-semibold text-brand-900"
                  >
                    {STATUS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={deleteMutation.isPending}
                    onClick={() => deleteMutation.mutate(activeItem.id)}
                    title="Delete outreach record"
                    className="rounded-lg border border-error-200 bg-error-50 p-1.5 text-error-700 hover:bg-error-100 cursor-pointer"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>

              <div className="space-y-3 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-brand-700">
                      Site Editor Contact Email
                    </label>
                    <input
                      type="email"
                      value={editor.contactEmail}
                      onChange={(e) => setEditDraft({ ...editor, contactEmail: e.target.value })}
                      placeholder="editor@publisher.com"
                      className="w-full rounded-xl border border-brand-200 bg-surface-2/60 px-3 py-2 text-xs text-brand-950"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-brand-700">
                      Email Subject Line
                    </label>
                    <input
                      type="text"
                      value={editor.subject}
                      onChange={(e) => setEditDraft({ ...editor, subject: e.target.value })}
                      className="w-full rounded-xl border border-brand-200 bg-surface-2/60 px-3 py-2 text-xs font-semibold text-brand-950"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-brand-700">
                    Grounded Outreach Email Draft
                  </label>
                  <textarea
                    rows={9}
                    value={editor.emailDraft}
                    onChange={(e) => setEditDraft({ ...editor, emailDraft: e.target.value })}
                    className="w-full rounded-xl border border-brand-200 bg-surface-2/60 p-3 font-sans text-xs leading-relaxed text-brand-950"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-brand-200/70 pt-3">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void handleCopyEmail()}
                    className="inline-flex items-center gap-1 rounded-lg border border-brand-200 bg-surface-2 px-3 py-1.5 text-xs font-semibold text-brand-900 hover:bg-surface-3 cursor-pointer"
                  >
                    {copiedId === editor.id ? (
                      <>
                        <Check size={12} className="text-success-600" />
                        <span>Copied Email</span>
                      </>
                    ) : (
                      <>
                        <Copy size={12} />
                        <span>Copy Email</span>
                      </>
                    )}
                  </button>
                  <a
                    href={mailtoHref}
                    className="inline-flex items-center gap-1 rounded-lg border border-brand-200 bg-surface-2 px-3 py-1.5 text-xs font-semibold text-accent-700 hover:bg-surface-3"
                  >
                    <Mail size={12} />
                    <span>Open in Mail Client</span>
                  </a>
                </div>

                <button
                  type="button"
                  disabled={updateMutation.isPending}
                  onClick={() =>
                    updateMutation.mutate({
                      id: editor.id,
                      status: editor.status,
                      contactEmail: editor.contactEmail || null,
                      subject: editor.subject || null,
                      emailDraft: editor.emailDraft,
                      notes: editor.notes || null,
                    })
                  }
                  className="inline-flex items-center gap-1.5 rounded-lg bg-signal-400 px-3.5 py-1.5 text-xs font-bold text-signal-ink hover:bg-signal-500 cursor-pointer disabled:opacity-50"
                >
                  <Save size={12} />
                  <span>{updateMutation.isPending ? "Saving…" : "Save Status & Draft"}</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
