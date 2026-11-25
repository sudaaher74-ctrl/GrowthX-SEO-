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
  primary: "bg-brand-950 text-brand-50 shadow-xs hover:bg-brand-800 dark:bg-primary-600 dark:text-signal-ink dark:hover:bg-primary-700",
  secondary: "bg-surface-1 text-brand-950 shadow-2xs border border-brand-200 hover:bg-brand-50",
  ghost: "text-brand-600 hover:bg-brand-100/60 hover:text-brand-950",
  danger: "bg-error-600 text-white shadow-2xs hover:bg-error-700",
  outline: "border border-brand-200 text-brand-700 hover:bg-brand-50 hover:text-brand-950",
};

const sizeStyles = {
  sm: "px-3 py-1.5 text-xs gap-1.5",
  md: "px-4 py-2 text-sm gap-2",
  lg: "px-6 py-2.5 text-base gap-2.5",
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
        "inline-flex items-center justify-center font-medium rounded-[10px] transition-all duration-200 cursor-pointer",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-950/15 focus-visible:ring-offset-2",
        variantStyles[variant],
        sizeStyles[size],
        (disabled || loading) && "opacity-50 cursor-not-allowed",
        className,
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
