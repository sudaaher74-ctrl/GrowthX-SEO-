"use client";
import { useState } from "react";
import { PageHeader, Panel, Table, Th, Tr, Td, Pill, ActionButton } from "@/components/ui/console";
import { TrendingUp, MessageSquare, Users, PieChart, Zap, Loader2 } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import { useWorkspace, useVisibility, useMarketIntelligence } from "@/hooks/use-growthx";

export default function MarketPage() {
  const { projectId } = useWorkspace();
  const visibility = useVisibility(projectId);
  const { data: market } = useMarketIntelligence(projectId);
  
  const [activeTab, setActiveTab] = useState("trends");

  const tabs = [
    { id: "trends", label: "Market Trends", icon: TrendingUp },
    { id: "sov", label: "Share of Voice", icon: PieChart },
    { id: "sentiment", label: "Sentiment Analysis", icon: MessageSquare },
    { id: "audience", label: "Audience Insights", icon: Users },
  ];

  const trendData = visibility.data?.trend?.map((t, i) => ({
    week: `W${i + 1}`,
    share: t.citationSharePct
  })) || [];

  const sovData = visibility.data?.shareOfVoice || [];

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
          
          {visibility.isLoading ? (
            <Panel>
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Loader2 size={32} className="text-[#e4e4e7] mb-4 animate-spin" />
                <p className="text-sm text-[var(--text-muted)]">Loading market data...</p>
              </div>
            </Panel>
          ) : (
            <>
              {(activeTab === "trends" || activeTab === "overview") && (
                <Panel title="Market Search Trends" subtitle="AI Citation Share over time">
                  {trendData.length > 0 ? (
                    <div className="h-64 mt-4 w-full p-4">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={trendData}>
                          <defs>
                            <linearGradient id="colorShare" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3} />
                              <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e5e5" />
                          <XAxis dataKey="week" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#71717a" }} dy={10} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#71717a" }} tickFormatter={(val) => `${val}%`} />
                          <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid #e5e5e5" }} />
                          <Area type="monotone" dataKey="share" stroke="#2563eb" strokeWidth={2} fillOpacity={1} fill="url(#colorShare)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <TrendingUp size={48} className="text-[#e4e4e7] mb-4" />
                      <p className="text-sm text-[var(--text-muted)]">No trend data available yet.</p>
                    </div>
                  )}
                </Panel>
              )}

              {(activeTab === "sov" || activeTab === "overview") && (
                <Panel title="Share of Voice (SOV)" subtitle="Brand visibility across AI assistants and target queries">
                  {sovData.length > 0 ? (
                    <Table minWidth={600}>
                      <thead>
                        <tr>
                          <Th>Domain / Entity</Th>
                          <Th>Label</Th>
                          <Th>Mentions</Th>
                          <Th>Share %</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {sovData.map((sov, i) => (
                          <Tr key={i}>
                            <Td><span className="font-medium text-[#09090b]">{sov.domain || "Unknown"}</span></Td>
                            <Td><Pill>{sov.label}</Pill></Td>
                            <Td><span className="text-[13px] text-[#3f3f46]">{sov.mentions}</span></Td>
                            <Td><span className="text-[13px] text-[#3f3f46]">{sov.sharePct.toFixed(1)}%</span></Td>
                          </Tr>
                        ))}
                      </tbody>
                    </Table>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <PieChart size={48} className="text-[#e4e4e7] mb-4" />
                      <p className="text-sm text-[var(--text-muted)]">No SOV data available yet.</p>
                    </div>
                  )}
                </Panel>
              )}
              
              {(activeTab === "sentiment") && (
                <Panel title="Sentiment Analysis" subtitle="Customer feedback and market sentiment">
                  <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="border border-[#e4e4e7] rounded-md p-4">
                      <h3 className="text-sm font-medium text-[var(--text-muted)] mb-1">Sentiment Score</h3>
                      <p className="text-2xl font-bold text-[#09090b]">
                        {market?.sentimentScore !== undefined ? (market.sentimentScore > 0 ? `+${market.sentimentScore}` : market.sentimentScore) : "N/A"}
                      </p>
                    </div>
                    <div className="border border-[#e4e4e7] rounded-md p-4">
                      <h3 className="text-sm font-medium text-[var(--text-muted)] mb-1">Summary</h3>
                      <p className="text-sm text-[#09090b]">
                        {market?.sentimentSummary || "No summary available."}
                      </p>
                    </div>
                  </div>
                </Panel>
              )}

              {(activeTab === "audience") && (
                <Panel title="Trending Topics" subtitle="Emerging themes in your target market">
                  <div className="p-4">
                    {market?.trendingTopics && market.trendingTopics.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {market.trendingTopics.map((topic, i) => (
                          <Pill key={i}>{topic}</Pill>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-[var(--text-muted)]">No trending topics available.</p>
                    )}
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
