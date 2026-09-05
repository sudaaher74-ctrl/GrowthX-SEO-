"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Globe,
  FileText,
  Search,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  Zap,
  Layers,
  ChevronDown,
  ChevronUp,
  Check,
  Compass,
  HelpCircle,
  MapPin,
  Target,
  Sparkles,
  SlidersHorizontal,
} from "lucide-react";
import { api, CrawlPage } from "@/lib/api-client";
import { useLatestCrawl, useCrawlPages } from "@/hooks/use-growthx";
import { LoadingState } from "@/components/ui/truthful-state";

interface TrackedCompetitorSummary {
  id: string;
  domain: string;
  label?: string | null;
  name?: string | null;
  websiteId?: string | null;
  healthScore?: number | null;
}

interface SplitCrawlInspectorProps {
  projectId: string;
  customerDomain: string;
  competitor: TrackedCompetitorSummary;
  allCompetitors: TrackedCompetitorSummary[];
  onSelectCompetitor: (competitorId: string) => void;
}

export interface NormalizedCrawlPage {
  id: string;
  url: string;
  path: string;
  title: string;
  h1: string[];
  h2?: string[];
  pageType: string;
  wordCount: number;
  statusCode: number | null;
  responseTimeMs?: number;
  metaDescription?: string | null;
}

/** Extract path safely from URL */
function getPathname(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    return parsed.pathname || "/";
  } catch {
    return rawUrl;
  }
}

/** Format page type badges */
const TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  HOME: { label: "Home", color: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  PRODUCT: { label: "Product", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  SERVICE: { label: "Service", color: "bg-blue-50 text-blue-700 border-blue-200" },
  BLOG: { label: "Blog / Guide", color: "bg-purple-50 text-purple-700 border-purple-200" },
  FAQ: { label: "FAQ", color: "bg-amber-50 text-amber-700 border-amber-200" },
  LOCATION: { label: "Location", color: "bg-rose-50 text-rose-700 border-rose-200" },
  CASE_STUDY: { label: "Case Study", color: "bg-cyan-50 text-cyan-700 border-cyan-200" },
  ABOUT: { label: "About", color: "bg-brand-100 text-brand-700 border-brand-200" },
  CONTACT: { label: "Contact", color: "bg-brand-100 text-brand-700 border-brand-200" },
  OTHER: { label: "Page", color: "bg-brand-50 text-brand-600 border-brand-200" },
};

export function SplitCrawlInspector({
  projectId,
  customerDomain,
  competitor,
  allCompetitors,
  onSelectCompetitor,
}: SplitCrawlInspectorProps) {
  const queryClient = useQueryClient();

  // Search and filter states
  const [ourSearch, setOurSearch] = useState("");
  const [ourTypeFilter, setOurTypeFilter] = useState("ALL");
  const [theirSearch, setTheirSearch] = useState("");
  const [theirTypeFilter, setTheirTypeFilter] = useState("ALL");

  // Selected pair for page-to-page diff
  const [selectedOurUrl, setSelectedOurUrl] = useState<string | null>(null);
  const [selectedTheirUrl, setSelectedTheirUrl] = useState<string | null>(null);
  const [isDiffExpanded, setIsDiffExpanded] = useState<boolean>(false);

  // 1. Fetch our latest crawl job & crawled pages
  const ourCrawl = useLatestCrawl(customerDomain || null);
  const ourPagesQuery = useCrawlPages(ourCrawl.data?.id ?? null, ourCrawl.data?.status);

  // 2. Fetch competitor crawled pages
  const competitorPagesQuery = useQuery({
    queryKey: ["competitor-pages", projectId, competitor.id],
    queryFn: () => api.listCompetitorPages(projectId, competitor.id),
    enabled: Boolean(projectId && competitor.id),
    staleTime: 30000,
  });

  // 3. Trigger Crawl Mutation for Competitor
  const crawlCompetitorMutation = useMutation({
    mutationFn: () => api.crawlCompetitorSite(projectId, competitor.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["competitor-pages", projectId, competitor.id] });
      queryClient.invalidateQueries({ queryKey: ["tracked-competitors", projectId] });
      queryClient.invalidateQueries({ queryKey: ["website-comparison", projectId] });
    },
  });

  // 4. Trigger Crawl Mutation for Customer Site
  const crawlOurSiteMutation = useMutation({
    mutationFn: () => api.startCrawl({ domain: customerDomain }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["latest-crawl", customerDomain] });
      queryClient.invalidateQueries({ queryKey: ["crawl-pages"] });
    },
  });

  // Normalize Our Pages
  const normalizedOurPages: NormalizedCrawlPage[] = useMemo(() => {
    const raw = ourPagesQuery.data?.data || [];
    return raw.map((p, idx) => ({
      id: p.id || `our-${idx}`,
      url: p.url,
      path: getPathname(p.url),
      title: p.title || getPathname(p.url).replace(/\//g, " ").trim() || "Home Page",
      h1: Array.isArray(p.h1) ? p.h1 : p.h1 ? [p.h1] : [],
      h2: Array.isArray(p.h2) ? p.h2 : p.h2 ? [p.h2] : [],
      pageType: (p.pageType || "OTHER").toUpperCase(),
      wordCount: typeof p.wordCount === "number" ? p.wordCount : 0,
      statusCode: typeof p.statusCode === "number" ? p.statusCode : null,
      responseTimeMs: p.responseTimeMs || p.performance?.lcpMs || undefined,
      metaDescription: p.metaDescription || null,
    }));
  }, [ourPagesQuery.data]);

  // Normalize Competitor Pages
  const normalizedTheirPages: NormalizedCrawlPage[] = useMemo(() => {
    const raw = competitorPagesQuery.data || [];
    return raw.map((p, idx) => ({
      id: `their-${idx}`,
      url: p.url,
      path: getPathname(p.url),
      title: p.title || getPathname(p.url).replace(/\//g, " ").trim() || "Competitor Page",
      h1: Array.isArray(p.h1) ? p.h1 : p.h1 ? [p.h1] : [],
      h2: Array.isArray(p.h2) ? p.h2 : p.h2 ? [p.h2] : [],
      pageType: (p.pageType || "OTHER").toUpperCase(),
      wordCount: typeof p.wordCount === "number" ? p.wordCount : 0,
      statusCode: typeof p.statusCode === "number" ? p.statusCode : null,
      responseTimeMs: p.responseTimeMs || undefined,
      metaDescription: p.metaDescription || null,
    }));
  }, [competitorPagesQuery.data]);

  // Filtered Our Pages
  const filteredOurPages = useMemo(() => {
    return normalizedOurPages.filter((p) => {
      if (ourTypeFilter !== "ALL" && p.pageType !== ourTypeFilter) return false;
      if (ourSearch.trim()) {
        const q = ourSearch.toLowerCase();
        return p.path.toLowerCase().includes(q) || p.title.toLowerCase().includes(q);
      }
      return true;
    });
  }, [normalizedOurPages, ourTypeFilter, ourSearch]);

  // Filtered Competitor Pages
  const filteredTheirPages = useMemo(() => {
    return normalizedTheirPages.filter((p) => {
      if (theirTypeFilter !== "ALL" && p.pageType !== theirTypeFilter) return false;
      if (theirSearch.trim()) {
        const q = theirSearch.toLowerCase();
        return p.path.toLowerCase().includes(q) || p.title.toLowerCase().includes(q);
      }
      return true;
    });
  }, [normalizedTheirPages, theirTypeFilter, theirSearch]);

  // Macro Summary Statistics
  const ourAvgWordCount = useMemo(() => {
    if (normalizedOurPages.length === 0) return 0;
    const sum = normalizedOurPages.reduce((acc, p) => acc + p.wordCount, 0);
    return Math.round(sum / normalizedOurPages.length);
  }, [normalizedOurPages]);

  const theirAvgWordCount = useMemo(() => {
    if (normalizedTheirPages.length === 0) return 0;
    const sum = normalizedTheirPages.reduce((acc, p) => acc + p.wordCount, 0);
    return Math.round(sum / normalizedTheirPages.length);
  }, [normalizedTheirPages]);

  // Active Pair for Side-by-Side Diff
  const activeOurPage = useMemo(() => {
    if (selectedOurUrl) {
      return normalizedOurPages.find((p) => p.url === selectedOurUrl) || null;
    }
    return normalizedOurPages[0] || null;
  }, [normalizedOurPages, selectedOurUrl]);

  const activeTheirPage = useMemo(() => {
    if (selectedTheirUrl) {
      return normalizedTheirPages.find((p) => p.url === selectedTheirUrl) || null;
    }
    // Auto-match closest page by path or page type
    if (activeOurPage) {
      const matchByPath = normalizedTheirPages.find((p) => p.path === activeOurPage.path);
      if (matchByPath) return matchByPath;
      const matchByType = normalizedTheirPages.find((p) => p.pageType === activeOurPage.pageType);
      if (matchByType) return matchByType;
    }
    return normalizedTheirPages[0] || null;
  }, [normalizedTheirPages, selectedTheirUrl, activeOurPage]);

  // Handle page pairing
  const handleSelectOurPage = (page: NormalizedCrawlPage) => {
    setSelectedOurUrl(page.url);
    setIsDiffExpanded(true);
    // Auto find closest on competitor side
    const match =
      normalizedTheirPages.find((p) => p.path === page.path) ||
      normalizedTheirPages.find((p) => p.pageType === page.pageType) ||
      null;
    if (match) setSelectedTheirUrl(match.url);
  };

  const handleSelectTheirPage = (page: NormalizedCrawlPage) => {
    setSelectedTheirUrl(page.url);
    setIsDiffExpanded(true);
    // Auto find closest on our side
    const match =
      normalizedOurPages.find((p) => p.path === page.path) ||
      normalizedOurPages.find((p) => p.pageType === page.pageType) ||
      null;
    if (match) setSelectedOurUrl(match.url);
  };

  const competitorDisplayName = competitor.label || competitor.name || competitor.domain;

  return (
    <div className="space-y-6 pt-4 border-t border-brand-200">
      {/* ── Section Title & Headline ────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-brand-950 text-white font-black text-[11px]">
              2X
            </span>
            <h3 className="font-bold text-[16px] text-brand-950">
              Dual-Side Crawl Inspector: Page-to-Page Direct Comparison
            </h3>
          </div>
          <p className="text-[12px] text-brand-500 mt-0.5">
            Compare all crawled pages on your website side-by-side with{" "}
            <strong className="text-brand-800">{competitorDisplayName}</strong> to inspect technical signals, word counts, and content depth.
          </p>
        </div>

        {/* Competitor Switcher Dropdown */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[11.5px] font-bold text-brand-700">Comparing Against:</span>
          <select
            value={competitor.id}
            onChange={(e) => onSelectCompetitor(e.target.value)}
            aria-label="Select competitor to compare crawl pages"
            className="rounded-lg border border-brand-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-brand-900 shadow-2xs focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          >
            {allCompetitors.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label || c.name || c.domain}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Macro Comparison Header Bar ─────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 rounded-xl border border-brand-200 bg-brand-50/40">
        <div>
          <span className="text-[10.5px] font-bold uppercase tracking-wider text-brand-500">
            Crawled Pages
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-lg font-black text-brand-950 font-mono">
              {normalizedOurPages.length}
            </span>
            <span className="text-[11px] text-brand-400 font-mono">vs</span>
            <span className="text-lg font-black text-brand-700 font-mono">
              {normalizedTheirPages.length}
            </span>
          </div>
          <p className="text-[10.5px] text-brand-500">
            {normalizedTheirPages.length > normalizedOurPages.length
              ? `Rival has +${normalizedTheirPages.length - normalizedOurPages.length} more pages`
              : normalizedOurPages.length > normalizedTheirPages.length
              ? `You have +${normalizedOurPages.length - normalizedTheirPages.length} more pages`
              : "Identical page count"}
          </p>
        </div>

        <div>
          <span className="text-[10.5px] font-bold uppercase tracking-wider text-brand-500">
            Avg Word Count
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-lg font-black text-brand-950 font-mono">
              {ourAvgWordCount}
            </span>
            <span className="text-[11px] text-brand-400 font-mono">vs</span>
            <span className="text-lg font-black text-brand-700 font-mono">
              {theirAvgWordCount}
            </span>
          </div>
          <p className="text-[10.5px] text-brand-500">
            {theirAvgWordCount > ourAvgWordCount ? (
              <span className="text-amber-700 font-semibold">
                Rival leads by +{theirAvgWordCount - ourAvgWordCount} words/page
              </span>
            ) : ourAvgWordCount > theirAvgWordCount ? (
              <span className="text-emerald-700 font-semibold">
                Your content is deeper (+{ourAvgWordCount - theirAvgWordCount} words)
              </span>
            ) : (
              "Equal depth"
            )}
          </p>
        </div>

        <div>
          <span className="text-[10.5px] font-bold uppercase tracking-wider text-brand-500">
            Status Codes
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-sm font-bold text-emerald-700">
              {normalizedOurPages.filter((p) => p.statusCode === 200).length} OK
            </span>
            <span className="text-[11px] text-brand-400 font-mono">vs</span>
            <span className="text-sm font-bold text-emerald-700">
              {normalizedTheirPages.filter((p) => p.statusCode === 200).length} OK
            </span>
          </div>
          <p className="text-[10.5px] text-brand-400">200 Indexable pages</p>
        </div>

        <div className="flex flex-col justify-center items-end gap-1.5">
          <button
            type="button"
            onClick={() => crawlCompetitorMutation.mutate()}
            disabled={crawlCompetitorMutation.isPending}
            className="inline-flex items-center gap-1.5 rounded-lg border border-brand-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-brand-700 hover:bg-brand-50 hover:text-brand-950 transition shadow-2xs"
          >
            <RefreshCw size={11} className={crawlCompetitorMutation.isPending ? "animate-spin" : ""} />
            {crawlCompetitorMutation.isPending ? "Crawling Rival..." : "Re-crawl Competitor"}
          </button>

          <button
            type="button"
            onClick={() => crawlOurSiteMutation.mutate()}
            disabled={crawlOurSiteMutation.isPending}
            className="inline-flex items-center gap-1.5 text-[10.5px] font-medium text-brand-600 hover:text-brand-950 underline underline-offset-2 transition"
          >
            <RefreshCw size={10} className={crawlOurSiteMutation.isPending ? "animate-spin" : ""} />
            {crawlOurSiteMutation.isPending ? "Auditing Your Site..." : "Re-audit Your Site"}
          </button>
        </div>
      </div>

      {/* ── Active Page-to-Page Direct Diff Card ────────────────────────── */}
      {activeOurPage && activeTheirPage && (
        <div className="rounded-xl border border-brand-300 bg-white shadow-xs overflow-hidden transition-all duration-200">
          {/* Clickable Header Bar */}
          <div
            onClick={() => setIsDiffExpanded((prev) => !prev)}
            className="bg-brand-950 px-4 py-2.5 flex items-center justify-between text-white cursor-pointer hover:bg-brand-900 transition-colors select-none"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setIsDiffExpanded((prev) => !prev);
              }
            }}
            aria-expanded={isDiffExpanded}
          >
            <div className="flex items-center gap-2 text-[12px] font-bold">
              <Sparkles size={13} className="text-amber-400" />
              <span>PAGE-TO-PAGE DIRECT MATCH DIFF</span>
              <span className="hidden sm:inline-block rounded-full bg-brand-800/90 px-2 py-0.5 text-[10px] font-semibold text-brand-200 border border-brand-700">
                {isDiffExpanded ? "Expanded Comparison View" : "Click to expand details"}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[11px] text-brand-300 hidden md:inline">
                Click any page below to switch comparison pair
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsDiffExpanded((prev) => !prev);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-brand-800 hover:bg-brand-700 px-2.5 py-1 text-[11px] font-semibold text-white transition shadow-2xs border border-brand-700"
              >
                <span>{isDiffExpanded ? "Collapse Details" : "Expand Content Comparison"}</span>
                {isDiffExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>
            </div>
          </div>

          {/* Quick Summary Row */}
          <div className="grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-brand-100 p-4 gap-y-4 md:gap-y-0 bg-white">
            {/* Left: Your Page */}
            <div className="md:col-span-5 space-y-2 md:pr-4">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-brand-950">
                  <span className="h-2 w-2 rounded-full bg-brand-950" />
                  Your Page ({customerDomain})
                </span>
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${TYPE_CONFIG[activeOurPage.pageType]?.color || TYPE_CONFIG.OTHER.color}`}>
                  {TYPE_CONFIG[activeOurPage.pageType]?.label || activeOurPage.pageType}
                </span>
              </div>

              <div>
                <a
                  href={activeOurPage.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-[12px] font-bold text-brand-900 hover:underline flex items-center gap-1 break-all"
                >
                  <span>{activeOurPage.path}</span>
                  <ExternalLink size={10} className="shrink-0 text-brand-400" />
                </a>
                <div className="text-[11.5px] text-brand-600 font-medium mt-0.5 line-clamp-1">
                  {activeOurPage.title}
                </div>
              </div>

              <div className="flex items-center gap-3 pt-1 text-[11px] text-brand-600 font-mono">
                <span>Words: <strong>{activeOurPage.wordCount}</strong></span>
                {activeOurPage.responseTimeMs && (
                  <span>Speed: <strong>{activeOurPage.responseTimeMs}ms</strong></span>
                )}
                {activeOurPage.statusCode != null && (
                  <span className="text-emerald-700 font-bold">{activeOurPage.statusCode} OK</span>
                )}
              </div>
            </div>

            {/* Center: Metric Delta */}
            <div className="md:col-span-2 flex flex-col items-center justify-center text-center px-2 py-1 space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-brand-400">
                Word Diff
              </span>
              {activeTheirPage.wordCount > activeOurPage.wordCount ? (
                <div className="rounded-md bg-amber-50 border border-amber-200 px-2.5 py-1 text-center">
                  <span className="font-mono font-black text-[13px] text-amber-700">
                    +{activeTheirPage.wordCount - activeOurPage.wordCount}
                  </span>
                  <p className="text-[9.5px] text-amber-800 font-semibold leading-tight">
                    Rival Ahead
                  </p>
                </div>
              ) : activeOurPage.wordCount > activeTheirPage.wordCount ? (
                <div className="rounded-md bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-center">
                  <span className="font-mono font-black text-[13px] text-emerald-700">
                    +{activeOurPage.wordCount - activeTheirPage.wordCount}
                  </span>
                  <p className="text-[9.5px] text-emerald-800 font-semibold leading-tight">
                    You Lead
                  </p>
                </div>
              ) : (
                <span className="text-[11px] font-bold text-brand-600">Tie</span>
              )}
            </div>

            {/* Right: Competitor Page */}
            <div className="md:col-span-5 space-y-2 md:pl-4">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-brand-700">
                  <span className="h-2 w-2 rounded-full bg-brand-400" />
                  Competitor ({competitorDisplayName})
                </span>
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${TYPE_CONFIG[activeTheirPage.pageType]?.color || TYPE_CONFIG.OTHER.color}`}>
                  {TYPE_CONFIG[activeTheirPage.pageType]?.label || activeTheirPage.pageType}
                </span>
              </div>

              <div>
                <a
                  href={activeTheirPage.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-[12px] font-bold text-brand-700 hover:text-brand-950 hover:underline flex items-center gap-1 break-all"
                >
                  <span>{activeTheirPage.path}</span>
                  <ExternalLink size={10} className="shrink-0 text-brand-400" />
                </a>
                <div className="text-[11.5px] text-brand-600 font-medium mt-0.5 line-clamp-1">
                  {activeTheirPage.title}
                </div>
              </div>

              <div className="flex items-center gap-3 pt-1 text-[11px] text-brand-600 font-mono">
                <span>Words: <strong>{activeTheirPage.wordCount}</strong></span>
                {activeTheirPage.responseTimeMs && (
                  <span>Speed: <strong>{activeTheirPage.responseTimeMs}ms</strong></span>
                )}
                {activeTheirPage.statusCode != null && (
                  <span className="text-emerald-700 font-bold">{activeTheirPage.statusCode} OK</span>
                )}
              </div>
            </div>
          </div>

          {/* Collapsed State Banner: prompts user to click to expand */}
          {!isDiffExpanded && (
            <button
              type="button"
              onClick={() => setIsDiffExpanded(true)}
              className="w-full py-2 px-4 bg-brand-50/80 hover:bg-brand-100 border-t border-brand-200 text-brand-700 hover:text-brand-950 text-[11.5px] font-semibold flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <span>Click to expand full page content comparison (H1, Subheadings, Meta, Copy Depth & Gaps)</span>
              <ChevronDown size={13} className="text-brand-500" />
            </button>
          )}

          {/* Expanded State: Deep Content Comparison & Short Actionable Verdict */}
          {isDiffExpanded && (
            <div className="border-t border-brand-200 bg-brand-50/30 p-4 space-y-4">
              {/* Section Sub-header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded bg-brand-900 text-white font-bold text-[10px]">
                    VS
                  </span>
                  <div>
                    <h4 className="text-[13px] font-bold text-brand-950">
                      Side-by-Side Page Content Anatomy
                    </h4>
                    <p className="text-[11px] text-brand-500">
                      Inspect what content the competitor uses on their page versus what content you have on yours.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsDiffExpanded(false)}
                  className="text-[11px] font-semibold text-brand-600 hover:text-brand-950 flex items-center gap-1 transition cursor-pointer"
                >
                  <span>Collapse view</span>
                  <ChevronUp size={12} />
                </button>
              </div>

              {/* Side-by-Side Content Columns */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* ── Left Column: Your Page Content ── */}
                <div className="rounded-xl border border-brand-200 bg-white p-3.5 space-y-3 shadow-2xs">
                  <div className="flex items-center justify-between pb-2 border-b border-brand-100">
                    <div className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-brand-950" />
                      <span className="font-bold text-[12px] text-brand-950">
                        Your Page Content ({customerDomain})
                      </span>
                    </div>
                    <span className="font-mono text-[10.5px] text-brand-500">
                      {activeOurPage.path}
                    </span>
                  </div>

                  {/* Title Tag */}
                  <div>
                    <div className="flex items-center justify-between text-[10.5px] font-semibold text-brand-500 uppercase tracking-wider mb-1">
                      <span>Title Tag</span>
                      <span className="font-mono text-[10px] text-brand-400">
                        {activeOurPage.title ? `${activeOurPage.title.length} chars` : "0 chars"}
                      </span>
                    </div>
                    <div className="p-2 rounded-lg bg-brand-50/70 border border-brand-100 text-[11.5px] text-brand-900 font-medium leading-relaxed">
                      {activeOurPage.title || <span className="text-brand-400 italic">No title tag detected</span>}
                    </div>
                  </div>

                  {/* Primary Heading (H1) */}
                  <div>
                    <div className="flex items-center justify-between text-[10.5px] font-semibold text-brand-500 uppercase tracking-wider mb-1">
                      <span>Primary Heading (H1)</span>
                      <span className="font-mono text-[10px] text-brand-400">
                        {activeOurPage.h1.length} found
                      </span>
                    </div>
                    {activeOurPage.h1.length > 0 ? (
                      <div className="space-y-1">
                        {activeOurPage.h1.map((heading, idx) => (
                          <div key={idx} className="flex items-start gap-1.5 p-2 rounded-lg bg-emerald-50/50 border border-emerald-200 text-[11.5px] text-emerald-950 font-semibold">
                            <span className="px-1 py-0.2 rounded bg-emerald-200 text-emerald-800 text-[9px] font-black shrink-0 uppercase mt-0.5">
                              H1
                            </span>
                            <span className="break-words">{heading}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-2 rounded-lg bg-amber-50/60 border border-amber-200 text-[11px] text-amber-800 flex items-center gap-1.5">
                        <AlertTriangle size={12} className="shrink-0 text-amber-600" />
                        <span>No H1 heading found on this page. Search engines rely on H1 for topic clarity.</span>
                      </div>
                    )}
                  </div>

                  {/* Secondary Headings (H2) */}
                  <div>
                    <div className="flex items-center justify-between text-[10.5px] font-semibold text-brand-500 uppercase tracking-wider mb-1">
                      <span>Key Sections / Subheadings (H2)</span>
                      <span className="font-mono text-[10px] text-brand-400">
                        {activeOurPage.h2?.length ?? 0} found
                      </span>
                    </div>
                    {activeOurPage.h2 && activeOurPage.h2.length > 0 ? (
                      <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                        {activeOurPage.h2.map((sub, idx) => (
                          <div key={idx} className="flex items-start gap-1.5 p-1.5 rounded-md bg-brand-50 border border-brand-100 text-[11px] text-brand-800 font-medium">
                            <span className="px-1 py-0.2 rounded bg-brand-200 text-brand-700 text-[9px] font-bold shrink-0 uppercase mt-0.5">
                              H2
                            </span>
                            <span className="break-words">{sub}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-2 rounded-lg bg-brand-50/60 border border-brand-100 text-[11px] text-brand-500 italic">
                        No H2 subheadings detected on this page.
                      </div>
                    )}
                  </div>

                  {/* Meta Description */}
                  <div>
                    <div className="flex items-center justify-between text-[10.5px] font-semibold text-brand-500 uppercase tracking-wider mb-1">
                      <span>Meta Description (SERP Snippet)</span>
                      <span className="font-mono text-[10px] text-brand-400">
                        {activeOurPage.metaDescription ? `${activeOurPage.metaDescription.length} chars` : "Missing"}
                      </span>
                    </div>
                    {activeOurPage.metaDescription ? (
                      <div className="p-2 rounded-lg bg-brand-50/70 border border-brand-100 text-[11px] text-brand-800 leading-relaxed">
                        &ldquo;{activeOurPage.metaDescription}&rdquo;
                      </div>
                    ) : (
                      <div className="p-2 rounded-lg bg-amber-50/60 border border-amber-200 text-[11px] text-amber-800 flex items-center gap-1.5">
                        <AlertTriangle size={12} className="shrink-0 text-amber-600" />
                        <span>Missing meta description. Google will generate snippets from random body text.</span>
                      </div>
                    )}
                  </div>

                  {/* Content Depth Assessment */}
                  <div className="pt-2 border-t border-brand-100 flex items-center justify-between text-[11px]">
                    <span className="text-brand-500 font-medium">Content Depth:</span>
                    <span className={`font-semibold ${activeOurPage.wordCount < 100 ? "text-amber-700" : activeOurPage.wordCount < 400 ? "text-blue-700" : "text-emerald-700"}`}>
                      {activeOurPage.wordCount < 100
                        ? "Thin Content (<100 words)"
                        : activeOurPage.wordCount < 400
                        ? "Concise Page (100-400 words)"
                        : "Comprehensive Depth (>400 words)"}
                    </span>
                  </div>
                </div>

                {/* ── Right Column: Competitor Page Content ── */}
                <div className="rounded-xl border border-brand-200 bg-white p-3.5 space-y-3 shadow-2xs">
                  <div className="flex items-center justify-between pb-2 border-b border-brand-100">
                    <div className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-brand-400" />
                      <span className="font-bold text-[12px] text-brand-700">
                        Competitor Content ({competitorDisplayName})
                      </span>
                    </div>
                    <span className="font-mono text-[10.5px] text-brand-500">
                      {activeTheirPage.path}
                    </span>
                  </div>

                  {/* Title Tag */}
                  <div>
                    <div className="flex items-center justify-between text-[10.5px] font-semibold text-brand-500 uppercase tracking-wider mb-1">
                      <span>Title Tag</span>
                      <span className="font-mono text-[10px] text-brand-400">
                        {activeTheirPage.title ? `${activeTheirPage.title.length} chars` : "0 chars"}
                      </span>
                    </div>
                    <div className="p-2 rounded-lg bg-brand-50/70 border border-brand-100 text-[11.5px] text-brand-900 font-medium leading-relaxed">
                      {activeTheirPage.title || <span className="text-brand-400 italic">No title tag detected</span>}
                    </div>
                  </div>

                  {/* Primary Heading (H1) */}
                  <div>
                    <div className="flex items-center justify-between text-[10.5px] font-semibold text-brand-500 uppercase tracking-wider mb-1">
                      <span>Primary Heading (H1)</span>
                      <span className="font-mono text-[10px] text-brand-400">
                        {activeTheirPage.h1.length} found
                      </span>
                    </div>
                    {activeTheirPage.h1.length > 0 ? (
                      <div className="space-y-1">
                        {activeTheirPage.h1.map((heading, idx) => (
                          <div key={idx} className="flex items-start gap-1.5 p-2 rounded-lg bg-brand-100/60 border border-brand-200 text-[11.5px] text-brand-950 font-semibold">
                            <span className="px-1 py-0.2 rounded bg-brand-300 text-brand-900 text-[9px] font-black shrink-0 uppercase mt-0.5">
                              H1
                            </span>
                            <span className="break-words">{heading}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-2 rounded-lg bg-brand-50 border border-brand-100 text-[11px] text-brand-500 italic">
                        No H1 heading detected on competitor page.
                      </div>
                    )}
                  </div>

                  {/* Secondary Headings (H2) */}
                  <div>
                    <div className="flex items-center justify-between text-[10.5px] font-semibold text-brand-500 uppercase tracking-wider mb-1">
                      <span>Key Sections / Subheadings (H2)</span>
                      <span className="font-mono text-[10px] text-brand-400">
                        {activeTheirPage.h2?.length ?? 0} found
                      </span>
                    </div>
                    {activeTheirPage.h2 && activeTheirPage.h2.length > 0 ? (
                      <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                        {activeTheirPage.h2.map((sub, idx) => (
                          <div key={idx} className="flex items-start gap-1.5 p-1.5 rounded-md bg-brand-50 border border-brand-100 text-[11px] text-brand-800 font-medium">
                            <span className="px-1 py-0.2 rounded bg-brand-200 text-brand-700 text-[9px] font-bold shrink-0 uppercase mt-0.5">
                              H2
                            </span>
                            <span className="break-words">{sub}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-2 rounded-lg bg-brand-50/60 border border-brand-100 text-[11px] text-brand-500 italic">
                        No H2 subheadings detected on competitor page.
                      </div>
                    )}
                  </div>

                  {/* Meta Description */}
                  <div>
                    <div className="flex items-center justify-between text-[10.5px] font-semibold text-brand-500 uppercase tracking-wider mb-1">
                      <span>Meta Description (SERP Snippet)</span>
                      <span className="font-mono text-[10px] text-brand-400">
                        {activeTheirPage.metaDescription ? `${activeTheirPage.metaDescription.length} chars` : "Missing"}
                      </span>
                    </div>
                    {activeTheirPage.metaDescription ? (
                      <div className="p-2 rounded-lg bg-brand-50/70 border border-brand-100 text-[11px] text-brand-800 leading-relaxed">
                        &ldquo;{activeTheirPage.metaDescription}&rdquo;
                      </div>
                    ) : (
                      <div className="p-2 rounded-lg bg-brand-50 border border-brand-100 text-[11px] text-brand-500 italic">
                        No meta description tag provided by competitor.
                      </div>
                    )}
                  </div>

                  {/* Content Depth Assessment */}
                  <div className="pt-2 border-t border-brand-100 flex items-center justify-between text-[11px]">
                    <span className="text-brand-500 font-medium">Content Depth:</span>
                    <span className={`font-semibold ${activeTheirPage.wordCount < 100 ? "text-amber-700" : activeTheirPage.wordCount < 400 ? "text-blue-700" : "text-emerald-700"}`}>
                      {activeTheirPage.wordCount < 100
                        ? "Thin Content (<100 words)"
                        : activeTheirPage.wordCount < 400
                        ? "Concise Page (100-400 words)"
                        : "Comprehensive Depth (>400 words)"}
                    </span>
                  </div>
                </div>
              </div>

              {/* ── Short Comparison & Actionable Verdict ── */}
              <div className="rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50/70 via-white to-brand-50/50 p-4 space-y-3.5 shadow-xs">
                <div className="flex items-center gap-2">
                  <div className="p-1 rounded-md bg-indigo-600 text-white">
                    <Sparkles size={13} />
                  </div>
                  <div>
                    <h5 className="text-[12.5px] font-bold text-brand-950">
                      Short Content Comparison & Actionable Verdict
                    </h5>
                    <p className="text-[11px] text-brand-600">
                      Quick takeaway of how your page compares directly against {competitorDisplayName} on this URL.
                    </p>
                  </div>
                </div>

                {/* 3 Comparison Insight Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* Card 1: Content Volume Delta */}
                  <div className="rounded-lg border border-brand-200 bg-white p-3 space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-brand-400">
                      1. Content Volume
                    </span>
                    <div className="flex items-center gap-1.5 pt-0.5">
                      {activeTheirPage.wordCount > activeOurPage.wordCount ? (
                        <>
                          <span className="font-mono font-bold text-[13px] text-amber-700">
                            +{activeTheirPage.wordCount - activeOurPage.wordCount} words
                          </span>
                          <span className="text-[10px] font-semibold text-amber-800 bg-amber-100 px-1.5 py-0.2 rounded">
                            Deficit
                          </span>
                        </>
                      ) : activeOurPage.wordCount > activeTheirPage.wordCount ? (
                        <>
                          <span className="font-mono font-bold text-[13px] text-emerald-700">
                            +{activeOurPage.wordCount - activeTheirPage.wordCount} words
                          </span>
                          <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-100 px-1.5 py-0.2 rounded">
                            Advantage
                          </span>
                        </>
                      ) : (
                        <span className="font-mono font-bold text-[13px] text-brand-700">
                          Equal ({activeOurPage.wordCount} words)
                        </span>
                      )}
                    </div>
                    <p className="text-[10.5px] text-brand-600 leading-snug">
                      {activeTheirPage.wordCount > activeOurPage.wordCount
                        ? `Competitor provides ${Math.round((activeTheirPage.wordCount / Math.max(activeOurPage.wordCount, 1)) * 10) / 10}x more content depth on this page.`
                        : activeOurPage.wordCount > activeTheirPage.wordCount
                        ? `You have greater textual depth than the competitor on this matching page.`
                        : `Both pages carry identical text volume.`}
                    </p>
                  </div>

                  {/* Card 2: Heading Targeting */}
                  <div className="rounded-lg border border-brand-200 bg-white p-3 space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-brand-400">
                      2. Heading Structure
                    </span>
                    <div className="pt-0.5">
                      <span className="text-[11.5px] font-bold text-brand-900 block truncate">
                        {activeOurPage.h1.length > 0 ? "H1 Active" : "Missing H1"} vs {activeTheirPage.h1.length > 0 ? "Rival H1 Active" : "Rival Missing H1"}
                      </span>
                    </div>
                    <p className="text-[10.5px] text-brand-600 leading-snug">
                      {activeOurPage.h1.length === 0
                        ? "Your page lacks an H1 tag. Adding one is a quick-win ranking signal."
                        : activeTheirPage.h1.length === 0
                        ? "You have an H1 while competitor has none, giving you stronger topical clarity."
                        : "Both pages define H1 tags. Ensure your heading aligns closely with search queries."}
                    </p>
                  </div>

                  {/* Card 3: SERP Snippet / Meta */}
                  <div className="rounded-lg border border-brand-200 bg-white p-3 space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-brand-400">
                      3. SERP Snippet (Meta)
                    </span>
                    <div className="pt-0.5">
                      <span className="text-[11.5px] font-bold text-brand-900 block truncate">
                        {activeOurPage.metaDescription ? "Meta Configured" : "Meta Missing"} vs {activeTheirPage.metaDescription ? "Rival Configured" : "Rival Missing"}
                      </span>
                    </div>
                    <p className="text-[10.5px] text-brand-600 leading-snug">
                      {!activeOurPage.metaDescription && activeTheirPage.metaDescription
                        ? "Rival has a custom search snippet; your page risks poor CTR without one."
                        : activeOurPage.metaDescription && !activeTheirPage.metaDescription
                        ? "You have a tailored meta description while rival has left theirs empty."
                        : activeOurPage.metaDescription
                        ? "Both pages have meta descriptions defined for search results."
                        : "Both pages lack meta descriptions. Add one to capture higher organic CTR."}
                    </p>
                  </div>
                </div>

                {/* 3 Quick Action Steps */}
                <div className="p-3 rounded-lg bg-white border border-brand-200 space-y-2">
                  <span className="text-[11px] font-bold text-brand-950 flex items-center gap-1.5">
                    <CheckCircle2 size={12} className="text-emerald-600" />
                    Recommended Actions for this Page:
                  </span>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-[11px] text-brand-700">
                    <div className="flex items-start gap-1.5">
                      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-900 font-bold text-[9px]">
                        1
                      </span>
                      <span>
                        {activeTheirPage.wordCount > activeOurPage.wordCount
                          ? `Add ~${Math.min(500, activeTheirPage.wordCount - activeOurPage.wordCount)} words covering key features, benefits, and user FAQs.`
                          : `Keep copy fresh and structured with bullet points and clear call-to-actions.`}
                      </span>
                    </div>

                    <div className="flex items-start gap-1.5">
                      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-900 font-bold text-[9px]">
                        2
                      </span>
                      <span>
                        {activeOurPage.h1.length === 0
                          ? `Add an H1 heading reflecting primary user intent on "${activeOurPage.path}".`
                          : `Add 2-3 H2 subheadings to organize subtopics and answer long-tail search questions.`}
                      </span>
                    </div>

                    <div className="flex items-start gap-1.5">
                      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-900 font-bold text-[9px]">
                        3
                      </span>
                      <span>
                        {!activeOurPage.metaDescription
                          ? `Write a 140-160 character meta description with a clear value proposition and CTA.`
                          : `Review meta description length (${activeOurPage.metaDescription.length} chars) to optimize click-through rate.`}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Split Version: Side-by-Side Crawl Lists ─────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* ── LEFT PANEL: Your Website Pages ────────────────────────────── */}
        <div className="rounded-xl border border-brand-200 bg-white shadow-2xs overflow-hidden flex flex-col">
          {/* Panel Header */}
          <div className="p-3.5 bg-brand-50/60 border-b border-brand-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded bg-brand-950 text-white font-bold text-[10px]">
                YOU
              </span>
              <div>
                <span className="font-bold text-[13px] text-brand-950">{customerDomain}</span>
                <span className="text-[11px] text-brand-500 font-mono ml-2">
                  ({filteredOurPages.length} of {normalizedOurPages.length} pages)
                </span>
              </div>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="p-3 border-b border-brand-100 flex flex-wrap items-center gap-2 bg-white">
            <div className="relative flex-1 min-w-[140px]">
              <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-brand-400" />
              <input
                type="text"
                placeholder="Search path or title..."
                value={ourSearch}
                onChange={(e) => setOurSearch(e.target.value)}
                className="w-full rounded-md border border-brand-200 pl-7 pr-2 py-1 text-[11px] text-brand-900 placeholder:text-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>

            <select
              value={ourTypeFilter}
              onChange={(e) => setOurTypeFilter(e.target.value)}
              aria-label="Filter your pages by type"
              className="rounded-md border border-brand-200 px-2 py-1 text-[11px] text-brand-800 bg-white focus:outline-none"
            >
              <option value="ALL">All Kinds</option>
              {Object.entries(TYPE_CONFIG).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>

          {/* Page List Table */}
          <div className="max-h-[460px] overflow-y-auto divide-y divide-brand-100">
            {ourPagesQuery.isLoading ? (
              <div className="p-8 text-center text-[12px] text-brand-400">Loading your crawled pages...</div>
            ) : normalizedOurPages.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <AlertTriangle size={20} className="mx-auto text-amber-600" />
                <div className="text-[12px] font-bold text-brand-950">No crawled pages recorded yet</div>
                <p className="text-[11px] text-brand-500 max-w-xs mx-auto">
                  Run a site audit to fetch and index every page on your site.
                </p>
                <button
                  type="button"
                  onClick={() => crawlOurSiteMutation.mutate()}
                  disabled={crawlOurSiteMutation.isPending}
                  className="rounded-lg bg-brand-950 px-3 py-1.5 text-[11px] font-bold text-white shadow-2xs hover:bg-brand-800 transition mt-2"
                >
                  {crawlOurSiteMutation.isPending ? "Starting Audit..." : "Run Site Audit Now"}
                </button>
              </div>
            ) : filteredOurPages.length === 0 ? (
              <div className="p-6 text-center text-[12px] text-brand-400">
                No pages match the search filter.
              </div>
            ) : (
              filteredOurPages.map((page) => {
                const isSelected = activeOurPage?.url === page.url;
                const typeInfo = TYPE_CONFIG[page.pageType] || TYPE_CONFIG.OTHER;

                return (
                  <div
                    key={page.id}
                    onClick={() => handleSelectOurPage(page)}
                    className={`p-3 flex items-start justify-between gap-2 cursor-pointer transition ${
                      isSelected ? "bg-brand-50/80 border-l-3 border-brand-950" : "hover:bg-brand-50/40"
                    }`}
                  >
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className={`px-1.5 py-0.2 rounded text-[9.5px] font-bold border ${typeInfo.color}`}>
                          {typeInfo.label}
                        </span>
                        <span className="font-mono text-[11.5px] font-bold text-brand-950 truncate">
                          {page.path}
                        </span>
                      </div>
                      <div className="text-[11px] text-brand-600 truncate">{page.title}</div>
                      <div className="flex items-center gap-2.5 text-[10px] font-mono text-brand-400">
                        <span>{page.wordCount} words</span>
                        {page.responseTimeMs && <span>{page.responseTimeMs}ms</span>}
                        {page.statusCode != null ? (
                          <span className="text-emerald-700 font-semibold">{page.statusCode}</span>
                        ) : (
                          <span className="text-brand-300">—</span>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectOurPage(page);
                      }}
                      className={`shrink-0 rounded px-2 py-0.5 text-[10px] font-bold border transition ${
                        isSelected
                          ? "border-brand-950 bg-brand-950 text-white"
                          : "border-brand-200 text-brand-700 bg-white hover:bg-brand-50"
                      }`}
                    >
                      {isSelected ? "Active Pair" : "Compare"}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ── RIGHT PANEL: Competitor Crawled Pages ─────────────────────── */}
        <div className="rounded-xl border border-brand-200 bg-white shadow-2xs overflow-hidden flex flex-col">
          {/* Panel Header */}
          <div className="p-3.5 bg-brand-50/60 border-b border-brand-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded bg-brand-200 text-brand-800 font-bold text-[10px]">
                RIVAL
              </span>
              <div>
                <span className="font-bold text-[13px] text-brand-950">{competitorDisplayName}</span>
                <span className="text-[11px] text-brand-500 font-mono ml-2">
                  ({filteredTheirPages.length} of {normalizedTheirPages.length} pages)
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => crawlCompetitorMutation.mutate()}
              disabled={crawlCompetitorMutation.isPending}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-700 hover:text-brand-950 transition"
            >
              <RefreshCw size={10} className={crawlCompetitorMutation.isPending ? "animate-spin" : ""} />
              {crawlCompetitorMutation.isPending ? "Crawling..." : "Re-crawl"}
            </button>
          </div>

          {/* Filter Bar */}
          <div className="p-3 border-b border-brand-100 flex flex-wrap items-center gap-2 bg-white">
            <div className="relative flex-1 min-w-[140px]">
              <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-brand-400" />
              <input
                type="text"
                placeholder="Search competitor pages..."
                value={theirSearch}
                onChange={(e) => setTheirSearch(e.target.value)}
                className="w-full rounded-md border border-brand-200 pl-7 pr-2 py-1 text-[11px] text-brand-900 placeholder:text-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>

            <select
              value={theirTypeFilter}
              onChange={(e) => setTheirTypeFilter(e.target.value)}
              aria-label="Filter competitor pages by type"
              className="rounded-md border border-brand-200 px-2 py-1 text-[11px] text-brand-800 bg-white focus:outline-none"
            >
              <option value="ALL">All Kinds</option>
              {Object.entries(TYPE_CONFIG).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>

          {/* Page List Table */}
          <div className="max-h-[460px] overflow-y-auto divide-y divide-brand-100">
            {competitorPagesQuery.isLoading ? (
              <div className="p-8 text-center text-[12px] text-brand-400">Reading competitor pages...</div>
            ) : normalizedTheirPages.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <Globe size={20} className="mx-auto text-brand-400" />
                <div className="text-[12px] font-bold text-brand-950">No crawled competitor pages recorded</div>
                <p className="text-[11px] text-brand-500 max-w-xs mx-auto">
                  Click below to crawl {competitor.domain} and extract every page and content metric.
                </p>
                <button
                  type="button"
                  onClick={() => crawlCompetitorMutation.mutate()}
                  disabled={crawlCompetitorMutation.isPending}
                  className="rounded-lg bg-brand-950 px-3 py-1.5 text-[11px] font-bold text-white shadow-2xs hover:bg-brand-800 transition mt-2"
                >
                  {crawlCompetitorMutation.isPending ? "Crawling..." : `Crawl ${competitor.domain} Now`}
                </button>
              </div>
            ) : filteredTheirPages.length === 0 ? (
              <div className="p-6 text-center text-[12px] text-brand-400">
                No competitor pages match the filter.
              </div>
            ) : (
              filteredTheirPages.map((page) => {
                const isSelected = activeTheirPage?.url === page.url;
                const typeInfo = TYPE_CONFIG[page.pageType] || TYPE_CONFIG.OTHER;

                return (
                  <div
                    key={page.id}
                    onClick={() => handleSelectTheirPage(page)}
                    className={`p-3 flex items-start justify-between gap-2 cursor-pointer transition ${
                      isSelected ? "bg-brand-50/80 border-l-3 border-brand-950" : "hover:bg-brand-50/40"
                    }`}
                  >
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className={`px-1.5 py-0.2 rounded text-[9.5px] font-bold border ${typeInfo.color}`}>
                          {typeInfo.label}
                        </span>
                        <span className="font-mono text-[11.5px] font-bold text-brand-900 truncate">
                          {page.path}
                        </span>
                      </div>
                      <div className="text-[11px] text-brand-600 truncate">{page.title}</div>
                      <div className="flex items-center gap-2.5 text-[10px] font-mono text-brand-400">
                        <span>{page.wordCount} words</span>
                        {page.responseTimeMs && <span>{page.responseTimeMs}ms</span>}
                        {page.statusCode != null ? (
                          <span className="text-emerald-700 font-semibold">{page.statusCode}</span>
                        ) : (
                          <span className="text-brand-300">—</span>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectTheirPage(page);
                      }}
                      className={`shrink-0 rounded px-2 py-0.5 text-[10px] font-bold border transition ${
                        isSelected
                          ? "border-brand-950 bg-brand-950 text-white"
                          : "border-brand-200 text-brand-700 bg-white hover:bg-brand-50"
                      }`}
                    >
                      {isSelected ? "Active Pair" : "Compare"}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
