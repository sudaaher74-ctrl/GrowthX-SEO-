"use client";

import { Pill } from "@/components/ui/console";
import { AlertTriangle, Sparkles, Telescope, ShieldCheck, Lightbulb, Target } from "lucide-react";
import type { ResearchSource } from "@/lib/api-client";
import { SourceMonogram, SOURCE_LABEL, hostOf } from "@/components/market-research/source-card";
import type { Turn } from "@/components/market-research/research-types";

const CONFIDENCE_TONE = {
  high: "good",
  medium: "warn",
  low: "bad",
} as const;

/* ── the answer ─────────────────────────────────────────────────── */

export function SectionHeading({
  icon,
  children,
  tone,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  tone?: "good" | "info" | "warn";
}) {
  const color =
    tone === "good"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "warn"
        ? "text-amber-600 dark:text-amber-400"
        : tone === "info"
          ? "text-blue-600 dark:text-blue-400"
          : "text-[var(--text-muted)]";

  return (
    <div className={`flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider ${color}`}>
      {icon}
      {children}
    </div>
  );
}

export function AnswerBlock({
  turn,
  sourceNumber,
  onOpenSource,
}: {
  turn: Turn;
  sourceNumber: Map<string, number>;
  onOpenSource: (s: ResearchSource) => void;
}) {
  const { answer, sources } = turn;
  const byKey = new Map(sources.map((s) => [s.sourceKey, s]));

  const Citations = ({ ids }: { ids: string[] }) => (
    <>
      {ids.map((id) => {
        const source = byKey.get(id);
        const number = sourceNumber.get(id);
        if (!source || !number) return null;
        return (
          <button
            key={id}
            onClick={() => onOpenSource(source)}
            title={source.title}
            className="ml-1 inline-flex h-[17px] min-w-[17px] items-center justify-center rounded-[5px] bg-blue-500/10 px-1 align-super font-mono text-[10px] font-bold text-blue-600 transition-colors hover:bg-blue-500/20 dark:text-blue-400"
          >
            {number}
          </button>
        );
      })}
    </>
  );

  return (
    <div className="space-y-3">
      {/* The question, as the operator asked it */}
      <div className="flex justify-end">
        <p className="max-w-[85%] rounded-2xl rounded-br-md bg-brand-950 px-4 py-2.5 text-sm text-white">
          {turn.question}
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[var(--border-color)] bg-[var(--surface-1)]">
        <div className="flex items-center justify-between gap-2 border-b border-[var(--border-color)] px-4 py-2.5">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 text-white">
              <Telescope size={12} />
            </span>
            <span className="text-[12.5px] font-semibold text-[var(--text-primary)]">Answer</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Pill tone={CONFIDENCE_TONE[answer.confidence]}>{answer.confidence} confidence</Pill>
            <Pill>
              {sources.length} source{sources.length === 1 ? "" : "s"}
            </Pill>
          </div>
        </div>

        <div className="space-y-5 p-4">
          <p className="text-[14px] leading-relaxed text-[var(--text-primary)]">{answer.summary}</p>

          {/* Source strip, so the evidence is visible without crossing to the rail */}
          {sources.length > 0 && (
            <div className="flex flex-wrap gap-1.5 border-t border-[var(--border-color)] pt-3">
              {sources.map((source) => {
                const number = sourceNumber.get(source.sourceKey);
                const host = hostOf(source);
                return (
                  <button
                    key={source.id}
                    onClick={() => onOpenSource(source)}
                    title={source.title}
                    className="flex max-w-[220px] items-center gap-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--surface-2)] py-1 pl-1 pr-2 transition-colors hover:border-blue-500/40"
                  >
                    <SourceMonogram source={source} size={18} />
                    <span className="font-mono text-[10px] font-bold text-blue-600 dark:text-blue-400">
                      {number}
                    </span>
                    <span className="truncate text-[11px] text-[var(--text-secondary)]">
                      {host || SOURCE_LABEL[source.type]}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {answer.verifiedClaims.length > 0 && (
            <section className="space-y-2">
              <SectionHeading icon={<ShieldCheck size={12} />} tone="good">
                Verified evidence
              </SectionHeading>
              <ul className="space-y-2 border-l-2 border-emerald-500/30 pl-3">
                {answer.verifiedClaims.map((c, i) => (
                  <li key={i} className="text-[13px] leading-relaxed text-[var(--text-secondary)]">
                    {c.claim}
                    <Citations ids={c.citationIds} />
                  </li>
                ))}
              </ul>
            </section>
          )}

          {answer.inferences.length > 0 && (
            <section className="space-y-2">
              {/* Labelled distinctly: this is the model reasoning past its sources. */}
              <SectionHeading icon={<Lightbulb size={12} />} tone="info">
                Inference — reasoned, not evidenced
              </SectionHeading>
              <ul className="space-y-2.5 border-l-2 border-blue-500/30 pl-3">
                {answer.inferences.map((inf, i) => (
                  <li key={i} className="text-[13px] leading-relaxed text-[var(--text-secondary)]">
                    {inf.statement}
                    <Citations ids={inf.citationIds} />
                    <span className="mt-0.5 block text-[11.5px] text-[var(--text-muted)]">
                      Reasoning: {inf.reasoning}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {answer.citationGaps.length > 0 && (
            <section className="space-y-2">
              <SectionHeading icon={<Target size={12} />} tone="warn">
                Citation gaps
              </SectionHeading>
              <div className="grid gap-2 md:grid-cols-2">
                {answer.citationGaps.map((gap, i) => (
                  <div key={i} className="rounded-xl border border-[var(--border-color)] bg-[var(--surface-2)] p-3">
                    <p className="text-[13px] font-semibold text-[var(--text-primary)]">{gap.topic}</p>
                    <p className="mt-0.5 text-[12.5px] text-[var(--text-secondary)]">{gap.gap}</p>
                    {gap.competitorsWinning.length > 0 && (
                      <p className="mt-1 text-[11.5px] text-[var(--text-muted)]">
                        Winning: {gap.competitorsWinning.join(", ")}
                      </p>
                    )}
                    <p className="mt-1.5 text-[12.5px] text-blue-600 dark:text-blue-400">
                      {gap.recommendedResponse}
                    </p>
                    <div className="mt-2 flex gap-2">
                      <Pill>impact {gap.impact}</Pill>
                      <Pill>effort {gap.effort}</Pill>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {answer.recommendedActions.length > 0 && (
            <section className="space-y-2">
              <SectionHeading icon={<Sparkles size={12} />} tone="info">
                Recommended actions
              </SectionHeading>
              {answer.recommendedActions.map((action, i) => (
                <div key={i} className="rounded-xl border border-[var(--border-color)] bg-[var(--surface-2)] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[13px] font-semibold text-[var(--text-primary)]">{action.title}</p>
                    <Pill>{action.type.replace(/_/g, " ").toLowerCase()}</Pill>
                  </div>
                  <p className="mt-1 text-[12.5px] text-[var(--text-secondary)]">{action.description}</p>
                  <p className="mt-1 text-[11.5px] text-[var(--text-muted)]">
                    Expected impact: {action.expectedImpact}
                  </p>
                  <div className="mt-1.5 text-[11.5px] text-[var(--text-muted)]">
                    Evidence:
                    <Citations ids={action.evidenceCitationIds} />
                  </div>
                  {/* Phase 1 surfaces recommendations only. Converting one into a
                      GrowthX task is Phase 2, so no approve button is shown yet. */}
                  <p className="mt-2 text-[11px] text-amber-600 dark:text-amber-400">
                    Requires approval before any work is created.
                  </p>
                </div>
              ))}
            </section>
          )}

          {answer.evidenceGaps.length > 0 && (
            <section className="space-y-1.5 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
              <SectionHeading icon={<AlertTriangle size={12} />} tone="warn">
                What this answer could not establish
              </SectionHeading>
              <ul className="space-y-1">
                {answer.evidenceGaps.map((gap, i) => (
                  <li key={i} className="text-[12px] text-[var(--text-secondary)]">
                    • {gap}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

