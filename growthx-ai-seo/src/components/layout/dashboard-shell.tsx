"use client";
import { useState, useEffect } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { TopNav } from "@/components/layout/topnav";
import { auth, api } from "@/lib/api-client";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    // There is no login page — every visitor is silently authenticated as the
    // house account so the app is usable without a sign-in step.
    if (!auth.isAuthenticated()) {
      api.login("sudarshan@growthx.ai", "GrowthX2026!").then(() => {
        window.location.reload();
      }).catch((err) => {
        console.error("Auto-login failed:", err);
      });
    }
  }, []);

  return (
    <div className="min-h-screen" style={{ background: "#fafafa" }}>
      <Sidebar mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />
      <TopNav setMobileOpen={setMobileOpen} />
      {/* 232px sidebar + 52px header, per the design's measurements. */}
      <main className="min-h-screen pt-[52px] md:ml-[232px]">
        <div className="mx-auto max-w-[1600px] p-5 md:p-6">{children}</div>
      </main>
    </div>
  );
}
