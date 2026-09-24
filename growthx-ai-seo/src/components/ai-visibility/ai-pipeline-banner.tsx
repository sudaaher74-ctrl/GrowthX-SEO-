"use client";

import React from "react";
import { Globe, ArrowRight, Sparkles, Loader2, AlertTriangle, CircleDashed, CheckCircle2 } from "lucide-react";
import type { TrackedCompetitor, VisibilityReport } from "@/lib/api-client";
import { assistantLabel, assistantList } from "@/lib/ai-assistants";

export interface AiPipelineBannerProps {
  mode?: "overview" | "competitors" | "recommendations";
  domain?: string;
  crawledPages?: number | null;
  competitorsCount?: number;
  /** Rivals tracked in Competitor Intelligence; listed in competitors mode. */
  competitors?: TrackedCompetitor[];
  report?: VisibilityReport | null;
  onViewInsights?: () => void;
  onViewQuestions?: () => void;
  onViewCrawlDetails?: () => void;
  isAnalyzing?: boolean;
}

const HEADINGS: Record<NonNullable<AiPipelineBannerProps["mode"]>, string> = {
  overview: "AI answer tracking",
  competitors: "Competitor citations",
  recommendations: "Recommendations",
};

/**
 * What has actually been measured, and by which assistant.
 *
 * Every figure here comes from the visibility report. Before the first sweep
 * it says so instead of showing a finished analysis.
 */
export function AiPipelineBanner({
  mode = "overview",
  domain = "",
  crawledPages = null,
  competitorsCount = 0,
  competitors = [],
  report,
  onViewInsights,
  onViewQuestions,
  onViewCrawlDetails,
  isAnalyzing = false,
}: AiPipelineBannerProps) {
  const assistants = report?.measurableAssistants ?? [];
  const checked = report?.summary?.checked ?? 0;
  const cited = report?.summary?.cited ?? 0;
  const failed = report?.summary?.failedChecks ?? 0;
  const measured = checked > 0;
  const reputation = report?.reputation;
  const reputationNote =
    reputation && reputation.checked > 0 ? (
      <p className="mt-1.5 text-[11px] text-brand-500">
        Reputation questions (they name your brand): cited in {reputation.cited} of {reputation.checked}. Not counted in citation share.
      </p>
    ) : null;

  const status = isAnalyzing
    ? { label: "Asking AI assistants…", tone: "bg-accent-50 text-accent-700", dot: "bg-accent-500" }
    : measured
      ? { label: "Measured", tone: "bg-success-50 text-success-700", dot: "bg-success-500" }
      : { label: "Not measured yet", tone: "bg-brand-100 text-brand-600", dot: "bg-brand-400" };

  return (
    <div className="relative overflow-hidden rounded-2xl border bg-white p-5 shadow-xs">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        {/* Left: the site being measured */}
        <div className="lg:col-span-3 flex items-start gap-3.5 border-b lg:border-b-0 lg:border-r pb-4 lg:pb-0 lg:pr-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-50 text-accent-600 border">
            <Globe size={22} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[14px] font-bold text-brand-950 truncate">{domain || "No project selected"}</span>
              <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] font-semibold ${status.tone}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
                {status.label}
              </span>
            </div>
            <p className="mt-1 text-[11.5px] text-brand-500">
              {crawledPages != null ? `Crawled ${crawledPages.toLocaleString()} pages` : "No crawl yet"}
              {mode === "competitors" && ` · ${competitorsCount} competitor${competitorsCount === 1 ? "" : "s"} tracked`}
            </p>
            <button
              type="button"
              onClick={onViewCrawlDetails}
              className="mt-1.5 inline-flex items-center gap-1 text-[11.5px] font-semibold text-accent-600 hover:text-accent-700"
            >
              <span>View crawl details</span>
              <ArrowRight size={12} />
            </button>
          </div>
        </div>

        {/* Center: the assistants this deployment asks, with what each returned.
            On the Competitors tab, the tracked rivals and how often answers named them. */}
        <div className="lg:col-span-5 px-2">
          <p className="text-[11px] font-bold uppercase tracking-wider text-brand-400">{HEADINGS[mode]}</p>
          {mode === "competitors" ? (
            competitors.length === 0 ? (
              <p className="mt-2 text-[12px] text-brand-500">
                No rivals tracked yet. Add one here or in Competitor Intelligence.
              </p>
            ) : (
              <div className="mt-2 flex flex-wrap gap-3">
                {competitors.slice(0, 4).map((c) => {
                  const key = c.domain.toLowerCase().replace(/^www\./, "");
                  const voice = report?.shareOfVoice?.find(
                    (row) => row.domain !== null && row.domain.toLowerCase().replace(/^www\./, "") === key,
                  );
                  return (
                    <div key={c.id} className="flex items-center gap-2.5 rounded-xl border bg-brand-50/60 px-3 py-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-950 text-white">
                        {isAnalyzing ? <Loader2 size={15} className="animate-spin" /> : <Globe size={15} />}
                      </div>
                      <div className="min-w-0">
                        <span className="block max-w-[180px] truncate text-[12px] font-bold text-brand-950">
                          {c.label || c.name || c.domain}
                        </span>
                        <span className="block text-[10.5px] text-brand-500">
                          {isAnalyzing
                            ? "Checking answers…"
                            : measured
                              ? `Named in ${voice?.mentions ?? 0} of ${checked} answers`
                              : "Not measured yet"}
                          {c.pagesCrawled ? ` · ${c.pagesCrawled} pages` : ""}
                        </span>
                      </div>
                    </div>
                  );
                })}
                {competitors.length > 4 && (
                  <span className="self-center text-[11px] text-brand-500">+{competitors.length - 4} more</span>
                )}
              </div>
            )
          ) : assistants.length === 0 ? (
            <p className="mt-2 text-[12px] text-brand-500">
              No AI assistant is enabled on this deployment, so nothing can be measured yet.
            </p>
          ) : (
            <div className="mt-2 flex flex-wrap gap-3">
              {assistants.map((assistant) => {
                const row = report?.byAssistant?.find((a) => a.assistant === assistant);
                return (
                  <div
                    key={assistant}
                    className="flex items-center gap-2.5 rounded-xl border bg-brand-50/60 px-3 py-2"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-950 text-white">
                      {isAnalyzing ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
                    </div>
                    <div>
                      <span className="block text-[12px] font-bold text-brand-950">{assistantLabel(assistant)}</span>
                      <span className="block text-[10.5px] text-brand-500">
                        {isAnalyzing
                          ? "Asking your tracked questions…"
                          : row && row.checked > 0
                            ? `Cited in ${row.cited} of ${row.checked} answers`
                            : "Not asked yet"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: what the numbers so far amount to */}
        <div className="lg:col-span-4 rounded-xl border bg-brand-50/50 p-4">
          {measured ? (
            <>
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-success-600" />
                <span className="text-[13px] font-bold text-brand-950">
                  {checked} buyer answer{checked === 1 ? "" : "s"} checked
                </span>
              </div>
              <p className="mt-1 text-[11.5px] text-brand-500">
                Your brand was cited in {cited} of them over the last 28 days, across {assistantList(report?.byAssistant?.map((a) => a.assistant))}.
              </p>
              {reputationNote}
              {failed > 0 && (
                <p className="mt-1.5 flex items-center gap-1 text-[11px] text-warning-700">
                  <AlertTriangle size={12} />
                  {failed} check{failed === 1 ? "" : "s"} could not run and {failed === 1 ? "is" : "are"} left out of every rate.
                </p>
              )}
              <button
                type="button"
                onClick={onViewInsights}
                className="mt-3 flex w-full items-center justify-between rounded-lg border bg-white py-1.5 px-3 text-[12px] font-semibold text-brand-950 hover:bg-brand-50 transition-colors shadow-2xs"
              >
                <span>View AI Insights</span>
                <ArrowRight size={13} />
              </button>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <CircleDashed size={16} className="text-brand-400" />
                <span className="text-[13px] font-bold text-brand-950">No buyer answers measured yet</span>
              </div>
              <p className="mt-1 text-[11.5px] text-brand-500">
                {failed > 0
                  ? `${failed} check${failed === 1 ? "" : "s"} failed to run. Check the AI provider key and run AI Visibility again.`
                  : `Track buyer questions — ones that don't name your brand — then run AI Visibility to see whether ${assistantList(assistants)} recommends you.`}
              </p>
              {reputationNote}
              {onViewQuestions && (
                <button
                  type="button"
                  onClick={onViewQuestions}
                  className="mt-3 flex w-full items-center justify-between rounded-lg border bg-white py-1.5 px-3 text-[12px] font-semibold text-brand-950 hover:bg-brand-50 transition-colors shadow-2xs"
                >
                  <span>Pick buyer questions</span>
                  <ArrowRight size={13} />
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
