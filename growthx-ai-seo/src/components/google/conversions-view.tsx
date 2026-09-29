"use client";
import Link from "next/link";
import { Kpi, Panel, Table, Td, Th, Tr } from "@/components/ui/console";
import { NoDataState } from "@/components/ui/truthful-state";
import { Caveat, EmptyNote, Gate } from "@/components/google/view-kit";
import { SourceBadge } from "@/components/google/parts";
import { useGoogleOverview, useGooglePages } from "@/hooks/use-google";
import { useWorkspace } from "@/hooks/use-growthx";
import { DASH, count, formatKpi, money, pathOf, percent } from "@/lib/google-format";

/** Organic key events, conversion rate and revenue, and the pages that earn them. */
export function ConversionsView() {
  const { projectId } = useWorkspace();
  const overview = useGoogleOverview(projectId);
  const pages = useGooglePages(projectId);

  return (
    <Gate query={pages.query} what="conversions">
      {(p) => {
        if (!p.sources.analytics.hasOrganic) {
          return (
            <NoDataState
              compact
              title="No organic conversion data"
              missing={p.sources.analytics.message ?? "Google Analytics has no organic landing pages for this period."}
              whyItMatters="Conversions are counted only by Google Analytics."
              actionRequired="Connect Google Analytics and use Refresh data above."
              action={{ label: "Open Integrations", href: "/integrations" }}
            />
          );
        }
        if (!p.sources.analytics.conversionsMeasured) {
          return (
            <NoDataState
              compact
              title="No key events are set up"
              missing="This Google Analytics property has no key events (conversions), so none can be counted, and none is shown as zero."
              whyItMatters="Without a key event there is no way to tell which pages lead to a result."
              actionRequired="Mark the events that matter (a purchase, a form, a call) as key events in Google Analytics, then Refresh data."
            />
          );
        }
        const measured = p.rows.filter((r) => r.ga && r.ga.keyEvents !== null);
        const events = measured.reduce((s, r) => s + (r.ga!.keyEvents ?? 0), 0);
        const sessions = measured.reduce((s, r) => s + r.ga!.sessions, 0);
        const showRevenue = measured.some((r) => r.ga!.revenue != null);
        const revenue = measured.reduce((s, r) => s + (r.ga!.revenue ?? 0), 0);
        const earning = [...measured].filter((r) => (r.ga!.keyEvents ?? 0) > 0).sort((a, b) => (b.ga!.keyEvents ?? 0) - (a.ga!.keyEvents ?? 0)).slice(0, 25);
        const kpi = overview.query.data?.kpis.find((k) => k.key === "keyEvents");
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Kpi label="Organic key events" value={kpi ? formatKpi(kpi) : count(events)} aside={<SourceBadge source="GA4" />} sub="Sitewide, organic search" />
              <Kpi label="Conversion rate" value={sessions > 0 ? percent(events / sessions) : DASH} aside={<SourceBadge source="GA4" />} sub="Key events per organic session, top pages" />
              {showRevenue && <Kpi label="Organic revenue" value={money(revenue)} aside={<SourceBadge source="GA4" />} sub="Top organic pages" />}
              <Kpi label="Pages with a key event" value={count(earning.length)} aside={<SourceBadge source="GA4" />} sub={`of ${count(measured.length)} organic pages`} />
            </div>

            <Panel title="Pages that earn conversions" subtitle="Organic landing pages ranked by key events.">
              {earning.length === 0 ? (
                <EmptyNote>No organic page recorded a key event in this period.</EmptyNote>
              ) : (
                <Table minWidth={640}>
                  <thead>
                    <tr>
                      <Th>Page</Th>
                      <Th align="right">Organic sessions</Th>
                      <Th align="right">Key events</Th>
                      <Th align="right">Conversion rate</Th>
                      {showRevenue && <Th align="right">Revenue</Th>}
                    </tr>
                  </thead>
                  <tbody>
                    {earning.map((r) => (
                      <Tr key={r.key}>
                        <Td><span className="block max-w-[360px] truncate font-mono text-[11.5px]" title={r.url}>{pathOf(r.url)}</span></Td>
                        <Td align="right">{count(r.ga!.sessions)}</Td>
                        <Td align="right">{count(r.ga!.keyEvents)}</Td>
                        <Td align="right">{r.ga!.sessions > 0 ? percent((r.ga!.keyEvents ?? 0) / r.ga!.sessions) : DASH}</Td>
                        {showRevenue && <Td align="right">{money(r.ga!.revenue)}</Td>}
                      </Tr>
                    ))}
                  </tbody>
                </Table>
              )}
              <Caveat>
                Totals cover the top organic landing pages Analytics returns, so they can be lower than the sitewide figure above.{" "}
                <Link href="/google/pages?segment=high-traffic-low-conversion" className="font-semibold text-accent-700 hover:underline">
                  See pages with traffic but no conversions →
                </Link>
              </Caveat>
            </Panel>
          </div>
        );
      }}
    </Gate>
  );
}
