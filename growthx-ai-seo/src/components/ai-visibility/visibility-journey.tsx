"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  ArrowRightLeft,
  Building2,
  Check,
  ChevronDown,
  ChevronRight,
  Database,
  Globe,
  LayoutGrid,
  Pencil,
  Plus,
  Bot,
  Radar,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Target,
  Trash2,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/hooks/use-growthx";
import { useSubscription, DEFAULT_SUBSCRIPTION_LIMITS } from "@/lib/subscription-engine";
import { stagingEngine } from "@/lib/staging-engine";
import { api, visibilityJourneyApi } from "@/lib/api-client";
import {
  journeyRunning,
  providerName,
  type BuyerQuestion,
  type VisibilityAnswer,
  type VisibilityAssessment,
  type VisibilityBrief,
  type VisibilityContext,
} from "@/lib/visibility-workflow";
import { ActionButton, PageHeader, Panel, Pill, StatusNote, Table, Th, Tr, Td } from "@/components/ui/console";
import { QueryState } from "@/components/ui/query-state";
import { EvidenceLinks, AnswerResults, GapResults } from "./visibility-journey-results";
import { GapPlanModal } from "./gap-plan-modal";
import { GscSuggestedPromptsSection } from "./gsc-suggested-prompts";
import { IndiaLocalizationDock } from "./india-localization-dock";
import { AiSerpVisualizer } from "./ai-serp-visualizer";

export function VisibilityJourneyPage() {
  const workspace = useWorkspace();
  return <QueryState isLoading={workspace.isLoading} error={workspace.error} isEmpty={!workspace.projectId} emptyTitle="Choose a business" emptyBody="Select a workspace to check its AI visibility.">
    {workspace.projectId && <Journey key={workspace.projectId} projectId={workspace.projectId} />}
  </QueryState>;
}

function Journey({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const { orgId, projects } = useWorkspace();
  const { subscription, plan } = useSubscription(orgId);
  const aiCyclesGranted = subscription ? subscription.limits.aiCycles : DEFAULT_SUBSCRIPTION_LIMITS.aiCycles;
  const currentProject = projects.find((p) => p.id === projectId);
  const currentDomain = currentProject?.name || null;

  const searchParams = useSearchParams();
  const rawTab = searchParams?.get("tab");
  const [activeTab, setActiveTab] = useState<"prompts" | "simulator" | "answers">(() => {
    if (rawTab === "simulator") return "simulator";
    if (rawTab === "answers") return "answers";
    return "prompts";
  });

  const handleSelectTab = (tab: "prompts" | "simulator" | "answers") => {
    setActiveTab(tab);
    try {
      const params = new URLSearchParams(window.location.search);
      params.set("tab", tab);
      window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`);
    } catch {
      // ignore
    }
  };

  const key = ["visibility-journey", projectId];
  const query = useQuery({ queryKey: key, queryFn: () => visibilityJourneyApi.read(projectId), retry: false,
    refetchInterval: (q) => journeyRunning(q.state.data?.journey?.status) ? 4000 : false });
  const data = query.data;
  const run = data?.journey;
  const refresh = () => qc.invalidateQueries({ queryKey: key });
  const prepare = useMutation({ mutationFn: () => visibilityJourneyApi.prepare(projectId), retry: false,
    onSuccess: () => { void refresh(); }, onError: () => { void refresh(); } });
  const check = useMutation({ mutationFn: ({ id, brief }: { id: string; brief?: VisibilityBrief }) => visibilityJourneyApi.check(projectId, id, brief), retry: false,
    onSuccess: () => { void refresh(); }, onError: () => { void refresh(); } });
  const busy = journeyRunning(run?.status) || prepare.isPending || check.isPending;
  const configured = data?.providers.filter((p) => p.configured && !p.unavailableReason) ?? [];
  const assistantNames = new Intl.ListFormat("en", { style: "long", type: "conjunction" }).format(configured.map((p) => providerName(p.provider, p.model)));
  const error = prepare.error || check.error;

  const measured = data?.answers?.filter((a) => !a.errorMessage && a.analysis) ?? [];
  const recommended = measured.filter((a) => a.analysis?.recommended).length;
  const recommendationRate = measured.length ? Math.round((recommended / measured.length) * 100) : 0;

  const chatGptAnswers = measured.filter((a) => answerMatchesEngine(a, "ChatGPT"));
  const chatGptRec = chatGptAnswers.filter((a) => a.analysis?.recommended).length;
  const chatGptPct = chatGptAnswers.length ? Math.round((chatGptRec / chatGptAnswers.length) * 100) : null;

  const googleAiAnswers = measured.filter((a) => answerMatchesEngine(a, "Google AI"));
  const googleAiRec = googleAiAnswers.filter((a) => a.analysis?.recommended).length;
  const googleAiPct = googleAiAnswers.length ? Math.round((googleAiRec / googleAiAnswers.length) * 100) : null;

  const claudeAnswers = measured.filter((a) => answerMatchesEngine(a, "Claude"));
  const claudeRec = claudeAnswers.filter((a) => a.analysis?.recommended).length;
  const claudePct = claudeAnswers.length ? Math.round((claudeRec / claudeAnswers.length) * 100) : null;

  const perplexityAnswers = measured.filter((a) => answerMatchesEngine(a, "Perplexity"));
  const perplexityRec = perplexityAnswers.filter((a) => a.analysis?.recommended).length;
  const perplexityPct = perplexityAnswers.length ? Math.round((perplexityRec / perplexityAnswers.length) * 100) : null;

  const competitorIntercepts = measured.filter((a) => {
    const rival = a.mentions?.find((m) => !m.isCustomer)?.brandName;
    return Boolean(rival) && !a.analysis?.recommended;
  });

  const [stagedDefense, setStagedDefense] = useState<Set<string>>(() => {
    if (!projectId) return new Set();
    const existing = stagingEngine.getStaged(projectId);
    return new Set(existing.map((item) => item.title));
  });

  const handleStageKnowledgeGraphDefense = () => {
    const title = "Deploy High-Authority Organization & Product JSON-LD Knowledge Graph";
    stagingEngine.stage(projectId, {
      title,
      category: "AI Visibility & GEO",
      source: "AI_VISIBILITY",
      priority: "CRITICAL",
      impact: "Embed structured entity schema with sameAs social profiles and product taxonomy to anchor brand facts in LLM pre-training datasets and search retrieval engines.",
      effortHours: 2,
      deliverable: [
        "1. Author Organization and WebSite schema with verified sameAs Wikidata/Crunchbase references.",
        "2. Add Product and Service JSON-LD with aggregateRating and official feature specs.",
        "3. Validate via Google Rich Results and Schema Validator.",
      ].join("\n"),
      evidence: `Active monitoring across ${configured.length} generative AI engines`,
    });
    setStagedDefense((prev) => new Set(prev).add(title));
  };

  const handleStageCounterHallucination = () => {
    const title = "Targeted FAQPage & Comparative Schema for Anti-Hallucination Retrieval";
    stagingEngine.stage(projectId, {
      title,
      category: "AI Visibility & GEO",
      source: "AI_VISIBILITY",
      priority: "HIGH",
      impact: "Publish verified factual comparison tables and structured Q&A to counteract LLM hallucination and competitor misattribution.",
      effortHours: 2,
      deliverable: [
        "1. Write clear, unambiguous factual answers for top customer decision queries.",
        "2. Embed FAQPage schema markup on high-traffic comparison landing pages.",
        "3. Ensure semantic clarity so RAG crawlers (PerplexityBot, GPTBot) extract authoritative text.",
      ].join("\n"),
      evidence: `${competitorIntercepts.length} competitor intercepts recorded in AI search prompts`,
    });
    setStagedDefense((prev) => new Set(prev).add(title));
  };

  return <div className="space-y-5 pb-12">
    <PageHeader title="AI Visibility" subtitle="Monitor AI recommendations and brand citations across LLMs." actions={<>
      {run && <ActionButton disabled={busy || !configured.length || query.isLoading} icon={<Bot size={14} />} onClick={() => prepare.mutate()}>Start a new analysis</ActionButton>}
      <ActionButton aria-label="Refresh AI Visibility status" icon={<RefreshCw size={14} />} onClick={() => void refresh()}>Refresh</ActionButton>
    </>} />

    {/* ── EXECUTIVE AI VISIBILITY TELEMETRY RIBBON ── */}
    <div className="rounded-2xl border border-brand-200/80 bg-surface-1 p-4 shadow-2xs">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-signal-400 text-signal-ink font-bold shadow-2xs">
              <Bot size={18} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-[14.5px] font-bold text-brand-950">
                  AI Recommendation Health
                </h2>
                {measured.length > 0 ? (
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-0.5 text-[10.5px] font-mono font-bold",
                      recommendationRate >= 50
                        ? "bg-success-50 text-success-700 border border-success-200/60"
                        : recommendationRate > 0
                          ? "bg-warning-50 text-warning-800 border border-warning-200/60"
                          : "bg-error-50 text-error-700 border border-error-200/60",
                    )}
                  >
                    {recommendationRate}% Cited ({recommended}/{measured.length})
                  </span>
                ) : (
                  <span className="rounded-full bg-signal-400/15 border border-signal-400/30 px-2.5 py-0.5 text-[10.5px] font-mono font-bold text-signal-400">
                    {configured.length} Engines Connected
                  </span>
                )}
                {busy && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-signal-400/40 bg-signal-400/10 px-2.5 py-0.5 text-[10px] font-mono font-bold text-brand-950">
                    <span className="h-1.5 w-1.5 rounded-full bg-signal-400 animate-pulse" />
                    Live Analysis Running
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-[11.5px] text-brand-400">
                Live synthesis across ChatGPT, Gemini, Claude, and Perplexity.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/fix-engine"
              className="inline-flex items-center gap-1.5 rounded-lg bg-signal-400 px-3.5 py-1.5 text-[11.5px] font-bold text-signal-ink shadow-xs transition-all hover:bg-signal-500 active:scale-[0.98]"
            >
              <Zap size={12} className="text-signal-ink" />
              <span>Fix Engine</span>
              <ArrowRight size={12} />
            </Link>
            <Link
              href="/competitor-intelligence?tab=gaps"
              className="inline-flex items-center gap-1.5 rounded-lg border border-brand-200/80 bg-surface-1 px-3.5 py-1.5 text-[11.5px] font-semibold text-brand-800 hover:bg-brand-50 hover:text-brand-950 transition-colors shadow-2xs"
            >
              <span>Competitor Gaps</span>
              <ArrowRight size={12} />
            </Link>
          </div>
        </div>

        {/* ── GEO CITATION INDEX MULTI-LLM BREAKDOWN ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
          {/* ChatGPT */}
          <div className="flex items-center justify-between rounded-xl border border-brand-200/80 bg-surface-2 p-2.5 text-left shadow-2xs">
            <div className="min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-brand-600 font-mono block">ChatGPT Engine</span>
              <span className="text-base font-extrabold text-brand-950 font-mono">
                {chatGptPct != null ? `${chatGptPct}%` : "Monitored"}
              </span>
              <span className="text-[10px] text-brand-500 block truncate font-mono">
                {chatGptAnswers.length ? `${chatGptRec}/${chatGptAnswers.length} cited` : "Ready"}
              </span>
            </div>
            <div className="h-6 w-6 rounded-full bg-brand-100 flex items-center justify-center shrink-0">
              <ChatGptIcon className="h-3.5 w-3.5 text-brand-800" />
            </div>
          </div>

          {/* Google AI / Gemini */}
          <div className="flex items-center justify-between rounded-xl border border-brand-200/80 bg-surface-2 p-2.5 text-left shadow-2xs">
            <div className="min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-brand-600 font-mono block">Google Gemini</span>
              <span className="text-base font-extrabold text-brand-950 font-mono">
                {googleAiPct != null ? `${googleAiPct}%` : "Monitored"}
              </span>
              <span className="text-[10px] text-brand-500 block truncate font-mono">
                {googleAiAnswers.length ? `${googleAiRec}/${googleAiAnswers.length} cited` : "Ready"}
              </span>
            </div>
            <div className="h-6 w-6 rounded-full bg-brand-100 flex items-center justify-center shrink-0">
              <GoogleAiIcon className="h-3.5 w-3.5" />
            </div>
          </div>

          {/* Perplexity */}
          <div className="flex items-center justify-between rounded-xl border border-brand-200/80 bg-surface-2 p-2.5 text-left shadow-2xs">
            <div className="min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-brand-600 font-mono block">Perplexity GEO</span>
              <span className="text-base font-extrabold text-brand-950 font-mono">
                {perplexityPct != null ? `${perplexityPct}%` : "Monitored"}
              </span>
              <span className="text-[10px] text-brand-500 block truncate font-mono">
                {perplexityAnswers.length ? `${perplexityRec}/${perplexityAnswers.length} cited` : "Ready"}
              </span>
            </div>
            <div className="h-6 w-6 rounded-full bg-brand-100 flex items-center justify-center shrink-0">
              <PerplexityIcon className="h-3.5 w-3.5" />
            </div>
          </div>

          {/* Claude */}
          <div className="flex items-center justify-between rounded-xl border border-brand-200/80 bg-surface-2 p-2.5 text-left shadow-2xs">
            <div className="min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-brand-600 font-mono block">Claude Engine</span>
              <span className="text-base font-extrabold text-brand-950 font-mono">
                {claudePct != null ? `${claudePct}%` : "Monitored"}
              </span>
              <span className="text-[10px] text-brand-500 block truncate font-mono">
                {claudeAnswers.length ? `${claudeRec}/${claudeAnswers.length} cited` : "Ready"}
              </span>
            </div>
            <div className="h-6 w-6 rounded-full bg-brand-100 flex items-center justify-center shrink-0">
              <ClaudeIcon className="h-3.5 w-3.5" />
            </div>
          </div>
        </div>

        {/* ── AUTONOMOUS ENTITY & SENTIMENT DEFENSE TRAY ── */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-200/60 bg-brand-50/40 p-2.5 text-xs">
          <div className="flex items-center gap-2">
            <ShieldCheck size={14} className="text-signal-400 shrink-0" />
            <span className="font-semibold text-brand-950 text-[11.5px]">
              Entity Defense:
            </span>
            <span className="text-brand-500 text-[11px]">
              {competitorIntercepts.length > 0
                ? `${competitorIntercepts.length} competitor intercepts recorded in prompts.`
                : "Brand citations stable across connected generative engines."}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {stagedDefense.has("Deploy High-Authority Organization & Product JSON-LD Knowledge Graph") ? (
              <span className="inline-flex items-center gap-1 rounded-lg border border-success-200 bg-success-50 px-2.5 py-1 text-[11px] font-bold text-success-700 font-mono">
                <Check size={11} className="text-success-600" />
                <span>Knowledge Graph Staged</span>
              </span>
            ) : (
              <button
                type="button"
                onClick={handleStageKnowledgeGraphDefense}
                className="inline-flex items-center gap-1 rounded-lg bg-signal-400 hover:bg-signal-500 text-signal-ink px-2.5 py-1 text-[11px] font-bold transition shadow-2xs cursor-pointer"
              >
                <Zap size={11} className="text-signal-ink" />
                <span>Stage Knowledge Graph</span>
              </button>
            )}

            {stagedDefense.has("Targeted FAQPage & Comparative Schema for Anti-Hallucination Retrieval") ? (
              <span className="inline-flex items-center gap-1 rounded-lg border border-success-200 bg-success-50 px-2.5 py-1 text-[11px] font-bold text-success-700 font-mono">
                <Check size={11} className="text-success-600" />
                <span>Anti-Hallucination Staged</span>
              </span>
            ) : (
              <button
                type="button"
                onClick={handleStageCounterHallucination}
                className="inline-flex items-center gap-1 rounded-lg border border-brand-200/80 bg-surface-1 hover:bg-surface-2 text-brand-950 px-2.5 py-1 text-[11px] font-bold transition shadow-2xs cursor-pointer"
              >
                <Zap size={11} className="text-signal-400" />
                <span>Stage FAQ Defense</span>
              </button>
            )}
          </div>
        </div>

        {/* Active Engines Badge Strip */}
        <div className="flex flex-wrap items-center gap-2 border-t border-brand-200/60 pt-3">
          <span className="text-[11px] font-semibold text-brand-400">Monitored LLM Engines:</span>
          {configured.map((p) => (
            <span
              key={p.provider}
              className="inline-flex items-center gap-1.5 rounded-full border border-brand-200/70 bg-surface-2 px-2.5 py-1 text-[11px] font-semibold text-brand-800"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-signal-400" />
              <span>{providerName(p.provider, p.model)}</span>
            </span>
          ))}
        </div>
      </div>
    </div>

    {/* ── HIGH-LEVEL NAVIGATION TABS: MATRIX vs SERP SIMULATOR vs RAW RESPONSES ── */}
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-brand-200/80 pb-3">
      <div className="flex flex-wrap items-center gap-2 p-1 rounded-2xl bg-surface-2 border border-brand-200/80 shadow-2xs">
        <button
          type="button"
          onClick={() => handleSelectTab("prompts")}
          className={cn(
            "inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition cursor-pointer",
            activeTab === "prompts"
              ? "bg-surface-1 text-brand-950 shadow-xs border border-brand-200 font-extrabold"
              : "text-brand-600 hover:text-brand-950 hover:bg-surface-3"
          )}
        >
          <LayoutGrid size={14} className={activeTab === "prompts" ? "text-signal-500" : "text-brand-400"} />
          <span>Tracked Prompts</span>
          <span className="rounded-full bg-brand-100 px-1.5 py-0.2 text-[10px] font-mono text-brand-700">
            {run?.brief?.questions?.length ?? 0}
          </span>
        </button>

        <button
          type="button"
          onClick={() => handleSelectTab("simulator")}
          className={cn(
            "inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition cursor-pointer",
            activeTab === "simulator"
              ? "bg-surface-1 text-brand-950 shadow-xs border border-brand-200 font-extrabold"
              : "text-brand-600 hover:text-brand-950 hover:bg-surface-3"
          )}
        >
          <Sparkles size={14} className={activeTab === "simulator" ? "text-signal-500" : "text-brand-400"} />
          <span>SERP Simulator</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-signal-400/20 px-2 py-0.2 text-[10px] font-mono text-brand-900 border border-brand-200">
            <span className="h-1.5 w-1.5 rounded-full bg-signal-500 animate-pulse" />
            Live
          </span>
        </button>

        <button
          type="button"
          onClick={() => handleSelectTab("answers")}
          className={cn(
            "inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition cursor-pointer",
            activeTab === "answers"
              ? "bg-surface-1 text-brand-950 shadow-xs border border-brand-200 font-extrabold"
              : "text-brand-600 hover:text-brand-950 hover:bg-surface-3"
          )}
        >
          <Bot size={14} className={activeTab === "answers" ? "text-signal-500" : "text-brand-400"} />
          <span>Model Responses</span>
          <span className="rounded-full bg-brand-100 px-1.5 py-0.2 text-[10px] font-mono text-brand-700">
            {data?.answers?.length ?? 0}
          </span>
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-brand-500">
          Target Domain: <strong className="font-mono text-brand-950">{currentDomain || "Workspace Domain"}</strong>
        </span>
        <Link
          href="/settings?tab=subscription"
          title="Click to view subscription plan & monthly cycle limits"
          className="inline-flex items-center gap-1.5 rounded-lg border border-brand-200/80 bg-surface-2 px-2.5 py-1 text-xs font-semibold text-brand-800 hover:bg-surface-3 transition"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-signal-400" />
          <span><strong>{run ? 1 : 0} / {aiCyclesGranted}</strong> AI Cycles Used</span>
          <ArrowRight size={11} className="text-brand-400" />
        </Link>
      </div>
    </div>

    {/* ── AI VISIBILITY CYCLE LIMIT WARNING BANNER ── */}
    {run && aiCyclesGranted <= 1 && (
      <div className="rounded-2xl border border-brand-200/80 bg-surface-1 p-4 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-signal-400 text-signal-ink font-bold">
            <Bot size={16} />
          </div>
          <div>
            <p className="text-xs font-bold text-brand-950">
              Monthly cycle limit reached (1/{aiCyclesGranted} used)
            </p>
            <p className="text-[11px] text-brand-500">
              Upgrade to Growth or Agency for up to 50 monthly cycles.
            </p>
          </div>
        </div>
        <Link
          href="/settings?tab=subscription"
          className="inline-flex items-center gap-1.5 rounded-xl bg-signal-400 px-3.5 py-1.5 text-xs font-bold text-signal-ink hover:bg-signal-500 transition shadow-2xs shrink-0"
        >
          <span>Upgrade Cycles</span>
          <ArrowRight size={12} />
        </Link>
      </div>
    )}

    <QueryState isLoading={query.isLoading} error={query.error}>
      {error && <StatusNote tone="bad">{error.message}</StatusNote>}
      {data && !configured.length && <StatusNote tone="bad">AI checks are temporarily unavailable. Please contact support.</StatusNote>}
      {!run && <Panel padded>
        <div className="mx-auto max-w-xl space-y-4 py-8 text-center">
          <Bot className="mx-auto text-primary-600" size={28} />
          <h2 className="text-xl font-semibold text-brand-950">See your business through your buyers’ prompts</h2>
          <p className="text-sm leading-6 text-brand-600">We use your website audit to draft relevant buyer prompts. You review them, we ask the available AI assistants, and you get real answers showing where your business is recommended.</p>
          <ActionButton variant="primary" disabled={busy || !configured.length || query.isLoading} onClick={() => prepare.mutate()}>{prepare.isPending ? "Preparing your prompts…" : "Prepare my prompts"}</ActionButton>
          <p className="text-xs text-brand-500">Your Website Audit is the starting point. Connected Google data and audited competitors add context.</p>
        </div>
      </Panel>}
      {run && <>
        {busy && (
          <Panel padded>
            <div role="status" aria-live="polite" className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-brand-200 bg-surface-2 text-brand-950 shadow-2xs">
                    <Radar size={18} className="text-signal-400 animate-spin" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold tracking-tight text-brand-950 sm:text-base">
                      AI Search Visibility Analysis
                    </h3>
                    <p className="mt-0.5 text-xs text-brand-500 font-medium">
                      {run.phase === "PREPARE"
                        ? "Understanding your business profile & preparing buyer prompts…"
                        : run.status === "QUEUED"
                          ? "Connecting to AI search models & initializing query queue…"
                          : run.status === "CHECKING"
                            ? `Asking ${assistantNames} your buyer prompts`
                            : "Analyzing model responses & calculating recommendation share…"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-center">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-surface-2 px-3 py-1 font-mono text-xs font-extrabold text-brand-950">
                    <span className="h-1.5 w-1.5 rounded-full bg-signal-400 animate-pulse" />
                    <span>{run.progress}%</span>
                  </span>
                </div>
              </div>

              {/* Modern Sleek Progress Bar */}
              <div
                role="progressbar"
                aria-label="AI Visibility progress"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={run.progress}
                className="h-2.5 w-full overflow-hidden rounded-full border border-brand-200 bg-surface-2 p-0.5"
              >
                <div
                  className="h-full rounded-full bg-signal-400 transition-all duration-500 relative"
                  style={{ width: `${Math.min(100, Math.max(0, run.progress))}%` }}
                />
              </div>

              {/* Telemetry Row: Active AI Engines & Real-time Auto-save */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 pt-0.5 text-xs text-brand-500">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-brand-400 mr-0.5">
                    Measuring Engines:
                  </span>
                  {configured.map((p) => (
                    <span
                      key={p.provider}
                      className="inline-flex items-center gap-1 rounded-md border border-brand-200 bg-surface-2 px-2 py-0.5 font-mono text-[10px] font-semibold text-brand-700"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-signal-400" />
                      {providerName(p.provider, p.model)}
                    </span>
                  ))}
                </div>

                <p className="flex items-center gap-1 text-[11px] text-brand-500 font-medium">
                  <ShieldCheck size={12} className="text-success-500 shrink-0" />
                  <span>Progress is saved automatically &middot; Safe to leave or return</span>
                </p>
              </div>
            </div>
          </Panel>
        )}
        {run.status === "FAILED" && <StatusNote tone="bad">This analysis did not complete. Start a new analysis to try again.</StatusNote>}

        {/* ── INDIA-AWARE LOCALIZATION DOCK & LANGUAGE SPLIT ── */}
        <IndiaLocalizationDock projectId={projectId} />

        {/* TAB 1: SERP SIMULATOR */}
        {activeTab === "simulator" && (
          <AiSerpVisualizer
            projectId={projectId}
            businessName={run.brief?.businessName || currentProject?.name || "Your Business"}
            domain={currentDomain}
            prompts={run.brief?.questions ?? []}
            answers={data?.answers ?? []}
            configuredEngines={data?.providers ?? []}
          />
        )}

        {/* TAB 2: PROMPTS & GAP MATRIX */}
        {activeTab === "prompts" && (
          run.brief ? (
            <PromptsSection
              projectId={projectId}
              key={`${run.id}-${run.updatedAt}`}
              brief={run.brief}
              locked={busy || !!run.scanId}
              checks={configured.length * run.brief.questions.length}
              pending={check.isPending}
              onRun={(brief) => check.mutate({ id: run.id, brief })}
              answers={data?.answers ?? []}
              providers={data?.providers ?? []}
              hasScan={!!run.scanId}
              onViewResults={() => handleSelectTab("answers")}
              onOpenSimulator={() => handleSelectTab("simulator")}
            />
          ) : (
            <Panel title="Review before you run" subtitle="Check your products, service areas and buyer prompts. Then confirm to start the AI checks." padded>
              <p className="text-sm text-brand-500">{busy ? "Your business details and prompts will appear here when ready." : "Your business details are not ready. Start a new analysis to retry."}</p>
            </Panel>
          )
        )}

        {/* TAB 3: MODEL RESPONSES & CITATIONS */}
        {activeTab === "answers" && (
          data && data.answers.length > 0 ? (
            <div className="space-y-6">
              <AnswerResults data={data} projectId={projectId} />
              <GapResults data={data} projectId={projectId} />
            </div>
          ) : (
            <Panel padded>
              <div className="mx-auto max-w-md space-y-3 py-8 text-center">
                <Bot className="mx-auto text-brand-400" size={24} />
                <h3 className="text-base font-bold text-brand-950">No Model Responses Saved Yet</h3>
                <p className="text-xs text-brand-500">
                  Confirm your buyer prompts in the &quot;Tracked Prompts&quot; tab to trigger multi-LLM checks across ChatGPT, Google Gemini, and Perplexity.
                </p>
                <button
                  type="button"
                  onClick={() => handleSelectTab("prompts")}
                  className="rounded-lg bg-signal-400 px-3 py-1.5 text-xs font-bold text-signal-ink hover:bg-signal-500 transition cursor-pointer"
                >
                  Go to Tracked Prompts &rarr;
                </button>
              </div>
            </Panel>
          )
        )}
      </>}
    </QueryState>
  </div>;
}

function SourceCards({ context }: { context: VisibilityContext }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {context.sources.map((s) => (
        <Panel key={s.id} padded>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-brand-950">
              {s.label}
            </span>
            {s.available ? (
              <Check size={15} className="text-success-600" />
            ) : (
              <Database size={15} className="text-warning-600" />
            )}
          </div>
          <p className="mt-2 text-xs leading-5 text-brand-600">{s.detail}</p>
          <p className="mt-2 text-[11px] text-brand-400">
            {s.updatedAt
              ? `Source updated ${new Date(s.updatedAt).toLocaleDateString()}`
              : "No saved source date"}
          </p>
          <Link
            className="mt-3 inline-block text-xs font-semibold text-primary-700"
            href={s.href}
          >
            {s.available ? "Open source" : "Complete this source"} →
          </Link>
        </Panel>
      ))}
    </div>
  );
}

function LocalDemand({
  context,
  locations,
}: {
  context: VisibilityContext;
  locations: string[];
}) {
  return (
    <Panel
      title="Are visits coming from your service areas?"
      subtitle="GA4 visitor cities · last 28 days · reported top-city sample"
    >
      {context.cities.length ? (
        <Table minWidth={500}>
          <thead>
            <tr>
              <Th>Reported city</Th>
              <Th>Sessions</Th>
              <Th>Service-area match</Th>
            </tr>
          </thead>
          <tbody>
            {context.cities.map((c, i) => (
              <Tr key={`${c.city}-${i}`}>
                <Td>
                  {c.city}, {c.country}
                </Td>
                <Td>{c.sessions.toLocaleString()}</Td>
                <Td>
                  <Pill
                    tone={
                      locations.some(
                        (l) => l.toLowerCase() === c.city.toLowerCase(),
                      )
                        ? "good"
                        : "default"
                    }
                  >
                    {locations.some(
                      (l) => l.toLowerCase() === c.city.toLowerCase(),
                    )
                      ? "Named service area"
                      : "Review location"}
                  </Pill>
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      ) : (
        <p className="p-4 text-sm text-brand-500">
          City traffic is not available. Sync GA4 to compare visits with your
          service areas.
        </p>
      )}
      <p className="border-t p-4 text-xs leading-5 text-brand-500">
        Nearby neighbourhoods can be reported under a larger city. Unmatched
        cities need review; this sample does not establish the share of all
        traffic outside your area.{" "}
        {context.keyEvents === null
          ? "Lead measurement is unknown because key-event data is unavailable."
          : `${context.keyEvents.toLocaleString()} key events recorded; check that they represent qualified leads.`}
      </p>
    </Panel>
  );
}

function ChatGptIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-label="ChatGPT" role="img">
      <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.259 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7466-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.6667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z" />
    </svg>
  );
}

function GoogleAiIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return <img src="https://cdn.simpleicons.org/googlegemini" alt="Google Gemini" className={className} />;
}

function ClaudeIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return <img src="https://cdn.simpleicons.org/claude" alt="Claude" className={className} />;
}

function PerplexityIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return <img src="https://cdn.simpleicons.org/perplexity" alt="Perplexity" className={className} />;
}

type PromptCategory = "best-of" | "jobs-to-be-done" | "competitor" | "branded";

const ALL_PROMPT_CATEGORIES: PromptCategory[] = [
  "best-of",
  "jobs-to-be-done",
  "competitor",
  "branded",
];

function explicitPromptCategory(intentRaw: string): PromptCategory | null {
  const intent = intentRaw.toLowerCase().trim();
  if (intent === "branded" || intent === "brand") return "branded";
  if (intent === "competitor") return "competitor";
  if (intent === "problem" || intent === "jobs-to-be-done") return "jobs-to-be-done";
  if (intent === "best-of" || intent === "best of") return "best-of";
  return null;
}

function scorePromptCategory(q: BuyerQuestion, businessName: string): PromptCategory {
  const explicit = explicitPromptCategory(q.intent || "");
  if (explicit) return explicit;

  const intent = (q.intent || "").toLowerCase().trim();
  const text = `${q.text || ""} ${q.rationale || ""}`.toLowerCase();
  const bName = (businessName || "").toLowerCase().trim();

  if (
    intent.includes("brand") ||
    intent.includes("trust") ||
    intent.includes("quality") ||
    (bName.length > 2 && text.includes(bName)) ||
    text.includes("subscription") ||
    text.includes("trial") ||
    text.includes("pure") ||
    text.includes("fresh") ||
    text.includes("farm") ||
    text.includes("glass bottle") ||
    text.includes("a2")
  ) {
    return "branded";
  }
  if (
    intent.includes("compet") ||
    intent.includes("compar") ||
    text.includes(" vs ") ||
    text.includes("versus") ||
    text.includes("alternative") ||
    text.includes("better than") ||
    text.includes("compare") ||
    text.includes("which suppliers") ||
    text.includes("what suppliers") ||
    text.includes("who supplies") ||
    text.includes("what options") ||
    text.includes("suppliers") ||
    text.includes("providers")
  ) {
    return "competitor";
  }
  if (
    intent.includes("best") ||
    intent.includes("recommend") ||
    intent.includes("top") ||
    text.startsWith("best ") ||
    text.startsWith("top ") ||
    text.includes(" best ") ||
    text.includes(" top ") ||
    text.includes("leading") ||
    text.includes("highest rated")
  ) {
    return "best-of";
  }
  if (
    intent.includes("action") ||
    intent.includes("job") ||
    intent.includes("task") ||
    intent.includes("service") ||
    intent.includes("deliver") ||
    text.includes("how ") ||
    text.includes("where ") ||
    text.includes("deliver") ||
    text.includes("buy ") ||
    text.includes("order")
  ) {
    return "jobs-to-be-done";
  }
  return "best-of";
}

function categorizeQuestions(questions: BuyerQuestion[], businessName: string): PromptCategory[] {
  const assigned = questions.map((q) => scorePromptCategory(q, businessName));
  if (questions.length < 4) return assigned;

  // Ensure every category card has coverage when prompts do not have explicit manual overrides
  const counts: Record<PromptCategory, number> = {
    "best-of": 0,
    "jobs-to-be-done": 0,
    competitor: 0,
    branded: 0,
  };
  assigned.forEach((cat) => {
    counts[cat] += 1;
  });

  for (const targetCat of ALL_PROMPT_CATEGORIES) {
    if (counts[targetCat] > 0) continue;
    // Find a donor category with the highest count (> 1) whose question wasn't explicitly locked
    let donorIdx = -1;
    let maxDonorCount = 1;
    for (let i = questions.length - 1; i >= 0; i--) {
      if (explicitPromptCategory(questions[i].intent || "")) continue;
      const c = assigned[i];
      if (counts[c] > maxDonorCount) {
        maxDonorCount = counts[c];
        donorIdx = i;
      }
    }
    if (donorIdx !== -1) {
      counts[assigned[donorIdx]] -= 1;
      assigned[donorIdx] = targetCat;
      counts[targetCat] += 1;
    }
  }

  return assigned;
}

function matchPrompt(textA: string, textB: string): boolean {
  if (!textA || !textB) return false;
  const a = textA.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  const b = textB.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  return a === b || a.includes(b) || b.includes(a);
}

export type SupportedEngine = "ChatGPT" | "Google AI" | "Claude" | "Perplexity";

export type BuyerPersona = "ALL" | "CTO" | "CMO" | "DEV" | "BUYER";

export function matchBuyerPersona(questionText: string, persona: BuyerPersona): boolean {
  if (persona === "ALL") return true;
  const q = (questionText || "").toLowerCase();
  if (persona === "CTO") {
    return q.includes("security") || q.includes("architecture") || q.includes("scale") || q.includes("compliance") || q.includes("reliable") || q.includes("enterprise") || q.includes("performance") || q.includes("uptime") || q.includes("glass bottle") || q.includes("a2");
  }
  if (persona === "CMO") {
    return q.includes("best") || q.includes("compare") || q.includes("vs") || q.includes("alternative") || q.includes("brand") || q.includes("review") || q.includes("market") || q.includes("leader") || q.includes("recommend");
  }
  if (persona === "DEV") {
    return q.includes("how to") || q.includes("setup") || q.includes("code") || q.includes("api") || q.includes("integrate") || q.includes("tool") || q.includes("steps") || q.includes("how do");
  }
  if (persona === "BUYER") {
    return q.includes("cost") || q.includes("price") || q.includes("plan") || q.includes("subscription") || q.includes("pricing") || q.includes("cheap") || q.includes("affordable") || q.includes("contract") || q.includes("supplier") || q.includes("delivery");
  }
  return true;
}

interface EngineCitation {
  engine: SupportedEngine;
  status: "recommended" | "competitor" | "not_cited" | "pending";
  label: string;
  competitor?: string | null;
  competitorDomain?: string | null;
  quote?: string | null;
}

const ENGINES: {
  key: "chatGpt" | "googleAi" | "claude" | "perplexity";
  name: SupportedEngine;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { key: "chatGpt", name: "ChatGPT", icon: ChatGptIcon },
  { key: "googleAi", name: "Google AI", icon: GoogleAiIcon },
  { key: "claude", name: "Claude", icon: ClaudeIcon },
  { key: "perplexity", name: "Perplexity", icon: PerplexityIcon },
];

function answerMatchesEngine(answer: VisibilityAnswer, engine: SupportedEngine) {
  const provider = (answer.provider || "").toUpperCase();
  const model = (answer.model || "").toUpperCase();

  switch (engine) {
    case "ChatGPT":
      return provider.includes("OPENAI") || provider.includes("CHATGPT") || provider.includes("GPT") || model.includes("GPT") || model.includes("OPENAI");
    case "Google AI":
      return provider.includes("GEMINI") || provider.includes("GOOGLE") || model.includes("GEMINI") || model.includes("GOOGLE");
    case "Claude":
      return provider.includes("ANTHROPIC") || provider.includes("CLAUDE") || model.includes("CLAUDE") || model.includes("ANTHROPIC");
    case "Perplexity":
      return provider.includes("PERPLEXITY") || model.includes("PERPLEXITY") || model.includes("SONAR");
  }
}

function modelsForEngine(answers: VisibilityAnswer[], engine: SupportedEngine) {
  return Array.from(new Set(
    answers
      .filter((answer) => answerMatchesEngine(answer, engine))
      .map((answer) => answer.model?.trim())
      .filter((model): model is string => Boolean(model)),
  ));
}

function matchingCitationDomain(brandName: string | null | undefined, answers: VisibilityAnswer[]) {
  if (!brandName) return null;
  const normalizedBrand = brandName.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!normalizedBrand) return null;
  return answers
    .flatMap((answer) => answer.citations || [])
    .map((citation) => citation.domain?.trim())
    .find((domain) => {
      const normalizedDomain = domain?.toLowerCase().replace(/[^a-z0-9]/g, "") || "";
      return normalizedDomain.includes(normalizedBrand);
    }) || null;
}

function BrandLogo({ name, domain }: { name: string; domain?: string | null }) {
  const [failed, setFailed] = useState(false);
  const initials = name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "?";

  if (!domain || failed) {
    return <span aria-hidden="true" className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface-3 text-[9px] font-bold text-brand-600">{initials}</span>;
  }

  return (
    <img
      src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`}
      alt=""
      aria-hidden="true"
      className="h-5 w-5 shrink-0 rounded-full bg-white object-contain p-0.5"
      onError={() => setFailed(true)}
    />
  );
}

function getEngineCitation(
  promptText: string,
  engine: SupportedEngine,
  answers: VisibilityAnswer[],
  businessName: string,
): EngineCitation {
  const matchingAnswer = answers.find(
    (answer) => matchPrompt(promptText, answer.promptText) && answerMatchesEngine(answer, engine),
  );
  if (!matchingAnswer) {
    return {
      engine,
      status: "pending",
      label: "Ready to check",
    };
  }

  if (matchingAnswer.errorMessage) {
    return {
      engine,
      status: "not_cited",
      label: "Check failed",
    };
  }

  if (!matchingAnswer.rawResponse?.trim()) return { engine, status: "pending", label: "No saved answer" };

  if (matchingAnswer.analysis?.recommended) {
    return {
      engine,
      status: "recommended",
      label: `Recommended: ${businessName}`,
      quote: matchingAnswer.analysis.parsedJson?.recommendationQuote || null,
    };
  }

  const rivalMention = matchingAnswer.mentions?.find((m) => !m.isCustomer)?.brandName;
  const bClean = businessName.toLowerCase().replace(/[^a-z0-9]/g, "");
  const rivalCitation = matchingAnswer.citations?.find((c) => {
    const d = (c.domain || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    return d && !d.includes(bClean);
  })?.domain;

  const rival = rivalMention || rivalCitation;
  if (rival) {
    return {
      engine,
      status: "competitor",
      label: `Cited instead: ${rival}`,
      competitor: rival,
      competitorDomain: matchingCitationDomain(rivalMention, [matchingAnswer]) || (rivalCitation === rival ? rivalCitation : null),
      quote: matchingAnswer.analysis?.parsedJson?.recommendationQuote || null,
    };
  }

  return {
    engine,
    status: "not_cited",
    label: matchingAnswer.analysis?.brandMentioned ? "Mentioned only" : "Not mentioned in answer",
    quote: matchingAnswer.analysis?.parsedJson?.recommendationQuote || null,
  };
}

function PromptsSection({
  projectId,
  brief,
  locked,
  checks,
  pending,
  onRun,
  answers = [],
  providers = [],
  hasScan,
  onViewResults,
  onOpenSimulator,
}: {
  projectId: string;
  brief: VisibilityBrief;
  locked: boolean;
  checks: number;
  pending: boolean;
  onRun: (brief: VisibilityBrief) => void;
  answers?: VisibilityAnswer[];
  providers?: { provider: string; configured: boolean; model: string | null }[];
  hasScan?: boolean;
  onViewResults?: () => void;
  onOpenSimulator?: () => void;
}) {
  const [draft, setDraft] = useState(brief);
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [expandedPrompt, setExpandedPrompt] = useState<number | null>(0);
  const [expandedGap, setExpandedGap] = useState<number | null>(0);
  const [filterCategory, setFilterCategory] = useState<PromptCategory | "ALL">("ALL");
  const [filterPersona, setFilterPersona] = useState<BuyerPersona>("ALL");
  const [cmoToast, setCmoToast] = useState<string | null>(null);
  const [activePlanGap, setActivePlanGap] = useState<{
    id: string;
    comp: { domain: string; name: string; count: number };
    promptText: string;
    priority: string;
  } | null>(null);

  const inputClass =
    "w-full rounded-lg border border-line bg-surface-1 px-3 py-2 text-sm text-brand-950 focus:border-primary-500 focus:outline-none";

  const ctoCount = draft.questions.filter((q) => matchBuyerPersona(q.text, "CTO")).length;
  const cmoCount = draft.questions.filter((q) => matchBuyerPersona(q.text, "CMO")).length;
  const devCount = draft.questions.filter((q) => matchBuyerPersona(q.text, "DEV")).length;
  const buyerCount = draft.questions.filter((q) => matchBuyerPersona(q.text, "BUYER")).length;

  // 1. Calculate stats for the 4 Okara category cards
  const categories: { key: PromptCategory; label: string; cardTone: "error" | "warning" | "success" }[] = [
    { key: "best-of", label: "Best-of", cardTone: "error" },
    { key: "jobs-to-be-done", label: "Jobs to be done", cardTone: "error" },
    { key: "competitor", label: "Competitor", cardTone: "warning" },
    { key: "branded", label: "Branded", cardTone: "success" },
  ];

  const questionCategories = categorizeQuestions(draft.questions, draft.businessName);

  const categoryStats = categories.map((cat) => {
    const promptsInCat = draft.questions.filter(
      (_, idx) => questionCategories[idx] === cat.key,
    );
    const answersForCat = answers.filter((a) =>
      !a.errorMessage && !!a.rawResponse?.trim() && !!a.analysis && promptsInCat.some((q) => matchPrompt(q.text, a.promptText)),
    );

    const total = answersForCat.length;
    const cited = answersForCat.filter(
      (a) => a.analysis?.recommended || a.analysis?.brandMentioned,
    ).length;

    const pct = total > 0 ? Math.round((cited / total) * 100) : null;
    const subtext =
      total > 0
        ? `mentioned in ${cited} of ${total} measured answers`
        : promptsInCat.length > 0
          ? `${promptsInCat.length} tracked prompt${promptsInCat.length === 1 ? "" : "s"} ready to check`
          : "0 prompts in this category";

    return {
      ...cat,
      count: promptsInCat.length,
      pct,
      subtext,
    };
  });

  // 2. Filtered prompts
  const buildPromptItem = (q: BuyerQuestion, originalIndex: number) => ({
    q,
    originalIndex,
    category: questionCategories[originalIndex] ?? "best-of",
    citations: {
      chatGpt: getEngineCitation(q.text, "ChatGPT", answers, draft.businessName),
      googleAi: getEngineCitation(q.text, "Google AI", answers, draft.businessName),
      claude: getEngineCitation(q.text, "Claude", answers, draft.businessName),
      perplexity: getEngineCitation(q.text, "Perplexity", answers, draft.businessName),
    },
  });

  const displayedPrompts = draft.questions
    .map(buildPromptItem)
    .filter(
      (item) =>
        (filterCategory === "ALL" || item.category === filterCategory) &&
        (filterPersona === "ALL" || matchBuyerPersona(item.q.text, filterPersona)),
    );

  const promptsToDisplay = isEditing
    ? draft.questions.map(buildPromptItem)
    : displayedPrompts;

  // 3. Build Gap Tasks (Screenshots 3, 4, 5)
  // Extract prompts with competitor citations or comparison intents
  interface GapItem {
    promptText: string;
    citedInsteadDisplay: string;
    priority: "High" | "Medium";
    competitors: { name: string; domain: string; count: number }[];
  }

  const gapItems: GapItem[] = [];

  // Check answers first
  for (const q of draft.questions) {
    const qAnswers = answers.filter((a) => !a.errorMessage && !!a.rawResponse?.trim() && matchPrompt(q.text, a.promptText));
    const competitorsCited = new Map<string, { count: number; domain: string }>();

    for (const a of qAnswers) {
      if (!a.analysis?.recommended) {
        for (const m of a.mentions || []) {
          if (!m.isCustomer && m.brandName) {
            const existing = competitorsCited.get(m.brandName);
            competitorsCited.set(m.brandName, { count: (existing?.count ?? 0) + 1, domain: existing?.domain ?? "" });
          }
        }
        for (const c of a.citations || []) {
          const dom = c.domain?.toLowerCase() || "";
          const bClean = draft.businessName.toLowerCase().replace(/[^a-z0-9]/g, "");
          if (dom && !dom.includes(bClean)) {
            competitorsCited.set(dom, { count: (competitorsCited.get(dom)?.count ?? 0) + 1, domain: dom });
          }
        }
      }
    }

    if (competitorsCited.size > 0) {
      // Only a saved citation supplies a website address, even for dotted brand names.
      const topCompetitors = [...competitorsCited.entries()].map(([name, evidence]) => ({ name, ...evidence }));
      const display = topCompetitors.length > 1
        ? `${topCompetitors[0].domain || topCompetitors[0].name} +${topCompetitors.length - 1}`
        : topCompetitors[0]?.domain || topCompetitors[0]?.name || "";

      const priority =
        scorePromptCategory(q, draft.businessName) === "best-of" || (topCompetitors[0]?.count ?? 0) >= 2
          ? "High"
          : "Medium";

      gapItems.push({
        promptText: q.text,
        citedInsteadDisplay: display,
        priority,
        competitors: topCompetitors,
      });
    }
  }

  const highPriorityGapsCount = gapItems.filter((g) => g.priority === "High").length;
  const totalActionsCount = gapItems.reduce((acc, g) => acc + g.competitors.length, 0);

  return (
    <div className="space-y-6">
      {/* Toast feedback for CMO actions */}
      {cmoToast && (
        <div className="flex items-center justify-between rounded-xl border border-success-200 bg-success-50 p-4 text-xs font-medium text-success-700 shadow-sm">
          <div className="flex items-center gap-2">
            <Check size={16} className="text-success-700" />
            <span>{cmoToast}</span>
          </div>
          <button
            onClick={() => setCmoToast(null)}
            className="text-success-700 hover:text-success-900"
            aria-label="Dismiss message"
          >
            ✕
          </button>
        </div>
      )}

      {/* Business details collapsible accordion */}
      <details className="rounded-xl border border-line bg-surface-1 p-4 shadow-card">
        <summary className="flex cursor-pointer items-center justify-between text-sm font-semibold text-brand-950">
          <div className="flex items-center gap-2">
            <Building2 size={16} className="text-brand-400" />
            <span>Business details · edit products and service areas</span>
          </div>
          <span className="text-xs font-normal text-brand-500">
            {draft.businessName} · {draft.locations.length} service area{draft.locations.length === 1 ? "" : "s"}
          </span>
        </summary>
        <div className="mt-4 border-t border-line pt-4 space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <label className="space-y-1.5 text-xs text-brand-600">
              <span className="font-medium text-brand-950">Business name</span>
              <input
                aria-label="Business name"
                className={inputClass}
                disabled={locked}
                value={draft.businessName}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, businessName: e.target.value }))
                }
              />
            </label>
            <label className="space-y-1.5 text-xs text-brand-600">
              <span className="font-medium text-brand-950">Offerings (comma separated)</span>
              <input
                aria-label="Offerings"
                className={inputClass}
                disabled={locked}
                value={draft.offerings.join(", ")}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    offerings: e.target.value.split(",").map((s) => s.trim()),
                  }))
                }
              />
            </label>
            <label className="space-y-1.5 text-xs text-brand-600">
              <span className="font-medium text-brand-950">Service areas (comma separated)</span>
              <input
                aria-label="Service areas"
                className={inputClass}
                disabled={locked}
                value={draft.locations.join(", ")}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    locations: e.target.value.split(",").map((s) => s.trim()),
                  }))
                }
              />
            </label>
          </div>
          {draft.summary && (
            <p className="text-xs leading-5 text-brand-500">{draft.summary}</p>
          )}
        </div>
      </details>

      {/* 4 Category Metric Cards (Refined Day & Night Theme) */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {categoryStats.map((cat) => {
          const isSelected = filterCategory === cat.key;
          return (
            <button
              key={cat.key}
              type="button"
              onClick={() =>
                setFilterCategory(filterCategory === cat.key ? "ALL" : cat.key)
              }
              className={cn(
                "flex flex-col rounded-2xl border p-4 text-left shadow-card transition-all focus-visible:outline-none",
                "bg-surface-1 hover:bg-surface-2",
                isSelected
                  ? "border-signal-400 ring-2 ring-signal-400/20"
                  : "border-brand-200 hover:border-brand-300",
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-brand-600">{cat.label}</span>
                <div className="flex items-center gap-1.5">
                  <span
                    className={cn(
                      "h-2 w-2 rounded-full",
                      cat.key === "best-of" || cat.key === "jobs-to-be-done"
                        ? "bg-warning-500"
                        : cat.key === "competitor"
                          ? "bg-primary-500"
                          : "bg-success-500",
                    )}
                  />
                  {isSelected && (
                    <span className="text-[10px] uppercase font-bold tracking-wider text-brand-950">
                      Active
                    </span>
                  )}
                </div>
              </div>
              <div className="mt-2 font-mono text-3xl font-extrabold tracking-tight text-brand-950">
                {cat.pct != null ? `${cat.pct}%` : `${cat.count}`}
              </div>
              <div className="mt-1 text-xs text-brand-500">{cat.subtext}</div>
            </button>
          );
        })}
      </div>

      {filterCategory !== "ALL" && (
        <div className="flex items-center justify-between px-1 text-xs text-brand-500">
          <span>
            Filtered by category:{" "}
            <strong className="text-brand-950">
              {categories.find((c) => c.key === filterCategory)?.label}
            </strong>
          </span>
          <button
            type="button"
            onClick={() => setFilterCategory("ALL")}
            className="font-medium text-primary-600 hover:underline"
          >
            Show all categories
          </button>
        </div>
      )}

      {/* ── BUYER PERSONA INTENT FRAMING DOCK ── */}
      <div className="flex flex-col gap-2 rounded-2xl border border-brand-200/80 bg-surface-1 p-3.5 shadow-2xs text-xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Radar size={14} className="text-signal-400" />
            <span className="font-bold text-brand-950 text-xs">
              Buyer Persona Intent Framing:
            </span>
            <span className="text-brand-500 text-[11px]">
              Simulate AI query formulation across decision-maker roles.
            </span>
          </div>
          <span className="text-[10.5px] font-mono text-brand-400">
            {promptsToDisplay.length} matching prompts
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          {[
            { id: "ALL", label: `All Roles (${draft.questions.length})` },
            { id: "CTO", label: `Enterprise CTO (${ctoCount})` },
            { id: "CMO", label: `Growth CMO (${cmoCount})` },
            { id: "DEV", label: `Product Engineer (${devCount})` },
            { id: "BUYER", label: `Procurement Lead (${buyerCount})` },
          ].map((persona) => {
            const isSelected = filterPersona === persona.id;
            return (
              <button
                key={persona.id}
                type="button"
                onClick={() => setFilterPersona(persona.id as BuyerPersona)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-medium transition cursor-pointer",
                  isSelected
                    ? "bg-signal-400 text-signal-ink font-bold shadow-xs"
                    : "border border-brand-200 bg-surface-2 text-brand-700 hover:text-brand-950 hover:bg-surface-3"
                )}
              >
                <span>{persona.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── GSC-TO-PROMPTS AI VISIBILITY SUGGESTIONS ── */}
      <GscSuggestedPromptsSection
        projectId={projectId}
        onPromptAdded={() => {
          queryClient.invalidateQueries({ queryKey: ["visibility-journey", projectId] });
          queryClient.invalidateQueries({ queryKey: ["ai-visibility", projectId] });
        }}
      />

      {/* Section 1: Tracked Prompts Panel (Okara style, Screenshot 1 & 2) */}
      <div className="overflow-hidden rounded-xl border border-line bg-surface-1 shadow-card">
        <div className="flex flex-col justify-between gap-3 border-b border-line px-4 py-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-surface-2 text-brand-700">
              <LayoutGrid size={16} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-brand-950">Tracked prompts</h3>
              <p className="text-xs text-brand-500">
                {isEditing
                  ? "Edits are included when you confirm the next check."
                  : "Saved answer references from each AI engine. Open a row for details."}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isEditing ? (
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="flex items-center gap-1.5 rounded-lg bg-signal-400 px-3.5 py-1.5 text-xs font-semibold text-signal-ink transition-colors hover:bg-signal-500"
              >
                <Check size={14} />
                Done
              </button>
            ) : (
              <>
                {!locked && (
                  <ActionButton
                    variant="primary"
                    disabled={pending || !checks}
                    onClick={() => onRun(draft)}
                    icon={<Check size={14} />}
                  >
                    Confirm & check {draft.questions.length} prompts
                  </ActionButton>
                )}
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="flex items-center gap-1.5 rounded-lg border border-line bg-surface-1 px-3 py-1.5 text-xs font-semibold text-brand-700 shadow-xs transition-colors hover:bg-surface-2 hover:text-brand-950 cursor-pointer"
                >
                  <Pencil size={13} />
                  Edit
                </button>
                {onOpenSimulator && (
                  <button
                    type="button"
                    onClick={onOpenSimulator}
                    className="flex items-center gap-1.5 rounded-lg border border-signal-400 bg-signal-400/10 hover:bg-signal-400/20 px-3 py-1.5 text-xs font-bold text-brand-950 transition-colors shadow-2xs cursor-pointer"
                  >
                    <Sparkles size={13} className="text-signal-500" />
                    <span>SERP Simulator</span>
                  </button>
                )}
                {hasScan && onViewResults && (
                  <ActionButton
                    variant="secondary"
                    onClick={onViewResults}
                    icon={<ArrowRight size={14} />}
                  >
                    View answers
                  </ActionButton>
                )}
              </>
            )}
          </div>
        </div>

        {/* Table container with horizontal scroll for smaller screens */}
        <div className="overflow-x-auto">
          <div className="min-w-[920px]">
            {/* Table column headers */}
            <div className="flex items-center justify-between border-b border-line bg-surface-2/60 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-brand-500">
              <div className="flex-1">Prompt</div>
              {ENGINES.map((engine) => {
                const Icon = engine.icon;
                const models = modelsForEngine(answers, engine.name);
                const matchingProvider = providers.find((p) => {
                  const prov = (p.provider || "").toUpperCase();
                  switch (engine.name) {
                    case "ChatGPT":
                      return prov.includes("OPENAI") || prov.includes("CHATGPT");
                    case "Google AI":
                      return prov.includes("GEMINI") || prov.includes("GOOGLE");
                    case "Claude":
                      return prov.includes("ANTHROPIC") || prov.includes("CLAUDE");
                    case "Perplexity":
                      return prov.includes("PERPLEXITY");
                    default:
                      return false;
                  }
                });

                const isConfigured = matchingProvider?.configured ?? false;
                const modelSummary =
                  models.length > 0
                    ? models.length > 1
                      ? `${models[0]} +${models.length - 1} more`
                      : models[0]
                    : isConfigured
                      ? matchingProvider?.model || "Ready to check"
                      : "Not connected";
                return (
                  <div key={engine.name} className="flex w-28 flex-col items-center justify-center gap-0.5 px-1 text-center sm:w-36">
                    <div className="flex items-center justify-center gap-1.5 text-brand-950">
                      <Icon className="h-4 w-4 shrink-0 text-brand-950" />
                      <span className="normal-case font-semibold text-brand-950">{engine.name}</span>
                    </div>
                    <span
                      className={cn(
                        "max-w-full truncate text-[9px] font-mono normal-case leading-3",
                        models.length > 0
                          ? "font-semibold text-brand-700"
                          : isConfigured
                            ? "text-brand-500"
                            : "text-brand-400 opacity-60",
                      )}
                      title={
                        models.length
                          ? `Model used: ${models.join(", ")}`
                          : isConfigured
                            ? "Engine configured & ready to check"
                            : "Engine API key not configured in Settings"
                      }
                    >
                      {modelSummary}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Prompts list */}
            <div className="divide-y divide-line">
              {promptsToDisplay.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 px-4 py-8 text-center">
                  <p className="text-sm font-semibold text-brand-950">
                    No prompts in the {categories.find((c) => c.key === filterCategory)?.label || "selected"} category
                  </p>
                  <p className="max-w-md text-xs text-brand-500">
                    Switch back to all categories to view your tracked buyer prompts, or click Edit to assign a prompt to this category.
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setFilterCategory("ALL")}
                      className="rounded-lg border border-brand-200 bg-surface-2 px-3 py-1.5 text-xs font-semibold text-brand-950 hover:bg-surface-3"
                    >
                      Show all categories
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditing(true)}
                      className="rounded-lg bg-signal-400 px-3 py-1.5 text-xs font-semibold text-signal-ink hover:bg-signal-500"
                    >
                      Edit prompts
                    </button>
                  </div>
                </div>
              ) : null}
              {promptsToDisplay.map(({ q, originalIndex, category, citations }) => {
                if (isEditing) {
                  return (
                    <div
                      key={originalIndex}
                      className="flex items-center justify-between gap-3 px-4 py-2.5 transition-colors hover:bg-surface-2/20"
                    >
                      {/* Left: Input, Category select, Trash */}
                      <div className="flex min-w-0 flex-1 items-center gap-2.5">
                        <input
                          type="text"
                          aria-label={`Buyer question ${originalIndex + 1}`}
                          value={q.text}
                          onChange={(e) => {
                            const val = e.target.value;
                            setDraft((d) => ({
                              ...d,
                              questions: d.questions.map((item, i) =>
                                i === originalIndex ? { ...item, text: val } : item,
                              ),
                            }));
                          }}
                          placeholder="Enter prompt wording..."
                          className="flex-1 rounded-lg border border-line bg-surface-1 px-3 py-2 text-sm text-brand-950 placeholder:text-brand-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                        />
                        <div className="w-36 shrink-0">
                          <select
                            value={
                              category === "jobs-to-be-done"
                                ? "Problem"
                                : category === "best-of"
                                  ? "Best Of"
                                  : category === "competitor"
                                    ? "Competitor"
                                    : "Branded"
                            }
                            onChange={(e) => {
                              const val = e.target.value;
                              const newIntent =
                                val === "Problem"
                                  ? "problem"
                                  : val === "Best Of"
                                    ? "best-of"
                                    : val === "Competitor"
                                      ? "competitor"
                                      : "branded";
                              setDraft((d) => ({
                                ...d,
                                questions: d.questions.map((item, i) =>
                                  i === originalIndex ? { ...item, intent: newIntent } : item,
                                ),
                              }));
                            }}
                            className="w-full rounded-lg border border-line bg-surface-1 px-3 py-2 text-sm font-medium text-brand-950 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                          >
                            <option value="Problem">Problem</option>
                            <option value="Best Of">Best Of</option>
                            <option value="Competitor">Competitor</option>
                            <option value="Branded">Branded</option>
                          </select>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setDraft((d) => ({
                              ...d,
                              questions: d.questions.filter((_, i) => i !== originalIndex),
                            }));
                          }}
                          className="rounded-lg p-2 text-brand-400 transition-colors hover:bg-surface-2 hover:text-error-600"
                          title="Delete prompt"
                          aria-label="Delete prompt"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>

                      {/* Right: Engine Indicators */}
                      <div className="hidden shrink-0 items-center sm:flex">
                        {ENGINES.map((engine) => {
                          const c = citations[engine.key];
                          return (
                            <div key={engine.name} className="flex w-28 items-center justify-center px-1 sm:w-36">
                              {c.status === "recommended" ? (
                                <span
                                  className="inline-flex items-center gap-1 rounded-full border border-success-500/30 bg-success-500/10 px-2 py-0.5 text-[11px] font-semibold text-success-600 dark:border-success-400/30 dark:bg-success-400/10 dark:text-success-400"
                                  title={`${engine.name}: Recommended your business`}
                                >
                                  <Check size={11} className="stroke-[2.5]" />
                                  <span>Recommended</span>
                                </span>
                              ) : c.status === "competitor" ? (
                                <span
                                  className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-warning-500/25 bg-warning-500/10 px-1.5 py-1 text-left text-[10px] font-medium leading-tight text-warning-700 shadow-xs dark:border-warning-400/25 dark:bg-warning-400/10 dark:text-warning-300"
                                  title={`Cited brand: ${c.competitor || "Rival"}`}
                                >
                                  <BrandLogo name={c.competitor || "Rival"} domain={c.competitorDomain} />
                                  <span className="min-w-0 whitespace-normal break-words">{c.competitor || "Rival"}</span>
                                </span>
                              ) : (
                                <span className="font-mono text-xs text-brand-400">—</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                }

                // Normal expandable row
                const isExpanded = expandedPrompt === originalIndex;
                const categoryBadgeTone =
                  category === "competitor"
                    ? "warn"
                    : category === "branded"
                      ? "good"
                      : "default";

                return (
                  <div key={originalIndex} className="transition-colors hover:bg-surface-2/30">
                    {/* Row Header */}
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => setExpandedPrompt(isExpanded ? null : originalIndex)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setExpandedPrompt(isExpanded ? null : originalIndex);
                        }
                      }}
                      className="flex cursor-pointer items-start justify-between gap-3 px-4 py-3.5 text-left"
                    >
                      <div className="flex flex-1 items-start gap-2.5 min-w-0">
                        <button
                          type="button"
                          aria-label={isExpanded ? "Collapse row" : "Expand row"}
                          className="mt-0.5 text-brand-400 hover:text-brand-600"
                        >
                          {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </button>
                        <div className="space-y-1 min-w-0">
                          <p className="text-sm font-semibold leading-snug text-brand-950 truncate">
                            {q.text || <span className="italic text-brand-400">Empty prompt wording</span>}
                          </p>
                          <div className="flex flex-wrap items-center gap-1.5 text-xs text-brand-500">
                            <Pill tone={categoryBadgeTone}>
                              {category === "best-of"
                                ? "Best-of"
                                : category === "jobs-to-be-done"
                                  ? "Jobs to be done"
                                  : category === "competitor"
                                    ? "Competitor"
                                    : "Branded"}
                            </Pill>
                            {q.offering && <span>· {q.offering}</span>}
                            {q.location && <span>· {q.location}</span>}
                          </div>
                        </div>
                      </div>

                      {/* Engine Indicators */}
                      <div className="flex items-center shrink-0">
                        {ENGINES.map((engine) => {
                          const c = citations[engine.key];
                          return (
                            <div key={engine.name} className="flex w-28 items-center justify-center px-1 sm:w-36">
                              {c.status === "recommended" ? (
                                <span
                                  className="inline-flex items-center gap-1 rounded-full border border-success-500/30 bg-success-500/10 px-2 py-0.5 text-[11px] font-semibold text-success-600 dark:border-success-400/30 dark:bg-success-400/10 dark:text-success-400"
                                  title={`${engine.name}: Recommended your business`}
                                >
                                  <Check size={11} className="stroke-[2.5]" />
                                  <span>Recommended</span>
                                </span>
                              ) : c.status === "competitor" ? (
                                <span
                                  className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-warning-500/25 bg-warning-500/10 px-1.5 py-1 text-left text-[10px] font-medium leading-tight text-warning-700 shadow-xs dark:border-warning-400/25 dark:bg-warning-400/10 dark:text-warning-300"
                                  title={`Cited brand: ${c.competitor || "Rival"}`}
                                >
                                  <BrandLogo name={c.competitor || "Rival"} domain={c.competitorDomain} />
                                  <span className="min-w-0 whitespace-normal break-words">{c.competitor || "Rival"}</span>
                                </span>
                              ) : (
                                <span className="font-mono text-xs text-brand-400">—</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Expanded Details */}
                    {isExpanded && (
                      <div className="border-t border-line bg-surface-2/40 p-4 space-y-4">
                        {/* Side-by-side comparison cards for all 4 models */}
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                          {ENGINES.map((engine) => {
                            const c = citations[engine.key];
                            const Icon = engine.icon;
                            return (
                              <div
                                key={engine.name}
                                className="flex flex-col justify-between rounded-xl border border-line bg-surface-2 p-3.5 space-y-3 shadow-card"
                              >
                                <div className="space-y-2.5">
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                      <Icon className="h-4 w-4 shrink-0 text-brand-950" />
                                      <span className="text-xs font-bold text-brand-950">{engine.name}</span>
                                    </div>
                                    {c.status === "recommended" ? (
                                      <span className="inline-flex items-center gap-1 rounded-full border border-success-500/30 bg-success-500/10 px-2 py-0.5 text-[11px] font-semibold text-success-600 dark:border-success-400/30 dark:bg-success-400/10 dark:text-success-400">
                                        <Check size={11} className="stroke-[2.5]" /> Recommended
                                      </span>
                                    ) : c.status === "competitor" ? (
                                      <span className="inline-flex items-center gap-1 rounded-full border border-warning-500/25 bg-warning-500/10 px-2 py-0.5 text-[11px] font-semibold text-warning-700 dark:border-warning-400/25 dark:bg-warning-400/10 dark:text-warning-300">
                                        <ArrowRightLeft size={10} /> Rival reference
                                      </span>
                                    ) : c.status === "pending" ? (
                                      <span className="rounded-full border border-brand-200 bg-surface-1 px-2 py-0.5 text-[11px] font-medium text-brand-500">
                                        Pending
                                      </span>
                                    ) : (
                                      <span className="rounded-full border border-brand-200 bg-surface-1 px-2 py-0.5 text-[11px] font-medium text-brand-500">
                                        {c.label === "Check failed" ? "Check failed" : "Not mentioned"}
                                      </span>
                                    )}
                                  </div>

                                  {c.status === "competitor" && c.competitor && (
                                    <div className="rounded-lg border border-warning-500/20 bg-warning-500/5 p-2.5 dark:border-warning-400/20 dark:bg-warning-400/5">
                                      <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-warning-700 dark:text-warning-400">
                                        <ArrowRightLeft size={10} />
                                        <span>Other reference</span>
                                      </div>
                                      <p className="mt-1 text-xs font-bold text-brand-950 break-words" title={c.competitor}>
                                        {c.competitor}
                                      </p>
                                    </div>
                                  )}

                                  {c.quote ? (
                                    <blockquote className="rounded-lg border-l-2 border-primary-500 bg-surface-1 p-2.5 text-xs italic text-brand-700">
                                      &ldquo;{c.quote}&rdquo;
                                    </blockquote>
                                  ) : (
                                    <p className="text-xs text-brand-500">
                                      {c.status === "pending"
                                        ? `Prompt will be sent to ${engine.name} during the check.`
                                        : c.status === "competitor"
                                          ? "No direct quote snippet recorded."
                                          : "No quote saved for this answer."}
                                    </p>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Add prompt button in edit mode */}
            {isEditing && (
              <div className="border-t border-line bg-surface-2/20 px-4 py-3">
                <button
                  type="button"
                  onClick={() => {
                    setDraft((d) => ({
                      ...d,
                      questions: [
                        ...d.questions,
                        {
                          text: "",
                          offering: "",
                          location: "",
                          intent: "best-of",
                          rationale: "",
                          evidenceIds: [],
                        },
                      ],
                    }));
                  }}
                  className="flex items-center gap-1.5 text-xs font-semibold text-primary-600 hover:text-primary-700"
                >
                  <Plus size={14} />
                  Add another prompt
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Section 2: Gap Tasks (Okara style, Screenshots 3, 4, 5) */}
      <div className="overflow-hidden rounded-xl border border-line bg-surface-1 shadow-card">
        <div className="flex flex-col justify-between gap-3 border-b border-line px-4 py-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-warning-500/25 bg-warning-500/10 text-warning-700 dark:border-warning-400/25 dark:bg-warning-400/10 dark:text-warning-300">
              <Target size={16} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-brand-950">Gap tasks</h3>
              <p className="text-xs text-brand-500">
                {gapItems.length} prompts with other brand or source references · {highPriorityGapsCount} high priority · {totalActionsCount} review candidates
              </p>
            </div>
          </div>
        </div>

        {/* Table column headers */}
        <div className="flex items-center justify-between border-b border-line bg-surface-2/60 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-brand-500">
          <div className="flex-1">Prompt</div>
          <div className="w-36 text-center sm:w-48">Other references</div>
          <div className="w-20 text-center sm:w-28">Gap</div>
          <div className="w-20 text-right sm:w-24">Priority</div>
        </div>

        {/* Gap items list */}
        <div className="divide-y divide-line">
          {gapItems.map((item, index) => {
            const isExpanded = expandedGap === index;

            return (
              <div key={index} className="transition-colors hover:bg-surface-2/30">
                {/* Gap Row */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setExpandedGap(isExpanded ? null : index)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setExpandedGap(isExpanded ? null : index);
                    }
                  }}
                  className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3.5 text-left"
                >
                  <div className="flex flex-1 items-start gap-2.5">
                    <button
                      type="button"
                      aria-label={isExpanded ? "Collapse gap" : "Expand gap"}
                      className="mt-0.5 text-brand-400 hover:text-brand-600"
                    >
                      {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </button>
                    <p className="text-sm font-semibold text-brand-950">{item.promptText}</p>
                  </div>

                  <div className="flex items-center">
                    <div className="flex w-36 items-center justify-center gap-1.5 text-xs font-medium text-brand-700 sm:w-48">
                      <Globe size={13} className="text-brand-400" />
                      <span>{item.citedInsteadDisplay}</span>
                    </div>

                    <div className="w-20 text-center sm:w-28">
                      <Pill>Content</Pill>
                    </div>

                    <div className="w-20 text-right sm:w-24">
                      <span
                        className={cn(
                          "rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                          item.priority === "High"
                            ? "border-error-500/25 bg-error-500/10 text-error-600 dark:border-error-400/25 dark:bg-error-400/10 dark:text-error-400"
                            : "border-warning-500/25 bg-warning-500/10 text-warning-700 dark:border-warning-400/25 dark:bg-warning-400/10 dark:text-warning-300",
                        )}
                      >
                        {item.priority}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Expanded Competitor Action Cards (Okara style, Screenshots 3, 4, 5) */}
                {isExpanded && (
                  <div className="border-t border-line bg-surface-2/40 p-4 space-y-3">
                    {item.competitors.map((comp, compIdx) => (
                      <div
                        key={compIdx}
                        className="flex flex-col justify-between gap-3 rounded-lg border border-line bg-surface-1 p-3.5 sm:flex-row sm:items-center"
                      >
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-md border border-line bg-surface-2 text-brand-600">
                            <Globe size={14} />
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-brand-950">{comp.domain || comp.name}</span>
                              <span className="text-xs text-brand-400">· Content Gap</span>
                            </div>
                            <p className="text-xs text-brand-600">
                              {comp.name} appears in {comp.count} saved mention or citation reference{comp.count === 1 ? "" : "s"}. Consider a verified comparison:{" "}
                              <strong className="text-brand-950">
                                {draft.businessName} vs {comp.name}
                              </strong>
                              .
                            </p>
                          </div>
                        </div>

                        <ActionButton
                          variant="secondary"
                          icon={<Zap size={14} className="text-primary-600" />}
                          onClick={() => {
                            setActivePlanGap({
                              id: crypto.randomUUID(),
                              comp,
                              promptText: item.promptText,
                              priority: item.priority,
                            });
                          }}
                        >
                          Get a plan
                        </ActionButton>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* AI Strategy Plan Modal for Competitor Gaps */}
      {activePlanGap && (
        <GapPlanModal
          businessName={draft.businessName}
          competitor={activePlanGap.comp}
          promptText={activePlanGap.promptText}
          priority={activePlanGap.priority}
          onClose={() => setActivePlanGap(null)}
          onSaveToFixEngine={async (plan) => {
            await api.savedPlans.save(projectId, {
              id: activePlanGap.id, projectId,
              title: `Review ${activePlanGap.comp.name} for ${activePlanGap.promptText}`,
              category: "CONTENT", source: "AI_VISIBILITY",
              priority: activePlanGap.priority === "High" ? "HIGH" : "MEDIUM",
              impact: "Proposed review based on saved answer references; performance lift is not measured.",
              effortHours: 0, deliverable: plan,
              evidence: `${activePlanGap.comp.count} saved mention or citation references. Website address: ${activePlanGap.comp.domain || "not verified"}.`,
              stagedAt: new Date().toISOString(), status: "STAGED",
            });
            void queryClient.invalidateQueries({ queryKey: ["saved-plans", projectId] });
            setCmoToast("Review task saved to Fix Engine.");
            setActivePlanGap(null);
          }}
        />
      )}
    </div>
  );
}
