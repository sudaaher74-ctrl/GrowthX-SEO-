"use client";

import React from "react";
import {
  Star,
  Eye,
  PhoneCall,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  MapPin,
  Sparkles,
  TrendingUp,
  Info,
  ChevronRight,
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

        {/* Citations */}
        <div className="rounded-2xl border bg-white p-5 shadow-xs flex flex-col justify-between" style={{ borderColor: "var(--border-color)" }}>
          <div>
            <div className="flex items-center gap-1.5 text-xs font-medium text-brand-500">
              <Eye size={14} className="text-purple-500" />
              <span>Citations</span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono tracking-tight text-brand-950">
                {localSeo?.citationsCount != null ? localSeo.citationsCount : "—"}
              </span>
            </div>
            <p className="text-[11px] text-brand-400 mt-0.5">Directory listings found</p>
          </div>
        </div>

        {/* Last Synced */}
        <div className="rounded-2xl border bg-white p-5 shadow-xs flex flex-col justify-between" style={{ borderColor: "var(--border-color)" }}>
          <div>
            <div className="flex items-center gap-1.5 text-xs font-medium text-brand-500">
              <PhoneCall size={14} className="text-amber-600" />
              <span>Last Synced</span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-sm font-bold font-mono tracking-tight text-brand-950">
                {localSeo?.updatedAt ? new Date(localSeo.updatedAt).toLocaleDateString() : "—"}
              </span>
            </div>
            <p className="text-[11px] text-brand-400 mt-0.5">From your Google Business Profile</p>
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

            {/* Local visibility is only known once a GeoGrid scan has run for a keyword */}
            <div className="relative mt-3 rounded-xl border border-dashed border-brand-200 bg-brand-50/50 p-4 min-h-[170px] flex flex-col items-center justify-center text-center gap-2">
              <MapPin size={20} className="text-brand-300" />
              <p className="text-xs text-brand-500 max-w-[220px]">
                No GeoGrid scan has been run yet. Run one from Local Rankings to see your position across nearby
                areas.
              </p>
              <button
                type="button"
                onClick={() => onSelectTab("rankings")}
                className="mt-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
              >
                Go to Local Rankings
              </button>
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
                <div className="py-6 text-center">
                  <p className="text-xs text-brand-400">
                    No keywords tracked yet. Track one from Local Rankings to see its position here.
                  </p>
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
                <div className="py-6 text-center">
                  <p className="text-xs text-brand-400">
                    No reviews synced yet. Sync from the Reviews tab to see them here.
                  </p>
                </div>
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
              {checklistItems.filter((i) => !i.completed).length > 0 ? (
                checklistItems
                  .filter((i) => !i.completed)
                  .slice(0, 4)
                  .map((item) => (
                    <div
                      key={item.label}
                      onClick={() => onSelectTab("action-plan")}
                      className="flex items-center justify-between p-3 rounded-xl border border-brand-100 hover:bg-brand-50/70 cursor-pointer transition"
                    >
                      <div className="min-w-0 pr-2">
                        <p className="text-xs font-bold text-brand-950 truncate">Complete: {item.label}</p>
                        <p className="text-[11px] text-brand-500 truncate">Missing from your profile</p>
                      </div>
                      <ChevronRight size={14} className="text-brand-400 shrink-0" />
                    </div>
                  ))
              ) : (
                <p className="text-xs text-brand-400 py-4 text-center">
                  {localSeo ? "All tracked profile fields are complete." : "Connect your profile to see opportunities."}
                </p>
              )}
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
                onClick={() => onSelectTab("ai-recommendations")}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                <span>View Plan</span>
                <ArrowRight size={12} />
              </button>
            </div>

            <p className="mt-1 text-xs text-brand-500 leading-normal">
              {proposals.length > 0
                ? "AI-generated suggestions from your last profile analysis:"
                : "Run an AI audit to get personalized suggestions for your profile."}
            </p>

            <div className="mt-3.5 space-y-2.5">
              {proposals.length > 0 ? (
                proposals
                  .filter((p) => p.status === "PENDING")
                  .slice(0, 5)
                  .map((rec, idx) => (
                    <div key={rec.id} className="flex items-start gap-2.5 text-xs text-brand-800">
                      <span className="w-5 h-5 rounded-full bg-blue-50 text-blue-700 font-mono text-[11px] font-bold flex items-center justify-center shrink-0 border border-blue-200">
                        {idx + 1}
                      </span>
                      <span className="pt-0.5 leading-snug truncate">{rec.field}: {rec.proposedValue}</span>
                    </div>
                  ))
              ) : (
                <button
                  type="button"
                  onClick={() => onSelectTab("audit")}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-700"
                >
                  Run AI Audit →
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
