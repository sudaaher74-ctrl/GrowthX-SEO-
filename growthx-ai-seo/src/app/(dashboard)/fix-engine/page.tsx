"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowUpRight,
  CheckCircle2,
  ClipboardList,
  Code2,
  FileText,
  History,
  Lock,
  Sparkles,
  TrendingUp,
  UserCheck,
  Wrench,
  Zap,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useFindings, useWorkspace } from "@/hooks/use-growthx";
import { Tabs } from "@/components/ui/console";
import { PlanView } from "@/components/fix-engine/plan-view";
import { GitHubFixesLogView } from "@/components/fix-engine/github-fixes-log-view";
import { SavedTasksPanel } from "@/components/fix-engine/saved-tasks-panel";
import { AdaptiveResultsHub } from "@/components/fix-engine/adaptive-results-hub";
import { ContentStudioView } from "@/components/fix-engine/content-studio-view";
import { api, type GrowthOpportunity } from "@/lib/api-client";
import { getIssueFixGuide } from "@/lib/issue-fix-guides";
import { stagingEngine } from "@/lib/staging-engine";
import { useSubscription } from "@/lib/subscription-engine";

type TabId = "improvement" | "content" | "github-fixes" | "results";

export default function FixEnginePage() {
  return (
    <Suspense fallback={<div className="p-8 text-[13px] text-brand-400">Loading Action Plan…</div>}>
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
      : rawTab === "content" || rawTab === "content-studio"
        ? "content"
        : legacyJourney ||
            rawTab === "github-fixes" ||
            rawTab === "fixes" ||
            rawTab === "improvements"
          ? "github-fixes"
          : "improvement";
  const findingId = searchParams.get("findingId");
  const urlContentQuery = searchParams.get("query");
  const urlContentTopic = searchParams.get("topic");
  const urlContentKind = searchParams.get("kind") as
    | "ARTICLE"
    | "BRIEF"
    | "FAQ"
    | "LANDING_PAGE_OUTLINE"
    | "SCHEMA_MARKUP"
    | "GBP_POST"
    | null;
  const [preparedTask, setPreparedTask] = useState<{
    projectId: string;
    instruction: string;
    revision: number;
  } | null>(null);
  const [contentSeedFinding, setContentSeedFinding] = useState<GrowthOpportunity | null>(null);

  const { orgId, projectId, projects } = useWorkspace();
  const { canUseFixEngine, plan } = useSubscription(orgId);
  const activeProjectId = projectId ?? "";
  const domain = projects.find((p) => p.id === activeProjectId)?.name ?? null;

  const visibleTabs = useMemo(
    () => [
      { id: "improvement" as TabId, label: "Action Plan & Guides" },
      { id: "content" as TabId, label: "AI Content Writer" },
      {
        id: "github-fixes" as TabId,
        label: canUseFixEngine ? "Auto-Apply & Log" : "Auto-Apply (Agency)",
        icon: canUseFixEngine ? undefined : Lock,
      },
      { id: "results" as TabId, label: "Verified Results" },
    ],
    [canUseFixEngine],
  );

  useEffect(() => {
    if (activeProjectId) {
      void stagingEngine.sync(activeProjectId);
    }
  }, [activeProjectId]);

  const findings = useFindings(activeProjectId, { limit: 150 });
  const savedPlans = useQuery({
    queryKey: ["saved-plans", activeProjectId],
    queryFn: () => api.savedPlans.list(activeProjectId),
    enabled: Boolean(activeProjectId),
    retry: false,
    staleTime: 0,
    refetchOnMount: "always",
  });

  const stats = useMemo(() => {
    const items = (findings.data?.items ?? []).filter(
      (i) => !["DISMISSED"].includes(i.lifecycle ?? "DETECTED"),
    );
    const active = items.filter((i) => !["RESOLVED", "VERIFIED", "MEASURED"].includes(i.lifecycle ?? "DETECTED"));
    let noCodeCount = 0;
    let devCount = 0;
    for (const item of active) {
      const g = getIssueFixGuide({
        title: item.title,
        summary: item.summary,
        recommendedAction: item.recommendedAction,
        domain,
        fixClass: item.fixClass,
        source: item.source,
      });
      if (g.difficulty === "no_code") noCodeCount += 1;
      else if (g.difficulty === "developer") devCount += 1;
    }
    const highImpactCount = active.filter((i) => i.potential === "HIGH").length;
    const confirmedCount = items.filter((i) =>
      ["RESOLVED", "VERIFIED", "MEASURED"].includes(i.lifecycle ?? "DETECTED"),
    ).length;
    return {
      openCount: active.length,
      noCodeCount,
      devCount,
      highImpactCount,
      confirmedCount,
    };
  }, [findings.data?.items, domain]);

  const stagedTasksCount = (savedPlans.data ?? []).filter((t) => t.status === "STAGED").length;

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
    <div className="space-y-5 pb-16">
      {/* Clean Header */}
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold leading-tight tracking-tight text-brand-950">
            {canUseFixEngine ? "Fix Engine" : "Action Plan"}
          </h1>
          <p className="mt-1 text-[13px] text-brand-500">
            Prioritized fixes, step-by-step guides, and verified results.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/reports/plan"
            className="inline-flex items-center gap-1.5 rounded-xl border border-brand-200 bg-surface-1 px-3 py-2 text-xs font-semibold text-brand-700 hover:bg-brand-50 hover:text-brand-950 transition"
          >
            <span>Complete plan report →</span>
          </Link>
        </div>
      </header>

      {/* 4-Card Summary Strip */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-2xl border border-brand-200/80 bg-surface-1 p-4 shadow-2xs">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-400">
            High Impact
          </p>
          <p className="mt-2 font-mono text-2xl font-bold text-brand-950 tabular-nums">
            {stats.highImpactCount}
          </p>
          <p className="mt-0.5 text-[11.5px] text-brand-500">
            Of {stats.openCount} open {stats.openCount === 1 ? "issue" : "issues"}
          </p>
        </div>

        <div className="rounded-2xl border border-brand-200/80 bg-surface-1 p-4 shadow-2xs">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-400">
            No Coding Needed
          </p>
          <p className="mt-2 font-mono text-2xl font-bold text-brand-950 tabular-nums">
            {stats.noCodeCount}
          </p>
          <p className="mt-0.5 text-[11.5px] text-brand-500">
            Quick DIY steps in your CMS
          </p>
        </div>

        <div className="rounded-2xl border border-brand-200/80 bg-surface-1 p-4 shadow-2xs">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-400">
            Developer Tasks
          </p>
          <p className="mt-2 font-mono text-2xl font-bold text-brand-950 tabular-nums">
            {stats.devCount}
          </p>
          <p className="mt-0.5 text-[11.5px] text-brand-500">
            1-click copy or WhatsApp handoff
          </p>
        </div>

        <div className="rounded-2xl border border-brand-200/80 bg-surface-1 p-4 shadow-2xs">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-400">
            Confirmed Fixed
          </p>
          <p className="mt-2 font-mono text-2xl font-bold text-brand-950 tabular-nums">
            {stats.confirmedCount}
          </p>
          <p className="mt-0.5 text-[11.5px] text-brand-500">
            {stagedTasksCount > 0 ? `${stagedTasksCount} staged in queue` : "Verified on live site"}
          </p>
        </div>
      </div>

      {/* Clear 4-Tab Bar */}
      <Tabs
        tabs={visibleTabs}
        active={tab}
        onChange={(nextTab) => setTab(nextTab)}
      />

      {tab === "improvement" ? (
        <div className="space-y-5">
          {canUseFixEngine && (
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
          )}
          <PlanView
            key={activeProjectId}
            canAutoApply={canUseFixEngine}
            onOpenGitHubFixes={canUseFixEngine ? (fId) => setTab("github-fixes", fId) : undefined}
            onOpenContentStudio={(finding) => {
              setContentSeedFinding(finding);
              setTab("content");
            }}
          />
        </div>
      ) : tab === "github-fixes" ? (
        canUseFixEngine ? (
          <GitHubFixesLogView
            key={`${activeProjectId}-${legacyJourney}-${findingId ?? "all"}-${preparedTask?.projectId === activeProjectId ? preparedTask.revision : 0}`}
            initialSection={legacyJourney ? "IMPROVEMENT_LOG" : "ALL"}
            initialFindingId={findingId}
            initialInstruction={
              preparedTask?.projectId === activeProjectId ? preparedTask.instruction : undefined
            }
          />
        ) : (
          <div className="rounded-2xl border border-brand-200 bg-surface-1 p-8 text-center shadow-2xs space-y-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-signal-400/20 text-brand-950">
              <Sparkles size={22} />
            </div>
            <div className="mx-auto max-w-lg space-y-1.5">
              <p className="text-[11px] font-bold uppercase tracking-wider text-brand-400">
                Included in Agency Plan
              </p>
              <h2 className="text-lg font-bold tracking-tight text-brand-950">
                Automated Fix Engine (GitHub PRs &amp; Direct CMS Publishing)
              </h2>
              <p className="text-[13px] leading-relaxed text-brand-500">
                Your current <strong className="text-brand-900">{plan?.name || "Starter / Growth"}</strong> plan includes every plain-English issue explanation, 5-platform step-by-step fix guide, 1-click Developer WhatsApp handoff, and Live URL Verification. Upgrade to <strong className="text-brand-900">Agency</strong> to unlock automated GitHub pull requests, direct WordPress/Shopify/Webflow publishing, and batch auto-fixes.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setTab("improvement")}
                className="inline-flex items-center gap-1.5 rounded-xl border border-brand-200 bg-surface-1 px-4 py-2 text-xs font-semibold text-brand-800 hover:bg-brand-100 transition cursor-pointer"
              >
                <span>Back to Step-by-Step Guides</span>
              </button>
              <Link
                href="/pricing"
                className="inline-flex items-center gap-1.5 rounded-xl bg-signal-400 px-4 py-2 text-xs font-bold text-signal-ink shadow-xs hover:bg-signal-500 transition"
              >
                <span>Compare Agency Plan</span>
                <ArrowUpRight size={13} />
              </Link>
            </div>
          </div>
        )
      ) : tab === "content" ? (
        <ContentStudioView
          key={activeProjectId}
          initialFinding={contentSeedFinding}
          initialQuery={urlContentQuery}
          initialTopic={urlContentTopic}
          initialKind={urlContentKind}
          onClearInitialFinding={() => setContentSeedFinding(null)}
        />
      ) : (
        <AdaptiveResultsHub />
      )}
    </div>
  );
}
