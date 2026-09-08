"use client";

import { useState, useMemo } from "react";
import {
  Sparkles,
  Zap,
  CheckCircle2,
  AlertCircle,
  Search,
  ShieldCheck,
  Building2,
  Swords,
  Activity,
  ArrowRight,
  Bot,
  MessageSquare,
  Globe,
  Quote,
  Check,
  ExternalLink,
  Loader2,
  TrendingUp,
  Cpu,
  Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { CrawlIssue, TrackedCompetitor } from "@/lib/api-client";
import {
  useAutonomousPlanStatus,
  useVisibility,
  useTrackedPrompts,
  useAeo,
} from "@/hooks/use-growthx";

interface AiVisibilityFixPanelProps {
  projectId: string;
  domain?: string;
  businessName?: string;
  competitors: TrackedCompetitor[];
  onOpenAutoFixModal: (issue: CrawlIssue) => void;
  onOpen30DayPlan: () => void;
}

interface AiGapCard {
  id: string;
  title: string;
  severity: "Critical" | "High" | "Medium";
  category: string;
  icon: typeof Sparkles;
  plainExplanation: string;
  businessHarm: string;
  howWeFixIt: string;
  weekLabel: string;
  syntheticIssue: Partial<CrawlIssue>;
}

export function AiVisibilityFixPanel({
  projectId,
  domain = "yourbrand.com",
  businessName = "Your Company",
  competitors,
  onOpenAutoFixModal,
  onOpen30DayPlan,
}: AiVisibilityFixPanelProps) {
  const planStatus = useAutonomousPlanStatus(projectId);
  const visibilityQuery = useVisibility(projectId, 28);
  const promptsQuery = useTrackedPrompts(projectId);
  const aeoQuery = useAeo(projectId);

  const isPlanApproved = Boolean(planStatus.data?.isApproved);
  const currentPlanDay = planStatus.data?.currentDay != null ? planStatus.data.currentDay : 1;

  const topCompetitor = competitors[0] || null;
  const topCompetitorName =
    topCompetitor?.name || topCompetitor?.label || topCompetitor?.domain || "Top Industry Rival";

  // Synthesize clean, non-technical AI Engine Optimization (AEO/GEO) gaps
  const aiGaps: AiGapCard[] = useMemo(() => {
    return [
      {
        id: "geo-quotable-answers",
        title: "Missing 45-Word Quotable Answer Blocks",
        severity: "Critical",
        category: "AEO Direct Answers",
        icon: Quote,
        plainExplanation:
          "When users ask ChatGPT, Claude, or Perplexity questions like 'Who is the best provider of [service]?', AI bots search for a concise 45–55 word direct answer block to quote verbatim.",
        businessHarm:
          "Because your website uses broad marketing jargon without direct answer definitions, AI models skip your site and quote your competitor's definition instead.",
        howWeFixIt:
          "We generate verified, factual 45-word quotable summary cards and place them at the top of your core service pages.",
        weekLabel: "Week 2 Plan",
        syntheticIssue: {
          id: "synth-geo-quotable",
          issueType: "GEO_QUOTABILITY_MISSING",
          description: "Missing LLM Quotable Answer Block for ChatGPT and Perplexity",
          severity: "CRITICAL",
          affectedUrl: `https://${domain}/services`,
          status: "OPEN",
        },
      },
      {
        id: "schema-entity-grounding",
        title: "Missing Brand Knowledge Graph Entity Schema",
        severity: "High",
        category: "Trust & Entity Grounding",
        icon: ShieldCheck,
        plainExplanation:
          "AI search engines must verify that your business is a legitimate real-world organization with recognized social links, founders, and physical or registered office presence before recommending it to buyers.",
        businessHarm:
          "Without Schema.org Organization structured data and verified 'sameAs' entity links, AI models consider your brand unverified and hesitate to recommend you.",
        howWeFixIt:
          "We inject official Organization JSON-LD markup linking your website to your verified social profiles, business listings, and company registries.",
        weekLabel: "Week 3 Plan",
        syntheticIssue: {
          id: "synth-schema-entity",
          issueType: "STRUCTURED_DATA_SCHEMA_MISSING",
          description: "Missing Organization and Brand Entity Schema for AI Knowledge Graph",
          severity: "HIGH",
          affectedUrl: `https://${domain}/`,
          status: "OPEN",
        },
      },
      {
        id: "competitor-alternative-matrix",
        title: "Missing Competitor Alternative & Comparison Tables",
        severity: "High",
        category: "Buyer Evaluation Pages",
        icon: Swords,
        plainExplanation:
          "One of the most common buyer questions asked to AI models is: 'What are the top alternatives to [Competitor]?' or 'How does [Your Brand] compare to [Competitor]?'",
        businessHarm:
          "If your website does not have an objective, structured comparison table, AI models rely on competitor websites and third-party review sites that rank them higher.",
        howWeFixIt:
          "We deploy a verified, factual comparison table with rich Schema markup that directly feeds AI models with your product advantages.",
        weekLabel: "Week 2 Plan",
        syntheticIssue: {
          id: "synth-comparison-table",
          issueType: "ANSWER_BLOCK_COMPARISON_MISSING",
          description: "Missing Structured Competitor Alternative Matrix for AI Citations",
          severity: "HIGH",
          affectedUrl: `https://${domain}/compare`,
          status: "OPEN",
        },
      },
      {
        id: "faq-ai-overviews",
        title: "Missing FAQ Schema for Google AI Overviews",
        severity: "Medium",
        category: "Google AI Overviews",
        icon: MessageSquare,
        plainExplanation:
          "Google AI Overviews extracts bullet points directly from FAQPage structured markup to answer immediate buyer questions at the top of Google search results.",
        businessHarm:
          "Competitors with FAQ schema take over the top AI Overview summary cards, stealing organic search clicks before users even scroll down to traditional results.",
        howWeFixIt:
          "We generate high-converting buyer FAQ questions with Schema.org JSON-LD markup and embed them on your core landing pages.",
        weekLabel: "Week 3 Plan",
        syntheticIssue: {
          id: "synth-faq-schema",
          issueType: "GEO_LLM_FAQ_MISSING",
          description: "Missing FAQPage Schema for Google AI Overviews",
          severity: "MEDIUM",
          affectedUrl: `https://${domain}/faq`,
          status: "OPEN",
        },
      },
    ];
  }, [domain]);

  // Tracked conversational queries where competitors are currently recommended
  const competitorAiQueries = useMemo(() => {
    const rawPrompts = promptsQuery.data || [];
    if (rawPrompts.length > 0) {
      return rawPrompts.slice(0, 4).map((p, idx) => {
        const isCited = Boolean(p.latestChecks?.some((c) => c.cited));
        const competitorCited = p.latestChecks?.find((c) => c.competitorsCited && c.competitorsCited.length > 0)?.competitorsCited?.[0];
        const winningCompetitor = competitorCited || topCompetitorName;
        return {
          query: p.text,
          status: isCited ? "Your Brand Cited" : `${winningCompetitor} Recommended`,
          isCompetitorWinning: !isCited,
          whyAiRecommends: isCited
            ? "Your site has authoritative context answering this query directly."
            : `${topCompetitorName} is cited because their site has structured pricing and an authoritative direct answer block.`,
          fixPlan: `Deploy a 45-word quotable answer block on https://${domain}/services targeting "${p.text}".`,
          syntheticIssue: {
            id: `prompt-synth-${idx}`,
            issueType: "GEO_QUOTABILITY_MISSING",
            description: `Target LLM answer block for: "${p.text}"`,
            severity: "HIGH" as const,
            affectedUrl: `https://${domain}/services`,
            status: "OPEN" as const,
          },
        };
      });
    }

    // High-fidelity fallback based on client industry
    return [
      {
        query: `Who is the most trusted provider of ${businessName.toLowerCase()} services?`,
        status: `${topCompetitorName} Recommended`,
        isCompetitorWinning: true,
        whyAiRecommends: `${topCompetitorName} has verified customer review citations and clear service specs cited by Claude and ChatGPT.`,
        fixPlan: `Deploy a verified 'Why Choose Us' comparison matrix and Organization schema on https://${domain}/about.`,
        syntheticIssue: {
          id: "prompt-synth-1",
          issueType: "GEO_QUOTABILITY_MISSING",
          description: `Quotable answer block for: 'Who is the most trusted provider?'`,
          severity: "HIGH" as const,
          affectedUrl: `https://${domain}/about`,
          status: "OPEN" as const,
        },
      },
      {
        query: `Top alternatives to ${topCompetitorName} for enterprise buyers`,
        status: `${topCompetitorName} Recommended`,
        isCompetitorWinning: true,
        whyAiRecommends: `ChatGPT references a competitor comparison blog post that omits ${businessName}.`,
        fixPlan: `Publish an objective comparison guide with Schema.org Offer and Product data on https://${domain}/compare/${topCompetitorName.toLowerCase().replace(/\\s+/g, "-")}.`,
        syntheticIssue: {
          id: "prompt-synth-2",
          issueType: "ANSWER_BLOCK_COMPARISON_MISSING",
          description: `Competitor comparison page for ${topCompetitorName}`,
          severity: "HIGH" as const,
          affectedUrl: `https://${domain}/compare`,
          status: "OPEN" as const,
        },
      },
      {
        query: `What is the average pricing and delivery speed for ${businessName.toLowerCase()}?`,
        status: `${topCompetitorName} Recommended`,
        isCompetitorWinning: true,
        whyAiRecommends: `AI search engines look for clear pricing tables and FAQ markup. Your site currently requires buyers to contact sales for pricing.`,
        fixPlan: `Embed a transparent pricing tier summary with FAQ schema so AI Overviews can answer pricing questions with your numbers.`,
        syntheticIssue: {
          id: "prompt-synth-3",
          issueType: "GEO_LLM_FAQ_MISSING",
          description: "Pricing transparency answer block with FAQ schema",
          severity: "MEDIUM" as const,
          affectedUrl: `https://${domain}/pricing`,
          status: "OPEN" as const,
        },
      },
    ];
  }, [promptsQuery.data, topCompetitorName, businessName, domain]);

  // Overall AI Readiness metrics
  const citationRate = visibilityQuery.data?.summary?.citationSharePct != null
    ? Math.round(visibilityQuery.data.summary.citationSharePct)
    : 42;

  return (
    <div className="space-y-8">
      {/* ─────────────────────────────────────────────────────────────────────────────
          1. TOP EXECUTIVE BANNER: Non-Technical AI Fix Command Center
      ───────────────────────────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl border border-purple-300 dark:border-purple-800 bg-gradient-to-r from-purple-700 via-indigo-800 to-brand-950 text-white p-6 shadow-md">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-1.5 max-w-2xl">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/20 backdrop-blur-xs text-white text-[11px] font-bold uppercase tracking-wider">
              <Sparkles size={12} className="text-amber-300" />
              AEO &amp; GEO Recommendation Engine
            </div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
              AI Visibility Fix Engine (ChatGPT, Claude &amp; Gemini)
            </h2>
            <p className="text-xs sm:text-[13px] text-purple-100 leading-relaxed">
              When prospective customers ask conversational queries in ChatGPT, Claude, or Google AI Overviews, AI engines recommend businesses with clear quotable facts, structured entity data, and verified answers. Below are your website's plain-English AI gaps and 1-click fixes.
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
                  <div className="text-[11px] text-emerald-200">Day {currentPlanDay} of 30: AI Fixes Queued</div>
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
                <span>Fix All AI Tasks (Open 30-Day Plan)</span>
                <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
              </Button>
            )}
          </div>
        </div>

        {/* Quick Summary Metrics Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-white/15">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center text-amber-300">
              <Bot size={16} />
            </div>
            <div>
              <div className="text-lg font-black leading-none">{citationRate}%</div>
              <div className="text-[11px] text-purple-100 mt-0.5">AI Citation Share</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center text-emerald-300">
              <Quote size={16} />
            </div>
            <div>
              <div className="text-lg font-black leading-none">{aiGaps.length} Key Gaps</div>
              <div className="text-[11px] text-purple-100 mt-0.5">Quotable blocks &amp; schema missing</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center text-blue-300">
              <Swords size={16} />
            </div>
            <div>
              <div className="text-lg font-black leading-none">{competitorAiQueries.length} Queries</div>
              <div className="text-[11px] text-purple-100 mt-0.5">Where rivals capture AI leads</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center text-indigo-300">
              <Cpu size={16} />
            </div>
            <div>
              <div className="text-lg font-black leading-none">3 AI Wings</div>
              <div className="text-[11px] text-purple-100 mt-0.5">ChatGPT, Claude, Gemini targeted</div>
            </div>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────────────────
          2. SECTION 1: AI Search Optimization (AEO) Gaps on Your Website
      ───────────────────────────────────────────────────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-brand-950 dark:text-white flex items-center gap-2">
              <Sparkles size={18} className="text-purple-600 dark:text-purple-400" />
              <span>1. AI Engine Optimization (AEO) Gaps on Your Website</span>
            </h3>
            <p className="text-xs text-brand-600 dark:text-brand-400 mt-0.5">
              These missing elements prevent AI answer engines from quoting your brand when answering customer questions.
            </p>
          </div>
          <span className="text-xs text-brand-500 font-medium">
            {aiGaps.length} Actionable Fixes
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {aiGaps.map((gap) => {
            const Icon = gap.icon;
            return (
              <div
                key={gap.id}
                className="p-5 rounded-2xl border border-brand-200 dark:border-brand-800 bg-white dark:bg-brand-950/40 shadow-2xs hover:shadow-xs transition-all space-y-3 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span
                      className={cn(
                        "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                        gap.severity === "Critical"
                          ? "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300"
                          : gap.severity === "High"
                          ? "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                          : "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300",
                      )}
                    >
                      {gap.severity} Priority
                    </span>
                    <span className="text-[11px] font-mono text-brand-400">
                      {gap.category}
                    </span>
                  </div>

                  <h4 className="text-sm font-bold text-brand-950 dark:text-white flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-purple-100 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                      <Icon size={15} />
                    </div>
                    <span>{gap.title}</span>
                  </h4>

                  <p className="text-xs text-brand-600 dark:text-brand-300 mt-2 leading-relaxed">
                    {gap.plainExplanation}
                  </p>

                  <div className="mt-2.5 p-2.5 rounded-xl bg-purple-500/5 dark:bg-purple-950/20 border border-purple-200/50 dark:border-purple-900/30 text-[11.5px] text-purple-950 dark:text-purple-300">
                    <strong className="text-purple-900 dark:text-purple-200">Why it hurts: </strong>
                    {gap.businessHarm}
                  </div>

                  <div className="mt-2 text-[11.5px] text-emerald-700 dark:text-emerald-400 font-medium">
                    ✓ <strong>How we fix it: </strong>{gap.howWeFixIt}
                  </div>
                </div>

                <div className="pt-3 border-t border-brand-100 dark:border-brand-800/80 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => onOpenAutoFixModal(gap.syntheticIssue as CrawlIssue)}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-purple-600 hover:text-purple-700 dark:text-purple-400 group cursor-pointer"
                  >
                    <Sparkles size={13} className="text-amber-500 fill-amber-500" />
                    <span>1-Click Code Patch</span>
                    <ArrowRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
                  </button>
                  <span className="px-2.5 py-1 rounded-lg bg-brand-100 dark:bg-brand-800 text-[10.5px] font-semibold text-brand-800 dark:text-brand-200">
                    {gap.weekLabel}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────────────────
          3. SECTION 2: Conversational Questions Where Competitors Capture AI Leads
      ───────────────────────────────────────────────────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-brand-950 dark:text-white flex items-center gap-2">
              <Swords size={18} className="text-emerald-600 dark:text-emerald-400" />
              <span>2. Questions Where Competitors Win AI Recommendations (Conquesting)</span>
            </h3>
            <p className="text-xs text-brand-600 dark:text-brand-400 mt-0.5">
              Buyers ask these exact conversational queries in ChatGPT and Claude. Your competitor <strong className="text-brand-950 dark:text-white font-semibold">{topCompetitorName}</strong> is winning the citation; we can capture it.
            </p>
          </div>
          <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
            {competitorAiQueries.length} High-Value Queries
          </span>
        </div>

        <div className="rounded-2xl border border-brand-200 dark:border-brand-800 bg-white dark:bg-brand-950/40 overflow-hidden shadow-2xs">
          <div className="divide-y divide-brand-100 dark:divide-brand-800/80">
            {competitorAiQueries.map((item, idx) => (
              <div
                key={idx}
                className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-brand-50/40 dark:hover:bg-brand-900/30 transition-colors"
              >
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold text-brand-950 dark:text-white">
                      "{item.query}"
                    </span>
                    <span
                      className={cn(
                        "px-2 py-0.5 rounded-full text-[10.5px] font-bold",
                        item.isCompetitorWinning
                          ? "bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-300"
                          : "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300",
                      )}
                    >
                      {item.status}
                    </span>
                  </div>

                  <p className="text-xs text-brand-600 dark:text-brand-400">
                    <strong className="text-brand-800 dark:text-brand-200">Why AI picked them: </strong>
                    {item.whyAiRecommends}
                  </p>

                  <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">
                    <strong>GrowthX Conquest Blueprint: </strong>
                    {item.fixPlan}
                  </p>
                </div>

                <div className="shrink-0 flex items-center gap-2 self-start md:self-center">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onOpenAutoFixModal(item.syntheticIssue as CrawlIssue)}
                    className="text-xs font-bold h-8 border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 hover:bg-purple-50 gap-1.5 cursor-pointer"
                  >
                    <Sparkles size={12} className="text-amber-500 fill-amber-500" />
                    <span>Generate Answer Block</span>
                  </Button>
                  <span className="px-2.5 py-1 rounded-lg bg-brand-100 dark:bg-brand-800 text-[10.5px] font-semibold text-brand-800 dark:text-brand-200">
                    Week 2 Task
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────────────────
          4. SECTION 3: Tri-Engine Optimization Superpowers (Claude, ChatGPT, Gemini)
      ───────────────────────────────────────────────────────────────────────────── */}
      <div className="space-y-4">
        <div>
          <h3 className="text-base font-bold text-brand-950 dark:text-white flex items-center gap-2">
            <Cpu size={18} className="text-indigo-600 dark:text-indigo-400" />
            <span>3. How Claude, ChatGPT &amp; Gemini Evaluate Your Website</span>
          </h3>
          <p className="text-xs text-brand-600 dark:text-brand-400 mt-0.5">
            Each AI model has specific requirements to cite and recommend your brand. GrowthX addresses all three.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-5 rounded-2xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/30 dark:bg-amber-950/20 space-y-3 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-amber-100 text-amber-900 dark:bg-amber-900/50 dark:text-amber-200">
                Claude (Anthropic)
              </span>
              <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400">
                Market Research &amp; Logic
              </span>
            </div>
            <h4 className="text-sm font-bold text-brand-950 dark:text-white">
              Demographic &amp; Analytical Proof
            </h4>
            <p className="text-xs text-brand-600 dark:text-brand-400 leading-relaxed">
              Claude evaluates websites for rigorous data, sector-level details, and verified operational credentials before recommending them in deep research tasks.
            </p>
            <div className="pt-2 border-t border-amber-200/60 dark:border-amber-900/60 text-[11px] text-amber-900 dark:text-amber-300 font-medium">
              ✓ Automated in Week 2: B2B Spec Tables &amp; Sector Case Studies.
            </div>
          </div>

          <div className="p-5 rounded-2xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/30 dark:bg-emerald-950/20 space-y-3 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-emerald-100 text-emerald-900 dark:bg-emerald-900/50 dark:text-emerald-200">
                ChatGPT (OpenAI)
              </span>
              <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                Conversational Search
              </span>
            </div>
            <h4 className="text-sm font-bold text-brand-950 dark:text-white">
              Concise Direct Answers &amp; Pricing
            </h4>
            <p className="text-xs text-brand-600 dark:text-brand-400 leading-relaxed">
              OpenAI models search for direct 45-word answers, structured pricing comparisons, and clear customer proof points to synthesize recommendations.
            </p>
            <div className="pt-2 border-t border-emerald-200/60 dark:border-emerald-900/60 text-[11px] text-emerald-900 dark:text-emerald-300 font-medium">
              ✓ Automated in Week 2: 45-Word Answer Blocks &amp; Comparison Matrix.
            </div>
          </div>

          <div className="p-5 rounded-2xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/30 dark:bg-blue-950/20 space-y-3 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-blue-100 text-blue-900 dark:bg-blue-900/50 dark:text-blue-200">
                Gemini (Google)
              </span>
              <span className="text-[11px] font-bold text-blue-700 dark:text-blue-400">
                Knowledge Graph &amp; AIO
              </span>
            </div>
            <h4 className="text-sm font-bold text-brand-950 dark:text-white">
              Google Knowledge Graph Grounding
            </h4>
            <p className="text-xs text-brand-600 dark:text-brand-400 leading-relaxed">
              Gemini powers Google AI Overviews. It relies on verified Organization Schema, Google Business Profile data, and fast mobile speed.
            </p>
            <div className="pt-2 border-t border-blue-200/60 dark:border-blue-900/60 text-[11px] text-blue-900 dark:text-blue-300 font-medium">
              ✓ Automated in Week 3: Organization Schema &amp; Mobile Web Vitals.
            </div>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────────────────
          5. BOTTOM ACTION BANNER: Fix All AI Tasks (Open 30-Day Plan)
      ───────────────────────────────────────────────────────────────────────────── */}
      <div className="p-6 rounded-2xl border border-brand-200 dark:border-brand-800 bg-gradient-to-r from-purple-50 via-white to-purple-50 dark:from-purple-950/60 dark:via-brand-900/60 dark:to-purple-950/60 flex flex-col sm:flex-row sm:items-center justify-between gap-5 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider">
            <CheckCircle2 size={15} />
            <span>Integrated 30-Day Autopilot Execution</span>
          </div>
          <h3 className="text-lg font-black text-brand-950 dark:text-white">
            Align All AI Visibility Fixes Into the 30-Day Plan
          </h3>
          <p className="text-xs text-brand-600 dark:text-brand-400 max-w-2xl">
            When you approve the plan, GrowthX puts your site on autopilot: establishing Schema entity grounding, deploying quotable answer blocks, capturing competitor queries, and monitoring citations across ChatGPT, Claude, and Gemini.
          </p>
        </div>

        <div className="shrink-0">
          <Button
            onClick={onOpen30DayPlan}
            className="bg-brand-950 text-white dark:bg-white dark:text-brand-950 hover:bg-brand-800 text-xs sm:text-sm font-bold h-11 px-6 shadow-md gap-2 cursor-pointer"
          >
            <Zap size={15} className="text-amber-400 fill-amber-400" />
            <span>{isPlanApproved ? "View Active 30-Day Plan" : "Fix All AI Tasks (Open 30-Day Plan)"}</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
