"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Zap,
  Globe,
  MapPin,
  TrendingUp,
  Building2,
  Users,
  Search,
  Crosshair,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  ChevronRight,
  Sliders,
  FileText,
  BadgeCheck,
  Layers,
  BarChart3,
  RefreshCw,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ActionButton, Pill } from "@/components/ui/console";
import {
  useSpecializedAi,
  useQuerySpecializedAi,
} from "@/hooks/use-growthx";
import type {
  ClaudeMarketIntelligence,
  OpenAiCommercialIntelligence,
  GeminiEcosystemIntelligence,
  SpecializedAiIntelligence,
} from "@/lib/api-client";

interface SpecializedEnginesPanelProps {
  projectId: string;
  domain?: string;
  businessName?: string;
}

type EngineTab = "claude" | "openai" | "gemini";

const POPULAR_LOCATIONS = [
  "Navi Mumbai",
  "Mumbai Metro",
  "Bengaluru Tech Corridor",
  "Pune IT Belt",
  "Delhi NCR",
];

export function SpecializedEnginesPanel({
  projectId,
  domain,
  businessName,
}: SpecializedEnginesPanelProps) {
  const [selectedEngine, setSelectedEngine] = useState<EngineTab>("claude");
  const [locationInput, setLocationInput] = useState<string>("Navi Mumbai");
  const [appliedLocation, setAppliedLocation] = useState<string>("Navi Mumbai");

  const specializedQuery = useSpecializedAi(projectId, selectedEngine, appliedLocation);
  const queryMutation = useQuerySpecializedAi(projectId);

  const handleLocationSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!locationInput.trim()) return;
    setAppliedLocation(locationInput.trim());
  };

  const handleQuickLocation = (loc: string) => {
    setLocationInput(loc);
    setAppliedLocation(loc);
  };

  const data = specializedQuery.data;

  return (
    <div
      className="rounded-2xl border bg-white dark:bg-brand-900/90 shadow-sm overflow-hidden"
      style={{ borderColor: "var(--border-color, rgba(226, 232, 240, 0.8))" }}
    >
      {/* Section Header */}
      <div className="p-6 border-b border-brand-100 dark:border-brand-800 bg-gradient-to-r from-brand-50/50 via-white to-brand-50/20 dark:from-brand-950/40 dark:via-brand-900/50 dark:to-brand-950/30">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-brand-100 dark:bg-brand-800 text-brand-700 dark:text-brand-300 text-[11px] font-semibold tracking-wider uppercase mb-2">
              <Sparkles size={11} className="text-amber-500" />
              Specialized Engine Appointees
            </div>
            <h3 className="text-lg font-bold text-brand-950 dark:text-white tracking-tight">
              Appointed AI Superpowers: Claude × OpenAI × Gemini
            </h3>
            <p className="text-[13px] text-brand-600 dark:text-brand-400 mt-1 max-w-3xl">
              Each AI engine excels at distinct cognitive tasks. We assign your business to where each model is demonstrably strongest: Claude for deep demographic & market research, OpenAI for commercial intent & competitor conquesting, and Gemini for Google AI Overviews & Knowledge Graph dominance.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {specializedQuery.isFetching && (
              <div className="flex items-center gap-1.5 text-xs text-brand-500 animate-pulse">
                <Loader2 size={13} className="animate-spin" />
                <span>Computing intelligence...</span>
              </div>
            )}
          </div>
        </div>

        {/* Engine Tabs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-6">
          {/* Claude Tab */}
          <button
            type="button"
            onClick={() => setSelectedEngine("claude")}
            className={cn(
              "p-3.5 rounded-xl border text-left transition-all relative overflow-hidden flex flex-col justify-between",
              selectedEngine === "claude"
                ? "bg-amber-500/5 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800 shadow-sm ring-1 ring-amber-400/30"
                : "bg-white dark:bg-brand-950/30 border-brand-200 dark:border-brand-800 hover:border-amber-300/60 dark:hover:border-amber-800/60",
            )}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 dark:bg-amber-900/40 flex items-center justify-center text-amber-600 dark:text-amber-400">
                  <Sparkles size={16} />
                </div>
                <div>
                  <div className="text-[13px] font-bold text-brand-950 dark:text-white">
                    Anthropic Claude
                  </div>
                  <div className="text-[10.5px] text-amber-600 dark:text-amber-400 font-medium">
                    Appointed: Deep Market Research
                  </div>
                </div>
              </div>
              {selectedEngine === "claude" && (
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              )}
            </div>
            <p className="text-[11.5px] text-brand-600 dark:text-brand-400 line-clamp-2">
              Sector-by-sector demographics, average salary data, and local product matching using public government records.
            </p>
          </button>

          {/* OpenAI Tab */}
          <button
            type="button"
            onClick={() => setSelectedEngine("openai")}
            className={cn(
              "p-3.5 rounded-xl border text-left transition-all relative overflow-hidden flex flex-col justify-between",
              selectedEngine === "openai"
                ? "bg-emerald-500/5 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 shadow-sm ring-1 ring-emerald-400/30"
                : "bg-white dark:bg-brand-950/30 border-brand-200 dark:border-brand-800 hover:border-emerald-300/60 dark:hover:border-emerald-800/60",
            )}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 dark:bg-emerald-900/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                  <Zap size={16} />
                </div>
                <div>
                  <div className="text-[13px] font-bold text-brand-950 dark:text-white">
                    OpenAI ChatGPT
                  </div>
                  <div className="text-[10.5px] text-emerald-600 dark:text-emerald-400 font-medium">
                    Appointed: Commercial Intent & Conquesting
                  </div>
                </div>
              </div>
              {selectedEngine === "openai" && (
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              )}
            </div>
            <p className="text-[11.5px] text-brand-600 dark:text-brand-400 line-clamp-2">
              High-intent buyer query prompts, competitor comparison displacement, and conversion funnel hooks.
            </p>
          </button>

          {/* Gemini Tab */}
          <button
            type="button"
            onClick={() => setSelectedEngine("gemini")}
            className={cn(
              "p-3.5 rounded-xl border text-left transition-all relative overflow-hidden flex flex-col justify-between",
              selectedEngine === "gemini"
                ? "bg-blue-500/5 dark:bg-blue-950/30 border-blue-300 dark:border-blue-800 shadow-sm ring-1 ring-blue-400/30"
                : "bg-white dark:bg-brand-950/30 border-brand-200 dark:border-brand-800 hover:border-blue-300/60 dark:hover:border-blue-800/60",
            )}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 dark:bg-blue-900/40 flex items-center justify-center text-blue-600 dark:text-blue-400">
                  <Globe size={16} />
                </div>
                <div>
                  <div className="text-[13px] font-bold text-brand-950 dark:text-white">
                    Google Gemini
                  </div>
                  <div className="text-[10.5px] text-blue-600 dark:text-blue-400 font-medium">
                    Appointed: Google AI Overviews & Local KG
                  </div>
                </div>
              </div>
              {selectedEngine === "gemini" && (
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              )}
            </div>
            <p className="text-[11.5px] text-brand-600 dark:text-brand-400 line-clamp-2">
              Google AI Overviews (AIO) trigger queries, Knowledge Graph entity grounding, and Local 3-Pack authority.
            </p>
          </button>
        </div>
      </div>

      {/* Main Body */}
      <div className="p-6">
        {specializedQuery.isLoading ? (
          <div className="py-16 text-center">
            <Loader2 size={32} className="animate-spin mx-auto text-brand-400 mb-3" />
            <p className="text-sm font-medium text-brand-700 dark:text-brand-300">
              Querying {selectedEngine === "claude" ? "Anthropic Claude" : selectedEngine === "openai" ? "OpenAI ChatGPT" : "Google Gemini"} specialized modules...
            </p>
            <p className="text-xs text-brand-400 mt-1">
              Analyzing domain parameters, regional public records, and competitive graph.
            </p>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            {selectedEngine === "claude" && (
              <ClaudeWing
                key="claude-wing"
                data={data as ClaudeMarketIntelligence | undefined}
                locationInput={locationInput}
                setLocationInput={setLocationInput}
                onLocationSubmit={handleLocationSubmit}
                onQuickLocation={handleQuickLocation}
                appliedLocation={appliedLocation}
              />
            )}

            {selectedEngine === "openai" && (
              <OpenAiWing
                key="openai-wing"
                data={data as OpenAiCommercialIntelligence | undefined}
              />
            )}

            {selectedEngine === "gemini" && (
              <GeminiWing
                key="gemini-wing"
                data={data as GeminiEcosystemIntelligence | undefined}
              />
            )}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. CLAUDE WING: Deep Market Research, Demographic Intelligence & Sector Plan
// ─────────────────────────────────────────────────────────────────────────────

function ClaudeWing({
  data,
  locationInput,
  setLocationInput,
  onLocationSubmit,
  onQuickLocation,
  appliedLocation,
}: {
  data?: ClaudeMarketIntelligence;
  locationInput: string;
  setLocationInput: (val: string) => void;
  onLocationSubmit: (e: React.FormEvent) => void;
  onQuickLocation: (loc: string) => void;
  appliedLocation: string;
}) {
  const sectors = data?.sectorBreakdown || [];
  const catalysts = data?.macroCatalysts || [];
  const takeaways = data?.strategicTakeaways || [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      className="space-y-6"
    >
      {/* Location Controller Bar */}
      <div className="p-4 rounded-xl border border-amber-200/80 dark:border-amber-900/50 bg-amber-500/5 dark:bg-amber-950/20">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <MapPin size={16} className="text-amber-600 dark:text-amber-400" />
              <h4 className="text-sm font-bold text-brand-950 dark:text-white">
                Claude Demographic & Sector Research Engine
              </h4>
            </div>
            <p className="text-xs text-brand-600 dark:text-brand-400">
              Claude synthesizes online public datasets (CIDCO, Census, Master Plans) into sector-wise customer profiles, average salaries, and ideal product offerings.
            </p>
          </div>

          <form onSubmit={onLocationSubmit} className="flex items-center gap-2">
            <div className="relative flex-1 sm:w-64">
              <input
                type="text"
                value={locationInput}
                onChange={(e) => setLocationInput(e.target.value)}
                placeholder="Enter city or region (e.g., Navi Mumbai)..."
                className="w-full rounded-lg border border-brand-200 dark:border-brand-700 bg-white dark:bg-brand-900 px-3 py-1.5 text-xs text-brand-950 dark:text-white placeholder:text-brand-400 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
            <Button
              type="submit"
              size="sm"
              className="bg-amber-600 hover:bg-amber-700 text-white text-xs h-8 px-3 shrink-0"
            >
              Analyze Region
            </Button>
          </form>
        </div>

        {/* Quick location chips */}
        <div className="flex flex-wrap items-center gap-1.5 mt-3 pt-3 border-t border-amber-200/50 dark:border-amber-900/40">
          <span className="text-[11px] text-brand-500 dark:text-brand-400 mr-1">
            Quick Hubs:
          </span>
          {POPULAR_LOCATIONS.map((loc) => (
            <button
              key={loc}
              type="button"
              onClick={() => onQuickLocation(loc)}
              className={cn(
                "px-2.5 py-0.5 rounded-full text-[11px] transition-colors border",
                appliedLocation === loc
                  ? "bg-amber-500 text-white border-amber-600 font-medium"
                  : "bg-white dark:bg-brand-900 text-brand-700 dark:text-brand-300 border-brand-200 dark:border-brand-700 hover:border-amber-400",
              )}
            >
              {loc}
            </button>
          ))}
        </div>
      </div>

      {/* Target Region Overview Banner */}
      {data && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2 p-4 rounded-xl border border-brand-200 dark:border-brand-800 bg-white dark:bg-brand-950/40 space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider">
              <Building2 size={13} />
              <span>Target Territory: {data.targetRegion}</span>
            </div>
            <p className="text-[12.5px] text-brand-800 dark:text-brand-200 leading-relaxed">
              {data.demographicInsight}
            </p>
          </div>

          <div className="p-4 rounded-xl border border-brand-200 dark:border-brand-800 bg-white dark:bg-brand-950/40 flex flex-col justify-between">
            <div>
              <div className="text-[11px] font-semibold text-brand-500 uppercase tracking-wider mb-1">
                Monitored Sectors
              </div>
              <div className="text-2xl font-black text-brand-950 dark:text-white">
                {sectors.length}
              </div>
            </div>
            <div className="pt-2 border-t border-brand-100 dark:border-brand-800 text-[11.5px] text-brand-600 dark:text-brand-400">
              Government master plan integration & geo-targeted demand matching active.
            </div>
          </div>
        </div>
      )}

      {/* The Core Table: Sector-Wise Demographic & Product Selling Matrix */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users size={16} className="text-amber-600 dark:text-amber-400" />
            <h4 className="text-sm font-bold text-brand-950 dark:text-white">
              Sector-Wise Demographics, Average Salary & Product Matching Matrix
            </h4>
          </div>
          <span className="text-[11.5px] text-brand-500 dark:text-brand-400">
            Source: CIDCO / Municipal Master Plans & Claude Demographic Engine
          </span>
        </div>

        <div className="rounded-xl border border-brand-200 dark:border-brand-800 overflow-x-auto bg-white dark:bg-brand-950/30">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-brand-200 dark:border-brand-800 bg-brand-50/60 dark:bg-brand-900/60 text-brand-700 dark:text-brand-300 font-semibold">
                <th className="py-3 px-4">Sector / Area</th>
                <th className="py-3 px-4">Demographic Profile</th>
                <th className="py-3 px-4">Avg Household Salary</th>
                <th className="py-3 px-4">Affluence Tier</th>
                <th className="py-3 px-4">Recommended Product to Sell</th>
                <th className="py-3 px-4">Primary Conversion Channel</th>
                <th className="py-3 px-4 text-center">Demand Index</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-100 dark:divide-brand-800/60">
              {sectors.map((row, idx) => (
                <tr
                  key={idx}
                  className="hover:bg-amber-500/5 dark:hover:bg-amber-950/20 transition-colors"
                >
                  <td className="py-3 px-4 font-semibold text-brand-950 dark:text-white whitespace-nowrap">
                    <div>{row.sector}</div>
                    <div className="text-[11px] font-normal text-brand-500">{row.subArea}</div>
                  </td>
                  <td className="py-3 px-4 text-brand-800 dark:text-brand-200 max-w-xs">
                    {row.populationProfile}
                  </td>
                  <td className="py-3 px-4 font-medium text-brand-900 dark:text-brand-100 whitespace-nowrap">
                    <span className="px-2 py-0.5 rounded-md bg-brand-100 dark:bg-brand-800 text-[11px] font-mono font-semibold text-brand-800 dark:text-brand-200">
                      {row.avgHouseholdIncome}
                    </span>
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    <span
                      className={cn(
                        "px-2 py-0.5 rounded-full text-[10.5px] font-semibold",
                        row.affluenceLevel === "High"
                          ? "bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800"
                          : row.affluenceLevel === "Upper-Middle"
                          ? "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
                          : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800",
                      )}
                    >
                      {row.affluenceLevel}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-medium text-amber-900 dark:text-amber-300">
                    {row.recommendedProductTier}
                  </td>
                  <td className="py-3 px-4 text-brand-600 dark:text-brand-400">
                    {row.conversionChannel}
                  </td>
                  <td className="py-3 px-4 text-center whitespace-nowrap">
                    <div className="inline-flex items-center gap-1 font-mono font-bold text-amber-600 dark:text-amber-400">
                      <span>{row.demandIndex}</span>
                      <span className="text-[10px] text-brand-400 font-normal">/100</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Public Government Catalysts & Infrastructure Data */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Building2 size={16} className="text-amber-600 dark:text-amber-400" />
          <h4 className="text-sm font-bold text-brand-950 dark:text-white">
            Online Public Catalysts & Government Master Plan Datasets
          </h4>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          {catalysts.map((cat, idx) => (
            <div
              key={idx}
              className="p-4 rounded-xl border border-brand-200 dark:border-brand-800 bg-white dark:bg-brand-950/30 space-y-2.5 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="text-[10px] uppercase font-bold text-amber-600 dark:text-amber-400 tracking-wider">
                    Infrastructure Data
                  </span>
                  <span className="text-[10px] text-brand-400 font-mono">
                    {cat.source}
                  </span>
                </div>
                <h5 className="text-[13px] font-bold text-brand-950 dark:text-white">
                  {cat.title}
                </h5>
                <p className="text-[12px] text-brand-600 dark:text-brand-400 mt-1">
                  {cat.description}
                </p>
              </div>

              <div className="pt-2.5 border-t border-brand-100 dark:border-brand-800/80">
                <div className="text-[10.5px] font-semibold text-brand-500 uppercase tracking-wider mb-1">
                  Commercial Impact
                </div>
                <p className="text-[11.5px] font-medium text-brand-900 dark:text-brand-200">
                  {cat.impactOnBusiness}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Strategic Takeaways from Claude */}
      {takeaways.length > 0 && (
        <div className="p-5 rounded-xl border border-brand-200 dark:border-brand-800 bg-brand-50/40 dark:bg-brand-950/20 space-y-3">
          <div className="flex items-center gap-2">
            <TrendingUp size={15} className="text-amber-600 dark:text-amber-400" />
            <h4 className="text-xs font-bold text-brand-950 dark:text-white uppercase tracking-wider">
              Claude Strategic Execution Directives
            </h4>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {takeaways.map((item, idx) => (
              <div
                key={idx}
                className="flex items-start gap-2 text-xs text-brand-800 dark:text-brand-200"
              >
                <CheckCircle2 size={14} className="text-amber-500 shrink-0 mt-0.5" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. OPENAI WING: Commercial Intent Mining, Competitor Displacement & Funnel
// ─────────────────────────────────────────────────────────────────────────────

function OpenAiWing({ data }: { data?: OpenAiCommercialIntelligence }) {
  const queries = data?.highIntentQueries || [];
  const conquests = data?.competitorConquesting || [];
  const hooks = data?.conversionHooks || [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      className="space-y-6"
    >
      {/* Banner */}
      <div className="p-4 rounded-xl border border-emerald-200/80 dark:border-emerald-900/50 bg-emerald-500/5 dark:bg-emerald-950/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Zap size={16} className="text-emerald-600 dark:text-emerald-400" />
            <h4 className="text-sm font-bold text-brand-950 dark:text-white">
              OpenAI Commercial Intent Mining & Competitor Displacement
            </h4>
          </div>
          <p className="text-xs text-brand-600 dark:text-brand-400">
            OpenAI&apos;s RLHF alignment makes it the primary decision assistant for B2B buyers. We map the exact comparison prompts buyers use and give you the quotable counter-arguments to conquer rival citations.
          </p>
        </div>
        <div className="shrink-0 flex items-center gap-2">
          <span className="px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 text-xs font-semibold">
            {queries.length} High-Intent Queries Mined
          </span>
        </div>
      </div>

      {/* High-Intent Queries Table */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Crosshair size={16} className="text-emerald-600 dark:text-emerald-400" />
            <h4 className="text-sm font-bold text-brand-950 dark:text-white">
              High-Purchase Intent Prompts in ChatGPT
            </h4>
          </div>
          <span className="text-[11.5px] text-brand-500 dark:text-brand-400">
            Queries where buyers ask ChatGPT for immediate software/service recommendations
          </span>
        </div>

        <div className="rounded-xl border border-brand-200 dark:border-brand-800 overflow-x-auto bg-white dark:bg-brand-950/30">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-brand-200 dark:border-brand-800 bg-brand-50/60 dark:bg-brand-900/60 text-brand-700 dark:text-brand-300 font-semibold">
                <th className="py-3 px-4">Buyer Prompt Query</th>
                <th className="py-3 px-4">Intent Classification</th>
                <th className="py-3 px-4">Search Volume</th>
                <th className="py-3 px-4">Citation Difficulty</th>
                <th className="py-3 px-4">Winning Snippet Angle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-100 dark:divide-brand-800/60">
              {queries.map((q, idx) => (
                <tr
                  key={idx}
                  className="hover:bg-emerald-500/5 dark:hover:bg-emerald-950/20 transition-colors"
                >
                  <td className="py-3 px-4 font-mono font-medium text-brand-950 dark:text-white max-w-sm">
                    &quot;{q.prompt}&quot;
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    <span className="px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 text-[11px] font-medium">
                      {q.intentType}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-brand-700 dark:text-brand-300 font-mono whitespace-nowrap">
                    {q.searchVolumeEstimate}
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    <span
                      className={cn(
                        "px-2 py-0.5 rounded-full text-[10.5px] font-semibold",
                        q.citationDifficulty === "Low"
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                          : q.citationDifficulty === "Medium"
                          ? "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                          : "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300",
                      )}
                    >
                      {q.citationDifficulty}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-brand-800 dark:text-brand-200">
                    {q.winningSnippetAngle}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Competitor Conquesting Cards */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Crosshair size={16} className="text-emerald-600 dark:text-emerald-400" />
          <h4 className="text-sm font-bold text-brand-950 dark:text-white">
            Competitor Displacement Battlecards for ChatGPT
          </h4>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {conquests.map((c, idx) => (
            <div
              key={idx}
              className="p-4 rounded-xl border border-brand-200 dark:border-brand-800 bg-white dark:bg-brand-950/30 space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-brand-950 dark:text-white">
                  Target Rival: <span className="text-emerald-600 dark:text-emerald-400">{c.competitor}</span>
                </span>
                <span className="px-2 py-0.5 rounded text-[10.5px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
                  Displacement Script
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-brand-50 dark:bg-brand-900/50 text-xs font-mono text-brand-800 dark:text-brand-200">
                <span className="text-brand-400 select-none">Prompt: </span>&quot;{c.displacementPrompt}&quot;
              </div>

              <div className="space-y-1">
                <div className="text-[11px] font-semibold text-brand-500 uppercase tracking-wider">
                  Counter-Positioning Argument
                </div>
                <p className="text-xs text-brand-700 dark:text-brand-300">
                  {c.counterArgument}
                </p>
              </div>

              <div className="pt-2 border-t border-brand-100 dark:border-brand-800 text-[11.5px] text-brand-600 dark:text-brand-400 flex items-center gap-1.5">
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">Winning Hook:</span>
                <span>{c.targetFeatureHook}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Conversion Hooks */}
      {hooks.length > 0 && (
        <div className="p-5 rounded-xl border border-brand-200 dark:border-brand-800 bg-emerald-500/5 dark:bg-emerald-950/20 space-y-3">
          <h4 className="text-xs font-bold text-brand-950 dark:text-white uppercase tracking-wider flex items-center gap-2">
            <Zap size={14} className="text-emerald-600 dark:text-emerald-400" />
            Conversion Funnel Acceleration Hooks
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {hooks.map((hook, idx) => (
              <div
                key={idx}
                className="flex items-start gap-2 text-xs text-brand-800 dark:text-brand-200"
              >
                <CheckCircle2 size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                <span>{hook}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. GEMINI WING: Google AI Overviews (AIO), Knowledge Graph & Local Ecosystem
// ─────────────────────────────────────────────────────────────────────────────

function GeminiWing({ data }: { data?: GeminiEcosystemIntelligence }) {
  const triggers = data?.aiOverviewsTriggers || [];
  const kg = data?.knowledgeGraphEntity;
  const localPack = data?.localPackDominance || [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      className="space-y-6"
    >
      {/* Banner */}
      <div className="p-4 rounded-xl border border-blue-200/80 dark:border-blue-900/50 bg-blue-500/5 dark:bg-blue-950/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Globe size={16} className="text-blue-600 dark:text-blue-400" />
            <h4 className="text-sm font-bold text-brand-950 dark:text-white">
              Google Gemini: AI Overviews (AIO) & Knowledge Graph Authority
            </h4>
          </div>
          <p className="text-xs text-brand-600 dark:text-brand-400">
            Gemini directly powers Google Search&apos;s AI Overviews. Winning citations here requires strict JSON-LD schema grounding, entity consistency across the web, and authoritative structured snippets.
          </p>
        </div>
        <div className="shrink-0 flex items-center gap-2">
          <span className="px-2.5 py-1 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 text-xs font-semibold">
            Google Ecosystem Engine
          </span>
        </div>
      </div>

      {/* Knowledge Graph Entity Score Card */}
      {kg && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl border border-brand-200 dark:border-brand-800 bg-white dark:bg-brand-950/30 flex flex-col justify-between">
            <div>
              <div className="text-[11px] font-semibold text-brand-500 uppercase tracking-wider mb-1">
                Entity Grounding Confidence
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-black text-blue-600 dark:text-blue-400">
                  {kg.entityConfidenceScore}
                </span>
                <span className="text-xs text-brand-400 font-medium">/100</span>
              </div>
            </div>
            <div className="w-full bg-brand-100 dark:bg-brand-800 h-1.5 rounded-full overflow-hidden mt-3">
              <div
                className="bg-blue-500 h-full rounded-full transition-all"
                style={{ width: `${kg.entityConfidenceScore}%` }}
              />
            </div>
          </div>

          <div className="p-4 rounded-xl border border-brand-200 dark:border-brand-800 bg-white dark:bg-brand-950/30 flex flex-col justify-between">
            <div>
              <div className="text-[11px] font-semibold text-brand-500 uppercase tracking-wider mb-1">
                Schema Completeness
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-black text-brand-950 dark:text-white">
                  {kg.schemaCompletenessPct}%
                </span>
              </div>
            </div>
            <div className="w-full bg-brand-100 dark:bg-brand-800 h-1.5 rounded-full overflow-hidden mt-3">
              <div
                className="bg-brand-900 dark:bg-brand-100 h-full rounded-full transition-all"
                style={{ width: `${kg.schemaCompletenessPct}%` }}
              />
            </div>
          </div>

          <div className="p-4 rounded-xl border border-brand-200 dark:border-brand-800 bg-white dark:bg-brand-950/30 space-y-1.5">
            <div className="text-[11px] font-semibold text-brand-500 uppercase tracking-wider">
              Missing Knowledge Graph Attributes
            </div>
            <div className="flex flex-wrap gap-1">
              {kg.missingAttributes.map((attr, idx) => (
                <span
                  key={idx}
                  className="px-2 py-0.5 rounded text-[10.5px] bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300 font-mono"
                >
                  +{attr}
                </span>
              ))}
            </div>
            <div className="text-[11px] text-brand-500 pt-1">
              Add these properties to JSON-LD to unlock authoritative AIO inclusion.
            </div>
          </div>
        </div>
      )}

      {/* AI Overviews Trigger Table */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers size={16} className="text-blue-600 dark:text-blue-400" />
            <h4 className="text-sm font-bold text-brand-950 dark:text-white">
              Google AI Overviews (AIO) Trigger Opportunities
            </h4>
          </div>
          <span className="text-[11.5px] text-brand-500 dark:text-brand-400">
            Queries triggering AI summaries where your domain can be cited as the primary card
          </span>
        </div>

        <div className="rounded-xl border border-brand-200 dark:border-brand-800 overflow-x-auto bg-white dark:bg-brand-950/30">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-brand-200 dark:border-brand-800 bg-brand-50/60 dark:bg-brand-900/60 text-brand-700 dark:text-brand-300 font-semibold">
                <th className="py-3 px-4">Search Query</th>
                <th className="py-3 px-4">AIO Trigger Probability</th>
                <th className="py-3 px-4">Required Schema Type</th>
                <th className="py-3 px-4">Snippet Extraction Strategy</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-100 dark:divide-brand-800/60">
              {triggers.map((t, idx) => (
                <tr
                  key={idx}
                  className="hover:bg-blue-500/5 dark:hover:bg-blue-950/20 transition-colors"
                >
                  <td className="py-3 px-4 font-mono font-medium text-brand-950 dark:text-white max-w-sm">
                    &quot;{t.query}&quot;
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <div className="w-16 bg-brand-100 dark:bg-brand-800 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-blue-600 h-full rounded-full"
                          style={{ width: `${t.aioProbability}%` }}
                        />
                      </div>
                      <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                        {t.aioProbability}%
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    <span className="px-2 py-0.5 rounded bg-brand-100 dark:bg-brand-800 font-mono text-[11px] text-brand-800 dark:text-brand-200">
                      {t.requiredSchema}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-brand-800 dark:text-brand-200">
                    {t.snippetExtractionStrategy}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Local 3-Pack & Map Dominance */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <MapPin size={16} className="text-blue-600 dark:text-blue-400" />
          <h4 className="text-sm font-bold text-brand-950 dark:text-white">
            Google Local 3-Pack & Maps Ecosystem Pillars
          </h4>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          {localPack.map((p, idx) => (
            <div
              key={idx}
              className="p-4 rounded-xl border border-brand-200 dark:border-brand-800 bg-white dark:bg-brand-950/30 space-y-2 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <h5 className="text-[13px] font-bold text-brand-950 dark:text-white">
                    {p.pillar}
                  </h5>
                  <span
                    className={cn(
                      "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider",
                      p.status === "OPTIMIZED"
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                        : p.status === "ACTION_REQUIRED"
                        ? "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                        : "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300",
                    )}
                  >
                    {p.status.replace("_", " ")}
                  </span>
                </div>
                <p className="text-[12px] text-brand-600 dark:text-brand-400">
                  {p.recommendation}
                </p>
              </div>

              <div className="pt-2 border-t border-brand-100 dark:border-brand-800 text-[11px] text-blue-600 dark:text-blue-400 flex items-center gap-1 font-medium">
                <span>Direct Google Maps Citation Factor</span>
                <ChevronRight size={12} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
