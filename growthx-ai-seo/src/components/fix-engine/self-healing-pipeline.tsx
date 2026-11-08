"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  ArrowRight,
  Bot,
  CheckCircle2,
  Clock,
  Compass,
  FileCode,
  GitBranch,
  Layers,
  RotateCcw,
  ShieldCheck,
  TrendingUp,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

export function SelfHealingPipeline() {
  const [selectedBranch, setSelectedBranch] = useState<"WIN" | "PIVOT">("PIVOT");

  return (
    <div className="rounded-2xl border border-brand-200 bg-surface-1 p-5 shadow-2xs space-y-5">
      {/* 1. Header with Live Status Tag */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-signal-400 text-signal-ink font-bold shadow-xs">
            <RotateCcw size={15} className="animate-spin-slow" />
          </span>
          <div>
            <h2 className="text-[15px] font-bold tracking-tight text-brand-950 flex items-center gap-2">
              Autonomous Self-Healing Loop
              <span className="inline-flex items-center gap-1 rounded-full bg-signal-400/20 px-2 py-0.5 text-[10.5px] font-bold text-signal-ink border border-signal-400/40">
                <span className="h-1.5 w-1.5 rounded-full bg-signal-400 animate-pulse" />
                Active on 13 Pages
              </span>
            </h2>
            <p className="text-xs text-brand-500">
              Never stops at a single PR. If an initial fix stalls, Reigel autonomously diagnoses competitor gaps and deploys Plan B.
            </p>
          </div>
        </div>

        {/* Branch Interactive Selector */}
        <div className="flex items-center gap-1 rounded-xl border border-brand-200 bg-surface-2 p-1">
          <button
            type="button"
            onClick={() => setSelectedBranch("WIN")}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-1 text-[11.5px] font-semibold transition-all cursor-pointer",
              selectedBranch === "WIN"
                ? "bg-success-100 text-success-900 font-bold border border-success-300 shadow-2xs"
                : "text-brand-500 hover:text-brand-950",
            )}
          >
            <CheckCircle2 size={12} className="text-success-700" />
            Path A: Lift Detected (Win)
          </button>
          <button
            type="button"
            onClick={() => setSelectedBranch("PIVOT")}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-1 text-[11.5px] font-semibold transition-all cursor-pointer",
              selectedBranch === "PIVOT"
                ? "bg-warning-100 text-warning-900 font-bold border border-warning-300 shadow-2xs"
                : "text-brand-500 hover:text-brand-950",
            )}
          >
            <Bot size={12} className="text-warning-800" />
            Path B: Zero Lift $\rightarrow$ Plan B Auto-Pivot
          </button>
        </div>
      </div>

      {/* 2. Visual Animated Flow Pipeline Nodes */}
      <div className="relative rounded-xl border border-brand-200/80 bg-surface-2/40 p-4 overflow-hidden">
        {/* Animated Background Laser Glow */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-signal-400/5 to-transparent pointer-events-none" />

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-5 relative z-10">
          {/* Node 1: Round 1 Fix */}
          <div className="flex flex-col justify-between rounded-xl border border-brand-200/90 bg-surface-1 p-3.5 shadow-2xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-surface-2 border border-brand-200 text-xs font-bold text-brand-950">
                1
              </span>
              <span className="rounded-full bg-success-50 text-success-700 border border-success-200 px-2 py-0.5 text-[10px] font-bold">
                ✓ Merged
              </span>
            </div>
            <div>
              <p className="text-[12.5px] font-bold text-brand-950 flex items-center gap-1.5">
                <GitBranch size={13} className="text-brand-600" />
                Round 1 PR Deployed
              </p>
              <p className="text-[11px] text-brand-500 mt-0.5">
                Title &amp; Meta update verified live in HTML.
              </p>
            </div>
            <div className="pt-1 border-t border-brand-200/50 flex items-center justify-between text-[10.5px] text-brand-600 font-mono">
              <span>Status: Live</span>
              <span className="text-success-700 font-bold">HTML Matched</span>
            </div>
          </div>

          {/* Node 2: 21-Day Observation (CURRENT ACTIVE STAGE) */}
          <div className="flex flex-col justify-between rounded-xl border-2 border-signal-400 bg-surface-1 p-3.5 shadow-xs space-y-2 relative">
            <div className="flex items-center justify-between">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-signal-400 text-signal-ink text-xs font-bold">
                2
              </span>
              <span className="flex items-center gap-1 rounded-full bg-signal-400/20 text-signal-ink border border-signal-400/40 px-2 py-0.5 text-[10px] font-bold">
                <span className="h-1.5 w-1.5 rounded-full bg-signal-400 animate-pulse" />
                Active Stage
              </span>
            </div>
            <div>
              <p className="text-[12.5px] font-bold text-brand-950 flex items-center gap-1.5">
                <Clock size={13} className="text-signal-400" />
                21-Day Observation
              </p>
              <p className="text-[11px] text-brand-500 mt-0.5">
                Google Search Console &amp; 4 AI engines tracked daily.
              </p>
            </div>
            <div className="space-y-1 pt-1 border-t border-brand-200/50">
              <div className="flex items-center justify-between text-[10.5px]">
                <span className="font-bold text-brand-950">Day 1 of 21</span>
                <span className="text-brand-500">20d left</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-brand-200/60 overflow-hidden">
                <div className="h-full bg-signal-400 rounded-full animate-pulse" style={{ width: "5%" }} />
              </div>
            </div>
          </div>

          {/* Node 3: Decision Engine */}
          <div className="flex flex-col justify-between rounded-xl border border-brand-200/90 bg-surface-1 p-3.5 shadow-2xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-surface-2 border border-brand-200 text-xs font-bold text-brand-950">
                3
              </span>
              <span className="rounded-full bg-surface-2 text-brand-600 border border-brand-200 px-2 py-0.5 text-[10px] font-bold">
                Automated
              </span>
            </div>
            <div>
              <p className="text-[12.5px] font-bold text-brand-950 flex items-center gap-1.5">
                <Activity size={13} className="text-accent-600" />
                Outcome Evaluation
              </p>
              <p className="text-[11px] text-brand-500 mt-0.5">
                AI evaluates daily traffic delta vs 28-day baseline.
              </p>
            </div>
            <div className="pt-1 border-t border-brand-200/50 flex items-center justify-between text-[10.5px] text-brand-600 font-mono">
              <span>Threshold: +15%</span>
              <span className="text-brand-950 font-bold">Day 21 Check</span>
            </div>
          </div>

          {/* Node 4: Dynamic Fork (Win vs Plan B) */}
          <AnimatePresence mode="wait">
            {selectedBranch === "WIN" ? (
              <motion.div
                key="win-node"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex flex-col justify-between rounded-xl border border-success-300 bg-success-50/30 p-3.5 shadow-2xs space-y-2 lg:col-span-2"
              >
                <div className="flex items-center justify-between">
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-success-500 text-white text-xs font-bold">
                    4A
                  </span>
                  <span className="rounded-full bg-success-100 text-success-800 border border-success-300 px-2 py-0.5 text-[10px] font-bold">
                    Win Confirmed
                  </span>
                </div>
                <div>
                  <p className="text-[13px] font-bold text-success-900 flex items-center gap-1.5">
                    <CheckCircle2 size={14} className="text-success-700" />
                    Branch A: Search Lift Locked In
                  </p>
                  <p className="text-[11px] text-success-800 mt-0.5">
                    +38% organic clicks gained. Changes are preserved as a verified permanent baseline.
                  </p>
                </div>
                <div className="pt-1.5 border-t border-success-200 flex items-center justify-between text-[11px] text-success-900 font-semibold">
                  <span>Action: Lock Gains</span>
                  <span className="font-mono text-success-800">+8 SERP Positions</span>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="pivot-node"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex flex-col justify-between rounded-xl border border-warning-300 bg-warning-50/30 p-3.5 shadow-2xs space-y-2 lg:col-span-2"
              >
                <div className="flex items-center justify-between">
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-warning-500 text-white text-xs font-bold">
                    4B
                  </span>
                  <span className="rounded-full bg-warning-100 text-warning-900 border border-warning-300 px-2 py-0.5 text-[10px] font-bold">
                    Autonomous Pivot Triggered
                  </span>
                </div>
                <div>
                  <p className="text-[13px] font-bold text-warning-950 flex items-center gap-1.5">
                    <Bot size={14} className="text-warning-800" />
                    Branch B: AI Rival Diagnosis &amp; Plan B PR
                  </p>
                  <p className="text-[11px] text-warning-900 mt-0.5">
                    Method 1 flat $\rightarrow$ AI detects rival FAQ schema advantage $\rightarrow$ Prepares Round 2 PR.
                  </p>
                </div>
                <div className="pt-1.5 border-t border-warning-200 flex items-center justify-between text-[11px] text-warning-950 font-semibold">
                  <span>Remedy: LocalBusiness FAQ JSON-LD</span>
                  <span className="font-mono text-accent-700 font-bold">Plan B Ready →</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
