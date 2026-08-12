"use client";
import { useState } from "react";
import { PageHeader, Panel, Kpi, Table, Th, Tr, Td, Pill, ActionButton } from "@/components/ui/console";
import { OpportunityDetailPanel } from "@/components/ui/opportunity-detail-panel";
import { TrendingUp, MessageSquare, Users, PieChart, Zap } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, BarChart, Bar, CartesianGrid } from "recharts";

export default function MarketPage() {
  const [activeTab, setActiveTab] = useState("trends");
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);

  const tabs = [
    { id: "trends", label: "Market Trends", icon: TrendingUp },
    { id: "sentiment", label: "Sentiment Analysis", icon: MessageSquare },
    { id: "audience", label: "Audience Insights", icon: Users },
    { id: "sov", label: "Share of Voice", icon: PieChart },
  ];

  const trendData = [
    { month: "Jan", volume: 4000 }, { month: "Feb", volume: 3000 }, { month: "Mar", volume: 2000 },
    { month: "Apr", volume: 2780 }, { month: "May", volume: 1890 }, { month: "Jun", volume: 2390 }
  ];

  const sovData = [
    { name: "GrowthX", share: 45, fill: "#2563eb" },
    { name: "Competitor A", share: 30, fill: "#f97316" },
    { name: "Competitor B", share: 15, fill: "#16a34a" },
    { name: "Others", share: 10, fill: "#a1a1aa" },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Market Intelligence"
        subtitle="Trends, Sentiment, Audience Insights, and Share of Voice."
        actions={
          <ActionButton variant="secondary" icon={<Zap size={12} />}>
            Generate Market Report
          </ActionButton>
        }
      />

      <div className="flex space-x-1 border-b border-[#e4e4e7] overflow-x-auto pb-[-1px]">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id);
              setSelectedTopic(null);
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
        <div className={`flex-1 space-y-4 ${selectedTopic ? "lg:max-w-[calc(100%-28rem)]" : "w-full"}`}>
          
          {(activeTab === "trends" || activeTab === "overview") && (
            <Panel title="Market Search Trends" subtitle="Search volume for core topics over time">
              <div className="h-[300px] px-3 pb-3 pt-6">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData}>
                    <defs>
                      <linearGradient id="colorVolume" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#a1a1aa" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "#a1a1aa" }} axisLine={false} tickLine={false} />
                    <Tooltip />
                    <Area type="monotone" dataKey="volume" stroke="#2563eb" fillOpacity={1} fill="url(#colorVolume)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Panel>
          )}

          {(activeTab === "sov" || activeTab === "overview") && (
            <Panel title="Share of Voice (SOV)" subtitle="Brand visibility across target keyword clusters">
               <div className="h-[250px] px-3 pb-3 pt-6">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={sovData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10, fill: "#a1a1aa" }} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 12, fill: "#3f3f46" }} width={100} />
                    <Tooltip cursor={{fill: 'transparent'}} />
                    <Bar dataKey="share" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Panel>
          )}

          {(activeTab === "audience" || activeTab === "trends" || activeTab === "overview") && (
            <Panel title="Trending Topics" subtitle="Emerging themes in your target market">
              <Table minWidth={720}>
                <thead>
                  <tr>
                    <Th>Topic</Th>
                    <Th>Growth</Th>
                    <Th>Sentiment</Th>
                    <Th>Relevance</Th>
                    <Th align="right">Action</Th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { id: "1", topic: "AI in Interior Design", growth: "+145%", sent: "Positive", rel: "High" },
                    { id: "2", topic: "Sustainable Materials", growth: "+82%", sent: "Positive", rel: "High" },
                    { id: "3", topic: "Minimalist Kitchens", growth: "+41%", sent: "Neutral", rel: "Medium" },
                  ].map((row) => (
                    <Tr key={row.id} className="cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => setSelectedTopic(row.id)}>
                      <Td className="font-medium text-[#09090b]">{row.topic}</Td>
                      <Td className="text-[#16a34a] font-medium">{row.growth}</Td>
                      <Td><Pill tone={row.sent === "Positive" ? "good" : "default"}>{row.sent}</Pill></Td>
                      <Td><Pill tone={row.rel === "High" ? "warn" : "default"}>{row.rel}</Pill></Td>
                      <Td align="right">
                        <ActionButton variant="secondary" onClick={(e) => { e.stopPropagation(); setSelectedTopic(row.id); }}>
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

        {selectedTopic && (
          <div className="w-[26rem] flex-shrink-0 animate-in fade-in slide-in-from-right-4 duration-300 hidden lg:block sticky top-4">
            <OpportunityDetailPanel 
              title={selectedTopic === "1" ? "Capitalize on 'AI in Interior Design'" : "Content Strategy for Sustainable Materials"}
              evidence={[
                "Topic has grown 145% YoY in search volume.",
                "Audience sentiment is overwhelmingly positive.",
                "Low competition for high-intent long-tail keywords."
              ]}
              businessImpact="Positions your brand as a market leader, driving high-quality top-of-funnel traffic."
              recommendedAction="Create a pillar page and supporting blog posts around this topic."
              aiRecommendation="Generate content briefs for 5 related sub-topics."
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
