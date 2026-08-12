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
        <div className={`flex-1 space-y-4 ${selectedTopic ? "lg:max-w-[calc(100%-28rem)]" : "w-full"}`}>
          
          {(activeTab === "strategy" || activeTab === "writer" || activeTab === "clusters") && (
            <Panel title="Drafts & Suggestions" subtitle="AI-generated content suggestions based on keyword opportunities.">
              <Table minWidth={720}>
                <thead>
                  <tr>
                    <Th>Topic / Title</Th>
                    <Th>Cluster</Th>
                    <Th>Word Count</Th>
                    <Th>Status</Th>
                    <Th align="right">Action</Th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { id: "1", title: "10 Modular Kitchen Designs for 2026", cluster: "Kitchen Design", wc: "1,200 (Est.)", stat: "Suggested" },
                    { id: "2", title: "Cost of Interior Designer in Mumbai: A Complete Guide", cluster: "Pricing", wc: "1,850", stat: "Draft Ready" },
                    { id: "3", title: "Vastu Shastra Tips for Master Bedroom", cluster: "Vastu", wc: "0", stat: "Brief Ready" },
                  ].map((row) => (
                    <Tr key={row.id} className="cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => setSelectedTopic(row.id)}>
                      <Td className="font-medium text-[#09090b]">{row.title}</Td>
                      <Td className="text-[#71717a]">{row.cluster}</Td>
                      <Td className="text-[#71717a]">{row.wc}</Td>
                      <Td><Pill tone={row.stat === "Draft Ready" ? "good" : row.stat === "Suggested" ? "warn" : "default"}>{row.stat}</Pill></Td>
                      <Td align="right">
                        <ActionButton variant="secondary" onClick={(e) => { e.stopPropagation(); setSelectedTopic(row.id); }}>
                          {row.stat === "Suggested" ? "Generate Draft" : "Review Draft"}
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
              title={selectedTopic === "1" ? "10 Modular Kitchen Designs for 2026" : "Cost of Interior Designer in Mumbai"}
              evidence={[
                "Fills a critical content gap identified by Competitor Intelligence.",
                "Primary Keyword Volume: 8,100/mo.",
                "Target Audience: Top of funnel (Awareness)."
              ]}
              businessImpact="Can drive an estimated 800-1,200 visits/mo within 3-6 months of publishing."
              recommendedAction="Generate an SEO-optimized 1,200 word draft utilizing H2/H3 structure."
              aiRecommendation="Use AI Writer to generate the full draft and meta tags."
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
