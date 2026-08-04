"use client";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, Search, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

/** Breadcrumb scope + title for each route, matching the design's header. */
const ROUTE_META: Record<string, { scope: string; title: string }> = {
  "/clients": { scope: "Agency", title: "Clients" },
  "/reports": { scope: "Agency", title: "Reports" },
  "/billing": { scope: "Agency", title: "Billing & settings" },
  "/settings": { scope: "Agency", title: "Settings" },
  "/dashboard": { scope: "Client", title: "Overview" },
  "/geo-tracking": { scope: "Client", title: "AI Visibility" },
  "/strategy": { scope: "Client", title: "Growth Strategy" },
  "/keywords": { scope: "Client", title: "Search" },
  "/rank-tracking": { scope: "Client", title: "Rank tracking" },
  "/competitors": { scope: "Client", title: "Competitors" },
  "/technical-seo": { scope: "Client", title: "Site health" },
  "/backlinks": { scope: "Client", title: "Backlinks" },
  "/content-ai": { scope: "Client", title: "Content AI" },
};

const PERIODS = ["7d", "28d", "90d"] as const;

export function TopNav({ setMobileOpen }: { collapsed?: boolean; setMobileOpen?: (open: boolean) => void }) {
  const pathname = usePathname();
  const [period, setPeriod] = useState<(typeof PERIODS)[number]>("28d");

  const meta = ROUTE_META[pathname] ?? { scope: "Client", title: "Workspace" };

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
      </div>
    </header>
  );
}
