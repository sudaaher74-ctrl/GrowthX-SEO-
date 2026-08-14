"use client";
import { useState } from "react";
import { PageHeader, Panel, Table, Th, Tr, Td, Pill, ActionButton } from "@/components/ui/console";
import { OpportunityDetailPanel } from "@/components/ui/opportunity-detail-panel";
import { Activity, Bell, History, ShieldAlert, Zap } from "lucide-react";

export default function MonitoringPage() {
  const [activeTab, setActiveTab] = useState("alerts");
  const [selectedAlert, setSelectedAlert] = useState<string | null>(null);

  const tabs = [
    { id: "alerts", label: "Real-time Alerts", icon: Bell },
    { id: "changes", label: "Change Tracking", icon: History },
    { id: "algo", label: "Algorithm Updates", icon: Activity },
    { id: "status", label: "Status Dashboard", icon: ShieldAlert },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="24/7 Monitoring & Alerts"
        subtitle="Real-time traffic drops, anomaly detection, and change tracking."
        actions={
          <ActionButton variant="secondary" icon={<Zap size={12} />}>
            Configure Alerts
          </ActionButton>
        }
      />

      <div className="flex space-x-1 border-b border-[#e4e4e7] overflow-x-auto pb-[-1px]">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id);
              setSelectedAlert(null);
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
          
          {(activeTab === "alerts" || activeTab === "changes") && (
            <Panel title="Active Alerts" subtitle="AI-detected anomalies requiring immediate attention.">
               <div className="flex flex-col items-center justify-center py-16 text-center">
                <Bell size={48} className="text-[#e4e4e7] mb-4" />
                <h3 className="text-lg font-medium text-[var(--text-primary)]">Real-time Alerts Coming Soon</h3>
                <p className="text-sm text-[var(--text-muted)] max-w-md mt-2">
                  This feature is currently in development.
                </p>
              </div>
            </Panel>
          )}

          {(activeTab === "changes" || activeTab === "algo") && (
             <Panel title="Recent Changes Timeline" subtitle="Log of all automated fixes and algorithm shifts.">
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <History size={48} className="text-[#e4e4e7] mb-4" />
                  <h3 className="text-lg font-medium text-[var(--text-primary)]">Change Tracking Coming Soon</h3>
                  <p className="text-sm text-[var(--text-muted)] max-w-md mt-2">
                    This feature is currently in development.
                  </p>
                </div>
             </Panel>
          )}
          
          {(activeTab === "algo") && (
             <Panel title="Algorithm Updates" subtitle="Search engine algorithm changes.">
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Activity size={48} className="text-[#e4e4e7] mb-4" />
                  <h3 className="text-lg font-medium text-[var(--text-primary)]">Algorithm Updates Coming Soon</h3>
                  <p className="text-sm text-[var(--text-muted)] max-w-md mt-2">
                    This feature is currently in development.
                  </p>
                </div>
             </Panel>
          )}

          {(activeTab === "status") && (
             <Panel title="Status Dashboard" subtitle="System health and scanning status.">
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <ShieldAlert size={48} className="text-[#e4e4e7] mb-4" />
                  <h3 className="text-lg font-medium text-[var(--text-primary)]">Status Dashboard Coming Soon</h3>
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
