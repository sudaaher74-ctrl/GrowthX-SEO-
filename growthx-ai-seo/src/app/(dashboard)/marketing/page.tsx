"use client";
import { useState } from "react";
import { PageHeader, Panel, Kpi, Table, Th, Tr, Td, Pill, ActionButton } from "@/components/ui/console";
import { OpportunityDetailPanel } from "@/components/ui/opportunity-detail-panel";
import { Lightbulb, Calendar, Target, Megaphone, Zap, MessageSquareText } from "lucide-react";

export default function MarketingPage() {
  const [activeTab, setActiveTab] = useState("strategy");
  const [selectedCampaign, setSelectedCampaign] = useState<string | null>(null);

  const tabs = [
    { id: "strategy", label: "Marketing Strategy", icon: Lightbulb },
    { id: "planner", label: "Campaign Planner", icon: Calendar },
    { id: "seo", label: "SEO Strategy", icon: Target },
    { id: "pr", label: "PR & Outreach", icon: Megaphone },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="AI Marketing Consultant"
        subtitle="Strategy generation, campaign planning, and automated outreach."
        actions={
          <ActionButton variant="primary" icon={<MessageSquareText size={12} />}>
            Chat with AI Consultant
          </ActionButton>
        }
      />

      <div className="flex space-x-1 border-b border-[#e4e4e7] overflow-x-auto pb-[-1px]">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id);
              setSelectedCampaign(null);
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
          
          {(activeTab === "strategy" || activeTab === "planner") && (
            <Panel title="Active & Suggested Campaigns" subtitle="AI-generated marketing initiatives based on market gaps.">
               <div className="flex flex-col items-center justify-center py-16 text-center">
                <Calendar size={48} className="text-[#e4e4e7] mb-4" />
                <h3 className="text-lg font-medium text-[var(--text-primary)]">Campaigns Coming Soon</h3>
                <p className="text-sm text-[var(--text-muted)] max-w-md mt-2">
                  This feature is currently in development.
                </p>
              </div>
            </Panel>
          )}

          {(activeTab === "strategy" || activeTab === "seo") && (
            <Panel title="SEO Strategy Directives" subtitle="High-level directives derived from competitive intelligence.">
               <div className="flex flex-col items-center justify-center py-16 text-center">
                <Target size={48} className="text-[#e4e4e7] mb-4" />
                <h3 className="text-lg font-medium text-[var(--text-primary)]">SEO Directives Coming Soon</h3>
                <p className="text-sm text-[var(--text-muted)] max-w-md mt-2">
                  This feature is currently in development.
                </p>
              </div>
            </Panel>
          )}

          {(activeTab === "pr") && (
            <Panel title="PR & Outreach" subtitle="Manage PR campaigns and outreach.">
               <div className="flex flex-col items-center justify-center py-16 text-center">
                <Megaphone size={48} className="text-[#e4e4e7] mb-4" />
                <h3 className="text-lg font-medium text-[var(--text-primary)]">PR & Outreach Coming Soon</h3>
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
