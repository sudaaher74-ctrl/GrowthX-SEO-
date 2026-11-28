"use client";

import { ArrowRight, History, TrendingDown, TrendingUp } from "lucide-react";
import { cn, formatRelativeTime } from "@/lib/utils";

interface HistoryRunLite {
  id?: string;
  healthScore?: number | null;
  pagesCrawled: number;
  issuesFound: number;
  finishedAt?: string | null;
  createdAt?: string | null;
}

export function CrawlDiffRibbon({
  historyRuns,
  onJumpToIssues,
}: {
  historyRuns: HistoryRunLite[];
  onJumpToIssues?: () => void;
}) {
  if (historyRuns.length < 2) return null;

  // Runs may be oldest-first or newest-first; sort ascending by timestamp so latest is last
  const sorted = [...historyRuns].sort((a, b) => {
    const ta = new Date(a.finishedAt || a.createdAt || 0).getTime();
    const tb = new Date(b.finishedAt || b.createdAt || 0).getTime();
    return ta - tb;
  });

  const prev = sorted[sorted.length - 2];
  const curr = sorted[sorted.length - 1];

  const healthDelta =
    curr.healthScore != null && prev.healthScore != null
      ? Math.round(curr.healthScore) - Math.round(prev.healthScore)
      : null;
  const issuesDelta = curr.issuesFound - prev.issuesFound;
  const pagesDelta = curr.pagesCrawled - prev.pagesCrawled;

  return (
    <div
      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-surface-1 px-4 py-2.5 text-xs shadow-2xs"
      style={{ borderColor: "var(--border-color)" }}
    >
      <div className="flex flex-wrap items-center gap-3">
        <span className="inline-flex items-center gap-1.5 font-semibold text-brand-700">
          <History size={13} className="text-signal-400" />
          <span>Since previous audit ({formatRelativeTime(prev.finishedAt || prev.createdAt || "")}):</span>
        </span>

        {healthDelta != null && (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-mono text-[11px] font-bold",
              healthDelta > 0
                ? "bg-success-50 text-success-700 border border-success-200/70"
                : healthDelta < 0
                  ? "bg-error-50 text-error-700 border border-error-200/70"
                  : "bg-brand-100 text-brand-600",
            )}
          >
            {healthDelta > 0 ? <TrendingUp size={11} /> : healthDelta < 0 ? <TrendingDown size={11} /> : null}
            <span>Health {healthDelta > 0 ? `+${healthDelta}` : healthDelta} pts</span>
          </span>
        )}

        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-mono text-[11px] font-bold",
            issuesDelta < 0
              ? "bg-success-50 text-success-700 border border-success-200/70"
              : issuesDelta > 0
                ? "bg-error-50 text-error-700 border border-error-200/70"
                : "bg-brand-100 text-brand-600",
          )}
        >
          {issuesDelta < 0
            ? `${Math.abs(issuesDelta)} issues resolved`
            : issuesDelta > 0
              ? `+${issuesDelta} new issues`
              : "No issue change"}
        </span>

        {pagesDelta !== 0 && (
          <span className="rounded-full bg-brand-100 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-brand-700">
            {pagesDelta > 0 ? `+${pagesDelta} pages` : `${pagesDelta} pages`}
          </span>
        )}
      </div>

      {onJumpToIssues && issuesDelta > 0 && (
        <button
          type="button"
          onClick={onJumpToIssues}
          className="inline-flex items-center gap-1 font-semibold text-error-700 hover:underline cursor-pointer"
        >
          <span>Inspect Regressions</span>
          <ArrowRight size={12} />
        </button>
      )}
    </div>
  );
}
