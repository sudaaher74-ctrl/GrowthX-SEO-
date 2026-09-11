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
    <div className={cn("grid grid-cols-1 lg:grid-cols-12 gap-6", className)}>
      {/* ── Left Hero Card (Col span 8) ── */}
      <div className="lg:col-span-8 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
          {/* Details on Left (Col span 7) */}
          <div className="md:col-span-7">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-50 text-purple-600 border border-purple-100">
                <FileText size={20} />
              </div>
              <div>
                <h2 className="text-[16px] font-bold text-slate-900 leading-tight">
                  Your 30-Day Fix Plan
                </h2>
                <p className="mt-0.5 text-[11.5px] text-slate-500">
                  We&apos;ve created a complete plan with {totalFixes} high-impact fixes across SEO, technical, and AI visibility.
                </p>
              </div>
            </div>

            {/* 4 Quick Stat Pills */}
            <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-2">
              {/* Stat 1 */}
              <div className="flex items-center gap-2 rounded-xl bg-slate-50/80 border border-slate-100 p-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-100/60 text-purple-600 shrink-0">
                  <Sparkles size={14} />
                </div>
                <div>
                  <span className="block text-[10px] font-medium text-slate-400 leading-none">
                    Total Fixes
                  </span>
                  <span className="text-[13px] font-bold text-slate-900 leading-tight">
                    {totalFixes}
                  </span>
                </div>
              </div>

              {/* Stat 2 */}
              <div className="flex items-center gap-2 rounded-xl bg-slate-50/80 border border-slate-100 p-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-100/60 text-purple-600 shrink-0">
                  <Calendar size={14} />
                </div>
                <div>
                  <span className="block text-[10px] font-medium text-slate-400 leading-none">
                    Est. Time
                  </span>
                  <span className="text-[13px] font-bold text-slate-900 leading-tight">
                    {estDays} days
                  </span>
                </div>
              </div>

              {/* Stat 3 */}
              <div className="flex items-center gap-2 rounded-xl bg-slate-50/80 border border-slate-100 p-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-100/60 text-purple-600 shrink-0">
                  <Target size={14} />
                </div>
                <div>
                  <span className="block text-[10px] font-medium text-slate-400 leading-none">
                    Plan Coverage
                  </span>
                  <span className="text-[13px] font-bold text-slate-900 leading-tight">
                    {coveragePct}%
                  </span>
                </div>
              </div>

              {/* Stat 4 */}
              <div className="flex items-center gap-2 rounded-xl bg-slate-50/80 border border-slate-100 p-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-100/60 text-purple-600 shrink-0">
                  <Bot size={14} />
                </div>
                <div>
                  <span className="block text-[10px] font-medium text-slate-400 leading-none">
                    AI Execution
                  </span>
                  <span className="text-[12px] font-bold text-slate-900 leading-tight truncate">
                    Fully Automated
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Action Box on Right (Col span 5) */}
          <div className="md:col-span-5 rounded-xl border border-purple-100/70 bg-purple-50/40 p-4">
            <h4 className="text-[13px] font-bold text-slate-900">Ready to start?</h4>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
              Review the plan and approve to let us handle the rest.
            </p>

            <button
              type="button"
              onClick={onApprovePlan}
              disabled={isApproving || isApproved}
              className={cn(
                "mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl py-2.5 px-4 text-[12px] font-bold text-white transition-all shadow-xs",
                isApproved
                  ? "bg-emerald-600 hover:bg-emerald-700 cursor-default"
                  : "bg-purple-600 hover:bg-purple-700 active:scale-[0.99]"
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
      </div>

      {/* ── Right Plan Status Card (Col span 4) ── */}
      <div className="lg:col-span-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs flex flex-col justify-between">
        <h3 className="text-[13.5px] font-bold text-slate-900">Plan Status</h3>

        <div className="my-auto flex items-center justify-around gap-4 pt-2">
          {/* Circular Donut Ring */}
          <div className="relative flex h-24 w-24 shrink-0 items-center justify-center">
            <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
              {/* Background Track */}
              <circle
                cx="50"
                cy="50"
                r={radius}
                fill="none"
                stroke="#e2e8f0"
                strokeWidth="10"
              />
              {/* Active Ring */}
              <circle
                cx="50"
                cy="50"
                r={radius}
                fill="none"
                stroke="#3b82f6"
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
              <span className="text-[10px] font-medium text-slate-400 mt-0.5">
                {isApproved ? "Active" : "Started"}
              </span>
            </div>
          </div>

          {/* Breakdown Legend */}
          <div className="space-y-2 text-[12px]">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-teal-500 shrink-0" />
              <span className="font-bold text-slate-900">{totalFixes}</span>
              <span className="text-slate-500">Total Fixes</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-blue-500 shrink-0" />
              <span className="font-bold text-slate-900">{completedFixes}</span>
              <span className="text-slate-500">Completed</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-purple-500 shrink-0" />
              <span className="font-bold text-slate-900">{pendingFixes}</span>
              <span className="text-slate-500">Pending</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-slate-300 shrink-0" />
              <span className="text-slate-400">Scheduled</span>
            </div>
          </div>
        </div>

        <div className="pt-2 text-[11px] text-slate-400 text-center">
          Continuous crawl verification active
        </div>
      </div>
    </div>
  );
}
