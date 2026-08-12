"use client";
import { useState } from "react";
import { PageHeader, Panel, Table, Th, Tr, Td, Pill, ActionButton } from "@/components/ui/console";
import { OpportunityDetailPanel } from "@/components/ui/opportunity-detail-panel";
import { Code, GitBranch, GitPullRequest, GitMerge, Server, Zap } from "lucide-react";

export default function EngineerPage() {
  const [activeTab, setActiveTab] = useState("repo");
  const [selectedFix, setSelectedFix] = useState<string | null>(null);

  const tabs = [
    { id: "repo", label: "Repository Intelligence", icon: GitBranch },
    { id: "fixes", label: "Code Fixes", icon: Code },
    { id: "prs", label: "PR Generator", icon: GitPullRequest },
    { id: "deployments", label: "Deployments", icon: Server },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="AI Website Engineer"
        subtitle="Automated repository intelligence, code fixes, and deployments."
        actions={
          <ActionButton variant="secondary" icon={<Zap size={12} />}>
            Trigger Repository Scan
          </ActionButton>
        }
      />

      <div className="flex space-x-1 border-b border-[#e4e4e7] overflow-x-auto pb-[-1px]">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id);
              setSelectedFix(null);
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
        <div className={`flex-1 space-y-4 ${selectedFix ? "lg:max-w-[calc(100%-28rem)]" : "w-full"}`}>
          
          {(activeTab === "repo" || activeTab === "fixes" || activeTab === "prs") && (
            <Panel title="Actionable Code Fixes" subtitle="Technical SEO and performance issues ready for automated fixes.">
              <Table minWidth={720}>
                <thead>
                  <tr>
                    <Th>Issue Description</Th>
                    <Th>Affected Files</Th>
                    <Th>Type</Th>
                    <Th>Status</Th>
                    <Th align="right">Action</Th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { id: "1", desc: "Fix missing canonical tags across blog routes", files: 14, type: "Technical SEO", stat: "Ready for PR" },
                    { id: "2", desc: "Implement lazy loading for below-fold images", files: 22, type: "Performance", stat: "Ready for PR" },
                    { id: "3", desc: "Add aria-labels to main navigation elements", files: 4, type: "Accessibility", stat: "In Progress" },
                  ].map((row) => (
                    <Tr key={row.id} className="cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => setSelectedFix(row.id)}>
                      <Td className="font-medium text-[#09090b]">{row.desc}</Td>
                      <Td className="text-[#3f3f46] font-mono">{row.files} files</Td>
                      <Td><Pill tone="default">{row.type}</Pill></Td>
                      <Td><Pill tone={row.stat === "Ready for PR" ? "good" : "warn"}>{row.stat}</Pill></Td>
                      <Td align="right">
                        <ActionButton variant="primary" onClick={(e) => { e.stopPropagation(); setSelectedFix(row.id); }}>
                          {row.stat === "Ready for PR" ? "Generate PR" : "View Details"}
                        </ActionButton>
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </Panel>
          )}

          {(activeTab === "deployments") && (
             <Panel title="Recent Deployments" subtitle="Automated fixes deployed to production.">
               <div className="p-8 text-center text-[#71717a] border-t border-[#f4f4f5]">
                  No deployments yet. Generate and merge a PR to see deployment history.
               </div>
             </Panel>
          )}

        </div>

        {selectedFix && (
          <div className="w-[26rem] flex-shrink-0 animate-in fade-in slide-in-from-right-4 duration-300 hidden lg:block sticky top-4">
            <OpportunityDetailPanel 
              title={selectedFix === "1" ? "Fix missing canonical tags across blog routes" : "Implement lazy loading for images"}
              evidence={[
                "Identified by the Technical SEO Engine.",
                `${selectedFix === "1" ? "14" : "22"} files lack proper ${selectedFix === "1" ? "canonical implementation" : "next/image configurations"}.`
              ]}
              businessImpact={selectedFix === "1" ? "Prevents duplicate content issues and consolidates link equity." : "Significantly improves LCP and Core Web Vitals score."}
              recommendedAction="Generate code modifications and create a Pull Request against the 'main' branch."
              aiRecommendation="Use AI Repository Engineer to automatically open a PR with the fixes."
              affectedPagesCount={selectedFix === "1" ? 14 : 22}
              estimatedImpact="High confidence"
              onAnalyze={() => {}}
              onGenerateFix={() => {}}
            />
          </div>
        )}
      </div>
    </div>
  );
}
