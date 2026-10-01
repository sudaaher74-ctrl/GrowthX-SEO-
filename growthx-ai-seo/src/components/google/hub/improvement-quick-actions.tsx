"use client";

import Link from "next/link";
import { ArrowRight, BarChart2, ChevronRight, FileText, Lightbulb, Play, Settings, Sparkles } from "lucide-react";

export function ImprovementQuickActions() {
  return (
    <div className="lg:col-span-3 flex flex-col gap-4">
      {/* Improvement Report Card */}
      <div className="rounded-2xl border border-brand-200/50 bg-brand-50/50 p-4 shadow-card backdrop-blur-md flex flex-col justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-signal-400 text-signal-ink">
            <Sparkles size={18} />
          </span>
          <div>
            <h3 className="text-sm font-bold text-brand-950">Improvement report</h3>
            <p className="mt-0.5 text-[11px] text-brand-400 leading-snug">
              Complete analysis of your Search Console and Analytics 4 data.
            </p>
          </div>
        </div>

        <div className="pt-4">
          <Link
            href="/google/report"
            className="group inline-flex items-center gap-1.5 text-xs font-bold text-signal-400 hover:text-signal-500 transition-colors"
          >
            <span>Get the full report</span>
            <ArrowRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>
      </div>

      {/* Quick Actions Card */}
      <div className="flex-1 rounded-2xl border border-brand-200/50 bg-brand-50/50 p-4 shadow-card backdrop-blur-md flex flex-col justify-between">
        <div className="flex items-center justify-between pb-2">
          <h3 className="text-xs font-bold text-brand-950">Quick actions</h3>
          <Settings size={13} className="text-brand-400 hover:text-brand-950 transition" />
        </div>

        <div className="space-y-1.5">
          <Link
            href="/website"
            className="group flex items-center justify-between rounded-xl p-1.5 hover:bg-brand-100/70 transition"
          >
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-signal-400/20 text-signal-400">
                <Play size={11} fill="currentColor" />
              </span>
              <span className="text-[11.5px] font-semibold text-brand-950">Run new audit</span>
            </div>
            <ChevronRight size={12} className="text-brand-400 group-hover:translate-x-0.5 transition-transform" />
          </Link>

          <Link
            href="/google/opportunities"
            className="group flex items-center justify-between rounded-xl p-1.5 hover:bg-brand-100/70 transition"
          >
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-warning-500/20 text-warning-500">
                <Lightbulb size={12} />
              </span>
              <span className="text-[11.5px] font-semibold text-brand-950">View opportunities</span>
            </div>
            <ChevronRight size={12} className="text-brand-400 group-hover:translate-x-0.5 transition-transform" />
          </Link>

          <Link
            href="/google/index"
            className="group flex items-center justify-between rounded-xl p-1.5 hover:bg-brand-100/70 transition"
          >
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-brand-200/60 text-brand-950">
                <FileText size={12} />
              </span>
              <span className="text-[11.5px] font-semibold text-brand-950">Check index status</span>
            </div>
            <ChevronRight size={12} className="text-brand-400 group-hover:translate-x-0.5 transition-transform" />
          </Link>

          <Link
            href="/competitor-intelligence"
            className="group flex items-center justify-between rounded-xl p-1.5 hover:bg-brand-100/70 transition"
          >
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-success-500/20 text-success-500">
                <BarChart2 size={12} />
              </span>
              <span className="text-[11.5px] font-semibold text-brand-950">Compare with competitor</span>
            </div>
            <ChevronRight size={12} className="text-brand-400 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>
      </div>
    </div>
  );
}
