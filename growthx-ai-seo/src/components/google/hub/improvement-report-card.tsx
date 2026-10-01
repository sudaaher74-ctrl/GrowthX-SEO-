"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle2, FileSpreadsheet, Sparkles, TrendingUp } from "lucide-react";

export function ImprovementReportCard() {
  return (
    <div className="lg:col-span-3 flex flex-col justify-between rounded-2xl border border-brand-200/50 bg-brand-50/50 p-4 shadow-card backdrop-blur-md">
      <div>
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

        <div className="mt-4 space-y-2 rounded-xl border border-brand-200/40 bg-brand-100/30 p-3">
          <div className="flex items-center gap-2 text-[11.5px] text-brand-400">
            <TrendingUp size={13} className="text-signal-400 shrink-0" />
            <span>Search & traffic performance audit</span>
          </div>
          <div className="flex items-center gap-2 text-[11.5px] text-brand-400">
            <CheckCircle2 size={13} className="text-signal-400 shrink-0" />
            <span>Prioritized action items by impact</span>
          </div>
          <div className="flex items-center gap-2 text-[11.5px] text-brand-400">
            <FileSpreadsheet size={13} className="text-signal-400 shrink-0" />
            <span>Export to Markdown or PDF</span>
          </div>
        </div>
      </div>

      <div className="pt-4">
        <Link
          href="/google/report"
          className="group flex w-full items-center justify-center gap-2 rounded-xl bg-signal-400 px-3.5 py-2 text-xs font-bold text-signal-ink hover:bg-signal-500 transition-colors shadow-xs"
        >
          <span>Get the full report</span>
          <ArrowRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>
    </div>
  );
}
