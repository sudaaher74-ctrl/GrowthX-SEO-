"use client";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, LogOut, Menu, Moon, PanelLeftClose, PanelLeftOpen, Sun } from "lucide-react";

import { cn } from "@/lib/utils";
import { api } from "@/lib/api-client";
import { useTheme } from "@/hooks/use-theme";
import { ADMIN_SECTIONS, isAdminSection } from "@/components/layout/admin-sidebar";

/** Top bar for the admin console: no site, audit, period or search controls. */
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
  const { theme, toggleTheme } = useTheme();

  const tabParam = searchParams.get("tab");
  const section = ADMIN_SECTIONS.find((s) => s.id === (isAdminSection(tabParam) ? tabParam : "overview"));

  async function signOut() {
    await api.logout();
    queryClient.clear();
    router.replace("/login");
  }

  return (
    <header
      className={cn(
        "fixed left-0 right-0 top-0 z-30 flex h-[52px] items-center gap-3 border-b bg-surface-1/95 backdrop-blur-md px-4 transition-all duration-300 ease-in-out",
        collapsed ? "md:left-0" : "md:left-[var(--sidebar-w,232px)]",
      )}
      style={{ borderColor: "var(--border-color)" }}
    >
      <button className="md:hidden" onClick={() => setMobileOpen?.(true)} aria-label="Open navigation">
        <Menu size={18} className="text-brand-600" />
      </button>
      <button
        onClick={onToggleCollapse}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        className="hidden h-8 w-8 items-center justify-center rounded-lg text-brand-500 transition hover:bg-brand-100/60 hover:text-brand-950 md:flex"
      >
        {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
      </button>

      <div className="flex items-center gap-2 text-[13px]">
        <span className="font-semibold text-brand-950">Admin</span>
        <span className="text-brand-300">/</span>
        <span className="font-medium text-brand-500">{section?.label}</span>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <Link
          href="/dashboard"
          className="hidden items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12px] font-medium text-brand-600 transition-colors hover:text-brand-950 sm:flex"
          style={{ borderColor: "var(--border-color)" }}
        >
          <ArrowLeft size={12} />
          Workspace
        </Link>

        <button
          type="button"
          onClick={toggleTheme}
          aria-label={theme === "dark" ? "Switch to Day mode" : "Switch to Night mode"}
          title={theme === "dark" ? "Switch to Day mode" : "Switch to Night mode"}
          className="flex h-8 w-8 items-center justify-center rounded-lg border text-brand-500 transition-colors hover:bg-brand-50 hover:text-brand-950"
          style={{ borderColor: "var(--border-color)" }}
        >
          {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
        </button>

        <button
          onClick={signOut}
          aria-label="Sign out"
          title="Sign out"
          className="rounded-lg border p-1.5 text-brand-500 transition-colors hover:text-brand-950"
          style={{ borderColor: "var(--border-color)" }}
        >
          <LogOut size={13} />
        </button>
      </div>
    </header>
  );
}

