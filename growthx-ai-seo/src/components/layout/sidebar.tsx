"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BarChart,
  Brain,
  ChevronsUpDown,
  Cpu,
  CreditCard,
  Crosshair,
  Edit3,
  FileText,
  Globe,
  HeartPulse,
  LayoutGrid,
  ListChecks,
  MapPin,
  Megaphone,
  MoreHorizontal,
  Search,
  Settings,
  Sparkles,
  TrendingUp,
  Telescope,
  Users,
  ChevronDown,
  ChevronRight,
  Bot
} from "lucide-react";

import { cn } from "@/lib/utils";
import { useEntitlements, usePortfolio, useWorkspace } from "@/hooks/use-growthx";

/**
 * Agency console sidebar.
 *
 * Two scopes, exactly as the design specifies: AGENCY-level work at the top,
 * then a client switcher and everything scoped to the selected client.
 */

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  /** Small right-aligned counter or metric. */
  tag?: string;
  tagTone?: "default" | "danger";
}

export function Sidebar({
  mobileOpen,
  setMobileOpen,
}: {
  collapsed?: boolean;
  onToggle?: () => void;
  mobileOpen?: boolean;
  setMobileOpen?: (open: boolean) => void;
}) {
  const pathname = usePathname();
  const { orgId, projects, projectId, setProjectId } = useWorkspace();
  const portfolio = usePortfolio(orgId);
  const entitlements = useEntitlements(orgId);
  const [switcherOpen, setSwitcherOpen] = useState(false);

  const selected = projects.find((p) => p.id === projectId) ?? projects[0] ?? null;
  const clientRow = portfolio.data?.clients.find((c) => c.projectId === selected?.id) ?? null;

  const agencyNav: NavItem[] = [
    { label: "Projects", href: "/clients", icon: LayoutGrid, tag: projects.length ? String(projects.length) : undefined },
  ];

  const clientNav: NavItem[] = [
    { label: "Overview", href: "/dashboard", icon: Activity },
    {
      label: "Website",
      href: "/website",
      icon: Globe,
      tag: clientRow?.criticalIssues ? String(clientRow.criticalIssues) : undefined,
      tagTone: "danger",
    },
    { label: "Search", href: "/search", icon: Search },
    { label: "Market Research", href: "/market-research", icon: Telescope },
    { label: "Competitors", href: "/competitors", icon: Crosshair },
    { label: "Content Intelligence", href: "/content-intelligence", icon: Brain },
    { label: "Content", href: "/content", icon: Edit3 },
    { label: "Local", href: "/local", icon: MapPin },
    { label: "Growth", href: "/marketing", icon: Megaphone },
    { label: "AI Agent", href: "/engineer", icon: Cpu },
    { label: "Monitoring", href: "/monitoring", icon: HeartPulse },
    { label: "Reports", href: "/reports", icon: BarChart },
  ];


  const crawlQuota = entitlements.data?.quotas.find((q) => q.metric === "CRAWL_PAGES");
  const crawlPct =
    crawlQuota && crawlQuota.limit ? Math.min(100, (crawlQuota.used / crawlQuota.limit) * 100) : 0;

  return (
    <>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/40 md:hidden" onClick={() => setMobileOpen?.(false)} />
      )}

      <aside
        className={cn(
          "fixed left-0 top-0 z-50 flex h-screen w-[232px] flex-col border-r bg-white transition-transform duration-200 md:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
        style={{ borderColor: "var(--border-color)" }}
      >
        {/* Brand */}
        <div className="flex h-[52px] shrink-0 items-center gap-[9px] border-b px-[14px]" style={{ borderColor: "var(--color-brand-100)" }}>
          <div className="flex h-6 w-6 items-center justify-center rounded-[7px] bg-brand-950">
            <LayoutGrid size={13} className="text-white" />
          </div>
          <span className="text-[13.5px] font-semibold tracking-[-0.02em] text-brand-950">GrowthX</span>
          <span className="text-[9.5px] font-semibold uppercase tracking-[0.09em] text-brand-400">AI SEO</span>
          {entitlements.data && (
            <span className="ml-auto rounded-[5px] bg-brand-100 px-[5px] py-[2px] font-mono text-[9px] font-semibold text-brand-600">
              {entitlements.data.plan}
            </span>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-3">
          <SectionLabel>Portfolio</SectionLabel>
          {agencyNav.map((item) => (
            <NavLink key={item.href} item={item} pathname={pathname} onNavigate={() => setMobileOpen?.(false)} />
          ))}

          <div className="mt-5">
            <SectionLabel>Workspace</SectionLabel>

            {/* Client switcher */}
            <div className="relative px-1">
              <button
                onClick={() => setSwitcherOpen((v) => !v)}
                disabled={projects.length === 0}
                className="flex w-full items-center gap-2 rounded-lg border bg-white px-2 py-2 text-left transition hover:bg-brand-50 disabled:opacity-60"
                style={{ borderColor: "var(--border-color)" }}
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-brand-100 font-mono text-[9px] font-semibold text-brand-700">
                  {selected ? initialsOf(selected.name) : "—"}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12px] font-semibold text-brand-950">
                    {selected?.name ?? "No projects yet"}
                  </span>
                  <span className="block truncate font-mono text-[9.5px] text-brand-400">
                    {clientRow?.domain ?? "add a website"}
                  </span>
                </span>
                <ChevronsUpDown size={13} className="shrink-0 text-brand-400" />
              </button>

              {switcherOpen && projects.length > 0 && (
                <div
                  className="absolute left-1 right-1 z-10 mt-1 overflow-hidden rounded-lg border bg-white shadow-lg"
                  style={{ borderColor: "var(--border-color)" }}
                >
                  {portfolio.data?.clients.map((client) => (
                    <button
                      key={client.projectId}
                      onClick={() => {
                        setProjectId(client.projectId);
                        setSwitcherOpen(false);
                      }}
                      className="flex w-full items-center gap-2 px-2 py-2 text-left hover:bg-brand-100"
                    >
                      <span className="flex h-5 w-5 items-center justify-center rounded bg-brand-100 font-mono text-[8px] font-semibold text-brand-700">
                        {client.initials}
                      </span>
                      <span className="flex-1 truncate text-[11.5px] text-brand-950">{client.name}</span>
                      <span className="font-mono text-[9.5px] text-brand-500">
                        {client.aiCitationSharePct != null ? `${client.aiCitationSharePct}%` : "—"}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-2">
              {clientNav.map((item) => (
                <NavLink key={item.href} item={item} pathname={pathname} onNavigate={() => setMobileOpen?.(false)} />
              ))}
            </div>

            <div className="mt-4 border-t pt-4" style={{ borderColor: "var(--color-brand-100)" }}>
              <NavLink 
                item={{ label: "Integrations", href: "/integrations", icon: LayoutGrid }} 
                pathname={pathname} 
                onNavigate={() => setMobileOpen?.(false)} 
              />
              <NavLink 
                item={{ label: "Settings", href: "/settings", icon: Settings }} 
                pathname={pathname} 
                onNavigate={() => setMobileOpen?.(false)} 
              />
            </div>
          </div>
        </nav>


        {/* User */}
        <div className="flex items-center gap-2 border-t px-[14px] py-3" style={{ borderColor: "var(--color-brand-100)" }}>
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-950 font-mono text-[10px] font-semibold text-white">
            {entitlements.data ? "SA" : "—"}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[11.5px] font-semibold text-brand-950">
              Workspace
            </span>
            <span className="block text-[10px] text-brand-400">Admin</span>
          </span>
          <MoreHorizontal size={14} className="text-brand-400" />
        </div>
      </aside>
    </>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-2 pb-1.5 pt-1">
      <span className="text-[9.5px] font-semibold uppercase tracking-[0.09em] text-brand-400">{children}</span>
    </div>
  );
}

function NavLink({
  item,
  pathname,
  onNavigate,
}: {
  item: NavItem;
  pathname: string;
  onNavigate: () => void;
}) {
  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
  return (
    <Link href={item.href} onClick={onNavigate}>
      <div
        className={cn(
          "flex items-center gap-[9px] rounded-lg px-2 py-[7px] text-[12.5px] font-medium transition-colors",
          active ? "bg-brand-100 text-brand-950" : "text-brand-600 hover:bg-brand-100",
        )}
      >
        <item.icon size={15} className={active ? "text-brand-900" : "text-brand-400"} />
        <span className="flex-1">{item.label}</span>
        {item.tag && (
          <span
            className={cn(
              "font-mono text-[10.5px] font-medium",
              item.tagTone === "danger" ? "text-error-500" : "text-brand-400",
            )}
          >
            {item.tag}
          </span>
        )}
      </div>
    </Link>
  );
}

function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1000)}k`;
  return String(n);
}
