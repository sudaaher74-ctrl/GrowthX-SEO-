"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  ChevronDown,
  ChevronRight,
  Play,
  Loader2,
  Calendar,
  Lightbulb,
  Check,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  X,
  Search,
  ExternalLink,
  RefreshCw,
  Plus,
  Globe,
  Bot,
  AlertCircle,
  BarChart3,
} from "lucide-react";
import {
  ResponsiveContainer,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  AreaChart,
  Area,
} from "recharts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { errorMessage } from "@/lib/error-message";
import { StatusNote } from "@/components/ui/console";
import type { VisibilityReport } from "@/lib/api-types";
import type { AvPrompt } from "./av-shared";

export interface AiVisibilityDashboardProps {
  report?: VisibilityReport | null;
  prompts?: AvPrompt[];
  domain: string;
  brandLabel: string;
  projects?: Array<{ id: string; name: string }>;
  currentProjectId?: string;
  onSelectProject?: (id: string) => void;
  days: number;
  onDaysChange: (days: number) => void;
  onRunScan: () => Promise<void>;
  isScanning: boolean;
  onNavigateTab?: (tab: string) => void;
}

/* ── Platform Logos (Authentic Inline SVGs) ─────────────────────── */

export function GeminiIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M12 2C12 7.52285 7.52285 12 2 12C7.52285 12 12 16.4771 12 22C12 16.4771 16.4771 12 22 12C16.4771 12 12 7.52285 12 2Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function OpenAiIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.5 9.87a6.2 6.2 0 0 0-.48-4.58 6.3 6.3 0 0 0-5.83-3.2 6.4 6.4 0 0 0-4.07 1.48 6.3 6.3 0 0 0-4.8 2.25 6.2 6.2 0 0 0-1.8 4.7 6.3 6.3 0 0 0-2.3 3.52 6.2 6.2 0 0 0 .58 4.98 6.3 6.3 0 0 0 5.83 3.2 6.4 6.4 0 0 0 4.07-1.48 6.3 6.3 0 0 0 4.8-2.25 6.2 6.2 0 0 0 1.8-4.7 6.3 6.3 0 0 0 2.3-3.92zm-8.5 11.08a4.7 4.7 0 0 1-3.23-1.28l.16-.09 3.8-2.18a.8.8 0 0 0 .4-.7v-5.36l1.62.94v4.44a4.73 4.73 0 0 1-2.75 4.27zm-7.6-3.86a4.7 4.7 0 0 1-.58-3.42l.16.1 3.8 2.2a.8.8 0 0 0 .8 0l4.64-2.68v1.88l-3.84 2.22a4.74 4.74 0 0 1-5 0zm-1.12-7.85a4.7 4.7 0 0 1 2.65-2.14V7.2l3.8 2.2a.8.8 0 0 0 .8 0l4.64-2.68-1.62-.94-3.84 2.22a4.74 4.74 0 0 1-6.43 1.93zm11.35-2.43l-3.8-2.19a.8.8 0 0 0-.8 0L5.3 7.3l-1.62-.94 3.84-2.22a4.74 4.74 0 0 1 7.23 2.14zm4.8 5.4a4.7 4.7 0 0 1 .58 3.42l-.16-.1-3.8-2.2a.8.8 0 0 0-.8 0l-4.64 2.68v-1.88l3.84-2.22a4.74 4.74 0 0 1 5 0zm1.12 7.85a4.7 4.7 0 0 1-2.65 2.14v-4.15l-3.8-2.2a.8.8 0 0 0-.8 0l-4.64 2.68 1.62.94 3.84-2.22a4.74 4.74 0 0 1 6.43-1.93z" />
    </svg>
  );
}

export function ClaudeIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2a1.5 1.5 0 0 1 1.5 1.5v3.1a1.5 1.5 0 0 1-3 0v-3.1A1.5 1.5 0 0 1 12 2zm7.07 3.93a1.5 1.5 0 0 1 0 2.12l-2.2 2.2a1.5 1.5 0 0 1-2.12-2.12l2.2-2.2a1.5 1.5 0 0 1 2.12 0zM22 12a1.5 1.5 0 0 1-1.5 1.5h-3.1a1.5 1.5 0 0 1 0-3h3.1A1.5 1.5 0 0 1 22 12zm-2.93 7.07a1.5 1.5 0 0 1-2.12 0l-2.2-2.2a1.5 1.5 0 0 1 2.12-2.12l2.2 2.2a1.5 1.5 0 0 1 0 2.12zM12 22a1.5 1.5 0 0 1-1.5-1.5v-3.1a1.5 1.5 0 0 1 3 0v3.1A1.5 1.5 0 0 1 12 22zm-7.07-3.93a1.5 1.5 0 0 1 0-2.12l2.2-2.2a1.5 1.5 0 0 1 2.12 2.12l-2.2 2.2a1.5 1.5 0 0 1-2.12 0zM2 12a1.5 1.5 0 0 1 1.5-1.5h3.1a1.5 1.5 0 0 1 0 3h-3.1A1.5 1.5 0 0 1 2 12zm3.93-7.07a1.5 1.5 0 0 1 2.12 0l2.2 2.2a1.5 1.5 0 0 1 2.12 2.12l-2.2 2.2a1.5 1.5 0 0 1 0-2.12z" />
    </svg>
  );
}

export function PerplexityIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2L4 7v10l8 5 8-5V7l-8-5zm6 14.1L12 19.8l-6-3.7V8.9l6-3.7 6 3.7v7.2zM11 8h2v8h-2V8zm-4 2h10v2H7v-2z" />
    </svg>
  );
}

export function GrokIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

/* ── Platform Definitions ───────────────────────────────────────── */

interface PlatformMeta {
  id: "gemini" | "openai" | "claude" | "perplexity" | "grok";
  name: string;
  badge: string;
  iconColor: string;
  bgTint: string;
  barColor: string;
  icon: (props: { className?: string }) => React.JSX.Element;
}

const PLATFORM_METAS: PlatformMeta[] = [
  {
    id: "gemini",
    name: "Google Gemini",
    badge: "Search & Multimodal",
    iconColor: "text-accent-600",
    bgTint: "bg-accent-50",
    barColor: "bg-accent-600",
    icon: GeminiIcon,
  },
  {
    id: "openai",
    name: "OpenAI API",
    badge: "Direct Answers",
    iconColor: "text-success-700",
    bgTint: "bg-success-50",
    barColor: "bg-success-600",
    icon: OpenAiIcon,
  },
  {
    id: "claude",
    name: "Anthropic Claude",
    badge: "Reasoning & Analysis",
    iconColor: "text-warning-700",
    bgTint: "bg-warning-50",
    barColor: "bg-warning-600",
    icon: ClaudeIcon,
  },
  {
    id: "perplexity",
    name: "Perplexity AI",
    badge: "Live Web Citations",
    iconColor: "text-series-8",
    bgTint: "bg-brand-50",
    barColor: "bg-series-8",
    icon: PerplexityIcon,
  },
  {
    id: "grok",
    name: "xAI Grok",
    badge: "Real-Time Context",
    iconColor: "text-brand-900",
    bgTint: "bg-brand-100",
    barColor: "bg-brand-900",
    icon: GrokIcon,
  },
];

/* ── Main Component ─────────────────────────────────────────────── */

export function AiVisibilityDashboard({
  report,
  prompts = [],
  domain,
  brandLabel,
  projects = [],
  currentProjectId,
  onSelectProject,
  days,
  onDaysChange,
  onRunScan,
  isScanning,
  onNavigateTab,
}: AiVisibilityDashboardProps) {
  const qc = useQueryClient();
  const [activeStage, setActiveStage] = useState<"scoreboard" | "explorer" | "citations" | "fixes">("scoreboard");
  const [searchQuery, setSearchQuery] = useState("");
  const [intentFilter, setIntentFilter] = useState<"ALL" | "BUYER" | "REPUTATION" | "CITED" | "MISSED">("ALL");
  const [selectedPromptId, setSelectedPromptId] = useState<string | null>(null);
  const router = useRouter();
  const [showAddPromptModal, setShowAddPromptModal] = useState(false);
  const [newPromptText, setNewPromptText] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);

  const displayDomain = domain || "";
  const displayBrand = brandLabel || (displayDomain ? displayDomain.replace(/^www\./, "").split(".")[0] : "Your Brand");

  // Real backend queries
  const questionsQuery = useQuery({
    queryKey: ["ai-visibility-questions", currentProjectId],
    queryFn: () => (currentProjectId ? api.getQuestionAnalysis(currentProjectId) : Promise.resolve(null)),
    enabled: Boolean(currentProjectId),
  });

  const citationsQuery = useQuery({
    queryKey: ["ai-visibility-citations", currentProjectId],
    queryFn: () => (currentProjectId ? api.getAiVisibilityCitations(currentProjectId) : Promise.resolve(null)),
    enabled: Boolean(currentProjectId),
  });

  const actionsQuery = useQuery({
    queryKey: ["ai-visibility-actions", currentProjectId],
    queryFn: () => (currentProjectId ? api.getAiVisibilityActions(currentProjectId) : Promise.resolve([])),
    enabled: Boolean(currentProjectId),
  });

  const competitorsQuery = useQuery({
    queryKey: ["competitors", currentProjectId],
    queryFn: () => (currentProjectId ? api.listCompetitors(currentProjectId) : Promise.resolve([])),
    enabled: Boolean(currentProjectId),
  });

  // Calculate high-level summary figures with strict truthfulness
  const summary = useMemo(() => {
    const hasData = (report?.summary?.checked ?? 0) > 0;
    const score = hasData ? report!.summary.citationSharePct : null;
    const delta = hasData && report!.summary.deltaPt != null ? Math.round(report!.summary.deltaPt * 10) / 10 : null;
    const totalChecks = report?.summary?.checked ?? 0;
    const citedCount = report?.summary?.cited ?? 0;
    const shareOfVoice = report?.shareOfVoice?.find((s) => s.domain === null)?.sharePct ?? null;
    const competitorsCount = competitorsQuery.data?.length ?? 0;

    return {
      score,
      delta,
      totalChecks,
      citedCount,
      shareOfVoice,
      competitorsCount,
      isRealData: hasData,
    };
  }, [report, competitorsQuery.data]);

  // Model-level visibility performance
  const platformData = useMemo(() => {
    const byAssistant = report?.byAssistant || [];
    return PLATFORM_METAS.map((p) => {
      const match = byAssistant.find((a) => a.assistant.toLowerCase().includes(p.id));
      const score = match && match.checked > 0 ? match.citationSharePct : null;
      const mentions = match ? match.cited : 0;
      const checked = match ? match.checked : 0;
      return {
        ...p,
        score,
        mentions,
        checked,
      };
    });
  }, [report]);

  // Question & Prompt Explorer dataset
  const questionsList = useMemo(() => {
    const rawQuestions = questionsQuery.data?.questions || [];
    return rawQuestions.map((q) => ({
      id: q.id,
      text: q.text,
      group: q.group,
      outcome: q.outcome,
      isCited: q.outcome === "CITED",
      statusLabel: q.outcome === "CITED" ? "Cited" : q.outcome === "NOT_CITED" ? "Uncited" : q.outcome === "FAILED" ? "Check failed" : "Not measured",
      answerExcerpt: q.answer?.answerExcerpt || null,
      assistant: q.answer?.assistant || null,
      competitorsCited: q.answer?.competitorsCited || [],
      matchedPage: q.ownPage?.url || null,
      verdict: q.verdict,
    }));
  }, [questionsQuery.data]);

  // Filtered prompt list
  const filteredQuestions = useMemo(() => {
    return questionsList.filter((q) => {
      const matchSearch = q.text.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchSearch) return false;
      if (intentFilter === "BUYER") return q.group === "BUYER";
      if (intentFilter === "REPUTATION") return q.group === "REPUTATION";
      if (intentFilter === "CITED") return q.isCited;
      if (intentFilter === "MISSED") return q.outcome === "NOT_CITED";
      return true;
    });
  }, [questionsList, searchQuery, intentFilter]);

  const activeQuestion = useMemo(() => {
    if (selectedPromptId) {
      return questionsList.find((q) => q.id === selectedPromptId) || questionsList[0] || null;
    }
    return questionsList[0] || null;
  }, [selectedPromptId, questionsList]);

  // Citations & Domain Sources
  const citationSources = useMemo(() => {
    const raw = citationsQuery.data?.citationsByDomain || [];
    return raw.map((c) => ({
      domain: c.domain,
      mentions: c.count,
      isOwnDomain: c.ownCited,
      authorityTier: "Recorded source",
    }));
  }, [citationsQuery.data, displayDomain]);

  // Actionable AI Content Gap & Fixes
  const actionFixes = useMemo(() => {
    const raw = actionsQuery.data || [];
    return raw.slice(0, 6).map((a) => ({
      id: a.id,
      title: a.title,
      category: a.category || "CONTENT",
      priority: a.priority >= 80 ? "CRITICAL" : "HIGH",
      description: a.recommendedAction || "Review the saved finding in Fix Engine before creating a patch.",

    }));
  }, [actionsQuery.data, displayBrand]);

  // Trend data for chart
  const trendData = useMemo(() => {
    if (report?.trend && report.trend.length >= 2) {
      return report.trend.map((t, idx) => ({
        date: `Wk ${idx + 1}`,
        yourBrand: t.citationSharePct,
      }));
    }
    return [];
  }, [report]);


  const handleAddPrompt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPromptText.trim() || !currentProjectId) return;
    setRequestError(null);
    try {
      await api.addTrackedPrompts(currentProjectId, [{ text: newPromptText.trim(), cluster: "Custom" }]);
      qc.invalidateQueries({ queryKey: ["ai-visibility-questions", currentProjectId] });
      setNewPromptText("");
      setShowAddPromptModal(false);
    } catch (error) {
      setRequestError(errorMessage(error));
    }
  };

  const handleGeneratePrompts = async () => {
    if (!currentProjectId) return;
    setRequestError(null);
    setIsGenerating(true);
    try {
      await api.generateAiVisibilityPrompts(currentProjectId, false);
      await qc.invalidateQueries({ queryKey: ["ai-visibility-questions", currentProjectId] });
      await qc.invalidateQueries({ queryKey: ["tracked-prompts", currentProjectId] });
    } catch (error) {
      setRequestError(errorMessage(error));
    } finally {
      setIsGenerating(false);
    }
  };

  const scrollToStage = (stage: typeof activeStage) => {
    setActiveStage(stage);
    const el = document.getElementById(`section-${stage}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div className="space-y-6 pb-16 font-sans text-brand-950">
      {requestError && <StatusNote tone="bad">{requestError}</StatusNote>}
      {/* ── Top Executive Header Bar (Linear-Inspired) ──────────────── */}
      <header className="relative overflow-hidden rounded-2xl border bg-gradient-to-b from-white via-white to-brand-50/50 p-6 shadow-xs">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary-600 text-white shadow-xs">
                <Sparkles className="h-4 w-4" />
              </span>
              <h1 className="text-xl font-bold tracking-tight text-brand-950 md:text-2xl">
                AI Visibility & Generative Engine Optimization
              </h1>
              <span className="inline-flex items-center gap-1 rounded-full border border-primary-500/20 bg-primary-50 px-2.5 py-0.5 text-xs font-semibold text-primary-700">
                <Bot className="h-3 w-3" /> Live Multi-Model GEO
              </span>
            </div>
            <p className="text-xs text-brand-600 md:text-sm">
              Track how <span className="font-semibold text-brand-900">{displayBrand}</span> ranks, gets cited, and is recommended across leading AI answer engines.
            </p>
          </div>

          {/* Controls: Project selector, Date selector, Sweep Button */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Project Picker */}
            <div className="relative">
              <select
                aria-label="Select client project"
                value={currentProjectId || ""}
                onChange={(e) => onSelectProject?.(e.target.value)}
                className="h-9 appearance-none rounded-xl border bg-white pl-3.5 pr-8 text-xs font-semibold text-brand-900 shadow-2xs transition-all hover:bg-brand-50 focus:border-primary-500 focus:outline-none"
              >
                {projects.length > 0 ? (
                  projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name || displayDomain}
                    </option>
                  ))
                ) : (
                  <option value="">{displayDomain || "Select Project"}</option>
                )}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-brand-400" />
            </div>

            {/* Date Window */}
            <div className="relative">
              <div className="flex h-9 items-center rounded-xl border bg-white pl-3 pr-7 text-xs font-medium text-brand-700 shadow-2xs">
                <Calendar className="mr-1.5 h-3.5 w-3.5 text-brand-400" />
                <select
                  aria-label="Select date range"
                  value={days}
                  onChange={(e) => onDaysChange(Number(e.target.value))}
                  className="appearance-none bg-transparent font-semibold text-brand-900 focus:outline-none"
                >
                  <option value={7}>Last 7 Days</option>
                  <option value={14}>Last 14 Days</option>
                  <option value={30}>Last 30 Days</option>
                  <option value={90}>Last 90 Days</option>
                </select>
              </div>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-brand-400" />
            </div>

            {/* Auto-generate prompts button */}
            <button
              type="button"
              onClick={handleGeneratePrompts}
              disabled={isGenerating || !currentProjectId}
              className="flex h-9 items-center gap-1.5 rounded-xl border bg-white px-3 text-xs font-semibold text-brand-800 shadow-2xs transition-all hover:bg-brand-50 disabled:opacity-50"
              title="Automatically discover high-intent buyer questions from your website and competitors"
            >
              <RefreshCw className={cn("h-3.5 w-3.5 text-brand-500", isGenerating && "animate-spin text-primary-600")} />
              <span>{isGenerating ? "Analyzing Pages…" : "Auto-Discover Questions"}</span>
            </button>

            {/* Run Sweep Primary CTA */}
            <button
              type="button"
              onClick={onRunScan}
              disabled={isScanning}
              className="flex h-9 items-center gap-2 rounded-xl bg-primary-600 px-4 text-xs font-bold text-white shadow-xs transition-all hover:bg-primary-700 active:scale-[0.98] disabled:opacity-60"
            >
              {isScanning ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Sweeping AI Models…</span>
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5 fill-current" />
                  <span>Run Live AI Sweep</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* ── Guided 4-Stage Executive Narrative Stepper ──────────────── */}
        <nav aria-label="Executive Flow" className="mt-6 flex flex-wrap items-center gap-2 border-t pt-4">
          <span className="text-[11px] font-bold uppercase tracking-wider text-brand-400">
            Agency Walkthrough:
          </span>

          <button
            type="button"
            onClick={() => scrollToStage("scoreboard")}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all",
              activeStage === "scoreboard"
                ? "bg-brand-900 text-white shadow-xs"
                : "text-brand-600 hover:bg-brand-100 hover:text-brand-900"
            )}
          >
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white/20 text-[10px]">1</span>
            <span>Executive AI Scoreboard</span>
          </button>

          <ChevronRight className="h-3 w-3 text-brand-300" />

          <button
            type="button"
            onClick={() => scrollToStage("explorer")}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all",
              activeStage === "explorer"
                ? "bg-brand-900 text-white shadow-xs"
                : "text-brand-600 hover:bg-brand-100 hover:text-brand-900"
            )}
          >
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white/20 text-[10px]">2</span>
            <span>Live Prompt & Response Explorer</span>
          </button>

          <ChevronRight className="h-3 w-3 text-brand-300" />

          <button
            type="button"
            onClick={() => scrollToStage("citations")}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all",
              activeStage === "citations"
                ? "bg-brand-900 text-white shadow-xs"
                : "text-brand-600 hover:bg-brand-100 hover:text-brand-900"
            )}
          >
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white/20 text-[10px]">3</span>
            <span>Competitor Citations & Sources</span>
          </button>

          <ChevronRight className="h-3 w-3 text-brand-300" />

          <button
            type="button"
            onClick={() => scrollToStage("fixes")}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all",
              activeStage === "fixes"
                ? "bg-brand-900 text-white shadow-xs"
                : "text-brand-600 hover:bg-brand-100 hover:text-brand-900"
            )}
          >
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white/20 text-[10px]">4</span>
            <span>Actionable Content Gap Blueprint</span>
          </button>
        </nav>
      </header>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* ── STAGE 1: EXECUTIVE AI SCOREBOARD & THE 5 ENGINES ───────── */}
      {/* ───────────────────────────────────────────────────────────── */}
      <section id="section-scoreboard" className="space-y-4">
        {/* Section Title */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-brand-900 text-[11px] font-bold text-white">
                1
              </span>
              <h2 className="text-base font-bold text-brand-950 md:text-lg">
                Executive AI Visibility Scoreboard
              </h2>
            </div>
            <p className="mt-0.5 text-xs text-brand-500">
              Aggregated citation share, recommendation frequency, and model-by-model breakdown.
            </p>
          </div>
        </div>

        {/* 4 Headline Metric Cards */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* Card 1: Overall Visibility */}
          <div className="relative overflow-hidden rounded-2xl border bg-white p-5 shadow-xs transition-all hover:shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-brand-500">Overall AI Visibility</span>
              {summary.delta != null ? (
                <span className="flex items-center gap-0.5 rounded-full bg-success-50 px-2 py-0.5 text-[11px] font-bold text-success-700">
                  <TrendingUp className="h-3 w-3" /> +{summary.delta}%
                </span>
              ) : (
                <span className="text-[11px] text-brand-400">Baseline</span>
              )}
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-3xl font-extrabold tracking-tight text-brand-950">
                {summary.score != null ? `${summary.score}%` : "—"}
              </span>
              {summary.score != null && <span className="text-sm font-semibold text-brand-400">/ 100</span>}
            </div>
            <p className="mt-1 text-xs text-brand-500">
              {summary.score != null
                ? `Mentioned in ${summary.citedCount} of ${summary.totalChecks} monitored buyer queries.`
                : "Run a sweep to measure citation presence across models."}
            </p>
            {summary.score != null && (
              <div className="mt-3.5 h-1.5 w-full overflow-hidden rounded-full bg-brand-100">
                <div
                  className="h-full rounded-full bg-primary-600 transition-all duration-500"
                  style={{ width: `${summary.score}%` }}
                />
              </div>
            )}
          </div>

          {/* Card 2: AI Share of Voice */}
          <div className="relative overflow-hidden rounded-2xl border bg-white p-5 shadow-xs transition-all hover:shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-brand-500">AI Share of Voice</span>
              <span className="rounded-full bg-primary-50 px-2 py-0.5 text-[11px] font-bold text-primary-700">
                {summary.competitorsCount > 0 ? `vs ${summary.competitorsCount} Rivals` : "Tracked Rivals"}
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-3xl font-extrabold tracking-tight text-brand-950">
                {summary.shareOfVoice != null ? `${summary.shareOfVoice}%` : "—"}
              </span>
            </div>
            <p className="mt-1 text-xs text-brand-500">
              {summary.shareOfVoice != null
                ? "Portion of all categorical AI mentions earned by your brand."
                : "Requires competitor domains to benchmark share of voice."}
            </p>
            {summary.shareOfVoice != null && (
              <div className="mt-3.5 h-1.5 w-full overflow-hidden rounded-full bg-brand-100">
                <div
                  className="h-full rounded-full bg-success-600 transition-all duration-500"
                  style={{ width: `${summary.shareOfVoice}%` }}
                />
              </div>
            )}
          </div>

          {/* Card 3: Monitored Questions */}
          <div className="relative overflow-hidden rounded-2xl border bg-white p-5 shadow-xs transition-all hover:shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-brand-500">Monitored Questions</span>
              <span className="flex items-center gap-0.5 rounded-full bg-accent-50 px-2 py-0.5 text-[11px] font-bold text-accent-700">
                Buyer Intent
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-3xl font-extrabold tracking-tight text-brand-950">
                {questionsList.length}
              </span>
            </div>
            <p className="mt-1 text-xs text-brand-500">
              Saved buyer questions; results appear after a successful model check.
            </p>
            <div className="mt-3.5 flex items-center justify-between text-[11px] font-semibold text-brand-600">
              <span>{questionsList.filter((q) => q.isCited).length} Won</span>
              <span>{questionsList.filter((q) => q.outcome === "NOT_CITED").length} Opportunity Gaps</span>
            </div>
          </div>

          {/* Card 4: Verified Source Citations */}
          <div className="relative overflow-hidden rounded-2xl border bg-white p-5 shadow-xs transition-all hover:shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-brand-500">Cited Web Sources</span>
              <span className="rounded-full bg-series-8/10 px-2 py-0.5 text-[11px] font-bold text-series-8">
                Footnotes
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-3xl font-extrabold tracking-tight text-brand-950">
                {citationSources.reduce((sum, c) => sum + c.mentions, 0)}
              </span>
            </div>
            <p className="mt-1 text-xs text-brand-500">
              Source links recorded in saved AI responses.
            </p>
            <div className="mt-3.5 flex items-center justify-between text-[11px] font-semibold text-brand-600">
              <span>{citationSources.filter((c) => c.isOwnDomain).length} Owned Domains</span>
              <span>{citationSources.filter((c) => !c.isOwnDomain).length} External Domains</span>
            </div>
          </div>
        </div>

        {/* ── The 5 Monitored AI Engine Cards (Linear-Style) ──────────── */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {platformData.map((platform) => {
            const Icon = platform.icon;
            return (
              <div
                key={platform.id}
                className="group relative overflow-hidden rounded-2xl border bg-white p-4 shadow-2xs transition-all hover:-translate-y-0.5 hover:shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={cn("flex h-7 w-7 items-center justify-center rounded-lg border", platform.bgTint, platform.iconColor)}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <div>
                      <span className="block text-xs font-bold text-brand-950">{platform.name}</span>
                      <span className="block text-[10px] text-brand-400">{platform.badge}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex items-baseline justify-between">
                  <div>
                    <span className="text-2xl font-extrabold tracking-tight text-brand-950">
                      {platform.score != null ? `${platform.score}%` : "—"}
                    </span>
                  </div>
                  <span className="text-[11px] font-semibold text-brand-500">
                    {platform.mentions} mentions
                  </span>
                </div>

                {/* Progress bar */}
                <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-brand-100">
                  <div
                    className={cn("h-full rounded-full transition-all duration-500", platform.barColor)}
                    style={{ width: `${platform.score ?? 0}%` }}
                  />
                </div>

                <div className="mt-3.5 flex items-center justify-between border-t pt-2.5 text-[11px] text-brand-500">
                  <span>Tested queries:</span>
                  <span className="font-bold text-brand-800">{platform.checked}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Trajectory & Share of Voice Comparison Charts ─────────── */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          {/* Trend Chart (Left 7 Cols) */}
          <div className="rounded-2xl border bg-white p-5 shadow-xs lg:col-span-7">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-brand-950">AI Visibility Momentum</h3>
                <p className="text-xs text-brand-500">Citation share growth trajectory across consecutive audits.</p>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-medium text-brand-600">
                <span className="h-2 w-2 rounded-full bg-primary-600" /> Your Brand
              </div>
            </div>

            <div className="mt-4 h-[220px] w-full">
              {trendData.length >= 2 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="brandGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--color-primary-600)" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="var(--color-primary-600)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-line)" />
                    <XAxis dataKey="date" tickLine={false} axisLine={false} fontSize={11} tick={{ fill: "var(--color-brand-400)" }} />
                    <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickLine={false} axisLine={false} fontSize={11} tick={{ fill: "var(--color-brand-400)" }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "white",
                        borderRadius: "12px",
                        border: "1px solid var(--color-line)",
                        fontSize: "12px",
                      }}
                    />
                    <Area type="monotone" dataKey="yourBrand" name="Citation Share" stroke="var(--color-primary-600)" strokeWidth={2.5} fillOpacity={1} fill="url(#brandGradient)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full flex-col items-center justify-center rounded-xl border border-dashed border-brand-200 text-center">
                  <BarChart3 className="h-8 w-8 text-brand-300" />
                  <p className="mt-2 text-xs font-semibold text-brand-700">Trendline requires multiple sweeps</p>
                  <p className="text-[11px] text-brand-400">Run a second AI sweep to see the growth trajectory over time.</p>
                </div>
              )}
            </div>
          </div>

          {/* Model Breakdown / Share of Voice Bar (Right 5 Cols) */}
          <div className="rounded-2xl border bg-white p-5 shadow-xs lg:col-span-5">
            <h3 className="text-sm font-bold text-brand-950">AI Answer Share by Model</h3>
            <p className="text-xs text-brand-500">Citation rate earned by your brand when queried on each engine.</p>

            <div className="mt-4 space-y-3.5">
              {platformData.map((p) => {
                const yourShare = p.score ?? 0;
                return (
                  <div key={p.id} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-brand-900">{p.name}</span>
                      <span className="font-medium text-brand-500">
                        {p.score != null ? (
                          <strong className="text-primary-700">{p.score}%</strong>
                        ) : (
                          "Not measured"
                        )}
                      </span>
                    </div>
                    <div className="flex h-2 w-full overflow-hidden rounded-full bg-brand-100">
                      <div className={cn("transition-all duration-500", p.barColor)} style={{ width: `${yourShare}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* ── STAGE 2: LIVE PROMPT & RESPONSE EXPLORER ───────────────── */}
      {/* ───────────────────────────────────────────────────────────── */}
      <section id="section-explorer" className="space-y-4 pt-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-brand-900 text-[11px] font-bold text-white">
                2
              </span>
              <h2 className="text-base font-bold text-brand-950 md:text-lg">
                Live Prompt & AI Response Explorer
              </h2>
            </div>
            <p className="mt-0.5 text-xs text-brand-500">
              Inspect actual buyer queries, who AI engines recommend, and the exact answer excerpts.
            </p>
          </div>

          {/* "+ Add Question" Button */}
          <button
            type="button"
            onClick={() => setShowAddPromptModal(true)}
            className="flex items-center gap-1.5 rounded-xl border bg-white px-3.5 py-2 text-xs font-bold text-brand-800 shadow-2xs transition-all hover:bg-brand-50 active:scale-98"
          >
            <Plus className="h-3.5 w-3.5 text-primary-600" />
            <span>Track New Question</span>
          </button>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white p-2.5 shadow-xs">
          {/* Search Input */}
          <div className="relative min-w-[240px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-brand-400" />
            <input
              type="text"
              placeholder="Search buyer questions, rival mentions, or keywords…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 w-full rounded-lg border bg-brand-50/50 pl-9 pr-3 text-xs text-brand-900 placeholder-brand-400 focus:border-primary-500 focus:bg-white focus:outline-none"
            />
          </div>

          {/* Intent Filters */}
          <div className="flex flex-wrap items-center gap-1">
            {(
              [
                { id: "ALL", label: "All Questions" },
                { id: "BUYER", label: "Buyer Intent" },
                { id: "REPUTATION", label: "Reputation" },
                { id: "CITED", label: "Won (Cited)" },
                { id: "MISSED", label: "Gaps (Uncited)" },
              ] as const
            ).map((filter) => (
              <button
                key={filter.id}
                type="button"
                onClick={() => setIntentFilter(filter.id)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
                  intentFilter === filter.id
                    ? "bg-brand-900 text-white shadow-xs"
                    : "text-brand-600 hover:bg-brand-100 hover:text-brand-900"
                )}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        {/* Master-Detail Interactive Inspector */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          {/* Left Column: Questions List (5 Cols) */}
          <div className="space-y-2 lg:col-span-5">
            <div className="max-h-[480px] space-y-2 overflow-y-auto pr-1">
              {filteredQuestions.length === 0 ? (
                <div className="rounded-xl border border-dashed border-brand-200 p-8 text-center text-xs text-brand-500">
                  <p className="font-semibold text-brand-800">No tracked questions yet</p>
                  <p className="mt-1 text-[11px] text-brand-400">Click &ldquo;Auto-Discover Questions&rdquo; above to automatically generate queries from your pages.</p>
                  <button
                    type="button"
                    onClick={handleGeneratePrompts}
                    disabled={isGenerating}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-primary-700"
                  >
                    <RefreshCw className={cn("h-3 w-3", isGenerating && "animate-spin")} />
                    <span>Auto-Discover Questions</span>
                  </button>
                </div>
              ) : (
                filteredQuestions.map((q) => {
                  const isSelected = activeQuestion?.id === q.id;
                  return (
                    <div
                      key={q.id}
                      onClick={() => setSelectedPromptId(q.id)}
                      className={cn(
                        "group cursor-pointer rounded-xl border p-3.5 transition-all",
                        isSelected
                          ? "border-primary-600/40 bg-primary-50/30 shadow-xs ring-1 ring-primary-500/20"
                          : "bg-white hover:bg-brand-50/40"
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase",
                            q.isCited
                              ? "bg-success-50 text-success-700"
                              : "bg-warning-50 text-warning-700"
                          )}
                        >
                          {q.isCited ? <Check className="h-2.5 w-2.5 stroke-[3]" /> : <AlertCircle className="h-2.5 w-2.5" />}
                          {q.statusLabel}
                        </span>

                        <span className="rounded-md bg-brand-100 px-2 py-0.5 text-[10px] font-medium text-brand-600">
                          {q.group === "BUYER" ? "Commercial Buyer Query" : "Brand Reputation"}
                        </span>
                      </div>

                      <p className="mt-2 text-xs font-semibold leading-relaxed text-brand-900 group-hover:text-primary-600">
                        {q.text}
                      </p>

                      <div className="mt-2.5 flex items-center justify-between text-[11px] text-brand-400">
                        <span>{q.competitorsCited.length > 0 ? `${q.competitorsCited.length} rivals cited` : "No competitors cited"}</span>
                        <span className="flex items-center gap-1 font-semibold text-primary-600">
                          Inspect Response <ArrowRight className="h-3 w-3" />
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Live AI Response Inspector (7 Cols) */}
          <div className="rounded-2xl border bg-white p-5 shadow-xs lg:col-span-7">
            {activeQuestion ? (
              <div className="space-y-4">
                {/* Header */}
                <div className="flex flex-wrap items-start justify-between gap-2 border-b pb-3.5">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-brand-400">
                      Query Simulator
                    </span>
                    <h3 className="text-sm font-bold text-brand-950 md:text-base">
                      &ldquo;{activeQuestion.text}&rdquo;
                    </h3>
                  </div>

                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold",
                      activeQuestion.isCited ? "bg-success-50 text-success-700" : "bg-warning-50 text-warning-700"
                    )}
                  >
                    {activeQuestion.statusLabel}
                  </span>
                </div>

                {/* AI Response Bubble */}
                <div className="relative rounded-xl border bg-brand-50/40 p-4">
                  <div className="flex items-center justify-between text-xs text-brand-400">
                    <span className="flex items-center gap-1.5 font-semibold text-brand-700">
                      <Bot className="h-3.5 w-3.5 text-primary-600" />
                      {activeQuestion.assistant ? `Answer from ${activeQuestion.assistant}` : "Latest stored answer"}
                    </span>
                  </div>

                  <p className="mt-3 text-xs leading-relaxed text-brand-800 md:text-sm">
                    {activeQuestion.answerExcerpt ?? "No answer text was stored for this question yet. Run an AI sweep to check it."}
                  </p>

                  {/* Competitor citation tags */}
                  {activeQuestion.competitorsCited.length > 0 && (
                    <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-3">
                      <span className="text-[11px] font-medium text-brand-500">Rivals cited in this answer:</span>
                      {activeQuestion.competitorsCited.map((c) => (
                        <span key={c} className="rounded-md bg-warning-50 px-2 py-0.5 text-xs font-semibold text-warning-700 border">
                          {c}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Targeted Page Diagnostics */}
                {activeQuestion.matchedPage && (
                  <div className="rounded-xl border bg-white p-3.5 text-xs">
                    <span className="block font-bold text-brand-950">Matching URL on Your Site:</span>
                    <a
                      href={activeQuestion.matchedPage}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-flex items-center gap-1 font-mono text-primary-600 hover:underline"
                    >
                      <span>{activeQuestion.matchedPage}</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                    <p className="mt-1.5 text-brand-500">
                      Matched against your saved website audit. Review recorded answers and page issues before changing content.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-8 text-center text-xs text-brand-400">
                Select a query from the left to inspect its live AI response.
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* ── STAGE 3: COMPETITOR CITATIONS & SOURCE FOOTPRINT ───────── */}
      {/* ───────────────────────────────────────────────────────────── */}
      <section id="section-citations" className="space-y-4 pt-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-brand-900 text-[11px] font-bold text-white">
                3
              </span>
              <h2 className="text-base font-bold text-brand-950 md:text-lg">
                Citation Sources & Research Footprint
              </h2>
            </div>
            <p className="mt-0.5 text-xs text-brand-500">
              Websites that AI models cite when researching answers in your category.
            </p>
          </div>

          <button
            type="button"
            onClick={() => onNavigateTab?.("citations")}
            className="flex items-center gap-1 text-xs font-semibold text-primary-600 hover:underline"
          >
            <span>Open Citation Intelligence Tab</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Citations Table (Linear-Style) */}
        <div className="overflow-hidden rounded-2xl border bg-white shadow-xs">
          {citationSources.length === 0 ? (
            <div className="p-8 text-center text-xs text-brand-400">
              Run an AI sweep to collect citations and authority domains.
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b bg-brand-50/60 text-brand-500">
                  <th className="py-3 pl-5 font-semibold">Cited Source Domain</th>
                  <th className="py-3 font-semibold">Authority Class</th>
                  <th className="py-3 font-semibold text-center">Citation Count</th>
                  <th className="py-3 pr-5 text-right font-semibold">Your Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-100">
                {citationSources.map((source) => (
                  <tr key={source.domain} className="group transition-colors hover:bg-brand-50/50">
                    <td className="py-3.5 pl-5 font-semibold text-brand-900">
                      <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4 text-brand-400" />
                        <span>{source.domain}</span>
                      </div>
                    </td>

                    <td className="py-3.5">
                      <span className="rounded-md bg-brand-100 px-2 py-0.5 text-[11px] font-medium text-brand-700">
                        {source.authorityTier}
                      </span>
                    </td>

                    <td className="py-3.5 text-center font-bold text-brand-900">
                      {source.mentions} citations
                    </td>

                    <td className="py-3.5 pr-5 text-right">
                      {source.isOwnDomain ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-success-50 px-2.5 py-0.5 text-[11px] font-bold text-success-700">
                          <Check className="h-3 w-3 stroke-[3]" /> Owned Asset
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-accent-50 px-2.5 py-0.5 text-[11px] font-bold text-accent-700">
                          Digital PR Target
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* ── STAGE 4: ACTIONABLE AI CONTENT GAP & FIX BLUEPRINT ─────── */}
      {/* ───────────────────────────────────────────────────────────── */}
      <section id="section-fixes" className="space-y-4 pt-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-brand-900 text-[11px] font-bold text-white">
                4
              </span>
              <h2 className="text-base font-bold text-brand-950 md:text-lg">
                Actionable AI Content Gap & Fix Blueprint
              </h2>
            </div>
            <p className="mt-0.5 text-xs text-brand-500">
              High-ROI technical and content patches engineered to capture uncited buyer queries.
            </p>
          </div>

          <button
            type="button"
            onClick={() => onNavigateTab?.("root-cause")}
            className="flex items-center gap-1 text-xs font-semibold text-primary-600 hover:underline"
          >
            <span>Root Cause Deep-Dive</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Actionable Cards Grid */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {actionFixes.length === 0 ? (
            <div className="rounded-2xl border border-dashed p-8 text-center text-xs text-brand-400 lg:col-span-3">
              Run an audit and AI sweep to generate content gap actions.
            </div>
          ) : (
            actionFixes.map((fix) => {

              return (
                <div
                  key={fix.id}
                  className="flex flex-col justify-between rounded-2xl border bg-white p-5 shadow-xs transition-all hover:shadow-sm"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase",
                          fix.priority === "CRITICAL"
                            ? "bg-error-50 text-error-700 border"
                            : "bg-warning-50 text-warning-700 border"
                        )}
                      >
                        {fix.priority} Priority
                      </span>
                    </div>

                    <h4 className="text-sm font-bold leading-snug text-brand-950">
                      {fix.title}
                    </h4>

                    <p className="text-xs leading-relaxed text-brand-600">
                      {fix.description}
                    </p>

                  </div>

                  <div className="mt-5 flex items-center justify-between border-t pt-3">
                    <span className="text-[11px] font-medium uppercase tracking-wide text-brand-500">
                      {fix.category} Fix
                    </span>
                    <button
                      type="button"
                      onClick={() => router.push("/fix-engine")}
                      className="flex items-center gap-1 rounded-lg bg-brand-900 px-3 py-1.5 text-xs font-bold text-white shadow-xs transition-colors hover:bg-brand-950"
                    >
                      <span>Review in Fix Engine</span>
                      <ArrowRight className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* ── Add Tracked Prompt Modal ───────────────────────────────── */}
      {showAddPromptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-950/40 p-4">
          <div className="w-full max-w-md rounded-2xl border bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
                  <Plus className="h-4 w-4" />
                </span>
                <h3 className="text-sm font-bold text-brand-950">Add Tracked Buyer Question</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddPromptModal(false)}
                className="text-brand-400 hover:text-brand-900"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleAddPrompt} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-brand-800">
                  Question or Buyer Prompt
                </label>
                <textarea
                  required
                  rows={3}
                  value={newPromptText}
                  onChange={(e) => setNewPromptText(e.target.value)}
                  placeholder="e.g. Which enterprise software provides automated technical SEO patches?"
                  className="mt-1 w-full rounded-xl border p-3 text-xs text-brand-900 placeholder-brand-400 focus:border-primary-500 focus:outline-none"
                />
                <p className="mt-1 text-[11px] text-brand-500">
                  Keep it neutral without your brand name to simulate real unprompted buyer searches.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddPromptModal(false)}
                  className="rounded-xl border px-4 py-2 text-xs font-semibold text-brand-700 hover:bg-brand-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-primary-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-primary-700"
                >
                  Start Tracking
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
