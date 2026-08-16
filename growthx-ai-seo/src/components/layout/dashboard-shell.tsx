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
    // Unauthenticated visitors are sent to the sign-in page. This used to
    // silently log everyone in as a shared house account with credentials
    // hardcoded here, which put every tenant's data behind no authentication
    // at all and shipped a real password to the browser bundle.
    if (!auth.isAuthenticated()) {
      router.replace("/login");
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
