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

export interface GbpTabItem {
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
    <div className="relative border-b overflow-x-auto no-scrollbar" style={{ borderColor: "var(--border-color)" }}>
      <div className="flex items-center gap-1 min-w-max pb-px">
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
              onClick={() => onChange(tab.id)}
              className={cn(
                "group relative flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold transition-all whitespace-nowrap border-b-2",
                isActive
                  ? "border-brand-950 text-brand-950 bg-brand-50/50 rounded-t-lg"
                  : "border-transparent text-brand-500 hover:text-brand-900 hover:border-brand-200"
              )}
            >
              <Icon
                size={14}
                className={cn(
                  "shrink-0 transition-colors",
                  isActive ? "text-brand-950" : "text-brand-400 group-hover:text-brand-700"
                )}
              />
              <span>{tab.label}</span>
              {badgeContent != null && (
                <span
                  className={cn(
                    "ml-1 rounded-full px-1.5 py-0.2 font-mono text-[10px] font-bold leading-tight",
                    isActive
                      ? "bg-brand-950 text-white"
                      : "bg-brand-100 text-brand-700 group-hover:bg-brand-200"
                  )}
                >
                  {badgeContent}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
