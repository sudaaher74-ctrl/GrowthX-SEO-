"use client";

import React from "react";
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  Compass,
  Layers,
  Lock,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { CrawlJob } from "@/lib/api-client";
import { GaugeScore } from "../gauge-score";
import type { WebsiteTabId } from "@/components/website/tabs/tab-id";
import type { computeCrawlSummary } from "@/lib/crawl-summary";
import {
  getCwvBadgeClass,
  getHealthBadgeStyle,
  getHealthStatusText,
  getHealthTone,
} from "./technical-seo-helpers";

export interface TechnicalHealthPillarsProps {
  crawl: CrawlJob | null;
  healthScore: number | null;
  summary: ReturnType<typeof computeCrawlSummary>;
  severityCounts: { CRITICAL: number; HIGH: number; MEDIUM: number; LOW: number };
  crawlabilityDelta: number | null;
  canonicalIssuesCount: number;
  isHttps: boolean;
  hasSslIssue: boolean;
  hasMixedContent: boolean;
  hasMalware: boolean;
  securityGood: boolean;
  onSwitchTab: (tab: WebsiteTabId) => void;
}

export function TechnicalHealthPillars({
  crawl,
  healthScore,
  summary,
  severityCounts,
  crawlabilityDelta,
  canonicalIssuesCount,
  isHttps,
  hasSslIssue,
  hasMixedContent,
  hasMalware,
  securityGood,
  onSwitchTab,
}: TechnicalHealthPillarsProps) {
  const healthBadgeStyle = getHealthBadgeStyle(healthScore);
  const healthStatusText = getHealthStatusText(healthScore);
  const healthTone = getHealthTone(healthScore);

  const blockedCount = summary.blocked;
  const errorPagesCount = summary.errored;
  const unreachableCount = summary.unreachable;
  const crawlabilityPercent = summary.crawlablePercent;

  const nonIndexableCount = summary.nonIndexable;
  const unknownIndexabilityCount = summary.indexabilityUnknown;
  const indexabilityPercent = summary.indexablePercent;

  const cwv = summary.coreWebVitals;
  const avgLcpMs = cwv.lcpMs;
  const avgInpMs = cwv.inpMs;
  const avgCls = cwv.cls;
  const lcpDisplay = avgLcpMs != null ? `${(avgLcpMs / 1000).toFixed(1)}s` : "\u2014";
  const inpDisplay = avgInpMs != null ? `${Math.round(avgInpMs)}ms` : "\u2014";
  const clsDisplay = avgCls != null ? avgCls.toFixed(2) : "\u2014";
  const cwvOverallStatus = cwv.status;
  const cwvBadgeClass = getCwvBadgeClass(cwvOverallStatus);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-stretch">
      {/* Left Hero Card: Technical Health Score */}
      <div
        className="lg:col-span-4 rounded-2xl border bg-surface-1 p-5 shadow-card flex flex-col justify-between"
        style={{ borderColor: "var(--border-color)" }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-100 text-brand-950 font-bold">
              <Shield size={14} className="text-signal-400" />
            </div>
            <span className="text-[12px] font-bold uppercase tracking-wider text-brand-400">
              Technical Health
            </span>
          </div>
          <span className={cn("rounded-full border px-2.5 py-0.5 text-[10.5px] font-mono font-bold", healthBadgeStyle)}>
            {healthStatusText}
          </span>
        </div>

        <div className="py-2 flex flex-col items-center">
          <GaugeScore
            score={healthScore}
            maxScore={100}
            statusText={healthStatusText}
            statusTone={healthTone}
            showBadge={false}
            description={
              healthScore == null
                ? "Scan to analyze health"
                : severityCounts.CRITICAL > 0
                ? `${severityCounts.CRITICAL} critical issues found`
                : "Baseline parameters normal"
            }
            buttonText="View Recommendations"
            onButtonClick={() => {
              const el = document.getElementById("technical-issues-table");
              if (el) el.scrollIntoView({ behavior: "smooth" });
            }}
          />
        </div>

        {healthScore != null && (
          <div className="border-t pt-3 mt-1 text-[11.5px]" style={{ borderColor: "var(--border-color)" }}>
            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-brand-400 mb-1.5">
              <span>Score breakdown</span>
              <span className="font-mono text-brand-400">{summary.health.pagesScored} pages scored</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="rounded-lg bg-surface-2 p-2 border" style={{ borderColor: "var(--border-color)" }}>
                <span className="text-brand-400 block text-[10px] uppercase font-mono">High impact</span>
                <span className="font-mono font-bold text-error-600">
                  {severityCounts.HIGH} issues ({summary.health.penalties.find((p) => p.severity === "HIGH")?.penalty ? `-${summary.health.penalties.find((p) => p.severity === "HIGH")?.penalty}` : "0"})
                </span>
              </div>
              <div className="rounded-lg bg-surface-2 p-2 border" style={{ borderColor: "var(--border-color)" }}>
                <span className="text-brand-400 block text-[10px] uppercase font-mono">Medium impact</span>
                <span className="font-mono font-bold text-warning-600">
                  {severityCounts.MEDIUM} issues ({summary.health.penalties.find((p) => p.severity === "MEDIUM")?.penalty ? `-${summary.health.penalties.find((p) => p.severity === "MEDIUM")?.penalty}` : "0"})
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Right Grid: 4 Core Pillars in tight, balanced 2x2 grid */}
      <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        {/* Pillar 1: Crawlability */}
        <div
          className="rounded-2xl border bg-surface-1 p-4 shadow-card flex flex-col justify-between"
          style={{ borderColor: "var(--border-color)" }}
        >
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-brand-400">
                <Compass size={14} className="text-signal-400" />
                <span>Crawlability</span>
              </div>
              <span className="rounded-full border border-success-200/50 bg-success-50/50 text-success-700 px-2 py-0.5 text-[10px] font-mono font-bold">
                {crawlabilityPercent}% Optimal
              </span>
            </div>
            <div className="mt-2.5 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold font-mono text-brand-950 tracking-tight">
                {crawl ? `${crawlabilityPercent}%` : "—"}
              </span>
              {crawlabilityDelta !== null && (
                <span className={cn("text-xs font-mono font-bold", crawlabilityDelta >= 0 ? "text-success-600" : "text-error-600")}>
                  {crawlabilityDelta >= 0 ? "↑" : "↓"} {Math.abs(crawlabilityDelta)}%
                </span>
              )}
            </div>
            <p className="mt-1 text-[11.5px] text-brand-400">
              {errorPagesCount} errors · {blockedCount} blocked
              {unreachableCount > 0 ? ` · ${unreachableCount} unreachable` : ""}
            </p>
          </div>

          <div className="mt-4 pt-3 border-t" style={{ borderColor: "var(--border-color)" }}>
            <div className="flex items-center justify-between text-[11px] text-brand-400 mb-1.5 font-mono">
              <span>Search bots access</span>
              <span className="font-bold text-brand-950">{crawlabilityPercent}% reachable</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-brand-100">
              <div
                className="h-full rounded-full bg-signal-400 transition-all duration-500"
                style={{ width: `${crawlabilityPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Pillar 2: Indexability */}
        <div
          className="rounded-2xl border bg-surface-1 p-4 shadow-card flex flex-col justify-between"
          style={{ borderColor: "var(--border-color)" }}
        >
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-brand-400">
                <Layers size={14} className="text-accent-500" />
                <span>Indexability</span>
              </div>
              <span className="rounded-full border border-accent-200/50 bg-accent-50/50 text-accent-700 px-2 py-0.5 text-[10px] font-mono font-bold">
                {indexabilityPercent}% Indexed
              </span>
            </div>
            <div className="mt-2.5 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold font-mono text-brand-950 tracking-tight">
                {crawl ? `${indexabilityPercent}%` : "—"}
              </span>
            </div>
            <p className="mt-1 text-[11.5px] text-brand-400">
              {nonIndexableCount} not indexable · {canonicalIssuesCount} canonical issues
              {unknownIndexabilityCount > 0 ? ` · ${unknownIndexabilityCount} unknown` : ""}
            </p>
          </div>

          <div className="mt-4 pt-3 border-t" style={{ borderColor: "var(--border-color)" }}>
            <div className="flex items-center justify-between text-[11px] text-brand-400 mb-1.5 font-mono">
              <span>Search index status</span>
              <span className="font-bold text-brand-950">{indexabilityPercent}% eligible</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-brand-100">
              <div
                className="h-full rounded-full bg-warning-500 transition-all duration-500"
                style={{ width: `${indexabilityPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Pillar 3: Core Web Vitals */}
        <div
          className="rounded-2xl border bg-surface-1 p-4 shadow-card flex flex-col justify-between"
          style={{ borderColor: "var(--border-color)" }}
        >
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-brand-400">
                <Activity size={14} className="text-signal-400" />
                <span>Core Web Vitals</span>
              </div>
              <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-mono font-bold", cwvBadgeClass)}>
                {cwvOverallStatus}
              </span>
            </div>

            {/* 3 Metric Capsules */}
            <div className="grid grid-cols-3 gap-2 mt-3">
              <div className="rounded-xl border bg-surface-2 p-2 text-center" style={{ borderColor: "var(--border-color)" }}>
                <span className="text-[10px] font-mono font-bold text-brand-400 uppercase">LCP</span>
                <p className={cn("font-mono text-[13px] font-extrabold mt-0.5", avgLcpMs == null ? "text-brand-400" : avgLcpMs <= 2500 ? "text-success-600" : "text-error-600")}>
                  {lcpDisplay}
                </p>
                <span className="text-[9px] text-brand-400 font-mono">&lt;2.5s</span>
              </div>
              <div className="rounded-xl border bg-surface-2 p-2 text-center" style={{ borderColor: "var(--border-color)" }}>
                <span className="text-[10px] font-mono font-bold text-brand-400 uppercase">INP</span>
                <p className={cn("font-mono text-[13px] font-extrabold mt-0.5", avgInpMs == null ? "text-brand-400" : avgInpMs <= 200 ? "text-success-600" : "text-warning-600")}>
                  {inpDisplay}
                </p>
                <span className="text-[9px] text-brand-400 font-mono">&lt;200ms</span>
              </div>
              <div className="rounded-xl border bg-surface-2 p-2 text-center" style={{ borderColor: "var(--border-color)" }}>
                <span className="text-[10px] font-mono font-bold text-brand-400 uppercase">CLS</span>
                <p className={cn("font-mono text-[13px] font-extrabold mt-0.5", avgCls == null ? "text-brand-400" : avgCls <= 0.1 ? "text-success-600" : "text-warning-600")}>
                  {clsDisplay}
                </p>
                <span className="text-[9px] text-brand-400 font-mono">&lt;0.1</span>
              </div>
            </div>
          </div>

          <div className="mt-3 pt-2.5 border-t flex items-center justify-between text-right" style={{ borderColor: "var(--border-color)" }}>
            <span className="text-[10.5px] text-brand-400 font-mono">Real user speeds</span>
            <button
              type="button"
              onClick={() => onSwitchTab("performance")}
              className="text-[11.5px] font-bold text-signal-400 hover:text-signal-500 inline-flex items-center gap-1 transition"
            >
              <span>View Details</span>
              <ArrowRight size={12} />
            </button>
          </div>
        </div>

        {/* Pillar 4: HTTPS & Security */}
        <div
          className="rounded-2xl border bg-surface-1 p-4 shadow-card flex flex-col justify-between"
          style={{ borderColor: "var(--border-color)" }}
        >
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-brand-400">
                <Lock size={14} className="text-success-500" />
                <span>HTTPS &amp; Security</span>
              </div>
              <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-mono font-bold", securityGood ? "bg-success-50/50 text-success-700 border-success-200/50" : "bg-error-50/50 text-error-700 border-error-200/50")}>
                {securityGood ? "Protected" : "Needs Review"}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 mt-3">
              <div className="flex items-center gap-1.5 text-[11.5px] text-brand-950 font-medium">
                <CheckCircle2 size={13} className={isHttps ? "text-success-500 shrink-0" : "text-brand-400 shrink-0"} />
                <span className="truncate">HTTPS enabled</span>
              </div>
              <div className="flex items-center gap-1.5 text-[11.5px] text-brand-950 font-medium">
                <CheckCircle2 size={13} className={!hasSslIssue ? "text-success-500 shrink-0" : "text-error-600 shrink-0"} />
                <span className="truncate">Valid SSL cert</span>
              </div>
              <div className="flex items-center gap-1.5 text-[11.5px] text-brand-950 font-medium">
                <CheckCircle2 size={13} className={!hasMixedContent ? "text-success-500 shrink-0" : "text-warning-500 shrink-0"} />
                <span className="truncate">No mixed content</span>
              </div>
              <div className="flex items-center gap-1.5 text-[11.5px] text-brand-950 font-medium">
                <CheckCircle2 size={13} className={!hasMalware ? "text-success-500 shrink-0" : "text-error-600 shrink-0"} />
                <span className="truncate">Safe browsing</span>
              </div>
            </div>
          </div>

          <div className="mt-3 pt-2.5 border-t flex items-center justify-between text-[10.5px] text-brand-400 font-mono" style={{ borderColor: "var(--border-color)" }}>
            <span>SSL &amp; Protocol Integrity</span>
            <span className="text-success-600 font-bold">100% Secure</span>
          </div>
        </div>
      </div>
    </div>
  );
}
