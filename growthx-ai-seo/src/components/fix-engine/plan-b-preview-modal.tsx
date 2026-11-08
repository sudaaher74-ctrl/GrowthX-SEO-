"use client";

import { useState } from "react";
import {
  AlertCircle,
  Bot,
  Check,
  CheckCircle2,
  ClipboardCopy,
  Compass,
  FileCode,
  GitBranch,
  Globe,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProofOfImpactCard } from "@/lib/api-types";

interface PlanBPreviewModalProps {
  card: ProofOfImpactCard;
  onClose: () => void;
  onStagePlanB?: () => void;
}

export function PlanBPreviewModal({
  card,
  onClose,
  onStagePlanB,
}: PlanBPreviewModalProps) {
  const [copied, setCopied] = useState(false);
  const [staged, setStaged] = useState(false);

  // Generate realistic JSON-LD FAQ schema snippet for Plan B
  const snippet = JSON.stringify(
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: `How does ${card.title.replace(/^Grow\s+/i, "")} work?`,
          acceptedAnswer: {
            "@type": "Answer",
            text: `High-quality, direct delivery service with verified local sourcing and same-day delivery options.`,
          },
        },
        {
          "@type": "Question",
          name: "What are the delivery areas and ordering deadlines?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Delivering across all major local sectors with automated order tracking and cold-chain temperature control.",
          },
        },
      ],
    },
    null,
    2,
  );

  const handleCopy = () => {
    navigator.clipboard.writeText(snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleStage = () => {
    setStaged(true);
    setTimeout(() => {
      onStagePlanB?.();
      onClose();
    }, 1200);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Autonomous Plan B Strategy"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs"
    >
      <div className="w-full max-w-lg rounded-2xl border border-brand-200 bg-surface-1 p-5 shadow-2xl space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-brand-200/80 pb-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-signal-400 text-signal-ink font-bold shadow-xs">
              <Bot size={15} />
            </span>
            <div>
              <h2 className="text-[14.5px] font-bold text-brand-950 flex items-center gap-2">
                Autonomous Plan B Strategy
              </h2>
              <p className="text-[11px] text-brand-500">
                Triggered when initial fix yields 0 lift against rivals.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-brand-400 hover:bg-surface-2 hover:text-brand-950 transition cursor-pointer"
          >
            <X size={15} />
          </button>
        </div>

        {/* Minimal Context Bar */}
        <div className="rounded-xl border border-brand-200/80 bg-surface-2/60 p-2.5 text-xs flex items-center justify-between gap-2">
          <div className="truncate min-w-0">
            <span className="text-[10px] uppercase font-bold text-brand-500 block">Target Page</span>
            <span className="font-mono text-brand-950 font-bold truncate block">{card.url || card.file}</span>
          </div>
          <span className="rounded-full bg-signal-400/20 text-signal-ink border border-signal-400/40 px-2 py-0.5 text-[10px] font-bold shrink-0">
            Armed for Day 21
          </span>
        </div>

        {/* Comparison: Method 1 vs Method 2 */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-xl border border-brand-200 bg-surface-2/40 p-2.5 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-brand-500 block">
              Method 1 (Baseline Fix)
            </span>
            <p className="font-semibold text-brand-950 text-[11.5px]">Title &amp; Meta Tweak</p>
            <p className="text-[10.5px] text-brand-500 leading-snug">
              Stalled against high-DA rivals lacking rich entity schema.
            </p>
          </div>

          <div className="rounded-xl border border-warning-300/80 bg-warning-50/20 p-2.5 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-warning-800 block">
              Method 2 (Plan B Pivot)
            </span>
            <p className="font-semibold text-brand-950 text-[11.5px]">FAQ Schema + Long-Tail</p>
            <p className="text-[10.5px] text-brand-600 leading-snug">
              Injects JSON-LD FAQPage markup to win rich search snippets.
            </p>
          </div>
        </div>

        {/* Code Snippet Payload */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[10.5px] font-bold uppercase tracking-wider text-brand-500 flex items-center gap-1.5">
              <FileCode size={12} className="text-brand-400" />
              Generated JSON-LD Payload:
            </span>
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-accent-700 hover:underline cursor-pointer"
            >
              {copied ? (
                <>
                  <Check size={11} className="text-success-700" />
                  Copied!
                </>
              ) : (
                <>
                  <ClipboardCopy size={11} />
                  Copy Snippet
                </>
              )}
            </button>
          </div>

          <pre className="max-h-36 overflow-y-auto rounded-xl border border-brand-200 bg-surface-2 p-3 font-mono text-[10.5px] leading-relaxed text-brand-900 select-all">
            {snippet}
          </pre>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between gap-3 pt-1 border-t border-brand-200/80">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-brand-200 bg-surface-2 px-3 py-1.5 text-xs font-semibold text-brand-700 hover:text-brand-950 transition cursor-pointer"
          >
            Close
          </button>

          <button
            type="button"
            onClick={handleStage}
            disabled={staged}
            className="inline-flex items-center gap-1.5 rounded-full bg-signal-400 px-4 py-1.5 text-xs font-bold text-signal-ink shadow-xs hover:bg-signal-500 transition cursor-pointer disabled:opacity-50"
          >
            {staged ? (
              <>
                <CheckCircle2 size={13} className="text-signal-ink" />
                Round 2 PR Staged!
              </>
            ) : (
              <>
                <GitBranch size={13} />
                Stage &amp; Open Round 2 PR →
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
