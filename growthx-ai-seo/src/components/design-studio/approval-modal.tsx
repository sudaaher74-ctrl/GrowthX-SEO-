"use client";
import { useEffect, useState } from "react";
import { AlertTriangle, GitPullRequest, Loader2, Rocket, Send, X, FileEdit } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DesignFitScore, DesignSuggestion, PublishMethod } from "@/lib/api-client";
import { DesignFitBadge } from "./design-fit-ring";

/**
 * The last screen before a customer's page changes.
 *
 * It restates what is about to happen in full — the page, the old text, the
 * new text, the score and the risks — because approving is the point of no
 * return, and a reviewer who has been clicking through suggestions needs one
 * deliberate stop.
 *
 * Publishing methods are listed with what each one actually does. "Publish
 * directly" is disabled unless the project has a connected target, rather than
 * offered and then failing after the click.
 */

const METHODS: Array<{
  id: PublishMethod;
  label: string;
  description: string;
  Icon: React.ElementType;
  /** Whether reaching this target needs a connected repository. */
  needsRepository: boolean;
}> = [
  {
    id: "GITHUB_PR",
    label: "Create GitHub Pull Request",
    description: "Opens a PR with the content diff and this review attached. A human merges it.",
    Icon: GitPullRequest,
    needsRepository: true,
  },
  {
    id: "CMS_DRAFT",
    label: "Save CMS Draft",
    description: "Saves as an unpublished draft for an editor to review in your CMS.",
    Icon: FileEdit,
    needsRepository: false,
  },
  {
    id: "DEVELOPER_HANDOFF",
    label: "Send to Developer",
    description: "Records the change with its diff and screenshots for a developer to apply.",
    Icon: Send,
    needsRepository: false,
  },
  {
    id: "DIRECT",
    label: "Publish Directly",
    description: "Writes straight to the live site. Only available on projects configured for it.",
    Icon: Rocket,
    needsRepository: true,
  },
];

export function ApprovalModal({
  suggestion,
  score,
  pageUrl,
  hasRepository,
  isSubmitting,
  error,
  onClose,
  onConfirm,
  draftHeading,
  draftBody,
}: {
  suggestion: DesignSuggestion;
  score: DesignFitScore | null;
  pageUrl: string | null;
  hasRepository: boolean;
  isSubmitting: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: (method: PublishMethod) => void;
  draftHeading?: string;
  draftBody?: string;
}) {
  const [method, setMethod] = useState<PublishMethod>("CMS_DRAFT");
  const [acknowledged, setAcknowledged] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const effectiveScore = score?.score ?? suggestion.designFitScore;
  const blocking = score?.blockingIssues ?? [];
  const before = suggestion.slot?.currentText ?? "";
  const after = [draftHeading ?? suggestion.heading, draftBody ?? suggestion.body]
    .filter(Boolean)
    .join("\n\n");

  const selected = METHODS.find((m) => m.id === method);
  const methodBlocked = Boolean(selected?.needsRepository && !hasRepository);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Approve change"
        className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl border bg-white shadow-xl sm:rounded-2xl"
      >
        <header className="flex items-start justify-between gap-2 border-b px-4 py-3">
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-brand-950">Approve change</h2>
            <p className="truncate font-mono text-[11px] text-brand-400">{pageUrl ?? "—"}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-brand-400 hover:bg-brand-100 hover:text-brand-950"
          >
            <X size={14} />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
          <section>
            <h3 className="text-[12px] font-semibold text-brand-700">Change summary</h3>
            <p className="mt-1 text-[12px] text-brand-600">
              {suggestion.title} — {suggestion.seoIssue}, added {suggestion.recommendedLocation.toLowerCase()}.
            </p>
          </section>

          <section className="grid gap-3 sm:grid-cols-2">
            <Diff title="Original content" tone="before">
              {before || "This section is empty today."}
            </Diff>
            <Diff title="New content" tone="after">
              {after}
            </Diff>
          </section>

          <section className="flex flex-wrap items-center gap-4 rounded-xl border bg-brand-50/60 p-3">
            <DesignFitBadge score={effectiveScore} />
            <Metric label="SEO Value" value={suggestion.seoValue} />
            <Metric label="Mobile Risk" value={score?.mobileRisk ?? suggestion.mobileRisk} />
          </section>

          {/* Screenshots are genuinely not captured yet — saying so is better
              than an empty frame the reviewer reads as "nothing changed". */}
          <section className="rounded-xl border border-dashed bg-white p-3">
            <p className="text-[11.5px] font-semibold text-brand-600">Before / after screenshots</p>
            <p className="mt-0.5 text-[11px] text-brand-400">
              Not captured. The crawler stores page HTML but no rendered screenshots yet, so the
              live preview above is the visual record for this change.
            </p>
          </section>

          {blocking.length > 0 && (
            <section className="rounded-xl border border-error-200 bg-error-50 p-3">
              <p className="flex items-center gap-1.5 text-[11.5px] font-semibold text-error-700">
                <AlertTriangle size={12} /> This change cannot be published
              </p>
              <ul className="mt-1.5 space-y-1">
                {blocking.map((issue) => (
                  <li key={issue} className="text-[11px] text-error-700">
                    {issue}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <h3 className="text-[12px] font-semibold text-brand-700">Publishing method</h3>
            <div className="mt-2 space-y-2">
              {METHODS.map((m) => {
                const disabled = m.needsRepository && !hasRepository;
                const Icon = m.Icon;
                return (
                  <label
                    key={m.id}
                    className={cn(
                      "flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 transition",
                      method === m.id ? "ring-2 ring-accent-600" : "hover:bg-brand-50",
                      disabled && "cursor-not-allowed opacity-50",
                    )}
                  >
                    <input
                      type="radio"
                      name="publish-method"
                      value={m.id}
                      checked={method === m.id}
                      disabled={disabled}
                      onChange={() => setMethod(m.id)}
                      className="mt-0.5"
                    />
                    <Icon size={14} className="mt-0.5 shrink-0 text-brand-500" />
                    <span className="min-w-0">
                      <span className="block text-[12px] font-semibold text-brand-950">{m.label}</span>
                      <span className="block text-[11px] leading-relaxed text-brand-500">
                        {disabled
                          ? "Connect a repository in Integrations to use this."
                          : m.description}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </section>

          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              className="mt-0.5"
            />
            <span className="text-[11.5px] leading-relaxed text-brand-600">
              I have reviewed the preview and approve this change to {pageUrl ?? "this page"}.
            </span>
          </label>

          {error && (
            <p className="rounded-lg border border-error-200 bg-error-50 px-3 py-2 text-[11.5px] text-error-700">
              {error}
            </p>
          )}
        </div>

        <footer className="flex items-center justify-end gap-2 border-t px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border bg-white px-3 py-1.5 text-[12px] font-medium text-brand-700 hover:bg-brand-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!acknowledged || blocking.length > 0 || methodBlocked || isSubmitting}
            onClick={() => onConfirm(method)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-950 px-4 py-1.5 text-[12px] font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isSubmitting && <Loader2 size={12} className="animate-spin" />}
            Approve and send
          </button>
        </footer>
      </div>
    </div>
  );
}

function Diff({
  title,
  tone,
  children,
}: {
  title: string;
  tone: "before" | "after";
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border p-3",
        tone === "after" ? "border-success-200 bg-success-50/40" : "bg-brand-50/60",
      )}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-brand-400">{title}</p>
      <p className="mt-1.5 max-h-40 overflow-y-auto whitespace-pre-wrap text-[11.5px] leading-relaxed text-brand-700">
        {children}
      </p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className="text-[11px] text-brand-400">{label}</span>
      <span className="text-[12px] font-semibold capitalize text-brand-950">
        {value ? value.toLowerCase() : "—"}
      </span>
    </span>
  );
}
