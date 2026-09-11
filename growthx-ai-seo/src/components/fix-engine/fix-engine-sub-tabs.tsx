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
import type { CrawlIssue, VisibilityReport } from "@/lib/api-client";

// ── 1. Fixes by Category Sub-Tab ────────────────────────────────────────────────
export function FixesByCategoryTab({
  issues = [],
  onOpenAutoFix,
}: {
  issues?: CrawlIssue[];
  onOpenAutoFix?: (issue: CrawlIssue) => void;
}) {
  const [selectedCat, setSelectedCat] = useState<string>("all");

  const categories = Array.from(new Set(issues.map((i) => i.category).filter(Boolean))) as string[];

  const filtered = selectedCat === "all"
    ? issues
    : issues.filter((f) => (f.category || "").toLowerCase().includes(selectedCat.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-[14.5px] font-bold text-slate-900">All Scheduled Fixes ({issues.length} Total)</h3>
            <p className="text-[11.5px] text-slate-500">
              Categorized and prioritized actions ready for automatic codebase remediation.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={selectedCat}
              onChange={(e) => setSelectedCat(e.target.value)}
              aria-label="Filter fixes by category"
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11.5px] font-semibold text-slate-700 capitalize"
            >
              <option value="all">All Categories ({issues.length})</option>
              {categories.map((cat) => {
                const count = issues.filter((i) => (i.category || "").toLowerCase() === cat.toLowerCase()).length;
                return (
                  <option key={cat} value={cat}>
                    {cat} ({count})
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        {issues.length === 0 ? (
          <div className="py-12 text-center">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-600 mb-2">
              <CheckCircle2 size={20} />
            </div>
            <p className="text-xs font-semibold text-slate-800">No issues found or crawl not yet run</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Run a site crawl to identify and schedule codebase fixes.</p>
          </div>
        ) : (
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
                {filtered.map((item) => {
                  const title = item.issueType
                    ? item.issueType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
                    : (item.description || "Issue");
                  const sev = (item.severity || "MEDIUM").toLowerCase();
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/70">
                      <td className="py-3.5 pl-2 font-semibold text-slate-900 max-w-sm">
                        {title}
                      </td>
                      <td className="py-3.5">
                        <span className="rounded-md bg-purple-50 text-purple-700 border border-purple-200/60 px-2 py-0.5 text-[10.5px] font-semibold capitalize">
                          {item.category || "Technical"}
                        </span>
                      </td>
                      <td className="py-3.5">
                        <span
                          className={`rounded-md px-2 py-0.5 text-[10.5px] font-semibold border capitalize ${
                            sev === "critical"
                              ? "bg-rose-50 text-rose-700 border-rose-200"
                              : sev === "high"
                              ? "bg-amber-50 text-amber-700 border-amber-200"
                              : "bg-blue-50 text-blue-700 border-blue-200"
                          }`}
                        >
                          {sev}
                        </span>
                      </td>
                      <td className="py-3.5 font-mono text-[11px] text-slate-500 max-w-xs truncate">
                        {item.affectedUrl || item.page?.url || "/"}
                      </td>
                      <td className="py-3.5 font-bold text-emerald-600">
                        {sev === "critical"
                          ? "High Impact"
                          : sev === "high"
                          ? "Medium Impact"
                        : "Optimization"}
                    </td>
                    <td className="py-3.5 pr-2 text-right">
                      <button
                        type="button"
                        onClick={() => onOpenAutoFix?.(item)}
                        className="inline-flex items-center gap-1 rounded-lg border border-purple-200 bg-purple-50 px-2.5 py-1 text-[11px] font-bold text-purple-700 hover:bg-purple-100 transition-colors"
                      >
                        <Sparkles size={11} />
                        <span>Review Code Fix</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            </table>
          </div>
        )}
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
export function ImpactForecastTab({
  latestCrawl,
  issues = [],
  visibilityReport,
}: {
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
  issues?: CrawlIssue[];
  visibilityReport?: VisibilityReport | null;
}) {
  const currentHealth = latestCrawl?.healthScore ?? null;
  const projectedHealth = currentHealth != null ? Math.min(100, currentHealth + (issues.length > 0 ? 18 : 0)) : null;

  const currentVisibility = visibilityReport?.summary?.citationSharePct != null ? Math.round(visibilityReport.summary.citationSharePct) : null;
  const projectedVisibility = currentVisibility != null ? Math.min(100, currentVisibility + 18) : null;

  const perfIssues = issues.filter((i) => {
    const c = (i.category || "").toLowerCase();
    return c.includes("perf") || c.includes("speed") || c.includes("cwv");
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">SEO Health Score</span>
          <p className="mt-2 text-[28px] font-bold text-slate-900">
            {currentHealth != null ? `${currentHealth} → ${projectedHealth}` : "Pending Crawl"}
          </p>
          {currentHealth != null && projectedHealth != null && (
            <span className="mt-1 inline-block rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
              +{projectedHealth - currentHealth}% Health Gain
            </span>
          )}
          <p className="mt-2 text-[11.5px] text-slate-500">
            {issues.length > 0
              ? `Resolves ${issues.length} detected crawl, indexing, and architecture errors.`
              : "Run a crawl audit to calculate projected health score gains."}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Performance &amp; Core Web Vitals</span>
          <p className="mt-2 text-[28px] font-bold text-indigo-600">
            {perfIssues.length > 0 ? `${perfIssues.length} Fixes` : latestCrawl ? "Pass Baseline" : "Pending Audit"}
          </p>
          <span className="mt-1 inline-block rounded-md bg-indigo-50 px-2 py-0.5 text-[11px] font-bold text-indigo-700">
            {perfIssues.length > 0 ? "Targeting Fast LCP" : "Lab Test Monitored"}
          </span>
          <p className="mt-2 text-[11.5px] text-slate-500">
            {perfIssues.length > 0
              ? `Automated asset compression and render script deferral for ${perfIssues.length} flagged URLs.`
              : "Zero critical render-blocking issues detected in latest crawl baseline."}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">AI Citation Share</span>
          <p className="mt-2 text-[28px] font-bold text-emerald-600">
            {currentVisibility != null ? `${currentVisibility}% → ${projectedVisibility}%` : "Pending Sweep"}
          </p>
          {currentVisibility != null && (
            <span className="mt-1 inline-block rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
              +18pt Citation Share
            </span>
          )}
          <p className="mt-2 text-[11.5px] text-slate-500">
            Rich schema and direct-answer entity blocks boost ChatGPT, Perplexity &amp; Gemini citations.
          </p>
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
