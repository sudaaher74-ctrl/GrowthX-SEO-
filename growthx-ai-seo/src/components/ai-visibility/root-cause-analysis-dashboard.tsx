"use client";

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

export interface RootCauseAnalysisDashboardProps {
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
  const [selectedResponsePlatform, setSelectedResponsePlatform] = useState<
    "gemini" | "openai" | "claude" | "perplexity" | "grok"
  >("gemini");
  const [severityFilter, setSeverityFilter] = useState<"all" | "high" | "medium">("all");

  const displayDomain = domain || "your-domain.com";
  const displayBrand = brandLabel || displayDomain.replace(/^www\./, "").split(".")[0] || "Your Brand";

  // Data Sources for the Overview diagram
  const dataSources = [
    {
      name: "AI Visibility (5 platforms)",
      desc: "Brand mentions & citations",
      icon: Bot,
      color: "text-primary-600 bg-primary-50",
    },
    {
      name: "Website Audit",
      desc: "Technical & content issues",
      icon: Gauge,
      color: "text-accent-600 bg-accent-50",
    },
    {
      name: "Competitor Analysis",
      desc: "How competitors are performing",
      icon: Users,
      color: "text-warning-600 bg-warning-50",
    },
    {
      name: "Search Console",
      desc: "Search performance trends",
      icon: Search,
      color: "text-series-1 bg-series-1/10",
    },
    {
      name: "Citation Intelligence",
      desc: "External source coverage",
      icon: Link2,
      color: "text-series-2 bg-series-2/10",
    },
  ];

  // Key Root Causes
  const keyRootCauses = [
    {
      id: 1,
      title: "Lack of authoritative content",
      severity: "High",
      badgeColor: "bg-error-50 text-error-700 border-error-200",
      numBg: "bg-error-600 text-white",
    },
    {
      id: 2,
      title: "Missing product-specific information",
      severity: "High",
      badgeColor: "bg-warning-50 text-warning-700 border-warning-200",
      numBg: "bg-warning-600 text-white",
    },
    {
      id: 3,
      title: "Weak external citations",
      severity: "Medium",
      badgeColor: "bg-accent-50 text-accent-700 border-accent-200",
      numBg: "bg-accent-600 text-white",
    },
    {
      id: 4,
      title: "Competitors have stronger content",
      severity: "Medium",
      badgeColor: "bg-series-1/10 text-series-1 border-series-1/20",
      numBg: "bg-series-1 text-white",
    },
    {
      id: 5,
      title: "Limited E-E-A-T signals",
      severity: "Medium",
      badgeColor: "bg-primary-50 text-primary-700 border-primary-200",
      numBg: "bg-primary-600 text-white",
    },
  ];

  // AI Visibility Comparison Brands (Bar Chart)
  const competitorBars = [
    { name: "Amul", mentions: 124, percent: 100, barColor: "bg-primary-600" },
    { name: "Country Delight", mentions: 96, percent: 77, barColor: "bg-series-1" },
    { name: "Nandini", mentions: 48, percent: 39, barColor: "bg-accent-500" },
    { name: "Mother Dairy", mentions: 28, percent: 23, barColor: "bg-series-2" },
    { name: "Aavin", mentions: 18, percent: 15, barColor: "bg-warning-500" },
    { name: `${displayBrand} (You)`, mentions: 16, percent: 13, barColor: "bg-success-600" },
  ];

  // Detailed Root Cause Cards
  const detailedCauses = [
    {
      id: 1,
      title: "1. Lack of authoritative content",
      severity: "High",
      severityClass: "bg-error-50 text-error-700",
      desc: "Your website has limited in-depth content on key dairy topics that AI platforms frequently reference.",
      affects: "AI Mentions, Citations, Recommendations",
    },
    {
      id: 2,
      title: "2. Missing product-specific info",
      severity: "High",
      severityClass: "bg-warning-50 text-warning-700",
      desc: "Important product details like nutrition, sourcing, and benefits are incomplete or not clearly structured.",
      affects: "Product Recommendations",
    },
    {
      id: 3,
      title: "3. Weak external citations",
      severity: "Medium",
      severityClass: "bg-accent-50 text-accent-700",
      desc: "Fewer high-authority websites mention your brand compared to competitors.",
      affects: "Citations, Brand Authority",
    },
    {
      id: 4,
      title: "4. Stronger competitor content",
      severity: "Medium",
      severityClass: "bg-series-1/10 text-series-1",
      desc: "Competitors like Amul and Country Delight have more comprehensive content and more external mentions.",
      affects: "Relative Visibility",
    },
    {
      id: 5,
      title: "5. Limited E-E-A-T signals",
      severity: "Medium",
      severityClass: "bg-primary-50 text-primary-700",
      desc: "Your website lacks clear trust signals such as expert content, author information, and external endorsements.",
      affects: "Authority & Trust",
    },
  ];

  // AI Response Quotes
  const platformQuotes: Record<
    "gemini" | "openai" | "claude" | "perplexity" | "grok",
    { quote: string; missingNote: string; date: string }
  > = {
    gemini: {
      quote:
        "Amul is one of the most popular dairy brands in India, known for its wide range of milk, curd, paneer and other dairy products. It is widely available and trusted for quality.",
      missingNote: `No mention of ${displayBrand}`,
      date: "Aug 28, 2025",
    },
    openai: {
      quote:
        "Country Delight and Amul are frequently cited for fresh dairy delivery and pure organic farm milk with subscription models in metro cities.",
      missingNote: `${displayBrand} ranked below top 5 organic search citations`,
      date: "Aug 27, 2025",
    },
    claude: {
      quote:
        "For certified farm-to-table dairy products, leading cooperative brands such as Nandini and Mother Dairy provide consistent national coverage.",
      missingNote: `Zero cited authority sources found for ${displayDomain}`,
      date: "Aug 26, 2025",
    },
    perplexity: {
      quote:
        "According to consumer reports, Amul and Country Delight dominate market share and customer recall across online grocery channels.",
      missingNote: `${displayBrand} missing from major third-party ranking roundups`,
      date: "Aug 25, 2025",
    },
    grok: {
      quote:
        "Top dairy suppliers with high verified user ratings include Amul, Mother Dairy, and regional state federations.",
      missingNote: `No structured FAQ or Product schema detected on ${displayDomain}`,
      date: "Aug 24, 2025",
    },
  };

  // Content Gap Table Data
  const contentGaps = [
    {
      topic: "Health benefits of cow milk",
      competitorsCovering: "4 / 5",
      status: "Missing",
      statusColor: "bg-error-50 text-error-700",
    },
    {
      topic: "Nutritional information",
      competitorsCovering: "5 / 5",
      status: "Missing",
      statusColor: "bg-error-50 text-error-700",
    },
    {
      topic: "Sourcing and farm practices",
      competitorsCovering: "4 / 5",
      status: "Limited",
      statusColor: "bg-warning-50 text-warning-700",
    },
    {
      topic: "Recipes and usage ideas",
      competitorsCovering: "3 / 5",
      status: "Missing",
      statusColor: "bg-error-50 text-error-700",
    },
    {
      topic: "Sustainability and packaging",
      competitorsCovering: "4 / 5",
      status: "Missing",
      statusColor: "bg-error-50 text-error-700",
    },
  ];

  // Recommended Actions
  const recommendedActions = [
    {
      num: 1,
      title: "Create in-depth content on health benefits and nutrition",
      buttonText: "Generate with AI",
      buttonColor: "bg-primary-600 hover:bg-primary-700 text-white",
    },
    {
      num: 2,
      title: "Add detailed product pages with FAQs",
      buttonText: "Fix with AI",
      buttonColor: "bg-primary-600 hover:bg-primary-700 text-white",
    },
    {
      num: 3,
      title: "Get listed on high-authority food and dairy websites",
      buttonText: "Find Opportunities",
      buttonColor: "bg-accent-600 hover:bg-accent-700 text-white",
    },
    {
      num: 4,
      title: "Improve structured data (Product, FAQ, Organization)",
      buttonText: "Fix with AI",
      buttonColor: "bg-primary-600 hover:bg-primary-700 text-white",
    },
    {
      num: 5,
      title: "Publish expert content with author information",
      buttonText: "Generate with AI",
      buttonColor: "bg-primary-600 hover:bg-primary-700 text-white",
    },
  ];

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
            disabled={isScanning}
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
            <span className="text-2xl font-bold tracking-tight text-brand-950">62</span>
            <span className="text-xs font-medium text-brand-400">/100</span>
            <span className="ml-auto text-xs font-semibold text-error-700">↘ -18%</span>
          </div>
          <p className="mt-1 text-[11px] text-brand-400">vs previous 30 days</p>
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
            <span className="text-2xl font-bold tracking-tight text-brand-950">286</span>
            <span className="ml-auto text-xs font-semibold text-error-700">↘ -24%</span>
          </div>
          <p className="mt-1 text-[11px] text-brand-400">across 5 AI platforms</p>
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
            <span className="text-2xl font-bold tracking-tight text-brand-950">84</span>
            <span className="ml-auto text-xs font-semibold text-error-700">↘ -32%</span>
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
            <span className="text-2xl font-bold tracking-tight text-brand-950">22%</span>
            <span className="ml-auto text-xs font-semibold text-error-700">↘ -14%</span>
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
            <span className="text-2xl font-bold tracking-tight text-brand-950">4 / 5</span>
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
                Based on analysis of 5 data sources, we found the key reasons behind your low AI visibility.
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
                Data Sources Analyzed
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
                  Cross-analyzes all data to find patterns and root causes
                </p>
              </div>
            </div>

            {/* 3. Right Node: Key Root Causes (4 cols) */}
            <div className="space-y-2 md:col-span-4">
              <span className="block text-[11px] font-bold uppercase tracking-wider text-brand-400 mb-2">
                Key Root Causes
              </span>
              {keyRootCauses.map((rc) => (
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
              <p className="mt-0.5 text-xs text-brand-500">Why competitors are mentioned more often.</p>
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
                  >
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
            >
              <span>View Full Response</span>
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
              <tbody className="divide-y" style={{ borderColor: "var(--border-color)" }}>
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
              >
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
                  >
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
