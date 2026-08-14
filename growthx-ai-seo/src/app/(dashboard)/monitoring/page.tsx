"use client";
import { useState } from "react";
import { PageHeader, Panel, Table, Th, Tr, Td, Pill, ActionButton } from "@/components/ui/console";
import { Activity, Bell, History, ShieldAlert, Zap, Loader2 } from "lucide-react";
import { useWorkspace, useActivity, useLatestCrawl, usePortfolio } from "@/hooks/use-growthx";
import { relativeTime } from "@/components/ui/console";

export default function MonitoringPage() {
  const [activeTab, setActiveTab] = useState("alerts");
  
  const { orgId, projectId } = useWorkspace();
  const portfolio = usePortfolio(orgId);
  const client = portfolio.data?.clients.find((c) => c.projectId === projectId) ?? null;
  const crawl = useLatestCrawl(client?.domain ?? null);
  const activities = useActivity(projectId);

  const tabs = [
    { id: "alerts", label: "Real-time Alerts", icon: Bell },
    { id: "changes", label: "Change Tracking", icon: History },
    { id: "algo", label: "Algorithm Updates", icon: Activity },
    { id: "status", label: "Status Dashboard", icon: ShieldAlert },
  ];

  const isLoading = activities.isLoading || crawl.isLoading;
  const activityData = activities.data ?? [];
  const crawlData = crawl.data;

  return (
    <div className="space-y-5">
      <PageHeader
        title="24/7 Monitoring & Alerts"
        subtitle="Real-time traffic drops, anomaly detection, and change tracking."
        actions={
          <ActionButton variant="secondary" icon={<Zap size={12} />}>
            Configure Alerts
          </ActionButton>
        }
      />

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

      <div className="pt-2 flex items-start gap-4">
        <div className="flex-1 space-y-4 w-full">
          
          {isLoading ? (
            <Panel>
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Loader2 size={32} className="text-[#e4e4e7] mb-4 animate-spin" />
                <p className="text-sm text-[var(--text-muted)]">Loading monitoring data...</p>
              </div>
            </Panel>
          ) : (
            <>
              {(activeTab === "alerts" || activeTab === "changes") && (
                <Panel title="Active Alerts & Activity" subtitle="AI-detected anomalies and system events.">
                  <Table minWidth={600}>
                    <thead>
                      <tr>
                        <Th>Time</Th>
                        <Th>Event Message</Th>
                        <Th>Status</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {activityData.length > 0 ? (
                        activityData.map((item) => (
                          <Tr key={item.id}>
                            <Td><span className="text-[13px] text-[#3f3f46] whitespace-nowrap">{relativeTime(item.time)}</span></Td>
                            <Td><span className="font-medium text-[#09090b]">{item.message}</span></Td>
                            <Td>
                              <Pill tone={item.status === "error" ? "bad" : item.status === "warning" ? "warn" : item.status === "success" ? "good" : "info"}>
                                {item.status.toUpperCase()}
                              </Pill>
                            </Td>
                          </Tr>
                        ))
                      ) : (
                        <Tr><Td colSpan={3} className="text-center text-sm text-[var(--text-muted)] py-4">No recent activity found.</Td></Tr>
                      )}
                    </tbody>
                  </Table>
                </Panel>
              )}
              
              {(activeTab === "algo") && (
                <Panel title="Algorithm Updates" subtitle="Search engine algorithm changes.">
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <Activity size={48} className="text-[#e4e4e7] mb-4" />
                    <h3 className="text-lg font-medium text-[var(--text-primary)]">Coming Soon</h3>
                    <p className="text-sm text-[var(--text-muted)] max-w-md mt-2">
                      This feature is currently in development.
                    </p>
                  </div>
                </Panel>
              )}

              {(activeTab === "status") && (
                <Panel title="Status Dashboard" subtitle="System health and scanning status for active property.">
                  <div className="p-4 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="border border-[#e4e4e7] p-4 rounded-md">
                        <h4 className="font-medium text-[15px] mb-2">Latest Crawl Job</h4>
                        <div className="text-sm text-[var(--text-muted)] space-y-2">
                          <p><strong>Status:</strong> <Pill tone={crawlData?.status === "COMPLETED" ? "good" : crawlData?.status === "FAILED" ? "bad" : "warn"}>{crawlData?.status || "UNKNOWN"}</Pill></p>
                          <p><strong>Pages Crawled:</strong> {crawlData?.pagesCrawled ?? 0}</p>
                          <p><strong>Started At:</strong> {crawlData?.startedAt ? relativeTime(crawlData.startedAt) : "N/A"}</p>
                        </div>
                      </div>
                      
                      <div className="border border-[#e4e4e7] p-4 rounded-md">
                        <h4 className="font-medium text-[15px] mb-2">Active Target</h4>
                        <div className="text-sm text-[var(--text-muted)] space-y-2">
                          <p><strong>Domain:</strong> {client?.domain || "Not configured"}</p>
                          <p><strong>Client Name:</strong> {client?.name || "Not configured"}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </Panel>
              )}
            </>
          )}

        </div>
      </div>
    </div>
  );
}
