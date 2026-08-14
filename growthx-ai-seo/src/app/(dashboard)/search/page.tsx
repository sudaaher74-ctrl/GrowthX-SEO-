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
        <div className="flex-1 space-y-4 w-full">
          
          {/* GSC Overview Panel */}
          {(activeTab === "gsc" || activeTab === "overview") && (
            <Panel 
              title="Google Search Console" 
              subtitle="Connect to GSC to view data"
            >
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <BarChart3 size={48} className="text-[#e4e4e7] mb-4" />
                <h3 className="text-lg font-medium text-[var(--text-primary)]">GSC Integration Coming Soon</h3>
                <p className="text-sm text-[var(--text-muted)] max-w-md mt-2">
                  This feature is currently in development.
                </p>
              </div>
            </Panel>
          )}

          {/* Keyword Opportunities */}
          {(activeTab === "opportunities" || activeTab === "overview") && (
            <Panel title="Keyword Opportunities" subtitle="Striking-distance and high-impression keywords">
               <div className="flex flex-col items-center justify-center py-16 text-center">
                <Zap size={48} className="text-[#e4e4e7] mb-4" />
                <h3 className="text-lg font-medium text-[var(--text-primary)]">Keyword Opportunities Coming Soon</h3>
                <p className="text-sm text-[var(--text-muted)] max-w-md mt-2">
                  This feature is currently in development.
                </p>
              </div>
            </Panel>
          )}

          {(activeTab === "keywords") && (
            <Panel title="Keywords" subtitle="Tracked keyword positions">
               <div className="flex flex-col items-center justify-center py-16 text-center">
                <Hash size={48} className="text-[#e4e4e7] mb-4" />
                <h3 className="text-lg font-medium text-[var(--text-primary)]">Keywords Coming Soon</h3>
                <p className="text-sm text-[var(--text-muted)] max-w-md mt-2">
                  This feature is currently in development.
                </p>
              </div>
            </Panel>
          )}

          {(activeTab === "pages") && (
            <Panel title="Pages" subtitle="Top performing pages">
               <div className="flex flex-col items-center justify-center py-16 text-center">
                <Layout size={48} className="text-[#e4e4e7] mb-4" />
                <h3 className="text-lg font-medium text-[var(--text-primary)]">Pages Coming Soon</h3>
                <p className="text-sm text-[var(--text-muted)] max-w-md mt-2">
                  This feature is currently in development.
                </p>
              </div>
            </Panel>
          )}

          {(activeTab === "trends") && (
            <Panel title="Search Trends" subtitle="Search visibility over time">
               <div className="flex flex-col items-center justify-center py-16 text-center">
                <TrendingUp size={48} className="text-[#e4e4e7] mb-4" />
                <h3 className="text-lg font-medium text-[var(--text-primary)]">Search Trends Coming Soon</h3>
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
