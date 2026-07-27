"use client";
import { useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { TopNav } from "@/components/layout/topnav";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const sidebarWidth = collapsed ? 64 : 240;

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-subtle)" }}>
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      <TopNav sidebarWidth={sidebarWidth} />
      <main
        className="min-h-screen pt-14 transition-[margin] duration-300"
        style={{ marginLeft: sidebarWidth }}
      >
        <div className="p-6 max-w-[1600px] mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
