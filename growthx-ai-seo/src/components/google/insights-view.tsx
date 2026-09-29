"use client";
import { Panel, Pill } from "@/components/ui/console";
import { Gate } from "@/components/google/view-kit";
import { Headlines } from "@/components/google/parts";
import { useGoogleOverview, useGrowthIntelligence } from "@/hooks/use-google";
import { useWorkspace } from "@/hooks/use-growthx";
import type { IntelligenceFinding } from "@/lib/api-client";
import { count, pathOf } from "@/lib/google-format";

const SEVERITY = { CRITICAL: "bad", HIGH: "bad", MEDIUM: "warn", LOW: "default" } as const;

function Findings({ title, items }: { title: string; items: IntelligenceFinding[] }) {
  if (items.length === 0) return null;
  return (
    <Panel title={title}>
      <ul className="divide-y">
        {items.slice(0, 10).map((f) => (
          <li key={f.id} className="px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <Pill tone={SEVERITY[f.severity]}>{f.severity.toLowerCase()}</Pill>
              <span className="text-[13px] font-semibold text-brand-950">{f.what}</span>
            </div>
            {f.url && <p className="mt-0.5 font-mono text-[10.5px] text-brand-400">{pathOf(f.url)}</p>}
            <p className="mt-1 text-[12px] text-brand-600"><span className="font-semibold text-brand-950">Why: </span>{f.why}</p>
            <p className="mt-1 text-[12px] text-brand-600"><span className="font-semibold text-brand-950">What to do: </span>{f.action}</p>
            {f.potentialClicks !== null && <p className="mt-1 text-[11px] text-brand-400">Potential: about {count(f.potentialClicks)} more clicks (estimate).</p>}
          </li>
        ))}
      </ul>
    </Panel>
  );
}

/** What happened, why, the evidence, and what to do, across search, traffic and technical health. */
export function InsightsView() {
  const { projectId } = useWorkspace();
  const overview = useGoogleOverview(projectId);
  const intel = useGrowthIntelligence(projectId);

  return (
    <div className="space-y-4">
      <Gate query={intel.query} what="insights">
        {(r) => (
          <>
            <Panel title="Summary" subtitle={`Last ${r.windowDays} days · ${r.counts.problems} problems, ${r.counts.opportunities} opportunities, ${r.counts.risks} risks`}>
              <div className="space-y-1.5 p-4">
                <p className="text-[13px] leading-snug text-brand-950">{r.answer.summary}</p>
                <p className="text-[11px] text-brand-500">{r.answer.confidenceNote}</p>
              </div>
            </Panel>
            <Findings title="Problems" items={r.problems} />
            <Findings title="Risks" items={r.risks} />
            <Findings title="Opportunities" items={r.opportunities} />
            {r.notMeasured.length > 0 && (
              <Panel title="Not measured">
                <ul className="space-y-1 p-4 text-[12px] text-brand-500">
                  {r.notMeasured.map((n) => (
                    <li key={n.source}><span className="font-semibold text-brand-700">{n.source}</span>: {n.reason ?? "no data"}</li>
                  ))}
                </ul>
              </Panel>
            )}
          </>
        )}
      </Gate>
      <Gate query={overview.query} what="headlines">{(o) => <Headlines headlines={o.headlines} />}</Gate>
    </div>
  );
}
