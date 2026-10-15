"use client";

import { type LiveDashboardData, platformKey, savedAnswers, recordedDate, NoMeasurement } from './live-dashboard-data';
import { useRouter } from "next/navigation";
import React, { useState } from "react";
import {
  Link as LinkIcon,
  ChevronDown,
  Download,
  Play,
  Loader2,
  Calendar,
  Globe,
  Award,
  Percent,
  BarChart3,
  ExternalLink,
  Sparkles,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { GeminiIcon, OpenAiIcon, ClaudeIcon, PerplexityIcon } from "./ai-visibility-dashboard";

export interface CitationIntelligenceDashboardProps extends LiveDashboardData {
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

export function CitationIntelligenceDashboard({
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
}: CitationIntelligenceDashboardProps) {
  const router = useRouter();
  const [selectedModel, setSelectedModel] = useState<"gemini" | "openai" | "claude" | "perplexity" | "grok">("gemini");
  const displayDomain = domain || "No website selected";
  const displayBrand = brandLabel || displayDomain.replace(/^www\./, "").split(".")[0] || "Your Brand";

  // Trend Data for Citations vs Unique Domains
  const trendData = [] as {date:string;citations:number;domains:number}[];

  // Bar Data: Citations by AI Platform
  const platformCitations = [] as {platform:string;yourBrand:number;competitors:number}[];

  // Pie Data: Citation Types
  const citationTypes = [] as {name:string;value:number;color:string}[];

  // Top Citing Domains
  const topCitingDomains = (citations?.citationsByDomain ?? []).map(c=>({domain:c.domain,dr:'—',citations:c.count,platforms:[] as string[],topic:'—',trend:'—'}));

  // Citation Opportunities
  const citationOpportunities = [] as {domain:string;dr:string;platforms:string[];reason:string}[];

  return (
    <div className="space-y-6 pb-12 font-sans text-brand-950">
      {/* ── Top Header Bar ─────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
              <LinkIcon className="h-4 w-4 text-primary-600" />
            </span>
            <h1 className="text-xl font-bold tracking-tight text-brand-950 md:text-2xl">
              Citation Intelligence
            </h1>
          </div>
          <p className="mt-1 text-xs text-brand-500 md:text-sm">
            Track recorded source links from real AI monitoring responses.
          </p>
        </div>

        {/* Header Controls */}
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
            className="flex items-center gap-1.5 rounded-lg border bg-white px-3 py-1.5 text-xs font-semibold text-brand-800 shadow-xs hover:bg-brand-50"
           onClick={() => { const csv=['Domain,Citations',...(citations?.citationsByDomain ?? []).map(c=>JSON.stringify(c.domain)+','+c.count)].join('\n'); const url=URL.createObjectURL(new Blob([csv],{type:'text/csv'})); const a=document.createElement('a');a.href=url;a.download='recorded-citations.csv';a.click();URL.revokeObjectURL(url); }}>
            <Download className="h-3.5 w-3.5" />
            <span>Download Report</span>
          </button>

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
            <span>Run Citation Analysis</span>
          </button>
        </div>
      </div>

      {/* ── Top Row: 5 KPI Cards ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-5">
        {/* Total Citations */}
        <div className="rounded-2xl border bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-bold text-brand-900">
              <LinkIcon className="h-3.5 w-3.5 text-accent-600" /> Total Citations
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-brand-950">{citations?.totalCitations ?? "—"}</span>
            <span className="rounded-full bg-success-50 px-2 py-0.5 text-[11px] font-semibold text-success-700">
              —
            </span>
          </div>
          <p className="mt-1 text-[11px] text-brand-400">Mentions with links to external sources.</p>
        </div>

        {/* Unique Domain Sources */}
        <div className="rounded-2xl border bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-bold text-brand-900">
              <Globe className="h-3.5 w-3.5 text-primary-600" /> Unique Domain Sources
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-brand-950">{citations?.citationsByDomain.length ?? "—"}</span>
            <span className="rounded-full bg-success-50 px-2 py-0.5 text-[11px] font-semibold text-success-700">
              —
            </span>
          </div>
          <p className="mt-1 text-[11px] text-brand-400">Unique domains in recorded source links.</p>
        </div>

        {/* High Authority Sources */}
        <div className="rounded-2xl border bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-bold text-brand-900">
              <Award className="h-3.5 w-3.5 text-warning-700" /> High Authority Sources
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-brand-950">—</span>
            <span className="rounded-full bg-success-50 px-2 py-0.5 text-[11px] font-semibold text-success-700">
              —
            </span>
          </div>
          <p className="mt-1 text-[11px] text-brand-400">Citations from DR 70+ domains.</p>
        </div>

        {/* Brand Mention to Citation */}
        <div className="rounded-2xl border bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-bold text-brand-900">
              <Percent className="h-3.5 w-3.5 text-series-6" /> Brand Mention to Citation
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-brand-950">—</span>
            <span className="rounded-full bg-success-50 px-2 py-0.5 text-[11px] font-semibold text-success-700">
              —
            </span>
          </div>
          <p className="mt-1 text-[11px] text-brand-400">of brand mentions include a source link.</p>
        </div>

        {/* External Citations */}
        <div className="rounded-2xl border bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-bold text-brand-900">
              <BarChart3 className="h-3.5 w-3.5 text-series-1" /> Competitor Citations
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-brand-950">—</span>
          </div>
          <p className="mt-1 text-[11px] text-brand-400">Publisher ownership is not competitor evidence.</p>
        </div>
      </div>

      {/* ── Middle Row: Citations Trend & Citations by Platform ──────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Citations Trend */}
        <div className="rounded-2xl border bg-white p-5 shadow-xs lg:col-span-7">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-brand-950 md:text-base">Citations Trend</h2>
              <p className="mt-0.5 text-xs text-brand-500">
                Number of citations and unique domains over time.
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs font-medium text-brand-600">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-series-1" /> Citations
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-series-6" /> Unique Domains
              </span>
            </div>
          </div>

          <div className="mt-5 h-[230px] w-full">
            {trendData.length ? (<ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-line)" />
                <XAxis dataKey="date" tickLine={false} axisLine={false} fontSize={11} tick={{ fill: "var(--color-brand-400)" }} />
                <YAxis tickLine={false} axisLine={false} fontSize={11} tick={{ fill: "var(--color-brand-400)" }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--color-surface-1, white)",
                    borderRadius: "12px",
                    border: "1px solid var(--color-line)",
                    fontSize: "12px",
                  }}
                />
                <Line type="monotone" dataKey="citations" stroke="var(--color-series-1)" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="domains" stroke="var(--color-series-6)" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>) : <NoMeasurement />}
          </div>
        </div>

        {/* Citations by AI Platform */}
        <div className="rounded-2xl border bg-white p-5 shadow-xs lg:col-span-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-brand-950 md:text-base">Citations by AI Platform</h2>
              <p className="mt-0.5 text-xs text-brand-500">
                Distribution of source citations across AI platforms.
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs font-medium text-brand-600">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-xs bg-accent-600" /> Your Brand
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-xs bg-accent-200" /> Top Competitors
              </span>
            </div>
          </div>

          <div className="mt-5 h-[230px] w-full">
            {platformCitations.length ? (<ResponsiveContainer width="100%" height="100%">
              <BarChart data={platformCitations} margin={{ top: 20, right: 10, left: -20, bottom: 0 }} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-line)" />
                <XAxis dataKey="platform" tickLine={false} axisLine={false} fontSize={11} tick={{ fill: "var(--color-brand-600)" }} />
                <YAxis tickLine={false} axisLine={false} fontSize={11} tick={{ fill: "var(--color-brand-400)" }} />
                <Tooltip
                  cursor={{ fill: "var(--color-brand-100)" }}
                  contentStyle={{
                    backgroundColor: "var(--color-surface-1, white)",
                    borderRadius: "12px",
                    border: "1px solid var(--color-line)",
                    fontSize: "12px",
                  }}
                />
                <Bar dataKey="yourBrand" fill="var(--color-accent-600)" radius={[4, 4, 0, 0]} barSize={16} />
                <Bar dataKey="competitors" fill="var(--color-accent-200)" radius={[4, 4, 0, 0]} barSize={16} />
              </BarChart>
            </ResponsiveContainer>) : <NoMeasurement />}
          </div>
        </div>
      </div>

      {/* ── Third Row: Top Citing Domains & Citation Types ──────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Top Citing Domains */}
        <div className="rounded-2xl border bg-white p-5 shadow-xs lg:col-span-7">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-brand-950 md:text-base">Top Citing Domains</h2>
              <p className="mt-0.5 text-xs text-brand-500">
                Domains linked in the latest saved monitoring run.
              </p>
            </div>
            <button type="button" className="text-xs font-semibold text-primary-600 hover:underline" onClick={() => router.push("/ai-visibility?tab=actions")}> 
              View All Sources →
            </button>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b text-brand-400">
                  <th className="pb-2 font-medium">Domain</th>
                  <th className="pb-2 font-medium">Domain Rating</th>
                  <th className="pb-2 font-medium text-center">Citations</th>
                  <th className="pb-2 font-medium">AI Platforms</th>
                  <th className="pb-2 font-medium">Topic</th>
                  <th className="pb-2 font-medium text-right">Trend</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-100/50">{!topCitingDomains.length && <tr><td colSpan={8}><NoMeasurement /></td></tr>}
                {topCitingDomains.map((row) => (
                  <tr key={row.domain} className="hover:bg-brand-50/50">
                    <td className="py-2.5 font-semibold text-brand-900">{row.domain}</td>
                    <td className="py-2.5 font-medium text-brand-600">{row.dr}</td>
                    <td className="py-2.5 text-center font-bold text-brand-800">{row.citations}</td>
                    <td className="py-2.5">
                      <div className="flex items-center gap-1">
                        {row.platforms.map((p) => {
                          if (p === "gemini") return <GeminiIcon key={p} className="h-3 w-3 text-series-1" />;
                          if (p === "openai") return <OpenAiIcon key={p} className="h-3 w-3 text-brand-950" />;
                          if (p === "claude") return <ClaudeIcon key={p} className="h-3 w-3 text-series-7" />;
                          return <PerplexityIcon key={p} className="h-3 w-3 text-series-8" />;
                        })}
                      </div>
                    </td>
                    <td className="py-2.5 text-brand-600">{row.topic}</td>
                    <td className="py-2.5 text-right font-semibold text-success-700">{row.trend}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Citation Types Donut Chart */}
        <div className="rounded-2xl border bg-white p-5 shadow-xs lg:col-span-5">
          <div>
            <h2 className="text-sm font-bold text-brand-950 md:text-base">Citation Types</h2>
            <p className="mt-0.5 text-xs text-brand-500">Citation types have not been classified yet.</p>
          </div>

          <div className="mt-4 flex flex-col items-center sm:flex-row sm:justify-between">
            <div className="relative h-[180px] w-[180px]">
              {citationTypes.length ? (<ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={citationTypes}
                    dataKey="value"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                  >
                    {citationTypes.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>) : <NoMeasurement />}
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xl font-bold text-brand-950">{citations?.totalCitations ?? "—"}</span>
                <span className="text-[10px] text-brand-400 font-medium">Citations</span>
              </div>
            </div>

            <div className="mt-4 space-y-2 text-xs sm:mt-0">
              {citationTypes.map((t) => (
                <div key={t.name} className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: t.color }} />
                    <span className="font-medium text-brand-700">{t.name}</span>
                  </div>
                  <span className="font-bold text-brand-950">{t.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom Row: AI Responses with Citations & Opportunities ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Left: Example AI Responses with Citations */}
        <div className="rounded-2xl border bg-white p-5 shadow-xs lg:col-span-6">
          <div>
            <h2 className="text-sm font-bold text-brand-950 md:text-base">
              Example AI Responses with Citations
            </h2>
            <p className="mt-0.5 text-xs text-brand-500">
              See how different AI platforms cite your brand with source links.
            </p>
          </div>

          <div className="mt-4 flex flex-wrap gap-2 rounded-xl bg-brand-50 p-1 border">
            {(["gemini", "openai", "claude", "perplexity", "grok"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setSelectedModel(m)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition-all ${
                  selectedModel === m ? "bg-white text-brand-950 shadow-xs" : "text-brand-500 hover:text-brand-900"
                }`}
              >
                {m}
              </button>
            ))}
          </div>

          <div className="mt-4 rounded-xl border bg-brand-50/50 p-4">
            <div className="flex items-center justify-between text-xs text-brand-500">
              <span className="flex items-center gap-1 font-bold text-brand-900">
                <Sparkles className="h-3 w-3 text-primary-600" /> {selectedModel.toUpperCase()} Response
              </span>
              <span>{recordedDate(savedAnswers(prompts).find(a=>a.platform===selectedModel)?.checkedAt)}</span>
            </div>
            <p className="mt-2.5 text-xs leading-relaxed text-brand-700">
              {savedAnswers(prompts).find(a=>a.platform===selectedModel)?.answerExcerpt ?? 'No saved response for this model yet.'}
            </p>
            <div className="mt-3 flex items-center justify-between border-t pt-2.5 text-xs">
              <span className="flex items-center gap-1 font-semibold text-accent-700">
                Source: {savedAnswers(prompts).find(a=>a.platform===selectedModel)?.citedUrl ?? 'No verified source link'} <ExternalLink className="h-3 w-3" />
              </span>
              <button type="button" className="font-semibold text-primary-600 hover:underline" onClick={() => router.push("/ai-visibility?tab=prompts")}> 
                View Saved Response
              </button>
            </div>
          </div>
        </div>

        {/* Right: Citation Opportunities */}
        <div className="rounded-2xl border bg-white p-5 shadow-xs lg:col-span-6">
          <div>
            <h2 className="text-sm font-bold text-brand-950 md:text-base">Citation Opportunities</h2>
            <p className="mt-0.5 text-xs text-brand-500">
              Opportunities appear when saved evidence identifies a relevant citation gap.
            </p>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b text-brand-400">
                  <th className="pb-2 font-medium">Domain</th>
                  <th className="pb-2 font-medium">Domain Rating</th>
                  <th className="pb-2 font-medium">AI Platforms</th>
                  <th className="pb-2 font-medium">Reason</th>
                  <th className="pb-2 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-100/50">{!citationOpportunities.length && <tr><td colSpan={8}><NoMeasurement /></td></tr>}
                {citationOpportunities.map((opp) => (
                  <tr key={opp.domain} className="hover:bg-brand-50/50">
                    <td className="py-2.5 font-semibold text-brand-900">{opp.domain}</td>
                    <td className="py-2.5 font-medium text-brand-600">{opp.dr}</td>
                    <td className="py-2.5">
                      <div className="flex items-center gap-1">
                        {opp.platforms.map((p) => {
                          if (p === "gemini") return <GeminiIcon key={p} className="h-3 w-3 text-series-1" />;
                          if (p === "openai") return <OpenAiIcon key={p} className="h-3 w-3 text-brand-950" />;
                          if (p === "claude") return <ClaudeIcon key={p} className="h-3 w-3 text-series-7" />;
                          return <PerplexityIcon key={p} className="h-3 w-3 text-series-8" />;
                        })}
                      </div>
                    </td>
                    <td className="py-2.5 text-brand-600">{opp.reason}</td>
                    <td className="py-2.5 text-right">
                      <button
                        type="button"
                        className="rounded-lg border bg-primary-50 px-2.5 py-1 text-[11px] font-semibold text-primary-700 shadow-2xs hover:bg-primary-100"
                       onClick={() => router.push("/ai-visibility?tab=actions")}> 
                        Get Mentioned
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
