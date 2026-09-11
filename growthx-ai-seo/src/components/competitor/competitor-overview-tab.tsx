"use client";

import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
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
  AlertTriangle,
  Layers,
  Bot,
} from "lucide-react";
import { AiKpiCard } from "@/components/ai-visibility/ai-kpi-card";
import { api, type TrackedCompetitor, type CrawlIssue } from "@/lib/api-client";
import { useLatestCrawl, useCrawlPages, useCrawlIssues, useVisibility } from "@/hooks/use-growthx";
import { buildKeywordProfiles, titleCase } from "@/lib/keyword-extractor";

export interface CompetitorOverviewTabProps {
  projectId?: string;
  domain?: string;
  competitors?: TrackedCompetitor[];
  onAddCompetitor?: () => void;
  onGenerateInsights?: () => void;
  onViewAllKeywordGaps?: () => void;
  onViewAllContentGaps?: () => void;
  onGenerateReport?: () => void;
}

const COMPETITOR_DOT_COLORS = [
  "bg-purple-600",
  "bg-blue-600",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-rose-500",
];

export function CompetitorOverviewTab({
  projectId = "",
  domain = "",
  competitors = [],
  onAddCompetitor,
  onGenerateInsights,
  onViewAllKeywordGaps,
  onViewAllContentGaps,
  onGenerateReport,
}: CompetitorOverviewTabProps) {
  const [metricTab, setMetricTab] = useState<"pages" | "health" | "ai">("pages");

  // 1. Fetch Real Customer Crawl & Issues
  const ourCrawl = useLatestCrawl(domain || null);
  const ourPagesQuery = useCrawlPages(ourCrawl.data?.id ?? null, ourCrawl.data?.status);
  const ourIssuesQuery = useCrawlIssues(ourCrawl.data?.id ?? null);
  const visibilityQuery = useVisibility(projectId);

  // 2. Fetch First Competitor Pages for Gap Samples
  const primaryComp = competitors[0] || null;
  const compPagesQuery = useQuery({
    queryKey: ["competitor-pages", projectId, primaryComp?.id],
    queryFn: () => api.listCompetitorPages(projectId, primaryComp!.id),
    enabled: Boolean(projectId && primaryComp?.id),
    staleTime: 30000,
  });

  // Extract Real Keyword Gaps for the preview table
  const previewKeywordGaps = useMemo(() => {
    const ourProfiles = buildKeywordProfiles(ourPagesQuery.data?.data || []);
    const compProfiles = buildKeywordProfiles(compPagesQuery.data || []);
    const gaps: Array<{
      keyword: string;
      yourPos: string;
      topComp: string;
      compPos: number;
      vol: string;
      opp: "High" | "Medium";
    }> = [];

    const compDomain = primaryComp?.domain || "competitor.com";

    compProfiles.forEach((prof, kw) => {
      if (gaps.length >= 5) return;
      if (!ourProfiles.has(kw)) {
        const estVol = (prof.totalOccurrences * 400 + prof.placements.inH1 * 800).toLocaleString();
        gaps.push({
          keyword: titleCase(kw),
          yourPos: "—",
          topComp: compDomain,
          compPos: prof.placements.inH1 > 0 ? 3 : 5,
          vol: estVol,
          opp: prof.searchIntent === "COMMERCIAL" ? "High" : "Medium",
        });
      }
    });

    return gaps;
  }, [ourPagesQuery.data, compPagesQuery.data, primaryComp]);

  // Extract Real Content Gaps for preview table
  const previewContentGaps = useMemo(() => {
    const ourPages = ourPagesQuery.data?.data || [];
    const compPages = compPagesQuery.data || [];
    const compDomain = primaryComp?.domain || "competitor.com";
    const ourTexts = ourPages.map((p) => `${p.title || ""} ${p.url || ""}`.toLowerCase());

    const gaps: Array<{ topic: string; topComp: string; opp: "High" | "Medium" }> = [];

    compPages.forEach((p) => {
      if (gaps.length >= 5) return;
      let rawH1 = "";
      if (Array.isArray(p.h1) && p.h1.length > 0) rawH1 = p.h1[0];
      else if (typeof p.h1 === "string") rawH1 = p.h1;
      const topic = rawH1 || p.title || "";
      if (!topic || topic.length < 5) return;

      const cleanTopic = topic.replace(/(\||-)\s*([A-Za-z0-9_.\s]+)$/, "").trim();
      const match = ourTexts.some((t) => t.includes(cleanTopic.toLowerCase().slice(0, 20)));
      if (!match) {
        gaps.push({
          topic: titleCase(cleanTopic),
          topComp: compDomain,
          opp: /vs|guide|case-study/i.test(topic) ? "High" : "Medium",
        });
      }
    });

    return gaps;
  }, [ourPagesQuery.data, compPagesQuery.data, primaryComp]);

  // Real Top Opportunities derived from Crawl Issues & Competitor Findings
  const topOpportunities = useMemo(() => {
    const items: Array<{ id: number; title: string; desc: string }> = [];

    // Technical crawl issues
    const rawIssues = (ourIssuesQuery.data?.data || []) as CrawlIssue[];
    const criticalIssues = rawIssues.filter((i) => i.severity === "CRITICAL" || i.severity === "HIGH");
    if (criticalIssues.length > 0) {
      items.push({
        id: 1,
        title: `Remediate ${criticalIssues.length} high-severity technical crawl issues`,
        desc: criticalIssues[0]?.description || "Resolve indexing blockers, canonical issues, and metadata errors.",
      });
    }

    // Keyword gap
    if (previewKeywordGaps.length > 0) {
      items.push({
        id: 2,
        title: `Target missing high-intent keyword "${previewKeywordGaps[0].keyword}"`,
        desc: `Competitor ${primaryComp?.domain} ranks prominently while your site does not yet index this term.`,
      });
    }

    // Content gap
    if (previewContentGaps.length > 0) {
      items.push({
        id: 3,
        title: `Create dedicated content hub for "${previewContentGaps[0].topic}"`,
        desc: `Rivals have dedicated pages for this topic capturing organic conversion intent.`,
      });
    }

    // AI Visibility
    const citedPct = visibilityQuery.data?.summary?.citationSharePct;
    if (citedPct !== undefined) {
      items.push({
        id: 4,
        title: `Improve LLM citation share (Currently ${citedPct}%)`,
        desc: "Deploy Article & FAQPage JSON-LD schemas to win direct ChatGPT, Claude, and Gemini citations.",
      });
    } else {
      items.push({
        id: 4,
        title: "Run initial AI Visibility sweep",
        desc: "Measure your brand's citation presence in ChatGPT, Claude, and Gemini against competitors.",
      });
    }

    // Parity
    if (primaryComp) {
      items.push({
        id: 5,
        title: `Benchmark architecture against ${primaryComp.domain}`,
        desc: `Rival has ${primaryComp.pagesCrawled ?? 0} pages indexed. Bridge structure & internal link gaps.`,
      });
    }

    return items;
  }, [ourIssuesQuery.data, previewKeywordGaps, previewContentGaps, visibilityQuery.data, primaryComp]);

  // Derived real measurements
  const customerPagesCount = ourCrawl.data?.pagesCrawled ?? ourPagesQuery.data?.data?.length ?? 0;
  const customerHealthScore = ourCrawl.data?.healthScore !== undefined ? String(ourCrawl.data.healthScore) : "—";
  const openIssuesCount = ourCrawl.data?.issuesFound ?? ourIssuesQuery.data?.meta?.total ?? ourIssuesQuery.data?.data?.length ?? 0;
  const aiVisibilityPct = visibilityQuery.data?.summary?.citationSharePct != null
    ? `${visibilityQuery.data.summary.citationSharePct}%`
    : "—";

  return (
    <div className="space-y-6">
      {/* ── ACTIVE COMPETITORS CHIP STRIP ── */}
      <div className="flex flex-wrap items-center gap-2.5">
        {/* Your site chip */}
        <div className="flex items-center gap-2 rounded-xl px-3 py-2 text-[12px] border bg-blue-50/70 border-blue-200 text-blue-950 font-bold shadow-2xs">
          <span className="h-2.5 w-2.5 rounded-full bg-blue-600 shrink-0" />
          <span className="truncate">Your Website ({domain || "Active"})</span>
        </div>

        {/* Real competitor chips */}
        {competitors.map((comp, idx) => (
          <div
            key={comp.id}
            className="flex items-center gap-2 rounded-xl px-3 py-2 text-[12px] border bg-white border-slate-200/80 text-slate-700 font-medium hover:bg-slate-50 shadow-2xs transition-all"
          >
            <span
              className={`h-2.5 w-2.5 rounded-full ${COMPETITOR_DOT_COLORS[idx % COMPETITOR_DOT_COLORS.length]} shrink-0`}
            />
            <span className="truncate">{comp.name ? `${comp.name} (${comp.domain})` : comp.domain}</span>
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

      {/* ── 5 KPI METRIC CARDS (All Real Crawler Measurements) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <AiKpiCard
          label="Pages Crawled"
          value={customerPagesCount > 0 ? customerPagesCount.toLocaleString() : "0"}
          subtext="Your verified crawled pages"
          icon={<Globe size={16} />}
          iconBgColor="bg-blue-50 text-blue-600"
          colorScheme="blue"
        />

        <AiKpiCard
          label="Site SEO Health"
          value={customerHealthScore}
          subtext="Automated crawler audit score"
          icon={<Shield size={16} />}
          iconBgColor="bg-purple-50 text-purple-600"
          colorScheme="purple"
        />

        <AiKpiCard
          label="Open Crawl Issues"
          value={openIssuesCount.toLocaleString()}
          subtext="Actionable remediation items"
          icon={<AlertTriangle size={16} />}
          iconBgColor="bg-rose-50 text-rose-600"
          colorScheme="coral"
        />

        <AiKpiCard
          label="AI Visibility Share"
          value={aiVisibilityPct}
          subtext="Tracked LLM response mentions"
          icon={<Sparkles size={16} />}
          iconBgColor="bg-emerald-50 text-emerald-600"
          colorScheme="emerald"
        />

        <AiKpiCard
          label="Tracked Rivals"
          value={competitors.length.toString()}
          subtext="Active competitor benchmarks"
          icon={<Crosshair size={16} />}
          iconBgColor="bg-amber-50 text-amber-600"
          colorScheme="orange"
        />
      </div>

      {/* ── MIDDLE ROW: Competitive Benchmarking (70%) + Model Citations (30%) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Competitor Head-to-Head Comparison (Col span 7) */}
        <div className="lg:col-span-7 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <h3 className="text-[14.5px] font-bold text-slate-900">Competitive Architecture Benchmark</h3>

              <div className="flex items-center gap-2">
                <div className="flex items-center rounded-lg border border-slate-200 p-0.5 bg-slate-50 text-[11px] font-semibold">
                  <button
                    type="button"
                    onClick={() => setMetricTab("pages")}
                    className={`rounded-md px-2.5 py-1 transition-colors ${
                      metricTab === "pages" ? "bg-purple-600 text-white shadow-2xs" : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Pages Crawled
                  </button>
                  <button
                    type="button"
                    onClick={() => setMetricTab("health")}
                    className={`rounded-md px-2.5 py-1 transition-colors ${
                      metricTab === "health" ? "bg-purple-600 text-white shadow-2xs" : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    SEO Health
                  </button>
                  <button
                    type="button"
                    onClick={() => setMetricTab("ai")}
                    className={`rounded-md px-2.5 py-1 transition-colors ${
                      metricTab === "ai" ? "bg-purple-600 text-white shadow-2xs" : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    AI Share
                  </button>
                </div>
              </div>
            </div>

            {/* Dynamic Comparison Bars */}
            <div className="mt-5 space-y-4">
              {/* Your site */}
              <div>
                <div className="flex items-center justify-between text-xs font-bold mb-1">
                  <span className="text-blue-700 flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-blue-600" />
                    <span>Your Website ({domain})</span>
                  </span>
                  <span className="text-slate-900 font-mono">
                    {metricTab === "pages"
                      ? `${customerPagesCount} pages`
                      : metricTab === "health"
                      ? `${customerHealthScore} / 100`
                      : aiVisibilityPct}
                  </span>
                </div>
                <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-600 rounded-full"
                    style={{
                      width: `${
                        metricTab === "pages"
                          ? Math.min(100, Math.max(12, (customerPagesCount / 200) * 100))
                          : metricTab === "health" && ourCrawl.data?.healthScore
                          ? ourCrawl.data.healthScore
                          : 40
                      }%`,
                    }}
                  />
                </div>
              </div>

              {/* Competitors */}
              {competitors.map((comp, idx) => {
                const pagesVal = comp.pagesCrawled ?? 0;
                const healthVal = comp.healthScore ?? 0;
                const aiVal = comp.aiCitationSharePct ?? 0;

                const displayVal =
                  metricTab === "pages"
                    ? `${pagesVal} pages`
                    : metricTab === "health"
                    ? healthVal > 0
                      ? `${healthVal} / 100`
                      : "Pending crawl"
                    : `${aiVal}%`;

                const pct =
                  metricTab === "pages"
                    ? Math.min(100, Math.max(10, (pagesVal / 200) * 100))
                    : metricTab === "health" && healthVal > 0
                    ? healthVal
                    : 35;

                return (
                  <div key={comp.id}>
                    <div className="flex items-center justify-between text-xs font-semibold mb-1">
                      <span className="text-slate-700 flex items-center gap-1.5">
                        <span
                          className={`h-2 w-2 rounded-full ${
                            COMPETITOR_DOT_COLORS[idx % COMPETITOR_DOT_COLORS.length]
                          }`}
                        />
                        <span className="truncate">{comp.domain}</span>
                      </span>
                      <span className="text-slate-600 font-mono text-[11px]">{displayVal}</span>
                    </div>
                    <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${COMPETITOR_DOT_COLORS[idx % COMPETITOR_DOT_COLORS.length]} rounded-full`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}

              {competitors.length === 0 && (
                <div className="p-4 text-center text-xs text-slate-500 bg-slate-50 rounded-xl">
                  No competitors added yet. Add a competitor domain to compare pages and health scores.
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
            <span>Verified crawler metrics</span>
            <span>Real-time benchmark</span>
          </div>
        </div>

        {/* Right: AI Model Distribution (Col span 5) */}
        <div className="lg:col-span-5 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-[14px] font-bold text-slate-900">AI Platform Citations</h3>
              <span className="text-[11px] text-purple-700 font-semibold bg-purple-50 px-2 py-0.5 rounded-md">
                Verified LLMs
              </span>
            </div>

            <div className="mt-4 space-y-4">
              {visibilityQuery.data?.byAssistant && visibilityQuery.data.byAssistant.length > 0 ? (
                visibilityQuery.data.byAssistant.map((asst) => (
                  <div key={asst.assistant} className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-slate-800">{asst.assistant}</span>
                      <span className="text-purple-700 font-bold">{asst.citationSharePct}% citation share</span>
                    </div>
                    <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-purple-600 rounded-full"
                        style={{ width: `${Math.max(4, asst.citationSharePct)}%` }}
                      />
                    </div>
                    <div className="text-[10.5px] text-slate-400">
                      Cited {asst.cited} times of {asst.checked} checked queries
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-6 text-center space-y-2 border rounded-xl border-dashed border-slate-200 bg-slate-50/50">
                  <Bot className="h-6 w-6 text-purple-600 mx-auto" />
                  <p className="text-xs font-bold text-slate-800">No AI Sweep Run Yet</p>
                  <p className="text-[11px] text-slate-500">
                    Run an AI Visibility sweep to measure citations in ChatGPT, Claude, and Gemini.
                  </p>
                </div>
              )}
            </div>
          </div>

          <p className="text-center text-[10.5px] text-slate-400 pt-3 border-t border-slate-100 mt-4">
            Direct citation share measured from synthetic test queries
          </p>
        </div>
      </div>

      {/* ── BOTTOM ROW: Keyword Gap + Content Gap + Top Opportunities ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Card 1: Keyword Gap Preview */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 pb-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-purple-50 text-purple-600">
                <Search size={14} />
              </div>
              <div>
                <h4 className="text-[13.5px] font-bold text-slate-900 leading-none">Keyword Gaps</h4>
                <p className="mt-1 text-[11px] text-slate-500">
                  Extracted from live competitor crawls
                </p>
              </div>
            </div>

            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-[11.5px]">
                <thead>
                  <tr className="border-b border-slate-100 text-[10px] font-medium text-slate-400">
                    <th className="py-2 pl-1 font-medium">Keyword</th>
                    <th className="py-2 font-medium">Rival</th>
                    <th className="py-2 pr-1 text-right font-medium">Priority</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {previewKeywordGaps.length > 0 ? (
                    previewKeywordGaps.map((k) => (
                      <tr key={k.keyword} className="hover:bg-slate-50/70">
                        <td className="py-2 pl-1 font-medium text-slate-800 truncate max-w-[120px]">
                          {k.keyword}
                        </td>
                        <td className="py-2 text-slate-600 truncate max-w-[80px]">{k.topComp}</td>
                        <td className="py-2 pr-1 text-right">
                          <span
                            className={`inline-block rounded-md px-1.5 py-0.5 text-[9.5px] font-bold border ${
                              k.opp === "High"
                                ? "bg-rose-50 text-rose-700 border-rose-200"
                                : "bg-amber-50 text-amber-700 border-amber-200"
                            }`}
                          >
                            {k.opp}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={3} className="py-4 text-center text-slate-400 text-xs">
                        {competitors.length === 0 ? "Add a competitor to audit keywords" : "Crawling keywords..."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <button
            type="button"
            onClick={onViewAllKeywordGaps}
            className="mt-4 flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-[11.5px] font-semibold text-slate-700 hover:bg-purple-50 hover:text-purple-700 hover:border-purple-200 transition-colors"
          >
            <span>View All Keyword Gaps</span>
            <ArrowRight size={13} />
          </button>
        </div>

        {/* Card 2: Content Gap Preview */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 pb-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-50 text-blue-600">
                <FileText size={14} />
              </div>
              <div>
                <h4 className="text-[13.5px] font-bold text-slate-900 leading-none">Content Gaps</h4>
                <p className="mt-1 text-[11px] text-slate-500">Missing pages found on rival sites</p>
              </div>
            </div>

            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-[11.5px]">
                <thead>
                  <tr className="border-b border-slate-100 text-[10px] font-medium text-slate-400">
                    <th className="py-2 pl-1 font-medium">Topic / Page</th>
                    <th className="py-2 font-medium">Rival</th>
                    <th className="py-2 pr-1 text-right font-medium">Priority</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {previewContentGaps.length > 0 ? (
                    previewContentGaps.map((c) => (
                      <tr key={c.topic} className="hover:bg-slate-50/70">
                        <td className="py-2 pl-1 font-medium text-slate-800 truncate max-w-[120px]">
                          {c.topic}
                        </td>
                        <td className="py-2 text-slate-600 truncate max-w-[80px]">{c.topComp}</td>
                        <td className="py-2 pr-1 text-right">
                          <span
                            className={`inline-block rounded-md px-1.5 py-0.5 text-[9.5px] font-bold border ${
                              c.opp === "High"
                                ? "bg-rose-50 text-rose-700 border-rose-200"
                                : "bg-amber-50 text-amber-700 border-amber-200"
                            }`}
                          >
                            {c.opp}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={3} className="py-4 text-center text-slate-400 text-xs">
                        {competitors.length === 0 ? "Add a competitor to audit content" : "Auditing content hubs..."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <button
            type="button"
            onClick={onViewAllContentGaps}
            className="mt-4 flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-[11.5px] font-semibold text-slate-700 hover:bg-purple-50 hover:text-purple-700 hover:border-purple-200 transition-colors"
          >
            <span>View All Content Gaps</span>
            <ArrowRight size={13} />
          </button>
        </div>

        {/* Card 3: Top Opportunities (Crawl + Fix Engine Ready) */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 pb-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-50 text-amber-600">
                <Sparkles size={14} />
              </div>
              <div>
                <h4 className="text-[13.5px] font-bold text-slate-900 leading-none">Top Opportunities</h4>
                <p className="mt-1 text-[11px] text-slate-500">
                  Ready to stage into your 30-day plan
                </p>
              </div>
            </div>

            <div className="mt-3 space-y-2">
              {topOpportunities.map((opp) => (
                <div
                  key={opp.id}
                  className="rounded-xl border border-slate-100 bg-slate-50/60 p-2.5 hover:bg-purple-50/40 hover:border-purple-100 transition-colors"
                >
                  <p className="text-[12px] font-bold text-slate-900">{opp.title}</p>
                  <p className="mt-0.5 text-[11px] text-slate-500 leading-snug line-clamp-2">{opp.desc}</p>
                </div>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={onGenerateInsights}
            className="mt-4 flex items-center justify-center gap-1.5 rounded-xl bg-purple-600 py-2.5 text-[12px] font-bold text-white hover:bg-purple-700 transition shadow-xs"
          >
            <Sparkles size={13} />
            <span>Add All Opportunities to Fix Plan</span>
          </button>
        </div>
      </div>
    </div>
  );
}
