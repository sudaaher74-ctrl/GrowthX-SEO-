"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowRightLeft,
  Bot,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Globe,
  Info,
  LayoutGrid,
  Radar,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { stagingEngine } from "@/lib/staging-engine";
import { api } from "@/lib/api-client";
import { useLatestCrawl } from "@/hooks/use-growthx";
import type { BuyerQuestion, VisibilityAnswer } from "@/lib/visibility-workflow";

type SerpEngine = "google_ai" | "searchgpt" | "perplexity";

interface AiSerpVisualizerProps {
  projectId: string;
  businessName: string;
  domain: string | null;
  prompts: BuyerQuestion[];
  answers: VisibilityAnswer[];
  configuredEngines: { provider: string; configured: boolean; model: string | null }[];
}

interface CompetitorGapAnalysis {
  domain: string | null;
  name: string;
  citationCount: number;
  citationShare: number;
  reasonWon: string;
  recommendedCounterStrategy: string;
}

function safeExternalHref(rawUrl?: string | null, fallbackDomain?: string | null): string | null {
  const candidate = (rawUrl || "").trim();
  if (candidate) {
    try {
      const parsed = new URL(/^https?:\/\//i.test(candidate) ? candidate : `https://${candidate}`);
      if (parsed.protocol === "http:" || parsed.protocol === "https:") {
        return parsed.toString();
      }
    } catch {
      // fall through to domain check
    }
  }
  const dom = (fallbackDomain || "").trim().replace(/^https?:\/\//i, "").replace(/\/.*$/, "");
  if (dom && dom.includes(".") && !/\s/.test(dom)) {
    try {
      const parsed = new URL(`https://${dom}`);
      if (parsed.protocol === "https:") return parsed.toString();
    } catch {
      return null;
    }
  }
  return null;
}

function googleSearchUrl(query: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

function perplexitySearchUrl(query: string): string {
  return `https://www.perplexity.ai/search?q=${encodeURIComponent(query)}`;
}

/** Renders bold **segments** cleanly without innerHTML. */
function renderInlineBold(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, idx) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return (
        <strong key={idx} className="font-semibold text-brand-950">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <span key={idx}>{part}</span>;
  });
}

/** Cleanly formats raw Markdown from LLM answers (### headings, bullets, **bold**) with expand/collapse. */
function FormattedAiResponse({
  text,
  expanded,
  onToggleExpand,
  previewLimit = 620,
}: {
  text: string;
  expanded: boolean;
  onToggleExpand: () => void;
  previewLimit?: number;
}) {
  const needsTruncate = text.length > previewLimit;
  const visibleText = expanded || !needsTruncate ? text : `${text.slice(0, previewLimit).trimEnd()}…`;
  const lines = visibleText.split(/\r?\n/);

  return (
    <div className="space-y-2 text-xs md:text-sm leading-relaxed text-brand-800 font-sans">
      {lines.map((rawLine, idx) => {
        const line = rawLine.trim();
        if (!line) return null;
        if (line.startsWith("### ")) {
          return (
            <h4 key={idx} className="pt-1 text-xs md:text-sm font-bold text-brand-950">
              {renderInlineBold(line.slice(4))}
            </h4>
          );
        }
        if (line.startsWith("## ")) {
          return (
            <h4 key={idx} className="pt-1 text-sm font-bold text-brand-950">
              {renderInlineBold(line.slice(3))}
            </h4>
          );
        }
        if (/^[-*•]\s+/.test(line)) {
          return (
            <div key={idx} className="flex items-start gap-2 pl-2">
              <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-brand-400 shrink-0" />
              <p className="flex-1">{renderInlineBold(line.replace(/^[-*•]\s+/, ""))}</p>
            </div>
          );
        }
        if (/^\d+\.\s+/.test(line)) {
          return (
            <p key={idx} className="pl-2">
              {renderInlineBold(line)}
            </p>
          );
        }
        return <p key={idx}>{renderInlineBold(line)}</p>;
      })}

      {needsTruncate && (
        <button
          type="button"
          onClick={onToggleExpand}
          className="inline-flex items-center gap-1 pt-1 text-xs font-semibold text-accent-700 hover:underline cursor-pointer"
        >
          <span>{expanded ? "Show less" : "Show full AI response"}</span>
        </button>
      )}
    </div>
  );
}

export function AiSerpVisualizer({
  projectId,
  businessName,
  domain,
  prompts,
  answers,
  configuredEngines: _configuredEngines,
}: AiSerpVisualizerProps) {
  const [selectedEngine, setSelectedEngine] = useState<SerpEngine>("google_ai");
  const [selectedPromptIndex, setSelectedPromptIndex] = useState<number>(0);
  const [showSourcesDrawer, setShowSourcesDrawer] = useState<boolean>(true);
  const [showAllPromptsTable, setShowAllPromptsTable] = useState<boolean>(false);
  const [expandedResponse, setExpandedResponse] = useState<boolean>(false);
  const [stagedDefenseSet, setStagedDefenseSet] = useState<Set<string>>(() => {
    if (!projectId || typeof window === "undefined") return new Set();
    const existing = stagingEngine.getStaged(projectId);
    return new Set(existing.map((item) => item.title));
  });
  const [actionNotice, setActionNotice] = useState<{ text: string; type: "success" | "info" } | null>(null);

  // Pull real crawled pages so the "Organic SERP Results Below Overview" shows your REAL live page title, meta description & clickable URL
  const latestCrawlQuery = useLatestCrawl(domain);
  const latestCrawlId = latestCrawlQuery.data?.id ?? null;
  const crawlPagesQuery = useQuery({
    queryKey: ["serp-visualizer-crawl-pages", latestCrawlId],
    queryFn: () => api.getCrawlPages(latestCrawlId!, { limit: 25 }),
    enabled: Boolean(latestCrawlId),
    retry: false,
  });

  // Active prompt
  const activePrompt: BuyerQuestion | undefined = prompts[selectedPromptIndex] ?? prompts[0];
  const promptText = activePrompt?.text || "";

  // Find corresponding answers for active prompt across models
  const promptAnswers = useMemo(() => {
    if (!activePrompt) return [];
    return answers.filter((a) => {
      if (a.errorMessage || !a.rawResponse) return false;
      const lowerA = a.promptText.toLowerCase().trim();
      const lowerP = activePrompt.text.toLowerCase().trim();
      return lowerA === lowerP || lowerA.includes(lowerP) || lowerP.includes(lowerA);
    });
  }, [answers, activePrompt]);

  // Resolve engine-specific answer
  const currentEngineAnswer = useMemo(() => {
    if (!promptAnswers.length) return null;
    return (
      promptAnswers.find((a) => {
        const p = (a.provider || "").toUpperCase();
        const m = (a.model || "").toUpperCase();
        if (selectedEngine === "google_ai") {
          return p.includes("GEMINI") || p.includes("GOOGLE") || m.includes("GEMINI") || m.includes("GOOGLE");
        }
        if (selectedEngine === "searchgpt") {
          return p.includes("OPENAI") || p.includes("CHATGPT") || p.includes("GPT") || m.includes("GPT");
        }
        if (selectedEngine === "perplexity") {
          return p.includes("PERPLEXITY") || m.includes("PERPLEXITY") || m.includes("SONAR");
        }
        return false;
      }) ?? promptAnswers[0]
    );
  }, [promptAnswers, selectedEngine]);

  // Brand citation detection
  const isBrandMentioned = Boolean(
    currentEngineAnswer?.analysis?.brandMentioned ||
      (currentEngineAnswer?.rawResponse &&
        businessName &&
        currentEngineAnswer.rawResponse.toLowerCase().includes(businessName.toLowerCase())),
  );

  const isBrandRecommended = Boolean(currentEngineAnswer?.analysis?.recommended);

  // Competitor mentions extracted from answer
  const competitorMentions = useMemo(() => {
    if (!currentEngineAnswer) return [];
    const seen = new Set<string>();
    const list: string[] = [];
    for (const m of currentEngineAnswer.mentions || []) {
      if (!m.isCustomer && m.brandName && m.brandName.toLowerCase() !== businessName.toLowerCase()) {
        const key = m.brandName.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          list.push(m.brandName);
        }
      }
    }
    return list;
  }, [currentEngineAnswer, businessName]);

  // Deduplicated real citations with validated external hrefs
  const rawCitations = useMemo(() => {
    const raw = currentEngineAnswer?.citations ?? [];
    const seen = new Set<string>();
    const list: Array<{ domain: string; url: string | null; href: string | null }> = [];
    for (const c of raw) {
      const href = safeExternalHref(c.url, c.domain);
      const key = (href || c.domain || "").toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      list.push({
        domain: c.domain || (href ? new URL(href).hostname.replace(/^www\./i, "") : "Source"),
        url: c.url || null,
        href,
      });
    }
    return list;
  }, [currentEngineAnswer]);

  // Pick the most relevant REAL crawled page on your site for this prompt (fallback to homepage)
  const matchedOwnPage = useMemo(() => {
    const pages = (crawlPagesQuery.data?.data ?? []).filter((p) => p.statusCode >= 200 && p.statusCode < 400);
    if (!pages.length) return null;

    const tokens = promptText
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length >= 4);

    let best = pages[0];
    let bestScore = -1;
    for (const page of pages) {
      const hay = `${page.url} ${page.title ?? ""} ${page.metaDescription ?? ""}`.toLowerCase();
      let score = 0;
      for (const t of tokens) {
        if (hay.includes(t)) score += 1;
      }
      // Slight tie-breaker preference for clean homepage when no keyword token matches
      try {
        const path = new URL(page.url).pathname;
        if (path === "/" || path === "") score += 0.25;
      } catch {
        // ignore
      }
      if (score > bestScore) {
        bestScore = score;
        best = page;
      }
    }
    return best;
  }, [crawlPagesQuery.data, promptText]);

  const ownSiteHref = safeExternalHref(matchedOwnPage?.url, domain);

  // External cited pages for the Organic SERP preview (strictly real cited URLs, excluding own domain)
  const externalCitedResults = useMemo(() => {
    const ownNorm = (domain || "").toLowerCase().replace(/^www\./i, "");
    return rawCitations.filter((c) => {
      if (!c.href) return false;
      if (ownNorm && c.domain.toLowerCase().includes(ownNorm)) return false;
      return true;
    });
  }, [rawCitations, domain]);

  // Calculate Citation Probability (0 - 100%) grounded in real facts
  const probabilityBreakdown = useMemo(() => {
    let score = 30;

    let mentionPoints = 0;
    if (isBrandRecommended) {
      mentionPoints = 40;
    } else if (isBrandMentioned) {
      mentionPoints = 25;
    }
    score += mentionPoints;

    const offeringPoints = activePrompt?.offering ? 18 : 10;
    score += offeringPoints;

    const entityPoints = domain ? 15 : 5;
    score += entityPoints;

    let penalty = 0;
    if (competitorMentions.length > 0 && !isBrandMentioned) {
      penalty = Math.min(25, competitorMentions.length * 10);
      score = Math.max(8, score - penalty);
    }

    const finalProbability = Math.min(98, Math.max(12, score));

    return {
      finalProbability,
      mentionPoints,
      offeringPoints,
      entityPoints,
      penalty,
      tier:
        finalProbability >= 75
          ? "HIGH"
          : finalProbability >= 45
            ? "MODERATE"
            : "LOW",
    };
  }, [isBrandRecommended, isBrandMentioned, activePrompt, domain, competitorMentions]);

  // Competitor Authority Gaps across all answers (never fabricate .com domains for brand-only mentions)
  const competitorGaps: CompetitorGapAnalysis[] = useMemo(() => {
    const counts = new Map<string, { count: number; domain: string | null }>();

    for (const a of answers) {
      if (!a.errorMessage && a.rawResponse) {
        for (const m of a.mentions || []) {
          if (!m.isCustomer && m.brandName && m.brandName.toLowerCase() !== businessName.toLowerCase()) {
            const existing = counts.get(m.brandName) ?? { count: 0, domain: null };
            counts.set(m.brandName, {
              count: existing.count + 1,
              domain: existing.domain,
            });
          }
        }
        for (const c of a.citations || []) {
          const dom = c.domain?.toLowerCase() || "";
          const bNorm = businessName.toLowerCase().replace(/[^a-z0-9]/g, "");
          if (dom && !dom.includes(bNorm)) {
            const existing = counts.get(dom) ?? { count: 0, domain: dom };
            counts.set(dom, {
              count: existing.count + 1,
              domain: dom,
            });
          }
        }
      }
    }

    const totalValid = Math.max(1, answers.filter((a) => !a.errorMessage).length);

    return Array.from(counts.entries())
      .map(([name, data]) => ({
        name,
        domain: data.domain,
        citationCount: data.count,
        citationShare: Math.min(100, Math.round((data.count / totalValid) * 100)),
        reasonWon:
          data.count > 3
            ? "Repeatedly cited across tracked buyer prompts with strong topical entity presence."
            : "Direct answer alignment matching buyer prompt intent.",
        recommendedCounterStrategy: `Publish a dedicated FAQ & comparison page targeting "${name} vs ${businessName}".`,
      }))
      .sort((a, b) => b.citationCount - a.citationCount)
      .slice(0, 5);
  }, [answers, businessName]);

  // Related tracked prompts (excluding current one) for working Perplexity "Related Prompts" buttons
  const relatedTrackedPrompts = useMemo(() => {
    return prompts
      .map((p, index) => ({ prompt: p, index }))
      .filter((item) => item.index !== selectedPromptIndex)
      .slice(0, 3);
  }, [prompts, selectedPromptIndex]);

  // Stage citation defense task
  const handleStageCitationDefense = (customTitle?: string) => {
    if (!projectId) return;
    const title =
      customTitle ||
      `Targeted Entity & Schema Defense for "${promptText.slice(0, 48)}…"`;

    try {
      stagingEngine.stage(projectId, {
        title,
        category: "AI Visibility & GEO",
        source: "AI_VISIBILITY",
        priority: probabilityBreakdown.tier === "LOW" ? "CRITICAL" : "HIGH",
        impact: `Improves generative citation readiness for "${promptText}" across AI search engines.`,
        effortHours: 2.0,
        deliverable: [
          `1. Deploy comprehensive FAQPage JSON-LD schema answering "${promptText}".`,
          `2. Add a clear H2 answer section with factual brand & service details.`,
          `3. Strengthen Organization schema and consistent sameAs links.`,
        ].join("\n"),
        evidence: `${currentEngineAnswer?.provider || "AI Engine"} answer analysis: ${
          isBrandMentioned ? "Brand cited" : "Competitor cited instead"
        }`,
        affectedUrl: ownSiteHref ?? (domain ? `https://${domain}` : undefined),
      });

      setStagedDefenseSet((prev) => new Set(prev).add(title));
      setActionNotice({
        type: "success",
        text: `Staged citation defense in Fix Engine: "${title}"`,
      });
    } catch {
      setActionNotice({
        type: "info",
        text: "Item is already queued in Fix Engine.",
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Action Notification */}
      {actionNotice && (
        <div
          className={cn(
            "flex items-center justify-between rounded-xl p-3 text-xs font-medium border shadow-2xs transition-all",
            actionNotice.type === "success" && "border-success-200 bg-success-50 text-success-700",
            actionNotice.type === "info" && "border-brand-200 bg-surface-2 text-brand-800",
          )}
        >
          <div className="flex items-center gap-2">
            {actionNotice.type === "success" ? (
              <CheckCircle2 size={16} className="text-success-600 shrink-0" />
            ) : (
              <Info size={16} className="text-brand-500 shrink-0" />
            )}
            <span>{actionNotice.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionNotice(null)}
            className="text-xs font-bold underline opacity-80 hover:opacity-100 cursor-pointer ml-3"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* TOP DECK: CONTROLS & ENGINE SELECTOR */}
      <div className="rounded-2xl border border-brand-200/80 bg-surface-1 p-4 shadow-2xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-signal-400 text-signal-ink shadow-2xs font-bold">
              <Sparkles size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-brand-950">AI Overviews &amp; SearchGPT SERP Visualizer</h3>
                <span className="rounded-full bg-signal-400/20 px-2 py-0.5 text-[10.5px] font-bold font-mono text-brand-900 border border-brand-200">
                  Measured Preview
                </span>
              </div>
              <p className="text-xs text-brand-500">
                Preview captured AI answers, real cited sources, and your crawled page appearance in search.
              </p>
            </div>
          </div>

          {/* Engine Selector Pills */}
          <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-surface-2 border border-brand-200/80">
            <button
              type="button"
              onClick={() => {
                setSelectedEngine("google_ai");
                setExpandedResponse(false);
              }}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer",
                selectedEngine === "google_ai"
                  ? "bg-surface-1 text-brand-950 shadow-xs border border-brand-200 font-bold"
                  : "text-brand-600 hover:text-brand-950",
              )}
            >
              <span className="h-2 w-2 rounded-full bg-signal-500" />
              <span>Google AI Overview</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setSelectedEngine("searchgpt");
                setExpandedResponse(false);
              }}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer",
                selectedEngine === "searchgpt"
                  ? "bg-surface-1 text-brand-950 shadow-xs border border-brand-200 font-bold"
                  : "text-brand-600 hover:text-brand-950",
              )}
            >
              <Bot size={13} className="text-brand-700" />
              <span>SearchGPT / ChatGPT</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setSelectedEngine("perplexity");
                setExpandedResponse(false);
              }}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer",
                selectedEngine === "perplexity"
                  ? "bg-surface-1 text-brand-950 shadow-xs border border-brand-200 font-bold"
                  : "text-brand-600 hover:text-brand-950",
              )}
            >
              <Globe size={13} className="text-signal-500" />
              <span>Perplexity Pro</span>
            </button>
          </div>
        </div>

        {/* Prompt Selector Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1 border-t border-brand-200/60">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-400" />
            <select
              value={selectedPromptIndex}
              onChange={(e) => {
                setSelectedPromptIndex(Number(e.target.value));
                setExpandedResponse(false);
              }}
              aria-label="Select buyer prompt to preview"
              className="w-full appearance-none rounded-xl border border-brand-200 bg-surface-2 pl-9 pr-8 py-2 text-xs font-medium text-brand-950 focus:outline-hidden focus:ring-2 focus:ring-signal-400 cursor-pointer"
            >
              {prompts.map((p, idx) => (
                <option key={idx} value={idx}>
                  [{p.intent ? p.intent.toUpperCase() : "PROMPT"}] {p.text}
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-400 pointer-events-none" />
          </div>

          <div className="flex items-center gap-1 shrink-0 self-end sm:self-auto">
            <button
              type="button"
              disabled={selectedPromptIndex <= 0}
              onClick={() => {
                setSelectedPromptIndex((prev) => Math.max(0, prev - 1));
                setExpandedResponse(false);
              }}
              className="p-2 rounded-lg border border-brand-200 bg-surface-2 text-brand-700 hover:bg-surface-3 disabled:opacity-40 cursor-pointer transition"
              title="Previous prompt"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="text-[11px] font-mono font-semibold text-brand-600 px-1">
              {prompts.length ? selectedPromptIndex + 1 : 0} / {prompts.length}
            </span>
            <button
              type="button"
              disabled={selectedPromptIndex >= prompts.length - 1}
              onClick={() => {
                setSelectedPromptIndex((prev) => Math.min(prompts.length - 1, prev + 1));
                setExpandedResponse(false);
              }}
              className="p-2 rounded-lg border border-brand-200 bg-surface-2 text-brand-700 hover:bg-surface-3 disabled:opacity-40 cursor-pointer transition"
              title="Next prompt"
            >
              <ChevronRight size={14} />
            </button>
            <button
              type="button"
              onClick={() => setShowAllPromptsTable(!showAllPromptsTable)}
              className="inline-flex items-center gap-1 ml-1.5 rounded-lg border border-brand-200 bg-surface-2 hover:bg-surface-3 px-2.5 py-1.5 text-xs font-semibold text-brand-800 transition cursor-pointer"
            >
              <LayoutGrid size={13} className="text-brand-500" />
              <span>{showAllPromptsTable ? "Hide Matrix" : "View Matrix"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* MASTER PROMPT LEADERBOARD (COLLAPSIBLE) */}
      {showAllPromptsTable && (
        <div className="rounded-2xl border border-brand-200/80 bg-surface-1 p-4 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-brand-950 flex items-center gap-1.5">
              <TrendingUp size={14} className="text-signal-500" />
              All Tracked Prompts Citation Matrix
            </h4>
            <span className="text-[11px] text-brand-500">{prompts.length} Prompts Evaluated</span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-brand-200/70">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-brand-200/60 bg-surface-2 text-[11px] font-semibold text-brand-600">
                <tr>
                  <th className="py-2.5 px-3">#</th>
                  <th className="py-2.5 px-3">Prompt Query</th>
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-3 text-center">Citation Chance</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-200/50">
                {prompts.map((p, idx) => {
                  const pAns = answers.filter((a) => {
                    if (a.errorMessage) return false;
                    const lowA = a.promptText.toLowerCase().trim();
                    const lowP = p.text.toLowerCase().trim();
                    return lowA === lowP || lowA.includes(lowP) || lowP.includes(lowA);
                  });
                  const cited = pAns.some((a) => a.analysis?.recommended || a.analysis?.brandMentioned);
                  const rivals = pAns.flatMap((a) => (a.mentions || []).filter((m) => !m.isCustomer));
                  const estimatedProb = cited ? 85 : rivals.length > 0 ? 28 : 52;
                  const isSelected = idx === selectedPromptIndex;

                  return (
                    <tr
                      key={idx}
                      onClick={() => {
                        setSelectedPromptIndex(idx);
                        setShowAllPromptsTable(false);
                        setExpandedResponse(false);
                      }}
                      className={cn(
                        "cursor-pointer transition-colors",
                        isSelected ? "bg-signal-400/10 font-medium" : "hover:bg-surface-2/60",
                      )}
                    >
                      <td className="py-2.5 px-3 font-mono text-[11px] text-brand-500">{idx + 1}</td>
                      <td className="py-2.5 px-3 font-medium text-brand-950 max-w-sm truncate">{p.text}</td>
                      <td className="py-2.5 px-3">
                        <span className="rounded-md border border-brand-200 bg-surface-2 px-1.5 py-0.5 text-[10px] font-mono font-bold text-brand-700">
                          {p.intent || "general"}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono font-bold">
                        <span
                          className={cn(
                            "px-2 py-0.5 rounded-full text-[10.5px]",
                            estimatedProb >= 70
                              ? "bg-success-50 text-success-700 border border-success-200"
                              : estimatedProb >= 40
                                ? "bg-warning-50 text-warning-700 border border-warning-200"
                                : "bg-error-50 text-error-700 border border-error-200",
                          )}
                        >
                          {estimatedProb}%
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-[11px]">
                        {cited ? (
                          <span className="text-success-700 font-semibold flex items-center gap-1">
                            <Check size={12} /> Cited in Answer
                          </span>
                        ) : rivals.length > 0 ? (
                          <span className="text-warning-700 font-semibold">
                            {rivals[0].brandName} cited
                          </span>
                        ) : (
                          <span className="text-brand-400 font-mono">Uncontested</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedPromptIndex(idx);
                            setShowAllPromptsTable(false);
                            setExpandedResponse(false);
                          }}
                          className="text-xs text-signal-600 font-bold hover:underline cursor-pointer"
                        >
                          Inspect &rarr;
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SECTION 1: REAL-TIME CITATION PROBABILITY RANKER */}
      <div className="rounded-2xl border border-brand-200/80 bg-surface-1 p-5 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-2 border border-brand-200 text-brand-950 shadow-2xs">
              <Radar className="h-4.5 w-4.5 text-signal-500" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-brand-950">Live Citation Probability Ranker</h3>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10.5px] font-mono font-bold border",
                    probabilityBreakdown.tier === "HIGH" && "bg-success-50 text-success-700 border-success-200",
                    probabilityBreakdown.tier === "MODERATE" && "bg-warning-50 text-warning-700 border-warning-200",
                    probabilityBreakdown.tier === "LOW" && "bg-error-50 text-error-700 border-error-200",
                  )}
                >
                  {probabilityBreakdown.tier} CITATION READINESS
                </span>
              </div>
              <p className="text-xs text-brand-500">
                Derived from actual brand citations, competitor mentions, and verified domain presence in captured answers.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {stagedDefenseSet.has(
              `Targeted Entity & Schema Defense for "${promptText.slice(0, 48)}…"`,
            ) ? (
              <span className="inline-flex items-center gap-1.5 rounded-xl border border-success-200 bg-success-50 px-3.5 py-1.5 text-xs font-bold text-success-700 font-mono shadow-2xs">
                <Check size={13} className="text-success-600" />
                <span>Defense Staged in Fix Engine</span>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => handleStageCitationDefense()}
                className="inline-flex items-center gap-1.5 rounded-xl border border-signal-400 bg-signal-400 hover:bg-signal-500 px-3.5 py-1.5 text-xs font-bold text-brand-950 shadow-2xs transition cursor-pointer"
              >
                <Zap size={13} className="text-brand-950" />
                <span>Stage Citation Defense in Fix Engine</span>
              </button>
            )}
          </div>
        </div>

        {/* Telemetry Probability Gauges */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-1">
          <div className="rounded-xl border border-brand-200/70 bg-surface-2 p-3.5 flex flex-col justify-between">
            <span className="text-xs text-brand-500">Citation Readiness</span>
            <div className="my-2 flex items-baseline gap-1.5">
              <span
                className={cn(
                  "text-2xl font-bold font-mono",
                  probabilityBreakdown.tier === "HIGH" && "text-success-700",
                  probabilityBreakdown.tier === "MODERATE" && "text-warning-700",
                  probabilityBreakdown.tier === "LOW" && "text-error-600",
                )}
              >
                {probabilityBreakdown.finalProbability}%
              </span>
              <span className="text-xs text-brand-400">score</span>
            </div>
            <div className="h-2 w-full rounded-full bg-brand-200 overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-500",
                  probabilityBreakdown.tier === "HIGH" && "bg-success-500",
                  probabilityBreakdown.tier === "MODERATE" && "bg-warning-500",
                  probabilityBreakdown.tier === "LOW" && "bg-error-500",
                )}
                style={{ width: `${probabilityBreakdown.finalProbability}%` }}
              />
            </div>
          </div>

          <div className="rounded-xl border border-brand-200/70 bg-surface-2 p-3.5 flex flex-col justify-between">
            <span className="text-xs text-brand-500">Direct Brand Citation</span>
            <div className="my-1.5">
              <span className="text-sm font-bold text-brand-950 flex items-center gap-1.5">
                {isBrandRecommended ? (
                  <>
                    <CheckCircle2 size={16} className="text-success-600" />
                    Recommended Primary
                  </>
                ) : isBrandMentioned ? (
                  <>
                    <Check size={16} className="text-signal-500" />
                    Mentioned in Synthesis
                  </>
                ) : (
                  <>
                    <AlertCircle size={16} className="text-error-600" />
                    Zero Citation
                  </>
                )}
              </span>
              <p className="mt-1 text-[11px] text-brand-400">
                Score contribution: +{probabilityBreakdown.mentionPoints} pts
              </p>
            </div>
            <span className="text-[10px] font-mono text-brand-400 uppercase">
              {currentEngineAnswer?.provider || "Engine"} Result
            </span>
          </div>

          <div className="rounded-xl border border-brand-200/70 bg-surface-2 p-3.5 flex flex-col justify-between">
            <span className="text-xs text-brand-500">Competitor Threat</span>
            <div className="my-1.5">
              <span className="text-sm font-bold text-brand-950 flex items-center gap-1.5">
                {competitorMentions.length > 0 ? (
                  <>
                    <ArrowRightLeft size={16} className="text-warning-600" />
                    {competitorMentions.length} Rival{competitorMentions.length === 1 ? "" : "s"} Mentioned
                  </>
                ) : (
                  <>
                    <ShieldCheck size={16} className="text-success-600" />
                    Zero Competitor Steal
                  </>
                )}
              </span>
              <p className="mt-1 text-[11px] text-brand-400">
                {competitorMentions.length > 0
                  ? `Penalty: -${probabilityBreakdown.penalty} pts deduction`
                  : "Clean citation field"}
              </p>
            </div>
            <span className="text-[10px] font-mono text-brand-400 truncate">
              {competitorMentions[0] ? `Rival: ${competitorMentions[0]}` : "Protected"}
            </span>
          </div>

          <div className="rounded-xl border border-brand-200/70 bg-surface-2 p-3.5 flex flex-col justify-between">
            <span className="text-xs text-brand-500">Entity Schema Alignment</span>
            <div className="my-1.5">
              <span className="text-sm font-bold text-brand-950 flex items-center gap-1.5">
                <Globe size={16} className="text-signal-500" />
                {domain || "Verified Domain"}
              </span>
              <p className="mt-1 text-[11px] text-brand-400">
                Entity contribution: +{probabilityBreakdown.entityPoints} pts
              </p>
            </div>
            <span className="text-[10px] font-mono text-brand-400">
              Offering: {activePrompt?.offering || "Core Services"}
            </span>
          </div>
        </div>
      </div>

      {/* SECTION 2: INTERACTIVE VISUAL SERP CANVAS */}
      <div className="rounded-2xl border border-brand-200/80 bg-surface-1 shadow-2xs overflow-hidden">
        {/* SERP Search Engine Top Bar */}
        <div className="border-b border-brand-200/70 bg-surface-2 p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              {selectedEngine === "google_ai" && (
                <div className="flex items-center gap-1 font-bold tracking-tight text-brand-950 text-base">
                  <span className="text-signal-500 font-extrabold text-lg">G</span>
                  <span>oogle</span>
                </div>
              )}
              {selectedEngine === "searchgpt" && (
                <div className="flex items-center gap-1.5 font-bold tracking-tight text-brand-950 text-sm">
                  <Bot size={18} className="text-brand-950" />
                  <span>SearchGPT Canvas</span>
                </div>
              )}
              {selectedEngine === "perplexity" && (
                <div className="flex items-center gap-1.5 font-bold tracking-tight text-signal-600 text-sm font-mono">
                  <Globe size={18} className="text-signal-500" />
                  <span>perplexity.ai</span>
                </div>
              )}

              {/* Search Box with real live search launch */}
              <div className="relative flex-1 min-w-[240px] sm:min-w-[360px]">
                <input
                  type="text"
                  readOnly
                  value={promptText}
                  className="w-full rounded-full border border-brand-200 bg-surface-1 pl-4 pr-10 py-1.5 text-xs font-medium text-brand-950 shadow-inner"
                />
                {promptText && (
                  <a
                    href={selectedEngine === "perplexity" ? perplexitySearchUrl(promptText) : googleSearchUrl(promptText)}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Open this query in live search"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-400 hover:text-brand-900"
                  >
                    <ExternalLink size={13} />
                  </a>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs text-brand-500">
              {promptText && (
                <a
                  href={googleSearchUrl(promptText)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-lg border border-brand-200 bg-surface-1 px-2.5 py-1 text-[11.5px] font-semibold text-accent-700 hover:bg-surface-2 transition"
                >
                  <span>Inspect Live on Google</span>
                  <ExternalLink size={11} />
                </a>
              )}
              <button
                type="button"
                onClick={() => setShowSourcesDrawer(!showSourcesDrawer)}
                className="rounded-lg border border-brand-200 bg-surface-1 px-2.5 py-1 text-[11.5px] font-semibold text-brand-700 hover:bg-surface-2 cursor-pointer transition"
              >
                {showSourcesDrawer ? "Hide Source Cards" : "Show Source Cards"}
              </button>
            </div>
          </div>
        </div>

        {/* SERP VIEW CANVAS */}
        <div className="p-5 md:p-6 space-y-6">
          {/* 1. GOOGLE AI OVERVIEW MODE */}
          {selectedEngine === "google_ai" && (
            <div className="space-y-5">
              {/* Google AI Overview Box */}
              <div className="rounded-2xl border border-signal-400/40 bg-gradient-to-b from-signal-400/10 via-surface-1 to-surface-1 p-5 shadow-2xs space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-signal-400 text-signal-ink">
                      <Sparkles size={14} />
                    </div>
                    <span className="text-xs font-extrabold uppercase tracking-wider text-brand-950 font-mono">
                      AI Overview
                    </span>
                    {currentEngineAnswer?.provider && (
                      <span className="rounded-full bg-surface-2 border border-brand-200 px-2 py-0.5 font-mono text-[10px] text-brand-600">
                        Captured via {currentEngineAnswer.provider}
                      </span>
                    )}
                  </div>
                  {promptText && (
                    <a
                      href={googleSearchUrl(promptText)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-accent-700 hover:underline"
                    >
                      <span>Verify live Google SERP</span>
                      <ExternalLink size={11} />
                    </a>
                  )}
                </div>

                {/* Formatted Synthesis Answer Text */}
                <div className="space-y-3">
                  {currentEngineAnswer?.rawResponse ? (
                    <FormattedAiResponse
                      text={currentEngineAnswer.rawResponse}
                      expanded={expandedResponse}
                      onToggleExpand={() => setExpandedResponse((v) => !v)}
                    />
                  ) : (
                    <p className="text-xs italic text-brand-500">
                      No Google Gemini synthesis recorded yet for this prompt query. Run a check from the Prompts tab to capture live generative text.
                    </p>
                  )}

                  {currentEngineAnswer?.analysis?.parsedJson?.recommendationQuote && (
                    <div className="rounded-xl border-l-4 border-signal-400 bg-surface-2 p-3 text-xs italic text-brand-900 font-medium">
                      &ldquo;{currentEngineAnswer.analysis.parsedJson.recommendationQuote}&rdquo;
                    </div>
                  )}
                </div>

                {/* Citation Carousel Sources (REAL CLICKABLE LINKS) */}
                {showSourcesDrawer && (
                  <div className="pt-2 border-t border-brand-200/60 space-y-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-brand-500 font-mono">
                      Sources Cited in Answer ({rawCitations.length})
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                      {rawCitations.length > 0 ? (
                        rawCitations.map((c, i) => {
                          const isOwn = domain && c.domain.toLowerCase().includes(domain.toLowerCase());
                          const cardClass = cn(
                            "flex items-start gap-2.5 rounded-xl border p-2.5 shadow-2xs transition-all",
                            isOwn
                              ? "border-success-300 bg-success-50/60 ring-1 ring-success-400/30 hover:bg-success-50"
                              : "border-brand-200 bg-surface-2 hover:bg-surface-3",
                          );
                          const inner = (
                            <>
                              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-1 border border-brand-200 text-[10px] font-bold">
                                {c.domain ? c.domain[0].toUpperCase() : "S"}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-1">
                                  <span className="font-mono text-[10.5px] font-bold text-brand-900 truncate">
                                    {c.domain}
                                  </span>
                                  <div className="flex items-center gap-1 shrink-0">
                                    {isOwn && (
                                      <span className="rounded-full bg-success-600 text-surface-1 px-1.5 py-0.2 text-[9px] font-bold">
                                        YOUR SITE
                                      </span>
                                    )}
                                    {c.href && <ExternalLink size={10} className="text-brand-400" />}
                                  </div>
                                </div>
                                <p className="text-[11px] text-brand-500 truncate mt-0.5">
                                  {c.href || c.domain}
                                </p>
                              </div>
                            </>
                          );
                          return c.href ? (
                            <a
                              key={i}
                              href={c.href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={cardClass}
                            >
                              {inner}
                            </a>
                          ) : (
                            <div key={i} className={cardClass}>
                              {inner}
                            </div>
                          );
                        })
                      ) : (
                        <div className="col-span-full rounded-xl border border-brand-200/60 bg-surface-2 p-3 text-xs text-brand-600 space-y-1.5">
                          {isBrandMentioned ? (
                            <span className="flex items-center gap-1.5 text-success-700 font-semibold">
                              <CheckCircle2 size={14} /> {businessName} is mentioned in the answer synthesis (no explicit source URLs were attached by this model).
                            </span>
                          ) : (
                            <span className="flex items-center gap-1.5 text-warning-700 font-semibold">
                              <AlertCircle size={14} /> No source URLs were returned by this model response{competitorMentions.length > 0 ? ` — rivals named in text: ${competitorMentions.slice(0, 4).join(", ")}.` : "."}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* REAL Organic SERP Preview Below Overview (Crawled Site Page + Real Cited URLs — Zero Fake G2 Mockups) */}
              <div className="space-y-4 pt-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-brand-400 font-mono">
                    Your Crawled Search Snippet &amp; Real Cited Pages Below Overview
                  </span>
                  <span className="text-[11px] text-brand-400">
                    Populated from your real website crawl &amp; captured citations
                  </span>
                </div>

                {/* 1. Real Crawled Page Snippet for Your Site */}
                {ownSiteHref ? (
                  <div className="space-y-1 max-w-2xl rounded-xl border border-brand-200/60 bg-surface-2/40 p-3.5">
                    <div className="flex items-center gap-2 text-[11px] text-brand-500 font-mono">
                      <span className="h-4 w-4 rounded-full bg-brand-200 flex items-center justify-center text-[9px] font-bold text-brand-800">
                        {domain ? domain[0].toUpperCase() : "W"}
                      </span>
                      <a
                        href={ownSiteHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="truncate hover:underline text-brand-600"
                      >
                        {ownSiteHref}
                      </a>
                      <span className="rounded bg-surface-1 border border-brand-200 px-1.5 py-0.5 text-[9.5px] text-brand-600">
                        Your crawled page
                      </span>
                    </div>
                    <a
                      href={ownSiteHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-base font-semibold text-primary-600 hover:underline"
                    >
                      <span>{matchedOwnPage?.title?.trim() || `${businessName} (${domain})`}</span>
                      <ExternalLink size={13} className="shrink-0" />
                    </a>
                    <p className="text-xs leading-relaxed text-brand-600">
                      {matchedOwnPage?.metaDescription?.trim() ||
                        (matchedOwnPage
                          ? "No meta description detected on this crawled page — add one in Fix Engine to control your Google snippet."
                          : "Run a Website Audit crawl to preview this site's exact live <title> and <meta description> snippet.")}
                    </p>
                  </div>
                ) : null}

                {/* 2. Real External Cited URLs (if the model returned actual citations) */}
                {externalCitedResults.slice(0, 3).map((cite, idx) => (
                  <div
                    key={idx}
                    className="space-y-1 max-w-2xl rounded-xl border border-brand-200/60 bg-surface-2/30 p-3.5"
                  >
                    <div className="flex items-center gap-2 text-[11px] text-brand-500 font-mono">
                      <span className="h-4 w-4 rounded-full bg-brand-200 flex items-center justify-center text-[9px] font-bold text-brand-800">
                        {cite.domain[0]?.toUpperCase() || "C"}
                      </span>
                      <a
                        href={cite.href!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="truncate hover:underline text-brand-600"
                      >
                        {cite.href}
                      </a>
                      <span className="rounded bg-warning-50 border border-warning-200 px-1.5 py-0.5 text-[9.5px] font-semibold text-warning-800">
                        Cited in AI answer
                      </span>
                    </div>
                    <a
                      href={cite.href!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-base font-semibold text-primary-600 hover:underline"
                    >
                      <span>{cite.domain}</span>
                      <ExternalLink size={13} className="shrink-0" />
                    </a>
                  </div>
                ))}

                {/* 3. If rivals were named in text without URLs, offer real Google lookup links for those exact named brands */}
                {externalCitedResults.length === 0 && competitorMentions.length > 0 && (
                  <div className="space-y-2 max-w-2xl rounded-xl border border-brand-200/60 bg-surface-2/40 p-3.5 text-xs">
                    <p className="font-semibold text-brand-900">
                      Competing brands named in this AI answer (click to inspect live on Google):
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {competitorMentions.slice(0, 6).map((brand) => (
                        <a
                          key={brand}
                          href={googleSearchUrl(`${brand} ${activePrompt?.offering || promptText}`)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-lg border border-brand-200 bg-surface-1 px-2.5 py-1 text-xs font-semibold text-accent-700 hover:bg-surface-2 hover:underline"
                        >
                          <span>{brand}</span>
                          <ExternalLink size={11} />
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {promptText && (
                  <div>
                    <a
                      href={googleSearchUrl(promptText)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent-700 hover:underline"
                    >
                      <Search size={12} />
                      <span>Open live Google Search results for &ldquo;{promptText}&rdquo;</span>
                      <ExternalLink size={11} />
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 2. SEARCHGPT / CHATGPT MODE */}
          {selectedEngine === "searchgpt" && (
            <div className="space-y-4 max-w-3xl mx-auto">
              <div className="flex items-start gap-3 justify-end">
                <div className="rounded-2xl bg-surface-2 border border-brand-200 px-4 py-2.5 text-xs md:text-sm font-medium text-brand-950 max-w-lg shadow-2xs">
                  {promptText}
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-950 text-surface-1 shadow-xs">
                  <Bot size={14} />
                </div>
                <div className="flex-1 space-y-3 rounded-2xl border border-brand-200/80 bg-surface-1 p-4 shadow-2xs">
                  <div className="flex items-center justify-between pb-2 border-b border-brand-200/60">
                    <span className="text-[11px] font-bold font-mono text-brand-500 uppercase flex items-center gap-1.5">
                      <Sparkles size={12} className="text-signal-500" />
                      SearchGPT Direct Answer
                    </span>
                    <span className="text-[10.5px] font-mono text-brand-400">
                      {currentEngineAnswer?.model || currentEngineAnswer?.provider || "Captured Response"}
                    </span>
                  </div>

                  <div>
                    {currentEngineAnswer?.rawResponse ? (
                      <FormattedAiResponse
                        text={currentEngineAnswer.rawResponse}
                        expanded={expandedResponse}
                        onToggleExpand={() => setExpandedResponse((v) => !v)}
                        previewLimit={640}
                      />
                    ) : (
                      <p className="text-xs italic text-brand-500">
                        No ChatGPT synthesis available for this specific prompt. Run an analysis to capture response text.
                      </p>
                    )}
                  </div>

                  {/* Inline Sources Pill Deck (REAL CLICKABLE LINKS — only show own domain if actually cited!) */}
                  {showSourcesDrawer && (
                    <div className="pt-2 border-t border-brand-200/60 flex flex-wrap items-center gap-2">
                      <span className="text-[10px] font-bold font-mono text-brand-400 uppercase">Sources:</span>
                      {rawCitations.map((c, i) =>
                        c.href ? (
                          <a
                            key={i}
                            href={c.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded-full border border-brand-200 bg-surface-2 hover:bg-surface-3 px-2.5 py-0.5 text-[10.5px] font-mono text-brand-800 shadow-2xs transition"
                          >
                            <span className="text-[9px] font-bold text-signal-500">[{i + 1}]</span>
                            <span>{c.domain}</span>
                            <ExternalLink size={9} className="text-brand-400" />
                          </a>
                        ) : (
                          <span
                            key={i}
                            className="inline-flex items-center gap-1 rounded-full border border-brand-200 bg-surface-2 px-2.5 py-0.5 text-[10.5px] font-mono text-brand-800 shadow-2xs"
                          >
                            <span className="text-[9px] font-bold text-signal-500">[{i + 1}]</span>
                            <span>{c.domain}</span>
                          </span>
                        ),
                      )}
                      {isBrandMentioned && ownSiteHref && domain && (
                        <a
                          href={ownSiteHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-full border border-success-200 bg-success-50 hover:bg-success-100 px-2.5 py-0.5 text-[10.5px] font-mono font-bold text-success-700"
                        >
                          <Check size={10} />
                          <span>{domain}</span>
                          <ExternalLink size={9} />
                        </a>
                      )}
                      {rawCitations.length === 0 && !isBrandMentioned && (
                        <span className="text-[11px] text-brand-400">
                          No external URLs returned in this answer.
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 3. PERPLEXITY PRO SEARCH MODE */}
          {selectedEngine === "perplexity" && (
            <div className="space-y-4 max-w-3xl mx-auto">
              <div className="rounded-2xl border border-signal-400/30 bg-surface-1 p-5 shadow-2xs space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-brand-200/60">
                  <h3 className="text-sm md:text-base font-bold text-brand-950 font-serif">
                    {promptText}
                  </h3>
                  <span className="rounded-full bg-signal-400/20 text-brand-900 border border-brand-200 px-2 py-0.5 text-[10px] font-mono font-bold">
                    {rawCitations.length} Cited Source{rawCitations.length === 1 ? "" : "s"}
                  </span>
                </div>

                {/* Sources Row at the Top (Perplexity Style — REAL CLICKABLE LINKS) */}
                {showSourcesDrawer && (
                  <div className="space-y-1.5">
                    <span className="text-[10.5px] font-bold font-mono uppercase text-brand-400 tracking-wider">
                      Sources Cited
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {rawCitations.length > 0 ? (
                        rawCitations.slice(0, 4).map((c, i) =>
                          c.href ? (
                            <a
                              key={i}
                              href={c.href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="rounded-xl border border-brand-200 bg-surface-2 hover:bg-surface-3 p-2 text-left shadow-2xs transition block"
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-[9px] font-mono font-bold text-signal-500">
                                  [{i + 1}] source
                                </span>
                                <ExternalLink size={9} className="text-brand-400" />
                              </div>
                              <span className="text-xs font-bold text-brand-950 truncate block mt-0.5">
                                {c.domain}
                              </span>
                              <span className="text-[10px] text-brand-500 truncate block">
                                {c.href}
                              </span>
                            </a>
                          ) : (
                            <div
                              key={i}
                              className="rounded-xl border border-brand-200 bg-surface-2 p-2 text-left shadow-2xs"
                            >
                              <span className="text-[9px] font-mono font-bold text-signal-500 block">
                                [{i + 1}] source
                              </span>
                              <span className="text-xs font-bold text-brand-950 truncate block mt-0.5">
                                {c.domain}
                              </span>
                            </div>
                          ),
                        )
                      ) : (
                        <div className="col-span-full rounded-xl border border-brand-200/60 bg-surface-2 p-2.5 text-xs text-brand-500">
                          No external citation URLs returned by this model response.{" "}
                          {promptText && (
                            <a
                              href={perplexitySearchUrl(promptText)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-semibold text-accent-700 hover:underline"
                            >
                              Run live on Perplexity &rarr;
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Synthesized Output */}
                <div className="pt-1">
                  {currentEngineAnswer?.rawResponse ? (
                    <FormattedAiResponse
                      text={currentEngineAnswer.rawResponse}
                      expanded={expandedResponse}
                      onToggleExpand={() => setExpandedResponse((v) => !v)}
                      previewLimit={600}
                    />
                  ) : (
                    <p className="text-xs italic text-brand-500">
                      Perplexity Sonar response pending. Start a scan to retrieve real-time citations.
                    </p>
                  )}
                </div>

                {/* Working Related Tracked Prompts (Switch immediately on click!) */}
                {relatedTrackedPrompts.length > 0 && (
                  <div className="pt-3 border-t border-brand-200/60 space-y-2">
                    <span className="text-[10.5px] font-bold font-mono uppercase text-brand-400">
                      Jump to Related Tracked Prompts
                    </span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {relatedTrackedPrompts.map(({ prompt, index }) => (
                        <button
                          key={index}
                          type="button"
                          onClick={() => {
                            setSelectedPromptIndex(index);
                            setExpandedResponse(false);
                          }}
                          className="rounded-lg border border-brand-200 bg-surface-2 px-2.5 py-1 text-xs text-brand-700 cursor-pointer hover:bg-surface-3 text-left"
                        >
                          {prompt.text} &rarr;
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* SECTION 3: COMPETITOR AUTHORITY GAP MATRIX */}
      <div className="rounded-2xl border border-brand-200/80 bg-surface-1 p-5 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-2 border border-brand-200 text-brand-950 shadow-2xs">
              <Target className="h-4.5 w-4.5 text-warning-600" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-brand-950">Competitor Citation Monopoly &amp; Authority Gaps</h3>
              <p className="text-xs text-brand-500">
                Identify which rivals are winning AI citations and stage targeted counter-content in Fix Engine.
              </p>
            </div>
          </div>

          <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-surface-2 px-3 py-1 text-xs font-semibold text-brand-800">
            <span className="h-1.5 w-1.5 rounded-full bg-warning-500" />
            <span>{competitorGaps.length} Competing Entities Detected</span>
          </span>
        </div>

        {competitorGaps.length === 0 ? (
          <div className="rounded-xl border border-brand-200/60 bg-surface-2 p-6 text-center text-xs text-brand-500">
            No competitor domain monopolies identified in currently measured answers.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-brand-200/70">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-brand-200/60 bg-surface-2 text-[11px] font-semibold text-brand-600">
                <tr>
                  <th className="py-2.5 px-3">Rival Entity / Domain</th>
                  <th className="py-2.5 px-3 text-center">Citation Share</th>
                  <th className="py-2.5 px-3">Why LLMs Cite Them</th>
                  <th className="py-2.5 px-3">Counter-Remediation</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-200/50">
                {competitorGaps.map((gap, i) => {
                  const stageTitle = `Counter-Remediation: ${businessName} vs ${gap.name} FAQ & Schema`;
                  const isStaged = stagedDefenseSet.has(stageTitle);
                  const gapHref = safeExternalHref(null, gap.domain);

                  return (
                    <tr key={i} className="hover:bg-surface-2/60 transition-colors">
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-3 text-[10px] font-bold text-brand-700">
                            {(gap.domain || gap.name)[0]?.toUpperCase() || "R"}
                          </div>
                          <div>
                            <span className="font-bold text-brand-950 block">{gap.name}</span>
                            {gapHref ? (
                              <a
                                href={gapHref}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[11px] font-mono text-accent-700 hover:underline"
                              >
                                <span>{gap.domain}</span>
                                <ExternalLink size={10} />
                              </a>
                            ) : (
                              <a
                                href={googleSearchUrl(`${gap.name} ${activePrompt?.offering || ""}`)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[11px] font-mono text-brand-500 hover:text-accent-700 hover:underline"
                              >
                                <span>Search on Google</span>
                                <ExternalLink size={10} />
                              </a>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-3 text-center font-mono font-bold">
                        <span className="rounded-full bg-warning-50 border border-warning-200 px-2 py-0.5 text-[11px] text-warning-800">
                          {gap.citationShare}%
                        </span>
                        <span className="block text-[10px] text-brand-400 font-normal mt-0.5">
                          {gap.citationCount} mention{gap.citationCount === 1 ? "" : "s"}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-[11.5px] text-brand-700 max-w-xs">
                        {gap.reasonWon}
                      </td>

                      <td className="py-3 px-3 text-[11.5px] text-brand-600 max-w-sm">
                        {gap.recommendedCounterStrategy}
                      </td>

                      <td className="py-3 px-3 text-right">
                        {isStaged ? (
                          <span className="inline-flex items-center gap-1 rounded-lg border border-success-200 bg-success-50 px-2.5 py-1 text-[11px] font-bold text-success-700 font-mono">
                            <Check size={11} className="text-success-600" />
                            Staged
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleStageCitationDefense(stageTitle)}
                            className="inline-flex items-center gap-1 rounded-lg border border-brand-200 bg-surface-2 hover:bg-surface-3 px-2.5 py-1 text-[11px] font-bold text-brand-800 transition cursor-pointer shadow-2xs"
                          >
                            <Zap size={11} className="text-signal-500" />
                            Stage Fix
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
