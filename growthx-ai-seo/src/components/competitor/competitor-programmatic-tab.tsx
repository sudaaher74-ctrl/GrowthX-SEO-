"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Binary,
  Sparkles,
  Layers,
  Database,
  ArrowRight,
  ExternalLink,
  Code2,
  FileCode,
  Copy,
  Check,
  TrendingUp,
  Filter,
  CheckCircle2,
  Loader2,
  X,
  Zap,
  Globe,
  GitBranch,
} from "lucide-react";
import {
  useProgrammaticMatrix,
  useDispatchFindingToQueue,
} from "@/hooks/use-growthx";
import type {
  ProgrammaticCluster,
  TrackedCompetitor,
} from "@/lib/api-client";

interface CompetitorProgrammaticTabProps {
  projectId: string;
  customerDomain: string;
  competitors: TrackedCompetitor[];
  onAddToFixPlan?: (count: number, label?: string) => void;
}

export function CompetitorProgrammaticTab({
  projectId,
  customerDomain,
  competitors = [],
  onAddToFixPlan,
}: CompetitorProgrammaticTabProps) {
  const [selectedCompetitorId, setSelectedCompetitorId] = useState<string>("all");
  const [activeCluster, setActiveCluster] = useState<ProgrammaticCluster | null>(null);
  const [copiedH2, setCopiedH2] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [dispatchedIds, setDispatchedIds] = useState<Set<string>>(new Set());

  const { data, isLoading } = useProgrammaticMatrix(
    projectId,
    selectedCompetitorId !== "all" ? selectedCompetitorId : undefined,
  );

  const dispatchMutation = useDispatchFindingToQueue(projectId);

  const scoreboard = data?.scoreboard;
  const rawClusters = data?.clusters || [];

  // Defensive normalization to support both snake_case, legacy keys, or partial payloads safely
  const clusters: ProgrammaticCluster[] = rawClusters.map((raw: any, index: number) => {
    const patternId = raw.patternId || raw.id || `cluster_${index}`;
    const formula = raw.formula || raw.urlPattern || "Pattern";
    const patternType = raw.patternType || raw.category || "COMPARISON";
    const competitorDomain = raw.competitorDomain || "Competitor";
    const sampleUrls = Array.isArray(raw.sampleUrls) ? raw.sampleUrls : [];
    const totalDetectedPages = Number(raw.totalDetectedPages ?? raw.pageCount ?? 0);
    const estimatedMonthlyVisits = Number(raw.estimatedMonthlyVisits ?? 0);

    const extractedVariables = Array.isArray(raw.extractedVariables)
      ? raw.extractedVariables
      : Array.isArray(raw.variables)
      ? raw.variables.map((v: any) => (typeof v === "string" ? v : v?.name || String(v)))
      : [];

    const sampleVariables = (raw.sampleVariables && typeof raw.sampleVariables === "object")
      ? raw.sampleVariables
      : {};

    const rawBp = raw.counterBlueprint || raw.counterStrategy || {};
    const counterBlueprint = {
      counterPattern: rawBp.counterPattern || rawBp.recommendedUrlPattern || `https://${customerDomain}/counter`,
      targetArchitecture: rawBp.targetArchitecture || rawBp.recommendedUrlPattern || "/counter-architecture",
      recommendedSchemaType: rawBp.recommendedSchemaType || "WebPage",
      semanticH2Outlines: Array.isArray(rawBp.semanticH2Outlines) ? rawBp.semanticH2Outlines : [],
      differentiationAngle: rawBp.differentiationAngle || rawBp.differentiatorAngle || "Verified, high-depth alternative.",
      sampleCopyablePrompt: rawBp.sampleCopyablePrompt || rawBp.sampleDeliverableTemplate || "",
      targetSlugExample: rawBp.targetSlugExample || "/example-route",
    };

    return {
      patternId,
      formula,
      patternType,
      competitorDomain,
      sampleUrls,
      totalDetectedPages,
      extractedVariables,
      sampleVariables,
      estimatedMonthlyVisits,
      counterBlueprint,
    };
  });

  const totalPatterns = scoreboard?.totalPatternsDetected ?? (scoreboard as any)?.totalProgrammaticClusters ?? clusters.length;
  const totalPages = scoreboard?.totalProgrammaticPages ?? (scoreboard as any)?.totalCompetitorPagesIndexed ?? 0;
  const totalTraffic = scoreboard?.estimatedTrafficCaptured ?? (scoreboard as any)?.estimatedTotalTrafficCaptured ?? 0;
  const dominantFormula = scoreboard?.dominantFormulaType ?? (scoreboard as any)?.topPatternCategory ?? (clusters[0]?.patternType || "Analyzing");
  const readyBlueprints = scoreboard?.highPriorityCounterAttacks ?? (scoreboard as any)?.readyToCounterCount ?? clusters.length;

  const handleCopy = (text: string, type: "h2" | "prompt") => {
    navigator.clipboard.writeText(text);
    if (type === "h2") {
      setCopiedH2(true);
      setTimeout(() => setCopiedH2(false), 2000);
    } else {
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 2000);
    }
  };

  const handleDispatchCluster = async (cluster: ProgrammaticCluster) => {
    const bp = cluster.counterBlueprint;
    try {
      await dispatchMutation.mutateAsync({
        title: `Programmatic Counter-Architecture: Counter ${cluster.formula}`,
        summary: `Competitor ${cluster.competitorDomain} captured ${cluster.totalDetectedPages} pages with pattern ${cluster.formula}. Estimated traffic: ~${cluster.estimatedMonthlyVisits.toLocaleString()}/mo.`,
        recommendedAction: `Deploy counter-pattern architecture: ${bp.counterPattern} targeting ${bp.targetArchitecture}. Differentiation angle: ${bp.differentiationAngle}`,
        potential: "HIGH",
        effort: "MEDIUM",
        category: "COMPETITOR",
        source: "COMPETITOR",
        evidence: [
          { label: "Formula", value: cluster.formula, source: "PATTERN_DECOMPILER" },
          { label: "Competitor Pages", value: String(cluster.totalDetectedPages), source: "CRAWLER" },
          { label: "Est. Traffic", value: `~${cluster.estimatedMonthlyVisits.toLocaleString()}/mo`, source: "SEO_SCOREBOARD" },
          { label: "Target Schema", value: bp.recommendedSchemaType, source: "SCHEMA_SUITE" },
        ],
        affectedPages: cluster.sampleUrls.slice(0, 5),
      });

      setDispatchedIds((prev) => new Set([...prev, cluster.patternId]));
      if (onAddToFixPlan) {
        onAddToFixPlan(1, `Programmatic Counter: ${cluster.formula}`);
      }
    } catch (err) {
      console.error("Failed to dispatch programmatic blueprint to Action Queue", err);
    }
  };

  return (
    <div className="space-y-6">
      {/* ── HEADER BANNER ── */}
      <div className="relative overflow-hidden rounded-2xl border bg-brand-950 p-6 text-white shadow-md">
        <div className="absolute right-0 top-0 -mt-10 -mr-10 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
        <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-bold tracking-wide text-brand-300 backdrop-blur-md">
              <Binary size={12} className="text-brand-400" />
              <span>REVERSE PROGRAMMATIC SEO DECOMPILER</span>
            </div>
            <h2 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
              Decompile Competitor Directory Formulas
            </h2>
            <p className="text-[13px] leading-relaxed text-brand-300/90">
              Scans your competitors' crawl topology to reverse-engineer their programmatic URL structures (`/vs/*`, `/integrations/*`, `/templates/*`), template variables, and page counts. Instantly generates counter-architectures ready for your engineering team.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <select
                value={selectedCompetitorId}
                onChange={(e) => setSelectedCompetitorId(e.target.value)}
                className="appearance-none rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 pr-9 text-xs font-semibold text-white backdrop-blur-md transition hover:bg-white/15 focus:outline-none"
              >
                <option value="all" className="bg-brand-900 text-white">All Competitors</option>
                {competitors.map((c) => (
                  <option key={c.id} value={c.id} className="bg-brand-900 text-white">
                    {c.domain || c.name || "Competitor"}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* ── SCOREBOARD METRICS ── */}
        <div className="mt-8 grid grid-cols-2 gap-4 border-t border-white/10 pt-6 sm:grid-cols-5">
          <div className="space-y-1">
            <div className="text-[11px] font-medium text-brand-400">Formulas Discovered</div>
            <div className="text-2xl font-black text-white">
              {totalPatterns}
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-[11px] font-medium text-brand-400">Competitor Programmatic Pages</div>
            <div className="text-2xl font-black text-white">
              {totalPages ? totalPages.toLocaleString() : "0"}
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-[11px] font-medium text-brand-400">Captured Traffic Est.</div>
            <div className="text-2xl font-black text-success-400">
              ~{totalTraffic ? totalTraffic.toLocaleString() : "0"}/mo
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-[11px] font-medium text-brand-400">Dominant Formula</div>
            <div className="text-sm font-bold text-brand-200 truncate">
              {dominantFormula}
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-[11px] font-medium text-brand-400">Ready Blueprints</div>
            <div className="text-2xl font-black text-white">
              {readyBlueprints}
            </div>
          </div>
        </div>
      </div>

      {/* ── CLUSTERS SECTION ── */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border bg-white p-12 text-center shadow-sm">
          <Loader2 className="h-8 w-8 animate-spin text-brand-950" />
          <p className="mt-3 text-sm font-semibold text-brand-700">Decompiling competitor programmatic directories...</p>
          <p className="text-xs text-brand-500">Clustering URL paths, extracting template parameters, and generating counter-architectures</p>
        </div>
      ) : clusters.length === 0 ? (
        <div className="rounded-2xl border bg-white p-12 text-center shadow-sm">
          <Database className="mx-auto h-12 w-12 text-brand-300" />
          <h3 className="mt-4 text-base font-bold text-brand-950">No Programmatic Directories Detected Yet</h3>
          <p className="mt-1 text-xs text-brand-500 max-w-md mx-auto">
            Once your competitors' crawl data includes repeated directory paths (e.g., `/vs/*`, `/integrations/*`, `/templates/*`), they will appear here with reverse-engineered templates.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {clusters.map((cluster) => {
            const isDispatched = dispatchedIds.has(cluster.patternId);
            return (
              <div
                key={cluster.patternId}
                className="flex flex-col justify-between rounded-2xl border bg-white p-6 shadow-sm transition hover:shadow-md"
              >
                <div className="space-y-4">
                  {/* Top Bar */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-brand-100 px-2.5 py-0.5 text-[11px] font-extrabold tracking-wide text-brand-700">
                        {cluster.patternType}
                      </span>
                      <span className="text-xs font-semibold text-brand-500">
                        {cluster.competitorDomain}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-black text-brand-950">
                        {cluster.totalDetectedPages.toLocaleString()} pages
                      </span>
                    </div>
                  </div>

                  {/* Formula Code Block */}
                  <div>
                    <div className="text-[11px] font-medium text-brand-500 mb-1">Decompiled Directory Formula:</div>
                    <div className="rounded-xl border bg-brand-900 p-3 font-mono text-xs font-bold text-success-400">
                      <code>{cluster.formula}</code>
                    </div>
                  </div>

                  {/* Extracted Variables */}
                  {cluster.extractedVariables.length > 0 && (
                    <div>
                      <div className="text-[11px] font-medium text-brand-500 mb-1.5">Identified Template Variables:</div>
                      <div className="flex flex-wrap gap-1.5">
                        {cluster.extractedVariables.map((v) => (
                          <span
                            key={v}
                            className="inline-flex items-center gap-1 rounded-md bg-brand-100 px-2 py-0.5 font-mono text-[11px] font-semibold text-brand-700"
                          >
                            <GitBranch size={10} className="text-brand-400" />
                            {v}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Counter Architecture Preview */}
                  <div className="rounded-xl border border-brand-200 bg-brand-50 p-3.5 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-brand-900">
                      <Sparkles size={13} />
                      <span>Counter-Architecture Proposal</span>
                    </div>
                    <p className="text-xs text-brand-700">
                      Target: <span className="font-mono font-bold text-brand-950">{cluster.counterBlueprint?.targetArchitecture || "Standard Route"}</span>
                    </p>
                    <p className="text-[11px] text-brand-600 line-clamp-2">
                      Angle: {cluster.counterBlueprint?.differentiationAngle || "Technical optimization."}
                    </p>
                  </div>
                </div>

                {/* Footer Controls */}
                <div className="mt-5 flex items-center justify-between border-t pt-4">
                  <div className="text-xs font-semibold text-brand-500">
                    Est. Traffic: <span className="font-bold text-brand-950">~{cluster.estimatedMonthlyVisits.toLocaleString()}/mo</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveCluster(cluster)}
                      className="inline-flex items-center gap-1 rounded-xl border px-3 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-50 transition"
                    >
                      <Code2 size={13} />
                      <span>Inspect Blueprint</span>
                    </button>

                    {isDispatched ? (
                      <button
                        type="button"
                        disabled
                        className="inline-flex items-center gap-1 rounded-xl bg-success-500 px-3 py-1.5 text-xs font-bold text-white shadow-sm"
                      >
                        <Check size={13} />
                        <span>In Roadmap</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleDispatchCluster(cluster)}
                        className="inline-flex items-center gap-1 rounded-xl bg-brand-950 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-brand-800 transition active:scale-95"
                      >
                        <Zap size={12} className="text-warning-400" />
                        <span>Add to Roadmap</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── BLUEPRINT DECOMPILER DRAWER / MODAL ── */}
      {activeCluster && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border bg-white p-6 shadow-2xl space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between border-b pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-bold text-brand-800">
                    {activeCluster.patternType}
                  </span>
                  <span className="text-xs text-brand-500">{activeCluster.competitorDomain}</span>
                </div>
                <h3 className="mt-1 text-xl font-black text-brand-950">
                  Programmatic Counter-Architecture
                </h3>
                <p className="text-xs text-brand-500 font-mono mt-0.5">
                  Formula: {activeCluster.formula}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveCluster(null)}
                className="rounded-lg p-1.5 text-brand-400 hover:bg-brand-100 hover:text-brand-600 transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* Target Architecture Specification */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-brand-500">
                Recommended URL Route & Slug Structure
              </h4>
              <div className="rounded-xl border bg-brand-900 p-4 font-mono text-xs text-white space-y-1">
                <div>Route: <span className="text-success-400 font-bold">{activeCluster.counterBlueprint?.targetArchitecture || "Direct"}</span></div>
                <div>Slug Example: <span className="text-brand-300">https://{customerDomain}{activeCluster.counterBlueprint?.targetSlugExample || "/example"}</span></div>
                <div>JSON-LD Schema Type: <span className="text-warning-400 font-bold">{activeCluster.counterBlueprint?.recommendedSchemaType || "WebPage"}</span></div>
              </div>
            </div>

            {/* Differentiation Angle */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-brand-500">
                AI & Organic Differentiation Thesis
              </h4>
              <div className="rounded-xl border bg-brand-50 p-4 text-xs leading-relaxed text-brand-800">
                {activeCluster.counterBlueprint?.differentiationAngle || "Comprehensive high-fidelity counter strategy."}
              </div>
            </div>

            {/* Semantic H2 Outlines */}
            {activeCluster.counterBlueprint?.semanticH2Outlines && activeCluster.counterBlueprint.semanticH2Outlines.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-brand-500">
                    Semantic Heading Hierarchy (H2 Specifications)
                  </h4>
                  <button
                    type="button"
                    onClick={() => handleCopy(activeCluster.counterBlueprint.semanticH2Outlines.join("\n"), "h2")}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-brand-950 hover:underline"
                  >
                    {copiedH2 ? <Check size={12} /> : <Copy size={12} />}
                    <span>{copiedH2 ? "Copied" : "Copy Outlines"}</span>
                  </button>
                </div>
                <ul className="rounded-xl border bg-white divide-y">
                  {activeCluster.counterBlueprint.semanticH2Outlines.map((h2, idx) => (
                    <li key={idx} className="flex items-center gap-3 p-3 text-xs text-brand-800">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[10px] font-bold text-brand-600">
                        {idx + 1}
                      </span>
                      <span className="font-semibold">{h2}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Generation Prompt */}
            {activeCluster.counterBlueprint?.sampleCopyablePrompt && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-brand-500">
                    Copyable LLM Prompt Template for Content Matrix
                  </h4>
                  <button
                    type="button"
                    onClick={() => handleCopy(activeCluster.counterBlueprint.sampleCopyablePrompt, "prompt")}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-brand-950 hover:underline"
                  >
                    {copiedPrompt ? <Check size={12} /> : <Copy size={12} />}
                    <span>{copiedPrompt ? "Copied" : "Copy Prompt"}</span>
                  </button>
                </div>
                <pre className="max-h-48 overflow-y-auto rounded-xl border bg-brand-900 p-4 font-mono text-[11px] leading-relaxed text-brand-200 whitespace-pre-wrap">
                  {activeCluster.counterBlueprint.sampleCopyablePrompt}
                </pre>
              </div>
            )}

            {/* Drawer Footer */}
            <div className="flex items-center justify-between border-t pt-4">
              <Link
                href="/action-queue"
                className="text-xs font-semibold text-brand-950 hover:underline flex items-center gap-1"
              >
                <span>View SEO Roadmap</span>
                <ArrowRight size={13} />
              </Link>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveCluster(null)}
                  className="rounded-xl border px-4 py-2 text-xs font-semibold text-brand-600 hover:bg-brand-50 transition"
                >
                  Close
                </button>

                {dispatchedIds.has(activeCluster.patternId) ? (
                  <button
                    type="button"
                    disabled
                    className="inline-flex items-center gap-1.5 rounded-xl bg-success-500 px-5 py-2 text-xs font-bold text-white shadow-sm"
                  >
                    <Check size={14} />
                    <span>Added to SEO Roadmap</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleDispatchCluster(activeCluster)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-brand-950 px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-brand-900 transition active:scale-95"
                  >
                    <Sparkles size={13} />
                    <span>Add Blueprint to SEO Roadmap</span>
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
