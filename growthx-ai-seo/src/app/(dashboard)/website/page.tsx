"use client";
import { useState } from "react";
import { PageHeader, Panel, Kpi, Table, Th, Tr, Td, Pill, Mono, ActionButton } from "@/components/ui/console";
import { OpportunityDetailPanel } from "@/components/ui/opportunity-detail-panel";
import { Search, Zap, Code, Layout, LayoutGrid, HeartPulse, Activity } from "lucide-react";

export default function WebsitePage() {
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedIssue, setSelectedIssue] = useState<string | null>(null);

  const tabs = [
    { id: "overview", label: "Overview", icon: LayoutGrid },
    { id: "crawl", label: "Crawl", icon: Search },
    { id: "technical-seo", label: "Technical SEO", icon: Zap },
    { id: "performance", label: "Performance", icon: Activity },
    { id: "accessibility", label: "Accessibility", icon: HeartPulse },
    { id: "pages", label: "Pages", icon: Layout },
    { id: "structured-data", label: "Structured Data", icon: Code },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Website"
        subtitle="Crawl, Technical SEO, Performance, and Accessibility engines."
        actions={
          <ActionButton variant="primary" icon={<Zap size={12} />}>
            Run full scan
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
              setSelectedIssue(null);
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
        <div className={`flex-1 space-y-4 ${selectedIssue ? "lg:max-w-[calc(100%-28rem)]" : "w-full"}`}>
          {activeTab === "overview" && (
            <>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Kpi label="SEO Score" value="82" />
                <Kpi label="Pages Crawled" value="1,284" />
                <Kpi label="Indexable" value="1,142" />
                <Kpi label="Broken URLs" value="23" tone="danger" />
                <Kpi label="Redirects" value="41" />
                <Kpi label="Orphan Pages" value="18" tone="danger" />
              </div>
            </>
          )}

          {(activeTab === "technical-seo" || activeTab === "overview") && (
            <Panel title="Technical SEO Issues" subtitle="Identified by the Technical SEO Engine">
              <Table minWidth={720}>
                <thead>
                  <tr>
                    <Th>Issue</Th>
                    <Th>Severity</Th>
                    <Th>Affected Pages</Th>
                    <Th>Impact</Th>
                    <Th>Status</Th>
                    <Th align="right">Action</Th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { id: "1", title: "Missing Meta Descriptions", severity: "HIGH", pages: 42, impact: "Potential CTR loss", status: "Open" },
                    { id: "2", title: "Broken Internal Links", severity: "HIGH", pages: 17, impact: "Crawl/UX impact", status: "Open" },
                    { id: "3", title: "Duplicate Titles", severity: "MEDIUM", pages: 21, impact: "Search relevance", status: "Open" },
                  ].map((issue) => (
                    <Tr key={issue.id} className="cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => setSelectedIssue(issue.id)}>
                      <Td className="font-medium text-[#09090b]">{issue.title}</Td>
                      <Td><Pill tone={issue.severity === "HIGH" ? "warn" : "default"}>{issue.severity}</Pill></Td>
                      <Td>{issue.pages} pages</Td>
                      <Td className="text-[#71717a]">{issue.impact}</Td>
                      <Td><span className="text-xs font-semibold uppercase tracking-wider text-[#71717a]">{issue.status}</span></Td>
                      <Td align="right">
                        <ActionButton variant="secondary" onClick={(e) => { e.stopPropagation(); setSelectedIssue(issue.id); }}>
                          {issue.title === "Missing Meta Descriptions" || issue.title === "Duplicate Titles" ? "Fix" : "Analyze"}
                        </ActionButton>
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </Panel>
          )}

          {(activeTab === "performance" || activeTab === "overview") && (
            <Panel title="Performance Metrics" subtitle="Core Web Vitals from the Performance Engine">
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 p-6 text-center">
                <div className="flex flex-col gap-1">
                  <span className="text-[13px] text-[#71717a] font-medium">Performance Score</span>
                  <span className="text-xl font-bold text-[#16a34a]">86</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[13px] text-[#71717a] font-medium">LCP</span>
                  <span className="text-xl font-bold text-[#16a34a]">2.1s</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[13px] text-[#71717a] font-medium">CLS</span>
                  <span className="text-xl font-bold text-[#16a34a]">0.04</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[13px] text-[#71717a] font-medium">INP</span>
                  <span className="text-xl font-bold text-[#f97316]">180ms</span>
                </div>
                <div className="flex flex-col gap-1 border-l pl-4 border-[#f4f4f5]">
                  <span className="text-[13px] text-[#71717a] font-medium">TTFB</span>
                  <span className="text-xl font-bold text-[#f97316]">420ms</span>
                </div>
              </div>
              <Table minWidth={720}>
                <thead>
                  <tr>
                    <Th>Performance Opportunities</Th>
                    <Th align="right">Severity</Th>
                  </tr>
                </thead>
                <tbody>
                  <Tr>
                    <Td className="font-medium text-[#09090b]">Reduce JavaScript</Td>
                    <Td align="right"><Pill tone="warn">HIGH</Pill></Td>
                  </Tr>
                  <Tr>
                    <Td className="font-medium text-[#09090b]">Optimize images</Td>
                    <Td align="right"><Pill>MEDIUM</Pill></Td>
                  </Tr>
                  <Tr>
                    <Td className="font-medium text-[#09090b]">Remove render blocking resources</Td>
                    <Td align="right"><Pill tone="warn">HIGH</Pill></Td>
                  </Tr>
                </tbody>
              </Table>
            </Panel>
          )}

          {(activeTab === "accessibility" || activeTab === "overview") && (
            <Panel title="Accessibility" subtitle="Findings from the Accessibility Engine">
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 p-6 text-center border-b border-[#f4f4f5]">
                <div className="flex flex-col gap-1">
                  <span className="text-[13px] text-[#71717a] font-medium">Accessibility Score</span>
                  <span className="text-xl font-bold text-[#16a34a]">91 / 100</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[13px] text-[#71717a] font-medium">Critical</span>
                  <span className="text-xl font-bold text-[#ef4444]">2</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[13px] text-[#71717a] font-medium">High</span>
                  <span className="text-xl font-bold text-[#f97316]">5</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[13px] text-[#71717a] font-medium">Medium</span>
                  <span className="text-xl font-bold text-[#eab308]">11</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[13px] text-[#71717a] font-medium">Low</span>
                  <span className="text-xl font-bold text-[#64748b]">7</span>
                </div>
              </div>
            </Panel>
          )}
        </div>

        {/* Right Side Detail Panel */}
        {selectedIssue && (
          <div className="w-[26rem] flex-shrink-0 animate-in fade-in slide-in-from-right-4 duration-300 hidden lg:block sticky top-4">
            <OpportunityDetailPanel 
              title={selectedIssue === "1" ? "Missing Meta Descriptions" : selectedIssue === "2" ? "Broken Internal Links" : "Duplicate Titles"}
              evidence={[
                `${selectedIssue === "1" ? 42 : selectedIssue === "2" ? 17 : 21} pages affected`,
                "Identified by Technical SEO Engine"
              ]}
              businessImpact={selectedIssue === "1" ? "Potential CTR loss in search results." : "Poor user experience and wasted crawl budget."}
              recommendedAction={selectedIssue === "1" ? "Write descriptive meta descriptions for all pages." : "Fix or remove broken internal links."}
              aiRecommendation={selectedIssue === "1" ? "Generate optimized metadata." : "Identify and suggest link replacements."}
              affectedPagesCount={selectedIssue === "1" ? 42 : selectedIssue === "2" ? 17 : 21}
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
