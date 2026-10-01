"use client";
import { useMemo } from "react";
import Link from "next/link";
import { Kpi, Panel, Table, Td, Th, Tr } from "@/components/ui/console";
import { Ga4Gate } from "@/components/google/ga4-gate";
import { Headlines, SourceBadge } from "@/components/google/parts";
import { MoreLinks } from "@/components/google/more-links";
import { TrafficOrigins } from "@/components/google/traffic-origins";
import { DailySessionsCard } from "@/components/google/daily-sessions-card";
import { NewVsReturningCard } from "@/components/google/new-vs-returning-card";
import { ActiveUsersBySource } from "@/components/google/active-users-by-source";
import { buildTraffic } from "@/components/google/traffic-view";
import { useGoogleOverview } from "@/hooks/use-google";
import { useWorkspace } from "@/hooks/use-growthx";
import type { Ga4Report, Ga4ReportData } from "@/lib/api-client";
import { DASH, count, pathOf, percent, shortDay } from "@/lib/google-format";

/** Google Analytics 4 on one page: the four numbers, one chart, channels and landing pages. */
export function AnalyticsView() {
  return <Ga4Gate>{({ report, data }) => <AnalyticsBody report={report} data={data} />}</Ga4Gate>;
}

function AnalyticsBody({ report, data }: { report: Ga4Report; data: Ga4ReportData }) {
  const { projectId } = useWorkspace();
  const overview = useGoogleOverview(projectId);
  const { pages } = useMemo(() => buildTraffic(data), [data]);
  const t = data.totals;
  const daily = data.daily;
  const headlines = (overview.query.data?.headlines ?? []).filter((h) => h.source === "GA4").slice(0, 1);
  const sessionsTrend = daily.length >= 2 ? daily.map((d) => d.sessions) : null;
  const usersTrend = daily.length >= 2 ? daily.map((d) => d.users) : null;

  return (
    <div className="space-y-4">
      {report.lastError && <p className="rounded-lg border border-warning-200 bg-warning-50 px-3 py-2 text-[12px] text-warning-700">Latest refresh failed, showing the last good data: {report.lastError}</p>}
      {headlines.length > 0 && <Headlines headlines={headlines} />}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Sessions" value={count(t.sessions)} trend={sessionsTrend} aside={<SourceBadge source="GA4" />} sub={`${shortDay(data.startDate)} – ${shortDay(data.endDate)}`} />
        <Kpi label="Users" value={count(t.activeUsers)} trend={usersTrend} aside={<SourceBadge source="GA4" />} sub={`${count(t.newUsers)} new`} />
        <Kpi label="Engagement rate" value={percent(t.engagementRate)} aside={<SourceBadge source="GA4" />} sub={`${count(t.engagedSessions)} engaged sessions`} />
        <Kpi
          label="Conversions"
          value={count(t.keyEvents)}
          aside={<SourceBadge source="GA4" />}
          sub={t.keyEvents === null ? "No key events are set up in this Google Analytics property." : "Key events"}
        />
      </div>

      {/* User Trends: Daily Sessions & New vs. Returning Users */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 items-stretch">
        <DailySessionsCard data={data} />
        <NewVsReturningCard data={data} />
      </div>

      {/* Active users by Filter Source (Instagram, Facebook, Google, Direct, etc.) */}
      <ActiveUsersBySource data={data} />

      <TrafficOrigins data={data} />

      <Panel
        title="Top landing pages"
        subtitle="Where visits begin, by sessions."
        actions={<Link href="/google/traffic" className="text-[12px] font-semibold text-accent-700 hover:underline">All landing pages →</Link>}
      >
        {pages.length === 0 ? (
          <p className="p-4 text-[12px] text-brand-500">Google Analytics returned no landing pages for this period.</p>
        ) : (
          <Table minWidth={480}>
            <thead>
              <tr>
                <Th>Page</Th>
                <Th align="right">Sessions</Th>
                <Th align="right">Engagement</Th>
                <Th align="right">Conv.</Th>
              </tr>
            </thead>
            <tbody>
              {pages.slice(0, 10).map((p) => (
                <Tr key={p.page}>
                  <Td><span className="block max-w-[360px] truncate font-mono text-[11.5px] text-brand-950" title={p.page}>{pathOf(p.page)}</span></Td>
                  <Td align="right">{count(p.sessions)}</Td>
                  <Td align="right">{percent(p.engagementRate)}</Td>
                  <Td align="right">{p.keyEvents == null ? DASH : count(p.keyEvents)}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
        <p className="border-t px-4 py-2.5 text-[11px] text-brand-500">“—” means Google Analytics did not measure it, never a zero.</p>
      </Panel>

      <MoreLinks group="analytics" />
    </div>
  );
}
