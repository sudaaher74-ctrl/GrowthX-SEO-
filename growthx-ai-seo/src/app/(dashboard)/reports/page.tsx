"use client";
import { useState } from "react";
import { PageHeader, Panel, Kpi, Table, Th, Tr, Td, Pill, ActionButton } from "@/components/ui/console";
import { OpportunityDetailPanel } from "@/components/ui/opportunity-detail-panel";
import { LayoutDashboard, FileBarChart, Users, FileSignature, Download } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, BarChart, Bar, CartesianGrid } from "recharts";

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState("executive");
  const [selectedReport, setSelectedReport] = useState<string | null>(null);

  const tabs = [
    { id: "executive", label: "Executive Dashboard", icon: LayoutDashboard },
    { id: "custom", label: "Custom Reports", icon: FileBarChart },
    { id: "client", label: "Client Portal", icon: Users },
    { id: "whitelabel", label: "White-label", icon: FileSignature },
  ];

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
        <div className={`flex-1 space-y-4 ${selectedReport ? "lg:max-w-[calc(100%-28rem)]" : "w-full"}`}>
          
          {(activeTab === "executive") && (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Kpi label="Total Traffic (30d)" value="74.2k" delta={12.5} deltaSuffix="%" tone="good" />
                <Kpi label="Conversions" value="1,204" delta={8.2} deltaSuffix="%" tone="good" />
                <Kpi label="Avg. Rank Position" value="14.3" delta={2.1} tone="good" />
                <Kpi label="AI Fixes Deployed" value="28" delta={5} tone="good" />
              </div>

              <Panel title="Organic Traffic Growth" subtitle="6-month trailing performance">
                <div className="h-[300px] px-3 pb-3 pt-6">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trafficData}>
                      <defs>
                        <linearGradient id="colorTraffic" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#16a34a" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#16a34a" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#a1a1aa" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: "#a1a1aa" }} axisLine={false} tickLine={false} />
                      <Tooltip />
                      <Area type="monotone" dataKey="traffic" stroke="#16a34a" fillOpacity={1} fill="url(#colorTraffic)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </Panel>
            </>
          )}

          {(activeTab === "custom" || activeTab === "client") && (
            <Panel title="Saved Reports" subtitle="Pre-configured reporting templates">
              <Table minWidth={720}>
                <thead>
                  <tr>
                    <Th>Report Name</Th>
                    <Th>Frequency</Th>
                    <Th>Last Generated</Th>
                    <Th>Format</Th>
                    <Th align="right">Action</Th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { id: "1", name: "Monthly SEO Executive Summary", freq: "Monthly", last: "Aug 1, 2026", format: "PDF" },
                    { id: "2", name: "Weekly Keyword Movements", freq: "Weekly", last: "Aug 8, 2026", format: "CSV" },
                    { id: "3", name: "Technical SEO Audit", freq: "On Demand", last: "Jul 15, 2026", format: "PDF" },
                  ].map((row) => (
                    <Tr key={row.id} className="cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => setSelectedReport(row.id)}>
                      <Td className="font-medium text-[#09090b]">{row.name}</Td>
                      <Td className="text-[#3f3f46]">{row.freq}</Td>
                      <Td className="text-[#71717a]">{row.last}</Td>
                      <Td><Pill tone="default">{row.format}</Pill></Td>
                      <Td align="right">
                        <ActionButton variant="secondary" onClick={(e) => { e.stopPropagation(); setSelectedReport(row.id); }}>
                          View
                        </ActionButton>
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </Panel>
          )}

        </div>

        {selectedReport && (
          <div className="w-[26rem] flex-shrink-0 animate-in fade-in slide-in-from-right-4 duration-300 hidden lg:block sticky top-4">
            <OpportunityDetailPanel 
              title={selectedReport === "1" ? "Monthly SEO Executive Summary" : "Weekly Keyword Movements"}
              evidence={[
                "Covers 30-day performance across all 15 engines.",
                "Includes ROI metrics and AI action logs.",
                "Automatically emailed to stakeholders."
              ]}
              businessImpact="Keeps leadership informed on SEO ROI and justifies ongoing marketing spend."
              recommendedAction="Review the latest report and add any custom executive commentary before sending."
              aiRecommendation="Use AI to generate a 3-bullet summary of the report."
              affectedPagesCount={0}
              estimatedImpact="High confidence"
              onAnalyze={() => {}}
              onGenerateContent={() => {}}
            />
          </div>
        )}
      </div>
    </div>
  );
}
