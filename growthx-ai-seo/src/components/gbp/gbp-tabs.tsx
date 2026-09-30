"use client";

import React from "react";
import {
  LayoutDashboard,
  ClipboardCheck,
  Tag,
  Briefcase,
  Star,
  Image as ImageIcon,
  BarChart3,
  Users,
  Megaphone,
  Sparkles,
  ListTodo,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type GbpTabKey =
  | "overview"
  | "audit"
  | "categories"
  | "services"
  | "reviews"
  | "photos"
  | "rankings"
  | "competitors"
  | "posts"
  | "ai-recommendations"
  | "action-plan";

interface GbpTabItem {
  id: GbpTabKey;
  label: string;
  icon: React.ElementType;
  badge?: string | number;
}

export const GBP_TABS: GbpTabItem[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "audit", label: "Profile Audit", icon: ClipboardCheck },
  { id: "reviews", label: "Reviews", icon: Star },
  { id: "photos", label: "Photos", icon: ImageIcon },
  { id: "services", label: "Services", icon: Briefcase },
  { id: "categories", label: "Categories", icon: Tag },
  { id: "rankings", label: "Local Rankings", icon: BarChart3 },
  { id: "competitors", label: "Competitors", icon: Users },
  { id: "posts", label: "Posts", icon: Megaphone },
  { id: "ai-recommendations", label: "AI Recommendations", icon: Sparkles },
  { id: "action-plan", label: "Action Plan", icon: ListTodo },
];

interface GbpTabsProps {
  activeTab: GbpTabKey;
  onChange: (tab: GbpTabKey) => void;
  reviewCount?: number;
  proposalsCount?: number;
  issuesCount?: number;
}

export function GbpTabs({
  activeTab,
  onChange,
  reviewCount,
  proposalsCount,
  issuesCount,
}: GbpTabsProps) {
  return (
    <div
      role="tablist"
      aria-label="Google Business Profile tabs"
      className="inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-full bg-brand-50 border border-brand-200/60 p-1 text-[11.5px] font-semibold [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {GBP_TABS.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;

        let badgeContent: string | number | undefined = tab.badge;
        if (tab.id === "reviews" && reviewCount != null && reviewCount > 0) {
          badgeContent = reviewCount;
        } else if (tab.id === "ai-recommendations" && proposalsCount != null && proposalsCount > 0) {
          badgeContent = proposalsCount;
        } else if (tab.id === "audit" && issuesCount != null && issuesCount > 0) {
          badgeContent = issuesCount;
        }

        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={cn(
              "inline-flex items-center gap-1.5 shrink-0 rounded-full px-3 py-1.5 text-[11.5px] font-semibold transition-colors",
              isActive
                ? "bg-signal-400 text-signal-ink font-bold shadow-xs"
                : "text-brand-400 hover:text-brand-950"
            )}
          >
            <Icon
              size={13.5}
              className={cn(
                "shrink-0 transition-colors",
                isActive ? "text-signal-ink" : "text-brand-400"
              )}
            />
            <span>{tab.label}</span>
            {badgeContent != null && (
              <span
                className={cn(
                  "ml-0.5 rounded-full px-1.5 py-0.2 font-mono text-[10px] font-bold leading-tight",
                  isActive
                    ? "bg-signal-ink/15 text-signal-ink"
                    : "bg-brand-200/60 text-brand-700"
                )}
              >
                {badgeContent}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
