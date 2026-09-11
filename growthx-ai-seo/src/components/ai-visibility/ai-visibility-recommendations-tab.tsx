"use client";

import React, { useState } from "react";
import {
  FileText,
  CheckCircle2,
  TrendingUp,
  Target,
  ChevronDown,
  ArrowRight,
  Download,
  Sparkles,
  Zap,
  Bot,
  Brain,
  Check,
  X,
  Layers,
  BarChart3,
  Shield,
  Code2,
} from "lucide-react";
import { AiKpiCard } from "./ai-kpi-card";

export interface RecommendationRow {
  id: number;
  title: string;
  category: "Content" | "Technical" | "Authority" | "On-Page";
  impact: "High" | "Medium" | "Low";
  effort: "High" | "Medium" | "Low";
  consensus: number; // e.g. 92
  details: string;
  codeSnippet?: string;
}

export function AiVisibilityRecommendationsTab({
  domain = "aivaenterprises.com",
  onImplementWithAi,
}: {
  domain?: string;
  onImplementWithAi?: (rec: RecommendationRow) => void;
}) {
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("impact");
  const [selectedRec, setSelectedRec] = useState<RecommendationRow | null>(null);

  const recommendationsList: RecommendationRow[] = [
    {
      id: 1,
      title: "Create industry-specific landing pages for high-intent topics",
      category: "Content",
      impact: "High",
      effort: "Medium",
      consensus: 92,
      details:
        "Build dedicated vertical solution landing pages (e.g. Healthcare SEO, Agency Technical Audits) with explicit feature bullet points and customer proof points.",
      codeSnippet: `<!-- Semantic Landing Page Structure -->
<section itemscope itemtype="https://schema.org/SoftwareApplication">
  <h1 itemprop="name">Autonomous Technical SEO for Agencies</h1>
  <p itemprop="description">Automated codebase auditing and PR generation for modern web stacks.</p>
</section>`,
    },
    {
      id: 2,
      title: "Add structured data (Organization, Product, FAQ) across key pages",
      category: "Technical",
      impact: "High",
      effort: "Low",
      consensus: 89,
      details:
        "AI models directly parse schema.org markup to extract authoritative entity attributes, pricing tiers, and direct factual answers.",
      codeSnippet: `{
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "Aiva",
  "applicationCategory": "SEOAutomation",
  "operatingSystem": "Cloud-based"
}`,
    },
    {
      id: 3,
      title: "Publish data-driven case studies and success stories",
      category: "Authority",
      impact: "High",
      effort: "Medium",
      consensus: 87,
      details:
        "Claude and ChatGPT heavily prioritize verifiable citations containing numerical outcomes (e.g., 'increased organic traffic by 48% in 90 days').",
    },
    {
      id: 4,
      title: "Optimize content for conversational and question-based queries",
      category: "Content",
      impact: "Medium",
      effort: "Low",
      consensus: 84,
      details:
        "Structure FAQs with direct 30-40 word answers in natural dialogue syntax matching prompt patterns in ChatGPT search.",
    },
    {
      id: 5,
      title: "Get mentioned in trusted industry directories and publications",
      category: "Authority",
      impact: "Medium",
      effort: "Medium",
      consensus: 81,
      details:
        "Claim and update profiles on G2, Capterra, SourceForge, and Crunchbase where Gemini and Perplexity frequently gather comparative vendor data.",
    },
    {
      id: 6,
      title: "Improve internal linking to key pages",
      category: "Technical",
      impact: "Medium",
      effort: "Low",
      consensus: 78,
      details:
        "Strengthen contextual anchor text from high-authority blog posts to core commercial automation tool pages.",
    },
    {
      id: 7,
      title: "Create comparison pages vs top competitors",
      category: "Content",
      impact: "Medium",
      effort: "Medium",
      consensus: 76,
      details:
        "Provide fair, feature-by-feature comparison matrices (e.g., 'Aiva vs Semrush for technical SEO fixes') to capture competitor-brand alternative queries.",
    },
    {
      id: 8,
      title: "Update meta titles and descriptions with value propositions",
      category: "On-Page",
      impact: "Low",
      effort: "Low",
      consensus: 73,
      details:
        "Ensure meta titles explicitly state specific software capabilities rather than generic company taglines.",
    },
  ];

  // Filtering
  const filteredRecs = recommendationsList.filter((rec) => {
    if (categoryFilter === "all") return true;
    return rec.category.toLowerCase() === categoryFilter.toLowerCase();
  });

  const getCategoryBadge = (category: RecommendationRow["category"]) => {
    switch (category) {
      case "Content":
        return "bg-purple-50 text-purple-700 border-purple-200/60";
      case "Technical":
        return "bg-blue-50 text-blue-700 border-blue-200/60";
      case "Authority":
        return "bg-emerald-50 text-emerald-700 border-emerald-200/60";
      case "On-Page":
        return "bg-rose-50 text-rose-700 border-rose-200/60";
    }
  };

  const getImpactBadge = (impact: RecommendationRow["impact"]) => {
    switch (impact) {
      case "High":
        return "bg-rose-50 text-rose-700 border-rose-200";
      case "Medium":
        return "bg-amber-50 text-amber-700 border-amber-200";
      case "Low":
        return "bg-blue-50 text-blue-700 border-blue-200";
    }
  };

  const getEffortBadge = (effort: RecommendationRow["effort"]) => {
    switch (effort) {
      case "High":
        return "bg-rose-50 text-rose-700 border-rose-200";
      case "Medium":
        return "bg-amber-50 text-amber-700 border-amber-200";
      case "Low":
        return "bg-sky-50 text-sky-700 border-sky-200";
    }
  };

  return (
    <div className="space-y-6">
      {/* ── ROW 1: 4 KPI Cards (Total Recs, Quick Wins, Est Increase, Focus Areas) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Recommendations */}
        <AiKpiCard
          label="Total Recommendations"
          value="24"
          subtext="AI-generated, prioritized actions"
          icon={<FileText size={16} />}
          iconBgColor="bg-purple-50 text-purple-600"
          colorScheme="purple"
        />

        {/* Quick Wins */}
        <AiKpiCard
          label="Quick Wins"
          value="8"
          subtext="Can be implemented in ≤ 7 days"
          icon={<CheckCircle2 size={16} />}
          iconBgColor="bg-emerald-50 text-emerald-600"
          colorScheme="emerald"
        />

        {/* Estimated Visibility Increase */}
        <AiKpiCard
          label="Estimated Visibility Increase"
          value="+42%"
          subtext="Based on model consensus"
          icon={<TrendingUp size={16} />}
          iconBgColor="bg-orange-50 text-orange-600"
          colorScheme="orange"
        />

        {/* Focus Areas */}
        <AiKpiCard
          label="Focus Areas"
          value="5"
          subtext="Content, Authority, Technical, Schema, Brand"
          icon={<Target size={16} />}
          iconBgColor="bg-blue-50 text-blue-600"
          colorScheme="blue"
        />
      </div>

      {/* ── ROW 2: Main Grid (Left 65% Prioritized Recs + Right 35% Strategy Plan & Projections) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Prioritized Recommendations Table + Quick Wins + Model Insights */}
        <div className="lg:col-span-8 space-y-6">
          {/* Prioritized Recommendations Card */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-md bg-purple-50 text-purple-600">
                  <Target size={14} />
                </div>
                <h3 className="text-[14.5px] font-bold text-slate-900">
                  Prioritized Recommendations
                </h3>
              </div>

              {/* Filters */}
              <div className="flex items-center gap-2">
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  aria-label="Filter recommendations by category"
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11.5px] font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none"
                >
                  <option value="all">All Categories</option>
                  <option value="content">Content</option>
                  <option value="technical">Technical</option>
                  <option value="authority">Authority</option>
                  <option value="on-page">On-Page</option>
                </select>

                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  aria-label="Sort recommendations"
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11.5px] font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none"
                >
                  <option value="impact">Sort by Impact</option>
                  <option value="consensus">Sort by Consensus</option>
                  <option value="effort">Sort by Effort</option>
                </select>
              </div>
            </div>

            {/* Table */}
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-[12px]">
                <thead>
                  <tr className="border-b border-slate-100 text-[11px] font-medium text-slate-400">
                    <th className="py-2.5 pl-2 font-medium">#</th>
                    <th className="py-2.5 font-medium">Recommendation</th>
                    <th className="py-2.5 font-medium">Category</th>
                    <th className="py-2.5 font-medium">Impact</th>
                    <th className="py-2.5 font-medium">Effort</th>
                    <th className="py-2.5 font-medium">AI Consensus</th>
                    <th className="py-2.5 pr-2 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/70">
                  {filteredRecs.map((rec) => (
                    <tr key={rec.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 pl-2 font-bold text-slate-400">{rec.id}</td>
                      <td className="py-3 pr-2 font-semibold text-slate-900 max-w-xs">
                        {rec.title}
                      </td>
                      <td className="py-3">
                        <span className={`inline-block rounded-md px-2 py-0.5 text-[10.5px] font-semibold border ${getCategoryBadge(rec.category)}`}>
                          {rec.category}
                        </span>
                      </td>
                      <td className="py-3">
                        <span className={`inline-block rounded-md px-2 py-0.5 text-[10.5px] font-semibold border ${getImpactBadge(rec.impact)}`}>
                          {rec.impact}
                        </span>
                      </td>
                      <td className="py-3">
                        <span className={`inline-block rounded-md px-2 py-0.5 text-[10.5px] font-semibold border ${getEffortBadge(rec.effort)}`}>
                          {rec.effort}
                        </span>
                      </td>
                      <td className="py-3 font-bold text-emerald-600">
                        {rec.consensus}%
                      </td>
                      <td className="py-3 pr-2 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedRec(rec)}
                          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
                        >
                          View Details →
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Quick Wins + AI Model Insights Side-by-Side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Quick Wins */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 pb-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-md bg-purple-50 text-purple-600">
                    <Zap size={14} />
                  </div>
                  <div>
                    <h4 className="text-[13.5px] font-bold text-slate-900 leading-none">
                      Quick Wins
                    </h4>
                    <p className="mt-1 text-[11px] text-slate-500">
                      High-impact, low-effort actions you can implement immediately.
                    </p>
                  </div>
                </div>

                <div className="mt-3.5 space-y-2.5 text-[12px]">
                  <div className="flex items-start gap-2 text-slate-800">
                    <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded bg-emerald-500 text-white mt-0.5">
                      <Check size={11} strokeWidth={3} />
                    </div>
                    <span>Add FAQ schema to homepage</span>
                  </div>
                  <div className="flex items-start gap-2 text-slate-800">
                    <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded bg-emerald-500 text-white mt-0.5">
                      <Check size={11} strokeWidth={3} />
                    </div>
                    <span>Optimize meta titles for key pages</span>
                  </div>
                  <div className="flex items-start gap-2 text-slate-800">
                    <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded bg-emerald-500 text-white mt-0.5">
                      <Check size={11} strokeWidth={3} />
                    </div>
                    <span>Fix broken links and crawl errors</span>
                  </div>
                  <div className="flex items-start gap-2 text-slate-800">
                    <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded bg-emerald-500 text-white mt-0.5">
                      <Check size={11} strokeWidth={3} />
                    </div>
                    <span>Add business description for better AI understanding</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                className="mt-4 inline-flex items-center justify-center gap-1 text-[11.5px] font-semibold text-indigo-600 hover:text-indigo-700"
              >
                <span>View All Quick Wins</span>
                <ArrowRight size={12} />
              </button>
            </div>

            {/* AI Model Insights */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 pb-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-md bg-purple-50 text-purple-600">
                    <Brain size={14} />
                  </div>
                  <div>
                    <h4 className="text-[13.5px] font-bold text-slate-900 leading-none">
                      AI Model Insights
                    </h4>
                    <p className="mt-1 text-[11px] text-slate-500">
                      Why these recommendations matter according to each AI model.
                    </p>
                  </div>
                </div>

                <div className="mt-3.5 space-y-3">
                  {/* ChatGPT */}
                  <div className="flex items-start gap-2.5">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-900 text-white mt-0.5">
                      <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" fill="none" strokeWidth="2">
                        <path d="M12 2a10 10 0 0 1 10 10c0 5.523-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2m0 5a5 5 0 0 0-5 5c0 2.76 2.24 5 5 5s5-2.24 5-5a5 5 0 0 0-5-5" />
                      </svg>
                    </div>
                    <div>
                      <span className="text-[11.5px] font-bold text-slate-900">ChatGPT:</span>
                      <p className="text-[11px] text-slate-600 leading-relaxed italic">
                        &ldquo;Clear, structured content and schema markup help us understand and recommend your business more confidently.&rdquo;
                      </p>
                    </div>
                  </div>

                  {/* Claude */}
                  <div className="flex items-start gap-2.5">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-amber-50 text-amber-700 border border-amber-200 mt-0.5">
                      <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor">
                        <circle cx="12" cy="12" r="3" />
                        <path d="M12 3v3M12 18v3M3 12h3M18 12h3" stroke="currentColor" strokeWidth="2" />
                      </svg>
                    </div>
                    <div>
                      <span className="text-[11.5px] font-bold text-slate-900">Claude:</span>
                      <p className="text-[11px] text-slate-600 leading-relaxed italic">
                        &ldquo;Real-world examples and case studies build trust and authority, which increases your chances of being cited.&rdquo;
                      </p>
                    </div>
                  </div>

                  {/* Gemini */}
                  <div className="flex items-start gap-2.5">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-sky-50 text-sky-600 border border-sky-200 mt-0.5">
                      <Sparkles size={13} />
                    </div>
                    <div>
                      <span className="text-[11.5px] font-bold text-slate-900">Gemini:</span>
                      <p className="text-[11px] text-slate-600 leading-relaxed italic">
                        &ldquo;Consistent, high-quality information across the web helps improve your presence in Google&apos;s AI Overviews and Knowledge Graph.&rdquo;
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: AI Generated Strategy Plan & Projected Metrics (35-40%) */}
        <div className="lg:col-span-4 space-y-6">
          {/* AI Generated Strategy Plan Card */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-md bg-purple-50 text-purple-600">
                  <FileText size={14} />
                </div>
                <h3 className="text-[14px] font-bold text-slate-900">
                  AI Generated Strategy Plan
                </h3>
              </div>
              <button
                type="button"
                className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <Download size={11} />
                <span>Download Plan</span>
              </button>
            </div>

            {/* Phases Timeline */}
            <div className="mt-4 space-y-5">
              {/* Phase 1 */}
              <div className="relative pl-6 border-l-2 border-emerald-500">
                <div className="absolute -left-[7px] top-0 h-3 w-3 rounded-full bg-emerald-500 ring-4 ring-white" />
                <div className="flex items-center justify-between">
                  <h4 className="text-[12.5px] font-bold text-slate-900">
                    Phase 1: Quick Wins (Days 1–7)
                  </h4>
                  <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200/60">
                    High Impact
                  </span>
                </div>
                <ul className="mt-1.5 space-y-1 text-[11.5px] text-slate-600">
                  <li>• Implement schema markup</li>
                  <li>• Optimize meta data</li>
                  <li>• Fix technical SEO issues</li>
                </ul>
              </div>

              {/* Phase 2 */}
              <div className="relative pl-6 border-l-2 border-blue-500">
                <div className="absolute -left-[7px] top-0 h-3 w-3 rounded-full bg-blue-500 ring-4 ring-white" />
                <div className="flex items-center justify-between">
                  <h4 className="text-[12.5px] font-bold text-slate-900">
                    Phase 2: Content &amp; Authority (Days 8–30)
                  </h4>
                  <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 border border-blue-200/60">
                    Visibility Growth
                  </span>
                </div>
                <ul className="mt-1.5 space-y-1 text-[11.5px] text-slate-600">
                  <li>• Create topic clusters</li>
                  <li>• Publish case studies</li>
                  <li>• Get cited in trusted sources</li>
                </ul>
              </div>

              {/* Phase 3 */}
              <div className="relative pl-6 border-l-2 border-purple-500">
                <div className="absolute -left-[7px] top-0 h-3 w-3 rounded-full bg-purple-500 ring-4 ring-white" />
                <div className="flex items-center justify-between">
                  <h4 className="text-[12.5px] font-bold text-slate-900">
                    Phase 3: Expand &amp; Monitor (Days 31–90)
                  </h4>
                  <span className="rounded-md bg-purple-50 px-2 py-0.5 text-[10px] font-bold text-purple-700 border border-purple-200/60">
                    Long-term Growth
                  </span>
                </div>
                <ul className="mt-1.5 space-y-1 text-[11.5px] text-slate-600">
                  <li>• Build comparison pages</li>
                  <li>• Track new opportunities</li>
                  <li>• Iterate based on AI model feedback</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Success Metrics (Projected) */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
            <div className="flex items-center gap-2 pb-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-purple-50 text-purple-600">
                <BarChart3 size={14} />
              </div>
              <div>
                <h4 className="text-[13.5px] font-bold text-slate-900 leading-none">
                  Success Metrics (Projected)
                </h4>
                <p className="mt-1 text-[11px] text-slate-500">
                  Estimated improvement after implementing top recommendations.
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-3.5">
              {/* Metric 1 */}
              <div>
                <div className="flex items-center justify-between text-[11.5px] font-medium">
                  <span className="text-slate-700">AI Citation Share</span>
                  <span className="font-bold text-emerald-600">+42%</span>
                </div>
                <div className="mt-1.5 h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full rounded-full bg-teal-500" style={{ width: "70%" }} />
                </div>
              </div>

              {/* Metric 2 */}
              <div>
                <div className="flex items-center justify-between text-[11.5px] font-medium">
                  <span className="text-slate-700">Share of Voice</span>
                  <span className="font-bold text-emerald-600">+28%</span>
                </div>
                <div className="mt-1.5 h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full rounded-full bg-blue-500" style={{ width: "55%" }} />
                </div>
              </div>

              {/* Metric 3 */}
              <div>
                <div className="flex items-center justify-between text-[11.5px] font-medium">
                  <span className="text-slate-700">Branded Queries</span>
                  <span className="font-bold text-emerald-600">+35%</span>
                </div>
                <div className="mt-1.5 h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full rounded-full bg-purple-600" style={{ width: "62%" }} />
                </div>
              </div>

              {/* Metric 4 */}
              <div>
                <div className="flex items-center justify-between text-[11.5px] font-medium">
                  <span className="text-slate-700">Competitor Gap Reduction</span>
                  <span className="font-bold text-rose-600">-50%</span>
                </div>
                <div className="mt-1.5 h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full rounded-full bg-amber-500" style={{ width: "50%" }} />
                </div>
              </div>
            </div>

            {/* Bottom Implement Button */}
            <button
              type="button"
              onClick={() => {
                if (recommendationsList.length > 0 && onImplementWithAi) {
                  onImplementWithAi(recommendationsList[0]);
                }
              }}
              className="mt-6 flex w-full items-center justify-center gap-1.5 rounded-xl bg-purple-600 py-3 px-4 text-[12.5px] font-bold text-white hover:bg-purple-700 transition-all shadow-sm active:scale-[0.99]"
            >
              <span>Implement Recommendations with AI</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* ── DETAIL MODAL ── */}
      {selectedRec && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <span className={`rounded-md px-2 py-0.5 text-[10.5px] font-semibold border ${getCategoryBadge(selectedRec.category)}`}>
                {selectedRec.category}
              </span>
              <button
                type="button"
                onClick={() => setSelectedRec(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={16} />
              </button>
            </div>

            <div className="mt-4">
              <h3 className="text-[16px] font-bold text-slate-900 leading-snug">
                {selectedRec.title}
              </h3>

              <div className="mt-3 flex items-center gap-4 text-[12px]">
                <div>
                  <span className="text-slate-400">Impact: </span>
                  <span className={`font-bold ${selectedRec.impact === "High" ? "text-rose-600" : "text-amber-600"}`}>
                    {selectedRec.impact}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400">Effort: </span>
                  <span className="font-bold text-slate-700">{selectedRec.effort}</span>
                </div>
                <div>
                  <span className="text-slate-400">AI Consensus: </span>
                  <span className="font-bold text-emerald-600">{selectedRec.consensus}%</span>
                </div>
              </div>

              <p className="mt-3.5 text-[12.5px] leading-relaxed text-slate-600">
                {selectedRec.details}
              </p>

              {selectedRec.codeSnippet && (
                <div className="mt-4">
                  <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                    Recommended Implementation Snippet:
                  </span>
                  <pre className="mt-1.5 rounded-xl bg-slate-900 p-3 text-[11.5px] text-emerald-400 overflow-x-auto font-mono">
                    {selectedRec.codeSnippet}
                  </pre>
                </div>
              )}
            </div>

            <div className="mt-6 pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setSelectedRec(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-[12px] font-semibold text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onImplementWithAi) onImplementWithAi(selectedRec);
                  setSelectedRec(null);
                }}
                className="rounded-xl bg-purple-600 px-4 py-2 text-[12px] font-bold text-white shadow-xs hover:bg-purple-700 transition-colors"
              >
                Implement with AI →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
