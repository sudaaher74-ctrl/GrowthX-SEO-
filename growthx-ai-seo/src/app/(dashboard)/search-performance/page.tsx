"use client";

import { Suspense, useState, useId } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  BarChart3,
  ExternalLink,
  Globe,
  HelpCircle,
  Layers,
  LineChart as LineChartIcon,
  Loader2,
  PlugZap,
  RefreshCw,
  Search as SearchIcon,
  Smartphone,
  TrendingUp,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";
import {
  ActionButton,
  Kpi,
  Panel,
  PageHeader,
  Table,
  Td,
  Th,
  Tr,
  Tabs,
  relativeTime,
} from "@/components/ui/console";
import { useWorkspace } from "@/hooks/use-growthx";
import { api, type GscPoint, type Ga4Point, type GscRow } from "@/lib/api-client";
import { errorMessage } from "@/lib/error-message";
import { PropertyPicker } from "@/components/ui/property-picker";
import {
  NotConnectedState,
  NoDataState,
  LoadingState,
  MetricBadge,
} from "@/components/ui/truthful-state";

const RANGES = [
  { label: "7 days", days: 7 },
  { label: "28 days", days: 28 },
  { label: "3 months", days: 90 },
  { label: "6 months", days: 180 },
  { label: "12 months", days: 365 },
];

const METRICS = [
  { key: "clicks", label: "Clicks", color: "var(--color-accent-600)" },
  { key: "impressions", label: "Impressions", color: "var(--color-series-2)" },
  { key: "ctr", label: "CTR", color: "var(--color-success-500)" },
  { key: "position", label: "Position", color: "var(--color-warning-500)" },
] as const;

const pct = (value: number) => `${(value * 100).toFixed(2)}%`;
const num = (value: number) => value.toLocaleString();
const day = (value: string) => new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });

export default function SearchPerformancePage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-brand-400">Loading Search Performance...</div>}>
      <SearchPerformanceClient />
    </Suspense>
  );
}

function SearchPerformanceClient() {
  const { projectId } = useWorkspace();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<string>("organic");
  const [days, setDays] = useState(28);
  const [metric, setMetric] = useState<(typeof METRICS)[number]["key"]>("clicks");
  const [openPage, setOpenPage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const connections = useQuery({
    queryKey: ["google-connections", projectId],
    queryFn: () => api.googleConnections(projectId!),
    enabled: !!projectId,
  });

  const gsc = connections.data?.providers.find((p) => p.id === "search_console");
  const ga4 = connections.data?.providers.find((p) => p.id === "analytics");

  const gscConnected = gsc?.status === "CONNECTED";
  const ga4Connected = ga4?.status === "CONNECTED";

  // Search Console Queries
  const gscSummary = useQuery({
    queryKey: ["gsc-summary", projectId, days],
    queryFn: () => api.gscSummary(projectId!, days),
    enabled: !!projectId && gscConnected,
  });
  const gscSeries = useQuery({
    queryKey: ["gsc-series", projectId, days],
    queryFn: () => api.gscTimeseries(projectId!, days),
    enabled: !!projectId && gscConnected,
  });
  const gscQueries = useQuery({
    queryKey: ["gsc-queries", projectId, days],
    queryFn: () => api.gscQueries(projectId!, days),
    enabled: !!projectId && gscConnected,
  });
  const gscPages = useQuery({
    queryKey: ["gsc-pages", projectId, days],
    queryFn: () => api.gscPages(projectId!, days),
    enabled: !!projectId && gscConnected,
  });
  const strikingDistance = useQuery({
    queryKey: ["gsc-striking", projectId, days],
    queryFn: () => api.gscStrikingDistance(projectId!, days),
    enabled: !!projectId && gscConnected,
  });
  const ctrOpportunities = useQuery({
    queryKey: ["gsc-ctr-opps", projectId, days],
    queryFn: () => api.gscCtrOpportunities(projectId!, days),
    enabled: !!projectId && gscConnected,
  });

  // Analytics Queries
  const ga4Summary = useQuery({
    queryKey: ["ga4-summary", projectId, days],
    queryFn: () => api.ga4Summary(projectId!, days),
    enabled: !!projectId && ga4Connected,
  });
  const ga4Series = useQuery({
    queryKey: ["ga4-series", projectId, days],
    queryFn: () => api.ga4Timeseries(projectId!, days),
    enabled: !!projectId && ga4Connected,
  });
  const ga4PageValue = useQuery({
    queryKey: ["ga4-page-value", projectId, days],
    queryFn: () => api.ga4PageValue(projectId!, days),
    enabled: !!projectId && ga4Connected,
  });

  // Sync Mutations
  const gscSync = useMutation({
    mutationFn: () => api.gscSync(projectId!, days),
    onSuccess: () => {
      setError(null);
      qc.invalidateQueries({ queryKey: ["gsc-summary"] });
      qc.invalidateQueries({ queryKey: ["gsc-series"] });
      qc.invalidateQueries({ queryKey: ["gsc-queries"] });
      qc.invalidateQueries({ queryKey: ["gsc-pages"] });
      qc.invalidateQueries({ queryKey: ["google-connections"] });
    },
    onError: (err) => setError(errorMessage(err)),
  });

  const ga4Sync = useMutation({
    mutationFn: () => api.ga4Sync(projectId!, days),
    onSuccess: () => {
      setError(null);
      qc.invalidateQueries({ queryKey: ["ga4-summary"] });
      qc.invalidateQueries({ queryKey: ["ga4-series"] });
      qc.invalidateQueries({ queryKey: ["ga4-page-value"] });
      qc.invalidateQueries({ queryKey: ["google-connections"] });
    },
    onError: (err) => setError(errorMessage(err)),
  });

  const tabs = [
    { id: "organic", label: "Organic Search" },
    { id: "traffic", label: "Traffic & Engagement" },
    { id: "landing-pages", label: "Landing Pages" },
    { id: "queries", label: "Queries" },
    { id: "devices", label: "Devices" },
    { id: "countries", label: "Countries" },
    { id: "conversions", label: "Conversions" },
    { id: "coverage", label: "Index Coverage" },
    { id: "connections", label: "Data Connections" },
  ];

  const handleSyncAll = () => {
    if (gscConnected) gscSync.mutate();
    if (ga4Connected) ga4Sync.mutate();
  };

  const isSyncing = gscSync.isPending || ga4Sync.isPending;

  return (
    <div className="space-y-5 pb-12">
      <PageHeader
        title="Search Performance"
        subtitle="Authoritative Google Search Console rankings and Google Analytics traffic."
        actions={
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-lg border bg-white p-0.5" style={{ borderColor: "var(--border-color)" }}>
              {RANGES.map((r) => (
                <button
                  key={r.days}
                  onClick={() => setDays(r.days)}
                  className={`rounded-md px-2.5 py-1 text-[11.5px] font-semibold transition-colors ${
                    days === r.days
                      ? "bg-brand-950 text-white"
                      : "text-brand-500 hover:text-brand-950"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>

            {(gscConnected || ga4Connected) && (
              <ActionButton
                variant="secondary"
                icon={isSyncing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                onClick={handleSyncAll}
                disabled={isSyncing}
              >
                {isSyncing ? "Syncing…" : "Sync now"}
              </ActionButton>
            )}
          </div>
        }
      />

      {error && (
        <div className="rounded-lg border border-error-200 bg-error-50/50 p-3 text-[12px] text-error-700">
          {error}
        </div>
      )}

      {/* 9 Navigation Tabs */}
      <Tabs tabs={tabs} active={activeTab} onChange={setActiveTab} />

      {/* Tab 1: Organic Search */}
      {activeTab === "organic" && (
        <div className="space-y-4">
          {!gscConnected ? (
            <NotConnectedState
              title="Google Search Console Not Connected"
              missing="Search Console provides authoritative Google click counts, search impressions, CTR, and average position."
              whyItMatters="Without Search Console, organic search performance cannot be measured."
              actionRequired="Connect your Google Search Console property in Data Connections."
              action={{ label: "Go to Data Connections", onClick: () => setActiveTab("connections") }}
            />
          ) : gscSummary.isLoading ? (
            <LoadingState title="Loading Organic Search Data..." message="Fetching verified Search Console rows..." />
          ) : !gscSummary.data ? (
            <NoDataState
              title="No Search Data Synced Yet"
              missing="Search Console is authorized, but no search records have synced for this property yet."
              whyItMatters="Initial Search Console sync can take a few moments to ingest 28 days of historical query data."
              actionRequired="Click Sync Now to fetch search performance."
              action={{ label: "Sync Now", onClick: () => gscSync.mutate(), variant: "primary" }}
            />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Kpi
                  label="Search clicks"
                  value={num(gscSummary.data.clicks.current)}
                  delta={gscSummary.data.clicks.changePct != null ? Math.round(gscSummary.data.clicks.changePct * 100) : null}
                  sub={`vs previous ${days} days`}
                />
                <Kpi
                  label="Impressions"
                  value={num(gscSummary.data.impressions.current)}
                  delta={gscSummary.data.impressions.changePct != null ? Math.round(gscSummary.data.impressions.changePct * 100) : null}
                  sub={`vs previous ${days} days`}
                />
                <Kpi
                  label="Average CTR"
                  value={pct(gscSummary.data.ctr.current)}
                  delta={gscSummary.data.ctr.changePct != null ? Math.round(gscSummary.data.ctr.changePct * 100) : null}
                  sub={`vs previous ${days} days`}
                />
                <Kpi
                  label="Average position"
                  value={gscSummary.data.position.current.toFixed(1)}
                  delta={
                    gscSummary.data.position.changePct != null
                      ? -Math.round(gscSummary.data.position.changePct * 100)
                      : null
                  }
                  sub={`vs previous ${days} days`}
                />
              </div>

              <Panel
                title="Performance Timeseries"
                subtitle={`Daily Google Search metrics over the past ${days} days`}
                actions={
                  <div className="flex items-center gap-1.5">
                    {METRICS.map((m) => (
                      <button
                        key={m.key}
                        onClick={() => setMetric(m.key)}
                        className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                          metric === m.key
                            ? "bg-brand-950 text-white"
                            : "border bg-white text-brand-600 hover:bg-brand-50"
                        }`}
                        style={{ borderColor: "var(--border-color)" }}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                }
              >
                <div className="p-4">
                  {gscSeries.data && gscSeries.data.length > 0 ? (
                    <div className="h-64 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={gscSeries.data}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-brand-100)" vertical={false} />
                          <XAxis dataKey="date" tickFormatter={day} tick={{ fontSize: 11, fill: "var(--text-muted)" }} />
                          <YAxis
                            tick={{ fontSize: 11, fill: "var(--text-muted)" }}
                            reversed={metric === "position"}
                            tickFormatter={(v) => (metric === "ctr" ? pct(v) : metric === "position" ? v.toFixed(1) : num(v))}
                          />
                          <Tooltip
                            formatter={(v: any) => [metric === "ctr" ? pct(v) : metric === "position" ? v.toFixed(1) : num(v), METRICS.find(m => m.key === metric)?.label]}
                            labelFormatter={(l: any) => new Date(l).toDateString()}
                          />
                          <Line
                            type="monotone"
                            dataKey={metric}
                            stroke={METRICS.find((m) => m.key === metric)?.color || "#000"}
                            strokeWidth={2}
                            dot={false}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="py-12 text-center text-[12px] text-brand-400">No timeseries data available.</div>
                  )}
                </div>
              </Panel>
            </>
          )}
        </div>
      )}

      {/* Tab 2: Traffic & Engagement (GA4) */}
      {activeTab === "traffic" && (
        <div className="space-y-4">
          {!ga4Connected ? (
            <NotConnectedState
              title="Google Analytics 4 Not Connected"
              missing="GA4 measures user sessions, engagement duration, bounce rate, and post-click events."
              whyItMatters="Without GA4, traffic and on-site conversions cannot be tracked."
              actionRequired="Connect your GA4 measurement stream in Data Connections."
              action={{ label: "Go to Data Connections", onClick: () => setActiveTab("connections") }}
            />
          ) : ga4Summary.isLoading ? (
            <LoadingState title="Loading GA4 Engagement Data..." />
          ) : !ga4Summary.data ? (
            <NoDataState
              title="No GA4 Data Synced Yet"
              missing="Google Analytics is linked, but no user sessions have been recorded in the database yet."
              actionRequired="Run a sync to ingest traffic."
              action={{ label: "Sync GA4 Now", onClick: () => ga4Sync.mutate(), variant: "primary" }}
            />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Kpi label="Active Users" value={num(ga4Summary.data.users.current)} sub={`past ${days} days`} />
                <Kpi label="Sessions" value={num(ga4Summary.data.sessions.current)} sub={`past ${days} days`} />
                <Kpi label="Conversions" value={ga4Summary.data.conversions ? num(ga4Summary.data.conversions.current) : "Not configured"} sub={ga4Summary.data.conversions ? `past ${days} days` : "No key events set"} />
                <Kpi label="Engagement Rate" value={pct(ga4Summary.data.engagementRate.current)} sub="sessions > 10s" />
              </div>

              <Panel title="User Traffic Trend" subtitle={`Daily active users and sessions over the past ${days} days`}>
                <div className="p-4">
                  {ga4Series.data && ga4Series.data.length > 0 ? (
                    <div className="h-64 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={ga4Series.data}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-brand-100)" vertical={false} />
                          <XAxis dataKey="date" tickFormatter={day} tick={{ fontSize: 11, fill: "var(--text-muted)" }} />
                          <YAxis tick={{ fontSize: 11, fill: "var(--text-muted)" }} tickFormatter={num} />
                          <Tooltip formatter={(v: any, name: any) => [num(v), name]} />
                          <Line type="monotone" dataKey="sessions" stroke="var(--color-accent-600)" strokeWidth={2} dot={false} name="Sessions" />
                          <Line type="monotone" dataKey="users" stroke="var(--color-series-2)" strokeWidth={2} dot={false} name="Users" />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="py-12 text-center text-[12px] text-brand-400">No session timeseries data.</div>
                  )}
                </div>
              </Panel>
            </>
          )}
        </div>
      )}

      {/* Tab 3: Landing Pages */}
      {activeTab === "landing-pages" && (
        <Panel title="Top Landing Pages" subtitle="Highest-performing organic entry pages from Google Search">
          <div className="p-0">
            {!gscConnected ? (
              <div className="p-8">
                <NotConnectedState
                  title="Search Console Required for Landing Pages"
                  action={{ label: "Connect Search Console", onClick: () => setActiveTab("connections") }}
                  compact
                />
              </div>
            ) : gscPages.isLoading ? (
              <div className="p-8 text-center text-[12px] text-brand-400">Loading top pages...</div>
            ) : !gscPages.data || gscPages.data.length === 0 ? (
              <div className="p-8 text-center text-[12px] text-brand-400">No landing pages found for this date range.</div>
            ) : (
              <Table minWidth={700}>
                <thead>
                  <tr>
                    <Th>Page URL</Th>
                    <Th align="right">Clicks</Th>
                    <Th align="right">Impressions</Th>
                    <Th align="right">CTR</Th>
                    <Th align="right">Avg Position</Th>
                  </tr>
                </thead>
                <tbody>
                  {gscPages.data.map((page) => (
                    <Tr key={page.key}>
                      <Td>
                        <span className="font-mono text-[12px] text-brand-950 font-medium truncate block max-w-md">
                          {page.key}
                        </span>
                      </Td>
                      <Td align="right"><span className="font-mono font-bold text-brand-950">{num(page.clicks)}</span></Td>
                      <Td align="right"><span className="font-mono text-brand-500">{num(page.impressions)}</span></Td>
                      <Td align="right"><span className="font-mono text-brand-600">{pct(page.ctr)}</span></Td>
                      <Td align="right"><span className="font-mono text-brand-600">#{page.position.toFixed(1)}</span></Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            )}
          </div>
        </Panel>
      )}

      {/* Tab 4: Queries */}
      {activeTab === "queries" && (
        <div className="space-y-4">
          <Panel title="Top Search Queries" subtitle="Keywords driving search impressions and clicks">
            <div className="p-0">
              {!gscConnected ? (
                <div className="p-8">
                  <NotConnectedState
                    title="Search Console Required for Queries"
                    action={{ label: "Connect Search Console", onClick: () => setActiveTab("connections") }}
                    compact
                  />
                </div>
              ) : gscQueries.isLoading ? (
                <div className="p-8 text-center text-[12px] text-brand-400">Loading top queries...</div>
              ) : !gscQueries.data || gscQueries.data.length === 0 ? (
                <div className="p-8 text-center text-[12px] text-brand-400">No query data recorded for this date range.</div>
              ) : (
                <Table minWidth={700}>
                  <thead>
                    <tr>
                      <Th>Query</Th>
                      <Th align="right">Clicks</Th>
                      <Th align="right">Impressions</Th>
                      <Th align="right">CTR</Th>
                      <Th align="right">Position</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {gscQueries.data.map((q) => (
                      <Tr key={q.key}>
                        <Td>
                          <span className="text-[12.5px] font-semibold text-brand-950">{q.key}</span>
                        </Td>
                        <Td align="right"><span className="font-mono font-bold text-brand-950">{num(q.clicks)}</span></Td>
                        <Td align="right"><span className="font-mono text-brand-500">{num(q.impressions)}</span></Td>
                        <Td align="right"><span className="font-mono text-brand-600">{pct(q.ctr)}</span></Td>
                        <Td align="right"><span className="font-mono text-brand-600">#{q.position.toFixed(1)}</span></Td>
                      </Tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </div>
          </Panel>

          {/* Striking Distance Opportunities — Opportunity Cards */}
          {strikingDistance.data && strikingDistance.data.length > 0 && (
            <div className="rounded-xl border bg-white shadow-2xs" style={{ borderColor: "var(--border-color)" }}>
              <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--color-brand-100)" }}>
                <div>
                  <h3 className="text-[13.5px] font-semibold text-brand-950 flex items-center gap-2">
                    <TrendingUp size={15} className="text-amber-500" />
                    Striking Distance Opportunities
                  </h3>
                  <p className="text-[11.5px] text-brand-500 mt-0.5">
                    Page 2 keywords (pos. 4–20) that could jump to Page 1 with minor on-page improvements. {strikingDistance.data.length} keywords found.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4">
                {strikingDistance.data.slice(0, 8).map((r, i) => {
                  const positionTier =
                    r.position <= 10 ? "amber" :
                    r.position <= 15 ? "orange" : "rose";
                  const positionColor =
                    positionTier === "amber" ? "bg-amber-100 text-amber-800 ring-1 ring-amber-200" :
                    positionTier === "orange" ? "bg-orange-100 text-orange-800 ring-1 ring-orange-200" :
                    "bg-rose-100 text-rose-800 ring-1 ring-rose-200";
                  const potentialClicks = Math.round(r.impressions * 0.032);
                  const ctrGap = Math.max(0, 0.032 - r.ctr);
                  return (
                    <div
                      key={i}
                      className="rounded-xl border bg-gradient-to-br from-white to-brand-50/30 p-4 hover:shadow-sm transition group"
                      style={{ borderColor: "var(--border-color)" }}
                    >
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <span className={`shrink-0 inline-flex h-8 w-8 items-center justify-center rounded-full font-bold text-[11px] ${positionColor}`}>
                          #{r.position.toFixed(0)}
                        </span>
                        <p className="flex-1 text-[12.5px] font-semibold text-brand-950 leading-snug line-clamp-2">
                          {r.key}
                        </p>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-center mb-3">
                        <div className="rounded-lg bg-brand-50 px-2 py-1.5 border border-brand-100">
                          <span className="block text-[13px] font-bold text-brand-950 font-mono">{num(r.impressions)}</span>
                          <span className="text-[9.5px] text-brand-400 uppercase tracking-wider">Impressions</span>
                        </div>
                        <div className="rounded-lg bg-brand-50 px-2 py-1.5 border border-brand-100">
                          <span className="block text-[13px] font-bold text-amber-700 font-mono">{pct(r.ctr)}</span>
                          <span className="text-[9.5px] text-brand-400 uppercase tracking-wider">Current CTR</span>
                        </div>
                        <div className="rounded-lg bg-emerald-50 px-2 py-1.5 border border-emerald-100">
                          <span className="block text-[13px] font-bold text-emerald-700 font-mono">+{num(potentialClicks)}</span>
                          <span className="text-[9.5px] text-emerald-600 uppercase tracking-wider">Est. Clicks</span>
                        </div>
                      </div>

                      <div className="mb-3">
                        <div className="flex justify-between text-[10px] text-brand-400 mb-1">
                          <span>CTR Gap to Page 1 avg (3.2%)</span>
                          <span className="text-amber-600 font-semibold">+{(ctrGap * 100).toFixed(1)}% potential</span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-brand-100 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-amber-400 to-emerald-500"
                            style={{ width: `${Math.min(100, (ctrGap / 0.032) * 100)}%` }}
                          />
                        </div>
                      </div>

                      <a
                        href={`/content-opportunities?q=${encodeURIComponent(r.key)}`}
                        className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-brand-200 bg-white py-1.5 text-[11px] font-semibold text-brand-700 hover:bg-brand-50 hover:border-brand-400 transition"
                      >
                        <TrendingUp size={11} />
                        Create Content Brief
                      </a>
                    </div>
                  );
                })}
              </div>

              {strikingDistance.data.length > 8 && (
                <div className="px-5 pb-4 text-center">
                  <span className="text-[11.5px] text-brand-400">
                    + {strikingDistance.data.length - 8} more striking distance keywords in the full report
                  </span>
                </div>
              )}
            </div>
          )}

          {/* CTR Opportunities Section */}
          {ctrOpportunities.data && ctrOpportunities.data.length > 0 && (
            <div className="rounded-xl border bg-white shadow-2xs" style={{ borderColor: "var(--border-color)" }}>
              <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--color-brand-100)" }}>
                <div>
                  <h3 className="text-[13.5px] font-semibold text-brand-950 flex items-center gap-2">
                    <BarChart3 size={15} className="text-blue-500" />
                    CTR Improvement Opportunities
                  </h3>
                  <p className="text-[11.5px] text-brand-500 mt-0.5">
                    Queries with high impressions but below-average click-through rates. Improve title tags and meta descriptions.
                  </p>
                </div>
              </div>
              <Table minWidth={600}>
                <thead>
                  <tr>
                    <Th>Query</Th>
                    <Th align="right">Impressions</Th>
                    <Th align="right">Current CTR</Th>
                    <Th align="right">Avg Position</Th>
                    <Th align="right">Est. Opportunity</Th>
                  </tr>
                </thead>
                <tbody>
                  {ctrOpportunities.data.slice(0, 10).map((r, i) => {
                    const estExtraClicks = Math.round(r.impressions * Math.max(0, 0.03 - r.ctr));
                    return (
                      <Tr key={i}>
                        <Td><span className="font-semibold text-brand-950">{r.key}</span></Td>
                        <Td align="right"><span className="font-mono text-brand-500">{num(r.impressions)}</span></Td>
                        <Td align="right">
                          <span className={`font-mono font-bold ${r.ctr < 0.01 ? "text-rose-600" : "text-amber-600"}`}>
                            {pct(r.ctr)}
                          </span>
                        </Td>
                        <Td align="right"><span className="font-mono text-brand-600">#{r.position.toFixed(1)}</span></Td>
                        <Td align="right">
                          <span className="font-mono font-bold text-emerald-600">+{num(estExtraClicks)} clicks</span>
                        </Td>
                      </Tr>
                    );
                  })}
                </tbody>
              </Table>
            </div>
          )}
        </div>
      )}

      {/* Tab 5: Devices */}
      {activeTab === "devices" && (
        <Panel title="Device Distribution" subtitle="Organic search traffic by visitor device category">
          <div className="p-6">
            {!gscConnected ? (
              <NotConnectedState title="Connect Search Console to view device breakdown" action={{ label: "Connect", onClick: () => setActiveTab("connections") }} compact />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-xl border p-4 text-center bg-white" style={{ borderColor: "var(--border-color)" }}>
                  <Smartphone size={24} className="mx-auto text-brand-500 mb-2" />
                  <span className="text-[12px] font-semibold text-brand-950">Mobile</span>
                  <p className="text-[11.5px] text-brand-400 mt-1">Primary audience for local and quick discovery searches.</p>
                </div>
                <div className="rounded-xl border p-4 text-center bg-white" style={{ borderColor: "var(--border-color)" }}>
                  <Layers size={24} className="mx-auto text-brand-500 mb-2" />
                  <span className="text-[12px] font-semibold text-brand-950">Desktop</span>
                  <p className="text-[11.5px] text-brand-400 mt-1">High conversion and long session engagement.</p>
                </div>
                <div className="rounded-xl border p-4 text-center bg-white" style={{ borderColor: "var(--border-color)" }}>
                  <Globe size={24} className="mx-auto text-brand-500 mb-2" />
                  <span className="text-[12px] font-semibold text-brand-950">Tablet / Other</span>
                  <p className="text-[11.5px] text-brand-400 mt-1">Secondary screen traffic.</p>
                </div>
              </div>
            )}
          </div>
        </Panel>
      )}

      {/* Tab 6: Countries */}
      {activeTab === "countries" && (
        <Panel title="Geographic Breakdown" subtitle="Search interest and impressions by nation">
          <div className="p-6">
            {!gscConnected ? (
              <NotConnectedState title="Connect Search Console to view country distribution" action={{ label: "Connect", onClick: () => setActiveTab("connections") }} compact />
            ) : (
              <p className="text-[12.5px] text-brand-500">
                Geographic search distribution is synced automatically with country-level query clusters.
              </p>
            )}
          </div>
        </Panel>
      )}

      {/* Tab 7: Conversions */}
      {activeTab === "conversions" && (
        <Panel title="Conversions & Page Value" subtitle="Goal completions and engagement value measured by GA4">
          <div className="p-6">
            {!ga4Connected ? (
              <NotConnectedState title="Connect GA4 to view conversion tracking" action={{ label: "Connect GA4", onClick: () => setActiveTab("connections") }} compact />
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 max-w-md">
                  <Kpi label="Conversions" value={ga4Summary.data?.conversions ? num(ga4Summary.data.conversions.current) : "—"} sub={ga4Summary.data?.conversions ? `past ${days} days` : "Not configured"} />
                  <Kpi label="Revenue" value={ga4Summary.data?.revenue ? `$${num(ga4Summary.data.revenue.current)}` : "—"} sub={ga4Summary.data?.revenue ? `past ${days} days` : "Not configured"} />
                </div>
                <p className="text-[12px] text-brand-400">
                  Custom conversion goals configured in Google Analytics 4 stream directly to GrowthX.
                </p>
              </div>
            )}
          </div>
        </Panel>
      )}

      {/* Tab 8: Index Coverage */}
      {activeTab === "coverage" && (
        <Panel title="Index Coverage & Health" subtitle="Google indexation status across crawled and submitted URLs">
          <div className="p-6">
            {!gscConnected ? (
              <NotConnectedState title="Connect Search Console to inspect index coverage" action={{ label: "Connect", onClick: () => setActiveTab("connections") }} compact />
            ) : (
              <div className="space-y-3">
                <div className="rounded-lg border p-4 bg-brand-50/20" style={{ borderColor: "var(--border-color)" }}>
                  <h4 className="text-[13px] font-semibold text-brand-950">Authoritative URL Index Status</h4>
                  <p className="text-[12px] text-brand-500 mt-1">
                    Coverage tracks pages indexed versus excluded by Google due to noindex directives, canonical mismatches, or soft 404s.
                  </p>
                </div>
              </div>
            )}
          </div>
        </Panel>
      )}

      {/* Tab 9: Data Connections & Property Picker */}
      {activeTab === "connections" && (
        <div className="space-y-4">
          <Panel title="Search Console & Analytics Integration" subtitle="Manage Google authorizations, select active properties, and sync">
            <div className="p-5 space-y-6">
              {/* GSC Card */}
              <div className="rounded-xl border p-4 bg-white" style={{ borderColor: "var(--border-color)" }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                      <SearchIcon size={18} />
                    </div>
                    <div>
                      <h4 className="text-[13.5px] font-semibold text-brand-950">Google Search Console</h4>
                      <p className="text-[11.5px] text-brand-500">
                        {gsc?.googleAccountEmail ? `Authorized as ${gsc.googleAccountEmail}` : "Not connected"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <MetricBadge state={gscConnected ? "MEASURED" : "NOT_CONNECTED"} />
                  </div>
                </div>

                {projectId && (
                  <div className="mt-4 pt-3 border-t" style={{ borderColor: "var(--color-brand-100)" }}>
                    <PropertyPicker provider="search_console" projectId={projectId} />
                  </div>
                )}
              </div>

              {/* GA4 Card */}
              <div className="rounded-xl border p-4 bg-white" style={{ borderColor: "var(--border-color)" }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
                      <BarChart3 size={18} />
                    </div>
                    <div>
                      <h4 className="text-[13.5px] font-semibold text-brand-950">Google Analytics 4</h4>
                      <p className="text-[11.5px] text-brand-500">
                        {ga4?.googleAccountEmail ? `Authorized as ${ga4.googleAccountEmail}` : "Not connected"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <MetricBadge state={ga4Connected ? "MEASURED" : "NOT_CONNECTED"} />
                  </div>
                </div>

                {projectId && (
                  <div className="mt-4 pt-3 border-t" style={{ borderColor: "var(--color-brand-100)" }}>
                    <PropertyPicker provider="analytics" projectId={projectId} />
                  </div>
                )}
              </div>
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
}
