"use client";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "success" | "warning" | "error" | "info" | "pending";
  size?: "sm" | "md";
  className?: string;
}

/**
 * Tones come from the design tokens, not from Tailwind's stock palette.
 *
 * These variants used to be written in raw `zinc`/`emerald`/`amber`/`red`
 * with a `dark:` half. The app is light-only — `providers.tsx` says so and
 * nothing ever sets the `dark` class — so every dark variant was dead weight,
 * and the light halves were a second palette sitting next to the console's.
 * "Success" here and "good" in `console.tsx` were two different greens.
 *
 * `pending` maps onto the accent rather than a sixth hue: the tokens define
 * four semantic colours, and inventing an indigo for this one component is how
 * the drift started.
 */
const variantStyles = {
  default: "bg-brand-100 text-brand-700 border border-line",
  success: "bg-success-50 text-success-700 border border-success-500/20",
  warning: "bg-warning-50 text-warning-700 border border-warning-500/20",
  error: "bg-error-50 text-error-700 border border-error-500/20",
  info: "bg-accent-50 text-accent-700 border border-accent-500/20",
  pending: "bg-accent-50 text-accent-700 border border-accent-500/20",
};

export function Badge({ children, variant = "default", size = "sm", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-medium",
        size === "sm" ? "px-2.5 py-0.5 text-[11px]" : "px-3 py-1 text-xs",
        variantStyles[variant],
        className
      )}
    >
      {children}
    </span>
  );
}

interface TrendBadgeProps {
  value: number;
  suffix?: string;
  invertColor?: boolean;
  className?: string;
}

export function TrendBadge({ value, suffix = "%", invertColor = false, className }: TrendBadgeProps) {
  const isPositive = value > 0;
  const isNegative = value < 0;
  const good = invertColor ? isNegative : isPositive;
  const bad = invertColor ? isPositive : isNegative;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-xs font-medium",
        good ? "text-success-600" : bad ? "text-error-600" : "text-brand-400",
        className
      )}
    >
      {isPositive ? <TrendingUp size={11} /> : isNegative ? <TrendingDown size={11} /> : <Minus size={11} />}
      {isPositive ? "+" : ""}{value}{suffix}
    </span>
  );
}

interface StatusDotProps {
  status: "success" | "warning" | "error" | "info" | "pending";
  pulse?: boolean;
  label?: string;
  className?: string;
}

const dotColors = {
  success: "bg-success-500",
  warning: "bg-warning-500",
  error: "bg-error-500",
  info: "bg-accent-500",
  pending: "bg-accent-500",
};

export function StatusDot({ status, pulse = false, label, className }: StatusDotProps) {
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span className={cn("w-2 h-2 rounded-full shrink-0", dotColors[status], pulse && "animate-pulse")} />
      {label && <span className="text-xs text-brand-400">{label}</span>}
    </span>
  );
}
