"use client";

import React, { useMemo, useState } from "react";
import { FileText, Loader2, AlertTriangle, Quote, Target } from "lucide-react";
import { useVisibilityInsights } from "@/hooks/use-growthx";
import { errorMessage } from "@/lib/error-message";
import type { InsightLevel, VisibilityInsights } from "@/lib/api-client";
import { InsightsNoData, InsightsProvenance } from "./ai-visibility-insights-tab";

type Recommendation = VisibilityInsights["recommendations"][number];

const LEVEL_ORDER: Record<InsightLevel, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };

const CATEGORY_LABEL: Record<Recommendation["category"], string> = {
  CONTENT: "Content",
  TECHNICAL: "Technical",
  AUTHORITY: "Authority",
  ON_PAGE: "On-Page",
};

const LEVEL_BADGE: Record<InsightLevel, string> = {
  HIGH: "bg-error-50 text-error-700",
  MEDIUM: "bg-warning-50 text-warning-700",
  LOW: "bg-brand-100 text-brand-600",
};

function levelLabel(level: InsightLevel) {
  return level.charAt(0) + level.slice(1).toLowerCase();
}

/**
 * Recommendations written by the model from the measured answers.
 *
 * No projected uplift, consensus score or count is shown: nothing measured
 * one. Each item carries the evidence it was drawn from.
 */
export function AiVisibilityRecommendationsTab({
  projectId,
  onRunSweep,
}: {
  projectId: string | null;
  onRunSweep?: () => void;
}) {
  const insightsQuery = useVisibilityInsights(projectId);
  const insights = insightsQuery.data;
  const [categoryFilter, setCategoryFilter] = useState<"all" | Recommendation["category"]>("all");

  const recs = useMemo(() => {
    const all = insights?.recommendations ?? [];
    return all
      .filter((r) => categoryFilter === "all" || r.category === categoryFilter)
      .sort((a, b) => LEVEL_ORDER[a.priority] - LEVEL_ORDER[b.priority] || LEVEL_ORDER[b.effort] - LEVEL_ORDER[a.effort]);
  }, [insights?.recommendations, categoryFilter]);

  if (insightsQuery.isLoading) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border bg-white p-6 text-[12.5px] text-brand-500 shadow-xs">
        <Loader2 size={15} className="animate-spin" />
        Writing recommendations from your measured answers…
      </div>
    );
  }
  if (insightsQuery.isError) {
    return (
      <div className="flex items-start gap-2 rounded-2xl border bg-warning-50/70 p-5 text-[12.5px] text-warning-700">
        <AlertTriangle size={15} className="mt-0.5 shrink-0" />
        <span>Recommendations could not be generated: {errorMessage(insightsQuery.error)}</span>
      </div>
    );
  }
  if (!insights || insights.status === "NO_DATA") return <InsightsNoData onRunSweep={onRunSweep} />;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border bg-white p-5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-brand-100 text-brand-950">
              <Target size={14} />
            </div>
            <h3 className="text-[14.5px] font-bold text-brand-950">Prioritized Recommendations</h3>
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as typeof categoryFilter)}
            aria-label="Filter recommendations by category"
            className="rounded-lg border bg-white px-2.5 py-1 text-[11.5px] font-semibold text-brand-700 hover:bg-brand-50 focus:outline-none"
          >
            <option value="all">All Categories</option>
            {Object.entries(CATEGORY_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {recs.length === 0 ? (
          <div className="p-8 text-center text-[12px] text-brand-500">
            <FileText className="mx-auto mb-2 h-5 w-5 text-brand-400" />
            No recommendations{categoryFilter === "all" ? " could be supported by the measured data" : " in this category"}.
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            {recs.map((rec, idx) => (
              <div key={idx} className="rounded-xl border bg-brand-50/50 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-md border bg-white px-2 py-0.5 text-[10.5px] font-semibold text-brand-700">
                    {CATEGORY_LABEL[rec.category]}
                  </span>
                  <span className={`rounded-md border px-2 py-0.5 text-[10.5px] font-semibold ${LEVEL_BADGE[rec.priority]}`}>
                    {levelLabel(rec.priority)} priority
                  </span>
                  <span className="rounded-md border bg-white px-2 py-0.5 text-[10.5px] font-medium text-brand-600">
                    {levelLabel(rec.effort)} effort
                  </span>
                </div>
                <p className="mt-2 text-[13px] font-bold text-brand-950">{rec.title}</p>
                <p className="mt-1 text-[12px] leading-relaxed text-brand-600">{rec.rationale}</p>
                {rec.evidence && (
                  <p className="mt-2 flex items-start gap-1.5 text-[11px] text-brand-500">
                    <Quote size={11} className="mt-0.5 shrink-0" />
                    <span>{rec.evidence}</span>
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <InsightsProvenance insights={insights} />
    </div>
  );
}
