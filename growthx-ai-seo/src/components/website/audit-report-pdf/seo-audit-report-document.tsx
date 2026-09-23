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
import type { CrawlIssue, CrawlPage, IssueCounts, IssueGroup, IssueSeverity } from "@/lib/api-client";
import {
  type CheckRow,
  type ReportGroup,
  formatDate,
  homepageOf,
  mostAffectedPage,
  pageChecks,
  reportGroups,
  scoreBand,
  severityCounts,
  technicalChecks,
} from "./audit-report-data";

export interface SeoAuditReportDocumentProps {
  clientName?: string | null;
  domain?: string | null;
  crawledAt?: string | null;
  crawlDuration?: string | null;
  healthScore?: number | null;
  /** The shared counts endpoint. The issue and page lists are one page of rows, not totals. */
  counts?: IssueCounts | null;
  /** Open problems as grouped by the server, with true affected-page counts. */
  groups?: IssueGroup[] | null;
  issues: CrawlIssue[];
  pages: CrawlPage[];
  qualityDiagnostics?: {
    pagesCrawled?: number;
    durationSeconds?: number;
    issuesFound?: number;
  } | null;
}

const GLANCE_ROWS = 14;
const DETAILED_GROUPS = 3;
const AFFECTED_URL_ROWS = 8;

const SEVERITY_LABEL: Record<IssueSeverity, string> = {
  CRITICAL: "Critical",
  HIGH: "High",
  MEDIUM: "Medium",
  LOW: "Low",
};

const FIX_LABEL: Record<NonNullable<ReportGroup["fixClass"]>, string> = {
  AUTO: "Automatic",
  APPROVAL: "Review",
  MANUAL: "Manual",
};

function pillClass(severity: IssueSeverity): string {
  return severity === "CRITICAL"
    ? "report-pill report-pill-critical"
    : severity === "HIGH"
    ? "report-pill report-pill-high"
    : severity === "MEDIUM"
    ? "report-pill report-pill-medium"
    : "report-pill report-pill-low";
}

function pathOf(url: string): string {
  try {
    const u = new URL(url);
    return `${u.pathname}${u.search}` || "/";
  } catch {
    return url;
  }
}

function ToneIcon({ tone }: { tone: CheckRow["tone"] }) {
  if (tone === "pass") return <CheckCircle2 size={14} className="text-success-600 inline" />;
  if (tone === "warn") return <AlertTriangle size={14} className="text-warning-500 inline" />;
  if (tone === "fail") return <XCircle size={14} className="text-error-600 inline" />;
  return <Info size={14} className="text-accent-500 inline" />;
}

function Sheet({
  domain,
  pageNumber,
  children,
}: {
  domain: string;
  pageNumber: number;
  children: React.ReactNode;
}) {
  return (
    <div className="report-sheet shadow-2xl">
      <div className="report-header">
        <div className="flex items-center gap-2">
          <span className="text-base font-black tracking-tight text-brand-950">
            Growth<span className="text-accent-600">X</span>
          </span>
        </div>
        <div className="text-[9pt] text-brand-500 font-medium">
          <span>SEO Audit Report</span>
          <span className="mx-1.5 text-brand-300">|</span>
          <span className="text-brand-700">{domain}</span>
        </div>
      </div>
      {children}
      <div className="report-footer">
        <span>GrowthX | AI SEO for Real Business Growth</span>
        <span className="font-bold">{pageNumber}</span>
      </div>
    </div>
  );
}

function SectionTitle({ number, title, subtitle }: { number: number; title: string; subtitle?: string }) {
  return (
    <div className="space-y-1 mb-3">
      <h2 className="text-xl font-extrabold text-brand-950 tracking-tight">
        {number}. {title}
      </h2>
      {subtitle && <p className="text-[9pt] text-brand-500">{subtitle}</p>}
    </div>
  );
}

export function SeoAuditReportDocument({
  clientName,
  domain,
  crawledAt,
  crawlDuration,
  healthScore,
  counts,
  groups: serverGroups,
  issues,
  pages,
  qualityDiagnostics,
}: SeoAuditReportDocumentProps) {
  const displayDomain = domain || "Website";
  const displayName = clientName || displayDomain;
  const generatedOn = formatDate(new Date().toISOString())!;
  const crawledOn = formatDate(crawledAt ?? counts?.crawledAt ?? null);

  const score = healthScore ?? counts?.healthScore ?? null;
  const roundedScore = score != null ? Math.round(score) : null;
  const pagesCrawled = counts?.pagesCrawled ?? qualityDiagnostics?.pagesCrawled ?? (pages.length || null);
  const pagesSampled = pages.length;
  const { bySeverity, total: totalFindings, exact: countsExact } = severityCounts(counts, issues);
  const { groups, partial: groupsPartial } = reportGroups(serverGroups, issues);
  const openProblems = counts?.openGroups ?? groups.length;

  const homepage = homepageOf(pages);
  const focus = mostAffectedPage(pages, issues);
  const technical = technicalChecks(pages);
  const detailed = groups.slice(0, DETAILED_GROUPS);
  const topGroup = groups[0] ?? null;

  const sampleNote =
    pagesCrawled != null && pagesSampled > 0 && pagesSampled < pagesCrawled
      ? `Based on the ${pagesSampled} pages loaded for this report, of ${pagesCrawled} crawled.`
      : null;

  // Sections are numbered and paginated from what is actually present, so the
  // contents page cannot point at a section that was left out.
  type Section = { key: string; title: string; sheets: number };
  const sections: Section[] = [
    { key: "summary", title: "Executive Summary", sheets: 1 },
    { key: "contents", title: "Table of Contents", sheets: 1 },
    { key: "glance", title: "Issues at a Glance", sheets: 1 },
    ...(detailed.length ? [{ key: "detail", title: "Detailed Issue Analysis", sheets: detailed.length }] : []),
    ...(focus ? [{ key: "page", title: "Page-wise Audit", sheets: 1 }] : []),
    ...(technical.length ? [{ key: "technical", title: "Technical SEO Audit", sheets: 1 }] : []),
    { key: "plan", title: "Action Plan", sheets: 1 },
  ];
  const startPage: Record<string, number> = {};
  const sectionNumber: Record<string, number> = {};
  let nextPage = 2; // page 1 is the cover
  sections.forEach((s, i) => {
    startPage[s.key] = nextPage;
    sectionNumber[s.key] = i + 1;
    nextPage += s.sheets;
  });

  const bySeverityGroups = (severities: IssueSeverity[]) => groups.filter((g) => severities.includes(g.severity));
  const planSteps = [
    { tone: "error", title: "Fix critical issues first", when: "Recommended within 7 days", items: bySeverityGroups(["CRITICAL"]) },
    { tone: "warning", title: "Fix high-priority issues", when: "Recommended within 30 days", items: bySeverityGroups(["HIGH"]) },
    { tone: "accent", title: "Work through medium and low issues", when: "As capacity allows", items: bySeverityGroups(["MEDIUM", "LOW"]) },
  ].filter((step) => step.items.length > 0);

  return (
    <div id="seo-audit-report-print-container" className="flex flex-col items-center gap-6">
      {/* PAGE 1: COVER */}
      <div className="report-sheet report-sheet-cover shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/15 pb-4">
          <div className="flex items-center gap-2">
            <span className="text-xl font-black tracking-tight text-white">
              Growth<span className="text-accent-400">X</span>
            </span>
            <div className="h-4 w-px bg-white/20" />
            <span className="text-[9px] font-bold tracking-widest text-brand-300 uppercase">
              AI POWERED SEO FOR REAL BUSINESS GROWTH
            </span>
          </div>
          <div className="text-right text-[10px] font-semibold text-brand-300 tracking-wider">
            <span>SEO AUDIT REPORT</span>
            <span className="mx-2 text-white/40">|</span>
            <span>{generatedOn}</span>
          </div>
        </div>

        <div className="my-auto space-y-6">
          <div className="space-y-2">
            <h1 className="text-4xl font-extrabold tracking-tight text-white leading-tight">
              Website SEO <br />
              <span className="text-accent-400">Audit Report</span>
            </h1>
            <p className="text-sm text-brand-300 font-medium">Prepared for {displayName}</p>
          </div>

          <div className="rounded-2xl border border-white/15 bg-white/10 p-5 backdrop-blur-md shadow-2xl flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-2 flex-1 min-w-0">
              <div className="flex items-center gap-2 text-accent-400">
                <Globe size={18} />
                <span className="text-lg font-bold text-white truncate">{displayDomain}</span>
              </div>
              {crawledOn && <p className="text-xs text-brand-300">Crawled {crawledOn}</p>}
              {domain && (
                <a
                  href={`https://${domain}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-accent-400 hover:underline flex items-center gap-1 font-mono"
                >
                  <span>https://{domain}</span>
                  <ExternalLink size={10} />
                </a>
              )}
            </div>

            {/* The homepage's own title and description, as crawled. */}
            {homepage && (homepage.title || homepage.metaDescription) && (
              <div className="w-56 rounded-xl border border-brand-700 bg-brand-900 p-3 shadow-xl space-y-1 shrink-0">
                <p className="text-[8px] font-mono text-brand-400 truncate">{pathOf(homepage.url)}</p>
                {homepage.title && <p className="text-[10px] font-extrabold text-white line-clamp-2">{homepage.title}</p>}
                {homepage.metaDescription && (
                  <p className="text-[8px] text-brand-400 line-clamp-3">{homepage.metaDescription}</p>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-white p-3 text-brand-950 shadow-md flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-success-50 text-success-700 font-extrabold text-sm flex items-center justify-center shrink-0">
                {roundedScore ?? "—"}
              </div>
              <div>
                <p className="text-xs font-bold text-brand-950 leading-none">
                  {roundedScore != null ? `${roundedScore}/100` : "Not scored"}
                </p>
                <p className="text-[9.5px] font-medium text-brand-500 mt-0.5">SEO Score</p>
              </div>
            </div>

            <div className="rounded-xl bg-white p-3 text-brand-950 shadow-md flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-accent-50 text-accent-700 font-extrabold text-sm flex items-center justify-center shrink-0">
                <FileText size={18} />
              </div>
              <div>
                <p className="text-xs font-bold text-brand-950 leading-none">{pagesCrawled ?? "—"}</p>
                <p className="text-[9.5px] font-medium text-brand-500 mt-0.5">Pages Crawled</p>
              </div>
            </div>

            <div className="rounded-xl bg-white p-3 text-brand-950 shadow-md flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-warning-50 text-warning-700 font-extrabold text-sm flex items-center justify-center shrink-0">
                <Clock size={18} />
              </div>
              <div>
                <p className="text-xs font-bold text-brand-950 leading-none">{crawlDuration ?? "—"}</p>
                <p className="text-[9.5px] font-medium text-brand-500 mt-0.5">Crawl Time</p>
              </div>
            </div>
          </div>

          <div className="border-l-2 border-accent-400 pl-3 py-0.5">
            <p className="text-xs italic text-brand-200">
              &ldquo;Fix the right issues, get more traffic, more customers, and grow faster.&rdquo;
            </p>
            <p className="text-[10px] font-semibold text-accent-400 mt-0.5">— GrowthX AI</p>
          </div>
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-white/15 text-[10px] text-brand-300">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1"><BarChart3 size={12} className="text-accent-400" /> More Visibility</span>
            <span className="flex items-center gap-1"><Users size={12} className="text-success-400" /> More Customers</span>
            <span className="flex items-center gap-1"><TrendingUp size={12} className="text-warning-400" /> More Revenue</span>
          </div>
          <span className="font-bold text-white">1</span>
        </div>
      </div>

      {/* EXECUTIVE SUMMARY */}
      <Sheet domain={displayDomain} pageNumber={startPage.summary}>
        <SectionTitle
          number={sectionNumber.summary}
          title="Executive Summary"
          subtitle="A quick overview of your website's SEO health and key findings."
        />

        <div className="grid grid-cols-12 gap-3 mb-4">
          <div className="col-span-5 rounded-xl border bg-brand-50 p-4 flex flex-col items-center justify-center text-center">
            <div className="relative w-28 h-28 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="40" stroke="var(--color-brand-200)" strokeWidth="8" fill="transparent" />
                {roundedScore != null && (
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    stroke="var(--color-success-500)"
                    strokeWidth="8"
                    strokeDasharray="251.2"
                    strokeDashoffset={251.2 * (1 - roundedScore / 100)}
                    strokeLinecap="round"
                    fill="transparent"
                  />
                )}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-black text-brand-950 leading-none">{roundedScore ?? "—"}</span>
                <span className="text-[8pt] text-brand-500 font-bold">/100</span>
              </div>
            </div>
            <p className="text-[10pt] font-extrabold text-brand-950 mt-2">Overall SEO Score</p>
            <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full bg-success-50 text-success-700 text-[7.5pt] font-bold">
              {scoreBand(roundedScore)}
            </span>
          </div>

          <div className="col-span-7 grid grid-cols-2 gap-2.5">
            {(
              [
                ["CRITICAL", "border-error-400 bg-error-50", "text-error-700", "text-error-600"],
                ["HIGH", "border-warning-400 bg-warning-50", "text-warning-700", "text-warning-600"],
                ["MEDIUM", "border-warning-400 bg-warning-50", "text-warning-700", "text-warning-500"],
                ["LOW", "border-accent-400 bg-accent-50", "text-accent-700", "text-accent-600"],
              ] as const
            ).map(([sev, box, label, value]) => (
              <div key={sev} className={`rounded-xl border p-3 flex flex-col justify-between ${box}`}>
                <span className={`text-[8pt] font-bold uppercase tracking-wider ${label}`}>{SEVERITY_LABEL[sev]} Issues</span>
                <span className={`text-3xl font-black mt-2 ${value}`}>{bySeverity[sev]}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-success-400 bg-success-50 p-4 mb-4 space-y-2.5">
          <div className="flex items-center gap-2 text-success-700 font-extrabold text-[10pt]">
            <Sparkles size={16} className="text-success-600" />
            <span>Key Takeaways</span>
          </div>
          <div className="space-y-2 text-[8.5pt] text-brand-700 font-medium">
            {pagesCrawled != null && (
              <div className="flex items-start gap-2">
                <CheckCircle2 size={14} className="text-success-600 shrink-0 mt-0.5" />
                <span>
                  <strong>{pagesCrawled} pages</strong> were crawled and checked for technical, on-page and content issues.
                </span>
              </div>
            )}
            <div className="flex items-start gap-2">
              <CheckCircle2 size={14} className="text-success-600 shrink-0 mt-0.5" />
              <span>
                {totalFindings === 0 ? (
                  <>No open issues were found.</>
                ) : (
                  <>
                    We found <strong>{totalFindings}{countsExact ? "" : "+"} open findings</strong> across{" "}
                    <strong>{openProblems} distinct problems</strong>.
                  </>
                )}
              </span>
            </div>
            {topGroup && (
              <div className="flex items-start gap-2">
                <CheckCircle2 size={14} className="text-success-600 shrink-0 mt-0.5" />
                <span>
                  The top-priority problem is <strong>{topGroup.label.toLowerCase()}</strong>, affecting{" "}
                  <strong>
                    {topGroup.affectedCount} page{topGroup.affectedCount === 1 ? "" : "s"}
                  </strong>
                  .
                </span>
              </div>
            )}
            {bySeverity.CRITICAL + bySeverity.HIGH > 0 && (
              <div className="flex items-start gap-2">
                <CheckCircle2 size={14} className="text-success-600 shrink-0 mt-0.5" />
                <span>
                  Fixing the {bySeverity.CRITICAL + bySeverity.HIGH} critical and high-priority findings first addresses the
                  problems most likely to hold back rankings.
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-2 mb-2">
          <h3 className="text-[10pt] font-extrabold text-brand-950">What fixing these issues supports</h3>
          <div className="grid grid-cols-4 gap-2.5">
            {(
              [
                [BarChart3, "Search visibility"],
                [TrendingUp, "Organic traffic"],
                [Smile, "User experience"],
                [Rocket, "Conversions"],
              ] as const
            ).map(([Icon, label]) => (
              <div key={label} className="rounded-xl border bg-white p-3 text-center space-y-1.5">
                <div className="w-8 h-8 rounded-full bg-accent-50 text-accent-600 mx-auto flex items-center justify-center">
                  <Icon size={15} />
                </div>
                <p className="text-[8pt] font-bold text-brand-950">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </Sheet>

      {/* TABLE OF CONTENTS */}
      <Sheet domain={displayDomain} pageNumber={startPage.contents}>
        <SectionTitle number={sectionNumber.contents} title="Table of Contents" />
        <div className="space-y-3.5 my-auto max-w-xl mx-auto w-full px-2">
          {sections.map((s) => (
            <div key={s.key} className="flex items-center text-[9.5pt] font-semibold text-brand-800">
              <span className="w-8 font-mono text-accent-600 font-bold">
                {String(sectionNumber[s.key]).padStart(2, "0")}
              </span>
              <span className="font-bold text-brand-950">{s.title}</span>
              <div className="toc-dots" />
              <span className="font-mono text-brand-600 font-bold">{startPage[s.key]}</span>
            </div>
          ))}
        </div>
        <div className="report-quote-box mt-auto mb-4 flex items-start gap-3">
          <span className="text-3xl text-accent-500 font-serif leading-none shrink-0">&ldquo;</span>
          <div className="space-y-1">
            <p className="text-[9pt] italic font-medium text-brand-700 leading-relaxed">
              &ldquo;A well-optimized website doesn&apos;t just rank higher, it grows your business.&rdquo;
            </p>
            <p className="text-[8.5pt] font-bold text-accent-700">— GrowthX AI</p>
          </div>
        </div>
      </Sheet>

      {/* ISSUES AT A GLANCE */}
      <Sheet domain={displayDomain} pageNumber={startPage.glance}>
        <SectionTitle
          number={sectionNumber.glance}
          title="Issues at a Glance"
          subtitle={
            Math.min(groups.length, GLANCE_ROWS) < openProblems
              ? `The ${Math.min(groups.length, GLANCE_ROWS)} highest-priority of ${openProblems} open problems.`
              : "Every open problem, highest priority first."
          }
        />
        {groups.length === 0 ? (
          <div className="rounded-xl border bg-success-50 p-6 text-center text-[9pt] font-semibold text-success-700">
            No open issues were found in this crawl.
          </div>
        ) : (
          <div className="rounded-xl border overflow-hidden mb-3">
            <table className="w-full text-left border-collapse text-[8pt]">
              <thead className="bg-brand-50 border-b font-bold text-brand-700 uppercase tracking-wider text-[7pt]">
                <tr>
                  <th className="py-2.5 px-3">#</th>
                  <th className="py-2.5 px-3">Issue</th>
                  <th className="py-2.5 px-3">Severity</th>
                  <th className="py-2.5 px-3 text-center">Affected Pages</th>
                  <th className="py-2.5 px-3 text-center">Fix</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {groups.slice(0, GLANCE_ROWS).map((g, index) => (
                  <tr key={g.issueType}>
                    <td className="py-2 px-3 font-mono font-semibold text-brand-500">{String(index + 1).padStart(2, "0")}</td>
                    <td className="py-2 px-3 font-bold text-brand-950">{g.label}</td>
                    <td className="py-2 px-3">
                      <span className={pillClass(g.severity)}>{SEVERITY_LABEL[g.severity]}</span>
                    </td>
                    <td className="py-2 px-3 text-center font-bold text-brand-800">
                      {g.affectedCount}
                      {groupsPartial ? "+" : ""}
                    </td>
                    <td className="py-2 px-3 text-center text-brand-600">{g.fixClass ? FIX_LABEL[g.fixClass] : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {groupsPartial && groups.length > 0 && (
          <p className="text-[7.5pt] text-brand-500 mb-2">
            Affected-page counts are from the findings loaded for this report and may be higher across the whole site.
          </p>
        )}
        <div className="rounded-xl border border-warning-400 bg-warning-50 p-3 flex items-center gap-3 mt-auto mb-2">
          <div className="w-8 h-8 rounded-full bg-warning-400 text-white flex items-center justify-center shrink-0">
            <Lightbulb size={16} />
          </div>
          <div className="text-[8.5pt]">
            <span className="font-extrabold text-warning-700">Pro Tip: </span>
            <span className="text-warning-700 font-medium">Fix the critical issues first. They have the biggest impact on your rankings.</span>
          </div>
        </div>
      </Sheet>

      {/* DETAILED ISSUE ANALYSIS — one sheet per top problem */}
      {detailed.map((g, i) => {
        const example = g.example;
        const titleByUrl = new Map(pages.map((p) => [p.url.replace(/\/+$/, ""), p.title]));
        return (
          <Sheet key={g.issueType} domain={displayDomain} pageNumber={startPage.detail + i}>
            <SectionTitle
              number={sectionNumber.detail}
              title={i === 0 ? "Detailed Issue Analysis" : "Detailed Issue Analysis (continued)"}
              subtitle={i === 0 ? "What each top problem is, why it matters, and where it appears." : undefined}
            />

            <div className="rounded-xl border bg-brand-50 p-4 space-y-3 mb-3">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-brand-900 text-white text-[8pt] font-mono font-bold">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className={pillClass(g.severity)}>{SEVERITY_LABEL[g.severity]}</span>
              </div>
              <div className="space-y-0.5">
                <h3 className="text-lg font-black text-brand-950">{g.label}</h3>
                {example?.description && <p className="text-[8.5pt] text-brand-600 font-medium">{example.description}</p>}
              </div>
              <div className="grid grid-cols-3 gap-2 pt-1 border-t text-center text-[8pt]">
                <div className="p-2 rounded-lg bg-white border">
                  <p className="text-[7pt] text-brand-400 font-bold uppercase">Affected Pages</p>
                  <p className="text-sm font-black text-brand-950">
                    {g.affectedCount}
                    {groupsPartial ? "+" : ""}
                  </p>
                </div>
                <div className="p-2 rounded-lg bg-white border">
                  <p className="text-[7pt] text-brand-400 font-bold uppercase">Confidence</p>
                  <p className="text-sm font-black text-brand-950">
                    {g.confidence ? g.confidence.charAt(0) + g.confidence.slice(1).toLowerCase() : "—"}
                  </p>
                </div>
                <div className="p-2 rounded-lg bg-white border">
                  <p className="text-[7pt] text-brand-400 font-bold uppercase">Fix</p>
                  <p className="text-sm font-black text-brand-950">{g.fixClass ? FIX_LABEL[g.fixClass] : "—"}</p>
                </div>
              </div>
            </div>

            <div className="space-y-3 mb-3 text-[8.5pt]">
              {example?.explanation && (
                <div className="space-y-1">
                  <h4 className="font-extrabold text-brand-950 text-[9pt]">Why does this matter?</h4>
                  <p className="text-brand-600 leading-relaxed font-medium">{example.explanation}</p>
                </div>
              )}
              {example?.impact && (
                <div className="space-y-1">
                  <h4 className="font-extrabold text-brand-950 text-[9pt]">What it costs you</h4>
                  <p className="text-brand-600 leading-relaxed font-medium">{example.impact}</p>
                </div>
              )}
              {example?.evidence && (
                <div className="space-y-1">
                  <h4 className="font-extrabold text-brand-950 text-[9pt]">Evidence from your website</h4>
                  <p className="rounded-lg border bg-white p-2 font-mono text-[7.5pt] text-brand-700 break-words line-clamp-3">
                    {example.evidence}
                  </p>
                </div>
              )}
            </div>

            {g.sampleUrls.length > 0 && (
              <div className="space-y-1.5 mb-3">
                <h4 className="font-extrabold text-brand-950 text-[9pt]">
                  Affected URLs{g.affectedCount > g.sampleUrls.length ? ` (${g.sampleUrls.slice(0, AFFECTED_URL_ROWS).length} of ${g.affectedCount})` : ""}
                </h4>
                <div className="rounded-xl border overflow-hidden">
                  <table className="w-full text-left border-collapse text-[7.5pt]">
                    <thead className="bg-brand-50 border-b font-bold text-brand-700 uppercase tracking-wider text-[7pt]">
                      <tr>
                        <th className="py-2 px-3">URL</th>
                        <th className="py-2 px-3">Page Title</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y font-medium">
                      {g.sampleUrls.slice(0, AFFECTED_URL_ROWS).map((url) => (
                        <tr key={url}>
                          <td className="py-1.5 px-3 font-mono text-accent-600 truncate max-w-xs">{pathOf(url)}</td>
                          <td className="py-1.5 px-3 text-brand-700 font-semibold truncate max-w-xs">
                            {titleByUrl.get(url.replace(/\/+$/, "")) ?? "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {example?.recommendation && (
              <div className="rounded-xl border border-accent-400 bg-accent-50 p-3 mt-auto mb-2 text-[8.5pt]">
                <span className="font-extrabold text-accent-700">Recommended fix: </span>
                <span className="text-brand-800 font-medium">{example.recommendation}</span>
              </div>
            )}
          </Sheet>
        );
      })}

      {/* PAGE-WISE AUDIT — the crawled page with the most findings */}
      {focus && (
        <Sheet domain={displayDomain} pageNumber={startPage.page}>
          <SectionTitle
            number={sectionNumber.page}
            title="Page-wise Audit"
            subtitle="The crawled page with the most open findings, checked against the audit's own thresholds."
          />

          <div className="flex items-center justify-between p-2.5 rounded-xl bg-brand-100 border mb-3">
            <div className="flex items-center gap-1.5 font-mono font-bold text-brand-800 text-[9pt] min-w-0">
              <span className="truncate">{pathOf(focus.page.url)}</span>
              <ExternalLink size={12} className="text-brand-400 shrink-0" />
            </div>
            <span className="px-2.5 py-0.5 rounded-full bg-white text-brand-800 text-[8pt] font-black border shrink-0">
              HTTP {focus.page.statusCode} · {focus.issues.length} finding{focus.issues.length === 1 ? "" : "s"}
            </span>
          </div>

          <div className="grid grid-cols-12 gap-3 mb-3">
            {/* How the page appears in search, from its own tags */}
            <div className="col-span-5 rounded-xl border bg-white p-3 space-y-1.5">
              <p className="text-[7pt] text-brand-400 font-bold uppercase">Search result preview</p>
              <p className="text-[7pt] text-brand-500 font-mono truncate">
                {displayDomain}
                {pathOf(focus.page.url)}
              </p>
              <p className="text-[9pt] font-bold text-accent-700 line-clamp-2">{focus.page.title || "(no title tag)"}</p>
              <p className="text-[7.5pt] text-brand-600 leading-snug line-clamp-4">
                {focus.page.metaDescription || "(no meta description — search engines choose their own snippet)"}
              </p>
            </div>

            <div className="col-span-7 rounded-xl border overflow-hidden">
              <table className="w-full text-left border-collapse text-[7.5pt]">
                <thead className="bg-brand-50 border-b font-bold text-brand-700 uppercase tracking-wider text-[7pt]">
                  <tr>
                    <th className="py-1.5 px-3">Check</th>
                    <th className="py-1.5 px-3 text-center">Status</th>
                    <th className="py-1.5 px-3">Measured</th>
                  </tr>
                </thead>
                <tbody className="divide-y font-medium">
                  {pageChecks(focus.page).map((row) => (
                    <tr key={row.check}>
                      <td className="py-1.5 px-3 font-semibold text-brand-800">{row.check}</td>
                      <td className="py-1.5 px-3 text-center">
                        <ToneIcon tone={row.tone} />
                      </td>
                      <td className="py-1.5 px-3 text-brand-600">{row.detail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {focus.issues.length > 0 && (
            <div className="rounded-xl border border-error-400 bg-error-50 p-3 space-y-2 mt-auto mb-2">
              <h4 className="text-[8.5pt] font-extrabold text-error-700">Findings on this page and how to fix them</h4>
              <div className="space-y-1.5 text-[8pt] font-medium text-brand-700">
                {focus.issues.slice(0, 6).map((issue) => (
                  <div key={issue.id} className="flex items-start gap-2">
                    <span className={`${pillClass(issue.severity)} shrink-0`}>{SEVERITY_LABEL[issue.severity]}</span>
                    <span>
                      <strong>{issue.description}</strong>
                      {issue.recommendation ? ` — ${issue.recommendation}` : ""}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Sheet>
      )}

      {/* TECHNICAL SEO AUDIT — computed from the crawled pages */}
      {technical.length > 0 && (
        <Sheet domain={displayDomain} pageNumber={startPage.technical}>
          <SectionTitle
            number={sectionNumber.technical}
            title="Technical SEO Audit"
            subtitle={sampleNote ?? "Measured across every crawled page."}
          />
          <div className="rounded-xl border overflow-hidden mb-3">
            <table className="w-full text-left border-collapse text-[7.5pt]">
              <thead className="bg-brand-50 border-b font-bold text-brand-700 uppercase tracking-wider text-[7pt]">
                <tr>
                  <th className="py-2 px-3">Check</th>
                  <th className="py-2 px-3 text-center">Status</th>
                  <th className="py-2 px-3">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y font-medium">
                {technical.map((row) => (
                  <tr key={row.check}>
                    <td className="py-2 px-3 font-bold text-brand-800">{row.check}</td>
                    <td className="py-2 px-3 text-center">
                      <ToneIcon tone={row.tone} />
                    </td>
                    <td className="py-2 px-3 text-brand-600">{row.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Sheet>
      )}

      {/* ACTION PLAN — built from the open problems */}
      <Sheet domain={displayDomain} pageNumber={startPage.plan}>
        <SectionTitle
          number={sectionNumber.plan}
          title="Action Plan"
          subtitle="Your open problems, in the order we recommend fixing them."
        />
        <div className="space-y-2.5 mb-3">
          {planSteps.length === 0 && (
            <div className="rounded-xl border bg-success-50 p-4 text-[9pt] font-semibold text-success-700">
              No open issues to fix. Keep auditing regularly to catch regressions early.
            </div>
          )}
          {planSteps.map((step, i) => {
            const findings = step.items.reduce((sum, g) => sum + g.affectedCount, 0);
            const ring =
              step.tone === "error" ? "border-error-400" : step.tone === "warning" ? "border-warning-400" : "border-accent-400";
            const dot = step.tone === "error" ? "bg-error-500" : step.tone === "warning" ? "bg-warning-500" : "bg-accent-600";
            return (
              <div key={step.title} className={`rounded-xl border bg-white p-3 flex items-center justify-between gap-4 ${ring}`}>
                <div className="flex items-start gap-3 min-w-0">
                  <span className={`w-7 h-7 rounded-full text-white font-black text-[10pt] flex items-center justify-center shrink-0 ${dot}`}>
                    {i + 1}
                  </span>
                  <div className="space-y-1 min-w-0">
                    <h4 className="font-extrabold text-brand-950 text-[9pt]">
                      {step.title} <span className="font-medium text-brand-500">· {step.when}</span>
                    </h4>
                    <div className="space-y-0.5 text-[7.5pt] text-brand-600 font-medium">
                      {step.items.slice(0, 4).map((g) => (
                        <p key={g.issueType}>
                          • {g.label} ({g.affectedCount}
                          {groupsPartial ? "+" : ""} page{g.affectedCount === 1 ? "" : "s"})
                        </p>
                      ))}
                      {step.items.length > 4 && <p>• and {step.items.length - 4} more</p>}
                    </div>
                  </div>
                </div>
                <div className="rounded-lg bg-brand-50 border p-2 text-center shrink-0 w-28">
                  <p className="text-[6.5pt] text-brand-500 font-bold uppercase">Affected pages</p>
                  <p className="text-[10pt] font-black text-brand-950 mt-0.5">
                    {findings}
                    {groupsPartial ? "+" : ""}
                  </p>
                </div>
              </div>
            );
          })}
          <div className="rounded-xl border bg-white p-3 flex items-start gap-3">
            <span className="w-7 h-7 rounded-full bg-brand-900 text-white font-black text-[10pt] flex items-center justify-center shrink-0">
              {planSteps.length + 1}
            </span>
            <div className="space-y-0.5 text-[7.5pt] text-brand-600 font-medium">
              <h4 className="font-extrabold text-brand-950 text-[9pt]">Monitor and re-audit</h4>
              <p>• Re-crawl after each round of fixes to confirm they held</p>
              <p>• Track rankings and Search Console impressions for the fixed pages</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-brand-950 p-4 text-white shadow-xl flex items-center justify-between gap-4 mt-auto mb-2 border border-brand-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent-600/30 border border-accent-500/40 flex items-center justify-center text-accent-400 shrink-0">
              <Rocket size={20} />
            </div>
            <div className="space-y-0.5">
              <h4 className="text-[10pt] font-extrabold text-white">Let&apos;s make your website rank higher</h4>
              <p className="text-[7.5pt] text-brand-300">Fix these issues and unlock your website&apos;s full potential with GrowthX AI</p>
            </div>
          </div>
        </div>
      </Sheet>
    </div>
  );
}
