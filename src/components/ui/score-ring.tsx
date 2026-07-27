"use client";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { useEffect } from "react";
import { cn, getHealthColor } from "@/lib/utils";

interface ScoreRingProps {
  score: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
  sublabel?: string;
  delay?: number;
  className?: string;
  color?: string;
}

export function ScoreRing({
  score,
  size = 120,
  strokeWidth = 8,
  label,
  sublabel,
  delay = 0,
  className,
  color,
}: ScoreRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const motionScore = useMotionValue(0);
  const dashOffset = useTransform(
    motionScore,
    [0, 100],
    [circumference, circumference * (1 - score / 100)]
  );
  const displayScore = useTransform(motionScore, Math.round);

  const ringColor = color ?? getHealthColor(score);

  useEffect(() => {
    const timeout = setTimeout(() => {
      animate(motionScore, score, { duration: 1.4, ease: "easeOut", delay: 0 });
    }, delay * 1000);
    return () => clearTimeout(timeout);
  }, [score, delay, motionScore]);

  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      <div className="relative" style={{ width: size, height: size }}>
        {/* Background track */}
        <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--border-color)"
            strokeWidth={strokeWidth}
          />
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={ringColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            style={{ filter: `drop-shadow(0 0 6px ${ringColor}60)` }}
          />
        </svg>

        {/* Center score */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span
            className="text-2xl font-bold"
            style={{ color: ringColor }}
          >
            {displayScore}
          </motion.span>
          {sublabel && (
            <span className="text-xs text-[var(--text-muted)] mt-0.5">{sublabel}</span>
          )}
        </div>
      </div>
      {label && (
        <span className="text-sm font-medium text-[var(--text-secondary)] text-center">
          {label}
        </span>
      )}
    </div>
  );
}
