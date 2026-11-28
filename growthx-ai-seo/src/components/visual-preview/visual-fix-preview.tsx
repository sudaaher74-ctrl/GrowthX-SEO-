"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Columns2,
  ExternalLink,
  Eye,
  Loader2,
  Monitor,
  Smartphone,
  Sparkles,
} from "lucide-react";
import { buildPatchedHtml } from "@/lib/visual-preview-patch";
import { cn } from "@/lib/utils";

type PreviewMode = "after" | "before" | "split";
type ViewportMode = "desktop" | "mobile";

export interface VisualPreviewProps {
  url: string;
  initialProposedTitle?: string | null;
  initialProposedH1?: string | null;
  initialProposedParagraph?: string | null;
  compact?: boolean;
}

interface VisualPreviewPayload {
  url: string;
  origin: string;
  originalTitle: string | null;
  originalH1: string | null;
  originalParagraph: string | null;
  missingAltCount: number;
  isJsShell: boolean;
  sanitizedHtml: string;
}

export function VisualFixPreview({
  url,
  initialProposedTitle,
  initialProposedH1,
  initialProposedParagraph,
  compact = false,
}: VisualPreviewProps) {
  const [mode, setMode] = useState<PreviewMode>("after");
  const [viewport, setViewport] = useState<ViewportMode>("desktop");
  const [proposedTitle, setProposedTitle] = useState(initialProposedTitle || "");
  const [proposedH1, setProposedH1] = useState(initialProposedH1 || "");
  const [proposedParagraph, setProposedParagraph] = useState(initialProposedParagraph || "");
  const [injectFaq, setInjectFaq] = useState(true);
  const [highlightMissingAlt, setHighlightMissingAlt] = useState(true);

  const previewQuery = useQuery({
    queryKey: ["visual-preview", url],
    queryFn: async (): Promise<VisualPreviewPayload> => {
      const res = await fetch(`/api/visual-preview?url=${encodeURIComponent(url)}`, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not load visual website preview.");
      return data as VisualPreviewPayload;
    },
    enabled: Boolean(url),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  // Pre-fill editable fields from the live website's real Title / H1 / Copy once loaded
  useEffect(() => {
    const d = previewQuery.data;
    if (!d) return;
    if (!proposedTitle && d.originalTitle) setProposedTitle(d.originalTitle);
    if (!proposedH1 && d.originalH1) setProposedH1(d.originalH1);
    if (!proposedParagraph && d.originalParagraph) setProposedParagraph(d.originalParagraph);
  }, [previewQuery.data, proposedTitle, proposedH1, proposedParagraph]);

  const data = previewQuery.data;
  const domainLabel = useMemo(() => {
    try {
      return new URL(url).hostname.replace(/^www\./i, "");
    } catch {
      return url;
    }
  }, [url]);

  const beforeHtml = useMemo(() => {
    if (!data?.sanitizedHtml) return "";
    return buildPatchedHtml(data.sanitizedHtml, "before", {
      proposedH1,
      proposedParagraph,
      injectFaq,
      highlightMissingAlt,
      domainLabel,
    });
  }, [data?.sanitizedHtml, proposedH1, proposedParagraph, injectFaq, highlightMissingAlt, domainLabel]);

  const afterHtml = useMemo(() => {
    if (!data?.sanitizedHtml) return "";
    return buildPatchedHtml(data.sanitizedHtml, "after", {
      proposedH1,
      proposedParagraph,
      injectFaq,
      highlightMissingAlt,
      domainLabel,
    });
  }, [data?.sanitizedHtml, proposedH1, proposedParagraph, injectFaq, highlightMissingAlt, domainLabel]);

  const activeTabTitle =
    mode === "before"
      ? data?.originalTitle || domainLabel
      : proposedTitle.trim() || data?.originalTitle || domainLabel;

  const titleChanged =
    Boolean(proposedTitle.trim()) && proposedTitle.trim() !== (data?.originalTitle || "").trim();

  return (
    <div className="space-y-4">
      {/* Top Studio Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-xl border border-brand-200 bg-surface-2/60 px-3.5 py-2.5">
        <div className="flex items-center gap-1 rounded-lg border border-brand-200 bg-surface-1 p-0.5">
          {[
            { id: "before" as const, label: "Before (Live)" },
            { id: "after" as const, label: "After (With Fix)" },
            { id: "split" as const, label: "Split Screen" },
          ].map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMode(m.id)}
              className={cn(
                "inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors cursor-pointer",
                mode === m.id
                  ? "bg-signal-400 text-signal-ink font-bold shadow-2xs"
                  : "text-brand-500 hover:text-brand-950",
              )}
            >
              {m.id === "split" && <Columns2 size={11} />}
              {m.id === "after" && <Sparkles size={11} />}
              {m.id === "before" && <Eye size={11} />}
              <span>{m.label}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-0.5 rounded-lg border border-brand-200 bg-surface-1 p-0.5">
            <button
              type="button"
              onClick={() => setViewport("desktop")}
              aria-label="Desktop preview"
              className={cn(
                "rounded-md p-1.5 transition-colors cursor-pointer",
                viewport === "desktop" ? "bg-brand-950 text-white" : "text-brand-500 hover:text-brand-950",
              )}
            >
              <Monitor size={12} />
            </button>
            <button
              type="button"
              onClick={() => setViewport("mobile")}
              aria-label="Mobile preview"
              className={cn(
                "rounded-md p-1.5 transition-colors cursor-pointer",
                viewport === "mobile" ? "bg-brand-950 text-white" : "text-brand-500 hover:text-brand-950",
              )}
            >
              <Smartphone size={12} />
            </button>
          </div>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-lg border border-brand-200 bg-surface-1 px-2.5 py-1.5 text-[11px] font-semibold text-brand-700 hover:bg-brand-50"
          >
            <span>Open Live</span>
            <ExternalLink size={10} />
          </a>
        </div>
      </div>

      {/* Live Inline Visual Fix Editor */}
      <div className="rounded-xl border border-brand-200 bg-surface-1 p-3.5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] font-bold uppercase tracking-wider text-brand-500">
            Live Visual Fix Editor — Edit Below &amp; Watch Your Website Update
          </p>
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <label className="inline-flex items-center gap-1.5 cursor-pointer font-medium text-brand-700">
              <input
                type="checkbox"
                checked={injectFaq}
                onChange={(e) => setInjectFaq(e.target.checked)}
                className="rounded border-brand-300"
              />
              <span>Preview Added FAQ / AI Block</span>
            </label>
            <label className="inline-flex items-center gap-1.5 cursor-pointer font-medium text-brand-700">
              <input
                type="checkbox"
                checked={highlightMissingAlt}
                onChange={(e) => setHighlightMissingAlt(e.target.checked)}
                className="rounded border-brand-300"
              />
              <span>Highlight Image Alt ({data?.missingAltCount ?? 0} missing)</span>
            </label>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <div>
            <label className="block text-[10px] font-bold uppercase text-brand-400 mb-1">
              Browser Tab / SEO Title ({proposedTitle.length}/60)
            </label>
            <input
              type="text"
              value={proposedTitle}
              onChange={(e) => setProposedTitle(e.target.value)}
              placeholder="Enter improved SEO title…"
              className="w-full rounded-lg border border-brand-200 bg-surface-2/60 px-2.5 py-1.5 text-xs text-brand-950 focus:border-brand-400 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase text-brand-400 mb-1">
              Hero H1 Heading (Swaps Live on Page)
            </label>
            <input
              type="text"
              value={proposedH1}
              onChange={(e) => setProposedH1(e.target.value)}
              placeholder="Enter improved H1 heading…"
              className="w-full rounded-lg border border-brand-200 bg-surface-2/60 px-2.5 py-1.5 text-xs text-brand-950 focus:border-brand-400 focus:outline-none"
            />
          </div>
        </div>
        {!compact && (
          <div>
            <label className="block text-[10px] font-bold uppercase text-brand-400 mb-1">
              Lead Paragraph Copy (Swaps Live on Page)
            </label>
            <textarea
              rows={2}
              value={proposedParagraph}
              onChange={(e) => setProposedParagraph(e.target.value)}
              placeholder="Enter improved intro copy…"
              className="w-full rounded-lg border border-brand-200 bg-surface-2/60 px-2.5 py-1.5 text-xs text-brand-950 focus:border-brand-400 focus:outline-none"
            />
          </div>
        )}
      </div>

      {/* Preview Canvas */}
      {previewQuery.isLoading ? (
        <div className="flex flex-col items-center justify-center gap-2.5 rounded-2xl border border-brand-200 bg-surface-1 py-16 text-xs text-brand-500">
          <Loader2 size={22} className="animate-spin text-signal-400" />
          <p className="font-semibold text-brand-800">Loading live visual snapshot of {domainLabel}…</p>
        </div>
      ) : previewQuery.error ? (
        <div className="rounded-xl border border-error-200 bg-error-50/40 p-5 text-center text-xs text-error-700">
          <AlertTriangle size={18} className="mx-auto mb-1.5" />
          <p className="font-semibold">{(previewQuery.error as Error).message}</p>
        </div>
      ) : data ? (
        <div className="space-y-2.5">
          {data.isJsShell && (
            <div className="flex items-start gap-2 rounded-xl border border-warning-200 bg-warning-50/60 px-3.5 py-2.5 text-[11.5px] text-warning-800">
              <AlertTriangle size={14} className="mt-0.5 shrink-0 text-warning-600" />
              <span>
                <strong>Client-Side SPA Detected:</strong> {domainLabel} renders its hero layout via client-side JavaScript.
                The sandboxed preview disables scripts for security; full Playwright-rendered visual snapshots activate automatically once your backend crawl snapshot is connected.
              </span>
            </div>
          )}

          {/* Realistic Browser Frame */}
          <div className={cn("grid gap-3", mode === "split" ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1")}>
            {(mode === "before" || mode === "split") && (
              <div className="overflow-hidden rounded-2xl border border-brand-200 bg-surface-1 shadow-card">
                <div className="flex items-center gap-2 border-b border-brand-200 bg-surface-2 px-3 py-2 text-[11px]">
                  <span className="rounded-md bg-warning-100 px-2 py-0.5 font-mono text-[10px] font-bold text-warning-800">
                    BEFORE
                  </span>
                  <span className="truncate font-semibold text-brand-800">
                    {data.originalTitle || domainLabel}
                  </span>
                </div>
                <div className="flex justify-center bg-brand-100/50 p-2">
                  <iframe
                    title={`Before preview of ${domainLabel}`}
                    sandbox="allow-same-origin"
                    srcDoc={beforeHtml}
                    className={cn(
                      "rounded-lg border border-brand-200 bg-white transition-all",
                      viewport === "mobile" ? "w-[390px] h-[560px]" : "w-full h-[540px]",
                    )}
                  />
                </div>
              </div>
            )}

            {(mode === "after" || mode === "split") && (
              <div className="overflow-hidden rounded-2xl border-2 border-success-500/60 bg-surface-1 shadow-card">
                <div className="flex items-center justify-between gap-2 border-b border-brand-200 bg-success-50/50 px-3 py-2 text-[11px]">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="rounded-md bg-success-600 px-2 py-0.5 font-mono text-[10px] font-bold text-white shrink-0">
                      AFTER
                    </span>
                    <span className="truncate font-bold text-brand-950">{activeTabTitle}</span>
                  </div>
                  {titleChanged && (
                    <span className="shrink-0 rounded-full bg-success-100 px-2 py-0.2 font-mono text-[9.5px] font-bold text-success-800">
                      Tab Title Updated ✓
                    </span>
                  )}
                </div>
                <div className="flex justify-center bg-brand-100/50 p-2">
                  <iframe
                    title={`After preview of ${domainLabel}`}
                    sandbox="allow-same-origin"
                    srcDoc={afterHtml}
                    className={cn(
                      "rounded-lg border border-brand-200 bg-white transition-all",
                      viewport === "mobile" ? "w-[390px] h-[560px]" : "w-full h-[540px]",
                    )}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
