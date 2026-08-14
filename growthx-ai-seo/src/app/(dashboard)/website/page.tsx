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
        <div className="flex-1 space-y-4 w-full">
          {activeTab === "overview" && (
            <>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Kpi label="SEO Score" value="-" />
                <Kpi label="Pages Crawled" value="-" />
                <Kpi label="Indexable" value="-" />
                <Kpi label="Broken URLs" value="-" />
                <Kpi label="Redirects" value="-" />
                <Kpi label="Orphan Pages" value="-" />
              </div>
            </>
          )}

          {(activeTab === "technical-seo" || activeTab === "overview") && (
            <Panel title="Technical SEO Issues" subtitle="Identified by the Technical SEO Engine">
               <div className="flex flex-col items-center justify-center py-16 text-center">
                <Zap size={48} className="text-[#e4e4e7] mb-4" />
                <h3 className="text-lg font-medium text-[var(--text-primary)]">Technical SEO Coming Soon</h3>
                <p className="text-sm text-[var(--text-muted)] max-w-md mt-2">
                  This feature is currently in development.
                </p>
              </div>
            </Panel>
          )}

          {(activeTab === "performance" || activeTab === "overview") && (
            <Panel title="Performance Metrics" subtitle="Core Web Vitals from the Performance Engine">
               <div className="flex flex-col items-center justify-center py-16 text-center">
                <Activity size={48} className="text-[#e4e4e7] mb-4" />
                <h3 className="text-lg font-medium text-[var(--text-primary)]">Performance Engine Coming Soon</h3>
                <p className="text-sm text-[var(--text-muted)] max-w-md mt-2">
                  This feature is currently in development.
                </p>
              </div>
            </Panel>
          )}

          {(activeTab === "accessibility" || activeTab === "overview") && (
            <Panel title="Accessibility" subtitle="Findings from the Accessibility Engine">
               <div className="flex flex-col items-center justify-center py-16 text-center">
                <HeartPulse size={48} className="text-[#e4e4e7] mb-4" />
                <h3 className="text-lg font-medium text-[var(--text-primary)]">Accessibility Engine Coming Soon</h3>
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
