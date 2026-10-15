"use client";

import { type LiveDashboardData, platformKey, savedAnswers, recordedDate, NoMeasurement } from './live-dashboard-data';
import { useRouter } from "next/navigation";
import React, { useState } from "react";
import {
  Sparkles,
  Layers,
  Calendar,
  ChevronDown,
  TrendingDown,
  Bot,
  Link2,
  Trophy,
  Users,
  Gauge,
  Search,
  ExternalLink,
  ArrowRight,
  ShieldAlert,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Play,
  Loader2,
} from "lucide-react";
import { GeminiIcon, OpenAiIcon, ClaudeIcon, PerplexityIcon, GrokIcon } from "./ai-visibility-dashboard";

export interface RootCauseAnalysisDashboardProps extends LiveDashboardData {
  domain: string;
  brandLabel: string;
  projects?: Array<{ id: string; name: string }>;
  currentProjectId?: string;
  onSelectProject?: (id: string) => void;
  days: number;
  onDaysChange: (days: number) => void;
  onRunScan?: () => Promise<void>;
  isScanning?: boolean;
}

export function RootCauseAnalysisDashboard({
  report, prompts = [], citations, rootCause, actions = [], competitors = [],
  domain,
  brandLabel,
  projects = [],
  currentProjectId,
  onSelectProject,
  days,
  onDaysChange,
  onRunScan,
  isScanning = false,
}: RootCauseAnalysisDashboardProps) {
  const router = useRouter();
  const [selectedResponsePlatform, setSelectedResponsePlatform] = useState<
    "gemini" | "openai" | "claude" | "perplexity" | "grok"
  >("gemini");
  const [severityFilter, setSeverityFilter] = useState<"all" | "high" | "medium">("all");

  const displayDomain = domain || "No website selected";
  const displayBrand = brandLabel || displayDomain.replace(/^www\./, "").split(".")[0] || "Your Brand";

  // Data Sources for the Overview diagram
  const dataSources = [{name:'Saved AI responses',desc:savedAnswers(prompts).length+' recorded answers',icon:Bot,color:'text-primary-600 bg-primary-50'}];

  // Key Root Causes
  const keyRootCauses = [] as {id:number;title:string;severity:string;badgeColor:string;numBg:string}[];

  // AI Visibility Comparison Brands (Bar Chart)
  const competitorBars = (rootCause?.rivalsWinning ?? []).map(r=>({name:r.brand,mentions:r.wins,percent:Math.max(...(rootCause?.rivalsWinning ?? []).map(x=>x.wins))>0?r.wins/Math.max(...(rootCause?.rivalsWinning ?? []).map(x=>x.wins))*100:0,barColor:'bg-series-1'}));

  // Detailed Root Cause Cards
  const detailedCauses = [] as {id:number;title:string;severity:string;severityClass:string;desc:string;affects:string}[];

  // AI Response Quotes
  const platformQuotes = Object.fromEntries(['gemini','openai','claude','perplexity','grok'].map(id=>{const a=savedAnswers(prompts).find(x=>x.platform===id);return [id,{quote:a?.answerExcerpt ?? 'No saved response for this model yet.',missingNote:a ? (a.cited?'Brand mentioned':'Brand absent') : 'Not measured',date:recordedDate(a?.checkedAt)}]})) as Record<'gemini'|'openai'|'claude'|'perplexity'|'grok',{quote:string;missingNote:string;date:string}>;

  // Content Gap Table Data
  const contentGaps = (rootCause?.missedPrompts ?? []).map(p=>({topic:p.prompt,competitorsCovering:p.winner,status:'Brand absent',statusColor:'bg-warning-50 text-warning-700'}));

  // Recommended Actions
  const recommendedActions = actions.map((a,i)=>({num:i+1,title:a.title,buttonText:'View action',buttonColor:'bg-primary-600 hover:bg-primary-700 text-white'}));

  return (
    <div className="space-y-6">
      {/* ── Page Header: Title, Subtitle & Controls ─────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Layers className="h-6 w-6 text-primary-600" />
            <h1 className="text-xl font-bold tracking-tight text-brand-950 sm:text-2xl">
              Root Cause Analysis
            </h1>
          </div>
          <p className="mt-1 text-xs text-brand-500 sm:text-sm">
            Understand why your brand is (or isn&apos;t) showing up, and get data-backed solutions.
          </p>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Project Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-brand-500">Project</span>
            <div className="relative">
              <select
                aria-label="Select project"
                value={currentProjectId || ""}
                onChange={(e) => onSelectProject?.(e.target.value)}
                className="appearance-none rounded-lg border bg-white py-1.5 pl-3 pr-8 text-xs font-semibold text-brand-900 shadow-xs focus:border-primary-500 focus:outline-none"
                style={{ borderColor: "var(--border-color)" }}
              >
                {projects.length > 0 ? (
                  projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name || displayDomain}
                    </option>
                  ))
                ) : (
                  <option value="">{displayDomain}</option>
                )}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-brand-400" />
            </div>
          </div>

          {/* Date Selector */}
          <div className="relative">
            <div
              className="flex items-center rounded-lg border bg-white py-1.5 pl-2.5 pr-7 text-xs font-medium text-brand-800 shadow-xs"
              style={{ borderColor: "var(--border-color)" }}
            >
              <Calendar className="mr-1.5 h-3.5 w-3.5 text-brand-400" />
              <select
                aria-label="Select date range"
                value={days}
                onChange={(e) => onDaysChange(Number(e.target.value))}
                className="appearance-none bg-transparent pr-1 font-medium focus:outline-none"
              >
                <option value={7}>Last 7 Days</option>
                <option value={14}>Last 14 Days</option>
                <option value={30}>Last 30 Days</option>
                <option value={90}>Last 90 Days</option>
              </select>
            </div>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-brand-400" />
          </div>

          {/* Action Button */}
          <button
            type="button"
            onClick={onRunScan}
            disabled={isScanning || !currentProjectId}
            className="flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-primary-700 disabled:opacity-60"
          >
            {isScanning ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            <span>{isScanning ? "Analyzing Sources…" : "Generate New Analysis"}</span>
          </button>
        </div>
      </div>

      {/* ── Top Row: 5 KPI Cards ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-5">
        {/* Card 1: AI Visibility Score */}
        <div
          className="rounded-2xl border bg-white p-4 shadow-xs"
          style={{ borderColor: "var(--border-color)" }}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-brand-500">AI Visibility Score</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-error-50 text-error-600">
              <TrendingDown className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl font-bold tracking-tight text-brand-950">{report?.summary.checked ? report.summary.citationSharePct : "—"}</span>
            <span className="text-xs font-medium text-brand-400">/100</span>
            <span className="ml-auto text-xs font-semibold text-error-700">—</span>
          </div>
          <p className="mt-1 text-[11px] text-brand-400">Latest measured mention rate</p>
        </div>

        {/* Card 2: Brand Mentions */}
        <div
          className="rounded-2xl border bg-white p-4 shadow-xs"
          style={{ borderColor: "var(--border-color)" }}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-brand-500">Brand Mentions</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
              <Bot className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl font-bold tracking-tight text-brand-950">{report?.summary.checked ? report.summary.cited : "—"}</span>
            <span className="ml-auto text-xs font-semibold text-error-700">—</span>
          </div>
          <p className="mt-1 text-[11px] text-brand-400">in the latest saved run</p>
        </div>

        {/* Card 3: Citations */}
        <div
          className="rounded-2xl border bg-white p-4 shadow-xs"
          style={{ borderColor: "var(--border-color)" }}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-brand-500">Citations</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent-50 text-accent-600">
              <Link2 className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl font-bold tracking-tight text-brand-950">{citations?.citationsByDomain.filter(c=>c.ownCited).reduce((sum,c)=>sum+c.count,0) ?? "—"}</span>
            <span className="ml-auto text-xs font-semibold text-error-700">—</span>
          </div>
          <p className="mt-1 text-[11px] text-brand-400">links to your website</p>
        </div>

        {/* Card 4: Recommendation Rate */}
        <div
          className="rounded-2xl border bg-white p-4 shadow-xs"
          style={{ borderColor: "var(--border-color)" }}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-brand-500">Recommendation Rate</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-warning-50 text-warning-600">
              <Trophy className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl font-bold tracking-tight text-brand-950">—</span>
            <span className="ml-auto text-xs font-semibold text-error-700">—</span>
          </div>
          <p className="mt-1 text-[11px] text-brand-400">of responses recommend brand</p>
        </div>

        {/* Card 5: Competitors Ahead */}
        <div
          className="rounded-2xl border bg-white p-4 shadow-xs"
          style={{ borderColor: "var(--border-color)" }}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-brand-500">Competitors Ahead</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-series-1/10 text-series-1">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl font-bold tracking-tight text-brand-950">—</span>
          </div>
          <p className="mt-1 text-[11px] text-brand-400">competitors mentioned more often</p>
        </div>
      </div>

      {/* ── Middle Row: Root Cause Overview Diagram & AI Visibility Comparison ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left: Root Cause Overview Diagram (7 cols) */}
        <div
          className="rounded-2xl border bg-white p-5 shadow-xs lg:col-span-7"
          style={{ borderColor: "var(--border-color)" }}
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-brand-950">Root Cause Overview</h2>
              <p className="mt-0.5 text-xs text-brand-500">
                Saved evidence for this project. Causal explanations appear only when supported by analysis.
              </p>
            </div>
            <span className="rounded-lg border bg-surface-2 px-2.5 py-1 text-xs font-semibold text-brand-700">
              View: Summary
            </span>
          </div>

          {/* Connected Flow Diagram */}
          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-12 items-center">
            {/* 1. Left Data Sources (4 cols) */}
            <div className="space-y-2 md:col-span-4">
              <span className="block text-[11px] font-bold uppercase tracking-wider text-brand-400 mb-2">
                Available Evidence
              </span>
              {dataSources.map((ds) => {
                const Icon = ds.icon;
                return (
                  <div
                    key={ds.name}
                    className="flex items-center gap-2.5 rounded-xl border bg-brand-50/40 p-2 text-left"
                    style={{ borderColor: "var(--border-color)" }}
                  >
                    <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ${ds.color}`}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-bold text-brand-900">{ds.name}</p>
                      <p className="truncate text-[10px] text-brand-400">{ds.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 2. Middle Node: AI Analysis (4 cols) */}
            <div className="flex flex-col items-center justify-center md:col-span-4 px-2">
              <div className="relative flex flex-col items-center rounded-2xl border bg-primary-50/60 p-4 text-center shadow-xs w-full border-primary-200">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary-600 text-white shadow-sm mb-2">
                  <Sparkles className="h-5 w-5" />
                </div>
                <h3 className="text-xs font-bold text-primary-950">AI Analysis</h3>
                <p className="mt-1 text-[10.5px] leading-relaxed text-primary-700">
                  Recorded monitoring evidence; causal analysis is not yet available.
                </p>
              </div>
            </div>

            {/* 3. Right Node: Key Root Causes (4 cols) */}
            <div className="space-y-2 md:col-span-4">
              <span className="block text-[11px] font-bold uppercase tracking-wider text-brand-400 mb-2">
                Key Root Causes
              </span>
              {!keyRootCauses.length && <NoMeasurement>No causal analysis recorded yet.</NoMeasurement>}{keyRootCauses.map((rc) => (
                <div
                  key={rc.id}
                  className={`flex items-center gap-2 rounded-xl border p-2 text-xs font-semibold ${rc.badgeColor}`}
                >
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${rc.numBg}`}
                  >
                    {rc.id}
                  </span>
                  <span className="truncate">{rc.title}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: AI Visibility Comparison (5 cols) */}
        <div
          className="rounded-2xl border bg-white p-5 shadow-xs lg:col-span-5"
          style={{ borderColor: "var(--border-color)" }}
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-brand-950">AI Visibility Comparison</h2>
              <p className="mt-0.5 text-xs text-brand-500">Recorded prompts where rivals were named and your brand was absent.</p>
            </div>
            <span className="text-xs font-semibold text-brand-600">Brand Mentions ▾</span>
          </div>

          <div className="mt-6 space-y-4">
            {competitorBars.map((item) => (
              <div key={item.name} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className={item.name.includes("(You)") ? "text-success-700 font-extrabold" : "text-brand-900"}>
                    {item.name}
                  </span>
                  <span className="text-brand-950">{item.mentions}</span>
                </div>
                <div className="h-3 w-full overflow-hidden rounded-full bg-brand-100">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${item.barColor}`}
                    style={{ width: `${item.percent}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Third Section: Detailed Root Cause Analysis ─────────────────── */}
      <div
        className="rounded-2xl border bg-white p-5 shadow-xs"
        style={{ borderColor: "var(--border-color)" }}
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-brand-950">Detailed Root Cause Analysis</h2>
            <p className="mt-0.5 text-xs text-brand-500">
              Breakdown of individual causes, severity levels, and affected ranking dimensions.
            </p>
          </div>
          <div className="relative">
            <select
              aria-label="Filter severity levels"
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value as "all" | "high" | "medium")}
              className="appearance-none rounded-lg border bg-white py-1 pl-3 pr-7 text-xs font-medium text-brand-700 shadow-xs focus:outline-none"
              style={{ borderColor: "var(--border-color)" }}
            >
              <option value="all">All Severity Levels</option>
              <option value="high">High Severity Only</option>
              <option value="medium">Medium Severity Only</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-brand-400" />
          </div>
        </div>

        {/* 5 Cause Cards */}
        <div className="mt-4 grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-5">
          {!detailedCauses.length && <NoMeasurement>No evidence-backed causal diagnosis recorded yet.</NoMeasurement>}
            {detailedCauses
            .filter((c) => severityFilter === "all" || c.severity.toLowerCase() === severityFilter)
            .map((item) => (
              <div
                key={item.id}
                className="flex flex-col justify-between rounded-xl border bg-surface-1 p-3.5 shadow-xs transition hover:shadow-sm"
                style={{ borderColor: "var(--border-color)" }}
              >
                <div>
                  <div className="flex items-start justify-between gap-1">
                    <h4 className="text-xs font-bold text-brand-950 line-clamp-1">{item.title}</h4>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${item.severityClass}`}
                    >
                      {item.severity}
                    </span>
                  </div>
                  <p className="mt-2 text-[11.5px] leading-relaxed text-brand-600">{item.desc}</p>
                  <button
                    type="button"
                    className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-primary-600 hover:text-primary-700"
                   onClick={() => router.push("/ai-visibility?tab=actions")}> 
                    <span>View Evidence</span>
                    <span>↓</span>
                  </button>
                </div>

                <div className="mt-4 border-t pt-2 text-[10.5px] text-brand-500" style={{ borderColor: "var(--border-color)" }}>
                  <span className="font-semibold text-brand-700">Affects: </span>
                  <span>{item.affects}</span>
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* ── Bottom Row: Evidence, Content Gap & Recommended Actions ─────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left: Evidence from AI Responses (4 cols) */}
        <div
          className="rounded-2xl border bg-white p-5 shadow-xs lg:col-span-4 flex flex-col justify-between"
          style={{ borderColor: "var(--border-color)" }}
        >
          <div>
            <h3 className="text-sm font-bold text-brand-950">Evidence from AI Responses</h3>
            <p className="mt-0.5 text-xs text-brand-500">
              Examples of how AI platforms respond and what&apos;s missing.
            </p>

            {/* Platform Tabs */}
            <div
              className="mt-4 flex items-center gap-1 overflow-x-auto rounded-xl border bg-brand-50/50 p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              style={{ borderColor: "var(--border-color)" }}
            >
              {(
                [
                  { id: "gemini", label: "Gemini", icon: GeminiIcon },
                  { id: "openai", label: "OpenAI", icon: OpenAiIcon },
                  { id: "claude", label: "Claude", icon: ClaudeIcon },
                  { id: "perplexity", label: "Perplexity", icon: PerplexityIcon },
                  { id: "grok", label: "Grok", icon: GrokIcon },
                ] as const
              ).map((tab) => {
                const Icon = tab.icon;
                const isSelected = selectedResponsePlatform === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setSelectedResponsePlatform(tab.id)}
                    className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                      isSelected
                        ? "bg-white text-brand-950 shadow-xs"
                        : "text-brand-500 hover:text-brand-950"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Quote Box */}
            <div className="mt-4 rounded-xl border bg-brand-50/30 p-4 relative" style={{ borderColor: "var(--border-color)" }}>
              <span className="text-3xl font-serif text-brand-300 absolute top-2 left-2.5 leading-none">
                &ldquo;
              </span>
              <p className="pl-4 text-xs italic text-brand-800 leading-relaxed">
                {platformQuotes[selectedResponsePlatform].quote}
              </p>
              <div className="mt-3 flex items-center gap-1.5 pl-4 text-xs font-semibold text-error-700">
                <span>•</span>
                <span>{platformQuotes[selectedResponsePlatform].missingNote}</span>
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between text-[11px] text-brand-400 border-t pt-3" style={{ borderColor: "var(--border-color)" }}>
            <span>Captured {platformQuotes[selectedResponsePlatform].date}</span>
            <button
              type="button"
              className="flex items-center gap-1 font-semibold text-primary-600 hover:text-primary-700"
             onClick={() => router.push("/ai-visibility?tab=actions")}> 
              <span>View Saved Response</span>
              <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        </div>

        {/* Center: Competitor vs You: Content Gap (4 cols) */}
        <div
          className="rounded-2xl border bg-white p-5 shadow-xs lg:col-span-4"
          style={{ borderColor: "var(--border-color)" }}
        >
          <div>
            <h3 className="text-sm font-bold text-brand-950">Competitor vs You: Content Gap</h3>
            <p className="mt-0.5 text-xs text-brand-500">Topics competitors cover but you don&apos;t.</p>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b text-[10.5px] font-bold text-brand-400" style={{ borderColor: "var(--border-color)" }}>
                  <th className="pb-2">Topic</th>
                  <th className="pb-2 text-center">Competitors</th>
                  <th className="pb-2 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: "var(--border-color)" }}>{!contentGaps.length && <tr><td colSpan={8}><NoMeasurement /></td></tr>}
                {contentGaps.map((item) => (
                  <tr key={item.topic}>
                    <td className="py-2.5 font-medium text-brand-900 pr-2">{item.topic}</td>
                    <td className="py-2.5 text-center text-brand-600 font-semibold">{item.competitorsCovering}</td>
                    <td className="py-2.5 text-right">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${item.statusColor}`}>
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Recommended Actions (4 cols) */}
        <div
          className="rounded-2xl border bg-white p-5 shadow-xs lg:col-span-4 flex flex-col justify-between"
          style={{ borderColor: "var(--border-color)" }}
        >
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-warning-500" />
                <h3 className="text-sm font-bold text-brand-950">Recommended Actions</h3>
              </div>
              <button
                type="button"
                className="text-xs font-semibold text-primary-600 hover:text-primary-700"
               onClick={() => router.push("/ai-visibility?tab=actions")}> 
                View All Actions →
              </button>
            </div>
            <p className="mt-0.5 text-xs text-brand-500">
              Prioritized actions to improve your AI visibility.
            </p>

            <div className="mt-4 space-y-2.5">
              {recommendedActions.map((action) => (
                <div
                  key={action.num}
                  className="flex items-center justify-between gap-2 rounded-xl border bg-surface-1 p-2.5"
                  style={{ borderColor: "var(--border-color)" }}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-50 text-[10px] font-bold text-primary-700">
                      {action.num}
                    </span>
                    <span className="truncate text-xs font-medium text-brand-900">
                      {action.title}
                    </span>
                  </div>
                  <button
                    type="button"
                    className={`shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${action.buttonColor}`}
                   onClick={() => router.push("/ai-visibility?tab=actions")}> 
                    {action.buttonText}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
