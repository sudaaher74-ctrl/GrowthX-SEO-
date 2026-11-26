"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  ArrowLeft,
  Building2,
  Cpu,
  LogOut,
  MoreHorizontal,
  ShieldCheck,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { api } from "@/lib/api-client";
import { useProfile } from "@/hooks/use-growthx";

export type AdminSection = "overview" | "queues" | "tenants" | "users" | "ai-models" | "governance";

export interface AdminSectionItem {
  id: AdminSection;
  label: string;
  shortLabel: string;
  group: "Operations" | "Customers" | "Intelligence" | "Governance";
  icon: LucideIcon;
  description: string;
}

/** Single source of truth for the operator console sections; `?tab=` maps directly to these ids. */
export const ADMIN_SECTIONS: AdminSectionItem[] = [
  {
    id: "overview",
    label: "Command Center",
    shortLabel: "Overview",
    group: "Operations",
    icon: Activity,
    description: "Live infrastructure health, KPIs, and attention feed",
  },
  {
    id: "queues",
    label: "Queues & Crawls",
    shortLabel: "Queues",
    group: "Operations",
    icon: Cpu,
    description: "BullMQ worker queues, failed jobs, crawl & sync history",
  },
  {
    id: "tenants",
    label: "Tenants & Billing",
    shortLabel: "Tenants",
    group: "Customers",
    icon: Building2,
    description: "Organizations, plan tiers, AI budgets, and token wallets",
  },
  {
    id: "users",
    label: "Users & Access",
    shortLabel: "Users",
    group: "Customers",
    icon: Users,
    description: "Accounts, active sessions, verification, and sign-out controls",
  },
  {
    id: "ai-models",
    label: "AI FinOps & Routing",
    shortLabel: "AI FinOps",
    group: "Intelligence",
    icon: Zap,
    description: "Daily AI spend, task latency, errors, and provider routing",
  },
  {
    id: "governance",
    label: "Audit Log & Webhooks",
    shortLabel: "Governance",
    group: "Governance",
    icon: ShieldCheck,
    description: "Operator audit trail, incoming webhooks, and delivery logs",
  },
];

const GROUP_ORDER: AdminSectionItem["group"][] = [
  "Operations",
  "Customers",
  "Intelligence",
  "Governance",
];

export function isAdminSection(value: string | null): value is AdminSection {
  return ADMIN_SECTIONS.some((s) => s.id === value);
}

/** Resolve `?tab=` cleanly, remapping legacy `?tab=settings` to `governance`. */
export function resolveAdminSection(value: string | null): AdminSection {
  if (value === "settings") return "governance";
  return isAdminSection(value) ? value : "overview";
}

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

  const current: AdminSection = resolveAdminSection(searchParams.get("tab"));

  const user = profile.data;
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(" ");
  const displayName = fullName || user?.email?.split("@")[0] || "Operator";
  const displayEmail = user?.email || "";
  const initials = user?.firstName
    ? (user.firstName[0] + (user.lastName?.[0] || "")).toUpperCase()
    : user?.email
      ? user.email.slice(0, 2).toUpperCase()
      : "OP";

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
        <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs md:hidden" onClick={() => setMobileOpen?.(false)} />
      )}

      <aside
        aria-label="Operator navigation"
        className={cn(
          "fixed left-0 top-0 z-50 flex h-screen w-[var(--sidebar-w,232px)] flex-col border-r bg-surface-1 transition-transform duration-300 ease-in-out",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          collapsed ? "md:-translate-x-full" : "md:translate-x-0",
        )}
        style={{ borderColor: "var(--border-color)" }}
      >
        <div
          className="flex h-[52px] shrink-0 items-center justify-between border-b px-3.5"
          style={{ borderColor: "var(--border-color)" }}
        >
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-signal-400 font-mono text-[11px] font-bold text-signal-ink">
              R
            </span>
            <span className="text-[13.5px] font-bold tracking-[-0.02em] text-brand-950">Reigel</span>
          </div>
          <span className="rounded-md border border-brand-200 bg-surface-2 px-1.5 py-0.5 font-mono text-[9.5px] font-semibold uppercase tracking-wider text-brand-600">
            Operator
          </span>
        </div>

        <nav className="flex-1 overflow-y-auto px-2.5 py-3 space-y-4">
          {GROUP_ORDER.map((groupName) => {
            const items = ADMIN_SECTIONS.filter((s) => s.group === groupName);
            return (
              <div key={groupName}>
                <div className="px-2 pb-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-brand-400">
                    {groupName}
                  </span>
                </div>
                <div className="space-y-0.5">
                  {items.map((s) => {
                    const active = current === s.id;
                    return (
                      <Link
                        key={s.id}
                        href={`/admin?tab=${s.id}`}
                        onClick={() => setMobileOpen?.(false)}
                        data-nav-active={active}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[12.5px] transition-colors",
                          active
                            ? "bg-signal-400 font-bold text-signal-ink shadow-2xs"
                            : "font-medium text-brand-600 hover:bg-surface-2 hover:text-brand-950",
                        )}
                      >
                        <s.icon size={15} className={active ? "text-signal-ink" : "text-brand-400"} />
                        <span className="min-w-0 flex-1 truncate leading-snug">{s.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}

          <div className="border-t pt-3" style={{ borderColor: "var(--border-color)" }}>
            <Link
              href="/dashboard"
              onClick={() => setMobileOpen?.(false)}
              className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[12.5px] font-medium text-brand-500 transition-colors hover:bg-surface-2 hover:text-brand-950"
            >
              <ArrowLeft size={15} className="text-brand-400" />
              <span>Return to workspace</span>
            </Link>
          </div>
        </nav>

        <div className="relative border-t p-2.5" style={{ borderColor: "var(--border-color)" }}>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-20" onClick={() => setMenuOpen(false)} />
              <div
                className="absolute bottom-full left-2.5 right-2.5 z-30 mb-2 overflow-hidden rounded-xl border bg-surface-1 p-1.5 shadow-xl"
                style={{ borderColor: "var(--border-color)" }}
              >
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-[12px] font-medium text-error-600 transition hover:bg-error-50 hover:text-error-700 cursor-pointer"
                >
                  <LogOut size={14} className="text-error-500" />
                  Sign out
                </button>
              </div>
            </>
          )}
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="flex w-full items-center gap-2.5 rounded-lg p-1.5 text-left transition hover:bg-surface-2 cursor-pointer"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-signal-400 font-mono text-[10px] font-bold text-signal-ink">
              {initials}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12px] font-semibold text-brand-950">{displayName}</span>
              <span className="block truncate text-[10.5px] text-brand-400">{displayEmail}</span>
            </span>
            <MoreHorizontal size={14} className="shrink-0 text-brand-400" />
          </button>
        </div>
      </aside>
    </>
  );
}
