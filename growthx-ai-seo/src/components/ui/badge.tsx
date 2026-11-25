"use client";
import { cn } from "@/lib/utils";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "success" | "warning" | "error" | "info" | "pending";
  size?: "sm" | "md";
  dot?: boolean;
  className?: string;
}

const variantStyles = {
  default: "bg-brand-50 text-brand-700 border border-brand-200/90",
  success: "bg-success-50 text-success-700 border border-success-200/90",
  warning: "bg-warning-50 text-warning-700 border border-warning-200/90",
  error: "bg-error-50 text-error-700 border border-error-200/90",
  info: "bg-accent-50 text-accent-700 border border-accent-200/90",
  pending: "bg-primary-50 text-primary-700 border border-primary-200/90",
};

const variantDotColors = {
  default: "bg-brand-400",
  success: "bg-success-500",
  warning: "bg-warning-500",
  error: "bg-error-500",
  info: "bg-accent-500",
  pending: "bg-primary-500",
};

export function Badge({ children, variant = "default", size = "sm", dot = false, className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-semibold whitespace-nowrap tabular-nums",
        size === "sm" ? "px-2 py-0.5 text-[10.5px] leading-4" : "px-2.5 py-0.5 text-xs leading-5",
        variantStyles[variant],
        className,
      )}
    >
      {dot && <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", variantDotColors[variant])} aria-hidden="true" />}
      {children}
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
  pending: "bg-primary-500",
};

export function StatusDot({ status, pulse = false, label, className }: StatusDotProps) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap", className)}>
      <span className="relative flex h-2 w-2 shrink-0" aria-hidden="true">
        {pulse && <span className={cn("absolute inline-flex h-full w-full animate-ping rounded-full opacity-70", dotColors[status])} />}
        <span className={cn("relative inline-flex h-2 w-2 rounded-full", dotColors[status])} />
      </span>
      {label && <span className="text-xs font-medium text-brand-600">{label}</span>}
    </span>
  );
}
