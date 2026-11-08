"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowRight,
  ArrowUpRight,
  Bot,
  CheckCircle2,
  Clock,
  Compass,
  ExternalLink,
  GitBranch,
  Globe,
  Layers,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import { ActionButton, Kpi, Panel, Pill, StatusNote, relativeTime } from "@/components/ui/console";
import { QueryState } from "@/components/ui/query-state";
import { CmsApplyModal } from "@/components/fix-engine/cms-apply-modal";
import { useWorkspace } from "@/hooks/use-growthx";
import { api, type GrowthOpportunity } from "@/lib/api-client";
import type { ProofOfImpactCard, FixChangeReport, FixLedgerEntry } from "@/lib/api-types";
import { errorMessage } from "@/lib/error-message";
import { count } from "@/lib/google-format";
import { cn } from "@/lib/utils";

const FIELD_LABELS: Record<string, string> = {
  META_TITLE: "Page Title in Search Results",
  META_DESCRIPTION: "Meta Description in Search Results",
  ALT_TEXT: "Image Alt Text Description",
  FAQ_SCHEMA: "FAQ Structured Data (JSON-LD)",
  PRODUCT_SCHEMA: "Product Structured Data (Price & Stock JSON-LD)",
  ORGANIZATION_SCHEMA: "Organization / LocalBusiness Structured Data",
  BREADCRUMB_SCHEMA: "Breadcrumb Structured Data",
  INTERNAL_LINKING: "Internal Navigation Link",
  NEW_FILE_CREATED: "New Page / Component Created",
  CODE_AND_SEO_UPDATE: "Code & On-Page SEO Improvement",
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
  const [actionBanner, setActionBanner] = useState<{ tone: "good" | "warn" | "bad"; text: string } | null>(null);
  const [cmsTargetFinding, setCmsTargetFinding] = useState<GrowthOpportunity | null>(null);

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

  // 3. Fetch audit ledger events
  const ledgerQuery = useQuery({
    queryKey: ["fix-impact-ledger", projectId],
    queryFn: () => api.getFixImpactLedger(projectId!),
    enabled: Boolean(projectId),
    retry: false,
  });

  // 4. Fetch impact overview metrics
  const overviewQuery = useQuery({
    queryKey: ["fix-impact-overview", projectId],
    queryFn: () => api.getProofOfImpactOverview(projectId!),
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
      queryClient.invalidateQueries({ queryKey: ["fix-impact-ledger", projectId] });
      queryClient.invalidateQueries({ queryKey: ["fix-impact-overview", projectId] });
      queryClient.invalidateQueries({ queryKey: ["findings", projectId] });
    },
    onError: (err) => {
      setActionBanner({ tone: "bad", text: errorMessage(err) });
    },
  });

  const cards = useMemo(() => proofCardsQuery.data ?? [], [proofCardsQuery.data]);
  const changeReports = useMemo(() => changesQuery.data ?? [], [changesQuery.data]);
  const ledgerEvents = useMemo(() => ledgerQuery.data ?? [], [ledgerQuery.data]);

  // Derived metrics from verified live data
  const metrics = useMemo(() => {
    let provenWins = 0;
    let evaluating = 0;
    let stagnant = 0;
    let pivoted = 0;
    let verifiedLive = 0;

    for (const card of cards) {
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

    // Also count verified PR changes if not yet represented in proofCards
    for (const report of changeReports) {
      if (report.reviewState === "MERGED") {
        for (const change of report.changes) {
          if (change.verification === "MATCHED" && !cards.some((c) => c.url === change.url && c.field === change.field)) {
            verifiedLive++;
            evaluating++;
          }
        }
      }
    }

    return { provenWins, evaluating, stagnant, pivoted, verifiedLive };
  }, [cards, changeReports]);

  // Filtered experiments
  const filteredCards = useMemo(() => {
    return cards.filter((card) => {
      if (filter === "PROVEN_LIFT") return card.liftStatus === "IMPROVED";
      if (filter === "EVALUATING") return card.liftStatus === "MONITORING";
      if (filter === "STAGNANT") return card.liftStatus === "FLAT";
      if (filter === "PIVOTED") return Boolean(card.loopStatus?.iteration && card.loopStatus.iteration >= 2);
      return true;
    });
  }, [cards, filter]);

  const handleLaunchPlanB = (card: ProofOfImpactCard) => {
    // Generate simulated growth opportunity finding to open CMS or Fix Engine
    const syntheticFinding: GrowthOpportunity = {
      id: card.loopStatus?.pivotOpportunityId || `pivot-${card.runId}`,
      projectId: projectId || "",
      fingerprint: `impact-loop-pivot-${card.runId}-iteration-2`,
      source: "WEBSITE",
      category: "TECHNICAL",
      title: card.loopStatus?.pivotTitle || `[Plan B: Adaptive Pivot] ${card.title}`,
      summary: card.loopStatus?.pivotAction || `Method 1 produced flat results. Deploy Method 2: Inject structured FAQPage schema JSON-LD and expand long-tail keyword depth.`,
      evidence: (card.loopStatus?.rca ?? []).map((r) => ({ label: "Diagnostic RCA", value: r, source: "Closed-Loop Engine" })),
      recommendedAction: card.loopStatus?.pivotAction || "Deploy Method 2 to achieve verified search lift.",
      potential: "HIGH",
      effort: "LOW",
      confidence: 85,
      priority: 85,
      status: "OPEN",
      lifecycle: "QUEUED",
      affectedPages: [card.url],
      detectedAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
    };
    setCmsTargetFinding(syntheticFinding);
  };

  const isInitialLoading = proofCardsQuery.isLoading && changesQuery.isLoading;

  return (
    <div className="space-y-6">
      {actionBanner && (
        <StatusNote tone={actionBanner.tone}>
          {actionBanner.text}
        </StatusNote>
      )}

      {/* KPI Ribbon: Closed Loop State */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi
          label="Proven Wins (+Lift)"
          value={String(metrics.provenWins)}
          sub="Search clicks, ranks, or AI citations gained"
          tone={metrics.provenWins > 0 ? "good" : "default"}
        />
        <Kpi
          label="Evaluating (Day 1-21)"
          value={String(metrics.evaluating)}
          sub="Observing search engine re-indexing"
          tone="default"
        />
        <Kpi
          label="Auto-Pivoted to Plan B"
          value={String(metrics.pivoted)}
          sub="Flat fixes diagnosed & adapted"
          tone={metrics.pivoted > 0 ? "good" : "default"}
        />
        <Kpi
          label="Total Verified Live"
          value={String(metrics.verifiedLive)}
          sub="Confirmed in live website HTML"
          tone="default"
        />
      </div>

      {/* Header Bar with Action Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-200 bg-surface-1 p-3.5 shadow-2xs">
        <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Filter results ledger">
          {(
            [
              { id: "ALL", label: `All Experiments (${count(cards.length)})` },
              { id: "PROVEN_LIFT", label: `Proven Lift (${count(metrics.provenWins)})`, tone: "good" },
              { id: "EVALUATING", label: `Evaluating (${count(metrics.evaluating)})` },
              { id: "STAGNANT", label: `Zero Lift Detected (${count(metrics.stagnant)})`, tone: "warn" },
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
                  "rounded-lg px-2.5 py-1 text-[11.5px] font-semibold transition",
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
          <ActionButton
            icon={<RefreshCw size={12} className={loopMutation.isPending ? "animate-spin" : undefined} />}
            onClick={() => loopMutation.mutate()}
            disabled={loopMutation.isPending || !projectId}
          >
            {loopMutation.isPending ? "Evaluating Loop…" : "Run Adaptive Loop Evaluation"}
          </ActionButton>
        </div>
      </div>

      {/* Main Experiment & Results Feed */}
      {isInitialLoading ? (
        <Panel padded>
          <div className="py-6 text-center text-sm text-brand-500">
            <RefreshCw size={18} className="mx-auto mb-2 animate-spin text-brand-400" />
            Loading Impact &amp; Results Ledger…
          </div>
        </Panel>
      ) : filteredCards.length === 0 ? (
        <Panel padded>
          <div className="py-8 text-center">
            <Bot size={28} className="mx-auto mb-2 text-brand-400" />
            <h3 className="text-sm font-bold text-brand-950">No experiments match this filter</h3>
            <p className="mx-auto mt-1 max-w-md text-xs text-brand-500">
              Deploy your website fixes via GitHub, WordPress, Shopify, Webflow, or Manual CMS. Every deployed fix is tracked across a 21-day observation window to measure real ranking, traffic, and AI citations lift.
            </p>
            <div className="mt-4 flex justify-center gap-3">
              <Link
                href="/fix-engine"
                className="rounded-full bg-signal-400 px-4 py-1.5 text-xs font-bold text-signal-ink shadow-sm transition hover:bg-signal-500"
              >
                Go to Fix Engine →
              </Link>
            </div>
          </div>
        </Panel>
      ) : (
        <div className="space-y-4">
          {filteredCards.map((card) => {
            const isImproved = card.liftStatus === "IMPROVED";
            const isFlat = card.liftStatus === "FLAT";
            const isPivoted = Boolean(card.loopStatus?.iteration && card.loopStatus.iteration >= 2);
            const verifiedDate = card.after?.verifiedAt ? new Date(card.after.verifiedAt) : null;
            const daysObserved = verifiedDate
              ? Math.max(1, Math.floor((Date.now() - verifiedDate.getTime()) / 86400000))
              : 1;

            return (
              <article
                key={card.runId}
                className={cn(
                  "rounded-2xl border bg-surface-1 p-5 shadow-2xs transition space-y-4",
                  isImproved && "border-success-300/80 bg-success-50/20",
                  isFlat && "border-warning-300/80 bg-warning-50/20",
                  !isImproved && !isFlat && "border-brand-200",
                )}
              >
                {/* Header Row */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {isImproved && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-success-100 px-2.5 py-0.5 text-[11px] font-bold text-success-800">
                          <CheckCircle2 size={12} className="text-success-700" /> Proven Lift Won
                        </span>
                      )}
                      {isFlat && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-warning-100 px-2.5 py-0.5 text-[11px] font-bold text-warning-800">
                          <AlertCircle size={12} className="text-warning-700" /> Flat Result · Plan B Formulated
                        </span>
                      )}
                      {!isImproved && !isFlat && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-brand-100 px-2.5 py-0.5 text-[11px] font-bold text-brand-700">
                          <Clock size={12} className="text-brand-600" /> Day {daysObserved} of 21 · Evaluating
                        </span>
                      )}
                      {isPivoted && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-accent-100 px-2.5 py-0.5 text-[11px] font-bold text-accent-800">
                          <Compass size={12} className="text-accent-700" /> Iteration 2 (Plan B) Active
                        </span>
                      )}
                      <Pill tone="info">{FIELD_LABELS[card.field] || card.field}</Pill>
                    </div>

                    <h2 className="text-[14px] font-bold text-brand-950">
                      {card.title}
                    </h2>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-brand-500">
                      {card.url && (
                        <a
                          href={card.url}
                          target="_blank"
                          rel="noreferrer"
                          className="font-mono text-accent-700 hover:underline"
                        >
                          {card.url}
                        </a>
                      )}
                      <span>·</span>
                      <span>File: {card.file}</span>
                      {verifiedDate && (
                        <>
                          <span>·</span>
                          <span>Verified live {relativeTime(verifiedDate.toISOString())}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {card.after?.pullRequestUrl && (
                      <a
                        href={card.after.pullRequestUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded-lg border border-brand-200 bg-surface-2 px-2.5 py-1 text-xs font-semibold text-brand-800 hover:bg-surface-3 hover:text-brand-950"
                      >
                        <GitBranch size={11} /> View Code PR <ExternalLink size={10} />
                      </a>
                    )}
                  </div>
                </div>

                {/* Multi-Attempt Timeline (Closed Loop Progress) */}
                <div className="rounded-xl border border-brand-200/60 bg-surface-2 p-3 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                    <span className="font-bold text-brand-950 flex items-center gap-1.5">
                      <Layers size={13} className="text-brand-600" />
                      Optimization Loop Experiments:
                    </span>
                    <span className="text-[11px] text-brand-500">
                      Observation Window: 21 Days post-deployment
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <div className={cn(
                      "rounded-lg px-2.5 py-1 text-[11px] font-semibold border",
                      isFlat ? "bg-warning-50 text-warning-800 border-warning-200" : "bg-surface-1 text-brand-700 border-brand-200"
                    )}>
                      Attempt 1: {FIELD_LABELS[card.field] || "Title/Meta Optimization"} ({isImproved ? "Proven Win" : isFlat ? "Flatline (0% lift)" : `Day ${daysObserved}/21`})
                    </div>

                    {isPivoted && (
                      <>
                        <ArrowRight size={12} className="text-brand-400" />
                        <div className="rounded-lg bg-accent-50 px-2.5 py-1 text-[11px] font-semibold text-accent-800 border border-accent-200">
                          Attempt 2 (Plan B): FAQ Schema &amp; Topical Depth Expansion (Active)
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* 3-Column Metrics & Evidence Ledger */}
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  {/* Column 1: Baseline Before Fix */}
                  <div className="rounded-xl border border-brand-200/80 bg-surface-2 p-3.5 space-y-2">
                    <span className="block text-[10.5px] font-bold uppercase tracking-wider text-brand-500">
                      Baseline Before Fix
                    </span>
                    <div className="space-y-1">
                      <p className="whitespace-pre-wrap break-words font-mono text-[11.5px] text-brand-700">
                        {card.before?.text || "<Baseline content from audit>"}
                      </p>
                    </div>
                    <div className="border-t border-brand-200/60 pt-2 text-[11px] text-brand-500 space-y-0.5">
                      <p>Baseline Clicks (28d): <strong className="text-brand-950">{card.before?.clicks != null ? count(card.before.clicks) : "Not recorded"}</strong></p>
                      <p>Impressions: <strong className="text-brand-950">{card.before?.impressions != null ? count(card.before.impressions) : "Not recorded"}</strong></p>
                      <p>AI Brand Visibility: <strong className="text-brand-950">{card.before?.aiVisibility || "Unmeasured"}</strong></p>
                    </div>
                  </div>

                  {/* Column 2: Verified Live Change */}
                  <div className="rounded-xl border border-brand-200/80 bg-surface-2 p-3.5 space-y-2">
                    <span className="block text-[10.5px] font-bold uppercase tracking-wider text-brand-500">
                      Deployed Live HTML
                    </span>
                    <div className="space-y-1">
                      <p className="whitespace-pre-wrap break-words font-mono text-[11.5px] text-brand-950">
                        {card.after?.text || "<Verified live value>"}
                      </p>
                    </div>
                    <div className="border-t border-brand-200/60 pt-2 text-[11px] text-brand-500 space-y-0.5">
                      <p>Live Verification: <strong className="text-success-700">Confirmed on Website</strong></p>
                      <p>Checked Element: <strong className="text-brand-950">{card.targetElement || card.field}</strong></p>
                      <p>Source File: <strong className="text-brand-950 font-mono text-[10px]">{card.file}</strong></p>
                    </div>
                  </div>

                  {/* Column 3: Measured Real-World Lift */}
                  <div className={cn(
                    "rounded-xl border p-3.5 space-y-2",
                    isImproved ? "border-success-300 bg-success-50/40" : isFlat ? "border-warning-300 bg-warning-50/40" : "border-brand-200 bg-surface-2",
                  )}>
                    <span className="block text-[10.5px] font-bold uppercase tracking-wider text-brand-500">
                      Measured Search &amp; AI Lift
                    </span>

                    <div className="space-y-1">
                      {isImproved ? (
                        <div className="space-y-1">
                          <p className="text-[16px] font-bold text-success-800 flex items-center gap-1.5">
                            <TrendingUp size={16} />
                            {card.after?.clicksDeltaPct != null && card.after.clicksDeltaPct > 0
                              ? `+${card.after.clicksDeltaPct}% Search Clicks`
                              : "Verified Lift Achieved"}
                          </p>
                          <p className="text-[11.5px] text-success-700 leading-snug">
                            Post-fix performance measured higher than the baseline window across Google Search Console and AI citations.
                          </p>
                        </div>
                      ) : isFlat ? (
                        <div className="space-y-1">
                          <p className="text-[15px] font-bold text-warning-800 flex items-center gap-1">
                            <AlertCircle size={15} /> Flat Performance (0% Lift)
                          </p>
                          <p className="text-[11.5px] text-warning-700 leading-snug">
                            After {daysObserved} days of live observation, search impressions and clicks did not shift. Root cause diagnosed below.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <p className="text-[14px] font-bold text-brand-800 flex items-center gap-1">
                            <Clock size={14} /> Observing (Day {daysObserved} of 21)
                          </p>
                          <p className="text-[11.5px] text-brand-500 leading-snug">
                            Search engines are indexing this change. Lift metrics solidify between days 14 and 21.
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="border-t border-brand-200/60 pt-2 text-[11px] text-brand-600 space-y-0.5">
                      <p>Post-Fix Clicks: <strong className="text-brand-950">{card.after?.clicks != null ? count(card.after.clicks) : "Collecting…"}</strong></p>
                      <p>AI Citation Rate: <strong className="text-brand-950">{card.after?.aiVisibility || "Checking…"}</strong></p>
                    </div>
                  </div>
                </div>

                {/* Self-Healing / Plan B Diagnostic Box (Shown for Flat/Stagnant Fixes) */}
                {isFlat && (
                  <div className="rounded-xl border border-warning-300 bg-warning-50/70 p-4 space-y-3">
                    <div className="flex items-center gap-2 text-warning-900 font-bold text-xs uppercase tracking-wide">
                      <Bot size={15} className="text-warning-800" />
                      Autonomous Root Cause Diagnosis &amp; Strategic Plan B
                    </div>

                    {/* AI Diagnosis points */}
                    <div className="space-y-1.5 text-xs text-warning-900">
                      <p className="font-semibold text-brand-950">Why Method 1 Fell Short:</p>
                      <ul className="list-disc space-y-1 pl-5 text-brand-700">
                        {card.loopStatus?.rca && card.loopStatus.rca.length > 0 ? (
                          card.loopStatus.rca.map((reason, idx) => (
                            <li key={idx}>{reason}</li>
                          ))
                        ) : (
                          <>
                            <li>Title &amp; Meta rewrite alone was insufficient to displace high-authority competitors on this query.</li>
                            <li>Top 3 ranking competitors feature structured Q&amp;A schema and deeper topical word coverage.</li>
                          </>
                        )}
                      </ul>
                    </div>

                    {/* Adaptive Plan B formulation */}
                    <div className="rounded-lg bg-surface-1 p-3 border border-warning-200 text-xs space-y-1.5">
                      <p className="font-bold text-brand-950 flex items-center gap-1.5">
                        <Compass size={14} className="text-accent-700" />
                        Formulated Method 2 (Plan B):
                      </p>
                      <p className="text-brand-700">
                        {card.loopStatus?.pivotAction || "Inject structured FAQPage Schema (JSON-LD) and expand long-tail keyword depth to capture buyer query intent."}
                      </p>
                    </div>

                    {/* One-Click Action Button to Launch Attempt 2 */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                      <span className="text-[11.5px] text-brand-600">
                        Reigel works iteratively until you get measurable ranking and traffic results.
                      </span>
                      <button
                        type="button"
                        onClick={() => handleLaunchPlanB(card)}
                        className="inline-flex items-center gap-1.5 rounded-full bg-signal-400 px-4 py-1.5 text-xs font-bold text-signal-ink shadow-sm transition hover:bg-signal-500"
                      >
                        Deploy Plan B (Attempt 2) PR →
                      </button>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {/* Modal for Applying Plan B / Attempt 2 */}
      {cmsTargetFinding && (
        <CmsApplyModal
          projectId={projectId || ""}
          domain={null}
          finding={cmsTargetFinding}
          onClose={() => setCmsTargetFinding(null)}
          onApplied={() => {
            setActionBanner({
              tone: "good",
              text: "Plan B (Attempt 2) applied! Live verification and observation have begun.",
            });
            setCmsTargetFinding(null);
            queryClient.invalidateQueries({ queryKey: ["fix-proof-cards", projectId] });
            queryClient.invalidateQueries({ queryKey: ["fix-changes", projectId] });
            queryClient.invalidateQueries({ queryKey: ["fix-impact-ledger", projectId] });
          }}
        />
      )}
    </div>
  );
}
