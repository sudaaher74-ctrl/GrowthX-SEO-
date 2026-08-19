"use client";
import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, Menu, Search, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api-client";

/** Breadcrumb scope + title for each route, matching the design's header. */
const ROUTE_META: Record<string, { scope: string; title: string }> = {
  "/clients": { scope: "Portfolio", title: "Projects" },
  "/reports": { scope: "Workspace", title: "Reports" },
  "/settings": { scope: "Workspace", title: "Settings" },
  "/dashboard": { scope: "Workspace", title: "Overview" },
  "/geo-tracking": { scope: "Workspace", title: "AI Visibility" },
  "/strategy": { scope: "Workspace", title: "Growth Strategy" },
  "/keywords": { scope: "Workspace", title: "Search" },
  "/rank-tracking": { scope: "Workspace", title: "Rank tracking" },
  "/competitors": { scope: "Workspace", title: "Competitors" },
  "/technical-seo": { scope: "Workspace", title: "Site health" },
  "/backlinks": { scope: "Workspace", title: "Backlinks" },
  "/content-ai": { scope: "Workspace", title: "Content AI" },
};

const PERIODS = ["7d", "28d", "90d"] as const;

export function TopNav({ setMobileOpen }: { collapsed?: boolean; setMobileOpen?: (open: boolean) => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const [period, setPeriod] = useState<(typeof PERIODS)[number]>("28d");

  // There was no way to sign out anywhere in the app, because there was no
  // real sign-in either — the shell logged everyone into one shared account.
  function signOut() {
    api.logout();
    router.replace("/login");
  }

  const meta = ROUTE_META[pathname] ?? { scope: "Workspace", title: "Workspace" };

  return (
    <header
      className="fixed left-0 right-0 top-0 z-30 flex h-[52px] items-center gap-3 border-b bg-white px-4 md:left-[232px]"
      style={{ borderColor: "var(--border-color)" }}
    >
      <button className="md:hidden" onClick={() => setMobileOpen?.(true)} aria-label="Open navigation">
        <Menu size={18} className="text-[#52525b]" />
      </button>

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-[13px]">
        <span className="text-[#a1a1aa]">{meta.scope}</span>
        <span className="text-[#d4d4d8]">/</span>
        <span className="font-semibold text-[#09090b]">{meta.title}</span>
      </div>

      <div className="ml-auto flex items-center gap-2">
        {/* Search */}
        <div
          className="hidden items-center gap-2 rounded-lg border px-2.5 py-1.5 lg:flex"
          style={{ borderColor: "var(--border-color)" }}
        >
          <Search size={13} className="text-[#a1a1aa]" />
          <input
            placeholder="Search or jump to…"
            className="w-44 bg-transparent text-[12px] text-[#09090b] outline-none placeholder:text-[#a1a1aa]"
          />
          <kbd className="rounded border px-1 font-mono text-[9px] text-[#a1a1aa]" style={{ borderColor: "var(--border-color)" }}>
            ⌘K
          </kbd>
        </div>

        {/* Period pills */}
        <div className="hidden items-center rounded-lg border p-0.5 sm:flex" style={{ borderColor: "var(--border-color)" }}>
          {PERIODS.map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={cn(
                "rounded-md px-2.5 py-1 font-mono text-[11px] transition-colors",
                period === p ? "bg-[#f4f4f5] font-semibold text-[#09090b]" : "text-[#71717a] hover:text-[#09090b]",
              )}
            >
              {p}
            </button>
          ))}
        </div>

        <button className="flex items-center gap-1.5 rounded-lg bg-[#09090b] px-3 py-1.5 text-[12px] font-semibold text-white transition-opacity hover:opacity-90">
          <Zap size={12} />
          Run audit
        </button>

        <button
          onClick={signOut}
          aria-label="Sign out"
          title="Sign out"
          className="rounded-lg border p-1.5 text-[#71717a] transition-colors hover:text-[#09090b]"
          style={{ borderColor: "var(--border-color)" }}
        >
          <LogOut size={13} />
        </button>
      </div>
    </header>
  );
}
