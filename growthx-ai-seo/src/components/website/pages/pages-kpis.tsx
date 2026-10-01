"use client";

import React from "react";
import { Compass, Globe, Layers, Link as LinkIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CrawlInventoryMetrics } from "./page-score";

interface PagesKpisProps {
  successfulCount: number;
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
      {/* 1. Total Pages Crawled (Strictly HTTP 2xx) */}
      <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
            <Globe size={14} className="text-blue-600" />
            <span>Total Pages Crawled</span>
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              {successfulCount.toLocaleString()}
            </span>
            {pagesDelta !== null && pagesDelta !== 0 && (
              <span
                className={cn(
                  "text-xs font-semibold flex items-center gap-0.5",
                  pagesDelta >= 0 ? "text-emerald-600" : "text-rose-600"
                )}
              >
                {pagesDelta >= 0 ? "↑ +" : "↓ "}
                {pagesDelta} vs last crawl
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            HTTP 2xx pages successfully fetched.
          </p>
        </div>

        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-600 dark:text-slate-400">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <b className="text-slate-900 dark:text-white">{successfulCount}</b> OK
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
      <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
            <Compass size={14} className="text-indigo-600" />
            <span>Total URLs Discovered</span>
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              {urlsDiscoveredCount.toLocaleString()}
            </span>
            <span className="rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400 px-2 py-0.5 text-xs font-bold">
              Multi-source
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Unique pages identified across sitemaps, DOM & links.
            {(inventory?.filesLinked ?? 0) > 0 &&
              ` ${inventory!.filesLinked} linked file${inventory!.filesLinked === 1 ? "" : "s"} (PDF, images) not counted as pages.`}
          </p>
        </div>

        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-400">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <b className="text-slate-900 dark:text-white">{urlsCrawledCount}</b> Crawled
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            <b className="text-slate-900 dark:text-white">{notCrawledCount}</b> Not Crawled
          </span>
        </div>
      </div>

      {/* 3. Indexable Pages */}
      <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
            <Layers size={14} className="text-emerald-600" />
            <span>Indexable Pages</span>
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              {indexableCount.toLocaleString()}
            </span>
            <span className="rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 px-2 py-0.5 text-xs font-bold">
              {indexablePct}%
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Pages that can appear in search results.
          </p>
        </div>

        <div className="mt-4">
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800 flex">
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
      <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
            <LinkIcon size={14} className="text-purple-600" />
            <span>Crawl Coverage</span>
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              {/* Never a number we cannot derive. "100%" was the old default
                  for a crawl with nothing to divide by, which is the one
                  reading the data can never support. */}
              {crawlCoveragePct === null ? "Unknown" : `${crawlCoveragePct}%`}
            </span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${
              crawlIsPartial
                ? "bg-warning-50 text-warning-700"
                : "bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400"
            }`}>
              {crawlCoveragePct === null ? "No data" : `${urlsCrawledCount}/${urlsDiscoveredCount}`}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {crawlCoveragePct === null
              ? "No URLs were discovered, so coverage cannot be measured."
              : crawlIsPartial
                ? `Partial crawl — ${notCrawledCount.toLocaleString()} discovered ${notCrawledCount === 1 ? "URL was" : "URLs were"} not fetched.`
                : "Every discovered URL was fetched."}
          </p>
        </div>

        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-400">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-blue-500" />
            <b className="text-slate-900 dark:text-white">{duplicatesCount}</b> Deduplicated
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-slate-400" />
            <b className="text-slate-900 dark:text-white">{canonicalizedCount}</b> Canonicalized
          </span>
        </div>
      </div>
    </div>
  );
}
