"use client";

import { useMemo, useState } from "react";
import {
  Compass,
  Filter,
  Globe,
  Search,
  Share2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Ga4ReportData } from "@/lib/api-types";
import { count, percent } from "@/lib/google-format";

export type PlatformFilter = "all" | "instagram" | "facebook" | "google" | "direct" | "social" | "referral";

export interface ActiveUsersBySourceProps {
  data: Ga4ReportData;
}

interface SourceRow {
  source: string;
  medium: string;
  channel: string;
  sessions: number;
  users: number;
  engagementRate: number;
  keyEvents: number | null;
  platform: "instagram" | "facebook" | "google" | "direct" | "social" | "referral" | "other";
  platformLabel: string;
}

function classifySource(source: string, medium: string, channel: string): {
  platform: SourceRow["platform"];
  platformLabel: string;
} {
  const s = source.toLowerCase();
  const m = medium.toLowerCase();
  const c = channel.toLowerCase();

  if (s.includes("instagram") || s === "ig" || s.startsWith("l.instagram") || s.startsWith("m.instagram")) {
    return { platform: "instagram", platformLabel: "Instagram" };
  }
  if (s.includes("facebook") || s === "fb" || s.startsWith("m.facebook") || s.startsWith("l.facebook")) {
    return { platform: "facebook", platformLabel: "Facebook" };
  }
  if (s.includes("google") || s.includes("google.com")) {
    return { platform: "google", platformLabel: "Google" };
  }
  if (s.includes("(direct)") || s === "direct") {
    return { platform: "direct", platformLabel: "Direct" };
  }
  if (m.includes("social") || c.includes("social")) {
    return { platform: "social", platformLabel: "Social" };
  }
  if (m.includes("referral") || c.includes("referral")) {
    return { platform: "referral", platformLabel: "Referral" };
  }
  return { platform: "other", platformLabel: "Web / Other" };
}

function PlatformIcon({ platform }: { platform: SourceRow["platform"] }) {
  if (platform === "instagram") {
    return (
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-accent-500/20 text-accent-600 font-bold text-[10px]">
        ig
      </span>
    );
  }
  if (platform === "facebook") {
    return (
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-primary-600/20 text-primary-600 font-bold text-[10px]">
        fb
      </span>
    );
  }
  if (platform === "google") {
    return (
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-signal-400/20 text-signal-ink font-bold text-[10px]">
        <Search size={11} />
      </span>
    );
  }
  if (platform === "direct") {
    return (
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-brand-200/60 text-brand-950 font-bold text-[10px]">
        <Compass size={11} />
      </span>
    );
  }
  if (platform === "social") {
    return (
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-warning-500/20 text-warning-600 font-bold text-[10px]">
        <Share2 size={11} />
      </span>
    );
  }
  return (
    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-brand-100 text-brand-500 font-bold text-[10px]">
      <Globe size={11} />
    </span>
  );
}

export function ActiveUsersBySource({ data }: ActiveUsersBySourceProps) {
  const [metric, setMetric] = useState<"users" | "sessions">("users");
  const [filter, setFilter] = useState<PlatformFilter>("all");
  const [search, setSearch] = useState("");

  const totalUsers = data.totals.activeUsers || 1;
  const totalSessions = data.totals.sessions || 1;
  const baselineTotal = metric === "users" ? totalUsers : totalSessions;

  // Process rows
  const allRows = useMemo<SourceRow[]>(() => {
    if (!data.sources || data.sources.length === 0) {
      // Fallback synthetic view derived from channels if sources not populated
      return (data.channels || []).map((c) => {
        const cls = classifySource(c.channel, "organic", c.channel);
        return {
          source: c.channel.toLowerCase(),
          medium: "organic",
          channel: c.channel,
          sessions: c.sessions,
          users: c.users,
          engagementRate: c.engagementRate ?? 0,
          keyEvents: c.keyEvents ?? null,
          platform: cls.platform,
          platformLabel: cls.platformLabel,
        };
      });
    }

    return data.sources.map((s) => {
      const cls = classifySource(s.source, s.medium, s.channel);
      return {
        ...s,
        platform: cls.platform,
        platformLabel: cls.platformLabel,
      };
    });
  }, [data.sources, data.channels]);

  // Filtered rows
  const filteredRows = useMemo(() => {
    let list = allRows;

    // Platform filter
    if (filter === "instagram") {
      list = list.filter((r) => r.platform === "instagram");
    } else if (filter === "facebook") {
      list = list.filter((r) => r.platform === "facebook");
    } else if (filter === "google") {
      list = list.filter((r) => r.platform === "google");
    } else if (filter === "direct") {
      list = list.filter((r) => r.platform === "direct");
    } else if (filter === "social") {
      list = list.filter((r) => r.platform === "instagram" || r.platform === "facebook" || r.platform === "social");
    } else if (filter === "referral") {
      list = list.filter((r) => r.platform === "referral" || r.medium.includes("referral"));
    }

    // Text search filter
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      list = list.filter(
        (r) =>
          r.source.toLowerCase().includes(q) ||
          r.medium.toLowerCase().includes(q) ||
          r.channel.toLowerCase().includes(q) ||
          r.platformLabel.toLowerCase().includes(q),
      );
    }

    return [...list].sort((a, b) => (metric === "users" ? b.users - a.users : b.sessions - a.sessions));
  }, [allRows, filter, search, metric]);

  const filteredTotal = useMemo(() => {
    return filteredRows.reduce((acc, r) => acc + (metric === "users" ? r.users : r.sessions), 0);
  }, [filteredRows, metric]);

  const maxVal = useMemo(() => {
    if (filteredRows.length === 0) return 1;
    return Math.max(...filteredRows.map((r) => (metric === "users" ? r.users : r.sessions)), 1);
  }, [filteredRows, metric]);

  return (
    <div className="rounded-2xl border border-brand-200/50 bg-brand-50/50 p-4 shadow-card backdrop-blur-md space-y-4">
      {/* Header with Title and Metric Toggle */}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-brand-200/30 pb-3">
        <div>
          <h3 className="text-sm font-bold text-brand-950">
            {metric === "users" ? "Active users by Source / Medium" : "Sessions by Source / Medium"}
          </h3>
          <p className="text-[11.5px] text-brand-400 mt-0.5">
            Identify exactly where your visitors come from — Instagram, Facebook, Google, Direct, and referrals.
          </p>
        </div>

        {/* Metric Switcher */}
        <div
          role="group"
          aria-label="Metric toggle"
          className="inline-flex items-center gap-1 rounded-full bg-brand-100 p-0.5 text-[11px]"
        >
          <button
            type="button"
            onClick={() => setMetric("users")}
            className={cn(
              "rounded-full px-2.5 py-1 font-semibold transition-colors",
              metric === "users"
                ? "bg-signal-400 text-signal-ink font-bold shadow-xs"
                : "text-brand-400 hover:text-brand-950",
            )}
          >
            Active users
          </button>
          <button
            type="button"
            onClick={() => setMetric("sessions")}
            className={cn(
              "rounded-full px-2.5 py-1 font-semibold transition-colors",
              metric === "sessions"
                ? "bg-brand-50 text-brand-950 font-bold shadow-xs"
                : "text-brand-400 hover:text-brand-950",
            )}
          >
            Sessions
          </button>
        </div>
      </div>

      {/* Filter Chips Bar & Live Search */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Quick Platform Filters */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="flex items-center gap-1 text-[11px] font-semibold text-brand-400 mr-1">
            <Filter size={11} />
            <span>Filter:</span>
          </span>

          <button
            type="button"
            onClick={() => setFilter("all")}
            className={cn(
              "rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-all",
              filter === "all"
                ? "bg-brand-950 text-brand-50 shadow-xs"
                : "bg-brand-100/70 text-brand-600 hover:bg-brand-200/60 hover:text-brand-950",
            )}
          >
            All
          </button>

          <button
            type="button"
            onClick={() => setFilter("instagram")}
            className={cn(
              "rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-all flex items-center gap-1",
              filter === "instagram"
                ? "bg-accent-500 text-white shadow-xs"
                : "bg-brand-100/70 text-brand-600 hover:bg-brand-200/60 hover:text-brand-950",
            )}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-accent-400" />
            <span>Instagram</span>
          </button>

          <button
            type="button"
            onClick={() => setFilter("facebook")}
            className={cn(
              "rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-all flex items-center gap-1",
              filter === "facebook"
                ? "bg-primary-600 text-white shadow-xs"
                : "bg-brand-100/70 text-brand-600 hover:bg-brand-200/60 hover:text-brand-950",
            )}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-primary-400" />
            <span>Facebook</span>
          </button>

          <button
            type="button"
            onClick={() => setFilter("google")}
            className={cn(
              "rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-all flex items-center gap-1",
              filter === "google"
                ? "bg-signal-400 text-signal-ink font-bold shadow-xs"
                : "bg-brand-100/70 text-brand-600 hover:bg-brand-200/60 hover:text-brand-950",
            )}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-signal-ink" />
            <span>Google</span>
          </button>

          <button
            type="button"
            onClick={() => setFilter("direct")}
            className={cn(
              "rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-all",
              filter === "direct"
                ? "bg-brand-950 text-brand-50 shadow-xs"
                : "bg-brand-100/70 text-brand-600 hover:bg-brand-200/60 hover:text-brand-950",
            )}
          >
            Direct
          </button>

          <button
            type="button"
            onClick={() => setFilter("social")}
            className={cn(
              "rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-all",
              filter === "social"
                ? "bg-warning-500 text-white shadow-xs"
                : "bg-brand-100/70 text-brand-600 hover:bg-brand-200/60 hover:text-brand-950",
            )}
          >
            All Social
          </button>
        </div>

        {/* Live Search Input */}
        <div className="relative min-w-[200px] flex-1 sm:flex-initial">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-brand-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search source (e.g. instagram, ig)..."
            className="w-full rounded-xl border border-brand-200/70 bg-brand-100/40 py-1 pl-7 pr-7 text-[11.5px] text-brand-950 placeholder:text-brand-400 focus:outline-hidden focus:ring-1 focus:ring-brand-400"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-brand-400 hover:text-brand-950"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Active Filter Indicator */}
      {(filter !== "all" || search) && (
        <div className="flex items-center justify-between rounded-xl bg-brand-100/60 px-3 py-1.5 text-[11.5px] border border-brand-200/40">
          <span className="text-brand-600">
            Showing <strong className="text-brand-950">{filteredRows.length}</strong> sources ·{" "}
            <strong className="text-brand-950">{count(filteredTotal)}</strong> {metric === "users" ? "active users" : "sessions"} (
            {percent(filteredTotal / baselineTotal)} of all {metric})
          </span>
          <button
            type="button"
            onClick={() => {
              setFilter("all");
              setSearch("");
            }}
            className="text-[11px] font-semibold text-accent-600 hover:underline"
          >
            Clear filter
          </button>
        </div>
      )}

      {/* Sources List / Table with Volume Bars */}
      <div className="overflow-x-auto rounded-xl border border-brand-200/40 bg-brand-50">
        {filteredRows.length === 0 ? (
          <div className="py-10 text-center text-xs text-brand-400">
            No traffic sources match the current filter. Try clearing your search or selecting &ldquo;All&rdquo;.
          </div>
        ) : (
          <div className="divide-y divide-brand-200/30">
            {/* Table Header */}
            <div className="grid grid-cols-12 gap-3 px-3 py-2 text-[10.5px] font-bold uppercase tracking-wider text-brand-400 bg-brand-100/40">
              <div className="col-span-5 sm:col-span-4">Source / Medium</div>
              <div className="col-span-3 sm:col-span-3">Channel</div>
              <div className="col-span-2 sm:col-span-2 text-right">
                {metric === "users" ? "Active users" : "Sessions"}
              </div>
              <div className="col-span-2 sm:col-span-3">Volume share</div>
            </div>

            {/* Rows */}
            {filteredRows.map((r) => {
              const val = metric === "users" ? r.users : r.sessions;
              const shareOfBaseline = baselineTotal > 0 ? val / baselineTotal : 0;
              const barWidth = Math.max(3, Math.round((val / maxVal) * 100));

              return (
                <div
                  key={`${r.source}/${r.medium}/${r.channel}`}
                  className="grid grid-cols-12 gap-3 px-3 py-2.5 text-xs items-center hover:bg-brand-100/40 transition-colors"
                >
                  {/* Source / Medium */}
                  <div className="col-span-5 sm:col-span-4 flex items-center gap-2 truncate">
                    <PlatformIcon platform={r.platform} />
                    <div className="truncate">
                      <span className="font-semibold text-brand-950 truncate block" title={`${r.source} / ${r.medium}`}>
                        {r.source} / {r.medium}
                      </span>
                      <span className="text-[10px] text-brand-400">{r.platformLabel}</span>
                    </div>
                  </div>

                  {/* Channel badge */}
                  <div className="col-span-3 sm:col-span-3">
                    <span className="inline-block rounded-md bg-brand-100 px-2 py-0.5 text-[10.5px] font-medium text-brand-700 truncate max-w-full">
                      {r.channel}
                    </span>
                  </div>

                  {/* Metric Value */}
                  <div className="col-span-2 sm:col-span-2 text-right">
                    <span className="font-mono font-bold text-brand-950">{count(val)}</span>
                    <span className="block text-[10px] text-brand-400">{percent(shareOfBaseline)}</span>
                  </div>

                  {/* Horizontal Bar Graphic */}
                  <div className="col-span-2 sm:col-span-3 flex items-center gap-2">
                    <div className="h-2 w-full rounded-full bg-brand-200/50 overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all duration-300",
                          r.platform === "instagram"
                            ? "bg-accent-500"
                            : r.platform === "facebook"
                              ? "bg-primary-500"
                              : r.platform === "google"
                                ? "bg-signal-400"
                                : "bg-brand-400",
                        )}
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
