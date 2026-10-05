"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ClipboardList, ExternalLink, Loader2, RotateCw } from "lucide-react";
import { PlanModal } from "@/components/competitor/plan-modal";
import { ActionButton, Kpi, Panel, Pill, relativeTime } from "@/components/ui/console";
import { api, type RivalMove, type TrackedCompetitor } from "@/lib/api-client";
import { buildRadarPlan, KIND_LABEL, toRadarItem, type RadarItem } from "@/lib/radar-plain";
import { stagingEngine } from "@/lib/staging-engine";

const KIND_TONE: Record<RivalMove["kind"], "default" | "good" | "bad" | "warn" | "info"> = {
  NEW_PAGE: "info",
  EXPANDED: "info",
  RETITLED: "default",
  SCHEMA_ADDED: "default",
  PAGE_GONE: "good",
  AI_NAMED: "warn",
};

/**
 * Rival Radar: what competitors changed recently, in plain words, each with
 * a plan to respond.
 */
export function RivalRadarTab({
  projectId,
  domain,
  onOpenCounterMoves,
  onRecrawlCompetitor,
  competitors,
}: {
  projectId: string;
  domain: string;
  onOpenCounterMoves: () => void;
  onRecrawlCompetitor?: (competitorId: string, domain: string) => void;
  competitors?: TrackedCompetitor[];
}) {
  const qc = useQueryClient();
  const [kind, setKind] = useState<RivalMove["kind"] | "all">("all");
  const [rival, setRival] = useState<string>("all");
  const [planFor, setPlanFor] = useState<RadarItem | null>(null);
  const [recrawlingDomain, setRecrawlingDomain] = useState<string | null>(null);
  const [recrawlNote, setRecrawlNote] = useState<string | null>(null);

  const feed = useQuery({
    queryKey: ["rival-moves", projectId],
    queryFn: () => api.getRivalMoves(projectId),
    enabled: Boolean(projectId),
    staleTime: 5 * 60 * 1000,
  });

  const handleRecrawlFocus = async (focusDomain: string) => {
    setRecrawlingDomain(focusDomain);
    setRecrawlNote(`Starting re-crawl for ${focusDomain}…`);
    try {
      const match = competitors?.find((c) => c.domain === focusDomain);
      if (match) {
        await api.crawlCompetitorSite(projectId, match.id, { force: true });
        onRecrawlCompetitor?.(match.id, focusDomain);
      } else {
        const list = await api.listCompetitors(projectId);
        const comp = list.find((c) => c.domain === focusDomain);
        if (comp) {
          await api.crawlCompetitorSite(projectId, comp.id, { force: true });
          onRecrawlCompetitor?.(comp.id, focusDomain);
        }
      }
      qc.invalidateQueries({ queryKey: ["rival-moves", projectId] });
      qc.invalidateQueries({ queryKey: ["competitors", projectId] });
      qc.invalidateQueries({ queryKey: ["competitor-websites", projectId] });
      setRecrawlNote(`Re-crawl started for ${focusDomain}. Latest changes update automatically.`);
      setTimeout(() => setRecrawlNote(null), 5000);
    } catch (e: any) {
      setRecrawlNote(`Could not re-crawl: ${e?.message || "Please try again."}`);
      setTimeout(() => setRecrawlNote(null), 6000);
    } finally {
      setRecrawlingDomain(null);
    }
  };

  const allItems = useMemo(() => (feed.data?.moves ?? []).map(toRadarItem), [feed.data]);
  const watching = feed.data?.watching ?? [];
  const focus = watching.find((w) => w.domain === rival) ?? null;
  // Everything below follows the competitor picked: counts, filters and list.
  const items = focus ? allItems.filter((i) => i.rivalDomain === focus.domain) : allItems;
  const shown = kind === "all" ? items : items.filter((i) => i.kind === kind);
  const kinds = (Object.keys(KIND_LABEL) as RivalMove["kind"][]).filter((k) => items.some((i) => i.kind === k));
  const countOf = (k: RivalMove["kind"]) => items.filter((i) => i.kind === k).length;
  const changesFor = (domain: string) => allItems.filter((i) => i.rivalDomain === domain).length;
  const period = feed.data ? `${feed.data.windowDays} days` : "recent days";

  return (
    <div className="space-y-4">
      <Panel
        title="What your competitors changed recently"
        subtitle="We check your competitors' websites every day. When one of them makes a move, like a new page, a bigger page or a new headline, it shows up here with a simple plan to respond."
        padded
      >
        <p className="text-[11.5px] text-brand-500">
          Real data only: everything here comes from reading your competitors&apos; websites and asking AI assistants the
          questions your customers ask. Nothing is sample or made-up data, and each change says where and when it was seen.
        </p>
        {watching.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {[{ domain: "all", name: "All competitors" }, ...watching].map((w) => {
              const on = rival === w.domain;
              const n = w.domain === "all" ? allItems.length : changesFor(w.domain);
              return (
                <button
                  key={w.domain}
                  type="button"
                  aria-pressed={on}
                  onClick={() => {
                    setRival(w.domain);
                    setKind("all");
                  }}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11.5px] font-semibold transition-all ${
                    on
                      ? "bg-signal-400 text-signal-ink font-bold shadow-xs scale-[1.02]"
                      : "border bg-surface-1 text-brand-400 hover:text-brand-950 hover:bg-brand-100/50"
                  }`}
                  style={{ borderColor: on ? undefined : "var(--border-color)" }}
                >
                  {w.name} <span className={on ? "text-signal-ink/80" : "text-brand-400"}>· {n}</span>
                </button>
              );
            })}
          </div>
        )}
        {recrawlNote && (
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-signal-400/30 bg-signal-400/10 px-3.5 py-2 text-[11.5px] font-medium text-brand-950">
            <Loader2 size={13} className="animate-spin text-signal-400 shrink-0" />
            <span>{recrawlNote}</span>
          </div>
        )}
        {focus && (
          <div className="mt-3 grid grid-cols-1 gap-2 rounded-xl border bg-brand-50 p-3 text-[12px] sm:grid-cols-4">
            <div>
              <p className="text-[10.5px] font-semibold uppercase tracking-wide text-brand-400">Website last read</p>
              <p className="text-brand-950">
                {focus.lastCrawlAt ? `${relativeTime(focus.lastCrawlAt)}${focus.pagesRead ? `, ${focus.pagesRead} pages` : ""}` : "Not read yet"}
              </p>
            </div>
            <div>
              <p className="text-[10.5px] font-semibold uppercase tracking-wide text-brand-400">Last change spotted</p>
              <p className="text-brand-950">
                {items.length ? relativeTime(items[0].at) : focus.lastChangeAt ? relativeTime(focus.lastChangeAt) : `None in the last ${period}`}
              </p>
            </div>
            <div>
              <p className="text-[10.5px] font-semibold uppercase tracking-wide text-brand-400">Their website</p>
              <a href={`https://${focus.domain}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-brand-950 hover:underline">
                {focus.domain} <ExternalLink size={11} />
              </a>
            </div>
            <div className="flex flex-col justify-end">
              <button
                type="button"
                onClick={() => handleRecrawlFocus(focus.domain)}
                disabled={recrawlingDomain === focus.domain}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-brand-200/70 bg-surface-1 px-3 py-1.5 text-[11px] font-semibold text-brand-800 hover:bg-brand-50 hover:text-brand-950 transition-colors shadow-2xs disabled:opacity-50"
              >
                <RotateCw size={11} className={recrawlingDomain === focus.domain ? "animate-spin text-signal-400" : "text-brand-400"} />
                <span>{recrawlingDomain === focus.domain ? "Reading…" : "Re-crawl website"}</span>
              </button>
            </div>
          </div>
        )}
      </Panel>

      {feed.isLoading ? (
        <Panel padded>
          <p className="flex items-center justify-center gap-2 py-6 text-[12px] text-brand-500">
            <Loader2 size={14} className="animate-spin" /> Looking at what your competitors changed…
          </p>
        </Panel>
      ) : feed.error ? (
        <Panel padded>
          <p className="py-4 text-center text-[12px] text-error-600">Couldn&apos;t load the changes: {(feed.error as Error).message}</p>
        </Panel>
      ) : items.length === 0 ? (
        <Panel padded>
          <p className="py-4 text-center text-[12px] text-brand-600">
            No changes spotted{focus ? ` for ${focus.name}` : ""} in the last {period}.{" "}
            {feed.data?.watching.some((w) => w.lastCheckedAt)
              ? "Your competitors have been quiet. We'll keep checking every day."
              : "We haven't checked your competitors' websites yet. The first check runs within a day of adding them."}
          </p>
        </Panel>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi label={`Changes in ${period}`} value={String(items.length)} sub={focus ? focus.name : "across all competitors"} />
            <Kpi label="New pages" value={String(countOf("NEW_PAGE"))} sub="they started targeting new searches" />
            <Kpi label="AI recommended them" value={String(countOf("AI_NAMED"))} sub="competitors named instead of you" />
            <Kpi label="Pages they removed" value={String(countOf("PAGE_GONE"))} sub="visitors you could pick up" />
          </div>

          <Panel
            title={`Latest changes${focus ? ` · ${focus.name}` : ""} (${shown.length})`}
            subtitle="Newest first. Pick the ones that matter to your business and click Get a plan."
            padded
          >
            {kinds.length > 1 && (
              <div className="mb-3 flex flex-wrap gap-2">
                {(["all", ...kinds] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setKind(k)}
                    aria-pressed={kind === k}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11.5px] font-semibold transition-all ${
                      kind === k
                        ? "bg-signal-400 text-signal-ink font-bold shadow-xs scale-[1.02]"
                        : "border bg-surface-1 text-brand-400 hover:text-brand-950 hover:bg-brand-100/50"
                    }`}
                    style={{ borderColor: kind === k ? undefined : "var(--border-color)" }}
                  >
                    {k === "all" ? "All changes" : KIND_LABEL[k]}
                  </button>
                ))}
              </div>
            )}
            <ul className="space-y-2">
              {shown.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-col gap-2 rounded-xl border bg-surface-1 p-3.5 shadow-2xs transition-all hover:border-brand-300/40 md:flex-row md:items-center"
                  style={{ borderColor: "var(--border-color)" }}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Pill tone={KIND_TONE[item.kind]}>{KIND_LABEL[item.kind]}</Pill>
                      {!focus && <Pill>{item.rival}</Pill>}
                      <span className="text-[11px] text-brand-400">{relativeTime(item.at)}</span>
                    </div>
                    <p className="mt-1 text-[13px] font-semibold text-brand-950">{item.headline}</p>
                    <p className="mt-0.5 text-[12px] text-brand-600">{item.why}</p>
                    <p className="mt-1 text-[11px] text-brand-400">{item.seenBy}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {item.example && (
                      <a
                        href={item.example.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[12px] text-brand-600 hover:text-brand-950 hover:underline"
                      >
                        See their page <ExternalLink size={11} />
                      </a>
                    )}
                    <ActionButton icon={<ClipboardList size={13} />} onClick={() => setPlanFor(item)}>
                      Get a plan
                    </ActionButton>
                  </div>
                </li>
              ))}
            </ul>
          </Panel>
        </>
      )}

      {planFor && (
        <PlanModal
          subtitle={`${planFor.rival} · ${planFor.seenBy}`}
          why={planFor.why}
          steps={planFor.steps}
          plan={buildRadarPlan(planFor, { domain })}
          onClose={() => setPlanFor(null)}
          onSave={(plan) => {
            stagingEngine.stage(projectId, {
              title: planFor.headline,
              category: "Competitor Intelligence",
              source: "COMPETITOR_CONTENT",
              priority: planFor.kind === "NEW_PAGE" || planFor.kind === "AI_NAMED" ? "HIGH" : "MEDIUM",
              impact: planFor.why,
              effortHours: 2,
              deliverable: plan,
              evidence: `${planFor.rival} · ${planFor.seenBy}`,
            });
            setPlanFor(null);
            onOpenCounterMoves();
          }}
        />
      )}
    </div>
  );
}
