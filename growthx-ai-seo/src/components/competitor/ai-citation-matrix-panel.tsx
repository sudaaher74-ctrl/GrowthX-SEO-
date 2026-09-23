"use client";

import type { TrackedCompetitor, TrackedPromptRow } from "@/lib/api-client";

import { useState, useMemo } from "react";
import {
  Sparkles,
  CheckCircle2,
  XCircle,
  Clock,
  Zap,
  Bot,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Award,
  Layers,
  Copy,
  Check,
  Building2,
  Activity,
  AlertTriangle,
} from "lucide-react";
import { useTrackedPrompts, useVisibility, useRunSweep } from "@/hooks/use-growthx";
import { LoadingState } from "@/components/ui/truthful-state";
import { assistantLabel, assistantList } from "@/lib/ai-assistants";
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

type LatestCheck = TrackedPromptRow["latestChecks"][number];

/** Latest check per assistant (rows arrive newest first). */
function latestByAssistant(row: TrackedPromptRow): Map<string, LatestCheck> {
  const map = new Map<string, LatestCheck>();
  for (const check of row.latestChecks ?? []) {
    if (!map.has(check.assistant)) map.set(check.assistant, check);
  }
  return map;
}

export function AiCitationMatrixPanel({ projectId, customerDomain }: AiCitationMatrixPanelProps) {
  const visibility = useVisibility(projectId, 28);
  const trackedPrompts = useTrackedPrompts(projectId);
  const runSweep = useRunSweep(projectId);

  const [copiedPromptId, setCopiedPromptId] = useState<string | null>(null);
  const [filterIntent, setFilterIntent] = useState<string>("ALL");

  const promptsList = useMemo(() => trackedPrompts.data ?? [], [trackedPrompts.data]);
  const visibilityReport = visibility.data;

  // Only the assistants this deployment actually asks; each card and column
  // is one of them, never a vendor that was never queried.
  const assistants = visibilityReport?.measurableAssistants ?? [];

  // When a check last ran — the report's period end is "now", not a probe time.
  const lastChecked = useMemo(() => {
    const times = promptsList.flatMap((p) => (p.latestChecks ?? []).map((c) => new Date(c.checkedAt).getTime()));
    return times.length > 0 ? new Date(Math.max(...times)) : null;
  }, [promptsList]);

  const filteredPrompts = useMemo(() => {
    if (filterIntent === "ALL") return promptsList;
    return promptsList.filter((p) => (p.intent || "").toUpperCase() === filterIntent);
  }, [promptsList, filterIntent]);

  const handleCopyCounterPrompt = (prompt: TrackedPromptRow) => {
    const promptTemplate = `Write an answer block for ${customerDomain} that directly answers the search query: "${prompt.text}".\n\nRequirements:\n1. Direct answer: 45-55 words under an H2 heading.\n2. Facts: use only facts about ${customerDomain} that you can verify. Where a number or proof point is needed, leave a [placeholder] instead of inventing one.\n3. Comparison: an honest comparison table against the competitors named for this query, without claims you cannot support.\n4. Schema: valid Schema.org FAQPage JSON-LD.`;
    navigator.clipboard.writeText(promptTemplate);
    setCopiedPromptId(prompt.id);
    setTimeout(() => setCopiedPromptId(null), 2500);
  };

  const isScanning = runSweep.isPending;

  return (
    <div className="space-y-6">
      {/* Top Banner with Run Sweep Action */}
      <div className="rounded-xl border bg-white p-5 shadow-2xs">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-accent-50 text-accent-600 border">
                <Sparkles size={16} />
              </span>
              <h2 className="text-[16px] font-bold text-brand-950">AI Search Recommendation & Citation Matrix (GEO)</h2>
            </div>
            <p className="text-xs text-brand-600 max-w-3xl leading-relaxed">
              {assistants.length > 0
                ? `Track whether ${assistantList(assistants)} recommends your brand or names competitors for your tracked questions.`
                : "No AI assistant is enabled on this deployment, so citations cannot be measured yet."}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {lastChecked && (
              <span className="flex items-center gap-1 text-[10.5px] text-brand-400 font-mono">
                <Clock size={11} />
                Last checked{" "}
                {lastChecked.toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
            <button
              onClick={() => runSweep.mutate()}
              disabled={isScanning || assistants.length === 0}
              className="flex items-center gap-1.5 rounded-lg bg-brand-950 px-3.5 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-brand-900 disabled:opacity-50 transition"
            >
              <RefreshCw size={13} className={isScanning ? "animate-spin" : ""} />
              <span>{isScanning ? `Asking ${assistantList(assistants)}…` : "Run AI Visibility Check"}</span>
            </button>
          </div>
        </div>

        {/* Citation Trend — only when trend data is available */}
        {visibilityReport?.trend && visibilityReport.trend.length >= 2 && (
          <div className="mt-4 pt-4 border-t">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold text-brand-700 uppercase tracking-wider flex items-center gap-1.5">
                <Activity size={12} className="text-brand-500" />
                Citation Share Trend (Last {visibilityReport.trend.length} Weeks)
              </span>
              {(() => {
                const trend = visibilityReport.trend;
                const latest = trend[trend.length - 1]?.citationSharePct ?? 0;
                const earliest = trend[0]?.citationSharePct ?? 0;
                const delta = latest - earliest;
                return (
                  <span
                    className={`flex items-center gap-1 text-[11px] font-semibold ${
                      delta >= 0 ? "text-success-600" : "text-error-600"
                    }`}
                  >
                    {delta >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                    {delta >= 0 ? "+" : ""}
                    {delta.toFixed(1)} pts since first week
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
              <span className="text-[9px] text-brand-400">
                {visibilityReport.trend[0]?.weekStart
                  ? new Date(visibilityReport.trend[0].weekStart).toLocaleDateString(undefined, { month: "short", day: "numeric" })
                  : ""}
              </span>
              <span className="text-[9px] text-brand-400">Latest</span>
            </div>
          </div>
        )}
      </div>

      {/* Automated Visibility Sweeps Schedule */}
      <SweepScheduleCard projectId={projectId} />

      {/* One card per assistant this deployment actually asks */}
      {assistants.length > 0 && (
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          {assistants.map((assistant) => {
            const stat = visibilityReport?.byAssistant?.find((a) => a.assistant === assistant);
            const measured = Boolean(stat && stat.checked > 0);
            const sharePct = measured ? stat!.citationSharePct : null;
            const isWinning = sharePct != null && sharePct >= 40;

            return (
              <div key={assistant} className="rounded-xl border bg-white p-4 shadow-2xs flex flex-col justify-between space-y-3">
                <div>
                  <span className="text-xs font-semibold text-brand-900 flex items-center gap-1.5">
                    <Bot size={14} className="text-brand-600" />
                    {assistantLabel(assistant)}
                  </span>

                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="font-mono text-2xl font-bold text-brand-950">
                      {sharePct != null ? `${sharePct}%` : "—"}
                    </span>
                    <span className="text-xs text-brand-500 font-medium">citation share</span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-semibold border ${
                        isWinning
                          ? "bg-success-50 text-success-700"
                          : sharePct != null
                            ? "bg-warning-50 text-warning-700"
                            : "bg-brand-50 text-brand-600"
                      }`}
                    >
                      {isWinning ? "Leading" : sharePct != null ? "Trailing" : "Not measured yet"}
                    </span>
                  </div>
                </div>

                <div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-brand-100">
                    <div
                      className={`h-full rounded-full transition-all ${isWinning ? "bg-success-500" : "bg-brand-950"}`}
                      style={{ width: `${sharePct != null ? Math.min(100, Math.max(5, sharePct)) : 0}%` }}
                    />
                  </div>
                  <p className="mt-2 text-[11px] text-brand-500">
                    {measured
                      ? `Cited in ${stat!.cited} of ${stat!.checked} answers (last 28 days)`
                      : "Run a check to measure citations"}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* GEO playbook — general guidance, not a measurement */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-xl border bg-white p-4 shadow-2xs space-y-2.5 border-l-4 border-l-accent-500">
          <div className="flex items-center gap-2 text-accent-700 font-bold text-xs uppercase tracking-wider">
            <Layers size={15} />
            <span>Pillar 1: Quotable Definition Blocks</span>
          </div>
          <p className="text-xs text-brand-600 leading-relaxed">
            AI answers are assembled from passages of your pages. A clear 40–55 word direct answer right under the main
            heading gives an assistant a self-contained passage it can quote.
          </p>
          <div className="rounded-lg bg-accent-50 border p-2.5 text-[11px] font-mono text-accent-700 font-medium">
            Target: ~45 words · Name the entity · Direct declarative syntax
          </div>
        </div>

        <div className="rounded-xl border bg-white p-4 shadow-2xs space-y-2.5 border-l-4 border-l-brand-950">
          <div className="flex items-center gap-2 text-brand-900 font-bold text-xs uppercase tracking-wider">
            <Zap size={15} />
            <span>Pillar 2: Entity Grounding</span>
          </div>
          <p className="text-xs text-brand-600 leading-relaxed">
            Organization schema with sameAs links (LinkedIn, Wikidata, directories) makes it easier for AI systems to
            recognise your brand as the same entity across the web.
          </p>
          <div className="rounded-lg bg-brand-50 border p-2.5 text-[11px] font-mono text-brand-950 font-medium">
            Target: Schema Organization + sameAs profile links
          </div>
        </div>

        <div className="rounded-xl border bg-white p-4 shadow-2xs space-y-2.5 border-l-4 border-l-success-500">
          <div className="flex items-center gap-2 text-success-700 font-bold text-xs uppercase tracking-wider">
            <Award size={15} />
            <span>Pillar 3: Specific, Checkable Facts</span>
          </div>
          <p className="text-xs text-brand-600 leading-relaxed">
            Concrete, verifiable details — pricing, specifications, service areas — in tables are easier to quote than
            general prose. Publish only facts you can stand behind.
          </p>
          <div className="rounded-lg bg-success-50 border p-2.5 text-[11px] font-mono text-success-700 font-medium">
            Target: Tables with real pricing, specs & coverage
          </div>
        </div>
      </div>

      {/* Tracked Prompts AI Recommendation Matrix */}
      <div className="rounded-xl border bg-white shadow-2xs overflow-hidden">
        <div className="border-b bg-brand-50/60 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-brand-950 flex items-center gap-2">
              <span>Tracked Query Matrix</span>
              <span className="rounded px-2 py-0.5 text-[11px] font-bold bg-accent-50 text-accent-700 border">
                {filteredPrompts.length} Prompts Monitored
              </span>
            </h3>
            <p className="text-xs text-brand-500 mt-0.5">
              The latest measured answer for each tracked question, and who it named.
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
                    : "border bg-white text-brand-600 hover:bg-brand-50 hover:text-brand-950 font-medium"
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
            <p className="text-xs font-semibold text-brand-800">No tracked prompts found for this workspace.</p>
            <p className="text-xs text-brand-500 max-w-md mx-auto">
              Add questions in AI Visibility, then run a check to see which brands the answers name.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-brand-50/80 border-b">
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-brand-600">
                    Monitored Search Query
                  </th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-brand-600">Intent</th>
                  {assistants.map((assistant) => (
                    <th key={assistant} className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-brand-600">
                      {assistantLabel(assistant)}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-brand-600">
                    Who AI Recommends
                  </th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-brand-600">
                    What Happened
                  </th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-brand-600 text-right">
                    GEO Counter-Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredPrompts.map((prompt) => {
                  const byAssistant = latestByAssistant(prompt);
                  const answered = Array.from(byAssistant.values()).filter((c) => !c.error);

                  const isCustomerCited = answered.some((c) => c.cited);
                  const allCompetitorsCited = Array.from(new Set(answered.flatMap((c) => c.competitorsCited ?? [])));

                  // What the answer actually showed. The answer is stored, not
                  // the reason behind it, so no cause is claimed.
                  const outcome =
                    answered.length === 0
                      ? byAssistant.size > 0
                        ? "The last check could not run."
                        : "Not checked yet."
                      : isCustomerCited
                        ? allCompetitorsCited.length > 0
                          ? `Cited you, alongside ${allCompetitorsCited.join(", ")}.`
                          : "Cited you."
                        : allCompetitorsCited.length > 0
                          ? `Named ${allCompetitorsCited.join(", ")} instead of you.`
                          : "Named no tracked brand, including yours.";

                  return (
                    <tr key={prompt.id} className="border-b hover:bg-brand-50/40 transition">
                      <td className="px-4 py-3.5">
                        <div className="min-w-0 max-w-xs">
                          <span className="font-semibold text-xs text-brand-950 block truncate">&quot;{prompt.text}&quot;</span>
                          {prompt.cluster && (
                            <span className="text-[10.5px] text-brand-400 font-mono">Cluster: {prompt.cluster}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        {prompt.intent ? (
                          <span className="rounded px-2 py-0.5 text-[10.5px] font-medium bg-brand-100 text-brand-700 border">
                            {prompt.intent}
                          </span>
                        ) : (
                          <span className="text-[11px] text-brand-400">—</span>
                        )}
                      </td>
                      {assistants.map((assistant) => (
                        <td key={assistant} className="px-4 py-3.5">
                          <EngineBadge check={byAssistant.get(assistant)} />
                        </td>
                      ))}
                      <td className="px-4 py-3.5">
                        <div className="flex flex-wrap items-center gap-1 max-w-[160px]">
                          {isCustomerCited && (
                            <span className="inline-flex items-center gap-1 rounded bg-success-50 px-1.5 py-0.5 text-[10.5px] font-bold text-success-700 border">
                              <CheckCircle2 size={10} /> You
                            </span>
                          )}
                          {allCompetitorsCited.map((comp) => (
                            <span
                              key={comp}
                              className="inline-flex items-center gap-1 rounded bg-error-50 px-1.5 py-0.5 text-[10.5px] font-medium text-error-700 border truncate max-w-[120px]"
                            >
                              <Building2 size={10} className="shrink-0" />
                              <span className="truncate">{comp}</span>
                            </span>
                          ))}
                          {answered.length > 0 && !isCustomerCited && allCompetitorsCited.length === 0 && (
                            <span className="text-[11px] text-brand-400 italic">None cited</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <p className="text-[11.5px] text-brand-600 max-w-xs leading-relaxed">{outcome}</p>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <button
                          onClick={() => handleCopyCounterPrompt(prompt)}
                          className="inline-flex items-center gap-1 rounded-lg border bg-white px-2.5 py-1 text-xs font-semibold text-brand-800 hover:bg-brand-50 shadow-2xs transition"
                        >
                          {copiedPromptId === prompt.id ? (
                            <>
                              <Check size={12} className="text-success-600" />
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

function EngineBadge({ check }: { check?: LatestCheck }) {
  if (!check) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-brand-400 font-mono">
        <Clock size={11} /> Not checked
      </span>
    );
  }
  // A check that could not run is not a miss.
  if (check.error) {
    return (
      <span title={check.error} className="inline-flex items-center gap-1 text-[11px] text-warning-700">
        <AlertTriangle size={11} /> Could not ask
      </span>
    );
  }
  if (check.cited) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-success-50 px-1.5 py-0.5 text-[11px] font-semibold text-success-700 border">
        <CheckCircle2 size={11} className="text-success-600" /> Cited
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-brand-50 px-1.5 py-0.5 text-[11px] font-normal text-brand-500 border">
      <XCircle size={11} className="text-brand-400" /> Not cited
    </span>
  );
}
