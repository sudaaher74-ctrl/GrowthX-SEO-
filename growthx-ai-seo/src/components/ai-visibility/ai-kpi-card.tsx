"use client";

import React from "react";
import { Info, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Panel } from "@/components/ui/console";

interface AiKpiCardProps {
  label: string;
  value: string | number;
  trend?: string;
  trendPositive?: boolean;
  subtext: string;
  icon: React.ReactNode;
  iconBgColor?: string;
  colorScheme?: "success" | "accent" | "warning" | "error" | "default" | "series-a" | "series-b";
  infoTooltip?: string;
  className?: string;
  /**
   * Measured values, oldest first, drawn as a sparkline. Omitted or fewer
   * than two points draws nothing: a decorative line would read as a trend.
   */
  sparkline?: number[];
}

export function AiKpiCard({
  label,
  value,
  trend,
  trendPositive = true,
  subtext,
  icon,
  iconBgColor = "bg-success-50 text-success-600",
  colorScheme = "success",
  infoTooltip,
  className,
  sparkline,
}: AiKpiCardProps) {
  // Wave configurations based on colorScheme
  const waveStyles = {
    success: {
      stroke: "var(--success-500, #10b981)",
      stopStart: "var(--success-500, #10b981)",
      stopEnd: "var(--success-400, #34d399)",
      fillId: "fill-success",
    },
    accent: {
      stroke: "var(--accent-500, #3b82f6)",
      stopStart: "var(--accent-500, #3b82f6)",
      stopEnd: "var(--accent-400, #60a5fa)",
      fillId: "fill-accent",
    },
    default: {
      stroke: "var(--brand-800, #1e293b)",
      stopStart: "var(--brand-800, #1e293b)",
      stopEnd: "var(--brand-600, #475569)",
      fillId: "fill-default",
    },
    warning: {
      stroke: "var(--warning-500, #f59e0b)",
      stopStart: "var(--warning-500, #f59e0b)",
      stopEnd: "var(--warning-400, #fbbf24)",
      fillId: "fill-warning",
    },
    error: {
      stroke: "var(--error-500, #ef4444)",
      stopStart: "var(--error-500, #ef4444)",
      stopEnd: "var(--error-400, #f87171)",
      fillId: "fill-error",
    },
    "series-a": {
      stroke: "var(--series-a, #8b5cf6)",
      stopStart: "var(--series-a, #8b5cf6)",
      stopEnd: "var(--series-a, #8b5cf6)",
      fillId: "fill-series-a",
    },
    "series-b": {
      stroke: "var(--series-b, #ec4899)",
      stopStart: "var(--series-b, #ec4899)",
      stopEnd: "var(--series-b, #ec4899)",
      fillId: "fill-series-b",
    },
  }[colorScheme];

  const sparkPath = buildSparkPath(sparkline);

  return (
    <Panel
      className={cn(
        "relative flex flex-col justify-between overflow-hidden p-5 transition-all hover:shadow-sm",
        className
      )}
    >
      <div>
        {/* Top row: Icon + Label + Info */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg text-sm font-semibold", iconBgColor)}>
              {icon}
            </div>
            <span className="text-[13px] font-medium text-brand-600">{label}</span>
          </div>
          {infoTooltip ? (
            <div className="group relative cursor-pointer text-brand-300 hover:text-brand-400">
              <Info size={14} />
              <div className="pointer-events-none absolute right-0 top-full z-20 mt-1.5 hidden w-48 rounded-lg bg-primary-600 px-2.5 py-1.5 text-[11px] leading-tight text-white shadow-lg group-hover:block">
                {infoTooltip}
              </div>
            </div>
          ) : (
            <Info size={14} className="text-brand-300" />
          )}
        </div>

        {/* Second row: Metric value + trend pill */}
        <div className="mt-3.5 flex items-baseline gap-2.5">
          <span className="text-[28px] font-bold tracking-tight text-brand-900">{value}</span>
          {trend && (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11.5px] font-semibold",
                trendPositive
                  ? "bg-success-50 text-success-600"
                  : "bg-error-50 text-error-600"
              )}
            >
              <TrendingUp size={12} className={trendPositive ? "" : "rotate-180"} />
              {trend}
            </span>
          )}
        </div>

        {/* Third row: Subtext description */}
        <p className="mt-1.5 text-[11.5px] leading-relaxed text-brand-500 line-clamp-2 min-h-[34px]">
          {subtext}
        </p>
      </div>

      {/* Sparkline of measured values only */}
      {sparkPath && (
        <div className="relative -mx-5 -mb-5 mt-2 h-11 overflow-hidden pt-1 pointer-events-none">
          <svg viewBox="0 0 420 50" preserveAspectRatio="none" className="h-full w-full">
            <defs>
              <linearGradient id={`${waveStyles.fillId}-${label.replace(/\s+/g, "")}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={waveStyles.stopStart} stopOpacity="0.22" />
                <stop offset="100%" stopColor={waveStyles.stopEnd} stopOpacity="0.01" />
              </linearGradient>
            </defs>
            <path d={`${sparkPath} L420,50 L0,50 Z`} fill={`url(#${waveStyles.fillId}-${label.replace(/\s+/g, "")})`} />
            <path d={sparkPath} fill="none" stroke={waveStyles.stroke} strokeWidth="2.2" strokeLinecap="round" />
          </svg>
        </div>
      )}
    </Panel>
  );
}

/** A polyline across the card's 420x50 box, or null when there is nothing to plot. */
function buildSparkPath(values?: number[]): string | null {
  if (!values || values.length < 2) return null;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  return values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * 420;
      const y = 44 - ((v - min) / span) * 34;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}
