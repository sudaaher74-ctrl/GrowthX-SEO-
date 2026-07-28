"use client";
import { useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { TopNav } from "@/components/layout/topnav";
import { cn } from "@/lib/utils";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-subtle)" }}>
      <Sidebar 
        collapsed={collapsed} 
        onToggle={() => setCollapsed(!collapsed)} 
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
      />
      <TopNav 
        collapsed={collapsed}
        setMobileOpen={setMobileOpen}
      />
      <main
        className={cn(
          "min-h-screen pt-14 transition-all duration-300",
          collapsed ? "md:ml-[64px]" : "md:ml-[240px]"
        )}
      >
        <div className="p-4 md:p-6 max-w-[1600px] mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
