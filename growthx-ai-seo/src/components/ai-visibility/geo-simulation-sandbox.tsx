"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Sparkles,
  Bot,
  Search,
  Globe,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  Zap,
  TrendingUp,
  ShieldAlert,
  FileCode,
  Check,
  Loader2,
  RefreshCw,
  Plus,
  Flame,
  Award,
} from "lucide-react";
import { useSimulateGeo } from "@/hooks/use-growthx";
import { stagingEngine } from "@/lib/staging-engine";
import type { GeoSimulationResult, GeoEngineResult, GeoDisplacementPatch } from "@/lib/api-client";

interface GeoSimulationSandboxProps {
  projectId?: string | null;
  domain?: string;
  businessName?: string;
}

const DEFAULT_SUGGESTIONS = [
  "Best AI SEO automation tools 2026",
  "How to optimize website for LLM search engines",
  "Top enterprise alternatives to legacy SEO suites",
  "Autonomous website audit and verified code remediation",
];

const ENGINES_CONFIG = [
  { id: "PERPLEXITY" as const, name: "Perplexity", model: "Sonar Web Grounding", color: "from-cyan-500 to-teal-600", border: "border-cyan-200" },
  { id: "CHATGPT" as const, name: "ChatGPT Search", model: "GPT-4o", color: "from-emerald-500 to-green-600", border: "border-emerald-200" },
  { id: "GEMINI" as const, name: "Google Gemini", model: "Gemini 2.0 Flash", color: "from-blue-500 to-indigo-600", border: "border-blue-200" },
  { id: "CLAUDE" as const, name: "Claude", model: "Claude 3.5 Sonnet", color: "from-amber-500 to-orange-600", border: "border-amber-200" },
];

export function GeoSimulationSandbox({
  projectId,
  domain = "yourdomain.com",
  businessName = "Your Brand",
}: GeoSimulationSandboxProps) {
  const [query, setQuery] = useState("Best AI SEO automation tools 2026");
  const [selectedEngines, setSelectedEngines] = useState<Array<"PERPLEXITY" | "CHATGPT" | "GEMINI" | "CLAUDE">>([
    "PERPLEXITY",
    "CHATGPT",
    "GEMINI",
    "CLAUDE",
  ]);
  const [result, setResult] = useState<GeoSimulationResult | null>(null);
  const [stagedSuccess, setStagedSuccess] = useState(false);

  const simulateMutation = useSimulateGeo(projectId);

  const toggleEngine = (engine: "PERPLEXITY" | "CHATGPT" | "GEMINI" | "CLAUDE") => {
    if (selectedEngines.includes(engine)) {
      if (selectedEngines.length > 1) {
        setSelectedEngines(selectedEngines.filter((e) => e !== engine));
      }
    } else {
      setSelectedEngines([...selectedEngines, engine]);
    }
  };

  const handleRunSimulation = async (queryToRun = query) => {
    if (!queryToRun.trim()) return;
    setStagedSuccess(false);
    try {
      const res = await simulateMutation.mutateAsync({
        query: queryToRun.trim(),
        engines: selectedEngines,
      });
      setResult(res);
    } catch (err) {
      console.error("GEO Simulation failed:", err);
    }
  };

  const handleStageDisplacement = (patch: GeoDisplacementPatch) => {
    if (!projectId) return;
    stagingEngine.stage(projectId, {
      title: patch.targetTitle,
      category: "AI_SEARCH",
      source: "AI_VISIBILITY",
      priority: patch.priority,
      impact: `Displaces competitor citations for "${query.slice(0, 30)}"`,
      effortHours: 2,
      deliverable: "LLM Citation Paragraph & JSON-LD FAQ Schema",
      evidence: patch.reasoning,
      affectedUrl: patch.targetUrl,
    });
    setStagedSuccess(true);
    setTimeout(() => setStagedSuccess(false), 4000);
  };

  return (
    <div className="space-y-6">
      {/* ── HEADER BANNER ── */}
      <div className="rounded-2xl border border-purple-200 bg-gradient-to-r from-purple-950 via-slate-900 to-indigo-950 text-white p-6 shadow-md relative overflow-hidden">
        <div className="absolute -top-12 -right-12 w-64 h-64 rounded-full bg-purple-500/10 blur-3xl pointer-events-none" />
        <div className="relative z-10 space-y-2 max-w-3xl">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold tracking-wider uppercase bg-purple-500/20 text-purple-300 border border-purple-500/40">
              <Sparkles className="h-3 w-3 text-purple-400" />
              Generative Engine Optimization (GEO)
            </span>
            <span className="text-[11px] text-purple-300">Multi-Model Live Simulation</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight">
            Live AI Search &amp; Citation Simulation Sandbox
          </h2>
          <p className="text-xs sm:text-sm text-purple-200/80 leading-relaxed">
            Directly test how Perplexity, ChatGPT Search, Google Gemini, and Claude evaluate your brand vs. competitors for target buyer queries. When competitors are cited, generate instant LLM displacement patches.
          </p>
        </div>
      </div>

      {/* ── INTERACTIVE QUERY INPUT BAR ── */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs space-y-4">
        <div>
          <label htmlFor="geo-query-input" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
            Enter Buyer Search Query or Organic Prompt
          </label>
          <div className="flex flex-col sm:flex-row items-stretch gap-2.5">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                id="geo-query-input"
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleRunSimulation()}
                placeholder="e.g. Best AI SEO automation tools for ecommerce..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-xs font-medium text-slate-900 bg-slate-50/50 placeholder:text-slate-400 transition"
              />
            </div>

            <button
              type="button"
              onClick={() => handleRunSimulation()}
              disabled={simulateMutation.isPending || !query.trim()}
              className="px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-xs font-bold transition shadow-md shadow-purple-500/20 flex items-center justify-center gap-2 shrink-0 cursor-pointer"
            >
              {simulateMutation.isPending ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  <span>Probing 4 AI Models...</span>
                </>
              ) : (
                <>
                  <Zap size={13} />
                  <span>Run Multi-Model Simulation</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Suggestion Chips */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-[11px] font-semibold text-slate-400">Suggested:</span>
          {DEFAULT_SUGGESTIONS.map((s, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                setQuery(s);
                handleRunSimulation(s);
              }}
              className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-purple-50 hover:text-purple-700 text-slate-600 transition cursor-pointer border border-slate-200/60"
            >
              {s}
            </button>
          ))}
        </div>

        {/* Engine Toggle Toggles */}
        <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-700 mr-1">Active Evaluators:</span>
            {ENGINES_CONFIG.map((eng) => {
              const isSelected = selectedEngines.includes(eng.id);
              return (
                <button
                  key={eng.id}
                  type="button"
                  onClick={() => toggleEngine(eng.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer border ${
                    isSelected
                      ? "bg-purple-50 border-purple-300 text-purple-800 shadow-2xs"
                      : "bg-white border-slate-200 text-slate-400 hover:bg-slate-50"
                  }`}
                >
                  <Bot size={13} className={isSelected ? "text-purple-600" : "text-slate-400"} />
                  <span>{eng.name}</span>
                  <span className="text-[10px] text-slate-400">({eng.model.split(" ")[0]})</span>
                </button>
              );
            })}
          </div>

          <span className="text-[11px] text-slate-400">
            Simulates unbiased user prompts with zero brand priming
          </span>
        </div>
      </div>

      {/* ── SIMULATION RESULTS DISPLAY ── */}
      {result && (
        <div className="space-y-6 animate-in fade-in duration-300">
          {/* Scoreboard Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Citation Rate</span>
              <div className="text-2xl font-bold text-slate-900 mt-1 flex items-center gap-2">
                <span>{result.overallCitationRate}%</span>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                    result.overallCitationRate >= 75
                      ? "bg-emerald-50 text-emerald-700"
                      : result.overallCitationRate >= 50
                      ? "bg-blue-50 text-blue-700"
                      : "bg-amber-50 text-amber-700"
                  }`}
                >
                  {result.overallCitationRate >= 75 ? "Dominant" : result.overallCitationRate >= 50 ? "Competitive" : "Displaced"}
                </span>
              </div>
              <span className="text-[11px] text-slate-500 mt-0.5 block">
                {result.engines.filter((e) => e.cited).length} of {result.engines.length} models recommend {result.brandName}
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Share of Voice</span>
              <div className="text-2xl font-bold text-purple-700 mt-1">{result.overallShareOfVoice}%</div>
              <span className="text-[11px] text-slate-500 mt-0.5 block">Relative to competitor brand mentions</span>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Competitor Mentions</span>
              <div className="text-2xl font-bold text-slate-900 mt-1">
                {result.engines.reduce((acc, e) => acc + e.competitorsCited.length, 0)}
              </div>
              <span className="text-[11px] text-slate-500 mt-0.5 block">Rivals named in generated answers</span>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Average Latency</span>
              <div className="text-2xl font-bold text-slate-900 mt-1">
                {Math.round(result.engines.reduce((acc, e) => acc + e.latencyMs, 0) / result.engines.length)} ms
              </div>
              <span className="text-[11px] text-emerald-600 mt-0.5 block">Real-time model response</span>
            </div>
          </div>

          {/* 4-Column Side-by-Side Comparison */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {result.engines.map((eng) => {
              const cfg = ENGINES_CONFIG.find((c) => c.id === eng.engine) || ENGINES_CONFIG[0];
              return (
                <div
                  key={eng.engine}
                  className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs flex flex-col justify-between space-y-4 hover:border-purple-200 transition"
                >
                  <div className="space-y-3">
                    {/* Model Header */}
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                      <div>
                        <h4 className="text-sm font-bold text-slate-900">{cfg.name}</h4>
                        <span className="text-[10.5px] font-mono text-slate-400">{eng.model}</span>
                      </div>
                      <span className="text-[10px] font-mono text-slate-400">{eng.latencyMs}ms</span>
                    </div>

                    {/* Citation Status Pill */}
                    <div className="flex items-center justify-between">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                          eng.cited
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                            : "bg-rose-50 text-rose-700 border border-rose-200/60"
                        }`}
                      >
                        {eng.cited ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
                        <span>{eng.cited ? `Cited #${eng.position || 1}` : "Not Cited"}</span>
                      </span>

                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          eng.sentiment === "POSITIVE"
                            ? "bg-emerald-100 text-emerald-800"
                            : eng.sentiment === "NEGATIVE"
                            ? "bg-rose-100 text-rose-800"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {eng.sentiment}
                      </span>
                    </div>

                    {/* Answer Excerpt with highlighted keywords */}
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-100/80 text-[11.5px] text-slate-700 leading-relaxed max-h-48 overflow-y-auto">
                      <p className="italic">
                        &quot;{eng.answerExcerpt}&quot;
                      </p>
                    </div>

                    {/* Competitors Mentioned */}
                    {eng.competitorsCited.length > 0 && (
                      <div className="space-y-1">
                        <span className="text-[10.5px] font-semibold text-slate-400 uppercase tracking-wider block">
                          Competitors Named:
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {eng.competitorsCited.map((comp, cIdx) => (
                            <span
                              key={cIdx}
                              className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-amber-50 text-amber-800 border border-amber-200/60"
                            >
                              {comp}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Hallucination Risk Badge */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10.5px]">
                    <span className="text-slate-400">Hallucination Risk:</span>
                    <span
                      className={`font-semibold ${
                        eng.hallucinationRisk === "LOW"
                          ? "text-emerald-600"
                          : eng.hallucinationRisk === "MEDIUM"
                          ? "text-amber-600"
                          : "text-rose-600"
                      }`}
                    >
                      {eng.hallucinationRisk}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── AUTONOMOUS CITATION DISPLACEMENT PATCH CARD ── */}
          <div className="rounded-2xl border border-purple-200 bg-gradient-to-br from-purple-50/70 via-white to-indigo-50/40 p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-md shadow-purple-500/25 shrink-0">
                  <Flame className="h-6 w-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-900">
                      Targeted AI Citation Displacement Patch
                    </h3>
                    <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
                      Priority: {result.displacementPatch.priority}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {result.displacementPatch.reasoning}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => handleStageDisplacement(result.displacementPatch)}
                  className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition shadow-md shadow-purple-500/20 active:scale-[0.98] flex items-center gap-2 cursor-pointer"
                >
                  {stagedSuccess ? (
                    <>
                      <Check size={14} className="text-emerald-300" />
                      <span>Staged into Fix Engine!</span>
                    </>
                  ) : (
                    <>
                      <Plus size={14} />
                      <span>Stage Displacement Patch in Fix Engine</span>
                    </>
                  )}
                </button>

                <Link
                  href="/fix-engine?tab=implementation"
                  className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition flex items-center gap-1.5"
                >
                  <span>Go to Fix Engine</span>
                  <ArrowRight size={13} />
                </Link>
              </div>
            </div>

            {/* Content & Schema Preview Tabs */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-2">
              <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-800 flex items-center gap-1.5">
                    <FileCode size={13} className="text-purple-600" />
                    LLM RAG Citation Paragraph
                  </span>
                  <span className="text-[10.5px] font-mono text-purple-600 bg-purple-50 px-2 py-0.5 rounded">
                    Entity-Anchored
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-100 font-mono">
                  {result.displacementPatch.displacementContent}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-800 flex items-center gap-1.5">
                    <CodeIcon className="h-3.5 w-3.5 text-emerald-600" />
                    JSON-LD FAQ Schema Structured Data
                  </span>
                  <span className="text-[10.5px] font-mono text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                    Schema.org/FAQPage
                  </span>
                </div>
                <pre className="text-[11px] text-slate-700 bg-slate-900 text-slate-100 p-3 rounded-lg overflow-x-auto max-h-36 font-mono leading-relaxed">
                  {result.displacementPatch.faqSchema}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CodeIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  );
}
