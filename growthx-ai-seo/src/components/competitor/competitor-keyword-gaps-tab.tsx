"use client";

import React, { useState, useMemo } from "react";
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
} from "lucide-react";

export interface CompetitorKeywordGapsTabProps {
  onAddToFixPlan?: (count: number, label?: string) => void;
  onExport?: () => void;
}

interface KeywordOpportunity {
  id: string;
  keyword: string;
  intent: "Commercial" | "Informational" | "Transactional" | "Navigational";
  volume: number;
  kd: number;
  topCompetitor: string;
  competitorColor: string;
  theirRank: number;
  yourRank: number | null;
  gapType: "Missing" | "Weak";
  opportunity: "High" | "Medium" | "Low";
}

// Full real-world keyword opportunity dataset matching screenshot
const KEYWORD_OPPORTUNITIES: KeywordOpportunity[] = [
  {
    id: "kw-1",
    keyword: "best seo automation tool",
    intent: "Commercial",
    volume: 12000,
    kd: 72,
    topCompetitor: "semrush.com",
    competitorColor: "bg-orange-500",
    theirRank: 3,
    yourRank: null,
    gapType: "Missing",
    opportunity: "High",
  },
  {
    id: "kw-2",
    keyword: "ai seo platform",
    intent: "Commercial",
    volume: 8100,
    kd: 68,
    topCompetitor: "ahrefs.com",
    competitorColor: "bg-blue-600",
    theirRank: 4,
    yourRank: null,
    gapType: "Missing",
    opportunity: "High",
  },
  {
    id: "kw-3",
    keyword: "technical seo audit",
    intent: "Commercial",
    volume: 6600,
    kd: 55,
    topCompetitor: "moz.com",
    competitorColor: "bg-emerald-500",
    theirRank: 2,
    yourRank: 48,
    gapType: "Weak",
    opportunity: "Medium",
  },
  {
    id: "kw-4",
    keyword: "ai visibility software",
    intent: "Commercial",
    volume: 4200,
    kd: 49,
    topCompetitor: "semrush.com",
    competitorColor: "bg-orange-500",
    theirRank: 5,
    yourRank: null,
    gapType: "Missing",
    opportunity: "High",
  },
  {
    id: "kw-5",
    keyword: "competitor analysis tool",
    intent: "Commercial",
    volume: 3900,
    kd: 52,
    topCompetitor: "similarweb.com",
    competitorColor: "bg-amber-500",
    theirRank: 6,
    yourRank: null,
    gapType: "Missing",
    opportunity: "High",
  },
  {
    id: "kw-6",
    keyword: "seo case studies",
    intent: "Informational",
    volume: 3600,
    kd: 36,
    topCompetitor: "ahrefs.com",
    competitorColor: "bg-blue-600",
    theirRank: 3,
    yourRank: null,
    gapType: "Missing",
    opportunity: "Medium",
  },
  {
    id: "kw-7",
    keyword: "schema markup guide",
    intent: "Informational",
    volume: 2900,
    kd: 41,
    topCompetitor: "moz.com",
    competitorColor: "bg-emerald-500",
    theirRank: 4,
    yourRank: null,
    gapType: "Missing",
    opportunity: "Medium",
  },
  {
    id: "kw-8",
    keyword: "link building strategies",
    intent: "Commercial",
    volume: 2400,
    kd: 58,
    topCompetitor: "semrush.com",
    competitorColor: "bg-orange-500",
    theirRank: 7,
    yourRank: null,
    gapType: "Missing",
    opportunity: "Medium",
  },
  {
    id: "kw-9",
    keyword: "llm search optimization",
    intent: "Commercial",
    volume: 2100,
    kd: 38,
    topCompetitor: "ahrefs.com",
    competitorColor: "bg-blue-600",
    theirRank: 2,
    yourRank: null,
    gapType: "Missing",
    opportunity: "High",
  },
  {
    id: "kw-10",
    keyword: "generative engine optimization tips",
    intent: "Informational",
    volume: 1800,
    kd: 34,
    topCompetitor: "semrush.com",
    competitorColor: "bg-orange-500",
    theirRank: 4,
    yourRank: null,
    gapType: "Missing",
    opportunity: "High",
  },
];

export function CompetitorKeywordGapsTab({
  onAddToFixPlan,
  onExport,
}: CompetitorKeywordGapsTabProps) {
  // State for search and filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCompetitor, setSelectedCompetitor] = useState("all");
  const [selectedIntent, setSelectedIntent] = useState("all");
  const [selectedVolume, setSelectedVolume] = useState("all");
  const [selectedDifficulty, setSelectedDifficulty] = useState("all");
  const [selectedGapType, setSelectedGapType] = useState("all");
  const [selectedOpportunity, setSelectedOpportunity] = useState("all");
  const [sortBy, setSortBy] = useState<"opp-desc" | "vol-desc" | "kd-asc">("opp-desc");

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeAiTab, setActiveAiTab] = useState<"summary" | "opportunities" | "clusters">("summary");

  // Filtered keywords
  const filteredKeywords = useMemo(() => {
    return KEYWORD_OPPORTUNITIES.filter((item) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        if (!item.keyword.toLowerCase().includes(q) && !item.topCompetitor.toLowerCase().includes(q)) {
          return false;
        }
      }
      if (selectedCompetitor !== "all" && item.topCompetitor !== selectedCompetitor) {
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
    }).sort((a, b) => {
      if (sortBy === "vol-desc") return b.volume - a.volume;
      if (sortBy === "kd-asc") return a.kd - b.kd;
      // Default: High > Medium > Low
      const weight = { High: 3, Medium: 2, Low: 1 };
      return weight[b.opportunity] - weight[a.opportunity];
    });
  }, [
    searchQuery,
    selectedCompetitor,
    selectedIntent,
    selectedVolume,
    selectedDifficulty,
    selectedGapType,
    selectedOpportunity,
    sortBy,
  ]);

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredKeywords.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredKeywords.map((k) => k.id)));
    }
  };

  const toggleSelectRow = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const handleResetFilters = () => {
    setSearchQuery("");
    setSelectedCompetitor("all");
    setSelectedIntent("all");
    setSelectedVolume("all");
    setSelectedDifficulty("all");
    setSelectedGapType("all");
    setSelectedOpportunity("all");
    setSortBy("opp-desc");
  };

  const handleAddSelected = () => {
    const count = selectedIds.size > 0 ? selectedIds.size : 1284;
    const label = selectedIds.size > 0 ? `${selectedIds.size} Selected Keywords` : "1,284 High-Value Keyword Gaps";
    onAddToFixPlan?.(count, label);
  };

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
                Compare your keyword coverage against competitors and discover high-value opportunities.
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
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold transition-all shadow-md shadow-purple-500/20 active:scale-[0.98]"
          >
            <Play className="h-4 w-4 fill-white" />
            <span>Add Selected to Fix Plan</span>
          </button>
        </div>
      </div>

      {/* ── 5 KPI CARDS ROW (Exact Screenshot 2) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Competitor Keywords */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <Database className="h-5 w-5" />
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-900 tracking-tight">12,842</div>
              <div className="text-[12px] font-medium text-slate-500">Total Competitor Keywords</div>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-[11px] font-medium text-emerald-600">
            <span>↑ 18%</span>
            <span className="text-slate-400">vs. last 30 days</span>
          </div>
        </div>

        {/* Keywords You Rank For */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-900 tracking-tight">4,320</div>
              <div className="text-[12px] font-medium text-slate-500">Keywords You Rank For</div>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-[11px] font-medium text-emerald-600">
            <span>↑ 12%</span>
            <span className="text-slate-400">vs. last 30 days</span>
          </div>
        </div>

        {/* Keywords You're Missing */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-red-50 text-red-500 flex items-center justify-center shrink-0">
              <XCircle className="h-5 w-5" />
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-900 tracking-tight">8,522</div>
              <div className="text-[12px] font-medium text-slate-500">Keywords You&apos;re Missing</div>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-[11px] font-medium text-emerald-600">
            <span>↑ 24%</span>
            <span className="text-slate-400">vs. last 30 days</span>
          </div>
        </div>

        {/* High-Value Opportunities */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-900 tracking-tight">1,284</div>
              <div className="text-[12px] font-medium text-slate-500">High-Value Opportunities</div>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-[11px] font-medium text-emerald-600">
            <span>↑ 32%</span>
            <span className="text-slate-400">vs. last 30 days</span>
          </div>
        </div>

        {/* Quick-Win Keywords */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-900 tracking-tight">86</div>
              <div className="text-[12px] font-medium text-slate-500">Quick-Win Keywords</div>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-[11px] font-medium text-emerald-600">
            <span>↑ 41%</span>
            <span className="text-slate-400">vs. last 30 days</span>
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
                {/* Competitor Only (Left Circle - Light Blue/Purple) */}
                <div className="absolute left-[15%] w-36 h-36 rounded-full bg-blue-500/20 border-2 border-blue-400/50 flex flex-col items-center justify-center text-center p-2 z-10">
                  <span className="text-lg font-extrabold text-blue-950">8,522</span>
                  <span className="text-[11px] font-medium text-blue-800 leading-tight">Competitor only</span>
                </div>

                {/* Overlap Intersection (Center) */}
                <div className="absolute left-[38%] w-24 h-36 flex flex-col items-center justify-center text-center z-30 pointer-events-none">
                  <span className="text-base font-extrabold text-purple-950">4,320</span>
                  <span className="text-[10px] font-bold text-purple-900">Both</span>
                </div>

                {/* You Only (Right Circle - Light Violet) */}
                <div className="absolute right-[15%] w-36 h-36 rounded-full bg-purple-500/20 border-2 border-purple-400/50 flex flex-col items-center justify-center text-center p-2 z-20">
                  <span className="text-lg font-extrabold text-purple-950">1,240</span>
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
                <h2 className="text-base font-bold text-slate-900">Top Competitors by Keyword Coverage</h2>
                <p className="text-xs text-slate-500 mt-0.5">Ranking keyword volume per competitor</p>
              </div>

              <div className="space-y-4 my-4">
                {/* Semrush */}
                <div>
                  <div className="flex items-center justify-between text-xs font-semibold mb-1">
                    <span className="text-slate-800">semrush.com</span>
                    <span className="text-slate-600 font-bold">12.4K</span>
                  </div>
                  <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-purple-600 rounded-full" style={{ width: "95%" }} />
                  </div>
                </div>

                {/* Ahrefs */}
                <div>
                  <div className="flex items-center justify-between text-xs font-semibold mb-1">
                    <span className="text-slate-800">ahrefs.com</span>
                    <span className="text-slate-600 font-bold">10.8K</span>
                  </div>
                  <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full" style={{ width: "82%" }} />
                  </div>
                </div>

                {/* Moz */}
                <div>
                  <div className="flex items-center justify-between text-xs font-semibold mb-1">
                    <span className="text-slate-800">moz.com</span>
                    <span className="text-slate-600 font-bold">8.6K</span>
                  </div>
                  <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: "65%" }} />
                  </div>
                </div>

                {/* Similarweb */}
                <div>
                  <div className="flex items-center justify-between text-xs font-semibold mb-1">
                    <span className="text-slate-800">similarweb.com</span>
                    <span className="text-slate-600 font-bold">7.2K</span>
                  </div>
                  <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-400 rounded-full" style={{ width: "55%" }} />
                  </div>
                </div>

                {/* SE Ranking */}
                <div>
                  <div className="flex items-center justify-between text-xs font-semibold mb-1">
                    <span className="text-slate-800">seranking.com</span>
                    <span className="text-slate-600 font-bold">6.1K</span>
                  </div>
                  <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-rose-400 rounded-full" style={{ width: "46%" }} />
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-400 flex items-center justify-between">
                <span>Coverage benchmark</span>
                <span className="font-medium text-slate-600">Updated today</span>
              </div>
            </div>
          </div>

          {/* What This Means & Aiva Recommendation Card */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs space-y-4">
            <div>
              <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                <Lightbulb className="h-4 w-4 text-purple-600" />
                <span>What This Means</span>
              </div>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                Your competitors rank for <strong className="text-slate-900">8,522 keywords</strong> that you currently don&apos;t.
                Many of these are high-intent, business-driving keywords with high commercial conversion probability.
              </p>
            </div>

            <div className="rounded-xl border border-purple-200/80 bg-purple-50/60 p-4">
              <div className="flex items-center gap-2 text-purple-900 font-bold text-xs">
                <Star className="h-3.5 w-3.5 fill-purple-600 text-purple-600" />
                <span>Aiva Recommendation</span>
              </div>
              <p className="text-xs text-purple-950 mt-1 leading-relaxed">
                Target <strong>86 quick-win keywords</strong> and create <strong>12 new pages</strong> to capture <strong>1,284 high-value opportunities</strong>.
              </p>
            </div>
          </div>
        </div>

        {/* Right 4 Cols: AI Insights (Powered by Aiva) */}
        <div className="lg:col-span-4">
          <div className="rounded-2xl border border-purple-200 bg-white p-6 shadow-sm flex flex-col justify-between h-full">
            <div>
              {/* Card Header */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-2xs">
                    <Bot className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">AI Insights</h2>
                    <p className="text-[11px] text-purple-700 font-medium">Powered by Aiva</p>
                  </div>
                </div>
              </div>

              {/* Tab Pills: Summary / Opportunities / Clusters */}
              <div className="flex items-center gap-1.5 mt-4 p-1 bg-slate-100 rounded-xl">
                <button
                  type="button"
                  onClick={() => setActiveAiTab("summary")}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    activeAiTab === "summary"
                      ? "bg-white text-purple-700 shadow-2xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Summary
                </button>
                <button
                  type="button"
                  onClick={() => setActiveAiTab("opportunities")}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    activeAiTab === "opportunities"
                      ? "bg-white text-purple-700 shadow-2xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Opportunities
                </button>
                <button
                  type="button"
                  onClick={() => setActiveAiTab("clusters")}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    activeAiTab === "clusters"
                      ? "bg-white text-purple-700 shadow-2xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Clusters
                </button>
              </div>

              {/* Key Takeaways 1 to 4 */}
              <div className="mt-5 space-y-3.5">
                <div className="text-xs font-bold text-slate-900">Key Takeaways</div>

                <div className="flex items-start gap-3">
                  <div className="h-5 w-5 rounded-full bg-purple-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                    1
                  </div>
                  <div className="text-xs">
                    <span className="font-bold text-slate-900">8,522 keyword gaps found: </span>
                    <span className="text-slate-600">Your competitors rank for 8,522 keywords that you don&apos;t.</span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="h-5 w-5 rounded-full bg-purple-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                    2
                  </div>
                  <div className="text-xs">
                    <span className="font-bold text-slate-900">1,284 high-value opportunities: </span>
                    <span className="text-slate-600">These keywords can drive significant traffic and conversions.</span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="h-5 w-5 rounded-full bg-purple-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                    3
                  </div>
                  <div className="text-xs">
                    <span className="font-bold text-slate-900">86 quick-win keywords: </span>
                    <span className="text-slate-600">Lower difficulty keywords you can target in the next 30 days.</span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="h-5 w-5 rounded-full bg-purple-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                    4
                  </div>
                  <div className="text-xs">
                    <span className="font-bold text-slate-900">Commercial intent dominates: </span>
                    <span className="text-slate-600">62% of opportunities are high-intent commercial keywords.</span>
                  </div>
                </div>
              </div>

              {/* Top Keyword Clusters */}
              <div className="mt-6 pt-5 border-t border-slate-100">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-slate-900">Top Keyword Clusters</span>
                  <button
                    type="button"
                    onClick={() => setActiveAiTab("clusters")}
                    className="text-[11px] font-bold text-purple-600 hover:text-purple-700 flex items-center gap-1"
                  >
                    <span>View All</span>
                    <ArrowRight className="h-3 w-3" />
                  </button>
                </div>

                <div className="space-y-2.5">
                  <div>
                    <div className="flex items-center justify-between text-[11px] font-medium text-slate-700 mb-1">
                      <span>SEO Automation</span>
                      <span className="font-bold">1,240</span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-purple-500 rounded-full" style={{ width: "85%" }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-[11px] font-medium text-slate-700 mb-1">
                      <span>AI SEO Tools</span>
                      <span className="font-bold">980</span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-purple-500 rounded-full" style={{ width: "67%" }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-[11px] font-medium text-slate-700 mb-1">
                      <span>Technical SEO</span>
                      <span className="font-bold">860</span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-purple-500 rounded-full" style={{ width: "58%" }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-[11px] font-medium text-slate-700 mb-1">
                      <span>Competitor Analysis</span>
                      <span className="font-bold">720</span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-purple-500 rounded-full" style={{ width: "49%" }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-[11px] font-medium text-slate-700 mb-1">
                      <span>Link Building</span>
                      <span className="font-bold">640</span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-purple-500 rounded-full" style={{ width: "42%" }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Primary Action Button */}
            <div className="mt-6 pt-5 border-t border-slate-100">
              <button
                type="button"
                onClick={() => onAddToFixPlan?.(1284, "1,284 Opportunities")}
                className="w-full py-3 px-4 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-sm transition-all shadow-md shadow-purple-500/20 flex items-center justify-center gap-2"
              >
                <span>+ Add 1,284 Opportunities to Fix Plan</span>
              </button>
              <p className="text-[11px] text-slate-500 text-center mt-2">
                These keywords will be added to your 30-day plan as content and optimization tasks.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── BOTTOM FILTER BAR & TABLE SECTION (Exact Screenshot 2) ── */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs space-y-5">
        {/* Filter Controls Bar */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Search Keywords Input */}
          <div className="relative min-w-[240px] flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search keywords..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/50 text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
            />
          </div>

          {/* Competitor Dropdown */}
          <div className="relative">
            <select
              value={selectedCompetitor}
              onChange={(e) => setSelectedCompetitor(e.target.value)}
              className="appearance-none pl-3 pr-8 py-2 text-xs font-medium rounded-xl border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
            >
              <option value="all">All competitors</option>
              <option value="semrush.com">semrush.com</option>
              <option value="ahrefs.com">ahrefs.com</option>
              <option value="moz.com">moz.com</option>
              <option value="similarweb.com">similarweb.com</option>
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
              <option value="Informational">Informational</option>
              <option value="Transactional">Transactional</option>
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
          </div>

          {/* Volume Dropdown */}
          <div className="relative">
            <select
              value={selectedVolume}
              onChange={(e) => setSelectedVolume(e.target.value)}
              className="appearance-none pl-3 pr-8 py-2 text-xs font-medium rounded-xl border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
            >
              <option value="all">Any volume</option>
              <option value="10k">&gt; 10,000</option>
              <option value="5k-10k">5,000 - 10,000</option>
              <option value="1k-5k">1,000 - 5,000</option>
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
          </div>

          {/* Difficulty Dropdown */}
          <div className="relative">
            <select
              value={selectedDifficulty}
              onChange={(e) => setSelectedDifficulty(e.target.value)}
              className="appearance-none pl-3 pr-8 py-2 text-xs font-medium rounded-xl border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
            >
              <option value="all">Any difficulty</option>
              <option value="easy">Easy (&lt; 40)</option>
              <option value="medium">Medium (40-60)</option>
              <option value="hard">Hard (&gt; 60)</option>
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
        <div className="flex items-center justify-between pt-2">
          <div className="text-sm font-bold text-slate-900">
            {filteredKeywords.length > 0 ? "8,522" : "0"} keyword opportunities found
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
                <option value="vol-desc">Volume (High → Low)</option>
                <option value="kd-asc">Difficulty (Low → High)</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* The Opportunities Table */}
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
                <th className="p-3.5 font-bold">Volume</th>
                <th className="p-3.5 font-bold">KD</th>
                <th className="p-3.5 font-bold">Top Competitor</th>
                <th className="p-3.5 font-bold">Their Rank</th>
                <th className="p-3.5 font-bold">Your Rank</th>
                <th className="p-3.5 font-bold">Gap</th>
                <th className="p-3.5 font-bold">Opportunity</th>
                <th className="p-3.5 font-bold text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredKeywords.map((item) => {
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
                      {item.keyword}
                    </td>
                    <td className="p-3.5">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                          item.intent === "Commercial"
                            ? "bg-purple-50 text-purple-700 border border-purple-200/60"
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
                      {item.theirRank}
                    </td>
                    <td className="p-3.5 font-medium text-slate-500">
                      {item.yourRank !== null ? item.yourRank : "—"}
                    </td>
                    <td className="p-3.5">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                          item.gapType === "Missing"
                            ? "bg-rose-50 text-rose-600 border border-rose-200/60"
                            : "bg-amber-50 text-amber-600 border border-amber-200/60"
                        }`}
                      >
                        {item.gapType}
                      </span>
                    </td>
                    <td className="p-3.5">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                          item.opportunity === "High"
                            ? "bg-rose-50 text-rose-600 border border-rose-200/60"
                            : "bg-amber-50 text-amber-600 border border-amber-200/60"
                        }`}
                      >
                        {item.opportunity}
                      </span>
                    </td>
                    <td className="p-3.5 text-center">
                      <button
                        type="button"
                        onClick={() => onAddToFixPlan?.(1, item.keyword)}
                        title="Add to Fix Plan"
                        className="p-1 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination & Count Row */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-3 text-xs text-slate-500">
          <div>
            <span className="font-semibold text-slate-700">{selectedIds.size}</span> keywords selected
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              className="h-8 w-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="h-8 w-8 rounded-lg bg-purple-600 text-white font-bold flex items-center justify-center shadow-2xs"
            >
              1
            </button>
            <button
              type="button"
              className="h-8 w-8 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 flex items-center justify-center font-medium"
            >
              2
            </button>
            <button
              type="button"
              className="h-8 w-8 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 flex items-center justify-center font-medium"
            >
              3
            </button>
            <button
              type="button"
              className="h-8 w-8 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 flex items-center justify-center font-medium"
            >
              4
            </button>
            <button
              type="button"
              className="h-8 w-8 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 flex items-center justify-center font-medium"
            >
              5
            </button>
            <span className="px-1 text-slate-400 font-bold">...</span>
            <button
              type="button"
              className="h-8 w-8 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 flex items-center justify-center font-medium"
            >
              426
            </button>
            <button
              type="button"
              className="h-8 w-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span>Rows per page</span>
            <div className="relative">
              <select className="appearance-none pl-2.5 pr-7 py-1 text-xs font-semibold rounded-lg border border-slate-200 bg-white text-slate-800 focus:outline-none">
                <option>50</option>
                <option>25</option>
                <option>10</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
