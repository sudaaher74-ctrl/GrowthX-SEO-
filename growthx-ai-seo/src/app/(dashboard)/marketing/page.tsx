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
        <div className={`flex-1 space-y-4 ${selectedCampaign ? "lg:max-w-[calc(100%-28rem)]" : "w-full"}`}>
          
          {(activeTab === "strategy" || activeTab === "planner") && (
            <Panel title="Active & Suggested Campaigns" subtitle="AI-generated marketing initiatives based on market gaps.">
              <Table minWidth={720}>
                <thead>
                  <tr>
                    <Th>Campaign Name</Th>
                    <Th>Focus Area</Th>
                    <Th>Est. Impact</Th>
                    <Th>Status</Th>
                    <Th align="right">Action</Th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { id: "1", name: "Q3 Kitchen Remodel Push", focus: "Local SEO & Content", impact: "High", stat: "Suggested" },
                    { id: "2", name: "Sustainable Materials PR", focus: "Backlinks & PR", impact: "Medium", stat: "Active" },
                    { id: "3", name: "Holiday Decor Strategy", focus: "Social & Content", impact: "High", stat: "Draft" },
                  ].map((row) => (
                    <Tr key={row.id} className="cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => setSelectedCampaign(row.id)}>
                      <Td className="font-medium text-[#09090b]">{row.name}</Td>
                      <Td className="text-[#71717a]">{row.focus}</Td>
                      <Td><Pill tone={row.impact === "High" ? "good" : "default"}>{row.impact}</Pill></Td>
                      <Td><span className="text-xs font-semibold uppercase tracking-wider text-[#71717a]">{row.stat}</span></Td>
                      <Td align="right">
                        <ActionButton variant="secondary" onClick={(e) => { e.stopPropagation(); setSelectedCampaign(row.id); }}>
                          Review
                        </ActionButton>
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </Panel>
          )}

          {(activeTab === "strategy" || activeTab === "seo") && (
            <Panel title="SEO Strategy Directives" subtitle="High-level directives derived from competitive intelligence.">
               <div className="p-6 space-y-4">
                 <div className="flex gap-4 p-4 rounded-lg bg-[#eff6ff] border border-[#bfdbfe]">
                    <div className="mt-1"><Lightbulb size={20} className="text-[#2563eb]" /></div>
                    <div>
                      <h4 className="font-medium text-[#09090b] mb-1">Target "Cost of Interior Designer" Topic Cluster</h4>
                      <p className="text-[13px] text-[#3f3f46]">Competitors are currently dominating this high-intent keyword. Generating a pricing calculator and 3 supporting long-form articles will capture bottom-funnel traffic.</p>
                      <div className="mt-3"><ActionButton variant="primary">Generate Briefs</ActionButton></div>
                    </div>
                 </div>
                 <div className="flex gap-4 p-4 rounded-lg border border-[#e4e4e7]">
                    <div className="mt-1"><Lightbulb size={20} className="text-[#a1a1aa]" /></div>
                    <div>
                      <h4 className="font-medium text-[#09090b] mb-1">Consolidate Thin Service Pages</h4>
                      <p className="text-[13px] text-[#71717a]">You have 8 service pages with less than 300 words. Merging these into comprehensive category pages will improve overall domain authority.</p>
                      <div className="mt-3"><ActionButton variant="secondary">Review Pages</ActionButton></div>
                    </div>
                 </div>
               </div>
            </Panel>
          )}

        </div>

        {selectedCampaign && (
          <div className="w-[26rem] flex-shrink-0 animate-in fade-in slide-in-from-right-4 duration-300 hidden lg:block sticky top-4">
            <OpportunityDetailPanel 
              title={selectedCampaign === "1" ? "Q3 Kitchen Remodel Push" : "Holiday Decor Strategy"}
              evidence={[
                "Historical data shows 40% spike in kitchen remodel searches in Q3.",
                "Competitors have weak content for 'modular kitchen cost 2026'."
              ]}
              businessImpact="Could generate ~35 qualified leads per month during the campaign duration."
              recommendedAction="Launch a content cluster + GBP offer targeting kitchen remodels."
              aiRecommendation="Generate 4 blog drafts, 2 GBP posts, and 1 PR outreach template."
              affectedPagesCount={4}
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
