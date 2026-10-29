"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Building2,
  Cpu,
  LayoutGrid,
  LogOut,
  MoreHorizontal,
  Sliders,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { api } from "@/lib/api-client";
import { useProfile } from "@/hooks/use-growthx";

export type AdminSection = "overview" | "tenants" | "users" | "queues" | "ai-models" | "settings";

/** Single source of truth for the admin console sections; the page reads the same ids from `?tab=`. */
export const ADMIN_SECTIONS: { id: AdminSection; label: string; icon: LucideIcon }[] = [
  { id: "overview", label: "System Overview", icon: LayoutGrid },
  { id: "tenants", label: "Tenants", icon: Building2 },
  { id: "users", label: "Users", icon: Users },
  { id: "queues", label: "Crawler Queues", icon: Cpu },
  { id: "ai-models", label: "AI Models & Spend", icon: Zap },
  { id: "settings", label: "Platform Flags", icon: Sliders },
];

export function isAdminSection(value: string | null): value is AdminSection {
  return ADMIN_SECTIONS.some((s) => s.id === value);
}

/**
 * Super-admin console sidebar. Deliberately separate from the customer
 * `Sidebar`: it has no workspace/site switcher, audit workflow or token meter,
 * because none of those apply to platform administration.
 */
export function AdminSidebar({
  collapsed = false,
  mobileOpen,
  setMobileOpen,
}: {
  collapsed?: boolean;
  mobileOpen?: boolean;
  setMobileOpen?: (open: boolean) => void;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const profile = useProfile();
  const [menuOpen, setMenuOpen] = useState(false);

  const tabParam = searchParams.get("tab");
  const current: AdminSection = isAdminSection(tabParam) ? tabParam : "overview";

  const user = profile.data;
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(" ");
  const displayName = fullName || user?.email?.split("@")[0] || "Admin";
  const displayEmail = user?.email || "";
  const initials = user?.firstName
    ? (user.firstName[0] + (user.lastName?.[0] || "")).toUpperCase()
    : user?.email
      ? user.email.slice(0, 2).toUpperCase()
      : "SA";

  async function handleLogout() {
    setMenuOpen(false);
    setMobileOpen?.(false);
    await api.logout();
    queryClient.clear();
    router.replace("/login");
  }

  return (
    <>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/40 md:hidden" onClick={() => setMobileOpen?.(false)} />
      )}

      <aside
        className={cn(
          "fixed left-0 top-0 z-50 flex h-screen w-[var(--sidebar-w,232px)] flex-col border-r bg-white transition-all duration-300 ease-in-out",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          collapsed ? "md:-translate-x-full" : "md:translate-x-0",
        )}
        style={{ borderColor: "var(--border-color)" }}
      >
        <div
          className="flex h-[52px] shrink-0 items-center gap-2 border-b px-[14px]"
          style={{ borderColor: "var(--border-color)" }}
        >
          <span className="text-[13.5px] font-bold tracking-[-0.02em] text-brand-950">Reigel</span>
          <span className="rounded-full bg-error-50 px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wider text-error-700">
            Admin
          </span>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-3">
          <div className="px-2 pb-1.5 pt-1">
            <span className="text-[9.5px] font-semibold uppercase tracking-[0.09em] text-brand-400">Platform</span>
          </div>
          <div className="space-y-0.5">
            {ADMIN_SECTIONS.map((s) => {
              const active = current === s.id;
              return (
                <Link
                  key={s.id}
                  href={`/admin?tab=${s.id}`}
                  onClick={() => setMobileOpen?.(false)}
                  data-nav-active={active}
                  className={cn(
                    "flex items-center gap-[9px] rounded-lg px-2.5 py-[7px] text-[12.5px] transition-colors",
                    active
                      ? "bg-signal-400 font-bold text-signal-ink shadow-xs"
                      : "font-medium text-brand-600 hover:bg-brand-100/60 hover:text-brand-950",
                  )}
                >
                  <s.icon size={15} className={active ? "text-signal-ink" : "text-brand-400"} />
                  <span className="min-w-0 flex-1 leading-snug">{s.label}</span>
                </Link>
              );
            })}
          </div>

          <div className="mt-4 border-t pt-4" style={{ borderColor: "var(--border-color)" }}>
            <Link
              href="/dashboard"
              onClick={() => setMobileOpen?.(false)}
              className="flex items-center gap-[9px] rounded-lg px-2.5 py-[7px] text-[12.5px] font-medium text-brand-600 transition-colors hover:bg-brand-100/60 hover:text-brand-950"
            >
              <ArrowLeft size={15} className="text-brand-400" />
              Back to workspace
            </Link>
          </div>
        </nav>

        <div className="relative border-t p-2" style={{ borderColor: "var(--border-color)" }}>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-20" onClick={() => setMenuOpen(false)} />
              <div
                className="absolute bottom-full left-2 right-2 z-30 mb-2 overflow-hidden rounded-xl border bg-white p-1.5 shadow-xl"
                style={{ borderColor: "var(--border-color)" }}
              >
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-[12px] font-medium text-error-600 transition hover:bg-error-50 hover:text-error-700"
                >
                  <LogOut size={14} className="text-error-500" />
                  Log out
                </button>
              </div>
            </>
          )}
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="flex w-full items-center gap-2.5 rounded-lg p-2 text-left transition hover:bg-brand-100/40"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-signal-400 font-mono text-[10px] font-bold text-signal-ink shadow-xs">
              {initials}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[11.5px] font-semibold text-brand-950">{displayName}</span>
              <span className="block truncate text-[10px] text-brand-400">{displayEmail}</span>
            </span>
            <MoreHorizontal size={14} className="shrink-0 text-brand-400" />
          </button>
        </div>
      </aside>
    </>
  );
}
