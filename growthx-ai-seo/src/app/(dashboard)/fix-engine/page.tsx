"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { History, Wrench } from "lucide-react";
import { useWorkspace } from "@/hooks/use-growthx";
import { PageHeader, Tabs, StatusNote } from "@/components/ui/console";
import { PlanView } from "@/components/fix-engine/plan-view";
import { GitHubFixesLogView } from "@/components/fix-engine/github-fixes-log-view";
import { SavedTasksPanel } from "@/components/fix-engine/saved-tasks-panel";

const TABS = [
  { id: "improvement", label: "Improvement Plan", icon: Wrench },
  { id: "github-fixes", label: "Improvements & Log", icon: History },
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
  const rawTab = searchParams.get("tab");
  const legacyJourney = ["impact-ledger", "ledger", "proof"].includes(rawTab ?? "");
  const tab: TabId =
    legacyJourney ||
    rawTab === "github-fixes" ||
    rawTab === "fixes" ||
    rawTab === "improvements"
      ? "github-fixes"
      : "improvement";
  const findingId = searchParams.get("findingId");
  const [statusMessage] = useState<string | null>(null);
  const [preparedTask, setPreparedTask] = useState<{ projectId: string; instruction: string; revision: number } | null>(null);

  const { projectId } = useWorkspace();
  const activeProjectId = projectId ?? "";

  const setTab = (newTab: TabId, targetFindingId?: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", newTab);
    if (targetFindingId) {
      params.set("findingId", targetFindingId);
    } else if (newTab !== "github-fixes") {
      params.delete("findingId");
    }
    router.replace(`/fix-engine?${params.toString()}`);
  };

  return (
    <div className="space-y-6 pb-16">
      <PageHeader
        title="Fix Engine"
        subtitle="Your complete fix and improvement plan across Website Audit, Traffic, Competitor Intelligence, Backlinks, and AI Visibility — apply updates via GitHub, WordPress, Shopify, Webflow, or Manual CMS with Before & After proof and a complete Improvement Log."
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

      <Tabs
        tabs={TABS as unknown as { id: TabId; label: string; icon?: React.ElementType }[]}
        active={tab}
        onChange={(nextTab) => setTab(nextTab)}
      />

      {tab === "improvement" ? (
        <div className="space-y-6">
          <SavedTasksPanel
            key={activeProjectId}
            projectId={projectId}
            onPrepare={(instruction) => {
              setPreparedTask((previous) => ({
                projectId: activeProjectId,
                instruction,
                revision: (previous?.revision ?? 0) + 1,
              }));
              setTab("github-fixes");
            }}
          />
          <PlanView
            key={activeProjectId}
            onOpenGitHubFixes={(fId) => setTab("github-fixes", fId)}
          />
        </div>
      ) : (
        <GitHubFixesLogView
          key={`${activeProjectId}-${legacyJourney}-${findingId ?? "all"}-${preparedTask?.projectId === activeProjectId ? preparedTask.revision : 0}`}
          initialSection={legacyJourney ? "IMPROVEMENT_LOG" : "ALL"}
          initialFindingId={findingId}
          initialInstruction={preparedTask?.projectId === activeProjectId ? preparedTask.instruction : undefined}
        />
      )}
    </div>
  );
}
