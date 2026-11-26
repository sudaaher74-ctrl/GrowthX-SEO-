"use client";
import Link from "next/link";
import { Suspense, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Calendar,
  Compass,
  FileText,
  MousePointerClick,
  Search,
  Share2,
  Target,
  Users,
} from "lucide-react";
import { Panel, Tabs } from "@/components/ui/console";
import { ImprovementReportView } from "@/components/google/improvement-report-view";
import { RealtimeActivity } from "@/components/google/realtime-activity";
import {
  GlobalTrafficGlobe,
  type TrafficCityRow,
  type TrafficCountryRow,
} from "@/components/google/global-traffic-globe";
import { detectDatacenterCity, resolveCityGeo, resolveCountryGeo } from "@/lib/geo-coordinates";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  CHART_AXIS_TICK,
  CHART_CURSOR_LINE,
  CHART_GRID_PROPS,
  ChartTooltipCard,
} from "@/components/ui/chart-primitives";
import { useGa4Report } from "@/hooks/use-ga4-report";
import {
  useGoogleBreakdown,
  useGscQueries,
  useGscSummary,
  useGscTimeseries,
} from "@/hooks/use-google";
import { usePeriodDays, useWorkspace } from "@/hooks/use-growthx";
import { AiReferralsCard } from "@/components/analytics/ai-referrals-card";
import type { Ga4ReportData } from "@/lib/api-client";
import { count, percent, shortDay } from "@/lib/google-format";
import { cn } from "@/lib/utils";

/** Normalizes URL path for clean display */
function pathOf(urlOrPath: string): string {
  try {
    if (urlOrPath.startsWith("http://") || urlOrPath.startsWith("https://")) {
      const u = new URL(urlOrPath);
      return u.pathname || "/";
    }
    return urlOrPath.startsWith("/") ? urlOrPath : `/${urlOrPath}`;
  } catch {
    return urlOrPath || "/";
  }
}

interface TrafficOriginItem {
  name: string;
  share: number;
  count: number;
  organic: boolean;
}

const TRAFFIC_TABS = [
  { id: "overview", label: "Traffic Overview", icon: Activity },
  { id: "report", label: "Report", icon: FileText },
] as const;

type TrafficTabId = (typeof TRAFFIC_TABS)[number]["id"];

/**
 * TrafficView
 *
 * Real-time traffic, visitors, geography (interactive global map),
 * top cities, channels and referrers breakdown, landing pages, search queries,
 * and the Business & Traffic Improvement Report tab.
 */
export function TrafficView() {
  return (
    <Suspense fallback={<div className="p-8 text-xs text-brand-400">Loading Traffic…</div>}>
      <TrafficViewClient />
    </Suspense>
  );
}

function TrafficViewClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const rawTab = searchParams.get("tab");
  const activeTab: TrafficTabId = rawTab === "report" ? "report" : "overview";

  const selectTab = (newTab: TrafficTabId) => {
    const params = new URLSearchParams(searchParams.toString());
    if (newTab === "overview") {
      params.delete("tab");
    } else {
      params.set("tab", newTab);
    }
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const { projectId } = useWorkspace();
  const periodDays = usePeriodDays();
  const [trafficOriginMode, setTrafficOriginMode] = useState<"channels" | "sites">("channels");

  // Queries
  const { report } = useGa4Report(projectId);
  const gscSummary = useGscSummary(projectId);
  const gscTimeseries = useGscTimeseries(projectId);
  const countryBreakdown = useGoogleBreakdown(projectId, "country");
  const gscQueries = useGscQueries(projectId);

  const reportData: Ga4ReportData | null = report.data?.data ?? null;
  const ga4State = report.data?.state;

  // KPIs
  const totals = reportData?.totals;
  const visitorsCount = totals?.activeUsers ?? null;
  const sessionsCount = totals?.sessions ?? null;
  const sessionsPerVisitor = visitorsCount != null && visitorsCount > 0 && sessionsCount != null ? (sessionsCount / visitorsCount).toFixed(1) : "—";

  const searchClicks = gscSummary.query.data?.clicks?.current ?? null;
  const searchClicksChangePct = gscSummary.query.data?.clicks?.changePct;
  const roundedClicksChangePct =
    searchClicksChangePct !== null && searchClicksChangePct !== undefined && Number.isFinite(searchClicksChangePct)
      ? Math.round(searchClicksChangePct * 10) / 10
      : null;
  const searchImpressions = gscSummary.query.data?.impressions?.current ?? null;
  const searchCtr = gscSummary.query.data?.ctr?.current ?? null;
  const searchPosition = gscSummary.query.data?.position?.current ?? null;
  const positionChangePct = gscSummary.query.data?.position?.changePct;
  const roundedPositionChangePct =
    positionChangePct !== null && positionChangePct !== undefined && Number.isFinite(positionChangePct)
      ? Math.round(positionChangePct * 10) / 10
      : null;

  // Build daily timeline combining GA4 visitors and GSC clicks
  const dailyChartData = useMemo(() => {
    const map = new Map<string, { date: string; visitors: number | null; searchClicks: number | null }>();

    for (const p of gscTimeseries.query.data ?? []) {
      // Search Console serializes database dates as ISO timestamps, while GA4
      // uses YYYY-MM-DD. Use the calendar day so both sources share one point.
      const date = p.date.slice(0, 10);
      const existing = map.get(date) ?? { date, visitors: null, searchClicks: null };
      existing.searchClicks = p.clicks ?? null;
      map.set(date, existing);
    }

    for (const d of reportData?.daily ?? []) {
      const date = d.date.slice(0, 10);
      const existing = map.get(date) ?? { date, visitors: null, searchClicks: null };
      existing.visitors = d.users ?? null;
      map.set(date, existing);
    }

    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [gscTimeseries.query.data, reportData?.daily]);

  // Channels / Sources Breakdown
  const channelBreakdown = useMemo<TrafficOriginItem[]>(() => {
    if (!reportData?.channels || reportData.channels.length === 0) {
      return [];
    }
    const totalSessions = reportData.channels.reduce((sum: number, c: { sessions: number }) => sum + c.sessions, 0) || 1;
    return reportData.channels
      .map((c) => ({
        name: c.channel,
        share: c.sessions / totalSessions,
        count: c.sessions,
        organic: !!c.organic,
      }))
      .sort((a, b) => b.count - a.count);
  }, [reportData]);

  const siteSourcesBreakdown = useMemo<TrafficOriginItem[]>(() => {
    if (!reportData?.sources || reportData.sources.length === 0) {
      return [];
    }
    const totalSessions = reportData.sources.reduce((sum: number, s: { sessions: number }) => sum + s.sessions, 0) || 1;
    return reportData.sources
      .map((s) => ({
        name: s.source ? `${s.source} (${s.medium || "organic"})` : "direct",
        share: s.sessions / totalSessions,
        count: s.sessions,
        organic: s.medium === "organic",
      }))
      .sort((a, b) => b.count - a.count);
  }, [reportData]);

  // Landing pages
  const landingPages = useMemo(() => {
    if (!reportData?.landingPages || reportData.landingPages.length === 0) {
      return [];
    }
    const total = reportData.landingPages.reduce((sum: number, p: { sessions: number }) => sum + p.sessions, 0) || 1;
    return reportData.landingPages
      .map((p) => ({
        path: pathOf(p.page),
        share: p.sessions / total,
        count: p.sessions,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [reportData]);

  // Countries Breakdown: merge GA4 visitors and GSC search metrics per country for metric switching & drilldown
  const countriesBreakdown = useMemo<TrafficCountryRow[]>(() => {
    const ga4Countries = reportData?.countries ?? [];
    const gscRows = countryBreakdown.query.data?.rows ?? [];
    const merged = new Map<
      string,
      {
        country: string;
        code: string;
        flag: string;
        visitors: number | null;
        clicks: number | null;
        impressions: number | null;
        ctr: number | null;
        position: number | null;
        lat: number | null;
        lng: number | null;
      }
    >();

    for (const c of ga4Countries) {
      const geo = resolveCountryGeo(c.country);
      const code = geo?.code ?? c.country.slice(0, 2).toUpperCase();
      const visitorsVal = c.sessions ?? c.users ?? 0;
      const existing = merged.get(code);
      if (existing) {
        existing.visitors = (existing.visitors ?? 0) + visitorsVal;
      } else {
        merged.set(code, {
          country: geo?.name ?? c.country,
          code,
          flag: geo?.flag ?? "🌐",
          visitors: visitorsVal,
          clicks: null,
          impressions: null,
          ctr: null,
          position: null,
          lat: geo?.lat ?? null,
          lng: geo?.lng ?? null,
        });
      }
    }

    for (const r of gscRows) {
      const geo = resolveCountryGeo(r.key);
      const code = geo?.code ?? r.key.toUpperCase();
      const existing = merged.get(code);
      if (existing) {
        existing.clicks = (existing.clicks ?? 0) + (r.clicks ?? 0);
        existing.impressions = (existing.impressions ?? 0) + (r.impressions ?? 0);
        existing.ctr = r.ctr ?? existing.ctr;
        existing.position = r.position ?? existing.position;
      } else {
        merged.set(code, {
          country: geo?.name ?? r.key.toUpperCase(),
          code,
          flag: geo?.flag ?? "🌐",
          visitors: null,
          clicks: r.clicks ?? 0,
          impressions: r.impressions ?? 0,
          ctr: r.ctr ?? null,
          position: r.position ?? null,
          lat: geo?.lat ?? null,
          lng: geo?.lng ?? null,
        });
      }
    }

    const entries = Array.from(merged.values());
    if (entries.length === 0) return [];

    const hasGa4 = ga4Countries.length > 0;
    const total = entries.reduce((sum, item) => sum + (hasGa4 ? (item.visitors ?? 0) : (item.clicks ?? 0)), 0) || 1;
    return entries
      .map((item) => {
        const primaryCount = hasGa4 ? (item.visitors ?? 0) : (item.clicks ?? 0);
        return {
          ...item,
          count: primaryCount,
          share: primaryCount / total,
        };
      })
      .sort((a, b) => b.count - a.count || (b.impressions ?? 0) - (a.impressions ?? 0));
  }, [reportData?.countries, countryBreakdown.query.data?.rows]);

  // Cities Breakdown (mapped to exact city lat/lng or country fallback + cloud/bot hub flagging)
  const citiesBreakdown = useMemo<TrafficCityRow[]>(() => {
    if (!reportData?.cities || reportData.cities.length === 0) {
      return [];
    }
    const totalSessions = reportData.cities.reduce((sum: number, c: { sessions?: number; users?: number }) => sum + (c.sessions ?? c.users ?? 0), 0) || 1;
    return reportData.cities
      .filter((c) => c.city && c.city !== "(not set)")
      .map((c) => {
        const countVal = c.sessions ?? c.users ?? 0;
        const resolved = resolveCityGeo(c.city, c.country || "");
        return {
          city: c.city,
          country: resolved?.countryName ?? c.country ?? "Unknown",
          code: resolved?.code ?? (c.country?.slice(0, 2).toUpperCase() || ""),
          flag: resolved?.flag ?? "📍",
          count: countVal,
          share: countVal / totalSessions,
          lat: resolved?.lat ?? null,
          lng: resolved?.lng ?? null,
          exactCity: resolved?.exactCity ?? false,
          botHubReason: detectDatacenterCity(c.city),
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 25);
  }, [reportData]);

  // Queries
  const queries = gscQueries.query.data ?? [];

  return (
    <div className="space-y-6 pb-16">
      {/* ── TOP HEADER ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-brand-950" />
            <h1 className="text-2xl font-bold tracking-tight text-brand-950">
              Traffic
            </h1>
          </div>
          <p className="mt-1 text-xs text-brand-400">
            Real-time visitors, traffic sources, geography, search performance, and business traffic gap report
          </p>
        </div>

        {/* Reporting Period & Status */}
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-xl border border-brand-200/60 bg-brand-50/80 px-3.5 py-1.5 text-xs font-medium text-brand-500 shadow-xs">
            <Calendar className="h-3.5 w-3.5 text-brand-400" />
            <span>
              Window: <strong className="font-semibold text-brand-950">{periodDays} days</strong>
            </span>
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-xl border border-brand-200/60 bg-brand-50/80 px-3 py-1.5 text-xs text-brand-400 shadow-xs">
            Report through: {reportData?.endDate ? shortDay(reportData.endDate) : "Not available"}
          </span>
        </div>
      </div>

      {/* ── TRAFFIC TABS (Overview & Report) ── */}
      <Tabs
        tabs={TRAFFIC_TABS as unknown as { id: TrafficTabId; label: string; icon?: React.ElementType }[]}
        active={activeTab}
        onChange={selectTab}
      />

      {activeTab === "report" ? (
        <ImprovementReportView />
      ) : (
        <>
          {/* ── CONNECTION ALERT (If not connected) ── */}
      {ga4State === "NOT_CONNECTED" && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-warning-200 bg-warning-50 px-5 py-3 text-xs text-warning-800">
          <p>
            Google Analytics 4 is not connected. Open <strong>Settings → Integrations</strong> to connect it. Search Console is connected separately for search metrics.
          </p>
          <Link
            href="/integrations"
            className="rounded-full bg-brand-950 px-3 py-1 font-semibold text-brand-50 hover:bg-brand-800 transition"
          >
            Connect
          </Link>
        </div>
      )}
      {ga4State && ga4State !== "READY" && ga4State !== "NOT_CONNECTED" && (
        <Panel padded title={ga4State === "EMPTY" ? "No historical GA4 activity" : "GA4 report status"}>
          <p className="text-sm text-brand-600">{report.data?.message}</p>
          {ga4State === "EMPTY" && <p className="mt-2 text-sm text-brand-500">This window ends yesterday. New activity can appear in the realtime panel before it appears in historical reports.</p>}
          <Link href="/settings?tab=integrations" className="mt-2 inline-block text-sm text-primary-700 underline">Review GA4 integration</Link>
        </Panel>
      )}
      {report.isError && <Panel padded title="Historical GA4 report unavailable"><p role="alert" className="text-sm text-error-700">{report.error.message}</p></Panel>}
      {report.data?.lastError && <p role="alert" className="text-sm text-error-700">Latest historical refresh failed: {report.data.lastError}. Showing the last saved report.</p>}

      {/* ── EXECUTIVE ATTRIBUTION & HEALTH RIBBON ── */}
      <div className="rounded-2xl border border-brand-200 bg-surface-1 p-4 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600 border border-primary-100 shadow-2xs">
              <Compass className="h-5 w-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-bold text-brand-950">Search Telemetry &amp; Audience Footprint</h2>
                <span className="inline-flex items-center gap-1 rounded-full bg-success-50 px-2.5 py-0.5 text-[10px] font-semibold text-success-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-success-500 animate-pulse" />
                  Live Sync Active
                </span>
              </div>
              <p className="text-xs text-brand-500 mt-0.5">
                Multi-channel acquisition telemetry, search engagement velocity, and international user footprint.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/organic-search"
              className="inline-flex items-center gap-1.5 rounded-lg border border-brand-200 bg-surface-1 px-3 py-1.5 text-xs font-semibold text-brand-700 hover:bg-surface-2 transition shadow-2xs"
            >
              <Search size={12} className="text-brand-500" />
              <span>Keyword Positions</span>
            </Link>
            <Link
              href="/fix-engine"
              className="inline-flex items-center gap-1.5 rounded-lg bg-signal-400 hover:bg-signal-500 text-signal-ink px-3 py-1.5 text-xs font-bold transition shadow-2xs"
            >
              <span>Fix Traffic Gaps</span>
              <ArrowUpRight size={12} />
            </Link>
          </div>
        </div>
      </div>

      {/* ── 4 KPI METRIC CARDS ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Visitors */}
        <div className="flex flex-col justify-between overflow-hidden rounded-2xl border border-brand-200/60 bg-brand-50/70 p-5 shadow-card">
          <div>
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-400">Visitors</p>
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-brand-500">
                <Users size={14} />
              </span>
            </div>
            <div className="mt-2.5 flex flex-wrap items-baseline gap-2">
              <span className="font-mono text-3xl font-extrabold tracking-tight text-brand-950">
                {count(visitorsCount)}
              </span>
            </div>
          </div>
          <p className="mt-3 border-t border-brand-200/50 pt-2.5 text-[11px] text-brand-400">
            {count(sessionsCount)} sessions · {sessionsPerVisitor} per visitor
          </p>
        </div>

        {/* Realtime activity */}
        <RealtimeActivity projectId={projectId} compact />

        {/* Search clicks */}
        <div className="flex flex-col justify-between overflow-hidden rounded-2xl border border-brand-200/60 bg-brand-50/70 p-5 shadow-card">
          <div>
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-400">Search clicks</p>
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-success-50 text-success-700">
                <MousePointerClick size={14} />
              </span>
            </div>
            <div className="mt-2.5 flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-mono text-3xl font-extrabold tracking-tight text-brand-950">
                {count(searchClicks)}
              </span>
              {roundedClicksChangePct !== null && (
                <span
                  className={cn(
                    "inline-flex shrink-0 items-center gap-0.5 rounded-md border px-2 py-0.5 font-mono text-[11px] font-bold",
                    roundedClicksChangePct >= 0
                      ? "border-success-500/30 bg-success-50 text-success-700"
                      : "border-error-500/30 bg-error-50 text-error-700",
                  )}
                >
                  {roundedClicksChangePct >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                  {roundedClicksChangePct > 0 ? `+${roundedClicksChangePct}%` : `${roundedClicksChangePct}%`}
                </span>
              )}
            </div>
          </div>
          <p className="mt-3 border-t border-brand-200/50 pt-2.5 text-[11px] text-brand-400">
            {count(searchImpressions)} impressions · {percent(searchCtr)} CTR
          </p>
        </div>

        {/* Avg. search position */}
        <div className="flex flex-col justify-between overflow-hidden rounded-2xl border border-brand-200/60 bg-brand-50/70 p-5 shadow-card">
          <div>
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-400">Avg. search position</p>
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent-50 text-accent-700">
                <Target size={14} />
              </span>
            </div>
            <div className="mt-2.5 flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-mono text-3xl font-extrabold tracking-tight text-brand-950">
                {searchPosition !== null && searchPosition > 0 ? `#${searchPosition.toFixed(1)}` : "—"}
              </span>
              {roundedPositionChangePct !== null && (
                <span
                  title="Negative percentage means position moved closer to #1"
                  className={cn(
                    "inline-flex shrink-0 items-center gap-0.5 rounded-md border px-2 py-0.5 font-mono text-[11px] font-bold",
                    roundedPositionChangePct <= 0
                      ? "border-success-500/30 bg-success-50 text-success-700"
                      : "border-error-500/30 bg-error-50 text-error-700",
                  )}
                >
                  {roundedPositionChangePct <= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                  {roundedPositionChangePct > 0 ? `+${roundedPositionChangePct}%` : `${roundedPositionChangePct}%`}
                </span>
              )}
            </div>
          </div>
          <p className="mt-3 border-t border-brand-200/50 pt-2.5 text-[11px] text-brand-400">
            Lower is better
            {roundedPositionChangePct !== null
              ? roundedPositionChangePct <= 0
                ? " · Ranked higher vs prior window"
                : " · Ranked lower vs prior window"
              : " · Change not measured"}
          </p>
        </div>
      </div>

      

      {/* ── DAILY TRAFFIC CHART ── */}
      <div className="rounded-2xl border border-brand-200 bg-surface-1 p-5 shadow-2xs">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-brand-100 pb-3.5">
          <div>
            <h2 className="text-sm font-semibold text-brand-950">Daily traffic</h2>
            <p className="mt-0.5 text-[11px] text-brand-400">
              Google Analytics visitors &amp; Search Console clicks · GSC lags ~2–3 days
            </p>
          </div>

          <div className="flex items-center gap-4 text-[11.5px] font-medium">
            <span className="inline-flex items-center gap-1.5 text-brand-600">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: "var(--color-series-3)" }} />
              Visitors
            </span>
            <span className="inline-flex items-center gap-1.5 text-brand-600">
              <span className="h-0.5 w-3 rounded-full" style={{ backgroundColor: "var(--color-series-1)" }} />
              Search clicks
            </span>
          </div>
        </div>

        <div className="mt-4 h-60 w-full">
          {dailyChartData.length === 0 ? (
            <p className="text-sm text-brand-500">No saved daily measurements are available for this period.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={dailyChartData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="trafficVisitorsFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-series-3)" stopOpacity={0.18} />
                    <stop offset="100%" stopColor="var(--color-series-3)" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid {...CHART_GRID_PROPS} />
                <XAxis
                  dataKey="date"
                  tickFormatter={shortDay}
                  minTickGap={26}
                  tick={CHART_AXIS_TICK}
                  axisLine={false}
                  tickLine={false}
                  dy={6}
                />
                <YAxis
                  allowDecimals={false}
                  tickCount={4}
                  tick={CHART_AXIS_TICK}
                  axisLine={false}
                  tickLine={false}
                  width={36}
                />
                <Tooltip
                  cursor={CHART_CURSOR_LINE}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0]?.payload as { date: string; visitors: number | null; searchClicks: number | null } | undefined;
                    if (!d) return null;
                    return (
                      <ChartTooltipCard
                        title={shortDay(d.date)}
                        rows={[
                          {
                            label: "Visitors",
                            value: d.visitors !== null ? count(d.visitors) : "—",
                            color: "var(--color-series-3)",
                          },
                          {
                            label: "Search clicks",
                            value: d.searchClicks !== null ? count(d.searchClicks) : "—",
                            color: "var(--color-series-1)",
                            shape: "dash",
                          },
                        ]}
                      />
                    );
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="visitors"
                  name="visitors"
                  stroke="var(--color-series-3)"
                  strokeWidth={2}
                  fill="url(#trafficVisitorsFill)"
                  dot={false}
                  activeDot={{ r: 4, fill: "var(--color-series-3)", strokeWidth: 2, stroke: "var(--color-surface-1)" }}
                  connectNulls={false}
                />
                <Line
                  type="monotone"
                  dataKey="searchClicks"
                  name="searchClicks"
                  stroke="var(--color-series-1)"
                  strokeWidth={1.8}
                  dot={false}
                  activeDot={{ r: 3.5, fill: "var(--color-series-1)", strokeWidth: 2, stroke: "var(--color-surface-1)" }}
                  connectNulls={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── AI REFERRALS CARD & IMPACT LEDGER BEFORE/AFTER ── */}
      <AiReferralsCard projectId={projectId || ""} range={`${periodDays}d` as "7d" | "28d" | "90d"} />

      {/* ── ROW 1: WHERE TRAFFIC COMES FROM & TOP LANDING PAGES ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Where visitors come from */}
        <div className="rounded-2xl border border-brand-200/60 bg-brand-50/70 p-6 shadow-card">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Share2 className="h-4 w-4 text-brand-500" />
                <h2 className="text-sm font-bold text-brand-950">
                  Where traffic comes from
                </h2>
              </div>
              <p className="mt-1 text-xs text-brand-400">By channel type and referring sites</p>
            </div>

            <div className="inline-flex rounded-lg border border-brand-200/80 bg-brand-100/50 p-0.5 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setTrafficOriginMode("channels")}
                className={cn(
                  "rounded-md px-2.5 py-1 transition-colors",
                  trafficOriginMode === "channels"
                    ? "bg-brand-950 text-brand-50 shadow-xs"
                    : "text-brand-400 hover:text-brand-950",
                )}
              >
                Channels
              </button>
              <button
                type="button"
                onClick={() => setTrafficOriginMode("sites")}
                className={cn(
                  "rounded-md px-2.5 py-1 transition-colors",
                  trafficOriginMode === "sites"
                    ? "bg-brand-950 text-brand-50 shadow-xs"
                    : "text-brand-400 hover:text-brand-950",
                )}
              >
                Sites & Referrers
              </button>
            </div>
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-brand-200/60 text-brand-400">
                  <th className="pb-2.5 font-medium">
                    {trafficOriginMode === "channels" ? "Channel" : "Site / Source"}
                  </th>
                  <th className="pb-2.5 font-medium">Share of visitors</th>
                  <th className="pb-2.5 text-right font-medium">Visitors</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-100">
                {(trafficOriginMode === "channels" ? channelBreakdown : siteSourcesBreakdown).length > 0 ? (
                  (trafficOriginMode === "channels" ? channelBreakdown : siteSourcesBreakdown).map((row: TrafficOriginItem) => (
                    <tr key={row.name} className="hover:bg-brand-100/40 transition">
                      <td className="py-3 font-semibold text-brand-950">
                        <div className="flex items-center gap-2">
                          {row.organic ? (
                            <span className="rounded bg-success-50 px-1.5 py-0.5 text-[10px] font-bold text-success-700">
                              Organic
                            </span>
                          ) : (
                            <Compass className="h-3.5 w-3.5 text-brand-400" />
                          )}
                          <span>{row.name}</span>
                        </div>
                      </td>
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-3">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-brand-200/50">
                            <div
                              className="h-full rounded-full bg-error-500/80"
                              style={{ width: `${Math.max(row.share * 100, 4)}%` }}
                            />
                          </div>
                          <span className="w-10 font-mono text-[11px] text-brand-500">
                            {percent(row.share)}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 text-right font-mono font-bold text-brand-950">
                        {count(row.count)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="py-6 text-center text-brand-400">
                      No traffic channels recorded for this period yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Top landing pages */}
        <div className="rounded-2xl border border-brand-200/60 bg-brand-50/70 p-6 shadow-card">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-brand-500" />
            <h2 className="text-sm font-bold text-brand-950">Top landing pages</h2>
          </div>
          <p className="mt-1 text-xs text-brand-400">Where visits start</p>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-brand-200/60 text-brand-400">
                  <th className="pb-2.5 font-medium">Page</th>
                  <th className="pb-2.5 font-medium">Share of visitors</th>
                  <th className="pb-2.5 text-right font-medium">Visitors</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-100">
                {landingPages.length > 0 ? (
                  landingPages.map((row: { path: string; share: number; count: number }) => (
                    <tr key={row.path} className="hover:bg-brand-100/40 transition">
                      <td className="py-3 font-mono text-brand-950 max-w-[200px] truncate" title={row.path}>
                        {row.path}
                      </td>
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-3">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-brand-200/50">
                            <div
                              className={cn(
                                "h-full rounded-full",
                                row.path === "Page not recorded"
                                  ? "bg-brand-300"
                                  : "bg-success-500/80",
                              )}
                              style={{ width: `${Math.max(row.share * 100, 4)}%` }}
                            />
                          </div>
                          <span className="w-10 font-mono text-[11px] text-brand-500">
                            {percent(row.share)}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 text-right font-mono font-bold text-brand-950">
                        {count(row.count)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="py-6 text-center text-brand-400">
                      No landing pages recorded for this period yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── ROW 2: INTERACTIVE 3D GLOBAL TRAFFIC EARTH & REGIONAL REACH ── */}
      <GlobalTrafficGlobe
        projectId={projectId}
        periodDays={periodDays}
        visitorsCount={visitorsCount}
        sessionsCount={sessionsCount}
        searchClicks={searchClicks}
        searchImpressions={searchImpressions}
        clicksChangePct={roundedClicksChangePct}
        dailyChartData={dailyChartData}
        channels={channelBreakdown}
        countries={countriesBreakdown}
        cities={citiesBreakdown}
        onOpenReport={() => selectTab("report")}
      />

      {/* ── ROW 3: TOP SEARCH QUERIES TABLE ── */}
      <div className="rounded-2xl border border-brand-200/60 bg-brand-50/70 p-6 shadow-card">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-brand-500" />
          <h2 className="text-sm font-bold text-brand-950">Top search queries</h2>
        </div>
        <p className="mt-1 text-xs text-brand-400">
          What people searched before clicking through from Google
        </p>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-brand-200/60 text-brand-400">
                <th className="pb-2.5 font-medium">Query</th>
                <th className="pb-2.5 text-right font-medium">Clicks</th>
                <th className="pb-2.5 text-right font-medium">Impressions</th>
                <th className="pb-2.5 text-right font-medium">CTR</th>
                <th className="pb-2.5 text-right font-medium">Position</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-100">
              {queries.length > 0 ? (
                queries.map((q) => (
                  <tr key={q.key} className="hover:bg-brand-100/40 transition">
                    <td className="py-3 font-semibold text-brand-950">{q.key}</td>
                    <td className="py-3 text-right font-mono text-brand-950">{count(q.clicks)}</td>
                    <td className="py-3 text-right font-mono text-brand-950">{count(q.impressions)}</td>
                    <td className="py-3 text-right font-mono text-brand-950">{percent(q.ctr)}</td>
                    <td className="py-3 text-right font-mono text-brand-950">{q.position.toFixed(1)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-brand-400">
                    No search queries recorded for this period yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      </>
      )}
    </div>
  );
}

