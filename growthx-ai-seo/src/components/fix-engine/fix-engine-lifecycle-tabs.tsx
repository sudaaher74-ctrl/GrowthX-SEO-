"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  Play,
  Pause,
  RotateCcw,
  ExternalLink,
  Shield,
  GitBranch,
  Cpu,
  Layers,
  Sparkles,
  ArrowRight,
  TrendingUp,
  FileCode,
  Check,
  X,
  RefreshCw,
  Search,
  Database,
  BarChart3,
  Bot,
  Zap,
  Globe,
  SlidersHorizontal,
} from "lucide-react";

/* ──────────────────────────────────────────────────────────────────────────
   1. FIX ENGINE IMPLEMENTATION VIEW (Section 22)
   ────────────────────────────────────────────────────────────────────────── */
export interface FixEngineImplementationViewProps {
  onPauseExecution?: () => void;
  onRollback?: () => void;
  onViewVerification?: () => void;
}

export function FixEngineImplementationView({
  onPauseExecution,
  onRollback,
  onViewVerification,
}: FixEngineImplementationViewProps) {
  const [isPaused, setIsPaused] = useState(false);

  const categories = [
    { name: "Technical SEO", done: 24, total: 24, color: "bg-emerald-500", status: "Complete" },
    { name: "On-Page SEO", done: 12, total: 18, color: "bg-blue-600", status: "In Progress" },
    { name: "Performance & CWV", done: 3, total: 8, color: "bg-purple-600", status: "Queued" },
    { name: "Structured Data / Schema", done: 4, total: 10, color: "bg-indigo-600", status: "Queued" },
    { name: "Content & Topic Gaps", done: 2, total: 14, color: "bg-amber-500", status: "Queued" },
    { name: "GEO & AI Visibility", done: 1, total: 10, color: "bg-rose-500", status: "Queued" },
    { name: "Authority Signals", done: 0, total: 6, color: "bg-slate-500", status: "Scheduled" },
  ];

  const completedCount = 46;
  const totalActions = 90;
  const progressPct = Math.round((completedCount / totalActions) * 100);

  const liveActivityFeed = [
    {
      time: "2m ago",
      action: "Optimizing metadata",
      detail: "Generated and applied 18 high-intent commercial title & meta descriptions for service pages",
      target: "/services/enterprise-seo",
      status: "Verified",
    },
    {
      time: "8m ago",
      action: "Implementing schema",
      detail: "Deployed Organization, FAQPage, and SoftwareApplication JSON-LD structured data",
      target: "/pricing & /faq",
      status: "Deployed",
    },
    {
      time: "15m ago",
      action: "Fixing internal links",
      detail: "Resolved 4 orphan pages and optimized contextual keyword anchors across blog clusters",
      target: "/blog/seo-automation-guide",
      status: "Deployed",
    },
    {
      time: "28m ago",
      action: "Generating content brief",
      detail: "Drafted 2,400-word comprehensive comparison page to target competitor keyword gap",
      target: "/compare/vs-semrush",
      status: "Ready for Review",
    },
    {
      time: "42m ago",
      action: "Validating Core Web Vitals",
      detail: "Deferred render-blocking JS bundles and added explicit aspect-ratio CSS to hero banners",
      target: "Sitewide Assets",
      status: "Verified",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Running Plan Status Banner */}
      <div className="rounded-2xl border border-purple-200 bg-linear-to-r from-purple-950 via-slate-900 to-purple-900 text-white p-6 shadow-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
              </span>
              <span className="text-xs font-bold uppercase tracking-wider text-purple-300">
                Fix Engine Active Execution
              </span>
              <span className="text-[10px] bg-purple-800 text-purple-200 font-semibold px-2 py-0.5 rounded-full">
                Safe Mode Enabled
              </span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight">
              Your 30-Day Plan is Running
            </h2>
            <p className="text-xs text-purple-200 max-w-xl leading-relaxed">
              Aiva is automatically implementing and testing approved fixes across technical SEO, content gaps, and schema signals.
            </p>
          </div>

          {/* Quick Action Controls */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => {
                setIsPaused(!isPaused);
                onPauseExecution?.();
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold backdrop-blur transition border border-white/10"
            >
              {isPaused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
              <span>{isPaused ? "Resume Execution" : "Pause Plan"}</span>
            </button>

            <button
              type="button"
              onClick={onViewVerification}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition shadow-md shadow-purple-950/40"
            >
              <span>View Verification →</span>
            </button>
          </div>
        </div>

        {/* Global Progress Bar */}
        <div className="mt-6 pt-5 border-t border-purple-800/60">
          <div className="flex items-center justify-between text-xs font-bold mb-2">
            <span className="text-purple-200">
              Overall Execution Progress: {completedCount} / {totalActions} actions completed
            </span>
            <span className="text-emerald-400 font-extrabold">{progressPct}% Complete</span>
          </div>
          <div className="h-3 w-full bg-purple-900/60 rounded-full overflow-hidden p-0.5 border border-purple-700/50">
            <div
              className="h-full bg-linear-to-r from-purple-500 to-emerald-400 rounded-full transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Categories Progress Breakdown (Section 22) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {categories.map((cat) => {
          const catPct = Math.round((cat.done / cat.total) * 100);
          return (
            <div
              key={cat.name}
              className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between text-xs font-semibold mb-1">
                  <span className="text-slate-800 truncate font-bold">{cat.name}</span>
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                      cat.status === "Complete"
                        ? "bg-emerald-50 text-emerald-700"
                        : cat.status === "In Progress"
                        ? "bg-blue-50 text-blue-700"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {cat.status}
                  </span>
                </div>
                <div className="text-lg font-extrabold text-slate-900 mt-1">
                  {cat.done} / {cat.total}
                </div>
              </div>

              <div className="mt-3">
                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${cat.color} rounded-full`}
                    style={{ width: `${catPct}%` }}
                  />
                </div>
                <span className="text-[10px] text-slate-400 font-medium mt-1 block">
                  {catPct}% implemented
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Live Activity Feed & Deployment Connection */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Activity Feed (8 cols) */}
        <div className="lg:col-span-8 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-base font-bold text-slate-900">Live Execution Activity</h3>
              <p className="text-xs text-slate-500">Autonomous remediation stream with automated testing</p>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
              <RefreshCw className="h-3.5 w-3.5 animate-spin text-purple-600" />
              <span>Real-time</span>
            </div>
          </div>

          <div className="divide-y divide-slate-100 space-y-1">
            {liveActivityFeed.map((item, idx) => (
              <div key={idx} className="pt-3.5 pb-2.5 flex items-start justify-between gap-4 text-xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900">{item.action}</span>
                    <span className="text-[10px] font-mono text-slate-400">· {item.time}</span>
                  </div>
                  <p className="text-slate-600 leading-relaxed text-[11.5px]">{item.detail}</p>
                  <span className="inline-block font-mono text-[10.5px] text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md">
                    Target: {item.target}
                  </span>
                </div>

                <span
                  className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    item.status === "Verified"
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                      : item.status === "Deployed"
                      ? "bg-blue-50 text-blue-700 border border-blue-200/60"
                      : "bg-amber-50 text-amber-700 border border-amber-200/60"
                  }`}
                >
                  {item.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Deployment Integration Status (4 cols) */}
        <div className="lg:col-span-4 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
              <div className="h-8 w-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                <GitBranch className="h-4 w-4" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">Deployment Adapter</h4>
                <p className="text-[11px] text-slate-400">Target Write Connection</p>
              </div>
            </div>

            <div className="mt-4 space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-700">GitHub Repository</span>
                  <span className="text-emerald-600 font-bold flex items-center gap-1 text-[11px]">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Connected
                  </span>
                </div>
                <div className="text-[11px] font-mono text-slate-500 truncate">
                  repo: github.com/client-org/website
                </div>
                <div className="text-[11px] font-mono text-slate-500">
                  branch: <strong className="text-slate-800">aiva-30day-plan</strong>
                </div>
              </div>

              <div className="p-3 rounded-xl border border-slate-200 bg-white space-y-1.5">
                <span className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
                  <Shield className="h-3.5 w-3.5 text-purple-600" />
                  Safe Mode Guarantees
                </span>
                <ul className="text-[11px] text-slate-600 space-y-1 list-disc pl-4">
                  <li>Full snapshot backup created prior to execution</li>
                  <li>Every patch validated with synthetic build checks</li>
                  <li>Instant 1-click rollback available on any commit</li>
                </ul>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onRollback}
            className="w-full py-2 px-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition flex items-center justify-center gap-1.5"
          >
            <RotateCcw className="h-3.5 w-3.5 text-slate-400" />
            <span>Rollback Last Applied Changes</span>
          </button>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   2. FIX ENGINE VERIFICATION VIEW (Section 23)
   ────────────────────────────────────────────────────────────────────────── */
export interface FixEngineVerificationViewProps {
  onReVerifyAll?: () => void;
}

export function FixEngineVerificationView({
  onReVerifyAll,
}: FixEngineVerificationViewProps) {
  const [filterStatus, setFilterStatus] = useState<"all" | "Verified" | "Implemented" | "Needs Review">("all");

  const verificationItems = [
    {
      id: "ver-1",
      fixTitle: "Compress Hero WebP Assets & Defer Render-Blocking Scripts",
      category: "Performance",
      affectedUrl: "/home & /features",
      status: "Verified",
      beforeMetric: "LCP 3.4s",
      afterMetric: "LCP 1.9s",
      delta: "-1.5s improvement",
      evidence: "Verified via headless Chromium audit on 2026-09-11.",
    },
    {
      id: "ver-2",
      fixTitle: "Deploy Article & FAQPage JSON-LD Structured Data",
      category: "Structured Data",
      affectedUrl: "/pricing & /blog/*",
      status: "Verified",
      beforeMetric: "0 valid schemas",
      afterMetric: "3 schema entities",
      delta: "100% Google Rich Results compliant",
      evidence: "Schema.org validator reported 0 errors and 0 warnings.",
    },
    {
      id: "ver-3",
      fixTitle: "Resolve 4 Orphan Pages & Build Contextual Internal Linking",
      category: "Technical SEO",
      affectedUrl: "/services/*",
      status: "Verified",
      beforeMetric: "4 orphan URLs",
      afterMetric: "0 orphan URLs",
      delta: "PageRank crawl depth improved to 2",
      evidence: "Re-crawled internal link graph confirms 2-way linkage.",
    },
    {
      id: "ver-4",
      fixTitle: "Publish 2,400-word Comparison Page Targeting Rival Search Intent",
      category: "Content Gap",
      affectedUrl: "/compare/vs-semrush",
      status: "Implemented",
      beforeMetric: "No page existed",
      afterMetric: "Page published",
      delta: "Awaiting Google search indexing",
      evidence: "HTTP 200 OK, canonical confirmed, sitemap ping submitted.",
    },
    {
      id: "ver-5",
      fixTitle: "Direct-Answer Microdata for High-Volume AI Prompts",
      category: "AI Visibility",
      affectedUrl: "/features/ai-seo",
      status: "Needs Review",
      beforeMetric: "0% ChatGPT citations",
      afterMetric: "Pending evaluation",
      delta: "Synthetic test query shows partial mention",
      evidence: "Model test cited brand as secondary tool. Needs deeper proof points.",
    },
  ];

  const filtered = verificationItems.filter((i) => {
    if (filterStatus === "all") return true;
    return i.status === filterStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="h-10 w-10 rounded-xl bg-purple-100 flex items-center justify-center text-purple-700 shadow-2xs">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Autonomous Verification Engine</h1>
              <p className="text-sm text-slate-500">
                Aiva re-crawls affected pages, validates HTML, tests schema compliance, and measures before vs. after signals.
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onReVerifyAll}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold transition shadow-md shadow-purple-500/20"
        >
          <RefreshCw className="h-4 w-4" />
          <span>Re-Run All Verifications</span>
        </button>
      </div>

      {/* Verification Summary KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-xs">
          <div className="text-[11px] font-bold text-emerald-700 uppercase">Verified Improvements</div>
          <div className="text-2xl font-bold text-emerald-950 mt-1">42</div>
          <p className="text-[11px] text-emerald-700 mt-1">Confirmed via re-crawl &amp; schema check</p>
        </div>

        <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-4 shadow-xs">
          <div className="text-[11px] font-bold text-blue-700 uppercase">Awaiting Search Index</div>
          <div className="text-2xl font-bold text-blue-950 mt-1">4</div>
          <p className="text-[11px] text-blue-700 mt-1">Deployed and pinged to search engines</p>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 shadow-xs">
          <div className="text-[11px] font-bold text-amber-700 uppercase">Needs Human Review</div>
          <div className="text-2xl font-bold text-amber-950 mt-1">2</div>
          <p className="text-[11px] text-amber-700 mt-1">Editorial check suggested before deploy</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="text-[11px] font-bold text-slate-500 uppercase">Failed Automated Tests</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">0</div>
          <p className="text-[11px] text-emerald-600 mt-1">Safe Mode prevented unverified code</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2">
        {(["all", "Verified", "Implemented", "Needs Review"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setFilterStatus(tab)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition ${
              filterStatus === tab
                ? "bg-purple-600 text-white shadow-2xs"
                : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            {tab === "all" ? "All Fixes (5)" : tab}
          </button>
        ))}
      </div>

      {/* Verification Table */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs space-y-4">
        <h3 className="text-base font-bold text-slate-900">Before vs. After Measurement Log</h3>
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-[11px] font-bold text-slate-600 border-b border-slate-200 uppercase tracking-wider">
              <tr>
                <th className="p-3.5 font-bold">Fix Description</th>
                <th className="p-3.5 font-bold">Category</th>
                <th className="p-3.5 font-bold">Target URL</th>
                <th className="p-3.5 font-bold">Before Fix</th>
                <th className="p-3.5 font-bold">After Fix</th>
                <th className="p-3.5 font-bold">Status</th>
                <th className="p-3.5 font-bold">Evidence</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="p-3.5 font-bold text-slate-900 max-w-xs">{item.fixTitle}</td>
                  <td className="p-3.5">
                    <span className="text-[11px] font-semibold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md">
                      {item.category}
                    </span>
                  </td>
                  <td className="p-3.5 font-mono text-slate-600 text-[11px]">{item.affectedUrl}</td>
                  <td className="p-3.5 text-rose-600 font-semibold">{item.beforeMetric}</td>
                  <td className="p-3.5 text-emerald-600 font-bold">{item.afterMetric}</td>
                  <td className="p-3.5">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${
                        item.status === "Verified"
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                          : item.status === "Implemented"
                          ? "bg-blue-50 text-blue-700 border border-blue-200/60"
                          : "bg-amber-50 text-amber-700 border border-amber-200/60"
                      }`}
                    >
                      {item.status}
                    </span>
                  </td>
                  <td className="p-3.5 text-slate-500 text-[11px] max-w-xs">{item.evidence}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   3. FIX ENGINE HISTORY & NEXT 30-DAY CYCLE (Sections 24 & 25)
   ────────────────────────────────────────────────────────────────────────── */
export interface FixEngineHistoryViewProps {
  onStartNextCycle?: () => void;
}

export function FixEngineHistoryView({
  onStartNextCycle,
}: FixEngineHistoryViewProps) {
  return (
    <div className="space-y-6">
      {/* 30-Day Completion Hero Banner */}
      <div className="rounded-2xl border border-purple-200 bg-linear-to-r from-purple-50/80 via-white to-slate-50 p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-purple-700 bg-purple-100/60 px-2.5 py-0.5 rounded-full">
              Cycle Completed
            </span>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
              Your 30-Day Improvement Plan is Complete
            </h2>
            <p className="text-xs text-slate-600 max-w-xl leading-relaxed">
              All 92 scheduled remediation tasks have been applied and independently verified. Aiva has refreshed competitive benchmarks and prepared your next 30-day continuous growth cycle.
            </p>
          </div>

          <div className="shrink-0">
            <button
              type="button"
              onClick={onStartNextCycle}
              className="flex items-center gap-2 px-5 py-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-sm transition shadow-md shadow-purple-500/20 active:scale-[0.98]"
            >
              <span>Review Next 30-Day Plan →</span>
            </button>
            <span className="text-[11px] text-slate-400 text-center block mt-1.5">
              Continuous SEO + GEO Automation Loop
            </span>
          </div>
        </div>
      </div>

      {/* Measured Before vs. After Results (Section 24) */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs space-y-4">
        <div>
          <h3 className="text-base font-bold text-slate-900">30-Day Plan Impact: Measured Results</h3>
          <p className="text-xs text-slate-500">Only verified measurements — no fabricated projections</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* SEO Health */}
          <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/60 space-y-1">
            <span className="text-[11px] font-semibold text-slate-500">SEO Health Score</span>
            <div className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
              <span className="text-slate-400 line-through text-base">68</span>
              <span>→</span>
              <span className="text-emerald-600">86</span>
            </div>
            <span className="text-[11px] text-emerald-600 font-bold block">+26% Measured</span>
          </div>

          {/* Technical Issues */}
          <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/60 space-y-1">
            <span className="text-[11px] font-semibold text-slate-500">Critical &amp; High Issues</span>
            <div className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
              <span className="text-slate-400 line-through text-base">134</span>
              <span>→</span>
              <span className="text-emerald-600">42</span>
            </div>
            <span className="text-[11px] text-emerald-600 font-bold block">-68% Issues Resolved</span>
          </div>

          {/* AI Visibility Score */}
          <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/60 space-y-1">
            <span className="text-[11px] font-semibold text-slate-500">AI Visibility Score</span>
            <div className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
              <span className="text-slate-400 line-through text-base">61</span>
              <span>→</span>
              <span className="text-purple-600">78</span>
            </div>
            <span className="text-[11px] text-purple-600 font-bold block">+28% LLM Citations</span>
          </div>

          {/* Ranking Keywords */}
          <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/60 space-y-1">
            <span className="text-[11px] font-semibold text-slate-500">Ranking Keywords</span>
            <div className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
              <span className="text-slate-400 line-through text-base">3,200</span>
              <span>→</span>
              <span className="text-blue-600">4,320</span>
            </div>
            <span className="text-[11px] text-blue-600 font-bold block">+35% Coverage</span>
          </div>

          {/* Core Web Vitals */}
          <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/60 space-y-1">
            <span className="text-[11px] font-semibold text-slate-500">Average LCP Speed</span>
            <div className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
              <span className="text-slate-400 line-through text-base">3.4s</span>
              <span>→</span>
              <span className="text-emerald-600">1.8s</span>
            </div>
            <span className="text-[11px] text-emerald-600 font-bold block">47% Faster Page Load</span>
          </div>
        </div>
      </div>

      {/* Historical Cycles Log */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs space-y-4">
        <h3 className="text-base font-bold text-slate-900">Historical 30-Day Execution Cycles</h3>
        <div className="divide-y divide-slate-100 text-xs">
          {[
            {
              cycle: "Cycle 1 (August 2026)",
              status: "Completed",
              tasksCount: "92 / 92 Actions Executed",
              focus: "Technical SEO Foundation & Schema Architecture",
              impact: "+18% Organic Traffic",
            },
            {
              cycle: "Onboarding Quick Wins (July 2026)",
              status: "Completed",
              tasksCount: "34 / 34 Actions Executed",
              focus: "Critical Crawl Errors & Orphan Page Remediation",
              impact: "+12% Indexation Rate",
            },
          ].map((item, idx) => (
            <div key={idx} className="py-3.5 flex items-center justify-between gap-4">
              <div>
                <div className="font-bold text-slate-900 text-sm">{item.cycle}</div>
                <div className="text-slate-500 mt-0.5">
                  {item.tasksCount} • <span className="text-purple-700 font-medium">{item.focus}</span>
                </div>
              </div>
              <div className="text-right">
                <span className="font-bold text-emerald-600">{item.impact}</span>
                <span className="text-[10px] text-slate-400 block">{item.status}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
