"use client";

import React, { useState } from "react";
import {
  MapPin,
  Search,
  Zap,
  Loader2,
  Trophy,
  Compass,
  Star,
  ExternalLink,
  ChevronRight,
  TrendingUp,
} from "lucide-react";
import { useRunGeoGridScan } from "@/hooks/use-growthx";
import type { GeoGridScanResult, GridNode, LocalSeoData } from "@/lib/api-client";
import { cn } from "@/lib/utils";

interface LocalRankingsTabProps {
  localSeo: LocalSeoData | null | undefined;
  projectId: string | null;
}

export function LocalRankingsTab({ localSeo, projectId }: LocalRankingsTabProps) {
  const [keyword, setKeyword] = useState("dentist near me");
  const [gridSize, setGridSize] = useState<3 | 5>(3);
  const [radiusKm, setRadiusKm] = useState<number>(5);
  const [scanResult, setScanResult] = useState<GeoGridScanResult | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const scanMutation = useRunGeoGridScan(projectId);

  const handleScan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyword.trim()) return;

    scanMutation.mutate(
      { keyword: keyword.trim(), businessName: localSeo?.businessName, gridSize, radiusKm },
      {
        onSuccess: (data) => {
          setScanResult(data);
          if (data.nodes && data.nodes.length > 0) {
            setSelectedNodeId(data.nodes[0].id);
          }
        },
      }
    );
  };

  const selectedNode = scanResult?.nodes.find((n) => n.id === selectedNodeId) || null;

  return (
    <div className="space-y-6">
      {/* ── Top Controls Card ───────────────────────────────────────── */}
      <div className="bg-white p-5 rounded-2xl border shadow-xs space-y-4" style={{ borderColor: "var(--border-color)" }}>
        <div>
          <h2 className="text-sm font-bold text-brand-950">Local Maps GeoGrid Rankings</h2>
          <p className="text-xs text-brand-500">
            Scan Google Maps from multiple GPS coordinates across the city to track your 3-Pack rank at street level.
          </p>
        </div>

        <form onSubmit={handleScan} className="flex flex-wrap items-end gap-3 pt-1">
          <div className="flex-1 min-w-[220px]">
            <label className="block text-xs font-semibold text-brand-700 mb-1">Target Local Keyword</label>
            <input
              type="text"
              required
              placeholder="e.g. 'dentist baner' or 'best dentist near me'"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              className="w-full h-9 px-3 text-xs rounded-lg border border-brand-200 bg-white focus:outline-none focus:ring-1 focus:ring-brand-950"
            />
          </div>

          <div className="w-32">
            <label className="block text-xs font-semibold text-brand-700 mb-1">Grid Size</label>
            <select
              value={gridSize}
              onChange={(e) => setGridSize(Number(e.target.value) as 3 | 5)}
              className="w-full h-9 px-3 text-xs rounded-lg border border-brand-200 bg-white font-medium text-brand-800 focus:outline-none"
            >
              <option value={3}>3 x 3 (9 points)</option>
              <option value={5}>5 x 5 (25 points)</option>
            </select>
          </div>

          <div className="w-32">
            <label className="block text-xs font-semibold text-brand-700 mb-1">Radius (km)</label>
            <select
              value={radiusKm}
              onChange={(e) => setRadiusKm(Number(e.target.value))}
              className="w-full h-9 px-3 text-xs rounded-lg border border-brand-200 bg-white font-medium text-brand-800 focus:outline-none"
            >
              <option value={3}>3 km</option>
              <option value={5}>5 km</option>
              <option value={10}>10 km</option>
              <option value={15}>15 km</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={scanMutation.isPending || !keyword.trim()}
            className="h-9 px-4 rounded-lg bg-brand-950 text-white text-xs font-semibold hover:opacity-90 transition flex items-center gap-1.5 disabled:opacity-50"
          >
            {scanMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <Zap size={13} />}
            <span>{scanMutation.isPending ? "Scanning GeoGrid…" : "Run GeoGrid Scan"}</span>
          </button>
        </form>
      </div>

      {/* ── GeoGrid View Area ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Visual Map Grid (7 cols) */}
        <div className="lg:col-span-7 rounded-2xl border bg-white p-5 shadow-xs flex flex-col justify-between" style={{ borderColor: "var(--border-color)" }}>
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-bold text-brand-950">
                  {scanResult ? `Grid for "${scanResult.keyword}"` : "Interactive Proximity Heatmap"}
                </h3>
                <p className="text-xs text-brand-400">Click any node to see who ranks in the 3-Pack at that spot.</p>
              </div>

              {scanResult && (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    Avg Rank: {scanResult.metrics.averageGridRank ? scanResult.metrics.averageGridRank.toFixed(1) : "—"}
                  </span>
                </div>
              )}
            </div>

            {/* Simulated interactive grid container */}
            <div className="relative rounded-xl border border-brand-200 bg-slate-50 min-h-[300px] flex items-center justify-center p-6 overflow-hidden">
              {scanResult?.nodes && scanResult.nodes.length > 0 ? (
                <div
                  className="grid gap-4"
                  style={{
                    gridTemplateColumns: `repeat(${scanResult.gridSize}, minmax(0, 1fr))`,
                  }}
                >
                  {scanResult.nodes.map((node) => {
                    const isSelected = node.id === selectedNodeId;
                    let dotColor = "bg-slate-200 text-slate-700";
                    if (node.rank != null) {
                      if (node.rank <= 3) dotColor = "bg-emerald-600 text-white";
                      else if (node.rank <= 10) dotColor = "bg-amber-400 text-amber-950";
                      else dotColor = "bg-rose-500 text-white";
                    }

                    return (
                      <button
                        key={node.id}
                        type="button"
                        onClick={() => setSelectedNodeId(node.id)}
                        className={cn(
                          "w-10 h-10 rounded-full font-mono text-xs font-bold flex items-center justify-center shadow-xs transition-all",
                          dotColor,
                          isSelected ? "ring-4 ring-brand-950 scale-110 z-10" : "hover:scale-105"
                        )}
                      >
                        {node.rank != null ? node.rank : "—"}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center text-center p-6 space-y-2">
                  <Compass size={32} className="text-brand-300" />
                  <p className="text-xs font-semibold text-brand-800">No active scan loaded</p>
                  <p className="text-[11px] text-brand-400 max-w-xs">
                    Choose a target keyword and click &quot;Run GeoGrid Scan&quot; to visualize your exact local rank distribution.
                  </p>
                </div>
              )}
            </div>

            {/* Legend */}
            <div className="mt-4 flex items-center justify-center gap-4 text-xs font-medium text-brand-600">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-emerald-600" /> 1–3 (Google 3-Pack)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-amber-400" /> 4–10 (First Page)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-rose-500" /> 11+ (Low Visibility)
              </span>
            </div>
          </div>
        </div>

        {/* Node Inspector (5 cols) */}
        <div className="lg:col-span-5 rounded-2xl border bg-white p-5 shadow-xs flex flex-col justify-between" style={{ borderColor: "var(--border-color)" }}>
          <div>
            <div className="flex items-center justify-between mb-3 border-b pb-2" style={{ borderColor: "var(--border-color)" }}>
              <h3 className="text-sm font-bold text-brand-950">Coordinate Inspector</h3>
              {selectedNode && (
                <span className="font-mono text-xs text-brand-500">
                  {selectedNode.distanceKm} km {selectedNode.direction}
                </span>
              )}
            </div>

            {selectedNode ? (
              <div className="space-y-3">
                <div className="p-3 rounded-xl bg-brand-50 border border-brand-100 flex items-center justify-between">
                  <div>
                    <p className="text-[11px] text-brand-500">Your Local Rank Here</p>
                    <p className="text-lg font-bold font-mono text-brand-950">
                      {selectedNode.rank ? `#${selectedNode.rank}` : "Not in Top 20"}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "text-xs font-bold px-2 py-0.5 rounded-full",
                      selectedNode.rank && selectedNode.rank <= 3
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : "bg-amber-50 text-amber-700 border border-amber-200"
                    )}
                  >
                    {selectedNode.rank && selectedNode.rank <= 3 ? "In 3-Pack" : "Out of Pack"}
                  </span>
                </div>

                <h4 className="text-xs font-bold uppercase tracking-wider text-brand-500 pt-1">
                  Top Ranked Businesses At This Point
                </h4>

                <div className="space-y-2">
                  {selectedNode.topCompetitors && selectedNode.topCompetitors.length > 0 ? (
                    selectedNode.topCompetitors.map((comp) => (
                      <div
                        key={comp.name}
                        className={cn(
                          "p-2.5 rounded-xl border flex items-center justify-between text-xs",
                          comp.isClient
                            ? "bg-emerald-50/70 border-emerald-300 font-bold"
                            : "bg-white border-brand-100"
                        )}
                      >
                        <div className="flex items-center gap-2 min-w-0 pr-2">
                          <span className="font-mono font-bold text-brand-950 w-5">#{comp.rank}</span>
                          <span className="truncate">{comp.name}</span>
                        </div>
                        {comp.rating && (
                          <div className="flex items-center gap-1 text-[11px] text-brand-600 shrink-0">
                            <Star size={11} className="fill-amber-500 text-amber-500" />
                            <span>{comp.rating}</span>
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-brand-400 py-3 text-center">No competitors recorded at this node.</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-xs text-brand-400">
                Run a scan and select a node on the map to inspect competitors.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
