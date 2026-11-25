"use client";

import React, { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

interface DonutSlice {
  label: string;
  value: number;
  color: string;
}

interface DonutChartProps {
  data: DonutSlice[];
  centerValue?: string | number;
  centerLabel?: string;
  size?: number;
  thickness?: number;
  className?: string;
  showLegend?: boolean;
  legendPosition?: "right" | "bottom";
  emptyText?: string;
}

export function DonutChart({
  data,
  centerValue,
  centerLabel,
  size = 112,
  thickness = 14,
  className,
  showLegend = true,
  legendPosition = "right",
  emptyText = "No data",
}: DonutChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const total = useMemo(() => {
    return data.reduce((sum, item) => sum + (item.value || 0), 0);
  }, [data]);

  const nonZeroCount = useMemo(() => data.filter((d) => (d.value || 0) > 0).length, [data]);

  const slices = useMemo(() => {
    if (total === 0) return [];
    const radius = (size - thickness - 4) / 2;
    const circumference = 2 * Math.PI * radius;
    const gap = nonZeroCount > 1 ? 2.5 : 0;
    let accumulatedPct = 0;

    return data.map((item) => {
      const percentage = total > 0 ? (item.value / total) * 100 : 0;
      const rawArc = (percentage / 100) * circumference;
      const visibleArc = rawArc > gap ? rawArc - gap : rawArc;
      const strokeDasharray = `${visibleArc} ${circumference}`;
      const strokeDashoffset = -((accumulatedPct / 100) * circumference);
      accumulatedPct += percentage;

      return {
        ...item,
        percentage,
        strokeDasharray,
        strokeDashoffset,
        radius,
      };
    });
  }, [data, total, size, thickness, nonZeroCount]);

  const radius = (size - thickness - 4) / 2;
  const center = size / 2;
  const activeSlice = hoveredIndex != null ? slices[hoveredIndex] : null;

  if (total === 0) {
    return (
      <div className={cn("flex flex-col items-center justify-center p-3 text-center w-full", className)}>
        <div
          className="relative flex items-center justify-center rounded-full border-2 border-dashed border-brand-200 bg-brand-50/40"
          style={{ width: size, height: size }}
        >
          <span className="text-[11px] text-brand-400 font-medium px-2">{emptyText}</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center gap-4 w-full min-w-0",
        legendPosition === "bottom" ? "flex-col" : "flex-row justify-between",
        className,
      )}
    >
      {/* Crisp segmented circular ring */}
      <div className="relative shrink-0 flex items-center justify-center" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="-rotate-90 transform"
          role="img"
          aria-label={`${centerLabel || "Breakdown"}: ${centerValue ?? total}`}
        >
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="var(--color-brand-200)"
            strokeOpacity={0.45}
            strokeWidth={thickness}
          />
          {slices.map((slice, i) => {
            if (slice.value <= 0) return null;
            const isHovered = hoveredIndex === i;
            const isDimmed = hoveredIndex !== null && !isHovered;
            return (
              <circle
                key={slice.label}
                cx={center}
                cy={center}
                r={radius}
                fill="none"
                stroke={slice.color}
                strokeWidth={isHovered ? thickness + 2.5 : thickness}
                strokeOpacity={isDimmed ? 0.35 : 1}
                strokeDasharray={slice.strokeDasharray}
                strokeDashoffset={slice.strokeDashoffset}
                strokeLinecap="butt"
                className="transition-all duration-200 cursor-pointer"
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
              />
            );
          })}
        </svg>

        {/* Center label — updates cleanly when hovering a slice */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-2">
          <span
            className={cn(
              "font-mono font-bold text-brand-950 leading-none tracking-tight tabular-nums",
              size >= 120 ? "text-xl" : size >= 95 ? "text-lg" : "text-sm",
            )}
          >
            {activeSlice
              ? `${Math.round(activeSlice.percentage)}%`
              : centerValue !== undefined
                ? centerValue
                : total}
          </span>
          {(activeSlice?.label || centerLabel) && (
            <span className="text-[10px] font-medium text-brand-400 mt-1 truncate max-w-[78%]">
              {activeSlice ? activeSlice.label : centerLabel}
            </span>
          )}
        </div>
      </div>

      {/* Interactive Legend */}
      {showLegend && (
        <div
          className={cn(
            "min-w-0 flex-1",
            legendPosition === "bottom"
              ? "grid grid-cols-2 gap-x-3 gap-y-1.5 w-full mt-1"
              : "flex flex-col gap-1.5 w-full",
          )}
        >
          {data.map((item, i) => {
            const pct = total > 0 ? Math.round((item.value / total) * 100) : 0;
            const isHovered = hoveredIndex === i;
            return (
              <div
                key={item.label}
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
                className={cn(
                  "flex items-center justify-between gap-2 rounded-lg px-2 py-1 text-xs transition-colors cursor-pointer",
                  isHovered ? "bg-brand-100/70" : "hover:bg-brand-50",
                )}
              >
                <span className="flex items-center gap-2 min-w-0">
                  <span
                    className="h-2 w-2 rounded-full shrink-0"
                    style={{ backgroundColor: item.color }}
                    aria-hidden="true"
                  />
                  <span className="truncate font-medium text-brand-700">{item.label}</span>
                </span>
                <span className="shrink-0 font-mono text-[11px] font-semibold text-brand-950 tabular-nums">
                  {item.value.toLocaleString()}
                  <span className="ml-1 font-normal text-brand-400">({pct}%)</span>
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
