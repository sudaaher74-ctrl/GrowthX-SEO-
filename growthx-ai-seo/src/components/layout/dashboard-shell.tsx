"use client";
import { Suspense, useEffect, useState, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { TopNav } from "@/components/layout/topnav";
import { AdminSidebar } from "@/components/layout/admin-sidebar";
import { AdminTopNav } from "@/components/layout/admin-topnav";
import { auth, renewSession, subscribeToAuthChange } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { AivaProvider } from "@/components/voice/aiva-provider";
import { AivaPanel } from "@/components/voice/aiva-panel";
import { TokenBanner } from "@/components/tokens/token-banner";
import { ProductTour } from "@/components/tour/product-tour";

import { useTheme } from "@/hooks/use-theme";
import { useWorkspace } from "@/hooks/use-growthx";
import { useSubscription } from "@/lib/subscription-engine";
import { SubscriptionGateModal } from "@/components/subscription/subscription-gate-modal";

/**
 * Every dashboard route renders inside this shell, so it is where the session
 * check belongs.
 *
 * An unauthenticated visitor goes to /login immediately upon signing out or opening
 * protected pages.
 */
export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return true;
    try {
      return localStorage.getItem("growthx_sidebar_rail") !== "false";
    } catch {
      return true;
    }
  });
  const router = useRouter();
  // The super-admin console has its own navigation; the customer sidebar
  // (workspace, audit workflow, tokens) does not apply to it.
  const isAdmin = usePathname().startsWith("/admin");
  const { isDark } = useTheme();
  const { orgId } = useWorkspace();
  const { isClaimed } = useSubscription(orgId);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("growthx_sidebar_rail", String(next));
      } catch {}
      return next;
    });
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") {
        const target = e.target as HTMLElement | null;
        if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
          return;
        }
        e.preventDefault();
        toggleCollapsed();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // localStorage is unreadable during the server render. useSyncExternalStore
  // subscribes to reactive auth changes so logging out anywhere immediately triggers redirection.
  const signedIn = useSyncExternalStore(
    subscribeToAuthChange,
    () => auth.isAuthenticated(),
    () => null,
  );

  useEffect(() => {
    if (signedIn === false) router.replace("/login");
  }, [signedIn, router]);

  useEffect(() => {
    if (!signedIn) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const renew = async () => {
      clearTimeout(timer);
      if (stopped || document.visibilityState === 'hidden') return;
      const result = await renewSession();
      if (stopped) return;
      // Only confirmed expiry/revocation ends a session. Outages are retried.
      if (result === 'expired') { auth.clear(); return; }
      clearTimeout(timer);
      timer = setTimeout(renew, result === 'temporary-error' ? 15000 : 5 * 60 * 1000);
    };
    const onVisible = () => { if (document.visibilityState === 'visible') void renew(); };
    void renew();
    window.addEventListener('online', onVisible);
    document.addEventListener('visibilitychange', onVisible);
    return () => { stopped = true; clearTimeout(timer); window.removeEventListener('online', onVisible); document.removeEventListener('visibilitychange', onVisible); };
  }, [signedIn]);

  // Render nothing until the answer is known, rather than a frame of dashboard
  // chrome that a signed-out visitor should never see.
  if (signedIn !== true) return null;

  return (
    <AivaProvider>
      <div
        className={cn(
          "min-h-screen transition-colors duration-200",
          isDark ? "dash-dark dark" : "dash-light",
        )}
        style={{ background: "var(--color-canvas)" }}
      >
        {/* The sidebar navigation */}
        <Suspense fallback={null}>
          {isAdmin ? (
            <AdminSidebar collapsed={!collapsed} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />
          ) : (
            <Sidebar
              collapsed={collapsed}
              onToggleCollapse={() => toggleCollapsed()}
              mobileOpen={mobileOpen}
              setMobileOpen={setMobileOpen}
            />
          )}
        </Suspense>
        <Suspense fallback={null}>
          {isAdmin ? (
            <AdminTopNav
              collapsed={!collapsed}
              onToggleCollapse={() => toggleCollapsed()}
              setMobileOpen={setMobileOpen}
            />
          ) : (
            <TopNav
              collapsed={collapsed}
              onToggleCollapse={() => toggleCollapsed()}
              setMobileOpen={setMobileOpen}
            />
          )}
        </Suspense>
        {/* Compact navigation rail + 52px top bar */}
        <main
          className={cn(
            "min-h-screen transition-all duration-300 ease-in-out pt-[52px]",
            isAdmin ? (collapsed ? "md:ml-[232px]" : "md:ml-0") : collapsed ? "md:ml-[68px]" : "md:ml-[232px]",
          )}
        >
          <div className="mx-auto max-w-[1600px] p-5 md:p-6 pb-24">
            {!isAdmin && <TokenBanner />}
            {children}
          </div>
        </main>
      </div>
      <AivaPanel />
      {!isAdmin && <ProductTour />}
      {!isAdmin && mounted && !isClaimed && <SubscriptionGateModal orgId={orgId} />}
    </AivaProvider>
  );
}
