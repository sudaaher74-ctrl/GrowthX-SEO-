"use client";

import { useEffect, useState } from "react";
import { Check, Loader2, Brain, FileSearch, Globe, Layers, PenLine, ShieldCheck } from "lucide-react";

/**
 * The six stages `MarketResearchService.ask` actually runs, in order.
 *
 * Named from the pipeline rather than invented for the animation: 1 classify
 * and plan, 2 retrieve this client's own pages and AI-visibility history,
 * 3 search the public web, 4 assemble and persist the citable set, 5 write the
 * answer, 6 re-check every citation against that set. `weight` is a rough share
 * of a typical run, used only to pace the indicator.
 */
const STAGES = [
  { id: "classify", label: "Understanding the question", detail: "Classifying intent and planning what to retrieve", icon: Brain, weight: 0.08 },
  { id: "client", label: "Reading this client's data", detail: "Crawled pages, tracked prompts and AI-visibility history", icon: FileSearch, weight: 0.14 },
  { id: "web", label: "Searching the public web", detail: "Only pages the search actually opened become citable", icon: Globe, weight: 0.34 },
  { id: "assemble", label: "Assembling the evidence set", detail: "De-duplicating and storing every source before answering", icon: Layers, weight: 0.1 },
  { id: "answer", label: "Writing the answer", detail: "Separating what is evidenced from what is inferred", icon: PenLine, weight: 0.28 },
  { id: "verify", label: "Checking every citation", detail: "Claims pointing at a source that was not retrieved are dropped", icon: ShieldCheck, weight: 0.06 },
] as const;

/** Typical end-to-end run. Only paces the indicator; nothing depends on it. */
const TYPICAL_RUN_MS = 22_000;

/**
 * What the software is doing while a research question is in flight.
 *
 * An honest caveat, stated here because it is invisible from the outside: the
 * ask endpoint is a single POST that returns the finished answer, so this
 * component does not receive live per-stage telemetry. It paces the stage list
 * against a typical run instead. The stages themselves are real and always run
 * in this order, and the last one never completes on its own — it keeps
 * spinning until the response lands, so the indicator can run behind a slow
 * request but never claims to have finished work that has not returned.
 *
 * Making this genuinely live means streaming the run (SSE, one event per stage)
 * and driving `activeIndex` off those events, at which point the timer below
 * can be deleted without touching the markup.
 */
export function ResearchActivity({ question }: { question: string }) {
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    const startedAt = Date.now();
    const timer = setInterval(() => setElapsedMs(Date.now() - startedAt), 200);
    return () => clearInterval(timer);
  }, [question]);

  const progress = Math.min(elapsedMs / TYPICAL_RUN_MS, 1);

  // The final stage is never auto-completed: a run that outlives the estimate
  // parks there rather than showing six ticks beside a spinner.
  let cumulative = 0;
  let activeIndex = STAGES.length - 1;
  for (let i = 0; i < STAGES.length; i += 1) {
    cumulative += STAGES[i].weight;
    if (progress < cumulative) {
      activeIndex = i;
      break;
    }
  }

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
            <p className="text-[13px] font-semibold text-[var(--text-primary)]">Researching</p>
            <p className="truncate text-[11.5px] text-[var(--text-muted)]">{question}</p>
          </div>
        </div>
        <span className="shrink-0 font-mono text-[11px] tabular-nums text-[var(--text-muted)]">{seconds}s</span>
      </div>

      <ol className="space-y-0.5 p-3">
        {STAGES.map((stage, i) => {
          const done = i < activeIndex;
          const active = i === activeIndex;
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
                {active && (
                  <p className="mt-0.5 text-[11px] leading-relaxed text-[var(--text-muted)]">{stage.detail}</p>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      <div className="h-0.5 w-full bg-[var(--surface-2)]">
        <div
          className="h-full bg-gradient-to-r from-blue-600 to-indigo-600 transition-all duration-200 ease-linear"
          style={{ width: `${Math.max(progress * 100, 4)}%` }}
        />
      </div>
    </div>
  );
}
