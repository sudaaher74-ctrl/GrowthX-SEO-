"use client";

import React from "react";
import {
  Wrench,
  FileText,
  Zap,
  Layers,
  Edit3,
  Smartphone,
  Sparkles,
  CheckCircle2,
  TrendingUp,
  Code2,
  ShieldCheck,
  RotateCcw,
  Clock,
  Eye,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";

import type { CrawlIssue, VisibilityReport } from "@/lib/api-client";

export interface FixEngineOverviewTabProps {
  issues?: CrawlIssue[];
  latestCrawl?: {
    id?: string;
    healthScore?: number | null;
    pagesCrawled?: number;
    issuesSummary?: {
      critical?: number;
      high?: number;
      medium?: number;
      low?: number;
    };
  } | null;
  visibilityReport?: VisibilityReport | null;
  onViewCategoryFixes?: (cat: string) => void;
  onOpenTimelineModal?: () => void;
  isApproved?: boolean;
}

export function FixEngineOverviewTab({
  issues = [],
  latestCrawl,
  visibilityReport,
  onViewCategoryFixes,
  onOpenTimelineModal,
  isApproved = false,
}: FixEngineOverviewTabProps) {
  const totalIssues = issues.length;
  const techCount = issues.filter((i) => {
    const c = (i.category || "").toLowerCase();
    return c.includes("tech") || c.includes("crawl") || c.includes("index") || c.includes("canonical") || c.includes("redirect");
  }).length;
  const onPageCount = issues.filter((i) => {
    const c = (i.category || "").toLowerCase();
    return c.includes("on_page") || c.includes("meta") || c.includes("title") || c.includes("heading") || c.includes("h1");
  }).length;
  const perfCount = issues.filter((i) => {
    const c = (i.category || "").toLowerCase();
    return c.includes("perf") || c.includes("speed") || c.includes("cwv") || c.includes("lcp");
  }).length;
  const schemaCount = issues.filter((i) => {
    const c = (i.category || "").toLowerCase();
    return c.includes("schema") || c.includes("structure") || c.includes("json-ld");
  }).length;
  const contentCount = issues.filter((i) => {
    const c = (i.category || "").toLowerCase();
    return c.includes("content") || c.includes("gap") || c.includes("thin");
  }).length;
  const mobileCount = issues.filter((i) => {
    const c = (i.category || "").toLowerCase();
    return c.includes("mobile") || c.includes("ux") || c.includes("viewport") || c.includes("tap");
  }).length;

  const matched = techCount + onPageCount + perfCount + schemaCount + contentCount + mobileCount;
  const otherCount = Math.max(0, totalIssues - matched);

  const categories = [
    {
      id: "technical",
      name: "Technical SEO",
      fixes: techCount,
      pct: totalIssues > 0 ? Math.round((techCount / totalIssues) * 100) : 0,
      barColor: "bg-emerald-500",
      icon: <Wrench size={14} className="text-emerald-600" />,
      iconBg: "bg-emerald-50",
    },
    {
      id: "on-page",
      name: "On-Page SEO",
      fixes: onPageCount,
      pct: totalIssues > 0 ? Math.round((onPageCount / totalIssues) * 100) : 0,
      barColor: "bg-blue-500",
      icon: <FileText size={14} className="text-blue-600" />,
      iconBg: "bg-blue-50",
    },
    {
      id: "performance",
      name: "Performance & Core Web Vitals",
      fixes: perfCount,
      pct: totalIssues > 0 ? Math.round((perfCount / totalIssues) * 100) : 0,
      barColor: "bg-orange-500",
      icon: <Zap size={14} className="text-orange-600" />,
      iconBg: "bg-orange-50",
    },
    {
      id: "schema",
      name: "Schema & Structured Data",
      fixes: schemaCount,
      pct: totalIssues > 0 ? Math.round((schemaCount / totalIssues) * 100) : 0,
      barColor: "bg-purple-500",
      icon: <Layers size={14} className="text-purple-600" />,
      iconBg: "bg-purple-50",
    },
    {
      id: "content",
      name: "Content & Indexation",
      fixes: contentCount,
      pct: totalIssues > 0 ? Math.round((contentCount / totalIssues) * 100) : 0,
      barColor: "bg-rose-500",
      icon: <Edit3 size={14} className="text-rose-600" />,
      iconBg: "bg-rose-50",
    },
    {
      id: "mobile",
      name: "Mobile & UX",
      fixes: mobileCount + otherCount,
      pct: totalIssues > 0 ? Math.round(((mobileCount + otherCount) / totalIssues) * 100) : 0,
      barColor: "bg-teal-500",
      icon: <Smartphone size={14} className="text-teal-600" />,
      iconBg: "bg-teal-50",
    },
  ];

  const timelinePhases = [
    {
      days: "Days 1–7",
      title: "Critical Fixes & Technical SEO",
      desc: "High-impact technical issues, crawl errors, indexation & basic optimizations.",
      active: true,
      color: "emerald",
    },
    {
      days: "Days 8–15",
      title: "On-Page & Content Improvements",
      desc: "Meta tags, content, internal links, structured data.",
      active: false,
      color: "blue",
    },
    {
      days: "Days 16–23",
      title: "Performance & Mobile Optimization",
      desc: "Core Web Vitals, speed, mobile UX fixes.",
      active: false,
      color: "purple",
    },
    {
      days: "Days 24–30",
      title: "Final Checks & Verification",
      desc: "Re-crawl, validate changes, measure impact.",
      active: false,
      color: "slate",
    },
  ];

  return (
    <div className="space-y-6">
      {/* ── ROW 1: Fixes by Category + 30-Day Timeline (Col 8) & Your Impact (Col 4) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Section: 2 Columns inside (Fixes by Category + 30-Day Timeline) */}
        <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Sub-Card 1: Fixes by Category */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs flex flex-col justify-between">
            <div>
              <h3 className="text-[14px] font-bold text-slate-900 leading-tight">
                Fixes by Category
              </h3>
              <p className="mt-1 text-[11.5px] text-slate-500">
                A complete plan covering all key areas of SEO and AI visibility.
              </p>

              <div className="mt-4 space-y-3.5">
                {categories.map((cat) => (
                  <div
                    key={cat.id}
                    onClick={() => onViewCategoryFixes?.(cat.id)}
                    className="group cursor-pointer"
                  >
                    <div className="flex items-center justify-between text-[11.5px]">
                      <div className="flex items-center gap-2">
                        <div className={`flex h-5 w-5 items-center justify-center rounded-md ${cat.iconBg}`}>
                          {cat.icon}
                        </div>
                        <span className="font-semibold text-slate-800 group-hover:text-purple-600 transition-colors">
                          {cat.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 font-medium">
                          {cat.fixes} fixes
                        </span>
                        <span className="font-bold text-slate-800 w-7 text-right">
                          {cat.pct}%
                        </span>
                      </div>
                    </div>

                    {/* Progress Bar & Planned Pill */}
                    <div className="mt-1.5 flex items-center gap-2.5">
                      <div className="h-1.5 flex-1 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${cat.barColor}`}
                          style={{ width: `${cat.pct * 2.5}%` }}
                        />
                      </div>
                      <span className="inline-flex items-center gap-1 rounded-md bg-purple-50/70 border border-purple-100 px-1.5 py-0.5 text-[9.5px] font-semibold text-purple-700">
                        <Sparkles size={10} />
                        Planned
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sub-Card 2: 30-Day Timeline */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-[14px] font-bold text-slate-900 leading-tight">
                  30-Day Timeline
                </h3>
              </div>
              <p className="mt-1 text-[11.5px] text-slate-500">
                We&apos;ll follow a phased approach to ensure safe and effective fixes.
              </p>

              {/* Vertical Stepper Timeline */}
              <div className="mt-4 space-y-4">
                {timelinePhases.map((phase, idx) => (
                  <div key={phase.days} className="relative flex items-start gap-3 pl-1">
                    {/* Vertical Connector Line */}
                    {idx < timelinePhases.length - 1 && (
                      <div className="absolute left-[13px] top-6 bottom-[-16px] w-[1.5px] bg-slate-200" />
                    )}

                    {/* Indicator Circle */}
                    <div className="relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white">
                      {idx === 0 ? (
                        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white">
                          <Check size={11} strokeWidth={3} />
                        </div>
                      ) : (
                        <div className="flex h-5 w-5 items-center justify-center rounded-full border border-slate-300 bg-slate-50">
                          <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div>
                      <span className="block text-[11px] font-semibold text-slate-400 leading-none">
                        {phase.days}
                      </span>
                      <h4 className="mt-1 text-[12px] font-bold text-slate-900 leading-tight">
                        {phase.title}
                      </h4>
                      <p className="mt-0.5 text-[11px] text-slate-500 leading-snug">
                        {phase.desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Section: Your Impact + Safe Mode ON (Col 4) */}
        <div className="lg:col-span-4 space-y-5">
          {/* Your Impact Card */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
            <h3 className="text-[14px] font-bold text-slate-900 leading-tight">
              Your Impact{" "}
              <span className="text-[11.5px] font-normal text-slate-400">
                (Estimated after 30 days)
              </span>
            </h3>

            {/* 2x2 Impact Metric Grid */}
            <div className="mt-4 grid grid-cols-2 gap-3">
              {/* Metric 1: SEO Health Score */}
              <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
                <div className="flex items-center gap-1.5 text-slate-500">
                  <TrendingUp size={14} className="text-emerald-600" />
                  <span className="text-[11px] font-medium">SEO Health Score</span>
                </div>
                <div className="mt-2 flex items-baseline gap-1.5">
                  {latestCrawl?.healthScore != null ? (
                    <>
                      <span className="text-[16px] font-bold text-slate-900">
                        {latestCrawl.healthScore} → {Math.min(100, latestCrawl.healthScore + (totalIssues > 0 ? 18 : 0))}
                      </span>
                      {totalIssues > 0 && (
                        <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                          +{Math.min(100, latestCrawl.healthScore + 18) - latestCrawl.healthScore}%
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-[13px] font-bold text-slate-600">Pending Crawl</span>
                  )}
                </div>
              </div>

              {/* Metric 2: Technical Issues */}
              <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
                <div className="flex items-center gap-1.5 text-slate-500">
                  <Code2 size={14} className="text-blue-600" />
                  <span className="text-[11px] font-medium">Technical Issues</span>
                </div>
                <div className="mt-2 flex items-baseline gap-1.5">
                  <span className="text-[16px] font-bold text-slate-900">{totalIssues} → 0</span>
                  {totalIssues > 0 && (
                    <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                      -100%
                    </span>
                  )}
                </div>
              </div>

              {/* Metric 3: AI Visibility Score */}
              <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
                <div className="flex items-center gap-1.5 text-slate-500">
                  <Sparkles size={14} className="text-purple-600" />
                  <span className="text-[11px] font-medium">AI Visibility Score</span>
                </div>
                <div className="mt-2 flex items-baseline gap-1.5">
                  {visibilityReport?.summary?.citationSharePct != null ? (
                    <>
                      <span className="text-[16px] font-bold text-slate-900">
                        {Math.round(visibilityReport.summary.citationSharePct)}% → {Math.min(100, Math.round(visibilityReport.summary.citationSharePct) + 18)}%
                      </span>
                      <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                        +18%
                      </span>
                    </>
                  ) : (
                    <span className="text-[13px] font-bold text-slate-600">Pending Sweep</span>
                  )}
                </div>
              </div>

              {/* Metric 4: Pages Optimized */}
              <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
                <div className="flex items-center gap-1.5 text-slate-500">
                  <FileText size={14} className="text-teal-600" />
                  <span className="text-[11px] font-medium">Pages Audited</span>
                </div>
                <div className="mt-2 flex items-baseline gap-1.5">
                  <span className="text-[16px] font-bold text-slate-900">
                    {latestCrawl?.pagesCrawled ?? 0} Pages
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Safe Mode ON Card */}
          <div className="flex items-start gap-3 rounded-2xl border border-emerald-200/80 bg-emerald-50/50 p-4 shadow-2xs">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500 text-white">
              <ShieldCheck size={18} />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[13px] font-bold text-slate-900">Safe Mode ON</span>
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              <p className="mt-0.5 text-[11.5px] leading-relaxed text-slate-600">
                Only approved changes will be applied. All changes are backed up and can be reversed.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── ROW 2: Bottom Value Banner Strip ── */}
      <div className="rounded-2xl border border-purple-100/90 bg-gradient-to-r from-purple-50/70 via-indigo-50/40 to-purple-50/70 p-4 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          {/* Left: Value Proposition */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-100 text-purple-700 shadow-2xs">
              <Sparkles size={20} />
            </div>
            <div>
              <h4 className="text-[14px] font-bold text-slate-900">
                Let AI handle the technical work.
              </h4>
              <p className="text-[11.5px] text-slate-500">
                From fixing broken links to optimizing metadata — we&apos;ll do everything for you.
              </p>
            </div>
          </div>

          {/* Right: 3 Benefit Chips */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Chip 1 */}
            <div className="flex items-center gap-2 rounded-xl bg-white/90 border border-purple-100/80 px-3 py-2 shadow-2xs">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-purple-50 text-purple-600">
                <Wrench size={13} />
              </div>
              <div>
                <span className="block text-[11px] font-bold text-slate-800 leading-tight">
                  Automated Execution
                </span>
                <span className="text-[10px] text-slate-400">No manual work needed</span>
              </div>
            </div>

            {/* Chip 2 */}
            <div className="flex items-center gap-2 rounded-xl bg-white/90 border border-purple-100/80 px-3 py-2 shadow-2xs">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-50 text-blue-600">
                <Clock size={13} />
              </div>
              <div>
                <span className="block text-[11px] font-bold text-slate-800 leading-tight">
                  Safe &amp; Reversible
                </span>
                <span className="text-[10px] text-slate-400">Backup before every change</span>
              </div>
            </div>

            {/* Chip 3 */}
            <div className="flex items-center gap-2 rounded-xl bg-white/90 border border-purple-100/80 px-3 py-2 shadow-2xs">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-50 text-emerald-600">
                <FileText size={13} />
              </div>
              <div>
                <span className="block text-[11px] font-bold text-slate-800 leading-tight">
                  Full Transparency
                </span>
                <span className="text-[10px] text-slate-400">Track all changes in real-time</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
