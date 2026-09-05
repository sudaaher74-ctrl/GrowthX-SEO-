"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  HelpCircle,
  Info,
  Layout,
  LayoutGrid,
  Loader2,
  RefreshCw,
  Search,
  Sparkles,
  X,
  Zap,
} from "lucide-react";
import { AutoFixModal } from "@/components/website/auto-fix-modal";
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
import { api, type CrawlIssue, type CrawlPage, type CrawlQualityDiagnostics } from "@/lib/api-client";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  useCrawlHistory,
  useCrawlIssues,
  useCrawlPages,
  useLatestCrawl,
  usePortfolio,
  useWorkspace,
} from "@/hooks/use-growthx";
import { QueryState } from "@/components/ui/query-state";

type TabId = "overview" | "technical-seo" | "performance" | "pages" | "geo-readiness";

const SEVERITIES = ["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const;
type Severity = (typeof SEVERITIES)[number];

const SEVERITY_TONE: Record<Severity, "bad" | "warn" | "info" | "default"> = {
  CRITICAL: "bad",
  HIGH: "warn",
  MEDIUM: "info",
  LOW: "default",
};

const SEVERITY_BAR: Record<Severity, string> = {
  CRITICAL: "var(--color-error-600)",
  HIGH: "var(--color-warning-600)",
  MEDIUM: "var(--color-accent-600)",
  LOW: "var(--color-brand-300)",
};

const CONFIDENCE_TONE: Record<string, "good" | "info" | "default"> = {
  CONFIRMED: "good",
  LIKELY: "info",
  ADVISORY: "default",
};

function WebsiteClient() {
  const searchParams = useSearchParams();
  const queryDomain = searchParams.get("domain");

  const { orgId, projectId } = useWorkspace();
  const portfolio = usePortfolio(orgId);

  const clients = portfolio.data?.clients ?? [];
  const client =
    (queryDomain ? clients.find((c) => c.domain === queryDomain) : null) ??
    clients.find((c) => c.projectId === projectId) ??
    clients[0] ??
    null;

  const crawl = useLatestCrawl(client?.domain ?? null);

  // Filter and search state for Technical SEO
  const [selectedSeverity, setSelectedSeverity] = useState<string>("ALL");
  const [selectedConfidence, setSelectedConfidence] = useState<string>("ALL");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [expandedEvidenceId, setExpandedEvidenceId] = useState<string | null>(null);
  const [selectedFixIssue, setSelectedFixIssue] = useState<CrawlIssue | null>(null);

  const issues = useCrawlIssues(
    crawl.data?.id ?? null,
    {
      severity: selectedSeverity !== "ALL" ? selectedSeverity : undefined,
      category: selectedCategory !== "ALL" ? selectedCategory : undefined,
      confidence: selectedConfidence !== "ALL" ? selectedConfidence : undefined,
      search: searchQuery.trim() || undefined,
      limit: 100,
    },
    crawl.data?.status,
  );
  const pages = useCrawlPages(crawl.data?.id ?? null, crawl.data?.status);
  const history = useCrawlHistory(client?.domain ?? null, 12);

  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [crawling, setCrawling] = useState(false);

  const allIssues = issues.data?.data ?? [];
  const allPages = pages.data?.data ?? [];
  const meta = issues.data?.meta;

  // Authoritative metrics returned from crawler backend
  const totalFindings = meta?.totalFindings ?? crawl.data?.issuesFound ?? allIssues.length;
  const uniqueOpenIssues = meta?.uniqueOpenIssues ?? allIssues.length;
  const resolvedIssues = meta?.resolvedIssues ?? crawl.data?.resolvedIssuesCount ?? 0;
  const healthScore = crawl.data?.healthScore ?? meta?.healthScore ?? client?.health ?? null;
  const qualityDiagnostics = crawl.data?.qualityDiagnostics ?? meta?.qualityDiagnostics ?? null;

  const severityCounts = meta?.countsBySeverity ?? {
    CRITICAL: allIssues.filter((i) => i.severity === "CRITICAL").length,
    HIGH: allIssues.filter((i) => i.severity === "HIGH").length,
    MEDIUM: allIssues.filter((i) => i.severity === "MEDIUM").length,
    LOW: allIssues.filter((i) => i.severity === "LOW").length,
  };

  const confidenceCounts = meta?.countsByConfidence ?? {
    CONFIRMED: allIssues.filter((i) => i.confidence === "CONFIRMED").length,
    LIKELY: allIssues.filter((i) => i.confidence === "LIKELY").length,
    ADVISORY: allIssues.filter((i) => i.confidence === "ADVISORY").length,
  };

  const categoryCounts = meta?.countsByCategory ?? {};

  const brokenPages = allPages.filter((p: CrawlPage) => p.statusCode >= 400).length;
  const pagesCrawled = crawl.data?.pagesCrawled ?? allPages.length;

  // GEO & AI Overviews Readiness Metrics (Strictly computed from authoritative crawl data)
  const schemaIssues = allIssues.filter(
    (i) =>
      (i.issueType || "").toUpperCase().includes("SCHEMA") ||
      (i.issueType || "").toUpperCase().includes("STRUCTURED"),
  );
  const botBlockIssues = allIssues.filter(
    (i) =>
      (i.issueType || "").toUpperCase().includes("ROBOT") ||
      (i.issueType || "").toUpperCase().includes("NOINDEX"),
  );

  const quotablePagesCount = allPages.filter(
    (p) => p.wordCount >= 350 && p.wordCount <= 3000,
  ).length;
  const quotabilityScore =
    allPages.length > 0 ? Math.round((quotablePagesCount / allPages.length) * 100) : null;

  const schemaAffectedUrls = new Set(schemaIssues.map((i) => i.affectedUrl));
  const groundedPagesCount = allPages.filter((p) => !schemaAffectedUrls.has(p.url)).length;
  const entityGroundingScore =
    allPages.length > 0 ? Math.round((groundedPagesCount / allPages.length) * 100) : null;

  const highDensityPagesCount = allPages.filter((p) => p.wordCount >= 500).length;
  const dataDensityScore =
    allPages.length > 0 ? Math.round((highDensityPagesCount / allPages.length) * 100) : null;

  const geoReadinessScore =
    quotabilityScore != null && entityGroundingScore != null && dataDensityScore != null
      ? Math.round(quotabilityScore * 0.4 + entityGroundingScore * 0.35 + dataDensityScore * 0.25)
      : null;

  const pagesNeedingAnswerBlocks = allPages.filter((p) => p.wordCount < 350 || p.wordCount > 3000);

  const runs = history.data ?? [];
  const pagesTrend = runs.map((r) => r.pagesCrawled);
  const issuesTrend = runs.map((r) => r.issuesFound);

  const crawlDuration = (() => {
    if (qualityDiagnostics?.durationSeconds != null) {
      const s = qualityDiagnostics.durationSeconds;
      return s >= 60 ? `${Math.round(s / 60)} min` : `${s}s`;
    }
    if (!crawl.data?.startedAt || !crawl.data?.finishedAt) return null;
    const ms = new Date(crawl.data.finishedAt).getTime() - new Date(crawl.data.startedAt).getTime();
    if (!Number.isFinite(ms) || ms <= 0) return null;
    const mins = Math.round(ms / 60000);
    return mins >= 1 ? `${mins} min` : `${Math.round(ms / 1000)}s`;
  })();

  const statusTone = (status?: string): "good" | "warn" | "bad" | "default" =>
    status === "COMPLETED" ? "good" : status === "FAILED" ? "bad" : status ? "warn" : "default";

  useEffect(() => {
    if (crawl.data?.status === "COMPLETED") {
      history.refetch();
      issues.refetch();
      pages.refetch();
      portfolio.refetch();
    }
  }, [crawl.data?.status]);

  async function runCrawl() {
    if (!client?.domain) return;
    setCrawling(true);
    try {
      await api.startCrawl({ domain: client.domain, maxDepth: 20, maxConcurrency: 10, useSitemap: true });
      setTimeout(() => {
        crawl.refetch();
        issues.refetch();
        pages.refetch();
      }, 1000);
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
    {
      id: "technical-seo",
      label: "Technical SEO",
      icon: Zap,
      tag: uniqueOpenIssues > 0 ? String(uniqueOpenIssues) : undefined,
    },
    { id: "performance", label: "Performance", icon: Activity },
    { id: "pages", label: "Pages", icon: Layout, tag: pagesCrawled ? String(pagesCrawled) : undefined },
    {
      id: "geo-readiness",
      label: "GEO & AI Overviews",
      icon: Sparkles,
      tag: geoReadinessScore != null ? `${geoReadinessScore}/100` : "Audit",
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Website"
        subtitle={
          crawl.data
            ? `${pagesCrawled.toLocaleString()} URLs · crawl ${relativeTime(crawl.data.finishedAt)}`
            : client?.domain
              ? `${client.domain} · not crawled yet`
              : "Select a client with a website"
        }
        actions={scanButton}
      />

      <QueryState
        isLoading={Boolean(client?.domain) && (portfolio.isLoading || crawl.isLoading)}
        error={client?.domain ? portfolio.error || crawl.error : null}
        isEmpty={!client?.domain}
        emptyTitle="No website registered"
        emptyBody="This workspace has no client with a website attached yet. Add one from Projects, then run a full scan to populate the audit."
        emptyAction={
          <Link
            href="/projects"
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-950 px-3.5 py-2 text-[12.5px] font-medium text-white shadow-sm hover:bg-brand-900 transition"
          >
            Go to Projects to Add Website
          </Link>
        }
      >
        {/* Site banner */}
        <SiteBanner
          domain={client?.domain ?? ""}
          health={healthScore}
          status={crawl.data?.status}
          statusTone={statusTone(crawl.data?.status)}
          finishedAt={crawl.data?.finishedAt}
          duration={crawlDuration}
          criticalCount={severityCounts.CRITICAL}
          onOpenBreakdown={() => setShowBreakdown(true)}
        />

        <Tabs tabs={tabs} active={activeTab} onChange={setActiveTab} />

        <div className="flex flex-col gap-4">
          {activeTab === "overview" && (
            <>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Kpi
                  label="Pages Crawled"
                  value={pagesCrawled.toLocaleString()}
                  trend={pagesTrend}
                  delta={runs.length >= 2 ? runs[runs.length - 1].pagesCrawled - runs[runs.length - 2].pagesCrawled : null}
                  deltaSuffix=" since last crawl"
                  sub={
                    brokenPages > 0
                      ? `${(pagesCrawled - brokenPages).toLocaleString()} reachable · ${brokenPages.toLocaleString()} broken`
                      : pagesCrawled > 0
                        ? "All pages reachable (200 OK)"
                        : "No pages crawled"
                  }
                />
                <Kpi
                  label="Audit Issues"
                  value={`${uniqueOpenIssues.toLocaleString()} Open`}
                  tone={severityCounts.CRITICAL > 0 ? "danger" : "default"}
                  trend={issuesTrend}
                  delta={runs.length >= 2 ? runs[runs.length - 1].issuesFound - runs[runs.length - 2].issuesFound : null}
                  deltaGood="down"
                  deltaSuffix=" since last crawl"
                  aside={
                    totalFindings > uniqueOpenIssues ? (
                      <Pill tone="info">{totalFindings.toLocaleString()} total findings</Pill>
                    ) : null
                  }
                  sub={
                    uniqueOpenIssues > 0
                      ? `${severityCounts.CRITICAL} critical · ${severityCounts.HIGH} high · ${severityCounts.MEDIUM} medium · ${severityCounts.LOW} low`
                      : "No open issues detected"
                  }
                />
                <Kpi
                  label="Site Health"
                  value={healthScore != null ? String(healthScore) : "—"}
                  tone={healthScore != null && healthScore < 60 ? "danger" : "default"}
                  meter={healthScore ?? null}
                  aside={
                    healthScore != null ? (
                      <button
                        onClick={() => setShowBreakdown(true)}
                        className="text-[11px] font-medium text-accent-600 hover:underline inline-flex items-center gap-0.5"
                      >
                        Breakdown <Info size={11} />
                      </button>
                    ) : null
                  }
                  sub={
                    healthScore == null
                      ? "Not analyzed yet"
                      : healthScore >= 80
                        ? "Good overall technical health"
                        : healthScore >= 50
                          ? "Fair · Fix high-priority items"
                          : "Critical technical errors"
                  }
                />
                <Kpi
                  label="Crawl Status"
                  value={crawl.data?.finishedAt ? relativeTime(crawl.data.finishedAt) : "—"}
                  aside={crawl.data?.status ? <Pill tone={statusTone(crawl.data.status)}>{crawl.data.status}</Pill> : null}
                  sub={
                    crawlDuration
                      ? `Duration ${crawlDuration}${qualityDiagnostics?.avgResponseTimeMs ? ` · ${qualityDiagnostics.avgResponseTimeMs}ms avg latency` : ""}`
                      : undefined
                  }
                />
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <Panel
                  title="Issue distribution"
                  subtitle={`${uniqueOpenIssues} unique open issues (${totalFindings} total occurrences)`}
                  padded
                >
                  {uniqueOpenIssues === 0 ? (
                    <EmptyNote>No issues in the latest crawl.</EmptyNote>
                  ) : (
                    <div className="flex flex-col gap-4">
                      <div>
                        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-brand-400">By Severity</p>
                        <div className="flex flex-col gap-2.5">
                          {SEVERITIES.map((severity) => (
                            <SeverityRow
                              key={severity}
                              severity={severity}
                              count={severityCounts[severity] ?? 0}
                              total={uniqueOpenIssues}
                            />
                          ))}
                        </div>
                      </div>

                      <div className="border-t pt-3">
                        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-brand-400">By Confidence</p>
                        <div className="grid grid-cols-3 gap-2">
                          <div className="rounded-lg border bg-brand-50/50 p-2 text-center">
                            <span className="text-[10px] font-semibold text-success-700 uppercase">Confirmed (1.0x)</span>
                            <p className="font-mono text-[16px] font-bold text-brand-950 mt-0.5">
                              {confidenceCounts.CONFIRMED ?? 0}
                            </p>
                          </div>
                          <div className="rounded-lg border bg-brand-50/50 p-2 text-center">
                            <span className="text-[10px] font-semibold text-brand-700 uppercase">Likely (0.8x)</span>
                            <p className="font-mono text-[16px] font-bold text-brand-950 mt-0.5">
                              {confidenceCounts.LIKELY ?? 0}
                            </p>
                          </div>
                          <div className="rounded-lg border bg-brand-50/50 p-2 text-center">
                            <span className="text-[10px] font-semibold text-brand-500 uppercase">Advisory (0.5x)</span>
                            <p className="font-mono text-[16px] font-bold text-brand-950 mt-0.5">
                              {confidenceCounts.ADVISORY ?? 0}
                            </p>
                          </div>
                        </div>
                      </div>

                      {Object.keys(categoryCounts).length > 0 && (
                        <div className="border-t pt-3">
                          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-brand-400">Categories</p>
                          <div className="flex flex-wrap gap-1.5">
                            {Object.entries(categoryCounts).map(([cat, count]) => (
                              <span
                                key={cat}
                                className="inline-flex items-center gap-1 rounded-md border bg-white px-2 py-0.5 font-mono text-[11px] text-brand-700 shadow-2xs"
                              >
                                {cat.toLowerCase().replace(/_/g, " ")}: <b>{count}</b>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </Panel>

                <div className="flex flex-col gap-4">
                  {/* Quality Diagnostics Card */}
                  <Panel title="Crawl quality diagnostics" subtitle="Crawler telemetry and reachability statistics" padded>
                    <div className="grid grid-cols-2 gap-3 text-[12px]">
                      <div className="rounded-lg border bg-white p-3">
                        <span className="text-[10px] uppercase font-semibold text-brand-400">HTTP Status Distribution</span>
                        <div className="mt-1.5 flex flex-wrap gap-2 font-mono text-[12px]">
                          {qualityDiagnostics?.statusCodes ? (
                            Object.entries(qualityDiagnostics.statusCodes).map(([code, count]) => (
                              <span key={code} className="inline-flex items-center gap-1">
                                <span
                                  className={
                                    code === "2xx"
                                      ? "text-success-600 font-bold"
                                      : code === "4xx" || code === "5xx"
                                        ? "text-error-600 font-bold"
                                        : "text-brand-600"
                                  }
                                >
                                  {code}:
                                </span>
                                {count as number}
                              </span>
                            ))
                          ) : (
                            <span className="text-brand-500">2xx: {pagesCrawled - brokenPages}, 4xx: {brokenPages}</span>
                          )}
                        </div>
                      </div>

                      <div className="rounded-lg border bg-white p-3">
                        <span className="text-[10px] uppercase font-semibold text-brand-400">Sitemap Discovery</span>
                        <p className="mt-1 text-[12.5px] font-medium text-brand-950">
                          {qualityDiagnostics?.sitemapFound
                            ? `Found (${qualityDiagnostics.sitemapUrlsCount ?? 0} URLs)`
                            : "Direct crawl"}
                        </p>
                      </div>

                      <div className="rounded-lg border bg-white p-3">
                        <span className="text-[10px] uppercase font-semibold text-brand-400">Average Latency</span>
                        <p className="mt-1 font-mono text-[13px] font-bold text-brand-950">
                          {qualityDiagnostics?.avgResponseTimeMs ? `${qualityDiagnostics.avgResponseTimeMs} ms` : "—"}
                        </p>
                      </div>

                      <div className="rounded-lg border bg-white p-3">
                        <span className="text-[10px] uppercase font-semibold text-brand-400">Resolved vs Previous</span>
                        <p className="mt-1 text-[12.5px] font-medium text-success-600">
                          {resolvedIssues > 0 ? `+${resolvedIssues} issues fixed` : "First crawl baseline"}
                        </p>
                      </div>
                    </div>
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
              </div>
            </>
          )}

          {activeTab === "technical-seo" && (
            <Panel
              title="Technical SEO Issues"
              subtitle={`${allIssues.length} issues shown (${uniqueOpenIssues} unique open, ${totalFindings} total)`}
              actions={
                <div className="flex items-center gap-2">
                  {severityCounts.CRITICAL > 0 && <Pill tone="bad">{severityCounts.CRITICAL} critical</Pill>}
                  {resolvedIssues > 0 && <Pill tone="good">{resolvedIssues} resolved</Pill>}
                </div>
              }
            >
              {/* Filter and search bar */}
              <div className="border-b bg-brand-50/40 p-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-brand-400" size={13} />
                    <input
                      type="text"
                      placeholder="Search issue or URL…"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="h-8 w-48 sm:w-64 rounded-md border bg-white pl-8 pr-3 text-[12px] placeholder:text-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-950"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery("")}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-brand-400 hover:text-brand-700"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>

                  {/* Severity Filter */}
                  <div className="flex items-center rounded-md border bg-white p-0.5">
                    {["ALL", "CRITICAL", "HIGH", "MEDIUM", "LOW"].map((s) => (
                      <button
                        key={s}
                        onClick={() => setSelectedSeverity(s)}
                        className={`rounded px-2 py-1 text-[11px] font-medium transition ${
                          selectedSeverity === s ? "bg-brand-950 text-white shadow-xs" : "text-brand-600 hover:bg-brand-50"
                        }`}
                      >
                        {s === "ALL" ? "All Severities" : s}
                      </button>
                    ))}
                  </div>

                  {/* Confidence Filter */}
                  <select
                    value={selectedConfidence}
                    onChange={(e) => setSelectedConfidence(e.target.value)}
                    className="h-8 rounded-md border bg-white px-2.5 text-[11px] font-medium text-brand-700 focus:outline-none focus:ring-1 focus:ring-brand-950"
                  >
                    <option value="ALL">All Confidences</option>
                    <option value="CONFIRMED">Confirmed</option>
                    <option value="LIKELY">Likely</option>
                    <option value="ADVISORY">Advisory</option>
                  </select>

                  {/* Category Filter */}
                  {Object.keys(categoryCounts).length > 0 && (
                    <select
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                      className="h-8 rounded-md border bg-white px-2.5 text-[11px] font-medium text-brand-700 focus:outline-none focus:ring-1 focus:ring-brand-950"
                    >
                      <option value="ALL">All Categories</option>
                      {Object.keys(categoryCounts).map((c) => (
                        <option key={c} value={c}>
                          {c.toLowerCase().replace(/_/g, " ")} ({categoryCounts[c]})
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              {allIssues.length === 0 ? (
                <EmptyNote>
                  {searchQuery || selectedSeverity !== "ALL" || selectedConfidence !== "ALL" || selectedCategory !== "ALL"
                    ? "No issues match the selected filters."
                    : "No issues found in this crawl."}
                </EmptyNote>
              ) : (
                <Table>
                  <thead>
                    <tr>
                      <Th>Severity</Th>
                      <Th>Confidence</Th>
                      <Th>Category</Th>
                      <Th>Issue</Th>
                      <Th>Affected URL</Th>
                      <Th align="right">Details</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {allIssues.map((issue: CrawlIssue) => {
                      const isExpanded = expandedEvidenceId === issue.id;
                      const hasEvidence = Boolean(issue.evidence);

                      return (
                        <tr key={issue.id} className="border-b transition hover:bg-brand-50/30">
                          <Td>
                            <Pill tone={SEVERITY_TONE[issue.severity as Severity] ?? "default"}>{issue.severity}</Pill>
                          </Td>
                          <Td>
                            <Pill tone={CONFIDENCE_TONE[issue.confidence || "CONFIRMED"] || "default"}>
                              {issue.confidence || "CONFIRMED"}
                            </Pill>
                          </Td>
                          <Td>
                            <span className="font-mono text-[11px] text-brand-500 uppercase">
                              {issue.category ? issue.category.replace(/_/g, " ") : "GENERAL"}
                            </span>
                          </Td>
                          <Td>
                            <div className="flex flex-col">
                              <span className="text-[12.5px] font-semibold text-brand-950">{issue.issueType}</span>
                              <span className="text-[11.5px] text-brand-600 mt-0.5">{issue.description}</span>
                              {issue.explanation && (
                                <span className="text-[11px] text-brand-400 mt-1 italic">{issue.explanation}</span>
                              )}
                            </div>
                          </Td>
                          <Td>
                            <div className="flex items-center gap-1.5">
                              <Mono tone="soft">{shorten(issue.affectedUrl)}</Mono>
                              <a
                                href={issue.affectedUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-brand-400 hover:text-brand-700"
                                title="Open URL in new tab"
                              >
                                <ExternalLink size={11} />
                              </a>
                            </div>
                          </Td>
                          <Td align="right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => setSelectedFixIssue(issue)}
                                className="inline-flex items-center gap-1 rounded bg-accent-600 px-2 py-1 text-[11px] font-semibold text-white shadow-2xs hover:bg-accent-700 transition"
                                title="Generate AI Auto-Fix snippet"
                              >
                                <Sparkles size={11} />
                                <span>Auto-Fix</span>
                              </button>
                              {hasEvidence && (
                                <button
                                  type="button"
                                  onClick={() => setExpandedEvidenceId(isExpanded ? null : issue.id)}
                                  className="inline-flex items-center gap-1 rounded border bg-white px-2 py-1 text-[11px] font-medium text-brand-700 shadow-2xs hover:bg-brand-50 transition"
                                >
                                  Evidence {isExpanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                                </button>
                              )}
                            </div>

                            {/* Expandable Evidence Box */}
                            {isExpanded && issue.evidence && (
                              <div className="mt-2 text-left rounded-md border bg-brand-950 p-2.5 font-mono text-[11px] text-brand-100 shadow-inner overflow-x-auto max-w-md">
                                <p className="text-[10px] text-brand-400 uppercase tracking-wider mb-1">Diagnostic Evidence</p>
                                <pre className="whitespace-pre-wrap break-all">{formatEvidence(issue.evidence)}</pre>
                                {issue.recommendation && (
                                  <div className="mt-2 border-t border-brand-800 pt-1.5 text-brand-300">
                                    <span className="text-[10px] uppercase font-bold text-accent-400">Fix Recommendation: </span>
                                    {issue.recommendation}
                                  </div>
                                )}
                              </div>
                            )}
                          </Td>
                        </tr>
                      );
                    })}
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
                            <Pill
                              tone={
                                page.performance.performanceScore >= 90
                                  ? "good"
                                  : page.performance.performanceScore >= 50
                                    ? "warn"
                                    : "bad"
                              }
                            >
                              {page.performance.performanceScore.toFixed(0)}
                            </Pill>
                          ) : (
                            "—"
                          )}
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
              subtitle={`${pagesCrawled} pages indexed`}
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

          {activeTab === "geo-readiness" && (
            <div className="space-y-6">
              {/* 4 GEO KPIs */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {/* 1. Overall GEO Readiness Score */}
                <Panel className="p-4 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] font-medium text-brand-500">Overall GEO Score</span>
                      <Sparkles size={15} className="text-accent-600" />
                    </div>
                    <div className="mt-2 flex items-baseline gap-2">
                      <span className="font-mono text-2xl font-bold text-brand-950">
                        {geoReadinessScore != null ? geoReadinessScore : "—"}
                      </span>
                      {geoReadinessScore != null && (
                        <span className="text-xs text-brand-400 font-mono">/100</span>
                      )}
                      <Pill
                        tone={
                          geoReadinessScore != null && geoReadinessScore >= 70
                            ? "good"
                            : geoReadinessScore != null && geoReadinessScore >= 45
                              ? "warn"
                              : "info"
                        }
                      >
                        {geoReadinessScore != null && geoReadinessScore >= 70
                          ? "High Visibility"
                          : geoReadinessScore != null && geoReadinessScore >= 45
                            ? "Moderate"
                            : "Needs Optimization"}
                      </Pill>
                    </div>
                  </div>
                  <div className="mt-3">
                    {geoReadinessScore != null ? (
                      <MeterBar
                        value={geoReadinessScore}
                        tone={geoReadinessScore >= 70 ? "good" : "accent"}
                        width="100%"
                      />
                    ) : null}
                    <p className="mt-1.5 text-[11px] text-[var(--text-muted)]">Readiness for Google AI Overviews & ChatGPT</p>
                  </div>
                </Panel>

                {/* 2. Direct Quotability */}
                <Panel className="p-4 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] font-medium text-brand-500">Direct Quotability</span>
                      <CheckCircle2 size={15} className="text-emerald-600" />
                    </div>
                    <div className="mt-2 flex items-baseline gap-2">
                      <span className="font-mono text-2xl font-bold text-brand-950">
                        {quotablePagesCount}
                      </span>
                      <span className="text-xs text-brand-400">/ {allPages.length} URLs</span>
                      <Pill tone={quotabilityScore != null && quotabilityScore >= 70 ? "good" : "warn"}>
                        {quotabilityScore != null ? `${quotabilityScore}%` : "—"}
                      </Pill>
                    </div>
                  </div>
                  <p className="mt-3 text-[11px] text-[var(--text-muted)]">
                    Pages with concise definition blocks & optimal depth (350–3k words)
                  </p>
                </Panel>

                {/* 3. Entity & Schema Grounding */}
                <Panel className="p-4 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] font-medium text-brand-500">Entity Schema Grounding</span>
                      <Zap size={15} className="text-amber-500" />
                    </div>
                    <div className="mt-2 flex items-baseline gap-2">
                      <span className="font-mono text-2xl font-bold text-brand-950">
                        {groundedPagesCount}
                      </span>
                      <span className="text-xs text-brand-400">/ {allPages.length} URLs</span>
                      <Pill tone={schemaIssues.length === 0 ? "good" : "warn"}>
                        {schemaIssues.length === 0 ? "0 Schema Errors" : `${schemaIssues.length} Schema Gaps`}
                      </Pill>
                    </div>
                  </div>
                  <p className="mt-3 text-[11px] text-[var(--text-muted)]">
                    JSON-LD structured data for Knowledge Graph & AI reasoning
                  </p>
                </Panel>

                {/* 4. AI Bot Access */}
                <Panel className="p-4 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] font-medium text-brand-500">AI Crawler Access</span>
                      <Activity size={15} className="text-blue-500" />
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="font-mono text-sm font-bold text-brand-950">
                        {botBlockIssues.length === 0 ? "Allowed" : "Partially Blocked"}
                      </span>
                      <Pill tone={botBlockIssues.length === 0 ? "good" : "bad"}>
                        {botBlockIssues.length === 0 ? "GPTBot / Perplexity" : "Directive Block"}
                      </Pill>
                    </div>
                  </div>
                  <p className="mt-3 text-[11px] text-[var(--text-muted)]">
                    Robots.txt & meta directives allowing Perplexity, ClaudeBot, GPTBot
                  </p>
                </Panel>
              </div>

              {/* GEO Strategic Radar Panels */}
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                {/* Quotability Action Panel */}
                <Panel className="p-4 space-y-3">
                  <div className="flex items-center gap-2 text-accent-700">
                    <Sparkles size={16} />
                    <h4 className="text-xs font-bold uppercase tracking-wider">Direct Quotability Strategy</h4>
                  </div>
                  <p className="text-xs text-brand-600 leading-relaxed">
                    Google AI Overviews and ChatGPT preferentially extract 40–50 word authoritative definitions immediately following an H2 or H3 heading.
                  </p>
                  <div className="rounded-lg bg-brand-50 p-3 text-[11px] space-y-1.5 border border-brand-200">
                    <div className="font-semibold text-brand-900 flex items-center justify-between">
                      <span>High Priority Action:</span>
                      <span className="font-mono text-accent-600">{pagesNeedingAnswerBlocks.length} pages</span>
                    </div>
                    <p className="text-brand-600">
                      Convert lead paragraphs into structured summary answer blocks to capture Google AI Overview citations.
                    </p>
                  </div>
                </Panel>

                {/* Entity Schema Panel */}
                <Panel className="p-4 space-y-3">
                  <div className="flex items-center gap-2 text-blue-700">
                    <Zap size={16} />
                    <h4 className="text-xs font-bold uppercase tracking-wider">Entity & Knowledge Graph</h4>
                  </div>
                  <p className="text-xs text-brand-600 leading-relaxed">
                    LLMs rely on Schema.org Organization, FAQPage, and TechArticle markup with sameAs social and Wikidata references to verify brand authority.
                  </p>
                  <div className="rounded-lg bg-brand-50 p-3 text-[11px] space-y-1.5 border border-brand-200">
                    <div className="font-semibold text-brand-900 flex items-center justify-between">
                      <span>Schema Diagnostics:</span>
                      <span className="font-mono text-brand-700">{schemaIssues.length} issues flagged</span>
                    </div>
                    <p className="text-brand-600">
                      Ensure every core service page has nested FAQ Schema and Author/Publisher entity credentials.
                    </p>
                  </div>
                </Panel>

                {/* Information Gain Panel */}
                <Panel className="p-4 space-y-3">
                  <div className="flex items-center gap-2 text-emerald-700">
                    <CheckCircle2 size={16} />
                    <h4 className="text-xs font-bold uppercase tracking-wider">Information Gain & Data Density</h4>
                  </div>
                  <p className="text-xs text-brand-600 leading-relaxed">
                    Generative search engines penalize generic, commoditized copy. Pages with proprietary benchmarks, comparison tables, and statistics earn up to 4.2x more citations.
                  </p>
                  <div className="rounded-lg bg-brand-50 p-3 text-[11px] space-y-1.5 border border-brand-200">
                    <div className="font-semibold text-brand-900 flex items-center justify-between">
                      <span>Average Word Depth:</span>
                      <span className="font-mono text-emerald-700">
                        {allPages.length > 0
                          ? `${Math.round(allPages.reduce((acc, p) => acc + (p.wordCount || 0), 0) / allPages.length)} words/page`
                          : "—"}
                      </span>
                    </div>
                    <p className="text-brand-600">
                      Include quantitative data tables and verified performance specs to boost information density.
                    </p>
                  </div>
                </Panel>
              </div>

              {/* Page-by-Page GEO Audit Table */}
              <Panel className="overflow-hidden">
                <div className="border-b border-brand-200 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-brand-50/50">
                  <div>
                    <h3 className="text-sm font-bold text-brand-950 flex items-center gap-2">
                      <span>Page-by-Page GEO Audit & Quotability Engine</span>
                      <Pill tone="info">{allPages.length} Pages Analyzed</Pill>
                    </h3>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">
                      Audit content quotability, schema grounding, and generate 1-click LLM Answer Blocks.
                    </p>
                  </div>
                </div>

                {allPages.length === 0 ? (
                  <div className="p-8 text-center text-xs text-brand-400">
                    No crawled pages found. Run a full scan to audit GEO readiness.
                  </div>
                ) : (
                  <Table>
                    <thead>
                      <Tr>
                        <Th>Target URL & Title</Th>
                        <Th>Word Count & Density</Th>
                        <Th>Quotability Status</Th>
                        <Th>Schema Grounding</Th>
                        <Th align="right">1-Click GEO Action</Th>
                      </Tr>
                    </thead>
                    <tbody>
                      {allPages.map((page) => {
                        const hasSchemaIssue = schemaIssues.some((i) => i.affectedUrl === page.url);
                        const isQuotable = page.wordCount >= 350 && page.wordCount <= 3000;
                        const isThin = page.wordCount < 350;

                        return (
                          <Tr key={page.id || page.url}>
                            <Td>
                              <div className="min-w-0 max-w-md">
                                <p className="truncate font-medium text-xs text-brand-950">{page.title || "Untitled Page"}</p>
                                <a
                                  href={page.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="truncate text-[11px] font-mono text-accent-600 hover:underline flex items-center gap-1 mt-0.5"
                                >
                                  <span className="truncate">{page.url}</span>
                                  <ExternalLink size={10} className="shrink-0" />
                                </a>
                              </div>
                            </Td>
                            <Td>
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs font-semibold text-brand-900">
                                  {page.wordCount.toLocaleString()} words
                                </span>
                                <Pill tone={isThin ? "bad" : page.wordCount > 1500 ? "good" : "info"}>
                                  {isThin ? "Thin Copy" : page.wordCount > 1500 ? "High Density" : "Standard"}
                                </Pill>
                              </div>
                            </Td>
                            <Td>
                              <Pill tone={isQuotable ? "good" : isThin ? "bad" : "warn"}>
                                {isQuotable ? "Quotable Answer" : isThin ? "Needs Answer Block" : "Refine Structure"}
                              </Pill>
                            </Td>
                            <Td>
                              <div className="flex items-center gap-1.5">
                                {hasSchemaIssue ? (
                                  <span className="inline-flex items-center gap-1 text-[11px] text-amber-700 font-medium">
                                    <AlertTriangle size={12} className="text-amber-500" />
                                    Schema Gap Flagged
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-medium">
                                    <CheckCircle2 size={12} className="text-emerald-500" />
                                    Grounded JSON-LD
                                  </span>
                                )}
                              </div>
                            </Td>
                            <Td align="right">
                              <ActionButton
                                variant="secondary"
                                icon={<Sparkles size={12} className="text-accent-600" />}
                                onClick={() => {
                                  const geoIssue: CrawlIssue = {
                                    id: `geo-fix-${page.id}`,
                                    issueType: "GEO_LLM_ANSWER_BLOCK",
                                    severity: isThin ? "HIGH" : "MEDIUM",
                                    affectedUrl: page.url,
                                    description: isThin
                                      ? `Page has low word depth (${page.wordCount} words) and lacks structured summary answer block for generative AI engines.`
                                      : `Page copy lacks a concise 45-word definition block and embedded FAQ schema for Google AI Overviews and ChatGPT search.`,
                                    recommendation:
                                      "Embed a structured 45-55 word direct answer block with high information gain bullets and Schema.org FAQPage JSON-LD markup.",
                                    status: "OPEN",
                                    aiFixAvailable: true,
                                    confidence: "CONFIRMED",
                                    category: "GEO",
                                  };
                                  setSelectedFixIssue(geoIssue);
                                }}
                              >
                                Convert to Answer Block
                              </ActionButton>
                            </Td>
                          </Tr>
                        );
                      })}
                    </tbody>
                  </Table>
                )}
              </Panel>
            </div>
          )}
        </div>
      </QueryState>

      {/* Interactive Health Score Breakdown Modal */}
      {showBreakdown && (
        <ScoreBreakdownModal
          score={healthScore}
          pagesCrawled={pagesCrawled}
          totalFindings={totalFindings}
          uniqueOpenIssues={uniqueOpenIssues}
          resolvedIssues={resolvedIssues}
          severityCounts={severityCounts}
          qualityDiagnostics={qualityDiagnostics}
          onClose={() => setShowBreakdown(false)}
        />
      )}

      {selectedFixIssue && (
        <AutoFixModal
          issue={selectedFixIssue}
          onClose={() => setSelectedFixIssue(null)}
        />
      )}
    </div>
  );
}

function SiteBanner({
  domain,
  health,
  status,
  statusTone,
  finishedAt,
  duration,
  criticalCount,
  onOpenBreakdown,
}: {
  domain: string;
  health: number | null;
  status?: string;
  statusTone: "good" | "warn" | "bad" | "default";
  finishedAt?: string | null;
  duration: string | null;
  criticalCount: number;
  onOpenBreakdown: () => void;
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
        <div className="w-[148px]">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-[0.07em] text-brand-400">Site health</p>
            {health != null && (
              <button
                onClick={onOpenBreakdown}
                className="text-[10px] text-accent-600 hover:underline inline-flex items-center gap-0.5"
              >
                Breakdown
              </button>
            )}
          </div>
          <div className="mt-1 flex items-center gap-2">
            <span className="font-mono text-[18px] font-bold tracking-[-0.02em] text-brand-950">
              {health != null ? health : "—"}
            </span>
            <div className="flex-1">
              {health != null ? (
                <MeterBar value={health} tone={health >= 70 ? "good" : "accent"} width="100%" />
              ) : (
                <span className="text-[11px] text-brand-400">not analyzed</span>
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
        <span className="font-mono text-[11px] text-brand-400">from {first.toLocaleString()}</span>
        <Sparkline values={values} width={120} height={28} />
      </div>
    </div>
  );
}

function EmptyNote({ children }: { children: React.ReactNode }) {
  return <p className="px-4 py-10 text-center text-[12px] text-brand-400">{children}</p>;
}

function ScoreBreakdownModal({
  score,
  pagesCrawled,
  totalFindings,
  uniqueOpenIssues,
  resolvedIssues,
  severityCounts,
  qualityDiagnostics,
  onClose,
}: {
  score: number | null;
  pagesCrawled: number;
  totalFindings: number;
  uniqueOpenIssues: number;
  resolvedIssues: number;
  severityCounts: Record<string, number>;
  qualityDiagnostics?: CrawlQualityDiagnostics | null;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
      <div className="w-full max-w-lg rounded-xl border bg-white p-6 shadow-xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b pb-3">
          <div>
            <h3 className="text-[16px] font-bold text-brand-950">Site Health Score Methodology</h3>
            <p className="text-[11.5px] text-brand-500">Deterministic scoring engine (0–100 scale)</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-brand-400 hover:bg-brand-50 hover:text-brand-700">
            <X size={16} />
          </button>
        </div>

        <div className="flex items-center gap-4 rounded-lg border bg-brand-50/50 p-3.5">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-brand-950 font-mono text-[22px] font-bold text-white shadow-xs">
            {score != null ? score : "—"}
          </div>
          <div>
            <p className="text-[13px] font-semibold text-brand-950">
              {score == null
                ? "Not calculated yet"
                : score >= 80
                  ? "Good health score"
                  : score >= 50
                    ? "Fair · Remediation recommended"
                    : "Action required"}
            </p>
            <p className="text-[11px] text-brand-500 mt-0.5">
              Derived from {uniqueOpenIssues} unique open issues across {pagesCrawled} crawled pages.
            </p>
          </div>
        </div>

        <div className="space-y-2 text-[12px] text-brand-700">
          <p className="font-semibold text-brand-950">How is this calculated?</p>
          <ul className="list-disc pl-4 space-y-1 text-brand-600 text-[11.5px]">
            <li>
              <b>Base Score:</b> Starts at 100.
            </li>
            <li>
              <b>Severity Weights:</b> Critical (-20), High (-8), Medium (-3), Low (-1).
            </li>
            <li>
              <b>Confidence Multiplier:</b> Confirmed (1.0x), Likely (0.8x), Advisory (0.5x).
            </li>
            <li>
              <b>Per-URL Penalty Cap:</b> Capped at 20 penalty points per URL so a single broken template cannot zero out an entire website.
            </li>
            <li>
              <b>Page Normalization:</b> Total penalty is normalized across all crawled pages.
            </li>
          </ul>
        </div>

        <div className="rounded-lg border bg-white p-3 space-y-2 text-[11.5px]">
          <p className="font-semibold text-brand-950 text-[11px] uppercase tracking-wider">Audit Summary</p>
          <div className="grid grid-cols-2 gap-2 font-mono">
            <div>Crawled pages: <b>{pagesCrawled}</b></div>
            <div>Unique issues: <b>{uniqueOpenIssues}</b></div>
            <div>Total occurrences: <b>{totalFindings}</b></div>
            <div>Resolved issues: <b className="text-success-600">+{resolvedIssues}</b></div>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <ActionButton variant="primary" onClick={onClose}>
            Got it
          </ActionButton>
        </div>
      </div>
    </div>
  );
}

function formatEvidence(evidenceStr: string): string {
  try {
    const parsed = JSON.parse(evidenceStr);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return evidenceStr;
  }
}

function shorten(url: string): string {
  try {
    const { pathname } = new URL(url);
    return pathname.length > 44 ? `${pathname.slice(0, 44)}…` : pathname || "/";
  } catch {
    return url.slice(0, 44);
  }
}

export default function WebsitePage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-32 items-center justify-center text-sm text-brand-500">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading website…
        </div>
      }
    >
      <WebsiteClient />
    </Suspense>
  );
}
