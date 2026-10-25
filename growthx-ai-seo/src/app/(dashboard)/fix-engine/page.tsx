"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Wrench } from "lucide-react";
import { useWorkspace } from "@/hooks/use-growthx";
import { PageHeader, Tabs, StatusNote } from "@/components/ui/console";
import { ShipPanel } from "@/components/fix-engine/ship-panel";
import { EngineerPanel, RunsPanel } from "@/components/fix-engine/engineer-panel";
import { PlanView } from "@/components/fix-engine/plan-view";

const TABS = [
  { id: "improvement", label: "Improvement", icon: Wrench },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function FixEnginePage() {
  return (
    <Suspense fallback={<div className="p-8 text-[13px] text-brand-400">Loading Fix Engine…</div>}>
      <FixEngineClient />
    </Suspense>
  );
}

function FixEngineClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab: TabId = "improvement";
  const [statusMessage] = useState<string | null>(null);

  const { projectId } = useWorkspace();
  const activeProjectId = projectId ?? "";

  const setTab = (newTab: TabId) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", newTab);
    router.replace(`/fix-engine?${params.toString()}`);
  };

  return (
    <div className="space-y-6 pb-16">
      <PageHeader
        title="Fix Engine"
        subtitle="Your complete fix and improvement plan for Website Audit, Traffic, Competitor Intelligence and AI Visibility."
        actions={
          <div className="flex items-center gap-2">
            <a href="/reports/plan" className="text-[12px] font-semibold text-accent-700 hover:underline">Complete plan report →</a>
          </div>
        }
      />

      {statusMessage && (
        <StatusNote tone={statusMessage.includes("verified") ? "good" : "bad"}>
          {statusMessage}
        </StatusNote>
      )}

      {/* Only Improvement tab is displayed */}
      <Tabs tabs={TABS as unknown as { id: TabId; label: string; icon?: React.ElementType }[]} active={tab} onChange={setTab} />

      <PlanView key={activeProjectId} />

      {/* Autonomous Engineer runner controls preserved below plan */}
      <div className="pt-6 border-t space-y-4">
        <ShipPanel />
        <EngineerPanel />
        <RunsPanel />
      </div>
    </div>
  );
}
