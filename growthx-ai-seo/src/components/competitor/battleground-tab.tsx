"use client";

import { useMemo, useState } from "react";
import { Loader2, Plus, RotateCw, X } from "lucide-react";
import { CompetitorWebsitesPanel } from "@/components/competitor/competitor-websites-panel";
import { ActionButton, Kpi, Panel, Pill, relativeTime } from "@/components/ui/console";
import { type TrackedCompetitor } from "@/lib/api-client";
import { useLatestCrawl } from "@/hooks/use-growthx";
import {
  LOW_SAMPLE,
  bestRival,
  buildMetrics,
  type Metric,
  type RivalInput,
} from "@/lib/battleground";

const MAX_RIVALS = 5;

interface BattlegroundTabProps {
  projectId: string;
  domain: string;
  brand: string;
  competitors: TrackedCompetitor[];
  onAddCompetitor: () => void;
  onRemoveCompetitor: (competitor: TrackedCompetitor) => void;
  onOpenCounterMoves: () => void;
  onRecrawlCompetitor?: (competitorId: string, domain: string) => void;
}

function EmptyNote({ title, message }: { title: string; message: string }) {
  return (
    <div className="py-6 text-center">
      <p className="text-[13px] font-semibold text-brand-950">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-[12px] leading-relaxed text-brand-500">{message}</p>
    </div>
  );
}

function SourceBadge({ metric }: { metric: Pick<Metric, "source" | "sample" | "key"> }) {
  const low = metric.key === "ai" && (metric.sample ?? 0) < LOW_SAMPLE;
  const label =
    metric.key === "ai" && metric.sample != null
      ? low
        ? `Based on only ${metric.sample} AI answers`
        : `From ${metric.sample} AI answers`
      : SOURCE_LABEL[metric.source] ?? metric.source;
  return <Pill tone={low ? "warn" : "info"}>{label}</Pill>;
}

/** Where a number came from, in words. */
const SOURCE_LABEL: Record<string, string> = {
  Crawled: "From their website",
  "AI sampled": "From AI answers",
  "Google Places": "From Google",
};

export function BattlegroundTab({
  projectId,
  domain,
  competitors,
  onAddCompetitor,
  onRemoveCompetitor,
  onRecrawlCompetitor,
}: BattlegroundTabProps) {
  const ourCrawl = useLatestCrawl(domain || null);
  // While a recrawl of your site runs, compare with the last completed one;
  // the running crawl has read only part of the site.
  const ourFigures = ourCrawl.data?.lastCompleted ?? ourCrawl.data ?? null;

  const [selected, setSelected] = useState<string[] | null>(null);
  const selectedIds = selected ?? competitors.slice(0, MAX_RIVALS).map((c) => c.id);
  const rivals = competitors.filter((c) => selectedIds.includes(c.id));

  const rivalInputs: RivalInput[] = useMemo(
    () =>
      rivals.map((c) => ({
        id: c.id,
        name: c.name || c.label || c.domain,
        domain: c.domain,
        pagesCrawled: c.pagesCrawled && c.pagesCrawled > 0 ? c.pagesCrawled : null,
        healthScore: c.healthScore ?? null,
        aiNamed: c.aiMentions?.named ?? null,
        aiAnswers: c.aiMentions?.answers ?? null,
        rating: c.rating ?? null,
        reviewCount: c.reviewCount ?? null,
        lastAnalyzedAt: c.lastAnalyzedAt,
      })),
    [rivals],
  );

  const metrics = useMemo(
    () =>
      buildMetrics(
        {
          domain,
          pagesCrawled: ourFigures?.pagesCrawled ?? null,
          healthScore: ourFigures?.healthScore ?? null,
          aiSharePct: null,
          aiChecked: null,
          rating: null,
          reviewCount: null,
        },
        rivalInputs,
      ),
    [domain, ourFigures, rivalInputs],
  );

  const toggleRival = (id: string) => {
    const current = selectedIds;
    if (current.includes(id)) setSelected(current.filter((x) => x !== id));
    else if (current.length < MAX_RIVALS) setSelected([...current, id]);
  };

  if (competitors.length === 0) {
    return (
      <Panel padded>
        <EmptyNote
          title="No competitors added yet"
          message="Add a competitor to see who you are winning and losing against, and what to do about it."
        />
        <div className="mt-3 flex justify-center">
          <ActionButton variant="primary" icon={<Plus size={13} />} onClick={onAddCompetitor}>
            Add competitor
          </ActionButton>
        </div>
      </Panel>
    );
  }

  return (
    <div className="space-y-4">
      {/* Competitor pick-list: toggling one off drops it from the scoreboard */}
      <div className="flex flex-wrap items-center gap-2">
        {competitors.map((c) => {
          const on = selectedIds.includes(c.id);
          const full = !on && selectedIds.length >= MAX_RIVALS;
          const name = c.name || c.label || c.domain;
          const reading = c.crawlStatus === "RUNNING" || c.crawlStatus === "PENDING";
          return (
            <span
              key={c.id}
              className={`inline-flex items-center rounded-lg border text-[12px] font-medium transition-colors ${
                on ? "bg-white text-brand-950" : "bg-brand-50 text-brand-400"
              }`}
            >
              <button
                type="button"
                onClick={() => toggleRival(c.id)}
                disabled={full}
                title={full ? `Compare up to ${MAX_RIVALS} competitors at once` : undefined}
                className={`inline-flex items-center gap-1.5 py-1.5 pl-3 pr-1.5 disabled:opacity-40 ${on ? "" : "line-through"}`}
              >
                {name}
                {reading ? (
                  <Loader2 size={11} className="animate-spin text-primary-600" aria-label="Reading their website" />
                ) : c.crawlError ? (
                  <span className="h-1.5 w-1.5 rounded-full bg-error-600" title={`Couldn't read their website: ${c.crawlError}`} />
                ) : null}
              </button>
              <button
                type="button"
                onClick={() => onRecrawlCompetitor?.(c.id, c.domain)}
                disabled={reading}
                aria-label={`Re-crawl ${name}`}
                title={reading ? "Currently reading their website" : `Re-crawl ${name}'s website`}
                className="rounded-md p-1 text-brand-400 hover:bg-brand-100 hover:text-brand-950 disabled:opacity-40 transition-colors"
              >
                <RotateCw size={11} className={reading ? "animate-spin text-signal-400" : ""} />
              </button>
              <button
                type="button"
                onClick={() => onRemoveCompetitor(c)}
                aria-label={`Remove ${name}`}
                title={`Stop tracking ${name}`}
                className="mr-1 rounded-md p-1 text-brand-400 hover:bg-error-50 hover:text-error-600"
              >
                <X size={12} />
              </button>
            </span>
          );
        })}
        <ActionButton variant="secondary" icon={<Plus size={13} />} onClick={onAddCompetitor}>
          Add competitor
        </ActionButton>
        <span className="ml-auto text-[11px] text-brand-400">
          We last read your website: {ourFigures?.finishedAt ? relativeTime(ourFigures.finishedAt) : "not yet"}
        </span>
      </div>

      {/* Scoreboard: you vs your best rival on each measure */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {metrics.map((m) => {
          const best = bestRival(m);
          const delta = m.you != null && best?.value != null ? Number((m.you - best.value).toFixed(m.key === "rating" ? 1 : 0)) : null;
          return (
            <Kpi
              key={m.key}
              label={m.label}
              value={m.you != null ? m.short(m.you) : "—"}
              delta={delta}
              deltaSuffix={m.key === "ai" ? "%" : ""}
              sub={
                <span className="flex flex-col items-start gap-1.5">
                  <span>
                    {m.you == null
                      ? "No data for you yet"
                      : best?.value != null
                        ? `Best competitor: ${best.name}, ${m.key === "ai" ? `named in ${m.format(best.value)} of answers` : m.format(best.value)}`
                        : "No competitor data yet"}
                  </span>
                  <SourceBadge metric={m} />
                </span>
              }
            />
          );
        })}
      </div>
      <p className="text-[11px] text-brand-400">These comparisons use audited URLs and website health. They do not measure competitor Google rankings or market share.</p>

      <CompetitorWebsitesPanel projectId={projectId} onRecrawl={onRecrawlCompetitor} />
    </div>
  );
}
