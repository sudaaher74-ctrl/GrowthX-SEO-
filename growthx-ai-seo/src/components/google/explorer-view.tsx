"use client";
import { useMemo, useState } from "react";
import type { UseQueryResult } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { ActionButton, Panel, Table, Td, Th, Tr } from "@/components/ui/console";
import { Caveat, Chip, EmptyNote, Gate } from "@/components/google/view-kit";
import { useGoogleBreakdown, useGooglePages, useGscPages, useGscQueries } from "@/hooks/use-google";
import { useWorkspace } from "@/hooks/use-growthx";
import { DASH, count, pathOf, percent, position } from "@/lib/google-format";

type Dataset = "queries" | "pages" | "organic" | "countries" | "devices";
interface Col {
  id: string;
  label: string;
  /** Null is "not measured", and sorts last. */
  value: (r: Row) => number | string | null;
  fmt: (v: number | string | null) => string;
}
interface Row {
  key: string;
  [field: string]: number | string | null;
}

const num = (f: (v: number) => string) => (v: number | string | null) => (typeof v === "number" ? f(v) : DASH);
const SEARCH_COLS: Col[] = [
  { id: "clicks", label: "Clicks", value: (r) => r.clicks as number, fmt: num(count) },
  { id: "impressions", label: "Impressions", value: (r) => r.impressions as number, fmt: num(count) },
  { id: "ctr", label: "CTR", value: (r) => r.ctr as number, fmt: num((v) => percent(v)) },
  { id: "position", label: "Position", value: (r) => r.position as number, fmt: num(position) },
];
const ORGANIC_COLS: Col[] = [
  ...SEARCH_COLS.map((c) => ({ ...c, value: (r: Row) => (r[c.id] as number | null) ?? null })),
  { id: "users", label: "Organic users", value: (r) => r.users as number | null, fmt: num(count) },
  { id: "engagement", label: "Engagement", value: (r) => r.engagement as number | null, fmt: num((v) => percent(v)) },
  { id: "keyEvents", label: "Key events", value: (r) => r.keyEvents as number | null, fmt: num(count) },
];

function csvCell(v: string | number | null) {
  const s = v === null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Your own table of the Google data: pick a dataset, filter, sort and download it. */
export function ExplorerView() {
  const { projectId } = useWorkspace();
  const [dataset, setDataset] = useState<Dataset>("queries");
  const queries = useGscQueries(projectId, 1000);
  const gscPages = useGscPages(projectId, 1000);
  const organic = useGooglePages(projectId);
  const countries = useGoogleBreakdown(projectId, "country");
  const devices = useGoogleBreakdown(projectId, "device");
  const [filter, setFilter] = useState("");
  const [minImpr, setMinImpr] = useState(0);
  const [sort, setSort] = useState<{ id: string; dir: "asc" | "desc" }>({ id: "clicks", dir: "desc" });

  const { rows, cols, label, loading } = useMemo(() => {
    if (dataset === "queries") return { rows: (queries.query.data ?? []).map((r) => ({ ...r })), cols: SEARCH_COLS, label: "Query", loading: queries.query.isLoading };
    if (dataset === "pages") return { rows: (gscPages.query.data ?? []).map((r) => ({ ...r })), cols: SEARCH_COLS, label: "Page", loading: gscPages.query.isLoading };
    if (dataset === "countries") {
      const rows: Row[] = (countries.query.data?.rows ?? []).map((r) => ({ ...r, key: r.key.toUpperCase() }));
      return { rows, cols: SEARCH_COLS, label: "Country", loading: countries.query.isLoading };
    }
    if (dataset === "devices") {
      const rows: Row[] = (devices.query.data?.rows ?? []).map((r) => ({ ...r, key: r.key.toUpperCase() }));
      return { rows, cols: SEARCH_COLS, label: "Device", loading: devices.query.isLoading };
    }
    const rows: Row[] = (organic.query.data?.rows ?? []).map((r) => ({
      key: r.url,
      clicks: r.gsc?.clicks ?? null,
      impressions: r.gsc?.impressions ?? null,
      ctr: r.gsc?.ctr ?? null,
      position: r.gsc?.position ?? null,
      users: r.ga?.users ?? null,
      engagement: r.ga?.engagementRate ?? null,
      keyEvents: r.ga?.keyEvents ?? null,
    }));
    return { rows, cols: ORGANIC_COLS, label: "Page", loading: organic.query.isLoading };
  }, [dataset, queries.query.data, queries.query.isLoading, gscPages.query.data, gscPages.query.isLoading, organic.query.data, organic.query.isLoading, countries.query.data, countries.query.isLoading, devices.query.data, devices.query.isLoading]);

  const shown = useMemo(() => {
    const col = cols.find((c) => c.id === sort.id) ?? cols[0];
    const f = filter.trim().toLowerCase();
    const factor = sort.dir === "desc" ? -1 : 1;
    return rows
      .filter((r) => (!f || r.key.toLowerCase().includes(f)) && (minImpr <= 0 || ((r.impressions as number | null) ?? 0) >= minImpr))
      .sort((a, b) => {
        const av = col.value(a);
        const bv = col.value(b);
        if (av === null && bv === null) return 0;
        if (av === null) return 1;
        if (bv === null) return -1;
        return typeof av === "number" && typeof bv === "number" ? (av - bv) * factor : String(av).localeCompare(String(bv)) * factor;
      });
  }, [rows, cols, filter, minImpr, sort]);

  const download = () => {
    const lines = [[label, ...cols.map((c) => c.label)].map(csvCell).join(",")];
    for (const r of shown) lines.push([r.key, ...cols.map((c) => c.value(r))].map(csvCell).join(","));
    const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `google-${dataset}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const sortBy = (id: string) => ({
    onClick: () => setSort((s) => (s.id === id ? { id, dir: s.dir === "desc" ? "asc" : "desc" } : { id, dir: "desc" })),
    sorted: sort.id === id ? sort.dir : null,
  });

  const activeQuery = (
    dataset === "queries" ? queries.query : dataset === "pages" ? gscPages.query : dataset === "countries" ? countries.query : dataset === "devices" ? devices.query : organic.query
  ) as UseQueryResult<unknown>;
  const needsRefresh = (dataset === "countries" || dataset === "devices") && !loading && rows.length === 0 && activeQuery.data !== undefined;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1.5" role="group" aria-label="Dataset">
          <Chip active={dataset === "queries"} onClick={() => setDataset("queries")}>Search queries</Chip>
          <Chip active={dataset === "pages"} onClick={() => setDataset("pages")}>Pages in search</Chip>
          <Chip active={dataset === "organic"} onClick={() => setDataset("organic")}>Organic pages + Analytics</Chip>
          <Chip active={dataset === "countries"} onClick={() => setDataset("countries")}>Countries</Chip>
          <Chip active={dataset === "devices"} onClick={() => setDataset("devices")}>Devices</Chip>
        </div>
        <input
          type="search"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder={`Filter ${label.toLowerCase()}s…`}
          aria-label="Filter rows"
          className="h-8 min-w-[200px] flex-1 rounded-lg border bg-white px-3 text-[12px] outline-none focus:border-primary-500 sm:max-w-xs"
        />
        <label className="flex items-center gap-1.5 text-[11.5px] text-brand-600">
          Min impressions
          <input
            type="number"
            min={0}
            value={minImpr}
            onChange={(e) => setMinImpr(Math.max(0, Number(e.target.value) || 0))}
            className="h-8 w-20 rounded-lg border bg-white px-2 text-[12px] outline-none focus:border-primary-500"
          />
        </label>
        <ActionButton icon={<Download size={12} />} disabled={shown.length === 0} onClick={download}>Download CSV</ActionButton>
      </div>

      <Panel title="Data explorer" subtitle={`${count(shown.length)} of ${count(rows.length)} rows. Click a column to sort.`}>
        <Gate query={activeQuery} what="data">
          {() =>
            loading ? null : needsRefresh ? (
              <EmptyNote>Country and device figures have not been fetched for this workspace yet. Use Refresh data above to fetch them from Search Console.</EmptyNote>
            ) : shown.length === 0 ? (
              <EmptyNote>No rows match. Clear the filter, lower the impressions minimum, or use a longer range.</EmptyNote>
            ) : (
              <Table minWidth={cols.length > 4 ? 900 : 640}>
                <thead>
                  <tr>
                    <Th>{label}</Th>
                    {cols.map((c) => (
                      <Th key={c.id} align="right" {...sortBy(c.id)}>{c.label}</Th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {shown.slice(0, 200).map((r) => (
                    <Tr key={r.key}>
                      <Td><span className="block max-w-[380px] truncate text-[12px]" title={r.key}>{dataset === "queries" ? r.key : pathOf(r.key)}</span></Td>
                      {cols.map((c) => (
                        <Td key={c.id} align="right">{c.fmt(c.value(r))}</Td>
                      ))}
                    </Tr>
                  ))}
                </tbody>
              </Table>
            )
          }
        </Gate>
        <Caveat>The table shows the first 200 rows; the download has every filtered row. “—” means not measured, never zero.</Caveat>
      </Panel>
    </div>
  );
}
