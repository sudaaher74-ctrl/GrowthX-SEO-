"use client";

import { CheckCircle2, Clock, Globe, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface MilestoneStepperProps {
  day?: number;
  totalDays?: number;
  compact?: boolean;
  className?: string;
}

export function MilestoneStepper({
  day = 1,
  totalDays = 21,
  compact = false,
  className,
}: MilestoneStepperProps) {
  const safeDay = Math.max(1, Math.min(day, totalDays));
  const currentStage = safeDay < 7 ? 1 : safeDay < 18 ? 2 : 3;
  const pct = Math.min(100, Math.round((safeDay / totalDays) * 100));

  if (compact) {
    return (
      <div className={cn("space-y-1.5 w-44", className)}>
        <div className="flex items-center justify-between text-[10.5px]">
          <span className="font-bold text-brand-950 flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-signal-400 animate-pulse" />
            Stage {currentStage}: {currentStage === 1 ? "Live in HTML" : currentStage === 2 ? "Google Indexing" : "Lift Evaluation"}
          </span>
          <span className="font-mono text-brand-500">{totalDays - safeDay}d left</span>
        </div>

        {/* 3 Segment Progress Line */}
        <div className="grid grid-cols-3 gap-1 h-1.5 w-full">
          <div className="rounded-full bg-signal-400 h-full" title="Stage 1: Deployed (Days 1–7)" />
          <div
            className={cn(
              "rounded-full h-full transition-all",
              currentStage >= 2 ? "bg-signal-400" : "bg-brand-200/60",
            )}
            title="Stage 2: Search Re-indexing (Days 8–14)"
          />
          <div
            className={cn(
              "rounded-full h-full transition-all",
              currentStage === 3 ? "bg-signal-400" : "bg-brand-200/60",
            )}
            title="Stage 3: Evaluation (Days 15–21)"
          />
        </div>

        <p className="text-[10px] text-brand-500 font-mono">
          Day {safeDay} of {totalDays}
        </p>
      </div>
    );
  }

  return (
    <div className={cn("rounded-xl border border-brand-200/80 bg-surface-2/40 p-4 space-y-3", className)}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          <Clock size={14} className="text-signal-400" />
          <span className="font-bold text-brand-950">21-Day Multi-Pillar Observation Pipeline</span>
        </div>
        <div className="flex items-center gap-2 font-mono text-[11px] text-brand-600">
          <span>Day {safeDay} of {totalDays}</span>
          <span>·</span>
          <span className="text-brand-950 font-bold">{pct}% Observed</span>
        </div>
      </div>

      {/* 3 Step Visual Flow */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Step 1 */}
        <div className={cn(
          "rounded-xl p-3 border transition-colors",
          currentStage >= 1
            ? "border-signal-400/60 bg-surface-1 shadow-2xs"
            : "border-brand-200/60 bg-surface-2/40 opacity-70",
        )}>
          <div className="flex items-center gap-2 mb-1">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-signal-400 text-signal-ink font-bold text-[10px]">
              <CheckCircle2 size={12} />
            </span>
            <span className="font-bold text-brand-950 text-xs">Stage 1: Live Deployment</span>
          </div>
          <p className="text-[11px] text-brand-500 leading-snug">
            Code verified live in HTML DOM by Reigel crawler. Baseline metrics recorded.
          </p>
          <span className="mt-2 inline-flex items-center gap-1 font-mono text-[10px] font-bold text-success-700 bg-success-50/80 px-2 py-0.5 rounded-md border border-success-200">
            <CheckCircle2 size={11} className="text-success-600" />
            100% Live in HTML
          </span>
        </div>

        {/* Step 2 */}
        <div className={cn(
          "rounded-xl p-3 border transition-colors",
          currentStage === 2
            ? "border-signal-400/80 bg-surface-1 shadow-xs ring-1 ring-signal-400/30"
            : currentStage > 2
              ? "border-signal-400/60 bg-surface-1"
              : "border-brand-200/60 bg-surface-2/40 opacity-70",
        )}>
          <div className="flex items-center gap-2 mb-1">
            <span className={cn(
              "flex h-5 w-5 items-center justify-center rounded-full font-bold text-[10px]",
              currentStage >= 2 ? "bg-signal-400 text-signal-ink" : "bg-brand-200 text-brand-600",
            )}>
              <Globe size={11} />
            </span>
            <span className="font-bold text-brand-950 text-xs">Stage 2: Re-indexing</span>
          </div>
          <p className="text-[11px] text-brand-500 leading-snug">
            Googlebot and generative AI assistants crawl fresh HTML tags. Daily signals tracked.
          </p>
          <span className="mt-2 inline-flex items-center gap-1.5 font-mono text-[10px] font-bold text-signal-400 bg-surface-2 px-2 py-0.5 rounded-md border border-brand-200">
            <span className="h-1.5 w-1.5 rounded-full bg-signal-400 animate-ping" />
            Active Observation
          </span>
        </div>

        {/* Step 3 */}
        <div className={cn(
          "rounded-xl p-3 border transition-colors",
          currentStage === 3
            ? "border-signal-400 bg-surface-1 shadow-xs"
            : "border-brand-200/60 bg-surface-2/40 opacity-70",
        )}>
          <div className="flex items-center gap-2 mb-1">
            <span className={cn(
              "flex h-5 w-5 items-center justify-center rounded-full font-bold text-[10px]",
              currentStage === 3 ? "bg-signal-400 text-signal-ink" : "bg-brand-200 text-brand-600",
            )}>
              <TrendingUp size={11} />
            </span>
            <span className="font-bold text-brand-950 text-xs">Stage 3: Lift Confirmation</span>
          </div>
          <p className="text-[11px] text-brand-500 leading-snug">
            AI checks traffic delta. Wins locked in; flat results trigger follow-up schema PR.
          </p>
          <span className="mt-2 inline-block font-mono text-[10px] font-bold text-brand-600 bg-surface-2 px-2 py-0.5 rounded-md border border-brand-200">
            Day 21 Evaluation
          </span>
        </div>
      </div>
    </div>
  );
}

