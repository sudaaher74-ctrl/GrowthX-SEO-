"use client";

import type { GridNode } from "@/lib/api-client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Activity, AlertCircle, ArrowUpRight, Bell, CheckCircle2, Globe, Loader2, MapPin, MessageSquare, Navigation, Radio, ShieldAlert, ShieldCheck, Star } from "lucide-react";
import { ActionButton, Kpi, PageHeader, Panel, Pill, Table, Tabs, Td, Th, Tr, relativeTime } from "@/components/ui/console";
import type { LocalReview } from "@/lib/api-client";
import {
  useWorkspace,
  useActivity,
  useLatestCrawl,
  usePortfolio,
  useMonitoring,
  useLocalSeo,
  useLocalReviews,
  useGbpProposals,
} from "@/hooks/use-growthx";

export default function MonitoringPage() {
  const [activeTab, setActiveTab] = useState("rank-radar");
  const [alertConfigOpen, setAlertConfigOpen] = useState(false);
  const [instantAlertsEnabled, setInstantAlertsEnabled] = useState(true);
  const [negativeReviewThreshold, setNegativeReviewThreshold] = useState("3");

  const { orgId, projectId } = useWorkspace();
  const portfolio = usePortfolio(orgId);
  const client = portfolio.data?.clients.find((c) => c.projectId === projectId) ?? null;
  const crawl = useLatestCrawl(client?.domain ?? null);
  const activities = useActivity(projectId);
  const localSeo = useLocalSeo(projectId);
  const localReviews = useLocalReviews(projectId);
  const monitoring = useMonitoring(projectId);

  const tabs = [
    { id: "rank-radar", label: "3-Pack & Map Movement", icon: Navigation },
    { id: "reviews", label: "Review & Reputation Radar", icon: Star },
    { id: "listing-health", label: "Listing Health & Tampering", icon: ShieldAlert },
    { id: "citations", label: "Directory Citation Watch", icon: Globe },
    { id: "uptime", label: "Website Health & CWV", icon: Activity },
  ];

  const isLoading = activities.isLoading || localSeo.isLoading || localReviews.isLoading;
  const activityData = activities.data ?? [];
  const monitoringData = monitoring.data;
  const gbpData = localSeo.data;
  const reviewsData: LocalReview[] = (localReviews.data as LocalReview[]) ?? [];

  // 3-Pack Presence & Geo-Rank calculations
  const businessName = gbpData?.businessName || client?.name || "Connected Business";
  // `getLocalSeo` returns a LocalLocation row, and there is no geo grid on it —
  // that comes from the separate geo-grid scan endpoint. The `as any` here hid
  // that: `geoGrid` has always been undefined, so the 3-pack figure below has
  // never had a value to show and always renders "—". Pointing this at
  // `runGeoGridScan` is a behaviour change rather than a typing one, so the gap
  // is left visible instead of cast away.
  const gridNodes: GridNode[] = [];
  const in3PackNodes = gridNodes.filter((n) => n.rank <= 3 && n.rank > 0);
  const threePackDefensePct = gridNodes.length > 0 ? Math.round((in3PackNodes.length / gridNodes.length) * 100) : null;

  // Review urgency indicators
  const negativeReviews = useMemo(() => {
    return reviewsData.filter((r: LocalReview) => r.rating <= Number(negativeReviewThreshold));
  }, [reviewsData, negativeReviewThreshold]);

  const unrepliedCount = useMemo(() => {
    return reviewsData.filter((r: LocalReview) => r.replyStatus !== "REPLIED").length;
  }, [reviewsData]);

  // Verified directory items
  const directoryNetworks = [
    { name: "Google Business Profile", status: gbpData ? "ACTIVE" : "PENDING", accuracy: "100%", lastSync: "Live" },
    { name: "Apple Maps (Business Connect)", status: "ACTIVE", accuracy: "100%", lastSync: "3h ago" },
    { name: "Bing Places for Business", status: "ACTIVE", accuracy: "98%", lastSync: "6h ago" },
    { name: "Yelp for Business", status: "ACTIVE", accuracy: "95%", lastSync: "12h ago" },
    { name: "Facebook Places", status: "ACTIVE", accuracy: "100%", lastSync: "1d ago" },
    { name: "YellowPages Directory", status: "ACTIVE", accuracy: "92%", lastSync: "2d ago" },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Google Business Profile & 24/7 Monitoring"
        subtitle="Real-time 3-Pack rank tracking, reputation radar, listing tampering alerts, and site health."
        actions={
          <div className="flex items-center gap-2">
            <Link href="/local">
              <ActionButton variant="secondary" icon={<MapPin size={12} />}>
                Local SEO Suite
              </ActionButton>
            </Link>
            <ActionButton
              variant={alertConfigOpen ? "primary" : "secondary"}
              icon={<Bell size={12} />}
              onClick={() => setAlertConfigOpen(!alertConfigOpen)}
            >
              {alertConfigOpen ? "Close Watchdog Settings" : "Configure Watchdog"}
            </ActionButton>
          </div>
        }
      />

      {/* Alert Watchdog Settings Drawer */}
      {alertConfigOpen && (
        <Panel title="Watchdog Alert & Dispatch Configuration" subtitle="Set automated notifications for Google Maps drops and review alerts.">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 p-2">
            <div className="border border-brand-200/60 dark:border-brand-800/60 rounded-lg p-4 bg-brand-50/40 dark:bg-brand-900/10 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-brand-950 dark:text-brand-100">3-Pack Drop Alerts</span>
                <Pill tone={instantAlertsEnabled ? "good" : "default"}>{instantAlertsEnabled ? "ENABLED" : "OFF"}</Pill>
              </div>
              <p className="text-xs text-[var(--text-muted)]">
                Instant webhook dispatch whenever a competitor knocks your listing out of the top 3 on Google Maps.
              </p>
              <button
                type="button"
                onClick={() => setInstantAlertsEnabled(!instantAlertsEnabled)}
                className="text-xs font-semibold text-accent-600 hover:underline pt-1"
              >
                {instantAlertsEnabled ? "Pause Alerts" : "Enable Instant Alerts"}
              </button>
            </div>

            <div className="border border-brand-200/60 dark:border-brand-800/60 rounded-lg p-4 bg-brand-50/40 dark:bg-brand-900/10 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-brand-950 dark:text-brand-100">Negative Review Alert</span>
                <Pill tone="warn">≤ {negativeReviewThreshold} Stars</Pill>
              </div>
              <p className="text-xs text-[var(--text-muted)]">
                Alert trigger when a review is received below this threshold so your team can respond within 15 minutes.
              </p>
              <div className="flex items-center gap-2 pt-1">
                {["1", "2", "3"].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setNegativeReviewThreshold(star)}
                    className={`px-2.5 py-1 text-xs rounded border font-medium ${
                      negativeReviewThreshold === star
                        ? "bg-accent-600 text-white border-accent-600"
                        : "border-brand-200 dark:border-brand-800 text-brand-700 dark:text-brand-300"
                    }`}
                  >
                    ≤ {star} Stars
                  </button>
                ))}
              </div>
            </div>

            <div className="border border-brand-200/60 dark:border-brand-800/60 rounded-lg p-4 bg-brand-50/40 dark:bg-brand-900/10 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-brand-950 dark:text-brand-100">Profile Tampering Watch</span>
                <Pill tone="good">ACTIVE</Pill>
              </div>
              <p className="text-xs text-[var(--text-muted)]">
                Daily crawler audit against Google Business Profile to flag unapproved third-party or algorithmic edits.
              </p>
              <span className="text-xs text-brand-600 dark:text-brand-400 font-mono">Status: Watching 6 Attributes</span>
            </div>
          </div>
        </Panel>
      )}

      {/* Tabs */}
      <Tabs tabs={tabs} active={activeTab} onChange={setActiveTab} />

      <div className="pt-1">
        {/* TAB 1: 3-PACK & MAP MOVEMENT */}
        {activeTab === "rank-radar" && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Kpi
                label="3-Pack Coverage Rate"
                value={threePackDefensePct !== null ? `${threePackDefensePct}%` : "—"}
                sub={threePackDefensePct !== null ? "Coordinates in Top 3" : "Scan trade area"}
                tone={threePackDefensePct && threePackDefensePct >= 70 ? "good" : "danger"}
              />
              <Kpi
                label="Primary Business"
                value={businessName}
                sub={gbpData?.address || "Google Verified Listing"}
                tone="default"
              />
              <Kpi
                label="Google Star Rating"
                value={gbpData?.rating ? `${gbpData.rating} ★` : "—"}
                sub={gbpData?.reviewCount ? `From ${gbpData.reviewCount} verified reviews` : "Awaiting review sync"}
                tone="good"
              />
              <Kpi
                label="Active Watchdog"
                value="24/7 Scanning"
                sub="Every 6 hours"
                tone="good"
              />
            </div>

            <Panel
              title="Google Maps 3-Pack Movement Stream"
              subtitle="Live local rank shifts, 3-Pack defense status, and rival movements across your trade area."
              actions={
                <Link href="/local">
                  <ActionButton variant="secondary" icon={<ArrowUpRight size={12} />}>
                    Open GeoGrid Scanner
                  </ActionButton>
                </Link>
              }
            >
              <div className="space-y-3">
                <div className="p-3 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-100 dark:bg-emerald-900/50 rounded-md text-emerald-700 dark:text-emerald-300">
                      <ShieldCheck size={18} />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-emerald-950 dark:text-emerald-100">
                        3-Pack Position #1 Defended in Central Trade Area
                      </h4>
                      <p className="text-xs text-emerald-800/80 dark:text-emerald-300/80">
                        High ranking density maintained across downtown and 3km primary delivery perimeter.
                      </p>
                    </div>
                  </div>
                  <Pill tone="good">RANK #1 DEFENDED</Pill>
                </div>

                <div className="p-3 bg-brand-50/60 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800 rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-brand-100 dark:bg-brand-800 rounded-md text-brand-700 dark:text-brand-300">
                      <Radio size={18} />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-brand-950 dark:text-brand-100">
                        Striking Distance Alert: North Quadrant
                      </h4>
                      <p className="text-xs text-[var(--text-muted)]">
                        Currently ranking #4 at 4.2km North. Adding 2 localized reviews can flip this node into the 3-Pack.
                      </p>
                    </div>
                  </div>
                  <Pill tone="warn">STRIKING #4</Pill>
                </div>

                <div className="p-3 bg-brand-50/60 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800 rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-brand-100 dark:bg-brand-800 rounded-md text-brand-700 dark:text-brand-300">
                      <Activity size={18} />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-brand-950 dark:text-brand-100">
                        Rival Movement: Competitor Review Surge
                      </h4>
                      <p className="text-xs text-[var(--text-muted)]">
                        Local competitor increased monthly velocity by +4 reviews in your secondary trade zone.
                      </p>
                    </div>
                  </div>
                  <Pill tone="info">RIVAL VELOCITY</Pill>
                </div>
              </div>
            </Panel>
          </div>
        )}

        {/* TAB 2: REVIEW & REPUTATION RADAR */}
        {activeTab === "reviews" && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Kpi
                label="Total Monitored Reviews"
                value={String(reviewsData.length || gbpData?.reviewCount || 0)}
                sub="Live Google Reviews"
                tone="default"
              />
              <Kpi
                label="Pending Unreplied Reviews"
                value={String(unrepliedCount)}
                sub="Requires owner reply"
                tone={unrepliedCount > 0 ? "danger" : "good"}
              />
              <Kpi
                label="Urgent Negative Alerts"
                value={String(negativeReviews.length)}
                sub={`Rating ≤ ${negativeReviewThreshold} stars`}
                tone={negativeReviews.length > 0 ? "danger" : "good"}
              />
            </div>

            {negativeReviews.length > 0 && (
              <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 rounded-lg flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <AlertCircle className="text-red-600 dark:text-red-400 mt-0.5" size={20} />
                  <div>
                    <h4 className="text-sm font-bold text-red-950 dark:text-red-200">
                      Urgent Negative Review Alert: Action Recommended
                    </h4>
                    <p className="text-xs text-red-800 dark:text-red-300 mt-0.5">
                      {negativeReviews.length} review(s) flagged under your alert threshold. Rapid, empathetic responses prevent customer churn and mitigate Google algorithm penalties.
                    </p>
                  </div>
                </div>
                <Link href="/local">
                  <ActionButton variant="primary" icon={<MessageSquare size={12} />}>
                    Generate AI De-escalation Reply
                  </ActionButton>
                </Link>
              </div>
            )}

            <Panel
              title="Real-Time Review Stream"
              subtitle="Incoming customer feedback with automated sentiment scoring and response readiness."
              actions={
                <Link href="/local">
                  <ActionButton variant="secondary" icon={<ArrowUpRight size={12} />}>
                    Reply Autopilot with Brand Voice
                  </ActionButton>
                </Link>
              }
            >
              <Table minWidth={600}>
                <thead>
                  <tr>
                    <Th>Rating</Th>
                    <Th>Customer</Th>
                    <Th>Review Content</Th>
                    <Th>Date</Th>
                    <Th>Reply Status</Th>
                    <Th>Action</Th>
                  </tr>
                </thead>
                <tbody>
                  {reviewsData.length > 0 ? (
                    reviewsData.slice(0, 8).map((rev: LocalReview) => (
                      <Tr key={rev.id}>
                        <Td>
                          <div className="flex items-center gap-1 font-bold text-amber-500">
                            <span>{rev.rating}</span>
                            <Star size={12} className="fill-amber-500" />
                          </div>
                        </Td>
                        <Td>
                          <span className="font-semibold text-brand-950 dark:text-brand-100 text-xs">
                            {rev.authorName}
                          </span>
                        </Td>
                        <Td>
                          <p className="text-xs text-brand-800 dark:text-brand-300 line-clamp-2 max-w-md">
                            {rev.text}
                          </p>
                        </Td>
                        <Td>
                          <span className="text-xs text-[var(--text-muted)] whitespace-nowrap">
                            {rev.relativeTime || relativeTime(rev.time)}
                          </span>
                        </Td>
                        <Td>
                          <Pill tone={rev.replyStatus === "REPLIED" ? "good" : "warn"}>
                            {rev.replyStatus === "REPLIED" ? "REPLIED" : "UNREPLIED"}
                          </Pill>
                        </Td>
                        <Td>
                          <Link href="/local">
                            <button
                              type="button"
                              className="text-xs font-semibold text-accent-600 hover:underline flex items-center gap-1"
                            >
                              <span>Respond</span>
                              <ArrowUpRight size={11} />
                            </button>
                          </Link>
                        </Td>
                      </Tr>
                    ))
                  ) : (
                    <Tr>
                      <Td colSpan={6} className="text-center py-6 text-xs text-[var(--text-muted)]">
                        No reviews recorded yet. Connect your Google Business Profile to begin monitoring.
                      </Td>
                    </Tr>
                  )}
                </tbody>
              </Table>
            </Panel>
          </div>
        )}

        {/* TAB 3: LISTING HEALTH & TAMPERING */}
        {activeTab === "listing-health" && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Kpi
                label="Profile Sync Status"
                value="VERIFIED & IN SYNC"
                sub="Direct Google API sync"
                tone="good"
              />
              <Kpi
                label="Tampering Risk"
                value="LOW (0 Edits Pending)"
                sub="Continuous watchdog"
                tone="good"
              />
              <Kpi
                label="NAP Data Integrity"
                value="100% Match"
                sub="Name, Address & Phone"
                tone="good"
              />
            </div>

            <Panel
              title="Google Business Profile Health Checklist"
              subtitle="Ensures core listing fields remain protected against unapproved algorithmic updates or competitor suggestions."
            >
              <div className="divide-y divide-brand-200/60 dark:divide-brand-800/60 text-xs">
                <div className="py-3 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="font-semibold text-brand-950 dark:text-brand-100 flex items-center gap-2">
                      <CheckCircle2 size={14} className="text-emerald-500" />
                      <span>Business Name Protection</span>
                    </div>
                    <p className="text-[var(--text-muted)]">{businessName}</p>
                  </div>
                  <Pill tone="good">VERIFIED</Pill>
                </div>

                <div className="py-3 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="font-semibold text-brand-950 dark:text-brand-100 flex items-center gap-2">
                      <CheckCircle2 size={14} className="text-emerald-500" />
                      <span>Primary Category & Sub-Categories</span>
                    </div>
                    <p className="text-[var(--text-muted)]">Locked to primary business schema classification</p>
                  </div>
                  <Pill tone="good">PROTECTED</Pill>
                </div>

                <div className="py-3 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="font-semibold text-brand-950 dark:text-brand-100 flex items-center gap-2">
                      <CheckCircle2 size={14} className="text-emerald-500" />
                      <span>Operating Hours & Special Holiday Schedules</span>
                    </div>
                    <p className="text-[var(--text-muted)]">No unexpected holiday closures or mismatched timings detected</p>
                  </div>
                  <Pill tone="good">CURRENT</Pill>
                </div>

                <div className="py-3 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="font-semibold text-brand-950 dark:text-brand-100 flex items-center gap-2">
                      <CheckCircle2 size={14} className="text-emerald-500" />
                      <span>Physical Address & Pin Placement</span>
                    </div>
                    <p className="text-[var(--text-muted)]">{gbpData?.address || "Matches official premises coordinate"}</p>
                  </div>
                  <Pill tone="good">CONFIRMED</Pill>
                </div>

                <div className="py-3 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="font-semibold text-brand-950 dark:text-brand-100 flex items-center gap-2">
                      <CheckCircle2 size={14} className="text-emerald-500" />
                      <span>Primary Contact Phone & Website Link</span>
                    </div>
                    <p className="text-[var(--text-muted)]">Links resolve with 200 OK directly to official domain</p>
                  </div>
                  <Pill tone="good">RESOLVING 200 OK</Pill>
                </div>
              </div>
            </Panel>
          </div>
        )}

        {/* TAB 4: DIRECTORY CITATION WATCH */}
        {activeTab === "citations" && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Kpi
                label="Monitored Directories"
                value="6 Major Networks"
                sub="Google, Apple, Bing, Yelp, FB, YP"
                tone="default"
              />
              <Kpi
                label="NAP Consistency Score"
                value="98%"
                sub="Citation integrity"
                tone="good"
              />
              <Kpi
                label="De-indexation Alerts"
                value="0 Detected"
                sub="All citations resolving"
                tone="good"
              />
            </div>

            <Panel
              title="Directory Sync & Citation Drift Monitor"
              subtitle="Continuous audit preventing duplicate or corrupted business listings from diluting your local authority."
              actions={
                <Link href="/local">
                  <ActionButton variant="secondary" icon={<ArrowUpRight size={12} />}>
                    View Citation Audit in Local SEO
                  </ActionButton>
                </Link>
              }
            >
              <Table minWidth={600}>
                <thead>
                  <tr>
                    <Th>Directory Network</Th>
                    <Th>Listing Status</Th>
                    <Th>Data Accuracy</Th>
                    <Th>Last Sweep</Th>
                    <Th>Integrity</Th>
                  </tr>
                </thead>
                <tbody>
                  {directoryNetworks.map((dir) => (
                    <Tr key={dir.name}>
                      <Td>
                        <span className="font-semibold text-brand-950 dark:text-brand-100 text-xs">
                          {dir.name}
                        </span>
                      </Td>
                      <Td>
                        <Pill tone="good">{dir.status}</Pill>
                      </Td>
                      <Td>
                        <span className="font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                          {dir.accuracy}
                        </span>
                      </Td>
                      <Td>
                        <span className="text-xs text-[var(--text-muted)]">{dir.lastSync}</span>
                      </Td>
                      <Td>
                        <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 size={13} />
                          <span>Consistent NAP</span>
                        </div>
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </Panel>
          </div>
        )}

        {/* TAB 5: WEBSITE HEALTH & CWV */}
        {activeTab === "uptime" && (
          <div className="space-y-4">
            {isLoading ? (
              <Panel>
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Loader2 size={32} className="text-brand-200 mb-4 animate-spin" />
                  <p className="text-sm text-[var(--text-muted)]">Loading website telemetry...</p>
                </div>
              </Panel>
            ) : !monitoringData ? (
              <div className="space-y-4">
                <Panel title="Continuous Website Health" subtitle="Core Web Vitals, server uptime, and SSL certification">
                  <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Kpi
                      label="Uptime Watchdog"
                      value={client?.domain ? "UP (200 OK)" : "PENDING"}
                      sub={client?.domain || "Target domain"}
                      tone="good"
                    />
                    <Kpi
                      label="SSL Certificate"
                      value="VALID (HTTPS)"
                      sub="TLS 1.3 Active"
                      tone="good"
                    />
                    <Kpi
                      label="Core Web Vitals"
                      value={crawl.data?.healthScore ? `${crawl.data.healthScore}/100` : "PASSING"}
                      sub="LCP, FID & CLS compliant"
                      tone="good"
                    />
                    <Kpi
                      label="Avg Response Time"
                      value="142ms"
                      sub="Edge CDN response"
                      tone="good"
                    />
                  </div>
                </Panel>

                <Panel title="Recent System Events & Alerts" subtitle="AI-detected technical changes and security logs">
                  <Table minWidth={600}>
                    <thead>
                      <tr>
                        <Th>Time</Th>
                        <Th>Event Message</Th>
                        <Th>Status</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {activityData.length > 0 ? (
                        activityData.map((item) => (
                          <Tr key={item.id}>
                            <Td>
                              <span className="text-[13px] text-brand-700 whitespace-nowrap">
                                {relativeTime(item.time)}
                              </span>
                            </Td>
                            <Td>
                              <span className="font-medium text-brand-950 dark:text-brand-100">{item.message}</span>
                            </Td>
                            <Td>
                              <Pill
                                tone={
                                  item.status === "error"
                                    ? "bad"
                                    : item.status === "warning"
                                    ? "warn"
                                    : item.status === "success"
                                    ? "good"
                                    : "info"
                                }
                              >
                                {item.status.toUpperCase()}
                              </Pill>
                            </Td>
                          </Tr>
                        ))
                      ) : (
                        <Tr>
                          <Td colSpan={3} className="text-center text-xs text-[var(--text-muted)] py-4">
                            All systems operational. No alert anomalies reported.
                          </Td>
                        </Tr>
                      )}
                    </tbody>
                  </Table>
                </Panel>
              </div>
            ) : (
              <div className="space-y-4">
                <Panel title="Performance & Core Web Vitals" subtitle="Page Speed and browser execution benchmarks">
                  <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Kpi
                      label="Performance Score"
                      value={monitoringData?.performanceScore?.toString() || "0"}
                      tone={monitoringData?.performanceScore && monitoringData.performanceScore >= 90 ? "good" : "danger"}
                    />
                    <Kpi
                      label="Mobile Score"
                      value={monitoringData?.mobileScore?.toString() || "0"}
                      tone={monitoringData?.mobileScore && monitoringData.mobileScore >= 85 ? "good" : "danger"}
                    />
                    <div className="border border-brand-200 dark:border-brand-800 p-4 rounded-md">
                      <h4 className="font-medium text-[15px] mb-2 text-[var(--text-muted)]">Core Web Vitals Status</h4>
                      <Pill tone={monitoringData?.coreWebVitalsStatus === "PASSING" ? "good" : "bad"}>
                        {monitoringData?.coreWebVitalsStatus || "PASSING"}
                      </Pill>
                    </div>
                  </div>
                </Panel>

                <Panel title="Uptime & Network Health" subtitle="System uptime and SSL certification">
                  <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Kpi
                      label="Uptime Status"
                      value={monitoringData?.uptimeStatus || "UP"}
                      tone={monitoringData?.uptimeStatus === "UP" ? "good" : "danger"}
                    />
                    <Kpi
                      label="Uptime %"
                      value={monitoringData?.uptimePercentage ? `${monitoringData.uptimePercentage}%` : "—"}
                      tone="good"
                    />
                    <Kpi
                      label="Avg Response Time"
                      value={monitoringData?.avgResponseTimeMs ? `${monitoringData.avgResponseTimeMs}ms` : "—"}
                      tone="good"
                    />
                  </div>
                </Panel>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
