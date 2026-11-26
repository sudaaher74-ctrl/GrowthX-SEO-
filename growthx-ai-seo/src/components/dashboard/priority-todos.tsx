"use client";

import React, { useEffect, useId, useRef } from "react";
import Link from "next/link";
import { ArrowRight, ChevronRight, ExternalLink, Sparkles, X } from "lucide-react";
import { type FixClass, type IssueGroup, type IssueSeverity } from "@/lib/api-client";
import { SEVERITY_PLAIN, asSentence } from "@/lib/plain-language";
import { cn } from "@/lib/utils";

const SEVERITY = SEVERITY_PLAIN;

const FIX_CLASS_COPY: Record<FixClass, { label: string; cta: string; href: string; note: string }> = {
  AUTO: {
    label: "1-Click AI Fix",
    cta: "Stage in Fix Engine",
    href: "/fix-engine",
    note: "Generates an isolated pull request — nothing goes live until you approve and merge.",
  },
  APPROVAL: {
    label: "AI Assisted",
    cta: "Review in Fix Engine",
    href: "/fix-engine",
    note: "Shown as a before-and-after diff before applying.",
  },
  MANUAL: {
    label: "Manual Fix",
    cta: "Inspect in Website Audit",
    href: "/website?tab=issues",
    note: "Includes technical diagnostics and affected routes for your team.",
  },
};

function severityDotClass(sev: IssueSeverity): string {
  return {
    CRITICAL: "bg-error-500",
    HIGH: "bg-warning-500",
    MEDIUM: "bg-accent-500",
    LOW: "bg-brand-300",
  }[sev];
}

/**
 * Linear-style single-row priority issue item: severity dot, clear title,
 * affected page count, quiet AI-ready hint, and click-to-inspect drawer trigger.
 */
export function TodoRow({
  group,
  selected,
  onPick,
}: {
  group: IssueGroup;
  rank?: number;
  selected: boolean;
  onPick: () => void;
}) {
  const sev = SEVERITY[group.severity] ?? SEVERITY.LOW;
  const isAiReady = group.aiFixAvailable || group.fixClass === "AUTO";
  const pageText = `${group.affectedCount} ${group.affectedCount === 1 ? "affected page" : "affected pages"}`;

  return (
    <li>
      <button
        type="button"
        onClick={onPick}
        aria-pressed={selected}
        className={cn(
          "group flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition cursor-pointer",
          selected ? "bg-brand-100/70" : "hover:bg-brand-50/90",
        )}
      >
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={cn("h-2 w-2 shrink-0 rounded-full", severityDotClass(group.severity))}
            title={sev.label}
            aria-hidden="true"
          />
          <span className="truncate text-[13px] font-medium text-brand-950 group-hover:text-brand-950">
            {group.title}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-4 text-[11.5px]">
          {isAiReady && (
            <span className="hidden sm:inline-flex items-center gap-1 font-medium text-success-700">
              <Sparkles size={11} />
              AI fix
            </span>
          )}
          <span className="font-mono text-brand-500 tabular-nums">{pageText}</span>
          <span className="hidden md:inline-block w-16 text-right text-[11px] font-medium text-brand-400">
            {sev.label}
          </span>
          <ChevronRight
            size={14}
            className="text-brand-300 transition group-hover:translate-x-0.5 group-hover:text-brand-700"
          />
        </div>
      </button>
    </li>
  );
}

/**
 * Calm slide-over native <dialog> Issue Inspector — replaces the nested 6-card
 * master-detail panel with clean typography, hairline dividers, and 1-click Fix Engine action.
 */
export function ProblemDetailDrawer({
  group,
  onClose,
}: {
  group: IssueGroup | null;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (group && !dialog.open) {
      dialog.showModal();
    } else if (!group && dialog.open) {
      dialog.close();
    }
  }, [group]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleClose = () => {
      dialog.returnValue = "";
      onClose();
    };
    dialog.addEventListener("close", handleClose);

    let cleanupOutside: (() => void) | null = null;
    if (!("closedBy" in HTMLDialogElement.prototype)) {
      const outside = (e: PointerEvent) => {
        const r = dialog.getBoundingClientRect();
        return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
      };
      let pressedOutside = false;
      const onDown = (e: PointerEvent) => {
        pressedOutside = outside(e);
      };
      const onUp = (e: PointerEvent) => {
        if (pressedOutside && outside(e)) dialog.close();
        pressedOutside = false;
      };
      dialog.addEventListener("pointerdown", onDown);
      dialog.addEventListener("pointerup", onUp);
      cleanupOutside = () => {
        dialog.removeEventListener("pointerdown", onDown);
        dialog.removeEventListener("pointerup", onUp);
      };
    }

    return () => {
      dialog.removeEventListener("close", handleClose);
      cleanupOutside?.();
    };
  }, [onClose]);

  const sev = group ? (SEVERITY[group.severity] ?? SEVERITY.LOW) : null;
  const fix = group ? (FIX_CLASS_COPY[group.fixClass] ?? FIX_CLASS_COPY.MANUAL) : null;

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      {...({ closedby: "any" } as Record<string, string>)}
      className="traffic-inspector-dialog border-l border-brand-200"
    >
      {group && sev && fix && (
        <>
          <div className="flex items-start justify-between gap-4 border-b border-brand-100 px-6 py-5">
            <div className="min-w-0 space-y-1.5">
              <div className="flex items-center gap-2 text-[11px] font-medium text-brand-500">
                <span className={cn("h-2 w-2 rounded-full", severityDotClass(group.severity))} />
                <span>{sev.label}</span>
                <span className="text-brand-300">·</span>
                <span>{fix.label}</span>
              </div>
              <h1 id={titleId} className="text-[16px] font-bold leading-snug tracking-tight text-brand-950">
                {group.title}
              </h1>
            </div>
            <form method="dialog">
              <button
                type="submit"
                autoFocus
                aria-label="Close issue details"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-brand-400 hover:bg-brand-100 hover:text-brand-950 transition cursor-pointer"
              >
                <X size={16} />
              </button>
            </form>
          </div>

          <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
            {group.summary && (
              <p className="text-[13px] leading-relaxed text-brand-600">{asSentence(group.summary)}</p>
            )}

            {/* Single quiet 3-column metadata strip with hairlines */}
            <div className="grid grid-cols-3 divide-x divide-brand-100 border-y border-brand-100 py-3.5">
              <div className="pr-3">
                <p className="text-[10.5px] font-medium uppercase tracking-wider text-brand-400">Pages</p>
                <p className="mt-0.5 font-mono text-[16px] font-bold text-brand-950 tabular-nums">
                  {group.affectedCount}
                </p>
              </div>
              <div className="px-3">
                <p className="text-[10.5px] font-medium uppercase tracking-wider text-brand-400">Path</p>
                <p className="mt-0.5 text-[13px] font-semibold text-brand-950">{fix.label}</p>
              </div>
              <div className="pl-3">
                <p className="text-[10.5px] font-medium uppercase tracking-wider text-brand-400">Confidence</p>
                <p className="mt-0.5 text-[13px] font-semibold text-brand-950">
                  {group.confidence === "CONFIRMED" ? "Confirmed" : "Verified"}
                </p>
              </div>
            </div>

            {group.action && (
              <div className="space-y-1.5">
                <h2 className="text-[11px] font-semibold uppercase tracking-wider text-brand-400">
                  How to fix
                </h2>
                <p className="text-[13px] leading-relaxed text-brand-700">{asSentence(group.action)}</p>
              </div>
            )}

            {group.sampleUrls.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h2 className="text-[11px] font-semibold uppercase tracking-wider text-brand-400">
                    Affected pages ({group.sampleUrls.length})
                  </h2>
                  <Link href="/website?tab=issues" className="text-[11.5px] font-medium text-brand-500 hover:text-brand-950">
                    Full audit →
                  </Link>
                </div>
                <ul className="divide-y divide-brand-100 border-t border-brand-100">
                  {group.sampleUrls.slice(0, 8).map((u) => (
                    <li key={u} className="flex items-center justify-between gap-2 py-2 text-[12px]">
                      <span className="truncate font-mono text-brand-700" title={u}>
                        {u}
                      </span>
                      <a
                        href={u}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Open ${u}`}
                        className="shrink-0 text-brand-400 hover:text-brand-950"
                      >
                        <ExternalLink size={12} />
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-brand-100 px-6 py-4">
            <p className="text-[11px] text-brand-400 max-w-[260px]">{fix.note}</p>
            <Link
              href={fix.href}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-signal-400 px-4 py-2 text-[12px] font-bold text-signal-ink hover:bg-signal-500 transition shadow-xs"
            >
              <span>{fix.cta}</span>
              <ArrowRight size={13} />
            </Link>
          </div>
        </>
      )}
    </dialog>
  );
}
