"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface CWVBenchmarkProps {
  icon?: React.ReactNode;
  title: string;
  value: string | number | null;
  unit?: string;
  fullName: string;
  status: "Good" | "Needs Work" | "Poor" | "Not Analyzed";
  goodThresholdText: string;
  needsWorkThresholdText: string;
  poorThresholdText: string;
  // Numeric values to position the indicator (0 to 100 percentage)
  positionPercent?: number;
  className?: string;
}

export function CWVBenchmarkCard({
  icon,
  title,
  value,
  unit,
  fullName,
  status,
  goodThresholdText,
  needsWorkThresholdText,
  poorThresholdText,
  positionPercent = 50,
  className,
}: CWVBenchmarkProps) {
  const statusColors = {
    Good: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/50",
    "Needs Work": "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/50",
    Poor: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800/50",
    "Not Analyzed": "bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-800",
  };

  const clampedPosition = Math.min(Math.max(positionPercent, 2), 98);

  return (
    <div
      className={cn(
        "flex flex-col justify-between rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900",
        className
      )}
    >
      {/* Top row: Icon + Label and Status Badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon && <span className="text-blue-600 dark:text-blue-400">{icon}</span>}
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {title}
          </span>
        </div>
        <span
          className={cn(
            "rounded-full border px-2.5 py-0.5 text-[11px] font-semibold",
            statusColors[status]
          )}
        >
          {status}
        </span>
      </div>

      {/* Main value */}
      <div className="my-3">
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            {value != null ? value : "—"}
          </span>
          {unit && value != null && (
            <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">{unit}</span>
          )}
        </div>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{fullName}</p>
      </div>

      {/* Benchmark scale bar */}
      <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
        <div className="relative mb-2">
          {/* Tri-color bar */}
          <div className="h-1.5 w-full overflow-hidden rounded-full flex">
            <div className="w-1/3 bg-emerald-500" />
            <div className="w-1/3 bg-amber-500" />
            <div className="w-1/3 bg-rose-500" />
          </div>

          {/* Indicator pin */}
          {value != null && (
            <div
              className="absolute -top-1 transform -translate-x-1/2 transition-all duration-500"
              style={{ left: `${clampedPosition}%` }}
            >
              <div className="h-3.5 w-1.5 rounded-full bg-slate-900 dark:bg-white shadow-xs border border-white dark:border-slate-900" />
            </div>
          )}
        </div>

        {/* Threshold descriptions */}
        <div className="grid grid-cols-3 text-[10px] text-slate-500 dark:text-slate-400">
          <span className="text-left text-emerald-600 dark:text-emerald-400 font-medium">
            {goodThresholdText}
          </span>
          <span className="text-center text-amber-600 dark:text-amber-400 font-medium">
            {needsWorkThresholdText}
          </span>
          <span className="text-right text-rose-600 dark:text-rose-400 font-medium">
            {poorThresholdText}
          </span>
        </div>
      </div>
    </div>
  );
}
