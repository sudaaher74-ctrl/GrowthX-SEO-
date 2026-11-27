"use client";

import { Bot, X } from "lucide-react";
import type { ProofOfImpactCard } from "@/lib/api-types";

interface PlanBPreviewModalProps {
  card: ProofOfImpactCard;
  onClose: () => void;
  onStagePlanB?: () => void;
}

/**
 * Honest review dialog for recorded follow-up recommendations.
 * Never fabricates hardcoded schema snippets or fakes PR staging with timers.
 */
export function PlanBPreviewModal({
  card,
  onClose,
}: PlanBPreviewModalProps) {
  const pivotTitle = card.loopStatus?.pivotTitle?.trim() || null;
  const pivotAction = card.loopStatus?.pivotAction?.trim() || null;
  const rcaItems = Array.isArray(card.loopStatus?.rca) ? card.loopStatus.rca.filter(Boolean) : [];
  const verificationStatus = card.after?.verificationStatus || "UNVERIFIED";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Follow-up Observation Details"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs"
    >
      <div className="w-full max-w-lg rounded-2xl border border-brand-200 bg-surface-1 p-5 shadow-2xl space-y-4">
        <div className="flex items-start justify-between gap-3 border-b border-brand-200/80 pb-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-signal-400 text-signal-ink font-bold shadow-xs">
              <Bot size={15} />
            </span>
            <div>
              <h2 className="text-sm font-bold text-brand-950">Follow-up Review</h2>
              <p className="text-[11px] text-brand-500">
                Recorded observation status and recommended next action. No change is staged from this dialog.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close follow-up dialog"
            className="rounded-lg p-1 text-brand-400 hover:bg-surface-2 hover:text-brand-950 transition cursor-pointer"
          >
            <X size={15} />
          </button>
        </div>

        <div className="rounded-xl border border-brand-200/80 bg-surface-2/60 p-3 text-xs space-y-1">
          <span className="text-[10px] uppercase font-bold text-brand-500 block">Target Page</span>
          <span className="font-mono text-brand-950 font-bold break-all block">{card.url || card.file}</span>
          <span className="text-[10.5px] text-brand-500 block">
            Recorded verification state: <strong className="font-mono text-brand-900">{verificationStatus}</strong>
          </span>
        </div>

        <div className="rounded-xl border border-brand-200 bg-surface-2/40 p-3 space-y-2 text-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-brand-500 block">
            Recorded Follow-up Guidance
          </span>
          {pivotTitle || pivotAction ? (
            <>
              {pivotTitle && <p className="font-semibold text-brand-950">{pivotTitle}</p>}
              {pivotAction && <p className="text-brand-600 leading-relaxed">{pivotAction}</p>}
            </>
          ) : (
            <p className="text-brand-500 leading-relaxed">
              No automated follow-up action has been generated for this fix yet. Run a fresh crawl and evaluate loop once real Search Console / verification data is recorded.
            </p>
          )}
          {rcaItems.length > 0 && (
            <ul className="list-disc pl-4 space-y-1 text-[11px] text-brand-600 pt-1">
              {rcaItems.map((line, idx) => (
                <li key={idx}>{line}</li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 pt-1 border-t border-brand-200/80">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-brand-200 bg-surface-2 px-3.5 py-1.5 text-xs font-semibold text-brand-700 hover:text-brand-950 transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
