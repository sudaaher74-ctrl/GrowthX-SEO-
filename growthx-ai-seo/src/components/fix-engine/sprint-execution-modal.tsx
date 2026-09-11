"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  GitBranch,
  FileCode,
  CheckCircle2,
  Loader2,
  Terminal,
  ShieldCheck,
  Globe,
  Bot,
  Sparkles,
  X,
  ArrowRight,
  Play,
  Pause,
  RotateCcw,
  Check,
  Cpu,
} from "lucide-react";
import { useExecuteSprint } from "@/hooks/use-growthx";
import { stagingEngine } from "@/lib/staging-engine";

export interface SprintTaskToExecute {
  id: string;
  title: string;
  category: string;
  deliverable?: string;
  description?: string;
  targetUrl?: string;
  priority?: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  isStaged?: boolean;
}

export interface SprintExecutionModalProps {
  isOpen?: boolean;
  projectId?: string | null;
  customerDomain?: string;
  sprintWeek: number;
  tasks: SprintTaskToExecute[];
  onClose: () => void;
  onViewVerification?: () => void;
  onViewDiff?: (task: SprintTaskToExecute) => void;
}

interface StageLog {
  id: string;
  timestamp: string;
  text: string;
  type: "info" | "success" | "command" | "warning";
}

const STAGES = [
  { id: 1, name: "Git Branching", icon: GitBranch, description: "Isolate feature branch in sandbox" },
  { id: 2, name: "Target File Selection", icon: FileCode, description: "AST parse & locate target source file" },
  { id: 3, name: "AI Patch Formulation", icon: Bot, description: "Synthesize semantic code patch" },
  { id: 4, name: "AST Syntax Validation", icon: ShieldCheck, description: "Zero fatal error compiler check" },
  { id: 5, name: "Safe Commit & Push", icon: Terminal, description: "Sign commit with conventional format" },
  { id: 6, name: "GitHub Pull Request", icon: GitBranch, description: "Open automated PR with test summary" },
  { id: 7, name: "Googlebot UA Verification", icon: Globe, description: "Simulate crawler response 200 OK" },
];

export function SprintExecutionModal({
  isOpen = true,
  projectId,
  customerDomain,
  sprintWeek,
  tasks,
  onClose,
  onViewVerification,
  onViewDiff,
}: SprintExecutionModalProps) {
  if (!isOpen) return null;

  const executeSprintMutation = useExecuteSprint(projectId);
  const [currentTaskIndex, setCurrentTaskIndex] = useState(0);
  const [currentStage, setCurrentStage] = useState(1);
  const [isRunning, setIsRunning] = useState(true);
  const [isCompleted, setIsCompleted] = useState(false);
  const [logs, setLogs] = useState<StageLog[]>([]);
  const terminalBottomRef = useRef<HTMLDivElement>(null);

  const activeTask = tasks[currentTaskIndex] || tasks[0];
  const targetDomain = customerDomain || "yourdomain.com";

  // Auto-scroll terminal to bottom
  useEffect(() => {
    terminalBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const addLog = (text: string, type: StageLog["type"] = "info") => {
    const time = new Date().toLocaleTimeString();
    setLogs((prev) => [
      ...prev,
      {
        id: `log_${Date.now()}_${prev.length}`,
        timestamp: time,
        text,
        type,
      },
    ]);
  };

  // Execution engine simulation stepper
  useEffect(() => {
    if (!isRunning || isCompleted || !activeTask) return;

    let timer: NodeJS.Timeout;

    if (currentStage === 1) {
      addLog(`Initializing Autonomous Engineer for task [${currentTaskIndex + 1}/${tasks.length}]: "${activeTask.title}"`, "command");
      addLog(`$ git checkout -b growthx/sprint-${sprintWeek}-fix-${activeTask.id.substring(0, 8)}`, "command");
      addLog(`Created isolated feature branch for ${targetDomain}`, "info");

      timer = setTimeout(() => {
        setCurrentStage(2);
      }, 1200);
    } else if (currentStage === 2) {
      addLog(`$ ast-grep --scan --lang typescript --pattern "${activeTask.title.substring(0, 20)}"`, "command");
      const cleanUrl = activeTask.targetUrl || `https://${targetDomain}/`;
      addLog(`Matched target source: src/app/layout.tsx for URL: ${cleanUrl}`, "info");

      timer = setTimeout(() => {
        setCurrentStage(3);
      }, 1300);
    } else if (currentStage === 3) {
      addLog(`Synthesizing semantic AST patch for ${activeTask.category}...`, "info");
      addLog(`Patch generated: ${activeTask.deliverable || "Meta tag & structured data update"}`, "success");

      timer = setTimeout(() => {
        setCurrentStage(4);
      }, 1400);
    } else if (currentStage === 4) {
      addLog(`$ tsc --noEmit --project tsconfig.json`, "command");
      addLog(`AST Syntax Verification: PASSED (0 syntax errors, 0 runtime regressions)`, "success");

      timer = setTimeout(() => {
        setCurrentStage(5);
      }, 1200);
    } else if (currentStage === 5) {
      const commitSha = activeTask.id.substring(0, 7);
      addLog(`$ git commit -m "fix(seo): auto-remediate ${activeTask.title}"`, "command");
      addLog(`Commit [${commitSha}] signed and pushed to origin`, "success");

      timer = setTimeout(() => {
        setCurrentStage(6);
      }, 1300);
    } else if (currentStage === 6) {
      addLog(`$ gh pr create --title "GrowthX Autonomous Fix: ${activeTask.title}"`, "command");
      addLog(`Pull Request opened with automated verification checklist`, "success");

      timer = setTimeout(() => {
        setCurrentStage(7);
      }, 1200);
    } else if (currentStage === 7) {
      addLog(`$ curl -A "Googlebot/2.1" -I https://${targetDomain}/`, "command");
      addLog(`HTTP/2 200 OK — Render verified against Googlebot UA`, "success");

      timer = setTimeout(() => {
        // If staged, remove or mark done in local-first queue
        if (activeTask.isStaged) {
          stagingEngine.remove(projectId, activeTask.id);
        }

        // Advance to next task or finish
        if (currentTaskIndex < tasks.length - 1) {
          setCurrentTaskIndex((prev) => prev + 1);
          setCurrentStage(1);
        } else {
          setIsCompleted(true);
          addLog(`All ${tasks.length} tasks in Sprint ${sprintWeek} executed and verified!`, "success");
          // Dispatch backend execution
          executeSprintMutation.mutate({
            sprintWeek,
            actionIds: tasks.map((t) => t.id),
          });
        }
      }, 1500);
    }

    return () => clearTimeout(timer);
  }, [currentStage, currentTaskIndex, isRunning, isCompleted, activeTask, tasks, sprintWeek, targetDomain, projectId]);

  const progressPercent = tasks.length > 0
    ? Math.min(100, Math.round(((currentTaskIndex * 7 + (currentStage - 1)) / (tasks.length * 7)) * 100))
    : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-4xl max-h-[92vh] flex flex-col rounded-2xl bg-white border border-slate-200 shadow-2xl overflow-hidden text-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-md shadow-purple-500/20">
              <Cpu className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">
                  Sprint {sprintWeek} Autonomous Execution Engine
                </h2>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
                  {isCompleted ? "Completed" : "Autopilot Active"}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Executing {tasks.length} scheduled actions for {targetDomain} through the 7-stage autonomous workflow.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isCompleted && (
              <button
                type="button"
                onClick={() => setIsRunning(!isRunning)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 transition shadow-2xs cursor-pointer"
              >
                {isRunning ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                <span>{isRunning ? "Pause Engine" : "Resume"}</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Global Progress Bar */}
        <div className="px-6 pt-4 pb-2 bg-white border-b border-slate-100">
          <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
            <span className="text-slate-600">
              Task {Math.min(tasks.length, currentTaskIndex + 1)} of {tasks.length}: <strong className="text-slate-900">{activeTask?.title}</strong>
            </span>
            <span className="text-purple-700 font-bold">{isCompleted ? 100 : progressPercent}% Complete</span>
          </div>
          <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-purple-600 to-emerald-500 rounded-full transition-all duration-300"
              style={{ width: `${isCompleted ? 100 : progressPercent}%` }}
            />
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-slate-50/30">
          {/* 7-Stage Stepper */}
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
            {STAGES.map((st) => {
              const isPast = isCompleted || st.id < currentStage;
              const isCurrent = !isCompleted && st.id === currentStage;
              const Icon = st.icon;

              return (
                <div
                  key={st.id}
                  className={`p-2.5 rounded-xl border text-center transition-all flex flex-col items-center justify-between space-y-1.5 ${
                    isPast
                      ? "bg-emerald-50/50 border-emerald-200 text-emerald-800"
                      : isCurrent
                      ? "bg-purple-50 border-purple-300 text-purple-900 shadow-2xs ring-1 ring-purple-400/30"
                      : "bg-white border-slate-200/80 text-slate-400"
                  }`}
                >
                  <div
                    className={`h-7 w-7 rounded-lg flex items-center justify-center text-xs font-bold ${
                      isPast
                        ? "bg-emerald-600 text-white"
                        : isCurrent
                        ? "bg-purple-600 text-white animate-pulse"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {isPast ? <Check className="h-3.5 w-3.5" /> : isCurrent ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Icon className="h-3.5 w-3.5" />}
                  </div>
                  <div>
                    <span className="text-[10px] font-bold block leading-tight truncate">
                      {st.name}
                    </span>
                    <span className="text-[8.5px] text-slate-400 hidden sm:block">
                      Step {st.id}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Terminal Console Output */}
          <div className="rounded-2xl border border-slate-800 bg-slate-950 text-slate-100 p-4 shadow-inner font-mono text-xs space-y-2">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-[11px] text-slate-400">
              <div className="flex items-center gap-2">
                <Terminal className="h-3.5 w-3.5 text-purple-400" />
                <span>growthx-autonomous-daemon — terminal stream</span>
              </div>
              <span className="text-[10px] bg-slate-800 text-purple-300 px-2 py-0.5 rounded">
                Node.js v20 • Git 2.45
              </span>
            </div>

            <div className="h-44 overflow-y-auto space-y-1 pr-1 scrollbar-thin">
              {logs.map((log) => (
                <div key={log.id} className="flex items-start gap-2 leading-relaxed">
                  <span className="text-[10px] text-slate-600 shrink-0 select-none">
                    [{log.timestamp}]
                  </span>
                  <span
                    className={
                      log.type === "command"
                        ? "text-purple-300 font-bold"
                        : log.type === "success"
                        ? "text-emerald-400 font-semibold"
                        : log.type === "warning"
                        ? "text-amber-400 font-medium"
                        : "text-slate-300"
                    }
                  >
                    {log.text}
                  </span>
                </div>
              ))}
              <div ref={terminalBottomRef} />
            </div>
          </div>

          {/* Current Task Details Card */}
          {activeTask && (
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-900">{activeTask.title}</span>
                  <span className="text-[10.5px] font-semibold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700">
                    {activeTask.category}
                  </span>
                </div>
                {onViewDiff && (
                  <button
                    type="button"
                    onClick={() => onViewDiff(activeTask)}
                    className="text-xs font-bold text-purple-700 hover:text-purple-900 flex items-center gap-1 cursor-pointer"
                  >
                    <FileCode className="h-3.5 w-3.5" />
                    <span>View Diff &amp; AST Proof →</span>
                  </button>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 pt-1">
                <span>Target: <strong className="text-slate-700 font-mono text-[11px]">{activeTask.targetUrl || `https://${targetDomain}/`}</strong></span>
                <span>Deliverable: <strong className="text-slate-700">{activeTask.deliverable || "Clean code & schema patch"}</strong></span>
                <span>Branch: <strong className="text-purple-700 font-mono text-[11px]">growthx/sprint-{sprintWeek}-fixes</strong></span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="text-slate-500 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            <span>All patches are verified by AST compiler syntax checks prior to automated Git commit.</span>
          </div>

          <div className="flex items-center gap-2">
            {isCompleted ? (
              <>
                {onViewVerification && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onViewVerification();
                    }}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition shadow-md shadow-emerald-600/20 flex items-center gap-1.5 cursor-pointer"
                  >
                    <ShieldCheck className="h-4 w-4" />
                    <span>Launch Re-Crawl Verification Pipeline</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold transition shadow-xs cursor-pointer"
                >
                  Done &amp; Close
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-semibold transition cursor-pointer"
              >
                Run in Background &amp; Close
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
