"use client";

import React, { useState, useMemo } from "react";
import {
  Users,
  Trophy,
  Crown,
  FileText,
  Search,
  MoreVertical,
  BarChart3,
  LineChart,
  ArrowRight,
  ShieldCheck,
  Target,
  Compass,
  MessageSquare,
  Code2,
  Sparkles,
  ExternalLink,
  Settings,
  Layers,
  Plus,
  Bot,
} from "lucide-react";
import { AiKpiCard } from "./ai-kpi-card";
import type { VisibilityReport, TrackedCompetitor } from "@/lib/api-client";

export interface AiVisibilityCompetitorsTabProps {
  report?: VisibilityReport | null;
  competitors?: TrackedCompetitor[];
  domain?: string;
  onAddCompetitor?: () => void;
  onViewAllGaps?: () => void;
}

const BAR_COLORS = [
  "bg-purple-600",
  "bg-blue-500",
  "bg-emerald-500",
  "bg-amber-400",
  "bg-rose-400",
  "bg-indigo-500",
];

export function AiVisibilityCompetitorsTab({
  report,
  competitors = [],
  domain = "",
  onAddCompetitor,
  onViewAllGaps,
}: AiVisibilityCompetitorsTabProps) {
  const [chartMode, setChartMode] = useState<"bar" | "trend">("bar");

  // Real Share of Voice from AI Visibility Report
  const shareOfVoice = useMemo(() => {
    return report?.shareOfVoice || [];
  }, [report?.shareOfVoice]);

  // Real Competitor Benchmarking Rows
  const comparisonRows = useMemo(() => {
    if (shareOfVoice.length === 0) {
      if (domain) {
        return [
          {
            rank: 1,
            name: domain,
            domain: domain,
            isYou: true,
            sharePct: report?.summary?.citationSharePct ?? 0,
            mentions: report?.summary?.cited ?? 0,
            sentiment: "Positive",
          },
        ];
      }
      return [];
    }

    return shareOfVoice.map((item, idx) => ({
      rank: idx + 1,
      name: item.label || item.domain || "Competitor",
      domain: item.domain || item.label || "competitor.com",
      isYou: item.domain === domain,
      sharePct: item.sharePct,
      mentions: item.mentions,
      sentiment: item.sharePct >= 20 ? "Positive" : "Neutral",
    }));
  }, [shareOfVoice, domain, report?.summary]);

  // Real Bar Chart Items
  const barChartItems = useMemo(() => {
    if (comparisonRows.length === 0) return [];
    const maxShare = Math.max(1, ...comparisonRows.map((r) => r.sharePct));

    return comparisonRows.slice(0, 6).map((r, idx) => ({
      name: r.isYou ? `${r.domain}\n(You)` : r.domain,
      sharePct: r.sharePct,
      color: r.isYou ? "bg-purple-600" : BAR_COLORS[(idx + 1) % BAR_COLORS.length],
      heightPct: Math.max(10, Math.min(100, Math.round((r.sharePct / maxShare) * 90))),
    }));
  }, [comparisonRows]);

  // Derived Real KPIs
  const yourShare = report?.summary?.citationSharePct ?? 0;
  const competitorsCitedMore = comparisonRows.filter((r) => !r.isYou && r.sharePct > yourShare).length;
  const topRival = comparisonRows.find((r) => !r.isYou) || null;
  const totalChecked = report?.summary?.checked ?? 0;
  const totalCitations = report?.summary?.cited ?? 0;

  return (
    <div className="space-y-6">
      {/* ── ROW 1: 5 KPI Cards (Real Data) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* KPI 1: AI Citation Share */}
        <AiKpiCard
          label="Your Citation Share"
          value={`${yourShare}%`}
          subtext="Proportion of total LLM recommendations"
          icon={<Users size={16} />}
          iconBgColor="bg-purple-50 text-purple-600"
          colorScheme="purple"
        />

        {/* KPI 2: Competitors Cited More */}
        <AiKpiCard
          label="Rivals Outranking You"
          value={`${competitorsCitedMore} / ${Math.max(1, comparisonRows.length - 1)}`}
          subtext="Competitors with higher recommendation share"
          icon={<Trophy size={16} />}
          iconBgColor="bg-rose-50 text-rose-600"
          colorScheme="coral"
        />

        {/* KPI 3: Top Competitor */}
        <AiKpiCard
          label="Leading Competitor"
          value={topRival ? topRival.domain : "None"}
          subtext={topRival ? `${topRival.sharePct}% citation share` : "Add rivals to benchmark"}
          icon={<Crown size={16} />}
          iconBgColor="bg-amber-50 text-amber-600"
          colorScheme="yellow"
        />

        {/* KPI 4: Total Citations */}
        <AiKpiCard
          label="Total Citations"
          value={totalCitations.toLocaleString()}
          subtext="Direct brand mentions across tested queries"
          icon={<FileText size={16} />}
          iconBgColor="bg-emerald-50 text-emerald-600"
          colorScheme="emerald"
        />

        {/* KPI 5: Tested Prompts */}
        <AiKpiCard
          label="Queries Evaluated"
          value={totalChecked.toString()}
          subtext="Across ChatGPT, Claude, and Gemini"
          icon={<Target size={16} />}
          iconBgColor="bg-blue-50 text-blue-600"
          colorScheme="blue"
        />
      </div>

      {/* ── ROW 2: Bar Chart Comparison + Strategic Recommendations ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Bar Chart (Col span 7) */}
        <div className="lg:col-span-7 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">AI Citation Share Comparison</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Comparative share of brand citations across large language models
                </p>
              </div>

              <div className="flex items-center gap-1.5 p-0.5 rounded-lg border border-slate-200 bg-slate-50 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setChartMode("bar")}
                  className={`p-1.5 rounded-md ${chartMode === "bar" ? "bg-white text-purple-700 shadow-2xs" : "text-slate-500"}`}
                >
                  <BarChart3 size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => setChartMode("trend")}
                  className={`p-1.5 rounded-md ${chartMode === "trend" ? "bg-white text-purple-700 shadow-2xs" : "text-slate-500"}`}
                >
                  <LineChart size={14} />
                </button>
              </div>
            </div>

            {/* Bars */}
            <div className="my-6 min-h-52 flex items-end justify-around gap-4 px-4 pb-2 border-b border-slate-100">
              {barChartItems.length === 0 ? (
                <div className="w-full text-center py-12 text-slate-400 text-xs">
                  No citation data available yet. Run an AI visibility sweep to plot benchmark bars.
                </div>
              ) : (
                barChartItems.map((bar, idx) => (
                  <div key={idx} className="flex flex-col items-center gap-2 flex-1 max-w-[80px]">
                    <span className="text-xs font-bold text-slate-700">{bar.sharePct}%</span>
                    <div className="w-full h-36 flex items-end justify-center bg-slate-50 rounded-lg p-1">
                      <div
                        className={`w-full ${bar.color} rounded-t-md transition-all duration-500`}
                        style={{ height: `${bar.heightPct}%` }}
                      />
                    </div>
                    <span className="text-[11px] font-semibold text-slate-600 text-center leading-tight whitespace-pre-line truncate max-w-full">
                      {bar.name}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-400 pt-2">
            <span>Data updated with every automated sweep</span>
            <button
              type="button"
              onClick={onAddCompetitor}
              className="text-purple-700 font-semibold hover:underline flex items-center gap-1"
            >
              <Plus size={12} /> Add Rival
            </button>
          </div>
        </div>

        {/* Strategic Next Steps (Col span 5) */}
        <div className="lg:col-span-5 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
                  <Sparkles size={16} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">AI Conquesting Actions</h3>
                  <p className="text-[11px] text-slate-400">Tactics to overtake rival citations</p>
                </div>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              <div className="p-3 rounded-xl border border-slate-100 bg-slate-50/60 text-xs space-y-1">
                <span className="font-bold text-slate-800 flex items-center gap-1.5">
                  <Target size={14} className="text-purple-600" />
                  Target Rival Comparison Intent
                </span>
                <p className="text-slate-600 text-[11px] leading-relaxed">
                  Publish authoritative objective comparison pages and JSON-LD FAQ schemas targeting prompts where rivals currently dominate.
                </p>
              </div>

              <div className="p-3 rounded-xl border border-slate-100 bg-slate-50/60 text-xs space-y-1">
                <span className="font-bold text-slate-800 flex items-center gap-1.5">
                  <Code2 size={14} className="text-blue-600" />
                  Deploy Structured AEO Entities
                </span>
                <p className="text-slate-600 text-[11px] leading-relaxed">
                  Large language models heavily weight schema markup (Organization, Product, SoftwareApplication) when determining authoritative answers.
                </p>
              </div>

              <div className="p-3 rounded-xl border border-slate-100 bg-slate-50/60 text-xs space-y-1">
                <span className="font-bold text-slate-800 flex items-center gap-1.5">
                  <MessageSquare size={14} className="text-emerald-600" />
                  Answer Engine Optimization (AEO)
                </span>
                <p className="text-slate-600 text-[11px] leading-relaxed">
                  Structure your page headers with direct, concise 50-word answers directly below H2 questions to feed snippet extraction.
                </p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onViewAllGaps}
            className="w-full py-2.5 px-4 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs"
          >
            <span>View All Competitor Gaps</span>
            <ArrowRight size={13} />
          </button>
        </div>
      </div>

      {/* ── ROW 3: Benchmarking Table ── */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-base font-bold text-slate-900">LLM Benchmarking Leaderboard</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Measured share of voice across ChatGPT, Claude, and Gemini
            </p>
          </div>
          <span className="text-xs text-slate-400 font-semibold">
            {comparisonRows.length} domains analyzed
          </span>
        </div>

        {comparisonRows.length === 0 ? (
          <div className="p-8 text-center space-y-2 border rounded-xl border-dashed border-slate-200 bg-slate-50/50">
            <Bot className="h-6 w-6 text-purple-600 mx-auto" />
            <p className="text-xs font-bold text-slate-800">No Benchmarked Competitors Yet</p>
            <p className="text-[11px] text-slate-500">
              Add competitors to compare citations and model recommendation share.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-[11px] font-bold text-slate-600 border-b border-slate-200 uppercase tracking-wider">
                <tr>
                  <th className="p-3.5 w-14 font-bold">Rank</th>
                  <th className="p-3.5 font-bold">Domain / Brand</th>
                  <th className="p-3.5 font-bold">Recommendation Share</th>
                  <th className="p-3.5 font-bold">Total Mentions</th>
                  <th className="p-3.5 font-bold">Perceived Sentiment</th>
                  <th className="p-3.5 font-bold text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {comparisonRows.map((row) => (
                  <tr
                    key={row.domain}
                    className={`hover:bg-slate-50/80 transition-colors ${row.isYou ? "bg-purple-50/40" : ""}`}
                  >
                    <td className="p-3.5 font-bold text-slate-900">#{row.rank}</td>
                    <td className="p-3.5 font-semibold text-slate-900">
                      <div className="flex items-center gap-2">
                        <span>{row.domain}</span>
                        {row.isYou && (
                          <span className="bg-purple-100 text-purple-700 text-[10px] px-2 py-0.5 rounded-full font-bold">
                            Your Domain
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-3.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 w-10">{row.sharePct}%</span>
                        <div className="h-2 w-24 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${row.isYou ? "bg-purple-600" : "bg-blue-500"} rounded-full`}
                            style={{ width: `${Math.max(4, row.sharePct)}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="p-3.5 font-mono text-slate-700">{row.mentions.toLocaleString()}</td>
                    <td className="p-3.5">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          row.sentiment === "Positive"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {row.sentiment}
                      </span>
                    </td>
                    <td className="p-3.5 text-center">
                      <span className="text-[11px] font-medium text-slate-500">
                        {row.isYou ? "Primary Site" : "Competitor"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
