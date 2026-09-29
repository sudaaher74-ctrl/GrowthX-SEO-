"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Check,
  ChevronDown,
  Globe,
  Lightbulb,
  Loader2,
  PlugZap,
  RefreshCw,
  Star,
  Zap,
} from "lucide-react";
import {
  ActionButton,
  PageHeader,
  Panel,
  Pill,
  StatusNote,
  relativeTime,
} from "@/components/ui/console";
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
  type GrowthOpportunity,
  type IssueCounts,
  type IssueGroup,
  type IssueSeverity,
  type Measure,
} from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { SEVERITY_ORDER, SEVERITY_PLAIN, asSentence } from "@/lib/plain-language";
import { AutopilotStart } from "@/components/autopilot/autopilot-start";
import { Ga4Overview } from "@/components/ga4/ga4-panels";

/**
 * The first screen a business owner sees.
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

  const topOpportunities = (opportunities.data?.opportunities ?? []).slice(0, 3);

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

  return (
    <div className="space-y-5 pb-12">
      <PageHeader
        title={project?.name ?? "Dashboard"}
        subtitle={
          client?.domain ? (
            <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <Globe size={13} className="text-brand-400" />
              <span>{client.domain}</span>
              <span className="text-brand-300">·</span>
              <span>
                {crawlCompleted
                  ? `Last checked ${relativeTime(shownCrawl?.finishedAt ?? crawl.data?.startedAt)}`
                  : "Not checked yet"}
              </span>
            </span>
          ) : (
            "Add your website to see how it is doing on Google."
          )
        }
        actions={
          <>
            <Link href="/fix-engine">
              <ActionButton variant="primary" icon={<Zap size={12} className="fill-white" />}>
                See my improvement plan
              </ActionButton>
            </Link>
            <ActionButton
              variant="secondary"
              icon={<RefreshCw size={12} className={auditBusy ? "animate-spin" : undefined} />}
              disabled={auditBusy || !client?.domain}
              onClick={runAudit}
            >
              {auditBusy ? "Checking…" : "Check my website again"}
            </ActionButton>
          </>
        }
      />

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

      {/* 1. How is my website doing? */}
      <div className={cn("grid grid-cols-1 gap-4", setupIncomplete && "lg:grid-cols-3")}>
        <Panel
          title="How healthy is your website?"
          subtitle="A score out of 100 for how easily Google can find, read and show your pages. Higher is better."
          className={setupIncomplete ? "lg:col-span-2" : undefined}
        >
          <div className="p-5">
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
          </div>
        </Panel>

        {setupIncomplete && <SetupGuide steps={setupSteps} />}
      </div>

      {/* 2. What should I fix first? */}
      <Panel
        title="Your to-do list"
        subtitle={
          reachAvailable
            ? "The most important fixes first — sorted by how many of your Google visitors each one affects."
            : "The most important fixes first — sorted by how serious each problem is. Connect Search Console to sort by how many visitors each one affects."
        }
        actions={
          counts && counts.openGroups > 0 ? (
            <Link href="/website?tab=issues" className="text-[12px] font-semibold text-accent-700 hover:underline">
              See all {counts.openGroups} →
            </Link>
          ) : undefined
        }
      >
        {issueGroups.isLoading ? (
          <div className="p-5">
            <LoadingLine text="Loading your to-do list…" />
          </div>
        ) : priorityGroups.length === 0 ? (
          <div className="p-8 text-center text-[13px] text-brand-500">
            {crawlCompleted
              ? "Nothing to fix right now — your website is in good shape."
              : "Your to-do list will appear here after we check your website."}
          </div>
        ) : (
          <ol className="divide-y">
            {priorityGroups.map((group, i) => (
              <TodoItem key={group.groupKey} index={i + 1} group={group} />
            ))}
          </ol>
        )}
      </Panel>

      {/* GA4 traffic — real figures from the customer's own property, or the reason there are none. */}
      <Ga4Overview projectId={projectId} />

      {/* 3. Are people finding me? / What do customers say? */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Panel
          title="Visitors from Google"
          subtitle={
            executive.data?.range?.days
              ? `How people found and used your website in the last ${executive.data.range.days} days.`
              : "How people find and use your website."
          }
          actions={
            hasGsc || hasGa ? (
              <Link href="/google/search-performance" className="text-[12px] font-semibold text-accent-700 hover:underline">
                More detail →
              </Link>
            ) : undefined
          }
          className="lg:col-span-3"
        >
          <div className="p-5">
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
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <PlainStat
                    label="Clicks from Google"
                    hint="People who clicked your website in Google search"
                    measure={executive.data?.headline?.searchClicks}
                  />
                  <PlainStat
                    label="Times seen on Google"
                    hint="How often your website appeared in search results"
                    measure={executive.data?.headline?.impressions}
                  />
                  <PlainStat
                    label="Website visits"
                    hint="Visits to your website from anywhere"
                    measure={executive.data?.headline?.sessions}
                  />
                  <PlainStat
                    label="Goals reached"
                    hint="Enquiries, sign-ups or sales you track"
                    measure={executive.data?.headline?.conversions}
                  />
                </div>

                {gscSeries.data && gscSeries.data.length >= 2 && (
                  <DailyClicks points={gscSeries.data} />
                )}
              </div>
            )}
          </div>
        </Panel>

        <Panel title="Your Google reviews" subtitle="What customers say about you on Google." className="lg:col-span-2">
          <div className="p-5">
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
          </div>
        </Panel>
      </div>

      {/* 4. What could I do next? */}
      <Panel
        title="Ideas to grow"
        subtitle="Things you could add or change to get more customers from Google."
        actions={
          topOpportunities.length > 0 ? (
            <Link href="/google/opportunities" className="text-[12px] font-semibold text-accent-700 hover:underline">
              See all ideas →
            </Link>
          ) : undefined
        }
      >
        {opportunities.isLoading ? (
          <div className="p-5">
            <LoadingLine text="Loading ideas…" />
          </div>
        ) : topOpportunities.length === 0 ? (
          <div className="p-8 text-center text-[13px] text-brand-500">
            No ideas yet. They&apos;ll appear here once we&apos;ve checked your website and Google is connected.
          </div>
        ) : (
          <ul className="grid grid-cols-1 divide-y md:grid-cols-3 md:divide-x md:divide-y-0">
            {topOpportunities.map((op) => (
              <IdeaCard key={op.id} idea={op} />
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

/* ── Website health ─────────────────────────────────────────────── */

/**
 * Plain-word severity, shared with the action plan so the to-do list, the
 * breakdown above it and the plan all speak the same language.
 */
const SEVERITY = SEVERITY_PLAIN;

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
    <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
      <ScoreRing score={score} tone={grade?.tone ?? "default"} />

      <div className="min-w-0 flex-1 space-y-3">
        {grade ? (
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[18px] font-bold text-brand-950">{grade.label}</span>
              <Pill tone={grade.tone}>{score}/100</Pill>
            </div>
            <p className="mt-0.5 text-[13px] text-brand-600">{grade.line}</p>
          </div>
        ) : (
          <p className="text-[13px] text-brand-600">We checked your website but couldn&apos;t work out a score this time.</p>
        )}

        {counts && (
          <>
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

            {counts.openFindings > 0 && <SeverityBreakdown bySeverity={counts.bySeverity} total={counts.openFindings} />}

            {score != null && counts.openFindings > 0 && (
              <p className="text-[11.5px] leading-snug text-brand-500">
                {explainHealthScore(score, counts.openFindings, counts.bySeverity)}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ScoreRing({ score, tone }: { score: number | null; tone: "good" | "warn" | "bad" | "default" }) {
  const size = 112;
  const stroke = 10;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const pct = score != null ? Math.max(0, Math.min(100, score)) / 100 : 0;
  const color = {
    good: "var(--color-success-600)",
    warn: "var(--color-warning-500)",
    bad: "var(--color-error-600)",
    default: "var(--color-brand-300)",
  }[tone];

  return (
    <div className="relative shrink-0 self-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-brand-100)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - pct)}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[30px] font-bold leading-none tracking-[-0.02em] text-brand-950">
          {score != null ? score : "—"}
        </span>
        <span className="mt-1 text-[11px] text-brand-400">out of 100</span>
      </div>
    </div>
  );
}

/** One bar split by how serious each finding is, with a plain-word legend. */
function SeverityBreakdown({ bySeverity, total }: { bySeverity: Record<IssueSeverity, number>; total: number }) {
  return (
    <div>
      <div className="flex h-2 overflow-hidden rounded-full bg-brand-100" aria-hidden>
        {SEVERITY_ORDER.map((sev) =>
          bySeverity[sev] > 0 ? (
            <div key={sev} className={SEVERITY[sev].bar} style={{ width: `${(bySeverity[sev] / total) * 100}%` }} />
          ) : null,
        )}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        {SEVERITY_ORDER.map((sev) => (
          <li key={sev} className="flex items-center gap-1.5 text-[12px] text-brand-600">
            <span className={cn("h-2 w-2 rounded-full", SEVERITY[sev].bar)} />
            <span>{SEVERITY[sev].label}</span>
            <span className="font-semibold text-brand-950">{bySeverity[sev]}</span>
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

/* ── Setup guide ────────────────────────────────────────────────── */

interface SetupStep {
  label: string;
  why: string;
  done: boolean;
  href: string;
  cta: string;
}

/** Shows the one next step prominently; the full checklist is one click away. */
function SetupGuide({ steps }: { steps: SetupStep[] }) {
  const doneCount = steps.filter((s) => s.done).length;
  const next = steps.find((s) => !s.done);

  return (
    <Panel title="Finish setting up" subtitle={`${doneCount} of ${steps.length} steps done`}>
      <div className="space-y-4 p-4">
        <div className="h-1.5 overflow-hidden rounded-full bg-brand-100">
          <div
            className="h-full rounded-full bg-success-600"
            style={{ width: `${(doneCount / steps.length) * 100}%` }}
          />
        </div>

        {next && (
          <div className="rounded-lg bg-brand-50 p-3">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-brand-400">Next step</p>
            <p className="mt-1 text-[13px] font-semibold text-brand-950">{next.label}</p>
            <p className="mt-0.5 text-[12px] text-brand-600">{next.why}</p>
            <Link
              href={next.href}
              className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-1.5 text-[12px] font-semibold text-white hover:opacity-90"
            >
              {next.cta}
              <ArrowRight size={12} />
            </Link>
          </div>
        )}

        <details className="group">
          <summary className="flex cursor-pointer list-none items-center gap-1 text-[12px] font-semibold text-accent-700 hover:underline [&::-webkit-details-marker]:hidden">
            See all {steps.length} steps
            <ChevronDown size={13} className="transition-transform group-open:rotate-180" />
          </summary>
          <ul className="mt-2 space-y-1.5">
            {steps.map((step) => (
              <li key={step.label}>
                <Link
                  href={step.href}
                  className="flex items-center gap-2 rounded-md py-0.5 text-[12.5px] hover:text-brand-950"
                >
                  <span
                    className={cn(
                      "flex h-4 w-4 shrink-0 items-center justify-center rounded-full",
                      step.done ? "bg-success-600 text-white" : "border-2 border-brand-300",
                    )}
                  >
                    {step.done && <Check size={10} strokeWidth={3} />}
                  </span>
                  <span className={step.done ? "text-brand-400 line-through" : "text-brand-700"}>{step.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </details>
      </div>
    </Panel>
  );
}

/* ── To-do list ─────────────────────────────────────────────────── */

function TodoItem({ index, group }: { index: number; group: IssueGroup }) {
  const sev = SEVERITY[group.severity] ?? SEVERITY.LOW;

  return (
    <li className="flex gap-3 px-4 py-3.5">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[11.5px] font-semibold text-brand-600">
        {index}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Pill tone={sev.tone}>{sev.label}</Pill>
            <span className="text-[13px] font-semibold text-brand-950">{group.title}</span>
          </div>
          {group.summary && <p className="mt-1 text-[12.5px] text-brand-600">{asSentence(group.summary)}</p>}
          {group.action && (
            <details className="group mt-1.5">
              <summary className="flex cursor-pointer list-none items-center gap-1 text-[12px] font-semibold text-accent-700 hover:underline [&::-webkit-details-marker]:hidden">
                How do I fix this?
                <ChevronDown size={13} className="transition-transform group-open:rotate-180" />
              </summary>
              <p className="mt-1.5 rounded-lg bg-brand-50 px-3 py-2 text-[12.5px] leading-relaxed text-brand-700">
                {asSentence(group.action)}
              </p>
            </details>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:flex-col sm:items-end sm:gap-1.5">
          <span className="whitespace-nowrap text-[11.5px] text-brand-500">
            {group.affectedCount} {group.affectedCount === 1 ? "page" : "pages"}
          </span>
          <Link
            href="/website?tab=issues"
            className="whitespace-nowrap rounded-lg border bg-white px-2.5 py-1 text-[12px] font-semibold text-brand-700 hover:bg-brand-50"
          >
            Show me
          </Link>
        </div>
      </div>
    </li>
  );
}

/* ── Visitors ───────────────────────────────────────────────────── */

function PlainStat({ label, hint, measure }: { label: string; hint: string; measure: Measure | undefined }) {
  const measured = measure?.state === "MEASURED" ? measure : null;
  const change = measured?.changePct ?? null;

  return (
    <div className="rounded-lg border p-3">
      <p className="text-[12px] font-semibold text-brand-700">{label}</p>
      {measured ? (
        <div className="mt-1 flex flex-wrap items-baseline gap-x-2">
          <span className="text-[22px] font-bold tracking-[-0.02em] text-brand-950">
            {measured.value.toLocaleString()}
          </span>
          {change != null && (
            <span className={cn("text-[11.5px] font-semibold", change >= 0 ? "text-success-600" : "text-error-600")}>
              {change >= 0 ? "▲" : "▼"} {Math.abs(change)}%
            </span>
          )}
        </div>
      ) : (
        <p className="mt-1 text-[13px] text-brand-400">
          {measure?.state === "NOT_CONNECTED" ? "Not connected" : "No data yet"}
        </p>
      )}
      <p className="mt-0.5 text-[11px] leading-snug text-brand-400">{hint}</p>
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
    <div className="rounded-lg bg-brand-50 px-3 py-2.5">
      <p className="text-[12px] text-brand-600">Clicks from Google each day, last {points.length} days</p>
      <div className="mt-2 flex h-10 items-end gap-0.5" aria-hidden>
        {points.map((p) => (
          <div
            key={p.date}
            className="flex-1 rounded-t bg-accent-400"
            style={{ height: `${Math.max(6, ((p.clicks ?? 0) / max) * 100)}%` }}
            title={`${p.date}: ${(p.clicks ?? 0).toLocaleString()} clicks`}
          />
        ))}
      </div>
    </div>
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
        <p className="text-[12.5px] text-brand-600">
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
    <div className="space-y-2">
      <p className="text-[13px] font-semibold text-brand-950">{businessName}</p>
      <div className="flex items-center gap-3">
        <span className="text-[30px] font-bold leading-none tracking-[-0.02em] text-brand-950">{rating.toFixed(1)}</span>
        <div>
          <div className="flex gap-0.5" aria-label={`${rating.toFixed(1)} out of 5 stars`}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Star
                key={n}
                size={15}
                className={n <= rounded ? "fill-warning-400 text-warning-400" : "text-brand-200"}
              />
            ))}
          </div>
          <p className="mt-0.5 text-[12px] text-brand-500">
            from {reviewCount.toLocaleString()} {reviewCount === 1 ? "review" : "reviews"}
          </p>
        </div>
      </div>
      {updatedAt && <p className="text-[11px] text-brand-400">Updated {relativeTime(updatedAt)}</p>}
      <Link
        href="/google-business-profile"
        className="inline-flex items-center gap-1 text-[12px] font-semibold text-accent-700 hover:underline"
      >
        See your reviews <ArrowRight size={12} />
      </Link>
    </div>
  );
}

/* ── Ideas ──────────────────────────────────────────────────────── */

const IDEA_KIND: Record<GrowthOpportunity["category"], string> = {
  SEO: "Google ranking",
  CONTENT: "New content",
  LOCAL: "Local customers",
  TECHNICAL: "Website fix",
  MARKETING: "Marketing",
  BUSINESS: "Business",
  COMPETITOR: "Competitors",
};

const POTENTIAL: Record<GrowthOpportunity["potential"], { label: string; tone: "good" | "info" | "default" }> = {
  HIGH: { label: "Big impact", tone: "good" },
  MEDIUM: { label: "Some impact", tone: "info" },
  LOW: { label: "Small impact", tone: "default" },
};

function IdeaCard({ idea }: { idea: GrowthOpportunity }) {
  const potential = POTENTIAL[idea.potential];
  return (
    <li className="flex flex-col gap-2 p-4">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-500">
          <Lightbulb size={12} className="text-warning-500" />
          {IDEA_KIND[idea.category] ?? "Idea"}
        </span>
        {potential && <Pill tone={potential.tone}>{potential.label}</Pill>}
      </div>
      <p className="line-clamp-2 text-[13px] font-semibold text-brand-950">{idea.title}</p>
      <p className="line-clamp-3 text-[12px] text-brand-600">{idea.recommendedAction || idea.summary}</p>
      <Link
        href="/google/opportunities"
        className="mt-auto inline-flex items-center gap-1 pt-1 text-[12px] font-semibold text-accent-700 hover:underline"
      >
        Let&apos;s do it <ArrowRight size={12} />
      </Link>
    </li>
  );
}

/* ── Shared bits ────────────────────────────────────────────────── */

function LoadingLine({ text }: { text: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-6 text-[12.5px] text-brand-500">
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
    "inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3.5 py-2 text-[12.5px] font-semibold text-white hover:opacity-90 disabled:opacity-50";
  return (
    <div className="flex flex-col items-center py-4 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 text-brand-600">
        <Icon size={18} />
      </div>
      <p className="mt-3 text-[14px] font-semibold text-brand-950">{title}</p>
      <p className="mt-1 max-w-sm text-[12.5px] text-brand-600">{body}</p>
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
