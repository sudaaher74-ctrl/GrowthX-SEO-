"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronsUpDown,
  CreditCard,
  Edit3,
  FileText,
  HeartPulse,
  LayoutGrid,
  MoreHorizontal,
  Search,
  Settings,
  Sparkles,
  Users,
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
    { label: "Clients", href: "/clients", icon: Users, tag: projects.length ? String(projects.length) : undefined },
    { label: "Reports", href: "/reports", icon: FileText },
    { label: "Billing & settings", href: "/billing", icon: Settings },
  ];

  const clientNav: NavItem[] = [
    { label: "Overview", href: "/dashboard", icon: LayoutGrid },
    {
      label: "AI Visibility",
      href: "/geo-tracking",
      icon: Sparkles,
      tag: clientRow?.aiCitationSharePct != null ? `${Math.round(clientRow.aiCitationSharePct)}%` : undefined,
    },
    { label: "Search", href: "/keywords", icon: Search },
    {
      label: "Site health",
      href: "/technical-seo",
      icon: HeartPulse,
      tag: clientRow?.criticalIssues ? String(clientRow.criticalIssues) : undefined,
      tagTone: "danger",
    },
    { label: "Content AI", href: "/content-ai", icon: Edit3 },
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
        <div className="flex h-[52px] shrink-0 items-center gap-[9px] border-b px-[14px]" style={{ borderColor: "#f4f4f5" }}>
          <div className="flex h-6 w-6 items-center justify-center rounded-[7px] bg-[#09090b]">
            <LayoutGrid size={13} className="text-white" />
          </div>
          <span className="text-[13.5px] font-semibold tracking-[-0.02em] text-[#09090b]">GrowthX</span>
          <span className="text-[9.5px] font-semibold uppercase tracking-[0.09em] text-[#a1a1aa]">AI SEO</span>
          {entitlements.data && (
            <span className="ml-auto rounded-[5px] bg-[#f4f4f5] px-[5px] py-[2px] font-mono text-[9px] font-semibold text-[#52525b]">
              {entitlements.data.plan}
            </span>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-3">
          <SectionLabel>Agency</SectionLabel>
          {agencyNav.map((item) => (
            <NavLink key={item.href} item={item} pathname={pathname} onNavigate={() => setMobileOpen?.(false)} />
          ))}

          <div className="mt-5">
            <SectionLabel>Client workspace</SectionLabel>

            {/* Client switcher */}
            <div className="relative px-1">
              <button
                onClick={() => setSwitcherOpen((v) => !v)}
                disabled={projects.length === 0}
                className="flex w-full items-center gap-2 rounded-lg border bg-white px-2 py-2 text-left transition hover:bg-[#fafafa] disabled:opacity-60"
                style={{ borderColor: "var(--border-color)" }}
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[#f4f4f5] font-mono text-[9px] font-semibold text-[#3f3f46]">
                  {selected ? initialsOf(selected.name) : "—"}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12px] font-semibold text-[#09090b]">
                    {selected?.name ?? "No clients yet"}
                  </span>
                  <span className="block truncate font-mono text-[9.5px] text-[#a1a1aa]">
                    {clientRow?.domain ?? "add a website"}
                  </span>
                </span>
                <ChevronsUpDown size={13} className="shrink-0 text-[#a1a1aa]" />
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
                      className="flex w-full items-center gap-2 px-2 py-2 text-left hover:bg-[#f4f4f5]"
                    >
                      <span className="flex h-5 w-5 items-center justify-center rounded bg-[#f4f4f5] font-mono text-[8px] font-semibold text-[#3f3f46]">
                        {client.initials}
                      </span>
                      <span className="flex-1 truncate text-[11.5px] text-[#09090b]">{client.name}</span>
                      <span className="font-mono text-[9.5px] text-[#71717a]">
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
          </div>
        </nav>

        {/* Crawl credits */}
        <div className="border-t px-[14px] py-3" style={{ borderColor: "#f4f4f5" }}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-[0.07em] text-[#a1a1aa]">
              Crawl credits
            </span>
            <span className="font-mono text-[10px] text-[#52525b]">
              {crawlQuota
                ? `${compact(crawlQuota.used)} / ${crawlQuota.limit ? compact(crawlQuota.limit) : "∞"}`
                : "—"}
            </span>
          </div>
          <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-[#f4f4f5]">
            <div
              className="h-full rounded-full"
              style={{ width: `${crawlPct}%`, background: crawlPct > 80 ? "#d97706" : "#2563eb" }}
            />
          </div>
          <Link href="/billing" className="mt-2 block text-[11px] font-medium text-[#2563eb] hover:underline">
            Manage plan →
          </Link>
        </div>

        {/* User */}
        <div className="flex items-center gap-2 border-t px-[14px] py-3" style={{ borderColor: "#f4f4f5" }}>
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#09090b] font-mono text-[10px] font-semibold text-white">
            {entitlements.data ? "SA" : "—"}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[11.5px] font-semibold text-[#09090b]">
              {entitlements.data?.planName ?? "Not signed in"}
            </span>
            <span className="block text-[10px] text-[#a1a1aa]">Agency owner</span>
          </span>
          <MoreHorizontal size={14} className="text-[#a1a1aa]" />
        </div>
      </aside>
    </>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-2 pb-1.5 pt-1">
      <span className="text-[9.5px] font-semibold uppercase tracking-[0.09em] text-[#a1a1aa]">{children}</span>
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
          active ? "bg-[#f4f4f5] text-[#09090b]" : "text-[#52525b] hover:bg-[#f4f4f5]",
        )}
      >
        <item.icon size={15} className={active ? "text-[#18181b]" : "text-[#a1a1aa]"} />
        <span className="flex-1">{item.label}</span>
        {item.tag && (
          <span
            className={cn(
              "font-mono text-[10.5px] font-medium",
              item.tagTone === "danger" ? "text-[#dc2626]" : "text-[#a1a1aa]",
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
