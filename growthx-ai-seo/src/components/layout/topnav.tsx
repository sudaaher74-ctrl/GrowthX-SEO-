"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "next-themes";
import { Search, Bell, Sun, Moon, ChevronDown, User, LogOut, Settings, CreditCard, HelpCircle, Zap, Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/lib/utils";
import { mockRecentActivity } from "@/lib/mock-data";
import { CommandPalette } from "@/components/ui/command-palette";

interface TopNavProps {
  collapsed: boolean;
  setMobileOpen?: (open: boolean) => void;
}

export function TopNav({ collapsed, setMobileOpen }: TopNavProps) {
  const { theme, setTheme } = useTheme();
  const [notifOpen, setNotifOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const unread = mockRecentActivity.filter(a => a.status === "pending").length;

  return (
    <header
      className={cn(
        "fixed top-0 right-0 h-14 z-40 flex items-center gap-2 px-3 md:gap-3 md:px-4 border-b border-[var(--border-color)] backdrop-blur-md transition-all duration-300",
        collapsed ? "md:left-[64px]" : "md:left-[240px]",
        "left-0"
      )}
      style={{
        background: "var(--bg-overlay)",
      }}
    >
      {/* Mobile Menu Toggle */}
      <button
        onClick={() => setMobileOpen?.(true)}
        className="md:hidden p-1.5 rounded-lg text-[var(--text-muted)] hover:bg-[var(--surface-3)] hover:text-[var(--text-primary)] transition-base -ml-1"
        aria-label="Open menu"
      >
        <Menu size={20} />
      </button>

      {/* Breadcrumb / Page title */}
      <div className="flex-1 min-w-0">
        <h1 className="text-sm font-semibold text-[var(--text-primary)] truncate">GrowthX AI SEO</h1>
        <p className="text-xs text-[var(--text-muted)]">milquu.com · Navi Mumbai</p>
      </div>

      {/* Search trigger */}
      <button
        onClick={() => setSearchOpen(true)}
        className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--surface-2)] text-[var(--text-muted)] text-sm hover:border-[var(--border-strong)] transition-base"
      >
        <Search size={13} />
        <span className="hidden lg:block">Search...</span>
        <kbd className="hidden md:inline-flex h-5 items-center gap-0.5 rounded border border-[var(--border-color)] bg-[var(--surface-3)] px-1 text-[10px] font-medium">
          <span>⌘</span>K
        </kbd>
      </button>

      {/* Mobile search icon only */}
      <button
        onClick={() => setSearchOpen(true)}
        className="sm:hidden p-1.5 rounded-lg text-[var(--text-muted)] hover:bg-[var(--surface-3)] transition-base ml-auto"
      >
        <Search size={18} />
      </button>

      {/* Automation status */}
      <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-medium">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        4 automations running
      </div>

      {/* Theme toggle */}
      <button
        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-3)] transition-base"
        aria-label="Toggle theme"
      >
        {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
      </button>

      {/* Notifications */}
      <div className="relative">
        <button
          onClick={() => { setNotifOpen(!notifOpen); setUserOpen(false); }}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-3)] transition-base relative"
          aria-label="Notifications"
        >
          <Bell size={15} />
          {unread > 0 && (
            <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-red-500" />
          )}
        </button>

        <AnimatePresence>
          {notifOpen && (
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.97 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 top-10 w-80 card z-50 overflow-hidden"
            >
              <div className="px-4 py-3 border-b border-[var(--border-color)] flex items-center justify-between">
                <span className="text-sm font-semibold">Notifications</span>
                <span className="text-xs text-blue-500 cursor-pointer hover:underline">Mark all read</span>
              </div>
              <div className="divide-y divide-[var(--border-color)] max-h-80 overflow-y-auto">
                {mockRecentActivity.slice(0, 5).map((item) => (
                  <div key={item.id} className={cn(
                    "px-4 py-3 hover:bg-[var(--surface-2)] cursor-pointer",
                    item.status === "pending" && "bg-blue-50/50 dark:bg-blue-900/10"
                  )}>
                    <p className="text-xs text-[var(--text-primary)] leading-relaxed">{item.message}</p>
                    <p className="text-[10px] text-[var(--text-muted)] mt-1">{formatRelativeTime(item.time)}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* User menu */}
      <div className="relative">
        <button
          onClick={() => { setUserOpen(!userOpen); setNotifOpen(false); }}
          className="flex items-center gap-2 pl-2 pr-1 py-1 rounded-lg hover:bg-[var(--surface-3)] transition-base"
        >
          <div className="w-7 h-7 rounded-full bg-black dark:bg-white flex items-center justify-center text-white dark:text-black text-xs font-medium shrink-0">
            S
          </div>
          <span className="hidden md:block text-sm font-medium text-[var(--text-primary)]">Sudarshan</span>
          <ChevronDown size={13} className="text-[var(--text-muted)]" />
        </button>

        <AnimatePresence>
          {userOpen && (
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.97 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 top-10 w-56 card z-50 py-1 overflow-hidden"
            >
              <div className="px-3 py-2 border-b border-[var(--border-color)]">
                <p className="text-sm font-semibold text-[var(--text-primary)]">Sudarshan</p>
                <p className="text-xs text-[var(--text-muted)]">sudarshan@growthx.in</p>
              </div>
              {[
                { icon: User, label: "Profile" },
                { icon: Settings, label: "Settings" },
                { icon: CreditCard, label: "Billing" },
                { icon: Zap, label: "Upgrade Plan" },
                { icon: HelpCircle, label: "Help & Support" },
              ].map(({ icon: Icon, label }) => (
                <button key={label} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)] transition-base text-left">
                  <Icon size={14} />
                  {label}
                </button>
              ))}
              <div className="border-t border-[var(--border-color)] mt-1 pt-1">
                <button className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-base text-left">
                  <LogOut size={14} />
                  Sign Out
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Click outside handler */}
      {(notifOpen || userOpen) && (
        <div className="fixed inset-0 z-40" onClick={() => { setNotifOpen(false); setUserOpen(false); }} />
      )}

      {/* Command Palette (⌘K) */}
      <CommandPalette open={searchOpen} onOpenChange={setSearchOpen} />
    </header>
  );
}
