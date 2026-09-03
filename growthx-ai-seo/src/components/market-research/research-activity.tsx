"use client";

import { useEffect, useState } from "react";
import { Check, Loader2, Brain, FileSearch, Globe, Layers, PenLine, ShieldCheck } from "lucide-react";
import type { ResearchStage } from "@/lib/api-client";

/**
 * The six stages `MarketResearchService.ask` runs, in order.
 *
 * Named from the pipeline rather than invented for the animation: 1 classify
 * and plan, 2 retrieve this client's own pages and AI-visibility history,
 * 3 search the public web, 4 assemble and persist the citable set, 5 write the
 * answer, 6 re-check every citation against that set.
 */
const STAGES: Array<{ id: ResearchStage; label: string; fallbackDetail: string; icon: typeof Brain }> = [
  { id: "classify", label: "Understanding the question", fallbackDetail: "Classifying intent and planning what to retrieve", icon: Brain },
  { id: "client", label: "Reading this client's data", fallbackDetail: "Crawled pages, tracked prompts and AI-visibility history", icon: FileSearch },
  { id: "web", label: "Searching the public web", fallbackDetail: "Only pages the search actually opened become citable", icon: Globe },
  { id: "assemble", label: "Assembling the evidence set", fallbackDetail: "De-duplicating and storing every source before answering", icon: Layers },
  { id: "answer", label: "Writing the answer", fallbackDetail: "Separating what is evidenced from what is inferred", icon: PenLine },
  { id: "verify", label: "Checking every citation", fallbackDetail: "Claims pointing at a source that was not retrieved are dropped", icon: ShieldCheck },
];

export type StageProgress = Partial<Record<ResearchStage, { status: "started" | "done"; detail?: string }>>;

/**
 * What the software is doing while a research question is in flight.
 *
 * Driven by real server-sent events: the backend emits each stage as it starts
 * and finishes, along with what it found — "7 pages from the crawl",
 * "12 citable sources" — and those lines are the server's, not this
 * component's guess at them.
 *
 * The one case with nothing to render is an API that predates the streaming
 * route, where the client falls back to the one-shot call and no event ever
 * arrives. Rather than sit blank, the list then shows the same stages as
 * pending with a note that progress is unavailable, which is the honest
 * description of that state.
 */
export function ResearchActivity({ question, progress }: { question: string; progress: StageProgress }) {
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    const startedAt = Date.now();
    const timer = setInterval(() => setElapsedMs(Date.now() - startedAt), 250);
    return () => clearInterval(timer);
  }, [question]);

  const reported = STAGES.filter((s) => progress[s.id]).length;
  const completed = STAGES.filter((s) => progress[s.id]?.status === "done").length;
  const isLive = reported > 0;

  // Only ever what the server has confirmed finished, so the bar cannot run
  // ahead of the work.
  const percent = (completed / STAGES.length) * 100;
  const seconds = Math.floor(elapsedMs / 1000);

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--border-color)] bg-[var(--surface-1)]">
      <div className="flex items-center justify-between gap-3 border-b border-[var(--border-color)] px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="relative flex h-7 w-7 shrink-0 items-center justify-center">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-500/20" />
            <span className="relative inline-flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-white">
              <Loader2 size={14} className="animate-spin" />
            </span>
          </span>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-[var(--text-primary)]">
              Researching
              {isLive && (
                <span className="ml-1.5 align-middle text-[10px] font-medium uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  live
                </span>
              )}
            </p>
            <p className="truncate text-[11.5px] text-[var(--text-muted)]">{question}</p>
          </div>
        </div>
        <span className="shrink-0 font-mono text-[11px] tabular-nums text-[var(--text-muted)]">{seconds}s</span>
      </div>

      <ol className="space-y-0.5 p-3">
        {STAGES.map((stage) => {
          const state = progress[stage.id];
          const done = state?.status === "done";
          const active = state?.status === "started";
          const Icon = stage.icon;

          return (
            <li
              key={stage.id}
              className={`flex items-start gap-2.5 rounded-lg px-2.5 py-2 transition-colors ${
                active ? "bg-blue-500/5" : ""
              }`}
            >
              <span
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors ${
                  done
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    : active
                      ? "border-blue-500/40 bg-blue-500/10 text-blue-600 dark:text-blue-400"
                      : "border-[var(--border-color)] bg-[var(--surface-2)] text-[var(--text-muted)]"
                }`}
              >
                {done ? (
                  <Check size={11} strokeWidth={3} />
                ) : active ? (
                  <Loader2 size={11} className="animate-spin" />
                ) : (
                  <Icon size={11} />
                )}
              </span>

              <div className="min-w-0">
                <p
                  className={`text-[12.5px] leading-tight transition-colors ${
                    done
                      ? "text-[var(--text-secondary)]"
                      : active
                        ? "font-semibold text-[var(--text-primary)]"
                        : "text-[var(--text-muted)]"
                  }`}
                >
                  {stage.label}
                </p>
                {/* The server's own line where it sent one — it names what was
                    actually found — and the stage description otherwise. */}
                {(active || done) && (
                  <p className="mt-0.5 text-[11px] leading-relaxed text-[var(--text-muted)]">
                    {state?.detail ?? stage.fallbackDetail}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {!isLive && seconds > 3 && (
        <p className="px-4 pb-3 text-[11px] text-[var(--text-muted)]">
          This API version does not report progress, so the run is shown without stage detail. The
          answer is unaffected.
        </p>
      )}

      <div className="h-0.5 w-full bg-[var(--surface-2)]">
        <div
          className="h-full bg-gradient-to-r from-blue-600 to-indigo-600 transition-all duration-500 ease-out"
          style={{ width: `${Math.max(percent, 2)}%` }}
        />
      </div>
    </div>
  );
}
