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
  colorScheme?: "emerald" | "blue" | "purple" | "orange" | "yellow" | "coral";
  infoTooltip?: string;
  className?: string;
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
}: AiKpiCardProps) {
  // Wave configurations based on colorScheme
  const waveStyles = {
    emerald: {
      stroke: "#10b981",
      stopStart: "#10b981",
      stopEnd: "#34d399",
      fillId: "fill-emerald",
      d: "M0,28 C40,32 70,14 110,22 C150,30 190,16 230,20 C270,24 300,10 340,18 C370,24 390,15 420,18 L420,50 L0,50 Z",
      strokeD: "M0,28 C40,32 70,14 110,22 C150,30 190,16 230,20 C270,24 300,10 340,18 C370,24 390,15 420,18",
    },
    blue: {
      stroke: "#3b82f6",
      stopStart: "#3b82f6",
      stopEnd: "#60a5fa",
      fillId: "fill-blue",
      d: "M0,32 C40,24 80,30 120,20 C160,10 200,28 240,22 C280,16 320,10 360,18 C390,24 400,16 420,20 L420,50 L0,50 Z",
      strokeD: "M0,32 C40,24 80,30 120,20 C160,10 200,28 240,22 C280,16 320,10 360,18 C390,24 400,16 420,20",
    },
    purple: {
      stroke: "#8b5cf6",
      stopStart: "#8b5cf6",
      stopEnd: "#a78bfa",
      fillId: "fill-purple",
      d: "M0,30 C30,34 70,18 110,24 C150,30 180,16 220,26 C260,34 300,20 340,22 C370,24 390,18 420,24 L420,50 L0,50 Z",
      strokeD: "M0,30 C30,34 70,18 110,24 C150,30 180,16 220,26 C260,34 300,20 340,22 C370,24 390,18 420,24",
    },
    orange: {
      stroke: "#f97316",
      stopStart: "#f97316",
      stopEnd: "#fb923c",
      fillId: "fill-orange",
      d: "M0,26 C40,28 80,20 120,22 C160,24 200,18 240,20 C280,22 320,14 360,18 C390,20 400,18 420,20 L420,50 L0,50 Z",
      strokeD: "M0,26 C40,28 80,20 120,22 C160,24 200,18 240,20 C280,22 320,14 360,18 C390,20 400,18 420,20",
    },
    yellow: {
      stroke: "#eab308",
      stopStart: "#eab308",
      stopEnd: "#fde047",
      fillId: "fill-yellow",
      d: "M0,28 C30,22 80,30 130,22 C180,14 220,26 270,20 C320,14 370,22 420,18 L420,50 L0,50 Z",
      strokeD: "M0,28 C30,22 80,30 130,22 C180,14 220,26 270,20 C320,14 370,22 420,18",
    },
    coral: {
      stroke: "#f43f5e",
      stopStart: "#f43f5e",
      stopEnd: "#fb7185",
      fillId: "fill-coral",
      d: "M0,32 C40,30 90,20 140,24 C190,28 230,16 280,24 C330,30 380,22 420,24 L420,50 L0,50 Z",
      strokeD: "M0,32 C40,30 90,20 140,24 C190,28 230,16 280,24 C330,30 380,22 420,24",
    },
  }[colorScheme];

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

      {/* Bottom smooth SVG wave chart */}
      <div className="relative -mx-5 -mb-5 mt-2 h-11 overflow-hidden pt-1 pointer-events-none">
        <svg
          viewBox="0 0 420 50"
          preserveAspectRatio="none"
          className="h-full w-full"
        >
          <defs>
            <linearGradient id={`${waveStyles.fillId}-${label.replace(/\s+/g, "")}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={waveStyles.stopStart} stopOpacity="0.22" />
              <stop offset="100%" stopColor={waveStyles.stopEnd} stopOpacity="0.01" />
            </linearGradient>
          </defs>
          <path
            d={waveStyles.d}
            fill={`url(#${waveStyles.fillId}-${label.replace(/\s+/g, "")})`}
          />
          <path
            d={waveStyles.strokeD}
            fill="none"
            stroke={waveStyles.stroke}
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </svg>
      </div>
    </div>
  );
}
