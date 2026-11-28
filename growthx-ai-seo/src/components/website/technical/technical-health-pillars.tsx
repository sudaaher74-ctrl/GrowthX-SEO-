"use client";

import React from "react";
import { ArrowRight, CheckCircle2 } from "lucide-react";
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
  const needsReview = healthScore != null && (severityCounts.HIGH > 0 || severityCounts.CRITICAL > 0 || summary.indexabilityUnknown > 0 || canonicalIssuesCount > 0);
  const healthBadgeStyle = needsReview ? "bg-warning-50 text-warning-700 border-warning-200/50" : getHealthBadgeStyle(healthScore);
  const healthStatusText = needsReview ? "Needs review" : getHealthStatusText(healthScore);
  const healthTone = needsReview ? "warn" : getHealthTone(healthScore);

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
      <div className="lg:col-span-4 rounded-2xl border border-brand-200/80 bg-surface-1 p-5 shadow-2xs flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-[11.5px] font-bold uppercase tracking-wider text-brand-500">
            Site Health Score
          </span>
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
                ? "Run an audit to score your website"
                : severityCounts.CRITICAL > 0
                ? `${severityCounts.CRITICAL} urgent issues need attention`
                : needsReview ? "Fix key issues below to lift score" : "Strong technical foundation"
            }
            buttonText="Review Problems to Fix"
            onButtonClick={() => onSwitchTab("issues")}
          />
        </div>

        {healthScore != null && (
          <div className="border-t border-brand-200/60 pt-3 mt-1 text-[11.5px]">
            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-brand-400 mb-1.5">
              <span>Score breakdown</span>
              <span className="font-mono text-brand-400">{summary.health.pagesScored} pages scored</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="rounded-lg bg-surface-2 p-2 border border-brand-200/60">
                <span className="text-brand-400 block text-[10px] uppercase font-mono">High impact</span>
                <span className="font-mono font-bold text-error-600">
                  {severityCounts.HIGH} findings · -{((summary.health.penalties.find((p) => p.severity === "HIGH")?.penalty ?? 0) / Math.max(summary.health.pagesScored, 1)).toFixed(1)} points
                </span>
              </div>
              <div className="rounded-lg bg-surface-2 p-2 border border-brand-200/60">
                <span className="text-brand-400 block text-[10px] uppercase font-mono">Medium impact</span>
                <span className="font-mono font-bold text-warning-600">
                  {severityCounts.MEDIUM} findings · -{((summary.health.penalties.find((p) => p.severity === "MEDIUM")?.penalty ?? 0) / Math.max(summary.health.pagesScored, 1)).toFixed(1)} points
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Right Grid: 4 Core Pillars in tight, balanced 2x2 grid */}
      <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        {/* Pillar 1: Bot Access */}
        <div className="rounded-2xl border border-brand-200/80 bg-surface-1 p-4 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-brand-500">
                Bot Access
              </span>
              <span className="rounded-full border border-success-200/50 bg-success-50/50 text-success-700 px-2 py-0.5 text-[10px] font-mono font-bold">
                {crawlabilityPercent}% Reachable
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
            <p className="mt-1 text-xs text-brand-500">
              {errorPagesCount} errors · {blockedCount} blocked
              {unreachableCount > 0 ? ` · ${unreachableCount} unreachable` : ""}
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-brand-200/60">
            <div className="flex items-center justify-between text-[11px] text-brand-500 mb-1.5">
              <span>Can Google &amp; AI reach your pages?</span>
              <button
                type="button"
                onClick={() => onSwitchTab("pages")}
                className="text-signal-500 hover:text-signal-600 font-bold inline-flex items-center gap-0.5 cursor-pointer"
              >
                <span>Pages</span>
                <ArrowRight size={11} />
              </button>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-brand-100">
              <div
                className="h-full rounded-full bg-signal-400 transition-all duration-500"
                style={{ width: `${crawlabilityPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Pillar 2: Google Eligibility */}
        <div className="rounded-2xl border border-brand-200/80 bg-surface-1 p-4 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-brand-500">
                Google Eligibility
              </span>
              <span className="rounded-full border border-accent-200/50 bg-accent-50/50 text-accent-700 px-2 py-0.5 text-[10px] font-mono font-bold">
                {indexabilityPercent}% Eligible
              </span>
            </div>
            <div className="mt-2.5 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold font-mono text-brand-950 tracking-tight">
                {crawl ? `${indexabilityPercent}%` : "—"}
              </span>
            </div>
            <p className="mt-1 text-xs text-brand-500">
              {nonIndexableCount} excluded · {canonicalIssuesCount} preferred-URL issues
              {unknownIndexabilityCount > 0 ? ` · ${unknownIndexabilityCount} unknown` : ""}
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-brand-200/60">
            <div className="flex items-center justify-between text-[11px] text-brand-500 mb-1.5">
              <span>Pages allowed in Google search</span>
              <button
                type="button"
                onClick={() => onSwitchTab("pages")}
                className="text-accent-600 hover:text-accent-700 font-bold inline-flex items-center gap-0.5 cursor-pointer"
              >
                <span>Inspect</span>
                <ArrowRight size={11} />
              </button>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-brand-100">
              <div
                className="h-full rounded-full bg-warning-500 transition-all duration-500"
                style={{ width: `${indexabilityPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Pillar 3: Page Speed & Stability */}
        <div className="rounded-2xl border border-brand-200/80 bg-surface-1 p-4 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-brand-500">
                Page Speed &amp; Stability
              </span>
              <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-mono font-bold", cwvBadgeClass)}>
                {cwvOverallStatus}
              </span>
            </div>

            {/* 3 Plain-English Speed Capsules */}
            <div className="grid grid-cols-3 gap-2 mt-3">
              <div className="rounded-xl border border-brand-200/60 bg-surface-2 p-2 text-center" title="Largest Contentful Paint: how fast main content loads">
                <span className="text-[10px] font-semibold text-brand-500">Load (LCP)</span>
                <p className={cn("font-mono text-[13px] font-extrabold mt-0.5", avgLcpMs == null ? "text-brand-400" : avgLcpMs <= 2500 ? "text-success-600" : "text-error-600")}>
                  {lcpDisplay}
                </p>
                <span className="text-[9px] text-brand-400 font-mono">Goal &lt;2.5s</span>
              </div>
              <div className="rounded-xl border border-brand-200/60 bg-surface-2 p-2 text-center" title="Interaction to Next Paint: how fast buttons react to taps">
                <span className="text-[10px] font-semibold text-brand-500">Tap (INP)</span>
                <p className={cn("font-mono text-[13px] font-extrabold mt-0.5", avgInpMs == null ? "text-brand-400" : avgInpMs <= 200 ? "text-success-600" : "text-warning-600")}>
                  {inpDisplay}
                </p>
                <span className="text-[9px] text-brand-400 font-mono">Goal &lt;200ms</span>
              </div>
              <div className="rounded-xl border border-brand-200/60 bg-surface-2 p-2 text-center" title="Cumulative Layout Shift: whether elements jump while loading">
                <span className="text-[10px] font-semibold text-brand-500">Shift (CLS)</span>
                <p className={cn("font-mono text-[13px] font-extrabold mt-0.5", avgCls == null ? "text-brand-400" : avgCls <= 0.1 ? "text-success-600" : "text-warning-600")}>
                  {clsDisplay}
                </p>
                <span className="text-[9px] text-brand-400 font-mono">Goal &lt;0.1</span>
              </div>
            </div>
          </div>

          <div className="mt-3 pt-2.5 border-t border-brand-200/60 flex items-center justify-between">
            <span className="text-[11px] text-brand-500">
              {avgLcpMs == null && avgInpMs == null && avgCls == null ? "Run a speed test to measure" : "Core Web Vitals"}
            </span>
            <button
              type="button"
              onClick={() => onSwitchTab("performance")}
              className="text-[11.5px] font-bold text-signal-500 hover:text-signal-600 inline-flex items-center gap-1 transition cursor-pointer"
            >
              <span>Speed details</span>
              <ArrowRight size={12} />
            </button>
          </div>
        </div>

        {/* Pillar 4: HTTPS & Safety */}
        <div className="rounded-2xl border border-brand-200/80 bg-surface-1 p-4 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-brand-500">
                HTTPS &amp; Safety
              </span>
              <span
                className={cn(
                  "rounded-full border px-2 py-0.5 text-[10px] font-mono font-bold",
                  summary.pagesCrawled === 0
                    ? "bg-brand-50 text-brand-500 border-brand-200/60"
                    : securityGood
                      ? "bg-success-50/50 text-success-700 border-success-200/50"
                      : "bg-error-50/50 text-error-700 border-error-200/50",
                )}
              >
                {summary.pagesCrawled === 0 ? "Pending" : securityGood ? "Secure" : "Needs Review"}
              </span>
            </div>

            <div className="space-y-2 mt-3">
              <div className="flex items-center gap-2 text-xs text-brand-900 font-medium">
                <CheckCircle2
                  size={14}
                  className={
                    summary.pagesCrawled === 0
                      ? "text-brand-300 shrink-0"
                      : isHttps
                        ? "text-success-500 shrink-0"
                        : "text-error-600 shrink-0"
                  }
                />
                <span>
                  {summary.pagesCrawled === 0
                    ? "HTTPS check pending"
                    : isHttps
                      ? "All crawled pages load over secure HTTPS"
                      : "Unsecured HTTP URLs detected"}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-brand-900 font-medium">
                <CheckCircle2
                  size={14}
                  className={
                    summary.pagesCrawled === 0
                      ? "text-brand-300 shrink-0"
                      : !hasMixedContent
                        ? "text-success-500 shrink-0"
                        : "text-warning-500 shrink-0"
                  }
                />
                <span>
                  {summary.pagesCrawled === 0
                    ? "Asset security check pending"
                    : !hasMixedContent
                      ? "No unsecured HTTP images or scripts found"
                      : "Mixed HTTP content found on HTTPS pages"}
                </span>
              </div>
              {hasSslIssue && (
                <div className="flex items-center gap-2 text-xs text-error-700 font-medium">
                  <CheckCircle2 size={14} className="text-error-600 shrink-0" />
                  <span>SSL certificate issue flagged</span>
                </div>
              )}
              {hasMalware && (
                <div className="flex items-center gap-2 text-xs text-error-700 font-medium">
                  <CheckCircle2 size={14} className="text-error-600 shrink-0" />
                  <span>Critical security alert detected</span>
                </div>
              )}
            </div>
          </div>

          <div className="mt-3 pt-2.5 border-t border-brand-200/60 flex items-center justify-between text-[11px] text-brand-500">
            <span>Browser trust &amp; encryption</span>
            <span
              className={cn(
                "font-semibold",
                summary.pagesCrawled === 0
                  ? "text-brand-400"
                  : securityGood
                    ? "text-success-600"
                    : "text-error-600",
              )}
            >
              {summary.pagesCrawled === 0 ? "Not checked" : securityGood ? "All checks passed" : "Action needed"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
