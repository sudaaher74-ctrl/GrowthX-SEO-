"use client";

import React from "react";
import {
  FileText,
  Calendar,
  Target,
  Bot,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  Loader2,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface FixEngineHeroBannerProps {
  totalFixes?: number;
  estDays?: number;
  coveragePct?: number;
  isApproved?: boolean;
  isApproving?: boolean;
  completedFixes?: number;
  onApprovePlan?: () => void;
  className?: string;
}

export function FixEngineHeroBanner({
  totalFixes = 0,
  estDays = 30,
  coveragePct = 100,
  isApproved = false,
  isApproving = false,
  completedFixes = 0,
  onApprovePlan,
  className,
}: FixEngineHeroBannerProps) {
  const pendingFixes = Math.max(0, totalFixes - completedFixes);
  const percentStarted = totalFixes > 0 ? Math.round((completedFixes / totalFixes) * 100) : 0;

  // Donut ring parameters
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (circumference * percentStarted) / 100;

  return (
    <div className={cn("grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch", className)}>
      {/* ── Left Hero Card (Col span 8) ── */}
      <div className="lg:col-span-8 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs flex flex-col justify-between">
        {/* Top: Header Info & CTA Action Box */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5 min-w-0">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-white shadow-2xs">
              <FileText size={20} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-[16.5px] font-bold text-slate-900 leading-tight">
                  Your 30-Day Fix Plan
                </h2>
                <span className="rounded-md bg-slate-100 border border-slate-200 px-2 py-0.5 text-[10.5px] font-bold text-slate-800">
                  Autonomous
                </span>
              </div>
              <p className="mt-1 text-[12px] text-slate-500 leading-relaxed max-w-lg">
                We&apos;ve created a complete plan with{" "}
                <span className="font-bold text-slate-700">{totalFixes} high-impact fixes</span> across SEO, technical architecture, and AI visibility.
              </p>
            </div>
          </div>

          {/* Action Box */}
          <div className="shrink-0 w-full md:w-auto md:min-w-[240px] rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 shadow-2xs">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-[12.5px] font-bold text-slate-900">
                {isApproved ? "Plan Activated" : "Ready to start?"}
              </h4>
              <span className={cn(
                "text-[10px] font-bold px-1.5 py-0.5 rounded border",
                isApproved
                  ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                  : "bg-slate-200 text-slate-800 border-slate-300"
              )}>
                {isApproved ? "Running" : "1-Click Start"}
              </span>
            </div>
            <p className="mt-0.5 text-[11px] text-slate-500">
              {isApproved
                ? "Autonomous remediation is queued."
                : "Review and approve to begin fixes."}
            </p>

            <button
              type="button"
              onClick={onApprovePlan}
              disabled={isApproving || isApproved}
              className={cn(
                "mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-xl py-2 px-3 text-[12px] font-bold text-white transition-all shadow-xs cursor-pointer",
                isApproved
                  ? "bg-emerald-600 hover:bg-emerald-700 cursor-default shadow-emerald-600/20"
                  : "bg-slate-950 hover:bg-black active:scale-[0.98]"
              )}
            >
              {isApproving ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  <span>Approving Plan...</span>
                </>
              ) : isApproved ? (
                <>
                  <Check size={14} strokeWidth={3} />
                  <span>Plan Approved &amp; Active</span>
                </>
              ) : (
                <>
                  <span>Approve &amp; Start 30-Day Plan</span>
                  <ArrowRight size={13} />
                </>
              )}
            </button>
          </div>
        </div>

        {/* Bottom: 4 Quick Stat Pills spanning full width */}
        <div className="mt-4 pt-3.5 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {/* Stat 1 */}
          <div className="flex items-center gap-2.5 rounded-xl bg-slate-50/90 border border-slate-100 p-2.5 min-w-0">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-200/80 text-slate-800 shrink-0">
              <Sparkles size={14} />
            </div>
            <div className="min-w-0">
              <span className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider leading-none">
                Total Fixes
              </span>
              <span className="text-[13px] font-extrabold text-slate-900 leading-tight">
                {totalFixes}
              </span>
            </div>
          </div>

          {/* Stat 2 */}
          <div className="flex items-center gap-2.5 rounded-xl bg-slate-50/90 border border-slate-100 p-2.5 min-w-0">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-200/80 text-slate-800 shrink-0">
              <Calendar size={14} />
            </div>
            <div className="min-w-0">
              <span className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider leading-none">
                Est. Time
              </span>
              <span className="text-[13px] font-extrabold text-slate-900 leading-tight">
                {estDays} days
              </span>
            </div>
          </div>

          {/* Stat 3 */}
          <div className="flex items-center gap-2.5 rounded-xl bg-slate-50/90 border border-slate-100 p-2.5 min-w-0">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-200/80 text-slate-800 shrink-0">
              <Target size={14} />
            </div>
            <div className="min-w-0">
              <span className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider leading-none">
                Plan Coverage
              </span>
              <span className="text-[13px] font-extrabold text-slate-900 leading-tight">
                {coveragePct}%
              </span>
            </div>
          </div>

          {/* Stat 4 */}
          <div className="flex items-center gap-2.5 rounded-xl bg-slate-50/90 border border-slate-100 p-2.5 min-w-0">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-200/80 text-slate-800 shrink-0">
              <Bot size={14} />
            </div>
            <div className="min-w-0">
              <span className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider leading-none">
                AI Execution
              </span>
              <span className="text-[12px] font-extrabold text-slate-900 leading-tight block truncate">
                Fully Automated
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Right Plan Status Card (Col span 4) ── */}
      <div className="lg:col-span-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <h3 className="text-[13.5px] font-bold text-slate-900">Plan Status</h3>
          <span className={cn(
            "text-[10px] font-bold px-2 py-0.5 rounded-full border",
            isApproved
              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
              : "bg-slate-100 text-slate-800 border-slate-200"
          )}>
            {isApproved ? "Executing" : "Awaiting Approval"}
          </span>
        </div>

        <div className="my-auto py-2 flex items-center justify-around gap-4">
          {/* Circular Donut Ring */}
          <div className="relative flex h-22 w-22 shrink-0 items-center justify-center">
            <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
              {/* Background Track */}
              <circle
                cx="50"
                cy="50"
                r={radius}
                fill="none"
                stroke="#f1f5f9"
                strokeWidth="10"
              />
              {/* Active Ring */}
              <circle
                cx="50"
                cy="50"
                r={radius}
                fill="none"
                stroke={isApproved ? "#10b981" : "#0f172a"}
                strokeWidth="10"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                className="transition-all duration-700"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-[17px] font-extrabold text-slate-900 leading-none">
                {percentStarted}%
              </span>
              <span className="text-[10px] font-medium text-slate-400 mt-1">
                {isApproved ? "Active" : "Started"}
              </span>
            </div>
          </div>

          {/* Breakdown Legend */}
          <div className="space-y-1.5 text-[11.5px]">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-slate-900 shrink-0" />
                <span className="text-slate-600">Total Fixes</span>
              </div>
              <span className="font-bold text-slate-900">{totalFixes}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                <span className="text-slate-600">Completed</span>
              </div>
              <span className="font-bold text-slate-900">{completedFixes}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-slate-400 shrink-0" />
                <span className="text-slate-600">Pending</span>
              </div>
              <span className="font-bold text-slate-900">{pendingFixes}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-slate-300 shrink-0" />
                <span className="text-slate-600">Scheduled</span>
              </div>
              <span className="font-bold text-slate-900">{totalFixes}</span>
            </div>
          </div>
        </div>

        <div className="pt-2 border-t border-slate-100 flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span>Continuous crawl verification active</span>
        </div>
      </div>
    </div>
  );
}
