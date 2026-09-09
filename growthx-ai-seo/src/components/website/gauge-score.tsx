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
  const size = 110;
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  // Let's make an open circular arc (260 degrees) or full circle
  const arcLength = circumference * 0.75; // 270 degrees
  const strokeDashoffset = arcLength * (1 - pct / 100);

  return (
    <div className={cn("flex flex-col sm:flex-row items-center sm:items-start gap-4", className)}>
      {/* Semi-circular / arc gauge */}
      <div className="relative shrink-0 flex items-center justify-center" style={{ width: size, height: size }}>
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
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            {effectiveScore != null ? effectiveScore : "—"}
          </span>
          <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500">
            / {maxScore}
          </span>
        </div>
      </div>

      {/* Content Right */}
      <div className="flex-1 flex flex-col items-center sm:items-start text-center sm:text-left min-w-0">
        {statusText && (
          <span
            className={cn(
              "inline-block rounded-full border px-2.5 py-0.5 text-[11px] font-semibold mb-1.5",
              badgeColors[tone]
            )}
          >
            {statusText}
          </span>
        )}
        {description && (
          <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed mb-3">
            {description}
          </p>
        )}
        {onButtonClick && (
          <button
            type="button"
            onClick={onButtonClick}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-1.5 text-xs font-semibold shadow-xs transition-colors"
          >
            <span>{buttonText}</span>
            <ArrowRight size={13} />
          </button>
        )}
      </div>
    </div>
  );
}
