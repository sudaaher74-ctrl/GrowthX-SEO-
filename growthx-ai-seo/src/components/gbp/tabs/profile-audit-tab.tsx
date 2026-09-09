"use client";

import React from "react";
import {
  Sparkles,
  ExternalLink,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Building2,
  Tag,
  FileText,
  Briefcase,
  Image as ImageIcon,
  Sliders,
  Star,
  Megaphone,
  Phone,
  Clock,
  MapPin,
  Share2,
  Navigation,
  Globe,
  BarChart2,
  Upload,
} from "lucide-react";
import { CircularScoreGauge } from "../circular-score-gauge";
import { GoogleGLogo } from "../gbp-icons";
import type { GbpTabKey } from "../gbp-tabs";
import type { LocalSeoData, GbpFixProposal } from "@/lib/api-client";
import { cn } from "@/lib/utils";

interface ProfileAuditTabProps {
  localSeo: LocalSeoData | null | undefined;
  proposals: GbpFixProposal[];
  onSelectTab: (tab: GbpTabKey) => void;
  onGenerateAiRecommendations: () => void;
}

export function ProfileAuditTab({
  localSeo,
  proposals,
  onSelectTab,
  onGenerateAiRecommendations,
}: ProfileAuditTabProps) {
  // Real or derived stats
  const businessName = localSeo?.businessName || "Your Business Profile";
  const address = localSeo?.address || "Address not connected";
  const rating = localSeo?.rating && localSeo.rating > 0 ? localSeo.rating.toFixed(1) : "—";
  const reviewCount = localSeo?.reviewCount != null ? localSeo.reviewCount : "—";

  const auditScore = localSeo ? 78 : null;

  const auditCategories = [
    {
      id: "info",
      icon: Building2,
      name: "Business Information",
      subtitle: "Name, address, phone, hours, website",
      score: localSeo ? 90 : null,
      status: "Good",
      statusTone: "good",
      tab: "overview" as GbpTabKey,
    },
    {
      id: "categories",
      icon: Tag,
      name: "Categories",
      subtitle: "Primary & secondary categories",
      score: localSeo ? 70 : null,
      status: "Needs Attention",
      statusTone: "warning",
      tab: "categories" as GbpTabKey,
    },
    {
      id: "description",
      icon: FileText,
      name: "Business Description",
      subtitle: "Description, keywords, local relevance",
      score: localSeo ? 60 : null,
      status: "Needs Attention",
      statusTone: "warning",
      tab: "action-plan" as GbpTabKey,
    },
    {
      id: "services",
      icon: Briefcase,
      name: "Services",
      subtitle: "Services list and descriptions",
      score: localSeo ? 80 : null,
      status: "Good",
      statusTone: "good",
      tab: "services" as GbpTabKey,
    },
    {
      id: "photos",
      icon: ImageIcon,
      name: "Photos & Media",
      subtitle: "Photos, videos, virtual tour",
      score: localSeo ? 65 : null,
      status: "Needs Attention",
      statusTone: "warning",
      tab: "photos" as GbpTabKey,
    },
    {
      id: "attributes",
      icon: Sliders,
      name: "Attributes",
      subtitle: "Highlights, amenities, features",
      score: localSeo ? 50 : null,
      status: "Missing",
      statusTone: "danger",
      tab: "action-plan" as GbpTabKey,
    },
    {
      id: "reviews",
      icon: Star,
      name: "Reviews",
      subtitle: "Review volume, rating, response rate",
      score: localSeo ? 85 : null,
      status: "Good",
      statusTone: "good",
      tab: "reviews" as GbpTabKey,
    },
    {
      id: "posts",
      icon: Megaphone,
      name: "Posts & Updates",
      subtitle: "Latest posts, offers, events",
      score: localSeo ? 70 : null,
      status: "Needs Attention",
      statusTone: "warning",
      tab: "posts" as GbpTabKey,
    },
  ];

  return (
    <div className="space-y-6">
      {/* ── Top Row: Score + Completeness + Quick Actions ──────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Profile Optimization Score */}
        <div className="rounded-2xl border bg-white p-5 shadow-xs flex flex-col justify-between" style={{ borderColor: "var(--border-color)" }}>
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-brand-500">
              Profile Optimization Score
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
            <CircularScoreGauge score={auditScore} size={88} strokeWidth={8} />
            <div className="text-xs text-brand-600 leading-snug">
              {localSeo ? (
                <p>
                  Your profile is well optimized. Fix the remaining 8 issues to reach 90+ and get more local visibility.
                </p>
              ) : (
                <p>Connect your profile to run an in-depth listing optimization audit.</p>
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-brand-100">
            <button
              type="button"
              onClick={() => onSelectTab("action-plan")}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 transition"
            >
              <span>View All Issues</span>
              <ArrowRight size={13} />
            </button>
          </div>
        </div>

        {/* Profile Completeness */}
        <div className="rounded-2xl border bg-white p-5 shadow-xs flex flex-col justify-between" style={{ borderColor: "var(--border-color)" }}>
          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-brand-500">
                Profile Completeness
              </h3>
              <span className="font-mono text-sm font-bold text-brand-950">
                {localSeo ? "85%" : "—"}
              </span>
            </div>

            {/* Progress Bar */}
            <div className="mt-4 w-full bg-brand-100 rounded-full h-2.5 overflow-hidden">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                style={{ width: localSeo ? "85%" : "0%" }}
              />
            </div>

            {/* Completeness Legend */}
            <div className="mt-5 space-y-2 text-xs font-medium text-brand-700">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span>Completed {localSeo ? 12 : 0}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                <span>Needs Attention {localSeo ? 4 : 0}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                <span>Missing {localSeo ? 3 : 0}</span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-brand-100">
            <button
              type="button"
              onClick={() => onSelectTab("action-plan")}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 transition"
            >
              <span>Complete Missing Fields</span>
              <ArrowRight size={13} />
            </button>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="rounded-2xl border bg-white p-5 shadow-xs flex flex-col justify-between" style={{ borderColor: "var(--border-color)" }}>
          <div>
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-brand-500">
              <Sparkles size={13} className="text-blue-600" />
              <span>Quick Actions</span>
            </div>

            <div className="mt-3 space-y-2">
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                  businessName + " " + address
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-2 rounded-lg hover:bg-brand-50 border border-transparent hover:border-brand-200 text-xs font-semibold text-brand-800 transition"
              >
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded bg-blue-50 text-blue-600 flex items-center justify-center">
                    <GoogleGLogo size={12} />
                  </div>
                  <span>Edit on Google</span>
                </div>
                <ArrowRight size={12} className="text-brand-400" />
              </a>

              <button
                type="button"
                onClick={() => onSelectTab("action-plan")}
                className="flex w-full items-center justify-between p-2 rounded-lg hover:bg-brand-50 border border-transparent hover:border-brand-200 text-xs font-semibold text-brand-800 transition"
              >
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded bg-purple-50 text-purple-600 flex items-center justify-center">
                    <Sparkles size={12} />
                  </div>
                  <span>Generate Business Description (AI)</span>
                </div>
                <ArrowRight size={12} className="text-brand-400" />
              </button>

              <button
                type="button"
                onClick={() => onSelectTab("services")}
                className="flex w-full items-center justify-between p-2 rounded-lg hover:bg-brand-50 border border-transparent hover:border-brand-200 text-xs font-semibold text-brand-800 transition"
              >
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded bg-blue-50 text-blue-600 flex items-center justify-center">
                    <Briefcase size={12} />
                  </div>
                  <span>Add Missing Services</span>
                </div>
                <ArrowRight size={12} className="text-brand-400" />
              </button>

              <button
                type="button"
                onClick={() => onSelectTab("photos")}
                className="flex w-full items-center justify-between p-2 rounded-lg hover:bg-brand-50 border border-transparent hover:border-brand-200 text-xs font-semibold text-brand-800 transition"
              >
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded bg-blue-50 text-blue-600 flex items-center justify-center">
                    <Upload size={12} />
                  </div>
                  <span>Upload New Photos</span>
                </div>
                <ArrowRight size={12} className="text-brand-400" />
              </button>

              <button
                type="button"
                onClick={() => onSelectTab("reviews")}
                className="flex w-full items-center justify-between p-2 rounded-lg hover:bg-brand-50 border border-transparent hover:border-brand-200 text-xs font-semibold text-brand-800 transition"
              >
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded bg-amber-50 text-amber-600 flex items-center justify-center">
                    <Star size={12} />
                  </div>
                  <span>Request Reviews</span>
                </div>
                <ArrowRight size={12} className="text-brand-400" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Middle Row: Categories Breakdown + Top Issues + Google Preview ─ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Audit Categories (5 cols) */}
        <div className="lg:col-span-5 rounded-2xl border bg-white p-5 shadow-xs" style={{ borderColor: "var(--border-color)" }}>
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-bold text-brand-950">Audit Categories</h3>
            <button
              type="button"
              onClick={() => onSelectTab("action-plan")}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              <span>View All</span>
              <ArrowRight size={12} />
            </button>
          </div>
          <p className="text-xs text-brand-400 mb-3">Detailed breakdown of your profile health.</p>

          <div className="divide-y divide-brand-100">
            {auditCategories.map((cat) => {
              const Icon = cat.icon;
              return (
                <div
                  key={cat.id}
                  onClick={() => onSelectTab(cat.tab)}
                  className="py-3 first:pt-0 last:pb-0 flex items-center justify-between hover:bg-brand-50/50 -mx-2 px-2 rounded-lg cursor-pointer transition"
                >
                  <div className="flex items-center gap-3 min-w-0 pr-2">
                    <div className="w-8 h-8 rounded-lg bg-brand-50 text-blue-600 flex items-center justify-center shrink-0 border border-brand-200/50">
                      <Icon size={15} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-brand-950 truncate">{cat.name}</p>
                      <p className="text-[11px] text-brand-400 truncate">{cat.subtitle}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0">
                    <span className="font-mono text-xs font-bold text-brand-950">
                      {cat.score != null ? `${cat.score}/100` : "—"}
                    </span>
                    <span
                      className={cn(
                        "text-[10px] font-bold px-2 py-0.5 rounded-full border",
                        cat.statusTone === "good"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : cat.statusTone === "warning"
                          ? "bg-amber-50 text-amber-700 border-amber-200"
                          : "bg-rose-50 text-rose-700 border-rose-200"
                      )}
                    >
                      {cat.status}
                    </span>
                    <ArrowRight size={12} className="text-brand-400" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top Issues to Fix (4 cols) */}
        <div className="lg:col-span-4 rounded-2xl border bg-white p-5 shadow-xs" style={{ borderColor: "var(--border-color)" }}>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1.5">
              <AlertCircle size={14} className="text-rose-500" />
              <h3 className="text-sm font-bold text-brand-950">Top Issues to Fix</h3>
            </div>
            <button
              type="button"
              onClick={() => onSelectTab("action-plan")}
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
                title: "Add business attributes",
                subtitle: "Add amenities like 'Home delivery', 'In-store shopping' and more.",
                tab: "action-plan" as GbpTabKey,
              },
              {
                priority: "High",
                title: "Improve business description",
                subtitle: "Add more details, local keywords and services.",
                tab: "action-plan" as GbpTabKey,
              },
              {
                priority: "Medium",
                title: "Add more photos",
                subtitle: "You have 12 photos. Top competitors have 50+.",
                tab: "photos" as GbpTabKey,
              },
              {
                priority: "Medium",
                title: "Add secondary categories",
                subtitle: "Add 2-3 relevant secondary categories.",
                tab: "categories" as GbpTabKey,
              },
              {
                priority: "Low",
                title: "Post regular updates",
                subtitle: "Your last post was 45 days ago.",
                tab: "posts" as GbpTabKey,
              },
            ].map((issue) => (
              <div
                key={issue.title}
                onClick={() => onSelectTab(issue.tab)}
                className="p-3 rounded-xl border border-brand-100 hover:bg-brand-50/70 cursor-pointer transition flex items-center justify-between"
              >
                <div className="min-w-0 pr-2">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span
                      className={cn(
                        "text-[10px] font-bold px-1.5 py-0.2 rounded border",
                        issue.priority === "High"
                          ? "bg-rose-50 text-rose-700 border-rose-200"
                          : issue.priority === "Medium"
                          ? "bg-amber-50 text-amber-700 border-amber-200"
                          : "bg-emerald-50 text-emerald-700 border-emerald-200"
                      )}
                    >
                      {issue.priority}
                    </span>
                    <p className="text-xs font-bold text-brand-950 truncate">{issue.title}</p>
                  </div>
                  <p className="text-[11px] text-brand-500 line-clamp-2">{issue.subtitle}</p>
                </div>
                <ArrowRight size={13} className="text-brand-400 shrink-0" />
              </div>
            ))}
          </div>
        </div>

        {/* Profile Preview (Google Maps / Search Card) (3 cols) */}
        <div className="lg:col-span-3 space-y-4">
          <div className="rounded-2xl border bg-white overflow-hidden shadow-xs" style={{ borderColor: "var(--border-color)" }}>
            <div className="p-4 pb-2 border-b flex items-center justify-between" style={{ borderColor: "var(--border-color)" }}>
              <span className="text-xs font-bold text-brand-950">Profile Preview</span>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                  businessName + " " + address
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                title="View on Google"
                className="text-brand-400 hover:text-brand-950 transition"
              >
                <ExternalLink size={13} />
              </a>
            </div>

            {/* Mock Header Visual / Photos */}
            <div className="relative h-24 bg-gradient-to-r from-emerald-600 via-teal-600 to-blue-600 flex items-center justify-center text-white">
              <span className="font-semibold text-xs tracking-wider opacity-80">Storefront Visual</span>
              <div className="absolute bottom-2 right-2 bg-black/50 text-white text-[9px] px-2 py-0.5 rounded-full flex items-center gap-1">
                <ImageIcon size={10} /> See photos
              </div>
            </div>

            {/* Profile Content */}
            <div className="p-4 space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-full bg-emerald-700 text-white font-bold text-sm flex items-center justify-center shadow-sm shrink-0">
                  {businessName.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <h4 className="text-sm font-bold text-brand-950 truncate">{businessName}</h4>
                  <div className="flex items-center gap-1 text-xs">
                    <span className="font-bold text-brand-950">{rating}</span>
                    <div className="flex text-amber-500">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} size={10} className="fill-amber-500" />
                      ))}
                    </div>
                    <span className="text-brand-400 text-[10px]">({reviewCount})</span>
                  </div>
                  <p className="text-[11px] text-brand-500">Local Business</p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-4 gap-1 pt-1 text-center">
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                    <Globe size={13} />
                  </div>
                  <span className="text-[9.5px] font-medium text-brand-700 mt-1">Website</span>
                </div>
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                    <Navigation size={13} />
                  </div>
                  <span className="text-[9.5px] font-medium text-brand-700 mt-1">Directions</span>
                </div>
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                    <Phone size={13} />
                  </div>
                  <span className="text-[9.5px] font-medium text-brand-700 mt-1">Call</span>
                </div>
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                    <Share2 size={13} />
                  </div>
                  <span className="text-[9.5px] font-medium text-brand-700 mt-1">Share</span>
                </div>
              </div>

              {/* Listing Details */}
              <div className="pt-2 border-t space-y-2 text-xs text-brand-700" style={{ borderColor: "var(--border-color)" }}>
                <div className="flex items-center gap-2">
                  <Clock size={12} className="text-emerald-600 shrink-0" />
                  <span>Open · Closes 10:00 PM</span>
                </div>
                <div className="flex items-start gap-2">
                  <MapPin size={12} className="text-brand-400 shrink-0 mt-0.5" />
                  <span className="truncate">{address}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone size={12} className="text-brand-400 shrink-0" />
                  <span>+1 (555) 019-2831</span>
                </div>
              </div>
            </div>
          </div>

          {/* Competitor Comparison Card */}
          <div className="rounded-2xl border bg-white p-4 shadow-xs" style={{ borderColor: "var(--border-color)" }}>
            <div className="flex items-center gap-2 text-xs font-bold text-brand-950">
              <BarChart2 size={15} className="text-purple-600" />
              <span>Competitor Comparison</span>
            </div>
            <p className="text-[11px] text-brand-500 mt-1 leading-normal">
              See how your profile compares with top local competitors.
            </p>
            <button
              type="button"
              onClick={() => onSelectTab("competitors")}
              className="mt-3 w-full py-1.5 px-3 rounded-lg border border-brand-200 text-xs font-semibold text-brand-800 hover:bg-brand-50 transition flex items-center justify-center gap-1"
            >
              <span>View Competitors</span>
              <ArrowRight size={12} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Bottom Banner: AI Recommendations ──────────────────────── */}
      <div className="rounded-2xl border bg-gradient-to-r from-emerald-50 via-teal-50 to-blue-50 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 border-emerald-200/60 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-sm shrink-0">
            <Sparkles size={24} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-brand-950">
              Optimize Your Profile with AI
            </h3>
            <p className="text-xs text-brand-600 mt-0.5">
              Get AI-powered suggestions to improve your profile and attract more customers.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onGenerateAiRecommendations}
          className="shrink-0 px-4 py-2.5 rounded-xl bg-emerald-700 text-white text-xs font-bold shadow-sm hover:bg-emerald-800 transition flex items-center gap-2"
        >
          <Sparkles size={14} />
          <span>Generate AI Recommendations</span>
          <ArrowRight size={13} />
        </button>
      </div>
    </div>
  );
}
