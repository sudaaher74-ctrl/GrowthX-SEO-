"use client";
import { useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { TopNav } from "@/components/layout/topnav";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

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
