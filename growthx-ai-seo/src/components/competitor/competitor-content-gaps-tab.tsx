"use client";

import React, { useState, useMemo } from "react";
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
} from "lucide-react";

export interface CompetitorContentGapsTabProps {
  onAddToFixPlan?: (count: number, label?: string) => void;
  onExport?: () => void;
}

interface ContentGapItem {
  id: string;
  topic: string;
  contentType: "Guide" | "Comparison" | "Case Study" | "Template" | "How-to";
  competitors: Array<{ initial: string; bg: string; name: string }>;
  moreCompetitorsCount: number;
  yourCoverage: "Missing" | "Partial" | "Weak";
  searchVolume: number;
  aiPotential: "High" | "Medium";
  opportunity: "High" | "Medium" | "Low";
}

const CONTENT_GAPS_DATA: ContentGapItem[] = [
  {
    id: "cg-1",
    topic: "seo automation",
    contentType: "Guide",
    competitors: [
      { initial: "S", bg: "bg-orange-500", name: "semrush.com" },
      { initial: "A", bg: "bg-blue-600", name: "ahrefs.com" },
      { initial: "M", bg: "bg-emerald-500", name: "moz.com" },
    ],
    moreCompetitorsCount: 2,
    yourCoverage: "Missing",
    searchVolume: 12000,
    aiPotential: "High",
    opportunity: "High",
  },
  {
    id: "cg-2",
    topic: "best ai seo tools",
    contentType: "Comparison",
    competitors: [
      { initial: "S", bg: "bg-orange-500", name: "semrush.com" },
      { initial: "A", bg: "bg-blue-600", name: "ahrefs.com" },
      { initial: "M", bg: "bg-emerald-500", name: "moz.com" },
    ],
    moreCompetitorsCount: 3,
    yourCoverage: "Missing",
    searchVolume: 8100,
    aiPotential: "High",
    opportunity: "High",
  },
  {
    id: "cg-3",
    topic: "technical seo guide",
    contentType: "Guide",
    competitors: [
      { initial: "S", bg: "bg-orange-500", name: "semrush.com" },
      { initial: "A", bg: "bg-blue-600", name: "ahrefs.com" },
      { initial: "M", bg: "bg-emerald-500", name: "moz.com" },
    ],
    moreCompetitorsCount: 4,
    yourCoverage: "Partial",
    searchVolume: 6600,
    aiPotential: "Medium",
    opportunity: "High",
  },
  {
    id: "cg-4",
    topic: "seo case studies",
    contentType: "Case Study",
    competitors: [
      { initial: "S", bg: "bg-orange-500", name: "semrush.com" },
      { initial: "A", bg: "bg-blue-600", name: "ahrefs.com" },
      { initial: "M", bg: "bg-emerald-500", name: "moz.com" },
    ],
    moreCompetitorsCount: 3,
    yourCoverage: "Missing",
    searchVolume: 4900,
    aiPotential: "High",
    opportunity: "High",
  },
  {
    id: "cg-5",
    topic: "link building strategies",
    contentType: "Guide",
    competitors: [
      { initial: "S", bg: "bg-orange-500", name: "semrush.com" },
      { initial: "A", bg: "bg-blue-600", name: "ahrefs.com" },
      { initial: "M", bg: "bg-emerald-500", name: "moz.com" },
    ],
    moreCompetitorsCount: 4,
    yourCoverage: "Weak",
    searchVolume: 4400,
    aiPotential: "Medium",
    opportunity: "Medium",
  },
  {
    id: "cg-6",
    topic: "ecommerce seo",
    contentType: "Guide",
    competitors: [
      { initial: "S", bg: "bg-orange-500", name: "semrush.com" },
      { initial: "A", bg: "bg-blue-600", name: "ahrefs.com" },
      { initial: "M", bg: "bg-emerald-500", name: "moz.com" },
    ],
    moreCompetitorsCount: 3,
    yourCoverage: "Missing",
    searchVolume: 3900,
    aiPotential: "High",
    opportunity: "High",
  },
  {
    id: "cg-7",
    topic: "local seo strategy",
    contentType: "How-to",
    competitors: [
      { initial: "S", bg: "bg-orange-500", name: "semrush.com" },
      { initial: "A", bg: "bg-blue-600", name: "ahrefs.com" },
      { initial: "M", bg: "bg-emerald-500", name: "moz.com" },
    ],
    moreCompetitorsCount: 4,
    yourCoverage: "Missing",
    searchVolume: 3600,
    aiPotential: "Medium",
    opportunity: "Medium",
  },
  {
    id: "cg-8",
    topic: "seo audit checklist",
    contentType: "Template",
    competitors: [
      { initial: "S", bg: "bg-orange-500", name: "semrush.com" },
      { initial: "A", bg: "bg-blue-600", name: "ahrefs.com" },
      { initial: "M", bg: "bg-emerald-500", name: "moz.com" },
    ],
    moreCompetitorsCount: 3,
    yourCoverage: "Partial",
    searchVolume: 2900,
    aiPotential: "High",
    opportunity: "Medium",
  },
  {
    id: "cg-9",
    topic: "content marketing for seo",
    contentType: "Guide",
    competitors: [
      { initial: "S", bg: "bg-orange-500", name: "semrush.com" },
      { initial: "A", bg: "bg-blue-600", name: "ahrefs.com" },
      { initial: "M", bg: "bg-emerald-500", name: "moz.com" },
    ],
    moreCompetitorsCount: 4,
    yourCoverage: "Missing",
    searchVolume: 2400,
    aiPotential: "Medium",
    opportunity: "Medium",
  },
  {
    id: "cg-10",
    topic: "ai visibility optimization",
    contentType: "Guide",
    competitors: [
      { initial: "S", bg: "bg-orange-500", name: "semrush.com" },
      { initial: "A", bg: "bg-blue-600", name: "ahrefs.com" },
      { initial: "M", bg: "bg-emerald-500", name: "moz.com" },
    ],
    moreCompetitorsCount: 3,
    yourCoverage: "Missing",
    searchVolume: 1900,
    aiPotential: "High",
    opportunity: "High",
  },
];

export function CompetitorContentGapsTab({
  onAddToFixPlan,
  onExport,
}: CompetitorContentGapsTabProps) {
  // Search and filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCompetitor, setSelectedCompetitor] = useState("all");
  const [selectedContentType, setSelectedContentType] = useState("all");
  const [selectedCoverage, setSelectedCoverage] = useState("all");
  const [selectedAiPotential, setSelectedAiPotential] = useState("all");
  const [selectedOpportunity, setSelectedOpportunity] = useState("all");
  const [sortBy, setSortBy] = useState<"opp-desc" | "vol-desc">("opp-desc");

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Filtered rows
  const filteredTopics = useMemo(() => {
    return CONTENT_GAPS_DATA.filter((item) => {
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
    }).sort((a, b) => {
      if (sortBy === "vol-desc") return b.searchVolume - a.searchVolume;
      const weight = { High: 3, Medium: 2, Low: 1 };
      return weight[b.opportunity] - weight[a.opportunity];
    });
  }, [
    searchQuery,
    selectedContentType,
    selectedCoverage,
    selectedAiPotential,
    selectedOpportunity,
    sortBy,
  ]);

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredTopics.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredTopics.map((t) => t.id)));
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
    setSelectedContentType("all");
    setSelectedCoverage("all");
    setSelectedAiPotential("all");
    setSelectedOpportunity("all");
    setSortBy("opp-desc");
  };

  const handleAddSelected = () => {
    const count = selectedIds.size > 0 ? selectedIds.size : 24;
    const label = selectedIds.size > 0 ? `${selectedIds.size} Content Opportunities` : "24 Content Gap Opportunities";
    onAddToFixPlan?.(count, label);
  };

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
                Discover missing topics, content types and pages that your competitors cover but you don&apos;t.
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

      {/* ── 5 KPI CARDS ROW (Exact Screenshot 3) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Competitor Topics */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <Database className="h-5 w-5" />
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-900 tracking-tight">428</div>
              <div className="text-[12px] font-medium text-slate-500">Total Competitor Topics</div>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-[11px] font-medium text-emerald-600">
            <span>↑ 18%</span>
            <span className="text-slate-400">vs. last 30 days</span>
          </div>
        </div>

        {/* Missing Topics */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-red-50 text-red-500 flex items-center justify-center shrink-0">
              <AlertCircle className="h-5 w-5" />
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-900 tracking-tight">128</div>
              <div className="text-[12px] font-medium text-slate-500">Missing Topics</div>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-[11px] font-medium text-emerald-600">
            <span>↑ 24%</span>
            <span className="text-slate-400">vs. last 30 days</span>
          </div>
        </div>

        {/* High-Priority Opportunities */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-900 tracking-tight">46</div>
              <div className="text-[12px] font-medium text-slate-500">High-Priority Opportunities</div>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-[11px] font-medium text-emerald-600">
            <span>↑ 32%</span>
            <span className="text-slate-400">vs. last 30 days</span>
          </div>
        </div>

        {/* Recommended Pages */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-900 tracking-tight">24</div>
              <div className="text-[12px] font-medium text-slate-500">Recommended Pages</div>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-[11px] font-medium text-emerald-600">
            <span>↑ 40%</span>
            <span className="text-slate-400">vs. last 30 days</span>
          </div>
        </div>

        {/* Competitors Cover More */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <PieChartIcon className="h-5 w-5" />
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-900 tracking-tight">78%</div>
              <div className="text-[12px] font-medium text-slate-500">Competitors Cover More</div>
            </div>
          </div>
          <div className="mt-3 text-[11px] font-medium text-slate-500">
            You cover 22% of topics
          </div>
        </div>
      </div>

      {/* ── MIDDLE SECTION: TOPIC COVERAGE COMPARISON + DISTRIBUTION + AI INSIGHTS ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 4.5 Cols: Topic Coverage Comparison Grouped Bar Chart */}
        <div className="lg:col-span-5 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs flex flex-col justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">Topic Coverage Comparison</h2>
            <p className="text-xs text-slate-500 mt-0.5">Topic counts across key content archetypes</p>
          </div>

          {/* Grouped Bar Chart SVG Representation */}
          <div className="my-5 relative h-52 flex items-end justify-between px-2 pt-6 border-b border-slate-200">
            {/* Grid line values */}
            <div className="absolute left-0 top-0 bottom-0 flex flex-col justify-between text-[10px] text-slate-400 pointer-events-none">
              <span>200</span>
              <span>150</span>
              <span>100</span>
              <span>50</span>
              <span>0</span>
            </div>

            {/* Categories */}
            {[
              { label: "Total Topics", heights: [110, 160, 150, 120] },
              { label: "Guides", heights: [35, 75, 70, 50] },
              { label: "Comparisons", heights: [10, 50, 45, 30] },
              { label: "How-to", heights: [30, 80, 85, 60] },
              { label: "Case Studies", heights: [15, 40, 35, 25] },
              { label: "Tools", heights: [20, 45, 40, 30] },
              { label: "Industry Topics", heights: [30, 75, 70, 55] },
            ].map((cat) => (
              <div key={cat.label} className="flex flex-col items-center flex-1">
                <div className="flex items-end gap-1 h-36">
                  {/* Your website bar (Purple) */}
                  <div
                    className="w-1.5 sm:w-2 bg-purple-600 rounded-t-sm"
                    style={{ height: `${cat.heights[0]}px` }}
                  />
                  {/* Semrush (Blue) */}
                  <div
                    className="w-1.5 sm:w-2 bg-blue-500 rounded-t-sm"
                    style={{ height: `${cat.heights[1]}px` }}
                  />
                  {/* Ahrefs (Coral) */}
                  <div
                    className="w-1.5 sm:w-2 bg-orange-500 rounded-t-sm"
                    style={{ height: `${cat.heights[2]}px` }}
                  />
                  {/* Moz (Teal) */}
                  <div
                    className="w-1.5 sm:w-2 bg-emerald-500 rounded-t-sm"
                    style={{ height: `${cat.heights[3]}px` }}
                  />
                </div>
                <span className="text-[10px] text-slate-600 font-medium mt-2 truncate max-w-[56px] text-center">
                  {cat.label}
                </span>
              </div>
            ))}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center justify-center gap-4 text-[11px] font-medium pt-2">
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-purple-600" />
              <span className="text-slate-700">Your Website</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
              <span className="text-slate-700">semrush.com</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-orange-500" />
              <span className="text-slate-700">ahrefs.com</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              <span className="text-slate-700">moz.com</span>
            </div>
          </div>
        </div>

        {/* Middle 3.5 Cols: Content Type Distribution Donut Chart */}
        <div className="lg:col-span-3 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs flex flex-col justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">Content Type Distribution</h2>
            <p className="text-xs text-slate-500 mt-0.5">Distribution across competitor coverage</p>
          </div>

          {/* Donut Chart representation */}
          <div className="my-4 flex items-center justify-center relative">
            <div className="relative w-40 h-40 flex items-center justify-center">
              {/* CSS multi-conic gradient ring */}
              <div
                className="w-36 h-36 rounded-full"
                style={{
                  background:
                    "conic-gradient(#7c3aed 0% 32%, #3b82f6 32% 56%, #f97316 56% 74%, #10b981 74% 86%, #f59e0b 86% 94%, #94a3b8 94% 100%)",
                }}
              />
              {/* Center cutout */}
              <div className="absolute w-24 h-24 rounded-full bg-white flex flex-col items-center justify-center shadow-inner">
                <span className="text-2xl font-extrabold text-slate-900">428</span>
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                  Total Topics
                </span>
              </div>
            </div>
          </div>

          {/* Slices legend */}
          <div className="space-y-2 text-xs pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-purple-600" />
                <span className="text-slate-700 font-medium">Guides</span>
              </div>
              <span className="font-bold text-slate-900">32%</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-blue-500" />
                <span className="text-slate-700 font-medium">How-to Articles</span>
              </div>
              <span className="font-bold text-slate-900">24%</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-orange-500" />
                <span className="text-slate-700 font-medium">Comparison Pages</span>
              </div>
              <span className="font-bold text-slate-900">18%</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <span className="text-slate-700 font-medium">Tools &amp; Templates</span>
              </div>
              <span className="font-bold text-slate-900">12%</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                <span className="text-slate-700 font-medium">Case Studies</span>
              </div>
              <span className="font-bold text-slate-900">8%</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-slate-400" />
                <span className="text-slate-700 font-medium">Other</span>
              </div>
              <span className="font-bold text-slate-900">6%</span>
            </div>
          </div>
        </div>

        {/* Right 4 Cols: AI Insights (Powered by Aiva) */}
        <div className="lg:col-span-4 rounded-2xl border border-purple-200 bg-white p-6 shadow-sm flex flex-col justify-between">
          <div>
            {/* Header */}
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
              <div className="h-9 w-9 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-2xs">
                <Bot className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">AI Insights</h2>
                <p className="text-[11px] text-purple-700 font-medium">Powered by Aiva</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 mt-3 leading-relaxed">
              Your competitors cover <strong className="text-slate-900">128 topics</strong> that your website doesn&apos;t.
              These gaps represent high-value opportunities to attract more organic traffic and AI visibility.
            </p>

            {/* Top Insights 1 to 4 */}
            <div className="mt-4 space-y-3">
              <div className="text-xs font-bold text-slate-900">Top Insights</div>

              <div className="flex items-start gap-2.5">
                <div className="h-5 w-5 rounded-full bg-purple-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                  1
                </div>
                <div className="text-xs">
                  <span className="font-bold text-slate-900">Competitors have 4x more comparison content: </span>
                  <span className="text-slate-600">All top competitors have comparison pages, but you have none.</span>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <div className="h-5 w-5 rounded-full bg-purple-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                  2
                </div>
                <div className="text-xs">
                  <span className="font-bold text-slate-900">Industry-specific topics are missing: </span>
                  <span className="text-slate-600">Competitors cover 18 industry-specific topics that you don&apos;t.</span>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <div className="h-5 w-5 rounded-full bg-purple-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                  3
                </div>
                <div className="text-xs">
                  <span className="font-bold text-slate-900">More how-to and tutorial content needed: </span>
                  <span className="text-slate-600">Competitors have 32 how-to guides on key topics.</span>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <div className="h-5 w-5 rounded-full bg-purple-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                  4
                </div>
                <div className="text-xs">
                  <span className="font-bold text-slate-900">AI-friendly content formats: </span>
                  <span className="text-slate-600">Competitors use structured, answer-focused content cited in AI platforms.</span>
                </div>
              </div>
            </div>

            {/* Aiva Recommendation */}
            <div className="mt-4 rounded-xl border border-purple-200/80 bg-purple-50/60 p-3">
              <div className="flex items-center gap-1.5 text-purple-900 font-bold text-xs">
                <Lightbulb className="h-3.5 w-3.5 text-purple-600" />
                <span>Aiva Recommendation</span>
              </div>
              <p className="text-xs text-purple-950 mt-1 leading-relaxed">
                Create <strong>24 new pages</strong> and optimize <strong>18 existing pages</strong> to close the most important content gaps.
              </p>
            </div>
          </div>

          {/* Action CTA & Top Content Opportunities list */}
          <div className="mt-4 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => onAddToFixPlan?.(24, "24 Content Opportunities")}
              className="w-full py-2.5 px-4 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs transition-all shadow-md shadow-purple-500/20 flex items-center justify-center gap-2"
            >
              <span>Add 24 Opportunities to Fix Plan →</span>
            </button>

            {/* Top Content Opportunities */}
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-900">Top Content Opportunities</span>
                <span className="text-[11px] font-bold text-purple-600 cursor-pointer hover:underline">View All →</span>
              </div>

              <div className="space-y-1.5">
                {[
                  { id: 1, title: "AI SEO guide", type: "Guide", opp: "High" },
                  { id: 2, title: "Best SEO tools comparison", type: "Comparison", opp: "High" },
                  { id: 3, title: "Technical SEO checklist", type: "How-to", opp: "High" },
                  { id: 4, title: "SEO case studies", type: "Case Study", opp: "Medium" },
                  { id: 5, title: "Enterprise SEO strategies", type: "Guide", opp: "Medium" },
                ].map((item) => (
                  <div key={item.id} className="flex items-center justify-between text-xs py-1">
                    <div className="flex items-center gap-2">
                      <span className="h-4 w-4 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-[10px] font-bold">
                        {item.id}
                      </span>
                      <span className="font-semibold text-slate-800">{item.title}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                        {item.type}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          item.opp === "High"
                            ? "bg-rose-50 text-rose-600"
                            : "bg-amber-50 text-amber-600"
                        }`}
                      >
                        {item.opp}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── BOTTOM FILTER BAR & TABLE SECTION (Exact Screenshot 3) ── */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs space-y-5">
        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Search topics Input */}
          <div className="relative min-w-[240px] flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search topics..."
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
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
          </div>

          {/* Content Type Dropdown */}
          <div className="relative">
            <select
              value={selectedContentType}
              onChange={(e) => setSelectedContentType(e.target.value)}
              className="appearance-none pl-3 pr-8 py-2 text-xs font-medium rounded-xl border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
            >
              <option value="all">All types</option>
              <option value="Guide">Guide</option>
              <option value="Comparison">Comparison</option>
              <option value="Case Study">Case Study</option>
              <option value="Template">Template</option>
              <option value="How-to">How-to</option>
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
          </div>

          {/* Your Coverage Dropdown */}
          <div className="relative">
            <select
              value={selectedCoverage}
              onChange={(e) => setSelectedCoverage(e.target.value)}
              className="appearance-none pl-3 pr-8 py-2 text-xs font-medium rounded-xl border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
            >
              <option value="all">All coverage</option>
              <option value="Missing">Missing</option>
              <option value="Partial">Partial</option>
              <option value="Weak">Weak</option>
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
          </div>

          {/* AI Visibility Potential Dropdown */}
          <div className="relative">
            <select
              value={selectedAiPotential}
              onChange={(e) => setSelectedAiPotential(e.target.value)}
              className="appearance-none pl-3 pr-8 py-2 text-xs font-medium rounded-xl border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
            >
              <option value="all">All AI potential</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
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
              <option value="all">All opportunity</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
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

        {/* Table Results Count & Sort */}
        <div className="flex items-center justify-between pt-2">
          <div className="text-sm font-bold text-slate-900">
            {filteredTopics.length > 0 ? "128" : "0"} content gaps found
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
                <option value="vol-desc">Search Volume (High → Low)</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-[11px] font-bold text-slate-600 border-b border-slate-200 uppercase tracking-wider">
              <tr>
                <th className="p-3.5 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === filteredTopics.length && filteredTopics.length > 0}
                    onChange={toggleSelectAll}
                    className="rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                  />
                </th>
                <th className="p-3.5 font-bold">Topic / Keyword</th>
                <th className="p-3.5 font-bold">Content Type</th>
                <th className="p-3.5 font-bold">Competitors Covering</th>
                <th className="p-3.5 font-bold">Your Coverage</th>
                <th className="p-3.5 font-bold">Search Volume</th>
                <th className="p-3.5 font-bold">AI Visibility Potential</th>
                <th className="p-3.5 font-bold">Opportunity</th>
                <th className="p-3.5 font-bold text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTopics.map((item) => {
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
                      {item.topic}
                    </td>
                    <td className="p-3.5">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                          item.contentType === "Guide"
                            ? "bg-blue-50 text-blue-700 border border-blue-200/60"
                            : item.contentType === "Comparison"
                            ? "bg-purple-50 text-purple-700 border border-purple-200/60"
                            : item.contentType === "Case Study"
                            ? "bg-pink-50 text-pink-700 border border-pink-200/60"
                            : item.contentType === "Template"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                            : "bg-amber-50 text-amber-700 border border-amber-200/60"
                        }`}
                      >
                        {item.contentType}
                      </span>
                    </td>
                    <td className="p-3.5">
                      <div className="flex items-center -space-x-1.5">
                        {item.competitors.map((comp, idx) => (
                          <div
                            key={idx}
                            title={comp.name}
                            className={`h-6 w-6 rounded-full ${comp.bg} text-white flex items-center justify-center font-bold text-[10px] ring-2 ring-white`}
                          >
                            {comp.initial}
                          </div>
                        ))}
                        <span className="text-[10px] font-semibold text-slate-500 pl-2">
                          +{item.moreCompetitorsCount}
                        </span>
                      </div>
                    </td>
                    <td className="p-3.5">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                          item.yourCoverage === "Missing"
                            ? "bg-rose-50 text-rose-600 border border-rose-200/60"
                            : item.yourCoverage === "Weak"
                            ? "bg-amber-50 text-amber-600 border border-amber-200/60"
                            : "bg-orange-50 text-orange-600 border border-orange-200/60"
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
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                          item.aiPotential === "High"
                            ? "bg-emerald-50 text-emerald-600 border border-emerald-200/60"
                            : "bg-amber-50 text-amber-600 border border-amber-200/60"
                        }`}
                      >
                        {item.aiPotential}
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
                        onClick={() => onAddToFixPlan?.(1, item.topic)}
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

        {/* Pagination & Count */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-3 text-xs text-slate-500">
          <div>
            <span className="font-semibold text-slate-700">{selectedIds.size}</span> topics selected
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
              13
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
                <option>10</option>
                <option>25</option>
                <option>50</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
