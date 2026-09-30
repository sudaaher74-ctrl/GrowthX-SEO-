"use client";
import { Suspense, useEffect, useState, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { TopNav } from "@/components/layout/topnav";
import { DashboardNavbar } from "@/components/layout/dashboard-navbar";
import { auth, subscribeToAuthChange } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { AivaProvider } from "@/components/voice/aiva-provider";
import { AivaPanel } from "@/components/voice/aiva-panel";
import { AutopilotCard } from "@/components/autopilot/autopilot-card";
import { TokenBanner } from "@/components/tokens/token-banner";

/**
 * Every dashboard route renders inside this shell, so it is where the session
 * check belongs.
 *
 * An unauthenticated visitor goes to /login immediately upon signing out or opening
 * protected pages.
 */
export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const router = useRouter();
  // Dark skin with the workflow top bar applies across all tabs in the console.
  const dark = true;

  useEffect(() => {
    try {
      const saved = localStorage.getItem("growthx_sidebar_collapsed");
      if (saved === "true") setCollapsed(true);
    } catch {}
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("growthx_sidebar_collapsed", String(next));
      } catch {}
      return next;
    });
  };

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

  // Render nothing until the answer is known, rather than a frame of dashboard
  // chrome that a signed-out visitor should never see.
  if (signedIn !== true) return null;

  return (
    <AivaProvider>
      <div className={cn("min-h-screen", dark && "dash-dark dark")} style={{ background: "var(--color-canvas)" }}>
        {/* The sidebar navigation */}
        <Suspense fallback={null}>
          <Sidebar
            collapsed={collapsed}
            onToggle={() => toggleCollapsed()}
            mobileOpen={mobileOpen}
            setMobileOpen={setMobileOpen}
          />
        </Suspense>
        <TopNav
          collapsed={collapsed}
          onToggleCollapse={() => toggleCollapsed()}
          setMobileOpen={setMobileOpen}
        />
        {/* 232px sidebar + 52px header */}
        <main
          className={cn(
            "min-h-screen transition-all duration-300 ease-in-out pt-[52px]",
            collapsed ? "md:ml-0" : "md:ml-[var(--sidebar-w,232px)]",
          )}
        >
          <div className="mx-auto max-w-[1600px] p-5 md:p-6 pb-24">
            <TokenBanner />
            {children}
          </div>
        </main>
      </div>
      <AutopilotCard />
      <AivaPanel />
    </AivaProvider>
  );
}
