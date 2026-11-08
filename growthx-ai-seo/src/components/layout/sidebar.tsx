"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  Check,
  Compass,
  LogOut,
  Moon,
  MoreHorizontal,
  PanelLeftClose,
  Settings,
  Sun,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { api } from "@/lib/api-client";
import { useProfile } from "@/hooks/use-growthx";
import { useTheme } from "@/hooks/use-theme";
import { resetTour } from "@/hooks/use-tour";
import { SiteSwitcher } from "@/components/layout/site-switcher";
import { useMainNav, type NavGroupKey, type NavItem } from "@/components/layout/nav-items";

const NAV_GROUPS: { key: NavGroupKey; label: string }[] = [
  { key: "overview", label: "Overview & Search" },
  { key: "intelligence", label: "Intelligence & AI" },
  { key: "execution", label: "Execution & Proof" },
];

export function Sidebar({
  collapsed = false,
  onToggleCollapse,
  mobileOpen,
  setMobileOpen,
}: {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  mobileOpen?: boolean;
  setMobileOpen?: (open: boolean) => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const profile = useProfile();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();

  const { mainNav } = useMainNav();
  const compact = collapsed && !mobileOpen;

  const stepItems = mainNav.filter((item) => item.step);
  const completedSteps = stepItems.filter((item) => item.step?.done).length;

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs md:hidden"
          onClick={() => setMobileOpen?.(false)}
        />
      )}

      <aside
        className={cn(
          "fixed left-0 top-0 z-50 flex h-screen flex-col border-r bg-surface-1 transition-all duration-300 ease-in-out",
          "w-[232px]",
          collapsed ? "md:w-[68px] md:translate-x-0" : "md:w-[232px] md:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
        style={{ borderColor: "var(--border-color)" }}
      >
        {/* Brand Header */}
        <div
          className={cn(
            "flex h-[52px] shrink-0 items-center border-b",
            compact ? "justify-center px-2" : "justify-between px-3",
          )}
          style={{ borderColor: "var(--border-color)" }}
        >
          <Link
            href="/dashboard"
            onClick={() => setMobileOpen?.(false)}
            title="Reigel AI SEO"
            className="flex min-w-0 items-center gap-2.5"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-signal-400 font-mono text-xs font-black text-signal-ink shadow-xs transition-transform hover:scale-105">
              R
            </span>
            {!compact && (
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="truncate text-[14px] font-extrabold tracking-[-0.02em] text-brand-950">
                  Reigel
                </span>
                <span className="shrink-0 rounded-md border border-brand-200 bg-surface-2 px-1.5 py-0.5 font-mono text-[8.5px] font-bold uppercase tracking-wider text-brand-500">
                  AI SEO
                </span>
              </div>
            )}
          </Link>

          {!compact && onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              title="Collapse sidebar"
              aria-label="Collapse sidebar"
              className="hidden h-7 w-7 shrink-0 items-center justify-center rounded-lg text-brand-400 transition hover:bg-surface-2 hover:text-brand-950 md:flex"
            >
              <PanelLeftClose size={14} />
            </button>
          )}
        </div>

        {/* Main Navigation */}
        <nav
          className={cn(
            "flex-1 overflow-y-auto py-3",
            compact ? "px-1.5 overflow-x-visible" : "px-2.5",
          )}
        >
          {!compact && (
            <div className="mb-3">
              <div className="flex items-center justify-between px-1 pb-1.5">
                <span className="text-[9.5px] font-bold uppercase tracking-[0.1em] text-brand-400">
                  Workspace
                </span>
                {stepItems.length > 0 && (
                  <span
                    title={`${completedSteps} of ${stepItems.length} core setup steps complete`}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-mono text-[9px] font-bold",
                      completedSteps === stepItems.length
                        ? "border border-success-500/30 bg-success-50 text-success-700"
                        : "border border-brand-200 bg-surface-2 text-brand-500",
                    )}
                  >
                    {completedSteps}/{stepItems.length} Ready
                  </span>
                )}
              </div>
              <SiteSwitcher onDone={() => setMobileOpen?.(false)} />
            </div>
          )}

          <div className={cn(compact ? "space-y-2" : "space-y-4")}>
            {NAV_GROUPS.map((group, groupIndex) => {
              const items = mainNav.filter((item) => (item.group ?? "overview") === group.key);
              if (!items.length) return null;

              return (
                <div key={group.key}>
                  {compact ? (
                    groupIndex > 0 && (
                      <div
                        className="mx-auto my-2 h-px w-6 border-t"
                        style={{ borderColor: "var(--border-color)" }}
                      />
                    )
                  ) : (
                    <SectionLabel>{group.label}</SectionLabel>
                  )}

                  <div className={cn("space-y-1", compact && "flex flex-col items-center")}>
                    {items.map((item) => (
                      <NavLink
                        key={item.href}
                        item={item}
                        pathname={pathname}
                        collapsed={compact}
                        onNavigate={() => setMobileOpen?.(false)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <div
            className={cn("border-t", compact ? "mt-3 pt-3" : "mt-4 pt-3")}
            style={{ borderColor: "var(--border-color)" }}
          >
            {!compact && <SectionLabel>System</SectionLabel>}
            <NavLink
              item={{ label: "Settings", href: "/settings", icon: Settings }}
              pathname={pathname}
              collapsed={compact}
              onNavigate={() => setMobileOpen?.(false)}
            />
          </div>
        </nav>

        {/* User Profile Dock */}
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
            <div className="relative border-t p-2" style={{ borderColor: "var(--border-color)" }}>
              {userMenuOpen && (
                <>
                  <div className="fixed inset-0 z-20" onClick={() => setUserMenuOpen(false)} />
                  <div
                    className={cn(
                      "absolute z-30 mb-2 overflow-hidden rounded-xl border bg-surface-1 p-1.5 shadow-xl transition-all",
                      compact ? "left-[68px] bottom-2 w-[240px]" : "bottom-full left-2 right-2",
                    )}
                    style={{ borderColor: "var(--border-color)" }}
                  >
                    <div className="border-b px-3 py-2.5" style={{ borderColor: "var(--border-color)" }}>
                      <p className="truncate text-[12px] font-bold text-brand-950">{displayName}</p>
                      <p className="truncate text-[10.5px] text-brand-500">{displayEmail}</p>
                      {user?.googleId && (
                        <span className="mt-1.5 inline-flex items-center gap-1 rounded-md border border-brand-200 bg-surface-2 px-1.5 py-0.5 text-[9.5px] font-semibold text-brand-700">
                          Google Account
                        </span>
                      )}
                    </div>
                    <div className="py-1">
                      <button
                        type="button"
                        onClick={() => toggleTheme()}
                        className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-[12px] font-medium text-brand-700 transition hover:bg-surface-2 hover:text-brand-950"
                      >
                        <div className="flex items-center gap-2">
                          {theme === "dark" ? (
                            <Sun size={14} className="text-brand-400" />
                          ) : (
                            <Moon size={14} className="text-brand-400" />
                          )}
                          <span>{theme === "dark" ? "Day mode" : "Night mode"}</span>
                        </div>
                        <span className="rounded-full bg-signal-400/20 px-2 py-0.5 font-mono text-[9.5px] font-bold text-brand-900">
                          {theme === "dark" ? "Night" : "Day"}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setUserMenuOpen(false);
                          setMobileOpen?.(false);
                          resetTour();
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-[12px] font-medium text-brand-700 transition hover:bg-surface-2 hover:text-brand-950 cursor-pointer"
                      >
                        <Compass size={14} className="text-brand-400" />
                        <span>Platform Tour</span>
                      </button>

                      <Link
                        href="/settings"
                        onClick={() => {
                          setUserMenuOpen(false);
                          setMobileOpen?.(false);
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-[12px] font-medium text-brand-700 transition hover:bg-surface-2 hover:text-brand-950"
                      >
                        <Settings size={14} className="text-brand-400" />
                        Settings
                      </Link>
                      <button
                        onClick={handleLogout}
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-[12px] font-medium text-error-600 transition hover:bg-error-50 hover:text-error-700"
                      >
                        <LogOut size={14} className="text-error-500" />
                        Log out
                      </button>
                    </div>
                  </div>
                </>
              )}

              <button
                type="button"
                onClick={() => setUserMenuOpen((v) => !v)}
                title={compact ? `${displayName} (${displayEmail})` : undefined}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-xl border border-transparent p-1.5 text-left transition-all hover:border-brand-200 hover:bg-surface-2",
                  compact && "justify-center p-1",
                )}
              >
                <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-signal-400 font-mono text-[10.5px] font-black text-signal-ink shadow-xs">
                  {userInitials}
                  <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full bg-success-500 ring-2 ring-surface-1" />
                </span>
                {!compact && (
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12px] font-bold leading-tight text-brand-950">
                      {displayName}
                    </span>
                    <span className="mt-0.5 block truncate text-[10px] leading-tight text-brand-400">
                      {displayEmail}
                    </span>
                  </span>
                )}
                {!compact && <MoreHorizontal size={14} className="shrink-0 text-brand-400" />}
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
    <div className="px-1.5 pb-1.5 pt-0.5">
      <span className="text-[9.5px] font-bold uppercase tracking-[0.1em] text-brand-400">
        {children}
      </span>
    </div>
  );
}

function NavLink({
  item,
  pathname,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  pathname: string;
  collapsed: boolean;
  onNavigate: () => void;
}) {
  const searchParams = useSearchParams();
  const currentTab = searchParams.get("tab");

  if (item.disabled) {
    return (
      <div
        className={cn(
          "flex items-center rounded-xl py-2 text-[12.5px] cursor-not-allowed opacity-40 select-none font-medium text-brand-400",
          collapsed ? "justify-center px-0" : "gap-2.5 px-2",
        )}
        title={`${item.label} is disabled`}
      >
        <item.icon size={16} className="text-brand-400" />
        {!collapsed && <span className="min-w-0 flex-1 leading-snug">{item.label}</span>}
        {!collapsed && item.tag && (
          <span className="shrink-0 rounded-full px-1.5 py-px font-mono text-[9px] font-semibold leading-[14px] bg-brand-100 text-brand-500 border">
            {item.tag}
          </span>
        )}
      </div>
    );
  }

  const [itemPath, itemQuery] = item.href.split("?");
  const itemTab = itemQuery ? new URLSearchParams(itemQuery).get("tab") : null;

  let active = false;
  if (itemTab) {
    active =
      (pathname === itemPath || (item.aliases?.includes(pathname) ?? false)) &&
      currentTab === itemTab;
  } else if (itemPath === "/ai-visibility") {
    active = pathname === "/ai-visibility" || pathname.startsWith("/ai-visibility/");
  } else if (itemPath === "/fix-engine") {
    active = pathname === "/fix-engine" || pathname.startsWith("/fix-engine/");
  } else {
    active =
      pathname === itemPath ||
      pathname.startsWith(`${itemPath}/`) ||
      (item.aliases ? item.aliases.some((a) => pathname === a || pathname.startsWith(`${a}/`)) : false);
  }

  return (
    <NavLinkEnabled
      item={item}
      active={active}
      collapsed={collapsed}
      onNavigate={onNavigate}
      pathname={pathname}
      currentTab={currentTab}
    />
  );
}

function getTourTag(href: string): string | undefined {
  if (href.startsWith("/website")) return "nav-website";
  if (href.startsWith("/fix-engine")) return "nav-fix-engine";
  if (href.startsWith("/ai-visibility")) return "nav-ai-visibility";
  return undefined;
}

/**
 * Clean, single-level workflow link with icon container, subtle status badges,
 * and instant hover tooltip in collapsed rail mode.
 */
function NavLinkEnabled({
  item,
  active,
  collapsed,
  onNavigate,
  pathname,
  currentTab,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  onNavigate: () => void;
  pathname?: string;
  currentTab?: string | null;
}) {
  const tourTag = getTourTag(item.href);

  if (collapsed) {
    return (
      <div className="group relative flex w-full justify-center">
        {active && (
          <span
            aria-hidden="true"
            className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-signal-400"
          />
        )}
        <Link
          href={item.href}
          data-tour={tourTag}
          onClick={onNavigate}
          aria-label={item.label}
          data-nav-active={active}
          className={cn(
            "relative flex h-10 w-10 items-center justify-center rounded-xl transition-all focus:outline-none focus-visible:outline-none focus-visible:shadow-none",
            active
              ? "bg-signal-400 font-bold text-signal-ink shadow-xs"
              : "text-brand-500 hover:bg-surface-2 hover:text-brand-950",
          )}
        >
          <item.icon size={17} className={active ? "text-signal-ink" : "text-brand-500 group-hover:text-brand-950"} />
          {!active && item.tagTone === "danger" && item.tag && (
            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-error-500 ring-2 ring-surface-1" />
          )}
          {!active && !item.tag && item.step?.done && (
            <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-success-500" />
          )}
        </Link>

        {/* Instant hover label pill for collapsed rail */}
        <div className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 hidden -translate-y-1/2 items-center gap-2 whitespace-nowrap rounded-lg border border-brand-200 bg-surface-1 px-2.5 py-1.5 text-[11.5px] font-semibold text-brand-950 shadow-lg group-hover:flex">
          <span>{item.label}</span>
          {item.tag && (
            <span
              className={cn(
                "rounded-full px-1.5 py-px font-mono text-[9.5px] font-bold",
                item.tagTone === "danger"
                  ? "bg-error-50 text-error-700"
                  : "bg-brand-100 text-brand-700",
              )}
            >
              {item.tag}
            </span>
          )}
          {item.step?.done && (
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-success-50 text-success-700">
              <Check size={9} strokeWidth={3} />
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div
        data-nav-active={active}
        className={cn(
          "group relative flex items-center rounded-xl text-[12.5px] transition-all",
          active
            ? "bg-signal-400 font-bold text-signal-ink shadow-xs"
            : "font-medium text-brand-600 hover:bg-surface-2 hover:text-brand-950",
        )}
      >
        <Link
          href={item.href}
          data-tour={tourTag}
          onClick={onNavigate}
          className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl px-2 py-1.5 focus:outline-none focus-visible:outline-none focus-visible:shadow-none"
        >
          <span
            className={cn(
              "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors",
              active
                ? "bg-signal-ink/15 text-signal-ink"
                : "bg-surface-2 text-brand-500 group-hover:bg-brand-200/70 group-hover:text-brand-950",
            )}
          >
            <item.icon size={15} className={active ? "text-signal-ink" : "text-brand-500 group-hover:text-brand-950"} />
          </span>

          <span className="min-w-0 flex-1 truncate leading-snug">{item.label}</span>

          {item.step && (
            <span
              title={`Step ${item.step.n}: ${item.step.hint}`}
              aria-label={`Step ${item.step.n}${item.step.done ? ", done" : ""}`}
              className={cn(
                "flex h-4 w-4 shrink-0 items-center justify-center rounded-full font-mono text-[9px] font-bold transition-colors",
                item.step.done
                  ? active
                    ? "bg-signal-ink/15 text-signal-ink"
                    : "border border-success-500/30 bg-success-50 text-success-700"
                  : active
                    ? "border border-signal-ink/40 text-signal-ink"
                    : "border border-brand-200 bg-surface-2 text-brand-500",
              )}
            >
              {item.step.done ? <Check size={10} strokeWidth={3} /> : item.step.n}
            </span>
          )}

          {item.tag && (
            <span
              className={cn(
                "shrink-0 rounded-full px-1.5 py-px font-mono text-[9.5px] font-bold leading-[14px]",
                active
                  ? "bg-signal-ink/15 text-signal-ink"
                  : item.tagTone === "danger"
                    ? "bg-error-50 text-error-700"
                    : item.tagTone === "success"
                      ? "border border-success-200 bg-success-50 text-success-700"
                      : "bg-brand-200 text-brand-600",
              )}
            >
              {item.tag}
            </span>
          )}
        </Link>
      </div>

      {!collapsed && active && item.children && item.children.length > 0 && (
        <div className="ml-5 mt-1 space-y-0.5 border-l-2 border-brand-200/60 pl-2">
          {item.children.map((child) => {
            const [childPath, childQuery] = child.href.split("?");
            const childTab = childQuery ? new URLSearchParams(childQuery).get("tab") : null;
            const isChildActive = childTab
              ? pathname === childPath && currentTab === childTab
              : pathname === child.href;

            return (
              <Link
                key={child.id}
                href={child.href}
                onClick={onNavigate}
                className={cn(
                  "flex items-center justify-between rounded-lg px-2 py-1 text-[11px] font-medium transition",
                  isChildActive
                    ? "bg-surface-2 font-bold text-brand-950 border border-brand-200/80 shadow-2xs"
                    : "text-brand-500 hover:bg-surface-2/60 hover:text-brand-800",
                )}
              >
                <span className="truncate">{child.label}</span>
                {child.id === "results-ledger" && (
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-signal-400" />
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
