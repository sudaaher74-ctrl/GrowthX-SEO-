"use client";

import React from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { Measure } from "@/lib/api-client";
import { cn } from "@/lib/utils";

function MiniRing({
  pct,
  centerText,
  strokeColor,
  measured,
  ariaLabel,
}: {
  pct: number;
  centerText: string;
  strokeColor: string;
  measured: boolean;
  ariaLabel: string;
}) {
  const size = 54;
  const strokeWidth = 5;
  const radius = (size - strokeWidth - 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(100, Math.max(0, pct));
  const offset = circumference * (1 - clamped / 100);

  return (
    <div
      className="relative flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
      role="img"
      aria-label={ariaLabel}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90 transform">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-brand-200)"
          strokeOpacity={0.55}
          strokeWidth={strokeWidth}
        />
        {measured && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-700 ease-out"
          />
        )}
      </svg>
      <span className="absolute font-mono text-[12px] font-bold tracking-tight text-brand-950 tabular-nums">
        {centerText}
      </span>
    </div>
  );
}

function compactCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${Math.round(n / 1_000)}k`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(Math.round(n));
}

export function DashboardPillarRings({
  healthScore,
  pagesChecked,
  crawlCompleted,
  searchClicks,
  sessions,
  hasGoogle,
  localRating,
  localReviews,
  hasLocal,
  aiCitationSharePct,
  aiCited,
  aiChecked,
}: {
  healthScore: number | null;
  pagesChecked: number | null;
  crawlCompleted: boolean;
  searchClicks?: Measure;
  sessions?: Measure;
  hasGoogle: boolean;
  localRating: number | null;
  localReviews: number | null;
  hasLocal: boolean;
  aiCitationSharePct: number | null;
  aiCited: number;
  aiChecked: number;
}) {
  // 1. Website Health
  const healthMeasured = crawlCompleted && healthScore != null;
  const healthColor =
    !healthMeasured
      ? "var(--color-brand-300)"
      : healthScore >= 80
        ? "var(--color-success-500)"
        : healthScore >= 50
          ? "var(--color-warning-500)"
          : "var(--color-error-500)";

  // 2. Organic Traffic (prefer measured clicks, fallback to GA4 sessions)
  const primaryTraffic =
    searchClicks?.state === "MEASURED"
      ? { label: "Google Clicks", measure: searchClicks }
      : sessions?.state === "MEASURED"
        ? { label: "Website Visits", measure: sessions }
        : null;
  const trafficDelta = primaryTraffic?.measure.changePct ?? null;
  const trafficRingPct = primaryTraffic
    ? primaryTraffic.measure.value > 0
      ? 100
      : 12
    : 0;
  const trafficColor =
    trafficDelta != null && trafficDelta < 0
      ? "var(--color-warning-500)"
      : "var(--color-accent-500)";

  // 3. Local & Maps
  const localMeasured = hasLocal && localRating != null && localRating > 0;
  const localPct = localMeasured ? (localRating / 5) * 100 : 0;
  const localColor =
    !localMeasured
      ? "var(--color-brand-300)"
      : localRating >= 4.2
        ? "var(--color-success-500)"
        : localRating >= 3.5
          ? "var(--color-warning-500)"
          : "var(--color-error-500)";

  // 4. AI Visibility
  const aiMeasured = aiChecked > 0 && aiCitationSharePct != null;
  const aiRounded = aiMeasured ? Math.round(aiCitationSharePct) : 0;
  const aiColor =
    !aiMeasured
      ? "var(--color-brand-300)"
      : aiRounded >= 50
        ? "var(--color-success-500)"
        : aiRounded > 0
          ? "var(--color-accent-500)"
          : "var(--color-warning-500)";

  const pillars = [
    {
      href: "/website",
      label: "Website Health",
      pct: healthMeasured ? healthScore : 0,
      centerText: healthMeasured ? String(Math.round(healthScore)) : "—",
      strokeColor: healthColor,
      measured: healthMeasured,
      headline: healthMeasured
        ? healthScore >= 80
          ? "Healthy"
          : healthScore >= 50
            ? "Needs work"
            : "At risk"
        : "Not audited",
      sub: healthMeasured
        ? pagesChecked != null
          ? `${pagesChecked.toLocaleString()} pages crawled`
          : "Score out of 100"
        : "Run website audit",
      delta: null as number | null,
    },
    {
      href: "/google",
      label: primaryTraffic?.label ?? "Search & Traffic",
      pct: trafficRingPct,
      centerText: primaryTraffic ? compactCount(primaryTraffic.measure.value) : "—",
      strokeColor: trafficColor,
      measured: Boolean(primaryTraffic),
      headline: primaryTraffic
        ? `${primaryTraffic.measure.value.toLocaleString()}`
        : hasGoogle
          ? "Syncing"
          : "Not connected",
      sub: primaryTraffic
        ? "Last 28 days"
        : hasGoogle
          ? "Waiting for Google data"
          : "Connect GSC or GA4",
      delta: trafficDelta,
    },
    {
      href: "/local-seo",
      label: "Local & Maps",
      pct: localPct,
      centerText: localMeasured ? `${localRating.toFixed(1)}★` : "—",
      strokeColor: localColor,
      measured: localMeasured,
      headline: localMeasured
        ? `${localReviews != null ? localReviews.toLocaleString() : 0} reviews`
        : "Not linked",
      sub: localMeasured ? "Google Maps listing" : "Connect Maps profile",
      delta: null as number | null,
    },
    {
      href: "/ai-visibility",
      label: "AI Visibility",
      pct: aiRounded,
      centerText: aiMeasured ? `${aiRounded}%` : "—",
      strokeColor: aiColor,
      measured: aiMeasured,
      headline: aiMeasured ? `${aiCited}/${aiChecked} cited` : "Not scanned",
      sub: aiMeasured ? "Across AI assistants" : "Check AI citations",
      delta: null as number | null,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {pillars.map((p) => (
        <Link
          key={p.href}
          href={p.href}
          className="group flex items-center gap-3.5 rounded-2xl border border-brand-200/80 bg-surface-1 p-3.5 shadow-2xs transition-all hover:border-brand-300 hover:shadow-xs"
        >
          <MiniRing
            pct={p.pct}
            centerText={p.centerText}
            strokeColor={p.strokeColor}
            measured={p.measured}
            ariaLabel={`${p.label}: ${p.centerText}`}
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-1">
              <p className="text-[10.5px] font-semibold uppercase tracking-wider text-brand-400 truncate">
                {p.label}
              </p>
              <ArrowUpRight
                size={13}
                className="shrink-0 text-brand-300 transition-colors group-hover:text-brand-700"
              />
            </div>
            <div className="mt-0.5 flex items-baseline gap-1.5">
              <p className="text-[14px] font-bold text-brand-950 truncate tabular-nums">
                {p.headline}
              </p>
              {p.delta != null && Number.isFinite(p.delta) && (
                <span
                  className={cn(
                    "font-mono text-[10.5px] font-semibold tabular-nums shrink-0",
                    p.delta >= 0 ? "text-success-700" : "text-error-700",
                  )}
                >
                  {p.delta >= 0 ? "+" : "−"}
                  {Math.round(Math.abs(p.delta))}%
                </span>
              )}
            </div>
            <p className="mt-0.5 text-[11px] text-brand-500 truncate">{p.sub}</p>
          </div>
        </Link>
      ))}
    </div>
  );
}
