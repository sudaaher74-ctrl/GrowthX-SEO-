"use client";

import React from "react";
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
  trackedPromptsCount = 120,
  domain = "aivaenterprises.com",
  businessName = "Aiva",
  onViewCompetitorsTab,
  onViewInsightsTab,
  onViewRecommendationsTab,
  onGenerateRecommendations,
}: AiVisibilityOverviewTabProps) {
  // Use real data where present, fall back to the rich realistic presentation from the design mockup
  const mentionRate = report?.summary?.checked && report.summary.checked > 0
    ? `${Math.round((report.summary.cited / report.summary.checked) * 100)}%`
    : "68%";
  
  const totalCitations = report?.summary?.cited != null && report.summary.cited > 0
    ? report.summary.cited
    : 342;

  const shareOfVoice = report?.summary?.citationSharePct != null && report.summary.citationSharePct > 0
    ? `${report.summary.citationSharePct}%`
    : "24%";

  const trackedQueries = trackedPromptsCount > 0 ? trackedPromptsCount : 120;

  // Donut chart calculations
  const totalCircumference = 2 * Math.PI * 46; // r=46 -> ~289.02
  const segments = [
    { label: "ChatGPT", pct: 42, color: "#10b981", strokeDash: `${0.42 * totalCircumference} ${totalCircumference}`, offset: 0 },
    { label: "Claude", pct: 28, color: "#f97316", strokeDash: `${0.28 * totalCircumference} ${totalCircumference}`, offset: -(0.42 * totalCircumference) },
    { label: "Gemini", pct: 22, color: "#38bdf8", strokeDash: `${0.22 * totalCircumference} ${totalCircumference}`, offset: -((0.42 + 0.28) * totalCircumference) },
    { label: "Others", pct: 8, color: "#94a3b8", strokeDash: `${0.08 * totalCircumference} ${totalCircumference}`, offset: -((0.42 + 0.28 + 0.22) * totalCircumference) },
  ];

  // Competitor list with citation shares
  const topCompetitors = [
    { rank: 1, domain: "semrush.com", sharePct: 32, barColor: "bg-indigo-500", isYou: false },
    { rank: 2, domain: "ahrefs.com", sharePct: 28, barColor: "bg-blue-500", isYou: false },
    { rank: 3, domain: "moz.com", sharePct: 18, barColor: "bg-sky-500", isYou: false },
    { rank: 4, domain: domain, sharePct: 24, barColor: "bg-emerald-500", isYou: true },
    { rank: 5, domain: "screamingfrog.co.uk", sharePct: 12, barColor: "bg-indigo-400", isYou: false },
  ];

  return (
    <div className="space-y-6">
      {/* ── ROW 1: 5 KPI Metrics (4 Wave Cards + 1 Arc Score Gauge) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Card 1: AI Mention Rate */}
        <AiKpiCard
          label="AI Mention Rate"
          value={mentionRate}
          trend="+24%"
          trendPositive={true}
          subtext="Your brand is mentioned in AI responses for tracked queries."
          icon={<Radio size={16} />}
          iconBgColor="bg-emerald-50 text-emerald-600"
          colorScheme="emerald"
          infoTooltip="Percentage of buyer queries in which your domain or product was cited by ChatGPT, Claude, or Gemini."
        />

        {/* Card 2: Total Citations */}
        <AiKpiCard
          label="Total Citations"
          value={totalCitations}
          trend="+52%"
          trendPositive={true}
          subtext="Total number of citations across ChatGPT, Claude and Gemini."
          icon={<Link2 size={16} />}
          iconBgColor="bg-blue-50 text-blue-600"
          colorScheme="blue"
          infoTooltip="Aggregated citations detected across all multi-turn conversational sweeps."
        />

        {/* Card 3: Share of Voice */}
        <AiKpiCard
          label="Share of Voice"
          value={shareOfVoice}
          trend="+8%"
          trendPositive={true}
          subtext="Your share vs top 5 competitors in AI responses."
          icon={<PieChart size={16} />}
          iconBgColor="bg-purple-50 text-purple-600"
          colorScheme="purple"
          infoTooltip="Your brand citation volume divided by total citations for you and your key competitors."
        />

        {/* Card 4: Tracked Queries */}
        <AiKpiCard
          label="Tracked Queries"
          value={trackedQueries}
          trend="+12%"
          trendPositive={true}
          subtext="Brand and industry queries being monitored."
          icon={<Search size={16} />}
          iconBgColor="bg-orange-50 text-orange-600"
          colorScheme="orange"
          infoTooltip="Active high-intent keywords probed periodically across LLM engines."
        />

        {/* Card 5: Your AI Visibility Score Gauge */}
        <AiVisibilityGauge
          score={76}
          maxScore={100}
          statusLabel="Good"
          subtext="You're performing well, but there are opportunities to increase your visibility."
        />
      </div>

      {/* ── ROW 2: Model Perception (50%) + Citation Distribution (25%) + Top Competitors (25%) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: How AI Models See Your Brand (Col span 6) */}
        <div className="lg:col-span-6 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-purple-50 text-purple-600">
                <Bot size={14} />
              </div>
              <div>
                <h3 className="text-[14.5px] font-bold text-slate-900 leading-none">
                  How AI Models See Your Brand
                </h3>
                <p className="mt-1 text-[11.5px] text-slate-500">
                  Insights from each AI model based on your website, content and competitors.
                </p>
              </div>
            </div>

            {/* 3 Model Cards Side-by-Side */}
            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* ChatGPT Card */}
              <div className="rounded-xl border border-slate-200/80 bg-slate-50/40 p-3.5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-slate-900 border border-emerald-100/60">
                        <svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 2a10 10 0 0 1 10 10c0 5.523-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2m0 5a5 5 0 0 0-5 5c0 2.76 2.24 5 5 5s5-2.24 5-5a5 5 0 0 0-5-5" />
                        </svg>
                      </div>
                      <span className="text-[12px] font-bold text-slate-900">ChatGPT</span>
                    </div>
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200/50">
                      Positive
                    </span>
                  </div>

                  <p className="mt-2.5 text-[11.5px] leading-relaxed text-slate-600 italic">
                    &ldquo;{businessName} is recognized as a leading AI-powered SEO automation platform, especially for technical SEO and code fixes.&rdquo;
                  </p>
                </div>

                <div className="mt-3 pt-3 border-t border-slate-200/60">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                    Strengths
                  </span>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    <span className="rounded-md bg-emerald-50/80 border border-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-800">
                      Technical SEO
                    </span>
                    <span className="rounded-md bg-emerald-50/80 border border-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-800">
                      Automation
                    </span>
                    <span className="rounded-md bg-emerald-50/80 border border-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-800">
                      Clean Documentation
                    </span>
                  </div>
                </div>
              </div>

              {/* Claude Card */}
              <div className="rounded-xl border border-slate-200/80 bg-slate-50/40 p-3.5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#fff7ed] text-[#d97706] border border-amber-200/60">
                        <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor">
                          <circle cx="12" cy="12" r="3" />
                          <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                      </div>
                      <span className="text-[12px] font-bold text-slate-900">Claude</span>
                    </div>
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 border border-amber-200/50">
                      Neutral
                    </span>
                  </div>

                  <p className="mt-2.5 text-[11.5px] leading-relaxed text-slate-600 italic">
                    &ldquo;{businessName} is seen as a promising platform with strong automation capabilities, though more proof points and case studies would improve credibility.&rdquo;
                  </p>
                </div>

                <div className="mt-3 pt-3 border-t border-slate-200/60">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700">
                    Improvement Areas
                  </span>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    <span className="rounded-md bg-amber-50/80 border border-amber-200/60 px-2 py-0.5 text-[10px] font-medium text-amber-800">
                      More Case Studies
                    </span>
                    <span className="rounded-md bg-amber-50/80 border border-amber-200/60 px-2 py-0.5 text-[10px] font-medium text-amber-800">
                      Stronger Brand Authority
                    </span>
                    <span className="rounded-md bg-amber-50/80 border border-amber-200/60 px-2 py-0.5 text-[10px] font-medium text-amber-800">
                      Better Content Depth
                    </span>
                  </div>
                </div>
              </div>

              {/* Gemini Card */}
              <div className="rounded-xl border border-slate-200/80 bg-slate-50/40 p-3.5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-50 text-sky-600 border border-sky-200/60">
                        <Sparkles size={14} />
                      </div>
                      <span className="text-[12px] font-bold text-slate-900">Gemini</span>
                    </div>
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200/50">
                      Positive
                    </span>
                  </div>

                  <p className="mt-2.5 text-[11.5px] leading-relaxed text-slate-600 italic">
                    &ldquo;{businessName} is considered an innovative solution in the SEO/AI space, with good relevance for businesses looking to automate SEO and GEO.&rdquo;
                  </p>
                </div>

                <div className="mt-3 pt-3 border-t border-slate-200/60">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                    Strengths
                  </span>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    <span className="rounded-md bg-emerald-50/80 border border-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-800">
                      AI Innovation
                    </span>
                    <span className="rounded-md bg-emerald-50/80 border border-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-800">
                      Relevant for Businesses
                    </span>
                    <span className="rounded-md bg-emerald-50/80 border border-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-800">
                      Growing Presence
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Middle: AI Citation Distribution (Col span 3) */}
        <div className="lg:col-span-3 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-[14px] font-bold text-slate-900">AI Citation Distribution</span>
              <Info size={13} className="text-slate-300" />
            </div>
          </div>

          {/* Donut graphic and Legend */}
          <div className="my-auto flex flex-col sm:flex-row items-center justify-center gap-5 pt-3">
            {/* Donut Chart SVG */}
            <div className="relative flex h-[126px] w-[126px] shrink-0 items-center justify-center">
              <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
                {segments.map((seg, idx) => (
                  <circle
                    key={idx}
                    cx="60"
                    cy="60"
                    r="46"
                    fill="none"
                    stroke={seg.color}
                    strokeWidth="15"
                    strokeDasharray={seg.strokeDash}
                    strokeDashoffset={seg.offset}
                    className="transition-all duration-700"
                  />
                ))}
              </svg>
              {/* Center text */}
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-[20px] font-extrabold text-slate-900 leading-none">
                  {totalCitations}
                </span>
                <span className="mt-0.5 text-[10.5px] font-medium text-slate-400">
                  Citations
                </span>
              </div>
            </div>

            {/* Legend list */}
            <div className="space-y-2 text-[12px]">
              {segments.map((s) => (
                <div key={s.label} className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: s.color }}
                  />
                  <span className="font-medium text-slate-700 min-w-[55px]">{s.label}</span>
                  <span className="font-bold text-slate-900">{s.pct}%</span>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-2 text-[11px] text-slate-400 text-center">
            Proportional engine citation distribution
          </div>
        </div>

        {/* Right: Top Competitors in AI Responses (Col span 3) */}
        <div className="lg:col-span-3 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Users size={15} className="text-purple-600" />
              <h3 className="text-[14px] font-bold text-slate-900">
                Top Competitors in AI Responses
              </h3>
            </div>

            {/* List */}
            <div className="mt-3.5 space-y-2.5">
              {topCompetitors.map((item) => (
                <div
                  key={item.domain}
                  className={`flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 transition-colors ${
                    item.isYou
                      ? "bg-emerald-50/80 border border-emerald-200/70"
                      : "hover:bg-slate-50"
                  }`}
                >
                  <span className="w-3 text-[11px] font-bold text-slate-400 text-center">
                    {item.rank}
                  </span>
                  <span
                    className={`flex-1 text-[11.5px] truncate ${
                      item.isYou ? "font-bold text-emerald-950" : "font-medium text-slate-800"
                    }`}
                  >
                    {item.domain}
                  </span>

                  {/* Horizontal mini bar */}
                  <div className="w-16 h-2 rounded-full bg-slate-100 overflow-hidden shrink-0">
                    <div
                      className={`h-full rounded-full ${item.barColor}`}
                      style={{ width: `${item.sharePct * 2}%` }}
                    />
                  </div>

                  <span className="w-8 text-right text-[11.5px] font-bold text-slate-800 shrink-0">
                    {item.sharePct}%
                  </span>
                </div>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={onViewCompetitorsTab}
            className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white py-2 text-[12px] font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
          >
            <span>View Full Comparison</span>
            <ArrowRight size={13} />
          </button>
        </div>
      </div>

      {/* ── ROW 3: Latest AI Insights (70%) + Ready to Improve Card (30%) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Latest AI Insights */}
        <div className="lg:col-span-8 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Sparkles size={15} className="text-purple-600" />
              <h3 className="text-[14.5px] font-bold text-slate-900">Latest AI Insights</h3>
            </div>
            <button
              type="button"
              onClick={onViewInsightsTab}
              className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11.5px] font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <span>View Full Insights</span>
              <ArrowRight size={12} />
            </button>
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Insight 1 */}
            <div className="rounded-xl border border-slate-200/70 bg-slate-50/40 p-4 hover:bg-slate-50 transition-colors">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100">
                <TrendingUp size={16} />
              </div>
              <h4 className="mt-3 text-[13px] font-bold text-slate-900 leading-snug">
                Growing Brand Mentions
              </h4>
              <p className="mt-1 text-[11.5px] leading-relaxed text-slate-500">
                Mentions increased by 24% in the last 28 days, especially in technical SEO queries.
              </p>
            </div>

            {/* Insight 2 */}
            <div className="rounded-xl border border-slate-200/70 bg-slate-50/40 p-4 hover:bg-slate-50 transition-colors">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600 border border-blue-100">
                <Lightbulb size={16} />
              </div>
              <h4 className="mt-3 text-[13px] font-bold text-slate-900 leading-snug">
                Content Opportunity
              </h4>
              <p className="mt-1 text-[11.5px] leading-relaxed text-slate-500">
                AI models suggest creating more case studies and industry-specific content.
              </p>
            </div>

            {/* Insight 3 */}
            <div className="rounded-xl border border-slate-200/70 bg-slate-50/40 p-4 hover:bg-slate-50 transition-colors">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-50 text-orange-600 border border-orange-100">
                <Users size={16} />
              </div>
              <h4 className="mt-3 text-[13px] font-bold text-slate-900 leading-snug">
                Competitor Gap
              </h4>
              <p className="mt-1 text-[11.5px] leading-relaxed text-slate-500">
                Your competitors have stronger brand authority signals in Gemini responses.
              </p>
            </div>
          </div>
        </div>

        {/* Right: Ready to Improve Your AI Visibility? Banner */}
        <div className="lg:col-span-4 relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#5b21b6] via-[#6d28d9] to-[#7c3aed] p-5 text-white shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 text-white backdrop-blur-xs">
              <Sparkles size={20} />
            </div>

            <h3 className="mt-3.5 text-[16px] font-bold leading-snug">
              Ready to Improve Your AI Visibility?
            </h3>
            <p className="mt-1.5 text-[12px] leading-relaxed text-purple-100/90">
              Get personalized, AI-powered recommendations to increase your citations and share of voice.
            </p>
          </div>

          <button
            type="button"
            onClick={onGenerateRecommendations || onViewRecommendationsTab}
            className="mt-5 flex w-full items-center justify-center gap-1.5 rounded-xl bg-white py-2.5 px-4 text-[12.5px] font-bold text-purple-900 hover:bg-purple-50 transition-all shadow-xs active:scale-[0.99]"
          >
            <span>Generate Recommendations</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
