"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  Layers,
  Loader2,
  RefreshCw,
  X,
} from "lucide-react";
import type { AutopilotRun, PipelineStage } from "@/lib/api-types";
import {
  useCancelWorkspacePipeline,
  useConfirmWorkspacePipeline,
} from "@/hooks/use-growthx";
import { errorMessage } from "@/lib/error-message";
import { cn } from "@/lib/utils";

const DEFAULT_STAGES: PipelineStage[] = [
  { id: "WEBSITE", label: "Website Audit", status: "PENDING", detail: "Waiting to start", href: "/website" },
  { id: "COMPETITORS", label: "Competitors", status: "PENDING", detail: "Waiting for discovery", href: "/competitor-intelligence" },
  { id: "AI_VISIBILITY", label: "AI Visibility", status: "PENDING", detail: "Waiting for scan", href: "/ai-visibility" },
  { id: "BACKLINKS", label: "Backlinks", status: "PENDING", detail: "Waiting for discovery", href: "/backlinks" },
  { id: "FIX_ENGINE", label: "Fix Engine", status: "PENDING", detail: "Waiting for plan sync", href: "/fix-engine" },
];

const ACTIVE_STATUSES = new Set(["DISCOVERING", "AWAITING_CONFIRMATION", "RUNNING"]);

function stageStatusStyles(status: PipelineStage["status"]) {
  switch (status) {
    case "DONE":
      return {
        ring: "border-success-500/40 bg-success-50/70 text-success-700",
        dot: "bg-success-500 text-surface-1",
        label: "Done",
      };
    case "RUNNING":
      return {
        ring: "border-signal-400/70 bg-signal-400/10 text-brand-950",
        dot: "bg-signal-400 text-signal-ink",
        label: "Running",
      };
    case "WAITING":
      return {
        ring: "border-warning-500/50 bg-warning-50 text-warning-700",
        dot: "bg-warning-500 text-surface-1",
        label: "Needs input",
      };
    case "FAILED":
      return {
        ring: "border-error-500/40 bg-error-50 text-error-700",
        dot: "bg-error-500 text-surface-1",
        label: "Failed",
      };
    default:
      return {
        ring: "border-brand-200/80 bg-surface-2/60 text-brand-500",
        dot: "bg-brand-200 text-brand-600",
        label: "Pending",
      };
  }
}

export function WorkspacePipelineBar({
  projectId,
  pipeline,
  onRetry,
  retrying,
}: {
  projectId: string | null;
  pipeline: AutopilotRun | null | undefined;
  onRetry: () => void;
  retrying?: boolean;
}) {
  const confirmMutation = useConfirmWorkspacePipeline(projectId);
  const cancelMutation = useCancelWorkspacePipeline(projectId);
  const [dismissedRunId, setDismissedRunId] = useState<string | null>(null);
  const [selectionState, setSelectionState] = useState<{ runId: string; domains: string[] } | null>(null);

  if (!pipeline) return null;

  const isActive = ACTIVE_STATUSES.has(pipeline.status);
  const isWaiting = pipeline.status === "AWAITING_CONFIRMATION";
  const isFailed = pipeline.status === "FAILED";
  const isDone = pipeline.status === "DONE";

  if (!isActive && !isFailed && !isDone) return null;
  if ((isDone || isFailed) && dismissedRunId === pipeline.id) return null;

  const stages = pipeline.stages && pipeline.stages.length > 0 ? pipeline.stages : DEFAULT_STAGES;
  const doneCount = stages.filter((s) => s.status === "DONE").length;
  const progressPct = isDone ? 100 : Math.round((doneCount / stages.length) * 100);

  const suggestions = pipeline.suggestions ?? [];
  const defaultSelected = suggestions.slice(0, 3).map((s) => s.domain);
  const selectedDomains =
    selectionState?.runId === pipeline.id ? selectionState.domains : defaultSelected;

  const toggleDomain = (domain: string) => {
    const next = selectedDomains.includes(domain)
      ? selectedDomains.filter((d) => d !== domain)
      : selectedDomains.length >= 3
        ? selectedDomains
        : [...selectedDomains, domain];
    setSelectionState({ runId: pipeline.id, domains: next });
  };

  const actionError = confirmMutation.error || cancelMutation.error;

  return (
    <section
      aria-label="Full workspace pipeline progress"
      className={cn(
        "rounded-2xl border p-4 shadow-2xs transition-colors",
        isFailed
          ? "border-error-500/40 bg-error-50/40"
          : isWaiting
            ? "border-warning-500/50 bg-surface-1"
            : isDone
              ? "border-success-500/35 bg-surface-1"
              : "border-signal-400/50 bg-surface-1",
      )}
    >
      {/* Top Row: Pipeline Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl font-bold",
              isFailed
                ? "bg-error-500/15 text-error-600"
                : isDone
                  ? "bg-success-500/15 text-success-700"
                  : "bg-signal-400 text-signal-ink",
            )}
          >
            {isFailed ? (
              <AlertTriangle size={15} />
            ) : isDone ? (
              <CheckCircle2 size={15} />
            ) : isActive ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Layers size={15} />
            )}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[13.5px] font-bold text-brand-950">
                Full Workspace Growth Pipeline
              </h2>
              <span className="rounded-full border border-brand-200 bg-surface-2 px-2 py-0.5 font-mono text-[10px] font-bold text-brand-700">
                {doneCount}/{stages.length} stages · {progressPct}%
              </span>
              {isWaiting && (
                <span className="rounded-full bg-warning-50 border border-warning-500/40 px-2 py-0.5 text-[10px] font-bold text-warning-700">
                  Action required: Confirm rivals
                </span>
              )}
              {isDone && (
                <span className="rounded-full bg-success-50 border border-success-500/30 px-2 py-0.5 text-[10px] font-bold text-success-700">
                  All reports refreshed
                </span>
              )}
            </div>
            <p className="mt-0.5 text-[11.5px] text-brand-500 truncate">
              {isFailed
                ? pipeline.error || "Pipeline stopped before completing all stages."
                : isWaiting
                  ? `Discovered ${suggestions.length} competitor candidate(s) for ${pipeline.domain}. Pick up to 3 to crawl and benchmark.`
                  : isDone
                    ? `Completed full cross-module sync for ${pipeline.domain}. Every tab & report now reflects fresh data.`
                    : `Running autonomous audit, competitor, AI visibility, backlink, and Fix Engine sync for ${pipeline.domain}…`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isActive && (
            <button
              type="button"
              disabled={cancelMutation.isPending}
              onClick={() => cancelMutation.mutate({ runId: pipeline.id })}
              className="rounded-full border border-brand-200 bg-surface-2 px-3 py-1 text-[11px] font-semibold text-brand-600 hover:text-error-600 hover:border-error-500/40 transition cursor-pointer disabled:opacity-50"
            >
              {cancelMutation.isPending ? "Stopping…" : "Stop run"}
            </button>
          )}
          {(isFailed || isDone) && (
            <>
              <button
                type="button"
                disabled={retrying}
                onClick={onRetry}
                className="inline-flex items-center gap-1 rounded-full border border-brand-200 bg-surface-2 px-3 py-1 text-[11px] font-semibold text-brand-800 hover:bg-surface-3 transition cursor-pointer disabled:opacity-50"
              >
                <RefreshCw size={11} className={retrying ? "animate-spin" : undefined} />
                <span>{isFailed ? "Retry pipeline" : "Run again"}</span>
              </button>
              <button
                type="button"
                onClick={() => setDismissedRunId(pipeline.id)}
                aria-label="Dismiss pipeline summary"
                className="flex h-7 w-7 items-center justify-center rounded-full border border-brand-200 bg-surface-2 text-brand-500 hover:text-brand-950 cursor-pointer"
              >
                <X size={13} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* 5-Stage Horizontal Stepper */}
      <ol className="mt-3.5 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {stages.map((stage, idx) => {
          const styles = stageStatusStyles(stage.status);
          return (
            <li key={stage.id}>
              <Link
                href={stage.href}
                className={cn(
                  "group flex h-full flex-col justify-between gap-1.5 rounded-xl border p-2.5 transition-all hover:shadow-xs",
                  styles.ring,
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span
                      className={cn(
                        "flex h-5 w-5 shrink-0 items-center justify-center rounded-full font-mono text-[10px] font-bold",
                        styles.dot,
                      )}
                    >
                      {stage.status === "DONE" ? (
                        <Check size={11} strokeWidth={3} />
                      ) : stage.status === "RUNNING" ? (
                        <Loader2 size={11} className="animate-spin" />
                      ) : stage.status === "FAILED" ? (
                        <AlertTriangle size={10} />
                      ) : (
                        idx + 1
                      )}
                    </span>
                    <span className="truncate text-[12px] font-bold text-brand-950">
                      {stage.label}
                    </span>
                  </div>
                  <ArrowRight
                    size={12}
                    className="shrink-0 text-brand-400 transition-transform group-hover:translate-x-0.5 group-hover:text-brand-950"
                  />
                </div>
                <p className="line-clamp-2 text-[10.5px] leading-snug text-brand-600">
                  {stage.detail}
                </p>
              </Link>
            </li>
          );
        })}
      </ol>

      {/* Inline Competitor Confirmation when paused at AWAITING_CONFIRMATION */}
      {isWaiting && (
        <div className="mt-3.5 rounded-xl border border-warning-500/40 bg-surface-2/80 p-3.5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-bold text-brand-950">
                Confirm up to 3 competitors to crawl &amp; compare
              </p>
              <p className="text-[11px] text-brand-500">
                Selected: {selectedDomains.length}/3 — or skip rivals to run AI Visibility, Backlinks, and Fix Engine directly.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={confirmMutation.isPending}
                onClick={() => confirmMutation.mutate({ runId: pipeline.id, domains: [] })}
                className="rounded-full border border-brand-200 bg-surface-1 px-3 py-1.5 text-[11px] font-semibold text-brand-700 hover:text-brand-950 transition cursor-pointer disabled:opacity-50"
              >
                Skip competitors
              </button>
              <button
                type="button"
                disabled={confirmMutation.isPending}
                onClick={() =>
                  confirmMutation.mutate({ runId: pipeline.id, domains: selectedDomains })
                }
                className="inline-flex items-center gap-1.5 rounded-full bg-signal-400 px-3.5 py-1.5 text-[11.5px] font-extrabold text-signal-ink hover:bg-signal-500 transition cursor-pointer disabled:opacity-50"
              >
                {confirmMutation.isPending ? (
                  <>
                    <Loader2 size={12} className="animate-spin" />
                    <span>Starting crawls…</span>
                  </>
                ) : (
                  <>
                    <span>Confirm ({selectedDomains.length}) &amp; Continue</span>
                    <ArrowRight size={12} />
                  </>
                )}
              </button>
            </div>
          </div>

          {suggestions.length > 0 && (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {suggestions.map((s) => {
                const picked = selectedDomains.includes(s.domain);
                return (
                  <label
                    key={s.domain}
                    className={cn(
                      "flex items-start gap-2.5 rounded-xl border p-2.5 text-left transition cursor-pointer",
                      picked
                        ? "border-signal-400 bg-surface-1 shadow-2xs"
                        : "border-brand-200 bg-surface-1/60 hover:border-brand-300",
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={picked}
                      onChange={() => toggleDomain(s.domain)}
                      className="mt-0.5 h-3.5 w-3.5 rounded border-brand-300 shrink-0"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-bold text-brand-950">
                        {s.name || s.domain}
                      </span>
                      <span className="block truncate font-mono text-[10.5px] text-brand-500">
                        {s.domain}
                      </span>
                      {s.reason && (
                        <span className="mt-0.5 line-clamp-2 block text-[10.5px] text-brand-500">
                          {s.reason}
                        </span>
                      )}
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </div>
      )}

      {actionError && (
        <p role="alert" className="mt-2.5 text-xs font-medium text-error-600">
          {errorMessage(actionError)}
        </p>
      )}

      {/* Compact Expandable Live Activity Log */}
      {pipeline.log && pipeline.log.length > 0 && (
        <details className="mt-3 border-t border-brand-200/70 pt-2.5">
          <summary className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-brand-500 hover:text-brand-950 cursor-pointer">
            <Clock size={11} />
            <span>Pipeline activity log ({pipeline.log.length} events)</span>
          </summary>
          <ul className="mt-2 max-h-36 space-y-1 overflow-y-auto rounded-xl border border-brand-200/70 bg-surface-2/60 p-2.5 font-mono text-[10.5px] text-brand-600">
            {[...pipeline.log].reverse().slice(0, 12).map((entry, idx) => (
              <li key={`${entry.at}-${idx}`} className="flex items-start gap-2">
                <span className="shrink-0 text-brand-400">
                  {new Date(entry.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </span>
                <span className="text-brand-800">{entry.message}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
