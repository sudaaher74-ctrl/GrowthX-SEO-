"use client";
import { Suspense, useState } from "react";
import { Activity, Layout, LayoutGrid, Loader2, RefreshCw, Zap } from "lucide-react";
import {
  ActionButton,
  Kpi,
  MeterBar,
  Mono,
  PageHeader,
  Panel,
  Pill,
  Sparkline,
  Table,
  Tabs,
  Td,
  Th,
  Tr,
  relativeTime,
} from "@/components/ui/console";
import { api, type CrawlIssue, type CrawlPage } from "@/lib/api-client";
import { useSearchParams } from "next/navigation";
import { useCrawlHistory, useCrawlIssues, useCrawlPages, useLatestCrawl, usePortfolio, useWorkspace } from "@/hooks/use-growthx";
import { QueryState } from "@/components/ui/query-state";

type TabId = "overview" | "technical-seo" | "performance" | "pages";

const SEVERITIES = ["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const;
type Severity = (typeof SEVERITIES)[number];

const SEVERITY_TONE: Record<Severity, "bad" | "warn" | "info" | "default"> = {
  CRITICAL: "bad",
  HIGH: "warn",
  MEDIUM: "info",
  LOW: "default",
};

/** The bar colour for each severity, so the breakdown reads at a glance. */
const SEVERITY_BAR: Record<Severity, string> = {
  CRITICAL: "var(--color-error-600)",
  HIGH: "var(--color-warning-600)",
  MEDIUM: "var(--color-accent-600)",
  LOW: "var(--color-brand-300)",
};

function WebsiteClient() {
  const searchParams = useSearchParams();
  const queryDomain = searchParams.get("domain");

  const { orgId, projectId } = useWorkspace();
  const portfolio = usePortfolio(orgId);

  // Plain derivation over a handful of clients; memoising it only hid the
  // dependency list from the compiler.
  const clients = portfolio.data?.clients ?? [];
  const client =
    (queryDomain ? clients.find((c) => c.domain === queryDomain) : null) ??
    clients.find((c) => c.projectId === projectId) ??
    clients[0] ??
    null;

  const crawl = useLatestCrawl(client?.domain ?? null);
  const issues = useCrawlIssues(crawl.data?.id ?? null, undefined, crawl.data?.status);
  const pages = useCrawlPages(crawl.data?.id ?? null, crawl.data?.status);
  const history = useCrawlHistory(client?.domain ?? null, 12);

  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [crawling, setCrawling] = useState(false);

  const allIssues = issues.data?.data ?? [];
  const allPages = pages.data?.data ?? [];

  // Everything below is derived from rows this page already loaded. The tiles
  // used to show a bare count each and drop the rest on the floor. Plain
  // expressions rather than useMemo: these are single passes over a few hundred
  // rows, and memoising them here only defeats the compiler's own analysis.
  const severityCounts = allIssues.reduce<Record<string, number>>(
    (counts, issue: CrawlIssue) => {
      counts[issue.severity] = (counts[issue.severity] ?? 0) + 1;
      return counts;
    },
    { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 },
  );

  const brokenPages = allPages.filter((p: CrawlPage) => p.statusCode >= 400).length;

  // Real completed runs only, oldest first — the endpoint filters and orders
  // them, so a flat or missing line here means the history is genuinely thin.
  const runs = history.data ?? [];
  const pagesTrend = runs.map((r) => r.pagesCrawled);
  const issuesTrend = runs.map((r) => r.issuesFound);

  const crawlDuration = (() => {
    if (!crawl.data?.startedAt || !crawl.data?.finishedAt) return null;
    const ms = new Date(crawl.data.finishedAt).getTime() - new Date(crawl.data.startedAt).getTime();
    if (!Number.isFinite(ms) || ms <= 0) return null;
    const mins = Math.round(ms / 60000);
    return mins >= 1 ? `${mins} min` : `${Math.round(ms / 1000)}s`;
  })();

  const statusTone = (status?: string): "good" | "warn" | "bad" | "default" =>
    status === "COMPLETED" ? "good" : status === "FAILED" ? "bad" : status ? "warn" : "default";

  async function runCrawl() {
    if (!client?.domain) return;
    setCrawling(true);
    try {
      await api.startCrawl({ domain: client.domain, maxDepth: 20, maxConcurrency: 10, useSitemap: true });
      setTimeout(() => crawl.refetch(), 3000);
    } finally {
      setCrawling(false);
    }
  }

  const scanButton = (
    <ActionButton
      variant="primary"
      icon={crawling ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
      onClick={runCrawl}
      disabled={crawling || !client?.domain}
    >
      {crawling ? "Starting…" : "Run full scan"}
    </ActionButton>
  );

  const tabs: { id: TabId; label: string; tag?: string; icon?: React.ElementType }[] = [
    { id: "overview", label: "Overview", icon: LayoutGrid },
    { id: "technical-seo", label: "Technical SEO", icon: Zap, tag: allIssues.length ? String(allIssues.length) : undefined },
    { id: "performance", label: "Performance", icon: Activity },
    { id: "pages", label: "Pages", icon: Layout, tag: allPages.length ? String(allPages.length) : undefined },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Website"
        subtitle={
          crawl.data
            ? `${(crawl.data.pagesCrawled ?? 0).toLocaleString()} URLs · crawl ${relativeTime(crawl.data.finishedAt)}`
            : client?.domain
              ? `${client.domain} · not crawled yet`
              : "Select a client with a website"
        }
        actions={scanButton}
      />

      <QueryState
        isLoading={portfolio.isLoading || crawl.isLoading}
        error={portfolio.error}
        isEmpty={!client?.domain}
        emptyTitle="No website registered"
        emptyBody="This workspace has no client with a website attached yet. Add one from Projects, then run a full scan to populate the audit."
      >
        {/* Site banner — the one place that answers "which site, how healthy,
            how fresh" without the reader assembling it from four tiles. */}
        <SiteBanner
          domain={client?.domain ?? ""}
          health={client?.health ?? null}
          status={crawl.data?.status}
          statusTone={statusTone(crawl.data?.status)}
          finishedAt={crawl.data?.finishedAt}
          duration={crawlDuration}
          criticalCount={severityCounts.CRITICAL}
        />

        <Tabs tabs={tabs} active={activeTab} onChange={setActiveTab} />

        <div className="flex flex-col gap-4">
          {activeTab === "overview" && (
            <>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Kpi
                  label="Pages Crawled"
                  value={(crawl.data?.pagesCrawled ?? 0).toLocaleString()}
                  trend={pagesTrend}
                  delta={runs.length >= 2 ? runs[runs.length - 1].pagesCrawled - runs[runs.length - 2].pagesCrawled : null}
                  deltaSuffix=" since last crawl"
                  sub={
                    brokenPages > 0
                      ? `${brokenPages.toLocaleString()} returned an error`
                      : allPages.length > 0
                        ? "All reachable"
                        : undefined
                  }
                />
                <Kpi
                  label="Issues Found"
                  value={(crawl.data?.issuesFound ?? 0).toLocaleString()}
                  tone={severityCounts.CRITICAL > 0 ? "danger" : "default"}
                  trend={issuesTrend}
                  delta={runs.length >= 2 ? runs[runs.length - 1].issuesFound - runs[runs.length - 2].issuesFound : null}
                  deltaGood="down"
                  deltaSuffix=" since last crawl"
                  sub={
                    allIssues.length > 0
                      ? `${severityCounts.CRITICAL} critical · ${severityCounts.HIGH} high · ${severityCounts.MEDIUM} medium`
                      : undefined
                  }
                />
                {/* A health of 0 rendered as "0" reads as a broken tile rather
                    than an unmeasured one, so an absent score stays an em dash
                    and only a real score draws the meter. */}
                <Kpi
                  label="Avg Health"
                  value={client?.health != null ? String(client.health) : "—"}
                  tone={client?.health != null && client.health < 50 ? "danger" : "default"}
                  meter={client?.health ?? null}
                  sub={client?.health == null ? "Not measured yet" : "out of 100"}
                />
                <Kpi
                  label="Status"
                  value={crawl.data?.finishedAt ? relativeTime(crawl.data.finishedAt) : "—"}
                  aside={crawl.data?.status ? <Pill tone={statusTone(crawl.data.status)}>{crawl.data.status}</Pill> : null}
                  sub={crawlDuration ? `Took ${crawlDuration}` : undefined}
                />
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <Panel title="Issues by severity" subtitle={`${allIssues.length} open across the last crawl`} padded>
                  {allIssues.length === 0 ? (
                    <EmptyNote>No issues in the latest crawl.</EmptyNote>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {SEVERITIES.map((severity) => (
                        <SeverityRow
                          key={severity}
                          severity={severity}
                          count={severityCounts[severity] ?? 0}
                          total={allIssues.length}
                        />
                      ))}
                    </div>
                  )}
                </Panel>

                <Panel title="Crawl history" subtitle={runs.length ? `Last ${runs.length} completed runs` : "No completed runs yet"} padded>
                  {runs.length < 2 ? (
                    <EmptyNote>Two completed crawls are needed before a trend means anything.</EmptyNote>
                  ) : (
                    <div className="flex flex-col gap-4">
                      <TrendRow label="Pages crawled" values={pagesTrend} />
                      <TrendRow label="Issues found" values={issuesTrend} />
                    </div>
                  )}
                </Panel>
              </div>
            </>
          )}

          {activeTab === "technical-seo" && (
            <Panel
              title="Technical SEO Issues"
              subtitle={`${allIssues.length} issues identified`}
              actions={
                severityCounts.CRITICAL > 0 ? <Pill tone="bad">{severityCounts.CRITICAL} critical</Pill> : null
              }
            >
              {allIssues.length === 0 ? (
                <EmptyNote>No issues found.</EmptyNote>
              ) : (
                <Table>
                  <thead>
                    <tr>
                      <Th>Severity</Th>
                      <Th>Issue</Th>
                      <Th>URL</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {allIssues.map((issue: CrawlIssue) => (
                      <Tr key={issue.id}>
                        <Td>
                          <Pill tone={SEVERITY_TONE[issue.severity as Severity] ?? "default"}>{issue.severity}</Pill>
                        </Td>
                        <Td>
                          <span className="text-[12.5px] font-medium text-brand-950">{issue.issueType}</span>
                          <span className="block max-w-xs text-[11px] text-brand-500">{issue.description}</span>
                        </Td>
                        <Td>
                          <Mono tone="soft">{shorten(issue.affectedUrl)}</Mono>
                        </Td>
                      </Tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </Panel>
          )}

          {activeTab === "performance" && (
            <Panel title="Performance Metrics" subtitle="Core Web Vitals from the Performance Engine">
              {allPages.length === 0 ? (
                <EmptyNote>No performance data available.</EmptyNote>
              ) : (
                <Table>
                  <thead>
                    <tr>
                      <Th>URL</Th>
                      <Th>Score</Th>
                      <Th>LCP</Th>
                      <Th>INP</Th>
                      <Th>CLS</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {allPages.map((page: CrawlPage) => (
                      <Tr key={page.id}>
                        <Td>
                          <Mono tone="soft">{shorten(page.url)}</Mono>
                        </Td>
                        <Td>
                          {page.performance?.performanceScore ? (
                            <Pill tone={page.performance.performanceScore >= 90 ? "good" : page.performance.performanceScore >= 50 ? "warn" : "bad"}>
                              {page.performance.performanceScore.toFixed(0)}
                            </Pill>
                          ) : "—"}
                        </Td>
                        <Td>{page.performance?.lcpMs ? `${(page.performance.lcpMs / 1000).toFixed(2)}s` : "—"}</Td>
                        <Td>{page.performance?.inpMs ? `${page.performance.inpMs}ms` : "—"}</Td>
                        <Td>{page.performance?.clsScore ? page.performance.clsScore.toFixed(3) : "—"}</Td>
                      </Tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </Panel>
          )}

          {activeTab === "pages" && (
            <Panel
              title="Crawled Pages"
              subtitle={`${allPages.length} pages indexed`}
              actions={brokenPages > 0 ? <Pill tone="bad">{brokenPages} broken</Pill> : null}
            >
              {allPages.length === 0 ? (
                <EmptyNote>No pages crawled yet.</EmptyNote>
              ) : (
                <Table>
                  <thead>
                    <tr>
                      <Th>Status</Th>
                      <Th>URL</Th>
                      <Th>Title</Th>
                      <Th align="right">Word Count</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {allPages.map((page: CrawlPage) => (
                      <Tr key={page.id}>
                        <Td>
                          <Pill tone={page.statusCode === 200 ? "good" : page.statusCode >= 400 ? "bad" : "warn"}>
                            {page.statusCode}
                          </Pill>
                        </Td>
                        <Td>
                          <Mono tone="soft">{shorten(page.url)}</Mono>
                        </Td>
                        <Td>
                          <span className="text-[12px] text-brand-700 max-w-xs block truncate" title={page.title || ""}>
                            {page.title || "—"}
                          </span>
                        </Td>
                        <Td align="right">
                          <Mono>{page.wordCount.toLocaleString()}</Mono>
                        </Td>
                      </Tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </Panel>
          )}
        </div>
      </QueryState>
    </div>
  );
}

/**
 * Identity strip for the audited site: which domain, its health, and how fresh
 * the numbers underneath it are.
 */
function SiteBanner({
  domain,
  health,
  status,
  statusTone,
  finishedAt,
  duration,
  criticalCount,
}: {
  domain: string;
  health: number | null;
  status?: string;
  statusTone: "good" | "warn" | "bad" | "default";
  finishedAt?: string | null;
  duration: string | null;
  criticalCount: number;
}) {
  return (
    <div className="flex flex-col gap-4 rounded-xl border bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-950 font-mono text-[11px] font-semibold text-white">
          {domain.replace(/^www\./, "").slice(0, 2).toUpperCase() || "—"}
        </span>
        <div className="min-w-0">
          <p className="truncate font-mono text-[13px] font-semibold text-brand-950">{domain || "—"}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-brand-500">
            {status && <Pill tone={statusTone}>{status}</Pill>}
            <span>Last crawl {relativeTime(finishedAt)}</span>
            {duration && <span className="text-brand-400">· took {duration}</span>}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-6 sm:shrink-0">
        {criticalCount > 0 && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.07em] text-brand-400">Critical</p>
            <p className="mt-0.5 font-mono text-[18px] font-bold text-error-600">{criticalCount}</p>
          </div>
        )}
        <div className="w-[132px]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.07em] text-brand-400">Site health</p>
          <div className="mt-1 flex items-center gap-2">
            <span className="font-mono text-[18px] font-bold tracking-[-0.02em] text-brand-950">
              {health != null ? health : "—"}
            </span>
            <div className="flex-1">
              {health != null ? (
                <MeterBar value={health} tone={health >= 70 ? "good" : "accent"} width="100%" />
              ) : (
                <span className="text-[11px] text-brand-400">not measured</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SeverityRow({ severity, count, total }: { severity: Severity; count: number; total: number }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-[70px] shrink-0 text-[11px] font-semibold uppercase tracking-[0.06em] text-brand-500">
        {severity}
      </span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-brand-100">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: SEVERITY_BAR[severity] }} />
      </div>
      <span className="w-9 shrink-0 text-right font-mono text-[12px] font-semibold text-brand-950">{count}</span>
    </div>
  );
}

function TrendRow({ label, values }: { label: string; values: number[] }) {
  const latest = values[values.length - 1];
  const first = values[0];
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.07em] text-brand-400">{label}</p>
        <p className="mt-0.5 font-mono text-[16px] font-bold text-brand-950">{latest.toLocaleString()}</p>
      </div>
      <div className="flex items-center gap-3">
        <span className="font-mono text-[11px] text-brand-400">
          from {first.toLocaleString()}
        </span>
        <Sparkline values={values} width={120} height={28} />
      </div>
    </div>
  );
}

function EmptyNote({ children }: { children: React.ReactNode }) {
  return <p className="px-4 py-10 text-center text-[12px] text-brand-400">{children}</p>;
}

export default function WebsitePage() {
  return (
    <Suspense fallback={<div className="flex h-32 items-center justify-center text-sm text-brand-500"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading website…</div>}>
      <WebsiteClient />
    </Suspense>
  );
}

function shorten(url: string): string {
  try {
    const { pathname } = new URL(url);
    return pathname.length > 44 ? `${pathname.slice(0, 44)}…` : pathname || "/";
  } catch {
    return url.slice(0, 44);
  }
}
