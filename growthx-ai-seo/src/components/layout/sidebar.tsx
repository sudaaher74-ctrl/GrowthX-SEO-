"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Check, ChevronRight, LayoutGrid, LogOut, MoreHorizontal, PanelLeftClose, Settings, FileText } from "lucide-react";

import { cn } from "@/lib/utils";
import { api } from "@/lib/api-client";
import { useProfile } from "@/hooks/use-growthx";
import { TokensChip } from "@/components/tokens/tokens-chip";
import { SiteSwitcher } from "@/components/layout/site-switcher";
import { useMainNav, type NavItem } from "@/components/layout/nav-items";

/**
 * Agency console sidebar.
 *
 * Scoped to the selected client with core workspace tabs:
 * Dashboard, Website Audit, Google, Competitor Intelligence, AI Visibility, Google Business Profile, Fix Engine
 */


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
  const profile = useProfile();
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const { mainNav } = useMainNav();

  return (
    <>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/40 md:hidden" onClick={() => setMobileOpen?.(false)} />
      )}

      <aside
        className={cn(
          "fixed left-0 top-0 z-50 flex h-screen w-[var(--sidebar-w,232px)] flex-col border-r bg-white transition-all duration-300 ease-in-out",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          collapsed ? "md:-translate-x-full" : "md:translate-x-0",
        )}
        style={{ borderColor: "var(--border-color)" }}
      >
        {/* Brand */}
        <div className="flex h-[52px] shrink-0 items-center gap-[9px] border-b px-[14px]" style={{ borderColor: "var(--color-brand-100)" }}>
          <div className="flex h-6 w-6 items-center justify-center rounded-[7px] bg-gradient-to-br from-primary-500 to-primary-700 shadow-sm">
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
          <div>
            <SectionLabel>Workspace</SectionLabel>

            <SiteSwitcher onDone={() => setMobileOpen?.(false)} />

            {/* Main Tabs */}
            <SectionLabel>Workflow</SectionLabel>
            <div className="space-y-0.5">
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
                item={{ label: "Reports", href: "/reports", icon: FileText }} 
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

        <TokensChip onNavigate={() => setMobileOpen?.(false)} />

        {/* User */}
        {(() => {
          const user = profile.data;
          const userFullName = [user?.firstName, user?.lastName].filter(Boolean).join(" ");
          const displayName = userFullName || user?.email?.split("@")[0] || "Workspace";
          const displayEmail = user?.email || "User";
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
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-600 font-mono text-[10px] font-semibold text-white">
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
  if (item.disabled) {
    return (
      <div
        className="flex items-center gap-[9px] rounded-lg px-2 py-[7px] text-[12.5px] cursor-not-allowed opacity-40 select-none font-medium text-brand-400"
        title={`${item.label} is disabled`}
      >
        <item.icon size={15} className="text-brand-400" />
        <span className="flex-1 truncate">{item.label}</span>
        {item.tag && (
          <span className="shrink-0 rounded-full px-[6px] py-px font-mono text-[9px] font-semibold leading-[14px] bg-brand-100 text-brand-500 border">
            {item.tag}
          </span>
        )}
      </div>
    );
  }

  const active =
    pathname === item.href ||
    pathname.startsWith(`${item.href}/`) ||
    (item.aliases ? item.aliases.some((a) => pathname === a || pathname.startsWith(`${a}/`)) : false);

  return <NavLinkEnabled item={item} pathname={pathname} active={active} onNavigate={onNavigate} />;
}

/**
 * A nav item that can open. Clicking it goes to its page and opens its sub-tabs
 * underneath; the chevron opens or closes them without leaving the page. An
 * item whose page is showing starts open.
 */
function NavLinkEnabled({
  item,
  pathname,
  active,
  onNavigate,
}: {
  item: NavItem;
  pathname: string;
  active: boolean;
  onNavigate: () => void;
}) {
  const searchParams = useSearchParams();
  const hasChildren = Boolean(item.children?.length);
  // null = follow the page: open while it is the current one.
  const [manual, setManual] = useState<boolean | null>(null);
  const showChildren = hasChildren && (manual ?? active);
  const currentTab = searchParams.get("tab");

  return (
    <div className="space-y-0.5">
      <div
        data-nav-active={active}
        className={cn(
          "flex items-center rounded-lg text-[12.5px] transition-colors",
          active
            ? "bg-primary-50 font-semibold text-primary-700"
            : "font-medium text-brand-600 hover:bg-brand-100 hover:text-brand-950",
        )}
      >
        <Link
          href={item.href}
          onClick={() => {
            if (hasChildren) setManual(true);
            onNavigate();
          }}
          className="flex min-w-0 flex-1 items-center gap-[9px] px-2 py-[7px]"
        >
          <item.icon size={15} className={active ? "text-primary-600" : "text-brand-400"} />
          <span className="flex-1 truncate">{item.label}</span>
          {item.step && (
            <span
              title={`Step ${item.step.n}: ${item.step.hint}`}
              aria-label={`Step ${item.step.n}${item.step.done ? ", done" : ""}`}
              className={cn(
                "flex h-4 w-4 shrink-0 items-center justify-center rounded-full font-mono text-[9px] font-bold",
                item.step.done
                  ? "bg-success-500 text-white"
                  : active
                    ? "border border-primary-300 text-primary-700"
                    : "border text-brand-500",
              )}
            >
              {item.step.done ? <Check size={10} strokeWidth={3} /> : item.step.n}
            </span>
          )}
          {item.tag && (
            <span
              className={cn(
                "shrink-0 rounded-full px-[6px] py-px font-mono text-[9.5px] font-semibold leading-[14px]",
                item.tagTone === "danger"
                  ? "bg-error-50 text-error-700"
                  : item.tagTone === "success"
                    ? active
                      ? "bg-success-100 text-success-700 border border-success-200"
                      : "bg-success-50 text-success-700 border border-success-200"
                    : active
                      ? "bg-primary-100 text-primary-700"
                      : "bg-brand-200 text-brand-600",
              )}
            >
              {item.tag}
            </span>
          )}
        </Link>
        {hasChildren && (
          <button
            type="button"
            onClick={() => setManual(!showChildren)}
            aria-expanded={showChildren}
            aria-label={`${showChildren ? "Close" : "Open"} ${item.label} tabs`}
            className="mr-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-brand-400 transition hover:text-brand-950"
          >
            <ChevronRight size={13} className={cn("transition-transform duration-200", showChildren && "rotate-90")} />
          </button>
        )}
      </div>

      {showChildren && (
        <div className="ml-5 space-y-0.5 border-l border-brand-200 py-1 pl-2">
          {item.children?.map((sub) => {
            const isSubActive = sub.tab
              ? active && (currentTab === sub.tab || (!currentTab && Boolean(sub.isDefault)))
              : pathname === sub.href;
            return (
              <Link
                key={sub.id}
                href={sub.href}
                onClick={onNavigate}
                aria-current={isSubActive ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2 truncate rounded px-2 py-1 text-[11.5px] transition",
                  isSubActive
                    ? "bg-brand-100 font-bold text-brand-950"
                    : "font-medium text-brand-600 hover:bg-brand-100/60 hover:text-brand-950",
                )}
              >
                <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", isSubActive ? "bg-primary-600" : "bg-brand-300")} />
                <span className="truncate">{sub.label}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

