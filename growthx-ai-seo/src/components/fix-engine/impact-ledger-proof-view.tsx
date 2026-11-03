"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  ExternalLink,
  GitPullRequest,
  History,
  Layers,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { ActionButton, Panel, Pill, relativeTime } from "@/components/ui/console";
import { FailedState, LoadingState } from "@/components/ui/truthful-state";
import { errorMessage } from "@/lib/error-message";
import { api } from "@/lib/api-client";
import type { FixLedgerEntry, ProofOfImpactCard } from "@/lib/api-types";
import { cn } from "@/lib/utils";

type LedgerCategoryFilter = "ALL" | "BASELINE" | "PR" | "DEPLOYMENT" | "LOOP";

export function ImpactLedgerProofView({
  projectId,
  onLaunchIteration,
  onNavigateTab,
}: {
  projectId: string;
  onLaunchIteration?: (instruction: string) => void;
  onNavigateTab?: (tab: "improvement" | "github-fixes") => void;
}) {
  const queryClient = useQueryClient();
  const [subView, setSubView] = useState<"PROOF" | "LEDGER">("PROOF");
  const [ledgerFilter, setLedgerFilter] = useState<LedgerCategoryFilter>("ALL");
  const [evaluatingMessage, setEvaluatingMessage] = useState<string | null>(null);

  // 1. Fetch Proof of Impact Cards (30d/90d Before vs Now)
  const proofQuery = useQuery({
    queryKey: ["impact-proof-cards", projectId],
    queryFn: () => api.getFixProofCards(projectId),
    enabled: Boolean(projectId),
    retry: false,
  });

  // 2. Fetch Append-Only Impact Ledger
  const ledgerQuery = useQuery({
    queryKey: ["impact-ledger-stream", projectId],
    queryFn: () => api.getFixImpactLedger(projectId),
    enabled: Boolean(projectId),
    retry: false,
  });

  // 3. Mutation to Trigger Closed-Loop Evaluation
  const evaluateLoopMutation = useMutation({
    mutationFn: () => api.triggerImpactLoop(projectId),
    onSuccess: (data) => {
      setEvaluatingMessage(
        data.loopTriggeredCount > 0
          ? `Reviewed ${data.evaluatedRuns} verified live fixes. No positive change was observed in ${data.loopTriggeredCount} measured comparison; an evidence review was added.`
          : `Reviewed ${data.evaluatedRuns} verified live fixes. Positive changes and measurement windows are shown separately.`,
      );
      queryClient.invalidateQueries({ queryKey: ["impact-proof-cards", projectId] });
      queryClient.invalidateQueries({ queryKey: ["impact-ledger-stream", projectId] });
      queryClient.invalidateQueries({ queryKey: ["findings", projectId] });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err ?? "");
      setEvaluatingMessage(`Evaluation failed: ${msg || "Could not reach the service. Try again."}`);
    },
  });

  const cards = proofQuery.data ?? [];
  const ledgerEvents = ledgerQuery.data ?? [];
  

  const handleEvaluateClick = () => {
    if (cards.length === 0) {
      setEvaluatingMessage(
        "No deployed fixes to evaluate yet. Complete and deploy an improvement from your plan, and the closed-loop engine will automatically track and evaluate its 14d/30d performance.",
      );
      return;
    }
    evaluateLoopMutation.mutate();
  };

  // Filter ledger events based on category
  const filteredEvents = useMemo(() => {
    return ledgerEvents.filter((e) => {
      if (ledgerFilter === "ALL") return true;
      if (ledgerFilter === "BASELINE") {
        return ["PROJECT_INITIALIZED", "BASELINE_CRAWL_COMPLETED", "GROWTH_OPPORTUNITIES_DETECTED"].includes(e.eventType);
      }
      if (ledgerFilter === "PR") {
        return ["PR_CREATED", "PR_MERGED"].includes(e.eventType);
      }
      if (ledgerFilter === "DEPLOYMENT") {
        return ["DEPLOYMENT_VERIFIED", "TECHNICAL_FIX_CONFIRMED"].includes(e.eventType);
      }
      if (ledgerFilter === "LOOP") {
        return ["NO_IMPROVEMENT_DIAGNOSED", "ITERATION_LOOP_TRIGGERED", "IMPACT_CONFIRMED"].includes(e.eventType);
      }
      return true;
    });
  }, [ledgerEvents, ledgerFilter]);

  const verifiedCount = cards.filter((card) => card.after.verificationStatus === "VERIFIED_LIVE").length;
  const measuredCount = cards.filter((card) => card.metrics30d?.status === "OBSERVED" || card.metrics90d?.status === "OBSERVED").length;

  return (
    <div className="space-y-6">
      {/* Overview */}
      <Panel padded>
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-100 text-accent-700">
              <History className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-[18px] font-semibold tracking-tight text-brand-900">Improvement journey</h2>
              <p className="mt-1 text-[13px] leading-5 text-brand-600">Track your changes and see their results over time.</p>
            </div>
          </div>
          <ActionButton variant="secondary" onClick={handleEvaluateClick} disabled={evaluateLoopMutation.isPending}>
            <RefreshCw className={cn("mr-1.5 h-3.5 w-3.5", evaluateLoopMutation.isPending && "animate-spin")} />
            {evaluateLoopMutation.isPending ? "Checking…" : "Recheck results"}
          </ActionButton>
        </div>

        {evaluatingMessage && (
          <div role="status" className="mt-4 flex items-start justify-between gap-3 rounded-lg border border-brand-200 bg-brand-50 p-3 text-[12px] text-brand-800">
            <span className="leading-relaxed">{evaluatingMessage}</span>
            <button onClick={() => setEvaluatingMessage(null)} className="shrink-0 font-semibold text-brand-500 hover:text-brand-800">Dismiss</button>
          </div>
        )}

        <div className="mt-5 grid gap-3 border-t border-brand-200 pt-5 sm:grid-cols-3">
          <div className="rounded-xl border border-brand-200 bg-brand-50/50 px-4 py-3">
            <p className="text-[11px] font-medium text-brand-500">Verified live</p>
            <p className="mt-1 text-[20px] font-semibold leading-none text-brand-900">{proofQuery.isLoading ? "…" : proofQuery.error ? "—" : verifiedCount}</p>
          </div>
          <div className="rounded-xl border border-brand-200 bg-brand-50/50 px-4 py-3">
            <p className="text-[11px] font-medium text-brand-500">With measurements</p>
            <p className="mt-1 text-[20px] font-semibold leading-none text-brand-900">{proofQuery.isLoading ? "…" : proofQuery.error ? "—" : measuredCount}</p>
          </div>
          <div className="rounded-xl border border-brand-200 bg-brand-50/50 px-4 py-3">
            <p className="text-[11px] font-medium text-brand-500">Recent events</p>
            <p className="mt-1 text-[20px] font-semibold leading-none text-brand-900">{ledgerQuery.isLoading ? "…" : ledgerQuery.error ? "—" : ledgerEvents.length}</p>
          </div>
        </div>
      </Panel>

      {/* Sub-view switcher */}
      <div className="flex border-b border-brand-200">
        <button
          onClick={() => setSubView("PROOF")}
          className={cn(
            "flex items-center gap-2 border-b-2 px-4 py-2.5 text-[13px] font-medium transition-colors",
            subView === "PROOF"
              ? "border-accent-600 text-accent-800"
              : "border-transparent text-brand-500 hover:text-brand-800",
          )}
        >
          <Sparkles className="h-4 w-4" />
          Improvement journeys
          <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[11px] font-semibold text-brand-700">
            {cards.length}
          </span>
        </button>

        <button
          onClick={() => setSubView("LEDGER")}
          className={cn(
            "flex items-center gap-2 border-b-2 px-4 py-2.5 text-[13px] font-medium transition-colors",
            subView === "LEDGER"
              ? "border-accent-600 text-accent-800"
              : "border-transparent text-brand-500 hover:text-brand-800",
          )}
        >
          <Layers className="h-4 w-4" />
          All activity
          <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[11px] font-semibold text-brand-700">
            {ledgerEvents.length}
          </span>
        </button>
      </div>

      {/* SECTION 1: ON-SCREEN VISUAL PROOF CARDS */}
      {subView === "PROOF" && (
        <div className="space-y-6">
          {proofQuery.isLoading ? (
            <LoadingState title="Loading on-screen visual proof cards…" />
          ) : proofQuery.error ? (
            <FailedState title="Could not load impact proof" error={errorMessage(proofQuery.error)} onRetry={() => proofQuery.refetch()} />
          ) : cards.length === 0 ? (
            <Panel>
              <div className="py-12 text-center max-w-lg mx-auto">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-accent-50 text-accent-700 mb-3">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <h3 className="text-[15px] font-semibold text-brand-900">
                  No Deployed Fixes to Measure Yet
                </h3>
                <p className="mt-1.5 text-[13px] text-brand-600 leading-relaxed">
                  After a change is merged and verified on the live site, its HTML snapshot appears here. Search Console and AI comparisons appear only when matching measurements are available.
                </p>
                {onNavigateTab && (
                  <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                    <ActionButton variant="primary" onClick={() => onNavigateTab("improvement")}>
                      View Improvement Plan →
                    </ActionButton>
                    <ActionButton variant="secondary" onClick={() => onNavigateTab("github-fixes")}>
                      Open GitHub Fix Engine
                    </ActionButton>
                  </div>
                )}
              </div>
            </Panel>
          ) : (
            <>
              <div className="rounded-lg border border-brand-200 bg-brand-50/70 px-4 py-3 text-[12px] text-brand-700">
                Showing up to 20 recent changes. Results do not prove what caused them.
              </div>
              {cards.map((card) => (
                <details key={card.runId} className="group overflow-hidden rounded-xl border border-brand-200 bg-white">
                  <summary className="flex cursor-pointer list-none flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <h3 className="text-[14px] font-semibold text-brand-900">{card.title}</h3>
                      <p className="mt-1 break-all text-[11px] text-brand-500">{card.url}</p>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-2 text-[11px]">
                      <Pill tone={card.after.verificationStatus === "VERIFIED_LIVE" ? "good" : "default"}>
                        {card.after.verificationStatus === "VERIFIED_LIVE" ? "Verified live" : "Not verified"}
                      </Pill>
                      <Pill tone="default">{card.metrics30d?.status === "OBSERVED" ? "Results available" : "Awaiting results"}</Pill>
                      <span className="font-semibold text-accent-700 group-open:hidden">View details ↓</span>
                      <span className="hidden font-semibold text-accent-700 group-open:inline">Hide details ↑</span>
                    </div>
                  </summary>
                  <div className="border-t border-brand-200 p-3">
                    <VisualProofCard
                      card={card}
                      events={ledgerEvents.filter((event) => event.automationRunId === card.runId)}
                      onLaunchIteration={onLaunchIteration}
                    />
                  </div>
                </details>
              ))}
            </>
          )}
        </div>
      )}

      {/* SECTION 2: DAY 1 TO NOW AUDIT LEDGER */}
      {subView === "LEDGER" && (
        <div className="space-y-4">
          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-2 text-[11px] font-medium uppercase tracking-wider text-brand-400">Filter:</span>
            {[
              { id: "ALL", label: `All Events (${ledgerEvents.length})` },
              { id: "BASELINE", label: "Setup & tracking" },
              { id: "PR", label: "GitHub PRs" },
              { id: "DEPLOYMENT", label: "Deployments" },
              { id: "LOOP", label: "Follow-ups" },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setLedgerFilter(f.id as LedgerCategoryFilter)}
                className={cn(
                  "rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors",
                  ledgerFilter === f.id
                    ? "bg-brand-900 text-white"
                    : "bg-brand-100 text-brand-600 hover:bg-brand-200",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          {ledgerQuery.isLoading ? (
            <LoadingState title="Loading append-only impact ledger…" />
          ) : ledgerQuery.error ? (
            <FailedState title="Could not load the impact ledger" error={errorMessage(ledgerQuery.error)} onRetry={() => ledgerQuery.refetch()} />
          ) : filteredEvents.length === 0 ? (
            <Panel>
              <div className="py-8 text-center text-[13px] text-brand-400">
                No events match the selected filter.
              </div>
            </Panel>
          ) : (
            <div className="relative pl-6 before:absolute before:bottom-3 before:left-2.5 before:top-3 before:w-[2px] before:bg-brand-200 space-y-4">
              {filteredEvents.map((event) => (
                <LedgerTimelineItem key={event.id} event={event} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ───────────────────────────────────────────────────────────── Visual Proof Card
function VisualProofCard({
  card,
  events,
  onLaunchIteration,
}: {
  card: ProofOfImpactCard;
  events: FixLedgerEntry[];
  onLaunchIteration?: (instruction: string) => void;
}) {
  const metrics30d = card.metrics30d;
  const clicksDeltaPct = metrics30d?.clicksDeltaPct;

  return (
    <Panel className="border-brand-300">
      {/* Header bar */}
      <div className="flex flex-col gap-3 pb-4 border-b border-brand-200 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded bg-accent-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-accent-800">
              {card.targetElement}
            </span>

            {card.liftStatus === "IMPROVED" && (
              <Pill tone="good">
                <CheckCircle2 className="mr-1 h-3 w-3 inline" />
                Positive Signal Observed
              </Pill>
            )}

            {card.liftStatus === "FLAT" && (
              <Pill tone="warn">
                <RefreshCw className="mr-1 h-3 w-3 inline" />
                No Positive Lift Observed
              </Pill>
            )}

            {card.liftStatus === "MONITORING" && (
              <Pill tone="default">
                <Clock className="mr-1 h-3 w-3 inline" />
                Awaiting measurement
              </Pill>
            )}
          </div>

          <h3 className="text-[15px] font-semibold text-brand-900"><span className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-brand-500">Related improvement</span>{card.title}</h3>

          <div className="flex flex-wrap items-center gap-3 text-[12px] text-brand-500">
            <span className="font-mono text-brand-700">{card.file}</span>
            <span>•</span>
            <a
              href={card.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-accent-700 hover:underline"
            >
              {card.url}
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {card.after.pullRequestUrl && (
            <a
              href={card.after.pullRequestUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded border border-brand-300 bg-white px-2.5 py-1 text-[12px] font-medium text-brand-700 hover:bg-brand-50"
            >
              <GitPullRequest className="h-3.5 w-3.5 text-brand-500" />
              GitHub PR
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-brand-200 bg-brand-50/50 p-4">
        <h4 className="text-[13px] font-semibold text-brand-900">What happened</h4>
        {events.length > 0 ? (
          <ol className="mt-3 space-y-3">
            {[...events].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()).map((event) => (
              <li key={event.id} className="flex gap-3 text-[12px]">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent-600" aria-hidden="true" />
                <div><span className="font-semibold text-brand-900">{eventLabel(event.eventType)}</span>
                  <span className="ml-2 text-brand-500">{new Date(event.createdAt).toLocaleString()}</span>
                  {event.description && <p className="mt-1 text-brand-600">{event.description}</p>}
                </div>
              </li>
            ))}
          </ol>
        ) : <p className="mt-2 text-[12px] text-brand-500">No matching activity found in recent records.</p>}
        <p className="mt-3 text-[11px] text-brand-500">Older activity may not appear.</p>
      </div>
      <div className="mt-4 rounded-xl border border-brand-200 p-4">
        <h4 className="text-[13px] font-semibold text-brand-900">Results over time</h4>
        <p className="mt-1 text-[11px] text-brand-500">Search Console clicks for the reported page. The baseline covers 28 days; later windows may have different lengths. Changes do not establish that this task caused them.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {[{ label: "30-day check", metric: card.metrics30d }, { label: "90-day check", metric: card.metrics90d }].map(({ label, metric }) => (
            <div key={label} className="rounded-lg border border-brand-200 bg-brand-50/50 p-3">
              <div className="text-[12px] font-semibold text-brand-900">{label}</div>
              {metric?.status === "OBSERVED" && metric.beforeClicks != null && metric.afterClicks != null ? (
                <p className="mt-1 text-[12px] text-brand-700">Baseline (28 days): {metric.beforeClicks} clicks · {label}: {metric.afterClicks} clicks</p>
              ) : <p className="mt-1 text-[12px] text-brand-500">Not measured yet</p>}
            </div>
          ))}
        </div>
      </div>

      {/* Compare the saved pre-PR snapshot with a later live page check. */}
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* LEFT: saved before-change snapshot */}
        <div className="rounded border border-brand-200 bg-brand-50/50 p-4">
          <div className="flex items-center justify-between pb-2 border-b border-brand-200">
            <span className="text-[12px] font-semibold uppercase tracking-wider text-brand-600">
              Before the change
            </span>
            <span className="text-[11px] text-brand-400">Saved before PR</span>
          </div>

          <div className="mt-3">
            <label className="text-[11px] font-medium text-brand-500">On-Screen Content / Code:</label>
            <div className="mt-1 rounded bg-white p-3 font-mono text-[12px] text-brand-800 border border-brand-200 whitespace-pre-wrap break-words max-h-40 overflow-y-auto">
              {card.before.text || "No baseline text was captured"}
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 text-[12px]">
            <div className="rounded bg-white p-2 border border-brand-200">
              <span className="text-[11px] text-brand-500 block">Baseline Clicks (28d):</span>
              <span className="font-semibold text-brand-800">
                {card.before.clicks != null ? card.before.clicks : "Not measured"}
              </span>
            </div>
            <div className="rounded bg-white p-2 border border-brand-200">
              <span className="text-[11px] text-brand-500 block">AI response mention rate (sample):</span>
              <span className="font-semibold text-brand-800">
                {"Not available"}
              </span>
            </div>
          </div>
        </div>

        {/* RIGHT: later verified live-page snapshot */}
        <div className="rounded border border-good-300 bg-good-50/20 p-4">
          <div className="flex items-center justify-between pb-2 border-b border-good-200">
            <span className="text-[12px] font-semibold uppercase tracking-wider text-good-900 flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-good-600" />
              Live page check
            </span>
            <span className="text-[11px] text-good-700 font-medium">
              {card.after.verificationStatus === "VERIFIED_LIVE" ? (card.after.verifiedAt ? `Verified ${relativeTime(card.after.verifiedAt)}` : "Live HTML verified") : "Not verified live"}
            </span>
          </div>

          <div className="mt-3">
            <label className="text-[11px] font-medium text-good-800">Saved page snapshot:</label>
            <div className="mt-1 rounded bg-white p-3 font-mono text-[12px] text-good-950 border border-good-200 whitespace-pre-wrap break-words max-h-40 overflow-y-auto">
              {card.after.text || "No page snapshot was captured"}
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 text-[12px]">
            <div className="rounded bg-white p-2 border border-good-200">
              <span className="text-[11px] text-brand-500 block">Search clicks · first 30 days</span>
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-brand-900">
                  {metrics30d?.afterClicks != null ? metrics30d?.afterClicks : "Not measured"}
                </span>
                {metrics30d?.status === "OBSERVED" && metrics30d.afterClicks != null && clicksDeltaPct != null && (
                  <span className={cn(
                    "rounded px-1.5 py-0.2 text-[10px] font-bold",
                    clicksDeltaPct > 0 ? "bg-good-100 text-good-800" :
                      clicksDeltaPct < 0 ? "bg-error-100 text-error-800" : "bg-brand-100 text-brand-700",
                  )}>
                    {clicksDeltaPct > 0 ? "+" : ""}{clicksDeltaPct}%
                  </span>
                )}
              </div>
            </div>
            <div className="rounded bg-white p-2 border border-good-200">
              <span className="text-[11px] text-brand-500 block">AI brand mention rate</span>
              <span className="font-semibold text-brand-900">
                {"Not available"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* CLOSED-LOOP ENGINE SECTION (WHEN LIFT IS FLAT) */}
      {card.liftStatus === "FLAT" && card.loopStatus && (
        <div className="mt-4 rounded-lg border border-warn-300 bg-warn-50/50 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-warn-900 font-semibold text-[13px]">
              <AlertTriangle className="h-4 w-4 text-warn-700" />
              No positive change in measured data
            </div>
            <Pill tone="warn">Review available</Pill>
          </div>

          <p className="text-[12px] text-warn-900">
            No positive change was found in the available measurements after live verification. Review the comparisons below before choosing a follow-up action; this result does not identify a cause.
          </p>

          <div className="grid grid-cols-1 gap-2 rounded bg-white p-3 border border-warn-200 text-[12px]">
            {card.loopStatus.rca?.map((point, idx) => (
              <div key={idx} className="flex items-start gap-2 text-brand-700">
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-warn-100 text-[10px] font-bold text-warn-800">
                  {idx + 1}
                </span>
                <span>{point}</span>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-2 rounded bg-warn-100/60 p-3 border border-warn-200 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-0.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-warn-800">
                Suggested follow-up:
              </span>
              <p className="text-[12px] font-medium text-warn-950">
                {card.loopStatus.pivotTitle}
              </p>
            </div>

            {onLaunchIteration && card.loopStatus.pivotAction && (
              <button
                onClick={() => onLaunchIteration(card.loopStatus!.pivotAction!)}
                className="inline-flex shrink-0 items-center gap-1.5 rounded bg-accent-700 px-3 py-1.5 text-[12px] font-semibold text-white shadow-sm hover:bg-accent-800 transition-colors"
              >
                Review follow-up in Fix Engine
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* LIFT CONFIRMED BANNER */}
      {card.liftStatus === "IMPROVED" && (
        <div className="mt-4 rounded border border-good-300 bg-good-50/60 p-3 text-[12px] text-good-900 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-good-700 shrink-0" />
          <span>
            <strong>Positive change observed after deployment:</strong> This comparison does not establish that the fix caused the change.
          </span>
        </div>
      )}
    </Panel>
  );
}

// ───────────────────────────────────────────────────────────── Ledger Timeline Item
function eventLabel(eventType: string): string {
  const labels: Record<string, string> = {
    PROJECT_INITIALIZED: "Tracking started",
    BASELINE_CRAWL_COMPLETED: "Website snapshot saved",
    GROWTH_OPPORTUNITIES_DETECTED: "Opportunities found",
    PR_CREATED: "GitHub pull request opened",
    DEPLOYMENT_VERIFIED: "Live page change verified",
    LIVE_VERIFICATION_UNSUPPORTED: "Live check needs review",
    TECHNICAL_FIX_CONFIRMED: "Fix confirmed",
    IMPACT_CONFIRMED: "Positive change observed",
    NO_IMPROVEMENT_DIAGNOSED: "No positive change observed",
    ITERATION_LOOP_TRIGGERED: "Follow-up opportunity prepared",
  };
  return labels[eventType] ?? eventType.toLowerCase().replaceAll("_", " ");
}

function LedgerTimelineItem({ event }: { event: FixLedgerEntry }) {
  const isLoop = ["NO_IMPROVEMENT_DIAGNOSED", "ITERATION_LOOP_TRIGGERED"].includes(event.eventType);
  const isBaseline = ["PROJECT_INITIALIZED", "BASELINE_CRAWL_COMPLETED", "GROWTH_OPPORTUNITIES_DETECTED"].includes(event.eventType);
  const isVerified = ["DEPLOYMENT_VERIFIED", "TECHNICAL_FIX_CONFIRMED", "IMPACT_CONFIRMED"].includes(event.eventType);

  return (
    <div className="relative rounded-lg border border-brand-200 bg-white p-4 shadow-xs">
      {/* Node Dot */}
      <span
        className={cn(
          "absolute -left-[31px] top-5 flex h-4 w-4 items-center justify-center rounded-full border-2 border-white text-white",
          isLoop
            ? "bg-warn-600"
            : isBaseline
              ? "bg-accent-600"
              : isVerified
                ? "bg-good-600"
                : "bg-brand-600",
        )}
      />

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded bg-brand-100 px-2 py-0.5 text-[11px] font-semibold text-brand-800">
            {eventLabel(event.eventType)}
          </span>
        </div>
        <span className="text-[11px] text-brand-500">
          {relativeTime(event.createdAt)} ({new Date(event.createdAt).toLocaleDateString()})
        </span>
      </div>

      <h4 className="mt-2 text-[14px] font-semibold text-brand-900">{event.title}</h4>
      <details className="mt-2"><summary className="cursor-pointer text-[12px] font-medium text-accent-700">View details</summary><p className="mt-2 text-[12px] text-brand-600">{event.description}</p></details>

      {/* Meta links */}
      {(event.affectedUrl || event.pullRequestUrl) && (
        <div className="mt-3 flex flex-wrap items-center gap-3 text-[12px] text-brand-500">
          {event.affectedUrl && (
            <span className="flex items-center gap-1 font-mono text-brand-700">
              <Search className="h-3 w-3 text-brand-400" />
              {event.affectedUrl}
            </span>
          )}
          {event.pullRequestUrl && (
            <a
              href={event.pullRequestUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-accent-700 hover:underline"
            >
              <GitPullRequest className="h-3 w-3" />
              GitHub PR
              <ExternalLink className="h-2.5 w-2.5" />
            </a>
          )}
        </div>
      )}

      {event.evidenceData && Object.keys(event.evidenceData).length > 0 && (
        <details className="mt-3 rounded border border-brand-200 bg-brand-50/60 px-3 py-2 text-[12px]">
          <summary className="cursor-pointer font-medium text-brand-700">View technical details</summary>
          <div className="mt-2 space-y-1 overflow-x-auto font-mono text-[11px] text-brand-700">
            {Object.entries(event.evidenceData).map(([key, value]) => (
              <div key={key} className="flex flex-wrap gap-x-2">
                <span className="font-semibold text-brand-600">{key}:</span>
                <span className="break-all text-brand-800">
                  {typeof value === "object" ? JSON.stringify(value) : String(value)}
                </span>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
