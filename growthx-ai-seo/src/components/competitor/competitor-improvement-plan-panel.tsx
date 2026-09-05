"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useQuery, useQueries, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Calendar,
  CheckCircle2,
  Circle,
  Clock,
  Copy,
  Check,
  Sparkles,
  TrendingUp,
  Target,
  ArrowRight,
  Layers,
  Globe,
  Shield,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Filter,
  ExternalLink,
  Zap,
  Hash,
  Compass,
  HelpCircle,
  FileText,
  Flame,
  Award,
  ListTodo,
} from "lucide-react";
import { api, CoverageOpportunity } from "@/lib/api-client";
import { useLatestCrawl, useCrawlPages } from "@/hooks/use-growthx";
import { LoadingState, TruthfulState } from "@/components/ui/truthful-state";

interface TrackedCompetitorInfo {
  id: string;
  label?: string | null;
  domain: string;
  name?: string | null;
  websiteId?: string | null;
  [key: string]: any;
}

interface CompetitorImprovementPlanPanelProps {
  projectId: string;
  customerDomain: string;
  competitors: TrackedCompetitorInfo[];
}

export interface RoadmapTask {
  id: string;
  week: 1 | 2 | 3 | 4;
  weekLabel: string;
  title: string;
  description: string;
  priority: "P1_CRITICAL" | "P2_HIGH" | "P3_QUICK_WIN";
  category: "TECHNICAL" | "PAGES" | "KEYWORDS" | "AUTHORITY";
  competitorDomain?: string;
  competitorAdvantage?: string;
  actionUrl?: string;
  estimatedHours: number;
  tags: string[];
}

export interface CompetitorAdvantageProfile {
  competitorId: string;
  domain: string;
  name: string;
  keyStrength: string;
  strengthMetric: string;
  ourVulnerability: string;
  counterStrategy: string;
}

/** Stopwords for keyword extraction */
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

function extractWords(text: string | null | undefined): string[] {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter((w) => w.length > 2 && !STOPWORDS.has(w) && !/^\d+$/.test(w));
}

function titleCase(str: string): string {
  return str
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function CompetitorImprovementPlanPanel({
  projectId,
  customerDomain,
  competitors,
}: CompetitorImprovementPlanPanelProps) {
  const queryClient = useQueryClient();

  // 1. Fetch Tab 2 Comparison Benchmarks
  const websiteCmpQuery = useQuery({
    queryKey: ["website-comparison", projectId],
    queryFn: () => api.actionEngineWebsiteComparison(projectId),
    enabled: Boolean(projectId),
  });

  // 2. Fetch Tab 3 Opportunities across all competitors
  const oppQueries = useQueries({
    queries: competitors.map((comp) => ({
      queryKey: ["competitor-opportunities", projectId, comp.id],
      queryFn: () => api.competitorOpportunities(projectId, comp.id),
      enabled: Boolean(projectId && comp.id),
      staleTime: 60000,
    })),
  });

  // 3. Fetch Tab 4 Our crawl pages and competitor pages
  const ourCrawl = useLatestCrawl(customerDomain || null);
  const ourPagesQuery = useCrawlPages(ourCrawl.data?.id ?? null, ourCrawl.data?.status);

  const competitorPagesQueries = useQueries({
    queries: competitors.map((comp) => ({
      queryKey: ["competitor-pages", projectId, comp.id],
      queryFn: () => api.listCompetitorPages(projectId, comp.id),
      enabled: Boolean(projectId && comp.id),
      staleTime: 60000,
    })),
  });

  // Completed tasks state stored in localStorage per project
  const storageKey = `growthx_improvement_plan_${projectId}`;
  const [completedTaskIds, setCompletedTaskIds] = useState<string[]>([]);
  const [isLoadedFromStorage, setIsLoadedFromStorage] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        setCompletedTaskIds(JSON.parse(saved));
      }
    } catch {
      // Ignore storage read error
    }
    setIsLoadedFromStorage(true);
  }, [storageKey]);

  const toggleTask = (taskId: string) => {
    setCompletedTaskIds((prev) => {
      const next = prev.includes(taskId) ? prev.filter((id) => id !== taskId) : [...prev, taskId];
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // Ignore storage write error
      }
      return next;
    });
  };

  // Filter states
  const [selectedWeekFilter, setSelectedWeekFilter] = useState<"ALL" | 1 | 2 | 3 | 4>("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "INCOMPLETE" | "COMPLETED">("ALL");
  const [copiedPlan, setCopiedPlan] = useState(false);

  // ── SYNTHESIS ENGINE ───────────────────────────────────────────────────────

  // A. Diagnose Where Each Competitor Leads & Our Counter Strategy
  const competitorProfiles = useMemo<CompetitorAdvantageProfile[]>(() => {
    const list: CompetitorAdvantageProfile[] = [];
    const cmpData = websiteCmpQuery.data;

    competitors.forEach((comp, idx) => {
      const oppData = oppQueries[idx]?.data;
      const pages = competitorPagesQueries[idx]?.data || [];

      // Look at comparison rows for this competitor
      let bestRowLabel = "Crawl Depth & Content Breadth";
      let maxLead = 0;

      if (cmpData?.rows) {
        cmpData.rows.forEach((row) => {
          const compVal = row.competitors.find((c) => c.id === comp.id)?.value;
          const ourVal = row.you;
          if (compVal != null && ourVal != null && compVal > ourVal) {
            const diff = compVal - ourVal;
            if (diff > maxLead) {
              maxLead = diff;
              bestRowLabel = row.label;
            }
          }
        });
      }

      // Check page types
      const servicePages = pages.filter((p) => (p.pageType || "").toUpperCase() === "SERVICE").length;
      const productPages = pages.filter((p) => (p.pageType || "").toUpperCase() === "PRODUCT").length;
      const faqPages = pages.filter((p) => (p.pageType || "").toUpperCase() === "FAQ").length;

      let keyStrength = "Broad Organic Indexation";
      let strengthMetric = `${pages.length} crawled pages`;
      let ourVulnerability = "Lower overall topical volume";
      let counterStrategy = "Deploy targeted commercial landing pages and structured JSON-LD data.";

      if (servicePages >= 5) {
        keyStrength = "Commercial Service Landing Pages";
        strengthMetric = `${servicePages} dedicated service offerings`;
        ourVulnerability = "Under-indexing on high-intent buyer services";
        counterStrategy = `Launch dedicated standalone service pages to capture searches where ${comp.domain} currently ranks alone.`;
      } else if (productPages >= 5) {
        keyStrength = "Deep Product Catalog & Technical Specs";
        strengthMetric = `${productPages} technical product specs`;
        ourVulnerability = "Missing granular specification and grade tables";
        counterStrategy = `Publish detailed product specifications with Schema markup to out-rank ${comp.domain}.`;
      } else if (faqPages >= 2 || oppData?.total) {
        keyStrength = "Pre-Purchase FAQ & Voice Search Coverage";
        strengthMetric = `${oppData?.total || 3} content gap topics identified`;
        ourVulnerability = "Competitor captures conversational search and rich snippets";
        counterStrategy = `Add rich FAQ schema blocks and answer clusters matching ${comp.domain}'s user intent.`;
      }

      list.push({
        competitorId: comp.id,
        domain: comp.domain,
        name: comp.label || comp.name || comp.domain,
        keyStrength,
        strengthMetric,
        ourVulnerability,
        counterStrategy,
      });
    });

    return list;
  }, [competitors, websiteCmpQuery.data, oppQueries, competitorPagesQueries]);

  // B. Generate the 30-Day Phased Roadmap Tasks
  const roadmapTasks = useMemo<RoadmapTask[]>(() => {
    const tasks: RoadmapTask[] = [];

    // ── WEEK 1: Critical Foundation & Quick-Win Technical Gaps ───────────────
    tasks.push({
      id: "w1-schema-parity",
      week: 1,
      weekLabel: "Week 1: Days 1–7",
      title: "Deploy Missing JSON-LD Structured Data on Core Pages",
      description:
        "Implement Organization, WebSite, and LocalBusiness/Service schema on your homepage and top navigation routes to achieve technical parity with competitors who index rich search snippets.",
      priority: "P1_CRITICAL",
      category: "TECHNICAL",
      competitorDomain: competitors[0]?.domain,
      competitorAdvantage: "Competitors feature verified structured data across crawlable URLs",
      estimatedHours: 4,
      tags: ["Schema JSON-LD", "Rich Snippets", "Technical SEO"],
    });

    tasks.push({
      id: "w1-meta-h1-optimization",
      week: 1,
      weekLabel: "Week 1: Days 1–7",
      title: "Optimize Existing H1s and Meta Titles on High-Traffic Pages",
      description:
        "Inject target commercial keywords into your primary H1 headings and meta titles. Ensure brand suffixes and high-converting commercial descriptors ('Services', 'Solutions', 'Supplier') are present.",
      priority: "P2_HIGH",
      category: "KEYWORDS",
      competitorDomain: competitors[0]?.domain,
      competitorAdvantage: "Competitors place high-intent keywords directly in their H1 tags",
      estimatedHours: 3,
      tags: ["On-Page SEO", "Title Tags", "H1 Optimization"],
    });

    tasks.push({
      id: "w1-faq-quick-wins",
      week: 1,
      weekLabel: "Week 1: Days 1–7",
      title: "Add FAQ Accordion Modules with FAQPage Schema",
      description:
        "Incorporate 4-5 high-intent pre-purchase Q&A pairs directly onto your main solutions pages to capture voice search and AI search citations (ChatGPT, Gemini, Google Overviews).",
      priority: "P3_QUICK_WIN",
      category: "TECHNICAL",
      estimatedHours: 2,
      tags: ["FAQPage Schema", "AI Overviews", "Voice Search"],
    });

    // ── WEEK 2: High-Impact Service & Product Catalog Expansion ─────────────
    // Pull specific missing opportunities from Tab 3
    let addedOppCount = 0;
    competitors.forEach((comp, compIdx) => {
      const oppData = oppQueries[compIdx]?.data;
      if (!oppData?.opportunities) return;

      oppData.opportunities.slice(0, 2).forEach((item: CoverageOpportunity, itemIdx: number) => {
        if (addedOppCount >= 4) return;
        addedOppCount++;

        const pType = (item.pageType || "SERVICE").toUpperCase();
        const pageWords = extractWords(item.title || item.url);
        const topic = pageWords.slice(0, 3).map(titleCase).join(" ") || "Commercial Solutions";

        tasks.push({
          id: `w2-page-opp-${comp.id}-${itemIdx}`,
          week: 2,
          weekLabel: "Week 2: Days 8–14",
          title: `Publish Dedicated ${pType} Page: "${topic}"`,
          description: `Create a dedicated standalone ${pType.toLowerCase()} page at /${pType.toLowerCase()}s/${topic.toLowerCase().replace(/\s+/g, "-")} to close the competitive coverage gap. Include pricing/inquiry CTA and deliverables breakdown.`,
          priority: "P1_CRITICAL",
          category: "PAGES",
          competitorDomain: comp.domain,
          competitorAdvantage: `${comp.domain} actively covers "${item.title || item.url}"`,
          actionUrl: item.url,
          estimatedHours: 5,
          tags: [`${pType} Page`, "Coverage Gap", "Content Expansion"],
        });
      });
    });

    if (addedOppCount === 0) {
      tasks.push({
        id: "w2-fallback-service-page",
        week: 2,
        weekLabel: "Week 2: Days 8–14",
        title: "Publish 2 New Commercial Offering Pages with Specifications",
        description:
          "Expand your core service and product catalog by launching dedicated pages with technical tables, certifications, and procurement timelines to match competitors' page breadth.",
        priority: "P1_CRITICAL",
        category: "PAGES",
        competitorDomain: competitors[0]?.domain,
        competitorAdvantage: "Competitors maintain higher page count across service catalogs",
        estimatedHours: 6,
        tags: ["Catalog Depth", "New Landing Pages"],
      });
    }

    // ── WEEK 3: Keyword Supremacy & Topical Clustering ───────────────────────
    // Extract top keyword opportunities from Tab 4 crawled pages
    const ourPages = ourPagesQuery.data?.data || [];
    const ourWords = new Set(ourPages.flatMap((p: any) => extractWords(p.title || "")));

    let keywordTasksAdded = 0;
    competitors.forEach((comp, compIdx) => {
      const compPages = competitorPagesQueries[compIdx]?.data || [];
      const compWordCounts = new Map<string, number>();

      compPages.forEach((p: any) => {
        const words = extractWords(p.title);
        words.forEach((w) => {
          if (w.length >= 4 && !ourWords.has(w)) {
            compWordCounts.set(w, (compWordCounts.get(w) || 0) + 1);
          }
        });
      });

      const topGaps = Array.from(compWordCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2);

      topGaps.forEach(([word, count]) => {
        if (keywordTasksAdded >= 3) return;
        keywordTasksAdded++;

        const kw = titleCase(word);
        tasks.push({
          id: `w3-kw-opp-${comp.id}-${word}`,
          week: 3,
          weekLabel: "Week 3: Days 15–21",
          title: `Target Missing Keyword Gap: "${kw}"`,
          description: `Integrate "${kw}" across targeted page H1s, subheadings, and opening 100 words. ${comp.domain} targets this across ${count} crawled pages, giving them organic rank dominance.`,
          priority: "P1_CRITICAL",
          category: "KEYWORDS",
          competitorDomain: comp.domain,
          competitorAdvantage: `${comp.domain} optimizes "${kw}" across ${count} pages`,
          estimatedHours: 3,
          tags: ["Rank Gap", "Keyword Placement", "Content Clustering"],
        });
      });
    });

    tasks.push({
      id: "w3-secondary-clustering",
      week: 3,
      weekLabel: "Week 3: Days 15–21",
      title: "Deploy Topic Cluster Supporting Articles & Buyer Guides",
      description:
        "Draft 2 educational buyer guides answering common industry comparison questions. Anchor-link these guides directly to your newly created Week 2 commercial pages.",
      priority: "P2_HIGH",
      category: "KEYWORDS",
      estimatedHours: 4,
      tags: ["Topic Clusters", "Supporting Guides", "Topical Authority"],
    });

    // ── WEEK 4: Internal Silo Linking, Authority & Validation ────────────────
    tasks.push({
      id: "w4-internal-linking-silo",
      week: 4,
      weekLabel: "Week 4: Days 22–30",
      title: "Build Structured Internal Linking Network & Breadcrumb Navigation",
      description:
        "Establish hierarchical internal linking from your homepage and navigation menus to all newly published pages. Ensure exact-match commercial anchors are used rather than generic 'click here' links.",
      priority: "P1_CRITICAL",
      category: "AUTHORITY",
      estimatedHours: 3,
      tags: ["Internal Linking", "PageRank Siloing", "Anchor Text"],
    });

    tasks.push({
      id: "w4-sitemap-reindex",
      week: 4,
      weekLabel: "Week 4: Days 22–30",
      title: "Submit Updated XML Sitemap to Google Search Console",
      description:
        "Verify your XML sitemap includes all newly launched pages, contains clean canonical URLs with 200 HTTP status codes, and request indexation in Search Console.",
      priority: "P2_HIGH",
      category: "TECHNICAL",
      estimatedHours: 1,
      tags: ["XML Sitemap", "Search Console", "Re-Indexation"],
    });

    tasks.push({
      id: "w4-recrawl-benchmark",
      week: 4,
      weekLabel: "Week 4: Days 22–30",
      title: "Run 30-Day GrowthX Crawl & Benchmark Re-Assessment",
      description:
        "Trigger a fresh crawl sync in GrowthX to recalculate comparison benchmarks, score improvements, and verify that your pages and keyword counts now match or exceed your competitors.",
      priority: "P3_QUICK_WIN",
      category: "AUTHORITY",
      estimatedHours: 1,
      tags: ["Crawl Re-Assessment", "Score Validation", "Competitive Win"],
    });

    return tasks;
  }, [competitors, oppQueries, ourPagesQuery.data, competitorPagesQueries]);

  // Filtered tasks
  const filteredTasks = useMemo(() => {
    return roadmapTasks.filter((task) => {
      if (selectedWeekFilter !== "ALL" && task.week !== selectedWeekFilter) return false;
      const isCompleted = completedTaskIds.includes(task.id);
      if (statusFilter === "INCOMPLETE" && isCompleted) return false;
      if (statusFilter === "COMPLETED" && !isCompleted) return false;
      return true;
    });
  }, [roadmapTasks, selectedWeekFilter, statusFilter, completedTaskIds]);

  // Completion calculation
  const totalTasks = roadmapTasks.length;
  const completedCount = completedTaskIds.filter((id) => roadmapTasks.some((t) => t.id === id)).length;
  const completionPct = totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0;

  // Copy full 30-day plan to clipboard
  const copyPlanToClipboard = () => {
    const weeks = [1, 2, 3, 4] as const;
    let markdown = `# 30-Day Competitor SEO Domination Roadmap
Goal: Outrank and leapfrog ${competitors.map((c) => c.domain).join(", ")} in organic search within 30 days.

## Executive Competitive Summary
${competitorProfiles
  .map(
    (p) =>
      `### Competitor: ${p.domain}
- Key Advantage: ${p.keyStrength} (${p.strengthMetric})
- Our Vulnerability: ${p.ourVulnerability}
- Counter-Strategy: ${p.counterStrategy}
`
  )
  .join("\n")}

## 30-Day Actionable Sprint Checklist
`;

    weeks.forEach((w) => {
      const wTasks = roadmapTasks.filter((t) => t.week === w);
      markdown += `\n### Week ${w}: Days ${(w - 1) * 7 + 1}–${w * 7}\n`;
      wTasks.forEach((t) => {
        const done = completedTaskIds.includes(t.id) ? "[x]" : "[ ]";
        markdown += `- ${done} **${t.title}** (${t.priority}, ~${t.estimatedHours}h)\n  ${t.description}\n`;
      });
    });

    navigator.clipboard.writeText(markdown);
    setCopiedPlan(true);
    setTimeout(() => setCopiedPlan(false), 2500);
  };

  const resetProgress = () => {
    if (confirm("Reset your 30-day to-do list progress?")) {
      setCompletedTaskIds([]);
      try {
        localStorage.removeItem(storageKey);
      } catch {}
    }
  };

  if (!competitors.length) {
    return (
      <TruthfulState
        icon={Globe}
        title="No Competitors Tracked"
        missing="Add competitors in the 'Find Competitors' tab to generate a synthesized 30-day SEO roadmap."
      />
    );
  }

  const isLoading = websiteCmpQuery.isLoading;

  return (
    <div className="space-y-6">
      {/* 1. Header Strategic Agenda Banner */}
      <div className="rounded-2xl border bg-white p-6 shadow-sm" style={{ borderColor: "var(--border-color)" }}>
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-950 text-white shadow-sm">
                <Flame size={18} className="text-amber-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-[18px] font-bold tracking-tight text-brand-950">
                    30-Day Competitor SEO Domination Plan
                  </h2>
                  <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-800 border border-emerald-200">
                    Active Roadmap
                  </span>
                </div>
                <p className="text-[12px] text-brand-500">
                  Synthesizing data from Benchmarks, Page Opportunities, and Keyword Gaps into a step-by-step roadmap to outrank your rivals.
                </p>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={copyPlanToClipboard}
              className="flex items-center gap-1.5 rounded-xl border bg-white px-3.5 py-2 text-[12px] font-semibold text-brand-900 shadow-sm transition hover:bg-brand-50"
              style={{ borderColor: "var(--border-color)" }}
            >
              {copiedPlan ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
              <span>{copiedPlan ? "Copied Roadmap!" : "Copy 30-Day Plan (Markdown)"}</span>
            </button>

            {completedCount > 0 && (
              <button
                onClick={resetProgress}
                className="rounded-xl border bg-brand-50/50 px-3 py-2 text-[11px] font-medium text-brand-600 transition hover:bg-brand-100"
                style={{ borderColor: "var(--border-color)" }}
              >
                Reset Progress
              </button>
            )}
          </div>
        </div>

        {/* Progress Bar & Key Metric Highlights */}
        <div className="mt-6 rounded-xl border bg-brand-50/50 p-4" style={{ borderColor: "var(--border-color)" }}>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <ListTodo size={16} className="text-brand-700" />
              <span className="text-[13px] font-bold text-brand-950">
                Sprint Execution Progress: {completedCount} of {totalTasks} Tasks Done
              </span>
            </div>
            <span className="font-mono text-[13px] font-bold text-emerald-800">
              {completionPct}% Complete
            </span>
          </div>

          <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-brand-200/60">
            <div
              className="h-full rounded-full bg-emerald-600 transition-all duration-500 ease-out"
              style={{ width: `${completionPct}%` }}
            />
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-4 text-[11px] text-brand-600">
            <span>🎯 <strong>Primary Objective:</strong> Overtake competitors in organic crawl volume and search rankings</span>
            <span>•</span>
            <span>⚡ <strong>Target Horizon:</strong> 4 Weeks (Next 30 Days)</span>
          </div>
        </div>
      </div>

      {/* 2. Cross-Competitor Diagnostic ("Where A Leads vs Where B Leads") */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <Award size={16} className="text-brand-950" />
            <h3 className="text-[14px] font-bold text-brand-950">
              Cross-Competitor Intelligence Diagnosis
            </h3>
          </div>
          <span className="text-[11px] text-brand-400">
            Synthesized across Benchmarks, Opportunities & Keywords
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {competitorProfiles.map((prof) => (
            <div
              key={prof.competitorId}
              className="rounded-2xl border bg-white p-5 shadow-sm space-y-3 transition hover:shadow-md"
              style={{ borderColor: "var(--border-color)" }}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-1.5">
                    <Globe size={13} className="text-brand-500" />
                    <span className="text-[13px] font-bold text-brand-950 truncate">{prof.name}</span>
                  </div>
                  <span className="font-mono text-[11px] text-brand-400">{prof.domain}</span>
                </div>
                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-800 border border-amber-200">
                  Rival Profile
                </span>
              </div>

              <div className="space-y-2 text-[12px]">
                <div className="rounded-lg bg-brand-50/70 p-2.5 border" style={{ borderColor: "var(--border-color)" }}>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-brand-400">
                    Where They Lead You
                  </span>
                  <div className="mt-0.5 font-bold text-brand-900">{prof.keyStrength}</div>
                  <p className="text-[11px] text-brand-500 mt-0.5">{prof.strengthMetric}</p>
                </div>

                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-brand-400">
                    Your Vulnerability
                  </span>
                  <p className="text-[11px] text-rose-700 font-medium mt-0.5">{prof.ourVulnerability}</p>
                </div>

                <div className="border-t pt-2" style={{ borderColor: "var(--border-color)" }}>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                    30-Day Counter-Strategy
                  </span>
                  <p className="text-[11px] text-brand-700 leading-relaxed mt-0.5">
                    {prof.counterStrategy}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 3. Actionable To-Do List by Sprint Week */}
      <div className="space-y-4">
        {/* Controls / Filter Bar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setSelectedWeekFilter("ALL")}
              className={`rounded-xl px-3.5 py-1.5 text-[12px] font-semibold transition ${
                selectedWeekFilter === "ALL"
                  ? "bg-brand-950 text-white shadow-sm"
                  : "bg-white border text-brand-700 hover:bg-brand-50"
              }`}
              style={selectedWeekFilter !== "ALL" ? { borderColor: "var(--border-color)" } : {}}
            >
              All Weeks ({roadmapTasks.length})
            </button>
            <button
              onClick={() => setSelectedWeekFilter(1)}
              className={`rounded-xl px-3.5 py-1.5 text-[12px] font-semibold transition ${
                selectedWeekFilter === 1
                  ? "bg-brand-950 text-white shadow-sm"
                  : "bg-white border text-brand-700 hover:bg-brand-50"
              }`}
              style={selectedWeekFilter !== 1 ? { borderColor: "var(--border-color)" } : {}}
            >
              Week 1: Foundation
            </button>
            <button
              onClick={() => setSelectedWeekFilter(2)}
              className={`rounded-xl px-3.5 py-1.5 text-[12px] font-semibold transition ${
                selectedWeekFilter === 2
                  ? "bg-brand-950 text-white shadow-sm"
                  : "bg-white border text-brand-700 hover:bg-brand-50"
              }`}
              style={selectedWeekFilter !== 2 ? { borderColor: "var(--border-color)" } : {}}
            >
              Week 2: Pages
            </button>
            <button
              onClick={() => setSelectedWeekFilter(3)}
              className={`rounded-xl px-3.5 py-1.5 text-[12px] font-semibold transition ${
                selectedWeekFilter === 3
                  ? "bg-brand-950 text-white shadow-sm"
                  : "bg-white border text-brand-700 hover:bg-brand-50"
              }`}
              style={selectedWeekFilter !== 3 ? { borderColor: "var(--border-color)" } : {}}
            >
              Week 3: Keywords
            </button>
            <button
              onClick={() => setSelectedWeekFilter(4)}
              className={`rounded-xl px-3.5 py-1.5 text-[12px] font-semibold transition ${
                selectedWeekFilter === 4
                  ? "bg-brand-950 text-white shadow-sm"
                  : "bg-white border text-brand-700 hover:bg-brand-50"
              }`}
              style={selectedWeekFilter !== 4 ? { borderColor: "var(--border-color)" } : {}}
            >
              Week 4: Authority
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[12px] text-brand-500 font-medium">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="rounded-xl border bg-white py-1.5 pl-3 pr-8 text-[12px] font-medium text-brand-900 shadow-sm focus:border-brand-950 focus:outline-none"
              style={{ borderColor: "var(--border-color)" }}
            >
              <option value="ALL">All Items</option>
              <option value="INCOMPLETE">To Do ({totalTasks - completedCount})</option>
              <option value="COMPLETED">Completed ({completedCount})</option>
            </select>
          </div>
        </div>

        {/* Task Cards List */}
        <div className="space-y-3">
          {filteredTasks.length === 0 ? (
            <div className="rounded-2xl border bg-white p-12 text-center shadow-sm" style={{ borderColor: "var(--border-color)" }}>
              <CheckCircle2 size={32} className="mx-auto text-emerald-600 mb-2" />
              <h4 className="text-[14px] font-bold text-brand-950">No tasks in this filter</h4>
              <p className="mt-1 text-[12px] text-brand-500">All tasks in this section have been completed or filtered out.</p>
            </div>
          ) : (
            filteredTasks.map((task) => {
              const isCompleted = completedTaskIds.includes(task.id);

              return (
                <div
                  key={task.id}
                  onClick={() => toggleTask(task.id)}
                  className={`group cursor-pointer rounded-2xl border bg-white p-5 transition hover:shadow-md ${
                    isCompleted ? "opacity-75 bg-brand-50/20" : ""
                  }`}
                  style={{ borderColor: "var(--border-color)" }}
                >
                  <div className="flex items-start gap-4">
                    {/* Interactive Checkbox */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleTask(task.id);
                      }}
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition ${
                        isCompleted
                          ? "border-emerald-600 bg-emerald-600 text-white"
                          : "border-brand-300 bg-white hover:border-brand-500"
                      }`}
                    >
                      {isCompleted && <Check size={13} strokeWidth={3} />}
                    </button>

                    {/* Task Content */}
                    <div className="flex-1 space-y-2">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`text-[14px] font-bold transition ${
                              isCompleted ? "text-brand-500 line-through" : "text-brand-950"
                            }`}
                          >
                            {task.title}
                          </span>
                          <span className="rounded bg-brand-100 px-2 py-0.5 font-mono text-[10px] font-semibold text-brand-800">
                            {task.weekLabel}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                              task.priority === "P1_CRITICAL"
                                ? "bg-rose-50 text-rose-700 border border-rose-200"
                                : task.priority === "P2_HIGH"
                                ? "bg-amber-50 text-amber-800 border border-amber-200"
                                : "bg-emerald-50 text-emerald-800 border border-emerald-200"
                            }`}
                          >
                            {task.priority === "P1_CRITICAL"
                              ? "P1 Critical"
                              : task.priority === "P2_HIGH"
                              ? "P2 High"
                              : "Quick Win"}
                          </span>

                          <span className="flex items-center gap-1 text-[11px] text-brand-400 font-medium">
                            <Clock size={12} />
                            ~{task.estimatedHours}h
                          </span>
                        </div>
                      </div>

                      <p className={`text-[12px] leading-relaxed ${isCompleted ? "text-brand-400" : "text-brand-600"}`}>
                        {task.description}
                      </p>

                      {/* Grounded Competitor Justification & Tags */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t text-[11px]" style={{ borderColor: "var(--border-color)" }}>
                        {task.competitorAdvantage ? (
                          <div className="flex items-center gap-1.5 text-brand-500">
                            <Target size={12} className="text-brand-400" />
                            <span>Target: <strong className="text-brand-700">{task.competitorAdvantage}</strong></span>
                          </div>
                        ) : (
                          <div />
                        )}

                        <div className="flex flex-wrap items-center gap-1.5">
                          {task.tags.map((tag, idx) => (
                            <span key={idx} className="rounded bg-brand-50 px-2 py-0.5 text-[10px] text-brand-600 border" style={{ borderColor: "var(--border-color)" }}>
                              #{tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
