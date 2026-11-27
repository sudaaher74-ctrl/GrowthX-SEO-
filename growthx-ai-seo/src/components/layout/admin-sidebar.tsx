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
  Globe,
  LogOut,
  MoreHorizontal,
  ShieldCheck,
  Terminal,
  Users,
  Workflow,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { api } from "@/lib/api-client";
import { useProfile } from "@/hooks/use-growthx";

export type AdminSection =
  | "overview"
  | "crawler"
  | "queues"
  | "ai-models"
  | "tenants"
  | "users"
  | "governance";

export interface AdminSectionItem {
  id: AdminSection;
  code: string;
  label: string;
  shortLabel: string;
  group: "OVERVIEW & FINOPS" | "ENGINES & INFRA" | "AI & MODELS" | "OPS & AUDIT";
  icon: LucideIcon;
  description: string;
}

export const ADMIN_SECTIONS: AdminSectionItem[] = [
  {
    id: "overview",
    code: "01",
    label: "System Overview",
    shortLabel: "Overview",
    group: "OVERVIEW & FINOPS",
    icon: Activity,
    description: "Platform health, unit economics, database, Redis & worker runtime",
  },
  {
    id: "users",
    code: "02",
    label: "Users 360° & Costs",
    shortLabel: "Users 360°",
    group: "OVERVIEW & FINOPS",
    icon: Users,
    description: "Per-user live status, token burn, crawls, AI models & automated COGS",
  },
  {
    id: "tenants",
    code: "03",
    label: "Workspaces & Quotas",
    shortLabel: "Workspaces",
    group: "OVERVIEW & FINOPS",
    icon: Building2,
    description: "Organizations, plan tiers, AI USD caps, token wallets & white-label",
  },
  {
    id: "crawler",
    code: "04",
    label: "Crawl Engine",
    shortLabel: "Crawler",
    group: "ENGINES & INFRA",
    icon: Globe,
    description: "Website registry, force-crawl overrides, frontier diagnostics & kill switch",
  },
  {
    id: "queues",
    code: "05",
    label: "Queues & Runtime",
    shortLabel: "Queues",
    group: "ENGINES & INFRA",
    icon: Cpu,
    description: "BullMQ crawl-jobs / page-fetch / page-render JSON inspector & drain",
  },
  {
    id: "ai-models",
    code: "06",
    label: "AI Router & Models",
    shortLabel: "AI Router",
    group: "AI & MODELS",
    icon: Terminal,
    description: "Provider circuit breakers, live model overrides, prompt probe & spend",
  },
  {
    id: "governance",
    code: "07",
    label: "Pipelines & Audit",
    shortLabel: "Pipelines",
    group: "OPS & AUDIT",
    icon: Workflow,
    description: "Autopilot, AI Visibility, Backlink & Fix runs, audit trail & webhooks",
  },
];

const GROUP_ORDER: AdminSectionItem["group"][] = [
  "OVERVIEW & FINOPS",
  "ENGINES & INFRA",
  "AI & MODELS",
  "OPS & AUDIT",
];

export function isAdminSection(value: string | null): value is AdminSection {
  return ADMIN_SECTIONS.some((s) => s.id === value);
}

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
  const displayName = fullName || user?.email?.split("@")[0] || "ROOT_OP";
  const displayEmail = user?.email || "";

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
        <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-xs md:hidden" onClick={() => setMobileOpen?.(false)} />
      )}

      <aside
        aria-label="Root NOC navigation"
        className={cn(
          "fixed left-0 top-0 z-50 flex h-screen w-[244px] flex-col border-r border-brand-200 bg-surface-1 transition-transform duration-200 ease-out",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          collapsed ? "md:-translate-x-full" : "md:translate-x-0",
        )}
      >
        {/* Brand Bar */}
        <div className="flex h-[52px] shrink-0 items-center justify-between border-b border-brand-200 px-3.5 bg-surface-1">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-signal-400 text-white shadow-xs">
              <ShieldCheck size={14} />
            </span>
            <div className="leading-tight">
              <span className="block text-[13px] font-semibold tracking-tight text-brand-950">
                Reigel Admin
              </span>
              <span className="block text-[10px] font-medium text-brand-400">
                Control Plane &amp; FinOps
              </span>
            </div>
          </div>
          <span
            title="Control Plane Live"
            className="h-2 w-2 rounded-full bg-success-500"
          />
        </div>

        {/* Subsystem Nav */}
        <nav className="flex-1 overflow-y-auto px-2.5 py-3.5 space-y-5">
          {GROUP_ORDER.map((groupName) => {
            const items = ADMIN_SECTIONS.filter((s) => s.group === groupName);
            return (
              <div key={groupName}>
                <div className="flex items-center justify-between px-2 pb-1.5">
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
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "group flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[12.5px] transition-colors",
                          active
                            ? "bg-signal-400/15 font-semibold text-primary-600 ring-1 ring-inset ring-signal-400/30"
                            : "font-medium text-brand-500 hover:bg-surface-2 hover:text-brand-950",
                        )}
                      >
                        <s.icon
                          size={14}
                          className={active ? "text-primary-600" : "text-brand-400 group-hover:text-brand-700"}
                        />
                        <span className="min-w-0 flex-1 truncate">{s.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}

          <div className="border-t border-brand-200 pt-3">
            <Link
              href="/dashboard"
              onClick={() => setMobileOpen?.(false)}
              className="flex items-center gap-2 rounded-md px-2.5 py-2 text-[12px] font-medium text-brand-400 transition-colors hover:bg-surface-2 hover:text-brand-950"
            >
              <ArrowLeft size={13} />
              <span>Back to Workspace</span>
            </Link>
          </div>
        </nav>

        {/* Operator Identity Footer */}
        <div className="relative border-t border-brand-200 bg-surface-2/50 p-2">
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-20" onClick={() => setMenuOpen(false)} />
              <div className="absolute bottom-full left-2 right-2 z-30 mb-1.5 overflow-hidden rounded-md border border-brand-200 bg-surface-1 p-1 shadow-2xl">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2 rounded-sm px-2.5 py-1.5 font-mono text-[11px] font-semibold text-error-700 transition hover:bg-error-50 cursor-pointer"
                >
                  <LogOut size={12} />
                  TERMINATE_SESSION
                </button>
              </div>
            </>
          )}
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="flex w-full items-center gap-2 rounded-sm p-1.5 text-left transition hover:bg-surface-3/60 cursor-pointer"
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-sm border border-signal-400/40 bg-signal-400/15 font-mono text-[10px] font-bold text-signal-400">
              OP
            </span>
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate font-mono text-[11px] font-bold text-brand-950">
                {displayName}
              </span>
              <span className="block truncate font-mono text-[9.5px] text-brand-400">
                {displayEmail}
              </span>
            </span>
            <MoreHorizontal size={13} className="shrink-0 text-brand-400" />
          </button>
        </div>
      </aside>
    </>
  );
}
