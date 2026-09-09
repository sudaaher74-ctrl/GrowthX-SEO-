"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface CircularScoreGaugeProps {
  score: number | null;
  max?: number;
  size?: number;
  strokeWidth?: number;
  statusLabel?: string;
  statusTone?: "good" | "warning" | "danger" | "neutral";
  className?: string;
}

export function CircularScoreGauge({
  score,
  max = 100,
  size = 110,
  strokeWidth = 10,
  statusLabel,
  statusTone = "good",
  className,
}: CircularScoreGaugeProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  // Percentage or 0 when unmeasured
  const normalizedScore = score != null ? Math.min(Math.max(score, 0), max) : null;
  const percentage = normalizedScore != null ? (normalizedScore / max) * 100 : 0;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  let strokeColor = "#10B981"; // emerald-500
  if (normalizedScore == null) {
    strokeColor = "#CBD5E1"; // slate-300
  } else if (normalizedScore < 50) {
    strokeColor = "#EF4444"; // red-500
  } else if (normalizedScore < 75) {
    strokeColor = "#F59E0B"; // amber-500
  }

  return (
    <div className={cn("relative flex items-center justify-center shrink-0", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#E2E8F0"
          strokeWidth={strokeWidth}
          fill="transparent"
          className="transition-all"
        />
        {/* Score progress track */}
        {normalizedScore != null && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="transparent"
            className="transition-all duration-700 ease-out"
          />
        )}
      </svg>

      {/* Center content */}
      <div className="absolute flex flex-col items-center justify-center text-center">
        <span className="font-mono text-2xl font-bold tracking-tight text-brand-950">
          {normalizedScore != null ? normalizedScore : "—"}
        </span>
        <span className="text-[10px] font-semibold text-brand-400 -mt-1">
          /{max}
        </span>
      </div>
    </div>
  );
}
