"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  Swords,
  Sparkles,
  ShieldAlert,
  Zap,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowRight,
  Search,
  ExternalLink,
  Code2,
  FileText,
  Copy,
  Check,
  TrendingUp,
  Layers,
  ChevronDown,
  RefreshCw,
  Loader2,
  Target,
  FileCode,
  Gauge,
  X,
} from "lucide-react";
import {
  useCompetitorIntercepts,
  useGenerateCounterAttackBlueprint,
} from "@/hooks/use-growthx";
import { stagingEngine } from "@/lib/staging-engine";
import type {
  InterceptOpportunity,
  InterceptBlueprint,
  TrackedCompetitor,
} from "@/lib/api-client";

interface CompetitorInterceptEngineProps {
  projectId: string;
  customerDomain: string;
  competitors: TrackedCompetitor[];
  onAddToFixPlan?: (count: number, label?: string) => void;
}

export function CompetitorInterceptEngine({
  projectId,
  customerDomain,
  competitors = [],
  onAddToFixPlan,
}: CompetitorInterceptEngineProps) {
  const [selectedCompetitorId, setSelectedCompetitorId] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [tierFilter, setTierFilter] = useState<"ALL" | "PRIME_TARGET" | "MODERATE">("ALL");
  const [defectFilter, setDefectFilter] = useState<string>("ALL");
  const [sortBy, setSortBy] = useState<"score-desc" | "vol-desc" | "rank-asc">("score-desc");

  // Active Blueprint Drawer/Modal
  const [activeBlueprintOpp, setActiveBlueprintOpp] = useState<InterceptOpportunity | null>(null);
  const [copiedSchema, setCopiedSchema] = useState(false);
  const [stagedIds, setStagedIds] = useState<Set<string>>(new Set());

  // Query intercept data
  const interceptsQuery = useCompetitorIntercepts(
    projectId,
    selectedCompetitorId !== "all" ? selectedCompetitorId : undefined,
  );

  const generateBlueprintMutation = useGenerateCounterAttackBlueprint(projectId);

  const data = interceptsQuery.data;
  const scoreboard = data?.scoreboard;
  const allOpportunities = useMemo(() => data?.opportunities || [], [data]);

  // Filter and sort opportunities
  const filteredOpportunities = useMemo(() => {
    return allOpportunities
      .filter((opp) => {
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchKw = opp.keyword.toLowerCase().includes(q);
          const matchDomain = opp.competitorDomain.toLowerCase().includes(q);
          if (!matchKw && !matchDomain) return false;
        }
        if (tierFilter !== "ALL" && opp.vulnerabilityTier !== tierFilter) {
          return false;
        }
        if (defectFilter !== "ALL") {
          const hasDefect = opp.defects.some((d) => d.type === defectFilter);
          if (!hasDefect) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === "score-desc") return b.vulnerabilityScore - a.vulnerabilityScore;
        if (sortBy === "vol-desc") return b.searchVolume - a.searchVolume;
        if (sortBy === "rank-asc") return a.competitorRank - b.competitorRank;
        return 0;
      });
  }, [allOpportunities, searchQuery, tierFilter, defectFilter, sortBy]);

  // Stage blueprint into Fix Engine
  const handleStageBlueprint = (opp: InterceptOpportunity) => {
    const bp = opp.blueprint;
    stagingEngine.stage(projectId, {
      title: `Competitor Intercept: Poach "${opp.keyword}" from ${opp.competitorDomain}`,
      category: "CONTENT",
      source: "COMPETITOR_INTERCEPT",
      priority: opp.vulnerabilityTier === "PRIME_TARGET" ? "CRITICAL" : "HIGH",
      impact: `Displaces competitor #${opp.competitorRank} ranking (${opp.searchVolume.toLocaleString()} search volume/mo) via structured entity blueprint and sub-second Core Web Vitals.`,
      effortHours: 3.5,
      deliverable: bp.deliverableCode,
      evidence: opp.blueprint.attackThesis,
      affectedUrl: `https://${customerDomain}${bp.targetSlug}`,
    });

    setStagedIds((prev) => new Set([...prev, opp.id]));
    if (onAddToFixPlan) {
      onAddToFixPlan(1, `Intercept Blueprint: ${opp.keyword}`);
    }
  };

  const handleCopySchema = (schemaJson: string) => {
    navigator.clipboard.writeText(schemaJson);
    setCopiedSchema(true);
    setTimeout(() => setCopiedSchema(false), 2200);
  };

  return (
    <div className="space-y-6">
      {/* ── HEADER BANNER ── */}
      <div className="relative overflow-hidden rounded-2xl border border-purple-200/80 bg-gradient-to-br from-purple-900 via-indigo-900 to-slate-950 p-6 text-white shadow-md">
        <div className="absolute right-0 top-0 -mt-10 -mr-10 h-72 w-72 rounded-full bg-purple-500/20 blur-3xl" />
        <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-purple-400/30 bg-purple-500/20 px-3 py-1 text-[11px] font-bold tracking-wide text-purple-200 backdrop-blur-md">
              <Swords size={12} className="text-purple-300" />
              <span>AUTONOMOUS COMPETITOR POACHING ENGINE</span>
            </div>
            <h2 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
              Intercept Vulnerable Competitor #1–3 Rankings
            </h2>
            <p className="text-[13px] leading-relaxed text-purple-200/90">
              Evaluates competitor top-ranking URLs against structural vulnerabilities: missing JSON-LD schema, sluggish TTFB latency, and thin content depth. Automatically synthesizes verified counter-attack blueprints ready to stage directly into the Fix Engine.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Competitor Selector */}
            <div className="relative">
              <select
                value={selectedCompetitorId}
                onChange={(e) => setSelectedCompetitorId(e.target.value)}
                className="appearance-none rounded-xl border border-white/20 bg-white/10 px-3.5 py-2 pr-8 text-xs font-semibold text-white backdrop-blur-md hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-purple-400"
              >
                <option value="all" className="bg-slate-900 text-white">All Tracked Competitors</option>
                {competitors.map((c) => (
                  <option key={c.id} value={c.id} className="bg-slate-900 text-white">
                    {c.name || c.domain}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-white/60" />
            </div>

            <button
              type="button"
              onClick={() => interceptsQuery.refetch()}
              disabled={interceptsQuery.isFetching}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-3.5 py-2 text-xs font-semibold text-white backdrop-blur-md hover:bg-white/20 transition active:scale-95 disabled:opacity-50"
            >
              <RefreshCw size={13} className={interceptsQuery.isFetching ? "animate-spin" : ""} />
              <span>Refresh Intercepts</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── SCOREBOARD METRICS ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Metric 1 */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11.5px] font-bold text-slate-500 uppercase tracking-wider">Poachable Rankings</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
              <Target size={16} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">
              {scoreboard ? scoreboard.totalPoachable : 0}
            </span>
            <span className="text-[11px] font-semibold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-md">
              Top #1–3 Rankings
            </span>
          </div>
          <p className="mt-1.5 text-[11px] text-slate-500">
            Competitor keywords afflicted with detectable technical or schema defects.
          </p>
        </div>

        {/* Metric 2 */}
        <div className="rounded-2xl border border-rose-200/80 bg-gradient-to-br from-rose-50/50 to-white p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11.5px] font-bold text-rose-700 uppercase tracking-wider">Prime Displacement Targets</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-100 text-rose-600">
              <AlertTriangle size={16} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-rose-950">
              {scoreboard ? scoreboard.primeTargetsCount : 0}
            </span>
            <span className="text-[11px] font-bold text-rose-700 bg-rose-100/80 px-2 py-0.5 rounded-md">
              Score ≥ 65
            </span>
          </div>
          <p className="mt-1.5 text-[11px] text-rose-700/80 font-medium">
            Immediate displacement targets ranking purely on legacy authority.
          </p>
        </div>

        {/* Metric 3 */}
        <div className="rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50/40 to-white p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11.5px] font-bold text-emerald-800 uppercase tracking-wider">Est. Traffic at Stake</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
              <TrendingUp size={16} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-950">
              +{scoreboard ? (scoreboard.estimatedTrafficOpportunity).toLocaleString() : 0}
            </span>
            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-md">
              Visits / mo
            </span>
          </div>
          <p className="mt-1.5 text-[11px] text-slate-500">
            Addressable search demand currently captured by vulnerable competitor pages.
          </p>
        </div>

        {/* Metric 4 */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11.5px] font-bold text-slate-500 uppercase tracking-wider">Top Vulnerability Vector</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <Gauge size={16} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-base font-extrabold text-slate-900 truncate max-w-[170px]">
              {scoreboard?.topDefectArea || "Thin Content Depth"}
            </span>
          </div>
          <p className="mt-1.5 text-[11px] text-slate-500">
            Avg vulnerability score: <strong className="text-slate-700 font-bold">{scoreboard?.averageVulnerabilityScore || 0}/100</strong>.
          </p>
        </div>
      </div>

      {/* ── FILTER CONTROLS ── */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs sm:flex-row sm:items-center sm:justify-between">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search keywords or competitor domains..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2 pl-9 pr-3 text-xs font-medium text-slate-800 placeholder-slate-400 focus:border-purple-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Tier Filter */}
          <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 p-1 text-[11px] font-semibold text-slate-600">
            <button
              type="button"
              onClick={() => setTierFilter("ALL")}
              className={`rounded-lg px-2.5 py-1 transition ${tierFilter === "ALL" ? "bg-white text-purple-700 font-bold shadow-2xs" : "hover:text-slate-900"}`}
            >
              All Targets
            </button>
            <button
              type="button"
              onClick={() => setTierFilter("PRIME_TARGET")}
              className={`rounded-lg px-2.5 py-1 transition ${tierFilter === "PRIME_TARGET" ? "bg-rose-500 text-white font-bold shadow-2xs" : "hover:text-slate-900"}`}
            >
              Prime Targets
            </button>
            <button
              type="button"
              onClick={() => setTierFilter("MODERATE")}
              className={`rounded-lg px-2.5 py-1 transition ${tierFilter === "MODERATE" ? "bg-white text-purple-700 font-bold shadow-2xs" : "hover:text-slate-900"}`}
            >
              Moderate
            </button>
          </div>

          {/* Defect Filter */}
          <select
            value={defectFilter}
            onChange={(e) => setDefectFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs focus:border-purple-500 focus:outline-none"
          >
            <option value="ALL">All Defects</option>
            <option value="NO_SCHEMA">Missing JSON-LD Schema</option>
            <option value="SLOW_CWV">Slow TTFB Latency</option>
            <option value="THIN_CONTENT">Thin Content Depth</option>
            <option value="WEAK_TITLE">Weak Title / Meta</option>
            <option value="NO_DIRECT_ANSWER">Lacks Direct Answer</option>
          </select>

          {/* Sort By */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs focus:border-purple-500 focus:outline-none"
          >
            <option value="score-desc">Highest Vulnerability</option>
            <option value="vol-desc">Search Volume</option>
            <option value="rank-asc">Competitor Rank (#1 first)</option>
          </select>
        </div>
      </div>

      {/* ── OPPORTUNITIES TABLE ── */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xs">
        {interceptsQuery.isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <Loader2 size={32} className="animate-spin text-purple-600 mb-3" />
            <p className="text-xs font-semibold">Auditing competitor rankings and diagnostic vulnerabilities...</p>
          </div>
        ) : filteredOpportunities.length === 0 ? (
          <div className="py-16 text-center text-slate-500">
            <Swords size={32} className="mx-auto mb-2 text-slate-300" />
            <h4 className="text-sm font-bold text-slate-700">No matching vulnerable competitor rankings</h4>
            <p className="mt-1 text-xs text-slate-400">Try adjusting your search query or defect filter criteria.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-3">Target Keyword &amp; Intent</th>
                  <th className="px-4 py-3">Competitor &amp; Rank</th>
                  <th className="px-4 py-3 text-center">Vulnerability Score</th>
                  <th className="px-4 py-3">Detected Defects</th>
                  <th className="px-4 py-3 text-right">Est. Volume</th>
                  <th className="px-4 py-3 text-right">Counter-Attack Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredOpportunities.map((opp) => {
                  const isStaged = stagedIds.has(opp.id);
                  const isPrime = opp.vulnerabilityTier === "PRIME_TARGET";

                  return (
                    <tr
                      key={opp.id}
                      className="hover:bg-purple-50/30 transition-colors group cursor-pointer"
                      onClick={() => setActiveBlueprintOpp(opp)}
                    >
                      {/* Keyword & Intent */}
                      <td className="px-4 py-3.5">
                        <div className="font-bold text-slate-900 group-hover:text-purple-700 transition-colors capitalize">
                          {opp.keyword}
                        </div>
                        <div className="mt-1 flex items-center gap-1.5">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              opp.intent === "COMMERCIAL"
                                ? "bg-purple-100 text-purple-700"
                                : opp.intent === "TRANSACTIONAL"
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-blue-100 text-blue-700"
                            }`}
                          >
                            {opp.intent}
                          </span>
                          <span className="text-[10.5px] text-slate-400">
                            {opp.customerRank ? `Your rank: #${opp.customerRank}` : "Not in Top 100"}
                          </span>
                        </div>
                      </td>

                      {/* Competitor & Rank */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <span
                            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md font-black text-[10px] ${
                              opp.competitorRank === 1
                                ? "bg-amber-100 text-amber-800 border border-amber-300/60"
                                : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            #{opp.competitorRank}
                          </span>
                          <span className="font-semibold text-slate-800">{opp.competitorDomain}</span>
                        </div>
                        <div className="mt-0.5 text-[11px] text-slate-400 truncate max-w-[200px]" title={opp.competitorUrl}>
                          {opp.competitorUrl.replace(/^https?:\/\/[^/]+/, "") || "/"}
                        </div>
                      </td>

                      {/* Vulnerability Score */}
                      <td className="px-4 py-3.5 text-center">
                        <div className="inline-flex flex-col items-center">
                          <div className="flex items-center gap-1">
                            <span
                              className={`text-sm font-black ${
                                isPrime
                                  ? "text-rose-600"
                                  : opp.vulnerabilityScore >= 45
                                  ? "text-amber-600"
                                  : "text-slate-600"
                              }`}
                            >
                              {opp.vulnerabilityScore}
                            </span>
                            <span className="text-[10px] text-slate-400 font-bold">/100</span>
                          </div>
                          <div className="w-14 h-1.5 bg-slate-100 rounded-full mt-1 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                isPrime
                                  ? "bg-rose-500"
                                  : opp.vulnerabilityScore >= 45
                                  ? "bg-amber-500"
                                  : "bg-slate-400"
                              }`}
                              style={{ width: `${opp.vulnerabilityScore}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Detected Defects */}
                      <td className="px-4 py-3.5">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {opp.defects.map((d, i) => (
                            <span
                              key={i}
                              className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-semibold ${
                                d.severity === "CRITICAL"
                                  ? "bg-rose-100 text-rose-700"
                                  : d.severity === "HIGH"
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-slate-100 text-slate-700"
                              }`}
                            >
                              {d.label}
                            </span>
                          ))}
                        </div>
                      </td>

                      {/* Search Volume */}
                      <td className="px-4 py-3.5 text-right font-bold text-slate-800">
                        {opp.searchVolume.toLocaleString()}
                        <span className="block text-[10px] font-normal text-slate-400">searches/mo</span>
                      </td>

                      {/* Action */}
                      <td className="px-4 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                        {isStaged ? (
                          <div className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1.5 rounded-xl border border-emerald-200">
                            <Check size={13} className="text-emerald-600" />
                            <span>Staged to Fix</span>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setActiveBlueprintOpp(opp)}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 px-3 py-1.5 text-xs font-bold transition shadow-2xs hover:shadow-xs active:scale-95"
                          >
                            <Sparkles size={12} className="text-purple-600" />
                            <span>View Blueprint</span>
                            <ArrowRight size={12} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── COUNTER-ATTACK BLUEPRINT MODAL / DRAWER ── */}
      {activeBlueprintOpp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div
            className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl border border-slate-200 p-6 space-y-6"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 rounded-md bg-purple-100 px-2 py-0.5 text-[11px] font-bold text-purple-700">
                  <Swords size={12} />
                  <span>COUNTER-ATTACK CONTENT BLUEPRINT</span>
                </div>
                <h3 className="text-xl font-black text-slate-900 capitalize">
                  Poach &ldquo;{activeBlueprintOpp.keyword}&rdquo;
                </h3>
                <p className="text-xs text-slate-500">
                  Target Competitor: <strong>{activeBlueprintOpp.competitorDomain}</strong> (Currently #{activeBlueprintOpp.competitorRank})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveBlueprintOpp(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* Strategic Attack Thesis */}
            <div className="rounded-xl border border-amber-200/80 bg-gradient-to-r from-amber-50/90 to-amber-50/40 p-4">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-900 mb-1.5">
                <ShieldAlert size={15} className="text-amber-600" />
                <span>Strategic Intercept Advantage</span>
              </div>
              <p className="text-xs text-amber-950/90 leading-relaxed">
                {activeBlueprintOpp.blueprint.attackThesis}
              </p>
            </div>

            {/* Proposed Target Specifications */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400">Target H1 Headline</span>
                <p className="mt-1 text-xs font-bold text-slate-800">
                  {activeBlueprintOpp.blueprint.targetH1}
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400">Recommended URL Slug</span>
                <p className="mt-1 text-xs font-mono font-semibold text-purple-700 truncate">
                  {activeBlueprintOpp.blueprint.targetSlug}
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400">Target Depth &amp; Time</span>
                <p className="mt-1 text-xs font-bold text-slate-800">
                  {activeBlueprintOpp.blueprint.targetWordCount}+ words · ~{activeBlueprintOpp.blueprint.estimatedTimeToDisplaceDays} days to rank
                </p>
              </div>
            </div>

            {/* Semantic Heading Outline */}
            <div className="space-y-2.5">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <Layers size={14} className="text-purple-600" />
                <span>Structured Semantic Heading Hierarchy (H2 / H3)</span>
              </h4>
              <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
                {activeBlueprintOpp.blueprint.semanticHeadings.map((h, idx) => (
                  <div key={idx} className="p-3 flex items-start gap-3">
                    <span className="shrink-0 font-mono text-[10px] font-bold text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200/50">
                      {h.level}
                    </span>
                    <div className="space-y-0.5">
                      <div className="text-xs font-bold text-slate-800">{h.title}</div>
                      <div className="text-[11px] text-slate-500">{h.intentSummary}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* JSON-LD Schema Patch */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Code2 size={14} className="text-purple-600" />
                  <span>Structured Schema.org FAQPage Patch (JSON-LD)</span>
                </h4>
                <button
                  type="button"
                  onClick={() => handleCopySchema(activeBlueprintOpp.blueprint.jsonLdSchema)}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  {copiedSchema ? (
                    <>
                      <Check size={12} className="text-emerald-600" />
                      <span className="text-emerald-700">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy size={12} className="text-slate-500" />
                      <span>Copy JSON-LD</span>
                    </>
                  )}
                </button>
              </div>

              <div className="relative rounded-xl border border-slate-800 bg-slate-950 p-4 font-mono text-[11px] text-emerald-400 overflow-x-auto max-h-48">
                <pre>{activeBlueprintOpp.blueprint.jsonLdSchema}</pre>
              </div>
            </div>

            {/* Key Differentiators */}
            <div className="space-y-1.5">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Definitive Ranking Safeguards
              </h4>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600">
                {activeBlueprintOpp.blueprint.keyDifferentiators.map((diff, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                    <span>{diff}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Footer Action */}
            <div className="flex items-center justify-between border-t border-slate-100 pt-4">
              <Link
                href="/fix-engine?tab=implementation"
                className="text-xs font-semibold text-purple-600 hover:text-purple-800 transition flex items-center gap-1"
              >
                <span>Go to Fix Engine Implementation Queue</span>
                <ArrowRight size={13} />
              </Link>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveBlueprintOpp(null)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
                >
                  Close
                </button>

                {stagedIds.has(activeBlueprintOpp.id) ? (
                  <button
                    type="button"
                    disabled
                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white shadow-sm"
                  >
                    <Check size={14} />
                    <span>Staged to Fix Engine</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleStageBlueprint(activeBlueprintOpp)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 px-5 py-2 text-xs font-bold text-white shadow-md hover:from-purple-700 hover:to-indigo-700 transition active:scale-95"
                  >
                    <Sparkles size={13} />
                    <span>Stage Blueprint into Fix Engine</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
