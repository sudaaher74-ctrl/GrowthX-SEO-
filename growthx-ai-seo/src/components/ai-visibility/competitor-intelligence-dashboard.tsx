"use client";

import { type LiveDashboardData, platformKey, savedAnswers, recordedDate, NoMeasurement } from './live-dashboard-data';
import { useRouter } from "next/navigation";
import React, { useState } from "react";
import {
  Crosshair,
  Users,
  Search,
  PieChart as PieIcon,
  Link2,
  Bot,
  Calendar,
  ChevronDown,
  Sparkles,
  ArrowRight,
  TrendingUp,
  FileText,
  Play,
  Loader2,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { GeminiIcon, OpenAiIcon, ClaudeIcon, PerplexityIcon, GrokIcon } from "./ai-visibility-dashboard";

export interface CompetitorIntelligenceDashboardProps extends LiveDashboardData {
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

export function CompetitorIntelligenceDashboard({
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
}: CompetitorIntelligenceDashboardProps) {
  const router = useRouter();
  const [selectedMetric, setSelectedMetric] = useState<"all" | "keywords" | "traffic" | "backlinks">("all");
  const displayDomain = domain || "No website selected";
  const displayBrand = brandLabel || displayDomain.replace(/^www\./, "").split(".")[0] || "Your Brand";

  // Competitor Overview Table Data
  const competitorRows = (report?.shareOfVoice ?? []).map(r=>({website:r.domain ?? displayDomain,isOwn:r.domain===null,keywords:'—',top10:'—',da:'—',backlinks:'—',aiMentions:r.mentions,contentScore:null,barClass:'bg-series-1'}));

  // Market Position Bar Chart Data
  const marketPositionData = [] as {name:string;keywords:number;color:string}[];

  // Topical Coverage Comparison Data
  const topicalCoverageData = [] as {topic:string;yourSite:number;competitorsAvg:number}[];

  // Competitor Profiles
  const competitorProfiles = competitors.map(c=>({name:c.label ?? c.name ?? c.domain,domain:c.domain,da:'—',keywords:'—',tag:'Tracked competitor',tagTone:'brand',desc:c.lastAnalyzedAt ? 'Last analysed '+recordedDate(c.lastAnalyzedAt) : 'Not analysed yet'}));

  // Content Gap Opportunities
  const contentGaps = [] as {topic:string;covering:string;volume:string;level:string;tone:string}[];

  // AI Visibility Comparison Table
  const aiVisibilityMatrix = (report?.shareOfVoice ?? []).map(r=>({domain:r.domain ?? displayDomain,gemini:'—',openai:'—',claude:'—',perplexity:'—',grok:'—',total:r.mentions,isOwn:r.domain===null}));

  return (
    <div className="space-y-6 pb-12 font-sans text-brand-950">
      {/* ── Header Bar ─────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
              <Crosshair className="h-4 w-4 text-primary-600" />
            </span>
            <h1 className="text-xl font-bold tracking-tight text-brand-950 md:text-2xl">
              Competitor Intelligence
            </h1>
          </div>
          <p className="mt-1 text-xs text-brand-500 md:text-sm">
            Analyze your competitors, find content gaps, and discover opportunities to grow your visibility across search and AI platforms.
          </p>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3">
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

          <button
            type="button"
            onClick={onRunScan}
            disabled={isScanning || !currentProjectId}
            className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-primary-700 disabled:opacity-60 md:text-sm"
          >
            {isScanning ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Play className="h-3.5 w-3.5 fill-current" />
            )}
            <span>Run Competitor Analysis</span>
          </button>
        </div>
      </div>

      {/* ── Top Row: 5 KPI Cards ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-5">
        {/* Total Competitors */}
        <div className="rounded-2xl border bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-bold text-brand-900">
              <Users className="h-3.5 w-3.5 text-accent-600" /> Total Competitors
            </span>
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent-50 text-accent-700">
              <Users className="h-3 w-3" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-brand-950">{competitors.length}</span>
          </div>
          <p className="mt-1 text-[11px] text-brand-400">Monitored websites</p>
        </div>

        {/* Organic Keywords */}
        <div className="rounded-2xl border bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-bold text-brand-900">
              <Search className="h-3.5 w-3.5 text-success-700" /> Organic Keywords
            </span>
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-success-50 text-success-700">
              <FileText className="h-3 w-3" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-brand-950">—</span>
            <span className="rounded-full bg-success-50 px-2 py-0.5 text-[11px] font-semibold text-success-700">
              —
            </span>
          </div>
          <p className="mt-1 text-[11px] text-brand-400">Keyword rankings not measured</p>
        </div>

        {/* Topical Coverage */}
        <div className="rounded-2xl border bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-bold text-brand-900">
              <PieIcon className="h-3.5 w-3.5 text-warning-700" /> Topical Coverage
            </span>
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-warning-50 text-warning-700">
              <PieIcon className="h-3 w-3" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-brand-950">—</span>
          </div>
          <p className="mt-1 text-[11px] text-brand-400">Topic coverage not measured</p>
        </div>

        {/* Backlinks */}
        <div className="rounded-2xl border bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-bold text-brand-900">
              <Link2 className="h-3.5 w-3.5 text-series-5" /> Backlinks
            </span>
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-error-50 text-error-700">
              <Link2 className="h-3 w-3" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-brand-950">—</span>
            <span className="rounded-full bg-success-50 px-2 py-0.5 text-[11px] font-semibold text-success-700">
              —
            </span>
          </div>
          <p className="mt-1 text-[11px] text-brand-400">Backlinks not measured</p>
        </div>

        {/* AI Mentions */}
        <div className="rounded-2xl border bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-bold text-brand-900">
              <Bot className="h-3.5 w-3.5 text-primary-600" /> AI Mentions
            </span>
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-50 text-primary-600">
              <Bot className="h-3 w-3" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-brand-950">{report?.shareOfVoice?.reduce((sum,r)=>sum+r.mentions,0) ?? "—"}</span>
            <span className="rounded-full bg-success-50 px-2 py-0.5 text-[11px] font-semibold text-success-700">
              —
            </span>
          </div>
          <p className="mt-1 text-[11px] text-brand-400">Mentions from the latest saved run</p>
        </div>
      </div>

      {/* ── Middle Row: Competitor Overview & Market Position Charts ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Competitor Overview Table */}
        <div className="rounded-2xl border bg-white p-5 shadow-xs lg:col-span-7">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-brand-950 md:text-base">Competitor Overview</h2>
              <p className="mt-0.5 text-xs text-brand-500">
                Key metrics comparison between your website and top competitors.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-brand-400 font-medium">Select Metrics</span>
              <div className="relative">
                <select
                  aria-label="Filter metrics"
                  value={selectedMetric}
                  onChange={(e) => setSelectedMetric(e.target.value as typeof selectedMetric)}
                  className="appearance-none rounded-lg border bg-white py-1 pl-2.5 pr-7 text-xs font-semibold text-brand-800 shadow-xs focus:outline-none"
                >
                  <option value="all">All Metrics</option>
                  <option value="keywords">Keywords</option>
                  <option value="traffic">Top Rankings</option>
                  <option value="backlinks">Backlinks</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-brand-400" />
              </div>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b text-brand-400">
                  <th className="pb-2 font-medium">Website</th>
                  <th className="pb-2 font-medium">Organic Keywords</th>
                  <th className="pb-2 font-medium">Top 10 Rankings</th>
                  <th className="pb-2 font-medium">Domain Authority</th>
                  <th className="pb-2 font-medium">Backlinks</th>
                  <th className="pb-2 font-medium">AI Mentions</th>
                  <th className="pb-2 font-medium text-right">Content Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-100/50">{!competitorRows.length && <tr><td colSpan={8}><NoMeasurement /></td></tr>}
                {competitorRows.map((row) => (
                  <tr key={row.website} className={`hover:bg-brand-50/50 ${row.isOwn ? "bg-primary-50/20 font-semibold" : ""}`}>
                    <td className="py-2.5">
                      <div className="flex items-center gap-1.5 font-semibold text-brand-900">
                        <span className="flex h-5 w-5 items-center justify-center rounded-sm bg-accent-100 font-bold text-accent-700 text-[10px]">
                          {row.website.slice(0, 1).toUpperCase()}
                        </span>
                        <span>{row.website}</span>
                      </div>
                    </td>
                    <td className="py-2.5 font-medium text-brand-700">{row.keywords}</td>
                    <td className="py-2.5 font-medium text-brand-700">{row.top10}</td>
                    <td className="py-2.5 font-bold text-brand-800">{row.da}</td>
                    <td className="py-2.5 font-medium text-brand-700">{row.backlinks}</td>
                    <td className="py-2.5 font-bold text-brand-900">{row.aiMentions}</td>
                    <td className="py-2.5 text-right">
                      <div className="inline-block w-20">
                        <div className="h-1.5 w-full rounded-full bg-brand-100 overflow-hidden">
                          <div className={`h-full rounded-full ${row.barClass}`} style={{ width: row.contentScore ?? 0 }} />
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Market Position & Topical Coverage */}
        <div className="space-y-4 lg:col-span-5">
          {/* Market Position Chart */}
          <div className="rounded-2xl border bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-brand-950 md:text-base">Market Position</h2>
                <p className="mt-0.5 text-xs text-brand-500">Your website vs competitors in organic search.</p>
              </div>
              <div className="relative">
                <div className="flex items-center rounded-lg border bg-white px-2 py-0.5 text-xs font-semibold text-brand-700 shadow-xs">
                  <span>Organic Keywords</span>
                  <ChevronDown className="ml-1 h-3 w-3 text-brand-400" />
                </div>
              </div>
            </div>

            <div className="mt-4 h-[140px] w-full">
              {marketPositionData.length ? (<ResponsiveContainer width="100%" height="100%">
                <BarChart data={marketPositionData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-line)" />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={10} tick={{ fill: "var(--color-brand-600)" }} />
                  <YAxis tickLine={false} axisLine={false} fontSize={10} tick={{ fill: "var(--color-brand-400)" }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--color-surface-1, white)",
                      borderRadius: "10px",
                      border: "1px solid var(--color-line)",
                      fontSize: "11px",
                    }}
                  />
                  <Bar dataKey="keywords" name="Keywords (K)" fill="var(--color-series-6)" radius={[4, 4, 0, 0]} barSize={18} />
                </BarChart>
              </ResponsiveContainer>) : <NoMeasurement />}
            </div>
          </div>

          {/* Topical Coverage Comparison */}
          <div className="rounded-2xl border bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-brand-950 md:text-base">Topical Coverage Comparison</h2>
                <p className="mt-0.5 text-xs text-brand-500">How well each website covers important industry topics.</p>
              </div>
              <div className="flex items-center gap-3 text-xs font-medium text-brand-600">
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-xs bg-accent-600" /> Your Site
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-xs bg-accent-200" /> Competitors Avg
                </span>
              </div>
            </div>

            <div className="mt-4 h-[140px] w-full">
              {topicalCoverageData.length ? (<ResponsiveContainer width="100%" height="100%">
                <BarChart data={topicalCoverageData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-line)" />
                  <XAxis dataKey="topic" tickLine={false} axisLine={false} fontSize={10} tick={{ fill: "var(--color-brand-600)" }} />
                  <YAxis tickLine={false} axisLine={false} fontSize={10} tick={{ fill: "var(--color-brand-400)" }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--color-surface-1, white)",
                      borderRadius: "10px",
                      border: "1px solid var(--color-line)",
                      fontSize: "11px",
                    }}
                  />
                  <Bar dataKey="yourSite" name="Your Site (%)" fill="var(--color-accent-600)" radius={[3, 3, 0, 0]} barSize={12} />
                  <Bar dataKey="competitorsAvg" name="Competitors Avg (%)" fill="var(--color-accent-200)" radius={[3, 3, 0, 0]} barSize={12} />
                </BarChart>
              </ResponsiveContainer>) : <NoMeasurement />}
            </div>
          </div>
        </div>
      </div>

      {/* ── Third Row: Competitor Profiles ──────────────────────────── */}
      <div className="rounded-2xl border bg-white p-5 shadow-xs">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-brand-950 md:text-base">Competitor Profiles</h2>
            <p className="mt-0.5 text-xs text-brand-500">Quick overview of each competitor&apos;s strengths and positioning.</p>
          </div>
          <button type="button" className="text-xs font-semibold text-primary-600 hover:underline" onClick={() => router.push("/ai-visibility?tab=actions")}> 
            View Detailed Analysis →
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {competitorProfiles.map((comp) => (
            <div key={comp.domain} className="rounded-xl border p-3.5 hover:shadow-xs transition-shadow">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary-100 font-bold text-primary-700 text-xs">
                  {comp.name.slice(0, 1)}
                </span>
                <div>
                  <h3 className="text-xs font-bold text-brand-950 leading-tight">{comp.name}</h3>
                  <p className="text-[10px] text-brand-400">DA {comp.da} | {comp.keywords} Keywords</p>
                </div>
              </div>

              <div className="mt-2.5">
                <span className="inline-block rounded-full bg-accent-50 px-2 py-0.5 text-[10px] font-semibold text-accent-700">
                  {comp.tag}
                </span>
              </div>

              <p className="mt-2 text-[11px] leading-relaxed text-brand-600">
                {comp.desc}
              </p>

              <button
                type="button"
                className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-primary-600 hover:underline"
               onClick={() => router.push("/ai-visibility?tab=actions")}> 
                <span>View Analysis</span>
                <ArrowRight className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* ── Bottom Row: Content Gaps, AI Visibility & Insights ──────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Content Gap Opportunities */}
        <div className="rounded-2xl border bg-white p-5 shadow-xs lg:col-span-4">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-error-50 text-error-700">
              <TrendingUp className="h-3.5 w-3.5" />
            </span>
            <div>
              <h2 className="text-sm font-bold text-brand-950">Content Gap Opportunities</h2>
              <p className="text-[11px] text-brand-500">Topics your competitors cover but you don&apos;t.</p>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b text-brand-400">
                  <th className="pb-2 font-medium">Topic</th>
                  <th className="pb-2 font-medium">Competitors</th>
                  <th className="pb-2 font-medium">Volume</th>
                  <th className="pb-2 font-medium text-right">Opportunity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-100/50">{!contentGaps.length && <tr><td colSpan={8}><NoMeasurement /></td></tr>}
                {contentGaps.map((gap) => (
                  <tr key={gap.topic} className="hover:bg-brand-50/50">
                    <td className="py-2.5 font-semibold text-brand-900">{gap.topic}</td>
                    <td className="py-2.5 text-brand-600">{gap.covering}</td>
                    <td className="py-2.5 font-bold text-brand-800">{gap.volume}</td>
                    <td className="py-2.5 text-right">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          gap.tone === "error"
                            ? "bg-error-50 text-error-700"
                            : gap.tone === "warning"
                              ? "bg-warning-50 text-warning-700"
                              : "bg-success-50 text-success-700"
                        }`}
                      >
                        {gap.level}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* AI Visibility Comparison */}
        <div className="rounded-2xl border bg-white p-5 shadow-xs lg:col-span-4">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
              <Bot className="h-3.5 w-3.5" />
            </span>
            <div>
              <h2 className="text-sm font-bold text-brand-950">AI Visibility Comparison</h2>
              <p className="text-[11px] text-brand-500">How often AI platforms mention each website.</p>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b text-brand-400">
                  <th className="pb-2 font-medium">Website</th>
                  <th className="pb-2 font-medium text-center"><GeminiIcon className="mx-auto h-3 w-3 text-series-1" /></th>
                  <th className="pb-2 font-medium text-center"><OpenAiIcon className="mx-auto h-3 w-3 text-brand-950" /></th>
                  <th className="pb-2 font-medium text-center"><ClaudeIcon className="mx-auto h-3 w-3 text-series-7" /></th>
                  <th className="pb-2 font-medium text-center"><PerplexityIcon className="mx-auto h-3 w-3 text-series-8" /></th>
                  <th className="pb-2 font-medium text-center"><GrokIcon className="mx-auto h-3 w-3 text-brand-950" /></th>
                  <th className="pb-2 font-medium text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-100/50">{!aiVisibilityMatrix.length && <tr><td colSpan={8}><NoMeasurement /></td></tr>}
                {aiVisibilityMatrix.map((row) => (
                  <tr key={row.domain} className={`hover:bg-brand-50/50 ${row.isOwn ? "font-bold text-brand-950" : "text-brand-700"}`}>
                    <td className="py-2.5 font-medium">{row.domain}</td>
                    <td className="py-2.5 text-center">{row.gemini}</td>
                    <td className="py-2.5 text-center">{row.openai}</td>
                    <td className="py-2.5 text-center">{row.claude}</td>
                    <td className="py-2.5 text-center">{row.perplexity}</td>
                    <td className="py-2.5 text-center">{row.grok}</td>
                    <td className="py-2.5 text-right font-bold text-brand-950">{row.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Key Insights & Actions */}
        <div className="rounded-2xl border bg-white p-5 shadow-xs lg:col-span-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-warning-50 text-warning-700">
                <Sparkles className="h-3.5 w-3.5" />
              </span>
              <h2 className="text-sm font-bold text-brand-950">Key Insights & Actions</h2>
            </div>

            <ol className="mt-4 space-y-2.5 text-xs text-brand-700 leading-relaxed">{actions.length ? actions.map(a=><li key={a.id}>{a.title}</li>) : <li>No evidence-backed actions yet.</li>}</ol>
          </div>

          <div className="mt-5">
            <button
              type="button"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-primary-700 transition-colors"
             onClick={() => router.push("/ai-visibility?tab=actions")}> 
              <Sparkles className="h-3.5 w-3.5" />
              <span>Review Recorded Action Plan</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
