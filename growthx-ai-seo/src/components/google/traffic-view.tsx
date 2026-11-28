"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Bot,
  Calendar,
  Eye,
  FileText,
  Loader2,
  MonitorPlay,
  MousePointerClick,
  RefreshCw,
  Target,
  TrendingDown,
  Users,
} from "lucide-react";
import { Panel } from "@/components/ui/console";
import { ImprovementReportView } from "@/components/google/improvement-report-view";
import { RealtimeActivity } from "@/components/google/realtime-activity";
import {
  GlobalTrafficGlobe,
  type TargetMarketGapCity,
  type TrafficCityRow,
  type TrafficCountryRow,
} from "@/components/google/global-traffic-globe";
import { TrafficTimelineCard, type TimelinePoint } from "@/components/google/traffic-timeline-card";
import {
  TrafficAcquisitionBento,
  type EnrichedChannelRow,
} from "@/components/google/traffic-acquisition-bento";
import {
  TrafficGrowthConsole,
  type EnrichedLandingPageRow,
  type GrowthConsoleTab,
} from "@/components/google/traffic-growth-console";
import { useGa4Report } from "@/hooks/use-ga4-report";
import {
  useChangeLedger,
  useGoogleAlerts,
  useGoogleBreakdown,
  useGoogleRefresh,
  useGscCtrOpportunities,
  useGscDeclining,
  useGscQueries,
  useGscStriking,
  useGscSummary,
  useGscTimeseries,
} from "@/hooks/use-google";
import { usePeriodDays, useWorkspace } from "@/hooks/use-growthx";
import { api, type Ga4RangeKey, type Ga4ReportData } from "@/lib/api-client";
import {
  detectDatacenterCity,
  isCityGazetteerLoaded,
  loadCityGazetteer,
  resolveCityGeo,
  resolveCountryGeo,
  subscribeCityGazetteer,
} from "@/lib/geo-coordinates";
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

type TrafficTabId = "overview" | "report";

/**
 * TrafficView — 6-Zone Traffic & Search Intelligence Command Center:
 * 1. Compact Command Bar + Live Sync + Smart Pulse Alert Strip
 * 2. Unified 5-Card Executive KPI Strip (Visitors, Live 30m, Clicks, Impressions/Pos, AI Referrals)
 * 3. Hero Interactive 3D Movable Earth + Target Market Gap Rings
 * 4. Proof-of-Impact Timeline (Multi-metric + Shipped SEO Fix Annotations)
 * 5. Acquisition, AI Engines & Device Split Bento
 * 6. 5-Tab Actionable SEO Growth Console + Native <dialog> Page Inspector Drawer
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

  const selectTab = useCallback(
    (newTab: TrafficTabId) => {
      const params = new URLSearchParams(searchParams.toString());
      if (newTab === "overview") {
        params.delete("tab");
      } else {
        params.set("tab", newTab);
      }
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const { projectId } = useWorkspace();
  const periodDays = usePeriodDays();
  const rangeKey = `${periodDays}d` as Ga4RangeKey;

  // Load 40k worldwide GeoNames city coordinates once so suburbs & neighboring metros map accurately
  const gazetteerReady = useSyncExternalStore(
    subscribeCityGazetteer,
    isCityGazetteerLoaded,
    () => false,
  );
  useEffect(() => {
    void loadCityGazetteer();
  }, []);

  const [presentationMode, setPresentationMode] = useState(false);
  const [globeTabSignal, setGlobeTabSignal] = useState<{ tab: "countries" | "cities" | "live"; nonce: number } | null>(null);
  const [consoleTabSignal, setConsoleTabSignal] = useState<{ tab: GrowthConsoleTab; nonce: number } | null>(null);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);

  const globeSectionRef = useRef<HTMLDivElement | null>(null);
  const consoleSectionRef = useRef<HTMLDivElement | null>(null);

  // Core data queries
  const { report } = useGa4Report(projectId);
  const gscSummary = useGscSummary(projectId);
  const gscTimeseries = useGscTimeseries(projectId);
  const countryBreakdown = useGoogleBreakdown(projectId, "country");
  const deviceBreakdown = useGoogleBreakdown(projectId, "device");
  const gscQueries = useGscQueries(projectId);
  const gscStriking = useGscStriking(projectId);
  const gscCtrOpps = useGscCtrOpportunities(projectId);
  const gscDeclining = useGscDeclining(projectId);
  const googleAlerts = useGoogleAlerts(projectId);
  const changeLedger = useChangeLedger(projectId);
  const googleRefresh = useGoogleRefresh(projectId);

  const aiReferralsQuery = useQuery({
    queryKey: ["ai-referrals", projectId, rangeKey],
    queryFn: () => api.aiReferrals(projectId!, rangeKey),
    enabled: Boolean(projectId),
    staleTime: 60_000,
    retry: false,
  });

  // Read cached saved Google Report for target cities (from Website Audit) without triggering generation
  const savedReportQuery = useQuery({
    queryKey: ["google-improvement-report-latest", projectId],
    queryFn: () => api.getLatestGoogleReport(projectId!),
    enabled: Boolean(projectId),
    staleTime: 60_000,
    retry: false,
  });

  const reportData: Ga4ReportData | null = report.data?.data ?? null;
  const ga4State = report.data?.state;
  const totals = reportData?.totals;

  // KPI metrics
  const visitorsCount = totals?.activeUsers ?? null;
  const sessionsCount = totals?.sessions ?? null;
  const newUsersCount = totals?.newUsers ?? null;
  const engagementRate = totals?.engagementRate ?? null;
  const newUserShare =
    visitorsCount && visitorsCount > 0 && newUsersCount !== null
      ? Math.max(0, Math.min(1, newUsersCount / visitorsCount))
      : null;

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

  // Unified daily timeline (GA4 visitors/new/returning + GSC clicks/impressions)
  const timelineData = useMemo<TimelinePoint[]>(() => {
    const map = new Map<string, TimelinePoint>();

    for (const p of gscTimeseries.query.data ?? []) {
      const date = p.date.slice(0, 10);
      const existing = map.get(date) ?? {
        date,
        visitors: null,
        newUsers: null,
        returningUsers: null,
        searchClicks: null,
        impressions: null,
      };
      existing.searchClicks = p.clicks ?? null;
      existing.impressions = p.impressions ?? null;
      map.set(date, existing);
    }

    for (const d of reportData?.daily ?? []) {
      const date = d.date.slice(0, 10);
      const existing = map.get(date) ?? {
        date,
        visitors: null,
        newUsers: null,
        returningUsers: null,
        searchClicks: null,
        impressions: null,
      };
      existing.visitors = d.users ?? null;
      existing.newUsers = typeof d.newUsers === "number" ? d.newUsers : null;
      existing.returningUsers =
        typeof d.returningUsers === "number"
          ? d.returningUsers
          : typeof d.users === "number" && typeof d.newUsers === "number"
            ? Math.max(0, d.users - d.newUsers)
            : null;
      map.set(date, existing);
    }

    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [gscTimeseries.query.data, reportData?.daily]);

  // Channels & Sources Breakdown with real Engagement & Key Events
  const channelBreakdown = useMemo<EnrichedChannelRow[]>(() => {
    if (!reportData?.channels || reportData.channels.length === 0) return [];
    const totalSessions = reportData.channels.reduce((sum, c) => sum + c.sessions, 0) || 1;
    return reportData.channels
      .map((c) => ({
        name: c.channel,
        share: c.sessions / totalSessions,
        count: c.sessions,
        organic: !!c.organic,
        engagementRate: typeof c.engagementRate === "number" ? c.engagementRate : null,
        keyEvents: typeof c.keyEvents === "number" ? c.keyEvents : null,
      }))
      .sort((a, b) => b.count - a.count);
  }, [reportData]);

  const siteSourcesBreakdown = useMemo<EnrichedChannelRow[]>(() => {
    if (!reportData?.sources || reportData.sources.length === 0) return [];
    const totalSessions = reportData.sources.reduce((sum, s) => sum + s.sessions, 0) || 1;
    return reportData.sources
      .map((s) => ({
        name: s.source ? `${s.source} (${s.medium || "organic"})` : "direct",
        share: s.sessions / totalSessions,
        count: s.sessions,
        organic: s.medium === "organic",
        engagementRate: typeof s.engagementRate === "number" ? s.engagementRate : null,
        keyEvents: typeof s.keyEvents === "number" ? s.keyEvents : null,
      }))
      .sort((a, b) => b.count - a.count);
  }, [reportData]);

  // Landing pages with engagement & key events
  const landingPages = useMemo<EnrichedLandingPageRow[]>(() => {
    if (!reportData?.landingPages || reportData.landingPages.length === 0) return [];
    const total = reportData.landingPages.reduce((sum, p) => sum + p.sessions, 0) || 1;
    return reportData.landingPages
      .map((p) => ({
        rawPage: p.page,
        path: pathOf(p.page),
        share: p.sessions / total,
        count: p.sessions,
        engagementRate: p.engagementRate,
        keyEvents: p.keyEvents,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 25);
  }, [reportData]);

  // Countries Breakdown: merge GA4 visitors and GSC search metrics per country
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

  // Cities Breakdown with exact GeoNames coordinates & cloud/bot hub classification
  const citiesBreakdown = useMemo<TrafficCityRow[]>(() => {
    if (!reportData?.cities || reportData.cities.length === 0) return [];
    const totalSessions = reportData.cities.reduce((sum, c) => sum + (c.sessions ?? c.users ?? 0), 0) || 1;
    // Reference gazetteerReady so city pins snap immediately to exact sub-km coordinates when loaded
    void gazetteerReady;
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
  }, [reportData, gazetteerReady]);

  // Target Market Gap Cities (zero/low-traffic Website Audit target markets)
  const targetGapCities = useMemo<TargetMarketGapCity[]>(() => {
    const gaps = savedReportQuery.data?.facts.locationGaps ?? [];
    const fallbackCountry = savedReportQuery.data?.facts.business?.country ?? countriesBreakdown[0]?.country ?? "";
    const out: TargetMarketGapCity[] = [];
    for (const g of gaps) {
      if (g.status === "ACTIVE") continue;
      out.push({
        city: g.location,
        country: fallbackCountry,
        sessions: g.sessions,
      });
    }
    return out.slice(0, 12);
  }, [savedReportQuery.data, countriesBreakdown]);

  // Pulse alerts for Smart Alert Strip
  const queries = gscQueries.query.data ?? [];
  const striking = gscStriking.query.data ?? [];
  const ctrOpps = gscCtrOpps.query.data ?? [];
  const declining = gscDeclining.query.data ?? [];
  const deviceRows = deviceBreakdown.query.data?.rows ?? [];
  const alerts = googleAlerts.query.data?.alerts ?? [];
  const changes = changeLedger.data?.changes ?? [];
  const botHubCount = useMemo(() => citiesBreakdown.filter((c) => Boolean(c.botHubReason)).length, [citiesBreakdown]);

  const handleManualSync = useCallback(() => {
    if (!projectId || googleRefresh.isPending) return;
    setSyncNotice(null);
    googleRefresh.mutate(
      {
        searchConsole: Boolean(gscSummary.query.data) || gscTimeseries.query.isSuccess,
        analytics: ga4State !== "NOT_CONNECTED",
      },
      {
        onSuccess: () => setSyncNotice("Live GA4 & Search Console sync completed."),
        onError: (err) => setSyncNotice(err instanceof Error ? err.message : "Sync failed."),
      },
    );
  }, [projectId, googleRefresh, gscSummary.query.data, gscTimeseries.query.isSuccess, ga4State]);

  const jumpToGlobeTab = useCallback((tab: "countries" | "cities" | "live") => {
    setGlobeTabSignal((prev) => ({ tab, nonce: (prev?.nonce ?? 0) + 1 }));
    globeSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);

  const jumpToConsoleTab = useCallback((tab: GrowthConsoleTab) => {
    setConsoleTabSignal((prev) => ({ tab, nonce: (prev?.nonce ?? 0) + 1 }));
    consoleSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const showPulseStrip =
    !presentationMode && (alerts.length > 0 || botHubCount > 0 || declining.length > 0 || striking.length > 0);

  return (
    <div className="space-y-5 pb-16">
      {/* ── ZONE 1: COMPACT SINGLE-ROW COMMAND BAR ── */}
      <div className="flex flex-col gap-3 rounded-2xl border border-brand-200/80 bg-surface-1 px-4 py-3 shadow-2xs sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-signal-400 text-signal-ink shadow-2xs">
              <Activity className="h-4 w-4" />
            </span>
            <div>
              <h1 className="text-base font-bold leading-tight tracking-tight text-brand-950">
                Traffic
              </h1>
              <p className="text-[11px] text-brand-400">
                3D global reach · GA4 · Search Console · AI referrals
              </p>
            </div>
          </div>

          {/* Inline Overview | Report Pill Switcher */}
          <div
            role="tablist"
            aria-label="Traffic workspace views"
            className="inline-flex rounded-xl border border-brand-200/80 bg-brand-100/60 p-0.5 text-xs font-semibold"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "overview"}
              onClick={() => selectTab("overview")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-3 py-1 transition cursor-pointer",
                activeTab === "overview"
                  ? "bg-signal-400 text-signal-ink font-bold shadow-xs"
                  : "text-brand-500 hover:text-brand-950",
              )}
            >
              <Activity className="h-3.5 w-3.5" />
              <span>Overview</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "report"}
              onClick={() => selectTab("report")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-3 py-1 transition cursor-pointer",
                activeTab === "report"
                  ? "bg-signal-400 text-signal-ink font-bold shadow-xs"
                  : "text-brand-500 hover:text-brand-950",
              )}
            >
              <FileText className="h-3.5 w-3.5" />
              <span>Growth Report</span>
            </button>
          </div>
        </div>

        {/* Right Controls: Window Freshness + Live Sync + Presentation Mode */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-xl border border-brand-200/70 bg-brand-50/80 px-2.5 py-1.5 text-[11px] font-medium text-brand-500">
            <Calendar className="h-3 w-3 text-brand-400" />
            <span>
              <strong className="font-semibold text-brand-950">{periodDays}d</strong>
              {reportData?.endDate ? ` · thru ${shortDay(reportData.endDate)}` : ""}
            </span>
          </span>

          <button
            type="button"
            onClick={handleManualSync}
            disabled={!projectId || googleRefresh.isPending}
            title="Sync fresh GA4 & Search Console data"
            className="inline-flex items-center gap-1.5 rounded-xl border border-brand-200 bg-surface-1 px-3 py-1.5 text-[11.5px] font-semibold text-brand-700 hover:bg-brand-100 transition disabled:opacity-50 cursor-pointer"
          >
            {googleRefresh.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            <span>{googleRefresh.isPending ? "Syncing…" : "Sync"}</span>
          </button>

          <button
            type="button"
            onClick={() => setPresentationMode((prev) => !prev)}
            title={presentationMode ? "Exit client presentation view" : "Clean client presentation view"}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-[11.5px] font-semibold transition cursor-pointer",
              presentationMode
                ? "border-primary-500 bg-primary-50 text-primary-700"
                : "border-brand-200 bg-surface-1 text-brand-600 hover:bg-brand-100 hover:text-brand-950",
            )}
          >
            <MonitorPlay className="h-3.5 w-3.5" />
            <span className="hidden md:inline">{presentationMode ? "Client View On" : "Present"}</span>
          </button>
        </div>
      </div>

      {syncNotice && (
        <p className="rounded-xl border border-brand-200 bg-surface-1 px-4 py-2 text-xs font-medium text-brand-700">
          {syncNotice}
        </p>
      )}

      {activeTab === "report" ? (
        <ImprovementReportView />
      ) : (
        <>
          {/* Connection / Error States */}
          {ga4State === "NOT_CONNECTED" && (
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-warning-200 bg-warning-50 px-5 py-3 text-xs text-warning-800">
              <p>
                Google Analytics 4 is not connected. Open <strong>Settings → Integrations</strong> to connect it. Search Console is tracked separately for search metrics.
              </p>
              <Link
                href="/integrations"
                className="rounded-full bg-signal-400 px-3 py-1 font-bold text-signal-ink hover:bg-signal-500 transition"
              >
                Connect
              </Link>
            </div>
          )}
          {ga4State && ga4State !== "READY" && ga4State !== "NOT_CONNECTED" && (
            <Panel padded title={ga4State === "EMPTY" ? "No historical GA4 activity" : "GA4 report status"}>
              <p className="text-sm text-brand-600">{report.data?.message}</p>
              {ga4State === "EMPTY" && (
                <p className="mt-2 text-sm text-brand-500">
                  This window ends yesterday. New activity can appear in the realtime panel before it appears in historical reports.
                </p>
              )}
              <Link href="/settings?tab=integrations" className="mt-2 inline-block text-sm text-primary-700 underline">
                Review GA4 integration
              </Link>
            </Panel>
          )}
          {report.isError && (
            <Panel padded title="Historical GA4 report unavailable">
              <p role="alert" className="text-sm text-error-700">{report.error.message}</p>
            </Panel>
          )}
          {report.data?.lastError && (
            <p role="alert" className="text-xs text-error-700">
              Latest historical refresh failed: {report.data.lastError}. Showing the last saved report.
            </p>
          )}

          {/* SMART TRAFFIC PULSE STRIP (Only surfaces real anomalies & quick-jump opportunities) */}
          {showPulseStrip && (
            <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-brand-200/70 bg-surface-1 px-4 py-2.5 text-[11.5px]">
              <span className="inline-flex items-center gap-1.5 font-bold text-brand-700">
                <AlertTriangle className="h-3.5 w-3.5 text-warning-600" />
                <span>Traffic Pulse:</span>
              </span>

              {alerts.slice(0, 2).map((al) => (
                <span
                  key={al.id}
                  title={al.detail}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-semibold",
                    al.direction === "BAD"
                      ? "bg-error-50 text-error-700"
                      : "bg-success-50 text-success-700",
                  )}
                >
                  <span>{al.title}</span>
                </span>
              ))}

              {botHubCount > 0 && (
                <button
                  type="button"
                  onClick={() => jumpToGlobeTab("cities")}
                  className="inline-flex items-center gap-1 rounded-full bg-warning-50 px-2.5 py-0.5 font-semibold text-warning-700 hover:bg-warning-100 transition cursor-pointer"
                >
                  <Bot className="h-3 w-3" />
                  <span>{botHubCount} cloud/bot city {botHubCount === 1 ? "hub" : "hubs"} flagged</span>
                </button>
              )}

              {declining.length > 0 && (
                <Link
                  href="/organic-search"
                  className="inline-flex items-center gap-1 rounded-full bg-error-50 px-2.5 py-0.5 font-semibold text-error-700 hover:bg-error-100 transition"
                >
                  <TrendingDown className="h-3 w-3" />
                  <span>{declining.length} declining {declining.length === 1 ? "query" : "queries"} in Organic Search →</span>
                </Link>
              )}

              {striking.length > 0 && (
                <Link
                  href="/organic-search"
                  className="inline-flex items-center gap-1 rounded-full bg-success-50 px-2.5 py-0.5 font-semibold text-success-700 hover:bg-success-100 transition"
                >
                  <Target className="h-3 w-3" />
                  <span>{striking.length} striking-distance wins in Organic Search →</span>
                </Link>
              )}
            </div>
          )}

          {/* ── ZONE 2: UNIFIED 5-CARD EXECUTIVE KPI STRIP ── */}
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-5">
            {/* 1. Visitors + New vs Returning micro-bar */}
            <div className="flex flex-col justify-between overflow-hidden rounded-2xl border border-brand-200/70 bg-surface-1 p-4 shadow-card">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10.5px] font-semibold uppercase tracking-wider text-brand-400">Visitors</p>
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand-600">
                    <Users className="h-3.5 w-3.5" />
                  </span>
                </div>
                <div className="mt-2 flex items-baseline justify-between gap-2">
                  <span className="font-mono text-2xl font-extrabold tracking-tight text-brand-950">
                    {count(visitorsCount)}
                  </span>
                  {engagementRate !== null && (
                    <span className="rounded-md bg-brand-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-brand-600">
                      {percent(engagementRate)} eng
                    </span>
                  )}
                </div>
                {newUserShare !== null && (
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-brand-200/60" title={`New: ${percent(newUserShare)}`}>
                    <div
                      className="h-full rounded-full bg-primary-500"
                      style={{ width: `${Math.round(newUserShare * 100)}%` }}
                    />
                  </div>
                )}
              </div>
              <p className="mt-2.5 border-t border-brand-100 pt-2 text-[10.5px] text-brand-400">
                {count(sessionsCount)} sessions{newUserShare !== null ? ` · ${Math.round(newUserShare * 100)}% new` : ""}
              </p>
            </div>

            {/* 2. Realtime Live 30m */}
            <RealtimeActivity
              projectId={projectId}
              compact
              onInspectLive={() => jumpToGlobeTab("live")}
            />

            {/* 3. Search Clicks */}
            <div className="flex flex-col justify-between overflow-hidden rounded-2xl border border-brand-200/70 bg-surface-1 p-4 shadow-card">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10.5px] font-semibold uppercase tracking-wider text-brand-400">Search clicks</p>
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-success-50 text-success-700">
                    <MousePointerClick className="h-3.5 w-3.5" />
                  </span>
                </div>
                <div className="mt-2 flex items-baseline justify-between gap-2">
                  <span className="font-mono text-2xl font-extrabold tracking-tight text-brand-950">
                    {count(searchClicks)}
                  </span>
                  {roundedClicksChangePct !== null && (
                    <span
                      className={cn(
                        "inline-flex shrink-0 items-center gap-0.5 rounded-md border px-1.5 py-0.5 font-mono text-[10px] font-bold",
                        roundedClicksChangePct >= 0
                          ? "border-success-500/30 bg-success-50 text-success-700"
                          : "border-error-500/30 bg-error-50 text-error-700",
                      )}
                    >
                      {roundedClicksChangePct >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                      {roundedClicksChangePct > 0 ? `+${roundedClicksChangePct}%` : `${roundedClicksChangePct}%`}
                    </span>
                  )}
                </div>
              </div>
              <p className="mt-2.5 border-t border-brand-100 pt-2 text-[10.5px] text-brand-400">
                {percent(searchCtr)} avg CTR · Search Console
              </p>
            </div>

            {/* 4. Impressions & Avg. Position */}
            <div className="flex flex-col justify-between overflow-hidden rounded-2xl border border-brand-200/70 bg-surface-1 p-4 shadow-card">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10.5px] font-semibold uppercase tracking-wider text-brand-400">Impressions</p>
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-accent-50 text-accent-700">
                    <Eye className="h-3.5 w-3.5" />
                  </span>
                </div>
                <div className="mt-2 flex items-baseline justify-between gap-2">
                  <span className="font-mono text-2xl font-extrabold tracking-tight text-brand-950">
                    {count(searchImpressions)}
                  </span>
                  {searchPosition !== null && searchPosition > 0 && (
                    <span className="rounded-md bg-accent-50 px-1.5 py-0.5 font-mono text-[10.5px] font-bold text-accent-700">
                      #{searchPosition.toFixed(1)}
                    </span>
                  )}
                </div>
              </div>
              <p className="mt-2.5 border-t border-brand-100 pt-2 text-[10.5px] text-brand-400">
                {roundedPositionChangePct !== null
                  ? roundedPositionChangePct <= 0
                    ? `Position improved ${Math.abs(roundedPositionChangePct)}%`
                    : `Position slipped ${roundedPositionChangePct}%`
                  : "Avg Google rank position"}
              </p>
            </div>

            {/* 5. AI Search Visits */}
            <div className="flex flex-col justify-between overflow-hidden rounded-2xl border border-brand-200/70 bg-surface-1 p-4 shadow-card">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10.5px] font-semibold uppercase tracking-wider text-brand-400">AI Visits</p>
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
                    <Bot className="h-3.5 w-3.5" />
                  </span>
                </div>
                <div className="mt-2 flex items-baseline justify-between gap-2">
                  <span className="font-mono text-2xl font-extrabold tracking-tight text-brand-950">
                    {aiReferralsQuery.data?.connected ? count(aiReferralsQuery.data.totalAiSessions) : "—"}
                  </span>
                  {aiReferralsQuery.data?.connected && (
                    <span className="rounded-md bg-primary-50 px-1.5 py-0.5 font-mono text-[10px] font-bold text-primary-700">
                      {aiReferralsQuery.data.aiShareOfTotalTrafficPct}% share
                    </span>
                  )}
                </div>
              </div>
              <p className="mt-2.5 border-t border-brand-100 pt-2 text-[10.5px] text-brand-400">
                {aiReferralsQuery.data?.connected
                  ? `${count(aiReferralsQuery.data.totalAiConversions)} conversions · ChatGPT & AI`
                  : "ChatGPT, Perplexity, Gemini"}
              </p>
            </div>
          </div>

          {/* ── ZONE 3: HERO INTERACTIVE 3D MOVABLE EARTH (ELEVATED ABOVE THE FOLD) ── */}
          <div ref={globeSectionRef}>
            <GlobalTrafficGlobe
              projectId={projectId}
              periodDays={periodDays}
              visitorsCount={visitorsCount}
              sessionsCount={sessionsCount}
              searchClicks={searchClicks}
              searchImpressions={searchImpressions}
              clicksChangePct={roundedClicksChangePct}
              dailyChartData={timelineData}
              channels={channelBreakdown}
              countries={countriesBreakdown}
              cities={citiesBreakdown}
              queries={queries}
              landingPages={landingPages}
              targetGapCities={targetGapCities}
              tabFocusSignal={globeTabSignal}
              onOpenReport={() => selectTab("report")}
            />
          </div>

          {/* ── ZONE 4: PROOF-OF-IMPACT MULTI-METRIC TIMELINE ── */}
          <TrafficTimelineCard
            data={timelineData}
            changes={changes}
            periodDays={periodDays}
          />

          {/* ── ZONE 5: ACQUISITION, AI REFERRALS & DEVICE SPLIT BENTO ── */}
          <TrafficAcquisitionBento
            channels={channelBreakdown}
            sources={siteSourcesBreakdown}
            aiReferrals={aiReferralsQuery.data}
            aiLoading={aiReferralsQuery.isPending}
            deviceRows={deviceRows}
            periodDays={periodDays}
          />

          {/* ── ZONE 6: 5-TAB ACTIONABLE SEO GROWTH CONSOLE + PAGE INSPECTOR ── */}
          <div ref={consoleSectionRef}>
            <TrafficGrowthConsole
              projectId={projectId}
              periodDays={periodDays}
              landingPages={landingPages}
              queries={queries}
              striking={striking}
              ctrOpps={ctrOpps}
              declining={declining}
              tabSwitchSignal={consoleTabSignal}
              presentationMode={presentationMode}
            />
          </div>
        </>
      )}
    </div>
  );
}
