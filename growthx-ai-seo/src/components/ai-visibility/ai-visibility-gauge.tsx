"use client";

import React from "react";
import { Sparkles, Info } from "lucide-react";
import { cn } from "@/lib/utils";

export interface AiVisibilityGaugeProps {
  score?: number;
  maxScore?: number;
  statusLabel?: string;
  subtext?: string;
  className?: string;
}

export function AiVisibilityGauge({
  score = 0,
  maxScore = 100,
  statusLabel = "Good",
  subtext = "Tracked LLM prominence index across synthetic evaluation queries.",
  className,
}: AiVisibilityGaugeProps) {
  // Arc parameters for a 240-degree sweep horseshoe gauge
  // Angles: starts at 150 deg (bottom left), sweeps 240 deg clockwise to 390 (30) deg (bottom right)
  const radius = 56;
  const strokeWidth = 9;
  const cx = 80;
  const cy = 76;
  
  // Circumference of full circle
  const circumference = 2 * Math.PI * radius;
  // Sweep fraction = 240 / 360 = 0.66667
  const sweepFraction = 240 / 360;
  const totalArcLength = circumference * sweepFraction;
  
  // Clamped ratio
  const ratio = Math.min(1, Math.max(0, score / maxScore));
  const activeLength = totalArcLength * ratio;
  const strokeDashoffset = totalArcLength - activeLength;

  return (
    <div
      className={cn(
        "relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs transition-all hover:shadow-sm",
        className
      )}
    >
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles size={15} className="text-indigo-600" />
          <span className="text-[13px] font-semibold text-slate-800">Your AI Visibility Score</span>
        </div>
        <div className="group relative cursor-pointer text-slate-300 hover:text-slate-400">
          <Info size={14} />
          <div className="pointer-events-none absolute right-0 top-full z-20 mt-1.5 hidden w-48 rounded-lg bg-slate-900 px-2.5 py-1.5 text-[11px] leading-tight text-white shadow-lg group-hover:block">
            Weighted composite score based on mention frequency, sentiment, and authoritative citation rank across models.
          </div>
        </div>
      </div>

      {/* Center Gauge */}
      <div className="my-1 flex flex-col items-center">
        <div className="relative flex h-[130px] w-[160px] items-center justify-center">
          <svg viewBox="0 0 160 140" className="h-full w-full overflow-visible">
            <defs>
              <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#10b981" />
                <stop offset="100%" stopColor="#059669" />
              </linearGradient>
            </defs>

            {/* Background Arc */}
            <circle
              cx={cx}
              cy={cy}
              r={radius}
              fill="none"
              stroke="#e2e8f0"
              strokeWidth={strokeWidth}
              strokeDasharray={`${totalArcLength} ${circumference}`}
              strokeDashoffset={0}
              strokeLinecap="round"
              style={{
                transform: `rotate(150deg)`,
                transformOrigin: `${cx}px ${cy}px`,
              }}
            />

            {/* Active Arc */}
            <circle
              cx={cx}
              cy={cy}
              r={radius}
              fill="none"
              stroke="url(#gaugeGradient)"
              strokeWidth={strokeWidth}
              strokeDasharray={`${totalArcLength} ${circumference}`}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              className="transition-all duration-1000 ease-out"
              style={{
                transform: `rotate(150deg)`,
                transformOrigin: `${cx}px ${cy}px`,
              }}
            />
          </svg>

          {/* Value in Center */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pt-2">
            <span className="text-[32px] font-extrabold leading-none tracking-tight text-slate-900">
              {score}
            </span>
            <span className="mt-1 text-[11px] font-medium text-slate-400">
              / {maxScore}
            </span>
          </div>
        </div>

        {/* Status Pill Badge */}
        <div className="mt-1">
          <span className="inline-flex items-center rounded-full bg-emerald-50 px-3.5 py-0.5 text-[11.5px] font-semibold text-emerald-700 border border-emerald-200/50">
            {statusLabel}
          </span>
        </div>
      </div>

      {/* Subtext info */}
      <p className="text-center text-[11px] leading-relaxed text-slate-500">
        {subtext}
      </p>
    </div>
  );
}
