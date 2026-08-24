"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronsUpDown, LayoutGrid } from "lucide-react";

import { cn } from "@/lib/utils";
import { routeFor, routesInSection, type AppRoute } from "@/lib/routes";
import { useEntitlements, usePortfolio, useProfile, useWorkspace } from "@/hooks/use-growthx";

/**
 * Agency console sidebar.
 *
 * Two scopes, exactly as the design specifies: AGENCY-level work at the top,
 * then a client switcher and everything scoped to the selected client.
 *
 * The nav used to be two hand-written arrays listing 16 of the app's 40 routes,
 * so ten finished pages — Keywords, Content AI, Image SEO, Internal Linking,
 * Meta Optimizer, Schema Generator, the AI Assistant, Activity, Billing and
 * Help — could only be reached by typing their URL. It now reads the shared
 * route registry, so a new route appears here by existing.
 */

/** Per-route badges. Counts come from workspace data, so they cannot live in
 *  the static registry; this maps a route to the number that belongs on it. */
function useNavTags(): Record<string, { value: string; tone?: "danger" }> {
  const { orgId, projectId, projects } = useWorkspace();
  const portfolio = usePortfolio(orgId);
  const client = portfolio.data?.clients.find((c) => c.projectId === projectId) ?? null;

  const tags: Record<string, { value: string; tone?: "danger" }> = {};
  if (projects.length) tags["/clients"] = { value: String(projects.length) };
  if (client?.criticalIssues) tags["/website"] = { value: String(client.criticalIssues), tone: "danger" };
  return tags;
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
  const profile = useProfile();
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const switcherRef = useRef<HTMLDivElement>(null);
  const tags = useNavTags();
  const activeHref = routeFor(pathname)?.href ?? null;

  const selected = projects.find((p) => p.id === projectId) ?? projects[0] ?? null;
  const clientRow = portfolio.data?.clients.find((c) => c.projectId === selected?.id) ?? null;

  // The switcher was a bare open/closed boolean: no way to dismiss it except by
  // hitting the trigger again, and no Escape. Both are table stakes for a menu.
  useEffect(() => {
    if (!switcherOpen) return;
    function onPointerDown(event: MouseEvent) {
      if (!switcherRef.current?.contains(event.target as Node)) setSwitcherOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setSwitcherOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [switcherOpen]);

  const crawlQuota = entitlements.data?.quotas.find((q) => q.metric === "CRAWL_PAGES");
  const crawlPct =
    crawlQuota && crawlQuota.limit ? Math.min(100, (crawlQuota.used / crawlQuota.limit) * 100) : 0;

  const user = profile.data;
  const displayName =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") || user?.email?.split("@")[0] || "Your workspace";

  const closeMobile = () => setMobileOpen?.(false);

  return (
    <>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/40 md:hidden" onClick={closeMobile} aria-hidden="true" />
      )}

      <aside
        aria-label="Main navigation"
        className={cn(
          "fixed left-0 top-0 z-50 flex h-screen w-[232px] flex-col border-r bg-white transition-transform duration-200 md:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
        style={{ borderColor: "var(--border-color)" }}
      >
        {/* Brand */}
        <div
          className="flex h-[52px] shrink-0 items-center gap-[9px] border-b px-[14px]"
          style={{ borderColor: "var(--color-brand-100)" }}
        >
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
          {routesInSection("portfolio").map((route) => (
            <NavLink key={route.href} route={route} activeHref={activeHref} tags={tags} onNavigate={closeMobile} />
          ))}

          <div className="mt-5">
            <SectionLabel>Workspace</SectionLabel>

            {/* Client switcher */}
            <div className="relative px-1" ref={switcherRef}>
              <button
                onClick={() => setSwitcherOpen((v) => !v)}
                disabled={projects.length === 0}
                aria-expanded={switcherOpen}
                aria-haspopup="listbox"
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
                <ChevronsUpDown size={13} className="shrink-0 text-brand-400" aria-hidden="true" />
              </button>

              {switcherOpen && projects.length > 0 && (
                <div
                  role="listbox"
                  aria-label="Switch project"
                  className="absolute left-1 right-1 z-10 mt-1 overflow-hidden rounded-lg border bg-white shadow-lg"
                  style={{ borderColor: "var(--border-color)" }}
                >
                  {portfolio.data?.clients.map((client) => (
                    <button
                      key={client.projectId}
                      role="option"
                      aria-selected={client.projectId === projectId}
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
              {routesInSection("workspace").map((route) => (
                <NavLink key={route.href} route={route} activeHref={activeHref} tags={tags} onNavigate={closeMobile} />
              ))}
            </div>

            <div className="mt-4 border-t pt-3" style={{ borderColor: "var(--color-brand-100)" }}>
              <SectionLabel>Content Intelligence</SectionLabel>
              {routesInSection("content-intelligence").map((route) => (
                <NavLink key={route.href} route={route} activeHref={activeHref} tags={tags} onNavigate={closeMobile} />
              ))}
            </div>

            <div className="mt-4 border-t pt-3" style={{ borderColor: "var(--color-brand-100)" }}>
              <SectionLabel>Tools</SectionLabel>
              {routesInSection("tools").map((route) => (
                <NavLink key={route.href} route={route} activeHref={activeHref} tags={tags} onNavigate={closeMobile} />
              ))}
            </div>

            <div className="mt-4 border-t pt-3" style={{ borderColor: "var(--color-brand-100)" }}>
              <SectionLabel>Account</SectionLabel>
              {routesInSection("account").map((route) => (
                <NavLink key={route.href} route={route} activeHref={activeHref} tags={tags} onNavigate={closeMobile} />
              ))}
            </div>
          </div>
        </nav>

        {/* Crawl quota. This percentage was computed and then never rendered —
            the meter it was written for had gone missing from the markup. */}
        {crawlQuota?.limit != null && (
          <div className="shrink-0 border-t px-[14px] py-3" style={{ borderColor: "var(--color-brand-100)" }}>
            <div className="flex items-baseline justify-between">
              <span className="text-[9.5px] font-semibold uppercase tracking-[0.09em] text-brand-400">
                Pages crawled
              </span>
              <span className="font-mono text-[9.5px] text-brand-500">
                {compact(crawlQuota.used)}/{compact(crawlQuota.limit)}
              </span>
            </div>
            <div
              className="mt-1.5 h-1 overflow-hidden rounded-full bg-brand-100"
              role="progressbar"
              aria-valuenow={Math.round(crawlPct)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Crawl quota used"
            >
              <div
                className={cn("h-full rounded-full", crawlPct >= 90 ? "bg-error-500" : "bg-brand-950")}
                style={{ width: `${crawlPct}%` }}
              />
            </div>
          </div>
        )}

        {/* User. Was hardcoded to "SA / Workspace / Admin" for every visitor. */}
        <Link
          href="/settings"
          onClick={closeMobile}
          className="flex items-center gap-2 border-t px-[14px] py-3 transition-colors hover:bg-brand-50"
          style={{ borderColor: "var(--color-brand-100)" }}
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-950 font-mono text-[10px] font-semibold text-white">
            {user ? initialsOf(displayName) : "—"}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[11.5px] font-semibold text-brand-950">{displayName}</span>
            <span className="block truncate text-[10px] text-brand-400">{user?.email ?? "Not signed in"}</span>
          </span>
        </Link>
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
  route,
  activeHref,
  tags,
  onNavigate,
}: {
  route: AppRoute;
  /** The href of the registry entry the current URL resolves to. */
  activeHref: string | null;
  tags: Record<string, { value: string; tone?: "danger" }>;
  onNavigate: () => void;
}) {
  // Resolved by longest prefix upstream, so an unregistered child URL still
  // highlights its parent while /content-intelligence/gaps highlights itself
  // rather than lighting up the hub it is nested under as well.
  const active = activeHref === route.href;
  const tag = tags[route.href];

  return (
    <Link
      href={route.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-[9px] rounded-lg px-2 py-[7px] text-[12.5px] font-medium transition-colors",
        active ? "bg-brand-100 text-brand-950" : "text-brand-600 hover:bg-brand-100",
      )}
    >
      <route.icon size={15} className={active ? "text-brand-900" : "text-brand-400"} aria-hidden="true" />
      <span className="flex-1 truncate">{route.label}</span>
      {tag && (
        <span
          className={cn(
            "font-mono text-[10.5px] font-medium",
            tag.tone === "danger" ? "text-error-500" : "text-brand-400",
          )}
        >
          {tag.value}
        </span>
      )}
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
