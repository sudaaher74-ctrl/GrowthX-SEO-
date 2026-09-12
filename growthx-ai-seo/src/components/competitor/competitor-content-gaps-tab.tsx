"use client";

import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  FileText,
  Download,
  Play,
  Database,
  AlertCircle,
  Sparkles,
  PieChart as PieChartIcon,
  Bot,
  Lightbulb,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  ArrowRight,
  Search,
  Loader2,
  Globe,
  ExternalLink,
} from "lucide-react";
import { api, type TrackedCompetitor, type CrawlPage } from "@/lib/api-client";
import { useLatestCrawl, useCrawlPages } from "@/hooks/use-growthx";
import { extractPhrasesFromText, titleCase } from "@/lib/keyword-extractor";

export interface CompetitorContentGapsTabProps {
  projectId?: string;
  customerDomain?: string;
  competitors?: TrackedCompetitor[];
  onAddToFixPlan?: (count: number, label?: string) => void;
  onExport?: () => void;
}

export interface ContentGapItem {
  id: string;
  topic: string;
  contentType: "Guide" | "Comparison" | "Case Study" | "Template" | "How-to";
  competitors: Array<{ initial: string; bg: string; name: string }>;
  moreCompetitorsCount: number;
  yourCoverage: "Missing" | "Partial" | "Weak";
  searchVolume: number;
  aiPotential: "High" | "Medium";
  opportunity: "High" | "Medium" | "Low";
  sourceUrl?: string;
}

const COMPETITOR_AVATARS: Record<number, { bg: string }> = {
  0: { bg: "bg-purple-600" },
  1: { bg: "bg-blue-600" },
  2: { bg: "bg-emerald-500" },
  3: { bg: "bg-amber-500" },
  4: { bg: "bg-rose-500" },
};

function inferContentType(page: Pick<CrawlPage, "url" | "title" | "pageType" | "h1">): "Guide" | "Comparison" | "Case Study" | "Template" | "How-to" {
  const text = `${page.url} ${page.title || ""} ${Array.isArray(page.h1) ? page.h1.join(" ") : page.h1 || ""}`.toLowerCase();
  if (/vs|comparison|alternative|competitor|compare/i.test(text)) return "Comparison";
  if (/case-study|customer-story|results|success-story/i.test(text)) return "Case Study";
  if (/template|checklist|calculator|worksheet/i.test(text)) return "Template";
  if (/how-to|step-by-step|tutorial|walkthrough/i.test(text)) return "How-to";
  return "Guide";
}

export function CompetitorContentGapsTab({
  projectId = "",
  customerDomain = "",
  competitors = [],
  onAddToFixPlan,
  onExport,
}: CompetitorContentGapsTabProps) {
  // Selected competitor
  const [selectedCompetitorDomain, setSelectedCompetitorDomain] = useState<string>("all");
  const [selectedCompetitorId, setSelectedCompetitorId] = useState<string>(
    competitors[0]?.id || "",
  );

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedContentType, setSelectedContentType] = useState("all");
  const [selectedCoverage, setSelectedCoverage] = useState("all");
  const [selectedAiPotential, setSelectedAiPotential] = useState("all");
  const [selectedOpportunity, setSelectedOpportunity] = useState("all");
  const [sortBy, setSortBy] = useState<"opp-desc" | "vol-desc">("opp-desc");

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  // 1. Fetch Customer Crawl Pages
  const ourCrawl = useLatestCrawl(customerDomain || null);
  const ourPagesQuery = useCrawlPages(ourCrawl.data?.id ?? null, ourCrawl.data?.status);

  // Active competitor object
  const activeCompetitor = useMemo(() => {
    if (selectedCompetitorDomain !== "all") {
      return competitors.find((c) => c.domain === selectedCompetitorDomain) || competitors[0] || null;
    }
    return competitors.find((c) => c.id === selectedCompetitorId) || competitors[0] || null;
  }, [competitors, selectedCompetitorDomain, selectedCompetitorId]);

  // 2. Fetch Active Competitor Crawl Pages
  const competitorPagesQuery = useQuery({
    queryKey: ["competitor-pages", projectId, activeCompetitor?.id],
    queryFn: () => api.listCompetitorPages(projectId, activeCompetitor!.id),
    enabled: Boolean(projectId && activeCompetitor?.id),
    staleTime: 30000,
  });

  // 3. Extract Real Content Gaps by Comparing Page Hierarchies
  const realContentGaps = useMemo<ContentGapItem[]>(() => {
    const ourPages = ourPagesQuery.data?.data || [];
    const compPages = competitorPagesQuery.data || [];
    const compDomain = activeCompetitor?.domain || "competitor.com";

    // Build customer title & path search index
    const ourTitlesAndUrls = ourPages.map((p) => `${p.title || ""} ${p.url || ""}`.toLowerCase());

    const items: ContentGapItem[] = [];

    compPages.forEach((page, index) => {
      // Determine clean topic title from H1 or page title or URL slug
      let rawH1 = "";
      if (Array.isArray(page.h1) && page.h1.length > 0) rawH1 = page.h1[0];
      else if (typeof page.h1 === "string") rawH1 = page.h1;

      let topic = rawH1 || page.title || "";
      if (!topic || topic.length < 3) {
        try {
          const parts = new URL(page.url).pathname.split("/").filter(Boolean);
          topic = parts.pop()?.replace(/[-_]+/g, " ") || page.url;
        } catch {
          topic = page.url;
        }
      }

      // Remove generic brand suffixes (e.g. "| Semrush", "- Ahrefs")
      topic = topic.replace(/(\||-)\s*([A-Za-z0-9_.\s]+)$/, "").trim();
      if (!topic || topic.length < 3) return;

      const contentType = inferContentType(page);
      const lowerTopic = topic.toLowerCase();

      // Check if our site covers this topic
      const ourMatchIndex = ourTitlesAndUrls.findIndex((t) => t.includes(lowerTopic.slice(0, 20)));
      let coverage: "Missing" | "Partial" | "Weak" = "Missing";
      if (ourMatchIndex >= 0) {
        const matchingPage = ourPages[ourMatchIndex];
        const sameType = (matchingPage.pageType || "").toUpperCase() === (page.pageType || "").toUpperCase();
        coverage = sameType ? "Weak" : "Partial";
      }

      // Estimate search volume and AI potential
      const phrases = extractPhrasesFromText(topic);
      const searchVolume = 1200 + phrases.length * 650 + (contentType === "Comparison" ? 1800 : 0);
      const aiPotential: "High" | "Medium" = contentType === "Comparison" || contentType === "Guide" ? "High" : "Medium";

      let opportunity: "High" | "Medium" | "Low" = "Medium";
      if (coverage === "Missing" && (contentType === "Comparison" || contentType === "Guide")) {
        opportunity = "High";
      } else if (coverage === "Weak") {
        opportunity = "Low";
      }

      items.push({
        id: `cg-${index}-${topic.slice(0, 24).replace(/\s+/g, "-")}`,
        topic,
        contentType,
        competitors: [
          {
            initial: (compDomain[0] || "C").toUpperCase(),
            bg: COMPETITOR_AVATARS[0].bg,
            name: compDomain,
          },
        ],
        moreCompetitorsCount: Math.max(0, competitors.length - 1),
        yourCoverage: coverage,
        searchVolume,
        aiPotential,
        opportunity,
        sourceUrl: page.url,
      });
    });

    return items;
  }, [competitorPagesQuery.data, ourPagesQuery.data, activeCompetitor, competitors]);

  // Filtered and Sorted
  const filteredGaps = useMemo(() => {
    return realContentGaps
      .filter((item) => {
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          if (!item.topic.toLowerCase().includes(q) && !item.contentType.toLowerCase().includes(q)) {
            return false;
          }
        }
        if (selectedContentType !== "all" && item.contentType !== selectedContentType) {
          return false;
        }
        if (selectedCoverage !== "all" && item.yourCoverage !== selectedCoverage) {
          return false;
        }
        if (selectedAiPotential !== "all" && item.aiPotential !== selectedAiPotential) {
          return false;
        }
        if (selectedOpportunity !== "all" && item.opportunity !== selectedOpportunity) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === "vol-desc") return b.searchVolume - a.searchVolume;
        const weight = { High: 3, Medium: 2, Low: 1 };
        return weight[b.opportunity] - weight[a.opportunity];
      });
  }, [
    realContentGaps,
    searchQuery,
    selectedContentType,
    selectedCoverage,
    selectedAiPotential,
    selectedOpportunity,
    sortBy,
  ]);

  // Derived Real KPIs
  const totalCompTopics = realContentGaps.length;
  const missingCount = realContentGaps.filter((g) => g.yourCoverage === "Missing").length;
  const highPriorityCount = realContentGaps.filter((g) => g.opportunity === "High").length;
  const recommendedPagesCount = Math.min(missingCount, 30);
  const coveredCount = Math.max(0, totalCompTopics - missingCount);
  const coverageRatioPct =
    totalCompTopics > 0 ? Math.round((coveredCount / totalCompTopics) * 100) : 0;

  // Pagination
  const totalPages = Math.ceil(filteredGaps.length / pageSize) || 1;
  const paginatedGaps = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredGaps.slice(start, start + pageSize);
  }, [filteredGaps, currentPage, pageSize]);

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredGaps.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredGaps.map((g) => g.id)));
    }
  };

  const toggleSelectRow = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleResetFilters = () => {
    setSearchQuery("");
    setSelectedCompetitorDomain("all");
    setSelectedContentType("all");
    setSelectedCoverage("all");
    setSelectedAiPotential("all");
    setSelectedOpportunity("all");
    setSortBy("opp-desc");
    setCurrentPage(1);
  };

  const handleAddSelected = () => {
    const count = selectedIds.size > 0 ? selectedIds.size : Math.min(filteredGaps.length, 25);
    const label = selectedIds.size > 0 ? `${selectedIds.size} Content Gaps` : `${count} High-Impact Content Gaps`;
    onAddToFixPlan?.(count, label);
  };

  // Truthful check: are any competitors tracked?
  if (competitors.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center space-y-3">
        <div className="h-12 w-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center mx-auto">
          <Globe className="h-6 w-6" />
        </div>
        <h3 className="text-base font-bold text-slate-900">No Competitors Tracked Yet</h3>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          Add competitors to analyze topic coverage, page archetypes, and missing guide/comparison pages.
        </p>
      </div>
    );
  }

  const isCompetitorCrawling =
    competitorPagesQuery.isLoading ||
    activeCompetitor?.crawlStatus === "IN_PROGRESS" ||
    activeCompetitor?.crawlStatus === "QUEUED";

  return (
    <div className="space-y-6">
      {/* ── HEADER WITH ACTIONS ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="h-10 w-10 rounded-xl bg-purple-100 flex items-center justify-center text-purple-700 shadow-2xs">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Content Gap Intelligence</h1>
              <p className="text-sm text-slate-500">
                Comparing page topics against{" "}
                <strong className="text-slate-800">{activeCompetitor?.domain}</strong>
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onExport}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-purple-200 bg-white text-purple-700 hover:bg-purple-50 text-sm font-semibold transition-all shadow-2xs"
          >
            <Download className="h-4 w-4" />
            <span>Export</span>
          </button>

          <button
            type="button"
            onClick={handleAddSelected}
            disabled={filteredGaps.length === 0}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm font-semibold transition-all shadow-md shadow-purple-500/20 active:scale-[0.98]"
          >
            <Play className="h-4 w-4 fill-white" />
            <span>Add Selected to Fix Plan</span>
          </button>
        </div>
      </div>

      {/* ── 5 KPI CARDS ROW (Live Crawler Metrics) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Competitor Topics */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <Database className="h-5 w-5" />
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-900 tracking-tight">
                {totalCompTopics.toLocaleString()}
              </div>
              <div className="text-[12px] font-medium text-slate-500">Competitor Pages Analyzed</div>
            </div>
          </div>
          <div className="mt-3 text-[11px] font-medium text-slate-400">
            From {activeCompetitor?.domain}
          </div>
        </div>

        {/* Missing Topics */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-red-50 text-red-500 flex items-center justify-center shrink-0">
              <AlertCircle className="h-5 w-5" />
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-900 tracking-tight">
                {missingCount.toLocaleString()}
              </div>
              <div className="text-[12px] font-medium text-slate-500">Missing Content Topics</div>
            </div>
          </div>
          <div className="mt-3 text-[11px] font-medium text-red-600">
            Zero matching pages on your site
          </div>
        </div>

        {/* High-Priority Opportunities */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-900 tracking-tight">
                {highPriorityCount.toLocaleString()}
              </div>
              <div className="text-[12px] font-medium text-slate-500">High-Priority Guides &amp; Vs</div>
            </div>
          </div>
          <div className="mt-3 text-[11px] font-medium text-purple-600">
            Commercial search intent
          </div>
        </div>

        {/* Recommended Pages */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-900 tracking-tight">
                {recommendedPagesCount.toLocaleString()}
              </div>
              <div className="text-[12px] font-medium text-slate-500">Recommended New Hubs</div>
            </div>
          </div>
          <div className="mt-3 text-[11px] font-medium text-emerald-600">
            Ready for Fix Engine generation
          </div>
        </div>

        {/* Competitor Coverage Ratio */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <PieChartIcon className="h-5 w-5" />
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-900 tracking-tight">
                {coverageRatioPct}%
              </div>
              <div className="text-[12px] font-medium text-slate-500">Topic Parity with Rival</div>
            </div>
          </div>
          <div className="mt-3 text-[11px] font-medium text-slate-500">
            {coveredCount} covered of {totalCompTopics} topics
          </div>
        </div>
      </div>

      {/* ── MIDDLE SECTION: TOPIC COVERAGE COMPARISON + AI INSIGHTS ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 8 Cols: Tracked Competitors Breakdown */}
        <div className="lg:col-span-8 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs flex flex-col justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">Tracked Competitor Comparison</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Select any rival to benchmark their crawled page architecture against your site
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-5">
            {competitors.map((comp) => {
              const isSelected = comp.id === activeCompetitor?.id;
              const pagesCrawled = comp.pagesCrawled ?? 0;
              return (
                <div
                  key={comp.id}
                  onClick={() => {
                    setSelectedCompetitorId(comp.id);
                    setSelectedCompetitorDomain(comp.domain);
                  }}
                  className={`cursor-pointer rounded-xl border p-4 transition-all ${
                    isSelected
                      ? "border-purple-300 bg-purple-50/50 shadow-2xs"
                      : "border-slate-200/80 hover:border-slate-300 bg-white"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-900 truncate">{comp.domain}</span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        isSelected ? "bg-purple-200/80 text-purple-800" : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {isSelected ? "Active Analysis" : "Compare"}
                    </span>
                  </div>
                  <div className="mt-2 text-[11px] text-slate-500 flex items-center justify-between">
                    <span>{pagesCrawled.toLocaleString()} pages crawled</span>
                    <span className="font-semibold text-slate-700">Health: {comp.healthScore ?? "—"}</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-400 flex items-center justify-between">
            <span>Currently inspecting: <strong className="text-purple-700">{activeCompetitor?.domain}</strong></span>
            <span>{filteredGaps.length} gaps identified</span>
          </div>
        </div>

        {/* Right 4 Cols: AI Insights */}
        <div className="lg:col-span-4 rounded-2xl border border-purple-200/70 bg-gradient-to-br from-purple-50/50 via-white to-white p-6 shadow-xs flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="h-8 w-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
                <Bot className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Content Gap Synthesis</h3>
                <p className="text-[11px] text-slate-400">Architecture &amp; hub audit</p>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-white border border-purple-100 shadow-2xs">
                <div className="flex items-center gap-1.5 font-bold text-slate-800 mb-1">
                  <Lightbulb className="h-3.5 w-3.5 text-purple-600" />
                  <span>High-Converting Hubs Missing</span>
                </div>
                <p className="text-slate-600 leading-relaxed text-[11.5px]">
                  {missingCount > 0
                    ? `Your site is missing ${missingCount} dedicated content hubs found on ${activeCompetitor?.domain}. Creating these pages will bridge critical search intent.`
                    : `No major missing content archetypes detected against ${activeCompetitor?.domain}.`}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-white border border-purple-100 shadow-2xs">
                <div className="flex items-center gap-1.5 font-bold text-slate-800 mb-1">
                  <Sparkles className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                  <span>Fix Engine 30-Day Batch</span>
                </div>
                <p className="text-slate-600 leading-relaxed text-[11.5px]">
                  Stage these topics to the Fix Engine. Aiva will generate comprehensive content briefs with SEO schemas and internal links automatically.
                </p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleAddSelected}
            className="w-full py-2.5 px-4 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs"
          >
            <span>Stage {filteredGaps.length} Topics to Fix Plan</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* ── SEARCH & FILTER CONTROLS ── */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search content topics or page archetypes..."
              className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
            />
          </div>

          {/* Content Type Dropdown */}
          <div className="relative">
            <select
              value={selectedContentType}
              onChange={(e) => setSelectedContentType(e.target.value)}
              className="appearance-none pl-3 pr-8 py-2 text-xs font-medium rounded-xl border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
            >
              <option value="all">All content types</option>
              <option value="Guide">Guide</option>
              <option value="Comparison">Comparison</option>
              <option value="Case Study">Case Study</option>
              <option value="Template">Template</option>
              <option value="How-to">How-to</option>
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
          </div>

          {/* Coverage Dropdown */}
          <div className="relative">
            <select
              value={selectedCoverage}
              onChange={(e) => setSelectedCoverage(e.target.value)}
              className="appearance-none pl-3 pr-8 py-2 text-xs font-medium rounded-xl border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
            >
              <option value="all">All coverage statuses</option>
              <option value="Missing">Missing</option>
              <option value="Partial">Partial</option>
              <option value="Weak">Weak</option>
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
          </div>

          {/* Opportunity Dropdown */}
          <div className="relative">
            <select
              value={selectedOpportunity}
              onChange={(e) => setSelectedOpportunity(e.target.value)}
              className="appearance-none pl-3 pr-8 py-2 text-xs font-medium rounded-xl border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
            >
              <option value="all">All opportunities</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
          </div>

          {/* Reset Button */}
          <button
            type="button"
            onClick={handleResetFilters}
            className="px-3.5 py-2 text-xs font-semibold text-purple-700 hover:bg-purple-50 rounded-xl transition-all"
          >
            Reset
          </button>
        </div>

        {/* Results count & sort */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <div className="text-sm font-bold text-slate-900">
            {filteredGaps.length.toLocaleString()} content opportunities found
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>Sort by</span>
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                className="appearance-none pl-2.5 pr-7 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white text-slate-800 focus:outline-none"
              >
                <option value="opp-desc">Opportunity (High → Low)</option>
                <option value="vol-desc">Estimated Reach (High → Low)</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* State: Crawling or empty */}
        {isCompetitorCrawling ? (
          <div className="p-8 text-center space-y-3 border rounded-xl border-purple-100 bg-purple-50/30">
            <Loader2 className="h-6 w-6 animate-spin text-purple-600 mx-auto" />
            <p className="text-xs font-bold text-slate-900">
              Inspecting content pages on {activeCompetitor?.domain}...
            </p>
            <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
              Scanning page types, H1 headings, and content depth to identify missing topics.
            </p>
          </div>
        ) : filteredGaps.length === 0 ? (
          <div className="p-8 text-center space-y-2 border rounded-xl border-slate-100 bg-slate-50/50">
            <p className="text-xs font-bold text-slate-800">No content opportunities matching current filters</p>
            <p className="text-[11px] text-slate-500">
              Reset filters or select a different competitor to view their crawled content topics.
            </p>
          </div>
        ) : (
          /* Table */
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-[11px] font-bold text-slate-600 border-b border-slate-200 uppercase tracking-wider">
                <tr>
                  <th className="p-3.5 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === filteredGaps.length && filteredGaps.length > 0}
                      onChange={toggleSelectAll}
                      className="rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                    />
                  </th>
                  <th className="p-3.5 font-bold">Topic / Page Title</th>
                  <th className="p-3.5 font-bold">Archetype</th>
                  <th className="p-3.5 font-bold">Rival Domain</th>
                  <th className="p-3.5 font-bold">Your Coverage</th>
                  <th className="p-3.5 font-bold">Est. Reach</th>
                  <th className="p-3.5 font-bold">AI Citation Potential</th>
                  <th className="p-3.5 font-bold">Opportunity</th>
                  <th className="p-3.5 font-bold text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedGaps.map((item) => {
                  const isSelected = selectedIds.has(item.id);
                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isSelected ? "bg-purple-50/40" : ""
                      }`}
                    >
                      <td className="p-3.5 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectRow(item.id)}
                          className="rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                        />
                      </td>
                      <td className="p-3.5 font-semibold text-slate-900 max-w-sm">
                        <div className="truncate">{titleCase(item.topic)}</div>
                        {item.sourceUrl && (
                          <a
                            href={item.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] text-purple-600 hover:underline flex items-center gap-1 font-normal mt-0.5"
                          >
                            <span className="truncate max-w-xs">{item.sourceUrl}</span>
                            <ExternalLink className="h-2.5 w-2.5 shrink-0" />
                          </a>
                        )}
                      </td>
                      <td className="p-3.5">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700">
                          {item.contentType}
                        </span>
                      </td>
                      <td className="p-3.5">
                        <span className="font-medium text-slate-800">
                          {item.competitors[0]?.name || activeCompetitor?.domain}
                        </span>
                      </td>
                      <td className="p-3.5">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${
                            item.yourCoverage === "Missing"
                              ? "bg-rose-50 text-rose-700 border border-rose-200/60"
                              : "bg-amber-50 text-amber-700 border border-amber-200/60"
                          }`}
                        >
                          {item.yourCoverage}
                        </span>
                      </td>
                      <td className="p-3.5 font-medium text-slate-700">
                        {item.searchVolume.toLocaleString()}
                      </td>
                      <td className="p-3.5">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                            item.aiPotential === "High"
                              ? "bg-purple-50 text-purple-700 border border-purple-200/60"
                              : "bg-blue-50 text-blue-700 border border-blue-200/60"
                          }`}
                        >
                          {item.aiPotential}
                        </span>
                      </td>
                      <td className="p-3.5">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${
                            item.opportunity === "High"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                              : item.opportunity === "Medium"
                              ? "bg-blue-50 text-blue-700 border border-blue-200/60"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {item.opportunity}
                        </span>
                      </td>
                      <td className="p-3.5 text-center">
                        <button
                          type="button"
                          onClick={() => onAddToFixPlan?.(1, `Create Hub: ${item.topic}`)}
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

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-slate-500">
              Showing {(currentPage - 1) * pageSize + 1}–
              {Math.min(currentPage * pageSize, filteredGaps.length)} of {filteredGaps.length}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="p-1.5 rounded-lg border border-slate-200 text-slate-600 disabled:opacity-40 hover:bg-slate-50"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-xs font-semibold px-2">
                Page {currentPage} of {totalPages}
              </span>
              <button
                type="button"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="p-1.5 rounded-lg border border-slate-200 text-slate-600 disabled:opacity-40 hover:bg-slate-50"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
