"use client";

import React, { useState } from "react";
import {
  MapPin,
  Search,
  Zap,
  Loader2,
  Trophy,
  Compass,
  Star,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Minus,
  Plus,
  Crosshair,
  Sparkles,
  ArrowRight,
  Award,
  Store,
  Check,
} from "lucide-react";
import { useRunGeoGridScan } from "@/hooks/use-growthx";
import type { GeoGridScanResult, GridNode, LocalSeoData } from "@/lib/api-client";
import { cn } from "@/lib/utils";

interface LocalRankingsTabProps {
  localSeo: LocalSeoData | null | undefined;
  projectId: string | null;
}

interface TrackedKeyword {
  id: string;
  keyword: string;
  position: number;
  change: number;
  volume: string;
  intent: "Transactional" | "Commercial" | "Informational";
}

interface LocalPackListing {
  rank: number;
  name: string;
  rating: number;
  reviewCount: number;
  category: string;
  initials: string;
  badgeColor: string;
}

interface GridPoint {
  id: string;
  area: string;
  x: number; // percentage
  y: number; // percentage
  rank: number;
}

export function LocalRankingsTab({ localSeo, projectId }: LocalRankingsTabProps) {
  const businessName = localSeo?.businessName || "MilQuu Fresh";

  const [location, setLocation] = useState("Pune, Maharashtra, India");
  const [radius, setRadius] = useState("5 km");
  const [keywordGroup, setKeywordGroup] = useState("All Keywords");
  const [device, setDevice] = useState("Mobile & Desktop");
  const [selectedKeyword, setSelectedKeyword] = useState("fresh milk delivery near me");
  const [isUpdating, setIsUpdating] = useState(false);
  const [selectedKeywordIds, setSelectedKeywordIds] = useState<string[]>([]);

  // Keywords tracked
  const [keywords, setKeywords] = useState<TrackedKeyword[]>([
    {
      id: "kw-1",
      keyword: "fresh milk delivery near me",
      position: 2,
      change: 3,
      volume: "1.2K",
      intent: "Transactional",
    },
    {
      id: "kw-2",
      keyword: "milk home delivery pune",
      position: 3,
      change: 2,
      volume: "880",
      intent: "Transactional",
    },
    {
      id: "kw-3",
      keyword: "organic milk near me",
      position: 4,
      change: -1,
      volume: "720",
      intent: "Commercial",
    },
    {
      id: "kw-4",
      keyword: "A2 milk delivery pune",
      position: 5,
      change: 4,
      volume: "590",
      intent: "Commercial",
    },
    {
      id: "kw-5",
      keyword: "milk subscription pune",
      position: 3,
      change: -1,
      volume: "480",
      intent: "Transactional",
    },
    {
      id: "kw-6",
      keyword: "fresh dairy products",
      position: 6,
      change: 2,
      volume: "390",
      intent: "Informational",
    },
    {
      id: "kw-7",
      keyword: "cow milk home delivery",
      position: 2,
      change: 5,
      volume: "320",
      intent: "Transactional",
    },
    {
      id: "kw-8",
      keyword: "farm fresh milk pune",
      position: 4,
      change: 0,
      volume: "260",
      intent: "Commercial",
    },
    {
      id: "kw-9",
      keyword: "milk delivery Baner",
      position: 1,
      change: 2,
      volume: "210",
      intent: "Transactional",
    },
    {
      id: "kw-10",
      keyword: "milk delivery Kothrud",
      position: 3,
      change: 1,
      volume: "170",
      intent: "Transactional",
    },
  ]);

  // GeoGrid points across Pune map
  const gridPoints: GridPoint[] = [
    { id: "p1", area: "Wakad", x: 34, y: 16, rank: 2 },
    { id: "p2", area: "Baner", x: 38, y: 26, rank: 1 },
    { id: "p3", area: "Aundh", x: 44, y: 20, rank: 2 },
    { id: "p4", area: "Shivajinagar", x: 49, y: 18, rank: 2 },
    { id: "p5", area: "Viman Nagar", x: 57, y: 17, rank: 2 },
    { id: "p6", area: "Kalyani Nagar", x: 53, y: 26, rank: 6 },
    { id: "p7", area: "Hinjawadi", x: 32, y: 35, rank: 2 },
    { id: "p8", area: "Pashan", x: 40, y: 36, rank: 2 },
    { id: "p9", area: "Kothrud", x: 44, y: 40, rank: 2 },
    { id: "p10", area: "Pune Central", x: 49, y: 44, rank: 6 },
    { id: "p11", area: "Koregaon Park", x: 55, y: 38, rank: 4 },
    { id: "p12", area: "Bavdhan", x: 35, y: 48, rank: 2 },
    { id: "p13", area: "Warje", x: 32, y: 64, rank: 4 },
    { id: "p14", area: "Swargate", x: 40, y: 66, rank: 1 },
    { id: "p15", area: "Bibwewadi", x: 46, y: 69, rank: 2 },
    { id: "p16", area: "Hadapsar", x: 53, y: 64, rank: 2 },
    { id: "p17", area: "Kharadi", x: 58, y: 68, rank: 10 },
    { id: "p18", area: "Magarpatta", x: 51, y: 77, rank: 2 },
    { id: "p19", area: "Katraj", x: 43, y: 84, rank: 10 },
  ];

  // Local Pack preview listings
  const localPackList: LocalPackListing[] = [
    {
      rank: 1,
      name: `${businessName}`,
      rating: 4.8,
      reviewCount: 327,
      category: "Milk delivery service",
      initials: "MF",
      badgeColor: "bg-emerald-600",
    },
    {
      rank: 2,
      name: "A2 Dairy Point",
      rating: 4.5,
      reviewCount: 241,
      category: "Dairy farm",
      initials: "A2",
      badgeColor: "bg-slate-500",
    },
    {
      rank: 3,
      name: "Pune Milk Hub",
      rating: 4.4,
      reviewCount: 198,
      category: "Dairy products",
      initials: "PM",
      badgeColor: "bg-slate-500",
    },
  ];

  // Calculated metrics
  const avgPosition =
    keywords.length > 0
      ? (keywords.reduce((acc, k) => acc + k.position, 0) / keywords.length).toFixed(1)
      : "—";

  const top3Percentage =
    keywords.length > 0
      ? Math.round((keywords.filter((k) => k.position <= 3).length / keywords.length) * 100)
      : null;

  const handleToggleSelectKeyword = (id: string) => {
    if (selectedKeywordIds.includes(id)) {
      setSelectedKeywordIds(selectedKeywordIds.filter((item) => item !== id));
    } else {
      setSelectedKeywordIds([...selectedKeywordIds, id]);
    }
  };

  const handleSelectAllKeywords = () => {
    if (selectedKeywordIds.length === keywords.length) {
      setSelectedKeywordIds([]);
    } else {
      setSelectedKeywordIds(keywords.map((k) => k.id));
    }
  };

  const handleUpdateRankings = () => {
    setIsUpdating(true);
    setTimeout(() => {
      setIsUpdating(false);
    }, 1000);
  };

  // Helper for node color
  const getNodeColor = (rank: number) => {
    if (rank <= 3) return "bg-emerald-500 text-white shadow-emerald-500/40";
    if (rank <= 5) return "bg-emerald-400 text-white shadow-emerald-400/30";
    if (rank <= 10) return "bg-amber-500 text-white shadow-amber-500/40";
    return "bg-rose-500 text-white shadow-rose-500/40";
  };

  return (
    <div className="space-y-6">
      {/* ── Top Metric Cards (Row 1) ─────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Average Map Position */}
        <div
          className="rounded-2xl border bg-white p-5 shadow-xs flex flex-col justify-between"
          style={{ borderColor: "var(--border-color)" }}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-brand-600">Average Map Position</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <MapPin size={16} />
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-2xl font-black tracking-tight text-brand-950">{avgPosition}</div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
                <TrendingUp size={13} />
                <span>1.4 vs last 28 days</span>
              </div>
              {/* Mini sparkline curve green */}
              <svg className="w-16 h-6 text-emerald-500" viewBox="0 0 64 24" fill="none">
                <path
                  d="M2 20 C 18 18, 28 14, 38 8 C 48 10, 56 4, 62 4"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </div>
          </div>
        </div>

        {/* Card 2: Top 3 Visibility */}
        <div
          className="rounded-2xl border bg-white p-5 shadow-xs flex flex-col justify-between"
          style={{ borderColor: "var(--border-color)" }}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-brand-600">Top 3 Visibility</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Award size={16} />
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-2xl font-black tracking-tight text-brand-950">
              {top3Percentage != null ? `${top3Percentage}%` : "—"}
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
                <TrendingUp size={13} />
                <span>18% vs last 28 days</span>
              </div>
              {/* Mini sparkline curve blue */}
              <svg className="w-16 h-6 text-blue-500" viewBox="0 0 64 24" fill="none">
                <path
                  d="M2 18 C 16 16, 26 12, 36 10 C 46 8, 54 4, 62 4"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </div>
          </div>
        </div>

        {/* Card 3: Total Keywords Tracked */}
        <div
          className="rounded-2xl border bg-white p-5 shadow-xs flex flex-col justify-between"
          style={{ borderColor: "var(--border-color)" }}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-brand-600">Total Keywords Tracked</span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <Search size={16} />
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-2xl font-black tracking-tight text-brand-950">{keywords.length}</div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
                <TrendingUp size={13} />
                <span>6 vs last 28 days</span>
              </div>
              {/* Mini sparkline curve purple */}
              <svg className="w-16 h-6 text-purple-500" viewBox="0 0 64 24" fill="none">
                <path
                  d="M2 20 C 16 18, 28 14, 38 12 C 48 10, 56 4, 62 4"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </div>
          </div>
        </div>

        {/* Card 4: Local Pack Appearances */}
        <div
          className="rounded-2xl border bg-white p-5 shadow-xs flex flex-col justify-between"
          style={{ borderColor: "var(--border-color)" }}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-brand-600">Local Pack Appearances</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Store size={16} />
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-2xl font-black tracking-tight text-brand-950">
              {localSeo ? 412 : "—"}
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
                <TrendingUp size={13} />
                <span>32% vs last 28 days</span>
              </div>
              {/* Mini sparkline curve amber */}
              <svg className="w-16 h-6 text-amber-500" viewBox="0 0 64 24" fill="none">
                <path
                  d="M2 18 C 14 16, 26 12, 38 14 C 48 16, 54 6, 62 4"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* ── Filter / Control Bar (Row 2) ─────────────────────────────── */}
      <div
        className="rounded-2xl border bg-white p-4 shadow-xs flex flex-wrap items-center justify-between gap-3"
        style={{ borderColor: "var(--border-color)" }}
      >
        <div className="flex flex-wrap items-center gap-3 flex-1">
          {/* Location */}
          <div className="flex-1 min-w-[200px]">
            <label className="block text-[11px] font-semibold text-brand-600 mb-1">Search Location</label>
            <div className="relative">
              <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-600" />
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full h-9 pl-8 pr-3 text-xs rounded-lg border border-brand-200 bg-white font-medium text-brand-950 focus:outline-none focus:ring-1 focus:ring-brand-950"
              />
            </div>
          </div>

          {/* Search Radius */}
          <div className="w-28">
            <label className="block text-[11px] font-semibold text-brand-600 mb-1">Search Radius</label>
            <select
              value={radius}
              onChange={(e) => setRadius(e.target.value)}
              className="w-full h-9 px-2 text-xs rounded-lg border border-brand-200 bg-white font-medium text-brand-950 focus:outline-none"
            >
              <option value="3 km">3 km</option>
              <option value="5 km">5 km</option>
              <option value="10 km">10 km</option>
              <option value="15 km">15 km</option>
            </select>
          </div>

          {/* Keyword Group */}
          <div className="w-36">
            <label className="block text-[11px] font-semibold text-brand-600 mb-1">Keyword Group</label>
            <select
              value={keywordGroup}
              onChange={(e) => setKeywordGroup(e.target.value)}
              className="w-full h-9 px-2 text-xs rounded-lg border border-brand-200 bg-white font-medium text-brand-950 focus:outline-none"
            >
              <option value="All Keywords">All Keywords</option>
              <option value="Transactional">Transactional</option>
              <option value="Commercial">Commercial</option>
            </select>
          </div>

          {/* Device */}
          <div className="w-36">
            <label className="block text-[11px] font-semibold text-brand-600 mb-1">Device</label>
            <select
              value={device}
              onChange={(e) => setDevice(e.target.value)}
              className="w-full h-9 px-2 text-xs rounded-lg border border-brand-200 bg-white font-medium text-brand-950 focus:outline-none"
            >
              <option value="Mobile & Desktop">Mobile & Desktop</option>
              <option value="Mobile Only">Mobile Only</option>
              <option value="Desktop Only">Desktop Only</option>
            </select>
          </div>
        </div>

        {/* Action Button */}
        <div className="self-end pt-1">
          <button
            type="button"
            onClick={handleUpdateRankings}
            disabled={isUpdating}
            className="inline-flex items-center gap-1.5 px-4 h-9 rounded-lg bg-brand-950 text-white text-xs font-semibold hover:opacity-90 transition-all shadow-xs"
          >
            <RefreshCw size={13} className={cn(isUpdating && "animate-spin")} />
            <span>Update Rankings</span>
          </button>
        </div>
      </div>

      {/* ── Main Grid (Row 3): GeoGrid Ranking Map & Keyword Rankings ─ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (7 cols): GeoGrid Ranking Map */}
        <div
          className="lg:col-span-7 rounded-2xl border bg-white p-5 shadow-xs space-y-4"
          style={{ borderColor: "var(--border-color)" }}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-1.5">
                <h2 className="text-sm font-bold text-brand-950">GeoGrid Ranking Map</h2>
                <span className="w-3.5 h-3.5 rounded-full bg-brand-100 text-[10px] font-bold text-brand-600 flex items-center justify-center">
                  i
                </span>
              </div>
              <p className="text-[11px] text-brand-500">
                See your position across different areas in Pune. Each point shows your ranking for the selected keyword.
              </p>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <span className="text-[11px] text-brand-500">Keyword:</span>
              <select
                value={selectedKeyword}
                onChange={(e) => setSelectedKeyword(e.target.value)}
                className="h-8 px-2 text-xs rounded-lg border border-brand-200 bg-white font-semibold text-brand-900 focus:outline-none"
              >
                {keywords.map((k) => (
                  <option key={k.id} value={k.keyword}>
                    &quot;{k.keyword}&quot;
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Interactive GeoGrid Map Canvas */}
          <div className="relative w-full h-[420px] rounded-xl overflow-hidden border border-brand-100 bg-[#E8ECEF]">
            {/* SVG stylized road & water network overlay */}
            <svg className="absolute inset-0 w-full h-full opacity-60" preserveAspectRatio="none" viewBox="0 0 400 300">
              {/* River Mula-Mutha flowing across Pune */}
              <path
                d="M 10 180 Q 90 190 170 175 T 260 140 T 390 110"
                stroke="#C6D8E8"
                strokeWidth="12"
                fill="none"
              />
              <path
                d="M 200 160 Q 240 210 290 230 T 390 240"
                stroke="#C6D8E8"
                strokeWidth="8"
                fill="none"
              />
              {/* Roads / Highways */}
              <path d="M 0 60 L 400 120" stroke="#FFFFFF" strokeWidth="3" fill="none" />
              <path d="M 80 0 L 220 300" stroke="#FFFFFF" strokeWidth="4" fill="none" />
              <path d="M 280 0 L 140 300" stroke="#FFFFFF" strokeWidth="3" fill="none" />
              <path d="M 0 220 L 400 200" stroke="#FFFFFF" strokeWidth="4" fill="none" />
            </svg>

            {/* Suburb Area Labels */}
            <span className="absolute left-[8%] top-[24%] text-[10px] font-bold text-slate-500 tracking-wider">
              HINJAWADI
            </span>
            <span className="absolute left-[30%] top-[10%] text-[10px] font-bold text-slate-500 tracking-wider">
              WAKAD
            </span>
            <span className="absolute left-[26%] top-[24%] text-[10px] font-bold text-slate-500 tracking-wider">
              BANER
            </span>
            <span className="absolute left-[42%] top-[12%] text-[10px] font-bold text-slate-500 tracking-wider">
              AUNDH
            </span>
            <span className="absolute left-[30%] top-[60%] text-[10px] font-bold text-slate-500 tracking-wider">
              KOTHRUD
            </span>
            <span className="absolute left-[44%] top-[42%] text-lg font-black text-slate-800 tracking-wide drop-shadow-xs">
              Pune
            </span>
            <span className="absolute left-[62%] top-[18%] text-[10px] font-bold text-slate-500 tracking-wider">
              VIMAN NAGAR
            </span>
            <span className="absolute left-[78%] top-[26%] text-[10px] font-bold text-slate-500 tracking-wider">
              KHARADI
            </span>
            <span className="absolute left-[68%] top-[62%] text-[10px] font-bold text-slate-500 tracking-wider">
              HADAPSAR
            </span>
            <span className="absolute left-[38%] top-[88%] text-[10px] font-bold text-slate-500 tracking-wider">
              KATRAJ
            </span>

            {/* Grid Ranking Nodes */}
            {gridPoints.map((pt) => (
              <div
                key={pt.id}
                style={{ left: `${pt.x}%`, top: `${pt.y}%` }}
                className={cn(
                  "absolute -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black shadow-md cursor-pointer transition-transform hover:scale-125 z-10",
                  getNodeColor(pt.rank)
                )}
                title={`${pt.area}: Rank #${pt.rank}`}
              >
                {pt.rank}
              </div>
            ))}

            {/* Map Zoom Controls */}
            <div className="absolute right-3 bottom-3 flex flex-col gap-1.5 z-20">
              <button
                type="button"
                className="w-8 h-8 rounded-lg bg-white shadow-md border border-brand-100 flex items-center justify-center text-brand-700 hover:bg-brand-50"
              >
                <Plus size={14} />
              </button>
              <button
                type="button"
                className="w-8 h-8 rounded-lg bg-white shadow-md border border-brand-100 flex items-center justify-center text-brand-700 hover:bg-brand-50"
              >
                <Minus size={14} />
              </button>
              <button
                type="button"
                className="w-8 h-8 rounded-lg bg-white shadow-md border border-brand-100 flex items-center justify-center text-brand-700 hover:bg-brand-50"
              >
                <Crosshair size={14} />
              </button>
            </div>

            {/* Floating Legend (Bottom Left) */}
            <div className="absolute left-3 bottom-3 bg-white/95 backdrop-blur-xs p-3 rounded-xl border border-brand-100 shadow-md text-xs space-y-1.5 z-20">
              <div className="text-[11px] font-bold text-brand-900 pb-0.5">Your Ranking</div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span className="text-[11px] text-brand-700">1 - 3 (Top 3)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                <span className="text-[11px] text-brand-700">4 - 5</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <span className="text-[11px] text-brand-700">6 - 10</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                <span className="text-[11px] text-brand-700">10+</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (5 cols): Keyword Rankings Table */}
        <div
          className="lg:col-span-5 rounded-2xl border bg-white p-5 shadow-xs space-y-4"
          style={{ borderColor: "var(--border-color)" }}
        >
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-brand-950">Keyword Rankings</h2>
            <a
              href="#view-all-keywords"
              className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700"
            >
              <span>View All Keywords</span>
              <ArrowRight size={12} />
            </a>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-brand-100 text-[11px] font-bold text-brand-500">
                  <th className="pb-2.5 pr-2">
                    <input
                      type="checkbox"
                      checked={selectedKeywordIds.length === keywords.length}
                      onChange={handleSelectAllKeywords}
                      className="w-3.5 h-3.5 rounded text-blue-600 border-brand-300"
                    />
                  </th>
                  <th className="pb-2.5 font-semibold">Keyword</th>
                  <th className="pb-2.5 font-semibold text-center">Position</th>
                  <th className="pb-2.5 font-semibold text-center">Change</th>
                  <th className="pb-2.5 font-semibold text-right">Search Volume</th>
                  <th className="pb-2.5 font-semibold text-right">Intent</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-50">
                {keywords.map((k) => (
                  <tr
                    key={k.id}
                    className="hover:bg-brand-50/50 transition-colors cursor-pointer"
                    onClick={() => setSelectedKeyword(k.keyword)}
                  >
                    <td className="py-2.5 pr-2" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedKeywordIds.includes(k.id)}
                        onChange={() => handleToggleSelectKeyword(k.id)}
                        className="w-3.5 h-3.5 rounded text-blue-600 border-brand-300"
                      />
                    </td>
                    <td className="py-2.5 font-medium text-brand-950 max-w-[150px] truncate">{k.keyword}</td>
                    <td className="py-2.5 text-center font-bold text-brand-950">{k.position}</td>
                    <td className="py-2.5 text-center">
                      <div
                        className={cn(
                          "inline-flex items-center gap-0.5 text-[11px] font-bold",
                          k.change > 0
                            ? "text-emerald-600"
                            : k.change < 0
                            ? "text-rose-600"
                            : "text-brand-400"
                        )}
                      >
                        {k.change > 0 && <TrendingUp size={11} />}
                        {k.change < 0 && <TrendingDown size={11} />}
                        <span>{k.change > 0 ? `+${k.change}` : k.change === 0 ? "0" : k.change}</span>
                      </div>
                    </td>
                    <td className="py-2.5 text-right text-brand-600">{k.volume}</td>
                    <td className="py-2.5 text-right">
                      <span
                        className={cn(
                          "text-[10px] font-semibold px-2 py-0.5 rounded-md",
                          k.intent === "Transactional"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : k.intent === "Commercial"
                            ? "bg-blue-50 text-blue-700 border border-blue-200"
                            : "bg-slate-50 text-slate-700 border border-slate-200"
                        )}
                      >
                        {k.intent}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Bottom Row (Row 4): Local Pack Preview, Ranking Trend, AI Insights ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Card 1 (4 cols): Local Pack Preview */}
        <div
          className="lg:col-span-4 rounded-2xl border bg-white p-5 shadow-xs space-y-4"
          style={{ borderColor: "var(--border-color)" }}
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1.5">
                <h2 className="text-sm font-bold text-brand-950">Local Pack Preview</h2>
                <span className="w-3.5 h-3.5 rounded-full bg-brand-100 text-[10px] font-bold text-brand-600 flex items-center justify-center">
                  i
                </span>
              </div>
              <p className="text-[11px] text-brand-500">Here&apos;s how you appear for &quot;{selectedKeyword}&quot;</p>
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

          <div className="grid grid-cols-3 gap-2 pt-1">
            {localPackList.map((item) => (
              <div
                key={item.rank}
                className={cn(
                  "p-3 rounded-xl border flex flex-col items-center text-center space-y-2 relative transition-all",
                  item.rank === 1
                    ? "border-emerald-200 bg-emerald-50/20 shadow-2xs"
                    : "border-brand-100 bg-white"
                )}
              >
                <div
                  className={cn(
                    "absolute top-2 left-2 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black text-white",
                    item.badgeColor
                  )}
                >
                  {item.rank}
                </div>

                <div className="w-10 h-10 rounded-xl bg-brand-100 flex items-center justify-center text-xs font-bold text-brand-800 mt-2">
                  {item.initials}
                </div>

                <div>
                  <h4 className="text-xs font-bold text-brand-950 truncate max-w-[90px]">{item.name}</h4>
                  <div className="flex items-center justify-center gap-1 text-[11px] font-semibold text-brand-700">
                    <span>{item.rating}</span>
                    <Star size={11} className="fill-amber-400 text-amber-400" />
                    <span className="text-brand-400 text-[10px]">({item.reviewCount})</span>
                  </div>
                  <p className="text-[10px] text-brand-400 truncate max-w-[90px]">{item.category}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Card 2 (4 cols): Ranking Trend Line Chart */}
        <div
          className="lg:col-span-4 rounded-2xl border bg-white p-5 shadow-xs space-y-4"
          style={{ borderColor: "var(--border-color)" }}
        >
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-brand-950">Ranking Trend</h2>
            <select
              value={selectedKeyword}
              onChange={(e) => setSelectedKeyword(e.target.value)}
              className="h-7 px-2 text-[11px] rounded-lg border border-brand-200 bg-white font-medium text-brand-800 focus:outline-none"
            >
              {keywords.slice(0, 3).map((k) => (
                <option key={k.id} value={k.keyword}>
                  {k.keyword}
                </option>
              ))}
            </select>
          </div>

          <div className="h-44 pt-2">
            <div className="relative w-full h-36">
              {/* Y Axis Grid Lines */}
              <div className="absolute inset-0 flex flex-col justify-between text-[9px] text-brand-400 font-mono pointer-events-none">
                <div className="border-b border-brand-100 flex justify-between pr-1">
                  <span>1</span>
                </div>
                <div className="border-b border-brand-100 flex justify-between pr-1">
                  <span>5</span>
                </div>
                <div className="border-b border-brand-100 flex justify-between pr-1">
                  <span>10</span>
                </div>
                <div className="border-b border-brand-100 flex justify-between pr-1">
                  <span>15</span>
                </div>
              </div>

              {/* Smooth trend curve */}
              <svg className="absolute inset-0 w-full h-full" viewBox="0 0 300 120" preserveAspectRatio="none">
                <path
                  d="M 20 80 Q 70 70, 100 65 T 180 50 T 240 35 T 280 22"
                  fill="none"
                  stroke="#2563EB"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
                {/* Dots along path */}
                <circle cx="20" cy="80" r="4" fill="#2563EB" stroke="#FFFFFF" strokeWidth="2" />
                <circle cx="70" cy="70" r="4" fill="#2563EB" stroke="#FFFFFF" strokeWidth="2" />
                <circle cx="120" cy="62" r="4" fill="#2563EB" stroke="#FFFFFF" strokeWidth="2" />
                <circle cx="180" cy="50" r="4" fill="#2563EB" stroke="#FFFFFF" strokeWidth="2" />
                <circle cx="230" cy="35" r="4" fill="#2563EB" stroke="#FFFFFF" strokeWidth="2" />
                <circle cx="280" cy="22" r="4" fill="#2563EB" stroke="#FFFFFF" strokeWidth="2" />
              </svg>
            </div>

            {/* Dates along bottom */}
            <div className="flex justify-between text-[10px] text-brand-400 font-medium pt-2 px-3">
              <span>Aug 15</span>
              <span>Aug 22</span>
              <span>Aug 29</span>
              <span>Sep 5</span>
              <span>Sep 12</span>
            </div>
          </div>
        </div>

        {/* Card 3 (4 cols): AI Insights */}
        <div
          className="lg:col-span-4 rounded-2xl border bg-white p-5 shadow-xs flex flex-col justify-between space-y-4"
          style={{ borderColor: "var(--border-color)" }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-5 rounded-md bg-purple-100 text-purple-600 flex items-center justify-center">
                <Sparkles size={12} />
              </div>
              <h2 className="text-sm font-bold text-brand-950">AI Insights</h2>
            </div>
            <a href="?tab=ai-recommendations" className="text-xs font-bold text-blue-600 hover:text-blue-700">
              View All &rarr;
            </a>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex items-start gap-2 text-brand-700">
              <TrendingUp size={14} className="text-emerald-600 shrink-0 mt-0.5" />
              <span>Your average position improved by 1.4 in the last 28 days.</span>
            </div>
            <div className="flex items-start gap-2 text-brand-700">
              <TrendingUp size={14} className="text-emerald-600 shrink-0 mt-0.5" />
              <span>You appear in Top 3 for 76% of tracked keywords.</span>
            </div>
            <div className="flex items-start gap-2 text-brand-700">
              <span className="w-3.5 h-3.5 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center shrink-0 mt-0.5 text-[9px] font-black">
                !
              </span>
              <span>Your visibility is weaker in Kharadi and Hadapsar.</span>
            </div>
            <div className="flex items-start gap-2 text-brand-700">
              <Sparkles size={13} className="text-purple-600 shrink-0 mt-0.5" />
              <span>Competitors are gaining ground for &quot;organic milk&quot;.</span>
            </div>
            <div className="flex items-start gap-2 text-brand-700">
              <Sparkles size={13} className="text-purple-600 shrink-0 mt-0.5" />
              <span>Add location-specific keywords like &quot;milk delivery Baner&quot;.</span>
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
  );
}
