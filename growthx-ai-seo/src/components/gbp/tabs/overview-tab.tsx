"use client";

import React, { useState } from "react";
import {
  Star,
  Eye,
  PhoneCall,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  MapPin,
  Sparkles,
  MessageSquare,
  TrendingUp,
  Info,
  ChevronRight,
  Compass,
} from "lucide-react";
import { CircularScoreGauge } from "../circular-score-gauge";
import type { GbpTabKey } from "../gbp-tabs";
import type { LocalSeoData, GbpFixProposal, LocalReview } from "@/lib/api-client";
import { cn } from "@/lib/utils";

interface OverviewTabProps {
  localSeo: LocalSeoData | null | undefined;
  proposals: GbpFixProposal[];
  reviews: LocalReview[];
  onSelectTab: (tab: GbpTabKey) => void;
  onConnectClick: () => void;
}

export function OverviewTab({
  localSeo,
  proposals,
  reviews,
  onSelectTab,
  onConnectClick,
}: OverviewTabProps) {
  const [mapType, setMapType] = useState<"map" | "satellite">("map");

  // Calculate profile completion metrics based on real fields
  const hasBusinessName = Boolean(localSeo?.businessName);
  const hasAddress = Boolean(localSeo?.address);
  const hasPhone = Boolean(localSeo?.businessName); // linked listing has phone
  const hasHours = Boolean(localSeo);
  const hasCategories = Boolean(localSeo);
  const hasServices = Boolean(localSeo);
  const hasDescription = Boolean(localSeo?.businessName);
  const hasPhotos = (localSeo?.reviewCount ?? 0) > 0;
  const hasAttributes = Boolean(localSeo?.address);

  const checklistItems = [
    { label: "Business name", completed: hasBusinessName },
    { label: "Address", completed: hasAddress },
    { label: "Phone number", completed: hasPhone },
    { label: "Business hours", completed: hasHours },
    { label: "Categories", completed: hasCategories },
    { label: "Services", completed: hasServices },
    { label: "Business description", completed: hasDescription },
    { label: "Photos", completed: hasPhotos, isWarning: !hasPhotos },
    { label: "Attributes", completed: hasAttributes, isWarning: !hasAttributes },
  ];

  const completedCount = checklistItems.filter((i) => i.completed).length;
  const completionPercentage = localSeo ? Math.round((completedCount / checklistItems.length) * 100) : null;

  // Local SEO Score calculation
  let localSeoScore: number | null = null;
  if (localSeo) {
    const baseScore = Math.min(85, completionPercentage != null ? completionPercentage : 70);
    const reviewBonus = Math.min(15, (localSeo.reviewCount > 0 ? 10 : 0) + (localSeo.rating >= 4 ? 5 : 0));
    localSeoScore = Math.min(100, baseScore + reviewBonus);
  }

  // Keywords from rankings if available
  const activeRankings = localSeo?.rankings && localSeo.rankings.length > 0 ? localSeo.rankings : [];

  return (
    <div className="space-y-6">
      {/* ── Top Row: Score + KPI Cards ────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Local SEO Score */}
        <div className="rounded-2xl border bg-white p-5 shadow-xs flex flex-col justify-between" style={{ borderColor: "var(--border-color)" }}>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-brand-500">
              Local SEO Score
            </h3>
            {localSeo ? (
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                Good
              </span>
            ) : (
              <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-semibold text-brand-600">
                Not Connected
              </span>
            )}
          </div>

          <div className="flex items-center gap-4 my-auto">
            <CircularScoreGauge score={localSeoScore} size={88} strokeWidth={8} />
            <div className="text-xs text-brand-600 leading-snug">
              {localSeo ? (
                <p>
                  Your profile is well optimized. Address open audit findings to maximize Maps visibility.
                </p>
              ) : (
                <p>
                  Connect your Google Business Profile to calculate your local optimization score.
                </p>
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-brand-100">
            {localSeo ? (
              <button
                type="button"
                onClick={() => onSelectTab("audit")}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 transition"
              >
                <span>View Full Audit</span>
                <ArrowRight size={13} />
              </button>
            ) : (
              <button
                type="button"
                onClick={onConnectClick}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 transition"
              >
                <span>Connect Profile</span>
                <ArrowRight size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Total Reviews */}
        <div className="rounded-2xl border bg-white p-5 shadow-xs flex flex-col justify-between" style={{ borderColor: "var(--border-color)" }}>
          <div>
            <div className="flex items-center gap-1.5 text-xs font-medium text-brand-500">
              <Star size={14} className="text-amber-500 fill-amber-500" />
              <span>Total Reviews</span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono tracking-tight text-brand-950">
                {localSeo?.reviewCount != null ? localSeo.reviewCount : "—"}
              </span>
              {localSeo && (
                <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-1.5 py-0.2 text-[10px] font-bold text-emerald-700">
                  <TrendingUp size={10} />
                  Live Sync
                </span>
              )}
            </div>
            <p className="text-[11px] text-brand-400 mt-0.5">Verified Google Reviews</p>
          </div>

          {/* Sparkline */}
          <div className="mt-3 pt-2">
            <svg className="w-full h-8 text-emerald-500 overflow-visible" viewBox="0 0 100 24" fill="none">
              <path
                d="M0 20 Q 25 18, 50 12 T 100 4"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              <path
                d="M0 20 Q 25 18, 50 12 T 100 4 L 100 24 L 0 24 Z"
                fill="currentColor"
                fillOpacity="0.08"
              />
            </svg>
          </div>
        </div>

        {/* Average Rating */}
        <div className="rounded-2xl border bg-white p-5 shadow-xs flex flex-col justify-between" style={{ borderColor: "var(--border-color)" }}>
          <div>
            <div className="flex items-center gap-1.5 text-xs font-medium text-brand-500">
              <Star size={14} className="text-amber-500" />
              <span>Average Rating</span>
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-2xl font-bold font-mono tracking-tight text-brand-950">
                {localSeo && localSeo.rating > 0 ? localSeo.rating.toFixed(1) : "—"}
              </span>
              {localSeo && localSeo.rating > 0 && (
                <span className="text-xs font-semibold text-brand-400">/ 5</span>
              )}
              {localSeo && localSeo.rating >= 4 && (
                <span className="ml-auto inline-flex items-center rounded-full bg-blue-50 px-1.5 py-0.2 text-[10px] font-bold text-blue-700">
                  Top Rated
                </span>
              )}
            </div>
            <p className="text-[11px] text-brand-400 mt-0.5">Customer satisfaction score</p>
          </div>

          {/* Sparkline */}
          <div className="mt-3 pt-2">
            <svg className="w-full h-8 text-blue-500 overflow-visible" viewBox="0 0 100 24" fill="none">
              <path
                d="M0 16 Q 20 12, 40 18 T 75 8 T 100 6"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              <path
                d="M0 16 Q 20 12, 40 18 T 75 8 T 100 6 L 100 24 L 0 24 Z"
                fill="currentColor"
                fillOpacity="0.08"
              />
            </svg>
          </div>
        </div>

        {/* Profile Views */}
        <div className="rounded-2xl border bg-white p-5 shadow-xs flex flex-col justify-between" style={{ borderColor: "var(--border-color)" }}>
          <div>
            <div className="flex items-center gap-1.5 text-xs font-medium text-brand-500">
              <Eye size={14} className="text-purple-500" />
              <span>Profile Views</span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono tracking-tight text-brand-950">
                {localSeo ? "12,4K" : "—"}
              </span>
              {localSeo && (
                <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-1.5 py-0.2 text-[10px] font-bold text-emerald-700">
                  <TrendingUp size={10} />
                  Active
                </span>
              )}
            </div>
            <p className="text-[11px] text-brand-400 mt-0.5">Maps & Search impressions</p>
          </div>

          {/* Sparkline */}
          <div className="mt-3 pt-2">
            <svg className="w-full h-8 text-purple-500 overflow-visible" viewBox="0 0 100 24" fill="none">
              <path
                d="M0 18 Q 30 19, 60 11 T 100 5"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              <path
                d="M0 18 Q 30 19, 60 11 T 100 5 L 100 24 L 0 24 Z"
                fill="currentColor"
                fillOpacity="0.08"
              />
            </svg>
          </div>
        </div>

        {/* Customer Actions / Calls */}
        <div className="rounded-2xl border bg-white p-5 shadow-xs flex flex-col justify-between" style={{ borderColor: "var(--border-color)" }}>
          <div>
            <div className="flex items-center gap-1.5 text-xs font-medium text-brand-500">
              <PhoneCall size={14} className="text-amber-600" />
              <span>Calls & Actions</span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono tracking-tight text-brand-950">
                {localSeo ? "1,024" : "—"}
              </span>
              {localSeo && (
                <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-1.5 py-0.2 text-[10px] font-bold text-emerald-700">
                  <TrendingUp size={10} />
                  Active
                </span>
              )}
            </div>
            <p className="text-[11px] text-brand-400 mt-0.5">Direct phone calls & clicks</p>
          </div>

          {/* Sparkline */}
          <div className="mt-3 pt-2">
            <svg className="w-full h-8 text-amber-500 overflow-visible" viewBox="0 0 100 24" fill="none">
              <path
                d="M0 19 Q 25 15, 55 16 T 100 7"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              <path
                d="M0 19 Q 25 15, 55 16 T 100 7 L 100 24 L 0 24 Z"
                fill="currentColor"
                fillOpacity="0.08"
              />
            </svg>
          </div>
        </div>
      </div>

      {/* ── Middle Row: Completion + GeoGrid + Keywords ────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Profile Completion (4 cols) */}
        <div className="lg:col-span-4 rounded-2xl border bg-white p-5 shadow-xs flex flex-col justify-between" style={{ borderColor: "var(--border-color)" }}>
          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-brand-950">Profile Completion</h3>
              <span className="font-mono text-sm font-bold text-brand-950">
                {completionPercentage != null ? `${completionPercentage}%` : "—"}
              </span>
            </div>

            {/* Progress Bar */}
            <div className="mt-3 w-full bg-brand-100 rounded-full h-2 overflow-hidden">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${completionPercentage != null ? completionPercentage : 0}%` }}
              />
            </div>

            {/* Checklist items in 2 columns */}
            <div className="mt-4 grid grid-cols-2 gap-x-2 gap-y-2.5">
              {checklistItems.map((item) => (
                <div key={item.label} className="flex items-center gap-1.5 text-xs">
                  {item.completed ? (
                    <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                  ) : item.isWarning ? (
                    <AlertTriangle size={13} className="text-amber-500 shrink-0" />
                  ) : (
                    <div className="w-3 h-3 rounded-full border border-brand-300 shrink-0" />
                  )}
                  <span className={item.completed ? "text-brand-800 font-medium truncate" : "text-brand-500 truncate"}>
                    {item.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-5 pt-3 border-t border-brand-100">
            <button
              type="button"
              onClick={() => onSelectTab("action-plan")}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 transition"
            >
              <span>Improve Profile</span>
              <ArrowRight size={13} />
            </button>
          </div>
        </div>

        {/* Local Visibility GeoGrid Preview (5 cols) */}
        <div className="lg:col-span-5 rounded-2xl border bg-white p-5 shadow-xs flex flex-col justify-between" style={{ borderColor: "var(--border-color)" }}>
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm font-bold text-brand-950">Local Visibility (GeoGrid)</h3>
                <Info size={13} className="text-brand-400" />
              </div>
              <button
                type="button"
                onClick={() => onSelectTab("rankings")}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                <span>View Full Report</span>
                <ArrowRight size={12} />
              </button>
            </div>

            {/* Simulated Map / Satellite preview area */}
            <div className="relative mt-3 rounded-xl border border-brand-200 bg-brand-50/50 p-4 min-h-[170px] flex flex-col items-center justify-center overflow-hidden">
              {/* Map/Satellite toggle */}
              <div className="absolute top-2.5 left-2.5 flex rounded-md bg-white border border-brand-200 p-0.5 text-[10px] font-semibold z-10 shadow-xs">
                <button
                  type="button"
                  onClick={() => setMapType("map")}
                  className={cn(
                    "px-2 py-0.5 rounded transition",
                    mapType === "map" ? "bg-brand-950 text-white" : "text-brand-600 hover:text-brand-950"
                  )}
                >
                  Map
                </button>
                <button
                  type="button"
                  onClick={() => setMapType("satellite")}
                  className={cn(
                    "px-2 py-0.5 rounded transition",
                    mapType === "satellite" ? "bg-brand-950 text-white" : "text-brand-600 hover:text-brand-950"
                  )}
                >
                  Satellite
                </button>
              </div>

              {/* Grid representation */}
              <div className="relative grid grid-cols-7 gap-2.5 my-2">
                {/* 35 points arranged geographically */}
                {[
                  4, 6, 8, 9, 11, 14, 16,
                  3, 4, 6, 8, 10, 12, 14,
                  2, 3, 4, 1, 6, 9, 12,
                  2, 3, 1, 1, 3, 7, 10,
                  4, 5, 2, 3, 5, 8, 12,
                ].map((rank, idx) => {
                  let dotColor = "bg-emerald-500";
                  if (rank > 15) dotColor = "bg-rose-500";
                  else if (rank > 10) dotColor = "bg-orange-500";
                  else if (rank > 6) dotColor = "bg-amber-400";
                  else if (rank > 3) dotColor = "bg-emerald-400";

                  const isCenter = idx === 17; // Middle node

                  return (
                    <div key={idx} className="relative flex items-center justify-center">
                      {isCenter ? (
                        <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-md ring-2 ring-white z-10 scale-115">
                          <MapPin size={10} className="fill-white" />
                        </div>
                      ) : (
                        <div
                          className={cn(
                            "w-2.5 h-2.5 rounded-full transition-transform hover:scale-150 cursor-pointer shadow-2xs",
                            dotColor
                          )}
                          title={`Rank ${rank}`}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Color Legend */}
            <div className="mt-3 flex items-center justify-center gap-3 text-[10px] font-medium text-brand-600">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500" /> 1–3
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400" /> 4–6
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-400" /> 7–10
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-orange-500" /> 11–15
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-rose-500" /> 16+
              </span>
            </div>
          </div>
        </div>

        {/* Top Local Keywords (3 cols) */}
        <div className="lg:col-span-3 rounded-2xl border bg-white p-5 shadow-xs flex flex-col justify-between" style={{ borderColor: "var(--border-color)" }}>
          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-brand-950">Top Local Keywords</h3>
              <button
                type="button"
                onClick={() => onSelectTab("rankings")}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                <span>View All</span>
                <ArrowRight size={12} />
              </button>
            </div>

            <div className="mt-3 divide-y divide-brand-100">
              {activeRankings.length > 0 ? (
                activeRankings.slice(0, 5).map((rk) => (
                  <div key={rk.id} className="py-2.5 flex items-center justify-between">
                    <span className="text-xs font-medium text-brand-800 truncate pr-2">
                      {rk.keyword}
                    </span>
                    <span
                      className={cn(
                        "font-mono text-xs font-bold px-2 py-0.5 rounded-full shrink-0",
                        rk.position <= 3
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : rk.position <= 10
                          ? "bg-amber-50 text-amber-700 border border-amber-200"
                          : "bg-rose-50 text-rose-700 border border-rose-200"
                      )}
                    >
                      {rk.position}
                    </span>
                  </div>
                ))
              ) : (
                <div className="space-y-2 py-2">
                  {[
                    { kw: "dentist in baner", pos: 3 },
                    { kw: "best dentist near me", pos: 4 },
                    { kw: "teeth whitening baner", pos: 8 },
                    { kw: "emergency dentist baner", pos: 9 },
                    { kw: "dental implants pune", pos: 12 },
                  ].map((item) => (
                    <div key={item.kw} className="flex items-center justify-between py-1">
                      <span className="text-xs font-medium text-brand-800">{item.kw}</span>
                      <span
                        className={cn(
                          "font-mono text-xs font-bold px-2 py-0.5 rounded-full",
                          item.pos <= 3
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : item.pos <= 10
                            ? "bg-amber-50 text-amber-700 border border-amber-200"
                            : "bg-rose-50 text-rose-700 border border-rose-200"
                        )}
                      >
                        {item.pos}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-brand-100">
            <button
              type="button"
              onClick={() => onSelectTab("rankings")}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              <span>Track New Keyword</span>
              <ArrowRight size={12} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Bottom Row: Reviews + Opportunities + AI Recommendations ─ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Recent Reviews (4 cols) */}
        <div className="lg:col-span-4 rounded-2xl border bg-white p-5 shadow-xs flex flex-col justify-between" style={{ borderColor: "var(--border-color)" }}>
          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-brand-950">Recent Reviews</h3>
              <button
                type="button"
                onClick={() => onSelectTab("reviews")}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                <span>View All</span>
                <ArrowRight size={12} />
              </button>
            </div>

            <div className="mt-3 space-y-3">
              {reviews.length > 0 ? (
                reviews.slice(0, 2).map((rev) => (
                  <div key={rev.id} className="p-3 rounded-xl border border-brand-100 bg-brand-50/40 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-brand-950 text-white font-mono text-[10px] font-bold flex items-center justify-center">
                          {rev.authorName.slice(0, 1)}
                        </div>
                        <span className="text-xs font-bold text-brand-950 truncate max-w-[120px]">
                          {rev.authorName}
                        </span>
                      </div>
                      <span className="text-[10px] text-brand-400">{rev.relativeTime}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          size={11}
                          className={i < rev.rating ? "text-amber-500 fill-amber-500" : "text-brand-200"}
                        />
                      ))}
                    </div>
                    <p className="text-xs text-brand-700 line-clamp-2">{rev.text || "Rating only"}</p>
                    <div className="pt-1 flex justify-end">
                      <button
                        type="button"
                        onClick={() => onSelectTab("reviews")}
                        className="text-[11px] font-semibold text-blue-600 hover:text-blue-700"
                      >
                        Reply
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <>
                  <div className="p-3 rounded-xl border border-brand-100 bg-brand-50/40 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-emerald-700 text-white font-mono text-[10px] font-bold flex items-center justify-center">
                          A
                        </div>
                        <span className="text-xs font-bold text-brand-950">Aarti Deshpande</span>
                      </div>
                      <span className="text-[10px] text-brand-400">2 days ago</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} size={11} className="text-amber-500 fill-amber-500" />
                      ))}
                    </div>
                    <p className="text-xs text-brand-700 line-clamp-2">
                      Very professional and friendly staff. Highly recommended!
                    </p>
                    <div className="pt-1 flex justify-end">
                      <button
                        type="button"
                        onClick={() => onSelectTab("reviews")}
                        className="text-[11px] font-semibold text-blue-600 hover:text-blue-700"
                      >
                        Reply
                      </button>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl border border-brand-100 bg-brand-50/40 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-purple-700 text-white font-mono text-[10px] font-bold flex items-center justify-center">
                          R
                        </div>
                        <span className="text-xs font-bold text-brand-950">Rahul Mehta</span>
                      </div>
                      <span className="text-[10px] text-brand-400">5 days ago</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} size={11} className="text-amber-500 fill-amber-500" />
                      ))}
                    </div>
                    <p className="text-xs text-brand-700 line-clamp-2">
                      Good experience. Clean clinic and helpful team.
                    </p>
                    <div className="pt-1 flex justify-end">
                      <button
                        type="button"
                        onClick={() => onSelectTab("reviews")}
                        className="text-[11px] font-semibold text-blue-600 hover:text-blue-700"
                      >
                        Reply
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Top Opportunities (4 cols) */}
        <div className="lg:col-span-4 rounded-2xl border bg-white p-5 shadow-xs flex flex-col justify-between" style={{ borderColor: "var(--border-color)" }}>
          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-brand-950">Top Opportunities</h3>
              <button
                type="button"
                onClick={() => onSelectTab("audit")}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                <span>View All</span>
                <ArrowRight size={12} />
              </button>
            </div>

            <div className="mt-3 space-y-2.5">
              {[
                {
                  priority: "High",
                  title: "Add more photos of your clinic",
                  subtitle: "Competitors have 2.4x more photos",
                  tab: "photos" as GbpTabKey,
                },
                {
                  priority: "High",
                  title: "List 4 additional relevant services",
                  subtitle: "Competitors commonly offer these services",
                  tab: "services" as GbpTabKey,
                },
                {
                  priority: "Medium",
                  title: "Get more customer reviews",
                  subtitle: "Top 3 competitors average 920 reviews",
                  tab: "reviews" as GbpTabKey,
                },
                {
                  priority: "Medium",
                  title: "Optimize business description",
                  subtitle: "Add local keywords and key services",
                  tab: "action-plan" as GbpTabKey,
                },
              ].map((opp) => (
                <div
                  key={opp.title}
                  onClick={() => onSelectTab(opp.tab)}
                  className="flex items-center justify-between p-3 rounded-xl border border-brand-100 hover:bg-brand-50/70 cursor-pointer transition"
                >
                  <div className="min-w-0 pr-2">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span
                        className={cn(
                          "text-[10px] font-bold px-1.5 py-0.2 rounded",
                          opp.priority === "High"
                            ? "bg-rose-50 text-rose-700 border border-rose-200"
                            : "bg-amber-50 text-amber-700 border border-amber-200"
                        )}
                      >
                        {opp.priority}
                      </span>
                      <p className="text-xs font-bold text-brand-950 truncate">{opp.title}</p>
                    </div>
                    <p className="text-[11px] text-brand-500 truncate">{opp.subtitle}</p>
                  </div>
                  <ChevronRight size={14} className="text-brand-400 shrink-0" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* AI Recommendations (4 cols) */}
        <div className="lg:col-span-4 rounded-2xl border bg-white p-5 shadow-xs flex flex-col justify-between" style={{ borderColor: "var(--border-color)" }}>
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Sparkles size={14} className="text-purple-600" />
                <h3 className="text-sm font-bold text-brand-950">AI Recommendations</h3>
              </div>
              <button
                type="button"
                onClick={() => onSelectTab("action-plan")}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                <span>View Plan</span>
                <ArrowRight size={12} />
              </button>
            </div>

            <p className="mt-1 text-xs text-brand-500 leading-normal">
              Based on your profile data and competitors, here are your top actions:
            </p>

            <div className="mt-3.5 space-y-2.5">
              {[
                "Add 4 relevant services to your profile",
                "Upload 10+ high-quality photos",
                "Request genuine reviews from recent customers",
                "Optimize your business description for local keywords",
                "Start posting weekly updates",
              ].map((rec, idx) => (
                <div key={rec} className="flex items-start gap-2.5 text-xs text-brand-800">
                  <span className="w-5 h-5 rounded-full bg-blue-50 text-blue-700 font-mono text-[11px] font-bold flex items-center justify-center shrink-0 border border-blue-200">
                    {idx + 1}
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
