"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";

import { PageHeader } from "@/components/ui/console";
import { useWorkspace } from "@/hooks/use-growthx";
import { api, askResearchStream, ApiError } from "@/lib/api-client";
import type { ResearchSource } from "@/lib/api-client";
import type { Turn } from "@/components/market-research/research-types";
import { Composer, EmptyState } from "@/components/market-research/research-composer";
import { AnswerBlock } from "@/components/market-research/research-answer";
import { SourcesRail } from "@/components/market-research/sources-rail";
import {
  ResearchActivity,
  type StageProgress,
} from "@/components/market-research/research-activity";

/**
 * Market Research — ask a question about this client's market and get an
 * answer where every claim carries a citation you can open.
 *
 * This page was a redirect to Competitor Intelligence for a while, which left
 * the four components below built, current and unreachable. They are mounted
 * here against the same streaming route they were written for; nothing about
 * their contract had drifted.
 */
export default function MarketResearchPage() {
  const { projectId } = useWorkspace();

  const suggested = useQuery({
    queryKey: ["research-suggested-questions", projectId],
    queryFn: () => api.getSuggestedResearchQuestions(projectId!),
    enabled: !!projectId,
    retry: false,
  });

  const [draft, setDraft] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);
  const [progress, setProgress] = useState<StageProgress>({});
  const [liveSources, setLiveSources] = useState<ResearchSource[]>([]);
  const [openSource, setOpenSource] = useState<ResearchSource | null>(null);
  const [error, setError] = useState<string | null>(null);
  const threadId = useRef<string | undefined>(undefined);

  const isPending = pendingQuestion !== null;

  /**
   * One numbered list across the whole thread, deduplicated by `sourceKey`.
   *
   * The rail numbers what it renders by position, and the answer looks each
   * citation up by key — so both have to read the same ordered list or the
   * numbers beside a claim stop pointing at the card the reader opens.
   */
  const sources = useMemo(() => {
    const seen = new Map<string, ResearchSource>();
    for (const turn of turns) {
      for (const source of turn.sources) {
        if (!seen.has(source.sourceKey)) seen.set(source.sourceKey, source);
      }
    }
    // Sources announced mid-run, before the answer that cites them exists.
    for (const source of liveSources) {
      if (!seen.has(source.sourceKey)) seen.set(source.sourceKey, source);
    }
    return [...seen.values()];
  }, [turns, liveSources]);

  const sourceNumber = useMemo(
    () => new Map(sources.map((source, i) => [source.sourceKey, i + 1])),
    [sources],
  );

  const ask = useCallback(
    async (question: string) => {
      const trimmed = question.trim();
      if (!trimmed || !projectId || isPending) return;

      setDraft("");
      setError(null);
      setProgress({});
      setLiveSources([]);
      setPendingQuestion(trimmed);

      try {
        const result = await askResearchStream(
          projectId,
          { question: trimmed, threadId: threadId.current },
          (event) => {
            if (event.type !== "progress") return;
            setProgress((prev) => ({
              ...prev,
              [event.stage]: { status: event.status, detail: event.detail },
            }));
            if (event.sources?.length) setLiveSources(event.sources);
          },
        );

        threadId.current = result.threadId;
        setTurns((prev) => [
          ...prev,
          { question: trimmed, answer: result.answer, sources: result.sources },
        ]);
      } catch (err) {
        // Say what failed. An empty answer area with no explanation reads as
        // "the market has nothing to say", which is a different claim.
        setError(
          err instanceof ApiError
            ? err.message
            : "The research run did not finish. Nothing was saved — try the question again.",
        );
        setDraft(trimmed);
      } finally {
        setPendingQuestion(null);
        setLiveSources([]);
      }
    },
    [projectId, isPending],
  );

  if (!projectId) {
    return (
      <div className="space-y-4">
        <PageHeader title="Market Research" subtitle="Cited answers about this client's market" />
        <p className="text-xs text-[var(--text-muted)]">
          Select a project to research its market.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Market Research"
        subtitle="Cited answers built from this client's crawl and a live web search"
      />

      <div className="flex flex-col gap-5 lg:flex-row">
        <div className="min-w-0 flex-1 space-y-4">
          {turns.length === 0 && !isPending && (
            <EmptyState prompts={suggested.data ?? []} onPick={ask} />
          )}

          {turns.map((turn, i) => (
            <AnswerBlock
              key={`${i}-${turn.question}`}
              turn={turn}
              sourceNumber={sourceNumber}
              onOpenSource={setOpenSource}
            />
          ))}

          {pendingQuestion && (
            <ResearchActivity question={pendingQuestion} progress={progress} />
          )}

          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
              <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-600" />
              <p className="text-xs leading-relaxed text-[var(--text-primary)]">{error}</p>
            </div>
          )}

          <Composer
            value={draft}
            onChange={setDraft}
            onSubmit={() => ask(draft)}
            isPending={isPending}
            isFollowUp={turns.length > 0}
          />
        </div>

        <SourcesRail
          sources={sources}
          openSource={openSource}
          onOpenSource={setOpenSource}
          isPending={isPending}
        />
      </div>
    </div>
  );
}
