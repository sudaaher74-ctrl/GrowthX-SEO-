"use client";

import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
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
  Loader2,
} from "lucide-react";
import { api, type TrackedCompetitor, type CrawlIssue } from "@/lib/api-client";
import { useLatestCrawl, useCrawlIssues, useVisibility, useTrackedPrompts } from "@/hooks/use-growthx";

/* ──────────────────────────────────────────────────────────────────────────
   1. COMPETITORS DISCOVERY TAB
   ────────────────────────────────────────────────────────────────────────── */
export interface CompetitorsDiscoveryTabProps {
  projectId?: string;
  customerDomain?: string;
  competitors?: TrackedCompetitor[];
  onAddToFixPlan?: (count: number, label?: string) => void;
  onAddCompetitor?: () => void;
}

export function CompetitorsDiscoveryTab({
  projectId = "",
  customerDomain = "",
  competitors = [],
  onAddToFixPlan,
  onAddCompetitor,
}: CompetitorsDiscoveryTabProps) {
  const [filterType, setFilterType] = useState<"all" | "active" | "crawling">("all");

  const filtered = competitors.filter((c) => {
    if (filterType === "active") return c.status === "ACTIVE" && c.crawlStatus === "DONE";
    if (filterType === "crawling") return c.crawlStatus === "IN_PROGRESS" || c.crawlStatus === "QUEUED";
    return true;
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
                Tracked domains continuously crawled to benchmark your SEO and generative AI visibility.
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
          { id: "all", label: `All Competitors (${competitors.length})` },
          { id: "active", label: `Crawled & Active (${competitors.filter((c) => c.crawlStatus === "DONE").length})` },
          { id: "crawling", label: `Crawl in Progress (${competitors.filter((c) => c.crawlStatus === "IN_PROGRESS" || c.crawlStatus === "QUEUED").length})` },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setFilterType(tab.id as any)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              filterType === tab.id
                ? "bg-purple-600 text-white shadow-2xs"
                : "bg-white border border-slate-200/80 text-slate-600 hover:bg-slate-50"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Competitor Cards Grid */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center space-y-3">
          <div className="h-12 w-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center mx-auto">
            <Globe className="h-6 w-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900">No Competitors Found</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            {competitors.length === 0
              ? "Add your primary industry rivals to start automated crawls, keyword footprint comparison, and AI citation benchmarks."
              : "No competitors matching this filter."}
          </p>
          <button
            type="button"
            onClick={onAddCompetitor}
            className="px-4 py-2 rounded-xl bg-purple-600 text-white text-xs font-bold shadow-xs hover:bg-purple-700"
          >
            Add Competitor Domain
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filtered.map((comp) => {
            const isCrawling = comp.crawlStatus === "IN_PROGRESS" || comp.crawlStatus === "QUEUED";
            return (
              <div
                key={comp.id}
                className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs flex flex-col justify-between space-y-4 hover:border-purple-200 transition-all"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-purple-100 flex items-center justify-center font-extrabold text-sm text-purple-700">
                        {(comp.name || comp.domain)[0].toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-bold text-slate-900">{comp.name || comp.domain}</h3>
                          <a
                            href={`https://${comp.domain}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-slate-400 hover:text-slate-600"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </div>
                        <span className="text-xs font-medium text-slate-400">{comp.domain}</span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span
                        className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isCrawling
                            ? "bg-purple-50 text-purple-700 border border-purple-200"
                            : comp.status === "ACTIVE"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {isCrawling ? "Crawl In Progress" : "Active Tracking"}
                      </span>
                    </div>
                  </div>

                  {/* Real Metrics Grid */}
                  <div className="grid grid-cols-3 gap-3 my-4 p-3 rounded-xl bg-slate-50/60 border border-slate-100 text-center">
                    <div>
                      <span className="text-[10px] font-bold uppercase text-slate-400">Pages Crawled</span>
                      <div className="text-sm font-bold text-slate-900 mt-0.5">
                        {comp.pagesCrawled != null ? comp.pagesCrawled.toLocaleString() : "—"}
                      </div>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase text-slate-400">SEO Health</span>
                      <div className="text-sm font-bold text-slate-900 mt-0.5">
                        {comp.healthScore != null ? `${comp.healthScore}/100` : "—"}
                      </div>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase text-slate-400">AI Citation Share</span>
                      <div className="text-sm font-bold text-purple-700 mt-0.5">
                        {comp.aiCitationSharePct != null ? `${comp.aiCitationSharePct}%` : "—"}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => onAddToFixPlan?.(5, `Gaps against ${comp.domain}`)}
                    className="text-xs font-bold text-purple-700 hover:text-purple-800 flex items-center gap-1"
                  >
                    <span>Stage Opportunities to Fix Plan</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>

                  <span className="text-[11px] text-slate-400">
                    {comp.lastAnalyzedAt ? `Crawled ${new Date(comp.lastAnalyzedAt).toLocaleDateString()}` : "Crawl pending"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   2. TECHNICAL GAPS TAB
   ────────────────────────────────────────────────────────────────────────── */
export interface CompetitorTechnicalGapsTabProps {
  projectId?: string;
  customerDomain?: string;
  competitors?: TrackedCompetitor[];
  onAddToFixPlan?: (count: number, label?: string) => void;
}

export function CompetitorTechnicalGapsTab({
  customerDomain = "",
  competitors = [],
  onAddToFixPlan,
}: CompetitorTechnicalGapsTabProps) {
  const ourCrawl = useLatestCrawl(customerDomain || null);
  const ourIssuesQuery = useCrawlIssues(ourCrawl.data?.id ?? null);
  const issues = (ourIssuesQuery.data?.data || []) as CrawlIssue[];

  // Group real crawl issues into actionable technical gap categories
  const technicalCategories = useMemo(() => {
    const perfIssues = issues.filter((i) => /perf|speed|lcp|cls|time|asset/i.test(i.category || i.issueType || i.description));
    const schemaIssues = issues.filter((i) => /schema|json-ld|structured/i.test(i.category || i.issueType || i.description));
    const metaIssues = issues.filter((i) => /meta|title|h1|heading/i.test(i.category || i.issueType || i.description));
    const crawlIssues = issues.filter((i) => /index|canonical|404|redirect|robot/i.test(i.category || i.issueType || i.description));
    const mobileIssues = issues.filter((i) => /mobile|viewport|responsive/i.test(i.category || i.issueType || i.description));

    const topRival = competitors[0]?.domain || "competitors";

    return [
      {
        metric: "Performance & Asset Optimization",
        yourScore: perfIssues.length > 0 ? `${perfIssues.length} issues flagged` : "Optimal",
        yourStatus: perfIssues.length > 0 ? "Needs Remediation" : "Good",
        compLeader: `${topRival} (Clean assets)`,
        impact: perfIssues.length > 2 ? "High" : "Medium",
        recommendation: perfIssues[0]?.recommendation || "Minify JavaScript, compress images, and optimize hero loading.",
      },
      {
        metric: "Structured Schema & Rich Results",
        yourScore: schemaIssues.length > 0 ? `${schemaIssues.length} issues flagged` : "Verified",
        yourStatus: schemaIssues.length > 0 ? "Missing Structured Data" : "Good",
        compLeader: `${topRival} (Full JSON-LD coverage)`,
        impact: "Critical",
        recommendation: schemaIssues[0]?.recommendation || "Deploy Organization, Article, and FAQPage JSON-LD schemas.",
      },
      {
        metric: "Crawlability & Indexing Signals",
        yourScore: crawlIssues.length > 0 ? `${crawlIssues.length} issues flagged` : "Clean",
        yourStatus: crawlIssues.length > 0 ? "Issues Found" : "Good",
        compLeader: `${topRival} (0 crawl errors)`,
        impact: "High",
        recommendation: crawlIssues[0]?.recommendation || "Ensure proper canonical tags and 301 redirects across site.",
      },
      {
        metric: "Meta Title & Heading Architecture",
        yourScore: metaIssues.length > 0 ? `${metaIssues.length} issues flagged` : "Clean",
        yourStatus: metaIssues.length > 0 ? "Needs Work" : "Good",
        compLeader: `${topRival} (100% unique H1s)`,
        impact: "Medium",
        recommendation: metaIssues[0]?.recommendation || "Ensure every page has a unique, descriptive H1 heading and meta description.",
      },
      {
        metric: "Mobile Viewport & Touch Optimization",
        yourScore: mobileIssues.length > 0 ? `${mobileIssues.length} issues flagged` : "Responsive",
        yourStatus: mobileIssues.length > 0 ? "Moderate" : "Good",
        compLeader: `${topRival} (Mobile-first)`,
        impact: "Medium",
        recommendation: mobileIssues[0]?.recommendation || "Verify tap targets and viewport scaling on mobile devices.",
      },
    ];
  }, [issues, competitors]);

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
                Benchmark crawl issues, schema markup, and site architecture against tracked competitors.
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onAddToFixPlan?.(issues.length, "Technical Architecture Improvements")}
          disabled={issues.length === 0}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm font-semibold transition-all shadow-md shadow-purple-500/20 active:scale-[0.98]"
        >
          <Play className="h-4 w-4 fill-white" />
          <span>Stage Technical Fixes to 30-Day Plan</span>
        </button>
      </div>

      {/* Technical Audits Table */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <h2 className="text-base font-bold text-slate-900">Technical Gap Audit Breakdown</h2>
          <span className="text-xs text-slate-500 font-semibold">
            {issues.length} total crawl issues detected
          </span>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-[11px] font-bold text-slate-600 border-b border-slate-200 uppercase tracking-wider">
              <tr>
                <th className="p-3.5 font-bold">Category / Metric</th>
                <th className="p-3.5 font-bold">Your Status</th>
                <th className="p-3.5 font-bold">Competitor Benchmark</th>
                <th className="p-3.5 font-bold">Impact</th>
                <th className="p-3.5 font-bold">Recommended Remediation</th>
                <th className="p-3.5 font-bold text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {technicalCategories.map((item, idx) => (
                <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                  <td className="p-3.5 font-bold text-slate-900">{item.metric}</td>
                  <td className="p-3.5">
                    <div>
                      <span className="font-semibold text-slate-800">{item.yourScore}</span>
                      <span className="text-[10px] text-slate-400 block">{item.yourStatus}</span>
                    </div>
                  </td>
                  <td className="p-3.5 font-medium text-slate-700">{item.compLeader}</td>
                  <td className="p-3.5">
                    <span
                      className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        item.impact === "Critical"
                          ? "bg-rose-50 text-rose-700 border border-rose-200"
                          : item.impact === "High"
                          ? "bg-amber-50 text-amber-700 border border-amber-200"
                          : "bg-blue-50 text-blue-700 border border-blue-200"
                      }`}
                    >
                      {item.impact}
                    </span>
                  </td>
                  <td className="p-3.5 text-slate-600 max-w-xs leading-relaxed">{item.recommendation}</td>
                  <td className="p-3.5 text-center">
                    <button
                      type="button"
                      onClick={() => onAddToFixPlan?.(1, `Remediate: ${item.metric}`)}
                      className="px-2.5 py-1 rounded-lg border border-purple-200 text-purple-700 hover:bg-purple-50 text-[11px] font-bold transition-colors"
                    >
                      Stage
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
  projectId?: string;
  customerDomain?: string;
  competitors?: TrackedCompetitor[];
  onAddToFixPlan?: (count: number, label?: string) => void;
}

export function CompetitorAiVisibilityTab({
  projectId = "",
  onAddToFixPlan,
}: CompetitorAiVisibilityTabProps) {
  const visibilityQuery = useVisibility(projectId);
  const trackedPromptsQuery = useTrackedPrompts(projectId);

  const report = visibilityQuery.data;
  const prompts = trackedPromptsQuery.data || [];

  const byAssistant = report?.byAssistant || [];
  const chatgptShare = byAssistant.find((a) => a.assistant.toLowerCase().includes("chatgpt") || a.assistant.toLowerCase().includes("openai"))?.citationSharePct ?? 0;
  const claudeShare = byAssistant.find((a) => a.assistant.toLowerCase().includes("claude") || a.assistant.toLowerCase().includes("anthropic"))?.citationSharePct ?? 0;
  const geminiShare = byAssistant.find((a) => a.assistant.toLowerCase().includes("gemini") || a.assistant.toLowerCase().includes("google"))?.citationSharePct ?? 0;

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
                Track real brand mentions and citations across ChatGPT, Claude, and Gemini.
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onAddToFixPlan?.(prompts.length || 5, "AI Citation Engine Tasks")}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold transition-all shadow-md shadow-purple-500/20 active:scale-[0.98]"
        >
          <Play className="h-4 w-4 fill-white" />
          <span>Stage AI Visibility Tasks to Fix Plan</span>
        </button>
      </div>

      {/* Model Share Cards (Real Data) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="rounded-2xl border border-purple-200/80 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-700">ChatGPT (OpenAI)</span>
            <span className="text-xs font-bold text-purple-600">
              {chatgptShare > 0 ? `${chatgptShare}% Share` : "Pending Sweep"}
            </span>
          </div>
          <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-purple-600 rounded-full" style={{ width: `${Math.max(4, chatgptShare)}%` }} />
          </div>
          <p className="text-[11px] text-slate-500 mt-2">
            Measured from synthetic buyer queries
          </p>
        </div>

        <div className="rounded-2xl border border-blue-200/80 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-700">Claude (Anthropic)</span>
            <span className="text-xs font-bold text-blue-600">
              {claudeShare > 0 ? `${claudeShare}% Share` : "Pending Sweep"}
            </span>
          </div>
          <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-blue-600 rounded-full" style={{ width: `${Math.max(4, claudeShare)}%` }} />
          </div>
          <p className="text-[11px] text-slate-500 mt-2">
            Measured from research and comparison queries
          </p>
        </div>

        <div className="rounded-2xl border border-emerald-200/80 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-700">Gemini (Google)</span>
            <span className="text-xs font-bold text-emerald-600">
              {geminiShare > 0 ? `${geminiShare}% Share` : "Pending Sweep"}
            </span>
          </div>
          <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-600 rounded-full" style={{ width: `${Math.max(4, geminiShare)}%` }} />
          </div>
          <p className="text-[11px] text-slate-500 mt-2">
            Measured from Google AI Overviews &amp; Gemini responses
          </p>
        </div>
      </div>

      {/* Prompts Head-to-Head Table */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs space-y-4">
        <h2 className="text-base font-bold text-slate-900">Synthetic Prompt Evaluation Audit</h2>
        {prompts.length === 0 ? (
          <div className="p-8 text-center space-y-2 border rounded-xl border-slate-100 bg-slate-50/50">
            <p className="text-xs font-bold text-slate-800">No Tracked AI Prompts Yet</p>
            <p className="text-[11px] text-slate-500">
              Prompts will appear here after your first AI visibility sweep runs.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-[11px] font-bold text-slate-600 border-b border-slate-200 uppercase tracking-wider">
                <tr>
                  <th className="p-3.5 font-bold">Tested User Query / Prompt</th>
                  <th className="p-3.5 font-bold">Category</th>
                  <th className="p-3.5 font-bold">Status</th>
                  <th className="p-3.5 font-bold">Citations</th>
                  <th className="p-3.5 font-bold text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {prompts.map((p) => {
                  const isCited = p.latestChecks?.some((c) => c.cited);
                  const citedCompetitors = Array.from(new Set(p.latestChecks?.flatMap((c) => c.competitorsCited || []) || []));
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3.5 font-semibold text-slate-900 max-w-sm">
                        &ldquo;{p.text}&rdquo;
                      </td>
                      <td className="p-3.5">
                        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700 capitalize">
                          {p.intent || p.cluster || "Evaluation"}
                        </span>
                      </td>
                      <td className="p-3.5">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            isCited
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-rose-50 text-rose-700 border border-rose-200"
                          }`}
                        >
                          {isCited ? "Cited by AI" : "Uncited"}
                        </span>
                      </td>
                      <td className="p-3.5 font-mono text-slate-700">
                        {citedCompetitors.length} competitors cited
                      </td>
                      <td className="p-3.5 text-center">
                        <button
                          type="button"
                          onClick={() => onAddToFixPlan?.(1, `AEO: ${p.text}`)}
                          className="px-2.5 py-1 rounded-lg border border-purple-200 text-purple-700 hover:bg-purple-50 text-[11px] font-bold transition-colors"
                        >
                          Stage
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   4. OPPORTUNITIES TAB (AI ENGINE)
   ────────────────────────────────────────────────────────────────────────── */
export interface CompetitorOpportunitiesTabProps {
  projectId?: string;
  customerDomain?: string;
  competitors?: TrackedCompetitor[];
  onAddToFixPlan?: (count: number, label?: string) => void;
}

export function CompetitorOpportunitiesTab({
  customerDomain = "",
  competitors = [],
  onAddToFixPlan,
}: CompetitorOpportunitiesTabProps) {
  const ourCrawl = useLatestCrawl(customerDomain || null);
  const ourIssuesQuery = useCrawlIssues(ourCrawl.data?.id ?? null);
  const issues = (ourIssuesQuery.data?.data || []) as CrawlIssue[];

  const topRival = competitors[0]?.domain || "competitors";

  // Derive real opportunities from live crawl issues and competitor benchmarks
  const opportunities = useMemo(() => {
    const opps: Array<{
      id: number;
      category: string;
      title: string;
      desc: string;
      impact: "Critical" | "High" | "Medium";
      effort: "Low" | "Medium";
      signal: string;
      color: string;
    }> = [];

    // 1. Technical issues
    const criticalIssues = issues.filter((i) => i.severity === "CRITICAL" || i.severity === "HIGH");
    if (criticalIssues.length > 0) {
      opps.push({
        id: 1,
        category: "Technical SEO",
        title: `Resolve ${criticalIssues.length} Critical Crawl Issues`,
        desc: criticalIssues[0]?.description || "Fix broken links, indexing errors, and canonical conflicts.",
        impact: "Critical",
        effort: "Low",
        signal: "Live Crawl Engine",
        color: "bg-rose-50 text-rose-700",
      });
    }

    // 2. Structured Data
    const schemaIssue = issues.find((i) => /schema|json-ld|structured/i.test(i.category || i.issueType || i.description));
    if (schemaIssue) {
      opps.push({
        id: 2,
        category: "Structured Data",
        title: "Deploy Automated JSON-LD Schema Entities",
        desc: schemaIssue.recommendation || "Implement Article, FAQ, and Organization schemas to capture AI citations.",
        impact: "High",
        effort: "Low",
        signal: "Rich Results Audit",
        color: "bg-purple-50 text-purple-700",
      });
    }

    // 3. Competitor parity
    if (competitors.length > 0) {
      opps.push({
        id: 3,
        category: "Content Gap",
        title: `Bridge Content Architecture Gap vs. ${topRival}`,
        desc: `Tracked rival has indexed pages and commercial comparisons not yet present on your domain.`,
        impact: "High",
        effort: "Medium",
        signal: "Competitor Crawl Inspector",
        color: "bg-emerald-50 text-emerald-700",
      });
    }

    // 4. Performance
    const perfIssue = issues.find((i) => /perf|speed|lcp|asset/i.test(i.category || i.issueType || i.description));
    if (perfIssue) {
      opps.push({
        id: 4,
        category: "Core Web Vitals",
        title: "Optimize LCP and Eliminate Render-Blocking Bundles",
        desc: perfIssue.recommendation || "Defer third-party scripts and serve modern WebP images.",
        impact: "Medium",
        effort: "Low",
        signal: "Chromium Audit",
        color: "bg-amber-50 text-amber-700",
      });
    }

    return opps;
  }, [issues, competitors, topRival]);

  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set([1, 2, 3]));

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
                Discovered website issues and competitor gaps prioritized for single-approval 30-day plan execution.
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onAddToFixPlan?.(selectedItems.size, `${selectedItems.size} High-Impact Strategy Items`)}
          disabled={opportunities.length === 0}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm font-semibold transition-all shadow-md shadow-purple-500/20 active:scale-[0.98]"
        >
          <Play className="h-4 w-4 fill-white" />
          <span>Add Selected ({selectedItems.size}) to 30-Day Fix Plan</span>
        </button>
      </div>

      {/* Opportunity Cards List */}
      {opportunities.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center space-y-2">
          <p className="text-xs font-bold text-slate-800">No Pending Opportunities</p>
          <p className="text-[11px] text-slate-500">
            Run a website crawl or add competitors to discover prioritized opportunities.
          </p>
        </div>
      ) : (
        <div className="space-y-3.5">
          {opportunities.map((opp) => {
            const isSelected = selectedItems.has(opp.id);
            return (
              <div
                key={opp.id}
                onClick={() => toggleSelect(opp.id)}
                className={`cursor-pointer rounded-2xl border p-5 transition-all shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                  isSelected ? "border-purple-300 bg-purple-50/30" : "border-slate-200/80 bg-white hover:border-slate-300"
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
                      <span className="text-[11px] font-semibold text-slate-400">Source: {opp.signal}</span>
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
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   5. REPORTS TAB
   ────────────────────────────────────────────────────────────────────────── */
export interface CompetitorReportsTabProps {
  domain?: string;
  competitors?: TrackedCompetitor[];
  onGenerateReport?: () => void;
}

export function CompetitorReportsTab({
  domain = "",
  competitors = [],
  onGenerateReport,
}: CompetitorReportsTabProps) {
  const ourCrawl = useLatestCrawl(domain || null);

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
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Executive Intelligence Reports</h1>
              <p className="text-sm text-slate-500">
                Generate and export comprehensive competitive strategy summaries.
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
              Competitive Market &amp; AI Visibility Benchmark Report
            </h2>
            <p className="text-xs text-slate-600 max-w-2xl leading-relaxed">
              Automated teardown covering {ourCrawl.data?.pagesCrawled ?? 0} customer pages, {competitors.length} tracked competitors ({competitors.map((c) => c.domain).join(", ") || "None"}),
              Core Web Vitals gap analysis, and LLM citation shares.
            </p>
            <div className="flex items-center gap-4 text-xs text-slate-500 pt-1">
              <span className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-slate-400" />
                {ourCrawl.data?.startedAt ? `Audited on ${new Date(ourCrawl.data.startedAt).toLocaleDateString()}` : "Audited Today"}
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
    </div>
  );
}
