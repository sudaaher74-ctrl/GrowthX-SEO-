"use client";

import React, { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

export interface DonutSlice {
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
  size = 110,
  thickness = 16,
  className,
  showLegend = true,
  legendPosition = "right",
  emptyText = "No data available",
}: DonutChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const total = useMemo(() => {
    return data.reduce((sum, item) => sum + (item.value || 0), 0);
  }, [data]);

  const slices = useMemo(() => {
    if (total === 0) return [];
    const radius = (size - thickness) / 2;
    const circumference = 2 * Math.PI * radius;
    let accumulatedAngle = 0;

    return data.map((item, index) => {
      const percentage = total > 0 ? (item.value / total) * 100 : 0;
      const strokeDasharray = `${(percentage / 100) * circumference} ${circumference}`;
      const strokeDashoffset = -((accumulatedAngle / 100) * circumference);
      accumulatedAngle += percentage;

      return {
        ...item,
        percentage,
        strokeDasharray,
        strokeDashoffset,
        radius,
      };
    });
  }, [data, total, size, thickness]);

  const radius = (size - thickness) / 2;
  const center = size / 2;

  if (total === 0) {
    return (
      <div className={cn("flex flex-col items-center justify-center p-3 text-center w-full", className)}>
        <div
          className="relative flex items-center justify-center rounded-full border-3 border-dashed border-slate-200 dark:border-slate-800"
          style={{ width: size, height: size }}
        >
          <span className="text-[11px] text-slate-400 font-medium px-2">{emptyText}</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center gap-3 w-full min-w-0",
        legendPosition === "bottom" ? "flex-col" : "flex-row justify-between",
        className
      )}
    >
      {/* Donut graphic */}
      <div className="relative shrink-0 flex items-center justify-center" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="-rotate-90 transform"
        >
          {/* Base background circle */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="currentColor"
            className="text-slate-100 dark:text-slate-800"
            strokeWidth={thickness}
          />
          {/* Slices */}
          {slices.map((slice, i) => {
            const isHovered = hoveredIndex === i;
            return (
              <circle
                key={slice.label}
                cx={center}
                cy={center}
                r={radius}
                fill="none"
                stroke={slice.color}
                strokeWidth={isHovered ? thickness + 2 : thickness}
                strokeDasharray={slice.strokeDasharray}
                strokeDashoffset={slice.strokeDashoffset}
                strokeLinecap="round"
                className="transition-all duration-200 cursor-pointer"
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
              />
            );
          })}
        </svg>

        {/* Center label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-1">
          <span
            className={cn(
              "font-bold text-slate-900 dark:text-white leading-none tracking-tight",
              size >= 120 ? "text-xl" : size >= 95 ? "text-lg" : "text-sm"
            )}
          >
            {centerValue !== undefined ? centerValue : total}
          </span>
          {centerLabel && (
            <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 mt-0.5 truncate max-w-[80%]">
              {centerLabel}
            </span>
          )}
        </div>
      </div>

      {/* Legend */}
      {showLegend && (
        <div
          className={cn(
            "min-w-0 flex-1",
            legendPosition === "bottom"
              ? "grid grid-cols-2 gap-x-2 gap-y-1 w-full mt-2"
              : "flex flex-col gap-1 w-full"
          )}
        >
          {data.map((item, i) => {
            const pct = total > 0 ? Math.round((item.value / total) * 100) : 0;
            const isHovered = hoveredIndex === i;
            return (
              <div
                key={item.label}
                className={cn(
                  "flex items-center justify-between text-xs py-0.5 px-1 rounded transition-colors cursor-pointer min-w-0 gap-1",
                  isHovered ? "bg-slate-100 dark:bg-slate-800 font-semibold" : "text-slate-600 dark:text-slate-300"
                )}
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  <span
                    className="h-2 w-2 rounded-full shrink-0"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="truncate text-[11px]">{item.label}</span>
                </div>
                <div className="flex items-center gap-1 font-mono text-[11px] shrink-0 ml-1">
                  <span className="font-semibold text-slate-900 dark:text-white">{item.value}</span>
                  <span className="text-slate-400 text-[10px]">({pct}%)</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
