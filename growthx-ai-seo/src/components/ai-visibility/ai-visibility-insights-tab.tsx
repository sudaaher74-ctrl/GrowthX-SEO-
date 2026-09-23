"use client";

import React, { useState } from "react";
import { Sparkles, Loader2, Search, CircleDashed, AlertTriangle, Quote } from "lucide-react";
import { useVisibilityInsights } from "@/hooks/use-growthx";
import { errorMessage } from "@/lib/error-message";
import type { VisibilityInsights } from "@/lib/api-client";

/** One line naming exactly what an analysis was written from, and by which model. */
export function InsightsProvenance({ insights }: { insights: VisibilityInsights }) {
  const b = insights.basedOn;
  return (
    <p className="text-[11px] text-brand-400">
      Written by {insights.model ?? "AI"} from {b.checks} measured answer{b.checks === 1 ? "" : "s"} across {b.prompts} tracked
      question{b.prompts === 1 ? "" : "s"}, {b.competitors} tracked competitor{b.competitors === 1 ? "" : "s"} and{" "}
      {b.crawlIssues} crawl issue{b.crawlIssues === 1 ? "" : "s"} (last {b.periodDays} days). Check each item against its evidence.
    </p>
  );
}

/** Shown in place of an analysis before anything has been measured. */
export function InsightsNoData({ onRunSweep }: { onRunSweep?: () => void }) {
  return (
    <div className="rounded-2xl border border-dashed bg-brand-50/50 p-8 text-center">
      <CircleDashed className="mx-auto h-6 w-6 text-brand-400" />
      <p className="mt-2 text-[13px] font-bold text-brand-950">Nothing to analyse yet</p>
      <p className="mx-auto mt-1 max-w-md text-[12px] text-brand-500">
        Insights are written only from answers we have actually measured. Run AI Visibility first, then come back here.
      </p>
      {onRunSweep && (
        <button
          type="button"
          onClick={onRunSweep}
          className="mt-4 rounded-xl bg-brand-950 px-4 py-2 text-[12px] font-bold text-white hover:bg-brand-800"
        >
          Run AI Visibility
        </button>
      )}
    </div>
  );
}

export function AiInsightsTab({ projectId, onRunSweep }: { projectId: string | null; onRunSweep?: () => void }) {
  const [draft, setDraft] = useState("");
  const [question, setQuestion] = useState<string | undefined>(undefined);
  const insightsQuery = useVisibilityInsights(projectId, question);
  const insights = insightsQuery.data;

  const ask = (e: React.FormEvent) => {
    e.preventDefault();
    const q = draft.trim();
    if (q) setQuestion(q);
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border bg-white p-5 shadow-xs">
        <div className="flex items-center gap-2 pb-3 border-b">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-100 text-brand-950">
            <Sparkles size={16} />
          </div>
          <div>
            <h3 className="text-[14.5px] font-bold text-brand-950">AI Insights</h3>
            <p className="text-[11.5px] text-brand-500">
              An analysis of your measured AI answers — what was cited, who was named instead, and why.
            </p>
          </div>
        </div>

        <form onSubmit={ask} className="mt-4 flex gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-400" />
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Ask about your results, e.g. why is a competitor cited instead of us?"
              className="w-full rounded-xl border py-2 pl-9 pr-3 text-[12.5px] text-brand-950 placeholder:text-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-950/20"
            />
          </div>
          <button
            type="submit"
            disabled={!draft.trim() || insightsQuery.isFetching}
            className="rounded-xl bg-brand-950 px-4 py-2 text-[12px] font-bold text-white hover:bg-brand-800 disabled:opacity-50"
          >
            Ask
          </button>
          {question && (
            <button
              type="button"
              onClick={() => {
                setQuestion(undefined);
                setDraft("");
              }}
              className="rounded-xl border px-3 py-2 text-[12px] font-semibold text-brand-700 hover:bg-brand-50"
            >
              Clear
            </button>
          )}
        </form>
      </div>

      {insightsQuery.isLoading || (insightsQuery.isFetching && !insights) ? (
        <div className="flex items-center gap-2 rounded-2xl border bg-white p-6 text-[12.5px] text-brand-500 shadow-xs">
          <Loader2 size={15} className="animate-spin" />
          Analysing your measured answers…
        </div>
      ) : insightsQuery.isError ? (
        <div className="flex items-start gap-2 rounded-2xl border bg-warning-50/70 p-5 text-[12.5px] text-warning-700">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          <span>The analysis could not be generated: {errorMessage(insightsQuery.error)}</span>
        </div>
      ) : !insights || insights.status === "NO_DATA" ? (
        <InsightsNoData onRunSweep={onRunSweep} />
      ) : (
        <div className="space-y-4">
          {insights.answer && (
            <div className="rounded-2xl border bg-accent-50/40 p-5 shadow-xs">
              <p className="text-[11px] font-bold uppercase tracking-wider text-accent-500">Your question</p>
              <p className="mt-1 text-[13px] font-semibold text-brand-950">{insights.question}</p>
              <p className="mt-2 whitespace-pre-line text-[12.5px] leading-relaxed text-brand-700">{insights.answer}</p>
            </div>
          )}

          {insights.summary && (
            <div className="rounded-2xl border bg-white p-5 shadow-xs">
              <p className="text-[11px] font-bold uppercase tracking-wider text-brand-400">Where you stand</p>
              <p className="mt-2 text-[13px] leading-relaxed text-brand-950">{insights.summary}</p>
            </div>
          )}

          <div className="rounded-2xl border bg-white p-5 shadow-xs">
            <p className="text-[11px] font-bold uppercase tracking-wider text-brand-400">Findings</p>
            {insights.findings.length === 0 ? (
              <p className="mt-2 text-[12px] text-brand-500">The analysis found nothing the data could support.</p>
            ) : (
              <div className="mt-3 space-y-3">
                {insights.findings.map((f, idx) => (
                  <div key={idx} className="rounded-xl border bg-brand-50/60 p-3.5">
                    <p className="text-[12.5px] font-bold text-brand-950">{f.title}</p>
                    <p className="mt-1 text-[12px] leading-relaxed text-brand-600">{f.detail}</p>
                    {f.evidence && (
                      <p className="mt-2 flex items-start gap-1.5 text-[11px] text-brand-500">
                        <Quote size={11} className="mt-0.5 shrink-0" />
                        <span>{f.evidence}</span>
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <InsightsProvenance insights={insights} />
        </div>
      )}
    </div>
  );
}
