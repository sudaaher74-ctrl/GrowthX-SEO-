"use client";
import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertCircle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ExternalLink,
  Globe,
  HeartPulse,
  HelpCircle,
  Layers,
  MapPin,
  PlugZap,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  TrendingUp,
  Users,
  Zap,
  Crosshair,
  Share2,
  Flame,
  Navigation,
} from "lucide-react";
import {
  ActionButton,
  PageHeader,
  Panel,
  Pill,
  relativeTime,
} from "@/components/ui/console";
import {
  useWorkspace,
  usePortfolio,
  useVisibility,
  useExecutiveSummary,
  useLatestCrawl,
  useCrawlIssues,
  useLocalSeo,
  useMonitoring,
  useStartCrawl,
} from "@/hooks/use-growthx";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import {
  TruthfulKpiCard,
  MetricBadge,
  TruthfulState,
  NotConnectedState,
  NotConfiguredState,
  NoDataState,
  LoadingState,
} from "@/components/ui/truthful-state";

export default function UnifiedDashboardPage() {
  const { orgId, projectId, projects } = useWorkspace();
  const portfolio = usePortfolio(orgId);
  const project = projects.find((p) => p.id === projectId) ?? projects[0] ?? null;
  const client = portfolio.data?.clients.find((c) => c.projectId === projectId) ?? portfolio.data?.clients[0] ?? null;

  const crawl = useLatestCrawl(client?.domain ?? null);
  const issues = useCrawlIssues(crawl.data?.id ?? null);
  const startCrawlMutation = useStartCrawl();
  const visibility = useVisibility(projectId);
  const executive = useExecutiveSummary(projectId);
  const localSeo = useLocalSeo(projectId);
  const monitoring = useMonitoring(projectId);

  const opportunities = useQuery({
    queryKey: ["opportunities", projectId],
    queryFn: () => api.opportunities(projectId!),
    enabled: !!projectId,
  });

  const trackedCompetitors = useQuery({
    queryKey: ["tracked-competitors", projectId],
    queryFn: () => api.listCompetitors(projectId!),
    enabled: !!projectId,
  });

  // Health Score computation (0-100 or null if no crawl)
  const crawlCompleted = crawl.data && crawl.data.status === "COMPLETED";
  const healthScore = crawlCompleted ? (crawl.data?.healthScore ?? client?.health ?? null) : null;
  const criticalCount = issues.data?.meta?.countsBySeverity?.critical ?? (issues.data as any)?.criticalCount ?? 0;
  const highCount = issues.data?.meta?.countsBySeverity?.high ?? (issues.data as any)?.highCount ?? 0;
  const uniqueIssuesCount = issues.data?.meta?.uniqueOpenIssues ?? issues.data?.meta?.total ?? 0;

  // Fix next queue: sort worst issues first (Critical -> High -> Medium -> Low)
  const severityRank: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
  const fixNextIssues = [...(issues.data?.data ?? [])]
    .sort((a, b) => (severityRank[a.severity] ?? 9) - (severityRank[b.severity] ?? 9))
    .slice(0, 5);

  const topOpportunities = (opportunities.data?.opportunities ?? []).slice(0, 4);

  // Setup Checklist Calculation
  const hasWebsite = Boolean(client?.domain);
  const hasCrawl = Boolean(crawlCompleted);
  const hasGsc = Boolean(executive.data?.connections?.searchConsole);
  const hasGa = Boolean(executive.data?.connections?.analytics);
  const hasGbp = Boolean(executive.data?.connections?.businessProfile || localSeo.data);
  const hasCompetitors = Boolean((trackedCompetitors.data?.length ?? 0) > 0);

  const completedStepsCount = [hasWebsite, hasCrawl, hasGsc, hasGa, hasGbp, hasCompetitors].filter(Boolean).length;
  const setupIncomplete = completedStepsCount < 6;

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <PageHeader
        title={project?.name ?? "Dashboard"}
        subtitle={
          client?.domain ? (
            <span className="flex items-center gap-2">
              <Globe size={13} className="text-brand-400" />
              <span>{client.domain}</span>
              <span className="text-brand-300">·</span>
              <span>
                {crawlCompleted
                  ? `Last crawl ${relativeTime(crawl.data?.finishedAt ?? crawl.data?.startedAt)}`
                  : "No crawl completed yet"}
              </span>
            </span>
          ) : (
            "Select or add a business project to view unified SEO performance."
          )
        }
        actions={
          <div className="flex items-center gap-2">
            <Link href="/projects">
              <ActionButton variant="secondary" icon={<Plus size={12} />}>
                Add Business
              </ActionButton>
            </Link>
            <ActionButton
              variant="primary"
              icon={startCrawlMutation.isPending ? <RefreshCw size={12} className="animate-spin" /> : <Zap size={12} />}
              disabled={startCrawlMutation.isPending || !client?.domain}
              onClick={() => {
                if (client?.domain) {
                  startCrawlMutation.mutate({
                    domain: client.domain,
                    maxDepth: 10,
                    maxConcurrency: 3,
                    useSitemap: true,
                  });
                }
              }}
            >
              {startCrawlMutation.isPending ? "Auditing..." : "Audit Website"}
            </ActionButton>
          </div>
        }
      />

      {/* Guided Setup Progress Banner (if project setup is incomplete) */}
      {setupIncomplete && (
        <div
          className="rounded-xl border bg-gradient-to-r from-brand-50 via-white to-brand-50/30 p-4 sm:p-5 shadow-2xs"
          style={{ borderColor: "var(--border-color)" }}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-brand-950 text-white font-bold text-[10px]">
                  {completedStepsCount}/6
                </span>
                <h3 className="text-[14px] font-semibold text-brand-950">Setup Checklist in Progress</h3>
              </div>
              <p className="text-[12px] text-brand-500 mt-1">
                Complete data connections and initial sweeps to unlock 100% authoritative SEO intelligence.
              </p>
            </div>
            <Link
              href="/integrations"
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-950 px-3.5 py-1.5 text-[12px] font-semibold text-white hover:opacity-90 transition shrink-0"
            >
              Connect Data Sources
              <ArrowRight size={13} />
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 mt-4 pt-3 border-t" style={{ borderColor: "var(--color-brand-100)" }}>
            <ChecklistBadge label="Website Added" completed={hasWebsite} href="/website" />
            <ChecklistBadge label="Crawl Audit" completed={hasCrawl} href="/website" />
            <ChecklistBadge label="Search Console" completed={hasGsc} href="/integrations" />
            <ChecklistBadge label="Analytics (GA4)" completed={hasGa} href="/integrations" />
            <ChecklistBadge label="Google Business" completed={hasGbp} href="/local" />
            <ChecklistBadge label="Competitors" completed={hasCompetitors} href="/competitor-intelligence" />
          </div>
        </div>
      )}

      {/* Row 1: Core Performance Truthful KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Overall Technical Health */}
        <TruthfulKpiCard
          label="Site Health Score"
          value={healthScore != null ? `${healthScore}/100` : null}
          sub={crawlCompleted ? `${crawl.data?.pagesCrawled ?? 0} pages analyzed` : undefined}
          state={healthScore != null ? "MEASURED" : "NOT_CONFIGURED"}
          source="GrowthX Crawler Engine"
          lastUpdated={crawl.data?.finishedAt ? relativeTime(crawl.data.finishedAt) : undefined}
          actionHref="/website"
          actionLabel="Run your first crawl →"
        />

        {/* Organic Search Clicks (GSC) */}
        <TruthfulKpiCard
          label="Organic Search Clicks"
          value={
            executive.data?.headline?.searchClicks?.state === "MEASURED"
              ? executive.data.headline.searchClicks.value.toLocaleString()
              : null
          }
          sub="Organic Google search clicks"
          state={
            executive.data?.headline?.searchClicks?.state === "MEASURED"
              ? "MEASURED"
              : executive.data?.connections?.searchConsole
                ? "UNAVAILABLE"
                : "NOT_CONNECTED"
          }
          source="Google Search Console"
          dateRange="Past 28 Days"
          actionHref="/integrations"
          actionLabel="Connect Search Console →"
          trend={
            executive.data?.headline?.searchClicks?.state === "MEASURED" &&
            executive.data.headline.searchClicks.changePct != null
              ? { delta: executive.data.headline.searchClicks.changePct, positiveIsGood: true }
              : undefined
          }
        />

        {/* AI Visibility / Citation Share */}
        <TruthfulKpiCard
          label="AI Citation Share"
          value={
            client?.aiCitationSharePct != null
              ? `${client.aiCitationSharePct}%`
              : visibility.data?.summary?.citationSharePct != null
                ? `${visibility.data.summary.citationSharePct}%`
                : null
          }
          sub="Mentions across LLM engines"
          state={
            client?.aiCitationSharePct != null || visibility.data?.summary != null
              ? "MEASURED"
              : "NOT_CONFIGURED"
          }
          source="AI Engine Sweep"
          dateRange="Recent 7 Days"
          actionHref="/ai-visibility"
          actionLabel="Run a visibility sweep →"
        />

        {/* Local SEO Reputation */}
        <TruthfulKpiCard
          label="Local Rating & Reviews"
          value={
            localSeo.data && localSeo.data.reviewCount > 0
              ? `${localSeo.data.rating.toFixed(1)} ★ (${localSeo.data.reviewCount})`
              : localSeo.data
                ? "No reviews yet"
                : null
          }
          sub={localSeo.data?.businessName || "Google Business Profile"}
          state={localSeo.data ? "MEASURED" : "NOT_CONNECTED"}
          source="Google Places & GBP"
          lastUpdated={localSeo.data?.updatedAt ? relativeTime(localSeo.data.updatedAt) : undefined}
          actionHref="/local"
          actionLabel="Connect Google Business Profile →"
        />
      </div>

      {/* Row 2: Deep Dives (Site Health Breakdown & Organic Traffic Trends) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Technical SEO Audit Snapshot */}
        <Panel
          title="Technical SEO Health"
          subtitle="Deduplicated crawl findings categorized by severity"
          actions={
            <Link href="/website" className="text-[11.5px] font-semibold text-accent-700 hover:underline">
              View full audit →
            </Link>
          }
        >
          <div className="p-5">
            {crawl.isLoading ? (
              <LoadingState title="Analyzing Site Health..." message="Reading crawl issues" compact />
            ) : !crawlCompleted ? (
              <TruthfulState
                icon={Globe}
                title="Audit Not Run Yet"
                missing="No completed crawl data found for this domain."
                whyItMatters="Technical flaws like redirect loops, 404s, thin content, and missing schema suppress rankings."
                actionRequired="Launch the crawler to calculate site health."
                action={{
                  label: "Run Site Crawl",
                  onClick: () => {
                    if (client?.domain) {
                      startCrawlMutation.mutate({
                        domain: client.domain,
                        maxDepth: 10,
                        maxConcurrency: 3,
                        useSitemap: true,
                      });
                    }
                  },
                }}
                compact
              />
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[28px] font-bold tracking-tight text-brand-950 font-mono">
                      {healthScore != null ? healthScore : "—"}
                    </span>
                    <span className="text-[12px] text-brand-400 ml-1.5 font-mono">/ 100</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[12px] font-semibold text-brand-950">
                      {uniqueIssuesCount} Unique Issues
                    </span>
                    <p className="text-[10.5px] text-brand-400">
                      {issues.data?.meta?.totalFindings ?? uniqueIssuesCount} total findings
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-2 text-center pt-2 border-t" style={{ borderColor: "var(--color-brand-100)" }}>
                  <div className="rounded-lg bg-rose-50/60 p-2 border border-rose-100">
                    <span className="block text-[15px] font-bold text-rose-700 font-mono">{criticalCount}</span>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-rose-600">Critical</span>
                  </div>
                  <div className="rounded-lg bg-amber-50/60 p-2 border border-amber-100">
                    <span className="block text-[15px] font-bold text-amber-700 font-mono">{highCount}</span>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-600">High</span>
                  </div>
                  <div className="rounded-lg bg-blue-50/60 p-2 border border-blue-100">
                    <span className="block text-[15px] font-bold text-blue-700 font-mono">
                      {issues.data?.meta?.countsBySeverity?.medium ?? 0}
                    </span>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-blue-600">Medium</span>
                  </div>
                  <div className="rounded-lg bg-brand-50 p-2 border border-brand-200">
                    <span className="block text-[15px] font-bold text-brand-700 font-mono">
                      {issues.data?.meta?.countsBySeverity?.low ?? 0}
                    </span>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-brand-600">Low</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </Panel>

        {/* Organic Search Performance (GSC + GA4) */}
        <Panel
          title="Organic Search & Traffic"
          subtitle="Direct performance metrics from Google Search & Analytics"
          actions={
            <Link href="/search-performance" className="text-[11.5px] font-semibold text-accent-700 hover:underline">
              Open Search Performance →
            </Link>
          }
          className="lg:col-span-2"
        >
          <div className="p-5">
            {!executive.data?.connections?.searchConsole && !executive.data?.connections?.analytics ? (
              <NotConnectedState
                title="Connect Search Console & Analytics"
                missing="Neither Google Search Console nor GA4 is currently linked to this project."
                whyItMatters="Without Google connection, search clicks, impressions, landing pages, and traffic trends cannot be measured."
                actionRequired="Authorize Google in Integrations."
                action={{ label: "Connect Search Console", href: "/integrations" }}
                secondaryAction={{ label: "Connect Analytics", href: "/integrations" }}
                compact
              />
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  <div className="p-3 rounded-lg border bg-brand-50/20" style={{ borderColor: "var(--border-color)" }}>
                    <span className="text-[10.5px] font-semibold text-brand-400 uppercase tracking-wider">Search Clicks</span>
                    <p className="text-[20px] font-bold text-brand-950 font-mono mt-1">
                      {executive.data?.headline?.searchClicks?.state === "MEASURED"
                        ? executive.data.headline.searchClicks.value.toLocaleString()
                        : "—"}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg border bg-brand-50/20" style={{ borderColor: "var(--border-color)" }}>
                    <span className="text-[10.5px] font-semibold text-brand-400 uppercase tracking-wider">Impressions</span>
                    <p className="text-[20px] font-bold text-brand-950 font-mono mt-1">
                      {executive.data?.headline?.impressions?.state === "MEASURED"
                        ? executive.data.headline.impressions.value.toLocaleString()
                        : "—"}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg border bg-brand-50/20" style={{ borderColor: "var(--border-color)" }}>
                    <span className="text-[10.5px] font-semibold text-brand-400 uppercase tracking-wider">GA4 Sessions</span>
                    <p className="text-[20px] font-bold text-brand-950 font-mono mt-1">
                      {executive.data?.headline?.sessions?.state === "MEASURED"
                        ? executive.data.headline.sessions.value.toLocaleString()
                        : "—"}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg border bg-brand-50/20" style={{ borderColor: "var(--border-color)" }}>
                    <span className="text-[10.5px] font-semibold text-brand-400 uppercase tracking-wider">Conversions</span>
                    <p className="text-[20px] font-bold text-brand-950 font-mono mt-1">
                      {executive.data?.headline?.conversions?.state === "MEASURED"
                        ? executive.data.headline.conversions.value.toLocaleString()
                        : "—"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-brand-400 font-mono pt-2">
                  <span>Source: Google Search Console + GA4 APIs</span>
                  <span>Range: Last 28 Days</span>
                </div>
              </div>
            )}
          </div>
        </Panel>
      </div>

      {/* Row 3: Action Queue (Prioritize & Take Action) & Opportunities */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Priority Technical Fixes */}
        <Panel
          title="Priority Action Queue"
          subtitle="Fix highest-severity issues first to recover search rank"
          actions={
            <Link href="/website" className="text-[11.5px] font-semibold text-accent-700 hover:underline">
              See all {uniqueIssuesCount} issues →
            </Link>
          }
        >
          <div className="p-0">
            {fixNextIssues.length === 0 ? (
              <div className="p-8 text-center text-[12px] text-brand-400">
                {crawlCompleted ? "No high-priority issues detected! Site is clean." : "Run your first crawl to detect issues."}
              </div>
            ) : (
              <div className="divide-y" style={{ borderColor: "var(--color-brand-100)" }}>
                {fixNextIssues.map((issue) => (
                  <div key={issue.id} className="p-3.5 flex items-start justify-between gap-3 hover:bg-brand-50/40 transition">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <SeverityBadge severity={issue.severity} />
                        <span className="text-[12px] font-semibold text-brand-950 truncate">
                          {issue.issueType.replace(/_/g, " ")}
                        </span>
                      </div>
                      <p className="text-[11.5px] text-brand-500 font-mono truncate max-w-md">
                        {issue.affectedUrl}
                      </p>
                    </div>
                    <Link
                      href="/website"
                      className="shrink-0 text-[11px] font-semibold text-brand-700 hover:text-brand-950 border rounded px-2 py-1 bg-white hover:bg-brand-50 transition"
                    >
                      View Fix
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Panel>

        {/* High-Impact Content & Growth Opportunities */}
        <Panel
          title="Content & Keyword Opportunities"
          subtitle="Algorithmically identified ranking & CTR growth gaps"
          actions={
            <Link href="/content-opportunities" className="text-[11.5px] font-semibold text-accent-700 hover:underline">
              Open Opportunities →
            </Link>
          }
        >
          <div className="p-0">
            {topOpportunities.length === 0 ? (
              <div className="p-8 text-center text-[12px] text-brand-400">
                No growth opportunities generated yet. Connect data sources and run an analysis to generate briefs.
              </div>
            ) : (
              <div className="divide-y" style={{ borderColor: "var(--color-brand-100)" }}>
                {topOpportunities.map((op) => (
                  <div key={op.id} className="p-3.5 flex items-start justify-between gap-3 hover:bg-brand-50/40 transition">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-brand-100 text-brand-700">
                          {op.category}
                        </span>
                        <span className="text-[12px] font-semibold text-brand-950 truncate">
                          {op.title}
                        </span>
                      </div>
                      <p className="text-[11.5px] text-brand-500 line-clamp-1">
                        {op.recommendedAction || op.summary}
                      </p>
                    </div>
                    <Link
                      href="/content-opportunities"
                      className="shrink-0 text-[11px] font-semibold text-accent-700 hover:text-accent-900 border border-accent-200 rounded px-2.5 py-1 bg-accent-50/50 hover:bg-accent-100 transition"
                    >
                      Take Action
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Panel>
      </div>

      {/* Row 4: Multi-Pillar Command Center (Competitors, Local 3-Pack, Social, 30-Day Plan) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Pillar 1: Competitor Intelligence Battlecard */}
        <div className="rounded-xl border bg-white dark:bg-brand-950 p-4 shadow-2xs flex flex-col justify-between" style={{ borderColor: "var(--border-color)" }}>
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[12px] font-semibold text-brand-950 dark:text-brand-100 flex items-center gap-1.5">
                <Crosshair size={14} className="text-accent-600 dark:text-accent-400" />
                Competitor Intelligence
              </span>
              <Pill tone="info">{trackedCompetitors.data?.length ?? 0} Rivals</Pill>
            </div>
            <p className="text-[11.5px] text-brand-600 dark:text-brand-400 mb-3">
              {trackedCompetitors.data?.[0]?.domain
                ? `Benchmarked against ${trackedCompetitors.data[0].domain}`
                : "Identify and track search competitors."}
            </p>
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[var(--text-muted)]">Content Gap:</span>
                <span className="font-semibold text-brand-900 dark:text-brand-200">Active Analysis</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[var(--text-muted)]">Keyword Matrix:</span>
                <span className="font-semibold text-brand-900 dark:text-brand-200">Side-by-Side</span>
              </div>
            </div>
          </div>
          <div className="pt-3 border-t border-brand-100 dark:border-brand-900 mt-3">
            <Link
              href="/competitor-intelligence"
              className="text-[11.5px] font-semibold text-accent-700 dark:text-accent-400 hover:underline flex items-center gap-1"
            >
              <span>View Benchmark & Gaps</span>
              <ArrowRight size={11} />
            </Link>
          </div>
        </div>

        {/* Pillar 2: Google 3-Pack & Local SEO Radar */}
        <div className="rounded-xl border bg-white dark:bg-brand-950 p-4 shadow-2xs flex flex-col justify-between" style={{ borderColor: "var(--border-color)" }}>
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[12px] font-semibold text-brand-950 dark:text-brand-100 flex items-center gap-1.5">
                <Navigation size={14} className="text-emerald-600 dark:text-emerald-400" />
                Google 3-Pack Radar
              </span>
              <Pill tone={localSeo.data ? "good" : "default"}>
                {localSeo.data ? "24/7 ACTIVE" : "DISCONNECTED"}
              </Pill>
            </div>
            <p className="text-[11.5px] text-brand-600 dark:text-brand-400 mb-3 truncate">
              {localSeo.data?.businessName || "Connect Google Business Profile"}
            </p>
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[var(--text-muted)]">Google Rating:</span>
                <span className="font-semibold text-amber-500 font-mono">
                  {localSeo.data?.rating ? `${localSeo.data.rating.toFixed(1)} ★` : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[var(--text-muted)]">Verified Reviews:</span>
                <span className="font-semibold text-brand-900 dark:text-brand-200 font-mono">
                  {localSeo.data?.reviewCount ?? 0}
                </span>
              </div>
            </div>
          </div>
          <div className="pt-3 border-t border-brand-100 dark:border-brand-900 mt-3">
            <Link
              href="/monitoring"
              className="text-[11.5px] font-semibold text-accent-700 dark:text-accent-400 hover:underline flex items-center gap-1"
            >
              <span>Open 3-Pack Watchdog</span>
              <ArrowRight size={11} />
            </Link>
          </div>
        </div>

        {/* Pillar 3: Social & Video Intelligence */}
        <div className="rounded-xl border bg-white dark:bg-brand-950 p-4 shadow-2xs flex flex-col justify-between" style={{ borderColor: "var(--border-color)" }}>
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[12px] font-semibold text-brand-950 dark:text-brand-100 flex items-center gap-1.5">
                <Share2 size={14} className="text-pink-600 dark:text-pink-400" />
                Social & Video Radar
              </span>
              <Pill tone="info">Instagram & YT</Pill>
            </div>
            <p className="text-[11.5px] text-brand-600 dark:text-brand-400 mb-3">
              Reverse-engineer viral competitor Reels and YouTube Shorts.
            </p>
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[var(--text-muted)]">Viral Breakouts:</span>
                <span className="font-semibold text-pink-600 dark:text-pink-400">100K+ View Spy</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[var(--text-muted)]">Creator Network:</span>
                <span className="font-semibold text-brand-900 dark:text-brand-200">Talk With Us</span>
              </div>
            </div>
          </div>
          <div className="pt-3 border-t border-brand-100 dark:border-brand-900 mt-3">
            <Link
              href="/social-media"
              className="text-[11.5px] font-semibold text-accent-700 dark:text-accent-400 hover:underline flex items-center gap-1"
            >
              <span>Explore Social Suite</span>
              <ArrowRight size={11} />
            </Link>
          </div>
        </div>

        {/* Pillar 4: 30-Day Improvement Plan Roadmap */}
        <div className="rounded-xl border bg-white dark:bg-brand-950 p-4 shadow-2xs flex flex-col justify-between" style={{ borderColor: "var(--border-color)" }}>
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[12px] font-semibold text-brand-950 dark:text-brand-100 flex items-center gap-1.5">
                <TrendingUp size={14} className="text-purple-600 dark:text-purple-400" />
                30-Day Action Roadmap
              </span>
              <Pill tone="good">ACTIVE PLAN</Pill>
            </div>
            <p className="text-[11.5px] text-brand-600 dark:text-brand-400 mb-3">
              Actionable to-do list derived across benchmark, gap, and keyword data.
            </p>
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[var(--text-muted)]">Strategy Objective:</span>
                <span className="font-semibold text-brand-900 dark:text-brand-200">Overtake Competitor</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[var(--text-muted)]">Execution Cadence:</span>
                <span className="font-semibold text-purple-600 dark:text-purple-400">Weekly Milestones</span>
              </div>
            </div>
          </div>
          <div className="pt-3 border-t border-brand-100 dark:border-brand-900 mt-3">
            <Link
              href="/competitor-intelligence?tab=plan"
              className="text-[11.5px] font-semibold text-accent-700 dark:text-accent-400 hover:underline flex items-center gap-1"
            >
              <span>Open 30-Day Roadmap</span>
              <ArrowRight size={11} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function ChecklistBadge({
  label,
  completed,
  href,
}: {
  label: string;
  completed: boolean;
  href: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-1.5 p-2 rounded-lg border text-[11px] font-medium transition",
        completed
          ? "bg-emerald-50/60 border-emerald-200 text-emerald-800"
          : "bg-white border-brand-200 text-brand-600 hover:border-brand-400"
      )}
    >
      <span
        className={cn(
          "h-2 w-2 rounded-full shrink-0",
          completed ? "bg-emerald-500" : "bg-brand-300"
        )}
      />
      <span className="truncate">{label}</span>
    </Link>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  switch (severity?.toUpperCase()) {
    case "CRITICAL":
      return (
        <span className="rounded px-1.5 py-0.5 text-[9.5px] font-bold bg-rose-100 text-rose-800 uppercase">
          Critical
        </span>
      );
    case "HIGH":
      return (
        <span className="rounded px-1.5 py-0.5 text-[9.5px] font-bold bg-amber-100 text-amber-800 uppercase">
          High
        </span>
      );
    case "MEDIUM":
      return (
        <span className="rounded px-1.5 py-0.5 text-[9.5px] font-semibold bg-blue-100 text-blue-800 uppercase">
          Medium
        </span>
      );
    case "LOW":
    default:
      return (
        <span className="rounded px-1.5 py-0.5 text-[9.5px] font-semibold bg-brand-100 text-brand-700 uppercase">
          Low
        </span>
      );
  }
}
