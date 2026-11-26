"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Crosshair, ExternalLink, Loader2, Radar, Search, Star } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ActionButton, Pill, StatusNote, relativeTime } from "@/components/ui/console";
import {
  CHART_AXIS_TICK,
  CHART_CURSOR_BAR,
  ChartTooltipCard,
} from "@/components/ui/chart-primitives";
import { api } from "@/lib/api-client";
import type { GeoGridScanResult, GridNode, PlacesCompetitorSearch } from "@/lib/api-types";
import { cn } from "@/lib/utils";

const GeoGridMap = dynamic(
  () => import("./geo-grid-map").then((m) => m.GeoGridMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[460px] items-center justify-center rounded-2xl border border-brand-200 bg-surface-1 text-xs text-brand-400">
        Loading street map…
      </div>
    ),
  },
);

export function GeoGridPanel({
  projectId,
  defaultKeyword,
  businessName,
  hasListing,
  centerLat,
  centerLng,
  yourReviewCount,
  yourRating,
  onConnectClick,
}: {
  projectId: string;
  defaultKeyword: string;
  businessName: string;
  hasListing: boolean;
  centerLat: number | null;
  centerLng: number | null;
  yourReviewCount?: number | null;
  yourRating?: number | null;
  onConnectClick?: () => void;
}) {
  const queryClient = useQueryClient();
  const [keyword, setKeyword] = useState(defaultKeyword);
  const [gridSize, setGridSize] = useState<3 | 5 | 7>(3);
  const [radiusKm, setRadiusKm] = useState(5);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [freshRun, setFreshRun] = useState<GeoGridScanResult | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [rivalsResult, setRivalsResult] = useState<PlacesCompetitorSearch | null>(null);

  const historyQuery = useQuery({
    queryKey: ["local-geo-grid-history", projectId],
    queryFn: () => api.getGeoGridHistory(projectId),
    enabled: Boolean(projectId),
    retry: false,
  });

  const activeRunId = selectedRunId ?? historyQuery.data?.[0]?.id ?? null;

  const savedRunQuery = useQuery({
    queryKey: ["local-geo-grid-run", projectId, activeRunId],
    queryFn: () => api.getGeoGridRun(projectId, activeRunId!),
    enabled: Boolean(projectId && activeRunId),
    staleTime: 60_000,
    retry: false,
  });

  const activeRun: GeoGridScanResult | null = useMemo(() => {
    if (freshRun && (!selectedRunId || freshRun.runId === selectedRunId)) {
      return freshRun;
    }
    return savedRunQuery.data ?? freshRun ?? null;
  }, [freshRun, selectedRunId, savedRunQuery.data]);

  const selectedNode: GridNode | null = useMemo(() => {
    if (!activeRun || activeRun.nodes.length === 0) return null;
    if (selectedNodeId === "__none__") return null;
    if (selectedNodeId) {
      const hit = activeRun.nodes.find((n) => n.id === selectedNodeId);
      if (hit) return hit;
    }
    return activeRun.nodes[Math.floor(activeRun.nodes.length / 2)] ?? activeRun.nodes[0] ?? null;
  }, [activeRun, selectedNodeId]);

  const rivalSearch = useMutation({
    mutationFn: () => api.getPlacesCompetitors(projectId, keyword.trim(), radiusKm),
    onSuccess: (data) => setRivalsResult(data),
  });

  const geoScan = useMutation({
    mutationFn: () =>
      api.runGeoGridScan(projectId, {
        keyword: keyword.trim(),
        businessName: businessName || undefined,
        gridSize,
        radiusKm,
      }),
    onSuccess: (data) => {
      setFreshRun(data);
      setSelectedRunId(data.runId);
      setSelectedNodeId(null);
      queryClient.setQueryData(["local-geo-grid-run", projectId, data.runId], data);
      queryClient.invalidateQueries({ queryKey: ["local-geo-grid-history", projectId] });
    },
  });

  const reviewGapChart = useMemo(() => {
    if (!rivalsResult || rivalsResult.results.length === 0) return null;
    const topFive = rivalsResult.results.slice(0, 5);
    const hasYouInTop = topFive.some((r) => r.isYou);
    const youInAll = rivalsResult.results.find((r) => r.isYou) ?? null;

    const rows = topFive.map((r) => ({
      id: r.placeId,
      name: r.name,
      shortName: r.name.length > 18 ? `${r.name.slice(0, 17)}…` : r.name,
      reviews: r.reviewCount ?? 0,
      rating: r.rating ?? null,
      rank: r.rank as number | null,
      distanceKm: r.distanceKm ?? null,
      isYou: r.isYou,
    }));

    if (!hasYouInTop) {
      if (youInAll) {
        rows.push({
          id: youInAll.placeId,
          name: `${youInAll.name} (You)`,
          shortName: `${youInAll.name.length > 14 ? `${youInAll.name.slice(0, 13)}…` : youInAll.name} (You)`,
          reviews: youInAll.reviewCount ?? 0,
          rating: youInAll.rating ?? null,
          rank: youInAll.rank,
          distanceKm: youInAll.distanceKm ?? null,
          isYou: true,
        });
      } else if (yourReviewCount != null) {
        const label = businessName || "Your Business";
        rows.push({
          id: "your-listing",
          name: `${label} (You)`,
          shortName: `${label.length > 14 ? `${label.slice(0, 13)}…` : label} (You)`,
          reviews: yourReviewCount,
          rating: yourRating ?? null,
          rank: null,
          distanceKm: 0,
          isYou: true,
        });
      }
    }

    if (rows.every((r) => r.reviews === 0)) return null;

    const top3Rivals = rivalsResult.results.slice(0, 3);
    const top3Avg =
      top3Rivals.length > 0
        ? Math.round(top3Rivals.reduce((s, r) => s + (r.reviewCount ?? 0), 0) / top3Rivals.length)
        : 0;
    const yourCount = youInAll?.reviewCount ?? yourReviewCount ?? null;
    const gap = yourCount != null ? top3Avg - yourCount : null;

    return { rows, top3Avg, yourCount, gap };
  }, [rivalsResult, yourReviewCount, yourRating, businessName]);

  if (!hasListing) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-brand-200 bg-surface-1 px-6 py-12 text-center">
        <Radar className="h-6 w-6 text-brand-400" />
        <h2 className="mt-3 text-sm font-semibold text-brand-950">Connect your Google Maps listing first</h2>
        <p className="mt-1 max-w-sm text-xs text-brand-500">
          Once your location is connected, we’ll map exactly where you rank across nearby neighborhoods and compare you with local competitors.
        </p>
        {onConnectClick && (
          <ActionButton variant="primary" className="mt-4" onClick={onConnectClick}>
            Connect Google Maps
          </ActionButton>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Slim Single-Row Scan Bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (keyword.trim() && !geoScan.isPending) geoScan.mutate();
        }}
        className="flex flex-wrap items-center gap-2 rounded-2xl border border-brand-200 bg-surface-1 p-2.5 shadow-2xs"
      >
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-brand-400" />
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="What customers search (e.g. bakery, dentist, cafe)"
            aria-label="Search term to check on Google Maps"
            className="w-full rounded-xl border border-brand-200 bg-surface-2 py-2 pr-3 pl-8 text-[13px] text-brand-950 placeholder:text-brand-400 focus:border-primary-600 focus:outline-none"
          />
        </div>

        <select
          value={radiusKm}
          onChange={(e) => setRadiusKm(Number(e.target.value))}
          aria-label="Search radius"
          className="rounded-xl border border-brand-200 bg-surface-2 px-3 py-2 text-[12.5px] font-medium text-brand-900 focus:border-primary-600 focus:outline-none"
        >
          <option value={2}>2 km radius</option>
          <option value={5}>5 km radius</option>
          <option value={10}>10 km radius</option>
          <option value={15}>15 km radius</option>
        </select>

        <select
          value={gridSize}
          onChange={(e) => setGridSize(Number(e.target.value) as 3 | 5 | 7)}
          aria-label="Map pin density"
          className="rounded-xl border border-brand-200 bg-surface-2 px-3 py-2 text-[12.5px] font-medium text-brand-900 focus:border-primary-600 focus:outline-none"
        >
          <option value={3}>3×3 (9 pins)</option>
          <option value={5}>5×5 (25 pins)</option>
          <option value={7}>7×7 (49 pins)</option>
        </select>

        <ActionButton
          variant="primary"
          disabled={!keyword.trim() || geoScan.isPending}
          onClick={() => geoScan.mutate()}
          icon={geoScan.isPending ? <Loader2 size={13} className="animate-spin" /> : <Radar size={13} />}
        >
          {geoScan.isPending ? "Scanning..." : "Scan Rank Map"}
        </ActionButton>

        <ActionButton
          variant="secondary"
          disabled={!keyword.trim() || rivalSearch.isPending}
          onClick={() => rivalSearch.mutate()}
          icon={rivalSearch.isPending ? <Loader2 size={13} className="animate-spin" /> : <Crosshair size={13} />}
        >
          {rivalSearch.isPending ? "Checking..." : "Compare Competitors"}
        </ActionButton>
      </form>

      {geoScan.isError && (
        <StatusNote tone="bad">
          {geoScan.error instanceof Error ? geoScan.error.message : "Could not complete the rank map scan."}
        </StatusNote>
      )}
      {rivalSearch.isError && (
        <StatusNote tone="bad">
          {rivalSearch.error instanceof Error ? rivalSearch.error.message : "Could not load nearby competitors."}
        </StatusNote>
      )}

      {/* Hero Interactive Street Map with Live Rank Pins */}
      <GeoGridMap
        run={activeRun}
        businessName={businessName}
        centerLat={centerLat}
        centerLng={centerLng}
        selectedNode={selectedNode}
        onSelectNode={(node) => setSelectedNodeId(node ? node.id : "__none__")}
        mode="full"
      />

      {/* Past Scans Switcher (compact pill row) */}
      {(historyQuery.data?.length ?? 0) > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-[11px] font-semibold uppercase tracking-wider text-brand-400">
            Recent scans
          </span>
          {historyQuery.data!.slice(0, 6).map((run) => {
            const isCurrent = activeRun?.runId === run.id;
            return (
              <button
                key={run.id}
                type="button"
                onClick={() => {
                  setSelectedRunId(run.id);
                  setSelectedNodeId(null);
                  setKeyword(run.keyword);
                }}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11.5px] font-medium transition cursor-pointer",
                  isCurrent
                    ? "border-brand-950 bg-brand-950 text-brand-50"
                    : "border-brand-200 bg-surface-1 text-brand-700 hover:bg-brand-100/70",
                )}
              >
                <span className="font-semibold">{run.keyword}</span>
                <span className="font-mono text-[10.5px] opacity-75">
                  {run.averageRank != null ? `#${run.averageRank.toFixed(1)}` : "—"} · {relativeTime(run.ranAt)}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Concise Plain-English Takeaways (only when available) */}
      {activeRun?.aiGeoActionPlan?.diagnosis && (
        <div className="rounded-2xl border border-brand-200 bg-surface-1 p-5 shadow-2xs">
          <p className="text-xs font-semibold text-brand-950">What this map means</p>
          <p className="mt-1 text-[13px] leading-relaxed text-brand-600">
            {activeRun.aiGeoActionPlan.diagnosis}
          </p>
          {activeRun.aiGeoActionPlan.actionItems?.length > 0 && (
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
              {activeRun.aiGeoActionPlan.actionItems.slice(0, 3).map((item, idx) => (
                <div key={idx} className="rounded-xl border border-brand-200/70 bg-surface-2 p-3">
                  <p className="text-xs font-semibold text-brand-950">{item.action}</p>
                  <p className="mt-1 text-[11.5px] leading-snug text-brand-500">{item.description}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Competitor Review Gap & Leaderboard */}
      {rivalsResult && (
        <div className="rounded-2xl border border-brand-200 bg-surface-1 p-5 shadow-2xs space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-brand-950">
                Top competitors for &ldquo;{rivalsResult.keyword}&rdquo;
              </h3>
              <p className="mt-0.5 text-xs text-brand-500">
                {rivalsResult.yourRank != null
                  ? `You currently rank #${rivalsResult.yourRank} within ${rivalsResult.radiusKm} km.`
                  : `You didn’t appear in the top ${rivalsResult.results.length} Maps results within ${rivalsResult.radiusKm} km.`}
              </p>
            </div>
            {reviewGapChart && (
              <div className="flex items-center gap-3 text-[11px] text-brand-500">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-success-500" /> You
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-accent-500" /> Competitors
                </span>
              </div>
            )}
          </div>

          {reviewGapChart && (
            <div className="border-b border-brand-100 pb-5">
              <p className="mb-3 text-xs text-brand-500">
                Top 3 average{" "}
                <strong className="font-mono text-brand-900">
                  {reviewGapChart.top3Avg.toLocaleString()}
                </strong>{" "}
                reviews
                {reviewGapChart.gap != null && reviewGapChart.gap > 0
                  ? ` — you need about ${reviewGapChart.gap.toLocaleString()} more to match them.`
                  : reviewGapChart.gap != null && reviewGapChart.gap <= 0
                    ? " — you are ahead of the Top 3 average."
                    : "."}
              </p>
              <div
                style={{ height: Math.max(150, reviewGapChart.rows.length * 36 + 20) }}
                className="w-full min-w-0"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={reviewGapChart.rows}
                    layout="vertical"
                    margin={{ top: 2, right: 20, left: 4, bottom: 2 }}
                  >
                    <CartesianGrid stroke="var(--color-brand-100)" strokeDasharray="2 4" horizontal={false} />
                    <XAxis
                      type="number"
                      axisLine={false}
                      tickLine={false}
                      tick={CHART_AXIS_TICK}
                      allowDecimals={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="shortName"
                      width={136}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11.5, fill: "var(--color-brand-700)", fontWeight: 500 }}
                    />
                    <Tooltip
                      cursor={CHART_CURSOR_BAR}
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const row = payload[0]?.payload as (typeof reviewGapChart.rows)[number] | undefined;
                        if (!row) return null;
                        return (
                          <ChartTooltipCard
                            title={row.name}
                            rows={[
                              {
                                label: "Reviews",
                                value: row.reviews.toLocaleString(),
                                color: row.isYou ? "var(--color-success-500)" : "var(--color-accent-500)",
                                shape: "bar",
                              },
                              ...(row.rating != null
                                ? [
                                    {
                                      label: "Rating",
                                      value: `${row.rating.toFixed(1)}★`,
                                      color: "var(--color-warning-500)",
                                      shape: "dot" as const,
                                    },
                                  ]
                                : []),
                            ]}
                            footer={
                              row.rank != null
                                ? { label: "Rank", value: `#${row.rank}` }
                                : { label: "Rank", value: "Outside top results" }
                            }
                          />
                        );
                      }}
                    />
                    <Bar
                      dataKey="reviews"
                      barSize={14}
                      radius={[0, 6, 6, 0]}
                      background={{ fill: "var(--color-brand-100)", radius: 6 }}
                    >
                      {reviewGapChart.rows.map((row) => (
                        <Cell
                          key={row.id}
                          fill={row.isYou ? "var(--color-success-500)" : "var(--color-accent-500)"}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-brand-200 text-[10.5px] uppercase tracking-wider text-brand-400">
                  <th className="pb-2 pr-3">Rank</th>
                  <th className="pb-2 pr-3">Business</th>
                  <th className="pb-2 pr-3 text-right">Rating</th>
                  <th className="pb-2 pr-3 text-right">Reviews</th>
                  <th className="pb-2 text-right">Distance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-100">
                {rivalsResult.results.map((r) => (
                  <tr key={r.placeId} className={r.isYou ? "bg-success-50/50 font-semibold" : ""}>
                    <td className="py-2.5 pr-3 font-mono text-brand-950">#{r.rank}</td>
                    <td className="py-2.5 pr-3 text-brand-950">
                      <div className="flex items-center gap-1.5">
                        <span>{r.name}</span>
                        {r.isYou && <Pill tone="good">You</Pill>}
                        {r.googleMapsUri && (
                          <a
                            href={r.googleMapsUri}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-brand-400 hover:text-brand-900"
                            aria-label={`Open ${r.name} on Google Maps`}
                          >
                            <ExternalLink size={11} />
                          </a>
                        )}
                      </div>
                      {r.category && <p className="text-[11px] font-normal text-brand-400">{r.category}</p>}
                    </td>
                    <td className="py-2.5 pr-3 text-right font-mono text-brand-900 tabular-nums">
                      {r.rating != null ? (
                        <span className="inline-flex items-center gap-0.5">
                          <Star size={11} className="text-warning-500" />
                          {r.rating.toFixed(1)}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-2.5 pr-3 text-right font-mono text-brand-900 tabular-nums">
                      {r.reviewCount != null ? r.reviewCount.toLocaleString() : "—"}
                    </td>
                    <td className="py-2.5 text-right font-mono text-brand-500 tabular-nums">
                      {r.distanceKm != null ? `${r.distanceKm.toFixed(1)} km` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
