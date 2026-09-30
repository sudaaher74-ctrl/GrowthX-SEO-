"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, FileText, LayoutGrid, LogOut, Search, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api-client";
import { PERIOD_DAYS, setActivePeriod, usePeriodDays, useProfile } from "@/hooks/use-growthx";
import { CommandPalette } from "@/components/ui/command-palette";
import { TokensChip } from "@/components/tokens/tokens-chip";
import { SiteSwitcher } from "@/components/layout/site-switcher";
import { useMainNav, type NavItem } from "@/components/layout/nav-items";

/**
 * The Dashboard's top bar, standing in for the sidebar and the old top bar.
 *
 * Every workflow section is a round icon. Tapping one opens its tabs in a
 * white pill in its place; tapping a tab goes to that page. The icons and their
 * tabs come from the same `useMainNav` the sidebar reads, so they cannot drift.
 * Site switching, tokens, search, the period and the account menu all live here
 * too, so nothing the sidebar did is lost on this screen.
 */
export function DashboardNavbar() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { mainNav } = useMainNav();
  const profile = useProfile();
  const period = usePeriodDays();
  const [menuOpen, setMenuOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  // Which section's tabs are showing. Auto-opens the current section if it has tabs.
  const [userClosedHref, setUserClosedHref] = useState<string | null>(null);
  const currentTab = searchParams.get("tab");
  const isCurrent = (item: NavItem) =>
    pathname === item.href || pathname.startsWith(`${item.href}/`);
  const activeSection = mainNav.find(isCurrent);
  const autoHref = activeSection?.children && activeSection.children.length > 0 ? activeSection.href : null;
  const [openHref, setOpenHref] = useState<string | null>(autoHref);
  const tabsRef = useRef<HTMLDivElement | null>(null);

  function scrollTabs(direction: -1 | 1) {
    if (!tabsRef.current) return;
    tabsRef.current.scrollBy({ left: direction * 160, behavior: "smooth" });
  }

  useEffect(() => {
    const current = mainNav.find(isCurrent);
    if (current?.children && current.children.length > 0) {
      if (userClosedHref !== current.href) {
        setOpenHref(current.href);
      }
    } else {
      setOpenHref(null);
    }
  }, [pathname, userClosedHref]);

  const user = profile.data;
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(" ");
  const displayName = fullName || user?.email?.split("@")[0] || "Workspace";
  const initials = user?.firstName
    ? (user.firstName[0] + (user.lastName?.[0] || "")).toUpperCase()
    : user?.email
      ? user.email.slice(0, 2).toUpperCase()
      : "SA";

  async function signOut() {
    setMenuOpen(false);
    await api.logout();
    queryClient.clear();
    router.replace("/login");
  }

  const round =
    "relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-signal-400";

  return (
    <header className="fixed inset-x-0 top-0 z-30 border-b bg-surface-1">
      <div className="flex h-[76px] items-center gap-3 px-4 lg:px-6">
        <Link href="/dashboard" className="flex shrink-0 items-center gap-2 pr-1" aria-label="GrowthX dashboard">
          <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-signal-400 text-[15px] font-extrabold text-signal-ink">
            G
          </span>
          <span className="hidden text-[19px] font-extrabold tracking-[-0.02em] text-brand-950 sm:inline">
            Growth<span className="text-signal-400">X</span>
          </span>
        </Link>

        <SiteSwitcher variant="chip" />

        {/* The workflow: round icons, one of which can open into a pill of tabs. */}
        <nav aria-label="Workflow" className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {mainNav.map((item) => {
            const Icon = item.icon;
            const kids = item.children ?? [];
            const open = openHref === item.href && kids.length > 0;
            const current = isCurrent(item);

            if (open) {
              return (
                <div
                  key={item.href}
                  className="dash-light flex min-w-0 shrink items-center gap-1 rounded-full bg-brand-50 border border-brand-200/80 p-1 pr-2 shadow-xs"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setOpenHref(null);
                      setUserClosedHref(item.href);
                    }}
                    aria-label={`Close ${item.label} tabs`}
                    title={`${item.label} (tap to close)`}
                    className="dash-dark flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-950 transition hover:bg-brand-100"
                  >
                    <Icon size={18} />
                  </button>
                  <div ref={tabsRef} role="tablist" aria-label={item.label} className="flex min-w-0 items-center gap-0.5 overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {kids.map((sub) => {
                      const active = sub.tab
                        ? current && (currentTab === sub.tab || (!currentTab && Boolean(sub.isDefault)))
                        : pathname === sub.href;
                      return (
                        <Link
                          key={sub.id}
                          href={sub.href}
                          role="tab"
                          aria-selected={active}
                          className={cn(
                            "shrink-0 whitespace-nowrap rounded-full px-4 py-2.5 text-[13px] font-semibold transition-colors",
                            active ? "bg-signal-400 text-signal-ink font-bold shadow-xs" : "text-brand-600 hover:text-brand-950",
                          )}
                        >
                          {sub.label}
                        </Link>
                      );
                    })}
                  </div>
                  {kids.length > 4 && (
                    <div className="flex shrink-0 items-center">
                      <button type="button" onClick={() => scrollTabs(-1)} aria-label="Scroll tabs left" className="flex h-8 w-8 items-center justify-center rounded-full text-brand-500 hover:bg-brand-100 hover:text-brand-950">
                        <ChevronLeft size={16} />
                      </button>
                      <button type="button" onClick={() => scrollTabs(1)} aria-label="Scroll tabs right" className="flex h-8 w-8 items-center justify-center rounded-full text-brand-500 hover:bg-brand-100 hover:text-brand-950">
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  )}
                </div>
              );
            }

            const hint = item.step?.hint ? `${item.label}: ${item.step.hint}` : item.label;
            const badge = (
              <>
                <Icon size={18} />
                {item.step?.done && (
                  <span aria-hidden className="absolute right-0.5 top-0.5 h-2.5 w-2.5 rounded-full border-2 border-brand-100 bg-signal-400" />
                )}
                {item.tag && item.tagTone === "danger" && (
                  <span className="absolute -right-1 -top-1 min-w-[18px] rounded-full bg-error-600 px-1 text-center font-mono text-[10px] font-bold leading-[18px] text-white">
                    {item.tag}
                  </span>
                )}
              </>
            );
            const tone = current
              ? "bg-signal-400 text-signal-ink font-bold shadow-xs"
              : "bg-brand-100 text-brand-500 hover:bg-brand-200 hover:text-brand-950";

            // A section with tabs opens them here; one without goes to its page.
            return kids.length > 0 ? (
              <button
                key={item.href}
                type="button"
                onClick={() => {
                  setOpenHref(item.href);
                  setUserClosedHref(null);
                }}
                aria-label={item.label}
                aria-expanded={false}
                title={hint}
                className={cn(round, tone)}
              >
                {badge}
              </button>
            ) : (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => {
                  setOpenHref(null);
                  setUserClosedHref(null);
                }}
                aria-label={item.label}
                aria-current={current ? "page" : undefined}
                title={hint}
                className={cn(round, tone)}
              >
                {badge}
              </Link>
            );
          })}
        </nav>

        {/* Right: search, tokens, and the account menu (period, Integrations, Reports, Settings). */}
        <div className="flex shrink-0 items-center gap-2">
          <button type="button" onClick={() => setPaletteOpen(true)} aria-label="Search or jump to" title="Search or jump to (⌘K)" className={cn(round, "bg-brand-100 text-brand-500 hover:bg-brand-200 hover:text-brand-950")}>
            <Search size={17} />
          </button>

          <TokensChip variant="bar" />

          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-expanded={menuOpen}
              aria-label="Account menu"
              className="flex h-11 w-11 items-center justify-center rounded-full bg-signal-400 font-mono text-[12px] font-bold text-signal-ink"
            >
              {initials}
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 z-40 mt-2 w-56 overflow-hidden rounded-2xl border bg-surface-2 p-1.5 shadow-xl">
                  <div className="border-b px-3 py-2.5">
                    <p className="truncate text-[12.5px] font-semibold text-brand-950">{displayName}</p>
                    {user?.email && <p className="truncate text-[11px] text-brand-400">{user.email}</p>}
                  </div>
                  <div className="px-3 pb-2 pt-2.5">
                    <p className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-brand-400">Show the last</p>
                    <div className="flex items-center rounded-full bg-brand-100 p-1" role="group" aria-label="Period">
                      {PERIOD_DAYS.map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setActivePeriod(p)}
                          aria-pressed={period === p}
                          title={`Show the last ${p} days`}
                          className={cn(
                            "flex-1 rounded-full px-3 py-1.5 font-mono text-[11px] transition-colors",
                            period === p ? "bg-signal-400 font-bold text-signal-ink" : "text-brand-500 hover:text-brand-950",
                          )}
                        >
                          {p}d
                        </button>
                      ))}
                    </div>
                  </div>
                  {[
                    { href: "/integrations", label: "Integrations", icon: LayoutGrid },
                    { href: "/reports", label: "Reports", icon: FileText },
                    { href: "/settings", label: "Settings", icon: Settings },
                  ].map(({ href, label, icon: Icon }) => (
                    <Link key={href} href={href} onClick={() => setMenuOpen(false)} className="flex items-center gap-2 rounded-xl px-3 py-2 text-[12.5px] font-medium text-brand-700 hover:bg-brand-100 hover:text-brand-950">
                      <Icon size={14} className="text-brand-400" />
                      {label}
                    </Link>
                  ))}
                  <button type="button" onClick={signOut} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-[12.5px] font-medium text-error-700 hover:bg-error-50">
                    <LogOut size={14} />
                    Log out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </header>
  );
}
