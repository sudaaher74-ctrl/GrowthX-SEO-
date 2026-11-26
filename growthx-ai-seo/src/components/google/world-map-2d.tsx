"use client";

import { useMemo } from "react";
import { geoNaturalEarth1, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import countriesAtlas from "world-atlas/countries-110m.json";
import { ISO_NUMERIC_TO_CODE } from "@/lib/geo-coordinates";
import { count, percent } from "@/lib/google-format";
import { cn } from "@/lib/utils";
import type { GlobePin } from "./earth-globe-canvas";

interface WorldMap2DProps {
  pins: GlobePin[];
  activeCountryCodes: Set<string>;
  selectedPinId: string | null;
  hoveredPinId: string | null;
  onSelectPin: (pin: GlobePin) => void;
  onHoverPin: (id: string | null) => void;
}

const WIDTH = 960;
const HEIGHT = 500;

export function WorldMap2D({
  pins,
  activeCountryCodes,
  selectedPinId,
  hoveredPinId,
  onSelectPin,
  onHoverPin,
}: WorldMap2DProps) {
  const { projection, countryShapes } = useMemo(() => {
    const proj = geoNaturalEarth1()
      .scale(178)
      .translate([WIDTH / 2, HEIGHT / 2 + 16]);
    const pathGen = geoPath(proj);

    type AtlasTopology = Parameters<typeof feature>[0];
    type AtlasGeometry = Parameters<typeof feature>[1];
    const topo = countriesAtlas as unknown as AtlasTopology & {
      objects: { countries: AtlasGeometry };
    };
    const result = feature(topo, topo.objects.countries);
    const features = "features" in result ? result.features : [];

    const shapes = features.map((f, idx) => {
      const numericId = String(f.id ?? idx).padStart(3, "0");
      const code = ISO_NUMERIC_TO_CODE.get(numericId) ?? ISO_NUMERIC_TO_CODE.get(String(f.id ?? "")) ?? "";
      return {
        key: `${numericId}-${idx}`,
        code,
        d: pathGen(f) ?? "",
      };
    });

    return { projection: proj, countryShapes: shapes };
  }, []);

  const selectedPin = pins.find((p) => p.id === selectedPinId) ?? null;
  const hoveredPin = pins.find((p) => p.id === hoveredPinId) ?? null;
  const activeCalloutPin = hoveredPin ?? selectedPin;

  return (
    <div className="relative flex h-full w-full items-center justify-center px-4 py-14 sm:px-10">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="h-auto max-h-full w-full max-w-[920px]"
        role="img"
        aria-label="Interactive 2D world map of visitor distribution"
      >
        {/* Subtle latitude/longitude graticule arcs */}
        <g opacity={0.18} stroke="currentColor" strokeWidth={0.6} className="text-brand-400">
          <line x1={40} y1={HEIGHT / 2 + 16} x2={WIDTH - 40} y2={HEIGHT / 2 + 16} strokeDasharray="3 5" />
          <line x1={WIDTH / 2} y1={42} x2={WIDTH / 2} y2={HEIGHT - 24} strokeDasharray="3 5" />
        </g>

        {/* Detailed Natural Earth country shapes */}
        <g>
          {countryShapes.map((shape) => {
            if (!shape.d) return null;
            const isSelectedCountry = selectedPin && selectedPin.code === shape.code;
            const hasTraffic = shape.code ? activeCountryCodes.has(shape.code) : false;
            return (
              <path
                key={shape.key}
                d={shape.d}
                className={cn(
                  "globe-2d-land",
                  hasTraffic ? "globe-2d-land-active" : "",
                  isSelectedCountry ? "globe-2d-land-selected" : "",
                )}
              />
            );
          })}
        </g>

        {/* Glowing location pins */}
        <g>
          {pins.map((pin) => {
            const pt = projection([pin.lng, pin.lat]);
            if (!pt) return null;
            const [cx, cy] = pt;
            const active = selectedPinId === pin.id || hoveredPinId === pin.id;
            const isLive = (pin.liveUsers ?? 0) > 0;
            const outerR = active ? 15 : pin.share > 0.3 ? 12 : 9.5;
            return (
              <g
                key={pin.id}
                transform={`translate(${cx}, ${cy})`}
                className="cursor-pointer"
                onClick={() => onSelectPin(pin)}
                onMouseEnter={() => onHoverPin(pin.id)}
                onMouseLeave={() => onHoverPin(null)}
              >
                <circle
                  r={outerR}
                  fill="var(--color-surface-1)"
                  fillOpacity={active ? 0.58 : 0.36}
                  stroke={isLive ? "var(--color-success-500)" : "var(--color-surface-1)"}
                  strokeWidth={active ? 2 : 1.4}
                />
                <circle
                  r={active ? 5 : 4}
                  fill={isLive ? "var(--color-success-500)" : "var(--color-primary-600)"}
                  stroke="var(--color-surface-1)"
                  strokeWidth={1.5}
                />
              </g>
            );
          })}
        </g>
      </svg>

      {activeCalloutPin && (
        <div className="globe-glass-pill pointer-events-none absolute top-16 left-1/2 -translate-x-1/2 rounded-xl px-3 py-1.5 text-xs text-brand-950">
          <span className="font-semibold">
            {activeCalloutPin.flag} {activeCalloutPin.label}
          </span>
          <span className="ml-2 font-mono text-[11px] text-brand-500">
            {count(activeCalloutPin.visitors)} visitors · {percent(activeCalloutPin.share)}
          </span>
        </div>
      )}
    </div>
  );
}
