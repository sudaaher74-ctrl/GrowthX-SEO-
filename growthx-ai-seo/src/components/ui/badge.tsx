"use client";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "success" | "warning" | "error" | "info" | "pending";
  size?: "sm" | "md";
  className?: string;
}

const variantStyles = {
  default: "bg-zinc-100/80 text-zinc-700 border border-zinc-200/50 dark:bg-zinc-800/80 dark:text-zinc-300 dark:border-zinc-700/50",
  success: "bg-emerald-50 text-emerald-700 border border-emerald-200/50 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20",
  warning: "bg-amber-50 text-amber-700 border border-amber-200/50 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20",
  error: "bg-red-50 text-red-700 border border-red-200/50 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20",
  info: "bg-blue-50 text-blue-700 border border-blue-200/50 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20",
  pending: "bg-indigo-50 text-indigo-700 border border-indigo-200/50 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/20",
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
        good ? "text-emerald-600 dark:text-emerald-400" : bad ? "text-red-600 dark:text-red-400" : "text-zinc-400",
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
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  error: "bg-red-500",
  info: "bg-blue-500",
  pending: "bg-indigo-500",
};

export function StatusDot({ status, pulse = false, label, className }: StatusDotProps) {
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span className={cn("w-2 h-2 rounded-full shrink-0", dotColors[status], pulse && "animate-pulse")} />
      {label && <span className="text-xs text-[var(--text-muted)]">{label}</span>}
    </span>
  );
}
