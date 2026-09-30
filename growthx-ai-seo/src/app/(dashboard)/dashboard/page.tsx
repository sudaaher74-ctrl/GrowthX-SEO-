"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Globe,
  Loader2,
  Plus,
  PlugZap,
  RefreshCw,
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
import {
  api,
  type FixClass,
  type Ga4ReportData,
  type IssueCounts,
  type IssueGroup,
  type IssueSeverity,
  type Measure,
} from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { SEVERITY_ORDER, SEVERITY_PLAIN, asSentence } from "@/lib/plain-language";
import { AutopilotStart } from "@/components/autopilot/autopilot-start";
import { Ga4Overview } from "@/components/ga4/ga4-panels";
import { useGa4Report } from "@/hooks/use-ga4-report";

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
const DEFAULT_WINDOW_DAYS = 28;

export default function UnifiedDashboardPage() {
  const { orgId, projectId, projects } = useWorkspace();
  const [metricKey, setMetricKey] = useState<MetricKey>("searchClicks");
  const [severityTab, setSeverityTab] = useState<"ALL" | IssueSeverity>("ALL");
  const [pickedGroup, setPickedGroup] = useState<string | null>(null);
  const portfolio = usePortfolio(orgId);
  const project = projects.find((p) => p.id === projectId) ?? projects[0] ?? null;
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

        <Card id="visitors" className="flex flex-col justify-between gap-4">
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
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 py-0.5">
                <div className="shrink-0 max-w-[210px]">
                  <BigMeasure label={metric.label} hint={metric.hint} measure={headline?.[metric.key]} />
                </div>
                {activeSeriesPoints && activeSeriesPoints.length >= 2 && (
                  <div className="flex-1 sm:max-w-[320px] lg:max-w-[360px]">
                    <DailyCandles
                      points={activeSeriesPoints}
                      unit={metric.short.toLowerCase()}
                      days={rangeDays}
                    />
                  </div>
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
      <section id="todo" className="flex flex-col gap-3.5 rounded-2xl bg-brand-100 border border-brand-200 p-4 sm:p-5 text-brand-950 shadow-sm">
        <div className="flex flex-col justify-between gap-2.5 lg:flex-row lg:items-center">
          <div>
            <h2 className="text-[16px] font-bold tracking-tight text-brand-950">Your to-do list</h2>
            <p className="mt-0.5 max-w-lg text-[11.5px] text-brand-500 leading-normal">
              {reachAvailable
                ? "The most important fixes first — sorted by how many of your Google visitors each one affects."
                : "The most important fixes first — sorted by how serious each problem is. Connect Search Console to sort by how many visitors each one affects."}
            </p>
          </div>
          <div className="flex items-center gap-3">
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

        {issueGroups.isLoading ? (
          <LoadingLine text="Loading your to-do list…" />
        ) : priorityGroups.length === 0 ? (
          <div className="rounded-xl bg-brand-50 p-6 text-center text-[12px] text-brand-500">
            {crawlCompleted
              ? "Nothing to fix right now — your website is in good shape."
              : "Your to-do list will appear here after we check your website."}
          </div>
        ) : (
          <div className="grid gap-3.5 lg:grid-cols-[330px_1fr] items-start">
            <ol className="space-y-1">
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

/* ── Building blocks ────────────────────────────────────────────── */

const SEVERITY = SEVERITY_PLAIN;

function Card({ id, className, children }: { id?: string; className?: string; children: React.ReactNode }) {
  return (
    <section
      id={id}
      className={cn("rounded-2xl border border-brand-200/50 bg-brand-50/90 p-4.5 sm:p-5 shadow-sm", className)}
    >
      {children}
    </section>
  );
}

function CardHead({ title, subtitle, aside }: { title: string; subtitle?: string; aside?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-[14px] font-bold text-brand-950 tracking-tight">{title}</h2>
        {subtitle && <p className="mt-0.5 max-w-md text-[11.5px] leading-normal text-brand-400">{subtitle}</p>}
      </div>
      {aside}
    </div>
  );
}

/**
 * A verdict read straight off the measured score, on the same bands the
 * Website Audit gauge colours by (80 and 50), so the two screens agree.
 */
function gradeScore(score: number): { label: string; tone: "good" | "warn" | "bad"; line: string } {
  if (score >= 90) return { label: "Excellent", tone: "good", line: "Your website is in great shape." };
  if (score >= 80) return { label: "Good", tone: "good", line: "Your website is in good shape, with a few things to improve." };
  if (score >= 50) return { label: "Needs work", tone: "warn", line: "Some problems are holding your website back on Google." };
  return { label: "Poor", tone: "bad", line: "Serious problems are making it hard for Google to show your website." };
}

function HealthSummary({
  score,
  counts,
  pagesChecked,
}: {
  score: number | null;
  counts: IssueCounts | null;
  pagesChecked: number | null;
}) {
  const grade = score != null ? gradeScore(score) : null;

  return (
    <div className="space-y-3.5">
      <div className="grid grid-cols-3 gap-2.5 sm:gap-4 pt-0.5">
        <div>
          <p className="text-[10.5px] font-medium uppercase tracking-wider text-brand-400">Health score</p>
          <p className="mt-1 flex items-baseline gap-1 text-[24px] sm:text-[26px] font-bold leading-none tracking-tight text-brand-950">
            {score != null ? score : "—"}
            <span className="text-[12px] font-medium text-brand-400 tracking-normal">/100</span>
          </p>
        </div>
        {counts && (
          <div>
            <p className="text-[10.5px] font-medium uppercase tracking-wider text-brand-400">Problems to fix</p>
            <p className="mt-1 text-[24px] sm:text-[26px] font-bold leading-none tracking-tight text-brand-950">{counts.openGroups}</p>
          </div>
        )}
        {pagesChecked != null && (
          <div>
            <p className="text-[10.5px] font-medium uppercase tracking-wider text-brand-400">Pages checked</p>
            <p className="mt-1 text-[24px] sm:text-[26px] font-bold leading-none tracking-tight text-brand-950">{pagesChecked}</p>
          </div>
        )}
      </div>

      <div className="space-y-2 pt-2 border-t border-brand-200/30">
        {grade ? (
          <p className="text-[12px] text-brand-400">{grade.line}</p>
        ) : (
          <p className="text-[12px] text-brand-400">We checked your website but couldn&apos;t work out a score this time.</p>
        )}
        {counts && (
          <p className="text-[12px] text-brand-700 leading-snug">
            {counts.openFindings === 0 ? (
              <>
                We found <strong>nothing to fix</strong>
                {pagesChecked != null && <> across the {pagesChecked} pages we checked</>}.
              </>
            ) : (
              <>
                We found{" "}
                <strong>
                  {counts.openGroups} {counts.openGroups === 1 ? "problem" : "problems"} to fix
                </strong>
                , showing up {counts.openFindings} {counts.openFindings === 1 ? "time" : "times"}
                {pagesChecked != null && <> across the {pagesChecked} pages we checked</>}.
              </>
            )}
          </p>
        )}
        {counts && counts.openFindings > 0 && <SeverityBreakdown bySeverity={counts.bySeverity} total={counts.openFindings} />}
        {counts && score != null && counts.openFindings > 0 && (
          <p className="text-[11px] leading-relaxed text-brand-400">
            {explainHealthScore(score, counts.openFindings, counts.bySeverity)}
          </p>
        )}
      </div>
    </div>
  );
}

/** One bar split by how serious each finding is, with a plain-word legend. */
function SeverityBreakdown({ bySeverity, total }: { bySeverity: Record<IssueSeverity, number>; total: number }) {
  return (
    <div>
      <div className="flex h-1.5 gap-0.5 overflow-hidden rounded-full bg-brand-200/40" aria-hidden>
        {SEVERITY_ORDER.map((sev) =>
          bySeverity[sev] > 0 ? (
            <div key={sev} className={cn("rounded-full", SEVERITY[sev].bar)} style={{ width: `${(bySeverity[sev] / total) * 100}%` }} />
          ) : null,
        )}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-3.5 gap-y-1">
        {SEVERITY_ORDER.map((sev) => (
          <li key={sev} className="flex items-center gap-1.5 text-[11px] font-medium text-brand-400">
            <span className={cn("h-1.5 w-1.5 rounded-full", SEVERITY[sev].bar)} />
            <span>{SEVERITY[sev].label}</span>
            <span className="text-brand-950 font-semibold">{bySeverity[sev]}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * One line saying why the score is what it is.
 *
 * The audit showed 89/100 labelled Good next to a hundred open findings. Both
 * numbers were right — the scorer caps each page's penalty and discounts
 * low-confidence findings, so many small problems barely move it — but nothing
 * said so, and a client who cannot reconcile two numbers stops trusting both.
 *
 * The per-page cap mirrors MAX_PENALTY_PER_URL in the crawler's
 * health-score.util.ts. Everything else here is read off the counts.
 */
const PENALTY_CAP_PER_PAGE = 20;

function explainHealthScore(
  score: number,
  openFindings: number,
  bySeverity: Record<IssueSeverity, number>,
): string {
  if (openFindings === 0) return `${score}/100 — nothing to fix.`;

  const dominant = SEVERITY_ORDER.reduce(
    (best, sev) => (bySeverity[sev] > bySeverity[best] ? sev : best),
    SEVERITY_ORDER[0],
  );
  const noun = openFindings === 1 ? "issue" : "issues";

  return (
    `Why ${score} and not lower? ${openFindings} ${noun}, mostly ${SEVERITY[dominant].label.toLowerCase()}. ` +
    `No single page can take away more than ${PENALTY_CAP_PER_PAGE} points, so one broken page can't sink your score.`
  );
}

/* ── To-do list ─────────────────────────────────────────────────── */

const FIX_CLASS_COPY: Record<FixClass, { label: string; hint: string; cta: string; href: string; note: string }> = {
  AUTO: {
    label: "Low-risk fix",
    hint: "A safe change (like a title or description) that can be prepared for your approval.",
    cta: "Prepare the fix",
    href: "/fix-engine",
    note: "Opens a pull request on your website's repository. Nothing is published until you review and merge it.",
  },
  APPROVAL: {
    label: "Needs your approval",
    hint: "A change that must be reviewed by you before anything is applied.",
    cta: "Review the change",
    href: "/fix-engine",
    note: "Shown as a before and after. Nothing changes on your website until you approve it.",
  },
  MANUAL: {
    label: "Do it yourself",
    hint: "Needs a person, such as writing content or contacting a developer.",
    cta: "Show me the pages",
    href: "/website?tab=issues",
    note: "We explain the problem and what to do next. You decide.",
  },
};

function TodoRow({ group, rank, selected, onPick }: { group: IssueGroup; rank: number; selected: boolean; onPick: () => void }) {
  const sev = SEVERITY[group.severity] ?? SEVERITY.LOW;
  return (
    <li>
      <button
        type="button"
        onClick={onPick}
        aria-pressed={selected}
        className={cn(
          "flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition",
          // Selected row gets sleek pill styling matching the theme!
          selected ? "bg-brand-50 border border-brand-200/60 text-brand-950 shadow-xs" : "bg-transparent hover:bg-brand-200/60 text-brand-950",
        )}
      >
        <span
          className={cn(
            "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
            selected ? "bg-signal-400 text-signal-ink" : "bg-brand-200 text-brand-600",
          )}
          aria-hidden
        >
          {rank}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[12.5px] font-semibold truncate leading-tight text-brand-950">
            {group.title}
          </span>
          <span className="mt-1 flex items-center gap-1.5">
            <span className={cn("inline-block rounded-full px-2 py-0.2 text-[10px] font-bold", severityChip(group.severity))}>
              {sev.label}
            </span>
          </span>
        </span>
        <span className="shrink-0 text-right">
          <span className={cn("block whitespace-nowrap text-[11px] font-medium", selected ? "text-brand-400" : "text-brand-500")}>
            {group.affectedCount} {group.affectedCount === 1 ? "page" : "pages"}
          </span>
        </span>
      </button>
    </li>
  );
}

function severityChip(sev: IssueSeverity): string {
  return {
    CRITICAL: "bg-error-50 text-error-700",
    HIGH: "bg-warning-50 text-warning-700",
    MEDIUM: "bg-accent-50 text-accent-700",
    LOW: "bg-brand-200 text-brand-600",
  }[sev];
}

function ProblemDetail({ group }: { group: IssueGroup }) {
  const fix = FIX_CLASS_COPY[group.fixClass] ?? FIX_CLASS_COPY.MANUAL;
  const sev = SEVERITY[group.severity] ?? SEVERITY.LOW;

  return (
    <div className="flex flex-col justify-between gap-3.5 rounded-xl border border-brand-200/60 bg-brand-50 p-4 sm:p-4.5 text-brand-950 shadow-md">
      <div>
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-brand-400">Problem details</p>
          <div className="flex items-center gap-1.5">
            <span className={cn("rounded-full px-2 py-0.5 text-[10.5px] font-bold", severityChip(group.severity))}>{sev.label}</span>
            <span className="rounded-full bg-brand-200 px-2 py-0.5 text-[10.5px] font-bold text-brand-400">{fix.label}</span>
          </div>
        </div>
        <h3 className="mt-1 text-[17px] sm:text-[18px] font-semibold leading-snug tracking-tight text-brand-950">{group.title}</h3>
        {group.summary && <p className="mt-1 text-[11.5px] leading-relaxed text-brand-400 max-w-xl">{asSentence(group.summary)}</p>}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-[1fr_1.3fr_110px] gap-2">
        <div className="rounded-lg bg-brand-100 border border-brand-200/50 p-2.5">
          <div className="flex items-center justify-between text-brand-400">
            <p className="text-[10px] font-medium uppercase tracking-wider">Pages affected</p>
            <ArrowUpRight size={12} className="text-brand-500" />
          </div>
          <p className="mt-0.5 text-[18px] font-bold tracking-tight text-brand-950 leading-tight">{group.affectedCount}</p>
        </div>

        <div className="rounded-lg bg-brand-100 border border-brand-200/50 p-2.5">
          <div className="flex items-center justify-between text-brand-400">
            <p className="text-[10px] font-medium uppercase tracking-wider">How it gets fixed</p>
            <ArrowUpRight size={12} className="text-brand-500" />
          </div>
          <p className="mt-0.5 text-[12.5px] font-bold text-brand-950 truncate leading-tight">{fix.label}</p>
          <p className="mt-0.5 text-[10.5px] text-brand-400 truncate leading-snug">{fix.hint}</p>
        </div>

        <Link
          href="/website?tab=issues"
          className="flex min-h-[58px] flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-brand-300 text-center text-[10.5px] font-semibold text-brand-400 transition hover:border-brand-400 hover:text-brand-950"
        >
          <Plus size={14} />
          See all issues
        </Link>
      </div>

      {group.action && (
        <div className="rounded-lg bg-brand-100 border border-brand-200/40 px-3 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-brand-400">How do I fix this?</p>
          <p className="mt-0.5 text-[11.5px] leading-relaxed text-brand-700">{asSentence(group.action)}</p>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-1 border-t border-brand-200/50">
        <p className="text-[11px] text-brand-400 leading-tight">{fix.note}</p>
        <Link
          href={fix.href}
          className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full bg-signal-400 px-3.5 py-1.5 text-[11.5px] font-bold text-signal-ink transition hover:bg-signal-500 shadow-sm"
        >
          {fix.cta}
          <ArrowRight size={12} />
        </Link>
      </div>
    </div>
  );
}

/* ── Visitors ───────────────────────────────────────────────────── */

function BigMeasure({ label, hint, measure }: { label: string; hint: string; measure: Measure | undefined }) {
  const measured = measure?.state === "MEASURED" ? measure : null;
  const change = measured?.changePct ?? null;

  return (
    <div className="min-w-0">
      <p className="text-[10.5px] font-medium uppercase tracking-wider text-brand-400">{label}</p>
      {measured ? (
        <p className="mt-1 flex flex-wrap items-baseline gap-x-2 text-[24px] sm:text-[28px] font-bold leading-none tracking-tight text-brand-950">
          {measured.value.toLocaleString()}
          {change != null && (
            <span className={cn("text-[11px] font-bold tracking-normal", change >= 0 ? "text-success-700" : "text-error-700")}>
              {change >= 0 ? "▲" : "▼"} {Math.abs(change)}%
            </span>
          )}
        </p>
      ) : (
        <p className="mt-1.5 text-[16px] font-semibold text-brand-400">
          {measure?.state === "NOT_CONNECTED" ? "Not connected" : "No data yet"}
        </p>
      )}
      <p className="mt-1 max-w-[240px] text-[11px] leading-snug text-brand-400">{hint}</p>
    </div>
  );
}

function formatCandleDate(isoOrDateStr: string): string {
  try {
    if (/^\d{4}-\d{2}-\d{2}/.test(isoOrDateStr)) {
      const [y, m, d] = isoOrDateStr.slice(0, 10).split("-").map(Number);
      const date = new Date(y, m - 1, d);
      return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    }
    return new Date(isoOrDateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return isoOrDateStr;
  }
}

function normalizeTrend(rawPoints: { date: string; value: number | null }[], windowDays = DEFAULT_WINDOW_DAYS) {
  if (!rawPoints || rawPoints.length === 0) return [];

  if (rawPoints.length >= windowDays) {
    return rawPoints.slice(-windowDays);
  }

  const lastPoint = rawPoints[rawPoints.length - 1];
  let anchor = new Date();
  if (lastPoint?.date) {
    if (/^\d{4}-\d{2}-\d{2}/.test(lastPoint.date)) {
      const [y, m, d] = lastPoint.date.slice(0, 10).split("-").map(Number);
      anchor = new Date(y, m - 1, d);
    } else {
      const parsed = new Date(lastPoint.date);
      if (!isNaN(parsed.getTime())) anchor = parsed;
    }
  }

  const lookup = new Map<string, number | null>();
  for (const pt of rawPoints) {
    const key = pt.date.slice(0, 10);
    lookup.set(key, pt.value);
  }

  const result: { date: string; value: number | null }[] = [];
  for (let i = windowDays - 1; i >= 0; i--) {
    const d = new Date(anchor);
    d.setDate(d.getDate() - i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const key = `${y}-${m}-${day}`;
    result.push({
      date: key,
      value: lookup.has(key) ? lookup.get(key)! : 0,
    });
  }

  return result;
}

/**
 * Daily activity candlesticks: well-proportioned, substantial bars displaying
 * daily performance across the selected window, with baseline marks for zero days
 * and prominent signal candles for active days.
 */
function DailyCandles({
  points,
  unit = "clicks",
  days = DEFAULT_WINDOW_DAYS,
}: {
  points: { date: string; value: number | null }[];
  unit?: string;
  days?: number;
}) {
  const max = Math.max(...points.map((p) => p.value ?? 0), 1);
  const total = points.reduce((sum, p) => sum + (p.value ?? 0), 0);
  const hasActivity = total > 0;

  return (
    <div
      className="flex w-full flex-col gap-1.5"
      role="img"
      aria-label={`${unit} each day, last ${days} days`}
    >
      <div className="flex items-center justify-between text-[10.5px] font-semibold text-brand-400">
        <span className="uppercase tracking-wider">Daily activity</span>
        {hasActivity && (
          <span className="rounded-full bg-brand-200/60 px-2 py-0.5 text-[9.5px] font-bold text-brand-700">
            Peak: {max.toLocaleString()} {unit}
          </span>
        )}
      </div>

      <div className="flex h-[92px] sm:h-[108px] w-full items-end gap-[3px] sm:gap-1 pt-1">
        {points.map((p) => {
          const val = p.value ?? 0;
          const isZero = val === 0;
          const heightPct = isZero ? 0 : Math.max(14, (val / max) * 100);
          const dateLabel = formatCandleDate(p.date);

          return (
            <div
              key={p.date}
              className="group relative flex h-full flex-1 min-w-[5px] sm:min-w-[6px] max-w-[12px] flex-col items-center justify-end"
            >
              <div className="pointer-events-none absolute -top-8 z-20 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-brand-950 px-2 py-0.5 text-[10px] font-medium text-brand-50 shadow-md group-hover:block">
                {dateLabel}: {val.toLocaleString()} {unit}
              </div>

              {isZero ? (
                <div
                  className="h-[4px] w-full rounded-full bg-brand-200/80 transition-colors group-hover:bg-brand-300"
                  title={`${dateLabel}: 0 ${unit}`}
                />
              ) : (
                <div
                  className="w-full rounded-t-[3px] sm:rounded-t-sm bg-signal-400 opacity-90 shadow-xs transition-all duration-150 origin-bottom group-hover:opacity-100 group-hover:scale-y-[1.03]"
                  style={{ height: `${heightPct}%` }}
                  title={`${dateLabel}: ${val.toLocaleString()} ${unit}`}
                />
              )}
            </div>
          );
        })}
      </div>

      <div className="flex w-full items-center justify-between border-t border-brand-200/50 pt-1 text-[10px] font-medium text-brand-400">
        <span>{days}d ago</span>
        <span>Today</span>
      </div>
    </div>
  );
}

function DailyClicks({ points }: { points: { date: string; clicks: number | null }[] }) {
  return <DailyCandles points={points.map((p) => ({ date: p.date, value: p.clicks }))} />;
}

/**
 * The busiest channels as share-of-sessions bars: the compact version of the
 * "Where your traffic comes from" table on the Google Analytics page.
 */
function ChannelShare({ data, days }: { data: Ga4ReportData; days: number }) {
  const total = data.channels.reduce((sum, c) => sum + c.sessions, 0) || data.totals.sessions;
  const top = [...data.channels].sort((a, b) => b.sessions - a.sessions).slice(0, 4);
  return (
    <Card className="flex flex-col gap-3">
      <CardHead
        title="Where your visitors come from"
        subtitle={`Last ${days} days · from Google Analytics`}
        aside={
          <Link
            href="/google/analytics"
            aria-label="Open Analytics"
            className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-200/60 text-brand-600 transition hover:bg-brand-200 hover:text-brand-950"
          >
            <ArrowUpRight size={13} />
          </Link>
        }
      />
      <ul className="space-y-2.5">
        {top.map((c, i) => {
          const pct = total > 0 ? (c.sessions / total) * 100 : 0;
          return (
            <li key={c.channel} className="flex items-center gap-3">
              <span className="w-[120px] shrink-0 truncate text-[12px] font-semibold text-brand-700">{c.channel}</span>
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-brand-100">
                <span
                  className={cn("block h-full rounded-full", i === 0 ? "bg-signal-400" : "bg-brand-400")}
                  style={{ width: `${Math.max(pct, pct > 0 ? 1.5 : 0)}%` }}
                />
              </span>
              <span className="w-10 shrink-0 text-right text-[12px] font-semibold text-brand-950">{Math.round(pct)}%</span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

/* ── Reviews ────────────────────────────────────────────────────── */

function ReviewsSummary({
  businessName,
  rating,
  reviewCount,
  updatedAt,
}: {
  businessName: string;
  rating: number;
  reviewCount: number;
  updatedAt?: string | null;
}) {
  if (reviewCount === 0) {
    return (
      <div className="space-y-2">
        <p className="text-[12.5px] font-semibold text-brand-950">{businessName}</p>
        <p className="text-[16px] font-bold text-brand-950">No reviews yet</p>
        <p className="text-[11.5px] text-brand-500">
          Reviews help new customers trust you. Ask happy customers to leave one on Google.
        </p>
        <Link
          href="/google-business-profile"
          className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-accent-700 hover:underline"
        >
          Get more reviews <ArrowRight size={11} />
        </Link>
      </div>
    );
  }

  const rounded = Math.round(rating);
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2.5">
      <div>
        <p className="text-[12.5px] font-semibold text-brand-950">{businessName}</p>
        <div className="mt-0.5 flex items-center gap-2.5">
          <span className="text-[24px] sm:text-[26px] font-bold leading-none tracking-tight text-brand-950">{rating.toFixed(1)}</span>
          <div>
            <div className="flex gap-0.5" aria-label={`${rating.toFixed(1)} out of 5 stars`}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Star
                  key={n}
                  size={13}
                  className={n <= rounded ? "fill-warning-400 text-warning-400" : "text-brand-300"}
                />
              ))}
            </div>
            <p className="mt-0.5 text-[11px] text-brand-400">
              from {reviewCount.toLocaleString()} {reviewCount === 1 ? "review" : "reviews"}
            </p>
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-0.5">
        {updatedAt && <p className="text-[10.5px] text-brand-400">Updated {relativeTime(updatedAt)}</p>}
        <Link
          href="/google-business-profile"
          className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-accent-700 hover:underline"
        >
          See your reviews <ArrowRight size={11} />
        </Link>
      </div>
    </div>
  );
}

/* ── Shared bits ────────────────────────────────────────────────── */

function LoadingLine({ text }: { text: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-6 text-[12.5px] text-brand-400">
      <Loader2 size={14} className="animate-spin" />
      {text}
    </div>
  );
}

function EmptyPrompt({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon: React.ElementType;
  title: string;
  body: string;
  action?: { label: string; href?: string; onClick?: () => void; disabled?: boolean };
}) {
  const button =
    "inline-flex items-center gap-1.5 rounded-full bg-signal-400 px-4 py-2.5 text-[12.5px] font-bold text-signal-ink hover:bg-signal-500 disabled:opacity-50";
  return (
    <div className="flex flex-col items-center py-4 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-200 text-signal-400">
        <Icon size={18} />
      </div>
      <p className="mt-3 text-[14px] font-semibold text-brand-950">{title}</p>
      <p className="mt-1 max-w-sm text-[12.5px] text-brand-500">{body}</p>
      {action && (
        <div className="mt-4">
          {action.href ? (
            <Link href={action.href} className={button}>
              {action.label}
              <ArrowRight size={13} />
            </Link>
          ) : (
            <button type="button" onClick={action.onClick} disabled={action.disabled} className={button}>
              {action.label}
              <ArrowRight size={13} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
