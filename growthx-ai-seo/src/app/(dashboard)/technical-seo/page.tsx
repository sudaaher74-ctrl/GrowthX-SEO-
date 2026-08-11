"use client";
import { Suspense, useMemo, useState } from "react";
import { Loader2, RefreshCw, Sparkles } from "lucide-react";
import {
  ActionButton,
  Kpi,
  Mono,
  PageHeader,
  Panel,
  Pill,
  Table,
  Tabs,
  Td,
  Th,
  Tr,
  relativeTime,
} from "@/components/ui/console";
import { QueryState } from "@/components/ui/upgrade-prompt";
import { api, type CrawlIssue, type FixPatch } from "@/lib/api-client";
import { useSearchParams } from "next/navigation";
import { useCrawlIssues, useLatestCrawl, usePortfolio, useWorkspace } from "@/hooks/use-growthx";

type Severity = "ALL" | "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

/** Site health — the crawl audit, on real issue data. */
function SiteHealthClient() {
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

  const [severity, setSeverity] = useState<Severity>("ALL");
  const [crawling, setCrawling] = useState(false);
  const [fixing, setFixing] = useState<string | null>(null);
  const [fixes, setFixes] = useState<Record<string, FixPatch | { error: string }>>({});

  const all = issues.data?.data ?? [];
  const rows = useMemo(
    () => (severity === "ALL" ? all : all.filter((i) => i.severity === severity)),
    [all, severity],
  );

  const counts = useMemo(() => {
    const c = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 } as Record<string, number>;
    for (const issue of all) c[issue.severity] = (c[issue.severity] ?? 0) + 1;
    return c;
  }, [all]);

  async function runCrawl() {
    if (!client?.domain) return;
    setCrawling(true);
    try {
      await api.startCrawl({ domain: client.domain, maxDepth: 10, maxConcurrency: 5 });
      // The crawl is queued; results appear once the job finishes.
      setTimeout(() => crawl.refetch(), 3000);
    } finally {
      setCrawling(false);
    }
  }

  async function generateFix(issueId: string) {
    setFixing(issueId);
    try {
      const patch = await api.autoFixIssue(issueId);
      setFixes((prev) => ({ ...prev, [issueId]: patch }));
    } catch (error) {
      setFixes((prev) => ({ ...prev, [issueId]: { error: (error as Error).message } }));
    } finally {
      setFixing(null);
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Site health"
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
            {crawling ? "Starting…" : "Run audit"}
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
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi
            label="Health score"
            value={client?.health != null ? String(client.health) : "—"}
            sub="100 minus severity-weighted penalty"
            tone={client?.health != null && client.health < 60 ? "danger" : "default"}
          />
          <Kpi label="URLs crawled" value={(crawl.data?.pagesCrawled ?? 0).toLocaleString()} sub="latest completed crawl" />
          <Kpi label="Open issues" value={String(all.length)} sub={`${counts.CRITICAL} critical · ${counts.HIGH} high`} />
          <Kpi
            label="Critical"
            value={String(counts.CRITICAL)}
            sub="fix these first"
            tone={counts.CRITICAL ? "danger" : "good"}
          />
        </div>

        <Tabs
          tabs={[
            { id: "ALL" as Severity, label: "All", tag: String(all.length) },
            { id: "CRITICAL" as Severity, label: "Critical", tag: String(counts.CRITICAL) },
            { id: "HIGH" as Severity, label: "High", tag: String(counts.HIGH) },
            { id: "MEDIUM" as Severity, label: "Medium", tag: String(counts.MEDIUM) },
            { id: "LOW" as Severity, label: "Low", tag: String(counts.LOW) },
          ]}
          active={severity}
          onChange={setSeverity}
        />

        <Panel title="Issues" subtitle={`${rows.length} shown`}>
          {rows.length === 0 ? (
            <p className="px-4 py-10 text-center text-[12px] text-[#a1a1aa]">
              {crawl.data ? "No issues at this severity." : "Run an audit to populate this."}
            </p>
          ) : (
            <Table minWidth={900}>
              <thead>
                <tr>
                  <Th>Severity</Th>
                  <Th>Issue</Th>
                  <Th>URL</Th>
                  <Th>Recommendation</Th>
                  <Th align="right">AI fix</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((issue: CrawlIssue) => {
                  const fix = fixes[issue.id] as (FixPatch & { error?: string }) | undefined;
                  return (
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
                      <Td>
                        {fix?.error ? (
                          <span className="text-[11px] text-[#dc2626]">{fix.error}</span>
                        ) : fix ? (
                          <div className="max-w-sm">
                            <span className="block text-[11.5px] font-medium text-[#09090b]">{fix.proposedValue}</span>
                            <code className="mt-1 block overflow-x-auto rounded bg-[#fafafa] p-1.5 font-mono text-[10px] text-[#3f3f46]">
                              {fix.codeSnippet}
                            </code>
                            <span className="mt-1 block text-[10px] text-[#a1a1aa]">
                              {fix.source === "model" ? `written by ${fix.model}` : "derived (no model available)"}
                            </span>
                          </div>
                        ) : (
                          <span className="max-w-xs text-[11.5px] text-[#71717a]">{issue.recommendation}</span>
                        )}
                      </Td>
                      <Td align="right">
                        <ActionButton
                          icon={fixing === issue.id ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
                          onClick={() => generateFix(issue.id)}
                          disabled={fixing === issue.id}
                        >
                          {fixing === issue.id ? "…" : fix ? "Regenerate" : "Generate"}
                        </ActionButton>
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </Panel>
      </QueryState>
    </div>
  );
}

export default function SiteHealthPage() {
  return (
    <Suspense fallback={<div className="flex h-32 items-center justify-center text-sm text-[var(--text-muted)]"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading site health...</div>}>
      <SiteHealthClient />
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
