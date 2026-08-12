"use client";
import { useState } from "react";
import { PageHeader, Panel, Kpi, Table, Th, Tr, Td, Pill, ActionButton } from "@/components/ui/console";
import { OpportunityDetailPanel } from "@/components/ui/opportunity-detail-panel";
import { MapPin, Star, Link as LinkIcon, BarChart3, Zap } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export default function LocalPage() {
  const [activeTab, setActiveTab] = useState("gbp");
  const [selectedIssue, setSelectedIssue] = useState<string | null>(null);

  const tabs = [
    { id: "gbp", label: "Google Business Profile", icon: MapPin },
    { id: "reviews", label: "Reviews & Ratings", icon: Star },
    { id: "citations", label: "Citations", icon: LinkIcon },
    { id: "rankings", label: "Local Rankings", icon: BarChart3 },
  ];

  const trend = [
    { week: "W1", views: 2400 }, { week: "W2", views: 2600 }, { week: "W3", views: 2500 },
    { week: "W4", views: 3200 }, { week: "W5", views: 3800 }, { week: "W6", views: 4100 }
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Local SEO"
        subtitle="Google Business Profile, Reviews, and Local Rankings."
        actions={
          <ActionButton variant="secondary" icon={<Zap size={12} />}>
            Run Local Audit
          </ActionButton>
        }
      />

      <div className="flex space-x-1 border-b border-[#e4e4e7] overflow-x-auto pb-[-1px]">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id);
              setSelectedIssue(null);
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
        <div className={`flex-1 space-y-4 ${selectedIssue ? "lg:max-w-[calc(100%-28rem)]" : "w-full"}`}>
          
          {(activeTab === "gbp" || activeTab === "overview") && (
            <Panel 
              title="Google Business Profile Performance" 
              subtitle="Profile views and interactions over the last 30 days"
            >
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 p-6 text-center border-b border-[#f4f4f5]">
                <div className="flex flex-col gap-1">
                  <span className="text-[13px] text-[#71717a] font-medium">Profile Views</span>
                  <span className="text-xl font-bold text-[#09090b]">18,600</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[13px] text-[#71717a] font-medium">Searches</span>
                  <span className="text-xl font-bold text-[#09090b]">8,420</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[13px] text-[#71717a] font-medium">Website Clicks</span>
                  <span className="text-xl font-bold text-[#09090b]">482</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[13px] text-[#71717a] font-medium">Direction Requests</span>
                  <span className="text-xl font-bold text-[#09090b]">315</span>
                </div>
              </div>
              <div className="h-[220px] px-3 pb-3 pt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trend}>
                    <defs>
                      <linearGradient id="ov2" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f97316" stopOpacity={0.22} />
                        <stop offset="100%" stopColor="#f97316" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="week" tick={{ fontSize: 10, fill: "#a1a1aa" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "#a1a1aa" }} axisLine={false} tickLine={false} width={40} />
                    <Tooltip />
                    <Area type="monotone" dataKey="views" stroke="#f97316" strokeWidth={2} fill="url(#ov2)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Panel>
          )}

          {(activeTab === "reviews" || activeTab === "gbp") && (
            <Panel title="Actionable Local Tasks" subtitle="Tasks identified to improve local ranking">
              <Table minWidth={720}>
                <thead>
                  <tr>
                    <Th>Task</Th>
                    <Th>Category</Th>
                    <Th>Impact</Th>
                    <Th>Status</Th>
                    <Th align="right">Action</Th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { id: "1", task: "Reply to 14 unresponded Google Reviews", cat: "Reviews", impact: "HIGH", stat: "Pending" },
                    { id: "2", task: "Add missing Products to GBP", cat: "GBP Optimization", impact: "MEDIUM", stat: "Pending" },
                    { id: "3", task: "Fix inconsistent NAP citations (Yelp, YellowPages)", cat: "Citations", impact: "HIGH", stat: "Pending" },
                  ].map((row) => (
                    <Tr key={row.id} className="cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => setSelectedIssue(row.id)}>
                      <Td className="font-medium text-[#09090b]">{row.task}</Td>
                      <Td className="text-[#71717a]">{row.cat}</Td>
                      <Td><Pill tone={row.impact === "HIGH" ? "warn" : "default"}>{row.impact}</Pill></Td>
                      <Td><span className="text-xs font-semibold uppercase tracking-wider text-[#71717a]">{row.stat}</span></Td>
                      <Td align="right">
                        <ActionButton variant="secondary" onClick={(e) => { e.stopPropagation(); setSelectedIssue(row.id); }}>
                          Analyze
                        </ActionButton>
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </Panel>
          )}
        </div>

        {selectedIssue && (
          <div className="w-[26rem] flex-shrink-0 animate-in fade-in slide-in-from-right-4 duration-300 hidden lg:block sticky top-4">
            <OpportunityDetailPanel 
              title={selectedIssue === "1" ? "Reply to 14 unresponded Google Reviews" : "Fix inconsistent NAP citations"}
              evidence={[
                "14 recent reviews have no response.",
                "Responsive businesses are favored by Google Local algorithm."
              ]}
              businessImpact="Improves customer trust and local map pack rankings."
              recommendedAction="Generate professional, personalized responses to the reviews."
              aiRecommendation="Use AI to generate 14 review responses."
              affectedPagesCount={14}
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
