"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  Building2,
  Download,
  FileText,
  Globe,
  Layers,
  Map as MapIcon,
  MapPin,
  Maximize2,
  Minimize2,
  Minus,
  Pause,
  Play,
  Plus,
  Radio,
  RotateCcw,
  Share2,
  X,
} from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import { api } from "@/lib/api-client";
import { resolveCountryGeo } from "@/lib/geo-coordinates";
import { count, percent, shortDay } from "@/lib/google-format";
import { cn } from "@/lib/utils";
import type { GlobeFlowArc, GlobePin } from "./earth-globe-canvas";
import { WorldMap2D } from "./world-map-2d";

const EarthGlobeCanvas = dynamic(
  () => import("./earth-globe-canvas").then((mod) => mod.EarthGlobeCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center">
        <div className="globe-glass-pill flex items-center gap-2 rounded-full px-4 py-2 text-xs font-medium text-brand-600">
          <Globe className="h-3.5 w-3.5 text-primary-600" />
          <span>Loading 3D Earth…</span>
        </div>
      </div>
    ),
  },
);

export interface TrafficCountryRow {
  country: string;
  code: string;
  flag: string;
  count: number;
  share: number;
  lat: number | null;
  lng: number | null;
}

export interface TrafficCityRow {
  city: string;
  country: string;
  code: string;
  flag: string;
  count: number;
  share: number;
  lat: number | null;
  lng: number | null;
  exactCity: boolean;
}

export interface TrafficChannelRow {
  name: string;
  share: number;
  count: number;
  organic: boolean;
}

export interface DailyTrafficPoint {
  date: string;
  visitors: number | null;
  searchClicks: number | null;
}

interface GlobalTrafficGlobeProps {
  projectId: string | null | undefined;
  periodDays: number;
  visitorsCount: number | null;
  sessionsCount: number | null;
  searchClicks: number | null;
  clicksChangePct: number | null;
  dailyChartData: DailyTrafficPoint[];
  channels: TrafficChannelRow[];
  countries: TrafficCountryRow[];
  cities: TrafficCityRow[];
  onOpenReport: () => void;
}

type GlobeViewMode = "globe" | "map" | "flows";
type RightPanelTab = "countries" | "cities" | "live";

function buildCsvAndDownload(
  countries: TrafficCountryRow[],
  cities: TrafficCityRow[],
  periodDays: number,
) {
  const escape = (val: string | number) => `"${String(val).replace(/"/g, '""')}"`;
  const lines: string[] = [
    ["Type", "Name", "Country", "Visitors", "Share %"].map(escape).join(","),
    ...countries.map((c) =>
      ["Country", c.country, c.code, c.count, (c.share * 100).toFixed(2)].map(escape).join(","),
    ),
    ...cities.map((c) =>
      ["City", c.city, c.country, c.count, (c.share * 100).toFixed(2)].map(escape).join(","),
    ),
  ];

  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `global-traffic-map-${periodDays}d.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export function GlobalTrafficGlobe({
  projectId,
  periodDays,
  visitorsCount,
  sessionsCount,
  searchClicks,
  clicksChangePct,
  dailyChartData,
  channels,
  countries,
  cities,
  onOpenReport,
}: GlobalTrafficGlobeProps) {
  const { isDark } = useTheme();
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [viewMode, setViewMode] = useState<GlobeViewMode>("globe");
  const [rightTab, setRightTab] = useState<RightPanelTab>("countries");
  const [pinLayer, setPinLayer] = useState<"countries" | "cities">("countries");
  const [selectedCountryCode, setSelectedCountryCode] = useState<string | null>(null);
  const [selectedPinId, setSelectedPinId] = useState<string | null>(null);
  const [hoveredPinId, setHoveredPinId] = useState<string | null>(null);
  const [autoRotate, setAutoRotate] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });
  const [showAllRows, setShowAllRows] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [focusTarget, setFocusTarget] = useState<{ lat: number; lng: number; nonce: number } | null>(null);
  const [zoomSignal, setZoomSignal] = useState<{ delta?: number; reset?: boolean; nonce: number } | null>(null);
  const [hoveredBarIdx, setHoveredBarIdx] = useState<number | null>(null);

  // Share React Query cache with RealtimeActivity card (zero extra fetch)
  const realtimeQuery = useQuery({
    queryKey: ["ga4-realtime", projectId],
    queryFn: () => api.ga4Realtime(projectId!),
    enabled: Boolean(projectId),
    staleTime: 30_000,
    retry: false,
    refetchInterval: (q) => (q.state.data?.state === "READY" ? 5 * 60_000 : false),
    refetchIntervalInBackground: false,
  });

  const realtimeData = !realtimeQuery.isError && realtimeQuery.data?.state === "READY"
    ? realtimeQuery.data.data
    : null;

  // Map realtime users per country code
  const realtimeByCountryCode = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of realtimeData?.countries ?? []) {
      const geo = resolveCountryGeo(row.country);
      const key = geo?.code ?? row.country.trim().toUpperCase();
      map.set(key, (map.get(key) ?? 0) + row.activeUsers);
    }
    return map;
  }, [realtimeData]);

  // ESC closes overlay fullscreen cleanly
  useEffect(() => {
    if (!isFullscreen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsFullscreen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isFullscreen]);

  // Derive default focus target from top mapped country until user explicitly flies somewhere
  const defaultFocusTarget = useMemo(() => {
    const topMapped = countries.find((c) => c.lat !== null && c.lng !== null);
    if (!topMapped || topMapped.lat === null || topMapped.lng === null) return null;
    return { lat: topMapped.lat, lng: topMapped.lng, nonce: 0 };
  }, [countries]);

  const activeFocusTarget = focusTarget ?? defaultFocusTarget;

  const flyTo = useCallback((lat: number, lng: number) => {
    setFocusTarget((prev) => ({ lat, lng, nonce: (prev?.nonce ?? 0) + 1 }));
  }, []);

  const bumpZoom = useCallback((delta: number) => {
    setZoomSignal((prev) => ({ delta, nonce: (prev?.nonce ?? 0) + 1 }));
  }, []);

  // Build pins for 3D Earth & 2D Map
  const countryPins = useMemo<GlobePin[]>(() => {
    return countries
      .filter((c) => c.lat !== null && c.lng !== null)
      .map((c) => ({
        id: `country:${c.code}`,
        label: c.country,
        flag: c.flag,
        code: c.code,
        lat: c.lat!,
        lng: c.lng!,
        visitors: c.count,
        share: c.share,
        liveUsers: realtimeByCountryCode.get(c.code) ?? 0,
      }));
  }, [countries, realtimeByCountryCode]);

  const cityPins = useMemo<GlobePin[]>(() => {
    return cities
      .filter((c) => c.lat !== null && c.lng !== null)
      .filter((c) => !selectedCountryCode || c.code === selectedCountryCode)
      .map((c, idx) => ({
        id: `city:${c.code}:${c.city}:${idx}`,
        label: c.city,
        sublabel: c.country,
        flag: c.flag,
        code: c.code,
        lat: c.lat!,
        lng: c.lng!,
        visitors: c.count,
        share: c.share,
        liveUsers: 0,
      }));
  }, [cities, selectedCountryCode]);

  const visiblePins = useMemo(() => {
    if (pinLayer === "cities" && cityPins.length > 0) return cityPins;
    if (selectedCountryCode) {
      const filtered = countryPins.filter((p) => p.code === selectedCountryCode);
      if (filtered.length > 0) return filtered;
    }
    return countryPins;
  }, [pinLayer, cityPins, countryPins, selectedCountryCode]);

  // Build 3D curved flow arcs linking secondary traffic regions into top hub
  const flowArcs = useMemo<GlobeFlowArc[]>(() => {
    const sourcePins = visiblePins.length >= 2 ? visiblePins : countryPins;
    if (sourcePins.length < 2) return [];
    const hub = sourcePins[0];
    return sourcePins.slice(1, 10).map((pin) => ({
      id: `arc:${pin.id}->${hub.id}`,
      fromLat: pin.lat,
      fromLng: pin.lng,
      toLat: hub.lat,
      toLng: hub.lng,
      weight: Math.max(0.2, Math.min(1, pin.share * 2.4)),
    }));
  }, [visiblePins, countryPins]);

  const activeCountryCodes = useMemo(
    () => new Set(countries.map((c) => c.code).filter(Boolean)),
    [countries],
  );

  // Filtered country pills & spotlight city cards
  const filterCountries = useMemo(
    () => countries.filter((c) => c.lat !== null && c.lng !== null).slice(0, 5),
    [countries],
  );

  const spotlightCities = useMemo(() => {
    const base = selectedCountryCode
      ? cities.filter((c) => c.code === selectedCountryCode)
      : cities;
    return (base.length > 0 ? base : cities).slice(0, 3);
  }, [cities, selectedCountryCode]);

  // Daily bar histogram data (last up to 30 days)
  const histogramBars = useMemo(() => {
    const slice = dailyChartData.slice(-30);
    const values = slice.map((d) => d.visitors ?? d.searchClicks ?? 0);
    const maxVal = Math.max(...values, 1);
    return slice.map((d, i) => ({
      date: d.date,
      label: shortDay(d.date),
      value: values[i],
      ratio: values[i] / maxVal,
    }));
  }, [dailyChartData]);

  // Sparkline polyline points for Card 2
  const sparkline = useMemo(() => {
    const slice = dailyChartData.slice(-28);
    if (slice.length < 2) return null;
    const vals = slice.map((d) => d.searchClicks ?? d.visitors ?? 0);
    const maxV = Math.max(...vals, 1);
    const minV = Math.min(...vals, 0);
    const span = Math.max(maxV - minV, 1);
    const w = 220;
    const h = 42;
    const pts = vals.map((v, idx) => {
      const x = (idx / (vals.length - 1)) * w;
      const y = h - 4 - ((v - minV) / span) * (h - 10);
      return { x, y, val: v, date: slice[idx].date };
    });
    const lineD = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
    const areaD = `${lineD} L${w} ${h} L0 ${h} Z`;
    const midPt = pts[Math.floor(pts.length / 2)];
    return { lineD, areaD, midPt, w, h };
  }, [dailyChartData]);

  // 4-segment breakdown bar for Card 3 (Channel mix or Country mix fallback)
  const segmentedMix = useMemo(() => {
    if (channels.length > 0) {
      return {
        title: "Channel Mix",
        items: channels.slice(0, 4).map((ch) => ({
          label: ch.name.replace("Organic ", "Org. "),
          share: ch.share,
        })),
      };
    }
    return {
      title: "Market Share",
      items: countries.slice(0, 4).map((c) => ({
        label: c.code || c.country.slice(0, 8),
        share: c.share,
      })),
    };
  }, [channels, countries]);

  // Total visitors display for Hero Card 1
  const geoTotalVisitors = useMemo(
    () => countries.reduce((sum, c) => sum + c.count, 0),
    [countries],
  );
  const heroMetricValue = visitorsCount ?? (geoTotalVisitors > 0 ? geoTotalVisitors : searchClicks);
  const heroMetricLabel = visitorsCount !== null
    ? "Global Visitors"
    : geoTotalVisitors > 0
      ? "Geo Visitors"
      : "Search Clicks";

  const handleSelectPin = useCallback(
    (pin: GlobePin) => {
      setSelectedPinId(pin.id);
      flyTo(pin.lat, pin.lng);
    },
    [flyTo],
  );

  const handleCountryChipClick = useCallback(
    (code: string | null) => {
      setSelectedCountryCode(code);
      if (!code) {
        setSelectedPinId(null);
        const top = countries.find((c) => c.lat !== null && c.lng !== null);
        if (top && top.lat !== null && top.lng !== null) flyTo(top.lat, top.lng);
        return;
      }
      const match = countries.find((c) => c.code === code);
      if (match && match.lat !== null && match.lng !== null) {
        setSelectedPinId(`country:${match.code}`);
        flyTo(match.lat, match.lng);
      }
    },
    [countries, flyTo],
  );

  const handleResetGlobe = useCallback(() => {
    setSelectedCountryCode(null);
    setSelectedPinId(null);
    const top = countries.find((c) => c.lat !== null && c.lng !== null);
    if (top && top.lat !== null && top.lng !== null) {
      flyTo(top.lat, top.lng);
    } else {
      flyTo(26, 18);
    }
    setZoomSignal((prev) => ({ reset: true, nonce: (prev?.nonce ?? 0) + 1 }));
  }, [countries, flyTo]);

  const displayedCountries = showAllRows ? countries : countries.slice(0, 7);
  const displayedCities = useMemo(() => {
    const base = selectedCountryCode ? cities.filter((c) => c.code === selectedCountryCode) : cities;
    return showAllRows ? base : base.slice(0, 7);
  }, [cities, selectedCountryCode, showAllRows]);

  const realtimeRows = useMemo(() => {
    return (realtimeData?.countries ?? []).map((row) => {
      const geo = resolveCountryGeo(row.country);
      return {
        country: geo?.name ?? row.country,
        code: geo?.code ?? row.country.slice(0, 2).toUpperCase(),
        flag: geo?.flag ?? "🌐",
        activeUsers: row.activeUsers,
        lat: geo?.lat ?? null,
        lng: geo?.lng ?? null,
      };
    });
  }, [realtimeData]);

  const dateRangePill = useMemo(() => {
    if (dailyChartData.length >= 2) {
      return `${shortDay(dailyChartData[0].date)} – ${shortDay(dailyChartData[dailyChartData.length - 1].date)}`;
    }
    return `Last ${periodDays} days`;
  }, [dailyChartData, periodDays]);

  return (
    <section
      ref={containerRef}
      aria-label="Global geography and interactive visitor globe"
      className={cn(
        "globe-stage relative overflow-hidden border transition-all duration-300",
        isFullscreen
          ? "fixed inset-0 z-50 h-screen w-screen rounded-none border-0"
          : "rounded-3xl shadow-card",
      )}
    >
      {/* ── MAIN INTERACTIVE CANVAS STAGE (3D EARTH / 2D MAP / 3D FLOWS) ── */}
      <div
        className={cn(
          "relative w-full",
          isFullscreen ? "h-full" : "h-[460px] sm:h-[520px] lg:h-[690px]",
        )}
      >
        {viewMode === "map" ? (
          <WorldMap2D
            pins={visiblePins}
            activeCountryCodes={activeCountryCodes}
            selectedPinId={selectedPinId}
            hoveredPinId={hoveredPinId}
            onSelectPin={handleSelectPin}
            onHoverPin={setHoveredPinId}
          />
        ) : (
          <EarthGlobeCanvas
            pins={visiblePins}
            arcs={flowArcs}
            showFlows={viewMode === "flows"}
            isDark={isDark}
            autoRotate={autoRotate}
            selectedPinId={selectedPinId}
            hoveredPinId={hoveredPinId}
            focusTarget={activeFocusTarget}
            zoomSignal={zoomSignal}
            onSelectPin={handleSelectPin}
            onHoverPin={setHoveredPinId}
          />
        )}

        {/* ── DESKTOP OVERLAY HUD (POINTER-EVENTS-NONE WRAPPER SO EARTH REMAINS DRAGGABLE) ── */}
        <div className="pointer-events-none absolute inset-0 z-20 flex flex-col justify-between p-3.5 sm:p-5">
          {/* TOP ROW: LEFT STACK + RIGHT STACK */}
          <div className="flex items-start justify-between gap-4">
            {/* LEFT FLOATING STACK */}
            <div className="pointer-events-auto flex w-auto flex-col gap-3 lg:w-[274px] xl:w-[292px]">
              {/* Top-left floating icon toolbar pill */}
              <div
                role="toolbar"
                aria-label="Globe controls"
                className="globe-glass-pill inline-flex w-fit items-center gap-1 rounded-2xl p-1.5"
              >
                <button
                  type="button"
                  onClick={() => setPinLayer("countries")}
                  title="Show country pins"
                  aria-label="Show country pins"
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-xl transition cursor-pointer",
                    pinLayer === "countries"
                      ? "bg-brand-950 text-brand-50 shadow-xs"
                      : "text-brand-500 hover:bg-brand-100/70 hover:text-brand-950",
                  )}
                >
                  <Globe className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPinLayer("cities");
                    setRightTab("cities");
                  }}
                  title="Show city pins"
                  aria-label="Show city pins"
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-xl transition cursor-pointer",
                    pinLayer === "cities"
                      ? "bg-brand-950 text-brand-50 shadow-xs"
                      : "text-brand-500 hover:bg-brand-100/70 hover:text-brand-950",
                  )}
                >
                  <MapPin className="h-3.5 w-3.5" />
                </button>
                <span className="mx-0.5 h-4 w-px bg-brand-200/70" aria-hidden="true" />
                <button
                  type="button"
                  onClick={() => setAutoRotate((prev) => !prev)}
                  title={autoRotate ? "Pause Earth rotation" : "Resume Earth rotation"}
                  aria-label={autoRotate ? "Pause Earth rotation" : "Resume Earth rotation"}
                  className="flex h-8 w-8 items-center justify-center rounded-xl text-brand-500 transition hover:bg-brand-100/70 hover:text-brand-950 cursor-pointer"
                >
                  {autoRotate ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                </button>
                <button
                  type="button"
                  onClick={() => bumpZoom(-0.28)}
                  title="Zoom in"
                  aria-label="Zoom in"
                  className="flex h-8 w-8 items-center justify-center rounded-xl text-brand-500 transition hover:bg-brand-100/70 hover:text-brand-950 cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => bumpZoom(0.28)}
                  title="Zoom out"
                  aria-label="Zoom out"
                  className="flex h-8 w-8 items-center justify-center rounded-xl text-brand-500 transition hover:bg-brand-100/70 hover:text-brand-950 cursor-pointer"
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={handleResetGlobe}
                  title="Reset view"
                  aria-label="Reset view"
                  className="flex h-8 w-8 items-center justify-center rounded-xl text-brand-500 transition hover:bg-brand-100/70 hover:text-brand-950 cursor-pointer"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Left Card 1: Hero Visitors + Daily Vertical Bar Histogram (Desktop floating) */}
              <div className="globe-glass hidden rounded-2xl p-4 lg:block">
                <div className="text-center">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-brand-400">
                    {heroMetricLabel}
                  </p>
                  <p className="mt-1 font-mono text-[28px] font-extrabold leading-none tracking-tight text-brand-950 tabular-nums">
                    {count(heroMetricValue)}
                  </p>
                  <div className="mt-2 flex items-center justify-center gap-1.5">
                    <span className="rounded-md bg-brand-100/80 px-2 py-0.5 text-[10px] font-medium text-brand-600">
                      {dateRangePill}
                    </span>
                    {clicksChangePct !== null ? (
                      <span
                        className={cn(
                          "rounded-md px-2 py-0.5 font-mono text-[10px] font-bold",
                          clicksChangePct >= 0
                            ? "bg-success-50 text-success-700"
                            : "bg-error-50 text-error-700",
                        )}
                      >
                        {clicksChangePct > 0 ? `+${clicksChangePct}%` : `${clicksChangePct}%`}
                      </span>
                    ) : (
                      <span className="rounded-md bg-brand-100/80 px-2 py-0.5 font-mono text-[10px] font-semibold text-brand-600">
                        {countries.length} {countries.length === 1 ? "country" : "countries"}
                      </span>
                    )}
                  </div>
                </div>

                {/* Vertical Daily Histogram Bars */}
                <div className="mt-3.5">
                  {histogramBars.length > 0 ? (
                    <>
                      <div
                        className="flex h-[58px] items-end gap-[3px]"
                        onMouseLeave={() => setHoveredBarIdx(null)}
                      >
                        {histogramBars.map((bar, idx) => {
                          const isHot = hoveredBarIdx === idx;
                          const isAccent = bar.ratio >= 0.45;
                          return (
                            <div
                              key={bar.date}
                              onMouseEnter={() => setHoveredBarIdx(idx)}
                              title={`${bar.label}: ${count(bar.value)}`}
                              className="group flex h-full flex-1 items-end"
                            >
                              <span
                                className={cn(
                                  "block w-full rounded-t-sm transition-all duration-150",
                                  isHot
                                    ? "bg-brand-950"
                                    : isAccent
                                      ? "bg-brand-600/75"
                                      : "bg-brand-300/75",
                                )}
                                style={{ height: `${Math.max(10, Math.round(bar.ratio * 100))}%` }}
                              />
                            </div>
                          );
                        })}
                      </div>
                      <div className="mt-1.5 flex items-center justify-between text-[9.5px] font-medium text-brand-400">
                        <span>{histogramBars[0]?.label}</span>
                        <span className="font-mono text-brand-700">
                          {hoveredBarIdx !== null && histogramBars[hoveredBarIdx]
                            ? `${histogramBars[hoveredBarIdx].label}: ${count(histogramBars[hoveredBarIdx].value)}`
                            : histogramBars[Math.floor(histogramBars.length / 2)]?.label}
                        </span>
                        <span>{histogramBars[histogramBars.length - 1]?.label}</span>
                      </div>
                    </>
                  ) : (
                    <p className="py-4 text-center text-[11px] text-brand-400">
                      Daily visitor bars appear after GA4/GSC sync
                    </p>
                  )}
                </div>
              </div>

              {/* Left Card 2: Total Sessions / Reach Sparkline (Desktop floating) */}
              <div className="globe-glass hidden rounded-2xl px-4 py-3.5 lg:block">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-brand-950">Total Sessions</span>
                  <span className="text-[10px] text-brand-400">last {periodDays} days</span>
                </div>
                <div className="relative mt-2 h-[46px] w-full">
                  {sparkline ? (
                    <svg
                      viewBox={`0 0 ${sparkline.w} ${sparkline.h}`}
                      className="h-full w-full overflow-visible"
                      preserveAspectRatio="none"
                      aria-hidden="true"
                    >
                      <defs>
                        <linearGradient id="globeSparkFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--color-series-1)" stopOpacity={0.22} />
                          <stop offset="100%" stopColor="var(--color-series-1)" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <path d={sparkline.areaD} fill="url(#globeSparkFill)" />
                      <path
                        d={sparkline.lineD}
                        fill="none"
                        stroke="var(--color-series-1)"
                        strokeWidth={1.6}
                        strokeLinecap="round"
                      />
                    </svg>
                  ) : (
                    <div className="flex h-full items-center justify-center text-[11px] text-brand-400">
                      No daily curve recorded
                    </div>
                  )}
                  <div className="pointer-events-none absolute inset-x-0 top-1 flex justify-center">
                    <span className="rounded-lg bg-brand-950 px-2.5 py-0.5 font-mono text-[11px] font-bold text-brand-50 shadow-sm">
                      {sessionsCount !== null ? count(sessionsCount) : `${countries.length} regions`}
                    </span>
                  </div>
                </div>
              </div>

              {/* Left Card 3: Segmented Traffic Mix Status Card (Desktop floating) */}
              <div className="globe-glass hidden rounded-2xl px-4 py-3.5 lg:block">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-brand-950">{segmentedMix.title}</span>
                  <span className="text-[10px] text-brand-400">last {periodDays} days</span>
                </div>
                {segmentedMix.items.length > 0 ? (
                  <div className="mt-3 grid grid-cols-4 gap-1.5">
                    {segmentedMix.items.map((seg, idx) => (
                      <div key={seg.label} className="min-w-0">
                        <p className="truncate text-[10px] font-medium text-brand-700" title={seg.label}>
                          {seg.label}
                        </p>
                        <p className="mt-0.5 font-mono text-[10px] text-brand-400">
                          {Math.round(seg.share * 100)}%
                        </p>
                        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-brand-200/60">
                          <div
                            className={cn(
                              "h-full rounded-full",
                              idx === 0
                                ? "globe-seg-0"
                                : idx === 1
                                  ? "globe-seg-1"
                                  : idx === 2
                                    ? "globe-seg-2"
                                    : "globe-seg-3",
                            )}
                            style={{ width: `${Math.max(12, Math.round(seg.share * 100))}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2.5 text-[11px] text-brand-400">
                    Connect GA4 to see live channel distribution.
                  </p>
                )}
              </div>
            </div>

            {/* RIGHT FLOATING STACK */}
            <div className="pointer-events-auto flex flex-col items-end gap-3 lg:w-[308px] xl:w-[328px]">
              {/* Top-right action buttons (Export + Plan Traffic + Fullscreen) */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => buildCsvAndDownload(countries, cities, periodDays)}
                  disabled={countries.length === 0 && cities.length === 0}
                  className="globe-glass-pill inline-flex items-center gap-1.5 rounded-2xl px-3.5 py-2 text-xs font-semibold text-brand-800 transition hover:text-brand-950 disabled:opacity-45 cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Export</span>
                </button>
                <button
                  type="button"
                  onClick={onOpenReport}
                  className="inline-flex items-center gap-1.5 rounded-2xl bg-brand-950 px-3.5 py-2 text-xs font-semibold text-brand-50 shadow-sm transition hover:bg-brand-800 cursor-pointer"
                >
                  <FileText className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Traffic Report</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsFullscreen((prev) => !prev)}
                  aria-label={isFullscreen ? "Exit fullscreen globe" : "Expand globe fullscreen"}
                  title={isFullscreen ? "Exit fullscreen (Esc)" : "Fullscreen globe"}
                  className="globe-glass-pill flex h-9 w-9 items-center justify-center rounded-2xl text-brand-700 transition hover:text-brand-950 cursor-pointer"
                >
                  {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                </button>
              </div>

              {/* Right Main Tabbed Panel (Countries / Cities / Live 30m) — Desktop Floating */}
              <div className="globe-glass hidden w-full flex-col rounded-2xl p-3.5 lg:flex">
                {/* Segmented Pill Tabs */}
                <div className="grid grid-cols-3 gap-1 rounded-xl bg-brand-100/75 p-1 text-[11px] font-semibold">
                  {(
                    [
                      { id: "countries", label: "Countries", badge: countries.length },
                      { id: "cities", label: "Cities", badge: cities.length },
                      { id: "live", label: "Live 30m", badge: realtimeData?.activeUsers ?? null },
                    ] as const
                  ).map((tab) => {
                    const active = rightTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => {
                          setRightTab(tab.id);
                          if (tab.id === "cities") setPinLayer("cities");
                          if (tab.id === "countries") setPinLayer("countries");
                        }}
                        className={cn(
                          "inline-flex items-center justify-center gap-1 rounded-lg px-2 py-1.5 transition cursor-pointer",
                          active
                            ? "bg-brand-950 text-brand-50 shadow-xs"
                            : "text-brand-500 hover:text-brand-950",
                        )}
                      >
                        {tab.id === "live" && (
                          <span
                            className={cn(
                              "h-1.5 w-1.5 rounded-full",
                              realtimeData && realtimeData.activeUsers > 0
                                ? "bg-success-500"
                                : "bg-brand-300",
                            )}
                          />
                        )}
                        <span>{tab.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Tab Content Feed */}
                <div className="mt-2.5 max-h-[340px] divide-y divide-brand-200/50 overflow-y-auto pr-0.5">
                  {rightTab === "countries" && (
                    displayedCountries.length > 0 ? (
                      displayedCountries.map((row) => {
                        const pinId = `country:${row.code}`;
                        const active = selectedPinId === pinId || hoveredPinId === pinId;
                        const liveHere = realtimeByCountryCode.get(row.code) ?? 0;
                        return (
                          <button
                            key={`${row.code}-${row.country}`}
                            type="button"
                            onClick={() => {
                              setPinLayer("countries");
                              setSelectedPinId(pinId);
                              if (row.lat !== null && row.lng !== null) flyTo(row.lat, row.lng);
                            }}
                            onMouseEnter={() => setHoveredPinId(pinId)}
                            onMouseLeave={() => setHoveredPinId(null)}
                            className={cn(
                              "w-full px-2 py-2.5 text-left transition rounded-xl cursor-pointer",
                              active ? "bg-brand-100/75" : "hover:bg-brand-100/45",
                            )}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="flex items-center gap-1.5 text-xs font-bold text-brand-950 truncate">
                                <span>{row.flag}</span>
                                <span className="truncate">{row.country}</span>
                              </span>
                              <span className="inline-flex shrink-0 items-center gap-1.5 font-mono text-xs font-bold text-brand-950">
                                {liveHere > 0 && (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-success-50 px-1.5 py-0.5 text-[9.5px] font-semibold text-success-700">
                                    <span className="h-1.5 w-1.5 rounded-full bg-success-500" />
                                    {liveHere}
                                  </span>
                                )}
                                {count(row.count)}
                              </span>
                            </div>
                            {/* Dotted share track inspired by reference route indicator */}
                            <div className="mt-1.5 flex items-center gap-2 text-[10.5px] text-brand-500">
                              <span className="font-mono uppercase text-[10px] text-brand-400">
                                {row.code}
                              </span>
                              <div className="relative flex flex-1 items-center">
                                <div className="h-[2px] w-full border-b border-dashed border-brand-300" />
                                <div
                                  className="absolute left-0 h-[3px] rounded-full bg-primary-600"
                                  style={{ width: `${Math.max(4, Math.min(100, row.share * 100))}%` }}
                                />
                                <span
                                  className="absolute h-2 w-2 -translate-x-1/2 rounded-full border border-surface-1 bg-brand-950"
                                  style={{ left: `${Math.max(4, Math.min(96, row.share * 100))}%` }}
                                />
                              </div>
                              <span className="w-10 text-right font-mono text-[10.5px] font-semibold text-brand-700">
                                {percent(row.share)}
                              </span>
                            </div>
                          </button>
                        );
                      })
                    ) : (
                      <div className="py-8 text-center text-xs text-brand-400">
                        No country-level traffic recorded in this period yet.
                      </div>
                    )
                  )}

                  {rightTab === "cities" && (
                    displayedCities.length > 0 ? (
                      displayedCities.map((row, idx) => {
                        const pinId = `city:${row.code}:${row.city}:${idx}`;
                        const active = selectedPinId === pinId || hoveredPinId === pinId;
                        return (
                          <button
                            key={`${row.city}-${row.country}-${idx}`}
                            type="button"
                            onClick={() => {
                              setPinLayer("cities");
                              setSelectedPinId(pinId);
                              if (row.lat !== null && row.lng !== null) flyTo(row.lat, row.lng);
                            }}
                            onMouseEnter={() => setHoveredPinId(pinId)}
                            onMouseLeave={() => setHoveredPinId(null)}
                            className={cn(
                              "w-full px-2 py-2.5 text-left transition rounded-xl cursor-pointer",
                              active ? "bg-brand-100/75" : "hover:bg-brand-100/45",
                            )}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="flex items-center gap-1.5 text-xs font-bold text-brand-950 truncate">
                                <span className="font-mono text-[10px] text-brand-400">#{idx + 1}</span>
                                <span className="truncate">{row.city}</span>
                              </span>
                              <span className="font-mono text-xs font-bold text-brand-950">
                                {count(row.count)}
                              </span>
                            </div>
                            <div className="mt-1.5 flex items-center gap-2 text-[10.5px] text-brand-500">
                              <span className="truncate max-w-[92px]">
                                {row.flag} {row.country}
                              </span>
                              <div className="relative flex flex-1 items-center">
                                <div className="h-[2px] w-full border-b border-dashed border-brand-300" />
                                <div
                                  className="absolute left-0 h-[3px] rounded-full bg-accent-500"
                                  style={{ width: `${Math.max(4, Math.min(100, row.share * 100))}%` }}
                                />
                                <span
                                  className="absolute h-2 w-2 -translate-x-1/2 rounded-full border border-surface-1 bg-brand-950"
                                  style={{ left: `${Math.max(4, Math.min(96, row.share * 100))}%` }}
                                />
                              </div>
                              <span className="w-10 text-right font-mono text-[10.5px] font-semibold text-brand-700">
                                {percent(row.share)}
                              </span>
                            </div>
                          </button>
                        );
                      })
                    ) : (
                      <div className="flex flex-col items-center justify-center py-7 text-center">
                        <MapPin className="h-5 w-5 text-brand-400" />
                        <p className="mt-2 text-xs font-semibold text-brand-950">
                          No city visitors recorded yet
                        </p>
                        <button
                          type="button"
                          onClick={onOpenReport}
                          className="mt-2.5 rounded-full bg-brand-950 px-3 py-1 text-[11px] font-semibold text-brand-50 hover:bg-brand-800 cursor-pointer"
                        >
                          Plan Target Cities →
                        </button>
                      </div>
                    )
                  )}

                  {rightTab === "live" && (
                    realtimeData ? (
                      realtimeRows.length > 0 ? (
                        realtimeRows.map((row) => (
                          <button
                            key={row.country}
                            type="button"
                            onClick={() => {
                              if (row.lat !== null && row.lng !== null) {
                                setPinLayer("countries");
                                setSelectedPinId(`country:${row.code}`);
                                flyTo(row.lat, row.lng);
                              }
                            }}
                            className="flex w-full items-center justify-between gap-2 rounded-xl px-2 py-2.5 text-left transition hover:bg-brand-100/50 cursor-pointer"
                          >
                            <span className="flex items-center gap-2 text-xs font-bold text-brand-950">
                              <span>{row.flag}</span>
                              <span>{row.country}</span>
                            </span>
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-success-50 px-2 py-0.5 font-mono text-[11px] font-bold text-success-700">
                              <span className="h-1.5 w-1.5 rounded-full bg-success-500" />
                              {count(row.activeUsers)} active
                            </span>
                          </button>
                        ))
                      ) : (
                        <div className="py-8 text-center text-xs text-brand-500">
                          <p className="font-mono text-lg font-bold text-brand-950">
                            {count(realtimeData.activeUsers)}
                          </p>
                          <p className="mt-1 text-[11px] text-brand-400">
                            Active in last 30 min · no country breakdown rows reported yet
                          </p>
                        </div>
                      )
                    ) : (
                      <div className="py-8 text-center text-xs text-brand-400">
                        <Radio className="mx-auto h-5 w-5 text-brand-400" />
                        <p className="mt-2">
                          {realtimeQuery.isPending
                            ? "Checking live GA4 visitors…"
                            : "Connect GA4 to stream active 30-minute visitors."}
                        </p>
                      </div>
                    )
                  )}
                </div>

                {/* Footer See All / Show Less */}
                {((rightTab === "countries" && countries.length > 7) ||
                  (rightTab === "cities" && cities.length > 7)) && (
                  <button
                    type="button"
                    onClick={() => setShowAllRows((prev) => !prev)}
                    className="mt-2 border-t border-brand-200/50 pt-2 text-center text-[11px] font-semibold text-brand-500 transition hover:text-brand-950 cursor-pointer"
                  >
                    {showAllRows
                      ? "Show Top 7"
                      : `See All (${rightTab === "countries" ? countries.length : cities.length})`}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* BOTTOM ROW: LEFT STATUS PILL + CENTER MODE SWITCHER + RIGHT COUNTRY PILLS & CITY SPOTLIGHT */}
          <div className="flex flex-wrap items-end justify-between gap-3">
            {/* Bottom-Left Workspace / Live Telemetry Badge */}
            <div className="pointer-events-auto flex items-center gap-2">
              <div className="globe-glass-pill flex items-center gap-2.5 rounded-2xl px-3 py-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-brand-950 text-brand-50">
                  <Activity className="h-3.5 w-3.5" />
                </span>
                <div className="leading-tight">
                  <p className="text-[11.5px] font-bold text-brand-950">Global Traffic</p>
                  <p className="text-[10px] text-brand-500">
                    {countries.length} {countries.length === 1 ? "country" : "countries"} · {cities.length} {cities.length === 1 ? "city" : "cities"}
                  </p>
                </div>
                {realtimeData && (
                  <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-success-50 px-2 py-0.5 font-mono text-[10px] font-bold text-success-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-success-500" />
                    {count(realtimeData.activeUsers)} live
                  </span>
                )}
              </div>
            </div>

            {/* Bottom-Center Segmented View Switcher: Globe | Map | Flows */}
            <div
              role="tablist"
              aria-label="Map projection mode"
              className="globe-glass-pill pointer-events-auto inline-flex items-center gap-1 rounded-2xl p-1"
            >
              {(
                [
                  { id: "globe", label: "Globe", icon: Globe },
                  { id: "map", label: "Map", icon: MapIcon },
                  { id: "flows", label: "Flows", icon: Share2 },
                ] as const
              ).map((mode) => {
                const Icon = mode.icon;
                const active = viewMode === mode.id;
                return (
                  <button
                    key={mode.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setViewMode(mode.id)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition cursor-pointer",
                      active
                        ? "bg-brand-950 text-brand-50 shadow-xs"
                        : "text-brand-600 hover:text-brand-950",
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span>{mode.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Bottom-Right Country Quick-Fly Pills & City Spotlight Mini-Cards */}
            <div className="pointer-events-auto hidden flex-col items-end gap-2 xl:flex">
              {filterCountries.length > 0 && (
                <div className="flex flex-wrap items-center justify-end gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleCountryChipClick(null)}
                    className={cn(
                      "rounded-full px-3 py-1 text-[11px] font-semibold transition cursor-pointer",
                      selectedCountryCode === null
                        ? "bg-brand-950 text-brand-50 shadow-xs"
                        : "globe-glass-pill text-brand-700 hover:text-brand-950",
                    )}
                  >
                    All
                  </button>
                  {filterCountries.map((c) => {
                    const active = selectedCountryCode === c.code;
                    return (
                      <button
                        key={c.code}
                        type="button"
                        onClick={() => handleCountryChipClick(active ? null : c.code)}
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-semibold transition cursor-pointer",
                          active
                            ? "bg-brand-950 text-brand-50 shadow-xs"
                            : "globe-glass-pill text-brand-700 hover:text-brand-950",
                        )}
                      >
                        <span>{c.flag}</span>
                        <span>{c.country}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Mini City Spotlight Cards matching reference bottom-right preview cards */}
              {spotlightCities.length > 0 && (
                <div className="flex items-stretch gap-2">
                  {spotlightCities.map((city, idx) => (
                    <button
                      key={`${city.city}-${city.country}-${idx}`}
                      type="button"
                      onClick={() => {
                        setPinLayer("cities");
                        setRightTab("cities");
                        setSelectedPinId(`city:${city.code}:${city.city}:${idx}`);
                        if (city.lat !== null && city.lng !== null) flyTo(city.lat, city.lng);
                      }}
                      className="globe-city-thumb group relative flex h-[76px] w-[156px] flex-col justify-between overflow-hidden rounded-2xl border border-brand-200/70 p-2.5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md cursor-pointer"
                    >
                      <div className="flex items-center justify-between">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-950 text-brand-50">
                          <MapPin className="h-2.5 w-2.5" />
                        </span>
                        <span className="globe-glass-pill rounded-md px-1.5 py-0.5 font-mono text-[9.5px] font-bold text-brand-800">
                          {percent(city.share)}
                        </span>
                      </div>
                      <div className="globe-glass-pill rounded-xl px-2 py-1">
                        <p className="truncate text-[10.5px] font-bold text-brand-950">
                          #{idx + 1} {city.city}
                        </p>
                        <p className="truncate font-mono text-[9.5px] text-brand-500">
                          {city.flag} {count(city.count)} visitors
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Fullscreen close pill helper */}
        {isFullscreen && (
          <button
            type="button"
            onClick={() => setIsFullscreen(false)}
            aria-label="Close fullscreen"
            className="globe-glass-pill fixed top-4 left-1/2 z-50 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold text-brand-800 shadow-md lg:hidden"
          >
            <X className="h-3.5 w-3.5" />
            <span>Exit Fullscreen</span>
          </button>
        )}
      </div>

      {/* ── COMPACT MOBILE / TABLET BREAKDOWN STRIP (< lg) ── */}
      {!isFullscreen && (
        <div className="grid grid-cols-1 gap-3 border-t border-brand-200/50 p-4 sm:grid-cols-2 lg:hidden">
          <div className="globe-glass rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-1.5 text-xs font-bold text-brand-950">
                <Layers className="h-3.5 w-3.5 text-brand-500" />
                <span>Top Countries</span>
              </h3>
              <span className="font-mono text-[11px] text-brand-500">{countries.length} total</span>
            </div>
            <div className="mt-3 space-y-2">
              {countries.length > 0 ? (
                countries.slice(0, 5).map((row) => (
                  <button
                    key={row.code}
                    type="button"
                    onClick={() => {
                      setPinLayer("countries");
                      setSelectedPinId(`country:${row.code}`);
                      if (row.lat !== null && row.lng !== null) flyTo(row.lat, row.lng);
                    }}
                    className="flex w-full items-center justify-between text-xs"
                  >
                    <span className="font-semibold text-brand-950">
                      {row.flag} {row.country}
                    </span>
                    <span className="font-mono text-brand-600">
                      {count(row.count)} ({percent(row.share)})
                    </span>
                  </button>
                ))
              ) : (
                <p className="text-xs text-brand-400">No country data recorded yet.</p>
              )}
            </div>
          </div>

          <div className="globe-glass rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-1.5 text-xs font-bold text-brand-950">
                <Building2 className="h-3.5 w-3.5 text-brand-500" />
                <span>Top Cities</span>
              </h3>
              <span className="font-mono text-[11px] text-brand-500">{cities.length} total</span>
            </div>
            <div className="mt-3 space-y-2">
              {cities.length > 0 ? (
                cities.slice(0, 5).map((row, idx) => (
                  <button
                    key={`${row.city}-${idx}`}
                    type="button"
                    onClick={() => {
                      setPinLayer("cities");
                      setSelectedPinId(`city:${row.code}:${row.city}:${idx}`);
                      if (row.lat !== null && row.lng !== null) flyTo(row.lat, row.lng);
                    }}
                    className="flex w-full items-center justify-between text-xs"
                  >
                    <span className="font-semibold text-brand-950">
                      #{idx + 1} {row.city}
                    </span>
                    <span className="font-mono text-brand-600">
                      {count(row.count)} ({percent(row.share)})
                    </span>
                  </button>
                ))
              ) : (
                <p className="text-xs text-brand-400">No city data recorded yet.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
