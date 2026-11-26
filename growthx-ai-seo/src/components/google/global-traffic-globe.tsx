"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  Bot,
  Building2,
  Camera,
  Download,
  Eye,
  FileText,
  Globe,
  Grid,
  Layers,
  Map as MapIcon,
  MapPin,
  Maximize2,
  Minimize2,
  Minus,
  MousePointerClick,
  Pause,
  Play,
  Plus,
  Radio,
  RotateCcw,
  Search,
  Share2,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import { api } from "@/lib/api-client";
import { resolveCountryGeo } from "@/lib/geo-coordinates";
import { count, percent, shortDay } from "@/lib/google-format";
import { cn } from "@/lib/utils";
import type { GlobeCapturePayload, GlobeFlowArc, GlobePin } from "./earth-globe-canvas";
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
  visitors: number | null;
  clicks: number | null;
  impressions: number | null;
  ctr: number | null;
  position: number | null;
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
  botHubReason: string | null;
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
  searchImpressions: number | null;
  clicksChangePct: number | null;
  dailyChartData: DailyTrafficPoint[];
  channels: TrafficChannelRow[];
  countries: TrafficCountryRow[];
  cities: TrafficCityRow[];
  onOpenReport: () => void;
}

type GlobeViewMode = "globe" | "map" | "flows";
type RightPanelTab = "countries" | "cities" | "live";
type GlobeMetricMode = "visitors" | "clicks" | "impressions";

const METRIC_META: Record<GlobeMetricMode, { label: string; unit: string; short: string }> = {
  visitors: { label: "Global Visitors", unit: "visitors", short: "Visitors" },
  clicks: { label: "Search Clicks", unit: "clicks", short: "Clicks" },
  impressions: { label: "Search Impressions", unit: "impressions", short: "Impressions" },
};

function buildCsvAndDownload(
  countries: TrafficCountryRow[],
  cities: TrafficCityRow[],
  periodDays: number,
) {
  const escape = (val: string | number | null) =>
    `"${String(val ?? "").replace(/"/g, '""')}"`;
  const lines: string[] = [
    ["Type", "Name", "Country", "Visitors", "Search Clicks", "Impressions", "Share %", "Traffic Classification"]
      .map(escape)
      .join(","),
    ...countries.map((c) =>
      [
        "Country",
        c.country,
        c.code,
        c.visitors ?? c.count,
        c.clicks ?? "",
        c.impressions ?? "",
        (c.share * 100).toFixed(2),
        "Country total",
      ]
        .map(escape)
        .join(","),
    ),
    ...cities.map((c) =>
      [
        "City",
        c.city,
        c.country,
        c.count,
        "",
        "",
        (c.share * 100).toFixed(2),
        c.botHubReason ? `Cloud/Bot hub (${c.botHubReason})` : "Standard",
      ]
        .map(escape)
        .join(","),
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

/** Composites a crisp 1600x900 presentation PNG of the live 3D globe + markers + KPI stamp. */
function exportPresentationPng(
  capture: GlobeCapturePayload,
  opts: {
    isDark: boolean;
    title: string;
    subtitle: string;
    heroValue: string;
    topRows: Array<{ label: string; value: string; share: string }>;
    periodDays: number;
  },
) {
  const img = new Image();
  img.onload = () => {
    const outW = 1600;
    const outH = 900;
    const canvas = document.createElement("canvas");
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Sky / night radial backdrop
    const grad = ctx.createRadialGradient(outW * 0.52, outH * 0.48, 80, outW * 0.52, outH * 0.48, outW * 0.65);
    if (opts.isDark) {
      grad.addColorStop(0, "rgb(19, 28, 44)");
      grad.addColorStop(0.55, "rgb(13, 20, 33)");
      grad.addColorStop(1, "rgb(8, 12, 20)");
    } else {
      grad.addColorStop(0, "rgb(242, 246, 250)");
      grad.addColorStop(0.5, "rgb(229, 237, 244)");
      grad.addColorStop(1, "rgb(212, 224, 235)");
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, outW, outH);

    // Draw WebGL Earth centered with aspect preservation
    const srcAspect = capture.width / Math.max(capture.height, 1);
    const dstAspect = outW / outH;
    let drawW = outW;
    let drawH = outH;
    if (srcAspect > dstAspect) {
      drawH = outW / srcAspect;
    } else {
      drawW = outH * srcAspect;
    }
    const offsetX = (outW - drawW) / 2;
    const offsetY = (outH - drawH) / 2;
    ctx.drawImage(img, offsetX, offsetY, drawW, drawH);

    // Draw visible projected glowing markers onto the Earth
    const scaleX = drawW / Math.max(capture.width, 1);
    const scaleY = drawH / Math.max(capture.height, 1);
    for (const pin of capture.visiblePins) {
      const px = offsetX + pin.x * scaleX;
      const py = offsetY + pin.y * scaleY;
      const haloR = pin.share > 0.35 ? 20 : pin.share > 0.08 ? 15 : 12;

      ctx.beginPath();
      ctx.arc(px, py, haloR, 0, Math.PI * 2);
      ctx.fillStyle = pin.isLive
        ? "rgba(16, 185, 129, 0.28)"
        : pin.isBot
          ? "rgba(245, 158, 11, 0.28)"
          : opts.isDark
            ? "rgba(200, 245, 58, 0.22)"
            : "rgba(255, 255, 255, 0.42)";
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = pin.isLive
        ? "rgba(16, 185, 129, 0.95)"
        : pin.isBot
          ? "rgba(245, 158, 11, 0.95)"
          : opts.isDark
            ? "rgba(200, 245, 58, 0.85)"
            : "rgba(255, 255, 255, 0.88)";
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(px, py, 5, 0, Math.PI * 2);
      ctx.fillStyle = pin.isBot
        ? "rgb(245, 158, 11)"
        : opts.isDark
          ? "rgb(200, 245, 58)"
          : "rgb(255, 255, 255)";
      ctx.fill();
    }

    // Draw clean glass summary card (top-left)
    const cardX = 48;
    const cardY = 48;
    const cardW = 360;
    const cardH = 148 + Math.min(opts.topRows.length, 4) * 34;

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardW, cardH, 22);
    ctx.fillStyle = opts.isDark ? "rgba(15, 19, 28, 0.86)" : "rgba(255, 255, 255, 0.86)";
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = opts.isDark ? "rgba(255, 255, 255, 0.12)" : "rgba(255, 255, 255, 0.95)";
    ctx.stroke();

    const textPrimary = opts.isDark ? "rgb(250, 250, 250)" : "rgb(9, 9, 11)";
    const textMuted = opts.isDark ? "rgb(143, 151, 164)" : "rgb(100, 116, 139)";

    ctx.fillStyle = textMuted;
    ctx.font = "600 13px Inter, system-ui, sans-serif";
    ctx.fillText(opts.title.toUpperCase(), cardX + 24, cardY + 38);

    ctx.fillStyle = textPrimary;
    ctx.font = "800 40px Inter, system-ui, sans-serif";
    ctx.fillText(opts.heroValue, cardX + 24, cardY + 86);

    ctx.fillStyle = textMuted;
    ctx.font = "500 13px Inter, system-ui, sans-serif";
    ctx.fillText(opts.subtitle, cardX + 24, cardY + 112);

    ctx.strokeStyle = opts.isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(15, 23, 42, 0.08)";
    ctx.beginPath();
    ctx.moveTo(cardX + 24, cardY + 128);
    ctx.lineTo(cardX + cardW - 24, cardY + 128);
    ctx.stroke();

    opts.topRows.slice(0, 4).forEach((row, idx) => {
      const y = cardY + 158 + idx * 34;
      ctx.fillStyle = textPrimary;
      ctx.font = "600 14px Inter, system-ui, sans-serif";
      ctx.fillText(row.label, cardX + 24, y);
      ctx.fillStyle = textMuted;
      ctx.font = "600 13px monospace";
      const valStr = `${row.value} (${row.share})`;
      const measured = ctx.measureText(valStr).width;
      ctx.fillText(valStr, cardX + cardW - 24 - measured, y);
    });
    ctx.restore();

    const outUrl = canvas.toDataURL("image/png");
    const anchor = document.createElement("a");
    anchor.href = outUrl;
    anchor.download = `traffic-globe-snapshot-${opts.periodDays}d.png`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  };
  img.src = capture.dataUrl;
}

export function GlobalTrafficGlobe({
  projectId,
  periodDays,
  visitorsCount,
  sessionsCount,
  searchClicks,
  searchImpressions,
  clicksChangePct,
  dailyChartData,
  channels,
  countries,
  cities,
  onOpenReport,
}: GlobalTrafficGlobeProps) {
  const { isDark } = useTheme();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const captureFnRef = useRef<(() => GlobeCapturePayload | null) | null>(null);

  const [viewMode, setViewMode] = useState<GlobeViewMode>("globe");
  const [metricMode, setMetricMode] = useState<GlobeMetricMode>("visitors");
  const [rightTab, setRightTab] = useState<RightPanelTab>("countries");
  const [pinLayer, setPinLayer] = useState<"countries" | "cities">("countries");
  const [showBorders, setShowBorders] = useState<boolean>(true);
  const [hideBotHubs, setHideBotHubs] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
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

  const registerCapture = useCallback((fn: (() => GlobeCapturePayload | null) | null) => {
    captureFnRef.current = fn;
  }, []);

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

  const realtimeByCountryCode = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of realtimeData?.countries ?? []) {
      const geo = resolveCountryGeo(row.country);
      const key = geo?.code ?? row.country.trim().toUpperCase();
      map.set(key, (map.get(key) ?? 0) + row.activeUsers);
    }
    return map;
  }, [realtimeData]);

  useEffect(() => {
    if (!isFullscreen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsFullscreen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isFullscreen]);

  // Check if GSC country metrics exist so metric switcher highlights real availability
  const hasGscCountryMetrics = useMemo(
    () => countries.some((c) => (c.clicks ?? 0) > 0 || (c.impressions ?? 0) > 0),
    [countries],
  );

  // Re-rank countries dynamically for the active metric (Visitors / Clicks / Impressions)
  const metricCountries = useMemo<TrafficCountryRow[]>(() => {
    const getVal = (c: TrafficCountryRow) => {
      if (metricMode === "clicks") return c.clicks ?? 0;
      if (metricMode === "impressions") return c.impressions ?? 0;
      return c.visitors ?? c.count;
    };
    const rows = countries
      .map((c) => ({ ...c, count: getVal(c) }))
      .filter((c) => (metricMode === "visitors" ? true : c.count > 0));
    const total = rows.reduce((sum, c) => sum + c.count, 0) || 1;
    return rows
      .map((c) => ({ ...c, share: c.count / total }))
      .sort((a, b) => b.count - a.count);
  }, [countries, metricMode]);

  // Cloud / bot hub stats across GA4 cities
  const botHubStats = useMemo(() => {
    const botCities = cities.filter((c) => Boolean(c.botHubReason));
    const botSessions = botCities.reduce((sum, c) => sum + c.count, 0);
    const totalCitySessions = cities.reduce((sum, c) => sum + c.count, 0);
    return {
      botCityCount: botCities.length,
      botSessions,
      totalCitySessions,
      humanSessions: Math.max(0, totalCitySessions - botSessions),
    };
  }, [cities]);

  // Cities after optional Cloud/Bot filter (recomputing shares honestly!)
  const filteredCities = useMemo<TrafficCityRow[]>(() => {
    const base = hideBotHubs ? cities.filter((c) => !c.botHubReason) : cities;
    const total = base.reduce((sum, c) => sum + c.count, 0) || 1;
    return base.map((c) => ({ ...c, share: c.count / total }));
  }, [cities, hideBotHubs]);

  // Selected country object for country-scoped drilldown
  const selectedCountry = useMemo(() => {
    if (!selectedCountryCode) return null;
    return (
      metricCountries.find((c) => c.code === selectedCountryCode) ??
      countries.find((c) => c.code === selectedCountryCode) ??
      null
    );
  }, [selectedCountryCode, metricCountries, countries]);

  const selectedCountryCities = useMemo(() => {
    if (!selectedCountryCode) return filteredCities;
    const list = filteredCities.filter((c) => c.code === selectedCountryCode);
    const total = list.reduce((sum, c) => sum + c.count, 0) || 1;
    return list.map((c) => ({ ...c, share: c.count / total }));
  }, [filteredCities, selectedCountryCode]);

  // Derive default focus target from top mapped country until user explicitly flies somewhere
  const defaultFocusTarget = useMemo(() => {
    const topMapped = metricCountries.find((c) => c.lat !== null && c.lng !== null);
    if (!topMapped || topMapped.lat === null || topMapped.lng === null) return null;
    return { lat: topMapped.lat, lng: topMapped.lng, nonce: 0 };
  }, [metricCountries]);

  const activeFocusTarget = focusTarget ?? defaultFocusTarget;

  const flyTo = useCallback((lat: number, lng: number) => {
    setFocusTarget((prev) => ({ lat, lng, nonce: (prev?.nonce ?? 0) + 1 }));
  }, []);

  const bumpZoom = useCallback((delta: number) => {
    setZoomSignal((prev) => ({ delta, nonce: (prev?.nonce ?? 0) + 1 }));
  }, []);

  const metricMeta = METRIC_META[metricMode];

  // Build pins for 3D Earth & 2D Map
  const countryPins = useMemo<GlobePin[]>(() => {
    return metricCountries
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
        metricUnit: metricMeta.unit,
        liveUsers: realtimeByCountryCode.get(c.code) ?? 0,
      }));
  }, [metricCountries, metricMeta.unit, realtimeByCountryCode]);

  const cityPins = useMemo<GlobePin[]>(() => {
    return selectedCountryCities
      .filter((c) => c.lat !== null && c.lng !== null)
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
        metricUnit: "visitors",
        liveUsers: 0,
        botHubReason: c.botHubReason,
      }));
  }, [selectedCountryCities]);

  const visiblePins = useMemo(() => {
    if (pinLayer === "cities" && cityPins.length > 0) return cityPins;
    if (selectedCountryCode) {
      const filtered = countryPins.filter((p) => p.code === selectedCountryCode);
      if (filtered.length > 0) return filtered;
    }
    return countryPins;
  }, [pinLayer, cityPins, countryPins, selectedCountryCode]);

  // Highlighted country code on 3D borders (hovered pin or selected country)
  const highlightedCountryCode = useMemo(() => {
    if (hoveredPinId) {
      const match = [...countryPins, ...cityPins].find((p) => p.id === hoveredPinId);
      if (match?.code) return match.code;
    }
    return selectedCountryCode;
  }, [hoveredPinId, countryPins, cityPins, selectedCountryCode]);

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
    () => new Set(metricCountries.map((c) => c.code).filter(Boolean)),
    [metricCountries],
  );

  const filterCountries = useMemo(
    () => metricCountries.filter((c) => c.lat !== null && c.lng !== null).slice(0, 5),
    [metricCountries],
  );

  const spotlightCities = useMemo(() => {
    const base = selectedCountryCode ? selectedCountryCities : filteredCities;
    return (base.length > 0 ? base : filteredCities).slice(0, 3);
  }, [selectedCountryCode, selectedCountryCities, filteredCities]);

  // Search-filtered lists for Right Panel
  const normalizedQuery = searchQuery.trim().toLowerCase();

  const searchedCountries = useMemo(() => {
    if (!normalizedQuery) return metricCountries;
    return metricCountries.filter(
      (c) =>
        c.country.toLowerCase().includes(normalizedQuery) ||
        c.code.toLowerCase().includes(normalizedQuery),
    );
  }, [metricCountries, normalizedQuery]);

  const searchedCities = useMemo(() => {
    const base = selectedCountryCode ? selectedCountryCities : filteredCities;
    if (!normalizedQuery) return base;
    return base.filter(
      (c) =>
        c.city.toLowerCase().includes(normalizedQuery) ||
        c.country.toLowerCase().includes(normalizedQuery),
    );
  }, [selectedCountryCode, selectedCountryCities, filteredCities, normalizedQuery]);

  const displayedCountries = showAllRows ? searchedCountries : searchedCountries.slice(0, 7);
  const displayedCities = showAllRows ? searchedCities : searchedCities.slice(0, 7);

  const realtimeRows = useMemo(() => {
    const base = (realtimeData?.countries ?? []).map((row) => {
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
    if (!normalizedQuery) return base;
    return base.filter((r) => r.country.toLowerCase().includes(normalizedQuery));
  }, [realtimeData, normalizedQuery]);

  // Daily bar histogram data
  const histogramBars = useMemo(() => {
    const slice = dailyChartData.slice(-30);
    const values = slice.map((d) =>
      metricMode === "clicks"
        ? (d.searchClicks ?? 0)
        : (d.visitors ?? d.searchClicks ?? 0),
    );
    const maxVal = Math.max(...values, 1);
    return slice.map((d, i) => ({
      date: d.date,
      label: shortDay(d.date),
      value: values[i],
      ratio: values[i] / maxVal,
    }));
  }, [dailyChartData, metricMode]);

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
      return { x, y };
    });
    const lineD = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
    const areaD = `${lineD} L${w} ${h} L0 ${h} Z`;
    return { lineD, areaD, w, h };
  }, [dailyChartData]);

  // Left Card 3: Country-scoped Top Cities / Bot split OR Global Channel Mix
  const segmentedMix = useMemo(() => {
    if (selectedCountry) {
      if (selectedCountryCities.length > 0) {
        return {
          title: `${selectedCountry.code} City Split`,
          items: selectedCountryCities.slice(0, 4).map((c) => ({
            label: c.city,
            share: c.share,
          })),
        };
      }
      return {
        title: `${selectedCountry.country} Share`,
        items: [
          { label: selectedCountry.code, share: selectedCountry.share },
          { label: "Rest of World", share: Math.max(0, 1 - selectedCountry.share) },
        ],
      };
    }

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
      items: metricCountries.slice(0, 4).map((c) => ({
        label: c.code || c.country.slice(0, 8),
        share: c.share,
      })),
    };
  }, [selectedCountry, selectedCountryCities, channels, metricCountries]);

  // Hero metric value (supports both global & country-scoped drilldown!)
  const geoMetricTotal = useMemo(
    () => metricCountries.reduce((sum, c) => sum + c.count, 0),
    [metricCountries],
  );

  const heroMetricValue = useMemo(() => {
    if (selectedCountry) return selectedCountry.count;
    if (metricMode === "clicks") return searchClicks ?? (geoMetricTotal > 0 ? geoMetricTotal : null);
    if (metricMode === "impressions") return searchImpressions ?? (geoMetricTotal > 0 ? geoMetricTotal : null);
    return visitorsCount ?? (geoMetricTotal > 0 ? geoMetricTotal : searchClicks);
  }, [selectedCountry, metricMode, searchClicks, searchImpressions, visitorsCount, geoMetricTotal]);

  const heroMetricLabel = selectedCountry
    ? `${selectedCountry.flag} ${selectedCountry.country} · ${metricMeta.short}`
    : metricMeta.label;

  const dateRangePill = useMemo(() => {
    if (dailyChartData.length >= 2) {
      return `${shortDay(dailyChartData[0].date)} – ${shortDay(dailyChartData[dailyChartData.length - 1].date)}`;
    }
    return `Last ${periodDays} days`;
  }, [dailyChartData, periodDays]);

  const handleSelectPin = useCallback(
    (pin: GlobePin) => {
      setSelectedPinId(pin.id);
      if (pin.id.startsWith("country:") && pin.code) {
        setSelectedCountryCode(pin.code);
      }
      flyTo(pin.lat, pin.lng);
    },
    [flyTo],
  );

  const handleCountryChipClick = useCallback(
    (code: string | null) => {
      setSelectedCountryCode(code);
      if (!code) {
        setSelectedPinId(null);
        const top = metricCountries.find((c) => c.lat !== null && c.lng !== null);
        if (top && top.lat !== null && top.lng !== null) flyTo(top.lat, top.lng);
        return;
      }
      const match = metricCountries.find((c) => c.code === code) ?? countries.find((c) => c.code === code);
      if (match && match.lat !== null && match.lng !== null) {
        setSelectedPinId(`country:${match.code}`);
        flyTo(match.lat, match.lng);
      }
    },
    [metricCountries, countries, flyTo],
  );

  const handleResetGlobe = useCallback(() => {
    setSelectedCountryCode(null);
    setSelectedPinId(null);
    setSearchQuery("");
    const top = metricCountries.find((c) => c.lat !== null && c.lng !== null);
    if (top && top.lat !== null && top.lng !== null) {
      flyTo(top.lat, top.lng);
    } else {
      flyTo(26, 18);
    }
    setZoomSignal((prev) => ({ reset: true, nonce: (prev?.nonce ?? 0) + 1 }));
  }, [metricCountries, flyTo]);

  const handleSearchSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!normalizedQuery) return;
      if (rightTab === "cities" && searchedCities.length > 0) {
        const hit = searchedCities[0];
        setPinLayer("cities");
        setSelectedPinId(`city:${hit.code}:${hit.city}:0`);
        if (hit.lat !== null && hit.lng !== null) flyTo(hit.lat, hit.lng);
      } else if (searchedCountries.length > 0) {
        const hit = searchedCountries[0];
        setPinLayer("countries");
        setSelectedCountryCode(hit.code);
        setSelectedPinId(`country:${hit.code}`);
        if (hit.lat !== null && hit.lng !== null) flyTo(hit.lat, hit.lng);
      }
    },
    [normalizedQuery, rightTab, searchedCities, searchedCountries, flyTo],
  );

  const handleSnapshotDownload = useCallback(() => {
    const capture = captureFnRef.current?.();
    if (!capture) return;
    exportPresentationPng(capture, {
      isDark,
      title: selectedCountry
        ? `${selectedCountry.country} · ${metricMeta.short}`
        : `Global Traffic · ${metricMeta.short}`,
      subtitle: `${dateRangePill} · ${metricCountries.length} countries · ${filteredCities.length} cities`,
      heroValue: count(heroMetricValue),
      topRows: (selectedCountry ? selectedCountryCities : metricCountries).slice(0, 4).map((r) => ({
        label: "city" in r ? `${r.flag} ${r.city}` : `${r.flag} ${r.country}`,
        value: count(r.count),
        share: percent(r.share),
      })),
      periodDays,
    });
  }, [
    isDark,
    selectedCountry,
    metricMeta.short,
    dateRangePill,
    metricCountries,
    filteredCities.length,
    heroMetricValue,
    selectedCountryCities,
    periodDays,
  ]);

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
          isFullscreen ? "h-full" : "h-[460px] sm:h-[520px] lg:h-[710px]",
        )}
      >
        {viewMode === "map" ? (
          <WorldMap2D
            pins={visiblePins}
            activeCountryCodes={activeCountryCodes}
            highlightedCountryCode={highlightedCountryCode}
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
            showBorders={showBorders}
            highlightedCountryCode={highlightedCountryCode}
            isDark={isDark}
            autoRotate={autoRotate}
            selectedPinId={selectedPinId}
            hoveredPinId={hoveredPinId}
            focusTarget={activeFocusTarget}
            zoomSignal={zoomSignal}
            onSelectPin={handleSelectPin}
            onHoverPin={setHoveredPinId}
            onRegisterCapture={registerCapture}
          />
        )}

        {/* ── FLOATING OVERLAY HUD ── */}
        <div className="pointer-events-none absolute inset-0 z-20 flex flex-col justify-between p-3.5 sm:p-5">
          {/* TOP ROW: LEFT STACK + CENTER METRIC PILL + RIGHT STACK */}
          <div className="flex items-start justify-between gap-3">
            {/* LEFT FLOATING STACK */}
            <div className="pointer-events-auto flex w-auto flex-col gap-3 lg:w-[276px] xl:w-[294px]">
              {/* Top-left floating icon toolbar pill */}
              <div
                role="toolbar"
                aria-label="Globe controls"
                className="globe-glass-pill inline-flex w-fit items-center gap-1 rounded-2xl p-1.5"
              >
                <button
                  type="button"
                  onClick={() => {
                    setPinLayer("countries");
                    setRightTab("countries");
                  }}
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
                <button
                  type="button"
                  onClick={() => setShowBorders((prev) => !prev)}
                  title={showBorders ? "Hide country borders" : "Show country borders"}
                  aria-label={showBorders ? "Hide country borders" : "Show country borders"}
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-xl transition cursor-pointer",
                    showBorders
                      ? "bg-brand-200/80 text-brand-950"
                      : "text-brand-500 hover:bg-brand-100/70 hover:text-brand-950",
                  )}
                >
                  <Grid className="h-3.5 w-3.5" />
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

              {/* Left Card 1: Hero Visitors / Metric + Country Drilldown or Histogram */}
              <div className="globe-glass hidden rounded-2xl p-4 lg:block">
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1.5">
                    <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-brand-400">
                      {heroMetricLabel}
                    </p>
                    {selectedCountry && (
                      <button
                        type="button"
                        onClick={() => handleCountryChipClick(null)}
                        aria-label="Clear country filter"
                        title="Back to Global view"
                        className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-brand-200/80 text-brand-700 hover:bg-brand-300 cursor-pointer"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    )}
                  </div>
                  <p className="mt-1 font-mono text-[28px] font-extrabold leading-none tracking-tight text-brand-950 tabular-nums">
                    {count(heroMetricValue)}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5">
                    <span className="rounded-md bg-brand-100/80 px-2 py-0.5 text-[10px] font-medium text-brand-600">
                      {selectedCountry ? `${percent(selectedCountry.share)} of total` : dateRangePill}
                    </span>
                    {!selectedCountry && clicksChangePct !== null ? (
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
                        {selectedCountry
                          ? `${selectedCountryCities.length} ${selectedCountryCities.length === 1 ? "city" : "cities"}`
                          : `${metricCountries.length} ${metricCountries.length === 1 ? "country" : "countries"}`}
                      </span>
                    )}
                  </div>
                </div>

                {/* When scoped to a country, show country GSC + GA4 drilldown metrics; otherwise show daily bar histogram */}
                {selectedCountry ? (
                  <div className="mt-3.5 grid grid-cols-2 gap-1.5 border-t border-brand-200/50 pt-3 text-left">
                    <div className="rounded-xl bg-brand-100/65 px-2.5 py-1.5">
                      <p className="text-[9.5px] font-medium text-brand-400">GA4 Visitors</p>
                      <p className="font-mono text-xs font-bold text-brand-950">
                        {count(selectedCountry.visitors)}
                      </p>
                    </div>
                    <div className="rounded-xl bg-brand-100/65 px-2.5 py-1.5">
                      <p className="text-[9.5px] font-medium text-brand-400">GSC Clicks</p>
                      <p className="font-mono text-xs font-bold text-brand-950">
                        {count(selectedCountry.clicks)}
                      </p>
                    </div>
                    <div className="rounded-xl bg-brand-100/65 px-2.5 py-1.5">
                      <p className="text-[9.5px] font-medium text-brand-400">Impressions</p>
                      <p className="font-mono text-xs font-bold text-brand-950">
                        {count(selectedCountry.impressions)}
                      </p>
                    </div>
                    <div className="rounded-xl bg-brand-100/65 px-2.5 py-1.5">
                      <p className="text-[9.5px] font-medium text-brand-400">CTR · Pos</p>
                      <p className="font-mono text-xs font-bold text-brand-950">
                        {selectedCountry.ctr !== null ? percent(selectedCountry.ctr) : "—"}
                        {selectedCountry.position !== null ? ` · #${selectedCountry.position.toFixed(1)}` : ""}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3.5">
                    {histogramBars.length > 0 ? (
                      <>
                        <div
                          className="flex h-[56px] items-end gap-[3px]"
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
                        Daily bars appear after GA4/GSC sync
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Left Card 2: Total Sessions Sparkline + Cloud/Bot Hygiene */}
              <div className="globe-glass hidden rounded-2xl px-4 py-3.5 lg:block">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-brand-950">
                    {botHubStats.botCityCount > 0 && hideBotHubs ? "Est. Human City Traffic" : "Total Sessions"}
                  </span>
                  <span className="text-[10px] text-brand-400">last {periodDays} days</span>
                </div>
                <div className="relative mt-2 h-[44px] w-full">
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
                      {botHubStats.botCityCount > 0 && hideBotHubs
                        ? count(botHubStats.humanSessions)
                        : sessionsCount !== null
                          ? count(sessionsCount)
                          : `${metricCountries.length} regions`}
                    </span>
                  </div>
                </div>
                {botHubStats.botCityCount > 0 && (
                  <div className="mt-2 flex items-center justify-between border-t border-brand-200/50 pt-2 text-[10px]">
                    <span className="inline-flex items-center gap-1 font-medium text-warning-700">
                      <Bot className="h-3 w-3" />
                      {botHubStats.botCityCount} cloud hubs ({count(botHubStats.botSessions)})
                    </span>
                    <button
                      type="button"
                      onClick={() => setHideBotHubs((prev) => !prev)}
                      className="font-semibold text-primary-700 hover:underline cursor-pointer"
                    >
                      {hideBotHubs ? "Show all" : "Filter out"}
                    </button>
                  </div>
                )}
              </div>

              {/* Left Card 3: Segmented Traffic Mix / Country City Split Card */}
              <div className="globe-glass hidden rounded-2xl px-4 py-3.5 lg:block">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-brand-950">{segmentedMix.title}</span>
                  <span className="text-[10px] text-brand-400">last {periodDays} days</span>
                </div>
                {segmentedMix.items.length > 0 ? (
                  <div
                    className={cn(
                      "mt-3 grid gap-1.5",
                      segmentedMix.items.length <= 2 ? "grid-cols-2" : "grid-cols-4",
                    )}
                  >
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

            {/* TOP-CENTER METRIC SWITCHER PILL (Visitors | Clicks | Impressions) */}
            <div
              role="tablist"
              aria-label="Globe traffic metric"
              className="globe-glass-pill pointer-events-auto hidden items-center gap-1 rounded-2xl p-1 xl:inline-flex"
            >
              {(
                [
                  { id: "visitors", label: "Visitors", icon: Users, disabled: false },
                  { id: "clicks", label: "Clicks", icon: MousePointerClick, disabled: !hasGscCountryMetrics },
                  { id: "impressions", label: "Impressions", icon: Eye, disabled: !hasGscCountryMetrics },
                ] as const
              ).map((m) => {
                const Icon = m.icon;
                const active = metricMode === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    disabled={m.disabled}
                    title={m.disabled ? "Connect Search Console for per-country search metrics" : `Color & size map by ${m.label}`}
                    onClick={() => {
                      setMetricMode(m.id);
                      setPinLayer("countries");
                      setRightTab("countries");
                    }}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[11.5px] font-semibold transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed",
                      active
                        ? "bg-brand-950 text-brand-50 shadow-xs"
                        : "text-brand-600 hover:text-brand-950",
                    )}
                  >
                    <Icon className="h-3 w-3" />
                    <span>{m.label}</span>
                  </button>
                );
              })}
            </div>

            {/* RIGHT FLOATING STACK */}
            <div className="pointer-events-auto flex flex-col items-end gap-3 lg:w-[314px] xl:w-[334px]">
              {/* Top-right action buttons (PNG Snapshot + CSV Export + Report + Fullscreen) */}
              <div className="flex items-center gap-1.5">
                {viewMode !== "map" && (
                  <button
                    type="button"
                    onClick={handleSnapshotDownload}
                    title="Download presentation PNG snapshot"
                    aria-label="Download PNG snapshot"
                    className="globe-glass-pill inline-flex h-9 w-9 items-center justify-center rounded-2xl text-brand-700 transition hover:text-brand-950 cursor-pointer"
                  >
                    <Camera className="h-3.5 w-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => buildCsvAndDownload(metricCountries, filteredCities, periodDays)}
                  disabled={metricCountries.length === 0 && filteredCities.length === 0}
                  className="globe-glass-pill inline-flex items-center gap-1.5 rounded-2xl px-3 py-2 text-xs font-semibold text-brand-800 transition hover:text-brand-950 disabled:opacity-45 cursor-pointer"
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
                  <span className="hidden sm:inline">Report</span>
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

              {/* Right Main Tabbed Panel (Countries / Cities / Live 30m) + Instant Search */}
              <div className="globe-glass hidden w-full flex-col rounded-2xl p-3.5 lg:flex">
                {/* Segmented Pill Tabs */}
                <div className="grid grid-cols-3 gap-1 rounded-xl bg-brand-100/75 p-1 text-[11px] font-semibold">
                  {(
                    [
                      { id: "countries", label: "Countries" },
                      { id: "cities", label: "Cities" },
                      { id: "live", label: "Live 30m" },
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

                {/* Instant Search Filter + Bot Filter Row */}
                <div className="mt-2.5 flex items-center gap-1.5">
                  <form onSubmit={handleSearchSubmit} className="relative flex-1">
                    <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3 w-3 -translate-y-1/2 text-brand-400" />
                    <input
                      type="search"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={rightTab === "cities" ? "Find city & press Enter…" : "Find country & press Enter…"}
                      aria-label="Filter regions on globe"
                      className="w-full rounded-xl border border-brand-200/70 bg-surface-1/80 py-1.5 pr-6 pl-7 text-[11px] text-brand-950 placeholder:text-brand-400 focus:border-primary-500 focus:outline-none"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery("")}
                        aria-label="Clear search"
                        className="absolute top-1/2 right-2 -translate-y-1/2 text-brand-400 hover:text-brand-950 cursor-pointer"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </form>

                  {rightTab === "cities" && botHubStats.botCityCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setHideBotHubs((prev) => !prev)}
                      title={hideBotHubs ? "Showing non-datacenter cities only. Click to show all." : "Hide known cloud/bot datacenter hubs"}
                      className={cn(
                        "inline-flex shrink-0 items-center gap-1 rounded-xl border px-2 py-1.5 text-[10px] font-bold transition cursor-pointer",
                        hideBotHubs
                          ? "border-success-500/40 bg-success-50 text-success-700"
                          : "border-warning-500/40 bg-warning-50 text-warning-700",
                      )}
                    >
                      {hideBotHubs ? <ShieldCheck className="h-3 w-3" /> : <Bot className="h-3 w-3" />}
                      <span>{hideBotHubs ? "Human" : `${botHubStats.botCityCount} Bots`}</span>
                    </button>
                  )}
                </div>

                {/* Tab Content Feed */}
                <div className="mt-2 max-h-[305px] divide-y divide-brand-200/50 overflow-y-auto pr-0.5">
                  {rightTab === "countries" && (
                    displayedCountries.length > 0 ? (
                      displayedCountries.map((row) => {
                        const pinId = `country:${row.code}`;
                        const active = selectedPinId === pinId || hoveredPinId === pinId || selectedCountryCode === row.code;
                        const liveHere = realtimeByCountryCode.get(row.code) ?? 0;
                        return (
                          <button
                            key={`${row.code}-${row.country}`}
                            type="button"
                            onClick={() => {
                              setPinLayer("countries");
                              setSelectedCountryCode(row.code);
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
                        {normalizedQuery
                          ? `No countries match "${searchQuery}".`
                          : "No country-level traffic recorded in this period yet."}
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
                                {row.botHubReason && (
                                  <span
                                    title={row.botHubReason}
                                    className="inline-flex shrink-0 items-center rounded-full bg-warning-50 px-1.5 py-0.5 text-[9px] font-bold text-warning-700"
                                  >
                                    Bot
                                  </span>
                                )}
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
                                  className={cn(
                                    "absolute left-0 h-[3px] rounded-full",
                                    row.botHubReason ? "bg-warning-500" : "bg-accent-500",
                                  )}
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
                          {normalizedQuery
                            ? `No cities match "${searchQuery}"`
                            : hideBotHubs && cities.length > 0
                              ? "All recorded cities were flagged as cloud/bot hubs"
                              : "No city visitors recorded yet"}
                        </p>
                        {hideBotHubs && cities.length > 0 ? (
                          <button
                            type="button"
                            onClick={() => setHideBotHubs(false)}
                            className="mt-2.5 rounded-full bg-brand-950 px-3 py-1 text-[11px] font-semibold text-brand-50 hover:bg-brand-800 cursor-pointer"
                          >
                            Show All Cities
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={onOpenReport}
                            className="mt-2.5 rounded-full bg-brand-950 px-3 py-1 text-[11px] font-semibold text-brand-50 hover:bg-brand-800 cursor-pointer"
                          >
                            Plan Target Cities →
                          </button>
                        )}
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
                                setSelectedCountryCode(row.code);
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
                            Active in last 30 min · no country rows matched
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
                {((rightTab === "countries" && searchedCountries.length > 7) ||
                  (rightTab === "cities" && searchedCities.length > 7)) && (
                  <button
                    type="button"
                    onClick={() => setShowAllRows((prev) => !prev)}
                    className="mt-2 border-t border-brand-200/50 pt-2 text-center text-[11px] font-semibold text-brand-500 transition hover:text-brand-950 cursor-pointer"
                  >
                    {showAllRows
                      ? "Show Top 7"
                      : `See All (${rightTab === "countries" ? searchedCountries.length : searchedCities.length})`}
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
                  <p className="text-[11.5px] font-bold text-brand-950">
                    {selectedCountry ? `${selectedCountry.flag} ${selectedCountry.country}` : "Global Traffic"}
                  </p>
                  <p className="text-[10px] text-brand-500">
                    {metricCountries.length} {metricCountries.length === 1 ? "country" : "countries"} · {filteredCities.length} {filteredCities.length === 1 ? "city" : "cities"}
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
                        <span
                          className={cn(
                            "flex h-5 w-5 items-center justify-center rounded-full",
                            city.botHubReason
                              ? "bg-warning-500 text-surface-1"
                              : "bg-brand-950 text-brand-50",
                          )}
                        >
                          {city.botHubReason ? <Bot className="h-2.5 w-2.5" /> : <MapPin className="h-2.5 w-2.5" />}
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
                          {city.flag} {count(city.count)} {city.botHubReason ? "· bot hub" : "visitors"}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Fullscreen close helper on small screens */}
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
                <span>Top Countries ({metricMeta.short})</span>
              </h3>
              <span className="font-mono text-[11px] text-brand-500">{metricCountries.length} total</span>
            </div>
            <div className="mt-3 space-y-2">
              {metricCountries.length > 0 ? (
                metricCountries.slice(0, 5).map((row) => (
                  <button
                    key={row.code}
                    type="button"
                    onClick={() => {
                      setPinLayer("countries");
                      setSelectedCountryCode(row.code);
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
              {botHubStats.botCityCount > 0 ? (
                <button
                  type="button"
                  onClick={() => setHideBotHubs((prev) => !prev)}
                  className="text-[11px] font-semibold text-primary-700 underline"
                >
                  {hideBotHubs ? "Show bots" : `Hide ${botHubStats.botCityCount} bots`}
                </button>
              ) : (
                <span className="font-mono text-[11px] text-brand-500">{filteredCities.length} total</span>
              )}
            </div>
            <div className="mt-3 space-y-2">
              {filteredCities.length > 0 ? (
                filteredCities.slice(0, 5).map((row, idx) => (
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
                    <span className="flex items-center gap-1.5 font-semibold text-brand-950">
                      <span>#{idx + 1} {row.city}</span>
                      {row.botHubReason && (
                        <span className="rounded bg-warning-50 px-1 py-0.5 text-[9px] font-bold text-warning-700">
                          Bot
                        </span>
                      )}
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
