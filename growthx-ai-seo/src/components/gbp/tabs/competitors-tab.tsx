"use client";

import React, { useState } from "react";
import {
  Users,
  Search,
  Star,
  Trophy,
  ExternalLink,
  Plus,
  Trash2,
  Sparkles,
  MapPin,
  TrendingUp,
  TrendingDown,
  MoreVertical,
  ArrowRight,
  Minus,
  Crosshair,
  Crown,
  Eye,
  Check,
} from "lucide-react";
import { useSearchLocalBusiness } from "@/hooks/use-growthx";
import type { LocalSeoData } from "@/lib/api-client";
import { cn } from "@/lib/utils";

interface CompetitorsTabProps {
  localSeo: LocalSeoData | null | undefined;
  projectId: string | null;
}

interface CompetitorListing {
  id: string;
  rank: number;
  name: string;
  isCurrentBusiness?: boolean;
  rating: number;
  reviews: number;
  category: string;
  distanceKm: number;
  avatarColor: string;
  photoUrl?: string;
  pinType: "you" | "top" | "other";
  mapX: number; // percentage on map
  mapY: number; // percentage on map
}

interface ComparisonMetricRow {
  metric: string;
  youVal: string | number;
  topVal: string | number;
  avgVal: string | number;
  isTrend?: boolean;
}

export function CompetitorsTab({ localSeo, projectId }: CompetitorsTabProps) {
  const businessName = localSeo?.businessName || "MilQuu Fresh";
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All Categories");

  // Competitors directory
  const [competitors, setCompetitors] = useState<CompetitorListing[]>([
    {
      id: "c-1",
      rank: 1,
      name: "Just Fresh Dairy",
      rating: 4.6,
      reviews: 1240,
      category: "Dairy store",
      distanceKm: 1.2,
      avatarColor: "bg-rose-600 text-white",
      pinType: "top",
      mapX: 42,
      mapY: 28,
    },
    {
      id: "c-2",
      rank: 2,
      name: "Pune Milk Point",
      rating: 4.5,
      reviews: 892,
      category: "Dairy products supplier",
      distanceKm: 1.8,
      avatarColor: "bg-blue-600 text-white",
      pinType: "other",
      mapX: 62,
      mapY: 34,
    },
    {
      id: "c-3",
      rank: 3,
      name: `${businessName} (You)`,
      isCurrentBusiness: true,
      rating: 4.4,
      reviews: 327,
      category: "Milk delivery service",
      distanceKm: 2.1,
      avatarColor: "bg-emerald-600 text-white",
      pinType: "you",
      mapX: 48,
      mapY: 42,
    },
    {
      id: "c-4",
      rank: 4,
      name: "A2 Dairy",
      rating: 4.3,
      reviews: 486,
      category: "Dairy store",
      distanceKm: 2.4,
      avatarColor: "bg-amber-600 text-white",
      pinType: "other",
      mapX: 34,
      mapY: 52,
    },
    {
      id: "c-5",
      rank: 5,
      name: "Fresh Farm Milk",
      rating: 4.2,
      reviews: 421,
      category: "Organic food store",
      distanceKm: 2.8,
      avatarColor: "bg-emerald-700 text-white",
      pinType: "other",
      mapX: 54,
      mapY: 60,
    },
    {
      id: "c-6",
      rank: 6,
      name: "Daily Needs Store",
      rating: 4.1,
      reviews: 389,
      category: "Grocery store",
      distanceKm: 3.1,
      avatarColor: "bg-indigo-600 text-white",
      pinType: "other",
      mapX: 68,
      mapY: 68,
    },
    {
      id: "c-7",
      rank: 7,
      name: "Pure Milk Hub",
      rating: 4.1,
      reviews: 362,
      category: "Dairy products supplier",
      distanceKm: 3.4,
      avatarColor: "bg-cyan-600 text-white",
      pinType: "other",
      mapX: 38,
      mapY: 72,
    },
    {
      id: "c-8",
      rank: 8,
      name: "Farm Fresh Mart",
      rating: 4.0,
      reviews: 298,
      category: "Grocery store",
      distanceKm: 3.8,
      avatarColor: "bg-slate-700 text-white",
      pinType: "other",
      mapX: 74,
      mapY: 82,
    },
  ]);

  // Metric Comparison Table Rows
  const comparisonRows: ComparisonMetricRow[] = [
    { metric: "Rating", youVal: "4.4", topVal: "4.6", avgVal: "4.3" },
    { metric: "Total Reviews", youVal: "327", topVal: "1,240", avgVal: "842" },
    { metric: "Review Growth (28d)", youVal: "+12%", topVal: "+28%", avgVal: "+18%", isTrend: true },
    { metric: "Photos", youVal: "42", topVal: "156", avgVal: "98" },
    { metric: "Services", youVal: "8", topVal: "14", avgVal: "11" },
    { metric: "Categories", youVal: "3", topVal: "5", avgVal: "4" },
    { metric: "Posts (30d)", youVal: "4", topVal: "12", avgVal: "7" },
  ];

  // Top 3 for the 3-Pack cards
  const top3Competitors = competitors.slice(0, 3);

  // Filtered list
  const filteredCompetitors = competitors.filter((c) => {
    const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCat = categoryFilter === "All Categories" || c.category.toLowerCase() === categoryFilter.toLowerCase();
    return matchesSearch && matchesCat;
  });

  return (
    <div className="space-y-6">
      {/* ── Top Metric Cards (Row 1) ─────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Competitors */}
        <div
          className="rounded-2xl border bg-white p-5 shadow-xs flex flex-col justify-between"
          style={{ borderColor: "var(--border-color)" }}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-brand-600">Total Competitors</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Users size={16} />
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-2xl font-black tracking-tight text-brand-950">12</div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
                <TrendingUp size={13} />
                <span>+2 vs last 28 days</span>
              </div>
              {/* Mini vertical bar chart purple */}
              <div className="flex items-end gap-1 h-6">
                <span className="w-1.5 h-3 rounded-xs bg-purple-200" />
                <span className="w-1.5 h-4 rounded-xs bg-purple-300" />
                <span className="w-1.5 h-5 rounded-xs bg-purple-400" />
                <span className="w-1.5 h-6 rounded-xs bg-purple-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Average Rating (Competitors) */}
        <div
          className="rounded-2xl border bg-white p-5 shadow-xs flex flex-col justify-between"
          style={{ borderColor: "var(--border-color)" }}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-brand-600">Average Rating (Competitors)</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-500 flex items-center justify-center">
              <Star size={16} className="fill-amber-400" />
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-2xl font-black tracking-tight text-brand-950">4.2 / 5</div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-600">
                <TrendingDown size={13} />
                <span>-0.1 vs last 28 days</span>
              </div>
              {/* Mini vertical bar chart yellow */}
              <div className="flex items-end gap-1 h-6">
                <span className="w-1.5 h-5 rounded-xs bg-amber-200" />
                <span className="w-1.5 h-6 rounded-xs bg-amber-300" />
                <span className="w-1.5 h-4 rounded-xs bg-amber-400" />
                <span className="w-1.5 h-5 rounded-xs bg-amber-500" />
              </div>
            </div>
          </div>
        </div>

        {/* Card 3: Average Reviews */}
        <div
          className="rounded-2xl border bg-white p-5 shadow-xs flex flex-col justify-between"
          style={{ borderColor: "var(--border-color)" }}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-brand-600">Average Reviews</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Users size={16} />
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-2xl font-black tracking-tight text-brand-950">842</div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
                <TrendingUp size={13} />
                <span>+18% vs last 28 days</span>
              </div>
              {/* Mini vertical bar chart blue */}
              <div className="flex items-end gap-1 h-6">
                <span className="w-1.5 h-3 rounded-xs bg-blue-200" />
                <span className="w-1.5 h-4 rounded-xs bg-blue-300" />
                <span className="w-1.5 h-5 rounded-xs bg-blue-400" />
                <span className="w-1.5 h-6 rounded-xs bg-blue-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Card 4: Businesses in 3-Pack */}
        <div
          className="rounded-2xl border bg-white p-5 shadow-xs flex flex-col justify-between"
          style={{ borderColor: "var(--border-color)" }}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-brand-600">Businesses in 3-Pack</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <MapPin size={16} />
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-2xl font-black tracking-tight text-brand-950">3</div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
                <TrendingUp size={13} />
                <span>+1 vs last 28 days</span>
              </div>
              {/* Mini vertical bar chart green */}
              <div className="flex items-end gap-1 h-6">
                <span className="w-1.5 h-3 rounded-xs bg-emerald-200" />
                <span className="w-1.5 h-4 rounded-xs bg-emerald-300" />
                <span className="w-1.5 h-5 rounded-xs bg-emerald-400" />
                <span className="w-1.5 h-6 rounded-xs bg-emerald-600" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Middle Row (Row 2): Map View & Top 3 Map Pack ────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left (5 cols): Map View */}
        <div
          className="lg:col-span-5 rounded-2xl border bg-white p-5 shadow-xs space-y-3"
          style={{ borderColor: "var(--border-color)" }}
        >
          <div>
            <h2 className="text-sm font-bold text-brand-950">Map View</h2>
            <p className="text-[11px] text-brand-500">See where your business and competitors appear on Google Maps.</p>
          </div>

          <div className="relative w-full h-64 rounded-xl overflow-hidden border border-brand-100 bg-[#E8ECEF]">
            {/* Map Roads & Rivers */}
            <svg className="absolute inset-0 w-full h-full opacity-50" preserveAspectRatio="none" viewBox="0 0 300 200">
              <path d="M 0 120 Q 80 140 150 110 T 300 80" stroke="#C6D8E8" strokeWidth="10" fill="none" />
              <path d="M 0 40 L 300 90" stroke="#FFFFFF" strokeWidth="3" fill="none" />
              <path d="M 60 0 L 180 200" stroke="#FFFFFF" strokeWidth="3" fill="none" />
              <path d="M 220 0 L 100 200" stroke="#FFFFFF" strokeWidth="3" fill="none" />
              <path d="M 0 160 L 300 140" stroke="#FFFFFF" strokeWidth="3" fill="none" />
            </svg>

            {/* Suburb labels */}
            <span className="absolute left-6 top-6 text-[9px] font-bold text-slate-500">BANER</span>
            <span className="absolute left-28 top-4 text-[9px] font-bold text-slate-500">AUNDH</span>
            <span className="absolute left-10 top-24 text-[9px] font-bold text-slate-500">KOTHRUD</span>
            <span className="absolute right-10 top-16 text-[9px] font-bold text-slate-500">VIMAN NAGAR</span>
            <span className="absolute right-12 bottom-8 text-[9px] font-bold text-slate-500">HADAPSAR</span>

            {/* Pins on Map */}
            {competitors.map((c) => (
              <div
                key={c.id}
                style={{ left: `${c.mapX}%`, top: `${c.mapY}%` }}
                className={cn(
                  "absolute -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black text-white shadow-md cursor-pointer transition-transform hover:scale-125 z-10",
                  c.pinType === "you"
                    ? "bg-emerald-600 ring-2 ring-white"
                    : c.pinType === "top"
                    ? "bg-rose-600 ring-2 ring-white"
                    : "bg-blue-600 ring-2 ring-white"
                )}
                title={`${c.name} (${c.rating}★)`}
              >
                {c.pinType === "you" ? "M" : c.rank}
              </div>
            ))}

            {/* Floating Legend (Top Right) */}
            <div className="absolute right-3 top-3 bg-white/95 backdrop-blur-xs p-2.5 rounded-lg border border-brand-100 shadow-sm text-[10px] space-y-1 z-20">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
                <span className="text-brand-700 font-medium">Your Business</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-600" />
                <span className="text-brand-700 font-medium">Top Competitor</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                <span className="text-brand-700 font-medium">Other Competitors</span>
              </div>
            </div>

            {/* Zoom Controls */}
            <div className="absolute right-3 bottom-3 flex flex-col gap-1 z-20">
              <button
                type="button"
                className="w-6 h-6 rounded-md bg-white shadow-xs border border-brand-100 flex items-center justify-center text-brand-700 hover:bg-brand-50 text-xs"
              >
                +
              </button>
              <button
                type="button"
                className="w-6 h-6 rounded-md bg-white shadow-xs border border-brand-100 flex items-center justify-center text-brand-700 hover:bg-brand-50 text-xs"
              >
                -
              </button>
              <button
                type="button"
                className="w-6 h-6 rounded-md bg-white shadow-xs border border-brand-100 flex items-center justify-center text-brand-700 hover:bg-brand-50"
              >
                <Crosshair size={11} />
              </button>
            </div>
          </div>
        </div>

        {/* Right (7 cols): Top 3 Map Pack */}
        <div
          className="lg:col-span-7 rounded-2xl border bg-white p-5 shadow-xs space-y-3"
          style={{ borderColor: "var(--border-color)" }}
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-brand-950">Top 3 Map Pack</h2>
              <p className="text-[11px] text-brand-500">Businesses appearing in the top 3 for your target keywords.</p>
            </div>
            <a
              href="https://google.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700"
            >
              <span>View on Google</span>
              <ArrowRight size={11} />
            </a>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            {top3Competitors.map((item) => (
              <div
                key={item.id}
                className={cn(
                  "rounded-xl border p-3 flex flex-col justify-between space-y-3 bg-white hover:shadow-2xs transition-all relative",
                  item.isCurrentBusiness ? "border-blue-200 bg-blue-50/20" : "border-brand-100"
                )}
              >
                {/* Storefront banner placeholder */}
                <div className="relative w-full h-24 rounded-lg bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center overflow-hidden border border-brand-100">
                  <div className="absolute top-2 left-2 w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-xs">
                    <Crown size={12} />
                  </div>
                  <span className="text-2xl font-black text-slate-400/70">{item.name.charAt(0)}</span>
                </div>

                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-brand-950 truncate">{item.name}</h4>
                  <div className="flex items-center gap-1 text-[11px] font-semibold text-brand-700">
                    <span>{item.rating}</span>
                    <Star size={11} className="fill-amber-400 text-amber-400" />
                    <span className="text-brand-400 text-[10px]">({item.reviews.toLocaleString()})</span>
                  </div>
                  <p className="text-[10px] text-brand-500 truncate">{item.category}</p>
                  <p className="text-[10px] text-brand-400">{item.distanceKm} km</p>
                </div>

                <div className="flex items-center gap-1.5 pt-1">
                  <button
                    type="button"
                    className="flex-1 py-1 text-[10px] font-semibold rounded-lg border border-brand-200 bg-white text-brand-700 hover:bg-brand-50"
                  >
                    View Profile
                  </button>
                  {item.isCurrentBusiness ? (
                    <button
                      type="button"
                      className="flex-1 py-1 text-[10px] font-semibold rounded-lg bg-brand-950 text-white hover:opacity-90 shadow-2xs"
                    >
                      Optimize
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="flex-1 py-1 text-[10px] font-semibold rounded-lg border border-brand-200 bg-white text-brand-700 hover:bg-brand-50"
                    >
                      Analyze
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Bottom Row (Row 3): All Competitors Table & Comparison / Insights ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left (7 cols): All Competitors Table */}
        <div
          className="lg:col-span-7 rounded-2xl border bg-white p-5 shadow-xs space-y-4"
          style={{ borderColor: "var(--border-color)" }}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="text-sm font-bold text-brand-950">All Competitors ({competitors.length})</h2>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-brand-400" />
                <input
                  type="text"
                  placeholder="Search competitors..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 pl-7 pr-2.5 text-xs rounded-lg border border-brand-200 bg-white focus:outline-none focus:ring-1 focus:ring-brand-950 w-36 sm:w-44"
                />
              </div>

              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="h-8 px-2 text-xs rounded-lg border border-brand-200 bg-white font-medium text-brand-800 focus:outline-none"
              >
                <option value="All Categories">All Categories</option>
                <option value="Dairy store">Dairy store</option>
                <option value="Dairy products supplier">Dairy products supplier</option>
                <option value="Milk delivery service">Milk delivery service</option>
                <option value="Grocery store">Grocery store</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-brand-100 text-[11px] font-bold text-brand-500">
                  <th className="pb-2.5 font-semibold text-center w-8">#</th>
                  <th className="pb-2.5 font-semibold">Business Name</th>
                  <th className="pb-2.5 font-semibold">Rating</th>
                  <th className="pb-2.5 font-semibold">Reviews</th>
                  <th className="pb-2.5 font-semibold">Categories</th>
                  <th className="pb-2.5 font-semibold">Distance</th>
                  <th className="pb-2.5 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-50">
                {filteredCompetitors.map((c) => (
                  <tr
                    key={c.id}
                    className={cn(
                      "hover:bg-brand-50/50 transition-colors",
                      c.isCurrentBusiness ? "bg-emerald-50/50 font-semibold" : ""
                    )}
                  >
                    <td className="py-2.5 text-center text-brand-600 font-bold">{c.rank}</td>
                    <td className="py-2.5">
                      <div className="flex items-center gap-2">
                        <div
                          className={cn(
                            "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0",
                            c.avatarColor
                          )}
                        >
                          {c.name.charAt(0)}
                        </div>
                        <span className="text-xs text-brand-950 truncate max-w-[140px]">{c.name}</span>
                      </div>
                    </td>
                    <td className="py-2.5">
                      <div className="flex items-center gap-1 font-semibold text-brand-800">
                        <Star size={11} className="fill-amber-400 text-amber-400" />
                        <span>{c.rating}</span>
                      </div>
                    </td>
                    <td className="py-2.5 text-brand-600 font-medium">{c.reviews.toLocaleString()}</td>
                    <td className="py-2.5 text-brand-500 max-w-[130px] truncate">{c.category}</td>
                    <td className="py-2.5 text-brand-500">{c.distanceKm} km</td>
                    <td className="py-2.5 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          className="px-2 py-0.5 text-[11px] font-semibold rounded-md border border-brand-200 bg-white text-blue-600 hover:bg-blue-50"
                        >
                          View
                        </button>
                        <button type="button" className="p-0.5 text-brand-400 hover:text-brand-700">
                          <MoreVertical size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right (5 cols): Competitor Comparison & AI Insights */}
        <div className="lg:col-span-5 space-y-4">
          {/* Competitor Comparison Card */}
          <div
            className="rounded-2xl border bg-white p-5 shadow-xs space-y-3"
            style={{ borderColor: "var(--border-color)" }}
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-brand-950">Competitor Comparison</h2>
                <p className="text-[11px] text-brand-500">Compare key metrics with top competitors.</p>
              </div>
              <a
                href="#detailed-comparison"
                className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-700"
              >
                <span>View Detailed Comparison</span>
                <ArrowRight size={11} />
              </a>
            </div>

            <div className="overflow-x-auto pt-1">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-brand-100 text-[10px] font-bold text-brand-500 uppercase">
                    <th className="pb-2 font-semibold">Metric</th>
                    <th className="pb-2 font-semibold text-center">You</th>
                    <th className="pb-2 font-semibold text-center">Top Competitor</th>
                    <th className="pb-2 font-semibold text-right">Avg (Top 5)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-50 text-[11px]">
                  {comparisonRows.map((row, idx) => (
                    <tr key={idx} className="hover:bg-brand-50/50">
                      <td className="py-2 text-brand-700 font-medium">{row.metric}</td>
                      <td className="py-2 text-center font-bold text-brand-950">
                        {row.isTrend ? (
                          <span className="text-emerald-600">{row.youVal}</span>
                        ) : (
                          row.youVal
                        )}
                      </td>
                      <td className="py-2 text-center text-brand-800">
                        {row.isTrend ? (
                          <span className="text-emerald-600">{row.topVal}</span>
                        ) : (
                          row.topVal
                        )}
                      </td>
                      <td className="py-2 text-right text-brand-500">
                        {row.isTrend ? (
                          <span className="text-emerald-600">{row.avgVal}</span>
                        ) : (
                          row.avgVal
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* AI Insights & Opportunities Card */}
          <div className="rounded-2xl border border-purple-200 bg-gradient-to-br from-purple-50/70 via-purple-50/40 to-indigo-50/50 p-5 shadow-xs flex flex-col justify-between space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <div className="w-5 h-5 rounded-md bg-purple-600 text-white flex items-center justify-center">
                  <Sparkles size={12} />
                </div>
                <h3 className="text-xs font-bold text-purple-950">AI Insights & Opportunities</h3>
              </div>
              <a href="?tab=ai-recommendations" className="text-[11px] font-bold text-blue-600 hover:text-blue-700">
                View All &rarr;
              </a>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-start gap-2.5">
                <span className="w-4 h-4 rounded-full bg-purple-200 text-purple-800 flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">
                  1
                </span>
                <span className="text-brand-800">Top competitor has 3.8x more reviews than your business.</span>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="w-4 h-4 rounded-full bg-purple-200 text-purple-800 flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">
                  2
                </span>
                <span className="text-brand-800">Competitors are using more secondary categories.</span>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="w-4 h-4 rounded-full bg-purple-200 text-purple-800 flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">
                  3
                </span>
                <span className="text-brand-800">Add more recent photos to improve visual presence.</span>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="w-4 h-4 rounded-full bg-purple-200 text-purple-800 flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">
                  4
                </span>
                <span className="text-brand-800">Your rating is good, but review volume is lower than competitors.</span>
              </div>
            </div>

            <a
              href="?tab=ai-recommendations"
              className="w-full h-9 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-xs"
            >
              <span>Get AI Recommendations</span>
              <ArrowRight size={13} />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
