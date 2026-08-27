"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader, Panel, Pill, ActionButton, NotConnected } from "@/components/ui/console";
import { Loader2, Search, Sparkles, ExternalLink, FileText, Globe, BarChart3, AlertTriangle } from "lucide-react";
import { useWorkspace, useAskResearch } from "@/hooks/use-growthx";
import { api } from "@/lib/api-client";
import type { ResearchAnswer, ResearchSource, ResearchSourceType } from "@/lib/api-client";

/**
 * Shown until the client's own questions arrive, and kept as the answer for a
 * project that has not been crawled yet. The API returns this same set in that
 * case, so the panel never sits empty and never flashes between two lists.
 */
const SUGGESTED = [
  "What changed in this market this week?",
  "Which competitors are winning AI citations for our core topic?",
  "What content should we create to close the biggest visibility gap?",
  "How is our positioning different from our top competitors?",
];

const SOURCE_LABEL: Record<ResearchSourceType, string> = {
  PUBLIC_WEB: "Web",
  CLIENT_WEBSITE: "Client site",
  UPLOADED_FILE: "Upload",
  AI_VISIBILITY_CHECK: "AI visibility",
  INTEGRATION_DATA: "Integration",
};

const SOURCE_ICON: Record<ResearchSourceType, typeof Globe> = {
  PUBLIC_WEB: Globe,
  CLIENT_WEBSITE: FileText,
  UPLOADED_FILE: FileText,
  AI_VISIBILITY_CHECK: BarChart3,
  INTEGRATION_DATA: BarChart3,
};

interface Turn {
  question: string;
  answer: ResearchAnswer;
  sources: ResearchSource[];
}

export default function MarketResearchPage() {
  const { projectId } = useWorkspace();
  const ask = useAskResearch(projectId);

  // Derived from the crawl rather than generated, so this costs a query rather
  // than model tokens and can load with the page.
  const suggested = useQuery({
    queryKey: ["research-suggested-questions", projectId],
    queryFn: () => api.getSuggestedResearchQuestions(projectId!),
    enabled: !!projectId,
    staleTime: 5 * 60 * 1000,
  });
  const prompts = suggested.data?.length ? suggested.data : SUGGESTED;

  const [question, setQuestion] = useState("");
  const [threadId, setThreadId] = useState<string | undefined>(undefined);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [openSource, setOpenSource] = useState<ResearchSource | null>(null);

  async function submit(text: string) {
    if (!projectId || !text.trim() || ask.isPending) return;
    setError(null);
    try {
      // Follow-ups reuse the thread so the model keeps this project's context.
      const result = await ask.mutateAsync({ question: text.trim(), threadId });
      setThreadId(result.threadId);
      setTurns((prev) => [...prev, { question: text.trim(), answer: result.answer, sources: result.sources }]);
      setQuestion("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Research failed.");
    }
  }

  function newResearch() {
    // Resets this conversation only. Saved threads are untouched.
    setThreadId(undefined);
    setTurns([]);
    setQuestion("");
    setError(null);
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Market Research"
        subtitle="Ask what is changing in your market. Get a cited answer and the AI-search opportunity it creates."
        actions={
          turns.length > 0 ? (
            <ActionButton variant="secondary" icon={<Sparkles size={12} />} onClick={newResearch}>
              New research
            </ActionButton>
          ) : undefined
        }
      />

      {!projectId ? (
        <NotConnected
          title="No client selected"
          what="Market research is scoped to one client so their crawl, competitors and AI-visibility history can ground the answer."
          needs={["An active organization", "A selected client project"]}
        />
      ) : (
        <div className="flex flex-col gap-4 lg:flex-row">
          <div className="flex-1 space-y-4">
            {turns.length === 0 && !ask.isPending && (
              <Panel title="Start a research question" subtitle="Answers cite only sources retrieved for this run">
                <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {prompts.map((s) => (
                    <button
                      key={s}
                      onClick={() => submit(s)}
                      className="text-left p-3 rounded-xl border border-[var(--border-color)] bg-[var(--surface-2)] text-xs text-[var(--text-primary)] hover:border-accent-600 transition-colors"
                    >
                      <Search size={13} className="text-blue-500 inline mr-1.5" />
                      {s}
                    </button>
                  ))}
                </div>
              </Panel>
            )}

            {turns.map((turn, i) => (
              <AnswerBlock key={i} turn={turn} onOpenSource={setOpenSource} />
            ))}

            {ask.isPending && (
              <Panel title="Researching">
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Loader2 size={28} className="text-brand-200 mb-3 animate-spin" />
                  <p className="text-sm text-[var(--text-muted)]">
                    Searching the web, then checking it against this client&apos;s own data…
                  </p>
                </div>
              </Panel>
            )}

            {error && (
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-xs text-red-600 dark:text-red-400">
                {error}
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                submit(question);
              }}
              className="flex gap-2"
            >
              <input
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder={turns.length ? "Ask a follow-up…" : "Ask about this client's market…"}
                className="flex-1 rounded-xl border border-[var(--border-color)] bg-[var(--surface-1)] px-4 py-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
              />
              <ActionButton
                variant="primary"
                icon={ask.isPending ? <Loader2 size={12} className="animate-spin" /> : <Search size={12} />}
                disabled={ask.isPending || !question.trim()}
              >
                Research
              </ActionButton>
            </form>
          </div>

          <SourcesPanel
            sources={turns.at(-1)?.sources ?? []}
            openSource={openSource}
            onOpenSource={setOpenSource}
          />
        </div>
      )}
    </div>
  );
}

function AnswerBlock({ turn, onOpenSource }: { turn: Turn; onOpenSource: (s: ResearchSource) => void }) {
  const { answer, sources } = turn;
  const byKey = new Map(sources.map((s) => [s.sourceKey, s]));
  const indexOf = (key: string) => sources.findIndex((s) => s.sourceKey === key) + 1;

  const Citations = ({ ids }: { ids: string[] }) => (
    <>
      {ids.map((id) => {
        const source = byKey.get(id);
        if (!source) return null;
        return (
          <button
            key={id}
            onClick={() => onOpenSource(source)}
            title={source.title}
            className="ml-1 inline-flex h-[17px] min-w-[17px] items-center justify-center rounded-[5px] bg-blue-50 px-1 text-[10px] font-semibold text-blue-600 align-super hover:bg-blue-100"
          >
            {indexOf(id)}
          </button>
        );
      })}
    </>
  );

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-[var(--border-color)] bg-[var(--surface-2)] px-4 py-3">
        <p className="text-sm font-medium text-[var(--text-primary)]">{turn.question}</p>
      </div>

      <Panel
        title="Answer"
        subtitle={`Confidence: ${answer.confidence}`}
      >
        <div className="p-4 space-y-5">
          <p className="text-sm leading-relaxed text-[var(--text-primary)]">{answer.summary}</p>

          {answer.verifiedClaims.length > 0 && (
            <section className="space-y-2">
              <Pill tone="good">Verified evidence</Pill>
              <ul className="space-y-1.5">
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
              <Pill tone="info">Inference</Pill>
              <ul className="space-y-2">
                {answer.inferences.map((inf, i) => (
                  <li key={i} className="text-[13px] leading-relaxed text-[var(--text-secondary)]">
                    {inf.statement}
                    <Citations ids={inf.citationIds} />
                    <span className="block text-[11.5px] text-[var(--text-muted)] mt-0.5">
                      Reasoning: {inf.reasoning}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {answer.citationGaps.length > 0 && (
            <section className="space-y-2">
              <Pill tone="warn">Citation gaps</Pill>
              {answer.citationGaps.map((gap, i) => (
                <div key={i} className="rounded-lg border border-[var(--border-color)] bg-[var(--surface-2)] p-3">
                  <p className="text-[13px] font-semibold text-[var(--text-primary)]">{gap.topic}</p>
                  <p className="text-[12.5px] text-[var(--text-secondary)] mt-0.5">{gap.gap}</p>
                  {gap.competitorsWinning.length > 0 && (
                    <p className="text-[11.5px] text-[var(--text-muted)] mt-1">
                      Winning: {gap.competitorsWinning.join(", ")}
                    </p>
                  )}
                  <p className="text-[12.5px] text-blue-600 dark:text-blue-400 mt-1.5">{gap.recommendedResponse}</p>
                  <div className="flex gap-2 mt-2">
                    <Pill>impact {gap.impact}</Pill>
                    <Pill>effort {gap.effort}</Pill>
                  </div>
                </div>
              ))}
            </section>
          )}

          {answer.recommendedActions.length > 0 && (
            <section className="space-y-2">
              <Pill tone="info">Recommendation</Pill>
              {answer.recommendedActions.map((action, i) => (
                <div key={i} className="rounded-lg border border-[var(--border-color)] bg-[var(--surface-1)] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[13px] font-semibold text-[var(--text-primary)]">{action.title}</p>
                    <Pill>{action.type.replace(/_/g, " ").toLowerCase()}</Pill>
                  </div>
                  <p className="text-[12.5px] text-[var(--text-secondary)] mt-1">{action.description}</p>
                  <p className="text-[11.5px] text-[var(--text-muted)] mt-1">Expected impact: {action.expectedImpact}</p>
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
            <section className="space-y-1.5">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                <AlertTriangle size={12} /> Evidence gaps
              </span>
              <ul className="space-y-1">
                {answer.evidenceGaps.map((gap, i) => (
                  <li key={i} className="text-[12px] text-[var(--text-muted)]">• {gap}</li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </Panel>
    </div>
  );
}

function SourcesPanel({
  sources,
  openSource,
  onOpenSource,
}: {
  sources: ResearchSource[];
  openSource: ResearchSource | null;
  onOpenSource: (s: ResearchSource | null) => void;
}) {
  return (
    <aside className="w-full lg:w-[320px] shrink-0 space-y-3">
      <Panel title="Sources" subtitle={sources.length ? `${sources.length} retrieved` : "None yet"}>
        {sources.length === 0 ? (
          <div className="p-6 text-center text-xs text-[var(--text-muted)]">
            Sources retrieved for a question appear here.
          </div>
        ) : (
          <ul className="p-3 space-y-2">
            {sources.map((source, i) => {
              const Icon = SOURCE_ICON[source.type] ?? Globe;
              return (
                <li key={source.id}>
                  <button
                    onClick={() => onOpenSource(source)}
                    className="w-full text-left rounded-lg border border-[var(--border-color)] bg-[var(--surface-2)] p-2.5 hover:border-accent-600 transition-colors"
                  >
                    <div className="flex items-start gap-2">
                      <span className="mt-0.5 inline-flex h-[17px] min-w-[17px] items-center justify-center rounded-[5px] bg-blue-50 px-1 text-[10px] font-semibold text-blue-600">
                        {i + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-[12.5px] font-medium text-[var(--text-primary)]">{source.title}</p>
                        <p className="flex items-center gap-1 text-[11px] text-[var(--text-muted)]">
                          <Icon size={11} />
                          {SOURCE_LABEL[source.type]}
                          {source.publisher ? ` · ${source.publisher}` : ""}
                        </p>
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      {openSource && (
        <Panel title="Source detail">
          <div className="p-4 space-y-2">
            <p className="text-[13px] font-semibold text-[var(--text-primary)]">{openSource.title}</p>
            <div className="flex flex-wrap gap-2">
              <Pill>{SOURCE_LABEL[openSource.type]}</Pill>
              {openSource.publisher && <Pill>{openSource.publisher}</Pill>}
            </div>
            <p className="text-[11.5px] text-[var(--text-muted)]">
              {openSource.publishedAt
                ? `Published ${new Date(openSource.publishedAt).toLocaleDateString()}`
                : "Publication date not reported by the source"}
              {" · "}
              Retrieved {new Date(openSource.retrievedAt).toLocaleDateString()}
            </p>
            {openSource.excerpt && (
              <p className="rounded-lg bg-[var(--surface-2)] p-2.5 text-[12px] leading-relaxed text-[var(--text-secondary)]">
                “{openSource.excerpt}”
              </p>
            )}
            {openSource.url && (
              <a
                href={openSource.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-[12px] font-medium text-blue-600 hover:underline"
              >
                <ExternalLink size={12} /> Open source
              </a>
            )}
            <button
              onClick={() => onOpenSource(null)}
              className="block text-[11.5px] text-[var(--text-muted)] hover:underline"
            >
              Close
            </button>
          </div>
        </Panel>
      )}
    </aside>
  );
}
