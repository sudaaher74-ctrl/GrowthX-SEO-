"use client";

import { useTheme } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";

export function MarketingShell({ children }: { children: React.ReactNode }) {
  const { isDark } = useTheme();

  return (
    <div
      className={cn(
        isDark ? "dash-dark dark" : "dash-light",
        "min-h-screen text-brand-950 antialiased selection:bg-signal-400 selection:text-signal-ink transition-colors duration-200",
      )}
      style={{ background: "var(--color-canvas)" }}
    >
      {children}
    </div>
  );
}

