"use client";

import { useState, useMemo } from "react";
import {
  Wrench,
  Sparkles,
  Zap,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  HelpCircle,
  ArrowRight,
  Globe,
  Flame,
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ActionButton, Pill } from "@/components/ui/console";
import type { CrawlIssue, TrackedCompetitor } from "@/lib/api-client";
import { CompetitorOpportunitiesPanel } from "@/components/competitor/competitor-opportunities-panel";
import { CompetitorKeywordsPanel } from "@/components/competitor/competitor-keywords-panel";
import { WebsiteComparisonPanel } from "@/components/competitor/website-comparison";
import { useAutonomousPlanStatus } from "@/hooks/use-growthx";

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

type SubSection = "all_fixes" | "competitor_opps" | "competitor_keywords" | "benchmarks";
type IssueCategoryFilter = "all" | "speed" | "visibility" | "schema" | "links";

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
      friendlyTitle: "Broken Link / Customer Dead-End",
      plainExplanation: "A link on your website leads to a page that no longer exists (404 error).",
      businessHarm: "Potential buyers hit a dead-end page and immediately leave your site, wasting marketing spend.",
      category: "links",
      categoryLabel: "Broken Links & Navigation",
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
      friendlyTitle: "Missing Google Search Snippet Description",
      plainExplanation: "This page has no promotional description tag for Google search results.",
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
      categoryLabel: "Trust & Schema Proof",
      icon: ShieldCheck,
      severityLabel: "High",
    };
  }

  if (code.includes("CANONICAL") || code.includes("DUPLICATE")) {
    return {
      friendlyTitle: "Duplicate Page Confusion for Google",
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

  // Fallback friendly translation
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
  const [activeSection, setActiveSection] = useState<SubSection>("all_fixes");
  const [categoryFilter, setCategoryFilter] = useState<IssueCategoryFilter>("all");

  const planStatus = useAutonomousPlanStatus(projectId);
  const isPlanApproved = Boolean(planStatus.data?.isApproved);
  const currentPlanDay = planStatus.data?.currentDay != null ? planStatus.data.currentDay : 1;

  // Filter actionable issues
  const actionableIssues = useMemo(() => {
    return issues.filter((i) => i.status !== "RESOLVED");
  }, [issues]);

  const filteredIssues = useMemo(() => {
    if (categoryFilter === "all") return actionableIssues;
    return actionableIssues.filter((i) => {
      const translated = translateTechnicalIssue(i);
      return translated.category === categoryFilter;
    });
  }, [actionableIssues, categoryFilter]);

  const criticalCount = actionableIssues.filter((i) => i.severity === "CRITICAL").length;
  const highCount = actionableIssues.filter((i) => i.severity === "HIGH").length;

  return (
    <div className="space-y-6">
      {/* High-Impact Primary Action Banner: "Fix All Issues & Beat Competitors" */}
      <div className="relative overflow-hidden rounded-2xl border border-accent-300 dark:border-accent-800 bg-gradient-to-r from-accent-600 via-accent-700 to-brand-900 text-white p-6 shadow-md">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-1.5 max-w-2xl">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/20 backdrop-blur-xs text-white text-[11px] font-bold uppercase tracking-wider">
              <Sparkles size={12} className="text-amber-300" />
              Non-Technical Autopilot Engine
            </div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
              Fix All Website Issues &amp; Conquer Competitor Keywords
            </h2>
            <p className="text-xs sm:text-[13px] text-accent-100 leading-relaxed">
              We identified <strong className="text-white font-bold">{actionableIssues.length} website issues</strong> hurting your Google rankings and <strong className="text-white font-bold">{competitors.length} competitors</strong> stealing valuable search queries. Generate a 30-day autonomous plan to fix everything automatically.
            </p>
          </div>

          <div className="shrink-0 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {isPlanApproved ? (
              <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md rounded-xl p-2.5 border border-white/20">
                <div className="w-9 h-9 rounded-lg bg-emerald-400/20 text-emerald-300 flex items-center justify-center shrink-0">
                  <Activity size={18} className="animate-pulse text-emerald-300" />
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

        {/* Ambient background glow */}
        <div className="absolute -right-12 -bottom-12 w-64 h-64 rounded-full bg-accent-400/10 blur-3xl pointer-events-none" />
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-brand-200 dark:border-brand-800 pb-3">
        <button
          type="button"
          onClick={() => setActiveSection("all_fixes")}
          className={cn(
            "px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border",
            activeSection === "all_fixes"
              ? "bg-brand-950 text-white dark:bg-white dark:text-brand-950 border-transparent shadow-xs"
              : "bg-white dark:bg-brand-900 text-brand-700 dark:text-brand-300 border-brand-200 dark:border-brand-800 hover:border-brand-300",
          )}
        >
          <Wrench size={14} />
          <span>Website Technical Fixes</span>
          <span className="px-1.5 py-0.2 rounded-full bg-brand-200/50 dark:bg-brand-700/50 text-[10.5px] font-mono">
            {actionableIssues.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSection("competitor_opps")}
          className={cn(
            "px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border",
            activeSection === "competitor_opps"
              ? "bg-brand-950 text-white dark:bg-white dark:text-brand-950 border-transparent shadow-xs"
              : "bg-white dark:bg-brand-900 text-brand-700 dark:text-brand-300 border-brand-200 dark:border-brand-800 hover:border-brand-300",
          )}
        >
          <Compass size={14} />
          <span>Competitor Opportunities</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSection("competitor_keywords")}
          className={cn(
            "px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border",
            activeSection === "competitor_keywords"
              ? "bg-brand-950 text-white dark:bg-white dark:text-brand-950 border-transparent shadow-xs"
              : "bg-white dark:bg-brand-900 text-brand-700 dark:text-brand-300 border-brand-200 dark:border-brand-800 hover:border-brand-300",
          )}
        >
          <Target size={14} />
          <span>Competitor Keywords</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSection("benchmarks")}
          className={cn(
            "px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border",
            activeSection === "benchmarks"
              ? "bg-brand-950 text-white dark:bg-white dark:text-brand-950 border-transparent shadow-xs"
              : "bg-white dark:bg-brand-900 text-brand-700 dark:text-brand-300 border-brand-200 dark:border-brand-800 hover:border-brand-300",
          )}
        >
          <Swords size={14} />
          <span>Site vs. Competitor Benchmark</span>
        </button>
      </div>

      {/* SUB-SECTION 1: All Technical Fixes (User Friendly for Non-Technical Persons) */}
      {activeSection === "all_fixes" && (
        <div className="space-y-4">
          {/* Category Filter Pills */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl border border-brand-100 dark:border-brand-800 bg-brand-50/50 dark:bg-brand-950/30">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11.5px] font-semibold text-brand-500 mr-1">
                Filter by Problem Area:
              </span>
              {(
                [
                  { id: "all", label: "All Problems" },
                  { id: "speed", label: "⚡ Speed & Mobile" },
                  { id: "visibility", label: "🔍 Search Visibility" },
                  { id: "schema", label: "🛡️ Trust & Schema" },
                  { id: "links", label: "🔗 Broken Links" },
                ] as const
              ).map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategoryFilter(cat.id)}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-xs transition-colors border",
                    categoryFilter === cat.id
                      ? "bg-brand-950 text-white dark:bg-white dark:text-brand-950 border-transparent font-medium"
                      : "bg-white dark:bg-brand-900 text-brand-700 dark:text-brand-300 border-brand-200 dark:border-brand-800 hover:border-brand-300",
                  )}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            <div className="text-[11px] text-brand-500 dark:text-brand-400">
              Showing {filteredIssues.length} of {actionableIssues.length} issues
            </div>
          </div>

          {/* Plain English Issue Cards Grid */}
          {isLoadingIssues ? (
            <div className="py-16 text-center">
              <Loader2 size={28} className="animate-spin text-brand-400 mx-auto mb-2" />
              <p className="text-xs text-brand-500">Auditing website health and diagnosing issues...</p>
            </div>
          ) : filteredIssues.length === 0 ? (
            <div className="p-8 rounded-xl border border-brand-200 dark:border-brand-800 bg-white dark:bg-brand-950/20 text-center space-y-2">
              <CheckCircle2 size={32} className="text-emerald-500 mx-auto" />
              <h3 className="text-sm font-bold text-brand-950 dark:text-white">
                No Issues in this Category!
              </h3>
              <p className="text-xs text-brand-500 max-w-sm mx-auto">
                Your website has zero unresolved errors in this section. Explore other categories or view competitor opportunities above.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredIssues.map((issue) => {
                const info = translateTechnicalIssue(issue);
                const IconComponent = info.icon;

                return (
                  <div
                    key={issue.id}
                    className="p-4 rounded-xl border border-brand-200 dark:border-brand-800 bg-white dark:bg-brand-950/40 shadow-2xs hover:shadow-xs transition-all space-y-3 flex flex-col justify-between"
                  >
                    <div>
                      {/* Top status bar */}
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span
                          className={cn(
                            "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                            info.severityLabel === "Critical"
                              ? "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300"
                              : info.severityLabel === "High"
                              ? "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                              : "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300",
                          )}
                        >
                          {info.severityLabel} Priority
                        </span>
                        <span className="text-[10.5px] font-medium text-brand-400">
                          {info.categoryLabel}
                        </span>
                      </div>

                      {/* Friendly Title */}
                      <h4 className="text-[13.5px] font-bold text-brand-950 dark:text-white flex items-center gap-2">
                        <IconComponent size={15} className="text-accent-600 dark:text-accent-400 shrink-0" />
                        <span>{info.friendlyTitle}</span>
                      </h4>

                      {/* Plain Language Explanation */}
                      <p className="text-xs text-brand-600 dark:text-brand-300 mt-1 leading-relaxed">
                        {info.plainExplanation}
                      </p>

                      {/* Why it hurts business */}
                      <div className="mt-2.5 p-2.5 rounded-lg bg-amber-500/5 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-900/40 space-y-1">
                        <div className="text-[10.5px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-400 flex items-center gap-1">
                          <AlertTriangle size={11} />
                          <span>Why This Hurts Your Business</span>
                        </div>
                        <p className="text-[11.5px] text-brand-700 dark:text-brand-300">
                          {info.businessHarm}
                        </p>
                      </div>

                      {/* Affected URL */}
                      <div className="mt-2 text-[10.5px] text-brand-400 truncate font-mono">
                        Page: {issue.affectedUrl}
                      </div>
                    </div>

                    {/* Action footer */}
                    <div className="pt-3 border-t border-brand-100 dark:border-brand-800/80 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => onOpenAutoFixModal(issue)}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-accent-600 hover:text-accent-700 dark:text-accent-400"
                      >
                        <Sparkles size={13} />
                        <span>1-Click Code Fix</span>
                      </button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onOpenAutoFixModal(issue)}
                        className="text-xs h-7 px-2.5"
                      >
                        View Solution
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* SUB-SECTION 2: Competitor Opportunities (Missing Page Types) */}
      {activeSection === "competitor_opps" && (
        <div className="space-y-3">
          <div className="p-4 rounded-xl border border-brand-200 dark:border-brand-800 bg-white dark:bg-brand-950/30">
            <h3 className="text-sm font-bold text-brand-950 dark:text-white flex items-center gap-2">
              <Compass size={16} className="text-accent-600" />
              Competitor Page Coverage Gaps &amp; Expansion Opportunities
            </h3>
            <p className="text-xs text-brand-600 dark:text-brand-400 mt-0.5">
              Identifies dedicated landing page types (Services, Specs, Comparisons, Guides) that competitors have and your site is missing.
            </p>
          </div>
          <CompetitorOpportunitiesPanel projectId={projectId} competitors={competitors} />
        </div>
      )}

      {/* SUB-SECTION 3: Competitor Keywords (Keywords Rivals Rank For) */}
      {activeSection === "competitor_keywords" && (
        <div className="space-y-3">
          <div className="p-4 rounded-xl border border-brand-200 dark:border-brand-800 bg-white dark:bg-brand-950/30">
            <h3 className="text-sm font-bold text-brand-950 dark:text-white flex items-center gap-2">
              <Target size={16} className="text-accent-600" />
              Competitor Keywords &amp; Placement Blueprints
            </h3>
            <p className="text-xs text-brand-600 dark:text-brand-400 mt-0.5">
              High-intent commercial search queries where rivals steal traffic from your business, mapped to exact page placement blueprints.
            </p>
          </div>
          <CompetitorKeywordsPanel
            projectId={projectId}
            customerDomain={domain || "your-domain.com"}
            competitors={competitors}
          />
        </div>
      )}

      {/* SUB-SECTION 4: Benchmarks */}
      {activeSection === "benchmarks" && (
        <div className="space-y-3">
          <div className="p-4 rounded-xl border border-brand-200 dark:border-brand-800 bg-white dark:bg-brand-950/30">
            <h3 className="text-sm font-bold text-brand-950 dark:text-white flex items-center gap-2">
              <Swords size={16} className="text-accent-600" />
              Head-to-Head Competitor Technical Comparison
            </h3>
            <p className="text-xs text-brand-600 dark:text-brand-400 mt-0.5">
              Compares your site side-by-side with competitors on page coverage, technical health score, and structured schema data.
            </p>
          </div>
          <WebsiteComparisonPanel projectId={projectId} />
        </div>
      )}
    </div>
  );
}
