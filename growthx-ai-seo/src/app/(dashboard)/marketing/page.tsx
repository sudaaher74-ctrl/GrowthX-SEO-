"use client";
import { useState } from "react";
import { PageHeader, Panel, Table, Th, Tr, Td, Pill, ActionButton, Mono } from "@/components/ui/console";
import { Lightbulb, Calendar, Target, Megaphone, Loader2 } from "lucide-react";
import { useWorkspace, useStrategies, useStrategy, useContentPieces } from "@/hooks/use-growthx";

export default function MarketingPage() {
  const { projectId } = useWorkspace();
  const strategies = useStrategies(projectId);
  const activeStrategyId = strategies.data?.[0]?.id ?? null;
  const report = useStrategy(projectId, activeStrategyId);
  const contentPieces = useContentPieces(projectId);

  const [activeTab, setActiveTab] = useState("strategy");

  const tabs = [
    { id: "strategy", label: "Marketing Strategy", icon: Lightbulb },
    { id: "planner", label: "Campaign Planner", icon: Calendar },
    { id: "seo", label: "SEO Strategy", icon: Target },
    { id: "pr", label: "PR & Outreach", icon: Megaphone },
  ];

  const isLoading = strategies.isLoading || report.isLoading || contentPieces.isLoading;
  const strategyContent = report.data?.content;
  const pieces = contentPieces.data ?? [];

  return (
    <div className="space-y-5">
      <PageHeader
        title="AI Marketing Consultant"
        subtitle="Strategy generation, campaign planning, and automated outreach."
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
          
          {isLoading ? (
            <Panel>
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Loader2 size={32} className="text-[#e4e4e7] mb-4 animate-spin" />
                <p className="text-sm text-[var(--text-muted)]">Loading AI strategies...</p>
              </div>
            </Panel>
          ) : (
            <>
              {(activeTab === "strategy") && (
                <Panel title="Market Analysis & Positioning" subtitle="High-level AI-generated marketing analysis.">
                  {strategyContent ? (
                    <div className="p-4 space-y-6 text-sm text-[var(--text-primary)]">
                      <div>
                        <h4 className="font-medium text-[15px] mb-2">Business Summary</h4>
                        <p className="text-[var(--text-muted)] leading-relaxed">{strategyContent.businessSummary}</p>
                      </div>
                      <div>
                        <h4 className="font-medium text-[15px] mb-2">Target Audience</h4>
                        <p className="text-[var(--text-muted)] leading-relaxed">{strategyContent.marketAnalysis.targetAudience}</p>
                      </div>
                      <div>
                        <h4 className="font-medium text-[15px] mb-2">Positioning</h4>
                        <p className="text-[var(--text-muted)] leading-relaxed">{strategyContent.marketAnalysis.positioning}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <h4 className="font-medium text-[15px] mb-2">Demand Signals</h4>
                          <ul className="list-disc pl-4 text-[var(--text-muted)] space-y-1">
                            {strategyContent.marketAnalysis.demandSignals.map((d, i) => <li key={i}>{d}</li>)}
                          </ul>
                        </div>
                        <div>
                          <h4 className="font-medium text-[15px] mb-2">Competitive Threats</h4>
                          <ul className="list-disc pl-4 text-[var(--text-muted)] space-y-1">
                            {strategyContent.marketAnalysis.competitiveThreats.map((t, i) => <li key={i}>{t}</li>)}
                          </ul>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-8 text-center text-sm text-[var(--text-muted)]">No active strategy found. Generate one in the Strategy tab.</div>
                  )}
                </Panel>
              )}

              {(activeTab === "planner") && (
                <Panel title="Campaign Planner" subtitle="Active content pipeline and generated assets.">
                  <Table minWidth={600}>
                    <thead>
                      <tr>
                        <Th>Title</Th>
                        <Th>Target Query</Th>
                        <Th>Format</Th>
                        <Th>Status</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {pieces.length > 0 ? (
                        pieces.map((piece) => (
                          <Tr key={piece.id}>
                            <Td><span className="font-medium text-[#09090b]">{piece.title}</span></Td>
                            <Td><Mono>{piece.targetQuery || "N/A"}</Mono></Td>
                            <Td><span className="text-[13px] text-[#3f3f46]">{piece.format}</span></Td>
                            <Td>
                              <Pill tone={piece.status === "PUBLISHED" ? "good" : piece.status === "PLANNED" ? "info" : "warn"}>
                                {piece.status}
                              </Pill>
                            </Td>
                          </Tr>
                        ))
                      ) : (
                        <Tr><Td colSpan={4} className="text-center text-sm text-[var(--text-muted)] py-4">No content campaigns planned yet.</Td></Tr>
                      )}
                    </tbody>
                  </Table>
                </Panel>
              )}

              {(activeTab === "seo") && (
                <Panel title="SEO Strategy Directives" subtitle="High-level directives derived from competitive intelligence.">
                  {strategyContent?.seoRoadmap && strategyContent.seoRoadmap.length > 0 ? (
                    <Table minWidth={600}>
                      <thead>
                        <tr>
                          <Th>Horizon</Th>
                          <Th>Action</Th>
                          <Th>Why</Th>
                          <Th>Expected Impact</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {strategyContent.seoRoadmap.map((item, i) => (
                          <Tr key={i}>
                            <Td><Pill>{item.horizon}</Pill></Td>
                            <Td><span className="font-medium text-[#09090b]">{item.action}</span></Td>
                            <Td><span className="text-[13px] text-[#3f3f46]">{item.why}</span></Td>
                            <Td><span className="text-[13px] text-[#3f3f46]">{item.expectedImpact}</span></Td>
                          </Tr>
                        ))}
                      </tbody>
                    </Table>
                  ) : (
                    <div className="p-8 text-center text-sm text-[var(--text-muted)]">No SEO strategy directives found.</div>
                  )}
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
            </>
          )}

        </div>
      </div>
    </div>
  );
}
