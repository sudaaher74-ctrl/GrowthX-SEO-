"use client";

import React, { useMemo } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Compass,
  ExternalLink,
  Globe,
  Layers,
  Lightbulb,
  Shield,
  Sparkles,
  Zap,
} from "lucide-react";
import { cn, formatRelativeTime } from "@/lib/utils";
import type { CrawlIssue, CrawlJob, CrawlPage } from "@/lib/api-client";
import { DonutChart } from "../donut-chart";
import { GaugeScore } from "../gauge-score";
import type { WebsiteTabId } from "@/components/website/tabs/tab-id";

interface OverviewTabProps {
  crawl: CrawlJob | null;
  issues: CrawlIssue[];
  pages: CrawlPage[];
  onSwitchTab: (tab: WebsiteTabId) => void;
  onFixIssue: (issue: CrawlIssue) => void;
}

export function OverviewTab({
  crawl,
  issues,
  pages,
  onSwitchTab,
  onFixIssue,
}: OverviewTabProps) {
  const healthScore = crawl?.healthScore != null ? Math.round(crawl.healthScore) : null;
  const criticalCount = issues.filter((i) => i.severity === "CRITICAL").length;
  const highCount = issues.filter((i) => i.severity === "HIGH").length;
  const mediumCount = issues.filter((i) => i.severity === "MEDIUM").length;
  const lowCount = issues.filter((i) => i.severity === "LOW").length;

  const severityDonut = [
    { label: "Critical", value: criticalCount, color: "#ef4444" },
    { label: "High", value: highCount, color: "#f97316" },
    { label: "Medium", value: mediumCount, color: "#3b82f6" },
    { label: "Low", value: lowCount, color: "#94a3b8" },
  ];

  const brokenPages = pages.filter((p) => p.statusCode >= 400).length;

  return (
    <div className="space-y-5">
      {/* Overview Top Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Health */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <Shield size={14} className="text-blue-600" />
              <span>Audit Health Score</span>
            </div>
            <span
              className={cn(
                "rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                healthScore == null
                  ? "bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-800"
                  : healthScore >= 80
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/50"
                  : healthScore >= 50
                  ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/50"
                  : "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800/50"
              )}
            >
              {healthScore == null
                ? "Not Analyzed"
                : healthScore >= 80
                ? "Good"
                : healthScore >= 50
                ? "Fair"
                : "Action Needed"}
            </span>
          </div>
          <GaugeScore
            score={healthScore}
            statusText={
              healthScore == null
                ? "Not Analyzed"
                : healthScore >= 80
                ? "Good"
                : healthScore >= 50
                ? "Fair"
                : "Action Needed"
            }
            statusTone={
              healthScore == null ? "info" : healthScore >= 80 ? "good" : healthScore >= 50 ? "warn" : "bad"
            }
            showBadge={false}
            description="Overall SEO health across crawled pages."
            buttonText="Technical Details"
            onButtonClick={() => onSwitchTab("technical-seo")}
          />
        </div>

        {/* Crawled Pages */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              <div className="flex items-center gap-1.5">
                <Globe size={14} className="text-blue-600" />
                <span>Pages Crawled</span>
              </div>
            </div>
            <div className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-1">
              {pages.length.toLocaleString()}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {brokenPages > 0 ? (
                <span className="text-rose-600 font-semibold">{brokenPages} broken pages</span>
              ) : (
                "All pages reachable"
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onSwitchTab("pages")}
            className="mt-4 text-xs font-semibold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1"
          >
            <span>Explore all pages</span>
            <ArrowRight size={12} />
          </button>
        </div>

        {/* Open Issues */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              <div className="flex items-center gap-1.5">
                <AlertTriangle size={14} className="text-amber-500" />
                <span>Open Issues</span>
              </div>
            </div>
            <div className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-1">
              {issues.length.toLocaleString()}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {criticalCount > 0 ? (
                <span className="text-rose-600 font-semibold">{criticalCount} critical issues</span>
              ) : (
                "0 critical issues"
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onSwitchTab("issues")}
            className="mt-4 text-xs font-semibold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1"
          >
            <span>View all issues</span>
            <ArrowRight size={12} />
          </button>
        </div>

        {/* Performance Overview */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              <div className="flex items-center gap-1.5">
                <Activity size={14} className="text-blue-600" />
                <span>Core Web Vitals</span>
              </div>
            </div>
            <div className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-1">
              {pages.length > 0 ? "Analyzed" : "—"}
            </div>
            <p className="text-xs text-slate-500 mt-1">LCP, INP, and CLS performance metrics.</p>
          </div>
          <button
            type="button"
            onClick={() => onSwitchTab("performance")}
            className="mt-4 text-xs font-semibold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1"
          >
            <span>View performance</span>
            <ArrowRight size={12} />
          </button>
        </div>
      </div>

      {/* Middle Overview row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
        {/* Issue Distribution */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">Issue Breakdown by Severity</h3>
          <div className="flex items-center justify-center py-2">
            <DonutChart
              data={severityDonut}
              centerValue={issues.length}
              centerLabel="Total Issues"
              size={140}
              thickness={20}
            />
          </div>
        </div>

        {/* High Priority Actions */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-sm font-bold text-slate-900 dark:text-white mb-3">
              <Sparkles size={16} className="text-blue-600" />
              <span>Highest Priority Remediations</span>
            </div>

            {issues.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">No open issues requiring action.</p>
            ) : (
              <div className="space-y-2">
                {issues
                  .filter((i) => i.severity === "CRITICAL" || i.severity === "HIGH")
                  .slice(0, 4)
                  .map((issue) => (
                    <div
                      key={issue.id}
                      className="flex items-center justify-between p-2 rounded-lg border border-slate-100 dark:border-slate-800 hover:bg-slate-50 text-xs"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="font-semibold text-slate-900 dark:text-white truncate">
                          {issue.issueType.replace(/_/g, " ")}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate">{issue.affectedUrl}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => onFixIssue(issue)}
                        className="shrink-0 rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-2.5 py-1 text-xs font-semibold shadow-xs"
                      >
                        Fix with AI
                      </button>
                    </div>
                  ))}
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 text-right mt-3">
            <button
              type="button"
              onClick={() => onSwitchTab("technical-seo")}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1"
            >
              <span>See all technical issues</span>
              <ArrowRight size={12} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
