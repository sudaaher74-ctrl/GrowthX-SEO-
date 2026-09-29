"use client";
import { RefreshCw } from "lucide-react";
import { ActionButton, Kpi, Panel, Pill, Table, Td, Th, Tr } from "@/components/ui/console";
import { NotConnectedState } from "@/components/ui/truthful-state";
import { Caveat, EmptyNote, Gate } from "@/components/google/view-kit";
import { SourceBadge } from "@/components/google/parts";
import { useIndexStatus } from "@/hooks/use-google";
import { useWorkspace } from "@/hooks/use-growthx";
import { errorMessage } from "@/lib/error-message";
import { count, pathOf } from "@/lib/google-format";

/** From discovered to receiving traffic, with what Google itself says about each page. */
export function IndexView() {
  const { projectId } = useWorkspace();
  const { query, inspect } = useIndexStatus(projectId);

  return (
    <Gate query={query} what="index status">
      {(r) => {
        if (!r.connected) {
          return (
            <NotConnectedState
              title="Connect Search Console to see index status"
              missing="Only Search Console can say whether Google has indexed a page."
              whyItMatters="A page that is not indexed cannot rank, however good it is."
              actionRequired="Connect Search Console and choose your property."
              action={{ label: "Open Integrations", href: "/integrations" }}
            />
          );
        }
        const u = r.urlSets;
        const stages = [
          { label: "Discovered", value: u.discovered, source: "GrowthX" as const },
          { label: "In sitemap", value: u.inSitemap, source: "GrowthX" as const },
          { label: "Crawled", value: u.crawled, source: "GrowthX" as const },
          { label: "Indexable (our check)", value: u.indexableByOurCheck, source: "GrowthX" as const },
          { label: "Indexed by Google", value: u.indexedByGoogle, source: "GSC" as const },
          { label: "Seen in search, 28d", value: u.seenInGoogleSearchLast28Days, source: "GSC" as const },
        ];
        const max = Math.max(...stages.map((s) => s.value), 1);
        return (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[12px] text-brand-500">
                {r.lastInspectedAt ? `Last inspected ${new Date(r.lastInspectedAt).toLocaleString()}.` : "No page has been inspected yet."}
                {r.quota ? ` Inspection quota today: ${r.quota.usedToday} of ${r.quota.perDay}.` : ""}
              </p>
              <ActionButton disabled={inspect.isPending} icon={<RefreshCw size={12} className={inspect.isPending ? "animate-spin" : undefined} />} onClick={() => inspect.mutate()}>
                {inspect.isPending ? "Inspecting…" : "Check index status"}
              </ActionButton>
            </div>
            {inspect.error && <p className="rounded-lg border border-error-200 bg-error-50 px-3 py-2 text-[12px] text-error-700">{errorMessage(inspect.error)}</p>}

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Kpi label="Indexed" value={count(r.totals.indexed)} tone="good" aside={<SourceBadge source="GSC" />} sub={`of ${count(r.totals.asked)} inspected`} />
              <Kpi label="Not indexed" value={count(r.totals.notIndexed)} tone={r.totals.notIndexed > 0 ? "danger" : "default"} aside={<SourceBadge source="GSC" />} />
              <Kpi label="Could not check" value={count(r.totals.couldNotCheck)} aside={<SourceBadge source="GSC" />} />
              <Kpi label="Not inspected yet" value={count(r.totals.notYetAsked)} aside={<SourceBadge source="GSC" />} />
            </div>

            <Panel title="From crawled to receiving traffic" subtitle="Each step counts URLs; a big drop between steps is where pages are being lost.">
              <ol className="divide-y">
                {stages.map((s) => (
                  <li key={s.label} className="px-4 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[12.5px] font-semibold text-brand-950">{s.label}</span>
                        <SourceBadge source={s.source} />
                      </div>
                      <span className="font-mono text-[15px] font-bold text-brand-950">{count(s.value)}</span>
                    </div>
                    <div className="mt-2 h-1.5 w-full rounded-full bg-brand-100">
                      <div className="h-1.5 rounded-full bg-primary-600" style={{ width: `${Math.max((s.value / max) * 100, s.value > 0 ? 1.5 : 0)}%` }} />
                    </div>
                  </li>
                ))}
              </ol>
            </Panel>

            <Panel title="Indexing issues" subtitle="Pages grouped by the reason Google gives.">
              {r.groups.length === 0 ? (
                <EmptyNote>Nothing has been inspected yet. Use Check index status.</EmptyNote>
              ) : (
                <Table minWidth={640}>
                  <thead>
                    <tr>
                      <Th>Google&apos;s status</Th>
                      <Th align="right">Pages</Th>
                      <Th>What it means</Th>
                      <Th>What to do</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.groups.map((g) => (
                      <Tr key={g.coverageState}>
                        <Td>
                          <div className="flex items-center gap-2">
                            <span className="text-[12px]">{g.coverageState}</span>
                            {g.verdict && <Pill tone={g.verdict === "PASS" ? "good" : "warn"}>{g.verdict}</Pill>}
                          </div>
                        </Td>
                        <Td align="right">{count(g.count)}</Td>
                        <Td><span className="text-[11.5px] text-brand-600">{g.meaning}</span></Td>
                        <Td><span className="text-[11.5px] text-brand-600">{g.action ?? "—"}</span></Td>
                      </Tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </Panel>

            {r.indexableButNotIndexed.length > 0 && (
              <Panel title="Indexable but not indexed" subtitle="Nothing on the page stops Google indexing it, and it has not.">
                <Table minWidth={560}>
                  <thead>
                    <tr>
                      <Th>Page</Th>
                      <Th>Google&apos;s status</Th>
                      <Th>What to do</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.indexableButNotIndexed.slice(0, 25).map((p) => (
                      <Tr key={p.url}>
                        <Td><span className="block max-w-[320px] truncate font-mono text-[11.5px]" title={p.url}>{pathOf(p.url)}</span></Td>
                        <Td>{p.coverageState ?? "—"}</Td>
                        <Td><span className="text-[11.5px] text-brand-600">{p.action ?? p.meaning}</span></Td>
                      </Tr>
                    ))}
                  </tbody>
                </Table>
              </Panel>
            )}

            {r.canonicalOverridden.length > 0 && (
              <Panel title="Google chose a different canonical" subtitle="The page declares one address; Google indexed another.">
                <Table minWidth={560}>
                  <thead>
                    <tr>
                      <Th>Page</Th>
                      <Th>You declared</Th>
                      <Th>Google chose</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.canonicalOverridden.slice(0, 25).map((p) => (
                      <Tr key={p.url}>
                        <Td><span className="block max-w-[260px] truncate font-mono text-[11.5px]" title={p.url}>{pathOf(p.url)}</span></Td>
                        <Td><span className="block max-w-[260px] truncate font-mono text-[11.5px]">{p.declared ? pathOf(p.declared) : "—"}</span></Td>
                        <Td><span className="block max-w-[260px] truncate font-mono text-[11.5px]">{p.googleChose ? pathOf(p.googleChose) : "—"}</span></Td>
                      </Tr>
                    ))}
                  </tbody>
                </Table>
              </Panel>
            )}
            <Caveat>Google limits how many pages can be inspected per day, so large sites are checked in batches. “Not inspected yet” pages are unknown, not unindexed.</Caveat>
          </div>
        );
      }}
    </Gate>
  );
}
