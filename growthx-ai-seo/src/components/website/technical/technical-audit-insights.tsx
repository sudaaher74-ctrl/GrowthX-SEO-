"use client";

import React from "react";
import { ArrowRight, Lightbulb, Sparkles } from "lucide-react";
import { cn, formatRelativeTime } from "@/lib/utils";
import type { CrawlIssue, CrawlJob, CrawlQualityDiagnostics } from "@/lib/api-client";
import { DonutChart } from "../donut-chart";
import { getCategoryIcon } from "./technical-seo-helpers";

export interface TechnicalAuditInsightsProps {
  issues: CrawlIssue[];
  donutData: { label: string; value: number; color: string }[];
  categoryCounts: [string, number][];
  selectedCategory: string;
  onSelectCategory: (cat: string) => void;
  crawl: CrawlJob | null;
  pagesCount: number;
  qualityDiagnostics?: CrawlQualityDiagnostics | null;
  durationText: string;
  avgLatency: string;
  topOpportunities: { id: string; title: string; count?: number }[];
  onOpenLogs?: () => void;
  onOpenRecommendations?: () => void;
}

export function TechnicalAuditInsights({
  issues,
  donutData,
  categoryCounts,
  selectedCategory,
  onSelectCategory,
  crawl,
  pagesCount,
  qualityDiagnostics,
  durationText,
  avgLatency,
  topOpportunities,
  onOpenLogs,
  onOpenRecommendations,
}: TechnicalAuditInsightsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
      {/* Card 1: Issue Distribution (Clean 2x2 grid, NO TRUNCATION!) */}
      <div
        className="rounded-2xl border bg-surface-1 p-4 shadow-card flex flex-col justify-between"
        style={{ borderColor: "var(--border-color)" }}
      >
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-[13px] font-bold text-brand-950">Issue Distribution</h3>
            <span className="text-[11px] font-mono text-brand-400">{issues.length} total</span>
          </div>
          <div className="flex justify-center py-2">
            <DonutChart
              data={donutData}
              centerValue={issues.length}
              centerLabel="Issues"
              size={105}
              thickness={14}
              showLegend={false}
            />
          </div>
        </div>

        {/* Full labels without truncation */}
        <div className="grid grid-cols-2 gap-1.5 pt-2 border-t text-[11px]" style={{ borderColor: "var(--border-color)" }}>
          {donutData.map((d) => {
            const pct = issues.length > 0 ? Math.round((d.value / issues.length) * 100) : 0;
            return (
              <div
                key={d.label}
                className="flex items-center justify-between rounded-lg bg-surface-2 px-2 py-1 border"
                style={{ borderColor: "var(--border-color)" }}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                  <span className="text-brand-950 font-medium truncate">{d.label}</span>
                </div>
                <span className="font-mono text-[10.5px] font-bold text-brand-400 ml-1">
                  {d.value} <span className="text-[9.5px]">({pct}%)</span>
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Card 2: Issue by Category */}
      <div
        className="rounded-2xl border bg-surface-1 p-4 shadow-card flex flex-col justify-between"
        style={{ borderColor: "var(--border-color)" }}
      >
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[13px] font-bold text-brand-950">Issue by Category</h3>
            <span className="text-[10px] font-mono uppercase tracking-wider text-brand-400">Click to filter</span>
          </div>
          {categoryCounts.length === 0 ? (
            <p className="text-xs text-brand-400 py-6 text-center">No issues categorized.</p>
          ) : (
            <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
              {categoryCounts.map(([cat, count]) => {
                const isSelected = selectedCategory.toLowerCase() === cat.toLowerCase();
                const pct = issues.length > 0 ? Math.round((count / issues.length) * 100) : 0;
                return (
                  <div
                    key={cat}
                    onClick={() => onSelectCategory(cat === selectedCategory ? "ALL" : cat)}
                    className={cn(
                      "group flex flex-col gap-1 p-2 rounded-xl border transition-all cursor-pointer",
                      isSelected
                        ? "bg-brand-100 border-signal-400/50 shadow-xs"
                        : "bg-surface-2 hover:bg-brand-100/50 hover:border-brand-300/40"
                    )}
                    style={{ borderColor: isSelected ? undefined : "var(--border-color)" }}
                  >
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        {getCategoryIcon(cat)}
                        <span className="font-semibold text-brand-950 truncate">{cat}</span>
                      </div>
                      <div className="flex items-center gap-1.5 font-mono">
                        <span className="text-[10.5px] text-brand-400">{pct}%</span>
                        <span className="rounded-full bg-brand-200 px-2 py-0.2 text-[10px] font-bold text-brand-950">
                          {count}
                        </span>
                      </div>
                    </div>
                    <div className="h-1 w-full overflow-hidden rounded-full bg-brand-200/50">
                      <div className="h-full rounded-full bg-signal-400" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Card 3: Crawl Status */}
      <div
        className="rounded-2xl border bg-surface-1 p-4 shadow-card flex flex-col justify-between"
        style={{ borderColor: "var(--border-color)" }}
      >
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[13px] font-bold text-brand-950">Crawl Status</h3>
            <span className="rounded-full border border-success-200/50 bg-success-50/50 px-2 py-0.5 text-[10px] font-mono font-bold text-success-700">
              {crawl?.status || "Ready"}
            </span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between text-brand-400">
              <span>Started</span>
              <span className="font-mono text-brand-950">
                {crawl?.startedAt ? formatRelativeTime(crawl.startedAt) : "—"}
              </span>
            </div>
            <div className="flex items-center justify-between text-brand-400">
              <span>Completed</span>
              <span className="font-mono text-brand-950">
                {crawl?.finishedAt ? formatRelativeTime(crawl.finishedAt) : "—"}
              </span>
            </div>
            <div className="flex items-center justify-between text-brand-400">
              <span>Duration</span>
              <span className="font-mono text-brand-950">{durationText}</span>
            </div>
            <div className="flex items-center justify-between text-brand-400">
              <span>Pages crawled</span>
              <span className="font-mono font-bold text-brand-950">
                {qualityDiagnostics?.urlsDiscovered
                  ? `${pagesCount.toLocaleString()} of ${qualityDiagnostics.urlsDiscovered.toLocaleString()}`
                  : pagesCount.toLocaleString()}
              </span>
            </div>
            <div className="flex items-center justify-between text-brand-400">
              <span>Average latency</span>
              <span className="font-mono text-brand-950">{avgLatency}</span>
            </div>
          </div>
        </div>

        <div className="mt-3 pt-2.5 border-t" style={{ borderColor: "var(--border-color)" }}>
          <button
            type="button"
            onClick={onOpenLogs}
            className="w-full rounded-xl border bg-surface-2 hover:bg-brand-100 py-1.5 text-xs font-bold text-brand-950 transition-all inline-flex items-center justify-center gap-1.5 shadow-2xs"
            style={{ borderColor: "var(--border-color)" }}
          >
            <span>View Crawl Logs</span>
            <ArrowRight size={12} className="text-brand-400" />
          </button>
        </div>
      </div>

      {/* Card 4: Top Opportunities */}
      <div
        className="rounded-2xl border bg-surface-1 p-4 shadow-card flex flex-col justify-between"
        style={{ borderColor: "var(--border-color)" }}
      >
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5">
              <Lightbulb size={15} className="text-signal-400" />
              <h3 className="text-[13px] font-bold text-brand-950">Top Opportunities</h3>
            </div>
            <span className="text-[10px] font-mono text-brand-400">{topOpportunities.length} action items</span>
          </div>

          {topOpportunities.length === 0 ? (
            <p className="text-xs text-brand-400 py-6 text-center">No critical opportunities detected.</p>
          ) : (
            <div className="space-y-2">
              {topOpportunities.map((opp, i) => (
                <div
                  key={opp.id}
                  className="flex items-start gap-2 text-xs rounded-xl bg-surface-2 p-2.5 border"
                  style={{ borderColor: "var(--border-color)" }}
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-signal-400 text-signal-ink font-bold font-mono text-[10px] mt-0.5">
                    {i + 1}
                  </span>
                  <span className="text-brand-950 leading-snug line-clamp-2 font-medium">
                    {opp.title}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-3 pt-2.5 border-t" style={{ borderColor: "var(--border-color)" }}>
          <button
            type="button"
            onClick={onOpenRecommendations}
            className="w-full rounded-xl bg-signal-400 hover:bg-signal-500 py-1.5 text-xs font-bold text-signal-ink transition-all inline-flex items-center justify-center gap-1.5 shadow-xs"
          >
            <Sparkles size={12} className="text-signal-ink" />
            <span>View AI Recommendations</span>
          </button>
        </div>
      </div>
    </div>
  );
}
