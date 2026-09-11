"use client";

import React, { useState } from "react";
import {
  Users,
  Cpu,
  Sparkles,
  Zap,
  FileBarChart,
  Shield,
  Bot,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  Download,
  Plus,
  Play,
  Share2,
  Calendar,
  Globe,
  Gauge,
  Layers,
  Search,
  Check,
  X,
  Clock,
  ChevronDown,
} from "lucide-react";

/* ──────────────────────────────────────────────────────────────────────────
   1. COMPETITORS DISCOVERY TAB
   ────────────────────────────────────────────────────────────────────────── */
export interface CompetitorsDiscoveryTabProps {
  onAddToFixPlan?: (count: number, label?: string) => void;
  onAddCompetitor?: () => void;
}

export function CompetitorsDiscoveryTab({
  onAddToFixPlan,
  onAddCompetitor,
}: CompetitorsDiscoveryTabProps) {
  const [filterType, setFilterType] = useState<"all" | "direct" | "search" | "ai">("all");

  const competitorsList = [
    {
      domain: "semrush.com",
      type: "direct",
      typeLabel: "Direct Competitor",
      matchScore: 98,
      status: "Active Tracking",
      traffic: "14.2M",
      keywords: "12.8K",
      da: 91,
      aiShare: "42%",
      strengths: ["Domain authority & massive backlink profile", "Comprehensive comparison and tool pages"],
      weaknesses: ["Slower page experience on mobile guides", "Lower LLM brand sentiment in small business prompts"],
    },
    {
      domain: "ahrefs.com",
      type: "direct",
      typeLabel: "Direct Competitor",
      matchScore: 94,
      status: "Active Tracking",
      traffic: "11.8M",
      keywords: "10.8K",
      da: 89,
      aiShare: "38%",
      strengths: ["Dominant blog tutorials and educational guides", "High frequency of citation in Claude and Gemini"],
      weaknesses: ["Sparse schema structure on category directories", "Fewer free interactive templates"],
    },
    {
      domain: "moz.com",
      type: "search",
      typeLabel: "Search Overlap",
      matchScore: 88,
      status: "Active Tracking",
      traffic: "6.4M",
      keywords: "8.6K",
      da: 84,
      aiShare: "24%",
      strengths: ["Legacy whitepapers and foundational beginner guides", "Extensive internal linking network"],
      weaknesses: ["Declining freshness signals on older articles", "Missing conversational AI question formats"],
    },
    {
      domain: "similarweb.com",
      type: "ai",
      typeLabel: "AI Visibility Leader",
      matchScore: 82,
      status: "Discovered by Aiva",
      traffic: "8.9M",
      keywords: "7.2K",
      da: 86,
      aiShare: "31%",
      strengths: ["Data-backed research reports cited across web", "Structured table datasets preferred by LLM synthesizers"],
      weaknesses: ["Paywalled data blocks organic user retention", "No dedicated technical SEO checklist hub"],
    },
  ];

  const filtered = competitorsList.filter((c) => {
    if (filterType === "all") return true;
    return c.type === filterType;
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="h-10 w-10 rounded-xl bg-purple-100 flex items-center justify-center text-purple-700 shadow-2xs">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Competitor Directory &amp; Discovery</h1>
              <p className="text-sm text-slate-500">
                Aiva automatically identifies domains competing for your search keywords and generative AI citations.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onAddCompetitor}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold transition-all shadow-md shadow-purple-500/20 active:scale-[0.98]"
          >
            <Plus className="h-4 w-4" />
            <span>+ Add Competitor</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2">
        {[
          { id: "all", label: "All Competitors (4)" },
          { id: "direct", label: "Direct Competitors (2)" },
          { id: "search", label: "Search Overlap (1)" },
          { id: "ai", label: "AI Visibility Leaders (1)" },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setFilterType(tab.id as any)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              filterType === tab.id
                ? "bg-purple-600 text-white shadow-2xs"
                : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Competitors Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {filtered.map((comp) => (
          <div
            key={comp.domain}
            className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs flex flex-col justify-between hover:border-purple-200 transition-all"
          >
            <div>
              {/* Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center font-bold text-slate-700 text-sm">
                    {comp.domain.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-base text-slate-900">{comp.domain}</span>
                      <a
                        href={`https://${comp.domain}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-slate-400 hover:text-slate-600"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </div>
                    <span className="text-[11px] font-medium text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full">
                      {comp.typeLabel}
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg">
                    {comp.matchScore}% Match
                  </div>
                  <span className="text-[10px] text-slate-400 mt-0.5 block">{comp.status}</span>
                </div>
              </div>

              {/* Metrics strip */}
              <div className="grid grid-cols-4 gap-2 mt-5 p-3 rounded-xl bg-slate-50 border border-slate-100 text-center">
                <div>
                  <div className="text-[10px] text-slate-400 font-medium">Traffic</div>
                  <div className="text-xs font-bold text-slate-800">{comp.traffic}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 font-medium">Keywords</div>
                  <div className="text-xs font-bold text-slate-800">{comp.keywords}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 font-medium">Domain Auth</div>
                  <div className="text-xs font-bold text-slate-800">{comp.da}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 font-medium">AI Citation</div>
                  <div className="text-xs font-bold text-purple-700">{comp.aiShare}</div>
                </div>
              </div>

              {/* Teardown Analysis */}
              <div className="mt-4 space-y-2.5 text-xs">
                <div>
                  <span className="font-bold text-slate-800 flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    Key Strengths:
                  </span>
                  <ul className="mt-1 pl-5 list-disc text-slate-600 space-y-0.5 text-[11px]">
                    {comp.strengths.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </div>

                <div>
                  <span className="font-bold text-slate-800 flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                    Vulnerabilities to Exploit:
                  </span>
                  <ul className="mt-1 pl-5 list-disc text-slate-600 space-y-0.5 text-[11px]">
                    {comp.weaknesses.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
              <button
                type="button"
                onClick={() => onAddToFixPlan?.(5, `Gaps against ${comp.domain}`)}
                className="text-xs font-bold text-purple-700 hover:text-purple-800 flex items-center gap-1"
              >
                <span>Add Opportunities to Fix Plan</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>

              <span className="text-[11px] text-slate-400">Crawled 4 hours ago</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   2. TECHNICAL GAPS TAB
   ────────────────────────────────────────────────────────────────────────── */
export interface CompetitorTechnicalGapsTabProps {
  onAddToFixPlan?: (count: number, label?: string) => void;
}

export function CompetitorTechnicalGapsTab({
  onAddToFixPlan,
}: CompetitorTechnicalGapsTabProps) {
  const technicalAudits = [
    {
      metric: "Largest Contentful Paint (LCP)",
      yourScore: "3.4s",
      yourStatus: "Needs Work",
      compLeader: "ahrefs.com (1.8s)",
      impact: "High",
      recommendation: "Compress hero WebP assets and defer third-party analytics scripts.",
    },
    {
      metric: "Interaction to Next Paint (INP)",
      yourScore: "180ms",
      yourStatus: "Good",
      compLeader: "semrush.com (140ms)",
      impact: "Low",
      recommendation: "Maintain lean JavaScript event listeners.",
    },
    {
      metric: "Structured Schema Coverage",
      yourScore: "38% of pages",
      yourStatus: "Behind Competitors",
      compLeader: "semrush.com (94% of pages)",
      impact: "Critical",
      recommendation: "Deploy Article, FAQ, SoftwareApplication, and Organization JSON-LD schemas.",
    },
    {
      metric: "Cumulative Layout Shift (CLS)",
      yourScore: "0.04",
      yourStatus: "Good",
      compLeader: "moz.com (0.02)",
      impact: "Low",
      recommendation: "Explicit width/height dimensions set on all media.",
    },
    {
      metric: "Mobile-First Viewport Optimization",
      yourScore: "88/100",
      yourStatus: "Moderate",
      compLeader: "ahrefs.com (98/100)",
      impact: "Medium",
      recommendation: "Fix tap target spacing on mobile comparison tables.",
    },
    {
      metric: "Crawl Budget & Sitemap Freshness",
      yourScore: "Weekly",
      yourStatus: "Behind Competitors",
      compLeader: "semrush.com (Hourly Real-time)",
      impact: "High",
      recommendation: "Implement automated sitemap ping upon new content publication.",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="h-10 w-10 rounded-xl bg-purple-100 flex items-center justify-center text-purple-700 shadow-2xs">
              <Cpu className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Technical Infrastructure Gaps</h1>
              <p className="text-sm text-slate-500">
                Benchmark Core Web Vitals, schema markup, and crawl architectures against market leaders.
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onAddToFixPlan?.(6, "Technical Architecture Improvements")}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold transition-all shadow-md shadow-purple-500/20 active:scale-[0.98]"
        >
          <Play className="h-4 w-4 fill-white" />
          <span>Add 6 Technical Fixes to Fix Plan</span>
        </button>
      </div>

      {/* Quick Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
          <div className="flex items-center gap-2.5 text-slate-500 text-xs font-semibold mb-1">
            <Gauge className="h-4 w-4 text-purple-600" />
            <span>Average Speed Score</span>
          </div>
          <div className="text-2xl font-bold text-slate-900">74 / 100</div>
          <div className="text-[11px] text-rose-500 font-medium mt-1">Competitor average: 88 / 100</div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
          <div className="flex items-center gap-2.5 text-slate-500 text-xs font-semibold mb-1">
            <Layers className="h-4 w-4 text-purple-600" />
            <span>Schema Entity Coverage</span>
          </div>
          <div className="text-2xl font-bold text-slate-900">38%</div>
          <div className="text-[11px] text-amber-500 font-medium mt-1">56% gap vs. semrush.com</div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
          <div className="flex items-center gap-2.5 text-slate-500 text-xs font-semibold mb-1">
            <Shield className="h-4 w-4 text-purple-600" />
            <span>Security &amp; Indexability</span>
          </div>
          <div className="text-2xl font-bold text-slate-900">100%</div>
          <div className="text-[11px] text-emerald-600 font-medium mt-1">Parity with all competitors</div>
        </div>
      </div>

      {/* Technical Comparison Table */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs space-y-4">
        <h2 className="text-base font-bold text-slate-900">Technical Gap Analysis Breakdown</h2>
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-[11px] font-bold text-slate-600 border-b border-slate-200 uppercase tracking-wider">
              <tr>
                <th className="p-3.5 font-bold">Signal</th>
                <th className="p-3.5 font-bold">Your Domain</th>
                <th className="p-3.5 font-bold">Status</th>
                <th className="p-3.5 font-bold">Competitor Benchmark</th>
                <th className="p-3.5 font-bold">Impact</th>
                <th className="p-3.5 font-bold">Fix Plan Recommendation</th>
                <th className="p-3.5 font-bold text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {technicalAudits.map((item, idx) => (
                <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                  <td className="p-3.5 font-bold text-slate-900">{item.metric}</td>
                  <td className="p-3.5 font-semibold text-slate-800">{item.yourScore}</td>
                  <td className="p-3.5">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${
                        item.yourStatus === "Good"
                          ? "bg-emerald-50 text-emerald-600 border border-emerald-200/60"
                          : item.yourStatus === "Needs Work"
                          ? "bg-rose-50 text-rose-600 border border-rose-200/60"
                          : "bg-amber-50 text-amber-600 border border-amber-200/60"
                      }`}
                    >
                      {item.yourStatus}
                    </span>
                  </td>
                  <td className="p-3.5 font-medium text-slate-700">{item.compLeader}</td>
                  <td className="p-3.5">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${
                        item.impact === "Critical"
                          ? "bg-rose-50 text-rose-600"
                          : item.impact === "High"
                          ? "bg-orange-50 text-orange-600"
                          : item.impact === "Medium"
                          ? "bg-amber-50 text-amber-600"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {item.impact}
                    </span>
                  </td>
                  <td className="p-3.5 text-slate-700 max-w-xs">{item.recommendation}</td>
                  <td className="p-3.5 text-center">
                    <button
                      type="button"
                      onClick={() => onAddToFixPlan?.(1, item.metric)}
                      className="px-2.5 py-1 rounded-lg text-xs font-bold text-purple-700 hover:bg-purple-50 transition-colors"
                    >
                      Add to Plan
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   3. AI VISIBILITY BENCHMARK TAB
   ────────────────────────────────────────────────────────────────────────── */
export interface CompetitorAiVisibilityTabProps {
  onAddToFixPlan?: (count: number, label?: string) => void;
}

export function CompetitorAiVisibilityTab({
  onAddToFixPlan,
}: CompetitorAiVisibilityTabProps) {
  const promptAudits = [
    {
      prompt: "What are the best automated SEO and keyword research tools for SaaS?",
      chatgpt: { leader: "semrush.com", youCited: false },
      claude: { leader: "ahrefs.com", youCited: true },
      gemini: { leader: "semrush.com", youCited: false },
      action: "Add Answer Engine Optimization (AEO) structure to product landing page",
    },
    {
      prompt: "How to conduct a modern competitor backlink and content gap analysis?",
      chatgpt: { leader: "ahrefs.com", youCited: false },
      claude: { leader: "ahrefs.com", youCited: false },
      gemini: { leader: "moz.com", youCited: true },
      action: "Publish comprehensive step-by-step tutorial with schema Q&A",
    },
    {
      prompt: "Compare top AI visibility tracking software in 2026",
      chatgpt: { leader: "similarweb.com", youCited: false },
      claude: { leader: "similarweb.com", youCited: false },
      gemini: { leader: "semrush.com", youCited: false },
      action: "Build side-by-side comparison matrix with objective benchmarks",
    },
    {
      prompt: "Best technical SEO audit tools with Core Web Vitals automation",
      chatgpt: { leader: "semrush.com", youCited: true },
      claude: { leader: "semrush.com", youCited: false },
      gemini: { leader: "semrush.com", youCited: true },
      action: "Optimize Core Web Vitals feature page for direct citations",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="h-10 w-10 rounded-xl bg-purple-100 flex items-center justify-center text-purple-700 shadow-2xs">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">AI &amp; LLM Visibility Benchmarks</h1>
              <p className="text-sm text-slate-500">
                Track how ChatGPT, Claude, and Gemini perceive and recommend your brand vs. competitors.
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onAddToFixPlan?.(8, "AI Citation Engine Tasks")}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold transition-all shadow-md shadow-purple-500/20 active:scale-[0.98]"
        >
          <Play className="h-4 w-4 fill-white" />
          <span>Add 8 AI Visibility Tasks to Fix Plan</span>
        </button>
      </div>

      {/* Model Share Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="rounded-2xl border border-purple-200/80 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-700">ChatGPT (OpenAI)</span>
            <span className="text-xs font-bold text-purple-600">32% Share</span>
          </div>
          <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-purple-600 rounded-full" style={{ width: "32%" }} />
          </div>
          <p className="text-[11px] text-slate-500 mt-2">
            Competitor leader: <strong className="text-slate-800">semrush.com (48%)</strong>
          </p>
        </div>

        <div className="rounded-2xl border border-blue-200/80 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-700">Claude (Anthropic)</span>
            <span className="text-xs font-bold text-blue-600">41% Share</span>
          </div>
          <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-blue-600 rounded-full" style={{ width: "41%" }} />
          </div>
          <p className="text-[11px] text-slate-500 mt-2">
            Competitor leader: <strong className="text-slate-800">ahrefs.com (44%)</strong>
          </p>
        </div>

        <div className="rounded-2xl border border-emerald-200/80 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-700">Gemini (Google)</span>
            <span className="text-xs font-bold text-emerald-600">26% Share</span>
          </div>
          <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-600 rounded-full" style={{ width: "26%" }} />
          </div>
          <p className="text-[11px] text-slate-500 mt-2">
            Competitor leader: <strong className="text-slate-800">semrush.com (52%)</strong>
          </p>
        </div>
      </div>

      {/* Prompts Head-to-Head Table */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs space-y-4">
        <h2 className="text-base font-bold text-slate-900">Synthetic Prompt Evaluation Audit</h2>
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-[11px] font-bold text-slate-600 border-b border-slate-200 uppercase tracking-wider">
              <tr>
                <th className="p-3.5 font-bold">Tested User Query / Prompt</th>
                <th className="p-3.5 font-bold">ChatGPT Leader</th>
                <th className="p-3.5 font-bold">Claude Leader</th>
                <th className="p-3.5 font-bold">Gemini Leader</th>
                <th className="p-3.5 font-bold">Recommended AEO Action</th>
                <th className="p-3.5 font-bold text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {promptAudits.map((item, idx) => (
                <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                  <td className="p-3.5 font-semibold text-slate-900 max-w-sm">
                    &ldquo;{item.prompt}&rdquo;
                  </td>
                  <td className="p-3.5">
                    <div className="flex items-center gap-1.5">
                      {item.chatgpt.youCited ? (
                        <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                      ) : (
                        <span className="h-2 w-2 rounded-full bg-rose-400 shrink-0" />
                      )}
                      <span className="font-medium text-slate-700">{item.chatgpt.leader}</span>
                    </div>
                  </td>
                  <td className="p-3.5">
                    <div className="flex items-center gap-1.5">
                      {item.claude.youCited ? (
                        <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                      ) : (
                        <span className="h-2 w-2 rounded-full bg-rose-400 shrink-0" />
                      )}
                      <span className="font-medium text-slate-700">{item.claude.leader}</span>
                    </div>
                  </td>
                  <td className="p-3.5">
                    <div className="flex items-center gap-1.5">
                      {item.gemini.youCited ? (
                        <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                      ) : (
                        <span className="h-2 w-2 rounded-full bg-rose-400 shrink-0" />
                      )}
                      <span className="font-medium text-slate-700">{item.gemini.leader}</span>
                    </div>
                  </td>
                  <td className="p-3.5 text-slate-700 max-w-xs">{item.action}</td>
                  <td className="p-3.5 text-center">
                    <button
                      type="button"
                      onClick={() => onAddToFixPlan?.(1, "AEO Optimization")}
                      className="px-2.5 py-1 rounded-lg text-xs font-bold text-purple-700 hover:bg-purple-50 transition-colors"
                    >
                      Add to Plan
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   4. OPPORTUNITIES (AI ENGINE) TAB
   ────────────────────────────────────────────────────────────────────────── */
export interface CompetitorOpportunitiesTabProps {
  onAddToFixPlan?: (count: number, label?: string) => void;
}

export function CompetitorOpportunitiesTab({
  onAddToFixPlan,
}: CompetitorOpportunitiesTabProps) {
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set([1, 2, 3]));

  const opportunitiesList = [
    {
      id: 1,
      category: "Keyword Gap",
      title: "Capture 86 Quick-Win Keywords in Low-Difficulty SERPs",
      desc: "Competitors rank on page 1 with KD < 40. Targeting these can drive ~22,000 monthly organic visits within 45 days.",
      impact: "High",
      effort: "Low",
      signal: "Keyword Gap Analysis",
      color: "bg-emerald-50 text-emerald-700",
    },
    {
      id: 2,
      category: "Content Gap",
      title: "Publish 12 Comparison & Alternative Hub Pages",
      desc: "All 4 competitors have dedicated 'vs' comparison pages capturing high commercial search intent. Your site has 0.",
      impact: "Critical",
      effort: "Medium",
      signal: "Content Gap Analysis",
      color: "bg-purple-50 text-purple-700",
    },
    {
      id: 3,
      category: "AI Visibility",
      title: "Add Direct Answer Schema to Win ChatGPT Citations",
      desc: "Competitors receive 48% citation share on core industry prompts because of structured FAQ & Article microdata.",
      impact: "High",
      effort: "Low",
      signal: "AEO Audit",
      color: "bg-blue-50 text-blue-700",
    },
    {
      id: 4,
      category: "Technical",
      title: "Optimize LCP and Eliminate Render-Blocking Scripts",
      desc: "Your LCP of 3.4s is 1.6s slower than ahrefs.com. Speed parity directly improves Google crawl frequency.",
      impact: "Medium",
      effort: "Low",
      signal: "Core Web Vitals",
      color: "bg-amber-50 text-amber-700",
    },
    {
      id: 5,
      category: "Authority",
      title: "Reclaim 42 Unlinked Brand Mentions & Digital PR Gaps",
      desc: "Industry roundups mention your software without a hyperlink, while linking directly to competitors.",
      impact: "Medium",
      effort: "Medium",
      signal: "Backlink Radar",
      color: "bg-rose-50 text-rose-700",
    },
  ];

  const toggleSelect = (id: number) => {
    const next = new Set(selectedItems);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedItems(next);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="h-10 w-10 rounded-xl bg-purple-100 flex items-center justify-center text-purple-700 shadow-2xs">
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">AI Opportunity Prioritization Engine</h1>
              <p className="text-sm text-slate-500">
                All discovered competitor gaps weighted by traffic impact, conversion likelihood, and implementation effort.
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onAddToFixPlan?.(selectedItems.size, `${selectedItems.size} High-Impact Strategy Items`)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold transition-all shadow-md shadow-purple-500/20 active:scale-[0.98]"
        >
          <Play className="h-4 w-4 fill-white" />
          <span>Add Selected ({selectedItems.size}) to 30-Day Fix Plan</span>
        </button>
      </div>

      {/* Opportunity Cards List */}
      <div className="space-y-3.5">
        {opportunitiesList.map((opp) => {
          const isSelected = selectedItems.has(opp.id);
          return (
            <div
              key={opp.id}
              onClick={() => toggleSelect(opp.id)}
              className={`cursor-pointer rounded-2xl border p-5 transition-all shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                isSelected
                  ? "border-purple-300 bg-purple-50/30"
                  : "border-slate-200/80 bg-white hover:border-slate-300"
              }`}
            >
              <div className="flex items-start gap-3.5">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleSelect(opp.id)}
                  onClick={(e) => e.stopPropagation()}
                  className="mt-1 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                />
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${opp.color}`}>
                      {opp.category}
                    </span>
                    <span className="text-[11px] font-semibold text-slate-400">
                      Source: {opp.signal}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-slate-900">{opp.title}</h3>
                  <p className="text-xs text-slate-600 mt-1 max-w-2xl leading-relaxed">{opp.desc}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                <div className="text-right">
                  <div className="text-xs font-bold text-slate-800">Impact: {opp.impact}</div>
                  <div className="text-[11px] text-slate-400">Effort: {opp.effort}</div>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddToFixPlan?.(1, opp.title);
                  }}
                  className="px-3 py-1.5 rounded-xl border border-purple-200 bg-white text-purple-700 hover:bg-purple-50 text-xs font-bold transition-colors shadow-2xs"
                >
                  Stage Item
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   5. REPORTS TAB
   ────────────────────────────────────────────────────────────────────────── */
export interface CompetitorReportsTabProps {
  domain?: string;
  onGenerateReport?: () => void;
}

export function CompetitorReportsTab({
  domain = "aivaenterprises.com",
  onGenerateReport,
}: CompetitorReportsTabProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="h-10 w-10 rounded-xl bg-purple-100 flex items-center justify-center text-purple-700 shadow-2xs">
              <FileBarChart className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Executive Competitor Intelligence Reports</h1>
              <p className="text-sm text-slate-500">
                Generate, export, and schedule comprehensive competitive strategy reports for stakeholders.
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onGenerateReport}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold transition-all shadow-md shadow-purple-500/20 active:scale-[0.98]"
        >
          <Sparkles className="h-4 w-4" />
          <span>Generate New Report</span>
        </button>
      </div>

      {/* Featured Report Card */}
      <div className="rounded-2xl border border-purple-200 bg-linear-to-r from-purple-50/80 via-white to-slate-50 p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-purple-700 bg-purple-100/60 px-2.5 py-0.5 rounded-full">
              Latest Comprehensive Audit
            </span>
            <h2 className="text-xl font-bold text-slate-900">
              Q3 2026 Competitive Market &amp; AI Visibility Benchmark Report
            </h2>
            <p className="text-xs text-slate-600 max-w-2xl leading-relaxed">
              Complete teardown covering 12,842 keywords, 428 content topics, 4 major competitors (Semrush, Ahrefs, Moz, Similarweb),
              Core Web Vitals gap analysis, and LLM citation shares across ChatGPT, Claude, and Gemini.
            </p>
            <div className="flex items-center gap-4 text-xs text-slate-500 pt-1">
              <span className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-slate-400" />
                Generated Today
              </span>
              <span className="flex items-center gap-1.5">
                <Globe className="h-3.5 w-3.5 text-slate-400" />
                Target: {domain}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={onGenerateReport}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 hover:bg-slate-50 text-xs font-bold transition-all shadow-2xs"
            >
              <Download className="h-4 w-4 text-slate-500" />
              <span>Download PDF</span>
            </button>
            <button
              type="button"
              onClick={onGenerateReport}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100 text-xs font-bold transition-all shadow-2xs"
            >
              <Share2 className="h-4 w-4" />
              <span>Share Link</span>
            </button>
          </div>
        </div>
      </div>

      {/* Historical Reports Archives */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs space-y-4">
        <h3 className="text-base font-bold text-slate-900">Archived Strategy Reports</h3>
        <div className="divide-y divide-slate-100">
          {[
            { title: "Monthly Competitor Keyword Shift Digest", date: "August 2026", size: "3.4 MB", type: "PDF Report" },
            { title: "AI Search Engine Citation Teardown (ChatGPT vs Claude)", date: "July 2026", size: "2.8 MB", type: "PDF Report" },
            { title: "Technical Infrastructure & Schema Comparison", date: "June 2026", size: "4.1 MB", type: "PDF Report" },
          ].map((rep, idx) => (
            <div key={idx} className="flex items-center justify-between py-3.5 text-xs">
              <div>
                <div className="font-bold text-slate-900">{rep.title}</div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  {rep.date} • {rep.size} • {rep.type}
                </div>
              </div>
              <button
                type="button"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold"
              >
                <Download className="h-3.5 w-3.5 text-slate-400" />
                <span>Export</span>
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
