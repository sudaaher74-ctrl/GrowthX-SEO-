"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Activity, ChevronsUpDown, Crosshair, Globe, LayoutGrid, LogOut, MoreHorizontal, PanelLeftClose, Settings, Sparkles, Wrench, Store, FileBarChart, Zap } from "lucide-react";

import { cn } from "@/lib/utils";
import { api } from "@/lib/api-client";
import { useEntitlements, usePortfolio, useWorkspace, useProfile } from "@/hooks/use-growthx";

/**
 * Agency console sidebar.
 *
 * Scoped to the selected client with core workspace tabs:
 * Dashboard, Website Audit, Competitor Intelligence, AI Visibility, Fix Engine, Google Business Profile
 */

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  aliases?: string[];
  /** Small right-aligned counter or metric. */
  tag?: string;
  tagTone?: "default" | "danger" | "success";
  children?: { label: string; href: string; id: string }[];
}

export function Sidebar({
  collapsed = false,
  onToggle,
  mobileOpen,
  setMobileOpen,
}: {
  collapsed?: boolean;
  onToggle?: () => void;
  mobileOpen?: boolean;
  setMobileOpen?: (open: boolean) => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { orgId, projects, projectId, setProjectId } = useWorkspace();
  const portfolio = usePortfolio(orgId);
  const entitlements = useEntitlements(orgId);
  const profile = useProfile();
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const selected = projects.find((p) => p.id === projectId) ?? projects[0] ?? null;
  const clientRow = portfolio.data?.clients.find((c) => c.projectId === selected?.id) ?? null;

  const agencyNav: NavItem[] = [
    { label: "Projects", href: "/clients", icon: LayoutGrid, tag: projects.length ? String(projects.length) : undefined },
  ];

  // Core Navigation Tabs strictly following Master Product Specification Section 26
  const mainNav: NavItem[] = [
    {
      label: "Dashboard",
      href: "/dashboard",
      icon: Activity,
    },
    {
      label: "Website Audit",
      href: "/website",
      icon: Globe,
      aliases: ["/technical-seo"],
      tag: clientRow?.criticalIssues ? String(clientRow.criticalIssues) : undefined,
      tagTone: "danger",
    },
    {
      label: "AI Visibility",
      href: "/ai-visibility",
      icon: Sparkles,
      aliases: ["/geo-tracking", "/search"],
      children: [
        { label: "Overview", href: "/ai-visibility?tab=overview", id: "overview" },
        { label: "AI Insights", href: "/ai-visibility?tab=insights", id: "insights" },
        { label: "Citations", href: "/ai-visibility?tab=citations", id: "citations" },
        { label: "Competitors", href: "/ai-visibility?tab=competitors", id: "competitors" },
        { label: "Content Gaps", href: "/ai-visibility?tab=gaps", id: "gaps" },
        { label: "Recommendations", href: "/ai-visibility?tab=recommendations", id: "recommendations" },
      ],
    },
    {
      label: "Competitor Intelligence",
      href: "/competitor-intelligence",
      icon: Crosshair,
      aliases: ["/competitors", "/market"],
    },
    {
      label: "Fix Engine",
      href: "/fix-engine",
      icon: Wrench,
      tag: "Auto",
      tagTone: "success",
      aliases: ["/engineer", "/action-engine"],
      children: [
        { label: "Current Plan", href: "/fix-engine?tab=overview", id: "overview" },
        { label: "Implementation", href: "/fix-engine?tab=implementation", id: "implementation" },
        { label: "Verification", href: "/fix-engine?tab=verification", id: "verification" },
        { label: "History & Cycles", href: "/fix-engine?tab=history", id: "history" },
      ],
    },
    {
      label: "Google Business Profile",
      href: "/google-business-profile",
      icon: Store,
      tag: "Local",
      tagTone: "default",
      children: [
        { label: "Overview", href: "/google-business-profile?tab=overview", id: "overview" },
        { label: "Profile Audit", href: "/google-business-profile?tab=audit", id: "audit" },
        { label: "Reviews", href: "/google-business-profile?tab=reviews", id: "reviews" },
        { label: "Photos", href: "/google-business-profile?tab=photos", id: "photos" },
        { label: "Services", href: "/google-business-profile?tab=services", id: "services" },
        { label: "Categories", href: "/google-business-profile?tab=categories", id: "categories" },
        { label: "Local Rankings", href: "/google-business-profile?tab=rankings", id: "rankings" },
        { label: "Competitors", href: "/google-business-profile?tab=competitors", id: "competitors" },
        { label: "Posts", href: "/google-business-profile?tab=posts", id: "posts" },
        { label: "AI Recommendations", href: "/google-business-profile?tab=ai-recommendations", id: "ai-recommendations" },
        { label: "Action Plan", href: "/google-business-profile?tab=action-plan", id: "action-plan" },
      ],
    },
    {
      label: "Content Velocity",
      href: "/content-velocity",
      icon: Zap,
      tag: "New",
      tagTone: "success",
    },
    {
      label: "Reports",
      href: "/reports",
      icon: FileBarChart,
    },
  ];

  return (
    <>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/40 md:hidden" onClick={() => setMobileOpen?.(false)} />
      )}

      <aside
        className={cn(
          "fixed left-0 top-0 z-50 flex h-screen w-[232px] flex-col border-r bg-white transition-all duration-300 ease-in-out",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          collapsed ? "md:-translate-x-full" : "md:translate-x-0",
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
          
          <button
            onClick={onToggle}
            title="Collapse sidebar"
            className="hidden md:flex ml-auto items-center justify-center h-6 w-6 rounded-md text-brand-400 hover:text-brand-950 hover:bg-brand-50 transition"
          >
            <PanelLeftClose size={13} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-3">
          <SectionLabel>Portfolio</SectionLabel>
          {agencyNav.map((item) => (
            <NavLink key={item.href} item={item} pathname={pathname} onNavigate={() => setMobileOpen?.(false)} />
          ))}

          <div className="mt-5">
            <SectionLabel>Workspace</SectionLabel>

            {/* Client switcher */}
            <div className="relative px-1 mb-3">
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

            {/* Main Tabs */}
            <div className="space-y-0.5 mt-2">
              {mainNav.map((item) => (
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
        {(() => {
          const user = profile.data;
          const userFullName = [user?.firstName, user?.lastName].filter(Boolean).join(" ");
          const displayName = userFullName || user?.email?.split("@")[0] || "Workspace";
          const displayEmail = user?.email || (entitlements.data ? "Workspace Admin" : "User");
          const userInitials = user?.firstName
            ? (user.firstName[0] + (user.lastName?.[0] || "")).toUpperCase()
            : user?.email
              ? user.email.slice(0, 2).toUpperCase()
              : "SA";

          async function handleLogout() {
            setUserMenuOpen(false);
            setMobileOpen?.(false);
            await api.logout();
            queryClient.clear();
            router.replace("/login");
          }

          return (
            <div className="relative border-t p-2" style={{ borderColor: "var(--color-brand-100)" }}>
              {userMenuOpen && (
                <>
                  <div className="fixed inset-0 z-20" onClick={() => setUserMenuOpen(false)} />
                  <div
                    className="absolute bottom-full left-2 right-2 z-30 mb-2 overflow-hidden rounded-xl border bg-white p-1.5 shadow-xl transition-all"
                    style={{ borderColor: "var(--border-color)" }}
                  >
                    <div className="border-b px-3 py-2.5" style={{ borderColor: "var(--color-brand-100)" }}>
                      <p className="text-[12px] font-semibold text-brand-950 truncate">{displayName}</p>
                      <p className="text-[10.5px] text-brand-500 truncate">{displayEmail}</p>
                      {user?.googleId && (
                        <span className="mt-1.5 inline-flex items-center gap-1 rounded bg-blue-50 px-1.5 py-0.5 text-[9.5px] font-medium text-blue-700">
                          Google Account
                        </span>
                      )}
                    </div>
                    <div className="py-1">
                      <Link
                        href="/settings"
                        onClick={() => {
                          setUserMenuOpen(false);
                          setMobileOpen?.(false);
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-[12px] font-medium text-brand-700 hover:bg-brand-50 hover:text-brand-950 transition"
                      >
                        <Settings size={14} className="text-brand-400" />
                        Settings
                      </Link>
                      <button
                        onClick={handleLogout}
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-[12px] font-medium text-red-600 hover:bg-red-50 hover:text-red-700 transition"
                      >
                        <LogOut size={14} className="text-red-500" />
                        Log out
                      </button>
                    </div>
                  </div>
                </>
              )}

              <button
                type="button"
                onClick={() => setUserMenuOpen((v) => !v)}
                className="flex w-full items-center gap-2.5 rounded-lg p-2 text-left hover:bg-brand-50 transition"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-950 font-mono text-[10px] font-semibold text-white">
                  {userInitials}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[11.5px] font-semibold text-brand-950">
                    {displayName}
                  </span>
                  <span className="block truncate text-[10px] text-brand-400">
                    {displayEmail}
                  </span>
                </span>
                <MoreHorizontal size={14} className="shrink-0 text-brand-400" />
              </button>
            </div>
          );
        })()}
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
  const active =
    pathname === item.href ||
    pathname.startsWith(`${item.href}/`) ||
    (item.aliases ? item.aliases.some((a) => pathname === a || pathname.startsWith(`${a}/`)) : false);

  const showChildren = (active || pathname.startsWith(item.href)) && Boolean(item.children);

  return (
    <div className="space-y-0.5">
      <Link href={item.href} onClick={onNavigate}>
        <div
          className={cn(
            "flex items-center gap-[9px] rounded-lg px-2 py-[7px] text-[12.5px] transition-colors",
            active
              ? "bg-brand-950 font-semibold text-white"
              : "font-medium text-brand-600 hover:bg-brand-100 hover:text-brand-950",
          )}
        >
          <item.icon size={15} className={active ? "text-white" : "text-brand-400"} />
          <span className="flex-1 truncate">{item.label}</span>
          {item.tag && (
            <span
              className={cn(
                "shrink-0 rounded-full px-[6px] py-px font-mono text-[9.5px] font-semibold leading-[14px]",
                item.tagTone === "danger"
                  ? "bg-error-50 text-error-700"
                  : item.tagTone === "success"
                    ? active
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-400/30"
                      : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : active
                      ? "bg-white/15 text-white"
                      : "bg-brand-200 text-brand-600",
              )}
            >
              {item.tag}
            </span>
          )}
        </div>
      </Link>

      {/* Sub-items for navigation children */}
      {showChildren && (
        <div className="ml-5 pl-2 border-l border-brand-200 space-y-0.5 py-1">
          {item.children?.map((sub) => {
            const currentSearch = typeof window !== "undefined" ? window.location.search : "";
            const isSubActive = sub.href.includes("?")
              ? currentSearch.includes(sub.href.split("?")[1])
              : pathname === sub.href;
            return (
              <Link
                key={sub.id}
                href={sub.href}
                onClick={onNavigate}
                className={cn(
                  "block py-1 px-2 text-[11.5px] rounded transition truncate",
                  isSubActive
                    ? "bg-purple-50 text-purple-700 font-bold"
                    : "text-brand-600 hover:text-brand-950 font-medium hover:bg-brand-100/60"
                )}
              >
                {sub.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}
