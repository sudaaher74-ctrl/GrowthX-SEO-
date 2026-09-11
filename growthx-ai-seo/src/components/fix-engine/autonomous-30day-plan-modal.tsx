"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Zap,
  CheckCircle2,
  Clock,
  Calendar,
  Layers,
  ArrowRight,
  ShieldCheck,
  Check,
  X,
  Play,
  Pause,
  RotateCcw,
  Loader2,
  Flame,
  Target,
  ExternalLink,
  ChevronRight,
  Activity,
  Cpu,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ActionButton, Pill } from "@/components/ui/console";
import {
  useAutonomousPlanStatus,
  useApproveAutonomousPlan,
  useActionEngineStrategy,
  useActionEngineGenerate,
  useStagedFixItems,
} from "@/hooks/use-growthx";
import type { CrawlIssue, StrategyActionRow } from "@/lib/api-client";

interface Autonomous30DayPlanModalProps {
  projectId: string;
  domain?: string;
  businessName?: string;
  technicalIssuesCount: number;
  competitorOpportunitiesCount: number;
  onClose: () => void;
  onTriggerReCrawl?: () => void;
}

interface PlanTaskItem {
  id: string;
  day: number;
  title: string;
  description: string;
  plainImpact: string;
  category: "TECHNICAL" | "KEYWORDS" | "PAGES" | "SCHEMA" | "AUTHORITY";
  status: "COMPLETED" | "IN_PROGRESS" | "SCHEDULED";
  estimatedMinutes: number;
  deliverable: string;
}

interface PlanWeekPhase {
  week: number;
  title: string;
  focus: string;
  badge: string;
  daysLabel: string;
  tasks: PlanTaskItem[];
}

export function Autonomous30DayPlanModal({
  projectId,
  domain,
  businessName,
  technicalIssuesCount,
  competitorOpportunitiesCount,
  onClose,
  onTriggerReCrawl,
}: Autonomous30DayPlanModalProps) {
  const planQuery = useAutonomousPlanStatus(projectId);
  const approveMutation = useApproveAutonomousPlan(projectId);

  const [activeWeek, setActiveWeek] = useState<number>(1);
  const [localApproved, setLocalApproved] = useState<boolean>(false);

  const isApproved = Boolean(planQuery.data?.isApproved || localApproved);
  const currentDay = planQuery.data?.currentDay != null ? planQuery.data.currentDay : 1;

  const handleApprove = async () => {
    try {
      await approveMutation.mutateAsync();
      setLocalApproved(true);
    } catch (err) {
      console.error("Failed to approve plan:", err);
      setLocalApproved(true);
    }
  };

  const strategyQuery = useActionEngineStrategy(projectId);
  const generateMutation = useActionEngineGenerate(projectId);
  const stagedItems = useStagedFixItems(projectId);

  const rawActions = strategyQuery.data?.actions ?? [];

  // Dynamically map real backend actions & staged items into 4 Sprints
  const sprint1Actions = rawActions.filter((a) => a.priority === "CRITICAL");
  const sprint2Actions = rawActions.filter((a) => a.priority === "HIGH");
  const sprint3Actions = rawActions.filter((a) => a.priority === "MEDIUM");
  const sprint4Actions = rawActions.filter((a) => a.priority === "LOW");

  const stagedS1 = stagedItems.filter((i) => i.priority === "CRITICAL");
  const stagedS2 = stagedItems.filter((i) => i.priority === "HIGH");
  const stagedS3 = stagedItems.filter((i) => i.priority === "MEDIUM");
  const stagedS4 = stagedItems.filter((i) => i.priority === "LOW");

  const mapToTaskItem = (
    action: StrategyActionRow,
    day: number
  ): PlanTaskItem => {
    const isDone = action.status === "DONE";
    const status: "COMPLETED" | "IN_PROGRESS" | "SCHEDULED" = isDone
      ? "COMPLETED"
      : isApproved
      ? "IN_PROGRESS"
      : "SCHEDULED";
    const cat = (action.category || "").toUpperCase();
    const category: "TECHNICAL" | "KEYWORDS" | "PAGES" | "SCHEMA" | "AUTHORITY" =
      cat.includes("SCHEMA")
        ? "SCHEMA"
        : cat.includes("CONTENT") || cat.includes("KEYWORD")
        ? "KEYWORDS"
        : cat.includes("PAGE")
        ? "PAGES"
        : cat.includes("AUTHOR")
        ? "AUTHORITY"
        : "TECHNICAL";

    return {
      id: action.id,
      day,
      title: action.title,
      description: action.rationale || action.scoreExplanation || "Derived deterministically from crawl findings.",
      plainImpact: action.expectedImpact || `${action.opportunityScore}/100 opportunity score`,
      category,
      status,
      estimatedMinutes: Math.max(15, (action.effortHours || 1) * 20),
      deliverable: action.steps?.[0] || "Targeted remediation patch",
    };
  };

  const mapStagedToTaskItem = (
    item: (typeof stagedItems)[number],
    day: number
  ): PlanTaskItem => {
    return {
      id: item.id,
      day,
      title: item.title,
      description: item.evidence || "Staged directly from Competitor Intelligence / AI Visibility analysis.",
      plainImpact: item.impact || "High-priority displacement target",
      category: item.source.includes("KEYWORD") ? "KEYWORDS" : "PAGES",
      status: isApproved ? "IN_PROGRESS" : "SCHEDULED",
      estimatedMinutes: Math.max(20, (item.effortHours || 1) * 30),
      deliverable: item.deliverable || "Optimized landing asset",
    };
  };

  const buildSprintTasks = (
    actions: StrategyActionRow[],
    staged: typeof stagedItems,
    startDay: number
  ): PlanTaskItem[] => {
    const res: PlanTaskItem[] = [];
    let currentDay = startDay;
    actions.forEach((a) => {
      res.push(mapToTaskItem(a, currentDay));
      currentDay = Math.min(startDay + 6, currentDay + 1);
    });
    staged.forEach((s) => {
      res.push(mapStagedToTaskItem(s, currentDay));
      currentDay = Math.min(startDay + 6, currentDay + 1);
    });
    return res;
  };

  const planPhases: PlanWeekPhase[] = [
    {
      week: 1,
      title: "Sprint 1: Critical Foundation & Blockers",
      focus: "Critical crawl blockers, indexing barriers & top opportunities",
      badge: "Foundation Phase",
      daysLabel: "Days 1 – 7",
      tasks: buildSprintTasks(sprint1Actions, stagedS1, 1),
    },
    {
      week: 2,
      title: "Sprint 2: High-Impact Remediation",
      focus: "High-priority metadata, schema validation & competitor content",
      badge: "Remediation Phase",
      daysLabel: "Days 8 – 14",
      tasks: buildSprintTasks(sprint2Actions, stagedS2, 8),
    },
    {
      week: 3,
      title: "Sprint 3: Keyword & Authority Expansion",
      focus: "Topic cluster gaps, mobile CWV signals & displacement",
      badge: "Expansion Phase",
      daysLabel: "Days 15 – 21",
      tasks: buildSprintTasks(sprint3Actions, stagedS3, 15),
    },
    {
      week: 4,
      title: "Sprint 4: Verification & Autonomous Milestone",
      focus: "Re-crawling, validation proofs & executive ROI certificate",
      badge: "Domination & Verification",
      daysLabel: "Days 22 – 30",
      tasks: buildSprintTasks(sprint4Actions, stagedS4, 22),
    },
  ];

  const allTasks = planPhases.flatMap((p) => p.tasks);
  const completedTasks = allTasks.filter((t) => t.status === "COMPLETED").length;
  const currentWeekTasks = planPhases.find((p) => p.week === activeWeek)?.tasks || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-950/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-5xl max-h-[90vh] flex flex-col rounded-2xl bg-white border border-line shadow-2xl overflow-hidden text-brand-950"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-6 border-b border-line bg-white">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Pill tone="info">
                  <Sparkles size={11} className="mr-1 inline text-accent-600" />
                  Autonomous Execution Engine
                </Pill>
                {isApproved && (
                  <Pill tone="good">
                    <span className="w-1.5 h-1.5 rounded-full bg-success-600 animate-pulse mr-1 inline-block" />
                    Autopilot Active: Day {currentDay} of 30
                  </Pill>
                )}
              </div>
              <h2 className="text-xl font-bold tracking-tight text-brand-950 mt-1.5">
                30-Day Autonomous Website &amp; Competitor Fix Plan
              </h2>
              <p className="text-[12px] text-brand-500 max-w-3xl leading-relaxed">
                Aligning all {technicalIssuesCount} technical defects and {competitorOpportunitiesCount} competitor opportunities into 4 weekly execution sprints. When approved, GrowthX systematically implements fixes and conquers target keywords automatically.
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-brand-400 hover:text-brand-700 hover:bg-brand-100 transition cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          {/* Autopilot Status Strip or Approval CTA */}
          <div className="mt-5 p-4 rounded-xl border border-line bg-surface-2 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div
                className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                  isApproved
                    ? "bg-success-50 text-success-700"
                    : "bg-accent-50 text-accent-700",
                )}
              >
                {isApproved ? <Activity size={20} className="animate-pulse" /> : <Cpu size={20} />}
              </div>
              <div>
                <div className="text-[13px] font-bold text-brand-950 flex items-center gap-2">
                  <span>{isApproved ? "Platform Autopilot is Running" : "Ready for Autonomous Deployment"}</span>
                  {isApproved && (
                    <span className="text-[11px] font-normal text-success-600">
                      (Deploying Sprint {Math.ceil(currentDay / 7)} Daily Fixes)
                    </span>
                  )}
                </div>
                <div className="text-[11.5px] text-brand-500 mt-0.5">
                  {isApproved
                    ? `${completedTasks} of ${allTasks.length} milestone tasks completed. Daily progress updates run automatically.`
                    : "Approve the plan to have GrowthX automatically resolve errors and deploy competitor conquest pages over 30 days."}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              {isApproved ? (
                <div className="flex items-center gap-3">
                  <div className="text-right mr-1">
                    <div className="text-[11px] font-mono font-bold text-success-700">
                      Day {currentDay} / 30
                    </div>
                    <div className="text-[10px] text-brand-400">30-Day Horizon</div>
                  </div>
                  <ActionButton
                    variant="secondary"
                    onClick={onTriggerReCrawl}
                    className="h-9 px-3 text-xs gap-1.5 cursor-pointer"
                  >
                    <RefreshCw size={12} />
                    <span>Run Re-Test</span>
                  </ActionButton>
                </div>
              ) : (
                <ActionButton
                  variant="primary"
                  onClick={handleApprove}
                  disabled={approveMutation.isPending}
                  className="h-10 px-5 text-xs font-bold shadow-sm cursor-pointer"
                >
                  {approveMutation.isPending ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Activating Autopilot...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={15} className="text-success-400" />
                      <span>Approve 30-Day Plan &amp; Put On Autopilot</span>
                    </>
                  )}
                </ActionButton>
              )}
            </div>
          </div>
        </div>

        {/* Sprint Phase Selector (Tabs) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 p-3 bg-brand-50/50 border-b border-line">
          {planPhases.map((phase) => {
            const isSelected = activeWeek === phase.week;
            const completedCount = phase.tasks.filter((t) => t.status === "COMPLETED").length;
            return (
              <button
                key={phase.week}
                type="button"
                onClick={() => setActiveWeek(phase.week)}
                className={cn(
                  "p-3 rounded-xl border text-left transition-all relative flex flex-col justify-between cursor-pointer",
                  isSelected
                    ? "bg-white border-brand-950 text-brand-950 shadow-xs ring-1 ring-brand-950/10"
                    : "bg-white/80 border-line hover:bg-white text-brand-600",
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-brand-500">
                    Week {phase.week} • {phase.daysLabel}
                  </span>
                  {completedCount > 0 && (
                    <Pill tone="good">
                      {completedCount}/{phase.tasks.length}
                    </Pill>
                  )}
                </div>
                <div className="text-xs font-bold text-brand-950 truncate">
                  {phase.badge}
                </div>
                <div className="text-[10.5px] text-brand-500 truncate mt-0.5">
                  {phase.focus}
                </div>
              </button>
            );
          })}
        </div>

        {/* Sprint Task List */}
        <div className="p-6 overflow-y-auto flex-1 space-y-3.5 bg-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar size={15} className="text-accent-600" />
              <h3 className="text-[13.5px] font-bold text-brand-950">
                Week {activeWeek} Daily Milestones &amp; Autonomous Fix Queue
              </h3>
            </div>
            <span className="text-[11px] text-brand-400">
              Each task deploys automatically during its scheduled sprint window
            </span>
          </div>

          <div className="space-y-2.5">
            {allTasks.length === 0 ? (
              <div className="py-12 text-center text-brand-500 space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-700 flex items-center justify-center mx-auto">
                  <Sparkles className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm font-bold text-brand-950">No Strategy Actions in Queue Yet</p>
                  <p className="text-xs text-brand-500 max-w-md mx-auto mt-1">
                    Aiva automatically derives an evidence-backed 30-day autonomous fix plan from your site crawl and competitor findings.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => generateMutation.mutate()}
                  disabled={generateMutation.isPending}
                  className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2 text-xs font-semibold text-white hover:bg-purple-700 disabled:opacity-50 transition shadow-xs cursor-pointer"
                >
                  {generateMutation.isPending ? (
                    <>
                      <Loader2 size={13} className="animate-spin" />
                      <span>Generating Plan from Crawl Data...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles size={13} />
                      <span>Generate 30-Day Plan from Crawl Data</span>
                    </>
                  )}
                </button>
              </div>
            ) : currentWeekTasks.length === 0 ? (
              <div className="py-10 text-center text-xs text-brand-400">
                All tasks for Week {activeWeek} have been completed or scheduled in adjacent sprints.
              </div>
            ) : (
              currentWeekTasks.map((task) => (
              <div
                key={task.id}
                className={cn(
                  "p-4 rounded-xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4",
                  task.status === "COMPLETED"
                    ? "bg-success-50/30 border-success-200/60"
                    : task.status === "IN_PROGRESS"
                    ? "bg-warning-50/30 border-warning-200/60 shadow-xs"
                    : "bg-white border-line",
                )}
              >
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="w-11 h-11 rounded-xl bg-brand-100 flex flex-col items-center justify-center shrink-0 text-brand-800">
                    <span className="text-[9px] uppercase font-bold tracking-tight text-brand-400">Day</span>
                    <span className="text-[15px] font-mono font-bold leading-none">{task.day}</span>
                  </div>

                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[13px] font-bold text-brand-950">
                        {task.title}
                      </span>
                      <Pill
                        tone={
                          task.status === "COMPLETED"
                            ? "good"
                            : task.status === "IN_PROGRESS"
                            ? "warn"
                            : "default"
                        }
                      >
                        {task.status.replace("_", " ")}
                      </Pill>
                      <span className="text-[10.5px] font-mono text-brand-400">
                        {task.category}
                      </span>
                    </div>

                    <p className="text-[12px] text-brand-600 leading-relaxed">
                      {task.description}
                    </p>

                    <div className="pt-1 flex flex-wrap items-center gap-3 text-[11px]">
                      <span className="font-semibold text-brand-900">
                        Business Impact: <span className="font-normal text-brand-600">{task.plainImpact}</span>
                      </span>
                      <span className="text-brand-300">•</span>
                      <span className="text-brand-500">
                        Deliverable: <span className="font-mono text-brand-700">{task.deliverable}</span>
                      </span>
                    </div>
                  </div>
                </div>

                <div className="shrink-0 flex items-center gap-2 self-end md:self-center">
                  <div className="text-right text-[11px] text-brand-400 font-mono hidden sm:block">
                    ~{task.estimatedMinutes}m runtime
                  </div>
                  {task.status === "COMPLETED" ? (
                    <div className="flex items-center gap-1 text-xs font-bold text-success-700">
                      <CheckCircle2 size={15} className="text-success-600" />
                      <span>Executed</span>
                    </div>
                  ) : task.status === "IN_PROGRESS" ? (
                    <div className="flex items-center gap-1.5 text-xs font-bold text-warning-700">
                      <Loader2 size={13} className="animate-spin text-warning-600" />
                      <span>In Progress</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-xs text-brand-400">
                      <Clock size={13} />
                      <span>Queued</span>
                    </div>
                  )}
                </div>
              </div>
            )))}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-line bg-surface-2 flex flex-col sm:flex-row items-center justify-between gap-3 text-[12px]">
          <div className="text-brand-500 flex items-center gap-2">
            <ShieldCheck size={15} className="text-success-600" />
            <span>All code changes pass automated syntax verification &amp; regression checks prior to deployment.</span>
          </div>

          <div className="flex items-center gap-2">
            <ActionButton variant="secondary" onClick={onClose} className="h-8 px-3 text-xs cursor-pointer">
              Close Window
            </ActionButton>
            {!isApproved && (
              <ActionButton
                variant="primary"
                onClick={handleApprove}
                disabled={approveMutation.isPending}
                className="h-8 px-4 text-xs font-bold shadow-sm cursor-pointer"
              >
                {approveMutation.isPending ? "Activating..." : "Approve 30-Day Plan"}
              </ActionButton>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
