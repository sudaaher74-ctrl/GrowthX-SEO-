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
  default: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  success: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  warning: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  error: "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  info: "bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  pending: "bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
};

export function Badge({ children, variant = "default", size = "sm", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-medium",
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-sm",
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
        "inline-flex items-center gap-0.5 text-xs font-semibold",
        good ? "text-emerald-500 dark:text-emerald-400" : bad ? "text-red-500 dark:text-red-400" : "text-slate-400",
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
  success: "bg-emerald-400",
  warning: "bg-amber-400",
  error: "bg-red-400",
  info: "bg-purple-400",
  pending: "bg-violet-400",
};

export function StatusDot({ status, pulse = false, label, className }: StatusDotProps) {
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span className={cn("w-2 h-2 rounded-full shrink-0", dotColors[status], pulse && "animate-pulse")} />
      {label && <span className="text-xs text-[var(--text-muted)]">{label}</span>}
    </span>
  );
}
