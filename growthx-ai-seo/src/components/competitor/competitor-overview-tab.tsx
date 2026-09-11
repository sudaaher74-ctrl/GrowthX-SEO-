"use client";

import React, { useState } from "react";
import {
  Crosshair,
  TrendingUp,
  Globe,
  Plus,
  Sparkles,
  ChevronDown,
  Calendar,
  Link2,
  Shield,
  Search,
  Radio,
  BarChart3,
  LineChart,
  ArrowRight,
  ExternalLink,
  FileText,
  CheckCircle2,
} from "lucide-react";
import { AiKpiCard } from "@/components/ai-visibility/ai-kpi-card";
import type { TrackedCompetitor } from "@/lib/api-client";

export interface CompetitorOverviewTabProps {
  domain?: string;
  competitors?: TrackedCompetitor[];
  onAddCompetitor?: () => void;
  onGenerateInsights?: () => void;
  onViewAllKeywordGaps?: () => void;
  onViewAllContentGaps?: () => void;
  onGenerateReport?: () => void;
}

export function CompetitorOverviewTab({
  domain = "aivaenterprises.com",
  competitors = [],
  onAddCompetitor,
  onGenerateInsights,
  onViewAllKeywordGaps,
  onViewAllContentGaps,
  onGenerateReport,
}: CompetitorOverviewTabProps) {
  const [metricTab, setMetricTab] = useState<"traffic" | "keywords" | "ai" | "da">("traffic");

  // Active tracked competitors list
  const activeCompetitors = [
    { name: domain, isYou: true, dotColor: "bg-blue-600", active: true },
    { name: "semrush.com", isYou: false, dotColor: "bg-orange-500", active: false },
    { name: "ahrefs.com", isYou: false, dotColor: "bg-purple-600", active: false },
    { name: "moz.com", isYou: false, dotColor: "bg-emerald-500", active: false },
    { name: "similarweb.com", isYou: false, dotColor: "bg-amber-400", active: false },
  ];

  // Keyword gap sample data matching Screenshot 1
  const keywordGaps = [
    { keyword: "seo automation", yourPos: "—", topComp: "semrush.com", compPos: 3, vol: "12,000", opp: "High" },
    { keyword: "website seo audit", yourPos: "—", topComp: "ahrefs.com", compPos: 4, vol: "8,100", opp: "High" },
    { keyword: "backlink analysis", yourPos: "—", topComp: "moz.com", compPos: 2, vol: "6,600", opp: "High" },
    { keyword: "competitor analysis tool", yourPos: "—", topComp: "similarweb.com", compPos: 5, vol: "5,400", opp: "Medium" },
    { keyword: "ai seo tool", yourPos: "—", topComp: "semrush.com", compPos: 4, vol: "4,900", opp: "Medium" },
  ];

  // Content gap sample data matching Screenshot 1
  const contentGaps = [
    { topic: "SEO case studies", topComp: "ahrefs.com", opp: "High" },
    { topic: "Link building strategies", topComp: "moz.com", opp: "High" },
    { topic: "Technical SEO guide", topComp: "semrush.com", opp: "High" },
    { topic: "AI in SEO", topComp: "similarweb.com", opp: "Medium" },
    { topic: "Competitor analysis", topComp: "ahrefs.com", opp: "Medium" },
  ];

  // Top Opportunities list matching Screenshot 1
  const topOpportunities = [
    { id: 1, title: "Target 320 high-value keywords", desc: "Your competitors rank for these, but you don't." },
    { id: 2, title: "Create content for missing topics", desc: "Cover topics like SEO case studies and AI in SEO." },
    { id: 3, title: "Improve AI visibility", desc: "Optimize content to appear in ChatGPT, Claude, and Gemini." },
    { id: 4, title: "Build high-quality backlinks", desc: "Competitors have 2–5x more referring domains." },
    { id: 5, title: "Strengthen technical SEO", desc: "Fix critical issues to match top competitors." },
  ];

  return (
    <div className="space-y-6">
      {/* ── ACTIVE COMPETITORS CHIP STRIP ── */}
      <div className="flex flex-wrap items-center gap-2.5">
        {activeCompetitors.map((comp) => (
          <div
            key={comp.name}
            className={`flex items-center gap-2 rounded-xl px-3 py-2 text-[12px] border transition-all ${
              comp.isYou
                ? "bg-blue-50/70 border-blue-200 text-blue-950 font-bold shadow-2xs"
                : "bg-white border-slate-200/80 text-slate-700 font-medium hover:bg-slate-50 shadow-2xs"
            }`}
          >
            <span className={`h-2.5 w-2.5 rounded-full ${comp.dotColor} shrink-0`} />
            <span className="truncate">
              {comp.isYou ? `Your Website (${comp.name})` : comp.name}
            </span>
          </div>
        ))}

        <button
          type="button"
          onClick={onAddCompetitor}
          className="flex items-center gap-1.5 rounded-xl border border-dashed border-slate-300 bg-white/70 px-3 py-2 text-[12px] font-semibold text-slate-600 hover:border-purple-300 hover:text-purple-700 hover:bg-purple-50/40 transition-colors shadow-2xs"
        >
          <Plus size={13} className="text-purple-600" />
          <span>Add Competitor</span>
        </button>
      </div>

      {/* ── 5 KPI METRIC WAVE CARDS ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <AiKpiCard
          label="Organic Traffic"
          value="12.4K"
          trend="28%"
          trendPositive={true}
          subtext="vs. last 30 days"
          icon={<TrendingUp size={16} />}
          iconBgColor="bg-blue-50 text-blue-600"
          colorScheme="blue"
        />

        <AiKpiCard
          label="Ranking Keywords"
          value="3.2K"
          trend="18%"
          trendPositive={true}
          subtext="vs. last 30 days"
          icon={<Search size={16} />}
          iconBgColor="bg-purple-50 text-purple-600"
          colorScheme="purple"
        />

        <AiKpiCard
          label="AI Visibility Score"
          value="61"
          trend="32%"
          trendPositive={true}
          subtext="vs. last 30 days"
          icon={<Sparkles size={16} />}
          iconBgColor="bg-emerald-50 text-emerald-600"
          colorScheme="emerald"
        />

        <AiKpiCard
          label="Referring Domains"
          value="420"
          trend="12%"
          trendPositive={true}
          subtext="vs. last 30 days"
          icon={<Link2 size={16} />}
          iconBgColor="bg-orange-50 text-orange-600"
          colorScheme="orange"
        />

        <AiKpiCard
          label="Domain Authority"
          value="38"
          trend="6%"
          trendPositive={true}
          subtext="vs. last 30 days"
          icon={<Shield size={16} />}
          iconBgColor="bg-rose-50 text-rose-600"
          colorScheme="coral"
        />
      </div>

      {/* ── MIDDLE ROW: Visibility Comparison (60%) + AI Visibility Across Platforms (40%) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Visibility Comparison Multi-line Chart (Col span 7) */}
        <div className="lg:col-span-7 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <h3 className="text-[14.5px] font-bold text-slate-900">Visibility Comparison</h3>

              <div className="flex items-center gap-2">
                {/* Metric switcher tabs */}
                <div className="flex items-center rounded-lg border border-slate-200 p-0.5 bg-slate-50 text-[11px] font-semibold">
                  <button
                    type="button"
                    onClick={() => setMetricTab("traffic")}
                    className={`rounded-md px-2 py-1 transition-colors ${
                      metricTab === "traffic" ? "bg-purple-600 text-white shadow-2xs" : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Organic Traffic
                  </button>
                  <button
                    type="button"
                    onClick={() => setMetricTab("keywords")}
                    className={`rounded-md px-2 py-1 transition-colors ${
                      metricTab === "keywords" ? "bg-purple-600 text-white shadow-2xs" : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Ranking Keywords
                  </button>
                  <button
                    type="button"
                    onClick={() => setMetricTab("ai")}
                    className={`rounded-md px-2 py-1 transition-colors ${
                      metricTab === "ai" ? "bg-purple-600 text-white shadow-2xs" : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    AI Visibility
                  </button>
                  <button
                    type="button"
                    onClick={() => setMetricTab("da")}
                    className={`rounded-md px-2 py-1 transition-colors ${
                      metricTab === "da" ? "bg-purple-600 text-white shadow-2xs" : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Domain Authority
                  </button>
                </div>

                <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700">
                  <span>Last 30 days</span>
                  <ChevronDown size={11} className="text-slate-400" />
                </div>
              </div>
            </div>

            {/* SVG Multi-Line Chart Graphic */}
            <div className="mt-4 relative h-48 w-full pl-8 pr-3 pb-6">
              {/* Y Axis Grid Lines */}
              <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-6 text-[10px] text-slate-400">
                <div className="flex items-center w-full">
                  <span className="w-6 text-right pr-2">40K</span>
                  <div className="flex-1 border-b border-dashed border-slate-100" />
                </div>
                <div className="flex items-center w-full">
                  <span className="w-6 text-right pr-2">30K</span>
                  <div className="flex-1 border-b border-dashed border-slate-100" />
                </div>
                <div className="flex items-center w-full">
                  <span className="w-6 text-right pr-2">20K</span>
                  <div className="flex-1 border-b border-dashed border-slate-100" />
                </div>
                <div className="flex items-center w-full">
                  <span className="w-6 text-right pr-2">10K</span>
                  <div className="flex-1 border-b border-dashed border-slate-100" />
                </div>
                <div className="flex items-center w-full">
                  <span className="w-6 text-right pr-2">0</span>
                  <div className="flex-1 border-b border-slate-200" />
                </div>
              </div>

              {/* Multi-curves SVG */}
              <svg viewBox="0 0 500 150" className="h-full w-full overflow-visible">
                {/* semrush.com (orange) */}
                <path
                  d="M0,105 C80,95 160,80 240,70 C320,60 400,65 500,55"
                  fill="none"
                  stroke="#f97316"
                  strokeWidth="2.5"
                />
                {/* ahrefs.com (purple) */}
                <path
                  d="M0,90 C80,85 160,65 240,55 C320,40 400,45 500,35"
                  fill="none"
                  stroke="#8b5cf6"
                  strokeWidth="2.5"
                />
                {/* moz.com (emerald) */}
                <path
                  d="M0,110 C80,100 160,95 240,85 C320,70 400,75 500,65"
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="2.5"
                />
                {/* Your website (blue) */}
                <path
                  d="M0,120 C80,115 160,105 240,95 C320,85 400,80 500,70"
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth="3"
                />
                {/* similarweb.com (yellow) */}
                <path
                  d="M0,130 C80,125 160,120 240,115 C320,105 400,100 500,90"
                  fill="none"
                  stroke="#eab308"
                  strokeWidth="2.5"
                />
              </svg>

              {/* X Axis Dates */}
              <div className="flex justify-between pt-2 text-[10px] text-slate-400">
                <span>Aug 10</span>
                <span>Aug 15</span>
                <span>Aug 20</span>
                <span>Aug 25</span>
                <span>Aug 30</span>
                <span>Sep 5</span>
                <span>Sep 10</span>
              </div>
            </div>
          </div>

          {/* Legend dots */}
          <div className="mt-2 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-center gap-4 text-[11px]">
            <div className="flex items-center gap-1.5 font-bold text-slate-900">
              <span className="h-2 w-2 rounded-full bg-blue-600" />
              <span>{domain}</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-600">
              <span className="h-2 w-2 rounded-full bg-orange-500" />
              <span>semrush.com</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-600">
              <span className="h-2 w-2 rounded-full bg-purple-600" />
              <span>ahrefs.com</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-600">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span>moz.com</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-600">
              <span className="h-2 w-2 rounded-full bg-amber-400" />
              <span>similarweb.com</span>
            </div>
          </div>
        </div>

        {/* Right: AI Visibility Across Platforms (Col span 5) */}
        <div className="lg:col-span-5 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-1.5">
                <h3 className="text-[14px] font-bold text-slate-900">AI Visibility Across Platforms</h3>
                <span className="text-slate-300">ⓘ</span>
              </div>
              <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700">
                <span>All Platforms</span>
                <ChevronDown size={11} className="text-slate-400" />
              </div>
            </div>

            {/* Model chips legend */}
            <div className="mt-3 flex items-center gap-3 text-[11px] font-semibold">
              <span className="inline-flex items-center gap-1 text-emerald-700">
                <span className="h-2 w-2 rounded-full bg-emerald-500" /> ChatGPT
              </span>
              <span className="inline-flex items-center gap-1 text-orange-700">
                <span className="h-2 w-2 rounded-full bg-orange-500" /> Claude
              </span>
              <span className="inline-flex items-center gap-1 text-blue-700">
                <span className="h-2 w-2 rounded-full bg-blue-500" /> Gemini
              </span>
            </div>

            {/* Grouped Bar Chart */}
            <div className="mt-4 relative h-44 flex items-end justify-between pl-6 pr-2 pb-6">
              {/* Y Axis */}
              <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-6 text-[9.5px] text-slate-400">
                <span className="w-5 text-right">100</span>
                <span className="w-5 text-right">80</span>
                <span className="w-5 text-right">60</span>
                <span className="w-5 text-right">40</span>
                <span className="w-5 text-right">20</span>
                <span className="w-5 text-right">0</span>
              </div>

              {/* Groups */}
              {[
                { name: domain, vals: [60, 68, 68] },
                { name: "semrush.com", vals: [78, 80, 70] },
                { name: "ahrefs.com", vals: [65, 68, 68] },
                { name: "moz.com", vals: [48, 55, 52] },
                { name: "similarweb.com", vals: [48, 60, 56] },
              ].map((group) => (
                <div key={group.name} className="relative z-10 flex flex-col items-center gap-1 w-14">
                  <div className="flex items-end gap-0.5 h-32">
                    <div className="w-2.5 rounded-t bg-emerald-500" style={{ height: `${group.vals[0]}%` }} />
                    <div className="w-2.5 rounded-t bg-orange-500" style={{ height: `${group.vals[1]}%` }} />
                    <div className="w-2.5 rounded-t bg-blue-500" style={{ height: `${group.vals[2]}%` }} />
                  </div>
                  <span className="text-[9px] font-semibold text-slate-600 truncate max-w-[56px] text-center">
                    {group.name}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <p className="text-center text-[10.5px] text-slate-400 pt-1">
            Comparative brand citation share across large language models
          </p>
        </div>
      </div>

      {/* ── BOTTOM ROW: Keyword Gap (33%) + Content Gap (33%) + Top Opportunities (33%) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Card 1: Keyword Gap */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 pb-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-purple-50 text-purple-600">
                <Search size={14} />
              </div>
              <div>
                <h4 className="text-[13.5px] font-bold text-slate-900 leading-none">
                  Keyword Gap
                </h4>
                <p className="mt-1 text-[11px] text-slate-500">
                  Keywords your competitors rank for, but you don&apos;t.
                </p>
              </div>
            </div>

            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-[11.5px]">
                <thead>
                  <tr className="border-b border-slate-100 text-[10px] font-medium text-slate-400">
                    <th className="py-2 pl-1 font-medium">Keyword</th>
                    <th className="py-2 font-medium">Your Pos</th>
                    <th className="py-2 font-medium">Top Comp</th>
                    <th className="py-2 font-medium">Comp Pos</th>
                    <th className="py-2 font-medium">Search Vol</th>
                    <th className="py-2 pr-1 text-right font-medium">Opp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {keywordGaps.map((k) => (
                    <tr key={k.keyword} className="hover:bg-slate-50/70">
                      <td className="py-2 pl-1 font-medium text-slate-800 max-w-[100px] truncate">{k.keyword}</td>
                      <td className="py-2 text-slate-400">{k.yourPos}</td>
                      <td className="py-2 text-slate-600 truncate max-w-[80px]">{k.topComp}</td>
                      <td className="py-2 font-semibold text-slate-800">{k.compPos}</td>
                      <td className="py-2 font-mono text-slate-600">{k.vol}</td>
                      <td className="py-2 pr-1 text-right">
                        <span className={`inline-block rounded-md px-1.5 py-0.5 text-[9.5px] font-bold border ${
                          k.opp === "High" ? "bg-rose-50 text-rose-700 border-rose-200" : "bg-amber-50 text-amber-700 border-amber-200"
                        }`}>
                          {k.opp}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <button
            type="button"
            onClick={onViewAllKeywordGaps}
            className="mt-4 flex w-full items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white py-2 text-[11.5px] font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
          >
            <span>View All Keyword Gaps</span>
            <ArrowRight size={12} />
          </button>
        </div>

        {/* Card 2: Content Gap */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 pb-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-purple-50 text-purple-600">
                <FileText size={14} />
              </div>
              <div>
                <h4 className="text-[13.5px] font-bold text-slate-900 leading-none">
                  Content Gap
                </h4>
                <p className="mt-1 text-[11px] text-slate-500">
                  Topics your competitors cover, but you don&apos;t.
                </p>
              </div>
            </div>

            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-[11.5px]">
                <thead>
                  <tr className="border-b border-slate-100 text-[10px] font-medium text-slate-400">
                    <th className="py-2 pl-1 font-medium">Topic</th>
                    <th className="py-2 font-medium">Top Competitor</th>
                    <th className="py-2 pr-1 text-right font-medium">Opportunity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {contentGaps.map((c) => (
                    <tr key={c.topic} className="hover:bg-slate-50/70">
                      <td className="py-2.5 pl-1 font-medium text-slate-800">{c.topic}</td>
                      <td className="py-2.5 text-slate-600">{c.topComp}</td>
                      <td className="py-2.5 pr-1 text-right">
                        <span className={`inline-block rounded-md px-1.5 py-0.5 text-[9.5px] font-bold border ${
                          c.opp === "High" ? "bg-rose-50 text-rose-700 border-rose-200" : "bg-amber-50 text-amber-700 border-amber-200"
                        }`}>
                          {c.opp}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <button
            type="button"
            onClick={onViewAllContentGaps}
            className="mt-4 flex w-full items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white py-2 text-[11.5px] font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
          >
            <span>View All Content Gaps</span>
            <ArrowRight size={12} />
          </button>
        </div>

        {/* Card 3: Top Opportunities */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 pb-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-purple-50 text-purple-600">
                <Sparkles size={14} />
              </div>
              <div>
                <h4 className="text-[13.5px] font-bold text-slate-900 leading-none">
                  Top Opportunities
                </h4>
                <p className="mt-1 text-[11px] text-slate-500">
                  AI recommendations based on competitor analysis.
                </p>
              </div>
            </div>

            <div className="mt-3 space-y-2.5">
              {topOpportunities.map((opp) => (
                <div
                  key={opp.id}
                  className="flex items-start justify-between gap-2 rounded-xl p-2 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <div className="flex items-start gap-2.5">
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-purple-600 text-white text-[10px] font-bold mt-0.5">
                      {opp.id}
                    </div>
                    <div>
                      <h5 className="text-[12px] font-bold text-slate-900 leading-tight">
                        {opp.title}
                      </h5>
                      <p className="text-[10.5px] text-slate-500 leading-snug">
                        {opp.desc}
                      </p>
                    </div>
                  </div>
                  <ArrowRight size={13} className="text-slate-400 mt-1 shrink-0" />
                </div>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={onGenerateReport}
            className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-xl bg-purple-600 py-2.5 text-[12px] font-bold text-white hover:bg-purple-700 transition-colors shadow-xs"
          >
            <FileText size={13} />
            <span>Generate Full Strategy Report</span>
          </button>
        </div>
      </div>
    </div>
  );
}
