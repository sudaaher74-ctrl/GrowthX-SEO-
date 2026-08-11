"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { TopNav } from "@/components/layout/topnav";
import { auth } from "@/lib/api-client";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!auth.isAuthenticated()) {
      router.push("/login");
    }
  }, [router]);

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
