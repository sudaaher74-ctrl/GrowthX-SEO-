"use client";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "outline";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
}

const variantStyles = {
  primary: "gradient-bg-brand text-white shadow-md hover:shadow-glow-brand hover:brightness-110",
  secondary: "bg-[var(--surface-3)] text-[var(--text-primary)] border border-[var(--border-color)] hover:bg-[var(--bg-muted)] hover:border-[var(--border-strong)]",
  ghost: "text-[var(--text-secondary)] hover:bg-[var(--surface-3)] hover:text-[var(--text-primary)]",
  danger: "bg-red-500 text-white hover:bg-red-600 shadow-md",
  outline: "border-2 border-purple-500 text-purple-500 hover:bg-purple-500 hover:text-white dark:border-purple-400 dark:text-purple-400",
};

const sizeStyles = {
  sm: "px-3 py-1.5 text-xs gap-1.5",
  md: "px-4 py-2 text-sm gap-2",
  lg: "px-6 py-2.5 text-base gap-2",
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  icon,
  iconRight,
  children,
  className,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <motion.button
      whileHover={{ scale: disabled || loading ? 1 : 1.02 }}
      whileTap={{ scale: disabled || loading ? 1 : 0.97 }}
      className={cn(
        "inline-flex items-center justify-center font-semibold rounded-lg transition-base",
        "focus-visible:outline-2 focus-visible:outline-purple-500",
        variantStyles[variant],
        sizeStyles[size],
        (disabled || loading) && "opacity-50 cursor-not-allowed",
        className
      )}
      disabled={disabled || loading}
      {...(props as React.ComponentPropsWithoutRef<typeof motion.button>)}
    >
      {loading ? (
        <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      ) : icon}
      {children}
      {!loading && iconRight}
    </motion.button>
  );
}
