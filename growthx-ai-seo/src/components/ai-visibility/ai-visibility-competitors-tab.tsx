"use client";

import React, { useState } from "react";
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

export function AiVisibilityCompetitorsTab({
  report,
  competitors = [],
  domain = "aivaenterprises.com",
  onAddCompetitor,
  onViewAllGaps,
}: AiVisibilityCompetitorsTabProps) {
  const [chartMode, setChartMode] = useState<"bar" | "trend">("bar");

  // Competitor benchmarking rows
  const comparisonRows = [
    {
      rank: 1,
      name: "aivaenterprises.com",
      domain: domain,
      isYou: true,
      sharePct: 24,
      mentions: 342,
      sentiment: "Positive",
      trendColor: "#10b981",
      trendPoints: "M0,18 Q20,10 40,16 T80,8 T120,4",
    },
    {
      rank: 2,
      name: "semrush.com",
      domain: "semrush.com",
      isYou: false,
      sharePct: 30,
      mentions: 428,
      sentiment: "Positive",
      trendColor: "#3b82f6",
      trendPoints: "M0,16 Q20,20 40,14 T80,10 T120,6",
    },
    {
      rank: 3,
      name: "ahrefs.com",
      domain: "ahrefs.com",
      isYou: false,
      sharePct: 21,
      mentions: 298,
      sentiment: "Positive",
      trendColor: "#0284c7",
      trendPoints: "M0,12 Q20,16 40,12 T80,14 T120,10",
    },
    {
      rank: 4,
      name: "moz.com",
      domain: "moz.com",
      isYou: false,
      sharePct: 11,
      mentions: 156,
      sentiment: "Neutral",
      trendColor: "#f59e0b",
      trendPoints: "M0,20 Q20,18 40,22 T80,16 T120,12",
    },
    {
      rank: 5,
      name: "screamingfrog.co.uk",
      domain: "screamingfrog.co.uk",
      isYou: false,
      sharePct: 7,
      mentions: 98,
      sentiment: "Neutral",
      trendColor: "#f97316",
      trendPoints: "M0,22 Q20,24 40,18 T80,20 T120,18",
    },
  ];

  // Bar chart items
  const barChartItems = [
    { name: "Aiva\n(You)", sharePct: 24, color: "bg-purple-600", heightPct: 60 },
    { name: "Semrush", sharePct: 30, color: "bg-blue-500", heightPct: 75 },
    { name: "Ahrefs", sharePct: 21, color: "bg-emerald-500", heightPct: 52.5 },
    { name: "Moz", sharePct: 11, color: "bg-amber-400", heightPct: 27.5 },
    { name: "Screaming Frog", sharePct: 7, color: "bg-rose-400", heightPct: 17.5 },
  ];

  // Gaps where competitors are winning
  const winningGaps = [
    { rank: 1, keyword: "technical seo audit tool", topCompetitor: "semrush.com", citations: 42, oppLevel: "High", oppColor: "bg-rose-50 text-rose-700 border-rose-200" },
    { rank: 2, keyword: "backlink analysis", topCompetitor: "ahrefs.com", citations: 36, oppLevel: "High", oppColor: "bg-rose-50 text-rose-700 border-rose-200" },
    { rank: 3, keyword: "website crawler", topCompetitor: "screamingfrog.co.uk", citations: 28, oppLevel: "Medium", oppColor: "bg-amber-50 text-amber-700 border-amber-200" },
    { rank: 4, keyword: "seo reporting platform", topCompetitor: "moz.com", citations: 24, oppLevel: "Medium", oppColor: "bg-amber-50 text-amber-700 border-amber-200" },
    { rank: 5, keyword: "site migration checklist", topCompetitor: "semrush.com", citations: 19, oppLevel: "Low", oppColor: "bg-blue-50 text-blue-700 border-blue-200" },
  ];

  // Competitor strengths items
  const competitorStrengths = [
    {
      name: "Semrush",
      avatarLetter: "S",
      avatarBg: "bg-orange-50 text-orange-600 border-orange-200",
      description: "Strong brand authority, frequently cited for SEO tools and guides.",
    },
    {
      name: "Ahrefs",
      avatarLetter: "A",
      avatarBg: "bg-blue-50 text-blue-600 border-blue-200",
      description: "High mentions in technical SEO and backlink analysis.",
    },
    {
      name: "Moz",
      avatarLetter: "M",
      avatarBg: "bg-sky-50 text-sky-600 border-sky-200",
      description: "Recognized for educational content and beginner guides.",
    },
    {
      name: "Screaming Frog",
      avatarLetter: "S",
      avatarBg: "bg-emerald-50 text-emerald-600 border-emerald-200",
      description: "Often cited for website crawling and technical audits.",
    },
  ];

  // Your opportunities list
  const yourOpportunities = [
    {
      icon: <Target size={15} className="text-purple-600" />,
      iconBg: "bg-purple-50",
      title: "Create content around competitor keywords",
      desc: "Target 128 high-opportunity topics.",
    },
    {
      icon: <Compass size={15} className="text-blue-600" />,
      iconBg: "bg-blue-50",
      title: "Build authority in technical SEO",
      desc: "Strengthen content depth with data and examples.",
    },
    {
      icon: <MessageSquare size={15} className="text-emerald-600" />,
      iconBg: "bg-emerald-50",
      title: "Get cited in comparison queries",
      desc: "Create vs. competitor pages and use cases.",
    },
    {
      icon: <Code2 size={15} className="text-sky-600" />,
      iconBg: "bg-sky-50",
      title: "Improve schema and structured data",
      desc: "Help AI models better understand your content.",
    },
    {
      icon: <Sparkles size={15} className="text-purple-600" />,
      iconBg: "bg-purple-50",
      title: "Showcase unique value proposition",
      desc: "Highlight what makes your brand different.",
    },
  ];

  return (
    <div className="space-y-6">
      {/* ── ROW 1: 5 KPI Cards with Sparklines ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* KPI 1: AI Citation Share */}
        <AiKpiCard
          label="AI Citation Share"
          value="24%"
          trend="+8%"
          trendPositive={true}
          subtext="vs. 12% last month"
          icon={<Users size={16} />}
          iconBgColor="bg-purple-50 text-purple-600"
          colorScheme="purple"
        />

        {/* KPI 2: Competitors Cited More */}
        <AiKpiCard
          label="Competitors Cited More"
          value="4 / 5"
          subtext="Competitors are mentioned more often than your brand"
          icon={<Trophy size={16} />}
          iconBgColor="bg-rose-50 text-rose-600"
          colorScheme="coral"
        />

        {/* KPI 3: Top Competitor */}
        <AiKpiCard
          label="Top Competitor"
          value="semrush.com"
          subtext="30% citation share"
          icon={<Crown size={16} />}
          iconBgColor="bg-amber-50 text-amber-600"
          colorScheme="yellow"
        />

        {/* KPI 4: Content Gap Opportunities */}
        <AiKpiCard
          label="Content Gap Opportunities"
          value="128"
          trend="+22%"
          trendPositive={true}
          subtext="Topics where competitors rank in AI responses but you don't"
          icon={<FileText size={16} />}
          iconBgColor="bg-emerald-50 text-emerald-600"
          colorScheme="emerald"
        />

        {/* KPI 5: Keyword Gap */}
        <AiKpiCard
          label="Keyword Gap"
          value="342"
          trend="+17%"
          trendPositive={true}
          subtext="High-value keywords your competitors are cited for"
          icon={<Search size={16} />}
          iconBgColor="bg-blue-50 text-blue-600"
          colorScheme="blue"
        />
      </div>

      {/* ── ROW 2: Competitor Comparison Table (60%) + Citation Share Bar Chart (40%) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Competitor Comparison Table */}
        <div className="lg:col-span-7 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-100 text-slate-700">
                <Settings size={14} />
              </div>
              <div>
                <h3 className="text-[14.5px] font-bold text-slate-900 leading-none">
                  Competitor Comparison
                </h3>
                <p className="mt-1 text-[11.5px] text-slate-500">
                  Compare how your brand and competitors appear in AI responses.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onAddCompetitor}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11.5px] font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Edit Competitors
            </button>
          </div>

          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-[12px]">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] font-medium text-slate-400">
                  <th className="py-2.5 pl-2 font-medium">#</th>
                  <th className="py-2.5 font-medium">Brand / Domain</th>
                  <th className="py-2.5 font-medium">AI Citation Share</th>
                  <th className="py-2.5 font-medium">Mentions (28d)</th>
                  <th className="py-2.5 font-medium">Sentiment</th>
                  <th className="py-2.5 font-medium">Visibility Trend</th>
                  <th className="py-2.5 pr-2 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/70">
                {comparisonRows.map((row) => (
                  <tr
                    key={row.domain}
                    className={`hover:bg-slate-50/70 transition-colors ${
                      row.isYou ? "bg-slate-50/40" : ""
                    }`}
                  >
                    <td className="py-3 pl-2 font-bold text-slate-400">{row.rank}</td>
                    <td className="py-3 font-semibold text-slate-900">
                      <div className="flex items-center gap-2">
                        <div
                          className={`flex h-6 w-6 items-center justify-center rounded-md text-[10px] font-bold ${
                            row.isYou
                              ? "bg-slate-900 text-white"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {row.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="truncate max-w-[140px]">{row.domain}</span>
                        {row.isYou && (
                          <span className="rounded-md bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700 border border-indigo-200/50">
                            You
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 font-bold text-slate-800">{row.sharePct}%</td>
                    <td className="py-3 font-medium text-slate-600">{row.mentions}</td>
                    <td className="py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-semibold border ${
                          row.sentiment === "Positive"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200/60"
                            : "bg-amber-50 text-amber-700 border-amber-200/60"
                        }`}
                      >
                        {row.sentiment}
                      </span>
                    </td>
                    <td className="py-3">
                      {/* Mini sparkline SVG */}
                      <svg width="60" height="24" className="overflow-visible">
                        <path
                          d={row.trendPoints}
                          fill="none"
                          stroke={row.trendColor}
                          strokeWidth="2"
                          strokeLinecap="round"
                        />
                      </svg>
                    </td>
                    <td className="py-3 pr-2 text-right text-slate-400 hover:text-slate-600 cursor-pointer">
                      <MoreVertical size={14} className="inline-block" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: AI Citation Share (Comparison) Bar Chart */}
        <div className="lg:col-span-5 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <BarChart3 size={16} className="text-indigo-600" />
                <h3 className="text-[14px] font-bold text-slate-900">
                  AI Citation Share (Comparison)
                </h3>
              </div>
              <div className="flex items-center rounded-lg border border-slate-200 p-0.5 bg-slate-50">
                <button
                  type="button"
                  onClick={() => setChartMode("bar")}
                  className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold transition-colors ${
                    chartMode === "bar"
                      ? "bg-purple-600 text-white shadow-2xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Bar Chart
                </button>
                <button
                  type="button"
                  onClick={() => setChartMode("trend")}
                  className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold transition-colors ${
                    chartMode === "trend"
                      ? "bg-purple-600 text-white shadow-2xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Trend
                </button>
              </div>
            </div>

            {/* Vertical Bar Chart Graphic */}
            <div className="mt-5 relative h-48 flex items-end justify-between pl-8 pr-3 pb-6">
              {/* Y Axis Grid Lines */}
              <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-6 text-[10px] text-slate-400">
                <div className="flex items-center w-full">
                  <span className="w-6 text-right pr-2">40%</span>
                  <div className="flex-1 border-b border-dashed border-slate-100" />
                </div>
                <div className="flex items-center w-full">
                  <span className="w-6 text-right pr-2">30%</span>
                  <div className="flex-1 border-b border-dashed border-slate-100" />
                </div>
                <div className="flex items-center w-full">
                  <span className="w-6 text-right pr-2">20%</span>
                  <div className="flex-1 border-b border-dashed border-slate-100" />
                </div>
                <div className="flex items-center w-full">
                  <span className="w-6 text-right pr-2">10%</span>
                  <div className="flex-1 border-b border-dashed border-slate-100" />
                </div>
                <div className="flex items-center w-full">
                  <span className="w-6 text-right pr-2">0%</span>
                  <div className="flex-1 border-b border-slate-200" />
                </div>
              </div>

              {/* Bars */}
              {barChartItems.map((bar) => (
                <div key={bar.name} className="relative z-10 flex flex-col items-center gap-1.5 w-14">
                  <span className="text-[11px] font-bold text-slate-900 leading-none">
                    {bar.sharePct}%
                  </span>
                  <div className="w-8 rounded-t-lg overflow-hidden bg-slate-100 h-36 flex items-end">
                    <div
                      className={`w-full rounded-t-md ${bar.color} transition-all duration-700`}
                      style={{ height: `${(bar.sharePct / 40) * 100}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-semibold text-slate-600 text-center whitespace-pre-line leading-tight">
                    {bar.name}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <p className="mt-2 text-center text-[11px] text-slate-400">
            Share of AI mentions across top 5 industry search prompts
          </p>
        </div>
      </div>

      {/* ── ROW 3: Bottom 3 Columns ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Col 1: Where Competitors Are Winning */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-md bg-purple-50 text-purple-600">
                  <Layers size={14} />
                </div>
                <div>
                  <h4 className="text-[13.5px] font-bold text-slate-900 leading-none">
                    Where Competitors Are Winning
                  </h4>
                  <p className="mt-1 text-[11px] text-slate-500">
                    Topics &amp; keywords where competitors are cited.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onViewAllGaps}
                className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-700 inline-flex items-center gap-0.5"
              >
                <span>View All Gaps</span>
                <ArrowRight size={11} />
              </button>
            </div>

            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-[11.5px]">
                <thead>
                  <tr className="border-b border-slate-100 text-[10.5px] font-medium text-slate-400">
                    <th className="py-2 pl-1">#</th>
                    <th className="py-2">Topic / Keyword</th>
                    <th className="py-2">Top Competitor</th>
                    <th className="py-2">Citations</th>
                    <th className="py-2 pr-1 text-right">Opportunity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {winningGaps.map((item) => (
                    <tr key={item.keyword} className="hover:bg-slate-50/70">
                      <td className="py-2.5 pl-1 text-slate-400 font-bold">{item.rank}</td>
                      <td className="py-2.5 font-medium text-slate-800 max-w-[110px] truncate">
                        {item.keyword}
                      </td>
                      <td className="py-2.5 text-slate-600 truncate max-w-[90px]">
                        {item.topCompetitor}
                      </td>
                      <td className="py-2.5 font-semibold text-slate-900">{item.citations}</td>
                      <td className="py-2.5 pr-1 text-right">
                        <span className={`inline-block rounded-md px-1.5 py-0.5 text-[10px] font-semibold border ${item.oppColor}`}>
                          {item.oppLevel}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Col 2: Competitor Strengths */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-purple-50 text-purple-600">
                <Sparkles size={14} />
              </div>
              <div>
                <h4 className="text-[13.5px] font-bold text-slate-900 leading-none">
                  Competitor Strengths
                </h4>
                <p className="mt-1 text-[11px] text-slate-500">
                  What your competitors are doing well in AI responses.
                </p>
              </div>
            </div>

            <div className="mt-3.5 space-y-3">
              {competitorStrengths.map((item) => (
                <div key={item.name} className="flex items-start gap-2.5">
                  <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border text-[11px] font-bold ${item.avatarBg}`}>
                    {item.avatarLetter}
                  </div>
                  <div>
                    <h5 className="text-[12px] font-bold text-slate-900 leading-tight">
                      {item.name}
                    </h5>
                    <p className="mt-0.5 text-[11px] text-slate-500 leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Col 3: Your Opportunities */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-50 text-blue-600">
                <ShieldCheck size={14} />
              </div>
              <div>
                <h4 className="text-[13.5px] font-bold text-slate-900 leading-none">
                  Your Opportunities
                </h4>
                <p className="mt-1 text-[11px] text-slate-500">
                  Key areas to improve and gain more AI visibility.
                </p>
              </div>
            </div>

            <div className="mt-3 space-y-2.5">
              {yourOpportunities.map((opp, idx) => (
                <div key={idx} className="flex items-start gap-2.5">
                  <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${opp.iconBg} mt-0.5`}>
                    {opp.icon}
                  </div>
                  <div>
                    <h5 className="text-[11.5px] font-bold text-slate-900 leading-tight">
                      {opp.title}
                    </h5>
                    <p className="text-[10.5px] text-slate-500 leading-normal">
                      {opp.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
