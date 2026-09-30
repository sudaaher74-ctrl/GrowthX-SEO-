"use client";

import { useSyncExternalStore } from "react";

export type ThemeMode = "dark" | "light";

const themeListeners = new Set<() => void>();
let currentTheme: ThemeMode = "dark";

if (typeof window !== "undefined") {
  try {
    const saved = localStorage.getItem("growthx_theme");
    if (saved === "light" || saved === "dark") {
      currentTheme = saved;
    }
  } catch {}
}

export function subscribeToThemeChange(listener: () => void) {
  themeListeners.add(listener);
  return () => themeListeners.delete(listener);
}

export function setTheme(theme: ThemeMode) {
  if (theme === currentTheme) return;
  currentTheme = theme;
  try {
    localStorage.setItem("growthx_theme", theme);
    if (typeof document !== "undefined") {
      if (theme === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    }
  } catch {}
  themeListeners.forEach((fn) => fn());
}

export function toggleTheme() {
  setTheme(currentTheme === "dark" ? "light" : "dark");
}

export function useTheme(): {
  theme: ThemeMode;
  isDark: boolean;
  setTheme: (t: ThemeMode) => void;
  toggleTheme: () => void;
} {
  const theme = useSyncExternalStore(
    subscribeToThemeChange,
    () => currentTheme,
    () => "dark" as ThemeMode,
  );
  return {
    theme,
    isDark: theme === "dark",
    setTheme,
    toggleTheme,
  };
}
