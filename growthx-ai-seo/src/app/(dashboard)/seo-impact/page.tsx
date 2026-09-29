"use client";
import { useState } from "react";
import { ActionButton, PageHeader, Panel, Pill } from "@/components/ui/console";
import { FailedState, LoadingState } from "@/components/ui/truthful-state";
import { useMarkImplemented, useSeoImpact, useSeoImpactResult } from "@/hooks/use-google";
import { useWorkspace } from "@/hooks/use-growthx";
import type { SeoImpactChange, SeoImpactListItem } from "@/lib/api-client";
import { errorMessage } from "@/lib/error-message";

const VERDICT: Record<SeoImpactChange["verdict"], { label: string; tone: "good" | "bad" | "default" | "warn" }> = {
  IMPROVED: { label: "Improved", tone: "good" },
  WORSE: { label: "Got worse", tone: "bad" },
  NO_CLEAR_CHANGE: { label: "No clear change", tone: "default" },
  NOT_COMPARABLE: { label: "Cannot compare", tone: "warn" },
};

function fmt(v: number | null, unit: SeoImpactChange["unit"]): string {
  if (v === null) return "—";
  if (unit === "ratio") return `${(v * 100).toFixed(1)}%`;
  if (unit === "points") return `${v.toFixed(0)}%`;
  if (unit === "position") return v.toFixed(1);
  return v.toFixed(v < 10 ? 2 : 0);
}

/**
 * SEO Impact: each change you planned, the figures before it, and — once the
 * data has settled — the figures after. It reports what moved and what did not,
 * names the other changes made in the same period, and never claims the action
 * caused the movement.
 */
export default function SeoImpactPage() {
  const { projectId } = useWorkspace();
  const list = useSeoImpact(projectId);
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div className="space-y-4 pb-12">
      <PageHeader title="SEO Impact" subtitle="What changed after each action — before against after, from your real Search Console, Analytics, Business Profile and AI-visibility data." />
      {!projectId ? (
        <FailedState title="No website selected" error="Choose a client in the sidebar." />
      ) : list.isLoading ? (
        <LoadingState message="Loading planned changes…" />
      ) : list.isError ? (
        <FailedState title="Could not load changes" error={errorMessage(list.error)} onRetry={() => list.refetch()} />
      ) : (list.data ?? []).length === 0 ? (
        <Panel padded>
          <p className="text-[13px] text-brand-700">
            Nothing is being tracked yet. On the Intelligence page, choose <b>Track this change</b> on a recommendation: the figures as they stand now are saved, so the result can be compared honestly later.
          </p>
        </Panel>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
          <Panel title="Tracked changes">
            <ul className="divide-y divide-line">
              {list.data!.map((r) => (
                <li key={r.id}>
                  <button type="button" onClick={() => setSelected(r.id)} className={`w-full p-3 text-left hover:bg-brand-50 ${selected === r.id ? "bg-primary-50" : ""}`}>
                    <span className="block text-[12.5px] font-semibold text-brand-950">{r.action}</span>
                    <span className="block truncate font-mono text-[11px] text-brand-500">{r.url ?? "site-wide"}</span>
                    <span className="mt-1 inline-block"><Pill tone={r.status === "IMPLEMENTED" ? "info" : "default"}>{r.status.toLowerCase()}</Pill></span>
                  </button>
                </li>
              ))}
            </ul>
          </Panel>
          {selected ? <Result projectId={projectId} item={list.data!.find((r) => r.id === selected)!} /> : (
            <Panel padded><p className="text-[13px] text-brand-500">Choose a change to see its before and after.</p></Panel>
          )}
        </div>
      )}
    </div>
  );
}

function Result({ projectId, item }: { projectId: string; item: SeoImpactListItem }) {
  const result = useSeoImpactResult(projectId, item.id);
  const mark = useMarkImplemented(projectId);

  if (result.isLoading) return <LoadingState message="Comparing…" />;
  if (result.isError || !result.data) return <FailedState title="Could not compare" error={errorMessage(result.error)} onRetry={() => result.refetch()} />;
  const r = result.data;

  return (
    <div className="space-y-4">
      <Panel title={r.action} subtitle={r.url ?? "Site-wide change"} padded>
        <p className="text-[12.5px] text-brand-700">{r.readiness.message}</p>
        {r.readiness.state === "NOT_IMPLEMENTED" && (
          <div className="mt-3">
            <ActionButton onClick={() => mark.mutate(item.id, { onSuccess: () => result.refetch() })} disabled={mark.isPending}>
              {mark.isPending ? "Saving…" : "Mark as live today"}
            </ActionButton>
            {mark.isError && <p className="mt-2 text-[12px] text-error-700">{errorMessage(mark.error)}</p>}
          </div>
        )}
        <p className="mt-3 text-[11.5px] text-brand-500">
          Before: {r.before.range.start} → {r.before.range.end} ({r.before.range.days} days)
          {r.after && <> · After: {r.after.range.start} → {r.after.range.end} ({r.after.range.days} days)</>}
        </p>
      </Panel>

      {r.explanation && (
        <>
          <Panel title="Before and after">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-brand-500">
                  <th className="p-2">Metric</th><th className="p-2">Before</th><th className="p-2">After</th><th className="p-2">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {r.changes.map((c) => (
                  <tr key={c.key} title={c.reason}>
                    <td className="p-2 text-brand-950">{c.label}</td>
                    <td className="p-2 font-mono">{fmt(c.before, c.unit)}</td>
                    <td className="p-2 font-mono">{fmt(c.after, c.unit)}</td>
                    <td className="p-2"><Pill tone={VERDICT[c.verdict].tone}>{VERDICT[c.verdict].label}</Pill></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>

          <Panel title="What to make of it" padded>
            <div className="space-y-3 text-[12.5px] text-brand-700">
              <Block title="What changed" items={r.explanation.whatChanged} empty="No metric moved beyond normal variation." />
              <Block title="Improved" items={r.explanation.improved} empty="Nothing improved beyond normal variation." />
              <Block title="Did not improve" items={r.explanation.notImproved} empty="—" />
              <Block title="Could not be compared" items={r.explanation.notComparable} empty="—" />
              <Block title="Other changes in the same period" items={r.explanation.contributors} empty="None recorded." />
              <p className="rounded-md bg-brand-50 p-3 text-[12px] text-brand-600">{r.explanation.note}</p>
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}

function Block({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return (
    <div>
      <h4 className="mb-0.5 text-[11px] font-semibold uppercase tracking-wide text-brand-500">{title}</h4>
      {items.length === 0 ? <p>{empty}</p> : <ul className="list-disc pl-5">{items.map((i) => <li key={i}>{i}</li>)}</ul>}
    </div>
  );
}
