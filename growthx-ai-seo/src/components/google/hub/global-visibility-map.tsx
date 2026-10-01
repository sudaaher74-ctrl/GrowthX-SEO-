"use client";

import { useMemo, useState } from "react";
import { Compass, Eye, Globe, ChevronRight, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export interface VisibilityLocation {
  code: string;
  name: string;
  flag: string;
  x: number;
  y: number;
  sharePct: number;
  impressions: number;
  clicks: number;
  position: string;
  status: string;
}

const COUNTRY_GEO: Record<string, { name: string; flag: string; x: number; y: number; defaultStatus: string }> = {
  ind: { name: "India", flag: "🇮🇳", x: 64, y: 53, defaultStatus: "Primary Market" },
  in: { name: "India", flag: "🇮🇳", x: 64, y: 53, defaultStatus: "Primary Market" },
  usa: { name: "United States", flag: "🇺🇸", x: 23, y: 38, defaultStatus: "High Growth" },
  us: { name: "United States", flag: "🇺🇸", x: 23, y: 38, defaultStatus: "High Growth" },
  gbr: { name: "United Kingdom", flag: "🇬🇧", x: 47, y: 28, defaultStatus: "Active Reach" },
  gb: { name: "United Kingdom", flag: "🇬🇧", x: 47, y: 28, defaultStatus: "Active Reach" },
  are: { name: "UAE", flag: "🇦🇪", x: 57, y: 47, defaultStatus: "Emerging" },
  ae: { name: "UAE", flag: "🇦🇪", x: 57, y: 47, defaultStatus: "Emerging" },
  can: { name: "Canada", flag: "🇨🇦", x: 21, y: 27, defaultStatus: "Active Reach" },
  aus: { name: "Australia", flag: "🇦🇺", x: 84, y: 77, defaultStatus: "Emerging" },
  deu: { name: "Germany", flag: "🇩🇪", x: 49, y: 31, defaultStatus: "Active Reach" },
  sgp: { name: "Singapore", flag: "🇸🇬", x: 74, y: 58, defaultStatus: "Emerging" },
};

const BASELINE_LOCATIONS: VisibilityLocation[] = [
  { code: "ind", name: "India", flag: "🇮🇳", x: 64, y: 53, sharePct: 78.4, impressions: 12, clicks: 2, position: "1.4", status: "Primary Market" },
  { code: "usa", name: "United States", flag: "🇺🇸", x: 23, y: 38, sharePct: 13.3, impressions: 2, clicks: 0, position: "3.2", status: "High Growth" },
  { code: "gbr", name: "United Kingdom", flag: "🇬🇧", x: 47, y: 28, sharePct: 4.8, impressions: 1, clicks: 0, position: "4.0", status: "Active Reach" },
  { code: "are", name: "UAE", flag: "🇦🇪", x: 57, y: 47, sharePct: 3.5, impressions: 1, clicks: 0, position: "2.8", status: "Emerging" },
];

export interface GlobalVisibilityMapProps {
  domain: string;
  days: number;
  countryRows?: Array<{ key: string; impressions?: number; clicks?: number; position: number }> | null;
  gscImpressions: number;
  gscPosition: number;
}

export function GlobalVisibilityMap({
  domain,
  days,
  countryRows = [],
  gscImpressions,
  gscPosition,
}: GlobalVisibilityMapProps) {
  const [mapTab, setMapTab] = useState<"map" | "regions">("map");
  const [selectedCode, setSelectedCode] = useState<string>("ind");

  const locations: VisibilityLocation[] = useMemo(() => {
    const rows = countryRows ?? [];
    if (rows.length > 0) {
      const totalImpr = rows.reduce((sum, r) => sum + (r.impressions || 0), 0) || 1;
      return rows.slice(0, 6).map((r, idx) => {
        const code = r.key.toLowerCase();
        const geo = COUNTRY_GEO[code] || {
          name: r.key.toUpperCase(),
          flag: "🌐",
          x: 35 + ((idx * 17) % 45),
          y: 30 + ((idx * 13) % 35),
          defaultStatus: idx === 0 ? "Primary Market" : "Active Reach",
        };
        const share = Math.round(((r.impressions || 0) / totalImpr) * 1000) / 10;
        return {
          code,
          name: geo.name,
          flag: geo.flag,
          x: geo.x,
          y: geo.y,
          sharePct: share,
          impressions: r.impressions || 0,
          clicks: r.clicks || 0,
          position: r.position.toFixed(1),
          status: geo.defaultStatus,
        };
      });
    }
    return BASELINE_LOCATIONS;
  }, [countryRows]);

  const selectedLoc = useMemo(() => {
    return locations.find((l) => l.code === selectedCode) || locations[0] || BASELINE_LOCATIONS[0];
  }, [locations, selectedCode]);

  return (
    <div className="lg:col-span-6 flex flex-col justify-between rounded-2xl border border-brand-200/50 bg-brand-50/50 p-4 shadow-card backdrop-blur-md">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-1.5">
            <Globe className="text-signal-400" size={17} />
            <h2 className="text-[17px] font-bold tracking-tight text-brand-950">
              Global Visibility
            </h2>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs font-medium text-brand-400 truncate max-w-[160px]">
              {domain}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-success-500/10 px-2 py-0.5 text-[11px] font-bold text-success-500">
              <span className="h-1.5 w-1.5 rounded-full bg-success-500 animate-pulse" />
              Active Reach
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <div className="inline-flex items-center rounded-full bg-brand-100 p-0.5 text-[10.5px]">
            <button
              type="button"
              onClick={() => setMapTab("map")}
              className={cn(
                "rounded-full px-2 py-0.5 font-semibold transition-colors",
                mapTab === "map"
                  ? "bg-signal-400 text-signal-ink font-bold shadow-xs"
                  : "text-brand-400 hover:text-brand-950",
              )}
            >
              Map
            </button>
            <button
              type="button"
              onClick={() => setMapTab("regions")}
              className={cn(
                "rounded-full px-2 py-0.5 font-semibold transition-colors",
                mapTab === "regions"
                  ? "bg-signal-400 text-signal-ink font-bold shadow-xs"
                  : "text-brand-400 hover:text-brand-950",
              )}
            >
              Regions
            </button>
          </div>

          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-full border border-brand-200/60 bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-400 hover:text-brand-950 transition"
          >
            <span>{days}d</span>
            <ChevronRight size={11} />
          </button>
        </div>
      </div>

      {/* Interactive World Map or Regions List */}
      {mapTab === "map" ? (
        <div className="relative my-3 h-36 w-full overflow-hidden rounded-xl border border-brand-200/40 bg-brand-100/30">
          {/* World Map Vector SVG */}
          <svg
            className="absolute inset-0 h-full w-full"
            viewBox="0 0 800 380"
            preserveAspectRatio="xMidYMid meet"
            aria-label="Global customer visibility map"
          >
            <defs>
              <pattern id="global-map-grid-dots" width="14" height="14" patternUnits="userSpaceOnUse">
                <circle cx="2" cy="2" r="0.8" fill="currentColor" className="text-brand-400/20" />
              </pattern>
            </defs>

            {/* Dot matrix background */}
            <rect width="100%" height="100%" fill="url(#global-map-grid-dots)" />

            {/* Latitude & Longitude Guides */}
            <path d="M 0 100 Q 400 120 800 100" fill="none" stroke="currentColor" strokeWidth="0.75" className="text-brand-300/15" />
            <path d="M 0 190 Q 400 205 800 190" fill="none" stroke="currentColor" strokeWidth="0.75" className="text-brand-300/20" strokeDasharray="3 3" />
            <path d="M 0 280 Q 400 260 800 280" fill="none" stroke="currentColor" strokeWidth="0.75" className="text-brand-300/15" />
            <path d="M 260 0 Q 275 190 260 380" fill="none" stroke="currentColor" strokeWidth="0.75" className="text-brand-300/10" />
            <path d="M 530 0 Q 515 190 530 380" fill="none" stroke="currentColor" strokeWidth="0.75" className="text-brand-300/10" />

            {/* Continent Outlines */}
            {/* North America */}
            <path
              d="M 90,65 L 125,50 L 160,52 L 195,68 L 220,55 L 205,85 L 180,95 L 190,120 L 165,135 L 155,160 L 140,150 L 132,170 L 122,152 L 105,138 L 78,122 L 85,85 Z"
              fill="currentColor"
              className="text-brand-200/35"
              stroke="currentColor"
              strokeWidth="1.2"
            />
            {/* Greenland */}
            <path
              d="M 228,32 L 255,26 L 270,48 L 242,65 L 228,48 Z"
              fill="currentColor"
              className="text-brand-200/25"
              stroke="currentColor"
              strokeWidth="0.8"
            />
            {/* South America */}
            <path
              d="M 172,175 L 198,170 L 230,198 L 240,235 L 225,282 L 196,315 L 182,282 L 168,225 L 162,188 Z"
              fill="currentColor"
              className="text-brand-200/35"
              stroke="currentColor"
              strokeWidth="1.2"
            />
            {/* Europe */}
            <path
              d="M 345,68 L 375,58 L 412,62 L 430,85 L 420,108 L 392,118 L 358,110 L 345,86 Z"
              fill="currentColor"
              className="text-brand-200/35"
              stroke="currentColor"
              strokeWidth="1.2"
            />
            {/* British Isles */}
            <path
              d="M 330,76 L 344,72 L 340,94 L 326,94 Z"
              fill="currentColor"
              className="text-brand-200/35"
              stroke="currentColor"
              strokeWidth="1"
            />
            {/* Africa */}
            <path
              d="M 352,128 L 415,122 L 442,165 L 438,222 L 410,278 L 386,288 L 368,252 L 344,185 L 338,148 Z"
              fill="currentColor"
              className="text-brand-200/35"
              stroke="currentColor"
              strokeWidth="1.2"
            />
            {/* Madagascar */}
            <path
              d="M 448,232 L 458,236 L 452,260 L 444,256 Z"
              fill="currentColor"
              className="text-brand-200/25"
              stroke="currentColor"
              strokeWidth="0.8"
            />
            {/* Asia */}
            <path
              d="M 420,62 L 505,52 L 580,58 L 650,85 L 660,122 L 622,132 L 592,168 L 550,160 L 530,182 L 506,206 L 492,170 L 464,160 L 450,124 L 420,110 Z"
              fill="currentColor"
              className="text-brand-200/35"
              stroke="currentColor"
              strokeWidth="1.2"
            />
            {/* India Peninsula */}
            <path
              d="M 492,170 L 530,175 L 522,226 L 508,236 L 496,208 Z"
              fill="currentColor"
              className="text-brand-200/45"
              stroke="currentColor"
              strokeWidth="1.2"
            />
            {/* Japan */}
            <path
              d="M 662,108 L 676,112 L 668,134 L 658,126 Z"
              fill="currentColor"
              className="text-brand-200/30"
              stroke="currentColor"
              strokeWidth="0.8"
            />
            {/* Southeast Asia */}
            <path
              d="M 552,216 L 600,220 L 624,244 L 582,248 Z"
              fill="currentColor"
              className="text-brand-200/30"
              stroke="currentColor"
              strokeWidth="0.8"
            />
            {/* Australia */}
            <path
              d="M 610,260 L 678,255 L 692,298 L 664,330 L 616,322 L 600,288 Z"
              fill="currentColor"
              className="text-brand-200/35"
              stroke="currentColor"
              strokeWidth="1.2"
            />
            {/* New Zealand */}
            <path
              d="M 706,322 L 716,326 L 710,344 L 702,340 Z"
              fill="currentColor"
              className="text-brand-200/25"
              stroke="currentColor"
              strokeWidth="0.8"
            />

            {/* Signal broadcast arcs from India primary hub */}
            <path
              d="M 510,200 Q 320,110 180,105"
              fill="none"
              stroke="var(--color-signal-400)"
              strokeWidth="1.2"
              strokeDasharray="4 4"
              opacity="0.45"
              className="animate-pulse"
            />
            <path
              d="M 510,200 Q 430,130 338,84"
              fill="none"
              stroke="var(--color-signal-400)"
              strokeWidth="1.2"
              strokeDasharray="3 3"
              opacity="0.55"
              className="animate-pulse"
            />
            <path
              d="M 510,200 Q 480,185 455,178"
              fill="none"
              stroke="var(--color-signal-400)"
              strokeWidth="1.4"
              strokeDasharray="2 2"
              opacity="0.75"
            />
          </svg>

          {/* Geographic Hotspot Pins */}
          {locations.map((loc) => {
            const isSelected = selectedLoc.code === loc.code;
            return (
              <button
                key={loc.code}
                type="button"
                onClick={() => setSelectedCode(loc.code)}
                style={{ left: `${loc.x}%`, top: `${loc.y}%` }}
                className="group absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer focus:outline-hidden"
                title={`${loc.name}: ${loc.sharePct}% visibility share`}
              >
                <span className="relative flex items-center justify-center">
                  <span
                    className={cn(
                      "absolute -inset-2 rounded-full bg-signal-400 opacity-60",
                      isSelected ? "animate-ping" : "animate-pulse",
                    )}
                  />
                  <span
                    className={cn(
                      "relative block rounded-full border-2 border-surface-1 shadow-md transition-transform duration-200 group-hover:scale-125",
                      isSelected
                        ? "h-3.5 w-3.5 bg-signal-400 ring-2 ring-signal-400/50"
                        : "h-2.5 w-2.5 bg-signal-400",
                    )}
                  />
                </span>
              </button>
            );
          })}

          {/* Floating Radar HUD on bottom right */}
          <div className="absolute right-2 bottom-2 rounded-lg border border-brand-200/80 bg-surface-1/95 px-2.5 py-1.5 shadow-lg backdrop-blur-md text-[10.5px] max-w-[170px]">
            <div className="flex items-center gap-1.5 font-bold text-brand-950">
              <span className="text-sm leading-none">{selectedLoc.flag}</span>
              <span className="truncate">{selectedLoc.name}</span>
              <span className="ml-auto rounded-full bg-signal-400/20 px-1.5 py-0.2 font-mono text-[9.5px] font-bold text-signal-400">
                {selectedLoc.sharePct}%
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between text-[10px] text-brand-400">
              <span>{selectedLoc.impressions} impr • {selectedLoc.clicks} clk</span>
              <span className="font-semibold text-success-500">{selectedLoc.status}</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="my-3 h-36 w-full overflow-y-auto space-y-1.5 pr-1 rounded-xl border border-brand-200/40 bg-brand-100/20 p-2">
          {locations.map((loc) => {
            const isSelected = selectedLoc.code === loc.code;
            return (
              <button
                key={loc.code}
                type="button"
                onClick={() => setSelectedCode(loc.code)}
                className={cn(
                  "w-full flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-[11px] transition-colors",
                  isSelected
                    ? "border border-signal-400/40 bg-brand-100/80 text-brand-950 shadow-xs"
                    : "border border-transparent hover:bg-brand-100/40 text-brand-400 hover:text-brand-950",
                )}
              >
                <div className="flex items-center gap-1.5 truncate">
                  <span className="text-sm">{loc.flag}</span>
                  <span className="font-semibold text-brand-950 truncate">{loc.name}</span>
                </div>
                <div className="flex items-center gap-2 font-mono text-[10.5px] shrink-0">
                  <span className="text-brand-400">{loc.impressions} impr</span>
                  <div className="h-1.5 w-12 overflow-hidden rounded-full bg-brand-200">
                    <div
                      className="h-full rounded-full bg-signal-400"
                      style={{ width: `${Math.min(100, loc.sharePct)}%` }}
                    />
                  </div>
                  <span className="font-bold text-brand-950 w-10 text-right">{loc.sharePct}%</span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* 4-Metric Grid */}
      <div className="grid grid-cols-4 gap-2 pt-1">
        <div className="rounded-xl border border-brand-200/40 bg-brand-50/60 p-2.5">
          <div className="flex items-center gap-1 text-[10.5px] font-semibold text-brand-400">
            <Globe size={12} className="text-signal-400" />
            <span>Markets</span>
          </div>
          <p className="mt-1 font-mono text-[16px] font-bold text-brand-950">{locations.length}</p>
          <p className="text-[10px] font-semibold text-success-500">Active</p>
        </div>

        <div className="rounded-xl border border-brand-200/40 bg-brand-50/60 p-2.5">
          <div className="flex items-center gap-1 text-[10.5px] font-semibold text-brand-400">
            <Eye size={12} className="text-signal-400" />
            <span>Impressions</span>
          </div>
          <p className="mt-1 font-mono text-[16px] font-bold text-brand-950">{gscImpressions}</p>
          <p className="text-[10px] font-semibold text-success-500">Global</p>
        </div>

        <div className="rounded-xl border border-brand-200/40 bg-brand-50/60 p-2.5">
          <div className="flex items-center gap-1 text-[10.5px] font-semibold text-brand-400">
            <Compass size={12} className="text-signal-400" />
            <span>Top Share</span>
          </div>
          <p className="mt-1 font-mono text-[16px] font-bold text-brand-950">
            {locations[0] ? `${locations[0].sharePct}%` : "78%"}
          </p>
          <p className="text-[10px] font-semibold text-brand-400 truncate">
            {locations[0]?.name ?? "India"}
          </p>
        </div>

        <div className="rounded-xl border border-brand-200/40 bg-brand-50/60 p-2.5">
          <div className="flex items-center gap-1 text-[10.5px] font-semibold text-brand-400">
            <Sparkles size={12} className="text-signal-400" />
            <span>Avg pos.</span>
          </div>
          <p className="mt-1 font-mono text-[16px] font-bold text-brand-950">
            {typeof gscPosition === "number" ? (gscPosition > 0 ? gscPosition.toFixed(1) : "-") : "1.5"}
          </p>
          <p className="text-[10px] font-semibold text-success-500">Rank #1</p>
        </div>
      </div>
    </div>
  );
}
