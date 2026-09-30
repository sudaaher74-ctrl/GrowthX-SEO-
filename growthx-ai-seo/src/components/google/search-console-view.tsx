"use client";
import Link from "next/link";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Kpi, Panel, Table, Td, Th, Tr } from "@/components/ui/console";
import { NoDataState, NotConnectedState } from "@/components/ui/truthful-state";
import { EmptyNote, Gate } from "@/components/google/view-kit";
import { Headlines, SourceBadge } from "@/components/google/parts";
import { MoreLinks } from "@/components/google/more-links";
import { useGoogleOverview, useGscPages, useGscQueries, useGscSummary, useGscTimeseries } from "@/hooks/use-google";
import { useWorkspace } from "@/hooks/use-growthx";
import type { GscMetric, GscPoint, GscRow } from "@/lib/api-client";
import { count, pathOf, percent, position, shortDay } from "@/lib/google-format";

function delta(m: GscMetric, kind: "pct" | "places") {
  if (kind === "places") return m.change === null ? null : Math.round(m.change * 10) / 10;
  return m.changePct === null ? null : Math.round(m.changePct * 10) / 10;
}

/** Search Console on one page: the four numbers, one chart, the top queries and pages. */
export function SearchConsoleView() {
  const { projectId } = useWorkspace();
  const overview = useGoogleOverview(projectId);
  const summary = useGscSummary(projectId);
  const series = useGscTimeseries(projectId);
  const queries = useGscQueries(projectId, 50);
  const pages = useGscPages(projectId, 50);

  if (overview.query.data && !overview.query.data.sources.searchConsole.connected) {
    return (
      <NotConnectedState
        title="Connect Search Console to see how Google shows your site"
        missing="Search Console is not connected for this workspace."
        whyItMatters="Clicks, impressions, CTR and position all come from Search Console. Nothing is estimated."
        actionRequired="Connect Search Console, and choose your website."
        action={{ label: "Open Integrations", href: "/integrations" }}
      />
    );
  }

  const headlines = (overview.query.data?.headlines ?? []).filter((h) => h.source === "GSC").slice(0, 1);
  const points = series.query.data ?? [];
  const spark = (pick: (p: GscPoint) => number) => (points.length >= 2 ? points.map(pick) : null);

  return (
    <Gate query={summary.query} what="Search Console">
      {(s) =>
        s === null ? (
          <NoDataState
            compact
            title="Search Console has nothing fetched yet"
            missing="No Search Console data is stored for this workspace."
            whyItMatters="Clicks, impressions, CTR and position all come from Search Console."
            actionRequired="Use Refresh data above to read the last 90 days."
          />
        ) : (
          <div className="space-y-4">
            {headlines.length > 0 && <Headlines headlines={headlines} />}

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Kpi label="Clicks" value={count(s.clicks.current)} delta={delta(s.clicks, "pct")} deltaSuffix="%" trend={spark((p) => p.clicks)} aside={<SourceBadge source="GSC" />} sub={s.comparisonRange ? `vs previous ${summary.days} days` : "No earlier period to compare with"} />
              <Kpi label="Impressions" value={count(s.impressions.current)} delta={delta(s.impressions, "pct")} deltaSuffix="%" trend={spark((p) => p.impressions)} aside={<SourceBadge source="GSC" />} />
              <Kpi label="CTR" value={percent(s.ctr.current)} delta={delta(s.ctr, "pct")} deltaSuffix="%" trend={spark((p) => p.ctr)} aside={<SourceBadge source="GSC" />} />
              <Kpi label="Avg position" value={position(s.position.current)} delta={delta(s.position, "places")} deltaSuffix=" places" deltaGood="down" trend={spark((p) => p.position)} aside={<SourceBadge source="GSC" />} />
            </div>

            <Panel title="Clicks and impressions" subtitle={`${shortDay(s.range.start)} – ${shortDay(s.range.end)}. Search Console figures end a few days before today.`}>
              <div className="h-64 w-full p-4">
                {points.length >= 2 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={points}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-brand-100)" vertical={false} />
                      <XAxis dataKey="date" tickFormatter={shortDay} tick={{ fontSize: 11, fill: "var(--text-muted)" }} minTickGap={24} />
                      <YAxis yAxisId="clicks" tick={{ fontSize: 11, fill: "var(--text-muted)" }} tickFormatter={(v) => count(Number(v))} width={48} />
                      <YAxis yAxisId="impressions" orientation="right" tick={{ fontSize: 11, fill: "var(--text-muted)" }} tickFormatter={(v) => count(Number(v))} width={48} />
                      <Tooltip formatter={(v, name) => [count(Number(v)), name === "clicks" ? "Clicks" : "Impressions"]} labelFormatter={(l) => new Date(`${String(l)}T00:00:00`).toDateString()} />
                      <Line yAxisId="clicks" type="monotone" dataKey="clicks" stroke="var(--color-series-1)" strokeWidth={2} dot={false} />
                      <Line yAxisId="impressions" type="monotone" dataKey="impressions" stroke="var(--color-series-2)" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="py-10 text-center text-[12px] text-brand-500">{series.query.isLoading ? "Loading…" : "Not enough daily data in this period to draw a trend."}</p>
                )}
              </div>
              <p className="border-t px-4 py-2.5 text-[11px] text-brand-500">
                <span className="font-semibold text-[var(--color-series-1)]">Clicks</span> use the left axis, <span className="font-semibold text-[var(--color-series-2)]">impressions</span> the right, so both stay readable.
              </p>
            </Panel>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <RowsPanel title="Top queries" label="Query" href="/google/keywords" more="All keywords" query={queries.query} />
              <RowsPanel title="Top pages" label="Page" href="/google/pages" more="All pages" query={pages.query} format={pathOf} />
            </div>

            <MoreLinks group="search-console" />
          </div>
        )
      }
    </Gate>
  );
}

function RowsPanel({ title, label, href, more, query, format = (k) => k }: { title: string; label: string; href: string; more: string; query: Parameters<typeof Gate<GscRow[]>>[0]["query"]; format?: (key: string) => string }) {
  return (
    <Panel
      title={title}
      subtitle="By clicks, then impressions."
      actions={<Link href={href} className="text-[12px] font-semibold text-accent-700 hover:underline">{more} →</Link>}
    >
      <Gate query={query} what={title.toLowerCase()}>
        {(rows) => {
          const top = [...rows].sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions).slice(0, 10);
          return top.length === 0 ? (
            <EmptyNote>Nothing stored for this period.</EmptyNote>
          ) : (
            <Table minWidth={360}>
              <thead>
                <tr>
                  <Th>{label}</Th>
                  <Th align="right">Clicks</Th>
                  <Th align="right">Impr.</Th>
                  <Th align="right">Pos.</Th>
                </tr>
              </thead>
              <tbody>
                {top.map((r) => (
                  <Tr key={r.key}>
                    <Td><span className="block max-w-[220px] truncate text-[12px] text-brand-950" title={r.key}>{format(r.key)}</span></Td>
                    <Td align="right">{count(r.clicks)}</Td>
                    <Td align="right">{count(r.impressions)}</Td>
                    <Td align="right">{position(r.position)}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          );
        }}
      </Gate>
    </Panel>
  );
}
