"use client";
import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { PageHeader, ActionButton, NotConnected } from "@/components/ui/console";
import { Sparkles, AlertTriangle, Users } from "lucide-react";
import { useWorkspace, useAskResearch } from "@/hooks/use-growthx";
import { api } from "@/lib/api-client";
import type { ResearchSource } from "@/lib/api-client";
import { ResearchActivity, type StageProgress } from "@/components/market-research/research-activity";
import { EmptyState, Composer } from "@/components/market-research/research-composer";
import { AnswerBlock } from "@/components/market-research/research-answer";
import { SourcesRail } from "@/components/market-research/sources-rail";
import type { Turn } from "@/components/market-research/research-types";

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
  const [pendingQuestion, setPendingQuestion] = useState("");
  const [threadId, setThreadId] = useState<string | undefined>(undefined);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [openSource, setOpenSource] = useState<ResearchSource | null>(null);
  // Stage-by-stage progress for the run in flight, from the server's own events.
  const [progress, setProgress] = useState<StageProgress>({});
  // Sources the run has already stored. They arrive at the `assemble` stage,
  // well before the answer, so the rail fills while the answer is written.
  const [streamedSources, setStreamedSources] = useState<ResearchSource[]>([]);

  // Every source across the conversation, de-duplicated and numbered once.
  // Numbering per turn would restart at [1] on each follow-up, so one page
  // could carry two different markers and the rail would stop being a key.
  const allSources: ResearchSource[] = [];
  const seenKeys = new Set<string>();
  for (const source of [...turns.flatMap((t) => t.sources), ...streamedSources]) {
    if (seenKeys.has(source.sourceKey)) continue;
    seenKeys.add(source.sourceKey);
    allSources.push(source);
  }
  const sourceNumber = new Map(allSources.map((s, i) => [s.sourceKey, i + 1]));

  const threadEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (turns.length > 0 || ask.isPending) {
      threadEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [turns.length, ask.isPending]);

  async function submit(text: string) {
    if (!projectId || !text.trim() || ask.isPending) return;
    setError(null);
    setPendingQuestion(text.trim());
    setQuestion("");
    setProgress({});
    setStreamedSources([]);
    try {
      // Follow-ups reuse the thread so the model keeps this project's context.
      const result = await ask.mutateAsync({
        question: text.trim(),
        threadId,
        onProgress: (event) => {
          setProgress((prev) => ({
            ...prev,
            [event.stage]: { status: event.status, detail: event.detail },
          }));
          if (event.sources?.length) setStreamedSources(event.sources);
        },
      });
      setThreadId(result.threadId);
      setTurns((prev) => [...prev, { question: text.trim(), answer: result.answer, sources: result.sources }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Research failed.");
      // Handed back so a failed run can be retried without retyping it.
      setQuestion(text.trim());
    } finally {
      setPendingQuestion("");
      // The turn now owns these; keeping them here would double-count a
      // source that the finished answer already carries.
      setStreamedSources([]);
      setProgress({});
    }
  }

  function newResearch() {
    // Resets this conversation only. Saved threads are untouched.
    setThreadId(undefined);
    setTurns([]);
    setQuestion("");
    setError(null);
    setOpenSource(null);
    setStreamedSources([]);
    setProgress({});
  }

  function focusSource(source: ResearchSource) {
    setOpenSource(source);
    document
      .getElementById(`source-${source.sourceKey}`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  const isEmpty = turns.length === 0 && !ask.isPending;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Market Research"
        subtitle="Ask what is changing in your market. Every answer cites only the sources retrieved for that run."
        actions={
          <div className="flex items-center gap-2">
            {/* Competitor identification lives on the Competitors tab now.
                Linked rather than dropped: this page was where operators knew
                to find it. */}
            <Link href="/competitors">
              <ActionButton variant="secondary" icon={<Users size={12} />}>
                Competitors
              </ActionButton>
            </Link>
            {turns.length > 0 && (
              <ActionButton variant="secondary" icon={<Sparkles size={12} />} onClick={newResearch}>
                New research
              </ActionButton>
            )}
          </div>
        }
      />

      {!projectId ? (
        <NotConnected
          title="No client selected"
          what="Market research is scoped to one client so their crawl, competitors and AI-visibility history can ground the answer."
          needs={["An active organization", "A selected client project"]}
        />
      ) : (
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
          <div className="min-w-0 flex-1 space-y-4">
            {isEmpty && <EmptyState prompts={prompts} onPick={submit} />}

            {turns.map((turn, i) => (
              <AnswerBlock key={i} turn={turn} sourceNumber={sourceNumber} onOpenSource={focusSource} />
            ))}

            {ask.isPending && <ResearchActivity question={pendingQuestion} progress={progress} />}

            {error && (
              <div className="flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-xs text-red-600 dark:text-red-400">
                <AlertTriangle size={14} className="mt-px shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div ref={threadEndRef} />

            <Composer
              value={question}
              onChange={setQuestion}
              onSubmit={() => submit(question)}
              isPending={ask.isPending}
              isFollowUp={turns.length > 0}
            />
          </div>

          <SourcesRail
            sources={allSources}
            openSource={openSource}
            onOpenSource={setOpenSource}
            isPending={ask.isPending}
          />
        </div>
      )}
    </div>
  );
}
