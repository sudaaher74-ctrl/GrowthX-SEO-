"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Copy, ExternalLink, X } from "lucide-react";
import { api, type CrawlIssue, type CrawlPage, type IssueSeverity } from "@/lib/api-client";
import { VisualFixPreview } from "@/components/visual-preview/visual-fix-preview";
import { SEVERITY_PLAIN, humanizeIssue } from "@/lib/plain-language";
import { cn } from "@/lib/utils";

type DrawerTab = "overview" | "visual";

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
  const [tab, setTab] = useState<DrawerTab>("overview");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    setTab("overview");
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

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-label="Page Inspector"
    >
      <button
        type="button"
        aria-label="Close page inspector"
        onClick={onClose}
        className="fixed inset-0 bg-brand-950/40 backdrop-blur-[2px]"
      />

      <div className="relative z-10 flex h-full w-full max-w-3xl flex-col border-l border-brand-200 bg-surface-1 shadow-2xl">
        {/* Clean Header */}
        <div className="flex items-start justify-between gap-4 border-b border-brand-200 bg-surface-1 px-6 py-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
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
            </div>
            <h2 className="mt-1.5 truncate text-base font-bold text-brand-950">
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

        {/* Clean 2-Tab Bar (Zero clipping, zero icon clutter) */}
        <div className="border-b border-brand-200 bg-surface-2/60 px-6 py-2.5">
          <div className="inline-flex items-center gap-1 rounded-xl border border-brand-200/80 bg-surface-1 p-1">
            <button
              type="button"
              onClick={() => setTab("overview")}
              className={cn(
                "rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all whitespace-nowrap cursor-pointer",
                tab === "overview"
                  ? "bg-signal-400 text-signal-ink font-bold shadow-2xs"
                  : "text-brand-600 hover:text-brand-950",
              )}
            >
              Page Overview
              {pageIssues.length > 0 && (
                <span
                  className={cn(
                    "ml-1.5 rounded-full px-1.5 py-0.2 font-mono text-[10px]",
                    tab === "overview"
                      ? "bg-signal-ink/15 text-signal-ink"
                      : "bg-brand-100 text-brand-700",
                  )}
                >
                  {pageIssues.length}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setTab("visual")}
              className={cn(
                "rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all whitespace-nowrap cursor-pointer",
                tab === "visual"
                  ? "bg-signal-400 text-signal-ink font-bold shadow-2xs"
                  : "text-brand-600 hover:text-brand-950",
              )}
            >
              Visual Before/After
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto p-6 space-y-5">
          {tab === "visual" && (
            <VisualFixPreview
              url={page.url}
              initialProposedTitle={page.title}
              initialProposedH1={page.h1?.[0] ?? null}
              initialProposedParagraph={page.metaDescription}
            />
          )}

          {tab === "overview" && (
            <>
              {/* Compact 3-Stat Strip (Real Measured Values Only) */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl border border-brand-200/80 bg-surface-1 p-3.5">
                  <p className="text-[10.5px] font-semibold uppercase tracking-wider text-brand-400">
                    Word Count
                  </p>
                  <p className="mt-1 font-mono text-lg font-bold text-brand-950">
                    {page.wordCount.toLocaleString()}
                  </p>
                </div>
                <div className="rounded-xl border border-brand-200/80 bg-surface-1 p-3.5">
                  <p className="text-[10.5px] font-semibold uppercase tracking-wider text-brand-400">
                    Response Time
                  </p>
                  <p className="mt-1 font-mono text-lg font-bold text-brand-950">
                    {page.responseTimeMs != null ? `${Math.round(page.responseTimeMs)}ms` : "—"}
                  </p>
                </div>
                <div className="rounded-xl border border-brand-200/80 bg-surface-1 p-3.5 min-w-0">
                  <p className="text-[10.5px] font-semibold uppercase tracking-wider text-brand-400">
                    Primary H1
                  </p>
                  <p
                    className="mt-1 truncate text-xs font-semibold text-brand-950"
                    title={page.h1?.[0] || "Missing H1"}
                  >
                    {page.h1?.[0] || "Missing H1"}
                  </p>
                </div>
              </div>

              {/* Google Search Preview */}
              <div className="rounded-xl border border-brand-200 bg-surface-1 p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-xs font-bold text-brand-950">Google Search Preview</h3>
                  <span className="font-mono text-[10.5px] text-brand-500">
                    Title {titleLen}/60 · Meta {descLen}/160
                  </span>
                </div>
                <div className="rounded-lg border border-brand-100 bg-surface-2/40 p-3.5 space-y-1">
                  <p className="truncate font-mono text-[11px] text-brand-500">
                    {safeHost(page.url)} › {safePath(page.url).replace(/^\//, "") || "home"}
                  </p>
                  <p className="text-[15px] font-semibold text-primary-700 leading-snug">
                    {page.title || "Missing title tag"}
                  </p>
                  <p className="text-xs text-brand-600 leading-relaxed line-clamp-2">
                    {page.metaDescription || "No meta description set for this page."}
                  </p>
                </div>
              </div>

              {/* Blocking / Redirect Notice (Only shown when relevant) */}
              {(indexabilityReasons.length > 0 || statusChain.length > 1) && (
                <div className="rounded-xl border border-brand-200 bg-surface-1 p-4 space-y-3">
                  <h3 className="text-xs font-bold text-brand-950">
                    Indexability &amp; Redirects
                  </h3>
                  {indexabilityReasons.length > 0 && (
                    <ul className="space-y-1 text-xs text-error-700">
                      {indexabilityReasons.map((reason, idx) => (
                        <li key={idx}>
                          • {typeof reason === "string" ? reason : `${reason.code}: ${reason.evidence}`}
                        </li>
                      ))}
                    </ul>
                  )}
                  {statusChain.length > 1 && (
                    <ol className="space-y-1.5">
                      {statusChain.map((hop, idx) => (
                        <li
                          key={idx}
                          className="flex items-center gap-2 text-xs font-mono text-brand-700"
                        >
                          <span className="text-brand-400">{idx + 1}.</span>
                          <span className="rounded bg-brand-100 px-1.5 py-0.5 text-[10.5px] font-bold text-brand-800">
                            {hop.status}
                          </span>
                          <span className="truncate">{hop.url}</span>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              )}

              {/* Page Issues (Only shown when issues exist on this URL) */}
              {pageIssues.length > 0 && (
                <div className="space-y-2.5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-brand-500">
                    Issues on This Page ({pageIssues.length})
                  </h3>
                  <ul className="space-y-2">
                    {pageIssues.map((iss) => {
                      const plain = humanizeIssue(iss.issueType);
                      const sev = SEVERITY_PLAIN[iss.severity as IssueSeverity] ?? SEVERITY_PLAIN.LOW;
                      return (
                        <li
                          key={iss.id}
                          className="rounded-xl border border-brand-200 bg-surface-1 p-3.5 space-y-1"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={cn(
                                "rounded-md px-1.5 py-0.5 text-[10px] font-semibold",
                                iss.severity === "CRITICAL" || iss.severity === "HIGH"
                                  ? "bg-error-50 text-error-700"
                                  : iss.severity === "MEDIUM"
                                    ? "bg-warning-50 text-warning-700"
                                    : "bg-brand-100 text-brand-600",
                              )}
                            >
                              {sev.label}
                            </span>
                            <span className="text-xs font-bold text-brand-950">
                              {plain.title}
                            </span>
                            <span className="text-[10.5px] text-brand-400">
                              · {plain.impactTag}
                            </span>
                          </div>
                          <p className="text-xs text-brand-600">{iss.description}</p>
                          {iss.recommendation && (
                            <p className="pt-0.5 text-[11.5px] text-brand-500">
                              How to fix: {iss.recommendation}
                            </p>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {/* Detected Schema (Only shown when JSON-LD actually exists) */}
              {schemas.length > 0 && (
                <div className="space-y-2.5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-brand-500">
                    Structured Data ({schemas.length})
                  </h3>
                  {schemas.map((s) => (
                    <div
                      key={s.id}
                      className="rounded-xl border border-brand-200 bg-surface-1 p-3.5 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="rounded-md bg-brand-100 px-2 py-0.5 font-mono text-[11px] font-bold text-brand-900">
                            {s.schemaType}
                          </span>
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-[10px] font-bold",
                              s.isValid
                                ? "bg-success-50 text-success-700"
                                : "bg-error-50 text-error-700",
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
                            {copiedId === s.id ? (
                              <Check size={11} className="text-success-600" />
                            ) : (
                              <Copy size={11} />
                            )}
                            <span>{copiedId === s.id ? "Copied" : "Copy"}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
