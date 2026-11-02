"use client";
import Link from "next/link";
import { Suspense, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Building2,
  Calendar,
  Compass,
  FileText,
  Globe,
  MapPin,
  Search,
  Share2,
  Sparkles,
} from "lucide-react";
import { Panel, Tabs } from "@/components/ui/console";
import { ImprovementReportView } from "@/components/google/improvement-report-view";
import { RealtimeActivity } from "@/components/google/realtime-activity";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useGa4Report } from "@/hooks/use-ga4-report";
import {
  useGoogleBreakdown,
  useGscQueries,
  useGscSummary,
  useGscTimeseries,
} from "@/hooks/use-google";
import { usePeriodDays, useWorkspace } from "@/hooks/use-growthx";
import type { Ga4ReportData } from "@/lib/api-client";
import { count, percent, shortDay } from "@/lib/google-format";
import { cn } from "@/lib/utils";

/** Geographic coordinates in a 800×360 equirectangular map projection. */
const COUNTRY_COORDINATES: Record<string, { x: number; y: number; flag: string; name: string }> = {
  IN: { x: 550, y: 175, flag: "🇮🇳", name: "India" },
  INDIA: { x: 550, y: 175, flag: "🇮🇳", name: "India" },
  IND: { x: 550, y: 175, flag: "🇮🇳", name: "India" },
  US: { x: 175, y: 115, flag: "🇺🇸", name: "United States" },
  USA: { x: 175, y: 115, flag: "🇺🇸", name: "United States" },
  "UNITED STATES": { x: 175, y: 115, flag: "🇺🇸", name: "United States" },
  GB: { x: 395, y: 86, flag: "🇬🇧", name: "United Kingdom" }, UK: { x: 395, y: 86, flag: "🇬🇧", name: "United Kingdom" }, GBR: { x: 395, y: 86, flag: "🇬🇧", name: "United Kingdom" }, "UNITED KINGDOM": { x: 395, y: 86, flag: "🇬🇧", name: "United Kingdom" },
  CA: { x: 175, y: 83, flag: "🇨🇦", name: "Canada" }, CAN: { x: 175, y: 83, flag: "🇨🇦", name: "Canada" }, CANADA: { x: 175, y: 83, flag: "🇨🇦", name: "Canada" },
  DE: { x: 418, y: 96, flag: "🇩🇪", name: "Germany" }, DEU: { x: 418, y: 96, flag: "🇩🇪", name: "Germany" }, GERMANY: { x: 418, y: 96, flag: "🇩🇪", name: "Germany" },
  AU: { x: 680, y: 258, flag: "🇦🇺", name: "Australia" }, AUS: { x: 680, y: 258, flag: "🇦🇺", name: "Australia" }, AUSTRALIA: { x: 680, y: 258, flag: "🇦🇺", name: "Australia" },
  FR: { x: 408, y: 99, flag: "🇫🇷", name: "France" }, FRA: { x: 408, y: 99, flag: "🇫🇷", name: "France" }, FRANCE: { x: 408, y: 99, flag: "🇫🇷", name: "France" },
  JP: { x: 665, y: 112, flag: "🇯🇵", name: "Japan" }, JPN: { x: 665, y: 112, flag: "🇯🇵", name: "Japan" }, JAPAN: { x: 665, y: 112, flag: "🇯🇵", name: "Japan" },
  SG: { x: 600, y: 181, flag: "🇸🇬", name: "Singapore" }, SGP: { x: 600, y: 181, flag: "🇸🇬", name: "Singapore" }, SINGAPORE: { x: 600, y: 181, flag: "🇸🇬", name: "Singapore" },
  AE: { x: 492, y: 132, flag: "🇦🇪", name: "United Arab Emirates" }, ARE: { x: 492, y: 132, flag: "🇦🇪", name: "United Arab Emirates" }, UAE: { x: 492, y: 132, flag: "🇦🇪", name: "United Arab Emirates" },
  BR: { x: 249, y: 220, flag: "🇧🇷", name: "Brazil" }, BRA: { x: 249, y: 220, flag: "🇧🇷", name: "Brazil" }, BRAZIL: { x: 249, y: 220, flag: "🇧🇷", name: "Brazil" },
  NL: { x: 414, y: 95, flag: "🇳🇱", name: "Netherlands" }, NLD: { x: 414, y: 95, flag: "🇳🇱", name: "Netherlands" }, NETHERLANDS: { x: 414, y: 95, flag: "🇳🇱", name: "Netherlands" },
  IT: { x: 420, y: 108, flag: "🇮🇹", name: "Italy" }, ITA: { x: 420, y: 108, flag: "🇮🇹", name: "Italy" }, ITALY: { x: 420, y: 108, flag: "🇮🇹", name: "Italy" },
  ES: { x: 399, y: 112, flag: "🇪🇸", name: "Spain" }, ESP: { x: 399, y: 112, flag: "🇪🇸", name: "Spain" }, SPAIN: { x: 399, y: 112, flag: "🇪🇸", name: "Spain" },
  MX: { x: 215, y: 142, flag: "🇲🇽", name: "Mexico" }, MEX: { x: 215, y: 142, flag: "🇲🇽", name: "Mexico" }, MEXICO: { x: 215, y: 142, flag: "🇲🇽", name: "Mexico" },
  CN: { x: 610, y: 117, flag: "🇨🇳", name: "China" }, CHN: { x: 610, y: 117, flag: "🇨🇳", name: "China" }, CHINA: { x: 610, y: 117, flag: "🇨🇳", name: "China" },
  KR: { x: 655, y: 116, flag: "🇰🇷", name: "South Korea" }, KOR: { x: 655, y: 116, flag: "🇰🇷", name: "South Korea" },
  ID: { x: 622, y: 181, flag: "🇮🇩", name: "Indonesia" }, IDN: { x: 622, y: 181, flag: "🇮🇩", name: "Indonesia" }, INDONESIA: { x: 622, y: 181, flag: "🇮🇩", name: "Indonesia" },
  RU: { x: 535, y: 70, flag: "🇷🇺", name: "Russia" }, RUS: { x: 535, y: 70, flag: "🇷🇺", name: "Russia" }, RUSSIA: { x: 535, y: 70, flag: "🇷🇺", name: "Russia" },
  ZA: { x: 422, y: 254, flag: "🇿🇦", name: "South Africa" }, ZAF: { x: 422, y: 254, flag: "🇿🇦", name: "South Africa" },
  NG: { x: 408, y: 157, flag: "🇳🇬", name: "Nigeria" }, NGA: { x: 408, y: 157, flag: "🇳🇬", name: "Nigeria" },
  SE: { x: 425, y: 71, flag: "🇸🇪", name: "Sweden" }, SWE: { x: 425, y: 71, flag: "🇸🇪", name: "Sweden" },
  CH: { x: 411, y: 100, flag: "🇨🇭", name: "Switzerland" }, CHE: { x: 411, y: 100, flag: "🇨🇭", name: "Switzerland" },
  PL: { x: 427, y: 92, flag: "🇵🇱", name: "Poland" }, POL: { x: 427, y: 92, flag: "🇵🇱", name: "Poland" },
  TR: { x: 462, y: 116, flag: "🇹🇷", name: "Türkiye" }, TUR: { x: 462, y: 116, flag: "🇹🇷", name: "Türkiye" },
  TH: { x: 585, y: 151, flag: "🇹🇭", name: "Thailand" }, THA: { x: 585, y: 151, flag: "🇹🇭", name: "Thailand" },
  VN: { x: 603, y: 144, flag: "🇻🇳", name: "Vietnam" }, VNM: { x: 603, y: 144, flag: "🇻🇳", name: "Vietnam" },
  PH: { x: 660, y: 145, flag: "🇵🇭", name: "Philippines" }, PHL: { x: 660, y: 145, flag: "🇵🇭", name: "Philippines" },
  PK: { x: 523, y: 132, flag: "🇵🇰", name: "Pakistan" }, PAK: { x: 523, y: 132, flag: "🇵🇰", name: "Pakistan" },
  BD: { x: 562, y: 137, flag: "🇧🇩", name: "Bangladesh" }, BGD: { x: 562, y: 137, flag: "🇧🇩", name: "Bangladesh" },
  AR: { x: 255, y: 248, flag: "🇦🇷", name: "Argentina" }, ARG: { x: 255, y: 248, flag: "🇦🇷", name: "Argentina" },
  CL: { x: 240, y: 253, flag: "🇨🇱", name: "Chile" }, CHL: { x: 240, y: 253, flag: "🇨🇱", name: "Chile" },
  CO: { x: 235, y: 154, flag: "🇨🇴", name: "Colombia" }, COL: { x: 235, y: 154, flag: "🇨🇴", name: "Colombia" },
};

const COUNTRY_NAME_TO_CODE: Record<string, string> = {
  INDIA: "IN",
  "UNITED STATES": "US",
  "UNITED KINGDOM": "GB",
  CANADA: "CA",
  GERMANY: "DE",
  AUSTRALIA: "AU",
  FRANCE: "FR",
  JAPAN: "JP",
  SINGAPORE: "SG",
  "UNITED ARAB EMIRATES": "AE",
  BRAZIL: "BR",
  NETHERLANDS: "NL",
  ITALY: "IT",
  SPAIN: "ES",
  MEXICO: "MX",
  CHINA: "CN",
  INDONESIA: "ID",
  RUSSIA: "RU",
  "SOUTH AFRICA": "ZA",
  NIGERIA: "NG",
  SWEDEN: "SE",
  SWITZERLAND: "CH",
  POLAND: "PL",
  TÜRKIYE: "TR",
  TURKEY: "TR",
  THAILAND: "TH",
  VIETNAM: "VN",
  PHILIPPINES: "PH",
  PAKISTAN: "PK",
  BANGLADESH: "BD",
  ARGENTINA: "AR",
  CHILE: "CL",
  COLOMBIA: "CO",
};

const MAP_CONTINENTS = [
  // Low-detail continent silhouettes in the same equirectangular projection.
  "M58 65 79 50 112 40 145 46 172 54 196 52 222 63 239 78 233 91 217 99 212 113 199 121 187 143 174 151 169 170 157 189 151 209 140 219 131 210 124 192 116 178 107 165 98 154 91 136 81 122 72 102 64 83Z",
  "M183 194 199 188 217 194 233 208 243 229 246 251 239 278 230 302 222 328 211 344 202 329 198 305 191 282 187 257 179 231Z",
  "M365 75 379 66 393 67 402 77 397 89 386 94 378 89Z",
  "M382 98 399 92 417 96 430 106 426 119 412 124 396 119 385 111Z",
  "M394 130 416 127 435 138 447 157 451 182 445 208 436 233 425 259 411 271 400 256 393 232 387 206 380 181 379 158Z",
  "M419 85 435 69 457 62 478 59 498 55 521 57 544 52 568 55 590 59 615 59 642 66 666 70 688 78 713 84 734 96 750 110 747 126 735 139 719 149 703 161 684 171 664 181 645 194 626 199 608 192 591 184 573 176 557 166 539 163 522 151 506 142 490 132 475 120 459 112 442 107 429 99Z",
  "M449 188 465 181 481 187 492 200 487 216 477 229 462 226 452 212Z",
  "M631 221 650 215 672 219 693 228 710 242 717 258 708 274 693 282 674 280 657 270 644 256 635 240Z",
  "M740 222 758 215 777 219 790 230 790 244 777 252 760 248 748 239Z",
];

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

interface CountryBreakdownItem {
  country: string;
  code: string;
  flag: string;
  count: number;
  share: number;
  coords: { x: number; y: number } | null;
}

interface CityBreakdownItem {
  city: string;
  country: string;
  flag: string;
  count: number;
  share: number;
}

interface TrafficOriginItem {
  name: string;
  share: number;
  count: number;
  organic: boolean;
}

const TRAFFIC_TABS = [
  { id: "overview", label: "Traffic Overview", icon: Activity },
  { id: "report", label: "Report", icon: Sparkles },
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
  const [hoveredCountry, setHoveredCountry] = useState<string | null>(null);

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
  const searchImpressions = gscSummary.query.data?.impressions?.current ?? null;
  const searchCtr = gscSummary.query.data?.ctr?.current ?? null;
  const searchPosition = gscSummary.query.data?.position?.current ?? null;
  const positionChangePct = gscSummary.query.data?.position?.changePct;

  // Build daily timeline combining GA4 visitors and GSC clicks
  const dailyChartData = useMemo(() => {
    const map = new Map<string, { date: string; visitors: number | null; searchClicks: number | null }>();

    for (const p of gscTimeseries.query.data ?? []) {
      map.set(p.date, { date: p.date, visitors: null, searchClicks: p.clicks ?? null });
    }

    for (const d of reportData?.daily ?? []) {
      const existing = map.get(d.date) ?? { date: d.date, visitors: null, searchClicks: null };
      existing.visitors = d.users ?? null;
      map.set(d.date, existing);
    }

    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [gscTimeseries.query.data, reportData?.daily, periodDays]);

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

  // Countries Breakdown
  const countriesBreakdown = useMemo<CountryBreakdownItem[]>(() => {
    const ga4Countries = reportData?.countries ?? [];
    if (ga4Countries.length > 0) {
      const totalSessions = ga4Countries.reduce((sum: number, c: { sessions?: number; users?: number }) => sum + (c.sessions ?? c.users ?? 0), 0) || 1;
      return ga4Countries
        .map((c) => {
          const rawCode = COUNTRY_NAME_TO_CODE[c.country.toUpperCase()] || c.country.slice(0, 2).toUpperCase();
          const geo = COUNTRY_COORDINATES[rawCode] || COUNTRY_COORDINATES[c.country.toUpperCase()];
          const countVal = c.sessions ?? c.users ?? 0;
          return {
            country: c.country,
            code: rawCode,
            flag: geo?.flag || "🌐",
            count: countVal,
            share: countVal / totalSessions,
            coords: geo ? { x: geo.x, y: geo.y } : null,
          };
        })
        .sort((a, b) => b.count - a.count);
    }

    const gscRows = countryBreakdown.query.data?.rows ?? [];
    if (gscRows.length > 0) {
      const totalClicks = gscRows.reduce((sum: number, r: { clicks?: number; impressions?: number }) => sum + (r.clicks ?? 0), 0) || 1;
      return gscRows
        .map((r) => {
          const rawCode = r.key.toUpperCase();
          const geo = COUNTRY_COORDINATES[rawCode];
          const countVal = r.clicks ?? 0;
          return {
            country: geo?.name || r.key.toUpperCase(),
            code: rawCode,
            flag: geo?.flag || "🌐",
            count: countVal,
            share: countVal / totalClicks,
            coords: geo ? { x: geo.x, y: geo.y } : null,
          };
        })
        .sort((a, b) => b.count - a.count);
    }

    return [];
  }, [reportData?.countries, countryBreakdown.query.data?.rows]);

  // Cities Breakdown
  const citiesBreakdown = useMemo<CityBreakdownItem[]>(() => {
    if (!reportData?.cities || reportData.cities.length === 0) {
      return [];
    }
    const totalSessions = reportData.cities.reduce((sum: number, c: { sessions?: number; users?: number }) => sum + (c.sessions ?? c.users ?? 0), 0) || 1;
    return reportData.cities
      .filter((c) => c.city && c.city !== "(not set)")
      .map((c) => {
        const countVal = c.sessions ?? c.users ?? 0;
        const rawCode = COUNTRY_NAME_TO_CODE[c.country?.toUpperCase()] || c.country?.slice(0, 2).toUpperCase() || "";
        const geo = COUNTRY_COORDINATES[rawCode] || COUNTRY_COORDINATES[c.country?.toUpperCase()];
        return {
          city: c.city,
          country: c.country || "Unknown",
          flag: geo?.flag || "📍",
          count: countVal,
          share: countVal / totalSessions,
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
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

      {/* ── 4 KPI METRIC CARDS ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Visitors */}
        <div className="rounded-2xl border border-brand-200/60 bg-brand-50/70 p-5 shadow-card">
          <p className="text-xs font-medium text-brand-400">Visitors</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-3xl font-extrabold tracking-tight text-brand-950">
              {count(visitorsCount)}
            </span>
          </div>
          <p className="mt-2 text-xs text-brand-400">
            {count(sessionsCount)} sessions · {sessionsPerVisitor} per visitor
          </p>
        </div>

        {/* Realtime activity */}
        <RealtimeActivity projectId={projectId} compact />

        {/* Search clicks */}
        <div className="rounded-2xl border border-brand-200/60 bg-brand-50/70 p-5 shadow-card">
          <p className="text-xs font-medium text-brand-400">Search clicks</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-3xl font-extrabold tracking-tight text-brand-950">
              {count(searchClicks)}
            </span>
          </div>
          <p className="mt-2 text-xs text-brand-400">
            {count(searchImpressions)} impressions · {percent(searchCtr)} CTR
          </p>
        </div>

        {/* Avg. search position */}
        <div className="rounded-2xl border border-brand-200/60 bg-brand-50/70 p-5 shadow-card">
          <p className="text-xs font-medium text-brand-400">Avg. search position</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-3xl font-extrabold tracking-tight text-brand-950">
              {searchPosition !== null && searchPosition > 0 ? `#${searchPosition.toFixed(1)}` : "—"}
            </span>
            <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-error-500">
              {positionChangePct !== null && positionChangePct !== undefined ? `${positionChangePct}% change` : "Change not measured"}
            </span>
          </div>
          <p className="mt-2 text-xs text-brand-400">Lower is better</p>
        </div>
      </div>

      

      {/* ── DAILY TRAFFIC CHART ── */}
      <div className="rounded-2xl border border-brand-200/60 bg-brand-50/70 p-6 shadow-card">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-brand-500" />
              <h2 className="text-sm font-bold text-brand-950">Daily traffic</h2>
            </div>
            <p className="mt-1 text-xs text-brand-400">
              Search Console data lags about three days
            </p>
          </div>

          <div className="flex items-center gap-4 text-xs font-medium">
            <span className="inline-flex items-center gap-1.5 text-brand-600">
              <span className="h-0.5 w-3 rounded-full bg-error-500" />
              Visitors
            </span>
            <span className="inline-flex items-center gap-1.5 text-brand-600">
              <span className="h-0.5 w-3 rounded-full bg-success-500" />
              Search clicks
            </span>
          </div>
        </div>

        <div className="mt-6 h-64 w-full">
          {dailyChartData.length === 0 ? <p className="text-sm text-brand-500">No saved daily measurements are available for this period.</p> : <ResponsiveContainer width="100%" height="100%">
            <LineChart data={dailyChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-brand-200)" opacity={0.4} vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={shortDay}
                tick={{ fontSize: 11, fill: "var(--color-brand-400)" }}
                axisLine={{ stroke: "var(--color-brand-200)", opacity: 0.5 }}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "var(--color-brand-400)" }}
                axisLine={false}
                tickLine={false}
                width={32}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--color-surface-1)",
                  borderColor: "var(--color-line)",
                  borderRadius: "0.75rem",
                  color: "var(--color-brand-950)",
                  fontSize: "12px",
                }}
                formatter={(val, name) => [count(Number(val)), name === "visitors" ? "Visitors" : "Search clicks"]}
                labelFormatter={(l) => shortDay(String(l))}
              />
              <Line
                type="monotone"
                dataKey="visitors"
                name="visitors"
                stroke="var(--color-error-500)"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 4, fill: "var(--color-error-500)" }}
              />
              <Line
                type="monotone"
                dataKey="searchClicks"
                name="searchClicks"
                stroke="var(--color-success-500)"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 4, fill: "var(--color-success-500)" }}
              />
            </LineChart>
          </ResponsiveContainer>}
        </div>
      </div>

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

      {/* ── ROW 2: MAP BOX & CITY BREAKDOWN (Requested by User) ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Visual World Map Box */}
        <div className="rounded-2xl border border-brand-200/60 bg-brand-50/70 p-6 shadow-card lg:col-span-7">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-brand-500" />
                <h2 className="text-sm font-bold text-brand-950">Global traffic map</h2>
              </div>
              <p className="mt-1 text-xs text-brand-400">
                Visitor distribution and country concentration
              </p>
            </div>
            {countriesBreakdown.length > 0 && (
              <span className="rounded-full bg-brand-100 px-3 py-1 font-mono text-xs font-semibold text-brand-700">
                {countriesBreakdown.length} {countriesBreakdown.length === 1 ? "country" : "countries"}
              </span>
            )}
          </div>

          {/* World Map SVG Projection */}
          <div className="mt-5 relative w-full overflow-hidden rounded-xl border border-brand-200/60 bg-surface-1 p-3 sm:p-4">
            <svg
              viewBox="0 0 800 360"
              className="h-auto w-full"
              role="img"
              aria-label="World Traffic Map"
            >
              <defs>
                <linearGradient id="traffic-map-ocean" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-surface-1)" />
                  <stop offset="100%" stopColor="var(--color-brand-50)" />
                </linearGradient>
                <radialGradient id="traffic-map-heat">
                  <stop offset="0%" stopColor="var(--color-signal-400)" stopOpacity=".3" />
                  <stop offset="100%" stopColor="var(--color-signal-400)" stopOpacity="0" />
                </radialGradient>
                <pattern id="traffic-map-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M40 0H0V40" fill="none" stroke="var(--color-brand-300)" strokeWidth=".6" opacity=".25" />
                </pattern>
              </defs>
              <rect width="800" height="360" rx="12" fill="url(#traffic-map-ocean)" />
              <rect width="800" height="360" fill="url(#traffic-map-grid)" />
              <g fill="none" stroke="var(--color-brand-300)" strokeWidth=".8" opacity=".24">
                {[60, 120, 180, 240, 300].map((y) => <path key={`lat-${y}`} d={`M0 ${y}H800`} />)}
                {[160, 320, 480, 640].map((x) => <path key={`lon-${x}`} d={`M${x} 0V360`} />)}
              </g>
              <g fill="var(--color-brand-200)" stroke="var(--color-brand-400)" strokeWidth="1" opacity=".62">
                {MAP_CONTINENTS.filter((d) => d !== "M0 0").map((d, i) => <path key={i} d={d} />)}
              </g>

              {/* Visitor concentration halos and country markers */}
              {countriesBreakdown.map((item: CountryBreakdownItem) => {
                if (!item.coords) return null;
                const isHovered = hoveredCountry === item.country;
                const radius = 10 + Math.sqrt(item.share) * 34;
                return (
                  <g
                    key={item.country}
                    className="cursor-pointer transition-all duration-200"
                    onMouseEnter={() => setHoveredCountry(item.country)}
                    onMouseLeave={() => setHoveredCountry(null)}
                  >
                    <circle
                      cx={item.coords.x}
                      cy={item.coords.y}
                      r={radius}
                      fill="url(#traffic-map-heat)"
                    />
                    <circle cx={item.coords.x} cy={item.coords.y} r={isHovered ? 12 : 9} fill="var(--color-signal-400)" opacity=".2" />
                    <circle
                      cx={item.coords.x}
                      cy={item.coords.y}
                      r={isHovered ? 5 : 3.5}
                      fill="var(--color-signal-400)"
                      stroke="var(--color-surface-1)"
                      strokeWidth="2"
                    />
                    <text
                      x={item.coords.x + 8}
                      y={item.coords.y - 8}
                      fill="var(--color-brand-950)"
                      fontSize="11"
                      fontWeight="700"
                      fontFamily="var(--font-mono)"
                      stroke="var(--color-surface-1)"
                      strokeWidth="3"
                      paintOrder="stroke"
                    >
                      {item.code}
                    </text>
                  </g>
                );
              })}
            </svg>

            {/* Hover Tooltip / Status overlay */}
            {hoveredCountry && (
              <div className="absolute bottom-3 left-3 rounded-lg border border-brand-200/80 bg-surface-1/95 px-3 py-1.5 shadow-md backdrop-blur-sm">
                {(() => {
                  const c = countriesBreakdown.find((item: CountryBreakdownItem) => item.country === hoveredCountry);
                  if (!c) return null;
                  return (
                    <div className="flex items-center gap-2 text-xs">
                      <span>{c.flag}</span>
                      <strong className="text-brand-950">{c.country}</strong>
                      <span className="font-mono text-brand-500">{count(c.count)} visitors</span>
                      <span className="font-mono font-semibold text-success-600">({percent(c.share)})</span>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>

          {/* Top Countries List */}
          <div className="mt-5 space-y-2.5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-brand-400">
              Top countries breakdown
            </h3>
            {countriesBreakdown.length > 0 ? (
              <div className="space-y-2">
                {countriesBreakdown.slice(0, 5).map((c: CountryBreakdownItem) => (
                  <div
                    key={c.country}
                    onMouseEnter={() => setHoveredCountry(c.country)}
                    onMouseLeave={() => setHoveredCountry(null)}
                    className={cn(
                      "flex items-center justify-between rounded-lg p-2 text-xs transition",
                      hoveredCountry === c.country ? "bg-brand-100" : "hover:bg-brand-100/50",
                    )}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-base leading-none">{c.flag}</span>
                      <span className="font-semibold text-brand-950">{c.country}</span>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="w-28 flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-brand-200/50">
                          <div
                            className="h-full rounded-full bg-signal-400"
                            style={{ width: `${Math.max(c.share * 100, 4)}%` }}
                          />
                        </div>
                        <span className="w-9 font-mono text-[11px] text-brand-500 text-right">
                          {percent(c.share)}
                        </span>
                      </div>
                      <span className="w-12 text-right font-mono font-bold text-brand-950">
                        {count(c.count)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-4 text-center text-xs text-brand-400">
                No geographic telemetry recorded for this period yet.
              </p>
            )}
          </div>
        </div>

        {/* Top Cities Box */}
        <div className="rounded-2xl border border-brand-200/60 bg-brand-50/70 p-6 shadow-card lg:col-span-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-brand-500" />
                <h2 className="text-sm font-bold text-brand-950">Top cities</h2>
              </div>
              <p className="mt-1 text-xs text-brand-400">
                Visitor distribution by metropolitan area
              </p>
            </div>
            {citiesBreakdown.length > 0 && (
              <span className="rounded-full bg-brand-100 px-3 py-1 font-mono text-xs font-semibold text-brand-700">
                {citiesBreakdown.length} cities
              </span>
            )}
          </div>

          <div className="mt-5 overflow-x-auto">
            {citiesBreakdown.length > 0 ? (
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-brand-200/60 text-brand-400">
                    <th className="pb-2.5 font-medium">City</th>
                    <th className="pb-2.5 font-medium">Share</th>
                    <th className="pb-2.5 text-right font-medium">Visitors</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-100">
                  {citiesBreakdown.map((row: CityBreakdownItem, idx: number) => (
                    <tr key={`${row.city}-${idx}`} className="hover:bg-brand-100/40 transition">
                      <td className="py-2.5 font-semibold text-brand-950">
                        <div className="flex items-center gap-2">
                          <span className="flex h-5 w-5 items-center justify-center rounded bg-brand-100 font-mono text-[10px] font-bold text-brand-600">
                            #{idx + 1}
                          </span>
                          <div>
                            <p className="font-semibold text-brand-950">{row.city}</p>
                            <p className="text-[10px] text-brand-400">
                              {row.flag} {row.country}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 pr-2">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-brand-200/50">
                            <div
                              className="h-full rounded-full bg-accent-500"
                              style={{ width: `${Math.max(row.share * 100, 4)}%` }}
                            />
                          </div>
                          <span className="font-mono text-[11px] text-brand-500">
                            {percent(row.share)}
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 text-right font-mono font-bold text-brand-950">
                        {count(row.count)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-100 text-brand-500">
                  <MapPin className="h-5 w-5" />
                </div>
                <p className="mt-3 text-xs font-semibold text-brand-950">
                  No city-level clicks or visitors recorded for this period yet
                </p>
                <p className="mt-1 max-w-[260px] text-[11px] text-brand-400">
                  Open the Report tab to analyze where your business operates (from Website Audit) and plan local traffic acquisition for your target cities.
                </p>
                <button
                  type="button"
                  onClick={() => selectTab("report")}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-brand-950 px-3.5 py-1.5 text-xs font-semibold text-brand-50 hover:bg-brand-800 transition"
                >
                  <Sparkles size={12} />
                  <span>Plan Target City Traffic in Report →</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

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

/**
 * Legacy export preserved for analytics-view.tsx
 */
export function buildTraffic(data: Ga4ReportData) {
  const total = data.channels.reduce((s, c) => s + c.sessions, 0) || data.totals.sessions;
  const groups = [
    {
      group: "Organic Search",
      sessions: data.organicSearchSessions || 0,
      users: 0,
      channels: ["Organic Search"],
      share: total > 0 ? (data.organicSearchSessions || 0) / total : null,
      engagementRate: null,
      keyEvents: null,
    },
  ];
  const pages = [...data.landingPages].sort((a, b) => b.sessions - a.sessions).slice(0, 25);
  return { data, groups, total, organic: data.organicSearchSessions || 0, organicShare: total > 0 ? (data.organicSearchSessions || 0) / total : null, pages };
}
