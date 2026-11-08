"use client";
import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut, Menu, Moon, PanelLeftClose, PanelLeftOpen, Search, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api-client";

import { SiteSwitcher } from "@/components/layout/site-switcher";
import {
  PERIOD_DAYS,
  setActivePeriod,
  usePeriodDays,
  useWorkspace,
} from "@/hooks/use-growthx";
import { useTheme } from "@/hooks/use-theme";
import { TokensChip } from "@/components/tokens/tokens-chip";
import { CommandPalette } from "@/components/ui/command-palette";

/** Breadcrumb scope + title for each route, matching workspace architecture. */
const ROUTE_META: Record<string, { scope: string; title: string }> = {
  "/dashboard": { scope: "Workspace", title: "Dashboard" },
  "/website": { scope: "Workspace", title: "Website Audit" },
  "/competitor-intelligence": { scope: "Workspace", title: "Competitor Intelligence" },
  "/backlinks": { scope: "Workspace", title: "Backlink Intelligence" },
  "/ai-visibility": { scope: "Workspace", title: "AI Visibility" },
  "/fix-engine": { scope: "Workspace", title: "Fix Engine" },
  "/organic-search": { scope: "Workspace", title: "Organic Search & Keywords" },
  "/google/keywords": { scope: "Workspace", title: "Organic Search & Keywords" },
  "/google": { scope: "Workspace", title: "Traffic" },
  "/traffic": { scope: "Workspace", title: "Traffic" },
  "/reports": { scope: "Workspace", title: "Reports" },
  "/monthly-report": { scope: "Workspace", title: "Monthly Report" },
  "/integrations": { scope: "Workspace", title: "Integrations" },
  "/settings": { scope: "Workspace", title: "Settings" },
  "/tokens": { scope: "Workspace", title: "Tokens" },
};


export function TopNav({
  collapsed = false,
  onToggleCollapse,
  setMobileOpen,
}: {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  setMobileOpen?: (open: boolean) => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { projectId, projects } = useWorkspace();
  // Reads the shared window rather than a private copy, so the highlighted
  // pill is the window the queries are actually using.
  const period = usePeriodDays();
  const { theme, toggleTheme } = useTheme();
  // The palette was built, complete, and imported by nothing, while this bar
  // advertised ⌘K. It binds the shortcut itself once mounted.
  const [paletteOpen, setPaletteOpen] = useState(false);

  const selectedProject = projects.find((p) => p.id === projectId) ?? projects[0] ?? null;

  async function signOut() {
    await api.logout();
    queryClient.clear();
    router.replace("/login");
  }

  // Every page under /google is the Google section; one entry per sub-page would go stale.
  const meta = ROUTE_META[pathname] ?? (pathname.startsWith("/google/") ? ROUTE_META["/google"] : undefined) ?? {
    scope: selectedProject ? selectedProject.name : "Workspace",
    title: pathname.replace(/^\//, "").replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) || "Dashboard",
  };

  return (
    <header
      className={cn(
        "fixed left-0 right-0 top-0 z-30 flex h-[52px] items-center gap-2 border-b bg-surface-1/95 backdrop-blur-md px-3 transition-all duration-300 ease-in-out md:px-4",
        collapsed ? "md:left-[68px]" : "md:left-[232px]",
      )}
      style={{ borderColor: "var(--border-color)" }}
    >
      <button className="rounded-lg p-1.5 transition hover:bg-brand-100 md:hidden" onClick={() => setMobileOpen?.(true)} aria-label="Open navigation">
        <Menu size={18} className="text-brand-600" />
      </button>

      {/* Desktop Collapse Toggle */}
      <button
        onClick={onToggleCollapse}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg text-brand-500 transition hover:bg-brand-100 hover:text-brand-950 focus-visible:outline-2 focus-visible:outline-primary-600 md:flex"
      >
        {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
      </button>

      {/* Breadcrumb with persistent Selected Project */}
      <div className="flex min-w-0 shrink items-center gap-2 text-[13px]">
        {selectedProject ? (
          <SiteSwitcher variant="chip" />
        ) : (
          <span className="font-semibold text-brand-950">Reigel AI</span>
        )}
        <span className="shrink-0 text-brand-300">/</span>
        <span className="hidden truncate font-medium text-brand-600 sm:block" title={meta.title}>{meta.title}</span>
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-1.5 md:gap-2">
        {/* Search */}
        {/* Was a bare <input> with no value, no onChange and no handler:
            typing in it did nothing at all. It is a button now, because
            opening the palette is the only thing it has ever been able to
            do, and a text cursor promised editing that was not there. */}
        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          aria-label="Search pages and commands"
          title="Search pages and commands (⌘K)"
          className="hidden h-8 items-center gap-2 rounded-lg border px-2.5 text-left text-brand-500 transition-colors hover:bg-brand-50 hover:text-brand-950 focus-visible:outline-2 focus-visible:outline-primary-600 md:flex xl:min-w-56"
          style={{ borderColor: "var(--border-color)" }}
        >
          <Search size={15} className="shrink-0" />
          <span className="hidden flex-1 text-[12px] text-brand-500 xl:inline">Search pages</span>
          <kbd className="hidden rounded border px-1 font-mono text-[9px] text-brand-400 xl:inline" style={{ borderColor: "var(--border-color)" }}>
            ⌘K
          </kbd>
        </button>

        {/* Period pills */}
        <div role="group" aria-label="Date range" className={cn("items-center rounded-lg border p-0.5", pathname === "/monthly-report" ? "hidden" : "hidden lg:flex")} style={{ borderColor: "var(--border-color)" }}>
          {PERIOD_DAYS.map((p) => (
            <button
              key={p}
              onClick={() => setActivePeriod(p)}
              aria-pressed={period === p}
              title={`Show the last ${p} days`}
              className={cn(
                "rounded-md px-2.5 py-1 font-mono text-[11px] transition-colors focus-visible:outline-2 focus-visible:outline-primary-600",
                period === p ? "bg-signal-400 font-bold text-signal-ink shadow-xs" : "text-brand-500 hover:text-brand-950",
              )}
            >
              {p}d
            </button>
          ))}
        </div>

        {/* Credits Chip */}
        <TokensChip variant="bar" />

        {/* Theme Toggle */}
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={theme === "dark" ? "Switch to Day mode" : "Switch to Night mode"}
          title={theme === "dark" ? "Switch to Day mode" : "Switch to Night mode"}
          className="flex h-8 w-8 items-center justify-center rounded-lg border text-brand-500 transition-colors hover:bg-brand-50 hover:text-brand-950 focus-visible:outline-2 focus-visible:outline-primary-600"
          style={{ borderColor: "var(--border-color)" }}
        >
          {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
        </button>

        <button
          onClick={signOut}
          aria-label="Sign out"
          title="Sign out"
          className="flex h-8 w-8 items-center justify-center rounded-lg border text-brand-500 transition-colors hover:bg-brand-50 hover:text-brand-950 focus-visible:outline-2 focus-visible:outline-primary-600"
          style={{ borderColor: "var(--border-color)" }}
        >
          <LogOut size={13} />
        </button>
      </div>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </header>
  );
}
