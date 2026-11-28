"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, CheckSquare, Layers, Sparkles, Square, Zap } from "lucide-react";
import type { CrawlIssue } from "@/lib/api-client";
import { cn } from "@/lib/utils";

const SEVERITY_WEIGHT: Record<string, number> = {
  CRITICAL: 12,
  HIGH: 7,
  MEDIUM: 3,
  LOW: 1,
};

function humanizeIssueType(raw: string): string {
  return raw
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function RootCauseSimulator({
  issues,
  currentHealthScore,
  totalPages,
  onSelectIssueType,
}: {
  issues: CrawlIssue[];
  currentHealthScore: number | null;
  totalPages: number;
  onSelectIssueType?: (issueType: string) => void;
}) {
  const clusters = useMemo(() => {
    const map = new Map<
      string,
      {
        issueType: string;
        label: string;
        severity: string;
        count: number;
        urls: Set<string>;
        sampleRecommendation: string;
        weight: number;
      }
    >();

    for (const iss of issues) {
      const prev = map.get(iss.issueType);
      const sevW = SEVERITY_WEIGHT[iss.severity] ?? 1;
      if (prev) {
        prev.count += 1;
        if (iss.affectedUrl) prev.urls.add(iss.affectedUrl);
        prev.weight += sevW;
        if (sevW > (SEVERITY_WEIGHT[prev.severity] ?? 0)) prev.severity = iss.severity;
      } else {
        const urls = new Set<string>();
        if (iss.affectedUrl) urls.add(iss.affectedUrl);
        map.set(iss.issueType, {
          issueType: iss.issueType,
          label: humanizeIssueType(iss.issueType),
          severity: iss.severity,
          count: 1,
          urls,
          sampleRecommendation: iss.recommendation || iss.description,
          weight: sevW,
        });
      }
    }

    return Array.from(map.values())
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 6);
  }, [issues]);

  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(() => {
    // Pre-select the top 2 highest-leverage root causes to demonstrate impact immediately
    return new Set(clusters.slice(0, 2).map((c) => c.issueType));
  });

  if (clusters.length === 0) return null;

  const totalWeight = issues.reduce((sum, i) => sum + (SEVERITY_WEIGHT[i.severity] ?? 1), 0) || 1;
  const clearedWeight = clusters
    .filter((c) => selectedTypes.has(c.issueType))
    .reduce((sum, c) => sum + c.weight, 0);
  const clearedIssues = clusters
    .filter((c) => selectedTypes.has(c.issueType))
    .reduce((sum, c) => sum + c.count, 0);
  const clearedPct = Math.round((clearedIssues / Math.max(issues.length, 1)) * 100);

  const baseScore = currentHealthScore != null ? Math.round(currentHealthScore) : null;
  const maxGain = baseScore != null ? Math.max(0, 100 - baseScore) : 0;
  const projectedGain = Math.round(maxGain * (clearedWeight / totalWeight));
  const projectedScore = baseScore != null ? Math.min(100, baseScore + projectedGain) : null;

  const toggle = (issueType: string) => {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(issueType)) next.delete(issueType);
      else next.add(issueType);
      return next;
    });
  };

  return (
    <div
      className="overflow-hidden rounded-2xl border bg-surface-1 shadow-card"
      style={{ borderColor: "var(--border-color)" }}
    >
      {/* Header + Live Projected Score */}
      <div
        className="flex flex-col gap-4 border-b bg-surface-1 p-5 lg:flex-row lg:items-center lg:justify-between"
        style={{ borderColor: "var(--border-color)" }}
      >
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-signal-400 text-signal-ink font-bold shadow-2xs">
            <Layers size={18} />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[14.5px] font-bold text-brand-950">
                Root-Cause Clusters &amp; Health Score Simulator
              </h2>
              <span className="rounded-full bg-signal-400/15 border border-signal-400/30 px-2.5 py-0.5 font-mono text-[10px] font-bold text-brand-950">
                {selectedTypes.size} root causes = {clearedPct}% of issues
              </span>
            </div>
            <p className="mt-0.5 text-[11.5px] text-brand-500">
              Instead of fixing {issues.length} individual rows, check off template-level root causes below to preview your projected Health Score gain.
            </p>
          </div>
        </div>

        {/* Live Projected Health Gauge */}
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-brand-200 bg-surface-2/70 px-4 py-2.5">
          {baseScore != null && projectedScore != null ? (
            <div className="flex items-center gap-3">
              <div>
                <p className="text-[9.5px] font-bold uppercase tracking-wider text-brand-400">Current</p>
                <p className="font-mono text-lg font-bold text-brand-700">{baseScore}</p>
              </div>
              <span className="text-brand-400">→</span>
              <div>
                <p className="text-[9.5px] font-bold uppercase tracking-wider text-success-700">Projected</p>
                <div className="flex items-baseline gap-1.5">
                  <span className="font-mono text-xl font-black text-success-700">{projectedScore}</span>
                  {projectedGain > 0 && (
                    <span className="rounded-md bg-success-50 border border-success-200 px-1.5 py-0.2 font-mono text-[10px] font-bold text-success-700">
                      +{projectedGain} pts
                    </span>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-xs font-semibold text-brand-800">
              {clearedIssues} of {issues.length} issues cleared
            </div>
          )}

          <Link
            href="/fix-engine"
            className="inline-flex items-center gap-1.5 rounded-lg bg-signal-400 px-3 py-1.5 text-xs font-bold text-signal-ink hover:bg-signal-500 transition-colors shadow-2xs"
          >
            <Zap size={12} />
            <span>Fix Selected</span>
            <ArrowUpRight size={12} />
          </Link>
        </div>
      </div>

      {/* Cluster Checklist Grid */}
      <div className="grid grid-cols-1 gap-2.5 p-4 md:grid-cols-2">
        {clusters.map((c) => {
          const checked = selectedTypes.has(c.issueType);
          const isTemplate = c.urls.size >= 3 && totalPages > 0;
          return (
            <div
              key={c.issueType}
              className={cn(
                "flex items-start gap-3 rounded-xl border p-3.5 transition-all",
                checked
                  ? "border-signal-400/60 bg-signal-400/5 shadow-2xs"
                  : "border-brand-200/70 bg-surface-1 hover:border-brand-300",
              )}
            >
              <button
                type="button"
                onClick={() => toggle(c.issueType)}
                aria-label={`Simulate fixing ${c.label}`}
                className="mt-0.5 shrink-0 text-brand-700 hover:text-brand-950 cursor-pointer"
              >
                {checked ? (
                  <CheckSquare size={16} className="text-brand-950" />
                ) : (
                  <Square size={16} className="text-brand-400" />
                )}
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => onSelectIssueType?.(c.issueType)}
                    className="text-left text-xs font-bold text-brand-950 hover:underline cursor-pointer"
                  >
                    {c.label}
                  </button>
                  <span
                    className={cn(
                      "rounded-md px-1.5 py-0.2 font-mono text-[9.5px] font-bold",
                      c.severity === "CRITICAL" || c.severity === "HIGH"
                        ? "bg-error-50 text-error-700"
                        : c.severity === "MEDIUM"
                          ? "bg-warning-50 text-warning-700"
                          : "bg-brand-100 text-brand-600",
                    )}
                  >
                    {c.severity}
                  </span>
                  {isTemplate && (
                    <span className="inline-flex items-center gap-0.5 rounded-md bg-brand-100 px-1.5 py-0.2 font-mono text-[9.5px] font-semibold text-brand-700">
                      <Sparkles size={9} />
                      Template Fix
                    </span>
                  )}
                </div>
                <p className="mt-1 text-[11px] text-brand-500 line-clamp-2">{c.sampleRecommendation}</p>
                <p className="mt-1.5 font-mono text-[10.5px] font-semibold text-brand-700">
                  {c.count} occurrences across {c.urls.size} {c.urls.size === 1 ? "page" : "pages"}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
