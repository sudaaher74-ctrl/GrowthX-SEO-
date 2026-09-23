"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Sparkles,
  Bot,
  Search,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Zap,
  FileCode,
  Check,
  Loader2,
  Plus,
  Flame,
} from "lucide-react";
import { useSimulateGeo } from "@/hooks/use-growthx";
import { stagingEngine } from "@/lib/staging-engine";
import { errorMessage } from "@/lib/error-message";
import { assistantLabel, assistantList } from "@/lib/ai-assistants";
import type { GeoEngine, GeoSimulationResult, GeoDisplacementPatch } from "@/lib/api-client";

interface GeoSimulationSandboxProps {
  projectId?: string | null;
  /** Engines this deployment can actually ask (the report's measurableAssistants). */
  availableEngines?: string[];
  /** The customer's own tracked questions, offered as one-click queries. */
  suggestions?: string[];
}

const ALL_ENGINES: GeoEngine[] = ["SARVAM", "CHATGPT", "CLAUDE", "GEMINI", "PERPLEXITY"];

export function GeoSimulationSandbox({ projectId, availableEngines = [], suggestions = [] }: GeoSimulationSandboxProps) {
  const [query, setQuery] = useState("");
  // Every engine this deployment can ask is selected unless turned off.
  const [deselected, setDeselected] = useState<GeoEngine[]>([]);
  const [result, setResult] = useState<GeoSimulationResult | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [stagedSuccess, setStagedSuccess] = useState(false);

  const simulateMutation = useSimulateGeo(projectId);
  const enabled = ALL_ENGINES.filter((e) => availableEngines.includes(e));
  const selectedEngines = enabled.filter((e) => !deselected.includes(e));

  const toggleEngine = (engine: GeoEngine) => {
    if (!enabled.includes(engine)) return;
    if (deselected.includes(engine)) {
      setDeselected(deselected.filter((e) => e !== engine));
    } else if (selectedEngines.length > 1) {
      setDeselected([...deselected, engine]);
    }
  };

  const handleRunSimulation = async (queryToRun = query) => {
    if (!queryToRun.trim() || selectedEngines.length === 0) return;
    setStagedSuccess(false);
    setRunError(null);
    try {
      const res = await simulateMutation.mutateAsync({ query: queryToRun.trim(), engines: selectedEngines });
      setResult(res);
    } catch (err) {
      setRunError(errorMessage(err));
    }
  };

  const handleStageDisplacement = (patch: GeoDisplacementPatch) => {
    if (!projectId || !result) return;
    stagingEngine.stage(projectId, {
      title: patch.targetTitle,
      category: "AI_SEARCH",
      source: "AI_VISIBILITY",
      priority: patch.priority,
      impact: `Answers "${result.query.slice(0, 40)}" directly on your site`,
      effortHours: 2,
      deliverable: "Draft answer section & JSON-LD FAQ schema (review placeholders before publishing)",
      evidence: patch.reasoning,
      affectedUrl: patch.targetUrl,
    });
    setStagedSuccess(true);
    setTimeout(() => setStagedSuccess(false), 4000);
  };

  const answered = result?.engines.filter((e) => !e.error) ?? [];

  return (
    <div className="space-y-6">
      {/* ── HEADER ── */}
      <div className="rounded-2xl border bg-brand-950 text-white p-6 shadow-md">
        <div className="space-y-2 max-w-3xl">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold tracking-wider uppercase bg-white/10 text-brand-300 border border-white/20">
            <Sparkles className="h-3 w-3" />
            Generative Engine Optimization (GEO)
          </span>
          <h2 className="text-2xl font-bold tracking-tight">Live AI Search Sandbox</h2>
          <p className="text-xs sm:text-sm text-brand-300 leading-relaxed">
            {`Ask ${assistantList(enabled)} a buyer's question right now and see whether your brand is cited and who is named instead. Each engine is asked directly — nothing is simulated or written on its behalf.`}
          </p>
        </div>
      </div>

      {/* ── QUERY INPUT ── */}
      <div className="rounded-2xl border bg-white p-6 shadow-xs space-y-4">
        <div>
          <label htmlFor="geo-query-input" className="block text-xs font-bold text-brand-700 uppercase tracking-wider mb-2">
            Buyer search question
          </label>
          <div className="flex flex-col sm:flex-row items-stretch gap-2.5">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-brand-400" />
              <input
                id="geo-query-input"
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleRunSimulation()}
                placeholder="e.g. best organic food exporter in India"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 focus:ring-brand-950/20 text-xs font-medium text-brand-950 bg-brand-50/50 placeholder:text-brand-400 transition"
              />
            </div>
            <button
              type="button"
              onClick={() => handleRunSimulation()}
              disabled={simulateMutation.isPending || !query.trim() || selectedEngines.length === 0}
              className="px-6 py-2.5 rounded-xl bg-brand-950 hover:bg-brand-800 disabled:opacity-50 text-white text-xs font-bold transition flex items-center justify-center gap-2 shrink-0"
            >
              {simulateMutation.isPending ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  <span>Asking {assistantList(selectedEngines)}…</span>
                </>
              ) : (
                <>
                  <Zap size={13} />
                  <span>Ask now</span>
                </>
              )}
            </button>
          </div>
        </div>

        {suggestions.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-[11px] font-semibold text-brand-400">Your tracked questions:</span>
            {suggestions.slice(0, 4).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  setQuery(s);
                  handleRunSimulation(s);
                }}
                className="text-[11px] px-2.5 py-1 rounded-lg border bg-brand-100 hover:bg-brand-50 text-brand-600 hover:text-brand-950 transition"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        <div className="pt-3 border-t flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-brand-700 mr-1">Engines:</span>
            {ALL_ENGINES.map((engine) => {
              const isEnabled = enabled.includes(engine);
              const isSelected = selectedEngines.includes(engine);
              return (
                <button
                  key={engine}
                  type="button"
                  onClick={() => toggleEngine(engine)}
                  disabled={!isEnabled}
                  title={isEnabled ? undefined : "Not enabled on this deployment"}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 border ${
                    isSelected
                      ? "bg-brand-50 text-brand-950 shadow-2xs"
                      : isEnabled
                        ? "bg-white text-brand-400 hover:bg-brand-50"
                        : "bg-white text-brand-300 cursor-not-allowed"
                  }`}
                >
                  <Bot size={13} />
                  <span>{assistantLabel(engine)}</span>
                  {!isEnabled && <span className="text-[10px]">· not enabled</span>}
                </button>
              );
            })}
          </div>
          <span className="text-[11px] text-brand-400">Asked as a member of the public would, with no brand priming</span>
        </div>
      </div>

      {runError && (
        <div className="flex items-start gap-2 rounded-xl border bg-error-50 px-4 py-3 text-[12px] text-error-700">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <span>{runError}</span>
        </div>
      )}

      {/* ── RESULTS ── */}
      {result && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-white border shadow-xs">
              <span className="text-[11px] font-bold text-brand-400 uppercase tracking-wider block">Citation Rate</span>
              <div className="text-2xl font-bold text-brand-950 mt-1">
                {result.overallCitationRate != null ? `${result.overallCitationRate}%` : "—"}
              </div>
              <span className="text-[11px] text-brand-500 mt-0.5 block">
                {result.enginesAnswered > 0
                  ? `${answered.filter((e) => e.cited).length} of ${result.enginesAnswered} answers cited ${result.brandName}`
                  : "No engine answered"}
              </span>
            </div>
            <div className="p-4 rounded-2xl bg-white border shadow-xs">
              <span className="text-[11px] font-bold text-brand-400 uppercase tracking-wider block">Share of Voice</span>
              <div className="text-2xl font-bold text-brand-950 mt-1">
                {result.overallShareOfVoice != null ? `${result.overallShareOfVoice}%` : "—"}
              </div>
              <span className="text-[11px] text-brand-500 mt-0.5 block">Your mentions vs. tracked competitors</span>
            </div>
            <div className="p-4 rounded-2xl bg-white border shadow-xs">
              <span className="text-[11px] font-bold text-brand-400 uppercase tracking-wider block">Competitor Mentions</span>
              <div className="text-2xl font-bold text-brand-950 mt-1">
                {answered.reduce((acc, e) => acc + e.competitorsCited.length, 0)}
              </div>
              <span className="text-[11px] text-brand-500 mt-0.5 block">Tracked rivals named in the answers</span>
            </div>
            <div className="p-4 rounded-2xl bg-white border shadow-xs">
              <span className="text-[11px] font-bold text-brand-400 uppercase tracking-wider block">Response Time</span>
              <div className="text-2xl font-bold text-brand-950 mt-1">
                {answered.length > 0
                  ? `${Math.round(answered.reduce((acc, e) => acc + e.latencyMs, 0) / answered.length)} ms`
                  : "—"}
              </div>
              <span className="text-[11px] text-brand-500 mt-0.5 block">Average over engines that answered</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {result.engines.map((eng) => (
              <div key={eng.engine} className="rounded-2xl border bg-white p-5 shadow-xs space-y-3">
                <div className="flex items-center justify-between pb-3 border-b">
                  <div>
                    <h4 className="text-sm font-bold text-brand-950">{assistantLabel(eng.engine)}</h4>
                    <span className="text-[10.5px] font-mono text-brand-400">{eng.model ?? "not asked"}</span>
                  </div>
                  {!eng.error && <span className="text-[10px] font-mono text-brand-400">{eng.latencyMs}ms</span>}
                </div>

                {eng.error ? (
                  <div className="flex items-start gap-2 rounded-xl bg-warning-50 p-3 text-[11.5px] text-warning-700">
                    <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                    <span>{eng.error}</span>
                  </div>
                ) : (
                  <>
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                        eng.cited ? "bg-success-50 text-success-700" : "bg-error-50 text-error-700"
                      }`}
                    >
                      {eng.cited ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
                      <span>{eng.cited ? `Cited${eng.position ? ` #${eng.position}` : ""}` : "Not cited"}</span>
                    </span>
                    <div className="p-3 rounded-xl bg-brand-50 border text-[11.5px] text-brand-700 leading-relaxed max-h-48 overflow-y-auto whitespace-pre-line">
                      {eng.answerExcerpt}
                    </div>
                    {eng.competitorsCited.length > 0 && (
                      <div className="space-y-1">
                        <span className="text-[10.5px] font-semibold text-brand-400 uppercase tracking-wider block">
                          Competitors named
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {eng.competitorsCited.map((comp) => (
                            <span key={comp} className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-warning-50 text-warning-700">
                              {comp}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>

          {result.displacementPatch ? (
            <div className="rounded-2xl border bg-white p-6 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="h-11 w-11 rounded-xl bg-brand-950 text-white flex items-center justify-center shrink-0">
                    <Flame className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-brand-950">Draft section to answer this question</h3>
                      <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-full bg-brand-100 text-brand-950">
                        Priority: {result.displacementPatch.priority}
                      </span>
                    </div>
                    <p className="text-xs text-brand-500 mt-0.5">{result.displacementPatch.reasoning}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleStageDisplacement(result.displacementPatch!)}
                    className="px-5 py-2.5 rounded-xl bg-brand-950 hover:bg-brand-800 text-white text-xs font-bold transition flex items-center gap-2"
                  >
                    {stagedSuccess ? (
                      <>
                        <Check size={14} className="text-success-400" />
                        <span>Staged in Fix Engine</span>
                      </>
                    ) : (
                      <>
                        <Plus size={14} />
                        <span>Stage in Fix Engine</span>
                      </>
                    )}
                  </button>
                  <Link
                    href="/action-queue"
                    className="px-4 py-2.5 rounded-xl border bg-white hover:bg-brand-50 text-brand-700 text-xs font-semibold transition flex items-center gap-1.5"
                  >
                    <span>Go to Action Queue</span>
                    <ArrowRight size={13} />
                  </Link>
                </div>
              </div>

              <p className="text-[11px] text-brand-400">
                Drafted by {result.displacementPatch.draftedBy} from the answers above. Replace every [bracketed] placeholder
                with a real fact before publishing.
              </p>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-2">
                <div className="p-4 rounded-xl bg-white border space-y-2">
                  <span className="font-bold text-brand-950 text-xs flex items-center gap-1.5">
                    <FileCode size={13} />
                    Answer section — {result.displacementPatch.targetTitle}
                  </span>
                  <p className="text-xs text-brand-600 leading-relaxed bg-brand-50 p-3 rounded-lg border whitespace-pre-line">
                    {result.displacementPatch.displacementContent}
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-white border space-y-2">
                  <span className="font-bold text-brand-950 text-xs flex items-center gap-1.5">
                    <FileCode size={13} />
                    JSON-LD FAQ schema
                  </span>
                  <pre className="text-[11px] bg-brand-950 text-brand-100 p-3 rounded-lg overflow-x-auto max-h-36 font-mono leading-relaxed">
                    {result.displacementPatch.faqSchema}
                  </pre>
                </div>
              </div>
            </div>
          ) : (
            result.enginesAnswered > 0 && (
              <p className="text-[11.5px] text-brand-500">A draft section could not be written for this query.</p>
            )
          )}
        </div>
      )}
    </div>
  );
}
