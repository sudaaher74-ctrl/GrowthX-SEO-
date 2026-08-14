"use client";
import { useState } from "react";
import { PageHeader, Panel, Kpi, Table, Th, Tr, Td, Pill, ActionButton } from "@/components/ui/console";
import { OpportunityDetailPanel } from "@/components/ui/opportunity-detail-panel";
import { Target, FileText, Link as LinkIcon, List, Zap } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Legend } from "recharts";

export default function CompetitorsPage() {
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedIssue, setSelectedIssue] = useState<string | null>(null);

  const tabs = [
    { id: "overview", label: "Competitor Overview", icon: Target },
    { id: "content", label: "Content Gap Analysis", icon: FileText },
    { id: "links", label: "Link Intersection", icon: LinkIcon },
    { id: "serp", label: "SERP Overlap", icon: List },
  ];

  const radarData = [
    { subject: 'Organic Traffic', A: 120, B: 110, fullMark: 150 },
    { subject: 'Domain Auth', A: 98, B: 130, fullMark: 150 },
    { subject: 'Referring Doms', A: 86, B: 130, fullMark: 150 },
    { subject: 'Indexed Pages', A: 99, B: 100, fullMark: 150 },
    { subject: 'Brand Search', A: 85, B: 90, fullMark: 150 },
    { subject: 'Content Velocity', A: 65, B: 85, fullMark: 150 },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Competitor Intelligence"
        subtitle="Competitor Overview, Content Gaps, and Link Intersections."
        actions={
          <ActionButton variant="secondary" icon={<Zap size={12} />}>
            Run Competitor Scan
          </ActionButton>
        }
      />

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
        <div className="flex-1 space-y-4 w-full">
          
          {(activeTab === "overview") && (
            <Panel title="Competitive Landscape" subtitle="Comparing Your Domain vs. Competitors">
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Target size={48} className="text-[#e4e4e7] mb-4" />
                <h3 className="text-lg font-medium text-[var(--text-primary)]">Competitor Analysis Coming Soon</h3>
                <p className="text-sm text-[var(--text-muted)] max-w-md mt-2">
                  We are building out the intelligence engine to analyze your competitors' traffic, links, and content gaps.
                </p>
              </div>
            </Panel>
          )}

          {(activeTab === "content") && (
            <Panel title="Content Gap Analysis" subtitle="Topics your competitors rank for, but you don't.">
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <FileText size={48} className="text-[#e4e4e7] mb-4" />
                <h3 className="text-lg font-medium text-[var(--text-primary)]">Gap Analysis Coming Soon</h3>
                <p className="text-sm text-[var(--text-muted)] max-w-md mt-2">
                  This feature is currently in development.
                </p>
              </div>
            </Panel>
          )}

          {(activeTab === "links") && (
            <Panel title="Link Intersection" subtitle="Domains linking to multiple competitors, but not you.">
               <div className="flex flex-col items-center justify-center py-16 text-center">
                 <LinkIcon size={48} className="text-[#e4e4e7] mb-4" />
                 <h3 className="text-lg font-medium text-[var(--text-primary)]">Link Intersect Coming Soon</h3>
                 <p className="text-sm text-[var(--text-muted)] max-w-md mt-2">
                   This feature is currently in development.
                 </p>
               </div>
            </Panel>
          )}

          {(activeTab === "serp") && (
            <Panel title="SERP Overlap" subtitle="Discover overlapping ranking keywords.">
               <div className="flex flex-col items-center justify-center py-16 text-center">
                 <List size={48} className="text-[#e4e4e7] mb-4" />
                 <h3 className="text-lg font-medium text-[var(--text-primary)]">SERP Overlap Coming Soon</h3>
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
