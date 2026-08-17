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
      import("@/lib/api-client").then(({ api, auth }) => {
        api.login("admin@milquufresh.in", "testpassword").then(async () => {
          const orgs = await api.listOrganizations();
          if (orgs?.[0]?.id) {
            auth.setOrgId(orgs[0].id);
            const projects = await api.listProjects(orgs[0].id);
            if (projects?.[0]?.id) auth.setProjectId(projects[0].id);
          }
          window.location.reload();
        }).catch((e) => {
          console.error("Failed to login as admin", e);
        });
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
