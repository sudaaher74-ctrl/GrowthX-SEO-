"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { TopNav } from "@/components/layout/topnav";
import { auth, subscribeToAuthChange } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { AivaProvider } from "@/components/voice/aiva-provider";
import { AivaPanel } from "@/components/voice/aiva-panel";

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
      <div className="min-h-screen" style={{ background: "var(--color-brand-50)" }}>
        <Sidebar
          collapsed={collapsed}
          onToggle={() => toggleCollapsed()}
          mobileOpen={mobileOpen}
          setMobileOpen={setMobileOpen}
        />
        <TopNav
          collapsed={collapsed}
          onToggleCollapse={() => toggleCollapsed()}
          setMobileOpen={setMobileOpen}
        />
        {/* 232px sidebar + 52px header, per the design's measurements. */}
        <main
          className={cn(
            "min-h-screen pt-[52px] transition-all duration-300 ease-in-out",
            collapsed ? "md:ml-0" : "md:ml-[232px]",
          )}
        >
          <div className="mx-auto max-w-[1600px] p-5 md:p-6">{children}</div>
        </main>
      </div>
      <AivaPanel />
    </AivaProvider>
  );
}
