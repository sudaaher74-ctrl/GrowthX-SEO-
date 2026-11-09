"use client";

import { Fragment, useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlertCircle,
  ArrowRight,
  ArrowUpRight,
  Bot,
  CheckCircle2,
  Clock,
  Code2,
  Compass,
  ExternalLink,
  Eye,
  FileCode,
  GitBranch,
  Globe,
  Layers,
  LayoutGrid,
  List,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
  Zap,
} from "lucide-react";
import { ActionButton, Kpi, Panel, Pill, StatusNote, relativeTime } from "@/components/ui/console";
import { PlanBPreviewModal } from "@/components/fix-engine/plan-b-preview-modal";
import { ResultsTrajectoryChart } from "@/components/fix-engine/results-trajectory-chart";
import { VisualCodeDiff } from "@/components/fix-engine/visual-code-diff";
import { MilestoneStepper } from "@/components/fix-engine/milestone-stepper";
import { useWorkspace } from "@/hooks/use-growthx";
import { api } from "@/lib/api-client";
import type { ProofOfImpactCard, FixChangeReport } from "@/lib/api-types";
import { errorMessage } from "@/lib/error-message";
import { count } from "@/lib/google-format";
import { cn } from "@/lib/utils";

const FIELD_LABELS: Record<string, string> = {
  META_TITLE: "Page Title (SERP)",
  META_DESCRIPTION: "Meta Description",
  ALT_TEXT: "Image Alt Text",
  FAQ_SCHEMA: "FAQ Schema (JSON-LD)",
  PRODUCT_SCHEMA: "Product Schema",
  ORGANIZATION_SCHEMA: "LocalBusiness Schema",
  BREADCRUMB_SCHEMA: "Breadcrumb Schema",
  INTERNAL_LINKING: "Internal Linking",
  NEW_FILE_CREATED: "New Component",
  CODE_AND_SEO_UPDATE: "Code & On-Page SEO",
};

export type ResultsFilterTab = "ALL" | "PROVEN_LIFT" | "EVALUATING" | "STAGNANT" | "PIVOTED";

interface AdaptiveResultsHubProps {
  initialFilter?: ResultsFilterTab;
  compact?: boolean;
}

function TableShimmerSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-brand-200 bg-surface-1 shadow-2xs animate-pulse">
      <div className="h-10 border-b border-brand-200/80 bg-surface-2/60" />
      <div className="divide-y divide-brand-200/60 p-2 space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center justify-between p-3 gap-4">
            <div className="space-y-2 flex-1">
              <div className="h-4 w-1/3 rounded-md bg-brand-200/60" />
              <div className="h-3 w-1/4 rounded-md bg-brand-200/40" />
            </div>
            <div className="h-5 w-28 rounded-md bg-brand-200/50" />
            <div className="h-6 w-24 rounded-lg bg-brand-200/40" />
            <div className="h-6 w-20 rounded-lg bg-brand-200/50" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function AdaptiveResultsHub({ initialFilter = "ALL", compact = false }: AdaptiveResultsHubProps) {
  const { projectId } = useWorkspace();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<ResultsFilterTab>(initialFilter);
  const [viewMode, setViewMode] = useState<"CARDS" | "TABLE">("TABLE");
  const [actionBanner, setActionBanner] = useState<{ tone: "good" | "warn" | "bad"; text: string } | null>(null);
  const [targetPlanBCard, setTargetPlanBCard] = useState<ProofOfImpactCard | null>(null);
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);

  // 1. Fetch real proof cards from the closed-loop impact engine
  const proofCardsQuery = useQuery({
    queryKey: ["fix-proof-cards", projectId],
    queryFn: () => api.getFixProofCards(projectId!),
    enabled: Boolean(projectId),
    retry: false,
  });

  // 2. Fetch changes report from Fix Engine
  const changesQuery = useQuery({
    queryKey: ["fix-changes", projectId],
    queryFn: () => api.listFixChanges(projectId!),
    enabled: Boolean(projectId),
    retry: false,
  });

  // Closed-loop manual sweep mutation
  const loopMutation = useMutation({
    mutationFn: () => api.triggerImpactLoop(projectId!),
    onSuccess: (data) => {
      setActionBanner({
        tone: "good",
        text: `Evaluation complete: Evaluated ${data.evaluatedRuns ?? 0} deployed fixes — ${data.improvedCount ?? 0} confirmed search/AI lifts, and ${data.loopTriggeredCount ?? 0} auto-pivoted to Iteration 2 plans.`,
      });
      queryClient.invalidateQueries({ queryKey: ["fix-proof-cards", projectId] });
      queryClient.invalidateQueries({ queryKey: ["fix-changes", projectId] });
      queryClient.invalidateQueries({ queryKey: ["findings", projectId] });
    },
    onError: (err) => {
      setActionBanner({ tone: "bad", text: errorMessage(err) });
    },
  });

  // Synthesize proof cards across both proof cards and verified PR changes so counts match 100%
  const allCards = useMemo(() => {
    const list: ProofOfImpactCard[] = [...(proofCardsQuery.data ?? [])];
    const reports = changesQuery.data ?? [];

    for (const report of reports) {
      if (report.reviewState === "MERGED") {
        for (const change of report.changes) {
          if (change.verification === "MATCHED" && !list.some((c) => c.url === change.url && c.field === change.field)) {
            list.push({
              runId: report.id,
              title: change.findingTitle || `Live Verified: ${change.file}`,
              url: change.url || "",
              file: change.file,
              field: change.field,
              targetElement: change.field,
              before: {
                text: change.before,
                timeframe: "Saved audit baseline",
                clicks: null,
                impressions: null,
                ctr: null,
                aiVisibility: "Baseline",
              },
              after: {
                text: change.after,
                timeframe: "Verified live HTML",
                clicks: null,
                clicksDeltaPct: null,
                impressions: null,
                impressionsDeltaPct: null,
                aiVisibility: "Observing",
                verificationStatus: "VERIFIED_LIVE",
                verifiedAt: change.checkedAt || report.mergedAt,
                pullRequestUrl: report.pullRequestUrl,
              },
              liftStatus: "MONITORING",
              loopStatus: {
                iteration: 1,
                rca: [
                  `Live HTML verified on website.`,
                  `Search engine observation window active.`,
                  `If search lift is flat, Reigel will formulate the next optimization step.`,
                ],
                pivotTitle: `Follow-up Optimization: ${change.findingTitle || change.url}`,
                pivotAction: `Target long-tail keyword cluster and inject structured LocalBusiness FAQ schema.`,
                canLaunchIteration2: true,
              },
            });
          }
        }
      }
    }
    return list;
  }, [proofCardsQuery.data, changesQuery.data]);

  // Derived metrics from verified live data
  const metrics = useMemo(() => {
    let provenWins = 0;
    let evaluating = 0;
    let stagnant = 0;
    let pivoted = 0;
    let verifiedLive = 0;

    for (const card of allCards) {
      if (card.after?.verificationStatus === "VERIFIED" || card.after?.verificationStatus === "VERIFIED_LIVE") {
        verifiedLive++;
      }
      if (card.liftStatus === "IMPROVED") {
        provenWins++;
      } else if (card.liftStatus === "FLAT") {
        stagnant++;
        if (card.loopStatus?.iteration && card.loopStatus.iteration >= 2) {
          pivoted++;
        }
      } else {
        evaluating++;
      }
    }

    return { provenWins, evaluating, stagnant, pivoted, verifiedLive };
  }, [allCards]);

  // Filtered experiments
  const filteredCards = useMemo(() => {
    return allCards.filter((card) => {
      if (filter === "PROVEN_LIFT") return card.liftStatus === "IMPROVED";
      if (filter === "EVALUATING") return card.liftStatus === "MONITORING";
      if (filter === "STAGNANT") return card.liftStatus === "FLAT";
      if (filter === "PIVOTED") return Boolean(card.loopStatus?.iteration && card.loopStatus.iteration >= 2);
      return true;
    });
  }, [allCards, filter]);

  const handleLaunchPlanB = (card: ProofOfImpactCard) => {
    setTargetPlanBCard(card);
  };

  const isInitialLoading = proofCardsQuery.isLoading && changesQuery.isLoading;

  return (
    <div className="space-y-6">
      {actionBanner && (
        <StatusNote tone={actionBanner.tone}>
          {actionBanner.text}
        </StatusNote>
      )}

      {/* 1. Results Trajectory & Observation Chart */}
      <ResultsTrajectoryChart
        totalExperiments={allCards.length}
        evaluatingCount={metrics.evaluating}
        provenWinsCount={metrics.provenWins}
        pivotedCount={metrics.pivoted}
      />

      {/* 2. 21-Day Multi-Pillar Observation Pipeline Stepper */}
      <MilestoneStepper day={1} totalDays={21} />

      {/* 3. Filter Ribbon with View Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand-200 bg-surface-1 p-3 shadow-2xs">
        <div className="inline-flex flex-wrap items-center gap-1.5 rounded-xl border border-brand-200/80 bg-surface-2/60 p-1" role="tablist" aria-label="Filter results">
          {(
            [
              { id: "ALL", label: `All Fixes (${count(allCards.length)})` },
              { id: "EVALUATING", label: `In 21d Observation (${count(metrics.evaluating)})` },
              { id: "PROVEN_LIFT", label: `Proven Wins (${count(metrics.provenWins)})`, tone: "good" },
              { id: "STAGNANT", label: `Needs Adjustment (${count(metrics.stagnant)})`, tone: "warn" },
            ] as const
          ).map((tab) => {
            const active = filter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setFilter(tab.id)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer",
                  active
                    ? "bg-signal-400 text-signal-ink font-bold shadow-xs"
                    : "text-brand-500 hover:bg-surface-1 hover:text-brand-950",
                )}
              >
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <div className="inline-flex items-center rounded-xl border border-brand-200 bg-surface-2/80 p-1">
            <button
              type="button"
              onClick={() => setViewMode("CARDS")}
              title="Cards View"
              className={cn(
                "rounded-lg p-1.5 transition-colors cursor-pointer",
                viewMode === "CARDS"
                  ? "bg-surface-1 text-brand-950 shadow-2xs font-bold"
                  : "text-brand-500 hover:text-brand-950",
              )}
            >
              <LayoutGrid size={14} />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("TABLE")}
              title="Table View"
              className={cn(
                "rounded-lg p-1.5 transition-colors cursor-pointer",
                viewMode === "TABLE"
                  ? "bg-surface-1 text-brand-950 shadow-2xs font-bold"
                  : "text-brand-500 hover:text-brand-950",
              )}
            >
              <List size={14} />
            </button>
          </div>

          <button
            type="button"
            onClick={() => loopMutation.mutate()}
            disabled={loopMutation.isPending || !projectId}
            className="inline-flex items-center gap-1.5 rounded-xl bg-signal-400 px-3.5 py-2 text-xs font-bold text-signal-ink shadow-xs hover:bg-signal-500 transition cursor-pointer disabled:opacity-50"
          >
            <RefreshCw size={13} className={loopMutation.isPending ? "animate-spin" : undefined} />
            <span>{loopMutation.isPending ? "Evaluating…" : "Evaluate Loop"}</span>
          </button>
        </div>
      </div>

      {/* 4. Main Experiment Ledger Feed */}
      {isInitialLoading ? (
        <TableShimmerSkeleton />
      ) : filteredCards.length === 0 ? (
        <Panel padded>
          <div className="py-8 text-center">
            <Bot size={28} className="mx-auto mb-2 text-brand-400" />
            <h3 className="text-sm font-bold text-brand-950">No experiments match this filter</h3>
            <p className="mx-auto mt-1 max-w-md text-xs text-brand-500">
              Deploy fixes via GitHub, WordPress, or CMS to begin 21-day observation cycles.
            </p>
          </div>
        </Panel>
      ) : viewMode === "TABLE" ? (
        /* Executive Compact Table View */
        <div className="overflow-hidden rounded-2xl border border-brand-200 bg-surface-1 shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-brand-200/80 bg-surface-2/60 text-[10.5px] font-bold uppercase tracking-wider text-brand-500">
                <tr>
                  <th className="px-4 py-3">Page / Target Element</th>
                  <th className="px-4 py-3">Observation Progress</th>
                  <th className="px-4 py-3">Verification</th>
                  <th className="px-4 py-3">Follow-up Step</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-200/60">
                {filteredCards.map((card) => {
                  const verifiedDate = card.after?.verifiedAt ? new Date(card.after.verifiedAt) : null;
                  const daysObserved = verifiedDate
                    ? Math.max(1, Math.floor((Date.now() - verifiedDate.getTime()) / 86400000))
                    : 1;

                  return (
                    <Fragment key={card.runId}>
                      <tr className="hover:bg-surface-2/40 transition-colors">
                        <td className="px-4 py-3">
                          <div className="space-y-1">
                            <p className="font-bold text-brand-950 truncate max-w-xs">{card.title}</p>
                            <div className="flex flex-wrap items-center gap-1.5 text-[10.5px]">
                              <span className="truncate max-w-[160px] text-brand-500 font-mono">{card.url || card.file}</span>
                              <span>·</span>
                              <span className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-brand-700 text-[10px]">
                                {FIELD_LABELS[card.field] || card.field}
                              </span>
                              <span className="rounded bg-signal-400/20 text-signal-ink border border-signal-400/30 px-1.5 py-0.2 text-[9.5px] font-bold">
                                {card.field.includes("SCHEMA")
                                  ? "AI + Competitors"
                                  : card.field.includes("TITLE") || card.field.includes("DESCRIPTION")
                                    ? "GSC + AI Visibility"
                                    : "Audit + GSC"}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <MilestoneStepper day={daysObserved} compact />
                        </td>
                        <td className="px-4 py-3">
                          <div className="inline-flex items-center gap-1.5 rounded-lg border border-success-200/80 bg-success-50/70 px-2.5 py-1 text-[11px] font-bold text-success-700">
                            <CheckCircle2 size={12} className="text-success-600 shrink-0" />
                            <span>Live on Website</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-brand-800">
                              <Compass size={12} className="text-accent-700" />
                              FAQ Schema Prepared
                            </span>
                            <p className="text-[10px] text-brand-500">Auto-stages if lift requires depth</p>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setExpandedCardId(expandedCardId === card.runId ? null : card.runId)}
                              className={cn(
                                "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition cursor-pointer shadow-2xs",
                                expandedCardId === card.runId
                                  ? "border-brand-300 bg-surface-1 text-brand-950 font-bold"
                                  : "border-brand-200 bg-surface-2 text-brand-700 hover:bg-surface-1 hover:text-brand-950",
                              )}
                            >
                              <Code2 size={12} className={expandedCardId === card.runId ? "text-brand-950" : "text-brand-400"} />
                              <span>{expandedCardId === card.runId ? "Hide Diff" : "Inspect Diff"}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleLaunchPlanB(card)}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-signal-400 px-3.5 py-1.5 text-xs font-bold text-signal-ink shadow-2xs hover:bg-signal-500 transition cursor-pointer"
                            >
                              <span>Review Next Step</span>
                              <ArrowRight size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {expandedCardId === card.runId && (
                        <tr className="bg-surface-2/30">
                          <td colSpan={5} className="p-3">
                            <VisualCodeDiff
                              title={card.title}
                              field={FIELD_LABELS[card.field] || card.field}
                              file={card.url || card.file}
                              beforeText={card.before?.text || null}
                              afterText={card.after?.text || null}
                              verifiedLive={card.after?.verificationStatus === "VERIFIED" || card.after?.verificationStatus === "VERIFIED_LIVE"}
                            />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Visual Cards Feed (Sleek, Non-Bloated) */
        <div className="space-y-4">
          {filteredCards.map((card) => {
            const isImproved = card.liftStatus === "IMPROVED";
            const isFlat = card.liftStatus === "FLAT";
            const verifiedDate = card.after?.verifiedAt ? new Date(card.after.verifiedAt) : null;
            const daysObserved = verifiedDate
              ? Math.max(1, Math.floor((Date.now() - verifiedDate.getTime()) / 86400000))
              : 1;
            const isExpanded = expandedCardId === card.runId;

            return (
              <article
                key={card.runId}
                className={cn(
                  "rounded-2xl border bg-surface-1 p-4 shadow-2xs transition space-y-3",
                  isImproved && "border-success-300/80 bg-success-50/15",
                  isFlat && "border-warning-300/80 bg-warning-50/15",
                  !isImproved && !isFlat && "border-brand-200",
                )}
              >
                {/* Header Row */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-lg border border-brand-200 bg-surface-2 px-2.5 py-1 text-[11px] font-bold text-brand-950">
                      <Clock size={12} className="text-signal-400" /> Day {daysObserved} of 21 · Google Crawling
                    </span>
                    <Pill tone="info">{FIELD_LABELS[card.field] || card.field}</Pill>
                    <span className="text-xs text-brand-500 font-mono">
                      {card.url ? (
                        <a href={card.url} target="_blank" rel="noreferrer" className="text-accent-700 hover:underline">
                          {card.url}
                        </a>
                      ) : (
                        card.file
                      )}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {card.after?.pullRequestUrl && (
                      <a
                        href={card.after.pullRequestUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded-lg border border-brand-200 bg-surface-2 px-2.5 py-1 text-xs font-semibold text-brand-800 hover:text-brand-950"
                      >
                        <GitBranch size={11} /> PR Diff <ExternalLink size={10} />
                      </a>
                    )}
                  </div>
                </div>

                {/* Title & Goal */}
                <h3 className="text-[13.5px] font-bold text-brand-950">
                  {card.title}
                </h3>

                {/* 21-Day Observation Progress Strip */}
                <div className="rounded-xl border border-brand-200/80 bg-surface-2/60 p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-brand-950 flex items-center gap-1.5">
                      <Activity size={13} className="text-signal-400" />
                      Search Re-indexing Scrubber:
                    </span>
                    <span className="font-mono text-[11px] font-bold text-brand-700">
                      Day {daysObserved} / 21 ({21 - daysObserved} days until automated lift assessment)
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-brand-200/60 overflow-hidden">
                    <div
                      className="h-full bg-signal-400 rounded-full transition-all duration-500"
                      style={{ width: `${Math.max(5, Math.min(100, Math.round((daysObserved / 21) * 100)))}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-brand-500 font-mono">
                    <span>Days 1-7: Bot Crawl</span>
                    <span>Days 8-14: Rank Re-compute</span>
                    <span>Day 21: Auto-Pivot Check</span>
                  </div>
                </div>

                {/* Visual Side-by-Side Code Diff */}
                <VisualCodeDiff
                  title={card.title}
                  field={FIELD_LABELS[card.field] || card.field}
                  file={card.url || card.file}
                  beforeText={card.before?.text || null}
                  afterText={card.after?.text || null}
                  verifiedLive={card.after?.verificationStatus === "VERIFIED" || card.after?.verificationStatus === "VERIFIED_LIVE"}
                />

                {/* Follow-up Strategy Strip */}
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-200/90 bg-surface-2 p-3">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-accent-500/20 text-accent-700">
                      <Compass size={13} />
                    </span>
                    <div>
                      <p className="text-xs font-bold text-brand-950">
                        Follow-up Strategy:{" "}
                        <span className="font-normal text-brand-600">
                          Injects FAQ Schema (JSON-LD) if search rankings require deeper topical coverage.
                        </span>
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleLaunchPlanB(card)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-signal-400 px-3.5 py-1.5 text-xs font-bold text-signal-ink shadow-2xs hover:bg-signal-500 transition cursor-pointer"
                  >
                    <span>Review Next Step</span>
                    <ArrowRight size={12} />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Minimal Plan B Preview Modal */}
      {targetPlanBCard && (
        <PlanBPreviewModal
          card={targetPlanBCard}
          onClose={() => setTargetPlanBCard(null)}
          onStagePlanB={() => {
            setActionBanner({
              tone: "good",
              text: "Follow-up optimization staged! Live observation and verification updated.",
            });
            queryClient.invalidateQueries({ queryKey: ["fix-proof-cards", projectId] });
            queryClient.invalidateQueries({ queryKey: ["fix-changes", projectId] });
          }}
        />
      )}
    </div>
  );
}
