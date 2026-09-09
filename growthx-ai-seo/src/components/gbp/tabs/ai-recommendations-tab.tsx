"use client";

import React, { useState } from "react";
import {
  Sparkles,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  Zap,
  Target,
  BarChart2,
  Users,
  Check,
  ChevronDown,
  ChevronUp,
  Tag,
  Settings,
  Image as ImageIcon,
  MessageSquare,
  FileText,
  Lightbulb,
  Calendar,
  Rocket,
  Download,
  ExternalLink,
} from "lucide-react";
import {
  useGbpProposals,
  useAnalyzeGbp,
  useApproveGbpFix,
  useRejectGbpFix,
} from "@/hooks/use-growthx";
import { CircularScoreGauge } from "../circular-score-gauge";
import type { GbpFixProposal, LocalSeoData } from "@/lib/api-client";
import { cn } from "@/lib/utils";

interface AiRecommendationsTabProps {
  localSeo: LocalSeoData | null | undefined;
  projectId: string | null;
}

type PriorityFilter = "All" | "High Priority" | "Medium" | "Low" | "Quick Wins";

interface RecommendationCard {
  id: string;
  rank: number;
  iconType: "category" | "service" | "photo" | "review" | "description";
  title: string;
  description: string;
  priority: "High Priority" | "Medium" | "Low";
  impact: "High Impact" | "Medium Impact" | "Low Impact";
  metricGain: string;
  aiAgreement: "3/3" | "2/3";
  supportedModels: ("openai" | "claude" | "gemini")[];
  actionTab?: string;
  isQuickWin?: boolean;
}

// Model SVG Logos
function OpenAiIcon({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M22.28 9.37a5.998 5.998 0 0 0-.5-4.44 6.046 6.046 0 0 0-6.19-3.08 5.99 5.99 0 0 0-4.63-2.12c-3.1 0-5.69 2.34-6.04 5.39a6.002 6.002 0 0 0-4.08 2.97 6.044 6.044 0 0 0 .84 6.89 5.998 5.998 0 0 0 .5 4.44 6.046 6.046 0 0 0 6.19 3.08 5.99 5.99 0 0 0 4.63 2.12c3.1 0 5.69-2.34 6.04-5.39a6.002 6.002 0 0 0 4.08-2.97 6.044 6.044 0 0 0-.84-6.89zM12 4.07c.83 0 1.63.22 2.33.64l-3.32 1.92-2.17-1.25c.87-.84 2-1.31 3.16-1.31zm-6.22 3.6c.46-.79 1.13-1.42 1.94-1.82l.01 3.84 3.32 1.92-3.32 1.92v-3.84c-.75-.24-1.39-.73-1.83-1.38l-.12-.64zm-.16 7.6c-.46-.79-.62-1.7-.47-2.61l3.32-1.92 2.17 1.25c-.87.84-1.42 1.97-1.55 3.17l-3.47.11zm8.38 4.66c-.83 0-1.63-.22-2.33-.64l3.32-1.92 2.17 1.25c-.87.84-2 1.31-3.16 1.31zm6.22-3.6c-.46.79-1.13 1.42-1.94 1.82l-.01-3.84-3.32-1.92 3.32-1.92v3.84c.75.24 1.39.73 1.83 1.38l.12.64zm.16-7.6c.46.79.62 1.7.47 2.61l-3.32 1.92-2.17-1.25c.87-.84 1.42-1.97 1.55-3.17l3.47-.11z" />
    </svg>
  );
}

function ClaudeIcon({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2a1 1 0 0 1 1 1v2.07a8.002 8.002 0 0 1 6.93 6.93H22a1 1 0 1 1 0 2h-2.07a8.002 8.002 0 0 1-6.93 6.93V22a1 1 0 1 1-2 0v-2.07A8.002 8.002 0 0 1 4.07 13H2a1 1 0 1 1 0-2h2.07A8.002 8.002 0 0 1 11 4.07V3a1 1 0 0 1 1-1zm0 4.08A6.002 6.002 0 0 0 6.08 12 6.002 6.002 0 0 0 12 17.92 6.002 6.002 0 0 0 17.92 12 6.002 6.002 0 0 0 12 6.08z" />
    </svg>
  );
}

function GeminiIcon({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 24c-0.2 0-0.3-0.1-0.4-0.2C8.8 17.7 6.3 15.2 0.2 12.4c-0.3-0.1-0.3-0.7 0-0.8 6.1-2.8 8.6-5.3 11.4-11.4 0.1-0.3 0.7-0.3 0.8 0 2.8 6.1 5.3 8.6 11.4 11.4 0.3 0.1 0.3 0.7 0 0.8-6.1 2.8-8.6 5.3-11.4 11.4-0.1 0.1-0.2 0.2-0.4 0.2z" />
    </svg>
  );
}

export function AiRecommendationsTab({ localSeo, projectId }: AiRecommendationsTabProps) {
  const businessName = localSeo?.businessName || "MilQuu Fresh";
  const { data: proposals = [], isLoading, refetch } = useGbpProposals(projectId);
  const analyzeMutation = useAnalyzeGbp(projectId);
  const approveMutation = useApproveGbpFix(projectId);

  const [activeFilter, setActiveFilter] = useState<PriorityFilter>("All");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [appliedIds, setAppliedIds] = useState<string[]>([]);
  const [isApplyingAll, setIsApplyingAll] = useState(false);

  // Recommendations data set matching screenshot
  const recommendationsList: RecommendationCard[] = [
    {
      id: "rec-1",
      rank: 1,
      iconType: "category",
      title: "Add Relevant Secondary Categories",
      description:
        "Your competitors rank higher because they use more relevant categories. Add 2-3 secondary categories to appear in more searches.",
      priority: "High Priority",
      impact: "High Impact",
      metricGain: "+28% visibility",
      aiAgreement: "3/3",
      supportedModels: ["openai", "claude", "gemini"],
      actionTab: "categories",
      isQuickWin: true,
    },
    {
      id: "rec-2",
      rank: 2,
      iconType: "service",
      title: "Add Missing Services",
      description:
        "You currently have 8 services, while top competitors have 11+. Add services like 'Milk Delivery' and 'Fresh Vegetables'.",
      priority: "High Priority",
      impact: "High Impact",
      metricGain: "+22% views",
      aiAgreement: "3/3",
      supportedModels: ["openai", "claude", "gemini"],
      actionTab: "services",
      isQuickWin: true,
    },
    {
      id: "rec-3",
      rank: 3,
      iconType: "photo",
      title: "Upload More Photos",
      description:
        "Businesses with 50+ photos get 2.3x more clicks. You currently have 42 photos. Add storefront, team, products and delivery photos.",
      priority: "High Priority",
      impact: "Medium Impact",
      metricGain: "+35% clicks",
      aiAgreement: "2/3",
      supportedModels: ["openai", "claude"],
      actionTab: "photos",
      isQuickWin: false,
    },
    {
      id: "rec-4",
      rank: 4,
      iconType: "review",
      title: "Increase Review Velocity",
      description:
        "You have 327 reviews, while top competitors average 842. Request more reviews from recent customers.",
      priority: "Medium",
      impact: "High Impact",
      metricGain: "+25% conversions",
      aiAgreement: "2/3",
      supportedModels: ["openai", "claude"],
      actionTab: "reviews",
      isQuickWin: false,
    },
    {
      id: "rec-5",
      rank: 5,
      iconType: "description",
      title: "Optimize Business Description",
      description:
        "Your description is short. Add keywords like 'fresh milk', 'home delivery', 'farm fresh' to improve relevance.",
      priority: "Medium",
      impact: "Medium Impact",
      metricGain: "+15% views",
      aiAgreement: "2/3",
      supportedModels: ["openai", "gemini"],
      actionTab: "action-plan",
      isQuickWin: true,
    },
  ];

  const handleRunAnalysis = () => {
    analyzeMutation.mutate(undefined, {
      onSuccess: () => refetch(),
    });
  };

  const handleApplySingle = (id: string) => {
    if (!appliedIds.includes(id)) {
      setAppliedIds([...appliedIds, id]);
    }
  };

  const handleApplyAll = () => {
    setIsApplyingAll(true);
    setTimeout(() => {
      setAppliedIds(recommendationsList.map((r) => r.id));
      setIsApplyingAll(false);
    }, 800);
  };

  // Filter recommendations
  const filteredRecommendations = recommendationsList.filter((r) => {
    if (activeFilter === "All") return true;
    if (activeFilter === "High Priority") return r.priority === "High Priority";
    if (activeFilter === "Medium") return r.priority === "Medium";
    if (activeFilter === "Low") return r.priority === "Low";
    if (activeFilter === "Quick Wins") return Boolean(r.isQuickWin);
    return true;
  });

  const getIconForType = (type: RecommendationCard["iconType"]) => {
    switch (type) {
      case "category":
        return <Tag size={16} className="text-rose-600" />;
      case "service":
        return <Settings size={16} className="text-blue-600" />;
      case "photo":
        return <ImageIcon size={16} className="text-pink-600" />;
      case "review":
        return <MessageSquare size={16} className="text-blue-600" />;
      case "description":
        return <FileText size={16} className="text-indigo-600" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Sub-navigation Bar ────────────────────────────────────────── */}
      <div className="flex items-center gap-6 border-b border-brand-100 overflow-x-auto text-xs font-semibold text-brand-500 pb-0.5">
        <button
          type="button"
          className="pb-3 border-b-2 border-blue-600 text-blue-600 font-bold whitespace-nowrap"
        >
          Overview
        </button>
        <a href="?tab=action-plan" className="pb-3 hover:text-brand-950 whitespace-nowrap">
          Action Plan
        </a>
        <a href="?tab=categories" className="pb-3 hover:text-brand-950 whitespace-nowrap">
          Category &amp; Services
        </a>
        <a href="?tab=posts" className="pb-3 hover:text-brand-950 whitespace-nowrap">
          Content &amp; Posts
        </a>
        <a href="?tab=reviews" className="pb-3 hover:text-brand-950 whitespace-nowrap">
          Reviews
        </a>
        <a href="?tab=photos" className="pb-3 hover:text-brand-950 whitespace-nowrap">
          Photos
        </a>
        <a href="?tab=local-rankings" className="pb-3 hover:text-brand-950 whitespace-nowrap">
          Local Rankings
        </a>
        <a href="?tab=competitors" className="pb-3 hover:text-brand-950 whitespace-nowrap">
          Competitors
        </a>
      </div>

      {/* ── Hero Banner: Your AI Growth Plan ─────────────────────────── */}
      <div
        className="rounded-2xl border bg-white p-6 shadow-xs flex flex-col md:flex-row items-center justify-between gap-6"
        style={{ borderColor: "var(--border-color)" }}
      >
        <div className="space-y-3 flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-xs">
              <Sparkles size={16} />
            </div>
            <h2 className="text-lg font-bold text-brand-950 tracking-tight">Your AI Growth Plan</h2>

            {/* AI Model Badges */}
            <div className="flex items-center gap-1.5 pl-2">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[11px] font-semibold border border-emerald-200">
                <OpenAiIcon className="w-3 h-3 text-emerald-700" />
                <span>OpenAI</span>
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 text-[11px] font-semibold border border-amber-200">
                <ClaudeIcon className="w-3 h-3 text-amber-700" />
                <span>Claude</span>
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-[11px] font-semibold border border-blue-200">
                <GeminiIcon className="w-3 h-3 text-blue-700" />
                <span>Gemini</span>
              </span>
            </div>
          </div>

          <p className="text-xs text-brand-600 max-w-2xl leading-relaxed">
            We analyzed your Google Business Profile, reviews, photos, services, categories, local rankings and 12
            competitors using OpenAI, Claude and Gemini to create a personalized improvement plan.
          </p>
        </div>

        {/* Right Score Gauge */}
        <div className="flex items-center gap-4 border-t md:border-t-0 md:border-l border-brand-100 pt-4 md:pt-0 md:pl-6 shrink-0">
          <CircularScoreGauge score={78} size={92} strokeWidth={9} />
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-brand-900">Local SEO Score</span>
              <div className="flex items-center gap-0.5 text-[11px] font-bold text-emerald-600">
                <span>+12</span>
                <span className="text-[10px] text-brand-400 font-normal">vs last 28 days</span>
              </div>
            </div>
            <div>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                Good
              </span>
            </div>
            <p className="text-[11px] text-brand-500 max-w-[150px] leading-tight">
              You&apos;re on the right track. Follow the recommendations to reach 90+.
            </p>
          </div>
        </div>
      </div>

      {/* ── 4 Metric Summary Cards ───────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Recommendations */}
        <div
          className="rounded-2xl border bg-white p-5 shadow-xs flex items-center gap-4"
          style={{ borderColor: "var(--border-color)" }}
        >
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
            <Target size={20} />
          </div>
          <div>
            <div className="text-2xl font-black text-brand-950">12</div>
            <div className="text-xs font-bold text-brand-800">Total Recommendations</div>
            <div className="text-[11px] text-brand-400">Prioritized for maximum impact</div>
          </div>
        </div>

        {/* Card 2: Potential Profile Views */}
        <div
          className="rounded-2xl border bg-white p-5 shadow-xs flex items-center gap-4"
          style={{ borderColor: "var(--border-color)" }}
        >
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <BarChart2 size={20} />
          </div>
          <div>
            <div className="text-2xl font-black text-emerald-600">+62%</div>
            <div className="text-xs font-bold text-brand-800">Potential Profile Views</div>
            <div className="text-[11px] text-brand-400">Estimated increase after implementation</div>
          </div>
        </div>

        {/* Card 3: Estimated New Customers */}
        <div
          className="rounded-2xl border bg-white p-5 shadow-xs flex items-center gap-4"
          style={{ borderColor: "var(--border-color)" }}
        >
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
            <Users size={20} />
          </div>
          <div>
            <div className="text-2xl font-black text-brand-950">+180 / month</div>
            <div className="text-xs font-bold text-brand-800">Estimated New Customers</div>
            <div className="text-[11px] text-brand-400">Based on similar businesses</div>
          </div>
        </div>

        {/* Card 4: AI Models Agreement */}
        <div
          className="rounded-2xl border bg-white p-5 shadow-xs flex items-center gap-4"
          style={{ borderColor: "var(--border-color)" }}
        >
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <CheckCircle2 size={20} />
          </div>
          <div>
            <div className="text-2xl font-black text-brand-950">3/3</div>
            <div className="text-xs font-bold text-brand-800">AI Models Agreement</div>
            <div className="text-[11px] text-brand-400">High confidence recommendations</div>
          </div>
        </div>
      </div>

      {/* ── Main Section: Top Recommendations & Right Sidebar ────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left (8 cols): Top Recommendations */}
        <div className="lg:col-span-8 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-brand-950">Top Recommendations</h2>
              <p className="text-xs text-brand-500">
                AI-powered suggestions based on your business data. Click on any recommendation to see full details.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] text-brand-500">Sort by:</span>
              <select className="h-8 px-2 text-xs rounded-lg border border-brand-200 bg-white font-medium text-brand-800 focus:outline-none">
                <option value="impact">Sort by Impact</option>
                <option value="priority">Sort by Priority</option>
                <option value="effort">Sort by Effort</option>
              </select>
            </div>
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveFilter("All")}
              className={cn(
                "px-3 py-1 rounded-full text-xs font-semibold transition-all",
                activeFilter === "All"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "bg-white border border-brand-200 text-brand-700 hover:bg-brand-50"
              )}
            >
              All (12)
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter("High Priority")}
              className={cn(
                "px-3 py-1 rounded-full text-xs font-semibold transition-all",
                activeFilter === "High Priority"
                  ? "bg-rose-600 text-white shadow-xs"
                  : "bg-white border border-rose-200 text-rose-700 hover:bg-rose-50"
              )}
            >
              High Priority (4)
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter("Medium")}
              className={cn(
                "px-3 py-1 rounded-full text-xs font-semibold transition-all",
                activeFilter === "Medium"
                  ? "bg-amber-600 text-white shadow-xs"
                  : "bg-white border border-amber-200 text-amber-700 hover:bg-amber-50"
              )}
            >
              Medium (5)
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter("Low")}
              className={cn(
                "px-3 py-1 rounded-full text-xs font-semibold transition-all",
                activeFilter === "Low"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "bg-white border border-blue-200 text-blue-700 hover:bg-blue-50"
              )}
            >
              Low (3)
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter("Quick Wins")}
              className={cn(
                "px-3 py-1 rounded-full text-xs font-semibold transition-all",
                activeFilter === "Quick Wins"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "bg-white border border-emerald-200 text-emerald-700 hover:bg-emerald-50"
              )}
            >
              Quick Wins (4)
            </button>
          </div>

          {/* Recommendations Cards List */}
          <div className="space-y-3 pt-1">
            {filteredRecommendations.map((rec) => {
              const isExpanded = expandedId === rec.id;
              const isApplied = appliedIds.includes(rec.id);

              return (
                <div
                  key={rec.id}
                  className={cn(
                    "rounded-2xl border bg-white p-4 shadow-xs transition-all space-y-3",
                    isApplied ? "border-emerald-200 bg-emerald-50/20" : "hover:border-brand-300"
                  )}
                  style={{ borderColor: isApplied ? undefined : "var(--border-color)" }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      {/* Number Rank */}
                      <span
                        className={cn(
                          "w-6 h-6 rounded-full flex items-center justify-center text-xs font-black shrink-0 mt-0.5",
                          rec.priority === "High Priority"
                            ? "bg-rose-50 text-rose-700 border border-rose-200"
                            : "bg-amber-50 text-amber-700 border border-amber-200"
                        )}
                      >
                        {rec.rank}
                      </span>

                      {/* Icon */}
                      <div className="w-8 h-8 rounded-xl bg-brand-50 border border-brand-100 flex items-center justify-center shrink-0">
                        {getIconForType(rec.iconType)}
                      </div>

                      <div className="space-y-1">
                        <h3 className="text-xs font-bold text-brand-950">{rec.title}</h3>
                        <p className="text-xs text-brand-500 leading-relaxed max-w-xl">{rec.description}</p>

                        {/* Badges Bar */}
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <span
                            className={cn(
                              "text-[10px] font-bold px-2 py-0.5 rounded-md",
                              rec.priority === "High Priority"
                                ? "bg-rose-50 text-rose-700 border border-rose-200"
                                : "bg-amber-50 text-amber-700 border border-amber-200"
                            )}
                          >
                            {rec.priority}
                          </span>

                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                            {rec.metricGain}
                          </span>

                          <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-50 border border-slate-200 text-[10px] text-brand-600 font-medium">
                            <span>AI Agreement: {rec.aiAgreement}</span>
                            <div className="flex items-center gap-0.5 pl-0.5">
                              {rec.supportedModels.includes("openai") && (
                                <OpenAiIcon className="w-2.5 h-2.5 text-emerald-600" />
                              )}
                              {rec.supportedModels.includes("claude") && (
                                <ClaudeIcon className="w-2.5 h-2.5 text-amber-600" />
                              )}
                              {rec.supportedModels.includes("gemini") && (
                                <GeminiIcon className="w-2.5 h-2.5 text-blue-600" />
                              )}
                            </div>
                          </div>

                          <span
                            className={cn(
                              "text-[10px] font-semibold px-2 py-0.5 rounded-md",
                              rec.impact === "High Impact"
                                ? "bg-rose-50 text-rose-700 border border-rose-200"
                                : "bg-amber-50 text-amber-700 border border-amber-200"
                            )}
                          >
                            {rec.impact}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Action button & expand toggle */}
                    <div className="flex items-center gap-2 shrink-0">
                      {isApplied ? (
                        <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-100 text-emerald-800 text-xs font-bold">
                          <Check size={12} />
                          <span>Applied</span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleApplySingle(rec.id)}
                          className="px-3.5 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 shadow-xs transition-all"
                        >
                          View Details
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => setExpandedId(isExpanded ? null : rec.id)}
                        className="p-1 rounded-md text-brand-400 hover:text-brand-700 hover:bg-brand-50"
                      >
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                    </div>
                  </div>

                  {/* Expanded Detail Panel */}
                  {isExpanded && (
                    <div className="pt-3 mt-3 border-t border-brand-100 text-xs text-brand-700 space-y-3 bg-brand-50/50 p-3.5 rounded-xl">
                      <div className="font-semibold text-brand-950">Recommended Action Steps:</div>
                      <ul className="list-disc pl-5 space-y-1 text-brand-600">
                        <li>Navigate to the {rec.actionTab} section in your Google Business Profile manager.</li>
                        <li>Implement the suggested changes based on local competitor benchmarks.</li>
                        <li>Sync with Google to verify the update takes effect immediately.</li>
                      </ul>

                      <div className="flex items-center justify-between pt-2">
                        <a
                          href={`?tab=${rec.actionTab || "overview"}`}
                          className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700"
                        >
                          <span>Go to {rec.title.replace("Add ", "").replace("Upload ", "")} Section</span>
                          <ArrowRight size={12} />
                        </a>

                        {!isApplied && (
                          <button
                            type="button"
                            onClick={() => handleApplySingle(rec.id)}
                            className="px-3 py-1 rounded-lg bg-brand-950 text-white text-xs font-bold hover:opacity-90"
                          >
                            Mark as Applied
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right (4 cols): AI Insight Summary, Model Consensus & Ready to Implement */}
        <div className="lg:col-span-4 space-y-4">
          {/* Card 1: AI Insight Summary */}
          <div
            className="rounded-2xl border bg-white p-5 shadow-xs space-y-3"
            style={{ borderColor: "var(--border-color)" }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                  <Lightbulb size={16} />
                </div>
                <h3 className="text-xs font-bold text-brand-950">AI Insight Summary</h3>
              </div>
              <a href="#full-report" className="text-[11px] font-bold text-blue-600 hover:text-blue-700">
                View Full Report &rarr;
              </a>
            </div>

            <p className="text-xs text-brand-600 leading-relaxed">
              Your Google Business Profile is performing well, but there are several opportunities to increase your
              visibility and attract more customers. Based on analysis by OpenAI, Claude and Gemini, focus on adding
              missing services and categories, posting regularly, and getting more reviews. Implementing these
              recommendations could increase your profile views by up to 62%.
            </p>

            {/* Quote banner */}
            <div className="p-3 rounded-xl bg-purple-50/70 border border-purple-100 text-xs text-purple-900 leading-relaxed font-medium">
              &quot;Businesses that actively optimize their Google Business Profile get 2.5x more customer actions than
              those that don&apos;t.&quot;
              <div className="text-[10px] text-purple-600 font-bold pt-1">— GrowthX AI Insights</div>
            </div>
          </div>

          {/* Card 2: AI Model Consensus */}
          <div
            className="rounded-2xl border bg-white p-5 shadow-xs space-y-3"
            style={{ borderColor: "var(--border-color)" }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Sparkles size={16} />
                </div>
                <h3 className="text-xs font-bold text-brand-950">AI Model Consensus</h3>
              </div>
              <a href="#model-analysis" className="text-[11px] font-bold text-blue-600 hover:text-blue-700">
                View Model Analysis &rarr;
              </a>
            </div>

            <div className="space-y-2.5 pt-1">
              {/* OpenAI */}
              <div className="flex items-center justify-between p-2.5 rounded-xl border border-brand-100 bg-white">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
                    <OpenAiIcon className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-brand-950">OpenAI (GPT-4)</h4>
                    <p className="text-[10px] text-brand-400">Focuses on strategy and prioritization</p>
                  </div>
                </div>

                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <Check size={11} />
                  <span>12 recommendations</span>
                </span>
              </div>

              {/* Claude */}
              <div className="flex items-center justify-between p-2.5 rounded-xl border border-brand-100 bg-white">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
                    <ClaudeIcon className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-brand-950">Claude (Sonnet)</h4>
                    <p className="text-[10px] text-brand-400">Deep analysis and competitive insights</p>
                  </div>
                </div>

                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <Check size={11} />
                  <span>11 recommendations</span>
                </span>
              </div>

              {/* Gemini */}
              <div className="flex items-center justify-between p-2.5 rounded-xl border border-brand-100 bg-white">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
                    <GeminiIcon className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-brand-950">Gemini (1.5 Pro)</h4>
                    <p className="text-[10px] text-brand-400">Data patterns and local search trends</p>
                  </div>
                </div>

                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <Check size={11} />
                  <span>12 recommendations</span>
                </span>
              </div>
            </div>
          </div>

          {/* Card 3: Ready to Implement? Banner */}
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-5 shadow-xs space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs shrink-0">
                <Rocket size={16} />
              </div>
              <div>
                <h3 className="text-xs font-bold text-emerald-950">Ready to Implement?</h3>
                <p className="text-[11px] text-emerald-800 leading-tight">
                  Apply AI recommendations to your Google Business Profile with one click. Review and approve changes
                  before publishing.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-1">
              <button
                type="button"
                onClick={handleApplyAll}
                disabled={isApplyingAll}
                className="w-full py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-xs"
              >
                <Check size={13} />
                <span>{isApplyingAll ? "Applying Changes…" : "Apply Selected Recommendations"}</span>
                <ArrowRight size={13} />
              </button>

              <button
                type="button"
                className="w-full py-2 rounded-xl border border-emerald-300 bg-white hover:bg-emerald-50/50 text-emerald-800 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
              >
                <Calendar size={13} />
                <span>Schedule for Later</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
