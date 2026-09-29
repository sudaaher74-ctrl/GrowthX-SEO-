"use client";
import { cn } from "@/lib/utils";
import type { Standing } from "@/lib/tokens";

/**
 * How much of this month's tokens are left, as a bar.
 *
 * The colour follows the workspace's standing rather than the percentage, so
 * the bar, the chip and the banner always agree about whether it is a problem.
 */
export function TokenMeter({ pct, standing, className }: { pct: number; standing: Standing; className?: string }) {
  return (
    <div
      role="progressbar"
      aria-label="Monthly tokens left"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      className={cn("h-1.5 overflow-hidden rounded-full bg-brand-100", className)}
    >
      <div
        className={cn(
          "h-full rounded-full transition-[width] duration-500",
          standing === "out" ? "bg-error-500" : standing === "low" ? "bg-warning-500" : "bg-accent-600",
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
