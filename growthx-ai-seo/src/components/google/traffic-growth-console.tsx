"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpDown,
  ArrowUpRight,
  Download,
  ExternalLink,
  FileText,
  MousePointerClick,
  Search,
  Sparkles,
  Target,
  TrendingDown,
  Wrench,
  X,
} from "lucide-react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  CHART_AXIS_TICK,
  CHART_CURSOR_LINE,
  ChartTooltipCard,
} from "@/components/ui/chart-primitives";
import { useGooglePage } from "@/hooks/use-google";
import type {
  GscCtrOpportunity,
  GscDecliningRow,
  GscRow,
  GscStrikingDistanceRow,
} from "@/lib/api-types";
import { count, percent, shortDay } from "@/lib/google-format";
import { cn } from "@/lib/utils";

export interface EnrichedLandingPageRow {
  rawPage: string;
  path: string;
  share: number;
  count: number;
  engagementRate: number;
  keyEvents: number | null;
}

interface TrafficGrowthConsoleProps {
  projectId: string | null | undefined;
  periodDays: number;
  landingPages: EnrichedLandingPageRow[];
  queries: GscRow[];
  striking: GscStrikingDistanceRow[];
  ctrOpps: GscCtrOpportunity[];
  declining: GscDecliningRow[];
  initialTab?: GrowthConsoleTab;
  tabSwitchSignal?: { tab: GrowthConsoleTab; nonce: number } | null;
  presentationMode?: boolean;
}

export type GrowthConsoleTab = "pages" | "queries" | "striking" | "ctr" | "declining";
type QueryFilter = "all" | "page1" | "page2" | "highImp";
type QuerySortKey = "clicks" | "impressions" | "ctr" | "position";

function fixEngineQueryHref(query: string): string {
  return `/fix-engine?tab=content&query=${encodeURIComponent(query)}&topic=${encodeURIComponent(query)}&kind=ARTICLE`;
}

function downloadQueriesCsv(rows: GscRow[], periodDays: number) {
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const lines = [
    ["Query", "Clicks", "Impressions", "CTR %", "Avg Position"].map(esc).join(","),
    ...rows.map((r) =>
      [r.key, r.clicks, r.impressions, (r.ctr * 100).toFixed(2), r.position.toFixed(1)].map(esc).join(","),
    ),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `search-queries-${periodDays}d.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Native <dialog> Page Inspector Drawer combining GA4 engagement & GSC queries
 * for any clicked landing page. Uses showModal(), closedby="any" + fallback,
 * and overscroll-behavior scroll containment.
 */
function PageInspectorDialog({
  projectId,
  pageUrl,
  onClose,
}: {
  projectId: string | null | undefined;
  pageUrl: string | null;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const titleId = useId();
  const pageDetail = useGooglePage(projectId, pageUrl);
  const detail = pageDetail.query.data;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (pageUrl && !dialog.open) {
      dialog.showModal();
    } else if (!pageUrl && dialog.open) {
      dialog.close();
    }
  }, [pageUrl]);

  // Native close event + pointerdown/pointerup fallback when `closedBy` isn't supported (Safari)
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleClose = () => {
      dialog.returnValue = "";
      onClose();
    };
    dialog.addEventListener("close", handleClose);

    let cleanupOutside: (() => void) | null = null;
    if (!("closedBy" in HTMLDialogElement.prototype)) {
      const outside = (e: PointerEvent) => {
        const r = dialog.getBoundingClientRect();
        return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
      };
      let pressedOutside = false;
      const onDown = (e: PointerEvent) => {
        pressedOutside = outside(e);
      };
      const onUp = (e: PointerEvent) => {
        if (pressedOutside && outside(e)) dialog.close();
        pressedOutside = false;
      };
      dialog.addEventListener("pointerdown", onDown);
      dialog.addEventListener("pointerup", onUp);
      cleanupOutside = () => {
        dialog.removeEventListener("pointerdown", onDown);
        dialog.removeEventListener("pointerup", onUp);
      };
    }

    return () => {
      dialog.removeEventListener("close", handleClose);
      cleanupOutside?.();
    };
  }, [onClose]);

  const historyData = useMemo(
    () =>
      (detail?.history ?? []).map((h) => ({
        date: h.date.slice(0, 10),
        clicks: h.clicks,
        impressions: h.impressions,
      })),
    [detail?.history],
  );

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      {...({ closedby: "any" } as Record<string, string>)}
      className="traffic-inspector-dialog border-l border-brand-200"
    >
      <div className="flex items-start justify-between gap-3 border-b border-brand-200 px-5 py-4">
        <div className="min-w-0">
          <p className="text-[10.5px] font-semibold uppercase tracking-wider text-brand-400">
            Page Intelligence Inspector
          </p>
          <h1 id={titleId} className="mt-0.5 truncate font-mono text-sm font-bold text-brand-950" title={pageUrl ?? ""}>
            {pageUrl ?? "Page"}
          </h1>
        </div>
        <form method="dialog">
          <button
            type="submit"
            autoFocus
            aria-label="Close page inspector"
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-brand-200 text-brand-500 hover:bg-brand-100 hover:text-brand-950 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </form>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto p-5">
        {pageDetail.query.isPending ? (
          <p className="text-xs text-brand-400">Loading combined GA4 &amp; Search Console page metrics…</p>
        ) : pageDetail.query.isError ? (
          <p role="alert" className="text-xs text-error-700">
            Could not load deep page metrics: {pageDetail.query.error.message}
          </p>
        ) : detail ? (
          <>
            {/* Combined GA4 + GSC KPIs */}
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              <div className="rounded-xl border border-brand-200/70 bg-brand-50/70 p-3">
                <p className="text-[10px] font-semibold uppercase text-brand-400">Sessions</p>
                <p className="mt-1 font-mono text-lg font-bold text-brand-950">
                  {count(detail.ga?.sessions ?? null)}
                </p>
              </div>
              <div className="rounded-xl border border-brand-200/70 bg-brand-50/70 p-3">
                <p className="text-[10px] font-semibold uppercase text-brand-400">Engaged</p>
                <p className="mt-1 font-mono text-lg font-bold text-brand-950">
                  {detail.ga ? percent(detail.ga.engagementRate) : "—"}
                </p>
              </div>
              <div className="rounded-xl border border-brand-200/70 bg-brand-50/70 p-3">
                <p className="text-[10px] font-semibold uppercase text-brand-400">GSC Clicks</p>
                <p className="mt-1 font-mono text-lg font-bold text-brand-950">
                  {count(detail.gsc?.clicks ?? null)}
                </p>
              </div>
              <div className="rounded-xl border border-brand-200/70 bg-brand-50/70 p-3">
                <p className="text-[10px] font-semibold uppercase text-brand-400">Avg. Pos</p>
                <p className="mt-1 font-mono text-lg font-bold text-brand-950">
                  {detail.gsc && detail.gsc.position > 0 ? `#${detail.gsc.position.toFixed(1)}` : "—"}
                </p>
              </div>
            </div>

            {/* Page Click History Sparkline */}
            {historyData.length >= 2 && (
              <div className="rounded-xl border border-brand-200/70 bg-surface-1 p-3.5">
                <p className="text-[11px] font-semibold text-brand-700">Daily Search Clicks</p>
                <div className="mt-2 h-32 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={historyData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                      <XAxis dataKey="date" tickFormatter={shortDay} tick={CHART_AXIS_TICK} axisLine={false} tickLine={false} minTickGap={28} />
                      <YAxis allowDecimals={false} tick={CHART_AXIS_TICK} axisLine={false} tickLine={false} width={38} />
                      <Tooltip
                        cursor={CHART_CURSOR_LINE}
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null;
                          const row = payload[0]?.payload as { date: string; clicks: number } | undefined;
                          if (!row) return null;
                          return (
                            <ChartTooltipCard
                              title={shortDay(row.date)}
                              rows={[{ label: "Clicks", value: count(row.clicks), color: "var(--color-series-1)" }]}
                            />
                          );
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="clicks"
                        stroke="var(--color-series-1)"
                        strokeWidth={2}
                        fill="var(--color-series-1)"
                        fillOpacity={0.14}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Top Search Queries Driving This Page */}
            <div>
              <h2 className="text-xs font-bold text-brand-950">
                Top Search Queries Ranking for This Page ({detail.queries.length})
              </h2>
              {detail.queries.length > 0 ? (
                <div className="mt-2.5 divide-y divide-brand-100 rounded-xl border border-brand-200/70">
                  {detail.queries.slice(0, 12).map((q) => (
                    <div key={q.query} className="flex items-center justify-between gap-2 px-3 py-2 text-xs">
                      <span className="font-medium text-brand-950 truncate">{q.query}</span>
                      <span className="shrink-0 font-mono text-[11px] text-brand-500">
                        {count(q.clicks)} clicks · {count(q.impressions)} imp · #{q.position.toFixed(1)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-xs text-brand-400">
                  No Search Console query breakdown matched this exact path in this window.
                </p>
              )}
            </div>
          </>
        ) : (
          <p className="text-xs text-brand-400">No detailed telemetry found for this URL yet.</p>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-brand-200 px-5 py-3.5">
        {detail?.url && (
          <a
            href={detail.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-600 hover:text-brand-950"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            <span>Open Live URL</span>
          </a>
        )}
        <Link
          href={`/fix-engine`}
          className="ml-auto inline-flex items-center gap-1.5 rounded-xl bg-signal-400 px-3.5 py-2 text-xs font-bold text-signal-ink hover:bg-signal-500 transition shadow-xs"
        >
          <Wrench className="h-3.5 w-3.5" />
          <span>Optimize in Fix Engine</span>
        </Link>
      </div>
    </dialog>
  );
}

export function TrafficGrowthConsole({
  projectId,
  periodDays,
  landingPages,
  queries,
  striking,
  ctrOpps,
  declining,
  initialTab = "pages",
  tabSwitchSignal,
  presentationMode = false,
}: TrafficGrowthConsoleProps) {
  const [activeTab, setActiveTab] = useState<GrowthConsoleTab>(initialTab);
  const [search, setSearch] = useState("");
  const [queryFilter, setQueryFilter] = useState<QueryFilter>("all");
  const [querySort, setQuerySort] = useState<QuerySortKey>("clicks");
  const [sortAsc, setSortAsc] = useState(false);
  const [inspectedPage, setInspectedPage] = useState<string | null>(null);
  const captionId = useId();

  // Sync tab when parent jumps from alert strip
  const lastSignalNonceRef = useRef<number>(0);
  useEffect(() => {
    if (!tabSwitchSignal || tabSwitchSignal.nonce === lastSignalNonceRef.current) return;
    lastSignalNonceRef.current = tabSwitchSignal.nonce;
    queueMicrotask(() => setActiveTab(tabSwitchSignal.tab));
  }, [tabSwitchSignal]);

  const normSearch = search.trim().toLowerCase();

  const filteredPages = useMemo(() => {
    if (!normSearch) return landingPages;
    return landingPages.filter((p) => p.path.toLowerCase().includes(normSearch));
  }, [landingPages, normSearch]);

  const filteredQueries = useMemo(() => {
    let list = queries;
    if (normSearch) {
      list = list.filter((q) => q.key.toLowerCase().includes(normSearch));
    }
    if (queryFilter === "page1") list = list.filter((q) => q.position > 0 && q.position <= 10.5);
    if (queryFilter === "page2") list = list.filter((q) => q.position > 10.5 && q.position <= 20.5);
    if (queryFilter === "highImp") list = list.filter((q) => q.impressions >= 50);

    return [...list].sort((a, b) => {
      const diff = a[querySort] - b[querySort];
      return sortAsc ? diff : -diff;
    });
  }, [queries, normSearch, queryFilter, querySort, sortAsc]);

  const filteredStriking = useMemo(() => {
    if (!normSearch) return striking;
    return striking.filter((r) => r.key.toLowerCase().includes(normSearch));
  }, [striking, normSearch]);

  const filteredCtr = useMemo(() => {
    if (!normSearch) return ctrOpps;
    return ctrOpps.filter((r) => r.key.toLowerCase().includes(normSearch));
  }, [ctrOpps, normSearch]);

  const filteredDeclining = useMemo(() => {
    if (!normSearch) return declining;
    return declining.filter((r) => r.query.toLowerCase().includes(normSearch));
  }, [declining, normSearch]);

  const toggleSort = (key: QuerySortKey) => {
    if (querySort === key) {
      setSortAsc((prev) => !prev);
    } else {
      setQuerySort(key);
      setSortAsc(key === "position");
    }
  };

  const tabs: Array<{
    id: GrowthConsoleTab;
    label: string;
    count: number;
    icon: React.ElementType;
    accent?: "warn" | "bad" | "good";
  }> = [
    { id: "pages", label: "Landing Pages", count: landingPages.length, icon: FileText },
    { id: "queries", label: "Search Queries", count: queries.length, icon: Search },
    { id: "striking", label: "Striking Distance", count: striking.length, icon: Target, accent: "good" },
    { id: "ctr", label: "CTR Gaps", count: ctrOpps.length, icon: MousePointerClick, accent: "warn" },
    { id: "declining", label: "Declining", count: declining.length, icon: TrendingDown, accent: "bad" },
  ];

  return (
    <div className="rounded-2xl border border-brand-200/80 bg-surface-1 p-5 shadow-card">
      {/* Header + Tabs */}
      <div className="flex flex-col gap-3 border-b border-brand-100 pb-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary-600" />
            <h2 className="text-sm font-bold text-brand-950">Pages &amp; Search Opportunity Console</h2>
          </div>
          <p className="mt-0.5 text-[11px] text-brand-400">
            Inspect page engagement, capture striking-distance wins, close CTR shortfalls, and stop ranking drops
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-56">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-brand-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter pages or queries…"
              aria-label="Filter pages or search queries"
              className="w-full rounded-xl border border-brand-200 bg-brand-50/70 py-1.5 pr-7 pl-8 text-xs text-brand-950 placeholder:text-brand-400 focus:border-primary-500 focus:outline-none"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label="Clear filter"
                className="absolute top-1/2 right-2 -translate-y-1/2 text-brand-400 hover:text-brand-950 cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {activeTab === "queries" && filteredQueries.length > 0 && (
            <button
              type="button"
              onClick={() => downloadQueriesCsv(filteredQueries, periodDays)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-brand-200 bg-surface-1 px-3 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-100 transition cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" />
              <span>CSV</span>
            </button>
          )}
        </div>
      </div>

      {/* 5 Console Tabs */}
      <div
        role="tablist"
        aria-label="SEO growth console tabs"
        className="mt-3.5 flex flex-wrap items-center gap-1.5"
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition cursor-pointer",
                active
                  ? "border-signal-400 bg-signal-400 text-signal-ink font-bold shadow-xs"
                  : "border-brand-200/70 bg-brand-50/70 text-brand-600 hover:bg-brand-100 hover:text-brand-950",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{tab.label}</span>
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 font-mono text-[10px] font-bold leading-none",
                  active
                    ? "bg-signal-ink/15 text-signal-ink"
                    : tab.count > 0 && tab.accent === "bad"
                      ? "bg-error-50 text-error-700"
                      : tab.count > 0 && tab.accent === "warn"
                        ? "bg-warning-50 text-warning-700"
                        : tab.count > 0 && tab.accent === "good"
                          ? "bg-success-50 text-success-700"
                          : "bg-brand-200/70 text-brand-600",
                )}
              >
                {tab.count}
              </span>
            </button>
          );
        })}

        {activeTab === "queries" && (
          <div className="ml-auto flex flex-wrap items-center gap-1 text-[11px]">
            {(
              [
                { id: "all", label: "All" },
                { id: "page1", label: "Page 1" },
                { id: "page2", label: "Page 2" },
                { id: "highImp", label: "50+ Imp" },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setQueryFilter(f.id)}
                className={cn(
                  "rounded-full px-2.5 py-1 font-semibold transition cursor-pointer",
                  queryFilter === f.id
                    ? "bg-primary-50 text-primary-700"
                    : "text-brand-500 hover:bg-brand-100 hover:text-brand-950",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Scrollable Accessible Table Region with Sticky Headers */}
      <div
        tabIndex={0}
        role="region"
        aria-labelledby={captionId}
        className="traffic-table-wrap mt-4 rounded-xl border border-brand-200/60"
      >
        {activeTab === "pages" && (
          <table className="w-full text-left text-xs">
            <caption id={captionId} className="sr-only">
              Top landing pages with sessions, engagement rate, and key events
            </caption>
            <thead>
              <tr className="border-b border-brand-200/70 text-[10.5px] uppercase tracking-wider text-brand-400">
                <th className="px-4 py-3 font-semibold">Landing Page</th>
                <th className="px-3 py-3 font-semibold">Traffic Share</th>
                <th className="px-3 py-3 text-right font-semibold">Engaged Rate</th>
                <th className="px-3 py-3 text-right font-semibold">Key Events</th>
                <th className="px-3 py-3 text-right font-semibold">Sessions</th>
                <th className="px-4 py-3 text-right font-semibold">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-100">
              {filteredPages.length > 0 ? (
                filteredPages.map((row) => (
                  <tr
                    key={row.rawPage}
                    onClick={() => setInspectedPage(row.rawPage)}
                    className="hover:bg-brand-100/45 transition cursor-pointer"
                  >
                    <td className="px-4 py-3 font-mono font-semibold text-brand-950 max-w-[280px] truncate" title={row.path}>
                      {row.path}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-brand-200/60">
                          <div
                            className="h-full rounded-full bg-success-500"
                            style={{ width: `${Math.max(row.share * 100, 4)}%` }}
                          />
                        </div>
                        <span className="font-mono text-[11px] text-brand-500">{percent(row.share)}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-brand-700">
                      {percent(row.engagementRate)}
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-brand-700">
                      {row.keyEvents !== null ? count(row.keyEvents) : "—"}
                    </td>
                    <td className="px-3 py-3 text-right font-mono font-bold text-brand-950">
                      {count(row.count)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setInspectedPage(row.rawPage);
                        }}
                        className="inline-flex items-center gap-1 rounded-lg border border-brand-200 bg-surface-1 px-2 py-1 text-[11px] font-semibold text-brand-700 hover:bg-brand-100 cursor-pointer"
                      >
                        <span>Inspect</span>
                        <ArrowUpRight className="h-3 w-3" />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-brand-400">
                    No landing pages recorded for this period yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}

        {activeTab === "queries" && (
          <table className="w-full text-left text-xs">
            <caption id={captionId} className="sr-only">
              Top search queries with clicks, impressions, click-through rate, and average position
            </caption>
            <thead>
              <tr className="border-b border-brand-200/70 text-[10.5px] uppercase tracking-wider text-brand-400">
                <th className="px-4 py-3 font-semibold">Search Query</th>
                {(
                  [
                    { key: "clicks", label: "Clicks" },
                    { key: "impressions", label: "Impressions" },
                    { key: "ctr", label: "CTR" },
                    { key: "position", label: "Position" },
                  ] as const
                ).map((col) => (
                  <th key={col.key} className="px-3 py-3 text-right font-semibold">
                    <button
                      type="button"
                      onClick={() => toggleSort(col.key)}
                      className={cn(
                        "inline-flex items-center gap-1 uppercase cursor-pointer hover:text-brand-950",
                        querySort === col.key ? "text-brand-950" : "",
                      )}
                    >
                      <span>{col.label}</span>
                      <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </th>
                ))}
                {!presentationMode && <th className="px-4 py-3 text-right font-semibold">Action</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-100">
              {filteredQueries.length > 0 ? (
                filteredQueries.slice(0, 50).map((q) => (
                  <tr key={q.key} className="hover:bg-brand-100/45 transition">
                    <td className="px-4 py-3 font-semibold text-brand-950">{q.key}</td>
                    <td className="px-3 py-3 text-right font-mono font-bold text-brand-950">{count(q.clicks)}</td>
                    <td className="px-3 py-3 text-right font-mono text-brand-700">{count(q.impressions)}</td>
                    <td className="px-3 py-3 text-right font-mono text-brand-700">{percent(q.ctr)}</td>
                    <td className="px-3 py-3 text-right font-mono">
                      <span
                        className={cn(
                          "rounded-md px-1.5 py-0.5 font-semibold",
                          q.position <= 3
                            ? "bg-success-50 text-success-700"
                            : q.position <= 10
                              ? "bg-accent-50 text-accent-700"
                              : "bg-brand-100 text-brand-600",
                        )}
                      >
                        #{q.position.toFixed(1)}
                      </span>
                    </td>
                    {!presentationMode && (
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={fixEngineQueryHref(q.key)}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary-700 hover:underline"
                        >
                          <span>Optimize</span>
                          <ArrowUpRight className="h-3 w-3" />
                        </Link>
                      </td>
                    )}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={presentationMode ? 5 : 6} className="px-4 py-10 text-center text-brand-400">
                    No search queries match this filter in the current window.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}

        {activeTab === "striking" && (
          <table className="w-full text-left text-xs">
            <caption id={captionId} className="sr-only">
              Striking distance search queries ranking just outside the top positions
            </caption>
            <thead>
              <tr className="border-b border-brand-200/70 text-[10.5px] uppercase tracking-wider text-brand-400">
                <th className="px-4 py-3 font-semibold">Striking-Distance Query</th>
                <th className="px-3 py-3 text-right font-semibold">Position</th>
                <th className="px-3 py-3 text-right font-semibold">Impressions</th>
                <th className="px-3 py-3 text-right font-semibold">Clicks</th>
                <th className="px-3 py-3 text-right font-semibold">CTR</th>
                {!presentationMode && <th className="px-4 py-3 text-right font-semibold">Next Step</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-100">
              {filteredStriking.length > 0 ? (
                filteredStriking.slice(0, 40).map((row) => (
                  <tr key={row.key} className="hover:bg-brand-100/45 transition">
                    <td className="px-4 py-3 font-semibold text-brand-950">{row.key}</td>
                    <td className="px-3 py-3 text-right font-mono">
                      <span className="rounded-md bg-success-50 px-2 py-0.5 font-bold text-success-700">
                        #{row.position.toFixed(1)}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right font-mono font-bold text-brand-950">{count(row.impressions)}</td>
                    <td className="px-3 py-3 text-right font-mono text-brand-700">{count(row.clicks)}</td>
                    <td className="px-3 py-3 text-right font-mono text-brand-700">{percent(row.ctr)}</td>
                    {!presentationMode && (
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={fixEngineQueryHref(row.key)}
                          className="inline-flex items-center gap-1 rounded-lg bg-signal-400 px-2.5 py-1 text-[11px] font-bold text-signal-ink hover:bg-signal-500 transition shadow-2xs"
                        >
                          <span>Push to Top 3</span>
                          <ArrowUpRight className="h-3 w-3" />
                        </Link>
                      </td>
                    )}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={presentationMode ? 5 : 6} className="px-4 py-10 text-center text-brand-400">
                    No striking-distance opportunities (#4–#20 with meaningful impressions) detected in this window yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}

        {activeTab === "ctr" && (
          <table className="w-full text-left text-xs">
            <caption id={captionId} className="sr-only">
              High-impression queries underperforming expected click-through rate
            </caption>
            <thead>
              <tr className="border-b border-brand-200/70 text-[10.5px] uppercase tracking-wider text-brand-400">
                <th className="px-4 py-3 font-semibold">CTR Opportunity Query</th>
                <th className="px-3 py-3 text-right font-semibold">Position</th>
                <th className="px-3 py-3 text-right font-semibold">Impressions</th>
                <th className="px-3 py-3 text-right font-semibold">Actual vs Expected CTR</th>
                <th className="px-3 py-3 text-right font-semibold">Est. Missed Clicks</th>
                {!presentationMode && <th className="px-4 py-3 text-right font-semibold">Next Step</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-100">
              {filteredCtr.length > 0 ? (
                filteredCtr.slice(0, 40).map((row) => {
                  const missedClicks = Math.max(0, Math.round(row.impressions * row.shortfall));
                  return (
                    <tr key={row.key} className="hover:bg-brand-100/45 transition">
                      <td className="px-4 py-3 font-semibold text-brand-950">{row.key}</td>
                      <td className="px-3 py-3 text-right font-mono text-brand-700">#{row.position.toFixed(1)}</td>
                      <td className="px-3 py-3 text-right font-mono text-brand-700">{count(row.impressions)}</td>
                      <td className="px-3 py-3 text-right font-mono">
                        <span className="font-bold text-warning-700">{percent(row.ctr)}</span>
                        <span className="text-brand-400"> / {percent(row.expectedCtr)}</span>
                      </td>
                      <td className="px-3 py-3 text-right font-mono font-bold text-warning-700">
                        +{count(missedClicks)}
                      </td>
                      {!presentationMode && (
                        <td className="px-4 py-3 text-right">
                          <Link
                            href={fixEngineQueryHref(row.key)}
                            className="inline-flex items-center gap-1 rounded-lg border border-warning-500/40 bg-warning-50 px-2.5 py-1 text-[11px] font-bold text-warning-700 hover:bg-warning-100 transition"
                          >
                            <span>Improve Snippet</span>
                            <ArrowUpRight className="h-3 w-3" />
                          </Link>
                        </td>
                      )}
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={presentationMode ? 5 : 6} className="px-4 py-10 text-center text-brand-400">
                    No CTR shortfalls detected — your top search snippets are performing at or above benchmark.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}

        {activeTab === "declining" && (
          <table className="w-full text-left text-xs">
            <caption id={captionId} className="sr-only">
              Queries losing search position or clicks compared to the previous window
            </caption>
            <thead>
              <tr className="border-b border-brand-200/70 text-[10.5px] uppercase tracking-wider text-brand-400">
                <th className="px-4 py-3 font-semibold">Declining Query</th>
                <th className="px-3 py-3 text-right font-semibold">Position Shift</th>
                <th className="px-3 py-3 text-right font-semibold">Clicks Shift</th>
                <th className="px-3 py-3 text-right font-semibold">Impressions</th>
                {!presentationMode && <th className="px-4 py-3 text-right font-semibold">Action</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-100">
              {filteredDeclining.length > 0 ? (
                filteredDeclining.slice(0, 40).map((row) => (
                  <tr key={row.query} className="hover:bg-brand-100/45 transition">
                    <td className="px-4 py-3 font-semibold text-brand-950">{row.query}</td>
                    <td className="px-3 py-3 text-right font-mono">
                      <span className="text-brand-500">#{row.previousPosition.toFixed(1)} → </span>
                      <span className="font-bold text-error-700">#{row.currentPosition.toFixed(1)}</span>
                      <span className="ml-1.5 inline-flex items-center rounded bg-error-50 px-1.5 py-0.5 text-[10px] font-bold text-error-700">
                        <ArrowDownRight className="h-3 w-3" />
                        {Math.abs(row.positionChange).toFixed(1)}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-brand-700">
                      {count(row.previousClicks)} → <strong className="text-error-700">{count(row.currentClicks)}</strong>
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-brand-600">{count(row.impressions)}</td>
                    {!presentationMode && (
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={fixEngineQueryHref(row.query)}
                          className="inline-flex items-center gap-1 rounded-lg border border-error-500/35 bg-error-50 px-2.5 py-1 text-[11px] font-bold text-error-700 hover:bg-error-100 transition"
                        >
                          <span>Recover</span>
                          <ArrowUpRight className="h-3 w-3" />
                        </Link>
                      </td>
                    )}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={presentationMode ? 4 : 5} className="px-4 py-10 text-center text-brand-400">
                    No significant ranking drops detected compared to the prior period.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Native <dialog> Page Inspector Drawer */}
      <PageInspectorDialog
        projectId={projectId}
        pageUrl={inspectedPage}
        onClose={() => setInspectedPage(null)}
      />
    </div>
  );
}
