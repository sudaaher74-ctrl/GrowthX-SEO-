"use client";

import { type LiveDashboardData, platformKey, savedAnswers, recordedDate, NoMeasurement } from './live-dashboard-data';
import { useRouter } from "next/navigation";
import { VisibilityDetails } from './visibility-details';
import React, { useState } from "react";
import {
  Sparkles,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Play,
  Loader2,
  Calendar,
  Lightbulb,
  Target,
  Wrench,
  Check,
  TrendingUp,
  ShieldCheck,
  FolderOpen,
  MessageSquare,
  ArrowRight,
  X,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import type { VisibilityReport } from "@/lib/api-types";
import type { AvPrompt } from "./av-shared";

export interface AiVisibilityDashboardProps extends LiveDashboardData {
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

/* ── Platform Preset Configuration ──────────────────────────────── */

interface PlatformData {
  id: "gemini" | "openai" | "claude" | "perplexity" | "grok";
  name: string;
  score: number | null;
  delta: string;
  mentions: number | null;
  recommendations: number | null;
  citations: number | null;
  colorVar: string;
  barClass: string;
  icon: (props: { className?: string }) => React.JSX.Element;
  iconColor: string;
}

const PLATFORMS = [
{id:'gemini', name:'Gemini', colorVar:'var(--color-series-1)',barClass:'bg-series-1',icon:GeminiIcon,iconColor:'text-series-1'},
{id:'openai', name:'OpenAI', colorVar:'var(--color-series-2)',barClass:'bg-series-2',icon:OpenAiIcon,iconColor:'text-brand-950'},
{id:'claude', name:'Claude', colorVar:'var(--color-series-7)',barClass:'bg-series-7',icon:ClaudeIcon,iconColor:'text-series-7'},
{id:'perplexity', name:'Perplexity', colorVar:'var(--color-series-6)',barClass:'bg-series-6',icon:PerplexityIcon,iconColor:'text-series-8'},
{id:'grok', name:'Grok', colorVar:'var(--color-series-5)',barClass:'bg-series-5',icon:GrokIcon,iconColor:'text-brand-950'}
] as const;

/* ── Historical Trend Data (5 platforms over 5 weeks) ────────────── */



/* ── Mentions vs Competitors Comparison Data ─────────────────────── */



/* ── Citation Sources Table Data ─────────────────────────────────── */

interface CitationSource {
  domain: string;
  citedBy: Array<"gemini" | "openai" | "claude" | "perplexity" | "grok">;
  mentions: number;
  lastSeen: string;
}

/* ── Component Main Implementation ──────────────────────────────── */

export function AiVisibilityDashboard({
  report, prompts = [], citations, rootCause, actions = [], competitors = [],
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
  const router = useRouter();
  const [selectedModel, setSelectedModel] = useState<PlatformData["id"]>("gemini");
  const [activeResponseIndex, setActiveResponseIndex] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const displayDomain = domain || "No website selected";
  const displayBrand = brandLabel || displayDomain.replace(/^www\./, "").split(".")[0] || "Your Brand";

  // Citation sources with dynamic user domain in the first row
  const citationSources = (citations?.citationsByDomain ?? []).map(c => ({domain:c.domain, citedBy:[] as PlatformData['id'][], mentions:c.count, lastSeen:'Unavailable'}));

  // Model-specific quotes for the "Latest AI Responses" card
  const modelQuotes = Object.fromEntries(PLATFORMS.map(p => [p.id, savedAnswers(prompts).filter(a => a.platform===p.id).map(a => a.answerExcerpt!)])) as Record<PlatformData['id'],string[]>;

  const currentQuotes = modelQuotes[selectedModel] || modelQuotes.gemini;
  const currentQuote = currentQuotes[activeResponseIndex % (currentQuotes.length || 1)] ?? 'No saved response for this model yet.';
  const answer = savedAnswers(prompts).filter(a => a.platform === selectedModel)[activeResponseIndex % (currentQuotes.length || 1)];
  const platforms: PlatformData[] = PLATFORMS.map(p => { const measured=report?.byAssistant.find(r=>platformKey(r.assistant)===p.id); return {...p,score:measured && measured.checked>0?measured.citationSharePct:null,delta:'—',mentions:measured && measured.checked>0?measured.cited:null,recommendations:measured && measured.checked>0 ? measured.recommended ?? null : null,citations:measured && measured.checked>0 ? measured.citations ?? null : null}; });
  const trendPoints = (report?.trend ?? []).filter(r=>r.checked>0).map(r=>({date:new Date(r.weekStart).toLocaleDateString(),overall:r.citationSharePct}));
  const mentionComparisons = platforms.filter(p=>p.mentions!==null).map(p=>({platform:p.name,yourBrand:p.mentions,competitors:null,id:p.id}));

  const handleNextQuote = () => {
    setActiveResponseIndex((prev) => (prev + 1) % (currentQuotes.length || 1));
  };

  const handlePrevQuote = () => {
    setActiveResponseIndex((prev) => (prev - 1 + currentQuotes.length) % (currentQuotes.length || 1));
  };

  return (
    <div className="space-y-6 pb-12 font-sans text-brand-950">
      {/* ── Top Header Bar ─────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
              <Sparkles className="h-4 w-4 fill-primary-600 text-primary-600" />
            </span>
            <h1 className="text-xl font-bold tracking-tight text-brand-950 md:text-2xl">
              AI Visibility
            </h1>
          </div>
          <p className="mt-1 text-xs text-brand-500 md:text-sm">
            Track how your brand appears, is mentioned and recommended across leading AI platforms.
          </p>
        </div>

        {/* Header Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Project Dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-brand-500">Project</span>
            <div className="relative">
              <select
                aria-label="Select project"
                value={currentProjectId || ""}
                onChange={(e) => onSelectProject?.(e.target.value)}
                className="appearance-none rounded-lg border bg-white py-1.5 pl-3 pr-8 text-xs font-semibold text-brand-900 shadow-xs focus:border-primary-500 focus:outline-none"
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

          {/* Date Range Selector */}
          <div className="relative">
            <div className="flex items-center rounded-lg border bg-white py-1.5 pl-2.5 pr-7 text-xs font-medium text-brand-800 shadow-xs">
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

          {/* Primary Action Button: Run New AI Visibility Check */}
          <button
            type="button"
            onClick={onRunScan}
            disabled={!currentProjectId}
            className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-primary-700 disabled:opacity-60 md:text-sm"
          >
            {isScanning ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Play className="h-3.5 w-3.5 fill-current" />
            )}
            <span>{isScanning ? "Checking AI Platforms…" : "Run New AI Visibility Check"}</span>
          </button>
        </div>
      </div>

      {/* ── Top Row: 5 Platform Cards ───────────────────────────────── */}
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-5">
        {platforms.map((platform) => {
          const Icon = platform.icon;
          return (
            <div
              key={platform.id}
              className="rounded-2xl border bg-white p-4 shadow-xs transition-all hover:shadow-sm"
            >
              {/* Card Header: Logo, Name & Green Delta */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={platform.iconColor}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="text-sm font-bold text-brand-950">{platform.name}</span>
                </div>
                <span className="flex items-center gap-0.5 rounded-full bg-success-50 px-2 py-0.5 text-[11px] font-semibold text-success-700">
                  <TrendingUp className="h-3 w-3" />
                  {platform.delta}
                </span>
              </div>

              {/* Big Score */}
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-2xl font-bold tracking-tight text-brand-950">
                  {platform.score ?? "—"}
                </span>
                <span className="text-xs font-medium text-brand-400">/100</span>
              </div>

              {/* Progress Bar */}
              <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-brand-100">
                <div
                  className={`h-full rounded-full ${platform.barClass}`}
                  style={{ width: `${platform.score ?? 0}%` }}
                />
              </div>

              {/* Sub Metrics: Mentions, Recommendations, Citations */}
              <div className="mt-4 grid grid-cols-3 divide-x divide-brand-100 text-center">
                <div className="pr-1">
                  <span className="block text-[10px] font-medium text-brand-400">Mentions</span>
                  <span className="mt-0.5 block text-xs font-bold text-brand-800">
                    {platform.mentions ?? "—"}
                  </span>
                </div>
                <div className="px-1">
                  <span className="block text-[10px] font-medium text-brand-400">Recommendations</span>
                  <span className="mt-0.5 block text-xs font-bold text-brand-800">
                    {platform.recommendations ?? "—"}
                  </span>
                </div>
                <div className="pl-1">
                  <span className="block text-[10px] font-medium text-brand-400">Citations</span>
                  <span className="mt-0.5 block text-xs font-bold text-brand-800">
                    {platform.citations ?? "—"}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Middle Row: 2 Column Charts ─────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Left Chart: Visibility Trends */}
        <div className="rounded-2xl border bg-white p-5 shadow-xs lg:col-span-7">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-brand-950 md:text-base">Visibility Trends</h2>
              <p className="mt-0.5 text-xs text-brand-500">
                Share of saved valid answers mentioning your brand over time.
              </p>
            </div>
            <div className="relative">
              <div className="flex items-center rounded-lg border bg-white px-2.5 py-1 text-xs font-medium text-brand-700 shadow-xs">
                <span>Last {days} Days</span>
                <ChevronDown className="ml-1 h-3 w-3 text-brand-400" />
              </div>
            </div>
          </div>

          {/* Line Chart */}
          <div className="mt-5 h-[230px] w-full">
            {trendPoints.length ? (<ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendPoints} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-line)" />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                  tick={{ fill: "var(--color-brand-400)" }}
                />
                <YAxis
                  domain={[0, 100]}
                  ticks={[0, 25, 50, 75, 100]}
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                  tick={{ fill: "var(--color-brand-400)" }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--color-surface-1, white)",
                    borderRadius: "12px",
                    border: "1px solid var(--color-line)",
                    boxShadow: "var(--shadow-card)",
                    fontSize: "12px",
                  }}
                />
              <Line type="monotone" dataKey="overall" name="Overall mention rate" stroke="var(--color-series-1)" strokeWidth={2} dot={{r:3}} /></LineChart>
            </ResponsiveContainer>) : <NoMeasurement />}
          </div>

          {/* Bottom Chart Legend */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-5 text-xs font-medium text-brand-600"><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-series-1" /> Overall mention rate</span></div>
        </div>

        {/* Right Chart: Brand Mentions vs Competitors */}
        <div className="rounded-2xl border bg-white p-5 shadow-xs lg:col-span-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-brand-950 md:text-base">
                Brand Mentions vs Competitors
              </h2>
              <p className="mt-0.5 text-xs text-brand-500">
                Total brand mentions across all AI platforms.
              </p>
            </div>
            {/* Top Legend */}
            <div className="flex items-center gap-3 text-xs font-medium text-brand-600">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-xs bg-accent-600" /> Your Brand
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-xs bg-accent-200" /> Competitors
              </span>
            </div>
          </div>

          {/* Grouped Bar Chart */}
          <div className="mt-5 h-[230px] w-full">
            {mentionComparisons.length ? (<ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={mentionComparisons}
                margin={{ top: 20, right: 10, left: -20, bottom: 0 }}
                barGap={4}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-line)" />
                <XAxis
                  dataKey="platform"
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                  tick={{ fill: "var(--color-brand-600)", fontWeight: 500 }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                  tick={{ fill: "var(--color-brand-400)" }}
                />
                <Tooltip
                  cursor={{ fill: "var(--color-brand-100)" }}
                  contentStyle={{
                    backgroundColor: "var(--color-surface-1, white)",
                    borderRadius: "12px",
                    border: "1px solid var(--color-line)",
                    fontSize: "12px",
                  }}
                />
                <Bar
                  dataKey="yourBrand"
                  name="Your Brand"
                  fill="var(--color-accent-600)"
                  radius={[4, 4, 0, 0]}
                  barSize={16}
                />
                <Bar
                  dataKey="competitors"
                  name="Competitors"
                  fill="var(--color-accent-200)"
                  radius={[4, 4, 0, 0]}
                  barSize={16}
                />
              </BarChart>
            </ResponsiveContainer>) : <NoMeasurement />}
          </div>

          {/* Platform Icon Labels Row */}
          <div className="mt-4 flex items-center justify-around text-xs font-semibold text-brand-800">
            <span className="flex items-center gap-1 text-series-1">
              <GeminiIcon className="h-3.5 w-3.5" /> Gemini
            </span>
            <span className="flex items-center gap-1 text-brand-950">
              <OpenAiIcon className="h-3.5 w-3.5" /> OpenAI
            </span>
            <span className="flex items-center gap-1 text-series-7">
              <ClaudeIcon className="h-3.5 w-3.5" /> Claude
            </span>
            <span className="flex items-center gap-1 text-series-8">
              <PerplexityIcon className="h-3.5 w-3.5" /> Perplexity
            </span>
            <span className="flex items-center gap-1 text-brand-950">
              <GrokIcon className="h-3.5 w-3.5" /> Grok
            </span>
          </div>
        </div>
      </div>

      {/* ── Third Row: Latest AI Responses & Citation Sources ───────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Left Card: Latest AI Responses */}
        <div className="rounded-2xl border bg-white p-5 shadow-xs lg:col-span-7">
          <div>
            <h2 className="text-sm font-bold text-brand-950 md:text-base">Latest AI Responses</h2>
            <p className="mt-0.5 text-xs text-brand-500">
              See how AI platforms currently talk about your brand.
            </p>
          </div>

          {/* Platform Tab Buttons */}
          <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl bg-brand-50 p-1 border">
            {platforms.map((platform) => {
              const Icon = platform.icon;
              const isActive = selectedModel === platform.id;
              return (
                <button
                  key={platform.id}
                  type="button"
                  onClick={() => {
                    setSelectedModel(platform.id);
                    setActiveResponseIndex(0);
                  }}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                    isActive
                      ? "bg-white text-brand-950 shadow-xs"
                      : "text-brand-500 hover:text-brand-900"
                  }`}
                >
                  <span className={platform.iconColor}>
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <span>{platform.name}</span>
                </button>
              );
            })}
          </div>

          {/* Response Box */}
          <div className="mt-4 rounded-xl border bg-brand-50/50 p-4">
            {/* Response Meta Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary-50 text-primary-600">
                  <Sparkles className="h-3 w-3 fill-primary-600 text-primary-600" />
                </span>
                <span className="rounded-full bg-success-50 px-2 py-0.5 text-[11px] font-semibold text-success-700">
                  {answer ? (answer.cited ? "Mentioned" : "Absent") : "Not measured"}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-brand-400">{recordedDate(answer?.checkedAt)}</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    aria-label="Previous response"
                    disabled={currentQuotes.length < 2}
                    onClick={handlePrevQuote}
                    className="flex h-6 w-6 items-center justify-center rounded-md border bg-white text-brand-500 hover:text-brand-900 shadow-2xs"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label="Next response"
                    disabled={currentQuotes.length < 2}
                    onClick={handleNextQuote}
                    className="flex h-6 w-6 items-center justify-center rounded-md border bg-white text-brand-500 hover:text-brand-900 shadow-2xs"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Quoted Text */}
            <p className="mt-3 text-xs leading-relaxed text-brand-700 md:text-sm">
              {currentQuote}
            </p>

            {/* Tags & Action Row */}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t pt-3">
              <button
                type="button"
                disabled={!answer} onClick={() => setIsModalOpen(true)}
                className="text-xs font-semibold text-accent-600 hover:text-accent-700 hover:underline"
              >
                View Saved Response
              </button>

              <div className="flex flex-wrap items-center gap-1.5"><span className="rounded-full bg-brand-100 px-2.5 py-0.5 text-[11px] font-medium text-brand-700">{answer ? (answer.cited ? 'Brand mentioned' : 'Brand absent') : 'Not measured'}</span></div>
            </div>
          </div>
        </div>

        {/* Right Card: Citation Sources */}
        <div className="rounded-2xl border bg-white p-5 shadow-xs lg:col-span-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-brand-950 md:text-base">Citation Sources</h2>
              <p className="mt-0.5 text-xs text-brand-500">
                Websites that AI platforms cite when mentioning your brand.
              </p>
            </div>
          </div>

          {/* Table */}
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b text-brand-400">
                  <th className="pb-2 font-medium">Domain</th>
                  <th className="pb-2 font-medium">Cited By</th>
                  <th className="pb-2 font-medium text-center">Mentions</th>
                  <th className="pb-2 font-medium text-right">Last Seen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-100/50">{!citationSources.length && <tr><td colSpan={8}><NoMeasurement /></td></tr>}
                {citationSources.map((source) => (
                  <tr key={source.domain} className="group hover:bg-brand-50/50">
                    <td className="py-2.5 font-semibold text-brand-900">{source.domain}</td>
                    <td className="py-2.5">
                      <div className="flex items-center gap-1.5">
                        {source.citedBy.map((p) => {
                          if (p === "gemini")
                            return <GeminiIcon key={p} className="h-3 w-3 text-series-1" />;
                          if (p === "openai")
                            return <OpenAiIcon key={p} className="h-3 w-3 text-brand-950" />;
                          if (p === "claude")
                            return <ClaudeIcon key={p} className="h-3 w-3 text-series-7" />;
                          if (p === "perplexity")
                            return <PerplexityIcon key={p} className="h-3 w-3 text-series-8" />;
                          return <GrokIcon key={p} className="h-3 w-3 text-brand-950" />;
                        })}
                      </div>
                    </td>
                    <td className="py-2.5 text-center font-bold text-brand-800">
                      {source.mentions}
                    </td>
                    <td className="py-2.5 text-right font-medium text-brand-500">
                      {source.lastSeen}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Table Bottom Link */}
          <div className="mt-4 border-t pt-3 text-center">
            <button
              type="button"
              onClick={() => onNavigateTab?.("citations")}
              className="inline-flex items-center gap-1 text-xs font-semibold text-accent-600 hover:text-accent-700 hover:underline"
            >
              <span>View All Sources</span>
              <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Bottom Row: 3 Columns (Insights, Opportunities, Actions) ── */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* Card 1: Key Insights */}
        <div className="rounded-2xl border bg-white p-5 shadow-xs">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-warning-50 text-warning-700">
              <Lightbulb className="h-4 w-4" />
            </span>
            <h2 className="text-sm font-bold text-brand-950 md:text-base">Key Insights</h2>
          </div>

          <ul className="mt-4 space-y-3 text-xs leading-relaxed text-brand-700"><li>{report?.summary.checked ? `${report.summary.cited} of ${report.summary.checked} saved answers mention your brand.` : "No measured insights yet."}</li></ul>
        </div>

        {/* Card 2: Opportunities */}
        <div className="rounded-2xl border bg-white p-5 shadow-xs">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-warning-50 text-warning-700">
              <Target className="h-4 w-4" />
            </span>
            <h2 className="text-sm font-bold text-brand-950 md:text-base">Opportunities</h2>
          </div>

          <ol className="mt-4 space-y-3 text-xs leading-relaxed text-brand-700">{actions.length ? actions.map(a=><li key={a.id}>{a.title}</li>) : <li>No evidence-backed opportunities yet.</li>}</ol>
        </div>

        {/* Card 3: Recommended Actions */}
        <div className="rounded-2xl border bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
                <Wrench className="h-4 w-4" />
              </span>
              <h2 className="text-sm font-bold text-brand-950 md:text-base">Recommended Actions</h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab?.("actions")}
              className="text-xs font-semibold text-primary-600 hover:text-primary-700 hover:underline"
            >
              View All →
            </button>
          </div>

          <div className="mt-4 space-y-3">
            {/* Action Item 1 */}
            {actions.length ? actions.map(a => <div key={a.id} className="flex items-center justify-between gap-2 rounded-xl border p-2.5"><h3 className="text-xs font-bold text-brand-950">{a.title}</h3><button type="button" onClick={()=>onNavigateTab?.('actions')} className="text-xs font-semibold text-primary-600">View action</button></div>) : <NoMeasurement>No saved actions yet.</NoMeasurement>}
          </div>
        </div>
      </div>

      {isModalOpen && <VisibilityDetails kind="response" model={selectedModel} checkedAt={answer?.checkedAt} prompts={prompts} onClose={() => setIsModalOpen(false)} />}

    </div>
  );
}
