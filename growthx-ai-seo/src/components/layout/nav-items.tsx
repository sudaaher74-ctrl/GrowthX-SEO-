"use client";
import { useQuery } from "@tanstack/react-query";
import { Activity, Globe, SearchCheck, Wrench, Bot, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api-client";
import { usePortfolio, useWorkspace, useIssueCounts } from "@/hooks/use-growthx";

/**
 * The workflow tabs, shared by the sidebar and the Dashboard's top bar so the
 * two can never disagree about what the sections are, what is done, or where a
 * sub-tab goes.
 */

export interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  aliases?: string[];
  /** Small right-aligned counter or metric. */
  tag?: string;
  tagTone?: "default" | "danger" | "success";
  disabled?: boolean;
  /** Sub-tabs, shown under the item when it is open. `tab` is its ?tab= value. */
  children?: { label: string; href: string; id: string; tab?: string; isDefault?: boolean }[];
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
  const auditDone = Boolean(issueCounts.data?.crawledAt);

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
  // Detail views belong to the AI Visibility page's main tabs.
  const mainNav: NavItem[] = [
    {
      label: "Dashboard",
      href: "/dashboard",
      icon: Activity,
    },
    {
      label: "Website Audit",
      href: "/website",
      icon: Globe,
      tag: clientRow?.criticalIssues ? String(clientRow.criticalIssues) : undefined,
      tagTone: "danger",
      step: { n: 1, done: auditDone, hint: auditDone ? "Audit done" : "Run your first website audit" },
      children: [
        { id: "overview", label: "Overview", href: "/website?tab=overview", tab: "overview" },
        { id: "technical-seo", label: "Technical health", href: "/website?tab=technical-seo", tab: "technical-seo", isDefault: true },
        { id: "performance", label: "Speed", href: "/website?tab=performance", tab: "performance" },
        { id: "pages", label: "Pages", href: "/website?tab=pages", tab: "pages" },
        { id: "content", label: "Content", href: "/website?tab=content", tab: "content" },
        { id: "issues", label: "Problems to fix", href: "/website?tab=issues", tab: "issues" },
        { id: "report", label: "Full Report", href: "/website?tab=report", tab: "report" },
      ],
    },
    {
      label: "Google",
      href: "/google",
      icon: SearchCheck,
      tag: googleDone ? "Connected" : undefined,
      children: [
        { id: "search-console", label: "Google Search Console", href: "/google/search-console" },
        { id: "analytics", label: "Google Analytics 4", href: "/google/analytics" },
      ],
    },
    {
      label: "AI Visibility",
      href: "/ai-visibility?tab=overview",
      aliases: ["/ai-visibility"],
      icon: Bot,
      step: { n: 2, done: visibilityDone, hint: visibilityDone ? "AI assistants checked" : "Understand your business, check Gemini and Sarvam, and build a lead plan" },
    },
    {
      label: "Fix Engine",
      href: "/fix-engine",
      icon: Wrench,
      children: [
        { id: "overview", label: "Overview", href: "/fix-engine?tab=overview", tab: "overview", isDefault: true },
        { id: "history", label: "Fix History", href: "/fix-engine?tab=history", tab: "history" },
        { id: "before-after", label: "Before & After", href: "/fix-engine?tab=before-after", tab: "before-after" },
        { id: "impact", label: "Impact Analytics", href: "/fix-engine?tab=impact", tab: "impact" },
        { id: "ledger", label: "Impact Ledger", href: "/fix-engine?tab=ledger", tab: "ledger" },
        { id: "reports", label: "Reports", href: "/fix-engine?tab=reports", tab: "reports" },
      ],
    },
    {
      label: "Proof of Impact",
      href: "/fix-engine?tab=impact",
      icon: ShieldCheck,
    },
  ];

  return { mainNav };
}
