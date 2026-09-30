"use client";
import { useMemo } from "react";
import Link from "next/link";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Kpi, Panel, Pill, Table, Td, Th, Tr } from "@/components/ui/console";
import { Ga4Gate } from "@/components/google/ga4-gate";
import { Headlines, SourceBadge } from "@/components/google/parts";
import { MoreLinks } from "@/components/google/more-links";
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
  const { groups, pages } = useMemo(() => buildTraffic(data), [data]);
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

      <Panel title="Sessions" subtitle="All channels, by day. Analytics figures end yesterday.">
        <div className="h-64 w-full p-4">
          {daily.length >= 2 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={daily}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-brand-100)" vertical={false} />
                <XAxis dataKey="date" tickFormatter={shortDay} tick={{ fontSize: 11, fill: "var(--text-muted)" }} minTickGap={24} />
                <YAxis tick={{ fontSize: 11, fill: "var(--text-muted)" }} tickFormatter={(v) => count(Number(v))} width={48} />
                <Tooltip formatter={(v) => [count(Number(v)), "Sessions"]} labelFormatter={(l) => new Date(`${String(l)}T00:00:00`).toDateString()} />
                <Line type="monotone" dataKey="sessions" stroke="var(--color-series-1)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="py-10 text-center text-[12px] text-brand-500">Not enough daily data in this period to draw a trend.</p>
          )}
        </div>
      </Panel>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="Traffic by channel" subtitle="Sessions by where the visit came from.">
          <Table minWidth={360}>
            <thead>
              <tr>
                <Th>Channel</Th>
                <Th align="right">Sessions</Th>
                <Th align="right">Share</Th>
                <Th>Volume</Th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <Tr key={g.group}>
                  <Td>
                    <span className="flex items-center gap-2 text-[12.5px] font-semibold text-brand-950">
                      {g.group}
                      {g.group === "Organic Search" && <Pill tone="good">Google</Pill>}
                    </span>
                  </Td>
                  <Td align="right">{count(g.sessions)}</Td>
                  <Td align="right">{percent(g.share)}</Td>
                  <Td>
                    <div className="h-1.5 w-24 rounded-full bg-brand-100">
                      <div className={g.group === "Organic Search" ? "h-1.5 rounded-full bg-primary-600" : "h-1.5 rounded-full bg-brand-400"} style={{ width: `${Math.max((g.share ?? 0) * 100, g.sessions > 0 ? 1.5 : 0)}%` }} />
                    </div>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </Panel>

        <Panel
          title="Top landing pages"
          subtitle="Where visits begin, by sessions."
          actions={<Link href="/google/traffic" className="text-[12px] font-semibold text-accent-700 hover:underline">All landing pages →</Link>}
        >
          {pages.length === 0 ? (
            <p className="p-4 text-[12px] text-brand-500">Google Analytics returned no landing pages for this period.</p>
          ) : (
            <Table minWidth={360}>
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
                    <Td><span className="block max-w-[200px] truncate font-mono text-[11.5px] text-brand-950" title={p.page}>{pathOf(p.page)}</span></Td>
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
      </div>

      <MoreLinks group="analytics" />
    </div>
  );
}
