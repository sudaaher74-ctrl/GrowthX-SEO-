"use client";
import { useMemo, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { ActionButton, Kpi, Mono, PageHeader, Panel, Pill, Table, Td, Th, Tr, relativeTime } from "@/components/ui/console";
import { QueryState } from "@/components/ui/upgrade-prompt";
import { api, type CrawlIssue, type FixPatch } from "@/lib/api-client";
import { useCrawlIssues, useLatestCrawl, usePortfolio, useWorkspace } from "@/hooks/use-growthx";

/**
 * Shared shell for the SEO tool pages (images, internal links, meta tags,
 * schema) — each is really just a filtered slice of the same crawl issues
 * that power /technical-seo, grouped and labelled for its own topic.
 */
export function IssueTypeView({
  title,
  subtitle,
  matches,
  kpis,
  emptyBody,
}: {
  title: string;
  subtitle: string;
  /** Which issueType values belong on this page. */
  matches: (issueType: string) => boolean;
  /** Extra KPI tiles beyond "open issues", each counting a sub-slice of the filtered issues. */
  kpis: { label: string; match: (issueType: string) => boolean }[];
  emptyBody: string;
}) {
  const { orgId, projectId } = useWorkspace();
  const portfolio = usePortfolio(orgId);
  const client = portfolio.data?.clients.find((c) => c.projectId === projectId) ?? null;

  const crawl = useLatestCrawl(client?.domain ?? null);
  const issues = useCrawlIssues(crawl.data?.id ?? null);

  const [fixing, setFixing] = useState<string | null>(null);
  const [fixes, setFixes] = useState<Record<string, FixPatch | { error: string }>>({});

  const rows = useMemo(() => (issues.data?.data ?? []).filter((i) => matches(i.issueType)), [issues.data, matches]);

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
        title={title}
        subtitle={
          crawl.data
            ? `${subtitle} · crawl ${relativeTime(crawl.data.finishedAt)}`
            : client?.domain
              ? `${client.domain} · not crawled yet`
              : "Select a client with a website"
        }
      />

      <QueryState
        isLoading={portfolio.isLoading || crawl.isLoading}
        error={portfolio.error}
        isEmpty={!client?.domain}
        emptyTitle="No website registered"
        emptyBody="Register this client's website, then run an audit from Site health."
      >
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi label="Total flagged" value={String(rows.length)} sub="from the latest crawl" />
          {kpis.map((k) => (
            <Kpi key={k.label} label={k.label} value={String(rows.filter((r) => k.match(r.issueType)).length)} />
          ))}
        </div>

        <Panel title="Issues" subtitle={`${rows.length} shown`}>
          {rows.length === 0 ? (
            <p className="px-4 py-10 text-center text-[12px] text-brand-400">
              {crawl.data ? emptyBody : "Run an audit to populate this."}
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
                        <span className="text-[12.5px] font-medium text-brand-950">{issue.issueType}</span>
                        <span className="block max-w-xs text-[11px] text-brand-500">{issue.description}</span>
                      </Td>
                      <Td>
                        <Mono tone="soft">{shorten(issue.affectedUrl)}</Mono>
                      </Td>
                      <Td>
                        {fix?.error ? (
                          <span className="text-[11px] text-error-500">{fix.error}</span>
                        ) : fix ? (
                          <div className="max-w-sm">
                            <span className="block text-[11.5px] font-medium text-brand-950">{fix.proposedValue}</span>
                            <code className="mt-1 block overflow-x-auto rounded bg-brand-50 p-1.5 font-mono text-[10px] text-brand-700">
                              {fix.codeSnippet}
                            </code>
                            <span className="mt-1 block text-[10px] text-brand-400">
                              {fix.source === "model" ? `written by ${fix.model}` : "derived (no model available)"}
                            </span>
                          </div>
                        ) : (
                          <span className="max-w-xs text-[11.5px] text-brand-500">{issue.recommendation}</span>
                        )}
                      </Td>
                      <Td align="right">
                        {issue.aiFixAvailable ? (
                          <ActionButton
                            icon={fixing === issue.id ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
                            onClick={() => generateFix(issue.id)}
                            disabled={fixing === issue.id}
                          >
                            {fixing === issue.id ? "…" : fix ? "Regenerate" : "Generate"}
                          </ActionButton>
                        ) : (
                          <span className="text-[11px] text-brand-400">manual fix</span>
                        )}
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

function shorten(url: string): string {
  try {
    const { pathname } = new URL(url);
    return pathname.length > 44 ? `${pathname.slice(0, 44)}…` : pathname || "/";
  } catch {
    return url.slice(0, 44);
  }
}
