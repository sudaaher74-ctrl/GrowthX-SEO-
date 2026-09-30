"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, Check, ChevronRight, ChevronsUpDown, Plus, Trash2, Crosshair, Globe, LayoutGrid, LogOut, MoreHorizontal, PanelLeftClose, SearchCheck, Settings, Wrench, Store, Bot, FileText } from "lucide-react";

import { cn } from "@/lib/utils";
import { api } from "@/lib/api-client";
import {
  usePortfolio,
  useWorkspace,
  useProfile,
  useIssueCounts,
  useDeleteProject,
} from "@/hooks/use-growthx";
import { TokensChip } from "@/components/tokens/tokens-chip";

/**
 * Agency console sidebar.
 *
 * Scoped to the selected client with core workspace tabs:
 * Dashboard, Website Audit, Google, Competitor Intelligence, AI Visibility, Google Business Profile, Fix Engine
 */

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  aliases?: string[];
  /** Small right-aligned counter or metric. */
  tag?: string;
  tagTone?: "default" | "danger" | "success";
  disabled?: boolean;
  /** Sub-tabs, shown under the item when it is open. `tab` is its ?tab= value. */
  children?: { label: string; href: string; id: string; tab?: string; isDefault?: boolean }[];
  /** A step of the guided workflow, ticked once it has really been done. */
  step?: { n: number; done: boolean; hint: string };
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
  const profile = useProfile();
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [newSite, setNewSite] = useState("");
  const [switcherError, setSwitcherError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const deleteProject = useDeleteProject(orgId);

  async function handleAddWebsite() {
    const domain = newSite.trim();
    if (!domain) return;
    setSwitcherError(null);
    setAdding(true);
    try {
      // The same start the dashboard uses: it registers the website, creates
      // the project for it and begins reading the site. A bare project with no
      // website behind it leaves every audit page empty.
      const run = await api.autopilot.start(domain, null);
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["portfolio"] });
      queryClient.setQueryData(["autopilot", run.projectId], run);
      setProjectId(run.projectId);
      setNewSite("");
      setSwitcherOpen(false);
      setMobileOpen?.(false);
      router.push("/dashboard");
    } catch (err) {
      setSwitcherError(err instanceof Error ? err.message : "Could not add the website.");
    } finally {
      setAdding(false);
    }
  }

  async function handleDeleteWebsite(id: string, name: string) {
    if (!window.confirm(`Delete "${name}"? All its audits, reports and settings will be permanently removed. This cannot be undone.`)) return;
    setSwitcherError(null);
    try {
      await deleteProject.mutateAsync(id);
      if (id === projectId) setProjectId("");
      queryClient.removeQueries({ predicate: (q) => q.queryKey.includes(id) });
    } catch (err) {
      setSwitcherError(err instanceof Error ? err.message : "Could not delete the website.");
    }
  }
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const selected = projects.find((p) => p.id === projectId) ?? projects[0] ?? null;
  const clientRow = portfolio.data?.clients.find((c) => c.projectId === selected?.id) ?? null;
  const issueCounts = useIssueCounts(projectId);

  // The guided order: audit your own site, connect Google, add the rivals,
  // connect the Business Profile, then ask the AI assistants — each step feeds the next (AI Visibility matches questions to
  // audited pages and explains a rival's win from its crawled page). Every
  // tick is read from real state, never from having visited the page.
  const competitorsQuery = useQuery({
    queryKey: ["action-engine-competitors", projectId],
    queryFn: () => api.actionEngineCompetitors(projectId!),
    enabled: Boolean(projectId),
    retry: false,
  });
  const auditDone = Boolean(issueCounts.data?.crawledAt);
  const competitorsDone = (competitorsQuery.data?.competitors.length ?? 0) > 0;

  // Done once at least one AI assistant has really been asked about the business.
  const visibilityQuery = useQuery({
    queryKey: ["ai-visibility-done", projectId],
    queryFn: () => api.getVisibility(projectId!, 28),
    enabled: Boolean(projectId),
    retry: false,
  });
  const visibilityDone = (visibilityQuery.data?.summary.checked ?? 0) > 0;

  const googleQuery = useQuery({
    queryKey: ["google-connections", projectId],
    queryFn: () => api.googleConnections(projectId!),
    enabled: Boolean(projectId),
    retry: false,
  });
  const googleProviders = googleQuery.data?.providers ?? [];
  const isConnected = (id: string) => googleProviders.some((p) => p.id === id && p.status === "CONNECTED");
  const googleDone = isConnected("search_console") || isConnected("analytics");
  const profileDone = isConnected("business_profile");

  // The workflow, in the order a client should work through it. AI Visibility,
  // Business and Design Studio are hidden from the sidebar for now;
  // their pages still exist and can be restored by adding the entries back.
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
      tag: clientRow?.criticalIssues ? String(clientRow.criticalIssues) : undefined,
      tagTone: "danger",
      step: { n: 1, done: auditDone, hint: auditDone ? "Audit done" : "Run your first website audit" },
      children: [
        { id: "overview", label: "Overview", href: "/website?tab=overview", tab: "overview" },
        { id: "technical-seo", label: "Technical health", href: "/website?tab=technical-seo", tab: "technical-seo", isDefault: true },
        { id: "performance", label: "Speed", href: "/website?tab=performance", tab: "performance" },
        { id: "pages", label: "Pages", href: "/website?tab=pages", tab: "pages" },
        { id: "content", label: "Content", href: "/website?tab=content", tab: "content" },
        { id: "geo", label: "Ready for AI answers", href: "/website?tab=geo", tab: "geo" },
        { id: "issues", label: "Problems to fix", href: "/website?tab=issues", tab: "issues" },
        { id: "report", label: "Full Report", href: "/website?tab=report", tab: "report" },
      ],
    },
    {
      label: "Google",
      href: "/google",
      icon: SearchCheck,
      step: { n: 2, done: googleDone, hint: googleDone ? "Google connected" : "Connect Search Console or Analytics" },
      children: [
        { id: "search-console", label: "Search Console", href: "/google/search-console" },
        { id: "analytics", label: "Analytics 4", href: "/google/analytics" },
        { id: "insights", label: "Insights & tools", href: "/google" },
        { id: "report", label: "Improvement report", href: "/google/report" },
      ],
    },
    {
      label: "Competitor Intelligence",
      href: "/competitor-intelligence",
      icon: Crosshair,
      step: { n: 3, done: competitorsDone, hint: competitorsDone ? "Competitors added" : "Add your competitors" },
      children: [
        { id: "battleground", label: "Battleground", href: "/competitor-intelligence?tab=battleground", tab: "battleground", isDefault: true },
        { id: "gaps", label: "Gaps", href: "/competitor-intelligence?tab=gaps", tab: "gaps" },
        { id: "radar", label: "Rival Radar", href: "/competitor-intelligence?tab=radar", tab: "radar" },
        { id: "counter-moves", label: "Your Plans", href: "/competitor-intelligence?tab=counter-moves", tab: "counter-moves" },
        { id: "report", label: "Full Report", href: "/competitor-intelligence?tab=report", tab: "report" },
      ],
    },
    {
      label: "AI Visibility",
      href: "/ai-visibility",
      icon: Bot,
      step: { n: 4, done: visibilityDone, hint: visibilityDone ? "AI assistants checked" : "See how ChatGPT, Gemini, Perplexity and Claude describe your business" },
      children: [
        { id: "overview", label: "Overview", href: "/ai-visibility?tab=overview", tab: "overview", isDefault: true },
        { id: "questions", label: "Questions", href: "/ai-visibility?tab=questions", tab: "questions" },
        { id: "sandbox", label: "GEO Sandbox & Simulation", href: "/ai-visibility?tab=sandbox", tab: "sandbox" },
        { id: "insights", label: "AI Insights", href: "/ai-visibility?tab=insights", tab: "insights" },
        { id: "citations", label: "Citations", href: "/ai-visibility?tab=citations", tab: "citations" },
        { id: "competitors", label: "Competitors", href: "/ai-visibility?tab=competitors", tab: "competitors" },
        { id: "gaps", label: "Content Gaps", href: "/ai-visibility?tab=gaps", tab: "gaps" },
        { id: "recommendations", label: "Recommendations", href: "/ai-visibility?tab=recommendations", tab: "recommendations" },
      ],
    },
    {
      label: "Google Business Profile",
      href: "/google-business-profile",
      icon: Store,
      step: { n: 5, done: profileDone, hint: profileDone ? "Business Profile connected" : "Connect your Google Business Profile" },
      children: [
        { id: "overview", label: "Overview", href: "/google-business-profile?tab=overview", tab: "overview", isDefault: true },
        { id: "audit", label: "Profile Audit", href: "/google-business-profile?tab=audit", tab: "audit" },
        { id: "reviews", label: "Reviews", href: "/google-business-profile?tab=reviews", tab: "reviews" },
        { id: "photos", label: "Photos", href: "/google-business-profile?tab=photos", tab: "photos" },
        { id: "services", label: "Services", href: "/google-business-profile?tab=services", tab: "services" },
        { id: "categories", label: "Categories", href: "/google-business-profile?tab=categories", tab: "categories" },
        { id: "rankings", label: "Local Rankings", href: "/google-business-profile?tab=rankings", tab: "rankings" },
        { id: "competitors", label: "Competitors", href: "/google-business-profile?tab=competitors", tab: "competitors" },
        { id: "posts", label: "Posts", href: "/google-business-profile?tab=posts", tab: "posts" },
        { id: "ai-recommendations", label: "AI Recommendations", href: "/google-business-profile?tab=ai-recommendations", tab: "ai-recommendations" },
        { id: "action-plan", label: "Action Plan", href: "/google-business-profile?tab=action-plan", tab: "action-plan" },
      ],
    },
    {
      label: "Fix Engine",
      href: "/fix-engine",
      icon: Wrench,
    },
  ];

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

            {/* Client switcher */}
            <div className="relative px-1 mb-3">
              <button
                onClick={() => setSwitcherOpen((v) => !v)}
                className="flex w-full items-center gap-2 rounded-lg border bg-white px-2 py-2 text-left transition hover:bg-brand-50"
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

              {switcherOpen && (
                <div
                  className="absolute left-1 right-1 z-10 mt-1 overflow-hidden rounded-lg border bg-white shadow-lg"
                  style={{ borderColor: "var(--border-color)" }}
                >
                  {portfolio.data?.clients.map((client) => (
                    <div key={client.projectId} className="group flex items-center hover:bg-brand-100">
                      <button
                        onClick={() => {
                          setProjectId(client.projectId);
                          setSwitcherOpen(false);
                        }}
                        className="flex min-w-0 flex-1 items-center gap-2 px-2 py-2 text-left"
                      >
                        <span className="flex h-5 w-5 items-center justify-center rounded bg-brand-100 font-mono text-[8px] font-semibold text-brand-700">
                          {client.initials}
                        </span>
                        <span className="flex-1 truncate text-[11.5px] text-brand-950">{client.name}</span>
                        <span className="font-mono text-[9.5px] text-brand-500">
                          {client.aiCitationSharePct != null ? `${client.aiCitationSharePct}%` : "—"}
                        </span>
                      </button>
                      <button
                        onClick={() => handleDeleteWebsite(client.projectId, client.name)}
                        disabled={deleteProject.isPending}
                        title={`Delete ${client.name}`}
                        aria-label={`Delete ${client.name}`}
                        className="mr-1 flex h-6 w-6 shrink-0 items-center justify-center rounded text-brand-400 transition hover:bg-error-50 hover:text-error-600 disabled:opacity-50"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      void handleAddWebsite();
                    }}
                    className="flex items-center gap-1 border-t p-1.5"
                    style={{ borderColor: "var(--border-color)" }}
                  >
                    <input
                      value={newSite}
                      onChange={(e) => setNewSite(e.target.value)}
                      placeholder="Add website, e.g. yoursite.com"
                      className="min-w-0 flex-1 rounded-md border bg-white px-2 py-1.5 text-[11.5px] text-brand-950 outline-none focus:border-brand-400"
                      style={{ borderColor: "var(--border-color)" }}
                    />
                    <button
                      type="submit"
                      disabled={!newSite.trim() || adding}
                      title="Add website"
                      aria-label="Add website"
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-brand-600 text-white transition hover:bg-brand-700 disabled:opacity-50"
                    >
                      <Plus size={13} />
                    </button>
                  </form>
                  {switcherError && <p className="px-2 pb-2 text-[10.5px] text-error-600">{switcherError}</p>}
                </div>
              )}
            </div>

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

function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}
