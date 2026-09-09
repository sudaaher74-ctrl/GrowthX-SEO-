"use client";

import React, { useState } from "react";
import {
  Upload,
  Search,
  ChevronDown,
  MoreVertical,
  ArrowRight,
  TrendingUp,
  Camera,
  Video,
  Users,
  Store,
  Utensils,
  Package,
  Sparkles,
  Check,
  Plus,
} from "lucide-react";
import { CircularScoreGauge } from "../circular-score-gauge";
import type { LocalSeoData } from "@/lib/api-client";
import { cn } from "@/lib/utils";

interface PhotosTabProps {
  localSeo: LocalSeoData | null | undefined;
}

export function PhotosTab({ localSeo }: PhotosTabProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [sortOrder, setSortOrder] = useState("newest");
  const [isUploading, setIsUploading] = useState(false);

  const photoScore = localSeo ? 65 : null;
  const totalPhotos = localSeo ? 42 : null;
  const photoViews = localSeo ? "12.4K" : "—";
  const customerActions = localSeo ? "1,024" : "—";

  const photoCategories = [
    { name: "Exterior", count: localSeo ? 6 : 0, color: "bg-blue-500", percent: 14 },
    { name: "Interior", count: localSeo ? 8 : 0, color: "bg-emerald-500", percent: 19 },
    { name: "Products", count: localSeo ? 12 : 0, color: "bg-purple-500", percent: 28 },
    { name: "Team", count: localSeo ? 4 : 0, color: "bg-amber-400", percent: 10 },
    { name: "Food/Menu", count: localSeo ? 10 : 0, color: "bg-rose-500", percent: 24 },
    { name: "Other", count: localSeo ? 2 : 0, color: "bg-slate-400", percent: 5 },
  ];

  const photoCards = [
    { title: "Store Frontage", category: "Exterior", timeAgo: "3 days ago", color: "from-blue-600 to-indigo-700" },
    { title: "Aisle Display", category: "Interior", timeAgo: "1 week ago", color: "from-emerald-600 to-teal-700" },
    { title: "Fresh Products", category: "Product", timeAgo: "1 week ago", color: "from-amber-500 to-orange-600" },
    { title: "Store Team", category: "Team", timeAgo: "2 weeks ago", color: "from-purple-600 to-indigo-800" },
    { title: "Organic Milk Bottles", category: "Product", timeAgo: "2 weeks ago", color: "from-cyan-600 to-blue-700" },
    { title: "Delivery Van", category: "Exterior", timeAgo: "1 month ago", color: "from-teal-600 to-emerald-700" },
  ];

  return (
    <div className="space-y-6">
      {/* ── Top Row: Score + Metrics + Categories Breakdown ────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Photo Optimization Score */}
        <div className="rounded-2xl border bg-white p-5 shadow-xs flex flex-col justify-between" style={{ borderColor: "var(--border-color)" }}>
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-xs font-bold uppercase tracking-wider text-brand-500">
              Photo Optimization Score
            </h3>
            {localSeo ? (
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 border border-amber-200">
                Needs Attention
              </span>
            ) : (
              <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-semibold text-brand-600">
                Not Connected
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 my-auto">
            <CircularScoreGauge score={photoScore} size={84} strokeWidth={8} />
            <p className="text-[11px] text-brand-600 leading-tight">
              {localSeo
                ? "You have a good number of photos, but adding more recent and diverse photos can significantly improve engagement."
                : "Connect your profile to evaluate photo freshness and coverage."}
            </p>
          </div>

          <div className="mt-3 pt-2 border-t border-brand-100">
            <button
              type="button"
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              <span>View Suggestions</span>
              <ArrowRight size={12} />
            </button>
          </div>
        </div>

        {/* Total Photos */}
        <div className="rounded-2xl border bg-white p-5 shadow-xs flex flex-col justify-between" style={{ borderColor: "var(--border-color)" }}>
          <div>
            <div className="flex items-center gap-1.5 text-xs font-medium text-brand-500">
              <Camera size={14} className="text-blue-600" />
              <span>Total Photos</span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono tracking-tight text-brand-950">
                {totalPhotos != null ? totalPhotos : "—"}
              </span>
              {localSeo && (
                <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-1.5 py-0.2 text-[10px] font-bold text-emerald-700">
                  <TrendingUp size={10} />
                  +12 vs last 28d
                </span>
              )}
            </div>
            <p className="text-[11px] text-brand-400 mt-0.5">High-resolution uploads</p>
          </div>

          <div className="mt-3 pt-2">
            <svg className="w-full h-8 text-blue-500 overflow-visible" viewBox="0 0 100 24" fill="none">
              <path d="M0 20 Q 30 18, 60 10 T 100 4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              <path d="M0 20 Q 30 18, 60 10 T 100 4 L 100 24 L 0 24 Z" fill="currentColor" fillOpacity="0.08" />
            </svg>
          </div>
        </div>

        {/* Photo Views */}
        <div className="rounded-2xl border bg-white p-5 shadow-xs flex flex-col justify-between" style={{ borderColor: "var(--border-color)" }}>
          <div>
            <div className="flex items-center gap-1.5 text-xs font-medium text-brand-500">
              <Camera size={14} className="text-purple-600" />
              <span>Photo Views</span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono tracking-tight text-brand-950">
                {photoViews}
              </span>
              {localSeo && (
                <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-1.5 py-0.2 text-[10px] font-bold text-emerald-700">
                  <TrendingUp size={10} />
                  +27% vs last 28d
                </span>
              )}
            </div>
            <p className="text-[11px] text-brand-400 mt-0.5">Monthly impression volume</p>
          </div>

          <div className="mt-3 pt-2">
            <svg className="w-full h-8 text-purple-500 overflow-visible" viewBox="0 0 100 24" fill="none">
              <path d="M0 18 Q 25 15, 55 12 T 100 5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              <path d="M0 18 Q 25 15, 55 12 T 100 5 L 100 24 L 0 24 Z" fill="currentColor" fillOpacity="0.08" />
            </svg>
          </div>
        </div>

        {/* Customer Actions */}
        <div className="rounded-2xl border bg-white p-5 shadow-xs flex flex-col justify-between" style={{ borderColor: "var(--border-color)" }}>
          <div>
            <div className="flex items-center gap-1.5 text-xs font-medium text-brand-500">
              <Users size={14} className="text-emerald-600" />
              <span>Customer Actions</span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono tracking-tight text-brand-950">
                {customerActions}
              </span>
              {localSeo && (
                <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-1.5 py-0.2 text-[10px] font-bold text-emerald-700">
                  <TrendingUp size={10} />
                  +18% vs last 28d
                </span>
              )}
            </div>
            <p className="text-[11px] text-brand-400 mt-0.5">Clicks & directions from photos</p>
          </div>

          <div className="mt-3 pt-2">
            <svg className="w-full h-8 text-emerald-500 overflow-visible" viewBox="0 0 100 24" fill="none">
              <path d="M0 16 Q 30 14, 60 10 T 100 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              <path d="M0 16 Q 30 14, 60 10 T 100 6 L 100 24 L 0 24 Z" fill="currentColor" fillOpacity="0.08" />
            </svg>
          </div>
        </div>

        {/* Photo Categories Breakdown */}
        <div className="rounded-2xl border bg-white p-5 shadow-xs flex flex-col justify-between" style={{ borderColor: "var(--border-color)" }}>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-brand-500 mb-2">
              Photo Categories
            </h3>
            <div className="space-y-1.5">
              {photoCategories.map((cat) => (
                <div key={cat.name} className="flex items-center justify-between text-xs">
                  <span className="text-brand-700 font-medium text-[11px]">{cat.name}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-16 bg-brand-100 h-1.5 rounded-full overflow-hidden">
                      <div className={cn("h-full rounded-full", cat.color)} style={{ width: `${cat.percent}%` }} />
                    </div>
                    <span className="font-mono text-[10px] font-bold text-brand-950 w-4 text-right">
                      {cat.count}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Toolbar: Search + Filter + Upload ──────────────────────── */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-2xl border shadow-xs" style={{ borderColor: "var(--border-color)" }}>
        <div className="flex items-center gap-2 w-full sm:w-auto flex-1 max-w-md">
          <div className="relative w-full">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-400" />
            <input
              type="text"
              placeholder="Search photos..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-9 pl-9 pr-3 text-xs rounded-lg border border-brand-200 bg-white focus:outline-none focus:ring-1 focus:ring-brand-950"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="h-9 px-3 text-xs rounded-lg border border-brand-200 bg-white font-medium text-brand-700 focus:outline-none"
          >
            <option value="all">All Categories</option>
            <option value="exterior">Exterior</option>
            <option value="interior">Interior</option>
            <option value="products">Products</option>
            <option value="team">Team</option>
            <option value="food">Food/Menu</option>
          </select>

          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            className="h-9 px-3 text-xs rounded-lg border border-brand-200 bg-white font-medium text-brand-700 focus:outline-none"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="views">Most Viewed</option>
          </select>

          <button
            type="button"
            onClick={() => setIsUploading(true)}
            className="h-9 px-3.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-xs"
          >
            <Upload size={13} />
            <span>Upload Photos</span>
          </button>
        </div>
      </div>

      {/* ── Photos Grid ─────────────────────────────────────────────── */}
      <div className="rounded-2xl border bg-white p-5 shadow-xs" style={{ borderColor: "var(--border-color)" }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-brand-950">
            Your Photos {totalPhotos != null && `(${totalPhotos})`}
          </h3>
          <button type="button" className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1">
            <span>View All</span>
            <ArrowRight size={12} />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3.5">
          {photoCards.map((card, i) => (
            <div
              key={card.title}
              className="group relative rounded-xl overflow-hidden border border-brand-200 aspect-square flex flex-col justify-between p-2.5 transition shadow-2xs hover:shadow-md"
            >
              {/* Background gradient simulating photo thumbnail */}
              <div className={cn("absolute inset-0 bg-gradient-to-br opacity-85 group-hover:scale-105 transition-transform duration-300", card.color)} />

              <div className="relative flex items-center justify-between z-10">
                <span className="rounded-md bg-black/50 text-white text-[9px] font-bold px-1.5 py-0.5">
                  {card.category}
                </span>
                <button type="button" className="text-white/80 hover:text-white">
                  <MoreVertical size={13} />
                </button>
              </div>

              <div className="relative z-10 text-white">
                <p className="text-[11px] font-bold truncate leading-tight">{card.title}</p>
                <p className="text-[9.5px] text-white/75 mt-0.5">{card.timeAgo}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Bottom Row: Missing Opportunities + Benchmark + AI Recs ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Missing Photo Opportunities (4 cols) */}
        <div className="lg:col-span-4 rounded-2xl border bg-white p-5 shadow-xs flex flex-col justify-between" style={{ borderColor: "var(--border-color)" }}>
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <Camera size={14} className="text-rose-500" />
              <h3 className="text-sm font-bold text-brand-950">Missing Photo Opportunities</h3>
            </div>
            <p className="text-xs text-brand-400 mb-3">Add these types of photos to improve your profile.</p>

            <div className="grid grid-cols-2 gap-2.5">
              {[
                { name: "Exterior", desc: "Add storefront photo", icon: Store, color: "text-blue-600 bg-blue-50" },
                { name: "Interior", desc: "Show your store inside", icon: Camera, color: "text-emerald-600 bg-emerald-50" },
                { name: "Team", desc: "Add team photos", icon: Users, color: "text-purple-600 bg-purple-50" },
                { name: "Products", desc: "Show more products", icon: Package, color: "text-amber-600 bg-amber-50" },
                { name: "Food/Menu", desc: "Add menu items", icon: Utensils, color: "text-rose-600 bg-rose-50" },
                { name: "Video", desc: "Add a short video", icon: Video, color: "text-indigo-600 bg-indigo-50" },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.name}
                    className="p-2.5 rounded-xl border border-brand-100 hover:bg-brand-50 cursor-pointer transition flex items-start gap-2"
                  >
                    <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center shrink-0", item.color)}>
                      <Icon size={14} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-brand-950 truncate">{item.name}</p>
                      <p className="text-[10px] text-brand-500 truncate">{item.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Recent Photos vs Competitors Benchmark (4 cols) */}
        <div className="lg:col-span-4 rounded-2xl border bg-white p-5 shadow-xs flex flex-col justify-between" style={{ borderColor: "var(--border-color)" }}>
          <div>
            <h3 className="text-sm font-bold text-brand-950 mb-1">Recent Photos vs Competitors</h3>
            <div className="flex items-center gap-3 text-[10px] font-semibold text-brand-600 mb-3">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded bg-blue-600" /> Your Business
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded bg-brand-200" /> Top Competitors (Avg)
              </span>
            </div>

            {/* Benchmark Bar Chart Simulation */}
            <div className="space-y-3 pt-2">
              {[
                { label: "Total", client: 42, rival: 75 },
                { label: "Exterior", client: 6, rival: 14 },
                { label: "Interior", client: 8, rival: 20 },
                { label: "Products", client: 12, rival: 25 },
                { label: "Team", client: 4, rival: 12 },
              ].map((row) => (
                <div key={row.label} className="space-y-1">
                  <div className="flex justify-between text-xs font-medium text-brand-700">
                    <span>{row.label}</span>
                    <span className="font-mono text-[10px]">
                      {row.client} vs {row.rival}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1 h-2">
                    <div className="bg-brand-100 rounded-full overflow-hidden">
                      <div
                        className="bg-blue-600 h-full rounded-full"
                        style={{ width: `${Math.min(100, (row.client / row.rival) * 100)}%` }}
                      />
                    </div>
                    <div className="bg-brand-100 rounded-full overflow-hidden">
                      <div className="bg-brand-300 h-full rounded-full" style={{ width: "100%" }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* AI Photo Recommendations (4 cols) */}
        <div className="lg:col-span-4 rounded-2xl border bg-white p-5 shadow-xs flex flex-col justify-between" style={{ borderColor: "var(--border-color)" }}>
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <Sparkles size={14} className="text-purple-600" />
                <h3 className="text-sm font-bold text-brand-950">AI Recommendations</h3>
              </div>
              <button type="button" className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1">
                <span>View All</span>
                <ArrowRight size={12} />
              </button>
            </div>

            <div className="space-y-2.5">
              {[
                "Add more exterior photos of your storefront",
                "Upload photos of fresh products & premises",
                "Add team photos to build customer trust",
                "Keep photos updated regularly (at least 1 per week)",
                "Add a short video showcasing your store",
                "Show real customer photos (with permission)",
              ].map((rec, i) => (
                <div key={rec} className="flex items-start gap-2 text-xs text-brand-800">
                  <span className="w-5 h-5 rounded-full bg-purple-50 text-purple-700 font-mono text-[10px] font-bold flex items-center justify-center shrink-0 border border-purple-200">
                    {i + 1}
                  </span>
                  <span className="pt-0.5 leading-snug">{rec}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
