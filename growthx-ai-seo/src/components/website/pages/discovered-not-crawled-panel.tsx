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
      (item) => item.reason.toLowerCase() === notCrawledReasonFilter.toLowerCase(),
    );
  }, [discoveredNotCrawledItems, notCrawledReasonFilter]);

  return (
    <div className="rounded-2xl border border-brand-200/80 bg-surface-1 shadow-2xs overflow-hidden">
      <button
        type="button"
        onClick={() => setShowNotCrawled(!showNotCrawled)}
        className="w-full p-4 flex items-center justify-between hover:bg-brand-50/70 transition-colors text-left cursor-pointer"
      >
        <div className="flex items-center gap-2.5">
          <Compass size={16} className="text-warning-600" />
          <div>
            <span className="text-sm font-bold text-brand-950">
              URLs Discovered But Not Crawled
            </span>
            <span className="ml-2 rounded-full bg-warning-50 text-warning-700 border border-warning-200/70 px-2 py-0.5 text-xs font-semibold tabular-nums">
              {notCrawledCount.toLocaleString()} URLs
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1 text-xs text-brand-500">
          <span>{showNotCrawled ? "Hide reasons" : "View reasons"}</span>
          {showNotCrawled ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
      </button>

      {showNotCrawled && (
        <div className="p-4 pt-0 border-t border-brand-100 space-y-3">
          {/* Reason Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5 pt-3">
            <span className="text-xs font-semibold text-brand-500 mr-1">
              Filter Reason:
            </span>
            {notCrawledReasonPills.map(({ reason, count }) => (
              <button
                key={reason}
                type="button"
                onClick={() => setNotCrawledReasonFilter(reason)}
                className={cn(
                  "px-2.5 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer",
                  notCrawledReasonFilter === reason
                    ? "bg-warning-600 text-white shadow-xs"
                    : "bg-brand-100 hover:bg-brand-200/80 text-brand-700",
                )}
              >
                {reason === "ALL" ? "All" : reason.replace(/_/g, " ")}
                {count !== null && <span className="ml-1 opacity-75 tabular-nums">{count}</span>}
              </button>
            ))}
          </div>

          {/* List / Table of Not Crawled URLs */}
          {filteredNotCrawled.length === 0 ? (
            <div className="py-6 text-center text-xs text-brand-400">
              {notCrawledCount === 0
                ? "Every discovered URL was fetched."
                : discoveredNotCrawledItems.length === 0
                  ? "This crawl did not record per-URL reasons."
                  : "No URLs match the selected filter."}
            </div>
          ) : (
            <div className="max-h-60 overflow-y-auto border border-brand-200/70 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-brand-50 text-[11px] font-semibold text-brand-500 uppercase tracking-wider">
                  <tr>
                    <th className="p-2.5 pl-3">Discovered URL</th>
                    <th className="p-2.5">Source</th>
                    <th className="p-2.5 pr-3 text-right">Exclusion Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-100">
                  {filteredNotCrawled.map((item, idx) => (
                    <tr key={idx} className="hover:bg-brand-50/60">
                      <td className="p-2.5 pl-3 font-mono text-[11px] text-brand-700 truncate max-w-[400px]">
                        {item.url}
                      </td>
                      <td className="p-2.5 text-[11px] text-brand-500">
                        {item.sources && item.sources.length > 0
                          ? item.sources.map((source) => source.replace(/_/g, " ")).join(" + ")
                          : "—"}
                      </td>
                      <td className="p-2.5 pr-3 text-right">
                        <span className="inline-block rounded-full bg-warning-50 border border-warning-200 text-warning-700 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide whitespace-nowrap">
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
