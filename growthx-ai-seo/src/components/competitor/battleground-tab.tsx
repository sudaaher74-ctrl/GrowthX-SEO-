"use client";

import { useState } from "react";
import { Loader2, Plus, RotateCw, X } from "lucide-react";
import { CompetitorWebsitesPanel } from "@/components/competitor/competitor-websites-panel";
import { ActionButton, Panel, relativeTime } from "@/components/ui/console";
import { type TrackedCompetitor } from "@/lib/api-client";
import { useLatestCrawl } from "@/hooks/use-growthx";

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
      {/* Competitor pick-list: toggle tracked competitors on or off */}
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

      <CompetitorWebsitesPanel projectId={projectId} onRecrawl={onRecrawlCompetitor} />
    </div>
  );
}
