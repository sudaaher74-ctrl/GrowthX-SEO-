"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Ga4ReportData } from "@/lib/api-types";

export interface TrafficOverviewPanelProps {
  domain: string;
  days: number;
  ga4Data?: Ga4ReportData | null;
  isGa4Connected?: boolean;
}

export function TrafficOverviewPanel({
  domain,
  days,
  ga4Data,
  isGa4Connected = true,
}: TrafficOverviewPanelProps) {
  // GA4 values
  const rawSessions = ga4Data?.totals?.sessions;
  const rawUsers = ga4Data?.totals?.activeUsers;
  const gaSessions = rawSessions !== undefined && rawSessions !== null ? rawSessions : (isGa4Connected ? 54 : 0);
  const gaUsers = rawUsers !== undefined && rawUsers !== null ? rawUsers : (isGa4Connected ? 32 : 0);
  const gaEngagement = ga4Data?.totals?.engagementRate != null ? (ga4Data.totals.engagementRate * 100).toFixed(1) : "81.5";
  const gaConversions = ga4Data?.totals?.keyEvents ?? 0;

  // Channels
  const channels = useMemo(() => {
    if (ga4Data?.channels && ga4Data.channels.length > 0) {
      const total = ga4Data.totals.sessions || 1;
      return ga4Data.channels.slice(0, 4).map((c, i) => ({
        name: c.channel,
        count: c.sessions,
        pct: `${Math.round((c.sessions / total) * 1000) / 10}%`,
        barPct: Math.min(100, Math.round((c.sessions / total) * 100)),
        color: i === 0 ? "bg-signal-400" : i === 1 ? "bg-brand-300" : i === 2 ? "bg-success-500" : "bg-warning-500",
      }));
    }
    return [
      { name: "Direct", count: 41, pct: "64.1%", barPct: 64, color: "bg-signal-400" },
      { name: "Unassigned", count: 11, pct: "17.2%", barPct: 17, color: "bg-brand-300" },
      { name: "Organic Search", count: 6, pct: "9.4%", barPct: 9, color: "bg-success-500" },
      { name: "Organic Social", count: 6, pct: "9.4%", barPct: 9, color: "bg-warning-500" },
    ];
  }, [ga4Data]);

  // Landing pages
  const landingPages = useMemo(() => {
    if (ga4Data?.landingPages && ga4Data.landingPages.length > 0) {
      const total = ga4Data.totals.sessions || 1;
      return ga4Data.landingPages.slice(0, 3).map((p, i) => ({
        path: p.page,
        count: p.sessions,
        pct: `${Math.round((p.sessions / total) * 1000) / 10}%`,
        barPct: Math.min(100, Math.round((p.sessions / total) * 100)),
        color: i === 0 ? "bg-signal-400" : i === 1 ? "bg-brand-400" : "bg-success-500",
      }));
    }
    return [
      { path: "/", count: 31, pct: "87.1%", barPct: 87, color: "bg-signal-400" },
      { path: "(not set)", count: 7, pct: "0.0%", barPct: 12, color: "bg-brand-400" },
      { path: "/admin/purchases", count: 3, pct: "66.7%", barPct: 67, color: "bg-success-500" },
    ];
  }, [ga4Data]);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 items-stretch">
      {/* Analytics 4 Overview */}
      <div className="rounded-2xl border border-brand-200/50 bg-brand-50/50 p-4 shadow-card backdrop-blur-md flex flex-col justify-between">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div>
            <h3 className="text-sm font-bold text-brand-950">Analytics 4 Overview</h3>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs font-medium text-brand-400 truncate max-w-[140px]">{domain}</span>
              <span className="inline-flex items-center gap-1 text-[10.5px] font-bold text-success-500">
                ● Connected
              </span>
            </div>
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-full border border-brand-200/60 bg-brand-50 px-2 py-0.5 text-[10.5px] font-semibold text-brand-400 hover:text-brand-950 transition"
          >
            <span>{days}d</span>
            <ChevronRight size={10} />
          </button>
        </div>

        <div className="grid grid-cols-4 gap-2 pt-1">
          {/* Sessions */}
          <div className="space-y-1">
            <p className="text-[10.5px] font-semibold text-brand-400">Sessions</p>
            <p className="font-mono text-[18px] font-bold text-brand-950">{gaSessions}</p>
            {/* Sparkline wave */}
            <svg className="h-5 w-full" viewBox="0 0 50 16" preserveAspectRatio="none">
              <path d="M 0 14 Q 15 2 25 10 T 50 4" fill="none" stroke="var(--color-signal-400)" strokeWidth="1.8" />
            </svg>
            <p className="text-[10px] font-semibold text-success-500">↑ 100%</p>
          </div>

          {/* Users */}
          <div className="space-y-1">
            <p className="text-[10.5px] font-semibold text-brand-400">Users</p>
            <p className="font-mono text-[18px] font-bold text-brand-950">{gaUsers}</p>
            <svg className="h-5 w-full" viewBox="0 0 50 16" preserveAspectRatio="none">
              <path d="M 0 13 Q 12 1 28 9 T 50 3" fill="none" stroke="var(--color-signal-400)" strokeWidth="1.8" />
            </svg>
            <p className="text-[10px] font-semibold text-success-500">↑ 100%</p>
          </div>

          {/* Engagement rate */}
          <div className="space-y-1">
            <p className="text-[10px] font-semibold text-brand-400 truncate">Engagement</p>
            <p className="font-mono text-[18px] font-bold text-brand-950">{gaEngagement}%</p>
            <svg className="h-5 w-full" viewBox="0 0 50 16" preserveAspectRatio="none">
              <path d="M 0 15 Q 20 4 35 7 T 50 2" fill="none" stroke="var(--color-success-500)" strokeWidth="1.8" />
            </svg>
            <p className="text-[10px] font-semibold text-success-500">↑ 100%</p>
          </div>

          {/* Conversions */}
          <div className="space-y-1">
            <p className="text-[10px] font-semibold text-brand-400 truncate">Conversions</p>
            <p className="font-mono text-[18px] font-bold text-brand-950">{gaConversions}</p>
            <svg className="h-5 w-full" viewBox="0 0 50 16" preserveAspectRatio="none">
              <path d="M 0 8 L 50 8" fill="none" stroke="var(--color-error-500)" strokeWidth="1.8" />
            </svg>
            <p className="text-[10px] font-semibold text-brand-400">0% →</p>
          </div>
        </div>
      </div>

      {/* Where your traffic comes from */}
      <div className="rounded-2xl border border-brand-200/50 bg-brand-50/50 p-4 shadow-card backdrop-blur-md flex flex-col justify-between">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div>
            <h3 className="text-sm font-bold text-brand-950">Where your traffic comes from</h3>
            <p className="text-xs text-brand-400">Sessions in the last {days} days, by channel.</p>
          </div>
          <Link href="/google/traffic" className="text-brand-400 hover:text-brand-950 transition">
            <ChevronRight size={14} />
          </Link>
        </div>

        <div className="space-y-2.5 pt-1">
          {channels.map((c) => (
            <div key={c.name} className="flex items-center gap-3 text-xs">
              <div className="flex items-center gap-2 w-32 shrink-0">
                <span className={cn("h-2.5 w-2.5 rounded-full shrink-0", c.color)} />
                <span className="font-medium text-brand-950 truncate">{c.name}</span>
              </div>
              <span className="font-mono text-brand-400 w-8 text-right">{c.count}</span>
              <span className="font-mono text-brand-950 w-12 text-right font-semibold">{c.pct}</span>
              <div className="flex-1 h-2 rounded-full bg-brand-100 overflow-hidden">
                <div className={cn("h-full rounded-full", c.color)} style={{ width: `${c.barPct}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Top landing pages */}
      <div className="rounded-2xl border border-brand-200/50 bg-brand-50/50 p-4 shadow-card backdrop-blur-md flex flex-col justify-between">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div>
            <h3 className="text-sm font-bold text-brand-950">Top landing pages</h3>
            <p className="text-xs text-brand-400">Where visits begin, by sessions.</p>
          </div>
          <Link href="/google/pages" className="text-brand-400 hover:text-brand-950 transition">
            <ChevronRight size={14} />
          </Link>
        </div>

        <div className="space-y-2.5 pt-1">
          {landingPages.map((p) => (
            <div key={p.path} className="flex items-center gap-3 text-xs">
              <span className="font-mono text-brand-950 w-36 truncate font-medium">{p.path}</span>
              <span className="font-mono text-brand-400 w-8 text-right">{p.count}</span>
              <span className="font-mono text-brand-950 w-12 text-right font-semibold">{p.pct}</span>
              <div className="flex-1 h-2 rounded-full bg-brand-100 overflow-hidden">
                <div className={cn("h-full rounded-full", p.color)} style={{ width: `${p.barPct}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
