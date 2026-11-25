"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Loader2,
  X,
} from "lucide-react";
import { api, type AutopilotRun, type PipelineStage } from "@/lib/api-client";
import { useWorkspacePipeline } from "@/hooks/use-growthx";
import { cn } from "@/lib/utils";

const ACTIVE_STATUSES = new Set(["DISCOVERING", "AWAITING_CONFIRMATION", "RUNNING"]);
const DONE_BANNER_WINDOW_MS = 10 * 60 * 1000;

function stageProgressLabel(run: AutopilotRun): string {
  if (run.status === "DISCOVERING") return "2/5 Finding rivals";
  if (run.status === "AWAITING_CONFIRMATION") return "3/5 Confirm rivals";
  if (run.status === "RUNNING") {
    if (run.step === "REPORT") return "5/5 Syncing plan";
    const doneStages = (run.stages ?? []).filter((s) => s.status === "DONE").length;
    return `${Math.min(4, Math.max(1, doneStages + 1))}/5 Running`;
  }
  if (run.status === "DONE") return "Plan ready";
  return "Pipeline";
}

function StageIcon({ status }: { status: PipelineStage["status"] }) {
  if (status === "DONE") return <CheckCircle2 size={14} className="shrink-0 text-success-600" />;
  if (status === "RUNNING") return <Loader2 size={14} className="shrink-0 animate-spin text-primary-600" />;
  if (status === "WAITING") return <Clock size={14} className="shrink-0 text-warning-600" />;
  if (status === "FAILED") return <AlertCircle size={14} className="shrink-0 text-error-600" />;
  return <span className="h-2.5 w-2.5 shrink-0 rounded-full border border-brand-300 bg-surface-2" />;
}

/**
 * Compact top-bar pill + dropdown popover for the Zero-Touch Workspace Pipeline.
 * Only renders when a pipeline is running, waiting for rival confirmation, or
 * finished recently — otherwise falls back to the lightweight manual-crawl pill
 * (or renders nothing when idle).
 */
export function PipelineStatusPill({
  projectId,
  isManualCrawling,
  manualCrawlPages,
}: {
  projectId: string | null;
  isManualCrawling: boolean;
  manualCrawlPages?: number | null;
}) {
  const queryClient = useQueryClient();
  const pipeline = useWorkspacePipeline(projectId);
  const run = pipeline.data ?? null;

  const [open, setOpen] = useState(false);
  const [dismissedId, setDismissedId] = useState<string | null>(null);
  const [selectedDomains, setSelectedDomains] = useState<string[]>([]);
  const [selectionRunId, setSelectionRunId] = useState<string | null>(null);
  const [mountTimeMs] = useState(() => Date.now());
  const containerRef = useRef<HTMLDivElement>(null);

  // Close popover on outside click
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener("mousedown", onPointerDown);
    return () => window.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  const confirmMutation = useMutation({
    mutationFn: ({ runId, domains }: { runId: string; domains: string[] }) =>
      api.autopilot.confirm(runId, domains),
    onSuccess: (updated) => {
      queryClient.setQueryData(["workspace-pipeline", projectId], updated);
      void queryClient.invalidateQueries({ queryKey: ["workspace-pipeline", projectId] });
      void queryClient.invalidateQueries({ queryKey: ["competitors", projectId] });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (runId: string) => api.autopilot.cancel(runId),
    onSuccess: (updated) => {
      queryClient.setQueryData(["workspace-pipeline", projectId], updated);
      void queryClient.invalidateQueries({ queryKey: ["workspace-pipeline", projectId] });
      setOpen(false);
    },
  });

  const isPipelineActive = Boolean(run && ACTIVE_STATUSES.has(run.status));
  const finishedAtMs = run?.finishedAt ? new Date(run.finishedAt).getTime() : null;
  const isRecentlyDone = Boolean(
    run &&
      run.status === "DONE" &&
      dismissedId !== run.id &&
      finishedAtMs !== null &&
      mountTimeMs - finishedAtMs < DONE_BANNER_WINDOW_MS,
  );

  // If no pipeline pill should show, preserve the exact existing manual-crawl pill
  if (!run || (!isPipelineActive && !isRecentlyDone)) {
    if (!isManualCrawling) return null;
    return (
      <Link
        href="/website"
        title="Crawl audit in progress. Click to view live audit."
        className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-primary-300/80 bg-primary-50/80 px-2.5 py-0.5 text-xs font-semibold text-primary-900 transition hover:bg-primary-100 shadow-2xs"
      >
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-primary-600" />
        </span>
        <span className="font-mono text-[11px] font-bold">
          Auditing {manualCrawlPages ? `(${manualCrawlPages} pgs)` : "site..."}
        </span>
      </Link>
    );
  }

  // Derive active rival selection for the current run without setState-in-effect
  const effectiveSelected =
    selectionRunId === run.id
      ? selectedDomains
      : run.suggestions.slice(0, 3).map((s) => s.domain);

  const toggleDomain = (domain: string) => {
    setSelectionRunId(run.id);
    const current = effectiveSelected;
    if (current.includes(domain)) {
      setSelectedDomains(current.filter((d) => d !== domain));
    } else if (current.length < 3) {
      setSelectedDomains([...current, domain]);
    }
  };

  const needsAction = run.status === "AWAITING_CONFIRMATION";
  const isDone = run.status === "DONE";

  return (
    <div ref={containerRef} className="relative hidden sm:block shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap shrink-0 transition shadow-2xs cursor-pointer tabular-nums",
          needsAction
            ? "border-warning-200 bg-warning-50 text-warning-700 hover:bg-warning-100"
            : isDone
              ? "border-success-200 bg-success-50 text-success-700 hover:bg-success-100"
              : "border-accent-200 bg-accent-50 text-accent-700 hover:bg-accent-100",
        )}
      >
        {isDone ? (
          <Check size={12} className="text-success-600 shrink-0" />
        ) : (
          <span className="relative flex h-2 w-2 shrink-0" aria-hidden="true">
            <span
              className={cn(
                "absolute inline-flex h-full w-full animate-ping rounded-full opacity-75",
                needsAction ? "bg-warning-500" : "bg-accent-400",
              )}
            />
            <span
              className={cn(
                "relative inline-flex h-2 w-2 rounded-full",
                needsAction ? "bg-warning-500" : "bg-accent-600",
              )}
            />
          </span>
        )}
        <span className="font-mono text-[11px] font-semibold">{stageProgressLabel(run)}</span>
        <ChevronDown size={12} className={cn("shrink-0 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-2 z-50 w-80 rounded-2xl border border-brand-200 bg-surface-1 p-4 shadow-xl space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs font-bold text-brand-950">Workspace Pipeline</p>
              <p className="text-[11px] text-brand-500">{run.domain}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                if (isDone) setDismissedId(run.id);
                setOpen(false);
              }}
              aria-label="Close pipeline status"
              className="rounded-lg p-1 text-brand-400 hover:bg-surface-2 hover:text-brand-900 cursor-pointer"
            >
              <X size={14} />
            </button>
          </div>

          {/* 5 Live Pipeline Stages */}
          {run.stages && run.stages.length > 0 && (
            <ul className="space-y-1.5">
              {run.stages.map((stage) => (
                <li key={stage.id}>
                  <Link
                    href={stage.href}
                    onClick={() => setOpen(false)}
                    className="flex items-center justify-between gap-2 rounded-xl border border-brand-200/70 bg-surface-2/60 px-2.5 py-2 hover:bg-surface-2 transition"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <StageIcon status={stage.status} />
                      <div className="min-w-0">
                        <p className="text-[11.5px] font-semibold text-brand-950 truncate">{stage.label}</p>
                        <p className="text-[10.5px] text-brand-500 truncate">{stage.detail}</p>
                      </div>
                    </div>
                    <ArrowRight size={12} className="shrink-0 text-brand-400" />
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {/* Inline Rival Confirmation */}
          {needsAction && run.suggestions.length > 0 && (
            <div className="rounded-xl border border-signal-400/50 bg-signal-400/10 p-2.5 space-y-2">
              <p className="text-[11px] font-bold text-brand-950">
                Confirm up to 3 competitors to continue:
              </p>
              <div className="space-y-1 max-h-36 overflow-y-auto">
                {run.suggestions.map((s) => {
                  const checked = effectiveSelected.includes(s.domain);
                  return (
                    <label
                      key={s.domain}
                      className="flex items-center gap-2 rounded-lg bg-surface-1 px-2 py-1.5 text-[11px] cursor-pointer hover:bg-surface-2"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleDomain(s.domain)}
                        className="rounded border-brand-300"
                      />
                      <span className="font-semibold text-brand-950 truncate">{s.name}</span>
                      <span className="ml-auto font-mono text-[10px] text-brand-400 truncate max-w-[110px]">
                        {s.domain}
                      </span>
                    </label>
                  );
                })}
              </div>
              <button
                type="button"
                disabled={effectiveSelected.length === 0 || confirmMutation.isPending}
                onClick={() => confirmMutation.mutate({ runId: run.id, domains: effectiveSelected })}
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-signal-400 px-3 py-1.5 text-xs font-bold text-signal-ink hover:bg-signal-500 transition disabled:opacity-50 cursor-pointer"
              >
                <span>{confirmMutation.isPending ? "Starting scans…" : "Confirm & Continue"}</span>
                <ArrowRight size={12} />
              </button>
            </div>
          )}

          {/* Footer actions */}
          <div className="flex items-center justify-between gap-2 border-t border-brand-200/70 pt-2.5">
            {isPipelineActive ? (
              <button
                type="button"
                disabled={cancelMutation.isPending}
                onClick={() => cancelMutation.mutate(run.id)}
                className="rounded-lg border border-brand-200 bg-surface-1 px-2.5 py-1 text-[11px] font-semibold text-brand-600 hover:border-error-300 hover:bg-error-50 hover:text-error-700 transition cursor-pointer disabled:opacity-50"
              >
                {cancelMutation.isPending ? "Stopping…" : "Cancel pipeline"}
              </button>
            ) : (
              <span className="text-[10.5px] text-brand-500">All manual tabs remain unlocked</span>
            )}
            <Link
              href="/fix-engine"
              onClick={() => {
                if (isDone) setDismissedId(run.id);
                setOpen(false);
              }}
              className="inline-flex items-center gap-1 rounded-lg bg-brand-950 px-2.5 py-1 text-[11px] font-semibold text-brand-50 hover:bg-brand-800 transition"
            >
              <span>Open Fix Engine</span>
              <ArrowRight size={11} />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
