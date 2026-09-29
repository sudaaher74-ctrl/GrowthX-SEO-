"use client";
import { Panel, Pill } from "@/components/ui/console";
import { NoDataState } from "@/components/ui/truthful-state";
import { Caveat, EmptyNote, Gate, SearchRowsTable } from "@/components/google/view-kit";
import { EvidenceChips } from "@/components/google/parts";
import { useGrowthOpportunities, useGscCtrOpportunities } from "@/hooks/use-google";
import { useWorkspace } from "@/hooks/use-growthx";
import { count, percent, pathOf } from "@/lib/google-format";

const BAND = { HIGH: "good", MEDIUM: "warn", LOW: "default" } as const;

/** What to do next, each with the evidence it was found from. */
export function OpportunitiesView() {
  const { projectId } = useWorkspace();
  const opps = useGrowthOpportunities(projectId);
  const ctr = useGscCtrOpportunities(projectId);

  return (
    <div className="space-y-4">
      <Panel title="Detected opportunities" subtitle="Found from your Search Console, Analytics and crawl data. Each shows what it was based on.">
        <Gate query={opps} what="opportunities">
          {(list) => {
            const rows = list.opportunities.filter((o) => o.source === "SEARCH_CONSOLE" || o.source === "ANALYTICS" || o.source === "WEBSITE");
            return rows.length === 0 ? (
              <div className="p-4">
                <NoDataState
                  compact
                  title="No opportunities detected yet"
                  missing="No open opportunity has been found from your Google data."
                  whyItMatters="Opportunities appear once Search Console and Analytics have data to reason from."
                  actionRequired="Refresh data, then press Refresh plan on the Fix Engine page."
                  action={{ label: "Open Fix Engine", href: "/fix-engine", variant: "secondary" }}
                />
              </div>
            ) : (
              <ul className="divide-y">
                {[...rows].sort((a, b) => b.priority - a.priority).slice(0, 20).map((o) => (
                  <li key={o.id} className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[13px] font-semibold text-brand-950">{o.title}</span>
                      <Pill tone={BAND[o.potential]}>{o.potential.toLowerCase()} potential</Pill>
                      <Pill>{o.effort.toLowerCase()} effort</Pill>
                    </div>
                    <p className="mt-1 text-[12px] text-brand-600">{o.summary}</p>
                    <EvidenceChips items={o.evidence.map((e) => ({ label: e.label, value: e.value, source: e.source === "SEARCH_CONSOLE" ? "GSC" : e.source === "ANALYTICS" ? "GA4" : "GrowthX" }))} />
                    <p className="mt-2 text-[12px] text-brand-950"><span className="font-semibold">Do this: </span>{o.recommendedAction}</p>
                    {o.affectedPages.length > 0 && (
                      <p className="mt-1 truncate font-mono text-[10.5px] text-brand-400">{o.affectedPages.slice(0, 3).map(pathOf).join(" · ")}{o.affectedPages.length > 3 ? ` +${o.affectedPages.length - 3}` : ""}</p>
                    )}
                  </li>
                ))}
              </ul>
            );
          }}
        </Gate>
      </Panel>

      <Panel title="CTR opportunities" subtitle="Queries that earn fewer clicks than their position normally would.">
        <Gate query={ctr.query} what="CTR opportunities">
          {(rows) =>
            rows.length === 0 ? (
              <EmptyNote>No query is well below the CTR expected for its position.</EmptyNote>
            ) : (
              <>
                <SearchRowsTable
                  rows={rows.slice(0, 25)}
                  label="Query"
                  extra={[
                    { header: "Expected CTR", cell: (r) => percent((r as (typeof rows)[number]).expectedCtr) },
                    { header: "Missed clicks", cell: (r) => count((r as (typeof rows)[number]).estimatedMissedClicks) },
                  ]}
                />
                <Caveat>Missed clicks are an estimate from typical CTR by position. A better title and description is the usual fix.</Caveat>
              </>
            )
          }
        </Gate>
      </Panel>
    </div>
  );
}
