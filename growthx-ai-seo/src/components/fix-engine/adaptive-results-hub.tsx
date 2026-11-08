"use client";

import { useMemo, useState } from "react";
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
import { SelfHealingPipeline } from "@/components/fix-engine/self-healing-pipeline";
import { ResultsTrajectoryChart } from "@/components/fix-engine/results-trajectory-chart";
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

export function AdaptiveResultsHub({ initialFilter = "ALL", compact = false }: AdaptiveResultsHubProps) {
  const { projectId } = useWorkspace();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<ResultsFilterTab>(initialFilter);
  const [viewMode, setViewMode] = useState<"CARDS" | "TABLE">("CARDS");
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
                  `If search lift is flat, Reigel will autonomously formulate Plan B.`,
                ],
                pivotTitle: `[Plan B Formulation] ${change.findingTitle || change.url}`,
                pivotAction: `Pivot Method 2: Inject rich JSON-LD FAQ schema and expand high-intent long-tail keywords.`,
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

      {/* 1. Animated Visual Pipeline Stepper */}
      <SelfHealingPipeline />

      {/* 2. Recharts Search Performance Trajectory & Rival Radar */}
      <ResultsTrajectoryChart
        totalExperiments={allCards.length}
        evaluatingCount={metrics.evaluating}
        provenWinsCount={metrics.provenWins}
        pivotedCount={metrics.pivoted}
      />

      {/* 3. Filter Ribbon with View Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-200 bg-surface-1 p-3 shadow-2xs">
        <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Filter results ledger">
          {(
            [
              { id: "ALL", label: `All Experiments (${count(allCards.length)})` },
              { id: "PROVEN_LIFT", label: `Proven Lift (${count(metrics.provenWins)})`, tone: "good" },
              { id: "EVALUATING", label: `Evaluating (${count(metrics.evaluating)})` },
              { id: "STAGNANT", label: `Zero Lift (${count(metrics.stagnant)})`, tone: "warn" },
              { id: "PIVOTED", label: `Plan B Active (${count(metrics.pivoted)})` },
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
                  "rounded-lg px-2.5 py-1 text-[11.5px] font-semibold transition cursor-pointer",
                  active
                    ? "bg-signal-400 text-signal-ink font-bold shadow-xs"
                    : "text-brand-500 hover:bg-surface-2 hover:text-brand-950",
                )}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <div className="flex items-center rounded-lg border border-brand-200 bg-surface-2 p-0.5">
            <button
              type="button"
              onClick={() => setViewMode("CARDS")}
              title="Cards View"
              className={cn(
                "rounded-md p-1.5 transition-colors cursor-pointer",
                viewMode === "CARDS"
                  ? "bg-surface-1 text-brand-950 shadow-2xs font-bold"
                  : "text-brand-500 hover:text-brand-950",
              )}
            >
              <LayoutGrid size={13} />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("TABLE")}
              title="Table View"
              className={cn(
                "rounded-md p-1.5 transition-colors cursor-pointer",
                viewMode === "TABLE"
                  ? "bg-surface-1 text-brand-950 shadow-2xs font-bold"
                  : "text-brand-500 hover:text-brand-950",
              )}
            >
              <List size={13} />
            </button>
          </div>

          <ActionButton
            icon={<RefreshCw size={12} className={loopMutation.isPending ? "animate-spin" : undefined} />}
            onClick={() => loopMutation.mutate()}
            disabled={loopMutation.isPending || !projectId}
          >
            {loopMutation.isPending ? "Evaluating…" : "Evaluate Loop"}
          </ActionButton>
        </div>
      </div>

      {/* 4. Main Experiment Ledger Feed */}
      {isInitialLoading ? (
        <Panel padded>
          <div className="py-8 text-center text-sm text-brand-500">
            <RefreshCw size={20} className="mx-auto mb-2 animate-spin text-brand-400" />
            Syncing Live Search Console Results…
          </div>
        </Panel>
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
                  <th className="px-4 py-3">GSC Status</th>
                  <th className="px-4 py-3">Autonomous Plan B</th>
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
                    <tr key={card.runId} className="hover:bg-surface-2/40 transition-colors">
                      <td className="px-4 py-3">
                        <div className="space-y-0.5">
                          <p className="font-bold text-brand-950 truncate max-w-xs">{card.title}</p>
                          <div className="flex items-center gap-2 text-[11px] text-brand-500 font-mono">
                            <span className="truncate max-w-[200px]">{card.url || card.file}</span>
                            <span>·</span>
                            <span className="text-brand-700">{FIELD_LABELS[card.field] || card.field}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="space-y-1 w-36">
                          <div className="flex items-center justify-between text-[10.5px]">
                            <span className="font-bold text-brand-950">Day {daysObserved} of 21</span>
                            <span className="text-brand-500">{21 - daysObserved}d left</span>
                          </div>
                          <div className="h-1.5 w-full rounded-full bg-brand-200/60 overflow-hidden">
                            <div
                              className="h-full bg-signal-400 rounded-full"
                              style={{ width: `${Math.min(100, Math.round((daysObserved / 21) * 100))}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 rounded-full bg-brand-100 px-2 py-0.5 text-[10.5px] font-bold text-brand-700">
                          <Clock size={11} className="text-brand-500" />
                          Crawling Live HTML
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="space-y-0.5">
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-accent-700">
                            <Compass size={12} />
                            Method 2 Armed
                          </span>
                          <p className="text-[10px] text-brand-500">Injects LocalBusiness FAQ Schema</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleLaunchPlanB(card)}
                          className="rounded-full bg-signal-400 px-3 py-1 text-[11px] font-bold text-signal-ink shadow-2xs hover:bg-signal-500 transition cursor-pointer"
                        >
                          Test-Drive Plan B →
                        </button>
                      </td>
                    </tr>
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
                    <span className="inline-flex items-center gap-1 rounded-full bg-signal-400/20 px-2.5 py-0.5 text-[11px] font-bold text-signal-ink border border-signal-400/30">
                      <Clock size={11} className="text-signal-400" /> Day {daysObserved} of 21 · Google Crawling
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

                {/* Compact Before & After Pill Diff */}
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 text-xs">
                  <div className="rounded-xl border border-brand-200/80 bg-surface-2/50 p-2.5 space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-brand-500">
                      Baseline Content Before Fix:
                    </span>
                    <p className="font-mono text-[11px] text-brand-700 truncate">
                      {card.before?.text || "Saved audit baseline"}
                    </p>
                  </div>

                  <div className="rounded-xl border border-success-200/80 bg-success-50/20 p-2.5 space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-success-800">
                      Verified Live on Website (HTML Matched):
                    </span>
                    <p className="font-mono text-[11px] text-brand-950 font-semibold truncate">
                      {card.after?.text || "Deployed live update"}
                    </p>
                  </div>
                </div>

                {/* Autonomous Plan B Action Strip (Clear & Actionable) */}
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-200/90 bg-surface-2 p-3">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-warning-500/20 text-warning-800">
                      <Bot size={13} />
                    </span>
                    <div>
                      <p className="text-xs font-bold text-brand-950">
                        Autonomous Plan B Armed:{" "}
                        <span className="font-normal text-brand-600">
                          If lift is flat on Day 21, Reigel auto-prepares rich FAQ Schema + Long-Tail Cluster PR.
                        </span>
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleLaunchPlanB(card)}
                    className="inline-flex items-center gap-1.5 rounded-full bg-signal-400 px-3.5 py-1 text-xs font-bold text-signal-ink shadow-2xs hover:bg-signal-500 transition cursor-pointer"
                  >
                    Preview / Test-Drive Plan B PR →
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
              text: "Autonomous Plan B staged! Live observation and verification updated.",
            });
            queryClient.invalidateQueries({ queryKey: ["fix-proof-cards", projectId] });
            queryClient.invalidateQueries({ queryKey: ["fix-changes", projectId] });
          }}
        />
      )}
    </div>
  );
}
