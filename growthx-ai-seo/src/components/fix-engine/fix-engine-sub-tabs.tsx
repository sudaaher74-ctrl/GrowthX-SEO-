"use client";

import React, { useState } from "react";
import {
  Wrench,
  Sparkles,
  Zap,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Code,
  FileText,
  Calendar,
  Check,
  ArrowRight,
  ShieldCheck,
  TrendingUp,
  Sliders,
  GitBranch,
  RefreshCw,
  Clock,
  Eye,
} from "lucide-react";
import type { CrawlIssue } from "@/lib/api-client";

// ── 1. Fixes by Category Sub-Tab ────────────────────────────────────────────────
export function FixesByCategoryTab({
  issues = [],
  onOpenAutoFix,
}: {
  issues?: CrawlIssue[];
  onOpenAutoFix?: (issue: CrawlIssue) => void;
}) {
  const [selectedCat, setSelectedCat] = useState<string>("all");

  const sampleFixes = [
    {
      id: "f-1",
      category: "Technical SEO",
      title: "Add canonical tags to paginated blog index pages",
      severity: "Critical",
      effort: "Low",
      impact: "+14% Indexation",
      url: "/blog?page=2",
      status: "Ready to Fix",
    },
    {
      id: "f-2",
      category: "Technical SEO",
      title: "Resolve 404 broken redirect chain on /solutions/legacy",
      severity: "High",
      effort: "Low",
      impact: "+8% Crawl Budget",
      url: "/solutions/legacy",
      status: "Ready to Fix",
    },
    {
      id: "f-3",
      category: "On-Page SEO",
      title: "Optimize missing H1 tag on enterprise pricing landing page",
      severity: "High",
      effort: "Low",
      impact: "+18% CTR",
      url: "/pricing",
      status: "Ready to Fix",
    },
    {
      id: "f-4",
      category: "Performance & Core Web Vitals",
      title: "Defer offscreen hero images and add explicit aspect ratios",
      severity: "High",
      effort: "Medium",
      impact: "-1.2s LCP",
      url: "/",
      status: "Ready to Fix",
    },
    {
      id: "f-5",
      category: "Schema & Structured Data",
      title: "Inject Organization & SoftwareApplication JSON-LD markup",
      severity: "Critical",
      effort: "Low",
      impact: "+24% AI Citations",
      url: "/",
      status: "Ready to Fix",
    },
    {
      id: "f-6",
      category: "Content & Indexation",
      title: "Expand thin content on technical comparison guide",
      severity: "Medium",
      effort: "Medium",
      impact: "+32% Organic Visibility",
      url: "/compare",
      status: "Ready to Fix",
    },
    {
      id: "f-7",
      category: "Mobile & UX",
      title: "Fix tap target sizing below 48px on mobile nav menu",
      severity: "Medium",
      effort: "Low",
      impact: "Pass Mobile Audit",
      url: "Global Component",
      status: "Ready to Fix",
    },
  ];

  const filtered = selectedCat === "all"
    ? sampleFixes
    : sampleFixes.filter((f) => f.category.toLowerCase().includes(selectedCat.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-[14.5px] font-bold text-slate-900">All Scheduled Fixes (92 Total)</h3>
            <p className="text-[11.5px] text-slate-500">
              Categorized and prioritized actions ready for automatic codebase remediation.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={selectedCat}
              onChange={(e) => setSelectedCat(e.target.value)}
              aria-label="Filter fixes by category"
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11.5px] font-semibold text-slate-700"
            >
              <option value="all">All Categories (92)</option>
              <option value="technical">Technical SEO (24)</option>
              <option value="on-page">On-Page SEO (22)</option>
              <option value="performance">Performance &amp; CWV (16)</option>
              <option value="schema">Schema (12)</option>
              <option value="content">Content (10)</option>
              <option value="mobile">Mobile &amp; UX (8)</option>
            </select>
          </div>
        </div>

        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-[12px]">
            <thead>
              <tr className="border-b border-slate-100 text-[11px] font-medium text-slate-400">
                <th className="py-2.5 pl-2 font-medium">Issue / Remediation</th>
                <th className="py-2.5 font-medium">Category</th>
                <th className="py-2.5 font-medium">Severity</th>
                <th className="py-2.5 font-medium">Target URL</th>
                <th className="py-2.5 font-medium">Est. Impact</th>
                <th className="py-2.5 pr-2 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/70">
              {filtered.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/70">
                  <td className="py-3.5 pl-2 font-semibold text-slate-900 max-w-sm">
                    {item.title}
                  </td>
                  <td className="py-3.5">
                    <span className="rounded-md bg-purple-50 text-purple-700 border border-purple-200/60 px-2 py-0.5 text-[10.5px] font-semibold">
                      {item.category}
                    </span>
                  </td>
                  <td className="py-3.5">
                    <span
                      className={`rounded-md px-2 py-0.5 text-[10.5px] font-semibold border ${
                        item.severity === "Critical"
                          ? "bg-rose-50 text-rose-700 border-rose-200"
                          : "bg-amber-50 text-amber-700 border-amber-200"
                      }`}
                    >
                      {item.severity}
                    </span>
                  </td>
                  <td className="py-3.5 font-mono text-[11px] text-slate-500">
                    {item.url}
                  </td>
                  <td className="py-3.5 font-bold text-emerald-600">
                    {item.impact}
                  </td>
                  <td className="py-3.5 pr-2 text-right">
                    <button
                      type="button"
                      onClick={() => onOpenAutoFix?.(item as unknown as CrawlIssue)}
                      className="inline-flex items-center gap-1 rounded-lg border border-purple-200 bg-purple-50 px-2.5 py-1 text-[11px] font-bold text-purple-700 hover:bg-purple-100 transition-colors"
                    >
                      <Sparkles size={11} />
                      <span>Review Code Fix</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── 2. Timeline Sub-Tab ────────────────────────────────────────────────────────
export function TimelineTab({
  onOpenFullModal,
}: {
  onOpenFullModal?: () => void;
}) {
  const sprints = [
    {
      sprint: "Sprint 1 (Days 1–7)",
      title: "Critical Foundation & Crawl Blockers",
      status: "In Progress",
      fixes: [
        "Day 1: Robots.txt & sitemap XML index re-architecture",
        "Day 2: 404 broken link redirection & canonical header audit",
        "Day 3: HTTPS mixed content fixes across asset paths",
        "Day 4: Organization and Brand JSON-LD schema injection",
        "Day 5: Server response time TTFB tuning & asset caching",
        "Day 6: Missing metadata & title tag duplicate resolution",
        "Day 7: Full crawl baseline verification & audit log generation",
      ],
    },
    {
      sprint: "Sprint 2 (Days 8–15)",
      title: "On-Page Semantic & Content Upgrades",
      status: "Scheduled",
      fixes: [
        "Day 8: BreadcrumbList schema injection across all categories",
        "Day 9: H1/H2 semantic hierarchy fixes on top commercial pages",
        "Day 10: Image alt text generation with LLM vision",
        "Day 11: Quotable 40-word definition block insertion",
        "Day 12: Internal linking graph optimization for high-intent hubs",
        "Day 13: Schema markup for software applications & pricing tiers",
        "Day 14: FAQPage schema on key conversion funnels",
        "Day 15: Sprint 2 re-crawl validation and index verification",
      ],
    },
    {
      sprint: "Sprint 3 (Days 16–23)",
      title: "Performance & Core Web Vitals Optimization",
      status: "Scheduled",
      fixes: [
        "Day 16: Next.js script loading priority strategy optimization",
        "Day 17: Font display swap & preconnect headers for Google Fonts",
        "Day 18: LCP hero image fetchpriority='high' attributes",
        "Day 19: Layout shift CLS fixes on dynamic alert containers",
        "Day 20: Interaction to Next Paint INP long-task breakdown",
        "Day 21: Mobile viewport tap-target and padding refinement",
        "Day 22: Critical CSS inlining for first-paint acceleration",
        "Day 23: Core Web Vitals lab test verification",
      ],
    },
    {
      sprint: "Sprint 4 (Days 24–30)",
      title: "Verification, AI Knowledge Graph & Hand-off",
      status: "Scheduled",
      fixes: [
        "Day 24: Comprehensive end-to-end site re-crawl",
        "Day 25: Multi-engine AI visibility probe verification",
        "Day 26: Search Console index coverage re-inspection",
        "Day 27: Competitor benchmark differential analysis",
        "Day 28: Automated PR merge and production deployment check",
        "Day 29: Final executive ROI & impact scorecard report generation",
        "Day 30: Transition to continuous monthly monitoring mode",
      ],
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {sprints.map((sp, idx) => (
          <div
            key={sp.sprint}
            className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-purple-700">
                  {sp.sprint}
                </span>
                <h4 className="mt-0.5 text-[14px] font-bold text-slate-900">
                  {sp.title}
                </h4>
              </div>
              <span
                className={`rounded-full px-2.5 py-0.5 text-[10.5px] font-semibold ${
                  idx === 0
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                {sp.status}
              </span>
            </div>

            <ul className="mt-3.5 space-y-2 text-[12px] text-slate-600">
              {sp.fixes.map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-purple-500 mt-1.5 shrink-0" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── 3. Impact Forecast Sub-Tab ─────────────────────────────────────────────────
export function ImpactForecastTab() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">SEO Health Score</span>
          <p className="mt-2 text-[28px] font-bold text-slate-900">68 → 86</p>
          <span className="mt-1 inline-block rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
            +26% Health Gain
          </span>
          <p className="mt-2 text-[11.5px] text-slate-500">Resolves 74 critical and high severity crawl errors.</p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Core Web Vitals Pass Rate</span>
          <p className="mt-2 text-[28px] font-bold text-indigo-600">42% → 94%</p>
          <span className="mt-1 inline-block rounded-md bg-indigo-50 px-2 py-0.5 text-[11px] font-bold text-indigo-700">
            Google CWV Certified
          </span>
          <p className="mt-2 text-[11.5px] text-slate-500">Accelerates LCP from 3.2s to 1.4s across all pages.</p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">AI Citation Share</span>
          <p className="mt-2 text-[28px] font-bold text-emerald-600">24% → 42%</p>
          <span className="mt-1 inline-block rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
            +18pt Citation Share
          </span>
          <p className="mt-2 text-[11.5px] text-slate-500">Rich schema and entity blocks boost ChatGPT &amp; Gemini citations.</p>
        </div>
      </div>
    </div>
  );
}

// ── 4. Settings Sub-Tab ────────────────────────────────────────────────────────
export function SettingsTab() {
  const [safeMode, setSafeMode] = useState(true);
  const [autoMerge, setAutoMerge] = useState(false);

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs space-y-4">
        <h3 className="text-[14.5px] font-bold text-slate-900">Execution &amp; Safety Controls</h3>

        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <div>
            <h4 className="text-[13px] font-bold text-slate-800">Safe Mode Protection</h4>
            <p className="text-[11.5px] text-slate-500">All fixes require staging validation before production application.</p>
          </div>
          <button
            type="button"
            onClick={() => setSafeMode(!safeMode)}
            className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
              safeMode ? "bg-purple-600" : "bg-slate-200"
            }`}
          >
            <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${safeMode ? "translate-x-5" : ""}`} />
          </button>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <div>
            <h4 className="text-[13px] font-bold text-slate-800">Automated GitHub PR Creation</h4>
            <p className="text-[11.5px] text-slate-500">Creates isolated pull requests with diff previews for every fix batch.</p>
          </div>
          <button
            type="button"
            onClick={() => setAutoMerge(!autoMerge)}
            className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
              autoMerge ? "bg-purple-600" : "bg-slate-200"
            }`}
          >
            <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${autoMerge ? "translate-x-5" : ""}`} />
          </button>
        </div>
      </div>
    </div>
  );
}
