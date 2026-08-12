"use client";
import { useState } from "react";
import { PageHeader, Panel, Kpi, Table, Th, Tr, Td, Pill, ActionButton } from "@/components/ui/console";
import { OpportunityDetailPanel } from "@/components/ui/opportunity-detail-panel";
import { Search, BarChart3, LineChart, Hash, Layout, TrendingUp, Zap } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export default function SearchPage() {
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedKeyword, setSelectedKeyword] = useState<string | null>(null);

  const tabs = [
    { id: "overview", label: "Search Overview", icon: Layout },
    { id: "gsc", label: "Google Search Console", icon: BarChart3 },
    { id: "keywords", label: "Keywords", icon: Hash },
    { id: "opportunities", label: "Keyword Opportunities", icon: Zap },
    { id: "pages", label: "Pages", icon: Layout },
    { id: "trends", label: "Search Trends", icon: TrendingUp },
  ];

  // Dummy data for charts
  const trend = [
    { week: "W1", clicks: 1200 }, { week: "W2", clicks: 1350 }, { week: "W3", clicks: 1400 },
    { week: "W4", clicks: 1800 }, { week: "W5", clicks: 2100 }, { week: "W6", clicks: 2500 }
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Search Intelligence"
        subtitle="Keyword Intelligence and Google Search Console data."
        actions={
          <ActionButton variant="secondary" icon={<Zap size={12} />}>
            Find Opportunities
          </ActionButton>
        }
      />

      {/* Sub-navigation Tabs */}
      <div className="flex space-x-1 border-b border-[#e4e4e7] overflow-x-auto pb-[-1px]">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id);
              setSelectedKeyword(null);
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
        {/* Main Content Area */}
        <div className={`flex-1 space-y-4 ${selectedKeyword ? "lg:max-w-[calc(100%-28rem)]" : "w-full"}`}>
          
          {/* GSC Overview Panel */}
          {(activeTab === "gsc" || activeTab === "overview") && (
            <Panel 
              title="Google Search Console" 
              subtitle={
                <span className="flex items-center gap-2 text-[11px]">
                  <span className="flex items-center gap-1 text-[#16a34a] font-semibold"><span className="w-1.5 h-1.5 rounded-full bg-[#16a34a]"></span> Connected</span>
                  <span>· Property: https://example.com · Last synced: Today, 10:42 AM</span>
                </span>
              }
            >
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 p-6 text-center border-b border-[#f4f4f5]">
                <div className="flex flex-col gap-1">
                  <span className="text-[13px] text-[#71717a] font-medium">Clicks</span>
                  <span className="text-xl font-bold text-[#09090b]">12,482</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[13px] text-[#71717a] font-medium">Impressions</span>
                  <span className="text-xl font-bold text-[#09090b]">384,291</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[13px] text-[#71717a] font-medium">CTR</span>
                  <span className="text-xl font-bold text-[#09090b]">3.25%</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[13px] text-[#71717a] font-medium">Average Position</span>
                  <span className="text-xl font-bold text-[#09090b]">12.4</span>
                </div>
              </div>
              <div className="h-[220px] px-3 pb-3 pt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trend}>
                    <defs>
                      <linearGradient id="ov" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#2563eb" stopOpacity={0.22} />
                        <stop offset="100%" stopColor="#2563eb" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="week" tick={{ fontSize: 10, fill: "#a1a1aa" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "#a1a1aa" }} axisLine={false} tickLine={false} width={40} />
                    <Tooltip />
                    <Area type="monotone" dataKey="clicks" stroke="#2563eb" strokeWidth={2} fill="url(#ov)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Panel>
          )}

          {/* Keyword Opportunities */}
          {(activeTab === "opportunities" || activeTab === "overview") && (
            <Panel title="Keyword Opportunities" subtitle="Striking-distance and high-impression keywords">
              <Table minWidth={720}>
                <thead>
                  <tr>
                    <Th>Keyword</Th>
                    <Th>Position</Th>
                    <Th>Impressions</Th>
                    <Th>CTR</Th>
                    <Th>Clicks</Th>
                    <Th>Opportunity</Th>
                    <Th align="right">Action</Th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { id: "1", kw: "interior designer navi mumbai", pos: 8, imp: "12,400", ctr: "1.8%", clk: 223, opp: "HIGH" },
                    { id: "2", kw: "best modular kitchen setup", pos: 11, imp: "8,900", ctr: "0.9%", clk: 80, opp: "HIGH" },
                    { id: "3", kw: "living room false ceiling", pos: 14, imp: "15,200", ctr: "0.4%", clk: 60, opp: "MEDIUM" },
                  ].map((row) => (
                    <Tr key={row.id} className="cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => setSelectedKeyword(row.id)}>
                      <Td className="font-medium text-[#09090b]">{row.kw}</Td>
                      <Td>{row.pos}</Td>
                      <Td>{row.imp}</Td>
                      <Td>{row.ctr}</Td>
                      <Td>{row.clk}</Td>
                      <Td><Pill tone={row.opp === "HIGH" ? "warn" : "default"}>{row.opp}</Pill></Td>
                      <Td align="right">
                        <ActionButton variant="secondary" onClick={(e) => { e.stopPropagation(); setSelectedKeyword(row.id); }}>
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

        {/* Right Side Detail Panel */}
        {selectedKeyword && (
          <div className="w-[26rem] flex-shrink-0 animate-in fade-in slide-in-from-right-4 duration-300 hidden lg:block sticky top-4">
            <OpportunityDetailPanel 
              title={selectedKeyword === "1" ? "Improve CTR for interior designer navi mumbai" : "Push keyword to Page 1"}
              evidence={[
                "Keyword has 12,400 impressions",
                "Currently ranking at position 8",
                "CTR is significantly below average (1.8%)"
              ]}
              businessImpact="Moving from pos 8 to pos 3 could yield ~1,200 additional monthly clicks."
              recommendedAction="Optimize the landing page title and meta description. Add targeted FAQs."
              aiRecommendation="Generate optimized metadata for the associated landing page."
              affectedPagesCount={1}
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
