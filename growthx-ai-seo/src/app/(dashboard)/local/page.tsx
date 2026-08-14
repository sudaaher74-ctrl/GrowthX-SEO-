"use client";
import { useState } from "react";
import { PageHeader, Panel, Kpi, Table, Th, Tr, Td, Pill, ActionButton } from "@/components/ui/console";
import { OpportunityDetailPanel } from "@/components/ui/opportunity-detail-panel";
import { MapPin, Star, Link as LinkIcon, BarChart3, Zap } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export default function LocalPage() {
  const [activeTab, setActiveTab] = useState("gbp");
  const [selectedIssue, setSelectedIssue] = useState<string | null>(null);

  const tabs = [
    { id: "gbp", label: "Google Business Profile", icon: MapPin },
    { id: "reviews", label: "Reviews & Ratings", icon: Star },
    { id: "citations", label: "Citations", icon: LinkIcon },
    { id: "rankings", label: "Local Rankings", icon: BarChart3 },
  ];

  const trend = [
    { week: "W1", views: 2400 }, { week: "W2", views: 2600 }, { week: "W3", views: 2500 },
    { week: "W4", views: 3200 }, { week: "W5", views: 3800 }, { week: "W6", views: 4100 }
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Local SEO"
        subtitle="Google Business Profile, Reviews, and Local Rankings."
        actions={
          <ActionButton variant="secondary" icon={<Zap size={12} />}>
            Run Local Audit
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
          
          {(activeTab === "gbp" || activeTab === "overview") && (
            <Panel 
              title="Google Business Profile Performance" 
              subtitle="Profile views and interactions over the last 30 days"
            >
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <MapPin size={48} className="text-[#e4e4e7] mb-4" />
                <h3 className="text-lg font-medium text-[var(--text-primary)]">Google Business Profile Coming Soon</h3>
                <p className="text-sm text-[var(--text-muted)] max-w-md mt-2">
                  Integration with Google Business Profile is currently in development.
                </p>
              </div>
            </Panel>
          )}

          {(activeTab === "reviews") && (
            <Panel title="Reviews & Ratings" subtitle="Manage your local reputation">
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Star size={48} className="text-[#e4e4e7] mb-4" />
                <h3 className="text-lg font-medium text-[var(--text-primary)]">Reviews Management Coming Soon</h3>
                <p className="text-sm text-[var(--text-muted)] max-w-md mt-2">
                  This feature is currently in development.
                </p>
              </div>
            </Panel>
          )}

          {(activeTab === "citations") && (
            <Panel title="Citations" subtitle="Monitor your local business listings">
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <LinkIcon size={48} className="text-[#e4e4e7] mb-4" />
                <h3 className="text-lg font-medium text-[var(--text-primary)]">Citations Coming Soon</h3>
                <p className="text-sm text-[var(--text-muted)] max-w-md mt-2">
                  This feature is currently in development.
                </p>
              </div>
            </Panel>
          )}

          {(activeTab === "rankings") && (
            <Panel title="Local Rankings" subtitle="Track your local search performance">
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <BarChart3 size={48} className="text-[#e4e4e7] mb-4" />
                <h3 className="text-lg font-medium text-[var(--text-primary)]">Local Rankings Coming Soon</h3>
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
