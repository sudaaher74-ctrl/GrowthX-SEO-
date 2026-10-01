"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  Check,
  Globe,
  Layers,
  Plus,
  PlugZap,
  RefreshCw,
  Sparkles,
  Star,
} from "lucide-react";
import { StatusNote, relativeTime } from "@/components/ui/console";
import {
  useWorkspace,
  usePortfolio,
  useExecutiveSummary,
  useIssueCounts,
  useIssueGroups,
  useLatestCrawl,
  useLocalSeo,
  useStartCrawl,
} from "@/hooks/use-growthx";
import { api, type IssueSeverity } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { SEVERITY_ORDER, SEVERITY_PLAIN } from "@/lib/plain-language";
import { AutopilotStart } from "@/components/autopilot/autopilot-start";
import { Ga4Overview } from "@/components/ga4/ga4-panels";
import { useGa4Report } from "@/hooks/use-ga4-report";
import { Card, CardHead, EmptyPrompt, LoadingLine } from "@/components/dashboard/dashboard-cards";
import { HealthSummary, gradeScore } from "@/components/dashboard/health-summary";
import { ProblemDetail, TodoRow } from "@/components/dashboard/priority-todos";
import {
  DEFAULT_WINDOW_DAYS,
  BigMeasure,
  DailyCandles,
  ChannelShare,
  normalizeTrend,
} from "@/components/dashboard/traffic-charts";
import { ReviewsSummary } from "@/components/dashboard/reviews-summary";

type MetricKey = "searchClicks" | "impressions" | "sessions" | "conversions";

interface SetupStep {
  label: string;
  why: string;
  done: boolean;
  href: string;
  cta: string;
}

/**
 * The first screen a business owner sees. Dark theme trial: the skin comes from
 * `.dash-dark` (see globals.css); this page only composes it.
 *
 * Written for someone who has never heard the words "crawl", "severity" or
 * "impressions". Each section answers one plain question — how is my website
 * doing, what should I fix, are people finding me, what do customers say, what
 * could I do next — and every figure on it is still a real measurement or an
 * honest "not connected yet". The detailed, technical views live one click
 * away on their own pages.
 */
const SEVERITY = SEVERITY_PLAIN;

export default function UnifiedDashboardPage() {
  const { orgId, projectId } = useWorkspace();
  const [metricKey, setMetricKey] = useState<MetricKey>("searchClicks");
  const [severityTab, setSeverityTab] = useState<"ALL" | IssueSeverity>("ALL");
  const [pickedGroup, setPickedGroup] = useState<string | null>(null);
  const portfolio = usePortfolio(orgId);
  const client = portfolio.data?.clients.find((c) => c.projectId === projectId) ?? portfolio.data?.clients[0] ?? null;

  const crawl = useLatestCrawl(client?.domain ?? null);
  const startCrawlMutation = useStartCrawl();
  const executive = useExecutiveSummary(projectId);
  const localSeo = useLocalSeo(projectId);
  // Every issue count on this page comes from here. The card used to read
  // lowercase severity keys the server never sent, so every tile fell back to
  // zero and printed CRITICAL 0 · HIGH 0 above a list of HIGH findings.
  const issueCounts = useIssueCounts(projectId);
  const issueGroups = useIssueGroups(projectId, { limit: 5 });

  const trackedCompetitors = useQuery({
    queryKey: ["tracked-competitors", projectId],
    queryFn: () => api.listCompetitors(projectId!),
    enabled: !!projectId,
  });

  const hasGsc = Boolean(executive.data?.connections?.searchConsole);
  const hasGa = Boolean(executive.data?.connections?.analytics);

  // 28-day daily clicks and visits, for the trend chart under "Visitors from Google".
  const gscSeries = useQuery({
    queryKey: ["gsc-dash-series", projectId],
    queryFn: () => api.gscTimeseries(projectId!, 28),
    enabled: !!projectId && hasGsc,
    retry: false,
  });

  const gaSeries = useQuery({
    queryKey: ["ga4-dash-series", projectId],
    queryFn: () => api.ga4Timeseries(projectId!, 28),
    enabled: !!projectId && hasGa,
    retry: false,
  });

  // The crawl whose figures stand: the latest when it completed, otherwise the
  // last completed one while a recrawl runs. Showing nothing during a recrawl
  // read as "Run your first crawl" for a site audited many times.
  const shownCrawl = crawl.data?.status === "COMPLETED" ? crawl.data : (crawl.data?.lastCompleted ?? null);
  const crawlCompleted = Boolean(shownCrawl);
  const crawlRunning = crawl.data?.status === "RUNNING" || crawl.data?.status === "PENDING";
  const healthScore = shownCrawl ? (shownCrawl.healthScore ?? client?.health ?? null) : null;
  const counts = issueCounts.data ?? null;

  // One row per problem, not per page. Sorted by impact on the server, so the
  // five shown are the five that matter most — not five pages of the same
  // defect crowding out everything else that is wrong.
  const priorityGroups = issueGroups.data?.groups ?? [];
  const reachAvailable = issueGroups.data?.reachAvailable ?? false;
  const totalAffectedPages = priorityGroups.reduce((acc, g) => acc + g.affectedCount, 0);
  const aiReadyCount = priorityGroups.filter((g) => g.aiFixAvailable || g.fixClass === "AUTO").length;

  const hasWebsite = Boolean(client?.domain);
  const hasCompetitors = Boolean((trackedCompetitors.data?.length ?? 0) > 0);
  const hasGbp = Boolean(executive.data?.connections?.businessProfile || localSeo.data);

  const setupSteps: SetupStep[] = [
    {
      label: "Add your website",
      why: "So we know which website to look after.",
      done: hasWebsite,
      href: "/website",
      cta: "Add website",
    },
    {
      label: "Check your website for problems",
      why: "We look through every page and list what is stopping Google from showing it.",
      done: crawlCompleted,
      href: "/website",
      cta: "Check my website",
    },
    {
      label: "Connect Google Search Console",
      why: "Shows how many people find you on Google, and what they searched for.",
      done: hasGsc,
      href: "/integrations",
      cta: "Connect",
    },
    {
      label: "Connect Google Analytics",
      why: "Shows how many people visit your website and what they do there.",
      done: hasGa,
      href: "/integrations",
      cta: "Connect",
    },
    {
      label: "Connect your Google Business Profile",
      why: "Brings your star rating and customer reviews into this page.",
      done: hasGbp,
      href: "/google-business-profile",
      cta: "Connect",
    },
    {
      label: "Add your competitors",
      why: "Lets us show where competitors are ahead of you, and how to catch up.",
      done: hasCompetitors,
      href: "/competitor-intelligence",
      cta: "Add competitors",
    },
  ];
  const setupIncomplete = setupSteps.some((s) => !s.done);

  const runAudit = () => {
    if (!client?.domain) return;
    startCrawlMutation.mutate({
      domain: client.domain,
      maxDepth: 10,
      maxConcurrency: 3,
      useSitemap: true,
    });
  };
  const auditBusy = startCrawlMutation.isPending || crawlRunning;

  // Where visitors come from, from the stored GA4 report. Shown only when the report has channels.
  const ga4 = useGa4Report(projectId);
  const ga4Data = ga4.report.data?.data ?? null;
  const hasChannels = Boolean(ga4Data && !ga4Data.empty && ga4Data.channels.length > 0);

  const headline = executive.data?.headline;
  const metrics: { key: MetricKey; short: string; label: string; hint: string }[] = [
    { key: "searchClicks", short: "Clicks", label: "Clicks from Google", hint: "People who clicked your website in Google search" },
    { key: "impressions", short: "Times seen", label: "Times seen on Google", hint: "How often your website appeared in search results" },
    { key: "sessions", short: "Visits", label: "Website visits", hint: "Visits to your website from anywhere" },
    { key: "conversions", short: "Goals", label: "Goals reached", hint: "Enquiries, sign-ups or sales you track" },
  ];
  const metric = metrics.find((m) => m.key === metricKey) ?? metrics[0];

  const rangeDays = executive.data?.range?.days ? executive.data.range.days : DEFAULT_WINDOW_DAYS;

  const activeSeriesPoints = useMemo(() => {
    if (metricKey === "searchClicks" && gscSeries.data && gscSeries.data.length > 0) {
      return normalizeTrend(
        gscSeries.data.map((p) => ({ date: p.date, value: p.clicks })),
        rangeDays,
      );
    }
    if (metricKey === "impressions" && gscSeries.data && gscSeries.data.length > 0) {
      return normalizeTrend(
        gscSeries.data.map((p) => ({ date: p.date, value: p.impressions })),
        rangeDays,
      );
    }
    if (metricKey === "sessions" && gaSeries.data && gaSeries.data.length > 0) {
      return normalizeTrend(
        gaSeries.data.map((p) => ({ date: p.date, value: p.sessions })),
        rangeDays,
      );
    }
    if (metricKey === "conversions" && gaSeries.data && gaSeries.data.length > 0) {
      return normalizeTrend(
        gaSeries.data.map((p) => ({ date: p.date, value: p.conversions ?? 0 })),
        rangeDays,
      );
    }
    return null;
  }, [metricKey, gscSeries.data, gaSeries.data, rangeDays]);

  // The to-do list: filter by how serious, and show the picked problem beside it.
  const shownGroups = severityTab === "ALL" ? priorityGroups : priorityGroups.filter((g) => g.severity === severityTab);
  const picked = shownGroups.find((g) => g.groupKey === pickedGroup) ?? shownGroups[0] ?? null;
  const groupCount = (sev: IssueSeverity) => priorityGroups.filter((g) => g.severity === sev).length;

  const doneCount = setupSteps.filter((s) => s.done).length;
  const nextStep = setupSteps.find((s) => !s.done);

  return (
    <div className="space-y-3.5 pb-10">
      {/* Jump links */}
      <nav aria-label="On this page" className="inline-flex items-center gap-1 rounded-full bg-brand-50 border border-brand-200/60 p-1 text-[11.5px] font-semibold">
        {[
          ["#health", "Overview"],
          ["#visitors", "Visitors"],
          ["#todo", "To-do list"],
          ["#reviews", "Reviews"],
        ].map(([href, label], i) => (
          <a
            key={href}
            href={href}
            className={cn(
              "rounded-full px-3 py-1.5 transition-colors",
              i === 0 ? "bg-signal-400 text-signal-ink font-bold shadow-xs" : "text-brand-400 hover:text-brand-950",
            )}
          >
            {label}
          </a>
        ))}
      </nav>

      {/* Title */}
      <div className="flex flex-col justify-between gap-3 pt-1 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-[26px] sm:text-[30px] font-bold leading-none tracking-tight text-brand-950">
            Dashboard
          </h1>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] font-medium text-brand-400">
            {client?.domain ? (
              <>
                <Globe size={12} className="text-brand-400" />
                <span>{client.domain}</span>
                <span className="text-brand-300">·</span>
                <span>
                  {crawlCompleted
                    ? `Last checked ${relativeTime(shownCrawl?.finishedAt ?? crawl.data?.startedAt)}`
                    : "Not checked yet"}
                </span>
              </>
            ) : (
              "Add your website to see how it is doing on Google."
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/fix-engine"
            className="inline-flex items-center gap-1.5 rounded-full border border-brand-200/50 bg-brand-50 px-3.5 py-1.5 text-[12px] font-semibold text-brand-950 transition hover:bg-brand-100"
          >
            See my improvement plan
          </Link>
          <button
            type="button"
            onClick={runAudit}
            disabled={auditBusy || !client?.domain}
            className="inline-flex items-center gap-1.5 rounded-full bg-signal-400 px-3.5 py-1.5 text-[12px] font-bold text-signal-ink transition hover:bg-signal-500 disabled:opacity-50 shadow-sm"
          >
            <RefreshCw size={12} className={auditBusy ? "animate-spin" : undefined} />
            {auditBusy ? "Checking…" : "Check my website again"}
          </button>
        </div>
      </div>

      {crawlRunning && (
        <StatusNote>
          We&apos;re checking your website now. This page updates by itself when it&apos;s done
          {crawlCompleted ? " — until then you're seeing the results of the last check." : "."}
        </StatusNote>
      )}

      {/* One step to everything: website in, competitors and full report out. */}
      {(!hasWebsite || (trackedCompetitors.isSuccess && !hasCompetitors)) && (
        <AutopilotStart projectId={projectId} domain={client?.domain ?? null} />
      )}

      {/* Row 1: how is my website doing / are people finding me */}
      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[1.3fr_1fr]">
        <Card id="health" className="flex flex-col justify-between gap-4">
          <CardHead
            title="How healthy is your website?"
            subtitle="A score out of 100 for how easily Google can find, read and show your pages. Higher is better."
            aside={
              healthScore != null && crawlCompleted ? (
                <span
                  className={cn(
                    "rounded-full px-2.5 py-0.5 text-[10.5px] font-bold",
                    gradeScore(healthScore).tone === "good" && "bg-success-50 text-success-700",
                    gradeScore(healthScore).tone === "warn" && "bg-warning-50 text-warning-700",
                    gradeScore(healthScore).tone === "bad" && "bg-error-50 text-error-700",
                  )}
                >
                  {gradeScore(healthScore).label}
                </span>
              ) : undefined
            }
          />
          {(portfolio.isLoading || crawl.isLoading) && !crawl.data ? (
            <LoadingLine text="Loading your website's health…" />
          ) : !crawlCompleted ? (
            <EmptyPrompt
              icon={Globe}
              title={crawlRunning ? "Checking your website…" : "We haven't checked your website yet"}
              body={
                crawlRunning
                  ? "Your score and to-do list will appear here as soon as the check is finished."
                  : client?.domain
                    ? "Run a check and we'll give your website a score and a simple list of things to fix."
                    : "Add your website above and we'll give it a score and a simple list of things to fix."
              }
              action={
                crawlRunning || !client?.domain
                  ? undefined
                  : { label: "Check my website", onClick: runAudit, disabled: auditBusy }
              }
            />
          ) : (
            <HealthSummary score={healthScore} counts={counts} pagesChecked={shownCrawl?.pagesCrawled ?? null} />
          )}
        </Card>

        <Card id="visitors" className="flex flex-col justify-between gap-4 overflow-hidden">
          <CardHead
            title="Visitors from Google"
            subtitle={
              executive.data?.range?.days
                ? `Last ${executive.data.range.days} days · how people found and used your website.`
                : "How people find and use your website."
            }
            aside={
              hasGsc || hasGa ? (
                <Link
                  href="/google/search-performance"
                  aria-label="More detail on visitors"
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-200/60 text-brand-600 transition hover:bg-brand-200 hover:text-brand-950"
                >
                  <ArrowUpRight size={13} />
                </Link>
              ) : undefined
            }
          />
          {executive.isLoading ? (
            <LoadingLine text="Loading your visitors…" />
          ) : !hasGsc && !hasGa ? (
            <EmptyPrompt
              icon={PlugZap}
              title="Connect Google to see your visitors"
              body="Link your Google account and we'll show how many people find your website on Google and how many visit it."
              action={{ label: "Connect Google", href: "/integrations" }}
            />
          ) : (
            <>
              <div className="flex flex-col gap-3.5 min-w-0">
                <BigMeasure label={metric.label} hint={metric.hint} measure={headline?.[metric.key]} />

                {activeSeriesPoints && activeSeriesPoints.length >= 2 && (
                  <DailyCandles
                    points={activeSeriesPoints}
                    unit={metric.short.toLowerCase()}
                    days={rangeDays}
                  />
                )}
              </div>
              <div className="flex items-center gap-1.5 p-1 rounded-xl bg-brand-100/50 border border-brand-200/40" role="tablist" aria-label="Choose a figure">
                {metrics.map((m) => (
                  <button
                    key={m.key}
                    type="button"
                    role="tab"
                    aria-selected={m.key === metricKey}
                    onClick={() => setMetricKey(m.key)}
                    className={cn(
                      "min-w-0 flex-1 rounded-lg py-1.5 px-2 text-center text-[11px] font-semibold transition",
                      m.key === metricKey
                        ? "bg-signal-400 text-signal-ink font-bold shadow-xs"
                        : "text-brand-400 hover:text-brand-700 hover:bg-brand-200/40",
                    )}
                  >
                    {m.short}
                  </button>
                ))}
              </div>
            </>
          )}
        </Card>
      </div>

      {/* Row 2: finish setting up */}
      {setupIncomplete && (
        <Card className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-5 p-4 sm:p-4.5">
          <div className="w-full shrink-0 lg:w-[170px]">
            <p className="text-[13px] font-bold text-brand-950">Finish setting up</p>
            <p className="mt-0.5 text-[11.5px] text-brand-400">
              {doneCount} of {setupSteps.length} steps done
            </p>
            <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-brand-200/50">
              <div className="h-full rounded-full bg-signal-400" style={{ width: `${(doneCount / setupSteps.length) * 100}%` }} />
            </div>
          </div>
          <ul className="flex flex-1 flex-wrap gap-1.5">
            {setupSteps.map((step) => (
              <li key={step.label}>
                <Link
                  href={step.href}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg bg-brand-100/70 border border-brand-200/40 px-2.5 py-1 text-[11.5px] font-medium transition hover:bg-brand-200/60",
                    step.done ? "text-brand-950" : "text-brand-500",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-4 w-4 items-center justify-center rounded-full",
                      step.done ? "bg-signal-400 text-signal-ink" : "bg-brand-300 text-brand-100",
                    )}
                  >
                    {step.done ? <Check size={9} strokeWidth={3.2} /> : <Plus size={9} strokeWidth={3.2} />}
                  </span>
                  {step.label}
                </Link>
              </li>
            ))}
          </ul>
          {nextStep && (
            <Link
              href={nextStep.href}
              title={nextStep.why}
              className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full bg-signal-400 px-3.5 py-1.5 text-[11.5px] font-bold text-signal-ink transition hover:bg-signal-500 shadow-sm"
            >
              {nextStep.cta}
              <ArrowRight size={12} />
            </Link>
          )}
        </Card>
      )}

      {/* Row 3: what should I fix first? */}
      <section id="todo" className="flex flex-col gap-4 rounded-2xl bg-brand-100 border border-brand-200 p-4 sm:p-5 text-brand-950 shadow-sm">
        <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-[17px] font-bold tracking-tight text-brand-950">Your to-do list</h2>
              <span className="rounded-full bg-brand-200 px-2 py-0.5 text-[10.5px] font-bold text-brand-700">
                {priorityGroups.length} prioritized
              </span>
            </div>
            <p className="mt-0.5 max-w-lg text-[11.5px] text-brand-500 leading-normal">
              {reachAvailable
                ? "The most important fixes first — sorted by how many of your Google visitors each one affects."
                : "The most important fixes first — sorted by how serious each problem is. Connect Search Console to sort by how many visitors each one affects."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
            <div role="tablist" aria-label="Filter by how serious" className="flex items-center gap-0.5 rounded-full bg-brand-50 border border-brand-200/60 p-1 shadow-xs">
              {(["ALL", ...SEVERITY_ORDER] as const).map((sev) => {
                const n = sev === "ALL" ? priorityGroups.length : groupCount(sev);
                if (sev !== "ALL" && n === 0) return null;
                const on = severityTab === sev;
                return (
                  <button
                    key={sev}
                    type="button"
                    role="tab"
                    aria-selected={on}
                    onClick={() => {
                      setSeverityTab(sev);
                      setPickedGroup(null);
                    }}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold transition",
                      on ? "bg-signal-400 text-signal-ink font-bold shadow-xs" : "text-brand-400 hover:text-brand-950",
                    )}
                  >
                    {sev === "ALL" ? "All" : SEVERITY[sev].label}
                    <span className={cn("rounded-full px-1.5 py-0.2 text-[10px]", on ? "bg-signal-ink text-signal-400" : "bg-brand-200 text-brand-400")}>{n}</span>
                  </button>
                );
              })}
            </div>
            {counts && counts.openGroups > 0 && (
              <Link href="/website?tab=issues" className="text-[11.5px] font-bold text-brand-700 hover:underline shrink-0">
                See all {counts.openGroups} →
              </Link>
            )}
          </div>
        </div>

        {/* 3-metric KPI micro-ribbon */}
        {priorityGroups.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div className="flex items-center gap-3 rounded-xl bg-brand-50 border border-brand-200/70 p-3 shadow-2xs">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand-700">
                <AlertTriangle size={15} />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-brand-400">Action Queue</p>
                <p className="text-[14px] font-bold text-brand-950 leading-tight">
                  {priorityGroups.length} {priorityGroups.length === 1 ? "defect prioritized" : "defects prioritized"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-xl bg-brand-50 border border-brand-200/70 p-3 shadow-2xs">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand-700">
                <Layers size={15} />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-brand-400">Total Reach</p>
                <p className="text-[14px] font-bold text-brand-950 leading-tight">
                  {totalAffectedPages} {totalAffectedPages === 1 ? "page affected" : "pages affected"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-xl bg-brand-50 border border-brand-200/70 p-3 shadow-2xs">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-signal-400/15 text-signal-ink border border-signal-400/30">
                <Sparkles size={15} className="text-signal-400" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-brand-400">AI Automation</p>
                <p className="text-[14px] font-bold text-brand-950 leading-tight">
                  {aiReadyCount} {aiReadyCount === 1 ? "fix AI ready" : "fixes AI ready"}
                </p>
              </div>
            </div>
          </div>
        )}

        {issueGroups.isLoading ? (
          <LoadingLine text="Loading your to-do list…" />
        ) : priorityGroups.length === 0 ? (
          <div className="rounded-xl bg-brand-50 p-6 text-center text-[12px] text-brand-500">
            {crawlCompleted
              ? "Nothing to fix right now — your website is in good shape."
              : "Your to-do list will appear here after we check your website."}
          </div>
        ) : (
          <div className="grid gap-3.5 lg:grid-cols-[360px_1fr] items-start">
            <ol className="space-y-2">
              {shownGroups.map((group, i) => (
                <TodoRow key={group.groupKey} group={group} rank={i + 1} selected={group.groupKey === picked?.groupKey} onPick={() => setPickedGroup(group.groupKey)} />
              ))}
            </ol>
            {picked && <ProblemDetail group={picked} />}
          </div>
        )}
      </section>

      {/* Row 4: reviews and where visitors come from, then the full GA4 traffic. */}
      <div className={cn("grid gap-3.5", hasChannels && "lg:grid-cols-2")}>
      <Card id="reviews" className="flex flex-col gap-3.5">
        <CardHead title="Your Google reviews" subtitle="What customers say about you on Google." />
        {localSeo.isLoading ? (
          <LoadingLine text="Loading your reviews…" />
        ) : !localSeo.data ? (
          <EmptyPrompt
            icon={Star}
            title="Connect your Google Business Profile"
            body="See your star rating and number of reviews here, and get tips to earn more."
            action={{ label: "Connect", href: "/google-business-profile" }}
          />
        ) : (
          <ReviewsSummary
            businessName={localSeo.data.businessName}
            rating={localSeo.data.rating}
            reviewCount={localSeo.data.reviewCount}
            updatedAt={localSeo.data.updatedAt}
          />
        )}
      </Card>
      {ga4Data && hasChannels && <ChannelShare data={ga4Data} days={ga4.days} />}
      </div>

      {/* GA4 traffic — real figures from the customer's own property, or the reason there are none. */}
      <Ga4Overview projectId={projectId} />
    </div>
  );
}
