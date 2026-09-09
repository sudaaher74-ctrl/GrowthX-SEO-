"use client";

import React, { useState } from "react";
import {
  MapPin,
  Search,
  Loader2,
  Award,
  Store,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { useRunGeoGridScan, useGeoGridHistory } from "@/hooks/use-growthx";
import { errorMessage } from "@/lib/error-message";
import type { GeoGridScanResult, LocalSeoData } from "@/lib/api-client";
import { cn } from "@/lib/utils";

interface LocalRankingsTabProps {
  localSeo: LocalSeoData | null | undefined;
  projectId: string | null;
}

function getNodeColor(rank: number | null) {
  if (rank == null) return "bg-slate-200 text-slate-500";
  if (rank <= 3) return "bg-emerald-500 text-white";
  if (rank <= 5) return "bg-emerald-400 text-white";
  if (rank <= 10) return "bg-amber-500 text-white";
  return "bg-rose-500 text-white";
}

export function LocalRankingsTab({ localSeo, projectId }: LocalRankingsTabProps) {
  const [keyword, setKeyword] = useState("");
  const [radius, setRadius] = useState(5);
  const [gridSize, setGridSize] = useState<3 | 5>(5);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<GeoGridScanResult | null>(null);
  const [selectedHistoryKeyword, setSelectedHistoryKeyword] = useState<string | undefined>(undefined);

  const scanMutation = useRunGeoGridScan(projectId);
  const { data: allHistory = [], refetch: refetchHistory, isLoading: historyLoading } = useGeoGridHistory(projectId);

  const uniqueKeywords = Array.from(new Set(allHistory.map((h) => h.keyword)));
  const effectiveKeyword = selectedHistoryKeyword ?? uniqueKeywords[0];
  const history = effectiveKeyword ? allHistory.filter((h) => h.keyword === effectiveKeyword) : [];

  const handleRunScan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyword.trim()) return;
    setError(null);
    scanMutation.mutate(
      {
        keyword: keyword.trim(),
        businessName: localSeo?.businessName,
        gridSize,
        radiusKm: radius,
      },
      {
        onSuccess: (result) => {
          setLastResult(result);
          setSelectedHistoryKeyword(result.keyword);
          refetchHistory();
        },
        onError: (err) => setError(errorMessage(err)),
      }
    );
  };

  const activeRun = lastResult;

  return (
    <div className="space-y-6">
      {/* ── Run a scan ─────────────────────────────────────────── */}
      <div
        className="rounded-2xl border bg-white p-4 shadow-xs flex flex-wrap items-end gap-3"
        style={{ borderColor: "var(--border-color)" }}
      >
        <form onSubmit={handleRunScan} className="flex flex-wrap items-end gap-3 flex-1">
          <div className="flex-1 min-w-[220px]">
            <label className="block text-[11px] font-semibold text-brand-600 mb-1">Keyword to track</label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-600" />
              <input
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="e.g. fresh milk delivery near me"
                className="w-full h-9 pl-8 pr-3 text-xs rounded-lg border border-brand-200 bg-white font-medium text-brand-950 focus:outline-none focus:ring-1 focus:ring-brand-950"
              />
            </div>
          </div>

          <div className="w-24">
            <label className="block text-[11px] font-semibold text-brand-600 mb-1">Radius (km)</label>
            <select
              value={radius}
              onChange={(e) => setRadius(Number(e.target.value))}
              className="w-full h-9 px-2 text-xs rounded-lg border border-brand-200 bg-white font-medium text-brand-950 focus:outline-none"
            >
              <option value={3}>3 km</option>
              <option value={5}>5 km</option>
              <option value={10}>10 km</option>
            </select>
          </div>

          <div className="w-28">
            <label className="block text-[11px] font-semibold text-brand-600 mb-1">Grid size</label>
            <select
              value={gridSize}
              onChange={(e) => setGridSize(Number(e.target.value) as 3 | 5)}
              className="w-full h-9 px-2 text-xs rounded-lg border border-brand-200 bg-white font-medium text-brand-950 focus:outline-none"
            >
              <option value={3}>3 x 3</option>
              <option value={5}>5 x 5</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={scanMutation.isPending || !keyword.trim()}
            className="inline-flex items-center gap-1.5 px-4 h-9 rounded-lg bg-brand-950 text-white text-xs font-semibold hover:opacity-90 transition-all shadow-xs disabled:opacity-50"
          >
            {scanMutation.isPending ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <RefreshCw size={13} />
            )}
            <span>Run Scan</span>
          </button>
        </form>
      </div>

      {error && (
        <div className="flex items-start gap-2.5 p-3 rounded-lg bg-error-50 border border-error-200 text-xs text-error-800">
          <AlertCircle size={15} className="text-error-600 shrink-0 mt-0.5" />
          <div className="flex-1">{error}</div>
        </div>
      )}

      {/* ── Keyword history switcher ──────────────────────────────── */}
      {uniqueKeywords.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] text-brand-500">Tracked keywords:</span>
          {uniqueKeywords.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => {
                setLastResult(null);
                setSelectedHistoryKeyword(k);
              }}
              className={cn(
                "px-2.5 py-1 rounded-full text-[11px] font-semibold border transition",
                effectiveKeyword === k && !lastResult
                  ? "bg-brand-950 text-white border-brand-950"
                  : "bg-white text-brand-700 border-brand-200 hover:bg-brand-50"
              )}
            >
              {k}
            </button>
          ))}
        </div>
      )}

      {!activeRun && !historyLoading && history.length === 0 && (
        <div className="rounded-2xl border bg-white p-10 text-center shadow-xs" style={{ borderColor: "var(--border-color)" }}>
          <MapPin size={28} className="mx-auto text-brand-300 mb-3" />
          <h3 className="text-sm font-bold text-brand-950">No rankings tracked yet</h3>
          <p className="text-xs text-brand-500 mt-1 max-w-sm mx-auto">
            Run a GeoGrid scan above for a keyword to see your business&apos;s real position across nearby areas.
          </p>
        </div>
      )}

      {/* ── Past runs for the selected keyword (summary only — run a new scan for the live map) ── */}
      {!activeRun && history.length > 0 && (
        <div className="rounded-2xl border bg-white p-5 shadow-xs space-y-3" style={{ borderColor: "var(--border-color)" }}>
          <h2 className="text-sm font-bold text-brand-950">
            Past scans for &quot;{effectiveKeyword}&quot;
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-brand-100 text-[11px] font-bold text-brand-500">
                  <th className="pb-2">Scanned</th>
                  <th className="pb-2 text-center">Avg. Rank</th>
                  <th className="pb-2 text-center">Top 3</th>
                  <th className="pb-2 text-center">Top 10</th>
                  <th className="pb-2 text-right">Found</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-50">
                {history.map((run) => (
                  <tr key={run.id}>
                    <td className="py-2 text-brand-700">{new Date(run.ranAt).toLocaleString()}</td>
                    <td className="py-2 text-center font-bold text-brand-950">
                      {run.averageRank != null ? run.averageRank.toFixed(1) : "—"}
                    </td>
                    <td className="py-2 text-center">{run.top3Count}</td>
                    <td className="py-2 text-center">{run.top10Count}</td>
                    <td className="py-2 text-right">
                      {run.foundCount} / {run.pointCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-brand-400">
            Run a new scan above to see the live grid map and AI diagnosis for this keyword.
          </p>
        </div>
      )}

      {/* ── Latest run summary ─────────────────────────────────────── */}
      {activeRun && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-2xl border bg-white p-5 shadow-xs" style={{ borderColor: "var(--border-color)" }}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-brand-600">Average Grid Rank</span>
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <MapPin size={16} />
                </div>
              </div>
              <div className="text-2xl font-black tracking-tight text-brand-950 mt-2">
                {activeRun.metrics.averageGridRank != null ? activeRun.metrics.averageGridRank.toFixed(1) : "—"}
              </div>
            </div>

            <div className="rounded-2xl border bg-white p-5 shadow-xs" style={{ borderColor: "var(--border-color)" }}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-brand-600">Top 3 Dominance</span>
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Award size={16} />
                </div>
              </div>
              <div className="text-2xl font-black tracking-tight text-brand-950 mt-2">
                {Math.round(activeRun.metrics.top3DominancePercentage)}%
              </div>
            </div>

            <div className="rounded-2xl border bg-white p-5 shadow-xs" style={{ borderColor: "var(--border-color)" }}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-brand-600">Found In</span>
                <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                  <Search size={16} />
                </div>
              </div>
              <div className="text-2xl font-black tracking-tight text-brand-950 mt-2">
                {activeRun.metrics.foundCount} / {activeRun.nodes.length}
              </div>
              <p className="text-[11px] text-brand-400 mt-0.5">grid points</p>
            </div>

            <div className="rounded-2xl border bg-white p-5 shadow-xs" style={{ borderColor: "var(--border-color)" }}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-brand-600">Top 10 Points</span>
                <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                  <Store size={16} />
                </div>
              </div>
              <div className="text-2xl font-black tracking-tight text-brand-950 mt-2">
                {activeRun.metrics.top10Count}
              </div>
            </div>
          </div>

          {/* ── Grid map (from real row/col node positions) ───────────── */}
          <div className="rounded-2xl border bg-white p-5 shadow-xs space-y-4" style={{ borderColor: "var(--border-color)" }}>
            <div>
              <h2 className="text-sm font-bold text-brand-950">GeoGrid Ranking Map — &quot;{activeRun.keyword}&quot;</h2>
              <p className="text-[11px] text-brand-500">
                Each point is a real search made at that location. Source: {activeRun.source}, scanned{" "}
                {new Date(activeRun.scannedAt).toLocaleString()}.
              </p>
            </div>

            <div
              className="grid gap-2 max-w-md mx-auto"
              style={{ gridTemplateColumns: `repeat(${activeRun.gridSize}, minmax(0, 1fr))` }}
            >
              {activeRun.nodes
                .slice()
                .sort((a, b) => a.row - b.row || a.col - b.col)
                .map((node) => (
                  <div
                    key={node.id}
                    className={cn(
                      "aspect-square rounded-lg flex items-center justify-center text-xs font-black shadow-sm",
                      getNodeColor(node.rank)
                    )}
                    title={`${node.direction}, ${node.distanceKm.toFixed(1)}km — ${
                      node.businessFound ? `Rank #${node.rank}` : "Not found"
                    }`}
                  >
                    {node.businessFound ? node.rank : "—"}
                  </div>
                ))}
            </div>

            <div className="flex items-center justify-center gap-3 text-[10px] font-medium text-brand-600">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500" /> 1–3
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400" /> 4–5
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-500" /> 6–10
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-rose-500" /> 10+
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-slate-200" /> Not found
              </span>
            </div>
          </div>

          {/* ── AI Geo action plan (real, from the scan response) ──────── */}
          {activeRun.aiGeoActionPlan && (
            <div className="rounded-2xl border bg-white p-5 shadow-xs space-y-3" style={{ borderColor: "var(--border-color)" }}>
              <h3 className="text-sm font-bold text-brand-950">AI Diagnosis</h3>
              <p className="text-xs text-brand-700 leading-relaxed">{activeRun.aiGeoActionPlan.diagnosis}</p>
              {activeRun.aiGeoActionPlan.keyVulnerabilities.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-brand-900 mb-1">Key vulnerabilities</p>
                  <ul className="list-disc pl-5 space-y-1 text-xs text-brand-600">
                    {activeRun.aiGeoActionPlan.keyVulnerabilities.map((v, i) => (
                      <li key={i}>{v}</li>
                    ))}
                  </ul>
                </div>
              )}
              {activeRun.aiGeoActionPlan.actionItems.length > 0 && (
                <div className="space-y-2 pt-1">
                  {activeRun.aiGeoActionPlan.actionItems.map((item, i) => (
                    <div key={i} className="p-3 rounded-xl border border-brand-100">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={cn(
                            "text-[10px] font-bold px-1.5 py-0.2 rounded border",
                            item.impact === "HIGH"
                              ? "bg-rose-50 text-rose-700 border-rose-200"
                              : item.impact === "MEDIUM"
                              ? "bg-amber-50 text-amber-700 border-amber-200"
                              : "bg-emerald-50 text-emerald-700 border-emerald-200"
                          )}
                        >
                          {item.impact}
                        </span>
                        <p className="text-xs font-bold text-brand-950">{item.action}</p>
                      </div>
                      <p className="text-[11px] text-brand-500">{item.description}</p>
                      <p className="text-[10px] text-brand-400 mt-0.5">Target zone: {item.targetZone}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
