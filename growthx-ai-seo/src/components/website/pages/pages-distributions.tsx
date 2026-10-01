"use client";

import React from "react";
import { DonutChart } from "../donut-chart";

export interface PageTypeCount {
  label: string;
  value: number;
  color: string;
}

export interface StatusCodeCount {
  label: string;
  value: number;
  color: string;
}

export interface DiscoverySourceItem {
  key: string;
  label: string;
  count: number;
  color: string;
  scanned: boolean | undefined;
  percentage: number;
}

interface PagesDistributionsProps {
  pageTypeCounts: PageTypeCount[];
  statusCodeCounts: StatusCodeCount[];
  discoverySourceList: DiscoverySourceItem[];
  multiSourceUrls: number;
  pagesCount: number;
}

export function PagesDistributions({
  pageTypeCounts,
  statusCodeCounts,
  discoverySourceList,
  multiSourceUrls,
  pagesCount,
}: PagesDistributionsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
      {/* 1. Page Type Distribution (10 Types) */}
      <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between overflow-hidden">
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Page Type Distribution
            </h3>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              10 Types
            </span>
          </div>
          <div className="flex items-center justify-center py-2">
            <DonutChart
              data={pageTypeCounts}
              centerValue={pagesCount}
              centerLabel="Pages"
              size={110}
              thickness={15}
            />
          </div>
        </div>
        <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
          {pageTypeCounts.slice(0, 5).map((item) => (
            <span key={item.label} className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
              <span className="text-slate-600 dark:text-slate-400">{item.label}:</span>
              <b className="text-slate-900 dark:text-white">{item.value}</b>
            </span>
          ))}
          {pageTypeCounts.length > 5 && (
            <span className="text-slate-400">+{pageTypeCounts.length - 5} more</span>
          )}
        </div>
      </div>

      {/* 2. Status Code Distribution */}
      <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between overflow-hidden">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-2">
            Status Code Distribution
          </h3>
          <div className="flex items-center justify-center py-2">
            <DonutChart
              data={statusCodeCounts}
              centerValue={pagesCount}
              centerLabel="Pages"
              size={110}
              thickness={15}
            />
          </div>
        </div>
        <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
          {statusCodeCounts.map((item) => (
            <span key={item.label} className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
              <span className="text-slate-600 dark:text-slate-400">{item.label}:</span>
              <b className="text-slate-900 dark:text-white">{item.value}</b>
            </span>
          ))}
        </div>
      </div>

      {/* 3. Crawl-Source Breakdown */}
      <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between overflow-hidden">
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Crawl-Source Breakdown
            </h3>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              {multiSourceUrls > 0
                ? `${multiSourceUrls} multi-source`
                : "Unique URLs"}
            </span>
          </div>
          <div className="space-y-2 py-1">
            {discoverySourceList.map((src) => (
              <div key={src.key} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-300">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: src.color }} />
                    {src.label}
                  </span>
                  {src.scanned ? (
                    <span className="text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                      <b className="text-slate-900 dark:text-white">{src.count}</b> ({src.percentage}%)
                    </span>
                  ) : (
                    <span className="text-[11px] italic text-brand-400">Not scanned</span>
                  )}
                </div>
                <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  {src.scanned && (
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${src.percentage}%`, backgroundColor: src.color }}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
