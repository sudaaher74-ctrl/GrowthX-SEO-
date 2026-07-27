"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, FolderOpen, Bug, Search, BarChart3, Users2,
  FileText, Bot, LineChart, AreaChart, Code2, Tag, Image, MapPin,
  Link2, FileBarChart, Zap, CreditCard, Settings, HelpCircle,
  ChevronLeft, ChevronRight, TrendingUp, Globe, Sparkles,
  Activity, ShieldAlert
} from "lucide-react";

const navItems = [
  { group: "Overview", items: [
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { label: "Projects", href: "/projects", icon: FolderOpen },
  ]},
  { group: "Analytics", items: [
    { label: "Search Console", href: "/search-console", icon: LineChart },
    { label: "Google Analytics", href: "/analytics", icon: AreaChart },
    { label: "Rank Tracking", href: "/rank-tracking", icon: TrendingUp },
  ]},
  { group: "SEO Tools", items: [
    { label: "Technical SEO", href: "/technical-seo", icon: Bug },
    { label: "Keyword Research", href: "/keywords", icon: Search },
    { label: "Competitors", href: "/competitors", icon: Users2 },
    { label: "Backlinks", href: "/backlinks", icon: Link2 },
  ]},
  { group: "AI Features", items: [
    { label: "Content AI", href: "/content-ai", icon: FileText },
    { label: "Meta Optimizer", href: "/meta-optimizer", icon: Tag },
    { label: "Schema Generator", href: "/schema-generator", icon: Code2 },
    { label: "Image SEO", href: "/image-seo", icon: Image },
    { label: "Internal Linking", href: "/internal-linking", icon: Link2 },
    { label: "Local SEO", href: "/local-seo", icon: MapPin },
    { label: "GEO / AI Visibility", href: "/geo-tracking", icon: Sparkles },
    { label: "AI Assistant", href: "/ai-assistant", icon: Bot },
  ]},
  { group: "Operations", items: [
    { label: "Automations", href: "/automations", icon: Zap },
    { label: "Reports", href: "/reports", icon: FileBarChart },
    { label: "Activity", href: "/activity", icon: Activity },
  ]},
  { group: "Account", items: [
    { label: "Billing", href: "/billing", icon: CreditCard },
    { label: "Settings", href: "/settings", icon: Settings },
    { label: "Admin Panel", href: "/admin", icon: ShieldAlert },
    { label: "Help", href: "/help", icon: HelpCircle },
  ]},
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();

  return (
    <motion.aside
      animate={{ width: collapsed ? 64 : 240 }}
      transition={{ duration: 0.25, ease: "easeInOut" }}
      className="fixed left-0 top-0 h-screen z-50 flex flex-col overflow-hidden border-r border-[var(--sidebar-border)]"
      style={{ background: "var(--sidebar-bg)" }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-14 shrink-0 border-b border-[var(--sidebar-border)]">
        <div className="w-8 h-8 rounded-lg gradient-bg-brand flex items-center justify-center shrink-0">
          <Globe size={16} className="text-white" />
        </div>
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.15 }}
              className="overflow-hidden"
            >
              <span className="font-bold text-sm gradient-text-brand whitespace-nowrap">GrowthX AI SEO</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3 px-2 space-y-0.5">
        {navItems.map((group) => (
          <div key={group.group} className="mb-1">
            <AnimatePresence>
              {!collapsed && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="px-2 py-1.5"
                >
                  <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--text-muted)]">
                    {group.group}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
            {group.items.map((item) => {
              const active = pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link key={item.href} href={item.href}>
                  <div
                    className={cn(
                      "sidebar-item relative",
                      active && "active",
                      collapsed && "justify-center px-0 py-2"
                    )}
                    title={collapsed ? item.label : undefined}
                  >
                    {active && (
                      <motion.div
                        layoutId="sidebar-active"
                        className="absolute inset-0 rounded-lg"
                        style={{ background: "var(--sidebar-item-active)" }}
                        transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
                      />
                    )}
                    <item.icon size={16} className="shrink-0 relative z-10" />
                    <AnimatePresence>
                      {!collapsed && (
                        <motion.span
                          initial={{ opacity: 0, x: -4 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -4 }}
                          transition={{ duration: 0.15 }}
                          className="text-sm relative z-10 whitespace-nowrap"
                        >
                          {item.label}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </div>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Toggle button */}
      <div className="p-2 border-t border-[var(--sidebar-border)] shrink-0">
        <button
          onClick={onToggle}
          className="w-full flex items-center justify-center p-2 rounded-lg hover:bg-[var(--sidebar-item-hover)] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-base"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>
    </motion.aside>
  );
}
