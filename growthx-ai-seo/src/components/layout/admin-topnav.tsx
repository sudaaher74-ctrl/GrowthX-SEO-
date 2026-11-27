"use client";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Terminal,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { api } from "@/lib/api-client";
import { ADMIN_SECTIONS, resolveAdminSection } from "@/components/layout/admin-sidebar";

export function AdminTopNav({
  collapsed = false,
  onToggleCollapse,
  setMobileOpen,
}: {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  setMobileOpen?: (open: boolean) => void;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();

  const currentId = resolveAdminSection(searchParams.get("tab"));
  const section = ADMIN_SECTIONS.find((s) => s.id === currentId) ?? ADMIN_SECTIONS[0];

  async function signOut() {
    await api.logout();
    queryClient.clear();
    router.replace("/login");
  }

  return (
    <header
      className={cn(
        "fixed left-0 right-0 top-0 z-30 flex h-[48px] items-center gap-3 border-b border-brand-200 bg-surface-1/95 backdrop-blur-md px-3.5 transition-all duration-200 ease-out",
        collapsed ? "md:left-0" : "md:left-[244px]",
      )}
    >
      <button
        type="button"
        className="flex h-7 w-7 items-center justify-center rounded-sm border border-brand-200 bg-surface-2 text-brand-500 hover:text-brand-950 md:hidden cursor-pointer"
        onClick={() => setMobileOpen?.(true)}
        aria-label="Open navigation"
      >
        <Menu size={15} />
      </button>
      <button
        type="button"
        onClick={onToggleCollapse}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        title={collapsed ? "Expand sidebar (⌘B)" : "Collapse sidebar (⌘B)"}
        className="hidden h-7 w-7 items-center justify-center rounded-sm border border-brand-200 bg-surface-2 text-brand-400 transition hover:border-brand-300 hover:text-brand-950 md:flex cursor-pointer"
      >
        {collapsed ? <PanelLeftOpen size={14} /> : <PanelLeftClose size={14} />}
      </button>

      {/* Terminal Breadcrumb */}
      <div className="flex min-w-0 items-center gap-1.5 font-mono text-[11.5px]">
        <Terminal size={13} className="shrink-0 text-signal-400" />
        <span className="text-brand-400 shrink-0">root://reigel-ops/</span>
        <span className="font-bold text-signal-400 shrink-0">{section.label}</span>
        <span className="hidden xl:inline text-brand-300 mx-1">|</span>
        <span className="hidden xl:inline truncate text-[11px] text-brand-400">{section.description}</span>
      </div>

      <div className="ml-auto flex items-center gap-2 shrink-0">
        <span className="hidden md:inline-flex items-center gap-1.5 rounded-sm border border-success-200 bg-success-50 px-2 py-0.5 font-mono text-[10px] font-bold tracking-wider text-success-700">
          <span className="h-1.5 w-1.5 rounded-full bg-success-500 animate-pulse" />
          PROD_CONTROL
        </span>

        <Link
          href="/dashboard"
          className="hidden items-center gap-1.5 rounded-sm border border-brand-200 bg-surface-2 px-2.5 py-1 font-mono text-[11px] font-semibold text-brand-600 transition-colors hover:border-brand-300 hover:text-brand-950 sm:flex"
        >
          <ArrowLeft size={11} />
          APP
        </Link>

        <button
          type="button"
          onClick={signOut}
          aria-label="Sign out"
          title="Terminate operator session"
          className="flex h-7 w-7 items-center justify-center rounded-sm border border-brand-200 bg-surface-2 text-brand-500 transition-colors hover:border-error-200 hover:bg-error-50 hover:text-error-700 cursor-pointer"
        >
          <LogOut size={12} />
        </button>
      </div>
    </header>
  );
}
