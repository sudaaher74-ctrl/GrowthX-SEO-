"use client";

import { useState } from "react";
import { Check, ClipboardCopy, Code2, FileCode, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface VisualCodeDiffProps {
  title?: string;
  field?: string;
  file?: string;
  beforeText: string | null;
  afterText: string | null;
  verifiedLive?: boolean;
  className?: string;
}

export function VisualCodeDiff({
  title,
  field,
  file,
  beforeText,
  afterText,
  verifiedLive = true,
  className,
}: VisualCodeDiffProps) {
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState<"SPLIT" | "UNIFIED">("SPLIT");

  const cleanBefore = beforeText || "<!-- None or Not recorded -->";
  const cleanAfter = afterText || "<!-- No code change applied -->";

  const handleCopyNew = () => {
    navigator.clipboard.writeText(cleanAfter);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={cn("overflow-hidden rounded-xl border border-brand-200 bg-surface-1 shadow-2xs text-xs", className)}>
      {/* Diff Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-brand-200/80 bg-surface-2/60 px-3.5 py-2">
        <div className="flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded-md bg-signal-400 text-signal-ink font-bold shadow-2xs">
            <Code2 size={12} />
          </span>
          <span className="font-mono text-[11px] font-bold text-brand-950 truncate max-w-xs sm:max-w-md">
            {file || title || "code-revision.diff"}
          </span>
          {field && (
            <span className="rounded bg-surface-1 px-1.5 py-0.5 text-[10px] font-mono text-brand-600 border border-brand-200">
              {field}
            </span>
          )}
          {verifiedLive && (
            <span className="inline-flex items-center gap-1.5 rounded-md bg-success-50/80 text-success-700 border border-success-200 px-2 py-0.5 text-[10px] font-bold">
              <CheckCircle2 size={11} className="text-success-600" />
              Live in HTML
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* View mode toggle */}
          <div className="flex items-center rounded-lg border border-brand-200 bg-surface-1 p-0.5 text-[10.5px]">
            <button
              type="button"
              onClick={() => setViewMode("SPLIT")}
              className={cn(
                "rounded px-2 py-0.5 font-semibold transition cursor-pointer",
                viewMode === "SPLIT"
                  ? "bg-surface-2 text-brand-950 font-bold shadow-2xs"
                  : "text-brand-500 hover:text-brand-950",
              )}
            >
              Split Diff
            </button>
            <button
              type="button"
              onClick={() => setViewMode("UNIFIED")}
              className={cn(
                "rounded px-2 py-0.5 font-semibold transition cursor-pointer",
                viewMode === "UNIFIED"
                  ? "bg-surface-2 text-brand-950 font-bold shadow-2xs"
                  : "text-brand-500 hover:text-brand-950",
              )}
            >
              Unified
            </button>
          </div>

          <button
            type="button"
            onClick={handleCopyNew}
            className="inline-flex items-center gap-1 rounded-lg border border-brand-200 bg-surface-1 px-2.5 py-1 text-[11px] font-semibold text-brand-700 hover:bg-surface-2 hover:text-brand-950 transition cursor-pointer"
            title="Copy new deployed code"
          >
            {copied ? (
              <>
                <Check size={11} className="text-success-700" />
                <span className="text-success-700 font-bold">Copied</span>
              </>
            ) : (
              <>
                <ClipboardCopy size={11} />
                <span>Copy Code</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Code Viewer */}
      {viewMode === "SPLIT" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-brand-200/80 font-mono text-[11px]">
          {/* Left: Original Before */}
          <div className="space-y-1 p-3 bg-error-500/5">
            <div className="flex items-center justify-between text-[10px] uppercase tracking-wider font-bold text-error-700 mb-1.5 pb-1 border-b border-error-200/60">
              <span>Original Baseline (Removed)</span>
              <span>- 1 line</span>
            </div>
            <div className="flex items-start gap-2 text-error-800 break-all leading-relaxed">
              <span className="select-none text-error-400 font-bold shrink-0">-</span>
              <pre className="whitespace-pre-wrap font-mono text-[11.5px] leading-relaxed">
                {cleanBefore}
              </pre>
            </div>
          </div>

          {/* Right: Deployed After */}
          <div className="space-y-1 p-3 bg-success-500/5">
            <div className="flex items-center justify-between text-[10px] uppercase tracking-wider font-bold text-success-700 mb-1.5 pb-1 border-b border-success-200/60">
              <span>Verified Live HTML (Deployed)</span>
              <span>+ 1 line</span>
            </div>
            <div className="flex items-start gap-2 text-success-800 break-all leading-relaxed">
              <span className="select-none text-success-600 font-bold shrink-0">+</span>
              <pre className="whitespace-pre-wrap font-mono text-[11.5px] leading-relaxed font-semibold">
                {cleanAfter}
              </pre>
            </div>
          </div>
        </div>
      ) : (
        /* Unified Diff View */
        <div className="p-3 font-mono text-[11.5px] space-y-1 bg-surface-2/30">
          <div className="flex items-start gap-2.5 rounded px-2 py-1 bg-error-500/10 text-error-800 border-l-2 border-error-500">
            <span className="select-none text-error-400 font-bold shrink-0">- 1</span>
            <pre className="whitespace-pre-wrap leading-relaxed">{cleanBefore}</pre>
          </div>
          <div className="flex items-start gap-2.5 rounded px-2 py-1 bg-success-500/10 text-success-800 border-l-2 border-success-500 font-semibold">
            <span className="select-none text-success-600 font-bold shrink-0">+ 1</span>
            <pre className="whitespace-pre-wrap leading-relaxed">{cleanAfter}</pre>
          </div>
        </div>
      )}
    </div>
  );
}

