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
        <div className="flex-1 space-y-4 w-full">
          
          {(activeTab === "trends" || activeTab === "overview") && (
            <Panel title="Market Search Trends" subtitle="Search volume for core topics over time">
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <TrendingUp size={48} className="text-[#e4e4e7] mb-4" />
                <h3 className="text-lg font-medium text-[var(--text-primary)]">Trends Coming Soon</h3>
                <p className="text-sm text-[var(--text-muted)] max-w-md mt-2">
                  This feature is currently in development.
                </p>
              </div>
            </Panel>
          )}

          {(activeTab === "sov" || activeTab === "overview") && (
            <Panel title="Share of Voice (SOV)" subtitle="Brand visibility across target keyword clusters">
               <div className="flex flex-col items-center justify-center py-16 text-center">
                <PieChart size={48} className="text-[#e4e4e7] mb-4" />
                <h3 className="text-lg font-medium text-[var(--text-primary)]">SOV Analysis Coming Soon</h3>
                <p className="text-sm text-[var(--text-muted)] max-w-md mt-2">
                  This feature is currently in development.
                </p>
              </div>
            </Panel>
          )}
          
          {(activeTab === "sentiment") && (
            <Panel title="Sentiment Analysis" subtitle="Customer feedback and market sentiment">
               <div className="flex flex-col items-center justify-center py-16 text-center">
                <MessageSquare size={48} className="text-[#e4e4e7] mb-4" />
                <h3 className="text-lg font-medium text-[var(--text-primary)]">Sentiment Analysis Coming Soon</h3>
                <p className="text-sm text-[var(--text-muted)] max-w-md mt-2">
                  This feature is currently in development.
                </p>
              </div>
            </Panel>
          )}

          {(activeTab === "audience" || activeTab === "trends" || activeTab === "overview") && (
            <Panel title="Trending Topics" subtitle="Emerging themes in your target market">
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Users size={48} className="text-[#e4e4e7] mb-4" />
                <h3 className="text-lg font-medium text-[var(--text-primary)]">Audience Insights Coming Soon</h3>
                <p className="text-sm text-[var(--text-muted)] max-w-md mt-2">
                  This feature is currently in development.
                </p>
              </div>
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}
