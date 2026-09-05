"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useQuery, useQueries, useQueryClient } from "@tanstack/react-query";
import {
  Sparkles,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Check,
  Search,
  ArrowRight,
  FileText,
  Layers,
  Zap,
  ChevronDown,
  Globe,
  TrendingUp,
  Target,
  HelpCircle,
  MapPin,
  Compass,
  SlidersHorizontal,
} from "lucide-react";
import { LoadingState, NoDataState } from "@/components/ui/truthful-state";
import { api, CoverageOpportunity, type TrackedCompetitor } from "@/lib/api-client";
import { WebsiteComparisonPanel } from "./website-comparison";

/**
 * These panels are handed rows straight from `listCompetitors`. The local
 * duplicate of that shape needed an `any` index signature purely to stay
 * assignable from the real type, and declared a `websiteId` nothing ever read.
 */
type TrackedCompetitorInfo = TrackedCompetitor;

interface CompetitorOpportunitiesPanelProps {
  projectId: string;
  competitors: TrackedCompetitorInfo[];
}

/** Human-friendly labels and details for page types */
const PAGE_KIND: Record<
  string,
  {
    label: string;
    singular: string;
    icon: typeof FileText;
    color: string;
    description: string;
    whyFavor: string;
    recommendedElements: string[];
    schemaType: string;
  }
> = {
  SERVICE: {
    label: "Service Pages",
    singular: "Service Page",
    icon: Compass,
    color: "bg-blue-50 text-blue-700 border-blue-200",
    description: "Dedicated landing pages focused on a specific service offering.",
    whyFavor:
      "Captures high-intent commercial searches ('hire [service]', '[service] company') and lets Google & AI answer engines cite specific deliverables rather than vague homepage mentions.",
    recommendedElements: [
      "Process Workflow & Timeline",
      "Key Deliverables Checklist",
      "Client Proof & Case Snippet",
      "Service Schema (JSON-LD)",
    ],
    schemaType: "Service",
  },
  PRODUCT: {
    label: "Product Specs & Catalogs",
    singular: "Product Spec Page",
    icon: Layers,
    color: "bg-emerald-50 text-emerald-700 border-emerald-200",
    description: "Detailed product pages with technical specifications, grades, and procurement specs.",
    whyFavor:
      "Ranks for technical B2B buyer queries, SKU searches, and supplies AI engines with concrete parameters (grades, packaging, shelf-life, and certifications).",
    recommendedElements: [
      "Technical Specs / Properties Table",
      "Packaging & Batch Order Sizes",
      "Quality Certifications (ISO/FDA)",
      "Product Schema with Pricing/Availability",
    ],
    schemaType: "Product",
  },
  BLOG: {
    label: "Articles & Guides",
    singular: "Educational Guide",
    icon: FileText,
    color: "bg-purple-50 text-purple-700 border-purple-200",
    description: "In-depth content addressing customer questions, problem-solving, and industry best practices.",
    whyFavor:
      "Builds topical authority across the customer journey. Generative engines (ChatGPT, Gemini, Google AI Overviews) heavily favor deep educational guides when answering buyer research queries.",
    recommendedElements: [
      "Comprehensive 1,200+ Word Breakdown",
      "Step-by-Step Problem Solving Guide",
      "Expert Author Credentials",
      "Interactive or Visual Comparison",
    ],
    schemaType: "Article",
  },
  FAQ: {
    label: "FAQ & Rich Answers",
    singular: "FAQ Page",
    icon: HelpCircle,
    color: "bg-amber-50 text-amber-700 border-amber-200",
    description: "Direct answers to common pre-purchase questions and customer objections.",
    whyFavor:
      "Direct question-and-answer pairs match natural language voice search and conversational AI prompts, qualifying for Google FAQ rich snippet carousels.",
    recommendedElements: [
      "Conversational Direct Q&A Pairs",
      "FAQPage Schema (JSON-LD)",
      "Pricing, Lead Time & Warranty Clarifications",
      "Related Service Cross-Links",
    ],
    schemaType: "FAQPage",
  },
  LOCATION: {
    label: "Location & Regional",
    singular: "Location Page",
    icon: MapPin,
    color: "bg-rose-50 text-rose-700 border-rose-200",
    description: "Targeted pages written for specific geographic areas or regional hubs.",
    whyFavor:
      "Directly ranks for geo-targeted and '[service] near me' searches. Without dedicated location pages, Google defaults to local competitors with regional URLs.",
    recommendedElements: [
      "Localized Service Scope",
      "Regional Case Studies / Testimonials",
      "Local Business Schema & NAP",
      "Driving / Coverage Area Notes",
    ],
    schemaType: "LocalBusiness",
  },
  CASE_STUDY: {
    label: "Case Studies & Proof",
    singular: "Case Study",
    icon: Target,
    color: "bg-indigo-50 text-indigo-700 border-indigo-200",
    description: "Real customer outcomes, before-and-after results, and verified ROI data.",
    whyFavor:
      "Converts high-consideration buyers by validating claims. AI assistants routinely cite documented case results as trusted evidence.",
    recommendedElements: [
      "Client Challenge & Baseline Problem",
      "Measurable Quantified Results (ROI/Timeline)",
      "Customer Testimonial Quote",
      "Clear Call to Action for Similar Projects",
    ],
    schemaType: "Article",
  },
};

/** Helper to clean URL slugs into clean title words */
function extractTopicName(url: string, title: string | null | undefined): string {
  if (title?.trim()) {
    // Strip common site suffix if present
    const cleaned = title.replace(/\s+[-–—|:]\s+[^-–—|:]+$/, "").trim();
    if (cleaned.length > 3) return cleaned;
  }
  try {
    const path = new URL(url).pathname.replace(/\/+$/, "");
    const slug = path.split("/").filter(Boolean).pop();
    if (!slug) return "Overview & Solutions";
    const words = decodeURIComponent(slug)
      .replace(/\.[a-z0-9]+$/i, "")
      .replace(/[-_]+/g, " ")
      .trim();
    return words ? words.charAt(0).toUpperCase() + words.slice(1) : "Product / Service Page";
  } catch {
    return "Product / Service Page";
  }
}

/** Synthesized actionable opportunity object */
export interface EnrichedOpportunity {
  id: string;
  competitorId: string;
  competitorName: string;
  competitorDomain: string;
  pageType: string;
  topicTitle: string;
  competitorUrl: string;
  competitorTitle: string;
  closestOwnPage: { url: string; title: string | null; score: number } | null;
  targetAction: "CREATE_NEW" | "UPGRADE_EXISTING";
  targetUrl: string;
  recommendedH1: string;
  whyGoogleAndAiFavor: string;
  detectedElements: string[];
  schemaType: string;
  impact: "HIGH" | "MEDIUM" | "QUICK_WIN";
  actionChecklist: string[];
}

export function CompetitorOpportunitiesPanel({
  projectId,
  competitors,
}: CompetitorOpportunitiesPanelProps) {
  const queryClient = useQueryClient();
  const [selectedCompetitorId, setSelectedCompetitorId] = useState<string>("ALL");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [selectedImpact, setSelectedImpact] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [showMacroComparison, setShowMacroComparison] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // 1. Fetch site comparison data (macro counts across Service, Blog, Location, FAQ, Schema, etc.)
  const websiteCmpQuery = useQuery({
    queryKey: ["website-comparison", projectId],
    queryFn: () => api.actionEngineWebsiteComparison(projectId),
    enabled: Boolean(projectId),
  });

  // 2. Fetch page-level opportunities for tracked competitors in parallel
  const oppQueries = useQueries({
    queries: competitors.map((comp) => ({
      queryKey: ["competitor-opportunities", projectId, comp.id],
      queryFn: () => api.competitorOpportunities(projectId, comp.id),
      enabled: Boolean(projectId && comp.id),
      staleTime: 60000,
    })),
  });

  // Synthesize crawled competitor opportunities into deep, actionable blueprint cards
  const allOpportunities = useMemo<EnrichedOpportunity[]>(() => {
    const list: EnrichedOpportunity[] = [];

    // Loop through each competitor query results
    competitors.forEach((comp, idx) => {
      const q = oppQueries[idx];
      const data = q?.data;
      if (!data || !data.opportunities || data.opportunities.length === 0) return;

      data.opportunities.forEach((item: CoverageOpportunity, itemIdx: number) => {
        const pageType = (item.pageType || "SERVICE").toUpperCase();
        const kindMeta = PAGE_KIND[pageType] || PAGE_KIND.SERVICE;
        const topic = extractTopicName(item.url, item.title);

        const hasClosePage = item.closestOwnPage && item.closestOwnPage.score >= 0.35;
        const targetAction = hasClosePage ? "UPGRADE_EXISTING" : "CREATE_NEW";
        const targetUrl = hasClosePage
          ? item.closestOwnPage!.url
          : `/${pageType.toLowerCase()}s/${topic.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;

        const recommendedH1 =
          pageType === "PRODUCT"
            ? `${topic} — Technical Specifications, Sourcing & Grade Guide`
            : pageType === "SERVICE"
            ? `Enterprise ${topic} Solutions & Implementation Services`
            : pageType === "FAQ"
            ? `${topic}: Expert Answers, Ordering Guide & Technical FAQ`
            : pageType === "LOCATION"
            ? `${topic} Commercial Services & Regional Support`
            : `${topic} — In-Depth Industry Guide & Best Practices`;

        // Determine Impact based on page kind and coverage state
        const impact: "HIGH" | "MEDIUM" | "QUICK_WIN" =
          !hasClosePage && (pageType === "SERVICE" || pageType === "PRODUCT")
            ? "HIGH"
            : hasClosePage && pageType === "FAQ"
            ? "QUICK_WIN"
            : "MEDIUM";

        // Generate customized execution checklist based on the opportunity
        const actionChecklist = [
          `Target H1: "${recommendedH1}" matching commercial search intent.`,
          hasClosePage
            ? `Expand existing page (${item.closestOwnPage?.url}) with missing dedicated sections instead of generic mentions.`
            : `Publish as a dedicated standalone page at ${targetUrl} to capture targeted organic search queries.`,
          `Integrate high-value content blocks: ${kindMeta.recommendedElements.slice(0, 3).join(", ")}.`,
          `Implement ${kindMeta.schemaType} JSON-LD structured data to win rich snippets in Google and direct citations in AI search engines.`,
        ];

        list.push({
          id: `${comp.id}-${itemIdx}-${item.url}`,
          competitorId: comp.id,
          competitorName: comp.label || comp.name || comp.domain,
          competitorDomain: comp.domain,
          pageType,
          topicTitle: topic,
          competitorUrl: item.url,
          competitorTitle: item.title || topic,
          closestOwnPage: item.closestOwnPage,
          targetAction,
          targetUrl,
          recommendedH1,
          whyGoogleAndAiFavor: kindMeta.whyFavor,
          detectedElements: kindMeta.recommendedElements,
          schemaType: kindMeta.schemaType,
          impact,
          actionChecklist,
        });
      });
    });

    // Sort by HIGH impact first, then MEDIUM, then QUICK_WIN
    return list.sort((a, b) => {
      const order = { HIGH: 0, MEDIUM: 1, QUICK_WIN: 2 };
      return order[a.impact] - order[b.impact];
    });
  }, [competitors, oppQueries]);

  // Filtered opportunities according to UI controls
  const filteredOpportunities = useMemo(() => {
    return allOpportunities.filter((opp) => {
      if (selectedCompetitorId !== "ALL" && opp.competitorId !== selectedCompetitorId) {
        return false;
      }
      if (selectedCategory !== "ALL" && opp.pageType !== selectedCategory) {
        return false;
      }
      if (selectedImpact !== "ALL" && opp.impact !== selectedImpact) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTopic = opp.topicTitle.toLowerCase().includes(q);
        const matchesCompetitor = opp.competitorName.toLowerCase().includes(q);
        const matchesUrl = opp.competitorUrl.toLowerCase().includes(q);
        const matchesTarget = opp.targetUrl.toLowerCase().includes(q);
        if (!matchesTopic && !matchesCompetitor && !matchesUrl && !matchesTarget) {
          return false;
        }
      }
      return true;
    });
  }, [allOpportunities, selectedCompetitorId, selectedCategory, selectedImpact, searchQuery]);

  // Copy implementation plan to clipboard
  const handleCopyPlan = (opp: EnrichedOpportunity) => {
    const text = `### Content Opportunity: ${opp.topicTitle}
Competitor Reference: ${opp.competitorName} (${opp.competitorUrl})
Detected Competitor Elements: ${opp.detectedElements.join(", ")}
Target Action: ${opp.targetAction === "CREATE_NEW" ? "Create New Page" : "Upgrade Existing Page"}
Target URL: ${opp.targetUrl}
Recommended H1: ${opp.recommendedH1}
Structured Data: ${opp.schemaType} Schema (JSON-LD)

Step-by-Step Implementation Blueprint:
${opp.actionChecklist.map((step, idx) => `${idx + 1}. ${step}`).join("\n")}
`;
    navigator.clipboard.writeText(text);
    setCopiedId(opp.id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  // Executive summary counts
  const totalGapsCount = allOpportunities.length;
  const missingPagesCount = allOpportunities.filter((o) => o.targetAction === "CREATE_NEW").length;
  const upgradePagesCount = allOpportunities.filter((o) => o.targetAction === "UPGRADE_EXISTING").length;
  const highImpactCount = allOpportunities.filter((o) => o.impact === "HIGH").length;

  const isAnyLoading = websiteCmpQuery.isLoading || oppQueries.some((q) => q.isLoading);

  if (competitors.length === 0) {
    return (
      <NoDataState
        title="No Competitors Tracked"
        missing="Add at least one competitor in the 'Find Competitors' tab to begin analyzing content opportunities."
        whyItMatters="Opportunities are calculated by scanning crawled competitor pages and contrasting them against your website."
        actionRequired="Add a competitor website to start automated content gap intelligence."
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Tier 1: Executive KPI Strip ─────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <div className="rounded-xl border border-brand-200 bg-white p-4 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-brand-500">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Identified Gaps</span>
            <Target size={14} className="text-brand-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-brand-950 font-mono">{totalGapsCount}</span>
            <span className="text-[11px] font-medium text-brand-500">actionable pages</span>
          </div>
          <p className="text-[11px] text-brand-400">Pages discovered across tracked rivals</p>
        </div>

        <div className="rounded-xl border border-rose-200 bg-rose-50/30 p-4 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-rose-600">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Missing Dedicated Pages</span>
            <AlertTriangle size={14} />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-rose-900 font-mono">{missingPagesCount}</span>
            <span className="text-[11px] font-medium text-rose-700">zero coverage</span>
          </div>
          <p className="text-[11px] text-rose-600">Topics rivals rank for with no page on your site</p>
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50/30 p-4 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-amber-600">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Content Depth Deficits</span>
            <Layers size={14} />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-amber-900 font-mono">{upgradePagesCount}</span>
            <span className="text-[11px] font-medium text-amber-700">upgrade targets</span>
          </div>
          <p className="text-[11px] text-amber-600">Existing pages needing specs & depth upgrades</p>
        </div>

        <div className="rounded-xl border border-indigo-200 bg-indigo-50/30 p-4 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-indigo-600">
            <span className="text-[11px] font-semibold uppercase tracking-wider">High-Impact Priorities</span>
            <Zap size={14} />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-indigo-900 font-mono">{highImpactCount}</span>
            <span className="text-[11px] font-medium text-indigo-700">top wins</span>
          </div>
          <p className="text-[11px] text-indigo-600">Commercial & product pages driving immediate ROI</p>
        </div>
      </div>

      {/* ── Tier 2: Filter & Control Toolbar ────────────────────────────── */}
      <div className="rounded-xl border border-brand-200 bg-white p-4 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          {/* Competitor Selector */}
          <div className="flex items-center gap-2 w-full md:w-auto">
            <span className="text-[11.5px] font-bold text-brand-700 shrink-0">Competitor:</span>
            <select
              value={selectedCompetitorId}
              onChange={(e) => setSelectedCompetitorId(e.target.value)}
              aria-label="Filter by competitor"
              className="rounded-lg border border-brand-200 bg-brand-50/50 px-3 py-1.5 text-[12px] font-semibold text-brand-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            >
              <option value="ALL">All Tracked Competitors ({competitors.length})</option>
              {competitors.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label || c.name || c.domain}
                </option>
              ))}
            </select>
          </div>

          {/* Search Box */}
          <div className="relative w-full md:w-72">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-400" />
            <input
              type="text"
              placeholder="Search topic, keyword, or URL..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-brand-200 bg-brand-50/30 pl-8 pr-3 py-1.5 text-[12px] text-brand-900 placeholder:text-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
          </div>

          {/* Macro Toggle */}
          <button
            type="button"
            onClick={() => setShowMacroComparison(!showMacroComparison)}
            className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-brand-700 hover:text-brand-950 px-3 py-1.5 rounded-lg border border-brand-200 hover:bg-brand-50 transition shrink-0"
          >
            <SlidersHorizontal size={12} />
            {showMacroComparison ? "Hide Macro Stats" : "Show Macro Site Counts"}
            <ChevronDown size={11} className={`transition-transform ${showMacroComparison ? "rotate-180" : ""}`} />
          </button>
        </div>

        {/* Category & Impact Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-brand-100">
          <span className="text-[11px] font-bold text-brand-500 uppercase tracking-wider shrink-0 mr-1">
            Category:
          </span>
          <button
            type="button"
            onClick={() => setSelectedCategory("ALL")}
            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
              selectedCategory === "ALL"
                ? "bg-brand-950 text-white shadow-2xs"
                : "bg-brand-100/70 text-brand-700 hover:bg-brand-200"
            }`}
          >
            All Categories ({allOpportunities.length})
          </button>
          {Object.entries(PAGE_KIND).map(([key, meta]) => {
            const count = allOpportunities.filter((o) => o.pageType === key).length;
            if (count === 0 && selectedCategory !== key) return null;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelectedCategory(key)}
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition flex items-center gap-1 ${
                  selectedCategory === key
                    ? "bg-brand-950 text-white shadow-2xs"
                    : "bg-brand-100/70 text-brand-700 hover:bg-brand-200"
                }`}
              >
                <span>{meta.label}</span>
                <span className="text-[9.5px] opacity-75 font-mono">({count})</span>
              </button>
            );
          })}

          <div className="ml-auto flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-brand-500 uppercase tracking-wider shrink-0 mr-1">
              Impact:
            </span>
            {(["ALL", "HIGH", "MEDIUM", "QUICK_WIN"] as const).map((imp) => (
              <button
                key={imp}
                type="button"
                onClick={() => setSelectedImpact(imp)}
                className={`rounded-md px-2 py-0.5 text-[10.5px] font-semibold transition ${
                  selectedImpact === imp
                    ? "bg-brand-900 text-white"
                    : "text-brand-600 hover:text-brand-950 hover:bg-brand-100"
                }`}
              >
                {imp === "ALL" ? "All" : imp === "HIGH" ? "⚡ High Impact" : imp === "MEDIUM" ? "Medium" : "Quick Win"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Optional Macro Site Comparison Drawer ───────────────────────── */}
      {showMacroComparison && (
        <div className="rounded-xl border border-brand-200 bg-white p-5 shadow-xs animate-in fade-in duration-200">
          <div className="mb-4">
            <h4 className="text-[13px] font-bold text-brand-950">Macro Website Architecture Benchmark</h4>
            <p className="text-[11.5px] text-brand-500">
              Total indexable counts counted directly from crawled pages for your site vs. tracked rivals.
            </p>
          </div>
          <WebsiteComparisonPanel projectId={projectId} />
        </div>
      )}

      {/* ── Tier 3: Deep Explanation Opportunity Cards ─────────────────── */}
      {isAnyLoading && allOpportunities.length === 0 ? (
        <LoadingState title="Analyzing crawled competitor pages & mapping content opportunities..." />
      ) : filteredOpportunities.length === 0 ? (
        <div className="rounded-xl border border-brand-200 bg-white p-8 text-center space-y-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 mx-auto">
            <CheckCircle2 size={24} />
          </div>
          <h4 className="text-[14px] font-bold text-brand-950">No Uncovered Opportunities Found for this Filter</h4>
          <p className="text-[12px] text-brand-500 max-w-md mx-auto">
            {allOpportunities.length === 0
              ? "Competitor crawls have not finished yet or both websites need to be crawled. Click 'Refresh Public Signals' in Comparison Benchmarks to run fresh crawls."
              : "Try switching to 'All Categories' or 'All Competitors' to view available content opportunities."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-[12px] text-brand-600 px-1 font-medium">
            <span>
              Showing <strong>{filteredOpportunities.length}</strong> prioritized content & page opportunities
            </span>
            <span className="text-[11px] text-brand-400">
              Derived from verified URL & title word overlaps on crawled domains
            </span>
          </div>

          <div className="space-y-4">
            {filteredOpportunities.map((opp) => {
              const kindMeta = PAGE_KIND[opp.pageType] || PAGE_KIND.SERVICE;
              const KindIcon = kindMeta.icon;

              return (
                <div
                  key={opp.id}
                  className="rounded-xl border border-brand-200 bg-white shadow-xs overflow-hidden transition hover:border-brand-300"
                >
                  {/* Card Header Bar */}
                  <div className="bg-brand-50/50 border-b border-brand-100 px-4 py-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold border ${kindMeta.color}`}>
                        <KindIcon size={12} />
                        {kindMeta.singular}
                      </span>
                      <h3 className="font-bold text-[14px] text-brand-950">
                        {opp.topicTitle}
                      </h3>
                    </div>

                    <div className="flex items-center gap-2">
                      {opp.impact === "HIGH" && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 border border-rose-200 px-2.5 py-0.5 text-[10.5px] font-bold text-rose-700">
                          <Zap size={11} /> High Impact
                        </span>
                      )}
                      {opp.impact === "QUICK_WIN" && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[10.5px] font-bold text-emerald-700">
                          <CheckCircle2 size={11} /> Quick Win
                        </span>
                      )}
                      {opp.impact === "MEDIUM" && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 text-[10.5px] font-bold text-indigo-700">
                          <TrendingUp size={11} /> Moderate Value
                        </span>
                      )}
                      <span className="text-[11px] font-semibold text-brand-500 bg-white border border-brand-200 px-2 py-0.5 rounded-md">
                        Competitor: {opp.competitorName}
                      </span>
                    </div>
                  </div>

                  {/* Dual Column Blueprint Section */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-brand-100">
                    {/* Left Column: What Competitor Website Has */}
                    <div className="lg:col-span-5 p-4 space-y-3 bg-brand-50/20">
                      <div className="flex items-center gap-1.5 text-brand-950 font-bold text-[12px]">
                        <Globe size={14} className="text-brand-600" />
                        <span>WHAT COMPETITOR WEBSITE HAS</span>
                      </div>

                      <div className="rounded-lg border border-brand-200 bg-white p-3 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="font-semibold text-[13px] text-brand-950 leading-snug">
                              {opp.competitorTitle}
                            </div>
                            <a
                              href={opp.competitorUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="group inline-flex items-center gap-1 font-mono text-[11px] text-brand-600 hover:text-brand-950 underline underline-offset-2 break-all mt-0.5"
                            >
                              <span>{opp.competitorUrl}</span>
                              <ExternalLink size={10} className="shrink-0 group-hover:translate-x-0.5 transition" />
                            </a>
                          </div>
                        </div>

                        {/* Detected Elements */}
                        <div className="pt-2 border-t border-brand-100 space-y-1.5">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-brand-400">
                            Detected High-Value Elements:
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {opp.detectedElements.map((el) => (
                              <span
                                key={el}
                                className="inline-flex items-center gap-1 rounded bg-brand-100/70 text-brand-700 px-2 py-0.5 text-[10.5px] font-medium"
                              >
                                <Check size={10} className="text-emerald-600" />
                                {el}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Why Google & AI Favor Box */}
                      <div className="rounded-lg bg-indigo-50/60 border border-indigo-100 p-3 space-y-1">
                        <div className="flex items-center gap-1 text-[11px] font-bold text-indigo-900">
                          <Sparkles size={11} className="text-indigo-600" />
                          <span>Why Google & AI Models Favor Their Page</span>
                        </div>
                        <p className="text-[11.5px] text-indigo-950 leading-relaxed">
                          {opp.whyGoogleAndAiFavor}
                        </p>
                      </div>
                    </div>

                    {/* Right Column: What We Must Do On Our Website */}
                    <div className="lg:col-span-7 p-4 space-y-3 bg-white">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 text-brand-950 font-bold text-[12px]">
                          <Target size={14} className="text-emerald-600" />
                          <span>WHAT WE MUST DO ON OUR WEBSITE</span>
                        </div>
                        {opp.targetAction === "CREATE_NEW" ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 border border-rose-200 px-2 py-0.5 text-[10.5px] font-bold text-rose-700">
                            Create New Page
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10.5px] font-bold text-amber-700">
                            Upgrade Existing Page
                          </span>
                        )}
                      </div>

                      {/* Target Path Indicator */}
                      <div className="rounded-lg border border-brand-200 bg-brand-50/40 p-2.5 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 overflow-hidden">
                          <span className="text-[11px] font-bold text-brand-500 uppercase tracking-wider shrink-0">
                            Target Path:
                          </span>
                          <span className="font-mono text-[11.5px] font-bold text-brand-900 truncate">
                            {opp.targetUrl}
                          </span>
                        </div>
                        {opp.closestOwnPage && (
                          <span className="text-[10.5px] text-brand-500 shrink-0">
                            Similarity Match: {(opp.closestOwnPage.score * 100).toFixed(0)}%
                          </span>
                        )}
                      </div>

                      {/* Step-by-Step Blueprint */}
                      <div className="space-y-1.5">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-brand-400">
                          Execution Blueprint & Content Requirements:
                        </div>
                        <ul className="space-y-1.5">
                          {opp.actionChecklist.map((step, sIdx) => (
                            <li key={sIdx} className="flex items-start gap-2 text-[12px] text-brand-800 leading-snug">
                              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[10px] font-bold text-brand-700 mt-0.5">
                                {sIdx + 1}
                              </span>
                              <span>{step}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Action Triggers Footer */}
                      <div className="pt-2 border-t border-brand-100 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleCopyPlan(opp)}
                            className="inline-flex items-center gap-1 rounded-lg border border-brand-200 bg-white px-2.5 py-1.5 text-[11.5px] font-semibold text-brand-700 hover:bg-brand-50 hover:text-brand-950 transition shadow-2xs"
                          >
                            {copiedId === opp.id ? (
                              <>
                                <Check size={12} className="text-emerald-600" /> Plan Copied!
                              </>
                            ) : (
                              <>
                                <Copy size={12} /> Copy Action Plan
                              </>
                            )}
                          </button>
                        </div>

                        <div className="flex items-center gap-2">
                          <Link
                            href={`/content-ai?topic=${encodeURIComponent(opp.topicTitle)}&type=${opp.pageType.toLowerCase()}&targetUrl=${encodeURIComponent(opp.targetUrl)}`}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-950 px-3 py-1.5 text-[11.5px] font-bold text-white hover:bg-brand-800 transition shadow-2xs"
                          >
                            <Sparkles size={12} />
                            Draft with Content AI
                            <ArrowRight size={11} />
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
