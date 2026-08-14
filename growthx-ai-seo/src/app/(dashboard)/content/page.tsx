"use client";
import { useState } from "react";
import { PageHeader, Panel, Table, Th, Tr, Td, Pill, ActionButton } from "@/components/ui/console";
import { OpportunityDetailPanel } from "@/components/ui/opportunity-detail-panel";
import { FileText, Network, PenTool, Calendar, Zap } from "lucide-react";

export default function ContentPage() {
  const [activeTab, setActiveTab] = useState("strategy");
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);

  const tabs = [
    { id: "strategy", label: "Content Strategy", icon: FileText },
    { id: "clusters", label: "Topic Clusters", icon: Network },
    { id: "writer", label: "AI Writer", icon: PenTool },
    { id: "calendar", label: "Content Calendar", icon: Calendar },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="AI Content Studio"
        subtitle="Manage topic clusters, content calendar, and generate SEO-optimized drafts."
        actions={
          <ActionButton variant="primary" icon={<Zap size={12} />}>
            Generate New Draft
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
          
          {(activeTab === "strategy" || activeTab === "writer" || activeTab === "clusters") && (
            <Panel title="Drafts & Suggestions" subtitle="AI-generated content suggestions based on keyword opportunities.">
               <div className="flex flex-col items-center justify-center py-16 text-center">
                <FileText size={48} className="text-[#e4e4e7] mb-4" />
                <h3 className="text-lg font-medium text-[var(--text-primary)]">Content Suggestions Coming Soon</h3>
                <p className="text-sm text-[var(--text-muted)] max-w-md mt-2">
                  This feature is currently in development.
                </p>
              </div>
            </Panel>
          )}

          {(activeTab === "calendar") && (
            <Panel title="Content Calendar" subtitle="Schedule and manage content publication.">
               <div className="flex flex-col items-center justify-center py-16 text-center">
                <Calendar size={48} className="text-[#e4e4e7] mb-4" />
                <h3 className="text-lg font-medium text-[var(--text-primary)]">Content Calendar Coming Soon</h3>
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
