"use client";

import React, { useState, useMemo } from "react";
import { ChevronDown, ChevronUp, Compass } from "lucide-react";
import { cn } from "@/lib/utils";

interface DiscoveredNotCrawledItem {
  url: string;
  reason: string;
  sources?: string[];
}

interface DiscoveredNotCrawledPanelProps {
  notCrawledCount: number;
  discoveredNotCrawledItems: DiscoveredNotCrawledItem[];
  notCrawledReasonCounts: Record<string, number>;
}

export function DiscoveredNotCrawledPanel({
  notCrawledCount,
  discoveredNotCrawledItems,
  notCrawledReasonCounts,
}: DiscoveredNotCrawledPanelProps) {
  const [showNotCrawled, setShowNotCrawled] = useState(false);
  const [notCrawledReasonFilter, setNotCrawledReasonFilter] = useState("ALL");

  /** One pill per reason the crawl recorded, plus "ALL". */
  const notCrawledReasonPills = useMemo(() => {
    const entries = Object.entries(notCrawledReasonCounts).sort((a, b) => b[1] - a[1]);
    return [
      { reason: "ALL", count: notCrawledCount || null },
      ...entries.map(([reason, count]) => ({ reason, count })),
    ];
  }, [notCrawledReasonCounts, notCrawledCount]);

  const filteredNotCrawled = useMemo(() => {
    if (notCrawledReasonFilter === "ALL") return discoveredNotCrawledItems;
    return discoveredNotCrawledItems.filter(
      (item) => item.reason.toLowerCase() === notCrawledReasonFilter.toLowerCase()
    );
  }, [discoveredNotCrawledItems, notCrawledReasonFilter]);

  return (
    <div className="rounded-xl border border-slate-200/80 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
      <button
        type="button"
        onClick={() => setShowNotCrawled(!showNotCrawled)}
        className="w-full p-4 flex items-center justify-between hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors text-left"
      >
        <div className="flex items-center gap-2.5">
          <Compass size={16} className="text-amber-600" />
          <div>
            <span className="text-sm font-bold text-slate-900 dark:text-white">
              URLs Discovered But Not Crawled
            </span>
            <span className="ml-2 rounded-full bg-amber-50 text-amber-700 border border-amber-200/60 dark:bg-amber-950/40 dark:text-amber-400 px-2 py-0.5 text-xs font-semibold">
              {notCrawledCount.toLocaleString()} URLs
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
          <span>{showNotCrawled ? "Hide reasons" : "View reasons"}</span>
          {showNotCrawled ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
      </button>

      {showNotCrawled && (
        <div className="p-4 pt-0 border-t border-slate-100 dark:border-slate-800 space-y-3">
          {/* Reason Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5 pt-3">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 mr-1">
              Filter Reason:
            </span>
            {/* Derived from the reasons the crawler actually recorded, with
                their counts. The previous list was a fixed set of labels
                ("external", "noindex", "blocked") that the crawler never
                writes, so most pills filtered to nothing and the vocabulary
                on screen bore no relation to the data behind it. */}
            {notCrawledReasonPills.map(({ reason, count }) => (
              <button
                key={reason}
                type="button"
                onClick={() => setNotCrawledReasonFilter(reason)}
                className={cn(
                  "px-2.5 py-1 rounded-full text-xs font-medium transition-colors",
                  notCrawledReasonFilter === reason
                    ? "bg-amber-600 text-white shadow-xs"
                    : "bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                )}
              >
                {reason === "ALL" ? "All" : reason.replace(/_/g, " ")}
                {count !== null && <span className="ml-1 opacity-70">{count}</span>}
              </button>
            ))}
          </div>

          {/* List / Table of Not Crawled URLs */}
          {filteredNotCrawled.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-400">
              {notCrawledCount === 0
                ? "Every discovered URL was fetched."
                : discoveredNotCrawledItems.length === 0
                  ? "This crawl did not record per-URL reasons."
                  : "No URLs match the selected filter."}
            </div>
          ) : (
            <div className="max-h-60 overflow-y-auto border border-slate-100 dark:border-slate-800 rounded-lg">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  <tr>
                    <th className="p-2.5 pl-3">DISCOVERED URL</th>
                    <th className="p-2.5">SOURCE</th>
                    <th className="p-2.5 pr-3 text-right">EXCLUSION REASON</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredNotCrawled.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
                      <td className="p-2.5 pl-3 font-mono text-[11px] text-slate-700 dark:text-slate-300 truncate max-w-[400px]">
                        {item.url}
                      </td>
                      <td className="p-2.5 text-[11px] text-brand-500">
                        {/* Every source that found it, so one URL in the
                            sitemap and a nav menu reads as one row with two
                            sources rather than as two URLs. */}
                        {item.sources && item.sources.length > 0
                          ? item.sources.map((source) => source.replace(/_/g, " ")).join(" + ")
                          : "—"}
                      </td>
                      <td className="p-2.5 pr-3 text-right">
                        <span className="inline-block rounded-full bg-amber-50 border border-amber-200 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                          {item.reason}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
