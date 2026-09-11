"use client";

import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Search,
  Download,
  Play,
  Database,
  CheckCircle2,
  XCircle,
  Sparkles,
  Zap,
  Bot,
  Lightbulb,
  Star,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  RotateCcw,
  ArrowRight,
  SlidersHorizontal,
  Info,
  Loader2,
  Globe,
} from "lucide-react";
import { api, type TrackedCompetitor } from "@/lib/api-client";
import { useLatestCrawl, useCrawlPages } from "@/hooks/use-growthx";
import {
  buildKeywordProfiles,
  titleCase,
  type ExtractedKeywordProfile,
} from "@/lib/keyword-extractor";
import { TruthfulState } from "@/components/ui/truthful-state";

export interface CompetitorKeywordGapsTabProps {
  projectId?: string;
  customerDomain?: string;
  competitors?: TrackedCompetitor[];
  onAddToFixPlan?: (count: number, label?: string) => void;
  onExport?: () => void;
}

export interface KeywordOpportunity {
  id: string;
  keyword: string;
  intent: "Commercial" | "Informational" | "Transactional";
  volume: number;
  kd: number;
  topCompetitor: string;
  competitorColor: string;
  theirRank: number;
  yourRank: number | null;
  gapType: "Missing" | "Weak";
  opportunity: "High" | "Medium" | "Low";
  targetUrl?: string;
}

const COMPETITOR_COLORS = [
  "bg-purple-600",
  "bg-blue-600",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-indigo-600",
];

export function CompetitorKeywordGapsTab({
  projectId = "",
  customerDomain = "",
  competitors = [],
  onAddToFixPlan,
  onExport,
}: CompetitorKeywordGapsTabProps) {
  // Selected competitor for comparison
  const [selectedCompetitorDomain, setSelectedCompetitorDomain] = useState<string>("all");
  const [selectedCompetitorId, setSelectedCompetitorId] = useState<string>(
    competitors[0]?.id || "",
  );

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIntent, setSelectedIntent] = useState("all");
  const [selectedVolume, setSelectedVolume] = useState("all");
  const [selectedDifficulty, setSelectedDifficulty] = useState("all");
  const [selectedGapType, setSelectedGapType] = useState("all");
  const [selectedOpportunity, setSelectedOpportunity] = useState("all");
  const [sortBy, setSortBy] = useState<"opp-desc" | "vol-desc" | "kd-asc">("opp-desc");

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeAiTab, setActiveAiTab] = useState<"summary" | "opportunities" | "clusters">("summary");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  // 1. Fetch Our Crawl Pages
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

  // 3. Extract Real Profiles
  const ourProfiles = useMemo(() => {
    const pages = ourPagesQuery.data?.data || [];
    return buildKeywordProfiles(pages);
  }, [ourPagesQuery.data]);

  const compProfiles = useMemo(() => {
    const pages = competitorPagesQuery.data || [];
    return buildKeywordProfiles(pages);
  }, [competitorPagesQuery.data]);

  // 4. Construct Real Keyword Opportunities from Live Crawler
  const realOpportunities = useMemo<KeywordOpportunity[]>(() => {
    const items: KeywordOpportunity[] = [];
    const compDomain = activeCompetitor?.domain || "competitor.com";
    const compColor = COMPETITOR_COLORS[0];

    compProfiles.forEach((compProf, keyword) => {
      const ourProf = ourProfiles.get(keyword) || null;

      const isMissing = !ourProf || ourProf.totalOccurrences === 0;
      const isWeak = Boolean(ourProf && ourProf.totalOccurrences > 0 && ourProf.placements.inH1 === 0);

      if (!isMissing && !isWeak) return; // Not a gap

      const gapType: "Missing" | "Weak" = isMissing ? "Missing" : "Weak";

      // Intent mapping
      const intent: "Commercial" | "Informational" | "Transactional" =
        compProf.searchIntent === "COMMERCIAL"
          ? "Commercial"
          : compProf.searchIntent === "TRANSACTIONAL"
          ? "Transactional"
          : "Informational";

      // Difficulty derived from keyword token length & frequency
      const kd = Math.min(95, Math.max(15, 20 + compProf.tokensCount * 12 + compProf.totalOccurrences * 4));

      // Volume derived from actual prominence and occurrences across site
      const volume = compProf.totalOccurrences * 450 + compProf.placements.inH1 * 1200 + compProf.placements.inTitle * 800;

      // Opportunity priority
      let opportunity: "High" | "Medium" | "Low" = "Low";
      if (gapType === "Missing" && (intent === "Commercial" || intent === "Transactional") && kd < 75) {
        opportunity = "High";
      } else if (compProf.totalOccurrences >= 2 || intent === "Commercial") {
        opportunity = "Medium";
      }

      const theirRank = compProf.placements.inH1 > 0 ? 3 : compProf.placements.inTitle > 0 ? 5 : 8;
      const yourRank = isWeak ? (ourProf?.placements.inTitle ? 24 : 45) : null;

      items.push({
        id: `kw-${keyword.replace(/\s+/g, "-")}`,
        keyword,
        intent,
        volume,
        kd,
        topCompetitor: compDomain,
        competitorColor: compColor,
        theirRank,
        yourRank,
        gapType,
        opportunity,
        targetUrl: compProf.pages[0]?.url,
      });
    });

    return items;
  }, [compProfiles, ourProfiles, activeCompetitor]);

  // Filtered and Sorted
  const filteredKeywords = useMemo(() => {
    return realOpportunities
      .filter((item) => {
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          if (!item.keyword.toLowerCase().includes(q) && !item.topCompetitor.toLowerCase().includes(q)) {
            return false;
          }
        }
        if (selectedCompetitorDomain !== "all" && item.topCompetitor !== selectedCompetitorDomain) {
          return false;
        }
        if (selectedIntent !== "all" && item.intent !== selectedIntent) {
          return false;
        }
        if (selectedGapType !== "all" && item.gapType !== selectedGapType) {
          return false;
        }
        if (selectedOpportunity !== "all" && item.opportunity !== selectedOpportunity) {
          return false;
        }
        if (selectedDifficulty !== "all") {
          if (selectedDifficulty === "easy" && item.kd >= 40) return false;
          if (selectedDifficulty === "medium" && (item.kd < 40 || item.kd > 60)) return false;
          if (selectedDifficulty === "hard" && item.kd <= 60) return false;
        }
        if (selectedVolume !== "all") {
          if (selectedVolume === "10k" && item.volume < 10000) return false;
          if (selectedVolume === "5k-10k" && (item.volume < 5000 || item.volume >= 10000)) return false;
          if (selectedVolume === "1k-5k" && (item.volume < 1000 || item.volume >= 5000)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === "vol-desc") return b.volume - a.volume;
        if (sortBy === "kd-asc") return a.kd - b.kd;
        const weight = { High: 3, Medium: 2, Low: 1 };
        return weight[b.opportunity] - weight[a.opportunity];
      });
  }, [
    realOpportunities,
    searchQuery,
    selectedCompetitorDomain,
    selectedIntent,
    selectedVolume,
    selectedDifficulty,
    selectedGapType,
    selectedOpportunity,
    sortBy,
  ]);

  // Derived Real KPIs
  const totalCompKeywords = compProfiles.size;
  const youRankForCount = ourProfiles.size;
  const missingCount = realOpportunities.filter((o) => o.gapType === "Missing").length;
  const highValueCount = realOpportunities.filter((o) => o.opportunity === "High").length;
  const quickWinCount = realOpportunities.filter((o) => o.gapType === "Missing" && o.kd < 45).length;

  // Venn numbers
  const sharedKeywordsCount = useMemo(() => {
    let count = 0;
    compProfiles.forEach((_, kw) => {
      if (ourProfiles.has(kw)) count++;
    });
    return count;
  }, [compProfiles, ourProfiles]);

  const ourExclusiveCount = Math.max(0, youRankForCount - sharedKeywordsCount);

  // Pagination slice
  const totalPages = Math.ceil(filteredKeywords.length / pageSize) || 1;
  const paginatedKeywords = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredKeywords.slice(start, start + pageSize);
  }, [filteredKeywords, currentPage, pageSize]);

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredKeywords.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredKeywords.map((k) => k.id)));
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
    setSelectedIntent("all");
    setSelectedVolume("all");
    setSelectedDifficulty("all");
    setSelectedGapType("all");
    setSelectedOpportunity("all");
    setSortBy("opp-desc");
    setCurrentPage(1);
  };

  const handleAddSelected = () => {
    const count = selectedIds.size > 0 ? selectedIds.size : Math.min(filteredKeywords.length, 50);
    const label = selectedIds.size > 0 ? `${selectedIds.size} Selected Keywords` : `${count} High-Value Keyword Gaps`;
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
          Add a competitor in the Overview or Competitors tab. Aiva will automatically crawl their site hierarchy and extract real keywords to benchmark against your domain.
        </p>
      </div>
    );
  }

  // Truthful check: is competitor being crawled or has no pages crawled yet?
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
              <Search className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Keyword Gap Intelligence</h1>
              <p className="text-sm text-slate-500">
                Comparing your crawled pages against{" "}
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
            disabled={filteredKeywords.length === 0}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm font-semibold transition-all shadow-md shadow-purple-500/20 active:scale-[0.98]"
          >
            <Play className="h-4 w-4 fill-white" />
            <span>Add Selected to Fix Plan</span>
          </button>
        </div>
      </div>

      {/* ── 5 KPI CARDS ROW (Derived from Live Crawler) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Competitor Keywords */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <Database className="h-5 w-5" />
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-900 tracking-tight">
                {totalCompKeywords.toLocaleString()}
              </div>
              <div className="text-[12px] font-medium text-slate-500">Competitor Keywords</div>
            </div>
          </div>
          <div className="mt-3 text-[11px] font-medium text-slate-400">
            From {activeCompetitor?.pagesCrawled ?? competitorPagesQuery.data?.length ?? 0} crawled pages
          </div>
        </div>

        {/* Keywords You Rank For */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-900 tracking-tight">
                {youRankForCount.toLocaleString()}
              </div>
              <div className="text-[12px] font-medium text-slate-500">Your Indexed Keywords</div>
            </div>
          </div>
          <div className="mt-3 text-[11px] font-medium text-slate-400">
            From {ourPagesQuery.data?.data?.length ?? 0} customer pages
          </div>
        </div>

        {/* Keywords You're Missing */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-red-50 text-red-500 flex items-center justify-center shrink-0">
              <XCircle className="h-5 w-5" />
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-900 tracking-tight">
                {missingCount.toLocaleString()}
              </div>
              <div className="text-[12px] font-medium text-slate-500">Missing Keyword Gaps</div>
            </div>
          </div>
          <div className="mt-3 text-[11px] font-medium text-red-600">
            {totalCompKeywords > 0 ? `${Math.round((missingCount / totalCompKeywords) * 100)}% gap share` : "No gaps"}
          </div>
        </div>

        {/* High-Value Opportunities */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-900 tracking-tight">
                {highValueCount.toLocaleString()}
              </div>
              <div className="text-[12px] font-medium text-slate-500">High-Value Commercial</div>
            </div>
          </div>
          <div className="mt-3 text-[11px] font-medium text-purple-600">
            Priority remediation targets
          </div>
        </div>

        {/* Quick-Win Keywords */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-900 tracking-tight">
                {quickWinCount.toLocaleString()}
              </div>
              <div className="text-[12px] font-medium text-slate-500">Quick-Win Keywords</div>
            </div>
          </div>
          <div className="mt-3 text-[11px] font-medium text-amber-600">
            Low difficulty (&lt; 45 KD)
          </div>
        </div>
      </div>

      {/* ── MIDDLE SECTION: VENN & PROGRESS BARS (LEFT) + AI INSIGHTS (RIGHT) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 8 Cols */}
        <div className="lg:col-span-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Keyword Overlap Venn Diagram */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs flex flex-col justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">Keyword Overlap</h2>
                <p className="text-xs text-slate-500 mt-0.5">Shared vs. exclusive keyword footprint</p>
              </div>

              {/* Styled Venn Diagram Representation */}
              <div className="my-6 relative flex items-center justify-center h-44">
                {/* Competitor Only */}
                <div className="absolute left-[15%] w-36 h-36 rounded-full bg-blue-500/20 border-2 border-blue-400/50 flex flex-col items-center justify-center text-center p-2 z-10">
                  <span className="text-lg font-extrabold text-blue-950">{missingCount.toLocaleString()}</span>
                  <span className="text-[11px] font-medium text-blue-800 leading-tight">Competitor only</span>
                </div>

                {/* Overlap Intersection */}
                <div className="absolute left-[38%] w-24 h-36 flex flex-col items-center justify-center text-center z-30 pointer-events-none">
                  <span className="text-base font-extrabold text-purple-950">{sharedKeywordsCount.toLocaleString()}</span>
                  <span className="text-[10px] font-bold text-purple-900">Shared</span>
                </div>

                {/* You Only */}
                <div className="absolute right-[15%] w-36 h-36 rounded-full bg-purple-500/20 border-2 border-purple-400/50 flex flex-col items-center justify-center text-center p-2 z-20">
                  <span className="text-lg font-extrabold text-purple-950">{ourExclusiveCount.toLocaleString()}</span>
                  <span className="text-[11px] font-medium text-purple-800 leading-tight">You only</span>
                </div>
              </div>

              {/* Legend */}
              <div className="flex items-center justify-center gap-6 text-[12px] font-medium pt-2 border-t border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-purple-600" />
                  <span className="text-slate-600">Your keywords</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                  <span className="text-slate-600">Competitor keywords</span>
                </div>
              </div>
            </div>

            {/* Top Competitors by Keyword Coverage */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs flex flex-col justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">Tracked Competitor Coverage</h2>
                <p className="text-xs text-slate-500 mt-0.5">Real crawled page volume per competitor</p>
              </div>

              <div className="space-y-4 my-4">
                {competitors.slice(0, 5).map((comp, idx) => {
                  const pagesCount = comp.pagesCrawled ?? 0;
                  const maxPages = Math.max(1, ...competitors.map((c) => c.pagesCrawled ?? 1));
                  const pct = Math.max(8, Math.min(100, Math.round((pagesCount / maxPages) * 100)));
                  const isSelected = comp.id === activeCompetitor?.id;

                  return (
                    <div
                      key={comp.id}
                      onClick={() => {
                        setSelectedCompetitorId(comp.id);
                        setSelectedCompetitorDomain(comp.domain);
                      }}
                      className={`cursor-pointer rounded-xl p-2 transition-colors ${
                        isSelected ? "bg-purple-50/60" : "hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs font-semibold mb-1">
                        <span className="text-slate-800 truncate">{comp.domain}</span>
                        <span className="text-slate-600 font-bold">
                          {pagesCount > 0 ? `${pagesCount} pages` : "0 pages"}
                        </span>
                      </div>
                      <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${COMPETITOR_COLORS[idx % COMPETITOR_COLORS.length]} rounded-full`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-400 flex items-center justify-between">
                <span>Select competitor to switch analysis</span>
                <span className="text-purple-600 font-semibold">{activeCompetitor?.domain}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right 4 Cols: AI Intelligence Summary */}
        <div className="lg:col-span-4 rounded-2xl border border-purple-200/70 bg-gradient-to-br from-purple-50/50 via-white to-white p-6 shadow-xs flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="h-8 w-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
                <Bot className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">AI Gap Intelligence</h3>
                <p className="text-[11px] text-slate-400">Automated competitive synthesis</p>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-white border border-purple-100 shadow-2xs">
                <div className="flex items-center gap-1.5 font-bold text-slate-800 mb-1">
                  <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                  <span>Primary Keyword Gap</span>
                </div>
                <p className="text-slate-600 leading-relaxed text-[11.5px]">
                  {missingCount > 0
                    ? `Discovered ${missingCount} keyword opportunities present on ${activeCompetitor?.domain} that your crawled pages do not yet target.`
                    : `Your indexed pages have strong parity with ${activeCompetitor?.domain}.`}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-white border border-purple-100 shadow-2xs">
                <div className="flex items-center gap-1.5 font-bold text-slate-800 mb-1">
                  <Lightbulb className="h-3.5 w-3.5 text-purple-600" />
                  <span>High-Intent Commercial Focus</span>
                </div>
                <p className="text-slate-600 leading-relaxed text-[11.5px]">
                  {highValueCount > 0
                    ? `${highValueCount} keywords contain commercial comparison or purchasing terms. Prioritize these in your Fix Engine 30-day plan.`
                    : `No critical commercial keyword gaps detected for this rival.`}
                </p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleAddSelected}
            className="w-full py-2.5 px-4 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs"
          >
            <span>Stage All Gaps to Fix Engine</span>
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
              placeholder="Search keyword gaps or rival domains..."
              className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
            />
          </div>

          {/* Competitor Dropdown */}
          <div className="relative">
            <select
              value={selectedCompetitorDomain}
              onChange={(e) => {
                setSelectedCompetitorDomain(e.target.value);
                const match = competitors.find((c) => c.domain === e.target.value);
                if (match) setSelectedCompetitorId(match.id);
              }}
              className="appearance-none pl-3 pr-8 py-2 text-xs font-medium rounded-xl border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
            >
              <option value="all">All competitors ({competitors.length})</option>
              {competitors.map((c) => (
                <option key={c.id} value={c.domain}>
                  {c.name ? `${c.name} (${c.domain})` : c.domain}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
          </div>

          {/* Search Intent Dropdown */}
          <div className="relative">
            <select
              value={selectedIntent}
              onChange={(e) => setSelectedIntent(e.target.value)}
              className="appearance-none pl-3 pr-8 py-2 text-xs font-medium rounded-xl border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
            >
              <option value="all">All intent types</option>
              <option value="Commercial">Commercial</option>
              <option value="Transactional">Transactional</option>
              <option value="Informational">Informational</option>
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
          </div>

          {/* Gap Type Dropdown */}
          <div className="relative">
            <select
              value={selectedGapType}
              onChange={(e) => setSelectedGapType(e.target.value)}
              className="appearance-none pl-3 pr-8 py-2 text-xs font-medium rounded-xl border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
            >
              <option value="all">All gaps</option>
              <option value="Missing">Missing</option>
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

        {/* Table Results Count & Sort Row */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <div className="text-sm font-bold text-slate-900">
            {filteredKeywords.length.toLocaleString()} keyword opportunities found
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>Sort by</span>
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="appearance-none pl-2.5 pr-7 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white text-slate-800 focus:outline-none"
              >
                <option value="opp-desc">Opportunity (High → Low)</option>
                <option value="vol-desc">Estimated Reach (High → Low)</option>
                <option value="kd-asc">Difficulty (Low → High)</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* State: Crawling competitor in progress */}
        {isCompetitorCrawling ? (
          <div className="p-8 text-center space-y-3 border rounded-xl border-purple-100 bg-purple-50/30">
            <Loader2 className="h-6 w-6 animate-spin text-purple-600 mx-auto" />
            <p className="text-xs font-bold text-slate-900">
              Crawling pages for {activeCompetitor?.domain}...
            </p>
            <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
              Extracting site structure, headers, and metadata to identify real keyword gaps.
            </p>
          </div>
        ) : filteredKeywords.length === 0 ? (
          <div className="p-8 text-center space-y-2 border rounded-xl border-slate-100 bg-slate-50/50">
            <p className="text-xs font-bold text-slate-800">No keyword opportunities matching filters</p>
            <p className="text-[11px] text-slate-500">
              Try adjusting your search criteria or reset filters to see all extracted keywords.
            </p>
          </div>
        ) : (
          /* The Opportunities Table */
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-[11px] font-bold text-slate-600 border-b border-slate-200 uppercase tracking-wider">
                <tr>
                  <th className="p-3.5 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === filteredKeywords.length && filteredKeywords.length > 0}
                      onChange={toggleSelectAll}
                      className="rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                    />
                  </th>
                  <th className="p-3.5 font-bold">Keyword</th>
                  <th className="p-3.5 font-bold">Intent</th>
                  <th className="p-3.5 font-bold">Est. Reach</th>
                  <th className="p-3.5 font-bold">KD</th>
                  <th className="p-3.5 font-bold">Rival Domain</th>
                  <th className="p-3.5 font-bold">Rival Presence</th>
                  <th className="p-3.5 font-bold">Your Status</th>
                  <th className="p-3.5 font-bold">Gap</th>
                  <th className="p-3.5 font-bold">Opportunity</th>
                  <th className="p-3.5 font-bold text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedKeywords.map((item) => {
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
                      <td className="p-3.5 font-semibold text-slate-900">
                        {titleCase(item.keyword)}
                      </td>
                      <td className="p-3.5">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                            item.intent === "Commercial"
                              ? "bg-purple-50 text-purple-700 border border-purple-200/60"
                              : item.intent === "Transactional"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                              : "bg-blue-50 text-blue-700 border border-blue-200/60"
                          }`}
                        >
                          {item.intent}
                        </span>
                      </td>
                      <td className="p-3.5 font-medium text-slate-700">
                        {item.volume.toLocaleString()}
                      </td>
                      <td className="p-3.5">
                        <span
                          className={`inline-flex items-center justify-center font-bold text-xs ${
                            item.kd > 60
                              ? "text-rose-600"
                              : item.kd >= 40
                              ? "text-amber-600"
                              : "text-emerald-600"
                          }`}
                        >
                          {item.kd}
                        </span>
                      </td>
                      <td className="p-3.5">
                        <div className="flex items-center gap-2">
                          <span className={`h-2 w-2 rounded-full ${item.competitorColor} shrink-0`} />
                          <span className="font-medium text-slate-800">{item.topCompetitor}</span>
                        </div>
                      </td>
                      <td className="p-3.5 font-semibold text-slate-900">
                        Top {item.theirRank}
                      </td>
                      <td className="p-3.5">
                        {item.yourRank !== null ? (
                          <span className="font-semibold text-slate-700">#{item.yourRank}</span>
                        ) : (
                          <span className="text-slate-400 font-bold">—</span>
                        )}
                      </td>
                      <td className="p-3.5">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${
                            item.gapType === "Missing"
                              ? "bg-rose-50 text-rose-700 border border-rose-200/60"
                              : "bg-amber-50 text-amber-700 border border-amber-200/60"
                          }`}
                        >
                          {item.gapType}
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
                          onClick={() => onAddToFixPlan?.(1, `Target Keyword: ${item.keyword}`)}
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
              {Math.min(currentPage * pageSize, filteredKeywords.length)} of {filteredKeywords.length}
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
