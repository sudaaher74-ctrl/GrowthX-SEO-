"use client";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, LogOut, Menu, Moon, PanelLeftClose, PanelLeftOpen, Sun } from "lucide-react";

import { cn } from "@/lib/utils";
import { api } from "@/lib/api-client";
import { useTheme } from "@/hooks/use-theme";
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
  const { theme, toggleTheme } = useTheme();

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
        "fixed left-0 right-0 top-0 z-30 flex h-[52px] items-center gap-3 border-b bg-surface-1/95 backdrop-blur-md px-4 transition-all duration-300 ease-in-out",
        collapsed ? "md:left-0" : "md:left-[var(--sidebar-w,232px)]",
      )}
      style={{ borderColor: "var(--border-color)" }}
    >
      <button
        type="button"
        className="flex h-8 w-8 items-center justify-center rounded-lg text-brand-600 hover:bg-surface-2 md:hidden cursor-pointer"
        onClick={() => setMobileOpen?.(true)}
        aria-label="Open navigation"
      >
        <Menu size={18} />
      </button>
      <button
        type="button"
        onClick={onToggleCollapse}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        title={collapsed ? "Expand sidebar (⌘B)" : "Collapse sidebar (⌘B)"}
        className="hidden h-8 w-8 items-center justify-center rounded-lg text-brand-500 transition hover:bg-surface-2 hover:text-brand-950 md:flex cursor-pointer"
      >
        {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
      </button>

      <div className="flex min-w-0 items-center gap-2 text-[12.5px]">
        <span className="font-semibold text-brand-950 shrink-0">Operator</span>
        <span className="text-brand-300">/</span>
        <span className="truncate font-medium text-brand-500">{section.label}</span>
        <span className="hidden lg:inline text-brand-300">·</span>
        <span className="hidden lg:inline truncate text-[11.5px] text-brand-400">{section.description}</span>
      </div>

      <div className="ml-auto flex items-center gap-2 shrink-0">
        <Link
          href="/dashboard"
          className="hidden items-center gap-1.5 rounded-lg border border-brand-200 bg-surface-2 px-2.5 py-1.5 text-[12px] font-medium text-brand-700 transition-colors hover:bg-surface-3 hover:text-brand-950 sm:flex"
        >
          <ArrowLeft size={12} />
          Workspace
        </Link>

        <button
          type="button"
          onClick={toggleTheme}
          aria-label={theme === "dark" ? "Switch to Day mode" : "Switch to Night mode"}
          title={theme === "dark" ? "Switch to Day mode" : "Switch to Night mode"}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-brand-200 bg-surface-2 text-brand-600 transition-colors hover:bg-surface-3 hover:text-brand-950 cursor-pointer"
        >
          {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
        </button>

        <button
          type="button"
          onClick={signOut}
          aria-label="Sign out"
          title="Sign out"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-brand-200 bg-surface-2 text-brand-600 transition-colors hover:bg-surface-3 hover:text-brand-950 cursor-pointer"
        >
          <LogOut size={13} />
        </button>
      </div>
    </header>
  );
}
