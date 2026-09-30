"use client";
import { useState } from "react";
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

  // 28-day daily clicks, for the small trend line under "Visitors from Google".
  const gscSeries = useQuery({
    queryKey: ["gsc-dash-series", projectId],
    queryFn: () => api.gscTimeseries(projectId!, 28),
    enabled: !!projectId && hasGsc,
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

  // The to-do list: filter by how serious, and show the picked problem beside it.
  const shownGroups = severityTab === "ALL" ? priorityGroups : priorityGroups.filter((g) => g.severity === severityTab);
  const picked = shownGroups.find((g) => g.groupKey === pickedGroup) ?? shownGroups[0] ?? null;
  const groupCount = (sev: IssueSeverity) => priorityGroups.filter((g) => g.severity === sev).length;

  const doneCount = setupSteps.filter((s) => s.done).length;
  const nextStep = setupSteps.find((s) => !s.done);

  return (
    <div className="space-y-4 pb-12">
      {/* Jump links */}
      <nav aria-label="On this page" className="inline-flex gap-0.5 rounded-full bg-brand-950 p-1 text-[12.5px] font-semibold">
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
              "rounded-full px-4 py-2 transition-colors",
              i === 0 ? "bg-signal-400 text-signal-ink" : "text-brand-400 hover:text-signal-ink",
            )}
          >
            {label}
          </a>
        ))}
      </nav>

      {/* Title */}
      <div className="flex flex-col justify-between gap-4 pt-2 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-[44px] font-light leading-none tracking-[-0.035em] text-brand-950 sm:text-[56px]">
            Dashboard
          </h1>
          <p className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13.5px] font-medium text-brand-500">
            {client?.domain ? (
              <>
                <Globe size={13} className="text-brand-400" />
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
            className="inline-flex items-center gap-2 rounded-full border px-5 py-3 text-[13.5px] font-bold text-brand-950 transition hover:bg-brand-100"
          >
            See my improvement plan
          </Link>
          <button
            type="button"
            onClick={runAudit}
            disabled={auditBusy || !client?.domain}
            className="inline-flex items-center gap-2 rounded-full bg-signal-400 px-5 py-3 text-[13.5px] font-bold text-signal-ink transition hover:bg-signal-500 disabled:opacity-50"
          >
            <RefreshCw size={14} className={auditBusy ? "animate-spin" : undefined} />
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
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.35fr_1fr]">
        <Card id="health" className="flex flex-col justify-between gap-6">
          <CardHead
            title="How healthy is your website?"
            subtitle="A score out of 100 for how easily Google can find, read and show your pages. Higher is better."
            aside={
              healthScore != null && crawlCompleted ? (
                <span
                  className={cn(
                    "rounded-full px-3.5 py-1.5 text-[12px] font-bold",
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

        <Card id="visitors" className="flex flex-col justify-between gap-5">
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
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-200 text-brand-700 transition hover:text-brand-950"
                >
                  <ArrowUpRight size={16} />
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
              <div className="flex items-end justify-between gap-4">
                <BigMeasure label={metric.label} hint={metric.hint} measure={headline?.[metric.key]} />
                {metric.key === "searchClicks" && gscSeries.data && gscSeries.data.length >= 2 && (
                  <DailyClicks points={gscSeries.data} />
                )}
              </div>
              <div className="flex items-end gap-2" role="tablist" aria-label="Choose a figure">
                {metrics.map((m) => (
                  <button
                    key={m.key}
                    type="button"
                    role="tab"
                    aria-selected={m.key === metricKey}
                    onClick={() => setMetricKey(m.key)}
                    className={cn(
                      "min-w-0 flex-1 rounded-2xl px-3.5 py-3 text-left text-[12px] font-semibold transition",
                      m.key === metricKey
                        ? "-translate-y-3 bg-signal-400 text-signal-ink"
                        : "bg-brand-100 text-brand-500 hover:bg-brand-200",
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
        <Card className="flex flex-col gap-4 lg:flex-row lg:items-center lg:gap-6">
          <div className="w-full shrink-0 lg:w-[190px]">
            <p className="text-[15px] font-bold text-brand-950">Finish setting up</p>
            <p className="mt-0.5 text-[13px] text-brand-400">
              {doneCount} of {setupSteps.length} steps done
            </p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-brand-200">
              <div className="h-full rounded-full bg-signal-400" style={{ width: `${(doneCount / setupSteps.length) * 100}%` }} />
            </div>
          </div>
          <ul className="flex flex-1 flex-wrap gap-2">
            {setupSteps.map((step) => (
              <li key={step.label}>
                <Link
                  href={step.href}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-xl bg-brand-100 px-3.5 py-2 text-[13px] font-semibold transition hover:bg-brand-200",
                    step.done ? "text-brand-950" : "text-brand-500",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-[18px] w-[18px] items-center justify-center rounded-full",
                      step.done ? "bg-signal-400 text-signal-ink" : "bg-brand-300 text-brand-100",
                    )}
                  >
                    {step.done ? <Check size={11} strokeWidth={3.2} /> : <Plus size={11} strokeWidth={3.2} />}
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
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-brand-950 px-5 py-3 text-[13.5px] font-bold text-signal-ink transition hover:opacity-90"
            >
              {nextStep.cta}
              <ArrowRight size={14} />
            </Link>
          )}
        </Card>
      )}

      {/* Row 3: what should I fix first? A light panel, as in the reference. */}
      <section id="todo" className="dash-light flex flex-col gap-4 rounded-[34px] bg-brand-100 p-5 text-brand-950 sm:p-6">
        <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
          <div>
            <h2 className="text-[20px] font-bold tracking-[-0.01em]">Your to-do list</h2>
            <p className="mt-0.5 max-w-xl text-[13px] text-brand-500">
              {reachAvailable
                ? "The most important fixes first — sorted by how many of your Google visitors each one affects."
                : "The most important fixes first — sorted by how serious each problem is. Connect Search Console to sort by how many visitors each one affects."}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div role="tablist" aria-label="Filter by how serious" className="dash-dark flex gap-1 rounded-full bg-brand-50 p-1.5">
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
                      "inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-[12.5px] font-semibold transition",
                      on ? "bg-signal-400 text-signal-ink" : "text-brand-500 hover:text-brand-950",
                    )}
                  >
                    {sev === "ALL" ? "All" : SEVERITY[sev].label}
                    <span className={cn("rounded-full px-1.5 text-[11px]", on ? "bg-signal-ink text-signal-400" : "bg-brand-200")}>{n}</span>
                  </button>
                );
              })}
            </div>
            {counts && counts.openGroups > 0 && (
              <Link href="/website?tab=issues" className="text-[12.5px] font-bold text-brand-700 hover:underline">
                See all {counts.openGroups} →
              </Link>
            )}
          </div>
        </div>

        {issueGroups.isLoading ? (
          <LoadingLine text="Loading your to-do list…" />
        ) : priorityGroups.length === 0 ? (
          <div className="rounded-3xl bg-brand-50 p-8 text-center text-[13px] text-brand-500">
            {crawlCompleted
              ? "Nothing to fix right now — your website is in good shape."
              : "Your to-do list will appear here after we check your website."}
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[400px_1fr]">
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
      <div className={cn("grid gap-4", hasChannels && "lg:grid-cols-2")}>
      <Card id="reviews" className="flex flex-col gap-4">
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
      className={cn("rounded-[32px] border bg-brand-50 p-6", className)}
    >
      {children}
    </section>
  );
}

function CardHead({ title, subtitle, aside }: { title: string; subtitle?: string; aside?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <h2 className="text-[15px] font-bold text-brand-950">{title}</h2>
        {subtitle && <p className="mt-1 max-w-md text-[13px] leading-snug text-brand-400">{subtitle}</p>}
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
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-x-10 gap-y-4">
        <div>
          <p className="text-[12px] font-semibold text-brand-400">Health score</p>
          <p className="text-[60px] font-light leading-none tracking-[-0.04em] text-brand-950">
            {score != null ? score : "—"}
            <span className="ml-1 text-[18px] tracking-normal text-brand-400">/100</span>
          </p>
        </div>
        {counts && (
          <div>
            <p className="text-[12px] font-semibold text-brand-400">Problems to fix</p>
            <p className="text-[38px] font-light leading-[1.1] tracking-[-0.03em] text-brand-950">{counts.openGroups}</p>
          </div>
        )}
        {pagesChecked != null && (
          <div>
            <p className="text-[12px] font-semibold text-brand-400">Pages checked</p>
            <p className="text-[38px] font-light leading-[1.1] tracking-[-0.03em] text-brand-950">{pagesChecked}</p>
          </div>
        )}
      </div>

      <div className="space-y-2.5">
        {grade ? (
          <p className="text-[13px] text-brand-500">{grade.line}</p>
        ) : (
          <p className="text-[13px] text-brand-500">We checked your website but couldn&apos;t work out a score this time.</p>
        )}
        {counts && (
          <p className="text-[13px] text-brand-700">
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
          <p className="text-[11.5px] leading-snug text-brand-400">
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
      <div className="flex h-2 gap-1 overflow-hidden rounded-full" aria-hidden>
        {SEVERITY_ORDER.map((sev) =>
          bySeverity[sev] > 0 ? (
            <div key={sev} className={cn("rounded-full", SEVERITY[sev].bar)} style={{ width: `${(bySeverity[sev] / total) * 100}%` }} />
          ) : null,
        )}
      </div>
      <ul className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1">
        {SEVERITY_ORDER.map((sev) => (
          <li key={sev} className="flex items-center gap-1.5 text-[12px] font-semibold text-brand-500">
            <span className={cn("h-2 w-2 rounded-full", SEVERITY[sev].bar)} />
            <span>{SEVERITY[sev].label}</span>
            <span className="text-brand-950">{bySeverity[sev]}</span>
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
          "flex w-full items-center gap-3.5 rounded-[20px] px-3.5 py-3 text-left transition",
          // Only the picked row is dark; the rest stay on the light panel's own scale.
          selected ? "dash-dark bg-brand-50" : "bg-transparent hover:bg-brand-200",
        )}
      >
        <span
          className={cn(
            "flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full text-[13px] font-bold",
            selected ? "bg-signal-400 text-signal-ink" : "bg-brand-200 text-brand-700",
          )}
          aria-hidden
        >
          {rank}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-bold leading-tight text-brand-950">{group.title}</span>
          <span className={cn("mt-1.5 inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold", severityChip(group.severity))}>
            {sev.label}
          </span>
        </span>
        <span className="shrink-0 text-right">
          <span className="block whitespace-nowrap text-[12px] font-semibold text-brand-400">
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
    <div className="dash-dark flex flex-col justify-between gap-6 rounded-[28px] bg-brand-50 p-6 text-brand-950">
      <div>
        <p className="text-[12px] font-semibold text-brand-400">Problem details</p>
        <h3 className="mt-1 max-w-xl text-[26px] font-light leading-[1.15] tracking-[-0.03em]">{group.title}</h3>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className={cn("rounded-full px-2.5 py-0.5 text-[11.5px] font-bold", severityChip(group.severity))}>{sev.label}</span>
          <span className="rounded-full bg-brand-200 px-2.5 py-0.5 text-[11.5px] font-bold text-brand-700">{fix.label}</span>
        </div>
        {group.summary && <p className="mt-3 max-w-xl text-[13px] leading-relaxed text-brand-500">{asSentence(group.summary)}</p>}
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_1.4fr_120px]">
        <div className="rounded-[20px] bg-brand-100 p-4">
          <p className="text-[12px] font-semibold text-brand-400">Pages affected</p>
          <p className="mt-1 text-[32px] font-light tracking-[-0.03em]">{group.affectedCount}</p>
        </div>
        <div className="rounded-[20px] bg-brand-100 p-4">
          <p className="text-[12px] font-semibold text-brand-400">How it gets fixed</p>
          <p className="mt-2 text-[14px] font-bold leading-tight">{fix.label}</p>
          <p className="mt-1 text-[12px] leading-snug text-brand-500">{fix.hint}</p>
        </div>
        <Link
          href="/website?tab=issues"
          className="flex min-h-[88px] flex-col items-center justify-center gap-2 rounded-[20px] border-[1.5px] border-dashed border-brand-300 text-center text-[12px] font-semibold text-brand-400 transition hover:border-brand-400 hover:text-brand-950"
        >
          <Plus size={20} />
          See all issues
        </Link>
      </div>

      {group.action && (
        <div className="rounded-[20px] bg-brand-100 px-4 py-3">
          <p className="text-[12px] font-semibold text-brand-400">How do I fix this?</p>
          <p className="mt-1 text-[13px] leading-relaxed text-brand-700">{asSentence(group.action)}</p>
        </div>
      )}

      <div className="flex flex-col justify-between gap-3 rounded-[22px] bg-brand-100 px-4 py-3.5 sm:flex-row sm:items-center">
        <p className="max-w-md text-[12.5px] leading-snug text-brand-500">{fix.note}</p>
        <Link
          href={fix.href}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-signal-400 px-5 py-3 text-[13.5px] font-bold text-signal-ink transition hover:bg-signal-500"
        >
          {fix.cta}
          <ArrowRight size={14} />
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
      <p className="text-[12px] font-semibold text-brand-400">{label}</p>
      {measured ? (
        <p className="flex flex-wrap items-baseline gap-x-2.5 text-[52px] font-light leading-[1.05] tracking-[-0.04em] text-brand-950">
          {measured.value.toLocaleString()}
          {change != null && (
            <span className={cn("text-[13px] font-bold tracking-normal", change >= 0 ? "text-success-700" : "text-error-700")}>
              {change >= 0 ? "▲" : "▼"} {Math.abs(change)}%
            </span>
          )}
        </p>
      ) : (
        <p className="mt-2 text-[20px] text-brand-400">
          {measure?.state === "NOT_CONNECTED" ? "Not connected" : "No data yet"}
        </p>
      )}
      <p className="mt-1 max-w-[220px] text-[12px] leading-snug text-brand-400">{hint}</p>
    </div>
  );
}

/**
 * Daily clicks as plain bars. Neutral on purpose: a day-to-day dip is normal,
 * and a red line would read as bad news to someone who can't tell noise from
 * a trend.
 */
function DailyClicks({ points }: { points: { date: string; clicks: number | null }[] }) {
  const max = Math.max(...points.map((p) => p.clicks ?? 0), 1);
  return (
    <div className="flex h-[72px] shrink-0 items-end gap-[3px]" role="img" aria-label={`Clicks from Google each day, last ${points.length} days`}>
      {points.map((p) => (
        <div
          key={p.date}
          className="w-[6px] rounded-full bg-signal-400 opacity-85"
          style={{ height: `${Math.max(8, ((p.clicks ?? 0) / max) * 100)}%` }}
          title={`${p.date}: ${(p.clicks ?? 0).toLocaleString()} clicks`}
        />
      ))}
    </div>
  );
}

/**
 * The busiest channels as share-of-sessions bars: the compact version of the
 * "Where your traffic comes from" table on the Google Analytics page.
 */
function ChannelShare({ data, days }: { data: Ga4ReportData; days: number }) {
  const total = data.channels.reduce((sum, c) => sum + c.sessions, 0) || data.totals.sessions;
  const top = [...data.channels].sort((a, b) => b.sessions - a.sessions).slice(0, 4);
  return (
    <Card className="flex flex-col gap-4">
      <CardHead
        title="Where your visitors come from"
        subtitle={`Last ${days} days · from Google Analytics`}
        aside={
          <Link
            href="/google/analytics"
            aria-label="Open Analytics"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-200 text-brand-700 transition hover:text-brand-950"
          >
            <ArrowUpRight size={16} />
          </Link>
        }
      />
      <ul className="space-y-3">
        {top.map((c, i) => {
          const pct = total > 0 ? (c.sessions / total) * 100 : 0;
          return (
            <li key={c.channel} className="flex items-center gap-3.5">
              <span className="w-[130px] shrink-0 truncate text-[13px] font-semibold text-brand-700">{c.channel}</span>
              <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-brand-100">
                <span
                  className={cn("block h-full rounded-full", i === 0 ? "bg-signal-400" : "bg-brand-400")}
                  style={{ width: `${Math.max(pct, pct > 0 ? 1.5 : 0)}%` }}
                />
              </span>
              <span className="w-12 shrink-0 text-right text-[14px] font-semibold text-brand-950">{Math.round(pct)}%</span>
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
        <p className="text-[13px] font-semibold text-brand-950">{businessName}</p>
        <p className="text-[18px] font-bold text-brand-950">No reviews yet</p>
        <p className="text-[12.5px] text-brand-500">
          Reviews help new customers trust you. Ask happy customers to leave one on Google.
        </p>
        <Link
          href="/google-business-profile"
          className="inline-flex items-center gap-1 text-[12px] font-semibold text-accent-700 hover:underline"
        >
          Get more reviews <ArrowRight size={12} />
        </Link>
      </div>
    );
  }

  const rounded = Math.round(rating);
  return (
    <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
      <div>
        <p className="text-[13px] font-semibold text-brand-950">{businessName}</p>
        <div className="mt-1 flex items-center gap-3">
          <span className="text-[40px] font-light leading-none tracking-[-0.03em] text-brand-950">{rating.toFixed(1)}</span>
          <div>
            <div className="flex gap-0.5" aria-label={`${rating.toFixed(1)} out of 5 stars`}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Star
                  key={n}
                  size={15}
                  className={n <= rounded ? "fill-warning-400 text-warning-400" : "text-brand-300"}
                />
              ))}
            </div>
            <p className="mt-0.5 text-[12px] text-brand-400">
              from {reviewCount.toLocaleString()} {reviewCount === 1 ? "review" : "reviews"}
            </p>
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-1">
        {updatedAt && <p className="text-[11px] text-brand-400">Updated {relativeTime(updatedAt)}</p>}
        <Link
          href="/google-business-profile"
          className="inline-flex items-center gap-1 text-[12px] font-semibold text-accent-700 hover:underline"
        >
          See your reviews <ArrowRight size={12} />
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
