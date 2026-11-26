"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowUpRight,
  Bot,
  Compass,
  Laptop,
  Monitor,
  Share2,
  Smartphone,
  Sparkles,
  Tablet,
} from "lucide-react";
import type { AiReferralsReport, GscRow } from "@/lib/api-types";
import { count, percent } from "@/lib/google-format";
import { cn } from "@/lib/utils";

export interface EnrichedChannelRow {
  name: string;
  share: number;
  count: number;
  organic: boolean;
  engagementRate: number | null;
  keyEvents: number | null;
}

interface TrafficAcquisitionBentoProps {
  channels: EnrichedChannelRow[];
  sources: EnrichedChannelRow[];
  aiReferrals: AiReferralsReport | null | undefined;
  aiLoading: boolean;
  deviceRows: GscRow[];
  periodDays: number;
}

const AI_ENGINE_BADGE: Record<string, string> = {
  chatgpt: "🤖",
  perplexity: "🔍",
  gemini: "✨",
  claude: "🧠",
  copilot: "💻",
  you: "🌐",
  poe: "💬",
};

function deviceIcon(key: string) {
  const upper = key.toUpperCase();
  if (upper.includes("MOBILE")) return Smartphone;
  if (upper.includes("TABLET")) return Tablet;
  if (upper.includes("DESKTOP")) return Monitor;
  return Laptop;
}

function formatDeviceLabel(key: string): string {
  const lower = key.trim().toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

export function TrafficAcquisitionBento({
  channels,
  sources,
  aiReferrals,
  aiLoading,
  deviceRows,
  periodDays,
}: TrafficAcquisitionBentoProps) {
  const [originMode, setOriginMode] = useState<"channels" | "sites">("channels");
  const rows = originMode === "channels" ? channels : sources;

  const totalDeviceClicks = deviceRows.reduce((sum, r) => sum + (r.clicks ?? 0), 0);
  const totalDeviceImpressions = deviceRows.reduce((sum, r) => sum + (r.impressions ?? 0), 0);
  const deviceDenominator = totalDeviceClicks > 0 ? totalDeviceClicks : Math.max(totalDeviceImpressions, 1);

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 items-stretch">
      {/* ── LEFT (6 COLS): CHANNELS & SOURCES WITH ENGAGEMENT + CONVERSIONS ── */}
      <div className="lg:col-span-6 rounded-2xl border border-brand-200/70 bg-surface-1 p-5 shadow-card flex flex-col justify-between">
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <Share2 className="h-4 w-4 text-brand-500" />
                <h2 className="text-sm font-bold text-brand-950">Acquisition &amp; Engagement</h2>
              </div>
              <p className="mt-0.5 text-[11px] text-brand-400">
                Channel volume paired with GA4 engagement quality &amp; key events
              </p>
            </div>

            <div className="inline-flex rounded-xl border border-brand-200/80 bg-brand-100/50 p-0.5 text-[11px] font-semibold">
              <button
                type="button"
                onClick={() => setOriginMode("channels")}
                className={cn(
                  "rounded-lg px-2.5 py-1 transition cursor-pointer",
                  originMode === "channels"
                    ? "bg-brand-950 text-brand-50 shadow-xs"
                    : "text-brand-500 hover:text-brand-950",
                )}
              >
                Channels
              </button>
              <button
                type="button"
                onClick={() => setOriginMode("sites")}
                className={cn(
                  "rounded-lg px-2.5 py-1 transition cursor-pointer",
                  originMode === "sites"
                    ? "bg-brand-950 text-brand-50 shadow-xs"
                    : "text-brand-500 hover:text-brand-950",
                )}
              >
                Referrers
              </button>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-brand-200/60 text-[10.5px] uppercase tracking-wider text-brand-400">
                  <th className="pb-2.5 font-semibold">
                    {originMode === "channels" ? "Channel" : "Source / Medium"}
                  </th>
                  <th className="pb-2.5 font-semibold">Share</th>
                  <th className="pb-2.5 text-right font-semibold">Engaged</th>
                  <th className="pb-2.5 text-right font-semibold">Key Events</th>
                  <th className="pb-2.5 text-right font-semibold">Sessions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-100">
                {rows.length > 0 ? (
                  rows.slice(0, 8).map((row) => (
                    <tr key={row.name} className="hover:bg-brand-100/40 transition">
                      <td className="py-2.5 pr-2 font-semibold text-brand-950">
                        <div className="flex items-center gap-1.5 min-w-0">
                          {row.organic ? (
                            <span className="shrink-0 rounded bg-success-50 px-1.5 py-0.5 text-[9.5px] font-bold text-success-700">
                              Org
                            </span>
                          ) : (
                            <Compass className="h-3.5 w-3.5 shrink-0 text-brand-400" />
                          )}
                          <span className="truncate max-w-[160px]" title={row.name}>
                            {row.name}
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 pr-3">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-brand-200/50">
                            <div
                              className={cn(
                                "h-full rounded-full",
                                row.organic ? "bg-success-500" : "bg-primary-500",
                              )}
                              style={{ width: `${Math.max(row.share * 100, 4)}%` }}
                            />
                          </div>
                          <span className="font-mono text-[10.5px] text-brand-500">
                            {percent(row.share)}
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 pr-2 text-right font-mono text-[11px] text-brand-600">
                        {row.engagementRate !== null ? percent(row.engagementRate) : "—"}
                      </td>
                      <td className="py-2.5 pr-2 text-right font-mono text-[11px] text-brand-600">
                        {row.keyEvents !== null ? count(row.keyEvents) : "—"}
                      </td>
                      <td className="py-2.5 text-right font-mono font-bold text-brand-950">
                        {count(row.count)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-brand-400">
                      No traffic channels recorded for this period yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── MIDDLE (3 COLS): AI SEARCH ENGINE REFERRALS ── */}
      <div className="lg:col-span-3 rounded-2xl border border-brand-200/70 bg-surface-1 p-5 shadow-card flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
                <Bot className="h-4 w-4" />
              </span>
              <div>
                <h2 className="text-sm font-bold text-brand-950">AI Referrals</h2>
                <p className="text-[10.5px] text-brand-400">ChatGPT · Perplexity · Gemini</p>
              </div>
            </div>
            <Link
              href="/ai-visibility"
              title="Open AI Visibility"
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-brand-200 text-brand-500 hover:bg-brand-100 hover:text-brand-950 transition"
            >
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {aiLoading ? (
            <p className="mt-6 text-xs text-brand-400">Measuring AI engine sessions…</p>
          ) : !aiReferrals || !aiReferrals.connected ? (
            <div className="mt-5 rounded-xl border border-brand-200/70 bg-brand-50/70 p-3.5 text-xs text-brand-500">
              Connect GA4 to track sessions and conversions arriving from ChatGPT, Perplexity, Gemini, and Claude.
            </div>
          ) : (
            <>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-brand-100/60 p-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-brand-400">
                    AI Visits
                  </p>
                  <p className="mt-1 font-mono text-xl font-extrabold text-brand-950">
                    {count(aiReferrals.totalAiSessions)}
                  </p>
                  <p className="text-[10px] text-brand-400">
                    {aiReferrals.aiShareOfTotalTrafficPct}% of site
                  </p>
                </div>
                <div className="rounded-xl bg-brand-100/60 p-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-brand-400">
                    Conversions
                  </p>
                  <p className="mt-1 font-mono text-xl font-extrabold text-brand-950">
                    {count(aiReferrals.totalAiConversions)}
                  </p>
                  <p className="text-[10px] text-brand-400">
                    {count(aiReferrals.totalAiUsers)} users
                  </p>
                </div>
              </div>

              <div className="mt-3.5 space-y-2">
                {aiReferrals.byEngine.length > 0 ? (
                  aiReferrals.byEngine.slice(0, 5).map((eng) => {
                    const maxSess = Math.max(aiReferrals.byEngine[0]?.sessions ?? 1, 1);
                    const icon = AI_ENGINE_BADGE[eng.key.toLowerCase()] ?? "✨";
                    return (
                      <div key={eng.key} className="space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-semibold text-brand-900">
                            {icon} {eng.name}
                          </span>
                          <span className="font-mono font-bold text-brand-950">
                            {count(eng.sessions)}
                          </span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-brand-200/60">
                          <div
                            className="h-full rounded-full bg-primary-500"
                            style={{ width: `${Math.max(8, (eng.sessions / maxSess) * 100)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="py-3 text-[11px] text-brand-400">
                    No AI search referral sessions recorded in the last {periodDays} days yet.
                  </p>
                )}
              </div>

              {aiReferrals.impactTimeline?.hasFixes && aiReferrals.impactTimeline.comparison && (
                <div className="mt-3.5 rounded-xl border border-brand-200/70 bg-brand-50/70 p-2.5 text-[10.5px]">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1 font-semibold text-brand-700">
                      <Sparkles className="h-3 w-3 text-primary-600" />
                      Post-Fix Lift
                    </span>
                    {aiReferrals.impactTimeline.comparison.sessionsDeltaPct !== null && (
                      <span
                        className={cn(
                          "font-mono font-bold",
                          aiReferrals.impactTimeline.comparison.sessionsDeltaPct >= 0
                            ? "text-success-700"
                            : "text-error-700",
                        )}
                      >
                        {aiReferrals.impactTimeline.comparison.sessionsDeltaPct >= 0 ? "+" : ""}
                        {aiReferrals.impactTimeline.comparison.sessionsDeltaPct}%
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-brand-500 line-clamp-2">
                    {aiReferrals.impactTimeline.comparison.beforeSessions} → {aiReferrals.impactTimeline.comparison.afterSessions} sessions
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── RIGHT (3 COLS): SEARCH DEVICE SPLIT ── */}
      <div className="lg:col-span-3 rounded-2xl border border-brand-200/70 bg-surface-1 p-5 shadow-card flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent-50 text-accent-700">
              <Smartphone className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-sm font-bold text-brand-950">Device Split</h2>
              <p className="text-[10.5px] text-brand-400">Search Console · {periodDays}d</p>
            </div>
          </div>

          {deviceRows.length > 0 ? (
            <div className="mt-4 space-y-3.5">
              {/* Segmented distribution strip */}
              <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-brand-100">
                {deviceRows.map((row, idx) => {
                  const metricVal = totalDeviceClicks > 0 ? row.clicks : row.impressions;
                  const share = metricVal / deviceDenominator;
                  return (
                    <div
                      key={row.key}
                      title={`${formatDeviceLabel(row.key)}: ${percent(share)}`}
                      className={cn(
                        "h-full",
                        idx === 0 ? "globe-seg-0" : idx === 1 ? "globe-seg-3" : "globe-seg-1",
                      )}
                      style={{ width: `${Math.max(share * 100, 3)}%` }}
                    />
                  );
                })}
              </div>

              <div className="space-y-2.5">
                {deviceRows.map((row, idx) => {
                  const Icon = deviceIcon(row.key);
                  const metricVal = totalDeviceClicks > 0 ? row.clicks : row.impressions;
                  const share = metricVal / deviceDenominator;
                  return (
                    <div
                      key={row.key}
                      className="rounded-xl border border-brand-200/60 bg-brand-50/50 p-2.5"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="inline-flex items-center gap-1.5 font-semibold text-brand-950">
                          <span
                            className={cn(
                              "h-2 w-2 rounded-full",
                              idx === 0 ? "globe-seg-0" : idx === 1 ? "globe-seg-3" : "globe-seg-1",
                            )}
                          />
                          <Icon className="h-3.5 w-3.5 text-brand-500" />
                          <span>{formatDeviceLabel(row.key)}</span>
                        </span>
                        <span className="font-mono font-bold text-brand-950">
                          {percent(share)}
                        </span>
                      </div>
                      <div className="mt-1.5 flex items-center justify-between font-mono text-[10.5px] text-brand-500">
                        <span>{count(row.clicks)} clicks</span>
                        <span>{percent(row.ctr)} CTR</span>
                        <span>#{row.position.toFixed(1)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="mt-5 rounded-xl border border-brand-200/70 bg-brand-50/70 p-3.5 text-xs text-brand-400">
              Connect Search Console to compare Mobile, Desktop, and Tablet search performance.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
