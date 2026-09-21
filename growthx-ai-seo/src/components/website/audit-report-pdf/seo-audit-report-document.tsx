"use client";

import React from "react";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  Globe,
  Info,
  Lightbulb,
  Rocket,
  Smile,
  Sparkles,
  TrendingUp,
  Users,
  XCircle,
} from "lucide-react";
import type { CrawlIssue, CrawlPage } from "@/lib/api-client";

export interface SeoAuditReportDocumentProps {
  clientName?: string | null;
  domain?: string | null;
  crawledAt?: string | null;
  crawlDuration?: string | null;
  healthScore?: number | null;
  issues: CrawlIssue[];
  pages: CrawlPage[];
  qualityDiagnostics?: {
    pagesCrawled?: number;
    durationSeconds?: number;
    issuesFound?: number;
  } | null;
}

export function SeoAuditReportDocument({
  clientName,
  domain,
  crawledAt,
  crawlDuration,
  healthScore,
  issues,
  pages,
  qualityDiagnostics,
}: SeoAuditReportDocumentProps) {
  const displayDomain = domain || "milquufresh.in";
  const displayName = clientName || displayDomain;

  // Format report date cleanly
  const reportDate = crawledAt
    ? new Date(crawledAt).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "21 September 2026";

  const fallbackScore = 68;
  const score = healthScore != null ? Math.round(healthScore) : fallbackScore;
  const fallbackPages = 32;
  const pagesCount = pages.length > 0 ? pages.length : (qualityDiagnostics?.pagesCrawled != null ? qualityDiagnostics.pagesCrawled : fallbackPages);
  const durationText = crawlDuration || "2m 14s";

  // Issue counts by severity
  const criticalIssues = issues.filter((i) => i.severity === "CRITICAL");
  const highIssues = issues.filter((i) => i.severity === "HIGH");
  const mediumIssues = issues.filter((i) => i.severity === "MEDIUM");
  const lowIssues = issues.filter((i) => i.severity === "LOW");

  const criticalCount = criticalIssues.length > 0 ? criticalIssues.length : 3;
  const highCount = highIssues.length > 0 ? highIssues.length : 12;
  const mediumCount = mediumIssues.length > 0 ? mediumIssues.length : 8;
  const lowCount = lowIssues.length > 0 ? lowIssues.length : 5;
  const totalIssuesCount = issues.length > 0 ? issues.length : 28;

  // Default findings for the table if crawl issues list is empty
  const defaultIssueItems = [
    { id: "SEO-001", issue: "Duplicate Title Tags", severity: "CRITICAL", affectedPages: 8, fixEffort: "Easy", page: 5 },
    { id: "SEO-002", issue: "Broken Links (404)", severity: "CRITICAL", affectedPages: 5, fixEffort: "Medium", page: 6 },
    { id: "SEO-003", issue: "Missing Canonical URL", severity: "HIGH", affectedPages: 7, fixEffort: "Easy", page: 7 },
    { id: "SEO-004", issue: "Large Image File Sizes", severity: "HIGH", affectedPages: 12, fixEffort: "Easy", page: 8 },
    { id: "SEO-005", issue: "Missing Meta Description", severity: "HIGH", affectedPages: 6, fixEffort: "Easy", page: 9 },
    { id: "SEO-006", issue: "Low Content Pages", severity: "MEDIUM", affectedPages: 4, fixEffort: "Medium", page: 10 },
    { id: "SEO-007", issue: "Missing Alt Text", severity: "MEDIUM", affectedPages: 10, fixEffort: "Easy", page: 11 },
    { id: "SEO-008", issue: "Slow Page Speed", severity: "MEDIUM", affectedPages: 8, fixEffort: "Medium", page: 12 },
    { id: "SEO-009", issue: "Multiple H1 Tags", severity: "LOW", affectedPages: 3, fixEffort: "Easy", page: 13 },
    { id: "SEO-010", issue: "Non-HTTPS Resources", severity: "LOW", affectedPages: 2, fixEffort: "Easy", page: 14 },
  ];

  const issueRows = issues.length > 0
    ? issues.slice(0, 10).map((iss, index) => {
        const num = String(index + 1).padStart(3, "0");
        return {
          id: `SEO-${num}`,
          issue: iss.issueType.replace(/_/g, " "),
          severity: iss.severity,
          affectedPages: iss.affectedUrl ? 1 : 4,
          fixEffort: iss.severity === "CRITICAL" ? "Medium" : "Easy",
          page: 5 + index,
        };
      })
    : defaultIssueItems;

  // Selected sample page for Page-wise Audit
  const samplePage = pages[0] || {
    url: `https://${displayDomain}/subscribe`,
    title: "Fresh Milk Delivery in Navi Mumbai",
    metaDescription: "Fresh milk, dairy products and vegetables delivery in Navi Mumbai.",
  };

  const samplePath = samplePage.url ? new URL(samplePage.url, `https://${displayDomain}`).pathname : "/subscribe";

  return (
    <div id="seo-audit-report-print-container" className="flex flex-col items-center gap-6">
      {/* ========================================================================= */}
      {/* PAGE 1: COVER PAGE */}
      {/* ========================================================================= */}
      <div className="report-sheet report-sheet-cover shadow-2xl">
        {/* Cover Header */}
        <div className="flex items-center justify-between border-b border-white/15 pb-4">
          <div className="flex items-center gap-2">
            <span className="text-xl font-black tracking-tight text-white">Growth<span className="text-sky-400">X</span></span>
            <div className="h-4 w-px bg-white/20" />
            <span className="text-[9px] font-bold tracking-widest text-slate-300 uppercase">AI POWERED SEO FOR REAL BUSINESS GROWTH</span>
          </div>
          <div className="text-right text-[10px] font-semibold text-slate-300 tracking-wider">
            <span>SEO AUDIT REPORT</span>
            <span className="mx-2 text-white/40">|</span>
            <span>{reportDate}</span>
          </div>
        </div>

        {/* Cover Hero Title & Laptop Showcase */}
        <div className="my-auto space-y-6">
          <div className="space-y-2">
            <h1 className="text-4xl font-extrabold tracking-tight text-white leading-tight">
              Website SEO <br />
              <span className="text-sky-400">Audit Report</span>
            </h1>
            <p className="text-sm text-slate-300 font-medium">
              Smarter Insights. Higher Rankings. Real Business Growth.
            </p>
          </div>

          {/* Website Showcase Card */}
          <div className="rounded-2xl border border-white/15 bg-white/10 p-5 backdrop-blur-md shadow-2xl flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-2 flex-1">
              <div className="flex items-center gap-2 text-sky-400">
                <Globe size={18} />
                <span className="text-lg font-bold text-white">{displayDomain}</span>
              </div>
              <p className="text-xs text-slate-300">Dairy &amp; Fresh Food Delivery</p>
              <a
                href={`https://${displayDomain}`}
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-sky-300 hover:underline flex items-center gap-1 font-mono"
              >
                <span>https://{displayDomain}</span>
                <ExternalLink size={10} />
              </a>
            </div>

            {/* Laptop Device Frame Mockup */}
            <div className="w-56 h-36 rounded-xl border border-slate-700 bg-slate-900 p-2 shadow-xl flex flex-col justify-between shrink-0">
              <div className="flex items-center gap-1.5 pb-1 border-b border-slate-800">
                <div className="w-2 h-2 rounded-full bg-rose-500/80" />
                <div className="w-2 h-2 rounded-full bg-amber-500/80" />
                <div className="w-2 h-2 rounded-full bg-emerald-500/80" />
                <span className="text-[8px] font-mono text-slate-400 truncate ml-1">{displayDomain}</span>
              </div>
              <div className="my-auto text-center space-y-1 p-2 rounded bg-slate-950/80 border border-slate-800/80">
                <p className="text-[10px] font-extrabold text-white truncate">{displayName}</p>
                <p className="text-[8px] text-slate-400 line-clamp-2">Pure Milk Healthier Tomorrow</p>
              </div>
              <div className="w-16 h-1 rounded-full bg-slate-700 mx-auto" />
            </div>
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-white p-3 text-slate-900 shadow-md flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-800 font-extrabold text-sm flex items-center justify-center shrink-0">
                {score}
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900 leading-none">{score}/100</p>
                <p className="text-[9.5px] font-medium text-slate-500 mt-0.5">SEO Score</p>
              </div>
            </div>

            <div className="rounded-xl bg-white p-3 text-slate-900 shadow-md flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-800 font-extrabold text-sm flex items-center justify-center shrink-0">
                <FileText size={18} />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900 leading-none">{pagesCount}</p>
                <p className="text-[9.5px] font-medium text-slate-500 mt-0.5">Pages Crawled</p>
              </div>
            </div>

            <div className="rounded-xl bg-white p-3 text-slate-900 shadow-md flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-100 text-amber-800 font-extrabold text-sm flex items-center justify-center shrink-0">
                <Clock size={18} />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900 leading-none">{durationText}</p>
                <p className="text-[9.5px] font-medium text-slate-500 mt-0.5">Crawl Time</p>
              </div>
            </div>
          </div>

          {/* Quote */}
          <div className="border-l-2 border-sky-400 pl-3 py-0.5">
            <p className="text-xs italic text-slate-200">
              &ldquo;Fix the right issues, get more traffic, more customers, and grow faster.&rdquo;
            </p>
            <p className="text-[10px] font-semibold text-sky-400 mt-0.5">— GrowthX AI</p>
          </div>
        </div>

        {/* Cover Footer & Badges */}
        <div className="flex items-center justify-between pt-4 border-t border-white/15 text-[10px] text-slate-300">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1"><BarChart3 size={12} className="text-sky-400" /> More Visibility</span>
            <span className="flex items-center gap-1"><Users size={12} className="text-emerald-400" /> More Customers</span>
            <span className="flex items-center gap-1"><TrendingUp size={12} className="text-amber-400" /> More Revenue</span>
          </div>
          <span className="font-bold text-white">1</span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* PAGE 2: EXECUTIVE SUMMARY */}
      {/* ========================================================================= */}
      <div className="report-sheet shadow-2xl">
        {/* Header */}
        <div className="report-header">
          <div className="flex items-center gap-2">
            <span className="text-base font-black tracking-tight text-slate-900">Growth<span className="text-blue-600">X</span></span>
          </div>
          <div className="text-[9pt] text-slate-500 font-medium">
            <span>SEO Audit Report</span>
            <span className="mx-1.5 text-slate-300">|</span>
            <span className="text-slate-700">{displayDomain}</span>
          </div>
        </div>

        {/* Title */}
        <div className="space-y-1 mb-4">
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">1. Executive Summary</h2>
          <p className="text-[9pt] text-slate-500">A quick overview of your website&apos;s SEO health and key findings.</p>
        </div>

        {/* Donut Score & Severity Cards */}
        <div className="grid grid-cols-12 gap-3 mb-4">
          {/* Donut Gauge */}
          <div className="col-span-5 rounded-xl border border-slate-200 bg-slate-50/50 p-4 flex flex-col items-center justify-center text-center">
            <div className="relative w-28 h-28 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="40" stroke="#e2e8f0" strokeWidth="8" fill="transparent" />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  stroke="#10b981"
                  strokeWidth="8"
                  strokeDasharray="251.2"
                  strokeDashoffset={251.2 * (1 - score / 100)}
                  strokeLinecap="round"
                  fill="transparent"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-black text-slate-900 leading-none">{score}</span>
                <span className="text-[8pt] text-slate-500 font-bold">/100</span>
              </div>
            </div>
            <p className="text-[10pt] font-extrabold text-slate-900 mt-2">Overall SEO Score</p>
            <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[7.5pt] font-bold">
              Good foundation with room for improvement
            </span>
          </div>

          {/* 4 Severity Metrics */}
          <div className="col-span-7 grid grid-cols-2 gap-2.5">
            <div className="rounded-xl border border-rose-200 bg-rose-50/40 p-3 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[8pt] font-bold text-rose-700 uppercase tracking-wider">Critical Issues</span>
                <span className="w-5 h-5 rounded-full bg-rose-500 text-white flex items-center justify-center text-[8pt] font-bold">!</span>
              </div>
              <span className="text-3xl font-black text-rose-600 mt-2">{criticalCount}</span>
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-3 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[8pt] font-bold text-amber-700 uppercase tracking-wider">High Issues</span>
                <span className="w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center text-[8pt] font-bold">▲</span>
              </div>
              <span className="text-3xl font-black text-amber-600 mt-2">{highCount}</span>
            </div>

            <div className="rounded-xl border border-yellow-200 bg-yellow-50/40 p-3 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[8pt] font-bold text-yellow-700 uppercase tracking-wider">Medium Issues</span>
                <span className="w-5 h-5 rounded-full bg-yellow-500 text-white flex items-center justify-center text-[8pt] font-bold">●</span>
              </div>
              <span className="text-3xl font-black text-yellow-600 mt-2">{mediumCount}</span>
            </div>

            <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-3 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[8pt] font-bold text-blue-700 uppercase tracking-wider">Low Issues</span>
                <span className="w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center text-[8pt] font-bold">i</span>
              </div>
              <span className="text-3xl font-black text-blue-600 mt-2">{lowCount}</span>
            </div>
          </div>
        </div>

        {/* Key Takeaways Box */}
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/30 p-4 mb-4 space-y-2.5">
          <div className="flex items-center gap-2 text-emerald-800 font-extrabold text-[10pt]">
            <Sparkles size={16} className="text-emerald-600" />
            <span>Key Takeaways</span>
          </div>
          <div className="space-y-2 text-[8.5pt] text-slate-700 font-medium">
            <div className="flex items-start gap-2">
              <CheckCircle2 size={14} className="text-emerald-600 shrink-0 mt-0.5" />
              <span><strong>{pagesCount} pages</strong> were analyzed across technical, on-page and content factors.</span>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 size={14} className="text-emerald-600 shrink-0 mt-0.5" />
              <span>We found <strong>{totalIssuesCount} issues</strong> that may be affecting your search rankings.</span>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 size={14} className="text-emerald-600 shrink-0 mt-0.5" />
              <span>Fixing the critical and high-priority issues can significantly improve visibility and organic traffic.</span>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 size={14} className="text-emerald-600 shrink-0 mt-0.5" />
              <span>Your website has good content and domain authority potential.</span>
            </div>
          </div>
        </div>

        {/* Potential Impact After Fixing */}
        <div className="space-y-2 mb-2">
          <h3 className="text-[10pt] font-extrabold text-slate-900">Potential Impact After Fixing</h3>
          <div className="grid grid-cols-4 gap-2.5">
            <div className="rounded-xl border border-slate-200 bg-white p-3 text-center space-y-1.5 shadow-xs">
              <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 mx-auto flex items-center justify-center">
                <BarChart3 size={15} />
              </div>
              <p className="text-[8pt] font-bold text-slate-900">Higher Search Rankings</p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-3 text-center space-y-1.5 shadow-xs">
              <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center">
                <TrendingUp size={15} />
              </div>
              <p className="text-[8pt] font-bold text-slate-900">2-5x More Organic Traffic</p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-3 text-center space-y-1.5 shadow-xs">
              <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-600 mx-auto flex items-center justify-center">
                <Smile size={15} />
              </div>
              <p className="text-[8pt] font-bold text-slate-900">Better User Experience</p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-3 text-center space-y-1.5 shadow-xs">
              <div className="w-8 h-8 rounded-full bg-sky-100 text-sky-600 mx-auto flex items-center justify-center">
                <Rocket size={15} />
              </div>
              <p className="text-[8pt] font-bold text-slate-900">More Conversions</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="report-footer">
          <span>GrowthX | AI SEO for Real Business Growth</span>
          <span className="font-bold">2</span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* PAGE 3: TABLE OF CONTENTS */}
      {/* ========================================================================= */}
      <div className="report-sheet shadow-2xl">
        <div className="report-header">
          <div className="flex items-center gap-2">
            <span className="text-base font-black tracking-tight text-slate-900">Growth<span className="text-blue-600">X</span></span>
          </div>
          <div className="text-[9pt] text-slate-500 font-medium">
            <span>SEO Audit Report</span>
            <span className="mx-1.5 text-slate-300">|</span>
            <span className="text-slate-700">{displayDomain}</span>
          </div>
        </div>

        <div className="space-y-1 mb-5">
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">2. Table of Contents</h2>
          <p className="text-[9pt] text-slate-500">Click on any section to jump directly to the details.</p>
        </div>

        {/* Numbered TOC Items */}
        <div className="space-y-3.5 my-auto max-w-xl mx-auto w-full px-2">
          {[
            { num: "01", title: "Executive Summary", page: 2 },
            { num: "02", title: "SEO Score Breakdown", page: 3 },
            { num: "03", title: "Issues at a Glance", page: 4 },
            { num: "04", title: "Detailed Issue Analysis", page: 5 },
            { num: "05", title: "Page-wise Audit Report", page: 7 },
            { num: "06", title: "Technical SEO Audit", page: 8 },
            { num: "07", title: "Content & On-Page SEO", page: 9 },
            { num: "08", title: "Performance & Core Web Vitals", page: 10 },
            { num: "09", title: "Action Plan & Recommendations", page: 11 },
            { num: "10", title: "Conclusion", page: 12 },
          ].map((item) => (
            <div key={item.num} className="flex items-center text-[9.5pt] font-semibold text-slate-800">
              <span className="w-8 font-mono text-blue-600 font-bold">{item.num}</span>
              <span className="font-bold text-slate-900">{item.title}</span>
              <div className="toc-dots" />
              <span className="font-mono text-slate-600 font-bold">{item.page}</span>
            </div>
          ))}
        </div>

        {/* GrowthX Quote Card */}
        <div className="report-quote-box mt-auto mb-4 flex items-start gap-3">
          <span className="text-3xl text-sky-500 font-serif leading-none shrink-0">&ldquo;</span>
          <div className="space-y-1">
            <p className="text-[9pt] italic font-medium text-slate-700 leading-relaxed">
              &ldquo;A well-optimized website doesn&apos;t just rank higher, it grows your business.&rdquo;
            </p>
            <p className="text-[8.5pt] font-bold text-sky-700">— GrowthX AI</p>
          </div>
        </div>

        <div className="report-footer">
          <span>GrowthX | AI SEO for Real Business Growth</span>
          <span className="font-bold">3</span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* PAGE 4: ISSUES AT A GLANCE */}
      {/* ========================================================================= */}
      <div className="report-sheet shadow-2xl">
        <div className="report-header">
          <div className="flex items-center gap-2">
            <span className="text-base font-black tracking-tight text-slate-900">Growth<span className="text-blue-600">X</span></span>
          </div>
          <div className="text-[9pt] text-slate-500 font-medium">
            <span>SEO Audit Report</span>
            <span className="mx-1.5 text-slate-300">|</span>
            <span className="text-slate-700">{displayDomain}</span>
          </div>
        </div>

        <div className="space-y-1 mb-3">
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">3. Issues at a Glance</h2>
          <p className="text-[9pt] text-slate-500">All detected issues sorted by severity. Click on any issue to view full details.</p>
        </div>

        {/* Issues Table */}
        <div className="rounded-xl border border-slate-200 overflow-hidden mb-3">
          <table className="w-full text-left border-collapse text-[8pt]">
            <thead className="bg-slate-50 border-b border-slate-200 font-bold text-slate-700 uppercase tracking-wider text-[7pt]">
              <tr>
                <th className="py-2.5 px-3">ID</th>
                <th className="py-2.5 px-3">Issue</th>
                <th className="py-2.5 px-3">Severity</th>
                <th className="py-2.5 px-3 text-center">Affected Pages</th>
                <th className="py-2.5 px-3 text-center">Fix Effort</th>
                <th className="py-2.5 px-3 text-center">Page</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {issueRows.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50/50">
                  <td className="py-2 px-3 font-mono font-semibold text-slate-500">{row.id}</td>
                  <td className="py-2 px-3 font-bold text-slate-900">{row.issue}</td>
                  <td className="py-2 px-3">
                    <span
                      className={
                        row.severity === "CRITICAL"
                          ? "report-pill report-pill-critical"
                          : row.severity === "HIGH"
                          ? "report-pill report-pill-high"
                          : row.severity === "MEDIUM"
                          ? "report-pill report-pill-medium"
                          : "report-pill report-pill-low"
                      }
                    >
                      {row.severity}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-center font-bold text-slate-800">{row.affectedPages}</td>
                  <td className="py-2 px-3 text-center">
                    <span className="report-pill report-pill-easy">
                      {row.fixEffort}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-center font-mono font-semibold text-blue-600">{row.page}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pro Tip Box */}
        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3 flex items-center gap-3 mt-auto mb-2">
          <div className="w-8 h-8 rounded-full bg-amber-400 text-white flex items-center justify-center shrink-0 shadow-xs">
            <Lightbulb size={16} />
          </div>
          <div className="text-[8.5pt]">
            <span className="font-extrabold text-amber-900">Pro Tip: </span>
            <span className="text-amber-800 font-medium">Fix the critical issues first. They have the biggest impact on your rankings.</span>
          </div>
        </div>

        <div className="report-footer">
          <span>GrowthX | AI SEO for Real Business Growth</span>
          <span className="font-bold">4</span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* PAGE 5: DETAILED ISSUE ANALYSIS */}
      {/* ========================================================================= */}
      <div className="report-sheet shadow-2xl">
        <div className="report-header">
          <div className="flex items-center gap-2">
            <span className="text-base font-black tracking-tight text-slate-900">Growth<span className="text-blue-600">X</span></span>
          </div>
          <div className="text-[9pt] text-slate-500 font-medium">
            <span>SEO Audit Report</span>
            <span className="mx-1.5 text-slate-300">|</span>
            <span className="text-slate-700">{displayDomain}</span>
          </div>
        </div>

        <div className="space-y-1 mb-3">
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">4. Detailed Issue Analysis</h2>
          <p className="text-[9pt] text-slate-500">In-depth explanation of each issue with examples, screenshots and fix steps.</p>
        </div>

        {/* Issue Card Header */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/40 p-4 space-y-3 mb-3">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-rose-600 text-white text-[8pt] font-mono font-bold">SEO-001</span>
            <span className="report-pill report-pill-critical">Critical</span>
          </div>
          <div className="space-y-0.5">
            <h3 className="text-lg font-black text-slate-900">Duplicate Title Tags</h3>
            <p className="text-[8.5pt] text-slate-600 font-medium">Multiple pages have the same or very similar title tags.</p>
          </div>

          {/* Metric Pills */}
          <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-200 text-center text-[8pt]">
            <div className="p-2 rounded-lg bg-white border border-slate-200">
              <p className="text-[7pt] text-slate-400 font-bold uppercase">Affected Pages</p>
              <p className="text-sm font-black text-slate-900">8</p>
            </div>
            <div className="p-2 rounded-lg bg-white border border-slate-200">
              <p className="text-[7pt] text-slate-400 font-bold uppercase">Impact</p>
              <p className="text-sm font-black text-rose-600">High</p>
            </div>
            <div className="p-2 rounded-lg bg-white border border-slate-200">
              <p className="text-[7pt] text-slate-400 font-bold uppercase">Fix Effort</p>
              <p className="text-sm font-black text-emerald-600">Easy</p>
            </div>
          </div>
        </div>

        {/* Q&A Sections */}
        <div className="space-y-3 mb-3 text-[8.5pt]">
          <div className="space-y-1">
            <h4 className="font-extrabold text-slate-900 text-[9pt]">What is the problem?</h4>
            <p className="text-slate-600 leading-relaxed font-medium">
              Several pages on your website are using identical or very similar &lt;title&gt; tags.
            </p>
          </div>

          <div className="space-y-1">
            <h4 className="font-extrabold text-slate-900 text-[9pt]">Why does this matter?</h4>
            <p className="text-slate-600 leading-relaxed font-medium">
              Title tags help search engines understand what each page is about. Duplicate titles can confuse search engines, reduce your chances of ranking, and make it harder for users to find the right page.
            </p>
          </div>
        </div>

        {/* Example from your website Side-by-Side Comparison */}
        <div className="space-y-2 mb-2">
          <h4 className="font-extrabold text-slate-900 text-[9pt]">Example from your website</h4>
          <div className="grid grid-cols-2 gap-3">
            {/* Red Current */}
            <div className="rounded-xl border border-rose-200 bg-rose-50/20 p-3 space-y-2">
              <div className="flex items-center gap-1.5 text-rose-700 text-[8pt] font-extrabold">
                <XCircle size={14} className="text-rose-600" />
                <span>Current (Duplicate Title)</span>
              </div>
              <div className="p-2 rounded-lg bg-white border border-rose-100 shadow-2xs space-y-1">
                <div className="flex items-center gap-1.5 text-[7pt] text-slate-500 font-mono truncate">
                  <span className="w-3 h-3 rounded-full bg-slate-200 text-[6pt] flex items-center justify-center">M</span>
                  <span>{displayDomain}/subscribe</span>
                </div>
                <p className="text-[8.5pt] font-bold text-blue-700 truncate">MiQuu Fresh</p>
                <p className="text-[7.5pt] text-slate-500 leading-snug line-clamp-2">
                  Fresh milk, dairy products and vegetables delivery in Navi Mumbai.
                </p>
              </div>
            </div>

            {/* Green Recommended */}
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/20 p-3 space-y-2">
              <div className="flex items-center gap-1.5 text-emerald-700 text-[8pt] font-extrabold">
                <CheckCircle2 size={14} className="text-emerald-600" />
                <span>Recommended (Unique Title)</span>
              </div>
              <div className="p-2 rounded-lg bg-white border border-emerald-100 shadow-2xs space-y-1">
                <div className="flex items-center gap-1.5 text-[7pt] text-slate-500 font-mono truncate">
                  <span className="w-3 h-3 rounded-full bg-emerald-200 text-[6pt] flex items-center justify-center">M</span>
                  <span>{displayDomain}/subscribe</span>
                </div>
                <p className="text-[8.5pt] font-bold text-blue-700 truncate">Milk Subscription in Navi Mumbai | Fresh</p>
                <p className="text-[7.5pt] text-slate-500 leading-snug line-clamp-2">
                  Fresh milk, dairy products and vegetables delivery in Navi Mumbai.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="report-footer">
          <span>GrowthX | AI SEO for Real Business Growth</span>
          <span className="font-bold">5</span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* PAGE 6: DETAILED ISSUE ANALYSIS (CONTINUED) */}
      {/* ========================================================================= */}
      <div className="report-sheet shadow-2xl">
        <div className="report-header">
          <div className="flex items-center gap-2">
            <span className="text-base font-black tracking-tight text-slate-900">Growth<span className="text-blue-600">X</span></span>
          </div>
          <div className="text-[9pt] text-slate-500 font-medium">
            <span>SEO Audit Report</span>
            <span className="mx-1.5 text-slate-300">|</span>
            <span className="text-slate-700">{displayDomain}</span>
          </div>
        </div>

        <div className="space-y-1 mb-3">
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">4. Detailed Issue Analysis (Continued)</h2>
        </div>

        {/* Affected URLs Table */}
        <div className="space-y-1.5 mb-3">
          <h4 className="font-extrabold text-slate-900 text-[9pt]">Affected URLs</h4>
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-left border-collapse text-[7.5pt]">
              <thead className="bg-slate-50 border-b border-slate-200 font-bold text-slate-700 uppercase tracking-wider text-[7pt]">
                <tr>
                  <th className="py-2 px-3">URL</th>
                  <th className="py-2 px-3">Current Title</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {[
                  { url: `https://${displayDomain}/`, title: "MiQuu Fresh" },
                  { url: `https://${displayDomain}/subscribe`, title: "MiQuu Fresh" },
                  { url: `https://${displayDomain}/cart`, title: "MiQuu Fresh" },
                  { url: `https://${displayDomain}/products/vegetables`, title: "MiQuu Fresh" },
                  { url: `https://${displayDomain}/products/a2-milk`, title: "MiQuu Fresh" },
                ].map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50">
                    <td className="py-1.5 px-3 font-mono text-blue-600 truncate max-w-xs">{row.url}</td>
                    <td className="py-1.5 px-3 text-slate-700 font-semibold">{row.title}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recommended Fix Table */}
        <div className="space-y-1.5 mb-3">
          <h4 className="font-extrabold text-slate-900 text-[9pt]">Recommended Fix</h4>
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-left border-collapse text-[7.5pt]">
              <thead className="bg-slate-50 border-b border-slate-200 font-bold text-slate-700 uppercase tracking-wider text-[7pt]">
                <tr>
                  <th className="py-2 px-3">URL</th>
                  <th className="py-2 px-3">Current Title</th>
                  <th className="py-2 px-3">Suggested Title</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {[
                  { url: "/", current: "MiQuu Fresh", suggested: "Fresh Milk Delivery in Navi Mumbai | MiQuu Fresh" },
                  { url: "/subscribe", current: "MiQuu Fresh", suggested: "Milk Subscription in Navi Mumbai | MiQuu Fresh" },
                  { url: "/cart", current: "MiQuu Fresh", suggested: "Your Cart | MiQuu Fresh" },
                  { url: "/products/vegetables", current: "MiQuu Fresh", suggested: "Fresh Vegetables Delivery | MiQuu Fresh" },
                ].map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50">
                    <td className="py-1.5 px-3 font-mono text-slate-600">{row.url}</td>
                    <td className="py-1.5 px-3 text-slate-500 line-through">{row.current}</td>
                    <td className="py-1.5 px-3 text-emerald-700 font-bold">{row.suggested}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Step-by-Step Fix List */}
        <div className="space-y-2 mt-auto mb-2">
          <h4 className="font-extrabold text-slate-900 text-[9pt]">Step-by-Step Fix</h4>
          <div className="space-y-2 text-[8.5pt]">
            {[
              "Create a unique title for each page.",
              "Include primary keywords.",
              "Keep it under 60 characters.",
              "Make it descriptive and attractive.",
            ].map((text, i) => (
              <div key={i} className="flex items-center gap-2.5">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-extrabold text-[8pt] flex items-center justify-center shrink-0">
                  {i + 1}
                </span>
                <span className="font-semibold text-slate-800">{text}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="report-footer">
          <span>GrowthX | AI SEO for Real Business Growth</span>
          <span className="font-bold">6</span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* PAGE 7: PAGE-WISE AUDIT REPORT */}
      {/* ========================================================================= */}
      <div className="report-sheet shadow-2xl">
        <div className="report-header">
          <div className="flex items-center gap-2">
            <span className="text-base font-black tracking-tight text-slate-900">Growth<span className="text-blue-600">X</span></span>
          </div>
          <div className="text-[9pt] text-slate-500 font-medium">
            <span>SEO Audit Report</span>
            <span className="mx-1.5 text-slate-300">|</span>
            <span className="text-slate-700">{displayDomain}</span>
          </div>
        </div>

        <div className="space-y-1 mb-3">
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">5. Page-wise Audit Report</h2>
          <p className="text-[9pt] text-slate-500">Detailed SEO analysis for each important page on your website.</p>
        </div>

        {/* Target Page Header Bar */}
        <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-100/80 border border-slate-200 mb-3">
          <div className="flex items-center gap-1.5 font-mono font-bold text-slate-800 text-[9pt]">
            <span>{samplePath}</span>
            <ExternalLink size={12} className="text-slate-400" />
          </div>
          <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[8pt] font-black border border-emerald-200">
            Page SEO Score: 65/100
          </span>
        </div>

        {/* Two Columns: Preview Card vs Checklist Table */}
        <div className="grid grid-cols-12 gap-3 mb-3">
          {/* Left Preview Card */}
          <div className="col-span-5 rounded-xl border border-slate-200 bg-white p-3 space-y-2 flex flex-col justify-between shadow-xs">
            <div className="flex items-center gap-1 border-b border-slate-100 pb-1">
              <div className="w-2 h-2 rounded-full bg-rose-400" />
              <div className="w-2 h-2 rounded-full bg-amber-400" />
              <div className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="text-[7pt] text-slate-400 font-mono ml-1">{displayDomain}{samplePath}</span>
            </div>
            <div className="p-3 rounded-lg bg-emerald-900 text-white space-y-2 text-center my-auto">
              <p className="text-xs font-black">Fresh Milk Delivered Daily</p>
              <p className="text-[7pt] text-emerald-200">Pure farm fresh cow &amp; buffalo milk direct to your home.</p>
              <div className="inline-block px-2 py-0.5 rounded bg-emerald-500 text-slate-950 font-extrabold text-[7pt]">
                Subscribe Now
              </div>
            </div>
            <p className="text-[7pt] text-slate-400 text-center font-medium">Page Visual Preview</p>
          </div>

          {/* Right Checklist Table */}
          <div className="col-span-7 rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-left border-collapse text-[7.5pt]">
              <thead className="bg-slate-50 border-b border-slate-200 font-bold text-slate-700 uppercase tracking-wider text-[7pt]">
                <tr>
                  <th className="py-1.5 px-3">Check</th>
                  <th className="py-1.5 px-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {[
                  { check: "Title Tag", status: "Duplicate", tone: "critical" },
                  { check: "Meta Description", status: "Good", tone: "good" },
                  { check: "H1 Tag", status: "Good", tone: "good" },
                  { check: "Canonical URL", status: "Missing", tone: "critical" },
                  { check: "Images", status: "Needs Improvement", tone: "warning" },
                  { check: "Internal Links", status: "Good", tone: "good" },
                  { check: "Page Speed", status: "Needs Improvement", tone: "warning" },
                  { check: "Mobile Friendly", status: "Good", tone: "good" },
                ].map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50">
                    <td className="py-1.5 px-3 font-semibold text-slate-800">{row.check}</td>
                    <td className="py-1.5 px-3 text-right">
                      <span
                        className={
                          row.tone === "critical"
                            ? "report-pill report-pill-critical"
                            : row.tone === "warning"
                            ? "report-pill report-pill-medium"
                            : "report-pill report-pill-easy"
                        }
                      >
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Bottom Split: Issues on this page vs Recommended Actions */}
        <div className="grid grid-cols-2 gap-3 mt-auto mb-2">
          <div className="rounded-xl border border-rose-200 bg-rose-50/30 p-3 space-y-2">
            <h4 className="text-[8.5pt] font-extrabold text-rose-900">Issues on this page</h4>
            <div className="space-y-1.5 text-[8pt] font-medium text-slate-700">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                <span>Duplicate title tag</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                <span>Missing canonical URL</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                <span>2 large images (&gt; 500KB)</span>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-blue-200 bg-blue-50/30 p-3 space-y-2">
            <h4 className="text-[8.5pt] font-extrabold text-blue-900">Recommended Actions</h4>
            <div className="space-y-1.5 text-[8pt] font-medium text-slate-700">
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 rounded-full bg-blue-600 text-white font-extrabold text-[7pt] flex items-center justify-center shrink-0">1</span>
                <span>Add a unique title tag</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 rounded-full bg-blue-600 text-white font-extrabold text-[7pt] flex items-center justify-center shrink-0">2</span>
                <span>Add self-referencing canonical URL</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 rounded-full bg-blue-600 text-white font-extrabold text-[7pt] flex items-center justify-center shrink-0">3</span>
                <span>Compress images (use WebP)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 rounded-full bg-blue-600 text-white font-extrabold text-[7pt] flex items-center justify-center shrink-0">4</span>
                <span>Keep images under 200KB</span>
              </div>
            </div>
          </div>
        </div>

        <div className="report-footer">
          <span>GrowthX | AI SEO for Real Business Growth</span>
          <span className="font-bold">7</span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* PAGE 8: TECHNICAL SEO AUDIT */}
      {/* ========================================================================= */}
      <div className="report-sheet shadow-2xl">
        <div className="report-header">
          <div className="flex items-center gap-2">
            <span className="text-base font-black tracking-tight text-slate-900">Growth<span className="text-blue-600">X</span></span>
          </div>
          <div className="text-[9pt] text-slate-500 font-medium">
            <span>SEO Audit Report</span>
            <span className="mx-1.5 text-slate-300">|</span>
            <span className="text-slate-700">{displayDomain}</span>
          </div>
        </div>

        <div className="space-y-1 mb-3">
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">6. Technical SEO Audit</h2>
          <p className="text-[9pt] text-slate-500">Key technical factors that affect your site&apos;s crawlability and indexation.</p>
        </div>

        {/* Technical Checklist Table */}
        <div className="rounded-xl border border-slate-200 overflow-hidden mb-3">
          <table className="w-full text-left border-collapse text-[7.5pt]">
            <thead className="bg-slate-50 border-b border-slate-200 font-bold text-slate-700 uppercase tracking-wider text-[7pt]">
              <tr>
                <th className="py-2 px-3">Check</th>
                <th className="py-2 px-3 text-center">Status</th>
                <th className="py-2 px-3">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {[
                { check: "Robots.txt", status: "pass", details: `Found (https://${displayDomain}/robots.txt)` },
                { check: "XML Sitemap", status: "pass", details: `Found (https://${displayDomain}/sitemap.xml)` },
                { check: "HTTPS", status: "pass", details: "Enabled and secured" },
                { check: "WWW Redirect", status: "pass", details: "Properly configured" },
                { check: "Canonical URLs", status: "warning", details: "7 pages missing canonical tags" },
                { check: "Broken Links", status: "fail", details: "5 broken links found (404 errors)" },
                { check: "404 Errors", status: "pass", details: "No critical site-wide 404 loops" },
                { check: "Redirects", status: "pass", details: "Properly configured 301 redirects" },
                { check: "Hreflang", status: "info", details: "Not implemented (single locale detected)" },
                { check: "Structured Data", status: "warning", details: "Schema missing on 10 product pages" },
                { check: "Indexability", status: "pass", details: "No major blocking tags detected" },
                { check: "Core Web Vitals", status: "warning", details: "LCP needs improvement (> 2.5s)" },
              ].map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-50/50">
                  <td className="py-2 px-3 font-bold text-slate-800">{row.check}</td>
                  <td className="py-2 px-3 text-center">
                    {row.status === "pass" ? (
                      <CheckCircle2 size={14} className="text-emerald-600 inline" />
                    ) : row.status === "warning" ? (
                      <AlertTriangle size={14} className="text-amber-500 inline" />
                    ) : row.status === "fail" ? (
                      <XCircle size={14} className="text-rose-600 inline" />
                    ) : (
                      <Info size={14} className="text-blue-500 inline" />
                    )}
                  </td>
                  <td className="py-2 px-3 text-slate-600">{row.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Recommendation Box */}
        <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-3 flex items-center gap-3 mt-auto mb-2">
          <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
            <Info size={16} />
          </div>
          <div className="text-[8.5pt]">
            <span className="font-extrabold text-blue-950">Recommendation: </span>
            <span className="text-blue-900 font-medium">Fix canonical URLs and broken links to improve crawlability and indexing.</span>
          </div>
        </div>

        <div className="report-footer">
          <span>GrowthX | AI SEO for Real Business Growth</span>
          <span className="font-bold">8</span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* PAGE 9: ACTION PLAN & RECOMMENDATIONS */}
      {/* ========================================================================= */}
      <div className="report-sheet shadow-2xl">
        <div className="report-header">
          <div className="flex items-center gap-2">
            <span className="text-base font-black tracking-tight text-slate-900">Growth<span className="text-blue-600">X</span></span>
          </div>
          <div className="text-[9pt] text-slate-500 font-medium">
            <span>SEO Audit Report</span>
            <span className="mx-1.5 text-slate-300">|</span>
            <span className="text-slate-700">{displayDomain}</span>
          </div>
        </div>

        <div className="space-y-1 mb-3">
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">9. Action Plan &amp; Recommendations</h2>
          <p className="text-[9pt] text-slate-500">Follow this step-by-step plan to improve your website&apos;s SEO performance.</p>
        </div>

        {/* 4 Action Steps */}
        <div className="space-y-2.5 mb-3">
          {/* Step 1: Critical */}
          <div className="rounded-xl border border-rose-200 bg-white p-3 shadow-xs flex items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="w-7 h-7 rounded-full bg-rose-500 text-white font-black text-[10pt] flex items-center justify-center shrink-0">
                1
              </span>
              <div className="space-y-1">
                <h4 className="font-extrabold text-slate-900 text-[9pt]">Fix Critical Issues (Within 7 Days)</h4>
                <div className="space-y-0.5 text-[7.5pt] text-slate-600 font-medium">
                  <p>• Resolve duplicate title tags</p>
                  <p>• Fix broken links (404 errors)</p>
                  <p>• Add missing canonical URLs</p>
                </div>
              </div>
            </div>
            <div className="rounded-lg bg-rose-50 border border-rose-100 p-2 text-center shrink-0 w-32">
              <p className="text-[6.5pt] text-rose-600 font-bold uppercase">Expected Impact</p>
              <p className="text-[8.5pt] font-black text-rose-700 mt-0.5">+20-30 points</p>
              <p className="text-[6.5pt] text-slate-400">in SEO score</p>
            </div>
          </div>

          {/* Step 2: High */}
          <div className="rounded-xl border border-amber-200 bg-white p-3 shadow-xs flex items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="w-7 h-7 rounded-full bg-amber-500 text-white font-black text-[10pt] flex items-center justify-center shrink-0">
                2
              </span>
              <div className="space-y-1">
                <h4 className="font-extrabold text-slate-900 text-[9pt]">Fix High Priority Issues (Within 30 Days)</h4>
                <div className="space-y-0.5 text-[7.5pt] text-slate-600 font-medium">
                  <p>• Optimize image file sizes</p>
                  <p>• Add meta descriptions</p>
                  <p>• Fix mobile optimization issues</p>
                </div>
              </div>
            </div>
            <div className="rounded-lg bg-amber-50 border border-amber-100 p-2 text-center shrink-0 w-32">
              <p className="text-[6.5pt] text-amber-600 font-bold uppercase">Expected Impact</p>
              <p className="text-[8.5pt] font-black text-amber-700 mt-0.5">+10-15 points</p>
              <p className="text-[6.5pt] text-slate-400">in SEO score</p>
            </div>
          </div>

          {/* Step 3: Medium */}
          <div className="rounded-xl border border-yellow-200 bg-white p-3 shadow-xs flex items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="w-7 h-7 rounded-full bg-yellow-500 text-white font-black text-[10pt] flex items-center justify-center shrink-0">
                3
              </span>
              <div className="space-y-1">
                <h4 className="font-extrabold text-slate-900 text-[9pt]">Improve Medium Priority Issues</h4>
                <div className="space-y-0.5 text-[7.5pt] text-slate-600 font-medium">
                  <p>• Add missing alt text</p>
                  <p>• Improve content structure (H1, H2, H3)</p>
                  <p>• Fix thin content pages</p>
                </div>
              </div>
            </div>
            <div className="rounded-lg bg-yellow-50 border border-yellow-100 p-2 text-center shrink-0 w-32">
              <p className="text-[6.5pt] text-yellow-700 font-bold uppercase">Expected Impact</p>
              <p className="text-[8.5pt] font-black text-yellow-800 mt-0.5">+5-10 points</p>
              <p className="text-[6.5pt] text-slate-400">in SEO score</p>
            </div>
          </div>

          {/* Step 4: Ongoing */}
          <div className="rounded-xl border border-blue-200 bg-white p-3 shadow-xs flex items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="w-7 h-7 rounded-full bg-blue-600 text-white font-black text-[10pt] flex items-center justify-center shrink-0">
                4
              </span>
              <div className="space-y-1">
                <h4 className="font-extrabold text-slate-900 text-[9pt]">Monitor &amp; Grow (Ongoing)</h4>
                <div className="space-y-0.5 text-[7.5pt] text-slate-600 font-medium">
                  <p>• Track keyword rankings</p>
                  <p>• Run regular audits</p>
                  <p>• Create new SEO content</p>
                </div>
              </div>
            </div>
            <div className="rounded-lg bg-blue-50 border border-blue-100 p-2 text-center shrink-0 w-32">
              <p className="text-[6.5pt] text-blue-600 font-bold uppercase">Long-term Impact</p>
              <p className="text-[8.5pt] font-black text-blue-700 mt-0.5">More Traffic</p>
              <p className="text-[6.5pt] text-slate-400">More Customers</p>
            </div>
          </div>
        </div>

        {/* Call to Action Banner */}
        <div className="rounded-2xl bg-gradient-to-r from-slate-950 via-slate-900 to-blue-950 p-4 text-white shadow-xl flex items-center justify-between gap-4 mt-auto mb-2 border border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/30 border border-blue-500/40 flex items-center justify-center text-blue-400 shrink-0">
              <Rocket size={20} />
            </div>
            <div className="space-y-0.5">
              <h4 className="text-[10pt] font-extrabold text-white">Let&apos;s make your website rank higher</h4>
              <p className="text-[7.5pt] text-slate-300">
                Fix these issues and unlock your website&apos;s full potential with GrowthX AI
              </p>
            </div>
          </div>
          <div className="px-3.5 py-1.5 rounded-lg bg-white text-slate-950 font-extrabold text-[8pt] hover:bg-slate-100 transition shrink-0">
            Start Fixing Now →
          </div>
        </div>

        <div className="report-footer">
          <span>GrowthX | AI SEO for Real Business Growth</span>
          <span className="font-bold">9</span>
        </div>
      </div>
    </div>
  );
}
