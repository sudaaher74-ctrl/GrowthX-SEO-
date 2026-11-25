"use client";

import React from "react";

/**
 * Shared minimal chart geometry & tooltip tokens so every chart across Reigel
 * (Monthly Report, Traffic, GA4, Website Audit Speed, Page Detail, Fix Engine)
 * shares one calm, executive visual language.
 */
export const CHART_GRID_PROPS = {
  stroke: "var(--color-brand-100)",
  strokeDasharray: "2 4",
  vertical: false,
} as const;

export const CHART_AXIS_TICK = {
  fontSize: 11,
  fill: "var(--color-brand-400)",
} as const;

export const CHART_CURSOR_LINE = {
  stroke: "var(--color-brand-300)",
  strokeWidth: 1,
  strokeDasharray: "3 3",
} as const;

export const CHART_CURSOR_BAR = {
  fill: "var(--color-brand-100)",
  fillOpacity: 0.45,
} as const;

export interface ChartTooltipRow {
  label: string;
  value: string;
  color: string;
  shape?: "dot" | "bar" | "dash";
}

export function ChartTooltipCard({
  title,
  rows,
  footer,
}: {
  title: string;
  rows: ChartTooltipRow[];
  footer?: { label: string; value: string } | null;
}) {
  return (
    <div className="rounded-xl border border-brand-200/90 bg-surface-1 px-3 py-2.5 shadow-md">
      <p className="text-[11px] font-medium text-brand-500">{title}</p>
      <div className="mt-1.5 space-y-1 text-xs">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-5">
            <span className="flex items-center gap-1.5 text-brand-600">
              {row.shape === "dash" ? (
                <span className="h-0.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: row.color }} />
              ) : row.shape === "bar" ? (
                <span className="h-2 w-2 rounded-xs shrink-0" style={{ backgroundColor: row.color }} />
              ) : (
                <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: row.color }} />
              )}
              {row.label}
            </span>
            <span className="font-mono font-semibold text-brand-950 tabular-nums">{row.value}</span>
          </div>
        ))}
        {footer && (
          <div className="flex items-center justify-between gap-5 border-t border-brand-100 pt-1 text-[11px] text-brand-400">
            <span>{footer.label}</span>
            <span className="font-mono text-brand-700 tabular-nums">{footer.value}</span>
          </div>
        )}
      </div>
    </div>
  );
}
