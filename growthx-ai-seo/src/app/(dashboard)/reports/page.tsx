"use client";
import { useState } from "react";
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
} from "@/components/ui/console";
import { MeasureKpi } from "@/components/ui/measure-kpi";
import { LayoutDashboard, FileBarChart, Users, FileSignature, Download, Loader2 } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, BarChart, Bar, CartesianGrid } from "recharts";
import {
  useWorkspace,
  usePortfolio,
  useLatestCrawl,
  useCrawlIssues,
  useExecutiveSummary,
  useVisibility,
  useTrackedPrompts,
  useReporting,
} from "@/hooks/use-growthx";

export default function ReportsPage() {
  const { orgId, projectId, projects } = useWorkspace();
  const portfolio = usePortfolio(orgId);
  const client = portfolio.data?.clients.find((c) => c.projectId === projectId) ?? null;
  const crawl = useLatestCrawl(client?.domain ?? null);
  const issues = useCrawlIssues(crawl.data?.id ?? null);
  const executive = useExecutiveSummary(projectId);
  const visibility = useVisibility(projectId);
  const prompts = useTrackedPrompts(projectId);
  const reporting = useReporting(projectId);

  const [activeTab, setActiveTab] = useState("executive");
  const [selectedReport, setSelectedReport] = useState<string | null>(null);

  const tabs = [
    { id: "executive", label: "Executive Dashboard", icon: LayoutDashboard },
    { id: "custom", label: "Custom Reports", icon: FileBarChart },
    { id: "client", label: "Client Portal", icon: Users },
    { id: "whitelabel", label: "White-label", icon: FileSignature },
  ];

  const isLoading = portfolio.isLoading || crawl.isLoading || issues.isLoading || executive.isLoading || visibility.isLoading || prompts.isLoading || reporting.isLoading;

  // Site health, counted on the server. What was here was a client-side score:
  //
  //   technicalHealth = Math.max(0, 100 - criticalCount * 5 - highCount * 2)
  //
  // which was wrong in two directions at once. A project with no crawl at all
  // has no issues, so it scored 100 out of 100 with a full green meter — the
  // absence of any measurement rendered as a perfect result, on the one page
  // with an Export PDF button on it. And the counts came from a single
  // hundred-row page of issues, so past a hundred findings the score stopped
  // falling and a site that got worse could score better, depending only on
  // which hundred came back first.
  //
  // The server already counts this without a cap and says why when it has
  // nothing, so this reports what it counted — the same figures the dashboard
  // shows — rather than a second, disagreeing composite of its own invention.
  const siteHealth = executive.data?.siteHealth ?? null;

  const trackedPrompts = prompts.data ?? [];
  // Nulls are excluded rather than counted as zero: `?? 0` silently turns "no
  // estimate for this prompt" into "this prompt has no search volume", which
  // understates the total without saying so. How many prompts actually carry
  // an estimate is shown alongside it, so the figure can be read for what it
  // covers.
  const estimatedPrompts = trackedPrompts.filter((p) => p.estimatedVolume != null);
  const totalVolume = estimatedPrompts.reduce((acc, curr) => acc + (curr.estimatedVolume ?? 0), 0);

  // Null, not zero, when no sweep has run. "0.0% citation share" reads as "AI
  // never mentions this client" when it means "nobody has checked" — and the
  // chart directly beneath already said "No visibility history yet", so the
  // two halves of the same panel contradicted each other.
  const citationShare = visibility.data?.summary?.citationSharePct ?? null;

  const severityRank: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
  const topIssues = [...(issues.data?.data ?? [])]
    .sort((a, b) => (severityRank[a.severity] ?? 9) - (severityRank[b.severity] ?? 9))
    .slice(0, 5);

  // Real citation-share history. This chart previously rendered a hardcoded
  // six-month "traffic" series (4,000 rising to 7,100) that belonged to no
  // client — on the page with an Export PDF button, so invented numbers went
  // out under the agency's name. Nothing here is estimated: the project either
  // has visibility history or the panel says it does not.
  const citationTrend = (visibility.data?.trend ?? []).map((t) => ({
    week: new Date(t.weekStart).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    sharePct: t.citationSharePct,
  }));

  return (
    <div className="space-y-5">
      <PageHeader
        title="Automated Reporting"
        subtitle="Executive summaries, custom reports, and client portal settings."
        actions={
          // Was a button with no onClick — it looked live and did nothing at
          // all when clicked, which is the worst of the three options. The
          // browser's own print dialogue saves a real PDF of exactly what is
          // on screen, so what the client receives is what the page says,
          // including every "not measured yet" on it.
          <ActionButton variant="primary" icon={<Download size={12} />} onClick={() => window.print()}>
            Export PDF Report
          </ActionButton>
        }
      />

      <Tabs
        tabs={tabs}
        active={activeTab}
        onChange={(id) => {
          setActiveTab(id);
                setSelectedReport(null);
        }}
      />

      <div className="pt-2 flex items-start gap-4">
        <div className="flex-1 space-y-4 w-full">
          
          {(activeTab === "executive") && (
            <Panel title="Executive Dashboard" subtitle={client?.domain ? `Live report for ${client.domain}` : "Select a project"}>
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Loader2 size={32} className="text-brand-200 mb-4 animate-spin" />
                  <p className="text-sm text-[var(--text-muted)]">Loading executive metrics...</p>
                </div>
              ) : (
                <div className="space-y-6 mt-4 p-4">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {/* deltaSuffix only renders alongside a delta, and nothing
                        here records a previous value — so the units it was
                        carrying never reached the screen. They belong on the
                        value and the sub-line instead. */}
                    {siteHealth?.state === "MEASURED" ? (
                      <>
                        <Kpi
                          label="Site Health Score"
                          value={
                            (siteHealth as any).healthScore != null
                              ? `${(siteHealth as any).healthScore}/100`
                              : crawl.data?.healthScore != null
                                ? `${crawl.data.healthScore}/100`
                                : client?.health != null
                                  ? `${client.health}/100`
                                  : "—"
                          }
                          tone={(() => {
                            // No score means no verdict. The fallback used to be
                            // 100, so a project we had never scored rendered
                            // green — the one colour that says "you are fine".
                            const score =
                              (siteHealth as any).healthScore ??
                              crawl.data?.healthScore ??
                              client?.health;
                            if (score == null) return "default";
                            return score < 60 ? "danger" : "good";
                          })()}
                          sub="0–100 weighted health index"
                        />
                        <Kpi
                          label="Critical Issues"
                          value={siteHealth.criticalIssues.toLocaleString()}
                          tone={siteHealth.criticalIssues > 0 ? "danger" : "good"}
                          sub={`of ${siteHealth.totalIssues.toLocaleString()} found across ${siteHealth.pagesCrawled.toLocaleString()} pages`}
                        />
                        <Kpi
                          label="Pages Crawled"
                          value={siteHealth.pagesCrawled.toLocaleString()}
                          sub={siteHealth.source}
                        />
                      </>
                    ) : (
                      <MeasureKpi
                        label="Site Health"
                        className="md:col-span-2"
                        measure={{
                          state: "NO_DATA",
                          reason: siteHealth?.reason ?? "No completed crawl for this project yet. Run your first crawl to calculate site health.",
                        }}
                      />
                    )}
                    {citationShare == null ? (
                      <MeasureKpi
                        label="Citation Share"
                        measure={{
                          state: "NO_DATA",
                          reason: "No visibility sweep has run for this client yet, so nothing has been measured.",
                        }}
                      />
                    ) : (
                      <Kpi
                        label="Citation Share"
                        value={`${citationShare.toFixed(1)}%`}
                        meter={citationShare}
                        sub="of tracked prompts citing this client"
                      />
                    )}
                    {estimatedPrompts.length === 0 ? (
                      <MeasureKpi
                        label="Estimated Search Volume"
                        measure={{
                          state: "NO_DATA",
                          reason:
                            trackedPrompts.length === 0
                              ? "No prompts are being tracked for this client yet."
                              : `None of the ${trackedPrompts.length} tracked prompts carry a volume estimate.`,
                        }}
                      />
                    ) : (
                      <Kpi
                        label="Estimated Search Volume"
                        value={totalVolume.toLocaleString()}
                        sub={`monthly, across ${estimatedPrompts.length} of ${trackedPrompts.length} tracked prompts`}
                      />
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <Panel title="AI Citation Share Trend" subtitle="Measured from this client's tracked prompts">
                       {citationTrend.length === 0 ? (
                         <div className="flex h-64 items-center justify-center p-6 text-center text-xs text-[var(--text-muted)]">
                           No visibility history yet. Track prompts and run a sweep for this client to chart it.
                         </div>
                       ) : (
                        <div className="h-64 mt-4 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={citationTrend}>
                              <defs>
                                <linearGradient id="colorTraffic" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="var(--color-accent-600)" stopOpacity={0.3} />
                                  <stop offset="95%" stopColor="var(--color-accent-600)" stopOpacity={0} />
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-line)" />
                              <XAxis dataKey="week" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "var(--color-brand-500)" }} dy={10} />
                              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "var(--color-brand-500)" }} tickFormatter={(v) => `${v}%`} />
                              <Tooltip
                                contentStyle={{ borderRadius: "8px", border: "1px solid var(--color-line)", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
                              />
                              <Area type="monotone" dataKey="sharePct" stroke="var(--color-accent-600)" strokeWidth={2} fillOpacity={1} fill="url(#colorTraffic)" />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                       )}
                     </Panel>
                     
                     <Panel title="Top Technical Issues">
                        <Table minWidth={300}>
                          <thead>
                            <tr>
                              <Th>Issue</Th>
                              <Th>Severity</Th>
                            </tr>
                          </thead>
                          <tbody>
                            {topIssues.length > 0 ? (
                              topIssues.map((issue) => (
                                <Tr key={issue.id}>
                                  <Td><span className="text-[13px] text-brand-950 font-medium">{issue.issueType.replace(/_/g, ' ')}</span></Td>
                                  <Td>
                                    <Pill tone={issue.severity === "CRITICAL" ? "bad" : issue.severity === "HIGH" ? "warn" : "info"}>
                                      {issue.severity}
                                    </Pill>
                                  </Td>
                                </Tr>
                              ))
                            ) : (
                              <Tr><Td colSpan={2} className="text-center text-sm text-[var(--text-muted)] py-4">No issues found.</Td></Tr>
                            )}
                          </tbody>
                        </Table>
                     </Panel>
                  </div>

                  <Panel title="Top Brand & Conversational Prompts">
                    <Table minWidth={500}>
                      <thead>
                        <tr>
                          <Th>Prompt</Th>
                          <Th>Intent</Th>
                          <Th>Volume</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {trackedPrompts.length > 0 ? (
                          trackedPrompts.map((prompt) => (
                            <Tr key={prompt.id}>
                              <Td><Mono>{prompt.text}</Mono></Td>
                              <Td><Pill tone={prompt.intent === "TRANSACTIONAL" ? "good" : "default"}>{prompt.intent}</Pill></Td>
                              <Td>
                                <span className="text-[13px] text-brand-700">
                                  {/* An empty cell reads as zero. It means nobody
                                      estimated this one. */}
                                  {prompt.estimatedVolume?.toLocaleString() ?? (
                                    <span className="text-brand-400">not estimated</span>
                                  )}
                                </span>
                              </Td>
                            </Tr>
                          ))
                        ) : (
                          <Tr><Td colSpan={3} className="text-center text-sm text-[var(--text-muted)] py-4">No prompts tracked.</Td></Tr>
                        )}
                      </tbody>
                    </Table>
                  </Panel>
                </div>
              )}
            </Panel>
          )}

          {(activeTab === "custom") && (
            <Panel title="Saved Reports" subtitle="Pre-configured recurring reporting templates">
              <Table minWidth={700}>
                <thead>
                  <tr>
                    <Th>Report Name</Th>
                    <Th>Frequency</Th>
                    <Th>Recipients</Th>
                    <Th>Format</Th>
                  </tr>
                </thead>
                <tbody>
                  {(reporting.data?.customReports ?? []).length > 0 ? (
                    reporting.data?.customReports.map((report) => (
                      <Tr key={report.id}>
                        <Td><span className="font-medium text-brand-950">{report.name}</span></Td>
                        <Td><Pill tone="info">{report.frequency}</Pill></Td>
                        <Td><span className="text-[13px] text-brand-700">{report.recipients.join(", ")}</span></Td>
                        <Td><span className="text-[13px] text-brand-700">{report.format}</span></Td>
                      </Tr>
                    ))
                  ) : (
                    <Tr><Td colSpan={4} className="text-center text-sm text-[var(--text-muted)] py-4">No custom reports found.</Td></Tr>
                  )}
                </tbody>
              </Table>
            </Panel>
          )}

          {(activeTab === "client" || activeTab === "whitelabel") && (
            <div className="space-y-4">
              <Panel title="Client Portal Configuration" subtitle="Configure your client's white-labeled access">
                <div className="p-4 space-y-4">
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-brand-950 mb-1">Custom Domain</label>
                      <input 
                        type="text" 
                        readOnly 
                        value={reporting.data?.clientPortal.customDomain ?? ""} 
                        className="w-full text-sm px-3 py-2 border border-brand-200 rounded bg-brand-100 text-brand-700"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-brand-950 mb-1">Theme Color</label>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded border border-brand-200" style={{ backgroundColor: reporting.data?.clientPortal.themeColor ?? "var(--color-accent-600)" }}></div>
                        <span className="text-sm text-brand-700">{reporting.data?.clientPortal.themeColor}</span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-brand-950 mb-1">Portal Status</label>
                    <Pill tone={reporting.data?.clientPortal.isPublic ? "good" : "default"}>
                      {reporting.data?.clientPortal.isPublic ? "PUBLIC & ACTIVE" : "PRIVATE (DRAFT)"}
                    </Pill>
                  </div>
                </div>
              </Panel>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
