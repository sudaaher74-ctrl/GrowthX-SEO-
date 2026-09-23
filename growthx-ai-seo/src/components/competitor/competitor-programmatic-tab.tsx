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
  const [copiedTemplate, setCopiedTemplate] = useState(false);
  const [dispatchedIds, setDispatchedIds] = useState<Set<string>>(new Set());

  const { data, isLoading } = useProgrammaticMatrix(
    projectId,
    selectedCompetitorId !== "all" ? selectedCompetitorId : undefined,
  );

  const dispatchMutation = useDispatchFindingToQueue(projectId);

  const scoreboard = data?.scoreboard;
  const clusters = data?.clusters || [];

  const handleCopyTemplate = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedTemplate(true);
    setTimeout(() => setCopiedTemplate(false), 2000);
  };

  const handleDispatchCluster = async (cluster: ProgrammaticCluster) => {
    const plan = cluster.counterStrategy;
    try {
      await dispatchMutation.mutateAsync({
        title: `Programmatic Counter-Architecture: Counter ${cluster.urlPattern}`,
        summary: `Competitor ${cluster.competitorDomain} publishes ${cluster.pageCount} crawled pages matching ${cluster.urlPattern}.`,
        recommendedAction: `Publish pages at ${plan.recommendedUrlPattern} (${plan.contentDepthBenchmark}). ${plan.differentiatorAngle}`,
        potential: "HIGH",
        effort: "MEDIUM",
        category: "COMPETITOR",
        source: "COMPETITOR",
        evidence: [
          { label: "Formula", value: cluster.urlPattern, source: "PATTERN_DECOMPILER" },
          { label: "Competitor Pages", value: String(cluster.pageCount), source: "CRAWLER" },
          { label: "Target Schema", value: plan.recommendedSchemaType, source: "SCHEMA_SUITE" },
        ],
        affectedPages: cluster.sampleUrls.slice(0, 5),
      });

      setDispatchedIds((prev) => new Set([...prev, cluster.id]));
      if (onAddToFixPlan) {
        onAddToFixPlan(1, `Programmatic Counter: ${cluster.urlPattern}`);
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
        <div className="mt-8 grid grid-cols-2 gap-4 border-t border-white/10 pt-6 sm:grid-cols-4">
          <div className="space-y-1">
            <div className="text-[11px] font-medium text-brand-400">Formulas Discovered</div>
            <div className="text-2xl font-black text-white">
              {scoreboard?.totalProgrammaticClusters ?? 0}
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-[11px] font-medium text-brand-400">Competitor Pages Audited</div>
            <div className="text-2xl font-black text-white">
              {(scoreboard?.totalCompetitorPagesIndexed ?? 0).toLocaleString()}
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-[11px] font-medium text-brand-400">Dominant Formula</div>
            <div className="text-sm font-bold text-brand-200 truncate">
              {scoreboard?.topPatternCategory ?? "None"}
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-[11px] font-medium text-brand-400">Ready Blueprints</div>
            <div className="text-2xl font-black text-white">
              {scoreboard?.readyToCounterCount ?? 0}
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
            const isDispatched = dispatchedIds.has(cluster.id);
            return (
              <div
                key={cluster.id}
                className="flex flex-col justify-between rounded-2xl border bg-white p-6 shadow-sm transition hover:shadow-md"
              >
                <div className="space-y-4">
                  {/* Top Bar */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-brand-100 px-2.5 py-0.5 text-[11px] font-extrabold tracking-wide text-brand-700">
                        {cluster.category}
                      </span>
                      <span className="text-xs font-semibold text-brand-500">
                        {cluster.competitorDomain}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-black text-brand-950">
                        {cluster.pageCount.toLocaleString()} pages
                      </span>
                    </div>
                  </div>

                  {/* Formula Code Block */}
                  <div>
                    <div className="text-[11px] font-medium text-brand-500 mb-1">Decompiled Directory Formula:</div>
                    <div className="rounded-xl border bg-brand-900 p-3 font-mono text-xs font-bold text-success-400">
                      <code>{cluster.urlPattern}</code>
                    </div>
                  </div>

                  {/* Extracted Variables */}
                  {cluster.variables.length > 0 && (
                    <div>
                      <div className="text-[11px] font-medium text-brand-500 mb-1.5">Identified Template Variables:</div>
                      <div className="flex flex-wrap gap-1.5">
                        {cluster.variables.map((v) => (
                          <span
                            key={v.name}
                            title={v.exampleValues.length ? `Seen in their URLs: ${v.exampleValues.join(", ")}` : v.description}
                            className="inline-flex items-center gap-1 rounded-md bg-brand-100 px-2 py-0.5 font-mono text-[11px] font-semibold text-brand-700"
                          >
                            <GitBranch size={10} className="text-brand-400" />
                            {v.name}
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
                      Target: <span className="font-mono font-bold text-brand-950">{cluster.counterStrategy.recommendedUrlPattern}</span>
                    </p>
                    <p className="text-[11px] text-brand-600 line-clamp-2">
                      Angle: {cluster.counterStrategy.differentiatorAngle}
                    </p>
                  </div>
                </div>

                {/* Footer Controls */}
                <div className="mt-5 flex items-center justify-between border-t pt-4">
                  <div className="text-xs font-semibold text-brand-500">
                    Intent: <span className="font-bold text-brand-950">{cluster.commercialIntent}</span>
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
                    {activeCluster.category}
                  </span>
                  <span className="text-xs text-brand-500">{activeCluster.competitorDomain}</span>
                </div>
                <h3 className="mt-1 text-xl font-black text-brand-950">
                  Programmatic Counter-Architecture
                </h3>
                <p className="text-xs text-brand-500 font-mono mt-0.5">
                  Formula: {activeCluster.urlPattern}
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
                <div>Route: <span className="text-success-400 font-bold">{activeCluster.counterStrategy.recommendedUrlPattern}</span></div>
                <div>H1 Formula: <span className="text-brand-300">{activeCluster.counterStrategy.targetH1Formula}</span></div>
                <div>JSON-LD Schema Type: <span className="text-warning-400 font-bold">{activeCluster.counterStrategy.recommendedSchemaType}</span></div>
                <div>Depth: <span className="text-brand-300">{activeCluster.counterStrategy.contentDepthBenchmark}</span></div>
              </div>
            </div>

            {/* Differentiation Angle */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-brand-500">
                AI & Organic Differentiation Thesis
              </h4>
              <div className="rounded-xl border bg-brand-50 p-4 text-xs leading-relaxed text-brand-800">
                {activeCluster.counterStrategy.differentiatorAngle}
              </div>
            </div>

            {/* Evidence: the competitor pages this pattern was read from */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-brand-500">
                Crawled Competitor Pages ({activeCluster.pageCount})
              </h4>
              <ul className="rounded-xl border bg-white divide-y">
                {activeCluster.sampleUrls.map((url) => (
                  <li key={url} className="flex items-center gap-2 p-3 text-xs text-brand-800">
                    <ExternalLink size={12} className="shrink-0 text-brand-400" />
                    <a href={url} target="_blank" rel="noreferrer" className="truncate font-mono hover:underline">
                      {url}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Page scaffold */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-brand-500">
                  Page Scaffold (fill in the [brackets])
                </h4>
                <button
                  type="button"
                  onClick={() => handleCopyTemplate(activeCluster.counterStrategy.sampleDeliverableTemplate)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-brand-950 hover:underline"
                >
                  {copiedTemplate ? <Check size={12} /> : <Copy size={12} />}
                  <span>{copiedTemplate ? "Copied" : "Copy Scaffold"}</span>
                </button>
              </div>
              <pre className="max-h-48 overflow-y-auto rounded-xl border bg-brand-900 p-4 font-mono text-[11px] leading-relaxed text-brand-200 whitespace-pre-wrap">
                {activeCluster.counterStrategy.sampleDeliverableTemplate}
              </pre>
            </div>

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

                {dispatchedIds.has(activeCluster.id) ? (
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
