"use client";
import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut, Menu, PanelLeftClose, PanelLeftOpen, RefreshCw, Search, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api-client";

import Link from "next/link";
import {
  PERIOD_DAYS,
  setActivePeriod,
  usePeriodDays,
  usePortfolio,
  useStartCrawl,
  useWorkspace,
} from "@/hooks/use-growthx";
import { CommandPalette } from "@/components/ui/command-palette";

/** Breadcrumb scope + title for each route, matching E-Commerce & Google Business Profile IA. */
const ROUTE_META: Record<string, { scope: string; title: string }> = {
  "/clients": { scope: "Portfolio", title: "Projects" },
  "/dashboard": { scope: "E-Commerce", title: "Dashboard" },
  "/website": { scope: "E-Commerce", title: "Website Audit" },
  "/technical-seo": { scope: "E-Commerce", title: "Website Audit" },
  "/competitor-intelligence": { scope: "E-Commerce", title: "Competitor Intelligence" },
  "/competitors": { scope: "E-Commerce", title: "Competitor Intelligence" },
  "/social-media": { scope: "E-Commerce", title: "Social Media" },
  "/local": { scope: "Google Business Profile", title: "Local SEO" },
  "/monitoring": { scope: "Google Business Profile", title: "Monitoring" },
  "/market-research": { scope: "Google Business Profile", title: "Market Research" },
  "/search-performance": { scope: "Workspace", title: "Search Performance" },
  "/search/search-console": { scope: "Workspace", title: "Search Performance" },
  "/analytics": { scope: "Workspace", title: "Search Performance" },
  "/ai-visibility": { scope: "Workspace", title: "AI Visibility" },
  "/search": { scope: "Workspace", title: "AI Visibility" },
  "/geo-tracking": { scope: "Workspace", title: "AI Visibility" },
  "/content-opportunities": { scope: "Workspace", title: "Content & Opportunities" },
  "/opportunities": { scope: "Workspace", title: "Content & Opportunities" },
  "/content-intelligence": { scope: "Workspace", title: "Content & Opportunities" },
  "/content": { scope: "Workspace", title: "Content & Opportunities" },
  "/marketing": { scope: "Workspace", title: "Marketing" },
  "/reports": { scope: "Workspace", title: "Reports" },
  "/integrations": { scope: "Workspace", title: "Integrations" },
  "/settings": { scope: "Workspace", title: "Settings" },
  "/projects": { scope: "Workspace", title: "Add Business" },
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
  const { orgId, projectId, projects } = useWorkspace();
  // Reads the shared window rather than a private copy, so the highlighted
  // pill is the window the queries are actually using.
  const period = usePeriodDays();
  // The palette was built, complete, and imported by nothing, while this bar
  // advertised ⌘K. It binds the shortcut itself once mounted.
  const [paletteOpen, setPaletteOpen] = useState(false);

  const selectedProject = projects.find((p) => p.id === projectId) ?? projects[0] ?? null;

  // The project list carries only id and name, so the domain comes from the
  // portfolio — the same cached query the sidebar and dashboard already run,
  // so this costs no extra request.
  const portfolio = usePortfolio(orgId);
  const startCrawl = useStartCrawl();
  const auditDomain =
    portfolio.data?.clients.find((client) => client.projectId === projectId)?.domain ??
    portfolio.data?.clients[0]?.domain ??
    null;

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
        {/* Was a bare <input> with no value, no onChange and no handler:
            typing in it did nothing at all. It is a button now, because
            opening the palette is the only thing it has ever been able to
            do, and a text cursor promised editing that was not there. */}
        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          className="hidden items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left transition-colors hover:border-brand-300 lg:flex"
          style={{ borderColor: "var(--border-color)" }}
        >
          <Search size={13} className="text-brand-400" />
          <span className="w-44 text-[12px] text-brand-400">Search or jump to…</span>
          <kbd className="rounded border px-1 font-mono text-[9px] text-brand-400" style={{ borderColor: "var(--border-color)" }}>
            ⌘K
          </kbd>
        </button>

        {/* Period pills */}
        <div className="hidden items-center rounded-lg border p-0.5 sm:flex" style={{ borderColor: "var(--border-color)" }}>
          {PERIOD_DAYS.map((p) => (
            <button
              key={p}
              onClick={() => setActivePeriod(p)}
              aria-pressed={period === p}
              title={`Show the last ${p} days`}
              className={cn(
                "rounded-md px-2.5 py-1 font-mono text-[11px] transition-colors",
                period === p ? "bg-brand-100 font-semibold text-brand-950" : "text-brand-500 hover:text-brand-950",
              )}
            >
              {p}d
            </button>
          ))}
        </div>

        {/* This was a black primary button with no onClick — the most
            prominent control in the product, on every page, doing nothing.
            It now starts the same crawl the dashboard's "Audit Website"
            starts, and lands on the audit page so the run is visible
            rather than happening silently somewhere off screen. */}
        <button
          onClick={() => {
            if (!auditDomain || startCrawl.isPending) return;
            startCrawl.mutate(
              { domain: auditDomain, maxDepth: 10, maxConcurrency: 3, useSitemap: true },
              { onSuccess: () => router.push("/website") },
            );
          }}
          disabled={!auditDomain || startCrawl.isPending}
          title={
            auditDomain
              ? `Crawl ${auditDomain} and refresh the audit`
              : "Add a project with a website before running an audit"
          }
          className="flex items-center gap-1.5 rounded-lg bg-brand-950 px-3 py-1.5 text-[12px] font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {startCrawl.isPending ? (
            <RefreshCw size={12} className="animate-spin" />
          ) : (
            <Zap size={12} />
          )}
          {startCrawl.isPending ? "Auditing…" : "Run audit"}
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

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </header>
  );
}
