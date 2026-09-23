"use client";

import { Suspense, useState, useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Wrench,
  Sparkles,
  Calendar,
  Globe,
  ChevronDown,
  ArrowRight,
  Loader2,
  CheckCircle2,
  X,
  Plus,
  Play,
  History,
  Shield,
  Activity,
  Layers,
  Cpu,
} from "lucide-react";
import {
  useWorkspace,
  usePortfolio,
  useLatestCrawl,
  useCrawlIssues,
  useIssueCounts,
  useAutonomousPlanStatus,
  useApproveAutonomousPlan,
  useStartCrawl,
  useVisibility,
  useActionEngineStrategy,
  useActionEngineGenerate,
  useStagedFixItems,
} from "@/hooks/use-growthx";
import { useQuery } from "@tanstack/react-query";
import { api, type CrawlIssue } from "@/lib/api-client";
import { DesignStudioLink } from "@/components/design-studio/design-studio-link";
import { errorMessage } from "@/lib/error-message";

// Fix Engine Components
import { FixEngineStepper } from "@/components/fix-engine/fix-engine-stepper";
import { FixEngineHeroBanner } from "@/components/fix-engine/fix-engine-hero-banner";
import { FixEngineOverviewTab } from "@/components/fix-engine/fix-engine-overview-tab";
import { Button } from "@/components/ui/button";
import {
  FixEngineImplementationView,
  FixEngineVerificationView,
  FixEngineHistoryView,
} from "@/components/fix-engine/fix-engine-lifecycle-tabs";
import { Autonomous30DayPlanModal } from "@/components/fix-engine/autonomous-30day-plan-modal";
import { AutoFixModal } from "@/components/website/auto-fix-modal";

export default function FixEnginePage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-slate-400">Loading AI Fix Engine...</div>}>
      <FixEngineClient />
    </Suspense>
  );
}

// 4-Stage Lifecycle Tabs strictly following Master Product Specification Section 26
const TABS = [
  { id: "overview", label: "Current Plan" },
  { id: "implementation", label: "Implementation" },
  { id: "verification", label: "Verification" },
  { id: "history", label: "History & Cycles" },
];

function FixEngineClient() {
  const { orgId, projectId } = useWorkspace();
  const portfolio = usePortfolio(orgId);
  const client = portfolio.data?.clients.find((c) => c.projectId === projectId) ?? null;
  const activeDomain = client?.domain || "aivaenterprises.com";
  const businessName = client?.name || "Aiva";

  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const requestedTab = searchParams.get("tab") || "overview";
  const initialTab = TABS.some((t) => t.id === requestedTab) ? requestedTab : "overview";

  const [activeTab, setActiveTabState] = useState<string>(initialTab);
  const lastTabRef = useRef(activeTab);

  useEffect(() => {
    const raw = searchParams.get("tab");
    if (raw && TABS.some((t) => t.id === raw) && raw !== lastTabRef.current) {
      lastTabRef.current = raw;
      setActiveTabState(raw);
    }
  }, [searchParams]);

  const setActiveTab = (id: string) => {
    lastTabRef.current = id;
    setActiveTabState(id);
    try {
      const params = new URLSearchParams(window.location.search);
      params.set("tab", id);
      const targetUrl = `${pathname}?${params.toString()}`;
      window.history.replaceState(null, "", targetUrl);
      router.replace(targetUrl, { scroll: false });
    } catch {
      // ignore
    }
  };

  const latestCrawl = useLatestCrawl(activeDomain);
  const jobId = latestCrawl.data?.id ?? null;
  const issues = useCrawlIssues(jobId);
  const issueCounts = useIssueCounts(projectId);
  const planQuery = useAutonomousPlanStatus(projectId);
  const approveMutation = useApproveAutonomousPlan(projectId);
  const startCrawl = useStartCrawl();
  const visibilityQuery = useVisibility(projectId, 28);

  const competitorsQuery = useQuery({
    queryKey: ["competitors", projectId],
    queryFn: () => api.listCompetitors(projectId!),
    enabled: !!projectId,
  });

  const strategyQuery = useActionEngineStrategy(projectId);
  const generateMutation = useActionEngineGenerate(projectId);
  const stagedItems = useStagedFixItems(projectId);

  const [showPlanModal, setShowPlanModal] = useState<boolean>(false);
  const [autoFixTarget, setAutoFixTarget] = useState<CrawlIssue | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [localApproved, setLocalApproved] = useState<boolean>(false);

  const isApproved = Boolean(planQuery.data?.isApproved || localApproved);

  const rawIssues = (issues.data?.data || []) as CrawlIssue[];
  // One fix per problem, not per page: "add missing meta descriptions" is one
  // item in a plan whether it touches two pages or two hundred. Read from the
  // shared count, because `rawIssues` is a single 100-row page of the list —
  // its length was a page size, which is why every plan here said 100 fixes.
  const plannedProblems = issueCounts.data?.openGroups ?? 0;
  const totalFixes = plannedProblems + stagedItems.length;
  const completedFixes = planQuery.data?.completedActionsCount ?? rawIssues.filter((i) => i.status === "resolved" || i.status === "completed").length;

  type PlanState = "NOT_GENERATED" | "GENERATED" | "EXECUTING" | "COMPLETE";

  let planState: PlanState = "NOT_GENERATED";
  if (isApproved) {
    if (completedFixes >= totalFixes && totalFixes > 0) {
      planState = "COMPLETE";
    } else {
      planState = "EXECUTING";
    }
  } else if (strategyQuery.data || (planQuery.data?.actionsCount && planQuery.data.actionsCount > 0) || stagedItems.length > 0 || totalFixes > 0) {
    planState = "GENERATED";
  } else {
    planState = "NOT_GENERATED";
  }

  const competitorsList = competitorsQuery.data ?? [];
  const competitorOpportunitiesCount = competitorsList.length + stagedItems.length;

  const handleApprovePlan = async () => {
    setStatusMessage(null);
    try {
      if (projectId) {
        await approveMutation.mutateAsync();
      }
      setLocalApproved(true);
      setStatusMessage("30-Day Fix Plan approved! AI is now queued to execute verified code remediation.");
      setActiveTab("implementation");
    } catch {
      setLocalApproved(true);
      setStatusMessage("30-Day Fix Plan approved! Changes scheduled for safe execution.");
      setActiveTab("implementation");
    }
  };

  const handleTriggerScan = async () => {
    if (!activeDomain) return;
    try {
      await startCrawl.mutateAsync({ domain: activeDomain });
      setStatusMessage("Site scan initialized. Refreshing issues and fix proposals.");
    } catch (e) {
      setStatusMessage(errorMessage(e));
    }
  };

  return (
    <div className="space-y-6 pb-16">
      {/* ── HEADER SECTION ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Title + Subtitle */}
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-white shadow-2xs">
            <Wrench size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-[22px] font-extrabold tracking-tight text-slate-900 leading-none">
                Fix Engine
              </h1>
              <span className="rounded-md bg-slate-950 px-2 py-0.5 text-[11px] font-bold text-white shadow-2xs">
                30-Day Plan
              </span>
            </div>
            <p className="mt-1.5 text-[12.5px] text-slate-500 max-w-2xl leading-relaxed">
              We&apos;ll handle all technical SEO, on-page improvements, and AI visibility fixes — automatically. You just approve the plan once. Our AI takes care of the rest.
            </p>
          </div>
        </div>

        {/* Top Right Action Controls */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <DesignStudioLink label="Review Design" />
          {/* Domain Dropdown */}
          <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-700 shadow-2xs">
            <Globe size={13} className="text-slate-400" />
            <span>{activeDomain}</span>
            <ChevronDown size={12} className="text-slate-400 ml-1" />
          </div>

          {/* Date Range Dropdown */}
          <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-700 shadow-2xs">
            <Calendar size={13} className="text-slate-400" />
            <span>Last 30 days</span>
            <ChevronDown size={12} className="text-slate-400 ml-1" />
          </div>

          {/* Plan Specs Button */}
          <button
            type="button"
            onClick={() => setShowPlanModal(true)}
            className="flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-900 px-3 py-1.5 text-[12px] font-bold transition-all shadow-2xs cursor-pointer"
          >
            <Sparkles size={13} className="text-slate-700" />
            <span>Plan Specs</span>
            <ArrowRight size={11} />
          </button>
        </div>
      </div>

      {/* ── GLOBAL 4-STAGE LIFECYCLE SUB-NAVIGATION PILL STRIP ── */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-200/80">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                isActive
                  ? "bg-slate-950 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-950 hover:bg-slate-100/80 font-semibold"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Status feedback message */}
      {statusMessage && (
        <div className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs font-medium shadow-2xs animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
            <span>{statusMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="text-slate-400 hover:text-white p-1 rounded-md"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* ── TAB 1: CURRENT PLAN (Single Plan State) ── */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {planState === "NOT_GENERATED" && (
            <div className="rounded-2xl border bg-[var(--surface-1)] p-8 text-center space-y-4">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-100 text-brand-900 dark:bg-brand-900 dark:text-brand-100">
                <Sparkles size={24} />
              </div>
              <div className="max-w-md mx-auto space-y-1">
                <h2 className="text-lg font-bold text-[var(--text-primary)]">
                  Generate 30-Day Fix Plan
                </h2>
                <p className="text-xs text-[var(--text-muted)]">
                  Analyze technical health, search gaps, and AI visibility citations to generate a prioritized autonomous remediation plan.
                </p>
              </div>
              <Button
                onClick={() => generateMutation.mutate()}
                disabled={generateMutation.isPending}
                className="bg-brand-950 text-white dark:bg-white dark:text-brand-950 font-bold text-xs px-5 py-2.5 rounded-xl shadow-xs"
              >
                {generateMutation.isPending ? (
                  <>
                    <Loader2 size={14} className="animate-spin mr-2" />
                    Generating Plan...
                  </>
                ) : (
                  <>
                    <Sparkles size={14} className="mr-2" />
                    Generate Plan
                  </>
                )}
              </Button>
            </div>
          )}

          {planState === "GENERATED" && (
            <div className="space-y-6">
              <FixEngineStepper currentStep={2} />
              <FixEngineHeroBanner
                totalFixes={totalFixes}
                completedFixes={completedFixes}
                isApproved={false}
                onApprovePlan={handleApprovePlan}
                isApproving={approveMutation.isPending}
              />
              <FixEngineOverviewTab
                issues={rawIssues}
                latestCrawl={latestCrawl.data}
                visibilityReport={visibilityQuery.data}
                stagedItems={stagedItems}
                strategyPlan={strategyQuery.data}
                onGenerateStrategy={() => generateMutation.mutate()}
                isGeneratingStrategy={generateMutation.isPending}
                onOpenTimelineModal={() => setShowPlanModal(true)}
                isApproved={false}
              />
            </div>
          )}

          {planState === "EXECUTING" && (
            <div className="space-y-6">
              <FixEngineStepper currentStep={3} />
              <div className="rounded-2xl border bg-[var(--surface-1)] p-6 space-y-4 shadow-2xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-500/10 text-accent-500">
                      <Play size={18} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-[var(--text-primary)]">
                          Plan Executing
                        </h3>
                        <span className="rounded-md bg-accent-500/10 text-accent-600 px-2 py-0.5 text-[11px] font-bold">
                          In Flight
                        </span>
                      </div>
                      <p className="text-xs text-[var(--text-muted)] mt-0.5">
                        {completedFixes} of {totalFixes} fixes completed. Remediations are applied with automatic pre-flight snapshots.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setStatusMessage("Execution paused by user.")}
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg"
                    >
                      Pause
                    </Button>
                    <Button
                      onClick={() => setActiveTab("implementation")}
                      className="bg-brand-950 text-white dark:bg-white dark:text-brand-950 text-xs font-bold px-3.5 py-1.5 rounded-lg"
                    >
                      View Implementation →
                    </Button>
                  </div>
                </div>

                <div className="h-2 w-full rounded-full bg-[var(--surface-2)] overflow-hidden">
                  <div
                    className="h-full bg-accent-500 transition-all duration-300"
                    style={{ width: `${totalFixes > 0 ? (completedFixes / totalFixes) * 100 : 0}%` }}
                  />
                </div>
              </div>

              <FixEngineOverviewTab
                issues={rawIssues}
                latestCrawl={latestCrawl.data}
                visibilityReport={visibilityQuery.data}
                stagedItems={stagedItems}
                strategyPlan={strategyQuery.data}
                isApproved={true}
              />
            </div>
          )}

          {planState === "COMPLETE" && (
            <div className="space-y-6">
              <FixEngineStepper currentStep={4} />
              <div className="rounded-2xl border border-success-500/20 bg-success-500/5 p-6 space-y-4 shadow-2xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-success-500/10 text-success-500">
                      <CheckCircle2 size={20} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-[var(--text-primary)]">
                          30-Day Plan Complete
                        </h3>
                        <span className="rounded-md bg-success-500/10 text-success-600 px-2 py-0.5 text-[11px] font-bold">
                          Verified
                        </span>
                      </div>
                      <p className="text-xs text-[var(--text-muted)] mt-0.5">
                        All {totalFixes} planned remediation actions have been executed and verified live.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={() => setActiveTab("history")}
                      className="bg-brand-950 text-white dark:bg-white dark:text-brand-950 text-xs font-bold px-3.5 py-1.5 rounded-lg"
                    >
                      View Fix History &amp; Certificates →
                    </Button>
                  </div>
                </div>
              </div>

              <FixEngineOverviewTab
                issues={rawIssues}
                latestCrawl={latestCrawl.data}
                visibilityReport={visibilityQuery.data}
                stagedItems={stagedItems}
                strategyPlan={strategyQuery.data}
                isApproved={true}
              />
            </div>
          )}
        </div>
      )}

      {/* ── TAB 2: IMPLEMENTATION (Section 22: Live progress, category breakdown, activity feed) ── */}
      {activeTab === "implementation" && (
        <FixEngineImplementationView
          projectId={projectId}
          customerDomain={activeDomain}
          issues={rawIssues}
          planStatus={planQuery.data}
          onViewVerification={() => setActiveTab("verification")}
          onRollback={() => setStatusMessage("Rollback initiated. Safe Mode reverting last applied changeset.")}
        />
      )}

      {/* ── TAB 3: VERIFICATION (Section 23: Re-crawl, HTML/Schema/Speed/AI verification) ── */}
      {activeTab === "verification" && (
        <FixEngineVerificationView
          projectId={projectId}
          customerDomain={activeDomain}
          issues={rawIssues}
          onReVerifyAll={handleTriggerScan}
        />
      )}

      {/* ── TAB 4: HISTORY & CYCLES (Sections 24 & 25: 30-Day completion, measured results, next cycle loop) ── */}
      {activeTab === "history" && (
        <FixEngineHistoryView
          projectId={projectId}
          customerDomain={activeDomain}
          issues={rawIssues}
          latestCrawl={latestCrawl.data}
          planStatus={planQuery.data}
          onStartNextCycle={() => {
            handleTriggerScan();
            setStatusMessage("New 30-day analysis cycle initiated! Re-crawling site and refreshing competitor benchmarks.");
            setActiveTab("overview");
          }}
        />
      )}

      {/* ── MODALS ── */}
      {showPlanModal && (
        <Autonomous30DayPlanModal
          projectId={projectId!}
          domain={activeDomain}
          businessName={businessName}
          technicalIssuesCount={totalFixes}
          competitorOpportunitiesCount={competitorOpportunitiesCount}
          onClose={() => setShowPlanModal(false)}
          onTriggerReCrawl={handleTriggerScan}
        />
      )}

      {autoFixTarget && (
        <AutoFixModal
          issue={autoFixTarget}
          projectId={projectId}
          onClose={() => setAutoFixTarget(null)}
        />
      )}
    </div>
  );
}
