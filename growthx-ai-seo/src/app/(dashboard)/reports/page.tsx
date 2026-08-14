"use client";
import { useState } from "react";
import { PageHeader, Panel, Kpi, Table, Th, Tr, Td, Pill, ActionButton } from "@/components/ui/console";
import { OpportunityDetailPanel } from "@/components/ui/opportunity-detail-panel";
import { LayoutDashboard, FileBarChart, Users, FileSignature, Download } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, BarChart, Bar, CartesianGrid } from "recharts";

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState("executive");
  const [selectedReport, setSelectedReport] = useState<string | null>(null);

  const tabs = [
    { id: "executive", label: "Executive Dashboard", icon: LayoutDashboard },
    { id: "custom", label: "Custom Reports", icon: FileBarChart },
    { id: "client", label: "Client Portal", icon: Users },
    { id: "whitelabel", label: "White-label", icon: FileSignature },
  ];

  const trafficData = [
    { month: "Jan", traffic: 4000 }, { month: "Feb", traffic: 4500 }, { month: "Mar", traffic: 5100 },
    { month: "Apr", traffic: 5800 }, { month: "May", traffic: 6200 }, { month: "Jun", traffic: 7100 }
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Automated Reporting"
        subtitle="Executive summaries, custom reports, and client portal settings."
        actions={
          <ActionButton variant="primary" icon={<Download size={12} />}>
            Export PDF Report
          </ActionButton>
        }
      />

      <div className="flex space-x-1 border-b border-[#e4e4e7] overflow-x-auto pb-[-1px]">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id);
              setSelectedReport(null);
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
          
          {(activeTab === "executive") && (
            <Panel title="Executive Dashboard" subtitle="Loading data from sources...">
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <FileBarChart size={48} className="text-[#e4e4e7] mb-4" />
                <h3 className="text-lg font-medium text-[var(--text-primary)]">No Reports Generated</h3>
                <p className="text-sm text-[var(--text-muted)] max-w-md mt-2">
                  Once your SEO data syncs completely, automated executive summaries and charts will appear here.
                </p>
              </div>
            </Panel>
          )}

          {(activeTab === "custom" || activeTab === "client" || activeTab === "whitelabel") && (
            <Panel title="Saved Reports" subtitle="Pre-configured reporting templates">
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <FileSignature size={48} className="text-[#e4e4e7] mb-4" />
                <h3 className="text-lg font-medium text-[var(--text-primary)]">Custom Reports Coming Soon</h3>
                <p className="text-sm text-[var(--text-muted)] max-w-md mt-2">
                  The custom report builder and client portal sharing features are currently in development.
                </p>
              </div>
            </Panel>
          )}

        </div>
      </div>
    </div>
  );
}
