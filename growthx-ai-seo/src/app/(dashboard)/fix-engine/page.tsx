"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { GitPullRequest, History, Wrench } from "lucide-react";
import { useWorkspace } from "@/hooks/use-growthx";
import { PageHeader, Tabs, StatusNote } from "@/components/ui/console";
import { PlanView } from "@/components/fix-engine/plan-view";
import { GitHubFixesLogView } from "@/components/fix-engine/github-fixes-log-view";
import { SavedTasksPanel } from "@/components/fix-engine/saved-tasks-panel";
import { ImpactLedgerProofView } from "@/components/fix-engine/impact-ledger-proof-view";

const TABS = [
  { id: "improvement", label: "Improvement", icon: Wrench },
  { id: "github-fixes", label: "GitHub Fixes & Improvement Log", icon: GitPullRequest },
  { id: "impact-ledger", label: "Impact Ledger & 30d/90d Proof", icon: History },
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
  const tab: TabId =
    rawTab === "impact-ledger" || rawTab === "ledger" || rawTab === "proof"
      ? "impact-ledger"
      : rawTab === "github-fixes" || rawTab === "fixes"
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
        subtitle="Your complete fix and improvement plan for Website Audit, Traffic, Competitor Intelligence and AI Visibility — with GitHub Pull Requests, Before & After proof, and a complete Improvement Log."
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
      ) : tab === "github-fixes" ? (
        <GitHubFixesLogView
          key={`${activeProjectId}-${findingId ?? "all"}-${preparedTask?.projectId === activeProjectId ? preparedTask.revision : 0}`}
          initialFindingId={findingId}
          initialInstruction={preparedTask?.projectId === activeProjectId ? preparedTask.instruction : undefined}
        />
      ) : (
        <ImpactLedgerProofView
          key={activeProjectId}
          projectId={activeProjectId}
          onNavigateTab={(targetTab) => setTab(targetTab)}
          onLaunchIteration={(instruction) => {
            setPreparedTask((previous) => ({
              projectId: activeProjectId,
              instruction,
              revision: (previous?.revision ?? 0) + 1,
            }));
            setTab("github-fixes");
          }}
        />
      )}
    </div>
  );
}
