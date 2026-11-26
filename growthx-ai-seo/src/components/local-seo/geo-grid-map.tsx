"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import {
  ArrowUpRight,
  Crosshair,
  Maximize2,
  Minimize2,
  Minus,
  Plus,
  RotateCcw,
  Star,
  X,
} from "lucide-react";
import type { GeoGridScanResult, GridNode } from "@/lib/api-types";
import { cn } from "@/lib/utils";

interface GeoGridMapProps {
  run: GeoGridScanResult | null;
  businessName: string;
  centerLat: number | null;
  centerLng: number | null;
  selectedNode: GridNode | null;
  onSelectNode?: (node: GridNode | null) => void;
  mode?: "full" | "compact";
  onOpenFullMap?: () => void;
}

function buildStreetStyle(dark: boolean): maplibregl.StyleSpecification {
  const tiles = dark
    ? [
        "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
        "https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
        "https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
      ]
    : [
        "https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png",
        "https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png",
        "https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png",
      ];

  return {
    version: 8,
    sources: {
      "carto-local": {
        type: "raster",
        tiles,
        tileSize: 256,
        attribution: "© OpenStreetMap · © CARTO",
      },
    },
    layers: [
      {
        id: "carto-local-layer",
        type: "raster",
        source: "carto-local",
        minzoom: 0,
        maxzoom: 19,
      },
    ],
  };
}

function detectDarkTheme(): boolean {
  if (typeof document === "undefined") return false;
  return Boolean(
    document.documentElement.classList.contains("dark") ||
      document.querySelector(".dash-dark"),
  );
}

function rankToneClass(rank: number | null): string {
  if (rank == null) return "city-map-grid-none";
  if (rank <= 3) return "city-map-grid-good";
  if (rank <= 10) return "city-map-grid-warn";
  return "city-map-grid-bad";
}

function directionLabel(code: string): string {
  const map: Record<string, string> = {
    C: "Center",
    CENTER: "Center",
    N: "North",
    S: "South",
    E: "East",
    W: "West",
    NE: "North-East",
    NW: "North-West",
    SE: "South-East",
    SW: "South-West",
  };
  return map[code.toUpperCase()] ?? code;
}

export function GeoGridMap({
  run,
  businessName,
  centerLat,
  centerLng,
  selectedNode,
  onSelectNode,
  mode = "full",
  onOpenFullMap,
}: GeoGridMapProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);

  const [isDark, setIsDark] = useState<boolean>(() => detectDarkTheme());
  const [isFullscreen, setIsFullscreen] = useState(false);

  const isCompact = mode === "compact";

  // Keep map style synced with app light/dark theme
  useEffect(() => {
    const sync = () => setIsDark(detectDarkTheme());
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    const shell = document.querySelector(".dash-dark, .dash-light");
    if (shell) {
      observer.observe(shell, { attributes: true, attributeFilter: ["class"] });
    }
    return () => observer.disconnect();
  }, []);

  // Escape exits fullscreen map
  useEffect(() => {
    if (!isFullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsFullscreen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isFullscreen]);

  const resolvedCenter = useMemo<{ lat: number; lng: number } | null>(() => {
    if (run?.centerCoordinates) return run.centerCoordinates;
    if (run && run.nodes.length > 0) {
      const mid = run.nodes[Math.floor(run.nodes.length / 2)] ?? run.nodes[0];
      return { lat: mid.lat, lng: mid.lng };
    }
    if (centerLat != null && centerLng != null) {
      return { lat: centerLat, lng: centerLng };
    }
    return null;
  }, [run, centerLat, centerLng]);

  const fitMapToNodes = useCallback(
    (map: maplibregl.Map, animate: boolean) => {
      const reducedMotion =
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const duration = !animate || reducedMotion ? 0 : 650;

      if (run && run.nodes.length > 1) {
        const bounds = new maplibregl.LngLatBounds();
        for (const node of run.nodes) {
          bounds.extend([node.lng, node.lat]);
        }
        map.fitBounds(bounds, {
          padding: isCompact
            ? { top: 44, bottom: 44, left: 36, right: 36 }
            : { top: 86, bottom: 72, left: 60, right: 60 },
          maxZoom: 14.5,
          duration,
        });
      } else if (resolvedCenter) {
        map.flyTo({
          center: [resolvedCenter.lng, resolvedCenter.lat],
          zoom: isCompact ? 12.6 : 13.4,
          duration,
          essential: true,
        });
      }
    },
    [run, resolvedCenter, isCompact],
  );

  // Initialize MapLibre instance
  useEffect(() => {
    const container = hostRef.current;
    if (!container || !resolvedCenter) return;

    const map = new maplibregl.Map({
      container,
      style: buildStreetStyle(isDark),
      center: [resolvedCenter.lng, resolvedCenter.lat],
      zoom: isCompact ? 12.2 : 12.6,
      minZoom: 4,
      maxZoom: 17,
      interactive: !isCompact,
      attributionControl: false,
    });
    mapRef.current = map;

    map.on("load", () => {
      fitMapToNodes(map, !isCompact);
    });

    const resizeObserver = new ResizeObserver(() => {
      map.resize();
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, [resolvedCenter, isDark, isCompact, fitMapToNodes]);

  // Refit whenever the active scan run changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (map.loaded()) {
      fitMapToNodes(map, !isCompact);
    }
  }, [run?.runId, fitMapToNodes, isCompact]);

  // Render markers (business center + Geo-Grid rank pins)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !resolvedCenter) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    // 1. Geo-Grid rank pins
    if (run && run.nodes.length > 0) {
      for (const node of run.nodes) {
        const isSelected = !isCompact && selectedNode?.id === node.id;
        const el = document.createElement("button");
        el.type = "button";
        el.className = cn(
          "local-rank-pin",
          isCompact ? "local-rank-pin-compact" : "",
          rankToneClass(node.rank),
          isSelected ? "local-rank-pin-selected" : "",
        );
        el.textContent = node.rank != null ? `#${node.rank}` : "—";
        el.title = `${directionLabel(node.direction)} (${node.distanceKm.toFixed(1)} km): ${
          node.rank != null ? `Rank #${node.rank}` : "Not in top results"
        }`;
        if (!isCompact && onSelectNode) {
          el.addEventListener("click", (e) => {
            e.stopPropagation();
            onSelectNode(node);
            map.easeTo({
              center: [node.lng, node.lat],
              zoom: Math.max(map.getZoom(), 13.2),
              duration: 450,
            });
          });
        }

        const marker = new maplibregl.Marker({ element: el, anchor: "center" })
          .setLngLat([node.lng, node.lat])
          .addTo(map);
        markersRef.current.push(marker);
      }
    } else {
      // 2. When no scan exists yet, show clean business location pin on the street map
      const pin = document.createElement("div");
      pin.className = "local-biz-pin";
      pin.textContent = businessName || "Your Business";
      const marker = new maplibregl.Marker({ element: pin, anchor: "center" })
        .setLngLat([resolvedCenter.lng, resolvedCenter.lat])
        .addTo(map);
      markersRef.current.push(marker);
    }
  }, [run, resolvedCenter, selectedNode, isCompact, onSelectNode, businessName]);

  const zoomBy = useCallback((delta: number) => {
    const map = mapRef.current;
    if (!map) return;
    map.easeTo({
      zoom: Math.max(4, Math.min(17, map.getZoom() + delta)),
      duration: 260,
    });
  }, []);

  const resetView = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    fitMapToNodes(map, true);
  }, [fitMapToNodes]);

  if (!resolvedCenter) {
    return (
      <div className="flex h-[240px] flex-col items-center justify-center rounded-2xl border border-dashed border-brand-200 bg-surface-1 px-6 text-center">
        <Crosshair className="h-5 w-5 text-brand-400" />
        <p className="mt-2 text-xs font-semibold text-brand-900">No map location yet</p>
        <p className="mt-0.5 max-w-xs text-[11.5px] text-brand-500">
          Connect your Google Maps listing to plot your business and nearby rankings on a live street map.
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative overflow-hidden border border-brand-200 bg-surface-1",
        isFullscreen
          ? "fixed inset-0 z-[100] h-dvh w-screen rounded-none"
          : isCompact
            ? "h-[270px] rounded-2xl"
            : "h-[440px] sm:h-[500px] lg:h-[540px] rounded-2xl",
      )}
    >
      {/* Live Interactive Street Map */}
      <div
        ref={hostRef}
        className="h-full w-full"
        role="region"
        aria-label={
          run
            ? `Neighborhood Google Maps ranking map for ${run.keyword}`
            : `Street map centered on ${businessName || "your business"}`
        }
      />

      {/* COMPACT PREVIEW HUD (for Overview tab) */}
      {isCompact ? (
        <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="globe-glass-pill inline-flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-[11px]">
              {run ? (
                <>
                  <span className="h-2 w-2 rounded-full bg-success-500" />
                  <span className="font-semibold text-brand-950 truncate max-w-[150px]">
                    &ldquo;{run.keyword}&rdquo;
                  </span>
                  <span className="font-mono text-brand-600 tabular-nums">
                    Top 3: {Math.round(run.metrics.top3DominancePercentage)}%
                  </span>
                </>
              ) : (
                <>
                  <span className="h-2 w-2 rounded-full bg-primary-600" />
                  <span className="font-semibold text-brand-950">Your Map Pin</span>
                </>
              )}
            </div>
          </div>

          {onOpenFullMap && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={onOpenFullMap}
                className="pointer-events-auto inline-flex items-center gap-1.5 rounded-xl bg-brand-950 px-3 py-1.5 text-[11.5px] font-semibold text-brand-50 shadow-sm transition hover:bg-brand-800 cursor-pointer"
              >
                <span>{run ? "Open Rank Map" : "Scan Nearby Ranks"}</span>
                <ArrowUpRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      ) : (
        /* FULL INTERACTIVE MAP HUD */
        <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between p-3 sm:p-4">
          {/* Top Row: Summary & Legend | Zoom & Fullscreen */}
          <div className="flex items-start justify-between gap-3">
            <div className="pointer-events-auto flex flex-col gap-2">
              {run ? (
                <div className="globe-glass-pill inline-flex flex-wrap items-center gap-2.5 rounded-2xl px-3.5 py-2 text-xs">
                  <span className="font-bold text-brand-950">&ldquo;{run.keyword}&rdquo;</span>
                  <span className="text-brand-300">·</span>
                  <span className="font-mono font-semibold text-success-700 tabular-nums">
                    {Math.round(run.metrics.top3DominancePercentage)}% in Top 3
                  </span>
                  <span className="text-brand-300">·</span>
                  <span className="font-mono text-brand-600 tabular-nums">
                    Avg {run.metrics.averageGridRank != null ? `#${run.metrics.averageGridRank.toFixed(1)}` : "—"}
                  </span>
                </div>
              ) : (
                <div className="globe-glass-pill inline-flex items-center gap-2 rounded-2xl px-3.5 py-2 text-xs">
                  <span className="h-2 w-2 rounded-full bg-primary-600" />
                  <span className="font-semibold text-brand-950">
                    Enter a search term above and click <strong>Scan Rank Map</strong>
                  </span>
                </div>
              )}

              {run && (
                <div className="globe-glass-pill inline-flex w-fit flex-wrap items-center gap-2.5 rounded-xl px-2.5 py-1 text-[10.5px] font-medium text-brand-700">
                  <span className="inline-flex items-center gap-1">
                    <span className="h-2.5 w-2.5 rounded-full bg-success-500" /> #1–3 Top
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="h-2.5 w-2.5 rounded-full bg-warning-500" /> #4–10 Close
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="h-2.5 w-2.5 rounded-full bg-error-500" /> #11+ Low
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="h-2.5 w-2.5 rounded-full bg-brand-400" /> Missing
                  </span>
                </div>
              )}
            </div>

            <div className="pointer-events-auto flex items-center gap-1.5">
              <div className="globe-glass-pill inline-flex items-center gap-0.5 rounded-2xl p-1">
                <button
                  type="button"
                  onClick={() => zoomBy(1.1)}
                  aria-label="Zoom in map"
                  className="flex h-7 w-7 items-center justify-center rounded-xl text-brand-600 hover:bg-brand-100/70 hover:text-brand-950 cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => zoomBy(-1.1)}
                  aria-label="Zoom out map"
                  className="flex h-7 w-7 items-center justify-center rounded-xl text-brand-600 hover:bg-brand-100/70 hover:text-brand-950 cursor-pointer"
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={resetView}
                  aria-label="Fit all pins"
                  className="flex h-7 w-7 items-center justify-center rounded-xl text-brand-600 hover:bg-brand-100/70 hover:text-brand-950 cursor-pointer"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
              </div>
              <button
                type="button"
                onClick={() => setIsFullscreen((prev) => !prev)}
                aria-label={isFullscreen ? "Exit fullscreen" : "Expand map fullscreen"}
                className="globe-glass-pill flex h-9 w-9 items-center justify-center rounded-2xl text-brand-700 hover:text-brand-950 cursor-pointer"
              >
                {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>

          {/* Bottom Row: Selected Corner Inspector Popover */}
          <div className="flex items-end justify-between gap-3">
            {selectedNode ? (
              <div className="globe-glass pointer-events-auto w-full max-w-[330px] rounded-2xl p-3.5 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-bold text-brand-950">
                      {directionLabel(selectedNode.direction)} · {selectedNode.distanceKm.toFixed(1)} km away
                    </p>
                    <p className="mt-0.5 text-[11px] text-brand-500">
                      {selectedNode.rank != null
                        ? `You rank #${selectedNode.rank} for searchers here`
                        : "You don’t appear in top results here yet"}
                    </p>
                  </div>
                  {onSelectNode && (
                    <button
                      type="button"
                      onClick={() => onSelectNode(null)}
                      aria-label="Close location details"
                      className="text-brand-400 hover:text-brand-950 cursor-pointer"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {selectedNode.topCompetitors.length > 0 && (
                  <ul className="mt-2.5 space-y-1.5 border-t border-brand-200/60 pt-2.5 text-[11.5px]">
                    {selectedNode.topCompetitors.slice(0, 5).map((comp) => (
                      <li
                        key={`${comp.rank}-${comp.name}`}
                        className="flex items-center justify-between gap-2"
                      >
                        <span
                          className={cn(
                            "truncate",
                            comp.isClient ? "font-bold text-success-700" : "text-brand-800",
                          )}
                        >
                          <span className="mr-1.5 font-mono text-[10.5px] text-brand-400">
                            #{comp.rank}
                          </span>
                          {comp.name}
                          {comp.isClient ? " (You)" : ""}
                        </span>
                        <span className="inline-flex shrink-0 items-center gap-1 font-mono text-[10.5px] text-brand-500 tabular-nums">
                          {comp.rating != null && (
                            <span className="inline-flex items-center gap-0.5">
                              <Star className="h-2.5 w-2.5 text-warning-500" />
                              {comp.rating.toFixed(1)}
                            </span>
                          )}
                          {comp.reviewsCount != null && <span>({comp.reviewsCount})</span>}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : run ? (
              <div className="globe-glass-pill pointer-events-auto rounded-xl px-3 py-1.5 text-[11px] text-brand-600">
                Click any rank pin on the map to see who ranks #1–#5 there.
              </div>
            ) : (
              <span />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
