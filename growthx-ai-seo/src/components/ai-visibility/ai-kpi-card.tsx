"use client";

import React from "react";
import { Info, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

export interface AiKpiCardProps {
  label: string;
  value: string | number;
  trend?: string;
  trendPositive?: boolean;
  subtext: string;
  icon: React.ReactNode;
  iconBgColor?: string;
  colorScheme?: "emerald" | "blue" | "purple" | "orange" | "yellow" | "coral" | "default";
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
  iconBgColor = "bg-emerald-50 text-emerald-600",
  colorScheme = "emerald",
  infoTooltip,
  className,
  sparkline,
}: AiKpiCardProps) {
  // Wave configurations based on colorScheme
  const waveStyles = {
    emerald: {
      stroke: "#10b981",
      stopStart: "#10b981",
      stopEnd: "#34d399",
      fillId: "fill-emerald",
    },
    blue: {
      stroke: "#3b82f6",
      stopStart: "#3b82f6",
      stopEnd: "#60a5fa",
      fillId: "fill-blue",
    },
    purple: {
      stroke: "#0f172a",
      stopStart: "#0f172a",
      stopEnd: "#475569",
      fillId: "fill-purple",
    },
    default: {
      stroke: "#0f172a",
      stopStart: "#0f172a",
      stopEnd: "#475569",
      fillId: "fill-default",
    },
    orange: {
      stroke: "#f97316",
      stopStart: "#f97316",
      stopEnd: "#fb923c",
      fillId: "fill-orange",
    },
    yellow: {
      stroke: "#eab308",
      stopStart: "#eab308",
      stopEnd: "#fde047",
      fillId: "fill-yellow",
    },
    coral: {
      stroke: "#f43f5e",
      stopStart: "#f43f5e",
      stopEnd: "#fb7185",
      fillId: "fill-coral",
    },
  }[colorScheme];

  const sparkPath = buildSparkPath(sparkline);

  return (
    <div
      className={cn(
        "relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs transition-all hover:shadow-sm",
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
            <span className="text-[13px] font-medium text-slate-600">{label}</span>
          </div>
          {infoTooltip ? (
            <div className="group relative cursor-pointer text-slate-300 hover:text-slate-400">
              <Info size={14} />
              <div className="pointer-events-none absolute right-0 top-full z-20 mt-1.5 hidden w-48 rounded-lg bg-slate-900 px-2.5 py-1.5 text-[11px] leading-tight text-white shadow-lg group-hover:block">
                {infoTooltip}
              </div>
            </div>
          ) : (
            <Info size={14} className="text-slate-300" />
          )}
        </div>

        {/* Second row: Metric value + trend pill */}
        <div className="mt-3.5 flex items-baseline gap-2.5">
          <span className="text-[28px] font-bold tracking-tight text-slate-900">{value}</span>
          {trend && (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11.5px] font-semibold",
                trendPositive
                  ? "bg-emerald-50 text-emerald-600"
                  : "bg-rose-50 text-rose-600"
              )}
            >
              <TrendingUp size={12} className={trendPositive ? "" : "rotate-180"} />
              {trend}
            </span>
          )}
        </div>

        {/* Third row: Subtext description */}
        <p className="mt-1.5 text-[11.5px] leading-relaxed text-slate-500 line-clamp-2 min-h-[34px]">
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
    </div>
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
