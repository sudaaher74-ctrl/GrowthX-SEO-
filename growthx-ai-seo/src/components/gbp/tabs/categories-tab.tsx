"use client";

import React, { useState } from "react";
import {
  Tag,
  Plus,
  Trash2,
  TrendingUp,
  Search,
  Sparkles,
  ArrowRight,
  MoreVertical,
  Check,
  Lightbulb,
  ExternalLink,
  Layers,
  Eye,
  BarChart2,
} from "lucide-react";
import { CircularScoreGauge } from "../circular-score-gauge";
import { GoogleGLogo } from "../gbp-icons";
import type { LocalSeoData } from "@/lib/api-client";
import { cn } from "@/lib/utils";

interface CategoriesTabProps {
  localSeo: LocalSeoData | null | undefined;
}

interface CurrentCategory {
  id: string;
  name: string;
  isPrimary: boolean;
  tag: string;
  description: string;
}

interface SuggestionCategory {
  id: string;
  name: string;
  description: string;
  matchScore: "High Match" | "Medium Match" | "Low Match";
}

interface CompetitorCategoryRow {
  name: string;
  isCurrentBusiness?: boolean;
  avatarColor: string;
  primaryCategory: string;
  secondaryCategories: string[];
  total: number;
}

export function CategoriesTab({ localSeo }: CategoriesTabProps) {
  const businessName = localSeo?.businessName || "MilQuu Fresh";

  // Initial user categories
  const [categories, setCategories] = useState<CurrentCategory[]>([
    {
      id: "cat-1",
      name: "Dairy Products Supplier",
      isPrimary: true,
      tag: "Recommended",
      description: "Main category (most important)",
    },
    {
      id: "cat-2",
      name: "Milk Delivery Service",
      isPrimary: false,
      tag: "Good",
      description: "Helps you appear for delivery-related searches",
    },
    {
      id: "cat-3",
      name: "Grocery Store",
      isPrimary: false,
      tag: "Good",
      description: "Relevant for vegetables and daily essentials",
    },
  ]);

  // Suggestions
  const [selectedSuggestionIds, setSelectedSuggestionIds] = useState<string[]>([]);
  const suggestions: SuggestionCategory[] = [
    {
      id: "sug-1",
      name: "Organic Food Store",
      description: "Relevant for organic milk and fresh products",
      matchScore: "High Match",
    },
    {
      id: "sug-2",
      name: "Farmers' Market",
      description: "Highlights farm-to-home sourcing",
      matchScore: "High Match",
    },
    {
      id: "sug-3",
      name: "Food Products Supplier",
      description: "Broader product category",
      matchScore: "Medium Match",
    },
    {
      id: "sug-4",
      name: "Vegetable Wholesaler",
      description: "For vegetable delivery services",
      matchScore: "Medium Match",
    },
    {
      id: "sug-5",
      name: "Convenience Store",
      description: "Relevant for daily essentials",
      matchScore: "Low Match",
    },
  ];

  const competitorCategoriesList: CompetitorCategoryRow[] = [
    {
      name: `${businessName} (You)`,
      isCurrentBusiness: true,
      avatarColor: "bg-emerald-600 text-white",
      primaryCategory: categories.find((c) => c.isPrimary)?.name || "Dairy Products Supplier",
      secondaryCategories: categories.filter((c) => !c.isPrimary).map((c) => c.name),
      total: categories.length,
    },
    {
      name: "A2 Milk Point",
      avatarColor: "bg-amber-600 text-white",
      primaryCategory: "Dairy Store",
      secondaryCategories: ["Organic Food Store", "Milk Delivery Service"],
      total: 3,
    },
    {
      name: "Fresh Farm Dairy",
      avatarColor: "bg-emerald-700 text-white",
      primaryCategory: "Dairy Products Supplier",
      secondaryCategories: ["Farmers' Market", "Organic Food Store", "Grocery Store"],
      total: 4,
    },
    {
      name: "Daily Fresh Mart",
      avatarColor: "bg-blue-600 text-white",
      primaryCategory: "Grocery Store",
      secondaryCategories: ["Supermarket", "Dairy Store", "Vegetable Store"],
      total: 4,
    },
    {
      name: "Pure Milk & More",
      avatarColor: "bg-cyan-600 text-white",
      primaryCategory: "Milk Delivery Service",
      secondaryCategories: ["Dairy Store", "Food Products Supplier"],
      total: 3,
    },
  ];

  // Bar chart data for visibility impact
  const visibilityMetrics = [
    { label: "Total Views", youVal: 12400, compVal: 16500, youHeightPct: 75, compHeightPct: 95 },
    { label: "Map Views", youVal: 8200, compVal: 11000, youHeightPct: 60, compHeightPct: 80 },
    { label: "Search Appearances", youVal: 2800, compVal: 4200, youHeightPct: 45, compHeightPct: 65 },
    { label: "Direction Requests", youVal: 480, compVal: 720, youHeightPct: 35, compHeightPct: 55 },
    { label: "Calls", youVal: 320, compVal: 510, youHeightPct: 40, compHeightPct: 60 },
  ];

  const handleToggleSuggestion = (id: string) => {
    if (selectedSuggestionIds.includes(id)) {
      setSelectedSuggestionIds(selectedSuggestionIds.filter((item) => item !== id));
    } else {
      setSelectedSuggestionIds([...selectedSuggestionIds, id]);
    }
  };

  const handleApplySelectedSuggestions = () => {
    const toAdd = suggestions.filter((s) => selectedSuggestionIds.includes(s.id));
    const newItems: CurrentCategory[] = toAdd
      .filter((s) => !categories.some((c) => c.name.toLowerCase() === s.name.toLowerCase()))
      .map((s) => ({
        id: `cat-${s.id}`,
        name: s.name,
        isPrimary: false,
        tag: "Good",
        description: s.description,
      }));

    if (newItems.length > 0) {
      setCategories([...categories, ...newItems]);
      setSelectedSuggestionIds([]);
    }
  };

  const handleRemoveCategory = (id: string) => {
    setCategories(categories.filter((c) => c.id !== id || c.isPrimary));
  };

  // Optimization score calculation
  const primarySet = categories.some((c) => c.isPrimary);
  const secondaryCount = categories.filter((c) => !c.isPrimary).length;
  const optimizationScore = primarySet ? Math.min(50 + secondaryCount * 10, 100) : 30;

  return (
    <div className="space-y-6">
      {/* ── Top Metric Cards (Row 1) ─────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Category Optimization Score */}
        <div
          className="rounded-2xl border bg-white p-5 shadow-xs flex items-center gap-4"
          style={{ borderColor: "var(--border-color)" }}
        >
          <CircularScoreGauge score={optimizationScore} size={90} strokeWidth={9} />
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-brand-900">Category Optimization Score</span>
            </div>
            <div className="inline-block">
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                Good
              </span>
            </div>
            <p className="text-[11px] text-brand-500 leading-tight">
              You have relevant primary category, but can add more secondary categories to increase visibility.
            </p>
            <a
              href="#category-suggestions"
              className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-700 pt-1"
            >
              <span>View Suggestions</span>
              <ArrowRight size={11} />
            </a>
          </div>
        </div>

        {/* Card 2: Total Categories */}
        <div
          className="rounded-2xl border bg-white p-5 shadow-xs flex flex-col justify-between"
          style={{ borderColor: "var(--border-color)" }}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-brand-600">Total Categories</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Layers size={16} />
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-2xl font-black tracking-tight text-brand-950">{categories.length}</div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
              <TrendingUp size={13} />
              <span>+1 vs last 28 days</span>
            </div>
          </div>
        </div>

        {/* Card 3: Category Views */}
        <div
          className="rounded-2xl border bg-white p-5 shadow-xs flex flex-col justify-between"
          style={{ borderColor: "var(--border-color)" }}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-brand-600">Category Views</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Eye size={16} />
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-2xl font-black tracking-tight text-brand-950">
              {localSeo ? "12.4K" : "—"}
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
                <TrendingUp size={13} />
                <span>+28% vs last 28 days</span>
              </div>
              {/* Mini sparkline curve */}
              <svg className="w-16 h-6 text-emerald-500" viewBox="0 0 64 24" fill="none">
                <path
                  d="M2 18 C 16 16, 24 10, 36 12 C 48 14, 52 4, 62 4"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </div>
          </div>
        </div>

        {/* Card 4: Search Appearances */}
        <div
          className="rounded-2xl border bg-white p-5 shadow-xs flex flex-col justify-between"
          style={{ borderColor: "var(--border-color)" }}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-brand-600">Search Appearances</span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <Search size={16} />
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-2xl font-black tracking-tight text-brand-950">
              {localSeo ? "2.8K" : "—"}
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
                <TrendingUp size={13} />
                <span>+35% vs last 28 days</span>
              </div>
              {/* Mini sparkline curve purple */}
              <svg className="w-16 h-6 text-purple-500" viewBox="0 0 64 24" fill="none">
                <path
                  d="M2 20 C 14 18, 26 14, 38 8 C 48 12, 54 4, 62 4"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* ── Middle Row (Row 2): Current Categories & Suggestions ─────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (7 cols): Your Current Categories */}
        <div
          className="lg:col-span-7 rounded-2xl border bg-white p-5 shadow-xs space-y-4"
          style={{ borderColor: "var(--border-color)" }}
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-brand-950">Your Current Categories</h2>
              <p className="text-xs text-brand-500">Categories currently set on your Google Business Profile.</p>
            </div>

            <a
              href="https://business.google.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-brand-200 bg-white text-xs font-semibold text-brand-800 hover:bg-brand-50 shadow-2xs"
            >
              <GoogleGLogo size={14} />
              <span>Edit on Google</span>
            </a>
          </div>

          <div className="space-y-3 pt-1">
            {categories.map((cat) => (
              <div
                key={cat.id}
                className="flex items-center justify-between p-3.5 rounded-xl border border-brand-100 hover:border-brand-200 hover:shadow-2xs transition-all bg-white"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      "text-[10px] font-bold px-2.5 py-1 rounded-lg uppercase tracking-wider",
                      cat.isPrimary
                        ? "bg-amber-100 text-amber-900 border border-amber-200"
                        : "bg-blue-50 text-blue-700 border border-blue-200"
                    )}
                  >
                    {cat.isPrimary ? "Primary" : "Secondary"}
                  </span>
                  <div>
                    <h3 className="text-xs font-bold text-brand-950">{cat.name}</h3>
                    <p className="text-[11px] text-brand-500">{cat.description}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "text-[10px] font-semibold px-2 py-0.5 rounded-md",
                      cat.tag === "Recommended"
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    )}
                  >
                    {cat.tag}
                  </span>
                  {!cat.isPrimary && (
                    <button
                      type="button"
                      onClick={() => handleRemoveCategory(cat.id)}
                      className="p-1 rounded-md text-brand-400 hover:text-red-600 hover:bg-red-50"
                      title="Remove category"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                  <button type="button" className="p-1 rounded-md text-brand-400 hover:text-brand-700">
                    <MoreVertical size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column (5 cols): Category Suggestions */}
        <div
          id="category-suggestions"
          className="lg:col-span-5 rounded-2xl border bg-white p-5 shadow-xs space-y-4"
          style={{ borderColor: "var(--border-color)" }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                <Lightbulb size={15} />
              </div>
              <div>
                <h2 className="text-sm font-bold text-brand-950">Category Suggestions</h2>
                <p className="text-[11px] text-brand-500">Based on competitor analysis and local search trends.</p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleApplySelectedSuggestions}
              disabled={selectedSuggestionIds.length === 0}
              className={cn(
                "inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-xs transition-all",
                selectedSuggestionIds.length > 0
                  ? "bg-blue-600 text-white hover:bg-blue-700"
                  : "bg-brand-100 text-brand-400 cursor-not-allowed"
              )}
            >
              <Plus size={13} />
              <span>Select & Add</span>
            </button>
          </div>

          <div className="space-y-2.5 pt-1">
            {suggestions.map((sug) => {
              const isChecked = selectedSuggestionIds.includes(sug.id);
              const alreadyAdded = categories.some((c) => c.name.toLowerCase() === sug.name.toLowerCase());

              return (
                <div
                  key={sug.id}
                  onClick={() => !alreadyAdded && handleToggleSuggestion(sug.id)}
                  className={cn(
                    "flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer",
                    alreadyAdded
                      ? "bg-brand-50/60 border-brand-100 opacity-60 cursor-default"
                      : isChecked
                      ? "bg-blue-50/40 border-blue-300"
                      : "bg-white border-brand-100 hover:border-brand-200"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={isChecked || alreadyAdded}
                      disabled={alreadyAdded}
                      onChange={() => {}}
                      className="w-4 h-4 rounded text-blue-600 border-brand-300 focus:ring-blue-500"
                    />
                    <div>
                      <h4 className="text-xs font-bold text-brand-950">{sug.name}</h4>
                      <p className="text-[11px] text-brand-500">{sug.description}</p>
                    </div>
                  </div>

                  <span
                    className={cn(
                      "text-[10px] font-semibold px-2 py-0.5 rounded-md whitespace-nowrap",
                      sug.matchScore === "High Match"
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : sug.matchScore === "Medium Match"
                        ? "bg-amber-50 text-amber-700 border border-amber-200"
                        : "bg-slate-50 text-slate-700 border border-slate-200"
                    )}
                  >
                    {alreadyAdded ? "Added" : sug.matchScore}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Bottom Row (Row 3): Competitor Category Comparison & Visibility Impact ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left (7 cols): Competitor Category Comparison */}
        <div
          className="lg:col-span-7 rounded-2xl border bg-white p-5 shadow-xs space-y-4"
          style={{ borderColor: "var(--border-color)" }}
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-brand-950">Competitor Category Comparison</h2>
              <p className="text-xs text-brand-500">See how your categories compare with top local competitors.</p>
            </div>
            <a
              href="?tab=competitors"
              className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700"
            >
              <span>View All Competitors</span>
              <ArrowRight size={12} />
            </a>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-brand-100 text-[11px] font-bold text-brand-500 uppercase tracking-wider">
                  <th className="pb-2.5 font-semibold">Business</th>
                  <th className="pb-2.5 font-semibold">Primary Category</th>
                  <th className="pb-2.5 font-semibold">Secondary Categories</th>
                  <th className="pb-2.5 font-semibold text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-50">
                {competitorCategoriesList.map((row, idx) => (
                  <tr
                    key={idx}
                    className={cn(
                      "hover:bg-brand-50/50 transition-colors",
                      row.isCurrentBusiness ? "bg-emerald-50/40 font-semibold" : ""
                    )}
                  >
                    <td className="py-3 pr-2">
                      <div className="flex items-center gap-2">
                        <div
                          className={cn(
                            "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0",
                            row.avatarColor
                          )}
                        >
                          {row.name.charAt(0)}
                        </div>
                        <span className="text-xs text-brand-950 truncate max-w-[130px]">{row.name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-2 text-brand-700">{row.primaryCategory}</td>
                    <td className="py-3 px-2 text-brand-500 max-w-[200px] truncate">
                      {row.secondaryCategories.join(", ")}
                    </td>
                    <td className="py-3 pl-2 text-right font-bold text-brand-950">{row.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right (5 cols): How Categories Impact Visibility & AI Banner */}
        <div className="lg:col-span-5 space-y-4">
          <div
            className="rounded-2xl border bg-white p-5 shadow-xs space-y-4"
            style={{ borderColor: "var(--border-color)" }}
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-brand-950">How Categories Impact Visibility</h2>
                <p className="text-[11px] text-brand-500">More relevant categories = more search visibility.</p>
              </div>
            </div>

            <div className="flex items-center gap-4 text-[11px] font-medium pt-1">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                <span className="text-brand-700">Your Business</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-200" />
                <span className="text-brand-500">Top Competitors (Avg)</span>
              </div>
            </div>

            {/* Bar Chart Visualization */}
            <div className="h-44 flex items-end justify-between gap-3 pt-4 px-2 border-b border-brand-100">
              {visibilityMetrics.map((metric, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                  <div className="w-full flex items-end justify-center gap-1 h-32">
                    {/* Your Business Bar */}
                    <div
                      className="w-3 rounded-t bg-blue-600 transition-all hover:opacity-90"
                      style={{ height: `${metric.youHeightPct}%` }}
                      title={`Your Business: ${metric.youVal.toLocaleString()}`}
                    />
                    {/* Competitor Avg Bar */}
                    <div
                      className="w-3 rounded-t bg-slate-200 transition-all hover:bg-slate-300"
                      style={{ height: `${metric.compHeightPct}%` }}
                      title={`Competitors: ${metric.compVal.toLocaleString()}`}
                    />
                  </div>
                  <span className="text-[9px] font-medium text-brand-500 truncate w-full text-center">
                    {metric.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* AI Banner */}
          <div className="rounded-2xl border border-purple-200 bg-gradient-to-r from-purple-50 via-purple-50/50 to-indigo-50 p-4 shadow-xs flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-purple-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <Sparkles size={18} />
              </div>
              <div>
                <h4 className="text-xs font-bold text-purple-950">Add Relevant Categories to Get More Visibility</h4>
                <p className="text-[11px] text-purple-800/80">
                  Businesses with optimized categories get 2.3x more profile views on average.
                </p>
              </div>
            </div>

            <a
              href="?tab=ai-recommendations"
              className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-purple-600 text-white text-xs font-bold hover:bg-purple-700 transition-all shrink-0 shadow-xs"
            >
              <span>Get AI Recommendations</span>
              <ArrowRight size={12} />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
