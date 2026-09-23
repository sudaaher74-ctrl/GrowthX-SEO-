"use client";

import React, { useMemo } from "react";
import {
  Radio,
  Link2,
  PieChart,
  Search,
  Sparkles,
  Info,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Lightbulb,
  Users,
  Bot,
  ExternalLink,
} from "lucide-react";
import { AiKpiCard } from "./ai-kpi-card";
import { AiVisibilityGauge } from "./ai-visibility-gauge";
import type { VisibilityReport } from "@/lib/api-client";
import { assistantLabel, assistantList } from "@/lib/ai-assistants";

export interface AiVisibilityOverviewTabProps {
  report?: VisibilityReport | null;
  trackedPromptsCount?: number;
  domain?: string;
  businessName?: string;
  onViewCompetitorsTab?: () => void;
  onViewInsightsTab?: () => void;
  onViewRecommendationsTab?: () => void;
  onGenerateRecommendations?: () => void;
}

export function AiVisibilityOverviewTab({
  report,
  trackedPromptsCount = 0,
  domain = "",
  businessName = "Your Brand",
  onViewCompetitorsTab,
  onViewInsightsTab,
  onViewRecommendationsTab,
  onGenerateRecommendations,
}: AiVisibilityOverviewTabProps) {
  // Real measurements from the AI Visibility engine. Before the first sweep
  // nothing has been measured, which reads as "—", not as 0%.
  const measured = (report?.summary?.checked ?? 0) > 0;
  const assistantsAsked = assistantList(report?.measurableAssistants);

  const mentionRate = measured ? `${report!.summary.citationSharePct}%` : "—";

  const totalCitations = report?.summary?.cited ?? 0;

  // The customer's own share of every brand mention (the report marks the
  // customer's row with a null domain).
  const ownVoice = report?.shareOfVoice?.find((row) => row.domain === null);
  const shareOfVoice = measured && ownVoice ? `${ownVoice.sharePct}%` : "—";
  const mentionTrend = (report?.trend ?? []).filter((t) => t.checked > 0).map((t) => t.citationSharePct);

  const trackedQueries = trackedPromptsCount;

  // Derive donut chart segments from real byAssistant data
  const totalCircumference = 2 * Math.PI * 46; // r=46 -> ~289.02
  const byAssistant = report?.byAssistant || [];

  const segments = useMemo(() => {
    if (byAssistant.length === 0) {
      return [
        { label: "Pending Sweep", pct: 100, color: "#cbd5e1", strokeDash: `${totalCircumference} ${totalCircumference}`, offset: 0 },
      ];
    }

    const totalCitationsAll = byAssistant.reduce((acc, a) => acc + (a.cited || 0), 0) || 1;
    const colors = ["#10b981", "#f97316", "#38bdf8", "#8b5cf6"];
    let accumulatedOffset = 0;

    return byAssistant.map((asst, idx) => {
      const pct = Math.round(((asst.cited || 0) / totalCitationsAll) * 100);
      const dashLength = (pct / 100) * totalCircumference;
      const currentOffset = accumulatedOffset;
      accumulatedOffset -= dashLength;

      return {
        label: assistantLabel(asst.assistant),
        pct,
        color: colors[idx % colors.length],
        strokeDash: `${dashLength} ${totalCircumference}`,
        offset: currentOffset,
      };
    });
  }, [byAssistant, totalCircumference]);

  // Derive top competitors from real shareOfVoice
  const topCompetitors = useMemo(() => {
    const sov = report?.shareOfVoice || [];
    // Nothing measured means nothing to rank — never a 0% row for the customer.
    if (sov.length === 0) return [];

    const barColors = ["bg-slate-700", "bg-slate-500", "bg-slate-400", "bg-slate-300", "bg-slate-200"];
    return sov.slice(0, 5).map((item, idx) => ({
      rank: idx + 1,
      domain: item.domain ?? (domain || item.label),
      sharePct: item.sharePct,
      barColor: item.domain === null ? "bg-emerald-500" : barColors[idx % barColors.length],
      isYou: item.domain === null,
    }));
  }, [report?.shareOfVoice, domain, report?.summary?.citationSharePct]);

  return (
    <div className="space-y-6">
      {/* ── ROW 1: 5 KPI Metrics (4 Wave Cards + 1 Arc Score Gauge) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Card 1: AI Mention Rate */}
        <AiKpiCard
          label="AI Mention Rate"
          value={mentionRate}
          subtext="Tracked queries where your brand is cited."
          icon={<Radio size={16} />}
          iconBgColor="bg-emerald-50 text-emerald-600"
          colorScheme="emerald"
          infoTooltip={`Share of measured answers from ${assistantsAsked} that cited your domain or brand, last 28 days.`}
          sparkline={mentionTrend}
        />

        {/* Card 2: Total Citations */}
        <AiKpiCard
          label="Total Citations"
          value={totalCitations.toLocaleString()}
          subtext={`Answers from ${assistantsAsked} that cited you.`}
          icon={<Link2 size={16} />}
          iconBgColor="bg-blue-50 text-blue-600"
          colorScheme="blue"
          infoTooltip="Measured answers in the last 28 days that named your domain or brand."
        />

        {/* Card 3: Share of Voice */}
        <AiKpiCard
          label="Share of Voice"
          value={shareOfVoice}
          subtext="Presence compared to tracked competitors."
          icon={<PieChart size={16} />}
          iconBgColor="bg-slate-100 text-slate-900"
          colorScheme="default"
          infoTooltip="Your mentions as a share of all brand mentions (you plus tracked competitors) in measured answers."
        />

        {/* Card 4: Tracked Queries */}
        <AiKpiCard
          label="Tracked Queries"
          value={trackedQueries.toString()}
          subtext="High-intent conversational buyer prompts."
          icon={<Search size={16} />}
          iconBgColor="bg-amber-50 text-amber-600"
          colorScheme="orange"
          infoTooltip="Questions asked of each enabled AI assistant on every sweep."
        />

        {/* Card 5: AI Visibility Score Gauge */}
        <AiVisibilityGauge
          score={measured ? report!.summary.citationSharePct : 0}
          statusLabel={measured ? (report!.summary.citationSharePct > 50 ? "Strong" : "Growing") : "Not measured"}
          subtext={measured ? "Share of measured answers that cite you" : "Run AI Visibility to measure"}
        />
      </div>

      {/* ── ROW 2: Model Distribution Donut (40%) + Competitor Share of Voice (60%) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: AI Model Distribution Donut (Col span 5) */}
        <div className="lg:col-span-5 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">AI Model Distribution</h3>
              <div className="flex gap-2 items-center">
                <span className="text-[10px] text-slate-500 flex items-center gap-1 border border-slate-200 px-1.5 py-0.5 rounded bg-slate-50">
                  <Sparkles size={10} className="text-slate-400" /> Powered by Sarvam AI
                </span>
                <span className="text-[11px] text-slate-700 font-semibold bg-slate-100 px-2 py-0.5 rounded-md">
                  Live Citations
                </span>
              </div>
            </div>

            {/* Donut graphic */}
            <div className="my-6 flex items-center justify-center relative">
              <svg className="w-44 h-44 -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="46" fill="transparent" stroke="#f1f5f9" strokeWidth="8" />
                {segments.map((s, idx) => (
                  <circle
                    key={idx}
                    cx="50"
                    cy="50"
                    r="46"
                    fill="transparent"
                    stroke={s.color}
                    strokeWidth="8"
                    strokeDasharray={s.strokeDash}
                    strokeDashoffset={s.offset}
                    strokeLinecap="round"
                  />
                ))}
              </svg>

              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-2xl font-black text-slate-900">{totalCitations}</span>
                <span className="text-[10px] uppercase font-bold text-slate-400">Total Citations</span>
              </div>
            </div>

            {/* Model legend breakdown */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              {segments.map((s) => (
                <div key={s.label} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                    <span className="font-semibold text-slate-700">{s.label}</span>
                  </div>
                  <span className="font-bold text-slate-900">{s.pct}%</span>
                </div>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={onViewInsightsTab}
            className="mt-5 w-full py-2.5 px-4 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 text-xs font-bold hover:bg-slate-100 transition flex items-center justify-center gap-1.5"
          >
            <span>View AI Insights</span>
            <ArrowRight size={13} />
          </button>
        </div>

        {/* Right: Competitor Share of Voice (Col span 7) */}
        <div className="lg:col-span-7 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">AI Share of Voice Benchmark</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  LLM response mentions comparing your domain vs. tracked rivals
                </p>
              </div>
              <button
                type="button"
                onClick={onViewCompetitorsTab}
                className="text-xs font-semibold text-slate-700 hover:text-slate-900 flex items-center gap-1"
              >
                <span>View All</span>
                <ArrowRight size={13} />
              </button>
            </div>

            {/* Competitor Bars */}
            <div className="mt-5 space-y-4">
              {topCompetitors.length === 0 ? (
                <div className="p-8 text-center space-y-2 border rounded-xl border-dashed border-slate-200 bg-slate-50/50">
                  <Bot className="h-6 w-6 text-slate-400 mx-auto" />
                  <p className="text-xs font-bold text-slate-800">No Share of Voice Measurements Yet</p>
                  <p className="text-[11px] text-slate-500">
                    Add competitors and run an AI Visibility sweep to measure brand mentions across LLMs.
                  </p>
                </div>
              ) : (
                topCompetitors.map((comp) => (
                  <div key={comp.domain} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className={`flex items-center gap-1.5 ${comp.isYou ? "text-slate-950 font-bold" : "text-slate-700"}`}>
                        <span>#{comp.rank}</span>
                        <span className="truncate">{comp.domain}</span>
                        {comp.isYou && (
                          <span className="bg-slate-100 text-slate-900 text-[10px] px-1.5 py-0.2 rounded font-bold">
                            You
                          </span>
                        )}
                      </span>
                      <span className="font-bold text-slate-900">{comp.sharePct}%</span>
                    </div>

                    <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${comp.barColor} rounded-full transition-all`}
                        style={{ width: `${Math.max(4, comp.sharePct)}%` }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
            <span>Measured across {assistantsAsked}</span>
            <span className="text-slate-900 font-semibold cursor-pointer hover:underline" onClick={onViewCompetitorsTab}>
              Deep Dive →
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
