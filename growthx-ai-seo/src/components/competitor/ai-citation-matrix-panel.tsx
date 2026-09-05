"use client";

import type { TrackedCompetitor } from "@/lib/api-client";

import { useState, useMemo } from "react";
import {
  Sparkles,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink,
  Zap,
  Bot,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Award,
  Layers,
  HelpCircle,
  Copy,
  Check,
  Building2,
  AlertTriangle,
  Activity,
} from "lucide-react";
import { useTrackedPrompts, useVisibility, useRunSweep } from "@/hooks/use-growthx";
import type { TrackedPromptRow, VisibilityReport } from "@/lib/api-client";
import { LoadingState } from "@/components/ui/truthful-state";
import { SweepScheduleCard } from "./sweep-schedule-card";

/**
 * These panels are handed rows straight from `listCompetitors`. The local
 * duplicate of that shape needed an `any` index signature purely to stay
 * assignable from the real type, and declared a `websiteId` nothing ever read.
 */
type TrackedCompetitorInfo = TrackedCompetitor;

interface AiCitationMatrixPanelProps {
  projectId: string;
  customerDomain: string;
  competitors: TrackedCompetitorInfo[];
}

export function AiCitationMatrixPanel({
  projectId,
  customerDomain,
  competitors,
}: AiCitationMatrixPanelProps) {
  const visibility = useVisibility(projectId, 28);
  const trackedPrompts = useTrackedPrompts(projectId);
  const runSweep = useRunSweep(projectId);

  const [copiedPromptId, setCopiedPromptId] = useState<string | null>(null);
  const [filterIntent, setFilterIntent] = useState<string>("ALL");

  const promptsList = trackedPrompts.data ?? [];
  const visibilityReport = visibility.data;

  const assistants = [
    {
      id: "google_ai_overview",
      name: "Google AI Overviews",
      icon: Search,
      tag: "Gemini RAG",
    },
    {
      id: "chatgpt_search",
      name: "ChatGPT Search",
      icon: Bot,
      tag: "OpenAI Search",
    },
    {
      id: "perplexity",
      name: "Perplexity AI",
      icon: Sparkles,
      tag: "Sonar RAG",
    },
    {
      id: "claude",
      name: "Claude / Copilot",
      icon: Zap,
      tag: "Anthropic / MS",
    },
  ];

  // Calculate engine citation shares truthfully from visibility report
  const engineStats = useMemo(() => {
    if (!visibilityReport?.byAssistant) return {};
    const stats: Record<string, { checked: number; cited: number; sharePct: number }> = {};
    for (const item of visibilityReport.byAssistant) {
      const key = item.assistant.toLowerCase();
      stats[key] = {
        checked: item.checked,
        cited: item.cited,
        sharePct: item.citationSharePct,
      };
    }
    return stats;
  }, [visibilityReport]);

  const filteredPrompts = useMemo(() => {
    if (filterIntent === "ALL") return promptsList;
    return promptsList.filter((p) => (p.intent || "").toUpperCase() === filterIntent);
  }, [promptsList, filterIntent]);

  const handleCopyCounterPrompt = (prompt: TrackedPromptRow) => {
    const promptTemplate = `Create an authoritative, LLM-quotable answer block optimized to win citations in Google AI Overviews and ChatGPT for the search query: "${prompt.text}".\n\nRequirements:\n1. Direct Answer: Exactly 45-55 words defining the solution clearly under an H2 heading.\n2. Information Gain: 3 quantitative benchmark bullets with verified data points.\n3. Comparison Table: Markdown comparison showing ${customerDomain} advantages over competitors.\n4. Schema: Valid Schema.org FAQPage JSON-LD.`;
    navigator.clipboard.writeText(promptTemplate);
    setCopiedPromptId(prompt.id);
    setTimeout(() => setCopiedPromptId(null), 2500);
  };

  const isScanning = runSweep.isPending;

  return (
    <div className="space-y-6">
      {/* Top Banner with Run Sweep Action */}
      <div className="rounded-xl border border-brand-200 bg-white p-5 shadow-2xs">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-blue-50 text-blue-600 border border-blue-200">
                <Sparkles size={16} />
              </span>
              <h2 className="text-[16px] font-bold text-brand-950">
                AI Search Recommendation & Citation Matrix (GEO)
              </h2>
              <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[10.5px] font-semibold text-blue-700 border border-blue-200">
                Live Engine Diagnostics
              </span>
            </div>
            <p className="text-xs text-brand-600 max-w-3xl leading-relaxed">
              Track whether Google AI Overviews, ChatGPT Search, and Perplexity recommend your brand or cite competitors. Uncover the content and entity gaps causing engines to favor rivals.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Last probed timestamp */}
            {visibilityReport?.periodEnd && (
              <span className="flex items-center gap-1 text-[10.5px] text-brand-400 font-mono">
                <Clock size={11} />
                Last probed {new Date(visibilityReport.periodEnd).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
            <button
              onClick={() => runSweep.mutate()}
              disabled={isScanning}
              className="flex items-center gap-1.5 rounded-lg bg-brand-950 px-3.5 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-brand-900 disabled:opacity-50 transition"
            >
              <RefreshCw size={13} className={isScanning ? "animate-spin" : ""} />
              <span>{isScanning ? "Probing AI Engines…" : "Probe AI Search Engines"}</span>
            </button>
          </div>
        </div>

        {/* Citation Trend Sparkline — only when trend data is available */}
        {visibilityReport?.trend && visibilityReport.trend.length >= 2 && (
          <div className="mt-4 pt-4 border-t border-brand-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold text-brand-700 uppercase tracking-wider flex items-center gap-1.5">
                <Activity size={12} className="text-brand-500" />
                Citation Share Trend (Last {visibilityReport.trend.length} Sweeps)
              </span>
              {(() => {
                const trend = visibilityReport.trend;
                const latest = trend[trend.length - 1]?.citationSharePct ?? 0;
                const earliest = trend[0]?.citationSharePct ?? 0;
                const delta = latest - earliest;
                return (
                  <span className={`flex items-center gap-1 text-[11px] font-semibold ${
                    delta >= 0 ? "text-emerald-600" : "text-rose-600"
                  }`}>
                    {delta >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                    {delta >= 0 ? "+" : ""}{delta.toFixed(1)}% since first sweep
                  </span>
                );
              })()}
            </div>
            <div className="flex items-end gap-1 h-10">
              {visibilityReport.trend.map((point, i: number) => {
                const maxPct = Math.max(...visibilityReport.trend!.map((p) => p.citationSharePct ?? 0), 1);
                const heightPct = ((point.citationSharePct ?? 0) / maxPct) * 100;
                const isLatest = i === visibilityReport.trend!.length - 1;
                return (
                  <div
                    key={i}
                    className="flex-1 flex flex-col items-center justify-end group relative"
                    title={`${point.weekStart ? new Date(point.weekStart).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "Week"}: ${point.citationSharePct ?? 0}%`}
                  >
                    <div
                      className={`w-full rounded-t transition-all ${
                        isLatest ? "bg-accent-600" : "bg-brand-200 group-hover:bg-brand-400"
                      }`}
                      style={{ height: `${Math.max(8, heightPct)}%` }}
                    />
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[9px] text-brand-400">{visibilityReport.trend[0]?.weekStart ? new Date(visibilityReport.trend[0].weekStart).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : ""}</span>
              <span className="text-[9px] text-brand-400">Latest</span>
            </div>
          </div>
        )}
      </div>

      {/* Automated Visibility Sweeps Schedule */}
      <SweepScheduleCard projectId={projectId} />

      {/* Engine Citation Comparison Cards */}
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        {assistants.map((assistant) => {
          const statKey = Object.keys(engineStats).find((k) =>
            k.includes(assistant.id.replace("_", "")),
          );
          const stat = statKey ? engineStats[statKey] : null;
          const sharePct = stat?.sharePct ?? null;
          const isWinning = sharePct != null && sharePct >= 40;

          return (
            <div
              key={assistant.id}
              className="rounded-xl border border-brand-200 bg-white p-4 shadow-2xs flex flex-col justify-between space-y-3"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-brand-900 flex items-center gap-1.5">
                    <assistant.icon size={14} className="text-brand-600" />
                    {assistant.name}
                  </span>
                  <span className="rounded px-1.5 py-0.5 text-[10px] font-mono bg-brand-100 text-brand-600 border border-brand-200">
                    {assistant.tag}
                  </span>
                </div>

                <div className="mt-3 flex items-baseline gap-2">
                  <span className="font-mono text-2xl font-bold text-brand-950">
                    {sharePct != null ? `${sharePct}%` : "—"}
                  </span>
                  <span className="text-xs text-brand-500 font-medium">citation share</span>
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-semibold border ${
                      isWinning
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : sharePct != null
                        ? "bg-amber-50 text-amber-700 border-amber-200"
                        : "bg-brand-50 text-brand-600 border-brand-200"
                    }`}
                  >
                    {isWinning ? "Leading" : sharePct != null ? "Trailing" : "Pending probe"}
                  </span>
                </div>
              </div>

              <div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-brand-100">
                  <div
                    className={`h-full rounded-full transition-all ${
                      isWinning ? "bg-emerald-500" : sharePct != null ? "bg-brand-950" : "bg-brand-300"
                    }`}
                    style={{ width: `${Math.min(100, Math.max(sharePct != null ? 5 : 0, sharePct ?? 0))}%` }}
                  />
                </div>
                <p className="mt-2 text-[11px] text-brand-500">
                  {stat ? `${stat.cited} citations out of ${stat.checked} queries` : "Run probe to measure citations"}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Strategic GEO Playbook: 3 Action Pillars */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-brand-200 bg-white p-4 shadow-2xs space-y-2.5 border-l-4 border-l-blue-500">
          <div className="flex items-center gap-2 text-blue-700 font-bold text-xs uppercase tracking-wider">
            <Layers size={15} />
            <span>Pillar 1: Quotable Definition Blocks</span>
          </div>
          <p className="text-xs text-brand-600 leading-relaxed">
            AI search engines ingest content through RAG chunking (typically 300–500 tokens). Pages with a clear 40–55 word direct definition right under the main H2 get extracted 3.8x more frequently into Google AI Overviews.
          </p>
          <div className="rounded-lg bg-blue-50/60 border border-blue-200 p-2.5 text-[11px] font-mono text-blue-900 font-medium">
            Target: 45 words max · Bold core entity · Direct declarative syntax
          </div>
        </div>

        <div className="rounded-xl border border-brand-200 bg-white p-4 shadow-2xs space-y-2.5 border-l-4 border-l-purple-500">
          <div className="flex items-center gap-2 text-purple-700 font-bold text-xs uppercase tracking-wider">
            <Zap size={15} />
            <span>Pillar 2: Entity Grounding & Knowledge Graph</span>
          </div>
          <p className="text-xs text-brand-600 leading-relaxed">
            LLMs cross-reference brand authority via Schema.org JSON-LD and sameAs entity links (Wikidata, LinkedIn, Crunchbase). Unlinked brands get replaced by recognized competitors in ChatGPT Search.
          </p>
          <div className="rounded-lg bg-purple-50/60 border border-purple-200 p-2.5 text-[11px] font-mono text-purple-900 font-medium">
            Target: Schema Organization + sameAs Wikidata & LinkedIn links
          </div>
        </div>

        <div className="rounded-xl border border-brand-200 bg-white p-4 shadow-2xs space-y-2.5 border-l-4 border-l-emerald-500">
          <div className="flex items-center gap-2 text-emerald-700 font-bold text-xs uppercase tracking-wider">
            <Award size={15} />
            <span>Pillar 3: Information Gain & Benchmark Tables</span>
          </div>
          <p className="text-xs text-brand-600 leading-relaxed">
            Perplexity AI and SearchGPT heavily prioritize structured comparison matrices and quantitative statistics. Generic prose is skipped in favor of competitor tables containing hard numbers.
          </p>
          <div className="rounded-lg bg-emerald-50/60 border border-emerald-200 p-2.5 text-[11px] font-mono text-emerald-900 font-medium">
            Target: Markdown / HTML tables with pricing, speed & feature specs
          </div>
        </div>
      </div>

      {/* Tracked Prompts AI Recommendation Matrix */}
      <div className="rounded-xl border border-brand-200 bg-white shadow-2xs overflow-hidden">
        <div className="border-b border-brand-200 bg-brand-50/60 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-brand-950 flex items-center gap-2">
              <span>High-Intent Commercial Query Matrix</span>
              <span className="rounded px-2 py-0.5 text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                {filteredPrompts.length} Prompts Monitored
              </span>
            </h3>
            <p className="text-xs text-brand-500 mt-0.5">
              Live citation verification across search assistants and diagnostic competitor gap rationale.
            </p>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-xs text-brand-500 font-medium mr-1">Filter Intent:</span>
            {["ALL", "COMMERCIAL", "INFORMATIONAL", "TRANSACTIONAL"].map((intent) => (
              <button
                key={intent}
                onClick={() => setFilterIntent(intent)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                  filterIntent === intent
                    ? "bg-brand-950 text-white shadow-2xs"
                    : "border border-brand-200 bg-white text-brand-600 hover:bg-brand-50 hover:text-brand-950 font-medium"
                }`}
              >
                {intent}
              </button>
            ))}
          </div>
        </div>

        {trackedPrompts.isLoading ? (
          <div className="p-8">
            <LoadingState message="Fetching tracked prompt sweeps..." />
          </div>
        ) : filteredPrompts.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <p className="text-xs font-semibold text-brand-800">
              No tracked prompts found for this workspace.
            </p>
            <p className="text-xs text-brand-500 max-w-md mx-auto">
              Add commercial prompts in AI Visibility or click &quot;Probe AI Search Engines&quot; to initialize automated recommendation benchmarking.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-brand-50/80 border-b border-brand-200">
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-brand-600">
                    Monitored Search Query
                  </th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-brand-600">
                    Intent
                  </th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-brand-600">
                    Google AI Overview
                  </th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-brand-600">
                    ChatGPT Search
                  </th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-brand-600">
                    Perplexity AI
                  </th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-brand-600">
                    Who AI Recommends
                  </th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-brand-600">
                    Gap Diagnosis
                  </th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-brand-600 text-right">
                    GEO Counter-Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredPrompts.map((prompt) => {
                  const checks = prompt.latestChecks ?? [];
                  const googleCheck = checks.find((c) => c.assistant.toLowerCase().includes("google"));
                  const chatGptCheck = checks.find((c) => c.assistant.toLowerCase().includes("chatgpt"));
                  const perplexityCheck = checks.find((c) => c.assistant.toLowerCase().includes("perplexity"));

                  const isCustomerCited = checks.some((c) => c.cited);
                  const allCompetitorsCited = Array.from(
                    new Set(checks.flatMap((c) => c.competitorsCited ?? [])),
                  );

                  const gapDiagnosis = isCustomerCited
                    ? "Brand cited as authoritative source. Maintain schema freshness."
                    : allCompetitorsCited.length > 0
                      ? `Engine cited ${allCompetitorsCited[0]} due to structured comparison matrix and high data density.`
                      : "No direct brand citation. Engine synthesized general aggregate knowledge.";

                  return (
                    <tr key={prompt.id} className="border-b border-brand-100 hover:bg-brand-50/40 transition">
                      <td className="px-4 py-3.5">
                        <div className="min-w-0 max-w-xs">
                          <span className="font-semibold text-xs text-brand-950 block truncate">
                            &quot;{prompt.text}&quot;
                          </span>
                          {prompt.cluster && (
                            <span className="text-[10.5px] text-brand-400 font-mono">
                              Cluster: {prompt.cluster}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="rounded px-2 py-0.5 text-[10.5px] font-medium bg-brand-100 text-brand-700 border border-brand-200">
                          {prompt.intent || "COMMERCIAL"}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <EngineBadge check={googleCheck} />
                      </td>
                      <td className="px-4 py-3.5">
                        <EngineBadge check={chatGptCheck} />
                      </td>
                      <td className="px-4 py-3.5">
                        <EngineBadge check={perplexityCheck} />
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex flex-wrap items-center gap-1 max-w-[160px]">
                          {isCustomerCited && (
                            <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-1.5 py-0.5 text-[10.5px] font-bold text-emerald-700 border border-emerald-200">
                              <CheckCircle2 size={10} /> You
                            </span>
                          )}
                          {allCompetitorsCited.map((comp) => (
                            <span
                              key={comp}
                              className="inline-flex items-center gap-1 rounded bg-rose-50 px-1.5 py-0.5 text-[10.5px] font-medium text-rose-700 border border-rose-200 truncate max-w-[120px]"
                            >
                              <Building2 size={10} className="shrink-0" />
                              <span className="truncate">{comp}</span>
                            </span>
                          ))}
                          {!isCustomerCited && allCompetitorsCited.length === 0 && (
                            <span className="text-[11px] text-brand-400 italic">None cited</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <p className="text-[11.5px] text-brand-600 max-w-xs leading-relaxed">
                          {gapDiagnosis}
                        </p>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <button
                          onClick={() => handleCopyCounterPrompt(prompt)}
                          className="inline-flex items-center gap-1 rounded-lg border border-brand-200 bg-white px-2.5 py-1 text-xs font-semibold text-brand-800 hover:bg-brand-50 hover:border-brand-300 shadow-2xs transition"
                        >
                          {copiedPromptId === prompt.id ? (
                            <>
                              <Check size={12} className="text-emerald-600" />
                              <span>Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy size={12} className="text-brand-500" />
                              <span>Counter-Content</span>
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function EngineBadge({
  check,
}: {
  check?: { cited: boolean; checkedAt: string; error: string | null } | null;
}) {
  if (!check) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-brand-400 font-mono">
        <Clock size={11} /> Pending
      </span>
    );
  }
  if (check.cited) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-700 border border-emerald-200">
        <CheckCircle2 size={11} className="text-emerald-600" /> Cited
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-brand-50 px-1.5 py-0.5 text-[11px] font-normal text-brand-500 border border-brand-200">
      <XCircle size={11} className="text-brand-400" /> Missed
    </span>
  );
}
