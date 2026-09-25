"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ClipboardList, ExternalLink, Loader2 } from "lucide-react";
import { PlanModal } from "@/components/competitor/plan-modal";
import { ActionButton, Kpi, Panel, Pill, relativeTime } from "@/components/ui/console";
import { api, type RivalMove } from "@/lib/api-client";
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
}: {
  projectId: string;
  domain: string;
  onOpenCounterMoves: () => void;
}) {
  const [kind, setKind] = useState<RivalMove["kind"] | "all">("all");
  const [planFor, setPlanFor] = useState<RadarItem | null>(null);

  const feed = useQuery({
    queryKey: ["rival-moves", projectId],
    queryFn: () => api.getRivalMoves(projectId),
    enabled: Boolean(projectId),
    staleTime: 5 * 60 * 1000,
  });

  const items = useMemo(() => (feed.data?.moves ?? []).map(toRadarItem), [feed.data]);
  const shown = kind === "all" ? items : items.filter((i) => i.kind === kind);
  const kinds = (Object.keys(KIND_LABEL) as RivalMove["kind"][]).filter((k) => items.some((i) => i.kind === k));
  const countOf = (k: RivalMove["kind"]) => items.filter((i) => i.kind === k).length;
  const period = feed.data ? `${feed.data.windowDays} days` : "recent days";

  return (
    <div className="space-y-4">
      <Panel
        title="What your competitors changed recently"
        subtitle="We check your competitors' websites every day. When one of them makes a move, like a new page, a bigger page or a new headline, it shows up here with a simple plan to respond."
        padded
      >
        {feed.data && feed.data.watching.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {feed.data.watching.map((w) => (
              <span key={w.domain} className="rounded-full border px-3 py-1 text-[11.5px] text-brand-600">
                <span className="font-semibold text-brand-950">{w.name}</span> ·{" "}
                {w.lastCheckedAt ? `last checked ${relativeTime(w.lastCheckedAt)}` : "not checked yet"}
              </span>
            ))}
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
            No changes spotted in the last {period}.{" "}
            {feed.data?.watching.some((w) => w.lastCheckedAt)
              ? "Your competitors have been quiet. We'll keep checking every day."
              : "We haven't checked your competitors' websites yet. The first check runs within a day of adding them."}
          </p>
        </Panel>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi label={`Changes in ${period}`} value={String(items.length)} sub="across all competitors" />
            <Kpi label="New pages" value={String(countOf("NEW_PAGE"))} sub="they started targeting new searches" />
            <Kpi label="AI recommended them" value={String(countOf("AI_NAMED"))} sub="competitors named instead of you" />
            <Kpi label="Pages they removed" value={String(countOf("PAGE_GONE"))} sub="visitors you could pick up" />
          </div>

          <Panel
            title={`Latest changes (${shown.length})`}
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
                    className={`rounded-full border px-3 py-1 text-[12px] ${kind === k ? "bg-brand-950 text-white" : "text-brand-700 hover:bg-brand-50"}`}
                  >
                    {k === "all" ? "All changes" : KIND_LABEL[k]}
                  </button>
                ))}
              </div>
            )}
            <ul className="space-y-2">
              {shown.map((item) => (
                <li key={item.id} className="flex flex-col gap-2 rounded-xl border p-3 md:flex-row md:items-center">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Pill tone={KIND_TONE[item.kind]}>{KIND_LABEL[item.kind]}</Pill>
                      <span className="text-[11px] text-brand-400">{relativeTime(item.at)}</span>
                    </div>
                    <p className="mt-1 text-[13px] font-semibold text-brand-950">{item.headline}</p>
                    <p className="mt-0.5 text-[12px] text-brand-600">{item.why}</p>
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
