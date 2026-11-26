"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import * as maplibregl from "maplibre-gl";
import {
  ArrowLeft,
  ArrowUpRight,
  Bot,
  Crosshair,
  Info,
  MapPin,
  Maximize2,
  Minimize2,
  Minus,
  Plus,
  Radar,
  RotateCcw,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { api } from "@/lib/api-client";
import type { GeoGridScanResult, GridNode, GscRow } from "@/lib/api-types";
import { distanceKm, loadLocalitiesGeo, type LocalityGeo } from "@/lib/geo-coordinates";
import { count, percent } from "@/lib/google-format";
import { cn } from "@/lib/utils";

export interface CityDrillTarget {
  city: string;
  country: string;
  code: string;
  flag: string;
  count: number;
  share: number;
  lat: number;
  lng: number;
  botHubReason: string | null;
}

export interface CityLandingPageSignal {
  rawPage: string;
  path: string;
  count: number;
  keyEvents: number | null;
}

interface LocalityInsight {
  locality: LocalityGeo;
  distKm: number;
  matchedQueries: GscRow[];
  clicks: number;
  impressions: number;
  matchedPages: CityLandingPageSignal[];
  pageSessions: number;
  hasSignal: boolean;
}

interface CityAreaMapProps {
  projectId: string | null | undefined;
  target: CityDrillTarget;
  allCities: CityDrillTarget[];
  queries: GscRow[];
  landingPages: CityLandingPageSignal[];
  isDark: boolean;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  onBackToGlobe: () => void;
  onSelectOtherCity: (city: CityDrillTarget) => void;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildRasterStyle(dark: boolean): maplibregl.StyleSpecification {
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
      "carto-base": {
        type: "raster",
        tiles,
        tileSize: 256,
        attribution: "© OpenStreetMap · © CARTO",
      },
    },
    layers: [
      {
        id: "carto-base-layer",
        type: "raster",
        source: "carto-base",
        minzoom: 0,
        maxzoom: 19,
      },
    ],
  };
}

export function CityAreaMap({
  projectId,
  target,
  allCities,
  queries,
  landingPages,
  isDark,
  isFullscreen,
  onToggleFullscreen,
  onBackToGlobe,
  onSelectOtherCity,
}: CityAreaMapProps) {
  const mapHostRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);

  const [localities, setLocalities] = useState<LocalityGeo[]>([]);
  const [search, setSearch] = useState("");
  const [showAreas, setShowAreas] = useState(true);
  const [showGeoGrid, setShowGeoGrid] = useState(true);
  const [selectedLocality, setSelectedLocality] = useState<LocalityInsight | null>(null);
  const [selectedGridNode, setSelectedGridNode] = useState<GridNode | null>(null);

  useEffect(() => {
    let alive = true;
    void loadLocalitiesGeo().then((list) => {
      if (alive) setLocalities(list);
    });
    return () => {
      alive = false;
    };
  }, []);

  // Load latest Local SEO Geo-Grid scan if workspace has one near this city
  const geoGridHistory = useQuery({
    queryKey: ["local-geo-grid-history", projectId],
    queryFn: () => api.getGeoGridHistory(projectId!),
    enabled: Boolean(projectId),
    staleTime: 60_000,
    retry: false,
  });

  const latestRunId = geoGridHistory.data?.[0]?.id ?? null;

  const geoGridRunQuery = useQuery<GeoGridScanResult>({
    queryKey: ["local-geo-grid-run", projectId, latestRunId],
    queryFn: () => api.getGeoGridRun(projectId!, latestRunId!),
    enabled: Boolean(projectId && latestRunId),
    staleTime: 60_000,
    retry: false,
  });

  // Only plot Geo-Grid nodes when the scan is actually near this city (<= 65 km)
  const nearbyGeoGridNodes = useMemo(() => {
    const run = geoGridRunQuery.data;
    if (!run || run.nodes.length === 0) return [];
    const centerNode = run.nodes[Math.floor(run.nodes.length / 2)] ?? run.nodes[0];
    if (distanceKm(target.lat, target.lng, centerNode.lat, centerNode.lng) > 65) return [];
    return run.nodes;
  }, [geoGridRunQuery.data, target.lat, target.lng]);

  // Nearby GA4 cities within 85 km of the selected metro
  const nearbyGa4Cities = useMemo(() => {
    return allCities
      .map((c) => ({ ...c, distKm: distanceKm(target.lat, target.lng, c.lat, c.lng) }))
      .filter((c) => c.distKm <= 85)
      .sort((a, b) => b.count - a.count);
  }, [allCities, target.lat, target.lng]);

  // Match nearby localities against real GSC queries and GA4 landing pages
  const localityInsights = useMemo<LocalityInsight[]>(() => {
    const nearby = localities
      .map((loc) => ({
        locality: loc,
        distKm: distanceKm(target.lat, target.lng, loc.lat, loc.lng),
      }))
      .filter((item) => item.distKm <= 26);

    return nearby
      .map(({ locality, distKm }) => {
        const terms = [locality.name, ...(locality.aliases ?? [])]
          .map((t) => t.trim().toLowerCase())
          .filter((t) => t.length >= 3);

        const matchTerm = (text: string) => {
          const hay = text.toLowerCase();
          return terms.some((term) => new RegExp(`\\b${escapeRegExp(term)}\\b`, "i").test(hay));
        };

        const matchedQueries = queries.filter((q) => matchTerm(q.key));
        const clicks = matchedQueries.reduce((s, q) => s + q.clicks, 0);
        const impressions = matchedQueries.reduce((s, q) => s + q.impressions, 0);

        const matchedPages = landingPages.filter((p) => matchTerm(p.path.replace(/[-_/]/g, " ")));
        const pageSessions = matchedPages.reduce((s, p) => s + p.count, 0);

        return {
          locality,
          distKm,
          matchedQueries,
          clicks,
          impressions,
          matchedPages,
          pageSessions,
          hasSignal: clicks > 0 || impressions > 0 || pageSessions > 0,
        };
      })
      .sort((a, b) => {
        if (a.hasSignal !== b.hasSignal) return a.hasSignal ? -1 : 1;
        if (b.clicks !== a.clicks) return b.clicks - a.clicks;
        if (b.pageSessions !== a.pageSessions) return b.pageSessions - a.pageSessions;
        if (b.impressions !== a.impressions) return b.impressions - a.impressions;
        return a.distKm - b.distKm;
      });
  }, [localities, target.lat, target.lng, queries, landingPages]);

  const normSearch = search.trim().toLowerCase();
  const visibleLocalities = useMemo(() => {
    if (!normSearch) return localityInsights;
    return localityInsights.filter((l) => l.locality.name.toLowerCase().includes(normSearch));
  }, [localityInsights, normSearch]);

  const activeLocalitiesCount = useMemo(
    () => localityInsights.filter((l) => l.hasSignal).length,
    [localityInsights],
  );

  // Initialize MapLibre street map
  useEffect(() => {
    const container = mapHostRef.current;
    if (!container) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const map = new maplibregl.Map({
      container,
      style: buildRasterStyle(isDark),
      center: [target.lng, target.lat],
      zoom: 9.6,
      minZoom: 4,
      maxZoom: 17,
      attributionControl: false,
    });
    mapInstanceRef.current = map;

    map.on("load", () => {
      map.flyTo({
        center: [target.lng, target.lat],
        zoom: 11.7,
        duration: reducedMotion ? 0 : 950,
        essential: true,
      });
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
      mapInstanceRef.current = null;
    };
    // Recreate cleanly when theme switches or city changes
  }, [target.lat, target.lng, isDark]);

  // Render interactive markers onto MapLibre map
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    // 1. GA4 City Markers (nearby metro nodes)
    for (const city of nearbyGa4Cities) {
      const isFocused = city.city === target.city;
      const el = document.createElement("button");
      el.type = "button";
      el.className = cn(
        "city-map-pill",
        isFocused ? "city-map-pill-primary" : city.botHubReason ? "city-map-pill-bot" : "city-map-pill-city",
      );
      el.textContent = `${city.city} · ${count(city.count)}`;
      el.title = `${city.city}: ${count(city.count)} GA4 sessions (${percent(city.share)})`;
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        if (!isFocused) {
          onSelectOtherCity(city);
        } else {
          map.flyTo({ center: [city.lng, city.lat], zoom: 12.2, duration: 600 });
        }
      });

      const marker = new maplibregl.Marker({ element: el, anchor: "center" })
        .setLngLat([city.lng, city.lat])
        .addTo(map);
      markersRef.current.push(marker);
    }

    // 2. Sub-city Localities (neighborhoods & districts near the selected metro)
    if (showAreas) {
      for (const item of localityInsights) {
        const isSelected = selectedLocality?.locality.name === item.locality.name;
        const el = document.createElement("button");
        el.type = "button";
        el.className = cn(
          "city-map-area",
          item.hasSignal ? "city-map-area-active" : "city-map-area-idle",
          isSelected ? "city-map-area-selected" : "",
        );
        const statText =
          item.clicks > 0
            ? ` · ${count(item.clicks)} clicks`
            : item.pageSessions > 0
              ? ` · ${count(item.pageSessions)} visits`
              : item.impressions > 0
                ? ` · ${count(item.impressions)} imp`
                : "";
        el.textContent = `${item.locality.name}${statText}`;
        el.addEventListener("click", (e) => {
          e.stopPropagation();
          setSelectedGridNode(null);
          setSelectedLocality(item);
          map.flyTo({ center: [item.locality.lng, item.locality.lat], zoom: 13.4, duration: 650 });
        });

        const marker = new maplibregl.Marker({ element: el, anchor: "center" })
          .setLngLat([item.locality.lng, item.locality.lat])
          .addTo(map);
        markersRef.current.push(marker);
      }
    }

    // 3. Google Maps Geo-Grid Rank Nodes (when workspace has local rank scans in this metro)
    if (showGeoGrid && nearbyGeoGridNodes.length > 0) {
      for (const node of nearbyGeoGridNodes) {
        const el = document.createElement("button");
        el.type = "button";
        const rankTone =
          node.rank == null
            ? "city-map-grid-none"
            : node.rank <= 3
              ? "city-map-grid-good"
              : node.rank <= 10
                ? "city-map-grid-warn"
                : "city-map-grid-bad";
        el.className = cn("city-map-grid-dot", rankTone);
        el.textContent = node.rank != null ? `#${node.rank}` : "—";
        el.title = `Google Maps rank at zone ${node.direction}: ${node.rank != null ? `#${node.rank}` : "Not ranked"}`;
        el.addEventListener("click", (e) => {
          e.stopPropagation();
          setSelectedLocality(null);
          setSelectedGridNode(node);
          map.flyTo({ center: [node.lng, node.lat], zoom: 13.8, duration: 600 });
        });

        const marker = new maplibregl.Marker({ element: el, anchor: "center" })
          .setLngLat([node.lng, node.lat])
          .addTo(map);
        markersRef.current.push(marker);
      }
    }
  }, [
    nearbyGa4Cities,
    localityInsights,
    showAreas,
    showGeoGrid,
    nearbyGeoGridNodes,
    selectedLocality,
    target.city,
    onSelectOtherCity,
  ]);

  const zoomMap = useCallback((delta: number) => {
    const map = mapInstanceRef.current;
    if (!map) return;
    map.easeTo({ zoom: Math.max(4, Math.min(17, map.getZoom() + delta)), duration: 280 });
  }, []);

  const resetCityCamera = useCallback(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    setSelectedLocality(null);
    setSelectedGridNode(null);
    map.flyTo({ center: [target.lng, target.lat], zoom: 11.7, duration: 600 });
  }, [target.lat, target.lng]);

  const flyToLocality = useCallback((item: LocalityInsight) => {
    setSelectedGridNode(null);
    setSelectedLocality(item);
    mapInstanceRef.current?.flyTo({
      center: [item.locality.lng, item.locality.lat],
      zoom: 13.6,
      duration: 650,
    });
  }, []);

  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* Live Interactive Street & Locality Map */}
      <div
        ref={mapHostRef}
        className="h-full w-full"
        role="region"
        aria-label={`Interactive neighborhood map of ${target.city}`}
      />

      {/* Floating Frosted-Glass HUD */}
      <div className="pointer-events-none absolute inset-0 z-20 flex flex-col justify-between p-3 sm:p-4">
        {/* TOP ROW: Back Button + City Context | Layer Toggles + Right Locality Panel */}
        <div className="flex items-start justify-between gap-3">
          {/* Top-Left Back & City Pill */}
          <div className="pointer-events-auto flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onBackToGlobe}
                className="globe-glass-pill inline-flex items-center gap-1.5 rounded-2xl px-3.5 py-2 text-xs font-bold text-brand-950 transition hover:bg-surface-1 cursor-pointer"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>3D Earth</span>
              </button>

              <div className="globe-glass-pill inline-flex items-center gap-2 rounded-2xl px-3.5 py-2 text-xs">
                <span>{target.flag}</span>
                <span className="font-bold text-brand-950">{target.city}</span>
                <span className="font-mono text-[11px] font-semibold text-brand-500">
                  {count(target.count)} GA4 visits
                </span>
                {target.botHubReason && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-warning-50 px-1.5 py-0.5 text-[9.5px] font-bold text-warning-700">
                    <Bot className="h-2.5 w-2.5" />
                    Cloud Hub
                  </span>
                )}
              </div>
            </div>

            {/* Layer Controls Pill */}
            <div className="globe-glass-pill inline-flex w-fit items-center gap-1 rounded-2xl p-1 text-[11px] font-semibold">
              <button
                type="button"
                onClick={() => setShowAreas((p) => !p)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1 transition cursor-pointer",
                  showAreas ? "bg-signal-400 text-signal-ink font-bold" : "text-brand-600 hover:text-brand-950",
                )}
              >
                <MapPin className="h-3 w-3" />
                <span>Areas ({localityInsights.length})</span>
              </button>
              {nearbyGeoGridNodes.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowGeoGrid((p) => !p)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1 transition cursor-pointer",
                    showGeoGrid ? "bg-signal-400 text-signal-ink font-bold" : "text-brand-600 hover:text-brand-950",
                  )}
                >
                  <Radar className="h-3 w-3" />
                  <span>Maps Grid ({nearbyGeoGridNodes.length})</span>
                </button>
              )}
            </div>

            {/* Selected Locality or Geo-Grid Inspector Popover Card */}
            {selectedLocality && (
              <div className="globe-glass max-w-[300px] rounded-2xl p-3.5 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-bold text-brand-950">{selectedLocality.locality.name}</p>
                    <p className="text-[10.5px] text-brand-500">
                      {selectedLocality.locality.metro} · {selectedLocality.distKm.toFixed(1)} km from center
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedLocality(null)}
                    aria-label="Close locality card"
                    className="text-brand-400 hover:text-brand-950 cursor-pointer"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="mt-2.5 grid grid-cols-3 gap-1.5 text-center">
                  <div className="rounded-xl bg-brand-100/70 p-1.5">
                    <p className="text-[9.5px] text-brand-400">Clicks</p>
                    <p className="font-mono text-xs font-bold text-brand-950">{count(selectedLocality.clicks)}</p>
                  </div>
                  <div className="rounded-xl bg-brand-100/70 p-1.5">
                    <p className="text-[9.5px] text-brand-400">Impr.</p>
                    <p className="font-mono text-xs font-bold text-brand-950">{count(selectedLocality.impressions)}</p>
                  </div>
                  <div className="rounded-xl bg-brand-100/70 p-1.5">
                    <p className="text-[9.5px] text-brand-400">Area Pages</p>
                    <p className="font-mono text-xs font-bold text-brand-950">{count(selectedLocality.pageSessions)}</p>
                  </div>
                </div>

                {selectedLocality.matchedQueries.length > 0 ? (
                  <div className="mt-2.5 space-y-1 border-t border-brand-200/60 pt-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-brand-400">
                      Matched Search Queries
                    </p>
                    {selectedLocality.matchedQueries.slice(0, 3).map((q) => (
                      <div key={q.key} className="flex items-center justify-between gap-2 text-[11px]">
                        <span className="truncate text-brand-800">{q.key}</span>
                        <span className="shrink-0 font-mono text-brand-500">
                          {count(q.clicks)}c · #{q.position.toFixed(0)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2.5 border-t border-brand-200/60 pt-2 text-[11px] text-brand-500">
                    No GSC queries or dedicated landing pages mention <strong>{selectedLocality.locality.name}</strong> yet.
                  </p>
                )}

                <Link
                  href={`/fix-engine?tab=content&query=${encodeURIComponent(selectedLocality.locality.name)}&topic=${encodeURIComponent(`${selectedLocality.locality.name} local SEO page`)}&kind=ARTICLE`}
                  className="mt-2.5 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-signal-400 px-3 py-1.5 text-[11px] font-bold text-signal-ink hover:bg-signal-500 transition shadow-xs"
                >
                  <Sparkles className="h-3 w-3" />
                  <span>Target {selectedLocality.locality.name} in Fix Engine</span>
                  <ArrowUpRight className="h-3 w-3" />
                </Link>
              </div>
            )}

            {selectedGridNode && (
              <div className="globe-glass max-w-[300px] rounded-2xl p-3.5 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="flex items-center gap-1.5 font-bold text-brand-950">
                      <Crosshair className="h-3.5 w-3.5 text-primary-600" />
                      <span>Maps Zone {selectedGridNode.direction}</span>
                    </p>
                    <p className="text-[10.5px] text-brand-500">
                      Rank: {selectedGridNode.rank != null ? `#${selectedGridNode.rank}` : "Not ranked"} · {selectedGridNode.distanceKm.toFixed(1)} km
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedGridNode(null)}
                    aria-label="Close grid node"
                    className="text-brand-400 hover:text-brand-950 cursor-pointer"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                {selectedGridNode.topCompetitors.length > 0 && (
                  <ul className="mt-2 space-y-1 border-t border-brand-200/60 pt-2 text-[11px]">
                    {selectedGridNode.topCompetitors.slice(0, 4).map((c) => (
                      <li key={`${c.rank}-${c.name}`} className="flex items-center justify-between gap-2">
                        <span className={cn("truncate", c.isClient ? "font-bold text-primary-700" : "text-brand-800")}>
                          #{c.rank} {c.name}
                        </span>
                        <span className="shrink-0 font-mono text-[10px] text-brand-500">
                          {c.rating ? `${c.rating.toFixed(1)}★` : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          {/* Top-Right Floating Area Breakdown Card */}
          <div className="pointer-events-auto flex flex-col items-end gap-2 lg:w-[292px] xl:w-[310px]">
            <div className="flex items-center gap-1.5">
              <div className="globe-glass-pill inline-flex items-center gap-0.5 rounded-2xl p-1">
                <button
                  type="button"
                  onClick={() => zoomMap(1.2)}
                  aria-label="Zoom in street map"
                  className="flex h-7 w-7 items-center justify-center rounded-xl text-brand-600 hover:bg-brand-100/70 hover:text-brand-950 cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => zoomMap(-1.2)}
                  aria-label="Zoom out street map"
                  className="flex h-7 w-7 items-center justify-center rounded-xl text-brand-600 hover:bg-brand-100/70 hover:text-brand-950 cursor-pointer"
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={resetCityCamera}
                  aria-label="Re-center on city"
                  className="flex h-7 w-7 items-center justify-center rounded-xl text-brand-600 hover:bg-brand-100/70 hover:text-brand-950 cursor-pointer"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
              </div>
              <button
                type="button"
                onClick={onToggleFullscreen}
                aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen area map"}
                className="globe-glass-pill flex h-9 w-9 items-center justify-center rounded-2xl text-brand-700 hover:text-brand-950 cursor-pointer"
              >
                {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
              </button>
            </div>

            <div className="globe-glass globe-hud-side w-full flex-col rounded-2xl p-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-brand-950">Areas in {target.city}</span>
                <span className="font-mono text-[10.5px] text-brand-500">
                  {activeLocalitiesCount > 0 ? `${activeLocalitiesCount} active` : `${localityInsights.length} mapped`}
                </span>
              </div>

              <div className="relative mt-2">
                <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3 w-3 -translate-y-1/2 text-brand-400" />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Find neighborhood or area…"
                  aria-label="Filter areas in city"
                  className="w-full rounded-xl border border-brand-200/70 bg-surface-1/85 py-1.5 pr-6 pl-7 text-[11px] text-brand-950 placeholder:text-brand-400 focus:border-primary-500 focus:outline-none"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    aria-label="Clear area search"
                    className="absolute top-1/2 right-2 -translate-y-1/2 text-brand-400 hover:text-brand-950 cursor-pointer"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>

              <div
                className={cn(
                  "mt-2 divide-y divide-brand-200/50 overflow-y-auto pr-0.5",
                  isFullscreen ? "max-h-[420px]" : "max-h-[250px]",
                )}
              >
                {visibleLocalities.length > 0 ? (
                  visibleLocalities.map((item) => {
                    const active = selectedLocality?.locality.name === item.locality.name;
                    return (
                      <button
                        key={`${item.locality.metro}-${item.locality.name}`}
                        type="button"
                        onClick={() => flyToLocality(item)}
                        className={cn(
                          "flex w-full items-center justify-between gap-2 rounded-xl px-2 py-2 text-left text-xs transition cursor-pointer",
                          active ? "bg-brand-100/80" : "hover:bg-brand-100/50",
                        )}
                      >
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-brand-950">{item.locality.name}</p>
                          <p className="text-[10px] text-brand-400">
                            {item.locality.metro} · {item.distKm.toFixed(1)} km
                          </p>
                        </div>
                        <div className="shrink-0 text-right font-mono text-[10.5px]">
                          {item.hasSignal ? (
                            <span className="rounded-full bg-success-50 px-2 py-0.5 font-bold text-success-700">
                              {item.clicks > 0
                                ? `${count(item.clicks)} clicks`
                                : item.pageSessions > 0
                                  ? `${count(item.pageSessions)} visits`
                                  : `${count(item.impressions)} imp`}
                            </span>
                          ) : (
                            <span className="text-brand-400">0 local signal</span>
                          )}
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <div className="py-6 text-center text-[11px] text-brand-500">
                    {normSearch
                      ? `No mapped areas match "${search}".`
                      : `Explore real streets & neighborhoods of ${target.city} directly on the map.`}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* BOTTOM ROW: Honest GA4 City-Level Data Disclosure Pill */}
        <div className="flex items-end justify-between gap-3">
          <div className="globe-glass-pill pointer-events-auto flex max-w-xl items-center gap-2 rounded-2xl px-3 py-1.5 text-[10.5px] text-brand-600">
            <Info className="h-3.5 w-3.5 shrink-0 text-primary-600" />
            <span>
              GA4 reports IP visits at city level (<strong className="text-brand-950">{target.city}: {count(target.count)}</strong>). Area badges combine real GSC locality queries, area landing pages &amp; Maps Geo-Grid scans.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
