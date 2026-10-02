"use client";
import { useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Kpi, Panel, Table, Td, Th, Tr } from "@/components/ui/console";
import { NoDataState } from "@/components/ui/truthful-state";
import { Caveat, Chip, EmptyNote, Gate } from "@/components/google/view-kit";
import { SourceBadge } from "@/components/google/parts";
import { useGscDeclining, useGscQueries, useGscSummary, useGscTimeseries } from "@/hooks/use-google";
import { useWorkspace } from "@/hooks/use-growthx";
import type { GscMetric, GscRow } from "@/lib/api-client";
import { count, formatDayLabel, percent, position, shortDay } from "@/lib/google-format";

const BUCKETS = [
  { label: "Positions 1–3", test: (p: number) => p < 4 },
  { label: "Positions 4–10", test: (p: number) => p >= 4 && p < 11 },
  { label: "Positions 11–20", test: (p: number) => p >= 11 && p < 21 },
  { label: "Positions 21+", test: (p: number) => p >= 21 },
];

const METRICS = [
  { id: "clicks", label: "Clicks", fmt: count },
  { id: "impressions", label: "Impressions", fmt: count },
  { id: "ctr", label: "CTR", fmt: (v: number) => percent(v) },
  { id: "position", label: "Avg position", fmt: position },
] as const;

function delta(m: GscMetric, kind: "pct" | "places") {
  if (kind === "places") return m.change === null ? null : Math.round(m.change * 10) / 10;
  return m.changePct === null ? null : Math.round(m.changePct * 10) / 10;
}

/** Clicks, impressions, CTR and position, how queries spread across positions, and what is declining. */
export function SearchPerformanceView() {
  const { projectId } = useWorkspace();
  const summary = useGscSummary(projectId);
  const series = useGscTimeseries(projectId);
  const queries = useGscQueries(projectId, 500);
  const declining = useGscDeclining(projectId);
  const [metric, setMetric] = useState<(typeof METRICS)[number]["id"]>("clicks");
  const active = METRICS.find((m) => m.id === metric)!;

  return (
    <Gate query={summary.query} what="search performance">
      {(s) =>
        s === null ? (
          <NoDataState
            compact
            title="Search Console has nothing fetched yet"
            missing="No Search Console data is stored for this workspace."
            whyItMatters="Clicks, impressions, CTR and position all come from Search Console."
            actionRequired="Connect Search Console and use Refresh data above."
            action={{ label: "Open Integrations", href: "/integrations" }}
          />
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Kpi label="Clicks" value={count(s.clicks.current)} delta={delta(s.clicks, "pct")} deltaSuffix="%" aside={<SourceBadge source="GSC" />} sub={s.comparisonRange ? `vs previous ${summary.days} days` : "No earlier period to compare with"} />
              <Kpi label="Impressions" value={count(s.impressions.current)} delta={delta(s.impressions, "pct")} deltaSuffix="%" aside={<SourceBadge source="GSC" />} />
              <Kpi label="CTR" value={percent(s.ctr.current)} delta={delta(s.ctr, "pct")} deltaSuffix="%" aside={<SourceBadge source="GSC" />} />
              <Kpi label="Avg position" value={position(s.position.current)} delta={delta(s.position, "places")} deltaSuffix=" places" deltaGood="down" aside={<SourceBadge source="GSC" />} />
            </div>

            <Panel
              title="Search trend"
              subtitle={`${shortDay(s.range.start)} – ${shortDay(s.range.end)}. Up to Google's latest published data (Search Console has a standard 1–3 day processing delay).`}
              actions={
                <div className="flex flex-wrap gap-1" role="group" aria-label="Metric shown">
                  {METRICS.map((m) => (
                    <Chip key={m.id} active={metric === m.id} onClick={() => setMetric(m.id)}>{m.label}</Chip>
                  ))}
                </div>
              }
            >
              <div className="h-64 w-full p-4">
                {series.query.data && series.query.data.length >= 2 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={series.query.data}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-brand-100)" vertical={false} />
                      <XAxis dataKey="date" tickFormatter={shortDay} tick={{ fontSize: 11, fill: "var(--text-muted)" }} minTickGap={24} />
                      <YAxis tick={{ fontSize: 11, fill: "var(--text-muted)" }} reversed={metric === "position"} tickFormatter={(v) => active.fmt(Number(v))} width={48} />
                      <Tooltip formatter={(v) => [active.fmt(Number(v)), active.label]} labelFormatter={(l) => formatDayLabel(l)} />
                      <Line type="monotone" dataKey={metric} stroke="var(--color-series-1)" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="py-10 text-center text-[12px] text-brand-500">{series.query.isLoading ? "Loading…" : "Not enough daily data in this period to draw a trend."}</p>
                )}
              </div>
            </Panel>

            <Gate query={queries.query} what="position distribution">
              {(rows) => <Distribution rows={rows} />}
            </Gate>

            <Panel title="Queries losing ground" subtitle="Queries whose average position got worse against the previous period.">
              <Gate query={declining.query} what="declining queries">
                {(rows) =>
                  rows.length === 0 ? (
                    <EmptyNote>No query lost ground against the previous period, or there is not enough stored history to compare.</EmptyNote>
                  ) : (
                    <Table minWidth={640}>
                      <thead>
                        <tr>
                          <Th>Query</Th>
                          <Th align="right">Position before</Th>
                          <Th align="right">Position now</Th>
                          <Th align="right">Change</Th>
                          <Th align="right">Clicks before</Th>
                          <Th align="right">Clicks now</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.slice(0, 25).map((r) => (
                          <Tr key={r.query}>
                            <Td><span className="block max-w-[320px] truncate text-[12px]" title={r.query}>{r.query}</span></Td>
                            <Td align="right">{position(r.previousPosition)}</Td>
                            <Td align="right">{position(r.currentPosition)}</Td>
                            <Td align="right"><span className="font-mono text-[11px] text-error-600">+{r.positionChange.toFixed(1)}</span></Td>
                            <Td align="right">{count(r.previousClicks)}</Td>
                            <Td align="right">{count(r.currentClicks)}</Td>
                          </Tr>
                        ))}
                      </tbody>
                    </Table>
                  )
                }
              </Gate>
              <Caveat>New and rising queries are on the Keywords tab.</Caveat>
            </Panel>
          </div>
        )
      }
    </Gate>
  );
}

function Distribution({ rows }: { rows: GscRow[] }) {
  const buckets = useMemo(
    () =>
      BUCKETS.map((b) => {
        const inBucket = rows.filter((r) => b.test(r.position));
        return { label: b.label, queries: inBucket.length, clicks: inBucket.reduce((s, r) => s + r.clicks, 0), impressions: inBucket.reduce((s, r) => s + r.impressions, 0) };
      }),
    [rows],
  );
  const total = rows.length;
  return (
    <Panel title="Position distribution" subtitle={`Where your top ${total} queries by impressions rank on average.`}>
      {total === 0 ? (
        <EmptyNote>No queries stored for this period.</EmptyNote>
      ) : (
        <Table minWidth={560}>
          <thead>
            <tr>
              <Th>Position</Th>
              <Th align="right">Queries</Th>
              <Th align="right">Clicks</Th>
              <Th align="right">Impressions</Th>
              <Th>Share of queries</Th>
            </tr>
          </thead>
          <tbody>
            {buckets.map((b) => (
              <Tr key={b.label}>
                <Td>{b.label}</Td>
                <Td align="right">{count(b.queries)}</Td>
                <Td align="right">{count(b.clicks)}</Td>
                <Td align="right">{count(b.impressions)}</Td>
                <Td>
                  <div className="h-1.5 w-40 rounded-full bg-brand-100">
                    <div className="h-1.5 rounded-full bg-primary-600" style={{ width: `${Math.max((b.queries / total) * 100, b.queries > 0 ? 1.5 : 0)}%` }} />
                  </div>
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      )}
    </Panel>
  );
}
