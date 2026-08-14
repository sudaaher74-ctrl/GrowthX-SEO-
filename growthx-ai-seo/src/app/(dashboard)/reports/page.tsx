"use client";
import { useState } from "react";
import { PageHeader, Panel, Kpi, Table, Th, Tr, Td, Pill, ActionButton, Mono } from "@/components/ui/console";
import { LayoutDashboard, FileBarChart, Users, FileSignature, Download, Loader2 } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, BarChart, Bar, CartesianGrid } from "recharts";
import { useWorkspace, usePortfolio, useLatestCrawl, useCrawlIssues, useVisibility, useTrackedPrompts } from "@/hooks/use-growthx";
import { QueryState } from "@/components/ui/upgrade-prompt";

export default function ReportsPage() {
  const { orgId, projectId, projects } = useWorkspace();
  const portfolio = usePortfolio(orgId);
  const client = portfolio.data?.clients.find((c) => c.projectId === projectId) ?? null;
  const crawl = useLatestCrawl(client?.domain ?? null);
  const issues = useCrawlIssues(crawl.data?.id ?? null);
  const visibility = useVisibility(projectId);
  const prompts = useTrackedPrompts(projectId);

  const [activeTab, setActiveTab] = useState("executive");
  const [selectedReport, setSelectedReport] = useState<string | null>(null);

  const tabs = [
    { id: "executive", label: "Executive Dashboard", icon: LayoutDashboard },
    { id: "custom", label: "Custom Reports", icon: FileBarChart },
    { id: "client", label: "Client Portal", icon: Users },
    { id: "whitelabel", label: "White-label", icon: FileSignature },
  ];

  const isLoading = portfolio.isLoading || crawl.isLoading || issues.isLoading || visibility.isLoading || prompts.isLoading;

  // Calculate KPIs
  const allIssues = issues.data?.data ?? [];
  const criticalCount = allIssues.filter(i => i.severity === "CRITICAL").length;
  const highCount = allIssues.filter(i => i.severity === "HIGH").length;
  const technicalHealth = Math.max(0, 100 - (criticalCount * 5) - (highCount * 2));

  const trackedPrompts = prompts.data ?? [];
  const totalVolume = trackedPrompts.reduce((acc, curr) => acc + (curr.estimatedVolume ?? 0), 0);
  
  const citationShare = visibility.data?.summary?.citationSharePct ?? 0;

  const severityRank: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
  const topIssues = [...allIssues]
    .sort((a, b) => (severityRank[a.severity] ?? 9) - (severityRank[b.severity] ?? 9))
    .slice(0, 5);

  const trafficData = [
    { month: "Jan", traffic: 4000 }, { month: "Feb", traffic: 4500 }, { month: "Mar", traffic: 5100 },
    { month: "Apr", traffic: 5800 }, { month: "May", traffic: 6200 }, { month: "Jun", traffic: 7100 }
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Automated Reporting"
        subtitle="Executive summaries, custom reports, and client portal settings."
        actions={
          <ActionButton variant="primary" icon={<Download size={12} />}>
            Export PDF Report
          </ActionButton>
        }
      />

      <div className="flex space-x-1 border-b border-[#e4e4e7] overflow-x-auto pb-[-1px]">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id);
              setSelectedReport(null);
            }}
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

      <div className="pt-2 flex items-start gap-4">
        <div className="flex-1 space-y-4 w-full">
          
          {(activeTab === "executive") && (
            <Panel title="Executive Dashboard" subtitle={client?.domain ? `Live report for ${client.domain}` : "Select a project"}>
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Loader2 size={32} className="text-[#e4e4e7] mb-4 animate-spin" />
                  <p className="text-sm text-[var(--text-muted)]">Loading executive metrics...</p>
                </div>
              ) : (
                <div className="space-y-6 mt-4 p-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Kpi label="Technical Health" value={technicalHealth.toString()} deltaSuffix="/ 100" />
                    <Kpi label="Citation Share" value={citationShare.toFixed(1)} deltaSuffix="%" />
                    <Kpi label="Search Volume Pot." value={totalVolume.toLocaleString()} />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <Panel title="Traffic Trend (Estimated)">
                        <div className="h-64 mt-4 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={trafficData}>
                              <defs>
                                <linearGradient id="colorTraffic" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3} />
                                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e5e5" />
                              <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#71717a" }} dy={10} />
                              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#71717a" }} />
                              <Tooltip
                                contentStyle={{ borderRadius: "8px", border: "1px solid #e5e5e5", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
                              />
                              <Area type="monotone" dataKey="traffic" stroke="#2563eb" strokeWidth={2} fillOpacity={1} fill="url(#colorTraffic)" />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
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
                                  <Td><span className="text-[13px] text-[#09090b] font-medium">{issue.issueType.replace(/_/g, ' ')}</span></Td>
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
                              <Td><span className="text-[13px] text-[#3f3f46]">{prompt.estimatedVolume?.toLocaleString()}</span></Td>
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

          {(activeTab === "custom" || activeTab === "client" || activeTab === "whitelabel") && (
            <Panel title="Saved Reports" subtitle="Pre-configured reporting templates">
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <FileSignature size={48} className="text-[#e4e4e7] mb-4" />
                <h3 className="text-lg font-medium text-[var(--text-primary)]">Coming Soon</h3>
                <p className="text-sm text-[var(--text-muted)] max-w-md mt-2">
                  This feature is currently in development. Check back later!
                </p>
              </div>
            </Panel>
          )}

        </div>
      </div>
    </div>
  );
}
