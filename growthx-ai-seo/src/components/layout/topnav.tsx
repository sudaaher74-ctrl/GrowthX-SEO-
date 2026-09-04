"use client";
import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut, Menu, PanelLeftClose, PanelLeftOpen, Search, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api-client";

import Link from "next/link";
import { useWorkspace } from "@/hooks/use-growthx";

/** Breadcrumb scope + title for each route, matching the 11-section IA. */
const ROUTE_META: Record<string, { scope: string; title: string }> = {
  "/clients": { scope: "Portfolio", title: "Projects" },
  "/dashboard": { scope: "Workspace", title: "Dashboard" },
  "/website": { scope: "Workspace", title: "Website Audit" },
  "/technical-seo": { scope: "Workspace", title: "Website Audit" },
  "/search-performance": { scope: "Workspace", title: "Search Performance" },
  "/search/search-console": { scope: "Workspace", title: "Search Performance" },
  "/analytics": { scope: "Workspace", title: "Search Performance" },
  "/ai-visibility": { scope: "Workspace", title: "AI Visibility" },
  "/search": { scope: "Workspace", title: "AI Visibility" },
  "/geo-tracking": { scope: "Workspace", title: "AI Visibility" },
  "/competitor-intelligence": { scope: "Workspace", title: "Competitor Intelligence" },
  "/competitors": { scope: "Workspace", title: "Competitor Intelligence" },
  "/market-research": { scope: "Workspace", title: "Competitor Intelligence" },
  "/local": { scope: "Workspace", title: "Local SEO" },
  "/content-opportunities": { scope: "Workspace", title: "Content & Opportunities" },
  "/opportunities": { scope: "Workspace", title: "Content & Opportunities" },
  "/content-intelligence": { scope: "Workspace", title: "Content & Opportunities" },
  "/content": { scope: "Workspace", title: "Content & Opportunities" },
  "/monitoring": { scope: "Workspace", title: "Monitoring" },
  "/reports": { scope: "Workspace", title: "Reports" },
  "/integrations": { scope: "Workspace", title: "Integrations" },
  "/settings": { scope: "Workspace", title: "Settings" },
  "/projects": { scope: "Workspace", title: "Add Business" },
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
  const queryClient = useQueryClient();
  const { projectId, projects } = useWorkspace();
  const [period, setPeriod] = useState<(typeof PERIODS)[number]>("28d");

  const selectedProject = projects.find((p) => p.id === projectId) ?? projects[0] ?? null;

  async function signOut() {
    await api.logout();
    queryClient.clear();
    router.replace("/login");
  }

  const meta = ROUTE_META[pathname] ?? {
    scope: selectedProject ? selectedProject.name : "Workspace",
    title: pathname.replace(/^\//, "").replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) || "Dashboard",
  };

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

      {/* Breadcrumb with persistent Selected Project */}
      <div className="flex items-center gap-2 text-[13px]">
        {selectedProject ? (
          <Link
            href="/clients"
            className="flex items-center gap-1.5 font-medium text-brand-700 hover:text-brand-950 transition"
            title="Switch project"
          >
            <span className="flex h-5 w-5 items-center justify-center rounded bg-brand-100 font-mono text-[9px] font-bold text-brand-800">
              {selectedProject.name.slice(0, 2).toUpperCase()}
            </span>
            <span className="max-w-[130px] sm:max-w-[180px] truncate font-semibold">
              {selectedProject.name}
            </span>
          </Link>
        ) : (
          <span className="font-semibold text-brand-950">GrowthX AI</span>
        )}
        <span className="text-brand-300">/</span>
        <span className="font-medium text-brand-500">{meta.title}</span>
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
