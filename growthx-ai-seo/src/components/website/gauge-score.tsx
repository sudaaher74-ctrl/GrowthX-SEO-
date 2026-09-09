"use client";

import React from "react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface GaugeScoreProps {
  score: number | null;
  maxScore?: number;
  label?: string;
  statusText?: string;
  statusTone?: "good" | "warn" | "bad" | "info";
  description?: string;
  buttonText?: string;
  onButtonClick?: () => void;
  className?: string;
  size?: number;
  showBadge?: boolean;
}

export function GaugeScore({
  score,
  maxScore = 100,
  label = "Technical Health Score",
  statusText,
  statusTone = "bad",
  description,
  buttonText = "View Recommendations",
  onButtonClick,
  className,
  size = 88,
  showBadge = true,
}: GaugeScoreProps) {
  const effectiveScore = score != null ? Math.min(Math.max(score, 0), maxScore) : null;
  const pct = effectiveScore != null ? (effectiveScore / maxScore) * 100 : 0;

  // Derive tone if not explicitly given
  const tone =
    statusTone ||
    (effectiveScore == null
      ? "info"
      : effectiveScore >= 80
      ? "good"
      : effectiveScore >= 50
      ? "warn"
      : "bad");

  const badgeColors = {
    good: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/50",
    warn: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/50",
    bad: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800/50",
    info: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800/50",
  };

  const strokeColor = {
    good: "#10b981", // emerald-500
    warn: "#f59e0b", // amber-500
    bad: "#f43f5e",  // rose-500
    info: "#3b82f6", // blue-500
  }[tone];

  // SVG Gauge calculations
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  // Open circular arc (270 degrees)
  const arcLength = circumference * 0.75;
  const strokeDashoffset = arcLength * (1 - pct / 100);

  return (
    <div className={cn("flex flex-col items-center justify-between flex-1 w-full min-w-0", className)}>
      <div className="flex flex-col items-center w-full min-w-0">
        {/* Semi-circular / arc gauge */}
        <div className="relative shrink-0 flex items-center justify-center my-1" style={{ width: size, height: size }}>
          <svg
            width={size}
            height={size}
            viewBox={`0 0 ${size} ${size}`}
            className="transform rotate-135"
          >
            {/* Track */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="currentColor"
              className="text-slate-100 dark:text-slate-800"
              strokeWidth={strokeWidth}
              strokeDasharray={`${arcLength} ${circumference}`}
              strokeLinecap="round"
            />
            {/* Value Arc */}
            {effectiveScore != null && (
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={strokeColor}
                strokeWidth={strokeWidth}
                strokeDasharray={`${arcLength} ${circumference}`}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                className="transition-all duration-700 ease-out"
              />
            )}
          </svg>

          {/* Center Score */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white leading-none">
              {effectiveScore != null ? effectiveScore : "—"}
            </span>
            <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 mt-0.5">
              / {maxScore}
            </span>
          </div>
        </div>

        {/* Status Badge (if enabled) */}
        {showBadge && statusText && (
          <span
            className={cn(
              "inline-block rounded-full border px-2.5 py-0.5 text-[10px] font-semibold my-1",
              badgeColors[tone]
            )}
          >
            {statusText}
          </span>
        )}

        {/* Short description */}
        {description && (
          <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 text-center mt-1 w-full px-1">
            {description}
          </p>
        )}
      </div>

      {/* Action Link / Button */}
      {onButtonClick && (
        <div className="w-full mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 text-right">
          <button
            type="button"
            onClick={onButtonClick}
            className="text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 inline-flex items-center gap-1 transition-colors"
          >
            <span>{buttonText}</span>
            <ArrowRight size={12} />
          </button>
        </div>
      )}
    </div>
  );
}
