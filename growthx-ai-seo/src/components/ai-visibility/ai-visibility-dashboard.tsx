"use client";

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

function GrokIcon({ className = "w-4 h-4" }: { className?: string }) {
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
  score: number;
  delta: string;
  mentions: number;
  recommendations: number;
  citations: number;
  colorVar: string;
  barClass: string;
  icon: (props: { className?: string }) => React.JSX.Element;
  iconColor: string;
}

const PLATFORMS: PlatformData[] = [
  {
    id: "gemini",
    name: "Gemini",
    score: 78,
    delta: "↗ 32%",
    mentions: 42,
    recommendations: 28,
    citations: 18,
    colorVar: "var(--color-series-1)",
    barClass: "bg-series-1",
    icon: GeminiIcon,
    iconColor: "text-series-1",
  },
  {
    id: "openai",
    name: "OpenAI",
    score: 65,
    delta: "↗ 18%",
    mentions: 35,
    recommendations: 18,
    citations: 12,
    colorVar: "var(--color-series-2)",
    barClass: "bg-series-2",
    icon: OpenAiIcon,
    iconColor: "text-brand-950",
  },
  {
    id: "claude",
    name: "Claude",
    score: 62,
    delta: "↗ 24%",
    mentions: 28,
    recommendations: 20,
    citations: 10,
    colorVar: "var(--color-series-7)",
    barClass: "bg-series-7",
    icon: ClaudeIcon,
    iconColor: "text-series-7",
  },
  {
    id: "perplexity",
    name: "Perplexity",
    score: 70,
    delta: "↗ 41%",
    mentions: 38,
    recommendations: 24,
    citations: 26,
    colorVar: "var(--color-series-6)",
    barClass: "bg-series-6",
    icon: PerplexityIcon,
    iconColor: "text-series-8",
  },
  {
    id: "grok",
    name: "Grok",
    score: 60,
    delta: "↗ 27%",
    mentions: 26,
    recommendations: 16,
    citations: 14,
    colorVar: "var(--color-series-5)",
    barClass: "bg-series-5",
    icon: GrokIcon,
    iconColor: "text-brand-950",
  },
];

/* ── Historical Trend Data (5 platforms over 5 weeks) ────────────── */

const TREND_POINTS = [
  { date: "Aug 1", gemini: 46, openai: 38, claude: 30, perplexity: 52, grok: 22 },
  { date: "Aug 8", gemini: 58, openai: 44, claude: 36, perplexity: 62, grok: 28 },
  { date: "Aug 15", gemini: 66, openai: 52, claude: 42, perplexity: 67, grok: 36 },
  { date: "Aug 22", gemini: 64, openai: 50, claude: 41, perplexity: 66, grok: 38 },
  { date: "Aug 29", gemini: 78, openai: 65, claude: 62, perplexity: 70, grok: 60 },
];

/* ── Mentions vs Competitors Comparison Data ─────────────────────── */

const MENTION_COMPARISONS = [
  { platform: "Gemini", yourBrand: 42, competitors: 28, id: "gemini" },
  { platform: "OpenAI", yourBrand: 35, competitors: 18, id: "openai" },
  { platform: "Claude", yourBrand: 28, competitors: 32, id: "claude" },
  { platform: "Perplexity", yourBrand: 38, competitors: 26, id: "perplexity" },
  { platform: "Grok", yourBrand: 26, competitors: 34, id: "grok" },
];

/* ── Citation Sources Table Data ─────────────────────────────────── */

interface CitationSource {
  domain: string;
  citedBy: Array<"gemini" | "openai" | "claude" | "perplexity" | "grok">;
  mentions: number;
  lastSeen: string;
}

/* ── Component Main Implementation ──────────────────────────────── */

export function AiVisibilityDashboard({
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
  const [selectedModel, setSelectedModel] = useState<PlatformData["id"]>("gemini");
  const [activeResponseIndex, setActiveResponseIndex] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const displayDomain = domain || "your-domain.com";
  const displayBrand = brandLabel || displayDomain.replace(/^www\./, "").split(".")[0] || "Your Brand";

  // Citation sources with dynamic user domain in the first row
  const citationSources: CitationSource[] = [
    {
      domain: displayDomain,
      citedBy: ["gemini", "openai", "perplexity"],
      mentions: 24,
      lastSeen: "Aug 28, 2025",
    },
    {
      domain: "instagram.com",
      citedBy: ["gemini", "openai"],
      mentions: 18,
      lastSeen: "Aug 27, 2025",
    },
    {
      domain: "facebook.com",
      citedBy: ["gemini", "openai"],
      mentions: 15,
      lastSeen: "Aug 26, 2025",
    },
    {
      domain: "justdial.com",
      citedBy: ["gemini", "openai", "perplexity"],
      mentions: 12,
      lastSeen: "Aug 25, 2025",
    },
    {
      domain: "youtube.com",
      citedBy: ["claude", "gemini", "openai"],
      mentions: 10,
      lastSeen: "Aug 24, 2025",
    },
  ];

  // Model-specific quotes for the "Latest AI Responses" card
  const modelQuotes: Record<PlatformData["id"], string[]> = {
    gemini: [
      `"${displayBrand} is a popular choice for quality offerings and trusted service, highlighted for high standards, transparent sourcing, and direct-to-consumer reliability. They emphasize freshness, customer care, and prompt delivery across regions."`,
      `"When looking for reliable regional providers, ${displayBrand} consistently ranks as a recommended option with verified client feedback and strong consistency in product availability."`,
    ],
    openai: [
      `"${displayBrand} operates as an established provider known for consistent quality and customer satisfaction. It is regularly recommended for users prioritizing verified purity, direct ordering options, and timely support."`,
    ],
    claude: [
      `"In comparison to market competitors, ${displayBrand} maintains strong standing in dedicated customer service and reliable direct distribution, though competitors are frequently cited in general category guides."`,
    ],
    perplexity: [
      `"According to multiple web sources, ${displayBrand} is a leading brand recognized for authentic production standards and rapid order turnaround, frequently referenced in local review digests and social directories."`,
    ],
    grok: [
      `"${displayBrand} shows notable positive engagement across social mentions and customer feedback channels, with growing visibility for its core product line and competitive pricing structure."`,
    ],
  };

  const currentQuotes = modelQuotes[selectedModel] || modelQuotes.gemini;
  const currentQuote = currentQuotes[activeResponseIndex % currentQuotes.length];

  const handleNextQuote = () => {
    setActiveResponseIndex((prev) => (prev + 1) % currentQuotes.length);
  };

  const handlePrevQuote = () => {
    setActiveResponseIndex((prev) => (prev - 1 + currentQuotes.length) % currentQuotes.length);
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
            disabled={isScanning}
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
        {PLATFORMS.map((platform) => {
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
                  {platform.score}
                </span>
                <span className="text-xs font-medium text-brand-400">/100</span>
              </div>

              {/* Progress Bar */}
              <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-brand-100">
                <div
                  className={`h-full rounded-full ${platform.barClass}`}
                  style={{ width: `${platform.score}%` }}
                />
              </div>

              {/* Sub Metrics: Mentions, Recommendations, Citations */}
              <div className="mt-4 grid grid-cols-3 divide-x divide-brand-100 text-center">
                <div className="pr-1">
                  <span className="block text-[10px] font-medium text-brand-400">Mentions</span>
                  <span className="mt-0.5 block text-xs font-bold text-brand-800">
                    {platform.mentions}
                  </span>
                </div>
                <div className="px-1">
                  <span className="block text-[10px] font-medium text-brand-400">Recommendations</span>
                  <span className="mt-0.5 block text-xs font-bold text-brand-800">
                    {platform.recommendations}
                  </span>
                </div>
                <div className="pl-1">
                  <span className="block text-[10px] font-medium text-brand-400">Citations</span>
                  <span className="mt-0.5 block text-xs font-bold text-brand-800">
                    {platform.citations}
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
                Your overall visibility score across AI platforms over time.
              </p>
            </div>
            <div className="relative">
              <div className="flex items-center rounded-lg border bg-white px-2.5 py-1 text-xs font-medium text-brand-700 shadow-xs">
                <span>Last 30 Days</span>
                <ChevronDown className="ml-1 h-3 w-3 text-brand-400" />
              </div>
            </div>
          </div>

          {/* Line Chart */}
          <div className="mt-5 h-[230px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={TREND_POINTS} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
                <Line
                  type="monotone"
                  dataKey="gemini"
                  name="Gemini"
                  stroke="var(--color-series-1)"
                  strokeWidth={2}
                  dot={{ r: 3, fill: "var(--color-series-1)" }}
                  activeDot={{ r: 5 }}
                />
                <Line
                  type="monotone"
                  dataKey="openai"
                  name="OpenAI"
                  stroke="var(--color-series-3)"
                  strokeWidth={2}
                  dot={{ r: 3, fill: "var(--color-series-3)" }}
                  activeDot={{ r: 5 }}
                />
                <Line
                  type="monotone"
                  dataKey="claude"
                  name="Claude"
                  stroke="var(--color-series-7)"
                  strokeWidth={2}
                  dot={{ r: 3, fill: "var(--color-series-7)" }}
                  activeDot={{ r: 5 }}
                />
                <Line
                  type="monotone"
                  dataKey="perplexity"
                  name="Perplexity"
                  stroke="var(--color-series-6)"
                  strokeWidth={2}
                  dot={{ r: 3, fill: "var(--color-series-6)" }}
                  activeDot={{ r: 5 }}
                />
                <Line
                  type="monotone"
                  dataKey="grok"
                  name="Grok"
                  stroke="var(--color-series-5)"
                  strokeWidth={2}
                  dot={{ r: 3, fill: "var(--color-series-5)" }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Bottom Chart Legend */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-5 text-xs font-medium text-brand-600">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-series-1" /> Gemini
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-series-3" /> OpenAI
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-series-7" /> Claude
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-series-6" /> Perplexity
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-series-5" /> Grok
            </span>
          </div>
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
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={MENTION_COMPARISONS}
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
            </ResponsiveContainer>
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
            {PLATFORMS.map((platform) => {
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
                  Recommended
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-brand-400">Aug 28, 2025 | 10:14 AM</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    aria-label="Previous response"
                    onClick={handlePrevQuote}
                    className="flex h-6 w-6 items-center justify-center rounded-md border bg-white text-brand-500 hover:text-brand-900 shadow-2xs"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label="Next response"
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
                onClick={() => setIsModalOpen(true)}
                className="text-xs font-semibold text-accent-600 hover:text-accent-700 hover:underline"
              >
                View Full Response
              </button>

              <div className="flex flex-wrap items-center gap-1.5">
                <span className="rounded-full bg-accent-50 px-2.5 py-0.5 text-[11px] font-medium text-accent-700">
                  Brand Mention
                </span>
                <span className="rounded-full bg-success-50 px-2.5 py-0.5 text-[11px] font-medium text-success-700">
                  Recommendation
                </span>
                <span className="rounded-full bg-brand-100 px-2.5 py-0.5 text-[11px] font-medium text-brand-700">
                  Product Details
                </span>
                <span className="rounded-full bg-success-50 px-2.5 py-0.5 text-[11px] font-medium text-success-700">
                  Positive Sentiment
                </span>
              </div>
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
              <tbody className="divide-y divide-brand-100/50">
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

          <ul className="mt-4 space-y-3 text-xs leading-relaxed text-brand-700">
            <li className="flex items-start gap-2">
              <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-success-50 text-success-700">
                <Check className="h-2.5 w-2.5 stroke-[3]" />
              </span>
              <span>Your brand is most visible on Gemini (+32%)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary-600">
                <Check className="h-2.5 w-2.5 stroke-[3]" />
              </span>
              <span>Perplexity shows highest citation rate (+41%)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-warning-50 text-warning-700">
                <Check className="h-2.5 w-2.5 stroke-[3]" />
              </span>
              <span>Claude mentions your competitors more frequently</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-success-50 text-success-700">
                <Check className="h-2.5 w-2.5 stroke-[3]" />
              </span>
              <span>Grok visibility improved significantly (+27%)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-accent-50 text-accent-700">
                <Check className="h-2.5 w-2.5 stroke-[3]" />
              </span>
              <span>More product-specific recommendations are needed</span>
            </li>
          </ul>
        </div>

        {/* Card 2: Opportunities */}
        <div className="rounded-2xl border bg-white p-5 shadow-xs">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-warning-50 text-warning-700">
              <Target className="h-4 w-4" />
            </span>
            <h2 className="text-sm font-bold text-brand-950 md:text-base">Opportunities</h2>
          </div>

          <ol className="mt-4 space-y-3 text-xs leading-relaxed text-brand-700">
            <li className="flex items-start gap-2.5">
              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary-50 text-[10px] font-bold text-primary-700">
                1
              </span>
              <span>Improve Claude visibility with more industry content</span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary-50 text-[10px] font-bold text-primary-700">
                2
              </span>
              <span>Get listed on more trusted websites for citations</span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary-50 text-[10px] font-bold text-primary-700">
                3
              </span>
              <span>Strengthen product mentions on Grok</span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary-50 text-[10px] font-bold text-primary-700">
                4
              </span>
              <span>Create more comparison content vs competitors</span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary-50 text-[10px] font-bold text-primary-700">
                5
              </span>
              <span>Optimize for AI chatbot specific content formats</span>
            </li>
          </ol>
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
            <div className="flex items-center justify-between gap-2 rounded-xl border p-2.5 transition-colors hover:bg-brand-50/50">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-success-50 text-success-700">
                  <ShieldCheck className="h-4 w-4" />
                </span>
                <div>
                  <h3 className="text-xs font-bold text-brand-950">Create comparison content</h3>
                  <p className="text-[11px] text-brand-500">Address competitor mentions on Claude</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab?.("actions")}
                className="shrink-0 rounded-lg border bg-primary-50 px-2.5 py-1 text-[11px] font-semibold text-primary-700 shadow-2xs hover:bg-primary-100"
              >
                Fix with AI
              </button>
            </div>

            {/* Action Item 2 */}
            <div className="flex items-center justify-between gap-2 rounded-xl border p-2.5 transition-colors hover:bg-brand-50/50">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-warning-50 text-warning-700">
                  <FolderOpen className="h-4 w-4" />
                </span>
                <div>
                  <h3 className="text-xs font-bold text-brand-950">Get listed on relevant directories</h3>
                  <p className="text-[11px] text-brand-500">Increase citation sources across platforms</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab?.("citations")}
                className="shrink-0 rounded-lg border bg-primary-50 px-2.5 py-1 text-[11px] font-semibold text-primary-700 shadow-2xs hover:bg-primary-100"
              >
                Find Opportunities
              </button>
            </div>

            {/* Action Item 3 */}
            <div className="flex items-center justify-between gap-2 rounded-xl border p-2.5 transition-colors hover:bg-brand-50/50">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-50 text-accent-700">
                  <MessageSquare className="h-4 w-4" />
                </span>
                <div>
                  <h3 className="text-xs font-bold text-brand-950">Add product-specific FAQs</h3>
                  <p className="text-[11px] text-brand-500">Improve detailed mentions and recommendations</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab?.("actions")}
                className="shrink-0 rounded-lg border bg-primary-50 px-2.5 py-1 text-[11px] font-semibold text-primary-700 shadow-2xs hover:bg-primary-100"
              >
                Generate with AI
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── View Full Response Modal ─────────────────────────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-2xl rounded-2xl border bg-white p-6 shadow-xl">
            <button
              type="button"
              aria-label="Close dialog"
              onClick={() => setIsModalOpen(false)}
              className="absolute right-4 top-4 rounded-lg p-1.5 text-brand-400 hover:bg-brand-50 hover:text-brand-900"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
                <Sparkles className="h-4 w-4 fill-primary-600 text-primary-600" />
              </span>
              <div>
                <h3 className="text-base font-bold text-brand-950">
                  Full AI Response ({PLATFORMS.find((p) => p.id === selectedModel)?.name})
                </h3>
                <p className="text-xs text-brand-500">Recorded Aug 28, 2025 at 10:14 AM</p>
              </div>
            </div>

            <div className="mt-4 rounded-xl border bg-brand-50/60 p-4 text-xs leading-relaxed text-brand-800 md:text-sm">
              <p className="font-medium text-brand-900 mb-2">Monitored Query:</p>
              <p className="italic text-brand-600 mb-4 border-l-2 border-primary-400 pl-3">
                &ldquo;What are the best dairy brands for fresh milk and farm delivery in this area?&rdquo;
              </p>
              <p className="font-medium text-brand-900 mb-2">Complete Model Answer:</p>
              <p className="text-brand-800 leading-relaxed">
                {currentQuote}
              </p>
            </div>

            <div className="mt-4 flex items-center justify-between text-xs">
              <div className="flex gap-2">
                <span className="rounded-full bg-success-50 px-2.5 py-0.5 font-semibold text-success-700">
                  Brand Recommended
                </span>
                <span className="rounded-full bg-accent-50 px-2.5 py-0.5 font-semibold text-accent-700">
                  Sentiment: 92% Positive
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-lg bg-brand-900 px-4 py-2 font-semibold text-white hover:bg-brand-950"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
