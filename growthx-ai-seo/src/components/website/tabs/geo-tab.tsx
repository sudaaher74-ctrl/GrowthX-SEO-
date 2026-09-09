"use client";

import React, { useMemo } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Sparkles,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { CrawlIssue, CrawlPage } from "@/lib/api-client";

interface GeoTabProps {
  pages: CrawlPage[];
  issues: CrawlIssue[];
  onAutoFix?: (issue: CrawlIssue) => void;
}

export function GeoTab({ pages, issues, onAutoFix }: GeoTabProps) {
  // GEO & AI Overviews Readiness Metrics
  const schemaIssues = useMemo(
    () =>
      issues.filter(
        (i) =>
          (i.issueType || "").toUpperCase().includes("SCHEMA") ||
          (i.issueType || "").toUpperCase().includes("STRUCTURED")
      ),
    [issues]
  );

  const botBlockIssues = useMemo(
    () =>
      issues.filter(
        (i) =>
          (i.issueType || "").toUpperCase().includes("ROBOT") ||
          (i.issueType || "").toUpperCase().includes("NOINDEX")
      ),
    [issues]
  );

  const quotablePages = useMemo(
    () => pages.filter((p) => p.wordCount >= 350 && p.wordCount <= 3000),
    [pages]
  );
  const quotabilityScore =
    pages.length > 0 ? Math.round((quotablePages.length / pages.length) * 100) : null;

  const schemaAffectedUrls = useMemo(() => new Set(schemaIssues.map((i) => i.affectedUrl)), [schemaIssues]);
  const groundedPages = useMemo(
    () => pages.filter((p) => !schemaAffectedUrls.has(p.url)),
    [pages, schemaAffectedUrls]
  );
  const entityGroundingScore =
    pages.length > 0 ? Math.round((groundedPages.length / pages.length) * 100) : null;

  const highDensityPages = useMemo(() => pages.filter((p) => p.wordCount >= 500), [pages]);
  const dataDensityScore =
    pages.length > 0 ? Math.round((highDensityPages.length / pages.length) * 100) : null;

  const geoReadinessScore =
    quotabilityScore != null && entityGroundingScore != null && dataDensityScore != null
      ? Math.round(quotabilityScore * 0.4 + entityGroundingScore * 0.35 + dataDensityScore * 0.25)
      : null;

  const avgWordDepth =
    pages.length > 0
      ? Math.round(pages.reduce((acc, p) => acc + (p.wordCount || 0), 0) / pages.length)
      : 0;

  return (
    <div className="space-y-5">
      {/* 4 GEO KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* 1. Overall GEO Score */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
              <span>Overall GEO Score</span>
              <Sparkles size={14} className="text-purple-600" />
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                {geoReadinessScore != null ? geoReadinessScore : "—"}
              </span>
              {geoReadinessScore != null && (
                <span className="text-xs text-slate-400">/100</span>
              )}
              <span
                className={cn(
                  "rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                  geoReadinessScore != null && geoReadinessScore >= 70
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : geoReadinessScore != null && geoReadinessScore >= 45
                    ? "bg-amber-50 text-amber-700 border-amber-200"
                    : "bg-purple-50 text-purple-700 border-purple-200"
                )}
              >
                {geoReadinessScore != null && geoReadinessScore >= 70
                  ? "High Visibility"
                  : geoReadinessScore != null && geoReadinessScore >= 45
                  ? "Moderate"
                  : "Needs Optimization"}
              </span>
            </div>
          </div>
          <div className="mt-4">
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className="h-full bg-purple-600 rounded-full"
                style={{ width: `${geoReadinessScore || 0}%` }}
              />
            </div>
            <p className="mt-2 text-[11px] text-slate-500">Readiness for Google AI Overviews & ChatGPT</p>
          </div>
        </div>

        {/* 2. Direct Quotability */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
              <span>Direct Quotability</span>
              <CheckCircle2 size={14} className="text-emerald-600" />
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                {quotablePages.length}
              </span>
              <span className="text-xs text-slate-400">/ {pages.length} URLs</span>
              <span className="rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 text-[10px] font-semibold">
                {quotabilityScore != null ? `${quotabilityScore}%` : "—"}
              </span>
            </div>
          </div>
          <p className="mt-4 text-[11px] text-slate-500">
            Pages with concise definition blocks & optimal depth (350–3k words)
          </p>
        </div>

        {/* 3. Entity Schema Grounding */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
              <span>Entity Schema Grounding</span>
              <Zap size={14} className="text-amber-500" />
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                {groundedPages.length}
              </span>
              <span className="text-xs text-slate-400">/ {pages.length} URLs</span>
              <span
                className={cn(
                  "rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                  schemaIssues.length === 0
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : "bg-amber-50 text-amber-700 border-amber-200"
                )}
              >
                {schemaIssues.length === 0 ? "0 Schema Gaps" : `${schemaIssues.length} Gaps`}
              </span>
            </div>
          </div>
          <p className="mt-4 text-[11px] text-slate-500">
            JSON-LD structured data for Knowledge Graph & AI reasoning
          </p>
        </div>

        {/* 4. AI Bot Access */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
              <span>AI Crawler Access</span>
              <Activity size={14} className="text-blue-500" />
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-base font-bold text-slate-900 dark:text-white">
                {botBlockIssues.length === 0 ? "Fully Allowed" : "Partially Blocked"}
              </span>
              <span
                className={cn(
                  "rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                  botBlockIssues.length === 0
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : "bg-rose-50 text-rose-700 border-rose-200"
                )}
              >
                {botBlockIssues.length === 0 ? "GPTBot / Perplexity" : "Directive Block"}
              </span>
            </div>
          </div>
          <p className="mt-4 text-[11px] text-slate-500">
            Robots.txt directives allowing Perplexity, ClaudeBot, and GPTBot
          </p>
        </div>
      </div>

      {/* Strategic Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5">
        <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-2.5">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-purple-700 dark:text-purple-400">
            <Sparkles size={14} />
            <span>Direct Quotability Strategy</span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            Google AI Overviews and ChatGPT extract 40–50 word authoritative definitions immediately following an H2 or H3 heading.
          </p>
          <div className="rounded-lg bg-slate-50 dark:bg-slate-800 p-2.5 text-[11px] text-slate-700 dark:text-slate-300">
            <b>Recommended Action:</b> Convert lead paragraphs into structured summary answer blocks to capture Google AI Overview citations.
          </div>
        </div>

        <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-2.5">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">
            <Zap size={14} />
            <span>Entity & Knowledge Graph</span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            LLMs rely on Schema.org Organization, FAQPage, and TechArticle markup with sameAs social references to verify brand authority.
          </p>
          <div className="rounded-lg bg-slate-50 dark:bg-slate-800 p-2.5 text-[11px] text-slate-700 dark:text-slate-300">
            <b>Diagnostics:</b> {schemaIssues.length} schema gaps flagged. Ensure core pages have nested FAQ Schema and Author credentials.
          </div>
        </div>

        <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-2.5">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 size={14} />
            <span>Information Gain & Data Density</span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            Generative search engines penalize generic copy. Pages with proprietary benchmarks, comparison tables, and statistics earn 4x more citations.
          </p>
          <div className="rounded-lg bg-slate-50 dark:bg-slate-800 p-2.5 text-[11px] text-slate-700 dark:text-slate-300">
            <b>Depth Metric:</b> Average of <b>{avgWordDepth} words/page</b>. Include quantitative tables and verified performance specs.
          </div>
        </div>
      </div>

      {/* Page-by-Page Table */}
      <div className="rounded-xl border border-slate-200/80 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Page-by-Page GEO Audit & Quotability Engine</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Audit content quotability, schema grounding, and generate 1-click LLM Answer Blocks.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 text-[11px] font-semibold uppercase tracking-wider text-slate-400 bg-slate-50/50 dark:bg-slate-900/50">
                <th className="p-3 pl-4">TARGET URL & TITLE</th>
                <th className="p-3">WORD COUNT & DENSITY</th>
                <th className="p-3">QUOTABILITY STATUS</th>
                <th className="p-3">SCHEMA GROUNDING</th>
                <th className="p-3 pr-4 text-right">1-CLICK GEO ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {pages.slice(0, 20).map((page) => {
                const hasSchemaIssue = schemaIssues.some((i) => i.affectedUrl === page.url);
                const isQuotable = page.wordCount >= 350 && page.wordCount <= 3000;
                const isThin = page.wordCount < 350;

                return (
                  <tr key={page.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="p-3 pl-4 max-w-[280px]">
                      <div className="font-semibold text-slate-900 dark:text-white truncate">
                        {page.title || "Untitled Page"}
                      </div>
                      <a
                        href={page.url}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono text-[11px] text-blue-600 dark:text-blue-400 hover:underline truncate block mt-0.5"
                      >
                        {page.url}
                      </a>
                    </td>

                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-semibold text-slate-900 dark:text-white">
                          {page.wordCount.toLocaleString()} words
                        </span>
                        <span
                          className={cn(
                            "rounded-full border px-2 py-0.5 text-[10px] font-medium",
                            isThin
                              ? "bg-rose-50 text-rose-700 border-rose-200"
                              : page.wordCount > 1500
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-blue-50 text-blue-700 border-blue-200"
                          )}
                        >
                          {isThin ? "Thin Copy" : page.wordCount > 1500 ? "High Density" : "Standard"}
                        </span>
                      </div>
                    </td>

                    <td className="p-3">
                      <span
                        className={cn(
                          "rounded-full border px-2.5 py-0.5 text-[11px] font-medium",
                          isQuotable
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : isThin
                            ? "bg-rose-50 text-rose-700 border-rose-200"
                            : "bg-amber-50 text-amber-700 border-amber-200"
                        )}
                      >
                        {isQuotable ? "Quotable Answer" : isThin ? "Needs Answer Block" : "Refine Structure"}
                      </span>
                    </td>

                    <td className="p-3">
                      <div className="flex items-center gap-1.5">
                        {hasSchemaIssue ? (
                          <span className="inline-flex items-center gap-1 text-amber-600 text-[11px] font-medium">
                            <AlertTriangle size={12} /> Schema Gap Flagged
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-emerald-600 text-[11px] font-medium">
                            <CheckCircle2 size={12} /> Grounded JSON-LD
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="p-3 pr-4 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          const geoIssue: CrawlIssue = {
                            id: `geo-fix-${page.id}`,
                            issueType: "GEO_LLM_ANSWER_BLOCK",
                            severity: isThin ? "HIGH" : "MEDIUM",
                            affectedUrl: page.url,
                            description: isThin
                              ? `Page has low word depth (${page.wordCount} words) and lacks structured summary answer block for generative AI engines.`
                              : `Page copy lacks a concise 45-word definition block and embedded FAQ schema for Google AI Overviews and ChatGPT search.`,
                            recommendation:
                              "Embed a structured 45-55 word direct answer block with high information gain bullets and Schema.org FAQPage JSON-LD markup.",
                            status: "OPEN",
                            aiFixAvailable: true,
                            confidence: "CONFIRMED",
                            category: "GEO",
                          };
                          onAutoFix?.(geoIssue);
                        }}
                        className="inline-flex items-center gap-1 rounded-lg border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 hover:bg-purple-100 px-2.5 py-1 text-xs font-semibold transition-colors"
                      >
                        <Sparkles size={11} />
                        <span>Convert to Answer Block</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
