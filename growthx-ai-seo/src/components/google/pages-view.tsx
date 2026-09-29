"use client";
import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Panel, Pill, Table, Td, Th, Tr } from "@/components/ui/console";
import { FailedState, LoadingState, NoDataState } from "@/components/ui/truthful-state";
import { ChangeText, SourceBadge, TrendCell } from "@/components/google/parts";
import { PageDetail } from "@/components/google/page-detail";
import { useGooglePages } from "@/hooks/use-google";
import { useWorkspace } from "@/hooks/use-growthx";
import type { GooglePageRow, GooglePageSegment } from "@/lib/api-client";
import { errorMessage } from "@/lib/error-message";
import { DASH, count, money, pathOf, percent, position } from "@/lib/google-format";
import { cn } from "@/lib/utils";

const SEGMENTS: { id: GooglePageSegment; label: string }[] = [
  { id: "top-traffic", label: "Top traffic" },
  { id: "top-impressions", label: "Top impressions" },
  { id: "top-converting", label: "Top converting" },
  { id: "declining", label: "Declining" },
  { id: "growing", label: "Growing" },
  { id: "high-impressions-low-ctr", label: "High impressions, low CTR" },
  { id: "high-traffic-low-conversion", label: "High traffic, low conversion" },
  { id: "low-traffic-high-conversion", label: "Low traffic, high conversion" },
  { id: "ranking-opportunity", label: "Ranking opportunity" },
  { id: "technical-risk", label: "Technical risk" },
];

type SortKey = "clicks" | "change" | "impressions" | "ctr" | "position" | "users" | "engagement" | "keyEvents" | "revenue";

const SORTERS: Record<SortKey, (r: GooglePageRow) => number | null> = {
  clicks: (r) => r.gsc?.clicks ?? null,
  change: (r) => r.gsc?.clicksChangePct ?? null,
  impressions: (r) => r.gsc?.impressions ?? null,
  ctr: (r) => r.gsc?.ctr ?? null,
  position: (r) => r.gsc?.position ?? null,
  users: (r) => r.ga?.users ?? null,
  engagement: (r) => r.ga?.engagementRate ?? null,
  keyEvents: (r) => r.ga?.keyEvents ?? null,
  revenue: (r) => r.ga?.revenue ?? null,
};

/** Every organic page with Search Console and Analytics figures side by side, and a profile for each. */
export function PagesView() {
  const { projectId } = useWorkspace();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const segment = (params.get("segment") as GooglePageSegment | null) ?? undefined;
  const selected = params.get("page");

  const { query, days } = useGooglePages(projectId, segment);
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" } | null>(null);

  const setParam = (next: Record<string, string | null>) => {
    const p = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v === null) p.delete(k);
      else p.set(k, v);
    }
    const qs = p.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const data = query.data;
  const rows = useMemo(() => {
    if (!data) return [];
    if (!sort) return data.rows;
    const get = SORTERS[sort.key];
    const factor = sort.dir === "desc" ? -1 : 1;
    // A page with no value for the column goes last either way, so a gap is never ranked as a zero.
    return [...data.rows].sort((a, b) => {
      const av = get(a);
      const bv = get(b);
      if (av === null && bv === null) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;
      return (av - bv) * factor;
    });
  }, [data, sort]);

  if (selected) {
    return <PageDetail projectId={projectId} url={selected} onBack={() => setParam({ page: null })} />;
  }

  if (!projectId || query.isLoading) return <LoadingState compact title="Loading pages…" message="Joining Search Console and Google Analytics by landing page." />;
  if (query.error || !data) return <FailedState title="Could not load pages" error={errorMessage(query.error)} onRetry={() => query.refetch()} />;

  const showRevenue = rows.some((r) => r.ga?.revenue != null);
  const sortable = (key: SortKey) => ({
    onClick: () => setSort((s) => (s?.key === key ? (s.dir === "desc" ? { key, dir: "asc" } : null) : { key, dir: "desc" })),
    sorted: sort?.key === key ? sort.dir : null,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Show pages">
        <Chip active={!segment} onClick={() => setParam({ segment: null })}>
          All organic pages <span className="ml-1 font-mono text-[10px] opacity-70">{data.total}</span>
        </Chip>
        {SEGMENTS.map((s) => (
          <Chip key={s.id} active={segment === s.id} title={data.criteria[s.id]} onClick={() => setParam({ segment: s.id })}>
            {s.label} <span className="ml-1 font-mono text-[10px] opacity-70">{data.segmentCounts[s.id]}</span>
          </Chip>
        ))}
      </div>
      {segment && data.criteria[segment] && <p className="text-[11.5px] text-brand-500">{data.criteria[segment]}</p>}

      <Panel
        title={segment ? SEGMENTS.find((s) => s.id === segment)?.label : "All organic pages"}
        subtitle={
          data.windows
            ? `Last ${days} days. Search figures cover ${data.windows.search.start} to ${data.windows.search.end}${data.windows.search.comparison ? ", compared with the period before" : ", with no earlier period stored to compare"}.`
            : `Last ${days} days.`
        }
      >
        {rows.length === 0 ? (
          <div className="p-4">
            <NoDataState
              compact
              title={segment ? "No pages match this segment" : "No organic pages for this period"}
              missing={
                segment
                  ? "None of your pages meet this segment's rule for the period."
                  : !data.sources.searchConsole.hasData
                    ? "Search Console has nothing fetched yet, and Google Analytics has no organic landing pages."
                    : "Neither source recorded organic traffic to any page in this period."
              }
              whyItMatters="The rule is shown above; a page appears here only when its real figures meet it."
              actionRequired="Try a longer range, or press Refresh data."
              action={{ label: "Show all pages", onClick: () => setParam({ segment: null }), variant: "secondary" }}
            />
          </div>
        ) : (
          <Table minWidth={showRevenue ? 1120 : 1020}>
            <thead>
              <tr>
                <Th>Page</Th>
                <Th align="right" {...sortable("clicks")}>Clicks <SourceBadge source="GSC" /></Th>
                <Th align="right" {...sortable("change")}>Change</Th>
                <Th align="right" {...sortable("impressions")}>Impressions</Th>
                <Th align="right" {...sortable("ctr")}>CTR</Th>
                <Th align="right" {...sortable("position")}>Position</Th>
                <Th align="right" {...sortable("users")}>Organic users <SourceBadge source="GA4" /></Th>
                <Th align="right" {...sortable("engagement")}>Engagement</Th>
                <Th align="right" {...sortable("keyEvents")}>Key events</Th>
                {showRevenue && <Th align="right" {...sortable("revenue")}>Revenue</Th>}
                <Th>Trend</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <Tr
                  key={r.key}
                  className="cursor-pointer"
                  tabIndex={0}
                  onClick={() => setParam({ page: r.url })}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") setParam({ page: r.url });
                  }}
                >
                  <Td>
                    <div className="flex max-w-[280px] items-center gap-2">
                      <span className="truncate font-mono text-[11.5px] text-brand-950" title={r.url}>{pathOf(r.url)}</span>
                      {r.technicalRisk && (
                        <span title={r.technicalRisk}>
                          <Pill tone="warn">risk</Pill>
                        </span>
                      )}
                    </div>
                  </Td>
                  <Td align="right">{r.gsc ? count(r.gsc.clicks) : DASH}</Td>
                  <Td align="right"><ChangeText pct={r.gsc?.clicksChangePct ?? null} /></Td>
                  <Td align="right">{r.gsc ? count(r.gsc.impressions) : DASH}</Td>
                  <Td align="right">{r.gsc ? percent(r.gsc.ctr) : DASH}</Td>
                  <Td align="right">{r.gsc ? position(r.gsc.position) : DASH}</Td>
                  <Td align="right">{r.ga ? count(r.ga.users) : DASH}</Td>
                  <Td align="right">{r.ga ? percent(r.ga.engagementRate) : DASH}</Td>
                  <Td align="right">{r.ga ? count(r.ga.keyEvents) : DASH}</Td>
                  {showRevenue && <Td align="right">{r.ga ? money(r.ga.revenue) : DASH}</Td>}
                  <Td><TrendCell values={r.trend} /></Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
        <div className="space-y-1 border-t px-4 py-2.5 text-[11px] text-brand-500">
          <p>
            “—” means the figure was not measured — the page has no Search Console row, is not among the top 100 organic landing pages in Analytics, or the property does not record it. It is never a zero.
          </p>
          {!data.sources.searchConsole.hasData && <p>Search Console has nothing fetched yet, so search columns are blank. Use Refresh data above.</p>}
          {data.sources.analytics.needsRefresh && <p>Analytics organic figures are not loaded yet. Use Refresh data above.</p>}
          {data.sources.analytics.hasOrganic && !data.sources.analytics.conversionsMeasured && (
            <p>No key events are set up in Google Analytics, so the key events column cannot be filled.</p>
          )}
          {data.total > rows.length && <p>Showing {rows.length} of {data.total} pages.</p>}
        </div>
      </Panel>
    </div>
  );
}

function Chip({ active, onClick, children, title }: { active: boolean; onClick: () => void; children: React.ReactNode; title?: string }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      title={title}
      onClick={onClick}
      className={cn(
        "rounded-lg border px-2.5 py-1 text-[11.5px] font-medium",
        active ? "border-primary-500 bg-primary-50 text-primary-700" : "bg-white text-brand-600 hover:bg-brand-50",
      )}
    >
      {children}
    </button>
  );
}
