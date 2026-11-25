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
  statusTone,
  description,
  buttonText = "View Recommendations",
  onButtonClick,
  className,
  size = 92,
  showBadge = true,
}: GaugeScoreProps) {
  const effectiveScore = score != null ? Math.min(Math.max(score, 0), maxScore) : null;
  const pct = effectiveScore != null ? (effectiveScore / maxScore) * 100 : 0;

  const tone: "good" | "warn" | "bad" | "info" =
    statusTone ||
    (effectiveScore == null
      ? "info"
      : effectiveScore >= 80
        ? "good"
        : effectiveScore >= 50
          ? "warn"
          : "bad");

  const badgeColors = {
    good: "bg-success-50 text-success-700 border-success-200/90",
    warn: "bg-warning-50 text-warning-700 border-warning-200/90",
    bad: "bg-error-50 text-error-700 border-error-200/90",
    info: "bg-accent-50 text-accent-700 border-accent-200/90",
  }[tone];

  const dotColors = {
    good: "bg-success-500",
    warn: "bg-warning-500",
    bad: "bg-error-500",
    info: "bg-accent-500",
  }[tone];

  const strokeColor = {
    good: "var(--color-success-500)",
    warn: "var(--color-warning-500)",
    bad: "var(--color-error-500)",
    info: "var(--color-accent-500)",
  }[tone];

  const strokeWidth = Math.max(6, Math.round(size * 0.075));
  const radius = (size - strokeWidth - 4) / 2;
  const circumference = 2 * Math.PI * radius;
  const arcLength = circumference * 0.75;
  const strokeDashoffset = arcLength * (1 - pct / 100);

  return (
    <div className={cn("flex flex-col items-center justify-between flex-1 w-full min-w-0", className)}>
      <div className="flex flex-col items-center w-full min-w-0">
        {/* Refined 270° circular arc gauge */}
        <div
          className="relative shrink-0 flex items-center justify-center my-1"
          style={{ width: size, height: size }}
          role="img"
          aria-label={`${label}: ${effectiveScore != null ? `${effectiveScore} out of ${maxScore}` : "not measured"}`}
        >
          <svg
            width={size}
            height={size}
            viewBox={`0 0 ${size} ${size}`}
            className="transform rotate-135"
          >
            {/* Subtle recessed track */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="var(--color-brand-200)"
              strokeOpacity={0.55}
              strokeWidth={strokeWidth}
              strokeDasharray={`${arcLength} ${circumference}`}
              strokeLinecap="round"
            />
            {/* Value arc */}
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

          {/* Center score readout */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="font-mono text-2xl font-bold tracking-tight text-brand-950 leading-none tabular-nums">
              {effectiveScore != null ? effectiveScore : "—"}
            </span>
            <span className="font-mono text-[10px] font-medium text-brand-400 mt-1 tabular-nums">
              / {maxScore}
            </span>
          </div>
        </div>

        {/* Status badge (color + dot + label for WCAG 1.4.1) */}
        {showBadge && statusText && (
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10.5px] font-semibold my-1 whitespace-nowrap",
              badgeColors,
            )}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", dotColors)} aria-hidden="true" />
            {statusText}
          </span>
        )}

        {description && (
          <p className="text-xs text-brand-500 line-clamp-1 text-center mt-1 w-full px-1">
            {description}
          </p>
        )}
      </div>

      {onButtonClick && (
        <div className="w-full mt-3 pt-2.5 border-t border-brand-200/70 text-right">
          <button
            type="button"
            onClick={onButtonClick}
            className="text-xs font-semibold text-accent-600 hover:text-accent-700 inline-flex items-center gap-1 transition-colors cursor-pointer"
          >
            <span>{buttonText}</span>
            <ArrowRight size={12} />
          </button>
        </div>
      )}
    </div>
  );
}
