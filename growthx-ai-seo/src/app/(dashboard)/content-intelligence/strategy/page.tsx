"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Sparkles, RefreshCw, Check, Clock, Cpu, AlertCircle, Info, ChevronDown } from "lucide-react";
import { api, type ContentStrategy } from "@/lib/api-client";
import { useWorkspace } from "@/hooks/use-growthx";
import { errorMessage } from "@/lib/error-message";

function ErrorBanner({ title, error, onRetry }: { title: string; error: unknown; onRetry?: () => void }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border bg-white px-5 py-4" style={{ borderColor: "var(--color-error-500)" }}>
      <AlertCircle size={16} className="mt-0.5 shrink-0 text-error-500" />
      <div className="flex-1">
        <p className="text-[14px] font-medium text-brand-950">{title}</p>
        <p className="mt-0.5 text-[13px] text-brand-600">{errorMessage(error)}</p>
      </div>
      {onRetry && (
        <button onClick={onRetry} className="shrink-0 rounded-lg border px-3 py-1.5 text-[13px] font-medium text-brand-600" style={{ borderColor: "var(--color-brand-200)" }}>
          Try again
        </button>
      )}
    </div>
  );
}

const PILLAR_COLORS = [
  "var(--color-accent-600)",
  "var(--color-series-2)",
  "var(--color-series-6)",
  "var(--color-warning-500)",
  "var(--color-success-500)",
  "var(--color-error-500)",
  "var(--color-series-7)",
  "var(--color-series-8)",
];

/**
 * A pillar split as a single stacked bar rather than a donut.
 *
 * The donut this replaces cost half the card's width to say what four
 * percentages say in a line of text, and it pushed everything that explains
 * the strategy — what each pillar is for, what to write — out of the card and
 * into a dialog. A bar carries the same proportions in a strip, so the reader
 * gets the shape of the split and the reasoning behind it on one screen.
 */
function PillarBar({ pillars }: { pillars: { pillar: string; percentage: number }[] }) {
  const total = pillars.reduce((sum, p) => sum + p.percentage, 0) || 100;
  return (
    <div className="flex h-2 w-full overflow-hidden rounded-full bg-brand-100">
      {pillars.map((p, i) => (
        <div
          key={p.pillar}
          style={{ width: `${(p.percentage / total) * 100}%`, background: PILLAR_COLORS[i % PILLAR_COLORS.length] }}
          title={`${p.pillar} ${p.percentage}%`}
        />
      ))}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-brand-500">{title}</h3>
      {children}
    </section>
  );
}

/** A marked list — avoid, test, scale all share this shape. */
function MarkedList({ items, mark, color }: { items: string[]; mark: string; color: string }) {
  return (
    <ul className="space-y-1.5">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-2 text-[13px] leading-relaxed text-brand-600">
          <span className={`mt-0.5 shrink-0 ${color}`}>{mark}</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * One strategy, rendered in full.
 *
 * Everything here used to live behind a click: the card showed a donut and
 * four percentages, and the executive summary, the reasoning for each pillar,
 * the topics to write, the campaign ideas and the cadence were all in a modal.
 * A strategy is a document someone reads and works from, so it is laid out as
 * one — a dialog is the wrong container for the thing the page exists to show.
 *
 * Older strategies collapse to their header. Superseded ones are still worth
 * keeping and occasionally re-reading, but stacking several full documents
 * makes the current one hard to find.
 */
function StrategyDocument({
  strategy,
  defaultOpen,
  approveError,
  approving,
  onApprove,
}: {
  strategy: ContentStrategy;
  defaultOpen: boolean;
  approveError?: string | null;
  approving: boolean;
  onApprove: () => void;
}) {
  const [open, setOpen] = useState(defaultOpen);

  const content = strategy.content as ContentStrategy["content"];
  const pillars = strategy.contentPillars ?? [];
  const campaigns = strategy.campaignIdeas ?? [];
  const cadence = Object.entries(strategy.platformFrequency ?? {});
  const basis = content?.dataBasis;
  const coldStart = basis && !Object.values(basis).some((n) => Number(n) > 0);

  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="overflow-hidden rounded-xl border bg-white"
      style={{ borderColor: "var(--color-brand-100)" }}
    >
      <header className="border-b px-6 py-5" style={{ borderColor: "var(--color-brand-100)" }}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {/* Only a superseded strategy is collapsible, so the current one
                  never presents a control that hides the thing you came for. */}
              {!defaultOpen && (
                <button
                  onClick={() => setOpen((v) => !v)}
                  className="rounded p-0.5 text-brand-400 hover:bg-brand-100"
                  aria-label={open ? "Collapse strategy" : "Expand strategy"}
                >
                  <ChevronDown size={15} className={`transition-transform ${open ? "" : "-rotate-90"}`} />
                </button>
              )}
              <h2 className="text-[16px] font-semibold text-brand-950">{strategy.title}</h2>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-brand-500">
              <span className="flex items-center gap-1">
                <Clock size={11} /> {new Date(strategy.createdAt).toLocaleDateString()}
              </span>
              {strategy.industrySkill && <span>{strategy.industrySkill}</span>}
              {strategy.generatedByModel && (
                <span className="flex items-center gap-1">
                  <Cpu size={11} /> {strategy.generatedByModel.split("/").pop()}
                </span>
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                strategy.status === "APPROVED" ? "bg-[#10b98118] text-success-500" : "bg-brand-100 text-brand-500"
              }`}
            >
              {strategy.status}
            </span>
            {strategy.status !== "APPROVED" && (
              <button
                onClick={onApprove}
                disabled={approving}
                className="flex items-center gap-1.5 rounded-lg bg-success-500 px-3 py-1.5 text-[13px] font-medium text-white disabled:opacity-60"
              >
                <Check size={14} /> {approving ? "Approving…" : "Approve"}
              </button>
            )}
          </div>
        </div>

        {pillars.length > 0 && (
          <div className="mt-4">
            <PillarBar pillars={pillars} />
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
              {pillars.map((p, i) => (
                <span key={p.pillar} className="flex items-center gap-1.5 text-[12px] text-brand-600">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: PILLAR_COLORS[i % PILLAR_COLORS.length] }}
                  />
                  {p.pillar}
                  <span className="font-semibold text-brand-950">{p.percentage}%</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </header>

      {open && (
        <div className="space-y-6 px-6 py-5">
          {approveError && (
            <div
              className="flex items-start gap-2 rounded-lg px-3 py-2.5"
              style={{ background: "color-mix(in srgb, var(--color-error-500) 8%, transparent)" }}
            >
              <AlertCircle size={14} className="mt-0.5 shrink-0 text-error-500" />
              <p className="text-[13px] text-brand-600">{approveError}</p>
            </div>
          )}

          {/* Where the strategy came from, stated before the strategy itself.
              One built with no competitor data is a reasonable starting point
              and not the same document as one built from a real market, and
              the reader has to know which they are reading. */}
          {coldStart && (
            <div className="flex items-start gap-2 rounded-lg bg-brand-100 px-3 py-2.5">
              <Info size={14} className="mt-0.5 shrink-0 text-brand-500" />
              <p className="text-[13px] leading-relaxed text-brand-600">
                Built from brand and industry context only — no competitor patterns, gaps, or social posts had been
                collected yet. Run competitor content, pattern detection, and gap analysis, then regenerate for a
                strategy grounded in your market.
              </p>
            </div>
          )}

          {content?.executiveSummary && (
            <Section title="Executive summary">
              <p className="text-[14px] leading-relaxed text-brand-700">{content.executiveSummary}</p>
            </Section>
          )}

          {pillars.length > 0 && (
            <Section title="Content pillars">
              <div className="space-y-3">
                {pillars.map((p, i) => (
                  <div
                    key={p.pillar}
                    className="rounded-lg border-l-[3px] bg-brand-50 py-3 pl-4 pr-4"
                    style={{ borderColor: PILLAR_COLORS[i % PILLAR_COLORS.length] }}
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <span
                        className="text-[13px] font-semibold"
                        style={{ color: PILLAR_COLORS[i % PILLAR_COLORS.length] }}
                      >
                        {p.pillar}
                      </span>
                      <span className="text-[14px] font-bold text-brand-950">{p.percentage}%</span>
                    </div>
                    <p className="mt-1 text-[13px] leading-relaxed text-brand-600">{p.rationale}</p>
                    {p.topics && p.topics.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {p.topics.map((t) => (
                          <span
                            key={t}
                            className="rounded-full border bg-white px-2 py-0.5 text-[12px] text-brand-600"
                            style={{ borderColor: "var(--color-brand-200)" }}
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Section>
          )}

          {campaigns.length > 0 && (
            <Section title={`Campaign ideas (${campaigns.length})`}>
              <div className="grid gap-3 sm:grid-cols-2">
                {campaigns.map((idea) => (
                  <div key={idea.name} className="rounded-lg border p-4" style={{ borderColor: "var(--color-brand-200)" }}>
                    <div className="text-[13px] font-semibold text-brand-950">{idea.name}</div>
                    <div className="mt-0.5 text-[12px] font-medium text-accent-600">{idea.objective}</div>
                    <p className="mt-1.5 text-[13px] leading-relaxed text-brand-600">{idea.concept}</p>
                    {idea.contentTypes && idea.contentTypes.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {idea.contentTypes.map((t) => (
                          <span key={t} className="rounded bg-brand-100 px-1.5 py-0.5 text-[11px] text-brand-600">
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                    {idea.differentiator && (
                      <p className="mt-2 text-[12px] font-medium text-success-500">↑ {idea.differentiator}</p>
                    )}
                  </div>
                ))}
              </div>
            </Section>
          )}

          {cadence.length > 0 && (
            <Section title="Posting cadence">
              <div className="flex flex-wrap gap-2">
                {cadence.map(([platform, perWeek]) => (
                  <div
                    key={platform}
                    className="rounded-lg border px-3 py-2"
                    style={{ borderColor: "var(--color-brand-200)" }}
                  >
                    <span className="text-[13px] text-brand-600">{platform}</span>
                    <span className="ml-2 text-[13px] font-semibold text-brand-950">{perWeek}/week</span>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Three lists that answer three different questions, so they sit
              side by side rather than stacked — read together they are the
              week's shortlist. */}
          {(content?.whatToScale?.length || content?.whatToTest?.length || content?.whatToAvoid?.length) ? (
            <div className="grid gap-6 sm:grid-cols-3">
              {content?.whatToScale && content.whatToScale.length > 0 && (
                <Section title="Scale">
                  <MarkedList items={content.whatToScale} mark="↑" color="text-success-500" />
                </Section>
              )}
              {content?.whatToTest && content.whatToTest.length > 0 && (
                <Section title="Test">
                  <MarkedList items={content.whatToTest} mark="◆" color="text-warning-500" />
                </Section>
              )}
              {content?.whatToAvoid && content.whatToAvoid.length > 0 && (
                <Section title="Avoid">
                  <MarkedList items={content.whatToAvoid} mark="✕" color="text-error-500" />
                </Section>
              )}
            </div>
          ) : null}

          {content?.hooks && content.hooks.length > 0 && (
            <Section title="Proven hooks">
              <div className="space-y-1.5">
                {content.hooks.map((h) => (
                  <div key={h} className="rounded-lg bg-brand-100 px-3 py-2 text-[13px] leading-relaxed text-brand-700">
                    “{h}”
                  </div>
                ))}
              </div>
            </Section>
          )}

          {strategy.creatorStrategy && (
            <Section title="Creator strategy">
              <p className="text-[14px] leading-relaxed text-brand-700">{strategy.creatorStrategy}</p>
            </Section>
          )}

          {content?.ctaStrategy && (
            <Section title="CTA strategy">
              <p className="text-[14px] leading-relaxed text-brand-700">{content.ctaStrategy}</p>
            </Section>
          )}
        </div>
      )}
    </motion.article>
  );
}

export default function StrategyPage() {
  const { projectId } = useWorkspace();
  const qc = useQueryClient();
  const [approvingId, setApprovingId] = useState<string | null>(null);

  const strategies = useQuery({
    queryKey: ["ci-strategies", projectId],
    queryFn: () => api.listContentStrategies(projectId!),
    enabled: !!projectId,
  });

  const generateMut = useMutation({
    mutationFn: () => api.generateContentStrategy(projectId!),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ci-strategies"] }),
  });

  const approveMut = useMutation({
    mutationFn: (strategyId: string) => api.approveContentStrategy(projectId!, strategyId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ci-strategies"] }),
  });

  // A failed approval used to leave the button looking untouched, and the
  // message is shown against the strategy it belongs to rather than the page.
  const approveError = approveMut.isError ? errorMessage(approveMut.error) : null;

  if (!projectId) return <div className="flex h-40 items-center justify-center text-sm text-brand-500">Select a project.</div>;

  return (
    <div className="min-h-screen bg-brand-50">
      <div className="border-b bg-white px-6 py-5" style={{ borderColor: "var(--color-brand-100)" }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-600/10">
              <Sparkles size={17} className="text-accent-600" />
            </div>
            <div>
              <h1 className="text-[15px] font-semibold text-brand-950">AI Content Strategy</h1>
              <p className="text-[12px] text-brand-500">Differentiated strategy built from competitive intelligence and gap analysis.</p>
            </div>
          </div>
          <button
            onClick={() => generateMut.mutate()}
            disabled={generateMut.isPending}
            className="flex items-center gap-1.5 rounded-lg bg-accent-600 px-3 py-1.5 text-[12px] font-medium text-white disabled:opacity-60"
          >
            {generateMut.isPending ? <RefreshCw size={13} className="animate-spin" /> : <Sparkles size={13} />}
            {generateMut.isPending ? "Generating…" : "Generate New Strategy"}
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-6 py-6 space-y-4">
        {generateMut.isPending && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl border bg-white px-6 py-8 text-center" style={{ borderColor: "var(--color-brand-100)" }}>
            <RefreshCw size={24} className="mx-auto mb-3 animate-spin text-accent-600" />
            <p className="text-[14px] font-medium text-brand-950">Analyzing competitive intelligence…</p>
            <p className="mt-1 text-[13px] text-brand-500">Reading patterns, gaps, and industry context to build your differentiated strategy.</p>
          </motion.div>
        )}

        {generateMut.isError && (
          <ErrorBanner
            title="Could not generate the strategy"
            error={generateMut.error}
            onRetry={() => generateMut.reset()}
          />
        )}

        {strategies.isLoading ? (
          <div className="py-12 text-center text-[13px] text-brand-500">Loading…</div>
        ) : strategies.isError ? (
          <ErrorBanner
            title="Could not load your strategies"
            error={strategies.error}
            onRetry={() => strategies.refetch()}
          />
        ) : !strategies.data?.length ? (
          <div className="rounded-xl border border-dashed bg-white py-16 text-center" style={{ borderColor: "var(--color-brand-200)" }}>
            <Sparkles size={28} className="mx-auto mb-3 text-brand-300" />
            <p className="text-[14px] font-medium text-brand-950">No strategy generated yet</p>
            <p className="mx-auto mt-1 max-w-md text-[13px] leading-relaxed text-brand-500">
              Gap analysis makes the strategy sharper, but it is not required — generate one now and it will be
              built from your brand and industry context.
            </p>
          </div>
        ) : (
          strategies.data.map((strategy, index) => (
            <StrategyDocument
              key={strategy.id}
              strategy={strategy}
              // The list comes back newest first, so the current strategy is
              // open on arrival and superseded ones stay out of the way.
              defaultOpen={index === 0}
              approving={approveMut.isPending && approvingId === strategy.id}
              approveError={approvingId === strategy.id ? approveError : null}
              onApprove={() => {
                setApprovingId(strategy.id);
                approveMut.mutate(strategy.id);
              }}
            />
          ))
        )}
      </div>
    </div>
  );
}
