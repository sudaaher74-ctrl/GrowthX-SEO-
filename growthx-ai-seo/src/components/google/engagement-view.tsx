"use client";
import { Kpi, Panel, Table, Td, Th, Tr } from "@/components/ui/console";
import { NoDataState } from "@/components/ui/truthful-state";
import { Caveat, EmptyNote, Gate } from "@/components/google/view-kit";
import { SourceBadge } from "@/components/google/parts";
import { useGa4Report } from "@/hooks/use-ga4-report";
import { useGooglePages } from "@/hooks/use-google";
import { useWorkspace } from "@/hooks/use-growthx";
import { DASH, count, duration, pathOf, percent } from "@/lib/google-format";

/** A page needs this many sessions before its rate is judged; a rate over a handful of visits is noise. */
const MIN_SESSIONS = 20;

/** What visitors do after they arrive, and the pages where it goes wrong. */
export function EngagementView() {
  const { projectId } = useWorkspace();
  const { report, days } = useGa4Report(projectId);
  const pages = useGooglePages(projectId);

  return (
    <Gate query={report} what="engagement">
      {(r) => {
        if (!r.data || r.data.empty) {
          return (
            <NoDataState
              compact
              title="No engagement data for this period"
              missing={r.message ?? `Google Analytics has no sessions for the last ${days} days.`}
              whyItMatters="Engagement is measured only by Google Analytics."
              actionRequired="Connect Google Analytics, then use Refresh data above."
              action={{ label: "Open Integrations", href: "/integrations" }}
            />
          );
        }
        const t = r.data.totals;
        const avg = t.engagementRate;
        const weak = r.data.landingPages
          .filter((p) => p.sessions >= MIN_SESSIONS && p.engagementRate < avg)
          .sort((a, b) => a.engagementRate - b.engagementRate)
          .slice(0, 15);
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Kpi label="Engagement rate" value={percent(avg)} aside={<SourceBadge source="GA4" />} sub="Sessions that lasted 10s+, converted, or had 2+ views" />
              <Kpi label="Engaged sessions" value={count(t.engagedSessions)} aside={<SourceBadge source="GA4" />} sub={`of ${count(t.sessions)} sessions`} />
              <Kpi label="Avg engagement time" value={duration(t.averageEngagementTimeSec)} aside={<SourceBadge source="GA4" />} sub="per active user" />
              <Kpi label="Views per session" value={t.sessions > 0 ? (t.views / t.sessions).toFixed(2) : DASH} aside={<SourceBadge source="GA4" />} sub={`${count(t.views)} views`} />
            </div>

            <Panel title="Where engagement is weakest" subtitle={`Landing pages, all channels, below the site rate of ${percent(avg)} with at least ${MIN_SESSIONS} sessions.`}>
              {weak.length === 0 ? (
                <EmptyNote>No landing page with enough sessions is below the site engagement rate.</EmptyNote>
              ) : (
                <Table minWidth={560}>
                  <thead>
                    <tr>
                      <Th>Landing page</Th>
                      <Th align="right">Sessions</Th>
                      <Th align="right">Engagement rate</Th>
                      <Th align="right">Below site rate</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {weak.map((p) => (
                      <Tr key={p.page}>
                        <Td><span className="block max-w-[380px] truncate font-mono text-[11.5px]" title={p.page}>{pathOf(p.page)}</span></Td>
                        <Td align="right">{count(p.sessions)}</Td>
                        <Td align="right">{percent(p.engagementRate)}</Td>
                        <Td align="right"><span className="font-mono text-[11px] text-error-600">−{((avg - p.engagementRate) * 100).toFixed(1)} pts</span></Td>
                      </Tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </Panel>

            <Panel title="Visitors from Google, by page" subtitle="Organic landing pages with how those visitors engaged, lowest engagement first.">
              <Gate query={pages.query} what="organic pages">
                {(p) => {
                  const rows = p.rows.filter((row) => row.ga && row.ga.sessions >= MIN_SESSIONS).sort((a, b) => a.ga!.engagementRate - b.ga!.engagementRate).slice(0, 25);
                  return rows.length === 0 ? (
                    <EmptyNote>No organic page has at least {MIN_SESSIONS} sessions with Analytics figures in this period.</EmptyNote>
                  ) : (
                    <Table minWidth={640}>
                      <thead>
                        <tr>
                          <Th>Page</Th>
                          <Th align="right">Organic sessions</Th>
                          <Th align="right">Engagement rate</Th>
                          <Th align="right">Avg engagement time</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row) => (
                          <Tr key={row.key}>
                            <Td><span className="block max-w-[380px] truncate font-mono text-[11.5px]" title={row.url}>{pathOf(row.url)}</span></Td>
                            <Td align="right">{count(row.ga!.sessions)}</Td>
                            <Td align="right">{percent(row.ga!.engagementRate)}</Td>
                            <Td align="right">{duration(row.ga!.averageEngagementTimeSec)}</Td>
                          </Tr>
                        ))}
                      </tbody>
                    </Table>
                  );
                }}
              </Gate>
              <Caveat>Bounce rate is not shown: Google Analytics 4 reports engagement rate instead, and bounce is simply its inverse.</Caveat>
            </Panel>
          </div>
        );
      }}
    </Gate>
  );
}
