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
  Layers,
  RefreshCw,
  TrendingUp,
} from "lucide-react";
import { useWorkspace } from "@/hooks/use-growthx";
import { api } from "@/lib/api-client";
import { count } from "@/lib/google-format";
import { cn } from "@/lib/utils";

export function ClosedLoopResultsCard() {
  const { projectId } = useWorkspace();
  const queryClient = useQueryClient();
  const [evaluating, setEvaluating] = useState(false);

  const proofCardsQuery = useQuery({
    queryKey: ["fix-proof-cards", projectId],
    queryFn: () => api.getFixProofCards(projectId!),
    enabled: Boolean(projectId),
    retry: false,
  });

  const changesQuery = useQuery({
    queryKey: ["fix-changes", projectId],
    queryFn: () => api.listFixChanges(projectId!),
    enabled: Boolean(projectId),
    retry: false,
  });

  const loopMutation = useMutation({
    mutationFn: () => api.triggerImpactLoop(projectId!),
    onMutate: () => setEvaluating(true),
    onSettled: () => setEvaluating(false),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fix-proof-cards", projectId] });
      queryClient.invalidateQueries({ queryKey: ["fix-changes", projectId] });
      queryClient.invalidateQueries({ queryKey: ["fix-impact-ledger", projectId] });
    },
  });

  const cards = useMemo(() => proofCardsQuery.data ?? [], [proofCardsQuery.data]);
  const reports = useMemo(() => changesQuery.data ?? [], [changesQuery.data]);

  const stats = useMemo(() => {
    let provenWins = 0;
    let evaluatingCount = 0;
    let stagnantCount = 0;
    let pivotedCount = 0;
    let verifiedLive = 0;

    for (const card of cards) {
      if (card.after?.verificationStatus === "VERIFIED" || card.after?.verificationStatus === "VERIFIED_LIVE") {
        verifiedLive++;
      }
      if (card.liftStatus === "IMPROVED") provenWins++;
      else if (card.liftStatus === "FLAT") {
        stagnantCount++;
        if (card.loopStatus?.iteration && card.loopStatus.iteration >= 2) pivotedCount++;
      } else {
        evaluatingCount++;
      }
    }

    for (const r of reports) {
      if (r.reviewState === "MERGED") {
        for (const c of r.changes) {
          if (c.verification === "MATCHED" && !cards.some((cd) => cd.url === c.url && cd.field === c.field)) {
            verifiedLive++;
            evaluatingCount++;
          }
        }
      }
    }

    const topWin = cards.find((c) => c.liftStatus === "IMPROVED");
    const topStagnant = cards.find((c) => c.liftStatus === "FLAT");
    const topEvaluating = cards.find((c) => c.liftStatus === "MONITORING");

    return {
      provenWins,
      evaluatingCount,
      stagnantCount,
      pivotedCount,
      verifiedLive,
      topWin,
      topStagnant,
      topEvaluating,
      totalTracked: cards.length,
    };
  }, [cards, reports]);

  // Don't render a heavy empty box if user has not yet connected or prepared fixes
  if (reports.length === 0 && cards.length === 0 && !proofCardsQuery.isLoading) {
    return null;
  }

  return (
    <section className="rounded-2xl border border-brand-200 bg-brand-100 p-4 sm:p-5 text-brand-950 shadow-sm space-y-4">
      {/* Header */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-[17px] font-bold tracking-tight text-brand-950">
              Closed-Loop Results Engine
            </h2>
            <span className="rounded-full bg-signal-400/20 text-signal-ink border border-signal-400/40 px-2 py-0.5 text-[10.5px] font-bold">
              Autonomous Verification
            </span>
          </div>
          <p className="mt-0.5 text-[11.5px] text-brand-500 max-w-xl">
            Reigel continuously tracks every deployed change, verifies live ranking and traffic lift over 21-day observation cycles, and automatically formulates alternative Plan B strategies if results are flat.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => loopMutation.mutate()}
            disabled={evaluating || !projectId}
            className="inline-flex items-center gap-1.5 rounded-full border border-brand-200/60 bg-surface-1 px-3 py-1.5 text-[11.5px] font-semibold text-brand-800 transition hover:bg-surface-2 disabled:opacity-50"
          >
            <RefreshCw size={11} className={evaluating ? "animate-spin" : undefined} />
            {evaluating ? "Evaluating…" : "Evaluate loop"}
          </button>
          <Link
            href="/fix-engine?tab=results"
            className="inline-flex items-center gap-1.5 rounded-full bg-signal-400 px-3.5 py-1.5 text-[11.5px] font-bold text-signal-ink shadow-sm transition hover:bg-signal-500"
          >
            View results ledger <ArrowRight size={11} />
          </Link>
        </div>
      </div>

      {/* 4 Metric Badges */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <div className="rounded-xl border border-success-200 bg-surface-1 p-3 shadow-2xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-brand-400">Proven Wins</p>
          <p className="text-[16px] font-bold text-success-800 leading-tight mt-0.5">
            {stats.provenWins} {stats.provenWins === 1 ? "win" : "wins"}
          </p>
          <p className="text-[10.5px] text-brand-400 mt-0.5">Clicks / ranks lifted</p>
        </div>

        <div className="rounded-xl border border-brand-200/80 bg-surface-1 p-3 shadow-2xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-brand-400">Evaluating</p>
          <p className="text-[16px] font-bold text-brand-950 leading-tight mt-0.5">
            {stats.evaluatingCount} in flight
          </p>
          <p className="text-[10.5px] text-brand-400 mt-0.5">21-day observation</p>
        </div>

        <div className="rounded-xl border border-warning-200 bg-surface-1 p-3 shadow-2xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-brand-400">Plan B Pivots</p>
          <p className="text-[16px] font-bold text-warning-800 leading-tight mt-0.5">
            {stats.pivotedCount} adapted
          </p>
          <p className="text-[10.5px] text-brand-400 mt-0.5">Iteration 2 active</p>
        </div>

        <div className="rounded-xl border border-brand-200/80 bg-surface-1 p-3 shadow-2xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-brand-400">Verified Live</p>
          <p className="text-[16px] font-bold text-brand-950 leading-tight mt-0.5">
            {stats.verifiedLive} active
          </p>
          <p className="text-[10.5px] text-brand-400 mt-0.5">Confirmed in HTML</p>
        </div>
      </div>

      {/* Featured Insight Snippet */}
      {stats.topWin ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-success-300 bg-success-50/50 p-3 text-xs">
          <div className="flex items-center gap-2 text-success-900">
            <CheckCircle2 size={16} className="text-success-700 shrink-0" />
            <span>
              <strong>Latest Proven Lift:</strong> {stats.topWin.title} —{" "}
              {stats.topWin.after?.clicksDeltaPct != null && stats.topWin.after.clicksDeltaPct > 0
                ? `+${stats.topWin.after.clicksDeltaPct}% organic search clicks recorded`
                : "Search performance verified higher than pre-fix baseline"}
            </span>
          </div>
          <Link
            href="/fix-engine?tab=results"
            className="text-[11px] font-bold text-success-800 hover:underline shrink-0"
          >
            Inspect evidence →
          </Link>
        </div>
      ) : stats.topStagnant ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warning-300 bg-warning-50/50 p-3 text-xs">
          <div className="flex items-center gap-2 text-warning-900">
            <Bot size={16} className="text-warning-800 shrink-0" />
            <span>
              <strong>Adaptive Strategy Formulated:</strong> Flat result detected on {stats.topStagnant.title} — Reigel diagnosed competitor schema gaps and prepared Method 2.
            </span>
          </div>
          <Link
            href="/fix-engine?tab=results"
            className="text-[11px] font-bold text-warning-900 hover:underline shrink-0"
          >
            Review Plan B →
          </Link>
        </div>
      ) : stats.topEvaluating ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-200 bg-surface-1 p-3 text-xs">
          <div className="flex items-center gap-2 text-brand-700">
            <Clock size={15} className="text-brand-500 shrink-0" />
            <span>
              <strong>Active Observation:</strong> {stats.topEvaluating.title} is live and gathering search engine re-indexing signals.
            </span>
          </div>
          <Link
            href="/fix-engine?tab=results"
            className="text-[11px] font-bold text-accent-700 hover:underline shrink-0"
          >
            See timeline →
          </Link>
        </div>
      ) : null}
    </section>
  );
}

