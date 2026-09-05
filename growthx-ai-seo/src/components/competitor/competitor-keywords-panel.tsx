"use client";

import { useState, useMemo } from "react";import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Sparkles, Copy, Check, Search, ArrowLeftRight, Target, ChevronDown, ChevronUp, Globe, CheckCircle2, Hash, LayoutTemplate, RefreshCw } from "lucide-react";
import { api, type TrackedCompetitor, type CrawlPage } from "@/lib/api-client";
import { useLatestCrawl, useCrawlPages } from "@/hooks/use-growthx";
import { LoadingState, TruthfulState } from "@/components/ui/truthful-state";

/**
 * These panels are handed rows straight from `listCompetitors`. The local
 * duplicate of that shape needed an `any` index signature purely to stay
 * assignable from the real type, and declared a `websiteId` nothing ever read.
 */
type TrackedCompetitorInfo = TrackedCompetitor;

interface CompetitorKeywordsPanelProps {
  projectId: string;
  customerDomain: string;
  competitors: TrackedCompetitorInfo[];
}

/** Stopwords and web generic boilerplate to exclude from keyword extraction */
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
  // Common website structure boilerplate
  "home", "page", "welcome", "index", "ltd", "inc", "llp", "pvt", "limited", "company",
  "official", "website", "site", "best", "top", "services", "service", "products",
  "product", "solutions", "solution", "overview", "contact", "about", "privacy",
  "policy", "terms", "conditions", "copyright", "rights", "reserved", "login",
  "register", "signup", "signin", "cart", "checkout", "blog", "posts", "read",
  "click", "view", "more", "learn", "menu", "search", "filter", "close", "open"
]);

export interface KeywordOccurrence {
  keyword: string;
  source: "H1" | "TITLE" | "H2" | "META" | "SLUG";
  url: string;
  pageTitle: string;
  pageType: string;
}

export interface ExtractedKeywordProfile {
  keyword: string;
  tokensCount: number;
  totalOccurrences: number;
  placements: {
    inH1: number;
    inTitle: number;
    inH2: number;
    inMeta: number;
    inSlug: number;
  };
  pages: Array<{
    url: string;
    title: string;
    pageType: string;
    foundIn: string[];
  }>;
  primaryPageType: string;
  searchIntent: "COMMERCIAL" | "TRANSACTIONAL" | "INFORMATIONAL";
}

export interface KeywordComparisonItem {
  keyword: string;
  status: "MISSING_OPPORTUNITY" | "SHARED_BATTLEFIELD" | "OUR_ADVANTAGE";
  ourProfile: ExtractedKeywordProfile | null;
  competitorProfile: ExtractedKeywordProfile | null;
  intent: "COMMERCIAL" | "TRANSACTIONAL" | "INFORMATIONAL";
  rankPotential: "HIGH" | "MEDIUM" | "QUICK_WIN";
  // Exact Placement Blueprint
  targetPlacement: {
    recommendedAction: "CREATE_NEW_PAGE" | "UPGRADE_EXISTING_PAGE";
    targetUrl: string;
    existingPageUrl?: string;
    h1Heading: string;
    seoTitle: string;
    metaDescription: string;
    h2Subheadings: string[];
    introParagraphSnippet: string;
    internalAnchorSuggestions: string[];
  };
}

/** Tokenize text into clean 1-word and 2-word key phrases */
function extractPhrasesFromText(text: string | null | undefined): string[] {
  if (!text) return [];
  const clean = text
    .toLowerCase()
    .replace(/[^\w\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const words = clean.split(" ").filter((w) => w.length > 2 && !STOPWORDS.has(w) && !/^\d+$/.test(w));
  
  const phrases: string[] = [];
  // 1-grams
  for (const w of words) {
    if (w.length >= 3) phrases.push(w);
  }
  // 2-grams
  for (let i = 0; i < words.length - 1; i++) {
    const bigram = `${words[i]} ${words[i + 1]}`;
    if (!STOPWORDS.has(words[i]) && !STOPWORDS.has(words[i + 1])) {
      phrases.push(bigram);
    }
  }
  return phrases;
}

/** Determine likely intent */
function inferIntent(keyword: string): "COMMERCIAL" | "TRANSACTIONAL" | "INFORMATIONAL" {
  const kw = keyword.toLowerCase();
  if (/buy|price|cost|quote|order|purchase|hire|export|supplier|manufacturer|vendor/i.test(kw)) {
    return "TRANSACTIONAL";
  }
  if (/best|top|vs|comparison|review|service|solution|agency|company|enterprise|custom/i.test(kw)) {
    return "COMMERCIAL";
  }
  return "INFORMATIONAL";
}

/** Capitalize words for clean presentation */
function titleCase(str: string): string {
  return str
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/** Aggregate extracted page data into structured keyword profiles */
/**
 * Takes the fields this actually reads rather than a full CrawlPage: the
 * competitor-pages query returns a narrower projection than the crawl-pages
 * one, and both are valid inputs here.
 */
type KeywordSourcePage = Pick<CrawlPage, "url" | "title" | "metaDescription" | "pageType" | "h1"> &
  Partial<Pick<CrawlPage, "h2">>;

function buildKeywordProfiles(pages: KeywordSourcePage[]): Map<string, ExtractedKeywordProfile> {
  const map = new Map<string, ExtractedKeywordProfile>();

  pages.forEach((page) => {
    const rawUrl = page.url || "";
    let slug = "";
    try {
      const p = new URL(rawUrl).pathname.split("/").filter(Boolean);
      slug = p.pop() || "";
    } catch {
      slug = rawUrl;
    }

    const titlePhrases: string[] = extractPhrasesFromText(page.title);
    const h1Phrases: string[] = Array.isArray(page.h1)
      ? page.h1.flatMap((h: string) => extractPhrasesFromText(h))
      : extractPhrasesFromText(page.h1);
    const h2Phrases: string[] = Array.isArray(page.h2)
      ? page.h2.flatMap((h: string) => extractPhrasesFromText(h))
      : extractPhrasesFromText(page.h2);
    const metaPhrases: string[] = extractPhrasesFromText(page.metaDescription);
    const slugPhrases: string[] = extractPhrasesFromText(slug.replace(/[-_]+/g, " "));

    const pageType = (page.pageType || "PAGE").toUpperCase();

    const uniquePhrasesOnPage = new Set([
      ...titlePhrases,
      ...h1Phrases,
      ...h2Phrases,
      ...metaPhrases,
      ...slugPhrases,
    ]);

    uniquePhrasesOnPage.forEach((phrase) => {
      // Focus on meaningful keywords (at least 4 chars or 2 words)
      if (phrase.length < 4 && !phrase.includes(" ")) return;

      const inH1Count = h1Phrases.filter((p: string) => p === phrase).length;
      const inTitleCount = titlePhrases.filter((p: string) => p === phrase).length;
      const inH2Count = h2Phrases.filter((p: string) => p === phrase).length;
      const inMetaCount = metaPhrases.filter((p: string) => p === phrase).length;
      const inSlugCount = slugPhrases.filter((p: string) => p === phrase).length;

      const foundLocations: string[] = [];
      if (inH1Count > 0) foundLocations.push("H1");
      if (inTitleCount > 0) foundLocations.push("Title");
      if (inH2Count > 0) foundLocations.push("H2");
      if (inMetaCount > 0) foundLocations.push("Meta");
      if (inSlugCount > 0) foundLocations.push("URL");

      if (!map.has(phrase)) {
        map.set(phrase, {
          keyword: phrase,
          tokensCount: phrase.split(" ").length,
          totalOccurrences: 0,
          placements: { inH1: 0, inTitle: 0, inH2: 0, inMeta: 0, inSlug: 0 },
          pages: [],
          primaryPageType: pageType,
          searchIntent: inferIntent(phrase),
        });
      }

      const existing = map.get(phrase)!;
      existing.totalOccurrences += 1;
      existing.placements.inH1 += inH1Count;
      existing.placements.inTitle += inTitleCount;
      existing.placements.inH2 += inH2Count;
      existing.placements.inMeta += inMetaCount;
      existing.placements.inSlug += inSlugCount;
      existing.pages.push({
        url: rawUrl,
        title: page.title || slug || "Page",
        pageType,
        foundIn: foundLocations,
      });
    });
  });

  return map;
}

export function CompetitorKeywordsPanel({
  projectId,
  customerDomain,
  competitors,
}: CompetitorKeywordsPanelProps) {
  const queryClient = useQueryClient();

  // Selected competitor state
  const [selectedCompetitorId, setSelectedCompetitorId] = useState<string>(
    competitors[0]?.id || ""
  );

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState<"ALL" | "OPPORTUNITIES" | "SHARED" | "OURS">("OPPORTUNITIES");
  const [pageTypeFilter, setPageTypeFilter] = useState<string>("ALL");
  const [viewMode, setViewMode] = useState<"SPLIT" | "BLUEPRINTS">("SPLIT");
  const [expandedBlueprint, setExpandedBlueprint] = useState<string | null>(null);
  const [copiedKeyword, setCopiedKeyword] = useState<string | null>(null);

  // Active competitor object
  const activeCompetitor = useMemo(() => {
    return competitors.find((c) => c.id === selectedCompetitorId) || competitors[0] || null;
  }, [competitors, selectedCompetitorId]);

  // 1. Fetch Our Crawl Pages
  const ourCrawl = useLatestCrawl(customerDomain || null);
  const ourPagesQuery = useCrawlPages(ourCrawl.data?.id ?? null, ourCrawl.data?.status);

  // 2. Fetch Competitor Crawl Pages
  const competitorPagesQuery = useQuery({
    queryKey: ["competitor-pages", projectId, activeCompetitor?.id],
    queryFn: () => api.listCompetitorPages(projectId, activeCompetitor!.id),
    enabled: Boolean(projectId && activeCompetitor?.id),
    staleTime: 30000,
  });

  // Crawl competitor trigger
  const crawlCompetitorMutation = useMutation({
    mutationFn: () => api.crawlCompetitorSite(projectId, activeCompetitor!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["competitor-pages", projectId, activeCompetitor?.id] });
    },
  });

  // Extract profiles for our pages
  const ourKeywordProfiles = useMemo(() => {
    const pages = ourPagesQuery.data?.data || [];
    return buildKeywordProfiles(pages);
  }, [ourPagesQuery.data]);

  // Extract profiles for competitor pages
  const competitorKeywordProfiles = useMemo(() => {
    const pages = competitorPagesQuery.data || [];
    return buildKeywordProfiles(pages);
  }, [competitorPagesQuery.data]);

  // Side-by-Side Comparison Matrix & Actionable Placement Blueprints
  const comparisons = useMemo<KeywordComparisonItem[]>(() => {
    const items: KeywordComparisonItem[] = [];
    const allKeywordsSet = new Set([
      ...Array.from(competitorKeywordProfiles.keys()),
      ...Array.from(ourKeywordProfiles.keys()),
    ]);

    allKeywordsSet.forEach((keyword) => {
      const compProf = competitorKeywordProfiles.get(keyword) || null;
      const ourProf = ourKeywordProfiles.get(keyword) || null;

      // Filter out low-frequency noise: must appear in Title/H1 or on at least 1 page prominently
      const compProminent = compProf && (compProf.placements.inH1 > 0 || compProf.placements.inTitle > 0 || compProf.totalOccurrences >= 2);
      const ourProminent = ourProf && (ourProf.placements.inH1 > 0 || ourProf.placements.inTitle > 0 || ourProf.totalOccurrences >= 2);

      if (!compProminent && !ourProminent) return;

      let status: "MISSING_OPPORTUNITY" | "SHARED_BATTLEFIELD" | "OUR_ADVANTAGE";
      if (compProf && !ourProf) {
        status = "MISSING_OPPORTUNITY";
      } else if (compProf && ourProf) {
        // If competitor has it in H1/Title and we only have low presence, still mark as opportunity
        if (compProf.placements.inH1 > 0 && ourProf.placements.inH1 === 0 && ourProf.placements.inTitle === 0) {
          status = "MISSING_OPPORTUNITY";
        } else {
          status = "SHARED_BATTLEFIELD";
        }
      } else {
        status = "OUR_ADVANTAGE";
      }

      const intent = compProf ? compProf.searchIntent : ourProf!.searchIntent;
      const rankPotential: "HIGH" | "MEDIUM" | "QUICK_WIN" =
        status === "MISSING_OPPORTUNITY" && compProf && compProf.placements.inH1 > 0
          ? "HIGH"
          : status === "SHARED_BATTLEFIELD" && ourProf && ourProf.placements.inH1 === 0
          ? "QUICK_WIN"
          : "MEDIUM";

      // Build specific on-page placement guidance
      const niceKeyword = titleCase(keyword);
      const slugKw = keyword.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      
      const closestOwnPage = ourProf?.pages[0];
      const recommendedAction: "CREATE_NEW_PAGE" | "UPGRADE_EXISTING_PAGE" =
        closestOwnPage ? "UPGRADE_EXISTING_PAGE" : "CREATE_NEW_PAGE";

      const targetUrl = closestOwnPage
        ? closestOwnPage.url
        : `/products/${slugKw}`;

      const h1Heading =
        intent === "TRANSACTIONAL"
          ? `${niceKeyword} — Commercial Specifications, Grades & Supply Solutions`
          : intent === "COMMERCIAL"
          ? `Premium ${niceKeyword} Solutions & Enterprise Capabilities`
          : `${niceKeyword} Guide: Technical Overview & Best Practices`;

      const seoTitle = `${niceKeyword} Solutions | ${customerDomain || "Your Brand"}`;
      const metaDescription = `Explore high-performance ${keyword} capabilities. Verified standards, custom specifications, and direct enterprise fulfillment. Learn more today.`;

      const h2Subheadings = [
        `Technical Specifications & ${niceKeyword} Capabilities`,
        `Industry Applications & Quality Standards for ${niceKeyword}`,
        `Procurement, Batch Ordering & Frequently Asked Questions`,
      ];

      const introParagraphSnippet = `When evaluating ${keyword} for enterprise requirements, organizations demand certified consistency and reliable performance. Our ${keyword} solutions are built to exceed commercial standards while delivering scalable deployment.`;

      const internalAnchorSuggestions = [
        `Link from your Homepage footer/solutions menu with anchor "${niceKeyword}"`,
        `Link from main catalog page with anchor "Enterprise ${niceKeyword}"`,
      ];

      items.push({
        keyword,
        status,
        ourProfile: ourProf,
        competitorProfile: compProf,
        intent,
        rankPotential,
        targetPlacement: {
          recommendedAction,
          targetUrl,
          existingPageUrl: closestOwnPage?.url,
          h1Heading,
          seoTitle,
          metaDescription,
          h2Subheadings,
          introParagraphSnippet,
          internalAnchorSuggestions,
        },
      });
    });

    // Sort: High priority opportunities first, then highest frequency
    return items.sort((a, b) => {
      const score = (item: KeywordComparisonItem) => {
        let s = 0;
        if (item.status === "MISSING_OPPORTUNITY") s += 100;
        if (item.rankPotential === "HIGH") s += 50;
        if (item.competitorProfile?.placements.inH1) s += 20;
        s += item.competitorProfile?.totalOccurrences || 0;
        return s;
      };
      return score(b) - score(a);
    });
  }, [competitorKeywordProfiles, ourKeywordProfiles, customerDomain]);

  // Filtered comparisons
  const filteredComparisons = useMemo(() => {
    return comparisons.filter((item) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesKeyword = item.keyword.toLowerCase().includes(q);
        const matchesH1 = item.targetPlacement.h1Heading.toLowerCase().includes(q);
        if (!matchesKeyword && !matchesH1) return false;
      }

      if (filterCategory === "OPPORTUNITIES" && item.status !== "MISSING_OPPORTUNITY") return false;
      if (filterCategory === "SHARED" && item.status !== "SHARED_BATTLEFIELD") return false;
      if (filterCategory === "OURS" && item.status !== "OUR_ADVANTAGE") return false;

      if (pageTypeFilter !== "ALL") {
        const matchComp = item.competitorProfile?.primaryPageType === pageTypeFilter;
        const matchOur = item.ourProfile?.primaryPageType === pageTypeFilter;
        if (!matchComp && !matchOur) return false;
      }

      return true;
    });
  }, [comparisons, searchQuery, filterCategory, pageTypeFilter]);

  // KPI calculations
  const stats = useMemo(() => {
    const missingCount = comparisons.filter((c) => c.status === "MISSING_OPPORTUNITY").length;
    const sharedCount = comparisons.filter((c) => c.status === "SHARED_BATTLEFIELD").length;
    const ourExclusiveCount = comparisons.filter((c) => c.status === "OUR_ADVANTAGE").length;
    const compTotalKw = competitorKeywordProfiles.size;
    return { missingCount, sharedCount, ourExclusiveCount, compTotalKw };
  }, [comparisons, competitorKeywordProfiles]);

  const copyBlueprintToClipboard = (item: KeywordComparisonItem) => {
    const text = `### Keyword Placement Blueprint: ${titleCase(item.keyword)}
- Target Keyword: ${item.keyword}
- Action: ${item.targetPlacement.recommendedAction === "CREATE_NEW_PAGE" ? "Create New Dedicated Page" : "Upgrade Existing Page"}
- Target URL: ${item.targetPlacement.targetUrl}
- Recommended H1: ${item.targetPlacement.h1Heading}
- SEO Title: ${item.targetPlacement.seoTitle}
- Meta Description: ${item.targetPlacement.metaDescription}
- Section H2 Subheadings:
  1. ${item.targetPlacement.h2Subheadings[0]}
  2. ${item.targetPlacement.h2Subheadings[1]}
  3. ${item.targetPlacement.h2Subheadings[2]}
- Intro Body Context (First 100 Words):
  "${item.targetPlacement.introParagraphSnippet}"
- Internal Anchor Linking:
  - ${item.targetPlacement.internalAnchorSuggestions.join("\n  - ")}
`;
    navigator.clipboard.writeText(text);
    setCopiedKeyword(item.keyword);
    setTimeout(() => setCopiedKeyword(null), 2500);
  };

  if (!activeCompetitor) {
    return (
      <TruthfulState
        icon={Globe}
        title="No Competitors Tracked"
        missing="Add a competitor in the 'Find Competitors' tab to unlock keyword comparison and placement intelligence."
      />
    );
  }

  const isCompetitorLoading = competitorPagesQuery.isLoading;
  const competitorPagesCount = competitorPagesQuery.data?.length || 0;
  return (
    <div className="space-y-6">
      {/* 1. Header Bar: Competitor Selector & Quick Stats */}
      <div className="rounded-2xl border bg-white p-6 shadow-sm" style={{ borderColor: "var(--border-color)" }}>
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-950 text-white shadow-sm">
                <Hash size={16} />
              </div>
              <div>
                <h2 className="text-[17px] font-bold tracking-tight text-brand-950">
                  Competitor Keyword Intelligence & Exact Placements
                </h2>
                <p className="text-[12px] text-brand-500">
                  Side-by-side keyword architecture, missing rank opportunities, and exact on-page placement blueprints.
                </p>
              </div>
            </div>
          </div>

          {/* Competitor Selector Dropdown */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-[12px] font-medium text-brand-600">Comparing Against:</span>
              <div className="relative inline-block">
                <select
                  value={selectedCompetitorId}
                  onChange={(e) => setSelectedCompetitorId(e.target.value)}
                  className="appearance-none rounded-xl border bg-brand-50/50 py-2 pl-3.5 pr-8 text-[12px] font-semibold text-brand-950 shadow-sm transition hover:bg-brand-50 focus:border-brand-950 focus:outline-none"
                  style={{ borderColor: "var(--border-color)" }}
                >
                  {competitors.map((comp) => (
                    <option key={comp.id} value={comp.id}>
                      {comp.label || comp.name || comp.domain} ({comp.domain})
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-brand-400" />
              </div>
            </div>

            {competitorPagesCount === 0 && !isCompetitorLoading && (
              <button
                onClick={() => crawlCompetitorMutation.mutate()}
                disabled={crawlCompetitorMutation.isPending}
                className="flex items-center gap-1.5 rounded-xl bg-brand-950 px-3.5 py-2 text-[12px] font-semibold text-white transition hover:bg-brand-800 disabled:opacity-50"
              >
                <RefreshCw size={13} className={crawlCompetitorMutation.isPending ? "animate-spin" : ""} />
                {crawlCompetitorMutation.isPending ? "Crawling Site..." : "Crawl Competitor"}
              </button>
            )}
          </div>
        </div>

        {/* Metric KPI Banner */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border bg-brand-50/40 p-3.5" style={{ borderColor: "var(--border-color)" }}>
            <span className="text-[11px] font-medium uppercase tracking-wider text-brand-500">
              Rival Target Keywords
            </span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-[22px] font-bold text-brand-950">{stats.compTotalKw}</span>
              <span className="text-[11px] text-brand-400">across {competitorPagesCount} pages</span>
            </div>
          </div>

          <div className="rounded-xl border bg-emerald-50/50 p-3.5 border-emerald-200">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
              🔥 Missing Rank Gaps
            </span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-[22px] font-bold text-emerald-950">{stats.missingCount}</span>
              <span className="text-[11px] text-emerald-700">take to improve rank</span>
            </div>
          </div>

          <div className="rounded-xl border bg-blue-50/50 p-3.5 border-blue-200">
            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-800">
              ⚔️ Shared Battlefield
            </span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-[22px] font-bold text-blue-950">{stats.sharedCount}</span>
              <span className="text-[11px] text-blue-700">both sites compete</span>
            </div>
          </div>

          <div className="rounded-xl border bg-purple-50/50 p-3.5 border-purple-200">
            <span className="text-[11px] font-bold uppercase tracking-wider text-purple-800">
              🛡️ Your Unique Terms
            </span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-[22px] font-bold text-purple-950">{stats.ourExclusiveCount}</span>
              <span className="text-[11px] text-purple-700">exclusive authority</span>
            </div>
          </div>
        </div>
      </div>

      {/* Crawl Status Guard */}
      {isCompetitorLoading ? (
        <LoadingState message="Extracting and analyzing on-page keywords from crawled pages..." />
      ) : competitorPagesCount === 0 ? (
        <div className="rounded-2xl border bg-white p-10 text-center shadow-sm" style={{ borderColor: "var(--border-color)" }}>
          <Globe size={32} className="mx-auto text-brand-400 mb-3" />
          <h3 className="text-[15px] font-bold text-brand-950">No Crawl Telemetry for {activeCompetitor.domain}</h3>
          <p className="mx-auto mt-1 max-w-md text-[13px] text-brand-500">
            We need to crawl this competitor&apos;s site once to index their H1 tags, page titles, and keyword placements beside yours.
          </p>
          <button
            onClick={() => crawlCompetitorMutation.mutate()}
            disabled={crawlCompetitorMutation.isPending}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-brand-950 px-5 py-2.5 text-[13px] font-semibold text-white shadow-sm transition hover:bg-brand-800 disabled:opacity-50"
          >
            <RefreshCw size={14} className={crawlCompetitorMutation.isPending ? "animate-spin" : ""} />
            {crawlCompetitorMutation.isPending ? "Crawling Site..." : "Start Competitor Crawl"}
          </button>
        </div>
      ) : (
        <>
          {/* 2. Control Bar: View Toggle, Search, Filters */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            {/* Filter Tabs */}
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                onClick={() => setFilterCategory("OPPORTUNITIES")}
                className={`rounded-xl px-3.5 py-1.5 text-[12px] font-semibold transition ${
                  filterCategory === "OPPORTUNITIES"
                    ? "bg-emerald-700 text-white shadow-sm"
                    : "bg-white border text-brand-700 hover:bg-brand-50"
                }`}
                style={filterCategory !== "OPPORTUNITIES" ? { borderColor: "var(--border-color)" } : {}}
              >
                🔥 Missing Opportunities ({stats.missingCount})
              </button>
              <button
                onClick={() => setFilterCategory("SHARED")}
                className={`rounded-xl px-3.5 py-1.5 text-[12px] font-semibold transition ${
                  filterCategory === "SHARED"
                    ? "bg-blue-700 text-white shadow-sm"
                    : "bg-white border text-brand-700 hover:bg-brand-50"
                }`}
                style={filterCategory !== "SHARED" ? { borderColor: "var(--border-color)" } : {}}
              >
                ⚔️ Shared Battlefield ({stats.sharedCount})
              </button>
              <button
                onClick={() => setFilterCategory("OURS")}
                className={`rounded-xl px-3.5 py-1.5 text-[12px] font-semibold transition ${
                  filterCategory === "OURS"
                    ? "bg-purple-700 text-white shadow-sm"
                    : "bg-white border text-brand-700 hover:bg-brand-50"
                }`}
                style={filterCategory !== "OURS" ? { borderColor: "var(--border-color)" } : {}}
              >
                🛡️ Your Unique ({stats.ourExclusiveCount})
              </button>
              <button
                onClick={() => setFilterCategory("ALL")}
                className={`rounded-xl px-3.5 py-1.5 text-[12px] font-semibold transition ${
                  filterCategory === "ALL"
                    ? "bg-brand-950 text-white shadow-sm"
                    : "bg-white border text-brand-700 hover:bg-brand-50"
                }`}
                style={filterCategory !== "ALL" ? { borderColor: "var(--border-color)" } : {}}
              >
                All ({comparisons.length})
              </button>
            </div>

            {/* View Switcher & Search */}
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-400" />
                <input
                  type="text"
                  placeholder="Filter keywords..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="rounded-xl border bg-white py-1.5 pl-8 pr-3 text-[12px] text-brand-950 shadow-sm focus:border-brand-950 focus:outline-none"
                  style={{ borderColor: "var(--border-color)" }}
                />
              </div>

              {/* View Toggle */}
              <div className="flex rounded-xl border bg-white p-0.5 shadow-sm" style={{ borderColor: "var(--border-color)" }}>
                <button
                  onClick={() => setViewMode("SPLIT")}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold transition ${
                    viewMode === "SPLIT" ? "bg-brand-950 text-white" : "text-brand-600 hover:text-brand-950"
                  }`}
                >
                  <ArrowLeftRight size={13} />
                  Side-by-Side
                </button>
                <button
                  onClick={() => setViewMode("BLUEPRINTS")}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold transition ${
                    viewMode === "BLUEPRINTS" ? "bg-brand-950 text-white" : "text-brand-600 hover:text-brand-950"
                  }`}
                >
                  <LayoutTemplate size={13} />
                  Placements Plan
                </button>
              </div>
            </div>
          </div>

          {/* 3. Main Data Area: Side-by-Side or Placement Cards */}
          {filteredComparisons.length === 0 ? (
            <div className="rounded-2xl border bg-white p-12 text-center shadow-sm" style={{ borderColor: "var(--border-color)" }}>
              <Search size={28} className="mx-auto text-brand-400 mb-2" />
              <p className="text-[14px] font-semibold text-brand-950">No matching keywords found</p>
              <p className="mt-1 text-[12px] text-brand-500">Try adjusting your search query or switching the category filter.</p>
            </div>
          ) : viewMode === "SPLIT" ? (
            /* ── Side-by-Side Dual Column View ──────────────────────────────── */
            <div className="space-y-3">
              {/* Column Headers */}
              <div className="hidden grid-cols-12 gap-3 px-4 text-[11px] font-bold uppercase tracking-wider text-brand-400 md:grid">
                <div className="col-span-4 flex items-center gap-1.5 text-brand-800">
                  <Globe size={13} className="text-brand-500" />
                  Your Website ({customerDomain || "Your Site"})
                </div>
                <div className="col-span-4 text-center text-brand-500">
                  Rank Gap Status & Where to Place
                </div>
                <div className="col-span-4 flex items-center justify-end gap-1.5 text-brand-800">
                  <Globe size={13} className="text-brand-500" />
                  Competitor ({activeCompetitor.domain})
                </div>
              </div>

              {filteredComparisons.map((item) => {
                const isExpanded = expandedBlueprint === item.keyword;
                const isCopied = copiedKeyword === item.keyword;

                return (
                  <div
                    key={item.keyword}
                    className="overflow-hidden rounded-2xl border bg-white transition hover:shadow-md"
                    style={{ borderColor: "var(--border-color)" }}
                  >
                    {/* Main Row */}
                    <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-12 md:items-center">
                      {/* Left: Your Website */}
                      <div className="md:col-span-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-brand-400 md:hidden">
                            Your Website:
                          </span>
                          <span className="font-mono text-[13px] font-bold text-brand-950">
                            {item.ourProfile ? titleCase(item.keyword) : "—"}
                          </span>
                          {item.ourProfile ? (
                            <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-semibold text-brand-800">
                              {item.ourProfile.totalOccurrences} pages
                            </span>
                          ) : (
                            <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-700 border border-rose-200">
                              Not Covered
                            </span>
                          )}
                        </div>

                        {item.ourProfile ? (
                          <div className="space-y-1">
                            <div className="flex flex-wrap gap-1">
                              {item.ourProfile.placements.inH1 > 0 && (
                                <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 border border-blue-200">
                                  H1 ({item.ourProfile.placements.inH1})
                                </span>
                              )}
                              {item.ourProfile.placements.inTitle > 0 && (
                                <span className="rounded bg-purple-50 px-1.5 py-0.5 text-[10px] font-medium text-purple-700 border border-purple-200">
                                  Title ({item.ourProfile.placements.inTitle})
                                </span>
                              )}
                              {item.ourProfile.placements.inH2 > 0 && (
                                <span className="rounded bg-brand-50 px-1.5 py-0.5 text-[10px] font-medium text-brand-600 border border-brand-200">
                                  H2 ({item.ourProfile.placements.inH2})
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-brand-400 truncate">
                              Used on: <span className="font-mono text-brand-600">{item.ourProfile.pages[0]?.url.replace(/^https?:\/\/[^/]+/, "") || "/"}</span>
                            </div>
                          </div>
                        ) : (
                          <p className="text-[11px] text-brand-400 italic">
                            Missing from your H1s, titles and page content.
                          </p>
                        )}
                      </div>

                      {/* Middle: Gap Status, Intent & Action Trigger */}
                      <div className="md:col-span-4 flex flex-col items-center justify-center text-center space-y-2 border-y py-3 md:border-y-0 md:border-x md:px-3" style={{ borderColor: "var(--border-color)" }}>
                        <div className="flex items-center gap-1.5">
                          {item.status === "MISSING_OPPORTUNITY" && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800 border border-emerald-200">
                              <Sparkles size={11} />
                              Rank Improvement Gap
                            </span>
                          )}
                          {item.status === "SHARED_BATTLEFIELD" && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-bold text-blue-700 border border-blue-200">
                              <ArrowLeftRight size={11} />
                              Shared Battlefield
                            </span>
                          )}
                          {item.status === "OUR_ADVANTAGE" && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2.5 py-0.5 text-[11px] font-bold text-purple-700 border border-purple-200">
                              <CheckCircle2 size={11} />
                              Your Unique Advantage
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 text-[10px] text-brand-500 font-medium">
                          <span className="rounded bg-brand-100 px-1.5 py-0.5 text-brand-700 uppercase font-mono">
                            {item.intent}
                          </span>
                          <span>•</span>
                          <span className={item.rankPotential === "HIGH" ? "text-emerald-700 font-semibold" : "text-brand-500"}>
                            {item.rankPotential} IMPACT
                          </span>
                        </div>

                        {/* Toggle Placement Blueprint button */}
                        <button
                          onClick={() => setExpandedBlueprint(isExpanded ? null : item.keyword)}
                          className="flex items-center gap-1 rounded-lg border bg-brand-50/50 px-2.5 py-1 text-[11px] font-semibold text-brand-900 transition hover:bg-brand-100"
                          style={{ borderColor: "var(--border-color)" }}
                        >
                          <LayoutTemplate size={12} className="text-brand-600" />
                          <span>{isExpanded ? "Hide Placement" : "View Where to Use"}</span>
                          {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        </button>
                      </div>

                      {/* Right: Competitor's Website */}
                      <div className="md:col-span-4 space-y-2 text-left md:text-right">
                        <div className="flex items-center justify-between md:justify-end md:gap-3">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-brand-400 md:hidden">
                            Competitor:
                          </span>
                          {item.competitorProfile ? (
                            <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-semibold text-brand-800">
                              {item.competitorProfile.totalOccurrences} pages
                            </span>
                          ) : (
                            <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-semibold text-brand-400">
                              Not Detected
                            </span>
                          )}
                          <span className="font-mono text-[13px] font-bold text-brand-950">
                            {item.competitorProfile ? titleCase(item.keyword) : "—"}
                          </span>
                        </div>

                        {item.competitorProfile ? (
                          <div className="space-y-1">
                            <div className="flex flex-wrap gap-1 md:justify-end">
                              {item.competitorProfile.placements.inH1 > 0 && (
                                <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-800 border border-emerald-200">
                                  H1 ({item.competitorProfile.placements.inH1})
                                </span>
                              )}
                              {item.competitorProfile.placements.inTitle > 0 && (
                                <span className="rounded bg-purple-50 px-1.5 py-0.5 text-[10px] font-medium text-purple-700 border border-purple-200">
                                  Title ({item.competitorProfile.placements.inTitle})
                                </span>
                              )}
                              {item.competitorProfile.placements.inH2 > 0 && (
                                <span className="rounded bg-brand-50 px-1.5 py-0.5 text-[10px] font-medium text-brand-600 border border-brand-200">
                                  H2 ({item.competitorProfile.placements.inH2})
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-brand-400 truncate">
                              Targeted on:{" "}
                              <a
                                href={item.competitorProfile.pages[0]?.url}
                                target="_blank"
                                rel="noreferrer"
                                className="font-mono text-brand-700 underline decoration-brand-300 hover:text-brand-950"
                              >
                                {item.competitorProfile.pages[0]?.url.replace(/^https?:\/\/[^/]+/, "") || "/"}
                              </a>
                            </div>
                          </div>
                        ) : (
                          <p className="text-[11px] text-brand-400 italic">
                            Competitor does not optimize for this term.
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Expandable Exact Placement Blueprint Section */}
                    {isExpanded && (
                      <div className="border-t bg-brand-50/40 p-5 space-y-4" style={{ borderColor: "var(--border-color)" }}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-700 text-white">
                              <Target size={13} />
                            </div>
                            <h4 className="text-[13px] font-bold text-brand-950">
                              Exact Placement Blueprint for &quot;{titleCase(item.keyword)}&quot;
                            </h4>
                          </div>

                          <button
                            onClick={() => copyBlueprintToClipboard(item)}
                            className="flex items-center gap-1.5 rounded-lg border bg-white px-3 py-1.5 text-[11px] font-semibold text-brand-800 shadow-sm transition hover:bg-brand-50"
                            style={{ borderColor: "var(--border-color)" }}
                          >
                            {isCopied ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                            <span>{isCopied ? "Copied Blueprint!" : "Copy Placement Blueprint"}</span>
                          </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Target URL & Recommended H1 */}
                          <div className="rounded-xl border bg-white p-4 space-y-3 shadow-xs" style={{ borderColor: "var(--border-color)" }}>
                            <div>
                              <span className="text-[10px] font-bold uppercase tracking-wider text-brand-400">
                                1. Target Page / URL
                              </span>
                              <div className="mt-1 flex items-center gap-2">
                                <span className="rounded bg-brand-100 px-2 py-0.5 font-mono text-[11px] font-semibold text-brand-800">
                                  {item.targetPlacement.recommendedAction === "CREATE_NEW_PAGE" ? "Create New Page" : "Upgrade Existing"}
                                </span>
                                <span className="font-mono text-[12px] text-brand-900 font-semibold truncate">
                                  {item.targetPlacement.targetUrl}
                                </span>
                              </div>
                            </div>

                            <div>
                              <span className="text-[10px] font-bold uppercase tracking-wider text-brand-400">
                                2. Recommended H1 Heading
                              </span>
                              <div className="mt-1 rounded-lg bg-brand-50/70 p-2.5 text-[12px] font-semibold text-brand-950 border" style={{ borderColor: "var(--border-color)" }}>
                                {item.targetPlacement.h1Heading}
                              </div>
                            </div>

                            <div>
                              <span className="text-[10px] font-bold uppercase tracking-wider text-brand-400">
                                3. SEO Title & Meta Description
                              </span>
                              <div className="mt-1 space-y-1.5 text-[11px]">
                                <div className="text-brand-900 font-semibold">
                                  Title Tag: <span className="font-normal text-brand-700">{item.targetPlacement.seoTitle}</span>
                                </div>
                                <div className="text-brand-900 font-semibold">
                                  Meta Snippet: <span className="font-normal text-brand-600">{item.targetPlacement.metaDescription}</span>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Subheadings, Intro Copy & Internal Anchors */}
                          <div className="rounded-xl border bg-white p-4 space-y-3 shadow-xs" style={{ borderColor: "var(--border-color)" }}>
                            <div>
                              <span className="text-[10px] font-bold uppercase tracking-wider text-brand-400">
                                4. H2 Section Subheadings
                              </span>
                              <ul className="mt-1 space-y-1 text-[11px] text-brand-700">
                                {item.targetPlacement.h2Subheadings.map((h2, idx) => (
                                  <li key={idx} className="flex items-start gap-1.5">
                                    <span className="font-mono text-brand-400">{idx + 1}.</span>
                                    <span>{h2}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>

                            <div>
                              <span className="text-[10px] font-bold uppercase tracking-wider text-brand-400">
                                5. First 100-Word Intro Context
                              </span>
                              <p className="mt-1 rounded-lg bg-brand-50/60 p-2 text-[11px] leading-relaxed text-brand-700 italic border" style={{ borderColor: "var(--border-color)" }}>
                                &quot;{item.targetPlacement.introParagraphSnippet}&quot;
                              </p>
                            </div>

                            <div>
                              <span className="text-[10px] font-bold uppercase tracking-wider text-brand-400">
                                6. Internal Anchor Link Suggestions
                              </span>
                              <ul className="mt-1 space-y-1 text-[11px] text-brand-600">
                                {item.targetPlacement.internalAnchorSuggestions.map((anc, idx) => (
                                  <li key={idx} className="flex items-center gap-1.5">
                                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                                    <span>{anc}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            /* ── Dedicated Full Placement Blueprints View ───────────────────── */
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              {filteredComparisons.map((item) => {
                const isCopied = copiedKeyword === item.keyword;

                return (
                  <div
                    key={item.keyword}
                    className="flex flex-col justify-between rounded-2xl border bg-white p-5 shadow-sm transition hover:shadow-md"
                    style={{ borderColor: "var(--border-color)" }}
                  >
                    <div className="space-y-4">
                      {/* Top Header */}
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[15px] font-bold text-brand-950">
                              {titleCase(item.keyword)}
                            </span>
                            <span className="rounded bg-brand-100 px-1.5 py-0.5 text-[10px] font-semibold text-brand-800 font-mono">
                              {item.intent}
                            </span>
                          </div>
                          <div className="mt-1 flex items-center gap-2 text-[11px] text-brand-500">
                            <span>Competitor Frequency: <strong>{item.competitorProfile?.totalOccurrences || 0} pages</strong></span>
                            <span>•</span>
                            <span>Your Frequency: <strong>{item.ourProfile?.totalOccurrences || 0} pages</strong></span>
                          </div>
                        </div>

                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                            item.status === "MISSING_OPPORTUNITY"
                              ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                              : item.status === "SHARED_BATTLEFIELD"
                              ? "bg-blue-50 text-blue-700 border border-blue-200"
                              : "bg-purple-50 text-purple-700 border border-purple-200"
                          }`}
                        >
                          {item.status === "MISSING_OPPORTUNITY"
                            ? "Rank Gap"
                            : item.status === "SHARED_BATTLEFIELD"
                            ? "Shared"
                            : "Your Strength"}
                        </span>
                      </div>

                      {/* Where to Place Details */}
                      <div className="space-y-2 rounded-xl bg-brand-50/50 p-3.5 text-[12px] border" style={{ borderColor: "var(--border-color)" }}>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-brand-400">Target Page</span>
                          <span className="rounded bg-white px-2 py-0.5 font-mono text-[10px] font-semibold text-brand-800 border" style={{ borderColor: "var(--border-color)" }}>
                            {item.targetPlacement.recommendedAction === "CREATE_NEW_PAGE" ? "New Standalone Page" : "Expand Existing"}
                          </span>
                        </div>
                        <div className="font-mono text-[11px] font-semibold text-brand-950 truncate">
                          {item.targetPlacement.targetUrl}
                        </div>

                        <div className="pt-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-brand-400">Recommended H1 Heading</span>
                          <p className="mt-0.5 font-semibold text-brand-950 leading-snug">
                            {item.targetPlacement.h1Heading}
                          </p>
                        </div>

                        <div className="pt-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-brand-400">H2 Subheadings Outline</span>
                          <ul className="mt-1 space-y-1 text-[11px] text-brand-700">
                            {item.targetPlacement.h2Subheadings.slice(0, 2).map((h2, i) => (
                              <li key={i} className="flex items-center gap-1.5">
                                <div className="h-1 w-1 rounded-full bg-brand-400" />
                                <span className="truncate">{h2}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>

                    {/* Bottom Action: Copy Blueprint */}
                    <div className="mt-4 pt-3 border-t flex items-center justify-between" style={{ borderColor: "var(--border-color)" }}>
                      <span className="text-[11px] font-semibold text-emerald-800">
                        {item.rankPotential} Rank Potential
                      </span>
                      <button
                        onClick={() => copyBlueprintToClipboard(item)}
                        className="flex items-center gap-1.5 rounded-xl bg-brand-950 px-3.5 py-1.5 text-[11px] font-semibold text-white transition hover:bg-brand-800"
                      >
                        {isCopied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                        <span>{isCopied ? "Copied!" : "Copy Blueprint"}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
