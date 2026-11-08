"use client";

import { useEffect, useSyncExternalStore } from "react";

type ThemeMode = "dark" | "light";

const themeListeners = new Set<() => void>();
let currentTheme: ThemeMode = "dark";

export function applyTheme(theme: ThemeMode) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (theme === "dark") {
    root.classList.add("dark", "dash-dark");
    root.classList.remove("light", "dash-light");
    root.style.colorScheme = "dark";
  } else {
    root.classList.remove("dark", "dash-dark");
    root.classList.add("light", "dash-light");
    root.style.colorScheme = "light";
  }
}

if (typeof window !== "undefined") {
  try {
    const saved = localStorage.getItem("growthx_theme");
    if (saved === "light" || saved === "dark") {
      currentTheme = saved;
    } else {
      currentTheme = "dark";
    }
  } catch {}
  applyTheme(currentTheme);
}

function subscribeToThemeChange(listener: () => void) {
  themeListeners.add(listener);
  return () => themeListeners.delete(listener);
}

function setTheme(theme: ThemeMode) {
  currentTheme = theme;
  try {
    localStorage.setItem("growthx_theme", theme);
    applyTheme(theme);
  } catch {}
  themeListeners.forEach((fn) => fn());
}

function toggleTheme() {
  const next = currentTheme === "dark" ? "light" : "dark";
  setTheme(next);
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

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  return {
    theme,
    isDark: theme === "dark",
    setTheme,
    toggleTheme,
  };
}
