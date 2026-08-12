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
        <div className={`flex-1 space-y-4 ${selectedIssue ? "lg:max-w-[calc(100%-28rem)]" : "w-full"}`}>
          
          {(activeTab === "overview") && (
            <Panel title="Competitive Landscape" subtitle="Comparing Your Domain vs. Competitor A">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 p-6 text-center border-b border-[#f4f4f5]">
                <div className="flex flex-col gap-1">
                  <span className="text-[13px] text-[#71717a] font-medium">Competitors Tracked</span>
                  <span className="text-xl font-bold text-[#09090b]">5</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[13px] text-[#71717a] font-medium">Rankings Won</span>
                  <span className="text-xl font-bold text-[#16a34a]">142</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[13px] text-[#71717a] font-medium">Rankings Lost</span>
                  <span className="text-xl font-bold text-[#ef4444]">38</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[13px] text-[#71717a] font-medium">Content Gaps</span>
                  <span className="text-xl font-bold text-[#f97316]">24</span>
                </div>
              </div>
              <div className="flex items-center justify-center p-6 h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: '#71717a', fontSize: 12 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 150]} />
                    <Radar name="Your Domain" dataKey="A" stroke="#2563eb" fill="#2563eb" fillOpacity={0.6} />
                    <Radar name="Competitor A" dataKey="B" stroke="#f97316" fill="#f97316" fillOpacity={0.6} />
                    <Legend />
                    <Tooltip />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </Panel>
          )}

          {(activeTab === "content" || activeTab === "overview") && (
            <Panel title="Content Gap Analysis" subtitle="Topics your competitors rank for, but you don't.">
              <Table minWidth={720}>
                <thead>
                  <tr>
                    <Th>Missing Topic</Th>
                    <Th>Volume</Th>
                    <Th>Comp. Rank</Th>
                    <Th>KD</Th>
                    <Th align="right">Action</Th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { id: "1", topic: "Modular Kitchen Designs 2026", vol: "8,100", rank: 2, kd: "Medium" },
                    { id: "2", topic: "Cost of Interior Designer in Mumbai", vol: "5,400", rank: 4, kd: "Low" },
                    { id: "3", topic: "Vastu Shastra for Home", vol: "22,000", rank: 1, kd: "High" },
                  ].map((row) => (
                    <Tr key={row.id} className="cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => setSelectedIssue(row.id)}>
                      <Td className="font-medium text-[#09090b]">{row.topic}</Td>
                      <Td className="text-[#3f3f46]">{row.vol}</Td>
                      <Td className="text-[#3f3f46]">#{row.rank}</Td>
                      <Td><Pill tone={row.kd === "High" ? "bad" : row.kd === "Medium" ? "warn" : "good"}>{row.kd}</Pill></Td>
                      <Td align="right">
                        <ActionButton variant="secondary" onClick={(e) => { e.stopPropagation(); setSelectedIssue(row.id); }}>
                          Generate Brief
                        </ActionButton>
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </Panel>
          )}

          {(activeTab === "links") && (
            <Panel title="Link Intersection" subtitle="Domains linking to multiple competitors, but not you.">
               <div className="p-8 text-center text-[#71717a] border-t border-[#f4f4f5]">
                  No link intersection data currently available. Ensure competitor domains are fully configured.
               </div>
            </Panel>
          )}

        </div>

        {selectedIssue && (
          <div className="w-[26rem] flex-shrink-0 animate-in fade-in slide-in-from-right-4 duration-300 hidden lg:block sticky top-4">
            <OpportunityDetailPanel 
              title={selectedIssue === "1" ? "Content Gap: Modular Kitchen Designs 2026" : "Content Gap: Cost of Interior Designer in Mumbai"}
              evidence={[
                "Competitor A ranks #2 for this keyword.",
                "Search volume is 8,100/mo.",
                "Keyword Difficulty (KD) is Medium, indicating feasible ranking potential."
              ]}
              businessImpact="Capturing this traffic could drive 1,500+ high-intent visitors per month."
              recommendedAction="Publish a comprehensive, visually-rich guide covering this topic."
              aiRecommendation="Use AI to generate a full SEO content brief and outline."
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
