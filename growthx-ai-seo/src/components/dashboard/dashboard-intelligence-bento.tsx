"use client";

import { useId, useMemo } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Bot,
  FileText,
  Globe,
  MapPin,
  Sparkles,
  Star,
  Swords,
} from "lucide-react";
import type {
  AiReferralsReport,
  Ga4ReportData,
  LocalSeoData,
  VisibilityReport,
} from "@/lib/api-types";
import { resolveCountryGeo } from "@/lib/geo-coordinates";
import { cn } from "@/lib/utils";

/** Compact 14-day inline SVG sparkline for Dashboard KPI tiles */
export function KpiSparkline({
  values,
  tone = "signal",
}: {
  values: number[];
  tone?: "signal" | "accent" | "success";
}) {
  const gradId = useId().replace(/:/g, "");

  const path = useMemo(() => {
    const slice = values.slice(-14);
    if (slice.length < 2) return null;
    const w = 88;
    const h = 28;
    const pad = 2;
    const max = Math.max(...slice, 1);
    const min = Math.min(...slice, 0);
    const span = Math.max(max - min, 1);

    const pts = slice.map((v, idx) => {
      const x = pad + (idx / (slice.length - 1)) * (w - pad * 2);
      const y = h - pad - ((v - min) / span) * (h - pad * 2);
      return [x, y] as const;
    });

    const line = pts
      .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`)
      .join(" ");
    const area = `${line} L${pts[pts.length - 1][0].toFixed(1)},${h} L${pts[0][0].toFixed(1)},${h} Z`;
    return { line, area, last: pts[pts.length - 1] };
  }, [values]);

  if (!path) return null;

  const stroke =
    tone === "accent"
      ? "var(--color-accent-500)"
      : tone === "success"
        ? "var(--color-success-500)"
        : "var(--color-signal-400)";

  return (
    <svg
      viewBox="0 0 88 28"
      className="h-7 w-[88px] shrink-0 overflow-visible"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity={0.28} />
          <stop offset="100%" stopColor={stroke} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={path.area} fill={`url(#${gradId})`} />
      <path
        d={path.line}
        fill="none"
        stroke={stroke}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={path.last[0]} cy={path.last[1]} r={2.3} fill={stroke} />
    </svg>
  );
}

/** Crisp 40px radial health score ring for the Site Health KPI card */
export function MiniHealthRing({ score }: { score: number | null }) {
  const safe = score != null ? Math.max(0, Math.min(score, 100)) : 0;
  const radius = 16;
  const stroke = 3.5;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (safe / 100) * circumference;

  const color =
    score == null
      ? "var(--color-brand-300)"
      : safe >= 80
        ? "var(--color-success-500)"
        : safe >= 50
          ? "var(--color-warning-500)"
          : "var(--color-error-500)";

  return (
    <div className="relative flex h-11 w-11 shrink-0 items-center justify-center" aria-hidden="true">
      <svg className="h-full w-full -rotate-90" viewBox="0 0 40 40">
        <circle
          cx="20"
          cy="20"
          r={radius}
          stroke="var(--color-brand-200)"
          strokeWidth={stroke}
          fill="transparent"
          opacity={0.45}
        />
        {score != null && (
          <circle
            cx="20"
            cy="20"
            r={radius}
            stroke={color}
            strokeWidth={stroke}
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
          />
        )}
      </svg>
      <span className="absolute font-mono text-[11px] font-bold text-brand-950 tabular-nums">
        {score != null ? score : "—"}
      </span>
    </div>
  );
}

const CHANNEL_SEG_CLASSES = ["globe-seg-0", "globe-seg-1", "globe-seg-2", "globe-seg-3"] as const;

function cleanPagePath(raw: string): string {
  if (!raw || raw === "(not set)") return "/";
  try {
    if (raw.startsWith("http://") || raw.startsWith("https://")) {
      const u = new URL(raw);
      return u.pathname || "/";
    }
  } catch {
    // Keep raw string if not a valid URL
  }
  return raw.startsWith("/") ? raw : `/${raw}`;
}

function formatAssistantLabel(raw: string): string {
  const key = raw.toLowerCase();
  if (key.includes("openai") || key.includes("chatgpt") || key.includes("gpt")) return "ChatGPT";
  if (key.includes("perplexity")) return "Perplexity";
  if (key.includes("gemini") || key.includes("google")) return "Gemini";
  if (key.includes("claude") || key.includes("anthropic")) return "Claude";
  if (key.includes("copilot") || key.includes("bing")) return "Copilot";
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

interface DashboardIntelligenceBentoProps {
  ga4Data: Ga4ReportData | null;
  hasGa: boolean;
  visibility: VisibilityReport | null;
  aiReferrals: AiReferralsReport | null;
  localSeo: LocalSeoData | null;
  competitorCount: number;
}

export function DashboardIntelligenceBento({
  ga4Data,
  hasGa,
  visibility,
  aiReferrals,
  localSeo,
  competitorCount,
}: DashboardIntelligenceBentoProps) {
  const channels = useMemo(() => {
    const list = (ga4Data?.channels ?? []).filter((c) => c.sessions > 0);
    const total = list.reduce((sum, c) => sum + c.sessions, 0);
    if (total <= 0) return [];
    return [...list]
      .sort((a, b) => b.sessions - a.sessions)
      .slice(0, 4)
      .map((c) => ({
        name: c.channel,
        sessions: c.sessions,
        sharePct: Math.round((c.sessions / total) * 100),
      }));
  }, [ga4Data]);

  const topCountries = useMemo(() => {
    const list = (ga4Data?.countries ?? []).filter(
      (c) => c.sessions > 0 && c.country && c.country !== "(not set)",
    );
    const max = Math.max(...list.map((c) => c.sessions), 1);
    return [...list]
      .sort((a, b) => b.sessions - a.sessions)
      .slice(0, 4)
      .map((c) => ({
        country: c.country,
        flag: resolveCountryGeo(c.country)?.flag ?? "🌐",
        sessions: c.sessions,
        barPct: Math.max(8, Math.round((c.sessions / max) * 100)),
      }));
  }, [ga4Data]);

  const topPages = useMemo(() => {
    const list = (ga4Data?.landingPages ?? []).filter((p) => p.sessions > 0);
    const max = Math.max(...list.map((p) => p.sessions), 1);
    return [...list]
      .sort((a, b) => b.sessions - a.sessions)
      .slice(0, 5)
      .map((p) => ({
        path: cleanPagePath(p.page),
        sessions: p.sessions,
        engagementPct:
          p.engagementRate <= 1
            ? Math.round(p.engagementRate * 100)
            : Math.round(p.engagementRate),
        barPct: Math.max(8, Math.round((p.sessions / max) * 100)),
      }));
  }, [ga4Data]);

  const aiEngines = useMemo(() => {
    const byAssistant = visibility?.byAssistant ?? [];
    if (byAssistant.length > 0) {
      return byAssistant.slice(0, 5).map((item) => ({
        name: formatAssistantLabel(item.assistant),
        pct: Math.round(item.citationSharePct),
        detail: `${item.cited}/${item.checked} cited`,
      }));
    }
    const byReferral = (aiReferrals?.byEngine ?? []).filter((e) => e.sessions > 0);
    if (byReferral.length > 0) {
      const max = Math.max(...byReferral.map((e) => e.sessions), 1);
      return byReferral.slice(0, 5).map((e) => ({
        name: e.name,
        pct: Math.max(12, Math.round((e.sessions / max) * 100)),
        detail: `${e.sessions} visits`,
      }));
    }
    return [];
  }, [visibility, aiReferrals]);

  const totalAiVisits = aiReferrals?.connected ? aiReferrals.totalAiSessions : null;
  const aiShareOfTraffic = aiReferrals?.connected ? aiReferrals.aiShareOfTotalTrafficPct : null;

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
      {/* CARD 1: AUDIENCE & CHANNEL MIX (4 cols) */}
      <section className="lg:col-span-4 flex flex-col justify-between rounded-2xl border border-brand-200/80 bg-surface-1 p-5 shadow-2xs">
        <div>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-100 text-brand-700">
                <Globe size={14} />
              </span>
              <h2 className="text-[13.5px] font-bold tracking-tight text-brand-950">
                Audience &amp; Channels
              </h2>
            </div>
            <Link
              href="/traffic"
              className="inline-flex items-center gap-0.5 text-[11.5px] font-semibold text-brand-500 hover:text-brand-950 transition"
            >
              <span>3D Globe</span>
              <ArrowUpRight size={12} />
            </Link>
          </div>

          {channels.length > 0 ? (
            <div className="mt-4 space-y-2">
              <div className="flex h-2 w-full gap-0.5 overflow-hidden rounded-full bg-brand-100">
                {channels.map((ch, idx) => (
                  <div
                    key={ch.name}
                    className={cn("h-full rounded-full", CHANNEL_SEG_CLASSES[idx % CHANNEL_SEG_CLASSES.length])}
                    style={{ width: `${Math.max(4, ch.sharePct)}%` }}
                    title={`${ch.name}: ${ch.sessions.toLocaleString()} sessions (${ch.sharePct}%)`}
                  />
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-brand-500">
                {channels.map((ch, idx) => (
                  <span key={ch.name} className="inline-flex items-center gap-1.5">
                    <span
                      className={cn("h-2 w-2 rounded-full", CHANNEL_SEG_CLASSES[idx % CHANNEL_SEG_CLASSES.length])}
                    />
                    <span className="truncate max-w-[92px]">{ch.name}</span>
                    <span className="font-mono font-semibold text-brand-800 tabular-nums">
                      {ch.sharePct}%
                    </span>
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {topCountries.length > 0 ? (
            <div className="mt-4 space-y-2.5 border-t border-brand-100 pt-3.5">
              <p className="text-[10.5px] font-semibold uppercase tracking-wider text-brand-400">
                Top Regions
              </p>
              {topCountries.map((row) => (
                <div key={row.country} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 font-medium text-brand-800 truncate">
                      <span>{row.flag}</span>
                      <span className="truncate">{row.country}</span>
                    </span>
                    <span className="font-mono text-[11.5px] font-semibold text-brand-950 tabular-nums">
                      {row.sessions.toLocaleString()}
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-brand-100">
                    <div
                      className="h-full rounded-full bg-signal-400"
                      style={{ width: `${row.barPct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-6 rounded-xl border border-dashed border-brand-200 px-4 py-6 text-center">
              <p className="text-xs font-medium text-brand-600">
                {hasGa ? "Waiting for regional visitor data" : "Connect GA4 to map audience reach"}
              </p>
              <Link
                href={hasGa ? "/traffic" : "/integrations"}
                className="mt-2 inline-flex items-center gap-1 text-[11.5px] font-semibold text-brand-950 underline"
              >
                <span>{hasGa ? "Open Traffic Map" : "Connect Analytics"}</span>
                <ArrowUpRight size={11} />
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* CARD 2: TOP LANDING PAGES (4 cols) */}
      <section className="lg:col-span-4 flex flex-col justify-between rounded-2xl border border-brand-200/80 bg-surface-1 p-5 shadow-2xs">
        <div>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-100 text-brand-700">
                <FileText size={14} />
              </span>
              <h2 className="text-[13.5px] font-bold tracking-tight text-brand-950">
                Top Landing Pages
              </h2>
            </div>
            <Link
              href="/traffic"
              className="inline-flex items-center gap-0.5 text-[11.5px] font-semibold text-brand-500 hover:text-brand-950 transition"
            >
              <span>All Pages</span>
              <ArrowUpRight size={12} />
            </Link>
          </div>

          {topPages.length > 0 ? (
            <div className="mt-4 space-y-3">
              {topPages.map((pg) => (
                <div key={pg.path} className="space-y-1">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="truncate font-mono text-[11.5px] font-medium text-brand-800" title={pg.path}>
                      {pg.path}
                    </span>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="rounded-md bg-brand-100 px-1.5 py-0.5 font-mono text-[10px] text-brand-500 tabular-nums">
                        {pg.engagementPct}% eng
                      </span>
                      <span className="w-10 text-right font-mono text-[11.5px] font-semibold text-brand-950 tabular-nums">
                        {pg.sessions.toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-brand-100">
                    <div
                      className="h-full rounded-full bg-accent-500"
                      style={{ width: `${pg.barPct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-6 rounded-xl border border-dashed border-brand-200 px-4 py-6 text-center">
              <p className="text-xs font-medium text-brand-600">
                {hasGa ? "No landing page traffic recorded yet" : "Connect GA4 to inspect top pages"}
              </p>
              <Link
                href={hasGa ? "/website" : "/integrations"}
                className="mt-2 inline-flex items-center gap-1 text-[11.5px] font-semibold text-brand-950 underline"
              >
                <span>{hasGa ? "View Crawled Pages" : "Connect Analytics"}</span>
                <ArrowUpRight size={11} />
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* CARD 3: AI ENGINES & LOCAL MAPS PULSE (4 cols) */}
      <section className="lg:col-span-4 flex flex-col justify-between gap-4 rounded-2xl border border-brand-200/80 bg-surface-1 p-5 shadow-2xs">
        <div>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-100 text-brand-700">
                <Sparkles size={14} />
              </span>
              <h2 className="text-[13.5px] font-bold tracking-tight text-brand-950">
                AI &amp; Local Pulse
              </h2>
            </div>
            <Link
              href="/ai-visibility"
              className="inline-flex items-center gap-0.5 text-[11.5px] font-semibold text-brand-500 hover:text-brand-950 transition"
            >
              <span>AI Engines</span>
              <ArrowUpRight size={12} />
            </Link>
          </div>

          {/* AI Engine Bars or Referral Status */}
          {aiEngines.length > 0 ? (
            <div className="mt-4 space-y-2.5">
              {aiEngines.map((eng) => (
                <div key={eng.name} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 font-medium text-brand-800">
                      <Bot size={12} className="text-brand-400" />
                      <span>{eng.name}</span>
                    </span>
                    <span className="font-mono text-[11px] font-semibold text-brand-600 tabular-nums">
                      {eng.detail}
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-brand-100">
                    <div
                      className="h-full rounded-full bg-success-500"
                      style={{ width: `${Math.max(4, Math.min(100, eng.pct))}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-4 flex items-center justify-between rounded-xl border border-brand-200/70 bg-surface-2 px-3.5 py-3">
              <div>
                <p className="text-xs font-semibold text-brand-950">AI Assistant Visits</p>
                <p className="mt-0.5 text-[11px] text-brand-500">
                  {totalAiVisits != null
                    ? `${totalAiVisits} visits (${aiShareOfTraffic != null ? `${aiShareOfTraffic.toFixed(2)}%` : "0%"} share)`
                    : "Run AI Visibility to check 5 assistants"}
                </p>
              </div>
              <Link
                href="/ai-visibility"
                className="rounded-lg bg-signal-400 px-2.5 py-1 text-[11px] font-bold text-signal-ink hover:bg-signal-500 transition"
              >
                Check
              </Link>
            </div>
          )}
        </div>

        {/* Bottom Dual Status Strip: Google Maps + Competitors */}
        <div className="grid grid-cols-2 gap-2.5 border-t border-brand-100 pt-3.5">
          <Link
            href="/local-seo"
            className="group rounded-xl border border-brand-200/70 bg-surface-2 p-3 transition hover:border-brand-300"
          >
            <div className="flex items-center justify-between text-[10.5px] font-medium text-brand-400">
              <span className="inline-flex items-center gap-1">
                <MapPin size={11} />
                Maps
              </span>
              <ArrowUpRight size={11} className="text-brand-400 group-hover:text-brand-950" />
            </div>
            <p className="mt-1.5 flex items-center gap-1 font-mono text-sm font-bold text-brand-950 tabular-nums">
              {localSeo?.rating != null && localSeo.rating > 0 ? (
                <>
                  <span>{localSeo.rating.toFixed(1)}</span>
                  <Star size={12} className="text-warning-500" />
                </>
              ) : (
                <span className="font-sans text-xs font-semibold text-brand-500">Not linked</span>
              )}
            </p>
            <p className="mt-0.5 truncate text-[10.5px] text-brand-400">
              {localSeo?.reviewCount != null && localSeo.reviewCount > 0
                ? `${localSeo.reviewCount.toLocaleString()} reviews`
                : "Connect listing"}
            </p>
          </Link>

          <Link
            href="/competitor-intelligence"
            className="group rounded-xl border border-brand-200/70 bg-surface-2 p-3 transition hover:border-brand-300"
          >
            <div className="flex items-center justify-between text-[10.5px] font-medium text-brand-400">
              <span className="inline-flex items-center gap-1">
                <Swords size={11} />
                Rivals
              </span>
              <ArrowUpRight size={11} className="text-brand-400 group-hover:text-brand-950" />
            </div>
            <p className="mt-1.5 font-mono text-sm font-bold text-brand-950 tabular-nums">
              {competitorCount > 0 ? competitorCount : "—"}
            </p>
            <p className="mt-0.5 truncate text-[10.5px] text-brand-400">
              {competitorCount > 0
                ? `${competitorCount === 1 ? "rival" : "rivals"} tracked`
                : "Track competitors"}
            </p>
          </Link>
        </div>
      </section>
    </div>
  );
}
