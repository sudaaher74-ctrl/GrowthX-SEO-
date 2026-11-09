"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ArrowRight, GitPullRequest, History, ShieldCheck, TrendingUp, Wrench, Zap } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useFindings, useWorkspace } from "@/hooks/use-growthx";
import { PageHeader, Tabs, StatusNote } from "@/components/ui/console";
import { PlanView } from "@/components/fix-engine/plan-view";
import { GitHubFixesLogView } from "@/components/fix-engine/github-fixes-log-view";
import { SavedTasksPanel } from "@/components/fix-engine/saved-tasks-panel";
import { AdaptiveResultsHub } from "@/components/fix-engine/adaptive-results-hub";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "improvement", label: "Improvement Plan", icon: Wrench },
  { id: "github-fixes", label: "Fixes & Log", icon: History },
  { id: "results", label: "Results", icon: TrendingUp },
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
    rawTab === "results" || rawTab === "changes" || rawTab === "self-healing" || rawTab === "proof"
      ? "results"
      : legacyJourney ||
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

  const findings = useFindings(activeProjectId, { limit: 100 });
  const savedPlans = useQuery({
    queryKey: ["saved-plans", activeProjectId],
    queryFn: () => api.savedPlans.list(activeProjectId),
    enabled: Boolean(activeProjectId),
    retry: false,
    staleTime: 60000,
  });

  const stagedTasksCount = (savedPlans.data ?? []).filter((t) => t.status === "STAGED").length;
  const highImpactCount = findings.data?.items.filter((i) => i.potential === "HIGH").length ?? 0;
  const autoFixableCount = findings.data?.items.filter((i) => i.fixClass === "AUTO").length ?? 0;
  const queuedCount = findings.data?.items.filter((i) => i.lifecycle === "QUEUED" || i.lifecycle === "APPROVED").length ?? 0;
  const totalFindingsCount = findings.data?.items.length ?? 0;

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

      {/* ── EXECUTIVE AUTONOMOUS EXECUTION TELEMETRY RIBBON ── */}
      <div className="rounded-2xl border border-brand-200/80 bg-surface-1 p-4 shadow-2xs">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-signal-400 text-signal-ink font-bold shadow-2xs">
                <Wrench size={18} />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-[14.5px] font-bold text-brand-950">
                    Fix Engine Autonomous Orchestrator
                  </h2>
                  {stagedTasksCount > 0 ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-signal-400/40 bg-signal-400/15 px-2.5 py-0.5 text-[10.5px] font-mono font-bold text-brand-950">
                      <Zap size={11} className="text-signal-500" />
                      {stagedTasksCount} Staged from Intelligence Tabs
                    </span>
                  ) : (
                    <span className="rounded-full bg-surface-2 border border-brand-200/70 px-2.5 py-0.5 text-[10.5px] font-mono font-semibold text-brand-700">
                      Pipeline Active
                    </span>
                  )}
                  {highImpactCount > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-success-200/60 bg-success-50 px-2.5 py-0.5 text-[10.5px] font-mono font-bold text-success-700">
                      <ShieldCheck size={12} className="text-success-600" />
                      {highImpactCount} High Impact
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-[11.5px] text-brand-400">
                  Consolidated 30-day autonomous action plan uniting Website Audit, Traffic, Competitor Radar, SERP Striking Distance, and AI Visibility gaps.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setTab("github-fixes")}
                className="inline-flex items-center gap-1.5 rounded-lg bg-signal-400 px-3.5 py-1.5 text-[11.5px] font-bold text-signal-ink shadow-xs transition-all hover:bg-signal-500 active:scale-[0.98]"
              >
                <GitPullRequest size={12} className="text-signal-ink" />
                <span>GitHub Fixes &amp; Log</span>
                <ArrowRight size={12} />
              </button>
              <button
                type="button"
                onClick={() => setTab("results")}
                className="inline-flex items-center gap-1.5 rounded-lg border border-brand-200/80 bg-surface-1 px-3.5 py-1.5 text-[11.5px] font-semibold text-brand-800 hover:bg-brand-50 hover:text-brand-950 transition-colors shadow-2xs"
              >
                <span>Proof &amp; Results</span>
                <ArrowRight size={12} />
              </button>
            </div>
          </div>

          {/* Execution Metric Telemetry Beacons */}
          <div className="flex flex-wrap items-center gap-3 border-t border-brand-200/60 pt-3 text-[11px]">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-signal-400" />
              <span className="text-brand-500 font-medium">Auto-Fixable:</span>
              <span className="font-mono font-bold text-brand-950">{autoFixableCount}</span>
            </div>
            <span className="text-brand-300">·</span>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-success-500" />
              <span className="text-brand-500 font-medium">In Plan / Approved:</span>
              <span className="font-mono font-bold text-brand-950">{queuedCount}</span>
            </div>
            <span className="text-brand-300">·</span>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-brand-400" />
              <span className="text-brand-500 font-medium">Total Opportunities:</span>
              <span className="font-mono font-bold text-brand-950">{totalFindingsCount}</span>
            </div>
            <span className="text-brand-300">·</span>
            <div className="flex items-center gap-1.5">
              <span className="text-brand-500 font-medium">Deployment Targets:</span>
              <span className="font-mono text-brand-800">GitHub · WordPress · Shopify · Webflow · CMS</span>
            </div>
          </div>
        </div>
      </div>

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
          key={`${activeProjectId}-${legacyJourney}-${findingId ?? "all"}-${preparedTask?.projectId === activeProjectId ? preparedTask.revision : 0}`}
          initialSection={legacyJourney ? "IMPROVEMENT_LOG" : "ALL"}
          initialFindingId={findingId}
          initialInstruction={preparedTask?.projectId === activeProjectId ? preparedTask.instruction : undefined}
        />
      ) : (
        <AdaptiveResultsHub />
      )}
    </div>
  );
}
