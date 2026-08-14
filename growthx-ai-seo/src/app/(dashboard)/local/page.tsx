"use client";
import { useState } from "react";
import { PageHeader, Panel, Kpi, Table, Th, Tr, Td, Pill, ActionButton } from "@/components/ui/console";
import { MapPin, Star, Link as LinkIcon, BarChart3, Zap, Loader2 } from "lucide-react";
import { useWorkspace, useLocalSeo } from "@/hooks/use-growthx";

export default function LocalPage() {
  const [activeTab, setActiveTab] = useState("gbp");
  const { projectId } = useWorkspace();
  const { data: localSeo, isLoading } = useLocalSeo(projectId);

  const tabs = [
    { id: "gbp", label: "Google Business Profile", icon: MapPin },
    { id: "reviews", label: "Reviews & Ratings", icon: Star },
    { id: "citations", label: "Citations", icon: LinkIcon },
    { id: "rankings", label: "Local Rankings", icon: BarChart3 },
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
                <p className="text-sm text-[var(--text-muted)]">Loading local data...</p>
              </div>
            </Panel>
          ) : (
            <>
              {(activeTab === "gbp" || activeTab === "overview") && (
                <Panel title="Google Business Profile Performance" subtitle="Profile overview and details">
                  <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="border border-[#e4e4e7] rounded-md p-4">
                       <h3 className="text-sm font-medium text-[var(--text-muted)] mb-1">Business Name</h3>
                       <p className="text-lg font-medium">{localSeo?.businessName || "N/A"}</p>
                    </div>
                    <div className="border border-[#e4e4e7] rounded-md p-4">
                       <h3 className="text-sm font-medium text-[var(--text-muted)] mb-1">Registered Address</h3>
                       <p className="text-[15px] font-medium">{localSeo?.address || "N/A"}</p>
                    </div>
                    <div className="border border-[#e4e4e7] rounded-md p-4 flex flex-col justify-center">
                       <h3 className="text-sm font-medium text-[var(--text-muted)] mb-1">Status</h3>
                       <Pill tone="good">VERIFIED</Pill>
                    </div>
                  </div>
                </Panel>
              )}

              {(activeTab === "reviews") && (
                <Panel title="Reviews & Ratings" subtitle="Manage your local reputation">
                  <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Kpi label="Average Rating" value={localSeo?.rating.toFixed(1) || "0.0"} delta={5.2} tone="good" />
                    <Kpi label="Total Reviews" value={(localSeo?.reviewCount || 0).toString()} delta={12} tone="good" />
                  </div>
                </Panel>
              )}

              {(activeTab === "citations") && (
                <Panel title="Citations" subtitle="Monitor your local business listings">
                  <div className="p-4">
                    <Kpi label="Active Citations (NAP)" value={(localSeo?.citationsCount || 0).toString()} />
                  </div>
                </Panel>
              )}

              {(activeTab === "rankings") && (
                <Panel title="Local Rankings" subtitle="Track your local search performance">
                  {localSeo?.rankings && localSeo.rankings.length > 0 ? (
                    <Table minWidth={600}>
                      <thead>
                        <tr>
                          <Th>Keyword</Th>
                          <Th>Position</Th>
                          <Th>Change</Th>
                          <Th>Search Volume</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {localSeo.rankings.map((r) => {
                          const delta = r.previousPos ? r.previousPos - r.position : 0;
                          return (
                            <Tr key={r.id}>
                              <Td><span className="font-medium text-[#09090b]">{r.keyword}</span></Td>
                              <Td><span className="font-bold text-[#09090b]">#{r.position}</span></Td>
                              <Td>
                                {delta > 0 ? (
                                  <span className="text-[#10b981] text-[13px] font-medium">+{delta}</span>
                                ) : delta < 0 ? (
                                  <span className="text-[#ef4444] text-[13px] font-medium">{delta}</span>
                                ) : (
                                  <span className="text-[#a1a1aa] text-[13px]">—</span>
                                )}
                              </Td>
                              <Td><span className="text-[#71717a]">{r.searchVolume.toLocaleString()}</span></Td>
                            </Tr>
                          );
                        })}
                      </tbody>
                    </Table>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <BarChart3 size={48} className="text-[#e4e4e7] mb-4" />
                      <h3 className="text-lg font-medium text-[var(--text-primary)]">No Rankings Data</h3>
                      <p className="text-sm text-[var(--text-muted)] max-w-md mt-2">
                        Your local ranking data will appear here once tracked.
                      </p>
                    </div>
                  )}
                </Panel>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
