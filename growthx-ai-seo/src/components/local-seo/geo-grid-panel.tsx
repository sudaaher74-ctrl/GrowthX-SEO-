"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Crosshair, ExternalLink, Loader2, MapPin, Radar, Star } from "lucide-react";
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
import { ActionButton, Panel, Pill, StatusNote, relativeTime } from "@/components/ui/console";
import {
  CHART_AXIS_TICK,
  CHART_CURSOR_BAR,
  ChartTooltipCard,
} from "@/components/ui/chart-primitives";
import { api } from "@/lib/api-client";
import type { GeoGridScanResult, GridNode, PlacesCompetitorSearch } from "@/lib/api-types";

function rankCellClass(rank: number | null): string {
  if (rank == null) return "border-brand-200 bg-brand-100/80 text-brand-500";
  if (rank <= 3) return "border-success-200 bg-success-50 text-success-700";
  if (rank <= 10) return "border-warning-200 bg-warning-50 text-warning-700";
  return "border-error-200 bg-error-50 text-error-700";
}

export function GeoGridPanel({
  projectId,
  defaultKeyword,
  businessName,
  hasListing,
  yourReviewCount,
  yourRating,
}: {
  projectId: string;
  defaultKeyword: string;
  businessName: string;
  hasListing: boolean;
  yourReviewCount?: number | null;
  yourRating?: number | null;
}) {
  const queryClient = useQueryClient();
  const [keyword, setKeyword] = useState(defaultKeyword);
  const [gridSize, setGridSize] = useState<3 | 5 | 7>(3);
  const [radiusKm, setRadiusKm] = useState(5);
  const [activeRun, setActiveRun] = useState<GeoGridScanResult | null>(null);
  const [selectedNode, setSelectedNode] = useState<GridNode | null>(null);
  const [rivalsResult, setRivalsResult] = useState<PlacesCompetitorSearch | null>(null);

  const historyQuery = useQuery({
    queryKey: ["local-geo-grid-history", projectId],
    queryFn: () => api.getGeoGridHistory(projectId),
    enabled: Boolean(projectId),
    retry: false,
  });

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
      setActiveRun(data);
      setSelectedNode(data.nodes[Math.floor(data.nodes.length / 2)] ?? data.nodes[0] ?? null);
      queryClient.invalidateQueries({ queryKey: ["local-geo-grid-history", projectId] });
    },
  });

  const loadHistoricalRun = useMutation({
    mutationFn: (runId: string) => api.getGeoGridRun(projectId, runId),
    onSuccess: (data) => {
      setActiveRun(data);
      setSelectedNode(data.nodes[Math.floor(data.nodes.length / 2)] ?? data.nodes[0] ?? null);
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
          shortName: `${(youInAll.name.length > 14 ? `${youInAll.name.slice(0, 13)}…` : youInAll.name)} (You)`,
          reviews: youInAll.reviewCount ?? 0,
          rating: youInAll.rating ?? null,
          rank: youInAll.rank,
          distanceKm: youInAll.distanceKm ?? null,
          isYou: true,
        });
      } else if (yourReviewCount != null) {
        const label = businessName || "Your Listing";
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

  return (
    <div className="space-y-4">
      <Panel
        title="Local Google Maps Competitors & Neighborhood Geo-Grid"
        subtitle="See who beats you on Google Maps around your location and map where you rank across nearby neighborhoods"
        padded
      >
        {!hasListing ? (
          <StatusNote tone="warn">
            Connect your Google Maps listing on the <strong>Maps Profile &amp; Audit</strong> tab first so Reigel knows your map coordinates and can compare your rank against nearby rivals.
          </StatusNote>
        ) : (
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[220px] flex-1">
              <label className="block text-[11px] font-semibold uppercase tracking-wide text-brand-500">
                Local Search Keyword
              </label>
              <input
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="e.g. fresh milk delivery, dental clinic, bakery"
                className="mt-1 w-full rounded-lg border border-brand-200 bg-surface-0 px-3 py-2 text-[13px] text-brand-950 focus:border-accent-500 focus:outline-none"
              />
            </div>

            <div className="w-28">
              <label className="block text-[11px] font-semibold uppercase tracking-wide text-brand-500">
                Radius (km)
              </label>
              <select
                value={radiusKm}
                onChange={(e) => setRadiusKm(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-brand-200 bg-surface-0 px-2.5 py-2 text-[13px] text-brand-950"
              >
                <option value={2}>2 km</option>
                <option value={5}>5 km</option>
                <option value={10}>10 km</option>
                <option value={15}>15 km</option>
              </select>
            </div>

            <div className="w-28">
              <label className="block text-[11px] font-semibold uppercase tracking-wide text-brand-500">
                Grid Size
              </label>
              <select
                value={gridSize}
                onChange={(e) => setGridSize(Number(e.target.value) as 3 | 5 | 7)}
                className="mt-1 w-full rounded-lg border border-brand-200 bg-surface-0 px-2.5 py-2 text-[13px] text-brand-950"
              >
                <option value={3}>3 × 3 (9 pts)</option>
                <option value={5}>5 × 5 (25 pts)</option>
                <option value={7}>7 × 7 (49 pts)</option>
              </select>
            </div>

            <ActionButton
              variant="secondary"
              disabled={!keyword.trim() || rivalSearch.isPending}
              onClick={() => rivalSearch.mutate()}
              icon={rivalSearch.isPending ? <Loader2 size={13} className="animate-spin" /> : <Crosshair size={13} />}
            >
              {rivalSearch.isPending ? "Checking..." : "Check Maps Rivals"}
            </ActionButton>
            <ActionButton
              variant="primary"
              disabled={!keyword.trim() || geoScan.isPending}
              onClick={() => geoScan.mutate()}
              icon={geoScan.isPending ? <Loader2 size={13} className="animate-spin" /> : <Radar size={13} />}
            >
              {geoScan.isPending ? "Scanning Grid..." : "Run Geo-Grid Scan"}
            </ActionButton>
          </div>
        )}

        {rivalSearch.isError && (
          <div className="mt-3">
            <StatusNote tone="bad">
              {rivalSearch.error instanceof Error ? rivalSearch.error.message : "Could not search Maps rivals."}
            </StatusNote>
          </div>
        )}
        {geoScan.isError && (
          <div className="mt-3">
            <StatusNote tone="bad">
              {geoScan.error instanceof Error ? geoScan.error.message : "Geo-Grid scan failed."}
            </StatusNote>
          </div>
        )}
      </Panel>

      {rivalsResult && (
        <Panel
          title={`Google Maps Leaders for "${rivalsResult.keyword}" (${rivalsResult.radiusKm} km radius)`}
          subtitle={
            rivalsResult.yourRank != null
              ? `Your listing ranked #${rivalsResult.yourRank} out of ${rivalsResult.results.length} results`
              : `Your listing did not appear in the top ${rivalsResult.results.length} Maps results for this search`
          }
          padded
        >
          {reviewGapChart && (
            <div className="mb-5 border-b border-brand-100 pb-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-[13px] font-semibold text-brand-950">
                    Maps Review Volume vs. Top Local Leaders
                  </p>
                  <p className="mt-0.5 text-[11.5px] text-brand-500">
                    Top-3 average: <span className="font-mono font-semibold text-brand-800">{reviewGapChart.top3Avg.toLocaleString()}</span> reviews
                    {reviewGapChart.yourCount != null && (
                      <>
                        {" · "}You: <span className="font-mono font-semibold text-brand-800">{reviewGapChart.yourCount.toLocaleString()}</span>
                        {reviewGapChart.gap != null && reviewGapChart.gap > 0
                          ? ` (${reviewGapChart.gap.toLocaleString()} review gap to Top 3)`
                          : reviewGapChart.gap != null && reviewGapChart.gap <= 0
                            ? " (ahead of Top-3 average)"
                            : ""}
                      </>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-brand-500">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: "var(--color-success-500)" }} />
                    You
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: "var(--color-accent-500)" }} />
                    Maps rivals
                  </span>
                </div>
              </div>
              <div style={{ height: Math.max(156, reviewGapChart.rows.length * 36 + 24) }} className="w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={reviewGapChart.rows}
                    layout="vertical"
                    margin={{ top: 2, right: 20, left: 4, bottom: 2 }}
                  >
                    <CartesianGrid
                      stroke="var(--color-brand-100)"
                      strokeDasharray="2 4"
                      horizontal={false}
                    />
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
                                label: "Google Reviews",
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
                                ? { label: "Maps Rank", value: `#${row.rank}` }
                                : { label: "Maps Rank", value: "Outside top results" }
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
            <table className="w-full text-left text-[12px]">
              <thead>
                <tr className="border-b border-brand-200 text-[10.5px] uppercase tracking-wider text-brand-400">
                  <th className="pb-2 pr-3">Rank</th>
                  <th className="pb-2 pr-3">Business</th>
                  <th className="pb-2 pr-3">Category</th>
                  <th className="pb-2 pr-3 text-right">Rating</th>
                  <th className="pb-2 pr-3 text-right">Reviews</th>
                  <th className="pb-2 text-right">Distance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-100">
                {rivalsResult.results.map((r) => (
                  <tr key={r.placeId} className={r.isYou ? "bg-accent-50/60 font-semibold" : ""}>
                    <td className="py-2 pr-3 font-mono text-brand-950">#{r.rank}</td>
                    <td className="py-2 pr-3 text-brand-950">
                      <div className="flex items-center gap-1.5">
                        <span>{r.name}</span>
                        {r.isYou && <Pill tone="good">You</Pill>}
                        {r.googleMapsUri && (
                          <a
                            href={r.googleMapsUri}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-brand-400 hover:text-accent-700"
                            aria-label={`Open ${r.name} on Google Maps`}
                          >
                            <ExternalLink size={11} />
                          </a>
                        )}
                      </div>
                      {r.address && <p className="text-[11px] font-normal text-brand-500">{r.address}</p>}
                    </td>
                    <td className="py-2 pr-3 text-brand-600">{r.category || "—"}</td>
                    <td className="py-2 pr-3 text-right font-mono text-brand-900">
                      {r.rating != null ? (
                        <span className="inline-flex items-center gap-0.5">
                          <Star size={11} className="text-warning-600" />
                          {r.rating.toFixed(1)}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-2 pr-3 text-right font-mono text-brand-900">
                      {r.reviewCount != null ? r.reviewCount.toLocaleString() : "—"}
                    </td>
                    <td className="py-2 text-right font-mono text-brand-600">
                      {r.distanceKm != null ? `${r.distanceKm.toFixed(1)} km` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {activeRun && (
        <Panel
          title={`Geo-Grid Heatmap: "${activeRun.keyword}" (${activeRun.gridSize}×${activeRun.gridSize} · ${activeRun.radiusKm} km)`}
          subtitle={`Scanned ${relativeTime(activeRun.scannedAt)} · Top-3 Dominance: ${Math.round(activeRun.metrics.top3DominancePercentage)}% · Average Rank: ${activeRun.metrics.averageGridRank != null ? `#${activeRun.metrics.averageGridRank.toFixed(1)}` : "Not ranked"}`}
          padded
        >
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
            <div className="lg:col-span-7 space-y-3">
              <div
                className="grid gap-1.5"
                style={{ gridTemplateColumns: `repeat(${activeRun.gridSize}, minmax(0, 1fr))` }}
              >
                {activeRun.nodes.map((node) => {
                  const isSelected = selectedNode?.id === node.id;
                  return (
                    <button
                      key={node.id}
                      type="button"
                      onClick={() => setSelectedNode(node)}
                      className={`flex flex-col items-center justify-center rounded-lg border p-2 text-center transition cursor-pointer ${rankCellClass(node.rank)} ${isSelected ? "ring-2 ring-accent-600" : ""}`}
                    >
                      <span className="font-mono text-[13px] font-bold">
                        {node.rank != null ? `#${node.rank}` : "—"}
                      </span>
                      <span className="text-[9.5px] opacity-80">{node.direction}</span>
                    </button>
                  );
                })}
              </div>
              <div className="flex flex-wrap items-center gap-3 text-[11px] text-brand-500">
                <span className="inline-flex items-center gap-1"><Pill tone="good">#1–3</Pill> Maps Pack Top 3</span>
                <span className="inline-flex items-center gap-1"><Pill tone="warn">#4–10</Pill> Striking Distance</span>
                <span className="inline-flex items-center gap-1"><Pill tone="bad">#11–20</Pill> Weak Zone</span>
                <span className="inline-flex items-center gap-1"><Pill tone="default">—</Pill> Not Found</span>
              </div>
            </div>

            <div className="lg:col-span-5 space-y-3">
              {selectedNode && (
                <div className="rounded-xl border border-brand-200 bg-brand-50/60 p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[12px] font-bold text-brand-950 flex items-center gap-1.5">
                      <MapPin size={13} className="text-accent-600" />
                      <span>
                        Zone {selectedNode.direction} ({selectedNode.distanceKm.toFixed(1)} km)
                      </span>
                    </p>
                    <Pill tone={selectedNode.rank != null && selectedNode.rank <= 3 ? "good" : selectedNode.rank != null ? "warn" : "default"}>
                      {selectedNode.rank != null ? `Rank #${selectedNode.rank}` : "Not ranked"}
                    </Pill>
                  </div>
                  <p className="text-[11px] text-brand-500">
                    Top businesses shown at ({selectedNode.lat.toFixed(4)}, {selectedNode.lng.toFixed(4)}):
                  </p>
                  <ul className="space-y-1 text-[11.5px]">
                    {selectedNode.topCompetitors.slice(0, 6).map((c) => (
                      <li key={`${c.rank}-${c.name}`} className="flex items-center justify-between gap-2">
                        <span className={c.isClient ? "font-bold text-accent-700" : "text-brand-800"}>
                          #{c.rank} {c.name} {c.isClient ? "(You)" : ""}
                        </span>
                        <span className="font-mono text-[11px] text-brand-500">
                          {c.rating ? `${c.rating.toFixed(1)}★` : ""}{c.reviewsCount ? ` (${c.reviewsCount})` : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {activeRun.aiGeoActionPlan?.diagnosis && (
                <div className="rounded-xl border border-brand-200 p-3.5 space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-accent-700">
                    Geo-Grid Diagnosis
                  </p>
                  <p className="text-[12px] leading-relaxed text-brand-700">{activeRun.aiGeoActionPlan.diagnosis}</p>
                  {activeRun.aiGeoActionPlan.actionItems?.length > 0 && (
                    <ul className="space-y-1.5 pt-1 text-[11.5px] text-brand-800">
                      {activeRun.aiGeoActionPlan.actionItems.slice(0, 4).map((item, idx) => (
                        <li key={idx} className="rounded-lg bg-brand-50/70 p-2">
                          <span className="font-semibold text-brand-950">{item.action}</span>{" "}
                          <span className="text-brand-500">({item.targetZone})</span> — {item.description}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </div>
        </Panel>
      )}

      {(historyQuery.data?.length ?? 0) > 0 && (
        <Panel title="Recent Geo-Grid Runs" subtitle="Click any past scan to inspect its heatmap and compare progress" padded>
          <div className="flex flex-wrap gap-2">
            {historyQuery.data!.slice(0, 8).map((run) => (
              <button
                key={run.id}
                type="button"
                onClick={() => loadHistoricalRun.mutate(run.id)}
                className="rounded-lg border border-brand-200 bg-brand-50/50 px-3 py-2 text-left text-[11.5px] hover:bg-brand-100 transition cursor-pointer"
              >
                <p className="font-bold text-brand-950">{run.keyword}</p>
                <p className="text-brand-500">
                  {run.gridSize}×{run.gridSize} · {run.radiusKm}km · Avg{" "}
                  {run.averageRank != null ? `#${run.averageRank.toFixed(1)}` : "—"} · {relativeTime(run.ranAt)}
                </p>
              </button>
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}
