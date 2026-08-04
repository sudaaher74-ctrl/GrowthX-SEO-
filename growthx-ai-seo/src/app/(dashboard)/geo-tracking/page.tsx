"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { Info, Loader2, Plus, RefreshCw, Sparkles } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { QueryState } from "@/components/ui/upgrade-prompt";
import { cn } from "@/lib/utils";
import { useAddPrompts, useRunSweep, useTrackedPrompts, useVisibility, useWorkspace } from "@/hooks/use-growthx";

const ASSISTANT_LABEL: Record<string, string> = {
  CHATGPT: "ChatGPT",
  CLAUDE: "Claude",
  GEMINI: "Gemini",
  PERPLEXITY: "Perplexity",
  AI_OVERVIEWS: "Google AI Overviews",
  COPILOT: "Copilot",
};

export default function GeoTrackingPage() {
  const { projectId } = useWorkspace();
  const visibility = useVisibility(projectId);
  const prompts = useTrackedPrompts(projectId);
  const addPrompts = useAddPrompts(projectId);
  const sweep = useRunSweep(projectId);
  const [draft, setDraft] = useState("");

  const summary = visibility.data?.summary;
  const delta = summary?.deltaPt;

  async function handleAdd() {
    const lines = draft
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    if (!lines.length) return;
    await addPrompts.mutateAsync(lines.map((text) => ({ text })));
    setDraft("");
  }

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"
      >
        <div>
          <h1 className="text-h1 text-[var(--text-primary)]">AI Visibility</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Whether AI assistants recommend you when your buyers ask.
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          icon={sweep.isPending ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
          onClick={() => sweep.mutate()}
          disabled={sweep.isPending || !projectId}
        >
          {sweep.isPending ? "Checking…" : "Run checks now"}
        </Button>
      </motion.div>

      {sweep.data && (
        <div className="rounded-xl border border-[var(--border-color)] bg-[var(--surface-1)] p-3 text-sm text-[var(--text-secondary)]">
          {sweep.data.checksRun} checks ran · {sweep.data.citations} citations ·{" "}
          {sweep.data.checksFailed} failed
          {sweep.data.skippedAssistants.length > 0 && (
            <span className="text-[var(--text-muted)]">
              {" "}
              · skipped {sweep.data.skippedAssistants.map((a) => ASSISTANT_LABEL[a] ?? a).join(", ")}
            </span>
          )}
        </div>
      )}

      <QueryState
        isLoading={visibility.isLoading}
        error={visibility.error}
        isEmpty={!summary || summary.checked === 0}
        emptyTitle="No citation data yet"
        emptyBody="Add the questions your buyers ask, then run the checks. Results appear here and refresh daily."
      >
        {/* KPI row */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            {
              label: "Citation share",
              value: `${summary?.citationSharePct ?? 0}%`,
              sub:
                delta === null || delta === undefined
                  ? "no prior period"
                  : `${delta >= 0 ? "+" : ""}${delta}pt vs previous`,
              good: (delta ?? 0) >= 0,
            },
            {
              label: "Avg position",
              value: summary?.averagePosition?.toFixed(1) ?? "—",
              sub: "when you are cited",
              good: true,
            },
            {
              label: "Checks run",
              value: String(summary?.checked ?? 0),
              sub: `${summary?.cited ?? 0} citations`,
              good: true,
            },
            {
              label: "Failed checks",
              value: String(summary?.failedChecks ?? 0),
              sub: "excluded from the rate",
              good: (summary?.failedChecks ?? 0) === 0,
            },
          ].map((kpi) => (
            <div key={kpi.label} className="rounded-xl border border-[var(--border-color)] bg-[var(--surface-1)] p-4">
              <p className="text-xs text-[var(--text-muted)]">{kpi.label}</p>
              <p className="mt-1 text-2xl font-semibold text-[var(--text-primary)]">{kpi.value}</p>
              <p className={cn("mt-1 text-xs", kpi.good ? "text-emerald-500" : "text-amber-500")}>{kpi.sub}</p>
            </div>
          ))}
        </div>

        {/* Measurability caveat — stated, never implied */}
        <div className="flex items-start gap-2 rounded-xl border border-[var(--border-color)] bg-[var(--surface-2)] p-3 text-xs text-[var(--text-muted)]">
          <Info size={14} className="mt-0.5 shrink-0" />
          <span>
            Measured directly on{" "}
            <strong className="text-[var(--text-secondary)]">
              {visibility.data?.measurableAssistants.map((a) => ASSISTANT_LABEL[a] ?? a).join(", ")}
            </strong>
            . Google AI Overviews, Perplexity and Copilot have no public API, so they are not scored —
            they are excluded from the percentages above rather than counted as zero.
          </span>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {/* Per assistant */}
          <div className="rounded-xl border border-[var(--border-color)] bg-[var(--surface-1)] p-4">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Citation share by assistant</h2>
            <div className="mt-4 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={visibility.data?.byAssistant.map((a) => ({
                    name: ASSISTANT_LABEL[a.assistant] ?? a.assistant,
                    share: a.citationSharePct,
                  }))}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis unit="%" tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => `${v}%`} />
                  <Bar dataKey="share" fill="#2563eb" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Trend */}
          <div className="rounded-xl border border-[var(--border-color)] bg-[var(--surface-1)] p-4">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Citation share trend</h2>
            <div className="mt-4 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={visibility.data?.trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                  <XAxis dataKey="weekStart" tick={{ fontSize: 11 }} />
                  <YAxis unit="%" tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => `${v}%`} />
                  <Line type="monotone" dataKey="citationSharePct" stroke="#2563eb" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Share of voice */}
        <div className="rounded-xl border border-[var(--border-color)] bg-[var(--surface-1)] p-4">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">Share of voice</h2>
          <div className="mt-4 space-y-2">
            {visibility.data?.shareOfVoice.map((row) => (
              <div key={row.label} className="flex items-center gap-3">
                <span
                  className={cn(
                    "w-40 shrink-0 truncate text-sm",
                    row.domain === null
                      ? "font-semibold text-[var(--text-primary)]"
                      : "text-[var(--text-secondary)]",
                  )}
                >
                  {row.label}
                </span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--surface-2)]">
                  <div
                    className={cn("h-full rounded-full", row.domain === null ? "bg-blue-500" : "bg-zinc-500")}
                    style={{ width: `${row.sharePct}%` }}
                  />
                </div>
                <span className="w-14 text-right font-mono text-xs text-[var(--text-muted)]">
                  {row.sharePct}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </QueryState>

      {/* Tracked prompts */}
      <section>
        <h2 className="text-h3 text-[var(--text-primary)]">Tracked prompts</h2>

        <div className="mt-3 rounded-xl border border-[var(--border-color)] bg-[var(--surface-1)] p-4">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            placeholder={"One question per line, e.g.\nbest insulated jacket for winter hiking\nnorthwind vs trailhead"}
            className="w-full resize-y rounded-lg border border-[var(--border-color)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text-primary)]"
          />
          <div className="mt-2 flex justify-end">
            <Button
              variant="secondary"
              size="sm"
              icon={<Plus size={13} />}
              onClick={handleAdd}
              disabled={addPrompts.isPending || !draft.trim()}
            >
              {addPrompts.isPending ? "Adding…" : "Add prompts"}
            </Button>
          </div>
          {addPrompts.error && (
            <p className="mt-2 text-sm text-red-400">{(addPrompts.error as Error).message}</p>
          )}
        </div>

        <QueryState
          isLoading={prompts.isLoading}
          error={prompts.error}
          isEmpty={!prompts.data?.length}
          emptyTitle="No prompts tracked yet"
          emptyBody="Add the questions your customers actually type into ChatGPT or Gemini."
        >
          <div className="mt-3 overflow-x-auto rounded-xl border border-[var(--border-color)]">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-[var(--surface-2)] text-left text-xs text-[var(--text-muted)]">
                <tr>
                  <th className="px-4 py-2 font-medium">Prompt</th>
                  <th className="px-4 py-2 font-medium">Latest results</th>
                </tr>
              </thead>
              <tbody>
                {prompts.data?.map((prompt) => (
                  <tr key={prompt.id} className="border-t border-[var(--border-color)]">
                    <td className="px-4 py-3 text-[var(--text-secondary)]">{prompt.text}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {prompt.latestChecks.length === 0 && (
                          <span className="text-xs text-[var(--text-muted)]">not checked yet</span>
                        )}
                        {prompt.latestChecks.map((check, i) => (
                          <Badge
                            key={`${check.assistant}-${i}`}
                            variant={check.error ? "default" : check.cited ? "success" : "error"}
                          >
                            {ASSISTANT_LABEL[check.assistant] ?? check.assistant}
                            {check.error ? " · n/a" : check.cited ? ` · #${check.position ?? "?"}` : " · not cited"}
                          </Badge>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </QueryState>
      </section>
    </div>
  );
}
