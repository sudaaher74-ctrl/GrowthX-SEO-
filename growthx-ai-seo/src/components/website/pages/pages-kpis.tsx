"use client";

import React from "react";
import { Compass, Globe, Layers, Link as LinkIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CrawlInventoryMetrics } from "./page-score";

interface PagesKpisProps {
  successfulCount: number;
  totalPages: number;
  pagesDelta: number | null;
  erroredCount: number;
  redirectedCount: number;
  blockedCount: number;
  unreachableCount: number;
  urlsDiscoveredCount: number;
  inventory?: CrawlInventoryMetrics | null;
  urlsCrawledCount: number;
  notCrawledCount: number;
  indexableCount: number;
  indexablePct: number;
  nonIndexableCount: number;
  unknownIndexabilityCount: number;
  pagesCount: number;
  crawlCoveragePct: number | null;
  crawlIsPartial: boolean;
  duplicatesCount: number;
  canonicalizedCount: number;
}

export function PagesKpis({
  successfulCount,
  totalPages,
  pagesDelta,
  erroredCount,
  redirectedCount,
  blockedCount,
  unreachableCount,
  urlsDiscoveredCount,
  inventory,
  urlsCrawledCount,
  notCrawledCount,
  indexableCount,
  indexablePct,
  nonIndexableCount,
  unknownIndexabilityCount,
  pagesCount,
  crawlCoveragePct,
  crawlIsPartial,
  duplicatesCount,
  canonicalizedCount,
}: PagesKpisProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
      {/* 1. Total Pages Crawled */}
      <div className="rounded-xl border border-brand-200/80 bg-surface-1 p-4 shadow-2xs hover:border-brand-300 transition-colors flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-bold text-brand-500 uppercase tracking-wider mb-2">
            <Globe size={14} className="text-signal-400" />
            <span>Total Pages Crawled</span>
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-bold font-mono tracking-tight text-brand-950">
              {totalPages.toLocaleString()}
            </span>
            {pagesDelta !== null && pagesDelta !== 0 && (
              <span
                className={cn(
                  "text-xs font-bold font-mono flex items-center gap-0.5",
                  pagesDelta >= 0 ? "text-success-600" : "text-error-600"
                )}
              >
                {pagesDelta >= 0 ? "↑ +" : "↓ "}
                {pagesDelta} vs last crawl
              </span>
            )}
          </div>
          <p className="text-xs text-brand-500 mt-1">
            Pages recorded for this crawl. Status counts below describe the loaded pages.
          </p>
        </div>

        <div className="mt-4 pt-3 border-t border-brand-200/60 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-brand-600">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-success-500" />
            <b className="text-brand-950">{successfulCount}</b> OK
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-error-500" />
            <b className="text-brand-950">{erroredCount}</b> Errored
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-warning-500" />
            <b className="text-brand-950">{redirectedCount}</b> Redirected
          </span>
          {blockedCount > 0 && (
            <span className="flex items-center gap-1" title="Origin challenge or suspicion.">
              <span className="h-2 w-2 rounded-full bg-warning-600" />
              <b className="text-brand-950">{blockedCount}</b> Blocked
            </span>
          )}
          {unreachableCount > 0 && (
            <span className="flex items-center gap-1" title="Unreachable origin.">
              <span className="h-2 w-2 rounded-full bg-brand-400" />
              <b className="text-brand-950">{unreachableCount}</b> Unreachable
            </span>
          )}
        </div>
      </div>

      {/* 2. Total URLs Discovered */}
      <div className="rounded-xl border border-brand-200/80 bg-surface-1 p-4 shadow-2xs hover:border-brand-300 transition-colors flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-bold text-brand-500 uppercase tracking-wider mb-2">
            <Compass size={14} className="text-accent-500" />
            <span>Total URLs Discovered</span>
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-bold font-mono tracking-tight text-brand-950">
              {urlsDiscoveredCount.toLocaleString()}
            </span>
            <span className="rounded-full border border-brand-200/60 bg-surface-2 text-brand-800 px-2 py-0.5 text-xs font-bold font-mono">
              Multi-source
            </span>
          </div>
          <p className="text-xs text-brand-500 mt-1">
            Unique pages identified across sitemaps, DOM &amp; links.
            {(inventory?.filesLinked ?? 0) > 0 &&
              ` ${inventory!.filesLinked} linked file${inventory!.filesLinked === 1 ? "" : "s"} (PDF, images) not counted as pages.`}
          </p>
        </div>

        <div className="mt-4 pt-3 border-t border-brand-200/60 flex items-center justify-between text-[11px] text-brand-600">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-success-500" />
            <b className="text-brand-950">{urlsCrawledCount}</b> Crawled
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-warning-500" />
            <b className="text-brand-950">{notCrawledCount}</b> Not Crawled
          </span>
        </div>
      </div>

      {/* 3. Indexable Pages */}
      <div className="rounded-xl border border-brand-200/80 bg-surface-1 p-4 shadow-2xs hover:border-brand-300 transition-colors flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-bold text-brand-500 uppercase tracking-wider mb-2">
            <Layers size={14} className="text-emerald-500" />
            <span>Indexable Pages</span>
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-bold font-mono tracking-tight text-brand-950">
              {indexableCount.toLocaleString()}
            </span>
            <span className="rounded-full border border-emerald-300/80 bg-emerald-50 text-emerald-800 px-2 py-0.5 text-xs font-bold font-mono">
              {indexablePct}%
            </span>
          </div>
          <p className="text-xs text-brand-500 mt-1">
            Pages that can appear in search engine results.
          </p>
        </div>

        <div className="mt-4">
          <div className="h-2 w-full overflow-hidden rounded-full bg-brand-100 flex">
            <div
              className="h-full bg-success-500 transition-all duration-500"
              style={{ width: `${indexablePct}%` }}
            />
            <div
              className="h-full bg-warning-400 transition-all duration-500"
              style={{ width: `${pagesCount ? (nonIndexableCount / pagesCount) * 100 : 0}%` }}
            />
            <div
              className="h-full bg-brand-300 transition-all duration-500"
              style={{ width: `${pagesCount ? (unknownIndexabilityCount / pagesCount) * 100 : 0}%` }}
            />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-brand-500">
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-success-500" />
              <span>{indexableCount} Indexable</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-warning-400" />
              <span>{nonIndexableCount} Non-indexable</span>
            </span>
            {unknownIndexabilityCount > 0 && (
              <span className="flex items-center gap-1" title="We could not determine indexability for these pages.">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-400" />
                <span>{unknownIndexabilityCount} Unknown</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 4. Crawl Coverage */}
      <div className="rounded-xl border border-brand-200/80 bg-surface-1 p-4 shadow-2xs hover:border-brand-300 transition-colors flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-bold text-brand-500 uppercase tracking-wider mb-2">
            <LinkIcon size={14} className="text-brand-700" />
            <span>Crawl Coverage</span>
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-bold font-mono tracking-tight text-brand-950">
              {crawlCoveragePct === null ? "Unknown" : `${crawlCoveragePct}%`}
            </span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-bold font-mono border ${
              crawlIsPartial
                ? "bg-warning-50 text-warning-700 border-warning-200"
                : "bg-surface-2 text-brand-800 border-brand-200/60"
            }`}>
              {crawlCoveragePct === null ? "No data" : `${urlsCrawledCount}/${urlsDiscoveredCount}`}
            </span>
          </div>
          <p className="text-xs text-brand-500 mt-1">
            {crawlCoveragePct === null
              ? "No URLs were discovered, so coverage cannot be measured."
              : crawlIsPartial
                ? `Partial crawl — ${notCrawledCount.toLocaleString()} discovered ${notCrawledCount === 1 ? "URL was" : "URLs were"} not fetched.`
                : "Every discovered URL was fetched."}
          </p>
        </div>

        <div className="mt-4 pt-3 border-t border-brand-200/60 flex items-center justify-between text-[11px] text-brand-600">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-accent-500" />
            <b className="text-brand-950">{duplicatesCount}</b> Deduplicated
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-brand-400" />
            <b className="text-brand-950">{canonicalizedCount}</b> Canonicalized
          </span>
        </div>
      </div>
    </div>
  );
}
