"use client";
import { useState } from "react";
import {
  AlertTriangle,
  ArrowRightLeft,
  Check,
  CheckCircle2,
  GitCompare,
  Loader2,
  Pencil,
  Sparkles,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { DesignFitScore, DesignSuggestion } from "@/lib/api-client";
import { Panel } from "@/components/ui/console";
import { ScrollPanel } from "./scroll-panel";
import { DesignFitRing, labelForScore } from "./design-fit-ring";
import { StatusChip } from "./status-chip";

/**
 * The right column: everything known about the selected change, and the one
 * button that acts on it.
 *
 * Every row here is either a stored value or an em dash. The rows that cannot
 * be measured without a rendered capture — CTA movement, style preservation —
 * say "not measured" rather than reporting a comfortable default, because this
 * panel is the last thing a reviewer reads before changing a live page.
 */

export function ChangeInspector({
  suggestion,
  score,
  isScoring,
  onEdit,
  onRegenerate,
  onCompare,
  onApprove,
  draftHeading,
  draftBody,
}: {
  suggestion: DesignSuggestion | null;
  score: DesignFitScore | null;
  isScoring: boolean;
  onEdit: () => void;
  onRegenerate: () => void;
  onCompare: () => void;
  onApprove: () => void;
  draftHeading?: string;
  draftBody?: string;
}) {
  const [mode, setMode] = useState<"before" | "after">("after");

  if (!suggestion) {
    return (
      <Panel padded className="flex h-full items-center justify-center text-center">
        <p className="max-w-[220px] text-[12px] text-brand-400">
          Select a suggestion to inspect the change, its design fit and its layout risks.
        </p>
      </Panel>
    );
  }

  const effectiveScore = score?.score ?? suggestion.designFitScore;
  const blocking = score?.blockingIssues ?? [];
  const heading = draftHeading ?? suggestion.heading ?? "";
  const body = draftBody ?? suggestion.body;
  const currentText = suggestion.slot?.currentText ?? "";

  return (
    <ScrollPanel
      title="Change Inspector"
      actions={<StatusChip status={suggestion.status} score={effectiveScore} />}
    >

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {/* ── Content preview ─────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-[12px] font-semibold text-brand-700">Content Preview</h3>
          <span className="inline-flex rounded-lg border bg-white p-0.5">
            {(["before", "after"] as const).map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setMode(id)}
                aria-pressed={mode === id}
                className={cn(
                  "rounded-md px-2 py-0.5 text-[10.5px] font-medium capitalize transition",
                  mode === id ? "bg-brand-950 text-white" : "text-brand-600 hover:bg-brand-100",
                )}
              >
                {id}
              </button>
            ))}
          </span>
        </div>

        <div className="mt-2 rounded-xl border bg-brand-50/60 p-3">
          {mode === "after" ? (
            <>
              <p className="text-[9.5px] font-semibold uppercase tracking-[0.08em] text-brand-400">
                {suggestion.contentType}
              </p>
              {heading && (
                <p className="mt-1 text-[14px] font-semibold leading-snug text-brand-950">
                  {heading}
                </p>
              )}
              <p className="mt-1.5 whitespace-pre-wrap text-[11.5px] leading-relaxed text-brand-600">
                {body}
              </p>
            </>
          ) : currentText ? (
            <p className="whitespace-pre-wrap text-[11.5px] leading-relaxed text-brand-600">
              {currentText}
            </p>
          ) : (
            <p className="text-[11.5px] italic text-brand-400">
              This section is empty today — the change adds content rather than replacing it.
            </p>
          )}
        </div>

        {/* ── Why ─────────────────────────────────────────────────────── */}
        <dl className="mt-4 space-y-2">
          <Row label="Content type" value={suggestion.contentType} />
          <Row label="Recommended location" value={suggestion.recommendedLocation} />
          <Row label="SEO issue" value={suggestion.seoIssue} />
          <Row
            label="Word count"
            value={`${suggestion.currentWordCount} → ${suggestion.suggestedWordCount}`}
            mono
          />
        </dl>

        {/* ── Change details ──────────────────────────────────────────── */}
        <h3 className="mt-5 text-[12px] font-semibold text-brand-700">Change Details</h3>
        <div className="mt-2 divide-y rounded-xl border bg-white">
          <DetailRow label="Design Fit">
            {isScoring ? (
              <Loader2 size={13} className="animate-spin text-brand-400" />
            ) : (
              <span className="inline-flex items-center gap-1.5">
                <DesignFitRing score={effectiveScore} size={18} strokeWidth={2.5} />
                <span className="font-mono text-[11.5px] font-semibold text-brand-950">
                  {effectiveScore === null ? "—" : `${effectiveScore}/100`}
                </span>
              </span>
            )}
          </DetailRow>
          <DetailRow label="Band">
            <span className="text-[11px] text-brand-600">{labelForScore(effectiveScore)}</span>
          </DetailRow>
          <DetailRow label="SEO Value">
            <Pill value={suggestion.seoValue} tone={suggestion.seoValue === "HIGH" ? "good" : "neutral"} />
          </DetailRow>
          <DetailRow label="Mobile Risk">
            <Pill
              value={score?.mobileRisk ?? suggestion.mobileRisk}
              tone={
                (score?.mobileRisk ?? suggestion.mobileRisk) === "LOW"
                  ? "good"
                  : (score?.mobileRisk ?? suggestion.mobileRisk) === "HIGH"
                    ? "bad"
                    : "neutral"
              }
            />
          </DetailRow>
          <DetailRow label="CTA Movement">
            {score?.ctaMovementLines === null || score?.ctaMovementLines === undefined ? (
              // Honest: measuring this needs a rendered page, which the
              // crawler does not capture yet.
              <span className="text-[11px] text-brand-400">Not measured</span>
            ) : (
              <span className="font-mono text-[11.5px] text-brand-950">
                +{score.ctaMovementLines} lines
              </span>
            )}
          </DetailRow>
          <DetailRow label="Style Preserved">
            <span className="inline-flex items-center gap-1 text-[11px] text-success-700">
              <Check size={11} /> Content only
            </span>
          </DetailRow>
        </div>

        {/* ── Safety checks ───────────────────────────────────────────── */}
        {score?.checks?.length ? (
          <>
            <h3 className="mt-5 text-[12px] font-semibold text-brand-700">Visual safety checks</h3>
            <ul className="mt-2 space-y-1.5">
              {score.checks.map((check) => (
                <li key={check.id} className="flex items-start gap-1.5">
                  {check.passed ? (
                    <CheckCircle2 size={12} className="mt-0.5 shrink-0 text-success-600" />
                  ) : check.blocking ? (
                    <XCircle size={12} className="mt-0.5 shrink-0 text-error-600" />
                  ) : (
                    <AlertTriangle size={12} className="mt-0.5 shrink-0 text-warning-500" />
                  )}
                  <span className="text-[11px] leading-relaxed text-brand-600">{check.message}</span>
                </li>
              ))}
            </ul>
          </>
        ) : null}

        {blocking.length > 0 && (
          <div className="mt-4 rounded-xl border border-error-200 bg-error-50 p-3">
            <p className="flex items-center gap-1.5 text-[11.5px] font-semibold text-error-700">
              <AlertTriangle size={12} /> Publishing is blocked
            </p>
            <ul className="mt-1.5 space-y-1">
              {blocking.map((issue) => (
                <li key={issue} className="text-[11px] leading-relaxed text-error-700">
                  {issue}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* ── Actions. Sticky so the primary action stays reachable. ────── */}
      <div className="sticky bottom-0 space-y-2 border-t bg-white p-3">
        <div className="grid grid-cols-2 gap-2">
          <SecondaryButton onClick={onEdit} Icon={Pencil}>
            Edit Content
          </SecondaryButton>
          <SecondaryButton onClick={onRegenerate} Icon={Sparkles}>
            Another Version
          </SecondaryButton>
        </div>
        <SecondaryButton onClick={onCompare} Icon={GitCompare} full>
          Compare Changes
        </SecondaryButton>
        <button
          type="button"
          onClick={onApprove}
          disabled={blocking.length > 0 || effectiveScore === null}
          title={
            effectiveScore === null
              ? "Preview this change to measure its design fit before approving."
              : blocking.length > 0
                ? blocking[0]
                : undefined
          }
          className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-brand-950 px-3 py-2 text-[12px] font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ArrowRightLeft size={13} />
          Approve Change
        </button>
      </div>
    </ScrollPanel>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-[11px] text-brand-400">{label}</dt>
      <dd
        className={cn(
          "text-right text-[11.5px] text-brand-700",
          mono && "font-mono text-[11px]",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2">
      <span className="text-[11px] text-brand-500">{label}</span>
      {children}
    </div>
  );
}

function Pill({ value, tone }: { value: string | null | undefined; tone: "good" | "bad" | "neutral" }) {
  if (!value) return <span className="text-[11px] text-brand-400">—</span>;
  return (
    <span
      className={cn(
        "rounded-md px-1.5 py-0.5 text-[10px] font-semibold capitalize",
        tone === "good" && "bg-success-50 text-success-700",
        tone === "bad" && "bg-error-50 text-error-700",
        tone === "neutral" && "bg-brand-100 text-brand-600",
      )}
    >
      {value.toLowerCase()}
    </span>
  );
}

function SecondaryButton({
  onClick,
  Icon,
  children,
  full,
}: {
  onClick: () => void;
  Icon: React.ElementType;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-lg border bg-white px-3 py-1.5 text-[11.5px] font-medium text-brand-700 transition hover:bg-brand-50",
        full && "w-full",
      )}
    >
      <Icon size={12} />
      {children}
    </button>
  );
}
