"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  Bot,
  Check,
  CheckCircle2,
  Code2,
  Copy,
  ExternalLink,
  Eye,
  FileCode2,
  Globe,
  Link2,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  X,
  Zap,
} from "lucide-react";
import { api, type CrawlIssue, type CrawlPage } from "@/lib/api-client";
import { VisualFixPreview } from "@/components/visual-preview/visual-fix-preview";
import { cn } from "@/lib/utils";

type XrayTab = "visual" | "preview" | "diff" | "indexability" | "schema" | "issues";

function safePath(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname + (u.search || "");
  } catch {
    return url;
  }
}

function safeHost(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

export function PageXrayDrawer({
  jobId,
  page,
  allIssues,
  onClose,
}: {
  jobId: string | null;
  page: CrawlPage | null;
  allIssues: CrawlIssue[];
  onClose: () => void;
}) {
  const [tab, setTab] = useState<XrayTab>("preview");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    setTab("preview");
  }, [page?.id]);

  useEffect(() => {
    if (!page) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [page, onClose]);

  const xrayQuery = useQuery({
    queryKey: ["page-xray", jobId, page?.id],
    queryFn: () => api.getPageXray(jobId!, page!.id),
    enabled: Boolean(jobId && page?.id),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  if (!page) return null;

  const xray = xrayQuery.data;
  const pageIssues = xray?.page.issues?.length
    ? xray.page.issues
    : allIssues.filter((i) => i.affectedUrl === page.url);
  const schemas = xray?.page.schemas ?? [];
  const statusChain = xray?.page.statusChain ?? page.statusChain ?? [];
  const indexability = xray?.page.indexability ?? page.indexability ?? "UNKNOWN";
  const indexabilityReasons = xray?.page.indexabilityReason ?? page.indexabilityReason ?? [];

  const titleLen = (page.title || "").length;
  const descLen = (page.metaDescription || "").length;

  const copyJson = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 2000);
    } catch {
      // ignore
    }
  };

  const tabs: Array<{ id: XrayTab; label: string; count?: number; icon: typeof Eye }> = [
    { id: "preview", label: "SERP & AI Preview", icon: Eye },
    { id: "visual", label: "Visual Before/After", icon: Sparkles },
    { id: "diff", label: "Raw vs JS DOM", icon: FileCode2 },
    { id: "indexability", label: "Indexability & Hops", count: statusChain.length > 1 ? statusChain.length : undefined, icon: ShieldCheck },
    { id: "schema", label: "Schema (JSON-LD)", count: schemas.length || undefined, icon: Code2 },
    { id: "issues", label: "Issues & Links", count: pageIssues.length || undefined, icon: Link2 },
  ];

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="Page X-Ray Inspector">
      <button
        type="button"
        aria-label="Close Page X-Ray"
        onClick={onClose}
        className="fixed inset-0 bg-brand-950/40 backdrop-blur-[2px]"
      />

      <div className="relative z-10 flex h-full w-full max-w-3xl flex-col border-l border-brand-200 bg-surface-1 shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-brand-200 bg-surface-1 px-6 py-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-md bg-signal-400 px-2 py-0.5 font-mono text-[10px] font-black text-signal-ink">
                PAGE X-RAY
              </span>
              <span
                className={cn(
                  "rounded-md px-2 py-0.5 font-mono text-[10.5px] font-bold",
                  page.statusCode >= 200 && page.statusCode < 300
                    ? "bg-success-50 text-success-700 border border-success-200/60"
                    : page.statusCode >= 300 && page.statusCode < 400
                      ? "bg-warning-50 text-warning-700 border border-warning-200/60"
                      : "bg-error-50 text-error-700 border border-error-200/60",
                )}
              >
                HTTP {page.statusCode || "ERR"}
              </span>
              <span
                className={cn(
                  "rounded-md px-2 py-0.5 text-[10.5px] font-semibold",
                  indexability === "INDEXABLE"
                    ? "bg-success-50 text-success-700"
                    : indexability === "NOT_INDEXABLE"
                      ? "bg-error-50 text-error-700"
                      : "bg-brand-100 text-brand-600",
                )}
              >
                {indexability === "INDEXABLE"
                  ? "Indexable"
                  : indexability === "NOT_INDEXABLE"
                    ? "Not Indexable"
                    : "Unknown"}
              </span>
              {page.jsRequired && (
                <span className="rounded-md bg-warning-50 border border-warning-200/60 px-2 py-0.5 font-mono text-[10px] font-bold text-warning-700">
                  JS Rendered
                </span>
              )}
            </div>
            <h2 className="mt-1.5 truncate text-sm font-bold text-brand-950">
              {page.title || safePath(page.url)}
            </h2>
            <a
              href={page.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-0.5 inline-flex items-center gap-1 font-mono text-[11px] text-brand-500 hover:text-brand-950 hover:underline break-all"
            >
              <span>{page.url}</span>
              <ExternalLink size={10} className="shrink-0" />
            </a>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg border border-brand-200 p-1.5 text-brand-500 hover:bg-brand-100 hover:text-brand-950 transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Sub-Navigation */}
        <div className="flex items-center gap-1 overflow-x-auto border-b border-brand-200 bg-surface-2/60 px-6 py-2">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all whitespace-nowrap cursor-pointer",
                  active
                    ? "bg-signal-400 text-signal-ink font-bold shadow-2xs"
                    : "text-brand-600 hover:bg-brand-100 hover:text-brand-950",
                )}
              >
                <Icon size={13} />
                <span>{t.label}</span>
                {t.count != null && t.count > 0 && (
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.2 font-mono text-[10px]",
                      active ? "bg-signal-ink/15 text-signal-ink" : "bg-brand-200/70 text-brand-700",
                    )}
                  >
                    {t.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto p-6 space-y-5">
          {/* ── VISUAL BEFORE / AFTER WEBSITE STUDIO ── */}
          {tab === "visual" && (
            <VisualFixPreview
              url={page.url}
              initialProposedTitle={page.title}
              initialProposedH1={page.h1?.[0] ?? null}
              initialProposedParagraph={page.metaDescription}
            />
          )}

          {/* ── TAB 1: SERP & AI PREVIEW ── */}
          {tab === "preview" && (
            <>
              {/* Quick Telemetry Strip */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl border border-brand-200 bg-surface-2/50 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-brand-400">Word Count</p>
                  <p className="mt-1 font-mono text-lg font-black text-brand-950">
                    {(page.wordCount || 0).toLocaleString()}
                  </p>
                  <p className="text-[10.5px] text-brand-500">
                    {page.wordCount < 100 ? "Thin content" : page.wordCount >= 800 ? "In-depth" : "Standard"}
                  </p>
                </div>
                <div className="rounded-xl border border-brand-200 bg-surface-2/50 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-brand-400">Click Depth</p>
                  <p className="mt-1 font-mono text-lg font-black text-brand-950">
                    {xray?.clickDepth != null ? `${xray.clickDepth} clicks` : "—"}
                  </p>
                  <p className="text-[10.5px] text-brand-500">From homepage</p>
                </div>
                <div className="rounded-xl border border-brand-200 bg-surface-2/50 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-brand-400">Link Equity</p>
                  <p className="mt-1 font-mono text-lg font-black text-brand-950">
                    {xray?.linkEquityScore != null ? xray.linkEquityScore.toFixed(2) : "—"}
                  </p>
                  <p className="text-[10.5px] text-brand-500">1.00 = site avg</p>
                </div>
                <div className="rounded-xl border border-brand-200 bg-surface-2/50 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-brand-400">Response</p>
                  <p className="mt-1 font-mono text-lg font-black text-brand-950">
                    {page.responseTimeMs ? `${page.responseTimeMs}ms` : "—"}
                  </p>
                  <p className="text-[10.5px] text-brand-500">Server TTFB</p>
                </div>
              </div>

              {/* Google SERP Preview */}
              <div className="rounded-xl border border-brand-200 bg-surface-1 p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-950">
                    <Globe size={13} className="text-brand-500" />
                    Google Search Preview
                  </span>
                  <div className="flex items-center gap-2 text-[10.5px] font-mono">
                    <span className={titleLen >= 30 && titleLen <= 60 ? "text-success-700" : "text-warning-700"}>
                      Title: {titleLen}/60 chars
                    </span>
                    <span className={descLen >= 110 && descLen <= 160 ? "text-success-700" : "text-warning-700"}>
                      Meta: {descLen}/160 chars
                    </span>
                  </div>
                </div>
                <div className="rounded-lg border border-brand-200/70 bg-surface-2/40 p-4 space-y-1">
                  <p className="text-[11px] text-brand-500 font-mono truncate">
                    {safeHost(page.url)} › {safePath(page.url).replace(/^\//, "") || "home"}
                  </p>
                  <p className="text-[16px] font-semibold text-primary-700 leading-snug">
                    {page.title || "Missing <title> tag — Google will auto-generate a title"}
                  </p>
                  <p className="text-[12.5px] text-brand-600 leading-relaxed line-clamp-2">
                    {page.metaDescription || "No meta description found — search engines will pull a random snippet from page body text."}
                  </p>
                </div>
              </div>

              {/* AI Answer Engine View */}
              <div className="rounded-xl border border-brand-200 bg-surface-1 p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-950">
                    <Bot size={13} className="text-signal-400" />
                    AI Search &amp; LLM Citation Readiness
                  </span>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-bold",
                      !page.jsRequired && schemas.length > 0 && page.wordCount >= 300
                        ? "bg-success-50 text-success-700 border border-success-200/60"
                        : "bg-warning-50 text-warning-700 border border-warning-200/60",
                    )}
                  >
                    {!page.jsRequired && schemas.length > 0 && page.wordCount >= 300
                      ? "AI-Ready"
                      : "Needs AI Optimization"}
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 text-xs">
                  <div className="rounded-lg border border-brand-100 bg-surface-2/50 p-2.5">
                    <p className="text-[10px] font-bold uppercase text-brand-400">Non-JS Visibility</p>
                    <p className="mt-0.5 font-semibold text-brand-950">
                      {page.jsRequired ? "JS Required (Risk for LLM bots)" : "Visible in Raw HTML ✓"}
                    </p>
                  </div>
                  <div className="rounded-lg border border-brand-100 bg-surface-2/50 p-2.5">
                    <p className="text-[10px] font-bold uppercase text-brand-400">Primary H1 Heading</p>
                    <p className="mt-0.5 font-semibold text-brand-950 truncate">
                      {page.h1?.[0] || "Missing H1"}
                    </p>
                  </div>
                  <div className="rounded-lg border border-brand-100 bg-surface-2/50 p-2.5">
                    <p className="text-[10px] font-bold uppercase text-brand-400">Structured Entities</p>
                    <p className="mt-0.5 font-semibold text-brand-950">
                      {schemas.length > 0 ? schemas.map((s) => s.schemaType).join(", ") : "None detected"}
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ── TAB 2: RAW HTML VS JS-RENDERED DIFF ── */}
          {tab === "diff" && (
            <div className="space-y-4">
              {xrayQuery.isLoading ? (
                <div className="flex items-center justify-center gap-2 py-12 text-xs text-brand-500">
                  <Loader2 size={15} className="animate-spin text-signal-400" />
                  <span>Comparing Raw HTTP vs JS-Rendered DOM…</span>
                </div>
              ) : !xray?.rawSummary && !xray?.renderedSummary ? (
                <div className="rounded-xl border border-brand-200 bg-surface-2/40 p-6 text-center space-y-1.5">
                  <FileCode2 size={20} className="mx-auto text-brand-400" />
                  <p className="text-xs font-bold text-brand-900">Raw &amp; Rendered HTML snapshots not stored for this URL</p>
                  <p className="text-[11px] text-brand-500 max-w-md mx-auto">
                    Reigel stores full HTML snapshots for homepage and JS-rendered pages. Re-run a crawl to capture fresh DOM diffs.
                  </p>
                </div>
              ) : (
                <div className="overflow-hidden rounded-xl border border-brand-200 bg-surface-1">
                  <div className="border-b border-brand-200 bg-surface-2/60 px-4 py-3">
                    <h3 className="text-xs font-bold text-brand-950">Raw HTTP Response vs. Browser-Rendered DOM</h3>
                    <p className="text-[11px] text-brand-500">
                      Elements that only appear in the Rendered column are invisible to non-JS AI crawlers (like GPTBot &amp; PerplexityBot).
                    </p>
                  </div>
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-brand-200 bg-brand-50/50 text-[10px] font-bold uppercase tracking-wider text-brand-400">
                      <tr>
                        <th className="px-4 py-2.5">Signal</th>
                        <th className="px-4 py-2.5">Raw HTTP HTML</th>
                        <th className="px-4 py-2.5">Rendered DOM (JS)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-brand-100">
                      {[
                        {
                          label: "Page Title",
                          raw: xray.rawSummary?.title || "—",
                          ren: xray.renderedSummary?.title ?? (page.jsRequired ? "—" : xray.rawSummary?.title || "—"),
                          note: xray.rawSummary && xray.rawSummary.titleCount > 1 ? `${xray.rawSummary.titleCount} <title> tags` : null,
                        },
                        {
                          label: "Meta Description",
                          raw: xray.rawSummary?.metaDescription || "—",
                          ren: xray.renderedSummary?.metaDescription ?? (page.jsRequired ? "—" : xray.rawSummary?.metaDescription || "—"),
                          note: xray.rawSummary && xray.rawSummary.metaDescriptionCount > 1 ? `${xray.rawSummary.metaDescriptionCount} tags` : null,
                        },
                        {
                          label: "Primary H1",
                          raw: xray.rawSummary?.h1?.[0] || "—",
                          ren: xray.renderedSummary?.h1?.[0] ?? (page.jsRequired ? "—" : xray.rawSummary?.h1?.[0] || "—"),
                          note: null,
                        },
                        {
                          label: "Canonical URL",
                          raw: xray.rawSummary?.canonicalUrl || "—",
                          ren: xray.renderedSummary?.canonicalUrl ?? (page.jsRequired ? "—" : xray.rawSummary?.canonicalUrl || "—"),
                          note: null,
                        },
                        {
                          label: "Visible Word Count",
                          raw: xray.rawSummary ? `${xray.rawSummary.wordCount.toLocaleString()} words` : "—",
                          ren: xray.renderedSummary
                            ? `${xray.renderedSummary.wordCount.toLocaleString()} words`
                            : `${(page.wordCount || 0).toLocaleString()} words`,
                          note: null,
                        },
                        {
                          label: "Internal Links",
                          raw: xray.rawSummary ? `${xray.rawSummary.internalLinksCount} links` : "—",
                          ren: xray.renderedSummary
                            ? `${xray.renderedSummary.internalLinksCount} links`
                            : xray.rawSummary
                              ? `${xray.rawSummary.internalLinksCount} links`
                              : "—",
                          note: null,
                        },
                      ].map((row) => {
                        const differs = row.raw !== row.ren;
                        return (
                          <tr key={row.label} className={differs ? "bg-warning-50/30" : ""}>
                            <td className="px-4 py-2.5 font-semibold text-brand-900 whitespace-nowrap">
                              {row.label}
                              {row.note && (
                                <span className="ml-1.5 rounded bg-error-50 px-1.5 py-0.2 font-mono text-[9.5px] font-bold text-error-700">
                                  {row.note}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-brand-600 break-words max-w-[220px]">{row.raw}</td>
                            <td className="px-4 py-2.5 text-brand-950 font-medium break-words max-w-[220px]">
                              {row.ren}
                              {differs && (
                                <span className="ml-1.5 rounded bg-warning-100 px-1 py-0.2 text-[9.5px] font-bold text-warning-800">
                                  JS Diff
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── TAB 3: INDEXABILITY & REDIRECT HOPS ── */}
          {tab === "indexability" && (
            <div className="space-y-4">
              <div className="rounded-xl border border-brand-200 bg-surface-1 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-brand-950">Indexability Verdict</h3>
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-0.5 text-[11px] font-bold",
                      indexability === "INDEXABLE"
                        ? "bg-success-50 text-success-700"
                        : indexability === "NOT_INDEXABLE"
                          ? "bg-error-50 text-error-700"
                          : "bg-brand-100 text-brand-600",
                    )}
                  >
                    {indexability}
                  </span>
                </div>
                {indexabilityReasons.length > 0 ? (
                  <ul className="space-y-2">
                    {indexabilityReasons.map((r, idx) => (
                      <li key={idx} className="flex items-start gap-2 rounded-lg border border-brand-100 bg-surface-2/60 p-2.5 text-xs">
                        <ShieldAlert size={14} className="mt-0.5 shrink-0 text-warning-600" />
                        <div>
                          <p className="font-mono text-[11px] font-bold text-brand-950">{r.code}</p>
                          <p className="text-brand-600">{r.evidence}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="flex items-center gap-1.5 text-xs text-success-700 font-medium">
                    <CheckCircle2 size={14} />
                    No blocking robots.txt, meta robots, X-Robots-Tag, or cross-canonical directives detected.
                  </p>
                )}

                <div className="grid grid-cols-1 gap-2 pt-2 border-t border-brand-100 sm:grid-cols-2 text-xs">
                  <div>
                    <p className="text-[10px] font-bold uppercase text-brand-400">Canonical Target</p>
                    <p className="mt-0.5 font-mono text-[11px] text-brand-800 break-all">
                      {page.canonicalUrl || "Not specified"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase text-brand-400">Robots Meta</p>
                    <p className="mt-0.5 font-mono text-[11px] text-brand-800">
                      {xray?.page.robotsMeta || "None (defaults to index, follow)"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Redirect Chain */}
              <div className="rounded-xl border border-brand-200 bg-surface-1 p-4 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-brand-950">
                  HTTP Status &amp; Redirect Hop Trace
                </h3>
                {statusChain.length > 0 ? (
                  <ol className="space-y-2">
                    {statusChain.map((hop, idx) => (
                      <li key={idx} className="flex items-center gap-2.5 text-xs">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 font-mono text-[10px] font-bold text-brand-800">
                          {idx + 1}
                        </span>
                        <span
                          className={cn(
                            "rounded-md px-2 py-0.5 font-mono text-[10.5px] font-bold shrink-0",
                            hop.status >= 200 && hop.status < 300
                              ? "bg-success-50 text-success-700"
                              : hop.status >= 300 && hop.status < 400
                                ? "bg-warning-50 text-warning-700"
                                : "bg-error-50 text-error-700",
                          )}
                        >
                          {hop.status}
                        </span>
                        <span className="font-mono text-[11px] text-brand-800 break-all">{hop.url}</span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="text-xs text-brand-600">
                    Direct HTTP {page.statusCode} response with no redirect hops.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* ── TAB 4: STRUCTURED DATA (JSON-LD) ── */}
          {tab === "schema" && (
            <div className="space-y-3">
              {schemas.length === 0 ? (
                <div className="rounded-xl border border-brand-200 bg-surface-2/40 p-8 text-center">
                  <Code2 size={20} className="mx-auto text-brand-400" />
                  <p className="mt-2 text-xs font-bold text-brand-900">No JSON-LD structured data detected on this page</p>
                  <p className="mt-1 text-[11px] text-brand-500">
                    Adding Schema.org markup (Product, Article, FAQPage, LocalBusiness) helps Google &amp; AI engines cite this page accurately.
                  </p>
                </div>
              ) : (
                schemas.map((s) => (
                  <div key={s.id} className="rounded-xl border border-brand-200 bg-surface-1 p-4 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="rounded-md bg-brand-100 px-2 py-0.5 font-mono text-[11px] font-bold text-brand-900">
                          {s.schemaType}
                        </span>
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[10px] font-bold",
                            s.isValid ? "bg-success-50 text-success-700" : "bg-error-50 text-error-700",
                          )}
                        >
                          {s.isValid ? "Valid" : `${s.validationErrors.length} error(s)`}
                        </span>
                      </div>
                      {s.rawJson && (
                        <button
                          type="button"
                          onClick={() => copyJson(s.rawJson!, s.id)}
                          className="inline-flex items-center gap-1 rounded-lg border border-brand-200 px-2.5 py-1 text-[11px] font-semibold text-brand-700 hover:bg-brand-50 cursor-pointer"
                        >
                          {copiedId === s.id ? <Check size={11} className="text-success-600" /> : <Copy size={11} />}
                          <span>{copiedId === s.id ? "Copied" : "Copy JSON-LD"}</span>
                        </button>
                      )}
                    </div>
                    {s.validationErrors.length > 0 && (
                      <ul className="space-y-1 text-xs text-error-700">
                        {s.validationErrors.map((err, i) => (
                          <li key={i} className="flex items-center gap-1.5">
                            <AlertTriangle size={12} />
                            <span>{err}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    {s.rawJson && (
                      <pre className="max-h-48 overflow-auto rounded-lg bg-brand-950 p-3 font-mono text-[11px] text-brand-100">
                        {s.rawJson}
                      </pre>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* ── TAB 5: PAGE ISSUES & INTERNAL LINKS ── */}
          {tab === "issues" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-brand-950">
                  Detected Issues ({pageIssues.length})
                </h3>
                <Link
                  href="/fix-engine"
                  className="inline-flex items-center gap-1 rounded-lg bg-signal-400 px-3 py-1.5 text-[11px] font-bold text-signal-ink hover:bg-signal-500 transition-colors"
                >
                  <Zap size={11} />
                  <span>Open Fix Engine</span>
                  <ArrowUpRight size={11} />
                </Link>
              </div>

              {pageIssues.length === 0 ? (
                <div className="rounded-xl border border-success-200 bg-success-50/40 p-4 text-xs font-semibold text-success-700 flex items-center gap-2">
                  <CheckCircle2 size={15} />
                  <span>Zero technical or on-page issues detected on this URL.</span>
                </div>
              ) : (
                <ul className="space-y-2">
                  {pageIssues.map((iss) => (
                    <li key={iss.id} className="rounded-xl border border-brand-200 bg-surface-1 p-3.5 space-y-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "rounded-md px-1.5 py-0.5 font-mono text-[10px] font-bold",
                            iss.severity === "CRITICAL" || iss.severity === "HIGH"
                              ? "bg-error-50 text-error-700"
                              : iss.severity === "MEDIUM"
                                ? "bg-warning-50 text-warning-700"
                                : "bg-brand-100 text-brand-600",
                          )}
                        >
                          {iss.severity}
                        </span>
                        <span className="text-xs font-bold text-brand-950">
                          {iss.issueType.replace(/_/g, " ")}
                        </span>
                      </div>
                      <p className="text-[11.5px] text-brand-600">{iss.description}</p>
                      {iss.recommendation && (
                        <p className="text-[11px] text-brand-500 flex items-start gap-1 pt-0.5">
                          <Sparkles size={11} className="mt-0.5 shrink-0 text-signal-400" />
                          <span>{iss.recommendation}</span>
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              {/* Internal Links */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-brand-200 bg-surface-1 p-4 space-y-2">
                  <h4 className="text-xs font-bold text-brand-950">
                    Incoming Internal Links ({xray?.incomingLinksCount ?? 0})
                  </h4>
                  {(xray?.incomingLinks ?? []).length === 0 ? (
                    <p className="text-[11px] text-brand-500">No incoming internal links recorded.</p>
                  ) : (
                    <ul className="space-y-1.5 max-h-48 overflow-auto">
                      {xray!.incomingLinks.map((l, i) => (
                        <li key={i} className="text-[11px] border-b border-brand-100 pb-1 last:border-0">
                          <p className="font-mono text-brand-800 truncate">{safePath(l.fromUrl)}</p>
                          {l.anchorText && <p className="text-brand-400 truncate">Anchor: &ldquo;{l.anchorText}&rdquo;</p>}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="rounded-xl border border-brand-200 bg-surface-1 p-4 space-y-2">
                  <h4 className="text-xs font-bold text-brand-950">
                    Outgoing Internal Links ({xray?.outgoingLinksCount ?? 0})
                  </h4>
                  {(xray?.outgoingLinks ?? []).length === 0 ? (
                    <p className="text-[11px] text-brand-500">No outgoing internal links recorded.</p>
                  ) : (
                    <ul className="space-y-1.5 max-h-48 overflow-auto">
                      {xray!.outgoingLinks.map((l, i) => (
                        <li key={i} className="text-[11px] border-b border-brand-100 pb-1 last:border-0 flex items-center justify-between gap-2">
                          <span className="font-mono text-brand-800 truncate">{safePath(l.targetUrl)}</span>
                          <ArrowRight size={10} className="shrink-0 text-brand-400" />
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
