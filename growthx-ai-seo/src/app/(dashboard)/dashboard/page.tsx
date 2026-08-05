"use client";
import Link from "next/link";
import { ArrowRight, Zap } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
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
import type { CrawlIssue } from "@/lib/api-client";
import { useCrawlIssues, useLatestCrawl, usePortfolio, useVisibility, useWorkspace } from "@/hooks/use-growthx";

/**
 * Client Overview — the first screen after choosing a client in the switcher.
 * Everything here is that one client's real data.
 */
export default function OverviewPage() {
  const { orgId, projectId, projects } = useWorkspace();
  const portfolio = usePortfolio(orgId);
  const visibility = useVisibility(projectId);

  const client = portfolio.data?.clients.find((c) => c.projectId === projectId) ?? null;
  const crawl = useLatestCrawl(client?.domain ?? null);
  const issues = useCrawlIssues(crawl.data?.id ?? null);

  const project = projects.find((p) => p.id === projectId);
  const summary = visibility.data?.summary;

  // "Fix next": worst issues first, which is the order an agency should work in.
  const severityRank: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
  const fixNext = [...(issues.data?.data ?? [])]
    .sort((a, b) => (severityRank[a.severity] ?? 9) - (severityRank[b.severity] ?? 9))
    .slice(0, 6);

  const trend = (client?.trend ?? []).map((share, i) => ({ week: `W${i + 1}`, share }));

  return (
    <div className="space-y-5">
      <PageHeader
        title={project?.name ?? "Overview"}
        subtitle={
          client
            ? `${client.domain ?? "no website"} · last crawl ${relativeTime(client.lastCrawledAt)}`
            : "Select a client from the switcher"
        }
        actions={
          <Link href="/technical-seo">
            <ActionButton variant="primary" icon={<Zap size={12} />}>
              Run audit
            </ActionButton>
          </Link>
        }
      />

      <QueryState
        isLoading={portfolio.isLoading}
        error={portfolio.error}
        isEmpty={!client}
        emptyTitle="No client selected"
        emptyBody="Add a client from the Clients page, then pick it in the workspace switcher."
      >
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi
            label="AI citation share"
            value={client?.aiCitationSharePct != null ? `${client.aiCitationSharePct}%` : "—"}
            delta={client?.aiDeltaPt}
            deltaSuffix="pt"
            sub={`${client?.trackedPrompts ?? 0} prompts tracked`}
          />
          <Kpi
            label="Site health"
            value={client?.health != null ? String(client.health) : "—"}
            sub="weighted by issue severity"
            tone={client?.health != null && client.health < 60 ? "danger" : "default"}
          />
          <Kpi
            label="Open criticals"
            value={String(client?.criticalIssues ?? 0)}
            sub={crawl.data ? `${crawl.data.pagesCrawled ?? 0} pages crawled` : "not crawled yet"}
            tone={client?.criticalIssues ? "danger" : "good"}
          />
          <Kpi
            label="Avg position"
            value={client?.averagePosition != null ? String(client.averagePosition) : "—"}
            sub="in AI answers, when cited"
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="AI citation share" subtitle="weekly, from tracked prompts">
            <div className="h-[220px] px-3 pb-3 pt-4">
              {trend.length < 2 ? (
                <p className="flex h-full items-center justify-center text-[12px] text-[#a1a1aa]">
                  Not enough history yet — checks run daily.
                </p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trend}>
                    <defs>
                      <linearGradient id="ov" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#2563eb" stopOpacity={0.22} />
                        <stop offset="100%" stopColor="#2563eb" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="week" tick={{ fontSize: 10, fill: "#a1a1aa" }} axisLine={false} tickLine={false} />
                    <YAxis unit="%" tick={{ fontSize: 10, fill: "#a1a1aa" }} axisLine={false} tickLine={false} width={34} />
                    <Tooltip formatter={(v) => `${v}%`} />
                    <Area type="monotone" dataKey="share" stroke="#2563eb" strokeWidth={2} fill="url(#ov)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </Panel>

          <Panel title="Assistant breakdown" subtitle="cited / checked">
            <div className="p-4">
              {!summary || summary.checked === 0 ? (
                <p className="py-10 text-center text-[12px] text-[#a1a1aa]">
                  No checks have run yet.{" "}
                  <Link href="/geo-tracking" className="text-[#2563eb] hover:underline">
                    Add prompts →
                  </Link>
                </p>
              ) : (
                <div className="space-y-3">
                  {visibility.data?.byAssistant.map((row) => (
                    <div key={row.assistant} className="flex items-center gap-3">
                      <span className="w-28 shrink-0 text-[12px] text-[#3f3f46]">{row.assistant}</span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#f4f4f5]">
                        <div className="h-full rounded-full bg-[#2563eb]" style={{ width: `${row.citationSharePct}%` }} />
                      </div>
                      <span className="w-24 shrink-0 text-right font-mono text-[11px] text-[#71717a]">
                        {row.cited}/{row.checked} · {row.citationSharePct}%
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Panel>
        </div>

        <Panel
          title="Fix next"
          subtitle="worst issues from the latest crawl, most severe first"
          actions={
            <Link href="/technical-seo" className="text-[11.5px] font-medium text-[#2563eb] hover:underline">
              All issues <ArrowRight size={11} className="inline" />
            </Link>
          }
        >
          {fixNext.length === 0 ? (
            <p className="px-4 py-8 text-center text-[12px] text-[#a1a1aa]">
              {crawl.data ? "No open issues on the latest crawl." : "Run an audit to populate this."}
            </p>
          ) : (
            <Table minWidth={720}>
              <thead>
                <tr>
                  <Th>Severity</Th>
                  <Th>Issue</Th>
                  <Th>URL</Th>
                  <Th align="right">AI fix</Th>
                </tr>
              </thead>
              <tbody>
                {fixNext.map((issue: CrawlIssue) => (
                  <Tr key={issue.id}>
                    <Td>
                      <Pill tone={issue.severity === "CRITICAL" ? "bad" : issue.severity === "HIGH" ? "warn" : "default"}>
                        {issue.severity}
                      </Pill>
                    </Td>
                    <Td>
                      <span className="text-[12.5px] font-medium text-[#09090b]">{issue.issueType}</span>
                      <span className="block text-[11px] text-[#71717a]">{issue.description}</span>
                    </Td>
                    <Td>
                      <Mono tone="soft">{shorten(issue.affectedUrl)}</Mono>
                    </Td>
                    <Td align="right">
                      {issue.aiFixAvailable ? <Pill tone="good">ready</Pill> : <Pill>not generated</Pill>}
                    </Td>
                  </Tr>
                ))}
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
    return pathname.length > 40 ? `${pathname.slice(0, 40)}…` : pathname || "/";
  } catch {
    return url.slice(0, 40);
  }
}
