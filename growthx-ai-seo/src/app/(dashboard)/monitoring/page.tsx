"use client";
import { useState } from "react";
import { PageHeader, Panel, Table, Th, Tr, Td, Pill, ActionButton } from "@/components/ui/console";
import { OpportunityDetailPanel } from "@/components/ui/opportunity-detail-panel";
import { Activity, Bell, History, ShieldAlert, Zap } from "lucide-react";

export default function MonitoringPage() {
  const [activeTab, setActiveTab] = useState("alerts");
  const [selectedAlert, setSelectedAlert] = useState<string | null>(null);

  const tabs = [
    { id: "alerts", label: "Real-time Alerts", icon: Bell },
    { id: "changes", label: "Change Tracking", icon: History },
    { id: "algo", label: "Algorithm Updates", icon: Activity },
    { id: "status", label: "Status Dashboard", icon: ShieldAlert },
  ];

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
            onClick={() => {
              setActiveTab(tab.id);
              setSelectedAlert(null);
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
        <div className={`flex-1 space-y-4 ${selectedAlert ? "lg:max-w-[calc(100%-28rem)]" : "w-full"}`}>
          
          {(activeTab === "alerts" || activeTab === "changes") && (
            <Panel title="Active Alerts" subtitle="AI-detected anomalies requiring immediate attention.">
              <Table minWidth={720}>
                <thead>
                  <tr>
                    <Th>Alert Description</Th>
                    <Th>Detected</Th>
                    <Th>Severity</Th>
                    <Th>Status</Th>
                    <Th align="right">Action</Th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { id: "1", desc: "Traffic dropped by 14% on /services", time: "2 hours ago", sev: "High", stat: "Unresolved" },
                    { id: "2", desc: "404 Error spike detected (42 hits)", time: "5 hours ago", sev: "Medium", stat: "Unresolved" },
                    { id: "3", desc: "Competitor B overtook #1 rank for 'Kitchen Reno'", time: "1 day ago", sev: "Medium", stat: "Investigating" },
                  ].map((row) => (
                    <Tr key={row.id} className="cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => setSelectedAlert(row.id)}>
                      <Td className="font-medium text-[#09090b]">{row.desc}</Td>
                      <Td className="text-[#71717a]">{row.time}</Td>
                      <Td><Pill tone={row.sev === "High" ? "bad" : "warn"}>{row.sev}</Pill></Td>
                      <Td><Pill tone={row.stat === "Unresolved" ? "default" : "warn"}>{row.stat}</Pill></Td>
                      <Td align="right">
                        <ActionButton variant="secondary" onClick={(e) => { e.stopPropagation(); setSelectedAlert(row.id); }}>
                          Diagnose
                        </ActionButton>
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </Panel>
          )}

          {(activeTab === "changes" || activeTab === "algo") && (
             <Panel title="Recent Changes Timeline" subtitle="Log of all automated fixes and algorithm shifts.">
                <div className="p-6">
                  <div className="relative border-l border-[#e4e4e7] ml-3 space-y-6">
                    <div className="pl-6 relative">
                      <div className="absolute w-3 h-3 bg-[#2563eb] rounded-full -left-[6.5px] top-1.5 ring-4 ring-white" />
                      <p className="text-sm font-medium text-[#09090b]">Google Core Update Volatility Detected</p>
                      <p className="text-xs text-[#71717a] mt-1">Today at 10:45 AM • SERP sensors show 8.4/10 volatility.</p>
                    </div>
                    <div className="pl-6 relative">
                      <div className="absolute w-3 h-3 bg-[#16a34a] rounded-full -left-[6.5px] top-1.5 ring-4 ring-white" />
                      <p className="text-sm font-medium text-[#09090b]">AI Engineer deployed: Fix missing canonical tags</p>
                      <p className="text-xs text-[#71717a] mt-1">Yesterday at 4:30 PM • 14 files modified.</p>
                    </div>
                    <div className="pl-6 relative">
                      <div className="absolute w-3 h-3 bg-[#f97316] rounded-full -left-[6.5px] top-1.5 ring-4 ring-white" />
                      <p className="text-sm font-medium text-[#09090b]">LCP dropped below 2.5s threshold on homepage</p>
                      <p className="text-xs text-[#71717a] mt-1">Aug 10th at 9:15 AM • Alert triggered.</p>
                    </div>
                  </div>
                </div>
             </Panel>
          )}

        </div>

        {selectedAlert && (
          <div className="w-[26rem] flex-shrink-0 animate-in fade-in slide-in-from-right-4 duration-300 hidden lg:block sticky top-4">
            <OpportunityDetailPanel 
              title={selectedAlert === "1" ? "Traffic dropped by 14% on /services" : "404 Error spike detected"}
              evidence={[
                "Compared to rolling 7-day average.",
                "Primary source of drop: Google Organic Mobile.",
                "No known Google updates occurring today."
              ]}
              businessImpact="Could result in a loss of ~4-6 leads per day if left unresolved."
              recommendedAction={selectedAlert === "1" ? "Run Technical SEO Audit on /services to check for rendering issues." : "Implement 301 redirects for the 404 paths."}
              aiRecommendation="Use AI Engineer to automatically trace the root cause in the server logs."
              affectedPagesCount={1}
              estimatedImpact="High confidence"
              onAnalyze={() => {}}
              onGenerateFix={() => {}}
            />
          </div>
        )}
      </div>
    </div>
  );
}
