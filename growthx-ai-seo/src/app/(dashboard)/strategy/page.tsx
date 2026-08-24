"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { Loader2, Sparkles, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useGenerateStrategy, useStrategies, useStrategy, useWorkspace } from "@/hooks/use-growthx";
import { QueryState } from "@/components/ui/query-state";

const HORIZON_ORDER = ["30-day", "60-day", "90-day"];

export default function StrategyPage() {
  const { projectId } = useWorkspace();
  const strategies = useStrategies(projectId);
  const generate = useGenerateStrategy(projectId);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const activeId = selectedId ?? strategies.data?.[0]?.id ?? null;
  const report = useStrategy(projectId, activeId);
  const content = report.data?.content;

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"
      >
        <div>
          <h1 className="text-h1 text-[var(--text-primary)]">Growth Strategy</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Market read, SEO roadmap, content plan and social strategy — built from your crawl and AI
            visibility data.
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          icon={generate.isPending ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
          onClick={() => generate.mutate()}
          disabled={generate.isPending || !projectId}
        >
          {generate.isPending ? "Analysing…" : "Generate strategy"}
        </Button>
      </motion.div>

      {generate.error && (
        <QueryState error={generate.error}>
          <></>
        </QueryState>
      )}

      {/* History selector */}
      {(strategies.data?.length ?? 0) > 1 && (
        <div className="flex flex-wrap gap-2">
          {strategies.data?.map((s) => (
            <button
              key={s.id}
              onClick={() => setSelectedId(s.id)}
              className={`rounded-full border px-3 py-1 text-xs ${
                s.id === activeId
                  ? "border-blue-500 bg-blue-500/10 text-blue-400"
                  : "border-[var(--border-color)] text-[var(--text-muted)]"
              }`}
            >
              {new Date(s.createdAt).toLocaleDateString()}
            </button>
          ))}
        </div>
      )}

      <QueryState
        isLoading={strategies.isLoading || report.isLoading}
        error={strategies.error ?? report.error}
        isEmpty={!content}
        emptyTitle="No strategy generated yet"
        emptyBody="Crawl your site and track a few prompts first — the plan is built from that evidence, so richer data means a sharper plan."
      >
        {content && (
          <div className="space-y-6">
            {/* Summary + market */}
            <section className="rounded-2xl border border-[var(--border-color)] bg-[var(--surface-1)] p-6">
              <div className="flex items-center gap-2">
                <Target size={16} className="text-blue-500" />
                <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                  Market analysis
                </h2>
                {report.data?.generatedByModel && (
                  <Badge variant="default">{report.data.generatedByModel}</Badge>
                )}
              </div>

              <p className="mt-3 text-base text-[var(--text-primary)]">{content.businessSummary}</p>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <Field label="Positioning" value={content.marketAnalysis.positioning} />
                <Field label="Target audience" value={content.marketAnalysis.targetAudience} />
                <List label="Demand signals" items={content.marketAnalysis.demandSignals} />
                <List label="Competitive threats" items={content.marketAnalysis.competitiveThreats} />
              </div>
            </section>

            {/* SEO roadmap */}
            <section>
              <h2 className="text-h3 text-[var(--text-primary)]">SEO roadmap</h2>
              <div className="mt-3 grid gap-4 lg:grid-cols-3">
                {HORIZON_ORDER.map((horizon) => {
                  const items = content.seoRoadmap.filter((r) => r.horizon === horizon);
                  if (!items.length) return null;
                  return (
                    <div
                      key={horizon}
                      className="rounded-xl border border-[var(--border-color)] bg-[var(--surface-1)] p-4"
                    >
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                        {horizon}
                      </h3>
                      <ul className="mt-3 space-y-4">
                        {items.map((item, i) => (
                          <li key={i}>
                            <p className="text-sm font-medium text-[var(--text-primary)]">{item.action}</p>
                            <p className="mt-1 text-xs text-[var(--text-muted)]">{item.why}</p>
                            <div className="mt-2 flex gap-2">
                              <Badge variant="default">{item.effort} effort</Badge>
                              <Badge variant="success">{item.expectedImpact}</Badge>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Content plan */}
            <section>
              <h2 className="text-h3 text-[var(--text-primary)]">Content plan</h2>
              <div className="mt-3 overflow-x-auto rounded-xl border border-[var(--border-color)]">
                <table className="w-full min-w-[640px] text-sm">
                  <thead className="bg-[var(--surface-2)] text-left text-xs text-[var(--text-muted)]">
                    <tr>
                      <th className="px-4 py-2 font-medium">Piece</th>
                      <th className="px-4 py-2 font-medium">Format</th>
                      <th className="px-4 py-2 font-medium">Target query</th>
                      <th className="px-4 py-2 font-medium">Why</th>
                    </tr>
                  </thead>
                  <tbody>
                    {content.contentPlan.map((piece, i) => (
                      <tr key={i} className="border-t border-[var(--border-color)]">
                        <td className="px-4 py-3 font-medium text-[var(--text-primary)]">{piece.title}</td>
                        <td className="px-4 py-3 text-[var(--text-secondary)]">{piece.format}</td>
                        <td className="px-4 py-3 font-mono text-xs text-[var(--text-secondary)]">
                          {piece.targetQuery}
                        </td>
                        <td className="px-4 py-3 text-xs text-[var(--text-muted)]">{piece.why}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Social */}
            <section>
              <h2 className="text-h3 text-[var(--text-primary)]">Social media strategy</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {content.socialStrategy.map((channel, i) => (
                  <div
                    key={i}
                    className="rounded-xl border border-[var(--border-color)] bg-[var(--surface-1)] p-4"
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-[var(--text-primary)]">{channel.platform}</h3>
                      <Badge variant="default">{channel.cadence}</Badge>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {channel.contentThemes.map((theme) => (
                        <span
                          key={theme}
                          className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-xs text-[var(--text-secondary)]"
                        >
                          {theme}
                        </span>
                      ))}
                    </div>
                    <p className="mt-3 text-xs text-[var(--text-muted)]">{channel.why}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </QueryState>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-[var(--text-muted)]">{label}</p>
      <p className="mt-1 text-sm text-[var(--text-secondary)]">{value}</p>
    </div>
  );
}

function List({ label, items }: { label: string; items: string[] }) {
  return (
    <div>
      <p className="text-xs font-medium text-[var(--text-muted)]">{label}</p>
      <ul className="mt-1 space-y-1">
        {items.map((item, i) => (
          <li key={i} className="text-sm text-[var(--text-secondary)]">
            • {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
