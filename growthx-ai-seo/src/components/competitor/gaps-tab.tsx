"use client";

import { useMemo, useState } from "react";
import { PlanModal } from "@/components/competitor/plan-modal";
import { useQuery } from "@tanstack/react-query";
import { ClipboardList, ExternalLink, Loader2 } from "lucide-react";
import { ActionButton, Kpi, Panel, Pill } from "@/components/ui/console";
import { useProgrammaticMatrix } from "@/hooks/use-growthx";
import { api, type TrackedCompetitor } from "@/lib/api-client";
import { buildGapItems, buildGapPlan, type GapItem, type GapKind } from "@/lib/gaps-plain";
import { stagingEngine } from "@/lib/staging-engine";

const SECTIONS: Array<{ kind: GapKind; title: string; explain: string }> = [
  {
    kind: "topic",
    title: "Topics they have a page for, and you don't",
    explain: "When someone searches for one of these, Google can show your competitor's page. It can't show yours, because you don't have one yet.",
  },
  {
    kind: "pageType",
    title: "Kinds of pages they have more of",
    explain: "More pages of the right kind means more searches they can show up for.",
  },
  {
    kind: "series",
    title: "Sets of similar pages they publish",
    explain: "Some competitors make a whole family of pages from one idea, for example one page per city or one per comparison.",
  },
  {
    kind: "question",
    title: "Customer questions they answer",
    explain: "Google and AI assistants like ChatGPT answer people's questions using websites that answer them clearly.",
  },
  {
    kind: "schema",
    title: "Extra details they give Google",
    explain: "Hidden labels on a page that tell Google things like star ratings, prices or opening hours, so it can show them in search results.",
  },
  {
    kind: "depth",
    title: "How detailed their pages are",
    explain: "Google prefers the page that answers a visitor's questions most completely.",
  },
];

const SHOWN_PER_SECTION = 6;

const safeUrl = (url: string) => (/^https?:\/\//.test(url) ? url : undefined);

/**
 * What competitors have that you don't, in plain words.
 *
 * Replaces the technical pattern view: every item says what they have, what
 * you have, why it brings them customers and what to do, and becomes a plan
 * that can be handed to whoever edits the website.
 */
export function GapsTab({
  projectId,
  domain,
  competitors,
  onOpenCounterMoves,
}: {
  projectId: string;
  domain: string;
  competitors: TrackedCompetitor[];
  onOpenCounterMoves: () => void;
}) {
  const [rivalFilter, setRivalFilter] = useState<string>("all");
  const [expanded, setExpanded] = useState<Set<GapKind>>(new Set());
  const [planFor, setPlanFor] = useState<GapItem | null>(null);

  const facts = useQuery({
    queryKey: ["rival-advantages", projectId],
    queryFn: () => api.getRivalAdvantages(projectId),
    enabled: Boolean(projectId),
    staleTime: 5 * 60 * 1000,
  });
  const series = useProgrammaticMatrix(projectId);

  const rivals = useMemo(() => facts.data?.rivals ?? [], [facts.data]);
  const items = useMemo(() => buildGapItems(rivals, series.data?.clusters ?? []), [rivals, series.data]);
  const shown = rivalFilter === "all" ? items : items.filter((i) => i.rivalDomain === rivalFilter);
  const waiting = rivals.filter((r) => !r.advantages).map((r) => r.name);

  const count = (kind: GapKind) => shown.filter((i) => i.kind === kind).length;
  const topicsMissing = rivals
    .filter((r) => rivalFilter === "all" || r.domain === rivalFilter)
    .reduce((n, r) => n + (r.advantages?.missingTopicsTotal ?? 0), 0);

  return (
    <div className="space-y-4">
      <Panel
        title="What your competitors have that you don't"
        subtitle="We read every page of your website and your competitors' websites. Below is everything they offer that your website doesn't have yet. Each one is a chance to be found by more customers."
        padded
      >
        <ol className="grid grid-cols-1 gap-2 text-[12px] text-brand-600 md:grid-cols-3">
          {[
            "Look through the list. The most important items are at the top of each section.",
            'Click "Get a plan" on anything you want to do. You get simple steps.',
            "Do it yourself, or send the plan to whoever edits your website.",
          ].map((step, i) => (
            <li key={step} className="flex items-start gap-2 rounded-lg bg-brand-50 p-3">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-950 text-[11px] font-semibold text-white">
                {i + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
        {competitors.length > 1 && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-[11px] text-brand-400">Show:</span>
            {[{ domain: "all", name: "All competitors" }, ...rivals].map((r) => (
              <button
                key={r.domain}
                type="button"
                onClick={() => setRivalFilter(r.domain)}
                aria-pressed={rivalFilter === r.domain}
                className={`rounded-full border px-3 py-1 text-[12px] ${
                  rivalFilter === r.domain ? "bg-brand-950 text-white" : "text-brand-700 hover:bg-brand-50"
                }`}
              >
                {r.name}
              </button>
            ))}
          </div>
        )}
      </Panel>

      {facts.isLoading ? (
        <Panel padded>
          <p className="flex items-center justify-center gap-2 py-6 text-[12px] text-brand-500">
            <Loader2 size={14} className="animate-spin" /> Comparing your website with your competitors…
          </p>
        </Panel>
      ) : facts.error ? (
        <Panel padded>
          <p className="py-4 text-center text-[12px] text-error-600">
            Couldn&apos;t load the comparison: {(facts.error as Error).message}
          </p>
        </Panel>
      ) : !facts.data?.you?.crawledAt ? (
        <Panel padded>
          <p className="py-4 text-center text-[12px] text-brand-600">
            We haven&apos;t read your website yet. Click <span className="font-semibold">Run audit</span> at the top, then come back
            here.
          </p>
        </Panel>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi label="Topics you're missing" value={String(topicsMissing)} sub="pages they have, you don't" />
            <Kpi label="Kinds of pages behind" value={String(count("pageType"))} sub="e.g. city or service pages" />
            <Kpi label="Question gaps" value={String(count("question"))} sub="competitors answering more questions" />
            <Kpi label="Google extras missing" value={String(count("schema"))} sub="ratings, prices, FAQs…" />
          </div>

          {waiting.length > 0 && (
            <Panel padded>
              <p className="text-[12px] text-brand-600">
                Still reading {waiting.join(", ")}&apos;s website. Their gaps will appear here once that finishes.
              </p>
            </Panel>
          )}

          {shown.length === 0 && waiting.length === 0 && (
            <Panel padded>
              <p className="py-4 text-center text-[12px] text-brand-600">
                Good news: we found nothing your competitors have that you don&apos;t.
              </p>
            </Panel>
          )}

          {SECTIONS.map((section) => {
            const list = shown.filter((i) => i.kind === section.kind);
            if (!list.length) return null;
            const open = expanded.has(section.kind);
            const visible = open ? list : list.slice(0, SHOWN_PER_SECTION);
            return (
              <Panel key={section.kind} title={`${section.title} (${list.length})`} subtitle={section.explain} padded>
                <ul className="space-y-2">
                  {visible.map((item) => (
                    <GapRow key={item.id} item={item} showRival={rivalFilter === "all"} onPlan={() => setPlanFor(item)} />
                  ))}
                </ul>
                {list.length > SHOWN_PER_SECTION && (
                  <button
                    type="button"
                    onClick={() =>
                      setExpanded((prev) => {
                        const next = new Set(prev);
                        if (open) next.delete(section.kind);
                        else next.add(section.kind);
                        return next;
                      })
                    }
                    className="mt-3 text-[12px] font-semibold text-brand-700 hover:underline"
                  >
                    {open ? "Show fewer" : `Show all ${list.length}`}
                  </button>
                )}
              </Panel>
            );
          })}
        </>
      )}

      {planFor && (
        <PlanModal
          subtitle={`${planFor.rival} · ${planFor.headline}`}
          why={planFor.why}
          steps={planFor.steps}
          plan={buildGapPlan(planFor, { domain })}
          onClose={() => setPlanFor(null)}
          onSave={(plan) => {
            stagingEngine.stage(projectId, {
              title: planFor.headline,
              category: "Competitor Intelligence",
              source: "COMPETITOR_CONTENT",
              priority: planFor.kind === "topic" || planFor.kind === "pageType" ? "HIGH" : "MEDIUM",
              impact: planFor.why,
              effortHours: 2,
              deliverable: plan,
              evidence: `${planFor.rival} · counted from both websites`,
            });
            setPlanFor(null);
            onOpenCounterMoves();
          }}
        />
      )}
    </div>
  );
}

function GapRow({ item, showRival, onPlan }: { item: GapItem; showRival: boolean; onPlan: () => void }) {
  const href = item.example ? safeUrl(item.example.url) : undefined;
  return (
    <li className="flex flex-col gap-2 rounded-xl border p-3 md:flex-row md:items-center">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[13px] font-semibold text-brand-950">{item.headline}</p>
          {showRival && <Pill>{item.rival}</Pill>}
        </div>
        <p className="mt-0.5 text-[12px] text-brand-600">{item.why}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {href && (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[12px] text-brand-600 hover:text-brand-950 hover:underline"
          >
            {item.example!.label} <ExternalLink size={11} />
          </a>
        )}
        <ActionButton icon={<ClipboardList size={13} />} onClick={onPlan}>
          Get a plan
        </ActionButton>
      </div>
    </li>
  );
}
