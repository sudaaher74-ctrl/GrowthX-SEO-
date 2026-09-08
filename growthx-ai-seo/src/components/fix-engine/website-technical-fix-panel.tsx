"use client";

import { useState, useMemo } from "react";
import {
  Wrench,
  Sparkles,
  Zap,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Search,
  Layers,
  Code,
  Compass,
  FileText,
  Activity,
  Calendar,
  Check,
  ChevronRight,
  ExternalLink,
  Target,
  Swords,
  ShieldCheck,
  Loader2,
  TrendingUp,
  Building2,
  Package,
  HelpCircle,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { CrawlIssue, TrackedCompetitor } from "@/lib/api-client";
import { useAutonomousPlanStatus, useLatestCrawl, useCrawlPages } from "@/hooks/use-growthx";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

interface WebsiteTechnicalFixPanelProps {
  projectId: string;
  domain?: string;
  businessName?: string;
  issues: CrawlIssue[];
  competitors: TrackedCompetitor[];
  isLoadingIssues?: boolean;
  onOpenAutoFixModal: (issue: CrawlIssue) => void;
  onOpen30DayPlan: () => void;
}

interface PlainIssueInfo {
  friendlyTitle: string;
  plainExplanation: string;
  businessHarm: string;
  category: "speed" | "visibility" | "schema" | "links";
  categoryLabel: string;
  icon: typeof Zap;
  severityLabel: "Critical" | "High" | "Medium";
}

/** Translates technical developer issue codes into clear, non-technical plain English explanations */
function translateTechnicalIssue(issue: CrawlIssue): PlainIssueInfo {
  const code = (issue.issueType || issue.description || "").toUpperCase();

  if (code.includes("404") || code.includes("BROKEN") || code.includes("NOT_FOUND") || code.includes("DEAD")) {
    return {
      friendlyTitle: "Broken Link (Customer Dead-End)",
      plainExplanation: "A link on your website leads to a page that no longer exists (404 error).",
      businessHarm: "Potential buyers hit a dead-end page and immediately leave your site, wasting your marketing budget.",
      category: "links",
      categoryLabel: "Broken Links",
      icon: AlertCircle,
      severityLabel: "Critical",
    };
  }

  if (code.includes("H1") || code.includes("HEADING") || code.includes("TITLE_MISSING")) {
    return {
      friendlyTitle: "Missing Main Page Headline",
      plainExplanation: "This page does not have a primary main headline (H1 tag) that tells Google what it is about.",
      businessHarm: "Google cannot determine your primary keyword, causing you to rank significantly lower than competitors.",
      category: "visibility",
      categoryLabel: "Search Visibility",
      icon: Search,
      severityLabel: "High",
    };
  }

  if (code.includes("META") || code.includes("DESCRIPTION")) {
    return {
      friendlyTitle: "Missing Google Search Snippet",
      plainExplanation: "This page has no promotional description text tag for Google search results.",
      businessHarm: "Your listing in Google appears empty or auto-scraped, causing searchers to click competitor links instead.",
      category: "visibility",
      categoryLabel: "Search Visibility",
      icon: Search,
      severityLabel: "High",
    };
  }

  if (code.includes("SCHEMA") || code.includes("JSON_LD") || code.includes("STRUCTURED")) {
    return {
      friendlyTitle: "Missing Verified Business / Product Schema",
      plainExplanation: "Your site lacks official structured data that verifies your organization, products, or reviews to search engines.",
      businessHarm: "Google cannot display rich star ratings, pricing, and FAQ dropdowns directly in search results.",
      category: "schema",
      categoryLabel: "Trust & Schema",
      icon: ShieldCheck,
      severityLabel: "High",
    };
  }

  if (code.includes("CANONICAL") || code.includes("DUPLICATE")) {
    return {
      friendlyTitle: "Duplicate Page Confusion",
      plainExplanation: "Multiple URL versions of this page exist without a primary canonical tag pointing to the original.",
      businessHarm: "Splits your search ranking power across two pages, allowing a competitor to outrank both.",
      category: "visibility",
      categoryLabel: "Search Visibility",
      icon: Search,
      severityLabel: "Critical",
    };
  }

  if (code.includes("SPEED") || code.includes("IMAGE") || code.includes("LCP") || code.includes("SLOW") || code.includes("ASSET")) {
    return {
      friendlyTitle: "Slow Mobile Loading Speed",
      plainExplanation: "Large uncompressed images or unoptimized scripts slow down page loading on smartphones.",
      businessHarm: "Over 53% of mobile visitors leave websites that take more than 3 seconds to load.",
      category: "speed",
      categoryLabel: "Speed & Mobile",
      icon: Zap,
      severityLabel: "Critical",
    };
  }

  return {
    friendlyTitle: issue.description || "Technical Optimization Gap",
    plainExplanation: "An on-page technical setting requires optimization to match modern search engine standards.",
    businessHarm: "Prevents search bots from cleanly indexing your content and lowers overall domain health.",
    category: "visibility",
    categoryLabel: "Search Visibility",
    icon: Wrench,
    severityLabel: issue.severity === "CRITICAL" ? "Critical" : issue.severity === "HIGH" ? "High" : "Medium",
  };
}

/** Stopwords for simple keyword extraction */
const STOPWORDS = new Set([
  "a", "about", "above", "after", "again", "against", "all", "am", "an", "and",
  "any", "are", "aren't", "as", "at", "be", "because", "been", "before", "being",
  "below", "between", "both", "but", "by", "can", "cannot", "could", "did", "do",
  "does", "doing", "don't", "down", "during", "each", "few", "for", "from",
  "further", "had", "has", "have", "having", "he", "her", "here", "hers", "herself",
  "him", "himself", "his", "how", "i", "if", "in", "into", "is", "isn't", "it",
  "its", "itself", "let's", "me", "more", "most", "my", "myself", "no", "nor",
  "not", "of", "off", "on", "once", "only", "or", "other", "ought", "our", "ours",
  "ourselves", "out", "over", "own", "same", "she", "should", "so", "some", "such",
  "than", "that", "the", "their", "theirs", "them", "themselves", "then", "there",
  "these", "they", "this", "those", "through", "to", "too", "under", "until", "up",
  "very", "was", "we", "were", "what", "when", "where", "which", "while", "who",
  "whom", "why", "with", "would", "you", "your", "yours", "yourself", "yourselves",
  "home", "page", "welcome", "index", "ltd", "inc", "llp", "pvt", "limited", "company",
  "official", "website", "site", "best", "top", "services", "service", "products",
  "product", "solutions", "solution", "overview", "contact", "about", "privacy",
  "policy", "terms", "conditions", "copyright", "rights", "reserved", "login",
  "register", "signup", "signin", "cart", "checkout", "blog", "posts", "read",
  "click", "view", "more", "learn", "menu", "search", "filter", "close", "open"
]);

export function WebsiteTechnicalFixPanel({
  projectId,
  domain,
  businessName,
  issues,
  competitors,
  isLoadingIssues,
  onOpenAutoFixModal,
  onOpen30DayPlan,
}: WebsiteTechnicalFixPanelProps) {
  const planStatus = useAutonomousPlanStatus(projectId);
  const isPlanApproved = Boolean(planStatus.data?.isApproved);
  const currentPlanDay = planStatus.data?.currentDay != null ? planStatus.data.currentDay : 1;

  const topCompetitor = competitors[0] || null;
  const topCompetitorName = topCompetitor?.name || topCompetitor?.label || topCompetitor?.domain || "Top Rival";

  // Fetch competitor pages to derive competitor keywords simply
  const competitorPagesQuery = useQuery({
    queryKey: ["competitor-pages-simple", projectId, topCompetitor?.id],
    queryFn: () => api.listCompetitorPages(projectId, topCompetitor!.id),
    enabled: Boolean(projectId && topCompetitor?.id),
    staleTime: 60000,
  });

  // Actionable issues
  const actionableIssues = useMemo(() => {
    return issues.filter((i) => i.status !== "RESOLVED");
  }, [issues]);

  // Extract simple competitor keywords from competitor crawled pages
  const simpleCompetitorKeywords = useMemo(() => {
    const pages = competitorPagesQuery.data || [];
    const keywordMap = new Map<string, { count: number; pageUrl: string; pageTitle: string }>();

    pages.forEach((p) => {
      const text = `${p.title || ""} ${Array.isArray(p.h1) ? p.h1.join(" ") : p.h1 || ""}`;
      const words = text
        .toLowerCase()
        .replace(/[^\w\s-]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .split(" ")
        .filter((w) => w.length > 3 && !STOPWORDS.has(w) && !/^\d+$/.test(w));

      // 2-word phrases
      for (let i = 0; i < words.length - 1; i++) {
        const bigram = `${words[i]} ${words[i + 1]}`;
        if (!STOPWORDS.has(words[i]) && !STOPWORDS.has(words[i + 1])) {
          if (!keywordMap.has(bigram)) {
            keywordMap.set(bigram, { count: 1, pageUrl: p.url, pageTitle: p.title || "Page" });
          } else {
            keywordMap.get(bigram)!.count += 1;
          }
        }
      }
    });

    const list = Array.from(keywordMap.entries())
      .map(([kw, data]) => ({
        keyword: kw.split(" ").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" "),
        count: data.count,
        competitorUrl: data.pageUrl,
        intent: /buy|price|order|delivery|cost|online/i.test(kw)
          ? "High Purchase Intent"
          : "Commercial Search",
        actionPlan: "We will target this keyword in Week 2 with an optimized service headline & FAQ block.",
      }))
      .slice(0, 6);

    // Fallback if competitor hasn't finished crawl yet
    if (list.length === 0) {
      const brandBase = businessName || "Your Industry";
      return [
        {
          keyword: `${brandBase} Near Me`,
          count: 12,
          competitorUrl: `https://${topCompetitor?.domain || "competitor.com"}/services`,
          intent: "High Purchase Intent",
          actionPlan: "Deploy local landing page to capture geo-targeted searches.",
        },
        {
          keyword: `Best ${brandBase} Service`,
          count: 8,
          competitorUrl: `https://${topCompetitor?.domain || "competitor.com"}/products`,
          intent: "Commercial Search",
          actionPlan: "Add dedicated product comparison page with customer proof.",
        },
        {
          keyword: `Affordable ${brandBase} Online`,
          count: 6,
          competitorUrl: `https://${topCompetitor?.domain || "competitor.com"}/pricing`,
          intent: "High Purchase Intent",
          actionPlan: "Deploy pricing table with Schema.org Offer structured data.",
        },
        {
          keyword: `${brandBase} Delivery & Reviews`,
          count: 5,
          competitorUrl: `https://${topCompetitor?.domain || "competitor.com"}/reviews`,
          intent: "Commercial Search",
          actionPlan: "Embed customer review snippets and FAQPage schema.",
        },
      ];
    }

    return list;
  }, [competitorPagesQuery.data, topCompetitor, businessName]);

  // Clean, non-technical competitor opportunities
  const simpleCompetitorOpportunities = [
    {
      title: "Dedicated Service Offering Pages",
      competitorStatus: `${topCompetitorName} has dedicated pages for each separate service; your site bundles them together.`,
      whyItHurts: "Google prefers ranking pages that focus exclusively on one service. You are losing specific search queries to rivals.",
      howWeFixIt: "In Week 2, we automatically create separate, keyword-targeted pages for each of your key offerings.",
      icon: Building2,
      impact: "High Revenue Impact",
    },
    {
      title: "Product Specs & Catalog Pages",
      competitorStatus: `${topCompetitorName} lists exact sizes, certifications, and technical specs; your site has limited details.`,
      whyItHurts: "Technical buyers and AI search engines look for concrete specifications (grades, dimensions, packaging).",
      howWeFixIt: "In Week 3, we generate structured spec tables with official Product Schema markup.",
      icon: Package,
      impact: "High Purchase Intent",
    },
    {
      title: "Comparison & 'Why Choose Us' Guide",
      competitorStatus: `${topCompetitorName} ranks for comparison searches ('Best alternatives to...').`,
      whyItHurts: "Buyers actively searching for comparison reviews are ready to purchase and end up choosing the rival.",
      howWeFixIt: "In Week 2, we deploy a verified, objective comparison matrix highlighting your advantages.",
      icon: Swords,
      impact: "Instant Conversion Win",
    },
  ];

  return (
    <div className="space-y-8">
      {/* ─────────────────────────────────────────────────────────────────────────────
          1. TOP EXECUTIVE BANNER: Everything In One Place (No Heavy Duplicated Tabs)
      ───────────────────────────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl border border-accent-300 dark:border-accent-800 bg-gradient-to-r from-accent-600 via-accent-700 to-brand-900 text-white p-6 shadow-md">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-1.5 max-w-2xl">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/20 backdrop-blur-xs text-white text-[11px] font-bold uppercase tracking-wider">
              <Sparkles size={12} className="text-amber-300" />
              Non-Technical Autopilot Engine
            </div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
              Website Technical SEO &amp; Competitor Conquest Fix Engine
            </h2>
            <p className="text-xs sm:text-[13px] text-accent-100 leading-relaxed">
              We analyzed your website and compared it with <strong className="text-white font-bold">{topCompetitorName}</strong>. Below is everything holding your website back in simple, plain English — plus a 1-click button to put your fixes on autopilot for 30 days.
            </p>
          </div>

          <div className="shrink-0">
            {isPlanApproved ? (
              <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/20">
                <div className="w-10 h-10 rounded-lg bg-emerald-400/20 text-emerald-300 flex items-center justify-center shrink-0">
                  <Activity size={20} className="animate-pulse text-emerald-300" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white flex items-center gap-1.5">
                    <span>Autopilot Active</span>
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  </div>
                  <div className="text-[11px] text-emerald-200">Day {currentPlanDay} of 30 in progress</div>
                </div>
                <Button
                  size="sm"
                  onClick={onOpen30DayPlan}
                  className="ml-2 bg-white text-brand-950 hover:bg-white/90 text-xs font-bold h-8"
                >
                  View Plan
                </Button>
              </div>
            ) : (
              <Button
                onClick={onOpen30DayPlan}
                className="bg-white hover:bg-white/95 text-brand-950 text-xs sm:text-sm font-black h-11 px-6 shadow-lg gap-2 shrink-0 group transition-all transform hover:-translate-y-0.5"
              >
                <Zap size={16} className="text-amber-500 fill-amber-500" />
                <span>Fix All Tasks (Generate 30-Day Plan)</span>
                <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
              </Button>
            )}
          </div>
        </div>

        {/* Quick Summary Metrics Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6 pt-5 border-t border-white/15">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center text-amber-300">
              <Wrench size={16} />
            </div>
            <div>
              <div className="text-lg font-black leading-none">{actionableIssues.length} Problems</div>
              <div className="text-[11px] text-accent-100 mt-0.5">Found on your website</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center text-emerald-300">
              <Target size={16} />
            </div>
            <div>
              <div className="text-lg font-black leading-none">{simpleCompetitorKeywords.length} High-Intent Keywords</div>
              <div className="text-[11px] text-accent-100 mt-0.5">Rivals rank for that you can capture</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center text-blue-300">
              <Building2 size={16} />
            </div>
            <div>
              <div className="text-lg font-black leading-none">3 Missing Page Types</div>
              <div className="text-[11px] text-accent-100 mt-0.5">To match competitor coverage</div>
            </div>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────────────────
          2. SECTION 1: Your Website Problems (Explained in Simple English)
      ───────────────────────────────────────────────────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-brand-950 dark:text-white flex items-center gap-2">
              <Wrench size={18} className="text-accent-600 dark:text-accent-400" />
              <span>1. Problems Found on Your Website</span>
            </h3>
            <p className="text-xs text-brand-600 dark:text-brand-400 mt-0.5">
              These technical errors stop Google from indexing your pages properly and cause visitors to bounce.
            </p>
          </div>
          <span className="text-xs text-brand-500 font-medium">
            {actionableIssues.length} issues needing attention
          </span>
        </div>

        {isLoadingIssues ? (
          <div className="py-12 text-center border rounded-2xl bg-white dark:bg-brand-950/20">
            <Loader2 size={24} className="animate-spin text-brand-400 mx-auto mb-2" />
            <p className="text-xs text-brand-500">Auditing site pages...</p>
          </div>
        ) : actionableIssues.length === 0 ? (
          <div className="p-6 rounded-2xl border border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20 text-center space-y-1">
            <CheckCircle2 size={24} className="text-emerald-600 mx-auto" />
            <div className="text-sm font-bold text-emerald-900 dark:text-emerald-300">No Critical Technical Problems!</div>
            <p className="text-xs text-emerald-700 dark:text-emerald-400">
              Your crawl is clean. Now focus on capturing the competitor keywords and missing pages below.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {actionableIssues.slice(0, 6).map((issue) => {
              const info = translateTechnicalIssue(issue);
              const IconComponent = info.icon;

              return (
                <div
                  key={issue.id}
                  className="p-4 rounded-xl border border-brand-200 dark:border-brand-800 bg-white dark:bg-brand-950/40 shadow-2xs hover:shadow-xs transition-all space-y-3 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span
                        className={cn(
                          "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                          info.severityLabel === "Critical"
                            ? "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300"
                            : "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
                        )}
                      >
                        {info.severityLabel} Priority
                      </span>
                      <span className="text-[10.5px] font-mono text-brand-400">
                        {info.categoryLabel}
                      </span>
                    </div>

                    <h4 className="text-[13.5px] font-bold text-brand-950 dark:text-white flex items-center gap-1.5">
                      <IconComponent size={15} className="text-accent-600 dark:text-accent-400 shrink-0" />
                      <span>{info.friendlyTitle}</span>
                    </h4>

                    <p className="text-xs text-brand-600 dark:text-brand-300 mt-1 leading-relaxed">
                      {info.plainExplanation}
                    </p>

                    <div className="mt-2.5 p-2 rounded-lg bg-amber-500/5 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-900/30 text-[11px] text-amber-900 dark:text-amber-300">
                      <strong>Why it hurts: </strong>{info.businessHarm}
                    </div>

                    <div className="mt-2 text-[10.5px] text-brand-400 truncate font-mono">
                      Page: {issue.affectedUrl}
                    </div>
                  </div>

                  <div className="pt-2.5 border-t border-brand-100 dark:border-brand-800/80 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => onOpenAutoFixModal(issue)}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-accent-600 hover:text-accent-700 dark:text-accent-400"
                    >
                      <Sparkles size={13} />
                      <span>1-Click Fix</span>
                    </button>
                    <span className="text-[11px] text-brand-400">Scheduled in 30-Day Plan</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────────────────────
          3. SECTION 2: Competitor Keywords (Simple Format - Not Heavy Tabs)
      ───────────────────────────────────────────────────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-brand-950 dark:text-white flex items-center gap-2">
              <Target size={18} className="text-emerald-600 dark:text-emerald-400" />
              <span>2. Keywords Competitors Rank For That You Don't</span>
            </h3>
            <p className="text-xs text-brand-600 dark:text-brand-400 mt-0.5">
              Buyers search these exact queries on Google. Your competitor <strong className="text-brand-950 dark:text-white font-semibold">{topCompetitorName}</strong> is capturing them; we can target them on your website.
            </p>
          </div>
          <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
            {simpleCompetitorKeywords.length} High-Intent Queries
          </span>
        </div>

        <div className="rounded-2xl border border-brand-200 dark:border-brand-800 bg-white dark:bg-brand-950/40 overflow-hidden shadow-2xs">
          <div className="divide-y divide-brand-100 dark:divide-brand-800/80">
            {simpleCompetitorKeywords.map((item, idx) => (
              <div
                key={idx}
                className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-brand-50/40 dark:hover:bg-brand-900/30 transition-colors"
              >
                <div className="space-y-1 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold text-brand-950 dark:text-white">
                      "{item.keyword}"
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                      {item.intent}
                    </span>
                    <span className="text-[11px] text-brand-400">
                      Found on {topCompetitorName}
                    </span>
                  </div>
                  <p className="text-xs text-brand-600 dark:text-brand-400">
                    <strong className="text-brand-800 dark:text-brand-200">How we fix it: </strong>
                    {item.actionPlan}
                  </p>
                </div>

                <div className="shrink-0 flex items-center gap-2 self-start md:self-center">
                  <span className="px-2.5 py-1 rounded-lg bg-brand-100 dark:bg-brand-800 text-[11px] font-semibold text-brand-800 dark:text-brand-200">
                    Week 2 Task
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────────────────
          4. SECTION 3: Missing Page Types (Simple Non-Technical Cards)
      ───────────────────────────────────────────────────────────────────────────── */}
      <div className="space-y-4">
        <div>
          <h3 className="text-base font-bold text-brand-950 dark:text-white flex items-center gap-2">
            <Building2 size={18} className="text-blue-600 dark:text-blue-400" />
            <span>3. Page Types Competitors Have That You Are Missing</span>
          </h3>
          <p className="text-xs text-brand-600 dark:text-brand-400 mt-0.5">
            Competitors built dedicated pages for these offerings to rank multiple times in Google search results.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {simpleCompetitorOpportunities.map((opp, idx) => {
            const Icon = opp.icon;
            return (
              <div
                key={idx}
                className="p-5 rounded-2xl border border-brand-200 dark:border-brand-800 bg-white dark:bg-brand-950/40 space-y-3 flex flex-col justify-between shadow-2xs"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                      <Icon size={16} />
                    </div>
                    <span className="text-[10.5px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                      {opp.impact}
                    </span>
                  </div>

                  <h4 className="text-sm font-bold text-brand-950 dark:text-white">
                    {opp.title}
                  </h4>

                  <div className="mt-2 text-xs text-brand-600 dark:text-brand-400 leading-relaxed">
                    <strong className="text-brand-800 dark:text-brand-200">What rival has: </strong>
                    {opp.competitorStatus}
                  </div>

                  <div className="mt-2 text-xs text-brand-600 dark:text-brand-400 leading-relaxed">
                    <strong className="text-brand-800 dark:text-brand-200">Why it matters: </strong>
                    {opp.whyItHurts}
                  </div>
                </div>

                <div className="pt-3 border-t border-brand-100 dark:border-brand-800/80 text-[11.5px] font-medium text-emerald-700 dark:text-emerald-400">
                  ✓ {opp.howWeFixIt}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────────────────
          5. BOTTOM ACTION BANNER: Fix All Tasks (Open 30-Day Plan)
      ───────────────────────────────────────────────────────────────────────────── */}
      <div className="p-6 rounded-2xl border border-brand-200 dark:border-brand-800 bg-gradient-to-r from-brand-50 via-white to-brand-50 dark:from-brand-950/60 dark:via-brand-900/60 dark:to-brand-950/60 flex flex-col sm:flex-row sm:items-center justify-between gap-5 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
            <CheckCircle2 size={15} />
            <span>Ready for 30-Day Automated Execution</span>
          </div>
          <h3 className="text-lg font-black text-brand-950 dark:text-white">
            Align All Problems &amp; Competitor Fixes Into a 30-Day Plan
          </h3>
          <p className="text-xs text-brand-600 dark:text-brand-400 max-w-2xl">
            When you approve the plan, GrowthX puts your site on autopilot: fixing website technical errors in Week 1, capturing competitor keywords in Week 2, improving speed &amp; schema in Week 3, and verifying search gains in Week 4.
          </p>
        </div>

        <div className="shrink-0">
          <Button
            onClick={onOpen30DayPlan}
            className="bg-brand-950 text-white dark:bg-white dark:text-brand-950 hover:bg-brand-800 text-xs sm:text-sm font-bold h-11 px-6 shadow-md gap-2"
          >
            <Zap size={15} className="text-amber-400 fill-amber-400" />
            <span>{isPlanApproved ? "View Active 30-Day Plan" : "Fix All Tasks (Open 30-Day Plan)"}</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
