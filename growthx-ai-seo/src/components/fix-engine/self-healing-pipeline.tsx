"use client";

import { useState } from "react";
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  Clock,
  Compass,
  FileCode,
  GitBranch,
  GitPullRequest,
  Globe,
  Layers,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

export function SelfHealingPipeline() {
  const [activeStage, setActiveStage] = useState<number | null>(null);

  const stages = [
    {
      num: 1,
      title: "Round 1 Code Fix",
      subtitle: "Crawler finds Page 2 ranking",
      desc: "Fix Engine opens PR #1 (e.g. Title & Meta description rewrite) and stages it for deployment.",
      tag: "Round 1",
      tone: "default" as const,
    },
    {
      num: 2,
      title: "21-Day Observation",
      subtitle: "Live HTML confirmed",
      desc: "Crawler verifies the code is live. Daily Google Search Console clicks, impressions, and AI citations are tracked.",
      tag: "14–21 Days",
      tone: "info" as const,
    },
    {
      num: 3,
      title: "Outcome Evaluation",
      subtitle: "Automatic lift check",
      desc: "Reigel checks if search clicks and ranks improved. If lift is confirmed, gains are locked in as a WIN.",
      tag: "Automated",
      tone: "good" as const,
    },
    {
      num: 4,
      title: "AI Root Cause Scan",
      subtitle: "Triggered if flat / 0 lift",
      desc: "Comparative audit against top 3 rivals: checks intent mismatch, lack of FAQ schema, or content depth deficit.",
      tag: "Diagnosis",
      tone: "warn" as const,
    },
    {
      num: 5,
      title: "Plan B PR (Round 2)",
      subtitle: "Alternative strategy",
      desc: "Fix Engine opens Round 2 PR with new method: e.g. injecting rich JSON-LD FAQ schema and long-tail query clusters.",
      tag: "Round 2",
      tone: "accent" as const,
    },
    {
      num: 6,
      title: "Re-Observe Until Win",
      subtitle: "Autonomous iteration",
      desc: "The loop repeats observation until measurable ranking, traffic, and AI citation gains are delivered.",
      tag: "Loop Closes",
      tone: "good" as const,
    },
  ];

  return (
    <div className="rounded-2xl border border-brand-200 bg-surface-1 p-5 shadow-2xs space-y-4">
      {/* Header */}
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-signal-400 text-signal-ink font-bold text-xs">
              ∞
            </span>
            <h2 className="text-[15px] font-bold tracking-tight text-brand-950">
              The Adaptive Self-Healing Engine (How Reigel Guarantees Results)
            </h2>
          </div>
          <p className="mt-0.5 text-xs text-brand-500">
            Reigel never stops at a single pull request. If an initial fix produces flat results after 21 days, the system autonomously diagnoses why it failed and deploys Plan B.
          </p>
        </div>

        <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-surface-2 px-3 py-1 text-[11px] font-semibold text-brand-700 shrink-0">
          <span className="h-2 w-2 rounded-full bg-signal-400 animate-pulse" />
          Autonomous 6-Stage Loop
        </span>
      </div>

      {/* 6-Stage Flow Visual Cards */}
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-6">
        {stages.map((stage) => {
          const isSelected = activeStage === stage.num;
          return (
            <div
              key={stage.num}
              onClick={() => setActiveStage(isSelected ? null : stage.num)}
              className={cn(
                "relative rounded-xl border p-3 cursor-pointer transition-all flex flex-col justify-between space-y-2",
                stage.tone === "good" && "border-success-200 bg-success-50/20 hover:border-success-300",
                stage.tone === "warn" && "border-warning-200 bg-warning-50/20 hover:border-warning-300",
                stage.tone === "accent" && "border-accent-200 bg-accent-50/20 hover:border-accent-300",
                stage.tone === "info" && "border-brand-200 bg-surface-2 hover:border-brand-300",
                stage.tone === "default" && "border-brand-200 bg-surface-2 hover:border-brand-300",
                isSelected && "ring-2 ring-signal-400 border-signal-400 shadow-xs",
              )}
            >
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-surface-1 border border-brand-200 text-[10.5px] font-bold text-brand-950">
                    {stage.num}
                  </span>
                  <span className="rounded-full px-1.5 py-0.5 text-[9.5px] font-bold bg-surface-1 border border-brand-200/60 text-brand-600">
                    {stage.tag}
                  </span>
                </div>
                <h3 className="text-[12px] font-bold text-brand-950 leading-tight">
                  {stage.title}
                </h3>
                <p className="text-[10.5px] font-medium text-brand-500 leading-tight">
                  {stage.subtitle}
                </p>
              </div>

              <p className="text-[11px] text-brand-600 leading-snug border-t border-brand-200/50 pt-2">
                {stage.desc}
              </p>
            </div>
          );
        })}
      </div>

      {/* Outcome Branching Legend */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-xs">
        {/* Branch A: Win */}
        <div className="flex items-start gap-2.5 rounded-xl border border-success-200 bg-success-50/40 p-3">
          <CheckCircle2 size={16} className="text-success-700 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-bold text-success-900">Branch A: Lift Detected (Win Locked In)</p>
            <p className="text-success-800 leading-snug text-[11.5px]">
              If Search Console clicks, impressions, or AI citations rise during the 21-day observation window, Reigel confirms the lift and locks in the gains.
            </p>
          </div>
        </div>

        {/* Branch B: Self-Healing */}
        <div className="flex items-start gap-2.5 rounded-xl border border-warning-200 bg-warning-50/40 p-3">
          <Bot size={16} className="text-warning-800 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-bold text-warning-900">Branch B: Flatline Detected (Plan B Auto-Pivot)</p>
            <p className="text-warning-800 leading-snug text-[11.5px]">
              If results are flat against high-authority competitors, Reigel diagnoses the root cause (e.g. competitor schema or word depth) and opens a Round 2 PR with Method B.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
