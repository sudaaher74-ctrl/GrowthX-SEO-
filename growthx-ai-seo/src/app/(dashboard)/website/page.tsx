"use client";
import { Suspense, useMemo, useState } from "react";
import { Loader2, RefreshCw, Sparkles, Search, Zap, Code, Layout, LayoutGrid, HeartPulse, Activity } from "lucide-react";
import {
  ActionButton,
  Kpi,
  Mono,
  PageHeader,
  Panel,
  Pill,
  Table,
  Td,
  Th,
  Tr,
  relativeTime,
} from "@/components/ui/console";
import { QueryState } from "@/components/ui/upgrade-prompt";
import { api, type CrawlIssue, type CrawlPage } from "@/lib/api-client";
import { useSearchParams } from "next/navigation";
import { useCrawlIssues, useCrawlPages, useLatestCrawl, usePortfolio, useWorkspace } from "@/hooks/use-growthx";

function WebsiteClient() {
  const searchParams = useSearchParams();
  const queryDomain = searchParams.get("domain");

  const { orgId, projectId } = useWorkspace();
  const portfolio = usePortfolio(orgId);
  
  const client = useMemo(() => {
    if (!portfolio.data?.clients) return null;
    if (queryDomain) {
      const match = portfolio.data.clients.find((c) => c.domain === queryDomain);
      if (match) return match;
    }
    return portfolio.data.clients.find((c) => c.projectId === projectId) ?? null;
  }, [portfolio.data?.clients, queryDomain, projectId]);

  const crawl = useLatestCrawl(client?.domain ?? null);
  const issues = useCrawlIssues(crawl.data?.id ?? null, undefined, crawl.data?.status);
  const pages = useCrawlPages(crawl.data?.id ?? null, crawl.data?.status);

  const [activeTab, setActiveTab] = useState("overview");
  const [crawling, setCrawling] = useState(false);

  const allIssues = issues.data?.data ?? [];
  const allPages = pages.data?.data ?? [];

  async function runCrawl() {
    if (!client?.domain) return;
    setCrawling(true);
    try {
      await api.startCrawl({ domain: client.domain, maxDepth: 10, maxConcurrency: 5 });
      setTimeout(() => crawl.refetch(), 3000);
    } finally {
      setCrawling(false);
    }
  }

  const tabs = [
    { id: "overview", label: "Overview", icon: LayoutGrid },
    { id: "technical-seo", label: "Technical SEO", icon: Zap },
    { id: "performance", label: "Performance", icon: Activity },
    { id: "pages", label: "Pages", icon: Layout },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Website"
        subtitle={
          crawl.data
            ? `${crawl.data.pagesCrawled ?? 0} URLs · crawl ${relativeTime(crawl.data.finishedAt)}`
            : client?.domain
              ? `${client.domain} · not crawled yet`
              : "Select a client with a website"
        }
        actions={
          <ActionButton
            variant="primary"
            icon={crawling ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            onClick={runCrawl}
            disabled={crawling || !client?.domain}
          >
            {crawling ? "Starting…" : "Run full scan"}
          </ActionButton>
        }
      />

      <QueryState
        isLoading={portfolio.isLoading || crawl.isLoading}
        error={portfolio.error}
        isEmpty={!client?.domain}
        emptyTitle="No website registered"
        emptyBody="Register this client's website before running an audit."
      >
        <div className="flex space-x-1 border-b border-[#e4e4e7] overflow-x-auto pb-[-1px]">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? "border-[#2563eb] text-[#2563eb]"
                  : "border-transparent text-[#71717a] hover:text-[#09090b] hover:border-[#d4d4d8]"
              }`}
            >
              <tab.icon size={14} />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="pt-2 flex flex-col gap-4">
          {activeTab === "overview" && (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Kpi label="Pages Crawled" value={(crawl.data?.pagesCrawled ?? 0).toLocaleString()} />
              <Kpi label="Issues Found" value={(crawl.data?.issuesFound ?? 0).toLocaleString()} />
              <Kpi label="Avg Health" value={client?.health != null ? String(client.health) : "—"} />
              <Kpi label="Status" value={crawl.data?.status ?? "—"} />
            </div>
          )}

          {activeTab === "technical-seo" && (
            <Panel title="Technical SEO Issues" subtitle={`${allIssues.length} issues identified`}>
              {allIssues.length === 0 ? (
                <p className="px-4 py-10 text-center text-[12px] text-[#a1a1aa]">
                  No issues found.
                </p>
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
                          <Pill tone={issue.severity === "CRITICAL" ? "bad" : issue.severity === "HIGH" ? "warn" : "default"}>
                            {issue.severity}
                          </Pill>
                        </Td>
                        <Td>
                          <span className="text-[12.5px] font-medium text-[#09090b]">{issue.issueType}</span>
                          <span className="block max-w-xs text-[11px] text-[#71717a]">{issue.description}</span>
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
                <p className="px-4 py-10 text-center text-[12px] text-[#a1a1aa]">
                  No performance data available.
                </p>
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
            <Panel title="Crawled Pages" subtitle={`${allPages.length} pages indexed`}>
              {allPages.length === 0 ? (
                <p className="px-4 py-10 text-center text-[12px] text-[#a1a1aa]">
                  No pages crawled yet.
                </p>
              ) : (
                <Table>
                  <thead>
                    <tr>
                      <Th>Status</Th>
                      <Th>URL</Th>
                      <Th>Title</Th>
                      <Th>Word Count</Th>
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
                          <span className="text-[12px] text-[#3f3f46] max-w-xs block truncate" title={page.title || ""}>
                            {page.title || "—"}
                          </span>
                        </Td>
                        <Td>{page.wordCount.toLocaleString()}</Td>
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

export default function WebsitePage() {
  return (
    <Suspense fallback={<div className="flex h-32 items-center justify-center text-sm text-[var(--text-muted)]"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading website...</div>}>
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
