"use client";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  Crosshair,
  Globe,
  LayoutGrid,
  Wrench,
  Bot,
  Link2,
  CalendarDays,
  Search,
  History,
  TrendingUp,
  Sliders,
} from "lucide-react";
import { api } from "@/lib/api-client";
import { usePortfolio, useWorkspace, useIssueCounts } from "@/hooks/use-growthx";

/**
 * The workflow tabs, shared by the sidebar and the Dashboard's top bar so the
 * two can never disagree about what the sections are, what is done, or where a
 * sub-tab goes.
 */

export type NavGroupKey = "overview" | "intelligence" | "execution";

export interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  group?: NavGroupKey;
  aliases?: string[];
  /** Small right-aligned counter or metric. */
  tag?: string;
  tagTone?: "default" | "danger" | "success";
  disabled?: boolean;
  /** Sub-tabs, shown under the item when it is open. `tab` is its ?tab= value. */
  children?: { label: string; href: string; id: string; tab?: string; isDefault?: boolean; icon?: React.ElementType }[];
  /** A step of the guided workflow, ticked once it has really been done. */
  step?: { n: number; done: boolean; hint: string };
}

export function useMainNav(): { mainNav: NavItem[] } {
  const { orgId, projects, projectId } = useWorkspace();
  const portfolio = usePortfolio(orgId);
  const selected = projects.find((p) => p.id === projectId) ?? projects[0] ?? null;
  const clientRow = portfolio.data?.clients.find((c) => c.projectId === selected?.id) ?? null;
  const issueCounts = useIssueCounts(projectId);

  // The guided order: audit your own site, connect Google, add the rivals,
  // connect the Business Profile, then ask the AI assistants — each step feeds the next (AI Visibility matches questions to
  // audited pages and explains a rival's win from its crawled page). Every
  // tick is read from real state, never from having visited the page.
  const competitorsQuery = useQuery({
    queryKey: ["action-engine-competitors", projectId],
    queryFn: () => api.actionEngineCompetitors(projectId!),
    enabled: Boolean(projectId),
    retry: false,
  });
  const auditDone = Boolean(issueCounts.data?.crawledAt);
  const competitorsDone = (competitorsQuery.data?.competitors.length ?? 0) > 0;

  // Done once at least one AI assistant has really been asked about the business.
  const visibilityQuery = useQuery({
    queryKey: ["ai-visibility-done", projectId],
    queryFn: () => api.getVisibility(projectId!, 28),
    enabled: Boolean(projectId),
    retry: false,
  });
  const visibilityDone = (visibilityQuery.data?.summary.checked ?? 0) > 0;

  const googleQuery = useQuery({
    queryKey: ["google-connections", projectId],
    queryFn: () => api.googleConnections(projectId!),
    enabled: Boolean(projectId),
    retry: false,
  });
  const googleProviders = googleQuery.data?.providers ?? [];
  const isConnected = (id: string) => googleProviders.some((p) => p.id === id && p.status === "CONNECTED");
  const googleDone = isConnected("search_console") || isConnected("analytics");


  // The workflow, aligned with the agency platform navigation:
  // Dashboard, Website Audit, Traffic, Competitor Intelligence, Backlink Intelligence, AI Visibility, Fix Engine
  const mainNav: NavItem[] = [
    {
      label: "Dashboard",
      href: "/dashboard",
      icon: LayoutGrid,
      group: "overview",
    },
    {
      label: "Website Audit",
      href: "/website",
      icon: Globe,
      group: "overview",
      tag: clientRow?.criticalIssues ? String(clientRow.criticalIssues) : undefined,
      tagTone: "danger",
      step: { n: 1, done: auditDone, hint: auditDone ? "Audit done" : "Run your first website audit" },
    },
    {
      label: "Organic Search",
      href: "/organic-search",
      icon: Search,
      group: "overview",
      aliases: ["/organic-search", "/google/keywords"],
    },
    {
      label: "Traffic",
      href: "/google",
      icon: BarChart3,
      group: "overview",
      aliases: ["/traffic", "/google/traffic", "/google/search-console", "/google/analytics"],
      step: { n: 2, done: googleDone, hint: googleDone ? "Traffic connected" : "Connect Search Console or Analytics" },
    },
    {
      label: "Competitor Intelligence",
      href: "/competitor-intelligence",
      icon: Crosshair,
      group: "intelligence",
      step: { n: 3, done: competitorsDone, hint: competitorsDone ? "Competitors added" : "Add your competitors" },
    },
    {
      label: "Backlink Intelligence",
      href: "/backlinks",
      icon: Link2,
      group: "intelligence",
    },
    {
      label: "AI Visibility",
      href: "/ai-visibility",
      icon: Bot,
      group: "intelligence",
      step: { n: 4, done: visibilityDone, hint: visibilityDone ? "AI assistants checked" : "Run AI visibility monitoring" },
    },
    {
      label: "Fix Engine",
      href: "/fix-engine",
      icon: Wrench,
      group: "execution",
    },
    {
      label: "Monthly Report",
      href: "/monthly-report",
      icon: CalendarDays,
      group: "execution",
    },
  ];

  return { mainNav };
}

