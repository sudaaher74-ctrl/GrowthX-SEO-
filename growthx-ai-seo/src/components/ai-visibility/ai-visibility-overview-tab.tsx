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
  // Real measurements from the AI Visibility engine
  const mentionRate =
    report?.summary?.checked && report.summary.checked > 0
      ? `${Math.round((report.summary.cited / report.summary.checked) * 100)}%`
      : "0%";

  const totalCitations = report?.summary?.cited ?? 0;

  const shareOfVoice =
    report?.summary?.citationSharePct != null
      ? `${report.summary.citationSharePct}%`
      : "0%";

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
        label: asst.assistant,
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
    if (sov.length === 0) {
      if (domain) {
        return [
          {
            rank: 1,
            domain: domain,
            sharePct: report?.summary?.citationSharePct ?? 0,
            barColor: "bg-emerald-500",
            isYou: true,
          },
        ];
      }
      return [];
    }

    const barColors = ["bg-indigo-500", "bg-blue-500", "bg-sky-500", "bg-purple-500", "bg-emerald-500"];
    return sov.slice(0, 5).map((item, idx) => ({
      rank: idx + 1,
      domain: item.domain || item.label,
      sharePct: item.sharePct,
      barColor: item.domain === domain ? "bg-emerald-500" : barColors[idx % barColors.length],
      isYou: item.domain === domain,
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
          infoTooltip="Percentage of buyer queries in which your domain or product was cited by ChatGPT, Claude, or Gemini."
        />

        {/* Card 2: Total Citations */}
        <AiKpiCard
          label="Total Citations"
          value={totalCitations.toLocaleString()}
          subtext="Citations across ChatGPT, Claude and Gemini."
          icon={<Link2 size={16} />}
          iconBgColor="bg-blue-50 text-blue-600"
          colorScheme="blue"
          infoTooltip="Aggregated citations detected across all multi-turn conversational sweeps."
        />

        {/* Card 3: Share of Voice */}
        <AiKpiCard
          label="Share of Voice"
          value={shareOfVoice}
          subtext="Presence compared to tracked competitors."
          icon={<PieChart size={16} />}
          iconBgColor="bg-purple-50 text-purple-600"
          colorScheme="purple"
          infoTooltip="Your proportion of total brand recommendations vs. rival domains."
        />

        {/* Card 4: Tracked Queries */}
        <AiKpiCard
          label="Tracked Queries"
          value={trackedQueries.toString()}
          subtext="High-intent conversational buyer prompts."
          icon={<Search size={16} />}
          iconBgColor="bg-amber-50 text-amber-600"
          colorScheme="orange"
          infoTooltip="Active queries evaluated across AI models for brand citations."
        />

        {/* Card 5: AI Visibility Score Gauge */}
        <AiVisibilityGauge
          score={report?.summary?.citationSharePct ?? 0}
          statusLabel={report?.summary?.citationSharePct != null ? (report.summary.citationSharePct > 50 ? "Strong" : "Growing") : "Pending"}
          subtext="Composite citation & prominence index"
        />
      </div>

      {/* ── ROW 2: Model Distribution Donut (40%) + Competitor Share of Voice (60%) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: AI Model Distribution Donut (Col span 5) */}
        <div className="lg:col-span-5 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">AI Model Distribution</h3>
              <span className="text-[11px] text-purple-700 font-semibold bg-purple-50 px-2 py-0.5 rounded-md">
                Live Citations
              </span>
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
            className="mt-5 w-full py-2.5 px-4 rounded-xl border border-purple-200 bg-purple-50 text-purple-700 text-xs font-bold hover:bg-purple-100 transition flex items-center justify-center gap-1.5"
          >
            <span>View AI Council Analysis</span>
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
                className="text-xs font-semibold text-purple-700 hover:text-purple-800 flex items-center gap-1"
              >
                <span>View All</span>
                <ArrowRight size={13} />
              </button>
            </div>

            {/* Competitor Bars */}
            <div className="mt-5 space-y-4">
              {topCompetitors.length === 0 ? (
                <div className="p-8 text-center space-y-2 border rounded-xl border-dashed border-slate-200 bg-slate-50/50">
                  <Bot className="h-6 w-6 text-purple-600 mx-auto" />
                  <p className="text-xs font-bold text-slate-800">No Share of Voice Measurements Yet</p>
                  <p className="text-[11px] text-slate-500">
                    Add competitors and run an AI Visibility sweep to measure brand mentions across LLMs.
                  </p>
                </div>
              ) : (
                topCompetitors.map((comp) => (
                  <div key={comp.domain} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className={`flex items-center gap-1.5 ${comp.isYou ? "text-purple-700 font-bold" : "text-slate-700"}`}>
                        <span>#{comp.rank}</span>
                        <span className="truncate">{comp.domain}</span>
                        {comp.isYou && (
                          <span className="bg-purple-100 text-purple-700 text-[10px] px-1.5 py-0.2 rounded font-bold">
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
            <span>Aggregated across ChatGPT, Claude, and Gemini</span>
            <span className="text-purple-700 font-semibold cursor-pointer" onClick={onViewCompetitorsTab}>
              Deep Dive →
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
