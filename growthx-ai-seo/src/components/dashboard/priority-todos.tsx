"use client";

import React, { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Copy,
  ExternalLink,
  HelpCircle,
  Lightbulb,
  MessageSquare,
  Sparkles,
  UserCheck,
  Wrench,
  X,
} from "lucide-react";
import { type IssueGroup, type IssueSeverity } from "@/lib/api-client";
import {
  GUIDE_PLATFORMS,
  getIssueFixGuide,
  type GuidePlatform,
} from "@/lib/issue-fix-guides";
import { SEVERITY_PLAIN } from "@/lib/plain-language";
import { cn } from "@/lib/utils";

const SEVERITY = SEVERITY_PLAIN;
const PLATFORM_STORAGE_KEY = "reigel.guide_platform";

function severityDotClass(sev: IssueSeverity): string {
  return {
    CRITICAL: "bg-error-500",
    HIGH: "bg-warning-500",
    MEDIUM: "bg-accent-500",
    LOW: "bg-brand-300",
  }[sev];
}

function readSavedPlatform(): GuidePlatform {
  if (typeof window === "undefined") return "wordpress";
  try {
    const saved = localStorage.getItem(PLATFORM_STORAGE_KEY) as GuidePlatform | null;
    if (saved && GUIDE_PLATFORMS.some((p) => p.id === saved)) return saved;
  } catch {
    // Ignore storage errors
  }
  return "wordpress";
}

/**
 * Linear-style single-row priority issue item: severity dot, clear title,
 * affected page count, plain fix difficulty hint, and click-to-inspect guide trigger.
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
  const guide = getIssueFixGuide({
    title: group.title,
    issueType: group.issueType,
    summary: group.summary,
    recommendedAction: group.action,
    affectedPages: group.sampleUrls,
    fixClass: group.fixClass,
  });
  const pageText = `${group.affectedCount} ${group.affectedCount === 1 ? "affected page" : "affected pages"}`;

  return (
    <li>
      <button
        type="button"
        onClick={onPick}
        aria-pressed={selected}
        className={cn(
          "group flex w-full items-center justify-between gap-4 px-5 py-3.5 text-left transition cursor-pointer",
          selected ? "bg-brand-100/70" : "hover:bg-brand-50/90",
        )}
      >
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={cn("h-2 w-2 shrink-0 rounded-full", severityDotClass(group.severity))}
            title={sev.label}
            aria-hidden="true"
          />
          <span className="truncate text-[13px] font-medium text-brand-950">
            {group.title}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-3.5 text-[11.5px]">
          <span
            className={cn(
              "hidden sm:inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
              guide.difficulty === "no_code"
                ? "bg-success-50 text-success-700"
                : "bg-brand-100 text-brand-600",
            )}
          >
            {guide.difficulty === "no_code" ? <UserCheck size={11} /> : <Wrench size={11} />}
            <span>{guide.difficulty === "no_code" ? "No coding" : "Guide & dev brief"}</span>
          </span>
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
 * Plain-English Slide-Over Solution Guide Drawer — explains what's wrong,
 * why it matters, exact step-by-step instructions by platform (WordPress,
 * Shopify, Webflow, Wix, Developer), and 1-click Copy / WhatsApp developer handoff.
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
  const [platform, setPlatform] = useState<GuidePlatform>(() => readSavedPlatform());
  const [copied, setCopied] = useState(false);

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
  const guide = group
    ? getIssueFixGuide({
        title: group.title,
        issueType: group.issueType,
        summary: group.summary,
        recommendedAction: group.action,
        affectedPages: group.sampleUrls,
        fixClass: group.fixClass,
      })
    : null;

  const handleSelectPlatform = (next: GuidePlatform) => {
    setPlatform(next);
    try {
      localStorage.setItem(PLATFORM_STORAGE_KEY, next);
    } catch {
      // Ignore storage errors
    }
  };

  const handleCopyHandoff = async () => {
    if (!guide) return;
    try {
      await navigator.clipboard.writeText(guide.developerHandoff);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable
    }
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      {...({ closedby: "any" } as Record<string, string>)}
      className="traffic-inspector-dialog border-l border-brand-200"
    >
      {group && sev && guide && (
        <>
          <div className="flex items-start justify-between gap-4 border-b border-brand-100 px-6 py-5">
            <div className="min-w-0 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium text-brand-500">
                <span className={cn("h-2 w-2 rounded-full", severityDotClass(group.severity))} />
                <span>{sev.label}</span>
                <span className="text-brand-300">·</span>
                <span
                  className={cn(
                    "font-semibold",
                    guide.difficulty === "no_code" ? "text-success-700" : "text-brand-700",
                  )}
                >
                  {guide.difficultyLabel}
                </span>
                <span className="text-brand-300">·</span>
                <span className="inline-flex items-center gap-1 font-mono">
                  <Clock size={11} />
                  ~{guide.estimatedTime}
                </span>
              </div>
              <h1 id={titleId} className="text-[16px] font-bold leading-snug tracking-tight text-brand-950">
                {group.title}
              </h1>
            </div>
            <form method="dialog">
              <button
                type="submit"
                autoFocus
                aria-label="Close issue guide"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-brand-400 hover:bg-brand-100 hover:text-brand-950 transition cursor-pointer"
              >
                <X size={16} />
              </button>
            </form>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            {/* Plain-English What's Happening */}
            <div className="space-y-1.5">
              <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-brand-400">
                <HelpCircle size={12} className="text-accent-500" />
                <span>What’s happening</span>
              </p>
              <p className="text-[13px] leading-relaxed text-brand-800">
                {guide.whatIsWrong}
              </p>
            </div>

            {/* Why It Matters */}
            <div className="rounded-xl border border-brand-200/70 bg-surface-2 p-4 space-y-1.5">
              <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-brand-500">
                <Lightbulb size={12} className="text-warning-500" />
                <span>Why it matters</span>
              </p>
              <p className="text-[12.5px] leading-relaxed text-brand-800">
                {guide.whyItMatters}
              </p>
            </div>

            {/* Step-by-Step Solution by Platform */}
            <div className="space-y-3">
              <div>
                <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-brand-400">
                  <Sparkles size={12} className="text-signal-500" />
                  <span>Step-by-step solution</span>
                </p>
                <div
                  role="tablist"
                  aria-label="Choose your website platform"
                  className="mt-2 inline-flex flex-wrap items-center gap-1 rounded-xl border border-brand-200/70 bg-surface-2 p-1 text-[11px]"
                >
                  {GUIDE_PLATFORMS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      role="tab"
                      aria-selected={platform === p.id}
                      onClick={() => handleSelectPlatform(p.id)}
                      className={cn(
                        "rounded-lg px-2 py-1 font-semibold transition cursor-pointer",
                        platform === p.id
                          ? "bg-signal-400 text-signal-ink font-bold shadow-2xs"
                          : "text-brand-600 hover:text-brand-950",
                      )}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <ol className="space-y-2">
                {guide.platformSteps[platform].map((step, idx) => (
                  <li key={idx} className="flex items-start gap-2.5 text-[12.5px] leading-relaxed text-brand-800">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-signal-400/20 font-mono text-[10.5px] font-bold text-brand-950">
                      {idx + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>

              {guide.verifySteps.length > 0 && (
                <div className="space-y-1 border-t border-brand-100 pt-2.5">
                  {guide.verifySteps.map((v, idx) => (
                    <p key={idx} className="flex items-start gap-1.5 text-[11.5px] text-brand-500">
                      <CheckCircle2 size={12} className="mt-0.5 shrink-0 text-success-600" />
                      <span>{v}</span>
                    </p>
                  ))}
                </div>
              )}
            </div>

            {/* Affected Pages */}
            {group.sampleUrls.length > 0 && (
              <div className="space-y-2 border-t border-brand-100 pt-4">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold uppercase tracking-wider text-brand-400">
                    Affected pages ({group.affectedCount})
                  </span>
                  <Link
                    href="/website?tab=issues"
                    className="font-semibold text-brand-600 hover:text-brand-950 transition"
                  >
                    View all →
                  </Link>
                </div>
                <ul className="divide-y divide-brand-100 rounded-xl border border-brand-200/70 bg-surface-1">
                  {group.sampleUrls.slice(0, 5).map((u) => (
                    <li key={u} className="flex items-center justify-between gap-2 px-3 py-2 text-[12px]">
                      <span className="truncate font-mono text-brand-700" title={u}>
                        {u.replace(/^https?:\/\//, "")}
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

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-brand-100 px-6 py-4">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopyHandoff}
                className="inline-flex items-center gap-1.5 rounded-xl border border-brand-200 bg-surface-1 px-3 py-2 text-[12px] font-semibold text-brand-800 hover:bg-brand-100 transition cursor-pointer"
              >
                {copied ? <Check size={13} className="text-success-600" /> : <Copy size={13} />}
                <span>{copied ? "Copied!" : "Copy for Developer"}</span>
              </button>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(guide.developerHandoff)}`}
                target="_blank"
                rel="noopener noreferrer"
                title="Send instructions on WhatsApp"
                aria-label="Send fix instructions on WhatsApp"
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-brand-200 bg-surface-1 text-brand-700 hover:bg-brand-100 hover:text-brand-950 transition"
              >
                <MessageSquare size={14} />
              </a>
            </div>
            <Link
              href="/fix-engine"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-signal-400 px-4 py-2 text-[12px] font-bold text-signal-ink hover:bg-signal-500 transition shadow-xs"
            >
              <span>Open Action Plan</span>
              <ArrowRight size={13} />
            </Link>
          </div>
        </>
      )}
    </dialog>
  );
}
