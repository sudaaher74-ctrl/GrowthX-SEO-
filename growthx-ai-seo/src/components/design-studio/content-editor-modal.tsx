"use client";
import { useEffect, useState } from "react";
import { Loader2, Lock, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DesignSuggestion } from "@/lib/api-client";

/**
 * Editing the generated content before it is scored.
 *
 * The counters along the bottom are the same limits the backend scores
 * against, shown while typing so a reviewer can see an overrun before they
 * trigger a preview. Line counts are shown as "needs a rendered capture"
 * rather than estimated: a line count depends on font metrics and column
 * width, and inventing one here would contradict the scorer.
 *
 * Locked phrases are enforced on save, not merely suggested — a phrase the
 * customer marked as required is a brand or legal constraint.
 */

const VARIANTS = ["Concise", "Professional", "Technical", "Premium", "Conversion-focused"] as const;
const LENGTHS = [
  { id: "SHORT", label: "Short", hint: "~40 words" },
  { id: "MEDIUM", label: "Medium", hint: "~80 words" },
  { id: "LONG", label: "Long", hint: "~140 words" },
] as const;

export function ContentEditorModal({
  suggestion,
  initialHeading,
  initialBody,
  isSaving,
  onClose,
  onSave,
}: {
  suggestion: DesignSuggestion;
  initialHeading: string;
  initialBody: string;
  isSaving: boolean;
  onClose: () => void;
  onSave: (next: { heading: string; body: string; variant: string; targetKeyword: string }) => void;
}) {
  const [heading, setHeading] = useState(initialHeading);
  const [body, setBody] = useState(initialBody);
  const [variant, setVariant] = useState<string>(suggestion.variant ?? VARIANTS[1]);
  const [length, setLength] = useState<string>("MEDIUM");
  const [targetKeyword, setTargetKeyword] = useState(suggestion.targetKeyword ?? "");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const words = body.trim() ? body.trim().split(/\s+/).length : 0;
  const chars = body.trim().length;
  const maxWords = suggestion.slot?.maxWords ?? null;
  const maxChars = suggestion.slot?.maxChars ?? null;

  const missingLocked = suggestion.lockedPhrases.filter(
    (phrase) => !body.toLowerCase().includes(phrase.toLowerCase()),
  );
  const overWords = maxWords !== null && words > maxWords;
  const canSave = missingLocked.length === 0 && body.trim().length > 0 && !isSaving;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Edit content"
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl border bg-white shadow-xl sm:rounded-2xl"
      >
        <header className="flex items-center justify-between gap-2 border-b px-4 py-3">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-bold text-brand-950">Edit Content</h2>
            <p className="truncate text-[11px] text-brand-400">{suggestion.recommendedLocation}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close editor"
            className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-brand-400 hover:bg-brand-100 hover:text-brand-950"
          >
            <X size={14} />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
          <Field label="Heading">
            <input
              value={heading}
              onChange={(e) => setHeading(e.target.value)}
              className="w-full rounded-lg border bg-white px-3 py-2 text-[13px] font-semibold text-brand-950 outline-none focus:ring-2 focus:ring-accent-600"
            />
          </Field>

          <Field label="Body">
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={8}
              className="w-full resize-y rounded-lg border bg-white px-3 py-2 text-[12.5px] leading-relaxed text-brand-700 outline-none focus:ring-2 focus:ring-accent-600"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Variant">
              <div className="flex flex-wrap gap-1.5">
                {VARIANTS.map((v) => (
                  <Chip key={v} active={variant === v} onClick={() => setVariant(v)}>
                    {v}
                  </Chip>
                ))}
              </div>
            </Field>

            <Field label="Length">
              <div className="flex flex-wrap gap-1.5">
                {LENGTHS.map((l) => (
                  <Chip key={l.id} active={length === l.id} onClick={() => setLength(l.id)}>
                    {l.label}
                    <span className="ml-1 text-brand-400">{l.hint}</span>
                  </Chip>
                ))}
              </div>
            </Field>
          </div>

          <Field label="Target keyword">
            <input
              value={targetKeyword}
              onChange={(e) => setTargetKeyword(e.target.value)}
              placeholder="Leave empty if this section has no keyword target"
              className="w-full rounded-lg border bg-white px-3 py-2 text-[12.5px] text-brand-700 outline-none focus:ring-2 focus:ring-accent-600"
            />
          </Field>

          {suggestion.lockedPhrases.length > 0 && (
            <Field label="Locked phrases">
              <div className="flex flex-wrap gap-1.5">
                {suggestion.lockedPhrases.map((phrase) => {
                  const present = body.toLowerCase().includes(phrase.toLowerCase());
                  return (
                    <span
                      key={phrase}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10.5px] font-medium",
                        present
                          ? "bg-success-50 text-success-700"
                          : "bg-error-50 text-error-700",
                      )}
                    >
                      <Lock size={9} />
                      {phrase}
                    </span>
                  );
                })}
              </div>
              {missingLocked.length > 0 && (
                <p className="mt-1.5 text-[11px] text-error-700">
                  {missingLocked.length === 1
                    ? "This phrase must appear before the change can be saved."
                    : "These phrases must appear before the change can be saved."}
                </p>
              )}
            </Field>
          )}

          {/* ── Counters ──────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-2 rounded-xl border bg-brand-50/60 p-3 sm:grid-cols-4">
            <Counter
              label="Words"
              value={maxWords === null ? String(words) : `${words}/${maxWords}`}
              bad={overWords}
            />
            <Counter
              label="Characters"
              value={maxChars === null ? String(chars) : `${chars}/${maxChars}`}
              bad={maxChars !== null && chars > maxChars}
            />
            <Counter label="Desktop lines" value="—" note="Needs a rendered capture" />
            <Counter label="Mobile lines" value="—" note="Needs a rendered capture" />
          </div>
        </div>

        <footer className="flex items-center justify-between gap-2 border-t px-4 py-3">
          <p className="text-[11px] text-brand-400">
            Saving re-scores the change against this page.
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border bg-white px-3 py-1.5 text-[12px] font-medium text-brand-700 hover:bg-brand-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!canSave}
              onClick={() => onSave({ heading, body, variant, targetKeyword })}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-950 px-3.5 py-1.5 text-[12px] font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isSaving && <Loader2 size={12} className="animate-spin" />}
              Save and re-score
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-semibold text-brand-600">{label}</p>
      {children}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-lg border px-2 py-1 text-[11px] font-medium transition",
        active ? "border-brand-950 bg-brand-950 text-white" : "bg-white text-brand-600 hover:bg-brand-50",
      )}
    >
      {children}
    </button>
  );
}

function Counter({
  label,
  value,
  note,
  bad,
}: {
  label: string;
  value: string;
  note?: string;
  bad?: boolean;
}) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.06em] text-brand-400">{label}</p>
      <p
        className={cn(
          "font-mono text-[13px] font-semibold",
          bad ? "text-error-600" : "text-brand-950",
        )}
      >
        {value}
      </p>
      {note && <p className="text-[9.5px] text-brand-400">{note}</p>}
    </div>
  );
}
