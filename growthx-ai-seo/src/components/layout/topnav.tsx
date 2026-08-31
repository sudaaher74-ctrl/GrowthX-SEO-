"use client";
import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, Menu, PanelLeftClose, PanelLeftOpen, Search, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api-client";

/** Breadcrumb scope + title for each route, matching the design's header. */
const ROUTE_META: Record<string, { scope: string; title: string }> = {
  "/clients": { scope: "Portfolio", title: "Projects" },
  "/reports": { scope: "Workspace", title: "Reports" },
  "/settings": { scope: "Workspace", title: "Settings" },
  "/dashboard": { scope: "Workspace", title: "Overview" },
  "/geo-tracking": { scope: "Workspace", title: "AI Visibility" },
  "/strategy": { scope: "Workspace", title: "Growth Strategy" },
  "/keywords": { scope: "Workspace", title: "Search" },
  "/rank-tracking": { scope: "Workspace", title: "Rank tracking" },
  "/competitors": { scope: "Workspace", title: "Competitors" },
  "/technical-seo": { scope: "Workspace", title: "Site health" },
  "/backlinks": { scope: "Workspace", title: "Backlinks" },
  "/content-ai": { scope: "Workspace", title: "Content AI" },
};

const PERIODS = ["7d", "28d", "90d"] as const;

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
  const [period, setPeriod] = useState<(typeof PERIODS)[number]>("28d");

  // There was no way to sign out anywhere in the app, because there was no
  // real sign-in either — the shell logged everyone into one shared account.
  function signOut() {
    api.logout();
    router.replace("/login");
  }

  const meta = ROUTE_META[pathname] ?? { scope: "Workspace", title: "Workspace" };

  return (
    <header
      className={cn(
        "fixed left-0 right-0 top-0 z-30 flex h-[52px] items-center gap-3 border-b bg-white px-4 transition-all duration-300 ease-in-out",
        collapsed ? "md:left-0" : "md:left-[232px]",
      )}
      style={{ borderColor: "var(--border-color)" }}
    >
      <button className="md:hidden" onClick={() => setMobileOpen?.(true)} aria-label="Open navigation">
        <Menu size={18} className="text-brand-600" />
      </button>

      {/* Desktop Collapse Toggle */}
      <button
        onClick={onToggleCollapse}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        className="hidden md:flex h-8 w-8 items-center justify-center rounded-lg text-brand-500 hover:text-brand-950 hover:bg-brand-100/60 transition"
      >
        {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
      </button>

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-[13px]">
        <span className="text-brand-400">{meta.scope}</span>
        <span className="text-brand-300">/</span>
        <span className="font-semibold text-brand-950">{meta.title}</span>
      </div>

      <div className="ml-auto flex items-center gap-2">
        {/* Search */}
        <div
          className="hidden items-center gap-2 rounded-lg border px-2.5 py-1.5 lg:flex"
          style={{ borderColor: "var(--border-color)" }}
        >
          <Search size={13} className="text-brand-400" />
          <input
            placeholder="Search or jump to…"
            className="w-44 bg-transparent text-[12px] text-brand-950 outline-none placeholder:text-brand-400"
          />
          <kbd className="rounded border px-1 font-mono text-[9px] text-brand-400" style={{ borderColor: "var(--border-color)" }}>
            ⌘K
          </kbd>
        </div>

        {/* Period pills */}
        <div className="hidden items-center rounded-lg border p-0.5 sm:flex" style={{ borderColor: "var(--border-color)" }}>
          {PERIODS.map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={cn(
                "rounded-md px-2.5 py-1 font-mono text-[11px] transition-colors",
                period === p ? "bg-brand-100 font-semibold text-brand-950" : "text-brand-500 hover:text-brand-950",
              )}
            >
              {p}
            </button>
          ))}
        </div>

        <button className="flex items-center gap-1.5 rounded-lg bg-brand-950 px-3 py-1.5 text-[12px] font-semibold text-white transition-opacity hover:opacity-90">
          <Zap size={12} />
          Run audit
        </button>

        <button
          onClick={signOut}
          aria-label="Sign out"
          title="Sign out"
          className="rounded-lg border p-1.5 text-brand-500 transition-colors hover:text-brand-950"
          style={{ borderColor: "var(--border-color)" }}
        >
          <LogOut size={13} />
        </button>
      </div>
    </header>
  );
}
