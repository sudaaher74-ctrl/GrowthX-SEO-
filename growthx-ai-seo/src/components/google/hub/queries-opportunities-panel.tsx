"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface QueryItem {
  query: string;
  clicks: number;
  impressions: number;
  position: string;
}

export interface PageItem {
  page: string;
  clicks: number;
  impressions: number;
  position: string;
}

export interface OpportunityItem {
  title: string;
  severity: string;
}

export interface AlertItem {
  text: string;
  diff: string;
  time: string;
  up: boolean;
}

export interface QueriesOpportunitiesPanelProps {
  queries: QueryItem[];
  pages: PageItem[];
  opportunities: OpportunityItem[];
  alerts: AlertItem[];
}

export function QueriesOpportunitiesPanel({
  queries,
  pages,
  opportunities,
  alerts,
}: QueriesOpportunitiesPanelProps) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-12 items-stretch">
      {/* Top queries (3 cols) */}
      <div className="lg:col-span-3 rounded-2xl border border-brand-200/50 bg-brand-50/50 p-4 shadow-card backdrop-blur-md flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between gap-2 mb-2">
            <Link href="/google/keywords" className="group flex-1">
              <h3 className="text-xs font-bold text-brand-950 group-hover:text-signal-400 transition">Top queries</h3>
              <p className="text-[11px] text-brand-400">By clicks, then impressions.</p>
            </Link>
            <Link href="/google/keywords" className="text-[11px] font-bold text-signal-400 hover:underline">
              All keywords →
            </Link>
          </div>

          <table className="w-full text-left text-[11px] mt-2">
            <thead>
              <tr className="border-b border-brand-200/50 text-[10px] uppercase font-bold text-brand-400">
                <th className="pb-1.5">Query</th>
                <th className="pb-1.5 text-right">Clicks</th>
                <th className="pb-1.5 text-right">Impr.</th>
                <th className="pb-1.5 text-right">Pos.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-200/40">
              {queries.map((q) => (
                <tr key={q.query} className="text-brand-950 hover:bg-brand-100/50 transition cursor-pointer">
                  <td className="py-2 font-mono truncate max-w-[100px]">
                    <Link href="/google/keywords" className="hover:underline">{q.query}</Link>
                  </td>
                  <td className="py-2 font-mono text-right">{q.clicks}</td>
                  <td className="py-2 font-mono text-right text-brand-400">{q.impressions}</td>
                  <td className="py-2 font-mono text-right text-brand-400">{q.position}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Top pages (3 cols) */}
      <div className="lg:col-span-3 rounded-2xl border border-brand-200/50 bg-brand-50/50 p-4 shadow-card backdrop-blur-md flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between gap-2 mb-2">
            <Link href="/google/pages" className="group flex-1">
              <h3 className="text-xs font-bold text-brand-950 group-hover:text-signal-400 transition">Top pages</h3>
              <p className="text-[11px] text-brand-400">By clicks, then impressions.</p>
            </Link>
            <Link href="/google/pages" className="text-[11px] font-bold text-signal-400 hover:underline">
              All pages →
            </Link>
          </div>

          <table className="w-full text-left text-[11px] mt-2">
            <thead>
              <tr className="border-b border-brand-200/50 text-[10px] uppercase font-bold text-brand-400">
                <th className="pb-1.5">Page</th>
                <th className="pb-1.5 text-right">Clicks</th>
                <th className="pb-1.5 text-right">Impr.</th>
                <th className="pb-1.5 text-right">Pos.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-200/40">
              {pages.map((p) => (
                <tr key={p.page} className="text-brand-950 hover:bg-brand-100/50 transition cursor-pointer">
                  <td className="py-2 font-mono truncate max-w-[100px]">
                    <Link href="/google/pages" className="hover:underline">{p.page}</Link>
                  </td>
                  <td className="py-2 font-mono text-right">{p.clicks}</td>
                  <td className="py-2 font-mono text-right text-brand-400">{p.impressions}</td>
                  <td className="py-2 font-mono text-right text-brand-400">{p.position}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Opportunities (3 cols) */}
      <div className="lg:col-span-3 rounded-2xl border border-brand-200/50 bg-brand-50/50 p-4 shadow-card backdrop-blur-md flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between gap-2 mb-2">
            <Link href="/google/opportunities" className="group flex-1">
              <h3 className="text-xs font-bold text-brand-950 group-hover:text-signal-400 transition">Opportunities</h3>
              <p className="text-[10.5px] text-brand-400">Top SEO opportunities.</p>
            </Link>
            <Link href="/google/opportunities" className="text-brand-400 hover:text-brand-950 transition">
              <ChevronRight size={13} />
            </Link>
          </div>

          <div className="space-y-2 mt-2">
            {opportunities.map((op, i) => (
              <Link
                key={i}
                href="/google/opportunities"
                className="flex items-center justify-between gap-2 rounded-lg p-1.5 hover:bg-brand-100/60 transition text-xs group"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-error-500/20 text-error-500 font-bold text-[9px]">
                    !
                  </span>
                  <span className="truncate font-medium text-brand-950 text-[11px] group-hover:text-signal-400 transition">{op.title}</span>
                </div>
                <span className={cn(
                  "rounded-full px-2 py-0.5 font-bold text-[9.5px] shrink-0",
                  op.severity === "High" ? "bg-error-500/15 text-error-500" : "bg-warning-500/15 text-warning-500"
                )}>
                  {op.severity}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Changes & alerts (3 cols) */}
      <div className="lg:col-span-3 rounded-2xl border border-brand-200/50 bg-brand-50/50 p-4 shadow-card backdrop-blur-md flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between gap-2 mb-2">
            <Link href="/google/changes" className="group flex-1">
              <h3 className="text-xs font-bold text-brand-950 group-hover:text-signal-400 transition">Changes & alerts</h3>
              <p className="text-[10.5px] text-brand-400">From Google.</p>
            </Link>
            <Link href="/google/changes" className="text-brand-400 hover:text-brand-950 transition">
              <ChevronRight size={13} />
            </Link>
          </div>

          <div className="space-y-2 mt-2">
            {alerts.map((al, i) => (
              <Link
                key={i}
                href="/google/changes"
                className="flex items-center justify-between gap-1.5 rounded-lg p-1.5 hover:bg-brand-100/60 transition text-xs group"
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className={cn(
                    "flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px]",
                    al.up ? "bg-success-500/20 text-success-500" : "bg-error-500/20 text-error-500"
                  )}>
                    {al.up ? "↑" : "↓"}
                  </span>
                  <span className="truncate font-medium text-brand-950 text-[11px] group-hover:text-signal-400 transition">{al.text}</span>
                </div>
                <div className="flex items-center gap-1 shrink-0 text-[10px]">
                  <span className={cn("font-mono font-bold", al.up ? "text-success-500" : "text-error-500")}>
                    {al.diff}
                  </span>
                  <span className="text-brand-400">{al.time}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
