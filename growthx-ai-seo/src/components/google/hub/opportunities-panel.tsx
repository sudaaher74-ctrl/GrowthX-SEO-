"use client";

import Link from "next/link";
import { ArrowRight, ChevronRight, Lightbulb, Zap } from "lucide-react";
import type { GrowthOpportunity } from "@/lib/api-types";
import { cn } from "@/lib/utils";

export interface OpportunitiesPanelProps {
  opportunities: GrowthOpportunity[];
  totalCount?: number;
  isLoading?: boolean;
}

export function OpportunitiesPanel({
  opportunities,
  totalCount,
  isLoading,
}: OpportunitiesPanelProps) {
  const displayOpps = opportunities.slice(0, 3);
  const countDisplay = totalCount ?? opportunities.length;

  return (
    <div className="rounded-2xl border border-brand-200/50 bg-brand-50/50 p-5 shadow-card backdrop-blur-md">
      {/* ── HEADER ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-signal-400 text-signal-ink font-bold shadow-xs">
            <Lightbulb size={18} />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-brand-950">Growth Opportunities</h3>
              <span className="rounded-full bg-signal-400/20 px-2 py-0.5 font-mono text-[10.5px] font-bold text-signal-ink">
                {countDisplay} open
              </span>
            </div>
            <p className="text-xs text-brand-400">
              High-impact ranking opportunities and fixes detected from Search Console and Analytics.
            </p>
          </div>
        </div>

        <Link
          href="/google/opportunities"
          className="inline-flex items-center gap-1.5 rounded-full border border-brand-200/70 bg-brand-100/60 px-3.5 py-1.5 text-xs font-bold text-brand-950 hover:bg-signal-400 hover:text-signal-ink transition shadow-2xs group"
        >
          <span>View all opportunities</span>
          <ArrowRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>

      {/* ── OPPORTUNITY CARDS GRID ── */}
      {isLoading ? (
        <div className="py-8 text-center text-xs text-brand-400">Loading opportunities…</div>
      ) : displayOpps.length === 0 ? (
        <div className="rounded-xl border border-dashed border-brand-200/80 p-6 text-center">
          <p className="text-xs font-semibold text-brand-950">No open opportunities detected</p>
          <p className="mt-1 text-[11.5px] text-brand-400">
            Your website has passed all current audit checks for this period.
          </p>
          <Link
            href="/google/opportunities"
            className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-signal-400 hover:underline"
          >
            <span>Open opportunity dashboard</span>
            <ChevronRight size={12} />
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 lg:grid-cols-3">
          {displayOpps.map((op) => {
            const isHigh = op.potential === "HIGH";
            const isLowEffort = op.effort === "LOW";

            return (
              <Link
                key={op.id}
                href="/google/opportunities"
                className="group flex flex-col justify-between rounded-xl border border-brand-200/60 bg-brand-100/40 p-4 hover:border-brand-300 hover:bg-brand-100/70 hover:shadow-card transition"
              >
                <div>
                  {/* Badges row */}
                  <div className="flex flex-wrap items-center gap-1.5 mb-2.5">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wider",
                        isHigh
                          ? "bg-error-500/15 text-error-600"
                          : "bg-warning-500/15 text-warning-600"
                      )}
                    >
                      {isHigh ? "High Potential" : "Medium"}
                    </span>

                    {isLowEffort && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-success-500/15 px-2 py-0.5 text-[9.5px] font-bold text-success-600">
                        <Zap size={9} />
                        Quick win
                      </span>
                    )}

                    <span className="rounded-full bg-brand-200/60 px-2 py-0.5 text-[9.5px] font-medium text-brand-600">
                      {op.category}
                    </span>
                  </div>

                  {/* Title */}
                  <h4 className="text-[12.5px] font-bold text-brand-950 group-hover:text-signal-400 transition line-clamp-2 leading-snug">
                    {op.title}
                  </h4>

                  {/* Recommended action / summary */}
                  <p className="mt-1.5 text-[11.5px] text-brand-600 line-clamp-2 leading-relaxed">
                    {op.recommendedAction || op.summary}
                  </p>
                </div>

                {/* Footer */}
                <div className="mt-3.5 flex items-center justify-between border-t border-brand-200/40 pt-2.5 text-[11px]">
                  {op.affectedPages?.length ? (
                    <span className="font-mono text-brand-400">
                      {op.affectedPages.length} {op.affectedPages.length === 1 ? "page" : "pages"} affected
                    </span>
                  ) : (
                    <span className="text-brand-400">Site-wide</span>
                  )}

                  <span className="inline-flex items-center gap-1 font-semibold text-accent-700 group-hover:underline">
                    <span>Investigate</span>
                    <ChevronRight size={12} />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
